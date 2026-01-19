from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user")  # "admin" or "user"
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False)  # Admin approval required
    created_at = Column(DateTime, default=datetime.utcnow)


