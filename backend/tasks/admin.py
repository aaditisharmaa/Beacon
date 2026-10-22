from django.contrib import admin

from .models import Roadmap, Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "deadline", "status", "priority_score")
    search_fields = ("title",)


@admin.register(Roadmap)
class RoadmapAdmin(admin.ModelAdmin):
    list_display = ("task", "plan_type", "is_active", "created_at")