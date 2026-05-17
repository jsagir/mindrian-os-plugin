/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 120-01 -- Shape F.7 Breakthrough Surface renderer.
 *
 * Per CONTEXT.md D-07..D-10 (the 5 verbs LOCKED VERBATIM + closed-vocab + mandatory dismiss):
 *   - Built NEW (D-07): F.4 maps content-to-user-actionable-observation;
 *     F.7 maps user-actions-to-recognition-of-user-own-work. Different speech acts.
 *   - 5 verbs LOCKED VERBATIM (D-08): [Explore deeper] / [Confirm] / [File as decision] /
 *     [Dismiss] / [Back]. Order is structural, not stylistic.
 *   - [File as decision] (D-09) emits breakthrough_filed_as_decision via the Plan 120-02
 *     scanner consumer; F.7 only renders the verb -- it does NOT itself emit events.
 *   - [Dismiss] (D-10) is MANDATORY -- the renderer asserts its presence; refuses to
 *     render a contract without it (defense in depth against accidental drift).
 *
 * Per CONTEXT.md D-11..D-12 (top-1 with "More breakthroughs (N)" affordance):
 *   - Top-1 surface; "More breakthroughs (N)" affordance for queued candidates.
 *   - more_count is rendered in zones.footer IFF more_count > 0.
 *
 * Per CONTEXT.md D-20 HARD FLOOR (Cypher-provable):
 *   - breakthrough.artifact_ids[] must be non-empty AT RENDER TIME. The renderer is
 *     the second structural enforcement point (the first is writeBreakthrough in
 *     Plan 120-00 schema.cjs). Defense in depth: if a caller somehow bypasses
 *     writeBreakthrough's validateProvenance, F.7 refuses to render the surfacing.
 *
 * Per CONTEXT.md D-17 voice scaffold rule 3 (time anchor):
 *   - The title line includes a human-readable time anchor (e.g., "in the last 8 hours")
 *     derived from breakthrough.detected_at via formatTimeAnchor.
 *
 * Canon Part 3: F.7 IS a Decision Gate primitive instance. LOCAL context only
 *   (the breakthrough artifact_ids + theme); BRAIN context is none (D-20 makes
 *   breakthroughs locally Cypher-provable); SIGNAL context is none (cross-room
 *   forbidden per Part 8).
 *
 * Canon Part 4: every choice is graph data. Each of the 5 verbs maps to a typed
 *   event the Plan 120-02 scanner consumer emits at verb-dispatch time.
 *
 * Canon Part 8: zero Brain coupling. The renderer is pure: no FS reads, no DB
 *   writes, no fetch calls. Mirrors the F.4 / F.6 pattern byte-for-byte.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */
'use strict';

// D-08: the 5 verbs LOCKED VERBATIM. Object.freeze prevents accidental mutation
// of the canonical array; downstream code that needs a mutable copy must call
// F7_VERBS.slice() (the dispatcher does this in inputArgs).
const F7_VERBS = Object.freeze([
  'Explore deeper',
  'Confirm',
  'File as decision',
  'Dismiss',
  'Back',
]);

// D-10: structural index of 'Dismiss' in F7_VERBS. assertContractInvariants uses
// this to surface a precise 'dismiss_required' reason when the contract drifts.
const F7_DISMISS_INDEX = 3;

// Map the four detector kinds Plan 120-00 emits to their canonical display
// strings. Unknown kinds fall back to the raw kind string (and finally to
// 'Pattern' if kind is falsy).
const KIND_DISPLAY_NAMES = Object.freeze({
  convergence: 'Convergence',
  contradiction_resolved: 'Contradiction resolved',
  cross_domain_analogy: 'Cross-domain analogy',
  reverse_salient_closed: 'Reverse salient closed',
});

// D-17 rule 3: human-readable time anchor with bucket boundaries chosen to
// match the spec examples (in the last hour / in the last N hours / today /
// in the last day / this week / in the last two weeks / on YYYY-MM-DD).
// D-06 ethical fence: ages > 14 days surface the calendar date verbatim so
// the user can see exactly how stale the recognition is.
function formatTimeAnchor(detected_at) {
  const now = Date.now();
  const ts = (typeof detected_at === 'number' && Number.isFinite(detected_at)) ? detected_at : now;
  const ageMs = Math.max(0, now - ts);
  const ageHours = ageMs / (3600 * 1000);
  const ageDays = ageHours / 24;
  if (ageHours < 1) return 'in the last hour';
  if (ageHours < 8) return 'in the last ' + Math.floor(ageHours) + ' hours';
  if (ageHours < 24) return 'today';
  if (ageDays < 2) return 'in the last day';
  if (ageDays < 7) return 'this week';
  if (ageDays < 14) return 'in the last two weeks';
  // Older than the 14-day ethical fence (D-06) -- include calendar date for transparency.
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return 'on ' + yyyy + '-' + mm + '-' + dd;
}

// D-10 MANDATORY-Dismiss structural guard. Returns {ok:true} when the verbs
// array deep-equals F7_VERBS; otherwise returns {ok:false, reason} with a
// precise reason code so consumers can surface a meaningful error envelope.
//
// Reason codes:
//   verb_count_mismatch -- verbs.length !== 5
//   dismiss_required    -- the slot at F7_DISMISS_INDEX is not literally 'Dismiss'
//   verb_order_mismatch -- some other slot diverges from the canonical array
function assertContractInvariants(verbs) {
  if (!Array.isArray(verbs) || verbs.length !== F7_VERBS.length) {
    return { ok: false, reason: 'verb_count_mismatch' };
  }
  for (let i = 0; i < F7_VERBS.length; i++) {
    if (verbs[i] !== F7_VERBS[i]) {
      return { ok: false, reason: i === F7_DISMISS_INDEX ? 'dismiss_required' : 'verb_order_mismatch' };
    }
  }
  return { ok: true };
}

