from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Group, GroupMembership
from .serializers import GroupSerializer, GroupDetailSerializer
from planner.models import PomodoroSession
from gamification.models import UserProfile


class GroupListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        memberships = GroupMembership.objects.filter(user=request.user).select_related('group')
        groups = [m.group for m in memberships]
        serializer = GroupSerializer(groups, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'Please enter group name.'}, status=status.HTTP_400_BAD_REQUEST)

        description = (request.data.get('description') or '').strip()
        is_public_raw = request.data.get('is_public', False)
        is_public = str(is_public_raw).lower() in ('true', '1')
        avatar_file = request.FILES.get('avatar')

        group = Group.objects.create(
            name=name,
            description=description,
            is_public=is_public,
            created_by=request.user
        )
        if avatar_file:
            group.avatar = avatar_file
            group.save(update_fields=['avatar'])

        GroupMembership.objects.create(group=group, user=request.user)

        return Response(GroupSerializer(group, context={'request': request}).data, status=status.HTTP_201_CREATED)


class DiscoverPublicGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        joined_group_ids = GroupMembership.objects.filter(user=request.user).values_list('group_id', flat=True)
        groups = Group.objects.filter(is_public=True).exclude(id__in=joined_group_ids).order_by('-created_at')
        serializer = GroupSerializer(groups, many=True, context={'request': request})
        return Response(serializer.data)


class JoinPublicGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk, is_public=True)

        if GroupMembership.objects.filter(group=group, user=request.user).exists():
            return Response({'error': 'You already in this group.'}, status=status.HTTP_400_BAD_REQUEST)

        GroupMembership.objects.create(group=group, user=request.user)
        return Response(GroupSerializer(group, context={'request': request}).data, status=status.HTTP_200_OK)


class JoinGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = (request.data.get('invite_code') or '').strip().upper()
        if not code:
            return Response({'error': 'Please fill in group code.'}, status=status.HTTP_400_BAD_REQUEST)

        group = Group.objects.filter(invite_code=code).first()
        if not group:
            return Response({'error': 'Invalid code.'}, status=status.HTTP_404_NOT_FOUND)

        if GroupMembership.objects.filter(group=group, user=request.user).exists():
            return Response({'error': 'You already in this group.'}, status=status.HTTP_400_BAD_REQUEST)

        GroupMembership.objects.create(group=group, user=request.user)
        return Response(GroupSerializer(group, context={'request': request}).data, status=status.HTTP_200_OK)


class GroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        membership = get_object_or_404(GroupMembership, group_id=pk, user=request.user)
        serializer = GroupDetailSerializer(membership.group, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        membership = get_object_or_404(GroupMembership, group_id=pk, user=request.user)
        group = membership.group
        membership.delete()

        remaining = GroupMembership.objects.filter(group=group)
        if not remaining.exists():
            group.delete()
        elif group.created_by_id == request.user.id:
            new_owner_membership = remaining.first()
            group.created_by = new_owner_membership.user
            group.save(update_fields=['created_by'])

        return Response(status=status.HTTP_204_NO_CONTENT)


class UpdateFocusStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        is_focusing = bool(request.data.get('is_focusing', False))
        task_title = request.data.get('task_title')

        GroupMembership.objects.filter(user=request.user).update(
            is_focusing=is_focusing,
            last_status_update=timezone.now(),
            current_task_title=task_title if is_focusing else None,
        )

        return Response(status=status.HTTP_200_OK)


class GroupLeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        get_object_or_404(GroupMembership, group_id=pk, user=request.user)

        period = request.query_params.get('period', 'week')  # 'today' | 'week' | 'month'
        now = timezone.localtime()

        if period == 'today':
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'month':
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # week
            start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        member_users = GroupMembership.objects.filter(group_id=pk).select_related('user')

        leaderboard = []
        for m in member_users:
            total_minutes = PomodoroSession.objects.filter(
                user=m.user, start_time__gte=start
            ).aggregate(total=Sum('duration_minutes'))['total'] or 0

            profile, _ = UserProfile.objects.get_or_create(user=m.user)

            leaderboard.append({
                'user_id': str(m.user.id),
                'name': m.user.name,
                'total_minutes': total_minutes,
                'current_streak': profile.current_streak,
                'knowledge_points': profile.knowledge_points,
            })

        leaderboard.sort(key=lambda x: x['total_minutes'], reverse=True)

        return Response({
            'period': period,
            'leaderboard': leaderboard,
        })