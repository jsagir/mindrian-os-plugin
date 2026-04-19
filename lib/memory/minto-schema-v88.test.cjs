#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-00: Feynman-MINTO frontmatter schema v88 tests.
 *
 * Covers:
 *   Test 1: generator --write emits last_generated_at matching ISO-8601
 *   Test 2: generator --write preserves last_artifact_write_seen_at on regen
 *   Test 3: generator --write preserves decision_log array byte-for-byte on regen
 *   Test 4: new narrative JSON advances last_generated_at while decision_log stays
 *   Test 5: narrative-schema accepts structural payload WITHOUT new fields
 *   Test 6: narrative-schema accepts structural payload WITH new fields, bounded
 *   Test 7: validator rejects decision_log entry missing session_id or wrong user_response
 *
 * Node built-in assert only. Uses fs.mkdtempSync fixtures with process.on('exit')
 * cleanup so git status stays clean.
 *
 * Runs standalone or via lib/memory/run-feynman-tests.cjs.
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  validateStructural,
  validateDecisionLogEntry,
} = require('./narrative-schema.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATOR = path.join(
  REPO_ROOT,
  'scripts',
  'vault-section-minto-generator.cjs'
);

// ---------- Fixture workspace ----------

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'minto-schema-v88-'));
process.on('exit', function cleanup() {
  try {
    fs.rmSync(WORK, { recursive: true, force: true });
  } catch (_) {
    /* best effort */
  }
});

function buildRoom(roomName, sectionName, artifactCount) {
  const roomDir = path.join(WORK, roomName);
  const sectionDir = path.join(roomDir, sectionName);
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# ' + roomName + '\n');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
  fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '# section\n');
  for (let i = 0; i < artifactCount; i++) {
    const artDir = path.join(sectionDir, 'artifact-' + (i + 1));
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(
      path.join(artDir, 'artifact-' + (i + 1) + '.md'),
      '---\ntype: artifact\n---\n\nArtifact body ' + (i + 1) + ' content line.\n'
    );
  }
  return { roomDir: roomDir, sectionDir: sectionDir, sectionName: sectionName };
}

function writeNarrativeFile(payload) {
  const p = path.join(WORK, 'narrative-' + Date.now() + '-' + Math.random() + '.json');
  fs.writeFileSync(p, JSON.stringify(payload));
  return p;
}

function validNarrative(sectionName) {
  return {
    section: sectionName,
    essence:
      'Irreducible truth about ' +
      sectionName +
      ' lives here as one compressed sentence.',
    plain_language:
      'The elevator version: this section packages its artifacts into an argument that a reader can understand in one read.',
    governing_thought:
      'The ' +
      sectionName +
      ' argument holds because the artifacts align on a single defensible claim.',
    mental_model: {
      analogy: 'It is like stacking boxes into a clean tower.',
      mapping:
        'Each artifact is a box. Each claim is the shape at the top. The stack is the argument.',
      limits: 'Unlike real boxes, claims can be re-ordered without losing mass.',
    },
    sweet_spot:
      'Readers should leave with the compressed idea that the artifacts agree, the top sits on the bottom, and nothing dangles outside the pyramid.',
    key_claims: [
      'Every artifact in this section is a checkable claim.',
      'The claims support a single governing thought.',
      'The pyramid is tight enough to pass MECE inspection.',
    ],
  };
}

function runWrite(roomDir, sectionName, narrativePath) {
  const env = Object.assign({}, process.env);
  // We do NOT freeze timestamp here; tests want to see live advance.
  delete env.MINTO_FROZEN_TIMESTAMP;
  env.MINTO_FROZEN_DATE = '2026-04-14';
  const res = spawnSync(
    process.execPath,
    [
      GENERATOR,
      roomDir,
      '--write',
      '--section',
      sectionName,
      '--narrative',
      narrativePath,
    ],
    { encoding: 'utf-8', env: env }
  );
  assert.strictEqual(
    res.status,
    0,
    'generator --write failed: ' + res.stderr
  );
  return res;
}

function readMinto(sectionDir) {
  return fs.readFileSync(path.join(sectionDir, 'MINTO.md'), 'utf-8');
}

function extractFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) throw new Error('no frontmatter');
  return m[1];
}

