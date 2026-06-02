'use strict';
/*
 * Phase 131-05 Task 2 -- check-research-isomorphism guard suite.
 *
 * Asserts the /mos:research typed-node + typed-edge contract guard fails CLOSED
 * on every breach class and passes on a clean fixture. Hermetic: drives the pure
 * scanRoom / scanDirectives API over in-memory fixtures (no room.db needed for
 * the contract assertions) plus a real-room.db round-trip via scanRoomDb.
 *
 * Plan 01 PRE-REGISTERED this suite in run-all-131.sh; this plan only CREATES it.
 *
 * Canon Part 4: every cascade edge is typed graph data.
 * Canon Part 5: evidence_tier from the closed four-tier set.
 * Canon Part 8: the guard recognizes the REAL 130.7 correlation_id shape, never a
 *   phantom correlation.resolve; ZERO network.
 * NO em-dashes in this file (CLAUDE.md HARD RULE).
 */

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const guard = require(path.join(REPO_ROOT, 'scripts', 'check-research-isomorphism.cjs'));
const correlation = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed += 1; console.log('  ok   ' + name); }
  catch (e) { failed += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
}

// A real 130.7 correlation_id (the bare 16-char hex the guard recognizes for a
// teaching-graph target). Computed via the REAL export, not hardcoded blindly.
const REAL_CID = correlation.computeCorrelationId('Porter Five Forces', 'Framework');

// A well-formed EvidenceClaim node carrying the full locked provenance schema.
function evidenceNode(id, overrides) {
  const props = Object.assign({
    source: 'openalex',
    url: 'https://openalex.org/W123',
    retrieved_at: '2026-06-02T00:00:00Z',
    evidence_tier: 'Academic',
    topic: 'edtech market',
    summary: 'a finding',
  }, overrides || {});
  return { id: id, type: 'EvidenceClaim', properties: JSON.stringify(props) };
}

// A LOCAL section target node so a local INFORMS edge is FK-valid in the fixture.
function sectionNode(id) {
  return { id: id, type: 'section', properties: '{}' };
}

// ---------------------------------------------------------------------------
// 1. CLEAN FIXTURE passes (local target + teaching-graph correlation_id target).
// ---------------------------------------------------------------------------
t('clean fixture (local + correlation_id targets) passes with zero violations', function () {
  const graph = {
    nodes: [
      evidenceNode('EvidenceClaim:s1:abc'),
      evidenceNode('EvidenceClaim:s1:def'),
      sectionNode('section:financial-model'),
    ],
    edges: [
      // local target: a namespaced room.db node id.
      { source: 'EvidenceClaim:s1:abc', target: 'section:financial-model', type: 'INFORMS', properties: '{"evidence_tier":"Academic"}' },
      // teaching-graph target: a REAL 130.7 correlation_id (bare hex).
      { source: 'EvidenceClaim:s1:def', target: REAL_CID, type: 'SUPERSEDES', properties: '{}' },
    ],
  };
  const v = guard.scanRoom(graph);
  equal(v.length, 0, 'clean fixture should produce zero violations, got ' + JSON.stringify(v));
});

// ---------------------------------------------------------------------------
// 2. PROVENANCE: an EvidenceClaim missing url fails closed.
// ---------------------------------------------------------------------------
t('planted violation: EvidenceClaim missing url fails closed', function () {
  const props = { source: 'openalex', retrieved_at: '2026-06-02T00:00:00Z', evidence_tier: 'Academic' };
  const graph = {
    nodes: [{ id: 'EvidenceClaim:s1:nourl', type: 'EvidenceClaim', properties: JSON.stringify(props) }],
    edges: [],
  };
  const v = guard.scanRoom(graph);
  ok(v.length >= 1, 'expected at least one violation');
  ok(v.some((x) => x.rule === 'missing-provenance' && /url/.test(x.detail)), 'expected a missing-provenance url violation');
});

// ---------------------------------------------------------------------------
// 3. EVIDENCE TIER: an off-set evidence_tier fails closed.
// ---------------------------------------------------------------------------
t('planted violation: evidence_tier off the closed Part 5 set fails closed', function () {
  const graph = {
    nodes: [evidenceNode('EvidenceClaim:s1:badtier', { evidence_tier: 'Gold' })],
    edges: [],
  };
  const v = guard.scanRoom(graph);
  ok(v.some((x) => x.rule === 'invalid-evidence-tier'), 'expected an invalid-evidence-tier violation');
});

// ---------------------------------------------------------------------------
// 4. UNTYPED EDGE: a cascade edge with an off-allowlist predicate fails closed.
// ---------------------------------------------------------------------------
t('planted violation: untyped cascade edge predicate fails closed', function () {
  const graph = {
    nodes: [evidenceNode('EvidenceClaim:s1:abc'), sectionNode('section:market')],
    edges: [
      { source: 'EvidenceClaim:s1:abc', target: 'section:market', type: 'RELATES_TO', properties: '{}' },
    ],
  };
  const v = guard.scanRoom(graph);
  ok(v.some((x) => x.rule === 'untyped-cascade-edge'), 'expected an untyped-cascade-edge violation');
});

// ---------------------------------------------------------------------------
// 5. RAW-NAME TARGET: a teaching-graph edge target that is a raw framework name
//    (not a 130.7 correlation_id, not a namespaced local node id) fails closed.
// ---------------------------------------------------------------------------
t('planted violation: raw framework-name cascade target fails closed', function () {
  const graph = {
    nodes: [evidenceNode('EvidenceClaim:s1:abc')],
    edges: [
      // 'Porter Five Forces' is a RAW NAME -- not a correlation_id, not namespaced.
      { source: 'EvidenceClaim:s1:abc', target: 'Porter Five Forces', type: 'INFORMS', properties: '{}' },
    ],
  };
  const v = guard.scanRoom(graph);
  ok(v.some((x) => x.rule === 'raw-name-target'), 'expected a raw-name-target violation');
});

