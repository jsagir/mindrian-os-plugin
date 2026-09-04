#!/usr/bin/env bash
# Phase 275 verification aggregator: enlarge the room schema by ICM layer,
# and give the phase one command that proves it.
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   275-01: the section tables -- SECTION_NAMES grows 8 to 11 (opportunity-bank,
#     funding, strategy), SECTION_METADATA carries the new statement field,
#     seven dead/misfiled command citations get corrected, section-registry.cjs
#     and the blueprint data + CI gate stay reconciled.
#   275-02: the three ICM layer mechanisms live in the scaffold itself --
#     L1 statement render (frontmatter + body blockquote), the L2 per-section
#     CONTEXT.md contract writer, and the L3 references/ factory directory
#     writer, all idempotent and all degrading to a named warning rather than
#     a failed scaffold when their content is not yet on disk.
#   275-03: the two runtime SECTION_NAMES mirrors (room-birth.cjs,
#     grade-grant.cjs) are de-duplicated onto the scaffold's own export --
#     zero hand-copied section-vocabulary literals remain under lib/.
#   275-04: the seven stale count-literal assertion sites this phase's own
#     table growth turned RED are reconciled, with the exactly-N literal kept
#     at exactly one sanctioned home and every other site deriving from the
#     table.
#   275-05: the L2 CONTEXT.md contracts for the 8 original sections, including
#     the solution-design moat/defensibility Human check cross-linked to
#     competitive-analysis.
#   275-06: the L2 CONTEXT.md contracts for the 3 new sections -- the
#     opportunity-bank to funding pipeline named in both directions, and the
#     dilutive/non-dilutive funding scope stated honestly.
#   275-07: the two L3 reference documents -- SECTION-SCHEMA.md (the
#     venture_stage axis schema, both default_methodologies grains and their
#     precedence rule, the three-tier command map) and SUB-SCHEMAS.md
#     (funding's Stage/Outcome, opportunity-bank's Knight position,
#     team-execution's Mentor-Profiles).
#   275-08: the idempotent additive migration script for existing rooms, this
#     phase's own assertion suite, and this aggregator.
#
# TRI-POLAR POSITION, STATED EXPLICITLY (per the run-all-274.sh precedent of
# naming this as a deliberate call, not a silent omission): this phase's
# changes are surface-independent -- data tables, a file scaffold, and static
# markdown templates, with zero surface-specific code path. The CLI arms
# below (scaffold calls, a migration CLI, static file assertions) exercise
# the exact same code Desktop and Cowork would run through the same shared
# lib/core/ modules; there is no separate Desktop or Cowork invocation
# surface for any of it. Coverage is therefore identical across all three
# surfaces by construction, not by a runtime test run on each -- there is no
# surface-specific gap to name here, unlike phases that touch a
# surface-specific invocation path.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# 1. The phase's own assertion suite (275-08): all four ICM layers plus the
#    migration, in the eight numbered Section blocks.
run "275 section-schema suite" node tests/test-275-section-schema.cjs

# 2. The blueprint CI gate (275-01): 9 families, all section slugs valid.
run "room-blueprints CI gate" node scripts/check-room-blueprints.cjs --check

# 3. The scaffold unit suite (275-01/02/04): SECTION_NAMES, SECTION_METADATA,
#    IDENTITY_DIRECTORIES, the L1/L2/L3 writers.
run "room-skeleton-scaffold unit suite" node --test lib/core/room-skeleton-scaffold.test.cjs

# 4. The scaffold integration suite (275-01/02/04): sections_created /
#    identity_files_created counts derived from the tables, warnings channel.
run "room-skeleton-scaffold integration suite" node tests/test-room-skeleton-scaffold-integration.cjs

# 5. Gate 6 (275-04): now a SECTION_METADATA/IDENTITY_DIRECTORIES drift
#    invariant, negative-tested, no longer a restated count literal.
run "119-02 scaffold gate (Gate 6 drift invariant)" bash tests/test-119-02-scaffold.sh

# 6. The blueprint-family scaffold suite (275-01): venture family reproduces
#    the frozen SECTION_NAMES set; do-not-regress from every earlier plan in
#    this phase.
run "blueprint-family scaffold suite" node tests/test-blueprint-scaffold.cjs

# 7. The hypothesis-family suite (275-04): the opportunity-bank truth flip
#    (D-01), assumptions still the sole non-frozen slug.
run "hypothesis-family and claim suite" node tests/test-hypothesis-family-and-claim.cjs

# 8. The section-nodes birth-and-migration suite (275-03): room-birth.cjs
#    writes 11 Section nodes, not the stale 8.
run "section-nodes birth-and-migration suite" node tests/test-section-nodes-birth-and-migration.cjs

# 9. DO-NOT-REGRESS: the schema-driven baseline rules (Phase 270), re-run
#    unchanged, so this phase's own table growth cannot quietly re-break
#    the no-hand-copied-literal / no-frozen-count-restated invariants.
run "270 baseline schema-driven rules, DO-NOT-REGRESS" node tests/test-270-baseline-schema-driven.cjs

# 10. DO-NOT-REGRESS: the connector-registry gate. No command frontmatter was
#     touched by this phase, so this must still pass.
run "connector-registry gate, DO-NOT-REGRESS" node scripts/build-connector-registry.cjs --check

echo "======================================"
echo "Phase 275: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
