/**
 * MindrianOS Plugin -- MOAT-01: HSI-to-graph transaction gate (Phase 242 Plan 01)
 * ==============================================================================
 * Proves that scripts/hsi-to-graph.cjs rewrites the HSI_CONNECTION and
 * REVERSE_SALIENT scoring layer ATOMICALLY. The scoring layer is the moat, and
 * before MOAT-01 a badly timed Ctrl-C between the DELETE and the last write left
 * a room permanently at zero scoring edges.
 *
 * Three legs, all real (no mocks, no stubbed sqlite):
 *   Leg A -- crash injection: SIGKILL a real child mid-rewrite, reopen room.db,
 *            assert the PRIOR scoring layer is byte-identical.
 *   Leg B -- concurrent reader: a real fork()'d reader polls throughout a live
 *            rewrite and must never observe 0 or a partial in-between count.
 *   Leg C -- mutation proof: strip BEGIN/COMMIT from a COPY of the script, run
 *            the identical Leg A sequence, and assert the invariant BREAKS.
 *            Without Leg C, Legs A and B could both pass vacuously.
 *
 * Fully hermetic: every room lives under os.tmpdir() via mkdtemp, nothing is
 * written inside the repo, no network reach, and Python is never invoked (the
 * .hsi-results.json fixture is hand-written to the shape hsi-to-graph.cjs parses).
 *
 * Run: node tests/test-242-hsi-to-graph-transaction.cjs
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, fork } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const lazygraph = require('../lib/core/lazygraph-ops.cjs');

const REAL_SCRIPT = path.join(__dirname, '..', 'scripts', 'hsi-to-graph.cjs');
const SEAM_MARKER = 'HSI-CRASH-SEAM: in-transaction';
const SCORING_TYPES = ['HSI_CONNECTION', 'REVERSE_SALIENT'];

// Prior layer: 4 HSI_CONNECTION + 2 REVERSE_SALIENT.
const PRIOR_TOTAL = 6;
// Post-commit layer: 8 HSI_CONNECTION + 2 REVERSE_SALIENT. Deliberately a
// DIFFERENT number from PRIOR_TOTAL so the two states are never confusable.
const POST_TOTAL = 10;

const SECTIONS = ['problem-definition', 'solution-design'];
const ARTIFACTS = ['art-a', 'art-b', 'art-c', 'art-d'];
const PRIOR_HSI_PAIRS = [
  ['art-a', 'art-b'],
  ['art-b', 'art-c'],
  ['art-c', 'art-d'],
  ['art-d', 'art-a'],
];
// 8 pairs: the 4 prior pairs plus 4 that are NOT in the prior set, so a partial
// write is observable as a value change and not only as a count change.
const FIXTURE_HSI_PAIRS = PRIOR_HSI_PAIRS.concat([
  ['art-a', 'art-c'],
  ['art-b', 'art-d'],
  ['art-c', 'art-a'],
  ['art-d', 'art-b'],
]);

const tempDirs = [];

function mkTemp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function cleanupAll() {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  }
  tempDirs.length = 0;
}

/**
 * Seed a room that has ALREADY been scored: 4 Artifact nodes, 2 Section nodes,
 * and a PRIOR scoring layer of 6 edges each tagged {"tier":"prior"} so a
 * surviving row is distinguishable from a freshly written one by VALUE, not
 * only by count.
 */
async function createSeededRoom() {
  const roomDir = mkTemp('mindrian-242-hsi-');
  for (const section of SECTIONS) {
    fs.mkdirSync(path.join(roomDir, section), { recursive: true });
  }

  const { db, conn } = await lazygraph.openGraph(roomDir);
  const insertNodeStmt = conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties'
  );
  const insertEdgeStmt = conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  );

  for (const id of ARTIFACTS) {
    insertNodeStmt.run(id, 'Artifact', JSON.stringify({ name: id }));
  }
  for (const id of SECTIONS) {
    insertNodeStmt.run(id, 'Section', JSON.stringify({ name: id }));
  }

  const priorProps = JSON.stringify({ tier: 'prior' });
  for (const [left, right] of PRIOR_HSI_PAIRS) {
    insertEdgeStmt.run(left, right, 'HSI_CONNECTION', priorProps);
  }
  // Both directions between the two sections.
  insertEdgeStmt.run(SECTIONS[0], SECTIONS[1], 'REVERSE_SALIENT', priorProps);
  insertEdgeStmt.run(SECTIONS[1], SECTIONS[0], 'REVERSE_SALIENT', priorProps);

  await lazygraph.closeGraph(db);
  return roomDir;
}

