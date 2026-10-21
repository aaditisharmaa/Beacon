from django.urls import path

from .views import CaptureView, PrioritizedTasksView, TaskListCreateView

urlpatterns = [
    path("", TaskListCreateView.as_view()),
    path("prioritize", PrioritizedTasksView.as_view()),
    path("capture", CaptureView.as_view()),
]