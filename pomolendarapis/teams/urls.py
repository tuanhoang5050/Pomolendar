from django.urls import path
from .views import (
    GroupListCreateView, JoinGroupView, GroupDetailView,
    UpdateFocusStatusView, GroupLeaderboardView, DiscoverPublicGroupsView, JoinPublicGroupView
)

urlpatterns = [
    path('groups/', GroupListCreateView.as_view(), name='group-list-create'),
    path('groups/join/', JoinGroupView.as_view(), name='group-join'),
    path('groups/<int:pk>/', GroupDetailView.as_view(), name='group-detail'),
    path('groups/<int:pk>/leaderboard/', GroupLeaderboardView.as_view(), name='group-leaderboard'),
    path('focus-status/', UpdateFocusStatusView.as_view(), name='update-focus-status'),
    path('groups/discover/', DiscoverPublicGroupsView.as_view(), name='groups-discover'),
    path('groups/<int:pk>/join-public/', JoinPublicGroupView.as_view(), name='group-join-public'),
]