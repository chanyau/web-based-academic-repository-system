from django.urls import path
from rest_framework import routers
from .views import UserViewSet, ProjectViewSet, analytics, predictive_trends, get_lecturers, my_conversations, extract_keywords, check_similarity, my_supervisees, supervisee_details, send_due_date_notification, send_supervisor_message_notification

router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'projects', ProjectViewSet)

urlpatterns = router.urls + [
    path('analytics/', analytics, name='analytics'),
    path('analytics/trends/', predictive_trends, name='predictive_trends'),
    path('lecturers/', get_lecturers, name='get_lecturers'),
    path('conversations/', my_conversations, name='my_conversations'),
    path('supervisees/', my_supervisees, name='my_supervisees'),
    path('supervisees/<int:student_id>/details/', supervisee_details, name='supervisee_details'),
    path('supervisees/due-date/', send_due_date_notification, name='send_due_date_notification'),
    path('supervisees/notify/', send_supervisor_message_notification, name='send_supervisor_message_notification'),
    path('extract-keywords/', extract_keywords, name='extract_keywords'),
    path('check-similarity/', check_similarity, name='check_similarity'),
]
