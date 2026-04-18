"""
Deterministic lineage receipts for synthetic generation outputs.

Security requirement:
hash = SHA-256(
    f"{generation_engine}|{model_version}|{timestamp_iso}|{sorted_field_names}|{record_count}|{SERVER_SECRET_SALT}"
)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import os


def _server_secret_salt() -> str:
    salt = os.getenv("SERVER_SECRET_SALT", "").strip()
    if not salt:
        raise RuntimeError(
            "SERVER_SECRET_SALT env var not set. Add it to .env before starting the API."
        )
    return salt


def _canonical_field_names(field_names: list[str]) -> str:
    return ",".join(sorted(name.strip() for name in field_names if name and name.strip()))


def compute_lineage_hash(
    generation_engine: str,
    model_version: str,
    timestamp_iso: str,
    field_names: list[str],
    record_count: int,
) -> str:
    sorted_field_names = _canonical_field_names(field_names)
    SERVER_SECRET_SALT = _server_secret_salt()
    deterministic_payload = (
        f"{generation_engine}|{model_version}|{timestamp_iso}|{sorted_field_names}|{record_count}|{SERVER_SECRET_SALT}"
    )
    return hashlib.sha256(deterministic_payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class LineageReceipt:
    generation_engine: str
    model_version: str
    timestamp_iso: str
    sorted_field_names: str
    record_count: int
    lineage_hash: str


def issue_lineage_receipt(
    *,
    generation_engine: str,
    model_version: str,
    field_names: list[str],
    record_count: int,
    timestamp_iso: str | None = None,
) -> LineageReceipt:
    ts = timestamp_iso or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    sorted_field_names = _canonical_field_names(field_names)
    lineage_hash = compute_lineage_hash(
        generation_engine=generation_engine,
        model_version=model_version,
        timestamp_iso=ts,
        field_names=field_names,
        record_count=record_count,
    )
    return LineageReceipt(
        generation_engine=generation_engine,
        model_version=model_version,
        timestamp_iso=ts,
        sorted_field_names=sorted_field_names,
        record_count=record_count,
        lineage_hash=lineage_hash,
    )


def verify_lineage_receipt(receipt: LineageReceipt) -> bool:
    expected = compute_lineage_hash(
        generation_engine=receipt.generation_engine,
        model_version=receipt.model_version,
        timestamp_iso=receipt.timestamp_iso,
        field_names=receipt.sorted_field_names.split(",") if receipt.sorted_field_names else [],
        record_count=receipt.record_count,
    )
    return expected == receipt.lineage_hash
