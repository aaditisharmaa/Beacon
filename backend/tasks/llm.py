import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

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