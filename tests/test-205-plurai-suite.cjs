'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-09 (scope item 9) -- test for the Plurai eval SUITE.
 * Asserts:
 *   (a) the suite declares ONE judge per reach/behavior with the three seeded
 *       thread ids and the CORRECTED label sets (DEVIATION 2);
 *   (b) the independent-judge assertion holds (judge_id !== driving_brain_id),
 *       and a same-id fixture proves the no-circularity guard throws;
 *   (c) loadGolden with the REAL source maps 5 misses -> No Connection and the
 *       2 should-have-said lines -> Hedged (+ the punchline quip -> Presumptuous);
 *   (d) loadGolden with the source ABSENT returns pending + zero uploads + zero
 *       fabricated records;
 *   (e) everything lives under lab/ (nothing added to lib/ or the shipped
 *       plugin/package manifest);
 *   (f) no user data in the manifest (Part 8: synthetic personas + generic doctrine).
 *
 * House rule: hyphens only, no em-dashes. CJS. Read-only, LOCAL (Part 8).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LAB_DIR = path.join(REPO_ROOT, 'lab', 'plurai-suite');
const GOLDEN_SOURCE = path.join(LAB_DIR, 'golden', 'test-6-source.md');

const judges = require(path.join(LAB_DIR, 'judges.cjs'));
const manifest = require(path.join(LAB_DIR, 'suite-manifest.cjs'));
const loader = require(path.join(LAB_DIR, 'golden-loader.cjs'));

let pass = 0;
function ok(label, fn) {
  fn();
  pass += 1;
  console.log(`  ok - ${label}`);
}

// ---------------------------------------------------------------------------
// (a) one judge per reach/behavior with the three seeded thread ids + corrected labels
// ---------------------------------------------------------------------------
console.log('(a) suite declares one judge per reach/behavior + corrected labels');

const EXPECTED_THREADS = {
  'horizontal-elevation': '392ec50f-282d-4956-adc6-1f03130e3bd8',
  'anti-circular': '127f8f53-2e72-48d8-a771-4ae9d51e5a00',
  'reach-gate': 'f989b4cf-9ef2-48ca-bb02-9dcd9dba3cc8',
};

ok('exactly three judges, one per reach/behavior', () => {
  assert.equal(judges.JUDGES.length, 3);
  const ids = judges.JUDGES.map((j) => j.id).sort();
  assert.deepEqual(ids, ['anti-circular', 'horizontal-elevation', 'reach-gate']);
});

ok('each judge carries its seeded thread id', () => {
  for (const j of judges.JUDGES) {
    assert.equal(j.thread_id, EXPECTED_THREADS[j.id], `thread id for ${j.id}`);
  }
});

ok('horizontal-elevation uses the CORRECTED ladder [No Connection / Hedged / Presumptuous]', () => {
  const h = judges.JUDGE_BY_ID['horizontal-elevation'];
  assert.deepEqual(h.labels, ['No Connection', 'Hedged', 'Presumptuous']);
  // NOT the mislabel "Confident"
  assert.ok(!h.labels.includes('Confident'), '"Confident" must be gone (DEVIATION 2)');
  assert.equal(h.primary, true, 'horizontal is Lawrence PRIMARY');
  // the correction is documented + a live re-seed is flagged
  assert.ok(h.corrected && h.corrected.was.includes('Confident'));
  assert.ok(h.corrected.now.includes('Presumptuous'));
  assert.equal(h.re_seed.required, true, 'live re-seed of thread 392ec50f is a flagged follow-up');
});

ok('anti-circular labels = [circular / progressing]', () => {
  assert.deepEqual(judges.JUDGE_BY_ID['anti-circular'].labels, ['circular', 'progressing']);
});

ok('reach-gate labels = [Correct / Wrong / Missed / Ambiguous] over the six frozen reaches + none', () => {
  const rg = judges.JUDGE_BY_ID['reach-gate'];
  assert.deepEqual(rg.labels, ['Correct', 'Wrong', 'Missed', 'Ambiguous']);
  assert.deepEqual(rg.scope.reach_ids, [
    'context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats', 'none',
  ]);
  assert.equal(rg.scope.gate, 'shape-f-188');
});

ok('the built suite exposes the three judge thread ids', () => {
  const suite = manifest.buildSuite();
  assert.deepEqual(
    suite.judge_ids.slice().sort(),
    Object.values(EXPECTED_THREADS).slice().sort()
  );
});

