#!/usr/bin/env node
'use strict';

/*
 * Phase 365-07 Task 1 -- the room never-do list: reader, matcher,
 * declared-field extractors, trips and proposals (M1..M11).
 *
 * Fail shut (D-13), fresh read (no cache), literal matching over declared
 * fields (D-11), add-only trips without the why (D-12), a pre-filled proposal
 * (D-14), the floor sentence (D-15).
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

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(REPO_ROOT, 'lib', 'core', 'room-constraints.cjs');
const rc = require(MODULE);

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

const VIA = { surface: 'cli', decision_node_id: 'decision-365-test' };
function entry(kind, value, why) {
  return { kind, value, why: why === undefined ? 'a plain reason' : why, approved_via: VIA, approved_at: '2026-10-01T00:00:00.000Z' };
}
function mkRoom() { return fs.mkdtempSync(path.join(os.tmpdir(), 'nd365-core-')); }
function putFile(room, obj, raw) {
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.mindrian', 'never-do.json'),
    raw !== undefined ? raw : JSON.stringify(obj), 'utf8');
}
function listOf(entries) { return { schema: 'mos.room-constraints/1', entries }; }

const rooms = [];
function room() { const r = mkRoom(); rooms.push(r); return r; }

// ---- M1 reader shapes -------------------------------------------------------
{
  const r = room();
  const missing = rc.readNeverDo(r);
  check('M1 missing file is an empty list', missing.ok === true && missing.entries.length === 0);

  putFile(r, {});
  check('M1 empty object is wrong_schema', rc.readNeverDo(r).reason === 'wrong_schema');
  putFile(r, { schema: 'mos.other/1', entries: [] });
  check('M1 wrong schema string is wrong_schema', rc.readNeverDo(r).reason === 'wrong_schema');
  putFile(r, null, '{ not json');
  check('M1 invalid JSON is malformed', rc.readNeverDo(r).reason === 'malformed');

  const bad = [
    ['unknown kind', entry('other', 'x')],
    ['empty value', entry('command', '   ')],
    ['value over 200', entry('command', 'x'.repeat(201))],
    ['empty why', entry('command', '/mos:x', '')],
    ['why over 300', entry('command', '/mos:x', 'y'.repeat(301))],
    ['missing approved_via', { kind: 'command', value: '/mos:x', why: 'w' }],
    ['bad surface', Object.assign(entry('command', '/mos:x'), { approved_via: { surface: 'web', decision_node_id: 'd' } })],
  ];
  bad.forEach(function (b) {
    putFile(r, listOf([entry('command', '/mos:ok'), b[1]]));
    const res = rc.readNeverDo(r);
    check('M1 ' + b[0] + ' is invalid_entry at index 1',
      res.ok === false && res.reason === 'invalid_entry' && res.index === 1, JSON.stringify(res));
  });
  putFile(r, listOf([entry('command', '/mos:ok')]));
  const good = rc.readNeverDo(r);
  check('M1 a valid file reads back', good.ok === true && good.entries.length === 1 && good.entries[0].value === '/mos:ok');
}

// ---- M2 fresh read ---------------------------------------------------------
{
  const r = room();
  putFile(r, listOf([entry('command', '/mos:one')]));
  const a = rc.readNeverDo(r);
  putFile(r, listOf([entry('command', '/mos:two'), entry('section', 'market-analysis')]));
  const b = rc.readNeverDo(r);
  check('M2 a rewrite in the same process is seen at once',
    a.entries[0].value === '/mos:one' && b.entries.length === 2 && b.entries[0].value === '/mos:two');
}

// ---- M3 unsafe paths -------------------------------------------------------
{
  const r = room();
  ['/etc/passwd', 'C:/x', 'c:\\x', 'research\\raw', 'a/../b', '..', 'research/../x'].forEach(function (p) {
    putFile(r, listOf([entry('path', p)]));
    const res = rc.readNeverDo(r);
    check('M3 path ' + JSON.stringify(p) + ' is invalid_entry', res.ok === false && res.reason === 'invalid_entry');
  });
  putFile(r, listOf([entry('path', 'research/raw')]));
  check('M3 a plain relative path is accepted', rc.readNeverDo(r).ok === true);
}

// ---- M4 matchFields --------------------------------------------------------
{
  const e = [
    entry('command', '/mos:whitespace'),
    entry('section', 'market-analysis'),
    entry('provider', 'openalex'),
    entry('term', 'Solid State Battery'),
    entry('path', 'research/raw'),
  ];
  const only = function (f) { return rc.matchFields(e, Object.assign({ command: null, section: null, path: null, provider: null, term: null }, f)); };
  check('M4 command matches exactly', only({ command: '/mos:whitespace' }) !== null);
  check('M4 command does not match a longer string', only({ command: '/mos:whitespace2' }) === null);
  check('M4 command is case sensitive', only({ command: '/MOS:whitespace' }) === null);
  check('M4 section matches exactly', only({ section: 'market-analysis' }) !== null);
  check('M4 section does not match a prefix', only({ section: 'market' }) === null);
  check('M4 provider matches any listed value', only({ provider: ['room', 'openalex'] }) !== null);
  check('M4 provider miss', only({ provider: ['room'] }) === null);
  check('M4 term trims and lowercases', only({ term: ['solid state battery '] }) !== null);
  check('M4 term is never a substring', only({ term: ['solid state battery pack'] }) === null && only({ term: ['state'] }) === null);
  check('M4 path matches itself', only({ path: 'research/raw' }) !== null);
  check('M4 path matches a child', only({ path: 'research/raw/x.md' }) !== null);
  check('M4 path never matches a sibling prefix', only({ path: 'research/rawdata' }) === null);
  check('M4 path matches after normalization', only({ path: './research//raw/../raw/y.md' }) !== null);
  check('M4 an empty field set matches nothing', only({}) === null);
}

// ---- M5 the why is never matched --------------------------------------------
{
  const e = [entry('section', 'finances', 'because /mos:whitespace writes there')];
  check('M5 an entry whose why names the command does not match on why',
    rc.matchFields(e, { command: '/mos:whitespace', section: null, path: null, provider: null, term: null }) === null);
}

// ---- M6 checkStep ----------------------------------------------------------
{
  const r = room();
  const none = { command: '/mos:x', section: null, path: null, provider: null, term: null };
  check('M6 no file -> halt:false', rc.checkStep(r, none).halt === false);

  putFile(r, listOf([entry('command', '/mos:x', 'why text')]));
  const hit = rc.checkStep(r, none);
  check('M6 a match halts with constraint_named and the entry',
    hit.halt === true && hit.reason === 'constraint_named' &&
    hit.entry.kind === 'command' && hit.entry.value === '/mos:x' && hit.entry.why === 'why text');
  check('M6 a non-matching step is not halted',
    rc.checkStep(r, { command: '/mos:y', section: null, path: null, provider: null, term: null }).halt === false);

  [
    function () { putFile(r, null, '{ broken'); },
    function () { putFile(r, {}); },
    function () { putFile(r, listOf([entry('other', 'x')])); },
  ].forEach(function (mk, i) {
    mk();
    const res = rc.checkStep(r, { command: '/mos:unrelated', section: null, path: null, provider: null, term: null });
    check('M6 malformed variant ' + i + ' halts shut even for an unrelated step',
      res.halt === true && res.reason === 'constraints_malformed' && typeof res.detail === 'string' && res.detail.length > 0);
  });
}

// ---- M7 chain step fields ---------------------------------------------------
{
  const f = rc.declaredFieldsOfChainStep({ command: '/mos:x' }, { targetSection: 's' });
  check('M7 unknown command: command and section set, path null, provider and term null',
    f.command === '/mos:x' && f.section === 's' && f.path === null && f.provider === null && f.term === null, JSON.stringify(f));
  const g = rc.declaredFieldsOfChainStep({ command: '/mos:snapshot' }, {});
  check('M7 a command that declares produces fills path', g.path === 'exports/hub.html' && g.section === null, JSON.stringify(g));
  const h = rc.declaredFieldsOfChainStep({ command: 42 }, null);
  check('M7 a junk step yields nulls, never throws', h.command === null && h.path === null);
}

// ---- M8 ambient plan fields -------------------------------------------------
{
  const qs = {
    command: '/mos:whitespace',
    leaves: [
      { id: 'L1', researchable: true },
      { id: 'L2', researchable: true, corpus: 'openalex' },
      { id: 'L3', researchable: true, corpus: 'room' },
      { id: 'L4', researchable: true, corpus: 'room' },
      { id: 'L5', researchable: false, corpus: 'hidden' },
    ],
  };
  const plan = { return_target: { section: 'market-analysis' } };
  const grant = { approved_terms: [
    { term: 'Solid State', synonyms: ['SSB', 'solid-state cell'] },
    { term: 'other', synonyms: ['nope'] },
  ] };
  const f = rc.declaredFieldsOfAmbientPlan(qs, plan, ' solid state ', grant);
  check('M8 command from the question set', f.command === '/mos:whitespace');
  check('M8 section from return_target', f.section === 'market-analysis');
  check('M8 provider is the distinct researchable corpora',
    JSON.stringify(f.provider) === JSON.stringify(['openalex', 'room']), JSON.stringify(f.provider));
  check('M8 term is the zone term plus approved synonyms only',
    JSON.stringify(f.term) === JSON.stringify(['solid state', 'SSB', 'solid-state cell']), JSON.stringify(f.term));
  check('M8 path is null', f.path === null);
}

// ---- M9 recordTrip ---------------------------------------------------------
{
  const r = room();
  const rr = rc.recordTrip(r, {
    surface: 'chain', reason: 'constraint_named', kind: 'section', value: 'finances',
    step_command: '/mos:x', run_id: 'run-1', why: 'SECRET WHY SENTENCE',
  });
  const rr2 = rc.recordTrip(r, { surface: 'ambient', reason: 'constraints_malformed', run_id: 'run-2' });
  check('M9 recordTrip reports ok', rr.ok === true && rr2.ok === true);
  const raw = fs.readFileSync(path.join(r, '.mindrian', 'constraint-trips.jsonl'), 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  check('M9 exactly one line per call', lines.length === 2, String(lines.length));
  const parsed = lines.map(function (l) { return JSON.parse(l); });
  const keys = ['schema', 'at', 'surface', 'reason', 'kind', 'value', 'step_command', 'run_id'];
  check('M9 every line is valid JSON with the schema and the expected keys',
    parsed.every(function (p) { return p.schema === 'mos.constraint-trip/1' && keys.every(function (k) { return Object.prototype.hasOwnProperty.call(p, k); }); }));
  check('M9 no why key and no why text anywhere',
    parsed.every(function (p) { return !Object.prototype.hasOwnProperty.call(p, 'why'); }) && raw.indexOf('SECRET WHY') === -1);
  check('M9 the matched literal is recorded', parsed[0].kind === 'section' && parsed[0].value === 'finances' && parsed[0].run_id === 'run-1');
  const asFile = path.join(r, 'plain-file');
  fs.writeFileSync(asFile, 'x');
  const bad = rc.recordTrip(asFile, { surface: 'x' });
  check('M9 recordTrip never throws on a bad directory', bad && bad.ok === false);
}

// ---- M10 proposalFromFields -------------------------------------------------
{
  const ambient = rc.proposalFromFields({
    command: '/mos:whitespace', section: 'market-analysis', path: null,
    provider: ['openalex', 'room'], term: ['solid state', 'SSB'],
  }, { surface: 'ambient research' });
  check('M10 an ambient run pre-fills its term', ambient.kind === 'term' && ambient.value === 'solid state', JSON.stringify(ambient));
  check('M10 the why is one plain sentence naming surface and verb',
    ambient.why === 'Never let an unattended ambient research step search for solid state.', ambient.why);
  check('M10 at most 2 alternatives, in specificity order, none repeating the pick',
    ambient.alternatives.length === 2 && ambient.alternatives[0].kind === 'section' && ambient.alternatives[1].kind === 'provider');

  const chain = rc.proposalFromFields({ command: '/mos:snapshot', section: 'finances', path: 'exports/hub.html', provider: null, term: null }, { surface: 'chain' });
  check('M10 a chain step falls to path first', chain.kind === 'path' && chain.value === 'exports/hub.html' &&
    chain.why === 'Never let an unattended chain step write to exports/hub.html.');
  const chain2 = rc.proposalFromFields({ command: '/mos:x', section: 's', path: null, provider: null, term: null }, { surface: 'chain' });
  check('M10 a chain step with no path falls to section', chain2.kind === 'section' && chain2.alternatives.length === 1 && chain2.alternatives[0].kind === 'command');
  const cmd = rc.proposalFromFields({ command: '/mos:x' }, { surface: 'chain' });
  check('M10 command verb is run', cmd.kind === 'command' && cmd.why.indexOf(' run /mos:x.') !== -1 && cmd.alternatives.length === 0);
  check('M10 the section verb is file into',
    rc.proposalFromFields({ section: 's' }, { surface: 'chain' }).why.indexOf('file into s') !== -1);
  check('M10 the provider verb is query',
    rc.proposalFromFields({ provider: ['p'] }, { surface: 'chain' }).why.indexOf('query p') !== -1);
  check('M10 nothing declared -> null',
    rc.proposalFromFields({ command: null, section: null, path: null, provider: [], term: [] }) === null);
  check('M10 an unsafe declared path is skipped, not proposed',
    rc.proposalFromFields({ path: '../escape', command: '/mos:x' }, { surface: 'chain' }).kind === 'command');
}

// ---- M11 floor sentence and source hygiene ----------------------------------
{
  check('M11 FLOOR_SENTENCE is exact',
    rc.FLOOR_SENTENCE === 'This list catches only what has been named. It is a floor, not a guarantee.');
  check('M11 SCHEMA and KINDS', rc.SCHEMA === 'mos.room-constraints/1' &&
    ['command', 'section', 'path', 'provider', 'term'].every(function (k) { return rc.KINDS.has(k); }) && rc.KINDS.size === 5);
  const src = fs.readFileSync(MODULE, 'utf8');
  const code = src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');
  check('M11 no network token in non-comment source',
    !/brain-client|brain_query|pws-brain|fetch\(|https?:\/\/|node:https?|curl |wget /.test(code));
  check('M11 no navigation require', !/require\([^)]*navigation/.test(code));
  check('M11 no module-level cache', !/^\s*let _cache|_fresh/m.test(src));
  check('M11 no em-dash or en-dash in the module', !/[\u2013\u2014]/.test(src));
}

check('the run made no network attempt', net.attempts() === 0);
rooms.forEach(function (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
net.restore();

if (hardFail > 0) {
  process.stdout.write('FAIL: ' + hardFail + ' check(s) failed\n');
  process.exit(1);
}
process.stdout.write('PASS: test-365-never-do-core\n');
process.exit(0);
