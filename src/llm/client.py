"""OpenAI API wrapper with retry logic and graceful fallback."""

import logging
from typing import Any

from src.config import settings

logger = logging.getLogger(__name__)

# Lazy import to avoid crash if openai not installed
_client = None


def _get_client():
    """Lazy-init the OpenAI client."""
    global _client
    if _client is None:
        if not settings.openai_api_key:
            logger.warning("OPENAI_API_KEY not set — LLM features disabled")
            return None
        try:
            import openai

            _client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        except ImportError:
            logger.error("openai package not installed")
            return None
    return _client


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int | None = None,
) -> str | None:
    """
    Call OpenAI Chat Completions and return the text response.
    Returns None if API key is missing or call fails.
    """
    client = _get_client()
    if client is None:
        return None

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            max_tokens=max_tokens or settings.llm_max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0, # Better for structured output
        )
        return response.choices[0].message.content
    except Exception:
        logger.exception("LLM call failed")
        return None


async def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int | None = None,
) -> dict[str, Any] | None:
    """Call LLM and parse response as JSON. Returns None on failure."""
    import json

    # OpenAI supports json_mode, but let's keep the extraction logic 
    # for robustness if the model still surrounds it with markdown.
    text = await call_llm(system_prompt, user_prompt, max_tokens)
    if text is None:
        return None

    # Extract JSON from markdown code blocks if present
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        text = text[start:end].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response as JSON: %s", text[:200])
        return None
