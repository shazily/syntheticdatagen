"""
Runtime OpenAPI / capability facts for x402 + agentic escrow.

Values mirror the same environment variables as ``x402_middleware`` and
``agentic.payment_required_402`` so touchless deploys document what the
process actually uses (no hand-maintained Swagger drift).
"""

from __future__ import annotations

import os
from typing import Any

from config import X402_PRICING, get_x402_price
from x402_middleware import (
    FACILITATOR_URL,
    NETWORK,
    USDC_ADDRESS,
    WALLET_ADDRESS,
    X402Middleware,
)


def _bool_env(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).lower() in ("1", "true", "yes", "on")


def _mask_addr(addr: str) -> str:
    a = (addr or "").strip()
    if len(a) < 12:
        return a or "(unset)"
    return f"{a[:6]}…{a[-4:]}"


def payment_public_snapshot() -> dict[str, Any]:
    """Structured payment + agentic flags for /capabilities and OpenAPI text."""
    from agentic.payment_required_402 import (  # local: avoid import cycle at module load
        API_PAYOUT_WALLET,
        BASE_CHAIN_ID,
        BASE_USDC_ADDRESS,
        CANARY_ESCROW_PATH,
        ESCROW_CONTRACT,
    )

    chain_id = int(os.getenv("BASE_CHAIN_ID", str(BASE_CHAIN_ID)))
    escrow_on = _bool_env("AGENTIC_ESCROW_ENABLED", "0")
    lineage_on = _bool_env("AGENTIC_LINEAGE_ENABLED", "0")
    chain_name = "base-sepolia" if chain_id == 84532 else "base-mainnet" if chain_id == 8453 else f"chain-{chain_id}"

    return {
        "datagen_env": os.getenv("DATAGEN_ENV", "development").strip().lower(),
        "agentic": {
            "lineage_enabled_static": lineage_on,
            "lineage_stage": os.getenv("AGENTIC_LINEAGE_STAGE", "staging").strip().lower(),
            "escrow_middleware_enabled_static": escrow_on,
            "escrow_canary_path": CANARY_ESCROW_PATH.strip() or "/api/v1/canary/generate",
        },
        "x402": {
            "protocol": "HTTP 402 + X-PAYMENT (x402 facilitator)",
            "network_id_string": NETWORK,
            "facilitator_base_url": FACILITATOR_URL.rstrip("/"),
            "facilitator_verify_path": f"{FACILITATOR_URL.rstrip('/')}/verify",
            "facilitator_settle_path": f"{FACILITATOR_URL.rstrip('/')}/settle",
            "usdc_contract": USDC_ADDRESS,
            "pay_to_configured": bool((WALLET_ADDRESS or "").strip()),
            "pay_to_masked": _mask_addr(WALLET_ADDRESS),
            "protected_paths": list(X402Middleware.PROTECTED_PATHS),
            "pricing_micro_usdc_brackets": dict(X402_PRICING),
            "example_quote_count_10_micro_usdc": get_x402_price(10),
            "example_quote_count_500_micro_usdc": get_x402_price(500),
            "notes": (
                "Omit X-API-Key on protected paths to receive 402 JSON with `accepts[]`. "
                "Retry the same URL and body with header X-PAYMENT set to the facilitator-verified payload."
            ),
        },
        "escrow_canary_invoice": {
            "active_when": "AGENTIC_ESCROW_ENABLED=1 and keyless POST on escrow_canary_path (before x402; canary is not an x402 protected path).",
            "chain_id": chain_id,
            "chain_human": chain_name,
            "usdc_contract": BASE_USDC_ADDRESS,
            "escrow_contract_configured": bool((ESCROW_CONTRACT or "").strip()),
            "escrow_contract_masked": _mask_addr(ESCROW_CONTRACT),
            "payee_wallet_configured": bool((API_PAYOUT_WALLET or "").strip()),
            "payee_wallet_masked": _mask_addr(API_PAYOUT_WALLET),
            "response_header": "X-Payment-Required: true on the invoice 402",
        },
    }


