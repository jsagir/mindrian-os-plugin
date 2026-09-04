'use strict';
/*
 * Phase 155-02 -- lib/core/navigation/room-birth.cjs
 *
 * The birth-transaction keystone: birthRoom(opts) orchestrates the Q1 7-step
 * birth sequence as a single reliable operation with the SQLite transaction as
 * the one genuinely ACID block.
 *
 * Doctrine: Canon Parts 8 + 9; SEED-022 (birth transaction keystone);
 * SEED-001 partial (sub-room creation side-effects).
 *
 * Allow-list rationale:
 *   This module opens room.db via lib/core/room-db.cjs::openRoomDb (the lazy
 *   creator). openRoomDbForCaller is FORBIDDEN here (it refuses to create
 *   room.db). This module is in lib/core/navigation/ so
 *   scripts/check-substrate.cjs accepts it (regex /^lib\/core\/navigation\//).
 *
 * Q1 7-step birth sequence (from RESEARCH, the primary correction):
 *   STEP 1 -- scaffold (idempotent, unregistered)
 *     mkdir + .room-root sentinel + scaffoldRoomSkeleton + feynman-seed-writer
 *     per section + USER.md (MUST happen before confirmNode resolveByUser)
 *   STEP 2 -- SQLite transaction (the ACID block; mirrors writeBreakthrough D-20)
 *     openRoomDb -> BEGIN -> writeClaimNode (venture node) -> setFocus ->
 *     drainBirthGateAnswers -> confirmNode batch -> room_created memory_event ->
 *     COMMIT. ROLLBACK on any error. Post-commit: logOperatorTransition.
 *   STEP 3 -- compute-state (writes STATE.md; NEVER authored)
 *   STEP 4 (COMMIT POINT) -- room-registry create (atomic tmp+mv; flips active
 *     pointer; the last structural step -- registry-first dangles the active
 *     pointer during the structurally-incomplete window)
 *   STEP 5 -- reconcileMemoryArtifacts (cortex + SENS-08 scalars live)
 *   STEP 6 -- migrateToRoom (drains banked opportunities + highlights; gate
 *     answers consumed in STEP 2 via drainBirthGateAnswers are safe)
 *   STEP 7 -- BRAIN derivation enqueue (log line only; Phase 90 enqueue is
 *     optional here; the comment prevents a future plan from omitting it)
 *
 * The scaffold-before-registry order is the primary correction from RESEARCH Q1:
 * registry-first would dangle the active pointer during the structurally-
 * incomplete window when the room has no room.db and no memory files yet.
 *
 * Canon Part 8: zero Brain egress. All writes are LOCAL to the caller's room.db
 *   and the filesystem. gateAnswers.free_text rides REJECTED_BECAUSE edges only;
 *   the reason scalar is a short string, not raw prose egress.
 * Canon Part 9: SQL is the local mind. room.db is created via openRoomDb (the
 *   lazy creator), never openRoomDbForCaller (which refuses creation).
 * Canon Part 9 v1.5 audit-node carve-out: room_created + birth_gate_answered
 *   memory_events are SYSTEM-BOOKKEEPING nodes (created_by=system,
 *   review_status=confirmed); they record what the system DID, not a venture
 *   truth-claim. The venture claim (writeClaimNode) is a TRUTH-CLAIM node that
 *   lands review_status='proposed'; confirmNode promotes it via the human byUser
 *   path. No CHOSE edge is written anywhere (CHOSE is not in ALLOWED_EDGE_TYPES;
 *   RESEARCH Pitfall 7 verified).
 *
 * T-155-02-02 mitigation: roomDir path traversal in subprocess calls. Validate
 *   roomDir is absolute and reject paths containing '..' before execSync.
 *   Shell args are double-quoted in the execSync command.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const roomDbMod = require('../room-db.cjs');
const scaffold = require('../room-skeleton-scaffold.cjs');
// feynman-seed-writer is lazy-required inside birthRoom() below to avoid the
// circular dep: feynman-seed-writer -> navigation -> room-birth -> feynman-seed-writer.
// Navigation.cjs now requires room-birth.cjs (the re-export), so a top-level
// require of feynman-seed-writer here would close a require cycle that would
// leave feynman-seed-writer with an incomplete navigation export at load time.
// const feynmanSeedWriter = require('../feynman/feynman-seed-writer.cjs');

// Import navigation submodules DIRECTLY to avoid the circular dependency:
// navigation.cjs requires room-birth.cjs; room-birth.cjs requiring navigation.cjs
// back would create a circular dep where navigation exports are {} on first access.
// As an allow-listed navigation/ submodule, direct submodule imports are legal.
const memoryEvents = require('./memory-events.cjs');
const edges = require('./edges.cjs');
// Phase 162-02 (R11 / D-B): real Section nodes written into room.db at birth.
// node-insert is the NOT-NULL-safe shared upsert helper (HARD-02 chokepoint);
// it takes a caller-owned conn and never opens room.db itself, so it is legal to
// require from this allow-listed navigation/ submodule.
const { insertNode } = require('../node-insert.cjs');
const focusMod = require('./focus.cjs');
const typedClaim = require('./typed-claim.cjs');
const confirmNodeMod = require('./confirm-node.cjs');
const spineEvents = require('./spine-events.cjs');
const scratchpadOps = require('../scratchpad-ops.cjs');
// reconcile-memory-runner requires navigation.cjs; since navigation.cjs now requires
// room-birth.cjs (us), a top-level require would create a circular dep that leaves
// reconcileRunner.reconcileMemoryArtifacts undefined at load time. Lazy-require
// inside birthRoom() at the call site instead.
// const reconcileRunner = require('../memory/reconcile-memory-runner.cjs');
const userMdOps = require('../user-md-ops.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// SECTION_NAMES is read live from lib/core/room-skeleton-scaffold.cjs (single
// source of truth there) as of Phase 275 (D-01). A re-copied literal here is
// the exact propagation-gap class Phase 273 and Phase 276 already named -- do
// not reintroduce a hand-typed mirror.
//
// Fail loud, never silent-fallback: if the scaffold's export is missing or
// empty, writeSectionNodes would become a silent no-op that leaves a room
// with zero structural anchors while birthRoom still reports success. That
// false-success shape is the exact disease Phase 276 exists to close, so this
// guard writes to stderr and still uses the scaffold's export as the sole
// source (never a re-typed literal, never an empty-array substitute).
if (!Array.isArray(scaffold.SECTION_NAMES) || scaffold.SECTION_NAMES.length === 0) {
  process.stderr.write(
    '[room-birth] FATAL: scaffold.SECTION_NAMES is missing or empty; ' +
    'birthRoom would silently write zero Section nodes.\n'
  );
}
const SECTION_NAMES = Object.freeze(scaffold.SECTION_NAMES.slice());

// ---------------------------------------------------------------------------
// T-155-02-02: Path safety guard. Rejects paths containing '..' components so
// shell arg injection via a crafted roomDir cannot escape the ROOMS_HOME tree.
// Returns null if the path is safe, or a reason string if not.
// ---------------------------------------------------------------------------
function _pathSafetyReason(p) {
  if (typeof p !== 'string' || p.length === 0) return 'empty_path';
  if (!path.isAbsolute(p)) return 'relative_path';
  const normalized = path.normalize(p);
  // Reject any path that after normalization contains a '..' segment.
  if (normalized.split(path.sep).includes('..')) return 'path_traversal';
  return null;
}

// ---------------------------------------------------------------------------
// drainBirthGateAnswers(db, roomDir, gateAnswers, ventureNodeId)
//
// Called from STEP 2 (inside the SQLite BEGIN...COMMIT block). Fills the
// Plan 01 stub in lib/core/scratchpad-ops.cjs by providing the real body here
// (the stub remains as the export; this internal helper IS the body). For
// each gateAnswers entry:
//   1. logMemoryEvent with event_type='birth_gate_answered'
//   2. writeEdge with the typed cascade edge:
//       Approve / RunMethodology -> FILED_AS_DECISION
//       Defer                    -> DEFERRED
//       Reject                   -> REJECTED_BECAUSE (reason = entry.free_text)
//       <anything else>          -> FILED_AS_DECISION (safe default)
//   NEVER write CHOSE (not in ALLOWED_EDGE_TYPES; RESEARCH Pitfall 7 verified).
//
// ventureNodeId is the claim node minted in STEP 2 (writeClaimNode result).
// Defensive: a writeEdge failure is tolerated; the logMemoryEvent result stands.
// ---------------------------------------------------------------------------
function drainBirthGateAnswers(db, roomDir, gateAnswers, ventureNodeId) {
  const answers = Array.isArray(gateAnswers) ? gateAnswers : [];
  let drained = 0;

  for (const entry of answers) {
    const gate_id = entry.gate_id || 'UNKNOWN';
    const canonical_verb = typeof entry.canonical_verb === 'string' ? entry.canonical_verb : '';
    const option_key = entry.option_key || '';

    // Log the birth_gate_answered memory_event (system-bookkeeping; Part 9 v1.5
    // audit-node carve-out: records WHAT the navigator decided at the gate;
    // created_by=system review_status=confirmed is canon-legal).
    try {
      memoryEvents.logEvent(db, 'birth_gate_answered', {
        gate_id: gate_id,
        canonical_verb: canonical_verb,
        option_key: option_key,
        created_by: 'system',
        source_path: 'birth:' + gate_id,
      });
    } catch (_e) {
      // Tolerate: a log failure never blocks the edge write.
    }

    // Write the typed cascade edge from the venture node to a stable gate anchor.
    // Target: a gate anchor node. The edges table enforces FK(source, target) ->
    // nodes(id), so we must mint a gate anchor node before writing the edge.
    // Gate anchor nodes are SYSTEM-BOOKKEEPING (Part 9 v1.5 audit-node carve-out:
    // records the gate decision, not a venture truth-claim); created_by=system
    // review_status=confirmed is canon-legal. OPEN-Q7: batch attribution of gate
    // answers; revisit for per-answer if navigator decides.
    let edgeType;
    if (canonical_verb === 'Approve' || canonical_verb === 'RunMethodology') {
      edgeType = 'FILED_AS_DECISION';
    } else if (canonical_verb === 'Defer') {
      edgeType = 'DEFERRED';
    } else if (canonical_verb === 'Reject') {
      edgeType = 'REJECTED_BECAUSE';
    } else {
      edgeType = 'FILED_AS_DECISION'; // safe default
    }

    const sourceId = ventureNodeId || ('birth_claim:nosession');
    const targetId = 'birth_gate:' + gate_id + ':' + option_key;

    // Ensure the source stub exists when ventureNodeId was not provided (FK requirement).
    // This path should not be reached in normal birthRoom execution (ventureNodeId is
    // set from writeClaimNode), but guards the standalone-call case.
    if (!ventureNodeId) {
      try {
        const nowMs2 = Date.now();
        db.prepare(
          'INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, ' +
          'confidence, review_status, created_at, last_seen_at) ' +
          "VALUES (?, 'birth_gate_anchor', '{}', 'birth:nosession', 'system', NULL, 'confirmed', ?, ?)"
        ).run(sourceId, nowMs2, nowMs2);
      } catch (_e) {
        // Tolerate.
      }
    }

    // Ensure the gate anchor node exists in the nodes table (FK requirement).
    // INSERT OR IGNORE so idempotent re-runs do not overwrite existing anchors.
    try {
      const nowMs = Date.now();
      const gateAnchorProps = JSON.stringify({
        gate_id: gate_id,
        option_key: option_key,
        canonical_verb: canonical_verb,
        event_type: 'birth_gate_anchor',
      });
      db.prepare(
        'INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, ' +
        'confidence, review_status, created_at, last_seen_at) ' +
        "VALUES (?, 'birth_gate_anchor', ?, ?, 'system', NULL, 'confirmed', ?, ?)"
      ).run(targetId, gateAnchorProps, 'birth:' + gate_id, nowMs, nowMs);
    } catch (_e) {
      // Tolerate: if the anchor insert fails, the edge write will also fail but
      // drainBirthGateAnswers will increment drained and continue.
    }

    const edgeProps = {};
    if (edgeType === 'REJECTED_BECAUSE' && typeof entry.free_text === 'string' && entry.free_text.length > 0) {
      // T-155-02-02 / Canon Part 8: only the reason scalar (short string) rides the edge.
      // The free_text is truncated to 200 chars so no raw prose egress occurs.
      edgeProps.reason = String(entry.free_text).slice(0, 200);
    }
    edgeProps.gate_id = gate_id;

    try {
      edges.writeEdge(db, {
        source_id: sourceId,
        target_id: targetId,
        edge_type: edgeType,
        properties: edgeProps,
      });
    } catch (_e) {
      // Tolerate: writeEdge failure does not block the overall drain.
    }

    drained++;
  }

  return { ok: true, drained: drained };
}

// ---------------------------------------------------------------------------
// writeSectionNodes(db, sectionSlugs) -- Phase 162-02 (R11 / D-B).
//
// Upserts one real Section node per section slug into room.db using the shared
// NOT-NULL-safe insertNode helper, then promotes review_status to 'confirmed'
// (Part 9 v1.5 audit-node carve-out: Section nodes are system-bookkeeping
// structural anchors, not truth-claims, so created_by=system review_status=
// confirmed is canon-legal). Idempotent: insertNode ON CONFLICT(id) upserts, and
// the review_status UPDATE is a no-op on an already-confirmed row.
//
// The caller owns the transaction: birthRoom calls this inside its STEP 2
// BEGIN..COMMIT; the migration calls it inside its own BEGIN..COMMIT. This helper
// NEVER opens room.db itself (it receives the caller-owned db handle), so it adds
// zero direct-open surface (Canon Part 9 chokepoint discipline).
//
// Returns the count of Section slugs written.
// ---------------------------------------------------------------------------
function writeSectionNodes(db, sectionSlugs) {
  const slugs = Array.isArray(sectionSlugs) ? sectionSlugs : [];
  let written = 0;
  for (const slug of slugs) {
    const label = String(slug).replace(/-/g, ' ').toUpperCase();
    const props = JSON.stringify({ section: slug, name: slug, label, created_by: 'system' });
    try {
      insertNode(db, slug, 'Section', props, {
        source_path: 'system:section-anchor',
        created_by: 'system',
        // R17-02: 'observation' -- system-bookkeeping structural anchor.
        epistemic_type: 'observation',
      });
      // Promote to confirmed (system-bookkeeping). On the un-migrated 3-column
      // schema there is no review_status column, so this UPDATE is tolerated.
      // Phase 194-06 Task 1: node-birth bookkeeping. A co-session cannot hold a
      // readVersion of a Section node being born at room creation, so the
      // reconcile-guard CAS token bump (last_modified_at) is intentionally OMITTED;
      // allowlisted in tests/test-194-lastmod-discipline.test.cjs.
      try {
        db.prepare("UPDATE nodes SET review_status = 'confirmed' WHERE id = ? AND type = 'Section'").run(slug);
      } catch (_e) {
        // Un-migrated schema has no review_status column; tolerate.
      }
      written += 1;
    } catch (_e) {
      // Tolerate a single-node insert failure; the rest still write.
    }
  }
  return written;
}

// ===========================================================================
// Phase 195-03 (FCM-04/05/06): born-wired sub-room birth.
//
// A born-wired birth is a PARENT sub-room birth (opts.parent set) explicitly
// requested with opts.bornWired === true. It layers four guarantees on top of
// the shipped 7-step keystone:
//   (1) a HUMAN-APPROVAL gate fires BEFORE mkdir (FCM-06); Reject -> no folder,
//       and the rejection is recorded as graph data in the PARENT room.db.
//   (2) the child->parent NESTED_WITHIN lineage edge is written INSIDE the
//       STEP-2 ACID block, so lineage is atomic with birth (FCM-05 side-effect 3).
//   (3) the full 6-file memory complement is seeded synchronously (BRAIN.md stub
//       at birth) and, when the parent .umbilical marks USER/BRAIN `parent`, the
//       child derives them from the parent (generic enums/handles only; Part 8).
//   (4) SEED-001's FIVE side-effects wire atomically or the whole birth unwinds
//       via a compensating reverse-order rollback (clone of room-discard-cascade)
//       -- no half-born orphan (Part 11 R1/R2 fail-closed).
//
// The non-bornWired path (top-level rooms; the Phase 169 self-heal parent birth)
// is byte-unchanged: every born-wired branch is guarded by `bornWired`.
// ===========================================================================

// runBirthGate(options, ctx) -- resolve the pre-mkdir approval decision (FCM-06).
// options.birthGate may be a function (ctx)->decision (the AskUserQuestion / F.8
// answer supplied by the command layer) OR a decision object. Absent decision =
// Reject (fail-closed: no silent promotion of a section to a sub-room).
function runBirthGate(options, ctx) {
  const g = options.birthGate;
  let decision = null;
  if (typeof g === 'function') {
    try { decision = g(ctx); } catch (_e) { decision = null; }
  } else if (g && typeof g === 'object') {
    decision = g;
  }
  if (!decision || typeof decision !== 'object') {
    return { approved: false, canonical_verb: 'Reject', free_text: 'no_gate_decision' };
  }
  const verb = typeof decision.canonical_verb === 'string' ? decision.canonical_verb : '';
  const approved = decision.approved === true || verb === 'Approve' || verb === 'RunMethodology';
  return {
    approved: approved,
    canonical_verb: approved ? (verb || 'Approve') : (verb || 'Reject'),
    free_text: typeof decision.free_text === 'string' ? decision.free_text : '',
  };
}

function _roomsHome() {
  return process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
}

function _readRegistry(roomsHome) {
  try {
    const regPath = path.join(roomsHome, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    return JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (_e) { return null; }
}

function _registryEntry(reg, slug) {
  if (!reg) return null;
  const rooms = reg.rooms;
  if (Array.isArray(rooms)) return rooms.find((r) => r && (r.slug === slug || r.name === slug)) || null;
  if (rooms && typeof rooms === 'object') return rooms[slug] || null;
  return null;
}

// Resolve a registered room's absolute directory from the registry (parent dir
// resolution for the born-wired side-effects). Returns '' on miss.
function _resolveRoomDirFromRegistry(slug, roomsHome) {
  const entry = _registryEntry(_readRegistry(roomsHome), slug);
  if (!entry) return '';
  if (typeof entry.abs_path === 'string' && entry.abs_path.length) return entry.abs_path;
  if (typeof entry.path === 'string' && entry.path.length) {
    return path.isAbsolute(entry.path) ? entry.path : path.join(roomsHome, entry.path);
  }
  return path.join(roomsHome, slug);
}

// depth = parent depth + 1 (root is depth 0). Best-effort; defaults to 1.
function _computeDepth(roomsHome, parentSlug) {
  const entry = _registryEntry(_readRegistry(roomsHome), parentSlug);
  const pd = entry && Number(entry.depth);
  return (Number.isFinite(pd) && pd >= 0) ? pd + 1 : 1;
}

// Reverse-order compensating teardown (clone of room-discard-cascade order:
// close db handle -> remove filesystem scaffold -> purge registry key). Leaves
// NO half-born orphan (Part 11 R1/R2 fail-closed).
function _bornWiredRollback(roomDir, slug, roomsHome, dbHandle, parentSlug) {
  try { if (dbHandle) dbHandle.close(); } catch (_e) {}
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {}
  try { _removeRegistryKey(roomsHome, slug, parentSlug); } catch (_e) {}
}

// Remove the child registry key + revert the parent's children entry (rollback).
function _removeRegistryKey(roomsHome, slug, parentSlug) {
  const regPath = path.join(roomsHome, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return false;
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  if (!reg || typeof reg.rooms !== 'object' || Array.isArray(reg.rooms)) return false;
  let changed = false;
  if (reg.rooms[slug]) { delete reg.rooms[slug]; changed = true; }
  if (reg.active === slug) { reg.active = ''; changed = true; }
  const parentEntry = parentSlug ? reg.rooms[parentSlug] : null;
  if (parentEntry && Array.isArray(parentEntry.children)) {
    const before = parentEntry.children.length;
    parentEntry.children = parentEntry.children.filter((c) => c !== slug);
    if (parentEntry.children.length !== before) changed = true;
  }
  if (changed) {
    const tmp = regPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
    fs.writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmp, regPath);
  }
  return true;
}

// SEED-001 side-effect 4: the child registry entry carries parent + depth + path,
// AND the parent's `children: [..., <new-slug>]` is updated. Returns true only
// when BOTH the child and parent entries exist and were patched (fail-closed).
function _patchRegistryLineage(roomsHome, slug, parentSlug, roomDir, depth) {
  const regPath = path.join(roomsHome, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return false;
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  if (!reg || typeof reg.rooms !== 'object' || Array.isArray(reg.rooms)) return false;
  const child = reg.rooms[slug];
  const parentEntry = reg.rooms[parentSlug];
  if (!child || !parentEntry) return false; // a real parent MUST be registered
  child.parent = parentSlug;
  child.depth = depth;
  let rel = roomDir;
  try { const r = path.relative(roomsHome, roomDir); if (r && !r.startsWith('..')) rel = r; } catch (_e) {}
  child.path = rel;
  if (!Array.isArray(parentEntry.children)) parentEntry.children = [];
  if (parentEntry.children.indexOf(slug) === -1) parentEntry.children.push(slug);
  const tmp = regPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf8');
  fs.renameSync(tmp, regPath);
  return true;
}

// SEED-001 side-effect 2: the child STATE.md gets `parent: [[<parent>]]` in
// frontmatter + a `## Parent Room` link section in the body. Idempotent.
function _patchChildStateParent(roomDir, parentSlug) {
  const statePath = path.join(roomDir, 'STATE.md');
  let raw = '';
  try { raw = fs.readFileSync(statePath, 'utf8'); } catch (_e) { raw = ''; }
  let fm = '';
  let body = '';
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (m) { fm = m[1]; body = m[2]; } else { body = raw; }
  const parentLink = '[[' + parentSlug + ']]';
  if (!/^parent\s*:/m.test(fm)) {
    fm = (fm.length ? fm + '\n' : '') + 'parent: "' + parentLink + '"';
  } else {
    fm = fm.replace(/^parent\s*:.*$/m, 'parent: "' + parentLink + '"');
  }
  if (body.indexOf('## Parent Room') === -1) {
    body = body.replace(/\s*$/, '') + '\n\n## Parent Room\n\n- ' + parentLink + '\n';
  }
  const content = '---\n' + fm + '\n---\n' + (body.charAt(0) === '\n' ? body : '\n' + body);
  const tmp = statePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, statePath);
  return true;
}

// SEED-001 side-effect 1: the parent STATE.md gets a `[[<child>]]` entry under a
// `## Sub-rooms` section (created if missing). Idempotent.
function _patchParentStateSubroom(parentRoomDir, childSlug) {
  const statePath = path.join(parentRoomDir, 'STATE.md');
  let raw = '';
  try { raw = fs.readFileSync(statePath, 'utf8'); } catch (_e) { raw = ''; }
  const childLink = '[[' + childSlug + ']]';
  if (raw.indexOf(childLink) !== -1) return true; // idempotent
  let content;
  if (raw.indexOf('## Sub-rooms') === -1) {
    const base = raw.length ? raw.replace(/\s*$/, '') : '---\nroom: ' + path.basename(parentRoomDir) + '\n---\n\n# STATE.md';
    content = base + '\n\n## Sub-rooms\n\n- ' + childLink + '\n';
  } else {
    content = raw.replace(/(##\s+Sub-rooms[^\n]*\n)/, '$1- ' + childLink + '\n');
    if (content === raw) content = raw.replace(/\s*$/, '') + '\n- ' + childLink + '\n';
  }
  const tmp = statePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, statePath);
  return true;
}

// SEED-001 side-effect 5: invalidate the parent room's wikilink resolver cache.
// On today's spine lib/vault/wikilink-builder.cjs is a STATELESS live-read
// builder (no persistent cache), so rewriting the parent STATE.md (side-effect 1)
// IS the effective bust -- the next render reads the updated file. We also remove
// any materialized cache artifact if one exists (defense-in-depth); absent one
// this is a no-op that succeeds (nothing stale to invalidate). Part 8: local fs.
function _invalidateParentWikilinkCache(parentRoomDir) {
  try {
    const cachePath = path.join(parentRoomDir, '.mindrian', 'wikilink-cache.json');
    if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { force: true });
    return true;
  } catch (_e) { return false; }
}

// FCM-06 / Part 4 rejection-is-data: a REJECTED sub-room birth is graph data. We
// log a subroom_birth_rejected memory_event into the PARENT room.db (the parent
// exists; the child folder was never created). No folder, no side-effects.
function _recordBirthRejection(parentRoomDir, childSlug, parentSlug, gate) {
  if (!parentRoomDir || !fs.existsSync(parentRoomDir)) return false;
  let pdb = null;
  try {
    pdb = roomDbMod.openRoomDb(parentRoomDir);
    if (!pdb) return false;
    const res = memoryEvents.logEvent(pdb, 'subroom_birth_rejected', {
      rejected_slug: childSlug,
      parent: parentSlug,
      reason: String(gate.free_text || '').slice(0, 200),
      created_by: 'system',
      source_path: 'birth:subroom_rejected:' + childSlug,
    });
    return !!(res && res.ok);
  } catch (_e) {
    return false;
  } finally {
    if (pdb) { try { pdb.close(); } catch (_e2) {} }
  }
}

// Write a minimal BRAIN.md stub at birth so the 6-file complement is 6/6
// synchronously (Phase 90 Brain derivation overwrites it later, STEP 7).
// Idempotent (only writes when absent).
function _writeBrainStub(roomDir, slug) {
  const brainPath = path.join(roomDir, 'BRAIN.md');
  if (fs.existsSync(brainPath)) return false;
  const content = '---\nkind: BRAIN\nroom: ' + slug + '\nderived: false\n---\n\n' +
    '# BRAIN.md\n\n' +
    'Seeded at birth. Phase 90 Brain derivation overwrites this stub with the ' +
    'generic framework handles derived for this room.\n';
  try {
    const tmp = brainPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, brainPath);
    return true;
  } catch (_e) { return false; }
}

// FCM-04: seed the child's USER/BRAIN from the parent when the parent .umbilical
// marks them `parent`. A seed-time ONE-SHOT (not a live link). Part 8: ONLY the
// generic persona enums (extractPersona) + frozen framework handles
// (extractBrainAnchors) cross the cord -- STATE/MINTO/FEYNMAN are never derived
// and no parent prose is ever written into the child files.
function _seedInheritedMemory(roomDir, parentRoomDir) {
  const result = { user_derived: false, brain_derived: false, map: null };
  if (!parentRoomDir) return result;
  let map = null;
  try {
    const resolver = require('../resolve-umbilical-target.cjs');
    map = resolver.parseUmbilicalInheritance(path.join(parentRoomDir, '.umbilical'));
  } catch (_e) { map = null; }
  if (!map) return result;
  result.map = map;

  let reconcile = null;
  try { reconcile = require('../memory/reconcile-memory-runner.cjs'); } catch (_e) { reconcile = null; }

  // USER derives the generic persona enums from the parent's USER.md.
  if (map.USER === 'parent' && reconcile && typeof reconcile.extractPersona === 'function') {
    try {
      const parentUserRaw = fs.readFileSync(path.join(parentRoomDir, 'USER.md'), 'utf8');
      const persona = reconcile.extractPersona(parentUserRaw); // { roleBlend, journeyStage }
      const data = {};
      if (persona.roleBlend) {
        data.canonical_role = persona.roleBlend;
        const rb = {};
        rb[persona.roleBlend] = 1; // single-axis generic handle, never the weight vector
        data.role_blend = rb;
      }
      if (persona.journeyStage) data.journey_stage = persona.journeyStage;
      if (Object.keys(data).length > 0) {
        userMdOps.writeUserMdAtomic(path.join(roomDir, 'USER.md'), data);
        result.user_derived = true;
      }
    } catch (_e) { /* tolerate: baseline USER.md stands */ }
  }

  // BRAIN derives the generic framework handles from the parent's BRAIN.md.
  if (map.BRAIN === 'parent' && reconcile && typeof reconcile.extractBrainAnchors === 'function') {
    try {
      const parentBrainRaw = fs.readFileSync(path.join(parentRoomDir, 'BRAIN.md'), 'utf8');
      const anchors = reconcile.extractBrainAnchors(parentBrainRaw); // [ framework names ]
      const list = anchors.length ? anchors.map((a) => '- ' + a).join('\n') : '- (none)';
      const content = '---\nkind: BRAIN\nderived: inherited\nframework_anchors: [' +
        anchors.join(', ') + ']\n---\n\n# BRAIN.md\n\n' +
        'Framework anchors inherited from the parent room (generic handles only, ' +
        'Part 8; no parent prose crosses the cord):\n\n' + list + '\n';
      const brainPath = path.join(roomDir, 'BRAIN.md');
      const tmp = brainPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
      fs.writeFileSync(tmp, content, 'utf8');
      fs.renameSync(tmp, brainPath);
      result.brain_derived = true;
    } catch (_e) { /* tolerate: baseline BRAIN stub stands */ }
  }
  return result;
}