function getScalar(fm, key) {
  const re = new RegExp('^' + key + ':\\s*(.*)$', 'm');
  const m = fm.match(re);
  if (!m) return undefined;
  let v = m[1].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// ---------- Tests ----------

let pass = 0;
let fail = 0;

function t(name, fn) {
  try {
    fn();
    pass += 1;
    process.stdout.write('  OK ' + name + '\n');
  } catch (e) {
    fail += 1;
    process.stderr.write('  FAIL ' + name + ': ' + e.message + '\n');
    if (e.stack) process.stderr.write(e.stack.split('\n').slice(0, 6).join('\n') + '\n');
  }
}

// Test 1: last_generated_at ISO on --write
t('Test 1: --write emits last_generated_at matching ISO-8601', function () {
  const fx = buildRoom('room-t1', 'problem-definition', 3);
  const np = writeNarrativeFile(validNarrative('problem-definition'));
  runWrite(fx.roomDir, fx.sectionName, np);
  const md = readMinto(fx.sectionDir);
  const fm = extractFrontmatter(md);
  const lga = getScalar(fm, 'last_generated_at');
  assert.ok(lga, 'last_generated_at missing from frontmatter');
  assert.ok(
    ISO_RE.test(lga),
    'last_generated_at does not match ISO-8601: ' + lga
  );
});

// Test 2: --write preserves last_artifact_write_seen_at
t('Test 2: --write preserves last_artifact_write_seen_at across regens', function () {
  const fx = buildRoom('room-t2', 'market-analysis', 3);
  const np = writeNarrativeFile(validNarrative('market-analysis'));
  runWrite(fx.roomDir, fx.sectionName, np);
  // Simulate post-write hook: inject a known value into the file.
  const mintoPath = path.join(fx.sectionDir, 'MINTO.md');
  let md = fs.readFileSync(mintoPath, 'utf-8');
  const knownValue = '2026-04-18T12:34:56Z';
  md = md.replace(
    /last_artifact_write_seen_at:.*\n/,
    'last_artifact_write_seen_at: "' + knownValue + '"\n'
  );
  fs.writeFileSync(mintoPath, md);

  // Regen.
  runWrite(fx.roomDir, fx.sectionName, np);
  const after = readMinto(fx.sectionDir);
  const fm = extractFrontmatter(after);
  const preserved = getScalar(fm, 'last_artifact_write_seen_at');
  assert.strictEqual(
    preserved,
    knownValue,
    'last_artifact_write_seen_at not preserved: got ' + preserved
  );
});

// Test 3: --write preserves decision_log array byte-for-byte
t('Test 3: --write preserves decision_log across regen', function () {
  const fx = buildRoom('room-t3', 'solution-design', 3);
  const np = writeNarrativeFile(validNarrative('solution-design'));
  runWrite(fx.roomDir, fx.sectionName, np);
  const mintoPath = path.join(fx.sectionDir, 'MINTO.md');
  let md = fs.readFileSync(mintoPath, 'utf-8');

  // Inject a decision_log block in the frontmatter.
  const inject = [
    'decision_log:',
    '  - session_id: "sess-2026-04-17-abc"',
    '    timestamp: "2026-04-17T14:23:00Z"',
    '    action: "flag_tam_staleness"',
    '    user_response: "defer"',
    '    reason: "Jonathan deferred benchmark refresh Q3"',
    '    outcome: "suppressed"',
    '',
  ].join('\n');
  md = md.replace(/decision_log:\s*\[\]\n/, inject);
  fs.writeFileSync(mintoPath, md);

  // Regenerate.
  runWrite(fx.roomDir, fx.sectionName, np);
  const after = fs.readFileSync(mintoPath, 'utf-8');
  const fm = extractFrontmatter(after);
  // The preserved block must still contain every original line.
  const requiredLines = [
    'session_id: "sess-2026-04-17-abc"',
    'timestamp: "2026-04-17T14:23:00Z"',
    'action: "flag_tam_staleness"',
    'user_response: "defer"',
    'reason: "Jonathan deferred benchmark refresh Q3"',
    'outcome: "suppressed"',
  ];
  for (const line of requiredLines) {
    assert.ok(
      fm.indexOf(line) !== -1,
      'decision_log lost line: ' + line + '\n---\n' + fm
    );
  }
});

// Test 4: New narrative advances last_generated_at while decision_log stable
t('Test 4: new narrative advances timestamp, keeps decision_log', function () {
  const fx = buildRoom('room-t4', 'business-model', 3);
  const np1 = writeNarrativeFile(validNarrative('business-model'));
  runWrite(fx.roomDir, fx.sectionName, np1);
  const mintoPath = path.join(fx.sectionDir, 'MINTO.md');
  let md = fs.readFileSync(mintoPath, 'utf-8');

  // Inject decision_log.
  const inject = [
    'decision_log:',
    '  - session_id: "sess-alpha"',
    '    timestamp: "2026-04-10T10:00:00Z"',
    '    action: "accept_metric"',
    '    user_response: "approve"',
    '    reason: "Passes acceptance"',
    '',
  ].join('\n');
  md = md.replace(/decision_log:\s*\[\]\n/, inject);
  fs.writeFileSync(mintoPath, md);

  const before = readMinto(fx.sectionDir);
  const lgaBefore = getScalar(extractFrontmatter(before), 'last_generated_at');

  // Wait briefly so new timestamp is strictly greater (resolution = sec).
  const start = Date.now();
  while (Date.now() - start < 1100) {
    /* spin */
  }

  // Second write with a new narrative (change essence).
  const n2 = validNarrative('business-model');
  n2.essence = 'Second pass refines the irreducible claim for this section.';
  const np2 = writeNarrativeFile(n2);
  runWrite(fx.roomDir, fx.sectionName, np2);
  const after = readMinto(fx.sectionDir);
  const lgaAfter = getScalar(extractFrontmatter(after), 'last_generated_at');

  assert.ok(
    Date.parse(lgaAfter) > Date.parse(lgaBefore),
    'last_generated_at did not advance: before=' +
      lgaBefore +
      ' after=' +
      lgaAfter
  );
  // decision_log preserved.
  const fmAfter = extractFrontmatter(after);
  assert.ok(
    fmAfter.indexOf('session_id: "sess-alpha"') !== -1,
    'decision_log lost after second write'
  );
});

// Test 5: structural validator accepts payload WITHOUT new fields (backcompat)
t('Test 5: validateStructural accepts pre-v88 payload (no new fields)', function () {
  const payload = {
    schema_version: '1',
    governing_thought: 'A non-empty governing thought for back-compat.',
  };
  const r = validateStructural(payload);
  assert.strictEqual(
    r.valid,
    true,
    'back-compat payload rejected: ' + JSON.stringify(r.errors)
  );
});

// Test 6: structural validator accepts payload WITH new fields, validates types
t('Test 6: validateStructural accepts v88 payload, range-checks fields', function () {
  const payload = {
    schema_version: '1',
    governing_thought: 'A defensible sentence.',
    last_generated_at: '2026-04-19T12:00:00Z',
    last_artifact_write_seen_at: null,
    reasoning_health_score: 0.75,
    flagged_weaknesses: ['thin tam', 'weak moat'],
    decision_log: [
      {
        session_id: 'sess-1',
        timestamp: '2026-04-17T10:00:00Z',
        action: 'flag',
        user_response: 'defer',
        reason: 'deferred for Q3 refresh',
        outcome: 'suppressed',
      },
    ],
  };
  const r = validateStructural(payload);
  assert.strictEqual(
    r.valid,
    true,
    'v88 payload rejected: ' + JSON.stringify(r.errors)
  );

  // Range check: reasoning_health_score > 1 rejected.
  const bad = Object.assign({}, payload, { reasoning_health_score: 1.5 });
  const rBad = validateStructural(bad);
  assert.strictEqual(rBad.valid, false, 'rhs=1.5 should be rejected');

  // flagged_weaknesses must be array of strings.
  const bad2 = Object.assign({}, payload, { flagged_weaknesses: [42] });
  const rBad2 = validateStructural(bad2);
  assert.strictEqual(rBad2.valid, false, 'flagged_weaknesses with number should be rejected');
});

// Test 7: validateDecisionLogEntry
t('Test 7: validateDecisionLogEntry catches missing session_id + bad user_response', function () {
  const good = {
    session_id: 's1',
    timestamp: '2026-04-19T00:00:00Z',
    action: 'x',
    user_response: 'defer',
    reason: 'y',
  };
  const r = validateDecisionLogEntry(good);
  assert.strictEqual(r.valid, true, 'good entry rejected: ' + JSON.stringify(r.errors));

  const missingSession = Object.assign({}, good);
  delete missingSession.session_id;
  const r1 = validateDecisionLogEntry(missingSession);
  assert.strictEqual(r1.valid, false, 'missing session_id should be rejected');

  const badResponse = Object.assign({}, good, { user_response: 'maybe' });
  const r2 = validateDecisionLogEntry(badResponse);
  assert.strictEqual(r2.valid, false, 'user_response=maybe should be rejected');

  for (const ok of ['approve', 'reject', 'defer']) {
    const e = Object.assign({}, good, { user_response: ok });
    const rr = validateDecisionLogEntry(e);
    assert.strictEqual(rr.valid, true, 'user_response=' + ok + ' should be accepted');
  }
});

process.stdout.write(
  '\nminto-schema-v88.test.cjs: ' + pass + ' passed, ' + fail + ' failed\n'
);
process.exit(fail === 0 ? 0 : 1);
