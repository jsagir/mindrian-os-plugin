#!/usr/bin/env bash
# Phase 364 (2026-10-02): the Scientific Roadmapping command /mos:scientific-roadmap.
# This aggregator is written ONCE (plan 364-01); later plans never edit it, so
# every planned 364 test is named here now and guarded with run_if (a
# not-yet-landed leg reports SKIPPED (missing ...), never FAILED).
# Exception: gap plan 364-14 (navigator ruling 2026-10-03, compose with Phases 355 and 355.1) adds the one leg "364 compose 355".
#
# Modeled on tests/run-all-366.sh (run / run_if / run_known_if counters).
# Hyphens only: no em-dash, no en-dash anywhere in this file.
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (exit 77, a
# missing planned file, or the opt-in smoke without MOS_364_LIVE=1), KNOWN
# (a pre-existing red whose literal signature matched). exit 0 -> FAILED=0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Sandbox every leg: fresh HOME and MINDRIAN_ROOMS_HOME, no ambient room or
# session binding. The opt-in live smoke is the only leg that sees REAL_HOME.
REAL_HOME="$HOME"
SANDBOX_HOME="$(mktemp -d)"
SANDBOX_ROOMS="$(mktemp -d)"
trap 'rm -rf "$SANDBOX_HOME" "$SANDBOX_ROOMS"' EXIT
export HOME="$SANDBOX_HOME"
export USERPROFILE="$SANDBOX_HOME"
export MINDRIAN_ROOMS_HOME="$SANDBOX_ROOMS"
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
# A pre-existing red this phase does not own (the run-all-363.sh run_known
# idiom, guarded like run_if). Exit 0 -> PASSED (known red healed). Non-zero
# exit whose combined output carries the literal signature -> KNOWN. Any other
# non-zero exit -> FAILED (a new failure mode, investigate).
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

# run_optin <label> <guard> <cmd...>
# The live smoke: runs only when MOS_364_LIVE=1 and the guard file exists. It
# gets the REAL HOME (the Brain token lives there); MINDRIAN_ROOMS_HOME stays
# sandboxed. Otherwise SKIPPED (opt-in).
run_optin() {
  local label="$1"; local guard="$2"; shift 2
  if [ "${MOS_364_LIVE:-}" = "1" ] && [ -f "$guard" ]; then
    run "$label" env HOME="$REAL_HOME" USERPROFILE="$REAL_HOME" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (opt-in, MOS_364_LIVE unset)"
    SKIP=$((SKIP+1)); echo ""
  fi
}

# --- (1) Phase 364 legs, one run_if per planned test file, wave order --------
run_if "364 canon snapshot"            tests/test-364-canon-snapshot.cjs        node tests/test-364-canon-snapshot.cjs
run_if "364 refusal not_scored"        tests/test-364-refusal-not-scored.cjs    node tests/test-364-refusal-not-scored.cjs
run_if "364 sr steps"                  tests/test-364-sr-steps.cjs              node tests/test-364-sr-steps.cjs
run_if "364 sr entry"                  tests/test-364-sr-entry.cjs              node tests/test-364-sr-entry.cjs
run_if "364 sr door"                   tests/test-364-sr-door.cjs               node tests/test-364-sr-door.cjs
run_if "364 compose 355"                tests/test-364-compose-355.cjs           node tests/test-364-compose-355.cjs
run_if "364 filing"                    tests/test-364-filing.cjs                node tests/test-364-filing.cjs
run_if "364 command contract"          tests/test-364-command-contract.cjs      node tests/test-364-command-contract.cjs
run_if "364 registry gates"            tests/test-364-registry-gates.cjs        node tests/test-364-registry-gates.cjs
run_if "364 entry points"              tests/test-364-entry-points.cjs          node tests/test-364-entry-points.cjs
run_if "364 mcp"                       tests/test-364-mcp.cjs                   node tests/test-364-mcp.cjs
run_if "364 refusal e2e"               tests/test-364-refusal-e2e.cjs           node tests/test-364-refusal-e2e.cjs
run_if "364 part8"                     tests/test-364-part8.cjs                 node tests/test-364-part8.cjs
run_if "364 theo handoff"              tests/test-364-theo-handoff.cjs          node tests/test-364-theo-handoff.cjs

# --- (2) Opt-in live smoke (MOS_364_LIVE=1) ----------------------------------
run_optin "364 live smoke"             tests/test-364-live-smoke.cjs            node tests/test-364-live-smoke.cjs

# --- (3) Regression legs (all exit 0 at the plan base, measured 2026-10-02) ---
run "366 snapshot gate"                node tests/test-366-snapshot-gate.cjs
run "3551 part8 egress"                node tests/test-3551-part8-egress.cjs
run "245 egress contentless"           node tests/test-245-egress-contentless.cjs
run "354 egress typed question"        node tests/test-354-egress-typed-question.cjs
run "discover part8"                   node tests/test-discover-part8.cjs
run "355 stamp truth"                  node tests/test-355-stamp-truth.cjs
run "355 framework names"              node tests/test-355-framework-names.cjs
run "250 refusal shapes"               node tests/test-250-refusal-shapes.cjs
run "205 surface fence"                node tests/test-205-surface-fence.cjs
run "366 router redirects"             node tests/test-366-router-redirects.cjs
run "366 eureka alias"                 node tests/test-366-eureka-alias.cjs
run "eureka mcp tools"                 node tests/test-eureka-mcp-tools.cjs
run "270 tool schema budget"           node tests/test-270-tool-schema-budget.cjs
run "363 pyramid"                      node tests/test-363-pyramid.cjs
run "363 perspective"                  node tests/test-363-perspective.cjs
run "366 perspective interface"        node tests/test-366-perspective-interface.cjs
run "366 templates"                    node tests/test-366-templates.cjs
run "264 roadmap type chains drift"    node tests/test-264-roadmap-type-chains-drift.cjs
run "dispatch framework map drift"     node tests/test-dispatch-framework-map-drift.cjs
run "push frameworks resolvable"       node tests/test-push-frameworks-resolvable.cjs
run "361 theo structure"               node tests/test-361-theo-structure.cjs
run "363 filing"                       node tests/test-363-filing.cjs
run "363 plan schema"                  node tests/test-363-plan-schema.cjs

# The twelve tests that read commands/ignite.md (364-08 adds one offer line to it)
run "204 ignite wiring grep"           node tests/test-204-ignite-wiring-grep.cjs
run "204 ignite branch gate"           node tests/test-204-ignite-branch-gate.cjs
run "b1 reconcile canonical"           node tests/test-b1-reconcile-canonical.cjs
run "b1 four door contract"            node tests/test-b1-four-door-contract.cjs
run "chain executor part8 leak"        node tests/test-chain-executor-part8-leak.cjs
run "cv multiselect and engine1"       node tests/test-cv-multiselect-and-engine1.cjs
run "267-2 ignite persona coverage"    node tests/test-267-2-ignite-persona-coverage.cjs
run "267-2 cr-02 ignite birth coord"   node tests/test-267-2-cr-02-ignite-birth-coordination.cjs
run "354 extract shallow contract"     node tests/test-354-extract-shallow-contract.cjs
run "hypothesis family and claim"      node tests/test-hypothesis-family-and-claim.cjs
run "ignite on runchain"               node tests/test-ignite-on-runchain.cjs
run "bch-17 ignite persona"            node tests/test-bch-17-ignite-persona.cjs

# --- (4) Generator gates -----------------------------------------------------
run "framework names --check"          node scripts/refresh-framework-names.cjs --check
run "command registry --check"         node scripts/build-command-registry.cjs --check
run "connector registry --check"       node scripts/build-connector-registry.cjs --check
run "harness manifest --check"         node scripts/build-harness-manifest.cjs --check
run "orchestration projection --check" node scripts/build-orchestration-projection.cjs --check
run "render coverage --check"          node scripts/build-render-coverage.cjs --check
run "render coverage check"            node scripts/check-render-coverage.cjs
run "skill mirrors --check"            node scripts/build-skill-mirrors.cjs --check
run "help coverage check"              node scripts/check-help-coverage.cjs
run "layer declaration check"          node scripts/check-layer-declaration.cjs

# --- (5) Known pre-existing reds (not owned by Phase 364) --------------------
run_known_if "known red: framework command ledger" scripts/build-framework-command-ledger.cjs "plugin_version drift" node scripts/build-framework-command-ledger.cjs --check
run_known_if "known red: section command ledger"   scripts/build-section-command-ledger.cjs   "plugin_version drift" node scripts/build-section-command-ledger.cjs --check
run_known_if "known red: connector part8 boundary" tests/test-connector-part8-boundary.cjs     'connector mcp:artifact_file carries off-schema field "layer"' node tests/test-connector-part8-boundary.cjs

# --- (6) CIRS declaration over every 364 plan --------------------------------
run "364 CIRS declaration (all plans)" bash -c '
  files=$(ls .planning/phases/364-*/364-*-PLAN.md 2>/dev/null)
  [ -z "$files" ] && exit 0
  node scripts/check-cirs-declaration.cjs --check $files'

# --- (7) Dash fence on this phase's files (hyphens only) ---------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the fence would pass vacuously.
run "no em-dash or en-dash in phase 364 files" bash -c '
  files=$(ls -d lib/core/research-planner/sr-*.cjs \
    scripts/scientific-roadmap.cjs \
    commands/scientific-roadmap.md \
    docs/*-PHASE-364-THEO-NOTIFY.md \
    tests/test-364-*.cjs \
    tests/helpers/*-364.cjs \
    tests/fixtures/364-* \
    tests/run-all-364.sh 2>/dev/null)
  [ -z "$files" ] && exit 0
  hits=$(LC_ALL=C grep -rlP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
