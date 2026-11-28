#!/usr/bin/env bash
# Phase 404 gate runner. The BASE is 06e95b5ecda9c989f14842010d5bec6f74b7f505.
# BASE reds are not runner legs: 269 doctrine reconcile (MOAT-05, missing CLI anchor);
# hitl backfill check (124 surfaces); fda known tool shapes (Arm B);
# 130 lens engine e2e (cases 1, 2, 3, 7, 8).
# BASE 361 suite reds: existing FDA known-tool-shapes, existing 209 declared-implies-wired,
# existing fileEvidenceWithReadback contract. Other inner tests run by their exact command.
# BASE 267 suite reds: CIRS gates (MCPV2-08), zod4 contract (MCPV2-03), brain shim canary
# (MCPV2-11), local server dual era (MCPV2-02), regression 354 concurrency surfaces.
# BASE 257 suite red: Plan 08 (LOCUS-07) strict input shapes.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PASS=0
FAIL=0
SKIP=0
run() { local label="$1"; shift; echo "--- $label ---"; "$@"; local status=$?; if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); elif [ "$status" -eq 77 ]; then echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi; }
run_if() { local label="$1"; local guard="$2"; shift 2; if [ -f "$guard" ]; then run "$label" "$@"; else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); fi; }
export HOME="$(mktemp -d)"
export USERPROFILE="$(mktemp -d)"
export MINDRIAN_HOME="$(mktemp -d)"
export MINDRIAN_ROOMS_HOME="$(mktemp -d)"
export MINDRIAN_BRAIN_URL="http://127.0.0.1:9"
run_if "404 gpws check" tests/test-404-gpws-check.cjs node tests/test-404-gpws-check.cjs
run_if "404 step reader" tests/test-404-step-reader.cjs node tests/test-404-step-reader.cjs
run_if "404 recipe table" tests/test-404-recipe-table.cjs node tests/test-404-recipe-table.cjs
run_if "404 moment graph" tests/test-404-moment-graph.cjs node tests/test-404-moment-graph.cjs
run_if "404 recipe parity" tests/test-404-recipe-parity.cjs node tests/test-404-recipe-parity.cjs
run_if "404 label matrix" tests/test-404-label-matrix.cjs node tests/test-404-label-matrix.cjs
run_if "404 shim steps" tests/test-404-shim-steps.cjs node tests/test-404-shim-steps.cjs
run_if "404 part8 walk arm" tests/test-404-part8-walk-arm.cjs node tests/test-404-part8-walk-arm.cjs
run_if "404 pilot declarations" tests/test-404-pilot-declarations.cjs node tests/test-404-pilot-declarations.cjs
run_if "404 part8" tests/test-404-part8.cjs node tests/test-404-part8.cjs
run_if "404 no second path" tests/test-404-no-second-path.cjs node tests/test-404-no-second-path.cjs
run_if "404 evals" tests/test-404-evals.cjs node tests/test-404-evals.cjs
run_if "404 start cases" tests/test-404-start-cases.cjs node tests/test-404-start-cases.cjs
run_if "404 probe" tests/test-404-probe.cjs node tests/test-404-probe.cjs
run_if "404 trace reducer" tests/test-404-trace-reducer.cjs node tests/test-404-trace-reducer.cjs
run_if "404 return score" tests/test-404-return-score.cjs node tests/test-404-return-score.cjs
run_if "404 run and label canon" tests/test-404-run-and-label-canon.cjs node tests/test-404-run-and-label-canon.cjs
run_if "404 stop replay" tests/test-404-stop-replay.cjs node tests/test-404-stop-replay.cjs
run_if "250 amendment unit" tests/test-404-run-and-label-canon.cjs node tests/test-250-amendment-unit.cjs
# The 269 line is omitted because it is red on BASE and is not a leg.
run_if "259 refusal rate limit" tests/test-404-run-and-label-canon.cjs node tests/test-259-refusal-rate-limited.cjs
run_if "357 labeler refusal" tests/test-404-run-and-label-canon.cjs node tests/test-357-labeler-refusal.cjs
run_if "363 corpus honesty" tests/test-404-run-and-label-canon.cjs node tests/test-363-corpus-honesty.cjs
run "shape declaration check" node scripts/check-shape-declaration.cjs --check
# The backfill and FDA checks are red on BASE and are not runner legs.
run "connector registry check" node scripts/build-connector-registry.cjs --check
run_if "361: pre-phase baseline (361-01)"                tests/test-361-baseline.cjs        node tests/test-361-baseline.cjs
run_if "361: Part 8 known-shape arms (361-02, D-10)"      tests/test-361-egress-shapes.cjs   node tests/test-361-egress-shapes.cjs
run_if "361: Theo input-shape parity (361-02, D-10/D-14)" tests/test-361-theo-parity.cjs     node tests/test-361-theo-parity.cjs
run_if "361: lane-queries composer (361-03, D-02)"        tests/test-361-lane-queries.cjs    node tests/test-361-lane-queries.cjs
run_if "361: evidence-pack validator (361-03, D-06/D-13)" tests/test-361-evidence-pack.cjs   node tests/test-361-evidence-pack.cjs
run_if "361: agent contract (361-04, D-17)"               tests/test-361-agent-contract.cjs  node tests/test-361-agent-contract.cjs
run_if "361: Theo structure fallback (361-05, D-09/D-16)" tests/test-361-theo-structure.cjs  node tests/test-361-theo-structure.cjs
run_if "361: CLI (361-06)"                                tests/test-361-cli.cjs             node tests/test-361-cli.cjs
run_if "361: filing readback (361-06, D-07)"              tests/test-361-filing.cjs          node tests/test-361-filing.cjs
run_if "361: command contract (361-07, D-11/D-12/D-13)"   tests/test-361-command-contract.cjs node tests/test-361-command-contract.cjs
run "361: existing part8-egress-guard self-test"      node lib/core/part8-egress-guard.test.cjs
run "361: existing 250 doctrine fence"                node tests/test-250-doctrine-fence.cjs
run "361: existing 344 surface-layer parity"          node tests/test-344-surface-layer-parity.cjs
run "361: existing 148 engine reaches"                node tests/test-148-engine-reaches.cjs
run "361: existing 341 registry drift"                node tests/test-341-registry-drift.cjs
run "361: existing 265 threshold fanouts"             node tests/test-265-threshold-fanouts.cjs
run "361: existing 265 swarm task grant"              node tests/test-265-swarm-task-grant.cjs
run "361: existing 265 declaration truth"             node tests/test-265-declaration-truth.cjs
run "361: existing layer-declaration check"           node scripts/check-layer-declaration.cjs
run "361: existing render-coverage check"             node scripts/check-render-coverage.cjs
run "361: command-registry generator --check"         node scripts/build-command-registry.cjs --check
run "361: connector-registry generator --check"       node scripts/build-connector-registry.cjs --check
run "361: skill-mirrors generator --check"             node scripts/build-skill-mirrors.cjs --check
run "361: orchestration-projection generator --check" node scripts/build-orchestration-projection.cjs --check
# --- CIRS plan-declaration leg (over every landed 361 plan file) ------------
PD=".planning/phases/361-dominant-design-research-mode-mos-dominant-designs-gains-a-r"
CIRS_PLANS=()
while IFS= read -r -d '' f; do
  CIRS_PLANS+=("$f")
