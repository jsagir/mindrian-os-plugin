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

## From 219-05 (explore-chain executor, 2026-07-13)

1. **doctor --acceptance `verify-release-clean-tree` FAIL persists: 5-file
   tracked drift owned by concurrent sibling sessions** (commands/eureka.md,
   evals/plurai/211-baseline.json, package-lock.json,
   scripts/eureka-command.cjs, skills/eureka/SKILL.md; plus untracked
   eureka/brain-ingest artifacts and the just-appearing Phase 221 files
   lib/core/recovery/ + tests/run-all-221.sh). Zero overlap with the 219-05
   diff; not staged, not touched. The point clears when those sessions
   commit. Every other acceptance point passes (14/15 after the 219-05
   post-mirror connector + render-coverage regens).

2. **`tests/test-131-e2e.cjs` fails 0/5 at clean HEAD** (verified against the
   committed tree with the 219-05 diff removed): a pre-existing 131 e2e
   failure unrelated to the D-19 driver envelope (the driver-unit suite
   `test-131-source-lens-driver.cjs` and `test-intelligence-research-pipeline`
   are green with the envelope in place). Left for its own debug session.

## From 219-06 (live ador re-run executor, 2026-07-13)

1. **Part 8 five-tripwire sensor sweep NOW RED: sibling-owned SENS-15 file
   trips the blunt forbidden-hash regex.** `node tests/test-sensors-part8-sweep.cjs`
   went from `1 passed, 0 failed over 18 file(s)` (219-06 prior leg) to
   `0 passed, 1 failed over 19 file(s)`. The one new file is
   `lib/core/sensors/sensor-url-ingest.cjs` (SENS-15, the 220-03 pasted-URL
   sensor, commit b6562f87 `feat(220-03)`), which the sweep now spans because
   its scan is `lib/core/sensors/*` glob-automatic. The failing assertion:
   `sensor module carries zero Brain egress ... must not match forbidden hash
   call: /\bsha256\b/i`. Root cause: line 214 `crypto.createHash('sha256')`
   is used to build a 12-hex URL HANDLE (`first_url_handle`) - which is the
   Part-8-COMPLIANT behavior (a bare hostname + hashed handle, never the full
   URL, per the module's own header lines 55-60) - but the sweep's forbidden-
   token regex is a blunt `/\bsha256\b/i` word-match that cannot distinguish a
   Part-8 handle-minting hash from an actual egress hash. Zero overlap with any
   219 file (219-06 modifies only 219-VERIFICATION.md). Two owning surfaces,
   neither this plan: (a) 220-03 (the SENS-15 author) - either mint the handle
   through the sanctioned handle helper or add the sensor to a sweep carve-out;
   or (b) the sweep itself (`tests/test-sensors-part8-sweep.cjs`) - narrow the
   regex so a handle-minting hash is not a false positive (this is the
   over-enforcement class the recent `check-card-fire.cjs` instances logged).
   Recorded honestly: 219-06 must_have truth 6 ("Part 8 five-tripwire boundary
   scan green") is NOT green on this shared tree, solely from this sibling file.
   NOT patched here per the scope boundary.
