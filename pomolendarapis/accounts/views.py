# accounts/views.py

from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from gamification.services import add_points_and_check_levelup
from .models import User
from .serializers import UserSerializer
from gamification.models import UserProfile  # Import model Gamification


class UserViewSet(viewsets.ViewSet):
    def create(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            email = request.data.get('email')
            user = User.objects.get(email=email)
            profile, _ = UserProfile.objects.get_or_create(user=user)
            today = timezone.now().date()

            if profile.last_active_date != today:
                if profile.last_active_date == today - timedelta(days=1):
                    profile.current_streak += 1
                else:
                    profile.current_streak = 1

                effective_streak = min(profile.current_streak, 80)
                points_earned = 30 + (effective_streak * 6)

                profile.last_active_date = today
                profile.save()

                gamification_data = add_points_and_check_levelup(user, points_earned)

                if gamification_data:
                    gamification_data["current_streak"] = profile.current_streak
                    gamification_data["points_earned_today"] = gamification_data.pop("points_earned")

                response.data['gamification'] = gamification_data
            else:
                response.data['gamification'] = {
                    "points_earned_today": 0,
                    "current_points": profile.knowledge_points,
                    "current_streak": profile.current_streak,
                    "books_collected": profile.books_collected,
                    "leveled_up": False
                }

        return response