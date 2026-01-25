from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.schemas.reminder_schema import ReminderCreate, ReminderResponse
from app.services.reminder_service import ReminderService
from app.models.reminder_model import Reminder

router = APIRouter(prefix="/hr", tags=["Reminders"])

@router.post("/reminders", response_model=ReminderResponse)
def create_reminder(data: ReminderCreate, db: Session = Depends(get_db)):
    """Create a new reminder/commitment"""
    try:
        reminder = ReminderService.create_reminder(db, data)
        return reminder
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reminders/pending", response_model=List[ReminderResponse])
def get_pending_reminders(db: Session = Depends(get_db)):
    """Get all pending reminders"""
    try:
        reminders = ReminderService.get_pending_reminders(db)
        return reminders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/reminders/{reminder_id}/fulfill", response_model=ReminderResponse)
def mark_reminder_fulfilled(reminder_id: int, db: Session = Depends(get_db)):
    """Mark a reminder as fulfilled"""
    try:
        reminder = ReminderService.mark_fulfilled(db, reminder_id)
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return reminder
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reminders/{reminder_id}/draft")
def draft_reminder_reply(reminder_id: int, db: Session = Depends(get_db)):
    """Generate a draft email for a reminder"""
    try:
        draft = ReminderService.generate_reminder_draft(db, reminder_id)
        if not draft:
            raise HTTPException(status_code=404, detail="Reminder not found or missing contact")
        return draft
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/reminders/{reminder_id}/restore")
def restore_reminder(reminder_id: int, db: Session = Depends(get_db)):
    """Restore a fulfilled reminder back to pending status"""
    try:
        reminder = ReminderService.restore_reminder(db, reminder_id)
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder restored successfully", "reminder_id": reminder_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reminders/restore-by-contact")
def restore_reminders_by_contact(request: dict, db: Session = Depends(get_db)):
    """Restore fulfilled reminders for a specific contact"""
    try:
        contact_name = request.get("contact_name")
        if not contact_name:
            raise HTTPException(status_code=400, detail="contact_name is required")
        
        from app.models.hr_contact_model import HRContact
        
        # Find contact by name (case insensitive)
        contact = db.query(HRContact).filter(
            HRContact.name.ilike(f"%{contact_name}%")
        ).first()
        
        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact '{contact_name}' not found")
        
        # Find fulfilled reminders for this contact
        fulfilled_reminders = db.query(Reminder).filter(
            Reminder.contact_id == contact.id,
            Reminder.status == "fulfilled"
        ).all()
        
        if not fulfilled_reminders:
            return {"message": f"No fulfilled reminders found for {contact.name}", "restored_count": 0}
        
        # Restore all fulfilled reminders for this contact
        restored_count = 0
        for reminder in fulfilled_reminders:
            reminder.status = "pending"
            reminder.updated_at = datetime.utcnow()
            restored_count += 1
        
        db.commit()
        
        return {
            "message": f"Restored {restored_count} reminder(s) for {contact.name}",
            "restored_count": restored_count,
            "contact_name": contact.name,
            "company": contact.company
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
