#!/usr/bin/env bash
# Phase 314 (2026-10-28): SENS-13 broadened to portfolio movement and the
# /mos:eureka-portfolio command. This aggregator is the phase gate. It runs
# every 314 test, the regression suites that guard what this phase touched,
# the governance gates, a CIRS declaration check over the 314 plans and a dash
# fence over the files this phase created.
#
# Modeled on tests/run-all-364.sh (run / run_if / run_known_if counters).
# Hyphens only: no em-dash, no en-dash anywhere in this file.
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (exit 77 or a
# missing guard file), KNOWN (a red that was already red before this phase,
# matched by its literal signature). exit 0 -> FAILED=0.
#
# RULE: a new red never goes into run_known_if. Each known leg quotes the
# signature it showed in the plan 314-08 baseline (2026-10-28).
#
# ZERO network: every leg runs with the offline preload (as run-all-213.sh) and
# a fresh HOME and MINDRIAN_ROOMS_HOME. No paid command, no claude -p.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

SANDBOX_HOME="$(mktemp -d)"
SANDBOX_ROOMS="$(mktemp -d)"
trap 'rm -rf "$SANDBOX_HOME" "$SANDBOX_ROOMS"' EXIT
export HOME="$SANDBOX_HOME"
export USERPROFILE="$SANDBOX_HOME"
export MINDRIAN_ROOMS_HOME="$SANDBOX_ROOMS"
export UV_OFFLINE=1
unset CLAUDE_ACTIVE_ROOM CLAUDE_CODE_SESSION_ID MINDRIAN_MCP_FIRST

PASS=0; FAIL=0; SKIP=0; KNOWN=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; fi
}

# run_known_if <label> <guard> <signature> <cmd...>
# Exit 0 -> PASSED (known red healed). Non-zero exit whose combined output
# carries the literal signature -> KNOWN. Any other non-zero exit -> FAILED.
run_known_if() {
  local label="$1"; local guard="$2"; local signature="$3"; shift 3
  echo "--- $label ---"
  if [ ! -f "$guard" ]; then echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; return; fi
  local out
  out="$("$@" 2>&1)"
  local status=$?
  printf '%s\n' "$out" | tail -n 8
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed)"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# --- (1) Phase 314 legs, by plan -------------------------------------------
run_if "314-01 snapshot"                tests/test-314-snapshot.cjs          node tests/test-314-snapshot.cjs
run_if "314-01 movement"                tests/test-314-movement.cjs          node tests/test-314-movement.cjs
run_if "314-01 part8 envelope"          tests/test-314-part8-envelope.cjs    node tests/test-314-part8-envelope.cjs
run_if "314-02 run"                     tests/test-314-run.cjs               node tests/test-314-run.cjs
run_if "314-03 sensor shape B"          tests/test-314-sensor-shape-b.cjs    node tests/test-314-sensor-shape-b.cjs
run_if "314-03 offer"                   tests/test-314-offer.cjs             node tests/test-314-offer.cjs
run_if "314-03 label lockstep"          tests/test-314-label-lockstep.cjs    node tests/test-314-label-lockstep.cjs
run_if "314-04 cli"                     tests/test-314-cli.cjs               node tests/test-314-cli.cjs
run_if "314-04 e2e"                     tests/test-314-e2e.cjs               node tests/test-314-e2e.cjs
run_if "314-05 command"                 tests/test-314-command.cjs           node tests/test-314-command.cjs
run_if "314-06 mcp"                     tests/test-314-mcp.cjs               node tests/test-314-mcp.cjs
run_if "314-07 calibrate"               tests/test-314-calibrate.cjs         node tests/test-314-calibrate.cjs
run_if "314-07 calibration record"      tests/test-314-calibration-record.cjs node tests/test-314-calibration-record.cjs

