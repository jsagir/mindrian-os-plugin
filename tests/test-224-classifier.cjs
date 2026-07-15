'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 224-01 Task 2 -- D-01 classifier + pair builders + fixture proof.
 * ======================================================================
 * Behaviors 1-4 run with INJECTED deterministic scoreFn/encodeFn (CI-safe, no
 * model download). Behavior 5 is the real-encoder self-skipping leg: it probes
 * the encoder with a tiny scoreMeasured call and prints SKIP + exits 0 when
 * semantic is null.
 *
 *   1. classifyScore over a 0.0..1.0 sweep only ever returns CONVERGES / INFORMS
 *      / null; CONTRADICTS / INVALIDATES / REFINES / ROOT_CAUSES can NEVER emit.
 *   2. scoreBasedDeriveFn: above-CONVERGES -> one CONVERGES (pair order);
 *      mid-band -> one INFORMS source=OLDER target=NEWER; below-floor -> [].
 *   3. scoreBasedDeriveFn -> [] on semantic null / warning encoder_unavailable.
 *   4. buildNewArtifactPairs (N existing + new) -> exactly N pairs (never self);
 *      buildAllPairs on 5 artifacts -> 10 unique pairs; the fixture has 0
 *      cascade-family edges after build.
 *   5. real-encoder leg: related pair -> CONVERGES or INFORMS, unrelated -> null;
 *      SKIP + exit 0 when the encoder is unavailable.
 *
 * ALSO: `node tests/test-224-classifier.cjs --calibrate` runs scoreMeasured over
 * the fixture (real encoder) and prints observed semantic values -- the D-01
 * calibration evidence recorded in the classifier module header.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const classifier = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
const { scoreMeasured } = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-differential-scorer.cjs'));

const CASCADE_FAMILY = ['CONTRADICTS', 'CONVERGES', 'INFORMS', 'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES'];

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('  ok - ' + name); });
}

