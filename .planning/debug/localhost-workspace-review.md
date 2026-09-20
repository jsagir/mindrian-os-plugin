---
status: investigating
kind: qa-sweep
trigger: localhost-workspace-review
severity: high
surfaces: [cli]
brain_mode: not_ready
canon_parts: [3, 7, 8, 9, 11, 12]
created: 2026-09-20
updated: 2026-09-20
---

# Localhost workspace QA appendix

## Source-of-Truth Preamble

CODE: /home/jsagi/dev/MindrianOS-Plugin, HEAD 1158431838db0d55000c8a57bf965efb1b94b94b, package 2.0.0-beta.48.
Origin re-verification: fetched origin/main 96cfc2e60addbc4a5e1c490b78a78d9d97114186. `git diff origin/main -- scripts/serve-dashboard-live templates/presentation/dashboard.html templates/chat-panel.html` returned no changes.
WIRE: isolated server at 127.0.0.1:3193 with synthetic temporary room; no Brain or model call. `brain_mode: not_ready` means the Brain was not exercised by this audit, not that deployed Brain health was measured as unhealthy.
Date: 2026-09-20. Re-run source comparison if origin changes before implementation.

## Current Focus

hypothesis: the old live dashboard supplies data endpoints without wiring the rendered page to their projection.
test: seed an isolated room, launch real server, inspect API and real Chromium, change a fixture artifact.
expecting: API contains data while page remains empty despite a file event.
next_action: review the new workspace proposal and scope adapter proof; no patch to the legacy UI was requested.

## Meta

Repo: /home/jsagi/dev/MindrianOS-Plugin (current workspace guide overrides stale template path).
Report: docs/reviews/2026-09-20-localhost-workspace-review.md.
First observed: 2026-09-20. Baseline introduction date unknown.
Related debug files: no dashboard/chat match found in filename scan; no claim of exhaustive historical bug search.

## Problem Statement

The old live dashboard is insufficient evidence for a connected MindrianOS workspace. A successful server response and existing green tests mask missing initial browser data and refresh behavior.

## Symptoms

Expected: a seeded claim and later artifact change reach the visible browser projection.
Actual: graph API has the claim, page ROOM_DATA is {}, no section or graph request follows an artifact event.
Errors: no uncaught browser JS error in the offline-asset run; this is missing integration rather than proof of a runtime exception.
Reproduction:
1. From the development root run `node tests/audit-localhost-workspace-review.cjs` with permission to spawn Node, bind localhost and launch Chromium.
2. Inspect generated evidence.json and desktop/mobile screenshots in that directory.
3. Audit uses temporary synthetic data, launches port 3193 and stops its own child; reserve that port before running.
Started: first measured on 2026-09-20; first-bad release not established.

## Scope and Impact

CLI live dashboard inspected. Desktop and Cowork not runtime tested. Linux/WSL Chromium only; Windows host-browser forwarding and native Windows/macOS not tested. Existing unrelated Phase-353 edits preserved.
Severity high for misleading “live” experience; implementation is not production-ready on the basis of this dashboard.

## Eliminated

- Missing room data alone cannot explain empty page: seeded claim returned by API.
- Sandbox EPERM is an environment gap: rerun outside sandbox passed existing tests.
- Blocked chart CDNs do not explain the raw ROOM_DATA placeholder: server source never replaces it or supplies an initial data fetch.

## Evidence

- Isolated audit: evidence.json records HTTP 200 for status/graph, one synthetic claim, empty browser ROOM_DATA, event payload, request history, mobile overflow and foreign-Host response.
- Browser screenshots inspected: room shell and empty visualization areas, separate API-key chat, template marker visible in footer.
- Existing tests: `node tests/test-dashboard-graph-feed.cjs` passed 3/3 outside sandbox.
- Existing tests: `node lib/memory/dashboard-server.test.cjs` exited 0 and reported all tests passed outside sandbox.
- Auth negative check: missing-Origin POST to chat returned 403. No external model request performed.
- Foreign Host GET to status returned 200. Attack exploitability was not assessed.
- Local CLI help: Claude Code 2.1.275 exposes stream-json/resume/plugin-dir/permission controls; no live session-control claim follows from flags alone.

