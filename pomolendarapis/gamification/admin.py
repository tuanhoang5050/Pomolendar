from django.contrib import admin
from .models import UserProfile, ActivityLog, StoreItem, UserItem


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'knowledge_points', 'books_collected', 'equipped_animation', 'equipped_sound')
    list_filter = ('last_active_date', 'books_collected')
    search_fields = ('user__email',)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'activity_type', 'points', 'created_at')
    list_filter = ('activity_type',)
    search_fields = ('user__email',)
    ordering = ('-created_at',)

@admin.register(StoreItem)
class StoreItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'file_identifier', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name', 'file_identifier', 'description')
    ordering = ('category', 'price')

@admin.register(UserItem)
class UserItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'item', 'purchased_at')
    list_filter = ('item__category',)
    search_fields = ('user__email', 'item__name')
    ordering = ('-purchased_at',)