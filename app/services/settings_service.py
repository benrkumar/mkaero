"""
Reads app settings from the DB (app_settings table), falling back to env config.
This allows credentials entered in the Settings UI to be used by all services.
"""
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.config import settings as _env


def get_setting(db: Session, key: str) -> str:
    """Return setting from DB if present, else fall back to env."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row and row.value:
        return row.value
    return str(getattr(_env, key, "") or "")
