# Developer Notes - Synthetic Data Generator

## Architecture Overview

This document provides technical context for developers working on or extending the Synthetic Data Generator.

## System Design

### Frontend Architecture

**Technology Stack:**
- Pure HTML/CSS/JavaScript (no frameworks)
- External libraries: PapaParse (CSV), SheetJS (Excel)
- Nginx web server

**Key Components:**

1. **index.html** - Main UI structure
   - Dual-tab interface (Schema Builder + AI Chat)
   - Drag-and-drop field types
   - Chat interface with message history
   - Data preview table

2. **schema-builder.js** - Schema management
   - `SchemaBuilder` class handles:
     - Drag and drop logic
     - Schema state management
     - Field validation
     - Dynamic rendering

3. **app.js** - Application logic
   - n8n webhook communication
   - Data download (CSV/Excel)
   - Chat message management
   - Loading states

4. **style.css** - Modern UI design
   - CSS Grid for layouts
   - Gradient backgrounds
   - Smooth animations
   - Responsive design

### n8n Workflow Architecture

#### Simple Generator Workflow

**Purpose:** Direct data generation without AI interpretation

**Flow:**
```
User Input → Webhook → Data Generator Function → Response
```

**Key Node: Data Generator Function**
- Implements 30+ field type generators
- Pure JavaScript (no external dependencies)
- Deterministic random generation
- Returns JSON array of records

**Generator Pattern:**
```javascript
const generators = {
  fieldType: () => {
    // Generation logic
    return value;
  }
};
```

**Why Pure JavaScript?**
- n8n Function nodes support JavaScript natively
- No need for external Faker.js library
- Faster execution
- No dependency management

#### Intelligent Generator Workflow

**Purpose:** AI-powered schema interpretation from natural language

**Flow:**
```
User Input → Webhook → AI Agent (Ollama) → Response Parser → Data Generator → Response
```

**Key Nodes:**

1. **AI Agent**
   - Uses LangChain agent type
   - Connected to Ollama Chat Model
   - System prompt guides schema generation
   - Maintains conversation context via Chat Memory

2. **Chat Memory (Buffer Window)**
   - Stores last 10 messages
   - Uses custom session ID
   - Enables contextual conversations

3. **Response Parser**
   - Extracts JSON schema from AI response
   - Handles malformed outputs with fallbacks
   - Validates schema structure

4. **Data Generator**
   - Same logic as Simple Generator
   - Processes AI-generated schemas

**AI Prompt Design:**

The system prompt in the AI Agent node is critical:
```
You must respond in this JSON format:
{
  "message": "...",
  "schema": [...],
  "recordCount": number
}
```

**Why This Works:**
- Structured output ensures parsability
- Clear field type constraints
- Examples guide AI behavior
- Fallback logic handles edge cases

### Docker Configuration

**nginx.conf Key Features:**

1. **Static File Serving**
```nginx
root /usr/share/nginx/html;
index index.html;
```

2. **n8n Webhook Proxy**
```nginx
location /webhook/ {
    proxy_pass http://host.docker.internal:5678/webhook/;
    # CORS headers included
}
```

3. **CORS Support**
- Allows cross-origin requests
- Necessary for frontend → n8n communication
- Handles OPTIONS preflight requests

**Docker Networking:**
- Uses `host.docker.internal` to reach host machine
- Allows container to access n8n on host
- Works on Docker Desktop (Mac/Windows)

**For Linux hosts:**
Replace `host.docker.internal` with:
```nginx
proxy_pass http://172.17.0.1:5678/webhook/;
```

## Data Generation Logic

### Field Type Implementation

**Design Pattern:**
Each field type has a generator function:

```javascript
fieldType: () => {
  // 1. Define data source (arrays, ranges)
  // 2. Generate random value
  // 3. Format output
  // 4. Return value
}
```

**Example: Email Generator**
```javascript
email: () => {
  const first = generators.firstName().toLowerCase();
  const last = generators.lastName().toLowerCase();
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com'];
  return `${first}.${last}@${domains[Math.floor(Math.random() * domains.length)]}`;
}
```

**Adding New Field Types:**

1. **Add to Simple Generator (n8n-workflows/simple-generator.json)**
```javascript
// In Data Generator function node
generators.newFieldType = () => {
  // Your logic here
  return value;
};
```

2. **Add to Intelligent Generator (n8n-workflows/intelligent-generator.json)**
```javascript
// In Data Generator function node (same location)
generators.newFieldType = () => {
  // Your logic here
  return value;
};
```

3. **Add to Frontend (frontend/index.html)**
```html
<div class="field-type" draggable="true" data-type="newFieldType">
  <span class="field-icon">🆕</span>
  <span>New Field Type</span>
</div>
```

4. **Add Icon Mapping (frontend/schema-builder.js)**
```javascript
getFieldIcon(fieldType) {
  const iconMap = {
    // ...
    newFieldType: '🆕'
  };
}
```

