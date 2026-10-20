import uuid
from django.conf import settings
from django.db import models


class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    deadline = models.DateTimeField()
    complexity = models.IntegerField(default=3)          # 1 se 5
    snooze_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default="pending")
    priority_score = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    priority_reason = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title