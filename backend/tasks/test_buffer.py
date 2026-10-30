from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .buffer import calculate_internal_deadline


class BufferTests(APITestCase):
    def test_complex_task_gets_bigger_buffer(self):
        now = timezone.now()
        deadline = now + timedelta(days=10)
        easy = calculate_internal_deadline(deadline, 1, now)
        hard = calculate_internal_deadline(deadline, 5, now)
        self.assertEqual(deadline - easy, timedelta(hours=2))
        self.assertEqual(deadline - hard, timedelta(hours=24))

    def test_short_time_uses_half_of_remaining(self):
        now = timezone.now()
        deadline = now + timedelta(hours=3)
        result = calculate_internal_deadline(deadline, 5, now)
        self.assertEqual(result, now + timedelta(hours=1, minutes=30))

    def test_past_deadline_stays_same(self):
        now = timezone.now()
        deadline = now - timedelta(hours=1)
        self.assertEqual(calculate_internal_deadline(deadline, 3, now), deadline)

    def test_create_task_sets_internal_deadline(self):
        user = get_user_model().objects.create_user(
            username="buf@test.com", password="pass12345"
        )
        self.client.force_authenticate(user)
        deadline = timezone.now() + timedelta(days=5)
        res = self.client.post(
            "/api/tasks/",
            {"title": "DBMS assignment", "deadline": deadline.isoformat(), "complexity": 3},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIsNotNone(res.data["internal_deadline"])