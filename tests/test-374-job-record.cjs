#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 10, Task 1 (test T9): the plugin job record, location USER-DIR (owner card OD-4, answer RECOMMENDED).
 *
 * The record is a small pointer file for a started Eureka job. It holds ids, hashes, counts and times only (D-12),
 * is owner-only, is written atomically, is bound to the room, and is swept after 30 days. Only the answered
 * location exists: <home>/.mindrian/eureka-jobs/<safe room id>/<job id>.json.
 *
 * Arms (one line each, "ok - R<n> ..." or "FAIL - R<n> ..." at column 1):
 *   R1  recordStart writes one file whose keys are a subset of the allowed list and include job_id, capability_id,
 *       room_id, session_key_hash, started_at and engine_expires_at (start plus 30 days)
 *   R2  marker strings planted in a request, node titles and an objective never reach the file; a record that
 *       carries a deny-listed key or any key outside the allowed list is refused and writes nothing
 *   R3  directory mode 0700 and file mode 0600 (skipped on win32 and said so)
 *   R4  jobIdOk refuses "..", "a/b", a leading dot, the empty string and more than 200 characters; readRecord and
 *       recordStart refuse them with a typed reason and touch no file
 *   R5  sweep removes records past engine_expires_at and keeps the others
 *   R6  the location is exactly <home>/.mindrian/eureka-jobs/<safe room id>/<job id>.json; an unsafe room id is
 *       replaced by a hash; no room id and an explicit env without a home give a typed refusal
 *   R7  a record of room A is not found when it is read for room B
 *   R8  updateRecord changes only last_status, last_status_at, terminal and manifest_sha256
 *   R9  the write is atomic: a temp file in the same folder, then a rename; none remains after success or after a
 *       failed rename, and a failed rename leaves the old record intact
 *
 * No engine, no network. A scratch HOME. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'lib', 'mcp', 'eureka-job-record.cjs');

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't374-10-record-'));
const ENV = { HOME };
const DAY = 24 * 60 * 60 * 1000;
const ALLOWED = ['job_id', 'capability_id', 'route', 'scope_id', 'snapshot_id', 'room_id', 'session_key_hash', 'request_sha256',
  'artifact_count', 'top_k', 'plan_digest', 'approval_ref', 'idempotency_key', 'started_at', 'engine_expires_at',
  'last_status', 'last_status_at', 'terminal', 'manifest_sha256'];

let rec = null;
let loadError = null;
try { rec = require(MODULE); } catch (error) { loadError = error; }
function need() {
  if (!rec) throw new Error('lib/mcp/eureka-job-record.cjs does not load yet: ' + String(loadError && loadError.message).split('\n')[0]);
}

let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

function hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }
function iso(ms) { return new Date(ms).toISOString(); }
function make(jobId, patch) {
  const now = Date.now();
  return Object.assign({
    job_id: jobId, capability_id: 'opportunity.run_pair_screen', route: 'scout_start_pair_screen',
    scope_id: 'room:r', snapshot_id: 'snap-r', room_id: 'room-a', session_key_hash: hex('session'),
    request_sha256: hex('request'), artifact_count: 3, top_k: 5, plan_digest: hex('plan'), approval_ref: 'gate-1',
    idempotency_key: hex('idem'), started_at: iso(now), engine_expires_at: iso(now + 30 * DAY),
    last_status: 'queued', last_status_at: iso(now), terminal: false, manifest_sha256: null,
  }, patch || {});
}
function baseFor(room) {
  const resolved = rec.resolveBase({ room_id: room, env: ENV });
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  return resolved.base;
}
function filesIn(dir) { try { return fs.readdirSync(dir).sort(); } catch (_e) { return []; } }

