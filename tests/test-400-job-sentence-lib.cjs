#!/usr/bin/env node
'use strict';
// Phase 400-01: the job-sentence module (O-01 formula, three stored slots).
// Legs L1 to L7 (module). L7 is the mutation control for the framework view.
// Legs W1 to W5 (scripts/apply-job-sentences.cjs on a scratch root, seam MINDRIAN_APPLY_ROOT)
// and R1 (data/command-registry.json carries job_sentence after jtbd_summary).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

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

let js = null;
try {
  js = require(path.join(ROOT, 'lib/core/job-sentence.cjs'));
} catch (e) {
  js = null;
}
function need() {
  assert.ok(js, 'lib/core/job-sentence.cjs is missing or does not load');
}

const VALID = [
  { when: 'a', want: 'to b', so: 'c' },
  { when: 'I have a venture, an opportunity or an approach in front of me', want: 'to judge whether it is worth my time', so: 'commit or walk away with a reason' },
  { when: 'my notes pile up', want: 'to sort, group, and name them', so: 'see what I already know' },
  { when: 'a decision is close', want: 'to compare the options side by side', so: 'choose with the trade-offs in view' },
  { when: 'the problem keeps coming back', want: 'to find the cause, not the symptom', so: 'fix it once' },
];

check('L1 renderJob renders the O-01 formula', () => {
  need();
  assert.equal(js.renderJob({ when: 'a', want: 'to b', so: 'c' }), 'When a, I want to b, so I can c.');
});

check('L2 parseJob(renderJob(s)) round-trips 5 valid slot sets, commas inside when and want', () => {
  need();
  for (const s of VALID) {
    assert.deepEqual(js.slotErrors(s), [], 'valid set refused: ' + JSON.stringify(s));
    assert.deepEqual(js.parseJob(js.renderJob(s)), s);
  }
  assert.ok(VALID.some((s) => s.when.includes(',')), 'a when slot with a comma');
  assert.ok(VALID.some((s) => s.want.includes(',')), 'a want slot with a comma');
});

check('L3 slotErrors refuses every bad shape and accepts a valid set', () => {
  need();
  const ok = { when: 'my notes pile up', want: 'to sort them', so: 'see what I know' };
  assert.deepEqual(js.slotErrors(ok), []);
  const bad = [
    ['missing slot', { when: 'a', want: 'to b' }],
    ['blank slot', { when: '  ', want: 'to b', so: 'c' }],
    ['over 160 characters', { when: 'x'.repeat(161), want: 'to b', so: 'c' }],
    ['en dash', { when: 'a \u2013 b', want: 'to b', so: 'c' }],
    ['em dash', { when: 'a', want: 'to b \u2014 c', so: 'c' }],
    ['double quote', { when: 'a "b"', want: 'to b', so: 'c' }],
    ['backslash', { when: 'a', want: 'to b\\c', so: 'c' }],
    ['newline', { when: 'a', want: 'to b', so: 'c\nd' }],
    ['ends with period', { when: 'a', want: 'to b', so: 'c.' }],
    ['ends with semicolon', { when: 'a;', want: 'to b', so: 'c' }],
    ['ends with colon', { when: 'a', want: 'to b:', so: 'c' }],
    ['ends with bang', { when: 'a', want: 'to b', so: 'c!' }],
    ['ends with question', { when: 'a', want: 'to b', so: 'c?' }],
    ['when begins with when', { when: 'when a', want: 'to b', so: 'c' }],
    ['When begins with When', { when: 'When a', want: 'to b', so: 'c' }],
    ['want without to', { when: 'a', want: 'b', so: 'c' }],
    ['so begins with so', { when: 'a', want: 'to b', so: 'so c' }],
    ['so begins with I can', { when: 'a', want: 'to b', so: 'I can c' }],
    ['marker I want inside', { when: 'a, I want x', want: 'to b', so: 'c' }],
    ['marker so I can inside', { when: 'a', want: 'to b, so I can x', so: 'c' }],
    ['extra key', { when: 'a', want: 'to b', so: 'c', why: 'd' }],
    ['not an object', null],
  ];
  for (const [label, s] of bad) {
    const e = js.slotErrors(s);
    assert.ok(Array.isArray(e) && e.length > 0, 'not refused: ' + label);
  }
});

