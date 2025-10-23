# Import Workflows RIGHT NOW - 5 Minutes

## You're Right - Everything is Ready!

The intelligent workflow DOES use LangChain (as you asked) and retains chat context. Let's import it!

---

## Step 1: Import Intelligent Generator (WITH LangChain)

1. Open n8n: **http://localhost:5678**

2. Click **"Add Workflow"** → **"Import from File"**

3. Select: **`E:\Experiment\synthetic-data-generator\n8n-workflows\intelligent-generator.json`**

4. Click **"Import"**

5. You'll see the workflow with:
   - ✅ Webhook Trigger
   - ✅ **AI Agent** (LangChain)
   - ✅ **Chat Memory** (retains context!)
   - ✅ **Ollama Chat Model** (llama3.2:latest)
   - ✅ Response Parser
   - ✅ Data Generator
   - ✅ Webhook Response

6. Click on **"Ollama Chat Model"** node

7. Create Ollama credential:
   - Base URL: `http://localhost:11434`
   - Save

8. **ACTIVATE** the workflow (toggle switch ON)

---

## Step 2: Update Frontend to Call Correct Webhooks

The workflows are named:
- `generate-simple` (you might have imported this)
- `generate-intelligent` (import above)

But you have webhook: `synthetic-data-generator`

Let me update the frontend to match your setup:


