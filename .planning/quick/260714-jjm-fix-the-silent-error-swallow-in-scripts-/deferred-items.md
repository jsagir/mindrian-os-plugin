# Deferred Items -- quick-task 260714-jjm

Out-of-scope discoveries logged during execution. NOT fixed (SCOPE BOUNDARY rule:
only auto-fix issues directly caused by this task's changes).

## 1. Pre-existing shape-declaration strict-gate drift (run-all-216.sh leg "216-03 gate: shape declaration (strict)")

- **Found during:** Task 2 regression sweep (bash tests/run-all-216.sh)
- **Status:** PRE-EXISTING, unrelated to this task. This task touched only
  scripts/eureka-command.cjs, tests/test-218-eureka-auto-extract.cjs, and
  tests/run-all-218.sh -- zero skills/ files.
- **What:** `node scripts/check-shape-declaration.cjs --check --strict` fails
  because 24 skills/*/SKILL.md files declare BOTH a hitl_shape (a genuine
  Decision-Gate fork, e.g. F.0/F.1/F.8) AND connector.excluded:true (the
  no-fork exemption) simultaneously, which Canon Part 11 forbids: "a
  render-only or pure-capability skill is exempt via its existing
  connector.excluded:true + reason, never via a fork it does not have."
  Affected skills include: dogfood-flush, export, feynman-timeline-refresh,
  heal, help, hmi-status, intelligence-orchestrator, models, mos, onboard,
  organize, publish, query, radar, rooms, scheduled-tasks, setup, snapshot,
  splash, stance, update, vault, visualize.
- **Why it is advisory in normal use:** per CLAUDE.md Part 11, check-shape-declaration.cjs
  is an ADVISORY WARN signal at commit/release/doctor as of Phase 210; only
  --strict restores the pre-Phase-210 hard-fail. run-all-216.sh runs it strict.
- **Why NOT fixed here:** touching 24 skill declarations is a large,
  independent Canon-compliance change with no relationship to the silent
  extraction-failure swallow. It belongs in its own /gsd:debug or phase.
- **Regression proof for THIS task:** the eureka dispatcher e2e leg that
  exercises the edited run path (tests/test-216-eureka-command.cjs) passes with
  44 assertions -- the dispatcher change is unregressed. Recommended: file a
  dedicated session to backfill/correct the 24 skill hitl_shape declarations
  (node scripts/backfill-hitl-shape.cjs or hand-author per
  docs/HITL-SHAPE-DECLARATION-CONTRACT.md).
