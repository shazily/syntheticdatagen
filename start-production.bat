@echo off

REM Production startup script for Synthetic Data Generator
REM This script starts the application in production mode with external access

echo 🚀 Starting Synthetic Data Generator in Production Mode...

REM Check if .env exists
if not exist .env (
    echo [ERROR] Environment file not found. Please run setup.bat first.
    pause
    exit /b 1
)

REM Start services with production configuration
echo [INFO] Starting production services...
docker-compose -f docker-compose.yml up -d

REM Wait for services
echo [INFO] Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check if services are running
curl -s http://localhost:8080 >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Services failed to start properly
    echo [INFO] Check logs with: docker-compose logs
    pause
    exit /b 1
)

echo.
echo 🎉 Production server started successfully!
echo.
echo 📍 Access your application:
echo    Local:  http://localhost:8080
echo    External: http://localhost (nginx)
echo.
echo 🔧 Management commands:
echo    View logs:      docker-compose logs -f
echo    Stop services:  docker-compose down
echo    Restart:        docker-compose restart
echo.
echo 📊 Monitor services:
echo    docker-compose ps
echo    docker stats
echo.
echo 🚀 Your synthetic data generator is ready for external access!
echo.
pause
