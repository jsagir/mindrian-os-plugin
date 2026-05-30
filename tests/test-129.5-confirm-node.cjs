'use strict';
// Phase 129.5-02 -- confirmNode chokepoint + human-attribution guard + USER.md
// identity resolver behavior suite (RED-first).
//
// This suite is written BEFORE the implementation lands (the TDD RED gate). It
// covers three surfaces:
//   1. The AGENT-IDENTITY GUARD on promoteNodeStatus + confirmNode (D-02): no
//      agent (larry / brain / system / assistant) may confirm or validate a
//      truth-claim node. The guard fires before any mutation. Audit nodes
//      (system-bookkeeping) are EXEMPT per the Canon Part 9 v1.5 carve-out.
//   2. confirmNode(db, id, byUser, reason?) (D-01): the single APPROVE to promote
//      door. It resolves the node's current review_status and delegates to
//      promoteNodeStatus, so callers never need to know the from-state.
//   3. resolveByUser(roomDir) (D-02): maps the active room's USER.md navigator
//      identity to a non-agent byUser, defaulting to 'navigator', never an agent.
//
// Hermetic via tmpdir per fixture; uses the canonical openRoomDb chokepoint so
// every node lands in the Phase-109 provenance schema.
//
// Canon Part 8 / Part 9: all room.db access is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const transitions = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'transitions.cjs'));
const confirmNodeMod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'confirm-node.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const { promoteNodeStatus } = transitions;
const { confirmNode, resolveByUser } = confirmNodeMod;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129.5-confirm-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Seed a node of an arbitrary type + review_status. FK-safe: nodes are the FK
// target for edges, so every referenced node is inserted before use.
function seedNode(db, id, type, reviewStatus) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'fixture', 'larry', NULL, ?, ?, ?)"
  ).run(id, type, reviewStatus, nowMs, nowMs);
}

function reviewStatusOf(db, id) {
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  return row ? row.review_status : null;
}

function confirmedByOf(db, id) {
  const row = db.prepare('SELECT confirmed_by FROM nodes WHERE id = ?').get(id);
  return row ? row.confirmed_by : null;
}

