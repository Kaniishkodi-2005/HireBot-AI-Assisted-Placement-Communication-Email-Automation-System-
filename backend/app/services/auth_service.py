from typing import Optional
import random
import string
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user_model import User
from app.schemas.auth_schema import GoogleLoginRequest, LoginRequest, SignupRequest, TokenResponse, UserInfo
from app.core.config import settings
from app.services.email_service import EmailService

# In-memory OTP storage (for production, use Redis or database)
otp_storage = {}

class AuthService:
    """
    Handles all authentication and user registration logic.
    Controllers should call these methods instead of touching models directly.
    """

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
        if not user or not verify_password(data.password, user.password_hash):
            return None
        
        print(f"Login attempt - Email: {user.email}, is_active: {user.is_active}, is_approved: {user.is_approved}")
        
        # Check if user is active first (declined users)
        if not user.is_active:
            raise ValueError("Declined by admin. Please contact the administrator.")
        
        # Then check if user is approved (pending users)
        if not user.is_approved:
            raise ValueError("Your account is pending admin approval. Please contact the administrator.")

        access_token = create_access_token({"sub": str(user.id), "role": user.role})
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
        from google.oauth2 import id_token
        from google.auth.transport import requests
        import logging

        logger = logging.getLogger(__name__)
        logger.info("=== BACKEND GOOGLE LOGIN START ===")
        logger.info(f"P1. Received token length: {len(data.token) if data.token else 0}")
        
        try:
            logger.info("P2. Verifying token with Google via google-auth library...")
            
            # Use requests.Request() directly. The library handles its own timeouts internally 
            # or uses the default environment settings. We avoid setting a global socket timeout
            # as it can interfere with other parts of the application (like DB or SMTP).
            try:
                # PROPER Google token verification
                idinfo = id_token.verify_oauth2_token(
                    data.token, 
                    requests.Request(), 
                    settings.GOOGLE_CLIENT_ID
                )
                logger.info("P3. Token verified successfully")
                # Avoid logging the entire idinfo for security, but log the email
                email = idinfo.get("email")
                logger.info(f"P4. Token info: Verified email: {email}")
            except Exception as e:
                logger.error(f"P3.1 ERROR during token verification: {str(e)}")
                raise ValueError(f"Google token verification failed: {str(e)}")

            if not email:
                logger.error("P5. ERROR: Email not found in Google token")
                raise ValueError("Email not found in Google token")

            logger.info(f"P6. Google login attempt for email: {email}")

            logger.info("P6.1 Querying user from DB...")
            user = db.query(User).filter(User.email == email).first()
            logger.info(f"P6.2 DB Query finished. User found: {user is not None}")
            
            if not user:
                logger.info(f"P7. Creating new user for Google email: {email}")
                
                # Special case: bitplacement28@gmail.com gets admin role
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
                try:
                    db.commit()
                    db.refresh(user)
                    logger.info(f"P8. User created successfully with ID: {user.id}")
                except Exception as e:
                    db.rollback()
                    logger.error(f"P8.1 ERROR creating user: {str(e)}")
                    raise ValueError(f"Failed to create user account: {str(e)}")
            else:
                logger.info(f"P9. User found with ID: {user.id}")
            
            logger.info(f"P10. User status - is_active: {user.is_active}, is_approved: {user.is_approved}")
            
            if not user.is_active:
                logger.error("P11. ERROR: User is not active")
                raise ValueError("Account declined by admin. Please contact the administrator.")
            
            if not user.is_approved:
                logger.error("P12. ERROR: User is not approved")
                raise ValueError("Account pending admin approval. Please contact the administrator.")

            logger.info("P13. Creating access token...")
            access_token = create_access_token({"sub": str(user.id), "role": user.role})
            
            response = TokenResponse(
                access_token=access_token,
                role=user.role,
                email=user.email,
                organization=user.organization,
            )
            logger.info(f"P14. SUCCESS: Returning response for role: {user.role}")
            return response
            
        except ValueError as ve:
            logger.error(f"P15. Validation error: {str(ve)}")
            raise ve
        except Exception as e:
            logger.error(f"P16. System error: {str(e)}")
            import traceback
            logger.error(f"P17. Traceback: {traceback.format_exc()}")
            raise ValueError(f"Google authentication failed: {str(e)}")