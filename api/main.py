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

import hashlib
import json
import os
import re
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
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response, StreamingResponse

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
    AiInferSchemaRequest,
    AiInferSchemaResponse,
    AiGenerateRequest,
    CapabilityManifest,
    ConversationalError,
    FieldDefinition,
    FieldTypeDefinition,
    GenerationRequest,
    GenerationResponse,
)
from validator import validate_request
from x402_middleware import X402Middleware
from openapi_context import (
    build_openapi_description,
    generation_402_response,
    openapi_payment_components,
    payment_public_snapshot,
)
from agentic.lineage import issue_lineage_receipt
from agentic.payment_required_402 import PaymentRequired402Middleware
from agentic.settlement_guard import (
    SettlementContext,
    SettlementGuardError,
    guard_settlement_before_generation,
)

AGENTIC_ESCROW_ENABLED = os.getenv("AGENTIC_ESCROW_ENABLED", "0").lower() in (
    "1",
    "true",
    "yes",
    "on",
)
AGENTIC_LINEAGE_ENABLED = os.getenv("AGENTIC_LINEAGE_ENABLED", "0").lower() in (
    "1",
    "true",
    "yes",
    "on",
)
DATAGEN_ENV = os.getenv("DATAGEN_ENV", "development").strip().lower()
AGENTIC_LINEAGE_STAGE = os.getenv("AGENTIC_LINEAGE_STAGE", "staging").strip().lower()
AGENTIC_ESCROW_CANARY_PATH = os.getenv("AGENTIC_ESCROW_CANARY_PATH", "/api/v1/canary/generate")

_OPENAPI_TAGS = [
    {
        "name": "Discovery",
        "description": "Capabilities, catalog, health, auth, pricing — start here for agents.",
    },
    {
        "name": "Generation",
        "description": (
            "Core synthetic data endpoints. Without `X-API-Key`, x402-protected POST routes return **402** "
            "with facilitator `accepts[]`; optional escrow canary returns an on-chain invoice JSON."
        ),
    },
    {"name": "Admin", "description": "Internal / operator routes (hidden from OpenAPI when `include_in_schema=False`)."},
]

app = FastAPI(
    title="DataGen Agentic API",
    description=(
        "Synthetic data API — full contract (x402, Base Sepolia defaults, escrow canary) is injected into "
        "`info.description` when OpenAPI is built so [Swagger](/api/v1/docs) always matches this deployment."
    ),
    version="1.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/v1/openapi.json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Payment-Required"],
)
app.add_middleware(X402Middleware)
if AGENTIC_ESCROW_ENABLED:
    app.add_middleware(PaymentRequired402Middleware)
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


async def _runtime_toggle(name: str, default: bool) -> bool:
    redis_client = await _open_redis()
    if redis_client is None:
        return default
    try:
        raw = await redis_client.get(f"agentic:toggle:{name}")
        if raw is None:
            return default
        value = str(raw).strip().lower()
        return value in ("1", "true", "yes", "on")
    except Exception:
        return default
    finally:
        await redis_client.aclose()


async def _metric_incr(name: str, amount: int = 1) -> None:
    redis_client = await _open_redis()
    if redis_client is None:
        return
    try:
        await redis_client.incrby(f"agentic:metric:{name}", amount)
    except Exception:
        return
    finally:
        await redis_client.aclose()


async def _lineage_enabled_now() -> bool:
    if not AGENTIC_LINEAGE_ENABLED:
        return False
    if DATAGEN_ENV != AGENTIC_LINEAGE_STAGE:
        return False
    return await _runtime_toggle("lineage_enabled", True)


async def _escrow_canary_enabled_now() -> bool:
    if not AGENTIC_ESCROW_ENABLED:
        return False
    return await _runtime_toggle("canary_escrow_enabled", True)


def _extract_payment_tx_hash(request: Request, body: GenerationRequest | AiGenerateRequest) -> str:
    tx_hash = (getattr(body, "payment_tx_hash", None) or "").strip()
    if tx_hash:
        return tx_hash
    payment_header = (request.headers.get("X-PAYMENT") or "").strip()
    if payment_header.startswith("0x") and len(payment_header) == 66:
        return payment_header
    return ""


def _lineage_payload(
    *,
    generation_engine: str,
    model_version: str,
    field_names: list[str],
    record_count: int,
) -> dict[str, Any] | None:
    if not AGENTIC_LINEAGE_ENABLED:
        return None
    try:
        receipt = issue_lineage_receipt(
            generation_engine=generation_engine,
            model_version=model_version,
            field_names=field_names,
            record_count=record_count,
        )
        return {
            "generation_engine": receipt.generation_engine,
            "model_version": receipt.model_version,
            "timestamp_iso": receipt.timestamp_iso,
            "sorted_field_names": receipt.sorted_field_names,
            "record_count": receipt.record_count,
            "lineage_hash": receipt.lineage_hash,
        }
    except Exception:
        return None


