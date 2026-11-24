#!/usr/bin/env node
'use strict';
// Phase 399-02 Task 2: pin the owner job-label ruling of 2026-11-24 (D-07, I-02).
// Legs L1 to L8. L8 is the mutation control: --check must exit 1 on a registry that misses an accepted pair.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

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

const rulings = read('data/job-label-rulings.json');
const registry = read('data/command-registry.json');
const vocab = read('data/job-vocabulary.json');
const taxonomy = read('lib/hmi/jtbd-taxonomy.json');
const jobsOf = new Map(registry.commands.map((c) => [c.command, c.serves_jtbd || []]));
const pairKey = (p) => p.job + ' on ' + p.command;

check('L0. rulings file has the schema, the date and the expected counts (26, 2, 5, 6)', () => {
  assert.equal(rulings.schema, 'mos.job-label-rulings/1');
  assert.equal(rulings.ruled_at, '2026-11-24');
  assert.equal(rulings.accepted.length, 26);
  assert.equal(rulings.held.length, 2);
  assert.equal(rulings.doubtful_existing.length, 5);
  assert.equal(rulings.taxonomy_disagreements.length, 6);
});

check('L1. every accepted pair is in the registry serves_jtbd of its command', () => {
  const miss = rulings.accepted.filter((p) => !(jobsOf.get(p.command) || []).includes(p.job)).map(pairKey);
  assert.deepEqual(miss, []);
});

check('L2. no held pair is in the registry', () => {
  const present = rulings.held.filter((p) => (jobsOf.get(p.command) || []).includes(p.job)).map(pairKey);
  assert.deepEqual(present, []);
  for (const p of rulings.held) assert.equal(p.status, 'held_for_owner_review');
});

check('L3. every doubtful existing pair is still in the registry', () => {
  const gone = rulings.doubtful_existing.filter((p) => !(jobsOf.get(p.command) || []).includes(p.job)).map(pairKey);
  assert.deepEqual(gone, []);
  for (const p of rulings.doubtful_existing) assert.equal(p.status, 'owner_review_not_changed');
});

check('L4. taxonomy disagreements: each live one is listed; resolved ones are accepted pairs; open count equals live count', () => {
  const live = [];
  for (const e of taxonomy.entries) {
    for (const h of e.methodology_hooks || []) {
      if (!(jobsOf.get(h) || []).includes(e.id)) live.push({ job: e.id, command: h });
    }
  }
  const listed = new Set(rulings.taxonomy_disagreements.map(pairKey));
  const unlisted = live.filter((p) => !listed.has(pairKey(p))).map(pairKey);
  assert.deepEqual(unlisted, []);
  const accepted = new Set(rulings.accepted.map(pairKey));
  const resolved = rulings.taxonomy_disagreements.filter((p) => p.status === 'resolved_by_accepted');
  for (const p of resolved) assert.ok(accepted.has(pairKey(p)), 'resolved item is not an accepted pair: ' + pairKey(p));
  const open = rulings.taxonomy_disagreements.filter((p) => p.status === 'open_owner_review');
  assert.equal(open.length + resolved.length, rulings.taxonomy_disagreements.length);
  assert.equal(open.length, live.length);
  assert.equal(resolved.length, 1);
});

check('L5. every job is in the closed vocabulary and every command is a registry command', () => {
  const ids = new Set(vocab.ids);
  const all = [].concat(rulings.accepted, rulings.held, rulings.doubtful_existing, rulings.taxonomy_disagreements);
  const badJobs = all.filter((p) => !ids.has(p.job)).map(pairKey);
  const badCmds = all.filter((p) => !jobsOf.has(p.command)).map(pairKey);
  assert.deepEqual(badJobs, []);
  assert.deepEqual(badCmds, []);
});

check('L6. each skill mirror carries the serves_jtbd line of its command', () => {
  const line = (file) => {
    const m = fs.readFileSync(file, 'utf8').split('\n').filter((l) => /^serves_jtbd:/.test(l));
    return m;
  };
  // scripts/build-skill-mirrors.cjs skip-list: not a mirror, so no step check.
  const MIRROR_SKIP = new Set(['trending-to-absurd']);
  let compared = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'commands')).filter((x) => x.endsWith('.md'))) {
    const base = f.replace(/\.md$/, '');
    if (MIRROR_SKIP.has(base)) continue;
    const skill = path.join(ROOT, 'skills', base, 'SKILL.md');
    if (!fs.existsSync(skill)) continue;
    assert.deepEqual(line(skill), line(path.join(ROOT, 'commands', f)), 'serves_jtbd differs for ' + base);
    compared += 1;
  }
  assert.ok(compared >= 19, 'compared only ' + compared);
});

check('L7. rulings file holds no p, probability or score key and no long string outside _note', () => {
  const bad = [];
  (function walk(v, where) {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']'));
    else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (['p', 'probability', 'score'].includes(k)) bad.push('key ' + where + '.' + k);
        if (where === '$' && k === '_note') continue;
        walk(v[k], where + '.' + k);
      }
    } else if (typeof v === 'string' && v.length > 80) bad.push('string ' + where);
  })(rulings, '$');
  assert.deepEqual(bad, []);
});

check('L8. mutation control: --check exits 1 on a registry that misses one accepted pair, 0 on the real one', () => {
  const script = path.join(ROOT, 'scripts', 'apply-job-labels.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-399-labels-'));
  try {
    const target = rulings.accepted[0];
    const copy = JSON.parse(JSON.stringify(registry));
    const c = copy.commands.find((x) => x.command === target.command);
    c.serves_jtbd = c.serves_jtbd.filter((j) => j !== target.job);
    const scratch = path.join(dir, 'command-registry.json');
    fs.writeFileSync(scratch, JSON.stringify(copy));
    const bad = spawnSync(process.execPath, [script, '--check'], { env: Object.assign({}, process.env, { MINDRIAN_COMMAND_REGISTRY: scratch }), encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.ok(bad.stderr.includes(target.job) && bad.stderr.includes(target.command));
    const env = Object.assign({}, process.env);
    delete env.MINDRIAN_COMMAND_REGISTRY;
    const good = spawnSync(process.execPath, [script, '--check'], { env, encoding: 'utf8' });
    assert.equal(good.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('G1. no em dash or en dash in the files of this plan', () => {
  const files = ['data/job-label-rulings.json', 'scripts/apply-job-labels.cjs', 'tests/test-399-job-labels.cjs'];
  for (const f of files) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(t), f);
  }
});

console.log('checks: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('>>> test-399-job-labels.cjs: FAILED');
  process.exit(1);
}
console.log('>>> test-399-job-labels.cjs: PASSED');
