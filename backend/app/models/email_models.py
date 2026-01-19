from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime


class EmailConversation(Base):
    __tablename__ = "email_conversations"

    id = Column(Integer, primary_key=True, index=True)
    hr_contact_id = Column(Integer, ForeignKey("hr_contacts.id"), nullable=False)
    subject = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    direction = Column(String(20), nullable=False)  # "sent" or "received"
    message_id = Column(String(500), nullable=True, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
