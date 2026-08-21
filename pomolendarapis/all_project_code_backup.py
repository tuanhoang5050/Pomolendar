# ==========================================
# BẢN SAO LƯU TOÀN BỘ MÃ NGUỒN DỰ ÁN
# Thư mục gốc: F:\Pomolendar\pomolendarapis
# ==========================================


# ============================================================
# FILE: all_project_code_backup.py
# ============================================================




# ============================================================
# FILE: manage.py
# ============================================================

#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pomolendarapis.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()



# ============================================================
# FILE: pythonsource.py
# ============================================================

import os

# 1. Định nghĩa các thư mục và file muốn BỎ QUA (Tránh gom file rác, file thư viện)
EXCLUDE_DIRS = {
    '.git', '.venv', 'venv', 'env', '__pycache__',
    'migrations', '.idea', '.vscode', 'static', 'media'
}
EXCLUDE_FILES = {
    'export_project_code.py', 'package-lock.json', '.gitignore',
    'db.sqlite3', '.env'
}

# 2. Định nghĩa các định dạng file chứa code bạn muốn GOM LẠI
ALLOWED_EXTENSIONS = {'.py', '.html', '.css', '.js'}

# Tên file đầu ra sẽ chứa toàn bộ code của bạn
OUTPUT_FILE = 'all_project_code_backup.py'


def export_code():
    project_root = os.path.dirname(os.path.abspath(__file__))

    with open(os.path.join(project_root, OUTPUT_FILE), 'w', encoding='utf-8') as output:
        output.write(f'# ==========================================\n')
        output.write(f'# BẢN SAO LƯU TOÀN BỘ MÃ NGUỒN DỰ ÁN\n')
        output.write(f'# Thư mục gốc: {project_root}\n')
        output.write(f'# ==========================================\n\n')

        # Duyệt qua toàn bộ cây thư mục trong dự án
        for root, dirs, files in os.walk(project_root):
            # Loại bỏ các thư mục ẩn hoặc thư mục rác khỏi danh sách duyệt
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]

            for file in files:
                if file in EXCLUDE_FILES or file.startswith('.'):
                    continue

                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, project_root)
                _, ext = os.path.splitext(file.lower())

                # Chỉ xử lý các file có đuôi mở rộng nằm trong danh sách cho phép
                if ext in ALLOWED_EXTENSIONS:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        # Viết tiêu đề đánh dấu tên file để dễ đọc
                        output.write(f'\n# {"=" * 60}\n')
                        output.write(f'# FILE: {relative_path}\n')
                        output.write(f'# {"=" * 60}\n\n')

                        output.write(content)
                        output.write('\n\n')
                        print(f'✅ Đã gom code file: {relative_path}')

                    except Exception as e:
                        print(f'❌ Không thể đọc file {relative_path}: {e}')

    print(f'\n🎉 HOÀN THÀNH! Toàn bộ code đã được lưu vào file: {OUTPUT_FILE}')


if __name__ == '__main__':
    export_code()



# ============================================================
# FILE: accounts\admin.py
# ============================================================

from django.contrib import admin

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'name', 'is_staff', 'is_active')
    search_fields = ('email', 'name')

    ordering = ('email',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Thông tin cá nhân', {'fields': ('name',)}),
        ('Quyền hạn', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Ngày tháng', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password', 'name'),
        }),
    )

admin.site.register(User, CustomUserAdmin)



# ============================================================
# FILE: accounts\apps.py
# ============================================================

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'



# ============================================================
# FILE: accounts\managers.py
# ============================================================

# accounts/managers.py

from django.contrib.auth.base_user import BaseUserManager

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email là bắt buộc')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


# ============================================================
# FILE: accounts\models.py
# ============================================================

# accounts/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from .managers import CustomUserManager
from cloudinary.models import CloudinaryField
import uuid


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True)
    class Meta:
        abstract = True


class User(AbstractUser):
    username = None

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)
    avatar = CloudinaryField('avatar', default='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXXztlgqVSoGrWtLaV90aqRd230C_XSxPInEGm3wh3GuUmw48rfMBWvQCn&s=10')
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email


# ============================================================
# FILE: accounts\serializers.py
# ============================================================

# accounts/serializers.py

from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'password','avatar')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            name=validated_data.get('name', '')
        )
        return user


