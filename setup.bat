@echo off
setlocal enabledelayedexpansion

REM Synthetic Data Generator Setup Script for Windows
REM This script sets up the complete environment for the Synthetic Data Generator

echo 🚀 Setting up Synthetic Data Generator...

REM Check if Docker is installed
echo [INFO] Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    echo [INFO] Visit: https://docs.docker.com/desktop/windows/
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Desktop first.
    echo [INFO] Visit: https://docs.docker.com/desktop/windows/
    pause
    exit /b 1
)

echo [SUCCESS] Docker and Docker Compose are installed

REM Check if Ollama is installed
echo [INFO] Checking Ollama installation...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Ollama is not installed. The application will work with fallback schema generation.
    echo [INFO] To install Ollama:
    echo [INFO]   Download from: https://ollama.ai/download
    echo [INFO]   ollama pull llama2
    echo [INFO]   ollama serve
) else (
    echo [SUCCESS] Ollama is installed
    
    REM Check if Ollama is running
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Ollama is installed but not running. Start it with: ollama serve
    ) else (
        echo [SUCCESS] Ollama service is running
    )
)

REM Create necessary directories
echo [INFO] Creating necessary directories...
if not exist uploads mkdir uploads
if not exist generated_data mkdir generated_data
if not exist logs mkdir logs
if not exist ssl mkdir ssl
echo [SUCCESS] Directories created

REM Set up environment file
echo [INFO] Setting up environment configuration...
if not exist .env (
    copy env.example .env >nul
    echo [SUCCESS] Environment file created from template
    
    REM Generate a random secret key (simple version)
    set SECRET_KEY=%RANDOM%%RANDOM%%RANDOM%
    powershell -Command "(Get-Content .env) -replace 'your-secret-key-here', '%SECRET_KEY%' | Set-Content .env"
    echo [SUCCESS] Secret key generated
) else (
    echo [WARNING] Environment file already exists, skipping...
)

REM Pull Docker images
echo [INFO] Pulling Docker images...
docker-compose pull
if errorlevel 1 (
    echo [ERROR] Failed to pull Docker images
    pause
    exit /b 1
)
echo [SUCCESS] Docker images pulled

REM Build application
echo [INFO] Building application...
docker-compose build
if errorlevel 1 (
    echo [ERROR] Failed to build application
    pause
    exit /b 1
)
echo [SUCCESS] Application built

REM Start services
echo [INFO] Starting services...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Failed to start services
    pause
    exit /b 1
)
echo [SUCCESS] Services started

REM Wait for services to be ready
echo [INFO] Waiting for services to be ready...

REM Wait for database
echo [INFO] Waiting for database...
set /a timeout=60
:wait_db
if %timeout% leq 0 (
    echo [ERROR] Database failed to start within 60 seconds
    pause
    exit /b 1
)
docker-compose exec -T db pg_isready -U postgres >nul 2>&1
if not errorlevel 1 (
    goto db_ready
)
timeout /t 2 /nobreak >nul
set /a timeout-=2
goto wait_db

:db_ready
echo [SUCCESS] Database is ready

REM Wait for web application
echo [INFO] Waiting for web application...
set /a timeout=60
:wait_web
if %timeout% leq 0 (
    echo [ERROR] Web application failed to start within 60 seconds
    pause
    exit /b 1
)
curl -s http://localhost:8080 >nul 2>&1
if not errorlevel 1 (
    goto web_ready
)
timeout /t 2 /nobreak >nul
set /a timeout-=2
goto wait_web

:web_ready
echo [SUCCESS] Web application is ready

REM Run database migrations
echo [INFO] Running database migrations...
docker-compose exec web python -c "from app import app, db; app.app_context().push(); db.create_all(); print('Database tables created')"
echo [SUCCESS] Database migrations completed

REM Display final information
echo.
echo 🎉 Setup completed successfully!
echo.
echo 📍 Access your application:
echo    Local:  http://localhost:8080
echo    Docker: http://localhost (with nginx)
echo.
echo 🔧 Useful commands:
echo    View logs:      docker-compose logs -f
echo    Stop services:  docker-compose down
echo    Restart:        docker-compose restart
echo    Update:         docker-compose pull ^&^& docker-compose up -d
echo.
echo 📚 Documentation:
echo    README.md - Complete usage guide
echo    API endpoints available at /api/
echo.

ollama --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Ollama not installed - install for AI-powered features:
    echo    Download from: https://ollama.ai/download
    echo    ollama pull llama2
    echo    ollama serve
    echo.
)

echo 🚀 Happy data generating!
pause
