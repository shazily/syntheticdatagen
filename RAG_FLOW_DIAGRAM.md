# 🔄 RAG (Retrieval-Augmented Generation) Flow Diagram

## **How Your System Works With Vector Database**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    User Types: "credit card transactions"
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Port 3006)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  A.I. Mode Interface                                         │  │
│  │  • Collects user prompt                                      │  │
│  │  • Sends to n8n webhook                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      N8N WORKFLOW (RAG-Enhanced)                     │
│                                                                       │
│  STEP 1: Generate Embedding                                          │
│  ┌────────────────────────────────────────────────┐                 │
│  │  "credit card transactions"                    │                 │
│  │         ↓                                      │                 │
│  │  Ollama (all-minilm model)                    │                 │
│  │         ↓                                      │                 │
│  │  [0.123, -0.456, 0.789, ..., 0.234]          │                 │
│  │  (384-dimensional vector)                      │                 │
│  └────────────────────────────────────────────────┘                 │
│                                                                       │
│  STEP 2: Search Qdrant                                               │
│  ┌────────────────────────────────────────────────┐                 │
│  │  Vector → Qdrant "successful_schemas"          │                 │
│  │         ↓                                      │                 │
│  │  Similarity Search (Cosine Distance)           │                 │
│  │         ↓                                      │                 │
│  │  Found: "customer data" (60% similar)          │                 │
│  │         "payment processing" (85% similar)     │                 │
│  │         "financial records" (55% similar)      │                 │
│  └────────────────────────────────────────────────┘                 │
│                                                                       │
│  STEP 3: Build Enhanced Prompt                                       │
│  ┌────────────────────────────────────────────────┐                 │
│  │  Base System Message:                          │                 │
│  │  "You are a synthetic data generator..."      │                 │
│  │         +                                      │                 │
│  │  Retrieved Examples:                           │                 │
│  │  "Example 1 (85% similar):                    │                 │
│  │   User asked: 'payment processing'            │                 │
│  │   Schema: [transaction_id, merchant, ...]"    │                 │
│  └────────────────────────────────────────────────┘                 │
│                                                                       │
│  STEP 4: AI Agent (LangChain)                                        │
│  ┌────────────────────────────────────────────────┐                 │
│  │  Enhanced Prompt → Ollama (llama3.2)          │                 │
│  │         ↓                                      │                 │
│  │  AI sees past examples + user request          │                 │
│  │         ↓                                      │                 │
│  │  Generates better schema:                      │                 │
│  │  {                                             │                 │
│  │    "message": "Generating credit card...",     │                 │
│  │    "schema": [                                 │                 │
│  │      {"name": "transaction_id", ...},          │                 │
│  │      {"name": "cardholder_name", ...},         │                 │
│  │      {"name": "merchant", ...}                 │                 │
│  │    ]                                           │                 │
│  │  }                                             │                 │
│  └────────────────────────────────────────────────┘                 │
│                                                                       │
│  STEP 5: Generate Data & Save                                        │
│  ┌────────────────────────────────────────────────┐                 │
│  │  Schema → Data Generator                       │                 │
│  │         ↓                                      │                 │
│  │  8 records with synthetic data                 │                 │
│  │         ↓                                      │                 │
│  │  Save chat log to PostgreSQL                   │                 │
│  └────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RESPONSE TO USER                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  • AI Message: "Generating credit card transaction..."       │  │
│  │  • Schema Preview (editable)                                 │  │
│  │  • Download buttons (CSV/Excel)                              │  │
│  │  • Rating widget (👍/👎)                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    USER RATES RESPONSE                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  User clicks: 👍 Thumbs Up                                   │  │
│  │         ↓                                                    │  │
│  │  Rating saved to PostgreSQL (ai_ratings table)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BACKGROUND: Schema Indexer Workflow                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Periodically runs (or triggered):                           │  │
│  │  1. Find unindexed thumbs-up ratings in PostgreSQL           │  │
│  │  2. Get schema from chat_logs                                │  │
│  │  3. Generate embedding via Ollama                            │  │
│  │  4. Store vector in Qdrant "successful_schemas"              │  │
│  │  5. Mark as indexed in PostgreSQL                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌────────────────────────┐
                    │  CYCLE CONTINUES       │
                    │  AI Gets Smarter! 🧠   │
                    └────────────────────────┘
```

---

## **Without RAG (Before Vector DB):**

```
User: "credit card transactions"
       ↓
AI (using only training data):
       ↓
Generic Schema: [id, name, date, amount]
       ❌ Not specific to credit cards
       ❌ Doesn't learn from past success
```

---

## **With RAG (After Vector DB):**

```
User: "credit card transactions"
       ↓
Vector Search → Finds similar: "payment processing" (85% match)
       ↓
AI sees: "Users liked: transaction_id, merchant, status, amount..."
       ↓
Better Schema: [transaction_id, cardholder_name, merchant, amount, currency, status, transaction_date]
       ✅ Specific to credit cards
       ✅ Learned from past success
       ✅ Better field names
```

---

## **Key Components:**

### 1. **Ollama (Embedding Model)**
- Model: `all-minilm`
- Converts text → 384-dimensional vector
- Fast: ~1-2 seconds per query

### 2. **Qdrant (Vector Database)**
- Stores: Vectors + Metadata (schemas, ratings, timestamps)
- Searches: Cosine similarity (finds "closest" matches)
- Fast: < 100ms for thousands of vectors

### 3. **LangChain (Memory + Agent)**
- Maintains: Chat history across sessions
- Manages: AI agent with tools and memory
- Enhances: System prompts with retrieved examples

### 4. **PostgreSQL (Operational Data)**
- Stores: Chat logs, ratings, feedback
- Tracks: What's been indexed to Qdrant
- Links: Ratings to specific chat sessions

---

## **Data Flow Summary:**

```
User Input → Embedding → Vector Search → Enhanced Context → AI Response → Rating → Future Learning
     ↑                                                                              │
     └──────────────────── Feedback Loop ───────────────────────────────────────────┘
```

**The more users interact and rate, the smarter the AI becomes!** 🚀

