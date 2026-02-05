from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, constr


class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: constr(min_length=8)
    confirm_password: constr(min_length=8)
    organization: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    ip_address: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    token: str
    ip_address: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: constr(min_length=6)


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: constr(min_length=8)
    confirm_password: constr(min_length=8)


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    role: str
    email: EmailStr
    full_name: Optional[str] = None
    organization: str


class UserInfo(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    organization: str
    role: str
    is_active: bool
    is_approved: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True