from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.student_model import Student
from app.schemas.student_schema import StudentCreate, StudentDashboardMetrics, StudentResponse
from app.services.csv_service import CSVService
from app.services.student_service import StudentService


router = APIRouter(prefix="/students", tags=["Students"])


@router.get("/", response_model=list[StudentResponse])
def list_students(db: Session = Depends(get_db)):
    return StudentService.list_students(db)


@router.get("/dashboard", response_model=StudentDashboardMetrics)
def get_dashboard_metrics(db: Session = Depends(get_db)):
    return StudentService.get_dashboard_metrics(db)


@router.post("/upload-csv", response_model=list[StudentResponse])
async def upload_students_csv(
    file: UploadFile = File(...),
    replace_mode: bool = Form(True),
    append_mode: bool = Form(False),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and Excel files (.csv, .xlsx, .xls) are supported."
        )

    try:
        file_bytes = await file.read()
        students = CSVService.import_students_from_file(
            db, file_bytes, file.filename, replace_mode=replace_mode, append_mode=append_mode
        )
        if not students:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid students found in file. Please check the file format and ensure it contains roll_no, name, department, and domain columns."
            )
        return [StudentResponse.model_validate(s) for s in students]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(student_id: int, data: StudentCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Update fields
    student.roll_no = data.roll_no
    student.name = data.name
    student.department = data.department.upper() if data.department else data.department
    student.domain = data.domain
    student.cgpa = data.cgpa
    student.ps_level = data.ps_level
    student.skills_text = data.skills_text
    
    db.commit()
    db.refresh(student)
    return StudentResponse.model_validate(student)


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    db.delete(student)
    db.commit()
    return {"message": "Student deleted successfully"}


@router.get("/export-excel")
def export_students_excel(db: Session = Depends(get_db)):
    """Export all students to Excel file."""
    try:
        excel_bytes = CSVService.export_students_to_excel(db)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=students.xlsx"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export students: {str(e)}"
        )


@router.get("/export-csv")
def export_students_csv(db: Session = Depends(get_db)):
    """Export all students to CSV file."""
    try:
        csv_bytes = CSVService.export_students_to_csv(db)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=students.csv"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export students: {str(e)}"
        )


