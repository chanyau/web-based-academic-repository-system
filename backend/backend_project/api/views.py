import math
from datetime import datetime, date
from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Q, Count
from .models import (
    Project,
    Message,
    ProjectStageSubmission,
    ProjectStageSubmissionVersion,
    ProjectDevelopmentSubmission,
    InterimEvaluation,
)
from .serializers import (
    UserSerializer,
    ProjectSerializer,
    CustomTokenObtainPairSerializer,
    _assign_supervisor_round_robin,
    MessageSerializer,
    ProjectStageSubmissionSerializer,
    ProjectDevelopmentSubmissionSerializer,
    InterimEvaluationSerializer,
    ProjectReviewSerializer,
    WorkflowDetailsSerializer,
)
from rest_framework_simplejwt.views import TokenObtainPairView
import os
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.utils import timezone
import logging
import threading
import base64
import json
import mimetypes
import uuid
from django.core.files.base import ContentFile
from django.db import close_old_connections
from urllib import request as urllib_request, error as urllib_error
from .email_utils import (
    notify_project_submission,
    notify_project_approved,
    notify_project_rejected,
    notify_new_message,
    notify_project_under_review,
    notify_admin_project_ready_for_review,
    notify_supervisor_plagiarism_report,
    notify_stage_due_date,
    notify_supervisor_message
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _encode_multipart_formdata(fields, files):
    boundary = uuid.uuid4().hex
    body = bytearray()

    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(str(value).encode())
        body.extend(b"\r\n")

    for name, filename, content_type, content in files:
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode())
        body.extend(content)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode())
    content_type = f"multipart/form-data; boundary={boundary}"
    return bytes(body), content_type


def _call_plagiarism_api(file_bytes, filename):
    api_url = (os.getenv('PLAGIARISM_API_URL', '') or os.getenv('WINSTON_AI_API_URL', '')).strip()
    api_key = (os.getenv('PLAGIARISM_API_KEY', '') or os.getenv('WINSTON_AI_API_KEY', '')).strip()
    file_field = (os.getenv('PLAGIARISM_API_FILE_FIELD', '') or 'file').strip() or 'file'

    if not api_url:
        raise ValueError('PLAGIARISM_API_URL is not configured')

    content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    body, multipart_type = _encode_multipart_formdata(
        fields={},
        files=[(file_field, filename, content_type, file_bytes)],
    )

    headers = {
        'Content-Type': multipart_type,
        'Accept': 'application/json',
    }
    if api_key:
        headers['Authorization'] = f"Bearer {api_key}"

    req = urllib_request.Request(api_url, data=body, headers=headers, method='POST')

    try:
        with urllib_request.urlopen(req, timeout=120) as response:
            payload = response.read().decode('utf-8')
            return json.loads(payload)
    except urllib_error.HTTPError as http_err:
        try:
            error_payload = http_err.read().decode('utf-8')
        except Exception:
            error_payload = 'No error body returned.'
        raise ValueError(f"Plagiarism API error: {http_err.code}. Body: {error_payload}")
    except urllib_error.URLError as url_err:
        raise ValueError(f"Plagiarism API unreachable: {url_err.reason}")


def _run_plagiarism_check(project_id, stage_submission_id, file_path, filename):
    close_old_connections()
    try:
        project = Project.objects.get(id=project_id)
        stage_submission = ProjectStageSubmission.objects.get(id=stage_submission_id)

        with open(file_path, 'rb') as handle:
            file_bytes = handle.read()

        api_result = _call_plagiarism_api(file_bytes, filename)
        similarity, report_url, report_json, report_pdf_base64 = _extract_plagiarism_result(api_result)

        if similarity is not None:
            try:
                project.similarity_score = int(round(float(similarity)))
            except (TypeError, ValueError):
                project.similarity_score = None

        project.plagiarism_report_url = report_url or ''
        project.plagiarism_report_json = report_json
        project.plagiarism_checked_at = timezone.now()

        report_content = None
        if report_pdf_base64:
            try:
                report_content = base64.b64decode(report_pdf_base64)
            except Exception:
                report_content = None
        if not report_content and report_url:
            report_content = _fetch_report_file(report_url)
        if report_content:
            _attach_report_file(project, report_content, 'plagiarism_report.pdf')

        project.status = 'plagiarism_completed'
        project.workflow_status = 'plagiarism_completed'
        if similarity is not None:
            try:
                if float(similarity) >= 30:
                    project.workflow_status = 'plagiarism_flagged'
                else:
                    project.workflow_status = 'plagiarism_passed'
            except (TypeError, ValueError):
                project.workflow_status = 'plagiarism_completed'

        project.save()

        report_attachment = None
        if report_content:
            report_attachment = {
                'filename': 'plagiarism_report.pdf',
                'content': report_content,
                'mime_type': 'application/pdf',
            }
        elif project.plagiarism_report_file:
            try:
                project.plagiarism_report_file.open('rb')
                saved_report = project.plagiarism_report_file.read()
                project.plagiarism_report_file.close()
                report_attachment = {
                    'filename': project.plagiarism_report_file.name.split('/')[-1] or 'plagiarism_report.pdf',
                    'content': saved_report,
                    'mime_type': 'application/pdf',
                }
            except Exception:
                report_attachment = None

        final_doc_attachment = None
        if file_bytes:
            final_doc_attachment = {
                'filename': filename.split('/')[-1],
                'content': file_bytes,
                'mime_type': mimetypes.guess_type(filename)[0] or 'application/octet-stream',
            }

        notify_supervisor_plagiarism_report(
            project,
            similarity_score=project.similarity_score,
            report_attachment=report_attachment,
            final_doc_attachment=final_doc_attachment,
        )
    except Exception as exc:
        logger.error(f"Plagiarism check failed for project {project_id}: {exc}")
        try:
            project = Project.objects.get(id=project_id)
            project.plagiarism_checked_at = timezone.now()
            project.status = 'plagiarism_checking'
            project.workflow_status = 'plagiarism_checking'
            project.save(update_fields=['plagiarism_checked_at', 'status', 'workflow_status'])
        except Exception:
            logger.error("Failed to update project after plagiarism failure.")


