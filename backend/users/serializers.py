from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Profile


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "password"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered")
        return value.lower()

    def create(self, validated_data):
        email = validated_data["email"]
        return User.objects.create_user(
            username=email, email=email, password=validated_data["password"]
        )


def _clean_list(value, label):
    if not isinstance(value, list):
        raise serializers.ValidationError(f"{label} must be a list")
    out = []
    for item in value:
        s = str(item).strip().lower()[:40]
        if s and s not in out:
            out.append(s)
    return out[:30]


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "full_name",
            "branch",
            "year",
            "skills",
            "interests",
            "career_goal",
            "onboarded",
        ]

    def validate_year(self, value):
        if not 1 <= value <= 4:
            raise serializers.ValidationError("Year must be between 1 and 4")
        return value

    def validate_skills(self, value):
        return _clean_list(value, "Skills")

    def validate_interests(self, value):
        return _clean_list(value, "Interests")