from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db

router = APIRouter()

@router.delete("/clear-all-conversations")
def clear_all_conversations(db: Session = Depends(get_db)):
    """
    EMERGENCY: Truncate email_conversations table.
    """
    try:
        # Use DELETE instead of TRUNCATE to avoid permission issues if any
        # db.execute(text("TRUNCATE TABLE email_conversations")) 
        # But for SQLAlchemy, typically delete() is safer cross-DB
        # db.query(EmailConversation).delete()
        
        # Raw SQL is fastest for "Wipe"
        db.execute(text("DELETE FROM email_conversations"))
        db.commit()
        return {"message": "All conversations cleared successfully (via API)."}
    except Exception as e:
        return {"error": str(e)}

@router.delete("/clear-contact/{contact_id}")
def clear_contact_conversations(contact_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM email_conversations WHERE hr_contact_id = :cid"), {"cid": contact_id})
        db.commit()
        return {"message": f"Conversations for Contact {contact_id} cleared."}
    except Exception as e:
        return {"error": str(e)}
