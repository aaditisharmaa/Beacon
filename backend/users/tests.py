from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase


class RegisterLoginTests(APITestCase):
    def test_register_creates_user(self):
        res = self.client.post(
            "/api/auth/register",
            {"email": "Aditi@Test.com", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(get_user_model().objects.filter(username="aditi@test.com").exists())
        self.assertNotIn("password", res.data)

    def test_duplicate_email_rejected(self):
        data = {"email": "dup@test.com", "password": "pass12345"}
        self.client.post("/api/auth/register", data, format="json")
        res = self.client.post("/api/auth/register", data, format="json")
        self.assertEqual(res.status_code, 400)

    def test_short_password_rejected(self):
        res = self.client.post(
            "/api/auth/register",
            {"email": "short@test.com", "password": "123"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_login_returns_tokens(self):
        self.client.post(
            "/api/auth/register",
            {"email": "login@test.com", "password": "pass12345"},
            format="json",
        )
        res = self.client.post(
            "/api/auth/login",
            {"username": "login@test.com", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="p@test.com", email="p@test.com", password="pass12345"
        )

    def test_profile_requires_login(self):
        res = APIClient().get("/api/auth/profile")
        self.assertEqual(res.status_code, 401)

    def test_profile_auto_created_not_onboarded(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/auth/profile")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["onboarded"])

    def test_profile_update_cleans_skills(self):
        self.client.force_authenticate(self.user)
        res = self.client.put(
            "/api/auth/profile",
            {
                "full_name": "Aditi",
                "branch": "CSE",
                "year": 3,
                "skills": ["Python", " python ", "React"],
                "interests": ["AI"],
                "career_goal": "ML engineer",
                "onboarded": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["skills"], ["python", "react"])
        self.assertTrue(res.data["onboarded"])

    def test_invalid_year_rejected(self):
        self.client.force_authenticate(self.user)
        res = self.client.put(
            "/api/auth/profile",
            {
                "full_name": "Aditi",
                "branch": "CSE",
                "year": 9,
                "skills": [],
                "interests": [],
                "career_goal": "",
                "onboarded": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)