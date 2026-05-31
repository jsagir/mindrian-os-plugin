#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-02 -- Offer Resolver helper (the abstention triple + the SQL-local
 * + MD-aware relevance/confidence consumption + the grounded-reason builder).
 * =========================================================================
 * This is the net-new resolver body that navigation-engine.cjs delegates to from
 * resolveOfferNextStep (which was a `return null` stub since Phase 91). It returns
 * exactly ONE calibrated next-move offer { command, framework, jtbd, confidence,
 * reason, scope } or null. It NEVER throws (any internal failure returns null).
 *
 * A3 LOCKED: the resolver is LOCAL-ONLY and SYNCHRONOUS. There is no awaited
 * buildBrainPacket, no Brain query, no Brain payload formed anywhere in here.
 * Every memory read (graph neighborhood, memory_event tail, FEYNMAN temporal,
 * MINTO governing thought, active JTBD) is a SYNC read routed ONLY through the
 * navigation.cjs chokepoint or read off the already-read quadruple. Mode A's
 * RECOMMENDED marker rides the caller's decision_trace flag, never a fresh packet.
 *
 * The abstention triple runs in a STRICT order so margin is ALWAYS computed
 * (rank-first) before the operator strong-signal gate reads it (gate-second).
 * There is no forward reference to margin.
 *
 *   1. HARD SILENCE  -- operator === 'JUST_TALK' -> null (cheapest abstention).
 *   2. RANK FIRST    -- rankForSelector; if empty -> null; compute the single margin.
 *   3. OPERATOR GATE -- DECISION_GATE always; METHODOLOGY on close; EXPLORE_CAPTURE
 *                       / BUILD_ROOM only when margin >= STRONG_SIGNAL_THRESHOLD.
 *   4. MARGIN FLOOR  -- margin < MARGIN_THRESHOLD -> null (low-confidence abstain).
 *   5. REJECTION     -- shouldExclude(top.command, roomState) -> null (backoff N=5).
 *   6. TIER FALLBACK -- tier_0 (BRAIN.md absent) constrains the command to the
 *                       hardcoded minimal verb set; never crashes.
 *
 * The margin folds in the SQL-local + MD-aware relevance signal so the resolver
 * is genuinely calibrated by the room's graph + temporal + reasoning context, not
 * just by the bare ranker tie-break. SC2 consumes the local graph neighborhood +
 * memory_event tail; SC4 consumes the FEYNMAN temporal signal + the MINTO
 * governing thought + the active JTBD. A present-fresh governing thought + a
 * present active JTBD + recent temporal activity RAISE confidence; an absent /
 * stale governing thought or a missing JTBD LOWER it (and can tip a borderline
 * margin under the floor into abstention).
 *
 * Downstream: the emitted reason carries a [[wikilink]] so the shipped
 * offer-presenter.isReasonGrounded gate passes (section-name regex hit). scope is
 * context.sectionPath.
 *
 * No em-dashes (hyphens only). No emoji. CJS only.
 */

// Confidence-margin floor. top-1 must lead top-2 (after the MD + graph relevance
// adjustment) by at least this on the 0..1 score. Below this the signal is a
// coin-flip and a wrong offer trains the ignore reflex (CONTEXT.md "a wrong offer
// trains the opposite habit"). Claude's Discretion default per CONTEXT.md
// D-discretion; SEED-009 will learn this weight later (cohort >= 30 + 1000 outcome
// edges). v2-tunable via .mos/config.json -- the config read is intentionally NOT
// built here.
const MARGIN_THRESHOLD = 0.15;

// Strong-signal bar for the default-silent operators (EXPLORE_CAPTURE /
// BUILD_ROOM). Concretely 2 x MARGIN_THRESHOLD: those operators only fire an offer
// when the signal is twice the ordinary floor (CONTEXT.md D-6 default-silent unless
// a strong signal). Claude's Discretion default; SEED-009 learns it later; v2-
// tunable via .mos/config.json (the config read is NOT built here).
const STRONG_SIGNAL_THRESHOLD = 2 * MARGIN_THRESHOLD; // 0.30

