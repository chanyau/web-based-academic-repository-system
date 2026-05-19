"""
Gmail API Service for sending email notifications.
Uses OAuth2 for authentication with the Gmail API.
"""
import os
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Gmail API scopes - only need send permission
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

# Get the base directory (backend_project folder)
BASE_DIR = Path(__file__).resolve().parent.parent

# Path to credentials and token files
CREDENTIALS_FILE = BASE_DIR / 'credentials.json'
TOKEN_FILE = BASE_DIR / 'gmail_token.json'


def get_gmail_service():
    """
    Get an authenticated Gmail API service.
    
    Returns:
        Gmail API service object or None if authentication fails.
    """
    creds = None
    
    # Check if token file exists with saved credentials
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception as e:
            logger.error(f"Error loading saved credentials: {e}")
            creds = None
    
    # If no valid credentials, try to refresh or re-authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Save refreshed credentials
                with open(TOKEN_FILE, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                error_message = str(e)
                if 'invalid_grant' in error_message.lower():
                    logger.error("Gmail token has been revoked or expired permanently. Delete token and run 'python manage.py setup_gmail' to re-authenticate.")
                    try:
                        if TOKEN_FILE.exists():
                            TOKEN_FILE.unlink()
                    except Exception as delete_error:
                        logger.warning(f"Unable to delete invalid Gmail token: {delete_error}")
                else:
                    logger.error(f"Error refreshing credentials: {e}")
                return None
        else:
            # No valid credentials available - need to run setup
            logger.error("No valid Gmail credentials. Run 'python manage.py setup_gmail' to authenticate.")
            return None
    
    try:
        service = build('gmail', 'v1', credentials=creds)
        return service
    except Exception as e:
        logger.error(f"Error building Gmail service: {e}")
        return None


def create_message(to_email, subject, body, html_body=None, attachments=None):
    """
    Create an email message.
    
    Args:
        to_email: Recipient email address (string or list)
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
    
    Returns:
        Encoded message dict for Gmail API
    """
    if isinstance(to_email, list):
        to_email = ', '.join(to_email)
    
    message = MIMEMultipart('mixed')
    message['to'] = to_email
    message['subject'] = subject

    alternative = MIMEMultipart('alternative')
    alternative.attach(MIMEText(body, 'plain'))
    if html_body:
        alternative.attach(MIMEText(html_body, 'html'))
    message.attach(alternative)

    if attachments:
        for attachment in attachments:
            filename = attachment.get('filename')
            content = attachment.get('content')
            mime_type = attachment.get('mime_type') or 'application/octet-stream'

            if not filename or content is None:
                continue

            main_type, _, sub_type = mime_type.partition('/')
            part = MIMEBase(main_type or 'application', sub_type or 'octet-stream')
            part.set_payload(content)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
            message.attach(part)
    
    # Encode the message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    return {'raw': raw_message}


def send_gmail(to_email, subject, body, html_body=None, attachments=None):
    """
    Send an email using Gmail API.
    
    Args:
        to_email: Recipient email address (string or list)
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
    
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        service = get_gmail_service()
        if not service:
            logger.error("Could not get Gmail service. Email not sent.")
            return False
        
        message = create_message(to_email, subject, body, html_body, attachments)
        
        # Send the message
        result = service.users().messages().send(
            userId='me',
            body=message
        ).execute()
        
        logger.info(f"Email sent successfully. Message ID: {result.get('id')}")
        return True
        
    except HttpError as error:
        logger.error(f"Gmail API error: {error}")
        return False
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return False


def check_gmail_configured():
    """
    Check if Gmail API is properly configured.
    
    Returns:
        dict with status information
    """
    status = {
        'credentials_exist': CREDENTIALS_FILE.exists(),
        'token_exist': TOKEN_FILE.exists(),
        'service_available': False,
        'message': ''
    }
    
    if not status['credentials_exist']:
        status['message'] = 'credentials.json not found. Download it from Google Cloud Console.'
        return status
    
    if not status['token_exist']:
        status['message'] = 'Not authenticated. Run "python manage.py setup_gmail" to authenticate.'
        return status
    
    # Try to get service
    service = get_gmail_service()
    status['token_exist'] = TOKEN_FILE.exists()
    if service:
        status['service_available'] = True
        status['message'] = 'Gmail API is properly configured and ready to send emails.'
    else:
        if status['token_exist']:
            status['message'] = 'Token exists but service unavailable. Try re-running setup.'
        else:
            status['message'] = 'Token is missing/invalid. Run "python manage.py setup_gmail" to authenticate again.'
    
    return status
