'use strict';
// Phase 150.10-04 Task 3 -- the local leverage-point scanner (the M4 teeth).
//
// scanLeveragePoints(db) runs the 12 Meadows leverage-level signature queries
// (references/methodology/leverage-scan-signatures.md) over a room's local
// graph and returns candidate leverage points RANKED by Meadows level (lower
// number = higher leverage = higher priority). It makes leverage-point analysis
// OPERATIONAL, not just taxonomic: Brain holds the generic mapping; the local
// graph (room.db) executes the scan.
//
// READ-PATH CONTRACT (Canon Part 9): the scanner reads room.db ONLY through a
// caller-owned db handle issued by the lib/core/navigation.cjs chokepoint
// (navigation.openRoomDbForCaller). It does NOT require room-db.cjs, does NOT
// open sqlite directly, and does NOT fs-scan the room folder. The caller owns
// the handle and closes it via navigation.closeRoomDbForCaller in a finally.
//
// PART 8 CONTRACT (the graph boundary): room candidates stay LOCAL and NEVER
// egress to the remote methodology cortex. This module carries ZERO network
// surface -- the Part 8 floor grep over the forbidden egress tokens returns 0.
// Only the generic signature mapping crosses cortex-to-local; the local
// candidates never cross the other way.
//
// PART 7 / ST-17 (reuse before build): the mid-leverage band (Meadows levels
// 6 to 8) READS the REVERSE_SALIENT edges the shipped rs-engine
// (scripts/rs-engine.py) already wrote into room.db (properties.source =
// 'rs-engine', carrying signed_diff = the lag = the leverage signal). The
// scanner does NOT reimplement bottleneck / reverse-salient detection.
//
// No emoji. No em-dashes (hyphens only).

// Meadows signature labels, keyed by level. Mirrors the 12-row table in
// references/methodology/leverage-scan-signatures.md.
const SIGNATURES = Object.freeze({
  12: 'Parameters - leaf scalar claim with no outgoing edges',
  11: 'Buffers - high evidence-count accumulation node',
  10: 'Stock-and-flow structure - high (in+out) degree hub',
  9: 'Delays - DEFERRED edge or valid_from/valid_until lag',
  8: 'Balancing loop - CONTRADICTS / INVALIDATES polarity (rs-engine reverse-salient)',
  7: 'Reinforcing loop - CONVERGES / ENABLES polarity',
  6: 'Information flow - bridge node (rs-engine reverse-salient, signed_diff)',
  5: 'Rules - assumption-typed node (the assumption registry)',
  4: 'Self-organization - ROOT_CAUSES fan-out (generative node)',
  3: 'Goals - the governing-thought / objective node',
  2: 'Paradigm - the root problem-formulation node',
  1: 'Transcending - the systems-thinking meta-lens itself (M4)',
});

// Leverage weight: lower Meadows number = higher leverage. The base score is a
// normalized leverage weight in (0, 1]; per-signature signal nudges within the
// band but never crosses into an adjacent band (so ranking stays level-first).
function leverageWeight(level) {
  return (13 - level) / 12;
}

function _label(propertiesJson, fallbackId) {
  try {
    const props = JSON.parse(propertiesJson || '{}');
    if (props && typeof props.label === 'string' && props.label.length > 0) {
      return props.label;
    }
  } catch (_e) { /* fall through */ }
  return fallbackId;
}

/**
 * Scan a room's local graph for Meadows leverage points.
 *
 * @param {import('node:sqlite').DatabaseSync} db - a LIVE room.db handle issued
 *   by navigation.openRoomDbForCaller (the caller owns and closes it). When db
 *   is null/undefined (Tier 0 cold start, no room.db), returns [] -- the scanner
 *   abstains gracefully, never throws.
 * @returns {Array<{nodeId: string, label: string, meadows_level: number, signature: string, score: number}>}
 *   candidates RANKED lower-Meadows-number-first (highest leverage first).
 */
