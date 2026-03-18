"""
AI Campaign Wizard API.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_lead import CampaignLead, CampaignLeadStatus
from app.models.sequence_step import SequenceStep, StepChannel
from app.services.campaign_wizard_service import CampaignWizardService

# Human-readable step labels — no AI summarisation needed
STEP_LABELS = {
    1: "Introduction",
    2: "Social Proof",
    3: "Direct Ask",
    4: "Breakup",
}

logger = logging.getLogger(__name__)
router = APIRouter()


class WizardRequest(BaseModel):
    description: str
    max_leads: int = 100
    email_channel: bool = True
    linkedin_channel: bool = False
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
        plan = CampaignWizardService(db).generate_plan(body.description, body.max_leads)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")

    campaign = Campaign(
        id=str(uuid.uuid4()),
        name=plan["campaign_name"],
        persona_filters=plan["apollo_filters"],
        status=CampaignStatus.active if body.auto_start else CampaignStatus.draft,
        email_channel=body.email_channel,
        linkedin_channel=body.linkedin_channel,
    )
    db.add(campaign)
    db.flush()

    # Only include LinkedIn content when the channel is enabled
    li_note = plan.get("linkedin_connection_note", "") if body.linkedin_channel else ""
    li_followup = plan.get("linkedin_followup", "") if body.linkedin_channel else ""

    steps_preview = []
    for email_step in plan["email_sequence"]:
        step_num = email_step["step"]
        step = SequenceStep(
            id=str(uuid.uuid4()),
            campaign_id=campaign.id,
            step_order=step_num,
            channel=StepChannel.email,
            delay_days=email_step["delay_days"],
            subject_template=email_step["subject"],
            body_template=email_step["body"],
            linkedin_message_template=(
                li_note if step_num == 1 else li_followup
            ),
        )
        db.add(step)
        summary = STEP_LABELS.get(step_num, f"Step {step_num}")
        steps_preview.append(WizardStepPreview(
            step=step_num,
            delay_days=email_step["delay_days"],
            subject=email_step["subject"],
            body=email_step["body"],
            summary=summary,
        ))

    db.commit()

    return WizardResponse(
        campaign_id=campaign.id,
        campaign_name=plan["campaign_name"],
        summary=plan["summary"],
        apollo_filters=plan["apollo_filters"],
        steps_preview=steps_preview,
        linkedin_connection_note=li_note,
        linkedin_followup=li_followup,
        leads_fetched=0,
        leads_enrolled=0,
        status="active" if body.auto_start else "draft",
        message="Campaign created. Enter a company domain below to fetch and enroll leads.",
    )


class PhantombusterLaunchRequest(BaseModel):
    campaign_id: str
    step_type: str
    batch_size: int = 10


@router.post("/linkedin/launch")
def launch_linkedin_phantom(body: PhantombusterLaunchRequest, db: Session = Depends(get_db)):
    from app.services.phantombuster_service import PhantombusterService
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
    pb_service = PhantombusterService(db)
    if body.step_type == "connection":
        result = pb_service.send_connection_requests(profile_urls, message, min(body.batch_size, 20))
    else:
        result = pb_service.send_messages(profile_urls, message)
    return {"launched": len(profile_urls), "result": result}
