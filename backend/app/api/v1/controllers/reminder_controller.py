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
