'use strict';
// Phase 220-02 Task 2 -- content-hash idempotency + SUPERSEDES versioning +
// ledger contract (RED-first).
//
// Four behavior groups (220-02-PLAN.md Task 2), hermetic (stubbed
// _fetchCorpus, zero network):
//   (1) no_op: re-ingesting byte-identical content is a typed 'no_op' -- no
//       re-file, no re-extract (artifact + node counts unchanged), ledger
//       timestamp refreshed (D-04)
//   (2) superseded: changed bytes at the same URL file a NEW artifact
//       folder+node; the prior artifact file and node are UNTOUCHED (history
//       preserved, sha-asserted); exactly ONE SUPERSEDES edge new -> prior
//       written via navigation (D-04, edges.cjs:154 vocabulary)
//   (3) ledger: url-ingest-ledger.json validates against the interfaces
//       schema after every step, no .tmp residue, points at the NEWEST node
//   (4) dedup ground truth: with the ledger DELETED but the artifact still in
//       room.db, re-ingesting unchanged bytes is STILL a no_op (room.db +
//       filed frontmatter are the ground truth; the ledger is a fast path,
//       rebuilt on the way through)
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { buildFixtureRoom } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-219.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const URL_INGEST_PATH = path.join(REPO_ROOT, 'lib', 'core', 'url-ingest.cjs');
const { ingestUrl, LEDGER_RELPATH } = require(URL_INGEST_PATH);

const SESSION = 'fixture-220-idem';
const URL_A = 'https://example.com/reports/annual-outlook';

const CONTENT_V1 = [
  '## Market Overview',
  '',
  'Solverine Dynamics leads the actuator segment while Ferrocore Industries',
  'expands into brushless drivetrain manufacturing across three regions.',
  '',
].join('\n');

const CONTENT_V2 = [
  '## Market Overview (revised)',
  '',
  'Solverine Dynamics ceded the actuator segment to Ferrocore Industries',
  'after the Novapulse Materials acquisition closed in the second quarter.',
  '',
].join('\n');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function okStub(markdown) {
  return function stub(args) {
    assert.equal(args.source, 'tavily-extract');
    return {
      ok: true,
      provider: {
        id: 'tavily-extract',
        status: 'ok',
        reason: null,
        counts: { urls_requested: 1, urls_succeeded: 1 },
      },
      results: [{ url: args.query, markdown: markdown, title: 'Annual outlook report' }],
    };
  };
}

let pass = 0;
let total = 0;
const failures = [];
async function check(label, fn) {
  total += 1;
  try {
    await fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

function counts(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return {
      artifacts: db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_artifact'").get().n,
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
    };
  } finally {
    closeRoomDb(db);
  }
}

function supersedesEdges(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare("SELECT source, target, properties FROM edges WHERE type = 'SUPERSEDES'").all();
  } finally {
    closeRoomDb(db);
  }
}

function nodeRow(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(nodeId);
  } finally {
    closeRoomDb(db);
  }
}

function readLedgerRaw(roomDir) {
  return JSON.parse(fs.readFileSync(path.join(roomDir, LEDGER_RELPATH), 'utf8'));
}

