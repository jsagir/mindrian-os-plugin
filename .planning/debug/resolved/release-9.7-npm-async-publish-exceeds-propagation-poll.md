---
status: resolved
kind: rca
trigger: "release-9.7-npm-async-publish-exceeds-propagation-poll"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: []
---

## Current Focus

Resolved. The proven cause was `set -euo pipefail` at `scripts/release.sh:86` plus an
unguarded command substitution in the old Step 9.7 poll (old line 1211): an npm E404 (the
registry still processing an asynchronous publish) made the pipeline exit 1, the assignment
inherited that status, and errexit killed the ceremony before the loop printed its first
"waiting for npm registry" line -- the poll never ran a second iteration, on either the
beta.43 or the beta.45 cut. The earlier "the poll ran and timed out" hypothesis is retracted
(see the RETRACTED subsection under Technical Root Cause). Fixed by extracting the poll into
an errexit-safe `scripts/release-lib/npm-propagation-poll.sh` (quick task 260917-o1y), raising
the budget to 48 x 15s, and rebaselining the affected test fixtures. Ships beta-first in
v2.0.0-beta.46 (RULE 6).

## Meta

- Filed: 2026-09-17 by the session that cut v2.0.0-beta.43.
- Resolved: 2026-09-17 by quick task 260917-o1y.
- Source-of-Truth Preamble:
  - CODE claims read against: `origin/main` @ d00fd2be2 (`scripts/release.sh` Steps 9.5, 9.7, 7.5-11; `scripts/release-lib/verify-tag-push.sh`; `scripts/release-lib/theo-notify-gate.sh`) for the original filing; resolution reads against the same repo checkout after quick task 260917-o1y's three commits landed.
  - WIRE claims probe against: registry.npmjs.org package document for `@mindrian_os/cli` (full and abbreviated endpoints), read live 2026-09-17 09:59-10:04 UTC (beta.43) and again around 14:05-14:13 UTC (beta.45); npm's `support@npmjs.com` publish notifications.
  - Date of audit: 2026-09-17.
  - Classification: NEW FAILURE (release infrastructure), not a package break. RULE 3 false-alarm class is adjacent but distinct: the self-test correctly found a version that did not yet exist -- except on beta.43/beta.45 it never even ran the poll loop enough to say so out loud.

## Problem Statement

`release.sh` Step 9.5 publishes, npm's client returns success with the notice "Your package
is being processed and may take a few minutes to become available", and Step 9.7's
propagation poll aborted the whole ceremony on the FIRST failed probe instead of waiting,
because the poll's command substitution ran under `set -euo pipefail` with no guard against
its own expected-to-fail case. The self-test looked like an honest `notarget` abort but was
actually an errexit kill before the loop ever printed a waiting line, leaving the ceremony in
the RULE 7 split-brain state (local Commit A + tag + marketplace commit; npm and website
public) with Steps 7.5 through 11 unrun and no resume path in the script.

## Symptoms

- 2026-09-17 09:53 UTC (12:53 local): `npm publish` returned `+ @mindrian_os/cli@2.0.0-beta.43`
  and the "being processed" notice; `npm dist-tag add` returned `+latest`.
- 09:58:03 UTC: Step 9.7 aborted (exit 1) after the sandbox line; the ceremony ended. ZERO
  "waiting for npm registry" lines appeared anywhere in the log.
- 09:59-10:02 UTC: registry document (full and abbreviated) carried no `2.0.0-beta.43`,
  dist-tags `next`/`latest` = `2.0.0-beta.41`, `time.modified` = 2026-09-16T06:22:18Z.
- 10:03:13 UTC: version appeared; dist-tags flipped to `2.0.0-beta.43`; npm's
  "Successfully published" email timestamped 10:03:13.137Z. Elapsed publish-to-visible:
  about 10 minutes. For beta.41 (2026-09-16) the same email arrived 1 second after publish.
- npm status page 2026-09-17: all operational; two "Package Publish Degradation" incidents
  resolved 2026-09-15.
- SECOND OBSERVATION, v2.0.0-beta.45, same day: published 14:05:13 UTC; Step 9.7 aborted
  14:09:24 UTC, one line after `-> sandbox: ...`, again with ZERO waiting lines; the version
  became visible in the registry by 14:12:56 UTC (about 8 minutes elapsed). The
  `NPX_PROP_RETRIES` / `NPX_PROP_BACKOFF_S` overrides deliberately set for this cut (in direct
  response to the beta.43 filing, expecting a longer poll to help) were completely inert --
  the abort happened before the loop consulted either variable's value for a second time, so a
  wider budget changed nothing. This is the single clearest piece of evidence that the poll
  was never actually iterating: an override that changes a loop's behavior only if the loop
  runs more than once produced zero observable difference.