def _apply_locale_defaults_to_inferred_schema(
    schema: list[dict[str, Any]], locale: str
) -> list[dict[str, Any]]:
    if locale not in ("en_AE", "ar_AE"):
        return schema
    for row in schema:
        if row.get("type") == "phone":
            row.setdefault("constraints", {})
            row["constraints"]["country_code"] = "+971"
        if row.get("type") == "iban":
            row.setdefault("constraints", {})
            row["constraints"].setdefault("country_prefix", "AE")
    return schema


def _canonical_contract_hash(schema: list[dict[str, Any]]) -> str:
    canonical_rows: list[dict[str, Any]] = []
    for row in schema:
        canonical_rows.append(
            {
                "name": str(row.get("name", "")).strip(),
                "type": str(row.get("type", "")).strip(),
                "locale": str(row.get("locale", "")).strip() or None,
                "constraints": row.get("constraints") if isinstance(row.get("constraints"), dict) else None,
                "blankPercentage": row.get("blankPercentage"),
            }
        )
    # Keep order-independent hash for deterministic contract lock.
    canonical_rows.sort(key=lambda r: (r["name"], r["type"]))
    payload = json.dumps(canonical_rows, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _schema_to_field_defs(schema: list[dict[str, Any]]) -> list[FieldDefinition]:
    out: list[FieldDefinition] = []
    for row in schema:
        out.append(
            FieldDefinition(
                name=str(row.get("name", "")).strip(),
                type=str(row.get("type", "")).strip(),
                locale=(str(row.get("locale", "")).strip() or None),
                constraints=row.get("constraints")
                if isinstance(row.get("constraints"), dict)
                else None,
                blankPercentage=row.get("blankPercentage"),
            )
        )
    return out


@app.get("/api/v1/capabilities", response_model=None, tags=["Discovery"])
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
                "description": "Pay per call in USDC on the configured L2 (default Base Sepolia testnet). No account needed.",
                "pricing": X402_PRICING,
                "how_it_works": "Omit X-API-Key. Server returns 402. Pay. Retry with X-PAYMENT header.",
            },
        },
        payment_environment=payment_public_snapshot(),
    )
    return manifest.model_dump()


@app.get("/api/v1/field-types", response_model=None, tags=["Discovery"])
async def field_types_catalog() -> dict:
    """Full canonical field type list for integrators and LLM tool docs (not tier-filtered)."""
    return catalog_documentation_payload()


@app.post("/api/v1/infer-schema", response_model=AiInferSchemaResponse, tags=["Generation"])
async def infer_schema_endpoint(body: AiInferSchemaRequest) -> dict[str, Any]:
    """Infer explicit schema contract without generating rows."""
    ollama_base = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama2")
    schema = await infer_schema_from_field_names(
        body.field_names,
        domain_hint=body.domain_hint,
        locale=body.locale,
        ollama_host=ollama_base,
        ollama_model=model,
    )
    schema = _apply_locale_defaults_to_inferred_schema(schema, body.locale)
    return AiInferSchemaResponse(
        proposed_schema=schema,
        contract_hash=_canonical_contract_hash(schema),
        contract_id=f"ctr_{uuid.uuid4().hex[:12]}",
        locale=body.locale,
    ).model_dump()


