from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_project_plagiarism_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='project',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending'), ('plagiarism_checking', 'Plagiarism Checking'), ('plagiarism_completed', 'Plagiarism Completed'), ('under_review', 'Under Review'), ('revision_requested', 'Revision Requested'), ('approved', 'Approved'), ('archived', 'Archived')], default='pending', max_length=32),
        ),
        migrations.AlterField(
            model_name='project',
            name='workflow_status',
            field=models.CharField(choices=[('proposal_submitted', 'PROPOSAL_SUBMITTED'), ('proposal_approved', 'PROPOSAL_APPROVED'), ('proposal_rejected', 'PROPOSAL_REJECTED'), ('proposal_revision', 'PROPOSAL_REVISION'), ('in_progress', 'IN_PROGRESS'), ('interim_evaluated', 'INTERIM_EVALUATED'), ('final_submitted', 'FINAL_SUBMITTED'), ('plagiarism_checking', 'PLAGIARISM_CHECKING'), ('plagiarism_completed', 'PLAGIARISM_COMPLETED'), ('plagiarism_flagged', 'PLAGIARISM_FLAGGED'), ('plagiarism_passed', 'PLAGIARISM_PASSED'), ('approved', 'APPROVED'), ('final_revision', 'FINAL_REVISION'), ('rejected', 'REJECTED'), ('archived', 'ARCHIVED')], default='proposal_submitted', max_length=32),
        ),
    ]
