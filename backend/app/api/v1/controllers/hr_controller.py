from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.email_models import EmailTemplate
from app.models.hr_contact_model import HRContact
from app.schemas.hr_schema import (
    EmailDraftRequest,
    EmailRequirementParseRequest,
    EmailSendRequest,
    HRContactCreate,
    HRContactResponse,
    ParsedRequirement,
)
from app.schemas.intent_schema import (
    IntentExtractionRequest,
    DraftReplyRequest,
    MessageAnalysisRequest,
    ExtractedIntent,
    MessageClassification,
    DraftEmailResponse,
)
from app.services.csv_service import CSVService
from app.services.hr_service import HRService
from app.services.ranking_service import RankingService
from app.services.ai_service import AIService
from app.schemas.template_schema import TemplateCreate, TemplateResponse


router = APIRouter(prefix="/hr", tags=["HR Contacts"])


@router.get("/contacts", response_model=list[HRContactResponse])
def list_contacts(db: Session = Depends(get_db)):
    return HRService.list_contacts(db)


@router.post("/contacts", response_model=HRContactResponse)
def create_contact(data: HRContactCreate, db: Session = Depends(get_db)):
    return HRService.create_contact(db, data)


@router.post("/upload-csv", response_model=list[HRContactResponse])
async def upload_hr_csv(
    file: UploadFile = File(...),
    replace_mode: bool = Form(True),
    append_mode: bool = Form(False),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and Excel files (.csv, .xlsx, .xls) are supported."
        )

    try:
        file_bytes = await file.read()
        contacts = CSVService.import_hr_contacts_from_file(
            db, file_bytes, file.filename, replace_mode=replace_mode, append_mode=append_mode
        )
        if not contacts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid contacts found in file. Please check the file format and ensure it contains name, company, and email columns."
            )
        return [HRContactResponse.model_validate(c) for c in contacts]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )


@router.put("/contacts/{contact_id}", response_model=HRContactResponse)
def update_contact(contact_id: int, data: HRContactCreate, db: Session = Depends(get_db)):
    contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HR Contact not found"
        )
    
    # Update fields
    contact.name = data.name
    contact.company = data.company
    contact.email = data.email
    contact.email_status = data.email_status
    contact.draft_status = data.draft_status
    
    db.commit()
    db.refresh(contact)
    return HRContactResponse.model_validate(contact)


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HR Contact not found"
        )
    
    db.delete(contact)
    db.commit()
    return {"message": "HR Contact deleted successfully"}


@router.post("/parse-email", response_model=ParsedRequirement)
def parse_email_requirement(data: EmailRequirementParseRequest, db: Session = Depends(get_db)):
    return HRService.parse_requirement_from_email(db, data)


@router.post("/rank-students", response_model=list)
def rank_students_for_requirement(
    data: EmailRequirementParseRequest, db: Session = Depends(get_db)
):
    # First parse requirement, then rank students based on it
    requirement = HRService.parse_requirement_from_email(db, data)
    ranked = RankingService.rank_students_for_requirement(db, requirement)
    refined = RankingService.refine_ranking_with_llm(ranked)

    return [
        {
            "student_id": student.id,
            "name": student.name,
            "roll_no": student.roll_no,
            "domain": student.domain,
            "cgpa": student.cgpa,
            "ps_level": student.ps_level,
            "score": score,
        }
        for student, score in refined
    ]
    
@router.post("/generate-draft/{contact_id}")
def generate_draft_for_contact(
    contact_id: int, 
    request: EmailDraftRequest,
    db: Session = Depends(get_db)
):
    result = HRService.generate_template_draft(db, contact_id, request.template_type)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.get("error"))
    return result


@router.get("/conversation/{contact_id}")
def get_conversation_history(contact_id: int, db: Session = Depends(get_db)):
    # Auto-dismiss notifications for this contact
    global HR_REPLY_NOTIFICATIONS
    HR_REPLY_NOTIFICATIONS = [n for n in HR_REPLY_NOTIFICATIONS if n["contact"]["id"] != contact_id]
    
    # Mark emails as read in DB
    import sys
    from sqlalchemy import or_
    from app.models.email_models import EmailConversation
    
    # Debug: Check state before update
    debug_states = db.query(EmailConversation.id, EmailConversation.is_read).filter(
        EmailConversation.hr_contact_id == contact_id,
        EmailConversation.direction == "received"
    ).all()
    print(f"[DEBUG-STATE] Emails for {contact_id}: {debug_states}")

    updated_count = db.query(EmailConversation).filter(
        EmailConversation.hr_contact_id == contact_id,
        EmailConversation.direction == "received",
        or_(
            EmailConversation.is_read == 0,
            EmailConversation.is_read.is_(None)
        )
    ).update({"is_read": 1}, synchronize_session=False)
    db.commit()
    print(f"[DEBUG] Marked {updated_count} emails as read for contact {contact_id}")
    sys.stdout.flush()
    
    result = HRService.get_conversation_history(db, contact_id)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.get("error"))
    return result


