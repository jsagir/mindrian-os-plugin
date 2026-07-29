'use strict';
/*
 * graph-refine-loop.cjs -- SEED-033 L2: the self-improving graph loop (Phase 201-03).
 * =========================================================================
 * MindrianOS CONSUMES its local room graph but has no agent loop that ITERATIVELY
 * IMPROVES it. This is that loop, as a Ralph-style propose -> fact-check -> refine
 * cycle over the LOCAL room.db: an agent proposes typed edge enrichments the graph
 * IMPLIES but does not yet carry (e.g. a SHARES_JOB edge between two nodes), a
 * fact-check pass verifies each proposal against the existing neighborhood, and only
 * VERIFIED proposals are written -- through the navigation.cjs chokepoint (Canon
 * Part 9), LOCAL only (Canon Part 8, zero Brain wire).
 *
 * Human-gated: dryRun is the DEFAULT. A proposal is a CLAIM; only a human confirms a
 * truth-claim node (Canon Part 9). The loop SURFACES verified proposals; it writes
 * them only on an explicit opts.approve. Bounded: MAX_ROUNDS AND a no-new-verified
 * early stop, so it converges and never refines forever. A rejected proposal is
 * dedup-blocked for the run (never re-proposed).
 *
 * Pure orchestration with injectable seams (getNeighborhoodFn / proposeFn /
 * factCheckFn) so the logic tests fully offline. No em-dashes. CJS, node built-ins.
 */

const path = require('node:path');
const navigation = require(path.join(__dirname, 'navigation.cjs'));
const { ALLOWED_EDGE_TYPES } = require(path.join(__dirname, 'navigation', 'edges.cjs'));

let _openRoomDb = null;
let _closeRoomDb = null;
let _RoomDbBusyError = null;
let _RoomDbBrokenError = null;
function _roomDb() {
  if (!_openRoomDb) {
    const m = require(path.join(__dirname, 'room-db.cjs'));
    _openRoomDb = m.openRoomDb;
    _closeRoomDb = m.closeRoomDb;
    _RoomDbBusyError = m.RoomDbBusyError;
    _RoomDbBrokenError = m.RoomDbBrokenError;
  }
  return {
    openRoomDb: _openRoomDb,
    closeRoomDb: _closeRoomDb,
    RoomDbBusyError: _RoomDbBusyError,
    RoomDbBrokenError: _RoomDbBrokenError,
  };
}

const MAX_ROUNDS_DEFAULT = 3;

function proposalKey(p) {
  return String(p && p.from) + '|' + String(p && p.to) + '|' + String(p && p.type);
}

// The built-in fact-check: a proposal is VERIFIED when
//   1. both endpoints exist in the neighborhood node set (focus + neighbors), AND
//   2. the edge type is a member of the frozen ALLOWED_EDGE_TYPES set, AND
//   3. no existing neighbor is already connected to focus by that same type
//      (the proposal does not duplicate an edge the graph already carries).
// Returns { verified, reason }.
function defaultFactCheck(proposal, neighborhood, focusNodeId) {
  if (!proposal || typeof proposal !== 'object') return { verified: false, reason: 'invalid_proposal' };
  const nodeIds = new Set([focusNodeId]);
  const rows = Array.isArray(neighborhood) ? neighborhood : [];
  for (const r of rows) { if (r && typeof r.id === 'string') nodeIds.add(r.id); }

  if (!nodeIds.has(proposal.from)) return { verified: false, reason: 'from_node_absent' };
  if (!nodeIds.has(proposal.to)) return { verified: false, reason: 'to_node_absent' };
  if (typeof proposal.type !== 'string' || !ALLOWED_EDGE_TYPES.has(proposal.type)) {
    return { verified: false, reason: 'edge_type_not_allowed' };
  }
  // Contradiction / duplication guard: a neighbor already reached from focus by this
  // exact edge type means the edge is already carried (do not re-propose it).
  for (const r of rows) {
    if (r && r.id === proposal.to && r.edgeTypeIn === proposal.type) {
      return { verified: false, reason: 'edge_already_present' };
    }
  }
  return { verified: true, reason: 'ok' };
}

/**
 * runGraphRefine(roomDir, opts) -> { proposed, verified, written, rounds }
 *
 * opts:
 *   focusNodeId    (required) the node to refine around
 *   proposeFn(neighborhood, seenKeys) -> [{ from, to, type, rationale }]  (required; the agent)
 *   factCheckFn(proposal, neighborhood, focusNodeId) -> { verified, reason }  (default built-in)
 *   getNeighborhoodFn(db, focusNodeId) -> neighborhood  (default navigation.getNeighborhood)
 *   db             an already-open node:sqlite handle (caller owns close); else roomDir is opened
 *   maxRounds      default MAX_ROUNDS_DEFAULT
 *   dryRun         default TRUE -- return verified proposals WITHOUT writing
 *   approve        must be true (AND dryRun false) to WRITE verified edges through the chokepoint
 *
 * Writes go through navigation.writeEdge (Part 9) and each landed edge emits an
 * edge_added memory_event. LOCAL only: no Brain wire, ever.
 */
