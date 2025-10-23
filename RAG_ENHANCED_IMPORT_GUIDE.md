# RAG-Enhanced Workflow Import Guide

## 🚀 **Enhanced AI Generator with Vector Search**

The new `intelligent-generator-v3-dev-RAG-ENHANCED.json` workflow adds **Retrieval-Augmented Generation (RAG)** capabilities to your existing AI data generator.

## ✨ **New Features Added:**

### 1. **Vector Search Integration**
- **Query Embedding**: Converts user prompts to vectors using Ollama `all-minilm` model
- **Similarity Search**: Searches Qdrant for similar successful schemas
- **Context Enhancement**: Injects relevant examples into AI system message

### 2. **Enhanced AI Responses**
- **Smarter Schema Generation**: AI learns from previous successful schemas
- **Better Field Types**: Uses patterns from highly-rated user interactions
- **Contextual Awareness**: Adapts to user's specific domain and requirements

### 3. **Improved Data Quality**
- **Intelligent Fallbacks**: Better handling of unknown field types
- **Weighted Distributions**: Supports complex requirements (e.g., "20% cash, 80% retail")
- **Domain-Specific Logic**: Enhanced generators for financial, loyalty, transaction data

## 📋 **Import Steps:**

### Step 1: Import the Enhanced Workflow
1. Open n8n at `http://localhost:5678`
2. Click **"Import from File"**
3. Select `intelligent-generator-v3-dev-RAG-ENHANCED.json`
4. Click **"Import"**

### Step 2: Activate the Workflow
1. Click the **"Active"** toggle to enable the workflow
2. Verify the webhook URL: `http://localhost:5678/webhook/generate-intelligent-v3`

### Step 3: Test the Enhanced Features
1. Go to your V3 frontend: `http://localhost:3006`
2. Switch to **"A.I Mode"**
3. Try these test prompts:

**Test 1: Credit Card Transactions**
```
Generate credit card transaction data with 50 records, including merchant names, amounts, and transaction types
```

**Test 2: Loyalty Program**
```
Create a loyalty points system dataset with member tiers and point balances
```

**Test 3: Complex Requirements**
```
I need e-commerce order data with 20% premium customers, 80% regular customers, currency in INR
```

## 🔧 **How RAG Enhancement Works:**

### Before (Original):
```
User Prompt → AI Agent → Schema Generation → Data Creation
```

### After (RAG-Enhanced):
```
User Prompt → Vector Embedding → Qdrant Search → Enhanced System Message → AI Agent → Better Schema → Improved Data
```

### Example Enhancement:
**User asks**: "credit card transactions"

**Vector Search finds**:
- Previous successful schema for "payment processing data" (85% similar)
- Schema for "financial transaction records" (78% similar)
- Schema for "merchant payment data" (72% similar)

**AI receives enhanced context**:
```
RELEVANT EXAMPLES FROM SUCCESSFUL SCHEMAS:

Example 1 (85% similar to current request):
User asked for: "payment processing data"
Schema used:
[
  {"name": "transaction_id", "type": "transactionId"},
  {"name": "merchant_name", "type": "merchantName"},
  {"name": "amount", "type": "transactionAmount"},
  {"name": "status", "type": "paymentStatus"}
]
```

**Result**: AI generates more relevant, field-specific schemas based on proven patterns.

## 🎯 **Expected Improvements:**

1. **Better Field Relevance**: AI suggests more appropriate field types
2. **Domain Awareness**: Understands context (financial, e-commerce, healthcare, etc.)
3. **Consistent Quality**: Uses patterns from highly-rated interactions
4. **Faster Learning**: Builds knowledge base from user feedback

## 🔍 **Monitoring RAG Performance:**

### Check Vector Search:
1. Go to Qdrant UI: `http://localhost:6333/dashboard`
2. View `successful_schemas` collection
3. See indexed schemas and their vectors

### Monitor AI Responses:
1. Check n8n execution logs
2. Look for "retrievedExamples" count in responses
3. Verify enhanced system messages in AI Agent node

## 🚨 **Troubleshooting:**

### If Vector Search Fails:
- Check Qdrant is running: `docker ps | findstr qdrant`
- Verify Ollama `all-minilm` model: `ollama list`
- Check n8n execution logs for embedding errors

### If AI Responses Don't Improve:
- Ensure Qdrant has indexed schemas (run rating workflow first)
- Check similarity threshold (currently 0.4 - may need adjustment)
- Verify system message enhancement in logs

## 📊 **Success Metrics:**

- **Retrieval Rate**: How often similar schemas are found
- **Similarity Scores**: Quality of vector matches (aim for >0.6)
- **User Ratings**: Thumbs up rate should improve over time
- **Schema Relevance**: Field types should be more domain-appropriate

---

**Ready to test the enhanced AI with vector-powered intelligence!** 🚀
