"""Field type metadata, tier visibility, and example requests."""

from __future__ import annotations

from typing import Any

from field_type_catalog import (
    ALL_FIELD_TYPE_DEFINITIONS,
    FIELD_CATEGORY_MAP,  # re-export for validator
)

# Single source of truth for definitions lives in field_type_catalog.
FIELD_TYPE_DEFINITIONS: list[dict[str, Any]] = ALL_FIELD_TYPE_DEFINITIONS

EXAMPLE_REQUESTS: list[dict[str, Any]] = [
    {
        "description": "UAE customer records with locale-correct phone",
        "request": {
            "schema": [
                {"name": "full_name", "type": "firstName"},
                {"name": "email", "type": "email"},
                {
                    "name": "phone",
                    "type": "phone",
                    "constraints": {"country_code": "+971"},
                },
            ],
            "recordCount": 10,
            "locale": "en_AE",
            "exportFormat": "json",
        },
    },
    {
        "description": "Financial transaction records",
        "request": {
            "schema": [
                {"name": "transaction_id", "type": "transactionId"},
                {"name": "amount", "type": "transactionAmount"},
                {
                    "name": "iban",
                    "type": "iban",
                    "constraints": {"country_prefix": "AE"},
                },
                {"name": "status", "type": "paymentStatus"},
            ],
            "recordCount": 50,
            "locale": "en_AE",
            "exportFormat": "jsonl",
        },
    },
    {
        "description": "AI mode: only column names; types and values inferred (POST /api/v1/generate-ai)",
        "request": {
            "field_names": ["customer_email", "order_total_usd", "ship_date", "flavor_sku"],
            "count": 25,
            "locale": "en_US",
            "output_format": "json",
        },
    },
]


def field_visible_for_tier(tier: str, field: dict[str, Any]) -> bool:
    """Return True if this field type should appear in GET /capabilities for tier."""
    from config import TIER_CONFIG

    tc = TIER_CONFIG.get(tier, TIER_CONFIG["free"])
    allowed = tc.get("allowed_field_categories", [])
    category = field.get("category", "personal")
    treq = field.get("tier_required", "free")

    tier_order = {"free": 0, "pro": 1, "enterprise": 2, "x402": 2}
    need = tier_order.get(treq, 0)
    have = tier_order.get(tier, 0)
    if tier == "x402":
        have = 2
    if need > have:
        return False
    if allowed == "all":
        return True
    if isinstance(allowed, list):
        return category in allowed
    return False
