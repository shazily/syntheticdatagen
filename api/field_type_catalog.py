"""Full synthetic field type catalog (~50+) for documentation and AI schema inference.

All types are available to integrators; tier record limits apply on generation endpoints.
"""

from __future__ import annotations

from typing import Any


def _row(
    name: str,
    category: str,
    description: str,
    example_value: str,
    *,
    locale_notes: str | None = None,
    tier_required: str = "free",
) -> dict[str, Any]:
    return {
        "name": name,
        "category": category,
        "description": description,
        "example_value": example_value,
        "required_constraints": [],
        "locale_notes": locale_notes,
        "tier_required": tier_required,
    }


# Canonical type keys (camelCase) — use these in POST /api/v1/generate and in AI-inferred schemas.
ALL_FIELD_TYPE_DEFINITIONS: list[dict[str, Any]] = [
    _row("firstName", "personal", "Given name for the request locale.", "Layla"),
    _row("lastName", "personal", "Family name for the request locale.", "Al-Mansoori"),
    _row("middleName", "personal", "Middle name or patronymic.", "James"),
    _row("fullName", "personal", "Full display name combining parts.", "Layla Al-Mansoori"),
    _row("email", "personal", "Email address.", "sarah.jones@gmail.com"),
    _row(
        "phone",
        "personal",
        "Phone number; en_AE requires constraints.country_code '+971'.",
        "+971 50 123 4567",
        locale_notes="en_AE: add constraints: {'country_code': '+971'}",
    ),
    _row("address", "personal", "Street / postal address.", "Sheikh Zayed Road, Dubai, UAE"),
    _row("birthdate", "personal", "Date of birth (ISO date).", "1992-04-18"),
    _row("gender", "personal", "Gender label for synthetic personas.", "Female"),
    _row("age", "personal", "Integer age in years.", "34"),
    _row("nationality", "personal", "Nationality or citizenship label.", "UAE"),
    _row("country", "geographic", "Country name.", "United Arab Emirates"),
    _row("city", "geographic", "City or locality name.", "Dubai"),
    _row("state", "geographic", "State / emirate / province.", "Dubai"),
    _row("zipCode", "geographic", "Postal or ZIP code.", "00000"),
    _row("region", "geographic", "Region, territory, or macro-area.", "GCC"),
    _row("latitude", "geographic", "Decimal latitude.", "25.2048"),
    _row("longitude", "geographic", "Decimal longitude.", "55.2708"),
    _row("timezone", "geographic", "IANA-style timezone name.", "Asia/Dubai"),
    _row("company", "business", "Company or legal entity name.", "Emirates Logistics LLC"),
    _row("jobTitle", "business", "Professional job title.", "Senior Data Engineer"),
    _row("department", "business", "Department or cost-center label.", "Finance Operations"),
    _row("industry", "business", "Industry vertical.", "Retail"),
    _row("occupation", "business", "Occupation description.", "Store manager"),
    _row("employeeId", "business", "Internal employee identifier.", "EMP-88421"),
    _row("website", "technical", "HTTP(S) URL.", "https://example.com/about"),
    _row("url", "technical", "Generic URL string.", "https://cdn.example.com/asset.png"),
    _row("username", "technical", "Login or handle.", "dev_marina_03"),
    _row("uuid", "technical", "UUID v4.", "550e8400-e29b-41d4-a716-446655440000"),
    _row("ipAddress", "technical", "IPv4 address.", "203.0.113.42"),
    _row("macAddress", "technical", "MAC address style identifier.", "00:1A:2B:3C:4D:5E"),
    _row("userAgent", "technical", "Browser or client user-agent string.", "Mozilla/5.0 …"),
    _row("color", "product", "Color name or hex.", "#3B82F6"),
    _row("language", "product", "Human language name or BCP-47 tag.", "en-AE"),
    _row("brandName", "product", "Brand or product line name.", "Alpine Scoops"),
    _row("productName", "product", "Product or SKU display name.", "Vanilla Bean Pint"),
    _row("sku", "product", "Stock keeping unit code.", "ICE-VAN-500ML"),
    _row("flavorName", "product", "Flavor or variant label (e.g. ice cream).", "Salted caramel"),
    _row("weightKg", "numbers", "Weight in kilograms (decimal).", "0.5"),
    _row("heightCm", "numbers", "Height in centimeters.", "178"),
    _row("bloodType", "personal", "Blood type label.", "O+"),
    _row("passportNumber", "personal", "Synthetic passport-style identifier.", "N1234567"),
    _row("driversLicense", "personal", "Synthetic driver license number.", "D123-456-7890"),
    _row("ssnLastFour", "personal", "Last four digits style token (synthetic).", "7281"),
    _row("creditCard", "financial", "Card number with Luhn checksum (synthetic).", "4532 1234 5678 9012"),
    _row("currency", "financial", "ISO 4217 currency code.", "AED"),
    _row("amount", "financial", "Monetary amount.", "1250.50"),
    _row("iban", "financial", "IBAN; en_AE often needs constraints.country_prefix 'AE'.", "AE070331234567890123456", locale_notes="en_AE: {'country_prefix': 'AE'}"),
    _row("accountNumber", "financial", "Bank account number (synthetic).", "0192837465"),
    _row("bankName", "financial", "Bank or institution name.", "First Gulf Bank"),
    _row("swiftCode", "financial", "SWIFT / BIC style code.", "FABADAAI"),
    _row("invoiceNumber", "financial", "Invoice or document number.", "INV-2026-004512"),
    _row("taxId", "financial", "Tax or VAT style identifier.", "100123456700003"),
    _row("ledgerCode", "financial", "General ledger code.", "6200-TRAVEL"),
    _row("costCenter", "financial", "Cost center code.", "CC-AE-441"),
    _row("transactionId", "financial", "Transaction reference.", "txn_9f2c8b1a4d3e"),
    _row("transactionAmount", "financial", "Signed transaction amount.", "-49.99"),
    _row("paymentStatus", "financial", "Payment lifecycle status.", "CAPTURED"),
    _row("orderNumber", "product", "Customer-visible order number.", "ORD-2026-88321"),
    _row("shipmentStatus", "product", "Shipment / fulfillment status.", "OUT_FOR_DELIVERY"),
    _row("shipmentTrackingId", "product", "Carrier tracking identifier.", "1Z999AA10123456784"),
    _row("reviewScore", "numbers", "Rating or score (often 1–5 or 0–100).", "4.7"),
    _row("date", "dates", "Calendar date ISO YYYY-MM-DD.", "2026-01-15"),
    _row("dateTime", "dates", "ISO-8601 timestamp.", "2026-01-15T14:32:11+04:00"),
    _row("integer", "numbers", "Random integer.", "8421"),
    _row("decimal", "numbers", "Decimal number.", "384.27"),
    _row("percentage", "numbers", "Percentage 0–100.", "37.5"),
    _row("text", "freeform", "Short free-text phrase or label.", "Customer prefers morning delivery"),
    _row("notes", "freeform", "Longer free-text notes.", "Called back to confirm address."),
    _row("tags", "freeform", "Comma-separated or single-line tags.", "vip, recurring, uae"),
]

FIELD_CATEGORY_MAP: dict[str, str] = {row["name"]: row["category"] for row in ALL_FIELD_TYPE_DEFINITIONS}

CANONICAL_TYPE_NAMES: list[str] = [row["name"] for row in ALL_FIELD_TYPE_DEFINITIONS]


def catalog_documentation_payload() -> dict[str, Any]:
    return {
        "api_version": "1.0.0",
        "description": (
            "Canonical synthetic field types supported by DataGen APIs. "
            "Use the 'name' value as JSON 'type' on each schema field. "
            "AI mode (POST /api/v1/generate-ai) may infer these types from column names."
        ),
        "type_count": len(ALL_FIELD_TYPE_DEFINITIONS),
        "field_types": ALL_FIELD_TYPE_DEFINITIONS,
        "locale_rules_summary": {
            "en_AE": "phone requires constraints.country_code '+971'; iban often needs country_prefix 'AE'.",
            "ar_AE": "Same phone and iban constraints as en_AE.",
        },
    }
