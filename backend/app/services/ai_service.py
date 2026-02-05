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
    
    SYSTEM_PROMPT = """You are an AI assistant acting as an official College Placement Cell email assistant
for Bannari Amman Institute of Technology.

GENERAL RULES (STRICT):
1. NEVER invent information.
2. NEVER use placeholders like [College Name].
3. Use ONLY the data provided (student dashboard / HR email).
4. Replies must be professional, factual, and human-written.
5. Length: 3–6 lines unless details are requested.

SUBJECT RULE (MANDATORY):
- ALWAYS reuse the exact subject line from the HR email.
- NEVER create a new subject unless HR explicitly asks for it.
- If the HR subject starts with "Re:", keep it unchanged.

HTML FORMATTING RULE (MANDATORY):
- ALWAYS format your email response using HTML tags.
- Wrap each paragraph in <p></p> tags.
- Use <br> for line breaks within paragraphs (like in signatures).
- Example format:
  <p>Dear Name,</p>
  
  <p>Your message content here.</p>
  
  <p>Best regards,<br>
  Placement Cell,<br>
  Bannari Amman Institute of Technology</p>

SIGNATURE RULE (MANDATORY):
End every email exactly with:

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>

REQUIREMENT HANDLING:
- If HR asks for students → state exact available count from records.
- If HR asks more than available → clearly mention actual count.
- If HR says "Yes / Interested / Please share" → proceed to share or state sharing of basic student details.

GREETING RULE:
- If HR says only "Hi / Hello" → polite acknowledgement, invite details.
- If HR says "Thank you" → acknowledge and offer assistance.

VISIT RULE:
- If HR mentions a visit WITHOUT date → acknowledge and ask for proposed date and requirements.
- Do NOT claim readiness or arrangements unless confirmed.

PROFILE SHARING RULE:
- If resumes are not available, share ONLY basic details:
  Name, Department, Domain, Key Skills.
- Do NOT invent resumes or detailed achievements.

TONE:
- Neutral
- Respectful
- Placement-industry standard
- No marketing language
"""

    APPROVED_ACKNOWLEDGEMENTS = [
        "Thank you for your response. We have noted the update.",
        "Thank you for the update. We look forward to your visit.",
        "Please let us know if any information is required from our side.",
        "We look forward to hearing from you regarding the next steps."
    ]

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
  "visit_date": "date string or null",
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
    def _convert_to_html(text: str) -> str:
        """
        Convert plain text email to HTML format.
        Wraps paragraphs in <p> tags and converts line breaks.
        """
        # If already contains HTML tags, return as is
        if '<p>' in text or '<br>' in text:
            return text
        
        # Split by double newlines to identify paragraphs
        paragraphs = text.split('\n\n')
        html_paragraphs = []
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Check if this is the signature block (contains "Best regards")
            if 'Best regards' in para or 'Placement Cell' in para:
                # Convert single newlines to <br>
                para = para.replace('\n', '<br>\n')
                html_paragraphs.append(f'<p>{para}</p>')
            else:
                # Regular paragraph - remove internal newlines
                para = para.replace('\n', ' ')
                html_paragraphs.append(f'<p>{para}</p>')
        
        return '\n\n'.join(html_paragraphs)

    
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
        count_match = re.search(r'(?:hire|need|requirement|seeking|looking for|want|vacancies)\s*(?:about|around)?\s*(\d+)', hr_message, re.IGNORECASE)
        if not count_match:
             # Just strict count + noun? e.g. "5 developers"
            count_match = re.search(r'(\d+)\s*(?:students?|candidates?|profiles?|members?|developers?|engineers?|roles?|positions?|vacancies?|freshers?)', hr_message, re.IGNORECASE)
        
        positions_count = int(count_match.group(1)) if count_match else None
        
        # If no digits, check for words
        if not positions_count:
            for word, num in word_to_num.items():
                # Allow up to 30 characters (approx 4-5 words) between number and 'students'
                # e.g., "three top performing students", "five good candidates"
                if re.search(r'\b' + word + r'\b.{1,30}?(?:students?|candidates?|profiles?|members?|developers?|engineers?|roles?|positions?|vacancies?|freshers?)', hr_lower):
                    positions_count = num
                    break
        
        # Extract dates
        visit_date = AIService._extract_date(hr_message)
        
        # Detect urgency
        urgency = "high" if any(word in hr_lower for word in ['urgent', 'asap', 'immediately']) else "medium"
        
        # Detect commitments
        commitments = []
        if 'will visit' in hr_lower or 'planning to visit' in hr_lower or 'visiting' in hr_lower:
            commitments.append("Campus visit planned")
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
            # Fuzzy: "first week of February"
            r'(first|second|third|fourth|last|next)\s+week\s+of\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*',
            # Month DD, YYYY (Feb 15th, 2026)
            r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})',
            # Month DD (Feb 15th)
            r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?'
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
                        return f"{week_desc} Week of {month_name} {current_year}"
                    
                    # Handle Month-first patterns (index 4 and 5)
                    if i >= 4:
                        raw_month = groups[0]
                        day = groups[1].zfill(2)
                        year = groups[2] if len(groups) > 2 else str(current_year)
                    else:
                        day = groups[0].zfill(2)
                        raw_month = groups[1]
                        year = groups[2] if len(groups) > 2 else str(current_year)
                    
                    # Normalise month
                    if raw_month.isdigit():
                         month = raw_month.zfill(2)
                    else:
                        months = {'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 
                                 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 
                                 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'}
                        month = months.get(raw_month[:3].lower(), '01')
                    
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
        elif any(phrase in text.lower() for phrase in ['soon', 'shortly', 'near future', 'upcoming']):
            return "Upcoming"
        
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
            'explicit_request': any(word in hr_lower for word in ['send', 'share', 'provide', 'list', 'namelist', 'name list', 'profiles', 'resumes', 'requirements']),
            'student+action': 'student' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'provide', 'list', 'namelist', 'need', 'require', 'looking', 'hiring']),
            'profile+action': 'profile' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'provide', 'need', 'require', 'looking']),
            'candidate+action': 'candidate' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'list', 'need', 'require', 'looking']),
            'resume+action': 'resume' in hr_lower and any(word in hr_lower for word in ['send', 'share', 'provide', 'need', 'require'])
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
        # Split by common email thread markers
        thread_markers = [
            '\nOn ',  # "On Mon, Jan 19, 2026 at 2:52 PM"
            '\n\nOn ',
            '\n> ',  # Quoted text
            '\nFrom:',  # Email headers
            '\n-----Original Message-----',
        ]
        
        # Find the earliest thread marker
        earliest_pos = len(email_content)
        for marker in thread_markers:
            pos = email_content.find(marker)
            if pos != -1 and pos < earliest_pos:
                earliest_pos = pos
        
        # Extract only the content before the thread marker
        latest_message = email_content[:earliest_pos].strip()
        
        # Also remove lines that start with '>'
        lines = latest_message.split('\n')
        clean_lines = [line for line in lines if not line.strip().startswith('>')]
        latest_message = '\n'.join(clean_lines).strip()
        
        return latest_message

    @staticmethod
    def generate_subject(original_subject: str, company: str, intent: Dict, classification: Dict, clean_message: str, profiles_requested: bool = False) -> str:
        """
        Rule-based subject line mapping following strict constraints.
        1. Always preserve original subject prefix "Re:"
        2. Mapping based on intent signals
        """
        # Ensure 'Re: ' prefix
        prefix = "Re: "
        clean_subj = original_subject
        if clean_subj.lower().startswith("re:"):
            clean_subj = clean_subj[3:].strip()
        
        base_subject = f"{prefix}{clean_subj}"
        
        # 1. HR mentions visit / planning / cancellation
        is_cancelled = AIService.detect_cancellation(clean_message).get('is_cancelled', False)
        
        if is_cancelled:
            return f"{base_subject} – Visit Update"
        
        # 2. HR strictly asks to SHARE profiles (Stronger than just requirements)
        if profiles_requested:
            return f"{base_subject} – Student Profiles"
        
        # 3. HR asks for student count/availability or mentions NEW requirements
        has_requirements = bool(intent.get('positions_count') or intent.get('skills'))
        # Only add suffix if it's likely a primary intent, not just a passing mention in an ack
        if has_requirements and not classification.get('category') == 'Acknowledgment':
            return f"{base_subject} – Student Availability"
            
        # 4. Default: Just the original subject (re-prefixed)
        return base_subject

    @staticmethod
    def _validate_ai_reply(reply: str, requested_count: int, available_count: int) -> bool:
        """
        Final Safety Validator: Rejects replies with forbidden phrases or hallucinated numbers.
        """
        import re
        forbidden_phrases = [
            "database", "dashboard", "internal system",
            "acknowledge receipt", "updated our records", "relevant expertise",
            "noted the information", "we have confirmed internally",
            "we are currently not aware", "no applications received",
            "policy to share", "privacy concerns", "ai assistant",
            "automated system", "bot", "hirebot"
        ]

        reply_lower = reply.lower()
        
        # 1. Check for forbidden phrases
        if any(phrase in reply_lower for phrase in forbidden_phrases):
            print(f"[SAFETY] Validation failed: Forbidden phrase detected.")
            return False

        # 2. Check for number hallucination (Digits and Words)
        # Authorize only the specific numbers provided
        authorized_numbers = set()
        if requested_count: authorized_numbers.add(str(requested_count))
        if available_count: authorized_numbers.add(str(available_count))
        
        # Numbers as words (simple map for 1-10)
        num_word_map = {
            "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
            "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"
        }

        # 2a. Check Digits
        digits_in_reply = re.findall(r'\b([1-9][0-9]?|100)\b', reply)
        for num in digits_in_reply:
            if num not in authorized_numbers:
                print(f"[SAFETY] Validation failed: Unauthorized digit '{num}' detected.")
                return False
                
        # 2b. Check Words
        words = reply_lower.split()
        for word in words:
            # Clean punctuation
            clean_word = re.sub(r'[^\w]', '', word)
            if clean_word in num_word_map:
                mapped_val = num_word_map[clean_word]
                if mapped_val not in authorized_numbers:
                    print(f"[SAFETY] Validation failed: Unauthorized number word '{clean_word}' detected.")
                    return False

        return True
    
    @staticmethod
    def acknowledgment_reply_dict(contact_name: Optional[str], company: str, hr_message: Optional[str] = None) -> Dict:
        """
        Helper for both generic and visit acknowledgments.
        Implements strict Visit Acknowledgement Rule (timing + readiness + <6 lines).
        """
        greeting = f"Dear {contact_name}," if contact_name else f"Dear {company} Team,"
        
        # 1. New Visit Rule Detection & Timing Extraction
        visit_keywords = ['visit', 'visiting', 'campus', 'arrive', 'arrival', 'coming']
        is_visit = hr_message and any(kw in hr_message.lower() for kw in visit_keywords)
        
        if is_visit:
            # Extract timing keyword briefly
            msg_lower = hr_message.lower()
            timing = None
            specific_date = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', msg_lower)
            if specific_date:
                timing = f"on {specific_date.group(0)}"
            else:
                 # Check for fuzzy dates or 'tomorrow'
                 raw_date = re.search(r'(\d{1,2})[./\-](\d{1,2})[./\-]\d{4}', msg_lower)
                 if raw_date:
                     timing = f"on {raw_date.group(0)}"
                 elif 'tomorrow' in msg_lower:
                     timing = "tomorrow"
                 elif 'today' in msg_lower:
                     timing = "today"
            
            # Special Case: Visit WITHOUT Date (upcoming/soon/shortly or just 'visit')
            if not timing:
                content = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for the update. We look forward to your visit.</p>

<p>Please let us know the proposed date and any specific requirements at your convenience, so that we can make the necessary arrangements.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
                return {"content": content, "sentence": "visit_acknowledgment_no_date"}

            # Visit WITH Date
            content = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for the update. We look forward to your visit {timing}.</p>

<p>We will make the necessary arrangements for your arrival.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
            return {"content": content, "sentence": "visit_acknowledgment_with_date"}

        # 2. Generic Acknowledgment (Fall back to approved list)
        # Deterministic for others, excluding index 1 (which was the old visit sentence)
        other_indices = [0, 2, 3]
        idx = other_indices[hash(company) % len(other_indices)]
        sentence = AIService.APPROVED_ACKNOWLEDGEMENTS[idx]
            
        content = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>{sentence}</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
        return {"content": content, "sentence": sentence}

    @staticmethod
    def acknowledgment_reply(contact_name: Optional[str], company: str, hr_message: Optional[str] = None) -> str:
        """
        Deterministic acknowledgment reply when no students are requested.
        Uses exactly ONE sentence from the approved list only.
        """
        res = AIService.acknowledgment_reply_dict(contact_name, company, hr_message)
        return res['content']

    @staticmethod
    def detect_greeting_only(text: str) -> Dict:
        """
        Detect if a message contains only greetings and common social pleasantries.
        Returns: {is_greeting: bool, case_type: str, content: str}
        """
        text_lower = text.lower().strip()
        # Remove common punctuation for better matching
        clean_text = re.sub(r'[?.!,]', '', text_lower).strip()
        
        # Mandatory Template Content
        mandatory_content = (
            "<p>Hello and thank you for your message.</p>\n\n"
            "<p>Please feel free to share further details so that we may assist you accordingly.</p>"
        )

        # Define cases based on user requirements
        # Case 1: HR says "Hi" / "Hii" / "Hello"
        if clean_text in ['hi', 'hii', 'hiii', 'hello', 'hey', 'hi there', 'hello there', 'greetings']:
             return {
                "is_greeting": True,
                "case_type": "basic",
                "content": mandatory_content
            }
        
        # Case 2: HR says "Hi, how are you?"
        if any(phrase in clean_text for phrase in ['how are you', 'how r u', 'how are u', 'hope you are doing well', 'hope you are well']):
             # Ensure it doesn't have other substance
            substance_keywords = ['student', 'placement', 'internship', 'hiring', 'requirement', 'visit', 'profiles', 'resumes', 'opening']
            if not any(kw in text_lower for kw in substance_keywords):
                 return {
                    "is_greeting": True,
                    "case_type": "wellbeing",
                    "content": mandatory_content
                }
        
        # Case 3: HR says "Good morning" / "Good afternoon" / "Good evening"
        if any(clean_text.startswith(greet) for greet in ['good morning', 'good afternoon', 'good evening']):
            substance_keywords = ['student', 'placement', 'internship', 'hiring', 'requirement', 'visit', 'profiles', 'resumes', 'opening']
            if len(clean_text.split()) <= 4 and not any(kw in text_lower for kw in substance_keywords):
                return {
                    "is_greeting": True,
                    "case_type": "time_based",
                    "content": mandatory_content
                }
        
        # Case 4: Very casual "Hi team"
        if clean_text in ['hi team', 'hello team', 'hi placement cell', 'hi placement team']:
            return {
                "is_greeting": True,
                "case_type": "casual_team",
                "content": mandatory_content
            }

        return {"is_greeting": False, "case_type": None, "content": None}

    @staticmethod
    def detect_acknowledgment_only(text: str) -> Dict:
        """
        Detect if a message is purely an acknowledgement or thank you.
        Returns: {is_ack: bool, content: str}
        """
        text_lower = text.lower().strip()
        clean_text = re.sub(r'[?.!,]', '', text_lower).strip()
        
        # Mandatory Template Content
        mandatory_content = (
            "<p>Thank you for your message.</p>\n\n"
            "<p>Please let us know if any further information is required from our side.</p>"
        )

        ack_phrases = [
            'thank you', 'thanks', 'thank u', 
            'thanks for the information', 'thanks for the info',
            'noted thank you', 'noted thanks', 'well noted',
            'thank you for your mail', 'thank you for the email',
            'received thanks', 'got it thanks'
        ]
        
        # Check if message starts with or is very similar to ack phrases
        # and is short (under ~10 words to avoid missing actual content)
        is_short = len(clean_text.split()) <= 12
        contains_ack = any(phrase in clean_text for phrase in ack_phrases)
        
        # Ensure no other request keywords are present
        substance_keywords = ['student', 'placement', 'internship', 'hiring', 'requirement', 'visit', 'profiles', 'resumes', 'opening', 'schedule', 'date', 'time']
        has_substance = any(kw in text_lower for kw in substance_keywords)

        if contains_ack and is_short and not has_substance:
             return {
                "is_ack": True,
                "content": mandatory_content
            }

        return {"is_ack": False, "content": None}

    @staticmethod
    def generate_draft_reply(hr_message: str, company: str, contact_name: Optional[str] = None, students_data: Optional[List[Dict]] = None, original_subject: str = "Placement Inquiry") -> Dict:
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
        print(f"DRAFT GENERATION STARTED (HYBRID MODE)")
        print(f"Company: {company}")
        print(f"Cleaned message: {clean_message[:100]}...")
        print(f"{'='*60}\n")
        
        # Classify message early for rule-based subjects and intent
        classification = AIService.classify_message(clean_message)
        requesting_students = classification.get('requesting_students', False)

        
        # 1. Rule-Based Visit Detection (DO NOT CALL AI for visit-only emails)
        visit_date = AIService._extract_date(clean_message)
        # Check for visit keywords
        visit_keywords = ['visit', 'visiting', 'campus', 'arrive', 'arrival', 'coming']
        is_visit_message = bool(visit_date) and any(kw in clean_message.lower() for kw in visit_keywords)
        
        # Check for requirements using regex (to determine if it's ONLY a visit message)
        # User defined strict regex for mandatory requirements detection - UPDATED for better coverage
        req_match = re.search(r'(?:hire|need|requirement|seeking|looking for|want|vacancies).{0,20}?(\d+)\s*(?:students?|candidates?|profiles?|members?|developers?|engineers?|roles?|positions?|vacancies?|freshers?)', clean_message, re.IGNORECASE)
        # Fallback if no specific noun follows
        if not req_match:
            req_match = re.search(r'(?:hire|need|requirement|seeking|looking for|want|vacancies).{0,20}?(\d+)', clean_message, re.IGNORECASE)
        
        has_requirements_regex = bool(req_match)
        
        # Greeting Rule
        greeting = f"Dear {contact_name}," if contact_name else "Dear Hiring Team,"
        
        # 🚨 MANDATORY OVERRIDE: Handle Greeting-Only messages deterministically
        greeting_only = AIService.detect_greeting_only(clean_message)
        if greeting_only["is_greeting"]:
            print(f"[DRAFT] Greeting-only message detected ({greeting_only['case_type']}). Using deterministic response.")
            # Map specific HR Name for Case 1
            hr_name = contact_name if contact_name else "HR Manager"
            greeting_final = f"Dear {hr_name},"
            
            # Mandatory Subject Override
            subject = "Re: Greetings"
            return {
                "subject": subject,
                "content": f"<p>Dear {hr_name},</p>\n\n{greeting_only['content']}\n\n<p>Best regards,<br>\nPlacement Cell,<br>\nBannari Amman Institute of Technology</p>",
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': [],
                    'positions_count': None,
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Initial greeting acknowledged"],
                    'action_items': [],
                    'urgency': "low"
                },
                "suggested_students": [],
                "follow_up_actions": [],
                "student_requirements": student_requirements
            }

        # 🚨 MANDATORY OVERRIDE: Handle Acknowledgement-Only messages deterministically
        ack_only = AIService.detect_acknowledgment_only(clean_message)
        if ack_only["is_ack"]:
            print(f"[DRAFT] Acknowledgement-only message detected. Using deterministic response.")
            hr_name = contact_name if contact_name else "HR Manager"
            greeting_final = f"Dear {hr_name},"
            
            # Mandatory Subject Override
            subject = "Re: Acknowledgement"
            return {
                "subject": subject,
                "content": f"<p>{greeting_final}</p>{ack_only['content']}<p>Best regards,<br>Placement Cell,<br>Bannari Amman Institute of Technology</p>",
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': [],
                    'positions_count': None,
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Acknowledgement received"],
                    'action_items': [],
                    'urgency': "low"
                },
                "suggested_students": [],
                "follow_up_actions": [],
                "student_requirements": student_requirements
            }

        is_data_provided = students_data is not None
        available_count = len(students_data) if is_data_provided else 0
        req_count = student_requirements.get('count')
        domain = student_requirements.get('domain')
        
        # 🚨 MANDATORY OVERRIDE: Handle Interest Confirmation (e.g. "Please share", "Interested", "Yes")
        # Ensure it's not a negative "Not interested"
        is_negative = "not interested" in clean_message.lower() or "no openings" in clean_message.lower()
        interest_phrases = ["please share", "kindly share", "share them", "share the profiles", "send them", "send the profiles", "interested", "yes please", "go ahead"]
        
        # Check for simple "Yes" if it's short
        is_simple_yes = clean_message.lower().strip() in ["yes", "yes.", "sure", "sure.", "okay", "ok"]
        
        is_interested = (any(phrase in clean_message.lower() for phrase in interest_phrases) or is_simple_yes) and not is_negative
        
        if is_interested:
            print(f"[DRAFT] Interest/Confirmation detected. Sharing details directly.")
            hr_name = contact_name if contact_name else "HR Manager"
            greeting_final = f"Dear {hr_name},"
            
            # Construct Subject
            subject = AIService.generate_subject(original_subject, company, {}, classification, clean_message, True)
            
            # Formatting the response to "Share" content
            # If we represent data sharing, we mention it.
            if available_count > 0:
                share_msg = f"<p>Thank you for your confirmation.</p><p>Please find strictly attached the profiles of {available_count} students matching your requirements.</p>"
            else:
                share_msg = "<p>Thank you for your confirmation.</p><p>We are compiling the student details and will share them with you immediately in a subsequent email.</p>"
            
            content = (
                f"<p>{greeting_final}</p>"
                f"{share_msg}"
                f"<p>Best regards,<br>"
                f"Placement Cell,<br>"
                f"Bannari Amman Institute of Technology</p>"
            )
            
            return {
                "subject": subject,
                "content": content,
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': [],
                    'positions_count': available_count if available_count > 0 else None,
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Sharing student profiles"],
                    'action_items': ["Attach profiles"],
                    'urgency': "high"
                },
                "suggested_students": students_data if students_data else [],
                "follow_up_actions": [
                    {
                        "action_type": "send_profiles",
                        "description": "Attach requested student profiles to the email",
                        "priority": "high"
                    }
                ],
                "student_requirements": student_requirements
            }
        
        # 🚨 MANDATORY OVERRIDE: Handle cancellation BEFORE any other logic
        cancellation = AIService.detect_cancellation(clean_message)
        if cancellation["is_cancelled"]:
            print("[DRAFT] Deterministic cancellation detected. Skipping all other logic.")
            subject = AIService.generate_subject(original_subject, company, {}, classification, clean_message, False)
            return {
                "subject": subject,
                "content": f"<p>{greeting}</p><p>Thank you for informing us. We understand the situation and acknowledge the cancellation of the visit.</p><p>Best regards,<br>Placement Cell,<br>Bannari Amman Institute of Technology</p>",
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': [],
                    'positions_count': None,
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Campus visit cancelled"],
                    'action_items': [],
                    'urgency': "medium"
                },
                "suggested_students": [],
                "follow_up_actions": [],
                "student_requirements": student_requirements
            }



        # Let's insert the new Requirement Logic BEFORE 'get back' or AFTER?
        # Requirement is more substantive. If they ask for students, we should reply with count.
        # So insertion point should be before 'get back'.

        # 🚨 MANDATORY OVERRIDE: Handle Specific Domain Requirements
        # If HR asks for students/domain (present in student_requirements)
        if domain and (requesting_students or has_requirements_regex):
            print(f"[DRAFT] Domain requirement detected: {domain}. Using deterministic template.")
            hr_name = contact_name if contact_name else "HR Manager"
            greeting_final = f"Dear {hr_name},"
            
            # Use exact count from data
            count_text = str(available_count)
            
            subject = f"Re: Student Requirement – {domain}"
            
            content = f"""<p>Dear {hr_name},</p>

<p>Thank you for sharing your requirement for {domain} students.</p>

<p>Based on our current records, we have {count_text} students with relevant expertise in this domain. Please let us know if you would like us to share their basic profiles for further review.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
            
            return {
                "subject": subject,
                "content": content,
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': [domain],
                    'positions_count': available_count,
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Checking student availability"],
                    'action_items': ["Share profiles if confirmed"],
                    'urgency': "medium"
                },
                "suggested_students": students_data if students_data else [],
                "follow_up_actions": [],
                "student_requirements": student_requirements
            }

        # 🚨 MANDATORY OVERRIDE: Handle "will get back" messages deterministically
        get_back_phrases = ["will get back", "revert back", "get back to you", "will update you", "will let you know"]
        if any(phrase in clean_message.lower() for phrase in get_back_phrases):
            print("[DRAFT] Deterministic 'get back' response triggered. Skipping AI.")
            subject = AIService.generate_subject(original_subject, company, {}, classification, clean_message, False)
            return {
                "subject": subject,
                "content": f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for your email. We acknowledge your requirement and appreciate you keeping us in the loop.</p>

<p>We will wait for further details from your side.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>""",
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': [],
                    'positions_count': None,
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Waiting for HR update"],
                    'action_items': [],
                    'urgency': "medium"
                },
                "suggested_students": [],
                "follow_up_actions": [],
                "student_requirements": student_requirements
            }

        # 🚨 MANDATORY OVERRIDE: Handle explicit profile requests (Deterministic)
        profile_request_keywords = [
            "share profiles", 
            "share the profiles",
            "student profiles", 
            "resumes", 
            "cv", 
            "details of students", 
            "profile details",
            "send list", 
            "share student docs", 
            "attached the profiles", 
            "share their profiles",
            "share the resume"
        ]
        profiles_requested = any(kw in clean_message.lower() for kw in profile_request_keywords)

        if profiles_requested:
            print("[DRAFT] Deterministic profile sharing response triggered. Skipping AI.")
            subject = AIService.generate_subject(original_subject, company, student_requirements, classification, clean_message, True)
            return {
                "subject": subject,
                "content": f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>As requested, please find attached the profiles of students matching your requirement.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>""",
                "requires_confirmation": True,
                "extracted_intent": {
                    'role': None,
                    'skills': student_requirements.get('skills', []),
                    'positions_count': student_requirements.get('count'),
                    'deadline': None,
                    'visit_date': None,
                    'commitments': ["Student profiles shared"],
                    'action_items': [],
                    'urgency': "high"
                },
                "suggested_students": students_data[:10] if students_data else [],
                "follow_up_actions": [],
                "student_requirements": student_requirements
            }

        # Use already extracted classification


        if is_visit_message and not has_requirements_regex:
            # RULE 1: Visit Only -> Deterministic (No AI Call)
            if visit_date:
                print(f"[DRAFT] Visit date detected: {visit_date}. Using simplified visit acknowledgement.")
                content_dict = AIService.acknowledgment_reply_dict(contact_name, company, clean_message)
                subject = AIService.generate_subject(original_subject, company, {}, classification, clean_message, False)
                return {
                    "subject": subject,
                    "content": content_dict['content'],
                    "requires_confirmation": False,
                    "extracted_intent": {
                        'role': None,
                        'skills': [],
                        'positions_count': None,
                        'deadline': None,
                        'visit_date': visit_date,
                        'commitments': ["Visit acknowledged"],
                        'action_items': [],
                        'urgency': classification.get('urgency', "high")
                    },
                    "suggested_students": [],
                    "follow_up_actions": [],
                    "student_requirements": student_requirements
                }
            # Fallback if visit_date is somehow None but is_visit_message is true (shouldn't happen with current logic)
            print("[DRAFT] Rule-based visit confirmation detected (no specific date). Skipping AI.")
            draft_body = f"<p>{greeting}</p><p>Thank you for your email. We note that you will be visiting our college.</p><p>We will make the necessary arrangements for the visit.</p><p>Best regards,<br>Placement Cell,<br>Bannari Amman Institute of Technology</p>"
            intent = {
                'role': None,
                'skills': [],
                'positions_count': None,
                'deadline': None,
                'visit_date': visit_date,
                'commitments': ["Campus visit acknowledged"],
                'action_items': [],
                'urgency': "medium"
            }
            subject = f"Campus Visit Confirmation - {company}"
        else:
            # 🚨 GOLDEN RULE (Fallback): If HR does NOT ask for students, AI must NOT talk about students
            requesting_students = classification.get('requesting_students', False)


            # Strict Acknowledgment Check for specific keywords (using word boundaries for exact match)
            ack_keywords = [r'\bthank you\b', r'\bthanks\b', r'\bnoted\b', r'\bunderstood\b', r'\bcancelled\b', r'\bwill update\b', r'\bok\b', r'\bokay\b']
            is_generic_ack = any(re.search(kw, clean_message.lower()) for kw in ack_keywords)

            # Avoid false positives if more requirements or student counts are mentioned in the same message
            if is_generic_ack and (has_requirements_regex or requesting_students):
                print("[DRAFT] Acknowledgment keyword found but requirement/student count also detected. Prioritizing requirement.")
                is_generic_ack = False

            if (not requesting_students and not has_requirements_regex) or is_generic_ack:
                print(f"[DRAFT] Golden Rule/Ack triggered: is_generic_ack={is_generic_ack}. Using acknowledgment template.")
                subject = AIService.generate_subject(original_subject, company, {}, classification, clean_message, False)
                return {
                    "subject": subject,
                    "content": AIService.acknowledgment_reply(contact_name, company, clean_message),
                    "requires_confirmation": True,
                    "extracted_intent": {
                        'role': None,
                        'skills': [],
                        'positions_count': None,
                        'deadline': None,
                        'visit_date': visit_date,
                        'commitments': ["Acknowledgment sent"],
                        'action_items': [],
                        'urgency': classification.get('urgency', "low")
                    },
                    "suggested_students": [],
                    "follow_up_actions": [],
                    "student_requirements": student_requirements
                }

            # 🚨 MANDATORY OVERRIDE: Handle "basic details" / "student details" requests (Deterministic)
            basic_details_keywords = ["basic details", "student details", "profile details", "share details", "share their details"]
            is_basic_details_request = any(kw in clean_message.lower() for kw in basic_details_keywords)

            if is_basic_details_request:
                # Case 2: Only domain provided (e.g., "Python students", "Cloud experts")
                if domain or student_requirements.get('skills'):
                    skill_name = domain or (student_requirements.get('skills')[0] if student_requirements.get('skills') else "specified")
                    
                    if not is_data_provided:
                        print("[DRAFT] Data not provided. Using 'verify and follow up' template.")
                        draft_body = f"""{greeting}

Thank you for your update regarding the {skill_name} requirement.

We are currently checking our records for suitable candidates matching your criteria. In the meantime, could you please share any specific eligibility criteria (such as minimum GPA, preferred branches, or graduation year) so we can refine our search?

We will get back to you shortly with the verified details.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""
                    elif available_count == 0:
                        # Case 2b: Zero available
                        print("[DRAFT] Zero students found. Using polite refusal template.")
                        draft_body = f"""{greeting}

Thank you for your request.

At present, we do not have students in our dashboard who meet the specified {skill_name} domain criteria. We will keep you informed as soon as suitable candidates become available.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""
                    else:
                        # Case 2a: Some available
                        print("[DRAFT] Some students found. Using inline list template.")
                        # Decide intro based on intent
                        if profiles_requested:
                            intro = f"As requested, please find the basic details of our available students in the {skill_name} domain."
                        else:
                            intro = f"As requested, we have identified {available_count} students from our dashboard with expertise in the {skill_name} domain."
                        if available_count < (req_count or 1):
                            intro = f"Based on our current student records, we have identified {available_count} students with expertise in the {skill_name} domain."

                        student_list_text = ""
                        for s in students_data[:10]: # Limit to 10 for email conciseness
                            name = s.get('name', 'N/A')
                            dept = s.get('department', 'N/A')
                            domain_skill = s.get('domain') or s.get('skills_text') or skill_name
                            student_list_text += f"• {name} – {dept} – {domain_skill}\n"

                        draft_body = f"""{greeting}

{intro}

We are sharing their basic details below for your review. Kindly let us know if you would like us to proceed with these candidates or wait for additional availability.

{student_list_text.strip()}

Please let us know if this information is sufficient or if any additional details are required.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""
                else: # Fallback if basic details requested but no specific domain/skills
                    print(f"[DRAFT] Deterministic basic details request triggered (no specific domain). Count: {available_count}")
                    if not is_data_provided:
                        draft_body = f"""{greeting}

Thank you for your request for student details.

We are currently checking our records for suitable candidates. To help us identify the best matches, could you please share the eligibility criteria or specific skills you are looking for?

We will verify our data and get back to you shortly.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""
                    elif available_count == 0:
                        draft_body = f"""{greeting}

Thank you for your request.

At present, we do not have students in our dashboard who meet the specified criteria. We will keep you informed as soon as suitable candidates become available.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""
                    else:
                        student_list_text = ""
                        for s in students_data[:10]: # Limit to 10 for email conciseness
                            name = s.get('name', 'N/A')
                            dept = s.get('department', 'N/A')
                            domain_skill = s.get('domain') or s.get('skills_text') or "various skills"
                            student_list_text += f"• {name} – {dept} – {domain_skill}\n"

                        intro = f"As requested, we have identified {available_count} students from our dashboard."
                        if available_count < (req_count or 1):
                            intro = f"Based on our current student records, we have identified {available_count} students."

                        draft_body = f"""{greeting}

{intro}

We are sharing their basic details below for your review. Kindly let us know if you would like us to proceed with these candidates or wait for additional availability.

{student_list_text.strip()}

Please let us know if this information is sufficient or if any additional details are required.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""

                subject = AIService.generate_subject(original_subject, company, student_requirements, classification, clean_message, False)
                return {
                    "subject": subject,
                    "content": draft_body,
                    "requires_confirmation": True,
                    "extracted_intent": {
                        'role': None,
                        'skills': student_requirements.get('skills', []),
                        'positions_count': req_count,
                        'deadline': None,
                        'visit_date': None,
                        'commitments': ["Student details shared"],
                        'action_items': [],
                        'urgency': "medium"
                    },
                    "suggested_students": students_data[:10] if students_data else [],
                    "follow_up_actions": [],
                    "student_requirements": student_requirements
                }

            # AI Path: Requirements or complex messages
            print("[DRAFT] Using strict AI prompt for requirements/complex message.")
            
            # Intent extraction via AI (single call)
            if OLLAMA_AVAILABLE:
                intent = AIService.extract_intent(clean_message, company)
            else:
                intent = AIService._fallback_intent_extraction(clean_message)
                
            # (req_count, domain, available_count already calculated above)
            
            # FACTUAL DECISION LOGIC: Sufficient vs Partial
            availability_status = "unknown"
            if req_count:
                availability_status = "sufficient" if available_count >= req_count else "partial"
            elif domain or student_requirements.get('skills'):
                availability_status = "available" if available_count > 0 else "none"

            # Re-verify visit date from deterministic check if AI missed it
            if not intent.get('visit_date') and visit_date:
                intent['visit_date'] = visit_date

            if OLLAMA_AVAILABLE:
                try:
                    # HARD-LOCK PROMPT (ANTI-HALLUCINATION)
                    skill_name = domain or (student_requirements.get('skills')[0] if student_requirements.get('skills') else None)
                    if not skill_name:
                        # Final resort: extract from message if extraction failed
                        skill_name = "the requested domain"
                    
                    prompt = f"""You are writing on behalf of a College Placement Officer.

ABSOLUTE GROUNDING FACTS:
- HR Message: {clean_message}
- Domain / Skill mentioned by HR: {skill_name}
- Student Data Provided: {"Yes" if is_data_provided else "No (I must say I will verify and follow up)"}
- Exact student count provided: {available_count if is_data_provided else "UNKNOWN (I do NOT know the count)"}
- Profiles actually available: {"Yes" if is_data_provided and available_count > 0 else "UNKNOWN / DATA NOT PROVIDED"}

STRICT RESPONSE RULES:
1. ADDRESS the HR by name: {contact_name or "Hiring Team"}.
2. If Student Data Provided is NO, you MUST say: "We are currently checking our student records for matching candidates and will get back to you shortly."
3. If HR asked for students but count is UNKNOWN, acknowledge the requirement but do NOT confirm availability yet.
4. Use the EXACT domain term mentioned by HR: '{skill_name}'. NEVER substitute or generalize it.
5. If Student Data Provided is YES and count is 0, state unavailability politely.
6. If HR asked "Share profiles", confirm they are shared ONLY if available count > 0.
7. Tone: Formal, calm, concise, and human.
8. NEVER mention AI, dashboards, databases, or robotic phrases ("updated our records", "relevant expertise").
9. Respond ONLY to the specific request made by HR.
10. SIGN OFF exactly as:
Best regards,
Placement Officer
Placement Cell"""

                    print(f"[DRAFT] Calling Ollama for factual reply...")
                    response = ollama.chat(
                        model=OLLAMA_MODEL,
                        messages=[{'role': 'user', 'content': prompt}],
                        options={
                            "temperature": 0.15,
                            "top_p": 0.85,
                            "num_predict": 150
                        }
                    )
                    
                    draft_body = response['message']['content'].strip()
                    # Convert to HTML if not already formatted
                    draft_body = AIService._convert_to_html(draft_body)
                    
                    # FINAL SAFETY VALIDATOR (HARD-LOCK CHECK)
                    is_safe = AIService._validate_ai_reply(draft_body, req_count, available_count)
                    
                    # RULE: Force exact student count presence (Only if data was provided)
                    # If data NOT provided, we expect the "verify and follow up" phrasing
                    has_verify_phrase = "checking our student records" in draft_body.lower() or "verify" in draft_body.lower()
                    
                    if is_data_provided and str(available_count) not in draft_body:
                        print(f"[SAFETY] Validation failed: Correct student count '{available_count}' missing from response.")
                        is_safe = False
                        if available_count == 0:
                             draft_body = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for your update. We currently do not have students matching these specific requirements available for placement.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
                        else:
                            count_text = f"{available_count} "
                            draft_body = f"""{greeting}

Thank you for your email regarding the {skill_name} requirement. We have {count_text}students matching your criteria.

Best regards,
Placement Cell,
Bannari Amman Institute of Technology"""""
                    elif not is_data_provided and not has_verify_phrase:
                        print(f"[SAFETY] Validation failed: Response did not acknowledge missing data verification.")
                        is_safe = False
                        draft_body = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for your request. We are currently checking our student records for matching candidates and will get back to you shortly with the details.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
                    
                    # Generate dynamic subject or use fallback
                    subject = AIService.generate_subject(original_subject, company, intent, classification, clean_message, profiles_requested)

                    
                except Exception as e:
                    print(f"[DRAFT] AI Generation failed: {str(e)}")
                    # Use absolute fallback
                    skill_text = domain or "relevant skills"
                    draft_body = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for your inquiry. We currently have {available_count} students with {skill_text} available for placements.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
                    subject = AIService.generate_subject(original_subject, company, intent, classification, clean_message, False)

            else:
                # Fallback if no AI
                print("[DRAFT] AI not available. Using static fallback.")
                skill_text = domain or "relevant skills"
                draft_body = f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for your inquiry. We have noted your requirements.</p>

<p>We will provide further updates regarding student availability as soon as possible.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
                subject = AIService.generate_subject(original_subject, company, {}, {}, clean_message, False)

        
        # 3. Final follow-up actions
        follow_up_actions = []
        extracted_visit_date = intent.get('visit_date')
        if extracted_visit_date:
            follow_up_actions.append({
                "action_type": "reminder",
                "due_date": extracted_visit_date,
                "description": f"Campus Visit - {company}",
                "priority": "high"
            })
        
        # Determine final subject (if not already set by rule-based path)
        final_subject = locals().get('subject', AIService.generate_subject(original_subject, company, intent, classification, clean_message, profiles_requested))


        return {
            "subject": final_subject,
            "content": draft_body,
            "requires_confirmation": True,
            "extracted_intent": intent,
            "suggested_students": students_data[:10] if students_data else [],
            "follow_up_actions": follow_up_actions,
            "student_requirements": student_requirements
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
            return f"<p>{greeting}</p><p>Thank you for informing us about the cancellation. We completely understand that unavoidable circumstances can arise.</p><p>We appreciate you taking the time to notify us in advance. Please feel free to reach out whenever you would like to reschedule or discuss future placement opportunities.</p><p>We look forward to collaborating with {company} in the future.</p><p>Best regards,<br>Placement Team</p>"
        
        elif requesting_students and students_data:
            student_list_html_items = []
            for s in students_data[:20]:
                skills = s.get('skills_text', 'N/A')
                if skills and len(skills) > 50:
                    skills = skills[:50] + '...'
                student_list_html_items.append(
                    f"<li>{s.get('name', 'N/A')} - {s.get('department', 'N/A')} (Roll: {s.get('roll_no', 'N/A')})<br>"
                    f"CGPA: {s.get('cgpa', 'N/A')} | Skills: {skills}</li>"
                )
            
            student_list_html = f"<ul>{''.join(student_list_html_items)}</ul>"
            
            # Check for campus visit mention
            visit_acknowledgment = ""
            if 'visit' in hr_message.lower() or 'campus' in hr_message.lower():
                visit_acknowledgment = "We look forward to your campus visit and will ensure all necessary arrangements are made for a productive interaction with our students. "
            
            return f"<p>{greeting}</p><p>Thank you for your interest in our students. Currently, we have {len(students_data)} students matching your requirements. The details are shared below:</p>{student_list_html}<p>{visit_acknowledgment}These students have demonstrated strong academic performance and relevant skills in your required domain.</p><p>Please let us know your preferred next steps.</p><p>Best regards,<br>Placement Team</p>"
        
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
                    
                    prompt = f"""{AIService.SYSTEM_PROMPT}

Write a brief professional email response to this HR message that mentions both student requirements and a campus visit.

HR Message:
\"\"\"
{clean_message}
\"\"\"

Company: {company}
Contact Name: {contact_name or 'Hiring Team'}
Extracted Requirements: {req_count if req_count else 'not specified'} {domain if domain else 'any'} students
Available Students: {len(students_data) if students_data else 'no'} suitable candidates
Visit Date Mentioned: {visit_date if visit_date else 'not specified'}

Guidelines:
- Acknowledge their requirement for students
- Mention how many suitable candidates you have available (if any)
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
Extracted Requirements: {req_count if req_count else 'not specified'} {domain if domain else 'any'} students
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
Requirements: {req_count if req_count else 'not specified'} {domain if domain else 'any'} students
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
Requirements: {req_count if req_count else 'not specified'} {domain if domain else 'any'} students
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
Visit Date Mentioned: {visit_date if visit_date else 'not specified'}

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
                    
                    ai_content = response['message']['content'].strip()
                    # Convert to HTML if not already formatted
                    ai_content = AIService._convert_to_html(ai_content)
                    return ai_content
                    
                except Exception as e:
                    print(f"[ERROR] General AI response failed: {str(e)}")
            
            # Final fallback
            return f"""<p>Dear {contact_name if contact_name else company + ' Team'},</p>

<p>Thank you for your response. We appreciate your interest in our students.</p>

<p>Please let us know if you need any specific information or if we can assist you in any way.</p>

<p>Best regards,<br>
Placement Cell,<br>
Bannari Amman Institute of Technology</p>"""
    
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