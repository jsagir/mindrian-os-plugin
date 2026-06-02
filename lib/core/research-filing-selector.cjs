'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 131-04 -- research-filing-selector.cjs
 * ============================================
 * The Stage 6 F.1 filing gate for a ranked research finding. It MIRRORS the
 * shipped lib/hmi/selector-dispatcher.cjs F.1 sub-shape -- it is NOT a bespoke
 * research selector. The gate is produced by routing through the dispatcher's
 * pickShape({ requestedShape: 'F.1', ... }) entry point (which dispatches the F.1
 * sub-shape internally via dispatchShapeFSubShape). Because the gate is a
 * dispatcher-produced Shape F.1 envelope, Phase 136's richer multi-select filing
 * widget is a strict SUPERSET of this one (the LOCKED forward contract): the
 * widget adds rows / context, it never changes the gate-as-write-node shape.
 *
 * The five filing options map onto the closed verb vocabulary (Canon Part 3 F.1
 * Next Move): File to primary section / File to secondary section / Split /
 * Defer to milestone audit / Reject. Per the 4.8 re-baseline (open-decision 1
 * re-resolved), in Mode A when the primary match clears the 0.7 confidence gate
 * we PRE-FILL one confident recommendation (the File-to-primary verb) rather than
 * a generic prompt -- but the human gate stays (Canon Part 9 role 5). The
 * recommend marker only renders in Mode A at confidence >= 0.7 (Phase 88.2
 * invariant, enforced by the dispatcher, not re-implemented here).
 *
 * Defensive: empty candidateSections degrades to a Defer/Reject-only selector.
 * NO bespoke AskUserQuestion construction. NO em-dashes. NO fenced code.
 *
 * Exports:
 *   buildFilingSelector(finding, candidateSections, opts)
 *     -> { envelope, options }
 *   where envelope is the dispatcher Shape F.1 return ({ shape:'F.1', rendered })
 *   and options is the parsed { primary, secondary, split, defer, reject } map the
 *   Stage 7 wirer (findings-wirer.cjs) consumes to build a decision.
 *
 * License: BSL 1.1.
 */

const dispatcher = require('../hmi/selector-dispatcher.cjs');

// The closed-vocabulary filing verbs (Canon Part 3 F.1 Next Move family). The
// percent-match suffix is rendered into the verb label so the navigator sees the
// confidence at the gate; the canonical verb stem is preserved for the wirer.
const VERB_FILE_PRIMARY = 'File to primary section';
const VERB_FILE_SECONDARY = 'File to secondary section';
const VERB_SPLIT = 'Split: primary + reference';
const VERB_DEFER = 'Defer to milestone audit';
const VERB_REJECT = 'Reject';

// The 0.7 confidence gate (Phase 88.2 invariant). A primary match at or above
// this clears the Mode A pre-filled recommendation.
const CONFIDENCE_GATE = 0.7;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Render a percent string from a 0..1 match fraction (or a raw integer percent).
function pctLabel(matchPct) {
  let n = Number(matchPct);
  if (!Number.isFinite(n) || n < 0) n = 0;
  // Accept either a 0..1 fraction or an already-scaled 0..100 percent.
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return String(pct) + '%';
}

/**
 * buildFilingSelector(finding, candidateSections, opts) -> { envelope, options }
 *
 * candidateSections: an array of { section, match_pct, target_id, target_kind }
 *   sorted descending by match_pct (target_kind is 'local' or 'teaching-graph').
 *   The highest-match entry is the primary; the second is the secondary.
 * opts: { mode?, tier?, header? }. mode 'A' (Full Loop) renders the pre-filled
 *   recommendation when the primary clears the 0.7 gate; mode 'B' (Local Only)
 *   never marks a recommendation. tier is forwarded to the dispatcher (defaults
 *   so Mode A -> tier 2, Mode B -> tier 1) so the dispatcher's own Mode mapping
 *   agrees with the requested mode without re-implementing the tier logic.
 *
 * Never throws on caller input. Empty candidateSections degrades to a
 * Defer/Reject-only selector.
 */
