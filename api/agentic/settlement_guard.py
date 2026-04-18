"""
Settlement and delivery guard for non-custodial escrow flows.

Requirements satisfied:
- Uses real redis.asyncio client pointed at REDIS_URL for nonce idempotency locks.
- Queries Base RPC before generation to confirm escrow lock transaction.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

import httpx
import redis.asyncio as aioredis


REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
BASE_RPC_URL = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
ESCROW_CONTRACT = os.getenv("X402_ESCROW_CONTRACT", "").lower()

# keccak256("FundsLocked(address,uint256,uint256,uint64)")
FUNDS_LOCKED_TOPIC0 = (
    "0x346740e222051fda0c8974fc6d970a808f7f2f6a775de2cf4482df11f0d2bd9f"
)


@dataclass(frozen=True)
class SettlementContext:
    agent_address: str
    nonce: int
    payment_tx_hash: str
    expected_amount_micro_usdc: int


class SettlementGuardError(RuntimeError):
    pass


def _normalize_address(address: str) -> str:
    value = (address or "").strip().lower()
    if not value.startswith("0x") or len(value) != 42:
        raise SettlementGuardError("Invalid agent address format.")
    return value


def _topic_address(topic_hex: str) -> str:
    raw = (topic_hex or "").lower().removeprefix("0x")
    if len(raw) != 64:
        raise SettlementGuardError("Invalid indexed address topic length.")
    return f"0x{raw[-40:]}"


def _topic_uint(topic_hex: str) -> int:
    raw = (topic_hex or "").lower().removeprefix("0x")
    if len(raw) != 64:
        raise SettlementGuardError("Invalid indexed uint topic length.")
    return int(raw, 16)


async def acquire_nonce_lock(
    *,
    agent_address: str,
    nonce: int,
    ttl_seconds: int = 120,
) -> None:
    lock_key = f"settlement:nonce:{agent_address.lower()}:{nonce}"
    redis_client = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    try:
        obtained = await redis_client.set(lock_key, "1", ex=ttl_seconds, nx=True)
        if not obtained:
            raise SettlementGuardError(
                "Duplicate settlement attempt blocked by idempotency lock."
            )
    finally:
        await redis_client.aclose()


async def confirm_escrow_tx_on_base(
    *,
    payment_tx_hash: str,
    expected_amount_micro_usdc: int,
    expected_agent_address: str,
    expected_nonce: int,
) -> dict:
    if not ESCROW_CONTRACT:
        raise SettlementGuardError("X402_ESCROW_CONTRACT env var is required.")

    async with httpx.AsyncClient(timeout=12.0) as client:
        receipt_resp = await client.post(
            BASE_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "method": "eth_getTransactionReceipt",
                "params": [payment_tx_hash],
                "id": 1,
            },
        )
    receipt_payload = receipt_resp.json()
    receipt = receipt_payload.get("result")
    if not receipt:
        raise SettlementGuardError("Escrow transaction receipt not found on Base RPC.")

    if receipt.get("status") != "0x1":
        raise SettlementGuardError("Escrow transaction failed on-chain.")

    receipt_to = (receipt.get("to") or "").lower()
    if receipt_to != ESCROW_CONTRACT:
        raise SettlementGuardError("Escrow tx destination does not match escrow contract.")

    logs = receipt.get("logs") or []
    expected_agent = _normalize_address(expected_agent_address)
    locked_events = [
        log
        for log in logs
        if (log.get("address") or "").lower() == ESCROW_CONTRACT
        and (log.get("topics") or [None])[0] == FUNDS_LOCKED_TOPIC0
    ]
    if not locked_events:
        raise SettlementGuardError("FundsLocked event missing in escrow receipt logs.")

    matched_event = None
    for event in locked_events:
        topics = event.get("topics") or []
        if len(topics) < 3:
            continue
        agent_in_log = _topic_address(topics[1])
        nonce_in_log = _topic_uint(topics[2])
        if agent_in_log == expected_agent and nonce_in_log == expected_nonce:
            matched_event = event
            break
    if matched_event is None:
        raise SettlementGuardError(
            "FundsLocked event does not match expected agent address and nonce."
        )

    # data = abi.encode(amount, expiry) for indexed args agent + nonce
    # first 32 bytes = uint256 amount
    data_hex = (matched_event.get("data") or "0x")[2:]
    if len(data_hex) < 64:
        raise SettlementGuardError("Invalid FundsLocked event payload.")
    amount = int(data_hex[0:64], 16)
    if amount < expected_amount_micro_usdc:
        raise SettlementGuardError("Escrowed amount is less than required invoice amount.")

    return receipt


async def guard_settlement_before_generation(context: SettlementContext) -> dict:
    await acquire_nonce_lock(agent_address=context.agent_address, nonce=context.nonce)
    receipt = await confirm_escrow_tx_on_base(
        payment_tx_hash=context.payment_tx_hash,
        expected_amount_micro_usdc=context.expected_amount_micro_usdc,
        expected_agent_address=context.agent_address,
        expected_nonce=context.nonce,
    )
    return {
        "status": "confirmed",
        "agent_address": context.agent_address.lower(),
        "nonce": context.nonce,
        "payment_tx_hash": context.payment_tx_hash,
        "receipt_block": int(receipt["blockNumber"], 16),
        "receipt": json.dumps(receipt, separators=(",", ":")),
    }
