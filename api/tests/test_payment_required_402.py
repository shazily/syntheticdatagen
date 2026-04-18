from __future__ import annotations

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from agentic.payment_required_402 import PaymentRequired402Middleware


async def _generate(_request):
    return JSONResponse({"ok": True})


def test_payment_required_402_for_keyless_canary_generate():
    app = Starlette(routes=[Route("/api/v1/canary/generate", _generate, methods=["POST"])])
    app.add_middleware(PaymentRequired402Middleware)

    client = TestClient(app)
    r = client.post("/api/v1/canary/generate", json={"count": 5, "nonce": 7})
    assert r.status_code == 402
    body = r.json()
    assert body["error"] == "payment_required"
    assert body["invoice"]["chain_id"] == 84532
    assert body["invoice"]["network"] == "base-sepolia"
    assert body["invoice"]["nonce"] == 7


def test_payment_middleware_allows_api_key():
    app = Starlette(routes=[Route("/api/v1/canary/generate", _generate, methods=["POST"])])
    app.add_middleware(PaymentRequired402Middleware)

    client = TestClient(app)
    r = client.post(
        "/api/v1/canary/generate",
        headers={"X-API-Key": "DATAGEN-FREE-test"},
        json={"count": 1},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
