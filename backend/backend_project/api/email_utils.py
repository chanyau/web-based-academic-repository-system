"""
Email notification utilities for the Academic Repository system.
Handles sending notifications for project submissions, approvals, rejections, and messages.
Uses Gmail API for sending emails.
"""
from django.conf import settings
import logging
import os
import mimetypes

# Import Gmail service
from .gmail_service import send_gmail

logger = logging.getLogger(__name__)

# Check if Gmail API is enabled
USE_GMAIL_API = os.getenv('USE_GMAIL_API', 'true').strip().lower() in ('1', 'true', 'yes', 'on')


def _send_via_smtp(to_email, subject, message, html_message=None, attachments=None):
    from django.core.mail import EmailMultiAlternatives

    if isinstance(to_email, str):
        to_email = [to_email]

    email = EmailMultiAlternatives(
        subject=subject,
        body=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to_email,
    )

    if html_message:
        email.attach_alternative(html_message, 'text/html')

    if attachments:
        for attachment in attachments:
            filename = attachment.get('filename')
            content = attachment.get('content')
            mime_type = attachment.get('mime_type') or 'application/octet-stream'

            if not filename or content is None:
                continue

            email.attach(filename, content, mime_type)

    email.send(fail_silently=False)
    logger.info(f"SMTP: Email sent successfully to {to_email}")
    return True


def send_notification_email(to_email, subject, message, html_message=None, attachments=None):
    """
    Send a notification email using Gmail API.
    
    Args:
        to_email: Recipient email address (string or list)
        subject: Email subject
        message: Plain text message
        html_message: Optional HTML message
    """
    try:
        if isinstance(to_email, str):
            to_email = [to_email]
        
        if USE_GMAIL_API:
            # Use Gmail API
            success = send_gmail(
                to_email=to_email,
                subject=subject,
                body=message,
                html_body=html_message,
                attachments=attachments,
            )
            if success:
                logger.info(f"Gmail API: Email sent successfully to {to_email}")
                return True

            logger.warning(f"Gmail API: Failed to send email to {to_email}. Falling back to SMTP.")
            return _send_via_smtp(to_email, subject, message, html_message, attachments)
        else:
            return _send_via_smtp(to_email, subject, message, html_message, attachments)
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def notify_supervisor_plagiarism_report(project, similarity_score=None, report_attachment=None, final_doc_attachment=None):
    supervisor = project.supervisor
    student = project.owner

    if not supervisor or not supervisor.email:
        return

    subject = f"Plagiarism Report Ready: {project.title}"
    similarity_line = f"Similarity score: {similarity_score}%" if similarity_score is not None else "Similarity score: N/A"

    message = f"""
Dear {supervisor.first_name or supervisor.username},

The plagiarism report for "{project.title}" is ready.

Project Details:
- Student: {student.first_name} {student.last_name} ({student.email})
- Faculty: {project.faculty}
- Department: {project.department}
- Type: {project.type}
- {similarity_line}

The final document and the plagiarism report are attached to this email.

Best regards,
Academic Repository System
    """.strip()

    attachments = []
    if report_attachment:
        attachments.append(report_attachment)
    if final_doc_attachment:
        attachments.append(final_doc_attachment)

    send_notification_email(
        supervisor.email,
        subject,
        message,
        attachments=attachments or None,
    )


def notify_project_submission(project):
    """
    Notify supervisor and student when a new project is submitted.
    """
    student = project.owner
    supervisor = project.supervisor
    
    # Email to student (confirmation)
    if student and student.email:
        student_subject = f"Project Submitted: {project.title}"
        student_message = f"""
Dear {student.first_name or student.username},

Your project "{project.title}" has been successfully submitted to the Academic Repository.

Project Details:
- Title: {project.title}
- Faculty: {project.faculty}
- Department: {project.department}
- Status: Pending Review

{f'Your supervisor {supervisor.first_name} {supervisor.last_name} has been notified and will review your submission.' if supervisor else 'A supervisor will be assigned to review your submission.'}

You can track the status of your project in your dashboard.

Best regards,
Academic Repository System
        """.strip()
        
        send_notification_email(student.email, student_subject, student_message)
    
    # Email to supervisor (new submission alert)
    if supervisor and supervisor.email:
        supervisor_subject = f"New Project Submission: {project.title}"
        supervisor_message = f"""
Dear {supervisor.first_name or supervisor.username},

A new project has been submitted for your review.

Project Details:
- Title: {project.title}
- Student: {student.first_name} {student.last_name} ({student.email})
- Faculty: {project.faculty}
- Department: {project.department}
- Type: {project.type}

Abstract:
{project.abstract[:500]}{'...' if len(project.abstract) > 500 else ''}

Please log in to the Academic Repository to review this submission.

Best regards,
Academic Repository System
        """.strip()
        
        send_notification_email(supervisor.email, supervisor_subject, supervisor_message)


