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
        Generate email content using AI and a template
        
        Args:
            template_id: ID of the template to use
            context_data: Dictionary with context variables (company_name, total_students, etc.)
            model: Ollama model to use (defaults to settings.OLLAMA_MODEL)
            
        Returns:
            Dictionary with 'subject' and 'body' keys
        """
        if template_id not in EmailTemplateService.TEMPLATES:
            raise ValueError(f"Template '{template_id}' not found")
        
        template = EmailTemplateService.TEMPLATES[template_id]
        
        # Format the system prompt with context data
        try:
            formatted_prompt = template["system_prompt"].format(**context_data)
        except KeyError as e:
            raise ValueError(f"Missing required context data: {e}")
        
        # Call Ollama API
        model_name = model or settings.OLLAMA_MODEL
        ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        
        payload = {
            "model": model_name,
            "prompt": formatted_prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 500
            }
        }
        
        try:
            response = requests.post(ollama_url, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            email_body = result.get("response", "").strip()
            
            # Generate subject based on template
            subject = EmailTemplateService._generate_subject(template_id, context_data)
            
            return {
                "subject": subject,
                "body": email_body,
                "template_used": template_id
            }
            
        except requests.RequestException as e:
            raise Exception(f"Failed to generate email with Ollama: {str(e)}")
    
    @staticmethod
    def _generate_subject(template_id: str, context: Dict[str, Any]) -> str:
        """Generate appropriate subject line based on template"""
        subjects = {
            "final_year_students": f"Placement Opportunity - Final Year Students from {context.get('college_name', 'Our College')}",
            "internship_opportunities": f"Summer Internship Collaboration - {context.get('college_name', 'Our College')}"
        }
        return subjects.get(template_id, "Placement Coordination")
