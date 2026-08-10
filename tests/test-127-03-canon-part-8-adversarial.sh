#!/usr/bin/env bash
# Phase 127 Plan 03 -- Canon Part 8 adversarial sweep (BRAIN-MCP-127-10).
#
# Greps the 6 Phase 127 production source files for forbidden network-surface
# patterns and asserts ZERO matches outside the SOLE allowed delegation target
# (lib/core/brain-client.cjs).
#
# Also asserts:
#   1) lib/core/brain-client.cjs DOES contain the network surface
#      (inverse delegation check; catches the false-positive where every file
#      passes because no file has any network surface at all).
#   2) bin/mindrian-brain-mcp-client.cjs does NOT call sendPacket directly
#      (typed-packet contract is upstream-only; the shim is transport-only).
#   3) Zero matches for the Canon Part 8 leak-vocabulary tokens.
#
# Exit 0 only when the delegation property holds.
# HARD RULE: no em-dashes (hyphens only) anywhere in this file.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# The 6 Phase 127 production source files. Each MUST be free of direct
# network surface (Canon Part 8 delegation property: only brain-client.cjs
# may contain network calls). Fixtures + tests + docs are excluded.
PHASE_127_SOURCES=(
  "bin/mindrian-brain-mcp-client.cjs"
  "lib/core/directive-envelope.cjs"
  "lib/core/refusal-messaging.cjs"
  "lib/core/migration-snapshot.cjs"
  "scripts/migrate-brain-mcp-from-http-to-stdio.cjs"
  "lib/core/doctor/class-m-brain-smoke.cjs"
)

# Forbidden patterns. Note: https?:// is NOT in this list because
# refusal-messaging.cjs legitimately contains the user-visible upgrade-hint URL
# https://mindrian-os.com/brain-access (a help string, never fetched).
FORBIDDEN_PATTERNS=(
  'fetch\('
  'http\.'
  'brain\.mindrian\.ai'
  'mindrian-brain\.onrender\.com'
)

FAIL_COUNT=0

echo "Canon Part 8 adversarial sweep across Phase 127 production sources..."
for src in "${PHASE_127_SOURCES[@]}"; do
  if [ ! -f "$src" ]; then
    echo "FAIL: source file missing: $src"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  for pat in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -E "$pat" "$src" >/dev/null 2>&1; then
      echo "FAIL: $src contains forbidden pattern: $pat"
      grep -nE "$pat" "$src" | head -3
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  done
done

# Canon Part 8 prose audit: leak-vocabulary tokens
LEAK_VOCAB=(
  'user_artifact'
  'meeting_text'
  'transcript_body'
  'personal_identifier'
)
for src in "${PHASE_127_SOURCES[@]}"; do
  [ ! -f "$src" ] && continue
  for word in "${LEAK_VOCAB[@]}"; do
    if grep -qE "$word" "$src" 2>/dev/null; then
      echo "FAIL: $src contains Canon Part 8 leak-vocabulary token: $word"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  done
done

# sendPacket bypass guard: the shim must NOT call sendPacket directly.
# The typed-packet contract is consumed UPSTREAM by buildBrainPacket callers,
# not by this transport-only shim.
if grep -qE 'brain-?client\.sendPacket|sendPacket\(' bin/mindrian-brain-mcp-client.cjs 2>/dev/null; then
  echo "FAIL: bin/mindrian-brain-mcp-client.cjs calls sendPacket directly"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Inverse delegation check: lib/core/brain-client.cjs DOES contain network surface.
# Without this check, a passing harness could mean nothing has network surface at all.
NETWORK_PATTERN_FOUND_IN_BRAIN_CLIENT=0
for pat in "${FORBIDDEN_PATTERNS[@]}"; do
  if grep -qE "$pat" lib/core/brain-client.cjs 2>/dev/null; then
    NETWORK_PATTERN_FOUND_IN_BRAIN_CLIENT=1
    break
  fi
done
if [ "$NETWORK_PATTERN_FOUND_IN_BRAIN_CLIENT" -eq 0 ]; then
  echo "FAIL: lib/core/brain-client.cjs has no network surface; delegation property broken"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "CANON PART 8 ADVERSARIAL AUDIT: PASS (delegation property holds across 6 Phase 127 sources)"
  exit 0
else
  echo "CANON PART 8 ADVERSARIAL AUDIT: FAIL ($FAIL_COUNT violation(s))"
  exit 1
fi
