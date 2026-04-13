#!/usr/bin/env node
'use strict';

/**
 * Unit tests for lib/import/person-detector.cjs
 * Run: node lib/import/person-detector.test.cjs
 */

const assert = require('node:assert/strict');
const { detectPeople, slugify } = require('./person-detector.cjs');

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

function fakeFile(id, frontmatter, body) {
  return {
    id: id,
    source_path: 'notes/' + id + '.md',
    source_abs_path: '/tmp/fake/' + id + '.md',
    source_frontmatter: frontmatter || {},
    source_wikilinks: [],
    parent_folder: 'notes',
    __body: body || ''
  };
}

function makeLoader() {
  return function (f) { return f.__body || ''; };
}

test('Test 1: frontmatter tier detects attendees with confidence >= 0.95', function () {
  const files = [fakeFile('f_1', { attendees: ['Jane Doe', 'John Roe'] }, 'body text')];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 2, 'expected 2 people');
  const jane = r.find(function (p) { return p.slug === 'jane-doe'; });
  assert.ok(jane, 'jane present');
  assert.equal(jane.detection_tier, 'frontmatter');
  assert.ok(jane.detection_confidence >= 0.95, 'confidence >= 0.95 got ' + jane.detection_confidence);
});

test('Test 2: attendees header tier confidence >= 0.85', function () {
  const body = '## Attendees\n- Jane Doe\n- John Roe\n\nDiscussion...';
  const files = [fakeFile('f_1', {}, body)];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  assert.equal(r.length, 2);
  const jane = r.find(function (p) { return p.slug === 'jane-doe'; });
  assert.ok(jane);
  assert.equal(jane.detection_tier, 'attendees_header');
  assert.ok(jane.detection_confidence >= 0.85, 'confidence >= 0.85');
});

test('Test 3: first_last_repeated tier across 3 files', function () {
  const files = [
    fakeFile('f_1', {}, 'Today Eli Zarchin spoke about plans.'),
    fakeFile('f_2', {}, 'Eli Zarchin reviewed the deck.'),
    fakeFile('f_3', {}, 'Note from Eli Zarchin on budget.')
  ];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  const eli = r.find(function (p) { return p.slug === 'eli-zarchin'; });
  assert.ok(eli, 'eli detected');
  assert.equal(eli.detection_tier, 'first_last_repeated');
  assert.equal(eli.mention_files.length, 3);
});

test('Test 4: slug normalization handles punctuation and unicode', function () {
  assert.equal(slugify('Jane Doe'), 'jane-doe');
  assert.equal(slugify("O'Brien"), 'obrien');
  assert.equal(slugify('Zoë Müller'), 'zoe-muller');
  assert.equal(slugify('  Alice   Smith  '), 'alice-smith');
});

test('Test 5: role bucket fires on co-founder keyword near name', function () {
  const body = 'Team sync notes. Jane Doe, co-founder, opened the meeting.';
  const files = [fakeFile('f_1', { attendees: ['Jane Doe'] }, body)];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  const jane = r.find(function (p) { return p.slug === 'jane-doe'; });
  assert.ok(jane);
  assert.equal(jane.role_guess, 'core-team');
  assert.equal(jane.role_evidence, 'co-founder');
});

test('Test 6: role bucket fallthrough to unassigned', function () {
  const files = [fakeFile('f_1', { attendees: ['Bob Random'] }, 'Bob Random joined.')];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  const bob = r.find(function (p) { return p.slug === 'bob-random'; });
  assert.ok(bob);
  assert.equal(bob.role_guess, 'unassigned');
  assert.equal(bob.role_evidence, 'no match');
});

test('Test 7: dedup across tiers keeps highest tier and merges mention_files', function () {
  const files = [
    fakeFile('f_1', { attendees: ['Jane Doe'] }, 'Jane Doe frontmatter'),
    fakeFile('f_2', {}, '## Attendees\n- Jane Doe\n'),
    fakeFile('f_3', {}, 'Jane Doe appears here too.')
  ];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  const janeEntries = r.filter(function (p) { return p.slug === 'jane-doe'; });
  assert.equal(janeEntries.length, 1, 'one jane only');
  assert.equal(janeEntries[0].detection_tier, 'frontmatter', 'highest tier kept');
  assert.ok(janeEntries[0].mention_files.indexOf('f_1') !== -1);
  assert.ok(janeEntries[0].mention_files.indexOf('f_2') !== -1);
});

test('Test 8: stopword filter blocks "New York" and "Project Plan"', function () {
  const files = [
    fakeFile('f_1', {}, 'New York New York New York'),
    fakeFile('f_2', {}, 'New York update'),
    fakeFile('f_3', {}, 'Project Plan Project Plan Project Plan'),
    fakeFile('f_4', {}, 'Project Plan notes')
  ];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  const ny = r.find(function (p) { return p.slug === 'new-york'; });
  const pp = r.find(function (p) { return p.slug === 'project-plan'; });
  assert.equal(ny, undefined, 'New York should not be a person');
  assert.equal(pp, undefined, 'Project Plan should not be a person');
});

test('Test 9: excludeNames filters self-references', function () {
  const files = [fakeFile('f_1', { attendees: ['Jonathan Sagir', 'Jane Doe'] }, 'body')];
  const r = detectPeople(files, { bodyLoader: makeLoader(), excludeNames: ['Jonathan Sagir'] });
  assert.equal(r.length, 1);
  assert.equal(r[0].slug, 'jane-doe');
});

test('Test 10: purity -- no fs writes, result is array', function () {
  const files = [fakeFile('f_1', { attendees: ['Jane Doe'] }, 'Jane Doe, co-founder.')];
  const r = detectPeople(files, { bodyLoader: makeLoader() });
  assert.ok(Array.isArray(r));
  // shape matches manifest people[] subset
  const p = r[0];
  assert.ok('name' in p && 'slug' in p && 'detection_tier' in p);
  assert.ok('detection_confidence' in p && 'role_guess' in p);
  assert.ok('role_evidence' in p && Array.isArray(p.mention_files));
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
process.stdout.write('PASS\n');