5. **Update AI System Prompt**
Add `newFieldType` to the list in Intelligent Generator AI Agent node

## Frontend-Backend Communication

### API Contract

**Simple Generator Endpoint:**
```
POST /webhook/generate-simple
Content-Type: application/json

Request:
{
  "schema": [
    {"name": string, "type": string}
  ],
  "recordCount": number (1-10000),
  "exportFormat": "csv" | "excel"
}

Response:
{
  "success": boolean,
  "data": array<object>,
  "recordCount": number,
  "error"?: string
}
```

**Intelligent Generator Endpoint:**
```
POST /webhook/generate-intelligent
Content-Type: application/json

Request:
{
  "chatInput": string,
  "sessionId": string
}

Response:
{
  "response": {
    "message": string,
    "data": array<object>,
    "recordCount": number
  }
}
```

## File Export Implementation

### CSV Export (PapaParse)
```javascript
const csv = Papa.unparse(data);
const blob = new Blob([csv], { type: 'text/csv' });
downloadBlob(blob, filename);
```

**Why PapaParse?**
- Handles edge cases (commas, quotes)
- Proper CSV formatting
- Wide browser support

### Excel Export (SheetJS)
```javascript
const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
```

**Why SheetJS?**
- Native XLSX format support
- No server-side processing needed
- Client-side generation (fast)

## State Management

### Frontend State

**Schema Builder State:**
```javascript
class SchemaBuilder {
  constructor() {
    this.schema = [];  // Current schema configuration
  }
}
```

**Chat State:**
```javascript
let currentGeneratedData = null;  // Last generated dataset
let chatSessionId = `session_${timestamp}_${random}`;  // Conversation ID
```

**Why Minimal State?**
- Simple application doesn't need complex state management
- React/Vue would be overkill
- Performance is excellent

### n8n Workflow State

**Stateless Execution:**
- Each request is independent
- No persistent storage in workflows
- Chat memory handled by LangChain node

**Session Management:**
- Frontend generates unique session IDs
- Chat Memory node uses session ID to maintain context
- n8n handles storage internally

## Performance Considerations

### Data Generation Performance

**Current Limits:**
- Max records: 10,000 per request
- Generation time: ~1-2 seconds for 1,000 records
- Memory usage: ~10MB per 1,000 records

**Bottlenecks:**
1. JavaScript execution in n8n Function nodes
2. JSON serialization for large datasets
3. Browser memory for data preview

**Optimization Strategies:**
- Use streaming for large datasets (future enhancement)
- Implement pagination in data preview
- Add worker threads for generation (future)

### Network Performance

**Current Setup:**
- n8n webhook responses are immediate
- No caching (each request generates fresh data)
- nginx serves static assets efficiently

**Optimization Opportunities:**
- Cache field type generators
- Implement Redis for schema templates
- Use WebSockets for real-time progress

## Security Considerations

### Current Security Measures

1. **Input Validation**
   - Record count: 1-10,000
   - Schema validation in frontend
   - n8n validates JSON structure

2. **CORS Configuration**
   - Allows all origins (localhost deployment)
   - Proper headers for OPTIONS requests

3. **No Authentication**
   - Designed for local use
   - n8n webhooks are unauthenticated

### Production Security Checklist

If deploying to production:

- [ ] Add authentication (API keys)
- [ ] Implement rate limiting
- [ ] Restrict CORS to specific origins
- [ ] Add HTTPS/SSL
- [ ] Sanitize all user inputs
- [ ] Add request logging
- [ ] Implement webhook signatures
- [ ] Add CSRF protection
- [ ] Use environment variables for secrets

## Testing Strategy

### Manual Testing Checklist

**Frontend:**
- [ ] Schema builder drag-and-drop works
- [ ] Field name editing works
- [ ] Remove field works
- [ ] Record count validation (1-10,000)
- [ ] Tab switching works
- [ ] Chat input handles Enter key
- [ ] Loading overlay appears/disappears
- [ ] CSV download works
- [ ] Excel download works
- [ ] Data preview table renders

**n8n Workflows:**
- [ ] Simple generator webhook responds
- [ ] Intelligent generator webhook responds
- [ ] Ollama connection works
- [ ] Chat memory maintains context
- [ ] Data generation is correct
- [ ] Error handling works

**Integration:**
- [ ] Frontend → n8n communication works
- [ ] CORS headers allow requests
- [ ] Downloads include all records
- [ ] File names have timestamps

### Automated Testing

**Currently:** Manual testing only

**Future Enhancements:**
- Add Jest tests for frontend logic
- Add n8n workflow tests
- Add end-to-end tests with Playwright
- Add API contract tests

## Debugging Tips

### Frontend Debugging

**Browser DevTools:**
```javascript
// Check schema state
console.log(schemaBuilder.getSchema());

// Check generated data
console.log(currentGeneratedData);

// Monitor n8n requests
// Network tab → Filter: webhook
```

