from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Profile

from .models import Opportunity


class MatchView(APIView):
    """Upcoming events, jinke skill tags tere skills/interests se zyada milte hain wo upar."""

    def get(self, request):
        profile = Profile.objects.filter(user=request.user).first()
        mine = set()
        if profile:
            mine = {str(s).strip().lower() for s in (profile.skills + profile.interests)}

        results = []
        for o in Opportunity.objects.filter(deadline__gte=timezone.now()):
            tags = {str(t).strip().lower() for t in o.skill_tags}
            matched = sorted(tags & mine)
            results.append(
                {
                    "id": str(o.id),
                    "title": o.title,
                    "kind": o.kind,
                    "source": o.source,
                    "url": o.url,
                    "deadline": o.deadline,
                    "skill_tags": o.skill_tags,
                    "matched": matched,
                    "score": len(matched),
                }
            )
        results.sort(key=lambda r: (-r["score"], r["deadline"]))
        return Response(results[:20])