# --- (2) Regression guards (what this phase touched) -------------------------
run_if "213 sensor eureka"              tests/test-213-sensor-eureka.cjs     node tests/test-213-sensor-eureka.cjs
run_if "213 reach wired"                tests/test-213-reach-wired.cjs       node tests/test-213-reach-wired.cjs
run_if "213 no force"                   tests/test-213-no-force.cjs          node tests/test-213-no-force.cjs
run_if "213 eureka offer"               tests/test-213-eureka-offer.cjs      node tests/test-213-eureka-offer.cjs
run_if "213 part8 boundary"             tests/test-213-part8-boundary.cjs    node tests/test-213-part8-boundary.cjs
run_if "sensors part8 sweep"            tests/test-sensors-part8-sweep.cjs   node tests/test-sensors-part8-sweep.cjs
run_if "sensors routing fence"          tests/test-sensors-routing-fence.cjs node tests/test-sensors-routing-fence.cjs
run_if "dial label bank drift"          tests/test-dial-label-bank-drift.cjs node tests/test-dial-label-bank-drift.cjs
run_if "366 runner retired"             tests/test-366-runner-retired.cjs    node tests/test-366-runner-retired.cjs
run_if "205 surface fence"              tests/test-205-surface-fence.cjs     node tests/test-205-surface-fence.cjs
run_if "366 eureka alias"               tests/test-366-eureka-alias.cjs      node tests/test-366-eureka-alias.cjs
run_if "366 router redirects"           tests/test-366-router-redirects.cjs  node tests/test-366-router-redirects.cjs
run_if "eureka mcp tools"               tests/test-eureka-mcp-tools.cjs      node tests/test-eureka-mcp-tools.cjs
run_if "270 tool schema budget"         tests/test-270-tool-schema-budget.cjs node tests/test-270-tool-schema-budget.cjs
run_if "215 ahp weights"                tests/test-215-ahp-weights.cjs       node tests/test-215-ahp-weights.cjs
run_if "215 score"                      tests/test-215-score.cjs             node tests/test-215-score.cjs
run_if "215 tail"                       tests/test-215-tail.cjs              node tests/test-215-tail.cjs
run_if "215 opp statement"              tests/test-215-opp-statement.cjs     node tests/test-215-opp-statement.cjs

# --- (3) Governance gates ----------------------------------------------------
run "connector registry --check"        node scripts/build-connector-registry.cjs --check
run "command registry --check"          node scripts/build-command-registry.cjs --check
run "harness manifest --check"          node scripts/build-harness-manifest.cjs --check
run "orchestration projection --check"  node scripts/build-orchestration-projection.cjs --check
run "render coverage --check"           node scripts/build-render-coverage.cjs --check
run "render coverage check"             node scripts/check-render-coverage.cjs
run "skill mirrors --check"             node scripts/build-skill-mirrors.cjs --check
run "help coverage check"               node scripts/check-help-coverage.cjs
run "layer declaration check"           node scripts/check-layer-declaration.cjs

# No shape-declaration warning may name the new command (advisory lint, so the
# gate reads the warning lines and fails on a hit).
run "shape declaration names no eureka-portfolio" bash -c '
  out=$(node scripts/check-shape-declaration.cjs --check 2>&1)
  hits=$(printf "%s\n" "$out" | grep -i "eureka-portfolio" || true)
  if [ -n "$hits" ]; then echo "shape declaration warns about eureka-portfolio:"; echo "$hits"; exit 1; fi
  exit 0'

# --- (4) Known reds that were red before this phase (not owned by 314) -------
# Signatures are the literal text each leg printed in the plan 314-08 baseline.
run_known_if "known red: connector part8 boundary" tests/test-connector-part8-boundary.cjs 'connector mcp:artifact_file carries off-schema field "layer"' node tests/test-connector-part8-boundary.cjs
# Check (b) fails on 25 eureka_* / rs_* tool "membership" extras. The output is
# byte-identical at the phase base 7699ebdb4 and at HEAD (compared 2026-10-28),
# so no 314 plan caused it.
run_known_if "known red: 267 mcpv2 zod4 contract" tests/test-267-mcpv2-zod4-contract.cjs "observed zod-4 diff set equals pinned accepted set" node tests/test-267-mcpv2-zod4-contract.cjs
run_known_if "known red: shape declaration strict" scripts/check-shape-declaration.cjs "strict mode: exiting 1" node scripts/check-shape-declaration.cjs --check --strict

# --- (5) CIRS declaration over every 314 plan --------------------------------
run "314 CIRS declaration (all plans)" bash -c '
  files=$(ls .planning/phases/314-*/314-*-PLAN.md 2>/dev/null)
  [ -z "$files" ] && exit 0
  node scripts/check-cirs-declaration.cjs --check $files'

# --- (6) Dash fence on this phase files (hyphens only) -----------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the fence would pass vacuously.
run "no em-dash or en-dash in phase 314 files" bash -c '
  files=$(ls -d lib/core/eureka/portfolio-run.cjs \
    lib/core/eureka/portfolio-snapshot.cjs \
    lib/core/eureka/portfolio-movement.cjs \
    lib/core/eureka/portfolio-offer.cjs \
    scripts/eureka-portfolio.cjs \
    scripts/eureka-portfolio-calibrate.cjs \
    commands/eureka-portfolio.md \
    skills/eureka-portfolio/SKILL.md \
    data/eureka-portfolio-thresholds.json \
    tests/test-314-*.cjs \
    tests/fixtures/314 \
    tests/run-all-314.sh 2>/dev/null)
  [ -z "$files" ] && exit 0
  hits=$(LC_ALL=C grep -rlP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
