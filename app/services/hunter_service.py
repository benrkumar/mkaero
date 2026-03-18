"""
Hunter.io lead sourcing service.

Capability: Domain Search — find all verified email addresses at a given domain
and upsert them as Contact records in the DB.

API docs: https://hunter.io/api-documentation/v2
"""
import logging
import uuid

import httpx
from sqlalchemy.orm import Session

from app.models.contact import Contact, ContactStatus
from app.services.settings_service import get_setting

logger = logging.getLogger(__name__)

HUNTER_BASE = "https://api.hunter.io/v2"


class HunterService:
    def __init__(self, db: Session):
        self.api_key = get_setting(db, "hunter_api_key")

    # ── Domain Search (import contacts) ────────────────────────────────────────

    def search_domain(
        self,
        db: Session,
        domain: str,
        max_results: int = 100,
        import_tag: str | None = None,
    ) -> list[Contact]:
        """
        Find email addresses at a company domain using Hunter.io.
        Returns a list of Contact objects (upserted into DB).
        """
        if not self.api_key:
            raise ValueError("Hunter.io API key is not configured. Add it in Settings.")

        saved: list[Contact] = []
        limit = min(max_results, 100)
        offset = 0

        with httpx.Client(timeout=30) as client:
            while len(saved) < max_results:
                params = {
                    "domain": domain,
                    "api_key": self.api_key,
                    "limit": limit,
                    "offset": offset,
                }
                resp = client.get(f"{HUNTER_BASE}/domain-search", params=params)
                resp.raise_for_status()
                data = resp.json()

                emails: list[dict] = data.get("data", {}).get("emails", [])
                organization = data.get("data", {}).get("organization") or ""
                if not emails:
                    break

                for entry in emails:
                    if len(saved) >= max_results:
                        break
                    contact = self._upsert_contact(db, entry, domain, organization, import_tag)
                    if contact:
                        saved.append(contact)

                if len(emails) < limit:
                    break
                offset += limit

        logger.info("Hunter domain search '%s': %d contacts saved", domain, len(saved))
        return saved

    # ── Internal ─────────────────────────────────────────────────────────────

    def _upsert_contact(
        self,
        db: Session,
        entry: dict,
        domain: str,
        organization: str,
        import_tag: str | None,
    ) -> Contact | None:
        email = entry.get("value")
        if not email:
            return None

        existing = db.query(Contact).filter(Contact.email == email).first()
        if existing:
            if import_tag and import_tag not in (existing.tags or []):
                existing.tags = list(existing.tags or []) + [import_tag]
                db.commit()
            return existing

        tags: list[str] = []
        if import_tag:
            tags.append(import_tag)

        contact = Contact(
            id=str(uuid.uuid4()),
            first_name=entry.get("first_name") or "",
            last_name=entry.get("last_name") or "",
            email=email,
            company=organization,
            title=entry.get("position") or "",
            industry="",
            linkedin_url=entry.get("linkedin") or "",
            city="",
            country="",
            apollo_id=None,
            status=ContactStatus.new,
            tags=tags,
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact
