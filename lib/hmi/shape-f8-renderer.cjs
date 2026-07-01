'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-06 -- Shape F.8 Multi-Select Action Set renderer (SFS-01).
 * ============================================================================
 * F.8 is the multiSelect / toggle Decision surface of the AskUserQuestion-backed
 * Shape F selector family. Unlike F.5 (open-vocab, ONE recommended marker), F.8
 * renders a SET the navigator toggles on/off and confirms ONCE -> a fan-out
 * (D-05 / D-06). The menu shape matches the decision shape: a SET of independent
 * actions surfaces as a toggle basket, not a single-select prose offer (the GIX
 * motivating bug).
 *
 * Envelope cloned from shape-f5-renderer.cjs: renderShapeF8(input) -> {zones, contract}.
 *
 * D-05 (frozen-scalar fence): F.8's toggle bound is its OWN scalar MAX_TOGGLE_N,
 * DISTINCT from the frozen MAX_K=3 (which bounds the ranked candidate set only and
 * is byte-untouched here). Overflow beyond the AskUserQuestion ~4-5 ceiling PAGES,
 * it NEVER truncates: contract carries the full option set + a page count.
 *
 * D-06 (no single recommended marker): F.8 carries NO single recommended glyph
 * (contract.recommended === null). A candidate whose Brain confidence is >=0.70
 * renders as a PRE-CHECKED toggle (reusing the frozen 0.70 threshold, NO new
 * scalar, NO glyph); pre-checked is DISPLAY-ONLY and NEVER auto-applies -- nothing
 * fires until the single confirm (the consumer only ever sees the CONFIRMED set).
 *
 * Toggle glyphs are the approved-12 vocabulary members (checkmark / empty-square),
 * NEVER the F.5 recommended triangle. Pure CJS, node built-ins only, zero deps
 * (Phase 87). No em-dashes. No emoji.
 *
 * API:
 *   renderShapeF8({ options, header?, tier?, personaContext? }) -> { zones, contract }
 *     options: array of <string> or <{ label, confidence? }>. A confidence >=0.70
 *              renders the toggle PRE-CHECKED (display-only).
 */

// The toggle bound scalar. DISTINCT from the frozen MAX_K=3 (Part 3): F.8's set
// is capped by MAX_TOGGLE_N against the AskUserQuestion ~4-5 option ceiling, and
// overflow PAGES rather than truncates. MUST NOT equal 3.
const MAX_TOGGLE_N = 4;

// The frozen pre-check threshold (reused, NOT minted). A candidate at or above
// this Brain confidence renders PRE-CHECKED (display-only; never auto-applied).
const PRE_CHECK_THRESHOLD = 0.70;

// Approved-12 toggle glyphs (skills/ui-system/SKILL.md: checkmark / empty-square).
// Never the F.5 recommended triangle.
const GLYPH_CHECKED = '✓';   // checkmark
const GLYPH_UNCHECKED = '▢'; // empty-square (white square with rounded corners)

function defaultHeader() {
  return '-- mindrianOS -- actions -- select --';
}

// Normalize a raw option (string OR { label, confidence }) into a canonical
// { label, confidence } shape. A non-string / empty label is dropped upstream.
function _normalizeOption(raw) {
  if (typeof raw === 'string') {
    return raw.length > 0 ? { label: raw, confidence: null } : null;
  }
  if (raw && typeof raw === 'object' && typeof raw.label === 'string' && raw.label.length > 0) {
    const conf = (typeof raw.confidence === 'number' && Number.isFinite(raw.confidence))
      ? raw.confidence : null;
    return { label: raw.label, confidence: conf };
  }
  return null;
}

function renderShapeF8(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const header = (typeof opts.header === 'string' && opts.header.length > 0)
    ? opts.header : null;
  const personaContext = (typeof opts.personaContext === 'string' && opts.personaContext.length > 0)
    ? opts.personaContext : null;

  // Normalize + de-dup the incoming candidate set (silent drop of empties).
  const seen = new Set();
  const normalized = [];
  const rawOptions = Array.isArray(opts.options) ? opts.options : [];
  for (const r of rawOptions) {
    const n = _normalizeOption(r);
    if (!n) continue;
    if (seen.has(n.label)) continue;
    seen.add(n.label);
    normalized.push(n);
  }

  // D-05: PAGE overflow beyond MAX_TOGGLE_N, never truncate. The full set stays on
  // the contract; the current card body shows the first page only (the ~4-5 ceiling).
  const total = normalized.length;
  const pages = total > 0 ? Math.ceil(total / MAX_TOGGLE_N) : 1;
  const paged = pages > 1;
  const pageItems = normalized.slice(0, MAX_TOGGLE_N);

  // D-06: a candidate at/above the frozen 0.70 renders PRE-CHECKED (display-only,
  // never auto-applied). Collect the pre-checked LABELS (not a single marker).
  const preChecked = [];
  for (const o of normalized) {
    if (typeof o.confidence === 'number' && o.confidence >= PRE_CHECK_THRESHOLD) {
      preChecked.push(o.label);
    }
  }
  const preCheckedSet = new Set(preChecked);

  // Body: toggle rows with approved-12 glyphs (checkmark for pre-checked,
  // empty-square otherwise). NEVER the F.5 recommended triangle.
  const lines = pageItems.map((o, i) => {
    const glyph = preCheckedSet.has(o.label) ? GLYPH_CHECKED : GLYPH_UNCHECKED;
    return glyph + ' ' + String(i + 1) + '. ' + o.label;
  });

  let composedHeader = header || defaultHeader();
  if (personaContext) {
    composedHeader = composedHeader + ' (' + personaContext + ' lens)';
  }

  return {
    zones: {
      header: composedHeader,
      body: lines.join('\n'),
      signals: paged ? ('page 1 of ' + pages) : '',
      footer: null,
    },
    contract: {
      shape: 'F.8',
      keyboard: 'askuserquestion',
      multiSelect: true,
      // D-06: NO single recommended marker on a toggle set.
      recommended: null,
      // F.8 is a closed toggle basket -- no Free-Text toggle (keeps ensureFreeTextLast
      // from injecting a spurious verb into the multiSelect contract).
      freeTextOffered: false,
      // The full (unpaged) option labels, so a downstream host can page through them.
      options: normalized.map((o) => o.label),
      // D-05: paging obligation surfaced (overflow PAGES, never truncates).
      paged: paged,
      pages: pages,
      maxToggleN: MAX_TOGGLE_N,
      // D-06: labels rendered PRE-CHECKED (display-only; never auto-applied).
      preChecked: preChecked,
      personaContext: personaContext,
    },
  };
}

module.exports = {
  renderShapeF8: renderShapeF8,
  MAX_TOGGLE_N: MAX_TOGGLE_N,
  PRE_CHECK_THRESHOLD: PRE_CHECK_THRESHOLD,
};
