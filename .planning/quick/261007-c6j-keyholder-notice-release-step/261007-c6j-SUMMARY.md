---
phase: quick
plan: 261007-c6j
status: complete
tasks_done: [1, 2, 3, 4, 5]
commits:
  - 0825bbb3c  # task 1, templates and module core
  - dc14333f5  # task 2, network pieces, prompt flow, dry-run, CLI
  - 5890214e0  # task 2b, new mail templates and content pins
  - 3e5c5b53c  # task 3, Step 9.9 wiring, expectedSteps, 341 re-pin
  - ccc8bb8e9  # task 2c, bcc batches
  - 198ecfb7c  # task 4, RULE 11, include section, CHANGELOG, aggregator
  - e64d236f5  # SUMMARY part 1
---

# Quick 261007-c6j: key-holder notice, release Step 9.9 (complete)

STATUS: DONE

CHANGED:
- scripts/release-lib/keyholder-notice.cjs (all logic; never calls process.exit)
- scripts/release-lib/keyholder-notice/notice.txt and notice.html (byte copies of draft/notice.txt and draft/notice-v5.html at commit 309d4419c)
- tests/test-release-keyholder-notice.cjs (64 checks, loopback stub only)
- scripts/release.sh (four flags, Step 9.9 block with no exit line, dry-run listing and preview)
- scripts/doctor.cjs (expectedSteps gains Step 9.9)
- tests/fixtures/341-release-step-block-hashes.txt (re-pinned: Step 0, Step 1, new Step 9.9, count 35 to 36)
- tests/run-all-349.sh (registers the test; em-dash guard covers the four new files)
- docs/RELEASE-CEREMONY-RULING-SYSTEM.md (RULE 11, runbook item 3 clause; RULE 5 untouched, still 9 numbered lines)
- .claude/includes/release-process.md (section "The key-holder notice")
- CHANGELOG.md (one Unreleased bullet; no peer diff existed)
- Commits: see the frontmatter. All are ancestors of HEAD (checked with git merge-base --is-ancestor).

VERIFIED (real output):
- Task 1 verify: test passes, both templates equal their drafts (plain diff), no em-dash.
- Task 2 verify: test passes; CLI with no TTY prints `reason=no_tty`, exit 0.
- Task 3 verify: bash -n ok; test ok; `step-block tripwire ... PASSED`; wiring test ok; 349 dry-run test ok; exit-1 count 70.
- Task 4 verify: test, test-349-docs-lockstep, test-369.1-release-lockstep, test-339-update-path-single-source, bash -n run-all-349, no em-dash: all pass.
- Task 5 verify (run as written): exit 0. It printed `erasable gate: PASS` and `PASS release-dry-run-output`, with run-all-349 FAIL not above baseline.
- Gate comparison (baselines in scratchpad c6j-exec, before-* and after-*):
  - run-all-349: before PASS=14 FAIL=0, after PASS=15 FAIL=0.
  - run-all-341: before and after both PASS=21 FAIL=1 SKIP=6; verdict lines identical. The step-block tripwire is now PASSED. The one failure is the 310 leg 3 tripwire (33 blocks against the old 310 fixture), red on HEAD before this change and not touched.
  - run-all-310: summary identical before and after (red on HEAD, not touched).
  - tests/test-release-npm-gate.sh: red before and after, same output (missing @mindrian_os/install rename).
  - Green before and green after: wiring test, 349 wiring, 349 dry-run, 349 docs lockstep, 366 suite gate, 353 wiring, 235 shape gate, muy real-room, 369.1 lockstep, 310 step55, bump-tag-publish gates, doctor-acceptance, doctor-acceptance-self-coverage, 339 update-path; G7 ts-check; G8 four coverage checks; G6 doctor point release-dry-run-output ok.
- Boundary: git diff over the six task commits shows no change to data/doctor-modules.json, any command, skill or agent file, or tests/fixtures/310-release-step-block-hashes.txt. Lines 1 to 79 of release.sh hash to 9f2cf894...601f (unchanged). Non-comment exit 1 count is 70.
- Sweep: zero em-dash or en-dash and zero address literals in all new and edited files. Zero occurrences of Brain in the templates. notice.html is 7779 bytes, notice.txt is 1794 bytes (limit 51200).
- F1: SIGINT and SIGTERM arms with real signals: lock file gone, exit code 130 or 143, in-flight batch marked unknown_outcome, no further POST, handler removed, a foreign lock never touched.
- F2: the ledger_locked line prints, in order, the lock path, `pid N`, `age N s`, `pid alive: yes|no`, and "delete it by hand only after you confirm no run is active". A test arm pins the order.

