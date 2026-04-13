# ============================================================
# RECON SUMMARY (Step 0 — read before changing this service)
# ============================================================
# app.py findings:
#   Flask app on PORT default 3005; SQLAlchemy Postgres `DataSchema`; Faker-based
#   `DataGenerator` with snake_case field_types (first_name, num_rows, etc.).
#   Routes: `/`, POST `/api/ai-generate`, `/api/generate-schema`, `/api/generate-data`,
#   `/api/save-schema`, GET `/api/schemas`, GET `/api/field-types`. Separate stack from
#   this FastAPI service (not mounted under /api/v1 here).
#
# ollama_service.py:
#   `OllamaService(host, model)` loads `/api/tags`, exposes `generate_schema_from_request`,
#   `generate_data_samples(schema, num_samples)`, `validate_schema`, and helpers; uses
#   POST `{host}/api/generate` with JSON body. No single-word `generate()` — reuse
#   `generate_data_samples` for per-field fallback (see generator.py).
#
# API.md (planned vs built):
#   Documents Flask `/api/generate-schema`, `/api/generate-data` (num_rows, format),
#   save/list schemas, field-types; mentions future versioning — `/api/v1/` is this
#   new FastAPI surface; old paths remain on Flask if deployed.
#
# frontend/index.html + frontend/app.js webhook contract (n8n simple generator):
#   POST `{n8nBaseUrl}/generate-simple` JSON body:
#   `{ schema: [{name,type,...}], recordCount, exportFormat }` with optional
#   `sampleData`, `fieldPatterns` per n8n workflow. This API accepts the same keys via
#   GenerationRequest aliases (`schema`, `recordCount`, `exportFormat`).
#
# n8n-workflows/simple-generator.json schema fields:
#   Body root / `body`: `schema` (array of fields with at least name, type, optional
#   blankPercentage), `recordCount` (1–10000), `exportFormat` (csv default), optional
#   `sampleData`, `fieldPatterns`. Field `type` strings are camelCase matching the UI
#   (`firstName`, `recordCount` separate from legacy `count`).
#
# ADMIN_IMPLEMENTATION_SUMMARY.md:
#   Admin covers Feedback, Chat Logs, AI Insights, Vector DB via n8n webhooks
#   (`/webhook/admin/*`) and Postgres chat_logs / ai_ratings — not API monetisation.
#   New tab is additive operational visibility for keys, x402, tiers, Stripe placeholder.
#
# docker-compose.yml:
#   Services: `web` :3004, `web-v2` :3005, `web-v3` :3006, `qdrant` :6333/:6334 on
#   `synthetic-data-net`. Appended `redis`, `ollama`, `api` — host ports remapped to
#   avoid conflicts when 6379/11434/8000 were already in use: host Redis :16379,
#   Ollama :21500, FastAPI :18000 (container ports 6379/11434/8000 unchanged; nginx→api
#   still uses http://api:8000 inside the network).
# ============================================================

from __future__ import annotations

import json
import os
from typing import Any
import uuid
from datetime import date

FREE_KEY_MAX_PER_HOUR = int(os.environ.get("FREE_KEY_MAX_PER_HOUR", "30"))
FREE_KEY_WINDOW_SEC = int(os.environ.get("FREE_KEY_WINDOW_SEC", "3600"))


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response, StreamingResponse

from ai_generate_service import (
    faker_fallback_records,
    generate_ai_records,
    infer_schema_from_field_names,
)
from capabilities import EXAMPLE_REQUESTS, FIELD_TYPE_DEFINITIONS, field_visible_for_tier
from config import TIER_CONFIG, X402_PRICING, get_x402_price
from field_type_catalog import catalog_documentation_payload
from idempotency import body_fingerprint, get_cached_json, set_cached_json
from generator import DataGenerator, format_output
from middleware import APIKeyMiddleware, ErrorFormatMiddleware
from models import (
    AiGenerateRequest,
    CapabilityManifest,
    ConversationalError,
    FieldTypeDefinition,
    GenerationRequest,
    GenerationResponse,
)
from validator import validate_request
from x402_middleware import X402Middleware

