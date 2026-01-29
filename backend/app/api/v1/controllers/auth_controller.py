from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.session import get_db
from app.schemas.auth_schema import GoogleLoginRequest, LoginRequest, SignupRequest, TokenResponse, UserInfo, ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.access_log_schema import AccessLogResponse
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=UserInfo)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    try:
        return AuthService.register_user(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    try:
        # Inject IP address
        data.ip_address = request.client.host
        token = AuthService.login(db, data)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc)
        )


@router.post("/google-login", response_model=TokenResponse)
def google_login(data: GoogleLoginRequest, request: Request, db: Session = Depends(get_db)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("AuthController: Received google login request")
        logger.info(f"AuthController: Token length: {len(data.token) if data.token else 0}")
        
        if data.token:
             # Inject IP address
            data.ip_address = request.client.host
            
        result = AuthService.google_login(db, data)
        
        logger.info("AuthController: Google login service returned success")
        if not result:
            logger.error("AuthController: Service returned None without raising exception")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google authentication failed"
            )
        return result
    except ValueError as exc:
        logger.warning(f"AuthController: Validation error during Google login: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=str(exc)
        )
    except Exception as exc:
        logger.error(f"AuthController: Unexpected error during Google login: {str(exc)}")
        import traceback
        logger.error(f"AuthController: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service temporarily unavailable"
        )


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        AuthService.send_password_reset_otp(db, data.email)
        return {"message": "OTP sent to your email successfully"}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        AuthService.reset_password_with_otp(db, data.email, data.otp, data.new_password)
        return {"message": "Password reset successfully"}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    """Get all users for admin management"""
    from app.models.user_model import User
    users = db.query(User).all()
    return [{
        "id": u.id,
        "email": u.email,
        "organization": u.organization,
        "role": u.role,
        "is_active": u.is_active,
        "is_approved": u.is_approved,
        "created_at": u.created_at.isoformat() if u.created_at else None
    } for u in users]


@router.post("/users/{user_id}/approve")
def approve_user(user_id: int, db: Session = Depends(get_db)):
    """Approve a user"""
    from app.models.user_model import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_approved = True
    user.is_active = True
    
    try:
        db.commit()
        db.refresh(user)
        print(f"User {user_id} approved successfully. is_approved={user.is_approved}, is_active={user.is_active}")
    except Exception as e:
        db.rollback()
        print(f"Error approving user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to approve user: {str(e)}")
    
    return {"message": "User approved successfully"}


@router.post("/users/{user_id}/decline")
def decline_user(user_id: int, db: Session = Depends(get_db)):
    """Decline/deactivate a user"""
    from app.models.user_model import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    print(f"BEFORE DECLINE - User {user_id} ({user.email}): is_approved={user.is_approved}, is_active={user.is_active}")
    
    # Set both is_approved and is_active to False
    user.is_approved = False
    user.is_active = False
    
    try:
        db.commit()
        db.refresh(user)
        print(f"AFTER DECLINE - User {user_id} ({user.email}): is_approved={user.is_approved}, is_active={user.is_active}")
    except Exception as e:
        db.rollback()
        print(f"Error declining user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to decline user: {str(e)}")
    
    return {"message": "User declined successfully"}


@router.put("/users/{user_id}/role")
def update_user_role(user_id: int, role: str, db: Session = Depends(get_db)):
    """Update user role"""
    from app.models.user_model import User
    if role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    return {"message": f"User role updated to {role}"}


@router.put("/users/{user_id}")
def update_user(user_id: int, user_data: dict, db: Session = Depends(get_db)):
    """Update user details"""
    from app.models.user_model import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update allowed fields
    if "email" in user_data:
        user.email = user_data["email"]
    if "organization" in user_data:
        user.organization = user_data["organization"]
    if "role" in user_data and user_data["role"] in ["admin", "user"]:
        user.role = user_data["role"]
    
    try:
        db.commit()
        db.refresh(user)
        return {"message": "User updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")


@router.get("/test-fetch/{contact_id}")
def test_fetch_conversations(contact_id: int, db: Session = Depends(get_db)):
    """Test endpoint to manually fetch conversations"""
    try:
        from app.services.hr_service import HRService
        result = HRService.get_conversation_history(db, contact_id)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs", response_model=list[AccessLogResponse])
def get_access_logs(db: Session = Depends(get_db)):
    """Get recent login logs (admin only)"""
    from app.models.access_log_model import AccessLog
    
    logs = db.query(AccessLog).order_by(desc(AccessLog.timestamp)).limit(100).all()
    return logs