def notify_project_approved(project, feedback=None):
    """
    Notify student when their project is approved.
    """
    student = project.owner
    supervisor = project.supervisor
    
    if student and student.email:
        subject = f"Project Approved: {project.title}"
        message = f"""
Dear {student.first_name or student.username},

Congratulations! Your project "{project.title}" has been approved.

{f'Feedback from your supervisor ({supervisor.first_name} {supervisor.last_name}):' if supervisor and feedback else ''}
{feedback if feedback else ''}

Your project is now visible in the public repository and can be accessed by other users.

Best regards,
Academic Repository System
        """.strip()
        
        send_notification_email(student.email, subject, message)


def notify_project_rejected(project, feedback=None):
    """
    Notify student when their project is rejected or needs revision.
    """
    student = project.owner
    supervisor = project.supervisor
    
    if student and student.email:
        subject = f"Revision Requested: {project.title}"
        message = f"""
Dear {student.first_name or student.username},

Your project "{project.title}" requires revisions.

{f'Feedback from your supervisor ({supervisor.first_name} {supervisor.last_name}):' if supervisor else 'Feedback:'}
{feedback if feedback else 'Please contact your supervisor for details.'}

Please log in to the Academic Repository, make the necessary changes, and resubmit your project.

Best regards,
Academic Repository System
        """.strip()
        
        send_notification_email(student.email, subject, message)


def notify_new_message(message):
    """
    Notify recipient when they receive a new chat message.
    
    Args:
        message: Message model instance
    """
    project = message.project
    sender = message.sender
    
    # Determine recipient based on sender role
    if sender.role == 'lecturer':
        # Lecturer sent message, notify student
        recipient = project.owner
    else:
        # Student sent message, notify lecturer
        recipient = project.supervisor
    
    if recipient and recipient.email:
        subject = f"New Message: {project.title}"
        msg_content = f"""
Dear {recipient.first_name or recipient.username},

You have received a new message regarding the project "{project.title}".

From: {sender.first_name} {sender.last_name}
Message:
{message.content}

Please log in to the Academic Repository to reply.

Best regards,
Academic Repository System
        """.strip()
        
        send_notification_email(recipient.email, subject, msg_content)


def notify_stage_due_date(student, supervisor, project, stage_label, due_date, note=None):
    if not student or not student.email:
        return False

    supervisor_name = None
    if supervisor:
        supervisor_name = f"{supervisor.first_name} {supervisor.last_name}".strip() or supervisor.username

    subject = f"Due Date Reminder: {stage_label}"
    note_block = f"\nNote from your supervisor:\n{note}\n" if note else ""

    message = f"""
Dear {student.first_name or student.username},

Your supervisor has set a due date for your project stage.

Project: {project.title}
Stage: {stage_label}
Due date: {due_date}
Supervisor: {supervisor_name or 'Supervisor'}
{note_block}
Please log in to the Academic Repository to submit your work before the due date.

Best regards,
Academic Repository System
    """.strip()

    return send_notification_email(student.email, subject, message)


def notify_supervisor_message(student, supervisor, project, content):
    if not student or not student.email:
        return False

    supervisor_name = None
    if supervisor:
        supervisor_name = f"{supervisor.first_name} {supervisor.last_name}".strip() or supervisor.username

    subject = f"Message from your supervisor: {project.title}"
    message = f"""
Dear {student.first_name or student.username},

You received a message from your supervisor regarding "{project.title}".

Supervisor: {supervisor_name or 'Supervisor'}

Message:
{content}

Please log in to the Academic Repository to reply if needed.

Best regards,
Academic Repository System
    """.strip()

    return send_notification_email(student.email, subject, message)


def notify_project_under_review(project, feedback=None):
    """
    Notify student when their project is moved to under review status (lecturer approved, awaiting admin).
    """
    student = project.owner
    supervisor = project.supervisor
    
    if student and student.email:
        subject = f"Project Under Review: {project.title}"
        message = f"""
Dear {student.first_name or student.username},

Your project "{project.title}" has been approved by your supervisor and is now under final review.

{f'Feedback from {supervisor.first_name} {supervisor.last_name}:' if supervisor and feedback else ''}
{feedback if feedback else ''}

Your project is awaiting final approval from the administrator before being published.

Best regards,
Academic Repository System
        """.strip()
        
        send_notification_email(student.email, subject, message)


def notify_admin_project_ready_for_review(project, feedback=None):
    """
    Notify all system admins when a supervisor approves a project.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    admins = User.objects.filter(role='admin').exclude(email__isnull=True).exclude(email='')

    if not admins.exists():
        return

    recipient_emails = list(admins.values_list('email', flat=True))
    student = project.owner
    supervisor = project.supervisor

    subject = f"Project Awaiting Admin Review: {project.title}"
    message = f"""
Dear System Administrator,

The project "{project.title}" has been approved by the assigned supervisor and is now awaiting your final review/publishing decision.

Project Details:
- Title: {project.title}
- Student: {student.first_name} {student.last_name} ({student.email})
- Supervisor: {supervisor.first_name} {supervisor.last_name} ({supervisor.email})
- Faculty: {project.faculty}
- Department: {project.department}
- Current Status: Under Review

{f'Supervisor feedback: {feedback}' if feedback else ''}

Please log in to the Academic Repository Admin Panel to complete the final review.

Best regards,
Academic Repository System
    """.strip()

    send_notification_email(recipient_emails, subject, message)
