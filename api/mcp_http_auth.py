"""ASGI wrapper: require X-API-Key on MCP HTTP/SSE and expose it to MCP tools via contextvars."""

from __future__ import annotations

import os
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from config import resolve_tier
from datagen_mcp_app import reset_mcp_client_api_key, set_mcp_client_api_key_for_request


def _header(scope: Scope, name: bytes) -> str | None:
    for k, v in scope.get("headers") or []:
        if k.lower() == name.lower():
            return v.decode("latin-1")
    return None


class MCPHttpAuthASGI:
    """Wrap MCP Starlette app: validate API key and bind it for downstream httpx calls."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        require = os.getenv("DATAGEN_MCP_REQUIRE_API_KEY", "1").lower() in ("1", "true", "yes")
        key = _header(scope, b"x-api-key")

        if require and not (key or "").strip():
            await JSONResponse(
                {"error": "X-API-Key header is required for DataGen MCP over HTTP."},
                status_code=401,
            )(scope, receive, send)
            return

        if key and not resolve_tier(key.strip()):
            await JSONResponse(
                {"error": "Invalid API key."},
                status_code=401,
            )(scope, receive, send)
            return

        token = set_mcp_client_api_key_for_request(key.strip() if key else None)
        try:
            await self.app(scope, receive, send)
        finally:
            reset_mcp_client_api_key(token)
