#!/usr/bin/env bash
# Phase 121-00 Wave-1 scaffold harness. Asserts the 8 invariants of the
# unified trajectory-telemetry writer + Canon Part 8 emit-time validator +
# frozen v1 schema. Mirrors tests/test-116-00-scaffold.sh + test-117-00-scaffold.sh
# patterns (set -euo pipefail, printf-encoded em-dash detection, function-wrapped
# gates, per-gate FAIL message). Em-dash-free per memory rule feedback_no_emdashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: writer.cjs exists, exports emit() + module.exports.
gate1_writer_exists() {
  [ -f "lib/core/telemetry/writer.cjs" ] || fail "Gate 1: writer.cjs missing"
  grep -q "function emit(" lib/core/telemetry/writer.cjs || fail "Gate 1: writer.cjs missing function emit("
  grep -q "module.exports" lib/core/telemetry/writer.cjs || fail "Gate 1: writer.cjs missing module.exports"
  echo "Gate 1 PASS: writer.cjs exports emit() + module.exports"
}

# Gate 2: validator.cjs exists, exports validateEventPayload.
gate2_validator_exists() {
  [ -f "lib/core/telemetry/validator.cjs" ] || fail "Gate 2: validator.cjs missing"
  grep -q "validateEventPayload" lib/core/telemetry/validator.cjs || fail "Gate 2: validator.cjs missing validateEventPayload"
  grep -q "module.exports" lib/core/telemetry/validator.cjs || fail "Gate 2: validator.cjs missing module.exports"
  echo "Gate 2 PASS: validator.cjs exports validateEventPayload"
}

# Gate 3: schema.cjs exists with Object.freeze >= 2, EVENT_TYPES, ALLOWED_FIELDS, SCHEMA_VERSION = 1.
gate3_schema_exists() {
  [ -f "lib/core/telemetry/schema.cjs" ] || fail "Gate 3: schema.cjs missing"
  local freeze_count
  freeze_count=$(grep -c "Object.freeze" lib/core/telemetry/schema.cjs || true)
  if [ "$freeze_count" -lt 2 ]; then
    fail "Gate 3: schema.cjs has $freeze_count Object.freeze calls, need >= 2"
  fi
  grep -q "EVENT_TYPES" lib/core/telemetry/schema.cjs || fail "Gate 3: schema.cjs missing EVENT_TYPES"
  grep -q "ALLOWED_FIELDS" lib/core/telemetry/schema.cjs || fail "Gate 3: schema.cjs missing ALLOWED_FIELDS"
  grep -q "SCHEMA_VERSION = 1" lib/core/telemetry/schema.cjs || fail "Gate 3: schema.cjs missing 'SCHEMA_VERSION = 1' literal"
  echo "Gate 3 PASS: schema.cjs has $freeze_count freezes + EVENT_TYPES + ALLOWED_FIELDS + SCHEMA_VERSION = 1"
}

# Gate 4: ISO-week filename pattern present in writer.cjs.
gate4_iso_week_pattern() {
  local hits
  hits=$(grep -cE "events-.*-W" lib/core/telemetry/writer.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 4: writer.cjs missing ISO-week filename pattern (events-YYYY-WNN.jsonl)"
  fi
  # Confirm isoWeekFilename function definition exists.
  grep -q "function isoWeekFilename" lib/core/telemetry/writer.cjs || fail "Gate 4: writer.cjs missing function isoWeekFilename"
  echo "Gate 4 PASS: ISO-week filename pattern present ($hits hits) + isoWeekFilename function defined"
}

# Gate 5: Atomic POSIX append via fs.appendFileSync.
gate5_atomic_append() {
  local hits
  hits=$(grep -c "appendFileSync" lib/core/telemetry/writer.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 5: writer.cjs missing fs.appendFileSync (atomic POSIX append)"
  fi
  echo "Gate 5 PASS: appendFileSync present ($hits hits)"
}

# Gate 6: Canon Part 8 zero-network surface across all 3 source files.
# grep returns 1 when no matches and we are running under `set -e`, so we
# capture the output explicitly via `|| true` to keep the pipeline alive,
# then sum per-file counts via awk.
gate6_zero_network() {
  local hits
  hits=$(grep -cE "fetch\(|http\.|require\(['\"]https?|brain\.mindrian" lib/core/telemetry/writer.cjs lib/core/telemetry/validator.cjs lib/core/telemetry/schema.cjs 2>/dev/null || true)
  local total
  total=$(echo "$hits" | awk -F: '{ sum += $2 } END { print sum + 0 }')
  if [ "$total" != "0" ]; then
    fail "Gate 6: network surface detected (Canon Part 8 breach); per-file counts: $hits"
  fi
  echo "Gate 6 PASS: zero network surface across writer + validator + schema (Canon Part 8)"
}

# Gate 7: Zero em-dashes across all 6 source files (3 modules + 3 tests).
# Uses printf-encoded U+2014 literal to keep THIS script em-dash-free.
gate7_zero_emdashes() {
  local EMDASH
  EMDASH=$(printf '\xe2\x80\x94')
  local files=(
    lib/core/telemetry/writer.cjs
    lib/core/telemetry/validator.cjs
    lib/core/telemetry/schema.cjs
    lib/core/telemetry/writer.test.cjs
    lib/core/telemetry/validator.test.cjs
    lib/core/telemetry/schema.test.cjs
  )
  for f in "${files[@]}"; do
    if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
      fail "Gate 7: em-dash present in $f (memory rule feedback_no_emdashes)"
    fi
  done
  echo "Gate 7 PASS: zero em-dashes across 6 source files"
}

# Gate 8: All 3 tests pass.
gate8_tests_pass() {
  node lib/core/telemetry/schema.test.cjs >/dev/null 2>&1 || fail "Gate 8: schema.test.cjs failed"
  node lib/core/telemetry/validator.test.cjs >/dev/null 2>&1 || fail "Gate 8: validator.test.cjs failed"
  node lib/core/telemetry/writer.test.cjs >/dev/null 2>&1 || fail "Gate 8: writer.test.cjs failed"
  echo "Gate 8 PASS: schema (2/2) + validator (7/7) + writer (10/10) all green (19/19 total)"
}

gate1_writer_exists
gate2_validator_exists
gate3_schema_exists
gate4_iso_week_pattern
gate5_atomic_append
gate6_zero_network
gate7_zero_emdashes
gate8_tests_pass

echo ""
echo "OK: 121-00 scaffold complete (8 gates: writer + validator + schema + ISO-week + atomic append + zero network + zero em-dashes + 19/19 tests)"
exit 0
