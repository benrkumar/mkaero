from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.schemas.analytics import CampaignAnalytics, OverviewAnalytics
from app.services.analytics_service import get_campaign_analytics, get_overview_analytics

router = APIRouter()


@router.get("/overview", response_model=OverviewAnalytics)
def overview(db: Session = Depends(get_db)):
    return get_overview_analytics(db)


@router.get("/campaigns/{campaign_id}", response_model=CampaignAnalytics)
def campaign_analytics(campaign_id: str, db: Session = Depends(get_db)):
    try:
        return get_campaign_analytics(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
