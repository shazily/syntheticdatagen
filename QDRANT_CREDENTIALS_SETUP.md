# Qdrant Credentials Setup for n8n

## Required Credentials

The n8n Qdrant Vector Store node requires Qdrant API credentials. You need to set up these credentials in n8n:

### 1. Create Qdrant API Credentials

1. Go to n8n Settings → Credentials
2. Click "Create New Credential"
3. Search for "Qdrant"
4. Select "Qdrant API"
5. Fill in the following details:

**Credential Name:** `Qdrant API`

**Configuration:**
- **URL:** `http://host.docker.internal:6333`
- **API Key:** (leave empty - not required for local Qdrant)
- **Timeout:** `30000` (30 seconds)

### 2. Alternative: Use Environment Variables

If you prefer to use environment variables, add these to your n8n environment:

```bash
QDRANT_URL=http://host.docker.internal:6333
QDRANT_API_KEY=
```

### 3. Test the Connection

After setting up credentials, test the connection by:

1. Import the `domain-manager-native-qdrant.json` workflow
2. Activate the workflow
3. Test with a simple request

## Why This Approach is Better

The n8n native Qdrant Vector Store node:
- ✅ Handles vector storage properly
- ✅ Manages document formatting automatically  
- ✅ Provides better error handling
- ✅ Supports metadata filtering
- ✅ Is more reliable than HTTP Request nodes

## Next Steps

1. Set up the Qdrant credentials in n8n
2. Import the new workflow
3. Test vector storage
4. Verify embeddings are properly stored
