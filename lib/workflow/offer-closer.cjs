#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-03 -- the reliable F.1 Next-Move closer (orchestration helper).
 * =========================================================================
 * The resolver (135-02, lib/core/navigation-engine-offer.cjs) emits ONE offer
 * or null; the offer-presenter (Phase 91-04) grounds + suppresses + caps it; and
 * THIS module fires the F.1 Next-Move selector for a surviving offer and records
 * the user's pick as a typed decision edge (accept/defer/reject) or a miss
 * memory_event (Free-Text). It is the CONSUMER-side closer the design conversation
 * named: the offer is DATA computed by the engine; render + persistence live OUT
 * of the engine, here, behind the AskUserQuestion primitive (cross-surface).
 *
 * Canon alignment:
 *   - Part 3: render goes through selector-dispatcher.pickShape (F.1) ONLY -- no
 *     bespoke prompt prose (tests/test-no-bespoke-brain-prompts.sh tripwire).
 *   - Part 4: every pick becomes graph data via recordSelectorDecision (an
 *     accept/defer/reject typed edge) or recordSelectorMiss (a temporal miss
 *     event). Reject persists the f_selector_decision row the resolver's
 *     shouldExclude reads next turn -- this is the SC6 backoff loop closing.
 *   - Part 8: a Free-Text pick's user_intent stays LOCAL (recordSelectorMiss
 *     writes it to room.db only); the closer never serializes it to a Brain
 *     packet, never calls Brain. Zero user bytes to Brain.
 *
 * Reuse-before-build (Part 7): this module wires SHIPPED organs only --
 * selector-dispatcher.pickShape + aliasToCanonical (Phase 88.2 / 121.5),
 * selector-decisions.recordSelectorDecision / recordSelectorMiss (Phase 125),
 * navigation-engine-shared.CANONICAL_VERBS (Phase 91), wikilink-builder
 * .injectFiledToFooter (Phase 76). Net-new = the F.1 payload builder + the
 * pick-routing closeOffer dispatcher.
 *
 * The closer NEVER opens room.db itself (substrate guard: this file is not on the
 * room-db.cjs allow-list). The CONSUMER (scripts/intent-classifier.cjs) opens the
 * handle via the navigation chokepoint (navigation.openRoomDbForCaller) and passes
 * a populated roomState.db in -- per F-SELECTOR-CONSUMER-GUIDE Pitfall 5. closeOffer
 * fails closed ({ok:false, reason:'invalid_db'}) when roomState.db is absent rather
 * than crashing.
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No await on a Brain packet. No surface-specific branch (SC8).
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

// Lazy + tolerant requires: a missing module degrades gracefully (the caller
// then falls back to emitting only the offer line). Resolved once at module
// load; each is wrapped so a load failure never throws into the hot path.
function _safeRequire(p) {
  try {
    return require(p);
  } catch (_e) {
    return null;
  }
}

