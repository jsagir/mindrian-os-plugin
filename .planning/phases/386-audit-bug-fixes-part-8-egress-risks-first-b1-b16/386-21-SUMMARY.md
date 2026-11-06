---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "21"
subsystem: phase-closeout
tags: [closeout, changelog, knowledge-base, commit-review, push-gate]
requires: [386-01, 386-47]
provides:
  - 386-OUTCOMES.md with one row per finding ID
  - 36 hidden-tag Fixed bullets in CHANGELOG.md
  - 35 resolved RCA files in .planning/debug/resolved with knowledge-base blocks
  - 386-COMMIT-REVIEW.md with the guard fingerprint for the push gate
key-files:
  created:
    - .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-OUTCOMES.md
    - .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-COMMIT-REVIEW.md
  modified:
    - CHANGELOG.md
    - .planning/debug/knowledge-base.md
    - 7 tests under tests/test-386-*.cjs (RCA path fallback)
decisions:
  - "B3-OP is HANDED-OFF (owner chose unwire; plan 386-08 is a recorded skip; plan 385-12 R2 holds the ruling)."
  - "B12 is SKIPPED (owner chose option-a, keep as a planned contract, no code change)."
  - "B8 and B10 were reproduced, so they are FIXED, not DROPPED."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 21: Phase close-out Summary

Phase 386 is closed on the record. 41 finding rows: 36 FIXED, 4 HANDED-OFF or SKIPPED (B3-OP, B12, B15, E-PINE) and 1 NOT-MEASURED (S3). Nothing is PENDING-DECISION, PARTIAL or DROPPED. Nothing was pushed, tagged or released. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited (the plan forbids it).

## What was done

- `386-OUTCOMES.md`: one row per ID in plan order, each with a status word and the fix or reason. Statuses were built from the 46 plan summaries and the git log.
- `CHANGELOG.md`: a new `### Fixed` list in the Unreleased section with exactly 36 bullets, each ending with a hidden tag `<!-- 386-<ID> -->`, one per FIXED row and none for other rows. The empty placeholder bullet and the Phase 387 line were not touched. No version was bumped.
- `.planning/debug/knowledge-base.md`: 35 blocks, one per resolved RCA, in the format of the existing blocks.
- 35 RCA files: status set to resolved and moved with `git mv` to `.planning/debug/resolved/`. RCAs of non-FIXED rows (operator update, supersession gate, command telemetry, Pinecone) stay in `.planning/debug/`. Both older PENDING files (`part8-egress-guard-blocks-pws-brain-mcp-unconditionally`, `part8-egress-guard-under-blocks-key-shape-and-spelled-money`) are resolved and moved; the spelled-money part is decided as not blocked under the owner principle.
- `386-COMMIT-REVIEW.md`: the Not fixed rows, the guard fingerprint, guard commit and plugin version, the deferred lines, the accepted-sprout-negatives line, the probe-private-sprouts-released line, the Part 8 principle check with final outcomes, the suite results, and 214 phase commits with file lists (5 without a plan label are marked UNEXPECTED, 43 files outside a plan list are marked for a look).

## Deviations from Plan

**1. [Rule 1 - Bug] Seven tests read their RCA file at the old path**
- **Found during:** Task 2, first run of `bash tests/run-all-386.sh` (PASS=30 FAIL=7).
- **Issue:** the RCA moves in Task 1 broke test-386-folder-memory-lazy-timeline, identifier-forms, over-blocking-narrowed, sprout-body-shape, sprout-guidance, sprout-split-route and web-credential-hook.
- **Fix:** each test tries `.planning/debug/<name>` and then `.planning/debug/resolved/<name>`.
- **Files modified:** the 7 test files above.
- **Commit:** 73d6cef3c. run-all-386 is PASS=37 FAIL=0 after it.

**2. The Task 1 verify line cannot pass as written for dashes**
- `CHANGELOG.md` (107 lines) and `knowledge-base.md` (4 lines) already held em dashes from older entries. This phase added none, so the added lines were checked on their own.

**3. B3-OP wording**
- The caller listed both "HANDED-OFF (B3-OP unwired)" and "SKIPPED (386-08 recorded skip)". One row cannot hold two words, so B3-OP is HANDED-OFF and its detail names the recorded skip. B12 carries SKIPPED.

## Verification (final tree, guard commit 73d6cef3c)

- run-all-386 PASS=37 FAIL=0; run-all-196 7 of 7; test-3692-guard-survey-gate GATE PASS; connector registry, orchestration projection and render coverage checks pass; `doctor --acceptance` 25/25.
- run-all-245: one flaky red on the first run (test-245-egress-contentless), PASS=19 FAIL=0 on the rerun; the test also passed 3 of 3 alone. Cause UNVERIFIED.
- Known reds, unchanged: run-all-3692 (3: rs-fetcher academic, mux card before answer, no new dependency), run-all-252 (census.1, census.5b), run-all-366 (leg 380 gate wiring). Details are in the commit review.
- The listed reds were not re-run on the commit before the first 386 commit; they match the owner's known-red list.

## Commits

- f0b2e99bd docs(386): changelog, knowledge base and resolved RCA files
- 73d6cef3c fix(386-21): tests read a resolved RCA from .planning/debug/resolved
- the commit review commit (docs(386): commit review for the push gate)

## Known Stubs

None.

## Threat Flags

None.
