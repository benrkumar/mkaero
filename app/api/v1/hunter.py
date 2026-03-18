from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.services.hunter_service import HunterService

router = APIRouter()


# ── Company Discover ─────────────────────────────────────────────────────────

class HunterDiscoverRequest(BaseModel):
    industry: Optional[str] = None
    country: Optional[str] = None       # ISO code e.g. "IN", "US"
    size_range: Optional[str] = None    # e.g. "11,50" or "51,200"
    company_type: Optional[str] = None  # private | public | non_profit | government
    keyword: Optional[str] = None
    max_companies: int = 20


class CompanyResult(BaseModel):
    name: str
    domain: str
    country: str
    size: str
    industry: str
    type: str
    description: str


class HunterDiscoverResponse(BaseModel):
    companies: List[CompanyResult]
    total: int


@router.post("/discover", response_model=HunterDiscoverResponse)
def discover_companies(body: HunterDiscoverRequest, db: Session = Depends(get_db)):
    try:
        service = HunterService(db)
        companies = service.discover_companies(
            industry=body.industry or None,
            country=body.country or None,
            size_range=body.size_range or None,
            company_type=body.company_type or None,
            keyword=body.keyword or None,
            max_companies=body.max_companies,
        )
        return HunterDiscoverResponse(
            companies=[CompanyResult(**c) for c in companies],
            total=len(companies),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Hunter.io API error: {exc}")


# ── Domain Search (import contacts from a domain) ────────────────────────────

class HunterDomainRequest(BaseModel):
    domain: str
    max_results: int = 50
    import_tag: str = "hunter-import"


class HunterDomainResult(BaseModel):
    fetched: int
    domain: str
    message: str


@router.post("/domain-search", response_model=HunterDomainResult)
def domain_search(body: HunterDomainRequest, db: Session = Depends(get_db)):
    try:
        service = HunterService(db)
        contacts = service.search_domain(
            db=db,
            domain=body.domain.strip().lower(),
            max_results=body.max_results,
            import_tag=body.import_tag or None,
        )
        return HunterDomainResult(
            fetched=len(contacts),
            domain=body.domain,
            message=f"Imported {len(contacts)} contacts from {body.domain}.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Hunter.io API error: {exc}")