const dispatcher = _safeRequire(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const decisions = _safeRequire(path.join(REPO, 'lib', 'workflow', 'selector-decisions.cjs'));
const shared = _safeRequire(path.join(REPO, 'lib', 'core', 'navigation-engine-shared.cjs'));
const wikilinks = _safeRequire(path.join(REPO, 'lib', 'vault', 'wikilink-builder.cjs'));

// The Free-Text escape (the 10th canonical verb). Read from the frozen shared
// constant when available; hard-fallback to the literal so the payload always
// carries the escape even if the shared module fails to load.
const FREE_TEXT = (shared
  && Array.isArray(shared.CANONICAL_VERBS)
  && shared.CANONICAL_VERBS.length === 10)
  ? shared.CANONICAL_VERBS[9]
  : 'Free-Text';

// MAX_K mirrors the ranker's MAX_K=3 (Phase 125). The F.1 payload offers the
// top command plus up to 2 sibling commands, then the Free-Text escape last.
const MAX_K = 3;

// ---------------------------------------------------------------------------
// buildF1Payload(offer, opts?) -> { verbs, recommendedVerb, header }
//
// Builds the F.1 Next-Move selector payload from a resolver offer. The verbs
// array is [offer.command, ...optional sibling commands up to MAX_K, FREE_TEXT];
// FREE_TEXT is ALWAYS the last entry (the escape, Pitfall 6). recommendedVerb
// rides ONLY the existing decision_trace.brain_md_recommended_marker_rendered
// flag (Mode A marker) -- the closer computes NO confidence here (A3 LOCKED:
// the marker is set upstream, not recomputed). header is the locked '[NEXT MOVE]'.
//
// Defensive: a null/malformed offer yields a minimal payload that still ends
// with FREE_TEXT so the user is never trapped.
// ---------------------------------------------------------------------------
function buildF1Payload(offer, opts) {
  const o = (offer && typeof offer === 'object') ? offer : {};
  const options = (opts && typeof opts === 'object') ? opts : {};

  const verbs = [];
  if (typeof o.command === 'string' && o.command.length > 0) {
    verbs.push(o.command);
  }
  // Optional sibling commands (resolver may pass siblings via opts.siblings).
  // Capped so verbs (excluding the escape) never exceed MAX_K.
  if (Array.isArray(options.siblings)) {
    for (let i = 0; i < options.siblings.length; i += 1) {
      const s = options.siblings[i];
      if (typeof s === 'string' && s.length > 0 && verbs.indexOf(s) === -1) {
        if (verbs.length >= MAX_K) break;
        verbs.push(s);
      }
    }
  }
  // The escape is ALWAYS last. Never deduped away (even a degenerate empty
  // offer keeps the escape so the selector renders a usable choice).
  verbs.push(FREE_TEXT);

  // recommendedVerb derives ONLY from the upstream Mode A marker flag. No
  // confidence math here (A3). decisionTrace is read off opts so the caller
  // passes decision.decision_trace verbatim.
  const trace = (options.decisionTrace && typeof options.decisionTrace === 'object')
    ? options.decisionTrace
    : null;
  const markerRendered = !!(trace && trace.brain_md_recommended_marker_rendered === true);
  const recommendedVerb = (markerRendered && typeof o.command === 'string' && o.command.length > 0)
    ? o.command
    : null;

  const payload = {
    verbs: verbs,
    recommendedVerb: recommendedVerb,
    header: '[NEXT MOVE]',
  };

  // Phase 158-01 (RJP-07 / SC-02): the two-turn offer->close keying pin. The
  // `verbs` array stays PLAIN COMMAND STRINGS (the frozen F.1 keyboard contract;
  // never mutated). When the caller supplies a per-verb reach_id map
  // (opts.reachIdByVerb -- threaded from the rendered dial reachList, whose reach
  // objects provably carry reach_id), build a PARALLEL `reachIds` map keyed by
  // verb so the rendered dial reach_id survives the turn boundary on the persisted
  // f1_closer_payload. On the NEXT turn the consumer surface routes the pick back
  // to closeReach with the matching reach_id, so the reject is keyed per reach_id
  // end to end. Only verbs actually present in the payload are mapped; the
  // FREE_TEXT escape carries no reach_id. When no map is supplied the payload is
  // byte-identical to the pre-158 shape (additive; non-dial offers unaffected).
  const reachIdMap = (options.reachIdByVerb && typeof options.reachIdByVerb === 'object')
    ? options.reachIdByVerb
    : null;
  if (reachIdMap) {
    const reachIds = {};
    let any = false;
    for (let i = 0; i < verbs.length; i += 1) {
      const v = verbs[i];
      const rid = reachIdMap[v];
      if (typeof rid === 'string' && rid.length > 0) {
        reachIds[v] = rid;
        any = true;
      }
    }
    if (any) {
      payload.reachIds = reachIds;
    }
  }

  return payload;
}

// ---------------------------------------------------------------------------
// renderF1(offer, opts?) -> { ok, rendered?, payload, reason? }
//
// Fires the F.1 selector via the SHIPPED dispatcher.pickShape (the cross-surface
// AskUserQuestion primitive). Never writes a bespoke prompt string. Wrapped so a
// missing/failing dispatcher degrades gracefully: { ok:false } and the caller
// falls back to emitting only the offer line. No surface-specific branch (SC8).
// ---------------------------------------------------------------------------
function renderF1(offer, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const payload = buildF1Payload(offer, options);
  if (!dispatcher || typeof dispatcher.pickShape !== 'function') {
    return { ok: false, reason: 'dispatcher_unavailable', payload: payload };
  }
  try {
    const rendered = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: options.roomDir,
      operator: options.operator,
      tier: options.tier,
      payload: payload,
    });
    return { ok: true, rendered: rendered, payload: payload };
  } catch (_e) {
    return { ok: false, reason: 'pickShape_failed', payload: payload };
  }
}

