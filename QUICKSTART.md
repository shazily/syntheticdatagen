# Quick Start Guide

Get the Synthetic Data Generator running in 5 minutes!

## Prerequisites Check

Before starting, verify you have:

```bash
# Docker installed
docker --version
# Should show: Docker version 20.x or higher

# Docker Compose installed
docker-compose --version
# Should show: docker-compose version 1.29.x or higher

# n8n running
curl http://localhost:5678
# Should return HTML

# Ollama running
curl http://localhost:11434/api/tags
# Should return JSON with model list
```

If any command fails, install the missing component first.

## Installation Steps

### Step 1: Start the Application (30 seconds)

```bash
# Navigate to project directory
cd synthetic-data-generator

# Start Docker container
docker-compose up -d

# Verify it's running
docker ps
# Should show: synthetic-data-web container
```

✅ **Application is now running at:** http://localhost

Test it:
```bash
curl http://localhost
# Should return HTML
```

---

### Step 2: Import n8n Workflows (2 minutes)

#### Import Simple Generator

1. Open n8n: http://localhost:5678
2. Click **"Workflows"** in the left sidebar
3. Click **"Add Workflow"** button (top-right)
4. Click **"Import from File"**
5. Select: `n8n-workflows/simple-generator.json`
6. Click **"Import"**
7. **Activate the workflow** (toggle switch in top-right corner should be ON/blue)

#### Import Intelligent Generator

1. In n8n, click **"Add Workflow"** again
2. Click **"Import from File"**
3. Select: `n8n-workflows/intelligent-generator.json`
4. Click **"Import"**
5. Click on the **"Ollama Chat Model"** node
6. Click **"Create New Credential"** for Ollama
7. Enter Base URL: `http://localhost:11434`
8. Save credential
9. **Activate the workflow** (toggle switch should be ON/blue)

✅ **Both workflows are now ready!**

---

### Step 3: Test Everything (2 minutes)

#### Test 1: Open Web Interface

1. Open browser
2. Go to: http://localhost
3. You should see the Synthetic Data Generator interface

#### Test 2: Test Schema Builder

1. Click **"Schema Builder"** tab (if not already active)
2. Drag **"First Name"** from left panel to the schema area
3. Drag **"Email"** to the schema area
4. Set **"Number of Records"** to `10`
5. Click **"Generate Data"**
6. A CSV file should download automatically
7. Open the CSV - should have 10 rows of data

✅ **Schema Builder is working!**

#### Test 3: Test AI Chat

1. Click **"AI Chat"** tab
2. Type: `Generate 20 customer records with names and emails`
3. Click **"Generate"** (or press Enter)
4. Wait 5-10 seconds
5. You should see:
   - AI response in chat
   - Data preview table on the right
   - Download buttons appear
6. Click **"📄 Download CSV"**
7. CSV file with 20 records should download

✅ **AI Chat is working!**

---

## You're All Set! 🎉

The Synthetic Data Generator is now fully operational.

## What's Next?

### Explore Field Types

Try different field types:
- Personal: firstName, lastName, email, phone, address
- Business: company, jobTitle, department
- Financial: creditCard, currency, amount, iban
- Technical: uuid, ipAddress, url, username
- Dates: date, datetime, birthdate
- Numbers: integer, decimal, percentage

### Use AI Chat Creatively

Try these prompts:
- "Generate employee data for 100 people with salaries and hire dates"
- "I need transaction data with IDs, amounts, and timestamps"
- "Create test user accounts with usernames, emails, and passwords"
- "Generate customer data for an e-commerce site"

### Generate Large Datasets

- Go up to 10,000 records per generation
- Export as CSV or Excel
- Use for database seeding, testing, demos

## Troubleshooting

### Container won't start
```bash
# Check if port 80 is in use
netstat -an | grep :80

# If port is busy, change it in docker-compose.yml
# Then restart:
docker-compose down
docker-compose up -d
```

### n8n workflows don't respond
```bash
# Check if workflows are activated
# Open n8n → Workflows → Check toggle switch is ON (blue)

# Test webhooks directly:
curl -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{"schema":[{"name":"test","type":"firstName"}],"recordCount":5}'
```

### AI Chat doesn't work
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Check if model is available
ollama list
# Should show llama3.2:latest

# Pull model if missing
ollama pull llama3.2:latest
```

### CORS errors in browser
```bash
# Restart nginx
docker-compose restart

# Clear browser cache
# Then refresh page
```

## Quick Reference

### URLs
- **Web App:** http://localhost
- **n8n:** http://localhost:5678
- **Ollama:** http://localhost:11434

### Webhook Endpoints
- **Simple Generator:** `http://localhost:5678/webhook/generate-simple`
- **Intelligent Generator:** `http://localhost:5678/webhook/generate-intelligent`

### Common Commands
```bash
# Start application
docker-compose up -d

# Stop application
docker-compose down

# View logs
docker logs synthetic-data-web

# Restart application
docker-compose restart

# Rebuild container
docker-compose build --no-cache
docker-compose up -d
```

### File Locations
- **Frontend files:** `frontend/`
- **n8n workflows:** `n8n-workflows/`
- **Configuration:** `nginx.conf`, `docker-compose.yml`

## Getting Help

1. **Check README.md** - Comprehensive documentation
2. **Check TESTING_GUIDE.md** - Detailed test procedures
3. **Check DEVELOPER_NOTES.md** - Technical details
4. **Check n8n execution logs** - In n8n web interface
5. **Check Docker logs** - `docker logs synthetic-data-web`

---

**Estimated Setup Time:** 5 minutes  
**Difficulty Level:** Easy  
**Last Updated:** January 2025

Enjoy generating synthetic data! 🚀

