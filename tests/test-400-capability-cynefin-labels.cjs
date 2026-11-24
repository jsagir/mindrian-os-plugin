#!/usr/bin/env node
'use strict';
// Phase 400-06 (S2, CY-04, O-11, O-12): provisional Cynefin labels on the run-step commands.
// Each run-step command carries fits_domains, move_type, move_type_weak and cynefin_label_status
// as own frontmatter keys, derived by scripts/derive-cynefin-labels.cjs from the recorded
// labels-only runs. The repo holds ids, booleans and counts only (T-400-13).
// Legs D1 to D4 run the derive script on a scratch root with synthetic inputs (os.tmpdir()).
// Leg R2 checks the registry fields. Legs Y1 to Y6 check the live tree.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/derive-cynefin-labels.cjs');
const REGISTRY_BUILDER = path.join(ROOT, 'scripts/build-command-registry.cjs');
const ax = require(path.join(ROOT, 'lib/core/problem-axes.cjs'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const LABEL_KEYS = ['fits_domains', 'move_type', 'move_type_weak', 'cynefin_label_status'];
const LABEL_RE = new RegExp('^(' + LABEL_KEYS.join('|') + '):');

function run(args, root) {
  const env = Object.assign({}, process.env);
  if (root) env.MINDRIAN_APPLY_ROOT = root;
  else delete env.MINDRIAN_APPLY_ROOT;
  return cp.spawnSync('node', [SCRIPT].concat(args), { cwd: ROOT, env, encoding: 'utf8' });
}

function fmLines(text) {
  const lines = text.split('\n');
  const idx = [];
  for (let i = 0; i < lines.length && idx.length < 2; i++) if (lines[i].trim() === '---') idx.push(i);
  return idx.length === 2 ? lines.slice(idx[0] + 1, idx[1]) : null;
}

// ---- the scratch root ----
const CMD_A = [
  '---',
  'name: alpha',
  'description: Alpha command',
  'serves_jtbd: ["find-problem"]',
  'job_when: "I hold a thing"',
  'job_want: "to sort it"',
  'job_so: "move on"',
  'job_sentence_status: "provisional"',
  'kind: methodology',
  '---',
  '',
  '# Alpha',
  '',
].join('\n');
const CMD_B = ['---', 'name: beta', 'description: Beta command', 'kind: utility', '---', '', '# Beta', ''].join('\n');
const CMD_C = ['---', 'name: gamma', 'description: Gamma command', '---', '', '# Gamma', ''].join('\n');

function pairs(command, ps) {
  return ax.CAUSE_EFFECT_DOMAINS.map((d) => ({ domain: d, command, p: ps[d] === undefined ? 0.1 : ps[d] }));
}

function makeScratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-06-'));
  fs.mkdirSync(path.join(root, 'commands'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'commands/alpha.md'), CMD_A);
  fs.writeFileSync(path.join(root, 'commands/beta-file.md'), CMD_B);
  fs.writeFileSync(path.join(root, 'commands/gamma.md'), CMD_C);
  fs.writeFileSync(
    path.join(root, 'data/run-step-capabilities.json'),
    JSON.stringify({ schema: 'mos.run-step-capabilities/1', commands: ['/mos:alpha', '/mos:beta'] }, null, 2) + '\n'
  );
  const fit = {
    model: 'synthetic',
    domains: {},
    pairs: pairs('/mos:alpha', { complicated: 0.7, complex: 0.6999, clear: 0.95 }).concat(pairs('beta', { disorder: 0.71 })),
  };
  const moves = {
    commands: {
      '/mos:alpha': { move: 'analyze', probs: { categorize: 0.1, analyze: 0.4999, probe: 0.4999, act: 0, slice: 0 } },
      beta: { move: 'slice', probs: { categorize: 0.2, analyze: 0.2, probe: 0.1, act: 0, slice: 0.5 } },
    },
  };
  const fitFile = path.join(root, 'fit.json');
  const movesFile = path.join(root, 'moves.json');
  fs.writeFileSync(fitFile, JSON.stringify(fit));
  fs.writeFileSync(movesFile, JSON.stringify(moves));
  return { root, fitFile, movesFile, fit, moves };
}

function rm(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    /* scratch only */
  }
}

