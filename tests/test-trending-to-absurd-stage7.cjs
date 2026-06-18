'use strict';
// Phase 163-05 -- Stage 7 mitigation / innovation roadmap test suite (WAVE 5
// SURFACE-B). Stage 7 is the net-new output section the 7-stage Visionary
// Innovation Companion spec adds beyond explore-trends's 6 stages: each surfaced
// opportunity maps to a UDP / IDP / WDP problem type (the /mos:diagnose taxonomy)
// and gets a mitigation / innovation roadmap, filed as a nested artifact under
// opportunity-bank/ WITH an ICM Layer 0 ROOM.md per folder.
//
// Four behaviors:
//
//   Test 1: generateStage7Roadmap(roomDir, opportunities, opts) maps each
//           opportunity to a UDP / IDP / WDP problem type and returns a
//           structured roadmap { opportunity_id, problem_type, mitigation_steps,
//           innovation_steps }.
//   Test 2: it files the roadmap as a nested artifact under
//           room/opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/ WITH
//           a ROOM.md (ICM Layer 0), reusing the futures folder discipline. NO
//           write path escapes opportunity-bank/.
//   Test 3: a roadmap step that asserts a venture truth lands review_status
//           'proposed' (Part 9 role 5), never auto-confirmed.
//   Test 4: an empty opportunity set returns an empty roadmap without crashing
//           (defensive).
//
// Canon Part 8: zero Brain egress; pure LOCAL generation + file write.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). No SKIP.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const STAGE7_PATH = path.join(REPO_ROOT, 'lib', 'core', 'trending-to-absurd', 'stage7-roadmap.cjs');

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}
function checkAsync(label, fn) {
  return Promise.resolve()
    .then(() => { total += 1; return fn(); })
    .then(() => { pass += 1; console.log('  ok -', label); });
}

console.log('test-trending-to-absurd-stage7');

