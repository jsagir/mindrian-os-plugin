# Fixture: tier-0-no-key (acceptance gate 4)

Hermetic state: same as clean-install, with the additional assertion that the shim's stderr startup line matches the canonical pattern `[mindrian-brain] MCP server v<version> started (stdio)` within 3s of spawn.

Expected behavior: no opaque error, no crash, statusline-friendly startup signal. This is the gate that proves the silent-failure cohort (the 14 zero-request key holders + the 12 under-10-request users per CONTEXT Track C) gets unblocked without any individual outreach.
