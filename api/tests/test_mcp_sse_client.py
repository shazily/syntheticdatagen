"""
End-to-end MCP client over HTTP/SSE (official Python SDK).

Run against a running API (Docker or local uvicorn):

  python api/tests/test_mcp_sse_client.py

Optional env:
  MCP_SSE_URL       default http://127.0.0.1:18000/mcp/sse
  DATAGEN_API_BASE  default http://127.0.0.1:18000 (for free-key mint)
  DATAGEN_API_KEY   if unset, mints a free key once
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

import httpx

from mcp.client.session import ClientSession
from mcp.client.sse import sse_client


async def mint_free_key(api_base: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.get(f"{api_base.rstrip('/')}/api/v1/auth/free-key")
        r.raise_for_status()
        return str(r.json()["api_key"])


def _tool_result_text(result) -> str:
    parts: list[str] = []
    for block in result.content or []:
        t = getattr(block, "text", None)
        if t:
            parts.append(t)
    return "".join(parts)


async def run_handshake(sse_url: str, api_key: str) -> None:
    headers = {"X-API-Key": api_key}
    async with sse_client(
        sse_url,
        headers=headers,
        timeout=30.0,
        sse_read_timeout=120.0,
    ) as streams:
        read_stream, write_stream = streams
        async with ClientSession(read_stream, write_stream) as session:
            init = await session.initialize()
            info = init.serverInfo
            print("initialize ok:", getattr(info, "name", None) if info else "(no serverInfo)")

            listed = await session.list_tools()
            names = sorted(t.name for t in listed.tools)
            print("list_tools:", len(names), "tools")
            assert "datagen_health" in names, names

            got = await session.call_tool("datagen_health", {})
            assert not got.isError, got
            raw = _tool_result_text(got)
            data = json.loads(raw)
            assert data.get("api") == "ok", data
            print("call_tool datagen_health:", {k: data.get(k) for k in ("api", "ollama", "redis")})

            # Same path paid customers use: explicit-schema generation (no LLM required).
            if os.environ.get("MCP_E2E_GENERATE", "1").lower() in ("1", "true", "yes", "on"):
                assert "datagen_generate" in names
                g2 = await session.call_tool(
                    "datagen_generate",
                    {
                        "schema_fields": [{"name": "email", "type": "email"}],
                        "count": 2,
                        "locale": "en_US",
                        "output_format": "json",
                    },
                )
                assert not g2.isError, g2
                body = json.loads(_tool_result_text(g2))
                recs = body.get("records") or []
                assert len(recs) == 2 and "email" in recs[0], body
                print("call_tool datagen_generate: 2 rows, sample email keys ok")


async def main() -> int:
    sse_url = os.environ.get("MCP_SSE_URL", "http://127.0.0.1:18000/mcp/sse").strip()
    api_base = os.environ.get("DATAGEN_API_BASE", "http://127.0.0.1:18000")
    key = (os.environ.get("DATAGEN_API_KEY") or "").strip()
    if not key:
        key = await mint_free_key(api_base)

    await run_handshake(sse_url, key)
    print("PASS: MCP SSE e2e (initialize -> list_tools -> datagen_health -> datagen_generate)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