## Technical Root Cause

NF-01, NEW FAILURE: `scripts/serve-dashboard-live`, serveDashboardHtml reads TEMPLATE_DASHBOARD and substitutes room/theme, then injects chat/SSE. `templates/presentation/dashboard.html` initializes ROOM_DATA to an untouched placeholder {}. generatePresentationOnce writes generated artifacts but serveDashboardHtml reads the raw template instead.

NF-02, NEW FAILURE: artifact event handler requires #wiki-panel to request section data; the tested page did not request data after the event. DB change producer emits edge-added with source and timestamp, while consumer requires source, target and type and does not refetch graph. Confirmed source mismatch; only artifact-change path was dynamically exercised.

NF-03, NEW FAILURE: mobile document exceeds viewport at 390 x 844. Specific CSS root cause not isolated; do not prescribe a guessed CSS patch.

NF-04, NEW FAILURE: Host validation exists for chat/session POST paths but GET status accepts a foreign Host. Dynamic 200 supports missing rejection, not a completed security exploitation claim.

PRODUCT GAP: handleRoomChat calls Anthropic Messages directly with one user message. It does not spawn/control Claude Code or preserve a shared terminal conversation in that route.

## Required Code Changes

These are proposed implementation requirements, not completed fixes:

1. Create a separate local workspace application and launcher; establish explicit session/room ownership before exposing mutations.
2. Serve initial governed projections and revisioned updates; render actual data and errors, not placeholders. Use navigation service rather than another SQL reader.
3. Add a tested Claude adapter with structured progress, supported permissions, interruption and exact session selection. Remove the need for browser API-key entry in the new product.
4. Apply local authentication and Host/Origin checks consistently to read and write routes; validate paths and scope.
5. Implement the responsive task-centered composition specified in the main report. Do not patch old CSS as a substitute for the new experience.

Short-term legacy patch is outside this report's scope. Keeping it separate prevents the new design from inheriting the old application by accident.

## Tests to Add or Update

- Browser fixture: seeded evidence visible; add/update artifact and observe exact revision without reload.
- Real adapter fixture: task -> stream -> approval denied/approved -> governed output -> reload -> explicit resume.
- Concurrency: two rooms, two tabs, two owners, stale requests; reject conflicts and prevent cross-room writes.
- Recovery: process exit, stream loss, server restart, stale approval and repeated submission.
- Security: read/write origin and Host rejection, authenticated session, path escape, hostile document rendering, secrets redaction and Brain egress boundary.
- Accessibility/platform: keyboard flows and mobile bounds; separately record WSL Windows browser, native Windows/macOS, CLI/Desktop/Cowork.
- Register implementation tests in the appropriate phase runner and release gates when implementation is planned. Audit script is evidence tooling, not a product regression suite.

## Non-Code Follow-ups

Main report is ready for review. Implementation needs its own phase, canon map declaration and complete release ceremony. No version bump or CHANGELOG fix claim belongs to this documentation-only review. Consult scripts/verify-release and the single release lockstep definition when shipping. On actual resolution, move this QA file to resolved and update knowledge-base.md; leave it investigating now.

Canon Part 8: no Brain wire called or changed. Part 9: no user truth claim confirmed or superseded. Tri-polar and cross-platform evidence is partial as stated. Reuse-before-build candidates are named in the main report. No new command/skill/agent/hook is shipped by this review.

## Resolution

root_cause: initial projection and event-consumer mismatch confirmed; mobile CSS cause not isolated.
fix: none; user requested a rethought review/report, not a legacy UI repair.
verification: isolated HTTP + browser evidence, source comparison, two existing suites passed within their stated scope.
files_changed: review report, this appendix, quick-task plan/evidence/summary/verification and research mirrors.
commits: see quick-task completion record.
