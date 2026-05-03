/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 106 Plan 04 -- statusline banner-suppression module.
 *
 * Extracted from the inline contract fenced at
 * tests/test-statusline-banner-suppression.cjs:49-60 by Plan 106-03
 * (see 106-03-SUMMARY.md "Plan 106-04 Contract Handoff" section).
 *
 * Touch-file path: ~/.mindrian/banner-state/statusline-visibility-warned.json
 * Shape:
 *   {
 *     "status": "ok" | "warn" | "error",
 *     "last_check": "<ISO>",        // populated when status='ok'
 *     "last_warned": "<ISO>",       // populated when status='warn' or 'error'
 *     "installed_version": "<plugin.json version>"
 *   }
 *
 * shouldSuppress() returns true ONLY when:
 *   - touch-file content is non-null, AND
 *   - installed_version === current plugin version (version-bump invalidates), AND
 *   - status in {'warn', 'error'}, AND
 *   - last_warned is a parseable ISO timestamp, AND
 *   - last_warned is within 24h of `now`.
 *
 * Used by:
 *   - scripts/statusline-fallback-echo.cjs (D-04 fallback echo, 106-04)
 *   - tests/test-statusline-banner-suppression.cjs (5-test contract fence, 106-03)
 *
 * Canon Part 8: pure function, no I/O, no network, no side effects.
 * Pure CJS, node built-ins only, zero npm deps (Phase 87 invariant).
 */

'use strict';

const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;

function shouldSuppress(touchFileContent, currentVersion, now) {
  if (now === undefined) now = Date.now();
  if (!touchFileContent) return false;
  if (touchFileContent.installed_version !== currentVersion) return false;
  if (touchFileContent.status !== 'warn' && touchFileContent.status !== 'error') return false;
  if (!touchFileContent.last_warned) return false;
  const warnedAt = Date.parse(touchFileContent.last_warned);
  if (Number.isNaN(warnedAt)) return false;
  const ageMs = now - warnedAt;
  return ageMs < TWENTY_FOUR_HOURS_MS;
}

module.exports = { shouldSuppress, TWENTY_FOUR_HOURS_MS };
