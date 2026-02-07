from __future__ import annotations

"""Helpers for calling an Ollama model and parsing structured proposals.

This module constructs a strict system prompt, calls the local Ollama
HTTP API, extracts JSON from possibly noisy model output, and validates the
resulting proposals with Pydantic. It returns validated `TaskProposal`
objects and any warnings encountered during parsing.
"""

import json
import logging
import re
from datetime import datetime, timezone

import httpx

from .models import TaskProposal
from .settings import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a data extraction engine. Your ONLY job is to convert raw user text into structured task objects.
Output ONLY valid JSON — no markdown fences, no commentary, no explanation.

Output a JSON object with exactly this shape:
{
  "proposals": [ ... ]
}

Each element of "proposals" must match this schema:
{
  "name": "string, concise imperative, max 80 chars",
  "description": "string or null",
  "notes": "string or null",
  "tags": ["lowercase", "simple nouns/phrases", "max 8 tags", "no duplicates"],
  "due_at": "ISO 8601 datetime string or null",
  "priority": "low" | "medium" | "high" | "urgent",
  "is_complete": false,
  "confidence": 0.0 to 1.0,
  "assumptions": ["list of assumptions you made, e.g. interpreted 'tomorrow' as 2025-01-02"],
  "requires_user_confirmation": true or false
}

Rules:
- If the user mentions a date/time (tomorrow, next Monday, in 2 weeks, etc.), resolve it relative to the provided current datetime and timezone. Add an assumption explaining the interpretation. Set requires_user_confirmation = true.
- If no date info is present, set due_at = null.
- Priority defaults to "medium" unless user indicates urgency.
- Tags should be simple lowercase nouns or short phrases. Max 8 per task, no duplicates.
- If the text describes multiple tasks, return multiple proposals.
- Never invent personal information. If ambiguous, set requires_user_confirmation = true and list assumptions.
- name must be a concise imperative phrase (e.g., "Buy groceries", "Call dentist").
- Allowed priority values: "low", "medium", "high", "urgent".
"""


def _build_user_prompt(text: str) -> str:
    now = datetime.now()
    tz_name = now.astimezone().tzinfo
    return (
        f"Current datetime: {now.isoformat()}\n"
        f"Timezone: {tz_name}\n"
        f"\nRaw user input:\n{text}"
    )


def _extract_json(raw: str) -> dict | None:
    """Attempt to locate and parse JSON from model output.

    The model may return markdown fences or extra commentary; this helper
    strips common wrappers and attempts several heuristics to extract a
    JSON object or an array of proposals.
    """
    # Strip markdown fences
    cleaned = re.sub(r"```(?:json)?\s*", "", raw)
    cleaned = cleaned.strip().rstrip("`")

    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find the first { ... } block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Try to find a bare JSON array
    match = re.search(r"\[[\s\S]*\]", cleaned)
    if match:
        try:
            arr = json.loads(match.group())
            if isinstance(arr, list):
                return {"proposals": arr}
        except json.JSONDecodeError:
            pass

    return None


async def _call_ollama(system: str, user: str, settings=None) -> str:
    """Call the Ollama generate/chat API and return the model content.

    Raises on non-2xx responses so callers can capture and produce warnings.
    """
    if settings is None:
        settings = get_settings()

    url = f"{settings.ollama_host}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")


async def parse_tasks(text: str) -> tuple[list[TaskProposal], list[str]]:
    """Send raw text to Ollama and return validated TaskProposal list + warnings."""
    settings = get_settings()
    warnings: list[str] = []

    user_prompt = _build_user_prompt(text)
    raw_output = ""

    for attempt in range(2):
        try:
            if attempt == 0:
                raw_output = await _call_ollama(SYSTEM_PROMPT, user_prompt, settings)
            else:
                # Retry with stricter prompt and previous failure context
                retry_system = (
                    SYSTEM_PROMPT
                    + "\n\nIMPORTANT: Your previous output was INVALID JSON. "
                    "You MUST return ONLY a JSON object like {\"proposals\": [...]}. "
                    "No other text."
                )
                retry_user = (
                    user_prompt
                    + f"\n\n[Previous invalid output for reference — do NOT repeat it]:\n{raw_output[:500]}"
                )
                raw_output = await _call_ollama(retry_system, retry_user, settings)

            logger.debug("Ollama raw output (attempt %d): %s", attempt, raw_output[:300])

            parsed = _extract_json(raw_output)
            if parsed is None:
                if attempt == 0:
                    warnings.append("Model returned non-JSON on first attempt; retrying.")
                    continue
                else:
                    warnings.append("Model failed to return valid JSON after retry.")
                    return [], warnings

            # Validate proposals
            raw_proposals = parsed.get("proposals", [])
            if isinstance(parsed, list):
                raw_proposals = parsed

            if not isinstance(raw_proposals, list):
                raw_proposals = [parsed] if "name" in parsed else []

            validated: list[TaskProposal] = []
            for i, rp in enumerate(raw_proposals):
                try:
                    proposal = TaskProposal.model_validate(rp)
                    validated.append(proposal)
                except Exception as e:
                    warnings.append(f"Proposal {i} validation error: {e}")

            if validated:
                return validated, warnings

            if attempt == 0:
                warnings.append("No valid proposals in first attempt; retrying.")
                continue
            else:
                warnings.append("No valid proposals after retry.")
                return [], warnings

        except httpx.HTTPStatusError as e:
            warnings.append(f"Ollama HTTP error: {e.response.status_code}")
            return [], warnings
        except httpx.ConnectError:
            warnings.append(
                "Cannot connect to Ollama. Ensure it is running at "
                f"{settings.ollama_host} and model '{settings.ollama_model}' is pulled."
            )
            return [], warnings
        except Exception as e:
            logger.exception("Unexpected error calling Ollama")
            warnings.append(f"Unexpected error: {str(e)}")
            return [], warnings

    return [], warnings
