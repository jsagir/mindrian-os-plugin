---
phase: 391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar
plan: 03
subsystem: radar
tags: [radar, changelog, ask-first, egress, audit, tdd]

requires:
  - phase: 391-01
    provides: "lib/core/radar/changelog-slice.cjs (sliceChangelog, compareDotted, isDotted)"
provides:
  - "scripts/radar-changelog-slice.cjs: ask-first changelog fetch and slice CLI, run(argv, deps) exported"
  - "claude_changelog provider in WEB_PATH_PROVIDERS and WEB_PROVIDERS"
  - "tests/test-391-radar-fetch-script.cjs (arms F1 to F15)"
affects: [391-06]

tech-stack:
  added: []
  patterns:
    - "Phase 386 ask-first: --list, approval token, credential check, one audit record per request"
    - "Audit folder outside any room: HOME/.mindrian/radar-audit"
    - "Typed network failures: http_status, redirect_refused, size_cap, timeout, network"

key-files:
  created:
    - scripts/radar-changelog-slice.cjs
    - tests/test-391-radar-fetch-script.cjs
  modified:
    - lib/core/web-path-gate.cjs
    - lib/core/research-planner/egress-policy.cjs

key-decisions:
  - "Download failures print a JSON object {ok:false, reason, message} on stdout plus a line on stderr, exit 5"
  - "The audit record is written right after the GET, before the temp file work, with outcome ok or failed"
  - "--file mode writes no audit record (no request was made)"

requirements-completed: [CC391-H]

duration: 40min
completed: 2026-11-08
---

# Phase 391 Plan 03: Ask-first changelog fetch Summary

One script that reads the Claude Code changelog once behind the Phase 386 ask-first gate, cuts it by version header with the 391-01 slicer, and exits 4 with a reason when it did not read down to the ledger mark.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | 7d641e4ee | test(391-03): failing ask-first fetch-script test for the radar changelog read (RED) |
| 2 (GREEN) | 7dce93392 | feat(391-03): ask-first changelog fetch with coverage report for /mos:radar |

The SUMMARY and the state files go in a separate docs commit (same pattern as 391-01).

## RED output (script missing)

Command: `node tests/test-391-radar-fetch-script.cjs` - exit 1, 16 failures.

```
FAIL - F13: WEB_PATH_PROVIDERS lacks claude_changelog; WEB_PROVIDERS lacks claude_changelog
FAIL - F1: exit 1 ... Error: Cannot find module '.../scripts/radar-changelog-slice.cjs'
FAIL - F2: exit 1 (want 3); output does not say approval is needed; ...
FAIL - F3 ... F12, F15 (same cause)
SKIP - F14 (set MOS_RADAR_LIVE=1 for the list-only arm)

16 failure(s)
```

## GREEN output

Command: `node tests/test-391-radar-fetch-script.cjs` - exit 0.

```
ok - F13  ok - F1  ok - F2  ok - F3  ok - F4  ok - F9  ok - F9b default audit folder
ok - F5  ok - F5b allow-partial  ok - F6  ok - F7  ok - F8  ok - F10  ok - F11  ok - F12
SKIP - F14 (set MOS_RADAR_LIVE=1 for the list-only arm)
ok - F15

all arms passed
```

## Regression table

Baseline taken on the unedited tree before Part A, then re-run after.

| Leg | Before | After |
|-----|--------|-------|
| node tests/test-386-web-path-gate.cjs | pass | pass |
| node tests/test-386-semantic-scholar-approval.cjs | pass | pass |
| node tests/test-366-egress-policy.cjs | pass | pass |
| bash tests/run-all-386.sh | PASS=37 FAIL=0 | PASS=37 FAIL=0 |
| bash tests/run-all-196.sh | Passed 7, Failed 0 | Passed 7, Failed 0 |
| TEST_391_PREFIX=tests/test-391-radar bash tests/run-all-391.sh | n/a (new) | PASS=3 FAIL=0 (slicer test, fetch test, dash fence) |

Extra legs I ran because they scan scripts/ or the network surface:

