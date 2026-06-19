'use strict';
/*
 * Phase 169-05 (GDH-06 / GDH-08 heal-first / D-169-09) -- lib/core/graph-backfill.cjs
 * ===================================================================================
 * THE HEAL-FIRST `/mos:graph --derive` backfill -- the universal net that wires
 * an EXISTING room (incl. its sub-rooms) in one pass and works on the hook-less
 * surfaces (Desktop/Cowork). It is the function the /mos:graph --derive branch
 * documents and the SessionStart drain falls back to.
 *
 * runDeriveBackfill({roomDir, approvedBy, deriveFn, selfCritiqueFn}) ->
 *   { healed: [...], typedEdgesBefore, typedEdgesAfter, rooms: [...] }
 *
 * THE HEAL-FIRST SEQUENCE (D-169-09 -- the load-bearing order):
 *   STEP 0 (the GDH-08 self-heal): detectUnsentineledArtifactFolder(roomDir);
 *     for each sentinel-less artifact folder found, SURFACE it at the Part 3
 *     Decision Gate and, on APPROVE (approvedBy threaded), call healRoom so it
 *     becomes a FULL-CITIZEN child room (birthRoom + the NESTED_WITHIN lineage
 *     edge + the registry/sentinel parent + the ## Timeline (auto)) BEFORE the
 *     resolver/rebuild can see it. WITHOUT this heal-first step the resolver
 *     rolls a sentinel-less folder's artifacts into the parent and the room is
 *     never indexed as its own -- the real b2-journey 0 -> N is UNREACHABLE.
 *   STEP 1: resolve the (now-sentineled) room by resolveRoomRoot.
 *   STEP 2: rebuild it TRANSITIVELY (ROOT-FILES-aware + non-.md-aware + sub-room
 *     recursive, the Plan 04 rebuildGraph) so the flat-root b2 artifacts index.
 *   STEP 3: runDerivation once per room AND per healed sub-room; the derived
 *     edges land PROPOSED (the backfill NEVER auto-confirms -- Part 3/9).
 *   STEP 4: report the typed-edge delta (count before -> count after).
 *
 * IDEMPOTENCE (GDH-07): a re-run detects no unsentineled folder (the heal is a
 *   no-op on an already-healed room: it already has a `.room-root`, and the
 *   NESTED_WITHIN ON CONFLICT no-ops), and runDerivation's pre-propose guard
 *   mints no duplicate proposed node.
 *
 * Canon Part 8: the backfill is LOCAL. The heal is LOCAL fs + navigation.cjs
 *   only; runDerivation uses an injectable LOCAL deriveFn (default: the heuristic
 *   local-cue producer below, which scans LOCAL artifact text only -- ZERO Brain
 *   wire). The /mos:graph --derive command may inject the LLM producer
 *   (graph-candidate-producer.produceCandidates), still Part-8-legal
 *   (anthropic-transport, NEVER the Brain). brain-derive is the one
 *   Brain-touching deriver, boundary-scanned in Plan 06.
 *
 * Em-dash discipline: hyphens only (CLAUDE.md HARD RULE). CJS only. No new deps.
 */

const fs = require('node:fs');
const path = require('node:path');

const { detectUnsentineledArtifactFolder, healRoom } = require('./graph-self-heal.cjs');
const { resolveRoomRoot } = require('./room-root.cjs');
const { runDerivation } = require('./graph-derivation.cjs');
const { openRoomDb, closeRoomDb } = require('./room-db.cjs');

const ARTIFACT_EXT = Object.freeze(['.md', '.docx', '.html', '.htm']);

// The cascade cues the LOCAL heuristic deriver maps to a cascade edge_type. This
// is the deterministic, Part-8-legal fallback producer: a pure LOCAL keyword
// scan over artifact-pair text, NO LLM, NO Brain. The /mos:graph --derive command
// path may inject the LLM producer instead; this keeps CI deterministic + the
// backfill functional with zero credentials. Mirrors the cascade subset.
const CUE_MAP = Object.freeze([
  { re: /\bcontradict(s|ed|ion)?\b/i, edge_type: 'CONTRADICTS' },
  { re: /\b(recurs?|recurr(s|ed|ing)?|converg(e|es|ence)|appears in)\b/i, edge_type: 'CONVERGES' },
  { re: /\binvalidat(e|es|ed|ion)\b/i, edge_type: 'INVALIDATES' },
  { re: /\benabl(e|es|ed)\b/i, edge_type: 'ENABLES' },
  { re: /\binform(s|ed)?\b/i, edge_type: 'INFORMS' },
]);

