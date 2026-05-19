#!/usr/bin/env bash
# Phase 121-04 -- Canon Part 8 adversarial compliance audit.
# Verifies zero LOCAL-to-BRAIN egress surface across ALL telemetry-touching files.
# Per Canon Part 8: "The boundary is not a privacy preference. It is a constitutional
# property of the system." Single-chokepoint enforcement (Canon Part 9 precedent).
#
# 7 gates:
#   1. all telemetry-touching files exist
#   2. zero network surface across ALL listed files (the constitutional invariant)
#   3. every capture-point source imports the unified writer (single-chokepoint)
#   4. emit-time validator is the only Part 8 enforcement layer
#   5. forbidden patterns from validator.cjs are documented in TELEMETRY-SCHEMA.md
#   6. mva-telemetry.cjs is a shim (Plan 121-01 atomic cutover invariant)
#   7. zero em-dashes across all telemetry-touching files (project hard rule)
#
# bash only. No emoji. No em-dashes (per memory rule feedback_no_emdashes).

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Resolve dynamically-located files from the prior SUMMARY files.
AUTO_EXPLORE_FILE=""
RECEIPT_WRITE_FILE=""
if [ -f .planning/phases/121-trajectory-telemetry/121-02-SUMMARY.md ]; then
  AUTO_EXPLORE_FILE=$(grep -oE "lib/agents/auto-explore-agent\.cjs|lib/core/auto-explore/[a-zA-Z0-9_.-]+\.cjs" .planning/phases/121-trajectory-telemetry/121-02-SUMMARY.md | head -1 || true)
fi
if [ -f .planning/phases/121-trajectory-telemetry/121-03-SUMMARY.md ]; then
  RECEIPT_WRITE_FILE=$(grep -oE "lib/core/room-auto-create\.cjs|lib/[a-zA-Z0-9_./-]*receipt[a-zA-Z0-9_./-]*\.cjs" .planning/phases/121-trajectory-telemetry/121-03-SUMMARY.md | head -1 || true)
fi

# SOURCE files (production code, MUST be free of any network surface or forbidden literal).
# Per Plan 121-00 deviation #1: the validator source uses concatenated tokens so
# the literal Brain host substring does not appear in production code.
SOURCE_FILES=(
  lib/core/telemetry/writer.cjs
  lib/core/telemetry/validator.cjs
  lib/core/telemetry/schema.cjs
  lib/core/mva-telemetry.cjs
  scripts/migrate-telemetry-v1.cjs
  lib/hmi/selector-dispatcher.cjs
  lib/memory/pending-tension-store.cjs
  lib/core/breakthrough/scanner.cjs
  scripts/empathy-observation-emit.cjs
  lib/core/room-receipt-emit.cjs
  scripts/telemetry-command-invocation.cjs
)
if [ -n "${AUTO_EXPLORE_FILE}" ] && [ -f "${AUTO_EXPLORE_FILE}" ]; then
  SOURCE_FILES+=("${AUTO_EXPLORE_FILE}")
fi
if [ -n "${RECEIPT_WRITE_FILE}" ] && [ -f "${RECEIPT_WRITE_FILE}" ]; then
  SOURCE_FILES+=("${RECEIPT_WRITE_FILE}")
fi

# TEST files (adversarial fixtures, legitimately contain forbidden literals as inputs to
# the validator's reject path). Scoped Gate 1 only; excluded from network-surface grep.
# Per Plan 121-00 pattern: "test file may contain literal forbidden strings ONLY as the
# input to forbidden-pattern detector assertions; module source files must remain free
# of these literals (verified by Gate 2 which scopes to source modules, not tests)".
TEST_FILES=(
  lib/core/telemetry/writer.test.cjs
  lib/core/telemetry/validator.test.cjs
  lib/core/telemetry/schema.test.cjs
  scripts/migrate-telemetry-v1.test.cjs
)

ALL_FILES=("${SOURCE_FILES[@]}" "${TEST_FILES[@]}")

