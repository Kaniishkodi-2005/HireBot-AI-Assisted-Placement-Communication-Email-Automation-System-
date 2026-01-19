import os
from functools import lru_cache

from pydantic_settings import BaseSettings
from dotenv import load_dotenv


# Load .env file from backend directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_PATH = os.path.join(BASE_DIR, ".env")
print(f"Loading .env from: {ENV_PATH}")
load_dotenv(ENV_PATH)
print(f"EMAIL_USER from env: {os.getenv('EMAIL_USER')}")
print(f"MYSQL_PASSWORD from env: {os.getenv('MYSQL_PASSWORD')}")


class Settings(BaseSettings):
    APP_NAME: str = "HireBot API"
    APP_ENV: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"
    
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "password"
    MYSQL_DB: str = "hirebot_db"

    JWT_SECRET_KEY: str = "CHANGE_ME"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GOOGLE_CLIENT_ID: str = "54602439728-atf4ekiib5l48370bvbi8rk03jk3eiid.apps.googleusercontent.com"


    # Email Settings
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    IMAP_HOST: str = "imap.gmail.com"

    # Ollama Settings for Phi-3-Mini-4K-Instruct
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3:latest"  # Using installed phi3:latest model
    OLLAMA_TEMPERATURE: float = 0.3  # Lower = more focused, higher = more creative
    OLLAMA_MAX_TOKENS: int = 500  # Maximum tokens for email drafts
    OLLAMA_TIMEOUT: int = 120  # Request timeout in seconds (increased for CPU inference)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        print(f"Settings initialized - EMAIL_USER: {self.EMAIL_USER}, EMAIL_PASS: {'***' if self.EMAIL_PASS else 'None'}")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # MySQL connection string - URL encode password to handle special characters like @
        from urllib.parse import quote_plus
        encoded_password = quote_plus(self.MYSQL_PASSWORD)
        return (
            f"mysql://{self.MYSQL_USER}:{encoded_password}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

# Export individual constants for backward compatibility
EMAIL_USER = settings.EMAIL_USER
EMAIL_PASS = settings.EMAIL_PASS
SMTP_HOST = settings.SMTP_HOST
SMTP_PORT = settings.SMTP_PORT
IMAP_HOST = settings.IMAP_HOST
IMAP_PORT = 993  # Standard IMAP SSL port