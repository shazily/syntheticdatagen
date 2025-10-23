# Deployment Checklist

Use this checklist to deploy the Synthetic Data Generator step-by-step.

## ✅ Pre-Deployment Verification

### System Requirements
- [ ] Docker installed and running
- [ ] Docker Compose installed
- [ ] n8n running on port 5678
- [ ] Ollama running on port 11434
- [ ] Ollama has llama3.2:latest model pulled

**Verify Commands:**
```bash
docker --version                    # Should show version
docker-compose --version            # Should show version
curl http://localhost:5678          # Should return HTML
curl http://localhost:11434/api/tags # Should return JSON
ollama list                         # Should show llama3.2:latest
```

## 📦 Step 1: Deploy Docker Container

### 1.1 Navigate to Project
```bash
cd synthetic-data-generator
```

### 1.2 Verify Files Exist
- [ ] `docker-compose.yml` exists
- [ ] `Dockerfile` exists
- [ ] `nginx.conf` exists
- [ ] `frontend/` directory with all files

### 1.3 Start Container
```bash
docker-compose up -d
```

### 1.4 Verify Container Running
```bash
docker ps | grep synthetic-data-web
```

Should show running container.

### 1.5 Test Web Server
```bash
curl http://localhost
```

Should return HTML.

### 1.6 Test in Browser
- [ ] Open http://localhost
- [ ] Page loads without errors
- [ ] Check browser console (F12) - no errors

**Status:** ✅ Docker deployment complete

---

## 🔄 Step 2: Import n8n Workflows

### 2.1 Open n8n
- [ ] Navigate to http://localhost:5678
- [ ] Login if required

### 2.2 Import Simple Generator

1. [ ] Click "Workflows" in left sidebar
2. [ ] Click "Add Workflow" button (top-right)
3. [ ] Click "Import from File"
4. [ ] Navigate to `n8n-workflows/simple-generator.json`
5. [ ] Click "Import"
6. [ ] Workflow opens in editor
7. [ ] Click workflow name at top
8. [ ] Rename to: "Synthetic Data - Simple Generator"
9. [ ] **CRITICAL:** Toggle switch in top-right to **ACTIVATE** (should be blue/ON)

**Verify:**
```bash
curl -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{"schema":[{"name":"test","type":"firstName"}],"recordCount":5}'
```

Should return JSON with success: true

### 2.3 Import Intelligent Generator

1. [ ] Click "Add Workflow" again
2. [ ] Click "Import from File"
3. [ ] Navigate to `n8n-workflows/intelligent-generator.json`
4. [ ] Click "Import"
5. [ ] Workflow opens in editor
6. [ ] Rename to: "Synthetic Data - Intelligent Generator"

### 2.4 Configure Ollama Credential

**IMPORTANT:** This step is required for AI chat to work

1. [ ] In the workflow, click on **"Ollama Chat Model"** node
2. [ ] In right panel, find "Credential" section
3. [ ] Click "Select Credential" dropdown
4. [ ] Click "Create New Credential"
5. [ ] Enter:
   - **Base URL:** `http://localhost:11434`
   - Or if Ollama is on different host: `http://YOUR_HOST:11434`
6. [ ] Click "Save"
7. [ ] Close credential dialog
8. [ ] **CRITICAL:** Toggle switch to **ACTIVATE** workflow (should be blue/ON)

**Verify:**
```bash
curl -X POST http://localhost:5678/webhook/generate-intelligent \
  -H "Content-Type: application/json" \
  -d '{"chatInput":"Generate 5 records","sessionId":"test"}'
```

Should return JSON with response object

**Status:** ✅ n8n workflows imported and configured

---

## 🧪 Step 3: Test Complete System

### 3.1 Test Schema Builder (Simple Path)

1. [ ] Open http://localhost in browser
2. [ ] Click "Schema Builder" tab (should be active by default)
3. [ ] Drag "First Name" field from left panel to schema
4. [ ] Drag "Email" field to schema
5. [ ] Set "Number of Records" to `10`
6. [ ] Leave format as "CSV"
7. [ ] Click "Generate Data" button
8. [ ] Loading overlay appears
9. [ ] CSV file downloads automatically
10. [ ] Open CSV file - should have 10 rows with first names and emails

**Expected Result:** ✅ CSV file with 10 records downloaded

### 3.2 Test Excel Export

1. [ ] Keep same schema (First Name, Email)
2. [ ] Change "Export Format" to "Excel (XLSX)"
3. [ ] Click "Generate Data"
4. [ ] Excel file downloads
5. [ ] Open in Excel/LibreOffice - should show data

**Expected Result:** ✅ Excel file with data

### 3.3 Test AI Chat (Intelligent Path)

1. [ ] Click "AI Chat" tab
2. [ ] In text area, type: `Generate 20 customer records with names and emails`
3. [ ] Click "Generate" button (or press Enter)
4. [ ] Wait 5-10 seconds
5. [ ] User message appears in chat
6. [ ] AI response appears
7. [ ] Data preview table appears on right side
8. [ ] Shows first 10 rows
9. [ ] Download buttons appear
10. [ ] Click "📄 Download CSV"
11. [ ] CSV with 20 records downloads
12. [ ] Click "📊 Download Excel"
13. [ ] Excel file downloads

