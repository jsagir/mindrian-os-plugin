---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 08
subsystem: security
tags: [localhost-poc, csrf, dns-rebinding, save-format, boundary-integrity, tier-2, playwright]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-01's shared test infrastructure (run-all-354.sh, tests/helpers/playwright-354.cjs, tests/helpers/fixture-room-354.cjs); 354-07's chat-panel inert-render fix (this plan's probe update depends on it)"
provides:
  - "docs/reviews/localhost-poc/server.cjs: per-launch capability token (X-Mindrian-Poc-Token, timing-safe compare), Host allowlist on every route including reads, exact-Origin CSRF guard, JSON-only content type on every POST, CSP/nosniff/no-referrer headers, sha256 base_revision with 409 conflict, atomic temp+wx+rename save, 1,000,000-char + 2MB caps, new GET /api/document/revision"
  - "docs/reviews/localhost-poc/app.js: lossless textarea editor (no HTML<->Markdown round trip), inert preview, conflict-aware save"
  - "scripts/serve-dashboard-live: Host check on every GET route (previously POST-only), closing the 2026-09-20 review's foreign-Host-read finding"
  - "tests/test-354-poc-save-origin.cjs (S1-S7), tests/test-354-dashboard-host-read.cjs (route-enumerated foreign-Host recheck)"
affects: [354-11, SYS-06-followup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-launch capability token minted once at server start, delivered to the DOM only via a same-origin <meta> tag substituted into a marker comment -- a foreign page can never read it because it never crosses an HTTP response a foreign page's script can access."
    - "sha256(file bytes) as an opaque revision token for optimistic-concurrency conflict detection (409 + current_revision on mismatch), avoiding any need for a version counter or lock file."
    - "Temp-file-in-same-dir + 'wx' (exclusive create) + fs.renameSync for atomic saves -- cites lib/core/recovery/case-file.cjs's atomicWrite idiom by comment, reused rather than reimplemented (Canon Part 7)."
    - "Route enumeration by parsing the target source's own dispatch block (regex over `p === '...'` literals) instead of hard-coding a route list in the test, so the regression tracks the real route surface as it grows."
    - "node:http (not global fetch/undici) for any test that needs to forge a Host header -- undici's fetch silently discards a Host header override (treats it as browser-forbidden), which would make a Host-check regression structurally blind; node:http honors it, matching a real DNS-rebinding attacker's TCP-level view."

key-files:
  created:
    - tests/test-354-poc-save-origin.cjs
    - tests/test-354-dashboard-host-read.cjs
  modified:
    - docs/reviews/localhost-poc/server.cjs
    - docs/reviews/localhost-poc/app.js
    - docs/reviews/localhost-poc/index.html
    - docs/reviews/localhost-poc/styles.css
    - scripts/serve-dashboard-live
    - docs/reviews/phase-354-probes/browser.cjs

key-decisions:
  - "Applied the same POST guards (Origin, Content-Type, token) to POST /api/graph/ask in addition to /api/document, since the plan's action text states the guard applies to 'every POST', not just the document-write route; leaving /api/graph/ask ungated would have been an inconsistent half-fix (Rule 2)."
  - "SYS-06 requirement left OPEN in REQUIREMENTS.md per explicit navigator instruction: this plan closes its own two sub-findings (POC save format, POC cross-origin write) plus the adjacent dashboard foreign-Host-read recheck, but SYS-06's third sub-finding (354-11's full browser-to-room-to-graph journey) has not landed yet. requirements.mark-complete was NOT invoked for SYS-06 this plan."
  - "tests/test-354-dashboard-host-read.cjs's Task 1 run recorded disposition CONFIRMED (matching the 2026-09-20 review); after Task 3's fix, the same test (rerun unmodified) reports ALREADY FIXED, which is the intended before/after signal, not a contradiction."

requirements-completed: []  # SYS-06 intentionally left open -- see key-decisions above; 354-11 must land before it closes.

# Metrics
duration: ~55min
completed: 2026-09-23
---

# Phase 354 Plan 08: POC Save Format, Origin Model, and Dashboard Host Check Summary

**Localhost POC's editor is now a lossless textarea (no HTML<->Markdown round trip), its server enforces a per-launch capability token plus exact-Origin/Host checks with sha256-revisioned atomic saves, and the legacy dashboard's GET routes now share the Host check its POST routes already had.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Task 1 (RED): wrote `tests/test-354-poc-save-origin.cjs` (S1-S7: round trip, cross-origin no-cors and cors writes, foreign Host on every POC route, missing/wrong token, stale-revision conflict, oversized document, real-edit preservation) and `tests/test-354-dashboard-host-read.cjs` (enumerates GET routes directly from `scripts/serve-dashboard-live`'s own `requestHandler` source rather than hard-coding them). Confirmed RED against the pre-fix POC: S1 (lossy round trip changed headings/list spacing/line breaks on a no-edit save), S2 (cross-origin no-cors write succeeded), S3 (forged Host still returned 200 on every POC route). Confirmed the dashboard's foreign-Host-read finding as CONFIRMED (all 7 enumerated GET routes accepted `Host: review.invalid` with 200), reproducing the 2026-09-20 review finding rather than assuming it.
- Task 2 (GREEN): rewrote `docs/reviews/localhost-poc/server.cjs` with a per-launch `crypto.randomBytes(32)` token (delivered only via a same-origin `<meta>` tag), a Host allowlist checked before any route dispatch (reads included), an exact-Origin + JSON-content-type + timing-safe-token guard on every POST, sha256-based `base_revision`/409-conflict handling, and an atomic temp-file+`wx`+rename save. Rewrote `app.js`'s editor as a `<textarea>` holding the file's exact bytes (removed `htmlToMarkdown`/`contenteditable` entirely) plus an inert preview pane; save is a no-op when unchanged, shows a conflict banner on 409, and never silently overwrites. Moved the legend swatches from inline `style=""` to CSS classes so the new `script-src 'self'; style-src 'self'` CSP has nothing to block. Verified against the real Playwright probe: `"preserved":true` on a no-edit save, `"changed":false` on a cross-origin write attempt.
- Task 3 (Host-check recheck + fix): added a single `checkHost(req, BOUND_PORT)` gate at the top of `requestHandler` in `scripts/serve-dashboard-live`, before both the POST and GET dispatch blocks, closing the gap where only the two POST routes (`/api/auth/session`, `/api/room/chat`) had this DNS-rebinding guard. Re-running `tests/test-354-dashboard-host-read.cjs` unmodified now reports `ALREADY FIXED` (all 7 routes refuse a foreign Host with 403, all 7 still serve 200 on a valid Host). `lib/memory/dashboard-server.test.cjs` and `lib/memory/bearer-token.test.cjs` both stay green, confirming no regression to the existing BYO-chat auth flow.

## Task Commits

1. **Task 1: Failing regressions - POC round trip, cross-origin write, Host, token, conflict; legacy dashboard foreign-Host read** - `439856ebf` (test)
2. **Task 2: POC server origin/capability model, revisioned atomic save, lossless editor** - `9175c586d` (feat)
3. **Task 3: Legacy dashboard - Host check on every GET route** - `0cdcb11ca` (fix)

_Note: commits 1-3 are interleaved in `git log` with an unrelated concurrent session's plan (356-04) committing to the same shared repo at the same time; each 354-08 commit stages only this plan's own named files (verified via `git status --short` before every commit)._

## Files Created/Modified

- `tests/test-354-poc-save-origin.cjs` - S1-S7 Playwright + raw-HTTP regression for the POC's save format and origin model
- `tests/test-354-dashboard-host-read.cjs` - route-enumerated foreign-Host recheck for the legacy dashboard's GET routes
- `docs/reviews/localhost-poc/server.cjs` - capability token, Host/Origin/content-type guards, revisioned atomic save, CSP headers
- `docs/reviews/localhost-poc/app.js` - textarea editor (lossless), inert preview, conflict-aware save, CSP-compatible legend markup
- `docs/reviews/localhost-poc/index.html` - `<!--MOS_POC_TOKEN-->` marker for server-side token injection
- `docs/reviews/localhost-poc/styles.css` - textarea/preview/conflict-banner styling, swatch color classes, responsive stacking
- `scripts/serve-dashboard-live` - `checkHost` now gates every route in `requestHandler`, not just the two POST routes
- `docs/reviews/phase-354-probes/browser.cjs` - chat-panel XSS probe decoupled onto a CSP-free page (see Deviations); save-state wait made fix-agnostic

## Decisions Made

- Applied the "every POST" guard language literally to `/api/graph/ask` as well as `/api/document`, closing a CSRF gap the plan's threat register didn't name explicitly but its own wording covers (Rule 2).
- Left SYS-06 unchecked in `REQUIREMENTS.md` per the explicit instruction in this plan's success criteria: 354-11's browser-to-room-to-graph journey sub-finding is still pending, so the requirement is not fully closed by this plan alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `docs/reviews/phase-354-probes/browser.cjs` chat-panel probe incompatible with the new POC CSP**
- **Found during:** Task 2 verification (running the browser probe against a scratch copy of the fixed POC, required by Task 2's own acceptance criteria)
- **Issue:** The probe's `page.addScriptTag({path: 'lib/chat/chat-panel.js'})` injects an inline `<script>` tag. The POC's new `Content-Security-Policy: script-src 'self'` (required by this plan's spec) correctly refuses inline script execution, so the probe threw before reaching its save/cross-origin checks at all.
- **Fix:** Moved the chat-panel XSS probe (a 354-07/SYS-03 concern, unrelated to this plan's save/origin fix) onto a separate CSP-free static page instead of the hardened POC origin, decoupling the two concerns rather than weakening the POC's CSP to accommodate a probe tool. The authoritative regression for that concern remains `tests/test-354-chat-inert-render.cjs` (354-07), which already uses the same CSP-free-page pattern.
- **Files modified:** docs/reviews/phase-354-probes/browser.cjs
- **Verification:** `node docs/reviews/phase-354-probes/browser.cjs` completes and prints `{"probe":"assistant-html","executed":false}`, `{"probe":"save-without-edit",...,"preserved":true}`, `{"probe":"cross-origin-browser-write","changed":false}`
- **Committed in:** `9175c586d` (Task 2 commit)

**2. [Rule 1 - Bug] Same probe file hung waiting on a condition 354-07 already made permanently false**
- **Found during:** Task 2 verification, same run as above
- **Issue:** After fixing the CSP issue, the probe's `page.waitForFunction(() => window.researchExecuted === true)` hung indefinitely, because 354-07 already landed the chat-panel inert-render fix -- `researchExecuted` now correctly stays `false` forever on a fixed checkout, so a wait gated on it becoming `true` was waiting for a pre-354-07 (vulnerable) outcome that no longer occurs.
- **Fix:** Replaced the indefinite wait with a bounded `waitForTimeout(500)` and logged whatever value actually resulted, matching the probe's role as an evidence-gathering tool rather than a pass/fail gate.
- **Files modified:** docs/reviews/phase-354-probes/browser.cjs
- **Verification:** Probe completes within the timeout and reports the correct (inert) value
- **Committed in:** `9175c586d` (Task 2 commit)

**3. [Rule 1 - Bug] `tests/test-354-poc-save-origin.cjs`'s S3 checks were structurally unable to detect the Host fix**
- **Found during:** Task 2 verification -- S3a/S3b still reported the foreign Host as accepted (200) even after the server-side fix landed and was manually confirmed correct via a raw `node:http` probe.
- **Issue:** Node's built-in `fetch` (undici) silently discards an explicit `Host` header override (treats it as a browser-forbidden header), so `fetch(url, {headers: {Host: 'review.invalid'}})` always sends the real Host regardless of the override -- the S3 assertions using `fetch` were comparing against a request that never actually forged anything.
- **Fix:** Added a `rawRequest()` helper using `node:http` (which honors the header override, matching a real DNS-rebinding attacker's TCP-level view) and switched S3's three requests to use it. Confirmed by temporarily running the new S3 assertions against the pre-fix server (via `git show` into a scratch dir): correctly reports 200 (RED) pre-fix and 403 (GREEN) post-fix.
- **Files modified:** tests/test-354-poc-save-origin.cjs
- **Verification:** `node tests/test-354-poc-save-origin.cjs` -- S3a-S3d now pass against the fixed server and were independently confirmed to fail against the pre-fix server
- **Committed in:** `9175c586d` (Task 2 commit, alongside the fix it verifies)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs discovered while verifying this plan's own acceptance criteria)
**Impact on plan:** All three were necessary to actually exercise Task 2's acceptance criteria (the browser-probe observations, and a trustworthy S3 signal); none changed the plan's scope or design. No scope creep.

## Issues Encountered

None beyond the three deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/run-all-354.sh` full run: 9 PASSED, 0 FAILED, 9 SKIPPED (all skips are later-plan test files not yet landed: 354-09/10/11/etc. territory). No regressions to any already-landed 354 leg.
- SYS-06 remains open in REQUIREMENTS.md, correctly signaling that 354-11 (the full browser-to-room-to-graph journey) still owns the third sub-finding.
- The POC's capability-token and revisioned-save model is now the concrete contract 354-11 should build its room-mode journey test against (GET /api/document/revision exists specifically for that plan's external-edit polling need).
- `docs/reviews/localhost-poc/{app.js,server.cjs,README.md}` no longer carry any uncommitted diff; a future session can copy the scratch-server pattern directly from `tests/test-354-poc-save-origin.cjs` rather than the now-decoupled `docs/reviews/phase-354-probes/browser.cjs`.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 9 files created/modified by this plan confirmed present on disk (tests/test-354-poc-save-origin.cjs, tests/test-354-dashboard-host-read.cjs, docs/reviews/localhost-poc/{server.cjs,app.js,index.html,styles.css}, scripts/serve-dashboard-live, docs/reviews/phase-354-probes/browser.cjs, this SUMMARY.md). All 3 task commits (439856ebf, 9175c586d, 0cdcb11ca) confirmed present in `git log --oneline --all`.