# ============================================================
# FILE: accounts\tests.py
# ============================================================

from django.test import TestCase

# Create your tests here.



# ============================================================
# FILE: accounts\urls.py
# ============================================================

# accounts/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UserViewSet, CustomTokenObtainPairView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),

    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
]


# ============================================================
# FILE: accounts\views.py
# ============================================================

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


# ============================================================
# FILE: accounts\__init__.py
# ============================================================




# ============================================================
# FILE: gamification\admin.py
# ============================================================


# Register your models here.
# gamification/admin.py
from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'knowledge_points', 'books_collected', 'current_streak', 'last_active_date')
    list_filter = ('last_active_date', 'books_collected')
    search_fields = ('user__email',)

    ordering = ('-books_collected', '-knowledge_points')


# ============================================================
# FILE: gamification\apps.py
# ============================================================

# gamification/apps.py
from django.apps import AppConfig

class GamificationConfig(AppConfig):
    name = 'gamification'

    def ready(self):
        import gamification.signals


# ============================================================
# FILE: gamification\models.py
# ============================================================

# gamification/models.py
from django.db import models
from django.contrib.auth.models import User

from pomolendarapis import settings


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gamification_profile')

    knowledge_points = models.IntegerField(default=0)
    books_collected = models.IntegerField(default=0)

    current_streak = models.IntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Profile of {self.user.email} - Books: {self.books_collected}"


# ============================================================
# FILE: gamification\serializers.py
# ============================================================

# gamification/serializers.py
from rest_framework import serializers
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['knowledge_points', 'books_collected', 'current_streak', 'last_active_date']
        read_only_fields = fields


# ============================================================
# FILE: gamification\services.py
# ============================================================

# gamification/services.py

from django.db.models import F
from .models import UserProfile

def add_points_and_check_levelup(user, points_earned):
    if points_earned <= 0:
        return None

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.knowledge_points = F('knowledge_points') + points_earned
    profile.save(update_fields=['knowledge_points'])
    profile.refresh_from_db()

    leveled_up = False
    if profile.knowledge_points >= 100:
        extra_books = profile.knowledge_points // 100

        profile.books_collected = F('books_collected') + extra_books
        profile.knowledge_points = profile.knowledge_points % 100

        profile.save(update_fields=['books_collected', 'knowledge_points'])
        profile.refresh_from_db()
        leveled_up = True

    return {
        "points_earned": points_earned,
        "current_points": profile.knowledge_points,
        "books_collected": profile.books_collected,
        "leveled_up": leveled_up
    }


# ============================================================
# FILE: gamification\signals.py
# ============================================================

# gamification/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import UserProfile

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'gamification_profile'):
        instance.gamification_profile.save()


# ============================================================
# FILE: gamification\tests.py
# ============================================================

from django.test import TestCase

# Create your tests here.



# ============================================================
# FILE: gamification\urls.py
# ============================================================

# gamification/urls.py
from django.urls import path
from .views import UserProfileAPIView

urlpatterns = [
    path('profile/', UserProfileAPIView.as_view(), name='user-profile'),
]


# ============================================================
# FILE: gamification\views.py
# ============================================================

# gamification/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import UserProfile
from .serializers import UserProfileSerializer


class UserProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)

        return Response(serializer.data)


# ============================================================
# FILE: gamification\__init__.py
# ============================================================




# ============================================================
# FILE: planner\admin.py
# ============================================================

# planner/admin.py

from django.contrib import admin
from .models import Task, FixedEvent, PomodoroSession


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'priority', 'deadline', 'estimated_pomodoros', 'is_completed')
    list_filter = ('is_completed', 'priority', 'user')
    search_fields = ('title', 'description')

@admin.register(FixedEvent)
class FixedEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'start_time', 'end_time')
    list_filter = ('user',)
    search_fields = ('title',)

@admin.register(PomodoroSession)
class PomodoroSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'task', 'duration_minutes', 'start_time', 'end_time')
    list_filter = ('user', 'start_time')
    search_fields = ('user__email', 'task__title')
    readonly_fields = ('start_time', 'end_time')


# ============================================================
# FILE: planner\apps.py
# ============================================================

from django.apps import AppConfig


class PlannerConfig(AppConfig):
    name = 'planner'



