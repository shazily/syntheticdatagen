"""
HTTP 402 middleware for keyless canary /generate calls.

This middleware only builds and returns a USDC-on-Base invoice.
Payment verification and escrow checks are handled in settlement guards.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from typing import Awaitable, Callable
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


# Defaults align with Base Sepolia + test USDC (same family as X402_ASSET in docker-compose).
_DEFAULT_TESTNET_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
BASE_USDC_ADDRESS = os.getenv(
    "USDC_BASE_ADDRESS",
    os.getenv("X402_ASSET", _DEFAULT_TESTNET_USDC),
)
BASE_CHAIN_ID = int(os.getenv("BASE_CHAIN_ID", "84532"))
ESCROW_CONTRACT = os.getenv("X402_ESCROW_CONTRACT", "").strip()
API_PAYOUT_WALLET = os.getenv("API_PAYOUT_WALLET", "").strip()
CANARY_ESCROW_PATH = os.getenv("AGENTIC_ESCROW_CANARY_PATH", "/api/v1/canary/generate")


class PaymentRequired402Middleware(BaseHTTPMiddleware):
    """Intersects keyless POST on canary generate path and responds with invoice payload."""

    PROTECTED_PATHS = {CANARY_ESCROW_PATH}

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path not in self.PROTECTED_PATHS or request.method.upper() != "POST":
            return await call_next(request)

        has_api_key = bool((request.headers.get("X-API-Key") or "").strip())
        has_payment = bool((request.headers.get("X-PAYMENT") or "").strip())
        if has_api_key or has_payment:
            return await call_next(request)

        raw = await request.body()
        payload = self._safe_json(raw)
        record_count = int(payload.get("count", payload.get("recordCount", 10)))
        nonce = int(payload.get("nonce", 0))
        invoice = self._build_invoice(
            request=request,
            record_count=record_count,
            nonce=nonce,
        )

        async def receive() -> dict:
            return {"type": "http.request", "body": raw, "more_body": False}

        Request(request.scope, receive)
        return JSONResponse(invoice, status_code=402, headers={"X-Payment-Required": "true"})

    @staticmethod
    def _safe_json(raw_body: bytes) -> dict:
        if not raw_body:
            return {}
        try:
            return json.loads(raw_body.decode("utf-8"))
        except Exception:
            return {}

    @staticmethod
    def _quote_micro_usdc(record_count: int) -> int:
        # 0.00015 USDC per row, 6-decimal token precision.
        return max(150, record_count * 150)

    def _build_invoice(self, *, request: Request, record_count: int, nonce: int) -> dict:
        amount_micro_usdc = self._quote_micro_usdc(record_count)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=5)
        invoice_id = f"inv_{uuid.uuid4().hex[:18]}"
        net_label = (
            "Base Sepolia"
            if BASE_CHAIN_ID == 84532
            else "Base mainnet"
            if BASE_CHAIN_ID == 8453
            else f"chain id {BASE_CHAIN_ID}"
        )
        inv_network = (
            "base-sepolia"
            if BASE_CHAIN_ID == 84532
            else "base"
            if BASE_CHAIN_ID == 8453
            else f"eip155:{BASE_CHAIN_ID}"
        )
        return {
            "error": "payment_required",
            "message": f"HTTP 402: pre-fund escrow in USDC on {net_label} and retry with X-PAYMENT.",
            "invoice": {
                "invoice_id": invoice_id,
                "chain_id": BASE_CHAIN_ID,
                "network": inv_network,
                "asset": {
                    "symbol": "USDC",
                    "address": BASE_USDC_ADDRESS,
                    "decimals": 6,
                },
                "amount_micro_usdc": amount_micro_usdc,
                "escrow_contract": ESCROW_CONTRACT,
                "payee": API_PAYOUT_WALLET,
                "nonce": nonce,
                "record_count": record_count,
                "resource": str(request.url),
                "issued_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            },
        }

