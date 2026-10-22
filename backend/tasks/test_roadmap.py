from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Task
from .planning import choose_plan_type

FAKE = {"steps": ["a", "b", "c"], "resources": []}


class PlanTypeTests(SimpleTestCase):
    def test_far_deadline_is_full(self):
        self.assertEqual(choose_plan_type(120), "full")

    def test_close_deadline_is_survival(self):
        self.assertEqual(choose_plan_type(30), "survival")

    def test_overdue_is_survival(self):
        self.assertEqual(choose_plan_type(-5), "survival")


class RoadmapApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("a@x.com", "a@x.com", "Pass@12345")
        self.other = User.objects.create_user("b@x.com", "b@x.com", "Pass@12345")
        self.task = Task.objects.create(
            user=self.user,
            title="DBMS exam",
            deadline=timezone.now() + timedelta(days=5),
        )
        self.client.force_authenticate(self.user)
        self.url = f"/api/tasks/{self.task.id}/roadmap"

    @patch("tasks.views.generate_roadmap", return_value=FAKE)
    def test_far_task_gets_full_plan(self, mock_gen):
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["plan_type"], "full")

    @patch("tasks.views.generate_roadmap", return_value=FAKE)
    def test_same_plan_is_not_regenerated(self, mock_gen):
        self.client.post(self.url)
        self.client.post(self.url)
        self.assertEqual(mock_gen.call_count, 1)

    @patch("tasks.views.generate_roadmap", return_value=FAKE)
    def test_close_deadline_scraps_full_plan(self, mock_gen):
        self.client.post(self.url)
        self.task.deadline = timezone.now() + timedelta(days=1)
        self.task.save()
        res = self.client.post(self.url)
        self.assertEqual(res.data["plan_type"], "survival")
        self.assertTrue(res.data["replaced"])
        self.assertEqual(self.task.roadmaps.filter(is_active=True).count(), 1)
        self.assertEqual(self.task.roadmaps.count(), 2)

    def test_other_user_gets_404(self):
        self.client.force_authenticate(self.other)
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 404)