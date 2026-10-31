import json
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
MAX_CHARS = 12000


class MeetingAIError(Exception):
    """AI se kaam nahi bana, ye message user ko dikhana hai."""


PROMPT = """You turn raw meeting notes into minutes of the meeting (MOM).
The notes may be English, Hindi or Hinglish. Write the output in English.
Current date and time: {NOW}.

Reply with JSON only, in exactly this shape:
{"summary": "3 to 5 short lines on what was discussed",
 "decisions": ["each decision that was taken"],
 "action_items": [{"task": "short, clear task", "owner": "who must do it", "deadline": "ISO 8601 with +05:30 or null"}]}

Rules:
- Only include tasks that were really mentioned. Never invent tasks, names or dates.
- owner: use "me" when the note writer is responsible (for example "I will", "main karunga", "mujhe"). Use the person's name otherwise. Use "unassigned" if unclear.
- deadline: resolve words like tomorrow, Friday, next week from the current date. If no date or time was said, use null.
- Keep each task under 120 characters.
"""


def _text(value, limit):
    return str(value or "").strip()[:limit]


def _deadline(value):
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=IST)
    return d.isoformat()


def clean_result(data):
    if not isinstance(data, dict):
        raise MeetingAIError("Could not read the AI reply, try again")
    raw_decisions = data.get("decisions")
    raw_items = data.get("action_items")
    if not isinstance(raw_decisions, list):
        raw_decisions = []
    if not isinstance(raw_items, list):
        raw_items = []

    decisions = [_text(d, 200) for d in raw_decisions if _text(d, 200)][:10]
    items = []
    for a in raw_items[:20]:
        if not isinstance(a, dict):
            continue
        task = _text(a.get("task"), 200)
        if not task:
            continue
        items.append(
            {
                "task": task,
                "owner": _text(a.get("owner"), 60) or "unassigned",
                "deadline": _deadline(a.get("deadline")),
            }
        )
    return {
        "summary": _text(data.get("summary"), 800),
        "decisions": decisions,
        "action_items": items,
    }


def extract(text):
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise MeetingAIError("AI key is not set on the server")
    now = datetime.now(IST).strftime("%A, %d %B %Y, %I:%M %p IST")
    res = httpx.post(
        URL,
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": os.environ.get("GROQ_MODEL", DEFAULT_MODEL),
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": PROMPT.replace("{NOW}", now)},
                {"role": "user", "content": text},
            ],
        },
        timeout=45,
    )
    if res.status_code != 200:
        logger.warning("Groq error %s: %s", res.status_code, res.text[:300])
        raise MeetingAIError("The AI service could not read the notes, try again")
    try:
        data = json.loads(res.json()["choices"][0]["message"]["content"])
    except (KeyError, IndexError, ValueError):
        raise MeetingAIError("Could not read the AI reply, try again")
    return clean_result(data)