app = FastAPI(
    title="DataGen Agentic API",
    description="""
Synthetic data generation API for datagen.gptlab.ae.

## Dual-compatible: humans and AI agents

**Human developers**: Use X-API-Key header. Get a free key at GET /api/v1/auth/free-key (rate-limited per client IP; not a login — the key is the credential for API calls).

**AI agents**: Omit X-API-Key on POST /api/v1/generate to receive HTTP 402 with x402 payment
instructions; retry with X-PAYMENT after paying.

## Agent workflow
1. GET /api/v1/capabilities — discover available field types for your tier
2. GET /api/v1/field-types — full catalog of ~50+ canonical field types (documentation)
3. POST /api/v1/validate — dry-run schema check (free)
4. POST /api/v1/generate — generate data from an explicit schema
5. POST /api/v1/generate-ai — pass column names only; AI infers types and generates rows (free: max 100 records)

## Error format
Use `Accept: application/vnd.agentic+json` to receive structured errors with hints.
    """,
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url=None,
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Payment-Required"],
)
app.add_middleware(X402Middleware)
app.add_middleware(APIKeyMiddleware)
app.add_middleware(ErrorFormatMiddleware)

generator = DataGenerator()


async def _open_redis() -> aioredis.Redis | None:
    url = os.getenv("REDIS_URL", "redis://redis:6379")
    client = aioredis.from_url(url, socket_connect_timeout=1.5)
    try:
        await client.ping()
        return client
    except Exception:
        await client.aclose()
        return None


@app.get("/api/v1/capabilities", response_model=None)
async def capabilities(request: Request):
    tier = getattr(request.state, "tier", None) or "free"
    tier_config = TIER_CONFIG.get(tier, TIER_CONFIG["free"])
    visible = [f for f in FIELD_TYPE_DEFINITIONS if field_visible_for_tier(tier, f)]
    typed = [FieldTypeDefinition(**f) for f in visible]
    manifest = CapabilityManifest(
        api_version="1.0.0",
        tier=tier,
        available_field_types=typed,
        supported_locales=[
            {"code": "en_US", "name": "English (United States)"},
            {
                "code": "en_AE",
                "name": "English (UAE)",
                "notes": "Phone requires country_code +971",
            },
            {"code": "en_GB", "name": "English (United Kingdom)"},
            {"code": "ar_AE", "name": "Arabic (UAE)"},
        ],
        limits={k: v for k, v in tier_config.items() if not str(k).startswith("stripe")},
        example_requests=EXAMPLE_REQUESTS,
        payment_options={
            "api_key": {
                "description": "Monthly tier subscription. Get free key at /api/v1/auth/free-key.",
                "tiers": {
                    k: {"price_usd_month": v["price_usd_month"], "max_records": v["max_records_per_call"]}
                    for k, v in TIER_CONFIG.items()
                    if k != "x402"
                },
            },
            "x402": {
                "description": "Pay per call in USDC on Base. No account needed.",
                "pricing": X402_PRICING,
                "how_it_works": "Omit X-API-Key. Server returns 402. Pay. Retry with X-PAYMENT header.",
            },
        },
    )
    return manifest.model_dump()


@app.get("/api/v1/field-types", response_model=None)
async def field_types_catalog() -> dict:
    """Full canonical field type list for integrators and LLM tool docs (not tier-filtered)."""
    return catalog_documentation_payload()