# ============================================================
# FILE: planner\models.py
# ============================================================

# planner/models.py

from django.db import models
from django.conf import settings


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True)

    class Meta:
        abstract = True


class FixedEvent(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='fixed_events')
    title = models.CharField(max_length=255)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.title} ({self.user.email})"


class Task(BaseModel):
    PRIORITY_CHOICES = (
        (1, 'Low'),
        (2, 'Medium'),
        (3, 'High'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)
    completed_pomodoros = models.IntegerField(default=0)
    deadline = models.DateTimeField(null=True, blank=True)
    reminder = models.DateTimeField(null=True, blank=True)
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=2)
    description = models.TextField(blank=True, null=True)
    estimated_pomodoros = models.PositiveIntegerField(default=1)
    focus_duration = models.IntegerField(default=25)
    short_break = models.IntegerField(default=5)

    scheduled_start_time = models.DateTimeField(null=True, blank=True)
    scheduled_end_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title


class PomodoroSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pomodoro_sessions')
    task = models.ForeignKey('Task', on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration_minutes = models.IntegerField(default=25)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        task_title = self.task.title if self.task else "Deleted Task"
        return f"{self.user.email} - {task_title} ({self.duration_minutes} mins)"


# ============================================================
# FILE: planner\serializers.py
# ============================================================

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


# ============================================================
# FILE: planner\services.py
# ============================================================

import queue
from datetime import timedelta
from django.utils import timezone
from .models import Task, FixedEvent


def calculate_task_score(task):
    """
    Chấm điểm Heuristic để xếp hạng Task. Điểm càng cao, càng được ưu tiên xếp lịch trước.
    """
    score = 0

    # 1. Trọng số theo Độ ưu tiên (Priority)
    # Giả sử priority lưu dưới dạng số (1, 2, 3...). Tùy vào quy ước của bạn mà mức độ nhân điểm sẽ khác.
    # Nếu số càng to = càng quan trọng (VD: Priority 3 quan trọng hơn 1):
    score += (task.priority * 100)
    # (Lưu ý: Nếu quy ước của bạn là 1 = High, 3 = Low, hãy đổi lại thành: (5 - task.priority) * 100)

    # 2. Trọng số theo Sự cấp bách (Deadline)
    if task.deadline:
        now = timezone.now()
        time_left = task.deadline - now
        hours_left = time_left.total_seconds() / 3600

        if hours_left <= 0:
            # Quá hạn -> Báo động đỏ, điểm cực cao để ép phải làm ngay
            score += 10000
        elif hours_left < 24:
            # Còn dưới 24h -> Rất gấp
            score += 2000
        else:
            # Càng gần deadline điểm càng cao (công thức tỷ lệ nghịch)
            score += (1000 / hours_left)

    # 3. Trọng số theo Kích thước (Tùy chọn bổ sung)
    # Ví dụ: Ưu tiên làm các Task ngắn, giải quyết nhanh (Shortest Job First)
    # score -= (task.estimated_pomodoros * 5)

    return score

def get_free_time_slots(user, start_time, end_time):
    """
    Quét lịch trình trong khoảng [start_time, end_time] và trả về các khoảng thời gian trống.
    Returns: List các dictionary [{'start': datetime, 'end': datetime}, ...]
    """
    busy_blocks = []

    # 1. Thu thập các sự kiện cố định (FixedEvent như đi học, đi làm, họp...)
    # Giả định model FixedEvent của bạn có trường start_time và end_time
    fixed_events = FixedEvent.objects.filter(
        user=user,
        end_time__gt=start_time,
        start_time__lt=end_time
    )
    for event in fixed_events:
        busy_blocks.append((event.start_time, event.end_time))

    # 2. Thu thập các Task đã được lên lịch thành công từ trước
    scheduled_tasks = Task.objects.filter(
        user=user,
        scheduled_start_time__isnull=False,
        scheduled_end_time__isnull=False,
        scheduled_end_time__gt=start_time,
        scheduled_start_time__lt=end_time
    )
    for t in scheduled_tasks:
        busy_blocks.append((t.scheduled_start_time, t.scheduled_end_time))

    # Nếu không có lịch bận nào, toàn bộ khoảng thời gian là trống
    if not busy_blocks:
        return [{'start': start_time, 'end': end_time}]

    # 3. Sắp xếp các lịch bận theo thời gian bắt đầu
    busy_blocks.sort(key=lambda x: x[0])

    # 4. Thuật toán Hợp nhất (Merge Intervals) các khoảng thời gian bận bị trùng nhau
    merged_busy = []
    for block in busy_blocks:
        if not merged_busy:
            merged_busy.append(block)
        else:
            last_block = merged_busy[-1]
            if block[0] <= last_block[1]: # Bị đè/trùng lấp lịch
                # Cập nhật lại thời gian kết thúc của block trước đó
                merged_busy[-1] = (last_block[0], max(last_block[1], block[1]))
            else:
                merged_busy.append(block)

    free_slots = []
    current_time = start_time

    for busy_start, busy_end in merged_busy:
        if current_time < busy_start:
            free_slots.append({
                'start': current_time,
                'end': busy_start
            })
        current_time = max(current_time, busy_end)

    if current_time < end_time:
        free_slots.append({
            'start': current_time,
            'end': end_time
        })

    return free_slots

def generate_user_schedule(user):
    """
    Thuật toán Heuristic + Fractional Bin Packing phân bổ thời gian cho Task.
    """
    # FIX 3.1: Chỉ lấy các task CHƯA có lịch (tránh lặp vô tận)
    pending_tasks = Task.objects.filter(
        user=user,
        is_completed=False,
        scheduled_start_time__isnull=True
    )

    if not pending_tasks.exists():
        return False

    # 1. Chấm điểm Heuristic và sắp xếp
    task_scores = [{'task': t, 'score': calculate_task_score(t)} for t in pending_tasks]
    sorted_tasks = sorted(task_scores, key=lambda x: x['score'], reverse=True)

    # 2. Lấy khoảng trống 7 ngày tới
    now = timezone.now()
    schedule_end = now + timedelta(days=7)
    free_slots = get_free_time_slots(user, now, schedule_end)

    # Định nghĩa các ngưỡng giới hạn (Threshold) cho Priority 1 & 2
    MIN_BREAK = 3  # Tối thiểu 3 phút nghỉ
    MIN_FOCUS = 15  # Tối thiểu 15 phút tập trung

    # 3. Phân bổ (Fractional Bin Packing)
    for item in sorted_tasks:
        task = item['task']
        pomo_count = task.estimated_pomodoros
        focus = task.focus_duration
        break_time = task.short_break

        for slot in free_slots:
            slot_duration_td = slot['end'] - slot['start']
            slot_duration_mins = slot_duration_td.total_seconds() / 60

            # Tổng thời gian lý tưởng
            total_mins = pomo_count * (focus + break_time)

            # Trường hợp 1: Khoảng trống rộng rãi, nhét vừa hoàn hảo
            if slot_duration_mins >= total_mins:
                task.scheduled_start_time = slot['start']
                task.scheduled_end_time = slot['start'] + timedelta(minutes=total_mins)
                task.save()

                slot['start'] = task.scheduled_end_time  # Cắt bỏ phần đã dùng
                break

                # Trường hợp 2: Khoảng trống hẹp, bắt đầu ép ưu tiên
            else:
                # Ưu tiên 1: Ép thời gian nghỉ (Break)
                reduced_break_mins = pomo_count * (focus + MIN_BREAK)
                if slot_duration_mins >= reduced_break_mins:
                    task.short_break = MIN_BREAK  # Bóp méo dữ liệu nghỉ
                    task.scheduled_start_time = slot['start']
                    task.scheduled_end_time = slot['start'] + timedelta(minutes=reduced_break_mins)
                    task.save()
                    slot['start'] = task.scheduled_end_time
                    break

                # Ưu tiên 2: Ép cả thời gian Focus và Break
                reduced_all_mins = pomo_count * (MIN_FOCUS + MIN_BREAK)
                if slot_duration_mins >= reduced_all_mins:
                    task.focus_duration = MIN_FOCUS
                    task.short_break = MIN_BREAK
                    task.scheduled_start_time = slot['start']
                    task.scheduled_end_time = slot['start'] + timedelta(minutes=reduced_all_mins)
                    task.save()
                    slot['start'] = task.scheduled_end_time
                    break

                # Ưu tiên 3: Chia cắt Task (Fractional)
                # Tính toán xem khoảng trống này có thể chứa trọn vẹn bao nhiêu phiên Pomodoro gốc
                mins_per_session = focus + break_time
                fit_pomos = int(slot_duration_mins // mins_per_session)

                if fit_pomos > 0:
                    # Cập nhật Task gốc thành "Phần 1" vừa vặn với khoảng trống
                    task.estimated_pomodoros = fit_pomos
                    task.scheduled_start_time = slot['start']
                    task.scheduled_end_time = slot['start'] + timedelta(minutes=(fit_pomos * mins_per_session))
                    original_title = task.title
                    task.title = f"{original_title} (Phần 1)"
                    task.save()
                    slot['start'] = task.scheduled_end_time

                    # Tự động sinh ra Sub-task "Phần 2" chứa số Pomodoro bị dư
                    remaining_pomos = pomo_count - fit_pomos
                    sub_task = Task.objects.create(
                        user=task.user,
                        title=f"{original_title} (Phần 2)",
                        priority=task.priority,
                        deadline=task.deadline,
                        reminder=task.reminder,
                        estimated_pomodoros=remaining_pomos,
                        focus_duration=focus,
                        short_break=break_time
                    )

                    # Ném Sub-task này ngược lại mảng để thuật toán tiếp tục tìm chỗ trống cho nó
                    queue.append({'task': sub_task, 'score': item['score']})  # An toàn                    break
                else:
                    # Ưu tiên 4 (Ngoại lệ): Khoảng trống quá bé (< 1 phiên Pomodoro min), bỏ qua để duyệt slot kế tiếp
                    continue

    return True


# ============================================================
# FILE: planner\tests.py
# ============================================================

from django.test import TestCase

# Create your tests here.



# ============================================================
# FILE: planner\urls.py
# ============================================================

# planner/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, FixedEventViewSet, CalendarViewAPI, AnalyticsViewAPI, FreestylePomodoroAPI, \
    DailyCalendarAPIView

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'fixed-events', FixedEventViewSet, basename='fixedevent')

urlpatterns = [
    path('', include(router.urls)),
    path('calendar-view/', CalendarViewAPI.as_view(), name='calendar-view'),
    path('analytics/', AnalyticsViewAPI.as_view(), name='analytics-view'),
    path('freestyle-pomodoro/', FreestylePomodoroAPI.as_view(), name='freestyle-pomodoro'),
    path('calendar/daily/', DailyCalendarAPIView.as_view(), name='daily-calendar'),
]


# ============================================================
# FILE: planner\views.py
# ============================================================

from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.dateparse import parse_date

from gamification.services import add_points_and_check_levelup
from .models import Task, FixedEvent, PomodoroSession
from .serializers import TaskSerializer, FixedEventSerializer
from .services import generate_user_schedule
from gamification.models import UserProfile


class TaskViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        queryset = Task.objects.filter(user=request.user)
        serializer = TaskSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, pk=None):
        queryset = Task.objects.filter(user=request.user)
        task = get_object_or_404(queryset, pk=pk)
        serializer = TaskSerializer(task)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        queryset = Task.objects.filter(user=request.user)
        task = get_object_or_404(queryset, pk=pk)
        is_completed_before = task.is_completed
        serializer = TaskSerializer(task, data=request.data, partial=True)

        if serializer.is_valid():
            task = serializer.save()
            response_data = serializer.data

            if not is_completed_before and task.is_completed:
                gamification_data = add_points_and_check_levelup(request.user, 5)
                if gamification_data:
                    response_data['gamification'] = gamification_data

            return Response(response_data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        queryset = Task.objects.filter(user=request.user)
        task = get_object_or_404(queryset, pk=pk)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='complete-pomodoro')
    def complete_pomodoro(self, request, pk=None):
        queryset = Task.objects.filter(user=request.user)
        task = get_object_or_404(queryset, pk=pk)

        raw_duration = request.data.get('duration_minutes', task.focus_duration)
        try:
            duration = int(raw_duration)
        except ValueError:
            return Response({"error": "Invalid duration_minutes"}, status=status.HTTP_400_BAD_REQUEST)

        task.completed_pomodoros += 1
        task.save()

        end_time = timezone.now()
        start_time = end_time - timedelta(minutes=int(duration))

        PomodoroSession.objects.create(
            user=request.user,
            task=task,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=int(duration)
        )

        points_earned = int(duration) * 2
        gamification_data = add_points_and_check_levelup(request.user, points_earned)

        return Response({
            "task_id": task.id,
            "completed_pomodoros": task.completed_pomodoros,
            "gamification": gamification_data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='generate-schedule')
    def generate_schedule(self, request):
        success = generate_user_schedule(request.user)
        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_400_BAD_REQUEST)


class FixedEventViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        queryset = FixedEvent.objects.filter(user=request.user)
        serializer = FixedEventSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = FixedEventSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, pk=None):
        queryset = FixedEvent.objects.filter(user=request.user)
        event = get_object_or_404(queryset, pk=pk)
        serializer = FixedEventSerializer(event)
        return Response(serializer.data)

    def update(self, request, pk=None):
        queryset = FixedEvent.objects.filter(user=request.user)
        event = get_object_or_404(queryset, pk=pk)
        serializer = FixedEventSerializer(event, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        queryset = FixedEvent.objects.filter(user=request.user, active=True)
        event = get_object_or_404(queryset, pk=pk)
        event.active = False
        event.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarViewAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        events = FixedEvent.objects.filter(user=request.user)
        tasks = Task.objects.filter(user=request.user, scheduled_start_time__isnull=False)

        calendar_data = []

        for event in events:
            calendar_data.append({
                "id": f"event_{event.id}",
                "real_id": event.id,
                "item_type": "fixed_event",
                "title": event.title,
                "start": event.start_time,
                "end": event.end_time,
                "color": "#FF5733"
            })

        for task in tasks:
            calendar_data.append({
                "id": f"task_{task.id}",
                "real_id": task.id,
                "item_type": "task",
                "title": task.title,
                "start": task.scheduled_start_time,
                "end": task.scheduled_end_time,
                "color": "#33C1FF" if not task.is_completed else "#28A745",
                "is_completed": task.is_completed
            })

        return Response(calendar_data)


class AnalyticsViewAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get('days', 7))

        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)

        sessions = PomodoroSession.objects.filter(
            user=request.user,
            start_time__gte=start_date,
            start_time__lte=end_date
        )

        daily_stats = sessions.annotate(
            date=TruncDate('start_time')
        ).values('date').annotate(
            total_minutes=Sum('duration_minutes')
        ).order_by('date')

        stats_list = [
            {
                "date": item['date'].strftime('%Y-%m-%d'),
                "total_minutes": item['total_minutes']
            }
            for item in daily_stats
        ]

        total_period_minutes = sum(item['total_minutes'] for item in stats_list)

        return Response({
            "period_days": days,
            "total_period_minutes": total_period_minutes,
            "daily_stats": stats_list
        })


class FreestylePomodoroAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        duration = request.data.get('duration_minutes', 25)

        try:
            duration = int(duration)
        except ValueError:
            return Response({"error": "Invalid duration"}, status=status.HTTP_400_BAD_REQUEST)

        end_time = timezone.now()
        start_time = end_time - timedelta(minutes=duration)

        PomodoroSession.objects.create(
            user=request.user,
            task=None,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration
        )

        points_earned = duration * 2
        gamification_data = add_points_and_check_levelup(request.user, points_earned)

        return Response({
            "is_freestyle": True,
            "gamification": gamification_data
        }, status=status.HTTP_200_OK)


class DailyCalendarAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        target_date = parse_date(date_str)
        if not target_date:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        fixed_events = FixedEvent.objects.filter(
            user=request.user,
            start_time__date=target_date,
            active=True
        )

        tasks = Task.objects.filter(
            user=request.user,
            scheduled_start_time__date=target_date,
            active=True
        )

        events_data = []

        for event in fixed_events:
            events_data.append({
                "id": f"fixed_{event.id}",
                "type": "fixed_event",
                "title": event.title,
                "location": getattr(event, 'location', ''),
                "start_time": event.start_time.isoformat() if event.start_time else None,
                "end_time": event.end_time.isoformat() if event.end_time else None,
            })

        for task in tasks:
            events_data.append({
                "id": f"task_{task.id}",
                "task_id": task.id,
                "type": "task",
                "title": task.title,
                "description": getattr(task, 'description', ''),
                "start_time": task.scheduled_start_time.isoformat() if task.scheduled_start_time else None,
                "end_time": task.scheduled_end_time.isoformat() if task.scheduled_end_time else None,
                "is_completed": task.is_completed,
                "priority": task.priority,
                "estimated_pomodoros": task.estimated_pomodoros,
            })

        events_data.sort(key=lambda x: x['start_time'] if x['start_time'] else "")

        return Response({
            "date": date_str,
            "events": events_data
        })


