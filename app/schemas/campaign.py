from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.models.campaign import CampaignStatus
from app.models.sequence_step import StepChannel


class SequenceStepOut(BaseModel):
    id: str
    step_order: int
    channel: StepChannel
    delay_days: int
    subject_template: str
    body_template: str
    linkedin_message_template: str

    model_config = {"from_attributes": True}


class SequenceStepCreate(BaseModel):
    step_order: int
    channel: StepChannel = StepChannel.email
    delay_days: int = 0
    subject_template: str = ""
    body_template: str = ""
    linkedin_message_template: str = ""


class SequenceStepUpdate(BaseModel):
    delay_days: Optional[int] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    linkedin_message_template: Optional[str] = None


class CampaignCreate(BaseModel):
    name: str
    persona_filters: dict[str, Any] = {}
    email_channel: bool = True
    linkedin_channel: bool = False


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    persona_filters: Optional[dict[str, Any]] = None
    email_channel: Optional[bool] = None
    linkedin_channel: Optional[bool] = None
    status: Optional[CampaignStatus] = None


class CampaignOut(BaseModel):
    id: str
    name: str
    persona_filters: dict[str, Any]
    status: CampaignStatus
    email_channel: bool
    linkedin_channel: bool
    created_at: datetime
    steps: list[SequenceStepOut] = []

    model_config = {"from_attributes": True}


class EnrollRequest(BaseModel):
    contact_ids: list[str]


class CampaignLeadOut(BaseModel):
    id: str
    contact_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    status: str
    current_step: int
    next_send_at: Optional[datetime] = None
    enrolled_at: Optional[datetime] = None