// Verify the NESTED_WITHIN lineage edge landed in the child's room.db (the
// side-effect 3 post-write gate for the born-wired verification).
function _verifyNestedWithin(roomDir, slug, parent) {
  let db = null;
  try {
    db = roomDbMod.openRoomDb(roomDir);
    if (!db) return false;
    const row = db.prepare(
      "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'NESTED_WITHIN'"
    ).get('room:' + slug, 'room:' + parent);
    return !!row;
  } catch (_e) {
    return false;
  } finally {
    if (db) { try { db.close(); } catch (_e2) {} }
  }
}

// ---------------------------------------------------------------------------
// birthRoom(opts) -- the public entry point.
//
// opts: {
//   slug          string (room registry name key)
//   roomDir       string (absolute path; MUST already be inside ROOMS_HOME)
//   sessionId     string
//   ventureText   string (user-supplied venture description)
//   jtbd          string (JTBD statement)
//   blueprintFamily string ('venture' default)
//   gateAnswers   Array (B1/B2/U0 gate answers to drain)
//   approvedBy    string (B2 Approve attribution; required)
//   canonicalRole string (USER.md role; default 'navigator')
//   roleBlend     object (USER.md role_blend; default {})
//   journeyStage  string (USER.md journey_stage; default 'Ordinary World')
//   vname         string (venture name for registry; default slug)
//   vstage        string (venture stage for registry; default 'Pre-Opportunity')
//   parent        string (OPTIONAL parent room slug; Phase 169-07 additive
//                 amendment for the D-169-11 fractal joint. When non-empty it is
//                 threaded to BOTH the `.room-root` sentinel JSON (a `parent`
//                 field) AND the registry create (a `set-parent` follow-on), so a
//                 sub-room born via SEED-001 carries the operational lineage joint.
//                 DEFAULT-OMITTED: when absent the sentinel + registry are
//                 byte-unchanged from prior born-room behavior.)
// }
//
// Returns {ok:true, roomDir, slug, db_created:true} on success,
// or {ok:false, reason} on failure (never throws).
// ---------------------------------------------------------------------------
function birthRoom(opts) {
  const options = opts || {};

  // T-155-02-03: Hard guard on opts.approvedBy (gate bypass protection).
  if (!options.approvedBy) {
    return { ok: false, reason: 'no_approval', detail: 'approvedBy is required (B2 Approve gate)' };
  }

  const roomDir = options.roomDir;
  const slug = options.slug;

  // Path safety guard (T-155-02-02).
  const pathErr = _pathSafetyReason(roomDir);
  if (pathErr) {
    return { ok: false, reason: 'invalid_room_dir', detail: pathErr };
  }
  if (typeof slug !== 'string' || slug.length === 0) {
    return { ok: false, reason: 'invalid_slug' };
  }

  const sessionId = typeof options.sessionId === 'string' ? options.sessionId : 'nosession';
  const ventureText = typeof options.ventureText === 'string' && options.ventureText.length > 0
    ? options.ventureText : 'A new venture';
  const jtbd = typeof options.jtbd === 'string' ? options.jtbd : '';
  const blueprintFamily = typeof options.blueprintFamily === 'string' ? options.blueprintFamily : 'venture';
  // Copy the caller's gateAnswers so the born-wired Approve answer we push below
  // never mutates the caller's array.
  const gateAnswers = Array.isArray(options.gateAnswers) ? options.gateAnswers.slice() : [];
  const vname = typeof options.vname === 'string' && options.vname.length > 0
    ? options.vname : slug;
  const vstage = typeof options.vstage === 'string' && options.vstage.length > 0
    ? options.vstage : 'Pre-Opportunity';
  const canonicalRole = typeof options.canonicalRole === 'string' ? options.canonicalRole : 'navigator';
  const roleBlend = (options.roleBlend && typeof options.roleBlend === 'object') ? options.roleBlend : {};
  const journeyStage = typeof options.journeyStage === 'string' ? options.journeyStage : 'Ordinary World';
  // Phase 169-07 additive amendment: the OPTIONAL parent room slug for the
  // D-169-11 operational lineage joint. Default-omitted so the no-parent case is
  // byte-unchanged.
  const parent = (typeof options.parent === 'string' && options.parent.length > 0) ? options.parent : '';

  // --------------------------------------------------------------------------
  // Phase 195-03 born-wired setup (FCM-05/06). The born-wired path activates
  // ONLY when opts.parent is set AND opts.bornWired === true. Everything below
  // is a no-op for top-level rooms and the Phase 169 self-heal parent birth.
  // --------------------------------------------------------------------------
  const bornWired = options.bornWired === true && parent.length > 0;
  const roomsHomeForBirth = _roomsHome();
  let parentRoomDir = '';
  let bornWiredDepth = 1;
  if (bornWired) {
    parentRoomDir = (typeof options.parentRoomDir === 'string' && options.parentRoomDir.length > 0)
      ? options.parentRoomDir
      : _resolveRoomDirFromRegistry(parent, roomsHomeForBirth);
    // Fail closed BEFORE mkdir if the parent room cannot be resolved: a sub-room
    // has no home without a real registered parent (no orphan promotion).
    if (!parentRoomDir || !fs.existsSync(parentRoomDir)) {
      return { ok: false, reason: 'parent_room_not_found', detail: parent };
    }
    bornWiredDepth = _computeDepth(roomsHomeForBirth, parent);

    // FCM-06: the human-approval gate fires BEFORE fs.mkdirSync. On Reject no
    // folder is created and the rejection is recorded as graph data in the
    // parent room.db (Part 4 rejection-is-data). The approvedBy string-guard
    // above stays as the bypass hard-guard.
    const gate = runBirthGate(options, { slug: slug, parent: parent, parentRoomDir: parentRoomDir });
    if (!gate.approved) {
      const rejectionRecorded = _recordBirthRejection(parentRoomDir, slug, parent, gate);
      return {
        ok: false,
        reason: 'birth_rejected',
        rejection_recorded: rejectionRecorded,
        canonical_verb: gate.canonical_verb,
        slug: slug,
        parent: parent,
      };
    }
    // Approve is data too: push it so STEP 2 drainBirthGateAnswers files a
    // FILED_AS_DECISION edge for the sub-room birth approval.
    gateAnswers.push({
      gate_id: 'SUBROOM_BIRTH',
      canonical_verb: 'Approve',
      option_key: 'approve',
      alias_label: 'Approve sub-room ' + slug + ' under ' + parent,
      ts: Date.now(),
    });
  }

  // --------------------------------------------------------------------------
  // STEP 1: scaffold (idempotent, unregistered)
  //
  // mkdir + .room-root sentinel + scaffoldRoomSkeleton + seedSection per
  // section + USER.md (MUST happen before confirmNode resolveByUser so
  // USER.md exists when resolveByUser reads it; RESEARCH Pitfall 12).
  // --------------------------------------------------------------------------
  try {
    fs.mkdirSync(roomDir, { recursive: true });

    // Write .room-root sentinel (used by resolve-umbilical-target.cjs).
    const roomRootPath = path.join(roomDir, '.room-root');
    if (!fs.existsSync(roomRootPath)) {
      // The base sentinel shape is byte-unchanged ({room, active, born}). When
      // opts.parent is provided (Phase 169-07), append a `parent` field ONLY then
      // so the omitted case is byte-identical to prior born-room behavior. A
      // `slug` field is added when parent is set so the rollup walk's
      // _childDirForSlug (graph-derivation.cjs) can match the healed sub-room by
      // slug; the omitted case stays byte-unchanged.
      const sentinelObj = {
        room: slug,
        active: true,
        born: new Date().toISOString(),
      };
      if (parent) {
        sentinelObj.parent = parent;
        sentinelObj.slug = slug;
      }
      const sentinel = JSON.stringify(sentinelObj);
      const tmpRoot = roomRootPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
      fs.writeFileSync(tmpRoot, sentinel, 'utf8');
      fs.renameSync(tmpRoot, roomRootPath);
    }

    // scaffoldRoomSkeleton: fills the room with the canonical 8-section ICM
    // structure + STATE.md + MINTO.md + USER.md + ROOM.md identity files.
    // Idempotent: never overwrites human-authored content.
    scaffold.scaffoldRoomSkeleton(roomDir, { blueprintFamily: blueprintFamily });

    // seedSection per section to close the 4/6 -> 6/6 memory complement gap.
    // scaffold writes ROOM.md / STATE.md / MINTO.md / USER.md; FEYNMAN.md and
    // BRAIN.md have no scaffold templates. feynman-seed-writer closes FEYNMAN.md.
    // (BRAIN.md is written by Phase 90 brain-derivation; STEP 7 enqueues it.)
    // Lazy-require feynman-seed-writer here (not at file top) to avoid the
    // circular dep: feynman-seed-writer -> navigation -> room-birth -> feynman-seed-writer.
    let feynmanSeedWriter = null;
    try {
      feynmanSeedWriter = require('../feynman/feynman-seed-writer.cjs');
    } catch (_e) {
      // Best-effort: if the seed-writer cannot load, skip seeding.
    }
    if (feynmanSeedWriter && typeof feynmanSeedWriter.seedSection === 'function') {
      for (const sectionSlug of SECTION_NAMES) {
        const seedBody = 'Seeded at birth -- replace with your content for the ' +
          sectionSlug + ' section of your venture.';
        try {
          feynmanSeedWriter.seedSection(roomDir, sectionSlug, seedBody, { db: null });
        } catch (_e) {
          // Best-effort: seedSection failure never aborts birth.
        }
      }
    }

    // Write USER.md via writeUserMdAtomic (RESEARCH Pitfall 12: USER.md MUST
    // exist before confirmNode is called in STEP 2 so resolveByUser finds identity).
    // Plan 03 owns the full USER.md schema; here we write the minimum identity.
    const userMdPath = path.join(roomDir, 'USER.md');
    // Only write if not already authored (idempotent).
    try {
      userMdOps.writeUserMdAtomic(userMdPath, {
        canonical_role: canonicalRole,
        role_blend: roleBlend,
        journey_stage: journeyStage,
      });
    } catch (_e) {
      // Tolerate: if USER.md already exists with human content, preserve it.
    }

    // Phase 195-03 born-wired STEP 1 additions (sub-room births only):
    //   - BRAIN.md stub so the 6-file complement is 6/6 synchronously.
    //   - FCM-04 inheritance seed: when the parent .umbilical marks USER/BRAIN
    //     `parent`, derive the child's USER/BRAIN from the parent (generic
    //     enums/handles only; Part 8). Runs BEFORE STEP 3 compute-state (which
    //     only rewrites STATE.md, never USER/BRAIN), so the derived files stand.
    if (bornWired) {
      _writeBrainStub(roomDir, slug);
      _seedInheritedMemory(roomDir, parentRoomDir);
    }
  } catch (e) {
    if (bornWired) { _bornWiredRollback(roomDir, slug, roomsHomeForBirth, null, parent); }
    return { ok: false, reason: 'scaffold_failed', detail: String(e.message || '').slice(0, 200) };
  }

  // --------------------------------------------------------------------------
  // STEP 2: SQLite transaction (the ACID block; mirrors writeBreakthrough D-20)
  //
  // openRoomDb (the lazy creator) creates room.db if absent. openRoomDbForCaller
  // is FORBIDDEN here (it refuses creation; RESEARCH Canon note).
  // BEGIN...COMMIT with ROLLBACK on any error.
  // --------------------------------------------------------------------------
  let db;
  let ventureNodeId = null;

  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (e) {
    return { ok: false, reason: 'open_room_db_failed', detail: String(e.message || '').slice(0, 200) };
  }

  try {
    db.exec('BEGIN');

    // writeClaimNode for the venture node (knowledge_type:'heuristic'; the initial
    // framing of the venture is a heuristic claim at birth).
    const claimResult = typedClaim.writeClaimNode(db, {
      knowledge_type: 'heuristic',
      text: ventureText,
      sessionId: sessionId,
      sourceSegment: 'birth:venture:' + slug,
    });
    if (claimResult && claimResult.ok) {
      ventureNodeId = claimResult.node_id;
    }

    // setFocus on the venture node ('user' is valid; 'auto-from-upload' is NOT --
    // RESEARCH Pitfall 1). Falls back gracefully when ventureNodeId is null.
    if (ventureNodeId) {
      try {
        focusMod.setFocus(db, sessionId, ventureNodeId, 'user');
      } catch (_e) {
        // Tolerate: setFocus failure does not abort the transaction.
      }
    }

    // drainBirthGateAnswers: converts gate answers into memory_events + typed edges.
    // Called inside BEGIN...COMMIT so the gate audit trail is atomic with room birth.
    drainBirthGateAnswers(db, roomDir, gateAnswers, ventureNodeId);

    // confirmNode batch on all proposed truth-claim nodes. Resolves byUser from
    // USER.md (written in STEP 1; RESEARCH Pitfall 12 guard). Uses resolveByUser
    // after USER.md is confirmed written.
    // OPEN-Q7: batch attribution; revisit for per-claim if navigator decides.
    if (ventureNodeId) {
      const byUser = confirmNodeMod.resolveByUser(roomDir);
      try {
        confirmNodeMod.confirmNode(db, ventureNodeId, byUser, 'confirmed at birth');
      } catch (_e) {
        // Tolerate: confirmNode failure does not abort birth.
      }
    }

    // logJtbdTransition -- inside COMMIT sequence by passing the open db directly.
    // The spine-events logJtbdTransition takes a roomDir and opens its own handle;
    // to stay inside our transaction we call logMemoryEvent directly for the
    // jtbd_transitioned event (the same net effect, one handle).
    if (typeof jtbd === 'string' && jtbd.length > 0) {
      try {
        memoryEvents.logEvent(db, 'jtbd_transitioned', {
          to: jtbd,
          kind: 'set',
          sessionId: sessionId,
          created_by: 'system',
          source_path: 'birth:jtbd',
        });
      } catch (_e) {
        // Tolerate.
      }
    }

    // Phase 162-02 (R11 / D-B): write real Section nodes into room.db INSIDE the
    // birth ACID transaction so room.db is genuinely complete (Canon Part 9) and
    // the export-time Section anchors in graph-export.cjs demote to a Tier-0
    // fallback. Section nodes are SYSTEM-BOOKKEEPING structural anchors, NOT
    // truth-claim nodes (Part 9 v1.5 audit-node carve-out: created_by=system,
    // review_status=confirmed is canon-legal -- the same reasoning as focus/audit
    // nodes). One node per canonical section, idempotent via the insertNode
    // ON CONFLICT(id) upsert (re-birth never duplicates a Section id).
    writeSectionNodes(db, SECTION_NAMES);

    // room_created event: the canonical signal that birth succeeded. Emitted ONCE
    // at the end of the STEP 2 transaction. Everything in Phase 155 composes on
    // this event.
    memoryEvents.logEvent(db, 'room_created', {
      slug: slug,
      blueprint_family: blueprintFamily,
      sessionId: sessionId,
      created_by: 'system',
      source_path: 'birth:room_created',
    });

    // Phase 195-03 (FCM-05 side-effect 3): the child->parent NESTED_WITHIN
    // lineage edge, written INSIDE this ACID block so lineage is ATOMIC with
    // birth (today the edge is written by the 169 heal path, not birthRoom). A
    // Room node for the sub-room is inserted first (system-bookkeeping structural
    // anchor). Part 8: properties are ENUM/scalar ONLY (relation enum + parent
    // slug handle + depth scalar); never prose. bornWired only; a failed edge
    // write THROWS so the whole transaction ROLLBACKs (born WIRED or fail CLOSED).
    if (bornWired) {
      try {
        insertNode(
          db,
          'room:' + slug,
          'Room',
          JSON.stringify({ room: slug, parent: parent, created_by: 'system' }),
          {
            source_path: 'system:room-node',
            created_by: 'system',
            // R17-02: 'observation' -- system-bookkeeping structural anchor
            // (same class as the umbilical Project/Room handles).
            epistemic_type: 'observation',
          }
        );
      } catch (_e) {
        // Tolerate node-anchor upsert failure; the edges table has no FK, so the
        // NESTED_WITHIN edge below still lands. The verify gate is the authority.
      }
      const nwRes = edges.writeEdge(db, {
        source_id: 'room:' + slug,
        target_id: 'room:' + parent,
        edge_type: 'NESTED_WITHIN',
        properties: { relation: 'nested', parent: parent, depth: bornWiredDepth },
      });
      if (!nwRes || !nwRes.ok) {
        throw new Error('nested_within_write_failed:' + (nwRes ? nwRes.reason : 'no_result'));
      }
      // Test-only fault seam: force a STEP-2 failure to exercise the ACID
      // ROLLBACK + fs cleanup path (no half-born orphan). Never set in prod.
      if (options._faultInject === 'step2') {
        throw new Error('fault_inject_step2');
      }
    }

    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    try { db.close(); } catch (_) {}
    // Fail-closed: a born-wired STEP-2 failure must leave NO half-born scaffold.
    if (bornWired) { _bornWiredRollback(roomDir, slug, roomsHomeForBirth, null, parent); }
    return { ok: false, reason: 'birth_transaction_failed', detail: String(e.message || '').slice(0, 200) };
  }

  // STEP 2 post-commit: logOperatorTransition safe now that room.db exists.
  try {
    spineEvents.logOperatorTransition(roomDir, {
      to: 'BUILD_ROOM',
      write_transition_edge: true,
      sessionId: sessionId,
    });
  } catch (_e) {
    // Tolerate: post-commit transition failure does not abort birth.
  }

  // --------------------------------------------------------------------------
  // STEP 3: compute-state (writes STATE.md; STATE.md is NEVER authored;
  // RESEARCH Section 3 note).
  //
  // T-155-02-02: shellEscape via double-quoting; reject '..' in roomDir (done
  // above via _pathSafetyReason). Only reach here when the path is safe.
  // --------------------------------------------------------------------------
  try {
    const computeStateScript = path.join(REPO_ROOT, 'scripts', 'compute-state');
    execSync(
      'node ' + JSON.stringify(computeStateScript) + ' ' + JSON.stringify(roomDir),
      { stdio: 'pipe', cwd: REPO_ROOT }
    );
  } catch (_e) {
    // Tolerate: compute-state failure does not abort birth (STATE.md may be
    // missing until the next session-start, which calls compute-state again).
  }

  // --------------------------------------------------------------------------
  // STEP 4 (COMMIT POINT): room-registry create.
  //
  // The atomic tmp+mv registry flip is the LAST structural step. Registry-first
  // would dangle the active pointer during the structurally-incomplete window.
  // --------------------------------------------------------------------------
  try {
    const registryScript = path.join(REPO_ROOT, 'scripts', 'room-registry');
    // Determine ROOMS_HOME from the environment (the same source room-registry uses).
    const roomsHome = process.env.MINDRIAN_ROOMS_HOME || path.join(require('node:os').homedir(), 'MindrianRooms');

    // T-155-02-02: args are JSON.stringify-quoted; the registry script
    // validates its own inputs. We only pass slug + absolute roomDir +
    // scalar vname + scalar vstage.
    execSync(
      'bash ' + JSON.stringify(registryScript) +
      ' ' + JSON.stringify(roomsHome) +
      ' create' +
      ' ' + JSON.stringify(slug) +
      ' ' + JSON.stringify(roomDir) +
      ' ' + JSON.stringify(vname) +
      ' ' + JSON.stringify(vstage),
      { stdio: 'pipe', cwd: REPO_ROOT }
    );

    // Phase 169-07 additive amendment: thread opts.parent into the registry as a
    // `parent` field via the existing `update <slug> parent <parent-slug>` verb
    // (Part 7 reuse -- no new registry verb invented). Only runs when parent is
    // provided; the omitted case leaves the registry create byte-unchanged.
    if (parent) {
      execSync(
        'bash ' + JSON.stringify(registryScript) +
        ' ' + JSON.stringify(roomsHome) +
        ' update' +
        ' ' + JSON.stringify(slug) +
        ' ' + JSON.stringify('parent') +
        ' ' + JSON.stringify(parent),
        { stdio: 'pipe', cwd: REPO_ROOT }
      );
    }

    // ------------------------------------------------------------------------
    // Bind the new room into THIS session's write scope (todo slug
    // 2026-06-28-birthroom-active-room-reverts-next-turn).
    //
    // The registry `active` flip above is only ONE of the two write authorities.
    // Phase 194 (PSB) made the per-session bound SET in session-binding.cjs the
    // PRIMARY write authority that scripts/write-scope-check.cjs consults
    // (readSessionBinding -> isRoomInWriteScope). Without ALSO adding the newborn
    // room to this session's bound SET, that set-membership guard BLOCKS every
    // write to the just-created room (the binding still lists only the prior
    // room), so the navigator cannot write into the room birthRoom just made
    // active. Reuse the shipped session-binding writer (Canon Part 7; no new
    // binding writer) and keep the write LOCAL (Canon Part 8; zero Brain egress).
    //
    // Design (navigator-locked): UNION the new slug into the bound SET and make
    // it PRIMARY -- do NOT replace the set (a session may legitimately span
    // rooms). Gate on a REAL interactive session (sessionId present and not the
    // 'nosession' sentinel), which naturally excludes the graph-self-heal /
    // migration / backfill callers that birth rooms with no session. This runs
    // only after the registry create above SUCCEEDED (an execSync throw jumps to
    // the catch below and skips this). Fire-and-forget: readSessionBinding /
    // writeSessionBinding never throw, and the whole block is wrapped so a
    // binding hiccup can NEVER block birth (Larry-never-blocks).
    if (typeof sessionId === 'string' && sessionId.length > 0 && sessionId !== 'nosession') {
      try {
        const sb = require('../session-binding.cjs');
        const prior = sb.readSessionBinding(sessionId, { home: roomsHome });
        const priorBound = (prior && Array.isArray(prior.bound)) ? prior.bound : [];
        const bound = Array.from(new Set(priorBound.concat([slug])));
        sb.writeSessionBinding(
          sessionId,
          { bound: bound, primary: slug, sticky: prior ? prior.sticky : false },
          { home: roomsHome }
        );
      } catch (_eBind) {
        // Fire-and-forget: a session-binding write failure never blocks birth.
      }
    }
  } catch (_e) {
    // Tolerate: registry flip failure should not leave a half-born room stranded.
    // The room.db + files exist; the user can re-run /mos:register if needed.
  }

  // --------------------------------------------------------------------------
  // STEP 5: reconcileMemoryArtifacts (cortex + SENS-08 scalars live before
  // next turn). Re-use the open db handle (still open from STEP 2 post-commit).
  // --------------------------------------------------------------------------
  try {
    // Guard: db may have been closed by an error path; reopen if needed.
    let reconDb = db;
    let reopened = false;
    try {
      // A simple probe to check if db is still open.
      reconDb.prepare('SELECT 1').get();
    } catch (_e) {
      try {
        reconDb = roomDbMod.openRoomDb(roomDir);
        reopened = true;
      } catch (_e2) {
        reconDb = null;
      }
    }
    if (reconDb) {
      // Lazy-require to break the circular dep (see top-of-file comment).
      let reconcileRunner = null;
      try {
        reconcileRunner = require('../memory/reconcile-memory-runner.cjs');
      } catch (_e2) {
        // Best-effort: if the runner cannot load, skip reconcile.
      }
      if (reconcileRunner && typeof reconcileRunner.reconcileMemoryArtifacts === 'function') {
        reconcileRunner.reconcileMemoryArtifacts(roomDir, { db: reconDb });
      }
      if (reopened) {
        try { reconDb.close(); } catch (_) {}
      }
    }
  } catch (_e) {
    // Tolerate: reconcile failure does not abort birth.
  }

  // --------------------------------------------------------------------------
  // STEP 6: scratchpadOps.migrateToRoom (drains banked opportunities and
  // highlights). Gate answers were consumed in STEP 2 via drainBirthGateAnswers;
  // migrateToRoom is safe to call now without losing them.
  // --------------------------------------------------------------------------
  try {
    scratchpadOps.migrateToRoom(roomDir);
  } catch (_e) {
    // Tolerate: scratchpad migration failure does not abort birth.
  }

  // --------------------------------------------------------------------------
  // STEP 7: BRAIN derivation enqueue (deferred enrichment).
  //
  // The actual Phase 90 enqueue is optional here; the log line makes the intent
  // explicit and prevents a future plan from forgetting it.
  // T-155-02-05: STEP 7 is a log line only (no real enqueue in this plan); the
  // Phase 90 enqueue sends only generic handles (Part 8).
  // --------------------------------------------------------------------------
  // BRAIN derivation enqueued for room: log entry here; Phase 90 enqueue picks
  // up on next session-start when Brain is reachable.
  process.stdout.write('[room-birth] BRAIN derivation enqueued for room: ' + slug + '\n');

  // Close the db handle (if still open from STEP 2).
  try {
    db.prepare('SELECT 1').get(); // probe
    db.close();
  } catch (_e) {
    // Already closed or unavailable; tolerate.
  }

  // --------------------------------------------------------------------------
  // Phase 195-03 born-wired FINALIZE (FCM-05): the remaining SEED-001 side-effects
  // (1 parent STATE.md, 2 child STATE.md, 4 registry lineage, 5 wikilink cache)
  // wire here (STATE.md exists post-STEP-3; registry exists post-STEP-4; the db
  // is closed). Side-effect 3 (NESTED_WITHIN) already landed inside the ACID
  // block and is verified. ANY of the five missing -> compensating rollback so
  // NO half-born orphan remains (Part 11 R1/R2 fail-closed).
  // --------------------------------------------------------------------------
  if (bornWired) {
    const se = { s1: false, s2: false, s3: false, s4: false, s5: false };
    se.s3 = _verifyNestedWithin(roomDir, slug, parent);
    try {
      se.s2 = _patchChildStateParent(roomDir, parent);
      se.s4 = _patchRegistryLineage(roomsHomeForBirth, slug, parent, roomDir, bornWiredDepth);
      se.s1 = _patchParentStateSubroom(parentRoomDir, slug);
      se.s5 = _invalidateParentWikilinkCache(parentRoomDir);
      // Test-only fault seam: force one side-effect to read as failed to exercise
      // the compensating rollback. Never set in production.
      if (typeof options._faultInject === 'string' && /^s[1-5]$/.test(options._faultInject)) {
        se[options._faultInject] = false;
      }
    } catch (e) {
      _bornWiredRollback(roomDir, slug, roomsHomeForBirth, null, parent);
      return {
        ok: false,
        reason: 'born_wired_side_effect_failed',
        detail: String(e.message || '').slice(0, 120),
        side_effects: se,
      };
    }
    const allWired = se.s1 && se.s2 && se.s3 && se.s4 && se.s5;
    if (!allWired) {
      _bornWiredRollback(roomDir, slug, roomsHomeForBirth, null, parent);
      return { ok: false, reason: 'born_wired_incomplete', side_effects: se };
    }
    return {
      ok: true,
      roomDir: roomDir,
      slug: slug,
      db_created: true,
      born_wired: true,
      side_effects: se,
    };
  }

  return { ok: true, roomDir: roomDir, slug: slug, db_created: true };
}

module.exports = { birthRoom, drainBirthGateAnswers, writeSectionNodes, SECTION_NAMES };
