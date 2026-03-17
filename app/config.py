from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — SQLite, no install needed
    database_url: str = "sqlite:////app/data/mk_outreach.db"

    # Apollo.io
    apollo_api_key: str = ""

    # Mailgun
    mailgun_api_key: str = ""
    mailgun_domain: str = "mail.indoaerialsystems.com"
    mailgun_from: str = "outreach@indoaerialsystems.com"
    mailgun_from_name: str = "Indo Aerial Systems"

    # Claude AI
    anthropic_api_key: str = ""

    # LinkedIn — Phantombuster (cloud automation, no browser needed)
    phantombuster_api_key: str = ""
    phantombuster_network_booster_id: str = ""  # LinkedIn Network Booster agent ID
    phantombuster_message_sender_id: str = ""   # LinkedIn Message Sender agent ID
    linkedin_session_cookie: str = ""            # li_at cookie from LinkedIn

    # App
    frontend_url: str = "http://localhost:5173"


settings = Settings()
