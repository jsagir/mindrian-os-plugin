#!/usr/bin/env bash
# Phase 369 (UI shell, an agent-native app over the MindrianOS MCP server)
# verification aggregator.
#
# Modeled on tests/run-all-267.sh (run/run_if/counter shape, exit 77 =
# SKIPPED ENV GAP, the long-dash guard loop, final exit).
#
# WRITTEN ONCE, HERE, IN 369-04. NO LATER 369 PLAN EDITS THIS FILE'S LEG LIST.
# Every Phase 369 leg is pre-declared below, guarded on its own test file, so
# a leg SKIPs until the owning plan lands it -- expected mid-phase, not a
# failure. The live-daemon and Playwright legs run sequentially (they share
# loopback ports). The "REGRESSION LEGS" section holds individual regression
# test files and gate scripts that must stay green while the shell lands.
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED (ENV GAP), never reported as PASSED
# anything else -> FAILED
#
# House rule: hyphens only, no em-dashes or en-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  fi
  echo ""
}

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# --- 369 legs, pre-declared once (the aggregator only ADDS test files, never
# edits this leg list) -------------------------------------------------------
run_if "369: constitution (TS369-01)" tests/test-369-constitution.cjs node tests/test-369-constitution.cjs
run_if "369: engines floor (TS369-02)" tests/test-236-engines-floor.cjs node tests/test-236-engines-floor.cjs
run_if "369: erasable gate (TS369-03)" tests/test-369-ts-erasable-gate.cjs node tests/test-369-ts-erasable-gate.cjs
run_if "369: walled manifest (TS369-03)" tests/test-369-walled-manifest.cjs node tests/test-369-walled-manifest.cjs
run_if "369: installed layout (TS369-04)" tests/test-369-installed-layout.cjs node tests/test-369-installed-layout.cjs
run_if "369: installed layout exact floor (TS369-04)" tests/test-369-installed-layout.cjs node tests/test-369-installed-layout.cjs --exact-floor
run_if "369: hook require graph and cold-start baseline (TS369-05)" tests/test-369-hook-require-graph.cjs node tests/test-369-hook-require-graph.cjs
run_if "369: infra helpers (TS369-07)" tests/test-369-infra-helpers.cjs node tests/test-369-infra-helpers.cjs
run_if "369: SSE vocabulary pin (TS369-07)" tests/test-369-sse-vocab-pin.cjs node tests/test-369-sse-vocab-pin.cjs
run_if "369: change log DDL (CHG369-01, CHG369-02)" tests/test-369-change-log-ddl.cjs node tests/test-369-change-log-ddl.cjs
run_if "369: transaction ownership (CHG369-03)" tests/test-369-tx-ownership.cjs node tests/test-369-tx-ownership.cjs
run_if "369: writer inventory coverage (CHG369-04)" tests/test-369-writer-inventory.cjs node tests/test-369-writer-inventory.cjs
run_if "369: change log cross-process and Python (CHG369-05)" tests/test-369-change-log-cross-process.cjs node tests/test-369-change-log-cross-process.cjs
run_if "369: change log compaction and retention (CHG369-06, CM369-01)" tests/test-369-change-log-compaction.cjs node tests/test-369-change-log-compaction.cjs
run_if "369: sessionful acceptance (SESS369-01, SESS369-02)" tests/test-369-sessionful-acceptance.cjs node tests/test-369-sessionful-acceptance.cjs
run_if "369: daemon env scrub (SESS369-03)" tests/test-369-daemon-env-scrub.cjs node tests/test-369-daemon-env-scrub.cjs
run_if "369: shared core (SHELL369-01, RXP369-01, HUM369-01)" tests/test-369-shared-core.cjs node tests/test-369-shared-core.cjs
run_if "369: canon scope docs (CANON369-01, CANON369-02)" tests/test-369-canon-scope-docs.cjs node tests/test-369-canon-scope-docs.cjs
run_if "369: indicator design note (CANON369-03)" tests/test-369-indicator-note.cjs node tests/test-369-indicator-note.cjs
run_if "369: room_changes (FEED369-01, FEED369-04)" tests/test-369-room-changes.cjs node tests/test-369-room-changes.cjs
run_if "369: room_artifact (FEED369-02)" tests/test-369-room-artifact.cjs node tests/test-369-room-artifact.cjs
run_if "369: Claude adapter (SHELL369-02)" tests/test-369-claude-adapter.cjs node tests/test-369-claude-adapter.cjs
run_if "369: bake-off workroom candidate (BAKE369-01)" tests/test-369-bakeoff-workroom.cjs node tests/test-369-bakeoff-workroom.cjs
run_if "369: bake-off agent-native candidate (BAKE369-02)" tests/test-369-bakeoff-agent-native.cjs node tests/test-369-bakeoff-agent-native.cjs
run_if "369: room.changed wake-up (FEED369-03, FEED369-05)" tests/test-369-sse-room-changed.cjs node tests/test-369-sse-room-changed.cjs
run_if "369: bake-off measure harness (BAKE369-03)" tests/test-369-bakeoff-measure.cjs node tests/test-369-bakeoff-measure.cjs
run_if "369: shell server (SHELL369-03)" tests/test-369-shell-server.cjs node tests/test-369-shell-server.cjs
run_if "369: shell actions, feed relay and connection state (SHELL369-04, SHELL369-05, HUM369-01)" tests/test-369-shell-actions.cjs node tests/test-369-shell-actions.cjs
run_if "369: canon skin (CANON369-04, CANON369-05)" tests/test-369-canon-skin.cjs node tests/test-369-canon-skin.cjs
run_if "369: human-only approve (HUM369-02, HUM369-03)" tests/test-369-human-only.cjs node tests/test-369-human-only.cjs
run_if "369: launch surface (SHELL369-08, SHELL369-09)" tests/test-369-launch-surface.cjs node tests/test-369-launch-surface.cjs
run_if "369: replica e2e (RXP369-02, RXP369-03, CM369-02)" tests/e2e-369/replica.cjs node tests/e2e-369/replica.cjs
run_if "369: session indicator (CANON369-06)" tests/test-369-session-indicator.cjs node tests/test-369-session-indicator.cjs
run_if "369: views copy contract (SHELL369-06, SHELL369-07)" tests/test-369-views-copy.cjs node tests/test-369-views-copy.cjs
run_if "369: views e2e (SHELL369-06, SHELL369-07)" tests/e2e-369/views.cjs node tests/e2e-369/views.cjs
run_if "369: Phase 289 precondition probe (GREC369-01..05, SHELL369-10)" tests/test-369-289-precondition.cjs node tests/test-369-289-precondition.cjs
run_if "369: gate recovery (GREC369-01..04)" tests/test-369-gate-recovery.cjs node tests/test-369-gate-recovery.cjs
run_if "369: gate web mapping (SHELL369-10)" tests/test-369-gate-web-mapping.cjs node tests/test-369-gate-web-mapping.cjs
run_if "369: gate button e2e (SHELL369-10, GREC369-05)" tests/e2e-369/gate-button.cjs node tests/e2e-369/gate-button.cjs
run_if "369: UI dist fresh (TS369-08)" tests/test-369-ui-dist-fresh.cjs node tests/test-369-ui-dist-fresh.cjs
run_if "369: egress and canon (CANON369-07)" tests/e2e-369/egress-and-canon.cjs node tests/e2e-369/egress-and-canon.cjs
run_if "369: recoverable journey (SHELL369-11, CM369-03)" tests/e2e-369/journey.cjs node tests/e2e-369/journey.cjs

