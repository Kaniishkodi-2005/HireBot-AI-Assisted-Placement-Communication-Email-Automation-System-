"""
AI Service for HR reply processing and student matching using Phi-3-Mini-4K-Instruct
"""
import os
import re
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL
OLLAMA_MODEL = settings.OLLAMA_MODEL


class AIService:
    """Service for AI-powered HR reply processing using microsoft/phi-3-mini-4k-instruct"""
    
    SYSTEM_PROMPT = """You are HireBot, an AI assistant for college placement officers.
You help draft professional HR emails and extract recruitment requirements.

Rules:
- Use formal, HR-safe, grammatically correct language
- Keep responses concise (2-3 paragraphs maximum)
- Never send emails directly - always require human confirmation
- Extract dates and commitments accurately
- Maintain college privacy - no external data transmission
- Be polite, professional, and helpful"""

    @staticmethod
    def extract_intent(hr_message: str, company: Optional[str] = None) -> Dict:
        """
        Extract structured intent from HR message using Phi-3
        Returns: role, skills, positions, dates, commitments, actions
        """
        print(f"\n{'='*60}")
        print(f"INTENT EXTRACTION STARTED")
        print(f"Company: {company}")
        print(f"Message: {hr_message[:150]}...")
        print(f"{'='*60}\n")
        
        if OLLAMA_AVAILABLE:
            try:
                prompt = f"""{AIService.SYSTEM_PROMPT}

Extract structured information from this HR message and return ONLY a valid JSON object.

HR Message:
\"\"\"
{hr_message}
\"\"\"

Company: {company or 'Unknown'}

Extract and return JSON with these fields:
{{
  "role": "job title or null",
  "skills": ["skill1", "skill2"] or [],
  "positions_count": number or null,
  "deadline": "date string or null",
  "visit_date": "date string (use 'Upcoming' if mentioned without specific date) or null",
  "commitments": ["commitment1"] or [],
  "action_items": ["action1"] or [],
  "urgency": "low" or "medium" or "high"
}}

Return ONLY the JSON object, no other text."""

                print(f"Calling Ollama {OLLAMA_MODEL} for intent extraction...")
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    options={
                        "temperature": 0.1,  # Very low for structured extraction
                        "num_predict": 300
                    }
                )
                
                result_text = response['message']['content'].strip()
                print(f"Raw AI response: {result_text[:200]}...")
                
                # Extract JSON from response
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    try:
                        json_str = AIService._clean_json_text(json_match.group())
                        intent_data = json.loads(json_str)
                        print(f"[SUCCESS] Extracted intent: {intent_data}")
                        return intent_data
                    except json.JSONDecodeError as je:
                        print(f"[WARNING] JSON decode error: {je}. Raw: {json_match.group()}")
                else:
                    print("[WARNING] No JSON found in response, using fallback")
                    
            except Exception as e:
                print(f"[ERROR] Intent extraction failed: {type(e).__name__}: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # Fallback: Rule-based extraction
        return AIService._fallback_intent_extraction(hr_message)

    @staticmethod
    def _clean_json_text(text: str) -> str:
        """Clean JSON text from common LLM errors"""
        # Replace single quotes with double quotes
        # This is a bit risky if text contains ' inside strings, but often needed for weak LLMs
        # Better approach: use a regex to replace keys 'key': with "key":
        text = re.sub(r"'([^']*)'\s*:", r'"\1":', text)
        
        # Remove trailing commas before } or ]
        text = re.sub(r',(\s*[}\]])', r'\1', text)
        
        return text
        

    
    @staticmethod
    def _fallback_intent_extraction(hr_message: str) -> Dict:
        """Fallback rule-based intent extraction"""
        print("[INFO] Using fallback intent extraction")
        
        hr_lower = hr_message.lower()
        
        # Extract skills
        skills_keywords = ['python', 'java', 'javascript', 'react', 'node', 'ai', 'ml', 
                          'machine learning', 'data science', 'web', 'mobile', 'android', 
                          'ios', 'cloud', 'aws', 'azure', 'devops', 'testing', 'qa', 'full stack',
                          'embedded', 'embedded systems', 'embedded domain', 'microcontroller', 
                          'iot', 'internet of things', 'hardware', 'firmware', 'arduino', 
                          'raspberry pi', 'arm', 'cortex', 'rtos', 'real time', 'sensor', 'actuator']
        
        # Use regex word boundaries to avoid matching substrings like 'ai' in 'email'
        skills_mapping = {
            'embedded': 'EMBEDDED SYSTEMS',
            'embedded systems': 'EMBEDDED SYSTEMS',
            'embedded domain': 'EMBEDDED SYSTEMS',
            'microcontroller': 'MICROCONTROLLER PROGRAMMING',
            'iot': 'INTERNET OF THINGS (IoT)',
            'internet of things': 'INTERNET OF THINGS (IoT)',
            'hardware': 'HARDWARE PROGRAMMING',
            'firmware': 'FIRMWARE DEVELOPMENT',
            'arduino': 'ARDUINO PROGRAMMING',
            'raspberry pi': 'RASPBERRY PI',
            'arm': 'ARM MICROCONTROLLERS',
            'cortex': 'ARM CORTEX',
            'rtos': 'REAL-TIME OPERATING SYSTEMS',
            'real time': 'REAL-TIME SYSTEMS',
            'sensor': 'SENSOR INTERFACING',
            'actuator': 'ACTUATOR CONTROL',
            'python': 'PYTHON',
            'java': 'JAVA',
            'javascript': 'JAVASCRIPT',
            'react': 'REACT.JS',
            'node': 'NODE.JS',
            'ai': 'ARTIFICIAL INTELLIGENCE',
            'ml': 'MACHINE LEARNING',
            'machine learning': 'MACHINE LEARNING',
            'data science': 'DATA SCIENCE',
            'ds': 'DATA SCIENCE',
            'web': 'WEB DEVELOPMENT',
            'mobile': 'MOBILE APP DEVELOPMENT',
            'android': 'ANDROID DEVELOPMENT',
            'ios': 'IOS DEVELOPMENT',
            'cloud': 'CLOUD COMPUTING',
            'aws': 'AMAZON WEB SERVICES (AWS)',
            'azure': 'MICROSOFT AZURE',
            'devops': 'DEVOPS',
            'testing': 'SOFTWARE TESTING',
            'qa': 'QUALITY ASSURANCE',
            'full stack': 'FULL STACK DEVELOPMENT',
            'cyber': 'CYBER SECURITY',
            'ui/ux': 'UI/UX DESIGN'
        }
        
        skills = []
        for keyword, display_name in skills_mapping.items():
            if re.search(r'\b' + re.escape(keyword) + r'\b', hr_lower):
                if display_name not in skills:
                    skills.append(display_name)
        
        # Extract count - support digits and words
        word_to_num = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
        }
        
        # Check for digits first
        count_match = re.search(r'(?:hire|need|requirement)\s*(?:about|around)?\s*(\d+)', hr_message, re.IGNORECASE)
        if not count_match:
            count_match = re.search(r'(\d+)\s*(?:students?|candidates?|profiles?|members?)', hr_message, re.IGNORECASE)
        positions_count = int(count_match.group(1)) if count_match else None
        
        # If no digits, check for words
        if not positions_count:
            for word, num in word_to_num.items():
                # Allow up to 30 characters (approx 4-5 words) between number and 'students'
                # e.g., "three top performing students", "five good candidates"
                if re.search(r'\b' + word + r'\b.{1,30}?(?:students?|candidates?|profiles?)', hr_lower):
                    positions_count = num
                    break
        
        # Extract dates
        visit_date = AIService._extract_date(hr_message)
        
        # Detect urgency
        urgency = "high" if any(word in hr_lower for word in ['urgent', 'asap', 'immediately']) else "medium"
        
        # Detect commitments
        commitments = []
        if 'will visit' in hr_lower or 'planning to visit' in hr_lower or 'visiting' in hr_lower or 'visit shortly' in hr_lower:
            commitments.append("Campus visit planned")
            if not visit_date:
                visit_date = "Upcoming"
        if 'will schedule' in hr_lower or 'will arrange' in hr_lower or 'reach out' in hr_lower:
            commitments.append("Follow-up communication")
        
        return {
            "role": None,
            "skills": skills,
            "positions_count": positions_count,
            "deadline": None,
            "visit_date": visit_date,
            "commitments": commitments,
            "action_items": [],
            "urgency": urgency
        }
    
    @staticmethod
    def _extract_date(text: str) -> Optional[str]:
        """Extract date from text"""
        current_year = datetime.now().year
        
        date_patterns = [
            # DD/MM/YYYY or DD-MM-YYYY
            r'(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})',
            # DD Month YYYY (22 January 2026)
            r'(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})',
            # DD Month (22 January) - assume current year
            r'(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*',
            # Fuzzy: "first week of February" -> returns "First Week of February 2026"
            r'(first|second|third|fourth|last|next)\s+week\s+of\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*',
        ]
        
        for i, pattern in enumerate(date_patterns):
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    groups = match.groups()
                    
                    # Handle fuzzy date (pattern index 3)
                    if i == 3:
                        week_desc = groups[0].capitalize()
                        month_name = groups[1].capitalize()
                        # Return "First Week of February 2026"
                        return f"{week_desc} Week of {month_name} {current_year}"
                    
                    day = groups[0].zfill(2)
                    
                    # Determine month
                    if groups[1].isdigit():
                         month = groups[1].zfill(2)
                    else:
                        months = {'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 
                                 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 
                                 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'}
                        month = months.get(groups[1][:3].lower(), '01')
                    
                    # Determine year
                    year = groups[2] if len(groups) > 2 else str(current_year)
                    
                    return f"{day}.{month}.{year}"
                except:
                    pass
        
        # Check for relative dates - FIXED CALCULATION
        if 'tomorrow' in text.lower():
            tomorrow = datetime.now() + timedelta(days=1)
            return tomorrow.strftime("%d.%m.%Y")
        elif 'next week' in text.lower():
            next_week = datetime.now() + timedelta(days=7)
            return next_week.strftime("%d.%m.%Y")
        elif 'next month' in text.lower():
            next_month = datetime.now() + timedelta(days=30)
            return next_month.strftime("%d.%m.%Y")
        elif any(phrase in text.lower() for phrase in ['today', 'this evening', 'tonight']):
            today = datetime.now()
            return today.strftime("%d.%m.%Y")
        
        return None
    
    @staticmethod
    def classify_message(hr_message: str) -> Dict:
        """
        Classify HR message type and sentiment
        Returns: category, sentiment, urgency, confidence, requesting_students
        """
        hr_lower = hr_message.lower()
        
        # Quick rule-based check for student requests
        # Avoid false positives for acknowledgments like "will connect" or "thanks"
        acknowledgment_phrases = ['will connect', 'get back', 'touch base', 'thank you', 'thanks', 'appreciate']
        is_acknowledgment = any(phrase in hr_lower for phrase in acknowledgment_phrases)
        
        print(f"\n[CLASSIFY] HR Message: {hr_message[:100]}...")
        print(f"[CLASSIFY] Is acknowledgment: {is_acknowledgment}")
        
        # Remove early return for acknowledgments - always check for student requests
        # if not is_acknowledgment:
        
        checks = {
            'explicit_request': any(word in hr_lower for word in ['send', 'share', 'provide', 'list', 'namelist', 'name list', 'profiles', 'resumes']),
            'student+action': 'student' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'provide', 'list', 'namelist']),
            'profile+action': 'profile' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'provide', 'need', 'require']),
            'candidate+action': 'candidate' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'list']),
            'resume+action': 'resume' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'provide'])
        }
        
        requesting_students = any(checks.values())
        
        print(f"[CLASSIFY] Detection checks:")
        for check_name, result in checks.items():
            if result:
                print(f"  + {check_name}: TRUE")
        
        print(f"[CLASSIFY] Final requesting_students: {requesting_students}")
        
        if OLLAMA_AVAILABLE:
            try:
                prompt = f"""{AIService.SYSTEM_PROMPT}

Classify this HR email into ONE category and return ONLY a JSON object.

HR Message:
\"\"\"
{hr_message}
\"\"\"

Categories:
- positive: Interested, wants to schedule, asking for resumes
- need_info: Asking questions about college/students/process
- not_interested: Declining, no openings
- neutral: Auto-reply, acknowledgment

Return ONLY this JSON:
{{
  "category": "positive|need_info|not_interested|neutral",
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "confidence": 0.0-1.0
}}"""

                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0.1, "num_predict": 100}
                )
                
                result_text = response['message']['content'].strip()
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                
                if json_match:
                    classification = json.loads(json_match.group())
                    classification['requesting_students'] = requesting_students
                    return classification
                    
            except Exception as e:
                print(f"[ERROR] Classification failed: {str(e)}")
        
        # Fallback classification
        if 'not interested' in hr_lower or 'no opening' in hr_lower:
            category = "not_interested"
            sentiment = "negative"
        elif any(word in hr_lower for word in ['interested', 'schedule', 'resume', 'profile']):
            category = "positive"
            sentiment = "positive"
        elif '?' in hr_message or 'question' in hr_lower:
            category = "need_info"
            sentiment = "neutral"
        else:
            category = "neutral"
            sentiment = "neutral"
        
        return {
            "category": category,
            "sentiment": sentiment,
            "urgency": "medium",
            "confidence": 0.7,
            "requesting_students": requesting_students
        }
    
    @staticmethod
    def _extract_latest_message(email_content: str) -> str:
        """
        Extract only the latest message from an email thread.
        Removes quoted replies (lines starting with >, or content after 'On ... wrote:')
        """
        if not email_content:
            return ""

        # Normalize line endings
        content = email_content.replace('\r\n', '\n').replace('\r', '\n')
        lines = content.split('\n')
        clean_lines = []
        
        # Regex patterns for thread separators
        separator_patterns = [
            r'^\s*On\s+.*wrote:\s*$',  # Gmail style: On Mon, Jan 1... wrote:
            r'^\s*From:\s+.*$',        # Outlook/Standard: From: Sender Name
            r'^\s*-{3,}\s?Original Message\s?-{3,}\s*$', # -----Original Message-----
            r'^\s*________________________________\s*$'   # Underscore separator
        ]
        
        for line in lines:
            # Check for thread separators
            is_separator = False
            for pattern in separator_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    is_separator = True
                    break
            
            if is_separator:
                break  # Stop processing at the first sign of a thread history
            
            # Skip quoted lines (common in replies)
            if line.strip().startswith('>'):
                continue
                
            clean_lines.append(line)
        
        # Rejoin and strip
        return '\n'.join(clean_lines).strip()
    
    @staticmethod
    def generate_draft_reply(hr_message: str, company: str, contact_name: Optional[str] = None, students_data: Optional[List[Dict]] = None) -> Dict:
        """
        Generate AI-powered draft email reply
        Returns: subject, body, extracted_intent, suggested_students, follow_up_actions
        """
        print(f"\n[MAIN DEBUG] generate_draft_reply called - UPDATED")
        print(f"[MAIN DEBUG] Company: {company}")
        print(f"[MAIN DEBUG] Contact: {contact_name}")
        print(f"[MAIN DEBUG] Students data: {len(students_data) if students_data else 0}")
        print(f"[MAIN DEBUG] HR message length: {len(hr_message)}")
        
        # Extract only the latest message from the thread
        clean_message = AIService._extract_latest_message(hr_message)
        print(f"[MAIN DEBUG] Clean message length: {len(clean_message)}")
        print(f"[MAIN DEBUG] Clean message preview: '{clean_message[:200]}...'")
        
        # Extract student requirements from the message
        from app.utils.student_requirements import extract_student_requirements
        student_requirements = extract_student_requirements(clean_message)
        
        print(f"\n{'='*60}")
        print(f"DRAFT GENERATION STARTED")
        print(f"Company: {company}")
        print(f"Original message length: {len(hr_message)} chars")
        print(f"Cleaned message length: {len(clean_message)} chars")
        print(f"Cleaned message: {clean_message[:150]}...")
        print(f"Student requirements extracted: {student_requirements}")
        print(f"{'='*60}\n")
        
        # Extract intent first - use cleaned message
        intent = AIService.extract_intent(clean_message, company)
        classification = AIService.classify_message(clean_message)
        
        requesting_students = classification.get('requesting_students', False)
        
        print(f"\n[DRAFT] Classification result: {classification}")
        print(f"[DRAFT] Requesting students: {requesting_students}")
        print(f"[DRAFT] Students data provided: {len(students_data) if students_data else 0} students\n")
        
        # Generate draft
        draft_body = ""
        
        # Intelligently decide whether to include students based on HR message content
        # Only include students if HR is actually requesting them AND we have student data
        should_include_students = requesting_students and students_data and len(students_data) > 0
        
        if OLLAMA_AVAILABLE:
            try:
                if should_include_students:
                    # Generate intro for student list
                    req_count = student_requirements.get('count')
                    actual_count = len(students_data)
                    domain = student_requirements.get('domain', 'requested')
                    
                    # 1. Prepare context for Intro
                    # Check if we're showing students from a different domain due to lack of exact matches
                    domain_mismatch = False
                    if domain and domain.lower() in ['ai', 'artificial intelligence']:
                        # Check if any of the returned students actually have AI domain
                        ai_students = [s for s in students_data if 'ai' in s.get('domain', '').lower() or 'artificial intelligence' in s.get('domain', '').lower()]
                        if len(ai_students) == 0:
                            domain_mismatch = True
                    
                    shortfall_context = ""
                    if domain_mismatch:
                        shortfall_context = f"""
IMPORTANT: The HR requested {req_count or 'several'} {domain} students, but we don't have students specifically in the {domain} domain.
You MUST acknowledge this and explain that we're providing the closest match available.
REQUIRED PHRASING: "Thank you for your interest in our students. While we don't currently have students specifically in the {domain} domain, we have identified {actual_count} students with relevant technical skills who could be suitable for {domain}-related roles. The details are shared below:"
"""
                    elif req_count and actual_count < req_count:
                        shortfall_context = f"""
IMPORTANT: The HR requested {req_count} students, but we only have {actual_count} suitable candidates.
You MUST explicitly state this in the intro.
REQUIRED PHRASING: "Thank you for your interest in our students. Currently, we have {actual_count} students matching your requirements for the {domain} domain. The details are shared below:"
"""
                    else:
                        shortfall_context = f"""
Standard Intro: "Thank you for your interest in our students. Based on your requirements, here are {actual_count} suitable candidates:"
"""

                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email introduction (1 short paragraph) responding to this HR request.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}

