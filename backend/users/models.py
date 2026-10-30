from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    full_name = models.CharField(max_length=120, blank=True)
    branch = models.CharField(max_length=80, blank=True)
    year = models.IntegerField(default=1)                 # 1 se 4
    skills = models.JSONField(default=list, blank=True)   # ["python", "react"]
    interests = models.JSONField(default=list, blank=True)
    career_goal = models.CharField(max_length=200, blank=True)
    onboarded = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name or self.user.get_username()