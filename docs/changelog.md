# Changelog

All notable changes to Synthetic Data Generator.

---

## v3.0.0 (April 12, 2026) — **Major**

### Added

- **DataGen Agentic API (`/api/v1`)**  
  FastAPI service with OpenAPI (`/api/v1/openapi.json`), interactive docs, tier **capabilities**, **field-types** catalog, **validate**, **generate** (explicit schema; JSON, CSV, JSONL, Excel, XML), **generate-ai** (column names) with optional **SSE** streaming, **X-API-Key** (including free-key issuance), **Idempotency-Key** + Redis for AI deduplication, structured errors via `Accept: application/vnd.agentic+json`, and **x402** payment flow for agentic paid generation.

- **Model Context Protocol (MCP)**  
  FastMCP layer exposing tools (health, catalog, capabilities, validate, generate, AI generate, AI stream transcript), resources (live field-types, OpenAPI, capabilities), and workflow prompts. **stdio** for local MCP and **HTTP/SSE** mounted at `/mcp` on the API stack.

### Improved

- **Feedback & contact** — Header modal frames product feedback and org/contact outreach; link to the [GitHub repository](https://github.com/shazily/syntheticdatagen) for follow-up. **frontend-v3** aligned.

- **Blog** — Utterances intro on the *Agentic API, MCP, and x402* post shortened (no repo troubleshooting blurb).

---

## v2.3.0 (January 25, 2026)

### Fixed

- **AI Generate Full Data – schema-aware**  
  Generate Full Data in the AI tab now respects the current schema and patterns. The n8n simple generator workflow was updated to read the POST body from either `$input.item.json` (root) or `$input.item.json.body`. Frontend-v3 sends `sampleData` when available so the generator can derive patterns when `fieldPatterns` are not set.

- **Schema Builder preview tabs (TABLE / RAW / SQL)**  
  The preview modal on the Schema Builder tab now correctly switches between TABLE, RAW, and SQL. The `active` class is toggled on both the tab buttons and the corresponding view divs (`#table-view`, `#raw-view`, `#sql-view`).

### Added

- **Simple generator workflow (n8n)**  
  Updated workflow `simple-generator-user-updated.json` supports body-at-root and optional `fieldPatterns` from the request. One workflow serves both Schema Builder (schema-only) and AI Mode (schema + sampleData/fieldPatterns).

---

## v2.2.0 (October 23, 2025)

- AI Mode RAW & SQL tabs  
- SQL export generation (CREATE TABLE + INSERT)  
- Improved modal workflow and preview behavior  
- Additional fixes and UI improvements  

*(See in-app Changelog page for full v2.2.0 details.)*

---

For the full history, use the **Changelog** link in the application.