@router.get("/{contact_id}/sync")
def sync_contact_emails(contact_id: int, db: Session = Depends(get_db)):
    """Manually sync emails for a specific contact"""
    result = HRService.sync_contact_emails(db, contact_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@router.post("/reset-all-statuses")
def reset_all_statuses(db: Session = Depends(get_db)):
    """Reset all HR contact statuses to 'Not Started'"""
    return HRService.reset_all_statuses(db)


@router.post("/sync-all-statuses")
def sync_all_statuses(db: Session = Depends(get_db)):
    """Synchronize all HR contact statuses with conversation history"""
    return HRService.sync_all_statuses(db)


@router.post("/send-email/{contact_id}")
def send_email_to_contact(
    contact_id: int,
    request: EmailSendRequest,
    db: Session = Depends(get_db)
):
    email_data = {
        "subject": request.subject,
        "content": request.content,
        "is_confidential": request.is_confidential,
        "expiry_days": request.expiry_days,
        "disable_forwarding": request.disable_forwarding,
        "disable_copying": request.disable_copying,
        "disable_downloading": request.disable_downloading,
        "disable_printing": request.disable_printing,
        "require_otp": request.require_otp
    }
    result = HRService.send_email(db, contact_id, email_data)
    
    if result.get("error") == "Contact not found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    
    # Return the result object (with error/status) so frontend can handle it properly
    # Don't raise exception here - let frontend handle the error response
    return result


@router.get("/export-excel")
def export_hr_contacts_excel(db: Session = Depends(get_db)):
    """Export all HR contacts to Excel file."""
    try:
        excel_bytes = CSVService.export_hr_contacts_to_excel(db)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=hr_contacts.xlsx"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export HR contacts: {str(e)}"
        )


@router.get("/export-csv")
def export_hr_contacts_csv(db: Session = Depends(get_db)):
    """Export all HR contacts to CSV file."""
    try:
        csv_bytes = CSVService.export_hr_contacts_to_csv(db)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=hr_contacts.csv"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export HR contacts: {str(e)}"
        )



@router.get("/find-contact/{name}")
def find_contact_by_name(name: str, db: Session = Depends(get_db)):
    """Find contact ID by name"""
    contacts = db.query(HRContact).filter(
        HRContact.name.ilike(f"%{name}%")
    ).all()
    
    result = []
    for contact in contacts:
        result.append({
            "id": contact.id,
            "name": contact.name,
            "company": contact.company,
            "email": contact.email
        })
    
    return {"contacts": result}

@router.get("/debug-conversation-display/{contact_id}")
def debug_conversation_display(contact_id: int, db: Session = Depends(get_db)):
    """Debug what conversation API returns vs what's in DB"""
    # Get what the conversation API returns
    conversation_result = HRService.get_conversation_history(db, contact_id)
    
    # Get raw count from DB
    from app.models.email_models import EmailConversation
    total_in_db = db.query(EmailConversation).filter(
        EmailConversation.hr_contact_id == contact_id
    ).count()
    
    sent_in_db = db.query(EmailConversation).filter(
        EmailConversation.hr_contact_id == contact_id,
        EmailConversation.direction == "sent"
    ).count()
    
    return {
        "contact_id": contact_id,
        "total_in_db": total_in_db,
        "sent_in_db": sent_in_db,
        "conversation_api_count": len(conversation_result.get("conversations", [])),
        "conversation_api_result": conversation_result
    }


@router.post("/fetch-emails/{contact_id}")
def fetch_emails_for_contact(contact_id: int, db: Session = Depends(get_db)):
    """Fetch emails for a specific contact using consolidated logic"""
    return HRService.sync_contact_emails(db, contact_id)




