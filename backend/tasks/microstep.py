import json
import logging
import os

from django.core.cache import cache
from django.shortcuts import get_object_or_404
from groq import Groq
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Task

logger = logging.getLogger(__name__)

PROMPT = """You help a college student start a task they keep delaying.
Return ONLY a JSON object: {"step": "..."}
"step" is ONE tiny first action that takes under 5 minutes, for example opening the file, writing the title, or listing 3 bullet points.
Write it in simple Hinglish (Hindi + English mix, roman script), max 100 characters, starting with a verb. No emojis."""


def generate_micro_step(title, complexity):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model=os.environ["GROQ_MODEL"],
        messages=[
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": f"Task: {title}\nComplexity: {complexity}/5"},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    data = json.loads(response.choices[0].message.content)
    step = str(data.get("step") or "").strip()[:150]
    if not step:
        raise ValueError("Empty micro step")
    return step


class FirstStepView(APIView):
    """Task ka pehla 5 minute wala step (AI), cache ke saath."""

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)
        if task.status != "pending":
            return Response(
                {"error": "Only pending tasks have a first step"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        key = f"microstep:{task.id}"
        step = cache.get(key)
        if step is None:
            try:
                step = generate_micro_step(task.title, task.complexity)
            except Exception:
                logger.exception("Micro step failed")
                return Response(
                    {"error": "Could not generate a first step"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            cache.set(key, step, 24 * 3600)
        return Response({"step": step})