// ---- --calibrate mode -----------------------------------------------------
async function runCalibrate() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'calib-224-'));
  try {
    const fx = await buildFixtureRoom224(tmp);
    const read = (p) => fs.readFileSync(p, 'utf8');
    const relA = read(fx.relatedPair.a);
    const relB = read(fx.relatedPair.b);
    const unrel = fx.allFiles.filter((f) => !f.includes('mealkit')).map(read);

    const rel = await scoreMeasured(relA, relB, {});
    console.log('RELATED pair semantic =', rel.semantic, 'band =', rel.band);

    const noise = [];
    for (let i = 0; i < unrel.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const s = await scoreMeasured(relA, unrel[i], {});
      noise.push(s.semantic);
    }
    for (let i = 0; i < unrel.length; i += 1) {
      for (let j = i + 1; j < unrel.length; j += 1) {
        // eslint-disable-next-line no-await-in-loop
        const s = await scoreMeasured(unrel[i], unrel[j], {});
        noise.push(s.semantic);
      }
    }
    noise.sort((a, b) => a - b);
    const mean = noise.reduce((a, b) => a + b, 0) / noise.length;
    console.log('NOISE n=' + noise.length,
      'min=' + noise[0].toFixed(4),
      'mean=' + mean.toFixed(4),
      'max=' + noise[noise.length - 1].toFixed(4));
    console.log('top-8 noise:', noise.slice(-8).reverse().map((x) => x.toFixed(4)).join(', '));
    console.log('resolved floors:', JSON.stringify(classifier._test.resolveFloors()));
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// ---- behaviors 1-4 (injected, CI-safe) ------------------------------------
async function runBehaviors1to4() {
  await check('(1) classifyScore over a 0.0..1.0 sweep only ever returns CONVERGES / INFORMS / null', () => {
    const seen = new Set();
    for (let s = 0; s <= 1.0000001; s += 0.05) {
      const sem = Math.round(s * 100) / 100;
      const res = classifier.classifyScore({ semantic: sem });
      if (res === null) { seen.add('null'); continue; }
      assert.ok(res && typeof res === 'object', 'non-null result must be an object at semantic ' + sem);
      seen.add(res.edge_type);
    }
    const forbidden = ['CONTRADICTS', 'INVALIDATES', 'REFINES', 'ROOT_CAUSES'];
    for (const f of forbidden) {
      assert.ok(!seen.has(f), 'classifyScore must NEVER emit ' + f + ' (D-01 structural exclusion)');
    }
    // Only the allowed labels (+ null) may appear.
    for (const label of seen) {
      assert.ok(['CONVERGES', 'INFORMS', 'null'].includes(label), 'unexpected label emitted: ' + label);
    }
    assert.ok(seen.has('CONVERGES'), 'high band must emit CONVERGES somewhere in the sweep');
    assert.ok(seen.has('INFORMS'), 'moderate band must emit INFORMS somewhere in the sweep');
    assert.ok(seen.has('null'), 'low band must emit null somewhere in the sweep');
  });

  const floors = classifier._test.resolveFloors();
  const aboveConverges = Math.min(1, floors.converges + 0.1);
  const midBand = (floors.converges + floors.informs) / 2;
  const belowFloor = Math.max(0, floors.informs - 0.2);

  await check('(2) scoreBasedDeriveFn: above-CONVERGES / mid-INFORMS(older->newer) / below-floor', async () => {
    // a is NEWER (mtime 2000), b is OLDER (mtime 1000).
    const pairNewerA = { a: { id: 'art:newA', text: 'x', mtimeMs: 2000 }, b: { id: 'art:oldB', text: 'y', mtimeMs: 1000 } };

    const conv = await classifier.scoreBasedDeriveFn(
      { artifactPair: pairNewerA },
      { scoreFn: () => ({ semantic: aboveConverges }) }
    );
    assert.strictEqual(conv.length, 1, 'above-CONVERGES must emit exactly one candidate');
    assert.strictEqual(conv[0].edge_type, 'CONVERGES', 'must be CONVERGES');
    assert.strictEqual(conv[0].source, 'art:newA', 'CONVERGES keeps pair order (source = a)');
    assert.strictEqual(conv[0].target, 'art:oldB', 'CONVERGES keeps pair order (target = b)');
    assert.strictEqual(conv[0].reason, classifier._test.REASON_CONVERGES, 'CONVERGES reason scalar');

    const inf = await classifier.scoreBasedDeriveFn(
      { artifactPair: pairNewerA },
      { scoreFn: () => ({ semantic: midBand }) }
    );
    assert.strictEqual(inf.length, 1, 'mid-band must emit exactly one candidate');
    assert.strictEqual(inf[0].edge_type, 'INFORMS', 'must be INFORMS');
    // b is OLDER (mtime 1000) so it must be the source; a NEWER is the target.
    assert.strictEqual(inf[0].source, 'art:oldB', 'INFORMS source must be the OLDER artifact');
    assert.strictEqual(inf[0].target, 'art:newA', 'INFORMS target must be the NEWER artifact');
    assert.strictEqual(inf[0].reason, classifier._test.REASON_INFORMS, 'INFORMS reason scalar');

    const below = await classifier.scoreBasedDeriveFn(
      { artifactPair: pairNewerA },
      { scoreFn: () => ({ semantic: belowFloor }) }
    );
    assert.strictEqual(below.length, 0, 'below-floor must emit nothing');
  });

  await check('(3) scoreBasedDeriveFn returns [] on semantic null / warning encoder_unavailable', async () => {
    const pair = { a: { id: 'a', text: 'x', mtimeMs: 1 }, b: { id: 'b', text: 'y', mtimeMs: 2 } };
    const r1 = await classifier.scoreBasedDeriveFn({ artifactPair: pair }, { scoreFn: () => ({ semantic: null, warning: 'encoder_unavailable' }) });
    assert.strictEqual(r1.length, 0, 'semantic null must derive nothing (D-04 upstream silence)');
    const r2 = await classifier.scoreBasedDeriveFn({ artifactPair: pair }, { scoreFn: () => ({ semantic: 0.99, warning: 'encoder_unavailable' }) });
    assert.strictEqual(r2.length, 0, 'warning encoder_unavailable must derive nothing even with a high semantic');
    // degenerate pairs
    assert.strictEqual((await classifier.scoreBasedDeriveFn({}, {})).length, 0, 'missing artifactPair -> []');
    assert.strictEqual((await classifier.scoreBasedDeriveFn({ artifactPair: { a: { id: 'x' } } }, {})).length, 0, 'half pair -> []');
  });

  await check('(4) pair builders: N pairs (new-vs-existing), N-choose-2 (all), 0 cascade edges on the fixture', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pairs-224-'));
    try {
      // artifactCount 5 -> 5 md artifacts (2 related + 3 unrelated) + ROOM.md scaffold.
      const fx = await buildFixtureRoom224(tmp, { artifactCount: 5 });

      const all = classifier.buildAllPairs(fx.roomDir);
      assert.strictEqual(all.length, 10, 'buildAllPairs on 5 artifacts must be 5-choose-2 = 10, got ' + all.length);
      // uniqueness + older-first ordering
      const seenKeys = new Set();
      for (const p of all) {
        const key = p.a.id + '|' + p.b.id;
        assert.ok(!seenKeys.has(key), 'buildAllPairs must have no duplicate pair ' + key);
        seenKeys.add(key);
        assert.ok(Number(p.a.mtimeMs) <= Number(p.b.mtimeMs), 'buildAllPairs a must be the older artifact');
      }

      // Add a NEW file and pair it against the 5 existing.
      const newFile = path.join(fx.roomDir, 'new-artifact.md');
      fs.writeFileSync(newFile, '# new artifact\n\nA freshly written artifact for the per-write pair builder.\n', 'utf8');
      const nPairs = classifier.buildNewArtifactPairs(fx.roomDir, newFile);
      assert.strictEqual(nPairs.length, 5, 'buildNewArtifactPairs (5 existing + new) must be 5 pairs, got ' + nPairs.length);
      const newId = classifier._test.artifactId(fx.roomDir, newFile);
      for (const p of nPairs) {
        assert.strictEqual(p.a.id, newId, 'every pair a must be the new artifact');
        assert.notStrictEqual(p.b.id, newId, 'the new artifact must never be paired with itself');
      }

      // The fixture starts at 0 cascade-family typed edges.
      const raw = new DatabaseSync('file:' + fx.dbPath + '?mode=ro');
      try {
        const placeholders = CASCADE_FAMILY.map(() => '?').join(', ');
        const row = raw.prepare('SELECT COUNT(*) AS c FROM edges WHERE type IN (' + placeholders + ')').get(...CASCADE_FAMILY);
        assert.strictEqual(row.c, 0, 'the fixture must start with 0 cascade-family edges, got ' + row.c);
      } finally {
        raw.close();
      }
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });
}

// ---- behavior 5 (real encoder, self-skipping) -----------------------------
async function runBehavior5() {
  // Probe the encoder cheaply first.
  let probe;
  try {
    probe = await scoreMeasured('alpha beta gamma delta', 'epsilon zeta eta theta', {});
  } catch (_e) {
    probe = { semantic: null };
  }
  if (!probe || probe.semantic === null || probe.semantic === undefined) {
    console.log('  SKIP - (5) real-encoder leg: local encoder unavailable (semantic null)');
    return;
  }
  await check('(5) real encoder: related pair classifies CONVERGES/INFORMS, unrelated classifies null', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'real-224-'));
    try {
      const fx = await buildFixtureRoom224(tmp, { artifactCount: 6 });
      const read = (p) => fs.readFileSync(p, 'utf8');
      const relText = { a: read(fx.relatedPair.a), b: read(fx.relatedPair.b) };
      const unrelText = { a: read(fx.unrelatedPair.a), b: read(fx.unrelatedPair.b) };

      const relScore = await scoreMeasured(relText.a, relText.b, {});
      const relClass = classifier.classifyScore(relScore);
      assert.ok(relClass && (relClass.edge_type === 'CONVERGES' || relClass.edge_type === 'INFORMS'),
        'the related pair must classify CONVERGES or INFORMS, got ' + JSON.stringify(relClass)
        + ' (semantic ' + relScore.semantic + ')');

      const unrelScore = await scoreMeasured(unrelText.a, unrelText.b, {});
      const unrelClass = classifier.classifyScore(unrelScore);
      assert.strictEqual(unrelClass, null,
        'the unrelated pair must classify null, got ' + JSON.stringify(unrelClass)
        + ' (semantic ' + unrelScore.semantic + ')');
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });
}

(async () => {
  if (process.argv.includes('--calibrate')) {
    console.log('test-224-classifier.cjs --calibrate (real encoder over the b2-journey fixture)');
    await runCalibrate();
    return;
  }
  console.log('test-224-classifier.cjs: D-01 classifier + pair builders + fixture');
  await runBehaviors1to4();
  await runBehavior5();
  console.log('');
  console.log('PASS test-224-classifier.cjs (' + passed + ' checks)');
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
