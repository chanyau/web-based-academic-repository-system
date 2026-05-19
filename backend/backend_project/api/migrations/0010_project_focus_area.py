from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_plagiarism_completed_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='focus_area',
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
