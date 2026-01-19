from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ReminderBase(BaseModel):
    contact_id: int
    description: str
    priority: Optional[str] = "medium"
    due_date: Optional[str] = None  # Can be a date string or fuzzy string
    
class ReminderCreate(ReminderBase):
    pass

class ReminderResponse(ReminderBase):
    id: int
    status: str
    created_at: datetime
    formatted_date: Optional[str] = None
    is_overdue: bool = False
    deadline_text: Optional[str] = None # For frontend display
    due_date: Optional[datetime] = None # Override Base str type
    
    company_name: str = "Unknown"
    contact_name: str = "Unknown"
    is_today: bool = False
    is_tomorrow: bool = False

    class Config:
        from_attributes = True
