# 🚀 GitHub Repository Setup Guide

This guide will help you safely set up your GitHub repository without affecting your local files.

## ⚠️ IMPORTANT SAFETY NOTES

- **DO NOT** run `git init` in your main project directory
- **DO NOT** run `git add .` without checking what will be added
- **DO NOT** delete any existing files
- This guide creates a **separate copy** for GitHub

## 📋 Step-by-Step Setup

### Step 1: Create a Clean Copy for GitHub

```bash
# Create a new directory for GitHub (outside your main project)
cd ..
mkdir synthetic-data-generator-github
cd synthetic-data-generator-github

# Copy only the essential files (NOT the entire project)
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
```

### Step 2: Initialize Git Repository (Safe Location)

```bash
# Initialize git in the NEW directory (not your main project)
git init
git add .
git commit -m "Initial commit: Synthetic Data Generator v2.2.0"
```

### Step 3: Connect to GitHub

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/shazily/syntheticdatagen.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🔒 What's Protected

The `.gitignore` file will exclude:
- ✅ **Your development files** (`frontend-v3/`, `frontend-v2/`, etc.)
- ✅ **Your local data** (`generated_data/`, `uploads/`, `logs/`)
- ✅ **Your system files** (`.DS_Store`, `Thumbs.db`)
- ✅ **Your SSL certificates** (`ssl/` directory)
- ✅ **Your Qdrant data** (`qdrant_storage/`)
- ✅ **Your backup files** and temporary files

## 📁 What Gets Uploaded to GitHub

Only these **essential files** will be uploaded:
- ✅ `frontend/` - Production frontend files
- ✅ `n8n-workflows/` - Workflow definitions
- ✅ `database/` - Database schemas
- ✅ `docker-compose.yml` - Docker configuration
- ✅ `Dockerfile` - Container build instructions
- ✅ `nginx.conf` - Web server configuration
- ✅ `README.md` - Documentation
- ✅ `DEPLOYMENT.md` - Deployment guide
- ✅ `.gitignore` - Git ignore rules
- ✅ `requirements.txt` - Python dependencies

## 🚫 What's NOT Uploaded

These files will **NOT** be uploaded to GitHub:
- ❌ `frontend-v3/` - Your development files
- ❌ `frontend-v2/` - Your backup files
- ❌ `generated_data/` - Your generated data
- ❌ `logs/` - Your log files
- ❌ `qdrant_storage/` - Your vector database
- ❌ `ssl/` - Your SSL certificates
- ❌ Any temporary or backup files

## 🔄 Keeping GitHub Updated

### Safe Update Process

```bash
# 1. Go to your GitHub copy directory
cd ../synthetic-data-generator-github

# 2. Copy updated files from your main project
cp ../synthetic-data-generator/frontend/* frontend/
cp ../synthetic-data-generator/n8n-workflows/* n8n-workflows/

# 3. Update documentation if needed
cp ../synthetic-data-generator/README.md .
cp ../synthetic-data-generator/DEPLOYMENT.md .

# 4. Commit and push changes
git add .
git commit -m "Update: [describe your changes]"
git push origin main
```

## 🛡️ Safety Checklist

Before running any git commands:

- ✅ **Verify you're in the GitHub copy directory** (not your main project)
- ✅ **Check what files will be added**: `git status`
- ✅ **Review the .gitignore file** to ensure sensitive files are excluded
- ✅ **Test the setup** in a separate directory first

## 🆘 If Something Goes Wrong

### Recovery Steps

1. **Don't panic** - your main project files are safe
2. **Check your current directory**: `pwd`
3. **Verify you're in the GitHub copy**: `ls -la`
4. **If in wrong directory**: `cd ../synthetic-data-generator-github`
5. **Reset if needed**: `git reset --hard HEAD`

### Backup Your Main Project

```bash
# Create a backup of your main project (just in case)
cd ../synthetic-data-generator
tar -czf ../synthetic-data-generator-backup-$(date +%Y%m%d).tar.gz .
```

## 📞 Support

If you encounter any issues:
1. **Check your current directory** - make sure you're in the GitHub copy
2. **Review the .gitignore file** - ensure sensitive files are excluded
3. **Test in a separate directory** first
4. **Contact support** if needed

---

**Remember: Your main project files are completely safe. This process only works with a separate copy for GitHub.**