{shortfall_context}

Write ONLY the intro paragraph.
Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with the sentence introducing the list (e.g., "The details are shared below:").
Do NOT include a signature.
"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={
                            "temperature": settings.OLLAMA_TEMPERATURE,
                            "num_predict": settings.OLLAMA_MAX_TOKENS
                        }
                    )
                    
                    intro = response['message']['content'].strip()
                    
                    # Build student list
                    student_list = []
                    for s in students_data[:20]:
                        skills = s.get('skills_text', 'N/A')
                        if skills and len(skills) > 50:
                            skills = skills[:50] + '...'
                        student_list.append(
                            f"• {s.get('name', 'N/A')} - {s.get('department', 'N/A')} (Roll: {s.get('roll_no', 'N/A')})\n"
                            f"  CGPA: {s.get('cgpa', 'N/A')} | Skills: {skills}"
                        )
                    
                    student_section = "\n\n".join(student_list)
                    
                    # 2. Select Closing Text based on count match
                    visit_acknowledgment = ""
                    if 'visit' in clean_message.lower() or 'campus' in clean_message.lower():
                        visit_acknowledgment = "We look forward to your campus visit and will ensure all necessary arrangements are made for a productive interaction with our students. "
                    
                    if req_count and actual_count < req_count:
                        closing_text = f"""{visit_acknowledgment}Currently, we have {actual_count} students matching your requirements for the {domain} domain. We will continue to identify additional suitable candidates and share their profiles as they become available.

Please let us know your preferred next steps.

Best regards,
Placement Team"""
                    else:
                        closing_text = f"""{visit_acknowledgment}These students have demonstrated strong academic performance and relevant skills in your required domain.

Please let us know your preferred next steps.

Best regards,
Placement Team"""
                    
                    draft_body = f"""{intro}

{student_section}

{closing_text}"""
                    
                else:
                    # Generate full response for non-student requests
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR message.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}

