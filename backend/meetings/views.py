import logging

import httpx
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .groq import MAX_CHARS, MeetingAIError, extract

logger = logging.getLogger(__name__)


class ExtractView(APIView):
    def post(self, request):
        text = request.data.get("text", "")
        if not isinstance(text, str) or not text.strip():
            return Response({"error": "Paste the meeting notes first"}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > MAX_CHARS:
            return Response(
                {"error": f"Notes are too long, keep them under {MAX_CHARS} characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return Response(extract(text.strip()))
        except MeetingAIError as err:
            return Response({"error": str(err)}, status=status.HTTP_502_BAD_GATEWAY)
        except httpx.HTTPError:
            logger.exception("Groq request failed")
            return Response({"error": "Could not reach the AI service, try again"}, status=status.HTTP_502_BAD_GATEWAY)