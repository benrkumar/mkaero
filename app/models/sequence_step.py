import enum
import uuid

from sqlalchemy import Column, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class StepChannel(str, enum.Enum):
    email = "email"
    linkedin = "linkedin"


class SequenceStep(Base):
    __tablename__ = "sequence_steps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    channel = Column(Enum(StepChannel), nullable=False, default=StepChannel.email)
    delay_days = Column(Integer, nullable=False, default=0)
    subject_template = Column(Text, default="")
    body_template = Column(Text, default="")
    linkedin_message_template = Column(Text, default="")

    campaign = relationship("Campaign", back_populates="steps")
