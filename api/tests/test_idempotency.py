"""Idempotent replay for POST /api/v1/generate-ai (JSON + Redis)."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from starlette.testclient import TestClient


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


def test_idempotent_replay_header(client: TestClient):
    """Second identical request with same Idempotency-Key returns X-Idempotent-Replay."""
    calls = {"infer": 0, "gen": 0}

    async def infer(*a, **k):
        calls["infer"] += 1
        return [
            {"name": "x", "type": "email", "description": "d", "inference_source": "ollama"},
        ]

    async def gen(*a, **k):
        calls["gen"] += 1
        return [{"x": "only@example.com"}]

    class FakeRedis:
        def __init__(self) -> None:
            self.store: dict[str, bytes] = {}

        async def get(self, k):
            v = self.store.get(k.decode() if isinstance(k, bytes) else k)
            return v

        async def setex(self, k, _ttl, v):
            key = k.decode() if isinstance(k, bytes) else k
            self.store[key] = v if isinstance(v, bytes) else v.encode()

        async def ping(self):
            return True

        async def incr(self, k):
            key = k.decode() if isinstance(k, bytes) else k
            cur = int(self.store.get(key, b"0").decode() or "0")
            cur += 1
            self.store[key] = str(cur).encode()
            return cur

        async def incrby(self, k, n):
            key = k.decode() if isinstance(k, bytes) else k
            cur = int(self.store.get(key, b"0").decode() or "0")
            cur += int(n)
            self.store[key] = str(cur).encode()
            return cur

        async def expire(self, *_a, **_k):
            return True

        async def aclose(self):
            return None

    r = FakeRedis()

    async def open_redis():
        return r

    with (
        patch("main.infer_schema_from_field_names", side_effect=infer),
        patch("main.generate_ai_records", side_effect=gen),
        patch("main._open_redis", side_effect=open_redis),
    ):
        h = {"X-API-Key": "DATAGEN-FREE-zzzzzzzzzzzz", "Idempotency-Key": "test-key-abc"}
        b = {"field_names": ["x"], "count": 1, "locale": "en_US", "output_format": "json"}
        r1 = client.post("/api/v1/generate-ai", headers=h, json=b)
        r2 = client.post("/api/v1/generate-ai", headers=h, json=b)
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert r2.headers.get("X-Idempotent-Replay") == "1"
    assert calls["infer"] == 1
    assert calls["gen"] == 1
    assert r1.json()["records"] == r2.json()["records"]
