import uuid

from django.db import models


class Opportunity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, default="hackathon")  # hackathon, workshop, internship
    source = models.CharField(max_length=40, default="sample")   # sample, unstop, devfolio
    url = models.URLField(blank=True)
    skill_tags = models.JSONField(default=list)                  # ["python", "react"]
    deadline = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title