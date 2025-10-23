# Domain Registry System - PostgreSQL + Qdrant Architecture

## **Problem Solved**

Previously, domains were stored only in Qdrant (vector database), which:
- **Fragmented data** - LangChain splits domains into multiple text chunks
- **Lost metadata** - Structured info buried in `metadata` sub-objects or lost
- **No UI display** - Hard to show "what domains exist" to users
- **Duplicate risk** - No easy way to check if domain already exists

## **New Solution: Dual Storage**

### **1. PostgreSQL - Domain Registry (Source of Truth)**
✅ **Purpose**: Clean, structured domain management for UI display
✅ **Stores**:
- Domain name (unique)
- Full schema (JSON)
- Category
- Description
- Created/Updated timestamps
- Qdrant vector count (for reference)
- Status (active/inactive)

### **2. Qdrant - Vector Database (RAG Engine)**
✅ **Purpose**: Semantic search and RAG enrichment
✅ **Stores**:
- Text chunks (LangChain splits for better retrieval)
- Vector embeddings (for similarity search)
- Metadata references

---

## **Architecture Flow**

### **Adding a Domain:**
```
User submits domain → n8n workflow → 
  1. Store in Qdrant (vectors for RAG) ✅
  2. Store in PostgreSQL (registry for UI) ✅
  3. Return success
```

### **Displaying Domains:**
```
Admin UI → Fetch from PostgreSQL Registry → 
  Display organized, clean list ✅
```

### **RAG Generation:**
```
User requests data → Qdrant vector search → 
  Retrieve similar schemas → Ollama generates data ✅
```

---

## **Database Schemas**

### **PostgreSQL Table: `domain_registry`**
```sql
CREATE TABLE domain_registry (
  id SERIAL PRIMARY KEY,
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  schema JSONB NOT NULL,
  category VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  qdrant_vector_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active'
);
```

### **Qdrant Collection: `successful_schemas`**
```json
{
  "name": "successful_schemas",
  "vectors": {
    "size": 3072,
    "distance": "Cosine"
  }
}
```

---

## **n8n Workflows**

### **1. `domain-manager-with-postgres.json`**
**Webhook**: `/manage-domain-with-registry`

**Flow**:
1. Webhook receives domain data
2. Prepare document for Qdrant
3. Insert to Qdrant (with embeddings)
4. Insert/Update PostgreSQL registry
5. Return success response

**Key Features**:
- Uses native `Qdrant Vector Store` node
- Uses `Embeddings Ollama` for automatic embedding generation
- PostgreSQL `ON CONFLICT` prevents duplicates
- Increments `qdrant_vector_count` on updates

### **2. `get-domains-registry.json`**
**Webhook**: `/get-domains-registry` (GET)

**Flow**:
1. Webhook triggered
2. Query PostgreSQL for all active domains
3. Format response with count
4. Return JSON

**Used By**: Admin UI to display domains

---

## **Frontend Updates**

### **`admin.js` Changes:**

#### **1. New Function: `organizeDomainsByCategoryFromPostgres()`**
- Receives PostgreSQL data
- Auto-categorizes domains (Financial, E-commerce, etc.)
- Returns structured data for UI

#### **2. Updated `loadDomains()`**
```javascript
// OLD: Fetch from Qdrant (fragmented, messy)
const data = await fetch('http://localhost:6333/...');

// NEW: Fetch from PostgreSQL (clean, structured)
const data = await fetch('http://localhost:5678/webhook/get-domains-registry');
```

#### **3. Updated `loadVectorStats()`**
```javascript
// Vector count from Qdrant
const vectorCount = await fetch('http://localhost:6333/collections/...');

// Domain count from PostgreSQL
const domainCount = await fetch('http://localhost:5678/webhook/get-domains-registry');
```

#### **4. Updated Webhook Calls**
```javascript
// OLD: /manage-domain-native-simple
// NEW: /manage-domain-with-registry
await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/manage-domain-with-registry`, {...});
```

---

## **Benefits**

### **✅ Clean UI Display**
- PostgreSQL gives exact domain count
- No duplicates, no fragmentation
- Easy to categorize and organize

### **✅ Duplicate Prevention**
- `UNIQUE` constraint on `domain_name`
- `ON CONFLICT DO UPDATE` handles duplicates gracefully

### **✅ Full RAG Power**
- Qdrant still does semantic search
- LangChain still splits for better retrieval
- Ollama still generates contextual data

### **✅ Easy Management**
- Update domain → Updates both PostgreSQL and Qdrant
- Delete domain → Mark as inactive in PostgreSQL
- Track vector count per domain

### **✅ Performance**
- PostgreSQL: Fast structured queries for UI
- Qdrant: Fast vector search for RAG

---

## **Usage Guide**

### **For Developers:**

#### **Add a domain via API:**
```bash
curl -X POST http://localhost:5678/webhook/manage-domain-with-registry \
-H "Content-Type: application/json" \
-d '{
  "domain": "Credit Card Transactions",
  "schema": [
    {"name": "transaction_id", "type": "uuid", "description": "Unique transaction ID", "examples": ["a1b2c3d4-5678-90ab-cdef"]},
    {"name": "amount", "type": "currency", "description": "Transaction amount", "examples": ["$100.50", "$2500.00"]}
  ],
  "action": "create"
}'
```

#### **Get all domains:**
```bash
curl http://localhost:5678/webhook/get-domains-registry
```

### **For Users (Admin UI):**
1. Go to "Vector DB" tab
2. Click "Add New Domain"
3. Use Form Builder or JSON
4. Submit → Stored in both PostgreSQL and Qdrant

---

## **Migration Notes**

### **Existing Qdrant Data:**
- **No action needed** - Qdrant vectors stay for RAG
- New domains will be added to PostgreSQL
- Old domains can be manually migrated if needed

### **To Migrate Old Domains:**
1. Fetch from Qdrant
2. Extract unique domains
3. Insert into PostgreSQL
4. Done

---

## **Testing**

### **Test 1: Add Domain**
```bash
# Add a domain
curl -X POST http://localhost:5678/webhook/manage-domain-with-registry -H "Content-Type: application/json" -d '{"domain":"Test Domain","schema":[{"name":"id","type":"uuid"}],"action":"create"}'

# Verify in PostgreSQL
docker exec n8n_postgres_db psql -U postgres -d feedback_db -c "SELECT * FROM domain_registry;"

# Verify in Qdrant
curl -X POST http://localhost:6333/collections/successful_schemas/points/scroll -H "Content-Type: application/json" -d '{"limit":10}'
```

### **Test 2: Get Domains**
```bash
curl http://localhost:5678/webhook/get-domains-registry
```

### **Test 3: UI Display**
1. Open Admin UI
2. Go to Vector DB tab
3. Should see domain count from PostgreSQL
4. Should see organized domain list

---

## **Troubleshooting**

### **Domain count shows 0:**
- Check if workflows are active
- Check PostgreSQL connection
- Check if `get-domains-registry` webhook works

### **Duplicates in UI:**
- PostgreSQL prevents DB duplicates
- UI deduplication handled by `UNIQUE` constraint

### **RAG not working:**
- Qdrant vectors unaffected by PostgreSQL
- Check Qdrant collection exists
- Check Ollama embeddings generating

---

## **Future Enhancements**

1. **Category Management**: Let users set categories
2. **Domain Analytics**: Track which domains are used most
3. **Bulk Import**: Upload CSV of domains
4. **Domain Versioning**: Track schema changes over time
5. **Auto-Sync**: Background job to sync Qdrant ↔ PostgreSQL counts

