from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.services.hunter_service import HunterService

router = APIRouter()


class HunterSearchRequest(BaseModel):
    domain: str
    max_results: int = 100
    import_tag: str = "hunter-import"


class HunterSearchResult(BaseModel):
    fetched: int
    domain: str
    message: str


@router.post("/domain-search", response_model=HunterSearchResult)
def domain_search(body: HunterSearchRequest, db: Session = Depends(get_db)):
    try:
        service = HunterService(db)
        contacts = service.search_domain(
            db=db,
            domain=body.domain.strip().lower(),
            max_results=body.max_results,
            import_tag=body.import_tag or None,
        )
        return HunterSearchResult(
            fetched=len(contacts),
            domain=body.domain,
            message=f"Found and stored {len(contacts)} contacts from {body.domain}.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Hunter.io API error: {exc}")
