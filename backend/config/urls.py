from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/tasks/", include("tasks.urls")),
    path("api/auth/", include("users.urls")),
    path("api/opportunities/", include("opportunities.urls")),
    path("api/calendar/", include("gcal.urls")),
    path("api/meetings/", include("meetings.urls")),
]