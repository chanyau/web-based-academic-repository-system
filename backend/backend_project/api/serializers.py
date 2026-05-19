from rest_framework import serializers
from .models import (
    User,
    Project,
    Message,
    ProjectStageSubmission,
    ProjectStageSubmissionVersion,
    ProjectDevelopmentSubmission,
    InterimEvaluation,
    ProjectReview,
    SupervisorAllocationState,
)
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def _assign_supervisor_round_robin(student: User) -> Optional[User]:
    if not student or student.role != 'student' or student.supervisor_id:
        return None

    faculty_raw = (student.faculty or '').strip()
    if not faculty_raw:
        logger.info("Student %s has no faculty; supervisor not assigned.", student.id)
        return None

    faculty_key = faculty_raw.lower()
    lecturers = User.objects.filter(role='lecturer', faculty__iexact=faculty_raw).order_by('id')
    if not lecturers.exists():
        logger.info("No lecturers found for faculty %s; supervisor not assigned.", faculty_raw)
        return None

    state, _created = SupervisorAllocationState.objects.get_or_create(faculty=faculty_key)
    last_id = state.last_assigned_lecturer_id

    next_lecturer = None
    if last_id:
        next_lecturer = lecturers.filter(id__gt=last_id).first() or lecturers.first()
    else:
        next_lecturer = lecturers.first()

    if not next_lecturer:
        return None

    student.supervisor = next_lecturer
    student.save(update_fields=['supervisor'])
    state.last_assigned_lecturer = next_lecturer
    state.save(update_fields=['last_assigned_lecturer', 'updated_at'])
    logger.info("Assigned supervisor %s to student %s.", next_lecturer.id, student.id)
    return next_lecturer

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    supervisorId = serializers.IntegerField(source='supervisor.id', read_only=True, allow_null=True)
    supervisorName = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
            'role',
            'faculty',
            'department',
            'admitted',
            'supervisorId',
            'supervisorName',
        )
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate_email(self, value):
        """Ensure email is unique"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        """Ensure username is unique and has minimum length"""
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def get_supervisorName(self, obj):
        if obj.supervisor:
            return f"{obj.supervisor.first_name} {obj.supervisor.last_name}".strip() or obj.supervisor.username
        return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    supervisor = UserSerializer(read_only=True)
    supervisor_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # Map snake_case to camelCase for frontend compatibility
    submittedAt = serializers.DateField(source='submitted_at', read_only=True)
    supervisorId = serializers.IntegerField(source='supervisor.id', read_only=True, allow_null=True)
    supervisorName = serializers.SerializerMethodField()
    ownerId = serializers.IntegerField(source='owner.id', read_only=True, allow_null=True)
    similarityScore = serializers.IntegerField(source='similarity_score', read_only=True, allow_null=True)
    fileUrl = serializers.SerializerMethodField()
    plagiarismReportUrl = serializers.SerializerMethodField()
    plagiarismReportFileUrl = serializers.SerializerMethodField()
    focusArea = serializers.CharField(source='focus_area', read_only=True, allow_blank=True)

    class Meta:
        model = Project
        fields = '__all__'
    
    def get_supervisorName(self, obj):
        if obj.supervisor:
            return f"{obj.supervisor.first_name} {obj.supervisor.last_name}".strip() or obj.supervisor.username
        return None
    
    def get_fileUrl(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def get_plagiarismReportUrl(self, obj):
        return obj.plagiarism_report_url or None

    def get_plagiarismReportFileUrl(self, obj):
        if obj.plagiarism_report_file:
            return obj.plagiarism_report_file.url
        return None

    def validate_title(self, value):
        query = Project.objects.filter(title__iexact=value.strip())
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("A project with this title already exists.")
        return value
    
    def create(self, validated_data):
        supervisor_id = validated_data.pop('supervisor_id', None)
        if supervisor_id:
            try:
                supervisor = User.objects.get(id=supervisor_id, role='lecturer')
                validated_data['supervisor'] = supervisor
            except User.DoesNotExist:
                raise serializers.ValidationError({'supervisor_id': 'Invalid supervisor selected'})
        
        # Create the project first
        project = super().create(validated_data)
        
        # Extract keywords automatically if not provided or if abstract exists
        try:
            from .nlp_utils import extract_keywords_from_project, infer_focus_area
            
            abstract = project.abstract or ""
            existing_keywords = project.keywords or ""
            
            # Get file path if file was uploaded
            file_path = None
            if project.file:
                file_path = project.file.path
            
            # Only auto-extract if keywords are not provided by user
            if not existing_keywords.strip() and abstract:
                extracted_keywords = extract_keywords_from_project(abstract, file_path, top_n=10)
                if extracted_keywords:
                    project.keywords = ", ".join(extracted_keywords)
                    project.save()
                    logger.info(f"Auto-extracted keywords for project {project.id}: {project.keywords}")

            project.focus_area = infer_focus_area(project.title, project.abstract)
            project.save(update_fields=['focus_area'])
        except Exception as e:
            logger.error(f"Error extracting keywords for project {project.id}: {e}")
            # Don't fail the project creation if keyword extraction fails
        
        return project
    
    def update(self, instance, validated_data):
        supervisor_id = validated_data.pop('supervisor_id', None)
        if supervisor_id:
            try:
                supervisor = User.objects.get(id=supervisor_id, role='lecturer')
                validated_data['supervisor'] = supervisor
            except User.DoesNotExist:
                raise serializers.ValidationError({'supervisor_id': 'Invalid supervisor selected'})
        instance = super().update(instance, validated_data)
        if 'title' in validated_data or 'abstract' in validated_data:
            try:
                from .nlp_utils import infer_focus_area
                instance.focus_area = infer_focus_area(instance.title, instance.abstract)
                instance.save(update_fields=['focus_area'])
            except Exception as e:
                logger.error(f"Error updating focus area for project {instance.id}: {e}")
        return instance

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        if user.role == 'student' and not user.supervisor_id:
            _assign_supervisor_round_robin(user)
            user.refresh_from_db(fields=['supervisor'])
        data.update({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'faculty': user.faculty,
                'department': user.department,
                'admitted': user.admitted,
                'supervisorId': user.supervisor_id,
                'supervisorName': f"{user.supervisor.first_name} {user.supervisor.last_name}".strip() if user.supervisor else None,
            }
        })
        return data


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ('id', 'project', 'sender', 'sender_name', 'content', 'created_at', 'is_read')
        read_only_fields = ('sender', 'created_at')

    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}".strip() or obj.sender.username


class ProjectStageSubmissionVersionSerializer(serializers.ModelSerializer):
    fileUrl = serializers.SerializerMethodField()

    class Meta:
        model = ProjectStageSubmissionVersion
        fields = (
            'id',
            'version',
            'submitted_file',
            'fileUrl',
            'student_note',
            'supervisor_feedback',
            'review_status',
            'submitted_at',
            'reviewed_at',
            'reviewed_by',
        )

    def get_fileUrl(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user.role in ['lecturer', 'admin']:
                if obj.stage_submission.stage == 'final_document':
                    project = obj.stage_submission.project
                    if project.status == 'plagiarism_checking' or project.workflow_status == 'plagiarism_checking':
                        return None
        return obj.submitted_file.url if obj.submitted_file else None


class ProjectStageSubmissionSerializer(serializers.ModelSerializer):
    stageLabel = serializers.SerializerMethodField()
    fileUrl = serializers.SerializerMethodField()
    reviewedByName = serializers.SerializerMethodField()
    versions = ProjectStageSubmissionVersionSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectStageSubmission
        fields = (
            'id',
            'project',
            'stage',
            'stageLabel',
            'submitted_file',
            'fileUrl',
            'student_note',
            'supervisor_feedback',
            'review_status',
            'submitted_at',
            'reviewed_at',
            'reviewed_by',
            'reviewedByName',
            'versions',
        )

    def get_stageLabel(self, obj):
        return obj.get_stage_display()

    def get_fileUrl(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user.role in ['lecturer', 'admin']:
                if obj.stage == 'final_document':
                    if obj.project.status == 'plagiarism_checking' or obj.project.workflow_status == 'plagiarism_checking':
                        return None
        return obj.submitted_file.url if obj.submitted_file else None

    def get_reviewedByName(self, obj):
        if obj.reviewed_by:
            return f"{obj.reviewed_by.first_name} {obj.reviewed_by.last_name}".strip() or obj.reviewed_by.username
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        is_locked = False

        if request and request.user.is_authenticated:
            if request.user.role in ['lecturer', 'admin']:
                if instance.stage == 'final_document':
                    if instance.project.status == 'plagiarism_checking' or instance.project.workflow_status == 'plagiarism_checking':
                        is_locked = True

        if is_locked:
            data['submitted_file'] = None
            data['fileUrl'] = None
            for version in data.get('versions') or []:
                version['submitted_file'] = None
                version['fileUrl'] = None
            data['is_locked'] = True
            data['lock_reason'] = 'Plagiarism check in progress. File access will be available once the check completes.'
        else:
            data['is_locked'] = False
            data['lock_reason'] = None

        return data


class ProjectDevelopmentSubmissionSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDevelopmentSubmission
        fields = (
            'id',
            'submission_type',
            'version',
            'file',
            'file_url',
            'comment',
            'supervisor_comment',
            'review_status',
            'submitted_at',
            'reviewed_at',
        )

    def get_file_url(self, obj):
        return obj.file.url if obj.file else None


class InterimEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterimEvaluation
        fields = (
            'id',
            'marks',
            'comments',
            'created_at',
        )


class ProjectReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectReview
        fields = (
            'id',
            'phase',
            'decision',
            'feedback',
            'reviewer_name',
            'created_at',
        )

    def get_reviewer_name(self, obj):
        return f"{obj.reviewer.first_name} {obj.reviewer.last_name}".strip() if obj.reviewer else None


class WorkflowDetailsSerializer(serializers.Serializer):
    project = ProjectSerializer()
    reviews = ProjectReviewSerializer(many=True)
    development_submissions = ProjectDevelopmentSubmissionSerializer(many=True)
    interim_evaluations = InterimEvaluationSerializer(many=True)
    stage_submissions = ProjectStageSubmissionSerializer(many=True)
