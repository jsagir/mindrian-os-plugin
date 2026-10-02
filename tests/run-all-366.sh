#!/usr/bin/env bash
# Phase 366 (2026-10-01): the Eureka PERSPECTIVE in the research planner, the
# MCP canvas tooling around it, canon handles, the spike, and the retirement of
# the standalone runner. This aggregator is written ONCE (plan 366-01); later
# plans never edit it, so every planned test is named here now and guarded with
# run_if (a not-yet-landed leg reports SKIPPED (missing ...)).
#
# Modeled on tests/run-all-seed103.sh (run / run_if counters). Hyphens only.
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (exit 77 or a
# missing planned file). exit 0 -> FAILED=0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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
  printf '%s
' "$out" | tail -n 8
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

# --- (1) seed103 wave 1 (EPV366-01), carried verbatim from run-all-seed103.sh ---
# SEED-103 legs
run "seed103 claude routing (one home for model ids)" node tests/test-seed103-claude-routing.cjs
run "seed103 eureka perspective end to end" node tests/test-seed103-eureka-perspective.cjs

# Neighbors this seed touches
run "218 what/why classifier (entity-classifier transport pin)" node tests/test-218-what-why-classifier.cjs
run "119-01 scaffold (llm-name-suggester HAIKU_MODEL_ID gate)" bash tests/test-119-01-scaffold.sh
run "232 briefing" node tests/test-232-briefing.cjs
run "candidate producer" node tests/test-candidate-producer.cjs
run "233 derivation default gate" node tests/test-233-derivation-default-gate.cjs
run "233 drain/backfill producer parity" node tests/test-233-drain-backfill-producer-parity.cjs
run "169 brain boundary" node tests/test-169-brain-boundary.cjs
run "363 families" node tests/test-363-families.cjs
run "363 mcp tool (research_run)" node tests/test-363-mcp-tool.cjs
run "363 plan schema" node tests/test-363-plan-schema.cjs
run "270 tool schema budget" node tests/test-270-tool-schema-budget.cjs
run "234 tool description floor" node tests/test-234-tool-description-floor.cjs
run "205 surface fence" node tests/test-205-surface-fence.cjs
run "353 tripwires (no Jev under lib/ or hooks/)" node tests/test-353-tripwires.cjs

# Generators must be current
run "connector registry --check" node scripts/build-connector-registry.cjs --check
run "orchestration projection --check" node scripts/build-orchestration-projection.cjs --check
run "shape declaration --check" node scripts/check-shape-declaration.cjs --check

# --- (2) Phase 366 legs, one run_if per planned test file, wave order --------
run_if "366 fixture helper (planted perspective room)"   tests/test-366-fixture-helper.cjs            node tests/test-366-fixture-helper.cjs
run_if "366 spike substrate prepare"                     tests/test-366-spike-prepare.cjs             node tests/test-366-spike-prepare.cjs
run_if "366 eureka filing"                               tests/test-366-eureka-filing.cjs             node tests/test-366-eureka-filing.cjs
run_if "366 eureka alias"                                tests/test-366-eureka-alias.cjs              node tests/test-366-eureka-alias.cjs
run_if "366 canon handles"                               tests/test-366-canon-handles.cjs             node tests/test-366-canon-handles.cjs
run_if "366 canon snapshot gate"                         tests/test-366-snapshot-gate.cjs             node tests/test-366-snapshot-gate.cjs
run_if "366 suite gate"                                  tests/test-366-suite-gate.cjs                node tests/test-366-suite-gate.cjs
run_if "366 templates"                                   tests/test-366-templates.cjs                 node tests/test-366-templates.cjs
run_if "366 ambient offer"                               tests/test-366-ambient-offer.cjs             node tests/test-366-ambient-offer.cjs
run_if "366 perspective interface"                       tests/test-366-perspective-interface.cjs     node tests/test-366-perspective-interface.cjs
run_if "366 canon at filing"                             tests/test-366-canon-at-filing.cjs           node tests/test-366-canon-at-filing.cjs
run_if "366 canon coverage count"                        tests/test-366-canon-coverage-count.cjs      node tests/test-366-canon-coverage-count.cjs
run_if "366 canon backfill"                              tests/test-366-canon-backfill.cjs            node tests/test-366-canon-backfill.cjs
run_if "366 mcp perspective ops"                         tests/test-366-mcp-perspective-ops.cjs       node tests/test-366-mcp-perspective-ops.cjs
run_if "366 cli perspective"                             tests/test-366-cli-perspective.cjs           node tests/test-366-cli-perspective.cjs
run_if "366 recall reverse salient"                      tests/test-366-recall-rs.cjs                 node tests/test-366-recall-rs.cjs
run_if "366 recall hsi"                                  tests/test-366-recall-hsi.cjs                node tests/test-366-recall-hsi.cjs
run_if "366 recall whitespace"                           tests/test-366-recall-whitespace.cjs         node tests/test-366-recall-whitespace.cjs
run_if "366 recall analogies"                            tests/test-366-recall-analogies.cjs          node tests/test-366-recall-analogies.cjs
run_if "366 recall connections"                          tests/test-366-recall-connections.cjs        node tests/test-366-recall-connections.cjs
run_if "366 theo lateral lane"                           tests/test-366-theo-lateral-lane.cjs         node tests/test-366-theo-lateral-lane.cjs
run_if "366 router redirects"                            tests/test-366-router-redirects.cjs          node tests/test-366-router-redirects.cjs
run_if "366 offline recall"                              tests/test-366-offline-recall.cjs            node tests/test-366-offline-recall.cjs
run_if "366 counter metrics"                             tests/test-366-counter-metrics.cjs           node tests/test-366-counter-metrics.cjs
run_if "366 egress policy"                               tests/test-366-egress-policy.cjs             node tests/test-366-egress-policy.cjs
run_if "366 spike harness"                               tests/test-366-spike-harness.cjs             node tests/test-366-spike-harness.cjs
run_if "366 guard navigator release"                     tests/test-366-guard-navigator-release.cjs   node tests/test-366-guard-navigator-release.cjs
run_if "366 gated term release"                          tests/test-366-gated-term-release.cjs        node tests/test-366-gated-term-release.cjs
run_if "366 mcp release route"                          tests/test-366-mcp-release-route.cjs         node tests/test-366-mcp-release-route.cjs
run_if "366 mcp plan only"                              tests/test-366-mcp-plan-only.cjs             node tests/test-366-mcp-plan-only.cjs
run_if "366 runner retired"                              tests/test-366-runner-retired.cjs            node tests/test-366-runner-retired.cjs
run_if "366 semantic index integrity"                    tests/test-366-semantic-index-integrity.cjs  node tests/test-366-semantic-index-integrity.cjs

# --- (2b) SEED-104 quick fix 261002-0n4 (grant family loop, egress-safe terms, loop guard) ---
run_if "seed104 grant family loop"             tests/test-seed104-grant-family-loop.cjs       node tests/test-seed104-grant-family-loop.cjs
run_if "seed104 room check tokens"            tests/test-seed104-room-check-tokens.cjs       node tests/test-seed104-room-check-tokens.cjs
run_if "pin 363 grants"                        tests/test-363-grants.cjs                      node tests/test-363-grants.cjs
run_if "pin 363 run quick"                     tests/test-363-run-quick.cjs                   node tests/test-363-run-quick.cjs

# --- (3) Pins carried by this phase (guarded so a later retirement never breaks this file) ---
run_if "pin 363 pyramid"                       tests/test-363-pyramid.cjs                     node tests/test-363-pyramid.cjs
run_if "pin 363 structure"                     tests/test-363-structure.cjs                   node tests/test-363-structure.cjs
# Baseline red (run-all-363.1.sh BASELINE_RED, run-all-3551.sh no-regression note):
# leg H finds comparison-to-label code outside direction-convention.cjs in two
# pre-existing files. Any NEW offender (for example a 366 HSI classifier placed
# outside direction-convention.cjs) changes the hit list and turns this FAILED.
run_known_if "pin 355 direction agreement"     tests/test-355-direction-agreement.cjs   "(unresolved hits: lib/core/rs-chain-feeder.cjs, lib/memory/test-rs-discovery-engine.cjs)"   node tests/test-355-direction-agreement.cjs
run_if "pin 355 direction convention"          tests/test-355-direction-convention.cjs        node tests/test-355-direction-convention.cjs
run_if "pin 355 direction readers"             tests/test-355-direction-readers.cjs           node tests/test-355-direction-readers.cjs
run_if "pin 355 floor sweep"                   tests/test-355-floor-sweep.cjs                 node tests/test-355-floor-sweep.cjs
# 366-27: the 355 eureka ranking pin retired with the standalone runner (it byte-pinned the runner-only composite ranking step).
run_if "pin 3551 ambient run"                  tests/test-3551-ambient-run.cjs                node tests/test-3551-ambient-run.cjs
run_if "pin doctor module contract parity"     tests/test-doctor-module-contract-parity.cjs   node tests/test-doctor-module-contract-parity.cjs
run_if "pin 349 docs lockstep"                 tests/test-349-docs-lockstep.cjs               node tests/test-349-docs-lockstep.cjs
run_if "pin 343 theo stamp gate"               tests/test-343-theo-stamp-gate.cjs             node tests/test-343-theo-stamp-gate.cjs

# --- (4) Generator and ledger checks ------------------------------------------
run_if "research shape ledger --check"         scripts/build-research-shape-ledger.cjs        node scripts/build-research-shape-ledger.cjs --check
run_if "skill mirrors --check"                 scripts/build-skill-mirrors.cjs                node scripts/build-skill-mirrors.cjs --check
run_if "floor ledger check"                    scripts/check-floor-ledger.cjs                 node scripts/check-floor-ledger.cjs --check
run_if "registry drift check"                  scripts/check-registry-drift.cjs               node scripts/check-registry-drift.cjs --check

# --- (5) The spike record -------------------------------------------------------
run_if "366 spike record --check" tests/fixtures/366-spike/record.json node scripts/spike-366.cjs --check

# --- (6) Dash fence on this phase's files (hyphens only) ----------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the fence would pass vacuously.
run "no em-dash or en-dash in phase 366 files" bash -c '
  files=$(ls -d lib/core/research-planner/perspectives \
    lib/core/research-planner/canon-release.cjs \
    lib/core/research-planner/filing-stamped.cjs \
    lib/core/research-planner/theo-lane.cjs \
    lib/core/research-planner/egress-policy.cjs \
    lib/core/canon-translations.cjs \
    lib/core/navigation/framework-node.cjs \
    lib/core/doctor/canon-backfill-module.cjs \
    data/egress-policy.json \
    scripts/spike-366*.cjs \
    scripts/release-lib/canon-snapshot-gate.sh \
    scripts/release-lib/suite-gate.sh \
    tests/test-366-*.cjs \
    tests/test-seed104-*.cjs \
    tests/fixtures/seed104 \
    tests/helpers/fixture-366.cjs \
    tests/run-all-366.sh 2>/dev/null)
  [ -z "$files" ] && exit 0
  hits=$(LC_ALL=C grep -rlP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
