"""
AI Campaign Wizard API.
"""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_lead import CampaignLead, CampaignLeadStatus
from app.models.contact import ContactStatus
from app.models.sequence_step import SequenceStep, StepChannel
from app.services.campaign_wizard_service import campaign_wizard_service
from app.services.apollo_service import apollo_service

logger = logging.getLogger(__name__)
router = APIRouter()


class WizardRequest(BaseModel):
    description: str
    max_leads: int = 100
    email_channel: bool = True
    linkedin_channel: bool = False
    auto_fetch_leads: bool = True
    auto_enroll: bool = True
    auto_start: bool = False


class WizardStepPreview(BaseModel):
    step: int
    delay_days: int
    subject: str
    body: str
    summary: str


class WizardResponse(BaseModel):
    campaign_id: str
    campaign_name: str
    summary: str
    apollo_filters: dict
    steps_preview: list[WizardStepPreview]
    linkedin_connection_note: str
    linkedin_followup: str
    leads_fetched: int
    leads_enrolled: int
    status: str
    message: str


@router.post("/generate", response_model=WizardResponse)
def generate_campaign(body: WizardRequest, db: Session = Depends(get_db)):
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="Description cannot be empty")

    try:
        plan = campaign_wizard_service.generate_plan(body.description, body.max_leads)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")

    campaign = Campaign(
        id=str(uuid.uuid4()),
        name=plan["campaign_name"],
        persona_filters=plan["apollo_filters"],
        status=CampaignStatus.draft,
        email_channel=body.email_channel,
        linkedin_channel=body.linkedin_channel,
    )
    db.add(campaign)
    db.flush()

    steps_preview = []
    for email_step in plan["email_sequence"]:
        step = SequenceStep(
            id=str(uuid.uuid4()),
            campaign_id=campaign.id,
            step_order=email_step["step"],
            channel=StepChannel.email,
            delay_days=email_step["delay_days"],
            subject_template=email_step["subject"],
            body_template=email_step["body"],
            linkedin_message_template=(
                plan["linkedin_connection_note"] if email_step["step"] == 1
                else plan["linkedin_followup"]
            ),
        )
        db.add(step)
        try:
            summary = campaign_wizard_service.summarize_email(email_step["subject"], email_step["body"])
        except Exception:
            summary = email_step["subject"]
        steps_preview.append(WizardStepPreview(
            step=email_step["step"],
            delay_days=email_step["delay_days"],
            subject=email_step["subject"],
            body=email_step["body"],
            summary=summary,
        ))

    db.commit()

    leads_fetched = 0
    leads_enrolled = 0
    filters = plan["apollo_filters"]

    if body.auto_fetch_leads and filters.get("job_titles"):
        try:
            contacts = apollo_service.fetch_leads(
                db=db,
                job_titles=filters.get("job_titles", []),
                industries=filters.get("industries", []),
                locations=filters.get("locations", ["India"]),
                company_sizes=filters.get("company_sizes"),
                max_results=body.max_leads,
            )
            leads_fetched = len(contacts)
            if body.auto_enroll and contacts:
                first_step_order = plan["email_sequence"][0]["step"]
                for contact in contacts:
                    existing = db.query(CampaignLead).filter(
                        CampaignLead.campaign_id == campaign.id,
                        CampaignLead.contact_id == contact.id,
                    ).first()
                    if not existing:
                        db.add(CampaignLead(
                            id=str(uuid.uuid4()),
                            campaign_id=campaign.id,
                            contact_id=contact.id,
                            current_step=first_step_order,
                            status=CampaignLeadStatus.active,
                            next_send_at=datetime.utcnow(),
                        ))
                        contact.status = ContactStatus.in_campaign
                        leads_enrolled += 1
                db.commit()
        except Exception as exc:
            logger.warning("Apollo fetch skipped: %s", exc)

    if body.auto_start and leads_enrolled > 0:
        campaign.status = CampaignStatus.active
        db.commit()

    parts = [f"Campaign created."]
    if leads_fetched:
        parts.append(f"{leads_fetched} leads fetched, {leads_enrolled} enrolled.")
    else:
        parts.append("Add your Apollo API key in Settings to auto-import leads.")

    return WizardResponse(
        campaign_id=campaign.id,
        campaign_name=plan["campaign_name"],
        summary=plan["summary"],
        apollo_filters=plan["apollo_filters"],
        steps_preview=steps_preview,
        linkedin_connection_note=plan.get("linkedin_connection_note", ""),
        linkedin_followup=plan.get("linkedin_followup", ""),
        leads_fetched=leads_fetched,
        leads_enrolled=leads_enrolled,
        status="active" if body.auto_start and leads_enrolled > 0 else "draft",
        message=" ".join(parts),
    )


class PhantombusterLaunchRequest(BaseModel):
    campaign_id: str
    step_type: str
    batch_size: int = 10


@router.post("/linkedin/launch")
def launch_linkedin_phantom(body: PhantombusterLaunchRequest, db: Session = Depends(get_db)):
    from app.services.phantombuster_service import phantombuster_service
    campaign = db.query(Campaign).filter(Campaign.id == body.campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    leads = (
        db.query(CampaignLead)
        .join(Campaign.campaign_leads)
        .filter(
            CampaignLead.campaign_id == body.campaign_id,
            CampaignLead.status == CampaignLeadStatus.active,
        )
        .limit(body.batch_size)
        .all()
    )
    profile_urls = [l.contact.linkedin_url for l in leads if l.contact.linkedin_url]
    if not profile_urls:
        raise HTTPException(status_code=400, detail="No leads with LinkedIn URLs")
    first_step = db.query(SequenceStep).filter(
        SequenceStep.campaign_id == body.campaign_id
    ).order_by(SequenceStep.step_order).first()
    message = first_step.linkedin_message_template if first_step else ""
    if body.step_type == "connection":
        result = phantombuster_service.send_connection_requests(profile_urls, message, min(body.batch_size, 20))
    else:
        result = phantombuster_service.send_messages(profile_urls, message)
    return {"launched": len(profile_urls), "result": result}
