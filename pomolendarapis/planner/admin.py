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