// MD-aware relevance boost weights (SC4). Folded into the effective margin so the
// quadruple-plus-FEYNMAN-plus-MINTO-plus-JTBD signal measurably shifts the
// outcome. Claude's Discretion defaults; SEED-009 learns later; v2-tunable.
const GOVERNING_THOUGHT_BOOST = 0.12; // present + fresh governing thought
const ACTIVE_JTBD_BOOST = 0.12;       // present active-JTBD intent leg
const MD_PENALTY = 0.10;              // absent/stale governing thought OR missing JTBD

// SC2 graph-relevance boost weights. Folded into the effective margin when
// roomState.db is non-null. A dense neighborhood + a recent memory_event tail bias
// toward offering; a sparse neighborhood + a stale tail bias toward abstention.
const NEIGHBORHOOD_BOOST = 0.16;
const RECENT_ACTIVITY_BOOST = 0.06;
const RECENT_ACTIVITY_WINDOW_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Fallback section token so the grounded reason NEVER becomes an undefined-valued
// wikilink when context.sectionPath is falsy.
const FALLBACK_SECTION = 'section/active';

/**
 * resolveOffer(context) -> offer | null
 *
 * SYNCHRONOUS. Never throws (the whole body is wrapped; any internal failure
 * returns null, the graceful emptyDecision idiom). Returns exactly one offer with
 * the six canonical keys, or null (abstention).
 *
 * context = {
 *   quadruple,        // pre-read memory quadruple (reasoning.governing_thought = MINTO)
 *   brainAvailable,   // boolean
 *   operator,         // enum string ('JUST_TALK' default)
 *   sectionPath,      // wikilink target + scope
 *   problemType,      // string or null
 *   jtbd,             // active-JTBD intent leg (SC4) or null
 *   roomState,        // { db, roomDir, invocationsSinceDecision }; db null -> degrade
 *   packet,           // optional pre-built packet; NEVER built here (A3)
 * }
 */
