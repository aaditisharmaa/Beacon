import logging

from django.contrib.auth import get_user_model
from django.core import signing
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .google import (
    ReconnectNeeded,
    build_auth_url,
    configured,
    exchange_code,
    fetch_events,
)
from .models import GoogleAccount

logger = logging.getLogger(__name__)
SALT = "gcal-state"


class StatusView(APIView):
    def get(self, request):
        if not configured():
            return Response({"configured": False, "connected": False, "url": ""})
        state = signing.dumps({"uid": request.user.id}, salt=SALT)
        return Response(
            {
                "configured": True,
                "connected": GoogleAccount.objects.filter(user=request.user).exists(),
                "url": build_auth_url(state),
            }
        )


class CallbackView(APIView):
    """Google yahan browser ko wapas bhejta hai. Login header nahi hota, isliye signed state se user pehchante hain."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get("code")
        if request.GET.get("error") or not code:
            return HttpResponse("Google connection was cancelled. You can close this tab.", status=400)
        try:
            data = signing.loads(request.GET.get("state", ""), salt=SALT, max_age=600)
            user = get_user_model().objects.get(pk=data["uid"])
        except (signing.BadSignature, get_user_model().DoesNotExist, KeyError):
            return HttpResponse("This link expired. Please click Connect again in BEACON.", status=400)
        try:
            tokens = exchange_code(code)
        except Exception:
            logger.exception("Google code exchange failed")
            return HttpResponse("Could not connect to Google. Please try again.", status=502)
        refresh = tokens.get("refresh_token")
        if not refresh:
            return HttpResponse("Google did not give offline access. Please try again.", status=400)
        GoogleAccount.objects.update_or_create(user=user, defaults={"refresh_token": refresh})
        return HttpResponse("Google Calendar connected. You can close this tab and go back to BEACON.")


class EventsView(APIView):
    def get(self, request):
        account = GoogleAccount.objects.filter(user=request.user).first()
        if not account:
            return Response({"error": "Google Calendar is not connected"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            events = fetch_events(account.refresh_token, past_minutes=30 if request.GET.get("recent") else 0)
        except ReconnectNeeded:
            account.delete()
            return Response({"error": "Google access expired, please connect again"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception("Calendar fetch failed")
            return Response({"error": "Could not read your calendar, try again"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(events)


class DisconnectView(APIView):
    def post(self, request):
        GoogleAccount.objects.filter(user=request.user).delete()
        return Response({"connected": False})