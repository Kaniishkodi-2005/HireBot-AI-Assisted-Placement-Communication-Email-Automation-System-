"""
Schemas for AI-extracted intent and message analysis
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date


class ExtractedIntent(BaseModel):
    """Structured intent extracted from HR email"""
    role: Optional[str] = Field(None, description="Job role/position mentioned")
    skills: List[str] = Field(default_factory=list, description="Required skills")
    positions_count: Optional[int] = Field(None, description="Number of positions/students needed")
    deadline: Optional[str] = Field(None, description="Application or response deadline")
    visit_date: Optional[str] = Field(None, description="Campus visit date if mentioned")
    commitments: List[str] = Field(default_factory=list, description="HR commitments or promises")
    action_items: List[str] = Field(default_factory=list, description="Required actions")
    urgency: str = Field("medium", description="Urgency level: low, medium, high")


class MessageClassification(BaseModel):
    """Classification of HR message type and sentiment"""
    category: str = Field(..., description="Message category: positive, need_info, not_interested, neutral")
    sentiment: str = Field(..., description="Overall sentiment: positive, neutral, negative")
    urgency: str = Field("medium", description="Urgency level: low, medium, high")
    confidence: float = Field(..., description="Confidence score 0-1")
    requesting_students: bool = Field(False, description="Whether HR is requesting student profiles")


class FollowUpAction(BaseModel):
    """Follow-up action recommendation"""
    action_type: str = Field(..., description="Type: reminder, send_profiles, schedule_call, etc.")
    due_date: Optional[str] = Field(None, description="When action should be taken")
    description: str = Field(..., description="Action description")
    priority: str = Field("medium", description="Priority: low, medium, high")


class DraftEmailResponse(BaseModel):
    """AI-generated draft email response"""
    subject: str = Field(..., description="Email subject line")
    content: str = Field(..., description="Email body content")
    requires_confirmation: bool = Field(True, description="Always true - requires human approval")
    extracted_intent: Optional[ExtractedIntent] = Field(None, description="Extracted intent from original message")
    suggested_students: List[dict] = Field(default_factory=list, description="Recommended students")
    follow_up_actions: List[FollowUpAction] = Field(default_factory=list, description="Recommended follow-ups")


class IntentExtractionRequest(BaseModel):
    """Request to extract intent from HR message"""
    message: str = Field(..., description="HR message text")
    company: Optional[str] = Field(None, description="Company name for context")


class DraftReplyRequest(BaseModel):
    """Request to generate draft reply"""
    hr_message: str = Field(..., description="HR message to reply to")
    contact_id: int = Field(..., description="HR contact ID")
    include_students: bool = Field(False, description="Whether to include student recommendations")


class MessageAnalysisRequest(BaseModel):
    """Request to analyze HR message"""
    message: str = Field(..., description="HR message text")
    context: Optional[str] = Field(None, description="Additional context")