@app.post("/api/v1/generate-ai", response_model=None)
async def generate_ai(request: Request, body: AiGenerateRequest) -> Response:
    """
    AI mode: infer types from field names, then generate values (Ollama) with tier record caps.
    Free tier: max 100 rows per call; Pro/Enterprise: higher limits from config.
    Supports Idempotency-Key (or body fingerprint) for JSON responses when Redis is available.
    """
    tier_config = getattr(request.state, "tier_config", None) or TIER_CONFIG["free"]
    tier = getattr(request.state, "tier", None) or "free"
    agentic = "vnd.agentic+json" in request.headers.get("Accept", "")

    max_ai = int(
        tier_config.get("max_ai_records_per_call") or tier_config.get("max_records_per_call") or 100
    )
    if body.count > max_ai:
        msg = (
            f"AI generation allows at most {max_ai} records per request on your current access tier. "
            "Use a Pro or Enterprise API key for higher volume."
        )
        if agentic:
            return JSONResponse(
                [
                    ConversationalError(
                        message=msg,
                        correction_hint="Lower `count` or upgrade your API key tier.",
                        upgrade_required=True,
                        upgrade_url="https://datagen.gptlab.ae/pricing",
                    ).model_dump()
                ],
                status_code=422,
            )
        return JSONResponse(
            {
                "detail": msg,
                "max_ai_records_per_call": max_ai,
                "upgrade_url": "https://datagen.gptlab.ae/pricing",
            },
            status_code=422,
        )

    idem_raw = (request.headers.get("Idempotency-Key") or "").strip() or body_fingerprint(
        body.model_dump()
    )
    idem_key = f"idem:generate-ai:{tier}:{idem_raw}"[:240]

    if body.output_format == "json":
        r_idem = await _open_redis()
        if r_idem is not None:
            try:
                cached = await get_cached_json(r_idem, idem_key)
                if cached is not None:
                    return JSONResponse(
                        cached,
                        headers={
                            "X-Idempotent-Replay": "1",
                            "Cache-Control": "private, max-age=60",
                        },
                    )
            finally:
                await r_idem.aclose()

    api_key = getattr(request.state, "api_key", None)
    today = date.today().isoformat()

    if api_key:
        max_calls = tier_config.get("max_calls_per_day", 20)
        rlim = await _open_redis()
        if rlim is not None:
            try:
                if max_calls != -1:
                    cur = int(await rlim.get(f"usage:{api_key}:{today}:calls") or 0)
                    if cur >= max_calls:
                        return JSONResponse(
                            {"detail": "Daily API call limit exceeded for this key."},
                            status_code=429,
                        )
            finally:
                await rlim.aclose()

    ollama_base = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama2")

    schema = await infer_schema_from_field_names(
        body.field_names,
        domain_hint=body.domain_hint,
        locale=body.locale,
        ollama_host=ollama_base,
        ollama_model=model,
    )
    if body.locale in ("en_AE", "ar_AE"):
        for row in schema:
            if row.get("type") == "phone":
                row.setdefault("constraints", {})
                row["constraints"]["country_code"] = "+971"
            if row.get("type") == "iban":
                row.setdefault("constraints", {})
                row["constraints"].setdefault("country_prefix", "AE")

    records = await generate_ai_records(
        schema,
        body.count,
        locale=body.locale,
        ollama_host=ollama_base,
        ollama_model=model,
    )
    if len(records) != body.count:
        records = faker_fallback_records(schema, body.count, body.locale)

    gen_id = str(uuid.uuid4())
    usage: dict[str, Any] = {"tier": tier, "generation_mode": "ai"}
    if api_key:
        r = await _open_redis()
        if r is not None:
            try:
                calls = await r.incr(f"usage:{api_key}:{today}:calls")
                await r.incrby(f"usage:{api_key}:{today}:records", body.count)
                await r.expire(f"usage:{api_key}:{today}:calls", 86400 * 2)
                await r.expire(f"usage:{api_key}:{today}:records", 86400 * 2)
                max_calls = tier_config.get("max_calls_per_day", 20)
                usage["calls_today"] = int(calls)
                usage["calls_remaining"] = (
                    max(0, max_calls - int(calls)) if max_calls != -1 else "unlimited"
                )
                usage["records_today"] = int(await r.get(f"usage:{api_key}:{today}:records") or 0)
            finally:
                await r.aclose()
        else:
            usage["redis"] = "unavailable"
            usage["note"] = "Usage counters skipped (Redis unreachable)."
    elif getattr(request.state, "payment_method", None) == "x402":
        usage["payment_hash"] = getattr(request.state, "payment_hash", "")

    of = body.output_format
    if of == "csv":
        text = format_output(records, "csv")
        return PlainTextResponse(
            text or "",
            media_type="text/csv",
            headers={"X-Generation-Id": gen_id, "X-Generation-Mode": "ai"},
        )
    if of == "jsonl":
        text = format_output(records, "jsonl")
        return PlainTextResponse(
            text or "",
            media_type="application/x-ndjson",
            headers={"X-Generation-Id": gen_id, "X-Generation-Mode": "ai"},
        )

    payload = {
        "records": records,
        "inferred_schema": schema,
        "count": len(records),
        "locale": body.locale,
        "tier": tier,
        "usage": usage,
        "generation_id": gen_id,
        "output_format": of,
        "generation_mode": "ai",
    }
    if body.output_format == "json":
        r_store = await _open_redis()
        if r_store is not None:
            try:
                await set_cached_json(r_store, idem_key, payload)
            finally:
                await r_store.aclose()
    return JSONResponse(payload)


