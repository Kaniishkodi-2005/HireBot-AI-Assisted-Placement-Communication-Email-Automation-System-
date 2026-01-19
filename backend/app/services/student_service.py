from typing import List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.student_model import Student
from app.schemas.student_schema import StudentCreate, StudentDashboardMetrics, StudentResponse


class StudentService:
    """
    Handles student import and dashboard metrics.
    """

    @staticmethod
    def list_students(db: Session) -> List[StudentResponse]:
        students = db.query(Student).order_by(Student.import_order.asc()).all()
        return [StudentResponse.model_validate(s) for s in students]

    @staticmethod
    def create_student(db: Session, data: StudentCreate) -> StudentResponse:
        student = Student(
            roll_no=data.roll_no,
            name=data.name,
            department=data.department,
            domain=data.domain,
            cgpa=data.cgpa,
            ps_level=data.ps_level,
            skills_text=data.skills_text,
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        return StudentResponse.model_validate(student)

    @staticmethod
    def get_dashboard_metrics(db: Session) -> StudentDashboardMetrics:
        total_students = db.query(func.count(Student.id)).scalar() or 0
        
        # Get all students to normalize and count distinct departments/domains
        all_students = db.query(Student).all()
        
        # Normalize and count distinct departments (case-insensitive, trimmed)
        # Convert to uppercase for consistent counting
        departments = {}
        for student in all_students:
            if student.department:
                dept = student.department.strip().upper()
                if dept:
                    departments[dept] = departments.get(dept, 0) + 1
        department_count = len(departments)
        
        # Normalize and count distinct domains (case-insensitive, trimmed, exclude None/empty/General)
        domains = {}
        for student in all_students:
            if student.domain:
                domain = student.domain.strip()
                # Exclude empty, None, and "General" (case-insensitive)
                if domain and domain.lower() not in ['general', 'none', 'nan', '']:
                    domains[domain] = domains.get(domain, 0) + 1
        domain_count = len(domains)

        top_students_query = db.query(Student).order_by(Student.ps_level.desc()).limit(10).all()
        top_students = [StudentResponse.model_validate(s) for s in top_students_query]

        # Top Software Students (CSE, IT, CSBS, AIDS, AIML)
        software_depts = ['CSE', 'IT', 'CSBS', 'AIDS', 'AIML']
        core_depts = ['ECE', 'EEE', 'MECH', 'MTRS', 'BT']

        top_soft_query = db.query(Student).filter(
            func.upper(Student.department).in_(software_depts)
        ).order_by(Student.ps_level.desc()).limit(5).all()
        top_software_students = [StudentResponse.model_validate(s) for s in top_soft_query]

        top_core_query = db.query(Student).filter(
            func.upper(Student.department).in_(core_depts)
        ).order_by(Student.ps_level.desc()).limit(5).all()
        top_core_students = [StudentResponse.model_validate(s) for s in top_core_query]

        return StudentDashboardMetrics(
            total_students=total_students,
            department_count=department_count,
            domain_count=domain_count,
            top_students=top_students,
            top_software_students=top_software_students,
            top_core_students=top_core_students,
            dept_counts=departments,
            domain_counts=domains,
        )