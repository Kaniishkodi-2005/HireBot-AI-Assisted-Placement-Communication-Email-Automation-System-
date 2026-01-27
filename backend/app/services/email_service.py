"""
Email Service for sending emails via SMTP and reading via IMAP
"""
import smtplib
import imaplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.core.config import settings


class EmailService:
    """Service for sending and receiving emails via SMTP and IMAP"""
    
    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        attachments: Optional[List[str]] = None
    ) -> bool:
        """Send an email via SMTP"""
        
        def log_debug(msg):
            try:
                with open("email_debug.log", "a") as f:
                    f.write(f"{datetime.now()} - {msg}\n")
            except: pass

        log_debug(f"Starting send_email to {to_email}")

        # Get credentials from settings
        EMAIL_USER = settings.EMAIL_USER
        EMAIL_PASS = settings.EMAIL_PASS
        SMTP_HOST = settings.SMTP_HOST
        SMTP_PORT = settings.SMTP_PORT
        
        log_debug(f"Credentials loaded: USER={EMAIL_USER}, HOST={SMTP_HOST}")
        
        if not EMAIL_USER or not EMAIL_PASS:
            log_debug("ERROR: Email credentials not configured")
            print(f"[EMAIL ERROR] Email credentials not configured")
            return False
        
        if not EmailService.validate_email(to_email):
            log_debug(f"ERROR: Invalid recipient email: {to_email}")
            print(f"[EMAIL ERROR] Invalid recipient email: {to_email}")
            return False
        
        try:
            print(f"[EMAIL] Attempting to send email to {to_email}")
            
            msg = MIMEMultipart()
            msg['From'] = EMAIL_USER
            msg['To'] = to_email
            msg['Subject'] = subject
            msg['Date'] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S %z")
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            msg.attach(MIMEText(body, 'plain'))
            
            if attachments:
                for file_path in attachments:
                    EmailService._attach_file(msg, file_path)
            
            log_debug(f"Connecting to SMTP server {SMTP_HOST}:{SMTP_PORT}")
            print(f"[EMAIL] Connecting to SMTP server {SMTP_HOST}:{SMTP_PORT}")
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.starttls()
                log_debug("Logging in...")
                print(f"[EMAIL] Logging in with user: {EMAIL_USER}")
                server.login(EMAIL_USER, EMAIL_PASS)
                
                recipients = [to_email]
                if cc:
                    recipients.extend(cc)
                
                log_debug(f"Sending message to: {recipients}")
                print(f"[EMAIL] Sending message to recipients: {recipients}")
                server.send_message(msg)
                print(f"[EMAIL] ✓ Email sent successfully to {to_email}")
                log_debug("Email sent successfully")
            
            return True
            
        except Exception as e:
            log_debug(f"EXCEPTION: {str(e)}")
            import traceback
            log_debug(traceback.format_exc())
            print(f"[EMAIL ERROR] Failed to send email: {str(e)}")
            return False
    
    @staticmethod
    def _attach_file(msg: MIMEMultipart, file_path: str):
        """Attach a file to the email message"""
        try:
            with open(file_path, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                
                filename = os.path.basename(file_path)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {filename}'
                )
                
                msg.attach(part)
        except Exception as e:
            print(f"Error attaching file {file_path}: {str(e)}")
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Basic email validation"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    @staticmethod
    def fetch_replies(known_emails: List[str], target_email: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch emails from inbox and sent folder"""
        replies = []
        
        EMAIL_USER = settings.EMAIL_USER
        EMAIL_PASS = settings.EMAIL_PASS
        IMAP_HOST = settings.IMAP_HOST
        
        if not EMAIL_USER or not EMAIL_PASS:
            print("[ERROR] Email credentials not found")
            return []

        # Helper to parse email date to UTC
        def parse_email_date(date_str):
            try:
                if not date_str:
                    return datetime.utcnow()
                from email.utils import parsedate_to_datetime
                from datetime import timezone
                dt = parsedate_to_datetime(date_str)
                if dt.tzinfo is not None:
                     dt = dt.astimezone(timezone.utc)
                else:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.replace(tzinfo=None)
            except Exception as e:
                print(f"[DEBUG] Date Parse Error: {e}")
                return None

        # Helper to generate hash ID if Message-ID is missing
        def generate_message_hash(sender, subject, date_str, body_preview):
            import hashlib
            s_norm = (sender or "").lower().strip()
            sub_norm = (subject or "").lower().strip()
            d_norm = (date_str or "").strip()
            raw_str = f"{s_norm}|{sub_norm}|{d_norm}" 
            return hashlib.md5(raw_str.encode('utf-8', errors='ignore')).hexdigest()

        # Helper to decode MIME headers
        def decode_mime_header(s):
            if not s:
                return ""
            try:
                from email.header import decode_header
                decoded_parts = decode_header(s)
                result = ""
                for part, encoding in decoded_parts:
                    if isinstance(part, bytes):
                        result += part.decode(encoding or 'utf-8', errors='ignore')
                    else:
                        result += str(part)
                return result
            except Exception as e:
                print(f"[DEBUG] Decode Header Error: {e}")
                return s

        mail = None
        try:
            print(f"[IMAP] Connecting to {IMAP_HOST} for {EMAIL_USER}...")
            mail = imaplib.IMAP4_SSL(IMAP_HOST)
            mail.login(EMAIL_USER, EMAIL_PASS)
            
            known_emails_lower = [e.lower().strip() for e in known_emails if e]
            cutoff_date = "12-Jan-2026"

            # 1. Fetch RECEIVED emails from INBOX
            try:
                mail.select("INBOX")
                search_query = f'SINCE {cutoff_date}'
                if target_email:
                    search_query = f'FROM "{target_email}" SINCE {cutoff_date}'
                    
                print(f"[IMAP] Searching INBOX with query: {search_query}")
                status, messages = mail.search(None, search_query)
                
                if status == 'OK' and messages[0]:
                    email_ids = messages[0].split()
                    print(f"[IMAP] Processing {len(email_ids)} inbox emails...")
                    for email_id in email_ids[-50:]:
                        try:
                            status, data = mail.fetch(email_id, '(RFC822)')
                            if status == 'OK' and data[0]:
                                msg = email.message_from_bytes(data[0][1])
                                from_header = decode_mime_header(msg.get("From", ""))
                                sender_email = email.utils.parseaddr(from_header)[1].lower().strip()
                                
                                if sender_email in known_emails_lower:
                                    subject = decode_mime_header(msg.get("Subject", ""))
                                    message_id = msg.get("Message-ID", "")
                                    date_str = msg.get("Date", "")
                                    parsed_dt = parse_email_date(date_str)
                                    
                                    body = ""
                                    if msg.is_multipart():
                                        for part in msg.walk():
                                            if part.get_content_type() == "text/plain":
                                                try:
                                                    payload = part.get_payload(decode=True)
                                                    if payload:
                                                        body = payload.decode('utf-8', errors='ignore')
                                                        break
                                                except: continue
                                    else:
                                        try:
                                            payload = msg.get_payload(decode=True)
                                            if payload: body = payload.decode('utf-8', errors='ignore')
                                        except: body = str(msg.get_payload())
                                    
                                    if not message_id:
                                        message_id = generate_message_hash(from_header, subject, date_str, body)
                                    
                                    if body and body.strip():
                                        replies.append({
                                            "subject": subject, "body": body.strip(), "from": from_header,
                                            "timestamp": date_str, "parsed_timestamp": parsed_dt,
                                            "message_id": message_id, "direction": "received"
                                        })
                        except Exception as e:
                            print(f"[IMAP] Error processing inbox email {email_id}: {e}")
                mail.close()
            except Exception as e:
                print(f"[IMAP] Error accessing INBOX: {e}")

            # 2. Fetch SENT emails (Detect folder)
            sent_folder = None
            try:
                status, folders = mail.list()
                if status == 'OK':
                    # Common names for sent folder
                    common_sent = ['[Gmail]/Sent Mail', 'Sent', 'SENT', 'Sent Messages', 'Sent Items']
                    for folder_line in folders:
                        decoded = folder_line.decode('utf-8', errors='ignore')
                        for name in common_sent:
                            if name in decoded:
                                # Extract actual name (usually at the end of the line)
                                # Gmail format: '(\\HasNoChildren \\Sent) "/" "[Gmail]/Sent Mail"'
                                if '"/"' in decoded:
                                    sent_folder = decoded.split('"/"')[-1].strip()
                                break
                        if sent_folder: break
            except: pass
            
            if not sent_folder:
                 sent_folder = '"[Gmail]/Sent Mail"' # Default fallback
            
            try:
                print(f"[IMAP] Attempting to select sent folder: {sent_folder}")
                status, _ = mail.select(sent_folder)
                if status == 'OK':
                    search_query = f'SINCE {cutoff_date}'
                    if target_email:
                        search_query = f'TO "{target_email}" SINCE {cutoff_date}'
                        
                    print(f"[IMAP] Searching SENT with query: {search_query}")
                    status, messages = mail.search(None, search_query)
                    
                    if status == 'OK' and messages[0]:
                        sent_ids = messages[0].split()
                        print(f"[IMAP] Processing {len(sent_ids)} sent emails...")
                        for email_id in sent_ids[-50:]:
                            try:
                                status, data = mail.fetch(email_id, '(RFC822)')
                                if status == 'OK' and data[0]:
                                    msg = email.message_from_bytes(data[0][1])
                                    to_header = decode_mime_header(msg.get("To", ""))
                                    recipient_email = email.utils.parseaddr(to_header)[1].lower().strip()
                                    
                                    if recipient_email in known_emails_lower:
                                        subject = decode_mime_header(msg.get("Subject", ""))
                                        message_id = msg.get("Message-ID", "")
                                        date_str = msg.get("Date", "")
                                        parsed_dt = parse_email_date(date_str)
                                        
                                        body = ""
                                        if msg.is_multipart():
                                            for part in msg.walk():
                                                if part.get_content_type() == "text/plain":
                                                    try:
                                                        payload = part.get_payload(decode=True)
                                                        if payload:
                                                            body = payload.decode('utf-8', errors='ignore')
                                                            break
                                                    except: continue
                                        else:
                                            try:
                                                payload = msg.get_payload(decode=True)
                                                if payload: body = payload.decode('utf-8', errors='ignore')
                                            except: body = str(msg.get_payload())
                                        
                                        sender_header = decode_mime_header(msg.get("From", ""))
                                        if not message_id:
                                            message_id = generate_message_hash(sender_header, subject, date_str, body)

                                        if body and body.strip():
                                            replies.append({
                                                "subject": subject, "body": body.strip(), "from": sender_header,
                                                "timestamp": date_str, "parsed_timestamp": parsed_dt,
                                                "message_id": message_id, "direction": "sent"
                                            })
                            except Exception as e:
                                print(f"[IMAP] Error processing sent email {email_id}: {e}")
                    mail.close()
                else:
                    print(f"[IMAP] Could not select sent folder: {sent_folder}")
            except Exception as e:
                print(f"[IMAP] Error accessing sent folder {sent_folder}: {e}")

        except Exception as e:
            import traceback
            print(f"[IMAP ERROR] Critical failure: {str(e)}")
            print(traceback.format_exc())
        finally:
            if mail:
                try:
                    mail.logout()
                except: pass
            
        print(f"[IMAP] Total emails found: {len(replies)}")
        return replies