UNVERIFIED:
- Live Resend domains answer, live Supabase admin users shape, a real send, the hero image answering HTTP 200 (no network call was made for it).
- Whether Resend accepts 49 bcc addresses plus one To address. The Resend send-email reference (https://resend.com/docs/api-reference/emails/send-email, read 2026-10-07) documents "Max 50" for the `to` field only. It states no separate cap for bcc. BATCH_MAX = 49 is a conservative reading (to plus bcc at most 50). Confirm on a small live send before the first real cut.
- The `reply_to` field name was read from the same reference.
- Pty arm for SIGINT (covered in-process only); the pty arm for the answer n ran.

RISKS:
- PLAN.md content pins are STALE. The orchestrator replaced the mail content and the send model during execution. PLAN.md was not edited. No verify command depended on the stale text, and every verify command ran as written.
- Stale pins replaced in the test (the list below):
  - Four fixed points (old key retired, Theo needs no key, five numbered steps, tick the box on the home page): removed.
  - URL set with two claude.ai install URLs: now the website root, the article, and the hero image (html only).
  - The update block heading "Already installed? Update to the latest.": removed. The two update commands (read from update-path.cjs) and the npx command are pinned in both templates.
  - No version number, banned-word list (release, request, beta, status and others), the word version only inside claude --version: removed.
  - New pins: "30 minute", "Zoom", "Reply" in the invitation, the opt-out line `Reply "stop"`, the article URL only as link targets in html and once in the text, one hero img with https src, alt text, width and the caption.
  - "Service notice" wording: comments and the module header reworded. The exact question text `Send the key-holder service notice now?` and the dry-run step line stay as the plan pinned them. The orchestrator said to rename nothing. The owner may want to reword the question.
- The module header and test comments no longer say four points.
- A batch whose pending markers were only partly written stops the run before the POST. The unwritten members have no marker, the written ones stay pending (skipped on retry): a skipped person, never a duplicate.
- The Idempotency-Key of a batch is stable across a retry only when the retry batch has the same members.
- Signal exit codes 130 and 143 are non-zero. release.sh prints a yellow line and the cut is unaffected.
- The dry-run listing and the Step 9.9 header still say "key-holder notice" in release.sh; the question text keeps the words "service notice".

## Plan decisions changed by the bcc amendment (owner decision 2026-10-07)

- P-1 and the "one mail per person" rule (must_haves truth on recipients, the T-c6j-06 mitigation): the send is now batches, not one POST per person. Each message has To and Reply-To equal to the sender address and a batch in bcc. No recipient is ever in To or cc. The test arms for T-c6j-06 now assert this shape.
- Idempotency-Key rule (P-5, T-c6j-05): the key was the first 12 characters of the notice hash, a hyphen and 32 characters of the recipient marker. It is now the first 12 characters of the notice hash, a hyphen and the first 32 characters of the sha256 of the sorted member markers of the batch.
- Markers (P-5): still one per recipient. A pending marker is written for EVERY member of a batch before the POST, and the final state for every member after the answer. An unknown batch marks all members unknown_outcome.
- Retry filter and the "5 in a row" stop (P-8): batches are built only from people with no marker or a failed marker (plus unknown ones with --include-unknown). The streak counts batches. Counts in the output stay in people.
- T-c6j-05 residual: the one remaining window now covers a whole batch (all members pending), and a duplicate after --include-unknown is possible only if more than 24 hours passed or the retry batch has different members.
- Dry-run (P-7): the recipients line gains `batches=N batch_size=49`. It stays counts only.
- New constant BATCH_MAX = 49 with a comment citing the Resend doc page; no other batch limit was guessed.

## Deviations from Plan

- [Orchestrator] Mail templates and content pins replaced (task 2b); bcc batches (task 2c).
- [Rule 2] F1 and F2 from the plan checker, implemented as specified.
- REASONS has an extra key `interrupted` (17 keys). Test hooks `afterAccept` and `afterSent` exist in the deps (the plan names one). `releaseLedgerLock` also needs that this process acquired the lock.
- Test arms for the docs and the aggregator (task 4) were added after the docs were not yet written, then the docs were written (red, then green, in one commit).
- Task 3 wiring arms were added in the same commit as the wiring; the step block header text says "key-holder notice" rather than the plan's "service notice".

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. The module issues GET requests to Supabase only and POST to Resend only.

NEXT: Review. Run a small live send with one test address before the first real cut, to confirm the bcc limit and the sender check against a real Resend account.

## Self-Check: PASSED
