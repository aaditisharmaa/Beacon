from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Task
from .priority import calculate_priority
from .serializers import TaskSerializer


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        data = serializer.validated_data
        score, reason = calculate_priority(
            data["deadline"], data.get("complexity", 3), 0
        )
        serializer.save(
            user=self.request.user,
            priority_score=score,
            priority_reason=reason,
        )


class PrioritizedTasksView(APIView):
    def get(self, request):
        tasks = list(Task.objects.filter(user=request.user, status="pending"))
        for task in tasks:
            score, reason = calculate_priority(
                task.deadline, task.complexity, task.snooze_count
            )
            task.priority_score = score
            task.priority_reason = reason
            task.save(update_fields=["priority_score", "priority_reason"])
        tasks.sort(key=lambda t: t.priority_score, reverse=True)
        return Response(TaskSerializer(tasks, many=True).data)