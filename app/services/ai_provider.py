"""
Unified AI provider — routes between Claude (Anthropic) and Gemini (Google)
based on the `ai_provider` setting stored in the database.

Usage:
    from app.services.ai_provider import call_ai

    text = call_ai(db, prompt="Write me an email...", system="You are...", max_tokens=600)
"""
import logging

from sqlalchemy.orm import Session

from app.services.settings_service import get_setting

logger = logging.getLogger(__name__)


def call_ai(
    db: Session,
    prompt: str,
    system: str = "",
    max_tokens: int = 600,
) -> str:
    """
    Send a prompt to the configured AI provider (Claude or Gemini).
    Returns the response text.
    """
    provider = (get_setting(db, "ai_provider") or "claude").lower()

    if provider == "gemini":
        return _call_gemini(db, prompt, system, max_tokens)
    else:
        return _call_claude(db, prompt, system, max_tokens)


# ── Claude (Anthropic) ────────────────────────────────────────────────────────

def _call_claude(db: Session, prompt: str, system: str, max_tokens: int) -> str:
    import anthropic
    api_key = get_setting(db, "anthropic_api_key")
    if not api_key:
        raise ValueError("Anthropic API key is not configured. Add it in Settings.")

    client = anthropic.Anthropic(api_key=api_key)
    kwargs: dict = {
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system

    message = client.messages.create(**kwargs)
    return message.content[0].text.strip()


def _call_claude_fast(db: Session, prompt: str, max_tokens: int) -> str:
    """Haiku for short summarisation tasks."""
    import anthropic
    api_key = get_setting(db, "anthropic_api_key")
    if not api_key:
        raise ValueError("Anthropic API key is not configured. Add it in Settings.")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


# ── Gemini (Google) ───────────────────────────────────────────────────────────

def _call_gemini(db: Session, prompt: str, system: str, max_tokens: int) -> str:
    try:
        import google.generativeai as genai
    except ImportError:
        raise ImportError(
            "google-generativeai is not installed. "
            "Run: pip install google-generativeai"
        )

    api_key = get_setting(db, "gemini_api_key")
    if not api_key:
        raise ValueError("Gemini API key is not configured. Add it in Settings.")

    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system if system else None,
    )

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(max_output_tokens=max_tokens),
    )
    return response.text.strip()


def _call_gemini_fast(db: Session, prompt: str, max_tokens: int) -> str:
    """Flash model for short summarisation tasks."""
    try:
        import google.generativeai as genai
    except ImportError:
        raise ImportError("google-generativeai is not installed.")

    api_key = get_setting(db, "gemini_api_key")
    if not api_key:
        raise ValueError("Gemini API key is not configured.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name="gemini-2.5-flash")
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(max_output_tokens=max_tokens),
    )
    return response.text.strip()


# ── Public fast helper (used for summarisation) ───────────────────────────────

def call_ai_fast(db: Session, prompt: str, max_tokens: int = 80) -> str:
    """Use the cheaper/faster model for simple tasks like email summarisation."""
    provider = (get_setting(db, "ai_provider") or "claude").lower()
    if provider == "gemini":
        return _call_gemini_fast(db, prompt, max_tokens)
    else:
        return _call_claude_fast(db, prompt, max_tokens)
