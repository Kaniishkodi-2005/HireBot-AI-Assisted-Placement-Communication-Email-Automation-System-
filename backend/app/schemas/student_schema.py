from datetime import datetime
from typing import List

from pydantic import BaseModel


class StudentBase(BaseModel):
    roll_no: str
    name: str
    department: str
    domain: str
    cgpa: float
    ps_level: float
    skills_text: str | None = None


class StudentCreate(StudentBase):
    pass


class StudentResponse(StudentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudentDashboardMetrics(BaseModel):
    total_students: int
    department_count: int
    domain_count: int
    top_students: List[StudentResponse]
    top_software_students: List[StudentResponse] = []
    top_core_students: List[StudentResponse] = []
    dept_counts: dict[str, int] = {}
    domain_counts: dict[str, int] = {}