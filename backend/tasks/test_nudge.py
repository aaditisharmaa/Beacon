from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Task
from .nudge import time_bucket


class BucketTests(SimpleTestCase):
    def test_buckets(self):
        self.assertEqual(time_bucket(-1), "over")
        self.assertEqual(time_bucket(2), "lt3")
        self.assertEqual(time_bucket(10), "lt24")
        self.assertEqual(time_bucket(30), "lt48")
        self.assertEqual(time_bucket(100), "d4")


class NudgeApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("a@x.com", "a@x.com", "Pass@12345")
        self.other = User.objects.create_user("b@x.com", "b@x.com", "Pass@12345")
        self.task = Task.objects.create(
            user=self.user,
            title="DBMS exam",
            deadline=timezone.now() + timedelta(days=2),
        )
        self.client.force_authenticate(self.user)
        self.url = f"/api/tasks/{self.task.id}/nudge"

    def post(self, tone="friendly"):
        return self.client.post(self.url, {"tone": tone}, format="json")

    @patch("tasks.nudge.generate_nudge", return_value="Bhai DBMS pe lag ja")
    def test_returns_message(self, mock_gen):
        res = self.post()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "Bhai DBMS pe lag ja")

    @patch("tasks.nudge.generate_nudge", return_value="Chal shuru kar")
    def test_same_request_is_cached(self, mock_gen):
        self.post("nudging")
        self.post("nudging")
        self.assertEqual(mock_gen.call_count, 1)

    @patch("tasks.nudge.generate_nudge", return_value="Ab toh start kar")
    def test_snooze_gets_a_fresh_line(self, mock_gen):
        self.post("nudging")
        self.task.snooze_count += 1
        self.task.save()
        self.post("nudging")
        self.assertEqual(mock_gen.call_count, 2)

    def test_rejects_unknown_tone(self):
        self.assertEqual(self.post("angry").status_code, 400)

    def test_other_user_gets_404(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.post().status_code, 404)

    @patch("tasks.nudge.generate_nudge", side_effect=RuntimeError("boom"))
    def test_ai_failure_returns_502(self, mock_gen):
        self.assertEqual(self.post().status_code, 502)

    def test_done_task_is_rejected(self):
        self.task.status = "done"
        self.task.save()
        self.assertEqual(self.post().status_code, 400)

