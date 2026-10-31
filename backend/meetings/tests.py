from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.test import APIClient, APITestCase

from .groq import MAX_CHARS, MeetingAIError, clean_result

SAMPLE = {
    "summary": "Project review done.",
    "decisions": ["Demo on Friday"],
    "action_items": [{"task": "Send report", "owner": "me", "deadline": "2026-11-06T17:00:00+05:30"}],
}


class MeetingApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="m@test.com", password="pass12345")

    def test_requires_login(self):
        self.assertEqual(APIClient().post("/api/meetings/extract", {"text": "x"}, format="json").status_code, 401)

    def test_empty_text_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/meetings/extract", {"text": "   "}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_too_long_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/meetings/extract", {"text": "a" * (MAX_CHARS + 1)}, format="json")
        self.assertEqual(res.status_code, 400)

    @patch("meetings.views.extract", return_value=SAMPLE)
    def test_returns_items(self, _m):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/meetings/extract", {"text": "notes"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["action_items"][0]["task"], "Send report")

    @patch("meetings.views.extract", side_effect=MeetingAIError("busy"))
    def test_ai_error_is_502(self, _m):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/meetings/extract", {"text": "notes"}, format="json")
        self.assertEqual(res.status_code, 502)
        self.assertEqual(res.data["error"], "busy")


class CleanTests(SimpleTestCase):
    def test_bad_deadline_becomes_none(self):
        out = clean_result({"action_items": [{"task": "A", "owner": "me", "deadline": "garbage"}]})
        self.assertIsNone(out["action_items"][0]["deadline"])

    def test_blank_tasks_dropped(self):
        out = clean_result({"action_items": [{"task": "  "}, {"task": "Real"}], "decisions": "oops"})
        self.assertEqual(len(out["action_items"]), 1)
        self.assertEqual(out["decisions"], [])
        self.assertEqual(out["action_items"][0]["owner"], "unassigned")

    def test_naive_deadline_gets_ist(self):
        out = clean_result({"action_items": [{"task": "A", "deadline": "2026-11-06T17:00:00"}]})
        self.assertTrue(out["action_items"][0]["deadline"].endswith("+05:30"))