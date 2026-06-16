'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-02 Task 1 -- resolveRelativeTime(): chrono-node NL-time resolver.
 * ==========================================================================
 *
 * R2 (160-SPEC.md). Turns a user's relative-time expression ("yesterday",
 * "last Tuesday", "next quarter") into an absolute epoch-ms `valid_at`,
 * ANCHORED to getReferenceNow() (D-01a -- the same options.now clock seam tests
 * inject), with chrono `forwardDate` enabled for future-biased phrases.
 *
 * Anchor contract (D-01a): the resolver never reads Date.now() directly for its
 * reference. It accepts an explicit `opts.referenceMs` (the value an
 * `options.now` closure would yield), or an injected `opts.currentDate`
 * (YYYY-MM-DD), and otherwise calls getReferenceNow() from the Wave 1 module.
 * A test that injects a fixed reference shows resolution MOVES with it, never
 * with the system clock.
 *
 * Part 8 (LOCAL -> BRAIN: NO). Pure LOCAL classifier: operates ONLY on the
 * supplied user text. NO network, NO Brain. Returns scalars only -- epoch ms, a
 * matched boolean, a forward boolean, and the matched time SPAN (the time
 * phrase, never the whole user sentence). It never echoes arbitrary user prose
 * to any wire. Mirrors the LOCAL-classifier discipline of dual-path-detector.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS. chrono-node is the ONLY new
 * runtime dependency (v2.9.1, MIT, zero transitive deps -- legitimacy-verified).
 */

const chrono = require('chrono-node');
const { getReferenceNow } = require('./reference-now.cjs');

// Future-biased lexical cues. When the user's phrase looks forward ("next",
// "upcoming", "in N <unit>", "tomorrow"), chrono's forwardDate is enabled so an
// ambiguous bare phrase ("Tuesday", "March") resolves to the NEXT occurrence
// rather than the most recent past one. Past-biased phrases ("last", "ago",
// "yesterday") resolve backward, which is chrono's default.
const FORWARD_BIAS_RE = /\b(next|upcoming|tomorrow|coming)\b|\bin\s+\d/i;

function isForwardBiased(text) {
  return FORWARD_BIAS_RE.test(text);
}

/*
 * resolveRelativeTime(text, opts) -> { validAtMs, matched, forward, span } | null
 *
 * Returns null when `text` carries no resolvable time expression (or is empty/
 * non-string). On a match returns:
 *   validAtMs  epoch ms of the resolved instant (anchored to the reference)
 *   matched    always true on a non-null return
 *   forward    whether forwardDate was applied (future-biased phrase)
 *   span       the matched time-phrase substring (scalar; never the full text)
 *
 * opts (all optional; the anchor precedence is referenceMs > currentDate > seam):
 *   referenceMs  explicit reference epoch ms (the options.now seam value, D-01a)
 *   currentDate  YYYY-MM-DD injected by Claude Code (routes through getReferenceNow)
 *   now          injectable clock forwarded to getReferenceNow (test seam)
 *   seamPath     LOCAL seam file forwarded to getReferenceNow
 */
function resolveRelativeTime(text, opts) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const o = opts && typeof opts === 'object' ? opts : {};

  // Resolve the anchor instant (D-01a). Explicit referenceMs wins so tests can
  // pin a fixed reference; otherwise route through getReferenceNow() so the
  // Wave 1 precedence ladder (currentDate > seam > Date.now()) applies.
  let referenceMs;
  if (typeof o.referenceMs === 'number' && Number.isFinite(o.referenceMs)) {
    referenceMs = o.referenceMs;
  } else {
    const ref = getReferenceNow({
      currentDate: typeof o.currentDate === 'string' ? o.currentDate : undefined,
      now: typeof o.now === 'function' ? o.now : undefined,
      seamPath: typeof o.seamPath === 'string' ? o.seamPath : undefined,
    });
    referenceMs = ref && Number.isFinite(ref.referenceMs) ? ref.referenceMs : Date.now();
  }

  const forward = isForwardBiased(text);

  // chrono.parse(text, referenceDate, options). Anchor the instant to the
  // reference and force UTC so day-granularity resolution is timezone-stable
  // and deterministic across machines. forwardDate biases ambiguous phrases.
  let results;
  try {
    results = chrono.parse(
      text,
      { instant: new Date(referenceMs), timezone: 'UTC' },
      { forwardDate: forward }
    );
  } catch (_err) {
    // A parser fault must never throw into the caller; degrade to no-match.
    return null;
  }

  if (!Array.isArray(results) || results.length === 0) return null;

  const first = results[0];
  if (!first || !first.start || typeof first.start.date !== 'function') return null;

  const resolved = first.start.date();
  const validAtMs = resolved instanceof Date ? resolved.getTime() : NaN;
  if (!Number.isFinite(validAtMs)) return null;

  // span is the matched time-phrase only (scalar). chrono exposes the matched
  // text on result.text; fall back to a trimmed copy when absent.
  const span = typeof first.text === 'string' ? first.text : '';

  return { validAtMs, matched: true, forward, span };
}

module.exports = {
  resolveRelativeTime,
  // Exported for downstream reuse (dual-stamp consumes this) + targeted tests.
  isForwardBiased,
};