**Common Issues:**
1. "Cannot read property..." → Check if element exists in DOM
2. CORS error → Check nginx.conf and restart
3. Download not working → Check if data exists

### n8n Workflow Debugging

**Execution Logs:**
1. Open workflow in n8n
2. Click "Executions" (top-right)
3. View latest execution
4. Check each node's input/output

**Function Node Debugging:**
```javascript
// Add console.log (shows in n8n logs)
console.log('Debug:', variable);

// Return early to test
return [{ json: { test: 'value' } }];
```

**Common Issues:**
1. "undefined is not a function" → Check syntax
2. "Cannot read property of undefined" → Check $input.item.json structure
3. Timeout errors → Check Ollama is responding

### Ollama Debugging

**Test Ollama directly:**
```bash
curl http://localhost:11434/api/generate \
  -d '{"model":"llama3.2:latest","prompt":"Hello"}'
```

**Check model:**
```bash
ollama list
```

**Reload model:**
```bash
ollama pull llama3.2:latest
```

## Extension Points

### Adding New Features

**1. Save/Load Schema Templates**
- Add PostgreSQL service to docker-compose
- Create REST API endpoints in new service
- Update frontend to call save/load endpoints

**2. Data Relationships (Foreign Keys)**
- Extend schema builder to define relationships
- Update generator to respect relationships
- Generate parent records first, then children

**3. Custom Field Patterns (Regex)**
- Add regex input in schema builder
- Create regex-based generator
- Validate patterns before generation

**4. Python Code Generation**
- Add new endpoint to n8n workflow
- Generate Python script string
- Include Faker library usage
- Return as downloadable .py file

**5. PostgreSQL Direct Insertion**
- Add PostgreSQL node to n8n workflow
- Generate CREATE TABLE statement
- Insert records in batches
- Return connection details

## Context Retention for AI

**Key Information to Remember:**

1. **n8n Workflow Structure**
   - Webhook → Processing → Response pattern
   - Function nodes contain generators
   - AI Agent uses LangChain integration

2. **Field Type Generators**
   - Defined in Function nodes
   - Pure JavaScript implementation
   - No external dependencies

3. **Frontend Architecture**
   - Vanilla JS (no frameworks)
   - Event-driven design
   - PapaParse + SheetJS for exports

4. **Critical Files**
   - `n8n-workflows/*.json` → n8n workflows (import these)
   - `frontend/app.js` → API calls and downloads
   - `frontend/schema-builder.js` → Drag-drop logic
   - `nginx.conf` → Proxy configuration

5. **Common Modifications**
   - Adding field types → Update generators + frontend + AI prompt
   - Changing n8n URL → Update app.js CONFIG
   - Adding features → Extend n8n workflows first

## Maintenance Notes

### Updating Dependencies

**Frontend Libraries (CDN):**
- PapaParse: Update URL in index.html
- SheetJS: Update URL in index.html

**Docker Images:**
```bash
docker pull nginx:alpine
docker-compose build --no-cache
```

**n8n Version:**
- No dependency on specific n8n version
- Workflows use standard nodes
- Tested with n8n 1.x

### Backup Important Files

**Essential Files:**
1. `n8n-workflows/*.json` → Import these to restore
2. `frontend/*` → All UI code
3. `nginx.conf` → Proxy configuration
4. `README.md` → User documentation
5. This file (DEVELOPER_NOTES.md)

### Version Control Best Practices

**Git Structure:**
```
main branch → Stable releases
develop branch → Active development
feature/* → New features
bugfix/* → Bug fixes
```

**Important .gitignore entries:**
```
node_modules/
.env
*.log
.DS_Store
```

## Troubleshooting Common Development Issues

### Issue: n8n workflows don't import correctly

**Symptoms:** Error when importing JSON
**Cause:** Malformed JSON or version incompatibility
**Solution:**
1. Validate JSON with jsonlint.com
2. Check n8n version (workflows tested with 1.x)
3. Import manually by creating new workflow

### Issue: Generators produce invalid data

**Symptoms:** Data doesn't match expected format
**Cause:** Logic error in generator function
**Solution:**
1. Test generator in isolation
2. Add console.log to debug
3. Check for edge cases (empty arrays, etc.)

### Issue: Chat memory doesn't work

**Symptoms:** AI doesn't remember previous messages
**Cause:** Session ID not passed correctly
**Solution:**
1. Check sessionId in request body
2. Verify Chat Memory node configuration
3. Check n8n execution logs

### Issue: Docker container won't start

**Symptoms:** `docker-compose up` fails
**Cause:** Port conflict or invalid nginx.conf
**Solution:**
```bash
# Check port usage
netstat -an | grep 80

# Test nginx config
docker run --rm -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf nginx:alpine nginx -t

# View detailed logs
docker-compose logs -f
```

---

**Last Updated:** January 2025
**Maintainer:** Development Team
**n8n Version:** 1.x
**Docker Version:** 20.x+

