"""
Analytics aggregation service.
Computes email and LinkedIn stats per campaign and globally.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_lead import CampaignLead, CampaignLeadStatus
from app.models.contact import Contact
from app.models.email_event import EmailEvent, EmailEventType
from app.models.linkedin_event import LinkedInEvent, LinkedInEventType
from app.schemas.analytics import (
    CampaignAnalytics,
    EmailStats,
    LinkedInStats,
    OverviewAnalytics,
)


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator * 100, 1)


def _email_stats_for_leads(db: Session, campaign_lead_ids: list) -> EmailStats:
    if not campaign_lead_ids:
        return EmailStats()

    def count_event(event_type: EmailEventType) -> int:
        return (
            db.query(func.count(EmailEvent.id))
            .filter(
                EmailEvent.campaign_lead_id.in_(campaign_lead_ids),
                EmailEvent.event_type == event_type,
            )
            .scalar()
            or 0
        )

    sent = count_event(EmailEventType.sent)
    delivered = count_event(EmailEventType.delivered)
    opened = count_event(EmailEventType.opened)
    clicked = count_event(EmailEventType.clicked)
    bounced = count_event(EmailEventType.bounced)
    replied = count_event(EmailEventType.replied)

    return EmailStats(
        total_sent=sent,
        delivered=delivered,
        opened=opened,
        clicked=clicked,
        bounced=bounced,
        replied=replied,
        open_rate=_safe_rate(opened, delivered or sent),
        click_rate=_safe_rate(clicked, delivered or sent),
        reply_rate=_safe_rate(replied, delivered or sent),
    )


def _linkedin_stats_for_leads(db: Session, campaign_lead_ids: list) -> LinkedInStats:
    if not campaign_lead_ids:
        return LinkedInStats()

    def count_event(event_type: LinkedInEventType) -> int:
        return (
            db.query(func.count(LinkedInEvent.id))
            .filter(
                LinkedInEvent.campaign_lead_id.in_(campaign_lead_ids),
                LinkedInEvent.event_type == event_type,
            )
            .scalar()
            or 0
        )

    sent = count_event(LinkedInEventType.connection_sent)
    accepted = count_event(LinkedInEventType.connection_accepted)
    messages = count_event(LinkedInEventType.message_sent)
    replied = count_event(LinkedInEventType.replied)

    return LinkedInStats(
        connections_sent=sent,
        connections_accepted=accepted,
        messages_sent=messages,
        replied=replied,
        acceptance_rate=_safe_rate(accepted, sent),
    )


def get_campaign_analytics(db: Session, campaign_id: str) -> CampaignAnalytics:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    leads = db.query(CampaignLead).filter(CampaignLead.campaign_id == campaign_id).all()
    lead_ids = [str(l.id) for l in leads]

    active = sum(1 for l in leads if l.status == CampaignLeadStatus.active)
    completed = sum(1 for l in leads if l.status == CampaignLeadStatus.completed)
    replied = sum(1 for l in leads if l.status == CampaignLeadStatus.replied)

    return CampaignAnalytics(
        campaign_id=str(campaign_id),
        campaign_name=campaign.name,
        total_leads=len(leads),
        active_leads=active,
        completed_leads=completed,
        replied_leads=replied,
        email=_email_stats_for_leads(db, lead_ids),
        linkedin=_linkedin_stats_for_leads(db, lead_ids),
    )


def get_overview_analytics(db: Session) -> OverviewAnalytics:
    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    active_campaigns = (
        db.query(func.count(Campaign.id))
        .filter(Campaign.status == CampaignStatus.active)
        .scalar()
        or 0
    )
    total_contacts = db.query(func.count(Contact.id)).scalar() or 0

    all_lead_ids = [str(r[0]) for r in db.query(CampaignLead.id).all()]

    return OverviewAnalytics(
        total_campaigns=total_campaigns,
        active_campaigns=active_campaigns,
        total_contacts=total_contacts,
        email=_email_stats_for_leads(db, all_lead_ids),
        linkedin=_linkedin_stats_for_leads(db, all_lead_ids),
    )
