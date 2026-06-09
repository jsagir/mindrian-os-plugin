'use strict';
// Phase 150-07 -- FEYNMAN.md read-back + seed-writer + body-freshness signal (MEM-08)
// ====================================================================================
// RED-by-design at authoring time: readQuintuple (sync + async) and the
// feynman-seed-writer do NOT exist until Tasks 2-3 land. This suite asserts:
//
//   (1) readQuintuple(sectionPath) -> {room, state, reasoning, brain, feynman}.
//       The first FOUR fields equal readQuadruple's output byte-for-byte (additive,
//       never mutates the prior contract). feynman carries the human-authored body
//       extracted from the bodyOutsideSentinels region (the auto Timeline section
//       is EXCLUDED).
//   (2) Async parity: folder-memory-async.readQuintuple returns the same shape and
//       every async export is an AsyncFunction (constructor.name === 'AsyncFunction').
//   (3) Seed-writer: feynman-seed-writer.cjs writes a FEYNMAN body for a fresh
//       section via the shipped folder-memory writer (never hand-writes the file);
//       after seeding, readQuintuple(sectionPath).feynman is non-empty.
//   (4) Body-freshness signal: the projected body-freshness + timeline stale-flag
//       rows surface as typed graph signals (memory_event the cortex can read) --
//       the write-only sink is no longer write-only.
//
// NO em-dash / en-dash anywhere; reference the forbidden code points via
// String.fromCharCode so this file stays clean against the same grep the plan uses.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-150-feynman-readback.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');

const sync = require(path.join(REPO_ROOT, 'lib', 'core', 'folder-memory.cjs'));
const asyncMod = require(path.join(REPO_ROOT, 'lib', 'core', 'folder-memory-async.cjs'));

// ---------- Fixture helpers ----------

const EMDASH = String.fromCharCode(0x2014);
const ENDASH = String.fromCharCode(0x2013);

const SENTINEL_START = '<!-- TIMELINE_AUTO_START -->';
const SENTINEL_END = '<!-- TIMELINE_AUTO_END -->';

const HUMAN_BODY = [
  '# market-analysis',
  '',
  'The plain-language essence: we help busy clinicians find grants without a grant writer.',
  '',
  'This human body must be the ONLY thing readQuintuple extracts.',
].join('\n');

const AUTO_TIMELINE = [
  '## Timeline (auto)',
  '',
  SENTINEL_START,
  '*Last refreshed: 2026-01-01T00:00:00Z. 3 insight events.*',
  '',
  '- 2026-01-01T00:00:00Z: node_created -- decision:01',
  SENTINEL_END,
].join('\n');

function makeSection(withTimeline) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-07-'));
  const sectionDir = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(sectionDir, { recursive: true });
  // Minimal ROOM.md so the quadruple has something to byte-preserve.
  fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '# market-analysis\n', 'utf8');
  const feyBody = withTimeline ? HUMAN_BODY + '\n\n' + AUTO_TIMELINE + '\n' : HUMAN_BODY + '\n';
  fs.writeFileSync(path.join(sectionDir, 'FEYNMAN.md'), feyBody, 'utf8');
  return { roomDir, sectionDir };
}

function cleanup(roomDir) {
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
}

// ---------- Test 1: readQuintuple shape + additive byte-preservation ----------

function testReadQuintupleShapeAndAdditive() {
  const { roomDir, sectionDir } = makeSection(true);
  try {
    assert.equal(typeof sync.readQuintuple, 'function', 'sync readQuintuple must exist');

    const quad = sync.readQuadruple(sectionDir);
    const quint = sync.readQuintuple(sectionDir);

    // The five-field shape.
    for (const k of ['room', 'state', 'reasoning', 'brain', 'feynman']) {
      assert.ok(k in quint, 'readQuintuple result must carry field: ' + k);
    }

    // Additive: the first four fields equal readQuadruple byte-for-byte (deep equal
    // over the serialized form -- readQuintuple must NOT mutate the prior contract).
    assert.deepEqual(quint.room, quad.room, 'room field must equal readQuadruple');
    assert.deepEqual(quint.state, quad.state, 'state field must equal readQuadruple');
    assert.deepEqual(quint.reasoning, quad.reasoning, 'reasoning field must equal readQuadruple');
    assert.deepEqual(quint.brain, quad.brain, 'brain field must equal readQuadruple');

    // The feynman field carries the human body ONLY -- the auto Timeline is excluded.
    assert.equal(typeof quint.feynman, 'string', 'feynman field must be a string body');
    assert.ok(
      quint.feynman.indexOf('plain-language essence') !== -1,
      'feynman body must carry the human-authored prose'
    );
    assert.equal(
      quint.feynman.indexOf(SENTINEL_START), -1,
      'feynman body must NOT include the auto Timeline sentinel block'
    );
    assert.equal(
      quint.feynman.indexOf('Last refreshed'), -1,
      'feynman body must NOT include the auto Timeline content'
    );
  } finally {
    cleanup(roomDir);
  }
}

// ---------- Test 2: readQuintuple never throws on missing file ----------

function testReadQuintupleMissingFile() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-07-empty-'));
  try {
    const sectionDir = path.join(roomDir, 'no-feynman');
    fs.mkdirSync(sectionDir, { recursive: true });
    const quint = sync.readQuintuple(sectionDir);
    assert.ok('feynman' in quint, 'missing FEYNMAN still yields a feynman field');
    assert.equal(quint.feynman, '', 'missing FEYNMAN yields an empty feynman body');
  } finally {
    cleanup(roomDir);
  }
}

