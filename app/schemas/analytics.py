from pydantic import BaseModel


class EmailStats(BaseModel):
    total_sent: int = 0
    delivered: int = 0
    opened: int = 0
    clicked: int = 0
    bounced: int = 0
    replied: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
    reply_rate: float = 0.0


class LinkedInStats(BaseModel):
    connections_sent: int = 0
    connections_accepted: int = 0
    messages_sent: int = 0
    replied: int = 0
    acceptance_rate: float = 0.0


class CampaignAnalytics(BaseModel):
    campaign_id: str
    campaign_name: str
    total_leads: int
    active_leads: int
    completed_leads: int
    replied_leads: int
    email: EmailStats
    linkedin: LinkedInStats


class OverviewAnalytics(BaseModel):
    total_campaigns: int
    active_campaigns: int
    total_contacts: int
    email: EmailStats
    linkedin: LinkedInStats


class StepAnalytics(BaseModel):
    step_order: int
    channel: str
    delay_days: int
    subject_template: str
    sent: int = 0
    opened: int = 0
    clicked: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
