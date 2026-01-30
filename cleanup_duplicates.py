import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.models.email_models import EmailConversation
from sqlalchemy import func

def clean_duplicates():
    db = SessionLocal()
    try:
        # Find duplicates based on contact, subject, direction, and roughly content/time
        # But for now, let's just find "Sent" emails that are very close in time with same subject
        
        print("Scanning for duplicates...")
        
        all_emails = db.query(EmailConversation).order_by(EmailConversation.hr_contact_id, EmailConversation.sent_at).all()
        
        seen = {}
        duplicates = []
        
        for email in all_emails:
            # Key: contact_id + direction + subject + specific-time-window
            # We'll use a minute-level time window for grouping
            if not email.sent_at: continue
            
            time_key = email.sent_at.strftime("%Y-%m-%d %H:%M") 
            key = (email.hr_contact_id, email.direction, email.subject, time_key)
            
            if key in seen:
                duplicates.append(email)
            else:
                seen[key] = email
        
        print(f"Found {len(duplicates)} potential duplicates.")
        
        for dup in duplicates:
            print(f"Deleting duplicate: {dup.id} - {dup.subject} - {dup.sent_at} - {dup.direction}")
            db.delete(dup)
            
        db.commit()
        print("Cleanup complete.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_duplicates()