Guidelines:
- If they CONFIRM a visit date, acknowledge it warmly and express excitement
- If they mention "confirm" or "scheduled visit", respond with preparation details
- If they say "will connect" or "thanks", write a SHORT acknowledgment (2-3 sentences)
- If they mention a visit date, acknowledge it warmly
- Be natural and professional
- Keep it concise

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={
                            "temperature": settings.OLLAMA_TEMPERATURE,
                            "num_predict": settings.OLLAMA_MAX_TOKENS
                        }
                    )
                    
                    draft_body = response['message']['content'].strip()
                
                print(f"[SUCCESS] AI generated draft ({len(draft_body)} chars)")
                
            except Exception as e:
                print(f"[ERROR] Draft generation failed: {str(e)}")
                import traceback
                traceback.print_exc()
                draft_body = AIService._fallback_draft(clean_message, company, should_include_students, students_data, contact_name)
        else:
            draft_body = AIService._fallback_draft(clean_message, company, should_include_students, students_data, contact_name)
        
        # Add confirmation header - REMOVED AS REQUESTED
        # draft_with_header = f"""[DRAFT EMAIL — REQUIRES CONFIRMATION]\n\n{draft_body}"""
        
        draft_with_header = draft_body
        
        # Generate follow-up actions
        follow_up_actions = []
        if intent.get('visit_date') and ('Campus visit planned' in intent.get('commitments', []) or any(k in clean_message.lower() for k in ['visit', 'schedule', 'campus', 'interview'])):
            # Extract requirements for meaningful reminder description
            from app.utils.student_requirements import extract_student_requirements
            requirements = extract_student_requirements(clean_message)
            
            # Build description based on requirements
            description_parts = []
            
            if requirements.get('domain'):
                description_parts.append(f"{requirements['domain']} Students")
            elif requirements.get('skills'):
                description_parts.append(f"{requirements['skills'][0]} Role")
            
            if requirements.get('count'):
                if description_parts:
                    description_parts[0] = f"{requirements['count']} {description_parts[0]}"
                else:
                    description_parts.append(f"{requirements['count']} Positions")
            
            if not description_parts:
                role = intent.get('role')
                if role and role.lower() != 'none':
                    description_parts.append(f"{role} Role")
                else:
                    description_parts.append("Placement Drive")
            
            purpose = " - ".join(description_parts)
            description = f"Campus Visit - {purpose}"
            
            follow_up_actions.append({
                "action_type": "reminder",
                "due_date": intent['visit_date'],
                "description": description,
                "priority": "high"
            })
        
        return {
            "subject": f"Re: Student Profiles - {company}",
            "content": draft_with_header,
            "requires_confirmation": True,
            "extracted_intent": intent,
            "suggested_students": students_data[:10] if students_data else [],
            "follow_up_actions": follow_up_actions,
            "student_requirements": student_requirements  # Add requirements for controller
        }
    
    @staticmethod
    def _fallback_draft(hr_message: str, company: str, requesting_students: bool, students_data: Optional[List[Dict]], contact_name: Optional[str] = None) -> str:
        """Fallback draft generation"""
        # Extract only the latest message from the thread
        clean_message = AIService._extract_latest_message(hr_message)
        
        print(f"\n[FALLBACK] Processing message: '{clean_message}'")
        print(f"[FALLBACK] Original length: {len(hr_message)}, Clean length: {len(clean_message)}")
        
        greeting = f"Dear {contact_name}," if contact_name else f"Dear {company} Team,"
        hr_lower = clean_message.lower()  # Use clean message for processing
        
        # Check for cancellation first (higher priority)
        cancellation_info = AIService.detect_cancellation(clean_message)
        if cancellation_info['is_cancelled']:
            if OLLAMA_AVAILABLE:
                try:
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR cancellation message.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Cancellation Reason: {cancellation_info.get('reason', 'unavoidable circumstances')}

