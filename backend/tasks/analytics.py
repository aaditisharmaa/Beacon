from datetime import timedelta

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Task


class AnalyticsView(APIView):
    """Pichhle 7 din ka summary: done, on-time, late, overdue, snoozes."""

    def get(self, request):
        now = timezone.now()
        week_start = now - timedelta(days=7)
        tasks = Task.objects.filter(user=request.user)

        done = list(tasks.filter(status="done", completed_at__gte=week_start))
        on_time = sum(1 for t in done if t.completed_at <= t.deadline)
        pending = tasks.filter(status="pending")
        overdue = pending.filter(deadline__lt=now).count()
        snoozes = sum(t.snooze_count for t in done) + sum(
            t.snooze_count for t in pending
        )

        today = timezone.localdate()
        daily = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            count = sum(
                1 for t in done if timezone.localtime(t.completed_at).date() == day
            )
            daily.append({"date": day.isoformat(), "done": count})

        return Response(
            {
                "completed": len(done),
                "on_time": on_time,
                "late": len(done) - on_time,
                "pending": pending.count(),
                "overdue": overdue,
                "snoozes": snoozes,
                "daily": daily,
            }
        )