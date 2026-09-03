import random
from datetime import timedelta

from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from gamification.services import add_points_and_check_levelup
from .models import User, PasswordResetOTP
from .serializers import UserSerializer
from gamification.models import UserProfile

OTP_EXPIRY_MINUTES = 10
OTP_RESEND_COOLDOWN_SECONDS = 60


class UserViewSet(viewsets.ViewSet):
    def get_permissions(self):
        if self.action == 'profile':
            return [IsAuthenticated()]
        return [AllowAny()]

    def create(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'patch'], url_path='profile', parser_classes=[MultiPartParser, FormParser])
    def profile(self, request):
        user = request.user

        if request.method == 'GET':
            serializer = UserSerializer(user)
            return Response(serializer.data)

        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            email = request.data.get('email')
            user = User.objects.get(email=email)
            profile, _ = UserProfile.objects.get_or_create(user=user)
            today = timezone.localdate()

            if profile.last_active_date != today:
                if profile.last_active_date == today - timedelta(days=1):
                    profile.current_streak += 1
                else:
                    profile.current_streak = 1

                effective_streak = min(profile.current_streak, 80)
                points_earned = 30 + (effective_streak * 6)

                profile.last_active_date = today
                profile.save()

                gamification_data = add_points_and_check_levelup(user, points_earned, activity_type='login')

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


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('id_token')
        if not token:
            return Response({'error': 'Missing id_token'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            idinfo = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )

            email = idinfo['email']
            name = idinfo.get('name', '')
            picture = idinfo.get('picture', '')

            user, created = User.objects.get_or_create(email=email)
            if created:
                user.name = name
                user.avatar = picture
                user.set_unusable_password()
                user.save()
            elif not user.avatar or 'encrypted-tbn0.gstatic.com' in str(user.avatar):
                user.avatar = picture
                user.save()

            if not user.is_active:
                return Response(
                    {'error': 'Account has been locked.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            profile, _ = UserProfile.objects.get_or_create(user=user)
            today = timezone.localdate()
            gamification_data = {
                "points_earned_today": 0, "current_points": profile.knowledge_points,
                "current_streak": profile.current_streak, "books_collected": profile.books_collected, "leveled_up": False
            }

            if profile.last_active_date != today:
                if profile.last_active_date == today - timedelta(days=1):
                    profile.current_streak += 1
                else:
                    profile.current_streak = 1

                effective_streak = min(profile.current_streak, 80)
                points_earned = 30 + (effective_streak * 6)
                profile.last_active_date = today
                profile.save()

                g_data = add_points_and_check_levelup(user, points_earned, activity_type='login')
                if g_data:
                    gamification_data = g_data
                    gamification_data["current_streak"] = profile.current_streak
                    gamification_data["points_earned_today"] = gamification_data.pop("points_earned")

            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'gamification': gamification_data,
                'is_new_user': created
            }, status=status.HTTP_200_OK)

        except ValueError:
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_401_UNAUTHORIZED)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password') or ''
        new_password = request.data.get('new_password') or ''

        if not current_password or not new_password:
            return Response({'error': 'Please provide complete information.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.has_usable_password():
            return Response(
                {'error': 'This account is logged in via Google and has no password. Please use "Forgot password" to set a new password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(current_password):
            return Response({'error': 'Incorrect current password.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class RequestPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Please enter your email.'}, status=status.HTTP_400_BAD_REQUEST)

        generic_message = {'message': 'If the email exists in our system, a verification code has been sent.'}

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(generic_message, status=status.HTTP_200_OK)

        recent_otp = PasswordResetOTP.objects.filter(user=user).order_by('-created_at').first()
        if recent_otp and (timezone.now() - recent_otp.created_at).total_seconds() < OTP_RESEND_COOLDOWN_SECONDS:
            return Response(
                {'error': f'Please wait at least {OTP_RESEND_COOLDOWN_SECONDS} seconds before resending the code.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        code = f"{random.randint(0, 999999):06d}"
        PasswordResetOTP.objects.create(
            user=user,
            code=make_password(code),
            expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )

        send_mail(
            subject='Password Reset Verification Code - Pomolendar',
            message=(
                f"Hello {user.name or ''},\n\n"
                f"Your password reset verification code is: {code}\n"
                f"This code is valid for {OTP_EXPIRY_MINUTES} minutes.\n\n"
                f"If you did not request a password reset, please ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(generic_message, status=status.HTTP_200_OK)


class ConfirmPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        code = (request.data.get('code') or '').strip()
        new_password = request.data.get('new_password') or ''

        if not email or not code or not new_password:
            return Response({'error': 'Please provide complete information.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Verification code is incorrect or expired.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        candidate_otps = PasswordResetOTP.objects.filter(user=user, is_used=False).order_by('-created_at')

        matched_otp = None
        for otp in candidate_otps:
            if otp.is_valid() and check_password(code, otp.code):
                matched_otp = otp
                break

        if not matched_otp:
            return Response({'error': 'Verification code is incorrect or expired.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        return Response({'message': 'Password reset successfully. Please log in again.'}, status=status.HTTP_200_OK)