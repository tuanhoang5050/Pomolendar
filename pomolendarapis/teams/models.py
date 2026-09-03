import random
import string
from django.db import models
from django.conf import settings
from cloudinary.models import CloudinaryField

def generate_invite_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Group.objects.filter(invite_code=code).exists():
            return code


class Group(models.Model):
    name = models.CharField(max_length=100)
    avatar = CloudinaryField('group_avatar', blank=True, null=True)
    description = models.TextField(blank=True, default='')
    is_public = models.BooleanField(default=False)
    invite_code = models.CharField(max_length=8, unique=True, default=generate_invite_code)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_groups')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.invite_code})"


class GroupMembership(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)

    is_focusing = models.BooleanField(default=False)
    last_status_update = models.DateTimeField(null=True, blank=True)
    current_task_title = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.email} in {self.group.name}"