// ---------------------------------------------------------------------------
// Test 1: generateStage7Roadmap maps each opportunity to a UDP/IDP/WDP type and
// returns a structured roadmap (opportunity_id, problem_type, mitigation_steps,
// innovation_steps).
// ---------------------------------------------------------------------------
const t1 = checkAsync('Test 1 -- generateStage7Roadmap maps opportunities to UDP/IDP/WDP with mitigation + innovation steps', async () => {
  delete require.cache[require.resolve(STAGE7_PATH)];
  const stage7 = require(STAGE7_PATH);

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-163-05-t1-'));
  const opportunities = [
    { id: 'opp-1', label: 'Absurd autonomous biotech labs', domain: 'Biotech', confidence: 0.4, definition_clarity: 'low' },
    { id: 'opp-2', label: 'Quantum-everything markets', domain: 'Quantum', confidence: 0.8, definition_clarity: 'high' },
    { id: 'opp-3', label: 'Ambiguous synthetic-biology shift', domain: 'SynBio', confidence: 0.6 },
  ];

  const out = await stage7.generateStage7Roadmap(roomDir, opportunities, { seed: 'ai-everywhere' });

  assert.ok(out && Array.isArray(out.roadmap), 'returns a roadmap array');
  assert.equal(out.roadmap.length, 3, 'one roadmap entry per opportunity');

  const valid = new Set(['UDP', 'IDP', 'WDP']);
  for (const entry of out.roadmap) {
    assert.ok(typeof entry.opportunity_id === 'string' && entry.opportunity_id.length > 0, 'opportunity_id present');
    assert.ok(valid.has(entry.problem_type), 'problem_type is one of UDP / IDP / WDP: ' + entry.problem_type);
    assert.ok(Array.isArray(entry.mitigation_steps) && entry.mitigation_steps.length > 0, 'mitigation_steps non-empty');
    assert.ok(Array.isArray(entry.innovation_steps) && entry.innovation_steps.length > 0, 'innovation_steps non-empty');
    // Each step carries an evidence tier (Part 5).
    for (const s of entry.mitigation_steps.concat(entry.innovation_steps)) {
      assert.ok(typeof s.evidence_tier === 'string' && s.evidence_tier.length > 0, 'each step carries an evidence tier');
    }
  }

  // The clearly-defined high-confidence opportunity classifies WDP; the
  // low-clarity one classifies UDP; the unmarked mid one classifies IDP.
  const byId = Object.fromEntries(out.roadmap.map((e) => [e.opportunity_id, e]));
  assert.equal(byId['opp-1'].problem_type, 'UDP', 'low-clarity opportunity -> UDP');
  assert.equal(byId['opp-2'].problem_type, 'WDP', 'high-clarity high-confidence opportunity -> WDP');
  assert.equal(byId['opp-3'].problem_type, 'IDP', 'unmarked mid-confidence opportunity -> IDP');

  fs.rmSync(roomDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test 2: the roadmap files as a nested artifact under opportunity-bank/ WITH
// ROOM.md; no write escapes opportunity-bank/.
// ---------------------------------------------------------------------------
const t2 = checkAsync('Test 2 -- roadmap files as a nested artifact under opportunity-bank/ with ROOM.md (ICM Layer 0)', async () => {
  delete require.cache[require.resolve(STAGE7_PATH)];
  const stage7 = require(STAGE7_PATH);

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-163-05-t2-'));
  const opportunities = [
    { id: 'opp-1', label: 'Absurd autonomous labs', domain: 'Biotech', confidence: 0.5 },
  ];

  const out = await stage7.generateStage7Roadmap(roomDir, opportunities, { seed: 'ai-everywhere' });

  assert.ok(typeof out.roadmapDir === 'string' && out.roadmapDir.length > 0, 'roadmapDir returned');
  const oppBank = path.join(path.resolve(roomDir), 'opportunity-bank');
  assert.ok(out.roadmapDir.startsWith(oppBank + path.sep), 'roadmapDir is under opportunity-bank/ (exclusive ownership)');
  assert.ok(out.roadmapDir.indexOf('trending-to-absurd') !== -1, 'roadmapDir carries the trending-to-absurd prefix');
  assert.ok(out.roadmapDir.indexOf('stage7-roadmap') !== -1, 'roadmapDir is the stage7-roadmap nested folder');

  // ICM Layer 0: the roadmap folder carries a ROOM.md.
  assert.ok(fs.existsSync(path.join(out.roadmapDir, 'ROOM.md')), 'stage7-roadmap folder ROOM.md present');
  // The roadmap artifact .md was written.
  assert.ok(Array.isArray(out.filed) && out.filed.length >= 1, 'at least one roadmap artifact filed');
  for (const f of out.filed) {
    assert.ok(f.path.startsWith(oppBank + path.sep), 'every filed roadmap artifact lives under opportunity-bank/: ' + f.path);
    assert.ok(fs.existsSync(f.path), 'the roadmap artifact .md was written');
    assert.ok(fs.existsSync(path.join(path.dirname(f.path), 'ROOM.md')), 'ROOM.md beside each artifact (ICM Layer 0)');
  }

  // Nothing written outside opportunity-bank/.
  const topLevel = fs.readdirSync(path.resolve(roomDir));
  for (const entry of topLevel) {
    if (entry === 'opportunity-bank') continue;
    assert.fail('unexpected write outside opportunity-bank/: ' + entry);
  }

  fs.rmSync(roomDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test 3: a roadmap step that asserts a venture truth lands review_status
// 'proposed' (Part 9 role 5), never auto-confirmed.
// ---------------------------------------------------------------------------
const t3 = checkAsync('Test 3 -- venture-truth roadmap steps land proposed, never auto-confirmed (Part 9)', async () => {
  delete require.cache[require.resolve(STAGE7_PATH)];
  const stage7 = require(STAGE7_PATH);

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-163-05-t3-'));
  const opportunities = [
    { id: 'opp-1', label: 'Absurd autonomous labs', domain: 'Biotech', confidence: 0.5 },
  ];

  const out = await stage7.generateStage7Roadmap(roomDir, opportunities, { seed: 'ai-everywhere' });

  // Every step that asserts a venture truth carries review_status 'proposed'.
  let sawTruthClaim = false;
  for (const entry of out.roadmap) {
    for (const s of entry.mitigation_steps.concat(entry.innovation_steps)) {
      if (s.truth_claim === true) {
        sawTruthClaim = true;
        assert.equal(s.review_status, 'proposed', 'a venture-truth step is proposed, never confirmed');
      }
      // No step is ever auto-confirmed by the generator.
      assert.notEqual(s.review_status, 'confirmed', 'no roadmap step is auto-confirmed by the generator (Part 9 role 5)');
    }
  }
  assert.ok(sawTruthClaim, 'at least one step asserts a venture truth (and stays proposed)');

  // The on-disk roadmap .md also records review_status: proposed (never confirmed).
  const md = fs.readFileSync(out.filed[0].path, 'utf8');
  assert.ok(/review_status:\s*proposed/.test(md), 'the roadmap artifact records review_status: proposed');
  assert.equal(/review_status:\s*confirmed/.test(md), false, 'the roadmap artifact is never confirmed on disk');

  fs.rmSync(roomDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test 4: an empty opportunity set returns an empty roadmap without crashing.
// ---------------------------------------------------------------------------
const t4 = checkAsync('Test 4 -- empty opportunity set returns an empty roadmap (defensive, no crash)', async () => {
  delete require.cache[require.resolve(STAGE7_PATH)];
  const stage7 = require(STAGE7_PATH);

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-163-05-t4-'));

  const empty = await stage7.generateStage7Roadmap(roomDir, [], { seed: 'ai-everywhere' });
  assert.ok(empty && Array.isArray(empty.roadmap), 'returns a roadmap array on empty input');
  assert.equal(empty.roadmap.length, 0, 'empty roadmap on empty input');
  assert.ok(Array.isArray(empty.filed) && empty.filed.length === 0, 'nothing filed on empty input');

  // Also defensive on null / undefined / garbage.
  const nullish = await stage7.generateStage7Roadmap(roomDir, null, { seed: 'x' });
  assert.equal(nullish.roadmap.length, 0, 'null input -> empty roadmap, no crash');

  fs.rmSync(roomDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
Promise.all([t1, t2, t3, t4]).then(() => {
  console.log(`\nPASS (${pass}/${total})`);
  if (pass !== total) process.exit(1);
}).catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
