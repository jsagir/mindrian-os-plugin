#!/usr/bin/env bash
# Phase 121-04 meta-scaffold: gates the full phase-121 contract.
#
# 5 gates:
#   1. docs/TELEMETRY-SCHEMA.md exists and documents all 15 event types
#   2. Canon Part 8 adversarial audit passes (7 sub-gates, 17 files)
#   3. D-12 silent-observability invariant passes (4 sub-gates)
#   4. all prior plan scaffolds still green (00 + 01 + 02 + 03)
#   5. zero em-dashes in plan files + TELEMETRY-SCHEMA.md
#
# bash only. No emoji. No em-dashes (per memory rule feedback_no_emdashes).

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: docs/TELEMETRY-SCHEMA.md exists and documents all 15 event types.
[ -f docs/TELEMETRY-SCHEMA.md ] || fail "docs/TELEMETRY-SCHEMA.md missing"
for evt in selector_pick tension_engagement auto_explore_decision breakthrough_dismissed hooked_axis_score empathy_observation room_receipt_written command_invocation nav_bypass mva_pipeline_started mva_agent_returned mva_brief_rendered mva_option_selected mva_brief_deployed mva_pipeline_failed; do
  grep -q "$evt" docs/TELEMETRY-SCHEMA.md || fail "TELEMETRY-SCHEMA.md missing $evt"
done

# Gate 2: Canon Part 8 audit passes.
bash tests/test-121-04-canon-part-8-audit.sh >/dev/null || fail "Canon Part 8 audit failed"

# Gate 3: D-12 silent-observability invariant passes.
bash tests/test-121-04-silent-observability.sh >/dev/null || fail "D-12 silent-observability invariant failed"

# Gate 4: all prior plan scaffolds still green.
for scaffold in tests/test-121-00-scaffold.sh tests/test-121-01-scaffold.sh tests/test-121-02-scaffold.sh tests/test-121-03-scaffold.sh; do
  [ -f "$scaffold" ] || fail "missing prior scaffold: $scaffold"
  bash "$scaffold" >/dev/null || fail "$scaffold failed"
done

# Gate 5: zero em-dashes in plan files + schema doc.
HITS=()
for f in .planning/phases/121-trajectory-telemetry/121-00-PLAN.md \
         .planning/phases/121-trajectory-telemetry/121-01-PLAN.md \
         .planning/phases/121-trajectory-telemetry/121-02-PLAN.md \
         .planning/phases/121-trajectory-telemetry/121-03-PLAN.md \
         .planning/phases/121-trajectory-telemetry/121-04-PLAN.md \
         docs/TELEMETRY-SCHEMA.md; do
  if [ -f "$f" ] && grep -lP "\x{2014}" "$f" >/dev/null 2>&1; then
    HITS+=("$f")
  fi
done
if [ "${#HITS[@]}" -gt 0 ]; then
  echo "EM-DASH HITS:" >&2
  for h in "${HITS[@]}"; do echo "  $h" >&2; done
  fail "em-dashes found in plan files or schema doc"
fi

echo "PASS: Phase 121 meta-scaffold (5 gates green; all 5 plans aggregate clean)"
