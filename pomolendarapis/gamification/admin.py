
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