| Leg | Result |
|-----|--------|
| tests/test-261029-kqv-stop-skip-recompute.cjs, test-380-status-parity.cjs, test-355-part8-egress.cjs | pass |
| tests/test-355-direction-agreement.cjs | FAIL, PRE-EXISTING (hits lib/core/rs-chain-feeder.cjs and lib/memory/test-rs-discovery-engine.cjs) |
| tests/test-346-catalogue-schema.cjs | FAIL, PRE-EXISTING (hook mechanism partition, arm 12) |
| tests/test-234-free-core-network-scan.cjs | FAIL, PRE-EXISTING (lib/mcp/tools/*, three files) |

PROVEN pre-existing: I checked out HEAD (before the GREEN commit, with the provider edits absent) in a temporary detached worktree under the scratch folder and ran the three tests there. All three exited 1. The worktree was removed. None of the three failure messages names a file from this plan.

## Allow-list search (Part 7 and the plan rule)

Commands run from the repo root:

1. `grep -lE "readdirSync\([^)]*scripts" tests/*.cjs tests/*.sh` - hits: test-261029-kqv-stop-skip-recompute, test-355-direction-agreement, test-346-catalogue-schema, test-380-status-parity. All four ran (table above). None of them enumerates network-calling scripts; the failures of 355-direction-agreement and 346 are pre-existing and unrelated.
2. `grep -nE "NETWORK_SCRIPTS|network.*allow|allow.*network|ALLOWED_NET" tests/*.cjs tests/*.sh scripts/doctor.cjs` - hits are test stubs that throw "network is not allowed" and one SSE static check. No list of allowed network scripts.
3. `grep -nE "network|fetch\(|https?\.request" scripts/doctor.cjs` - comments about zero-network tiers only. No scan of scripts/.
4. tests/run-all-355.sh mentions scripts only for dev-time `--check` replays.

Result: no scan flags the new script, so no allow entry was added. This also fits the plan's own note that test-234 scans lib/mcp/tools, not scripts/.

## Live fetch

The live fetch was NOT run. No test makes a real network call: every script run loads a counter with `node --require` that replaces globalThis.fetch. The one optional arm (F14, `MOS_RADAR_LIVE=1`) runs `--list`, which sends nothing, and it printed SKIP. The owner decides who runs the live fetch.

## Design notes

- Order in the script: parse flags, resolve the mark, `--file` branch, token, `--list`, credentialCheck, checkApproval, one GET. Arm F10 checks in the comment-stripped source that credentialCheck comes before the first use of the word fetch, that exactly one https URL literal exists, and that child_process is not required.
- Request: GET, `redirect: 'manual'`, abort signal at 30000 ms, headers user-agent and accept only. A 3xx status (or opaqueredirect) exits 5 with redirect_refused and names the other host in the message; the other host is never requested.
- Body read: the reader path stops at the cap (default 8388608 bytes) and cancels the reader; the text() path checks the byte length. A content-length header above the cap is refused before a read.
- Temp file: `os.tmpdir()/mos-radar-changelog-PID-TIME.md`, mode 0600, removed in a finally block unless `--keep`.
- Mark: `--after`, else `--ledger`, else `data/capability-ledger.json` `ledger_covers.to`; none gives exit 2.

## Deviations from Plan

1. [Process] The SUMMARY is committed separately after the GREEN commit (same as 391-01), because it records the GREEN sha.
2. [Process] The worktree HEAD guard expects a `worktree-agent-*` branch. This tree runs on `main` by the task instruction. No ref was rewritten. Commits are `--only` commits, not pushed.
3. [Rule 1 - Bug in my own test, fixed before commit] The Write tool converted two `\u` escape sequences in the first draft of the test (dash check in F10, invisible-mark check in F8) into raw characters. I found this with the dash grep before the RED commit and rewrote both checks with `String.fromCharCode`. The committed file has no non-ASCII byte.
4. [Test addition] Arms F9b (default audit folder), F5b (allow-partial), a stream-reader size-cap arm in F7, and F15 (in-process run with a stub fetch) were added to the F1 to F14 list.
5. [Test scope] F12 compares `git status --porcelain` for data, lib, scripts and commands before and after, and ignores `data/capability-ledger.json` because a peer plan edits it.

Auto-fixed issues: none in the plan code.

## Known Stubs

None.

## Threat register status

- T-391-09 (credential in the request): headers are user-agent and accept only; F4 plants fake credentials in the environment and asserts none reaches the request or the audit file.
- T-391-10 (redirect): F6.
- T-391-11 (huge or slow answer): F7 (text and stream paths); 30 s abort signal asserted in F4.
- T-391-12 (instruction text): F8 through the CLI.
- T-391-13 (no record): F9 and F6/F7 (failed outcome records).
- T-391-14 (fetch without the person knowing): F2, F3; live fetch not run.
- T-391-03 (peer sweep): the two lib files had no peer diff (`git diff --quiet HEAD` exit 0 before the edit); `git add -f` and `git commit --only` with exact paths.

## Threat Flags

None. The one new network edge is the planned one (fixed host, ask-first).

## Self-Check: PASSED

- FOUND: scripts/radar-changelog-slice.cjs, tests/test-391-radar-fetch-script.cjs
- FOUND commits: 7d641e4ee, 7dce93392
- No em dash or en dash in the script, the test, or the two lib files.