@router.post("/conversation/verify-otp/{conversation_id}")
def verify_confidential_otp(
    conversation_id: int, 
    request: dict, 
    db: Session = Depends(get_db)
):
    """Verify OTP for a confidential email and return its content"""
    otp = request.get("otp")
    if not otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is required")
        
    from app.models.email_models import EmailConversation
    conv = db.query(EmailConversation).filter(EmailConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    if not conv.is_confidential or not conv.require_otp:
        return {"content": conv.content}
        
    # Check if expired
    if conv.expires_at and conv.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This confidential message has expired")
        
    if conv.otp_code == otp:
        # Log successful access
        from app.models.confidential_log_model import ConfidentialAccessLog
        log = ConfidentialAccessLog(
            conversation_id=conversation_id,
            action="VIEW",
            accessed_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
        
        return {"content": conv.content, "message": "OTP verified successfully"}
    else:
        # Log failed attempt
        from app.models.confidential_log_model import ConfidentialAccessLog
        log = ConfidentialAccessLog(
            conversation_id=conversation_id,
            action="BLOCKED",
            accessed_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP code")

@router.post("/send-followup/{contact_id}")
def send_followup_email(
    contact_id: int,
    db: Session = Depends(get_db)
):
    # TODO: Implement FollowUpService
    return {"message": "Follow-up service not implemented yet"}


# Simple in-memory storage for templates
TEMPLATES_STORAGE = []

@router.post("/templates")
def create_template(request: dict):
    """Create a new email template"""
    template = {
        "id": len(TEMPLATES_STORAGE) + 1,
        "name": request["name"],
        "subject": request["subject"],
        "body": request["body"]
    }
    TEMPLATES_STORAGE.append(template)
    return template

@router.get("/templates")
def get_templates():
    """Get all email templates"""
    return TEMPLATES_STORAGE

@router.delete("/templates/{template_id}")
def delete_template(template_id: int):
    """Delete an email template"""
    global TEMPLATES_STORAGE
    TEMPLATES_STORAGE = [t for t in TEMPLATES_STORAGE if t["id"] != template_id]
    return {"message": "Template deleted successfully"}

@router.post("/create-manual-reminder")
def create_manual_reminder(request: dict, db: Session = Depends(get_db)):
    """Create a manual reminder from message content"""
    from app.services.ai_service import AIService
    from app.services.reminder_service import ReminderService
    from app.schemas.reminder_schema import ReminderCreate
    
    contact_id = request.get("contact_id")
    message = request.get("message")
    
    if not contact_id or not message:
        raise HTTPException(status_code=400, detail="contact_id and message are required")
    
    contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Extract intent from message
    intent = AIService.extract_intent(message, contact.company)
    visit_date = intent.get("visit_date")
    
    if visit_date:
        # Cancel old visit reminders for this contact
        cancelled_count = ReminderService.handle_cancellation(db, contact_id, {'is_cancelled': True})
        
        # Create new reminder
        new_reminder = ReminderService.create_reminder(db, ReminderCreate(
            contact_id=contact_id,
            description=f"Campus Visit - {contact.company}",
            due_date=visit_date,
            priority="high"
        ))
        
        return {
            "message": f"Manual reminder created successfully",
            "visit_date": visit_date,
            "cancelled_old_reminders": cancelled_count,
            "new_reminder_id": new_reminder.id,
            "company": contact.company
        }
    else:
        return {
            "message": "No visit date detected in message",
            "intent": intent
        }

@router.get("/debug-contact/{contact_id}")
def debug_contact(contact_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to check contact existence"""
    contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
    if not contact:
        return {"error": "Contact not found", "contact_id": contact_id}
    return {
        "contact_found": True,
        "id": contact.id,
        "name": contact.name,
        "email": contact.email,
        "company": contact.company
    }

@router.post("/generate-ai-draft")
def generate_ai_draft(request: dict, db: Session = Depends(get_db)):
    """Generate AI draft with student data (legacy endpoint)"""
    try:
        contact_id = request.get("contact_id")
        hr_reply = request.get("hr_reply")
        students_data = request.get("students_data", [])
        
        contact = db.query(HRContact).filter(HRContact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        draft = AIService.generate_draft_with_students(hr_reply, students_data, contact.company)
        
        return {"subject": f"Re: Student Profiles - {contact.company}", "content": draft}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"AI Draft Error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating draft: {str(e)}")


# ============================================================================
# NEW AI-POWERED ENDPOINTS USING PHI-3-MINI-4K-INSTRUCT
# ============================================================================

@router.post("/extract-intent", response_model=ExtractedIntent)
def extract_intent_from_message(request: IntentExtractionRequest):
    """
    Extract structured intent from HR message using Phi-3-Mini-4K-Instruct
    
    Returns:
    - role: Job position mentioned
    - skills: Required skills list
    - positions_count: Number of positions needed
    - deadline: Application deadline
    - visit_date: Campus visit date
    - commitments: HR commitments
    - action_items: Required actions
    - urgency: Message urgency level
    """
    try:
        intent_data = AIService.extract_intent(request.message, request.company)
        return ExtractedIntent(**intent_data)
    except Exception as e:
        import traceback
        print(f"Intent extraction error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error extracting intent: {str(e)}")


@router.post("/draft-reply", response_model=DraftEmailResponse)
def generate_draft_reply(request: DraftReplyRequest, db: Session = Depends(get_db)):
    """
    Generate AI-powered draft email reply using Phi-3-Mini-4K-Instruct
    
    Always includes [DRAFT EMAIL — REQUIRES CONFIRMATION] header
    
    Returns:
    - subject: Email subject
    - body: Email body with confirmation header
    - requires_confirmation: Always True
    - extracted_intent: Extracted requirements
    - suggested_students: Recommended students (if applicable)
    - follow_up_actions: Recommended follow-ups
    """
    print(f"\n[CONTROLLER DEBUG] draft-reply endpoint called - UPDATED")
    print(f"[CONTROLLER DEBUG] Contact ID: {request.contact_id}")
    print(f"[CONTROLLER DEBUG] Include students: {request.include_students}")
    print(f"[CONTROLLER DEBUG] HR message length: {len(request.hr_message)}")
    print(f"[CONTROLLER DEBUG] HR message preview: '{request.hr_message[:200]}...'")
    
    try:
        # Get contact
        contact = db.query(HRContact).filter(HRContact.id == request.contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # First, do a preliminary draft generation to extract requirements
        from app.utils.student_requirements import extract_student_requirements
        student_reqs = extract_student_requirements(request.hr_message)
        
        print(f"\n[CONTROLLER] Extracted student requirements: {student_reqs}")
        
        # Get students if requested - with intelligent filtering
        students_data = None
        if request.include_students:
            from app.models.student_model import Student
            from sqlalchemy import func, case
            
            query = db.query(Student)
            
            # Filter by domain if specified
            if student_reqs.get('domain'):
                domain = student_reqs['domain']
                print(f"[CONTROLLER] Filtering by domain: {domain}")
                # More flexible domain matching
                if domain.lower() in ['ai', 'artificial intelligence']:
                    # First try exact AI domain match
                    ai_query = query.filter(
                        or_(
                            Student.domain.ilike("%AI%"),
                            Student.domain.ilike("%Artificial Intelligence%"),
                            Student.domain.ilike("%Machine Learning%"),
                            Student.domain.ilike("%Data Science%")
                        )
                    )
                    ai_count = ai_query.count()
                    print(f"[CONTROLLER] Found {ai_count} students with AI domain")
                    
                    if ai_count > 0:
                        query = ai_query
                    else:
                        # Fallback: Look for students with AI skills in any domain
                        print(f"[CONTROLLER] No AI domain students found, searching by AI skills")
                        query = query.filter(
                            or_(
                                func.lower(Student.skills_text).like("%ai%"),
                                func.lower(Student.skills_text).like("%artificial intelligence%"),
                                func.lower(Student.skills_text).like("%machine learning%"),
                                func.lower(Student.skills_text).like("%ml%"),
                                func.lower(Student.skills_text).like("%python%"),  # AI-related skill
                                func.lower(Student.skills_text).like("%data%")
                            )
                        )
                        skills_count = query.count()
                        print(f"[CONTROLLER] Found {skills_count} students with AI-related skills")
                        
                        if skills_count == 0:
                            # Last fallback: Get top students from CSE/IT departments
                            print(f"[CONTROLLER] No AI skills found, using CSE/IT students as fallback")
                            query = db.query(Student).filter(
                                or_(
                                    Student.department.ilike("%CSE%"),
                                    Student.department.ilike("%IT%"),
                                    Student.department.ilike("%Computer%")
                                )
                            )
                elif domain.lower() in ['embedded', 'embedded systems']:
                    query = query.filter(
                        or_(
                            Student.domain.ilike("%Embedded%"),
                            Student.domain.ilike("%IoT%"),
                            Student.domain.ilike("%Hardware%")
                        )
                    )
                else:
                    query = query.filter(Student.domain.ilike(f"%{domain}%"))
            
            # Filter by skills if specified
            if student_reqs.get('skills'):
                skills = student_reqs['skills']
                print(f"[CONTROLLER] Filtering by skills: {skills}")
                
                # Create skill-based scoring with better AI skill matching
                skill_conditions = []
                for skill in skills:
                    skill_lower = skill.lower()
                    if skill_lower in ['ai', 'artificial intelligence', 'machine learning']:
                        # Match AI-related skills more broadly
                        skill_conditions.append(
                            case(
                                (or_(
                                    func.lower(Student.skills_text).like("%ai%"),
                                    func.lower(Student.skills_text).like("%artificial intelligence%"),
                                    func.lower(Student.skills_text).like("%machine learning%"),
                                    func.lower(Student.skills_text).like("%ml%"),
                                    func.lower(Student.skills_text).like("%deep learning%"),
                                    func.lower(Student.skills_text).like("%neural network%")
                                ), Student.ps_level * 2),  # Boost AI students
                                else_=0
                            )
                        )
                    else:
                        skill_conditions.append(
                            case(
                                (func.lower(Student.skills_text).like(f"%{skill_lower}%"), Student.ps_level),
                                else_=0
                            )
                        )
                
                if skill_conditions:
                    # Sum all skill matches and order by that score
                    skill_score = sum(skill_conditions)
                    query = query.order_by(skill_score.desc(), Student.ps_level.desc(), Student.cgpa.desc())
                else:
                    query = query.order_by(Student.ps_level.desc(), Student.cgpa.desc())
            else:
                # No specific skills - order by PS level and CGPA
                query = query.order_by(Student.ps_level.desc(), Student.cgpa.desc())
            
            # Limit by count if specified, otherwise default to 20
            limit = student_reqs.get('count') or 20
            print(f"[CONTROLLER] Limiting to {limit} students")
            
            students = query.limit(limit).all()
            
            print(f"[CONTROLLER] Found {len(students)} matching students")
            for s in students[:5]:  # Show first 5 for debugging
                print(f"[CONTROLLER] Student: {s.name} - {s.department} - Domain: {s.domain} - Skills: {s.skills_text}")
            
            students_data = [
                {
                    "id": s.id,
                    "name": s.name,
                    "roll_no": s.roll_no,
                    "department": s.department,
                    "cgpa": float(s.cgpa) if s.cgpa else 0.0,
                    "domain": s.domain,
                    "skills_text": s.skills_text,
                    "ps_level": s.ps_level
                }
                for s in students
            ]
        
        # Generate draft
        draft_result = AIService.generate_draft_reply(
            request.hr_message,
            contact.company,
            contact.name,  # Pass contact name for personalization
            students_data
        )
        
        return DraftEmailResponse(**draft_result)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Draft reply error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating draft reply: {str(e)}")


@router.post("/analyze-message", response_model=MessageClassification)
def analyze_hr_message(request: MessageAnalysisRequest):
    """
    Analyze and classify HR message using Phi-3-Mini-4K-Instruct
    
    Returns:
    - category: Message type (positive, need_info, not_interested, neutral)
    - sentiment: Overall sentiment
    - urgency: Urgency level
    - confidence: Classification confidence score
    - requesting_students: Whether HR is requesting student profiles
    """
    try:
        classification_data = AIService.classify_message(request.message)
        return MessageClassification(**classification_data)
    except Exception as e:
        import traceback
        print(f"Message analysis error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error analyzing message: {str(e)}")


# ============================================================================
# HR REPLY NOTIFICATION ENDPOINTS
# ============================================================================

# In-memory storage for HR reply notifications
HR_REPLY_NOTIFICATIONS = []

@router.post("/notifications/clear-all")
def clear_all_notifications():
    """Clear all existing notifications"""
    global HR_REPLY_NOTIFICATIONS
    HR_REPLY_NOTIFICATIONS = []
    return {"message": "All notifications cleared"}

@router.get("/notifications")
def get_hr_reply_notifications():
    """Get all pending HR reply notifications"""
    return {"notifications": HR_REPLY_NOTIFICATIONS}

@router.post("/notifications/dismiss/{notification_id}")
def dismiss_hr_reply_notification(notification_id: str, db: Session = Depends(get_db)):
    """Dismiss a specific HR reply notification and mark email as read"""
    global HR_REPLY_NOTIFICATIONS
    
    # Find the notification to get the email_id
    notification = next((n for n in HR_REPLY_NOTIFICATIONS if n["id"] == notification_id), None)
    if notification and "email_id" in notification:
        from app.models.email_models import EmailConversation
        email_record = db.query(EmailConversation).filter(EmailConversation.id == notification["email_id"]).first()
        if email_record:
            email_record.is_read = 1
            db.commit()
            print(f"[NOTIFICATIONS] Marked email {email_record.id} as read via dismissal")

    HR_REPLY_NOTIFICATIONS = [n for n in HR_REPLY_NOTIFICATIONS if n["id"] != notification_id]
    return {"message": "Notification dismissed and marked as read"}

@router.post("/fetch-emails")
def fetch_received_emails(db: Session = Depends(get_db)):
    """Fetch new emails from Gmail for all contacts"""
    print(f"[NOTIFICATIONS] Manually triggering email fetch at {datetime.utcnow()}")
    try:
        result = HRService.fetch_and_store_received_emails(db)
        return result
    except Exception as e:
        print(f"Error fetching emails: {str(e)}")
        # Don't crash the frontend polling
        return {"message": "Effective sync failed", "count": 0, "error": str(e)}


@router.post("/notifications/check")
def check_for_new_hr_replies(db: Session = Depends(get_db)):
    """Check for new HR replies and create notifications"""
    print(f"[NOTIFICATIONS] Checking for new notifications at {datetime.utcnow()}")
    try:
        # Get all contacts
        contacts = db.query(HRContact).all()
        new_notifications = []
        
        from app.models.email_models import EmailConversation
        
        for contact in contacts:
            try:
                # Check for received emails in the last 60 minutes
                # STRICT FILTER: Only UNREAD (is_read=0 or None)
                now = datetime.utcnow()
                recent_cutoff = now - timedelta(minutes=60)
                
                recent_replies = db.query(EmailConversation).filter(
                    EmailConversation.hr_contact_id == contact.id,
                    EmailConversation.direction == "received",
                    EmailConversation.created_at >= recent_cutoff,
                    or_(
                        EmailConversation.is_read == 0,
                        EmailConversation.is_read.is_(None)
                    )
                ).order_by(EmailConversation.sent_at.desc()).all()
                
                for reply in recent_replies:
                    try:
                        print(f"[NOTIFICATIONS] Processing reply: {reply.subject} (ID: {reply.id})")
                        
                        # Check if we already have a notification for this specific email ID
                        existing_notification = next(
                            (n for n in HR_REPLY_NOTIFICATIONS if n.get("email_id") == reply.id),
                            None
                        )
                        
                        if existing_notification:
                            print(f"[NOTIFICATIONS] Skipping {reply.id} - Notification already exists")
                            continue
                        
                        # Double-check: prevent duplicate alerts for same subject/contact in logical window
                        current_time = datetime.utcnow()
                        logical_duplicate = next(
                            (n for n in HR_REPLY_NOTIFICATIONS if 
                                n["contact"]["id"] == contact.id and 
                                n["subject"] == reply.subject and
                                abs((current_time - datetime.fromisoformat(n["created_at"].replace('Z', ''))).total_seconds()) < 1), # Reduced to 1s to allow seq notifications
                            None
                        )
                        
                        if logical_duplicate:
                            print(f"[NOTIFICATIONS] Skipping {reply.id} - Logical duplicate of {logical_duplicate['id']}")
                            continue
                        
                        print(f"[NOTIFICATIONS] Creating new notification for {reply.subject}")
                        notification = {
                                "id": f"hr_reply_{reply.id}_{int(datetime.utcnow().timestamp())}",
                                "email_id": reply.id,
                                "contact": {
                                    "id": contact.id,
                                    "name": contact.name,
                                    "company": contact.company,
                                    "email": contact.email
                                },
                                "subject": reply.subject,
                                "timestamp": reply.sent_at.isoformat() + 'Z' if reply.sent_at else datetime.utcnow().isoformat() + 'Z',
                                "created_at": datetime.utcnow().isoformat()
                            }
                        
                        HR_REPLY_NOTIFICATIONS.append(notification)
                        new_notifications.append(notification)
                        print(f"[NOTIFICATION] Created for {contact.name} from {contact.company} - Email ID: {reply.id}")
                    except Exception as inner_e:
                        print(f"[ERROR] processing reply {reply.id}: {str(inner_e)}")
                        continue
            except Exception as e:
                print(f"[ERROR] processing contact {contact.id}: {str(e)}")
                continue

        
        return {
            "message": f"Found {len(new_notifications)} new HR replies",
            "new_notifications": new_notifications,
            "total_notifications": len(HR_REPLY_NOTIFICATIONS)
        }
        
    except Exception as e:
        print(f"Error checking for HR replies: {str(e)}")
        return {"error": str(e), "new_notifications": []}

@router.post("/notifications/force-check")
def force_check_notifications(db: Session = Depends(get_db)):
    """Force check for all received emails and create notifications"""
    try:
        from app.models.email_models import EmailConversation
        from datetime import datetime, timedelta
        
        # Check for received emails in the last hour
        recent_cutoff = datetime.utcnow() - timedelta(hours=1)
        
        all_recent_replies = db.query(EmailConversation).filter(
            EmailConversation.direction == "received",
            EmailConversation.sent_at >= recent_cutoff,
            or_(
                EmailConversation.is_read == 0,
                EmailConversation.is_read.is_(None)
            )
        ).order_by(EmailConversation.sent_at.desc()).all()
        
        new_notifications = []
        
        for reply in all_recent_replies:
            # Get contact info
            contact = db.query(HRContact).filter(HRContact.id == reply.hr_contact_id).first()
            if not contact:
                continue
                
            # Check if notification already exists
            existing_notification = next(
                (n for n in HR_REPLY_NOTIFICATIONS if n.get("email_id") == reply.id),
                None
            )
            
            if not existing_notification:
                notification = {
                    "id": f"hr_reply_{reply.id}_{int(datetime.utcnow().timestamp())}",
                    "email_id": reply.id,
                    "contact": {
                        "id": contact.id,
                        "name": contact.name,
                        "company": contact.company,
                        "email": contact.email
                    },
                    "subject": reply.subject,
                    "timestamp": reply.sent_at.isoformat() if reply.sent_at else datetime.utcnow().isoformat(),
                    "created_at": datetime.utcnow().isoformat()
                }
                HR_REPLY_NOTIFICATIONS.append(notification)
                new_notifications.append(notification)
                print(f"[FORCE CHECK] Created notification for {contact.name} from {contact.company} - Email ID: {reply.id}")
        
        return {
            "message": f"Force check created {len(new_notifications)} notifications",
            "new_notifications": new_notifications,
            "total_notifications": len(HR_REPLY_NOTIFICATIONS)
        }
        
    except Exception as e:
        print(f"Error in force check: {str(e)}")
        return {"error": str(e), "new_notifications": []}
    """Create notifications for all existing received emails"""
    try:
        from app.models.email_models import EmailConversation
        from datetime import datetime
        
        # Get all received emails
        all_received = db.query(EmailConversation).filter(
            EmailConversation.direction == "received"
        ).order_by(EmailConversation.sent_at.desc()).all()
        
        new_notifications = []
        
        for reply in all_received:
            # Get contact info
            contact = db.query(HRContact).filter(HRContact.id == reply.hr_contact_id).first()
            if not contact:
                continue
                
            # Check if notification already exists
            existing_notification = next(
                (n for n in HR_REPLY_NOTIFICATIONS if n.get("email_id") == reply.id),
                None
            )
            
            if not existing_notification:
                notification = {
                    "id": f"hr_reply_{reply.id}_{int(datetime.utcnow().timestamp())}",
                    "email_id": reply.id,
                    "contact": {
                        "id": contact.id,
                        "name": contact.name,
                        "company": contact.company,
                        "email": contact.email
                    },
                    "subject": reply.subject,
                    "timestamp": reply.sent_at.isoformat() if reply.sent_at else datetime.utcnow().isoformat(),
                    "created_at": datetime.utcnow().isoformat()
                }
                HR_REPLY_NOTIFICATIONS.append(notification)
                new_notifications.append(notification)
                print(f"[NOTIFICATION] Created for {contact.name} from {contact.company} - Email ID: {reply.id}")
        
        return {
            "message": f"Created {len(new_notifications)} notifications for all HR replies",
            "new_notifications": new_notifications,
            "total_notifications": len(HR_REPLY_NOTIFICATIONS)
        }
        
    except Exception as e:
        print(f"Error creating notifications: {str(e)}")
        return {"error": str(e), "new_notifications": []}