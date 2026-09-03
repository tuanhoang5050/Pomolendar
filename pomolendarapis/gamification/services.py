from django.db.models import F
from .models import UserProfile, ActivityLog


def add_points_and_check_levelup(user, points_earned, activity_type='pomodoro'):
    if points_earned <= 0:
        return None

    profile, _ = UserProfile.objects.get_or_create(user=user)

    old_books = profile.books_collected

    profile.knowledge_points = F('knowledge_points') + points_earned
    profile.save(update_fields=['knowledge_points'])
    profile.refresh_from_db()

    ActivityLog.objects.create(user=user, activity_type=activity_type, points=points_earned)

    leveled_up = False

    new_books = profile.knowledge_points // 1000


    if new_books > old_books:
        profile.books_collected = new_books
        profile.save(update_fields=['books_collected'])
        leveled_up = True

        for _ in range(new_books - old_books):
            ActivityLog.objects.create(user=user, activity_type='level_up', points=0)

    return {
        "points_earned": points_earned,
        "current_points": profile.knowledge_points,
        "books_collected": profile.books_collected,
        "leveled_up": leveled_up
    }