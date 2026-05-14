# Phase 126 -- Deferred Items

Items discovered during Phase 126 plan execution that are OUT OF SCOPE for the
plan that surfaced them. These are NOT fixed in the surfacing plan; they are
logged here for routing to the right phase/plan/owner.

Format: one entry per item with (surfacing-plan / what / why-out-of-scope / suggested-routing).

## 2026-05-14 -- Test acc.5 in tests/test-doctor-acceptance.cjs (release.sh Step 9 / 9.6 ordering)

- **Surfaced by:** Plan 07 (install-state schema v2 migration) regression sweep.
- **What:** `node tests/test-doctor-acceptance.cjs` Test acc.5 fails with:
  ```
  Step 9.6 must appear after Step 9 (push); got 9@29615 / 9.6@22082
  ```
  Step 9.6 (offset 22082) appears in `scripts/release.sh` BEFORE Step 9 (offset 29615); the test expects 9.6 AFTER 9. The other 5 sub-tests (acc.1-4 + acc.6) PASS (5/6 PASS).
- **Why out of scope:** This is a pre-existing failure unrelated to Plan 07 -- verified by `git stash`-ing the Plan 07 working changes and re-running the test (still 5/6 FAIL on acc.5). The failure is in `scripts/release.sh` Step 9 / Step 9.6 ordering, not in `lib/core/install-state.cjs` or `scripts/session-start` (the surfaces Plan 07 modifies).
- **Suggested routing:** Plan 04 (`release.sh tag-push + install-minisite lockstep + npx-publish gates`) is the natural owner -- it already touches release.sh Step 5.5 + Step 9.6 + Step 9.7. Plan 04 should fold a Step-9-vs-9.6 ordering fix into its scope OR open a follow-up hotfix.
