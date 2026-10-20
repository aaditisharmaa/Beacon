from django.urls import path

from .views import PrioritizedTasksView, TaskListCreateView

urlpatterns = [
    path("", TaskListCreateView.as_view()),
    path("prioritize", PrioritizedTasksView.as_view()),
]