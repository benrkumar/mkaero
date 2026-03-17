import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ContactStatus(str, enum.Enum):
    new = "new"
    in_campaign = "in_campaign"
    replied = "replied"
    unsubscribed = "unsubscribed"
    bounced = "bounced"


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    first_name = Column(Text, nullable=False, default="")
    last_name = Column(Text, nullable=False, default="")
    email = Column(String(320), unique=True, nullable=False, index=True)
    company = Column(Text, default="")
    title = Column(Text, default="")
    industry = Column(Text, default="")
    linkedin_url = Column(Text, default="")
    city = Column(Text, default="")
    country = Column(Text, default="")
    apollo_id = Column(String(100), unique=True, nullable=True, index=True)
    status = Column(Enum(ContactStatus), nullable=False, default=ContactStatus.new)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign_leads = relationship("CampaignLead", back_populates="contact")
