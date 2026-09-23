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
 * Phase 358-07 (Rome B2, rulings 2/3/5, LOCKED 2026-09-23): hardens this module
 * with a SEPARATE role for the room's ONE governing-question record. A
 * governing_question role write is a DIFFERENT shape from the lenient FUSION
 * path above: it is IMMUTABLE per version (version_exists refuses a re-write,
 * never a silent overwrite), REQUIRES an origin from the one FRAME_ORIGINS_ORDERED
 * constant (TODO(358): the labels are provisional until the paper author
 * confirms them), and carries generic handles only (question_handle,
 * refinement_handle, hashes) -- never question or account prose (Part 8). The
 * lenient FUSION path above is UNCHANGED in behavior (test-205-frame-node.cjs
 * stays green); the role branch is a separate, stricter gate reached only when
 * params.frameRole === GOVERNING_QUESTION_ROLE. The ONLY write door for this role
 * is lib/core/frame-provenance.cjs::setGoverningQuestion (ruling 2, one door);
 * this file is the substrate it writes through, not a second door.
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

// TODO(358): replace these origin labels with the paper author's definitions
// once confirmed (slide A1 names the four origins without defining them).
// Provisional source: the navigator's own working definitions, 2026-09-23.
// Same one-constant idiom as VERIFICATION_RUNGS (lib/core/navigation/
// verification.cjs:33-39): swapping the labels is a one-constant edit plus a
// test update, never a scattered literal hunt.
const FRAME_ORIGINS_ORDERED = Object.freeze([
  Object.freeze({ id: 'chosen', label: 'chosen by the officer' }),
  Object.freeze({ id: 'tasking', label: 'handed down as a tasking' }),
  Object.freeze({ id: 'prompt', label: 'suggested in conversation with the tool' }),
  Object.freeze({ id: 'inherited', label: 'carried over from earlier work' }),
]);
// FRAME_ORIGINS stays a Set (unchanged shape for every existing caller of the
// lenient FUSION path), now DERIVED from FRAME_ORIGINS_ORDERED so there is
// exactly one source of the origin vocabulary.
const FRAME_ORIGINS = Object.freeze(new Set(FRAME_ORIGINS_ORDERED.map((o) => o.id)));

// frameOriginInfo(id) -- 1-based position, or null when id is not a member of
// FRAME_ORIGINS_ORDERED. Mirrors verification.cjs::rungInfo.
function frameOriginInfo(id) {
  for (let i = 0; i < FRAME_ORIGINS_ORDERED.length; i += 1) {
    if (FRAME_ORIGINS_ORDERED[i].id === id) {
      return { id: FRAME_ORIGINS_ORDERED[i].id, label: FRAME_ORIGINS_ORDERED[i].label, position: i + 1 };
    }
  }
  return null;
}

// Phase 358-07 (ruling 2): the room's ONE governing-question record is a
// SEPARATE role on the same 'frame' node type (not a new node type -- Part 9
// additive-only discipline). GOVERNING_QUESTION_SCOPE is 'room': the record is
// room-level, not per-session (unlike the lenient FUSION frames above, which
// scope by sessionId). GOVERNING_QUESTION_NODE_ID is stable per version, so a
// version's identity never depends on wall-clock or caller-supplied keys.
const GOVERNING_QUESTION_ROLE = 'governing_question';
const GOVERNING_QUESTION_FRAME_KEY = 'governing-question';
const GOVERNING_QUESTION_SCOPE = 'room';
function GOVERNING_QUESTION_NODE_ID(version) {
  return FRAME_NODE_ID(GOVERNING_QUESTION_SCOPE, GOVERNING_QUESTION_FRAME_KEY + ':v' + version);
}