@app.post("/api/v1/generate-ai/stream", response_model=None)
async def generate_ai_stream(request: Request, body: AiGenerateRequest) -> StreamingResponse:
    """SSE progress + final JSON payload (same limits as POST /generate-ai)."""
    tier_config = getattr(request.state, "tier_config", None) or TIER_CONFIG["free"]
    tier = getattr(request.state, "tier", None) or "free"
    max_ai = int(
        tier_config.get("max_ai_records_per_call") or tier_config.get("max_records_per_call") or 100
    )
    if body.count > max_ai:
        return JSONResponse(
            {"detail": "count exceeds tier max for AI", "max_ai_records_per_call": max_ai},
            status_code=422,
        )

    api_key = getattr(request.state, "api_key", None)
    today = date.today().isoformat()
    if api_key:
        max_calls = tier_config.get("max_calls_per_day", 20)
        rlim = await _open_redis()
        if rlim is not None:
            try:
                if max_calls != -1:
                    cur = int(await rlim.get(f"usage:{api_key}:{today}:calls") or 0)
                    if cur >= max_calls:
                        return JSONResponse({"detail": "Daily API call limit exceeded for this key."}, status_code=429)
            finally:
                await rlim.aclose()

    ollama_base = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama2")

    async def events():
        yield "event: status\ndata: inferring_schema\n\n"
        schema = await infer_schema_from_field_names(
            body.field_names,
            domain_hint=body.domain_hint,
            locale=body.locale,
            ollama_host=ollama_base,
            ollama_model=model,
        )
        if body.locale in ("en_AE", "ar_AE"):
            for row in schema:
                if row.get("type") == "phone":
                    row.setdefault("constraints", {})
                    row["constraints"]["country_code"] = "+971"
                if row.get("type") == "iban":
                    row.setdefault("constraints", {})
                    row["constraints"].setdefault("country_prefix", "AE")
        yield f"event: schema\ndata: {json.dumps(schema, separators=(',', ':'))}\n\n"
        yield "event: status\ndata: generating_rows\n\n"
        records = await generate_ai_records(
            schema,
            body.count,
            locale=body.locale,
            ollama_host=ollama_base,
            ollama_model=model,
        )
        if len(records) != body.count:
            records = faker_fallback_records(schema, body.count, body.locale)
        gen_id = str(uuid.uuid4())
        usage: dict[str, Any] = {"tier": tier, "generation_mode": "ai"}
        if api_key:
            r = await _open_redis()
            if r is not None:
                try:
                    calls = await r.incr(f"usage:{api_key}:{today}:calls")
                    await r.incrby(f"usage:{api_key}:{today}:records", body.count)
                    await r.expire(f"usage:{api_key}:{today}:calls", 86400 * 2)
                    await r.expire(f"usage:{api_key}:{today}:records", 86400 * 2)
                    max_calls = tier_config.get("max_calls_per_day", 20)
                    usage["calls_today"] = int(calls)
                    usage["calls_remaining"] = (
                        max(0, max_calls - int(calls)) if max_calls != -1 else "unlimited"
                    )
                    usage["records_today"] = int(await r.get(f"usage:{api_key}:{today}:records") or 0)
                finally:
                    await r.aclose()
        elif getattr(request.state, "payment_method", None) == "x402":
            usage["payment_hash"] = getattr(request.state, "payment_hash", "")
        payload = {
            "records": records,
            "inferred_schema": schema,
            "count": len(records),
            "locale": body.locale,
            "tier": tier,
            "usage": usage,
            "generation_id": gen_id,
            "output_format": body.output_format,
            "generation_mode": "ai",
        }
        yield f"event: result\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"
        yield f"event: done\ndata: {json.dumps({'generation_id': gen_id}, separators=(',', ':'))}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/api/v1/generate", response_model=None)
