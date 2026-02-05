from typing import List
import re
import os
import email
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.hr_contact_model import HRContact
from app.models.email_models import EmailConversation
from app.models.placement_requirement_model import PlacementRequirement
from app.schemas.hr_schema import (
    EmailRequirementParseRequest,
    HRContactCreate,
    HRContactResponse,
    ParsedRequirement,
)
from app.services.email_service import EmailService
from app.services.ai_service import AIService
from app.services.reminder_service import ReminderService
from app.schemas.reminder_schema import ReminderCreate
from app.core.config import settings

class HRService:
    """Business logic for HR contacts, email understanding, and requirements."""

    @staticmethod
    def list_contacts(db: Session) -> List[HRContactResponse]:
        contacts = db.query(HRContact).order_by(HRContact.id.asc()).all()
        return [HRContactResponse.model_validate(c) for c in contacts]

    @staticmethod
    def create_contact(db: Session, data: HRContactCreate) -> HRContactResponse:
        contact = HRContact(
            name=data.name,
            company=data.company,
            email=data.email,
            email_status=data.email_status,
            draft_status=data.draft_status,
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return HRContactResponse.model_validate(contact)

    @staticmethod
    def reset_all_statuses(db: Session) -> dict:
        """Reset all HR contact statuses to 'Not Started'"""
        try:
            db.query(HRContact).update({
                HRContact.email_status: "Not Started",
                HRContact.draft_status: "Not Started"
            })
            db.commit()
            return {"message": "All HR contact statuses reset successfully"}
        except Exception as e:
            db.rollback()
            return {"error": str(e)}

    @staticmethod
    def get_conversation_history(db: Session, contact_id: int) -> dict:
        contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
        if not contact:
            return {"error": "Contact not found"}
        
        # More lenient date filtering - show emails from Jan 1, 2026 onwards
        # This ensures we capture all recent emails including drafts
        conversations = db.query(EmailConversation).filter(
            EmailConversation.hr_contact_id == contact_id,
            EmailConversation.subject != "Test DB Persistence"
        ).order_by(EmailConversation.sent_at.asc()).all()
        
        print(f"[DEBUG] get_conversation_history: Found {len(conversations)} items in DB for contact {contact_id}")
        
        # Debug: Show all conversations without date filter to see what's in DB
        all_conversations = db.query(EmailConversation).filter(
            EmailConversation.hr_contact_id == contact_id
        ).order_by(EmailConversation.sent_at.asc()).all()
        print(f"[DEBUG] Total conversations in DB (no date filter): {len(all_conversations)}")
        for conv in all_conversations:
            print(f"[DEBUG] Conv {conv.id}: {conv.direction} - {conv.subject} - {conv.sent_at}")
        # Format conversations for frontend
        conversation_list = []
        for conv in conversations:
            # Convert timestamp to milliseconds for frontend
            # Ensure we treat stored sent_at as UTC if it's naive
            dt = conv.sent_at
            if dt and dt.tzinfo is None:
                # Assume UTC
                from datetime import timezone
                dt = dt.replace(tzinfo=timezone.utc)
            
            timestamp_ms = int(dt.timestamp() * 1000) if dt else int(datetime.now().timestamp() * 1000)
            
            if conv.direction == "sent":
                sender = "Placement Team"
                recipient = "HR Team"
            else:
                sender = "HR Team"
                recipient = "Placement Team"
            
            # Add Z to indicate UTC if using isoformat
            iso_str = dt.isoformat().replace('+00:00', 'Z') if dt else datetime.utcnow().isoformat() + 'Z'
            if not iso_str.endswith('Z') and '+00:00' not in iso_str:
                 iso_str += 'Z'

            # Determine content and flags for confidential mode
            is_confidential = bool(conv.is_confidential)
            require_otp = bool(conv.require_otp)
            content = conv.content or ''
            
            # Check if expired
            is_expired = False
            if conv.expires_at and conv.expires_at < datetime.utcnow():
                is_expired = True
                content = "[This confidential message has expired and is no longer viewable]"
            elif is_confidential and require_otp:
                content = "[This is a confidential message. OTP verification required to view content]"

            conversation_item = {
                "id": conv.id,
                "subject": conv.subject,
                "content": content,
                "direction": conv.direction,
                "sender": sender,
                "recipient": recipient,
                "timestamp": timestamp_ms,
                "date_display": dt.strftime("%b %d, %I:%M %p") if dt else "", 
                "sent_at": iso_str,
                "is_confidential": is_confidential,
                "is_expired": is_expired,
                "expires_at": conv.expires_at.isoformat() + 'Z' if conv.expires_at else None,
                "disable_forwarding": bool(conv.disable_forwarding),
                "disable_copying": bool(conv.disable_copying),
                "disable_downloading": bool(conv.disable_downloading),
                "disable_printing": bool(conv.disable_printing),
                "require_otp": require_otp
            }
            conversation_list.append(conversation_item)
        
        return {
            "contact": {
                "name": contact.name,
                "company": contact.company,
                "email": contact.email
            },
            "conversations": conversation_list
        }

    @staticmethod
    def sync_contact_emails(db: Session, contact_id: int) -> dict:
        contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
        if not contact:
             return {"error": "Contact not found"}
        
        try:
            print(f"[SYNC] Fetching fresh emails for {contact.email}...")
            # Use the optimized fetch with target_email filter
            replies = EmailService.fetch_replies([contact.email], target_email=contact.email)
            
            stored_count = 0
            merged_count = 0
            processed_ids = set()
            
            latest_received_content = None
            
            for reply in replies:
                direction = reply.get("direction", "received")
                subject = reply.get("subject", "")
                content = reply.get("body", "")
                message_id = reply.get("message_id")
                
                if not content or not content.strip(): continue
                if message_id and message_id in processed_ids: continue
                
                # 1. Deduplicate by ID
                existing = None
                if message_id:
                    existing = db.query(EmailConversation).filter(
                        EmailConversation.hr_contact_id == contact_id,
                        EmailConversation.message_id == message_id
                    ).first()
                
                # 2. Duplicate by Content (Merge)
                if not existing:
                    candidates = db.query(EmailConversation).filter(
                        EmailConversation.hr_contact_id == contact_id,
                        EmailConversation.direction == direction
                    ).order_by(EmailConversation.sent_at.desc()).all()
                    
                    for cand in candidates:
                        c_subj = (cand.subject or "").lower().strip()
                        c_body = (cand.content or "").lower().strip().replace('\r','').replace('\n','').replace(' ','')
                        inc_subj = subject.lower().strip()
                        inc_body = content.lower().strip().replace('\r','').replace('\n','').replace(' ','')
                        
                        # Match by content AND timestamp
                        time_match = False
                        
                        # Calculate time difference if both have timestamps
                        time_diff = 999999
                        if cand.sent_at and reply.get("parsed_timestamp"):
                            time_diff = abs((cand.sent_at - reply.get("parsed_timestamp")).total_seconds())

                        # For RECEIVED emails, keep strict 2-second window (high precision expected)
                        if direction == "received":
                            time_match = time_diff < 5 # Relaxed slightly to 5s
                        else:
                            # For SENT emails, allow much larger window (e.g. 10 minutes)
                            # because local DB time = when we clicked send
                            # IMAP time = when Gmail finally processed/appended it to Sent folder
                            time_match = time_diff < 600
                        
                        # Match Logic
                        is_match = False
                        
                        # 1. Strong Match: Subject + Body + Time
                        if c_subj == inc_subj and c_body == inc_body and time_match:
                            is_match = True
                        
                        # 2. Sent Email Fallback: Subject + Body (Ignore Time if it's within sensible range or one is missing)
                        # Sometimes body formatting differs slightly (HTML vs Plain), so we can also check for ID match if we had one
                        if direction == "sent" and not is_match:
                             # If subject and body match exactly, and it's within 24 hours, assume it's the same
                             if c_subj == inc_subj and c_body == inc_body and time_diff < 86400:
                                 is_match = True
                             # Partial body match for Sent items (HTML stripping might vary)
                             elif c_subj == inc_subj and (c_body in inc_body or inc_body in c_body) and time_match:
                                 is_match = True

                        if is_match:
                            existing = cand
                            if message_id: cand.message_id = message_id
                            # Sync timestamp from IMAP as it's the "official" time
                            pts = reply.get("parsed_timestamp")
                            if pts: cand.sent_at = pts
                            db.commit()
                            merged_count += 1
                            break
                
                if existing:
                    # If existing record has cid: but fresh one has base64 data, update it
                    if "cid:" in (existing.content or "") and "data:image/" in (content or ""):
                        print(f"[DEBUG] Refreshing image data for existing email: {subject}")
                        existing.content = content
                        db.commit()
                    
                    if message_id: processed_ids.add(message_id)
                    continue

                # 3. Insert New
                pts = reply.get("parsed_timestamp")
                if not pts:
                    print(f"[WARN] Skipping email with bad date: {subject}")
                    continue
                
                conversation = EmailConversation(
                    hr_contact_id=contact_id,
                    subject=subject,
                    content=content,
                    direction=direction,
                    sent_at=pts,
                    message_id=message_id 
                )
                db.add(conversation)
                stored_count += 1
                if message_id: processed_ids.add(message_id)
                
                if direction == "received":
                    contact.email_status = "Replied"
                    contact.draft_status = "Completed"
                    # Process intent immediately for each received email
                    HRService._process_intent_for_email(db, contact, content)
                    latest_received_content = content
            
            db.commit()
            return {"message": f"Sync complete. New: {stored_count}, Merged: {merged_count}", "new": stored_count}
        except Exception as e:
            import traceback
            print(f"[ERROR] Sync failed for contact {contact_id}: {str(e)}")
            print(traceback.format_exc())
            db.rollback()
            return {"error": str(e)}

    @staticmethod
    def send_email(db: Session, contact_id: int, email_data: dict) -> dict:
        contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
        if not contact:
            return {"error": "Contact not found"}
        
        try:
            # Send email using EmailService
            print(f"[DEBUG] Attempting to send email to {contact.email}")
            success, generated_id = EmailService.send_email(
                to_email=contact.email,
                subject=email_data.get('subject', 'Placement Communication'),
                body=email_data.get('content', '')
            )
            print(f"[DEBUG] Email send result: {success}, ID: {generated_id}")
            
            if success:
                print(f"[DEBUG] Email sent successfully, storing conversation...")
                # Store conversation with current UTC time, normalized to seconds
                now_utc = datetime.utcnow().replace(microsecond=0)
                
                # Extract confidential settings
                is_confidential = email_data.get('is_confidential', False)
                expiry_days = email_data.get('expiry_days', 7)
                
                expires_at = None
                otp_code = None
                if is_confidential:
                    from datetime import timedelta
                    import random
                    import string
                    expires_at = now_utc + timedelta(days=expiry_days)
                    if email_data.get('require_otp'):
                        otp_code = ''.join(random.choices(string.digits, k=6))
                
                conversation = EmailConversation(
                    hr_contact_id=contact_id,
                    subject=email_data.get('subject', 'Placement Communication'),
                    content=email_data.get('content', ''),
                    direction="sent",
                    sent_at=now_utc,
                    message_id=generated_id,
                    is_confidential=1 if is_confidential else 0,
                    expires_at=expires_at,
                    disable_forwarding=1 if email_data.get('disable_forwarding') else 0,
                    disable_copying=1 if email_data.get('disable_copying') else 0,
                    disable_downloading=1 if email_data.get('disable_downloading') else 0,
                    disable_printing=1 if email_data.get('disable_printing') else 0,
                    require_otp=1 if email_data.get('require_otp') else 0,
                    otp_code=otp_code
                )
                db.add(conversation)
                print(f"[DEBUG] Added conversation to session, committing...")
                print(f"[DEBUG] Conversation details: subject='{conversation.subject}', direction='{conversation.direction}', sent_at='{conversation.sent_at}', contact_id={contact_id}")
                # Update contact status
                contact.email_status = "Awaiting Response"
                contact.draft_status = "Completed"
                
                try:
                    db.commit()
                    print(f"[DEBUG] Conversation stored successfully with ID: {generated_id}")
                    
                    # Verify the conversation was actually stored
                    stored_conv = db.query(EmailConversation).filter(
                        EmailConversation.hr_contact_id == contact_id,
                        EmailConversation.message_id == generated_id
                    ).first()
                    if stored_conv:
                        print(f"[DEBUG] Verification: Conversation {stored_conv.id} found in DB")
                    else:
                        print(f"[ERROR] Verification failed: Conversation not found in DB after commit")
                        
                except Exception as commit_error:
                    print(f"[ERROR] Database commit failed: {commit_error}")
                    db.rollback()
                    raise commit_error
                
                return {
                    "message": f"Email sent successfully to {contact.email}",
                    "status": "sent",
                    "error": None
                }
            else:
                return {
                    "error": "Failed to send email",
                    "message": f"Failed to send email to {contact.email}",
                    "status": "failed"
                }
        except Exception as e:
            return {
                "error": str(e),
                "message": f"Failed to send email to {contact.email}. {str(e)}",
                "status": "failed"
            }

    @staticmethod
    def parse_requirement_from_email(db: Session, data: EmailRequirementParseRequest) -> ParsedRequirement:
        """Parse job requirements from email content"""
        # TODO: Implement email parsing logic
        return ParsedRequirement(
            position="Software Developer",
            skills=["Python", "JavaScript"],
            experience="0-2 years",
            location="Remote",
            salary_range="Not specified",
            company_name=data.company_name if hasattr(data, 'company_name') else "Unknown"
        )
    
    @staticmethod
    def fetch_and_store_received_emails(db: Session) -> dict:
        """Fetch new emails from IMAP and store them for all contacts in ONE connection"""
        try:
            contacts = db.query(HRContact).all()
            if not contacts:
                return {"message": "No contacts to sync", "count": 0}
            
            all_emails = [c.email for c in contacts if c.email]
            # Perform a SINGLE fetch for all contacts with a short lookback (2 days) for speed
            print(f"[IMAP] Performing bulk fetch for {len(all_emails)} contacts (2-day lookback)...")
            all_replies = EmailService.fetch_replies(all_emails, lookback_days=2)
            
            # Map replies to contact emails for easy lookups
            replies_by_email = {}
            for reply in all_replies:
                direction = reply.get("direction")
                email_addr = ""
                if direction == "received":
                    # For received, the 'from' contains the HR email
                    from_header = reply.get("from", "")
                    email_addr = EmailService.validate_email(email.utils.parseaddr(from_header)[1].lower().strip()) and email.utils.parseaddr(from_header)[1].lower().strip() or ""
                else:
                    # For sent, the 'to' is not explicitly in the reply dict yet, but fetch_replies filters it
                    # Let's assume we can match it back or just process all and filter
                    pass
                
                # Implementation detail: fetch_replies doesn't return the recipient email for sent items easily 
                # in the current structure without re-parsing. 
                # However, for RECEIVED notifications (the user's main concern), we prioritize 'received' direction.
            
            # Simplified approach: Loop through all replies and match to contacts
            total_stored = 0
            replies_processed = 0
            
            # Create a mapping for faster lookup
            contact_map = {c.email.lower().strip(): c for c in contacts if c.email}
            
            for reply in all_replies:
                replies_processed += 1
                direction = reply.get("direction", "received")
                subject = reply.get("subject", "")
                content = reply.get("body", "")
                message_id = reply.get("message_id")
                pts = reply.get("parsed_timestamp") or datetime.utcnow()
                
                # Determine which contact this belongs to
                target_contact = None
                if direction == "received":
                    partner_email = email.utils.parseaddr(reply.get("from", ""))[1].lower().strip()
                    target_contact = contact_map.get(partner_email)
                else: 
                    # For SENT, match by the 'to' field we added to fetch_replies
                    recipient_email = reply.get("to", "").lower().strip()
                    target_contact = contact_map.get(recipient_email)
                
                if not target_contact:
                    continue
                
                # Deduplication 1: ID
                existing = db.query(EmailConversation).filter(
                    EmailConversation.hr_contact_id == target_contact.id,
                    EmailConversation.message_id == message_id
                ).first()
                
                # Deduplication 2: Content (Aggressive)
                if not existing:
                    # Check recent emails for this contact with same direction and content
                    recent_candidates = db.query(EmailConversation).filter(
                        EmailConversation.hr_contact_id == target_contact.id,
                        EmailConversation.direction == direction
                    ).order_by(EmailConversation.sent_at.desc()).limit(10).all()
                    
                    for cand in recent_candidates:
                        c_subj = (cand.subject or "").lower().strip()
                        c_body = (cand.content or "").lower().strip().replace('\r','').replace('\n','').replace(' ','')
                        inc_subj = subject.lower().strip()
                        inc_body = content.lower().strip().replace('\r','').replace('\n','').replace(' ','')
                        
                        # Match by content AND timestamp
                        time_match = False
                        
                        # Calculate time difference
                        time_diff = 999999
                        if cand.sent_at and pts:
                            time_diff = abs((cand.sent_at - pts).total_seconds())

                        if direction == "received":
                            time_match = time_diff < 5
                        else:
                            # Relaxed check for sent items
                            time_match = time_diff < 600
                            
                        # Match Logic
                        is_match = False
                        
                        # 1. Strong Match
                        if c_subj == inc_subj and c_body == inc_body and time_match:
                            is_match = True
                            
                        # 2. Sent Email Fallback
                        if direction == "sent" and not is_match:
                             if c_subj == inc_subj and c_body == inc_body and time_diff < 86400:
                                 is_match = True
                             elif c_subj == inc_subj and (c_body in inc_body or inc_body in c_body) and time_match:
                                 is_match = True

                        if is_match:
                            existing = cand
                            if message_id: 
                                cand.message_id = message_id
                                db.commit()
                            break

                if existing:
                    continue
                
                # Store the email
                conversation = EmailConversation(
                    hr_contact_id=target_contact.id,
                    subject=subject,
                    content=content,
                    direction=direction,
                    sent_at=pts,
                    message_id=message_id
                )
                db.add(conversation)
                
                if direction == "received":
                    target_contact.email_status = "Replied"
                    target_contact.draft_status = "Completed"
                    # Process intent immediately
                    HRService._process_intent_for_email(db, target_contact, content)
                
                total_stored += 1
            
            if total_stored > 0:
                db.commit()
        
            print(f"[IMAP] Bulk sync complete. Scanned {len(all_replies)} emails, stored {total_stored} new.")
            return {"message": f"Fetched and stored {total_stored} new emails", "count": total_stored}
        except Exception as e:
            import traceback
            print(f"[IMAP] Bulk sync failed: {str(e)}")
            traceback.print_exc()
            db.rollback()
            return {"error": str(e), "count": 0}
    @staticmethod
    def _process_intent_for_email(db: Session, contact: HRContact, content: str):
        """Auto-extract intent and create reminder if visit detected, or cancel reminders if cancellation detected"""
        try:
            if not content or len(content) < 20: return
            
            # Check for cancellation first
            cancellation_info = AIService.detect_cancellation(content)
            if cancellation_info['is_cancelled']:
                print(f"[CANCELLATION] Detected cancellation from {contact.company}: {cancellation_info['reason']}")
                cancelled_count = ReminderService.handle_cancellation(db, contact.id, cancellation_info)
                if cancelled_count > 0:
                    print(f"[CANCELLATION] Cancelled {cancelled_count} reminders for {contact.company}")
                return
            
            # Check for rescheduling - No longer need to cancel and re-create manually, 
            # as ReminderService.create_reminder now handles updates.
            reschedule_info = AIService.detect_rescheduling(content)
            rescheduled_date = reschedule_info.get('new_date') if reschedule_info.get('is_rescheduled') else None
            
            # Using AIService to extract intent
            intent = AIService.extract_intent(content, contact.company)
            
            visit_date = intent.get("visit_date") or rescheduled_date
            deadline = intent.get("deadline")
            commitments = intent.get("commitments", [])
            
            trigger_date = visit_date or deadline
            
            # If visit planned but no date, use "Upcoming" as requested
            if not trigger_date and "Campus visit planned" in commitments:
                trigger_date = "Upcoming"
            
            if trigger_date:
                print(f"[AUTO] Follow-up detected for {contact.company}: {trigger_date}")
                
                # Extract student requirements to create meaningful description
                from app.utils.student_requirements import extract_student_requirements
                requirements = extract_student_requirements(content)
                
                # Build description based on requirements
                description_parts = []
                
                if requirements.get('domain'):
                    description_parts.append(f"{requirements['domain']} Students")
                elif requirements.get('skills'):
                    # Use first skill if no domain
                    description_parts.append(f"{requirements['skills'][0]} Role")
                
                # Add count if specified
                if requirements.get('count'):
                    if description_parts:
                        description_parts[0] = f"{requirements['count']} {description_parts[0]}"
                    else:
                        description_parts.append(f"{requirements['count']} Positions")
                
                # Fallback to generic if no requirements found
                if not description_parts:
                    role = intent.get('role')
                    if role and role.lower() != 'none':
                        description_parts.append(f"{role} Role")
                    else:
                        description_parts.append("Placement Drive")
                
                # Create final description
                purpose = " - ".join(description_parts)
                description = f"Campus Visit - {purpose}"
                
                ReminderService.create_reminder(db, ReminderCreate(
                    contact_id=contact.id,
                    description=description,
                    due_date=trigger_date,
                    priority="high"
                ))
        except Exception as e:
            print(f"[AUTO] Intent extraction failed: {str(e)}")

    @staticmethod
    def sync_all_statuses(db: Session) -> dict:
        """Update email_status and draft_status for all contacts based on message history."""
        try:
            contacts = db.query(HRContact).all()
            updated_count = 0
            
            for contact in contacts:
                # Get the most recent conversation for this contact
                latest_conv = db.query(EmailConversation).filter(
                    EmailConversation.hr_contact_id == contact.id
                ).order_by(EmailConversation.sent_at.desc()).first()
                
                if latest_conv:
                    # Update status based on conversation history
                    if latest_conv.direction == "received":
                        contact.email_status = "Replied"
                        contact.draft_status = "Completed"
                    else: # direction == "sent"
                        contact.email_status = "Awaiting Response"
                        contact.draft_status = "Completed"
                    updated_count += 1
            
            db.commit()
            return {"message": f"Synchronized statuses for {updated_count} contacts", "count": updated_count}
        except Exception as e:
            db.rollback()
            print(f"[ERROR] sync_all_statuses failed: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    def generate_template_draft(db: Session, contact_id: int, template_type: str) -> dict:
        contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
        if not contact:
            return {"error": "Contact not found"}

        templates = {
            "final_year_students": {
                "subject": f"Placement Opportunity - Final Year Students",
                "content": f"""<p>Dear {contact.name or 'Hiring Team'},</p>

<p>Greetings from the Placement Cell!</p>

<p>We are pleased to introduce our final year students for placement opportunities at {contact.company}. Our students demonstrate exceptional academic performance and technical proficiency.</p>

<p>We would appreciate receiving your detailed job requirements to ensure precise candidate matching. This will enable us to shortlist the most suitable candidates for your consideration.</p>

<p>Looking forward to a successful collaboration.</p>

<p>Best regards,<br>
Placement Cell<br>
Bannari Amman Institute of Technology</p>"""
            },
            "internship_opportunities": {
                "subject": f"Internship Collaboration Opportunity",
                "content": f"""<p>Dear {contact.name or 'Hiring Team'},</p>

<p>We hope this email finds you well.</p>

<p>We are writing to explore internship opportunities at {contact.company} for our pre-final year students. Our students are eager to gain practical experience and contribute to your organization.</p>

<p>We would be grateful if you could share details about available internship positions and the application process.</p>

<p>Thank you for your time and consideration.</p>

<p>Best regards,<br>
Placement Cell<br>
Bannari Amman Institute of Technology</p>"""
            },
            "follow_up": {
                "subject": f"Follow-up: Placement Requirements | {contact.company}",
                "content": f"Dear {contact.name or 'Team'},<br><br>I hope this email finds you well.<br><br>This is a follow-up regarding our previous communication about placement opportunities at {contact.company}. We remain committed to providing you with qualified candidates.<br><br>To proceed effectively, we kindly request:<br>• Detailed job description<br>• Required skills and qualifications<br>• Number of positions available<br><br>Once we receive these details, we will promptly share relevant student profiles for your review.<br><br>Thank you for your time and consideration.<br><br>Best regards,<br>Placement Officer"
            }
        }
        
        # Handle both final_year_students and internship_opportunities
        template = templates.get(template_type, templates["final_year_students"])
        
        return {
            "subject": template["subject"],
            "to": contact.email,
            "from": "placement-cell@university.edu",
            "content": template["content"],
            "recipient_email": contact.email
        }