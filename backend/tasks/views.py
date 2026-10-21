import logging

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .llm import extract_task
from .models import Task
from .priority import calculate_priority
from .serializers import TaskSerializer

logger = logging.getLogger(__name__)


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


class CaptureView(APIView):
    def post(self, request):
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response(
                {"error": "text is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        if len(text) > 5000:
            return Response(
                {"error": "text is too long"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            result = extract_task(text)
        except Exception:
            logger.exception("Capture failed")
            return Response(
                {"error": "AI extraction failed, please enter the task manually"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(result)





class SnoozeTaskView(APIView):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)
        if task.status != "pending":
            return Response(
                {"error": "Only pending tasks can be snoozed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.snooze_count += 1
        score, reason = calculate_priority(
            task.deadline, task.complexity, task.snooze_count
        )
        task.priority_score = score
        task.priority_reason = reason
        task.save()
        return Response(TaskSerializer(task).data)


class CompleteTaskView(APIView):
    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)
        if task.status == "done":
            return Response(
                {"error": "Task is already completed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.status = "done"
        task.completed_at = timezone.now()
        task.save()
        return Response(TaskSerializer(task).data)