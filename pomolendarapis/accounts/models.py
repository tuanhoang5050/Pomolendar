# accounts/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from .managers import CustomUserManager
from cloudinary.models import CloudinaryField
import uuid


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True)
    class Meta:
        abstract = True


class User(AbstractUser):
    username = None

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)
    avatar = CloudinaryField('avatar', default='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXXztlgqVSoGrWtLaV90aqRd230C_XSxPInEGm3wh3GuUmw48rfMBWvQCn&s=10')
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email