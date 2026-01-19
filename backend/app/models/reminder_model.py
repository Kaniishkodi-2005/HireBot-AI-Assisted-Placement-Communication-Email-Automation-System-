from datetime import datetime, timedelta
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("hr_contacts.id"), nullable=False)
    description = Column(String(500), nullable=False)
    status = Column(String(50), default="pending")  # pending, fulfilled
    priority = Column(String(20), default="medium")
    
    # Store the original text representation of the date (e.g., "First Week of Feb")
    due_date_str = Column(String(100), nullable=True)
    
    # Store the parsed approximate date for sorting
    due_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    contact = relationship("HRContact", back_populates="reminders")

    @property
    def is_overdue(self):
        if self.due_date and self.status == 'pending':
            return datetime.utcnow() > self.due_date
        return False

    @property
    def deadline_text(self):
        # Prefer the actual date if the stored string is just "Upcoming"
        if self.due_date_str and self.due_date_str.lower() != "upcoming":
             return self.due_date_str
        if self.due_date:
             return self.due_date.strftime("%d.%m.%Y")
        return "No Deadline"

    @property
    def company_name(self):
        return self.contact.company if self.contact else "Unknown"

    @property
    def contact_name(self):
        return self.contact.name if self.contact else "Unknown"

    @property
    def is_today(self):
        if not self.due_date: return False
        return self.due_date.date() == datetime.utcnow().date()

    @property
    def is_tomorrow(self):
        if not self.due_date: return False
        return self.due_date.date() == (datetime.utcnow().date() + timedelta(days=1))