function buildFilingSelector(finding, candidateSections, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const mode = (o.mode === 'A' || o.mode === 'B') ? o.mode : 'A';
  // Map the requested mode to the tier the dispatcher reads (Mode A needs tier
  // >= 2 to render the RECOMMENDED marker; Mode B is tier 1). An explicit tier
  // override wins.
  const tier = (typeof o.tier === 'number' && Number.isFinite(o.tier))
    ? o.tier
    : (mode === 'A' ? 2 : 1);
  const header = (typeof o.header === 'string' && o.header.length > 0)
    ? o.header
    : '-- mindrianOS -- file this finding -- pick a destination --';

  const cands = Array.isArray(candidateSections)
    ? candidateSections.filter(function (c) { return isPlainObject(c); })
    : [];

  const primary = cands.length > 0 ? cands[0] : null;
  const secondary = cands.length > 1 ? cands[1] : null;

  // Compose the verb list + the parsed options map in lockstep. When there are
  // no candidate destinations, degrade to a Defer/Reject-only selector.
  const verbs = [];
  const options = {
    primary: null,
    secondary: null,
    split: null,
    defer: { verb: VERB_DEFER, kind: 'defer' },
    reject: { verb: VERB_REJECT, kind: 'reject' },
  };

  if (primary) {
    const pLabel = VERB_FILE_PRIMARY + ' (' + pctLabel(primary.match_pct) + ' match)';
    verbs.push(pLabel);
    options.primary = {
      verb: pLabel,
      section: typeof primary.section === 'string' ? primary.section : '',
      target_id: typeof primary.target_id === 'string' ? primary.target_id : '',
      target_kind: primary.target_kind === 'teaching-graph' ? 'teaching-graph' : 'local',
      match_pct: Number(primary.match_pct) || 0,
      kind: 'file_primary',
    };
  }
  if (secondary) {
    const sLabel = VERB_FILE_SECONDARY + ' (' + pctLabel(secondary.match_pct) + ' match)';
    verbs.push(sLabel);
    options.secondary = {
      verb: sLabel,
      section: typeof secondary.section === 'string' ? secondary.section : '',
      target_id: typeof secondary.target_id === 'string' ? secondary.target_id : '',
      target_kind: secondary.target_kind === 'teaching-graph' ? 'teaching-graph' : 'local',
      match_pct: Number(secondary.match_pct) || 0,
      kind: 'file_secondary',
    };
    // Split is only meaningful when there are at least two destinations.
    verbs.push(VERB_SPLIT);
    options.split = {
      verb: VERB_SPLIT,
      primary: options.primary,
      secondary: options.secondary,
      kind: 'split',
    };
  }
  // Defer + Reject are always present (Canon Part 3 F.1 family + the
  // rejection-as-data mandate).
  verbs.push(VERB_DEFER);
  verbs.push(VERB_REJECT);

  // Mode A pre-filled recommendation: the File-to-primary verb when the primary
  // match clears the 0.7 gate. The dispatcher only renders the marker in Mode A
  // (tier >= 2); below the gate, no recommendation is passed.
  let recommendedVerb = null;
  if (mode === 'A' && options.primary) {
    let frac = Number(options.primary.match_pct);
    if (!Number.isFinite(frac)) frac = 0;
    if (frac > 1) frac = frac / 100; // normalize a 0..100 percent to a fraction
    if (frac >= CONFIDENCE_GATE) {
      recommendedVerb = options.primary.verb;
    }
  }

  let envelope;
  try {
    envelope = dispatcher.pickShape({
      requestedShape: 'F.1',
      tier: tier,
      payload: {
        verbs: verbs,
        recommendedVerb: recommendedVerb,
        header: header,
      },
    });
  } catch (_e) {
    envelope = { shape: 'error', rendered: { error: 'filing_selector_dispatch_failed' } };
  }

  return { envelope: envelope, options: options };
}

module.exports = {
  buildFilingSelector: buildFilingSelector,
  CONFIDENCE_GATE: CONFIDENCE_GATE,
  VERB_FILE_PRIMARY: VERB_FILE_PRIMARY,
  VERB_FILE_SECONDARY: VERB_FILE_SECONDARY,
  VERB_SPLIT: VERB_SPLIT,
  VERB_DEFER: VERB_DEFER,
  VERB_REJECT: VERB_REJECT,
};
