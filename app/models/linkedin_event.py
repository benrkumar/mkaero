import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class LinkedInEventType(str, enum.Enum):
    connection_sent = "connection_sent"
    connection_accepted = "connection_accepted"
    message_sent = "message_sent"
    replied = "replied"


class LinkedInEvent(Base):
    __tablename__ = "linkedin_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_lead_id = Column(String(36), ForeignKey("campaign_leads.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    event_type = Column(Enum(LinkedInEventType), nullable=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)

    campaign_lead = relationship("CampaignLead", back_populates="linkedin_events")