// ---------------------------------------------------------------------------
// (b) independent-judge assertion (no circularity)
// ---------------------------------------------------------------------------
console.log('(b) independent-judge rule: judge_id !== driving_brain_id');

ok('buildSuite passes with distinct driving_brain_id (real threads are independent)', () => {
  const suite = manifest.buildSuite();
  for (const j of suite.judges) {
    assert.notEqual(j.thread_id, suite.driving_brain_id);
  }
});

ok('no-circularity guard THROWS when a judge would grade its own driver (fixture)', () => {
  const circularDriver = EXPECTED_THREADS['horizontal-elevation'];
  assert.throws(
    () => manifest.buildSuite({ drivingBrainId: circularDriver }),
    /independent-judge guard VIOLATED/,
    'suite must fail closed when judge_id === driving_brain_id'
  );
  // the single-judge assertion also throws on the same-id fixture
  assert.throws(
    () => manifest.assertIndependentJudge(
      { id: 'x', thread_id: 'same' }, 'same'
    ),
    /independent-judge guard VIOLATED/
  );
});

// ---------------------------------------------------------------------------
// (c) loadGolden with the REAL source maps the anchor correctly
// ---------------------------------------------------------------------------
console.log('(c) loadGolden(real source) maps the ground-truth anchor');

ok('the real golden source file exists (the tether)', () => {
  assert.ok(fs.existsSync(GOLDEN_SOURCE), 'test-6-source.md must be staged');
});

ok('5 misses -> No Connection, 2 should-have-said -> Hedged, 1 quip -> Presumptuous', () => {
  const res = loader.loadGolden(GOLDEN_SOURCE);
  assert.equal(res.status, 'loaded');
  assert.equal(res.judge_id, EXPECTED_THREADS['horizontal-elevation']);
  assert.equal(res.records.length, 8, '5 + 2 + 1 = 8 real anchor records');
  assert.equal(res.counts['No Connection'], 5);
  assert.equal(res.counts['Hedged'], 2);
  assert.equal(res.counts['Presumptuous'], 1);
});

ok('every loaded record is REAL (source-anchored), never synthesized', () => {
  const res = loader.loadGolden(GOLDEN_SOURCE);
  for (const r of res.records) {
    assert.equal(r.source, 'real', `record ${r.id} must be real`);
    assert.equal(r.anchor, true);
    assert.ok(!r.generated, 'no loaded record may be flagged generated/synthetic');
    assert.ok(r.sample && r.sample.length > 0, 'record has a non-empty sample');
  }
});

ok('the parsed misses carry the Test-6 verbatim content (spot-check)', () => {
  const anchor = loader._parseAnchor(fs.readFileSync(GOLDEN_SOURCE, 'utf8'));
  assert.equal(anchor.misses.length, 5);
  assert.match(anchor.misses[0].title, /three topics are one thesis/i);
  assert.equal(anchor.shoulds.length, 2);
  assert.match(anchor.shoulds[0], /one argument from three angles/i);
  assert.match(anchor.quip, /punchline/i);
});

// ---------------------------------------------------------------------------
// (d) loadGolden with the source ABSENT: pending + zero uploads + zero fabricated
// ---------------------------------------------------------------------------
console.log('(d) loadGolden(absent) refuses to fabricate');

ok('absent source -> pending, zero records, zero uploads, zero fabricated', () => {
  const res = loader.loadGolden(path.join(LAB_DIR, 'golden', '__does_not_exist__.md'));
  assert.equal(res.status, 'pending');
  assert.equal(res.records.length, 0);
  assert.equal(res.uploads, 0);
  assert.equal(res.uploaded, false);
  assert.equal(res.fabricated, 0);
  assert.match(res.reason, /refusing to fabricate/i);
});

ok('null source path -> pending, nothing synthesized', () => {
  const res = loader.loadGolden(null);
  assert.equal(res.status, 'pending');
  assert.equal(res.fabricated, 0);
  assert.equal(res.uploads, 0);
});

ok('synthetic-coverage seam is OFF by default and generates nothing', () => {
  const off = loader.generateSyntheticCoverage();
  assert.equal(off.fired, false);
  assert.equal(off.generated, 0);
  assert.equal(off.records.length, 0);
  // even enabled, with no live client bound, it stays pending (not fired)
  const noClient = loader.generateSyntheticCoverage({ enabled: true });
  assert.equal(noClient.fired, false);
  assert.equal(noClient.generated, 0);
});

