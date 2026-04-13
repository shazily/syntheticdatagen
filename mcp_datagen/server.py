#!/usr/bin/env python3
"""
DataGen MCP server (stdio) — thin entrypoint.

The implementation lives in ``api/datagen_mcp_app.py`` so the same tools run
for stdio (local) and HTTP/SSE (hosted on the API process at ``/mcp``).

Environment:
  DATAGEN_API_BASE   Base URL (no trailing slash), e.g. https://datagen.gptlab.ae
  DATAGEN_API_KEY    Optional X-API-Key for authenticated tiers

Run (from repo root):
  pip install -r mcp_datagen/requirements.txt
  pip install -r api/requirements.txt
  python mcp_datagen/server.py

Hosted MCP (same deployment as the API): connect your MCP client to
``https://<your-host>/mcp/sse`` with header ``X-API-Key`` (see site MCP page).
"""

from __future__ import annotations

import os
import sys

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_api = os.path.join(_root, "api")
if _api not in sys.path:
    sys.path.insert(0, _api)

if __name__ == "__main__":
    os.environ.setdefault("DATAGEN_API_BASE", "http://127.0.0.1:18000")

from datagen_mcp_app import mcp  # noqa: E402

if __name__ == "__main__":
    mcp.run()
