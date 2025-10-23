# Qdrant Vector Database - Import & Setup Guide

## 🎯 Overview
This guide will help you import and activate the Qdrant-enhanced n8n workflows for semantic search and RAG (Retrieval-Augmented Generation).

---

## ✅ Prerequisites Checklist

Before starting, ensure:
- [x] Qdrant container is running (`docker ps | grep qdrant`)
- [x] Collections are created (visit `http://localhost:6333/dashboard`)
- [x] Ollama has `all-minilm` model (`ollama list | grep all-minilm`)
- [x] PostgreSQL database `feedback_db` exists
- [x] Tables `chat_logs` and `ai_ratings` are created

---

## 📥 Step 1: Import n8n Workflows

Import these **3 new workflows** into n8n:

### 1.1 Qdrant Embedding Generator
**File:** `n8n-workflows/qdrant-embedding-generator.json`

**What it does:** Generates 384-dimensional embeddings from schemas using Ollama's all-minilm model

**Webhook endpoint:** `POST /webhook/generate-embedding`

**Import steps:**
1. Open n8n at `http://localhost:5678`
2. Click "Workflows" → "Add Workflow" → "Import from File"
3. Select `qdrant-embedding-generator.json`
4. Click "Save" (no credential changes needed if Ollama is on localhost:11434)

---

### 1.2 Qdrant Schema Auto-Indexer
**File:** `n8n-workflows/qdrant-schema-indexer.json`

**What it does:** Automatically indexes thumbs-up rated schemas into Qdrant every hour (or manually)

**Triggers:**
- **Schedule:** Every hour (cron: `0 * * * *`)
- **Manual:** Click "Test workflow" to index immediately

**Import steps:**
1. Import `qdrant-schema-indexer.json`
2. **Update Postgres credentials:**
   - Click "Query Successful Schemas" node
   - Select your existing "Postgres - Feedback DB" credential
   - Click "Mark as Indexed" node
   - Select same Postgres credential
3. Click "Save"
4. **Activate workflow** (toggle switch in top right)

---

### 1.3 RAG-Enhanced Intelligent Generator (V3)
**File:** `n8n-workflows/intelligent-generator-v3-rag.json`

**What it does:** Enhanced AI schema generator with vector search - retrieves similar successful schemas to improve responses

**Webhook endpoint:** `POST /webhook/generate-intelligent-v3`

**Import steps:**
1. Import `intelligent-generator-v3-rag.json`
2. **Update Postgres credentials:**
   - Click "Save Chat Log" node
   - Select your existing "Postgres - Feedback DB" credential
3. **Update Ollama credentials:**
   - Click "Ollama Chat Model" node
   - Select your existing "Ollama account" credential
4. Click "Save"
5. **Activate workflow**

---

## 🧪 Step 2: Test the Setup

### Test 1: Embedding Generation
```bash
curl -X POST http://localhost:5678/webhook/generate-embedding \
  -H "Content-Type: application/json" \
  -d '{
    "schema": [
      {"name": "customer_id", "type": "uuid"},
      {"name": "name", "type": "firstName"},
      {"name": "email", "type": "email"}
    ]
  }'
```

**Expected result:** JSON with `embedding` array (384 dimensions)

---

### Test 2: Manual Schema Indexing
1. Go to "Qdrant - Schema Auto-Indexer" workflow in n8n
2. Click "Test workflow" (play button)
3. Check execution log - should show:
   - Queried successful schemas from Postgres
   - Generated embeddings for each
   - Inserted to Qdrant
   - Marked as indexed

4. **Verify in Qdrant UI:**
   - Visit `http://localhost:6333/dashboard#/collections/successful_schemas`
   - Should see points with payloads containing schemas

---

### Test 3: RAG-Enhanced AI Generation

**Test from Frontend (port 3006):**
1. Open `http://localhost:3006`
2. Go to **A.I. Mode** tab
3. Enter: `"customer data"` in topic input
4. Click Send

**Check n8n execution log:**
- Should see "Generate Query Embedding" step
- Should see "Search Qdrant" step with similarity scores
- Should see "Build Enhanced System Message" with retrieved examples
- AI response should be influenced by similar successful schemas

**Expected behavior:**
- If Qdrant has similar customer schemas, AI will reference them
- Response quality should improve with more indexed examples

---

## 🔄 Step 3: Continuous Learning Flow

### How it works:
1. **User generates data in A.I. Mode**
   - Prompt sent to RAG-enhanced workflow
   - Vector search finds similar schemas
   - AI generates better response using examples
   
2. **User rates response (thumbs up)**
   - Rating saved to `ai_ratings` table
   - Linked to `chat_logs.id`

3. **Auto-indexer runs every hour**
   - Queries for thumbs-up schemas NOT yet indexed
   - Generates embeddings
   - Inserts to Qdrant
   - Marks `qdrant_indexed = true` in database

4. **Future requests benefit**
   - New prompts find these high-quality examples
   - AI generates progressively better schemas

---

## 📊 Step 4: Verify Database Setup

**Check if `qdrant_indexed` column exists:**
```bash
docker exec -i n8n_postgres_db psql -U postgres -d feedback_db -c "\d chat_logs"
```

**Expected output:** Should show `qdrant_indexed | boolean | default false`

**If column is missing:**
```bash
docker exec -i n8n_postgres_db psql -U postgres -d feedback_db -c "ALTER TABLE chat_logs ADD COLUMN qdrant_indexed BOOLEAN DEFAULT FALSE;"
```

