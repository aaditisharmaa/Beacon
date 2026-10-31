from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase


class SuggestSkillsTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="sk@test.com", password="pass12345"
        )

    def test_requires_login(self):
        self.assertEqual(APIClient().post("/api/auth/skills/suggest").status_code, 401)

    def test_text_required(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/auth/skills/suggest", {}, format="json")
        self.assertEqual(res.status_code, 400)

    @patch("users.skills.suggest_skills", return_value=["python", "django"])
    def test_returns_skills(self, _m):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            "/api/auth/skills/suggest", {"text": "Django API project"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["skills"], ["python", "django"])