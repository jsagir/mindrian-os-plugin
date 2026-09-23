'use strict';

// Phase 358-03, Task 1 (RED). CLI legs for scripts/claim-checks.cjs and the
// /mos:room checks|claim|check wiring in commands/room.md.
//
// Hermetic: HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME all point at a fresh
// scratch dir for BOTH this test process and every spawned child, set before
// navigation.cjs is required so in-process resolveByUser/detectActiveRoom see
// the same env a child sees. CLAUDE_ACTIVE_ROOM is deleted.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const child_process = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'claim-checks.cjs');
const ROOM_MD_PATH = path.join(REPO_ROOT, 'commands', 'room.md');

const HOME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-cli-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-cli-roomshome-'));
process.env.HOME = HOME_DIR;
process.env.MINDRIAN_HOME = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;

const navigation = require('../lib/core/navigation.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    const detail = e && e.message ? e.message : String(e);
    failMessages.push(label + ' :: ' + detail);
    process.stdout.write('FAIL - ' + label + '\n');
    process.stdout.write('  ' + detail + '\n');
  }
}

function esc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function seedClaims(roomDir) {
  const db = navigation.openRoomDbForCaller(roomDir);
  let bridgeId;
  let fordId;
  try {
    const r1 = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'The bridge at grid 42 is passable.',
      sessionId: 's358-03', sourceSegment: 'seed-bridge',
    });
    assert.equal(r1.ok, true, 'seed bridge claim failed: ' + JSON.stringify(r1));
    bridgeId = r1.node_id;
    const r2 = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'The ford at grid 17 is too deep.',
      sessionId: 's358-03', sourceSegment: 'seed-ford',
    });
    assert.equal(r2.ok, true, 'seed ford claim failed: ' + JSON.stringify(r2));
    fordId = r2.node_id;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  return { bridgeId: bridgeId, fordId: fordId };
}

function readClaimRow(roomDir, claimId) {
  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    return db.prepare('SELECT id, review_status, properties FROM nodes WHERE id = ?').get(claimId);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function runCli(args, envOverrides) {
  const env = Object.assign({}, process.env, envOverrides || {});
  return child_process.spawnSync(process.execPath, [CLI_PATH].concat(args), {
    env: env, encoding: 'utf8',
  });
}

// ---------------------------------------------------------------------------
// rungs / options (no room needed, no enum duplication)
// ---------------------------------------------------------------------------

check('rungs prints one "N. label" line per VERIFICATION_RUNGS entry, in order', () => {
  const res = runCli(['rungs']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const lines = res.stdout.trim().split('\n');
  assert.equal(lines.length, navigation.VERIFICATION_RUNGS.length);
  navigation.VERIFICATION_RUNGS.forEach((r, i) => {
    assert.equal(lines[i], (i + 1) + '. ' + r.label);
  });
});

check('rungs --json prints an array of { rung, id, label }', () => {
  const res = runCli(['rungs', '--json']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.equal(Array.isArray(parsed), true);
  assert.deepEqual(parsed, navigation.VERIFICATION_RUNGS.map((r, i) => ({ rung: i + 1, id: r.id, label: r.label })));
});

check('options prints JSON { rungs, against_kinds, methods, results } equal to the navigation constants', () => {
  const res = runCli(['options']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.deepEqual(parsed.rungs, JSON.parse(JSON.stringify(navigation.VERIFICATION_RUNGS)));
  assert.deepEqual(parsed.against_kinds.slice().sort(), Array.from(navigation.VERIFICATION_AGAINST_KINDS).sort());
  assert.deepEqual(parsed.methods.slice().sort(), Array.from(navigation.VERIFICATION_METHODS).sort());
  assert.deepEqual(parsed.results.slice().sort(), Array.from(navigation.VERIFICATION_RESULTS).sort());
});

// ---------------------------------------------------------------------------
// portrait on an empty room: all 4 states, never a score
// ---------------------------------------------------------------------------

check('portrait --room <empty room> exits 0, shows all 4 states at 0, never a score', () => {
  const dir = makeRoom('mindrian-358-b1-cli-emptyroom-');
  const res = runCli(['portrait', '--room', dir]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, /checked: 0/);
  assert.match(res.stdout, /disputed: 0/);
  assert.match(res.stdout, /inconclusive: 0/);
  assert.match(res.stdout, /unchecked \(no checking record yet\): 0/);
  assert.equal(/score|percent|pct|ratio|grade|coverage|%/i.test(res.stdout), false, res.stdout);
});

// ---------------------------------------------------------------------------
// Seeded room used by the record / show / list / portrait legs below.
// ---------------------------------------------------------------------------

const ROOM = makeRoom('mindrian-358-b1-cli-room-');
const SEEDED = seedClaims(ROOM);
const BRIDGE_ID = SEEDED.bridgeId;
const FORD_ID = SEEDED.fordId;

check('record on the bridge claim: exits 0, confirmation unchanged, checking record disputed, rung 3', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', BRIDGE_ID,
    '--against', 'field note, exercise 02', '--against-kind', 'observation',
    '--rung', '3', '--method', 'compare', '--result', 'contradicts',
  ]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, /Its confirmation status did not change\./);
  assert.match(res.stdout, /^Confirmation status: proposed/m);
  assert.match(res.stdout, /^Checking record: disputed/m);
  assert.match(res.stdout, /rung 3 \(/);
});

check('after the record, nodes.review_status stays proposed; checked_by user, checked_by_id from resolveByUser', () => {
  const row = readClaimRow(ROOM, BRIDGE_ID);
  assert.equal(row.review_status, 'proposed');
  const props = JSON.parse(row.properties);
  const records = props.verification.records;
  const last = records[records.length - 1];
  assert.equal(last.checked_by, 'user');
  assert.equal(last.checked_by_id, navigation.resolveByUser(ROOM));
});

check('record --claim bridge (words) resolves the unique claim', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', 'bridge',
    '--against', 'field note 2', '--against-kind', 'observation',
    '--rung', '1', '--method', 'read', '--result', 'supports',
  ]);
  assert.equal(res.status, 0, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
});

