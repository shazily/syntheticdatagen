"""x402 payment middleware for unauthenticated access to POST /api/v1/generate."""

from __future__ import annotations

import json
import os
from typing import Awaitable, Callable

import httpx
import redis.asyncio as redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from config import TIER_CONFIG, get_x402_price

FACILITATOR_URL = os.getenv("X402_FACILITATOR_URL", "https://x402.org")
WALLET_ADDRESS = os.getenv("DATAGEN_WALLET_ADDRESS", "")
NETWORK = os.getenv("X402_NETWORK", "base-sepolia")
USDC_ADDRESS = os.getenv(
    "X402_ASSET",
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
)


class X402Middleware(BaseHTTPMiddleware):
    """
    x402 HTTP payment protocol for agent pay-per-call access.
    Only intercepts protected endpoints when no API key tier was resolved.
    """

    PROTECTED_PATHS = (
        "/api/v1/generate",
        "/api/v1/generate-ai",
        "/api/v1/generate-ai/stream",
    )

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.url.path not in self.PROTECTED_PATHS or getattr(request.state, "tier", None) is not None:
            return await call_next(request)

        payment_header = request.headers.get("X-PAYMENT")

        if not payment_header:
            raw = await request.body()
            try:
                data = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                data = {}
            count = int(data.get("count", data.get("recordCount", 10)))
            amount = get_x402_price(count)
            resource = str(request.url)
            payment_requirements = {
                "accepts": [
                    {
                        "scheme": "exact",
                        "network": NETWORK,
                        "maxAmountRequired": str(amount),
                        "resource": resource,
                        "description": f"DataGen synthetic data generation — {count} records",
                        "mimeType": "application/json",
                        "payTo": WALLET_ADDRESS,
                        "maxTimeoutSeconds": 60,
                        "asset": USDC_ADDRESS,
                        "extra": {"name": "DataGen Synthetic Data API", "version": "1"},
                    }
                ]
            }

            async def receive() -> dict:
                return {"type": "http.request", "body": raw, "more_body": False}

            request = Request(request.scope, receive)
            return JSONResponse(payment_requirements, status_code=402)

        raw_body = await request.body()

        try:
            async with httpx.AsyncClient() as client:
                verify_resp = await client.post(
                    f"{FACILITATOR_URL}/verify",
                    json={"paymentPayload": payment_header},
                    timeout=10.0,
                )
            if not verify_resp.is_success:
                return JSONResponse(
                    {
                        "error": "Payment verification failed.",
                        "correction_hint": (
                            "Ensure your payment is signed correctly and sent to the right wallet address."
                        ),
                    },
                    status_code=402,
                )

            payment_hash = str(verify_resp.json().get("hash", payment_header[:32]))
            r = redis.from_url(
                os.getenv("REDIS_URL", "redis://redis:6379"),
                socket_connect_timeout=1.5,
            )
            try:
                await r.ping()
                already_used = await r.get(f"x402:settled:{payment_hash}")
                if already_used:
                    return JSONResponse({"error": "Payment already used."}, status_code=402)
                await r.setex(f"x402:settled:{payment_hash}", 86400, "1")
            except Exception as exc:  # noqa: BLE001
                return JSONResponse(
                    {"error": f"x402 settlement store unavailable: {exc!s}"},
                    status_code=402,
                )
            finally:
                await r.aclose()

        except Exception as exc:  # noqa: BLE001
            return JSONResponse(
                {"error": f"Facilitator unreachable: {exc!s}"},
                status_code=402,
            )

        request.state.tier = "x402"
        request.state.payment_method = "x402"
        request.state.payment_hash = payment_hash
        request.state.tier_config = TIER_CONFIG["x402"]

        async def receive() -> dict:
            return {"type": "http.request", "body": raw_body, "more_body": False}

        request = Request(request.scope, receive)

        response = await call_next(request)

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{FACILITATOR_URL}/settle",
                    json={"paymentPayload": payment_header},
                    timeout=5.0,
                )
        except Exception:
            pass

        return response
