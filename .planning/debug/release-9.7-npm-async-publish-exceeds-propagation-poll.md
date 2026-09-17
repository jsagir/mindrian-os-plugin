---
status: gathering
kind: rca
trigger: "release-9.7-npm-async-publish-exceeds-propagation-poll"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: []
---

## Current Focus

Observed once (2026-09-17, the v2.0.0-beta.43 cut). Next step: measure Step 9.7's actual
propagation poll budget (`NPX_PROP_RETRIES` x `NPX_PROP_BACKOFF_S`) against npm's current
asynchronous publish latency, and decide between a longer bounded poll, a poll on the
registry document's `time[NEW_VERSION]` instead of `npm view`, and a resumable tail
(Steps 7.5 through 11) so a post-publish abort on a healthy publish does not require manual
completion. Release-infra change: ships beta-first (RULE 6).

## Meta

- Filed: 2026-09-17 by the session that cut v2.0.0-beta.43.
- Source-of-Truth Preamble:
  - CODE claims read against: `origin/main` @ d00fd2be2 (`scripts/release.sh` Steps 9.5, 9.7, 7.5-11; `scripts/release-lib/verify-tag-push.sh`; `scripts/release-lib/theo-notify-gate.sh`).
  - WIRE claims probe against: registry.npmjs.org package document for `@mindrian_os/cli` (full and abbreviated endpoints), read live 2026-09-17 09:59-10:04 UTC; npm's `support@npmjs.com` publish notifications.
  - Date of audit: 2026-09-17.
- Classification: NEW FAILURE (release infrastructure), not a package break. RULE 3 false-alarm class is adjacent but distinct: the self-test correctly found a version that did not yet exist.

## Problem Statement

`release.sh` Step 9.5 publishes, npm's client returns success with the notice "Your package
is being processed and may take a few minutes to become available", and Step 9.7's
propagation poll then times out because the registry takes longer than the poll budget to
expose the version. The self-test aborts honestly on `notarget`, leaving the ceremony in the
RULE 7 split-brain state (local Commit A + tag + marketplace commit; npm and website
public) with Steps 7.5 through 11 unrun and no resume path in the script.

## Symptoms

- 2026-09-17 09:53 UTC (12:53 local): `npm publish` returned `+ @mindrian_os/cli@2.0.0-beta.43`
  and the "being processed" notice; `npm dist-tag add` returned `+latest`.
- 09:58:03 UTC: Step 9.7 aborted (exit 1) after the sandbox line; the ceremony ended.
- 09:59-10:02 UTC: registry document (full and abbreviated) carried no `2.0.0-beta.43`,
  dist-tags `next`/`latest` = `2.0.0-beta.41`, `time.modified` = 2026-09-16T06:22:18Z.
- 10:03:13 UTC: version appeared; dist-tags flipped to `2.0.0-beta.43`; npm's
  "Successfully published" email timestamped 10:03:13.137Z. Elapsed publish-to-visible:
  about 10 minutes. For beta.41 (2026-09-16) the same email arrived 1 second after publish.
- npm status page 2026-09-17: all operational; two "Package Publish Degradation" incidents
  resolved 2026-09-15.

## Scope and Impact

- Surface: the release ceremony only (operator CLI). No user impact: `@latest` never pointed
  at a missing version (the dist-tag flip landed together with the version).
- Impact on the operator: manual completion of Steps 7.5, 9, 5.5, 5.6, 9.8, 10, 11 per RULE 7
  and the script's own "resume by running Commit B + push manually" hint, with two helper
  functions (`mos_verify_tag_at_origin`, `mos_theo_notify_gate`) whose in-script call
  signatures had to be read to invoke them by hand.

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

## Technical Root Cause

Hypothesis, to verify against `scripts/release.sh` Step 9.7: the propagation poll
(`NPX_PROP_RETRIES` default 12 with a per-attempt backoff) was sized for the previous
synchronous registry behaviour (seconds) and is shorter than npm's current asynchronous
publish processing (observed ~10 minutes today, seconds yesterday). On timeout the step
"proceeds (the test still gates)", so it runs the install against a version the registry
does not yet expose and aborts. A second, smaller cause: the poll uses `npm view`, which
can read a memoised packument from the operator's cache.

## Required Code Changes

To be decided after measurement; candidates, all beta-first per RULE 6:
- Raise the bounded poll to cover the observed latency with a visible countdown (for
  example up to 15 minutes) and poll the registry document's `time[NEW_VERSION]` with a
  fresh cache or a direct HTTPS read, not `npm view` against the operator cache.
- Make the post-publish tail resumable: a `--resume-from-publish <version>` mode that
  re-verifies the publish (RULE 3) and runs Steps 7.5 through 11, so a post-publish abort on
  a healthy publish never needs hand-run steps.
- Document the manual completion sequence in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`
  RULE 7 with the two helper signatures, until the resume mode exists.

## Tests to Add or Update

- A unit test on the poll helper with an injected registry probe that returns "missing" for
  N attempts then "present", asserting the step waits rather than proceeding.
- The existing dry-run coverage must still print the same planned ladder.

## Non-Code Follow-ups

- Theo-side: the Step 0.6 stamp gate reported `mappedBy command-registry@2.0.0-beta.12`
  against expected beta.42 at this cut; `--no-theo-check` was the audited opt-out. Theo's
  consuming job has not restamped since beta.12 despite dispatches for beta.41 and beta.43
  (both SENT, same registryHash 43d13474f802...). Owner: the Theo repo.
- Website: the Vercel build of the FALLBACK_VERSION commit (d5229b0) completed at 09:54Z,
  nine minutes before npm exposed beta.43, so the rendered version stayed beta.41 until the
  next ISR revalidation; re-verify mindrian-os.com after the hour.

## Resolution

Open.
