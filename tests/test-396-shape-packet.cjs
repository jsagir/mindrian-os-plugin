#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 08 -- the Part 8 shape packet: one builder, one validator
 * (392-SC3 second half, D-01, D-02, Theo Phase 48 T1).
 *
 * THE SEAM THIS PROVES: lib/core/brain-shape-packet.cjs builds the closed
 * vocabulary problem shape from the bound room's files ONLY, and validates a
 * packet by exact membership against data/brain-shape-vocabulary.json. The
 * model never writes the packet: a shape passed in is ignored and reported.
 *
 * Legs:
 *   S0  the module exists and exports the four names (RED on beta.81:
 *       the module is missing)
 *   S1  room-a builds the expected packet (every source present)
 *   S2  room-b builds the expected packet (classify path, tie, defaults)
 *   S3  room-empty builds the all-default packet; the classify default is
 *       recorded
 *   S4  the three built packets validate; every refusal case is typed with
 *       the field and the member list
 *   S5  a model-supplied shape is ignored (ignored_input true) and the room
 *       value wins
 *   S6  the fixture tree is byte-identical after the run (the builder does
 *       not write); every fixture line is 60 characters or shorter; the
 *       README names the values as invented
 *   S7  sources carry labels only, never a room value
 *
 * Run: node tests/test-396-shape-packet.cjs
 * Plain Node harness, hand-rolled ok(), exit 1 on any failure.
 * Hyphens only, no em dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'brain-shape-packet.cjs');
const VOCAB_PATH = path.join(REPO, 'data', 'brain-shape-vocabulary.json');
const FIXTURES = path.join(__dirname, 'fixtures', '392-shape-rooms');
const ROOM_A = path.join(FIXTURES, 'room-a');
const ROOM_B = path.join(FIXTURES, 'room-b');
const ROOM_EMPTY = path.join(FIXTURES, 'room-empty');

let checks = 0;
let failed = 0;
const failedLegs = new Set();

function ok(leg, label, cond) {
  checks += 1;
  if (cond) {
    console.log('  ok   [' + leg + '] ' + label);
  } else {
    failed += 1;
    failedLegs.add(leg);
    console.log('  FAIL [' + leg + '] ' + label);
  }
}

