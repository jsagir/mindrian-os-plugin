'use strict';
/*
 * Phase 164-02 -- expert-library: library-first team assembly for the BONO engine
 * (E1 / D-164-S1; 164-EXPERT-LIFECYCLE.md). With the SyntheticExpert writer shipped
 * (synthetic-expert.cjs writeSyntheticExpertNode), this module is the CONSUMER: for
 * each needed (hat, subdomain) slot, query CONFIRMED SyntheticExpert nodes, rank by
 * the lifecycle score, slot a hit, return a generate-fresh marker on a miss. Team
 * assembly QUERIES the library FIRST and generates ONLY the gaps, so BONO gets
 * progressively cheaper and sharper while the anti-ossification guards keep new
 * provocation entering every run.
 *
 * Canon Part 8 (the load-bearing constraint): ZERO Brain calls; ZERO raw room.db
 *   open. Every read is a pure LOCAL graph walk over a caller-owned db handle (the
 *   same contract as typed-domain.cjs / edges.cjs writeEdge / getNeighborhood: the
 *   caller owns the handle (obtained through the room-db chokepoint); this module
 *   NEVER requires room-db.cjs / node:sqlite / any brain client and NEVER opens
 *   room.db itself).
 *   All score inputs are LOCAL scalars. No venture content ever leaves the room.
 * Canon Part 9: the ranking reader walks the graph via the navigation chokepoint
 *   (getNeighborhood) for the survival walk; the mint-at-gate helper RETURNS a
 *   candidate list (it does NOT call AskUserQuestion and does NOT promote) -- the
 *   command surface renders the Shape F gate and the caller promotes via
 *   navigation.confirmNode(byUser) (Part 9 role 5: the human decides).
 * Canon Part 2 team discipline: the three anti-ossification guards
 *   (164-EXPERT-LIFECYCLE.md section 3) are enforced in assembleTeam -- at least one
 *   freshly-generated slot per run (the Green-hat mandatory-fresh rule), the Black
 *   hat ALWAYS re-derived (adversarial freshness), and at most K of N slots filled
 *   from the library (K < N) with a log() when the cap bites.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const navigation = require('./navigation.cjs');

// Evidence-tier rank (Canon Part 5): Academic 4 > Operational 3 > Practitioner 2 >
// None 1. Normalized to [0,1] by /4 in the score so all four score terms share a
// scale.
const EVIDENCE_TIER_RANK = Object.freeze({
  Academic: 4, Operational: 3, Practitioner: 2, None: 1,
});

// The lifecycle-score weights (164-EXPERT-LIFECYCLE.md section 1). Defaults tuned
// here; a caller may override via opts.weights. w1 (evidence) and w2 (survival)
// dominate; w3 (recency) is a gentle tie-breaker; w4 (staleness) is the penalty.
const DEFAULT_WEIGHTS = Object.freeze({
  w1: 0.40, // evidence_tier_rank (normalized)
  w2: 0.35, // survival_rate (fraction of past rulings that survived)
  w3: 0.15, // recency_decay(last_used) (exponential, newer = higher)
  w4: 0.50, // staleness_penalty (subtracted; a stale expert is heavily penalized)
});

// The default reuse cap and the recency half-life (ms). A 30-day half-life mirrors
// the Act 1 / stale-decision 30-day window used across the navigation insights.
const DEFAULT_REUSE_CAP = 3;
const RECENCY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 30;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseProps(propsStr) {
  if (isPlainObject(propsStr)) return propsStr;
  if (typeof propsStr !== 'string' || propsStr.length === 0) return {};
  try {
    const p = JSON.parse(propsStr);
    return isPlainObject(p) ? p : {};
  } catch (_e) {
    return {};
  }
}

// recency_decay(last_used): exponential decay over the half-life. last_used is an
// epoch-ms scalar; a 0/absent last_used decays to ~0 (never used recently).
function recencyDecay(lastUsed, nowMs) {
  if (!Number.isFinite(lastUsed) || lastUsed <= 0) return 0;
  const ageMs = Math.max(0, nowMs - lastUsed);
  return Math.pow(0.5, ageMs / RECENCY_HALF_LIFE_MS);
}

// survival_rate: a PURE navigation graph walk. Walk the expert's outgoing
// STATES/SUPPORTS edges to its readings, then each reading's outgoing edges to past
// rulings, and score the fraction that SURVIVED (a reading that INFORMS/VALIDATES a
// ruling decision) vs was OVERRULED (a reading carrying a REJECTED_BECAUSE edge).
// Reads via the navigation.getNeighborhood chokepoint (depth 2 from the expert),
// NEVER raw SQL traversal. Returns a fraction in [0,1]; 0.5 when no ruling history
// (neutral prior, neither rewarded nor punished).
function computeSurvivalRate(db, expertId) {
  let neighborhood;
  try {
    neighborhood = navigation.getNeighborhood(db, expertId, { maxDepth: 2, topK: 200 });
  } catch (_e) {
    return 0.5;
  }
  if (!Array.isArray(neighborhood) || neighborhood.length === 0) return 0.5;
  let survived = 0;
  let overruled = 0;
  for (const n of neighborhood) {
    // depth-2 nodes are the rulings the expert's readings reached; the edge_type_in
    // that landed on them is the survival signal.
    if (n.edgeTypeIn === 'REJECTED_BECAUSE') {
      overruled += 1;
    } else if (n.edgeTypeIn === 'INFORMS' || n.edgeTypeIn === 'VALIDATES' || n.edgeTypeIn === 'SUPPORTS') {
      // a reading that fed (INFORMS/VALIDATES) a downstream ruling node survived.
      if (n.type === 'decision' || n.type === 'claim' || n.type === 'CausalClaim') {
        survived += 1;
      }
    }
  }
  const totalRulings = survived + overruled;
  if (totalRulings === 0) return 0.5;
  return survived / totalRulings;
}

// isExpertStale(db, expert, currentSubdomainHash): mirror the Act 1 source-hash
// invalidation. expert.props.governing_thought_hash (the subdomain-claim-set hash
// it was last validated against) compared to the current; mismatch -> stale.
// Defensive: a missing currentSubdomainHash means "cannot judge", so NOT stale (do
// not punish on a missing input). NEVER throws.
function isExpertStale(db, expert, currentSubdomainHash) {
  if (typeof currentSubdomainHash !== 'string' || currentSubdomainHash.length === 0) {
    return false;
  }
  const props = expert && expert.props ? parseProps(expert.props) : {};
  const recorded = typeof props.governing_thought_hash === 'string' ? props.governing_thought_hash : '';
  if (recorded.length === 0) return false;
  return recorded !== currentSubdomainHash;
}

// Match tier (164-EXPERT-LIFECYCLE.md section 1, most specific wins):
//   1 exact hat + exact subdomain
//   2 exact hat + same domain (different subdomain)
//   3 exact hat + same archetype
//   0 no tier match (excluded)
function matchTier(props, slot) {
  if (props.hat !== slot.hat) return 0;
  if (slot.subdomain && props.subdomain === slot.subdomain) return 1;
  if (slot.domain && props.domain === slot.domain) return 2;
  if (slot.archetype && props.archetype === slot.archetype) return 3;
  return 0;
}

// rankExpertsForSlot(db, {hat, subdomain, domain, archetype}, opts?): query CONFIRMED
// SyntheticExpert nodes via the caller-owned db handle (a LOCAL read, no Brain, no
// raw room.db open), bucket by the four match tiers, and within a tier score by the
// documented formula. Returns a tier-then-score-ordered array; a miss returns [].
function rankExpertsForSlot(db, slot, opts) {
  if (!isPlainObject(slot) || typeof slot.hat !== 'string') return [];
  const options = isPlainObject(opts) ? opts : {};
  const w = isPlainObject(options.weights) ? options.weights : DEFAULT_WEIGHTS;
  const nowMs = Number.isFinite(options.now) ? options.now : Date.now();
  let rows;
  try {
    // LOCAL read over the caller-owned handle. Only CONFIRMED experts (Part 9 role
    // 5: a proposed expert is not yet trusted, the human has not kept it).
    rows = db.prepare(
      "SELECT id, properties FROM nodes WHERE type = 'SyntheticExpert' AND review_status = 'confirmed'"
    ).all();
  } catch (_e) {
    return [];
  }
  const scored = [];
  for (const row of rows) {
    const props = parseProps(row.properties);
    const tier = matchTier(props, slot);
    if (tier === 0) continue;
    const evidenceRank = (EVIDENCE_TIER_RANK[props.evidence_tier] || 1) / 4;
    const survivalRate = computeSurvivalRate(db, row.id);
    const recency = recencyDecay(props.last_used, nowMs);
    const stale = isExpertStale(db, { props }, slot.currentSubdomainHash);
    const stalenessPenalty = stale ? 1 : 0;
    const score = (w.w1 * evidenceRank)
      + (w.w2 * survivalRate)
      + (w.w3 * recency)
      - (w.w4 * stalenessPenalty);
    scored.push({
      id: row.id,
      hat: props.hat,
      name: props.name,
      surname: props.surname,
      archetype: props.archetype,
      subdomain: props.subdomain,
      domain: props.domain,
      evidenceTier: props.evidence_tier,
      matchTier: tier,
      survivalRate: survivalRate,
      recency: recency,
      stale: stale,
      score: score,
    });
  }
  // Most specific tier first; within a tier, highest score first.
  scored.sort((a, b) => (a.matchTier - b.matchTier) || (b.score - a.score));
  return scored;
}

// assembleTeam(db, {neededSlots, opts}): library-first assembly with the three
// anti-ossification guards. For each (hat, subdomain) slot:
//   - Black hat -> ALWAYS generate-fresh (adversarial freshness; never reuse).
//   - else rankExpertsForSlot, skip stale, slot the top confirmed hit IF under the
//     reuse cap K; else generate-fresh.
// GUARANTEE at least one slot per run is generate-fresh (the mandatory-fresh rule);
// if every non-Black slot got a hit, FORCE the lowest-ranked reuse back to fresh.
// log() a reused-vs-generated summary, with a note when the cap bites.
function assembleTeam(db, params) {
  const p = isPlainObject(params) ? params : {};
  const neededSlots = Array.isArray(p.neededSlots) ? p.neededSlots : [];
  const opts = isPlainObject(p.opts) ? p.opts : {};
  const reuseCap = Number.isInteger(opts.reuseCap) && opts.reuseCap >= 0 ? opts.reuseCap : DEFAULT_REUSE_CAP;
  const log = typeof opts.log === 'function' ? opts.log : function noop() {};

  const slots = [];
  let reused = 0;
  let capBit = false;

  for (const slot of neededSlots) {
    const s = isPlainObject(slot) ? slot : {};
    const hat = typeof s.hat === 'string' ? s.hat : '';
    // Guard 2: the Black hat is ALWAYS re-derived (never a library reuse).
    if (hat === 'Black') {
      slots.push({ hat: hat, subdomain: s.subdomain, action: 'generate-fresh', reason: 'black_always_fresh', reusedExpertId: null });
      continue;
    }
    const ranked = rankExpertsForSlot(db, s, { weights: opts.weights, now: opts.now });
    // skip stale candidates (freshness gate); take the top fresh, confirmed hit.
    const hit = ranked.find((e) => !e.stale);
    if (!hit) {
      slots.push({ hat: hat, subdomain: s.subdomain, action: 'generate-fresh', reason: 'no_fresh_hit', reusedExpertId: null });
      continue;
    }
    // Guard 3: reuse cap K of N. Under cap -> reuse; at/over cap -> generate-fresh.
    if (reused < reuseCap) {
      reused += 1;
      slots.push({
        hat: hat, subdomain: s.subdomain, action: 'reuse', reason: 'library_hit',
        reusedExpertId: hit.id, score: hit.score, matchTier: hit.matchTier,
      });
    } else {
      capBit = true;
      slots.push({ hat: hat, subdomain: s.subdomain, action: 'generate-fresh', reason: 'reuse_cap_reached', reusedExpertId: null });
    }
  }

  // Guard 1: the mandatory-fresh rule. If EVERY slot got reused (no generate-fresh
  // anywhere), force the lowest-ranked reuse slot back to fresh so new provocation
  // always enters. (Black already forces a fresh slot whenever a Black hat is in
  // the run; this covers a run with no Black hat.)
  const hasFresh = slots.some((sl) => sl.action === 'generate-fresh');
  if (!hasFresh && slots.length > 0) {
    let lowestIdx = -1;
    let lowestScore = Infinity;
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i].action === 'reuse' && typeof slots[i].score === 'number' && slots[i].score < lowestScore) {
        lowestScore = slots[i].score;
        lowestIdx = i;
      }
    }
    if (lowestIdx >= 0) {
      slots[lowestIdx] = {
        hat: slots[lowestIdx].hat, subdomain: slots[lowestIdx].subdomain,
        action: 'generate-fresh', reason: 'mandatory_fresh_lens', reusedExpertId: null,
      };
      reused -= 1;
    }
  }

  const generated = slots.filter((sl) => sl.action === 'generate-fresh').length;
  const summary = { reused: reused, generated: generated, total: slots.length, reuseCap: reuseCap, capBit: capBit };
  log('expert-library assembleTeam: reused=' + reused + ' generated=' + generated
    + ' of ' + slots.length + (capBit ? ' (reuse cap K=' + reuseCap + ' bit)' : ''));

  return { slots: slots, summary: summary };
}

// offerExpertsForFiling(runHats): the mint-at-Decision-Gate helper. Rank the run's
// hats by contribution (evidence tier then survival rate) and RETURN the Shape F
// gate candidate list. It does NOT call AskUserQuestion and does NOT promote; the
// command surface renders the gate and the caller promotes APPROVE via
// navigation.confirmNode(byUser) (Part 9 role 5). Pure, defensive, no db.
function offerExpertsForFiling(runHats) {
  if (!Array.isArray(runHats)) return [];
  const candidates = runHats
    .filter((h) => isPlainObject(h))
    .map((h) => ({
      hat: h.hat,
      name: h.name,
      surname: h.surname,
      evidenceTier: h.evidenceTier,
      survivalRate: Number.isFinite(h.survivalRate) ? h.survivalRate : 0,
      contributionRank: ((EVIDENCE_TIER_RANK[h.evidenceTier] || 1) / 4) + (Number.isFinite(h.survivalRate) ? h.survivalRate : 0),
    }));
  candidates.sort((a, b) => b.contributionRank - a.contributionRank);
  return candidates;
}

module.exports = {
  rankExpertsForSlot,
  isExpertStale,
  assembleTeam,
  offerExpertsForFiling,
  computeSurvivalRate,
  DEFAULT_WEIGHTS,
  EVIDENCE_TIER_RANK,
};
