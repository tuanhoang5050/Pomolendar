# gamification/serializers.py
from rest_framework import serializers
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['knowledge_points', 'books_collected', 'current_streak', 'last_active_date']
        read_only_fields = fields