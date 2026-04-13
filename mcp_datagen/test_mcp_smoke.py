#!/usr/bin/env python3
"""
Smoke-test DataGen MCP tools and resources (no stdio host required).

Usage (from repo root):
  set DATAGEN_API_BASE=http://127.0.0.1:18000
  python mcp_datagen/test_mcp_smoke.py

Requires the FastAPI stack reachable at DATAGEN_API_BASE (optional X-API-Key in env).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys


def _truncate(s: str, max_len: int = 500) -> str:
    s = s.replace("\n", " ")
    if len(s) <= max_len:
        return s
    return s[: max_len - 3] + "..."


async def main() -> int:
    base = os.environ.get("DATAGEN_API_BASE", "http://127.0.0.1:18000").rstrip("/")
    print(f"DATAGEN_API_BASE={base}")
    if not os.environ.get("DATAGEN_API_KEY"):
        print("(DATAGEN_API_KEY unset: key-gated tools are skipped or may fail)")

    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{base}/api/v1/health")
            r.raise_for_status()
    except Exception as e:
        print(f"\nFAIL: API not reachable at {base}/api/v1/health: {e}")
        print("Start the stack (e.g. docker compose up api) or set DATAGEN_API_BASE.")
        return 1

    # Import after env is set so server module picks up DATAGEN_*
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import server as mcp_server  # noqa: E402

    mcp = mcp_server.mcp
    tools = [t.name for t in mcp._tool_manager.list_tools()]
    print(f"\nRegistered tools ({len(tools)}): {', '.join(sorted(tools))}")

    res_list = await mcp.list_resources()
    print(f"Registered resources ({len(res_list)}): {', '.join(sorted(str(r.uri) for r in res_list))}")

    async def call(name: str, args: dict) -> str:
        # convert_result=False returns the tool function's raw return (our tools return str).
        out = await mcp._tool_manager.call_tool(name, args, context=None, convert_result=False)
        if isinstance(out, str):
            return out
        return json.dumps(out, default=str, indent=2)

    print("\n--- Tool: datagen_health ---")
    h = await call("datagen_health", {})
    print(_truncate(h, 400))

    print("\n--- Tool: datagen_capabilities (first keys) ---")
    cap = await call("datagen_capabilities", {})
    try:
        d = json.loads(cap)
        print("keys:", list(d.keys()))
        print("tier:", d.get("tier"))
    except json.JSONDecodeError:
        print(_truncate(cap, 400))

    print("\n--- Tool: datagen_validate (minimal schema) ---")
    val = await call(
        "datagen_validate",
        {"schema_fields": [{"name": "email", "type": "email"}], "count": 2, "locale": "en_US"},
    )
    print(_truncate(val, 500))

    print("\n--- Resource: datagen://catalog/field-types (prefix) ---")
    chunks = await mcp.read_resource("datagen://catalog/field-types")
    blocks = list(chunks)
    if not blocks:
        print("FAIL: empty resource read")
        return 1
    body = blocks[0].content
    if isinstance(body, bytes):
        body = body.decode("utf-8")
    data = json.loads(body)
    print("type_count:", data.get("type_count"), "| api_version:", data.get("api_version"))

    print("\n--- Prompt: datagen_discover_types ---")
    pr = await mcp.get_prompt("datagen_discover_types", {"user_goal": "UAE customer CRM export"})
    msgs = getattr(pr, "messages", None) or []
    for i, msg in enumerate(msgs[:2]):
        role = getattr(msg, "role", "?")
        content = getattr(msg, "content", None)
        text = getattr(content, "text", str(content)) if content is not None else ""
        print(f"  message[{i}] role={role}: {_truncate(text, 200)}")

    print("\nPASS: MCP tools, resource read, and prompt resolution succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
