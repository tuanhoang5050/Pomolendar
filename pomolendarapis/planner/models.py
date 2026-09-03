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


class Tag(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default='#808080')

    class Meta:
        unique_together = ('user', 'name')

    def __str__(self):
        return f"{self.name} ({self.user.email})"


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
    tags = models.ManyToManyField(Tag, related_name='tasks', blank=True)

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