from sqlalchemy.orm import Session
from app.models.reminder_model import Reminder
from app.schemas.reminder_schema import ReminderCreate
from datetime import datetime, timedelta
from typing import Dict
import re

class ReminderService:
    @staticmethod
    def _parse_fuzzy_date(date_str: str) -> datetime:
        """Parse fuzzy date string into datetime object"""
        if not date_str:
            return None
            
        try:
            # Handle "Upcoming" string (legacy support)
            if date_str.lower() in ["upcoming", "shortly", "soon"]:
                return datetime.now() + timedelta(days=7)  # Default to next week to avoid "Today" panic

            # Try parsing exact formats first
            formats = [
                "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y",
                "%Y-%m-%d", "%d %b %Y", "%d %B %Y"
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except:
                    continue
                    
            # Handle "Week of..." logic
            # Format: "First Week of February 2026" or "Week of February 2026"
            lower_date = date_str.lower()
            current_year = datetime.now().year
            
            # Extract month
            months = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
            }
            month_num = None
            for m_name, m_num in months.items():
                if m_name in lower_date:
                    month_num = m_num
                    break
            
            if not month_num:
                # Default logic if month not found
                return datetime.now() + timedelta(days=7)

            # Extract year
            year_match = re.search(r'\d{4}', date_str)
            year = int(year_match.group(0)) if year_match else current_year
            
            # Default day
            day = 1
            if 'first' in lower_date: day = 1
            elif 'second' in lower_date: day = 8
            elif 'third' in lower_date: day = 15
            elif 'fourth' in lower_date: day = 22
            elif 'last' in lower_date: day = 25 # Approx
            
            return datetime(year, month_num, day)
            
        except Exception as e:
            print(f"Date parsing error for {date_str}: {e}")
            return datetime.now() + timedelta(days=7) # Default to next week for unknown dates

    @staticmethod
    def create_reminder(db: Session, data: ReminderCreate) -> Reminder:
        parsed_date = ReminderService._parse_fuzzy_date(data.due_date)
        
        # Check duplicate - normalize description for comparison
        search_desc = data.description.replace(" (Auto-detected)", "").strip().lower()
        is_visit = "visit" in search_desc or "campus" in search_desc
        
        # Get target contact identity
        from app.models.hr_contact_model import HRContact
        target_contact = db.query(HRContact).filter(HRContact.id == data.contact_id).first()
        
        # AGGRESSIVE: Look for existing reminders for the same IDENTITY (Company + Name)
        # This fixes duplicates when the same HR is in the system with multiple emails
        existing = []
        if target_contact:
            existing = db.query(Reminder).join(HRContact).filter(
                HRContact.company == target_contact.company,
                HRContact.name == target_contact.name,
                Reminder.status == "pending"
            ).all()
        else:
            # Fallback to ID only if contact not found
            existing = db.query(Reminder).filter(
                Reminder.contact_id == data.contact_id,
                Reminder.status == "pending"
            ).all()
        
        for rem in existing:
            rem_desc = (rem.description or "").lower()
            
            # Exact description match or both are visit-related
            is_duplicate = (rem_desc == search_desc) or (is_visit and ("visit" in rem_desc or "campus" in rem_desc))
            
            if is_duplicate:
                print(f"[RE-SYNC] Updating existing reminder {rem.id} for identity {target_contact.company if target_contact else data.contact_id}")
                # Update with latest information
                rem.due_date = parsed_date
                rem.due_date_str = data.due_date
                # If new description is more descriptive, update it
                if len(data.description) > len(rem.description or ""):
                    rem.description = data.description
                
                db.commit()
                db.refresh(rem)
                return rem
        
        # Create new if no duplicate found
        print(f"[NEW] Creating reminder for contact {data.contact_id}: {data.description}")
        reminder = Reminder(
            contact_id=data.contact_id,
            description=data.description,
            due_date_str=data.due_date,
            due_date=parsed_date,
            priority=data.priority,
            status="pending"
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)
        return reminder

    @staticmethod
    def get_pending_reminders(db: Session):
        from datetime import datetime, timedelta
        
        # Get current date
        now = datetime.utcnow()
        
        # Get all pending reminders
        reminders = db.query(Reminder).filter(
            Reminder.status == "pending"
        ).order_by(Reminder.due_date.asc()).all()
        
        # Auto-cleanup duplicates
        ReminderService._cleanup_duplicates(db, reminders)
        
        # Re-fetch after cleanup
        reminders = db.query(Reminder).filter(
            Reminder.status == "pending"
        ).order_by(Reminder.due_date.asc()).all()
        
        # Auto-mark overdue reminders as fulfilled immediately after their due date passes
        auto_fulfilled_count = 0
        for reminder in reminders[:]:
            # Check if reminder date has passed (comparing dates, not datetime)
            if reminder.due_date:
                reminder_date = reminder.due_date.date()
                current_date = now.date()
                if reminder_date < current_date:
                    reminder.status = "fulfilled"
                    reminder.updated_at = now
                    auto_fulfilled_count += 1
                    reminders.remove(reminder)
        
        if auto_fulfilled_count > 0:
            db.commit()
            print(f"[AUTO-CLEANUP] Marked {auto_fulfilled_count} overdue reminders as fulfilled")
        
        return reminders
    
    @staticmethod
    def _cleanup_duplicates(db: Session, reminders):
        """Remove duplicate reminders based on contact identity, description, and date"""
        seen_keys = set()
        seen_visits = {} # (company, name) -> [dates]
        duplicates_to_remove = []
        
        for reminder in reminders:
            contact = reminder.contact
            if not contact: continue
            
            # Identity key: (Company, Name)
            identity = (contact.company.lower().strip(), contact.name.lower().strip())
            
            desc_norm = (reminder.description or "").lower().strip()
            is_visit = "visit" in desc_norm or "campus" in desc_norm
            date_val = reminder.due_date.date() if reminder.due_date else None
            
            # Special logic for visits: match by identity + date closeness
            if is_visit and date_val:
                if identity not in seen_visits:
                    seen_visits[identity] = []
                
                is_dup = False
                for existing_date in seen_visits[identity]:
                    if abs((existing_date - date_val).days) <= 1:
                        is_dup = True
                        break
                
                if is_dup:
                    duplicates_to_remove.append(reminder.id)
                    continue
                else:
                    seen_visits[identity].append(date_val)
            
            # Standard logic balance (Identity-based)
            desc_dedup = desc_norm.replace(" (auto-detected)", "").strip()
            key = (identity, desc_dedup, date_val)
            
            if key in seen_keys:
                duplicates_to_remove.append(reminder.id)
            else:
                seen_keys.add(key)
        
        # Remove duplicates
        if duplicates_to_remove:
            print(f"[CLEANUP] Removing {len(duplicates_to_remove)} duplicate reminders across identities")
            db.query(Reminder).filter(Reminder.id.in_(duplicates_to_remove)).delete(synchronize_session=False)
            db.commit()
            return True
        return False
    
    @staticmethod
    def mark_fulfilled(db: Session, reminder_id: int):
        reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
        if reminder:
            reminder.status = "fulfilled"
            db.commit()
        return reminder

    @staticmethod
    def restore_reminder(db: Session, reminder_id: int):
        """Restore a fulfilled reminder back to pending status"""
        reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
        if reminder:
            reminder.status = "pending"
            # Don't update updated_at to preserve original position in list
            db.commit()
            print(f"[RESTORE] Reminder {reminder_id} restored to pending status")
        return reminder

    @staticmethod
    def generate_reminder_draft(db: Session, reminder_id: int):
        reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
        if not reminder:
            print(f"[ERROR] Reminder {reminder_id} not found")
            return None
            
        if not reminder.contact:
            print(f"[ERROR] Contact not found for reminder {reminder_id}")
            return None
            
        print(f"[DEBUG] Generating draft for reminder {reminder_id}, contact: {reminder.contact.name}")
        
        # Check if reminder is for today or tomorrow only
        from datetime import datetime, date
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        if reminder.due_date:
            visit_date = reminder.due_date.date()
            if visit_date not in [today, tomorrow]:
                visit_date_str = visit_date.strftime("%d %B %Y")
                return {
                    "error": "date_restriction",
                    "message": f"Reminder drafts are only available for visits scheduled today or tomorrow.\n\nScheduled Visit Date: {visit_date_str}\nToday's Date: {today.strftime('%d %B %Y')}\n\nPlease return on {(visit_date - timedelta(days=1)).strftime('%d %B %Y')} or {visit_date_str} to generate the reminder email."
                }
        
        # Extract context from reminder description
        description = reminder.description.lower()
        company = reminder.contact.company
        contact_name = reminder.contact.name
        due_date = reminder.due_date_str or "soon"
        
        print(f"[DEBUG] Draft context - Company: {company}, Contact: {contact_name}, Due: {due_date}")
        
        # Determine reminder type and generate specific content based on context
        if "visit" in description:
            # Check if this is overdue or upcoming
            is_overdue = reminder.is_overdue if hasattr(reminder, 'is_overdue') else False
            is_today = reminder.is_today if hasattr(reminder, 'is_today') else False
            
            subject = f"Campus Visit Coordination - {company}"
            
            if is_today:
                body = (
                    f"Dear {contact_name},\n\n"
                    f"We hope this email finds you well.\n\n"
                    f"This is a gentle reminder regarding the campus visit from {company} scheduled for today. "
                    f"We are looking forward to welcoming your team and have made all necessary arrangements for a productive session.\n\n"
                    f"Our placement team is ready to facilitate meaningful interactions between your representatives and our talented students. "
                    f"We believe this collaboration will be mutually beneficial for both {company} and our graduating students.\n\n"
                    f"Thank you for your continued partnership with our institution.\n\n"
                    f"Best regards,\n"
                    f"Placement Team"
                )
            elif is_overdue:
                body = (
                    f"Dear {contact_name},\n\n"
                    f"We hope this email finds you well.\n\n"
                    f"We wanted to follow up regarding the campus visit from {company} that was scheduled for {due_date}. "
                    f"We understand that business priorities can sometimes require schedule adjustments.\n\n"
                    f"We remain enthusiastic about the opportunity to collaborate with {company} and showcase our talented students. "
                    f"Our placement team is flexible and ready to accommodate a revised timeline that works best for your organization.\n\n"
                    f"We look forward to hearing from you at your convenience.\n\n"
                    f"Best regards,\n"
                    f"Placement Team"
                )
            else:
                body = (
                    f"I hope you are doing well.\n\n"
                    f"This is a gentle reminder regarding {company}'s upcoming campus visit scheduled for {due_date}. "
                    f"We are looking forward to welcoming your team and facilitating meaningful interactions with our students.\n\n"
                    f"Our placement team is making the necessary preparations to ensure a smooth and productive visit. "
                    f"We are confident that the session will be valuable and beneficial for both sides.\n\n"
                    f"Please let us know if there are any specific requirements or preferences from your end. We would be happy to assist."
                )
        elif "job" in description or "requirement" in description or "jd" in description:
            subject = f"Job Requirements Follow-up - {company}"
            body = (
                f"Dear {contact_name},\n\n"
                f"We hope this email finds you well.\n\n"
                f"We are following up on the job requirements discussion we had earlier. "
                f"As mentioned, we were expecting to receive the detailed job description by {due_date}.\n\n"
                f"To proceed with candidate shortlisting, we would need:\n"
                f"• Complete job description with role responsibilities\n"
                f"• Required technical skills and experience level\n"
                f"• Preferred educational background and CGPA criteria\n\n"
                f"Once we receive these details, we can immediately start the screening process and share suitable profiles.\n\n"
                f"Best regards,\n"
                f"Placement Team"
            )
        elif "profile" in description or "resume" in description or "cv" in description:
            subject = f"Student Profiles Submission - {company}"
            body = (
                f"Dear {contact_name},\n\n"
                f"We hope this email finds you well.\n\n"
                f"As discussed, we were to share student profiles with you by {due_date}. "
                f"We want to ensure we provide you with the most suitable candidates for your requirements.\n\n"
                f"Could you please confirm:\n"
                f"• The number of profiles you would like to review\n"
                f"• Any specific filtering criteria or preferences\n"
                f"• Your preferred format for receiving the profiles\n\n"
                f"We have a pool of talented students ready for placement and look forward to your feedback.\n\n"
                f"Best regards,\n"
                f"Placement Team"
            )
        elif "interview" in description or "selection" in description:
            subject = f"Interview Process Coordination - {company}"
            body = (
                f"Dear {contact_name},\n\n"
                f"We hope this email finds you well.\n\n"
                f"We are reaching out regarding the interview process that was scheduled around {due_date}. "
                f"We want to ensure smooth coordination for the selection process.\n\n"
                f"Please let us know:\n"
                f"• Your preferred interview dates and time slots\n"
                f"• Interview format (online/offline) and platform details\n"
                f"• Number of rounds and expected duration\n\n"
                f"We will coordinate with the shortlisted students and ensure their availability as per your schedule.\n\n"
                f"Best regards,\n"
                f"Placement Team"
            )
        elif "document" in description or "agreement" in description or "mou" in description:
            subject = f"Documentation Follow-up - {company}"
            body = (
                f"Dear {contact_name},\n\n"
                f"We hope this email finds you well.\n\n"
                f"We are following up on the documentation that was expected by {due_date}. "
                f"To proceed with the placement process, we need the necessary paperwork completed.\n\n"
                f"Could you please provide an update on:\n"
                f"• Status of the required documents\n"
                f"• Any additional information needed from our end\n"
                f"• Expected timeline for completion\n\n"
                f"We appreciate your cooperation and look forward to moving forward with the placement process.\n\n"
                f"Best regards,\n"
                f"Placement Team"
            )
        else:
            # Generic reminder for other cases
            subject = f"Follow-up: {reminder.description} - {company}"
            body = (
                f"Dear {contact_name},\n\n"
                f"We hope this email finds you well.\n\n"
                f"This is a follow-up regarding: {reminder.description}.\n"
                f"The expected timeline was: {due_date}.\n\n"
                f"Could you please provide an update on:\n"
                f"• Current status of this commitment\n"
                f"• Any changes to the original timeline\n"
                f"• Support needed from our placement team\n\n"
                f"We value our partnership with {company} and look forward to your response.\n\n"
                f"Best regards,\n"
                f"Placement Team"
            )
            
        return {"subject": subject, "content": body}
            
    @staticmethod
    def handle_cancellation(db: Session, contact_id: int, cancellation_info: Dict):
        """
        Mark relevant reminders as cancelled when HR sends cancellation email
        """
        # Find pending reminders for this contact
        pending_reminders = db.query(Reminder).filter(
            Reminder.contact_id == contact_id,
            Reminder.status == "pending"
        ).all()
        
        cancelled_count = 0
        for reminder in pending_reminders:
            # Check if this reminder is related to what was cancelled
            reminder_desc = reminder.description.lower()
            
            # If it's a visit cancellation, cancel visit reminders
            if 'visit' in reminder_desc:
                reminder.status = "cancelled"
                reminder.updated_at = datetime.utcnow()
                cancelled_count += 1
                print(f"[CANCELLED] Reminder {reminder.id}: {reminder.description}")
        
        if cancelled_count > 0:
            db.commit()
            print(f"[INFO] Cancelled {cancelled_count} reminders for contact {contact_id}")
        
        return cancelled_count
