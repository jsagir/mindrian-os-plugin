'use strict';

/**
 * Phase 80-06 Task 2 -- smoke-test.cjs tests.
 *
 * Uses compute-state fallback by default (mindrian-tools is blocked by the
 * lazygraph-ops PRECONDITIONS issue).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { runMosSmokeTest, renderSmokeTestSection, parseSectionCounts } = require('./smoke-test.cjs');

function tmpRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-' + prefix + '-' + crypto.randomBytes(4).toString('hex') + '-'));
  fs.writeFileSync(path.join(dir, 'STATE.md'), '---\nstatus: executing\n---\n\n# Room\n');
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* soft */ }
}

function writeArtifact(roomDir, relPath, body) {
  const abs = path.join(roomDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body || '---\ntitle: x\n---\n\n# x\n');
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    process.stdout.write('ok ' + name + '\n');
    passed++;
  } catch (e) {
    process.stderr.write('FAIL ' + name + '\n  ' + (e.stack || e.message) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1: happy path -- populated problem-definition passes
// ---------------------------------------------------------------------------
test('Test 1: runMosSmokeTest passes on populated room', function () {
  const room = tmpRoom('happy');
  try {
    writeArtifact(room, 'problem-definition/onboarding.md');
    writeArtifact(room, 'problem-definition/pricing.md');
    const r = runMosSmokeTest(room);
    assert.equal(typeof r, 'object');
    assert.equal(typeof r.passed, 'boolean');
    assert.ok(r.method, 'method set (got ' + r.method + ')');
    assert.ok((r.sectionCounts['problem-definition'] || 0) >= 1, 'problem-definition counted (got ' + r.sectionCounts['problem-definition'] + ')');
    assert.equal(r.passed, true, 'passed=true when canonical section populated');
  } finally { cleanup(room); }
});

// ---------------------------------------------------------------------------
// Test 2: empty room -- warning + passed false
// ---------------------------------------------------------------------------
test('Test 2: empty room returns passed=false with warning', function () {
  const room = tmpRoom('empty');
  try {
    const r = runMosSmokeTest(room);
    assert.equal(r.passed, false, 'empty room passed=false');
    assert.ok(r.warnings.some(function (w) { return /no populated canonical sections/.test(w); }), 'warning present (got: ' + JSON.stringify(r.warnings) + ')');
  } finally { cleanup(room); }
});

// ---------------------------------------------------------------------------
// Test 3: team count via filesystem walk
// ---------------------------------------------------------------------------
test('Test 3: team count picked up via filesystem walk', function () {
  const room = tmpRoom('team');
  try {
    writeArtifact(room, 'team/core-team/jane-doe/jane-doe.md');
    writeArtifact(room, 'team/core-team/jane-doe/ROOM.md', '# ROOM\n');
    const r = runMosSmokeTest(room);
    assert.ok((r.sectionCounts.team || 0) >= 1, 'team >= 1 (got ' + r.sectionCounts.team + ')');
  } finally { cleanup(room); }
});

// ---------------------------------------------------------------------------
// Test 4: forceFallback path
// ---------------------------------------------------------------------------
test('Test 4: forceFallback reaches compute-state and returns result', function () {
  const room = tmpRoom('fb');
  try {
    writeArtifact(room, 'solution-design/arch.md');
    const r = runMosSmokeTest(room, { forceFallback: true });
    assert.equal(r.method, 'compute-state', 'method=compute-state (got ' + r.method + ')');
    assert.ok((r.sectionCounts['solution-design'] || 0) >= 1, 'solution-design counted');
    assert.equal(r.passed, true);
  } finally { cleanup(room); }
});

// ---------------------------------------------------------------------------
// Test 5: renderSmokeTestSection emits the required heading
// ---------------------------------------------------------------------------
test('Test 5: renderSmokeTestSection contains "/mos: Usability Check" heading', function () {
  const md = renderSmokeTestSection({ passed: true, method: 'compute-state', sectionCounts: { 'problem-definition': 3 }, warnings: [] });
  assert.match(md, /## \/mos: Usability Check/, 'heading present');
  assert.match(md, /problem-definition: 3/, 'section count rendered');
});

// ---------------------------------------------------------------------------
// Test 6: parseSectionCounts handles compute-state table fragment
// ---------------------------------------------------------------------------
test('Test 6: parseSectionCounts parses a compute-state-style table', function () {
  const sample = [
    '# Data Room State',
    '',
    '## Sections',
    '| Section | Entries | Progress | Status | Last Updated |',
    '|---------|---------|----------|--------|-------------|',
    '| problem-definition | 3 | [bar] | Well-developed | 2026-04-13 |',
    '| inbox | 1 | [bar] | Active | 2026-04-13 |',
    '',
    '## Gaps',
    '- nothing'
  ].join('\n');
  const counts = parseSectionCounts(sample);
  assert.equal(counts['problem-definition'], 3);
  assert.equal(counts['inbox'], 1);
});

// ---------------------------------------------------------------------------
// Test 7: no em-dashes
// ---------------------------------------------------------------------------
test('Test 7: smoke-test.cjs and smoke-test.test.cjs contain no em-dashes', function () {
  const emDash = '\u2014';
  const mod = fs.readFileSync(path.join(__dirname, 'smoke-test.cjs'), 'utf8');
  const tst = fs.readFileSync(__filename, 'utf8');
  assert.equal(mod.indexOf(emDash), -1);
  assert.equal(tst.indexOf(emDash), -1);
});

// ---------------------------------------------------------------------------
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('all passing\n');