async function main() {
  await arm('R1', 'recordStart writes one file with allowed keys only, 30 days to engine_expires_at', async () => {
    need();
    const base = baseFor('room-a');
    const input = make('job-r1');
    const out = rec.recordStart(base, input);
    assert.equal(out.ok, true, JSON.stringify(out));
    const files = filesIn(base);
    assert.deepEqual(files, ['job-r1.json']);
    const parsed = JSON.parse(fs.readFileSync(path.join(base, 'job-r1.json'), 'utf8'));
    for (const key of Object.keys(parsed)) assert.ok(ALLOWED.includes(key), 'key outside the list: ' + key);
    for (const key of ['job_id', 'capability_id', 'room_id', 'session_key_hash', 'started_at', 'engine_expires_at']) {
      assert.ok(parsed[key] !== undefined && parsed[key] !== null, 'missing ' + key);
    }
    assert.equal(Date.parse(parsed.engine_expires_at) - Date.parse(parsed.started_at), 30 * DAY);
    assert.deepEqual(rec.readRecord(base, 'job-r1', 'room-a'), parsed);
  });

  await arm('R2', 'no marker string reaches the file; deny-listed and unknown keys are refused', async () => {
    need();
    const base = baseFor('room-a');
    const MARK = ['PLANTREQ-31ac', 'PLANTTITLE-31ac', 'PLANTOBJ-31ac'];
    const request = { objective: MARK[2], artifacts: [{ id: 'n1', title: MARK[1], text: MARK[0] }] };
    // A caller builds the record from ids and hashes only; the request itself is hashed, never copied.
    const input = make('job-r2', { request_sha256: hex(JSON.stringify(request)), artifact_count: request.artifacts.length });
    assert.equal(rec.recordStart(base, input).ok, true);
    const text = fs.readFileSync(path.join(base, 'job-r2.json'), 'utf8');
    for (const mark of MARK) assert.ok(text.indexOf(mark) === -1, 'marker in file: ' + mark);
    for (const key of ['text', 'title', 'source_ref', 'request', 'result', 'objective', 'node_ids', 'artifacts', 'surprise_key']) {
      const before = filesIn(base);
      assert.throws(() => rec.recordStart(base, make('job-r2-' + key, { [key]: MARK[0] })), TypeError, 'key not refused: ' + key);
      assert.deepEqual(filesIn(base), before, 'a file was written for key ' + key);
    }
    // a value that is the wrong type or shape is refused too
    assert.throws(() => rec.recordStart(base, make('job-r2-bad', { request_sha256: MARK[0] })), TypeError);
    assert.throws(() => rec.recordStart(base, make('job-r2-bad2', { artifact_count: MARK[0] })), TypeError);
    assert.ok(!filesIn(base).some((f) => f.startsWith('job-r2-')), 'a refused record left a file');
  });

  await arm('R3', 'directory mode 0700 and file mode 0600', async () => {
    need();
    if (process.platform === 'win32') {
      process.stdout.write('  note: R3 mode check skipped on win32 (permission bits are not comparable); UNVERIFIED there\n');
      return;
    }
    const base = baseFor('room-mode');
    assert.equal(rec.recordStart(base, make('job-r3', { room_id: 'room-mode' })).ok, true);
    assert.equal(fs.statSync(base).mode & 0o777, 0o700, 'room dir mode');
    assert.equal(fs.statSync(path.dirname(base)).mode & 0o777, 0o700, 'eureka-jobs dir mode');
    assert.equal(fs.statSync(path.join(base, 'job-r3.json')).mode & 0o777, 0o600, 'file mode');
  });

  await arm('R4', 'unsafe job ids are refused with a typed reason and touch no file', async () => {
    need();
    const base = baseFor('room-a');
    for (const bad of ['..', 'a/b', '.hidden', '', 'x'.repeat(201), 'a..b', 'a\\b', 'a b', '../x']) {
      assert.equal(rec.jobIdOk(bad), false, 'accepted: ' + JSON.stringify(bad.slice(0, 20)));
      const before = filesIn(base);
      const wrote = rec.recordStart(base, make(bad));
      assert.equal(wrote.ok, false);
      assert.equal(wrote.reason, 'job_id_invalid');
      assert.equal(rec.readRecord(base, bad, 'room-a'), null);
      assert.equal(rec.removeRecord(base, bad).ok, false);
      assert.deepEqual(filesIn(base), before);
    }
    assert.equal(rec.jobIdOk('x'.repeat(200)), true);
    assert.equal(rec.jobIdOk('job-1_a.b:c'), true);
    assert.equal(fs.existsSync(path.join(HOME, 'x')), false);
    assert.equal(fs.existsSync(path.join(path.dirname(base), 'x')), false);
  });

  await arm('R5', 'sweep removes records past engine_expires_at and keeps the others', async () => {
    need();
    const base = baseFor('room-sweep');
    const now = Date.now();
    rec.recordStart(base, make('job-old', { room_id: 'room-sweep', started_at: iso(now - 40 * DAY), engine_expires_at: iso(now - 10 * DAY) }));
    rec.recordStart(base, make('job-new', { room_id: 'room-sweep' }));
    const removed = rec.sweep(base, now);
    assert.equal(removed, 1);
    assert.deepEqual(filesIn(base), ['job-new.json']);
  });

  await arm('R6', 'the location is exactly <home>/.mindrian/eureka-jobs/<safe room id>/<job id>.json', async () => {
    need();
    const literal = path.join(HOME, '.mindrian', 'eureka-jobs', 'room-lit');
    const resolved = rec.resolveBase({ room_id: 'room-lit', env: ENV });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.base, literal);
    assert.equal(rec.recordStart(resolved.base, make('job-lit', { room_id: 'room-lit' })).ok, true);
    assert.equal(fs.existsSync(path.join(literal, 'job-lit.json')), true);
    // an unsafe room id is replaced by a hash segment; it never leaves the eureka-jobs folder
    for (const unsafe of ['../../etc', 'a/b', '..', '.x', 'a'.repeat(300), 'room with space', '']) {
      const r = rec.resolveBase({ room_id: unsafe, env: ENV });
      if (unsafe === '') { assert.equal(r.ok, false); assert.equal(r.reason, 'no_room'); continue; }
      assert.equal(r.ok, true, JSON.stringify(unsafe));
      assert.equal(path.dirname(r.base), path.join(HOME, '.mindrian', 'eureka-jobs'));
      assert.match(path.basename(r.base), /^h-[0-9a-f]{32}$/);
    }
    assert.equal(rec.resolveBase({ room_id: null, env: ENV }).reason, 'no_room');
    // an explicit env object without HOME or USERPROFILE gives no folder (no fallback to the real home)
    const nohome = rec.resolveBase({ room_id: 'room-lit', env: { PATH: '/bin' } });
    assert.equal(nohome.ok, false);
    assert.equal(nohome.reason, 'no_home');
    // USERPROFILE is read when HOME is absent
    const viaProfile = rec.resolveBase({ room_id: 'room-lit', env: { USERPROFILE: HOME } });
    assert.equal(viaProfile.base, literal);
    // a relative home is refused
    assert.equal(rec.resolveBase({ room_id: 'room-lit', env: { HOME: 'relative/home' } }).ok, false);
    // the module holds no second location
    const source = fs.readFileSync(MODULE, 'utf8');
    assert.ok(source.indexOf('.mindrian') !== -1 && source.indexOf('eureka-jobs') !== -1);
    assert.ok(!/isRoomInWriteScope|room_dir|write_scope/.test(source), 'the module holds a ROOM-DIR branch');
  });

  await arm('R7', 'a record of room A is not found when read for room B', async () => {
    need();
    const baseA = baseFor('room-a');
    const baseB = baseFor('room-b');
    assert.equal(rec.recordStart(baseA, make('job-r7', { room_id: 'room-a' })).ok, true);
    assert.equal(rec.readRecord(baseB, 'job-r7', 'room-b'), null);
    assert.ok(rec.readRecord(baseA, 'job-r7', 'room-a'));
    // a copy of the file placed in the folder of room B still does not read for room B
    fs.mkdirSync(baseB, { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(baseA, 'job-r7.json'), path.join(baseB, 'job-r7.json'));
    assert.equal(rec.readRecord(baseB, 'job-r7', 'room-b'), null, 'the room id inside the record must match');
    const where = rec.findInOtherRooms({ room_id: 'room-c', env: ENV }, 'job-r7');
    assert.ok(where && typeof where.room_id === 'string', 'findInOtherRooms found nothing');
  });

  await arm('R8', 'updateRecord changes only last_status, last_status_at, terminal and manifest_sha256', async () => {
    need();
    const base = baseFor('room-a');
    rec.recordStart(base, make('job-r8'));
    const before = rec.readRecord(base, 'job-r8', 'room-a');
    const patch = { last_status: 'completed', last_status_at: iso(Date.now()), terminal: true, manifest_sha256: hex('manifest') };
    const done = rec.updateRecord(base, 'job-r8', patch);
    assert.equal(done.ok, true, JSON.stringify(done));
    const after = rec.readRecord(base, 'job-r8', 'room-a');
    for (const key of Object.keys(before)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) assert.deepEqual(after[key], patch[key], key);
      else assert.deepEqual(after[key], before[key], 'changed: ' + key);
    }
    for (const bad of [{ room_id: 'room-z' }, { job_id: 'job-x' }, { text: 'x' }, { scope_id: 'other' }, { terminal: 'yes' }]) {
      assert.throws(() => rec.updateRecord(base, 'job-r8', bad), TypeError, JSON.stringify(bad));
    }
    assert.deepEqual(rec.readRecord(base, 'job-r8', 'room-a'), after);
    assert.equal(rec.updateRecord(base, 'job-none', { terminal: true }).ok, false);
  });

  await arm('R9', 'the write is atomic: temp file then rename; nothing is left behind', async () => {
    need();
    const base = baseFor('room-atomic');
    assert.equal(rec.recordStart(base, make('job-r9', { room_id: 'room-atomic' })).ok, true);
    assert.deepEqual(filesIn(base), ['job-r9.json'], 'a temp file remains after success');
    const source = fs.readFileSync(MODULE, 'utf8');
    assert.ok(/renameSync/.test(source), 'no rename in the module');
    // a failed rename leaves the old record intact and no temp file
    const old = fs.readFileSync(path.join(base, 'job-r9.json'), 'utf8');
    const realRename = fs.renameSync;
    fs.renameSync = () => { throw new Error('rename blocked'); };
    let result;
    try { result = rec.updateRecord(base, 'job-r9', { terminal: true, last_status: 'completed', last_status_at: iso(Date.now()) }); }
    catch (_error) { result = { ok: false }; }
    finally { fs.renameSync = realRename; }
    assert.equal(result.ok, false, 'a failed rename must not report success');
    assert.equal(fs.readFileSync(path.join(base, 'job-r9.json'), 'utf8'), old, 'the old record changed');
    assert.deepEqual(filesIn(base), ['job-r9.json'], 'a temp file remains after a failed rename');
  });

  try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed ? 1 : 0);
}

main();
