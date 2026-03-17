"""
Mailgun inbound webhook handler.
"""
import logging
import uuid

from fastapi import APIRouter, Request
from app.database import SessionLocal
from app.models.campaign_lead import CampaignLead, CampaignLeadStatus
from app.models.contact import Contact, ContactStatus
from app.models.email_event import EmailEvent, EmailEventType
from app.models.unsubscribe import Unsubscribe

logger = logging.getLogger(__name__)
router = APIRouter()

EVENT_MAP = {
    "delivered": EmailEventType.delivered,
    "opened": EmailEventType.opened,
    "clicked": EmailEventType.clicked,
    "bounced": EmailEventType.bounced,
    "failed": EmailEventType.bounced,
}


@router.post("/mailgun")
async def mailgun_webhook(request: Request):
    form = await request.form()
    event_data = dict(form)

    event_type_raw = event_data.get("event", "")
    recipient = event_data.get("recipient", "")
    message_headers = event_data.get("message-headers", "[]")

    tracking_id = _extract_tracking_id(message_headers)
    if not tracking_id:
        return {"status": "ignored"}

    try:
        campaign_lead_id, step_order_str = tracking_id.split(":", 1)
        step_order = int(step_order_str)
    except (ValueError, AttributeError):
        return {"status": "error"}

    event_type = EVENT_MAP.get(event_type_raw)
    if not event_type:
        return {"status": "ignored"}

    db = SessionLocal()
    try:
        lead = db.query(CampaignLead).filter(CampaignLead.id == campaign_lead_id).first()
        if not lead:
            return {"status": "lead_not_found"}

        event = EmailEvent(
            id=str(uuid.uuid4()),
            campaign_lead_id=campaign_lead_id,
            step_order=step_order,
            event_type=event_type,
            event_metadata={"recipient": recipient, "event": event_type_raw},
        )
        db.add(event)

        if event_type == EmailEventType.bounced:
            lead.status = CampaignLeadStatus.opted_out
            contact = db.query(Contact).filter(Contact.id == lead.contact_id).first()
            if contact:
                contact.status = ContactStatus.bounced

        if event_type_raw == "unsubscribed":
            lead.status = CampaignLeadStatus.opted_out
            contact = db.query(Contact).filter(Contact.id == lead.contact_id).first()
            if contact:
                contact.status = ContactStatus.unsubscribed
            if not db.query(Unsubscribe).filter(Unsubscribe.email == recipient).first():
                db.add(Unsubscribe(email=recipient))

        db.commit()
        return {"status": "ok"}

    except Exception as exc:
        logger.error("Webhook error: %s", exc)
        db.rollback()
        return {"status": "error"}
    finally:
        db.close()


def _extract_tracking_id(message_headers_json: str) -> str | None:
    import json
    try:
        headers = json.loads(message_headers_json)
        for header in headers:
            if isinstance(header, list) and len(header) == 2:
                if header[0].lower() == "x-tracking-id":
                    return header[1]
    except (json.JSONDecodeError, TypeError):
        pass
    return None
