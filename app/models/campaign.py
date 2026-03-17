import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, nullable=False)
    persona_filters = Column(JSON, default=dict)
    status = Column(Enum(CampaignStatus), nullable=False, default=CampaignStatus.draft)
    email_channel = Column(Boolean, default=True)
    linkedin_channel = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    steps = relationship("SequenceStep", back_populates="campaign", order_by="SequenceStep.step_order")
    campaign_leads = relationship("CampaignLead", back_populates="campaign")
