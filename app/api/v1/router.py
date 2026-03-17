from fastapi import APIRouter

from app.api.v1 import contacts, campaigns, sequences, apollo, content, analytics, webhooks, wizard
from app.api.v1 import phantombuster as phantombuster_router
from app.api.v1 import settings_api

router = APIRouter()

router.include_router(contacts.router, prefix="/contacts", tags=["Contacts"])
router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
router.include_router(sequences.router, prefix="/sequences", tags=["Sequences"])
router.include_router(apollo.router, prefix="/apollo", tags=["Apollo"])
router.include_router(content.router, prefix="/content", tags=["Content"])
router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
router.include_router(wizard.router, prefix="/wizard", tags=["AI Wizard"])
router.include_router(phantombuster_router.router)
router.include_router(settings_api.router)