/**
 * Hand-write .hsi-results.json to the shape scripts/hsi-to-graph.cjs parses.
 * compute-hsi.py is deliberately never invoked: Python is not a dependency of
 * this test and the gate must run in any environment.
 */
function writeHsiFixture(roomDir) {
  const payload = {
    metadata: { tier: 1 },
    hsi_pairs: FIXTURE_HSI_PAIRS.map(([left, right], i) => ({
      left_id: left,
      right_id: right,
      // Every score sits above the 0.3 floor hsi-to-graph.cjs enforces, so all
      // 8 pairs are written and the post-commit count is deterministic.
      hsi_score: 0.6 + (i * 0.01),
      lsa_sim: 0.4 + (i * 0.01),
      semantic_sim: 0.5 + (i * 0.01),
      surprise_type: 'orthogonal',
      breakthrough_potential: 0.7,
    })),
    reverse_salients: [
      {
        source_section: SECTIONS[0],
        target_section: SECTIONS[1],
        differential_score: 0.8,
        innovation_type: 'bridge',
        innovation_thesis: 'fixture thesis one',
      },
      {
        source_section: SECTIONS[1],
        target_section: SECTIONS[0],
        differential_score: 0.9,
        innovation_type: 'bridge',
        innovation_thesis: 'fixture thesis two',
      },
    ],
  };
  fs.writeFileSync(path.join(roomDir, '.hsi-results.json'), JSON.stringify(payload, null, 2));
}

/**
 * Exact-set snapshot of the scoring layer, read through a FRESH read-only
 * connection so it reflects committed state on disk and not any in-process
 * handle. Rows are normalized to plain objects: node:sqlite returns
 * null-prototype rows, which deepStrictEqual treats as unequal to object
 * literals even when every value matches.
 */
function snapshotScoringEdges(roomDir) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
  try {
    const rows = db
      .prepare(
        "SELECT type, source, target, properties FROM edges WHERE type IN ('HSI_CONNECTION','REVERSE_SALIENT') ORDER BY type, source, target"
      )
      .all();
    return rows.map((r) => ({
      type: r.type,
      source: r.source,
      target: r.target,
      properties: r.properties,
    }));
  } finally {
    db.close();
  }
}

function countPriorTierRows(rows) {
  return rows.filter((r) => {
    try {
      return JSON.parse(r.properties).tier === 'prior';
    } catch (e) {
      return false;
    }
  }).length;
}

/**
 * Spawn the script and resolve as soon as it announces it is INSIDE the open
 * transaction. Killing on the marker rather than after a sleep makes the crash
 * point deterministic instead of a race against a timer.
 */
function spawnUntilSeam(scriptPath, roomDir, delayMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, roomDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MINDRIAN_HSI_CRASH_TEST_DELAY_MS: String(delayMs) },
    });

    let stderr = '';
    let settled = false;

    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
      reject(new Error(
        'crash seam never fired within 15000 ms for ' + scriptPath +
        '. Accumulated stderr: ' + JSON.stringify(stderr)
      ));
    }, 15000);

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      if (!settled && stderr.includes(SEAM_MARKER)) {
        settled = true;
        clearTimeout(guard);
        resolve(child);
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      reject(err);
    });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      reject(new Error(
        'child exited before the crash seam fired. stderr: ' + JSON.stringify(stderr)
      ));
    });
  });
}