// ---------------------------------------------------------------------------
// _collapseAlias(verb, rendered) -> canonicalVerb
//
// Collapses a user-facing verb alias to its canonical form for graph-edge
// persistence (Phase 121.5 LOCKED decision 1). Reads the alias_map off the
// rendered F.1 contract when present; aliasToCanonical falls back to its own
// module-level map when the arg is undefined, so this is safe either way.
// ---------------------------------------------------------------------------
function _collapseAlias(verb, rendered) {
  if (!dispatcher || typeof dispatcher.aliasToCanonical !== 'function') return verb;
  let aliasMap;
  try {
    aliasMap = rendered
      && rendered.rendered
      && rendered.rendered.contract
      && rendered.rendered.contract.alias_map;
  } catch (_e) {
    aliasMap = undefined;
  }
  try {
    return dispatcher.aliasToCanonical(verb, aliasMap);
  } catch (_e) {
    return verb;
  }
}

// ---------------------------------------------------------------------------
// _normalizePick(pick) -> 'accept' | 'defer' | 'reject' | 'Free-Text' | null
//
// Maps a raw pick (a canonical verb OR a decision keyword) to the closeOffer
// routing key. The Free-Text escape routes to the miss path; accept/defer/reject
// route to the decision path. Unknown picks return null (caller treats as no-op).
// ---------------------------------------------------------------------------
function _normalizePick(pick) {
  if (typeof pick !== 'string' || pick.length === 0) return null;
  if (pick === FREE_TEXT || pick === 'Free-Text') return 'Free-Text';
  const lower = pick.toLowerCase();
  if (lower === 'accept' || lower === 'approve') return 'accept';
  if (lower === 'defer') return 'defer';
  if (lower === 'reject') return 'reject';
  // A canonical command verb that is not the escape is treated as an accept of
  // that move (the user picked the offered command).
  return 'accept';
}

// ---------------------------------------------------------------------------
// injectAcceptedWikilinks(content, offer) -> content
//
// Phase 76 reuse: when an accepted offer files an artifact (or touches a footer),
// inject the wikilink footer idempotently via the SHIPPED injector. Dedupes via
// content.includes(line) internally, so calling twice is a no-op. A guarded
// no-op when there is no artifact content or no injector. SC5.
// ---------------------------------------------------------------------------
function injectAcceptedWikilinks(content, offer) {
  if (typeof content !== 'string' || content.length === 0) return content;
  if (!wikilinks || typeof wikilinks.injectFiledToFooter !== 'function') return content;
  const o = (offer && typeof offer === 'object') ? offer : {};
  const targetPath = (typeof o.scope === 'string' && o.scope.length > 0) ? o.scope : null;
  if (!targetPath) return content;
  try {
    return wikilinks.injectFiledToFooter(content, { targetPath: targetPath });
  } catch (_e) {
    return content;
  }
}