**Expected Result:** ✅ AI interprets request, generates data, both downloads work

### 3.4 Test Contextual Conversation

1. [ ] In same AI Chat session
2. [ ] Type: `Now add phone numbers to the data`
3. [ ] Click "Generate"
4. [ ] AI should acknowledge previous context
5. [ ] New data should include phone numbers

**Expected Result:** ✅ Chat memory maintains context

### 3.5 Test Multiple Field Types

1. [ ] Go back to Schema Builder
2. [ ] Clear existing fields
3. [ ] Add these fields:
   - First Name
   - Last Name
   - Email
   - Phone
   - Company
   - Job Title
   - UUID
   - Date
   - Amount
4. [ ] Set records to `100`
5. [ ] Generate CSV
6. [ ] Verify all field types generate appropriate data

**Expected Result:** ✅ All field types work correctly

**Status:** ✅ All features tested and working

---

## 🔐 Step 4: Security & Production Readiness

### 4.1 Security Checklist (Optional for Local Use)

For **local development only**:
- [x] No authentication needed
- [x] CORS allows all origins (fine for localhost)
- [x] HTTP is acceptable

For **production deployment**:
- [ ] Add authentication (API keys or OAuth)
- [ ] Configure HTTPS/SSL
- [ ] Restrict CORS to specific origins
- [ ] Add rate limiting
- [ ] Set up monitoring
- [ ] Configure firewall rules
- [ ] Use environment variables for secrets
- [ ] Enable audit logging

### 4.2 Cloudflare Tunnel Setup (Optional)

**Note:** You mentioned you'll handle this separately.

When ready to expose to internet:

1. Install cloudflared
2. Create tunnel in Cloudflare dashboard
3. Configure tunnel to point to `http://localhost:80`
4. Public URL will be accessible over internet

**DO NOT expose without authentication in production!**

---

## 📊 Step 5: Ongoing Maintenance

### 5.1 Regular Checks

**Weekly:**
- [ ] Check Docker container is running: `docker ps`
- [ ] Check disk space (generated files)
- [ ] Review n8n execution logs for errors

**Monthly:**
- [ ] Update Docker image: `docker pull nginx:alpine`
- [ ] Update Ollama model: `ollama pull llama3.2:latest`
- [ ] Review and clean old n8n executions

### 5.2 Backup Important Files

**Files to backup:**
- [ ] `n8n-workflows/*.json` (your workflows)
- [ ] `frontend/*` (all UI code)
- [ ] `nginx.conf`
- [ ] `docker-compose.yml`
- [ ] `README.md` and other docs

**Backup command:**
```bash
tar -czf synthetic-data-backup-$(date +%Y%m%d).tar.gz \
  n8n-workflows/ frontend/ nginx.conf docker-compose.yml *.md
```

### 5.3 Troubleshooting Commands

**Container issues:**
```bash
# View logs
docker logs synthetic-data-web

# Restart container
docker-compose restart

# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**n8n issues:**
```bash
# Check n8n is running
curl http://localhost:5678

# Check specific webhook
curl http://localhost:5678/webhook/generate-simple

# View n8n logs (if running in Docker)
docker logs n8n-container-name
```

**Ollama issues:**
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama serve

# Re-pull model
ollama pull llama3.2:latest
```

---

## ✅ Deployment Complete!

### Final Verification

- [ ] Application accessible at http://localhost
- [ ] Schema Builder works
- [ ] AI Chat works
- [ ] CSV export works
- [ ] Excel export works
- [ ] No errors in browser console
- [ ] n8n workflows activated
- [ ] Ollama connected

### What's Next?

1. **Start Using:**
   - Generate test data for your projects
   - Experiment with different field types
   - Try complex AI prompts

2. **Customize:**
   - Add more field types (see DEVELOPER_NOTES.md)
   - Modify UI styling
   - Extend n8n workflows

3. **Share:**
   - Use Cloudflare tunnel to share
   - Add authentication before sharing
   - Share workflows with team

---

## 📞 Need Help?

### Documentation
- `README.md` - Complete user guide
- `QUICKSTART.md` - Fast setup
- `DEVELOPER_NOTES.md` - Technical details
- `TESTING_GUIDE.md` - Test procedures
- `IMPLEMENTATION_SUMMARY.md` - Project overview

### Common Issues

**"Container won't start"**
→ Check port 80 isn't in use: `netstat -an | grep :80`

**"n8n webhooks don't respond"**
→ Ensure workflows are ACTIVATED (blue toggle)

**"AI chat doesn't work"**
→ Check Ollama credential is configured correctly

**"CORS errors"**
→ Restart nginx: `docker-compose restart`

---

**Deployment Status:** ✅ READY  
**Last Updated:** January 2025  
**Version:** 1.0.0

🎉 **Congratulations! Your Synthetic Data Generator is deployed and ready to use!**

