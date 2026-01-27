import smtplib
import os
from dotenv import load_dotenv

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

print(f"Testing SMTP connection to {SMTP_HOST}:{SMTP_PORT}")
print(f"User: {EMAIL_USER}")
# print(f"Pass: {EMAIL_PASS}")

try:
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
    server.set_debuglevel(1)
    server.starttls()
    print("Login...")
    server.login(EMAIL_USER, EMAIL_PASS)
    print("Login successful!")
    server.quit()
    print("Test passed.")
except Exception as e:
    print(f"SMTP Test Failed: {e}")