// Collect the confirmed_by attribution carried in the status_promoted memory_event
// payload(s) for a target node. The audit row's created_by COLUMN is constrained
// to {user, larry, import, brain, system}, so the LITERAL human identity rides in
// the unconstrained payload confirmed_by field.
function promotedEventConfirmedBy(db, targetNodeId) {
  const rows = db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event'"
  ).all();
  const hits = [];
  for (const r of rows) {
    let p;
    try { p = JSON.parse(r.properties); } catch (_) { continue; }
    if (p && p.event_type === 'status_promoted' && p.target_node_id === targetNodeId) {
      hits.push(p.confirmed_by);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const results = [];
function test(name, fn) {
  const { tmp, db } = makeRoom();
  try {
    fn(db, tmp);
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err: err && err.message ? err.message : String(err) });
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
}

// ===========================================================================
// AGENT-IDENTITY GUARD (promoteNodeStatus + confirmNode)
// ===========================================================================

test('AGENT_IDENTITIES is exactly {larry, brain, system, assistant} (lowercased)', () => {
  ok(transitions.AGENT_IDENTITIES instanceof Set, 'AGENT_IDENTITIES must be a Set');
  const members = Array.from(transitions.AGENT_IDENTITIES).sort();
  deepEqual(members, ['assistant', 'brain', 'larry', 'system'], 'closed lowercased set');
});

test('promoteNodeStatus rejects byUser=larry on proposed->confirmed of a truth-claim node; review_status unchanged', (db) => {
  seedNode(db, 'claim:1', 'claim', 'proposed');
  const res = promoteNodeStatus(db, 'claim:1', 'proposed', 'confirmed', 'larry');
  equal(res.ok, false, 'must reject');
  equal(res.reason, 'agent_attribution_forbidden', 'reason');
  equal(reviewStatusOf(db, 'claim:1'), 'proposed', 'review_status NOT mutated');
});

test('promoteNodeStatus rejects brain / system / assistant on confirm of truth-claim node', (db) => {
  for (const agent of ['brain', 'system', 'assistant']) {
    const id = 'claim:' + agent;
    seedNode(db, id, 'claim', 'proposed');
    const res = promoteNodeStatus(db, id, 'proposed', 'confirmed', agent);
    equal(res.ok, false, 'reject ' + agent);
    equal(res.reason, 'agent_attribution_forbidden', 'reason ' + agent);
    equal(reviewStatusOf(db, id), 'proposed', 'unmutated ' + agent);
  }
});

test('agent guard is case-insensitive (SYSTEM, Larry)', (db) => {
  seedNode(db, 'claim:upper1', 'claim', 'proposed');
  let res = promoteNodeStatus(db, 'claim:upper1', 'proposed', 'confirmed', 'SYSTEM');
  equal(res.reason, 'agent_attribution_forbidden', 'SYSTEM rejected');
  seedNode(db, 'claim:upper2', 'claim', 'proposed');
  res = promoteNodeStatus(db, 'claim:upper2', 'proposed', 'confirmed', 'Larry');
  equal(res.reason, 'agent_attribution_forbidden', 'Larry rejected');
});

test('agent guard fires on the validate family (confirmed->validated, needs_evidence->validated)', (db) => {
  seedNode(db, 'claim:v1', 'claim', 'confirmed');
  let res = promoteNodeStatus(db, 'claim:v1', 'confirmed', 'validated', 'brain');
  equal(res.reason, 'agent_attribution_forbidden', 'confirmed->validated rejected');
  equal(reviewStatusOf(db, 'claim:v1'), 'confirmed', 'unmutated');

  seedNode(db, 'claim:v2', 'claim', 'needs_evidence');
  res = promoteNodeStatus(db, 'claim:v2', 'needs_evidence', 'validated', 'system');
  equal(res.reason, 'agent_attribution_forbidden', 'needs_evidence->validated rejected');
  equal(reviewStatusOf(db, 'claim:v2'), 'needs_evidence', 'unmutated');
});

test('agent guard does NOT fire on non-confirm/non-validate transitions (reject, stale)', (db) => {
  seedNode(db, 'claim:r1', 'claim', 'proposed');
  let res = promoteNodeStatus(db, 'claim:r1', 'proposed', 'rejected', 'system');
  equal(res.ok, true, 'system MAY reject');
  equal(reviewStatusOf(db, 'claim:r1'), 'rejected', 'mutated to rejected');

  seedNode(db, 'claim:s1', 'claim', 'confirmed');
  res = promoteNodeStatus(db, 'claim:s1', 'confirmed', 'stale', 'system');
  equal(res.ok, true, 'system MAY stale');
  equal(reviewStatusOf(db, 'claim:s1'), 'stale', 'mutated to stale');
});

test('agent guard does NOT fire for system-bookkeeping node types on a confirm transition', (db) => {
  // A memory_event node confirmed by system is the Part 9 v1.5 carve-out.
  seedNode(db, 'mev:1', 'memory_event', 'proposed');
  const res = promoteNodeStatus(db, 'mev:1', 'proposed', 'confirmed', 'system');
  equal(res.ok, true, 'system MAY confirm an audit node');
  equal(reviewStatusOf(db, 'mev:1'), 'confirmed', 'confirmed');
});

test('a human byUser promotes proposed->confirmed; confirmed_by + status_promoted event carry the human', (db) => {
  seedNode(db, 'claim:h1', 'claim', 'proposed');
  const res = promoteNodeStatus(db, 'claim:h1', 'proposed', 'confirmed', 'jonathan', 'reviewed at gate');
  equal(res.ok, true, 'human confirm succeeds');
  equal(reviewStatusOf(db, 'claim:h1'), 'confirmed', 'review_status confirmed');
  equal(confirmedByOf(db, 'claim:h1'), 'jonathan', 'confirmed_by is the human');
  const evt = promotedEventConfirmedBy(db, 'claim:h1');
  ok(evt.indexOf('jonathan') >= 0, 'status_promoted event payload confirmed_by == human');
});

// ===========================================================================
// confirmNode(db, id, byUser, reason?)
// ===========================================================================

test('confirmNode resolves the current status and promotes proposed->confirmed', (db) => {
  seedNode(db, 'claim:cn1', 'claim', 'proposed');
  const res = confirmNode(db, 'claim:cn1', 'navigator');
  equal(res.ok, true, 'confirmNode succeeds for proposed node');
  equal(reviewStatusOf(db, 'claim:cn1'), 'confirmed', 'promoted to confirmed');
  equal(confirmedByOf(db, 'claim:cn1'), 'navigator', 'confirmed_by');
});

test('confirmNode delegates the agent guard (agent byUser rejected)', (db) => {
  seedNode(db, 'claim:cn2', 'claim', 'proposed');
  const res = confirmNode(db, 'claim:cn2', 'larry');
  equal(res.ok, false, 'reject');
  equal(res.reason, 'agent_attribution_forbidden', 'delegated reason');
  equal(reviewStatusOf(db, 'claim:cn2'), 'proposed', 'unmutated');
});

test('confirmNode on an unknown node id returns unknown_node', (db) => {
  const res = confirmNode(db, 'claim:does-not-exist', 'navigator');
  equal(res.ok, false, 'reject');
  equal(res.reason, 'unknown_node', 'reason');
});

test('confirmNode on a node with no X->confirmed transition returns invalid_transition', (db) => {
  // A rejected node has no rejected->confirmed transition in the closed Set.
  seedNode(db, 'claim:cn3', 'claim', 'rejected');
  const res = confirmNode(db, 'claim:cn3', 'navigator');
  equal(res.ok, false, 'reject');
  equal(res.reason, 'invalid_transition', 'delegated reason');
});

test('confirmNode is the ONLY new production caller of promoteNodeStatus (source-grep audit)', () => {
  // Mirror the Phase 125-07 Test-7 source-grep-audit idiom: scan lib/ + scripts/
  // + commands/ for files matching /promoteNodeStatus/ outside comments. The only
  // production files allowed to reference the symbol are:
  //   navigation.cjs (re-export), transitions.cjs (definition), confirm-node.cjs (call).
  const roots = ['lib', 'scripts', 'commands'];
  const allowed = new Set([
    path.join('lib', 'core', 'navigation.cjs'),
    path.join('lib', 'core', 'navigation', 'transitions.cjs'),
    path.join('lib', 'core', 'navigation', 'confirm-node.cjs'),
  ]);
  const offenders = [];

  function isCodeLine(line) {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    return true;
  }

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue;
        walk(full);
      } else if (e.isFile() && /\.(cjs|js|mjs)$/.test(e.name)) {
        let src;
        try { src = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
        if (src.indexOf('promoteNodeStatus') < 0) continue;
        const rel = path.relative(REPO_ROOT, full);
        if (allowed.has(rel)) continue;
        // Allow comment-only references (e.g. a justification block mentioning it).
        const codeHit = src.split(/\r?\n/).some(
          (ln) => isCodeLine(ln) && ln.indexOf('promoteNodeStatus') >= 0
        );
        if (codeHit) offenders.push(rel);
      }
    }
  }

  for (const r of roots) walk(path.join(REPO_ROOT, r));
  equal(offenders.length, 0, 'unexpected production callers of promoteNodeStatus: ' + offenders.join(', '));
});

