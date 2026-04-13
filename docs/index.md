# Synthetic Data Generator

**Version 2.3.0** · AI-powered synthetic data generation with Schema Builder and n8n workflows.

---

## Overview

Synthetic Data Generator is a web-based platform that produces realistic test data via:

- **Schema Builder** – Drag-and-drop schema design, preview (Table / RAW / SQL), and generation.
- **AI Mode** – Natural-language prompts; AI generates schema and sample data; “Generate Full Data” uses the current schema and patterns.

Data can be exported as **CSV**, **Excel**, **JSON**, **XML**, or **SQL** (CREATE TABLE + INSERTs).

---

## Architecture (Docker + n8n)

| Component | Role |
|-----------|------|
| **Frontend** | Nginx serves static UI (ports 3004, 3005, 3006). |
| **n8n** | Runs on host (e.g. port 5678). Webhooks: simple generator + intelligent (RAG) workflow. |
| **Qdrant** | Vector DB (Docker, 6333/6334) for RAG. |
| **Ollama** | LLM on host (e.g. 11434) for AI workflows. |

- **3004 / 3005** → `frontend` (V1 / V2).  
- **3006** → `frontend-v3` (active development).  
- No Flask in Docker; AI and “Generate Full Data” use n8n when running Docker-only.

See [ARCHITECTURE.md](../ARCHITECTURE.md) in the repo root for full details.

---

## Quick Start

1. **Start stack:** `docker compose up -d`  
2. **Run n8n** on the host (e.g. port 5678).  
3. **Import workflows** from `n8n-workflows/` (e.g. `simple-generator-user-updated.json`, intelligent RAG workflow).  
4. **Open app:** `http://localhost:3006` (frontend-v3) or `http://localhost:3005` (frontend).  
5. **Schema Builder:** Add fields → Preview → Generate Data.  
6. **AI tab:** Enter a topic → get schema + preview → “Generate Full Data” for full dataset.

---

## Changelog

### v2.3.0 (January 25, 2026)

- **AI Generate Full Data** – Uses current schema and patterns; n8n simple generator reads request body correctly (root or `.body`); frontend-v3 sends `sampleData` when available.
- **Schema Builder preview** – TABLE / RAW / SQL tabs in the preview modal now switch correctly.
- **Simple generator workflow** – One n8n workflow for both Schema Builder and AI; supports `schema`, `sampleData`, and `fieldPatterns`.

Full changelog: open **Changelog** in the app, or see [changelog.md](changelog.md).

---

## Links

- **Repo:** [GitHub – shazily/syntheticdatagen](https://github.com/shazily/syntheticdatagen)
- **Live:** [datagen.gptlab.ae](https://datagen.gptlab.ae/)  
- **Working files (what’s essential):** [WORKING_FILES.md](../WORKING_FILES.md)  
- **Architecture:** [ARCHITECTURE.md](../ARCHITECTURE.md)  
- **API (Flask):** [API.md](../API.md) (when running `app.py`)
