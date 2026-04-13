"""Idempotent replay for expensive AI endpoints (Redis-backed)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

import redis.asyncio as aioredis


def body_fingerprint(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


async def get_cached_json(redis: aioredis.Redis, key: str) -> dict[str, Any] | None:
    raw = await redis.get(key)
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, AttributeError):
        return None


async def set_cached_json(
    redis: aioredis.Redis,
    key: str,
    value: dict[str, Any],
    ttl_sec: int = 86400,
) -> None:
    await redis.setex(key, ttl_sec, json.dumps(value, separators=(",", ":")).encode("utf-8"))
