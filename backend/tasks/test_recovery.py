from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Task


class RecoveryTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="rc@test.com", password="pass12345")
        self.other = User.objects.create_user(username="rc2@test.com", password="pass12345")
        self.task = Task.objects.create(
            user=self.user, title="Report", deadline=timezone.now() - timedelta(hours=3)
        )

    @patch(
        "tasks.recovery.generate_recovery",
        return_value={"salvage": ["a", "b", "c"], "message": "Dear Sir"},
    )
    def test_returns_plan(self, _m):
        self.client.force_authenticate(self.user)
        res = self.client.post(f"/api/tasks/{self.task.id}/recovery")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["salvage"]), 3)
        self.assertEqual(res.data["message"], "Dear Sir")

    def test_done_task_rejected(self):
        self.task.status = "done"
        self.task.save()
        self.client.force_authenticate(self.user)
        res = self.client.post(f"/api/tasks/{self.task.id}/recovery")
        self.assertEqual(res.status_code, 400)

    def test_other_user_404(self):
        self.client.force_authenticate(self.other)
        res = self.client.post(f"/api/tasks/{self.task.id}/recovery")
        self.assertEqual(res.status_code, 404)