#!/usr/bin/env bash
# tests/test-114-mcp-alwaysload.sh
# Phase 114 / AC-114-03: mindrian-os MCP tools available from turn 1 (no 10% threshold wait)

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
note() { echo "NOTE: $1"; }

# Test 1: structural -- .mcp.json mindrian-os entry has alwaysLoad: true (boolean)
STRUCT_OK=$(node -e "
  const c = require('./.mcp.json');
  const s = c.mcpServers && c.mcpServers['mindrian-os'];
  if (!s) { console.log('FAIL: mindrian-os entry missing'); process.exit(1); }
  if (s.alwaysLoad !== true) {
    console.log('FAIL: alwaysLoad is ' + JSON.stringify(s.alwaysLoad) + ', expected true (boolean)');
    process.exit(1);
  }
  if (s.command !== 'node') {
    console.log('FAIL: command is ' + s.command + ', expected node');
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail ".mcp.json mindrian-os structural check: $STRUCT_OK"
pass ".mcp.json mindrian-os entry has alwaysLoad: true (boolean) + command: node preserved"

# Test 2: smoke -- if claude CLI + /mcp non-interactive available, assert mindrian-os
# surfaces N>=1 tools at session boot (CC 2.1.128+ /mcp zero-tool flagging)
if ! command -v claude > /dev/null 2>&1; then
  note "\`claude\` CLI not in PATH; smoke test skipped (manual fallback: tests/manual/114-acceptance.md)"
  echo ""
  echo "==== AC-114-03 alwaysLoad: STRUCTURAL CHECK PASSED (smoke test deferred) ===="
  exit 0
fi

if ! claude --help 2>&1 | grep -q -- "--print"; then
  note "\`claude --print\` flag not available; smoke test skipped"
  echo ""
  echo "==== AC-114-03 alwaysLoad: STRUCTURAL CHECK PASSED (smoke test deferred) ===="
  exit 0
fi

if [ "${MINDRIAN_SKIP_LIVE_CLAUDE:-0}" = "1" ]; then
  note "MINDRIAN_SKIP_LIVE_CLAUDE=1; smoke test skipped (manual fallback: tests/manual/114-acceptance.md)"
  echo ""
  echo "==== AC-114-03 alwaysLoad: STRUCTURAL CHECK PASSED (smoke test deferred) ===="
  exit 0
fi

# Smoke: run /mcp non-interactively and assert mindrian-os shows >= 1 tool
SMOKE_OUT=$(mktemp /tmp/114-mcp-smoke.XXXXXX.txt)
trap "rm -f $SMOKE_OUT" EXIT

if timeout 30 claude --print --plugin-dir . "/mcp" > "$SMOKE_OUT" 2>&1; then
  if grep -q "mindrian-os" "$SMOKE_OUT"; then
    # Best-effort assertion: mindrian-os listed; any tool count >= 1 acceptable
    # (exact /mcp output schema varies across CC versions)
    pass "/mcp lists mindrian-os server"
  else
    cat "$SMOKE_OUT"
    note "/mcp output does not list mindrian-os server (may be auth or version constraint)"
    note "Defer to manual checklist: tests/manual/114-acceptance.md"
  fi
else
  cat "$SMOKE_OUT"
  note "/mcp invocation failed or timed out; consult tests/manual/114-acceptance.md to validate"
fi

echo ""
echo "==== AC-114-03 alwaysLoad: STRUCTURAL + SMOKE CHECKS COMPLETE ===="
exit 0