## Scope and Impact

- Surface: the release ceremony only (operator CLI). No user impact: `@latest` never pointed
  at a missing version (the dist-tag flip landed together with the version) on either cut.
- Impact on the operator: manual completion of Steps 7.5, 9, 5.5, 5.6, 9.8, 10, 11 per RULE 7
  and the script's own "resume by running Commit B + push manually" hint, with two helper
  functions (`mos_verify_tag_at_origin`, `mos_theo_notify_gate`) whose in-script call
  signatures had to be read to invoke them by hand, on BOTH the beta.43 and beta.45 cuts.

## Eliminated

- Package break: RULE 3 assertion passed once the version was visible (install rc 0,
  `bin/cli.js` present and parses, `.bin/mindrian-os` linked, 7,622 files).
- Local npm cache: a first RULE 3 attempt reused a cache directory that had memoised the
  pre-publish packument and reported `notarget`; a fresh cache with `--prefer-online`
  passed. Distinct from the registry-side latency, worth its own note in the self-test
  (always a fresh cache dir).

## Evidence

- 2026-09-17: ceremony log (scratchpad `release-real.log`), Steps 9.5-9.7 excerpts as in
  Symptoms; registry polls at 09:59:39, 10:00:10-10:02:16 (six polls, unchanged), 10:03:xx
  (present); Gmail thread "Successfully published @mindrian_os/cli@2.0.0-beta.43" at
  10:03:13Z; manual completion: Commit B d00fd2be2, pushes, tag at origin on 277073ce3,
  Theo dispatch SENT (audit line in `~/.mindrian/theo-notify-log.txt`), `doctor --acceptance`
  20/20 at 10:06:40Z.
- 2026-09-17, beta.45: identical shape -- abort one line after the sandbox line, zero waiting
  lines, the two env overrides confirmed set in the operator's shell before the run and
  confirmed to have made no observable difference to the abort timing or the log content.
- Quick task 260917-o1y reproduction (2026-09-17, verified live against the real npm
  registry, not a stub): `bash -c 'set -euo pipefail; X="$(npm view "@mindrian_os/cli@9.9.9-nope" version 2>/dev/null | tr -d "[:space:]")"; echo reached'`
  exits 1 and prints nothing (not even "reached") -- the exact abort shape seen in both logs.
  Appending `|| true` to the `tr` pipeline makes the same command print "reached" and exit 0,
  confirming the fix's mechanism.

## Technical Root Cause

`scripts/release.sh:86` runs the whole script under `set -euo pipefail`. The old Step 9.7 poll
(old line 1211) read the registry document with:

```
PROP_SEEN="$(npm view "@mindrian_os/cli@$NEW_VERSION" version 2>/dev/null | tr -d '[:space:]')"
```

Under `pipefail`, a pipeline's exit status is non-zero if ANY stage fails, regardless of
position; here `npm view` exits 1 on an E404 (the registry has not yet indexed the just-
published version) while `tr` itself always exits 0, so the pipeline's status is `npm view`'s
1. That status propagates onto the `PROP_SEEN=` assignment. Under `errexit`, a failing
assignment statement kills the shell immediately -- BEFORE the `if [ "$PROP_SEEN" = ... ]`
check, BEFORE the `echo "  ... waiting for npm registry..."` line, and before the loop's
`PROP_ATTEMPT` counter is ever incremented. The whole ceremony dies on the very first probe
attempt, in total silence about what actually happened: no waiting line, no retry count, no
indication the poll ever started.

Live reproduction (2026-09-17, against the real npm registry, no stub):
`bash -c 'set -euo pipefail; X="$(npm view "@mindrian_os/cli@9.9.9-nope" version 2>/dev/null | tr -d "[:space:]")"; echo reached'`
exits 1 and prints nothing, "reached" included -- proving the abort happens before any
further script line runs. Appending `|| true` after the `tr` pipeline (forcing the
substitution's own status to 0 regardless of `npm view`'s result) makes the identical command
print "reached" and exit 0: the E404 becomes a value read (an empty string), not a shell
abort. This is the entire fix's mechanism, extracted into
`scripts/release-lib/npm-propagation-poll.sh`'s `mos_wait_for_npm_propagation`.

### RETRACTED: the beta.43 poll-timeout hypothesis

The original filing's `Required Code Changes` section hypothesized that "the propagation
poll... was sized for the previous synchronous registry behaviour... and is shorter than
npm's current asynchronous publish processing" -- i.e. that the poll RAN, exhausted its
retries, and correctly gave up too early. That reading is WRONG and is retracted here.

