#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a): rules G1 and G2 (the exact host-read
// set and the exact pending set of each surface file against
// data/tool-grants.json), the idempotence of the 2 codemods, and mutation arms
// of the CLI. The rules live in scripts/check-tool-grants.cjs; this test
// requires it and copies no rule.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-tool-grants.cjs');
const grants = require('../scripts/check-tool-grants.cjs');
const split = require('../scripts/check-frontmatter-split.cjs');
const brainCodemod = require('../tools/401/brain-name-codemod.cjs');
const grantsCodemod = require('../tools/401/tool-grants-codemod.cjs');

// A change of one of these constants needs an owner record in the same commit
// (owner ruling O8; Option A of 401-F1-PERMISSION-AUDIT.md).
const EXPECT = {
  hostFiles: 118,
  hostEntries: 449,
  pendingFiles: 109,
  pendingEntries: 516,
  hostBareBash: 100,
  hostWrite: 47,
};

const HOST_FIELDS_DOC = [
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments',
  'disable-model-invocation', 'user-invocable', 'allowed-tools', 'disallowed-tools',
  'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility',
];

let passed = 0;
let failed = 0;
function leg(id, text, fn) {
  let res = null;
  try {
    res = fn();
  } catch (e) {
    res = { msg: 'threw: ' + (e && e.message ? e.message : String(e)) };
  }
  if (res) {
    failed += 1;
    process.stdout.write('FAIL: ' + id + ' ' + text + ' -- ' + res.msg + '\n');
    if (res.count !== undefined) process.stdout.write('count: ' + id + ' ' + res.count + '\n');
  } else {
    passed += 1;
    process.stdout.write('ok: ' + id + ' ' + text + '\n');
  }
}

const FIXTURE = grants.readFixture(ROOT);
const FILES = split.listSurfaceFiles(ROOT);

function diffsOf(kind) {
  if (!FIXTURE) return null;
  return grants.compareToFixture(ROOT, FIXTURE).filter((d) => d.kind === kind || d.kind === kind + '-absent');
}

function describe(ds) {
  return ds.slice(0, 8).map((d) => d.rel + (d.extra.length ? ' extra=' + d.extra.join(',') : '') + (d.missing.length ? ' missing=' + d.missing.join(',') : '')).join('; ');
}

leg('G1', 'rule G1: the host-read set of each file equals the fixture', () => {
  const ds = diffsOf('host');
  if (!ds) return { msg: 'fixture missing' };
  const files = new Set(ds.map((d) => d.rel));
  return ds.length ? { msg: files.size + ' files differ: ' + describe(ds), count: files.size } : null;
});

leg('G2', 'rule G2: the pending set of each file equals the fixture', () => {
  const ds = diffsOf('pending');
  if (!ds) return { msg: 'fixture missing' };
  const files = new Set(ds.map((d) => d.rel));
  return ds.length ? { msg: files.size + ' files differ: ' + describe(ds), count: files.size } : null;
});

leg('G3', 'fixture totals equal the pinned constants; no fixture entry matches PB; no pending agent', () => {
  if (!FIXTURE) return { msg: 'fixture missing' };
  const t = grants.totals(FIXTURE);
  let bash = 0;
  let write = 0;
  const pb = [];
  for (const rel of Object.keys(FIXTURE.host)) {
    const s = grants.fixtureSet(FIXTURE, 'host', rel);
    if (s.includes('Bash')) bash += 1;
    if (s.includes('Write')) write += 1;
  }
  for (const id of Object.keys(FIXTURE.sets)) for (const e of FIXTURE.sets[id]) if (grants.entryMatchesPB(e)) pb.push(e);
  const agents = Object.keys(FIXTURE.pending).filter((r) => r.startsWith('agents/'));
  const got = { hostFiles: t.hostFiles, hostEntries: t.hostEntries, pendingFiles: t.pendingFiles, pendingEntries: t.pendingEntries, hostBareBash: bash, hostWrite: write };
  const errs = Object.keys(EXPECT).filter((k) => EXPECT[k] !== got[k]).map((k) => k + ' ' + got[k] + ' (expected ' + EXPECT[k] + ')');
  if (pb.length) errs.push('PB entries: ' + pb.join(','));
  if (agents.length) errs.push('pending agents: ' + agents.join(','));
  return errs.length ? { msg: errs.join('; ') } : null;
});

