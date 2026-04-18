from __future__ import annotations

import pytest

import api.agentic.settlement_guard as settlement_guard
from api.agentic.settlement_guard import SettlementGuardError


class FakeRedis:
    def __init__(self):
        self._store: dict[str, str] = {}

    async def set(self, key, value, ex=None, nx=False):  # noqa: ARG002
        if nx and key in self._store:
            return False
        self._store[key] = value
        return True

    async def aclose(self):
        return None


class FakeAsyncClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):  # noqa: ARG002
        return None

    async def post(self, _url, json=None):  # noqa: A002
        assert json["method"] == "eth_getTransactionReceipt"
        data_word = f"{5000:064x}" + f"{0:064x}"
        agent_topic = "0x" + ("0" * 24) + "abc".rjust(40, "0")
        nonce_topic = "0x" + f"{12:064x}"
        return FakeResponse(
            {
                "result": {
                    "status": "0x1",
                    "to": "0xescrow",
                    "blockNumber": "0x10",
                    "logs": [
                        {
                            "address": "0xescrow",
                            "topics": [
                                settlement_guard.FUNDS_LOCKED_TOPIC0,
                                agent_topic,
                                nonce_topic,
                            ],
                            "data": f"0x{data_word}",
                        }
                    ],
                }
            }
        )


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


@pytest.mark.anyio
async def test_guard_settlement_success(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(settlement_guard.aioredis, "from_url", lambda *a, **k: fake_redis)
    monkeypatch.setattr(settlement_guard.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient())
    monkeypatch.setattr(settlement_guard, "ESCROW_CONTRACT", "0xescrow")

    out = await settlement_guard.guard_settlement_before_generation(
        settlement_guard.SettlementContext(
            agent_address="0x0000000000000000000000000000000000000abc",
            nonce=12,
            payment_tx_hash="0x" + "1" * 64,
            expected_amount_micro_usdc=5000,
        )
    )
    assert out["status"] == "confirmed"
    assert out["nonce"] == 12


@pytest.mark.anyio
async def test_guard_settlement_duplicate_nonce(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(settlement_guard.aioredis, "from_url", lambda *a, **k: fake_redis)
    monkeypatch.setattr(settlement_guard.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient())
    monkeypatch.setattr(settlement_guard, "ESCROW_CONTRACT", "0xescrow")

    ctx = settlement_guard.SettlementContext(
        agent_address="0x0000000000000000000000000000000000000abc",
        nonce=12,
        payment_tx_hash="0x" + "2" * 64,
        expected_amount_micro_usdc=5000,
    )
    await settlement_guard.guard_settlement_before_generation(ctx)
    with pytest.raises(SettlementGuardError):
        await settlement_guard.guard_settlement_before_generation(ctx)


@pytest.mark.anyio
async def test_guard_settlement_nonce_mismatch(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(settlement_guard.aioredis, "from_url", lambda *a, **k: fake_redis)
    monkeypatch.setattr(settlement_guard.httpx, "AsyncClient", lambda *a, **k: FakeAsyncClient())
    monkeypatch.setattr(settlement_guard, "ESCROW_CONTRACT", "0xescrow")

    with pytest.raises(SettlementGuardError):
        await settlement_guard.guard_settlement_before_generation(
            settlement_guard.SettlementContext(
                agent_address="0x0000000000000000000000000000000000000abc",
                nonce=99,
                payment_tx_hash="0x" + "3" * 64,
                expected_amount_micro_usdc=5000,
            )
        )