done < <(find "$PD" -maxdepth 1 -name '361-*-PLAN.md' -print0 2>/dev/null)
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo "--- 361: CIRS plan-declaration check ---"
  echo ">>> 361: CIRS plan-declaration check: SKIPPED (no $PD/361-*-PLAN.md found)"
  SKIP=$((SKIP+1))
  echo ""
else
  run "361: CIRS plan-declaration check" node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
fi
run_if "267: sdk era (MCPV2-01)" tests/test-267-mcpv2-sdk-era.cjs node tests/test-267-mcpv2-sdk-era.cjs
run_if "267: lockstep (MCPV2-19)" tests/test-267-mcpv2-lockstep.cjs node tests/test-267-mcpv2-lockstep.cjs
run_if "267: tee helper (MCPV2-13)" tests/test-267-mcpv2-tee.cjs node tests/test-267-mcpv2-tee.cjs
run_if "267: CLI live wire probe, opt-in (MCPV2-13)" tests/test-267-mcpv2-cli-probe.cjs node tests/test-267-mcpv2-cli-probe.cjs
run_if "267: registration API and titles (MCPV2-02, MCPV2-08)" tests/test-267-mcpv2-registration-api.cjs node tests/test-267-mcpv2-registration-api.cjs
run_if "267: gate elicitation premise (MCPV2-07)" tests/test-267-mcpv2-gate-premise.cjs node tests/test-267-mcpv2-gate-premise.cjs
run_if "267: runtime-loop prompts (MCPV2-16)" tests/test-267-mcpv2-prompts.cjs node tests/test-267-mcpv2-prompts.cjs
run_if "267: MCP Apps schemas and containment (MCPV2-04)" tests/test-267-mcpv2-app-views.cjs node tests/test-267-mcpv2-app-views.cjs
run_if "267: HTTP flag-OFF multi-request and rebinding (MCPV2-05, MCPV2-17)" tests/test-267-mcpv2-http-flag-off.cjs node tests/test-267-mcpv2-http-flag-off.cjs
run_if "267: process lifecycle (MCPV2-14)" tests/test-267-mcpv2-lifecycle.cjs node tests/test-267-mcpv2-lifecycle.cjs
run_if "267: flag-ON routing (MCPV2-06, MCPV2-17)" tests/test-267-mcpv2-flag-on.cjs node tests/test-267-mcpv2-flag-on.cjs
run_if "267: in-repo clients (MCPV2-06)" tests/test-267-mcpv2-clients.cjs node tests/test-267-mcpv2-clients.cjs
run_if "regression: 257 envelope passthrough" tests/test-257-envelope-passthrough.cjs node tests/test-257-envelope-passthrough.cjs
run_if "regression: 257 refusal egress kind" tests/test-257-refusal-egress-kind.cjs node tests/test-257-refusal-egress-kind.cjs
run_if "REGRESSION 239 query egress canary (must stay green)" \
  tests/test-239-query-egress-canary.cjs \
  node tests/test-239-query-egress-canary.cjs
