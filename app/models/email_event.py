import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class EmailEventType(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    opened = "opened"
    clicked = "clicked"
    bounced = "bounced"
    replied = "replied"


class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_lead_id = Column(String(36), ForeignKey("campaign_leads.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    event_type = Column(Enum(EmailEventType), nullable=False)
    mailgun_message_id = Column(Text, nullable=True)
    event_metadata = Column(JSON, default=dict)
    occurred_at = Column(DateTime, default=datetime.utcnow)

    campaign_lead = relationship("CampaignLead", back_populates="email_events")
