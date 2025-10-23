# 📥 Import n8n Workflows - Step by Step

## ⚠️ CRITICAL: This step is required for the application to work!

Without importing and activating the workflows, the data generation features won't function.

---

## 🎯 Quick Overview

You need to import 2 workflows into n8n:
1. **Simple Generator** - For the drag-and-drop schema builder
2. **Intelligent Generator** - For the AI chat interface

**Time Required:** 5-10 minutes  
**Difficulty:** Easy (just clicking and selecting files)

---

## 📋 Step-by-Step Guide

### Step 1: Open n8n

1. Open your browser
2. Go to: **http://localhost:5678**
3. You should see the n8n interface

---

### Step 2: Import Simple Generator Workflow

#### 2.1 Start Import
- Click **"Workflows"** in the left sidebar
- Click **"Add Workflow"** button (top-right corner)
- Click **"Import from File"**

#### 2.2 Select File
- A file dialog will open
- Navigate to: `E:\Experiment\synthetic-data-generator\n8n-workflows\`
- Select: **`simple-generator.json`**
- Click **"Open"** or **"Import"**

#### 2.3 Verify Import
The workflow should open in the editor. You should see:
- **Webhook Trigger** node
- **Data Generator** node (Function)
- **Webhook Response** node

#### 2.4 CRITICAL: Activate Workflow
⚠️ **This is the most important step!**

Look at the **top-right corner** of the screen:
- You'll see a toggle switch (might say "Inactive" or be grayed out)
- **Click the toggle to turn it ON**
- It should turn **blue/green** and say "Active"

✅ **Simple Generator is now ready!**

---

### Step 3: Import Intelligent Generator Workflow

#### 3.1 Start Import
- Click **"Add Workflow"** button again (top-right)
- Click **"Import from File"**

#### 3.2 Select File
- Navigate to: `E:\Experiment\synthetic-data-generator\n8n-workflows\`
- Select: **`intelligent-generator.json`**
- Click **"Open"** or **"Import"**

#### 3.3 Verify Import
The workflow should open. You should see:
- **Webhook Trigger** node
- **AI Agent** node
- **Ollama Chat Model** node
- **Chat Memory** node
- **Response Parser** node
- **Data Generator** node
- **Webhook Response** node

#### 3.4 Configure Ollama Credential
⚠️ **Required for AI chat to work!**

1. **Click on the "Ollama Chat Model" node** (the purple/blue node)
2. In the right panel, look for **"Credential"** section
3. Click the **dropdown** that says "Select Credential"
4. Click **"Create New Credential"**
5. A dialog will open:
   - **Name:** Ollama Local (or any name you want)
   - **Base URL:** `http://localhost:11434`
6. Click **"Save"**
7. Close the credential dialog

#### 3.5 CRITICAL: Activate Workflow
⚠️ **Don't forget this step!**

Look at the **top-right corner**:
- Click the toggle switch to turn it **ON**
- It should turn **blue/green** and say "Active"

✅ **Intelligent Generator is now ready!**

---

## ✅ Verification

### Check Workflows are Active

1. Go to **"Workflows"** in n8n left sidebar
2. You should see both workflows listed:
   - **Synthetic Data - Simple Generator** → Status: Active ✅
   - **Synthetic Data - Intelligent Generator** → Status: Active ✅

### Test Webhooks

Open PowerShell/Command Prompt and run:

**Test Simple Generator:**
```powershell
curl -X POST http://localhost:5678/webhook/generate-simple `
  -H "Content-Type: application/json" `
  -d '{\"schema\":[{\"name\":\"test\",\"type\":\"firstName\"}],\"recordCount\":3}'
```

**Expected Result:**
```json
{
  "success": true,
  "data": [
    {"test": "John"},
    {"test": "Mary"},
    {"test": "Michael"}
  ],
  "recordCount": 3
}
```

**Test Intelligent Generator:**
```powershell
curl -X POST http://localhost:5678/webhook/generate-intelligent `
  -H "Content-Type: application/json" `
  -d '{\"chatInput\":\"Generate 5 records\",\"sessionId\":\"test123\"}'
```

**Expected Result:**
```json
{
  "response": {
    "message": "I'll generate...",
    "data": [...],
    "recordCount": 5
  }
}
```

---

## 🎉 You're Done!

If the webhook tests return data (not 404 errors), you're all set!

### Now Test the Full Application

1. Open: **http://localhost:3004**
2. Try the **Schema Builder**:
   - Drag fields to schema
   - Click "Generate Data"
   - CSV should download
3. Try the **AI Chat**:
   - Type: "Generate 20 customer records"
   - Click "Generate"
   - Data should appear

---

## 🐛 Troubleshooting

### "Webhook not registered" (404 Error)

**Problem:** Getting 404 when testing webhooks  
**Cause:** Workflow not activated  
**Solution:** 
1. Open the workflow in n8n
2. Check the toggle switch in top-right
3. Make sure it's **ON** (blue/green)

### "Ollama credential error"

**Problem:** AI chat doesn't work  
**Cause:** Ollama credential not configured  
**Solution:**
1. Open "Intelligent Generator" workflow
2. Click "Ollama Chat Model" node
3. Check credential is selected
4. If not, create one with Base URL: `http://localhost:11434`

### "Model not found"

**Problem:** Ollama says model doesn't exist  
**Cause:** llama3.2:latest not installed  
**Solution:**
```bash
ollama pull llama3.2:latest
```

### Workflows don't appear in n8n

**Problem:** After import, workflow doesn't show  
**Cause:** Import failed silently  
**Solution:**
1. Check JSON file is valid
2. Try importing again
3. Check n8n console for errors

---

## 📞 Need Help?

### Documentation
- **README.md** - Full user guide
- **QUICKSTART.md** - Fast setup
- **TESTING_GUIDE.md** - Testing procedures
- **SETUP_COMPLETE.md** - Post-setup checklist

### Check n8n Logs

If workflows still don't work:
1. Go to n8n → **Executions**
2. Click on a failed execution
3. See which node failed and why

---

## 🎯 Import Checklist

Use this checklist to make sure you did everything:

### Simple Generator
- [ ] Opened n8n (http://localhost:5678)
- [ ] Clicked "Add Workflow"
- [ ] Clicked "Import from File"
- [ ] Selected `simple-generator.json`
- [ ] Workflow opened in editor
- [ ] **Clicked toggle to ACTIVATE** ✅
- [ ] Verified it shows "Active"

### Intelligent Generator
- [ ] Clicked "Add Workflow" again
- [ ] Clicked "Import from File"
- [ ] Selected `intelligent-generator.json`
- [ ] Workflow opened in editor
- [ ] Clicked on "Ollama Chat Model" node
- [ ] Created new Ollama credential
- [ ] Entered Base URL: http://localhost:11434
- [ ] Saved credential
- [ ] **Clicked toggle to ACTIVATE** ✅
- [ ] Verified it shows "Active"

### Verification
- [ ] Both workflows show "Active" in workflow list
- [ ] Tested simple webhook (got JSON response)
- [ ] Tested intelligent webhook (got JSON response)
- [ ] Opened http://localhost:3004
- [ ] Schema Builder works
- [ ] AI Chat works

---

**Status:** Ready for Import  
**Files Location:** `E:\Experiment\synthetic-data-generator\n8n-workflows\`  
**n8n URL:** http://localhost:5678  
**App URL:** http://localhost:3004

🚀 **Let's get your workflows imported and start generating data!**