// ---------------------------------------------------------------------------
// 6. REJECTED_BECAUSE without a reason scalar fails closed.
// ---------------------------------------------------------------------------
t('planted violation: REJECTED_BECAUSE without a reason scalar fails closed', function () {
  const graph = {
    nodes: [evidenceNode('EvidenceClaim:s1:rej'), sectionNode('section:market')],
    edges: [
      { source: 'EvidenceClaim:s1:rej', target: 'section:market', type: 'REJECTED_BECAUSE', properties: '{}' },
    ],
  };
  const v = guard.scanRoom(graph);
  ok(v.some((x) => x.rule === 'rejected-without-reason'), 'expected a rejected-without-reason violation');
});

t('a REJECTED_BECAUSE WITH a reason scalar passes', function () {
  const graph = {
    nodes: [evidenceNode('EvidenceClaim:s1:rej'), sectionNode('section:market')],
    edges: [
      { source: 'EvidenceClaim:s1:rej', target: 'section:market', type: 'REJECTED_BECAUSE', properties: '{"reason":"stale_data"}' },
    ],
  };
  const v = guard.scanRoom(graph);
  equal(v.length, 0, 'a reasoned rejection should pass, got ' + JSON.stringify(v));
});

// ---------------------------------------------------------------------------
// 7. DIRECTIVE GREP: a clean module set has zero Python spawn; a planted Python
//    spawn fails closed.
// ---------------------------------------------------------------------------
t('directive grep: the real pipeline modules + command have zero Python spawn', function () {
  const reader = (rel) => {
    try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); } catch (_e) { return ''; }
  };
  const v = guard.scanDirectives(guard.DIRECTIVE_FILES, reader);
  equal(v.length, 0, 'real modules should have zero Python spawn, got ' + JSON.stringify(v));
});

t('directive grep: a planted Python spawn fails closed', function () {
  const reader = (rel) => {
    if (rel === 'fake-module.cjs') {
      return [
        "'use strict';",
        "const cp = require('child_process');",
        "cp.execSync('python scripts/hsi-compute.py');",
      ].join('\n');
    }
    return '';
  };
  const v = guard.scanDirectives(['fake-module.cjs'], reader);
  ok(v.length >= 1, 'expected at least one python-spawn violation');
  ok(v.every((x) => x.rule === 'python-spawn'), 'all violations should be python-spawn');
});

t('directive grep: a comment-only mention of .py does NOT false-flag', function () {
  const reader = (rel) => {
    if (rel === 'doc-module.cjs') {
      return [
        "'use strict';",
        '// This module does NOT call scripts/hsi-compute.py and never spawns child_process.',
        '/* historical note: the old flow used a .py script; this one does not. */',
        'module.exports = {};',
      ].join('\n');
    }
    return '';
  };
  const v = guard.scanDirectives(['doc-module.cjs'], reader);
  equal(v.length, 0, 'comment-only mentions should not flag, got ' + JSON.stringify(v));
});

// ---------------------------------------------------------------------------
// 8. REAL ROOM.DB round-trip: scanRoomDb reads a live room.db and validates a
//    real wired EvidenceClaim + INFORMS edge produced by the findings-wirer.
// ---------------------------------------------------------------------------
t('scanRoomDb passes on a real room.db with a wired EvidenceClaim + INFORMS edge', function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-131-iso-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  try {
    const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
    const wirer = require(path.join(REPO_ROOT, 'lib', 'core', 'findings-wirer.cjs'));
    // Seed a LOCAL section target node the INFORMS edge can FK to.
    const nowMs = Date.now();
    db.prepare(
      "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
      "VALUES (?, 'section', '{}', 'seed', 'system', NULL, 'confirmed', ?, ?)"
    ).run('section:financial-model', nowMs, nowMs);

    const finding = {
      source: 'openalex',
      url: 'https://openalex.org/W999',
      retrieved_at: '2026-06-02T00:00:00Z',
      evidence_tier: 'Academic',
      title: 'A real finding',
      summary: 'a real summary',
    };
    const res = wirer.wireAccept(db, {
      finding: finding,
      decision: { target_kind: 'local', target_section: 'financial-model' },
      roomDir: tmp,
      sessionId: 's1',
      topic: 'edtech',
    });
    ok(res && res.ok, 'wireAccept should succeed: ' + JSON.stringify(res));

    const v = guard.scanRoomDb(db);
    equal(v.length, 0, 'a real wired EvidenceClaim + INFORMS edge should pass, got ' + JSON.stringify(v));
    void navigation;
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* ignore */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// 9. NO-PHANTOM contract guard: the guard recognizes the correlation_id shape via
//    the REAL CORRELATION_ID_LENGTH, never a phantom correlation.resolve token.
// ---------------------------------------------------------------------------
t('the guard sources its correlation_id length from the REAL 130.7 export', function () {
  equal(guard.CORRELATION_ID_LENGTH, correlation.CORRELATION_ID_LENGTH,
    'guard CORRELATION_ID_LENGTH must equal the REAL 130.7 export length');
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'check-research-isomorphism.cjs'), 'utf8');
  // Strip block + line comments before scanning for the phantom token, so the
  // header prose documenting the phantom's absence is not a false flag.
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok(!/correlation\.resolve\b/.test(noComments), 'guard must NOT reference a phantom correlation.resolve');
});

console.log('');
console.log('test-131-isomorphism: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
