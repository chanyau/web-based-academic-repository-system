from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from .models import Project, Message
from .serializers import UserSerializer, ProjectSerializer, CustomTokenObtainPairSerializer, MessageSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from datetime import datetime

User = get_user_model()

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

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, status='pending')

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
            return Response({
                'status': 'under_review',
                'message': 'Project approved by supervisor. Awaiting admin to publish.',
                'feedback': feedback
            })
        elif request.user.role == 'admin':
            # Admin can also approve directly (publish)
            project.status = 'approved'
            project.save()
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
@permission_classes([permissions.IsAuthenticated])
def extract_keywords(request):
    """
    Extract keywords from abstract text using AI/NLP.
    This endpoint can be called by students during project submission
    to get keyword suggestions based on their abstract.
    """
    abstract = request.data.get('abstract', '')
    existing_keywords = request.data.get('existing_keywords', [])
    
    if not abstract or len(abstract.strip()) < 50:
        return Response({
            'error': 'Abstract must be at least 50 characters long',
            'keywords': []
        }, status=400)
    
    try:
        from .nlp_utils import extract_keywords_from_project, suggest_keywords
        
        # Extract keywords from abstract
        keywords = extract_keywords_from_project(abstract, file_path=None, top_n=10)
        
        # If user already has some keywords, suggest additional ones
        if existing_keywords:
            suggestions = suggest_keywords(abstract, existing_keywords, top_n=5)
            return Response({
                'keywords': keywords,
                'suggestions': suggestions,
                'message': 'Keywords extracted successfully'
            })
        
        return Response({
            'keywords': keywords,
            'message': 'Keywords extracted successfully'
        })
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error extracting keywords: {e}")
        return Response({
            'error': 'Failed to extract keywords. Please try again or enter keywords manually.',
            'keywords': []
        }, status=500)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