check('record --claim grid (matches both) exits 1 with ambiguous_claim and both claim ids', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', 'grid',
    '--against', 'x', '--against-kind', 'observation',
    '--rung', '1', '--method', 'read', '--result', 'supports',
  ]);
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  const combined = res.stdout + res.stderr;
  assert.match(combined, /ambiguous_claim/);
  assert.match(combined, new RegExp(esc(BRIDGE_ID)));
  assert.match(combined, new RegExp(esc(FORD_ID)));
});

check('record --claim tank exits 1 with claim_not_found', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', 'tank',
    '--against', 'x', '--against-kind', 'observation',
    '--rung', '1', '--method', 'read', '--result', 'supports',
  ]);
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout + res.stderr, /claim_not_found/);
});

check('--rung 9 exits 1 and prints invalid_rung', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', BRIDGE_ID,
    '--against', 'x', '--against-kind', 'observation',
    '--rung', '9', '--method', 'read', '--result', 'supports',
  ]);
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout + res.stderr, /invalid_rung/);
});

check('omitting --rung exits 2 and the usage names --rung', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', BRIDGE_ID,
    '--against', 'x', '--against-kind', 'observation',
    '--method', 'read', '--result', 'supports',
  ]);
  assert.equal(res.status, 2, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout + res.stderr, /--rung/);
});

check('--method guess exits 1 and prints invalid_method followed by the allowed methods', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', BRIDGE_ID,
    '--against', 'x', '--against-kind', 'observation',
    '--rung', '1', '--method', 'guess', '--result', 'supports',
  ]);
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  const combined = res.stdout + res.stderr;
  assert.match(combined, /invalid_method/);
  for (const m of navigation.VERIFICATION_METHODS) {
    assert.match(combined, new RegExp(esc(m)), 'missing allowed method: ' + m);
  }
});

check('show <bridge id> in a NEW process prints the record and Confirmation status: proposed', () => {
  const res = runCli(['show', '--room', ROOM, BRIDGE_ID]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, /checked against/);
  assert.match(res.stdout, /rung/);
  assert.match(res.stdout, /method:/);
  assert.match(res.stdout, /result:/);
  assert.match(res.stdout, /by:/);
  assert.match(res.stdout, /when:/);
  assert.match(res.stdout, /^Confirmation status: proposed/m);
});

check('show bridge (words) works', () => {
  const res = runCli(['show', '--room', ROOM, 'bridge']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
});

check('show --json prints { ok: true, room_dir, claim } with checking_record.status disputed', () => {
  const res = runCli(['show', '--room', ROOM, '--json', BRIDGE_ID]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.room_dir, ROOM);
  assert.equal(parsed.claim.checking_record.status, 'disputed');
});

check('list --room R prints both claims with their checking status', () => {
  const res = runCli(['list', '--room', ROOM]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, new RegExp(esc(BRIDGE_ID)));
  assert.match(res.stdout, new RegExp(esc(FORD_ID)));
});

check('list --room R --query ford prints only the ford claim', () => {
  const res = runCli(['list', '--room', ROOM, '--query', 'ford']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, new RegExp(esc(FORD_ID)));
  assert.equal(res.stdout.includes(BRIDGE_ID), false);
});

check('portrait --room R --json deep-equals navigation.readVerificationPortrait computed in-process', () => {
  const db = navigation.openRoomDbForCaller(ROOM);
  let expected;
  try {
    expected = navigation.readVerificationPortrait(db);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  const res = runCli(['portrait', '--room', ROOM, '--json']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.deepEqual(parsed.portrait, expected);
});

check('a later record --result supports keeps the bridge claim disputed (sticky)', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', BRIDGE_ID,
    '--against', 'field note 3', '--against-kind', 'observation',
    '--rung', '1', '--method', 'read', '--result', 'supports',
  ]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, /^Checking record: disputed/m);
});