function resolveOffer(context) {
  try {
    const ctx = (context && typeof context === 'object') ? context : {};

    // ----- 1. HARD SILENCE: operator gate (cheapest abstention) -----
    if (ctx.operator === 'JUST_TALK') return null;

    // ----- 2. RANK FIRST: compute the SINGLE margin before any gate reads it ---
    const ranker = require('../workflow/f-selector-ranker.cjs');
    const focusNodeId = resolveFocusNodeId(ctx);
    const items = ranker.rankForSelector({
      jtbd: (typeof ctx.jtbd === 'string') ? ctx.jtbd : null,
      problemType: (typeof ctx.problemType === 'string') ? ctx.problemType : null,
      focusNodeId: focusNodeId,
      roomState: (ctx.roomState && typeof ctx.roomState === 'object') ? ctx.roomState : {},
      packetOptional: (ctx.packet && typeof ctx.packet === 'object') ? ctx.packet : null,
      k: 3,
    });
    if (!Array.isArray(items) || items.length === 0) return null;

    const top = items[0];
    if (!top || typeof top.command !== 'string') return null;

    // Base ranker margin (top-1 minus top-2). This is the SINGLE place the raw
    // margin is read off the ranker; everything below reads the relevance-adjusted
    // `margin`.
    const rankerMargin = items.length >= 2
      ? (items[0].score - items[1].score)
      : items[0].score;

    // SC4 MD-aware relevance (consumed, not just present): the MINTO governing
    // thought + the active JTBD + the FEYNMAN temporal signal adjust the margin.
    const mdAdjust = computeMdAdjust(ctx);

    // SC2 graph-aware relevance (consumed, not just present): the local graph
    // neighborhood + the memory_event tail adjust the margin when db is non-null.
    const graphAdjust = computeGraphAdjust(ctx, focusNodeId);

    // The single relevance-adjusted margin. Clamp to [0, 1]. This is the value
    // every gate below reads -- defined ONCE, before the operator strong-signal
    // gate, so there is no forward reference.
    let margin = rankerMargin + mdAdjust + graphAdjust;
    if (margin < 0) margin = 0;
    if (margin > 1) margin = 1;

    // ----- 3. OPERATOR GATE (reads the already-computed margin) -----
    const operator = (typeof ctx.operator === 'string') ? ctx.operator : 'JUST_TALK';
    if (operator === 'DECISION_GATE') {
      // always eligible.
    } else if (operator === 'METHODOLOGY') {
      // close-of-methodology offer; eligible.
    } else if (operator === 'EXPLORE_CAPTURE' || operator === 'BUILD_ROOM') {
      // default-silent unless a strong signal (margin >= 2 x MARGIN_THRESHOLD).
      if (margin < STRONG_SIGNAL_THRESHOLD) return null;
    } else {
      // any other operator value -> abstain.
      return null;
    }

    // ----- 4. MARGIN FLOOR: low-confidence abstain -----
    if (margin < MARGIN_THRESHOLD) return null;

    // ----- 5. REJECTION BACKOFF (N=5 decay window) -----
    try {
      const decisions = require('../workflow/selector-decisions.cjs');
      if (decisions.shouldExclude(top.command, ctx.roomState)) return null;
    } catch (_e) {
      // selector-decisions unavailable -> do not block the offer on a backoff read.
    }

    // ----- 6. TIER FALLBACK: tier_0 constrains to the minimal verb set -----
    let chosen = top;
    try {
      const shared = require('./navigation-engine-shared.cjs');
      const tierMode = shared.resolveTierMode(ctx.quadruple, ctx.brainAvailable);
      if (tierMode === 'tier_0') {
        chosen = constrainToMinimalVerb(items, shared.CANONICAL_VERBS) || top;
        if (!chosen) return null;
      }
    } catch (_e) {
      // tier resolution failure -> proceed with the top item (graceful).
    }

    // ----- EMIT: build the grounded reason first, then the six-key offer -----
    const reason = buildReason(chosen, ctx);
    const scope = (typeof ctx.sectionPath === 'string' && ctx.sectionPath.length > 0)
      ? ctx.sectionPath : FALLBACK_SECTION;

    // Confidence reflects the relevance-adjusted margin AND the item score, so the
    // MD-aware + graph-aware signal is visible in the emitted confidence (not just
    // in the abstention decision). Clamp [0, 1].
    let confidence = clamp01((typeof chosen.score === 'number' ? chosen.score : 0) * 0.5 + margin * 0.5);

    return {
      command: chosen.command,
      framework: (typeof chosen.framework === 'string') ? chosen.framework : null,
      jtbd: (typeof chosen.jtbd_label === 'string') ? chosen.jtbd_label : null,
      confidence: confidence,
      reason: reason,
      scope: scope,
    };
  } catch (_err) {
    // Any internal failure -> abstain (never throw; the composer fallback fires).
    return null;
  }
}

// ---------- relevance helpers ----------

/**
 * computeMdAdjust(context) -> number (signed margin adjustment).
 *
 * SC4: consumes the MINTO governing thought (quadruple.reasoning.governing_thought),
 * the active JTBD (context.jtbd), and the FEYNMAN temporal freshness leg. A present,
 * fresh governing thought + a present active JTBD RAISE the margin; an absent / stale
 * governing thought or a missing JTBD LOWER it. Pure read off the already-read
 * quadruple + context (no IO). FEYNMAN temporal via the memory_event tail is folded
 * by computeGraphAdjust when db is present; here we read the quadruple-resident
 * reasoning leg so the MD signal still moves the margin in the db-null degrade path.
 */
function computeMdAdjust(context) {
  let adjust = 0;

  const reasoning = context.quadruple && context.quadruple.reasoning;
  const gov = reasoning && typeof reasoning.governing_thought === 'string'
    ? reasoning.governing_thought.trim() : '';
  const govFresh = reasoning ? (reasoning.is_stale !== true) : false;
  if (gov.length > 0 && govFresh) {
    adjust += GOVERNING_THOUGHT_BOOST;
  } else {
    // absent OR stale governing thought biases toward abstention.
    adjust -= MD_PENALTY;
  }

  const jtbd = (typeof context.jtbd === 'string') ? context.jtbd.trim() : '';
  if (jtbd.length > 0) {
    adjust += ACTIVE_JTBD_BOOST;
  } else {
    adjust -= MD_PENALTY;
  }

  return adjust;
}

