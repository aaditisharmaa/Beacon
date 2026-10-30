import json
import logging
import os

from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.utils import timezone
from groq import Groq
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Task

logger = logging.getLogger(__name__)

TONES = ("friendly", "nudging", "strict")

NUDGE_PROMPT = """You are BEACON, a small pixel pet that lives on a college student's desktop.
Write ONE short message about their task, in casual Hinglish (Hindi written in English letters, mixed with English), the way a close friend would text.
Tone rules:
- friendly: warm, light and encouraging.
- nudging: playful push, a little urgency.
- strict: firm and urgent, but never insulting, shaming or harsh about the person.
Rules: maximum 100 characters, one sentence, at most one emoji, no hashtags, no quotation marks.
Mention the task naturally and say roughly how much time is left.
Return ONLY a JSON object: {"message": "..."}"""


def time_bucket(hours_left):
    """Cache key ke liye time ko mote dibbon mein baanto."""
    if hours_left <= 0:
        return "over"
    if hours_left < 3:
        return "lt3"
    if hours_left < 24:
        return "lt24"
    if hours_left < 48:
        return "lt48"
    return f"d{int(hours_left // 24)}"


def _time_left_text(hours_left):
    if hours_left <= 0:
        return "the deadline has passed"
    if hours_left < 1:
        return f"{max(1, round(hours_left * 60))} minutes left"
    if hours_left < 48:
        return f"{round(hours_left)} hours left"
    return f"{round(hours_left / 24)} days left"


def generate_nudge(title, tone, hours_left, snooze_count):
    if tone not in TONES:
        raise ValueError("Unknown tone")

    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model=os.environ["GROQ_MODEL"],
        messages=[
            {"role": "system", "content": NUDGE_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Task: {title[:80]}\n"
                    f"Tone: {tone}\n"
                    f"Time: {_time_left_text(hours_left)}\n"
                    f"Times snoozed: {snooze_count}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.8,
    )
    data = json.loads(response.choices[0].message.content)
    message = " ".join(str(data.get("message", "")).split()).strip('" ')
    if not message:
        raise ValueError("Empty nudge")
    return message[:140]


class NudgeView(APIView):
    """Avatar ke liye ek chhoti Hinglish line (AI), cache ke saath."""

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)

        tone = request.data.get("tone")
        if tone not in TONES:
            return Response(
                {"error": "tone must be friendly, nudging or strict"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if task.status != "pending":
            return Response(
                {"error": "Only pending tasks get nudges"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hours_left = (task.deadline - timezone.now()).total_seconds() / 3600
        key = (
            f"nudge:{task.id}:{tone}:{task.snooze_count}:{time_bucket(hours_left)}"
        )

        message = cache.get(key)
        if message is None:
            try:
                message = generate_nudge(
                    task.title, tone, hours_left, task.snooze_count
                )
            except Exception:
                logger.exception("Nudge generation failed")
                return Response(
                    {"error": "Could not generate a nudge"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            cache.set(key, message, 6 * 3600)

        return Response({"message": message})
