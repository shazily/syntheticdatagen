"""Async Ollama calls for POST /api/v1/generate-ai (infer types from names + generate rows)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from field_type_catalog import CANONICAL_TYPE_NAMES
from ollama_client import (
    extract_json_array,
    ollama_generate_json_response,
    resolve_ollama_model,
)

logger = logging.getLogger(__name__)

_TYPE_LOOKUP = {n.lower(): n for n in CANONICAL_TYPE_NAMES}


def normalize_inferred_type(raw: str) -> str:
    """Map model output to a canonical catalog type; default text."""
    if not raw or not isinstance(raw, str):
        return "text"
    s = raw.strip()
    if s in CANONICAL_TYPE_NAMES:
        return s
    key = re.sub(r"[\s_-]+", "", s.lower())
    for canon in CANONICAL_TYPE_NAMES:
        if re.sub(r"[\s_-]+", "", canon.lower()) == key:
            return canon
    lo = s.lower()
    if lo in _TYPE_LOOKUP:
        return _TYPE_LOOKUP[lo]
    return "text"


def heuristic_infer_schema(field_names: list[str]) -> list[dict[str, Any]]:
    """Rule-based type guess when Ollama is unavailable."""
    out: list[dict[str, Any]] = []
    for name in field_names:
        n = name.lower()
        if "email" in n or n.endswith("_email"):
            t = "email"
        elif "phone" in n or "mobile" in n or "tel" in n:
            t = "phone"
        elif "uuid" in n or (n.endswith("_id") and "order" not in n and "employee" not in n):
            t = "uuid"
        elif "date" in n or "time" in n or "dob" in n or "birth" in n:
            t = "dateTime" if "time" in n else "date"
        elif "price" in n or "amount" in n or "total" in n or "cost" in n:
            t = "decimal"
        elif "count" in n or "qty" in n or "number" in n or "age" in n:
            t = "integer"
        elif "url" in n or "website" in n or "link" in n:
            t = "url"
        elif "address" in n or "street" in n:
            t = "address"
        elif "city" in n:
            t = "city"
        elif "country" in n or "nation" in n:
            t = "country"
        elif "sku" in n:
            t = "sku"
        elif "product" in n or "item" in n:
            t = "productName"
        elif "flavor" in n or "scoop" in n:
            t = "flavorName"
        elif "first" in n and "name" in n:
            t = "firstName"
        elif "last" in n and "name" in n:
            t = "lastName"
        elif "name" in n:
            t = "fullName"
        else:
            t = "text"
        out.append(
            {
                "name": name,
                "type": t,
                "description": f"Synthetic column inferred from name '{name}'",
                "inference_source": "heuristic",
            }
        )
    return out


def _build_infer_prompt(field_names: list[str], domain_hint: str | None, locale: str) -> str:
    types_csv = ", ".join(CANONICAL_TYPE_NAMES)
    hint = f"\nDomain context: {domain_hint}\n" if domain_hint else ""
    names_json = json.dumps(field_names)
    return f"""You are a data architect. Map each input column name to exactly one canonical type from the list.

Locale hint: {locale}
{hint}
Input column names (JSON array): {names_json}

Allowed type values (use EXACT spelling, camelCase only):
{types_csv}

Output ONLY a JSON array (no markdown, no prose). One object per input name, same order as input.
Each object must have:
  "name": string (exact column name from input),
  "type": string (one allowed value),
  "description": string (one short sentence).

Example:
[{{"name":"customer_email","type":"email","description":"Customer contact email"}}]

Generate the array now:"""


def _build_sample_prompt(schema: list[dict[str, Any]], num_samples: int, locale: str) -> str:
    schema_info = json.dumps(
        [{k: v for k, v in s.items() if k != "inference_source"} for s in schema],
        indent=2,
    )
    return f"""Generate {num_samples} realistic synthetic records for testing (not real PII).

Locale / region style: {locale}

Schema (name, type, description per field):
{schema_info}

Rules:
1. Output ONLY a JSON array of {num_samples} objects.
2. Each object has keys exactly matching schema "name" values.
3. Values must match the semantic type (emails look like emails, amounts are numeric, etc.).
4. Vary values across rows; keep them plausible for demos.

Generate the array now:"""


async def infer_schema_from_field_names(
    field_names: list[str],
    *,
    domain_hint: str | None,
    locale: str,
    ollama_host: str,
    ollama_model: str,
) -> list[dict[str, Any]]:
    prompt = _build_infer_prompt(field_names, domain_hint, locale)
    try:
        model = await resolve_ollama_model(ollama_host, ollama_model)
        text = await ollama_generate_json_response(
            ollama_host, model, prompt, timeout=120.0, use_json_format=True
        )
        arr = extract_json_array(text)
        if not arr:
            logger.warning("Ollama infer: no JSON array in response (len text=%s)", len(text))
            return heuristic_infer_schema(field_names)
        normalized: list[dict[str, Any]] = []
        for i, fn in enumerate(field_names):
            src = arr[i] if i < len(arr) and isinstance(arr[i], dict) else {}
            t = normalize_inferred_type(str(src.get("type", "text")))
            desc = str(src.get("description", f"Synthetic field {fn}"))
            normalized.append(
                {
                    "name": fn,
                    "type": t,
                    "description": desc,
                    "inference_source": "ollama",
                }
            )
        return normalized
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ollama schema infer failed: %r", exc)
        return heuristic_infer_schema(field_names)


async def generate_ai_records(
    schema: list[dict[str, Any]],
    count: int,
    *,
    locale: str,
    ollama_host: str,
    ollama_model: str,
) -> list[dict[str, Any]]:
    prompt = _build_sample_prompt(schema, count, locale)
    try:
        model = await resolve_ollama_model(ollama_host, ollama_model)
        text = await ollama_generate_json_response(
            ollama_host, model, prompt, timeout=240.0, use_json_format=True
        )
        arr = extract_json_array(text)
        if not arr or not all(isinstance(r, dict) for r in arr):
            logger.warning("Ollama samples: missing or invalid JSON array")
            return []
        names = [f["name"] for f in schema]
        cleaned: list[dict[str, Any]] = []
        for row in arr[:count]:
            cleaned.append({n: row.get(n, row.get(n.replace("_", ""), "")) for n in names})
        return cleaned[:count]
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ollama sample generation failed: %r", exc)
        return []


def faker_fallback_records(schema: list[dict[str, Any]], count: int, locale: str) -> list[dict[str, Any]]:
    """Last resort: use api.generator.DataGenerator-style Faker map via sync import."""
    from models import FieldDefinition

    from generator import DataGenerator

    fields = [
        FieldDefinition(
            name=f["name"],
            type=f.get("type", "text"),
            constraints=f.get("constraints"),
        )
        for f in schema
    ]
    gen = DataGenerator()
    return gen.generate(fields, count, locale, "json")