ok('Optimize LLM/SLM decision is a PENDING seam (not hard-coded)', () => {
  assert.equal(loader.OPTIMIZE_MODE, 'pending');
});

// ---------------------------------------------------------------------------
// (e) lab-side only: nothing added to lib/ or the shipped plugin/package manifest
// ---------------------------------------------------------------------------
console.log('(e) lab-side only (no lib/ or shipped-manifest leak)');

ok('all three source modules live under lab/plurai-suite/', () => {
  for (const f of ['judges.cjs', 'suite-manifest.cjs', 'golden-loader.cjs']) {
    const p = path.join(LAB_DIR, f);
    assert.ok(fs.existsSync(p), `${f} under lab/`);
    assert.ok(!p.includes(`${path.sep}lib${path.sep}`), `${f} must not be under lib/`);
  }
});

ok('git-tracked changes for this plan touch lab/ + tests/ only (no lib/, plugin.json, package.json)', () => {
  let changed = '';
  try {
    // untracked + tracked changes in the worktree, name-only
    const tracked = execSync('git diff --name-only HEAD', { cwd: REPO_ROOT }).toString();
    const staged = execSync('git diff --name-only --cached', { cwd: REPO_ROOT }).toString();
    const untracked = execSync('git ls-files --others --exclude-standard', { cwd: REPO_ROOT }).toString();
    changed = `${tracked}\n${staged}\n${untracked}`;
  } catch (e) {
    // if git is unavailable, skip this guard rather than false-fail
    console.log('    (git unavailable; skipping tracked-path guard)');
    return;
  }
  const lines = changed.split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((f) => f !== 'node_modules' && !f.startsWith('node_modules/'))
    .filter((f) => !f.startsWith('.planning/')); // planning docs are gitignored / summary
  for (const f of lines) {
    const isAllowed = f.startsWith('lab/') || f.startsWith('tests/');
    assert.ok(isAllowed, `changed path "${f}" must be under lab/ or tests/ only (no lib/ or shipped manifest)`);
    assert.ok(f !== 'plugin.json' && !f.endsWith('/plugin.json'), 'plugin.json must be untouched');
    assert.ok(f !== 'package.json' && !f.endsWith('/package.json'), 'package.json must be untouched');
    assert.ok(!f.includes('.claude-plugin/'), 'the shipped plugin manifest must be untouched');
  }
});

// ---------------------------------------------------------------------------
// (f) Part 8: no user data in the manifest (synthetic personas + generic doctrine)
// ---------------------------------------------------------------------------
console.log('(f) Part 8: no user data (synthetic personas + generic doctrine only)');

ok('manifest flags itself lab-side, not shipped, Part-8 clean', () => {
  const suite = manifest.buildSuite();
  assert.equal(suite.lab_side, true);
  assert.equal(suite.shipped_to_user_machine, false);
  assert.equal(suite.part8.user_data, false);
  assert.equal(suite.part8.synthetic_personas, true);
  assert.equal(suite.part8.generic_doctrine_only, true);
  assert.equal(suite.evals_mcp.live_mutation_fired, false, 'no live evals-MCP mutation is fired');
});

ok('every persona is synthetic (invented), no real tester name/email present', () => {
  const suite = manifest.buildSuite();
  assert.ok(suite.personas.length >= 1);
  const blob = JSON.stringify(suite.personas).toLowerCase();
  for (const p of suite.personas) {
    assert.ok(/^synthetic-/.test(p.id), `persona ${p.id} must be marked synthetic`);
  }
  // Part-8 negative guard: no real tester identifiers leak into the manifest
  for (const needle of ['aronhime', 'jsagir@gmail.com', 'jhu.edu', 'mordi', 'eli', 'gaurav']) {
    assert.ok(!blob.includes(needle), `manifest must not carry user identifier "${needle}"`);
  }
});

ok('the live re-seed follow-up is surfaced (navigator task, not this build)', () => {
  const reqs = manifest.reSeedRequirements();
  assert.equal(reqs.length, 1, 'exactly the horizontal judge needs a re-seed');
  assert.equal(reqs[0].judge_id, 'horizontal-elevation');
  assert.deepEqual(reqs[0].labels, ['No Connection', 'Hedged', 'Presumptuous']);
});

console.log(`\nPASS - ${pass} assertions green (205-09 Plurai suite).`);
