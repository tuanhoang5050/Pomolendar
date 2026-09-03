from rest_framework import serializers
from django.db.models import Sum
from django.utils import timezone
from .models import Group, GroupMembership
from planner.models import PomodoroSession


FOCUS_STATUS_STALE_SECONDS = 60


class GroupMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(source='user.id', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    name = serializers.CharField(source='user.name', read_only=True)
    avatar = serializers.SerializerMethodField()
    is_focusing = serializers.SerializerMethodField()

    class Meta:
        model = GroupMembership
        fields = ['user_id', 'email', 'name', 'avatar', 'is_focusing', 'current_task_title', 'joined_at']

    def get_avatar(self, obj):
        try:
            return obj.user.avatar.url if obj.user.avatar else None
        except Exception:
            return None

    def get_is_focusing(self, obj):
        if not obj.is_focusing or not obj.last_status_update:
            return False
        return (timezone.now() - obj.last_status_update).total_seconds() <= FOCUS_STATUS_STALE_SECONDS


class GroupSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    total_focus_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'is_public', 'avatar', 'invite_code',
            'created_by', 'created_at', 'member_count', 'total_focus_minutes'
        ]
        read_only_fields = ['invite_code', 'created_by', 'created_at']

    def get_avatar(self, obj):
        try:
            return obj.avatar.url if obj.avatar else None
        except Exception:
            return None

    def get_member_count(self, obj):
        return obj.members.count()

    def get_total_focus_minutes(self, obj):
        member_user_ids = obj.members.values_list('user_id', flat=True)
        total = PomodoroSession.objects.filter(
            user_id__in=member_user_ids
        ).aggregate(total=Sum('duration_minutes'))['total']
        return total or 0


class GroupDetailSerializer(GroupSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)

    class Meta(GroupSerializer.Meta):
        fields = GroupSerializer.Meta.fields + ['members']