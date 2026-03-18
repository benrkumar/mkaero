"""
AI Campaign Wizard Service.

Takes a plain-English description of the target audience and goal,
then uses Claude or Gemini (based on `ai_provider` setting) to generate
a complete, ready-to-launch campaign:
  - Campaign name + description
  - Apollo.io search filters (auto-translated from description)
  - 4 full email steps (subject + body, brand-voiced)
  - LinkedIn connection note + follow-up message
"""
import json
import logging

from sqlalchemy.orm import Session

from app.services.ai_provider import call_ai, call_ai_fast

logger = logging.getLogger(__name__)

WIZARD_SYSTEM_PROMPT = """
You are the outreach strategy AI for Indo Aerial Systems Pvt Ltd.
Brand tagline: "Tough Parts. Smart Prices. Made in India."
Products: drone frames, brushless motors, ESCs, propellers, flight controllers,
GPS modules, LiPo batteries, FPV cameras, landing gear, payload mounts.

PRIMARY GOAL: Generate cold B2B outreach emails that get REPLIES. Every word must earn its place.

EMAIL RULES (non-negotiable):
- MAX 120 words per email. Shorter is better. Respect the reader's time.
- Lead with THEIR pain, not our product. First sentence is always about them.
- ONE specific pain point per email: Chinese import delays, customs duties, quality failures, zero local support.
- End every email with ONE direct, reply-inviting question — not a vague statement.
  BAD: "Would love to connect."
  GOOD: "Quick question — are you currently sourcing brushless motors locally or still importing from China?"
- Subject lines: 4–7 words, lowercase-style, create curiosity. No spam caps.
- Use {{first_name}} in email 1 only. Use {{company}} sparingly (max once per email).
- Sign every email: Rohan Mehta | Indo Aerial Systems | +91-98765-43210
- NEVER use: "synergy", "leverage", "holistic", "game-changer", "I hope this email finds you well"
- No exclamation marks. Confident and direct, never pushy.

4-STEP SEQUENCE FRAMEWORK:
1. Day 0  — HOOK: One punchy sentence about their specific pain. Soft CTA = ask a question that begs a reply.
2. Day 3  — PROOF: One concrete mini case study (1–2 sentences). "A drone OEM in Pune cut procurement time by 3 weeks after switching to us." CTA: ask if they want specs or full story.
3. Day 7  — ASK: Offer something tangible — a 15-min call OR a free sample shipped to them. Zero-friction ask.
4. Day 14 — BREAKUP: 2–3 sentences max. Leave the door open gracefully. No desperation.

Personalization tokens: {{first_name}}, {{company}}, {{title}}, {{city}}

Apollo.io filter options:
- job_titles: array of strings (e.g. ["CEO", "CTO", "Founder", "Head of Procurement"])
- industries: array of strings (e.g. ["Aviation", "Defense", "Agricultural Technology"])
- locations: array of city/country strings (e.g. ["India", "Mumbai", "Bangalore"])
- company_sizes: array of employee range strings from:
  ["1,10", "11,50", "51,200", "201,500", "501,1000", "1001,5000"]

Always return ONLY valid JSON. No markdown, no preamble.
"""


class CampaignWizardService:
    def __init__(self, db: Session):
        self.db = db

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
        raw = call_ai(self.db, prompt=prompt, system=WIZARD_SYSTEM_PROMPT, max_tokens=4000)
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
        return call_ai_fast(
            self.db,
            prompt=f"Summarize this cold email in one sentence (max 15 words):\nSubject: {subject}\nBody: {body[:300]}",
            max_tokens=80,
        )


