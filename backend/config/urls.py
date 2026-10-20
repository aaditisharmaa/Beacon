from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/tasks/", include("tasks.urls")),
    path("api/auth/", include("users.urls")),
]