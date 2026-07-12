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
