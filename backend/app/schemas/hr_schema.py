from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


class HRContactBase(BaseModel):
    name: str
    company: str
    email: str
    email_status: Optional[str] = None
    draft_status: Optional[str] = None


class HRContactCreate(HRContactBase):
    pass


class HRContactResponse(HRContactBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmailRequirementParseRequest(BaseModel):
    company: str
    email_text: str


class ParsedRequirement(BaseModel):
    company: str
    role: str
    required_count: int
    skills: List[str] = []
    draft_reply: str


class HrDraftEmail(BaseModel):
    subject: str
    to: str
    sender: str
    body: str


class EmailDraftRequest(BaseModel):
    template_type: str

class EmailSendRequest(BaseModel):
    subject: str
    content: str
    to: Optional[str] = None
    is_confidential: Optional[bool] = False
    expiry_days: Optional[int] = 7
    disable_forwarding: Optional[bool] = False
    disable_copying: Optional[bool] = False
    disable_downloading: Optional[bool] = False
    disable_printing: Optional[bool] = False
    require_otp: Optional[bool] = False