---

## 🎛️ Configuration & Tuning

### Qdrant Search Parameters
**File:** `intelligent-generator-v3-rag.json` → "Search Qdrant" node

Adjust these in the HTTP Request body:
```json
{
  "vector": "{{ $json.embedding }}",
  "limit": 3,                    // Number of examples to retrieve (1-10)
  "with_payload": true,
  "score_threshold": 0.4         // Minimum similarity (0.0-1.0, lower = more permissive)
}
```

**Recommendations:**
- `limit: 3` - Good balance (2-5 examples work well)
- `score_threshold: 0.4` - Moderate filter (0.3 = permissive, 0.6 = strict)

---

### Auto-Indexer Schedule
**File:** `qdrant-schema-indexer.json` → "Schedule Trigger" node

**Current:** Every hour (`0 * * * *`)

**Options:**
- Every 30 min: `*/30 * * * *`
- Every 4 hours: `0 */4 * * *`
- Daily at 2 AM: `0 2 * * *`

---

## 🧪 Test Scenarios

### Scenario 1: First User Request (Cold Start)
- **Qdrant is empty**
- AI generates generic schema
- User gives thumbs up
- Auto-indexer adds it to Qdrant

### Scenario 2: Similar Request
- **Qdrant has 1 customer schema**
- New user asks for "user data"
- Vector search finds customer schema (similarity > 0.4)
- AI uses it as example → better schema generated
- User gives thumbs up → Added to Qdrant

### Scenario 3: Continuous Improvement
- **Qdrant has 10+ schemas**
- User asks for complex request (e.g., "credit card transactions with merchant data")
- Vector search finds top 3 most similar (transaction schemas, payment schemas)
- AI synthesizes from examples → high-quality schema
- User gives thumbs up → Reinforcement learning loop

---

## 📈 Monitoring & Analytics

### Check Indexed Schema Count
```bash
curl http://localhost:6333/collections/successful_schemas
```

Look for `points_count` in response.

### Check Pending Schemas to Index
```bash
docker exec -i n8n_postgres_db psql -U postgres -d feedback_db -c "
  SELECT COUNT(*) as pending_schemas
  FROM chat_logs cl
  INNER JOIN ai_ratings ar ON cl.id = ar.chat_log_id
  WHERE ar.rating = 'thumbs_up'
    AND (cl.qdrant_indexed IS NULL OR cl.qdrant_indexed = false);
"
```

### View Recently Indexed Schemas
```bash
docker exec -i n8n_postgres_db psql -U postgres -d feedback_db -c "
  SELECT id, user_prompt, timestamp, qdrant_indexed
  FROM chat_logs
  WHERE qdrant_indexed = true
  ORDER BY timestamp DESC
  LIMIT 10;
"
```

---

## 🛠️ Troubleshooting

### Issue 1: "Embedding generation failed"
**Cause:** Ollama all-minilm model not available

**Fix:**
```bash
ollama pull all-minilm
ollama list | grep all-minilm
```

---

### Issue 2: "Qdrant connection refused"
**Cause:** Qdrant container not running

**Fix:**
```bash
docker ps | grep qdrant
# If not running:
cd E:\Experiment\synthetic-data-generator
docker-compose up -d qdrant
```

---

### Issue 3: "No similar schemas found"
**Cause:** Qdrant collection is empty

**Fix:**
1. Run auto-indexer manually in n8n
2. Or insert test schema:
```bash
curl -X PUT http://localhost:6333/collections/successful_schemas/points?wait=true \
  -H "Content-Type: application/json" \
  -d '{
    "points": [{
      "id": 999,
      "vector": [0.1, 0.2, ...],  # 384 dimensions
      "payload": {
        "schema": [{"name": "test", "type": "text"}],
        "user_prompt": "test data",
        "rating": "thumbs_up"
      }
    }]
  }'
```

---

### Issue 4: "Postgres column qdrant_indexed doesn't exist"
**Cause:** Database schema not updated

**Fix:**
```bash
$sql = Get-Content E:\Experiment\synthetic-data-generator\database\schema.sql -Raw
docker exec -i n8n_postgres_db psql -U postgres -d feedback_db -c $sql
```

---

## 🎯 Success Metrics

After 1 week of usage, you should see:
- ✅ **10+ schemas indexed** in Qdrant
- ✅ **Thumbs-up rate improved** by 15-30%
- ✅ **Field count accuracy** improved (AI respects # Fields input better)
- ✅ **Vector search latency** < 50ms (check n8n execution times)
- ✅ **Fewer generic/irrelevant responses**

---

## 🚀 Next Steps

1. ✅ Import all 3 workflows
2. ✅ Test each workflow individually
3. ✅ Generate some data in A.I. Mode and give thumbs up
4. ✅ Run auto-indexer manually to populate Qdrant
5. ✅ Test RAG enhancement with similar prompts
6. ✅ Monitor improvement in AI response quality
7. 🔮 **Phase 3:** Add SQL pattern vector search
8. 🔮 **Phase 4:** Expand to other collections (field_type_mappings)

---

**🎉 Qdrant RAG integration is complete when:**
- Workflows are active ✅
- Qdrant has >5 schemas ✅
- Vector search is working ✅
- AI responses show improvement ✅

**Questions or issues?** Check n8n execution logs and Qdrant dashboard for debugging.

