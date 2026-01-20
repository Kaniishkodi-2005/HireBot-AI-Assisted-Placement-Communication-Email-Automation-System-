"""
Helper function to extract student requirements from HR messages
"""
import re
from typing import Dict, List, Optional


def extract_student_requirements(hr_message: str) -> Dict:
    """
    Extract student requirements from HR message.
    Returns: {
        'count': int or None,
        'skills': List[str],
        'domain': str or None
    }
    """
    hr_lower = hr_message.lower()
    
    # Extract count (e.g., "3 students", "10 candidates", "5 profiles", "three students")
    count = None
    
    # Number word mapping
    number_words = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50
    }
    
    # Try number words first
    for word, num in number_words.items():
        if re.search(rf'\b{word}\b\s*(?:students?|candidates?|profiles?|people|members?)', hr_lower):
            count = num
            break
    
    # If no number word found, try digits
    if count is None:
        count_patterns = [
            r'(\d+)\s*(?:students?|candidates?|profiles?|people|members?)',
            r'(?:need|require|want)\s*(\d+)',
        ]
        for pattern in count_patterns:
            match = re.search(pattern, hr_lower)
            if match:
                count = int(match.group(1))
                break
    
    # Extract skills
    skills = []
    skill_keywords = {
        'python': ['python', 'py'],
        'java': ['java'],
        'javascript': ['javascript', 'js'],
        'c': [' c ', 'c programming', 'c language'],
        'cpp': ['c++', 'cpp'],
        'sql': ['sql', 'database'],
        'cloud': ['cloud', 'cloud computing', 'aws', 'azure', 'gcp'],
        'full stack': ['full stack', 'fullstack', 'full-stack'],
        'frontend': ['frontend', 'front-end', 'front end'],
        'backend': ['backend', 'back-end', 'back end'],
        'web development': ['web dev', 'web development'],
        'machine learning': ['machine learning', 'ml', 'ai'],
        'data science': ['data science', 'data analytics'],
    }
    
    for skill, keywords in skill_keywords.items():
        if any(keyword in hr_lower for keyword in keywords):
            skills.append(skill)
    
    # Extract domain
    domain = None
    domain_keywords = {
        'Cloud Computing': ['cloud', 'cloud computing', 'aws', 'azure', 'gcp'],
        'Full Stack': ['full stack', 'fullstack', 'full-stack'],
        'Software': ['software', 'software development'],
        'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml'],
        'Data Science': ['data science', 'data analytics'],
        'Web Development': ['web dev', 'web development'],
    }
    
    for dom, keywords in domain_keywords.items():
        if any(keyword in hr_lower for keyword in keywords):
            domain = dom
            break
    
    return {
        'count': count,
        'skills': skills,
        'domain': domain
    }