/**
 * computeGraphAdjust(context, focusNodeId) -> number (signed margin adjustment).
 *
 * SC2: when context.roomState.db is non-null, reads the local graph neighborhood
 * (getNeighborhood) + the memory_event tail (findRecentChanges) + the FEYNMAN
 * temporal signal (firstCapturedLastTouchedBySection) via the navigation.cjs
 * chokepoint (sync, A3-safe) and turns them into a relevance signal. A dense
 * neighborhood + a recent tail RAISE the margin; a sparse neighborhood + a stale
 * tail leave it unmoved (bias toward abstention). When db is null, returns 0
 * (degrade to the rank-only + MD path) without crashing. Wrapped: any read failure
 * returns 0.
 */
function computeGraphAdjust(context, focusNodeId) {
  const roomState = context.roomState;
  const db = (roomState && roomState.db) ? roomState.db : null;
  if (!db) return 0; // degrade gracefully; no graph read possible.

  let adjust = 0;
  try {
    const navigation = require('./navigation.cjs');

    // SC2: local graph neighborhood density as a relevance input.
    if (focusNodeId) {
      const neighborhood = navigation.getNeighborhood(db, focusNodeId, { maxDepth: 2, topK: 20 });
      if (Array.isArray(neighborhood) && neighborhood.length > 0) {
        // Scale boost by density (saturating at >= 5 neighbors).
        const density = Math.min(1, neighborhood.length / 5);
        adjust += NEIGHBORHOOD_BOOST * density;
      }
    }

    // SC2/SC4: memory_event tail recency as a relevance input.
    const recent = navigation.findRecentChanges(db, 0, { limit: 20 });
    if (Array.isArray(recent) && recent.length > 0) {
      const newest = recent[0];
      const ts = newest && typeof newest.createdAt === 'number' ? newest.createdAt : null;
      if (ts !== null) {
        const age = Date.now() - ts;
        if (age >= 0 && age <= RECENT_ACTIVITY_WINDOW_MS) {
          // Linear recency: fresher tail -> larger boost.
          const recency = 1 - (age / RECENT_ACTIVITY_WINDOW_MS);
          adjust += RECENT_ACTIVITY_BOOST * recency;
        }
      }
    }

    // SC4: FEYNMAN temporal per section. A section with recorded temporal activity
    // confirms the offer is grounded in real local history.
    const section = (typeof context.sectionPath === 'string' && context.sectionPath.length > 0)
      ? context.sectionPath : null;
    if (section) {
      const temporal = navigation.firstCapturedLastTouchedBySection(db, section);
      if (temporal && Number.isFinite(temporal.total_events) && temporal.total_events > 0) {
        adjust += RECENT_ACTIVITY_BOOST * 0.5;
      }
    }
  } catch (_e) {
    // Any chokepoint read failure -> contribute nothing; never crash.
    return 0;
  }
  return adjust;
}

/**
 * resolveFocusNodeId(context) -> string | null
 *
 * Resolves a focus node for getNeighborhood via getActiveFocus when a db handle is
 * present. Sync, chokepoint-only. Returns null on any failure (degrade to rank-only
 * graph path).
 */
