"""
DataGen MCP (FastMCP): tools, resources, and prompts over the HTTP API.

Used in two ways:
1) stdio — `python mcp_datagen/server.py` (repo) imports this module after setting DATAGEN_API_BASE.
2) HTTP/SSE — same process as uvicorn mounts `build_mcp_http_app()` at `/mcp` so clients hit your deployment like `/api/v1/...`.

When running inside the API container, unset DATAGEN_API_BASE defaults to http://127.0.0.1:8000 (loopback to same app).
Per-request X-API-Key for HTTP MCP is read from ASGI scope via contextvars (see mcp_http_auth.py).
"""

from __future__ import annotations

import contextvars
import json
import os
from typing import Any, Literal

import httpx
from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette

# Set by MCPHttpAuthASGI for each HTTP request when MCP is mounted on FastAPI.
_mcp_client_api_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "mcp_client_api_key", default=None
)


def set_mcp_client_api_key_for_request(key: str | None) -> contextvars.Token[str | None]:
    return _mcp_client_api_key.set(key)


def reset_mcp_client_api_key(token: contextvars.Token[str | None]) -> None:
    _mcp_client_api_key.reset(token)


SERVER_INSTRUCTIONS = """
You are connected to DataGen synthetic data APIs. Prefer this order:
1) datagen_health — confirm the service is up.
2) datagen_capabilities or read datagen://catalog/field-types — see what is allowed for this key/tier.
3) datagen_validate — dry-run schema before generating.
4) datagen_generate — explicit schema, or datagen_generate_ai — column names only.
Use Idempotency-Key on datagen_generate_ai when repeating the same request is possible.
For human-readable errors with fix hints, pass structured_errors=true on AI tools.
""".strip()

mcp = FastMCP(
    "DataGen Synthetic API",
    instructions=SERVER_INSTRUCTIONS,
    # Default host 127.0.0.1 enables MCP DNS-rebinding protection that rejects
    # Host headers like 127.0.0.1:3005 from nginx — use 0.0.0.0 so SSE works behind our proxy.
    host="0.0.0.0",
)


def _base() -> str:
    return os.environ.get("DATAGEN_API_BASE", "http://127.0.0.1:8000").rstrip("/")


def _effective_api_key() -> str:
    return (
        os.environ.get("DATAGEN_API_KEY", "").strip()
        or (_mcp_client_api_key.get() or "").strip()
    )


def _headers(
    *,
    idempotency_key: str | None = None,
    accept_agentic: bool = False,
    content_type: str | None = None,
) -> dict[str, str]:
    h: dict[str, str] = {
        "Accept": "application/json" + (", application/vnd.agentic+json" if accept_agentic else ""),
        "User-Agent": "DataGen-MCP/2.0",
    }
    key = _effective_api_key()
    if key:
        h["X-API-Key"] = key
    if idempotency_key and idempotency_key.strip():
        h["Idempotency-Key"] = idempotency_key.strip()[:200]
    if content_type:
        h["Content-Type"] = content_type
    return h


def _http_error_detail(r: httpx.Response) -> str:
    try:
        body = r.text[:4000]
    except Exception:
        body = ""
    return f"HTTP {r.status_code} {r.reason_phrase}\n{body}"


