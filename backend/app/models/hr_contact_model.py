from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, JSON
from sqlalchemy.orm import relationship

from app.db.base import Base


class HRContact(Base):
    __tablename__ = "hr_contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    email_status = Column(String(50), nullable=True)
    draft_status = Column(String(50), nullable=True)
    conversation_history = Column(JSON, nullable=True, default=list)
    organization = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    reminders = relationship("Reminder", back_populates="contact")