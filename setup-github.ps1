# 🚀 Safe GitHub Setup Script for Synthetic Data Generator (Windows)
# This script creates a clean copy for GitHub without affecting your main project

Write-Host "🚀 Setting up GitHub repository safely..." -ForegroundColor Green
Write-Host "⚠️  This will create a SEPARATE copy for GitHub - your main project is safe!" -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ Error: Please run this script from your main project directory" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Red
    exit 1
}

# Create GitHub directory (outside main project)
$GITHUB_DIR = "..\synthetic-data-generator-github"
Write-Host "📁 Creating GitHub directory: $GITHUB_DIR" -ForegroundColor Cyan

# Remove existing GitHub directory if it exists
if (Test-Path $GITHUB_DIR) {
    Write-Host "🗑️  Removing existing GitHub directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $GITHUB_DIR
}

# Create new directory
New-Item -ItemType Directory -Path $GITHUB_DIR -Force | Out-Null
Set-Location $GITHUB_DIR

Write-Host "📋 Copying essential files for GitHub..." -ForegroundColor Cyan

# Copy only the essential files
Copy-Item -Recurse "..\synthetic-data-generator\frontend" .
Copy-Item -Recurse "..\synthetic-data-generator\n8n-workflows" .
Copy-Item -Recurse "..\synthetic-data-generator\database" .
Copy-Item "..\synthetic-data-generator\docker-compose.yml" .
Copy-Item "..\synthetic-data-generator\Dockerfile" .
Copy-Item "..\synthetic-data-generator\nginx.conf" .
Copy-Item "..\synthetic-data-generator\README.md" .
Copy-Item "..\synthetic-data-generator\DEPLOYMENT.md" .
Copy-Item "..\synthetic-data-generator\.gitignore" .
Copy-Item "..\synthetic-data-generator\requirements.txt" .

Write-Host "✅ Files copied successfully!" -ForegroundColor Green
Write-Host ""

# Initialize git repository
Write-Host "🔧 Initializing Git repository..." -ForegroundColor Cyan
git init
git add .
git commit -m "Initial commit: Synthetic Data Generator v2.2.0

Features:
- AI-powered data generation with Ollama
- Schema Builder with drag-and-drop interface
- Multiple export formats (CSV, Excel, JSON, XML, SQL)
- Vector database integration with Qdrant
- Modern responsive UI
- Docker-ready deployment"

Write-Host "✅ Git repository initialized!" -ForegroundColor Green
Write-Host ""

# Add GitHub remote
Write-Host "🔗 Adding GitHub remote..." -ForegroundColor Cyan
git remote add origin https://github.com/shazily/syntheticdatagen.git

Write-Host "✅ GitHub remote added!" -ForegroundColor Green
Write-Host ""

# Show what will be pushed
Write-Host "📋 Files that will be uploaded to GitHub:" -ForegroundColor Cyan
git ls-files | Select-Object -First 20
$fileCount = (git ls-files | Measure-Object).Count
if ($fileCount -gt 20) {
    Write-Host "... and $($fileCount - 20) more files" -ForegroundColor Gray
}
Write-Host ""

# Show what's excluded by .gitignore
Write-Host "🔒 Files excluded by .gitignore:" -ForegroundColor Cyan
Write-Host "   - frontend-v3/ (development files)" -ForegroundColor Gray
Write-Host "   - frontend-v2/ (backup files)" -ForegroundColor Gray
Write-Host "   - generated_data/ (your generated data)" -ForegroundColor Gray
Write-Host "   - logs/ (log files)" -ForegroundColor Gray
Write-Host "   - qdrant_storage/ (vector database)" -ForegroundColor Gray
Write-Host "   - ssl/ (SSL certificates)" -ForegroundColor Gray
Write-Host "   - Any temporary or backup files" -ForegroundColor Gray
Write-Host ""

# Ask for confirmation
Write-Host "🚀 Ready to push to GitHub!" -ForegroundColor Green
Write-Host "   Repository: https://github.com/shazily/syntheticdatagen.git" -ForegroundColor Cyan
Write-Host ""
$confirmation = Read-Host "Do you want to push to GitHub now? (y/N)"

if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    Write-Host "📤 Pushing to GitHub..." -ForegroundColor Cyan
    git branch -M main
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
        Write-Host "🌐 Your repository is now available at:" -ForegroundColor Cyan
        Write-Host "   https://github.com/shazily/syntheticdatagen" -ForegroundColor Blue
    } else {
        Write-Host "❌ Failed to push to GitHub. Please check your GitHub credentials." -ForegroundColor Red
        Write-Host "   You can try again later with:" -ForegroundColor Yellow
        Write-Host "   cd $GITHUB_DIR" -ForegroundColor Gray
        Write-Host "   git push origin main" -ForegroundColor Gray
    }
} else {
    Write-Host "⏸️  Skipped pushing to GitHub." -ForegroundColor Yellow
    Write-Host "   You can push later with:" -ForegroundColor Yellow
    Write-Host "   cd $GITHUB_DIR" -ForegroundColor Gray
    Write-Host "   git push origin main" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🎉 GitHub setup complete!" -ForegroundColor Green
Write-Host "📁 GitHub files are in: $GITHUB_DIR" -ForegroundColor Cyan
Write-Host "🔒 Your main project files are completely safe!" -ForegroundColor Green
Write-Host ""
Write-Host "To update GitHub in the future:" -ForegroundColor Yellow
Write-Host "   cd $GITHUB_DIR" -ForegroundColor Gray
Write-Host "   # Copy updated files from main project" -ForegroundColor Gray
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Update: [describe changes]'" -ForegroundColor Gray
Write-Host "   git push origin main" -ForegroundColor Gray
