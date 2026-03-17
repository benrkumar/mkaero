"""
LinkedIn automation service using Playwright.

SAFETY RULES:
- Max 20 connection requests per day
- Max 50 messages per day
- Random 2–8 second delays between actions
- Random 30–90 second delays between profile visits
- Business hours IST only (9am–6pm)
- Pause on weekends
- Abort on CAPTCHA detection
"""
import json
import logging
import random
import time
from datetime import datetime
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

DAILY_CONNECTION_LIMIT = 20
DAILY_MESSAGE_LIMIT = 50


class LinkedInService:
    def __init__(self):
        self.email = settings.linkedin_email
        self.password = settings.linkedin_password
        self.session_file = Path(settings.linkedin_session_file)
        self._browser = None
        self._page = None
        self._connection_count_today = 0
        self._message_count_today = 0
        self._last_reset_date: str | None = None

    def _reset_daily_counts(self):
        today = datetime.now().strftime("%Y-%m-%d")
        if self._last_reset_date != today:
            self._connection_count_today = 0
            self._message_count_today = 0
            self._last_reset_date = today

    def _is_business_hours(self) -> bool:
        """Check if current IST time is within 9am–6pm Mon–Fri."""
        from datetime import timezone, timedelta
        IST = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(IST)
        if now.weekday() >= 5:  # Saturday=5, Sunday=6
            return False
        return 9 <= now.hour < 18

    def _human_delay(self, min_s: float = 2.0, max_s: float = 8.0):
        time.sleep(random.uniform(min_s, max_s))

    async def _get_page(self):
        """Return existing page or launch new browser session."""
        from playwright.async_api import async_playwright

        if self._page and not self._page.is_closed():
            return self._page

        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=True)

        context_opts = {}
        if self.session_file.exists():
            context_opts["storage_state"] = str(self.session_file)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            **context_opts,
        )
        self._page = await context.new_page()
        self._browser = browser

        if not self.session_file.exists():
            await self._login()

        return self._page

    async def _login(self):
        page = self._page
        await page.goto("https://www.linkedin.com/login")
        await page.fill("#username", self.email)
        self._human_delay(1, 2)
        await page.fill("#password", self.password)
        self._human_delay(0.5, 1.5)
        await page.click('[type="submit"]')
        await page.wait_for_timeout(4000)

        if "checkpoint" in page.url or "challenge" in page.url:
            logger.error("LinkedIn CAPTCHA or security challenge detected. Manual login required.")
            raise RuntimeError("LinkedIn CAPTCHA detected — please log in manually and export session cookies.")

        # Save session
        storage = await page.context.storage_state()
        self.session_file.write_text(json.dumps(storage))
        logger.info("LinkedIn session saved to %s", self.session_file)

    async def _check_captcha(self, page) -> bool:
        """Returns True if CAPTCHA is present on the page."""
        captcha_selectors = [
            '[data-testid="captcha"]',
            ".captcha-internal",
            "#captcha-internal",
        ]
        for sel in captcha_selectors:
            if await page.locator(sel).count() > 0:
                return True
        if "checkpoint" in page.url or "challenge" in page.url:
            return True
        return False

    async def send_connection_request(self, profile_url: str, note: str) -> bool:
        """
        Send a LinkedIn connection request with a personalized note.
        Note must be <= 300 characters.
        Returns True on success.
        """
        self._reset_daily_counts()

        if not self._is_business_hours():
            logger.info("Outside business hours IST — skipping LinkedIn action")
            return False

        if self._connection_count_today >= DAILY_CONNECTION_LIMIT:
            logger.warning("Daily connection limit (%d) reached", DAILY_CONNECTION_LIMIT)
            return False

        if len(note) > 300:
            note = note[:297] + "..."

        try:
            page = await self._get_page()

            if await self._check_captcha(page):
                logger.error("CAPTCHA detected — aborting LinkedIn automation")
                raise RuntimeError("LinkedIn CAPTCHA — human intervention required")

            await page.goto(profile_url, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)

            self._human_delay(2, 5)

            # Click "Connect" button
            connect_btn = page.locator('button:has-text("Connect")').first
            if await connect_btn.count() == 0:
                logger.info("No Connect button on %s (already connected or following)", profile_url)
                return False

            await connect_btn.click()
            self._human_delay(1, 2)

            # Click "Add a note"
            add_note_btn = page.locator('button:has-text("Add a note")')
            if await add_note_btn.count() > 0:
                await add_note_btn.click()
                self._human_delay(0.5, 1)
                await page.fill('textarea[name="message"]', note)
                self._human_delay(1, 2)

            # Send
            send_btn = page.locator('button:has-text("Send")')
            await send_btn.click()
            await page.wait_for_timeout(2000)

            self._connection_count_today += 1
            logger.info("Connection request sent to %s (%d/%d today)", profile_url, self._connection_count_today, DAILY_CONNECTION_LIMIT)

            # Random delay before next action
            time.sleep(random.uniform(30, 90))
            return True

        except RuntimeError:
            raise
        except Exception as exc:
            logger.error("Failed to send connection request to %s: %s", profile_url, exc)
            return False

    async def send_message(self, profile_url: str, message: str) -> bool:
        """
        Send a direct message to an existing LinkedIn connection.
        """
        self._reset_daily_counts()

        if not self._is_business_hours():
            logger.info("Outside business hours IST — skipping LinkedIn message")
            return False

        if self._message_count_today >= DAILY_MESSAGE_LIMIT:
            logger.warning("Daily message limit (%d) reached", DAILY_MESSAGE_LIMIT)
            return False

        try:
            page = await self._get_page()

            if await self._check_captcha(page):
                raise RuntimeError("LinkedIn CAPTCHA — human intervention required")

            await page.goto(profile_url, wait_until="domcontentloaded")
            self._human_delay(2, 5)

            # Click "Message" button
            msg_btn = page.locator('button:has-text("Message")').first
            if await msg_btn.count() == 0:
                logger.info("No Message button on %s", profile_url)
                return False

            await msg_btn.click()
            self._human_delay(1, 2)

            # Type message
            msg_box = page.locator('.msg-form__contenteditable').first
            await msg_box.click()
            await msg_box.type(message, delay=random.randint(40, 80))
            self._human_delay(1, 2)

            # Send
            send_btn = page.locator('button.msg-form__send-button')
            await send_btn.click()
            await page.wait_for_timeout(2000)

            self._message_count_today += 1
            logger.info("Message sent to %s (%d/%d today)", profile_url, self._message_count_today, DAILY_MESSAGE_LIMIT)

            time.sleep(random.uniform(30, 90))
            return True

        except RuntimeError:
            raise
        except Exception as exc:
            logger.error("Failed to send message to %s: %s", profile_url, exc)
            return False

    async def is_connected(self, profile_url: str) -> bool:
        """Check if we are already connected with this profile."""
        try:
            page = await self._get_page()
            await page.goto(profile_url, wait_until="domcontentloaded")
            self._human_delay(2, 4)

            # If "Message" button is present, we're connected
            msg_btn = page.locator('button:has-text("Message")').first
            return await msg_btn.count() > 0
        except Exception as exc:
            logger.error("Failed to check connection status for %s: %s", profile_url, exc)
            return False

    async def close(self):
        if self._browser:
            await self._browser.close()


linkedin_service = LinkedInService()
