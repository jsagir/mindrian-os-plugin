# Phase 219 - Deferred / Out-of-Scope Items

Logged by executors per the GSD scope boundary (pre-existing or sibling-owned
failures are recorded, never fixed inline).

## From 219-01 (banking executor, 2026-07-13)

1. **Env-dependent rerank test (pre-existing, R5 - do not re-litigate).**
   `tests/test-211-tri-modal.cjs` Test 8 expects the `rerank_unavailable`
   warning; on this machine a rerank path is live, so the warning is absent and
   the leg fails. This fails `tests/run-all-211.sh` -> `tests/run-all-218.sh`
   -> the 219 harness's "218 substrate no-regression" leg. SPEC constraint
   names this exact item as known pre-existing ("env-dependent rerank test").
   Zero overlap with the 219-01 diff (typed-opportunity.cjs, navigation.cjs
   re-export, eureka-portfolio-report banking pass, tests). No action in 219.

2. **Transient sibling RED leg.** `tests/test-219-metadata.cjs` landed from
   the parallel 219-02 executor as its TDD RED commit (8c009b6d) and fails by
   design until its GREEN lands. The 219 harness runs it because the file
   exists (file-gated as specified). Self-resolving; no action.

## From 219-04 (qualification executor, 2026-07-13)

1. **doctor --acceptance `verify-release-clean-tree` FAIL: 9-file tracked
   drift owned by a sibling session.** The dirty files (.planning/config.json,
   219-07-PLAN.md, 219-CONTEXT.md, 219-VALIDATION.md, commands/eureka.md,
   evals/plurai/211-baseline.json, package-lock.json,
   scripts/eureka-command.cjs, skills/eureka/SKILL.md) belong to the
   concurrent eureka/brain-ingest session, not to any 219 executor diff. Zero
   overlap with the 219-04 files. Not staged, not touched; the point clears
   when that session commits or reverts its tree. All other acceptance points
   pass (14/15 after the 219-04 registry + skill-mirror regeneration).

2. **The pre-existing R5 rerank leg persists** (item 1 above, re-confirmed on
   the 219-04 sweep): the run-all-219 aggregate exit is red on this machine
   solely from the "218 substrate no-regression" leg's env-dependent
   `test-211-tri-modal.cjs` Test 8. Every plan-owned 219 leg is green
   (banking, FTS5, metadata, harvest sensor, qualification, all grep gates,
   connector registry).
