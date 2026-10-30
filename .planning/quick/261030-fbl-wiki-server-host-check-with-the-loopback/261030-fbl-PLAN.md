---
phase: 261030-fbl-wiki-server-host-check-with-the-loopback
plan: 01
quick_id: 261030-fbl
slug: wiki-server-host-check-with-the-loopback
date: 2026-10-30
type: execute
wave: 1
depends_on: [261030-et9]
files_modified:
  - tests/test-261030-fbl-wiki-host-guard.cjs
  - lib/wiki/wiki-server.cjs
  - CHANGELOG.md
autonomous: true
requirements: [T6-08]
canon_parts: [8]
must_haves:
  truths:
    - "Every wiki route answers 403 to a Host header that is not localhost, 127.0.0.1 or [::1]"
    - "A request with Host localhost:PORT or 127.0.0.1:PORT is served as before"
    - "tests/test-232-wiki-server.cjs stays green"
  artifacts:
    - path: "tests/test-261030-fbl-wiki-host-guard.cjs"
      provides: "RED then GREEN proof of the Host guard on the wiki routes"
    - path: "lib/wiki/wiki-server.cjs"
      provides: "expressHostGuard as the first middleware"
  key_links:
    - from: "lib/wiki/wiki-server.cjs"
      to: "lib/core/loopback-guard.cjs"
      via: "require and app.use(expressHostGuard)"
      pattern: "expressHostGuard"
objective: "The wiki server refuses a request whose Host header is not localhost, 127.0.0.1 or [::1], on every route including /api/save and /api/chat, using the helper of quick 261030-et9. Normal wiki use is unchanged."
---

# Quick 261030-fbl: Host check for the wiki server (T6-08 follow-up)

## Context
Quick 261030-et9 added lib/core/loopback-guard.cjs (hostHeaderAllowed, refuseForeignHost, expressHostGuard) and put the three quickview and presentation servers behind it. lib/wiki/wiki-server.cjs is already bound to 127.0.0.1 (quick 260923-lu5) but has no Host check. It exposes POST /api/save/:section/*rest (writes a room file), POST /api/chat and POST /api/briefing. A DNS-rebinding page that resolves its own name to 127.0.0.1 could call them with a foreign Host. Facts PROVEN by reading: express app at line 36; app.use(express.json()) at line 58 is the first middleware.

## Contracts
- C-1: app.use(expressHostGuard) is the FIRST middleware of the wiki app, before express.json(). A foreign Host gets 403 on every route, GET and POST.
- C-2: Host localhost, localhost:PORT, 127.0.0.1:PORT and [::1]:PORT are served exactly as before (test-232-wiki-server stays green).
- C-3: No other change in wiki-server.cjs. No new dependency. Hooks unchanged.
- C-4: The Python dashboard (scripts/serve-dashboard, python3 -m http.server) has no place for a Host check without a wrapper script; it is NOT changed. The SUMMARY lists it as a known residual (it serves static files only, bound to 127.0.0.1 since 261030-et9).

## Tasks
### Task 1: RED test (tests/test-261030-fbl-wiki-host-guard.cjs)
Node built-ins only, CJS, 'use strict', no framework; print "wiki-host-guard: ALL PASS" or "wiki-host-guard: N FAILED". Copy the fixture-room and server-start style of tests/test-232-wiki-server.cjs (startWikiServer on port 0). Arms: (a) GET /wiki with Host evil.example answers 403; (b) POST /api/save/<section>/<file> with Host evil.example answers 403 and the target file is unchanged (assert content before and after); (c) POST /api/chat with Host evil.example answers 403; (d) POST /api/briefing with Host evil.example answers 403; (e) GET /wiki with Host localhost:PORT answers 200; (f) POST /api/save with Host 127.0.0.1:PORT answers 2xx and the file changes (normal use); (g) a Host of localhost.evil.com and of 127.0.0.1.evil.com answer 403. Run it on the unchanged tree and record the RED run (expect failures on a, b, c, d, g). Commit alone: test(261030-fbl): add the failing wiki Host guard test.
### Task 2: the fix
Edit lib/wiki/wiki-server.cjs only: require ../core/loopback-guard.cjs and add app.use(expressHostGuard) as the first middleware, with a short comment that cites quick 261030-fbl. Run the new test (ALL PASS, twice) and tests/test-232-wiki-server.cjs (8 passed) before and after. Commit: fix(261030-fbl): the wiki server refuses a foreign Host header.
### Task 3: changelog
CHANGELOG.md [Unreleased] / ### Fixed: one bullet, plain English: the wiki preview now also refuses a request addressed to a foreign name, so a web page that points its own name at your computer can no longer save into your room through the wiki; normal use is unchanged. No em-dash. Ends with "Not live until a release carries it." Commit: docs(261030-fbl): changelog bullet for the wiki Host check.

## Verification
node tests/test-261030-fbl-wiki-host-guard.cjs prints ALL PASS; node tests/test-232-wiki-server.cjs passes; node tests/test-261030-et9-loopback-servers.cjs prints ALL PASS (its static listen arm must still pass); no full suite. git diff shows only the three files.

## Threat model
T6-08 residual closed for the wiki server (tampering via DNS rebinding). Python dashboard residual accepted (static, loopback-only).

## Success criteria
Foreign Host refused on all wiki routes; normal wiki use unchanged; 3 commits; no push; no STATE.md or ROADMAP.md change.

## Summary instructions
Write 261030-fbl-SUMMARY.md with commits (shas, ancestors of HEAD), RED and GREEN lines, the before and after of test-232, the Python dashboard residual, and STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT.
