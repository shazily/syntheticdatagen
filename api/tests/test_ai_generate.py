"""Tests for AI generate path (Ollama mocked; falls back to heuristic + Faker)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from starlette.testclient import TestClient

# Import app after env quiet
import os

os.environ.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:1")


@pytest.fixture()
def client() -> TestClient:
    from main import app

    return TestClient(app)


def test_field_types_catalog(client: TestClient):
    r = client.get("/api/v1/field-types")
    assert r.status_code == 200
    body = r.json()
    assert body["type_count"] >= 50
    names = {f["name"] for f in body["field_types"]}
    assert "flavorName" in names and "iban" in names and "text" in names


def test_generate_ai_free_under_cap(client: TestClient):
    async def fake_infer(*args, **kwargs):
        return [
            {"name": "a", "type": "email", "description": "d"},
            {"name": "b", "type": "integer", "description": "d"},
        ]

    async def fake_gen(*args, **kwargs):
        return [{"a": "x@y.z", "b": 1}, {"a": "p@q.r", "b": 2}]

    with (
        patch("main.infer_schema_from_field_names", side_effect=fake_infer),
        patch("main.generate_ai_records", side_effect=fake_gen),
    ):
        r = client.post(
            "/api/v1/generate-ai",
            headers={"X-API-Key": "DATAGEN-FREE-abcd1234efgh"},
            json={"field_names": ["a", "b"], "count": 2, "locale": "en_US", "output_format": "json"},
        )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["generation_mode"] == "ai"
    assert len(out["records"]) == 2
    assert len(out["inferred_schema"]) == 2


def test_generate_ai_free_over_cap_422(client: TestClient):
    r = client.post(
        "/api/v1/generate-ai",
        headers={"X-API-Key": "DATAGEN-FREE-abcd1234efgh"},
        json={
            "field_names": ["email"],
            "count": 500,
            "locale": "en_US",
            "output_format": "json",
        },
    )
    assert r.status_code == 422
    assert "max_ai_records" in str(r.json()).lower() or "100" in r.text


def test_generate_ai_no_key_402(client: TestClient):
    r = client.post(
        "/api/v1/generate-ai",
        json={"field_names": ["x"], "count": 1, "locale": "en_US", "output_format": "json"},
    )
    assert r.status_code == 402


def test_heuristic_infer_schema_roundtrip():
    from ai_generate_service import heuristic_infer_schema

    s = heuristic_infer_schema(["customer_email", "order_total", "flavor_guess"])
    assert {f["name"] for f in s} == {"customer_email", "order_total", "flavor_guess"}
    assert s[0]["type"] == "email"
    assert s[2]["type"] == "flavorName"