@app.post(
    "/api/v1/generate-ai",
    response_model=None,
    tags=["Generation"],
    responses=generation_402_response(),
)
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
    schema = _apply_locale_defaults_to_inferred_schema(schema, body.locale)

    contract_hash = _canonical_contract_hash(schema)
    if body.expected_contract_hash:
        expected = body.expected_contract_hash.strip().lower()
        if contract_hash.lower() != expected:
            return JSONResponse(
                {
                    "detail": "Inferred contract hash mismatch.",
                    "expected_contract_hash": expected,
                    "actual_contract_hash": contract_hash,
                },
                status_code=409,
            )

    if body.strict_contract and any(
        str(row.get("inference_source", "")).lower() == "heuristic" for row in schema
    ):
        return JSONResponse(
            {
                "detail": "strict_contract enabled: heuristic-inferred fields detected.",
                "hint": "Call POST /api/v1/infer-schema, review/patch schema_fields, then POST /api/v1/generate.",
            },
            status_code=422,
        )

    if body.require_validate:
        inferred_fields = _schema_to_field_defs(schema)
        contract_errors = validate_request(
            inferred_fields, body.count, body.locale, tier_config, tier=tier
        )
        if contract_errors:
            if agentic:
                return JSONResponse(
                    [e.model_dump() for e in contract_errors],
                    status_code=422,
                )
            return JSONResponse(
                {"detail": [e.message for e in contract_errors]},
                status_code=422,
            )

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
        "inferred_contract_hash": contract_hash,
        "count": len(records),
        "locale": body.locale,
        "tier": tier,
        "usage": usage,
        "generation_id": gen_id,
        "output_format": of,
        "generation_mode": "ai",
    }
    if await _lineage_enabled_now():
        lineage = _lineage_payload(
            generation_engine="ollama",
            model_version=os.getenv("OLLAMA_MODEL", "unknown"),
            field_names=[str(name) for name in body.field_names],
            record_count=len(records),
        )
        if lineage is not None:
            payload["lineage_receipt"] = lineage
            await _metric_incr("lineage_emitted_total")
    if body.output_format == "json":
        r_store = await _open_redis()
        if r_store is not None:
            try:
                await set_cached_json(r_store, idem_key, payload)
            finally:
                await r_store.aclose()
    return JSONResponse(payload)


@app.post(
    "/api/v1/generate-ai/stream",
    response_model=None,
    tags=["Generation"],
    responses=generation_402_response(),
)
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
        schema = _apply_locale_defaults_to_inferred_schema(schema, body.locale)
        contract_hash = _canonical_contract_hash(schema)
        if body.expected_contract_hash:
            expected = body.expected_contract_hash.strip().lower()
            if contract_hash.lower() != expected:
                yield (
                    "event: error\ndata: "
                    + json.dumps(
                        {
                            "detail": "Inferred contract hash mismatch.",
                            "expected_contract_hash": expected,
                            "actual_contract_hash": contract_hash,
                        },
                        separators=(",", ":"),
                    )
                    + "\n\n"
                )
                return
        if body.strict_contract and any(
            str(row.get("inference_source", "")).lower() == "heuristic"
            for row in schema
        ):
            yield (
                "event: error\ndata: "
                + json.dumps(
                    {
                        "detail": "strict_contract enabled: heuristic-inferred fields detected.",
                        "hint": "Call POST /api/v1/infer-schema, review/patch schema_fields, then POST /api/v1/generate.",
                    },
                    separators=(",", ":"),
                )
                + "\n\n"
            )
            return
        if body.require_validate:
            inferred_fields = _schema_to_field_defs(schema)
            contract_errors = validate_request(
                inferred_fields, body.count, body.locale, tier_config, tier=tier
            )
            if contract_errors:
                yield (
                    "event: error\ndata: "
                    + json.dumps(
                        {"detail": [e.message for e in contract_errors]},
                        separators=(",", ":"),
                    )
                    + "\n\n"
                )
                return
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
            "inferred_contract_hash": contract_hash,
            "count": len(records),
            "locale": body.locale,
            "tier": tier,
            "usage": usage,
            "generation_id": gen_id,
            "output_format": body.output_format,
            "generation_mode": "ai",
        }
        if await _lineage_enabled_now():
            lineage = _lineage_payload(
                generation_engine="ollama",
                model_version=os.getenv("OLLAMA_MODEL", "unknown"),
                field_names=[str(name) for name in body.field_names],
                record_count=len(records),
            )
            if lineage is not None:
                payload["lineage_receipt"] = lineage
                await _metric_incr("lineage_emitted_total")
        yield f"event: result\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"
        yield f"event: done\ndata: {json.dumps({'generation_id': gen_id}, separators=(',', ':'))}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post(
    "/api/v1/generate",
    response_model=None,
    tags=["Generation"],
    responses=generation_402_response(),
)
async def generate(request: Request, body: GenerationRequest) -> Response:
    tier_config = getattr(request.state, "tier_config", None) or TIER_CONFIG["free"]
    tier = getattr(request.state, "tier", None) or "free"
    agentic = "vnd.agentic+json" in request.headers.get("Accept", "")

    errors = validate_request(
        body.schema_fields, body.count, body.locale, tier_config, tier=tier
    )
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

    enforce_canary_escrow = (
        (request.url.path == AGENTIC_ESCROW_CANARY_PATH)
        and (not api_key)
        and await _escrow_canary_enabled_now()
    )
    if enforce_canary_escrow:
        await _metric_incr("canary_generate_calls_total")
        tx_hash = _extract_payment_tx_hash(request, body)
        if not body.agent_address or body.nonce is None or not tx_hash:
            return JSONResponse(
                {
                    "detail": (
                        "Escrow settlement fields required for keyless payments: "
                        "agent_address, nonce, payment_tx_hash (or X-PAYMENT tx hash)."
                    )
                },
                status_code=422,
            )
        try:
            settlement_meta = await guard_settlement_before_generation(
                SettlementContext(
                    agent_address=body.agent_address,
                    nonce=int(body.nonce),
                    payment_tx_hash=tx_hash,
                    expected_amount_micro_usdc=get_x402_price(body.count),
                )
            )
            request.state.escrow_settlement_meta = settlement_meta
            await _metric_incr("escrow_settlement_confirmed_total")
        except SettlementGuardError as exc:
            await _metric_incr("escrow_settlement_failed_total")
            return JSONResponse({"detail": str(exc)}, status_code=402)

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
    final_payload = payload.model_dump()
    if await _lineage_enabled_now():
        lineage = _lineage_payload(
            generation_engine="faker",
            model_version="faker-default",
            field_names=[field.name for field in body.schema_fields],
            record_count=len(records),
        )
        if lineage is not None:
            final_payload["lineage_receipt"] = lineage
            await _metric_incr("lineage_emitted_total")
    settlement_meta = getattr(request.state, "escrow_settlement_meta", None)
    if settlement_meta:
        final_payload["escrow_settlement"] = settlement_meta
    return JSONResponse(final_payload)


