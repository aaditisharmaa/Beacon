from django.conf import settings
from django.db import models


class GoogleAccount(models.Model):
    """Har user ka Google refresh token (sirf calendar read-only permission ke saath)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="google_account"
    )
    refresh_token = models.TextField()
    connected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Google account of {self.user_id}"