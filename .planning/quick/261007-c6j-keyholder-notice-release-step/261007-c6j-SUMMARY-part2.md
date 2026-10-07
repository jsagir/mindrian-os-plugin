---
phase: quick
plan: 261007-c6j
part: 2
status: complete
commits:
  - 37c6218f4  # part 2: 5 bcc batches, lowercase m:os templates, List-Unsubscribe, announcement wording
---

# Quick 261007-c6j Part 2

STATUS: DONE

CHANGED (commit 37c6218f4):
- scripts/release-lib/keyholder-notice.cjs: batch plan, List-Unsubscribe header, question text.
- scripts/release-lib/keyholder-notice/notice.txt and notice.html: byte copies of draft/ at commit 098c90bdf.
- tests/test-release-keyholder-notice.cjs: 65 checks.
- scripts/release.sh: question text in the Step 0 comment and the Step 1 listing line.
- tests/fixtures/341-release-step-block-hashes.txt: Step 0 and Step 1 hashes re-pinned again (count stays 36, Step 9.9 hash unchanged).
- docs/RELEASE-CEREMONY-RULING-SYSTEM.md (RULE 11), .claude/includes/release-process.md, CHANGELOG.md.

What was done:
1. Batches. `batchPlan(n)`: fewer than 5 recipients gives one person per batch. Otherwise 5 batches of ceil(n/5). If that exceeds BATCH_MAX (49), the module uses ceil(n/49) batches. The split is an even split of the sorted recipient list (first n mod count batches get one more person), so the same unmarked members always give the same batches. Plan tests: n = 0, 1, 3, 4, 5, 6, 100, 245, 246, 1000, with no batch above 49 and every person in exactly one batch. Dry-run and run lines print `batches=N batch_size=M` (counts only). The failure streak counts batches (test: 30 recipients, all 422, 5 batches posted, 30 people failed). The Idempotency-Key is still a hash of the sorted member markers; a test recomputes it for 2-person batches. Retry test: 10 recipients, batch 3 killed after accept; the retry mails the 4 unmarked people, none from the posted batches, in sorted order, and prints `already_mailed=4 unknown_skipped=2 to_send=4 batches=4 batch_size=1`.
2. Templates. Copied byte for byte. Pins: no `M:OS` in notice.txt; `m:os` in both; "Give complexity shape." in both after "Js."; the earlier pins are kept (article link, hero img, caption, update commands, 30 minute, Zoom, Reply, stop line, URL set, size, no em-dash, no Brain).
3. List-Unsubscribe. Every message has `headers: {"List-Unsubscribe": "<mailto:SENDER?subject=stop>"}`. SENDER comes from the module's From value (`fromAddress`). No address is hardcoded. A test checks the header on every stub POST, that it holds no recipient, and that it is the only extra header.
4. Question text is now "Send the key-holder announcement now?" in the module, the dry-run step line, release.sh, tests, RULE 11, the include and the CHANGELOG line. The 341 fixture was re-pinned (Step 0 and Step 1).

VERIFIED (real output):
- Task 1 verify rc=0. Task 2 verify rc=0 (`reason=no_tty`). Task 3 verify rc=0 (`step-block tripwire ... PASSED`, exit-1 count 70). Task 4 verify rc=0. Task 5 verify rc=0 (`G6 ok=true`, `PASS release-dry-run-output`).
- Gates against the baselines:
  - run-all-349: PASS=15 FAIL=0 (baseline PASS=14 FAIL=0).
  - run-all-341: PASS=21 FAIL=1 SKIP=6, verdict lines identical to baseline (the one failure is the 310 leg 3 tripwire, red on HEAD before).
  - run-all-310: summary identical (red before).
  - tests/test-release-npm-gate.sh: red, output identical to baseline.
  - All 14 node wiring and lockstep tests rc=0; G7 ts-check rc=0; G8 four checks rc=0.
- Lines 1 to 79 of release.sh unchanged (sha256 9f2cf894...601f). Non-comment exit 1 count 70.
- No em-dash and no address literal in the new files and the added CHANGELOG line (CHANGELOG has older em-dashes from other entries, none added). notice.html is 8078 bytes.
- Commit 37c6218f4 is an ancestor of HEAD.

UNVERIFIED:
- Live Resend (bcc limit, sender check, List-Unsubscribe acceptance in the headers field), live Supabase shape, a real send.
- The hero image answering HTTP 200.

RISKS:
- CONFLICT in the draft: draft/notice-v5.html line 19 has the HTML comment `<!-- what M:OS is: one paragraph -->`. It holds upper-case `M:OS`. I copied the file byte for byte, as told, so I could not remove it. The pin "zero M:OS" therefore reads the VISIBLE html (comments removed) for notice.html, and the whole file for notice.txt. The comment is part of the sent source but not shown to readers. To make the pin strict, edit the draft comment, re-copy, and change the test line `htmlVisible` to `htmlRaw`.
- Batch plan: with 113 recipients the plan is 5 batches of 23 (sizes 23,23,23,22,22). Each message still has one sender address in To.
- A retry rebuilds its own plan from the unmarked people, so retry batches differ from the first run's batches (smaller). A retry with --include-unknown can build a batch with different members than the first attempt, so the Idempotency-Key may differ; the 24-hour key protection then does not apply to that batch.
- The Resend documentation states "Max 50" for `to` only. The bcc cap is unconfirmed (see part 1).

NEXT: Edit the M:OS comment in draft/notice-v5.html (line 19) and tell me to re-copy and tighten the pin. Do a small live send with one test address before the first real cut.

## Draft comment conflict: CLOSED

The draft comment was fixed by the orchestrator (commit 78e56d7a5). notice.html was re-copied byte for byte and the pin now checks the raw file: zero `M:OS` in notice.txt and notice.html. Module test 65 checks pass; Task 1 and Task 3 verify commands rc=0 (341 step-block tripwire PASSED, no fixture change needed).

## Self-Check: PASSED
