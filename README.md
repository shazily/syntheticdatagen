# 🚀 Synthetic Data Generator v3.0.0

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![AI Powered](https://img.shields.io/badge/AI-powered-orange)

**Live:** [datagen.gptlab.ae](https://datagen.gptlab.ae/) · **Repository:** [github.com/shazily/syntheticdatagen](https://github.com/shazily/syntheticdatagen)

📋 **Too many files?** See **[WORKING_FILES.md](WORKING_FILES.md)** for a list of what’s essential (core app, docs, and what’s safe to archive).

An intelligent synthetic data platform: **Schema Builder** and **AI Mode** in the browser, plus a versioned **HTTP API** (`/api/v1`) and **Model Context Protocol (MCP)** server for agents, scripts, and IDEs. Export CSV, Excel, JSON, XML, or SQL; optional **Qdrant** RAG and **n8n** workflows power the chat experience.

## 🔌 Agentic API & MCP (v3)

- **REST API** — FastAPI service (`api/`, Docker `api` service, default host port **18000** in `docker-compose.yml`). OpenAPI at `/api/v1/openapi.json`, interactive docs at `/api/v1/docs`. Supports capabilities, field-type catalog, validate, generate (explicit schema), generate-ai (column names), optional SSE streaming, API keys (including free tier), idempotency, structured agent errors, and optional **x402** flows where configured.
- **MCP** — `datagen_mcp_app.py` exposes tools, resources, and prompts; **stdio** connector under `mcp_datagen/`. HTTP/SSE is mounted on the API process (e.g. `/mcp` behind nginx). See `frontend/api-developer-info.html` and `frontend/mcp-developer-info.html` in the static site for human-readable overviews.
- **Do not commit** local vector data: `qdrant_storage/` is listed in `.gitignore`; keep secrets in `.env` (see `env.example`), never in the repo.

### Safe rollout flags (touchless default)

- `AGENTIC_LINEAGE_ENABLED=0` by default and only active when `DATAGEN_ENV=staging` (or `AGENTIC_LINEAGE_STAGE` override).
- `AGENTIC_ESCROW_ENABLED=0` by default; when enabled it adds invoice-style 402 **only** on canary `POST /api/v1/canary/generate` (`AGENTIC_ESCROW_CANARY_PATH`). Default **x402 facilitator** middleware stays on `/api/v1/generate` and generate-ai paths so existing keyless flows are unchanged.
- Runtime rollback toggles (Redis-backed): `lineage_enabled` and `canary_escrow_enabled` via `POST /api/v1/admin/agentic/toggles`.
- Observability snapshot: `GET /api/v1/admin/agentic/metrics` returns phase metrics and current toggle states.
- Contract deployment helper: `scripts/deploy_escrowx402.py` (Base Sepolia defaults; explicit env vars required).

## ✨ Key Features

### 🎯 **Dual Generation Modes**
- **Schema Builder** - Visual drag-and-drop interface for precise data control
- **AI Mode** - Natural language data generation with intelligent schema interpretation
- **Fast Generation** - Optimized for speed with deterministic and AI-powered options

### 📊 **Comprehensive Export Formats**
- **CSV** - Comma-separated values
- **Excel** - XLSX format with formatting
- **JSON** - Pretty-formatted JSON with proper structure
- **XML** - Well-structured XML with proper escaping
- **SQL** - Complete CREATE TABLE and INSERT statements

### 🤖 **AI-Powered Intelligence**
- **Natural Language Processing** - Describe your data needs in plain English
- **Smart Schema Generation** - AI interprets requirements and creates appropriate schemas
- **RAG System** - Retrieval Augmented Generation for improved AI responses
- **Vector Database** - Qdrant integration for schema learning and optimization

### 🛠️ **Advanced Features**
- **30+ Field Types** - Personal, business, financial, technical data types
- **Custom Field Types** - Define your own data generation patterns
- **Real-time Preview** - See generated data before downloading
- **Schema Modification** - Edit AI-generated schemas on the fly
- **1-10,000 Records** - Flexible record count generation
- **Admin Analytics Dashboard** - Monitor usage, feedback, and AI performance
- **Vector Database Integration** - RAG system for continuous AI learning
- **Modern UI** - Professional, responsive interface design

## 🏗️ Architecture

```
┌─────────────┐   ┌──────────────┐      ┌──────────┐      ┌─────────┐      ┌──────────────┐
│   Frontend  │   │ FastAPI    │      │   n8n    │─────▶│ Ollama  │─────▶│ Generated    │
│  (Nginx)    │──▶│ /api/v1+MCP │      │ Webhooks │      │   LLM   │      │ Data (Multi) │
└─────────────┘   └──────────────┘      └──────────┘      └─────────┘      └──────────────┘
       │                  │                  │
       │                  │                  ▼
       │                  │            ┌─────────┐
       │                  └───────────▶│ Qdrant  │
       │                                │ Vector  │
       └────────────────────────────────│   DB    │
                                        └─────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** installed
- **n8n** running locally (default port 5678)
- **Ollama** running locally with llama3.2:latest model
- **Qdrant** (optional, for RAG features)

### Installation (3 Steps)

#### Step 1: Clone and Start
```bash
git clone https://github.com/shazily/syntheticdatagen.git
cd syntheticdatagen
docker compose up -d
```

The UI is served on **http://localhost:3004** and **http://localhost:3005** (same `frontend/` bundle). **http://localhost:3006** serves `frontend-v3/`. The **API** listens on **http://localhost:18000** (see `docker-compose.yml` host port mapping). Qdrant and Redis use published ports in the compose file for local development.

#### Step 2: Import n8n Workflows
1. Open n8n: http://localhost:5678
2. Import essential workflows from `n8n-workflows/`:
   - **`simple-generator-user-updated.json`** – Schema Builder + AI “Generate Full Data” (single workflow for both)
   - **`intelligent-generator-v3-rag-fixed-user.json`** or `intelligent-generator-v3-dev-RAG-ENHANCED.json` – AI Mode (schema + preview)
   - `qdrant-schema-indexer.json` (RAG)
   - `schema-seeder.json` (optional, database seeding)
3. **Activate all workflows** (toggle switch)

#### Step 3: Configure AI Integration
1. **Ollama Setup:**
   ```bash
   ollama pull llama3.2:latest
   ```

2. **n8n Credentials:**
   - Open "Intelligent Generator" workflow
   - Configure "Ollama Chat Model" node:
     - **Base URL**: `http://localhost:11434`
     - **Model**: `llama3.2:latest`

3. **Qdrant Setup (Optional):**
   ```bash
   # Run Qdrant with Docker
   docker run -p 6333:6333 qdrant/qdrant
   ```

That's it! 🎉 You're ready to generate data.

## 📖 Usage Guide

### Method 1: Schema Builder (Precise Control)

1. **Navigate to Schema Builder Tab**
2. **Drag field types** from the left panel to your schema
3. **Customize field names** and properties
4. **Set record count** (1-10,000)
5. **Choose export format** (CSV, Excel, JSON, XML)
6. **Click "Generate Data"**

**Perfect for:**
- Testing applications with specific data requirements
- Creating structured datasets for development
- Generating data with exact field specifications

### Method 2: AI Mode (Intelligent Generation)

1. **Navigate to AI Chat Tab**
2. **Describe your data needs** in natural language
3. **AI generates schema** and creates preview
4. **Modify schema** if needed (add fields, change types)
5. **Generate full dataset** with optimized speed
6. **Download** in your preferred format

**Example Prompts:**
- "Generate 500 customer records with names, emails, addresses, and phone numbers"
- "Create employee data for a tech company with 200 records including departments, salaries, and start dates"
- "Generate financial transaction data with amounts, dates, currencies, and transaction IDs"

### Method 3: Admin Analytics Dashboard

Access the admin dashboard at `/admin.html` to monitor:

#### 📊 **Usage Analytics**
- 💬 **Total Chats** - Track conversation count and engagement
- ✅ **Success Rate** - Monitor AI generation success percentage
- 👍 **User Feedback** - Thumbs up/down ratings and comments
- ⭐ **Quality Ratings** - Star ratings for generated data quality

#### 🧠 **AI Performance Monitoring**
- 📈 **Performance Charts** - Visual analytics for AI effectiveness
- 🎯 **Success vs Errors** - Error rate tracking and analysis
- 📝 **Top Requested Topics** - Most popular data generation requests
- 🔍 **Chat Log Analysis** - Detailed conversation history and patterns

#### 🗄️ **Vector Database Management**
- 🏢 **Domain Collections** - Manage different data domains
- 📊 **Vector Statistics** - Total domains, vectors, and collection status
- 🔄 **Update Existing** - Refresh and improve existing domain knowledge
- ➕ **Add New Domains** - Expand AI knowledge base with new data types

#### 📥 **Data Export & Management**
- 📊 **Feedback Export** - Download user feedback as CSV
- 🔍 **Search & Filter** - Find specific conversations and feedback
- 📈 **Analytics Export** - Export performance data for reporting
- 🎛️ **System Controls** - Manage RAG system and AI learning

**Perfect for:**
- Monitoring platform usage and performance
- Analyzing AI effectiveness and user satisfaction
- Managing the RAG system and vector database
- Exporting analytics data for reporting

## 🎨 Supported Field Types

### Personal Data
- **Names** - First Name, Last Name, Full Name
- **Contact** - Email Address, Phone Number, Address
- **Demographics** - Gender, Age, Birthdate

### Business Data
- **Company** - Company Name, Industry, Website
- **Employment** - Job Title, Department, Salary
- **Professional** - LinkedIn Profile, Skills

### Financial Data
- **Payment** - Credit Card, IBAN, Account Number
- **Transactions** - Amount, Currency, Transaction ID
- **Business** - Invoice Number, Tax ID, Ledger Code

### Technical Data
- **Identifiers** - UUID, Username, IP Address
- **Network** - URL, Domain, Email Domain
- **System** - Timestamp, Date, DateTime

### Custom Types
- **User-Defined** - Create your own field patterns
- **Flexible** - Adapt to any data requirement

## 🔧 Configuration

### Environment Variables
Create a `.env` file:
```env
N8N_BASE_URL=http://localhost:5678
OLLAMA_BASE_URL=http://localhost:11434
QDRANT_URL=http://localhost:6333
```

### Custom Ports
**File:** `docker-compose.yml`
```yaml
ports:
  - "8080:80"  # Change to your desired port
```

### HTTPS Setup
1. Add SSL certificates to `ssl/` directory
2. Update `nginx.conf` with SSL configuration
3. Update `docker-compose.yml` to expose port 443

## 🐛 Troubleshooting

### Common Issues

**Frontend not loading:**
```bash
docker ps  # Check container status
docker logs synthetic-data-web  # View logs
docker-compose restart  # Restart services
```

**n8n webhooks not responding:**
- Verify workflows are activated in n8n
- Check n8n logs for execution errors
- Test webhooks directly with curl

**AI Mode not working:**
- Ensure Ollama is running: `curl http://localhost:11434/api/tags`
- Check model is available: `ollama list`
- Pull model if missing: `ollama pull llama3.2:latest`

**CORS errors:**
- Clear browser cache
- Restart nginx: `docker-compose restart`
- Check `nginx.conf` CORS headers

### Testing Workflows

**Simple Generator:**
```bash
curl -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{
    "schema": [
      {"name": "name", "type": "firstName"},
      {"name": "email", "type": "email"}
    ],
    "recordCount": 10,
    "exportFormat": "csv"
  }'
```

**Intelligent Generator:**
```bash
curl -X POST http://localhost:5678/webhook/generate-intelligent \
  -H "Content-Type: application/json" \
  -d '{
    "chatInput": "Generate 10 customer records",
    "sessionId": "test_session"
  }'
```

## 📁 Project Structure

See **[WORKING_FILES.md](WORKING_FILES.md)** for a list of core vs optional vs legacy files.

**Core (required for the app):**
```
├── frontend/                    # Production static UI (ports 3004, 3005)
│   ├── index.html, app.js, style.css, changelog.html, features.html
│   ├── api-developer-info.html, mcp-developer-info.html, blog/
│   ├── schema-builder.js, modal-functions.js, sql-generator.js, analytics.js
│   ├── admin.html, admin.js, admin.css, domain-management.js
├── frontend-v3/                 # Alternate UI (port 3006)
├── api/                         # FastAPI Agentic API + MCP mount (Dockerfile.api)
├── mcp_datagen/                 # stdio MCP connector (env: DATAGEN_API_BASE, DATAGEN_API_KEY)
├── n8n-workflows/               # Import into n8n
│   ├── simple-generator-user-updated.json   # Schema Builder + AI full data
│   ├── intelligent-generator-v3-rag-fixed-user.json  # AI Mode (examples)
│   ├── qdrant-schema-indexer.json, schema-seeder.json (optional)
├── database/schema.sql
├── docker-compose.yml, Dockerfile, Dockerfile.api, nginx.conf
├── app.py, requirements.txt, env.example   # Legacy Flask surface (optional)
└── docs/                        # changelog.md, index.md
```

## 🚀 Deployment

### Production Deployment
```bash
# Build and start production containers
docker-compose -f docker-compose.prod.yml up -d

# Or use the provided script
./deploy-production.sh
```

### Development Setup
```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Restart services
docker-compose restart
```

## 🔄 Version History

### v3.0.0 (April 12, 2026) — Major
- **Agentic REST API** — `/api/v1` FastAPI surface with OpenAPI, validate, generate, generate-ai, SSE, keys, idempotency (Redis), structured errors, x402 path.
- **MCP** — FastMCP tools/resources/prompts; stdio and HTTP/SSE.
- **Site** — Features page and nav updates; feedback/contact modal; changelog alignment.

### v2.3.0 (January 25, 2026)
- 🔧 **AI Generate Full Data** – Uses current schema and patterns; n8n simple generator reads request body correctly (root or `.body`).
- 🔧 **Schema Builder preview** – TABLE / RAW / SQL tabs in the preview modal now switch correctly.
- ✨ **Simple generator workflow** – `simple-generator-user-updated.json` serves both Schema Builder and AI Mode; supports `schema`, `sampleData`, `fieldPatterns`.

### v2.2.0 (October 23, 2025)
- ✨ **JSON & XML Export** - Added comprehensive export formats
- ⚡ **AI Mode Speed Optimization** - Fast generation for full datasets
- 🔧 **Enhanced Modal Workflow** - Streamlined preview experience
- 📊 **SQL Export Generation** - Complete SQL statement generation
- 🎨 **Consistent UI Icons** - Professional tab icons across all interfaces

### v2.1.0 (October 22, 2025)
- 🔧 **Fixed Tab States** - Corrected modal tab active states
- 📱 **Improved Responsiveness** - Better mobile experience
- 🐛 **Bug Fixes** - Various UI and functionality improvements

### v2.0.0 (October 15, 2025)
- 🎉 **Major Release** - Complete platform rewrite
- 🤖 **AI Integration** - Ollama LLM integration
- 📊 **Vector Database** - Qdrant RAG system
- 🎨 **Modern UI** - Professional interface design

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Areas for Contribution
- Add new field types
- Improve AI prompts
- Enhance UI/UX
- Add data validation
- Create schema templates
- Write tests

## 📄 License

GPL-3.0 - See [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: This README, `docs/`, and `DEVELOPER_NOTES.md` (if present)
- **Issues**: [GitHub Issues](https://github.com/shazily/syntheticdatagen/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shazily/syntheticdatagen/discussions)

## 🙏 Acknowledgments

- **n8n** - Workflow automation platform
- **Ollama** - Local LLM inference
- **Qdrant** - Vector database for RAG
- **Docker** - Containerization platform
- **Community** - All contributors and users

---

**Built with ❤️ using n8n, Ollama, Qdrant, Docker, and modern web technologies**

**Last Updated:** April 12, 2026