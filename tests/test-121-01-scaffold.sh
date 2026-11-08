#!/usr/bin/env bash
# Phase 121-01 Wave-1 scaffold harness. Asserts the 6 invariants of the
# atomic cutover: migration script idempotence + validator pre-write +
# mva-telemetry shim removal (frozen event names) + hooked-rescore-117 read-path repoint +
# legacy mva.jsonl migration still green + zero em-dashes across modified files.
# Mirrors tests/test-121-00-scaffold.sh shape (set -euo pipefail, fail()
# helper, function-wrapped gates, per-gate PASS message). Em-dash-free
# per memory rule feedback_no_emdashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: migrate-telemetry-v1.cjs exists AND idempotence is wired
# (alreadyMerged + sourceFingerprint references).
gate1_migration_idempotent() {
  [ -f "scripts/migrate-telemetry-v1.cjs" ] || fail "Gate 1: scripts/migrate-telemetry-v1.cjs missing"
  local hits
  hits=$(grep -c "alreadyMerged" scripts/migrate-telemetry-v1.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 1: migrate-telemetry-v1.cjs missing alreadyMerged (idempotence not wired)"
  fi
  echo "Gate 1 PASS: migrate-telemetry-v1.cjs exists with idempotence ($hits alreadyMerged hits)"
}

# Gate 2: migration script calls validateEventPayload pre-append (Canon
# Part 8 enforced on historical data too).
gate2_migration_validator_inline() {
  local hits
  hits=$(grep -c "validateEventPayload" scripts/migrate-telemetry-v1.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 2: migrate-telemetry-v1.cjs missing validateEventPayload call (Canon Part 8 gate)"
  fi
  echo "Gate 2 PASS: validateEventPayload wired in migration path ($hits hits)"
}

# Gate 3: the mva-telemetry.cjs shim is GONE (Phase 389 plan 10, owner card D6) and the six
# inherited mva_* event names stay in schema.cjs as frozen history, because
# scripts/migrate-telemetry-v1.cjs still reads a legacy mva.jsonl and validates it against them.
gate3_mva_telemetry_shim() {
  if [ -e lib/core/mva-telemetry.cjs ]; then
    fail "Gate 3: lib/core/mva-telemetry.cjs still exists (retired in Phase 389 plan 10)"
  fi
  local n
  n=$(grep -c "'mva_[a-z_]*'," lib/core/telemetry/schema.cjs || true)
  if [ "$n" -lt 6 ]; then
    fail "Gate 3: schema.cjs lost an inherited mva_* event name ($n of 6 found); the migration reader needs them"
  fi
  grep -qi "frozen history" lib/core/telemetry/schema.cjs || fail "Gate 3: schema.cjs lacks the frozen history note for the mva_* names"
  echo "Gate 3 PASS: shim removed; $n inherited mva_* names stay as frozen history"
}

# Gate 4: hooked-rescore-117.cjs reads unified events-YYYY-WNN.jsonl stream.
gate4_hooked_rescore_repointed() {
  local hits
  hits=$(grep -cE "events-.*W.*\.jsonl" scripts/hooked-rescore-117.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 4: hooked-rescore-117.cjs missing events-YYYY-WNN.jsonl glob"
  fi
  grep -q "Phase 121-01:" scripts/hooked-rescore-117.cjs || fail "Gate 4: hooked-rescore-117.cjs missing 'Phase 121-01:' marker comment"
  echo "Gate 4 PASS: hooked-rescore-117.cjs reads unified stream ($hits events-*.jsonl hits + marker)"
}

# Gate 5: an old mva.jsonl line still migrates (the reader that keeps the six names alive).
gate5_phase_118_still_green() {
  node scripts/migrate-telemetry-v1.test.cjs >/dev/null 2>&1 || fail "Gate 5: scripts/migrate-telemetry-v1.test.cjs failed (old mva.jsonl lines no longer migrate)"
  echo "Gate 5 PASS: legacy mva.jsonl migration still green (the Phase 118 writer and its test were retired in Phase 389 plan 10)"
}

# Gate 6: Zero em-dashes across all 121-01 modified files (printf-encoded
# U+2014 literal to keep THIS script em-dash-free).
gate6_zero_emdashes() {
  local EMDASH
  EMDASH=$(printf '\xe2\x80\x94')
  local files=(
    scripts/migrate-telemetry-v1.cjs
    scripts/migrate-telemetry-v1.test.cjs
    scripts/hooked-rescore-117.cjs
    lib/core/telemetry/schema.cjs
  )
  for f in "${files[@]}"; do
    if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
      fail "Gate 6: em-dash present in $f (memory rule feedback_no_emdashes)"
    fi
  done
  echo "Gate 6 PASS: zero em-dashes across 4 modified files"
}

gate1_migration_idempotent
gate2_migration_validator_inline
gate3_mva_telemetry_shim
gate4_hooked_rescore_repointed
gate5_phase_118_still_green
gate6_zero_emdashes

echo ""
echo "OK: 121-01 scaffold complete (6 gates: migration idempotent + validator inline + mva shim removed + hooked-rescore repoint + legacy migration green + zero em-dashes)"
exit 0
