#!/usr/bin/env bash
# Phase 219 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# opportunity-follow-through cluster (the typed-opportunity writer + eureka
# statement banking from Plan 01, the FTS5 degrade + metadata slice from Plan
# 02, the harvest sensor from Plan 03, the qualification card from Plan 04, and
# the explore chain + research contract from Plan 05). Pure composition +
# governed wiring over the shipped 211-218 substrate (Canon Part 7/11).
#
# The phase gate has TWO legs (the 218 pattern, D-12):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the live ador-ip-test human-verify leg recorded in 219-VERIFICATION.md:
#       fixture-green lied TWICE in 218 (R1) - a passing fixture is NECESSARY,
#       never SUFFICIENT. The live-room checkpoint (>=1 explored Minto
#       opportunity in the bank, traceable to graph evidence) is mandatory
#       before REQ-6/REQ-7 close.
#
# FILE-OWNERSHIP RULE: every phase leg is registered NOW as a run_if file-gated
# entry, so later plans only ADD their test file and never modify this harness.
# A not-yet-landed leg SKIPs cleanly (never RED on absence).
#
# GREP GATES (Canon Part 8/9, the 218 comment-filtered idiom - never a bare
# unfiltered grep): (a) no raw INSERT INTO nodes/edges outside
# lib/core/navigation/ + lib/core/node-insert.cjs across the files this phase
# touches (every write routes through the navigation chokepoint - the
# T-219-01 mitigation); (b) zero network reach in the harvest sensor, the
# opportunity-harvest module, and the entity-extract metadata pass (Part 8:
# LOCAL room.db only, user content never egresses).
#
# EGRESS RULE (Part 8, restated): real-room content NEVER reaches a network
# judge. Every leg runs offline (stub encoder); the live-room acceptance is
# verified by the human spot-check, not by any automated judge.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211/216/218): the offline preload
# flips transformers.js env.allowRemoteModels=false in every spawned leg, so an
# uncached model load fails fast and degrades instead of reaching the network.
# No-op when the eureka dep is absent.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# Comment-filtered grep gate: a match on a CODE line fails; comment lines
# (// and block-comment *) are filtered so doctrine headers naming the
# forbidden pattern never trip the gate. Missing files are skipped (the
# file-ownership rule: later plans' files gate themselves in when they land).
gate_no_raw_insert() {
  local bad=0 f hits
  for f in "$@"; do
    [ -f "$f" ] || continue
    hits="$(grep -nE 'INSERT INTO (nodes|edges)' "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' || true)"
    if [ -n "$hits" ]; then
      echo "raw INSERT INTO nodes/edges in $f:"
      echo "$hits"
      bad=1
    fi
  done
  return $bad
}

