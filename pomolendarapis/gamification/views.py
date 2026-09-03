from django.db import transaction, models
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import UserProfile, ActivityLog, UserItem, StoreItem
from .serializers import UserProfileSerializer, StoreItemSerializer


class UserProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)

        return Response(serializer.data)


class ActivityLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = ActivityLog.objects.filter(user=request.user)[:10]
        data = [
            {
                "id": log.id,
                "activity_type": log.activity_type,
                "points": log.points,
                "created_at": log.created_at.isoformat()
            }
            for log in logs
        ]
        return Response(data)


class GlobalLeaderboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        top_profiles = UserProfile.objects.select_related('user').order_by('-books_collected', '-knowledge_points')[
            :100]

        leaderboard = []
        for idx, p in enumerate(top_profiles):
            leaderboard.append({
                "rank": idx + 1,
                "user_id": str(p.user.id),
                "name": p.user.name,
                "avatar": p.user.avatar.url if p.user.avatar else None,
                "books_collected": p.books_collected,
                "knowledge_points": p.knowledge_points
            })

        current_profile = UserProfile.objects.get(user=request.user)
        higher_users_count = UserProfile.objects.filter(
            models.Q(books_collected__gt=current_profile.books_collected) |
            models.Q(books_collected=current_profile.books_collected,
                     knowledge_points__gt=current_profile.knowledge_points)
        ).count()

        current_user_data = {
            "rank": higher_users_count + 1,
            "user_id": str(request.user.id),
            "name": request.user.name,
            "avatar": request.user.avatar.url if request.user.avatar else None,
            "books_collected": current_profile.books_collected,
            "knowledge_points": current_profile.knowledge_points
        }

        return Response({
            "leaderboard": leaderboard,
            "current_user": current_user_data
        }, status=status.HTTP_200_OK)


class StoreAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = UserProfile.objects.get(user=request.user)
        items = StoreItem.objects.filter(is_active=True)
        user_items = UserItem.objects.filter(user=request.user)

        inventory_set = {ui.item_id for ui in user_items}
        equipped_set = {profile.equipped_animation_id, profile.equipped_sound_id}

        data = []
        for item in items:
            item_data = StoreItemSerializer(item).data
            item_data['is_owned'] = item.id in inventory_set

            item_data['is_equipped'] = item.id in equipped_set
            data.append(item_data)

        return Response({
            "current_points": profile.knowledge_points,
            "items": data
        })

    def post(self, request):
        item_id = request.data.get('item_id')
        item = get_object_or_404(StoreItem, id=item_id, is_active=True)

        if UserItem.objects.filter(user=request.user, item=item).exists():
            return Response(status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            if profile.knowledge_points < item.price:
                return Response(status=status.HTTP_400_BAD_REQUEST)

            profile.knowledge_points -= item.price
            profile.books_collected = profile.knowledge_points // 1000
            profile.save()

            UserItem.objects.create(user=request.user, item=item)

        return Response({"current_points": profile.knowledge_points}, status=status.HTTP_200_OK)


class EquipItemAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_id = request.data.get('item_id')
        action = request.data.get('action')

        profile = UserProfile.objects.get(user=request.user)
        item = get_object_or_404(StoreItem, id=item_id)

        if action == 'unequip':
            if item.category == 'animation':
                profile.equipped_animation = None
            elif item.category == 'sound':
                profile.equipped_sound = None
            profile.save()
            return Response(status=status.HTTP_200_OK)

        if not UserItem.objects.filter(user=request.user, item=item).exists():
            return Response(status=status.HTTP_403_FORBIDDEN)

        if item.category == 'animation':
            profile.equipped_animation = item
        elif item.category == 'sound':
            profile.equipped_sound = item

        profile.save()
        return Response(status=status.HTTP_200_OK)