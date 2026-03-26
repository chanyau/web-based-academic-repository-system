from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, Project, Message, ProjectStageSubmission, ProjectStageSubmissionVersion, ProjectReview, ProjectDevelopmentSubmission, InterimEvaluation


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'admitted', 'is_staff', 'is_active')
    list_filter = ('role', 'admitted', 'is_staff', 'is_active')
    fieldsets = DjangoUserAdmin.fieldsets + (
        ('Repository Profile', {'fields': ('role', 'faculty', 'department', 'admitted')}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ('Repository Profile', {'fields': ('role', 'faculty', 'department', 'admitted')}),
    )


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'supervisor', 'status', 'year', 'submitted_at')
    list_filter = ('status', 'faculty', 'department', 'year', 'type')
    search_fields = ('title', 'authors', 'keywords', 'owner__username', 'supervisor__username')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('project', 'sender', 'created_at', 'is_read')
    list_filter = ('is_read', 'created_at')
    search_fields = ('content', 'project__title', 'sender__username')


@admin.register(ProjectStageSubmission)
class ProjectStageSubmissionAdmin(admin.ModelAdmin):
    list_display = ('project', 'stage', 'review_status', 'submitted_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('stage', 'review_status', 'submitted_at')
    search_fields = ('project__title', 'project__owner__username', 'supervisor_feedback', 'student_note')


@admin.register(ProjectStageSubmissionVersion)
class ProjectStageSubmissionVersionAdmin(admin.ModelAdmin):
    list_display = ('stage_submission', 'version', 'review_status', 'submitted_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('review_status', 'submitted_at')
    search_fields = ('stage_submission__project__title', 'student_note', 'supervisor_feedback')


@admin.register(ProjectReview)
class ProjectReviewAdmin(admin.ModelAdmin):
    list_display = ('project', 'phase', 'decision', 'reviewer', 'created_at')
    list_filter = ('phase', 'decision', 'created_at')
    search_fields = ('project__title', 'feedback', 'reviewer__username')


@admin.register(ProjectDevelopmentSubmission)
class ProjectDevelopmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ('project', 'submission_type', 'version', 'submitted_by', 'review_status', 'submitted_at')
    list_filter = ('submission_type', 'review_status', 'submitted_at')
    search_fields = ('project__title', 'comment', 'supervisor_comment')


@admin.register(InterimEvaluation)
class InterimEvaluationAdmin(admin.ModelAdmin):
    list_display = ('project', 'marks', 'evaluator', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('project__title', 'comments', 'evaluator__username')