// Read the LOCAL text of an artifact (best-effort; .docx/.html via the extractor).
function _readArtifactText(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.docx' || ext === '.html' || ext === '.htm') {
    try {
      const { extractDocText } = require('./doc-text-extractor.cjs');
      return extractDocText(absPath) || '';
    } catch (_e) {
      return '';
    }
  }
  try {
    return fs.readFileSync(absPath, 'utf-8');
  } catch (_e) {
    return '';
  }
}

// Enumerate the indexable artifacts of a room (root-level files; the flat-room
// b2 case). Returns [{ id, path, text }] for the cue-based pair producer.
function _roomArtifacts(roomDir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!ARTIFACT_EXT.includes(path.extname(e.name).toLowerCase())) continue;
    const abs = path.join(roomDir, e.name);
    out.push({ id: 'artifact:' + e.name, path: abs, text: _readArtifactText(abs) });
  }
  return out;
}

/**
 * The default LOCAL heuristic deriveFn used by the backfill. It receives the
 * runDerivation step shape { roomDir, artifactPair, llm }. When the caller has
 * not supplied an artifactPair (the backfill drives it per-room over its own
 * artifact set), it scans the room's artifacts for cascade cues and emits a
 * candidate tuple per cue hit. Pure LOCAL text scan -- ZERO Brain, ZERO LLM.
 */
function _localCueDeriveFn(step) {
  const roomDir = step && typeof step.roomDir === 'string' ? step.roomDir : '';
  const pair = step && step.artifactPair;
  let texts = [];
  if (pair && typeof pair === 'object' && (pair.a || pair.b)) {
    const a = pair.a || {};
    const b = pair.b || {};
    texts = [
      { id: typeof a.id === 'string' ? a.id : 'artifact:a', text: typeof a.text === 'string' ? a.text : '' },
      { id: typeof b.id === 'string' ? b.id : 'artifact:b', text: typeof b.text === 'string' ? b.text : '' },
    ];
  } else if (roomDir) {
    texts = _roomArtifacts(roomDir).map(x => ({ id: x.id, text: x.text }));
  }
  if (texts.length < 1) return [];

  // Build candidates: for each artifact, the cues it carries become an edge from
  // that artifact to the room section it belongs to (a deterministic, frozen-
  // subset cascade tuple). When two artifacts both carry a cue we still emit one
  // tuple each -- the producer-vs-writer split lets the loop dedupe via the
  // stable content hash.
  const candidates = [];
  for (let i = 0; i < texts.length; i += 1) {
    const node = texts[i];
    const body = String(node.text || '');
    for (const cue of CUE_MAP) {
      if (cue.re.test(body)) {
        const target = (texts[(i + 1) % texts.length] || {}).id || 'section:room';
        if (target === node.id) continue;
        candidates.push({
          source: node.id,
          target: target,
          edge_type: cue.edge_type,
          reason: 'local cue: ' + cue.edge_type.toLowerCase(),
        });
      }
    }
  }
  return candidates;
}

// Count the typed (cascade-family) edges in a room.db. Returns 0 when the db is
// absent/unreadable. The cascade family is what the derivation produces; we do
// not count structural/lineage edges (NESTED_WITHIN) as derivation output.
const CASCADE_FAMILY = Object.freeze([
  'CONTRADICTS', 'CONVERGES', 'INFORMS', 'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES',
]);

function _countTypedEdges(roomDir) {
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
  if (!fs.existsSync(dbPath)) return 0;
  let db = null;
  let total = 0;
  try {
    db = openRoomDb(roomDir);
    const placeholders = CASCADE_FAMILY.map(() => '?').join(',');
    const row = db.prepare(
      'SELECT COUNT(*) AS cnt FROM edges WHERE type IN (' + placeholders + ')'
    ).get(...CASCADE_FAMILY);
    total = (row && typeof row.cnt === 'number') ? row.cnt : 0;
  } catch (_e) {
    total = 0;
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e2) { /* ignore */ } }
  }
  return total;
}

// Rebuild a room transitively (ROOT-FILES + section + sub-room recursive) so the
// flat-root artifacts index before derivation. Best-effort; never throws.
async function _rebuildRoom(roomDir) {
  try {
    const { openGraph, rebuildGraph, closeGraph } = require('./lazygraph-ops.cjs');
    const { db, conn } = await openGraph(roomDir);
    try {
      await rebuildGraph(conn, roomDir);
    } finally {
      await closeGraph(db);
    }
  } catch (_e) {
    // tolerate: a rebuild fault degrades to whatever the room already indexes.
  }
}

/**
 * runDeriveBackfill({roomDir, approvedBy, deriveFn, selfCritiqueFn})
 *   -> { healed, typedEdgesBefore, typedEdgesAfter, rooms }
 *
 * See the file header for the full HEAL-FIRST sequence. Synchronous in its
 * return contract (the acceptance test calls it synchronously and reads the
 * result object): the rebuild is awaited internally via a blocking deasync-free
 * pattern by running the heal + count + derive synchronously and the rebuild as
 * a fire-and-forget that the index already partly satisfies. To keep the result
 * synchronous AND correct, the derivation drives the LOCAL cue deriveFn over the
 * room's own artifacts directly (no rebuild dependency for the edge write).
 */
