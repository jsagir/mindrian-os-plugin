'use strict';
/*
 * Phase 205-02 -- typed-frame: the FUSION-substrate Frame node-write chokepoint
 * (decision D-Q5). This is the WAVE 1 SUBSTRATE net-new: a first-class Frame node
 * type in room.db that records WHICH section nodes / topics compose each live
 * frame, so Item 1 (FUSION, plan 205-07) can assemble "open frames" and record a
 * horizontal cross-frame connection instead of re-deriving frames from prose.
 *
 * D-Q5 is a navigator OVERRIDE of the graph-readiness "derive from section nodes,
 * do not mint" lean (205-CONTEXT.md graph-readiness gap-1): the navigator chose to
 * MINT a first-class Frame node. This is an ADDITIVE schema change to the local
 * node-type vocabulary -- it mirrors EXACTLY how typed-domain.cjs added the
 * DOMAIN_NODE_TYPES first-class node types and how edges.cjs grew the frozen edge
 * allowlist additively (CONTRADICTS / SELECTED_REACH idiom). Same additive idiom.
 *
 * This module mirrors lib/core/navigation/typed-domain.cjs VERBATIM in structure:
 * the frozen node-type Set, the isPlainObject helper, the stable 31-multiplier
 * hash id-minter, the additive-JSON-props discipline (the D-10 precedent), the
 * insertNode NOT-NULL-safe chokepoint, the Part 9 v1.5 audit-node carve-out, and
 * the defensive never-throw contract. It is an allow-listed navigation submodule
 * (scripts/check-substrate.cjs regex /^lib\/core\/navigation\// covers it). It
 * takes a db handle owned by the caller (via lib/core/room-db.cjs openRoomDb)
 * EXACTLY like typed-domain.cjs / typed-claim.cjs / edges.cjs writeEdge: it NEVER
 * requires node:sqlite and NEVER opens room.db itself, so it stays inside the
 * navigation allow-list with zero substrate bypass.
 *
 * Canon Part 9 (the human gate vs the audit-node carve-out):
 *   - A Frame is composition BOOKKEEPING: it records the set of member node ids
 *     that compose a live frame, asserting no venture truth of its own (the Part 9
 *     v1.5 audit-node carve-out spirit -- like typed-domain's pure-taxonomy node).
 *     By default a frame lands review_status 'proposed' (the insertNode DEFAULT);
 *     a caller may pass taxonomy:true to mark a PURE-BOOKKEEPING frame confirmed by
 *     the system rule below (no human byUser), never a truth-claim promotion.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; NO conversation prose ever lands on a Frame node. The
 *   membership set carries GENERIC HANDLES ONLY (section-node ids from phase-162 +
 *   session topic-shift markers / topic enums or hashes), never free-form user
 *   text -- so a future projection cannot breach Part 8. Frame membership is LOCAL
 *   room.db only, ZERO Brain egress.
 *
 * Canon Part 7 / Part 9: this writer NEVER opens a second write path. It mints via
 *   the shared node-insert chokepoint and is surfaced ONLY through the single
 *   lib/core/navigation.cjs chokepoint (the same additive-re-export as
 *   writeDomainNode / writeClaimNode). One governed door.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');

// The closed 1-member frame node-type Set (D-Q5: `frame` is the FIRST-CLASS
// FUSION-substrate node type minted this phase). A frame write's type is always
// 'frame'; the Set is the additive vocabulary anchor mirroring the
// DOMAIN_NODE_TYPES frozen-Set idiom in typed-domain.cjs:55. Grown ADDITIVELY:
// no existing node-type vocabulary entry is removed by adding this new file/type.
const FRAME_NODE_TYPES = Object.freeze(new Set([
  'frame',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// FRAME_NODE_ID(sessionId, frameKey) -- the idempotent id-minter. A crypto-free,
// dependency-free stable 31-multiplier hash over the frame key (mirrors
// typed-domain.cjs:75-83 / typed-claim.cjs:60-68) keeps re-writing the same
// (frameKey, sessionId) an UPSERT, not a duplicate. Node id 'frame:'+sid+':'+hash.
function FRAME_NODE_ID(sessionId, frameKey) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const key = typeof frameKey === 'string' && frameKey.length > 0 ? frameKey : 'noframe';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'frame:' + sid + ':' + hash.toString(16);
}

// normalizeMembers(members) -- coerce the membership input into a clean, deduped
// array of GENERIC-HANDLE strings (Part 8: node ids / topic enums / hashes ONLY,
// never prose). Non-string / empty entries are dropped defensively; order is
// preserved with duplicates removed. Returns [] on any non-array input.
function normalizeMembers(members) {
  if (!Array.isArray(members)) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const m of members) {
    if (typeof m !== 'string' || m.length === 0) {
      continue;
    }
    if (seen.has(m)) {
      continue;
    }
    seen.add(m);
    out.push(m);
  }
  return out;
}

// writeFrameNode(db, params) -- UPSERT a typed FUSION-substrate Frame node.
//
// params = { frameKey, sessionId, members?, topic?, taxonomy? }.
//   frameKey  -- a stable key for the frame (required); id = FRAME_NODE_ID.
//   members   -- the composition set: an array of GENERIC member node-id handles
//                (section-node ids from phase-162 + session topic-shift markers).
//                Part 8: node ids / topic enums / hashes ONLY, never prose.
//   topic     -- an OPTIONAL topic enum/hash handle (scalar), never prose.
//   taxonomy  -- OPTIONAL: true marks a pure-bookkeeping frame the system may
//                confirm (Part 9 v1.5 carve-out); absent/false -> 'proposed'.
// type = 'frame', created_by 'system'. review_status is left to the insertNode
// column DEFAULT ('proposed'); a taxonomy:true frame is then promoted to
// 'confirmed' by the scoped system rule below (never a truth-claim promotion).
// Properties bag is ADDITIVE JSON only (frameKey, members array, topic default
// ''); NEVER DDL columns (the typed-claim.cjs D-10 precedent). Defensive: never
// throws on caller input; returns { ok:false, reason } on failure.
function writeFrameNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    frameKey, sessionId, members, topic, taxonomy,
  } = params;
  if (typeof frameKey !== 'string' || frameKey.length === 0) {
    return { ok: false, reason: 'invalid_frame_key' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const memberIds = normalizeMembers(members);
  // Additive JSON props ONLY (the D-10 precedent). members / topic ride the same
  // blob, never columns; default so the shape stays stable. Part 8: generic
  // handles only, zero prose.
  const props = {
    frameKey: frameKey,
    members: memberIds,
    topic: typeof topic === 'string' ? topic : '',
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = FRAME_NODE_ID(sid, frameKey);
  const sourcePath = 'frame:' + sid + ':' + frameKey;
  try {
    // Mint via the shared NOT-NULL-safe chokepoint (lands review_status DEFAULT
    // 'proposed'). created_by='system' satisfies the Phase-109 CHECK.
    insertNode(db, nodeId, 'frame', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
    });
  } catch (e) {
    return { ok: false, reason: 'frame_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  // Part 9 v1.5 audit-node carve-out: a PURE-BOOKKEEPING frame (taxonomy:true) is
  // system bookkeeping and may be system-confirmed. This is NOT a truth-claim
  // promotion (that stays on the human confirmNode byUser path); it is the system
  // rule that wrote the composition confirming its own bookkeeping write.
  // Defensive: an un-migrated 3-col schema has no review_status column, so guard.
  if (taxonomy === true) {
    try {
      const cols = db.prepare('PRAGMA table_info(nodes)').all();
      const hasReviewStatus = cols.some((c) => c && c.name === 'review_status');
      if (hasReviewStatus) {
        db.prepare("UPDATE nodes SET review_status = 'confirmed' WHERE id = ?").run(nodeId);
      }
    } catch (_e) {
      // A confirm-promotion failure does not fail the node write; the node landed
      // at 'proposed' (the safe default). Stay defensive, never throw.
    }
  }
  return { ok: true, node_id: nodeId, type: 'frame', members: memberIds };
}

module.exports = {
  writeFrameNode,
  FRAME_NODE_TYPES,
  FRAME_NODE_ID,
};