// ---------- Test 3: async parity + AsyncFunction discipline ----------

async function testAsyncParity() {
  assert.equal(
    typeof asyncMod.readQuintuple, 'function',
    'async readQuintuple must exist'
  );
  // Every async export is an AsyncFunction (key-set-parity discipline).
  for (const name of Object.keys(asyncMod)) {
    assert.equal(
      asyncMod[name].constructor.name, 'AsyncFunction',
      'async export ' + name + ' must be an AsyncFunction'
    );
  }
  // Sync + async key-set parity.
  assert.deepEqual(
    Object.keys(sync).sort(),
    Object.keys(asyncMod).sort(),
    'sync + async folder-memory must keep key-set parity'
  );

  const { roomDir, sectionDir } = makeSection(true);
  try {
    const syncQuint = sync.readQuintuple(sectionDir);
    const asyncQuint = await asyncMod.readQuintuple(sectionDir);
    assert.deepEqual(asyncQuint, syncQuint, 'async readQuintuple must equal sync output');
  } finally {
    cleanup(roomDir);
  }
}

// ---------- Test 4: seed-writer seeds a fresh section + freshness signal ----------

function testSeedWriterAndFreshnessSignal() {
  const seedWriter = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'feynman-seed-writer.cjs'));
  assert.equal(typeof seedWriter.seedSection, 'function', 'seed-writer must export seedSection');

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-07-seed-'));
  try {
    const sectionSlug = 'problem-definition';
    const sectionDir = path.join(roomDir, sectionSlug);
    fs.mkdirSync(sectionDir, { recursive: true });

    // Fresh section: NO FEYNMAN.md yet, so readQuintuple is empty before seeding.
    const before = sync.readQuintuple(sectionDir);
    assert.equal(before.feynman, '', 'fresh section has empty feynman before seeding');

    const db = new DatabaseSync(':memory:');
    db.exec(
      "CREATE TABLE IF NOT EXISTS nodes (" +
      "id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT, " +
      "source_path TEXT, created_by TEXT, confidence REAL, " +
      "review_status TEXT, created_at INTEGER, last_seen_at INTEGER);"
    );

    const SEED_BODY = 'We turn a grant search into a five minute task for a working scientist.';
    const res = seedWriter.seedSection(roomDir, sectionSlug, SEED_BODY, { db: db, now_ms: 1714694400000 });
    assert.equal(res.status, 'seeded', 'seedSection must report seeded; got ' + JSON.stringify(res));

    // After seeding, readQuintuple surfaces a non-empty feynman body via the
    // shipped read contract (proves the body landed through the writer, not hand-written).
    const after = sync.readQuintuple(sectionDir);
    assert.ok(after.feynman.length > 0, 'feynman body must be non-empty after seeding');
    assert.ok(
      after.feynman.indexOf('five minute task') !== -1,
      'seeded body must round-trip through readQuintuple'
    );

    // Body-freshness signal: the seed projects a typed memory_event the cortex can
    // read. The write-only sink is closed -- there is now a genuine read-back signal.
    const rows = db.prepare(
      "SELECT json_extract(properties, '$.event_type') AS et, " +
      "json_extract(properties, '$.body_freshness') AS bf " +
      "FROM nodes WHERE type = 'memory_event'"
    ).all();
    const seededRow = rows.find((r) => r.et === 'feynman_body_seeded');
    assert.ok(seededRow, 'a feynman_body_seeded memory_event must be projected');
    assert.ok(
      seededRow.bf === 'fresh' || (typeof seededRow.bf === 'number'),
      'the freshness scalar / stale-flag must be projected (the sink is no longer write-only)'
    );

    db.close();
  } finally {
    cleanup(roomDir);
  }
}

// ---------- Test 5: no em-dash / en-dash in the seeded output ----------

function testNoDashesInSeededBody() {
  const seedWriter = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'feynman-seed-writer.cjs'));
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-07-dash-'));
  try {
    const sectionSlug = 'solution-design';
    fs.mkdirSync(path.join(roomDir, sectionSlug), { recursive: true });
    seedWriter.seedSection(roomDir, sectionSlug, 'Plain language wins. Hyphens only, never long dashes.', {});
    const written = fs.readFileSync(path.join(roomDir, sectionSlug, 'FEYNMAN.md'), 'utf8');
    assert.equal(written.indexOf(EMDASH), -1, 'seeded FEYNMAN.md must contain no em-dashes');
    assert.equal(written.indexOf(ENDASH), -1, 'seeded FEYNMAN.md must contain no en-dashes');
  } finally {
    cleanup(roomDir);
  }
}

// ---------- Run ----------

(async function run() {
  testReadQuintupleShapeAndAdditive();
  testReadQuintupleMissingFile();
  await testAsyncParity();
  testSeedWriterAndFreshnessSignal();
  testNoDashesInSeededBody();
  process.stdout.write('PASS test-150-feynman-readback.cjs (5 read-back + seed + freshness assertions)\n');
  process.exit(0);
})().catch((err) => {
  process.stderr.write('FAIL test-150-feynman-readback.cjs: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
