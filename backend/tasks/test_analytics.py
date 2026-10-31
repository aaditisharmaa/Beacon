from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import Task


class AnalyticsTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="an@test.com", password="pass12345"
        )
        now = timezone.now()
        Task.objects.create(
            user=self.user, title="on time", status="done",
            deadline=now + timedelta(hours=5), completed_at=now,
        )
        Task.objects.create(
            user=self.user, title="late", status="done",
            deadline=now - timedelta(hours=5), completed_at=now,
        )
        Task.objects.create(
            user=self.user, title="overdue", status="pending",
            deadline=now - timedelta(hours=1), snooze_count=2,
        )

    def test_requires_login(self):
        self.assertEqual(APIClient().get("/api/tasks/analytics").status_code, 401)

    def test_counts(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/tasks/analytics")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["completed"], 2)
        self.assertEqual(res.data["on_time"], 1)
        self.assertEqual(res.data["late"], 1)
        self.assertEqual(res.data["overdue"], 1)
        self.assertEqual(res.data["snoozes"], 2)
        self.assertEqual(len(res.data["daily"]), 7)