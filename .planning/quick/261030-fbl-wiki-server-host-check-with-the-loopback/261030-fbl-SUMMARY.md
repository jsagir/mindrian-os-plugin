---
phase: 261030-fbl-wiki-server-host-check-with-the-loopback
plan: 01
quick_id: 261030-fbl
subsystem: local-previews
tags: [security, loopback, dns-rebinding, T6-08, wiki]
status: COMPLETE
requires: [261030-et9]
provides:
  - Host check on every route of lib/wiki/wiki-server.cjs
  - tests/test-261030-fbl-wiki-host-guard.cjs (RED then GREEN)
key-files:
  created:
    - tests/test-261030-fbl-wiki-host-guard.cjs
  modified:
    - lib/wiki/wiki-server.cjs
    - CHANGELOG.md
decisions:
  - "Reuse expressHostGuard of lib/core/loopback-guard.cjs; no new helper, no new dependency"
  - "The Python dashboard stays unchanged (known residual, C-4)"
completed: 2026-10-30
---

# Phase 261030-fbl Plan 01: Host check for the wiki server (T6-08) Summary

STATUS is COMPLETE. All 3 tasks ran. 3 commits exist on quick/261030-localhost-bind. Nothing is pushed. The wiki server now answers 403 to a Host header that is not localhost, 127.0.0.1 or [::1], on every route. Normal wiki use is unchanged.

## Commits (3, none pushed)

| Order | Sha | Message |
|-------|-----|---------|
| 1 | 89f99bf8a | test(261030-fbl): add the failing wiki Host guard test |
| 2 | 2c8e7a359 | fix(261030-fbl): the wiki server refuses a foreign Host header |
| 3 | 08706d109 | docs(261030-fbl): changelog bullet for the wiki Host check |

PROVEN: all 3 shas are ancestors of HEAD (`git merge-base --is-ancestor`). Each commit used `git commit --only -m ... -- <path>`. `git diff --stat 816ba98c6 HEAD` shows only the 3 planned files (CHANGELOG.md +1, lib/wiki/wiki-server.cjs +6, the new test +162). PLAN.md, SUMMARY.md, STATE.md and ROADMAP.md are not committed or touched by this run. The new test file needed `git add` first, because `git commit --only` does not accept an untracked path.

## RED run (commit 1, unchanged wiki-server.cjs)

Command: `node tests/test-261030-fbl-wiki-host-guard.cjs`. Result: exit 1, last line `wiki-host-guard: 7 FAILED`. PROVEN.
- FAIL (a) GET /wiki, Host evil.example: got 200.
- FAIL (b) POST /api/save, Host evil.example: got 200 (the scratch copy of the file was written).
- FAIL (c) POST /api/chat, Host evil.example: got 200.
- FAIL (d) POST /api/briefing, Host evil.example: got 503 (no_api_key, which shows that no key resolved and no call went out).
- FAIL (g) Host localhost.evil.com, 127.0.0.1.evil.com and localhost.evil.com:PORT: GET /wiki got 200 (3 failures).
- ok (e) localhost:PORT 200, (f) normal save 2xx with the file changed, (h) [::1]:PORT 200.

## GREEN run (commit 2)

`node tests/test-261030-fbl-wiki-host-guard.cjs`, run twice: both runs ended `wiki-host-guard: ALL PASS`, 10 ok lines, 0 FAIL lines. PROVEN.
Fix: `require('../core/loopback-guard.cjs')` and `app.use(expressHostGuard)` as the first middleware, before `app.use(express.json())`. 6 lines added, 0 removed.

## test-232 before and after

- Before the fix: `test-232-wiki-server: 8/8 passed`. PROVEN.
- After the fix: `test-232-wiki-server: 8/8 passed`. PROVEN.
- `node tests/test-261030-et9-loopback-servers.cjs` after the fix: `loopback-servers: ALL PASS`, including the static listen arm. PROVEN.

## Safety of the test run

- The test sets HOME to a scratch folder and removes ANTHROPIC_API_KEY before it loads the server, so /api/briefing cannot find a key. The RED run showed 503 no_api_key for arm (d). PROVEN.
- The wiki server has no browser opener. No browser opened. PROVEN by reading lib/wiki/wiki-server.cjs (the listen callback only logs and resolves).
- `ps` after the runs showed no wiki server process. PROVEN. The scratch room and scratch HOME are removed in the test `finally` block.
- No em-dash or en-dash in the new test, the new CHANGELOG bullet or the diff of wiki-server.cjs. PROVEN (grep of the added lines). 4 older dash characters exist in wiki-server.cjs; they are not part of this diff.

## Known residual: Python dashboard

scripts/serve-dashboard starts `python3 -m http.server`. It has no place for a Host check without a wrapper script, so it is NOT changed (contract C-4). It serves static files only and has been bound to 127.0.0.1 since 261030-et9. A DNS-rebinding page could read the snapshot files that it serves. ASSUMED: this holds only the static snapshot the user chose to build, and no write route exists. UNVERIFIED: the content of every snapshot file. Closing it needs a small Node or Python wrapper with a Host check; that is a separate quick.

## Deviations from Plan

None. The plan ran as written. One detail: the plan text counts a second `/api/chat` route (line 651 of the old file). The first `/api/chat` route answers first, so the second never runs. The guard sits before both. PROVEN by arm (c).

## Report

STATUS: DONE

CHANGED: lib/wiki/wiki-server.cjs, tests/test-261030-fbl-wiki-host-guard.cjs, CHANGELOG.md. Commits 89f99bf8a, 2c8e7a359, 08706d109.

VERIFIED:
- RED run: `wiki-host-guard: 7 FAILED` before the fix.
- GREEN run: `wiki-host-guard: ALL PASS`, twice, after the fix.
- test-232-wiki-server: 8/8 before and 8/8 after.
- test-261030-et9-loopback-servers: ALL PASS after the fix.
- All 3 shas are ancestors of HEAD; the diff holds 3 files only.

UNVERIFIED:
- A real browser against a real DNS-rebinding page. The test sends the Host header by raw http.request.
- The full suite (the plan forbids it).
- The wiki behind an SSH or editor port forward to a different local port. By design (DV-1 of 261030-et9) the check compares the host name only. ASSUMED fine.

RISKS:
- A user who opens the wiki through a custom host name (a hosts-file alias or a reverse proxy that forwards another Host) now gets 403. This is the intended effect.
- The Python dashboard residual above.
- Not live until a release carries the change.

NEXT: The main session commits PLAN.md and SUMMARY.md with `git add -f`, reviews the 3 commits ahead of origin, and decides on a follow-up quick for the Python dashboard wrapper.

## Self-Check: PASSED

- Test file present: tests/test-261030-fbl-wiki-host-guard.cjs FOUND.
- Commits 89f99bf8a, 2c8e7a359, 08706d109 FOUND and ancestors of HEAD.
