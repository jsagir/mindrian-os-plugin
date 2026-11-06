---
status: fixing
kind: rca
trigger: "wiki-server-shadowed-byoapi-chat-proxy-latent-part8-egress"
issue_id: "B1"
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T07:14:20Z
updated: 2026-11-06T07:40:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 8bee5f739dff01c2d530987707a7138a7326c2f8 (repo version 2.0.0-beta.80, working tree of /home/jsagi/dev/MindrianOS-Plugin-release)
- **WIRE claims probe against:** mock only. A counter replaces globalThis.fetch. No network call ran. Fixture room tests/fixtures/wiki-room-232 only.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** the source claims below were read at the HEAD sha above. The source of this finding is auditor finding B1 (an auditor hypothesis). It was reproduced here before any fix.

## Current Focus

hypothesis: the superseded BYOAPI handler stayed in lib/wiki/wiki-server.cjs after the stub replaced it. Registration order alone blocks the egress.
test: static read of the route table plus a run on the fixture room with a counting fetch.
expecting: 0 fetch calls today, and a 404 on the pdf route today.
next_action: write the RED test, then delete the second handler and move the pdf route.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin (worktree /home/jsagi/dev/MindrianOS-Plugin-release)
- Plugin version: 2.0.0-beta.80
- Reported by: auditor finding B1 (.planning/audits/AUDITOR-FINDINGS-source.md section B)
- Date first observed: 2026-11-05
- Related debug sessions: none

## Problem Statement

lib/wiki/wiki-server.cjs registers a second POST /api/chat handler (the BYOAPI proxy). The first handler always answers, so the second never runs. A route reorder would send page content to api.anthropic.com or api.openai.com. The GET /wiki/:section/pdf route is also unreachable.

## Symptoms

expected: one POST /api/chat handler that never calls a third-party host. GET /wiki/<section>/pdf returns the printable section page.
actual: two POST /api/chat handlers. The second reads apiKey and apiProvider from the request body and calls fetch on a third-party host. GET /wiki/<section>/pdf returns the artifact not-found page with status 404.
errors: none (the hazard is latent).
reproduction:
  1. Start startWikiServer on tests/fixtures/wiki-room-232 with port 0. Replace globalThis.fetch with a counter that returns a failed response.
  2. POST /api/chat with message, apiKey (synthetic string), apiProvider anthropic and pageId problem-definition/test-article.
  3. GET /wiki/problem-definition/pdf.
started: the BYOAPI handler dates from the first wiki server. The stub handler was added later and was placed before it.

## Scope and Impact

- Affected surfaces: cli (the wiki server runs from the plugin on the user machine)
- Affected commands: the wiki server start path (startWikiServer)
- Affected users: all installs that run the wiki server, only if a future change reorders the routes or removes the stub
- Version range: first wiki server - 2.0.0-beta.80
- Severity: high (Part 8 safety depends on registration order)
- Blast radius: only lib/wiki/wiki-server.cjs. The pdf route is a separate defect with the same file as its site.

## Eliminated

- hypothesis: the second handler runs today and already sends content out
  evidence: the reproduction shows 0 fetch calls and a stub reply. The first handler answers every request.
  timestamp: 2026-11-06T07:14:20Z

## Evidence

- timestamp: 2026-11-06T07:14:20Z
  checked: lib/wiki/wiki-server.cjs route table (grep for app.post and app.get). PROVEN.
  found: app.post('/api/chat') is registered 2 times. The first handler (under the comment "Route: API - Chat (stub)") needs pageId and message and replies through wiki-chat handleChatMessage. The second handler (under the comment "BYOAPI Chat endpoint") reads message, section, apiKey and apiProvider from req.body and calls fetch on https://api.anthropic.com/v1/messages or https://api.openai.com/v1/chat/completions with room context.
  implication: a second handler with a third-party call is present in the shipped file.
- timestamp: 2026-11-06T07:14:20Z
  checked: node_modules/express/package.json. PROVEN.
  found: express version 5.2.1. Express runs the routes of an app in registration order. The first handler sends a response and never calls next(), so the second handler never runs.
  implication: only registration order blocks the egress. No code guard blocks it.
- timestamp: 2026-11-06T07:14:20Z
  checked: the second handler call buildPageContext(absRoom, roomData, section || null) against lib/wiki/wiki-chat.cjs buildPageContext(pageData, graphLinks, backlinks). PROVEN.
  found: the argument order and types differ. The dead code passes a path string as pageData, so it would build a wrong or empty context.
  implication: the dead code is also wrong. A reorder would fail or send wrong data, so the code has no value to keep.
- timestamp: 2026-11-06T07:14:20Z
  checked: GET /wiki/problem-definition/pdf on the fixture room. PROVEN.
  found: status 404, the body holds the not-found page, and the body does not hold the class pdf-page. The route app.get('/wiki/:section/pdf') is registered after app.get('/wiki/:section/*rest'). In express 5 the wildcard *rest matches the path /wiki/<section>/pdf with rest equal to pdf, so the artifact route answers with page id <section>/pdf and renders the not-found page.
  implication: the printable section page is unreachable.
- timestamp: 2026-11-06T07:14:20Z
  checked: grep for the pdf route in lib/wiki (excluding editor-dist and editor-src), docs, commands and tests. PROVEN.
  found: no link to /wiki/<section>/pdf exists. The only matches are the route itself, the pdfmake import in the editor bundle (a different feature) and two research notes with no link to the route.
  implication: no caller depends on the route today. The move is safe.