@app.post(
    "/api/v1/canary/generate",
    response_model=None,
    tags=["Generation"],
    responses=generation_402_response(),
)
async def canary_generate(request: Request, body: GenerationRequest) -> Response:
    """
    Canary route: same body contract as `POST /api/v1/generate`.

    When `AGENTIC_ESCROW_ENABLED=1`, a **keyless** POST receives **402** with an on-chain **invoice** JSON
    (see OpenAPI `EscrowInvoice402Body`). With an API key or `X-PAYMENT`, behavior matches `/generate`.
    """
    return await generate(request, body)


@app.get("/api/v1/admin/agentic/metrics", include_in_schema=False)
async def admin_agentic_metrics() -> dict[str, Any]:
    metric_names = [
        "canary_generate_calls_total",
        "escrow_settlement_confirmed_total",
        "escrow_settlement_failed_total",
        "lineage_emitted_total",
    ]
    redis_client = await _open_redis()
    values: dict[str, int] = {name: 0 for name in metric_names}
    if redis_client is not None:
        try:
            for name in metric_names:
                values[name] = int(await redis_client.get(f"agentic:metric:{name}") or 0)
        finally:
            await redis_client.aclose()
    return {
        "environment": DATAGEN_ENV,
        "lineage_stage": AGENTIC_LINEAGE_STAGE,
        "lineage_static_enabled": AGENTIC_LINEAGE_ENABLED,
        "escrow_static_enabled": AGENTIC_ESCROW_ENABLED,
        "escrow_canary_path": AGENTIC_ESCROW_CANARY_PATH,
        "lineage_runtime_enabled": await _runtime_toggle("lineage_enabled", True),
        "canary_escrow_runtime_enabled": await _runtime_toggle(
            "canary_escrow_enabled", True
        ),
        "metrics": values,
    }


@app.post("/api/v1/admin/agentic/toggles", include_in_schema=False)
async def admin_agentic_toggles(request: Request) -> dict[str, Any]:
    payload = await request.json()
    redis_client = await _open_redis()
    if redis_client is None:
        return {
            "updated": False,
            "error": "Redis unavailable; runtime toggles unchanged.",
        }
    changed: dict[str, bool] = {}
    try:
        if "lineage_enabled" in payload:
            value = bool(payload["lineage_enabled"])
            await redis_client.set("agentic:toggle:lineage_enabled", "1" if value else "0")
            changed["lineage_enabled"] = value
        if "canary_escrow_enabled" in payload:
            value = bool(payload["canary_escrow_enabled"])
            await redis_client.set(
                "agentic:toggle:canary_escrow_enabled", "1" if value else "0"
            )
            changed["canary_escrow_enabled"] = value
        return {"updated": True, "changed": changed}
    finally:
        await redis_client.aclose()


@app.post("/api/v1/validate", response_model=None, tags=["Generation"])
async def validate_endpoint(request: Request, body: GenerationRequest):
    tier_config = getattr(request.state, "tier_config", None) or TIER_CONFIG["free"]
    tier = getattr(request.state, "tier", None) or "free"
    errors = validate_request(
        body.schema_fields, body.count, body.locale, tier_config, tier=tier
    )
    if errors:
        return JSONResponse([e.model_dump() for e in errors], status_code=422)
    return {
        "valid": True,
        "field_count": len(body.schema_fields),
        "estimated_records": body.count,
    }


