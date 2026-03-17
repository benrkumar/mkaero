from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.services.apollo_service import apollo_service

router = APIRouter()


class ApolloFetchRequest(BaseModel):
    job_titles: list[str]
    industries: list[str] = []
    locations: list[str] = ["India"]
    company_sizes: list[str] | None = None
    max_results: int = 100


class ApolloFetchResult(BaseModel):
    fetched: int
    message: str


@router.post("/fetch", response_model=ApolloFetchResult)
def fetch_leads(body: ApolloFetchRequest, db: Session = Depends(get_db)):
    try:
        contacts = apollo_service.fetch_leads(
            db=db,
            job_titles=body.job_titles,
            industries=body.industries,
            locations=body.locations,
            company_sizes=body.company_sizes,
            max_results=body.max_results,
        )
        return ApolloFetchResult(
            fetched=len(contacts),
            message=f"Successfully fetched and stored {len(contacts)} contacts from Apollo.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Apollo API error: {exc}")