// ---- D1 to D4 ----
check('D1 the script writes the 4 keys after job_sentence_status (else before the closing ---) and a second run replaces in place', () => {
  const s = makeScratch();
  try {
    const r = run(['--fit', s.fitFile, '--moves', s.movesFile], s.root);
    assert.equal(r.status, 0, 'derive exit 0: ' + r.stderr);
    const a = fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8');
    const al = fmLines(a);
    const at = al.indexOf('job_sentence_status: "provisional"');
    assert.deepEqual(al.slice(at + 1, at + 5), [
      'fits_domains: ["clear","complicated"]',
      'move_type: "analyze"',
      'move_type_weak: true',
      'cynefin_label_status: "provisional"',
    ]);
    const b = fs.readFileSync(path.join(s.root, 'commands/beta-file.md'), 'utf8');
    const bl = fmLines(b);
    assert.deepEqual(bl.slice(-4), [
      'fits_domains: ["disorder"]',
      'move_type: "slice"',
      'move_type_weak: false',
      'cynefin_label_status: "provisional"',
    ]);
    assert.equal(fs.readFileSync(path.join(s.root, 'commands/gamma.md'), 'utf8'), CMD_C, 'a command off the list is untouched');
    assert.ok(fs.existsSync(path.join(s.root, 'data/cynefin-label-provenance.json')), 'provenance written');
    // Second run with changed input: replaced in place, no duplicate key.
    s.moves.commands['/mos:alpha'].probs.probe = 0.8;
    fs.writeFileSync(s.movesFile, JSON.stringify(s.moves));
    const r2 = run(['--fit', s.fitFile, '--moves', s.movesFile], s.root);
    assert.equal(r2.status, 0, 'second run exit 0: ' + r2.stderr);
    const a2 = fmLines(fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8'));
    assert.equal(a2.filter((l) => LABEL_RE.test(l)).length, 4, 'exactly 4 label lines');
    const at2 = a2.indexOf('job_sentence_status: "provisional"');
    assert.equal(a2[at2 + 2], 'move_type: "probe"');
    assert.equal(a2[at2 + 3], 'move_type_weak: false');
    assert.equal(a2.length, al.length, 'same frontmatter length');
    // Third run with the same input changes nothing.
    const before = fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8');
    assert.equal(run(['--fit', s.fitFile, '--moves', s.movesFile], s.root).status, 0);
    assert.equal(fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8'), before);
  } finally {
    rm(s.root);
  }
});

check('D2 p 0.70 is in, 0.6999 is out; a move tie takes the first MOVE_TYPES id; 0.4999 is weak, 0.5 is not', () => {
  const s = makeScratch();
  try {
    assert.equal(run(['--fit', s.fitFile, '--moves', s.movesFile], s.root).status, 0);
    const a = fmLines(fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8'));
    assert.ok(a.includes('fits_domains: ["clear","complicated"]'), 'complicated 0.70 in, complex 0.6999 out');
    assert.ok(a.includes('move_type: "analyze"'), 'analyze before probe on a tie');
    assert.ok(a.includes('move_type_weak: true'), '0.4999 is weak');
    const b = fmLines(fs.readFileSync(path.join(s.root, 'commands/beta-file.md'), 'utf8'));
    assert.ok(b.includes('move_type_weak: false'), '0.5 is not weak');
  } finally {
    rm(s.root);
  }
});

check('D3 a run-step command missing from either input exits 2 and writes nothing', () => {
  for (const which of ['fit', 'moves']) {
    const s = makeScratch();
    try {
      if (which === 'fit') {
        s.fit.pairs = s.fit.pairs.filter((p) => p.command !== 'beta');
        fs.writeFileSync(s.fitFile, JSON.stringify(s.fit));
      } else {
        delete s.moves.commands.beta;
        fs.writeFileSync(s.movesFile, JSON.stringify(s.moves));
      }
      const r = run(['--fit', s.fitFile, '--moves', s.movesFile], s.root);
      assert.equal(r.status, 2, which + ': exit 2');
      assert.ok(/beta/.test(r.stderr), which + ': names the command');
      assert.equal(fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8'), CMD_A, which + ': alpha untouched');
      assert.equal(fs.readFileSync(path.join(s.root, 'commands/beta-file.md'), 'utf8'), CMD_B, which + ': beta untouched');
      assert.ok(!fs.existsSync(path.join(s.root, 'data/cynefin-label-provenance.json')), which + ': no provenance');
    } finally {
      rm(s.root);
    }
  }
  // --dry-run writes nothing either.
  const s = makeScratch();
  try {
    const r = run(['--fit', s.fitFile, '--moves', s.movesFile, '--dry-run'], s.root);
    assert.equal(r.status, 0, 'dry-run exit 0');
    assert.ok(/complicated/.test(r.stdout), 'dry-run prints the counts');
    assert.equal(fs.readFileSync(path.join(s.root, 'commands/alpha.md'), 'utf8'), CMD_A);
    assert.ok(!fs.existsSync(path.join(s.root, 'data/cynefin-label-provenance.json')));
  } finally {
    rm(s.root);
  }
});

check('D4 --check exits 0 on a consistent tree and exits 1 naming the command otherwise', () => {
  const s = makeScratch();
  try {
    assert.equal(run(['--fit', s.fitFile, '--moves', s.movesFile], s.root).status, 0);
    const ok = run(['--check'], s.root);
    assert.equal(ok.status, 0, 'check exit 0: ' + ok.stderr);
    const gamma = path.join(s.root, 'commands/gamma.md');
    // A command off the list with the keys.
    fs.writeFileSync(gamma, CMD_C.replace('\n---\n\n#', '\nmove_type: "probe"\n---\n\n#'));
    const off = run(['--check'], s.root);
    assert.equal(off.status, 1, 'off-list exit 1');
    assert.ok(/gamma/.test(off.stderr), 'names gamma');
    fs.writeFileSync(gamma, CMD_C);
    // A value outside the closed set.
    const alpha = path.join(s.root, 'commands/alpha.md');
    const good = fs.readFileSync(alpha, 'utf8');
    fs.writeFileSync(alpha, good.replace('move_type: "analyze"', 'move_type: "wander"'));
    const bad = run(['--check'], s.root);
    assert.equal(bad.status, 1, 'closed-set exit 1');
    assert.ok(/alpha/.test(bad.stderr), 'names alpha');
    // A missing key on a run-step command.
    fs.writeFileSync(alpha, good.replace('cynefin_label_status: "provisional"\n', ''));
    const miss = run(['--check'], s.root);
    assert.equal(miss.status, 1, 'missing-key exit 1');
    assert.ok(/alpha/.test(miss.stderr), 'names alpha');
    fs.writeFileSync(alpha, good);
    // Provenance counts that differ from the frontmatter tallies.
    const provFile = path.join(s.root, 'data/cynefin-label-provenance.json');
    const prov = JSON.parse(fs.readFileSync(provFile, 'utf8'));
    prov.counts.moves.slice += 1;
    fs.writeFileSync(provFile, JSON.stringify(prov, null, 2) + '\n');
    const drift = run(['--check'], s.root);
    assert.equal(drift.status, 1, 'count drift exit 1');
    assert.ok(/slice/.test(drift.stderr), 'names the count');
  } finally {
    rm(s.root);
  }
});

// ---- R2 ----
check('R2 the registry builder emits the 4 fields; values outside the closed sets give null and one warning', () => {
  const probe = [
    "const b = require(" + JSON.stringify(REGISTRY_BUILDER) + ");",
    "const out = [",
    "  b.buildCynefinLabels({}, '/mos:none'),",
    "  b.buildCynefinLabels({ fits_domains: ['complicated','complex'], move_type: 'probe', move_type_weak: true, cynefin_label_status: 'provisional' }, '/mos:good'),",
    "  b.buildCynefinLabels({ fits_domains: [], move_type: 'act', move_type_weak: false, cynefin_label_status: 'provisional' }, '/mos:empty'),",
    "  b.buildCynefinLabels({ fits_domains: ['confused'], move_type: 'wander', move_type_weak: 'yes', cynefin_label_status: 'maybe' }, '/mos:bad'),",
    "];",
    "process.stdout.write(JSON.stringify(out));",
  ].join('\n');
  const r = cp.spawnSync('node', ['-e', probe], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, 'probe exit 0: ' + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out[0], { fits_domains: null, move_type: null, move_type_weak: null, cynefin_label_status: null });
  assert.deepEqual(out[1], { fits_domains: ['complicated', 'complex'], move_type: 'probe', move_type_weak: true, cynefin_label_status: 'provisional' });
  assert.deepEqual(out[2], { fits_domains: [], move_type: 'act', move_type_weak: false, cynefin_label_status: 'provisional' });
  assert.deepEqual(out[3], { fits_domains: null, move_type: null, move_type_weak: null, cynefin_label_status: null });
  const warns = r.stderr.split('\n').filter((l) => /WARN/.test(l));
  assert.equal(warns.length, 1, 'one warning: ' + r.stderr);
  assert.ok(/\/mos:bad/.test(warns[0]), 'the warning names the command');
  // Key order: the 4 fields follow job_sentence in a registry entry.
  const reg = require(REGISTRY_BUILDER).buildRegistry();
  const keys = Object.keys(reg.commands[0]);
  const j = keys.indexOf('job_sentence');
  assert.deepEqual(keys.slice(j + 1, j + 5), LABEL_KEYS);
});

// <!-- Y legs (plan 400-06 Task 2) -->

console.log('');
console.log('passed ' + passed + ', failed ' + failed);
process.exit(failed === 0 ? 0 : 1);