Evidence that refutes it:
- Both the beta.43 log (09:58:03 UTC) and the beta.45 log (14:09:24 UTC) end ONE LINE after
  `-> sandbox: ...` with ZERO "waiting for npm registry" lines. A poll that ran out its
  budget would have printed at least `NPX_PROP_RETRIES - 1` waiting lines (12 - 1 = 11, at the
  time-of-filing default) before giving up; it printed none.
- The `NPX_PROP_RETRIES` / `NPX_PROP_BACKOFF_S` overrides deliberately set before the beta.45
  cut -- specifically to test whether a longer budget would help, in direct response to the
  beta.43 filing -- produced ZERO observable difference in when or how the ceremony aborted.
  A budget override only changes behavior if the loop consults it more than once; it never
  did.
- Both facts are consistent ONLY with the loop dying on its very first iteration, before
  printing anything or reading either override a second time -- exactly what the errexit
  mechanism above predicts, and inconsistent with a poll that ran to completion and then
  timed out.

The poll never ran once, on either cut.

## Required Code Changes

Implemented, quick task 260917-o1y (three commits, all beta-first per RULE 6, all landed
2026-09-17):

- Change 1:
  - Location: `scripts/release-lib/npm-propagation-poll.sh` (new file)
  - Required behavior: extract the poll into `mos_wait_for_npm_propagation <pkg> <version>
    <retries> <backoff>`, whose version-read command substitution ends in `|| true` so the
    pipeline's exit status can never propagate under `set -euo pipefail`. Contract: rc 0 =
    visible (sets `MOS_NPM_PROP_SEEN`); rc 10 = budget exhausted, proceeds (unchanged
    behavior from before this fix: the install self-test still gates); rc 1 = missing or
    non-numeric arguments.
  - Short-term patch: none needed -- this IS the fix.
  - Long-term fix: n/a, this is the structural fix.
- Change 2:
  - Location: `scripts/release.sh` preamble (after the `theo-notify-gate.sh` source, before
    the first `# --- Step` header) and the Step 9.7 block.
  - Required behavior: source the new library behind the same missing-file guard as the
    other three release-lib sources; rewrite the Step 9.7 poll call site to invoke
    `mos_wait_for_npm_propagation` in the errexit-safe `|| PROP_RC=$?` form; raise
    `NPX_PROP_RETRIES` default to 48 and `NPX_PROP_BACKOFF_S` default to 15 (720s, about 12
    minutes, covering both the beta.43 ~10-minute and beta.45 ~8-minute observed latencies),
    still overridable via the same two env vars.

## Tests to Add or Update

- Test 1 (implemented):
  - Type: unit
  - Location: `tests/test-quick-260917-o1y-npm-propagation-poll.cjs`
  - Given: a stub `npm` that exits 1 (no stdout) on the first two calls and prints the target
    version on the third, run under `set -euo pipefail` with no other guard
  - When: `mos_wait_for_npm_propagation` is called directly (not via `|| true`)
  - Then: the driver survives (proves errexit did not kill it), prints exactly 2 waiting
    lines, prints one "registry propagated... (attempt 3)" line, returns rc 0, and sets
    `MOS_NPM_PROP_SEEN` to the version. A sibling case runs the OLD unguarded inline form
    against the SAME stub and asserts it aborts and never reaches an `echo reached` --
    the bug tripwire, proving the stub genuinely reproduces the failure.
  - Runner registration: `tests/run-all-310.sh` leg 11.
- Test 2 (implemented): budget-exhausted case (retries=2, backoff=0, stub always fails) --
  asserts rc 10, 2 waiting lines, a single timeout line naming the elapsed budget and
  "proceeding", and that the word "abort" never appears (timeout behavior is unchanged:
  proceed).
- Test 3 (implemented): a Case 6 static-assertion group reads `scripts/release.sh` directly
  and confirms the wiring landed (missing-file guard present, source line precedes the first
  Step header, the Step 9.7 block calls the function with the right literals, the block no
  longer contains a bare `npm view`, the `npx --yes` dry-run literal and at least one `exit 1`
  gate both survive).