@mcp.tool()
async def datagen_health() -> str:
    """Service readiness: API, Ollama, Redis from GET /api/v1/health."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{_base()}/api/v1/health", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_field_types() -> str:
    """Full field-type catalog from GET /api/v1/field-types (documentation for schema types)."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/field-types", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_capabilities() -> str:
    """Tier-scoped capabilities from GET /api/v1/capabilities."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/capabilities", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_infer_schema(
    field_names: list[str],
    locale: str = "en_US",
    domain_hint: str | None = None,
) -> str:
    """Infer explicit schema contract from column names via POST /api/v1/infer-schema."""
    body: dict[str, Any] = {
        "field_names": field_names,
        "locale": locale,
    }
    if domain_hint:
        body["domain_hint"] = domain_hint
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{_base()}/api/v1/infer-schema",
            headers=_headers(content_type="application/json"),
            json=body,
        )
        if not r.is_success:
            return _http_error_detail(r)
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_validate(
    schema_fields: list[dict[str, Any]],
    count: int = 10,
    locale: str = "en_US",
    structured_errors: bool = False,
) -> str:
    """
    Dry-run schema validation via POST /api/v1/validate.
    Each item in schema_fields should include at least 'name' and 'type' (camelCase type keys from the catalog).
    """
    body: dict[str, Any] = {
        "schema_fields": schema_fields,
        "count": min(max(count, 1), 10000),
        "locale": locale,
        "output_format": "json",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{_base()}/api/v1/validate",
            headers=_headers(accept_agentic=structured_errors, content_type="application/json"),
            json=body,
        )
        if not r.is_success:
            return _http_error_detail(r)
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_generate(
    schema_fields: list[dict[str, Any]],
    count: int = 10,
    locale: str = "en_US",
    output_format: Literal["json", "csv", "jsonl", "excel", "xml"] = "json",
    structured_errors: bool = False,
) -> str:
    """
    Generate rows from an explicit schema via POST /api/v1/generate.
    schema_fields: list of {name, type, optional locale, constraints, blankPercentage}.
    """
    body: dict[str, Any] = {
        "schema_fields": schema_fields,
        "count": min(max(count, 1), 10000),
        "locale": locale,
        "output_format": output_format,
    }
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(
            f"{_base()}/api/v1/generate",
            headers=_headers(accept_agentic=structured_errors, content_type="application/json"),
            json=body,
        )
        if not r.is_success:
            return _http_error_detail(r)
        ct = (r.headers.get("content-type") or "").lower()
        if "json" in ct:
            return json.dumps(r.json(), indent=2)
        return r.text


@mcp.tool()
async def datagen_generate_ai(
    field_names: list[str],
    count: int = 10,
    locale: str = "en_US",
    domain_hint: str | None = None,
    output_format: Literal["json", "csv", "jsonl"] = "json",
    idempotency_key: str | None = None,
    structured_errors: bool = False,
) -> str:
    """
    AI mode: infer types from column names and generate rows (POST /api/v1/generate-ai).
    Optional idempotency_key avoids duplicate work for identical JSON requests when the server supports it.
    """
    body: dict[str, Any] = {
        "field_names": field_names,
        "count": min(max(count, 1), 10000),
        "locale": locale,
        "output_format": output_format,
    }
    if domain_hint:
        body["domain_hint"] = domain_hint
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(
            f"{_base()}/api/v1/generate-ai",
            headers=_headers(
                idempotency_key=idempotency_key,
                accept_agentic=structured_errors,
                content_type="application/json",
            ),
            json=body,
        )
        if not r.is_success:
            return _http_error_detail(r)
        ct = (r.headers.get("content-type") or "").lower()
        if "json" in ct:
            return json.dumps(r.json(), indent=2)
        return r.text


@mcp.tool()
async def datagen_generate_ai_stream(
    field_names: list[str],
    count: int = 10,
    locale: str = "en_US",
    domain_hint: str | None = None,
    structured_errors: bool = False,
) -> str:
    """
    Same limits as generate-ai, but uses POST /api/v1/generate-ai/stream (SSE).
    Returns the raw Server-Sent Events transcript so you can parse status lines and the final payload.
    """
    body: dict[str, Any] = {
        "field_names": field_names,
        "count": min(max(count, 1), 10000),
        "locale": locale,
        "output_format": "json",
    }
    if domain_hint:
        body["domain_hint"] = domain_hint
    lines: list[str] = []
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST",
            f"{_base()}/api/v1/generate-ai/stream",
            headers=_headers(accept_agentic=structured_errors, content_type="application/json"),
            json=body,
        ) as r:
            if r.status_code >= 400:
                body_text = (await r.aread()).decode("utf-8", errors="replace")[:4000]
                return f"HTTP {r.status_code}\n{body_text}"
            async for chunk in r.aiter_text():
                lines.append(chunk)
    return "".join(lines)


@mcp.resource(
    "datagen://catalog/field-types",
    name="field_types_catalog",
    title="Field type catalog",
    description="Live JSON from GET /api/v1/field-types",
    mime_type="application/json",
)
async def resource_field_types_catalog() -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/field-types", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.resource(
    "datagen://spec/openapi",
    name="openapi_spec",
    title="OpenAPI specification",
    description="Live OpenAPI 3 document from GET /api/v1/openapi.json",
    mime_type="application/json",
)
async def resource_openapi() -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/openapi.json", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.resource(
    "datagen://manifest/capabilities",
    name="capabilities_manifest",
    title="Capabilities manifest",
    description="Live tier-scoped capabilities from GET /api/v1/capabilities",
    mime_type="application/json",
)
async def resource_capabilities() -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/capabilities", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.prompt(
    name="datagen_schema_workflow",
    title="Validate then generate (explicit schema)",
    description="Walks through dry-run validation before calling generate with a fixed schema.",
)
def prompt_schema_workflow(schema_json: str) -> str:
    return f"""You have access to DataGen MCP tools.

Planned schema (JSON array of fields with name and type):
{schema_json}

Steps:
1. Call datagen_capabilities to confirm types and limits for this environment.
2. Call datagen_validate with schema_fields set to that array and the desired row count.
3. If validation passes, call datagen_generate with the same schema_fields, count, locale, and desired output_format (json, csv, jsonl, excel, or xml).

If validation returns errors, fix the schema and repeat from step 2."""


@mcp.prompt(
    name="datagen_ai_columns_workflow",
    title="AI generation from column names",
    description="Uses AI mode: only column names; types are inferred automatically.",
)
def prompt_ai_columns_workflow(
    column_names: str,
    row_count: int = 10,
    locale: str = "en_US",
) -> str:
    return f"""You have access to DataGen MCP tools.

Target columns (comma or newline separated): {column_names}
Desired rows: {row_count}
Locale hint: {locale}

Steps:
1. Optionally call datagen_health, then datagen_capabilities for limits.
2. Parse the column list into an array of strings (snake_case recommended).
3. Call datagen_generate_ai with field_names, count, and locale. Add domain_hint if the user gave business context.
4. If you need progress events, use datagen_generate_ai_stream instead and read the SSE transcript.

For repeatable runs with the same parameters, reuse the same idempotency_key on datagen_generate_ai."""


@mcp.prompt(
    name="datagen_discover_types",
    title="Discover supported field types",
    description="Use when the user does not know which type keys to put in a schema.",
)
def prompt_discover_types(user_goal: str) -> str:
    return f"""The user wants synthetic data for: {user_goal}

Use datagen_field_types or read the resource datagen://catalog/field-types to list canonical type keys.
Summarize a short recommended schema (field names + types) that fits their goal, then offer to validate and generate."""


def build_mcp_http_app() -> Starlette:
    """
    Starlette sub-app for MCP over SSE. Mount under FastAPI at ``/mcp``.

    Use ``mount_path="/"`` here so the message URI is ``/messages/`` inside this app.
    Starlette sets ``root_path=/mcp`` on the sub-app scope, and the SSE transport then
    advertises ``/mcp/messages/`` to clients (avoids ``/mcp/mcp/messages/`` when
    ``mount_path`` would already include ``/mcp``).
    """
    return mcp.sse_app(mount_path="/")
