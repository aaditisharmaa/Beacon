from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from users.models import Profile

from .models import Opportunity


class MatchTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="op@test.com", password="pass12345"
        )
        Profile.objects.create(user=self.user, skills=["python", "django"], interests=["ai"])
        now = timezone.now()
        Opportunity.objects.create(title="Best", skill_tags=["Python", "Django"], deadline=now + timedelta(days=5))
        Opportunity.objects.create(title="Some", skill_tags=["python"], deadline=now + timedelta(days=2))
        Opportunity.objects.create(title="None", skill_tags=["cooking"], deadline=now + timedelta(days=1))
        Opportunity.objects.create(title="Past", skill_tags=["python"], deadline=now - timedelta(days=1))

    def test_requires_login(self):
        self.assertEqual(APIClient().get("/api/opportunities/match").status_code, 401)

    def test_sorted_by_match_and_past_hidden(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/opportunities/match")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r["title"] for r in res.data], ["Best", "Some", "None"])
        self.assertEqual(res.data[0]["matched"], ["django", "python"])