check('record --result supports --resolves-dispute makes it checked and marks the contradiction answered', () => {
  const res = runCli([
    'record', '--room', ROOM, '--claim', BRIDGE_ID,
    '--against', 'field note 4', '--against-kind', 'observation',
    '--rung', '1', '--method', 'read', '--result', 'supports', '--resolves-dispute',
  ]);
  assert.equal(res.status, 0, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout, /^Checking record: checked/m);
  assert.match(res.stdout, /a person marked the earlier contradiction answered/);
});

check('portrait with no --room, empty MINDRIAN_ROOMS_HOME/HOME, exits 1 and prints No Data Room found', () => {
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-cli-emptyhome-'));
  const res = runCli(['portrait'], {
    HOME: emptyHome, MINDRIAN_HOME: emptyHome, MINDRIAN_ROOMS_HOME: emptyHome,
  });
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout + res.stderr, /No Data Room found/);
});

// ---------------------------------------------------------------------------
// Substrate hygiene: no raw sqlite, no Brain, only navigation, no enum leaks
// ---------------------------------------------------------------------------

check('claim-checks.cjs never requires node:sqlite/DatabaseSync/better-sqlite3/brain, uses the two navigation door functions, no hardcoded enum or rung-label literals', () => {
  const src = fs.readFileSync(CLI_PATH, 'utf8');
  const stripped = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/node:sqlite/.test(stripped), false, 'must not reference node:sqlite');
  assert.equal(/DatabaseSync/.test(stripped), false, 'must not reference DatabaseSync');
  assert.equal(/better-sqlite3/.test(stripped), false, 'must not reference better-sqlite3');
  assert.equal(/brain/i.test(stripped), false, 'must not reference brain');
  assert.match(stripped, /openRoomDbForCaller/);
  assert.match(stripped, /closeRoomDbForCaller/);
  for (const m of navigation.VERIFICATION_METHODS) {
    assert.equal(new RegExp('[\'"]' + esc(m) + '[\'"]').test(stripped), false, 'method literal leaked: ' + m);
  }
  for (const r of navigation.VERIFICATION_RESULTS) {
    assert.equal(new RegExp('[\'"]' + esc(r) + '[\'"]').test(stripped), false, 'result literal leaked: ' + r);
  }
  for (const k of navigation.VERIFICATION_AGAINST_KINDS) {
    assert.equal(new RegExp('[\'"]' + esc(k) + '[\'"]').test(stripped), false, 'against_kind literal leaked: ' + k);
  }
  for (const rung of navigation.VERIFICATION_RUNGS) {
    assert.equal(stripped.includes(rung.label), false, 'rung label leaked: ' + rung.label);
  }
});

check('node scripts/check-substrate.cjs reports no line naming scripts/claim-checks.cjs', () => {
  const res = child_process.spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs')], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  const combined = (res.stdout || '') + (res.stderr || '');
  assert.equal(combined.includes('scripts/claim-checks.cjs'), false, combined.slice(0, 600));
});

// ---------------------------------------------------------------------------
// commands/room.md wiring
// ---------------------------------------------------------------------------

check('commands/room.md contains the checks, claim and check subcommand headers', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  assert.match(src, /## Subcommand: checks\n/);
  assert.match(src, /## Subcommand: claim\n/);
  assert.match(src, /## Subcommand: check\n/);
});

check('commands/room.md names scripts/claim-checks.cjs at least 4 times', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  const count = (src.match(/scripts\/claim-checks\.cjs/g) || []).length;
  assert.ok(count >= 4, 'count=' + count);
});

check('commands/room.md mentions AskUserQuestion inside the check section', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  const m = src.match(/## Subcommand: check\n[\s\S]*?(?=\n## )/);
  assert.ok(m, 'check section not found');
  assert.match(m[0], /AskUserQuestion/);
});

check('commands/room.md contains "before the [section] fallback" (case-insensitive)', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  assert.match(src, /before the \[section\] fallback/i);
});

check('commands/room.md argument-hint line mentions checks, claim and check', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  const m = src.match(/^argument-hint:.*$/m);
  assert.ok(m, 'argument-hint line not found');
  assert.match(m[0], /checks/);
  assert.match(m[0], /claim/);
  assert.match(m[0], /check/);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
