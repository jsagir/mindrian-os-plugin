#!/usr/bin/env bash
# Phase 289 (2026-10-03): written ONCE by plan 289-01; later plans never edit it, so every planned test is named here now and guarded with run_if. Hyphens only.
#
# SEED-020 Shape F card as the universal chooser plus the SEED-104 gate defects:
# the capability ladder, the ledger consume order, the recommended option id,
# the elicitation default, and the bare-text menu fence.
#
# Modeled on tests/run-all-366.sh (run / run_if / run_known_if counters).
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (exit 77 or a
# missing planned file), KNOWN (a recorded pre-existing red). Exit 77 is an ENV
# GAP and is NEVER counted as PASSED. exit 0 only when FAILED=0.

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
# A pre-existing red this phase does not own. Exit 0 -> PASSED (known red
# healed). Exit 77 -> SKIPPED. Non-zero exit whose combined output carries the
# literal signature -> KNOWN (not a pass). Any other non-zero exit -> FAILED.
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

# --- (1) unit and static (Phase 289 tests) ------------------------------------
run_if "289 capability ruling (CARD289-01, CARD289-06)" tests/test-289-capability-ruling.cjs node tests/test-289-capability-ruling.cjs
run_if "289 ledger consume after checks (LEDGER289)" tests/test-289-ledger-consume-after-checks.cjs node tests/test-289-ledger-consume-after-checks.cjs
run_if "289 contract recommended (unit, research)" tests/test-289-contract-recommended.cjs node tests/test-289-contract-recommended.cjs --arm unit --arm research
run_if "289 elicit default (unit)" tests/test-289-elicit-default.cjs node tests/test-289-elicit-default.cjs --arm unit
# Review fixes (289-REVIEW.md iteration 1). One plain leg per fixed finding, added with its fix.
run_if "289 review fixes: CR-01 verdict agrees with chosen" tests/test-289-review-fixes.cjs node tests/test-289-review-fixes.cjs --arm cr01
run_if "289 menu fence (MENU289-03)" tests/test-289-menu-fence.cjs node tests/test-289-menu-fence.cjs

# --- (2) flipped and re-pinned existing tests ---------------------------------
run_if "flipped: 238 session-scoped ledger" tests/test-238-session-scoped-ledger.cjs node tests/test-238-session-scoped-ledger.cjs
run_if "flipped: 238 chosen validation" tests/test-238-chosen-validation.cjs node tests/test-238-chosen-validation.cjs
run_if "flipped: 238 chain chosen validation" tests/test-238-chain-chosen-validation.cjs node tests/test-238-chain-chosen-validation.cjs
run_if "flipped: 267 gate premise" tests/test-267-mcpv2-gate-premise.cjs node tests/test-267-mcpv2-gate-premise.cjs
run_if "flipped: 365 floor notice" tests/test-365-floor-notice.cjs node tests/test-365-floor-notice.cjs
run_if "flipped: 365 acceptance floor" tests/test-365-acceptance-floor.cjs node tests/test-365-acceptance-floor.cjs
run_if "re-pinned: 265 gate_render elicit schema" tests/test-265-gate-render-elicit-schema.cjs node tests/test-265-gate-render-elicit-schema.cjs
run_if "healed: 192 menu sweep live selectors" tests/test-192-menu-sweep-live-selectors.cjs node tests/test-192-menu-sweep-live-selectors.cjs

# --- (3) regression neighbours (must stay green) ------------------------------
run_if "regression: 198 gate renderers" tests/test-198-gate-renderers.test.cjs node tests/test-198-gate-renderers.test.cjs
run_if "regression: F.8 renderer canon" lib/hmi/shape-f8-renderer.test.cjs node lib/hmi/shape-f8-renderer.test.cjs
run_if "regression: 238 one ledger" tests/test-238-one-ledger.cjs node tests/test-238-one-ledger.cjs
run_if "regression: c55 one resume owner" tests/test-c55-one-resume-owner.cjs node tests/test-c55-one-resume-owner.cjs
run_if "regression: 198 chain run halt" tests/test-198-chain-run-halt.test.cjs node tests/test-198-chain-run-halt.test.cjs
run_if "regression: 347 resume nonlinear" tests/test-347-resume-nonlinear.cjs node tests/test-347-resume-nonlinear.cjs
run_if "regression: h27 gate card node fields" tests/test-h27-gate-card-node-fields.cjs node tests/test-h27-gate-card-node-fields.cjs
run_if "regression: 189 F.8 governance gate" tests/test-189-f8-governance-gate.cjs node tests/test-189-f8-governance-gate.cjs
run_if "regression: 365 never do gate" tests/test-365-never-do-gate.cjs node tests/test-365-never-do-gate.cjs
run_if "regression: 276 meeting gate wiring" tests/test-276-meeting-gate-wiring.cjs node tests/test-276-meeting-gate-wiring.cjs
run_if "regression: 210 trailer relevance" tests/test-210-trailer-relevance.cjs node tests/test-210-trailer-relevance.cjs
run_if "regression: help selector lanes" tests/test-help-selector-lanes.cjs node tests/test-help-selector-lanes.cjs
# Plain leg: red at planning, green since the peer reworded sensors.cjs at 615e7ac41; no tolerance.
run_if "regression: 198 local only" tests/test-198-local-only.test.cjs node tests/test-198-local-only.test.cjs
run_if "regression: 276 tool honesty findings closed" tests/test-276-tool-honesty-findings-closed.cjs node tests/test-276-tool-honesty-findings-closed.cjs
# Plain leg: the peer re-froze the tool-honesty fixture at 011baa7e5; no tolerance is declared.
run_if "regression: tool honesty --check" scripts/check-tool-honesty.cjs node scripts/check-tool-honesty.cjs --check
run_if "regression: shape declaration --check" scripts/check-shape-declaration.cjs node scripts/check-shape-declaration.cjs --check
run_if "regression: skill mirrors --check" scripts/build-skill-mirrors.cjs node scripts/build-skill-mirrors.cjs --check
run_if "regression: command registry --check" scripts/build-command-registry.cjs node scripts/build-command-registry.cjs --check
run_if "regression: connector registry --check" scripts/build-connector-registry.cjs node scripts/build-connector-registry.cjs --check
# The --check flag is mandatory: without it build-render-coverage.cjs WRITES data/render-coverage-registry.json.
run_if "regression: render coverage --check" scripts/build-render-coverage.cjs node scripts/build-render-coverage.cjs --check

# --- (4) pre-existing red this phase does not own -----------------------------
# Signature measured at planning (2026-10-03, HEAD d511f4c04). KNOWN here is
# not PASS; any other failure mode is FAILED; run_known_if reports exit 0 as
# PASSED, so the leg turns into a plain pass by itself if its owner heals it.
# This is the ONLY run_known_if leg.
run_known_if "known red: 237 approve executes (not owned)" tests/test-237-approve-executes.cjs "MUTATION -- could not build the mutated copy" node tests/test-237-approve-executes.cjs

# --- (5) long-dash guard (hyphens only) ---------------------------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the fence would pass vacuously.
run "no em-dash or en-dash in phase 289 files" bash -c '
  files=$(ls -d lib/mcp/gate-render.cjs \
    lib/mcp/gate-ledger.cjs \
    lib/mcp/tools/gate.cjs \
    lib/mcp/tools/chain.cjs \
    lib/mcp/tools/research.cjs \
    lib/mcp/tools/sensors.cjs \
    lib/mcp/tools/stop-gate.cjs \
    commands/pipeline.md \
    commands/radar.md \
    commands/deck.md \
    commands/new-project.md \
    commands/skill.md \
    skills/pipeline/SKILL.md \
    skills/radar/SKILL.md \
    skills/deck/SKILL.md \
    skills/new-project/SKILL.md \
    skills/skill/SKILL.md \
    tests/test-289-*.cjs \
    tests/fixtures/289 \
    tests/run-all-289.sh \
    tests/test-238-session-scoped-ledger.cjs \
    tests/test-238-chosen-validation.cjs \
    tests/test-238-chain-chosen-validation.cjs \
    tests/test-267-mcpv2-gate-premise.cjs \
    tests/test-365-floor-notice.cjs \
    tests/test-365-acceptance-floor.cjs \
    tests/test-265-gate-render-elicit-schema.cjs \
    tests/test-192-menu-sweep-live-selectors.cjs \
    tests/test-267-mcpv2-dual-era.cjs \
    tests/test-354-concurrency-surfaces.cjs \
    .planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md \
    .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/*.md 2>/dev/null)
  [ -z "$files" ] && exit 0
  hits=$(LC_ALL=C grep -rlP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

# --- (6) live legs (slowest last) ---------------------------------------------
run_if "289 contract recommended (live)" tests/test-289-contract-recommended.cjs node tests/test-289-contract-recommended.cjs --arm live
run_if "289 elicit default (live)" tests/test-289-elicit-default.cjs node tests/test-289-elicit-default.cjs --arm live
run_if "267 dual era (live)" tests/test-267-mcpv2-dual-era.cjs node tests/test-267-mcpv2-dual-era.cjs
run_if "354 concurrency surfaces (live)" tests/test-354-concurrency-surfaces.cjs node tests/test-354-concurrency-surfaces.cjs
run_if "downstream: 369-07 owner-after-stranger flips by itself" tests/test-369-sessionful-acceptance.cjs node tests/test-369-sessionful-acceptance.cjs
run_if "downstream: 369-21 human-only arm 3b" tests/test-369-human-only.cjs node tests/test-369-human-only.cjs
run_if "CARD289-02 dual-era (live, last)" tests/test-289-cli-card-dual-era.cjs node tests/test-289-cli-card-dual-era.cjs

# --- (7) closing leg: Phase 369 precondition probe ----------------------------
run_if "downstream: Phase 369 precondition probe (recommended id by value, owner-after-stranger, the CLI card ruling)" tests/test-369-289-precondition.cjs node tests/test-369-289-precondition.cjs

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
