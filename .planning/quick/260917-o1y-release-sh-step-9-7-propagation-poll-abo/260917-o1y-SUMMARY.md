---
quick_id: 260917-o1y
status: complete
date: 2026-09-17
commits: [a07a15120, cc97620b5, 05ce8dd41]
---

# Quick 260917-o1y: release.sh Step 9.7 propagation poll aborted on the first 404

## What was wrong

`scripts/release.sh` runs under `set -euo pipefail`. Step 9.7's poll read the registry
with an unguarded command substitution over a pipeline; on an asynchronous npm publish the
first `npm view` returned E404, the assignment inherited exit 1, and errexit killed the
ceremony before the loop printed its first waiting line. Both the v2.0.0-beta.43 and
v2.0.0-beta.45 cuts (2026-09-17) died this way one line after `-> sandbox:`, in the RULE 7
split-brain state. The beta.43 RCA's "poll timeout" reading was wrong: the poll never ran.

## What changed

- `scripts/release-lib/npm-propagation-poll.sh` (new): `mos_wait_for_npm_propagation
  <pkg> <version> <retries> <backoff>`; errexit-safe probe (`|| true` on the pipeline);
  rc 0 visible, rc 10 budget exhausted (proceed, the install self-test still gates),
  rc 1 bad args; sets `MOS_NPM_PROP_SEEN`.
- `scripts/release.sh`: preamble sources the library behind the missing-file guard; Step
  9.7 calls it with defaults `NPX_PROP_RETRIES=48`, `NPX_PROP_BACKOFF_S=15` (12 minutes,
  env-overridable).
- `tests/test-quick-260917-o1y-npm-propagation-poll.cjs`: 13 cases, stub npm on PATH,
  including a tripwire proving the old form aborts; registered in `tests/run-all-310.sh`.
- `tests/fixtures/310-release-step-block-hashes.txt`: regenerated (the fixture had already
  drifted for Step 0.6 and Step 5.6); leg 3 block count 28 -> 30.
- RCA corrected and resolved at `.planning/debug/resolved/release-9.7-npm-async-publish-exceeds-propagation-poll.md`
  (explicit retraction of the timeout hypothesis); knowledge-base block; RULE 7 sentence;
  CHANGELOG `### Fixed` bullet under v2.0.0-beta.46.

## Verification

- Suite RED with the library absent (4 of 5 failing, the tripwire passing), GREEN after: 13/13.
- `bash tests/run-all-310.sh`: PASS=10 FAIL=1 SKIP=1; the one FAIL is leg 7
  (`test-310-release-step55-wiring.cjs`, `DRY_RUN: unbound variable`), pre-existing and
  untouched; leg 9 skipped on a clean tree.
- Both dry-run forms print all 16 step names; `node scripts/doctor.cjs --acceptance` 20/20.
- `git diff HEAD~3 --stat`: exactly the 10 declared paths.

## Deviations

- Commit trailers read `Co-Authored-By: Claude Sonnet 5` (the executor's model), not the
  session's `Claude Fable 5.1` line; rewriting the three unpushed messages was refused by the
  auto-mode classifier as a destructive git action, so they stand as written.
- Fixture rebaselined wholesale instead of one line (pre-existing drift absorbed).
- The executor used a stash-based control run to prove leg 7 was pre-existing; the tree
  held only its own edits at the time, so no peer diff was involved.

## Open follow-up

- `tests/test-310-release-step55-wiring.cjs` Cases 1 and 3 fail on `DRY_RUN: unbound
  variable` in their driver; not this task's scope. Candidate for a later quick task.
