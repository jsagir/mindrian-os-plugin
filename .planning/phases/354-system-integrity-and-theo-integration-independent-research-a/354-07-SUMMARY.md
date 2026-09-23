---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 07
subsystem: ui
tags: [xss, chat-panel, browser, boundary-integrity, tier-2, playwright]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-01's shared test infrastructure (run-all-354.sh, tests/helpers/playwright-354.cjs Playwright resolver)"
provides:
  - "Escape-first renderMarkdown() in lib/chat/chat-panel.js (fenced blocks sentinel-extracted and escaped before transforms; whole-message and streamed innerHTML sites both inert)"
  - "escapeHtml() in both lib/chat/chat-panel.js and lib/chat/generative-tools.js now escape all five HTML-sensitive characters (& < > \" ')"
  - "safeColor(value) in lib/chat/generative-tools.js -- strict hex-only validation for insight_card item.color, dropping non-hex CSS-injection attempts"
  - "tests/test-354-chat-inert-render.cjs -- Playwright regression (P1-P7, F1), wired into tests/run-all-354.sh"
affects: [354-08, 354-11, agentshield, chat-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Escape-first rendering: escape the whole text before applying any markdown transform, so every transform's capture group is already inert by construction (no per-transform escaping to forget)."
    - "Sentinel-token extraction for fenced content: pull out fence bodies into a NUL-delimited token array before the escape pass, escape the fence body directly, then restore the finished HTML in place of the token after all other transforms run -- so fence content is never re-processed by the inline/bold/italic/list regexes."
    - "Allowlist validation over sanitization for structured attacker-controlled values (safeColor's /^#[0-9a-fA-F]{3,8}$/ instead of trying to escape/strip CSS)."

key-files:
  created:
    - tests/test-354-chat-inert-render.cjs
  modified:
    - lib/chat/chat-panel.js
    - lib/chat/generative-tools.js

key-decisions:
  - "No CSP added to exported presentations this task (scripts/generate-presentation.cjs inlines chat-panel.js/generative-tools.js with inline scripts by design); escaping is the enforced control per T-354-14b (accepted residual, recorded in the phase disposition ledger)."
  - "P6 (streamed content_block_delta path) is asserted through _renderMessage rather than driving a real fetch() SSE loop, on the documented basis that both call sites invoke the identical private renderMarkdown closure and assign through innerHTML -- fixing the function once fixes both sites."

requirements-completed: [SYS-03]

# Metrics
duration: 15min
completed: 2026-09-23
---

# Phase 354 Plan 07: Inert Chat and Tool-Component Rendering Summary

**Escape-first renderMarkdown (sentinel-extracted fenced code, then whole-text HTML-escape, then markdown transforms) makes lib/chat/chat-panel.js's assistant rendering inert on both the whole-message and streamed innerHTML sites; lib/chat/generative-tools.js gains a strict hex-only safeColor() gate and single-quote escaping, closing the T-354-14/T-354-15 CSS/script-injection paths a Playwright regression now locks.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Red browser regression (`tests/test-354-chat-inert-render.cjs`) proved, on the real `ChatPanel.prototype._renderMessage` method (Playwright, real `http://` origin, real localStorage), that a synthetic `<img onerror=...>` assistant payload executed pre-fix -- 5 of 10 checks failed, including the required P1 case.
- `renderMarkdown()` rewritten escape-first: fenced blocks are extracted to `\u0000FENCE<n>\u0000` sentinel tokens and their bodies escaped directly; the remaining text is HTML-escaped in full; the existing inline-code/bold/italic/list/newline transforms then run on already-safe text (every transform's capture group can never be interpreted as markup); fenced blocks are restored last, after transforms, so they are never re-processed.
- `escapeHtml()` in `chat-panel.js` now escapes all five HTML-sensitive characters (`&`, `<`, `>`, `"`, `'`) -- previously only escaped `&`, `<`, `>`.
- `escapeHtml()` in `generative-tools.js` now also escapes `'` (previously escaped `&`, `<`, `>`, `"`).
- New `safeColor(value)` in `generative-tools.js` accepts only `/^#[0-9a-fA-F]{3,8}$/`; `renderInsightCard` now renders the color dot only when `safeColor` returns a value, dropping any non-hex CSS-injection attempt (e.g. `red;background-image:url(/leak)`) entirely rather than passing it through to a `style` attribute.
- Green regression: all 10 checks pass (P1-P7, F1); `bash tests/run-all-354.sh` reports the new leg PASSED alongside the five already-landed 354 legs (7 passed, 0 failed, 11 skipped for not-yet-landed plans); `node scripts/check-render-coverage.cjs` unaffected (16 covered, 0 gap).
- The probe at `docs/reviews/phase-354-probes/browser.cjs` (the original research reproduction) now times out on `page.waitForFunction(() => window.researchExecuted === true)` instead of resolving -- recorded as the green evidence per the plan's acceptance criteria.

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing browser regression - inert rendering on every assistant path** - `ebb81c663` (test)
2. **Task 2: Escape-first markdown rendering and hardened component renderers** - `0071a5897` (feat)

## Files Created/Modified

- `tests/test-354-chat-inert-render.cjs` - Playwright regression: P1-P7 (whole-message, inline-code, fenced-block, bold-wrapped, attribute-break x2, streamed-identity, tool-component) plus F1 formatting-survival case; ENV GAP exits 77 via `tests/helpers/playwright-354.cjs`'s `resolvePlaywright()`.
- `lib/chat/chat-panel.js` - `renderMarkdown()` rewritten escape-first with sentinel-based fenced-code extraction; `escapeHtml()` now escapes `"` and `'` in addition to `&`, `<`, `>`.
- `lib/chat/generative-tools.js` - `escapeHtml()` now escapes `'`; new `safeColor(value)` hex-only validator wired into `renderInsightCard`'s color-dot rendering.

## Decisions Made

- Kept the fix scoped to escaping/validation only, matching CTX-POC's "escape first, then apply the fixed set of markdown transforms" pattern -- no new dependency, no DOMPurify-style sanitizer, consistent with the file's stated zero-dependency var/IIFE contract and `scripts/generate-presentation.cjs`'s raw-text inlining.
- Did not add a CSP to exported presentations (T-354-14b, disposition: accept) -- the export inlines scripts by design (`scripts/generate-presentation.cjs:774`), so escaping is the enforced control, not header policy. This residual is recorded in the phase's threat register, not newly introduced by this plan.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks; no Rule 1-4 triggers encountered (no bugs found outside plan scope, no missing critical functionality beyond what the plan specified, no blocking issues, no architectural changes needed).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SYS-03 fully closed by this plan (scoped entirely to 354-07 per REQUIREMENTS.md).
- SYS-06 left open per its REQUIREMENTS.md row, which co-owns this ID with Plans 354-08 (POC lossless save, Host/Origin/token model, revision conflicts) and 354-11 (governed room journey) -- this plan's own scope (chat/tool-component rendering, CTX-POC sub-finding 1) is the only slice closed here; the localhost-poc save-format and cross-origin-write sub-findings 2 and 3 remain for those plans.
- No blockers for 354-08 or 354-11; this plan touched only `lib/chat/*`, leaving `docs/reviews/localhost-poc/*` untouched for those plans to modify without conflict.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: tests/test-354-chat-inert-render.cjs
- FOUND: lib/chat/chat-panel.js
- FOUND: lib/chat/generative-tools.js
- FOUND: .planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-07-SUMMARY.md
- FOUND commit: ebb81c663 (test task)
- FOUND commit: 0071a5897 (feat task)