check('L4 parseJob returns null without the anchors', () => {
  need();
  assert.equal(js.parseJob('If a, I want to b, so I can c.'), null);
  assert.equal(js.parseJob('When a, I wish to b, so I can c.'), null);
  assert.equal(js.parseJob('When a, I want to b, so that c.'), null);
  assert.equal(js.parseJob('When a, so I can c, I want to b.'), null);
  assert.equal(js.parseJob('When a, I want to b, so I can c'), null);
  assert.equal(js.parseJob(42), null);
});

check('L5 slotsFromFrontmatter, FRONTMATTER_KEYS, SENTENCE_STATUSES', () => {
  need();
  assert.deepEqual(js.slotsFromFrontmatter({ job_when: 'a', job_want: 'to b', job_so: 'c', name: 'x' }), { when: 'a', want: 'to b', so: 'c' });
  assert.equal(js.slotsFromFrontmatter({ job_when: 'a', job_want: 'to b' }), null);
  assert.equal(js.slotsFromFrontmatter({ job_want: 'to b', job_so: 'c' }), null);
  assert.equal(js.slotsFromFrontmatter(null), null);
  assert.deepEqual(js.FRONTMATTER_KEYS, { when: 'job_when', want: 'job_want', so: 'job_so', status: 'job_sentence_status' });
  assert.deepEqual(js.SENTENCE_STATUSES, ['provisional', 'ruled']);
  assert.deepEqual(js.SLOT_KEYS, ['when', 'want', 'so']);
});

check('L6 frameworkSentences gives counts.ruled_main entries with three non-empty slots', () => {
  need();
  const fj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/framework-jobs.json'), 'utf8'));
  const list = js.frameworkSentences();
  assert.equal(list.length, fj.counts.ruled_main);
  assert.equal(list.length, 184);
  for (const e of list) {
    assert.ok(typeof e.name === 'string' && e.name.length > 0, 'name');
    assert.ok(e.slots, 'no slots for ' + e.name);
    for (const k of ['when', 'want', 'so']) assert.ok(e.slots[k] && e.slots[k].trim(), k + ' empty for ' + e.name);
  }
  assert.deepEqual(js.frameworkSlots('When a, I want to b, so I can c.'), { when: 'a', want: 'to b', so: 'c' });
  assert.deepEqual(js.frameworkSlots('When a, I want to b, so we can c.'), { when: 'a', want: 'to b', so: 'c' });
  assert.deepEqual(js.frameworkSlots('When a, I want a map, so I can c'), { when: 'a', want: 'a map', so: 'c' });
});

check('L7 mutation control: a ruled statement without ", I want " gives null', () => {
  need();
  const fj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/framework-jobs.json'), 'utf8'));
  let text = null;
  for (const fw of fj.frameworks) for (const j of fw.jobs) if (!text && j.status === 'ruled' && j.main) text = j.text;
  assert.ok(js.frameworkSlots(text), 'the unmutated statement parses');
  assert.equal(js.frameworkSlots(text.replace(', I want ', ' I want ')), null);
});

// ---------------------------------------------------------------------------
// W1 to W5: the one frontmatter writer, on a scratch copy of 1 command, 1 standalone skill,
// 1 agent and 1 mirrored skill. All scratch files are removed in finally.
// ---------------------------------------------------------------------------
const SCRIPT = path.join(ROOT, 'scripts/apply-job-sentences.cjs');
const JOB_KEY_RE = /^(job_when|job_want|job_so|job_sentence_status):/;

function runScript(scratch, args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_APPLY_ROOT: scratch }),
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function writeInput(scratch, entries) {
  const p = path.join(scratch, 'input-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(p, JSON.stringify({ entries }));
  return p;
}

function stripJobLines(text) {
  return text.split('\n').filter((l) => !JOB_KEY_RE.test(l)).join('\n');
}

function fmLines(text) {
  const lines = text.split('\n');
  const end = lines.indexOf('---', 1);
  return lines.slice(1, end);
}

const S1 = { when: 'my notes pile up', want: 'to sort, group and name them', so: 'see what I already know' };
const S2 = { when: 'a claim has no test yet', want: 'to score it against evidence', so: 'trust it or drop it' };

let scratch = null;
try {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400-apply-'));
  for (const rel of ['commands/validate.md', 'skills/larry-personality/SKILL.md', 'skills/validate/SKILL.md', 'agents/research.md']) {
    fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
    // Start every fixture without job keys: later plans label the real files (400-02 labels
    // commands/validate.md), and W1 to W5 test the writer from a clean state.
    fs.writeFileSync(path.join(scratch, rel), stripJobLines(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
  }
  const orig = {};
  for (const rel of ['commands/validate.md', 'skills/larry-personality/SKILL.md', 'agents/research.md']) {
    orig[rel] = fs.readFileSync(path.join(scratch, rel), 'utf8');
  }
  const read = (rel) => fs.readFileSync(path.join(scratch, rel), 'utf8');
  const entries = (s) => [
    Object.assign({ surface: 'command', name: 'validate' }, s),
    Object.assign({ surface: 'skill', name: 'larry-personality' }, s),
    Object.assign({ surface: 'agent', name: 'research' }, s),
  ];

  check('W1 apply writes the 4 keys after serves_jtbd, else before the closing ---', () => {
    const r = runScript(scratch, ['--input', writeInput(scratch, entries(S1))]);
    assert.equal(r.code, 0, r.out);
    const want = [
      'job_when: "' + S1.when + '"',
      'job_want: "' + S1.want + '"',
      'job_so: "' + S1.so + '"',
      'job_sentence_status: "provisional"',
    ];
    for (const rel of ['commands/validate.md', 'agents/research.md']) {
      const lines = fmLines(read(rel));
      const i = lines.findIndex((l) => /^serves_jtbd:/.test(l));
      assert.ok(i >= 0, 'serves_jtbd in ' + rel);
      assert.deepEqual(lines.slice(i + 1, i + 5), want, rel);
    }
    const sk = fmLines(read('skills/larry-personality/SKILL.md'));
    assert.deepEqual(sk.slice(-4), want, 'skill keys before the closing ---');
    for (const rel of Object.keys(orig)) assert.equal(stripJobLines(read(rel)), orig[rel], 'only the 4 lines added in ' + rel);
  });

  check('W2 a second apply replaces the 4 lines in place; description untouched', () => {
    const before = {};
    for (const rel of Object.keys(orig)) before[rel] = read(rel);
    const r = runScript(scratch, ['--input', writeInput(scratch, entries(S2))]);
    assert.equal(r.code, 0, r.out);
    for (const rel of Object.keys(orig)) {
      const a = before[rel].split('\n');
      const b = read(rel).split('\n');
      assert.equal(a.length, b.length, 'line count in ' + rel);
      const diff = a.map((l, i) => (l === b[i] ? null : i)).filter((i) => i !== null);
      assert.ok(diff.length === 3, 'exactly 3 slot lines change in ' + rel + ': ' + diff.length);
      for (const i of diff) assert.ok(/^job_(when|want|so):/.test(b[i]), rel + ' line ' + i);
      assert.equal(stripJobLines(read(rel)), orig[rel], 'rest byte-identical in ' + rel);
      assert.ok(read(rel).includes('job_when: "' + S2.when + '"'));
    }
  });

  check('W3 one invalid entry refuses the whole batch with exit 2 and writes nothing', () => {
    const before = {};
    for (const rel of Object.keys(orig)) before[rel] = read(rel);
    const bad = entries(S1);
    bad[2] = Object.assign({}, bad[2], { so: 'so I can fail' });
    const r = runScript(scratch, ['--input', writeInput(scratch, bad)]);
    assert.equal(r.code, 2, r.out);
    for (const rel of Object.keys(orig)) assert.equal(read(rel), before[rel], 'written: ' + rel);
    const r2 = runScript(scratch, ['--input', writeInput(scratch, [Object.assign({ surface: 'agent', name: '../commands/validate' }, S1)])]);
    assert.equal(r2.code, 2, 'a path in name is refused');
    const r3 = runScript(scratch, ['--input', writeInput(scratch, [Object.assign({ surface: 'agent', name: 'no-such-agent' }, S1)])]);
    assert.equal(r3.code, 2, 'an unresolvable file is refused');
  });

  check('W4 a mirrored skill is refused with exit 2', () => {
    const before = read('skills/validate/SKILL.md');
    const r = runScript(scratch, ['--input', writeInput(scratch, [Object.assign({ surface: 'skill', name: 'validate' }, S1)])]);
    assert.equal(r.code, 2, r.out);
    assert.ok(r.out.includes('mirrored skill: write the command'), r.out);
    assert.equal(read('skills/validate/SKILL.md'), before);
  });

  check('W5 --check passes on complete keys, names the file on a missing key, --require-all bites', () => {
    let r = runScript(scratch, ['--check']);
    assert.equal(r.code, 0, r.out);
    assert.ok(r.out.includes('apply-job-sentences --check: commands 1/1, skills 1/1, agents 1/1'), r.out);
    r = runScript(scratch, ['--check', '--require-all']);
    assert.equal(r.code, 0, r.out);
    const rel = 'agents/research.md';
    const keep = read(rel);
    fs.writeFileSync(path.join(scratch, rel), keep.split('\n').filter((l) => !/^job_so:/.test(l)).join('\n'));
    r = runScript(scratch, ['--check']);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.out.includes(rel), 'names the file: ' + r.out);
    fs.writeFileSync(path.join(scratch, rel), keep.replace(/^job_want: ".*"$/m, 'job_want: "no verb marker"'));
    r = runScript(scratch, ['--check']);
    assert.equal(r.code, 1, 'an invalid slot fails: ' + r.out);
    fs.writeFileSync(path.join(scratch, rel), orig[rel]);
    r = runScript(scratch, ['--check']);
    assert.equal(r.code, 0, r.out);
    assert.ok(r.out.includes('agents 0/1'), r.out);
    r = runScript(scratch, ['--check', '--require-all']);
    assert.equal(r.code, 1, '--require-all bites below the total: ' + r.out);
    const real = spawnSync(process.execPath, [SCRIPT, '--check', '--require-all'], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { MINDRIAN_APPLY_ROOT: '' }) });
    // Plan 400-03 labelled every command, standalone skill and agent: the real repo is at its totals.
    assert.equal(real.status, 0, 'the repo is at its totals after plan 400-03: ' + real.stdout + real.stderr);
    assert.ok(real.stdout.includes('commands 113/113, skills 12/12, agents 17/17'), real.stdout);
  });
} finally {
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
}

check('R1 every registry entry has job_sentence right after jtbd_summary; null in plan 01', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/command-registry.json'), 'utf8'));
  assert.equal(reg.commands.length, 113);
  for (const c of reg.commands) {
    const keys = Object.keys(c);
    const i = keys.indexOf('jtbd_summary');
    assert.equal(keys[i + 1], 'job_sentence', c.command);
    const v = c.job_sentence;
    if (v !== null) {
      assert.deepEqual(Object.keys(v), ['when', 'want', 'so', 'status'], c.command);
      assert.deepEqual(js.slotErrors({ when: v.when, want: v.want, so: v.so }), [], c.command);
    }
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
