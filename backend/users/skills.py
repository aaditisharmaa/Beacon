import json
import logging
import os

from groq import Groq
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

PROMPT = """You read a short description of a student's project and list the technical skills it shows.
Return ONLY a JSON object: {"skills": ["python", "django"]}
Rules: lowercase, 1 to 3 words each, at most 8 skills, only skills clearly supported by the text."""


def suggest_skills(text):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model=os.environ["GROQ_MODEL"],
        messages=[
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": text[:3000]},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    data = json.loads(response.choices[0].message.content)
    out = []
    for item in data.get("skills") or []:
        s = str(item).strip().lower()[:40]
        if s and s not in out:
            out.append(s)
    return out[:8]


class SuggestSkillsView(APIView):
    def post(self, request):
        text = (request.data.get("text") or "").strip()
        link = (request.data.get("link") or "").strip()
        if not text:
            return Response(
                {"error": "Please describe the project"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            skills = suggest_skills(f"Link: {link}\n\n{text}")
        except Exception:
            logger.exception("Skill suggestion failed")
            return Response(
                {"error": "Could not suggest skills, please try again"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"skills": skills})