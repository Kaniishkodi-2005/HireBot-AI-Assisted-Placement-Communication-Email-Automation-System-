from pydantic import BaseModel


class TemplateCreate(BaseModel):
    name: str
    subject: str
    body: str


class TemplateResponse(BaseModel):
    id: int
    name: str
    subject: str
    body: str