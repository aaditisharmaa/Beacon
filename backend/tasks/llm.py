import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import quote_plus

from groq import Groq

IST = ZoneInfo("Asia/Kolkata")

SYSTEM_PROMPT = """You extract a task from a message a student received or wrote.
Return ONLY a JSON object with these keys:
- "title": short task name (max 80 characters)
- "deadline": ISO 8601 datetime with timezone offset, or null if no deadline is mentioned
- "complexity": integer 1-5 (1 = tiny form or registration, 5 = big project or exam prep)
Resolve relative dates like "tomorrow" or "Friday" using the current date given by the user.
If a date has no time, use 23:59. The timezone is Asia/Kolkata (+05:30).
The message may be in English, Hindi, or a mix of both."""


def extract_task(text):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    now = datetime.now(IST)
    response = client.chat.completions.create(
        model=os.environ["GROQ_MODEL"],
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Current date and time: {now.isoformat()}\n\nMessage:\n{text}",
            },
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    data = json.loads(response.choices[0].message.content)

    title = str(data.get("title") or "").strip()[:255] or "Untitled task"

    try:
        complexity = min(5, max(1, int(data.get("complexity", 3))))
    except (TypeError, ValueError):
        complexity = 3

    deadline = data.get("deadline")
    if deadline:
        try:
            datetime.fromisoformat(deadline)
        except ValueError:
            deadline = None

    return {"title": title, "deadline": deadline, "complexity": complexity}

ROADMAP_PROMPT = """You are a study planner for a college student.
Return ONLY a JSON object with:
- "steps": a list of short, actionable step strings (each under 120 characters)
- "resources": a list of objects {"label": short name, "query": a search query that finds a good tutorial, one-shot video or question bank}
Plan type "full": a relaxed, thorough plan with 4-7 steps spread over the available time.
Plan type "survival": a last-minute plan with 3-5 steps covering ONLY the must-know essentials. Prefer one-shot videos, quick summaries and question banks.
Give 2-3 resources. Never write URLs, only search queries."""


def generate_roadmap(title, plan_type, hours_left, complexity):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model=os.environ["GROQ_MODEL"],
        messages=[
            {"role": "system", "content": ROADMAP_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Task: {title}\n"
                    f"Complexity: {complexity}/5\n"
                    f"Time left: {max(0, round(hours_left))} hours\n"
                    f"Plan type: {plan_type}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    data = json.loads(response.choices[0].message.content)

    raw_steps = data.get("steps")
    if not isinstance(raw_steps, list):
        raise ValueError("Roadmap steps missing")
    steps = [str(s).strip()[:200] for s in raw_steps if str(s).strip()][:8]
    if len(steps) < 3:
        raise ValueError("Roadmap had too few steps")

    resources = []
    for r in (data.get("resources") or [])[:3]:
        if not isinstance(r, dict):
            continue
        label = str(r.get("label", "")).strip()[:60]
        query = str(r.get("query", "")).strip()[:100]
        query = f"{title} {query}".strip()[:120]
        if label and query:
            resources.append(
                {
                    "label": label,
                    "url": "https://www.youtube.com/results?search_query="
                    + quote_plus(query),
                }
            )

    return {"steps": steps, "resources": resources}