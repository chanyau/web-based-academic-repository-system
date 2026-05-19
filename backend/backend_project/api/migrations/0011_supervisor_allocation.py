from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_project_focus_area'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='supervisor',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'role': 'lecturer'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='supervisees',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='SupervisorAllocationState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('faculty', models.CharField(max_length=255, unique=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_assigned_lecturer', models.ForeignKey(
                    blank=True,
                    limit_choices_to={'role': 'lecturer'},
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='allocation_states',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
