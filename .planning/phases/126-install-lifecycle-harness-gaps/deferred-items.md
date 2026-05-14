# Phase 126 -- Deferred Items

Items discovered during Phase 126 plan execution that are OUT OF SCOPE for the
plan that surfaced them. These are NOT fixed in the surfacing plan; they are
logged here for routing to the right phase/plan/owner.

Format: one entry per item with (surfacing-plan / what / why-out-of-scope / suggested-routing).

## 2026-05-14 -- Test acc.5 in tests/test-doctor-acceptance.cjs (release.sh Step 9 / 9.6 ordering) -- RESOLVED 2026-05-14

- **Surfaced by:** Plan 07 (install-state schema v2 migration) regression sweep.
- **What:** `node tests/test-doctor-acceptance.cjs` Test acc.5 fails with:
  ```
  Step 9.6 must appear after Step 9 (push); got 9@29615 / 9.6@22082
  ```
  Step 9.6 (offset 22082) appears in `scripts/release.sh` BEFORE Step 9 (offset 29615); the test expects 9.6 AFTER 9. The other 5 sub-tests (acc.1-4 + acc.6) PASS (5/6 PASS).
- **Why out of scope (was):** This was a pre-existing failure unrelated to Plan 07.
- **Resolved by:** Plan 04 commit efee3a2 (2026-05-14). Plan 04 RENAMED the old Step 9.6 (doctor --acceptance full, the block the test was tracking) to Step 9.8 to make room for the new Step 9.6 (install-minisite HARD lockstep) and Step 9.7 (npx-publish self-test). `tests/test-doctor-acceptance.cjs` lines 28/277/280/281 updated for the rename: `off96` -> `off98` literal + variable rename + assertion-message update. Test acc.5 now PASSES because the post-publish full --acceptance block lives at Step 9.8 (after Step 9 push at offset 29615); the new Step 9.6 (install-minisite block at offset 22082) is positionally appropriate for the pre-push minisite sync. All 6/6 sub-tests GREEN.
