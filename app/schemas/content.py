from typing import Literal

from pydantic import BaseModel


class ContentPreviewRequest(BaseModel):
    contact_id: str
    step_number: int
    channel: Literal["email", "linkedin"]
    campaign_goal: str = "book a 15-minute discovery call"


class EmailContentOut(BaseModel):
    subject: str
    body: str


class LinkedInContentOut(BaseModel):
    message: str


class RegenerateRequest(BaseModel):
    step_id: str
    contact_id: str
