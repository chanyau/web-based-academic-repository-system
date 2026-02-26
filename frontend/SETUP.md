# Setup and Testing Guide

This guide will help you set up and test the integrated Academic Repository System.

## Prerequisites

1. **Java 21** - Install from [Oracle](https://www.oracle.com/java/technologies/downloads/#java21) or [OpenJDK](https://openjdk.org/)
2. **Maven 3.8+** - Install from [Maven](https://maven.apache.org/download.cgi)
3. **MySQL 8.0+** - Install from [MySQL](https://dev.mysql.com/downloads/mysql/)
4. **Node.js 18+** - Install from [Node.js](https://nodejs.org/)
5. **AWS Account** (optional) - For S3 storage, or use MinIO for local development

## Backend Setup

### 1. Configure Database

```sql
CREATE DATABASE academic_repository;
```

### 2. Update Backend Configuration

Edit `backend/src/main/resources/application.properties`:

```properties
# Update these with your MySQL credentials
spring.datasource.username=root
spring.datasource.password=your_password

# For local development without AWS S3, you can comment out S3 config
# The system will work without S3, but file uploads won't be stored
```

### 3. Build and Start Backend

```bash
cd backend
mvn clean install
mvn spring-boot:run
```

The backend will start on `http://localhost:8080`

**Verify Backend:**
- Open http://localhost:8080/swagger-ui.html (if Swagger is enabled)
- Or test: `curl http://localhost:8080/api/auth/login` (should return 400, which is expected)

## Frontend Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API URL (Optional)

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8080/api
```

If you don't create this file, it defaults to `http://localhost:8080/api`

### 3. Start Frontend

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

## Testing the System

### 1. Register a New User

1. Open http://localhost:5173
2. Click "Register here" or go to `/register`
3. Fill in the form:
   - Name: Your Name
   - Email: test@example.com
   - Password: password123
   - Role: Student (or Faculty/Admin)
   - Faculty: Computer Science
   - Department: Software Engineering
4. Click "Create Account"

### 2. Login

1. Go to `/login`
2. Enter your email and password
3. You should be redirected to the dashboard

### 3. Test Project Submission (Student)

1. As a student, go to `/submit`
2. Fill in project details
3. Upload a file (optional)
4. Submit the project

### 4. Test Review (Faculty/Admin)

1. Login as faculty or admin
2. Go to `/review`
3. Review submitted projects
4. Approve or request revisions

### 5. Test Analytics (Admin Only)

1. Login as admin
2. Go to `/analytics`
3. View system analytics

## Troubleshooting

### Backend Won't Start

1. **Database Connection Error:**
   - Verify MySQL is running: `mysql -u root -p`
   - Check credentials in `application.properties`
   - Ensure database `academic_repository` exists

2. **Port Already in Use:**
   - Change port in `application.properties`: `server.port=8081`
   - Update frontend `.env`: `VITE_API_URL=http://localhost:8081/api`

3. **Maven Build Fails:**
   - Ensure Java 21 is installed: `java -version`
   - Clean Maven cache: `mvn clean`

### Frontend Can't Connect to Backend

1. **CORS Error:**
   - Verify backend CORS config in `SecurityConfig.java`
   - Check frontend URL is in allowed origins

2. **401 Unauthorized:**
   - Check if token is being sent in requests
   - Verify JWT secret in backend matches

3. **404 Not Found:**
   - Verify backend is running on correct port
   - Check API URL in frontend `.env` file

### Database Issues

1. **Liquibase Migration Errors:**
   - Drop and recreate database
   - Or manually run SQL scripts from `backend/src/main/resources/db/changelog/`

2. **Table Already Exists:**
   - Set `spring.jpa.hibernate.ddl-auto=update` temporarily
   - Or drop tables manually

## Quick Start Scripts

### Windows (PowerShell)

**Start Backend:**
```powershell
cd backend
mvn spring-boot:run
```

**Start Frontend (new terminal):**
```powershell
npm run dev
```

### Linux/Mac

**Start Backend:**
```bash
cd backend && mvn spring-boot:run
```

**Start Frontend (new terminal):**
```bash
npm run dev
```

## API Testing with curl

### Register User
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "STUDENT",
    "faculty": "Computer Science",
    "department": "Software Engineering"
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the token from response and use it:

### Get Projects (with token)
```bash
curl -X GET http://localhost:8080/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Next Steps

1. **Configure AWS S3** (optional):
   - Set up S3 bucket
   - Configure AWS credentials
   - Update `application.properties`

2. **Set up AI/ML Service** (optional):
   - Deploy similarity detection service
   - Update `ai.service.url` in `application.properties`

3. **Production Deployment**:
   - Change JWT secret
   - Configure production database
   - Set up HTTPS
   - Configure production CORS

## Support

For issues or questions, check:
- Backend logs: Check console output when running `mvn spring-boot:run`
- Frontend logs: Check browser console (F12)
- Database logs: Check MySQL error logs