# ============================================================
# FILE: planner\__init__.py
# ============================================================




# ============================================================
# FILE: pomodoro\admin.py
# ============================================================

from django.contrib import admin

# Register your models here.



# ============================================================
# FILE: pomodoro\apps.py
# ============================================================

from django.apps import AppConfig


class PomodoroConfig(AppConfig):
    name = 'pomodoro'



# ============================================================
# FILE: pomodoro\models.py
# ============================================================

from django.db import models

# Create your models here.



# ============================================================
# FILE: pomodoro\tests.py
# ============================================================

from django.test import TestCase

# Create your tests here.



# ============================================================
# FILE: pomodoro\views.py
# ============================================================

from django.shortcuts import render

# Create your views here.



# ============================================================
# FILE: pomodoro\__init__.py
# ============================================================




# ============================================================
# FILE: pomolendarapis\asgi.py
# ============================================================

"""
ASGI config for pomolendarapis project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pomolendarapis.settings')

application = get_asgi_application()



# ============================================================
# FILE: pomolendarapis\settings.py
# ============================================================

"""
Django settings for pomolendarapis project.

Generated by 'django-admin startproject' using Django 6.0.7.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/6.0/ref/settings/
"""
import os
from pathlib import Path
from dotenv import load_dotenv

import cloudinary
from django.conf.global_settings import AUTH_USER_MODEL

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
load_dotenv(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = os.environ.get('SECRET_KEY')
DEBUG = os.environ.get('DEBUG') == 'True'
# SECURITY WARNING: don't run with debug turned on in production!

ALLOWED_HOSTS = ['*']


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'accounts.apps.AccountsConfig',
    'planner.apps.PlannerConfig',
    'pomodoro.apps.PomodoroConfig',
    'gamification.apps.GamificationConfig',
    'rest_framework',
    'rest_framework.authtoken',
    'cloudinary',
    'drf_yasg',
    'corsheaders',
]

cloudinary.config(
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key = os.environ.get('CLOUDINARY_API_KEY'),
    api_secret = os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True
)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}

import pymysql
pymysql.install_as_MySQLdb()


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'pomolendarapis.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'pomolendarapis.wsgi.application'

# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
    'NAME': os.environ.get('DB_NAME'),
    'USER': os.environ.get('DB_USER'),
    'PASSWORD': os.environ.get('DB_PASSWORD'),
    'HOST': os.environ.get('DB_HOST'),
    }
}

AUTH_USER_MODEL = 'accounts.User'

# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Ho_Chi_Minh'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'



# ============================================================
# FILE: pomolendarapis\urls.py
# ============================================================

"""
URL configuration for pomolendarapis project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path

# pomolendarapis/urls.py

from django.contrib import admin
from django.urls import path, include

from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="Pomolendar API",
        default_version='v1',
        description="APIs for Pomolendar",
        contact=openapi.Contact(email="tuanhoang5050@gmail.com"),
        license=openapi.License(name="Hoàng Việt Tuấn@2026"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/planner/', include('planner.urls')),
    path('api/gamification/', include('gamification.urls')),
    re_path(r'^swagger(?P<format>\.json|\.yaml)$',
            schema_view.without_ui(cache_timeout=0),
            name='schema-json'),
    re_path(r'^swagger/$',
            schema_view.with_ui('swagger', cache_timeout=0),
            name='schema-swagger-ui'),
    re_path(r'^redoc/$',
            schema_view.with_ui('redoc', cache_timeout=0),
            name='schema-redoc')
]



# ============================================================
# FILE: pomolendarapis\wsgi.py
# ============================================================

"""
WSGI config for pomolendarapis project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pomolendarapis.settings')

application = get_wsgi_application()



# ============================================================
# FILE: pomolendarapis\__init__.py
# ============================================================



