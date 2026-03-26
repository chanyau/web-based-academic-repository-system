"""
Management command to setup Gmail API authentication.
Run this command to authenticate with Google and generate the token file.
"""
import os
import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError

try:
    from google_auth_oauthlib.flow import InstalledAppFlow, Flow
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    GOOGLE_LIBS_AVAILABLE = True
except ImportError:
    GOOGLE_LIBS_AVAILABLE = False


class Command(BaseCommand):
    help = 'Setup Gmail API authentication for sending notification emails'
    
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']
    
    def get_paths(self):
        """Get paths for credentials and token files."""
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        return {
            'credentials': base_dir / 'credentials.json',
            'token': base_dir / 'gmail_token.json'
        }
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--check',
            action='store_true',
            help='Check if Gmail API is configured properly'
        )
        parser.add_argument(
            '--create-credentials',
            action='store_true',
            help='Create credentials.json from environment variables or input'
        )
    
    def handle(self, *args, **options):
        if not GOOGLE_LIBS_AVAILABLE:
            self.stderr.write(self.style.ERROR(
                'Required Google libraries not installed. Run:\n'
                'pip install google-auth google-auth-oauthlib google-api-python-client'
            ))
            return
        
        paths = self.get_paths()
        
        if options['check']:
            self.check_configuration(paths)
            return
        
        if options['create_credentials']:
            self.create_credentials_file(paths)
            return
        
        # Main setup flow
        self.setup_gmail(paths)
    
    def check_configuration(self, paths):
        """Check current Gmail API configuration status."""
        self.stdout.write('\n=== Gmail API Configuration Status ===\n')
        
        # Check credentials.json
        if paths['credentials'].exists():
            self.stdout.write(self.style.SUCCESS('✓ credentials.json found'))
        else:
            self.stdout.write(self.style.ERROR('✗ credentials.json NOT found'))
            self.stdout.write('  Run: python manage.py setup_gmail --create-credentials')
        
        # Check token file
        if paths['token'].exists():
            self.stdout.write(self.style.SUCCESS('✓ gmail_token.json found'))
            
            # Try to validate token
            try:
                creds = Credentials.from_authorized_user_file(
                    str(paths['token']), 
                    self.SCOPES
                )
                if creds.valid:
                    self.stdout.write(self.style.SUCCESS('✓ Token is valid'))
                elif creds.expired and creds.refresh_token:
                    self.stdout.write(self.style.WARNING('! Token expired but can be refreshed'))
                else:
                    self.stdout.write(self.style.ERROR('✗ Token is invalid'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Error reading token: {e}'))
        else:
            self.stdout.write(self.style.ERROR('✗ gmail_token.json NOT found'))
            self.stdout.write('  Run: python manage.py setup_gmail')
        
        self.stdout.write('')
    
    def create_credentials_file(self, paths):
        """Create credentials.json from user input."""
        self.stdout.write('\n=== Create credentials.json ===\n')
        self.stdout.write('Enter your Google OAuth2 credentials from Google Cloud Console.\n')
        
        # Check environment variables first
        client_id = os.getenv('GMAIL_CLIENT_ID')
        client_secret = os.getenv('GMAIL_CLIENT_SECRET')
        
        if client_id and client_secret:
            self.stdout.write('Found credentials in environment variables.')
            use_env = input('Use environment variables? (y/n): ').strip().lower()
            if use_env != 'y':
                client_id = None
                client_secret = None
        
        if not client_id:
            client_id = input('Client ID: ').strip()
        if not client_secret:
            client_secret = input('Client Secret: ').strip()
        
        if not client_id or not client_secret:
            self.stderr.write(self.style.ERROR('Client ID and Client Secret are required.'))
            return
        
        # Create the credentials.json structure
        credentials_data = {
            "installed": {
                "client_id": client_id,
                "project_id": "academic-repository",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_secret": client_secret,
                "redirect_uris": ["http://localhost"]
            }
        }
        
        # Save credentials.json
        with open(paths['credentials'], 'w') as f:
            json.dump(credentials_data, f, indent=2)
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Created {paths["credentials"]}'))
        self.stdout.write('\nNow run: python manage.py setup_gmail')
    
    def setup_gmail(self, paths):
        """Run the OAuth2 authentication flow."""
        self.stdout.write('\n=== Gmail API Setup ===\n')
        
        # Check for credentials.json
        if not paths['credentials'].exists():
            self.stderr.write(self.style.ERROR(
                f'credentials.json not found at {paths["credentials"]}\n'
                'Run: python manage.py setup_gmail --create-credentials'
            ))
            return
        
        try:
            # Start OAuth flow
            self.stdout.write('Starting OAuth2 authentication flow...\n')
            self.stdout.write('A browser window will open for Google authentication.\n')
            
            flow = InstalledAppFlow.from_client_secrets_file(
                str(paths['credentials']),
                self.SCOPES
            )
            
            # Use run_local_server with port=0 to auto-find available port
            # This works with loopback redirect URIs
            creds = flow.run_local_server(
                port=0,  # Auto-find available port
                authorization_prompt_message='Please visit this URL: {url}',
                success_message='Authentication successful! You can close this window.',
                open_browser=True
            )
            
            # Save the token
            with open(paths['token'], 'w') as token:
                token.write(creds.to_json())
            
            self.stdout.write(self.style.SUCCESS('\n✓ Authentication successful!'))
            self.stdout.write(self.style.SUCCESS(f'✓ Token saved to {paths["token"]}'))
            self.stdout.write('\nGmail API is now configured. Notification emails will be sent via Gmail.')
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'\nAuthentication failed: {e}'))
            self.stdout.write('\nTroubleshooting:')
            self.stdout.write('1. Make sure credentials.json has the correct client_id and client_secret')
            self.stdout.write('2. Check that your Google Cloud project has Gmail API enabled')
            self.stdout.write('3. Verify OAuth consent screen is configured')
            self.stdout.write('4. Add http://localhost/ to Authorized redirect URIs in Google Cloud Console')