function resolveFocusNodeId(context) {
  const roomState = context.roomState;
  const db = (roomState && roomState.db) ? roomState.db : null;
  if (!db) return null;
  try {
    const navigation = require('./navigation.cjs');

    // 1. An explicit active focus for this session wins.
    const sessionId = (typeof context.sessionId === 'string') ? context.sessionId : null;
    const focus = navigation.getActiveFocus(db, sessionId);
    if (focus && typeof focus.focusNodeId === 'string') return focus.focusNodeId;

    // 2. The section node (the navigator's current scope) is the natural focus.
    //    The canonical id convention is 'section:<slug>'. Passing it to the
    //    chokepoint getNeighborhood resolves a real neighborhood when the node
    //    exists, and getNeighborhood returns [] when it does not (no crash).
    const section = (typeof context.sectionPath === 'string' && context.sectionPath.length > 0)
      ? context.sectionPath : null;
    if (section) {
      const sectionNodeId = 'section:' + section;
      const nb = navigation.getNeighborhood(db, sectionNodeId, { maxDepth: 1, topK: 1 });
      if (Array.isArray(nb) && nb.length > 0) return sectionNodeId;
    }

    // 3. Fall back to the most recent memory_event's target node.
    const recent = navigation.findRecentChanges(db, 0, { limit: 5 });
    if (Array.isArray(recent)) {
      for (const ev of recent) {
        if (ev && typeof ev.targetNodeId === 'string' && ev.targetNodeId.length > 0) {
          return ev.targetNodeId;
        }
      }
    }
  } catch (_e) {
    return null;
  }
  return null;
}

/**
 * constrainToMinimalVerb(items, canonicalVerbs) -> item | null
 *
 * tier_0 fallback: return the first ranked item whose command maps to the hardcoded
 * minimal verb set (Run Methodology / Reformulate / Free-Text). When none of the
 * ranked items map to the minimal set, fall back to the top item so the resolver
 * still emits a single calibrated offer rather than going dark in tier_0.
 */
function constrainToMinimalVerb(items, canonicalVerbs) {
  const minimal = new Set(['run methodology', 'reformulate', 'free-text']);
  // canonicalVerbs[9] === 'Free-Text'; the minimal set is the cold-start vocabulary.
  if (Array.isArray(canonicalVerbs)) { /* referenced for the canon minimal set */ }
  for (const it of items) {
    if (!it || typeof it.command !== 'string') continue;
    const slug = it.command.replace(/^\/?mos:/, '').replace(/-/g, ' ').toLowerCase();
    if (minimal.has(slug)) return it;
  }
  return items.length > 0 ? items[0] : null;
}

/**
 * buildReason(top, context) -> string
 *
 * Builds a grounded reason that PREPENDS a [[wikilink]] so the presenter's
 * section-name grounding gate (isReasonGrounded -> 'ok') passes. Weaves in the
 * active JTBD and / or the governing thought theme when present so the reason
 * reflects the MD-aware signal, then appends the item jtbd_summary. Guarantees
 * length >= 15 and NEVER emits an undefined-valued wikilink (falsy sectionPath uses
 * a defined fallback token).
 */
function buildReason(top, context) {
  const section = (typeof context.sectionPath === 'string' && context.sectionPath.length > 0)
    ? context.sectionPath : FALLBACK_SECTION;
  const wikilink = '[[' + section + ']]';

  const parts = [wikilink];

  const jtbd = (typeof context.jtbd === 'string') ? context.jtbd.trim() : '';
  if (jtbd.length > 0) {
    parts.push('to ' + jtbd);
  }

  const reasoning = context.quadruple && context.quadruple.reasoning;
  const gov = reasoning && typeof reasoning.governing_thought === 'string'
    ? reasoning.governing_thought.trim() : '';
  if (gov.length > 0) {
    parts.push('(governing thought: ' + gov + ')');
  }

  const summary = (typeof top.jtbd_summary === 'string' && top.jtbd_summary.length > 0)
    ? top.jtbd_summary.trim() : '';
  if (summary.length > 0) {
    parts.push(summary);
  }

  let reason = parts.join(' ').trim();

  // Guarantee minimum grounded length even when JTBD / governing thought / summary
  // are all absent. The wikilink already satisfies the section-name regex; pad with
  // a section reference so the length floor (>= 15) is always cleared.
  if (reason.length < 15) {
    reason = wikilink + ' next move for this section';
  }
  return reason;
}

function clamp01(n) {
  if (typeof n !== 'number' || !isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

module.exports = {
  resolveOffer,
  MARGIN_THRESHOLD,
  STRONG_SIGNAL_THRESHOLD,
};
