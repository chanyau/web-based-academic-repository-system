from rest_framework import serializers
from .models import User, Project, Message
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import logging

logger = logging.getLogger(__name__)

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'faculty', 'department', 'admitted')
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
            from .nlp_utils import extract_keywords_from_project
            
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
        return super().update(instance, validated_data)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
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
