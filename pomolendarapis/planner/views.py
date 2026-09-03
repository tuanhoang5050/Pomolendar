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
from .models import Task, FixedEvent, PomodoroSession, Tag
from .serializers import TaskSerializer, FixedEventSerializer, TagSerializer
from .services import generate_user_schedule
from gamification.models import UserProfile

MAX_SESSION_DURATION_MINUTES = 180


def clamp_duration(raw_duration, default=25):
    try:
        duration = int(raw_duration)
    except (TypeError, ValueError):
        return default
    return max(1, min(duration, MAX_SESSION_DURATION_MINUTES))


def validate_and_get_tags(user, tag_ids):
    if not tag_ids:
        return [], True
    valid_tags = list(Tag.objects.filter(user=user, id__in=tag_ids, active=True))
    if len(valid_tags) != len(set(tag_ids)):
        return [], False
    return valid_tags, True


class TagViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        tags = Tag.objects.filter(user=request.user, active=True)
        serializer = TagSerializer(tags, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = TagSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, pk=None):
        tag = get_object_or_404(Tag, pk=pk, user=request.user)
        serializer = TagSerializer(tag, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        tag = get_object_or_404(Tag, pk=pk, user=request.user)
        tag.active = False
        tag.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        queryset = Task.objects.filter(user=request.user).prefetch_related('tags')
        tag_ids = request.query_params.get('tags')
        if tag_ids:
            id_list = [t for t in tag_ids.split(',') if t]
            queryset = queryset.filter(tags__id__in=id_list).distinct()
        serializer = TaskSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request):
        tag_ids = request.data.get('tags', [])
        valid_tags, ok = validate_and_get_tags(request.user, tag_ids)
        if not ok:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            task = serializer.save(user=request.user)
            task.tags.set(valid_tags)
            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
        return Response(status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, pk=None):
        queryset = Task.objects.filter(user=request.user)
        task = get_object_or_404(queryset, pk=pk)
        serializer = TaskSerializer(task)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        queryset = Task.objects.filter(user=request.user)
        task = get_object_or_404(queryset, pk=pk)
        is_completed_before = task.is_completed

        tag_ids = request.data.get('tags', None)
        valid_tags = None
        if tag_ids is not None:
            valid_tags, ok = validate_and_get_tags(request.user, tag_ids)
            if not ok:
                return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = TaskSerializer(task, data=request.data, partial=True)

        if serializer.is_valid():
            task = serializer.save()
            if valid_tags is not None:
                task.tags.set(valid_tags)
            response_data = TaskSerializer(task).data

            if not is_completed_before and task.is_completed:
                gamification_data = add_points_and_check_levelup(request.user, 5)
                if gamification_data:
                    response_data['gamification'] = gamification_data

            return Response(response_data)
        return Response(status=status.HTTP_400_BAD_REQUEST)

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
        duration = clamp_duration(raw_duration, default=task.focus_duration or 25)

        task.completed_pomodoros += 1
        task.save()

        end_time = timezone.now()
        start_time = end_time - timedelta(minutes=duration)

        PomodoroSession.objects.create(
            user=request.user,
            task=task,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration
        )

        points_earned = duration * 2
        gamification_data = add_points_and_check_levelup(request.user, points_earned)

        return Response({
            "task_id": task.id,
            "completed_pomodoros": task.completed_pomodoros,
            "gamification": gamification_data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='generate-schedule')
    def generate_schedule(self, request):
        priority_strategy = request.data.get('priority_strategy', 'balanced')
        distribution = request.data.get('distribution', 'front_load')
        preferred_time = request.data.get('preferred_time', 'any')
        pacing = request.data.get('pacing', 'hustle')
        allow_split = request.data.get('allow_split', True)
        spread_daily_limit_minutes = request.data.get('spread_daily_limit_minutes')

        if priority_strategy not in ('balanced', 'deadline', 'importance'):
            priority_strategy = 'balanced'
        if distribution not in ('front_load', 'spread'):
            distribution = 'front_load'
        if preferred_time not in ('any', 'morning', 'afternoon', 'evening'):
            preferred_time = 'any'
        if pacing not in ('hustle', 'chill'):
            pacing = 'hustle'
        allow_split = bool(allow_split)
        try:
            spread_daily_limit_minutes = int(spread_daily_limit_minutes) if spread_daily_limit_minutes else 240
        except (TypeError, ValueError):
            spread_daily_limit_minutes = 240

        success, unfittable_tasks = generate_user_schedule(
            request.user,
            priority_strategy=priority_strategy,
            distribution=distribution,
            preferred_time=preferred_time,
            pacing=pacing,
            allow_split=allow_split,
            spread_daily_limit_minutes=spread_daily_limit_minutes
        )

        return Response({
            "success": success,
            "scheduled_count": None,
            "unscheduled_count": len(unfittable_tasks),
            "unscheduled_titles": [t.title for t in unfittable_tasks]
        }, status=status.HTTP_200_OK)


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
        return Response(status=status.HTTP_400_BAD_REQUEST)

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
        return Response(status=status.HTTP_400_BAD_REQUEST)

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
        tasks = Task.objects.filter(
            user=request.user, scheduled_start_time__isnull=False
        ).prefetch_related('tags')

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
                "is_completed": task.is_completed,
                "tags": TagSerializer(
                    [t for t in task.tags.all() if t.active], many=True
                ).data
            })

        return Response(calendar_data)


class AnalyticsViewAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if start_date_str and end_date_str:
            start_d = parse_date(start_date_str)
            end_d = parse_date(end_date_str)
            if not start_d or not end_d:
                return Response(status=status.HTTP_400_BAD_REQUEST)
            start_date = timezone.make_aware(datetime.datetime.combine(start_d, datetime.time.min))
            end_date = timezone.make_aware(datetime.datetime.combine(end_d, datetime.time.max))
        else:
            days = int(request.query_params.get('days', 7))
            end_date = timezone.now()
            start_date = end_date - timedelta(days=days)

        sessions = PomodoroSession.objects.filter(
            user=request.user,
            start_time__gte=start_date,
            start_time__lte=end_date
        ).select_related('task').prefetch_related('task__tags')

        stats_dict = {}
        session_count_dict = {}
        tag_minutes = {}

        for session in sessions:
            if not session.start_time:
                continue

            local_time = timezone.localtime(session.start_time)
            date_str = local_time.strftime('%Y-%m-%d')
            stats_dict[date_str] = stats_dict.get(date_str, 0) + session.duration_minutes
            session_count_dict[date_str] = session_count_dict.get(date_str, 0) + 1

            if session.task_id:
                for tag in session.task.tags.all():
                    tag_minutes[tag.id] = tag_minutes.get(tag.id, 0) + session.duration_minutes

        stats_list = [
            {
                "date": k,
                "total_minutes": v,
                "session_count": session_count_dict.get(k, 0)
            }
            for k, v in sorted(stats_dict.items())
        ]
        total_period_minutes = sum(item['total_minutes'] for item in stats_list)
        total_period_sessions = sum(item['session_count'] for item in stats_list)


        period_completed_tasks = Task.objects.filter(
            user=request.user,
            is_completed=True,
            updated_at__gte=start_date,
            updated_at__lte=end_date
        ).count()

        profile, _ = UserProfile.objects.get_or_create(user=request.user)

        tag_stats = []
        if tag_minutes:
            tags = Tag.objects.filter(id__in=tag_minutes.keys())
            for tag in tags:
                tag_tasks = Task.objects.filter(user=request.user, tags=tag)
                total_tasks = tag_tasks.count()
                tag_completed_tasks = tag_tasks.filter(is_completed=True).count()
                completion_rate = round((tag_completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0

                tag_stats.append({
                    "tag_id": tag.id,
                    "name": tag.name,
                    "color": tag.color,
                    "total_minutes": tag_minutes[tag.id],
                    "completion_rate": completion_rate
                })
            tag_stats.sort(key=lambda x: x['total_minutes'], reverse=True)

        return Response({
            "period_days": (end_date - start_date).days,
            "total_period_minutes": total_period_minutes,
            "total_period_sessions": total_period_sessions,
            "completed_tasks": period_completed_tasks,
            "current_streak": profile.current_streak,
            "books_collected": profile.books_collected,
            "knowledge_points": profile.knowledge_points,
            "daily_stats": stats_list,
            "tag_stats": tag_stats
        })


class FreestylePomodoroAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        duration = clamp_duration(request.data.get('duration_minutes', 25))

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
        ).prefetch_related('tags')

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
                "tags": TagSerializer(
                    [t for t in task.tags.all() if t.active], many=True
                ).data
            })

        events_data.sort(key=lambda x: x['start_time'] if x['start_time'] else "")

        return Response({
            "date": date_str,
            "events": events_data
        })