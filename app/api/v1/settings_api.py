from typing import Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.app_setting import AppSetting

router = APIRouter(prefix="/settings", tags=["Settings"])

SECRET_KEYS = {
    "apollo_api_key",
    "hunter_api_key",
    "mailgun_api_key",
    "anthropic_api_key",
    "gemini_api_key",
    "phantombuster_api_key",
    "phantombuster_network_booster_id",
    "phantombuster_message_sender_id",
    "linkedin_session_cookie",
}

ALL_KEYS = SECRET_KEYS | {"mailgun_domain", "mailgun_from", "mailgun_from_name", "ai_provider"}


def _mask(val: str) -> str:
    if not val:
        return ""
    return "••••••••"


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    rows = {r.key: r.value for r in db.query(AppSetting).all()}
    settings = {}
    has_value = {}
    for key in ALL_KEYS:
        val = rows.get(key, "")
        settings[key] = _mask(val) if key in SECRET_KEYS and val else val
        has_value[key] = bool(val)
    return {"settings": settings, "has_value": has_value}


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]


@router.put("")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in body.settings.items():
        if key not in ALL_KEYS:
            continue
        if not value or value == "••••••••":
            continue
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value))
    db.commit()
    return {"status": "saved"}
