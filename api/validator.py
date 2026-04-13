"""Request validation; returns ConversationalError list (non short-circuiting)."""

from __future__ import annotations

from models import ConversationalError, FieldDefinition

LOCALE_RULES: dict = {
    "en_AE": {
        "phone": {
            "required_constraint": "country_code",
            "expected_value": "+971",
            "hint": "Add constraints: {'country_code': '+971'} to the phone field for UAE locale.",
        },
        "iban": {
            "required_constraint": "country_prefix",
            "expected_value": "AE",
            "hint": "UAE IBAN fields require constraints: {'country_prefix': 'AE'}.",
        },
    },
    "ar_AE": {
        "phone": {
            "required_constraint": "country_code",
            "expected_value": "+971",
            "hint": "Add constraints: {'country_code': '+971'} to the phone field for UAE locale.",
        },
        "iban": {
            "required_constraint": "country_prefix",
            "expected_value": "AE",
            "hint": "UAE IBAN fields require constraints: {'country_prefix': 'AE'}.",
        },
    },
}


def validate_request(
    fields: list[FieldDefinition],
    count: int,
    locale: str,
    tier_config: dict,
) -> list[ConversationalError]:
    """
    Validates a generation request against tier limits and locale rules.
    Collects ALL errors — does not short-circuit on first failure.
    Returns empty list if valid.
    """
    from capabilities import FIELD_CATEGORY_MAP

    errors: list[ConversationalError] = []
    upgrade_url = "https://datagen.gptlab.ae/pricing"
    allowed = tier_config.get("allowed_field_categories", [])

    if not fields:
        errors.append(
            ConversationalError(
                message="schema_fields is empty.",
                correction_hint="Provide at least one field. Call GET /api/v1/capabilities to see available types.",
            )
        )
        return errors

    if len(fields) > 50:
        errors.append(
            ConversationalError(
                message="Too many fields in schema.",
                correction_hint="Provide at most 50 fields per request.",
            )
        )

    max_records = tier_config.get("max_records_per_call", 100)
    if max_records != -1 and count > max_records:
        errors.append(
            ConversationalError(
                message=f"Requested {count} records but your tier allows max {max_records}.",
                correction_hint=f"Reduce count to {max_records} or upgrade your tier.",
                upgrade_required=True,
                upgrade_url=upgrade_url,
            )
        )

    for field in fields:
        category = FIELD_CATEGORY_MAP.get(field.type)
        if category and allowed != "all" and isinstance(allowed, list):
            if category not in allowed:
                errors.append(
                    ConversationalError(
                        field=field.name,
                        message=(
                            f"Field '{field.name}' uses type '{field.type}' (category: {category}) "
                            f"which requires a higher tier."
                        ),
                        correction_hint=(
                            f"Remove '{field.name}' or upgrade to Pro tier to access {category} fields."
                        ),
                        upgrade_required=True,
                        upgrade_url=upgrade_url,
                    )
                )

    locale_rules = LOCALE_RULES.get(locale, {})
    for field in fields:
        rule = locale_rules.get(field.type)
        if rule:
            constraints = field.constraints or {}
            if rule["required_constraint"] not in constraints:
                fixed = field.model_dump(by_alias=True)
                fixed["constraints"] = {
                    rule["required_constraint"]: rule["expected_value"]
                }
                errors.append(
                    ConversationalError(
                        field=field.name,
                        message=(
                            f"Field '{field.name}' is missing a required constraint for locale '{locale}'."
                        ),
                        correction_hint=rule["hint"],
                        suggested_fix=fixed,
                    )
                )

    return errors
