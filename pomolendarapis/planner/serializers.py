from rest_framework import serializers
from .models import Task, FixedEvent, PomodoroSession, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'name', 'color')
        read_only_fields = ('id',)


class TaskSerializer(serializers.ModelSerializer):
    tags = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), many=True, required=False)
    tags_detail = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'updated_at')

    def get_tags_detail(self, obj):
        active_tags = obj.tags.filter(active=True)
        return TagSerializer(active_tags, many=True).data

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