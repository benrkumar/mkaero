"""
Drip Scheduler - runs every 15 minutes via APScheduler.
Finds campaign leads that are due for their next step and sends emails / LinkedIn outreach.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_lead import CampaignLead, CampaignLeadStatus
from app.models.contact import Contact, ContactStatus
from app.models.sequence_step import SequenceStep, StepChannel
from app.models.email_event import EmailEvent, EmailEventType
from app.models.linkedin_event import LinkedInEvent, LinkedInEventType

logger = logging.getLogger(__name__)


def _render(template: str, contact: Contact) -> str:
    """Replace {{first_name}} etc. placeholders in a template string."""
    if not template:
        return ""
    return (
        template
        .replace("{{first_name}}", contact.first_name or "")
        .replace("{{last_name}}", contact.last_name or "")
        .replace("{{company}}", contact.company or "")
        .replace("{{title}}", contact.title or "")
        .replace("{{city}}", contact.city or "")
        .replace("{{industry}}", contact.industry or "")
    )


def _send_email_step(db: Session, lead: CampaignLead, step: SequenceStep) -> bool:
    """Send an email for the given step. Returns True on success."""
    try:
        from app.services.email_service import EmailService, render_html_body
        email_service = EmailService(db)
        contact = lead.contact
        subject = _render(step.subject_template or "", contact)
        body = _render(step.body_template or "", contact)
        html_body = render_html_body(body)
        if not contact.email:
            logger.warning("Contact %s has no email, skipping", contact.id)
            return False
        msg_id = email_service.send(
            to_email=contact.email,
            to_name=f"{contact.first_name} {contact.last_name}",
            subject=subject,
            text_body=body,
            html_body=html_body,
            tracking_id=f"{lead.id}:{step.step_order}",
            campaign_id=str(lead.campaign_id),
        )
        db.add(EmailEvent(
            campaign_lead_id=lead.id,
            step_order=step.step_order,
            event_type=EmailEventType.sent,
            mailgun_message_id=msg_id,
        ))
        db.commit()
        logger.info("Email sent to %s (step %s)", contact.email, step.step_order)
        return True
    except Exception as exc:
        logger.error("Email send failed for lead %s step %s: %s", lead.id, step.step_order, exc)
        return False


def _batch_linkedin_step(
    db: Session,
    campaign_id: str,
    step: SequenceStep,
    leads_for_step: list,
    step_type: str,
) -> None:
    """Batch send LinkedIn connection requests or messages via Phantombuster."""
    try:
        from app.services.phantombuster_service import PhantombusterService
        phantombuster_service = PhantombusterService(db)
        profile_urls = []
        lead_map = {}
        for lead in leads_for_step:
            contact = lead.contact
            url = contact.linkedin_url if contact else None
            if url:
                profile_urls.append(url)
                lead_map[url] = lead

        if not profile_urls:
            logger.info("No LinkedIn URLs for campaign %s step %s, skipping", campaign_id, step.step_order)
            return

        message = _render(step.linkedin_message_template or "", leads_for_step[0].contact)

        if step_type == "connection":
            result = phantombuster_service.send_connection_requests(
                profile_urls=profile_urls,
                message=message,
                adds_per_launch=min(len(profile_urls), 20),
            )
            event_type = LinkedInEventType.connection_sent
        else:
            result = phantombuster_service.send_messages(
                profile_urls=profile_urls,
                message=message,
            )
            event_type = LinkedInEventType.message_sent

        # Record events for all leads in this batch
        for lead in leads_for_step:
            contact = lead.contact
            if contact and contact.linkedin_url in lead_map:
                db.add(LinkedInEvent(
                    campaign_lead_id=lead.id,
                    step_order=step.step_order,
                    event_type=event_type,
                ))
        db.commit()
        logger.info(
            "Phantombuster %s launched for %s profiles (campaign %s step %s): %s",
            step_type, len(profile_urls), campaign_id, step.step_order, result,
        )
    except Exception as exc:
        logger.error("LinkedIn batch failed for campaign %s step %s: %s", campaign_id, step.step_order, exc)


def tick() -> None:
    """Main drip scheduler tick. Called every 15 minutes."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        logger.info("Drip tick at %s UTC", now.isoformat())

        # Find all active campaign leads that are due
        due_leads = (
            db.query(CampaignLead)
            .join(Campaign, Campaign.id == CampaignLead.campaign_id)
            .filter(
                CampaignLead.status == CampaignLeadStatus.active,
                CampaignLead.next_send_at <= now,
                Campaign.status == CampaignStatus.active,
            )
            .all()
        )

        if not due_leads:
            logger.info("No leads due for sending.")
            return

        logger.info("Found %s due leads.", len(due_leads))

        # Group by campaign + step for LinkedIn batching
        linkedin_batches: dict[tuple, list] = {}

        for lead in due_leads:
            step = (
                db.query(SequenceStep)
                .filter(
                    SequenceStep.campaign_id == lead.campaign_id,
                    SequenceStep.step_order == lead.current_step,
                )
                .first()
            )

            if not step:
                # No step found - mark completed
                lead.status = CampaignLeadStatus.completed
                if lead.contact:
                    lead.contact.status = ContactStatus.replied
                db.commit()
                continue

            campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()
            if not campaign:
                continue

            # --- EMAIL CHANNEL ---
            if campaign.email_channel and step.channel == StepChannel.email:
                _send_email_step(db, lead, step)

            # --- LINKEDIN CHANNEL (batch per campaign+step) ---
            if campaign.linkedin_channel and step.channel == StepChannel.linkedin:
                # LinkedIn connection on step 1, messages on later steps
                step_type = "connection" if step.step_order == 1 else "message"
                key = (lead.campaign_id, step.step_order, step_type)
                if key not in linkedin_batches:
                    linkedin_batches[key] = []
                linkedin_batches[key].append(lead)

            # --- ADVANCE LEAD STATE ---
            next_step = (
                db.query(SequenceStep)
                .filter(
                    SequenceStep.campaign_id == lead.campaign_id,
                    SequenceStep.step_order > lead.current_step,
                )
                .order_by(SequenceStep.step_order)
                .first()
            )

            if next_step:
                lead.current_step = next_step.step_order
                lead.next_send_at = now + timedelta(days=next_step.delay_days)
            else:
                # All steps done
                lead.status = CampaignLeadStatus.completed
                if lead.contact:
                    lead.contact.status = ContactStatus.replied

            db.commit()

        # --- BATCH LINKEDIN SENDS ---
        for (campaign_id, step_order, step_type), leads_batch in linkedin_batches.items():
            step = (
                db.query(SequenceStep)
                .filter(
                    SequenceStep.campaign_id == campaign_id,
                    SequenceStep.step_order == step_order,
                )
                .first()
            )
            if step:
                _batch_linkedin_step(db, campaign_id, step, leads_batch, step_type)

    except Exception as exc:
        logger.error("Drip tick error: %s", exc, exc_info=True)
    finally:
        db.close()
