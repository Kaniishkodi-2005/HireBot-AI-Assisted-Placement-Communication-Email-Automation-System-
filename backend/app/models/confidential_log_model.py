"""
Confidential Access Logging Model
Tracks access to confidential emails for audit purposes
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime


class ConfidentialAccessLog(Base):
    __tablename__ = "confidential_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for anonymous access
    conversation_id = Column(Integer, ForeignKey("email_conversations.id"), nullable=False)
    user_email = Column(String(255), nullable=True)  # Store email for non-authenticated users
    accessed_at = Column(DateTime, default=datetime.utcnow)
    action = Column(String(50), nullable=False)  # e.g., "VIEW", "BLOCKED"
    ip_address = Column(String(45), nullable=True)  # Support IPv6

    user = relationship("User", back_populates="confidential_logs")