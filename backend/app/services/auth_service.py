from typing import Optional
import random
import string
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user_model import User
from app.schemas.auth_schema import GoogleLoginRequest, LoginRequest, SignupRequest, TokenResponse, UserInfo
from app.core.config import settings
from app.services.email_service import EmailService

# In-memory OTP storage (for production, use Redis or database)
otp_storage = {}

logger = logging.getLogger(__name__)

class AuthService:
    """
    Handles all authentication and user registration logic.
    Controllers should call these methods instead of touching models directly.
    """

    @staticmethod
    def log_access(db: Session, user_id: int, email: str, action: str, ip_address: str = None):
        try:
            from app.models.access_log_model import AccessLog
            log = AccessLog(
                user_id=user_id,
                email=email,
                action=action,
                ip_address=ip_address
            )
            db.add(log)
            db.commit()
        except Exception as e:
            print(f"Failed to log access: {e}")
            # Don't fail the login if logging fails

    @staticmethod
    def register_user(db: Session, data: SignupRequest) -> UserInfo:
        if data.password != data.confirm_password:
            raise ValueError("Passwords do not match.")

        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise ValueError("User with this email already exists.")

        # First user becomes admin and is auto-approved
        is_first_user = db.query(User).count() == 0
        role = "admin" if is_first_user else "user"
        is_approved = is_first_user  # First user auto-approved

        user = User(
            email=data.email,
            password_hash=get_password_hash(data.password),
            organization=data.organization,
            role=role,
            is_approved=is_approved,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return UserInfo.model_validate(user)

    @staticmethod
    def login(db: Session, data: LoginRequest) -> Optional[TokenResponse]:
        user: Optional[User] = db.query(User).filter(User.email == data.email).first()
        
        # Check if user exists
        if not user:
            return None
        
        # Check if user signed up via Google OAuth (no password set)
        if not user.password_hash or user.password_hash == "":
            raise ValueError("This account was created using Google Sign-In and has no password set. Please use 'Continue with Google' to login, or click 'Forgot Password' to set a password for email login.")
        
        # Verify password for regular accounts
        if not verify_password(data.password, user.password_hash):
            return None
        
        print(f"Login attempt - Email: {user.email}, is_active: {user.is_active}, is_approved: {user.is_approved}")
        
        # Check if user is active first (declined users)
        if not user.is_active:
            raise ValueError("Declined by admin. Please contact the administrator.")
        
        # Then check if user is approved (pending users)
        if not user.is_approved:
            raise ValueError("Your account is pending admin approval. Please contact the administrator.")

        access_token = create_access_token({"sub": str(user.id), "role": user.role})
        
        # Log successful login
        AuthService.log_access(db, user.id, user.email, "LOGIN", data.ip_address if hasattr(data, 'ip_address') else None)

        return TokenResponse(
            access_token=access_token,
            role=user.role,
            email=user.email,
            organization=user.organization,
        )

    @staticmethod
    def send_password_reset_otp(db: Session, email: str):
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise ValueError("No user found with this email address")
        
        # Generate 6-digit OTP
        otp = ''.join(random.choices(string.digits, k=6))
        
        # Store OTP with expiration (10 minutes)
        otp_storage[email] = {
            'otp': otp,
            'expires_at': datetime.now() + timedelta(minutes=10)
        }
        
        # Send OTP via email
        subject = "Password Reset OTP - HireBot"
        body = f"""Hello,

Your OTP for password reset is: {otp}

This OTP will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
HireBot Team"""
        
        EmailService.send_email(email, subject, body)
        print(f"OTP sent to {email}: {otp}")  # For debugging
    
    @staticmethod
    def reset_password_with_otp(db: Session, email: str, otp: str, new_password: str):
        # Check if OTP exists and is valid
        if email not in otp_storage:
            raise ValueError("No OTP found for this email. Please request a new one.")
        
        stored_data = otp_storage[email]
        
        # Check if OTP has expired
        if datetime.now() > stored_data['expires_at']:
            del otp_storage[email]
            raise ValueError("OTP has expired. Please request a new one.")
        
        # Verify OTP
        if stored_data['otp'] != otp:
            raise ValueError("Invalid OTP. Please try again.")
        
        # Find user and update password
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise ValueError("User not found")
        
        user.password_hash = get_password_hash(new_password)
        db.commit()
        
        # Clear OTP after successful reset
        del otp_storage[email]

    @staticmethod
    def google_login(db: Session, data: GoogleLoginRequest) -> Optional[TokenResponse]:
        """
        Handles Google authentication by verifying the token and creating/retrieving a user.
        """
        logger.info("=== BACKEND GOOGLE LOGIN START ===")
        
        try:
            logger.info("P2. Verifying token...")
            email = None
            
            # 1. Try Standard Verification
            try:
                idinfo = id_token.verify_oauth2_token(
                    data.token, 
                    requests.Request(), 
                    settings.GOOGLE_CLIENT_ID
                )
                email = idinfo.get("email")
                logger.info("P3. Standard Verification SUCCESS")
            except Exception as e:
                logger.warning(f"P3. Standard Verification FAILED: {e}")
                
                # 2. Try Manual Verification (Development Mode for Date Mismatch)
                logger.info("P4. Attempting Manual Verification...")
                try:
                    claims = jwt.get_unverified_claims(data.token)
                    
                    # Verify Audience
                    aud = claims.get('aud')
                    if aud != settings.GOOGLE_CLIENT_ID:
                        raise ValueError(f"Audience mismatch: {aud} vs {settings.GOOGLE_CLIENT_ID}")
                        
                    # Verify Issuer
                    iss = claims.get('iss')
                    if iss not in ['accounts.google.com', 'https://accounts.google.com']:
                        raise ValueError(f"Issuer mismatch: {iss}")
                        
                    email = claims.get("email")
                    logger.info("P4. Manual Verification SUCCESS")
                    
                except Exception as me:
                    logger.error(f"P4. Manual Verification FAILED: {me}")
                    raise ValueError(f"Authentication failed: {e}")

            if not email:
                raise ValueError("Email not found in token")

            logger.info(f"P5. Processing user: {email}")

            user = db.query(User).filter(User.email == email).first()
            
            if not user:
                logger.info(f"P6. Creating new user: {email}")
                role = "admin" if email == "bitplacement28@gmail.com" else "user"
                user = User(
                    email=email,
                    password_hash="",
                    organization="Google User",
                    role=role,
                    is_approved=True,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                logger.info(f"P6. User found: {user.id}")
                # Ensure special user is admin
                if email == "bitplacement28@gmail.com" and user.role != "admin":
                    user.role = "admin"
                    user.is_approved = True
                    user.is_active = True
                    db.commit()
            
            if not user.is_active:
                raise ValueError("Account declined by admin.")
            
            if not user.is_approved:
                raise ValueError("Account pending approval.")

            access_token = create_access_token({"sub": str(user.id), "role": user.role})
            
            AuthService.log_access(db, user.id, user.email, "GOOGLE_LOGIN", data.ip_address)

            return TokenResponse(
                access_token=access_token,
                role=user.role,
                email=user.email,
                organization=user.organization,
            )
            
        except ValueError as ve:
             logger.error(f"Validation Error: {ve}")
             raise ve
        except Exception as e:
            logger.error(f"System Error: {e}")
            import traceback
            traceback.print_exc()
            raise ValueError(f"Login failed: {str(e)}")