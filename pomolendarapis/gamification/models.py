from django.db import models
from django.conf import settings


class StoreItem(models.Model):
    CATEGORY_CHOICES = (
        ('animation', 'Focus Animation'),
        ('sound', 'White Noise Sound'),
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    price = models.IntegerField(default=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    file_identifier = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"[{self.category}] {self.name} - {self.price} pts"


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gamification_profile')

    knowledge_points = models.IntegerField(default=0)
    books_collected = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)

    equipped_animation = models.ForeignKey(StoreItem, on_delete=models.SET_NULL, null=True, blank=True,
                                           related_name='equipped_animation_users')
    equipped_sound = models.ForeignKey(StoreItem, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='equipped_sound_users')

    def __str__(self):
        return f"{self.user.email} - Pts: {self.knowledge_points}"


class UserItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='inventory')
    item = models.ForeignKey(StoreItem, on_delete=models.CASCADE)
    purchased_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'item')

    def __str__(self):
        return f"{self.user.email} owns {self.item.name}"


class ActivityLog(models.Model):
    ACTIVITY_CHOICES = (
        ('login', 'Daily Login'),
        ('pomodoro', 'Pomodoro Session'),
        ('task_complete', 'Task Completed'),
        ('level_up', 'Level Up'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_CHOICES)
    points = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.activity_type} (+{self.points})"