// The interfaces-contract schema walk (Task 2 behavior 3).
function assertLedgerSchema(roomDir, url) {
  const abs = path.join(roomDir, LEDGER_RELPATH);
  assert.ok(fs.existsSync(abs), 'ledger present');
  // Atomicity: no write-temp residue anywhere in .mindrian.
  const residue = fs.readdirSync(path.dirname(abs)).filter((n) => n.includes('.tmp.'));
  assert.equal(residue.length, 0, 'no .tmp residue: ' + residue.join(','));
  const ledger = JSON.parse(fs.readFileSync(abs, 'utf8'));
  assert.equal(ledger.schema_version, 1, 'schema_version 1');
  assert.ok(ledger.entries && typeof ledger.entries === 'object', 'entries map');
  const entry = ledger.entries[url];
  assert.ok(entry, 'entry for ' + url);
  assert.match(entry.content_sha256, /^[0-9a-f]{64}$/, 'content_sha256 hex');
  assert.ok(typeof entry.artifact_node_id === 'string' && entry.artifact_node_id.length > 0, 'artifact_node_id');
  assert.match(entry.artifact_path, /^research\//, 'artifact_path under research/');
  assert.ok(!Number.isNaN(Date.parse(entry.last_ingested_at)), 'last_ingested_at ISO');
  assert.ok(entry.ingest_origin === 'on_demand' || entry.ingest_origin === 'cadence', 'ingest_origin enum');
  return entry;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-220-idem-'));
  const fx = buildFixtureRoom(tmp);
  const roomDir = fx.roomDir;

  // Baseline ingest (V1).
  const env1 = await ingestUrl(roomDir, URL_A, { _fetchCorpus: okStub(CONTENT_V1), sessionId: SESSION });
  assert.equal(env1.outcome, 'filed', 'baseline files: ' + JSON.stringify(env1));
  const afterFirst = counts(roomDir);
  const firstEntry = assertLedgerSchema(roomDir, URL_A);
  const firstArtifactAbs = path.join(roomDir, env1.artifact.path);
  const firstFileSha = sha256(fs.readFileSync(firstArtifactAbs, 'utf8'));

  // ---------- Group 1: no_op on byte-identical re-ingest ----------
  await sleep(15);
  const env2 = await ingestUrl(roomDir, URL_A, { _fetchCorpus: okStub(CONTENT_V1), sessionId: SESSION });

  await check('G1a: byte-identical re-ingest is a typed no_op pointing at the prior artifact', () => {
    assert.equal(env2.ok, true, JSON.stringify(env2));
    assert.equal(env2.outcome, 'no_op');
    assert.equal(env2.artifact.node_id, env1.artifact.node_id, 'same artifact node');
    assert.equal(env2.artifact.path, env1.artifact.path, 'same artifact path');
    assert.equal(env2.artifact.content_sha256, sha256(CONTENT_V1));
    assert.equal(env2.artifact.superseded_node_id, null);
  });

  await check('G1b: no re-file, no re-extract (artifact/node/edge counts unchanged)', () => {
    const now = counts(roomDir);
    assert.equal(now.artifacts, afterFirst.artifacts, 'artifact count unchanged');
    assert.equal(now.nodes, afterFirst.nodes, 'node count unchanged (extraction not re-run)');
    assert.equal(now.edges, afterFirst.edges, 'edge count unchanged');
    const dirs = fs.readdirSync(path.join(roomDir, 'research')).filter((n) => n !== 'ROOM.md');
    assert.equal(dirs.length, 1, 'exactly one research entry');
  });

  await check('G1c: ledger timestamp refreshed on no_op', () => {
    const entry = assertLedgerSchema(roomDir, URL_A);
    assert.ok(Date.parse(entry.last_ingested_at) > Date.parse(firstEntry.last_ingested_at),
      'last_ingested_at advanced (' + firstEntry.last_ingested_at + ' -> ' + entry.last_ingested_at + ')');
    assert.equal(entry.artifact_node_id, env1.artifact.node_id, 'still points at the artifact');
  });

  // ---------- Group 2: SUPERSEDES on changed bytes ----------
  const env3 = await ingestUrl(roomDir, URL_A, { _fetchCorpus: okStub(CONTENT_V2), sessionId: SESSION });

  await check('G2a: changed bytes -> typed superseded outcome with a NEW artifact', () => {
    assert.equal(env3.ok, true, JSON.stringify(env3));
    assert.equal(env3.outcome, 'superseded');
    assert.notEqual(env3.artifact.node_id, env1.artifact.node_id, 'new node');
    assert.notEqual(env3.artifact.path, env1.artifact.path, 'new folder (same-day -2 suffix rule)');
    assert.equal(env3.artifact.content_sha256, sha256(CONTENT_V2));
    assert.equal(env3.artifact.superseded_node_id, env1.artifact.node_id, 'envelope names the prior node');
    assert.ok(fs.existsSync(path.join(roomDir, env3.artifact.path)), 'new artifact on disk');
  });

  await check('G2b: prior artifact file + node UNTOUCHED (history never overwritten, D-04)', () => {
    assert.ok(fs.existsSync(firstArtifactAbs), 'prior file still present');
    assert.equal(sha256(fs.readFileSync(firstArtifactAbs, 'utf8')), firstFileSha, 'prior bytes identical');
    const prior = nodeRow(roomDir, env1.artifact.node_id);
    assert.ok(prior, 'prior node still present');
    assert.equal(prior.type, 'memory_artifact');
  });

  await check('G2c: exactly ONE SUPERSEDES edge new -> prior, written via navigation', () => {
    const edges = supersedesEdges(roomDir);
    assert.equal(edges.length, 1, 'exactly one SUPERSEDES edge (got ' + edges.length + ')');
    assert.equal(edges[0].source, env3.artifact.node_id, 'source = new version');
    assert.equal(edges[0].target, env1.artifact.node_id, 'target = prior version');
    const props = JSON.parse(edges[0].properties || '{}');
    assert.equal(props.reason, 'content_change');
    assert.equal(props.prior_sha256, sha256(CONTENT_V1));
    assert.equal(props.new_sha256, sha256(CONTENT_V2));
  });

  await check('GATE: zero raw INSERT INTO edges in url-ingest.cjs (comment-filtered)', () => {
    const src = fs.readFileSync(URL_INGEST_PATH, 'utf8');
    const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    assert.equal(/INSERT\s+INTO/i.test(code), false, 'edge writes only via navigation.writeEdge');
  });

  // ---------- Group 3: ledger contract after supersession ----------
  await check('G3: ledger schema-valid, atomic, and pointing at the NEWEST artifact node', () => {
    const entry = assertLedgerSchema(roomDir, URL_A);
    assert.equal(entry.artifact_node_id, env3.artifact.node_id, 'ledger points at the new version');
    assert.equal(entry.artifact_path, env3.artifact.path);
    assert.equal(entry.content_sha256, sha256(CONTENT_V2));
  });

  // ---------- Group 4: dedup ground truth survives ledger loss ----------
  await check('G4: ledger deleted -> unchanged re-ingest is STILL a no_op (room.db is ground truth)', async () => {
    fs.unlinkSync(path.join(roomDir, LEDGER_RELPATH));
    const before = counts(roomDir);
    const env4 = await ingestUrl(roomDir, URL_A, { _fetchCorpus: okStub(CONTENT_V2), sessionId: SESSION });
    assert.equal(env4.outcome, 'no_op', JSON.stringify(env4));
    assert.equal(env4.artifact.node_id, env3.artifact.node_id, 'resolved the NEWEST version from room.db');
    const after = counts(roomDir);
    assert.equal(after.artifacts, before.artifacts, 'nothing re-filed');
    assert.equal(after.nodes, before.nodes, 'nothing re-extracted');
    // The ledger is rebuilt on the way through.
    const entry = assertLedgerSchema(roomDir, URL_A);
    assert.equal(entry.artifact_node_id, env3.artifact.node_id, 'ledger rebuilt pointing at the newest node');
  });

  console.log('');
  console.log('test-220-idempotency: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('test-220-idempotency crashed:', e && e.stack);
  process.exit(1);
});
