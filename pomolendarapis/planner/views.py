import datetime
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

        stats_dict = {}
        for session in sessions:
            if not session.start_time:
                continue

            local_time = timezone.localtime(session.start_time)
            date_str = local_time.strftime('%Y-%m-%d')

            if date_str not in stats_dict:
                stats_dict[date_str] = 0
            stats_dict[date_str] += session.duration_minutes

        stats_list = [
            {"date": k, "total_minutes": v}
            for k, v in sorted(stats_dict.items())
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

        start_of_day = timezone.make_aware(datetime.datetime.combine(target_date, datetime.time.min))
        end_of_day = timezone.make_aware(datetime.datetime.combine(target_date, datetime.time.max))

        fixed_events = FixedEvent.objects.filter(
            user=request.user,
            start_time__gte=start_of_day,
            start_time__lte=end_of_day,
            active=True
        )

        tasks = Task.objects.filter(
            user=request.user,
            scheduled_start_time__gte=start_of_day,
            scheduled_start_time__lte=end_of_day,
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