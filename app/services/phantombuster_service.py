"""
Phantombuster LinkedIn Automation Service.

Uses Phantombuster's cloud API to:
  - Send LinkedIn connection requests (Network Booster phantom)
  - Send LinkedIn messages to existing connections (Message Sender phantom)

Setup required (in .env):
  PHANTOMBUSTER_API_KEY=your_key
  PHANTOMBUSTER_NETWORK_BOOSTER_ID=agent_id_for_network_booster
  PHANTOMBUSTER_MESSAGE_SENDER_ID=agent_id_for_message_sender
  LINKEDIN_SESSION_COOKIE=your_li_at_cookie_value

How to get your LinkedIn session cookie:
  1. Log in to LinkedIn in Chrome
  2. Open DevTools → Application → Cookies → linkedin.com
  3. Copy the value of the "li_at" cookie
"""
import logging
import time
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

PHANTOMBUSTER_API = "https://api.phantombuster.com/api/v2"


class PhantombusterService:
    def __init__(self):
        self.api_key = settings.phantombuster_api_key
        self.network_booster_id = settings.phantombuster_network_booster_id
        self.message_sender_id = settings.phantombuster_message_sender_id
        self.session_cookie = settings.linkedin_session_cookie
        self.headers = {"X-Phantombuster-Key": self.api_key}

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.session_cookie)

    def send_connection_requests(
        self,
        profile_urls: list[str],
        message: str,
        adds_per_launch: int = 10,
    ) -> dict:
        """
        Launch the LinkedIn Network Booster phantom to send connection requests.
        Returns the launch result from Phantombuster.
        """
        if not self._is_configured():
            logger.warning("Phantombuster not configured — skipping connection requests")
            return {"status": "not_configured"}

        if not self.network_booster_id:
            logger.warning("PHANTOMBUSTER_NETWORK_BOOSTER_ID not set")
            return {"status": "no_agent_id"}

        if not profile_urls:
            return {"status": "no_urls"}

        # Truncate message to LinkedIn's 300-char limit
        note = message[:297] + "..." if len(message) > 300 else message

        payload = {
            "id": self.network_booster_id,
            "argument": {
                "sessionCookie": self.session_cookie,
                "profileUrls": profile_urls[:adds_per_launch],  # batch limit
                "message": note,
                "numberOfAddsPerLaunch": adds_per_launch,
                "onlySecondCircle": False,
                "waitDuration": 30,
                "randomize": True,
            },
        }

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{PHANTOMBUSTER_API}/agents/launch",
                    headers=self.headers,
                    json=payload,
                )
                resp.raise_for_status()
                result = resp.json()
                logger.info(
                    "Phantombuster Network Booster launched: %d profiles, containerId=%s",
                    len(profile_urls[:adds_per_launch]),
                    result.get("containerId", "?"),
                )
                return result
        except Exception as exc:
            logger.error("Phantombuster connection request failed: %s", exc)
            return {"status": "error", "error": str(exc)}

    def send_messages(
        self,
        profile_urls: list[str],
        message: str,
    ) -> dict:
        """
        Launch the LinkedIn Message Sender phantom to message existing connections.
        """
        if not self._is_configured():
            logger.warning("Phantombuster not configured — skipping messages")
            return {"status": "not_configured"}

        if not self.message_sender_id:
            logger.warning("PHANTOMBUSTER_MESSAGE_SENDER_ID not set")
            return {"status": "no_agent_id"}

        if not profile_urls:
            return {"status": "no_urls"}

        payload = {
            "id": self.message_sender_id,
            "argument": {
                "sessionCookie": self.session_cookie,
                "profileUrls": profile_urls[:50],  # max 50/launch
                "message": message,
                "sendToOpenProfiles": False,
                "waitDuration": 15,
                "randomize": True,
            },
        }

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{PHANTOMBUSTER_API}/agents/launch",
                    headers=self.headers,
                    json=payload,
                )
                resp.raise_for_status()
                result = resp.json()
                logger.info(
                    "Phantombuster Message Sender launched: %d profiles",
                    len(profile_urls[:50]),
                )
                return result
        except Exception as exc:
            logger.error("Phantombuster message send failed: %s", exc)
            return {"status": "error", "error": str(exc)}

    def get_agent_output(self, container_id: str) -> dict:
        """Fetch the output/status of a running or completed Phantombuster agent."""
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{PHANTOMBUSTER_API}/containers/fetch-output",
                    headers=self.headers,
                    params={"id": container_id},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Failed to fetch Phantombuster output: %s", exc)
            return {}

    def list_agents(self) -> list[dict]:
        """List all Phantombuster agents."""
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{PHANTOMBUSTER_API}/agents/fetch-all",
                    headers=self.headers,
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Failed to list Phantombuster agents: %s", exc)
            return []

    def get_agent(self, agent_id: str) -> dict:
        """Fetch a single agent's details."""
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{PHANTOMBUSTER_API}/agents/fetch",
                    headers=self.headers,
                    params={"id": agent_id},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Failed to fetch agent %s: %s", agent_id, exc)
            return {}

    def launch_agent(self, agent_id: str, argument: Optional[dict] = None) -> dict:
        """Launch any Phantombuster agent with optional custom arguments."""
        if not self._is_configured():
            return {"status": "not_configured"}
        payload: dict = {"id": agent_id}
        if argument:
            payload["argument"] = argument
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{PHANTOMBUSTER_API}/agents/launch",
                    headers=self.headers,
                    json=payload,
                )
                resp.raise_for_status()
                result = resp.json()
                logger.info("Agent %s launched, containerId=%s", agent_id, result.get("containerId", "?"))
                return result
        except Exception as exc:
            logger.error("Failed to launch agent %s: %s", agent_id, exc)
            return {"status": "error", "error": str(exc)}

    def abort_agent(self, agent_id: str) -> dict:
        """Abort a running Phantombuster agent."""
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    f"{PHANTOMBUSTER_API}/agents/abort",
                    headers=self.headers,
                    json={"id": agent_id},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Failed to abort agent %s: %s", agent_id, exc)
            return {"status": "error", "error": str(exc)}

    def get_container_output(self, container_id: str) -> dict:
        """Fetch container output/status."""
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{PHANTOMBUSTER_API}/containers/fetch-output",
                    headers=self.headers,
                    params={"id": container_id},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Failed to fetch container %s: %s", container_id, exc)
            return {}

    def get_container_status(self, container_id: str) -> dict:
        """Fetch container running status."""
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    f"{PHANTOMBUSTER_API}/containers/fetch",
                    headers=self.headers,
                    params={"id": container_id},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Failed to fetch container status %s: %s", container_id, exc)
            return {}


phantombuster_service = PhantombusterService()
