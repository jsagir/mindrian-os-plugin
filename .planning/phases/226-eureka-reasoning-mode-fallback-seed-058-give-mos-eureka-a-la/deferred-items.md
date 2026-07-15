# Phase 226 deferred items (out-of-scope, pre-existing)

Discovered at plan 226-02 baseline (before any 226-02 change). These are pre-existing
failures unrelated to `scripts/eureka-portfolio-report.cjs` scoring; logged per the executor
SCOPE BOUNDARY rule, NOT fixed in this plan.

- `tests/run-all-216.sh`: `216-03 gate: shape declaration (strict)` FAILED and
  `216-03 gate: skill mirror` FAILED. CIRS/registry advisory-lint gates (Canon Part 11),
  unrelated to the eureka scoring path.
- `tests/run-all-219.sh`: `219-01 REQ-1 banking (writer + hook + no-bypass)` FAILED,
  `218-01 edge vocab + entity writer floor` FAILED, `218-01 entity-node writer (proposed-only)`
  FAILED, `218 substrate no-regression` FAILED. Phase 218/219 graph-write legs, unrelated to
  the additive reasoning-mode branch.

The relevant embedded-path regression oracles that WERE green at baseline and must stay green:
215-04 portfolio report (offline e2e), 215-05 field contract, 215-05 reproduction,
216-05 field contract, test-215-reproduction, test-226-null-legs.