leg('G4', 'no file holds both keys; the pending key is not a host field; the host field list is the documented 20', () => {
  const errs = [];
  for (const f of FILES) if (grants.readGrants(fs.readFileSync(path.join(ROOT, f.rel), 'utf8')).bothKeys) errs.push('both keys: ' + f.rel);
  if (grants.HOST_FIELDS.includes(grants.PENDING_KEY)) errs.push('PENDING_KEY is a host field');
  if (JSON.stringify(grants.HOST_FIELDS) !== JSON.stringify(HOST_FIELDS_DOC)) errs.push('HOST_FIELDS differs from the documented list');
  if (grants.HOST_FIELDS.length !== 20) errs.push('HOST_FIELDS has ' + grants.HOST_FIELDS.length + ' names');
  return errs.length ? { msg: errs.join('; ') } : null;
});

function inPending(rel) {
  return !!FIXTURE && Object.prototype.hasOwnProperty.call(FIXTURE.pending || {}, rel);
}

leg('G5', 'idempotence on disk: both codemods leave each command unchanged', () => {
  const bad = [];
  for (const f of FILES.filter((x) => x.cls === 'commands')) {
    const t = fs.readFileSync(path.join(ROOT, f.rel), 'utf8');
    if (brainCodemod.transform(t).changed) bad.push(f.rel + ' (brain-name)');
    if (grantsCodemod.transform(t, { inPending: inPending(f.rel) }).changed) bad.push(f.rel + ' (tool-grants)');
  }
  return bad.length ? { msg: bad.length + ' changes: ' + bad.slice(0, 5).join(' ') } : null;
});

leg('G6', 'idempotence in memory: f(f(t)) equals f(t) for each command and each codemod', () => {
  const bad = [];
  for (const f of FILES.filter((x) => x.cls === 'commands')) {
    const t = fs.readFileSync(path.join(ROOT, f.rel), 'utf8');
    const o = { inPending: inPending(f.rel) };
    const b1 = brainCodemod.transform(t).text;
    if (brainCodemod.transform(b1).text !== b1) bad.push(f.rel + ' (brain-name)');
    const g1 = grantsCodemod.transform(t, o).text;
    if (grantsCodemod.transform(g1, o).text !== g1) bad.push(f.rel + ' (tool-grants)');
  }
  return bad.length ? { msg: bad.join(' ') } : null;
});