- timestamp: 2026-11-06T07:14:20Z
  checked: reproduction on the fixture room with a counting fetch. PROVEN.
  found: POST /api/chat with apiKey and apiProvider anthropic: status 200, reply keys reply and sources (the stub path, no source field), fetch count 0. GET /wiki/problem-definition/pdf: status 404, not-found body.
  implication: the hazard is latent as the auditor said. The pdf defect is live.
- timestamp: 2026-11-06T07:14:20Z
  checked: every third-party call in lib/wiki (grep for fetch( and https://). PROVEN.
  found: the only fetch call in wiki-server.cjs is in the BYOAPI handler. lib/wiki/briefing.cjs sends room-derived text to the user own Anthropic key by design (Phase 232, route POST /api/briefing). The browser pages load CDN scripts and fonts (unpkg, cdnjs, jsdelivr, googleapis) and send no room content to them. lib/wiki/room-home.cjs fetches only the local /api/briefing route.
  implication: after the fix, the wiki server has no handler that reads a key from a request body. /api/briefing stays, it is an adjacent fact and not changed here.

## Technical Root Cause

- Site: lib/wiki/wiki-server.cjs, the second app.post('/api/chat', express.json(), ...) handler (comment "BYOAPI Chat endpoint"), and app.get('/wiki/:section/pdf')
- Cause: the BYOAPI proxy handler stayed in the file after the stub handler replaced it. The only thing that blocks the egress is registration order. Separately, the pdf route sits after the wildcard artifact route, so the wildcard matches first.
- Why it surfaces now: the 2026-11-05 audit read the route table. No behavior change triggers it. A reorder or a removal of the stub would turn the latent handler on.

## Required Code Changes

- Change 1:
  - Location: lib/wiki/wiki-server.cjs, second POST /api/chat handler
  - Current behavior: a dead proxy handler reads apiKey and apiProvider and calls api.anthropic.com or api.openai.com.
  - Required behavior: delete the handler. Keep the first (stub) handler unchanged.
  - Short-term patch: none. Deletion is the minimal fix.
  - Long-term fix: the test pins one handler, no third-party URL, no key read, 0 fetch calls.
- Change 2:
  - Location: lib/wiki/wiki-server.cjs, app.get('/wiki/:section/pdf')
  - Current behavior: registered after the wildcard route, so unreachable.
  - Required behavior: register it before app.get('/wiki/:section/*rest'). Call next() when roomData.pages holds a page with id <section>/pdf, so an artifact named pdf still opens.
  - Short-term patch: none.
  - Long-term fix: the test pins the registration order and the fall-through.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-wiki-no-byoapi-proxy.cjs
  - Given: the fixture room tests/fixtures/wiki-room-232 and a counting fetch
  - When: the file is read statically, and the server runs with POST /api/chat and GET /wiki/<section>/pdf
  - Then: one handler, no third-party string, 0 fetch calls, the pdf route returns pdf-page and is registered before the wildcard route, and a page named pdf still opens as an artifact
  - Runner registration: tests/run-all-386.sh discovers it by glob

## Non-Code Follow-ups

- CHANGELOG.md: plan 386-21 owns the entry.
- Release lockstep: no release in this plan.
- Canon: Part 8. No user-specific bytes reach the Brain or a third party from the wiki server after the fix.
- knowledge-base.md: plan 386-21 owns it.
- Owner ruling candidate: /api/briefing sends room-derived text to the user own Anthropic key by design (Phase 232). The owner may want a Part 8 ruling on it. Not changed here.

## Resolution

root_cause: the superseded BYOAPI proxy handler stayed in lib/wiki/wiki-server.cjs after the stub handler replaced it, and only registration order blocked the egress. The pdf route sat after the wildcard artifact route, so the wildcard matched first.
fix: deleted the second POST /api/chat handler. Registered GET /wiki/:section/pdf (handler servePdf, a hoisted function declaration that keeps the original body) before GET /wiki/:section/*rest. servePdf calls next() when a page with id <section>/pdf exists. /api/briefing is unchanged.
verification: node tests/test-386-wiki-no-byoapi-proxy.cjs (RED at 794c02fa7: arms (a) and (c) failed; GREEN at 89fac7b2b: 4 of 4 arms pass); node tests/test-232-wiki-server.cjs 8 of 8; node tests/test-261030-fbl-wiki-host-guard.cjs ALL PASS; node tests/test-visible-room-leak.cjs 14 of 14; bash tests/run-all-386.sh PASS=1 FAIL=0; bash tests/run-all-196.sh Passed 6 Failed 0 on 3 runs (1 earlier run reported Failed 1 and was not reproduced, see the plan summary); node tests/test-3692-guard-survey-gate.cjs PASS 5 FAIL 0. Surfaces: cli verified. desktop and cowork verified by construction (the wiki server has no surface-specific code). Linux only.
files_changed:
  - lib/wiki/wiki-server.cjs (deleted the BYOAPI handler, moved the pdf route before the wildcard, added the next() fall-through)
  - tests/test-386-wiki-no-byoapi-proxy.cjs (new)
  - tests/run-all-386.sh (new)
commits: c283c5093 (RCA), 794c02fa7 (RED test), 89fac7b2b (fix)
