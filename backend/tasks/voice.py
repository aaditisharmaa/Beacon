import logging
import os

from groq import Groq
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB, 60 sec ki recording isse bahut chhoti hoti hai

# Roman script mein Hinglish aaye, isliye hint
WHISPER_PROMPT = (
    "Student ka task ya deadline, Hinglish mein. "
    "Example: kal shaam tak DBMS assignment submit karna hai."
)


def transcribe_audio(filename, data):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.audio.transcriptions.create(
        file=(filename, data),
        model=os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo"),
        prompt=WHISPER_PROMPT,
        response_format="json",
        temperature=0,
    )
    return (response.text or "").strip()


class TranscribeView(APIView):
    """Audio lo, text wapas do. Audio kahin save nahi hota."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        audio = request.FILES.get("audio")
        if audio is None:
            return Response(
                {"error": "audio is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if audio.size > MAX_AUDIO_BYTES:
            return Response(
                {"error": "audio is too long"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            text = transcribe_audio("voice.webm", audio.read())
        except Exception:
            logger.exception("Transcription failed")
            return Response(
                {"error": "Could not transcribe, please type the task instead"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"text": text[:5000]})