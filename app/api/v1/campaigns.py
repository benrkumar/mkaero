from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_lead import CampaignLead, CampaignLeadStatus
from app.models.contact import Contact, ContactStatus
from app.schemas.campaign import CampaignCreate, CampaignLeadOut, CampaignOut, CampaignUpdate, EnrollRequest

router = APIRouter()


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)):
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("", response_model=CampaignOut, status_code=201)
def create_campaign(body: CampaignCreate, db: Session = Depends(get_db)):
    campaign = Campaign(**body.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update_campaign(campaign_id: str, body: CampaignUpdate, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(campaign, field, value)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/run")
def run_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.steps:
        raise HTTPException(status_code=400, detail="Campaign has no sequence steps defined")
    campaign.status = CampaignStatus.active
    db.commit()
    return {"message": f"Campaign '{campaign.name}' is now active"}


@router.post("/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatus.paused
    db.commit()
    return {"message": f"Campaign '{campaign.name}' paused"}


@router.post("/{campaign_id}/enroll")
def enroll_contacts(campaign_id: str, body: EnrollRequest, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.steps:
        raise HTTPException(status_code=400, detail="Add sequence steps before enrolling contacts")

    first_step = campaign.steps[0]
    enrolled = 0
    skipped = 0

    for contact_id in body.contact_ids:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            skipped += 1
            continue

        existing = (
            db.query(CampaignLead)
            .filter(
                CampaignLead.campaign_id == campaign_id,
                CampaignLead.contact_id == contact_id,
                CampaignLead.status == CampaignLeadStatus.active,
            )
            .first()
        )
        if existing:
            skipped += 1
            continue

        lead = CampaignLead(
            campaign_id=campaign_id,
            contact_id=contact_id,
            current_step=first_step.step_order,
            status=CampaignLeadStatus.active,
            next_send_at=datetime.utcnow(),
        )
        db.add(lead)
        contact.status = ContactStatus.in_campaign
        enrolled += 1

    db.commit()
    return {"enrolled": enrolled, "skipped": skipped}


@router.get("/{campaign_id}/leads", response_model=list[CampaignLeadOut])
def list_campaign_leads(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    leads = (
        db.query(CampaignLead)
        .filter(CampaignLead.campaign_id == campaign_id)
        .all()
    )
    result = []
    for lead in leads:
        contact = lead.contact
        result.append(CampaignLeadOut(
            id=lead.id,
            contact_id=lead.contact_id,
            first_name=contact.first_name if contact else None,
            last_name=contact.last_name if contact else None,
            email=contact.email if contact else None,
            company=contact.company if contact else None,
            status=lead.status.value,
            current_step=lead.current_step,
            next_send_at=lead.next_send_at,
            enrolled_at=lead.enrolled_at,
        ))
    return result


@router.delete("/{campaign_id}/leads/{lead_id}", status_code=204)
def unenroll_lead(campaign_id: str, lead_id: str, db: Session = Depends(get_db)):
    lead = (
        db.query(CampaignLead)
        .filter(CampaignLead.id == lead_id, CampaignLead.campaign_id == campaign_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found in campaign")
    db.delete(lead)
    db.commit()


class TestEmailRequest(BaseModel):
    step_id: str
    to_email: str
    to_name: str = "Test User"

@router.post("/{campaign_id}/test-email")
def send_test_email(campaign_id: str, body: TestEmailRequest, db: Session = Depends(get_db)):
    from app.models.sequence_step import SequenceStep
    from app.services.email_service import EmailService, render_html_body
    import re

    step = db.query(SequenceStep).filter(SequenceStep.id == body.step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    # Sample contact for preview rendering
    sample = {
        "first_name": "Alex", "last_name": "Chen", "company": "Acme Corp",
        "title": "Head of Operations", "city": "Mumbai", "industry": "Manufacturing"
    }

    def render(template: str) -> str:
        result = template or ""
        for k, v in sample.items():
            result = result.replace("{{" + k + "}}", v)
        return result

    subject = render(step.subject_template or "")
    body_text = render(step.body_template or "")
    html_body = render_html_body(body_text)

    svc = EmailService(db)
    msg_id = svc.send(
        to_email=body.to_email,
        to_name=body.to_name,
        subject=f"[TEST] {subject}",
        text_body=body_text,
        html_body=html_body,
        tracking_id="test",
        campaign_id="test",
    )
    if msg_id:
        return {"sent": True, "message_id": msg_id}
    raise HTTPException(status_code=502, detail="Failed to send test email. Check Mailgun credentials.")


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
