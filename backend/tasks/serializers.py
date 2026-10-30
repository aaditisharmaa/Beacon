from rest_framework import serializers

from .models import Roadmap, Task



class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id", "title", "deadline", "internal_deadline", "planned_start", "complexity", "snooze_count",
            "status", "priority_score", "priority_reason",
            "created_at", "completed_at",
        ]
        read_only_fields = [
            "id", "internal_deadline", "snooze_count", "status", "priority_score",
            "priority_reason", "created_at", "completed_at",
        ]

    def validate_complexity(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Complexity must be between 1 and 5")
        return value


class RoadmapSerializer(serializers.ModelSerializer):
    class Meta:
        model = Roadmap
        fields = ["id", "task", "plan_type", "steps", "resources", "is_active", "created_at"]

    