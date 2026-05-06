#!/usr/bin/env bash
# Phase 95.2-01 -- integration test for scripts/preflight-doctor.cjs.
# Spawns the preflight against a hermetic ~/.claude/plugins layout via MINDRIAN_PLUGIN_HOME.
# Asserts envelope output for each scenario.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PREFLIGHT="$REPO/scripts/preflight-doctor.cjs"
DOCTOR="$REPO/scripts/doctor.cjs"
PASSED=0
FAILED=0

# ---------- M2 cross-wave precondition gate ----------
# If 95.2-00 hasn't landed performRecoveryAtomic in scripts/doctor.cjs yet, the integration
# tests would race against the OLD doctor.cjs (no install.recoverable, no missing-state drift).
# Self-skip with exit 0 to keep the wave-0 build green; tests will exercise once 00 lands.
if ! grep -q "performRecoveryAtomic" "$DOCTOR" 2>/dev/null; then
  echo "SKIP: 95.2-00 hasn't landed performRecoveryAtomic in scripts/doctor.cjs; integration tests deferred to Wave 1 boundary"
  exit 0
fi

pass() { PASSED=$((PASSED+1)); echo "  ok $1"; }
fail() { FAILED=$((FAILED+1)); echo "  FAIL $1"; echo "    $2"; }

make_scratch() {
  local sfx="$1"
  mktemp -d "/tmp/mos-preflight-${sfx}-XXXXXX"
}

write_plugin_json() {
  local dir="$1"
  local ver="$2"
  mkdir -p "$dir/.claude-plugin"
  printf '{"name":"mos","version":"%s"}\n' "$ver" > "$dir/.claude-plugin/plugin.json"
}

# Scenario 1: healthy install + healthy cache (versions match) -> empty envelope.
s1_healthy() {
  local SCRATCH; SCRATCH=$(make_scratch s1)
  write_plugin_json "$SCRATCH/mindrian-os" "1.11.0"
  write_plugin_json "$SCRATCH/cache/mindrian-marketplace/mos/1.11.0" "1.11.0"
  local OUT; OUT=$(MINDRIAN_PLUGIN_HOME="$SCRATCH" NO_COLOR=1 node "$PREFLIGHT" </dev/null 2>/dev/null)
  rm -rf "$SCRATCH"
  if echo "$OUT" | grep -q '"continue":true' && ! echo "$OUT" | grep -q 'systemMessage'; then
    pass "S1: healthy -> envelope without systemMessage"
  else
    fail "S1: healthy -> envelope without systemMessage" "got: $OUT"
  fi
}

# Scenario 2: missing install -> envelope contains systemMessage with "missing".
s2_missing() {
  local SCRATCH; SCRATCH=$(make_scratch s2)
  # No install dir; cache only.
  write_plugin_json "$SCRATCH/cache/mindrian-marketplace/mos/1.11.0" "1.11.0"
  local OUT; OUT=$(MINDRIAN_PLUGIN_HOME="$SCRATCH" NO_COLOR=1 node "$PREFLIGHT" </dev/null 2>/dev/null)
  rm -rf "$SCRATCH"
  if echo "$OUT" | grep -q 'MindrianOS install dir missing'; then
    pass "S2: missing -> systemMessage says 'missing'"
  else
    fail "S2: missing -> systemMessage says 'missing'" "got: $OUT"
  fi
}

# Scenario 3: drifted install -> systemMessage contains "drifted".
s3_drifted() {
  local SCRATCH; SCRATCH=$(make_scratch s3)
  write_plugin_json "$SCRATCH/mindrian-os" "1.10.0"
  write_plugin_json "$SCRATCH/cache/mindrian-marketplace/mos/1.11.0" "1.11.0"
  local OUT; OUT=$(MINDRIAN_PLUGIN_HOME="$SCRATCH" NO_COLOR=1 node "$PREFLIGHT" </dev/null 2>/dev/null)
  rm -rf "$SCRATCH"
  if echo "$OUT" | grep -q 'MindrianOS install dir drifted'; then
    pass "S3: drifted -> systemMessage says 'drifted'"
  else
    fail "S3: drifted -> systemMessage says 'drifted'" "got: $OUT"
  fi
}

# Scenario 4: cache empty -> doctor exits 3, preflight emits empty envelope (graceful no-op).
s4_no_cache() {
  local SCRATCH; SCRATCH=$(make_scratch s4)
  write_plugin_json "$SCRATCH/mindrian-os" "1.10.0"
  mkdir -p "$SCRATCH/cache/mindrian-marketplace/mos"  # no version dirs
  local OUT; OUT=$(MINDRIAN_PLUGIN_HOME="$SCRATCH" NO_COLOR=1 node "$PREFLIGHT" </dev/null 2>/dev/null)
  rm -rf "$SCRATCH"
  if echo "$OUT" | grep -q '"continue":true' && ! echo "$OUT" | grep -q 'systemMessage'; then
    pass "S4: no cache -> graceful empty envelope"
  else
    fail "S4: no cache -> graceful empty envelope" "got: $OUT"
  fi
}

# Scenario 5: timeout / overall budget < 2000ms.
s5_budget() {
  local SCRATCH; SCRATCH=$(make_scratch s5)
  write_plugin_json "$SCRATCH/mindrian-os" "1.11.0"
  write_plugin_json "$SCRATCH/cache/mindrian-marketplace/mos/1.11.0" "1.11.0"
  local START; START=$(date +%s%3N)
  MINDRIAN_PLUGIN_HOME="$SCRATCH" NO_COLOR=1 node "$PREFLIGHT" </dev/null >/dev/null 2>/dev/null
  local END; END=$(date +%s%3N)
  local DELTA=$((END - START))
  rm -rf "$SCRATCH"
  if [ "$DELTA" -lt 2000 ]; then
    pass "S5: budget < 2000ms (was ${DELTA}ms)"
  else
    fail "S5: budget < 2000ms" "delta=${DELTA}ms"
  fi
}

s1_healthy
s2_missing
s3_drifted
s4_no_cache
s5_budget

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "ok $PASSED/$((PASSED+FAILED)) preflight integration scenarios passed"
  exit 0
else
  echo "FAIL $PASSED/$((PASSED+FAILED)) preflight integration scenarios passed"
  exit 1
fi
