---
phase: quick
plan: 261006-sio
subsystem: mcp server lifecycle
tags: [mcp, stdio, orphan, shutdown]
key-files:
  modified: [scripts/mindrian-mcp-server.cjs, CHANGELOG.md]
  created: [tests/test-mcp-server-stdin-eof-exit.cjs]
status: complete
completed: 2026-10-06
---
# Quick 261006-sio Summary

The stdio MCP server now exits through exitAfterTeardown when stdin ends or closes, or when its parent pid changes (poll every 5000 ms, env MINDRIAN_PARENT_WATCH_MS, unref'd, skipped on win32). Both stdio paths call registerParentLossListeners(). HTTP mode is unchanged. exitAfterTeardown has an existing guard against double shutdown.

Review fix: MINDRIAN_PARENT_WATCH_MS parse now falls back to 5000 for NaN, negative, Infinity, or values below 50.

Verified: tests/test-mcp-server-stdin-eof-exit.cjs passes 4 of 4.
Unverified: tests/test-267-mcpv2-lifecycle.cjs cannot run. Port 3847 is fixed in the test and held by pid 126630 (not killed). The test exits with ENV GAP.
