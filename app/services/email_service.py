"""
Mailgun email delivery service.

Handles sending, open/click tracking, and unsubscribe list management.
"""
import hashlib
import hmac
import logging
import time

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.services.settings_service import get_setting

logger = logging.getLogger(__name__)

MAILGUN_API_BASE = "https://api.mailgunapp.com/v3"  # EU: api.eu.mailgun.net


def render_html_body(body_text: str) -> str:
    """Wrap plain text email body in a clean HTML template."""
    html_body = body_text.replace("\n", "<br>")
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:40px 48px 32px;">
          <div style="font-size:15px;line-height:1.7;color:#1e293b;">
            {html_body}
          </div>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            You received this email because you opted in to our outreach program.<br>
            To unsubscribe, reply with "unsubscribe" in the subject line.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


class EmailService:
    def __init__(self, db: Session):
        self.api_key = get_setting(db, "mailgun_api_key")
        self.domain = get_setting(db, "mailgun_domain")
        self.from_address = f"{get_setting(db, 'mailgun_from_name')} <{get_setting(db, 'mailgun_from')}>"
        self.base_url = f"https://api.mailgunapp.com/v3/{self.domain}"

    def send(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        text_body: str,
        tracking_id: str,
        campaign_id: str,
        html_body: str | None = None,
    ) -> str | None:
        """
        Send an email via Mailgun.
        Returns the Mailgun message ID or None on failure.
        tracking_id format: "{campaign_lead_id}:{step_order}"
        """
        if not self.api_key:
            raise ValueError("MAILGUN_API_KEY is not configured")

        unsubscribe_url = f"{settings.frontend_url}/unsubscribe?email={to_email}"

        data = {
            "from": self.from_address,
            "to": f"{to_name} <{to_email}>",
            "subject": subject,
            "text": text_body,
            **({"html": html_body} if html_body is not None else {}),
            "o:tracking-opens": "yes",
            "o:tracking-clicks": "yes",
            "o:tag": [campaign_id],
            "h:X-Tracking-ID": tracking_id,
            "h:List-Unsubscribe": f"<{unsubscribe_url}>",
            "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }

        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    f"https://api.mailgun.net/v3/{self.domain}/messages",
                    auth=("api", self.api_key),
                    data=data,
                )
                resp.raise_for_status()
                result = resp.json()
                msg_id = result.get("id", "")
                logger.info("Email sent to %s, message_id=%s", to_email, msg_id)
                return msg_id
        except httpx.HTTPStatusError as exc:
            logger.error("Mailgun send failed for %s: %s", to_email, exc.response.text)
            return None

    def verify_webhook_signature(self, timestamp: str, token: str, signature: str) -> bool:
        """Verify that a Mailgun webhook payload is authentic."""
        hmac_digest = hmac.new(
            key=self.api_key.encode("utf-8"),
            msg=f"{timestamp}{token}".encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(hmac_digest, signature)

    def add_unsubscribe(self, email: str) -> bool:
        """Add an email to the Mailgun unsubscribe list."""
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(
                    f"https://api.mailgun.net/v3/{self.domain}/unsubscribes",
                    auth=("api", self.api_key),
                    data={"address": email},
                )
                return resp.status_code in (200, 201)
        except Exception as exc:
            logger.error("Failed to add unsubscribe for %s: %s", email, exc)
            return False


