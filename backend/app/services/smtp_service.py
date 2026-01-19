import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS

def send_email(to_email: str, subject: str, body: str):
    """
    Sends an email using SMTP.
    """
    if not EMAIL_USER or not EMAIL_PASS:
        logging.error("SMTP credentials not configured.")
        return False

    msg = MIMEMultipart()
    msg['From'] = EMAIL_USER
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    try:
        logging.info(f"Attempting to send email to {to_email} via {SMTP_HOST}:{SMTP_PORT}...")
        # Added timeout to prevent hanging the process
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
        server.set_debuglevel(0)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        text = msg.as_string()
        server.sendmail(EMAIL_USER, to_email, text)
        server.quit()
        logging.info(f"✓ Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logging.error(f"⚠ SMTP Error sending to {to_email}: {e}")
        return False