Guidelines:
- Acknowledge the cancellation with understanding
- Express that you understand their situation
- Keep the door open for future opportunities
- Be professional and supportive
- Don't be overly disappointed, be understanding

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] Cancellation AI response failed: {str(e)}")
            
            # Fallback for cancellation
            return f"""{greeting}
 
 Thank you for informing us about the cancellation. We completely understand that unavoidable circumstances can arise.
 
 We appreciate you taking the time to notify us in advance. Please feel free to reach out whenever you would like to reschedule or discuss future placement opportunities.
 
 We look forward to collaborating with {company} in the future.
 
 Best regards,
 Placement Team"""
        
        elif requesting_students and students_data:
            student_list = []
            for s in students_data[:20]:
                skills = s.get('skills_text', 'N/A')
                if skills and len(skills) > 50:
                    skills = skills[:50] + '...'
                student_list.append(
                    f"• {s.get('name', 'N/A')} - {s.get('department', 'N/A')} (Roll: {s.get('roll_no', 'N/A')})\n"
                    f"  CGPA: {s.get('cgpa', 'N/A')} | Skills: {skills}"
                )
            
            student_section = "\n\n".join(student_list)
            
            # Check for campus visit mention
            visit_acknowledgment = ""
            if 'visit' in hr_message.lower() or 'campus' in hr_message.lower():
                visit_acknowledgment = "We look forward to your campus visit and will ensure all necessary arrangements are made for a productive interaction with our students. "
            
            return f"""{greeting}
 
 Thank you for your interest in our students. Currently, we have {len(students_data)} students matching your requirements. The details are shared below:
 
 {student_section}
 
 {visit_acknowledgment}These students have demonstrated strong academic performance and relevant skills in your required domain.
 
 Please let us know your preferred next steps.
 
 Best regards,
 Placement Team"""
        
        # Check if this is a student requirement message
        from app.utils.student_requirements import extract_student_requirements
        requirements = extract_student_requirements(clean_message)
        has_actual_requirements = requirements.get('has_requirements', False)
        
        # Detect visit announcements/confirmations first - be more flexible
        visit_keywords = ['visit', 'visiting', 'campus']
        visit_indicators = ['will', 'on', 'confirm', 'scheduled', 'planning', 'pleased to inform']
        
        has_visit_keyword = any(keyword in hr_lower for keyword in visit_keywords)
        has_visit_indicator = any(indicator in hr_lower for indicator in visit_indicators)
        is_visit_message = has_visit_keyword and has_visit_indicator
        
        print(f"\n[DEBUG] Processing message in _fallback_draft:")
        print(f"[DEBUG] OLLAMA_AVAILABLE: {OLLAMA_AVAILABLE}")
        print(f"[DEBUG] has_actual_requirements: {has_actual_requirements}")
        print(f"[DEBUG] is_visit_message: {is_visit_message}")
        print(f"[DEBUG] Clean message: '{clean_message}'")
        print(f"[DEBUG] HR lower contains 'visit': {'visit' in hr_lower}")
        print(f"[DEBUG] HR lower contains 'will': {'will' in hr_lower}")
        print(f"[DEBUG] HR lower: '{hr_lower[:100]}...'")
        
        if has_actual_requirements and is_visit_message:
            # Requirements + Visit scenario - use improved fallback
            if OLLAMA_AVAILABLE:
                try:
                    from app.utils.student_requirements import extract_student_requirements
                    requirements = extract_student_requirements(clean_message)
                    
                    req_count = requirements.get('count')
                    domain = requirements.get('domain')
                    visit_date = AIService._extract_date(clean_message)
                    
                    prompt = f"Write a professional email response acknowledging both their visit and student requirements. Thank them for the visit opportunity. Mention we have suitable candidates available. Express excitement about the visit. Ask for preferred timing. Keep it brief and professional. Start with 'Dear {contact_name or company + ' Team'},' and end with 'Best regards, Placement Team'"
                    
                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] Requirements+Visit AI failed: {str(e)}")
            
            # Direct fallback for requirements + visit
            from app.utils.student_requirements import extract_student_requirements
            requirements = extract_student_requirements(clean_message)
            req_count = requirements.get('count')
            domain = requirements.get('domain')
            visit_date = AIService._extract_date(clean_message)
            
            # Only mention domain if it's clearly specified in requirements
            if req_count and domain:
                req_text = f"{req_count} {domain} students"
                domain_text = f"in the {domain} domain"
            elif domain:
                req_text = f"{domain} students"
                domain_text = f"in the {domain} domain"
            elif req_count:
                req_text = f"{req_count} students"
                domain_text = "matching your requirements"
            else:
                req_text = "students"
                domain_text = "suitable for your needs"
            
            date_text = f" {visit_date}" if visit_date and 'tomorrow' in str(visit_date).lower() else ""
            
            return f"""{greeting}
 
 Thank you for informing us about your visit{date_text}. We are excited to welcome your team to our institution.
 
 Our placement team will ensure all necessary arrangements are made for a productive and engaging session. We look forward to showcasing our talented students and facilitating meaningful interactions.
 
 Please let us know your preferred date and time for the visit, and if you have any specific requirements.
 
 Best regards,
 Placement Team"""
            # Get available student count for this scenario
            available_count = "several"
            if students_data:
                available_count = str(len(students_data))
            
            # Use AI to generate response for requirement + visit scenario
            if OLLAMA_AVAILABLE:
                try:
                    from app.utils.student_requirements import extract_student_requirements
                    requirements = extract_student_requirements(hr_message)
                    
                    req_count = requirements.get('count')
                    domain = requirements.get('domain')
                    
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR message that mentions both student requirements and a campus visit.