async def generate(request: Request, body: GenerationRequest) -> Response:
    tier_config = getattr(request.state, "tier_config", None) or TIER_CONFIG["free"]
    tier = getattr(request.state, "tier", None) or "free"
    agentic = "vnd.agentic+json" in request.headers.get("Accept", "")

    errors = validate_request(body.schema_fields, body.count, body.locale, tier_config)
    if errors:
        if agentic:
            return JSONResponse([e.model_dump() for e in errors], status_code=422)
        return JSONResponse({"detail": [e.message for e in errors]}, status_code=422)

    api_key = getattr(request.state, "api_key", None)
    today = date.today().isoformat()

    if api_key:
        max_calls = tier_config.get("max_calls_per_day", 20)
        rlim = await _open_redis()
        if rlim is not None:
            try:
                if max_calls != -1:
                    cur = int(await rlim.get(f"usage:{api_key}:{today}:calls") or 0)
                    if cur >= max_calls:
                        return JSONResponse(
                            {"detail": "Daily API call limit exceeded for this key."},
                            status_code=429,
                        )
            finally:
                await rlim.aclose()

    records = generator.generate(
        body.schema_fields,
        body.count,
        body.locale,
        body.output_format,
    )
    gen_id = str(uuid.uuid4())

    usage: dict = {"tier": tier}
    if api_key:
        r = await _open_redis()
        if r is not None:
            try:
                calls = await r.incr(f"usage:{api_key}:{today}:calls")
                await r.incrby(f"usage:{api_key}:{today}:records", body.count)
                await r.expire(f"usage:{api_key}:{today}:calls", 86400 * 2)
                await r.expire(f"usage:{api_key}:{today}:records", 86400 * 2)
                max_calls = tier_config.get("max_calls_per_day", 20)
                usage["calls_today"] = int(calls)
                usage["calls_remaining"] = (
                    max(0, max_calls - int(calls)) if max_calls != -1 else "unlimited"
                )
                usage["records_today"] = int(await r.get(f"usage:{api_key}:{today}:records") or 0)
            finally:
                await r.aclose()
        else:
            usage["redis"] = "unavailable"
            usage["note"] = "Usage counters skipped (Redis unreachable)."
    elif getattr(request.state, "payment_method", None) == "x402":
        usage["payment_hash"] = getattr(request.state, "payment_hash", "")

    of = body.output_format
    if of == "csv":
        text = format_output(records, "csv")
        return PlainTextResponse(
            text or "",
            media_type="text/csv",
            headers={"X-Generation-Id": gen_id},
        )
    if of == "jsonl":
        text = format_output(records, "jsonl")
        return PlainTextResponse(
            text or "",
            media_type="application/x-ndjson",
            headers={"X-Generation-Id": gen_id},
        )

    payload = GenerationResponse(
        records=records,
        count=len(records),
        locale=body.locale,
        tier=tier,
        usage=usage,
        generation_id=gen_id,
        output_format=of,
    )
    return JSONResponse(payload.model_dump())


@app.post("/api/v1/validate", response_model=None)
async def validate_endpoint(request: Request, body: GenerationRequest):
    tier_config = getattr(request.state, "tier_config", None) or TIER_CONFIG["free"]
    errors = validate_request(body.schema_fields, body.count, body.locale, tier_config)
    if errors:
        return JSONResponse([e.model_dump() for e in errors], status_code=422)
    return {
        "valid": True,
        "field_count": len(body.schema_fields),
        "estimated_records": body.count,
    }


@app.get("/api/v1/health")
async def health() -> dict:
    status: dict = {"api": "ok"}
    base = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{base}/api/tags", timeout=3.0)
        status["ollama"] = "ok" if resp.is_success else "error"
    except Exception:
        status["ollama"] = "unreachable"
    r2 = await _open_redis()
    if r2 is not None:
        await r2.aclose()
        status["redis"] = "ok"
    else:
        status["redis"] = "unreachable"
    return status


@app.get("/api/v1/auth/free-key", response_model=None)
async def free_key(request: Request) -> dict | JSONResponse:
    """Issue a low-privilege free-tier key. No user login — in production, per-IP rate limit uses Redis."""
    key = f"DATAGEN-FREE-{uuid.uuid4().hex[:12]}"
    note = (
        "Add X-API-Key header to requests that should use this tier. "
        "This key is not tied to an email; treat it like a password."
    )
    r = await _open_redis()
    if r is None:
        note += " Redis was unreachable; key not persisted server-side and mints are not rate-limited."
        return {
            "api_key": key,
            "tier": "free",
            "limits": {k: v for k, v in TIER_CONFIG["free"].items() if not str(k).startswith("stripe")},
            "docs": "/api/v1/docs",
            "note": note,
        }
    try:
        ip = _client_ip(request)
        rl_key = f"freemint:{ip}"
        n = int(await r.incr(rl_key))
        if n == 1:
            await r.expire(rl_key, FREE_KEY_WINDOW_SEC)
        if n > FREE_KEY_MAX_PER_HOUR:
            return JSONResponse(
                {
                    "error": "Too many free keys requested from this network recently.",
                    "retry_after_sec": FREE_KEY_WINDOW_SEC,
                    "hint": "Use an existing key, wait for the window to reset, or sign in when account-based keys ship.",
                },
                status_code=429,
                headers={"Retry-After": str(FREE_KEY_WINDOW_SEC)},
            )

        try:
            await r.setex(f"apikey:{key}", 365 * 86400, "active")
        except Exception:
            return JSONResponse(
                {"error": "Could not persist key. Retry in a moment."},
                status_code=503,
            )
        return {
            "api_key": key,
            "tier": "free",
            "limits": {k: v for k, v in TIER_CONFIG["free"].items() if not str(k).startswith("stripe")},
            "docs": "/api/v1/docs",
            "note": note,
        }
    finally:
        await r.aclose()


