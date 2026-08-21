# gamification/services.py

from django.db.models import F
from .models import UserProfile

def add_points_and_check_levelup(user, points_earned):
    if points_earned <= 0:
        return None

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.knowledge_points = F('knowledge_points') + points_earned
    profile.save(update_fields=['knowledge_points'])
    profile.refresh_from_db()

    leveled_up = False
    if profile.knowledge_points >= 100:
        extra_books = profile.knowledge_points // 100

        profile.books_collected = F('books_collected') + extra_books
        profile.knowledge_points = profile.knowledge_points % 100

        profile.save(update_fields=['books_collected', 'knowledge_points'])
        profile.refresh_from_db()
        leveled_up = True

    return {
        "points_earned": points_earned,
        "current_points": profile.knowledge_points,
        "books_collected": profile.books_collected,
        "leveled_up": leveled_up
    }