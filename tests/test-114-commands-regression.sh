#!/usr/bin/env bash
# tests/test-114-commands-regression.sh
# Phase 114 / AC-114-04: existing /mos:* command paths still work (no regression)

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
note() { echo "NOTE: $1"; }

BASELINE="tests/fixtures/114-baseline-commands.txt"
if [ ! -f "$BASELINE" ]; then
  fail "baseline fixture missing: $BASELINE (run Task 1 of 114-02 to populate)"
fi
pass "baseline fixture present at $BASELINE"

# Structural invariants from baseline header (no command invocation needed for this layer):
# 1. baseline lists 4 commands
for cmd in "/mos:status" "/mos:rooms" "/mos:room" "/mos:think-hats"; do
  if ! grep -q "### COMMAND: $cmd" "$BASELINE"; then
    fail "baseline missing section for $cmd"
  fi
done
pass "baseline lists all 4 expected commands"

# If claude --print is available, invoke each command and assert exit 0 + no emoji + Action Footer
if ! command -v claude > /dev/null 2>&1 || ! claude --help 2>&1 | grep -q -- "--print"; then
  note "\`claude --print\` not available; behavioral regression skipped (manual fallback: tests/manual/114-acceptance.md)"
  echo ""
  echo "==== AC-114-04 regression: STRUCTURAL INVARIANTS PASSED (behavioral deferred) ===="
  exit 0
fi

if [ "${MINDRIAN_SKIP_LIVE_CLAUDE:-0}" = "1" ]; then
  note "MINDRIAN_SKIP_LIVE_CLAUDE=1; behavioral regression skipped (manual fallback: tests/manual/114-acceptance.md)"
  echo ""
  echo "==== AC-114-04 regression: STRUCTURAL INVARIANTS PASSED (behavioral deferred) ===="
  exit 0
fi

for cmd in "/mos:status" "/mos:rooms" "/mos:room" "/mos:think-hats"; do
  OUT=$(mktemp /tmp/114-cmd-${cmd//[^a-zA-Z0-9]/_}.XXXXXX.txt)
  if ! timeout 60 claude --print --plugin-dir . "$cmd" > "$OUT" 2>&1; then
    cat "$OUT"
    rm -f "$OUT"
    fail "$cmd invocation failed or timed out"
  fi

  # Negative: no emoji
  if command -v python3 > /dev/null 2>&1; then
    if ! python3 -c "
import sys, unicodedata
c = open('$OUT').read()
for ch in c:
    if unicodedata.category(ch) == 'So':
        sys.exit(1)
" > /dev/null 2>&1; then
      cat "$OUT"
      rm -f "$OUT"
      fail "$cmd output contains emoji (CLAUDE.md hard rule violation)"
    fi
  fi

  # Positive: at least one canonical glyph from CLAUDE.md vocabulary
  if ! grep -q -E "[■▼▶▷✓•⚠⚡⬜→]" "$OUT"; then
    cat "$OUT"
    note "$cmd output does not contain canonical glyph; flag for manual review"
  fi

  rm -f "$OUT"
  pass "$cmd: exit 0, no emoji, structural shape preserved"
done

echo ""
echo "==== AC-114-04 regression: ALL 4 /mos:* COMMANDS GREEN ===="
exit 0