@app.get("/api/v1/health", tags=["Discovery"])
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


@app.get("/api/v1/auth/free-key", response_model=None, tags=["Discovery"])
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


@app.get("/api/v1/pricing", tags=["Discovery"])
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


@app.get("/api/v1/usage", response_model=None, tags=["Discovery"])
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


@app.post("/api/v1/webhooks/stripe", include_in_schema=False)
async def stripe_webhook() -> dict:
    """Placeholder for Stripe billing webhooks (hidden from OpenAPI until wired)."""
    return {"status": "ignored", "detail": "Payment integration pending"}


@app.get("/", tags=["Discovery"])
async def root() -> dict:
    return {
        "service": "datagen-api",
        "docs": "/api/v1/docs",
        "mcp": "/mcp/sse",
        "mcp_note": "MCP over HTTP/SSE when DATAGEN_MCP_HTTP is enabled; send X-API-Key on MCP requests.",
    }


def _mount_mcp_http() -> None:
    """Expose Model Context Protocol (SSE) on the same origin as the REST API."""
    if os.getenv("DATAGEN_MCP_HTTP", "1").lower() not in ("1", "true", "yes", "on"):
        return
    try:
        from datagen_mcp_app import build_mcp_http_app
        from mcp_http_auth import MCPHttpAuthASGI

        app.mount("/mcp", MCPHttpAuthASGI(build_mcp_http_app()))
    except Exception as exc:  # pragma: no cover
        import logging

        logging.getLogger("uvicorn.error").warning("MCP HTTP/SSE mount skipped: %s", exc)


_mount_mcp_http()


def _swagger_ui_html_with_topnav() -> str:
    """Inject a slim top bar so /api/v1/docs is not a dead-end (works behind nginx on same host)."""
    core = get_swagger_ui_html(
        openapi_url="/api/v1/openapi.json",
        title=f"{app.title} – Swagger UI",
        swagger_ui_parameters={"tryItOutEnabled": True},
    )
    html = core.body.decode("utf-8")
    nav = (
        '<div id="datagen-docs-nav" role="navigation" aria-label="DataGen site" '
        'style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;'
        "padding:0.65rem 1.25rem;display:flex;flex-wrap:wrap;gap:0.75rem 1.25rem;align-items:center;"
        'border-bottom:1px solid #334155;font-size:14px;line-height:1.4">'
        '<strong style="color:#f8fafc;letter-spacing:-.02em">DataGen API</strong>'
        '<a href="/" style="color:#7dd3fc;text-decoration:none">Site home</a>'
        '<a href="/index.html?app=1" style="color:#7dd3fc;text-decoration:none">App workspace</a>'
        '<a href="/api-developer-info.html" style="color:#7dd3fc;text-decoration:none">API overview</a>'
        '<a href="/mcp-developer-info.html" style="color:#94a3b8;text-decoration:none">MCP overview</a>'
        f'<span style="margin-left:auto;color:#64748b;font-size:12px">OpenAPI {app.version}</span></div>'
    )
    m = re.search(r"<body([^>]*)>", html, flags=re.IGNORECASE)
    if m:
        return html[: m.end()] + nav + html[m.end() :]
    return nav + html


@app.get("/api/v1/docs", include_in_schema=False)
async def swagger_ui_documentation() -> HTMLResponse:
    """Interactive OpenAPI (Swagger UI) with links back to the marketing site and app."""
    return HTMLResponse(content=_swagger_ui_html_with_topnav(), status_code=200)


def custom_openapi() -> dict:
    """OpenAPI: security schemes, runtime payment narrative, 402 body schemas (touchless deploy)."""
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
    comps = openapi_schema.setdefault("components", {})
    schemes = comps.setdefault("securitySchemes", {})
    schemes["XApiKey"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "Optional. Issue a free key: GET /api/v1/auth/free-key",
    }
    schemes["XPayment"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-PAYMENT",
        "description": (
            "x402 facilitator payment payload after settling the 402 `accepts[]` challenge. "
            "Send on retry to the same URL and JSON body."
        ),
    }
    # Anonymous, or API key. X-PAYMENT is documented under components + operation descriptions (not global security).
    openapi_schema["security"] = [{}, {"XApiKey": []}]
    schemas = comps.setdefault("schemas", {})
    for name, frag in openapi_payment_components().items():
        schemas[name] = frag
    openapi_schema.setdefault("info", {})["description"] = build_openapi_description()
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