# --- REGRESSION LEGS ---------------------------------------------------------
# Individual test files and gate scripts that must stay green while the shell
# lands. Whole-suite scripts with pre-existing reds are not legs.
run_if "regression: 341 shrinkwrap no dev" tests/test-341-shrinkwrap-no-dev.cjs node tests/test-341-shrinkwrap-no-dev.cjs
run_if "regression: 276 tool honesty findings closed" tests/test-276-tool-honesty-findings-closed.cjs node tests/test-276-tool-honesty-findings-closed.cjs
run_if "regression: tool honesty check" scripts/check-tool-honesty.cjs node scripts/check-tool-honesty.cjs --check
run_if "regression: 267 registration API" tests/test-267-mcpv2-registration-api.cjs node tests/test-267-mcpv2-registration-api.cjs
run_if "regression: 267 CIRS gates" tests/test-267-mcpv2-cirs-gates.cjs node tests/test-267-mcpv2-cirs-gates.cjs
run_if "regression: 267 flag-ON routing" tests/test-267-mcpv2-flag-on.cjs node tests/test-267-mcpv2-flag-on.cjs
run_if "regression: 270 tool schema budget" tests/test-270-tool-schema-budget.cjs node tests/test-270-tool-schema-budget.cjs
run_if "regression: 198 gate renderers" tests/test-198-gate-renderers.test.cjs node tests/test-198-gate-renderers.test.cjs
run_if "regression: 198 local only" tests/test-198-local-only.test.cjs node tests/test-198-local-only.test.cjs
run_if "regression: MCP no instructions" lib/mcp/no-instructions.test.cjs node lib/mcp/no-instructions.test.cjs
run_if "regression: connector registry" scripts/build-connector-registry.cjs node scripts/build-connector-registry.cjs --check
run_if "regression: render coverage" scripts/check-render-coverage.cjs node scripts/check-render-coverage.cjs
run_if "regression: release payload ceiling" scripts/check-release-payload-ceiling.cjs node scripts/check-release-payload-ceiling.cjs --check

