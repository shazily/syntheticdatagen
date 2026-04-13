"""Unit: Ollama JSON path produces inference_source ollama when HTTP layer returns valid JSON."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import patch

from ai_generate_service import infer_schema_from_field_names


def test_infer_uses_ollama_when_json_valid():
    async def fake_ollama(*_a, **_k):
        return json.dumps(
            [
                {"name": "a", "type": "email", "description": "Work email"},
                {"name": "b", "type": "decimal", "description": "Amount"},
            ]
        )

    async def _run():
        with patch("ai_generate_service.ollama_generate_json_response", side_effect=fake_ollama):
            return await infer_schema_from_field_names(
                ["a", "b"],
                domain_hint=None,
                locale="en_US",
                ollama_host="http://fake",
                ollama_model="any",
            )

    out = asyncio.run(_run())
    assert len(out) == 2
    assert out[0]["inference_source"] == "ollama"
    assert out[0]["type"] == "email"
    assert "Work email" in out[0]["description"]