# Gate 1: all files exist
for f in "${ALL_FILES[@]}"; do
  [ -f "$f" ] || fail "missing required file: $f"
done

# Gate 2: zero network surface across SOURCE files (the constitutional invariant).
# Test files are adversarial fixtures by design and are excluded from this gate.
# Pattern set covers: fetch( call sites, http/https module imports, the Brain MCP host,
# common external APIs, and the most common HTTP client libraries.
FORBIDDEN='fetch\(|require\(['"'"'"]https?\b|require\(['"'"'"]http\b|brain\.mindrian|tavily\.com|api\.openai\.com|api\.anthropic\.com|api\.elevenlabs\.io|XMLHttpRequest|axios|node-fetch|got\.|undici'
if grep -rE "$FORBIDDEN" "${SOURCE_FILES[@]}" >/dev/null 2>&1; then
  echo "ADVERSARIAL HITS:" >&2
  grep -rE "$FORBIDDEN" "${SOURCE_FILES[@]}" >&2
  fail "network surface detected in telemetry source file(s) (Canon Part 8 breach)"
fi

# Gate 3: every capture-point source imports the unified writer (single-chokepoint).
# Accepts both forms (with and without .cjs extension; Node.js require resolution
# is extension-aware so the convention is to write the .cjs explicitly).
CAPTURE_POINTS=(
  lib/hmi/selector-dispatcher.cjs
  lib/memory/pending-tension-store.cjs
  lib/core/breakthrough/scanner.cjs
  scripts/empathy-observation-emit.cjs
  lib/core/room-receipt-emit.cjs
  scripts/telemetry-command-invocation.cjs
)
for f in "${CAPTURE_POINTS[@]}"; do
  # Accept any require() form that names telemetry/writer:
  #   require('./telemetry/writer.cjs')
  #   require('../core/telemetry/writer.cjs')
  #   require('../telemetry/writer.cjs')
  #   require(path.join(REPO, 'lib/core/telemetry/writer.cjs'))
  grep -qE "require\(.*telemetry/writer" "$f" \
    || fail "$f does not import lib/core/telemetry/writer (chokepoint bypass)"
done

# Gate 4: emit-time validator is the only Part 8 enforcement (no per-call validation drift).
grep -qE "validateEventPayload" lib/core/telemetry/writer.cjs \
  || fail "writer.cjs does not call validateEventPayload (Part 8 enforcement missing)"

# Gate 5: forbidden patterns from validator.cjs are documented in TELEMETRY-SCHEMA.md.
for pattern_label in "Cypher" "Email" "Phone" "Brain URL" "Absolute path" "Raw hex" "Free-text prose"; do
  grep -q "$pattern_label" docs/TELEMETRY-SCHEMA.md \
    || fail "TELEMETRY-SCHEMA.md missing forbidden-pattern documentation for: $pattern_label"
done

# Gate 6: mva-telemetry.cjs is a shim (Plan 121-01 atomic cutover invariant).
SHIM_LOC=$(wc -l < lib/core/mva-telemetry.cjs)
if [ "$SHIM_LOC" -gt 60 ]; then
  fail "lib/core/mva-telemetry.cjs is $SHIM_LOC lines (exceeds 60-line shim invariant from Plan 121-01)"
fi

# Gate 7: zero em-dashes across all telemetry-touching files (project hard rule).
HITS=()
for f in "${ALL_FILES[@]}" docs/TELEMETRY-SCHEMA.md; do
  if grep -lP "\x{2014}" "$f" >/dev/null 2>&1; then
    HITS+=("$f")
  fi
done
if [ "${#HITS[@]}" -gt 0 ]; then
  echo "EM-DASH HITS:" >&2
  for h in "${HITS[@]}"; do echo "  $h" >&2; done
  fail "em-dashes found in telemetry source(s) -- use hyphens"
fi

echo "PASS: Canon Part 8 adversarial audit (7 gates green; ${#ALL_FILES[@]} files scanned: ${#SOURCE_FILES[@]} source + ${#TEST_FILES[@]} test)"
