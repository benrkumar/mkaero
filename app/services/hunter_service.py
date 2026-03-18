"""
Hunter.io lead sourcing service.

Two modes:
  1. Company Discover — filter companies by industry, country, size, type, keywords
     → returns a list of companies with their domains
  2. Domain Search — find all emails at a given domain
     → upserts Contacts into the DB

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

    # ── Company Discover ──────────────────────────────────────────────────────

    def discover_companies(
        self,
        industry: str | None = None,
        country: str | None = None,
        size_range: str | None = None,
        company_type: str | None = None,
        keyword: str | None = None,
        max_companies: int = 20,
    ) -> list[dict]:
        """
        Search for companies using Hunter's Companies API.
        Returns a list of company dicts: {name, domain, country, size, industry, type}.
        Does NOT touch the DB — caller decides whether to import contacts.
        """
        if not self.api_key:
            raise ValueError("Hunter.io API key is not configured. Add it in Settings.")

        params: dict = {"api_key": self.api_key, "limit": min(max_companies, 100)}
        if industry:
            params["industry"] = industry
        if country:
            params["country"] = country
        if size_range:
            params["size_range"] = size_range
        if company_type:
            params["type"] = company_type
        if keyword:
            params["keyword"] = keyword

        with httpx.Client(timeout=30) as client:
            resp = client.get(f"{HUNTER_BASE}/companies", params=params)
            resp.raise_for_status()
            data = resp.json()

        raw_companies: list[dict] = data.get("data", {}).get("companies", [])
        companies = []
        for c in raw_companies:
            domain = c.get("domain") or ""
            if not domain:
                continue
            companies.append({
                "name": c.get("company_name") or c.get("name") or domain,
                "domain": domain,
                "country": c.get("country") or "",
                "size": c.get("size") or "",
                "industry": c.get("industry") or "",
                "type": c.get("type") or "",
                "description": c.get("description") or "",
            })

        logger.info("Hunter discover returned %d companies", len(companies))
        return companies

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
