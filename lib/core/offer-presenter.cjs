#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-04 -- Next-step offer presenter (Canon Part 3 + Part 4)
 * =================================================================
 * Converts navigation-engine.decide()'s `offer_next_step` payload into a
 * one-line grounded suggestion that Larry surfaces at the end of a turn.
 * Persists offer outcomes (shown / ignored / acted) to a LOCAL JSON
 * ledger so future presentations can suppress noise after consecutive
 * ignores (Risk 5 mitigation per 91-CONTEXT).
 *
 * Canonical contract:
 *
 *   presentOffer(decision, offerHistory, sessionCtx) -> {
 *     offerLine: string|null,
 *     recommendedMarker: boolean,
 *     suppressReason: string|null
 *   }
 *
 *   recordOfferOutcome(roomDir, outcome) -> void
 *     Append { at, session_id, command, reason, outcome } to
 *     .mindrian/offer-history.json atomically. Rotates to last 100.
 *     Fire-and-forget; never throws.
 *
 *   readOfferHistory(roomDir) -> { version: 1, history: [...] [, parse_failed] }
 *     Absent -> empty struct. Malformed -> empty struct + parse_failed:true.
 *     Never throws.
 *
 *   classifyTurnOutcome(previousOffer, currentUserText) -> 'acted'|'ignored'
 *     Wave-1 heuristic: if previousOffer.command appears as a substring of
 *     currentUserText, mark 'acted'; otherwise 'ignored'. Best-effort.
 *
 * Canon Part 3 Section 6 RECOMMENDED gate:
 *   The engine evaluates Mode A + confidence >= 0.7 + verb match (Plan
 *   91-00 wrote brain_md_recommended_marker_rendered into the trace).
 *   The presenter ONLY respects that flag; it does NOT re-evaluate. If
 *   the engine renders the marker, the offer line carries '(RECOMMENDED)'
 *   immediately after 'Offer'. Otherwise no marker.
 *
 * Canon Part 4: every offer outcome is a typed graph edge. The local
 * offer-history.json is the LOCAL ledger; cross-user aggregation is out
 * of scope for v1.11.0.
 *
 * Canon Part 8: pure local. Zero network. No Brain reads. No fetch. No
 * shell-out. The only fs touches are .mindrian/offer-history.json
 * read/write under the active room.
 *
 * Locked decisions (per PLAN 91-04 frontmatter must_haves):
 *   - Format: "Offer[ (RECOMMENDED)]: Because <reason>, try <command>."
 *   - Grounding: reason.length >= 15 AND contains a SIGNAL_KEYWORDS hit
 *     OR a section-name pattern (heuristic regex /[a-z]+-[a-z]+/i).
 *   - One-per-turn marker: sessionCtx.offeredThisTurn (per-process flag).
 *   - Consecutive-ignore window: last 2 history entries; tail-relative
 *     so a non-ignored entry between resets the counter.
 *   - History rotation: trim to last 100 entries on append.
 *   - Atomic write: openSync('wx') + fsync (best-effort) + rename, with
 *     EEXIST self-heal so concurrent presenters do not deadlock.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

// ---------- Frozen constants ----------

// Signal keywords that mark a reason as grounded in a real source. The
// heuristic is intentionally loose: any keyword hit qualifies. Section-
// name regex provides additional acceptance for prose like
// "market-analysis section MINTO is stale" without enumerating every
// possible section.
const SIGNAL_KEYWORDS = Object.freeze([
  'MINTO',
  'BRAIN',
  'pattern',
  'graph',
  'reasoning',
  'governing',
  'evidence',
  'confidence',
  'health',
  'stale',
  'section',
  'SWOT',
  'audit',
  'TAM',
  'SAM',
  'SOM',
  'wicked',
  'cascade',
  'contradicts',
  'converges',
  'invalidates',
  'enables',
]);

const GROUNDING_MIN_LENGTH = 15;
const CONSECUTIVE_IGNORES_THRESHOLD = 2;
const HISTORY_MAX_ENTRIES = 100;
const HISTORY_FILE = 'offer-history.json';

// Section-name heuristic: at least two lowercase letter blocks joined
// by a hyphen, e.g. 'market-analysis', 'business-model', 'team-execution'.
const SECTION_NAME_RE = /\b[a-z]+(?:-[a-z]+)+\b/;

// ---------- Pure helpers ----------

/**
 * isReasonGrounded(reason) -> 'ok' | 'ungrounded_reason' | 'generic_reason'
 *
 * 'ok'                  -- length >= 15 AND signal keyword OR section name
 * 'ungrounded_reason'   -- non-string, empty, or length < 15
 * 'generic_reason'      -- length OK but no signal keyword AND no section name
 */
function isReasonGrounded(reason) {
  if (typeof reason !== 'string') return 'ungrounded_reason';
  if (reason.length < GROUNDING_MIN_LENGTH) return 'ungrounded_reason';
  const lc = reason.toLowerCase();
  for (let i = 0; i < SIGNAL_KEYWORDS.length; i += 1) {
    if (lc.indexOf(SIGNAL_KEYWORDS[i].toLowerCase()) !== -1) {
      return 'ok';
    }
  }
  if (SECTION_NAME_RE.test(reason)) return 'ok';
  return 'generic_reason';
}

/**
 * countTrailingIgnores(history) -> number
 *
 * Counts consecutive 'ignored' outcomes at the tail of the history array.
 * Stops at the first non-ignored entry. A 'shown', 'acted', or any other
 * value (including 'reset') resets the counter.
 */
function countTrailingIgnores(history) {
  if (!history || !Array.isArray(history.history)) return 0;
  const arr = history.history;
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const e = arr[i];
    if (e && typeof e === 'object' && e.outcome === 'ignored') {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * formatOfferLine(command, reason, recommendedMarker) -> string
 *
 * Produces the canonical one-line format. Marker (when true) appears
 * immediately after "Offer" so the grep pattern 'Offer (RECOMMENDED):'
 * uniquely identifies a recommended offer.
 */
function formatOfferLine(command, reason, recommendedMarker) {
  const prefix = recommendedMarker ? 'Offer (RECOMMENDED)' : 'Offer';
  return prefix + ': Because ' + reason + ', try ' + command + '.';
}

// ---------- Main: presentOffer ----------

/**
 * presentOffer(decision, offerHistory, sessionCtx)
 *
 * Returns:
 *   { offerLine: string|null, recommendedMarker: boolean,
 *     suppressReason: string|null }
 *
 * Suppress reasons (mutually exclusive; precedence top to bottom):
 *   - 'one_offer_per_turn'              -- session already offered this turn
 *   - 'consecutive_ignores_threshold'   -- last 2 outcomes were 'ignored'
 *   - 'ungrounded_reason'               -- reason missing/short
 *   - 'generic_reason'                  -- reason fails signal-keyword gate
 *
 * Side effect: when an offer is rendered, sets sessionCtx.offeredThisTurn = true.
 * Callers MUST share the same sessionCtx object across calls in the same turn
 * for the one-per-turn cap to function. Cross-process per-turn enforcement is
 * deferred to Task 2 wiring (where the classifier process is the per-turn
 * boundary by construction).
 */
function presentOffer(decision, offerHistory, sessionCtx) {
  const ctx = sessionCtx || {};
  const empty = { offerLine: null, recommendedMarker: false, suppressReason: null };

  // Defensive: missing decision or offer_next_step -> silent.
  if (!decision || typeof decision !== 'object') return empty;
  const offer = decision.offer_next_step;
  if (offer === null || offer === undefined) return empty;
  if (typeof offer !== 'object') return empty;

  // ---- Per-turn cap (one_offer_per_turn) ----
  if (ctx.offeredThisTurn === true) {
    return { offerLine: null, recommendedMarker: false, suppressReason: 'one_offer_per_turn' };
  }

  // ---- Consecutive-ignore suppression ----
  if (countTrailingIgnores(offerHistory) >= CONSECUTIVE_IGNORES_THRESHOLD) {
    return {
      offerLine: null,
      recommendedMarker: false,
      suppressReason: 'consecutive_ignores_threshold',
    };
  }

  // ---- Grounding rule ----
  const command = typeof offer.command === 'string' ? offer.command : '';
  const reason = typeof offer.reason === 'string' ? offer.reason : '';
  if (command.length === 0) {
    // Treat empty command as not-an-offer (graceful; no suppress code).
    return empty;
  }
  const groundingResult = isReasonGrounded(reason);
  if (groundingResult !== 'ok') {
    return { offerLine: null, recommendedMarker: false, suppressReason: groundingResult };
  }

  // ---- RECOMMENDED marker (Section 6 gate respected) ----
  let recommendedMarker = false;
  if (decision.decision_trace && typeof decision.decision_trace === 'object') {
    if (decision.decision_trace.brain_md_recommended_marker_rendered === true) {
      recommendedMarker = true;
    }
  }

  const offerLine = formatOfferLine(command, reason, recommendedMarker);

  // Mark turn as having presented an offer (per-turn cap).
  ctx.offeredThisTurn = true;
  return { offerLine: offerLine, recommendedMarker: recommendedMarker, suppressReason: null };
}

// ---------- recordOfferOutcome ----------

/**
 * recordOfferOutcome(roomDir, outcome)
 *
 * outcome shape: { outcome: 'shown'|'ignored'|'acted', session_id: string,
 *                  command: string, reason?: string }
 *
 * Appends an entry with `at` = ISO-8601 timestamp. Trims to HISTORY_MAX_ENTRIES.
 * Atomic via openSync('wx') + fsync (best-effort) + rename. Fire-and-forget;
 * never throws. Callers do NOT need to await any return value.
 */
function recordOfferOutcome(roomDir, outcome) {
  try {
    if (!roomDir || typeof roomDir !== 'string') return;
    if (!outcome || typeof outcome !== 'object') return;
    const mindrianDir = path.join(roomDir, '.mindrian');
    try { fs.mkdirSync(mindrianDir, { recursive: true }); } catch (_) {}
    const filePath = path.join(mindrianDir, HISTORY_FILE);

    // Read existing (or empty).
    let data = { version: 1, history: [] };
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.history)) {
        data = parsed;
        if (data.version !== 1) data.version = 1;
        // parse_failed is a read-side flag; never persist it.
        if (data.parse_failed !== undefined) delete data.parse_failed;
      }
    } catch (_) {
      // Absent or malformed -> start fresh.
      data = { version: 1, history: [] };
    }

    const entry = {
      at: new Date().toISOString(),
      session_id: typeof outcome.session_id === 'string' ? outcome.session_id : null,
      command: typeof outcome.command === 'string' ? outcome.command : null,
      reason: typeof outcome.reason === 'string' ? outcome.reason : null,
      outcome: typeof outcome.outcome === 'string' ? outcome.outcome : null,
    };
    data.history.push(entry);

    // Rotate.
    if (data.history.length > HISTORY_MAX_ENTRIES) {
      data.history = data.history.slice(data.history.length - HISTORY_MAX_ENTRIES);
    }

    writeHistoryAtomic(filePath, data);
  } catch (_) {
    // fire-and-forget
  }
}

/**
 * Atomic write: openSync('wx') + fsync (best-effort) + rename.
 * EEXIST self-heal: stale tmp files from a crashed prior writer get
 * unlinked and retried once. Never throws.
 */
function writeHistoryAtomic(filePath, data) {
  try {
    const rnd = Math.random().toString(36).slice(2, 10);
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + rnd;
    let fd;
    try {
      fd = fs.openSync(tmpPath, 'wx');
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        try {
          fd = fs.openSync(tmpPath, 'wx');
        } catch (_) { return; }
      } else {
        return;
      }
    }
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      try { fs.fsyncSync(fd); } catch (_) {
        // ENOTSUP on tmpfs / overlayfs -- best-effort durability acceptable.
      }
    } finally {
      try { fs.closeSync(fd); } catch (_) {}
    }
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (_) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (_) { /* fire-and-forget */ }
}

// ---------- readOfferHistory ----------

/**
 * readOfferHistory(roomDir) -> { version: 1, history: [...] [, parse_failed: true] }
 *
 * Absent file -> { version: 1, history: [] }.
 * Malformed JSON -> { version: 1, history: [], parse_failed: true }.
 * Never throws.
 */
function readOfferHistory(roomDir) {
  const empty = { version: 1, history: [] };
  if (!roomDir || typeof roomDir !== 'string') return empty;
  const filePath = path.join(roomDir, '.mindrian', HISTORY_FILE);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return empty; // absent
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return { version: 1, history: [], parse_failed: true };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.history)) {
    return { version: 1, history: [], parse_failed: true };
  }
  return {
    version: parsed.version === 1 ? 1 : 1,
    history: parsed.history,
  };
}

// ---------- classifyTurnOutcome ----------

/**
 * classifyTurnOutcome(previousOffer, currentUserText) -> 'acted' | 'ignored'
 *
 * Wave-1 heuristic per 91-04 PLAN: if previousOffer.command appears as a
 * substring of currentUserText, the user 'acted' on the offer; otherwise
 * 'ignored'. Best-effort. Future plans may layer richer detection on top.
 *
 * Inputs are defensive: null/non-string/empty currentUserText -> 'ignored'
 * (the offer was shown but the user produced no text containing it). null
 * previousOffer -> 'ignored' (no offer, but caller asked for a class --
 * conservative default). Acceptance-intent phrases ("yes", "ok", "do it")
 * are NOT auto-classified as acted in v1.11.0; the user must reference the
 * command. This is intentional: false positives on auto-classification are
 * higher cost than false negatives (we suppress real signals).
 */
function classifyTurnOutcome(previousOffer, currentUserText) {
  if (!previousOffer || typeof previousOffer !== 'object') return 'ignored';
  const command = typeof previousOffer.command === 'string' ? previousOffer.command : '';
  if (command.length === 0) return 'ignored';
  if (typeof currentUserText !== 'string' || currentUserText.length === 0) return 'ignored';
  return currentUserText.indexOf(command) !== -1 ? 'acted' : 'ignored';
}

// ---------- exports ----------

module.exports = {
  presentOffer: presentOffer,
  recordOfferOutcome: recordOfferOutcome,
  readOfferHistory: readOfferHistory,
  classifyTurnOutcome: classifyTurnOutcome,
  // Internal helpers exposed for test introspection.
  _isReasonGrounded: isReasonGrounded,
  _countTrailingIgnores: countTrailingIgnores,
  _formatOfferLine: formatOfferLine,
  // Frozen constants exposed for downstream introspection.
  SIGNAL_KEYWORDS: SIGNAL_KEYWORDS,
  GROUNDING_MIN_LENGTH: GROUNDING_MIN_LENGTH,
  CONSECUTIVE_IGNORES_THRESHOLD: CONSECUTIVE_IGNORES_THRESHOLD,
  HISTORY_MAX_ENTRIES: HISTORY_MAX_ENTRIES,
};
