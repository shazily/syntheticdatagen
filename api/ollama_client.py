"""Shared async Ollama HTTP helpers: model resolution, JSON-mode generate, robust parsing."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def strip_markdown_fences(text: str) -> str:
    m = _FENCE_RE.search(text)
    if m:
        return m.group(1).strip()
    return text.strip()


def extract_json_array(text: str) -> list[Any] | None:
    """Parse a JSON array from model output (handles extra prose / fences)."""
    cleaned = strip_markdown_fences(text)
    for candidate in (cleaned, text):
        start = candidate.find("[")
        end = candidate.rfind("]") + 1
        if start == -1 or end <= start:
            continue
        try:
            data = json.loads(candidate[start:end])
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            continue
    return None


async def list_ollama_models(host: str, timeout: float = 5.0) -> list[str]:
    base = host.rstrip("/")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{base}/api/tags", timeout=timeout)
            r.raise_for_status()
            data = r.json()
        out: list[str] = []
        for m in data.get("models", []) or []:
            name = m.get("name")
            if name:
                out.append(name)
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("list_ollama_models failed: %r", exc)
        return []


async def resolve_ollama_model(host: str, preferred: str) -> str:
    """Use preferred model if present; otherwise first tag from Ollama."""
    models = await list_ollama_models(host)
    if not models:
        return preferred
    if preferred in models:
        return preferred
    pref_base = preferred.split(":")[0].lower()
    for m in models:
        if m.lower() == preferred.lower() or m.split(":")[0].lower() == pref_base:
            return m
    return models[0]


async def ollama_generate_json_response(
    host: str,
    model: str,
    prompt: str,
    *,
    timeout: float = 180.0,
    use_json_format: bool | None = None,
) -> str:
    """
    POST /api/generate with stream=false.
    If use_json_format is True (default from env OLLAMA_JSON_FORMAT), request JSON object/array from model.
    """
    if use_json_format is None:
        use_json_format = os.environ.get("OLLAMA_JSON_FORMAT", "1").strip().lower() in (
            "1",
            "true",
            "yes",
        )
    base = host.rstrip("/")
    url = f"{base}/api/generate"
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": float(os.environ.get("OLLAMA_TEMPERATURE", "0.55")),
            "top_p": 0.9,
            "num_predict": int(os.environ.get("OLLAMA_NUM_PREDICT", "2048")),
        },
    }
    if use_json_format:
        payload["format"] = "json"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=timeout)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500] if exc.response else ""
            logger.error(
                "Ollama /api/generate HTTP %s model=%r body_prefix=%r",
                exc.response.status_code if exc.response else "?",
                model,
                body,
            )
            raise
        data = resp.json()
    return str(data.get("response", ""))