# --- Long-dash guard (always; U+2014 and U+2013) over every Phase 369 test,
# helper, fixture and new source path ----------------------------------------
echo "--- 369: long-dash guard ---"
DASH_HIT=0
EM="$(printf '\xe2\x80\x94')"
EN="$(printf '\xe2\x80\x93')"
EMDASH_FILES=("tests/run-all-369.sh")
add_found() {
  local f
  while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done
}
add_found < <(find tests -maxdepth 1 -name 'test-369-*.cjs' -print0 2>/dev/null)
[ -d tests/e2e-369 ] && add_found < <(find tests/e2e-369 -name node_modules -prune -o -type f -print0 2>/dev/null)
[ -d tests/fixtures/369 ] && add_found < <(find tests/fixtures/369 -type f -print0 2>/dev/null)
for f in tests/helpers/mcp-daemon-369.cjs tests/helpers/fixture-room-369.cjs \
         lib/core/navigation/room-change-log.cjs lib/core/navigation/room-projection.cjs \
         lib/mcp/tools/feed.cjs lib/mcp/tools/artifact-read.cjs lib/mcp/room-watcher.cjs \
         lib/ui-shell/launch.cjs scripts/measure-hook-cold-start.cjs; do
  [ -f "$f" ] && EMDASH_FILES+=("$f")
done
# Source trees: skip node_modules and any built output dir.
for d in tools/ts-check ui/shared/src ui/shell ui/bakeoff; do
  [ -d "$d" ] || continue
  add_found < <(find "$d" \( -name node_modules -o -name dist -o -name build -o -name out -o -name .next -o -name .vite \) -prune -o \
    -type f \( -name '*.cjs' -o -name '*.mjs' -o -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' -o -name '*.css' -o -name '*.html' -o -name '*.sh' \) -print0 2>/dev/null)
done
for f in "${EMDASH_FILES[@]}"; do
  [ -f "$f" ] || continue
  if grep -lq -e "$EM" -e "$EN" "$f" 2>/dev/null; then
    echo "long dash found in $f"
    DASH_HIT=1
  fi
done
if [ "$DASH_HIT" -eq 0 ]; then
  echo ">>> 369: long-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 369: long-dash guard: FAILED"; FAIL=$((FAIL+1))
fi

echo "======================================"
echo "Phase 369: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
