import csv
from io import StringIO, BytesIO
from typing import List

import pandas as pd
from sqlalchemy.orm import Session

from app.models.hr_contact_model import HRContact
from app.models.student_model import Student
from app.models.reminder_model import Reminder
from app.models.email_models import EmailConversation


class CSVService:
    """
    Handles CSV and Excel parsing for HR contacts and students.
    Supports .csv, .xlsx, and .xls file formats.
    """

    @staticmethod
    def _find_column(df, possible_names):
        """Find a column by trying multiple possible names."""
        for name in possible_names:
            if name in df.columns:
                return name
        return None

    @staticmethod
    def _calculate_weighted_ps_score(raw_input, is_software: bool = True) -> tuple[float, str]:
        """
        Parses raw PS input (supports ',' or ';') and calculates weighted SUM score.
        Sum of Priority Skills (70% total weight capacity) + Aptitude (30%).
        """
        import re
        if pd.isna(raw_input) or raw_input == "":
             return 0.0, ""
             
        # Case 1: Simple Number (Legacy support)
        try:
            val = float(raw_input)
            return val, str(raw_input).strip()
        except ValueError:
            pass
            
        # Case 2: Skill String Parsing (e.g., "PYTHON-3; JAVA-2")
        text_input = str(raw_input).upper() # Normalize to uppercase
        # Split by comma or semicolon
        parts = [p.strip() for p in re.split('[,;]', text_input) if p.strip()]
        
        # Define priority software skills
        software_skills = {
            'PYTHON', 'JAVA', 'C', 'CPP', 'C++', 'JS', 'JAVASCRIPT', 'GO', 'RUST', 
            'SQL', 'MYSQL', 'HTML', 'CSS', 'REACT', 'NODE', 'ANGULAR', 'FLUTTER', 
            'PHP', 'NET', 'CSHARP', 'C#', 'AWS', 'CLOUD', 'AI', 'ML', 'DATA SCIENCE'
        }
        
        soft_sum = 0.0
        gen_sum = 0.0
        
        for part in parts:
            if '-' in part:
                try:
                    skill_name, score_str = part.rsplit('-', 1)
                    skill_name = skill_name.strip()
                    score = float(score_str)
                    
                    if skill_name in software_skills:
                        soft_sum += score
                    else:
                        # Everything else falls into General (Aptitude, Verbal, Hardware, etc.)
                        gen_sum += score
                except ValueError:
                    continue
        
        # Weighted Score Logic for Ranking:
        # Software skills get 2x weight compared to General skills for sorting purposes
        # This ensures a student with "PYTHON-5" ranks higher than one with "APTITUDE-5"
        final_score = (soft_sum * 2.0) + (gen_sum * 1.0)
            
        # Display String: Return the original raw input properly formatted if needed, 
        # but for now we just return the raw input cleaned up.
        skills_display = str(raw_input).strip()
        return round(final_score, 2), skills_display

    @staticmethod
    def _read_file_to_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
        """Read CSV or Excel file into a pandas DataFrame."""
        if filename.endswith(('.xlsx', '.xls')):
            return pd.read_excel(BytesIO(file_bytes))
        else:
            # Try UTF-8 first
            try:
                csv_text = file_bytes.decode("utf-8")
                return pd.read_csv(StringIO(csv_text))
            except UnicodeDecodeError:
                # Fallback to Latin-1 (common for Excel CSVs on Windows)
                csv_text = file_bytes.decode("latin-1")
                return pd.read_csv(StringIO(csv_text))

    @staticmethod
    def import_hr_contacts_from_file(db: Session, file_bytes: bytes, filename: str, replace_mode: bool = True, append_mode: bool = False) -> List[HRContact]:
        """Import HR contacts from CSV or Excel file."""
        try:
            df = CSVService._read_file_to_dataframe(file_bytes, filename)
        except Exception as e:
            raise ValueError(f"Failed to read file: {str(e)}")
        
        if df.empty:
            raise ValueError("File is empty or could not be read.")
        
        # Normalize column names (case-insensitive, strip whitespace, replace spaces/underscores)
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace('-', '_')
        
        # Drop completely empty rows
        df = df.dropna(how='all')
        
        # Find columns with flexible matching
        name_col = CSVService._find_column(df, ['name', 'hr_name', 'contact_name', 'full_name', 'person_name'])
        company_col = CSVService._find_column(df, ['company', 'company_name', 'organization', 'org', 'firm'])
        email_col = CSVService._find_column(df, ['email', 'email_address', 'e_mail', 'mail', 'contact_email'])
        email_status_col = CSVService._find_column(df, ['email_status', 'status', 'emailstate', 'reply_status'])
        draft_status_col = CSVService._find_column(df, ['draft_status', 'draftstate', 'draft', 'draft_ready'])
        
        # Check required columns
        if not name_col:
            available_cols = ', '.join(df.columns.tolist())
            raise ValueError(f"Could not find name column. Available columns: {available_cols}. Please ensure your file has a column for HR name (e.g., 'name', 'hr_name', 'contact_name').")
        if not company_col:
            available_cols = ', '.join(df.columns.tolist())
            raise ValueError(f"Could not find company column. Available columns: {available_cols}. Please ensure your file has a company column (e.g., 'company', 'company_name', 'organization').")
        if not email_col:
            available_cols = ', '.join(df.columns.tolist())
            raise ValueError(f"Could not find email column. Available columns: {available_cols}. Please ensure your file has an email column (e.g., 'email', 'email_address', 'mail').")
        
        # If replace_mode, preparation for delete (but commit later for safety)
        if replace_mode:
            # Safe cleanup before delete - Handle Foreign Key Constraints
            # 1. Delete Linkages (Conversations, Reminders, etc.)
            # This is a destructive operation inherent to "Replace All" mode
            contacts_to_delete = db.query(HRContact).all()
            contact_ids = [c.id for c in contacts_to_delete]
            
            if contact_ids:
                db.query(Reminder).filter(Reminder.contact_id.in_(contact_ids)).delete(synchronize_session=False)
                db.query(EmailConversation).filter(EmailConversation.hr_contact_id.in_(contact_ids)).delete(synchronize_session=False)
            
            # 2. Queue contacts for deletion (will be committed only if valid data exists)
            db.query(HRContact).delete()
            # db.commit() REMOVED to ensure transactional safety

        
        created_contacts: List[HRContact] = []
        updated_contacts: List[HRContact] = []
        errors = []
        skipped_empty = 0
        skipped_duplicates = 0
        
        for idx, row in df.iterrows():
            try:
                # Get values with fallbacks
                name = str(row[name_col]).strip() if pd.notna(row[name_col]) else ""
                company = str(row[company_col]).strip() if pd.notna(row[company_col]) else ""
                email = str(row[email_col]).strip() if pd.notna(row[email_col]) else ""
                email_status = str(row[email_status_col]).strip() if email_status_col and pd.notna(row[email_status_col]) else "Not Started"
                draft_status = str(row[draft_status_col]).strip() if draft_status_col and pd.notna(row[draft_status_col]) else "Not Started"
                
                # Skip if essential fields are empty
                if not name or name.lower() in ['nan', 'none', '']:
                    skipped_empty += 1
                    continue
                if not company or company.lower() in ['nan', 'none', '']:
                    skipped_empty += 1
                    continue
                if not email or email.lower() in ['nan', 'none', '']:
                    skipped_empty += 1
                    continue
                
                # Validate email format (basic check)
                if '@' not in email:
                    skipped_empty += 1
                    continue
                
                # Check if email already exists
                existing = db.query(HRContact).filter(HRContact.email == email).first()
                if existing:
                    if append_mode:
                        # In append mode, skip duplicates (don't update, just skip)
                        skipped_duplicates += 1
                        continue
                    else:
                        # In replace mode (shouldn't happen if replace_mode deleted all), update existing
                        existing.name = name
                        existing.company = company
                        existing.email_status = email_status
                        existing.draft_status = draft_status
                        updated_contacts.append(existing)
                        skipped_duplicates += 1
                        continue
                
                contact = HRContact(
                    name=name,
                    company=company,
                    email=email,
                    email_status=email_status,
                    draft_status=draft_status,
                )
                db.add(contact)
                created_contacts.append(contact)
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
                continue
        
        # Commit all changes
        try:
            db.commit()
            for contact in created_contacts:
                db.refresh(contact)
            for contact in updated_contacts:
                db.refresh(contact)
        except Exception as e:
            db.rollback()
            raise ValueError(f"Failed to save contacts: {str(e)}")
        
        # Return meaningful message
        if not created_contacts and not updated_contacts:
            error_msg = f"No valid contacts found in file. "
            if skipped_empty > 0:
                error_msg += f"Skipped {skipped_empty} row(s) due to missing required data. "
            if skipped_duplicates > 0:
                error_msg += f"Found {skipped_duplicates} duplicate(s) (already exist in database). "
            if errors:
                error_msg += f"Errors: {'; '.join(errors[:3])}. "
            available_cols = ', '.join(df.columns.tolist())
            error_msg += f"Found columns: {available_cols}. Required: name, company, email. Optional: email_status, draft_status."
            raise ValueError(error_msg)
        
        # If only duplicates were found, that's okay - they were updated
        if not created_contacts and updated_contacts:
            return updated_contacts
        
        return created_contacts

    @staticmethod
    def import_students_from_file(db: Session, file_bytes: bytes, filename: str, replace_mode: bool = True, append_mode: bool = False) -> List[Student]:
        """Import students from CSV or Excel file."""
        try:
            df = CSVService._read_file_to_dataframe(file_bytes, filename)
        except Exception as e:
            raise ValueError(f"Failed to read file: {str(e)}")
        
        if df.empty:
            raise ValueError("File is empty or could not be read.")
        
        # Normalize column names (case-insensitive, strip whitespace, replace spaces/underscores)
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace('-', '_')
        
        # Drop completely empty rows
        df = df.dropna(how='all')
        
        # Find columns with flexible matching
        roll_no_col = CSVService._find_column(df, ['roll_no', 'rollno', 'roll_number', 'roll', 'id', 'student_id', 'reg_no', 'registration_no'])
        name_col = CSVService._find_column(df, ['name', 'student_name', 'full_name', 'student'])
        dept_col = CSVService._find_column(df, ['department', 'dept', 'branch', 'program'])
        domain_col = CSVService._find_column(df, ['domain', 'specialization', 'field', 'area'])
        cgpa_col = CSVService._find_column(df, ['cgpa', 'gpa', 'cgpa_score', 'grade'])
        ps_level_col = CSVService._find_column(df, ['ps_level', 'pslevel', 'programming_skill', 'skill_level', 'level', 'skills', 'skill_text', 'skills_text', 'raw_skills'])
        
        # Pre-detect specific skills columns for priority mapping
        skills_match_cols = ['skills', 'skills_text', 'raw_skills', 'ps_skills', 'programming_skills', 'skill_text']
        level_match_cols = ['ps_level', 'pslevel', 'ps_score', 'programming_skill', 'skill_level', 'level']
        skills_col = CSVService._find_column(df, skills_match_cols)
        level_col = CSVService._find_column(df, level_match_cols)
        
        # Check required columns
        if not roll_no_col:
            available_cols = ', '.join(df.columns.tolist())
            raise ValueError(f"Could not find roll number column. Available columns: {available_cols}. Please ensure your file has a column for student roll number (e.g., 'roll_no', 'rollno', 'roll_number', 'id').")
        if not name_col:
            available_cols = ', '.join(df.columns.tolist())
            raise ValueError(f"Could not find name column. Available columns: {available_cols}. Please ensure your file has a column for student name.")
        if not dept_col:
            available_cols = ', '.join(df.columns.tolist())
            raise ValueError(f"Could not find department column. Available columns: {available_cols}. Please ensure your file has a department/branch column.")
        if not domain_col:
            # Domain is optional, use a default
            domain_col = None
        
        # Deletion moved to end of loop to ensure transaction safety
        
        parsed_data = []
        errors = []
        skipped_empty = 0
        
        for idx, row in df.iterrows():
            try:
                # Get values with fallbacks and normalize
                roll_no = str(row[roll_no_col]).strip() if pd.notna(row[roll_no_col]) else ""
                name = str(row[name_col]).strip() if pd.notna(row[name_col]) else ""
                department = str(row[dept_col]).strip() if pd.notna(row[dept_col]) else ""
                domain = str(row[domain_col]).strip() if domain_col and pd.notna(row[domain_col]) else ""
                
                # Skip if essential fields are empty
                if not roll_no or roll_no.lower() in ['nan', 'none', '']:
                    skipped_empty += 1
                    continue
                if not name or name.lower() in ['nan', 'none', '']:
                    skipped_empty += 1
                    continue
                if not department or department.lower() in ['nan', 'none', '']:
                    skipped_empty += 1
                    continue
                
                # Normalize department and domain
                department = department.strip().upper()
                domain = domain.strip() if domain and domain.lower() not in ['nan', 'none', ''] else "General"
                
                # Parse numeric fields
                try:
                    cgpa = float(row[cgpa_col]) if cgpa_col and pd.notna(row[cgpa_col]) else 0.0
                except (ValueError, TypeError):
                    cgpa = 0.0
                
                # Category-aware skills parsing
                is_software = department.upper() in {'CSE', 'IT', 'CSBS', 'AIDS', 'AIML'}
                ps_level = 0.0
                skills_text = ""
                
                try:
                    target_col = None
                    if skills_col and pd.notna(row[skills_col]):
                        target_col = skills_col
                    elif level_col and pd.notna(row[level_col]):
                        target_col = level_col
                    elif ps_level_col and pd.notna(row[ps_level_col]):
                        target_col = ps_level_col
                        
                    if target_col:
                        ps_level, skills_text = CSVService._calculate_weighted_ps_score(row[target_col], is_software=is_software)
                except:
                    pass
                
                parsed_data.append({
                    "roll_no": roll_no,
                    "name": name,
                    "department": department,
                    "domain": domain,
                    "cgpa": cgpa,
                    "ps_level": ps_level,
                    "skills_text": skills_text,
                    "import_order": idx
                })
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
        
        if not parsed_data:
            error_msg = f"No valid students found. "
            if errors: error_msg += f"Errors: {'; '.join(errors[:3])}"
            raise ValueError(error_msg)

        # Database modification phase
        processed_students = []
        try:
            if replace_mode:
                db.query(Student).delete()
                # Use bulk save or individual adds
                for data in parsed_data:
                    student = Student(**data)
                    db.add(student)
                    processed_students.append(student)
            else:
                for data in parsed_data:
                    existing = db.query(Student).filter(Student.roll_no == data["roll_no"]).first()
                    if existing:
                        if append_mode: continue
                        for key, value in data.items():
                            setattr(existing, key, value)
                        processed_students.append(existing)
                    else:
                        student = Student(**data)
                        db.add(student)
                        processed_students.append(student)
            
            db.commit()
            for s in processed_students:
                db.refresh(s)
            return processed_students
        except Exception as e:
            db.rollback()
            raise ValueError(f"Failed to save students: {str(e)}")

    @staticmethod
    def export_students_to_excel(db: Session) -> bytes:
        """Export all students to Excel format."""
        students = db.query(Student).all()
        
        data = []
        for student in students:
            data.append({
                'roll_no': student.roll_no,
                'name': student.name,
                'department': student.department,
                'domain': student.domain,
                'cgpa': student.cgpa,
                'cgpa': student.cgpa,
                'ps_level': student.ps_level,
                'skills_text': student.skills_text
            })
        
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Students')
        output.seek(0)
        return output.getvalue()
    
    @staticmethod
    def export_students_to_csv(db: Session) -> bytes:
        """Export all students to CSV format."""
        students = db.query(Student).all()
        
        data = []
        for student in students:
            data.append({
                'roll_no': student.roll_no,
                'name': student.name,
                'department': student.department,
                'domain': student.domain,
                'cgpa': student.cgpa,
                'cgpa': student.cgpa,
                'ps_level': student.ps_level,
                'skills_text': student.skills_text
            })
        
        df = pd.DataFrame(data)
        output = StringIO()
        df.to_csv(output, index=False)
        return output.getvalue().encode('utf-8')
    
    @staticmethod
    def export_hr_contacts_to_excel(db: Session) -> bytes:
        """Export all HR contacts to Excel format."""
        contacts = db.query(HRContact).all()
        
        data = []
        for contact in contacts:
            data.append({
                'name': contact.name,
                'company': contact.company,
                'email': contact.email,
                'email_status': contact.email_status or '',
                'draft_status': contact.draft_status or ''
            })
        
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='HR Contacts')
        output.seek(0)
        return output.getvalue()
    
    @staticmethod
    def export_hr_contacts_to_csv(db: Session) -> bytes:
        """Export all HR contacts to CSV format."""
        contacts = db.query(HRContact).all()
        
        data = []
        for contact in contacts:
            data.append({
                'name': contact.name,
                'company': contact.company,
                'email': contact.email,
                'email_status': contact.email_status or '',
                'draft_status': contact.draft_status or ''
            })
        
        df = pd.DataFrame(data)
        output = StringIO()
        df.to_csv(output, index=False)
        return output.getvalue().encode('utf-8')