HR Message:
\"\"\"
{hr_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Extracted Requirements: {req_count} {domain} students
Available Students: {available_count} suitable candidates

Guidelines:
- Acknowledge their requirement for students
- Mention how many suitable candidates you have available
- Express excitement about the campus visit
- Offer to share profiles if they want them beforehand
- Keep it professional and welcoming
- Don't automatically send student lists

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={
                            "temperature": settings.OLLAMA_TEMPERATURE,
                            "num_predict": settings.OLLAMA_MAX_TOKENS
                        }
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] AI response generation failed: {str(e)}")
            
            # Fallback: Use AI to generate simple response
            if OLLAMA_AVAILABLE:
                try:
                    from app.utils.student_requirements import extract_student_requirements
                    requirements = extract_student_requirements(hr_message)
                    
                    req_count = requirements.get('count')
                    domain = requirements.get('domain')
                    
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response acknowledging student requirements and campus visit.

HR Message:
\"\"\"
{hr_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Requirements: {req_count} {domain} students
Available: {available_count} suitable candidates

Guidelines:
- Thank them for the opportunity
- Acknowledge their specific requirements
- Mention how many candidates you have available
- Mention the campus visit
- Offer to share profiles if needed
- Keep it welcoming and professional

Greeting: Dear {contact_name or company + ' Team'},
End with: Best regards, Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] Fallback AI generation failed: {str(e)}")
            
            # Final AI-powered fallback
            if OLLAMA_AVAILABLE:
                try:
                    from app.utils.student_requirements import extract_student_requirements
                    requirements = extract_student_requirements(clean_message)
                    
                    req_count = requirements.get('count')
                    domain = requirements.get('domain')
                    
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response acknowledging student requirements and campus visit.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Requirements: {req_count} {domain} students
Available: {available_count} suitable candidates