function awaitClose(child) {
  return new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

/**
 * Write a COPY of hsi-to-graph.cjs with the transaction wrap stripped. The real
 * script is never edited. If the two lines are not actually removed the mutant
 * build throws, so Leg C cannot pass by silently testing an unmutated script.
 */
function buildMutantScript(tmpDir) {
  const original = fs.readFileSync(REAL_SCRIPT, 'utf8');

  const beginRe = /^[ \t]*conn\.prepare\('BEGIN'\)\.run\(\);[ \t]*$/m;
  const commitRe = /^[ \t]*conn\.prepare\('COMMIT'\)\.run\(\);[ \t]*$/m;

  assert.ok(beginRe.test(original), 'mutant build: no BEGIN line found in the real script');
  assert.ok(commitRe.test(original), 'mutant build: no COMMIT line found in the real script');

  let mutated = original.replace(beginRe, '').replace(commitRe, '');
  assert.notEqual(mutated, original, 'mutant build: source did not change');
  assert.ok(!beginRe.test(mutated), 'mutant build: BEGIN line survived the strip');
  assert.ok(!commitRe.test(mutated), 'mutant build: COMMIT line survived the strip');

  // The mutant runs from a temp dir, so its relative requires must be absolute.
  const lazygraphAbs = path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs');
  const nodeInsertAbs = path.join(__dirname, '..', 'lib', 'core', 'node-insert.cjs');
  mutated = mutated
    .replace("'../lib/core/lazygraph-ops.cjs'", JSON.stringify(lazygraphAbs))
    .replace("'../lib/core/node-insert.cjs'", JSON.stringify(nodeInsertAbs));

  assert.ok(
    !mutated.includes('../lib/core/'),
    'mutant build: a relative require survived and would fail to resolve from the temp dir'
  );

  const mutantPath = path.join(tmpDir, 'hsi-to-graph.MUTANT.cjs');
  fs.writeFileSync(mutantPath, mutated);
  return mutantPath;
}

// ============================================================
// MOAT-01
// ============================================================

describe('MOAT-01: HSI-to-graph edge rewrite is atomic', () => {
  after(() => {
    cleanupAll();
  });

  it('crash mid-rewrite leaves the prior scoring layer intact', async () => {
    const roomDir = await createSeededRoom();
    const prior = snapshotScoringEdges(roomDir);
    assert.equal(prior.length, PRIOR_TOTAL, 'seeded prior layer should hold ' + PRIOR_TOTAL + ' edges');
    assert.equal(countPriorTierRows(prior), PRIOR_TOTAL, 'every seeded row should carry tier:prior');

    writeHsiFixture(roomDir);

    const child = await spawnUntilSeam(REAL_SCRIPT, roomDir, 150);
    child.kill('SIGKILL');
    const { signal } = await awaitClose(child);

    assert.equal(signal, 'SIGKILL', 'child must have been signal-killed, not have exited cleanly');

    const after_ = snapshotScoringEdges(roomDir);
    assert.deepStrictEqual(
      after_,
      prior,
      'a crash inside the rewrite must leave the prior scoring layer byte-identical'
    );
    assert.equal(
      countPriorTierRows(after_),
      PRIOR_TOTAL,
      'every surviving row must still carry tier:prior, proving it is the OLD layer and not a coincidentally-equal new one'
    );
  });

  it('a concurrent reader never observes an empty or partial scoring layer', async () => {
    const roomDir = await createSeededRoom();
    writeHsiFixture(roomDir);

    const readerPath = path.join(roomDir, 'child-reader.cjs');
    fs.writeFileSync(readerPath, [
      "'use strict';",
      "const { DatabaseSync } = require('node:sqlite');",
      'const dbPath = process.argv[2];',
      'let db;',
      'try {',
      "  db = new DatabaseSync(dbPath, { open: true, readOnly: true });",
      '} catch (e) {',
      "  process.send({ error: e.message });",
      '  process.exit(1);',
      '}',
      'const stmt = db.prepare(',
      '  "SELECT COUNT(*) AS cnt FROM edges WHERE type IN (\'HSI_CONNECTION\',\'REVERSE_SALIENT\')"',
      ');',
      "process.on('message', (m) => {",
      "  if (m === 'stop') {",
      '    try { db.close(); } catch (e) {}',
      '    process.exit(0);',
      '  }',
      '});',
      'setInterval(() => {',
      '  try {',
      '    process.send({ cnt: stmt.get().cnt });',
      '  } catch (e) {',
      '    /* parent gone */',
      '  }',
      '}, 15);',
      '',
    ].join('\n'));

    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    const reader = fork(readerPath, [dbPath], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });

    const samples = [];
    reader.on('message', (m) => {
      if (m && typeof m.cnt === 'number') samples.push(m.cnt);
      if (m && m.error) samples.push('ERROR: ' + m.error);
    });

    // Wait for the FIRST sample before the writer starts, so at least one
    // pre-rewrite observation is guaranteed to be in the record.
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('reader produced no sample within 10000 ms')), 10000);
      const tick = setInterval(() => {
        if (samples.length > 0) {
          clearInterval(tick);
          clearTimeout(t);
          resolve();
        }
      }, 5);
    });

    // Run the rewrite to a CLEAN exit on this leg (no kill).
    const writer = spawn(process.execPath, [REAL_SCRIPT, roomDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MINDRIAN_HSI_CRASH_TEST_DELAY_MS: '150' },
    });
    let writerErr = '';
    writer.stderr.on('data', (c) => { writerErr += String(c); });
    const writerResult = await awaitClose(writer);
    assert.equal(writerResult.code, 0, 'writer should exit 0. stderr: ' + writerErr);

    // Let the reader observe the committed state before stopping it.
    await new Promise((r) => setTimeout(r, 300));
    reader.send('stop');
    await new Promise((r) => reader.on('close', r));

    const bad = samples.filter((s) => s !== PRIOR_TOTAL && s !== POST_TOTAL);
    assert.deepStrictEqual(
      bad,
      [],
      'every sample must be exactly ' + PRIOR_TOTAL + ' or ' + POST_TOTAL +
      '. Offending samples: ' + JSON.stringify(bad) + ' (full series: ' + JSON.stringify(samples) + ')'
    );
    assert.ok(samples.length >= 5, 'expected at least 5 samples, got ' + samples.length);
    assert.ok(!samples.includes(0), 'a reader must NEVER observe 0 scoring edges: ' + JSON.stringify(samples));
    assert.ok(samples.includes(PRIOR_TOTAL), 'expected at least one pre-rewrite observation of ' + PRIOR_TOTAL);
    assert.equal(
      samples[samples.length - 1],
      POST_TOTAL,
      'the final observation must be the committed post-rewrite layer of ' + POST_TOTAL
    );
  });

  it('mutation proof: stripping BEGIN/COMMIT turns the crash gate red', async () => {
    const mutantDir = mkTemp('mindrian-242-mutant-');
    const mutantPath = buildMutantScript(mutantDir);

    const roomDir = await createSeededRoom();
    const prior = snapshotScoringEdges(roomDir);
    assert.equal(prior.length, PRIOR_TOTAL);

    writeHsiFixture(roomDir);

    const child = await spawnUntilSeam(mutantPath, roomDir, 150);
    child.kill('SIGKILL');
    const { signal } = await awaitClose(child);
    assert.equal(signal, 'SIGKILL', 'mutant child must have been signal-killed');

    const after_ = snapshotScoringEdges(roomDir);

    assert.notDeepStrictEqual(
      after_,
      prior,
      'stripping the BEGIN/COMMIT wrap FAILED to break the invariant, so the wrap in ' +
      'scripts/hsi-to-graph.cjs is not load-bearing and Legs A and B prove nothing'
    );
    assert.ok(
      countPriorTierRows(after_) < PRIOR_TOTAL,
      'without the transaction the crash must destroy part of the prior layer ' +
      '(that is the concrete shape of the bug MOAT-01 closes), but ' +
      countPriorTierRows(after_) + ' of ' + PRIOR_TOTAL + ' prior rows survived'
    );
  });
});
