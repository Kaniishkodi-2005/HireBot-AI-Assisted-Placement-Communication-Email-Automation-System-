from datetime import datetime
from pydantic import BaseModel, EmailStr

class AccessLogResponse(BaseModel):
    id: int
    email: str
    action: str
    ip_address: str | None
    timestamp: datetime
    role: str  # Now accessible via model property

    class Config:
        from_attributes = True