/**
 * Render the F.7 Breakthrough Surface.
 *
 * @param {object} args
 * @param {number} [args.tier]         tier integer; informational only -- F.7 is closed-vocab
 *                                     in every tier (no recommended marker; no mode branch)
 * @param {string} [args.header]       caller-supplied header line; default 'Breakthrough'
 * @param {object} args.breakthrough   the breakthrough candidate (must carry artifact_ids[])
 * @param {number} [args.more_count]   non-negative integer; number of queued candidates
 *                                     surfaced via the "More breakthroughs (N)" footer
 * @param {string} [args.voice_line]   Phase 120-03 D-17 additive slot. When present + non-empty,
 *                                     prepended as the first line of zones.body above the title.
 *                                     Caller (Plan 120-03 scanner.surfaceBreakthrough) audits
 *                                     the line via voice-scaffold.auditVoiceLine before passing;
 *                                     this renderer does NOT re-audit (single source of truth).
 *
 * @returns {object} { zones: {header, body, footer}, contract: {...} }  OR
 *                   { error: 'provenance_required' | 'dismiss_required' | 'verb_count_mismatch' | 'verb_order_mismatch' }
 */
function renderShapeF7Breakthrough(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const more_count = (Number.isInteger(a.more_count) && a.more_count >= 0) ? a.more_count : 0;
  const bk = a.breakthrough;

  // D-20 HARD FLOOR defense in depth -- refuse to render a provenance-less
  // breakthrough. The Plan 120-00 schema layer rejects writes with empty
  // artifact_ids; this is the SECOND structural enforcement point at the
  // surface layer (in case writeBreakthrough is somehow bypassed).
  if (!bk || typeof bk !== 'object' || !Array.isArray(bk.artifact_ids) || bk.artifact_ids.length === 0) {
    return { error: 'provenance_required' };
  }

  // Build the locked-verbatim verbs array and assert the D-10 invariants.
  // Defense in depth: the source-of-truth F7_VERBS is Object.freeze-d above;
  // assertContractInvariants on the mutable copy gives a final structural
  // assertion before composition.
  const verbs = F7_VERBS.slice();
  const check = assertContractInvariants(verbs);
  if (!check.ok) {
    return { error: check.reason };
  }

  // Row 1 (title): kind capitalized + theme + time anchor.
  // Theme is sliced to 120 chars at the surface layer (defense in depth on top
  // of the schema-layer 200-char sanitizer in Plan 120-00).
  const kindKey = (typeof bk.kind === 'string') ? bk.kind : '';
  const kindDisplay = KIND_DISPLAY_NAMES[kindKey] || kindKey || 'Pattern';
  const themeRaw = (typeof bk.theme === 'string') ? bk.theme : '';
  const theme = themeRaw.slice(0, 120);
  const timeAnchor = formatTimeAnchor(bk.detected_at || Date.now());
  const titleLine = kindDisplay + (theme ? ': ' + theme : '') + ' (' + timeAnchor + ')';

  // Row 2 (verbs): the 5 verbs in [X] brackets, separated by double-space.
  // Bracket style matches the F.4 / F.6 closed-vocab convention.
  const verbsLine = verbs.map(function (v) { return '[' + v + ']'; }).join('  ');

  // Phase 120-03 D-17 additive: optional voice_line prepend.
  //
  // When args.voice_line is a non-empty string, it is prepended as the FIRST line
  // of zones.body, above the title line. This is the conversational opener
  // composed by Plan 120-03 voice-scaffold.composeBreakthroughVoiceLine. The
  // caller (scanner.surfaceBreakthrough) audits the line via auditVoiceLine
  // before passing; this renderer does NOT re-audit (single source of truth, no
  // duplicated regex logic at the surface layer).
  //
  // The contract.verbs / freeTextOffered / recommended / breakthrough_id /
  // more_count fields are PRESERVED byte-stably across both branches (with-line
  // and without-line). Plan 120-01 11-test byte-stability invariant is preserved
  // when voice_line is absent (the without-line branch is the legacy code path).
  const voiceLineRaw = (typeof a.voice_line === 'string') ? a.voice_line : '';
  const voiceLine = voiceLineRaw.length > 0 ? voiceLineRaw : '';
  const body = voiceLine
    ? (voiceLine + '\n' + titleLine + '\n' + verbsLine)
    : (titleLine + '\n' + verbsLine);

  const header = (typeof a.header === 'string' && a.header.length > 0) ? a.header : 'Breakthrough';
  // D-11 affordance: only surface "More breakthroughs (N)" when N > 0; empty
  // footer otherwise so the renderer never lies about queued candidates.
  const footer = (more_count > 0) ? ('More breakthroughs (' + more_count + ')') : '';

  return {
    zones: {
      header: header,
      body: body,
      signals: '',
      footer: footer,
    },
    contract: {
      shape: 'F.7',
      keyboard: 'askuserquestion',
      verbs: verbs,
      freeTextOffered: false,    // closed-vocab; mirrors F.3 / F.4 / F.6 plan-review
      mode: 'closed',
      recommended: null,         // closed-vocab does not mark a recommended verb
      breakthrough_id: bk.id,
      more_count: more_count,
    },
  };
}

module.exports = {
  renderShapeF7Breakthrough: renderShapeF7Breakthrough,
  F7_VERBS: F7_VERBS,
  F7_DISMISS_INDEX: F7_DISMISS_INDEX,
  formatTimeAnchor: formatTimeAnchor,
  assertContractInvariants: assertContractInvariants,
  KIND_DISPLAY_NAMES: KIND_DISPLAY_NAMES,
};
