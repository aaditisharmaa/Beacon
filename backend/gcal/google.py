import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import httpx

IST = ZoneInfo("Asia/Kolkata")
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
SCOPE = "https://www.googleapis.com/auth/calendar.readonly"


class ReconnectNeeded(Exception):
    """Refresh token kaam nahi kar raha, user ko dobara connect karna hoga."""


def configured():
    return bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET"))


def redirect_uri():
    return os.environ.get(
        "GOOGLE_REDIRECT_URI", "http://127.0.0.1:8001/api/calendar/callback"
    )


def build_auth_url(state):
    params = {
        "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(code):
    res = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    res.raise_for_status()
    return res.json()


def access_token(refresh_token):
    res = httpx.post(
        TOKEN_URL,
        data={
            "refresh_token": refresh_token,
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    if res.status_code in (400, 401):
        raise ReconnectNeeded()
    res.raise_for_status()
    return res.json()["access_token"]


def fetch_events(refresh_token, days=14):
    token = access_token(refresh_token)
    now = datetime.now(timezone.utc)
    res = httpx.get(
        EVENTS_URL,
        headers={"Authorization": f"Bearer {token}"},
        params={
            "timeMin": now.isoformat().replace("+00:00", "Z"),
            "timeMax": (now + timedelta(days=days)).isoformat().replace("+00:00", "Z"),
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": 30,
        },
        timeout=15,
    )
    res.raise_for_status()

    out = []
    for item in res.json().get("items", []):
        if item.get("status") == "cancelled":
            continue
        start = item.get("start") or {}
        if "dateTime" in start:
            when = datetime.fromisoformat(start["dateTime"])
        elif "date" in start:
            # poore din ka event: us din raat 11:59 maan lo
            when = datetime.fromisoformat(start["date"] + "T23:59:00").replace(tzinfo=IST)
        else:
            continue
        out.append(
            {
                "id": item.get("id", ""),
                "title": (item.get("summary") or "Untitled event")[:200],
                "start": when.isoformat(),
            }
        )
    return out