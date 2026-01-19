from sqlalchemy.orm import Session
from app.models.reminder_model import Reminder
from app.schemas.reminder_schema import ReminderCreate
from datetime import datetime, timedelta
import re

class ReminderService:
    @staticmethod
    def _parse_fuzzy_date(date_str: str) -> datetime:
        """Parse fuzzy date string into datetime object"""
        if not date_str:
            return None
            
        try:
            # Handle "Upcoming" string
            if date_str.lower() == "upcoming":
                return datetime.now() + timedelta(days=7)

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
            return datetime.now() + timedelta(days=1)

    @staticmethod
    def create_reminder(db: Session, data: ReminderCreate) -> Reminder:
        parsed_date = ReminderService._parse_fuzzy_date(data.due_date)
        
        # Check duplicate - normalize description for comparison
        search_desc = data.description.replace(" (Auto-detected)", "").strip().lower()
        is_visit = "visit" in search_desc
        
        existing = db.query(Reminder).filter(
            Reminder.contact_id == data.contact_id,
            Reminder.status == "pending"
        ).all()
        
        for rem in existing:
            rem_desc = rem.description.replace(" (Auto-detected)", "").strip().lower()
            
            # 1. Exact description match (ignoring auto-detected suffix)
            if rem_desc == search_desc:
                # If it's an exact match, it's definitely a duplicate regardless of date
                return rem
                
            # 2. Aggressive Consolidation: If this is a Visit and they already have a Visit
            # we block it to prevent clutter. 1 Visit per contact is usually enough.
            if is_visit and "visit" in rem_desc:
                print(f"[CONSOLIDATE] Blocking new visit reminder for contact {data.contact_id} because one already exists.")
                return rem
            
        reminder = Reminder(
            contact_id=data.contact_id,
            description=data.description,
            priority=data.priority,
            due_date_str=data.due_date,
            due_date=parsed_date
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)
        return reminder

    @staticmethod
    def get_pending_reminders(db: Session):
        reminders = db.query(Reminder).filter(
            Reminder.status == "pending"
        ).order_by(Reminder.due_date.asc()).all()
        return reminders
    
    @staticmethod
    def mark_fulfilled(db: Session, reminder_id: int):
        reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
        if reminder:
            reminder.status = "fulfilled"
            db.commit()
        return reminder

    @staticmethod
    def generate_reminder_draft(db: Session, reminder_id: int):
        reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
        if not reminder or not reminder.contact:
            return None
            
        subject = f"Regarding: {reminder.description}"
        if "visit" in reminder.description.lower():
             subject = f"Campus Visit Confirmation - {reminder.contact.company}"
             
        body = (
            f"Dear {reminder.contact.name},\n\n"
            f"We are writing to coordinate regarding: {reminder.description}.\n"
            f"We have noted the schedule as: {reminder.due_date_str}.\n\n"
            "Please let us know if you need any further arrangements.\n\n"
            "Best regards,\nPlacement Officer"
        )
        return {"subject": subject, "content": body}