Guidelines:
- Thank them for the opportunity
- Acknowledge their specific requirements if mentioned
- Mention how many candidates you have available
- Express excitement about the campus visit
- Offer to share profiles if needed
- Keep it welcoming and professional
- Don't mention specific dates unless they provided one

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] Final AI generation failed: {str(e)}")
            
            # Last resort AI fallback
            if OLLAMA_AVAILABLE:
                try:
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR message.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Available Students: {available_count} suitable candidates

Guidelines:
- Respond appropriately to their message content
- Be professional and welcoming
- If they mention requirements, acknowledge them
- If they mention a visit, express excitement
- Offer assistance as appropriate
- Keep it concise and relevant

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] Last resort AI failed: {str(e)}")
            
            # Absolute final AI fallback
            if OLLAMA_AVAILABLE:
                try:
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR message.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}

Guidelines:
- Thank them for their message
- Be professional and welcoming
- Acknowledge any requirements or visit mentions appropriately
- Don't make assumptions about dates or specifics
- Keep it brief and helpful

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] Final AI fallback failed: {str(e)}")
            
            # Emergency fallback only
            return f"""{greeting}
 
 Thank you for your message. We appreciate your interest in our students and institution.
 
 Please let us know if you need any specific information or assistance.
 
 Best regards,
 Placement Team"""
        
        elif is_visit_message:
            print(f"[DEBUG] Entering visit message branch")
            # Detect visit announcements/confirmations
            if OLLAMA_AVAILABLE:
                print(f"[DEBUG] Ollama is available, trying AI response")
                try:
                    visit_date = AIService._extract_date(clean_message)
                    print(f"[DEBUG] Extracted visit date: {visit_date}")
                    
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR visit message.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Visit Date: {visit_date or 'as mentioned'}

