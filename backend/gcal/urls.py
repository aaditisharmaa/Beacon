from django.urls import path

from .views import CallbackView, DisconnectView, EventsView, StatusView

urlpatterns = [
    path("status", StatusView.as_view()),
    path("callback", CallbackView.as_view()),
    path("events", EventsView.as_view()),
    path("disconnect", DisconnectView.as_view()),
]