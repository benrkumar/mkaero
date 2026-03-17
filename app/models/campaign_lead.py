import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class CampaignLeadStatus(str, enum.Enum):
    active = "active"
    replied = "replied"
    opted_out = "opted_out"
    completed = "completed"
    paused = "paused"


class CampaignLead(Base):
    __tablename__ = "campaign_leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    current_step = Column(Integer, nullable=False, default=1)
    status = Column(Enum(CampaignLeadStatus), nullable=False, default=CampaignLeadStatus.active)
    next_send_at = Column(DateTime, nullable=True)
    enrolled_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="campaign_leads")
    contact = relationship("Contact", back_populates="campaign_leads")
    email_events = relationship("EmailEvent", back_populates="campaign_lead")
    linkedin_events = relationship("LinkedInEvent", back_populates="campaign_lead")