Guidelines:
- Thank them for informing about the visit
- Express excitement about welcoming their team
- Mention preparation and arrangements will be made
- Offer to assist with any specific requirements
- Be welcoming and professional
- If they mention a specific date, acknowledge it
- Ask for preferred date/time if they requested it

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    print(f"[DEBUG] Calling Ollama with model: {OLLAMA_MODEL}")
                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 300}
                    )
                    
                    result = response['message']['content'].strip()
                    print(f"[DEBUG] AI response successful: {result[:100]}...")
                    return result
                    
                except Exception as e:
                    print(f"[ERROR] Visit AI response failed: {str(e)}")
                    print(f"[ERROR] Exception type: {type(e).__name__}")
                    import traceback
                    traceback.print_exc()
                    # Try simpler AI prompt
                    try:
                        simple_prompt = f"Write a professional email thanking them for the visit announcement and expressing excitement to welcome them. Mention arranging preparations. Ask for preferred date/time. Start with 'Dear {contact_name or company + ' Team'},' and end with 'Best regards, Placement Team'"
                        
                        response = ollama.chat(
                            model=OLLAMA_MODEL,
                            messages=[{"role": "user", "content": simple_prompt}],
                            options={"temperature": 0.3, "num_predict": 200}
                        )
                        
                        result = response['message']['content'].strip()
                        print(f"[DEBUG] Simple AI response successful: {result[:100]}...")
                        return result
                    except Exception as e2:
                        print(f"[ERROR] Simple visit AI failed: {str(e2)}")
            else:
                print(f"[DEBUG] Ollama not available, using fallback")
            
            print(f"[DEBUG] Using visit fallback response")
            # Visit fallback with proper date handling
            visit_date = AIService._extract_date(clean_message)
            date_text = f" in the {visit_date}" if visit_date and 'week' in visit_date.lower() else f" on {visit_date}" if visit_date else ""
            
            return f"""{greeting}
 
 Thank you for informing us about your planned visit{date_text}. We are excited to welcome your team to our institution.
 
 Our placement team will ensure all necessary arrangements are made for a productive and engaging session. We look forward to showcasing our talented students and facilitating meaningful interactions.
 
 Please let us know your preferred date and time for the visit, and if you have any specific requirements.
 
 Best regards,
 Placement Team"""
        
        else:
            print(f"[DEBUG] Entering else branch - general response")
            # Use AI for all other responses
            if OLLAMA_AVAILABLE:
                try:
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR message.

