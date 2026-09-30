#!/usr/bin/env bash
# SEED-103 (2026-10-01): Eureka retires as a standalone engine; the Eureka
# PERSPECTIVE lives inside the research planner (local graph + ICM recall,
# Stage A judge, question template, MCP ops, CLI door), plus the one-home
# Claude model routing every lib/ Anthropic caller now goes through.
#
# Modeled on tests/run-all-363.sh (run / run_if counters). Hyphens only.
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (exit 77 or a
# missing planned file). exit 0 -> FAILED=0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0; SKIP=0

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

# Em-dash guard on the files this seed adds (house rule: hyphens only)
run "no em-dash in seed103 files" bash -c '! grep -rlP "\xE2\x80\x94" lib/core/claude-routing.cjs lib/core/research-planner/perspectives scripts/eureka-jev-judge.cjs tests/test-seed103-*.cjs'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
[ "$FAIL" -eq 0 ]
