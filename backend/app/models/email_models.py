from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime


class EmailConversation(Base):
    __tablename__ = "email_conversations"

    id = Column(Integer, primary_key=True, index=True)
    hr_contact_id = Column(Integer, ForeignKey("hr_contacts.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    direction = Column(String(20), nullable=False)  # "sent" or "received"
    message_id = Column(String(500), nullable=True, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Integer, default=0)  # 0=Unread, 1=Read
    is_confidential = Column(Integer, default=0)  # 0=Not Confidential, 1=Confidential
    expires_at = Column(DateTime, nullable=True)
    disable_forwarding = Column(Integer, default=0)
    disable_copying = Column(Integer, default=0)
    disable_downloading = Column(Integer, default=0)
    disable_printing = Column(Integer, default=0)
    require_otp = Column(Integer, default=0)
    otp_code = Column(String(10), nullable=True)


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
