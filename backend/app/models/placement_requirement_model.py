from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.base import Base


class PlacementRequirement(Base):
    __tablename__ = "placement_requirements"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    skills = Column(Text, nullable=True)
    required_count = Column(Integer, nullable=False, default=0)
    raw_email_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)