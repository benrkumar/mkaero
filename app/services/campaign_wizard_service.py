"""
AI Campaign Wizard Service.

Takes a plain-English description of the target audience and goal,
then uses Claude to generate a complete, ready-to-launch campaign:
  - Campaign name + description
  - Apollo.io search filters (auto-translated from description)
  - 4 full email steps (subject + body, brand-voiced)
  - LinkedIn connection note + follow-up message
"""
import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

WIZARD_SYSTEM_PROMPT = """
You are the outreach strategy AI for Indo Aerial Systems Pvt Ltd.
Brand tagline: "Tough Parts. Smart Prices. Made in India."
Products: drone frames, brushless motors, ESCs, propellers, flight controllers,
GPS modules, LiPo batteries, FPV cameras, landing gear, payload mounts.

Your job: given a description of the target audience, generate a complete,
ready-to-launch B2B cold outreach campaign.

Brand voice rules:
- Direct, confident, no fluff
- Technical language (speak the language of drone engineers/procurement)
- Made-in-India pride and PLI scheme advantage
- Key pain points: Chinese import delays/quality, customs duties, no local support
- Never use: "synergy", "leverage", "holistic", "game-changer"
- Keep emails human and concise (under 150 words per email)
- Every email ends with a clear, low-friction CTA

4-step drip sequence framework:
1. Day 0  — Introduction + one sharp pain point for their specific role. Soft CTA (reply or schedule).
2. Day 3  — Social proof / mini case study. "A drone OEM in [city] cut X by Y%..."
3. Day 7  — Direct ask: 15-min call OR free product sample shipment.
4. Day 14 — Breakup email. Short. "Last one from me — feel free to reach back anytime."

Personalization tokens available: {{first_name}}, {{company}}, {{title}}, {{city}}

Apollo.io filter options:
- job_titles: array of strings (e.g. ["CEO", "CTO", "Founder", "Head of Procurement"])
- industries: array of strings (e.g. ["Aviation", "Defense", "Agricultural Technology"])
- locations: array of city/country strings (e.g. ["India", "Mumbai", "Bangalore"])
- company_sizes: array of employee range strings from:
  ["1,10", "11,50", "51,200", "201,500", "501,1000", "1001,5000"]

Always return ONLY valid JSON. No markdown, no preamble.
"""


class CampaignWizardService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def generate_plan(self, description: str, max_leads: int = 100) -> dict:
        """
        Generate a full campaign plan from a plain-English description.

        Returns a dict with:
          campaign_name, summary, apollo_filters,
          email_sequence (list of {step, delay_days, subject, body}),
          linkedin_connection_note, linkedin_followup
        """
        prompt = f"""
Target audience description:
\"\"\"{description}\"\"\"

Max leads to fetch: {max_leads}

Generate a complete outreach campaign plan. Return this exact JSON structure:

{{
  "campaign_name": "short memorable name",
  "summary": "one sentence describing who we're targeting and why",
  "apollo_filters": {{
    "job_titles": ["...", "..."],
    "industries": ["...", "..."],
    "locations": ["..."],
    "company_sizes": ["1,10", "11,50"]
  }},
  "email_sequence": [
    {{
      "step": 1,
      "delay_days": 0,
      "subject": "...",
      "body": "Hi {{{{first_name}}}},\n\n[full email body]\n\nBest,\nRohan Mehta\nIndo Aerial Systems | +91-98765-43210"
    }},
    {{
      "step": 2,
      "delay_days": 3,
      "subject": "...",
      "body": "..."
    }},
    {{
      "step": 3,
      "delay_days": 7,
      "subject": "...",
      "body": "..."
    }},
    {{
      "step": 4,
      "delay_days": 14,
      "subject": "...",
      "body": "..."
    }}
  ],
  "linkedin_connection_note": "max 280 chars, casual, no hard sell",
  "linkedin_followup": "max 400 chars, after connection accepted, brief value prop + soft ask"
}}
"""
        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=WIZARD_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        plan = json.loads(raw)
        logger.info("Wizard generated plan: %s", plan.get("campaign_name"))
        return plan

    def summarize_email(self, subject: str, body: str) -> str:
        """Generate a 1-sentence summary of an email for dashboard display."""
        message = self.client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=80,
            messages=[{
                "role": "user",
                "content": f"Summarize this cold email in one sentence (max 15 words):\nSubject: {subject}\nBody: {body[:300]}"
            }],
        )
        return message.content[0].text.strip()


campaign_wizard_service = CampaignWizardService()