@app.get("/api/v1/pricing")
async def pricing() -> dict:
    return {
        "api_key_tiers": {
            k: {
                "price_usd_month": v["price_usd_month"],
                "max_records_per_call": v["max_records_per_call"],
                "max_calls_per_day": v["max_calls_per_day"],
            }
            for k, v in TIER_CONFIG.items()
            if k != "x402"
        },
        "x402_per_call": X402_PRICING,
        "upgrade_url": "https://datagen.gptlab.ae/pricing",
    }


@app.get("/api/v1/usage", response_model=None)
async def usage(request: Request):
    api_key = getattr(request.state, "api_key", None)
    if not api_key:
        return JSONResponse({"error": "X-API-Key required for usage stats."}, status_code=401)
    tier = getattr(request.state, "tier", "free")
    r = await _open_redis()
    if r is None:
        return JSONResponse({"error": "Redis unavailable for usage stats."}, status_code=503)
    try:
        today = date.today().isoformat()
        calls = int(await r.get(f"usage:{api_key}:{today}:calls") or 0)
        records = int(await r.get(f"usage:{api_key}:{today}:records") or 0)
        max_calls = TIER_CONFIG[tier]["max_calls_per_day"]
        return {
            "tier": tier,
            "key_prefix": api_key[:16] + "...",
            "calls_today": calls,
            "calls_limit": max_calls if max_calls != -1 else "unlimited",
            "records_today": records,
        }
    finally:
        await r.aclose()


@app.get("/api/v1/admin/keys", include_in_schema=False)
async def admin_keys() -> dict:
    """Internal admin UI stub only: returns hard-coded mock rows. Does not mint or list real keys."""
    return {
        "keys": [
            {
                "prefix": "DATAGEN-PRO-********",
                "tier": "pro",
                "issued": date.today().isoformat(),
                "calls_today": 12,
                "records_today": 3400,
                "status": "active",
            },
            {
                "prefix": "DATAGEN-FREE-********",
                "tier": "free",
                "issued": date.today().isoformat(),
                "calls_today": 3,
                "records_today": 120,
                "status": "active",
            },
        ],
        "summary": {
            "api_calls_today": 482,
            "keys_issued": 128,
            "upgrade_candidates": 9,
            "usdc_earned_today_micro": 125000,
        },
    }


@app.post("/api/v1/admin/tier-config", include_in_schema=False)
async def admin_tier_config(request: Request) -> dict:
    """Internal admin UI stub only. TODO: require admin auth before persisting tier config."""
    return {"received": True, "note": "TODO: add admin auth before production"}


@app.post("/api/v1/webhooks/stripe")
async def stripe_webhook() -> dict:
    """Placeholder for Stripe billing webhooks."""
    return {"status": "ignored", "detail": "Payment integration pending"}


@app.get("/")
async def root() -> dict:
    return {"service": "datagen-api", "docs": "/api/v1/docs"}


def custom_openapi() -> dict:
    """Expose optional X-API-Key in OpenAPI so Swagger UI shows Authorize."""
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=getattr(app, "openapi_version", None) or "3.1.0",
        description=app.description,
        routes=app.routes,
    )
    openapi_schema.setdefault("components", {}).setdefault("securitySchemes", {})["XApiKey"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "Optional. Issue a free key: GET /api/v1/auth/free-key",
    }
    openapi_schema["security"] = [{}, {"XApiKey": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
