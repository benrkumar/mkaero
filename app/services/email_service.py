"""
Mailgun email delivery service.

Handles sending, open/click tracking, and unsubscribe list management.
"""
import hashlib
import hmac
import logging
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

MAILGUN_API_BASE = "https://api.mailgunapp.com/v3"  # EU: api.eu.mailgun.net


class EmailService:
    def __init__(self):
        self.api_key = settings.mailgun_api_key
        self.domain = settings.mailgun_domain
        self.from_address = f"{settings.mailgun_from_name} <{settings.mailgun_from}>"
        self.base_url = f"https://api.mailgunapp.com/v3/{self.domain}"

    def send(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        text_body: str,
        tracking_id: str,
        campaign_id: str,
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


email_service = EmailService()
