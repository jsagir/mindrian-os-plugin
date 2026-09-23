#!/usr/bin/env node
'use strict';

/*
 * Phase 358-09 Task 2 -- B2-08 literal: "close everything, reopen: the
 * history is there." Proven with SEPARATE OS PROCESSES and SEPARATE session
 * ids (tests/helpers/b2-358-child.cjs), never an in-process function call
 * standing in for "close everything" -- every child process registers its
 * own tools fresh, holds nothing from any other child in memory, and exits
 * before the next one starts. Ported in shape from
 * tests/test-358-b1-persistence.cjs.
 *
 * Sequence:
 *   P1 session S1: question_set (first question, tasking).
 *   P2 session S2: question_set a change without account/relocate -- refused,
 *      recorded as a waiting pending change.
 *   P3 session S3: question_read -- the waiting change shows first.
 *   P4 session S3 (a NEW process): question_set the same change with an
 *      account -- lands as refines, version 2.
 *   P5 session S4: question_set a relocate -- lands as relocates, version 3.
 *   P6 session S5: question_read -- all three versions, oldest first.
 *   P7 the parent, AFTER every child has exited, opens room.db directly and
 *      reads navigation.readGoverningQuestionVersions itself -- the record is
 *      on disk, not in any process, and this assertion never trusts a
 *      child's own success claim. It also reads the artifact files straight
 *      off disk under <room>/.mindrian/frames.
 *   P8 CLI parity (Tri-Polar): scripts/room-question.cjs history --json, a
 *      separate process again, shows the same three versions.
 *
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HELPER = path.join(REPO_ROOT, 'tests', 'helpers', 'b2-358-child.cjs');
const ROOM_QUESTION_CLI = path.join(REPO_ROOT, 'scripts', 'room-question.cjs');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

const Q1 = 'Which camera solves the delay?';
const Q2 = 'Which camera works with sunglasses?';
const Q3 = 'Should the checkpoint move north?';
const A2 = 'It assumed the delay was the camera, but the officers wear sunglasses.';

// One shared hermetic room and env for every child in this run. Each child
// registers its own tools fresh (registerAndCapture in b2-358-child.cjs), so
// sharing the env, not the process, is what makes this a true cross-process
// test: the room on disk is the only thing that carries state forward.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-persistence-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-persistence-roomshome-'));
const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-persistence-room-'));
const boot = openRoomDb(room);
closeRoomDb(boot);

const CHILD_ENV = Object.assign({}, process.env, {
  HOME: TMP_HOME,
  MINDRIAN_HOME: TMP_HOME,
  MINDRIAN_ROOMS_HOME: ROOMS_HOME,
});
delete CHILD_ENV.MINDRIAN_MCP_FIRST;
delete CHILD_ENV.CLAUDE_ACTIVE_ROOM;

function parseLastJsonLine(stdout) {
  const lines = (stdout || '').trim().split('\n');
  const last = lines[lines.length - 1];
  try {
    return JSON.parse(last);
  } catch (_e) {
    return null;
  }
}

function runChild(tool, sessionId, args) {
  const childArgs = [HELPER, tool, room, sessionId];
  if (args !== undefined) childArgs.push(JSON.stringify(args));
  const res = cp.spawnSync(process.execPath, childArgs, { env: CHILD_ENV, encoding: 'utf8' });
  return { status: res.status, parsed: parseLastJsonLine(res.stdout), stderr: res.stderr };
}

process.stdout.write('Phase 358-09 Task 2: B2-08 close-everything persistence, cross-process cross-session\n\n');

// -- P1: session S1, first question -------------------------------------------
const p1 = runChild('question_set', 'S1', { text: Q1, origin: 'tasking' });
check('P1: question_set (S1) exits 0', p1.status === 0, JSON.stringify(p1.parsed || p1.stderr));
check('P1: payload result is first',
  p1.parsed && p1.parsed.payload && p1.parsed.payload.result === 'first', JSON.stringify(p1.parsed));

// -- P2: session S2, a change without account/relocate -------------------------
const p2 = runChild('question_set', 'S2', { text: Q2, origin: 'chosen', based_on_version: 1 });
check('P2: question_set (S2) exits 0 (a parseable refusal payload, not a crash)',
  p2.status === 0, JSON.stringify(p2.parsed || p2.stderr));
check('P2: payload reason is change_needs_account',
  p2.parsed && p2.parsed.payload && p2.parsed.payload.reason === 'change_needs_account', JSON.stringify(p2.parsed));

// -- P3: session S3, a brand-new process AND session, question_read -----------
const p3 = runChild('question_read', 'S3');
check('P3: question_read (S3) exits 0', p3.status === 0, JSON.stringify(p3.parsed || p3.stderr));
const payload3 = p3.parsed && p3.parsed.payload;
const rendered3 = payload3 && payload3.rendered && payload3.rendered.question;
check('P3: rendered.question first line is "A question change is waiting."',
  typeof rendered3 === 'string' && rendered3.split('\n')[0] === 'A question change is waiting.',
  JSON.stringify(payload3));
check('P3: pending.text is Q2', payload3 && payload3.pending && payload3.pending.text === Q2);
check('P3: current.version is 1', payload3 && payload3.current && payload3.current.version === 1);
check('P3: current.origin is tasking', payload3 && payload3.current && payload3.current.origin === 'tasking');

// -- P4: session S3, a NEW process, the same change WITH an account -----------
const p4 = runChild('question_set', 'S3', { text: Q2, origin: 'chosen', based_on_version: 1, account: A2 });
check('P4: question_set (S3, new process) exits 0', p4.status === 0, JSON.stringify(p4.parsed || p4.stderr));
check('P4: payload result is refines',
  p4.parsed && p4.parsed.payload && p4.parsed.payload.result === 'refines', JSON.stringify(p4.parsed));
check('P4: payload version is 2',
  p4.parsed && p4.parsed.payload && p4.parsed.payload.version === 2, JSON.stringify(p4.parsed));

// -- P5: session S4, a relocate -------------------------------------------------
const p5 = runChild('question_set', 'S4', { text: Q3, origin: 'prompt', relocate: true });
check('P5: question_set (S4) exits 0', p5.status === 0, JSON.stringify(p5.parsed || p5.stderr));
check('P5: payload result is relocates',
  p5.parsed && p5.parsed.payload && p5.parsed.payload.result === 'relocates', JSON.stringify(p5.parsed));
check('P5: payload version is 3',
  p5.parsed && p5.parsed.payload && p5.parsed.payload.version === 3, JSON.stringify(p5.parsed));

// -- P6: session S5, question_read shows all three versions --------------------
const p6 = runChild('question_read', 'S5');
check('P6: question_read (S5) exits 0', p6.status === 0, JSON.stringify(p6.parsed || p6.stderr));
const payload6 = p6.parsed && p6.parsed.payload;
const versions6 = payload6 && Array.isArray(payload6.versions) ? payload6.versions : [];
check('P6: versions has length 3', versions6.length === 3, JSON.stringify(versions6));
check('P6: origins are [tasking, chosen, prompt]',
  versions6.length === 3 && versions6[0].origin === 'tasking' && versions6[1].origin === 'chosen' &&
  versions6[2].origin === 'prompt', JSON.stringify(versions6.map((v) => v.origin)));
check('P6: change kinds are [null/first, refines, relocates]',
  versions6.length === 3 && (versions6[0].change_kind === null || versions6[0].change_kind === undefined) &&
  versions6[1].change_kind === 'refines' && versions6[2].change_kind === 'relocates',
  JSON.stringify(versions6.map((v) => v.change_kind)));
check('P6: set_at ISO strings are in non-decreasing order',
  versions6.length === 3 &&
  Date.parse(versions6[0].set_at) <= Date.parse(versions6[1].set_at) &&
  Date.parse(versions6[1].set_at) <= Date.parse(versions6[2].set_at),
  JSON.stringify(versions6.map((v) => v.set_at)));
check('P6: version 2 account_text equals A2',
  versions6.length === 3 && versions6[1].account_text === A2, JSON.stringify(versions6[1]));
check('P6: pending is null', payload6 && payload6.pending === null);
check('P6: unresolved is empty',
  payload6 && Array.isArray(payload6.unresolved) && payload6.unresolved.length === 0, JSON.stringify(payload6 && payload6.unresolved));

// -- P7: the parent, AFTER every child has exited, reads room.db directly -----
const db7 = navigation.openRoomDbForCaller(room);
check('P7: room.db opens in this process after every child has exited', !!db7);
let rows7 = [];
if (db7) {
  try {
    rows7 = navigation.readGoverningQuestionVersions(db7);
    check('P7: readGoverningQuestionVersions returns 3 rows', rows7.length === 3, JSON.stringify(rows7.map((r) => r.version)));
    check('P7: every row review_status is proposed',
      rows7.length === 3 && rows7.every((r) => r.review_status === 'proposed'), JSON.stringify(rows7));
  } finally {
    navigation.closeRoomDbForCaller(db7);
  }
} else {
  check('P7: readGoverningQuestionVersions returns 3 rows (skipped, no db handle)', false);
}

const framesDir = path.join(room, '.mindrian', 'frames');
const v1 = rows7.find((r) => r.version === 1);
const v2 = rows7.find((r) => r.version === 2);
const v3 = rows7.find((r) => r.version === 3);
function readArtifactRaw(handle) {
  if (typeof handle !== 'string') return null;
  const abs = path.join(room, handle);
  try {
    return fs.readFileSync(abs, 'utf8').replace(/\n$/, '');
  } catch (_e) {
    return null;
  }
}
check('P7: v1 question artifact exists on disk under .mindrian/frames and holds Q1',
  !!v1 && fs.existsSync(path.join(room, v1.question_handle || '')) && readArtifactRaw(v1.question_handle) === Q1);
check('P7: v2 question artifact exists on disk and holds Q2',
  !!v2 && fs.existsSync(path.join(room, v2.question_handle || '')) && readArtifactRaw(v2.question_handle) === Q2);
check('P7: v2 refinement_handle (the account artifact) exists on disk and holds A2',
  !!v2 && !!v2.refinement_handle && fs.existsSync(path.join(room, v2.refinement_handle)) &&
  readArtifactRaw(v2.refinement_handle) === A2);
check('P7: v3 question artifact exists on disk and holds Q3',
  !!v3 && fs.existsSync(path.join(room, v3.question_handle || '')) && readArtifactRaw(v3.question_handle) === Q3);
check('P7: the frames directory exists under <room>/.mindrian/frames', fs.existsSync(framesDir) && fs.statSync(framesDir).isDirectory());

// -- P8: CLI parity (Tri-Polar) -------------------------------------------------
const p8 = cp.spawnSync(process.execPath, [ROOM_QUESTION_CLI, 'history', '--room', room, '--json'],
  { env: CHILD_ENV, encoding: 'utf8' });
check('P8: room-question.cjs history --json exits 0', p8.status === 0, p8.stderr);
let p8Parsed = null;
try { p8Parsed = JSON.parse((p8.stdout || '').trim().split('\n').pop()); } catch (_e) { p8Parsed = null; }
const versions8 = p8Parsed && Array.isArray(p8Parsed.versions) ? p8Parsed.versions : [];
check('P8: CLI history reports the same three versions (version, origin, change_kind, set_at) as P6',
  versions8.length === 3 &&
  versions8.every((v, i) => v.version === versions6[i].version && v.origin === versions6[i].origin &&
    (v.change_kind || null) === (versions6[i].change_kind || null) && v.set_at === versions6[i].set_at),
  JSON.stringify({ cli: versions8, mcp: versions6 }));

process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