def _extract_plagiarism_result(api_result):
    similarity = api_result.get('similarity_score')
    if similarity is None:
        similarity = api_result.get('similarity_percentage')
    report_url = api_result.get('report_url') or api_result.get('report_link')
    report_json = api_result.get('report_json') or api_result.get('report') or api_result
    report_pdf_base64 = api_result.get('report_pdf_base64') or api_result.get('report_file_base64')

    return similarity, report_url, report_json, report_pdf_base64


def _attach_report_file(project, report_content, filename):
    if not report_content:
        return

    project.plagiarism_report_file.save(filename, ContentFile(report_content), save=False)


def _fetch_report_file(report_url):
    if not report_url:
        return None

    try:
        with urllib_request.urlopen(report_url, timeout=60) as response:
            return response.read()
    except Exception:
        return None

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'

class IsLecturerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['lecturer', 'admin']

class IsStudentOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['student', 'admin']

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.AllowAny()]
        return [IsAdmin()]

    @action(detail=True, methods=['post'])
    def admit(self, request, pk=None):
        user = self.get_object()
        user.admitted = True
        user.save()
        return Response({'status': 'admitted', 'message': f'User {user.username} has been admitted'})

    @action(detail=True, methods=['post'])
    def revoke_admission(self, request, pk=None):
        user = self.get_object()
        user.admitted = False
        user.save()
        return Response({'status': 'revoked', 'message': f'Admission revoked for {user.username}'})

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def get_queryset(self):
        queryset = Project.objects.all()
        user = self.request.user
        
        # Filter based on query params
        status_filter = self.request.query_params.get('status', None)
        owner_id = self.request.query_params.get('owner', None)
        supervisor_id = self.request.query_params.get('supervisor', None)
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)
        if supervisor_id:
            queryset = queryset.filter(supervisor_id=supervisor_id)
            
        return queryset.order_by('-submitted_at', '-id')
    
    def retrieve(self, request, *args, **kwargs):
        """Get a single project and increment view count"""
        instance = self.get_object()
        # Increment view count
        instance.views = (instance.views or 0) + 1
        instance.save(update_fields=['views'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        supervisor = serializer.validated_data.get('supervisor')
        if not supervisor and getattr(self.request.user, 'supervisor_id', None):
            supervisor = self.request.user.supervisor
        project = serializer.save(owner=self.request.user, status='pending', supervisor=supervisor)
        # Send email notifications to student and supervisor
        try:
            notify_project_submission(project)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send submission notification: {e}")

    def perform_update(self, serializer):
        # Students can only edit their own projects if status is pending or revision_requested
        if self.request.user.role == 'student':
            project = self.get_object()
            if project.owner != self.request.user:
                raise PermissionDenied("You can only edit your own projects")
            if project.status not in ['pending', 'revision_requested']:
                raise PermissionDenied("You can only edit pending or revision-requested projects")
        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsLecturerOrAdmin])
    def approve(self, request, pk=None):
        """Lecturer approves and recommends project for admin publishing"""
        project = self.get_object()
        feedback = request.data.get('feedback', '')
        
        if request.user.role == 'lecturer':
            # Verify lecturer is the supervisor
            if project.supervisor != request.user:
                return Response({
                    'error': 'You can only approve projects assigned to you'
                }, status=403)
            
            # Lecturer recommends for publishing - status becomes 'under_review'
            project.status = 'under_review'
            project.save()
            # Notify student that supervisor has approved
            try:
                notify_project_under_review(project, feedback)
                notify_admin_project_ready_for_review(project, feedback)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send under_review notification: {e}")
            return Response({
                'status': 'under_review',
                'message': 'Project approved by supervisor. Awaiting admin to publish.',
                'feedback': feedback
            })
        elif request.user.role == 'admin':
            # Admin can also approve directly (publish)
            project.status = 'approved'
            project.save()
            # Notify student that project is approved
            try:
                notify_project_approved(project, feedback)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send approval notification: {e}")
            return Response({
                'status': 'approved',
                'message': 'Project has been published and is now publicly available.'
            })

    @action(detail=True, methods=['post'], permission_classes=[IsLecturerOrAdmin])
    def reject(self, request, pk=None):
        """Lecturer rejects the project"""
        project = self.get_object()
        feedback = request.data.get('feedback', 'Project rejected')
        
        if request.user.role == 'lecturer':
            # Verify lecturer is the supervisor
            if project.supervisor != request.user:
                return Response({
                    'error': 'You can only reject projects assigned to you'
                }, status=403)
        
        project.status = 'revision_requested'
        project.save()
        # Notify student about rejection
        try:
            notify_project_rejected(project, feedback)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send rejection notification: {e}")

        # Create in-app message so student sees supervisor guidance in Messages
        if request.user.role == 'lecturer' and feedback:
            try:
                review_message = Message.objects.create(
                    project=project,
                    sender=request.user,
                    content=f"Review feedback: {feedback}"
                )
                notify_new_message(review_message)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send review message notification: {e}")
        
        return Response({
            'status': 'revision_requested',
            'message': 'Project rejected. Student has been notified to make revisions.',
            'feedback': feedback
        })

    @action(detail=True, methods=['post'], permission_classes=[IsLecturerOrAdmin])
    def request_revision(self, request, pk=None):
        project = self.get_object()
        feedback = request.data.get('feedback', 'Revisions requested')
        
        # Verify lecturer is the supervisor
        if request.user.role == 'lecturer':
            if project.supervisor != request.user:
                return Response({
                    'error': 'You can only request revisions for projects assigned to you'
                }, status=403)
        
        project.status = 'revision_requested'
        project.save()
        # Notify student about revision request
        try:
            notify_project_rejected(project, feedback)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send revision notification: {e}")

        # Create in-app message so student sees supervisor guidance in Messages
        if request.user.role == 'lecturer' and feedback:
            try:
                review_message = Message.objects.create(
                    project=project,
                    sender=request.user,
                    content=f"Revision request: {feedback}"
                )
                notify_new_message(review_message)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send revision message notification: {e}")
        
        return Response({
            'status': 'revision_requested',
            'message': 'Revision requested. Student has been notified.',
            'feedback': feedback
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def publish(self, request, pk=None):
        """Admin final approval and publishing"""
        project = self.get_object()
        project.status = 'approved'
        project.save()
        # Notify student that project is published
        try:
            notify_project_approved(project, 'Your project has been published and is now publicly available.')
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send publish notification: {e}")
        return Response({
            'status': 'approved',
            'message': 'Project published successfully'
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def archive(self, request, pk=None):
        """Archive a project"""
        project = self.get_object()
        project.status = 'archived'
        project.save()
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def unpublish(self, request, pk=None):
        """Unpublish an approved project back to under_review"""
        project = self.get_object()

        if project.status != 'approved':
            return Response({'error': 'Only published projects can be unpublished'}, status=400)

        project.status = 'under_review'
        project.save()
        return Response({'status': 'under_review', 'message': 'Project unpublished and moved back to under review'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def unarchive(self, request, pk=None):
        """Restore an archived project back to under_review"""
        project = self.get_object()

        if project.status != 'archived':
            return Response({'error': 'Only archived projects can be unarchived'}, status=400)

        project.status = 'under_review'
        project.save()
        return Response({'status': 'under_review', 'message': 'Project unarchived and moved to under review'})

    @action(detail=True, methods=['get'])
    def citation(self, request, pk=None):
        """Generate citation for a project"""
        project = self.get_object()
        
        # APA format
        authors_list = project.authors_list()
        authors_str = ', '.join(authors_list)
        year = project.year
        
        citation = {
            'apa': f"{authors_str} ({year}). {project.title}. {project.faculty}, {project.department}.",
            'mla': f"{authors_str}. \"{project.title}.\" {project.faculty}, {project.department}, {year}.",
            'chicago': f"{authors_str}. {year}. \"{project.title}.\" {project.faculty}, {project.department}.",
            'bibtex': f"""@thesis{{{project.id},
  author = {{{authors_str}}},
  title = {{{project.title}}},
  school = {{{project.faculty}, {project.department}}},
  year = {{{year}}},
  type = {{{project.type}}}
}}"""
        }
        
        return Response(citation)

    @action(detail=True, methods=['post'])
    def increment_download(self, request, pk=None):
        """Track download count"""
        project = self.get_object()
        project.downloads = (project.downloads or 0) + 1
        project.save()
        return Response({'message': 'Download tracked', 'downloads': project.downloads})

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='stage-progress')
    def stage_progress(self, request, pk=None):
        project = self.get_object()
        submissions = ProjectStageSubmission.objects.filter(project=project).prefetch_related('versions', 'reviewed_by')
        serializer = ProjectStageSubmissionSerializer(submissions, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='stage-submissions/(?P<stage>[^/.]+)')
    def submit_stage(self, request, pk=None, stage=None):
        project = self.get_object()
        user = request.user

        if user.role != 'student' or project.owner != user:
            return Response({'error': 'Only the owning student can submit this stage.'}, status=403)

        uploaded_file = request.FILES.get('file')
        student_note = request.data.get('student_note', '')

        if not uploaded_file:
            return Response({'error': 'file is required'}, status=400)

        stage_submission, _created = ProjectStageSubmission.objects.get_or_create(
            project=project,
            stage=stage,
            defaults={'review_status': 'pending'},
        )

        # Create a new version
        next_version = (stage_submission.versions.aggregate(models.Max('version')).get('version__max') or 0) + 1
        version = ProjectStageSubmissionVersion.objects.create(
            stage_submission=stage_submission,
            version=next_version,
            submitted_file=uploaded_file,
            student_note=student_note,
            review_status='pending',
        )

        # Update parent submission metadata
        stage_submission.submitted_file = uploaded_file
        stage_submission.student_note = student_note
        stage_submission.review_status = 'pending'
        stage_submission.submitted_at = timezone.now()
        stage_submission.save(update_fields=['submitted_file', 'student_note', 'review_status', 'submitted_at'])

        serializer = ProjectStageSubmissionSerializer(stage_submission, context={'request': request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsLecturerOrAdmin], url_path='stage-submissions/(?P<stage>[^/.]+)/review')
    def review_stage(self, request, pk=None, stage=None):
        project = self.get_object()
        user = request.user
        stage_submission = ProjectStageSubmission.objects.filter(project=project, stage=stage).first()

        if not stage_submission:
            return Response({'error': 'Stage submission not found.'}, status=404)

        review_status = request.data.get('review_status') or 'pending'
        feedback = request.data.get('feedback', '')

        if review_status not in ['approved', 'revision_requested', 'pending']:
            return Response({'error': 'Invalid review_status'}, status=400)

        stage_submission.supervisor_feedback = feedback
        stage_submission.review_status = review_status
        stage_submission.reviewed_by = user
        stage_submission.reviewed_at = timezone.now()
        stage_submission.save(update_fields=['supervisor_feedback', 'review_status', 'reviewed_by', 'reviewed_at'])

        latest_version = stage_submission.versions.order_by('-version').first()
        if latest_version:
            latest_version.supervisor_feedback = feedback
            latest_version.review_status = review_status if review_status != 'pending' else latest_version.review_status
            latest_version.reviewed_at = timezone.now()
            latest_version.reviewed_by = user
            latest_version.save(update_fields=['supervisor_feedback', 'review_status', 'reviewed_at', 'reviewed_by'])

        serializer = ProjectStageSubmissionSerializer(stage_submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='development-submissions')
    def development_submission(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if user.role != 'student' or project.owner != user:
            return Response({'error': 'Only the owning student can submit development updates.'}, status=403)

        uploaded_file = request.FILES.get('file')
        submission_type = request.data.get('submission_type') or 'progress_report'
        comment = request.data.get('comment', '')

        if not uploaded_file:
            return Response({'error': 'file is required'}, status=400)

        next_version = (
            ProjectDevelopmentSubmission.objects.filter(project=project, submission_type=submission_type)
            .aggregate(models.Max('version'))
            .get('version__max')
            or 0
        ) + 1

        submission = ProjectDevelopmentSubmission.objects.create(
            project=project,
            submitted_by=user,
            submission_type=submission_type,
            version=next_version,
            file=uploaded_file,
            comment=comment,
        )

        serializer = ProjectDevelopmentSubmissionSerializer(submission)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='interim-evaluations')
    def interim_evaluation(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if user.role != 'student' or project.owner != user:
            return Response({'error': 'Only the owning student can submit interim evaluations.'}, status=403)

        marks = request.data.get('marks')
        comments = request.data.get('comments', '')

        if marks is None:
            return Response({'error': 'marks is required'}, status=400)

        evaluation = InterimEvaluation.objects.create(
            project=project,
            evaluator=user,
            marks=marks,
            comments=comments,
        )

        serializer = InterimEvaluationSerializer(evaluation)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='final-submission')
    def final_submission(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if user.role != 'student' or project.owner != user:
            return Response({'error': 'Only the owning student can submit the final package.'}, status=403)

        final_report = request.FILES.get('final_report')
        source_code = request.FILES.get('source_code')
        supporting_docs = request.FILES.get('supporting_documents')
        note = request.data.get('note', '')

        if not final_report:
            return Response({'error': 'final_report is required'}, status=400)

        project.source_code_file = source_code or project.source_code_file
        project.supporting_documents_file = supporting_docs or project.supporting_documents_file
        project.save(update_fields=['source_code_file', 'supporting_documents_file'])

        stage_submission, _ = ProjectStageSubmission.objects.get_or_create(
            project=project,
            stage='final_submission',
            defaults={'review_status': 'pending'},
        )

        next_version = (stage_submission.versions.aggregate(models.Max('version')).get('version__max') or 0) + 1
        ProjectStageSubmissionVersion.objects.create(
            stage_submission=stage_submission,
            version=next_version,
            submitted_file=final_report,
            student_note=note,
            review_status='pending',
        )

        stage_submission.submitted_file = final_report
        stage_submission.student_note = note
        stage_submission.review_status = 'pending'
        stage_submission.submitted_at = timezone.now()
        stage_submission.save(update_fields=['submitted_file', 'student_note', 'review_status', 'submitted_at'])

        serializer = ProjectStageSubmissionSerializer(stage_submission, context={'request': request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='final-document')
    def final_document(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if user.role != 'student' or project.owner != user:
            return Response({'error': 'Only the owning student can submit the final document.'}, status=403)

        final_doc = request.FILES.get('file')
        note = request.data.get('note', '')

        if not final_doc:
            return Response({'error': 'file is required'}, status=400)

        project.status = 'plagiarism_checking'
        project.workflow_status = 'plagiarism_checking'
        project.save(update_fields=['status', 'workflow_status'])

        stage_submission, _ = ProjectStageSubmission.objects.get_or_create(
            project=project,
            stage='final_document',
            defaults={'review_status': 'pending'},
        )

        next_version = (stage_submission.versions.aggregate(models.Max('version')).get('version__max') or 0) + 1
        ProjectStageSubmissionVersion.objects.create(
            stage_submission=stage_submission,
            version=next_version,
            submitted_file=final_doc,
            student_note=note,
            review_status='pending',
        )

        stage_submission.submitted_file = final_doc
        stage_submission.student_note = note
        stage_submission.review_status = 'pending'
        stage_submission.submitted_at = timezone.now()
        stage_submission.save(update_fields=['submitted_file', 'student_note', 'review_status', 'submitted_at'])

        try:
            file_path = stage_submission.submitted_file.path
            filename = stage_submission.submitted_file.name
            worker = threading.Thread(
                target=_run_plagiarism_check,
                args=(project.id, stage_submission.id, file_path, filename),
                daemon=True,
            )
            worker.start()
        except Exception as exc:
            logger.error(f"Failed to start plagiarism check for project {project.id}: {exc}")
            return Response(
                {
                    'error': 'Plagiarism check could not be started. Please try again later.',
                    'detail': str(exc),
                },
                status=502,
            )

        serializer = ProjectStageSubmissionSerializer(stage_submission, context={'request': request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin], url_path='plagiarism-check')
    def plagiarism_check(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if user.role != 'admin':
            return Response({'error': 'Only admins can upload plagiarism reports.'}, status=403)

        report_file = request.FILES.get('file')
        similarity_score = request.data.get('similarity_score', None)
        note = request.data.get('note', '')

        if similarity_score is not None:
            try:
                project.similarity_score = int(round(float(similarity_score)))
                project.save(update_fields=['similarity_score'])
            except ValueError:
                return Response({'error': 'similarity_score must be numeric'}, status=400)

        if not report_file and similarity_score is None:
            return Response({'error': 'Provide a report file or similarity_score.'}, status=400)

        stage_submission, _ = ProjectStageSubmission.objects.get_or_create(
            project=project,
            stage='plagiarism_check',
            defaults={'review_status': 'pending'},
        )

        next_version = (stage_submission.versions.aggregate(models.Max('version')).get('version__max') or 0) + 1
        ProjectStageSubmissionVersion.objects.create(
            stage_submission=stage_submission,
            version=next_version,
            submitted_file=report_file,
            student_note=note,
            review_status='pending',
        )

        stage_submission.submitted_file = report_file or stage_submission.submitted_file
        stage_submission.student_note = note
        stage_submission.review_status = 'pending'
        stage_submission.submitted_at = timezone.now()
        stage_submission.save(update_fields=['submitted_file', 'student_note', 'review_status', 'submitted_at'])

        serializer = ProjectStageSubmissionSerializer(stage_submission, context={'request': request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='workflow')
    def workflow_details(self, request, pk=None):
        project = self.get_object()
        stage_submissions = ProjectStageSubmission.objects.filter(project=project).prefetch_related('versions')
        development_submissions = ProjectDevelopmentSubmission.objects.filter(project=project)
        interim_evaluations = InterimEvaluation.objects.filter(project=project)
        reviews = project.reviews.all()

        payload = {
            'project': project,
            'reviews': reviews,
            'development_submissions': development_submissions,
            'interim_evaluations': interim_evaluations,
            'stage_submissions': stage_submissions,
        }
        serializer = WorkflowDetailsSerializer(payload, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        """Get or send messages for a project"""
        project = self.get_object()
        user = request.user
        
        # Only project owner (student) or supervisor (lecturer) can access messages
        if user.role == 'student' and project.owner != user:
            return Response({'error': 'You can only access messages for your own projects'}, status=403)
        if user.role == 'lecturer' and project.supervisor != user:
            return Response({'error': 'You can only access messages for projects you supervise'}, status=403)
        
        if request.method == 'GET':
            messages = project.messages.select_related('sender').order_by('created_at')
            # Mark messages as read for the current user (if they're the recipient)
            if user.role == 'student':
                # Student reading - mark lecturer messages as read
                project.messages.filter(is_read=False).exclude(sender=user).update(is_read=True)
            else:
                # Lecturer reading - mark student messages as read
                project.messages.filter(is_read=False).exclude(sender=user).update(is_read=True)
            
            serializer = MessageSerializer(messages, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            content = request.data.get('content', '').strip()
            if not content:
                return Response({'error': 'Message content is required'}, status=400)
            
            message = Message.objects.create(
                project=project,
                sender=user,
                content=content
            )
            # Send email notification to recipient
            try:
                notify_new_message(message)
            except Exception as e:
                logging.getLogger(__name__).error(f"Failed to send message notification: {e}")
            serializer = MessageSerializer(message)
            return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def unread_count(self, request, pk=None):
        """Get count of unread messages for a project"""
        project = self.get_object()
        user = request.user
        
        # Count messages not sent by the current user and not read
        count = project.messages.filter(is_read=False).exclude(sender=user).count()
        return Response({'unread_count': count})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def resubmit(self, request, pk=None):
        """Student resubmits the same project after revision request."""
        project = self.get_object()
        user = request.user

        if user.role != 'student':
            return Response({'error': 'Only students can resubmit projects'}, status=403)

        if project.owner != user:
            return Response({'error': 'You can only resubmit your own projects'}, status=403)

        if project.status != 'revision_requested':
            return Response({'error': 'Only revision-requested projects can be resubmitted'}, status=400)

        project.status = 'pending'
        project.save(update_fields=['status'])

        try:
            notify_project_submission(project)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send resubmission notification: {e}")

        return Response({
            'status': 'pending',
            'message': 'Project resubmitted successfully and sent back to your supervisor for review.'
        })

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def analytics(request):
    """Get analytics data for admin dashboard"""
    total_projects = Project.objects.count()
    pending_reviews = Project.objects.filter(status='pending').count()
    under_review = Project.objects.filter(status='under_review').count()
    approved = Project.objects.filter(status='approved').count()
    
    # Projects by faculty
    by_faculty = Project.objects.values('faculty').annotate(count=Count('id'))
    
    # Projects by status
    by_status = Project.objects.values('status').annotate(count=Count('id'))
    
    # Total users by role
    by_role = User.objects.values('role').annotate(count=Count('id'))
    
    return Response({
        'total_projects': total_projects,
        'pending_reviews': pending_reviews,
        'under_review': under_review,
        'approved': approved,
        'by_faculty': list(by_faculty),
        'by_status': list(by_status),
        'by_role': list(by_role),
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def predictive_trends(request):
    """Predict hot topics using downloads/views with recency-weighted velocity.

    Falls back to type/faculty/department labels when keywords are missing so
    the UI still shows movement even with sparse keyword data.
    """
    today = date.today()
    topics = {}

    projects = Project.objects.exclude(status='archived').values(
        'keywords', 'downloads', 'views', 'submitted_at', 'type', 'faculty', 'department'
    )

    for project in projects:
        raw_keywords = project.get('keywords') or ''
        keyword_list = [k.strip().lower() for k in raw_keywords.split(',') if k.strip()]

        # Fallback signals if keywords are empty
        if not keyword_list:
            fallback_labels = [
                (project.get('type') or '').strip().lower(),
                (project.get('faculty') or '').strip().lower(),
                (project.get('department') or '').strip().lower(),
            ]
            keyword_list = [label for label in fallback_labels if label]

        if not keyword_list:
            continue

        submitted_at = project.get('submitted_at') or today
        age_days = max((today - submitted_at).days, 1)

        downloads = project.get('downloads') or 0
        views = project.get('views') or 0

        # Add a small prior so zero-download projects still get a tiny signal
        smoothed_downloads = downloads + 1
        smoothed_views = views + 1

        citation_velocity = smoothed_downloads / age_days  # proxy velocity

        # Exponential decay so newer work counts more; ~60% weight at 1 year, ~13% at 2 years
        recency_weight = math.exp(-age_days / 365)

        base_score = (smoothed_downloads * 1.5) + (smoothed_views * 0.5) + (citation_velocity * 40)
        score = base_score * recency_weight

        for kw in keyword_list:
            entry = topics.setdefault(kw, {
                'topic': kw,
                'score': 0.0,
                'downloads': 0,
                'views': 0,
                'citation_velocity': 0.0,
                'projects_count': 0,
                'recency_weight': 0.0,
            })
            entry['score'] += score
            entry['downloads'] += downloads
            entry['views'] += views
            entry['citation_velocity'] += citation_velocity
            entry['projects_count'] += 1
            entry['recency_weight'] = max(entry['recency_weight'], recency_weight)

    # Normalize citation velocity by project count to avoid overstating repeated topics
    for kw, data in topics.items():
        if data['projects_count'] > 0:
            data['citation_velocity'] = data['citation_velocity'] / data['projects_count']

    top_topics = sorted(topics.values(), key=lambda x: x['score'], reverse=True)[:15]

    return Response({
        'topics': top_topics,
        'generated_at': datetime.utcnow().isoformat() + 'Z'
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_conversations(request):
    """Get all projects with conversations for the current user"""
    user = request.user
    
    if user.role == 'student':
        # Get all projects owned by this student that have messages
        projects = Project.objects.filter(owner=user).prefetch_related('messages')
    elif user.role == 'lecturer':
        # Get all projects supervised by this lecturer
        projects = Project.objects.filter(supervisor=user).prefetch_related('messages')
    else:
        return Response([])
    
    conversations = []
    for project in projects:
        messages = project.messages.all()
        if messages.exists() or user.role == 'lecturer':  # Lecturers see all their supervised projects
            unread_count = messages.filter(is_read=False).exclude(sender=user).count()
            last_message = messages.last()
            
            # Get the other party's info
            if user.role == 'student':
                other_party = project.supervisor
            else:
                other_party = project.owner
            
            conversations.append({
                'project_id': project.id,
                'project_title': project.title,
                'project_status': project.status,
                'other_party': {
                    'id': other_party.id if other_party else None,
                    'name': f"{other_party.first_name} {other_party.last_name}".strip() if other_party else 'Unknown',
                    'role': other_party.role if other_party else None,
                } if other_party else None,
                'unread_count': unread_count,
                'last_message': {
                    'content': last_message.content[:100] if last_message else None,
                    'created_at': last_message.created_at.isoformat() if last_message else None,
                    'sender_name': f"{last_message.sender.first_name} {last_message.sender.last_name}".strip() if last_message else None,
                } if last_message else None,
                'message_count': messages.count(),
            })
    
    # Sort by last message date (most recent first)
    conversations.sort(key=lambda x: x['last_message']['created_at'] if x['last_message'] else '', reverse=True)
    
    return Response(conversations)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_lecturers(request):
    """Get list of lecturers/supervisors for project assignment"""
    lecturers = User.objects.filter(role='lecturer')
    
    # Optionally filter by faculty/department to match student's
    faculty = request.query_params.get('faculty', None)
    department = request.query_params.get('department', None)
    
    if faculty:
        lecturers = lecturers.filter(faculty__iexact=faculty)
    if department:
        lecturers = lecturers.filter(department__iexact=department)
    
    data = [{
        'id': lecturer.id,
        'name': f"{lecturer.first_name} {lecturer.last_name}".strip() or lecturer.username,
        'email': lecturer.email,
        'faculty': lecturer.faculty,
        'department': lecturer.department,
    } for lecturer in lecturers]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_supervisees(request):
    if request.user.role != 'lecturer':
        return Response({'error': 'Only lecturers can access supervisees.'}, status=403)

    students = (
        User.objects.filter(role='student', supervisor=request.user)
        .annotate(
            project_count=Count('projects', distinct=True),
            latest_submission=models.Max('projects__submitted_at'),
        )
        .order_by('first_name', 'last_name', 'username')
    )

    submitted = []
    not_submitted = []

    for student in students:
        name = f"{student.first_name} {student.last_name}".strip() or student.username
        entry = {
            'id': student.id,
            'name': name,
            'email': student.email,
            'faculty': student.faculty,
            'department': student.department,
            'project_count': student.project_count or 0,
            'latest_submission': student.latest_submission.isoformat() if student.latest_submission else None,
        }
        if (student.project_count or 0) > 0:
            submitted.append(entry)
        else:
            not_submitted.append(entry)

    return Response({
        'submitted': submitted,
        'not_submitted': not_submitted,
        'total': len(submitted) + len(not_submitted),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_due_date_notification(request):
    if request.user.role != 'lecturer':
        return Response({'error': 'Only lecturers can send due date notifications.'}, status=403)

    student_id = request.data.get('student_id')
    project_id = request.data.get('project_id')
    stage = request.data.get('stage')
    due_date = request.data.get('due_date')
    note = (request.data.get('note') or '').strip()

    if not student_id or not project_id or not stage or not due_date:
        return Response({'error': 'student_id, project_id, stage, and due_date are required.'}, status=400)

    student = User.objects.filter(id=student_id, role='student', supervisor=request.user).first()
    if not student:
        return Response({'error': 'Student not found or not assigned to you.'}, status=404)

    project = Project.objects.filter(id=project_id, owner=student, supervisor=request.user).first()
    if not project:
        return Response({'error': 'Project not found for this student.'}, status=404)

    stage_label = dict(ProjectStageSubmission.STAGE_CHOICES).get(stage)
    if not stage_label:
        return Response({'error': 'Invalid stage.'}, status=400)

    content_lines = [
        f"Due date set for {stage_label}.",
        f"Project: {project.title}",
        f"Due date: {due_date}",
    ]
    if note:
        content_lines.append(f"Note: {note}")

    message = Message.objects.create(
        project=project,
        sender=request.user,
        content="\n".join(content_lines),
    )

    notify_stage_due_date(student, request.user, project, stage_label, due_date, note or None)

    return Response({'status': 'sent', 'message_id': message.id})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_supervisor_message_notification(request):
    if request.user.role != 'lecturer':
        return Response({'error': 'Only lecturers can send supervisor messages.'}, status=403)

    student_id = request.data.get('student_id')
    project_id = request.data.get('project_id')
    content = (request.data.get('content') or '').strip()

    if not student_id or not project_id or not content:
        return Response({'error': 'student_id, project_id, and content are required.'}, status=400)

    student = User.objects.filter(id=student_id, role='student', supervisor=request.user).first()
    if not student:
        return Response({'error': 'Student not found or not assigned to you.'}, status=404)

    project = Project.objects.filter(id=project_id, owner=student, supervisor=request.user).first()
    if not project:
        return Response({'error': 'Project not found for this student.'}, status=404)

    message = Message.objects.create(
        project=project,
        sender=request.user,
        content=content,
    )

    notify_supervisor_message(student, request.user, project, content)

    return Response({'status': 'sent', 'message_id': message.id})


def _build_stage_progress(project, request):
    submissions = ProjectStageSubmission.objects.filter(project=project).prefetch_related('versions', 'reviewed_by')
    submission_map = {submission.stage: submission for submission in submissions}
    progress = []
    stage_catalog = [
        ('proposal', 'Proposal'),
        ('chapter1', 'Chapter 1'),
        ('chapter2', 'Chapter 2'),
        ('chapter3', 'Chapter 3'),
        ('final_document', 'Final Document'),
    ]

    for stage_code, stage_label in stage_catalog:
        submission = submission_map.get(stage_code)
        if submission:
            progress.append(ProjectStageSubmissionSerializer(submission, context={'request': request}).data)
            continue

        progress.append({
            'id': None,
            'project': project.id,
            'stage': stage_code,
            'stageLabel': stage_label,
            'submitted_file': None,
            'fileUrl': None,
            'student_note': '',
            'supervisor_feedback': '',
            'review_status': 'not_submitted',
            'submitted_at': None,
            'reviewed_at': None,
            'reviewed_by': None,
            'reviewedByName': None,
            'versions': [],
            'is_locked': False,
            'lock_reason': None,
        })

    return progress


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def supervisee_details(request, student_id):
    if request.user.role != 'lecturer':
        return Response({'error': 'Only lecturers can access supervisee details.'}, status=403)

    student = User.objects.filter(id=student_id, role='student', supervisor=request.user).first()
    if not student:
        return Response({'error': 'Supervisee not found.'}, status=404)

    student_name = f"{student.first_name} {student.last_name}".strip() or student.username
    supervisor = student.supervisor
    supervisor_payload = None
    if supervisor:
        supervisor_payload = {
            'id': supervisor.id,
            'name': f"{supervisor.first_name} {supervisor.last_name}".strip() or supervisor.username,
            'email': supervisor.email,
            'faculty': supervisor.faculty,
            'department': supervisor.department,
        }

    projects = Project.objects.filter(owner=student).order_by('-submitted_at', '-id')
    project_payloads = []
    for project in projects:
        serialized_project = ProjectSerializer(project, context={'request': request}).data
        stage_progress = _build_stage_progress(project, request)
        total_stages = len(stage_progress)
        submitted_count = len([stage for stage in stage_progress if stage.get('review_status') != 'not_submitted'])
        completed_count = len([stage for stage in stage_progress if stage.get('review_status') == 'approved'])
        pending_count = total_stages - completed_count
        project_payloads.append({
            **serialized_project,
            'stage_progress': stage_progress,
            'stage_summary': {
                'total': total_stages,
                'submitted': submitted_count,
                'completed': completed_count,
                'pending': pending_count,
            },
        })

    return Response({
        'student': {
            'id': student.id,
            'name': student_name,
            'email': student.email,
            'faculty': student.faculty,
            'department': student.department,
            'supervisor': supervisor_payload,
        },
        'projects': project_payloads,
    })

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        if user.role == 'student' and not user.supervisor_id:
            _assign_supervisor_round_robin(user)
            user.refresh_from_db(fields=['supervisor'])
        
        # Generate JWT tokens for the new user
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
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
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def forgot_password(request):
    email = (request.data.get('email') or '').strip()

    if not email:
        return Response({'message': 'Email is required.'}, status=400)

    generic_response = {
        'message': 'If an account with that email exists, a password reset link has been sent.'
    }

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response(generic_response, status=200)

    try:
        token_generator = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)

        frontend_base_url = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        reset_link = f"{frontend_base_url}/reset-password?uid={uid}&token={token}"

        send_mail(
            subject='Password Reset Request',
            message=(
                'You requested a password reset for your Academic Repository account.\n\n'
                f'Use the link below to reset your password:\n{reset_link}\n\n'
                'If you did not request this, you can safely ignore this email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.error(f"Failed to send password reset email for {email}: {exc}")

    return Response(generic_response, status=200)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    uid = (request.data.get('uid') or '').strip()
    token = (request.data.get('token') or '').strip()
    password = request.data.get('password') or ''

    if not uid or not token or not password:
        return Response({'message': 'uid, token, and password are required.'}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response({'message': 'Invalid or expired password reset link.'}, status=400)

    token_generator = PasswordResetTokenGenerator()
    if not token_generator.check_token(user, token):
        return Response({'message': 'Invalid or expired password reset link.'}, status=400)

    try:
        validate_password(password, user=user)
    except Exception as exc:
        return Response({'message': str(exc)}, status=400)

    user.set_password(password)
    user.save(update_fields=['password'])

    return Response({'message': 'Password reset successful. You can now log in with your new password.'}, status=200)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def extract_keywords(request):
    """
    Extract keywords from uploaded document using AI/NLP.
    This endpoint accepts file uploads (PDF/DOCX) and extracts keywords from the document content.
    """
    import tempfile
    import os
    import logging
    logger = logging.getLogger(__name__)
    
    uploaded_file = request.FILES.get('file', None)
    existing_keywords = request.POST.getlist('existing_keywords', [])
    abstract_text = (request.POST.get('abstract_text') or '').strip()
    title_text = (request.POST.get('title_text') or '').strip()
    
    if not uploaded_file:
        fallback_text = "\n\n".join(part for part in [title_text, abstract_text] if part).strip()
        if len(fallback_text) < 20:
            return Response({
                'error': 'Please upload a document or provide a longer title/abstract to extract keywords',
                'keywords': []
            }, status=400)

        try:
            from .nlp_utils import extract_keywords_simple

            keywords = extract_keywords_simple(fallback_text, top_n=10)
            if existing_keywords:
                keywords = [k for k in keywords if k.lower() not in [e.lower() for e in existing_keywords]]

            if not keywords:
                return Response({
                    'error': 'Could not extract meaningful keywords from the provided text.',
                    'keywords': []
                }, status=400)

            return Response({
                'keywords': keywords,
                'message': 'Keywords extracted from title/abstract text',
                'source': 'abstract'
            })
        except Exception as e:
            logger.error(f"Error extracting keywords from text fallback: {e}")
            return Response({
                'error': f'Failed to extract keywords: {str(e)}',
                'keywords': []
            }, status=500)
    
    try:
        from .nlp_utils import extract_text_from_file, extract_keywords_simple
        
        # Check file extension
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in ['.pdf', '.docx', '.doc']:
            return Response({
                'error': 'Unsupported file type. Please upload PDF or DOCX files.',
                'keywords': []
            }, status=400)

        if ext == '.doc':
            return Response({
                'error': 'Legacy .doc files are not supported for AI keyword extraction. Please save and upload as .docx.',
                'keywords': []
            }, status=400)
        
        # Save to temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        for chunk in uploaded_file.chunks():
            temp_file.write(chunk)
        temp_file.close()
        temp_file_path = temp_file.name
        
        try:
            # Extract text from uploaded file
            document_text = extract_text_from_file(temp_file_path)
            logger.info(f"Extracted {len(document_text)} chars from {uploaded_file.name}")
            
            extraction_source = 'document'
            extraction_notice = None

            if not document_text or len(document_text.strip()) < 20:
                fallback_text = "\n\n".join(part for part in [title_text, abstract_text] if part)
                if len(fallback_text.strip()) >= 20:
                    document_text = fallback_text
                    extraction_source = 'abstract'
                    extraction_notice = 'Could not extract enough text from uploaded file. Keywords were generated from your title/abstract instead.'
                else:
                    if ext == '.pdf':
                        extraction_error = f'Could not extract text from the PDF ({len(document_text)} characters found). This may be a scanned PDF. Try uploading a text-based PDF or provide abstract text.'
                    else:
                        extraction_error = f'Could not extract text from the Word document ({len(document_text)} characters found). Please ensure the .docx contains selectable text or provide abstract text.'

                    return Response({
                        'error': extraction_error,
                        'keywords': []
                    }, status=400)
            
            # Extract keywords from the text
            keywords = extract_keywords_simple(document_text, top_n=10)
            logger.info(f"Extracted keywords: {keywords}")
            
            # Filter out existing keywords from suggestions
            if existing_keywords:
                keywords = [k for k in keywords if k.lower() not in [e.lower() for e in existing_keywords]]
            
            if not keywords:
                return Response({
                    'error': 'Could not extract meaningful keywords. The document may contain mostly common words.',
                    'keywords': []
                }, status=400)
            
            return Response({
                'keywords': keywords,
                'message': 'Keywords extracted successfully from document' if extraction_source == 'document' else extraction_notice,
                'source': extraction_source
            })
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    except Exception as e:
        import traceback
        logger.error(f"Error extracting keywords: {e}\n{traceback.format_exc()}")
        return Response({
            'error': f'Failed to extract keywords: {str(e)}',
            'keywords': []
        }, status=500)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_similarity(request):
    """
    Check similarity score by comparing input project text against existing projects.
    Supports file upload and/or title+abstract fallback text.
    """
    import tempfile
    import os
    import logging
    logger = logging.getLogger(__name__)

    uploaded_file = request.FILES.get('file', None)
    abstract_text = (request.POST.get('abstract_text') or '').strip()
    title_text = (request.POST.get('title_text') or '').strip()
    current_project_id = request.POST.get('current_project_id')

    try:
        from .nlp_utils import (
            extract_text_from_file,
            compute_similarity_report,
            call_winston_similarity,
            compute_hybrid_similarity
        )

        base_text = "\n\n".join(part for part in [title_text, abstract_text] if part).strip()
        extracted_text = ""
        temp_file_path = None

        if uploaded_file:
            ext = os.path.splitext(uploaded_file.name)[1].lower()
            if ext not in ['.pdf', '.docx', '.doc']:
                return Response({
                    'error': 'Unsupported file type. Please upload PDF or DOCX files.'
                }, status=400)

            if ext == '.doc':
                return Response({
                    'error': 'Legacy .doc files are not supported for similarity check. Please upload .docx.'
                }, status=400)

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            for chunk in uploaded_file.chunks():
                temp_file.write(chunk)
            temp_file.close()
            temp_file_path = temp_file.name

            extracted_text = extract_text_from_file(temp_file_path)

        input_text = "\n\n".join(part for part in [base_text, extracted_text] if part).strip()

        if not input_text or len(input_text) < 20:
            return Response({
                'error': 'Insufficient text for similarity check. Provide abstract/title or a readable file.'
            }, status=400)

        comparison_projects = Project.objects.exclude(status='archived')
        if current_project_id:
            comparison_projects = comparison_projects.exclude(id=current_project_id)

        report = compute_similarity_report(input_text, comparison_projects, top_k=5)
        winston_result = call_winston_similarity(input_text)
        hybrid_result = compute_hybrid_similarity(
            local_score=report['similarity_score'],
            winston_score=winston_result.get('score'),
            local_top_matches=report['top_matches']
        )

        report_payload_url = None
        report_payload_file_url = None

        if uploaded_file and current_project_id and temp_file_path:
            try:
                project = Project.objects.get(id=current_project_id)
                with open(temp_file_path, 'rb') as handle:
                    file_bytes = handle.read()

                api_result = _call_plagiarism_api(file_bytes, uploaded_file.name)
                report_similarity, report_url, report_json, report_pdf_base64 = _extract_plagiarism_result(api_result)

                report_content = None
                if report_pdf_base64:
                    try:
                        report_content = base64.b64decode(report_pdf_base64)
                    except Exception:
                        report_content = None
                if not report_content and report_url:
                    report_content = _fetch_report_file(report_url)

                if report_content:
                    _attach_report_file(project, report_content, 'plagiarism_report.pdf')

                if report_similarity is not None:
                    try:
                        project.similarity_score = int(round(float(report_similarity)))
                    except (TypeError, ValueError):
                        pass
                else:
                    try:
                        project.similarity_score = int(round(float(hybrid_result['similarity_score'])))
                    except (TypeError, ValueError):
                        pass

                if report_url:
                    project.plagiarism_report_url = report_url
                project.plagiarism_report_json = report_json
                project.plagiarism_checked_at = timezone.now()
                project.save(update_fields=[
                    'similarity_score',
                    'plagiarism_report_url',
                    'plagiarism_report_json',
                    'plagiarism_report_file',
                    'plagiarism_checked_at',
                ])

                report_payload_url = project.plagiarism_report_url or None
                if project.plagiarism_report_file:
                    report_payload_file_url = project.plagiarism_report_file.url
            except Exception as report_err:
                logger.warning(f"Similarity report generation failed: {report_err}")

        return Response({
            'similarity_score': hybrid_result['similarity_score'],
            'top_matches': hybrid_result['top_matches'],
            'method': hybrid_result['method'],
            'components': hybrid_result['components'],
            'winston_status': 'used' if winston_result.get('score') is not None else 'fallback_local_only',
            'winston_error': winston_result.get('error'),
            'message': 'Hybrid similarity check completed successfully' if hybrid_result['method'] == 'hybrid_local_winston' else 'Local similarity check completed (Winston unavailable)',
            'report_url': report_payload_url,
            'report_file_url': report_payload_file_url,
        })

    except Exception as e:
        import traceback
        logger.error(f"Error in similarity check: {e}\n{traceback.format_exc()}")
        return Response({'error': f'Failed to check similarity: {str(e)}'}, status=500)
    finally:
        try:
            if 'temp_file_path' in locals() and temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        except Exception:
            pass
