from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Task


class TaskActionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("a@x.com", "a@x.com", "Pass@12345")
        self.other = User.objects.create_user("b@x.com", "b@x.com", "Pass@12345")
        self.task = Task.objects.create(
            user=self.user,
            title="Test task",
            deadline=timezone.now() + timedelta(days=2),
        )
        self.client.force_authenticate(self.user)

    def test_snooze_increases_count(self):
        res = self.client.post(f"/api/tasks/{self.task.id}/snooze")
        self.assertEqual(res.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.snooze_count, 1)

    def test_complete_sets_status_and_time(self):
        res = self.client.post(f"/api/tasks/{self.task.id}/complete")
        self.assertEqual(res.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "done")
        self.assertIsNotNone(self.task.completed_at)

    def test_cannot_touch_other_users_task(self):
        self.client.force_authenticate(self.other)
        res = self.client.post(f"/api/tasks/{self.task.id}/snooze")
        self.assertEqual(res.status_code, 404)

    def test_requires_login(self):
        self.client.force_authenticate(None)
        res = self.client.post(f"/api/tasks/{self.task.id}/snooze")
        self.assertEqual(res.status_code, 401)