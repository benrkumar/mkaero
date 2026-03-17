from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from app.models.contact import ContactStatus


class ContactBase(BaseModel):
    first_name: str = ""
    last_name: str = ""
    email: EmailStr
    company: str = ""
    title: str = ""
    industry: str = ""
    linkedin_url: str = ""
    city: str = ""
    country: str = ""
    tags: List[str] = []


class ContactCreate(ContactBase):
    apollo_id: Optional[str] = None


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    industry: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    status: Optional[ContactStatus] = None
    tags: Optional[List[str]] = None


class ContactOut(ContactBase):
    id: str
    apollo_id: Optional[str]
    status: ContactStatus
    created_at: datetime
    tags: List[str] = []

    model_config = {"from_attributes": True}


class ContactList(BaseModel):
    items: list[ContactOut]
    total: int
    page: int
    page_size: int
