from django.urls import path

from .nudge import NudgeView
from .views import (
    CaptureView,
    CompleteTaskView,
    PrioritizedTasksView,
    RoadmapView,
    SnoozeTaskView,
    TaskListCreateView,
)
from .voice import TranscribeView

urlpatterns = [
    path("", TaskListCreateView.as_view()),
    path("prioritize", PrioritizedTasksView.as_view()),
    path("capture", CaptureView.as_view()),
    path("transcribe", TranscribeView.as_view()),
    path("<uuid:pk>/snooze", SnoozeTaskView.as_view()),
    path("<uuid:pk>/complete", CompleteTaskView.as_view()),
    path("<uuid:pk>/roadmap", RoadmapView.as_view()),
    path("<uuid:pk>/nudge", NudgeView.as_view()),
]