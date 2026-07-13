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

## RESOLVED (2026-07-13, direct fix during the 219-05 recovery pass)

Item 1 (219-01) / item 2 (219-04), the R5 pre-existing rerank test, is
**fixed**, not merely worked around. Root cause: `test-211-tri-modal.cjs`
Test 8 assumed `@huggingface/transformers` was absent on the host to
exercise the `rerank_unavailable` degrade path; once transformers.js was
installed (ambient machine state, unrelated to any 219/220/221 diff), the
assumption broke and the leg went red on every downstream regression sweep.
Fix mirrors the existing `MINDRIAN_FORCE_FTS_ABSENT` (tri-modal-index.cjs)
/ `MINDRIAN_FORCE_ENGINE_ABSENT` (219 D-20) idiom: added
`MINDRIAN_FORCE_RERANK_ABSENT` as a deterministic offline-test seam in
`lib/core/eureka/hybrid-retrieve.cjs::loadReranker` (throws before touching
the real dependency when set), and the test now sets/restores it around
the unavailable-path assertion instead of relying on host install state.
Verified: `node tests/test-211-tri-modal.cjs` 12/12 PASS;
`bash tests/run-all-211.sh` PASS=10 FAIL=0 SKIP=0 (was FAIL=1). This
un-poisons every downstream chain (`run-all-215/216/218/219/220`) that
regression-checks through 211. Not touched: the R5 SPEC constraint's OTHER
named item (the SQLite WAL-reset bug, bundled 3.51.2) - out of scope,
unrelated defect class, left exactly as documented.
