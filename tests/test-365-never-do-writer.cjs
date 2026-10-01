#!/usr/bin/env node
'use strict';

/*
 * Phase 365-07 Task 2 -- the never-do approval-trail writer (W1..W6).
 *
 * No entry reaches the list without a person's approval on record (D-10, the
 * grants.writeGrant rule): the same approved_via shape and the same refusal
 * reason, approval_required.
 *
 * Exit: 0 PASS, 1 FAIL. No em-dashes (dash characters are spelled as escapes).
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const rc = require(path.resolve(__dirname, '..', 'lib', 'core', 'room-constraints.cjs'));

let hardFail = 0;
function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    process.stdout.write('  ok - ' + label + '\n');
  } catch (_e) {
    hardFail += 1;
    process.stdout.write('  FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n');
  }
}

const VIA = { surface: 'mcp', decision_node_id: 'decision-365-writer' };
const rooms = [];
function room() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'nd365-writer-'));
  rooms.push(r);
  return r;
}
function fileOf(r) { return path.join(r, '.mindrian', 'never-do.json'); }
function exists(f) { return fs.existsSync(f); }

// ---- W1 approval required ---------------------------------------------------
{
  const r = room();
  const e = { kind: 'command', value: '/mos:x', why: 'a plain reason' };
  const cases = [
    ['no opts', undefined],
    ['empty opts', {}],
    ['approved_via missing', { approved_via: null }],
    ['surface web', { approved_via: { surface: 'web', decision_node_id: 'd1' } }],
    ['empty decision_node_id', { approved_via: { surface: 'cli', decision_node_id: '' } }],
    ['missing decision_node_id', { approved_via: { surface: 'cli' } }],
  ];
  cases.forEach(function (c) {
    const res = rc.writeNeverDoEntry(r, e, c[1]);
    check('W1 ' + c[0] + ' -> approval_required', res.ok === false && res.reason === 'approval_required', JSON.stringify(res));
  });
  check('W1 no file written on any refusal', !exists(fileOf(r)) && !exists(path.join(r, '.mindrian')));
}

// ---- W2 entry validation ----------------------------------------------------
{
  const r = room();
  const opts = { approved_via: VIA };
  const cases = [
    ['unknown kind', { kind: 'other', value: 'x', why: 'w' }, 'invalid_kind'],
    ['missing kind', { value: 'x', why: 'w' }, 'invalid_kind'],
    ['empty value', { kind: 'command', value: '  ', why: 'w' }, 'invalid_value'],
    ['over-long value', { kind: 'command', value: 'x'.repeat(201), why: 'w' }, 'invalid_value'],
    ['empty why', { kind: 'command', value: '/mos:x', why: '' }, 'invalid_why'],
    ['over-long why', { kind: 'command', value: '/mos:x', why: 'y'.repeat(301) }, 'invalid_why'],
    ['absolute path', { kind: 'path', value: '/etc/passwd', why: 'w' }, 'invalid_path'],
    ['dotdot path', { kind: 'path', value: 'a/../b', why: 'w' }, 'invalid_path'],
    ['drive path', { kind: 'path', value: 'C:/x', why: 'w' }, 'invalid_path'],
    ['backslash path', { kind: 'path', value: 'a\\b', why: 'w' }, 'invalid_path'],
  ];
  cases.forEach(function (c) {
    const res = rc.writeNeverDoEntry(r, c[1], opts);
    check('W2 ' + c[0] + ' -> ' + c[2], res.ok === false && res.reason === c[2], JSON.stringify(res));
  });
  check('W2 no file written on any rejection', !exists(fileOf(r)));
}

// ---- W3 an unreadable existing file is never overwritten ----------------------
{
  const r = room();
  fs.mkdirSync(path.join(r, '.mindrian'), { recursive: true });
  const bytes = '{ "schema": "mos.room-constraints/1", "entries": [ { oops';
  fs.writeFileSync(fileOf(r), bytes, 'utf8');
  const res = rc.writeNeverDoEntry(r, { kind: 'command', value: '/mos:x', why: 'w' }, { approved_via: VIA });
  check('W3 a malformed existing file -> existing_file_malformed', res.ok === false && res.reason === 'existing_file_malformed', JSON.stringify(res));
  check('W3 the file bytes are unchanged', fs.readFileSync(fileOf(r), 'utf8') === bytes);

  const wrong = '{"schema":"mos.something-else/1","entries":[]}';
  fs.writeFileSync(fileOf(r), wrong, 'utf8');
  const res2 = rc.writeNeverDoEntry(r, { kind: 'command', value: '/mos:x', why: 'w' }, { approved_via: VIA });
  check('W3 a wrong-schema file is also refused and untouched',
    res2.reason === 'existing_file_malformed' && fs.readFileSync(fileOf(r), 'utf8') === wrong);
}

// ---- W4 a valid write -------------------------------------------------------
{
  const r = room();
  const res = rc.writeNeverDoEntry(r, { kind: 'section', value: 'finances', why: 'Money moves only by hand.' }, { approved_via: VIA });
  check('W4 a valid call is ok', res.ok === true && !res.duplicate, JSON.stringify(res));
  const doc = JSON.parse(fs.readFileSync(fileOf(r), 'utf8'));
  check('W4 the file carries the schema', doc.schema === 'mos.room-constraints/1' && Array.isArray(doc.entries) && doc.entries.length === 1);
  const e = doc.entries[0];
  check('W4 the entry carries kind, value, why, approved_via and approved_at',
    e.kind === 'section' && e.value === 'finances' && e.why === 'Money moves only by hand.' &&
    e.approved_via.surface === 'mcp' && e.approved_via.decision_node_id === 'decision-365-writer' &&
    typeof e.approved_at === 'string' && !Number.isNaN(Date.parse(e.approved_at)), JSON.stringify(e));
  const back = rc.readNeverDo(r);
  check('W4 readNeverDo returns ok with that entry', back.ok === true && back.entries.length === 1 && back.entries[0].value === 'finances');
  const leftovers = fs.readdirSync(path.join(r, '.mindrian')).filter(function (n) { return n.indexOf('.tmp') !== -1; });
  check('W4 no tmp file remains', leftovers.length === 0, leftovers.join(','));

  const second = rc.writeNeverDoEntry(r, { kind: 'path', value: './research//raw/', why: 'Raw stays raw.' }, { approved_via: VIA });
  const back2 = rc.readNeverDo(r);
  check('W4 a second kind appends to the list', second.ok === true && back2.entries.length === 2 && back2.entries[1].kind === 'path' && back2.entries[1].value === 'research/raw');
  check('W4 the list status reports the count', rc.listSummary(r).ok === true && rc.listSummary(r).count === 2);
}

// ---- W5 dedupe --------------------------------------------------------------
{
  const r = room();
  const opts = { approved_via: VIA };
  rc.writeNeverDoEntry(r, { kind: 'command', value: '/mos:x', why: 'first reason' }, opts);
  const before = fs.readFileSync(fileOf(r), 'utf8');
  const again = rc.writeNeverDoEntry(r, { kind: 'command', value: '/mos:x', why: 'a different reason' }, { approved_via: { surface: 'cli', decision_node_id: 'other' } });
  check('W5 the same kind and value -> ok with duplicate:true', again.ok === true && again.duplicate === true, JSON.stringify(again));
  check('W5 the file is unchanged', fs.readFileSync(fileOf(r), 'utf8') === before);
  const sameValueOtherKind = rc.writeNeverDoEntry(r, { kind: 'section', value: '/mos:x', why: 'other kind' }, opts);
  check('W5 the same value under another kind is a new entry', sameValueOtherKind.ok === true && !sameValueOtherKind.duplicate && rc.readNeverDo(r).entries.length === 2);
  rc.writeNeverDoEntry(r, { kind: 'term', value: 'Solid State', why: 'term reason' }, opts);
  const termDupe = rc.writeNeverDoEntry(r, { kind: 'term', value: ' solid state ', why: 'term reason' }, opts);
  check('W5 a term dedupes after trim and lowercase', termDupe.duplicate === true);
}

// ---- W6 dashes scrubbed -----------------------------------------------------
{
  const r = room();
  const em = String.fromCharCode(0x2014);
  const en = String.fromCharCode(0x2013);
  const res = rc.writeNeverDoEntry(r, { kind: 'command', value: '/mos:x', why: 'never ' + em + ' ever ' + en + ' again' }, { approved_via: VIA });
  check('W6 the write is ok', res.ok === true);
  const raw = fs.readFileSync(fileOf(r), 'utf8');
  check('W6 the stored why carries hyphens', JSON.parse(raw).entries[0].why === 'never - ever - again', raw);
  check('W6 no dash character reached the file', raw.indexOf(em) === -1 && raw.indexOf(en) === -1);
}

check('the run made no network attempt', net.attempts() === 0);
rooms.forEach(function (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
net.restore();

if (hardFail > 0) {
  process.stdout.write('FAIL: ' + hardFail + ' check(s) failed\n');
  process.exit(1);
}
process.stdout.write('PASS: test-365-never-do-writer\n');
process.exit(0);
