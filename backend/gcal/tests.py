import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from rest_framework.test import APIClient, APITestCase

from .models import GoogleAccount

KEYS = {"GOOGLE_CLIENT_ID": "id", "GOOGLE_CLIENT_SECRET": "secret"}


class CalendarTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="g@test.com", password="pass12345")

    def test_requires_login(self):
        self.assertEqual(APIClient().get("/api/calendar/status").status_code, 401)

    def test_status_when_keys_missing(self):
        self.client.force_authenticate(self.user)
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": ""}):
            res = self.client.get("/api/calendar/status")
        self.assertFalse(res.data["configured"])

    def test_status_gives_url_when_configured(self):
        self.client.force_authenticate(self.user)
        with patch.dict(os.environ, KEYS):
            res = self.client.get("/api/calendar/status")
        self.assertTrue(res.data["configured"])
        self.assertFalse(res.data["connected"])
        self.assertIn("accounts.google.com", res.data["url"])

    def test_callback_rejects_bad_state(self):
        res = APIClient().get("/api/calendar/callback?code=x&state=bad")
        self.assertEqual(res.status_code, 400)

    @patch("gcal.views.exchange_code", return_value={"refresh_token": "r1"})
    def test_callback_saves_token(self, _m):
        state = signing.dumps({"uid": self.user.id}, salt="gcal-state")
        res = APIClient().get(f"/api/calendar/callback?code=x&state={state}")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(GoogleAccount.objects.filter(user=self.user).exists())

    def test_events_need_connection(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/calendar/events").status_code, 400)

    @patch("gcal.views.fetch_events", return_value=[{"id": "1", "title": "Viva", "start": "2026-11-05T10:00:00+05:30"}])
    def test_events_returned(self, _m):
        GoogleAccount.objects.create(user=self.user, refresh_token="r1")
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/calendar/events")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data[0]["title"], "Viva")