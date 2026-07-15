# Deferred items -- quick 260715-cu8

Out-of-scope discoveries logged during execution (SCOPE BOUNDARY rule: only
issues DIRECTLY caused by this task's changes are auto-fixed; unrelated
pre-existing failures are logged, not fixed).

## Pre-existing 216-03 shape-declaration strict gate failure (NOT cu8)

- **Where:** `run-all-221.sh` -> `216 no-regression` leg -> `216-03 gate:
  shape declaration (strict)` (`node scripts/check-shape-declaration.cjs
  --check --strict`). Phase 220's `220 no-regression` leg also RED-cascades
  from the same 216 chain.
- **Symptom:** SHAPE DECLARATION VIOLATION on several command surfaces that
  declare a `hitl_shape` (a genuine Decision-Gate fork) AND
  `connector.excluded:true` (the no-fork exemption) simultaneously:
  `commands/admin.md` (F.1), `commands/brain-derive.md` (F.0),
  `commands/correct-reference-now.md` (F.0), `commands/doctor.md` (F.0),
  `commands/dogfood-flush.md` (F.0), and others.
- **Proof it is pre-existing and NOT caused by cu8:** reproduced identically on
  a clean worktree at the parent commit `bba2decd` (before either cu8 commit),
  same violations, `--check --strict` exit 1. quick 260715-cu8 touched only
  `scripts/entity-extract.cjs` and the 219 tests; it never touched `commands/*`
  or `scripts/check-shape-declaration.cjs`. The flagged command files last
  changed in commit `2b92c252`.
- **cu8 scope is green:** the regression this quick task targets
  (`test-219-metadata` Test 2) is fixed; `run-all-218.sh` (PASS, FAIL=0),
  `run-all-219.sh` (PASS=13, FAIL=0), and the new
  `test-219-low-confidence-disclosure.cjs` (4/4) are all green.
- **Disposition:** deferred. A separate debug/quick task should reconcile the
  HITL shape declarations on those command surfaces (Canon Part 11 R16: a
  render-only or pure-capability surface is exempt via `connector.excluded:true`
  + reason, never via a fork it does not have). Not fixed here to avoid scope
  expansion.
