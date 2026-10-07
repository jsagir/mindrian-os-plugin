---
phase: quick
plan: 261007-c6j
part: 1
status: partial
tasks_done: [1, 2]
tasks_pending: [3, 4, 5]
commits:
  - 0825bbb3c  # task 1, templates and module core
  - dc14333f5  # task 2, network pieces, prompt flow, dry-run, CLI
---

# Quick 261007-c6j Part 1: module and test (tasks 1 and 2)

STATUS: PARTIAL (tasks 1 and 2 done; tasks 3 to 5 not started)

CHANGED:
- scripts/release-lib/keyholder-notice.cjs (new, whole module, no process.exit call)
- scripts/release-lib/keyholder-notice/notice.txt and notice.html (PLACEHOLDER copies of the old drafts; the owner replaces them)
- tests/test-release-keyholder-notice.cjs (new, 49 checks, loopback stub only)
- Commits: 0825bbb3c (task 1), dc14333f5 (task 2)

VERIFIED:
- `node tests/test-release-keyholder-notice.cjs`: 49 checks passed.
- Task 2 verify command: exit 0. CLI with no TTY prints `reason=no_tty`, exit 0.
- Dry-run by hand with no env: prints the 6 allowed lines, sender REFUSED (api_key_unset), recipients unavailable, no network call.
- No em-dash or en-dash in the module or test. No literal address in either file.
- Baselines taken in $SCRATCH (scratchpad/c6j-exec): exit-1 count 70; 35 step blocks equal to the 341 fixture.
  Red on HEAD before this change: run-all-341 (FAIL=1, the 310 leg 3 block tripwire), run-all-310, tests/test-release-npm-gate.sh (missing @mindrian_os/install rename).
  Green: run-all-349 (PASS=14 FAIL=0), G3 to G5 node tests, G6 doctor point release-dry-run-output ok, G7, G8.
- F1: in-process SIGINT and SIGTERM arms (real signals) show: lock file gone, exit code 130 or 143, in-flight mail marked unknown_outcome, no further POST, handler removed after main returns, a foreign lock never touched.
- F2: refusal line prints in this order: lock file path, `pid N`, `age N s`, `pid alive: yes|no`, then the text `delete it by hand only after you confirm no run is active`. Test arm pins the order.
- Pty arm ran (the `script` command exists): question shown, answer n gives `reason=declined`.

UNVERIFIED:
- Live Resend domains answer and live Supabase admin users shape (stubs only).
- A real send.
- Pty arm for SIGINT (covered in-process only).
- Tasks 3 to 5 (release.sh wiring, doctor, 341 re-pin, docs, aggregator, gate comparison).

RISKS:
- The template files are old-draft placeholders. The Task 1 verify diff against draft/ will fail once the drafts change. The orchestrator pins new template paths and tests.
- Template content pins (four points, URL set, update commands, image and caption) were removed from the test by the orchestrator notice. Only generic arms remain: no em-dash or en-dash, no word Brain, no data: URI, alt text on every img, size under 51200 bytes, Subject parse, hash.
- The module source holds the string brain_api_keys (a table name, not mail text).
- Added a reason key `interrupted` to REASONS (17 keys, plan lists 16). Needed for the signal path (F1).
- Added two test hooks in deps: afterAccept (before the sent write) and afterSent (after it). The plan names one hook; the interrupted-run arm needs both.
- Signal exit code 130 or 143 is non-zero; release.sh prints a yellow line and the cut is unaffected (fail open).
- A second signal re-raises the signal with the handler removed (no process.exit).

## Deviations from Plan

1. [Rule 2 - Missing critical functionality] F1 and F2 added by the plan checker, implemented as specified.
2. [Orchestrator notice] Template-content test arms dropped, templates not re-copied. Placeholder copies from task 1 stay in the repo.
3. [Rule 3] `releaseLedgerLock` also requires that this process acquired the lock (in-process set), in addition to the pid match.

## Self-Check: PASSED
