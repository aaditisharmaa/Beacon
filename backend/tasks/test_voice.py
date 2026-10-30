from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase


class TranscribeTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="voice@test.com", password="pass12345"
        )

    def test_requires_login(self):
        res = APIClient().post("/api/tasks/transcribe")
        self.assertEqual(res.status_code, 401)

    def test_missing_audio(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/tasks/transcribe", {}, format="multipart")
        self.assertEqual(res.status_code, 400)

    @patch("tasks.voice.transcribe_audio", return_value="kal tak report submit karna hai")
    def test_returns_text(self, _mock):
        self.client.force_authenticate(self.user)
        audio = SimpleUploadedFile(
            "voice.webm", b"x" * 2000, content_type="audio/webm"
        )
        res = self.client.post(
            "/api/tasks/transcribe", {"audio": audio}, format="multipart"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["text"], "kal tak report submit karna hai")