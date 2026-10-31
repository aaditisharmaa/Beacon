from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from opportunities.models import Opportunity

SAMPLES = [
    ("Sample AI Hackathon", "hackathon", ["python", "machine learning", "ai"], 12),
    ("Sample Web Dev Sprint", "hackathon", ["react", "javascript", "web"], 9),
    ("Sample Django Backend Workshop", "workshop", ["python", "django", "sql"], 6),
    ("Sample Cloud Cost Challenge", "hackathon", ["cloud", "python", "aws"], 20),
    ("Sample Data Science Bootcamp", "workshop", ["data science", "python", "pandas"], 15),
    ("Sample UI/UX Design Jam", "hackathon", ["ui design", "figma", "react"], 18),
    ("Sample Cybersecurity CTF", "hackathon", ["cybersecurity", "linux", "networking"], 25),
    ("Sample Android App Contest", "hackathon", ["android", "kotlin", "java"], 30),
    ("Sample ML Internship Drive", "internship", ["machine learning", "python", "numpy"], 21),
    ("Sample Embedded Systems Workshop", "workshop", ["esp32", "c++", "robotics"], 14),
    ("Sample Open Source Week", "workshop", ["git", "python", "javascript"], 10),
    ("Sample Startup Pitch Day", "hackathon", ["product", "business", "ai"], 28),
]


class Command(BaseCommand):
    help = "Sample opportunities daalta hai (purane sample wale hata ke)"

    def handle(self, *args, **options):
        Opportunity.objects.filter(source="sample").delete()
        now = timezone.now()
        for title, kind, tags, days in SAMPLES:
            Opportunity.objects.create(
                title=title,
                kind=kind,
                source="sample",
                url="https://unstop.com" if kind != "workshop" else "https://devfolio.co",
                skill_tags=tags,
                deadline=now + timedelta(days=days),
            )
        self.stdout.write(f"Seeded {len(SAMPLES)} sample opportunities")