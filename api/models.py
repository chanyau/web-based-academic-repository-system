from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
        ('admin', 'Admin'),
        ('public', 'Public'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    faculty = models.CharField(max_length=255, blank=True, null=True)
    department = models.CharField(max_length=255, blank=True, null=True)
    admitted = models.BooleanField(default=False)  # for public users

class Project(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('under_review', 'Under Review'),
        ('revision_requested', 'Revision Requested'),
        ('approved', 'Approved'),
        ('archived', 'Archived'),
    )

    title = models.CharField(max_length=512)
    abstract = models.TextField()
    authors = models.TextField()  # comma separated
    faculty = models.CharField(max_length=255)
    department = models.CharField(max_length=255)
    year = models.IntegerField()
    type = models.CharField(max_length=64)
    keywords = models.TextField(blank=True)  # comma separated
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    supervisor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='supervised_projects')
    submitted_at = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    similarity_score = models.IntegerField(null=True, blank=True)
    file = models.FileField(upload_to='projects/', null=True, blank=True)
    views = models.IntegerField(default=0)
    downloads = models.IntegerField(default=0)

    def authors_list(self):
        return [a.strip() for a in self.authors.split(',') if a.strip()]


class Message(models.Model):
    """Chat messages between students and lecturers about a project"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.username} on {self.project.title[:30]}"