// ===========================================================================
// resolveByUser(roomDir)
// ===========================================================================

function writeUserMd(roomDir, body) {
  fs.writeFileSync(path.join(roomDir, 'USER.md'), body, 'utf8');
}

test('resolveByUser returns user_id when USER.md frontmatter carries it', (db, tmp) => {
  writeUserMd(tmp, '---\nuser_id: jonathan\ncanonical_role: founder\n---\n# notes\n');
  equal(resolveByUser(tmp), 'jonathan', 'user_id wins');
});

test('resolveByUser falls back to canonical_role when user_id is null', (db, tmp) => {
  writeUserMd(tmp, '---\ncanonical_role: founder\n---\n# notes\n');
  equal(resolveByUser(tmp), 'founder', 'canonical_role fallback');
});

test('resolveByUser on a bare template USER.md (no frontmatter) returns navigator', (db, tmp) => {
  writeUserMd(tmp, '# USER\n\nNo frontmatter here.\n');
  equal(resolveByUser(tmp), 'navigator', 'parse_failed default');
});

test('resolveByUser on an absent USER.md returns navigator', (db, tmp) => {
  // tmp has no USER.md.
  equal(resolveByUser(tmp), 'navigator', 'absent default');
});

test('resolveByUser NEVER returns an agent identity; user_id=system coerces to navigator', (db, tmp) => {
  writeUserMd(tmp, '---\nuser_id: system\n---\n');
  equal(resolveByUser(tmp), 'navigator', 'agent identity coerced to navigator');
  writeUserMd(tmp, '---\nuser_id: larry\n---\n');
  equal(resolveByUser(tmp), 'navigator', 'larry coerced to navigator');
});

// ===========================================================================
// navigation.cjs re-export surface
// ===========================================================================

test('navigation.cjs re-exports confirmNode + resolveByUser', () => {
  equal(typeof navigation.confirmNode, 'function', 'confirmNode re-exported');
  equal(typeof navigation.resolveByUser, 'function', 'resolveByUser re-exported');
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) {
    process.stdout.write('PASS ' + r.name + '\n');
  } else {
    failed += 1;
    process.stdout.write('FAIL ' + r.name + ' :: ' + r.err + '\n');
  }
}
process.stdout.write('\n' + (results.length - failed) + '/' + results.length + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
