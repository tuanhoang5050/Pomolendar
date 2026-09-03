from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, FixedEventViewSet, CalendarViewAPI, AnalyticsViewAPI, FreestylePomodoroAPI, \
    DailyCalendarAPIView, TagViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'fixed-events', FixedEventViewSet, basename='fixedevent')
router.register(r'tags', TagViewSet, basename='tag')

urlpatterns = [
    path('', include(router.urls)),
    path('calendar-view/', CalendarViewAPI.as_view(), name='calendar-view'),
    path('analytics/', AnalyticsViewAPI.as_view(), name='analytics-view'),
    path('freestyle-pomodoro/', FreestylePomodoroAPI.as_view(), name='freestyle-pomodoro'),
    path('calendar/daily/', DailyCalendarAPIView.as_view(), name='daily-calendar'),
]