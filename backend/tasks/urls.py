from django.urls import path

from .views import (
    CaptureView,
    CompleteTaskView,
    PrioritizedTasksView,
    SnoozeTaskView,
    TaskListCreateView,
    RoadmapView,

)

urlpatterns = [
    path("", TaskListCreateView.as_view()),
    path("prioritize", PrioritizedTasksView.as_view()),
    path("capture", CaptureView.as_view()),
    path("<uuid:pk>/snooze", SnoozeTaskView.as_view()),
    path("<uuid:pk>/roadmap", RoadmapView.as_view()),
    path("<uuid:pk>/complete", CompleteTaskView.as_view()),
]