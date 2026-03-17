"""
Apollo.io lead sourcing service.
"""
import logging
import uuid
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.contact import Contact, ContactStatus

logger = logging.getLogger(__name__)

APOLLO_BASE = "https://api.apollo.io/v1"
PAGE_SIZE = 25


class ApolloService:
    def __init__(self):
        self.api_key = settings.apollo_api_key

    def fetch_leads(
        self,
        db: Session,
        job_titles: list[str],
        industries: list[str],
        locations: list[str],
        company_sizes: list[str] | None = None,
        max_results: int = 500,
    ) -> list[Contact]:
        if not self.api_key:
            raise ValueError("APOLLO_API_KEY is not configured")

        saved: list[Contact] = []
        page = 1

        with httpx.Client(timeout=30) as client:
            while len(saved) < max_results:
                payload: dict[str, Any] = {
                    "api_key": self.api_key,
                    "page": page,
                    "per_page": PAGE_SIZE,
                    "person_titles": job_titles,
                    "person_locations": locations,
                }
                if industries:
                    payload["organization_industry_tag_ids"] = industries
                if company_sizes:
                    payload["organization_num_employees_ranges"] = company_sizes

                resp = client.post(f"{APOLLO_BASE}/mixed_people/search", json=payload)
                resp.raise_for_status()
                data = resp.json()

                people: list[dict] = data.get("people", [])
                if not people:
                    break

                for person in people:
                    if len(saved) >= max_results:
                        break
                    contact = self._upsert_contact(db, person)
                    if contact:
                        saved.append(contact)

                pagination = data.get("pagination", {})
                if page >= pagination.get("total_pages", 1):
                    break
                page += 1

        logger.info("Apollo fetch complete: %d contacts saved", len(saved))
        return saved

    def _upsert_contact(self, db: Session, person: dict) -> Contact | None:
        email = person.get("email")
        if not email:
            return None

        apollo_id = person.get("id")

        existing = db.query(Contact).filter(Contact.email == email).first()
        if existing:
            return existing

        if apollo_id:
            existing = db.query(Contact).filter(Contact.apollo_id == apollo_id).first()
            if existing:
                return existing

        contact = Contact(
            id=str(uuid.uuid4()),
            first_name=person.get("first_name") or "",
            last_name=person.get("last_name") or "",
            email=email,
            company=person.get("organization", {}).get("name") or person.get("organization_name") or "",
            title=person.get("title") or "",
            industry=person.get("organization", {}).get("industry") or "",
            linkedin_url=person.get("linkedin_url") or "",
            city=person.get("city") or "",
            country=person.get("country") or "",
            apollo_id=apollo_id,
            status=ContactStatus.new,
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact


apollo_service = ApolloService()