// ---------------------------------------------------------------------------
// closeOffer({ pick, offer, reason?, user_intent?, roomState, artifactContent?,
//             sentence?, reach_id? })
//   -> { ok, ... }
//
// FIX-05 (Phase 150.6-03): the OPTIONAL `sentence` is the user-text thread-
// through. When present, it is forwarded to recordSelectorDecision, which
// classifies it at the write seam and stores ONLY the scalar boolean +
// source enum (Canon Part 8: the sentence never enters any stored payload).
//
// Phase 159-01 (DCW-02 / DCW-08): the OPTIONAL `reach_id` is the frozen machine
// token that grounded a dial-driven offer. When present and non-empty it is
// forwarded onto decisionArgs additively; the downstream recordSelectorDecision
// REACH_IDS enum-gate keys the row when it is a frozen member and DROPS it
// otherwise (never mis-keyed). When absent the write is byte-identical to the
// pre-159 no-reach shape.
//
// Routes a user pick to graph persistence:
//   - 'Free-Text'           -> recordSelectorMiss (memory_event only, no edge;
//                              user_intent stays LOCAL per Part 8).
//   - 'accept'|'defer'|'reject' -> recordSelectorDecision (a typed cascade edge;
//                              reject/defer write the f_selector_decision row the
//                              resolver's shouldExclude reads next turn -- SC6
//                              backoff loop CLOSES here).
//
// roomState.db MUST be populated by the CONSUMER (the closer never opens room.db).
// When absent, recordSelectorDecision/Miss return {ok:false, reason:'invalid_db'};
// closeOffer surfaces that without crashing (Pitfall 5 / the db precondition guard).
//
// On accept with artifactContent, the wikilink footer is injected idempotently
// (SC5) and the injected content is returned on result.artifactContent so the
// consumer can persist it. The reason passed to recordSelectorDecision retains the
// resolver's [[wikilink]] reason (decision-edge wikilink provenance, SC5).
// ---------------------------------------------------------------------------
function closeOffer(args) {
  const o = (args && typeof args === 'object') ? args : {};
  const offer = (o.offer && typeof o.offer === 'object') ? o.offer : {};
  const roomState = (o.roomState && typeof o.roomState === 'object') ? o.roomState : {};

  if (!decisions) {
    return { ok: false, reason: 'decisions_unavailable' };
  }

  // Collapse alias -> canonical when a rendered F.1 envelope is provided.
  const rawPick = (o.rendered) ? _collapseAlias(o.pick, o.rendered) : o.pick;
  const route = _normalizePick(rawPick);
  if (route === null) {
    return { ok: false, reason: 'unknown_pick' };
  }

  // --- Free-Text escape: a miss memory_event only (no edge). user_intent LOCAL.
  if (route === 'Free-Text') {
    const top_k_offered = Array.isArray(o.top_k_offered)
      ? o.top_k_offered
      : [{
        command: (typeof offer.command === 'string') ? offer.command : 'unknown',
        score: (typeof offer.confidence === 'number') ? offer.confidence : 0,
      }];
    const user_intent = (typeof o.user_intent === 'string' && o.user_intent.length > 0)
      ? o.user_intent
      : 'free-text direction';
    const r = decisions.recordSelectorMiss({
      top_k_offered: top_k_offered,
      user_intent: user_intent,
      roomState: roomState,
    });
    return r || { ok: false, reason: 'miss_record_failed' };
  }

  // --- accept / defer / reject: a typed decision edge.
  // The reason retains the resolver's [[wikilink]] reason as provenance (SC5);
  // for a reject the consumer may pass a captured REJECTED_BECAUSE reason, which
  // takes precedence.
  const reason = (typeof o.reason === 'string' && o.reason.length > 0)
    ? o.reason
    : ((typeof offer.reason === 'string' && offer.reason.length > 0) ? offer.reason : null);

  const decisionArgs = {
    decision: route,
    command: (typeof offer.command === 'string') ? offer.command : undefined,
    framework: (typeof offer.framework === 'string') ? offer.framework : undefined,
    reason: reason,
    score_at_decision: (typeof offer.confidence === 'number') ? offer.confidence : undefined,
    roomState: roomState,
  };
  // FIX-05 (Phase 150.6-03): forward the OPTIONAL user sentence so
  // recordSelectorDecision can classify it at the write seam and stage the
  // scalar boolean venture_classified + classification_source enum. Canon Part 8:
  // the sentence is forwarded ONLY as the classify() input; this closer never
  // stores it in any payload it builds. Forwarded only when present.
  if (typeof o.sentence === 'string' && o.sentence.length > 0) {
    decisionArgs.sentence = o.sentence;
  }
  // Phase 159-01 (DCW-02 / DCW-08 / HOW-1): forward the OPTIONAL reach_id, the
  // frozen machine token that grounded a dial-driven offer, so the consumer
  // (lib/workflow/f1-pick-consumer.cjs) can record the f_selector_decision row
  // keyed per reach_id end to end. Mirrors the FIX-05 optional-sentence merge
  // idiom directly above + the closeReach reach_id forward (dial-close-reach
  // .cjs:251). This closer adds NO membership check: the frozen REACH_IDS
  // enum-gate already lives in recordSelectorDecision (selector-decisions.cjs:224)
  // and DROPS off-set values, so an off-set reach_id degrades to an unkeyed write
  // (DCW-08 never mis-keyed). When reach_id is absent the decisionArgs are
  // byte-identical to the pre-159 shape (DCW-02 byte-stable). Forwarded only when
  // present and non-empty.
  if (typeof o.reach_id === 'string' && o.reach_id.length > 0) {
    decisionArgs.reach_id = o.reach_id;
  }
  // accept of a truth-claim node needs a nodeId; the closer only forwards one
  // when the consumer supplies it (offer accept that promotes a node). For an
  // accept of an offered MOVE (the common case) there is no node to confirm, so
  // we route the accept as a 'defer'-shaped persistence ONLY when a nodeId is
  // present; otherwise the accept is recorded as the move being taken via the
  // presenter ledger by the consumer (recordOfferOutcome 'acted'), and here we
  // still write the decision edge using the defer/reject gate when applicable.
  if (route === 'accept' && typeof o.nodeId === 'string' && o.nodeId.length > 0) {
    decisionArgs.nodeId = o.nodeId;
    if (typeof o.byUser === 'string' && o.byUser.length > 0) {
      decisionArgs.byUser = o.byUser;
    }
  } else if (route === 'accept') {
    // No node to confirm: the accept of a next-move offer is the move being
    // taken. There is no DEFERRED/REJECTED backoff edge for an accept; the
    // decision-edge writer's accept branch requires a nodeId. Signal the
    // consumer to record the presenter 'acted' outcome and (optionally) inject
    // wikilinks; no recordSelectorDecision call is made for a node-less accept.
    const result = { ok: true, accepted: true, recorded: 'offer_acted' };
    if (typeof o.artifactContent === 'string' && o.artifactContent.length > 0) {
      result.artifactContent = injectAcceptedWikilinks(o.artifactContent, offer);
    }
    return result;
  }

  const r = decisions.recordSelectorDecision(decisionArgs);
  // On a successful accept WITH a node, optionally inject wikilinks too.
  if (r && r.ok && route === 'accept'
      && typeof o.artifactContent === 'string' && o.artifactContent.length > 0) {
    r.artifactContent = injectAcceptedWikilinks(o.artifactContent, offer);
  }
  return r || { ok: false, reason: 'decision_record_failed' };
}

module.exports = {
  buildF1Payload: buildF1Payload,
  renderF1: renderF1,
  closeOffer: closeOffer,
  injectAcceptedWikilinks: injectAcceptedWikilinks,
  FREE_TEXT: FREE_TEXT,
  MAX_K: MAX_K,
};
