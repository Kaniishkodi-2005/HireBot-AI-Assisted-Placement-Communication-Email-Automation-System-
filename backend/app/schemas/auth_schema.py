from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, constr


class SignupRequest(BaseModel):
    email: EmailStr
    password: constr(min_length=8)
    confirm_password: constr(min_length=8)
    organization: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: constr(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: EmailStr
    organization: str


class UserInfo(BaseModel):
    id: int
    email: EmailStr
    organization: str
    role: str
    is_active: bool
    is_approved: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True