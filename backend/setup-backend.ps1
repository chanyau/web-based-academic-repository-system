# Navigate to backend
Set-Location "C:\Users\HP\Desktop\ropa project\backend\backend_project"

# Activate virtual environment
& .\.venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
python -m pip install -r requirements.txt

# Create media directories
Write-Host "Creating media directories..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path "media" | Out-Null
New-Item -ItemType Directory -Force -Path "media\projects" | Out-Null

# Check if migrations needed
Write-Host "Checking migrations..." -ForegroundColor Green
python manage.py makemigrations

# Apply migrations
Write-Host "Applying migrations..." -ForegroundColor Green
python manage.py migrate

Write-Host "`n✅ Backend setup complete!" -ForegroundColor Green
Write-Host "Run 'python manage.py runserver' to start the backend." -ForegroundColor Yellow
