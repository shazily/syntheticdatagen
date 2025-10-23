# 🚀 Synthetic Data Generator v2.2.0

![Version](https://img.shields.io/badge/version-2.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![AI Powered](https://img.shields.io/badge/AI-powered-orange)

An intelligent, web-based synthetic data generation platform featuring dual interfaces: a drag-and-drop schema builder and an AI-powered chat interface. Generate realistic test data in multiple formats with advanced features like SQL export, JSON/XML support, and vector database integration.

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
┌─────────────┐      ┌──────────┐      ┌─────────┐      ┌──────────────┐
│   Frontend  │─────▶│   n8n    │─────▶│ Ollama  │─────▶│ Generated    │
│  (Nginx)    │      │ Webhooks │      │   LLM   │      │ Data (Multi) │
└─────────────┘      └──────────┘      └─────────┘      └──────────────┘
       │                    │
       │                    ▼
       │              ┌─────────┐
       │              │ Qdrant  │
       │              │ Vector  │
       └─────────────▶│   DB    │
                      └─────────┘
```

## 🎯 Key Features

### 🤖 **AI-Powered Generation**
- Natural language processing with Ollama LLM
- Intelligent schema interpretation and creation
- RAG system for continuous learning

### 🎯 **Drag & Drop Builder**
- Visual schema builder with 30+ field types
- Real-time preview and modification
- Custom field type definitions

### 📊 **Multiple Export Formats**
- **CSV** - Comma-separated values
- **Excel** - XLSX format with formatting
- **JSON** - Structured data format
- **XML** - Extensible markup language
- **SQL** - CREATE TABLE and INSERT statements

### 🗄️ **SQL Query Generation**
- Automatic CREATE TABLE statements
- INSERT statements with proper escaping
- Database-ready SQL output

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** installed
- **n8n** running locally (default port 5678)
- **Ollama** running locally with llama3.2:latest model
- **Qdrant** (optional, for RAG features)

### Installation (3 Steps)

#### Step 1: Clone and Start
```bash
git clone https://github.com/yourusername/synthetic-data-generator.git
cd synthetic-data-generator
docker-compose up -d
```

The application will be available at: **http://localhost**

#### Step 2: Import n8n Workflows
1. Open n8n: http://localhost:5678
2. Import essential workflows from `n8n-workflows/`:
   - `intelligent-generator-v3-dev-RAG-ENHANCED.json` (AI Mode)
   - `simple-generator.json` (Schema Builder)
   - `qdrant-schema-indexer.json` (RAG System)
   - `schema-seeder.json` (Database Seeding)
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

```
synthetic-data-generator/
├── frontend/                    # Production frontend
│   ├── index.html              # Main application
│   ├── app.js                  # Core application logic
│   ├── style.css               # Styling
│   ├── schema-builder.js       # Drag-drop functionality
│   ├── modal-functions.js      # Modal interactions
│   ├── sql-generator.js        # SQL generation
│   └── changelog.html          # Version history
├── frontend-v3/                # Development frontend
├── n8n-workflows/              # n8n workflow definitions
│   ├── intelligent-generator-v3-dev-RAG-ENHANCED.json
│   └── simple-generator.json
├── database/                   # Database schemas
├── qdrant_storage/             # Vector database storage
├── docker-compose.yml          # Docker configuration
├── Dockerfile                  # Container build
├── nginx.conf                  # Web server config
└── README.md                   # This file
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

MIT License - See [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and `DEVELOPER_NOTES.md`
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact the maintainer for enterprise support

## 🙏 Acknowledgments

- **n8n** - Workflow automation platform
- **Ollama** - Local LLM inference
- **Qdrant** - Vector database for RAG
- **Docker** - Containerization platform
- **Community** - All contributors and users

---

**Built with ❤️ using n8n, Ollama, Qdrant, Docker, and modern web technologies**

**Last Updated:** October 23, 2025