def build_openapi_description() -> str:
    """Markdown for OpenAPI ``info.description`` (Swagger UI top section)."""
    s = payment_public_snapshot()
    x = s["x402"]
    e = s["escrow_canary_invoice"]
    a = s["agentic"]
    lines = [
        "Synthetic data generation for **humans** (API keys) and **AI agents** (x402 pay-per-call).",
        "",
        "### Authentication modes",
        "- **X-API-Key** — Free key: `GET /api/v1/auth/free-key`. Tier limits apply.",
        "- **No API key** — On x402 **protected** POST routes, the service returns **402** with payment instructions, then accepts **`X-PAYMENT`** on retry after facilitator verification.",
        "",
        "### x402 (this deployment)",
        f"- **Network id (x402):** `{x['network_id_string']}`",
        f"- **USDC (asset in 402 accepts):** `{x['usdc_contract']}`",
        f"- **Facilitator:** `{x['facilitator_base_url']}` → `POST /verify`, `POST /settle`",
        f"- **Pay-to configured:** {x['pay_to_configured']} (`{x['pay_to_masked']}`)",
        f"- **Micro-USDC brackets:** `{x['pricing_micro_usdc_brackets']}`",
        f"- **Protected POST paths (no key → 402 challenge):** {', '.join(f'`{p}`' for p in x['protected_paths'])}",
        "",
        "### Agentic + escrow canary",
        f"- **DATAGEN_ENV:** `{s['datagen_env']}`",
        f"- **AGENTIC_LINEAGE_ENABLED (build-time):** `{a['lineage_enabled_static']}` (stage `{a['lineage_stage']}`)",
        f"- **AGENTIC_ESCROW_ENABLED (build-time):** `{a['escrow_middleware_enabled_static']}`",
        f"- **Escrow canary path:** `{a['escrow_canary_path']}`",
        f"- When escrow middleware is on and the request is **keyless** on that path, **402** returns an **on-chain invoice** JSON (not the x402 `accepts[]` shape). Chain **id {e['chain_id']}** (`{e['chain_human']}`), USDC `{e['usdc_contract']}`.",
        f"- **Escrow contract configured:** {e['escrow_contract_configured']} (`{e['escrow_contract_masked']}`) · **Payee configured:** {e['payee_wallet_configured']} (`{e['payee_wallet_masked']}`)",
        "",
        "### Agent workflow",
        "1. `GET /api/v1/capabilities` — tier, field types, **payment_environment** (same facts as this document).",
        "2. `GET /api/v1/field-types` — full catalog.",
        "3. `POST /api/v1/validate` — dry-run schema.",
        "4. `POST /api/v1/generate` / `generate-ai` / `generate-ai/stream` — generation (see 402 schemas on each operation).",
        "",
        "### Structured errors",
        "Send **`Accept: application/vnd.agentic+json`** on failures to receive agent-oriented error objects where supported.",
    ]
    return "\n".join(lines)


def openapi_payment_components() -> dict[str, Any]:
    """Extra JSON Schema components merged under ``components/schemas``."""
    return {
        "X402AcceptItem": {
            "type": "object",
            "description": "Single entry inside payment_requirements.accepts[] from X402Middleware.",
            "properties": {
                "scheme": {"type": "string", "example": "exact"},
                "network": {"type": "string", "example": NETWORK},
                "maxAmountRequired": {"type": "string", "description": "Micro-USDC amount as decimal string."},
                "resource": {"type": "string"},
                "description": {"type": "string"},
                "mimeType": {"type": "string"},
                "payTo": {"type": "string"},
                "maxTimeoutSeconds": {"type": "integer"},
                "asset": {"type": "string", "description": "USDC contract on the named network."},
                "nonce": {"type": "string"},
                "expiry": {"type": "integer"},
                "extra": {"type": "object"},
            },
        },
        "X402PaymentRequiredBody": {
            "type": "object",
            "required": ["accepts"],
            "properties": {
                "accepts": {
                    "type": "array",
                    "items": {"$ref": "#/components/schemas/X402AcceptItem"},
                }
            },
            "example": {
                "accepts": [
                    {
                        "scheme": "exact",
                        "network": NETWORK,
                        "maxAmountRequired": str(get_x402_price(10)),
                        "resource": "https://example.com/api/v1/generate",
                        "description": "DataGen synthetic data generation — 10 records",
                        "mimeType": "application/json",
                        "payTo": WALLET_ADDRESS or "0x0000000000000000000000000000000000000000",
                        "maxTimeoutSeconds": 60,
                        "asset": USDC_ADDRESS,
                        "nonce": "abc123",
                        "expiry": 1710000000,
                        "extra": {"name": "DataGen Synthetic Data API", "version": "1"},
                    }
                ]
            },
        },
        "EscrowInvoice402Body": {
            "type": "object",
            "required": ["error", "message", "invoice"],
            "properties": {
                "error": {"type": "string", "example": "payment_required"},
                "message": {"type": "string"},
                "invoice": {
                    "type": "object",
                    "properties": {
                        "invoice_id": {"type": "string"},
                        "chain_id": {"type": "integer"},
                        "network": {"type": "string"},
                        "asset": {"type": "object"},
                        "amount_micro_usdc": {"type": "integer"},
                        "escrow_contract": {"type": "string"},
                        "payee": {"type": "string"},
                        "nonce": {"type": "integer"},
                        "record_count": {"type": "integer"},
                        "resource": {"type": "string"},
                        "issued_at": {"type": "string", "format": "date-time"},
                        "expires_at": {"type": "string", "format": "date-time"},
                    },
                },
            },
        },
        "PaymentRequired402Body": {
            "oneOf": [
                {"$ref": "#/components/schemas/X402PaymentRequiredBody"},
                {"$ref": "#/components/schemas/EscrowInvoice402Body"},
            ],
            "description": (
                "HTTP 402 body: either x402 facilitator challenge (`accepts`) on generate routes without X-API-Key, "
                "or escrow invoice JSON on the canary path when AGENTIC_ESCROW_ENABLED=1."
            ),
        },
    }


def generation_402_response() -> dict[str, Any]:
    """FastAPI ``responses`` fragment for POST routes that may return 402."""
    return {
        402: {
            "description": (
                "Payment required. **Shape A:** x402 facilitator `accepts[]` (no X-API-Key on "
                "`/api/v1/generate`, `/generate-ai`, `/generate-ai/stream`). **Shape B:** escrow "
                "invoice JSON on keyless POST to the configured canary path when `AGENTIC_ESCROW_ENABLED=1` "
                "(see `EscrowInvoice402Body`; includes `X-Payment-Required: true`)."
            ),
            "headers": {
                "X-Payment-Required": {
                    "description": "Set to `true` on escrow-invoice 402 responses.",
                    "schema": {"type": "string"},
                }
            },
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/PaymentRequired402Body"},
                }
            },
        }
    }
