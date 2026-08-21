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