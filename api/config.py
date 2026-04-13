"""Tier limits, x402 pricing, and API key tier resolution."""

from __future__ import annotations

TIER_CONFIG: dict = {
    "free": {
        "max_records_per_call": 100,
        "max_calls_per_day": 20,
        "max_ai_records_per_call": 100,
        "allowed_field_categories": "all",
        "nested_depth": 1,
        "agentic_hints": True,
        "rag_access": False,
        "price_usd_month": 0,
        "stripe_price_id": None,
    },
    "pro": {
        "max_records_per_call": 5000,
        "max_ai_records_per_call": 5000,
        "max_calls_per_day": 500,
        "allowed_field_categories": [
            "personal",
            "dates",
            "numbers",
            "financial",
            "technical",
            "business",
        ],
        "nested_depth": 3,
        "agentic_hints": True,
        "rag_access": True,
        "price_usd_month": 29,
        "stripe_price_id": "price_TODO",
    },
    "enterprise": {
        "max_records_per_call": 100000,
        "max_ai_records_per_call": 100000,
        "max_calls_per_day": -1,
        "allowed_field_categories": "all",
        "nested_depth": 5,
        "agentic_hints": True,
        "rag_access": True,
        "webhook_delivery": True,
        "custom_locale": True,
        "price_usd_month": 199,
        "stripe_price_id": "price_TODO",
    },
    "x402": {
        "max_records_per_call": 10000,
        "max_ai_records_per_call": 10000,
        "max_calls_per_day": -1,
        "allowed_field_categories": "all",
        "nested_depth": 3,
        "agentic_hints": True,
        "rag_access": False,
        "price_usd_month": 0,
        "stripe_price_id": None,
    },
}

X402_PRICING: dict[str, int] = {
    "generate_small": 2000,
    "generate_medium": 5000,
    "generate_large": 15000,
    "validate": 0,
    "capabilities": 0,
}


def get_x402_price(count: int) -> int:
    if count <= 100:
        return X402_PRICING["generate_small"]
    if count <= 1000:
        return X402_PRICING["generate_medium"]
    return X402_PRICING["generate_large"]


def resolve_tier(api_key: str) -> str | None:
    """Parse tier from API key prefix DATAGEN-{TIER}-.... Returns None if invalid format."""
    parts = api_key.upper().split("-")
    if len(parts) < 2 or parts[0] != "DATAGEN":
        return None
    tier = parts[1].lower()
    if tier not in ("free", "pro", "enterprise"):
        return None
    return tier