HR Message:
\"\"\"
{hr_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}

Guidelines:
- Respond appropriately to their message tone and content
- Be professional and helpful
- Keep it concise and relevant
- Maintain a positive, collaborative tone

Greeting Logic:
- If Contact Name is provided, start with "Dear {contact_name},"
- Otherwise, start with "Dear {company} Team,"

End with:
Best regards,
Placement Team"""

                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.3, "num_predict": 200}
                    )
                    
                    return response['message']['content'].strip()
                    
                except Exception as e:
                    print(f"[ERROR] General AI response failed: {str(e)}")
            
            # Final fallback
            return f"""{greeting}
 
 Thank you for your response. We appreciate your interest in our students.
 
 Please let us know if you need any specific information or if we can assist you in any way.
 
 Best regards,
 Placement Team"""
    
    @staticmethod
    def generate_draft_with_students(hr_reply: str, students_data: List[Dict], company: str) -> str:
        """
        Legacy method for backward compatibility
        Calls the new generate_draft_reply method
        """
        # Pass None for contact_name as this is a legacy/batch method
        result = AIService.generate_draft_reply(hr_reply, company, None, students_data)
        return result['content']
    
    @staticmethod
    def detect_cancellation(hr_message: str) -> Dict:
        """
        Detect if HR message indicates cancellation or rescheduling
        Returns: is_cancelled, reason, reschedule_mentioned
        """
        hr_lower = hr_message.lower()
        
        # Cancellation keywords
        cancellation_keywords = [
            'cancelled', 'canceled', 'cancel', 'postpone', 'postponed', 
            'reschedule', 'rescheduled', 'delay', 'delayed', 'unable to',
            'not able to', 'cannot', 'can\'t', 'won\'t be able', 'will not be able'
        ]
        
        # Visit/event keywords
        event_keywords = ['visit', 'meeting', 'interview', 'session', 'appointment']
        
        # Check for cancellation patterns
        is_cancelled = False
        reason = None
        reschedule_mentioned = False
        
        # Direct cancellation detection
        for cancel_word in cancellation_keywords:
            if cancel_word in hr_lower:
                is_cancelled = True
                break
        
        # Check if it's related to a visit/event
        if is_cancelled:
            has_event_context = any(event_word in hr_lower for event_word in event_keywords)
            if not has_event_context:
                # If no event context, it might not be a cancellation we care about
                is_cancelled = False
        
        # Extract reason if mentioned
        reason_patterns = [
            r'due to ([^.]+)',
            r'because of ([^.]+)',
            r'owing to ([^.]+)',
            r'on account of ([^.]+)'
        ]
        
        for pattern in reason_patterns:
            match = re.search(pattern, hr_lower)
            if match:
                reason = match.group(1).strip()
                break
        
        # Check for rescheduling mention
        reschedule_phrases = [
            'reschedule', 'rescheduled', 'later date', 'another time', 
            'new date', 'different date', 'postpone'
        ]
        reschedule_mentioned = any(phrase in hr_lower for phrase in reschedule_phrases)
        
        return {
            'is_cancelled': is_cancelled,
            'reason': reason or 'No specific reason provided',
            'reschedule_mentioned': reschedule_mentioned
        }
        
    @staticmethod
    def detect_rescheduling(hr_message: str) -> Dict:
        """
        Detect if HR message indicates rescheduling with new date
        Returns: is_rescheduled, new_date, reason
        """
        if not hr_message:
            return {'is_rescheduled': False, 'new_date': None, 'reason': None}
            
        hr_lower = hr_message.lower()
        
        # Rescheduling keywords
        reschedule_keywords = [
            'postponed', 'postpone', 'rescheduled', 'reschedule', 
            'moved to', 'changed to', 'shifted to', 'new date'
        ]
        
        # Visit/event keywords
        event_keywords = ['visit', 'meeting', 'interview', 'session', 'appointment']
        
        # Check for rescheduling patterns
        is_rescheduled = False
        new_date = None
        reason = None
        
        # Direct rescheduling detection
        for reschedule_word in reschedule_keywords:
            if reschedule_word in hr_lower:
                is_rescheduled = True
                break
        
        # Check if it's related to a visit/event
        if is_rescheduled:
            has_event_context = any(event_word in hr_lower for event_word in event_keywords)
            if not has_event_context:
                is_rescheduled = False
        
        # Extract new date if rescheduled
        if is_rescheduled:
            new_date = AIService._extract_date(hr_message)
        
        return {
            'is_rescheduled': is_rescheduled,
            'new_date': new_date,
            'reason': reason
        }
        
    @staticmethod
    def analyze_sentiment(email_body: str) -> str:
        """
        Analyze HR reply sentiment using Phi-3
        Returns one of: 'Positive', 'Need Info', 'Not Interested', 'Neutral'
        """
        classification = AIService.classify_message(email_body)
        
        category_map = {
            "positive": "Positive",
            "need_info": "Need Info",
            "not_interested": "Not Interested",
            "neutral": "Neutral"
        }
        
        return category_map.get(classification.get('category', 'neutral'), 'Neutral')