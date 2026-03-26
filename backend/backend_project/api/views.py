from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from .models import Project, Message
from .serializers import UserSerializer, ProjectSerializer, CustomTokenObtainPairSerializer, MessageSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from datetime import datetime
import os
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
import logging
from .email_utils import (
    notify_project_submission,
    notify_project_approved,
    notify_project_rejected,
    notify_new_message,
    notify_project_under_review,
    notify_admin_project_ready_for_review
)

User = get_user_model()
logger = logging.getLogger(__name__)

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
            
        return queryset.order_by('-submitted_at')
    
    def retrieve(self, request, *args, **kwargs):
        """Get a single project and increment view count"""
        instance = self.get_object()
        # Increment view count
        instance.views = (instance.views or 0) + 1
        instance.save(update_fields=['views'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        project = serializer.save(owner=self.request.user, status='pending')
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
                raise permissions.PermissionDenied("You can only edit your own projects")
            if project.status not in ['pending', 'revision_requested']:
                raise permissions.PermissionDenied("You can only edit pending or revision-requested projects")
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
            messages = project.messages.all()
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
                import logging
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

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
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
        return Response({
            'error': 'Please upload a document to extract keywords',
            'keywords': []
        }, status=400)
    
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

        return Response({
            'similarity_score': hybrid_result['similarity_score'],
            'top_matches': hybrid_result['top_matches'],
            'method': hybrid_result['method'],
            'components': hybrid_result['components'],
            'winston_status': 'used' if winston_result.get('score') is not None else 'fallback_local_only',
            'winston_error': winston_result.get('error'),
            'message': 'Hybrid similarity check completed successfully' if hybrid_result['method'] == 'hybrid_local_winston' else 'Local similarity check completed (Winston unavailable)'
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
