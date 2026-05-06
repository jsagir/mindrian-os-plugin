#!/usr/bin/env bash
# Phase 89-07 Wave 0 scaffold smoke test.
# Verifies: EVENT_TYPES.size === 21 + 12 Wave-0 files exist + 5 runner entries registered.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: EVENT_TYPES.size === 21
node -e "const m = require('./lib/core/navigation/memory-events.cjs'); if (m.EVENT_TYPES.size !== 21) process.exit(1); if (!m.EVENT_TYPES.has('reverse_salient_detected')) process.exit(1); if (!m.EVENT_TYPES.has('reverse_salient_acted_on')) process.exit(1);" || fail "EVENT_TYPES gate"

# Gate 2: 12 Wave-0 files present
for f in \
  lib/agents/reverse-salient-agent.cjs \
  agents/reverse-salient-agent.md \
  tests/test-reverse-salient-agent.cjs \
  tests/test-reverse-salient-cascade-emit.cjs \
  tests/test-reverse-salient-f0-integration.cjs \
  tests/test-reverse-salient-persona.cjs \
  tests/test-reverse-salient-telemetry.cjs \
  tests/test-89-07-00-scaffold.sh \
  tests/test-89-07-pattern-doc.sh \
  cypher/phase89-07-rs-agent-completion.cypher \
  .mindrian/rs-framework-snapshot.json
do
  [ -f "$f" ] || fail "missing file: $f"
done

# Gate 3: 5 new runner entries registered
for entry in test-reverse-salient-agent test-reverse-salient-cascade-emit test-reverse-salient-f0-integration test-reverse-salient-persona test-reverse-salient-telemetry; do
  grep -q "$entry" lib/memory/run-feynman-tests.cjs || fail "runner missing entry: $entry"
done

# Gate 4: anti-pattern guards (Wave 0 source-level)
if grep -F "require.*room-db" lib/agents/reverse-salient-agent.cjs; then fail "anti-pattern: direct room-db require"; fi
if grep -F "brain-client" lib/agents/reverse-salient-agent.cjs; then fail "anti-pattern: brain-client import at Wave 0"; fi

# Gate 5: 0 em-dashes in new artifacts (U+2014 detected via printf-encoded literal to keep this script em-dash-free)
EMDASH=$(printf '\xe2\x80\x94')
for f in lib/agents/reverse-salient-agent.cjs agents/reverse-salient-agent.md cypher/phase89-07-rs-agent-completion.cypher; do
  if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then fail "em-dash present in $f (memory rule feedback_no_emdashes)"; fi
done

echo "OK: 89-07-00 scaffold passes 5 gates"
