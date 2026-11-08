#!/usr/bin/env node
'use strict';

/*
 * Phase 389 plan 06 task 1: the save, show and upgrade commands of
 * scripts/pyramid-seed-run.cjs. The real CLI runs as a child process with a
 * scratch HOME. No network call, no Brain call, no Tavily call. The fixture
 * room is hashed before and after to prove that upgrade only reads.
 * Plain counters. One line per behavior. Exit 1 on a failure.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/pyramid-seed-run.cjs');
const ROOM = path.join(ROOT, 'tests/fixtures/389/room');
const SENTENCES = require('./fixtures/389/sentences.json');
const SPROUTS = require('./fixtures/389/sprouts.json');

const rec = require(path.join(ROOT, 'lib/core/pyramid-seed-record.cjs'));
const upg = require(path.join(ROOT, 'lib/core/pyramid-seed-upgrade.cjs'));

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass += 1; console.log('ok   ' + name); }
  else { fail += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function mkHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'seed-cli-')); }
function writeJson(dir, name, obj) { const p = path.join(dir, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; }
function writeText(dir, name, s) { const p = path.join(dir, name); fs.writeFileSync(p, s); return p; }

function hashTree(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { h.update('d:' + path.relative(dir, p)); walk(p); }
      else { h.update('f:' + path.relative(dir, p)); h.update(fs.readFileSync(p)); }
    });
  })(dir);
  return h.digest('hex');
}

function listTree(dir) {
  const out = [];
  (function walk(d) {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    ents.forEach((e) => { const p = path.join(d, e.name); out.push(path.relative(dir, p)); if (e.isDirectory()) walk(p); });
  })(dir);
  return out.sort();
}

function run(args, home) {
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home };
  const r = spawnSync(process.execPath, [SCRIPT].concat(args), { env, cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_e) { json = null; }
  return { code: r.status, out: r.stdout, err: r.stderr, json };
}

const SENTENCE = SENTENCES[0].sentence;
const ID = rec.idFor ? rec.idFor(SENTENCE) : null;

function goodRecord(over) {
  return Object.assign({
    schema: 'mos.pyramid-seed/1',
    id: ID,
    created_at: '2026-11-08T08:00:00.000Z',
    depth: 'seed',
    situation: 'People who live alone often cook for nobody and fall back on takeaway on tired evenings.',
    complication: 'Large meal kits feed several people and lock in a weekly plan, so they do not fit one person.',
    question: 'Would a monthly box with one proper dinner a week make these people stop ordering takeaway?',
    answer: 'Yes, if each box holds exact amounts, a recipe card and a short video, and asks for no weekly commitment.',
    support: [
      { group: 'The weekday takeaway habit is costly', claims: ['People who live alone order takeaway because cooking for one feels like too much work after a long day.'] },
      { group: 'Shopping and amounts are the real barrier', claims: ['A recipe with exact amounts, already bought, would change what a person does on a weeknight.'] },
      { group: 'One meal a week is a small enough promise', claims: ['None of the people asked wanted a commitment of more than one meal.'] },
    ],
    objection: 'A person who cooks on Sunday and eats leftovers until Wednesday may never feel the need for a weekly dinner.',
    evidence: [{ cell: 'similar_cases', status: 'ok', summary_line: 'A case of a small subscription box.' }],
  }, over || {});
}

const briefsDir = (home) => path.join(home, '.mindrian', 'pyramid-seed', 'briefs');

// ---------------------------------------------------------------------------
// Test 1: save
// ---------------------------------------------------------------------------
(function testSave() {
  check('Test 0: idFor exists in the record module', typeof rec.idFor === 'string' || typeof rec.idFor === 'function');
  const home = mkHome();
  const work = mkHome();
  const record = goodRecord();
  const recFile = writeJson(work, 'rec.json', record);
  const sentFile = writeText(work, 'sentence.txt', SENTENCE + '\n');
  const r = run(['save', '--record', recFile, '--sentence-file', sentFile, '--home', home], home);
  check('Test 1.1: save exits 0', r.code === 0, 'code ' + r.code + ' err ' + r.err.slice(0, 200));
  check('Test 1.2: save prints { ok, id, path, receipt }', !!r.json && r.json.ok === true && r.json.id === ID && typeof r.json.path === 'string' && typeof r.json.receipt === 'string');
  check('Test 1.3: path is under <home>/.mindrian/pyramid-seed/briefs', !!r.json && typeof r.json.path === 'string' && r.json.path.indexOf(briefsDir(home)) === 0 && fs.existsSync(r.json.path));
  check('Test 1.4: receipt equals renderReceipt(record)', !!r.json && r.json.receipt === rec.renderReceipt(record));
  const files = listTree(home).filter((p) => p.indexOf('pyramid-seed') !== -1);
  check('Test 1.5: only the briefs file was written under the seed folder', files.every((p) => p.indexOf(path.join('.mindrian', 'pyramid-seed', 'briefs')) === 0 || p === '.mindrian' || p === path.join('.mindrian', 'pyramid-seed')) && files.filter((p) => /\.json$/.test(p)).length === 1, files.join(','));
  check('Test 1.6: the sentence text is not stored or printed', !!r.json && typeof r.json.path === 'string' && !r.out.includes(SENTENCE.slice(0, 40)) && fs.existsSync(r.json.path) && !fs.readFileSync(r.json.path, 'utf8').includes(SENTENCE.slice(0, 40)));

  // invalid record
  const home2 = mkHome();
  const bad = goodRecord(); delete bad.answer;
  const badFile = writeJson(work, 'bad.json', bad);
  const rb = run(['save', '--record', badFile, '--sentence-file', sentFile, '--home', home2], home2);
  check('Test 1.7: invalid record exits 2 with an error code', rb.code === 2 && !!rb.json && rb.json.ok !== true && typeof (rb.json.code || rb.json.error) === 'string', 'code ' + rb.code + ' ' + rb.out.slice(0, 200));
  check('Test 1.8: invalid record writes nothing', !fs.existsSync(briefsDir(home2)));

  // wrong id
  const home3 = mkHome();
  const wrong = goodRecord({ id: 'deadbeef' });
  const wrongFile = writeJson(work, 'wrong.json', wrong);
  const rw = run(['save', '--record', wrongFile, '--sentence-file', sentFile, '--home', home3], home3);
  check('Test 1.9: wrong id exits 2 and writes nothing', rw.code === 2 && !fs.existsSync(briefsDir(home3)), 'code ' + rw.code);
})();

// ---------------------------------------------------------------------------
// Test 2: show
// ---------------------------------------------------------------------------
(function testShow() {
  const home = mkHome();
  const older = goodRecord({ id: '11111111', created_at: '2026-11-07T08:00:00.000Z' });
  const newer = goodRecord({ id: '22222222', created_at: '2026-11-08T09:00:00.000Z' });
  const w1 = rec.writeRecord(older, { home });
  const w2 = rec.writeRecord(newer, { home });
  check('Test 2.0: fixtures written by the module', !!(w1 && w1.ok && w2 && w2.ok));
  const r = run(['show', '--id', '11111111', '--home', home], home);
  check('Test 2.1: show --id exits 0 with the resolveFromBrief action', r.code === 0 && !!r.json && r.json.action === 'ignite_from_brief' && r.json.sha8 === '11111111', 'code ' + r.code + ' ' + r.out.slice(0, 200));
  check('Test 2.2: show prints the receipt', !!r.json && (r.json.receipt === rec.renderReceipt(older) || (r.json.brief_content && r.json.brief_content.receipt === rec.renderReceipt(older))));
  const l = run(['show', '--latest', '--home', home], home);
  check('Test 2.3: show --latest picks the newest record', l.code === 0 && !!l.json && l.json.sha8 === '22222222', l.out.slice(0, 200));
  const home2 = mkHome();
  const m = run(['show', '--id', '33333333', '--home', home2], home2);
  check('Test 2.4: a missing id exits 4 with no_brief_available', m.code === 4 && !!m.json && m.json.action === 'no_brief_available', 'code ' + m.code + ' ' + m.out.slice(0, 200));
  const m2 = run(['show', '--latest', '--home', home2], home2);
  check('Test 2.5: --latest with no record exits 4', m2.code === 4 && !!m2.json && m2.json.action === 'no_brief_available', 'code ' + m2.code);
})();

// ---------------------------------------------------------------------------
// Test 3: upgrade
// ---------------------------------------------------------------------------
(function testUpgrade() {
  const home = mkHome();
  const record = goodRecord({ id: 'a1b2c3d4' });
  rec.writeRecord(record, { home });
  const before = hashTree(ROOM);
  const r = run(['upgrade', '--record', 'a1b2c3d4', '--room', ROOM, '--home', home], home);
  const after = hashTree(ROOM);
  check('Test 3.1: upgrade exits 0', r.code === 0, 'code ' + r.code + ' ' + (r.err || r.out).slice(0, 300));
  const j = r.json || {};
  check('Test 3.2: upgrade prints the named fields', j.ok === true && typeof j.status === 'string' && Array.isArray(j.additions) && Array.isArray(j.mece_warnings) && Array.isArray(j.uncovered) && Array.isArray(j.room_evidence) && typeof j.report === 'string');
  const expected = upg.upgradeSeed(record, { roomDir: ROOM });
  check('Test 3.3: report equals renderUpgrade(result)', j.report === upg.renderUpgrade(expected));
  check('Test 3.4: the three additions are listed', Array.isArray(j.additions) && j.additions.length === 3);
  check('Test 3.5: the report never says MECE verified', !/MECE verified/i.test(r.out));
  check('Test 3.6: room evidence names a fixture note', Array.isArray(j.room_evidence) && j.room_evidence.length >= 1);
  check('Test 3.7: the fixture room is byte identical', before === after);
  const miss = run(['upgrade', '--record', '99999999', '--room', ROOM, '--home', home], home);
  check('Test 3.8: a missing record exits 4', miss.code === 4, 'code ' + miss.code);
  const noroom = run(['upgrade', '--record', 'a1b2c3d4', '--room', path.join(home, 'no-such-room'), '--home', home], home);
  check('Test 3.9: a room path that does not exist gives ok true and empty room_evidence', noroom.code === 0 && !!noroom.json && noroom.json.ok === true && noroom.json.room_evidence.length === 0, 'code ' + noroom.code);
})();

// ---------------------------------------------------------------------------
// Test 4: card and run still behave; usage line
// ---------------------------------------------------------------------------
(function testOld() {
  const home = mkHome();
  const work = mkHome();
  const sprouts = writeJson(work, 'sprouts.json', SPROUTS['consumer-subscription']);
  const sentFile = writeText(work, 'sentence.txt', SENTENCE);
  const c = run(['card', '--sprouts', sprouts, '--sentence-file', sentFile, '--home', home], home);
  check('Test 4.1: card exits 0 with a hash', c.code === 0 && !!c.json && /^[0-9a-f]{64}$/.test(c.json.sprouts_sha256 || ''), 'code ' + c.code);
  const rr = run(['run', '--sprouts', sprouts, '--confirm', 'f'.repeat(64), '--home', home], home);
  check('Test 4.2: run with a wrong hash exits 3 card_required', rr.code === 3 && !!rr.json && rr.json.error === 'card_required');
  const u = run(['frobnicate'], home);
  check('Test 4.3: an unknown subcommand exits 1', u.code === 1);
  check('Test 4.4: the usage line lists card, run, save, show and upgrade', ['card', 'run', 'save', 'show', 'upgrade'].every((w) => u.err.indexOf(w) !== -1), u.err);
})();

// ---------------------------------------------------------------------------
// Test 5: static
// ---------------------------------------------------------------------------
(function testStatic() {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  check('Test 5.1: no room-db require', !/require\([^)]*room[-_.]?db/i.test(src) && !/node:sqlite/.test(src));
  check('Test 5.2: no em dash or en dash', !new RegExp('[\\u2013\\u2014]').test(src));
  check('Test 5.3: pure ASCII', !/[^\x00-\x7f]/.test(src));
  check('Test 5.4: the script takes its home from --home or os.homedir()', /--home/.test(src) && /os\.homedir\(\)/.test(src));
  check('Test 5.5: the script requires the record and upgrade modules', /pyramid-seed-record/.test(src) && /pyramid-seed-upgrade/.test(src));
})();

console.log('test-389-seed-cli: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
