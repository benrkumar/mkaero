"""
AI content generation service using Claude API.

Generates personalized email copy and LinkedIn messages for each
contact based on their role, company, and industry.
"""
import json
import logging
from typing import Literal

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.models.contact import Contact
from app.services.settings_service import get_setting

logger = logging.getLogger(__name__)

BRAND_VOICE = """
You are a B2B outreach specialist writing on behalf of Indo Aerial Systems Pvt Ltd.,
an Indian drone parts manufacturer. Brand tagline: "Tough Parts. Smart Prices. Made in India."

Products: drone frames, brushless motors, ESCs (electronic speed controllers),
propellers, flight controllers, GPS modules, LiPo batteries, FPV cameras.

Brand voice:
- Confident and direct — no fluff
- Technical credibility (speak the language of engineers/procurement)
- Pride in being Made in India, domestic sourcing advantage
- Value-forward: emphasize cost savings vs. imports, short lead times, local support
- Never pushy — always human, never spammy

Key pain points we solve for buyers:
- Long import lead times from China/Taiwan (we deliver in 5–7 days domestically)
- Quality inconsistency with grey-market imports
- Currency/customs risk on dollar-denominated components
- No local technical support for imported parts
- PLI scheme benefits for sourcing domestic components
"""

STEP_CONTEXT = {
    1: "Introduction — introduce Indo Aerial Systems and why we're reaching out. Mention one pain point specific to their role. Soft CTA (reply or book a quick call). Max 120 words.",
    2: "Value proof — share a concrete outcome or mini case study (e.g., 'A drone OEM in Pune cut motor costs by 28% after switching to our motors'). Reinforce relevance. Max 100 words.",
    3: "Direct CTA — ask for a 15-minute call or a free sample shipment. Be specific about the next step. Max 80 words.",
    4: "Breakup email — last email, acknowledge they're busy, leave door open. Highest reply rate. Max 60 words.",
}


class ContentService:
    def __init__(self, db: Session):
        self.client = anthropic.Anthropic(api_key=get_setting(db, "anthropic_api_key"))

    def generate_email(
        self,
        contact: Contact,
        step_number: int,
        campaign_goal: str = "book a 15-minute discovery call",
    ) -> dict[str, str]:
        """
        Generate a personalized email subject + body for a contact.
        Returns {"subject": "...", "body": "..."}
        """
        step_instruction = STEP_CONTEXT.get(step_number, STEP_CONTEXT[1])

        prompt = f"""
{BRAND_VOICE}

Write a cold outreach email for:
- First name: {contact.first_name}
- Last name: {contact.last_name}
- Title: {contact.title}
- Company: {contact.company}
- Industry: {contact.industry}
- City: {contact.city}, {contact.country}

Campaign goal: {campaign_goal}
Step {step_number} of 4: {step_instruction}

Rules:
- Use {{{{first_name}}}} as the personalization token, NOT the actual name
- Plain text, no HTML
- Do NOT use buzzwords like "synergy", "leverage", "holistic"
- Sign off as: Rohan Mehta, Indo Aerial Systems | +91-XXXXX-XXXXX

Return ONLY a JSON object with keys "subject" and "body". No preamble.
"""

        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return {"subject": result["subject"], "body": result["body"]}

    def generate_linkedin_message(
        self,
        contact: Contact,
        message_type: Literal["connection_request", "follow_up"],
    ) -> str:
        """
        Generate a LinkedIn connection note or follow-up message.
        Connection notes are max 300 chars.
        """
        if message_type == "connection_request":
            instruction = (
                "Write a LinkedIn connection request note. "
                "Max 280 characters. Casual, no hard sell. "
                "Mention one relevant thing about their work or industry. "
                "End with why you want to connect."
            )
        else:
            instruction = (
                "Write a LinkedIn follow-up message after they accepted the connection. "
                "Max 400 characters. Reference that you just connected. "
                "Briefly mention what Indo Aerial Systems does and one relevant value prop. "
                "Soft CTA: suggest a quick call or ask if they'd like a product catalogue."
            )

        prompt = f"""
{BRAND_VOICE}

{instruction}

Contact info:
- First name: {contact.first_name}
- Title: {contact.title}
- Company: {contact.company}
- Industry: {contact.industry}

Return ONLY the message text. No JSON. No preamble.
"""

        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )

        return message.content[0].text.strip()

    def personalize(self, template: str, contact: Contact) -> str:
        """Replace {{first_name}}, {{company}}, etc. tokens in a template."""
        return (
            template
            .replace("{{first_name}}", contact.first_name)
            .replace("{{last_name}}", contact.last_name)
            .replace("{{company}}", contact.company)
            .replace("{{title}}", contact.title)
            .replace("{{city}}", contact.city)
        )


