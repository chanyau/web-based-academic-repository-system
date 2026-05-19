from django.conf import settings
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
    supervisor = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='supervisees',
        limit_choices_to={'role': 'lecturer'},
    )


class SupervisorAllocationState(models.Model):
    faculty = models.CharField(max_length=255, unique=True)
    last_assigned_lecturer = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='allocation_states',
        limit_choices_to={'role': 'lecturer'},
    )
    updated_at = models.DateTimeField(auto_now=True)

class Project(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('plagiarism_checking', 'Plagiarism Checking'),
        ('plagiarism_completed', 'Plagiarism Completed'),
        ('under_review', 'Under Review'),
        ('revision_requested', 'Revision Requested'),
        ('approved', 'Approved'),
        ('archived', 'Archived'),
    )
    WORKFLOW_STATUS_CHOICES = (
        ('proposal_submitted', 'PROPOSAL_SUBMITTED'),
        ('proposal_approved', 'PROPOSAL_APPROVED'),
        ('proposal_rejected', 'PROPOSAL_REJECTED'),
        ('proposal_revision', 'PROPOSAL_REVISION'),
        ('in_progress', 'IN_PROGRESS'),
        ('interim_evaluated', 'INTERIM_EVALUATED'),
        ('final_submitted', 'FINAL_SUBMITTED'),
        ('plagiarism_checking', 'PLAGIARISM_CHECKING'),
        ('plagiarism_completed', 'PLAGIARISM_COMPLETED'),
        ('plagiarism_flagged', 'PLAGIARISM_FLAGGED'),
        ('plagiarism_passed', 'PLAGIARISM_PASSED'),
        ('approved', 'APPROVED'),
        ('final_revision', 'FINAL_REVISION'),
        ('rejected', 'REJECTED'),
        ('archived', 'ARCHIVED'),
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
    workflow_status = models.CharField(max_length=32, choices=WORKFLOW_STATUS_CHOICES, default='proposal_submitted')
    objectives = models.TextField(blank=True)
    focus_area = models.CharField(max_length=128, blank=True)
    similarity_score = models.IntegerField(null=True, blank=True)
    plagiarism_checked_at = models.DateTimeField(null=True, blank=True)
    plagiarism_report_url = models.URLField(blank=True)
    plagiarism_report_file = models.FileField(upload_to='projects/plagiarism/', null=True, blank=True)
    plagiarism_report_json = models.JSONField(null=True, blank=True)
    file = models.FileField(upload_to='projects/', null=True, blank=True)
    source_code_file = models.FileField(upload_to='projects/final/', null=True, blank=True)
    supporting_documents_file = models.FileField(upload_to='projects/final/', null=True, blank=True)
    views = models.IntegerField(default=0)
    downloads = models.IntegerField(default=0)

    def authors_list(self):
        return [a.strip() for a in self.authors.split(',') if a.strip()]

    class Meta:
        ordering = ['-submitted_at', '-id']


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


class ProjectStageSubmission(models.Model):
    STAGE_CHOICES = (
        ('proposal', 'Project Proposal'),
        ('chapter1', 'Chapter 1'),
        ('chapter2', 'Chapter 2'),
        ('chapter3', 'Chapter 3'),
        ('proposal_revision', 'Proposal Revision'),
        ('literature_review', 'Literature Review'),
        ('methodology', 'Methodology'),
        ('implementation', 'Implementation & Results'),
        ('development', 'Development / Progress'),
        ('interim_evaluation', 'Interim Evaluation'),
        ('final_submission', 'Final Submission'),
        ('final_document', 'Final Document'),
        ('plagiarism_check', 'Plagiarism Check'),
    )
    REVIEW_STATUS_CHOICES = (
        ('not_submitted', 'Not Submitted'),
        ('pending', 'Pending Review'),
        ('revision_requested', 'Revision Requested'),
        ('approved', 'Approved'),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='stage_submissions')
    stage = models.CharField(max_length=32, choices=STAGE_CHOICES)
    submitted_file = models.FileField(upload_to='projects/stages/', null=True, blank=True)
    student_note = models.TextField(blank=True)
    supervisor_feedback = models.TextField(blank=True)
    review_status = models.CharField(max_length=32, choices=REVIEW_STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_stage_submissions',
    )

    class Meta:
        ordering = ['submitted_at']
        unique_together = ('project', 'stage')


class ProjectStageSubmissionVersion(models.Model):
    REVIEW_STATUS_CHOICES = (
        ('pending', 'Pending Review'),
        ('revision_requested', 'Revision Requested'),
        ('approved', 'Approved'),
    )

    stage_submission = models.ForeignKey(ProjectStageSubmission, on_delete=models.CASCADE, related_name='versions')
    version = models.PositiveIntegerField(default=1)
    submitted_file = models.FileField(upload_to='projects/stages/versions/', null=True, blank=True)
    student_note = models.TextField(blank=True)
    supervisor_feedback = models.TextField(blank=True)
    review_status = models.CharField(max_length=32, choices=REVIEW_STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_stage_submission_versions',
    )

    class Meta:
        ordering = ['-version']
        unique_together = ('stage_submission', 'version')


class ProjectReview(models.Model):
    PHASE_CHOICES = (
        ('proposal', 'Proposal'),
        ('final', 'Final'),
    )
    DECISION_CHOICES = (
        ('approved', 'APPROVED'),
        ('rejected', 'REJECTED'),
        ('revision_required', 'REVISION_REQUIRED'),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_reviews')
    phase = models.CharField(max_length=16, choices=PHASE_CHOICES)
    decision = models.CharField(max_length=24, choices=DECISION_CHOICES)
    feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ProjectDevelopmentSubmission(models.Model):
    SUBMISSION_TYPE_CHOICES = (
        ('progress_report', 'Progress Report'),
        ('chapter', 'Chapter'),
        ('code', 'Code'),
    )
    REVIEW_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('revision_requested', 'Revision Requested'),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='development_submissions')
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='development_submissions')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_development_submissions',
    )
    submission_type = models.CharField(max_length=24, choices=SUBMISSION_TYPE_CHOICES)
    version = models.PositiveIntegerField(default=1)
    file = models.FileField(upload_to='projects/development/')
    comment = models.TextField(blank=True)
    supervisor_comment = models.TextField(blank=True)
    review_status = models.CharField(max_length=24, choices=REVIEW_STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']


class InterimEvaluation(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='interim_evaluations')
    evaluator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interim_evaluations')
    marks = models.DecimalField(max_digits=5, decimal_places=2)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
