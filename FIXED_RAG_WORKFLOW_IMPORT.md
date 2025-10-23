# 🔧 Fixed RAG Workflow - Re-Import Guide

## Issue Fixed
The original RAG-Enhanced workflow had incorrect network addresses because:
- **n8n runs in Docker** on network `n8n-lab_n8n-network`
- **Ollama runs on the host** (not in Docker)
- **Qdrant runs in Docker** on a different network

## Solution
Updated the workflow to use the Docker gateway IP `172.21.0.1` to reach both Ollama and Qdrant from n8n.

## Re-Import Steps

### 1. Delete the Old Workflow
1. Go to n8n: `http://localhost:5678`
2. Find "Synthetic Data - Intelligent Generator V3 (RAG-Enhanced)"
3. Click the **"..." menu** → **"Delete"**
4. Confirm deletion

### 2. Import the Fixed Workflow
1. Click **"Import from File"** in n8n
2. Select: `n8n-workflows/intelligent-generator-v3-dev-RAG-ENHANCED.json`
3. Click **"Import"**

### 3. Activate the Workflow
1. Open the imported workflow
2. Click the **"Active"** toggle (top right)
3. Verify it shows "Active"

### 4. Test the Workflow
1. Go to frontend: `http://localhost:3006`
2. Click **"A.I Mode"**
3. Enter: "Generate credit card transaction data"
4. Set **"# Fields: 8"**
5. Click **"Generate Full Data"**

## Expected Result
✅ AI generates intelligent schema with 8 relevant fields
✅ Data is generated successfully
✅ RAG enhancement provides better field suggestions
✅ Rating widget appears for feedback

## Network Architecture
```
┌─────────────────────────────────────┐
│  Docker Network: n8n-lab_n8n-network│
│                                     │
│  ┌──────────┐                       │
│  │   n8n    │──┐                    │
│  └──────────┘  │                    │
└─────────────────┼────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Gateway IP     │
         │ 172.21.0.1     │
         └────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
   ┌─────────┐          ┌─────────┐
   │ Ollama  │          │ Qdrant  │
   │ :11434  │          │ :6333   │
   └─────────┘          └─────────┘
   (Host)               (Docker)
```

---

**After re-importing, the RAG enhancement will work correctly!** 🚀

