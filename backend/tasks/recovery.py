import json
import logging
import os

from django.shortcuts import get_object_or_404
from django.utils import timezone
from groq import Groq
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Profile

from .models import Task

logger = logging.getLogger(__name__)

PROMPT = """A college student has missed or is about to miss a deadline.
Return ONLY a JSON object: {"salvage": ["...", "...", "..."], "message": "..."}
"salvage": exactly 3 short steps (each under 100 characters) to save as much of the work as possible right now, most valuable first.
"message": a polite, honest extension-request email body to the teacher, 4 to 6 sentences, in simple English. Do not make up excuses or facts. Say what is already done only if the student gave it. Propose a specific new submission time. End with the student's name if given.
No emojis."""


def generate_recovery(title, hours_late, name):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    if hours_late > 0:
        state = f"The deadline passed {round(hours_late)} hours ago."
    else:
        state = f"The deadline is in {round(-hours_late)} hours."
    response = client.chat.completions.create(
        model=os.environ["GROQ_MODEL"],
        messages=[
            {"role": "system", "content": PROMPT},
            {
                "role": "user",
                "content": f"Task: {title[:120]}\n{state}\nStudent name: {name or 'not given'}",
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    data = json.loads(response.choices[0].message.content)
    steps = [str(s).strip()[:150] for s in (data.get("salvage") or []) if str(s).strip()][:4]
    message = str(data.get("message") or "").strip()[:1500]
    if len(steps) < 2 or not message:
        raise ValueError("Recovery plan incomplete")
    return {"salvage": steps, "message": message}


class RecoveryView(APIView):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)
        if task.status != "pending":
            return Response(
                {"error": "Only pending tasks can use recovery"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = Profile.objects.filter(user=request.user).first()
        name = profile.full_name if profile else ""
        hours_late = (timezone.now() - task.deadline).total_seconds() / 3600
        try:
            result = generate_recovery(task.title, hours_late, name)
        except Exception:
            logger.exception("Recovery generation failed")
            return Response(
                {"error": "Could not build a recovery plan, please try again"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(result)