gate_zero_network() {
  local bad=0 f hits
  for f in "$@"; do
    [ -f "$f" ] || continue
    hits="$(grep -nE "fetch\(|require\('node:https?'\)|require\(\"node:https?\"\)|https?://" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' || true)"
    if [ -n "$hits" ]; then
      echo "network reach in $f:"
      echo "$hits"
      bad=1
    fi
  done
  return $bad
}

# ---------------------------------------------------------------------------
# (a) Phase legs -- ALL registered now, run_if file-gated (SKIP, never RED, on
#     a partially-landed tree). Wave/plan ownership per 219-VALIDATION.md.
# ---------------------------------------------------------------------------

# Plan 01 (Wave 1): REQ-1 banking -- typed-opportunity writer + bankStatements.
run_if "219-01 REQ-1 banking (writer + hook + no-bypass)" "tests/test-219-banking.cjs" \
  node tests/test-219-banking.cjs

# GAP-1 fix (219-06 live checkpoint RCA): the bounded async critic-resolution
# pass -- a REAL async stub critic proves pending statements resolve + bank,
# unresolvable ones stay honestly pending, and the timeout/deadline bounds hold.
run_if "219 GAP-1 critic resolution (async pass, bounded, honest floor)" "tests/test-219-critic-resolution.cjs" \
  node tests/test-219-critic-resolution.cjs

# Plan 02 (Wave 1): REQ-7 FTS5 capability probe + bi-modal degrade.
run_if "219-02 FTS5 degrade (probe + honest provenance)" "tests/test-219-fts5-degrade.cjs" \
  node tests/test-219-fts5-degrade.cjs

# Plan 02 (Wave 1): REQ-5 metadata thin slice (frontmatter -> node props).
run_if "219-02 metadata slice (deterministic, zero-egress)" "tests/test-219-metadata.cjs" \
  node tests/test-219-metadata.cjs

# Quick 260715-cu8: per-term low-confidence disclosure (framework_terms_low_confidence).
run_if "219 low-confidence disclosure (per-term, quick 260715-cu8)" "tests/test-219-low-confidence-disclosure.cjs" \
  node tests/test-219-low-confidence-disclosure.cjs

# Plan 03 (Wave 2): REQ-2 harvest sensor (SENS rail, Four-Lens, connection gate).
run_if "219-03 harvest sensor (fixture lens labels + suppression)" "tests/test-219-harvest-sensor.cjs" \
  node tests/test-219-harvest-sensor.cjs

# Plan 04 (Wave 2): REQ-3 qualification card (rejection edge, lifecycle advance).
run_if "219-04 qualification (Skip edge + human-only advance)" "tests/test-219-qualify.cjs" \
  node tests/test-219-qualify.cjs

# Plan 05 (Wave 3): D-19 research contract (provider envelope, drift fix).
run_if "219-05 research contract (envelope + no-room-body cache)" "tests/test-219-research-contract.cjs" \
  node tests/test-219-research-contract.cjs

# Plan 05 (Wave 3): REQ-4 explore chain (Minto shape, never auto-fires).
run_if "219-05 explore chain (composition + no-auto-fire)" "tests/test-219-explore-chain.cjs" \
  node tests/test-219-explore-chain.cjs

# ---------------------------------------------------------------------------
# (b) Canon Part 9 grep gate: no raw INSERT INTO nodes/edges outside
#     lib/core/navigation/ + lib/core/node-insert.cjs across every file this
#     phase touches (T-219-01: every write crosses the navigation chokepoint).
# ---------------------------------------------------------------------------
run "no raw node/edge INSERT (comment-filtered)" \
  gate_no_raw_insert \
  lib/core/navigation/typed-opportunity.cjs \
  lib/core/sensors/sensor-opportunity-harvest.cjs \
  lib/core/eureka/opportunity-harvest.cjs \
  lib/core/eureka/qualify-opportunity.cjs \
  lib/core/qualify-opportunity.cjs \
  lib/core/eureka/explore-chain.cjs \
  lib/core/explore-chain.cjs \
  lib/core/eureka/explored-artifact.cjs \
  lib/core/explored-artifact.cjs \
  lib/core/eureka/research-filing.cjs \
  lib/core/research-filing.cjs \
  scripts/eureka-portfolio-report.cjs \
  scripts/entity-extract.cjs

# ---------------------------------------------------------------------------
# (c) Canon Part 8 grep gate: zero network reach in the sensor, the harvest
#     module, and the extractor (LOCAL room.db only; harvest + explored run
#     LOCAL-first; the deep_research leg rides its own frozen, audited reach).
# ---------------------------------------------------------------------------
run "zero network (comment-filtered)" \
  gate_zero_network \
  lib/core/sensors/sensor-opportunity-harvest.cjs \
  lib/core/eureka/opportunity-harvest.cjs \
  scripts/entity-extract.cjs

# ---------------------------------------------------------------------------
# (d) No command surface leaked (Part 11 CIRS: every invocable surface born
#     WIRED or EXCLUDED; the connector registry must stay green as proof).
# ---------------------------------------------------------------------------
run "no command surface leaked" \
  node scripts/build-connector-registry.cjs --check

# ---------------------------------------------------------------------------
# (e) 218 substrate no-regression: this phase builds on 218's entity layer
#     (typed entities feed the banking evidence edges + harvest Connection
#     factor). Guarded so a partial tree SKIPs cleanly.
# ---------------------------------------------------------------------------
run_if "218 substrate no-regression" "tests/run-all-218.sh" \
  bash tests/run-all-218.sh

echo "======================================"
echo "Phase 219: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
