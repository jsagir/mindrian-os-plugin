---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "01"
subsystem: wiki-server
tags: [part8, egress, express, wiki, byoapi]

requires: []
provides:
  - "wiki server with one POST /api/chat handler and no third-party call"
  - "reachable GET /wiki/:section/pdf with fall-through to a page named pdf"
  - "tests/run-all-386.sh, a glob runner for every tests/test-386-* file"
affects: [386-02, 386-03, 386-21]

tech-stack:
  added: []
  patterns:
    - "Delete a superseded egress handler at the origin, then pin it with a static plus a dynamic test"
    - "Read express 5 registration order from app.router.stack to pin route order"

key-files:
  created:
    - .planning/debug/wiki-server-shadowed-byoapi-chat-proxy-latent-part8-egress.md
    - tests/test-386-wiki-no-byoapi-proxy.cjs
    - tests/run-all-386.sh
  modified:
    - lib/wiki/wiki-server.cjs

key-decisions:
  - "The pdf handler is a hoisted function declaration (servePdf) registered before the wildcard route, so the original body stays untouched and the diff stays small."
  - "/api/briefing is not changed. It sends room-derived text to the user own Anthropic key by design (Phase 232). Recorded in the RCA as an owner ruling candidate."

requirements-completed: [B1]

duration: 30min
completed: 2026-11-06
---

# Phase 386 Plan 01: B1 wiki BYOAPI proxy Summary

**Deleted the shadowed BYOAPI chat proxy from the wiki server (no route order can now send page content to api.anthropic.com or api.openai.com) and made the printable pdf route reachable.**

## Performance

- **Duration:** about 30 min
- **Tasks:** 3 of 3
- **Files modified:** 4 (1 changed, 3 new)

## Accomplishments

- RCA written first and reproduced on the fixture room: POST /api/chat with a synthetic apiKey gave status 200, the stub reply and 0 fetch calls. GET /wiki/problem-definition/pdf gave 404 with the not-found page.
- RED test (commit 794c02fa7) failed only on arms (a) and (c). GREEN fix (commit 89fac7b2b) passes all 4 arms.
- The dead handler also called buildPageContext with the wrong arguments (absRoom, roomData, section) against the real signature (pageData, graphLinks, backlinks), so it had no value to keep.

## Task Commits

1. Task 1, RCA: c283c5093 (resolution block added in 65c97e89e)
2. Task 2, RED test and runner: 794c02fa7
3. Task 3, fix: 89fac7b2b

## Verification

- PROVEN: node tests/test-386-wiki-no-byoapi-proxy.cjs ALL PASS (4 arms).
- PROVEN: node tests/test-232-wiki-server.cjs 8 of 8. node tests/test-261030-fbl-wiki-host-guard.cjs ALL PASS. node tests/test-visible-room-leak.cjs 14 of 14.
- PROVEN: bash tests/run-all-386.sh PASS=1 FAIL=0. node tests/test-3692-guard-survey-gate.cjs PASS 5 FAIL 0 (0 fetch calls).
- PROVEN: bash tests/run-all-196.sh Passed 6 Failed 0 on 3 runs.
- Flake note: the first run of tests/run-all-196.sh reported Passed 5 Failed 1. I did not capture which leg failed. 3 later runs were clean. A peer executor shared the tree at the time. Cause is UNVERIFIED.

## Deviations from Plan

None in scope. One implementation choice: the pdf route move uses a hoisted function declaration, not a cut and paste of the body (see key-decisions). The static test strips a block comment only when it opens at a line start, because the route string '/wiki/:section/*rest' contains the characters /* (found while making RED fail on arm (a)).

## Known Stubs

None added. The first /api/chat handler remains the Phase 232 stub by design.

## Threat Flags

None. T-386-01-01 and T-386-01-03 mitigated. T-386-01-02 (/api/briefing) accepted and recorded.

## Self-Check: PASSED

Files present: the RCA, the test, the runner, this summary. Commits c283c5093, 794c02fa7, 89fac7b2b, 65c97e89e exist on main.
