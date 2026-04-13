#!/usr/bin/env node
'use strict';

/**
 * Unit tests for lib/import/meeting-detector.cjs
 * Run: node lib/import/meeting-detector.test.cjs
 */

const assert = require('node:assert/strict');
const { detectMeetings } = require('./meeting-detector.cjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n    ' + err.message + '\n');
  }
}

function fakeFile(id, sourcePath, body) {
  return {
    id: id,
    source_path: sourcePath,
    source_abs_path: '/tmp/fake/' + id + '.md',
    __body: body || ''
  };
}
function makeLoader() { return function (f) { return f.__body || ''; }; }

test('Test 1: date_in_filename + attendees_header produces 2 signals', function () {
  const files = [fakeFile('f_1', 'notes/2026-01-15-team-sync.md', '## Attendees\n- Dror\n- Sarah\n')];
  const r = detectMeetings(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 1);
  assert.equal(r[0].source_file_id, 'f_1');
  assert.deepEqual(r[0].detection_signals.sort(), ['attendees_header', 'date_in_filename']);
  assert.equal(r[0].detected_date, '2026-01-15');
  assert.deepEqual(r[0].detected_attendees, ['Dror', 'Sarah']);
});

test('Test 2: date_in_filename + dialogue_shape detected', function () {
  const body = 'Jane: hello everyone\nBob: good morning\nAlice: ready to start\nContinued discussion.';
  const files = [fakeFile('f_2', 'transcripts/2026-01-15-call.md', body)];
  const r = detectMeetings(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 1);
  assert.ok(r[0].detection_signals.indexOf('dialogue_shape') !== -1);
  assert.ok(r[0].detection_signals.indexOf('date_in_filename') !== -1);
});

test('Test 3: only one signal (date only) does NOT produce meeting', function () {
  const files = [fakeFile('f_3', 'notes/2026-01-15-random.md', 'Just a regular dated note with no attendees and no dialogue shape.')];
  const r = detectMeetings(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 0, 'single-signal file should not be a meeting');
});

test('Test 4: detected_date normalized from multiple filename formats', function () {
  const cases = [
    ['notes/2026-01-15-a.md', '2026-01-15'],
    ['notes/20260115-b.md',   '2026-01-15'],
    ['notes/2026_01_15-c.md', '2026-01-15']
  ];
  for (const c of cases) {
    const files = [fakeFile('x', c[0], '## Attendees\n- A\n- B\n')];
    const r = detectMeetings(files, { bodyLoader: makeLoader() });
    assert.equal(r.length, 1, 'expected meeting for ' + c[0]);
    assert.equal(r[0].detected_date, c[1], 'date normalization for ' + c[0]);
  }
});

test('Test 5: attendees pulled from ## Participants header too', function () {
  const body = '## Participants\n- Alice\n- Bob\n- Carol\n';
  const files = [fakeFile('f_5', 'notes/2026-02-01-kickoff.md', body)];
  const r = detectMeetings(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].detected_attendees, ['Alice', 'Bob', 'Carol']);
});

test('Test 6: source_file_id matches input entry id', function () {
  const files = [fakeFile('f_abc', 'notes/2026-03-03-sync.md', '## Attendees\n- Zoe\n')];
  const r = detectMeetings(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 1);
  assert.equal(r[0].source_file_id, 'f_abc');
});

test('Test 7: tiny-vault fixture team-sync detected as meeting', function () {
  const body = '---\ntitle: Team sync\nattendees: ["Jane Doe", "John Roe"]\n---\n## Attendees\n- Jane Doe\n- John Roe\n\nDiscussed onboarding.';
  const files = [fakeFile('f_fx', 'notes/2026-01-15-team-sync.md', body)];
  const r = detectMeetings(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 1, 'team-sync fixture must be detected');
  assert.equal(r[0].detected_date, '2026-01-15');
  assert.ok(r[0].detected_attendees.indexOf('Jane Doe') !== -1);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('PASS\n');