// Shape gates for the role branch. Handles are GENERATED-ONLY (version + hash
// prefix + nonce, minted by lib/core/frame-provenance.cjs); this module only
// verifies the shape, it never constructs a handle itself.
const QUESTION_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const QUESTION_HANDLE_RE = /^\.mindrian\/frames\/q-v\d+-[0-9a-f]{8}-[0-9a-f]{6}\.md$/;
const ACCOUNT_HANDLE_RE = /^\.mindrian\/frames\/a-v\d+-[0-9a-f]{8}-[0-9a-f]{6}\.md$/;

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

// writeGoverningQuestionRole(db, params) -- the STRICT, IMMUTABLE role branch for
// the room's ONE governing-question record (Phase 358-07, rulings 2/3). Reached
// only from writeFrameNode when params.frameRole === GOVERNING_QUESTION_ROLE, and
// checked BEFORE the lenient FUSION path so the two never interact. Every
// refusal writes nothing; a re-write of an existing version is refused
// version_exists (no on_conflict update path -- history is immutable, T-358-31).
// Validation order matches the plan exactly: taxonomy -> invalid_origin ->
// invalid_version -> invalid_question_hash -> invalid_question_handle ->
// invalid_change_kind -> missing_predecessor -> refines_needs_account_handle ->
// relocates_has_account. Never throws (wrapped in try, frame_write_failed on any
// unexpected error).
function writeGoverningQuestionRole(db, params) {
  try {
    const {
      version, origin, governingThoughtHash, questionHandle,
      predecessorHash, predecessorNodeId, changeKind, refinementHandle,
      accountHash, setBy, setById, taxonomy,
    } = params;

    if (taxonomy === true) {
      return { ok: false, reason: 'taxonomy_not_allowed' };
    }
    if (typeof origin !== 'string' || !FRAME_ORIGINS.has(origin)) {
      return { ok: false, reason: 'invalid_origin' };
    }
    if (!Number.isInteger(version) || version < 1) {
      return { ok: false, reason: 'invalid_version' };
    }
    if (typeof governingThoughtHash !== 'string' || !QUESTION_HASH_RE.test(governingThoughtHash)) {
      return { ok: false, reason: 'invalid_question_hash' };
    }
    if (typeof questionHandle !== 'string' || !QUESTION_HANDLE_RE.test(questionHandle)) {
      return { ok: false, reason: 'invalid_question_handle' };
    }
    if (version === 1) {
      if (changeKind !== undefined && changeKind !== null) {
        return { ok: false, reason: 'invalid_change_kind' };
      }
    } else {
      if (changeKind !== 'refines' && changeKind !== 'relocates') {
        return { ok: false, reason: 'invalid_change_kind' };
      }
      const hasPredecessorHash = typeof predecessorHash === 'string' && QUESTION_HASH_RE.test(predecessorHash);
      const hasPredecessorNodeId = typeof predecessorNodeId === 'string' && predecessorNodeId.length > 0;
      if (!hasPredecessorHash && !hasPredecessorNodeId) {
        return { ok: false, reason: 'missing_predecessor' };
      }
    }
    if (changeKind === 'refines') {
      const hasHandle = typeof refinementHandle === 'string' && ACCOUNT_HANDLE_RE.test(refinementHandle);
      const hasAccountHash = typeof accountHash === 'string' && QUESTION_HASH_RE.test(accountHash);
      if (!hasHandle || !hasAccountHash) {
        return { ok: false, reason: 'refines_needs_account_handle' };
      }
    }
    if (changeKind === 'relocates') {
      const hasHandle = typeof refinementHandle === 'string' && refinementHandle.length > 0;
      const hasAccountHash = typeof accountHash === 'string' && accountHash.length > 0;
      if (hasHandle || hasAccountHash) {
        return { ok: false, reason: 'relocates_has_account' };
      }
    }

    // The caller's frameKey / sessionId / versionKey are ignored for this role:
    // identity is derived ONLY from the version (immutable, stable per version).
    const nodeId = GOVERNING_QUESTION_NODE_ID(version);
    const existing = db.prepare('SELECT 1 FROM nodes WHERE id = ?').get(nodeId);
    if (existing) {
      return { ok: false, reason: 'version_exists' };
    }

    // Additive JSON props ONLY, generic handles and enums, never prose (Part 8).
    const props = {
      frameKey: GOVERNING_QUESTION_FRAME_KEY,
      members: [],
      topic: '',
      frame_role: GOVERNING_QUESTION_ROLE,
      version: version,
      origin: origin,
      // Field name kept as governing_thought_hash for substrate-property
      // compatibility with the lenient path above; this is the QUESTION hash,
      // never rendered or referred to as "governing thought" anywhere upstream.
      governing_thought_hash: governingThoughtHash,
      question_handle: questionHandle,
    };
    if (typeof predecessorHash === 'string' && predecessorHash.length > 0) {
      props.predecessor_hash = predecessorHash;
    }
    if (typeof predecessorNodeId === 'string' && predecessorNodeId.length > 0) {
      props.predecessor_node_id = predecessorNodeId;
    }
    if (changeKind === 'refines' || changeKind === 'relocates') {
      props.change_kind = changeKind;
    }
    if (typeof refinementHandle === 'string' && refinementHandle.length > 0) {
      props.refinement_handle = refinementHandle;
    }
    if (typeof accountHash === 'string' && accountHash.length > 0) {
      props.account_hash = accountHash;
    }
    props.set_by = setBy === 'user' ? 'user' : 'system';
    if (typeof setById === 'string' && setById.length >= 1 && setById.length <= 128) {
      props.set_by_id = setById;
    }

    let propsJson;
    try {
      propsJson = JSON.stringify(props);
    } catch (_e) {
      return { ok: false, reason: 'properties_serialize_failed' };
    }

    const sourcePath = 'frame:' + GOVERNING_QUESTION_SCOPE + ':' + GOVERNING_QUESTION_FRAME_KEY;
    // on_conflict 'nothing': a race that lands the same id between the
    // existence check above and this insert leaves the FIRST writer's row
    // byte-identical (immutable history, T-358-31); the caller's own
    // ok:true/false is derived from the pre-check, matching the version_exists
    // contract even under the race.
    insertNode(db, nodeId, 'frame', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      // R17-02: a role-write records the officer's choice as system
      // bookkeeping (composition + provenance), not a truth-claim.
      epistemic_type: 'observation',
      on_conflict: 'nothing',
    });
    return { ok: true, node_id: nodeId, type: 'frame', version: version };
  } catch (e) {
    return { ok: false, reason: 'frame_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
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
//
// Phase 358-07: when params.frameRole === GOVERNING_QUESTION_ROLE, this function
// delegates to the STRICT, IMMUTABLE role branch above INSTEAD of the lenient
// path below (checked first, so the two paths never interact). The lenient path
// itself is UNCHANGED in behavior.
function writeFrameNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  if (params.frameRole === GOVERNING_QUESTION_ROLE) {
    return writeGoverningQuestionRole(db, params);
  }
  const {
    frameKey, sessionId, members, topic, taxonomy, origin,
    governingThoughtHash, predecessorHash, versionKey, changeKind, refinementHandle,
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
  if (typeof origin === 'string' && FRAME_ORIGINS.has(origin)) props.origin = origin;
  if (typeof governingThoughtHash === 'string' && governingThoughtHash.length > 0) {
    props.governing_thought_hash = governingThoughtHash;
  }
  if (typeof predecessorHash === 'string' && predecessorHash.length > 0) {
    props.predecessor_hash = predecessorHash;
  }
  if (typeof changeKind === 'string' && (changeKind === 'refines' || changeKind === 'relocates')) {
    props.change_kind = changeKind;
  }
  if (typeof refinementHandle === 'string' && refinementHandle.length > 0) {
    props.refinement_handle = refinementHandle;
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const stableKey = (typeof versionKey === 'string' && versionKey.length > 0)
    ? versionKey : frameKey;
  const nodeId = FRAME_NODE_ID(sid, stableKey);
  const sourcePath = 'frame:' + sid + ':' + frameKey;
  try {
    // Mint via the shared NOT-NULL-safe chokepoint (lands review_status DEFAULT
    // 'proposed'). created_by='system' satisfies the Phase-109 CHECK.
    insertNode(db, nodeId, 'frame', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      // R17-02: 'observation' -- a structural grouping node (topic + member
      // handles), system-bookkeeping, not a truth-claim.
      epistemic_type: 'observation',
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
        // Phase 194-06 Task 1: node-birth bookkeeping. A co-session cannot hold a
        // readVersion of a Frame node being born, so the reconcile-guard CAS token
        // bump (last_modified_at) is intentionally OMITTED here; allowlisted in
        // tests/test-194-lastmod-discipline.test.cjs (Frame type minted Phase 205,
        // post-dates the PATTERNS.md 7-site audit but carries the identical shape).
        db.prepare("UPDATE nodes SET review_status = 'confirmed' WHERE id = ?").run(nodeId);
      }
    } catch (_e) {
      // A confirm-promotion failure does not fail the node write; the node landed
      // at 'proposed' (the safe default). Stay defensive, never throw.
    }
  }
  return { ok: true, node_id: nodeId, type: 'frame', members: memberIds };
}

// Classify a governing-question change without inferring user intent. A
// refinement requires an explicit artifact handle explaining what the prior
// question got wrong. Otherwise the change is a relocation and both frames
// remain valid historical records.
function classifyFrameChange(previous, current) {
  if (!isPlainObject(previous) || !isPlainObject(current)) return 'relocates';
  if (!previous.governing_thought_hash || !current.governing_thought_hash
      || previous.governing_thought_hash === current.governing_thought_hash) return 'unchanged';
  return typeof current.refinement_handle === 'string' && current.refinement_handle.length > 0
    ? 'refines' : 'relocates';
}

// readFrameProvenance(db, params) -- Phase 358-07 hardening: now ORDERS its
// result (COALESCE(version, 0) ASC, created_at ASC, rowid ASC -- a plain FUSION
// frame carries no version prop and sorts as 0, preserving its own relative
// insertion order via the created_at / rowid tie-breakers) and adds version /
// created_at / set_at / question_handle / frame_role to every returned row
// (all additive; every field this function already returned is unchanged). A
// legacy pre-created_at schema falls back to an unordered-by-time, rowid-order
// read with created_at / set_at both null, rather than throwing.
function readFrameProvenance(db, params) {
  if (!db || typeof db.prepare !== 'function') return [];
  const p = isPlainObject(params) ? params : {};
  const sid = typeof p.sessionId === 'string' && p.sessionId.length > 0 ? p.sessionId : null;
  let rows;
  let hasCreatedAt = true;
  try {
    const sql = "SELECT id, properties, review_status, created_at FROM nodes WHERE type = 'frame'"
      + (sid ? ' AND source_path LIKE ?' : '')
      + " ORDER BY COALESCE(CAST(json_extract(properties, '$.version') AS INTEGER), 0) ASC, "
      + 'created_at ASC, rowid ASC';
    rows = sid ? db.prepare(sql).all('frame:' + sid + ':%') : db.prepare(sql).all();
  } catch (_e) {
    hasCreatedAt = false;
    try {
      const sql2 = "SELECT id, properties, review_status FROM nodes WHERE type = 'frame'"
        + (sid ? ' AND source_path LIKE ?' : '')
        + ' ORDER BY rowid ASC';
      rows = sid ? db.prepare(sql2).all('frame:' + sid + ':%') : db.prepare(sql2).all();
    } catch (_e2) {
      return [];
    }
  }
  return (rows || []).map((row) => {
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    const version = Number.isInteger(props.version) ? props.version : null;
    const createdAt = hasCreatedAt && typeof row.created_at === 'number' ? row.created_at : null;
    return {
      node_id: row.id,
      frame_key: typeof props.frameKey === 'string' ? props.frameKey : '',
      origin: FRAME_ORIGINS.has(props.origin) ? props.origin : null,
      governing_thought_hash: typeof props.governing_thought_hash === 'string' ? props.governing_thought_hash : null,
      predecessor_hash: typeof props.predecessor_hash === 'string' ? props.predecessor_hash : null,
      change_kind: props.change_kind === 'refines' || props.change_kind === 'relocates' ? props.change_kind : null,
      refinement_handle: typeof props.refinement_handle === 'string' ? props.refinement_handle : null,
      review_status: typeof row.review_status === 'string' ? row.review_status : 'proposed',
      version: version,
      created_at: createdAt,
      set_at: createdAt !== null ? new Date(createdAt).toISOString() : null,
      question_handle: typeof props.question_handle === 'string' ? props.question_handle : null,
      frame_role: typeof props.frame_role === 'string' ? props.frame_role : null,
    };
  });
}

// readGoverningQuestionVersions(db) -- Phase 358-07: the ordered reader for the
// room's ONE governing-question record. Returns every version OLDEST FIRST
// (never latest-first -- history readers scan forward). [] on any failure or a
// non-db argument, never throws. This is the ONLY reader that filters
// specifically to frame_role = 'governing_question'; readFrameProvenance above
// stays the general-purpose frame reader (both are surfaced through
// navigation.cjs).
function readGoverningQuestionVersions(db) {
  if (!db || typeof db.prepare !== 'function') return [];
  let rows;
  try {
    rows = db.prepare(
      "SELECT id, properties, review_status, created_at FROM nodes "
      + "WHERE type = 'frame' AND json_extract(properties, '$.frame_role') = 'governing_question' "
      + "ORDER BY CAST(json_extract(properties, '$.version') AS INTEGER) ASC, created_at ASC, rowid ASC"
    ).all();
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const row of rows || []) {
    let props;
    try {
      props = JSON.parse(row.properties || '{}');
    } catch (_e) {
      continue;
    }
    const version = Number.isInteger(props.version) ? props.version : null;
    if (version === null) continue;
    const createdAt = typeof row.created_at === 'number' ? row.created_at : null;
    out.push({
      node_id: row.id,
      version: version,
      origin: FRAME_ORIGINS.has(props.origin) ? props.origin : null,
      question_hash: typeof props.governing_thought_hash === 'string' ? props.governing_thought_hash : null,
      question_handle: typeof props.question_handle === 'string' ? props.question_handle : null,
      predecessor_hash: typeof props.predecessor_hash === 'string' ? props.predecessor_hash : null,
      predecessor_node_id: typeof props.predecessor_node_id === 'string' ? props.predecessor_node_id : null,
      change_kind: props.change_kind === 'refines' || props.change_kind === 'relocates' ? props.change_kind : null,
      refinement_handle: typeof props.refinement_handle === 'string' ? props.refinement_handle : null,
      account_hash: typeof props.account_hash === 'string' ? props.account_hash : null,
      set_by: typeof props.set_by === 'string' ? props.set_by : null,
      set_by_id: typeof props.set_by_id === 'string' ? props.set_by_id : null,
      review_status: typeof row.review_status === 'string' ? row.review_status : 'proposed',
      created_at: createdAt,
      set_at: createdAt !== null ? new Date(createdAt).toISOString() : null,
    });
  }
  return out;
}

// readOpenFrames(db, params) -- the FUSION read helper (Phase 205-07). The
// horizontal cross-frame router (fusion-router.cjs) assembles the set of "open
// frames" by reading the live Frame nodes back from room.db instead of
// re-deriving them from prose. This is the READ counterpart to writeFrameNode,
// living in the SAME navigation submodule (allow-listed by
// scripts/check-substrate.cjs /^lib\/core\/navigation\//), so the read stays
// inside the single navigation chokepoint family (Canon Part 9). It takes the
// caller-owned db handle EXACTLY like writeFrameNode (never opens room.db, never
// requires node:sqlite), keeping Test 8's zero-substrate-bypass grep green.
//
// params = { sessionId?, limit? }.
//   sessionId -- OPTIONAL: when a non-empty string, only frames whose
//                source_path is scoped to that session (the 'frame:'+sid+':'
//                prefix minted by writeFrameNode) are returned; absent -> all.
//   limit     -- OPTIONAL positive integer cap on rows returned.
// Returns an ARRAY of clean frame descriptors:
//   { node_id, frameKey, members (string[]), topic, review_status }.
// Part 8: only the LOCAL generic handles (node ids / topic enums) ride back;
// membership was written prose-free, so nothing prose surfaces here. Defensive:
// never throws on caller input or a malformed row; returns [] on any failure.
//
// Phase 358-07 (Pitfall 3): a governing-question version is a room-level
// provenance record, NOT a FUSION open frame -- it is excluded from every
// result this function returns, regardless of sessionId / limit.
function readOpenFrames(db, params) {
  if (!db || typeof db.prepare !== 'function') {
    return [];
  }
  const p = isPlainObject(params) ? params : {};
  const sid = typeof p.sessionId === 'string' && p.sessionId.length > 0 ? p.sessionId : null;
  const limit = (typeof p.limit === 'number' && Number.isFinite(p.limit) && p.limit > 0)
    ? Math.floor(p.limit) : null;
  // Governing-question versions are room-level provenance records, not FUSION
  // open frames (Pitfall 3, Phase 358-07).
  const roleExclusion = "(json_extract(properties, '$.frame_role') IS NULL "
    + "OR json_extract(properties, '$.frame_role') <> 'governing_question')";
  let rows;
  try {
    if (sid) {
      const like = 'frame:' + sid + ':%';
      const sql = "SELECT id, properties, review_status FROM nodes WHERE type = 'frame' "
        + 'AND source_path LIKE ? AND ' + roleExclusion + (limit ? ' LIMIT ' + limit : '');
      rows = db.prepare(sql).all(like);
    } else {
      const sql = "SELECT id, properties, review_status FROM nodes WHERE type = 'frame' "
        + 'AND ' + roleExclusion + (limit ? ' LIMIT ' + limit : '');
      rows = db.prepare(sql).all();
    }
  } catch (_e) {
    return [];
  }
  if (!Array.isArray(rows)) {
    return [];
  }
  const out = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string') {
      continue;
    }
    let props = {};
    try {
      props = JSON.parse(row.properties || '{}');
    } catch (_e) {
      props = {};
    }
    out.push({
      node_id: row.id,
      frameKey: typeof props.frameKey === 'string' ? props.frameKey : '',
      members: Array.isArray(props.members) ? props.members.slice() : [],
      topic: typeof props.topic === 'string' ? props.topic : '',
      review_status: typeof row.review_status === 'string' ? row.review_status : 'proposed',
    });
  }
  return out;
}

module.exports = {
  writeFrameNode,
  readOpenFrames,
  FRAME_NODE_TYPES,
  FRAME_NODE_ID,
  FRAME_ORIGINS,
  classifyFrameChange,
  readFrameProvenance,
  // Phase 358-07 (Rome B2, rulings 2/3): the hardened governing-question
  // substrate additions. All additive; nothing above is removed or renamed.
  FRAME_ORIGINS_ORDERED,
  frameOriginInfo,
  GOVERNING_QUESTION_ROLE,
  GOVERNING_QUESTION_FRAME_KEY,
  GOVERNING_QUESTION_SCOPE,
  GOVERNING_QUESTION_NODE_ID,
  readGoverningQuestionVersions,
};
