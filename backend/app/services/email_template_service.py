"""
Email Template Service
Handles AI-driven email generation using predefined templates and Ollama
"""
import requests
from typing import Dict, Any
from app.core.config import settings


class EmailTemplateService:
    """Service for generating AI-driven email drafts using templates"""
    
    TEMPLATES = {
        "final_year_students": {
            "name": "Final Year Students - Placement Drive",
            "description": "Introduce final year students for placement opportunities",
            "system_prompt": """You are a professional placement coordinator writing an email to an HR manager.

Context:
- Total Students: {total_students}
- Departments: {departments}
- Top Skills: {top_skills}
- Company: {company_name}
- HR Name: {hr_name}

Task: Write a professional email introducing our final year students for placement opportunities. 
Highlight key strengths, diversity of skills, and express interest in collaboration.

Requirements:
- Professional and enthusiastic tone
- Concise (200-250 words)
- Include specific numbers and skills
- End with a clear call-to-action
- Use proper email format (greeting, body, closing)

Generate ONLY the email body. Do not include subject line or metadata."""
        },
        
        "internship_opportunities": {
            "name": "Internship Opportunities",
            "description": "Request internship opportunities for pre-final year students",
            "system_prompt": """You are a placement coordinator seeking internship opportunities for students.

Context:
- Pre-final year students: {student_count}
- Key domains: {domains}
- Top skills: {top_skills}
- Available period: Summer 2024 (May - July)
- Company: {company_name}
- HR Name: {hr_name}

Task: Write an email requesting internship opportunities. Emphasize student readiness, 
skill alignment with the company's domain, and mutual benefits.

Requirements:
- Professional and collaborative tone
- Brief (150-200 words)
- Highlight specific technical skills
- Mention internship duration
- End with next steps
- Use proper email format (greeting, body, closing)

Generate ONLY the email body. Do not include subject line or metadata."""
        }
    }
    
    @staticmethod
    def get_available_templates() -> list[Dict[str, str]]:
        """Get list of available email templates"""
        return [
            {
                "id": template_id,
                "name": template_data["name"],
                "description": template_data["description"]
            }
            for template_id, template_data in EmailTemplateService.TEMPLATES.items()
        ]
    
    @staticmethod
    def generate_email_from_template(
        template_id: str,
        context_data: Dict[str, Any],
        model: str = None
    ) -> Dict[str, str]:
        """
        Generate email content using predefined templates
        
        Args:
            template_id: ID of the template to use
            context_data: Dictionary with context variables (company_name, hr_name, etc.)
            model: Not used anymore (kept for backward compatibility)
            
        Returns:
            Dictionary with 'subject' and 'body' keys
        """
        if template_id not in EmailTemplateService.TEMPLATES:
            raise ValueError(f"Template '{template_id}' not found")
        
        # Get company name and HR name from context
        company_name = context_data.get('company_name', 'your organization')
        hr_name = context_data.get('hr_name', 'Sir/Madam')
        
        # Define static email bodies with proper HTML formatting
        email_bodies = {
            "final_year_students": f"""<p>Dear {hr_name},</p>

<p>Greetings from the Placement Cell!</p>

<p>We are pleased to introduce our final year students for placement opportunities at {company_name}. Our students demonstrate exceptional academic performance and technical proficiency.</p>

<p>We would appreciate receiving your detailed job requirements to ensure precise candidate matching. This will enable us to shortlist the most suitable candidates for your consideration.</p>

<p><strong>Next Steps:</strong></p>
<ol>
<li>Share job description and requirements</li>
<li>We provide student profiles within 48 hours</li>
<li>Coordinate interview schedules as per your convenience</li>
</ol>

<p>Looking forward to a successful collaboration.</p>

<p>Best regards,<br>
Placement Officer<br>
University Placement Cell</p>""",
            
            "internship_opportunities": f"""<p>Dear {hr_name},</p>

<p>We hope this email finds you well.</p>

<p>We are writing to explore internship opportunities at {company_name} for our pre-final year students. Our students are eager to gain practical experience and contribute to your organization.</p>

<p>We would be grateful if you could share details about available internship positions and the application process.</p>

<p>Thank you for your time and consideration.</p>

<p>Best regards,<br>
Placement Officer<br>
University Placement Cell</p>"""
        }
        
        # Get the email body for this template
        email_body = email_bodies.get(template_id, "")
        
        # Generate subject based on template
        subject = EmailTemplateService._generate_subject(template_id, context_data)
        
        return {
            "subject": subject,
            "body": email_body,
            "template_used": template_id
        }
    
    @staticmethod
    def _generate_subject(template_id: str, context: Dict[str, Any]) -> str:
        """Generate appropriate subject line based on template"""
        company_name = context.get('company_name', 'Placement Opportunity')
        subjects = {
            "final_year_students": f"Placement Opportunity - Final Year Students",
            "internship_opportunities": f"Internship Collaboration Opportunity"
        }
        return subjects.get(template_id, "Placement Coordination")
