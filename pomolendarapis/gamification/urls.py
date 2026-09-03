from django.urls import path
from .views import (
    UserProfileAPIView,
    ActivityLogListView,
    StoreAPIView,
    EquipItemAPIView, GlobalLeaderboardAPIView
)

urlpatterns = [
    path('profile/', UserProfileAPIView.as_view(), name='user-profile'),
    path('activities/', ActivityLogListView.as_view(), name='activity-log'),
    path('store/', StoreAPIView.as_view(), name='store'),
    path('store/equip/', EquipItemAPIView.as_view(), name='equip-item'),
    path('leaderboard/', GlobalLeaderboardAPIView.as_view(), name='global-leaderboard'),

]