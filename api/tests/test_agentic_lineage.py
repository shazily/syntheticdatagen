from __future__ import annotations

from agentic.lineage import compute_lineage_hash, issue_lineage_receipt


def test_lineage_hash_is_deterministic(monkeypatch):
    monkeypatch.setenv("SERVER_SECRET_SALT", "unit-test-salt")
    h1 = compute_lineage_hash(
        generation_engine="ollama",
        model_version="llama3.2",
        timestamp_iso="2026-04-15T12:00:00+00:00",
        field_names=["email", "customer_id"],
        record_count=200,
    )
    h2 = compute_lineage_hash(
        generation_engine="ollama",
        model_version="llama3.2",
        timestamp_iso="2026-04-15T12:00:00+00:00",
        field_names=["customer_id", "email"],
        record_count=200,
    )
    assert h1 == h2


def test_issue_lineage_receipt_shape(monkeypatch):
    monkeypatch.setenv("SERVER_SECRET_SALT", "unit-test-salt")
    receipt = issue_lineage_receipt(
        generation_engine="faker",
        model_version="faker-default",
        field_names=["a", "b"],
        record_count=2,
        timestamp_iso="2026-04-15T12:00:00+00:00",
    )
    assert receipt.record_count == 2
    assert receipt.sorted_field_names == "a,b"
    assert len(receipt.lineage_hash) == 64