function runCli(args, cwd) {
  const r = cp.spawnSync(process.execPath, [SCRIPT].concat(args), { cwd: cwd || ROOT, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function tempRoot(files, fixture) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't401-g7-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  if (fixture) {
    fs.mkdirSync(path.join(d, 'data'), { recursive: true });
    fs.writeFileSync(path.join(d, 'data', 'tool-grants.json'), JSON.stringify(fixture, null, 2) + '\n');
  }
  return d;
}

function fx(host, pending) {
  const sets = {};
  const h = {};
  const p = {};
  let n = 0;
  for (const [rel, e] of Object.entries(host || {})) { const id = 's' + n++; sets[id] = e.slice().sort(); h[rel] = id; }
  for (const [rel, e] of Object.entries(pending || {})) { const id = 's' + n++; sets[id] = e.slice().sort(); p[rel] = id; }
  return { schema: 1, generated_from: 'test', pending_key: 'pending_tool_grants', owner_records: [], sets, host: h, pending: p };
}

leg('G7', 'mutation arms of the CLI', () => {
  const errs = [];
  const dirs = [];
  const mk = (files, fixture) => { const d = tempRoot(files, fixture); dirs.push(d); return d; };
  try {
    const clean = '---\nname: x\ndescription: d\nallowed-tools: Bash\n---\nbody\n';
    // (a) a host-read entry that the fixture does not hold
    let d = mk({ 'commands/x.md': clean }, fx({}, {}));
    let r = runCli(['--check', '--root', d]);
    if (r.status !== 1 || r.out.indexOf('commands/x.md') === -1) errs.push('(a) status ' + r.status);
    // (b) a fixture entry that the file does not hold
    d = mk({ 'commands/x.md': clean }, fx({ 'commands/x.md': ['Bash', 'Read'] }, {}));
    r = runCli(['--check', '--root', d]);
    if (r.status !== 1) errs.push('(b) status ' + r.status);
    // (c) comment lines in the new form, list in the fixture as pending only
    const fixed = '---\nname: x\ndescription: d\n# == Phase 122 ==\nallowed-tools:\n  - Bash\n---\nbody\n';
    d = mk({ 'commands/x.md': fixed }, fx({}, { 'commands/x.md': ['Bash'] }));
    r = runCli(['--check', '--root', d]);
    if (r.status !== 1) errs.push('(c) status ' + r.status);
    // (d) a file that equals the fixture
    d = mk({ 'commands/x.md': clean }, fx({ 'commands/x.md': ['Bash'] }, {}));
    r = runCli(['--check', '--root', d]);
    if (r.status !== 0) errs.push('(d) status ' + r.status + ' ' + r.out.trim());
    // (e) no fixture file
    d = mk({ 'commands/x.md': clean }, null);
    r = runCli(['--check', '--root', d]);
    if (r.status !== 1 || r.out.indexOf('fixture missing') === -1) errs.push('(e) status ' + r.status);
    // (f) no --root: the same result from another working directory
    const other = mk({}, null);
    const r1 = runCli(['--check'], ROOT);
    const r2 = runCli(['--check'], other);
    if (r1.status !== r2.status || r1.out !== r2.out) {
      const l1 = r1.out.split('\n');
      const l2 = r2.out.split('\n');
      let k = 0;
      while (k < l1.length && l1[k] === l2[k]) k += 1;
      errs.push('(f) root-relative result differs by working directory: status ' + r1.status + ' vs ' + r2.status +
        ', bytes ' + r1.out.length + ' vs ' + r2.out.length + ', first differing line ' + (k + 1) + ': ' +
        JSON.stringify(l1[k]) + ' vs ' + JSON.stringify(l2[k]));
    }
    // (g) prune mode
    const base = fx({ 'commands/x.md': ['Bash'], 'commands/gone.md': ['Read'] }, {});
    d = mk({ 'commands/x.md': clean }, base);
    const fxPath = path.join(d, 'data', 'tool-grants.json');
    const before = fs.readFileSync(fxPath, 'utf8');
    r = runCli(['--prune-missing', '--root', d]);
    if (r.status !== 2 || fs.readFileSync(fxPath, 'utf8') !== before) errs.push('(g) no record: status ' + r.status);
    r = runCli(['--prune-missing', '--owner-record', 'test record', '--root', d]);
    const after = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
    if (r.status !== 0) errs.push('(g) status ' + r.status);
    if ('commands/gone.md' in after.host) errs.push('(g) row not deleted');
    if (!('commands/x.md' in after.host)) errs.push('(g) a live row was deleted');
    if (Object.keys(after.sets).length !== 1) errs.push('(g) unused set kept');
    if (Object.keys(after.host).length + Object.keys(after.pending).length > Object.keys(base.host).length) errs.push('(g) a row was added');
    const rec = after.owner_records[after.owner_records.length - 1];
    if (!rec || rec.record !== 'test record' || !rec.removed.length) errs.push('(g) record not written');
  } finally {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  }
  return errs.length ? { msg: errs.join('; ') } : null;
});

process.stdout.write('test-401-tool-grants: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