run_if "REGRESSION 254 ambiguous disclosure (must stay green)" \
  tests/test-254-ambiguous-disclosure.cjs \
  node tests/test-254-ambiguous-disclosure.cjs
run_if "REGRESSION 254 composition census (must stay green)" \
  tests/test-254-composition-census.cjs \
  node tests/test-254-composition-census.cjs
# quick-260910-h32 pins the deletion of scripts/sync-rooms-brain (Canon Part 8
# script-level Brain-write egress) with a default-deny census over scripts/.
# The quick file name is deliberate: run_if takes an explicit path.
run_if "QUICK 260910-h32 no brain-write egress from scripts/ (Part 8)" \
  tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs \
  node tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs
run_if "regression: mcp-dep-heal" lib/core/mcp-dep-heal.test.cjs node lib/core/mcp-dep-heal.test.cjs
run_if "regression: 265 gate-render elicit schema" tests/test-265-gate-render-elicit-schema.cjs node tests/test-265-gate-render-elicit-schema.cjs
run_if "regression: 265 mcp surface organ" tests/test-265-mcp-surface-organ.cjs node tests/test-265-mcp-surface-organ.cjs
run_if "regression: 248 surface probes" tests/test-248-surface-probes.cjs node tests/test-248-surface-probes.cjs
run_if "regression: 248 resolver census" tests/test-248-resolver-census.cjs node tests/test-248-resolver-census.cjs
run_if "regression: desktop stdio session binding (Desktop surrogate, process key + refuse)" tests/test-desktop-stdio-session-binding.cjs node tests/test-desktop-stdio-session-binding.cjs
run_if "regression: 354 egress typed question" tests/test-354-egress-typed-question.cjs node tests/test-354-egress-typed-question.cjs
run_if "regression: 354 extract shallow contract" tests/test-354-extract-shallow-contract.cjs node tests/test-354-extract-shallow-contract.cjs
run_if "regression: 354 registration diagnostics" tests/test-354-registration-diagnostics.cjs node tests/test-354-registration-diagnostics.cjs
run_if "regression: 354 room symlink containment" tests/test-354-room-symlink-containment.cjs node tests/test-354-room-symlink-containment.cjs
run_if "regression: 354 theo journey" tests/test-354-theo-journey.cjs node tests/test-354-theo-journey.cjs
run_if "regression: 276 claim write primitive" tests/test-276-claim-write-primitive.cjs node tests/test-276-claim-write-primitive.cjs
run_if "regression: 341 shrinkwrap no dev" tests/test-341-shrinkwrap-no-dev.cjs node tests/test-341-shrinkwrap-no-dev.cjs
run_if "regression: release payload ceiling" scripts/check-release-payload-ceiling.cjs node scripts/check-release-payload-ceiling.cjs --check
run_if "257 refusal egress kind" tests/test-257-refusal-egress-kind.cjs node tests/test-257-refusal-egress-kind.cjs
run_if "257 envelope passthrough" tests/test-257-envelope-passthrough.cjs node tests/test-257-envelope-passthrough.cjs
run_if "257 shim honest refusal" tests/test-257-shim-honest-refusal.cjs node tests/test-257-shim-honest-refusal.cjs
run_if "257 brain tool egress invariant" tests/test-257-brain-tool-egress-invariant.cjs node tests/test-257-brain-tool-egress-invariant.cjs

run "guard self-test" node lib/core/part8-egress-guard.test.cjs
run "386 typed theo arms" node tests/test-386-typed-theo-allow-arms.cjs
run "gct step id parity" node tests/test-gct-process-step-id-parity.cjs
run "355 part8 egress" node tests/test-355-part8-egress.cjs
run "130 cognitive migration" node tests/test-130-cognitive-migration.cjs
run_if "405 shape parity" tests/test-405-shape-parity.cjs node tests/test-405-shape-parity.cjs
run_if "405 method run parity" tests/test-405-method-run-parity.cjs node tests/test-405-method-run-parity.cjs
run "364 suite" bash tests/run-all-364.sh
run "364 sr steps" node tests/test-364-sr-steps.cjs
printf 'PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