- The existing dry-run coverage (`tests/test-release-bump-tag-and-publish-gates.cjs` Test 13,
  `scripts/doctor.cjs`'s `release-dry-run-output` acceptance point) still print the same
  planned ladder; both verified green after the fix.

## Non-Code Follow-ups

- Theo-side: the Step 0.6 stamp gate reported `mappedBy command-registry@2.0.0-beta.12`
  against expected beta.42 at the time of filing; `--no-theo-check` was the audited opt-out.
  Theo's consuming job had not restamped since beta.12 despite dispatches for beta.41 and
  beta.43 (both SENT, same registryHash 43d13474f802...). Owner: the Theo repo. Still open;
  out of scope for this RCA's own fix (the Step 9.7 poll defect), tracked separately.
- Website: the Vercel build of the FALLBACK_VERSION commit (d5229b0) completed at 09:54Z,
  nine minutes before npm exposed beta.43, so the rendered version stayed beta.41 until the
  next ISR revalidation. Still open as a general observation about ISR lag versus npm
  publish-to-visible latency; re-verify mindrian-os.com after any cut with a slow publish.
- CHANGELOG.md: `### Fixed` entry added under `## [Unreleased] -- v2.0.0-beta.46 (in progress)`
  in this same close-out commit.
- knowledge-base.md: summary block added as the newest entry in this same close-out commit.
- Release lockstep: this fix ships in v2.0.0-beta.46, the next beta cut; no version bump
  performed by this RCA close-out itself (RULE 6, beta-first for release infrastructure).

## Resolution

root_cause: `scripts/release.sh:86`'s `set -euo pipefail` plus an unguarded command
substitution in the old Step 9.7 poll made an npm E404 (registry still processing an
asynchronous publish) an errexit abort instead of a poll miss, killing the ceremony before
the loop's first iteration completed, on both the beta.43 and beta.45 cuts.

fix: extracted the poll into `scripts/release-lib/npm-propagation-poll.sh`'s
`mos_wait_for_npm_propagation` (version-read ends in `|| true`, rc 0/10/1 contract, global
`MOS_NPM_PROP_SEEN`); sourced it in the release.sh preamble behind the standard missing-file
guard; rewired the Step 9.7 call site to the errexit-safe `|| PROP_RC=$?` form; raised the
default budget to 48 x 15s (720s, about 12 minutes), still overridable via
`NPX_PROP_RETRIES` / `NPX_PROP_BACKOFF_S`; on timeout the behavior is unchanged from before
this fix -- proceed, the install self-test still gates.

verification: `bash -n scripts/release.sh && bash -n scripts/release-lib/npm-propagation-poll.sh`
clean; `node tests/test-quick-260917-o1y-npm-propagation-poll.cjs` 13/13 (5 library cases + 8
Case-6 wiring assertions); `node tests/test-release-bump-tag-and-publish-gates.cjs` 15/15
(unchanged, including Tests 10/11); `bash scripts/release.sh --prerelease --dry-run
--allow-ahead --no-theo-check` and `bash scripts/release.sh patch --dry-run` both print all
16 step names the `release-dry-run-output` acceptance point asserts; `node scripts/doctor.cjs
--acceptance` reports `release-dry-run-output` and `harness-policies` both PASS. This RCA's
own fixture-drift discovery (`tests/fixtures/310-release-step-block-hashes.txt` and the leg-3
block count in `tests/run-all-310.sh` were already stale from unrelated, already-merged
Phase 343 and Phase 349 work) was absorbed into the same rebaseline, documented in both
files' own comments; `tests/run-all-310.sh` reports PASS=11 FAIL=1 SKIP=0, the one remaining
failure (leg 7, Step 5.5 wiring suite) confirmed pre-existing and unrelated via a stash-based
control run with this fix's own edits fully reverted -- left untouched, out of this fix's
scope.

files_changed:
  - scripts/release-lib/npm-propagation-poll.sh (new -- the errexit-safe poll)
  - scripts/release.sh (preamble source guard + Step 9.7 rewire, budget 48x15s)
  - tests/test-quick-260917-o1y-npm-propagation-poll.cjs (new -- 13 cases)
  - tests/run-all-310.sh (leg 11 registration; leg-3 block count 28 -> 30, absorbing
    pre-existing Step 0.6/Step 5.6 drift)
  - tests/fixtures/310-release-step-block-hashes.txt (wholesale rebaseline, absorbing
    pre-existing PREAMBLE/Step 0/Step 1/Step 0.6/Step 5.6 drift plus this fix's own Step 9.7
    block)
  - .planning/debug/resolved/release-9.7-npm-async-publish-exceeds-propagation-poll.md (this
    file, moved from .planning/debug/)
  - .planning/debug/knowledge-base.md (summary block added)
  - docs/RELEASE-CEREMONY-RULING-SYSTEM.md (RULE 7 propagation-budget sentence)
  - CHANGELOG.md (beta.46 Fixed entry)

commits: quick task 260917-o1y, three commits (see CHANGELOG.md and git log for hashes).
