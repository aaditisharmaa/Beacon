from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Task


class FirstStepTests(APITestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.user = User.objects.create_user(username="fs@test.com", password="pass12345")
        self.other = User.objects.create_user(username="fs2@test.com", password="pass12345")
        self.task = Task.objects.create(
            user=self.user, title="DBMS assignment",
            deadline=timezone.now() + timedelta(days=3),
        )

    @patch("tasks.microstep.generate_micro_step", return_value="DBMS notes ka pehla page khol lo")
    def test_returns_step(self, _mock):
        self.client.force_authenticate(self.user)
        res = self.client.post(f"/api/tasks/{self.task.id}/first-step")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["step"], "DBMS notes ka pehla page khol lo")

    def test_completed_task_rejected(self):
        self.task.status = "done"
        self.task.save()
        self.client.force_authenticate(self.user)
        res = self.client.post(f"/api/tasks/{self.task.id}/first-step")
        self.assertEqual(res.status_code, 400)

    def test_other_users_task_404(self):
        self.client.force_authenticate(self.other)
        res = self.client.post(f"/api/tasks/{self.task.id}/first-step")
        self.assertEqual(res.status_code, 404)