function sameList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function samePacket(a, b) {
  if (!a || !b) return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (!sameList(ka, kb)) return false;
  for (const k of ka) {
    if (k === 'constraint_categories') {
      if (!sameList(a[k], b[k])) return false;
    } else if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
}

/** Walk a directory and return every file path, sorted. */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

/** One sha256 over every file path and byte in the fixture tree. */
function hashTree(dir) {
  const h = crypto.createHash('sha256');
  for (const f of walk(dir)) {
    h.update(path.relative(dir, f));
    h.update('\0');
    h.update(fs.readFileSync(f));
    h.update('\0');
  }
  return h.digest('hex');
}

function main() {
  console.log('test-396-shape-packet');

  // S0 -- the module exists (RED on beta.81).
  if (!fs.existsSync(MODULE_PATH)) {
    console.log('  FAIL [S0] lib/core/brain-shape-packet.cjs is missing at ' + MODULE_PATH);
    console.log('FAIL: test-396-shape-packet (module missing)');
    process.exit(1);
  }
  const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
  const before = hashTree(FIXTURES);

  const packet = require(MODULE_PATH);
  for (const name of ['buildShapePacket', 'validateShapePacket', 'SHAPE_KEYS', 'loadVocabulary']) {
    ok('S0', 'exports ' + name, packet[name] !== undefined);
  }
  ok('S0', 'SHAPE_KEYS is the six wire keys in order', sameList(Array.from(packet.SHAPE_KEYS),
    ['schema_version', 'problem_type', 'stage', 'role', 'domain_tag', 'constraint_categories']));
  const loaded = packet.loadVocabulary();
  ok('S0', 'loadVocabulary returns schema_version 1', loaded.schema_version === 1);
  ok('S0', 'loadVocabulary freezes the lists', Object.isFrozen(loaded) && Object.isFrozen(loaded.problem_type));
  ok('S0', 'vocabulary carries role_default, a role member', typeof vocab.role_default === 'string' && vocab.role.includes(vocab.role_default));
  ok('S0', 'vocabulary carries constraint_keyword_map', vocab.constraint_keyword_map && typeof vocab.constraint_keyword_map === 'object');

  // S1 -- room-a.
  const a = packet.buildShapePacket({ roomDir: ROOM_A });
  const expectedA = {
    schema_version: 1,
    problem_type: 'WellDefined',
    stage: 'Phase3',
    role: 'investor',
    domain_tag: 'finance',
    constraint_categories: ['regulatory', 'capital'],
  };
  console.log('  packet room-a: ' + JSON.stringify(a.shape));
  ok('S1', 'room-a packet equals the expected packet', samePacket(a.shape, expectedA));
  ok('S1', 'room-a key order is SHAPE_KEYS order', sameList(Object.keys(a.shape), Array.from(packet.SHAPE_KEYS)));
  ok('S1', 'room-a ignored_input is false', a.ignored_input === false);
  ok('S1', 'room-a sources: problem_type jtbd_goal', a.sources.problem_type === 'jtbd_goal');
  ok('S1', 'room-a sources: stage state_md', a.sources.stage === 'state_md');
  ok('S1', 'room-a sources: role user_md', a.sources.role === 'user_md');
  ok('S1', 'room-a sources: domain_tag state_md', a.sources.domain_tag === 'state_md');
  ok('S1', 'room-a sources: constraint_categories state_md', a.sources.constraint_categories === 'state_md');

  // S2 -- room-b.
  const b = packet.buildShapePacket({ roomDir: ROOM_B });
  const expectedB = {
    schema_version: 1,
    problem_type: 'IllDefined',
    stage: 'Phase2',
    role: vocab.role_default,
    domain_tag: 'unknown',
    constraint_categories: [],
  };
  console.log('  packet room-b: ' + JSON.stringify(b.shape));
  ok('S2', 'room-b packet equals the expected packet (role is role_default ' + vocab.role_default + ')', samePacket(b.shape, expectedB));
  ok('S2', 'room-b sources: problem_type classify', b.sources.problem_type === 'classify');
  ok('S2', 'room-b sources: stage state_md', b.sources.stage === 'state_md');
  ok('S2', 'room-b sources: role default (tie)', b.sources.role === 'default');
  ok('S2', 'room-b sources: domain_tag default', b.sources.domain_tag === 'default');
  ok('S2', 'room-b sources: constraint_categories default', b.sources.constraint_categories === 'default');

  // S3 -- room-empty.
  const e = packet.buildShapePacket({ roomDir: ROOM_EMPTY });
  console.log('  packet room-empty: ' + JSON.stringify(e.shape));
  console.log('  classifyProblemType default for the empty room: ' + e.shape.problem_type);
  ok('S3', 'room-empty stage is Phase0', e.shape.stage === 'Phase0');
  ok('S3', 'room-empty role is role_default', e.shape.role === vocab.role_default);
  ok('S3', 'room-empty domain_tag is unknown', e.shape.domain_tag === 'unknown');
  ok('S3', 'room-empty constraint_categories is []', sameList(e.shape.constraint_categories, []));
  ok('S3', 'room-empty problem_type is a vocabulary member', vocab.problem_type.includes(e.shape.problem_type));
  ok('S3', 'room-empty problem_type is UnDefined (classifyProblemType with empty inputs returns UDP)', e.shape.problem_type === 'UnDefined');
  ok('S3', 'room-empty sources are all default except problem_type classify',
    e.sources.problem_type === 'classify' && e.sources.stage === 'default' && e.sources.role === 'default'
    && e.sources.domain_tag === 'default' && e.sources.constraint_categories === 'default');

  // A missing room directory: every default, never a throw.
  const missing = packet.buildShapePacket({ roomDir: path.join(FIXTURES, 'room-does-not-exist') });
  ok('S3', 'a missing room directory builds the all-default packet without a throw',
    missing.shape.stage === 'Phase0' && missing.shape.role === vocab.role_default
    && missing.shape.domain_tag === 'unknown' && missing.shape.constraint_categories.length === 0);

  // S4 -- the validator.
  for (const [name, p] of [['room-a', a.shape], ['room-b', b.shape], ['room-empty', e.shape]]) {
    const r = packet.validateShapePacket(p);
    ok('S4', name + ' packet validates', r.ok === true);
  }
  const good = Object.assign({}, expectedA);
  function refused(label, shape, field, membersCheck) {
    const r = packet.validateShapePacket(shape);
    const typed = r && r.ok === false && r.field === field && typeof r.reason === 'string' && r.reason.length > 0;
    ok('S4', label + ' refused with field ' + field, typed);
    if (membersCheck) ok('S4', label + ' names the member list', typed && Array.isArray(r.members) && membersCheck(r.members));
    return r;
  }
  refused('extra key', Object.assign({}, good, { extra: 1 }), 'extra', (m) => sameList(m, Array.from(packet.SHAPE_KEYS)));
  const wrongCase = refused('problem_type Undefined (wrong case)', Object.assign({}, good, { problem_type: 'Undefined' }), 'problem_type', (m) => sameList(m, vocab.problem_type));
  ok('S4', 'wrong-case refusal message carries the member list', wrongCase && /UnDefined/.test(wrongCase.reason) && /Wicked/.test(wrongCase.reason));
  refused('stage Phase6', Object.assign({}, good, { stage: 'Phase6' }), 'stage', (m) => sameList(m, vocab.stage));
  refused('constraint_categories as a string', Object.assign({}, good, { constraint_categories: 'capital' }), 'constraint_categories', (m) => sameList(m, vocab.constraint_categories));
  refused('six constraint members (max 5)', Object.assign({}, good, { constraint_categories: ['regulatory', 'capital', 'technical', 'market_access', 'talent', 'time'] }), 'constraint_categories');
  refused('a repeated constraint member', Object.assign({}, good, { constraint_categories: ['capital', 'capital'] }), 'constraint_categories');
  refused('a non-member constraint', Object.assign({}, good, { constraint_categories: ['money'] }), 'constraint_categories', (m) => sameList(m, vocab.constraint_categories));
  refused('role Investor (wrong case)', Object.assign({}, good, { role: 'Investor' }), 'role', (m) => sameList(m, vocab.role));
  refused('domain_tag Finance (wrong case)', Object.assign({}, good, { domain_tag: 'Finance' }), 'domain_tag', (m) => sameList(m, vocab.domain_tag));
  const noVersion = Object.assign({}, good);
  delete noVersion.schema_version;
  refused('missing schema_version', noVersion, 'schema_version');
  refused('schema_version 2', Object.assign({}, good, { schema_version: 2 }), 'schema_version', (m) => sameList(m, [1]));
  refused('schema_version "1" (string, no coercion)', Object.assign({}, good, { schema_version: '1' }), 'schema_version');
  refused('stage with trailing space (no trimming)', Object.assign({}, good, { stage: 'Phase3 ' }), 'stage');
  const notObject = packet.validateShapePacket(null);
  ok('S4', 'null is refused with field shape', notObject.ok === false && notObject.field === 'shape');
  const arr = packet.validateShapePacket([]);
  ok('S4', 'an array is refused with field shape', arr.ok === false && arr.field === 'shape');
  const str = packet.validateShapePacket('WellDefined');
  ok('S4', 'a string is refused with field shape', str.ok === false && str.field === 'shape');
  const extraFirst = packet.validateShapePacket({ extra: 1 });
  ok('S4', 'a one-key object is refused (missing fields or extra key), never repaired', extraFirst.ok === false);

  // S5 -- a model-supplied shape is ignored.
  const spoofed = packet.buildShapePacket({ roomDir: ROOM_A, shape: { problem_type: 'Wicked', stage: 'Phase5' } });
  ok('S5', 'model-supplied shape: ignored_input is true', spoofed.ignored_input === true);
  ok('S5', 'model-supplied shape: the room value wins (problem_type WellDefined)', spoofed.shape.problem_type === 'WellDefined');
  ok('S5', 'model-supplied shape: the packet equals the room-built packet', samePacket(spoofed.shape, a.shape));
  const otherArg = packet.buildShapePacket({ roomDir: ROOM_A, problem_type: 'Wicked', question: 'anything' });
  ok('S5', 'any argument other than roomDir sets ignored_input true', otherArg.ignored_input === true && samePacket(otherArg.shape, a.shape));
  ok('S5', 'ignored argument names are reported as keys only', sameList(otherArg.ignored_keys, ['problem_type', 'question']));

  // S7 -- sources are labels only.
  const allowedSources = {
    problem_type: ['jtbd_goal', 'classify'],
    stage: ['state_md', 'default'],
    role: ['user_md', 'default'],
    domain_tag: ['state_md', 'default'],
    constraint_categories: ['state_md', 'default'],
  };
  for (const r of [a, b, e, missing, spoofed]) {
    ok('S7', 'sources carry labels only', Object.keys(r.sources).every((k) => allowedSources[k] && allowedSources[k].includes(r.sources[k])));
    ok('S7', 'result has exactly shape, sources, ignored_input, ignored_keys', sameList(Object.keys(r).sort(), ['ignored_input', 'ignored_keys', 'shape', 'sources']));
  }
  const roomAText = fs.readFileSync(path.join(ROOM_A, 'STATE.md'), 'utf8');
  const serialized = JSON.stringify([a, b, e]);
  ok('S7', 'no constraint line of room-a appears in any result', !/regulatory approval pending|limited capital/.test(serialized));
  ok('S7', 'the invented thesis line of room-b appears in no result', !/invented thesis line/.test(serialized));
  ok('S7', 'room-a STATE.md still holds the constraint lines (the test read the right file)', /regulatory approval pending/.test(roomAText));

  // S6 -- the fixture tree is unchanged; line cap; README.
  const after = hashTree(FIXTURES);
  ok('S6', 'fixture tree hash unchanged after the run', before === after);
  const readme = fs.readFileSync(path.join(FIXTURES, 'README.md'), 'utf8');
  ok('S6', 'README says the values are invented', /INVENTED/.test(readme) && /synthetic/i.test(readme));
  const fixtureFiles = walk(FIXTURES).filter((f) => path.basename(f) !== 'README.md');
  ok('S6', 'the three rooms hold 6 fixture files', fixtureFiles.length === 6);
  let longLines = 0;
  for (const f of fixtureFiles) {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (line.length > 60) longLines += 1;
    }
  }
  ok('S6', 'no fixture line is longer than 60 characters (outside the README)', longLines === 0);
  let emDashes = 0;
  for (const f of walk(FIXTURES)) emDashes += (fs.readFileSync(f, 'utf8').match(/\u2014/g) || []).length;
  ok('S6', 'no em dash in the fixture tree', emDashes === 0);

  console.log('');
  console.log('======================================');
  console.log('Checks: ' + checks + '  Failed: ' + failed);
  if (failedLegs.size > 0) console.log('Failed legs: ' + Array.from(failedLegs).sort().join(', '));
  console.log('======================================');
  if (failed > 0) process.exit(1);
}

try {
  main();
} catch (e) {
  console.error('FAIL: test-396-shape-packet');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
