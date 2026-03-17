from datetime import datetime

from sqlalchemy import Column, DateTime, String

from app.database import Base


class Unsubscribe(Base):
    __tablename__ = "unsubscribes"

    email = Column(String(320), primary_key=True)
    unsubscribed_at = Column(DateTime, default=datetime.utcnow)
