# Working Files – What You Actually Need

This repo has many files from development and one-off fixes. Use this list to see what’s **core** (required), **docs/config** (useful to keep), and **legacy** (safe to archive or remove). **No app code was changed** when creating this list.

| Category | What to keep |
|----------|----------------|
| **Core** | `frontend/`, `frontend-v3/`, 2–3 n8n workflows, `docker-compose.yml`, `Dockerfile`, `nginx.conf` (+ optional `app.py`, `database/`) |
| **Docs** | `README.md`, `ARCHITECTURE.md`, `API.md`, `docs/`, setup guides you use |
| **Legacy** | Everything else at repo root (fix/debug .md, .js, .py, .txt) – safe to archive or delete |

---

## Core – Required for the app to run

### Frontend (served by Docker)

| Path | Purpose |
|------|--------|
| **frontend/** | Main app (ports 3004, 3005). All files in this folder are used. |
| **frontend-v3/** | Dev app (port 3006). All files in this folder are used. |

**frontend/** and **frontend-v3/** each contain:
- `index.html`, `app.js`, `style.css`, `changelog.html`
- `schema-builder.js`, `modal-functions.js`, `sql-generator.js`, `sql-functions.js`
- `admin.html`, `admin.js`, `admin.css`, `analytics.js`, `domain-management.js`
- `features.html` (frontend only)

### Docker & server

| File | Purpose |
|------|--------|
| `docker-compose.yml` | Defines web (3004), web-v2 (3005), web-v3 (3006), qdrant. |
| `Dockerfile` | Builds nginx image. |
| `nginx.conf` | Serves static files and proxies `/webhook/` to n8n. |

### n8n workflows (import into n8n – only these are needed for the app)

| File | Purpose |
|------|--------|
| **simple-generator-user-updated.json** | Schema Builder + AI “Generate Full Data”. Use this one. |
| **intelligent-generator-v3-rag-fixed-user.json** | AI Mode (schema + preview). |
| simple-generator.json | Alternate simple generator (repo version). |
| intelligent-generator-v3-dev-RAG-ENHANCED.json | Alternate AI workflow. |
| qdrant-schema-indexer.json | RAG – index schemas to Qdrant. |
| schema-seeder.json | Optional – seed Qdrant. |
| intelligent-generator-v3-dev-PROPERLY-CONNECTED.json | Alternate AI workflow. |
| intelligent-generator-v3-rag-learning.json | RAG learning variant. |
| intelligent-generator-v3-rag-fixed.json | Alternate fixed AI workflow. |
| qdrant-embedding-generator.json | RAG – embeddings. |

### Optional backend

| File | Purpose |
|------|--------|
| `app.py` | Flask API (not in Docker; run on host if you want `/api/*`). |
| `requirements.txt` | Python deps for app.py. |
| `env.example` | Example env vars. |
| `database/schema.sql` | DB schema if using PostgreSQL. |
| `ollama_service.py` | Optional Ollama helper. |

### Repo metadata

| File | Purpose |
|------|--------|
| `.gitignore` | Git ignore rules. |
| `LICENSE` | GPL-3.0. |

---

## Docs & config – Useful to keep

| File / folder | Purpose |
|---------------|--------|
| **README.md** | Main repo page (GitHub). |
| **ARCHITECTURE.md** | Docker + n8n architecture. |
| **API.md** | API description (Flask). |
| **WORKING_FILES.md** | This file. |
| **docs/index.md** | GitHub Pages landing. |
| **docs/changelog.md** | Changelog (markdown). |
| DEVELOPER_NOTES.md | Dev notes. |
| DEPLOYMENT.md, DEPLOYMENT_CHECKLIST.md | Deployment. |
| QUICKSTART.md, START_HERE.md | Getting started. |
| QDRANT_*.md, RAG_*.md, IMPORT_*.md | Qdrant/RAG/import setup. |
| setup-github.md, setup-github.ps1, setup-github.sh, setup.bat, setup.sh | Repo/setup scripts. |
| seed-quality-schemas.json | Seed data for RAG. |
| scripts/ | Setup scripts (e.g. Qdrant). |

---

## Legacy – Safe to archive or remove

Any root-level file not listed in **Core** or **Docs & config** above is legacy: one-off fixes, debug scripts, or old workflows. The app does **not** depend on them. Move to an `archive/` folder or delete after backing up if you want a cleaner repo.

### Root-level fix/debug scripts (JS, PY, TXT)

- `BUILD_ENHANCED_SYSTEM_MESSAGE_*.js`
- `CODE_IN_JAVASCRIPT_NODE*.js`
- `DATA_GENERATOR_*.txt`, `DATA_GENERATOR_*.md`
- `data-generator-locale-fix.js`
- `DEBUG_*.js`, `DEBUG_*.md`
- `ENHANCED_JSON_EXTRACTOR.js`
- `FIX_*.md`, `FIX_*.js`, `FIX_*.py`, `FIXED_*.js`, `FIXED_*.md`
- `feedback-only.js`
- `NODE_1_*.js`, `NODE_2_*.js`, `NODE_2_*.py`
- `RESPONSE_PARSER_*.js`, `RESPONSE_PARSER_*.txt`
- `check_*.py`, `fix_*.py`
- `response_body.json`

### Root-level docs (one-off plans / debug)

- `ADMIN_IMPLEMENTATION_SUMMARY.md`
- `BETTER_PARSING_STRATEGY.md`, `browser_test_plan.md`
- `COMPREHENSIVE_TEST_PLAN.md`, `CORRECT_SETUP.md`
- `CRITICAL_*.md`, `CURRENT_STATUS_ANALYSIS.md`
- `CUSTOM_PARSER_STRATEGY.md`
- `DATABASE_CONFIGURATION.md`
- `DEBUG_*.md`, `DIAGNOSTIC_CHECKLIST.md`
- `DOMAIN_REGISTRY_SYSTEM.md`
- `FINAL_*.md`, `FIX_*.md`, `FIXED_*.md`
- `IMPLEMENT_*.md`, `IMPLEMENTATION_SUMMARY.md`
- `IMPORT_*.md` (except if you use them as setup guides)
- `N8N_CODE_NODE_SYNTAX.md`, `NODE_UPDATE_INSTRUCTIONS.md`
- `NEW_STRATEGY_EXPLANATION.md`
- `OUTPUT_PARSER_ANALYSIS.md`
- `PHASE_3_PLAN.md`, `PLAN_*.md`
- `PROBLEM_*.md`
- `QDRANT_*.md` (keep only if you use them; rest can go to archive)
- `RAG_*.md` (same)
- `SCHEMA-MODIFICATION-FIX-PLAN.md`
- `TEST_*.md`, `TESTING_GUIDE.md`
- `V2-CHANGES.md`, `VECTOR_*.md`

### n8n-workflows – duplicates / old / test (not needed for main app)

Keep only the **core** workflows listed above. The rest can be archived or removed:

- `*-backup.json`, `*-FIXED.json`, `*-CORRECT.json`, `*-FIXED.json`
- `claude-version.json`, `rag-*.json`, `test-*.json`, `debug-*.json`
- `domain-manager-*.json`, `add-domain.json`, `update-domain*.json`, `get-domains-registry.json`, `cleanup-duplicates.json`
- `generate-single-schema*.json`, `llm-schema-generator.json`
- `simple-test-*.json`, `test-import.json`, `test-embedding.json`, `test-vector-storage.json`, `test-simple-response.json`

### Other

- **synthetic-data-generator/** – Nested folder with duplicate n8n workflows; can be removed or merged into `n8n-workflows/` if needed.
- **qdrant_storage/** – Vector DB data; keep if you use Qdrant and want to persist data; can be recreated.

---

## Summary

- **Core:** `frontend/`, `frontend-v3/`, key files in `n8n-workflows/`, `docker-compose.yml`, `Dockerfile`, `nginx.conf`, optional `app.py` and related.
- **Docs/config:** `README.md`, `ARCHITECTURE.md`, `API.md`, `docs/`, and the other docs/setup files you still use.
- **Legacy:** Root-level fix/debug scripts and one-off .md files, plus duplicate/old/test n8n workflows; safe to archive or delete after backup.

To clean up: create an `archive/` (or `legacy/`) folder, move the legacy files there or delete them, then commit. The app will still run from the **core** set above.
