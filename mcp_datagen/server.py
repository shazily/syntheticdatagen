#!/usr/bin/env python3
"""
DataGen MCP server (stdio) — first-class agent tool surface over your HTTP API.

Environment:
  DATAGEN_API_BASE   e.g. https://datagen.gptlab.ae  (no trailing slash required)
  DATAGEN_API_KEY    optional; X-API-Key for generate-ai / protected calls

Run (from repo root, after `pip install -r mcp_datagen/requirements.txt`):
  python mcp_datagen/server.py

Register in Cursor / Claude Desktop MCP config as a stdio command pointing to this script.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("DataGen Synthetic API")


def _base() -> str:
    b = os.environ.get("DATAGEN_API_BASE", "http://127.0.0.1:18000").rstrip("/")
    return b


def _headers() -> dict[str, str]:
    h = {"Accept": "application/json", "User-Agent": "DataGen-MCP/1.0"}
    key = os.environ.get("DATAGEN_API_KEY", "").strip()
    if key:
        h["X-API-Key"] = key
    return h


@mcp.tool()
async def datagen_field_types() -> str:
    """Return the full JSON field-type catalog (~70 types) from GET /api/v1/field-types."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/field-types", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_capabilities() -> str:
    """Return tier-scoped capabilities manifest from GET /api/v1/capabilities."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(f"{_base()}/api/v1/capabilities", headers=_headers())
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


@mcp.tool()
async def datagen_generate_ai(
    field_names: list[str],
    count: int = 10,
    locale: str = "en_US",
    domain_hint: str | None = None,
) -> str:
    """
    AI mode: column names only — infers types and returns synthetic rows (POST /api/v1/generate-ai).
    Requires DATAGEN_API_KEY for tiers that enforce X-API-Key.
    """
    body: dict[str, Any] = {
        "field_names": field_names,
        "count": min(max(count, 1), 10000),
        "locale": locale,
        "output_format": "json",
    }
    if domain_hint:
        body["domain_hint"] = domain_hint
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(
            f"{_base()}/api/v1/generate-ai",
            headers={**_headers(), "Content-Type": "application/json"},
            json=body,
        )
        r.raise_for_status()
        return json.dumps(r.json(), indent=2)


if __name__ == "__main__":
    mcp.run()