function scanLeveragePoints(db) {
  if (!db || typeof db.prepare !== 'function') return [];

  const out = [];
  const seen = new Set(); // dedupe by nodeId+level so a node is one candidate per band

  function add(nodeId, level, propertiesJson, signalBoost) {
    const key = nodeId + '#' + level;
    if (seen.has(key)) return;
    seen.add(key);
    const boost = typeof signalBoost === 'number' ? signalBoost : 0;
    out.push({
      nodeId: nodeId,
      label: _label(propertiesJson, nodeId),
      meadows_level: level,
      signature: SIGNATURES[level],
      // Keep the boost sub-band (< 1/12) so the level ordering is never crossed.
      score: leverageWeight(level) + Math.max(0, Math.min(1, boost)) * (1 / 24),
    });
  }

  // --- Level 3 (Goals): the governing-thought / objective node. ------------
  for (const r of db.prepare(
    "SELECT id, properties FROM nodes WHERE type = 'governing_thought'"
  ).all()) {
    add(r.id, 3, r.properties, 1);
  }

  // --- Level 4 (Self-organization): ROOT_CAUSES fan-out generative nodes. ---
  for (const r of db.prepare(
    "SELECT n.id AS id, n.properties AS properties, COUNT(*) AS fanout " +
    "FROM nodes n JOIN edges e ON e.source = n.id AND e.type = 'ROOT_CAUSES' " +
    "GROUP BY n.id"
  ).all()) {
    add(r.id, 4, r.properties, Math.min(1, Number(r.fanout) / 3));
  }

  // --- Level 5 (Rules): assumption-typed nodes (the assumption registry). ---
  for (const r of db.prepare(
    "SELECT id, properties FROM nodes WHERE type = 'assumption'"
  ).all()) {
    add(r.id, 5, r.properties, 1);
  }

  // --- Levels 6 to 8 (ST-17): rs-engine REVERSE_SALIENT band. ---------------
  // Read the existing reverse-salient edges (source = rs-engine) and surface
  // BOTH endpoints, ranked by abs(signed_diff). Direction picks the band:
  //   balancing  (semantic_implementation / signed_diff < 0) -> level 8
  //   information flow (the connector itself)                -> level 6
  // Default mid-band is level 7 when direction is absent.
  const rsEdges = db.prepare(
    "SELECT source, target, properties FROM edges WHERE type = 'REVERSE_SALIENT'"
  ).all();
  for (const e of rsEdges) {
    let props = {};
    try { props = JSON.parse(e.properties || '{}'); } catch (_e) { props = {}; }
    if (props.source !== 'rs-engine') continue; // only rs-engine-sourced edges
    const signed = typeof props.signed_diff === 'number' ? props.signed_diff : 0;
    const absDiff = typeof props.abs_diff === 'number' ? props.abs_diff : Math.abs(signed);
    // Band: negative signed_diff (semantic_implementation) reads as a balancing
    // lag (level 8); positive (structural_transfer) as a reinforcing lag that
    // routes signal across sections (level 6 information flow). The connector
    // endpoints carry the leverage signal either way.
    const band = signed < 0 ? 8 : 6;
    const srcRow = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(e.source);
    const tgtRow = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(e.target);
    add(e.source, band, srcRow ? srcRow.properties : null, Math.min(1, absDiff));
    add(e.target, band, tgtRow ? tgtRow.properties : null, Math.min(1, absDiff));
  }

  // --- Level 7 (Reinforcing loop): CONVERGES / ENABLES 2-cycles. ------------
  // A reinforcing loop is a node pair joined by CONVERGES (or ENABLES) edges in
  // both directions. Surface each node in such a cycle.
  for (const r of db.prepare(
    "SELECT DISTINCT a.source AS id, na.properties AS properties " +
    "FROM edges a JOIN edges b " +
    "ON a.target = b.source AND a.source = b.target " +
    "JOIN nodes na ON na.id = a.source " +
    "WHERE a.type IN ('CONVERGES', 'ENABLES') AND b.type IN ('CONVERGES', 'ENABLES')"
  ).all()) {
    add(r.id, 7, r.properties, 1);
  }

  // --- Level 9 (Delays): DEFERRED edges + valid_from/valid_until lag. -------
  for (const r of db.prepare(
    "SELECT DISTINCT n.id AS id, n.properties AS properties " +
    "FROM edges e JOIN nodes n ON n.id = e.source " +
    "WHERE e.type = 'DEFERRED'"
  ).all()) {
    add(r.id, 9, r.properties, 1);
  }
  for (const r of db.prepare(
    "SELECT id, properties FROM nodes " +
    "WHERE json_extract(properties, '$.valid_from') IS NOT NULL " +
    "OR json_extract(properties, '$.valid_until') IS NOT NULL"
  ).all()) {
    add(r.id, 9, r.properties, 0.5);
  }

  // --- Level 10 (Stock-and-flow): high (in+out) degree structural hubs. -----
  // Degree threshold of 3 keeps trivial 1-2 edge nodes out of the hub band.
  for (const r of db.prepare(
    "SELECT id, properties, deg FROM ( " +
    "  SELECT n.id AS id, n.properties AS properties, " +
    "  (SELECT COUNT(*) FROM edges e WHERE e.source = n.id) + " +
    "  (SELECT COUNT(*) FROM edges e WHERE e.target = n.id) AS deg " +
    "  FROM nodes n " +
    ") WHERE deg >= 3 ORDER BY deg DESC"
  ).all()) {
    add(r.id, 10, r.properties, Math.min(1, Number(r.deg) / 6));
  }

  // --- Level 11 (Buffers): high incoming evidence-count accumulation. -------
  // A buffer soaks up many supporting edges (INFORMS / ENABLES / CONVERGES in).
  for (const r of db.prepare(
    "SELECT n.id AS id, n.properties AS properties, COUNT(*) AS acc " +
    "FROM nodes n JOIN edges e ON e.target = n.id " +
    "AND e.type IN ('INFORMS', 'ENABLES', 'CONVERGES') " +
    "GROUP BY n.id HAVING acc >= 3"
  ).all()) {
    add(r.id, 11, r.properties, Math.min(1, Number(r.acc) / 6));
  }

  // --- Level 12 (Parameters): leaf scalar claims with no outgoing edges. -----
  for (const r of db.prepare(
    "SELECT n.id AS id, n.properties AS properties FROM nodes n " +
    "WHERE n.type IN ('claim', 'CausalClaim') " +
    "AND json_extract(n.properties, '$.scalar') IS NOT NULL " +
    "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.source = n.id)"
  ).all()) {
    add(r.id, 12, r.properties, 0);
  }

  // Rank: lower Meadows level first (highest leverage first); within a level,
  // higher score first (the per-signature signal boost).
  out.sort((a, b) => {
    if (a.meadows_level !== b.meadows_level) return a.meadows_level - b.meadows_level;
    return b.score - a.score;
  });

  return out;
}

module.exports = { scanLeveragePoints, SIGNATURES };