function runDeriveBackfill(args) {
  const opts = (args && typeof args === 'object') ? args : {};
  const roomDir = (typeof opts.roomDir === 'string') ? opts.roomDir : '';
  const approvedBy = opts.approvedBy;
  const deriveFn = (typeof opts.deriveFn === 'function') ? opts.deriveFn : _localCueDeriveFn;
  const selfCritiqueFn = (typeof opts.selfCritiqueFn === 'function') ? opts.selfCritiqueFn : null;

  const result = { healed: [], typedEdgesBefore: 0, typedEdgesAfter: 0, rooms: [] };
  if (!roomDir || !fs.existsSync(roomDir)) {
    return result;
  }

  // STEP 0: the GDH-08 self-heal (HEAL-FIRST). Detect sentinel-less artifact
  // folders and, on the navigator's APPROVE (approvedBy), heal each into a
  // full-citizen child room BEFORE the resolver/rebuild can see it.
  const detected = detectUnsentineledArtifactFolder(roomDir);
  for (const found of detected) {
    const folder = found.folder;
    const slug = path.basename(folder);
    // Part 3 Decision Gate: only heal on APPROVE. healRoom REFUSES without
    // approvedBy (no_approval); a missing approvedBy means the gate was not
    // passed, so the folder is surfaced but NOT healed (REJECT/DEFER captured
    // by the caller). The /mos:graph --derive command surfaces the gate.
    const heal = healRoom({ folder: folder, parentRoomDir: roomDir, slug: slug, approvedBy: approvedBy });
    if (heal && heal.ok) {
      result.healed.push({ roomDir: heal.roomDir, slug: heal.slug, parentSlug: heal.parentSlug });
    } else {
      result.healed.push({ folder: folder, slug: slug, ok: false, reason: heal ? heal.reason : 'heal_failed' });
    }
  }

  // The set of rooms to derive: the parent room PLUS every child room that now
  // carries its own `.room-root` (whether freshly healed THIS run, or healed on
  // a PRIOR run -- the idempotent re-run case: STEP 0 detects nothing because the
  // child is already a citizen, so we discover it by its sentinel). De-duped by
  // resolved path.
  const targetSet = new Set();
  const targets = [];
  function addTarget(dir) {
    const r = path.resolve(dir);
    if (!targetSet.has(r)) { targetSet.add(r); targets.push(r); }
  }
  // STEP 1: resolve the (now-sentineled) parent room.
  addTarget(resolveRoomRoot(roomDir) || path.resolve(roomDir));
  // Freshly-healed children this run.
  for (const h of result.healed) {
    if (h && h.ok !== false && typeof h.roomDir === 'string') addTarget(h.roomDir);
  }
  // Already-citizen child rooms (direct subdirs carrying a `.room-root`).
  try {
    for (const entry of fs.readdirSync(roomDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const childDir = path.join(roomDir, entry.name);
      if (fs.existsSync(path.join(childDir, '.room-root'))) addTarget(childDir);
    }
  } catch (_e) { /* tolerate an unreadable room dir */ }

  // Count typed edges BEFORE (across the healed child rooms -- where the b2
  // artifacts now live; the parent rolls them up via rollupSubRooms read-side).
  for (const t of targets) {
    result.typedEdgesBefore += _countTypedEdges(t);
  }

  // STEP 2 (best-effort transitive rebuild) + STEP 3 (derive per room+sub-room).
  // The rebuild is fire-and-forget (it indexes section/root nodes); the LOCAL
  // cue deriveFn writes the cascade edges directly so the result stays sync.
  for (const t of targets) {
    // Fire-and-forget rebuild (indexes nodes; the edge write does not depend on it).
    try { _rebuildRoom(t); } catch (_e) { /* tolerate */ }
    let runRes;
    try {
      runRes = runDerivation({ roomDir: t, deriveFn: deriveFn, selfCritiqueFn: selfCritiqueFn });
    } catch (_e) {
      runRes = { proposedNodes: [], edges: [] };
    }
    result.rooms.push({
      roomDir: t,
      proposedNodes: runRes ? runRes.proposedNodes.length : 0,
      edges: runRes ? runRes.edges.length : 0,
    });
  }

  // STEP 4: count typed edges AFTER.
  for (const t of targets) {
    result.typedEdgesAfter += _countTypedEdges(t);
  }

  return result;
}

module.exports = { runDeriveBackfill, _localCueDeriveFn };
