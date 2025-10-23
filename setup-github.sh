#!/bin/bash

# 🚀 Safe GitHub Setup Script for Synthetic Data Generator
# This script creates a clean copy for GitHub without affecting your main project

echo "🚀 Setting up GitHub repository safely..."
echo "⚠️  This will create a SEPARATE copy for GitHub - your main project is safe!"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from your main project directory"
    echo "   Current directory: $(pwd)"
    exit 1
fi

# Create GitHub directory (outside main project)
GITHUB_DIR="../synthetic-data-generator-github"
echo "📁 Creating GitHub directory: $GITHUB_DIR"

# Remove existing GitHub directory if it exists
if [ -d "$GITHUB_DIR" ]; then
    echo "🗑️  Removing existing GitHub directory..."
    rm -rf "$GITHUB_DIR"
fi

# Create new directory
mkdir -p "$GITHUB_DIR"
cd "$GITHUB_DIR"

echo "📋 Copying essential files for GitHub..."

# Copy only the essential files
cp -r ../synthetic-data-generator/frontend .
cp -r ../synthetic-data-generator/n8n-workflows .
cp -r ../synthetic-data-generator/database .
cp ../synthetic-data-generator/docker-compose.yml .
cp ../synthetic-data-generator/Dockerfile .
cp ../synthetic-data-generator/nginx.conf .
cp ../synthetic-data-generator/README.md .
cp ../synthetic-data-generator/DEPLOYMENT.md .
cp ../synthetic-data-generator/.gitignore .
cp ../synthetic-data-generator/requirements.txt .

echo "✅ Files copied successfully!"
echo ""

# Initialize git repository
echo "🔧 Initializing Git repository..."
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

echo "✅ Git repository initialized!"
echo ""

# Add GitHub remote
echo "🔗 Adding GitHub remote..."
git remote add origin https://github.com/shazily/syntheticdatagen.git

echo "✅ GitHub remote added!"
echo ""

# Show what will be pushed
echo "📋 Files that will be uploaded to GitHub:"
git ls-files | head -20
if [ $(git ls-files | wc -l) -gt 20 ]; then
    echo "... and $(($(git ls-files | wc -l) - 20)) more files"
fi
echo ""

# Show what's excluded by .gitignore
echo "🔒 Files excluded by .gitignore:"
echo "   - frontend-v3/ (development files)"
echo "   - frontend-v2/ (backup files)"
echo "   - generated_data/ (your generated data)"
echo "   - logs/ (log files)"
echo "   - qdrant_storage/ (vector database)"
echo "   - ssl/ (SSL certificates)"
echo "   - Any temporary or backup files"
echo ""

# Ask for confirmation
echo "🚀 Ready to push to GitHub!"
echo "   Repository: https://github.com/shazily/syntheticdatagen.git"
echo ""
read -p "Do you want to push to GitHub now? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Pushing to GitHub..."
    git branch -M main
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully pushed to GitHub!"
        echo "🌐 Your repository is now available at:"
        echo "   https://github.com/shazily/syntheticdatagen"
    else
        echo "❌ Failed to push to GitHub. Please check your GitHub credentials."
        echo "   You can try again later with:"
        echo "   cd $GITHUB_DIR"
        echo "   git push origin main"
    fi
else
    echo "⏸️  Skipped pushing to GitHub."
    echo "   You can push later with:"
    echo "   cd $GITHUB_DIR"
    echo "   git push origin main"
fi

echo ""
echo "🎉 GitHub setup complete!"
echo "📁 GitHub files are in: $GITHUB_DIR"
echo "🔒 Your main project files are completely safe!"
echo ""
echo "To update GitHub in the future:"
echo "   cd $GITHUB_DIR"
echo "   # Copy updated files from main project"
echo "   git add ."
echo "   git commit -m 'Update: [describe changes]'"
echo "   git push origin main"
