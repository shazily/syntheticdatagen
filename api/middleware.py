"""API key resolution, agentic error formatting, and optional Redis rate limit helpers."""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from config import TIER_CONFIG, resolve_tier
from models import ConversationalError


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Parses X-API-Key or api_key query param into request.state tier."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if api_key:
            tier = resolve_tier(api_key)
            if not tier:
                return JSONResponse({"error": "Invalid API key format."}, status_code=401)
            request.state.api_key = api_key
            request.state.tier = tier
            request.state.tier_config = TIER_CONFIG[tier]
            request.state.payment_method = "api_key"
        else:
            request.state.api_key = None
            request.state.tier = None
            request.state.tier_config = None
            request.state.payment_method = None
        return await call_next(request)


def _detail_to_conversational(detail: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if isinstance(detail, list):
        for item in detail:
            if isinstance(item, dict):
                loc = item.get("loc", ())
                field = str(loc[-1]) if loc else None
                msg = item.get("msg", "Validation error")
                out.append(
                    ConversationalError(
                        field=field,
                        message=str(msg),
                        correction_hint="Fix the listed validation issue and retry the same endpoint.",
                    ).model_dump()
                )
            else:
                out.append(
                    ConversationalError(
                        message=str(item),
                        correction_hint="Review the request body against GET /api/v1/capabilities examples.",
                    ).model_dump()
                )
    else:
        out.append(
            ConversationalError(
                message=str(detail),
                correction_hint="Review authentication headers and request body.",
            ).model_dump()
        )
    return out


class ErrorFormatMiddleware(BaseHTTPMiddleware):
    """
    If Accept includes application/vnd.agentic+json, convert selected 4xx JSON
    bodies into a list of ConversationalError objects.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        accept = request.headers.get("Accept", "")
        agentic = "vnd.agentic+json" in accept
        if not agentic or response.status_code not in (401, 403, 422, 429):
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        payload: dict[str, Any]
        try:
            parsed = json.loads(body.decode("utf-8") or "{}")
            payload = parsed if isinstance(parsed, dict) else {"detail": parsed}
        except json.JSONDecodeError:
            payload = {"detail": body.decode("utf-8", errors="replace")}

        detail = payload.get("detail", payload.get("error", payload))
        errors = _detail_to_conversational(detail)
        return JSONResponse(errors, status_code=response.status_code)
