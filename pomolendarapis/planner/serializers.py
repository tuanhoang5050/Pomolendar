# planner/serializers.py

from rest_framework import serializers
from .models import Task, FixedEvent, PomodoroSession


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'updated_at')

class FixedEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedEvent
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'updated_at')

class PomodoroSessionSerializer(serializers.ModelSerializer):
    task_title = serializers.CharField(source='task.title', read_only=True)

    class Meta:
        model = PomodoroSession
        fields = ['id', 'task', 'task_title', 'start_time', 'end_time', 'duration_minutes']
        read_only_fields = ['start_time', 'end_time', 'duration_minutes']