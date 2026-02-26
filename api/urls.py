from django.urls import path
from rest_framework import routers
from .views import UserViewSet, ProjectViewSet, analytics, get_lecturers, my_conversations, extract_keywords

router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'projects', ProjectViewSet)

urlpatterns = router.urls + [
    path('analytics/', analytics, name='analytics'),
    path('lecturers/', get_lecturers, name='get_lecturers'),
    path('conversations/', my_conversations, name='my_conversations'),
    path('extract-keywords/', extract_keywords, name='extract_keywords'),
]