function runGraphRefine(roomDir, opts) {
  const o = opts || {};
  const focusNodeId = o.focusNodeId;
  const proposeFn = o.proposeFn;
  if (typeof focusNodeId !== 'string' || focusNodeId.length === 0) {
    return { proposed: [], verified: [], written: [], rounds: 0, error: 'focusNodeId_required' };
  }
  if (typeof proposeFn !== 'function') {
    return { proposed: [], verified: [], written: [], rounds: 0, error: 'proposeFn_required' };
  }
  const factCheckFn = (typeof o.factCheckFn === 'function') ? o.factCheckFn : defaultFactCheck;
  const getNeighborhoodFn = (typeof o.getNeighborhoodFn === 'function')
    ? o.getNeighborhoodFn : navigation.getNeighborhood;
  const maxRounds = (typeof o.maxRounds === 'number' && o.maxRounds >= 1) ? Math.floor(o.maxRounds) : MAX_ROUNDS_DEFAULT;
  const dryRun = o.dryRun !== false; // default TRUE
  const approve = o.approve === true;
  const willWrite = approve && !dryRun;

  // Acquire the db handle: caller-supplied (caller closes) or opened here (we close).
  let db = o.db || null;
  let owned = false;
  if (!db && willWrite || (!db && typeof roomDir === 'string')) {
    // Phase 236 follow-up (GRAPHDB-02, the last Tier A entry of the openRoomDb
    // call-site census): the pre-fix bare `catch (_e) { db = null; }` here
    // collapsed a LOCKED room, a BROKEN room and a genuinely-absent room into
    // one indistinguishable null, so a refine run against a momentarily
    // contended room walked a null neighborhood and returned a clean-looking
    // {proposed, verified, written, rounds} as if the room had no history.
    // Classification lives in room-db.cjs, NOT here: this site adds no
    // classification logic, it only stops swallowing the two typed classes.
    // Every other error keeps the old null, so a genuine cold start is still a
    // cold start, and this guard is strictly NARROWER than the previous
    // behavior, never wider.
    const rdb = _roomDb();
    try {
      db = rdb.openRoomDb(roomDir);
      owned = true;
    } catch (e) {
      if (e instanceof rdb.RoomDbBusyError || e instanceof rdb.RoomDbBrokenError) throw e;
      db = null;
    }
  }

  const seen = new Set();
  const proposed = [];
  const verified = [];
  const written = [];
  let rounds = 0;

  try {
    while (rounds < maxRounds) {
      rounds += 1;
      const neighborhood = getNeighborhoodFn(db, focusNodeId);
      let proposals = [];
      try { proposals = proposeFn(neighborhood, new Set(seen)) || []; } catch (_e) { proposals = []; }
      const fresh = proposals.filter(function (p) { return p && !seen.has(proposalKey(p)); });
      if (fresh.length === 0) break; // nothing new -> converged

      let newVerified = 0;
      for (const p of fresh) {
        seen.add(proposalKey(p)); // dedup: rejected proposals are not re-proposed this run
        proposed.push(p);
        let fc = { verified: false, reason: 'factcheck_fault' };
        try { fc = factCheckFn(p, neighborhood, focusNodeId); } catch (_e) { fc = { verified: false, reason: 'factcheck_threw' }; }
        if (!fc || fc.verified !== true) continue;
        verified.push(p);
        newVerified += 1;
        if (willWrite && db) {
          // Part 9: write through the chokepoint. Part 8: properties are enum/scalar
          // handles only (a generated decision handle + a rationale enum if present),
          // never prose. writeEdge validates edge_type against ALLOWED_EDGE_TYPES.
          const r = navigation.writeEdge(db, {
            source_id: p.from,
            target_id: p.to,
            edge_type: p.type,
            properties: { origin: 'graph-refine', reason: typeof p.reason === 'string' ? p.reason.slice(0, 40) : 'implied' },
          });
          if (r && r.ok) {
            written.push(p);
            try {
              navigation.logMemoryEvent(db, 'edge_added', {
                edge_type: p.type, source_path: 'system:graph-refine', created_by: 'system',
              });
            } catch (_ev) { /* best-effort tracking */ }
          }
        }
      }
      if (newVerified === 0) break; // no new verified edges this round -> converged
    }
  } finally {
    if (owned && db) {
      try { _roomDb().closeRoomDb(db); } catch (_e) { /* best effort */ }
    }
  }

  return { proposed: proposed, verified: verified, written: written, rounds: rounds };
}

module.exports = { runGraphRefine, defaultFactCheck, proposalKey, MAX_ROUNDS_DEFAULT };
