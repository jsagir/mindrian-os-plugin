---
phase: quick
plan: 261006-sio
type: execute
files_modified:
  - scripts/mindrian-mcp-server.cjs
  - tests/test-mcp-server-stdin-eof-exit.cjs
  - CHANGELOG.md
autonomous: true
---
# Quick 261006-sio: MCP server stdin-EOF and parent-loss exit

Problem: a stdio MCP server whose host dies without SIGTERM never exits. The tree watcher keeps the event loop alive. 104 orphans (about 5.8 GB) seen in one WSL session.

Tasks:
1. Add registerParentLossListeners() in both stdio startup paths. Exit through the existing exitAfterTeardown on stdin end or close. Add an unref'd ppid poll (not win32), interval from MINDRIAN_PARENT_WATCH_MS, default 5000.
2. Add tests/test-mcp-server-stdin-eof-exit.cjs: leg A stdin close, leg B host SIGKILL.
3. Add one CHANGELOG Fixed line.

Limits: HTTP mode unchanged. No merge, no release.
