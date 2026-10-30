import logging

from django.core.cache import cache
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .buffer import calculate_internal_deadline
from .llm import extract_task, generate_roadmap
from .models import Roadmap, Task
from .nudge import TONES, generate_nudge, time_bucket
from .planning import choose_plan_type
from .priority import calculate_priority
from .serializers import RoadmapSerializer, TaskSerializer

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
            internal_deadline=calculate_internal_deadline(
                data["deadline"], data.get("complexity", 3)
            ),
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


class RoadmapView(APIView):
    def get(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)
        roadmap = (
            task.roadmaps.filter(is_active=True).order_by("-created_at").first()
        )
        if not roadmap:
            return Response(
                {"error": "No roadmap yet"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(RoadmapSerializer(roadmap).data)

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)
        if task.status != "pending":
            return Response(
                {"error": "Only pending tasks can have a roadmap"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hours_left = (task.deadline - timezone.now()).total_seconds() / 3600
        plan_type = choose_plan_type(hours_left)
        current = (
            task.roadmaps.filter(is_active=True).order_by("-created_at").first()
        )

        # plan sahi type ka pehle se hai toh dobara AI ko mat bulao
        if current and current.plan_type == plan_type:
            return Response({**RoadmapSerializer(current).data, "replaced": False})

        try:
            result = generate_roadmap(
                task.title, plan_type, hours_left, task.complexity
            )
        except Exception:
            logger.exception("Roadmap generation failed")
            return Response(
                {"error": "Could not generate a roadmap, please try again"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            replaced = current is not None
            task.roadmaps.filter(is_active=True).update(is_active=False)
            roadmap = Roadmap.objects.create(task=task, plan_type=plan_type, **result)

        return Response(
            {**RoadmapSerializer(roadmap).data, "replaced": replaced},
            status=status.HTTP_201_CREATED,
        )


class NudgeView(APIView):
    """Avatar ke liye ek chhoti Hinglish line (AI), cache ke saath."""

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk, user=request.user)

        tone = request.data.get("tone")
        if tone not in TONES:
            return Response(
                {"error": "tone must be friendly, nudging or strict"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if task.status != "pending":
            return Response(
                {"error": "Only pending tasks get nudges"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hours_left = (task.deadline - timezone.now()).total_seconds() / 3600
        key = (
            f"nudge:{task.id}:{tone}:{task.snooze_count}:{time_bucket(hours_left)}"
        )

        message = cache.get(key)
        if message is None:
            try:
                message = generate_nudge(
                    task.title, tone, hours_left, task.snooze_count
                )
            except Exception:
                logger.exception("Nudge generation failed")
                return Response(
                    {"error": "Could not generate a nudge"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            cache.set(key, message, 6 * 3600)

        return Response({"message": message})