#!/usr/bin/env node
'use strict';
// Phase 400-02 Task 2: job sentences on every run-step command (JS-02, O-01, O-11, O-12).
// Legs S1 to S4. Plans 400-03 and 400-04 grow this file for skills and agents.
// The 73 names come from data/run-step-capabilities.json. A registry name maps to its file
// through the frontmatter name: field (commands/value-proposition.md holds validate-proposition).
// Frontmatter is parsed with the registry parser, so the test reads what the registry reads.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const js = require(path.join(ROOT, 'lib/core/job-sentence.cjs'));
const { parseFrontmatter } = require(path.join(ROOT, 'scripts/build-command-registry.cjs'));
const { SKIP_LIST } = require(path.join(ROOT, 'scripts/build-skill-mirrors.cjs'));

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

const K = js.FRONTMATTER_KEYS;
const KEY_ORDER = [K.when, K.want, K.so, K.status];
const runStep = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/run-step-capabilities.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/command-registry.json'), 'utf8'));
const RUN_STEP = runStep.commands.map((c) => c.replace(/^\/mos:/, ''));

// name -> commands/<file>.md, by the frontmatter name: field.
const fileByName = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'commands')).filter((x) => x.endsWith('.md')).sort()) {
  const fm = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'commands', f), 'utf8'));
  const name = typeof fm.name === 'string' && fm.name ? fm.name : f.replace(/\.md$/, '');
  if (!fileByName.has(name)) fileByName.set(name, f);
}

function commandFm(name) {
  const f = fileByName.get(name);
  assert.ok(f, 'no command file has name: ' + name);
  return parseFrontmatter(fs.readFileSync(path.join(ROOT, 'commands', f), 'utf8'));
}

// The 4 job lines of a file, in file order.
function jobLines(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = new RegExp('^(' + KEY_ORDER.join('|') + '):');
  return text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => re.test(l));
}

check('S0 the run-step list holds 73 names, each resolves to one command file', () => {
  assert.equal(RUN_STEP.length, 73);
  for (const n of RUN_STEP) assert.ok(fileByName.has(n), 'no command file for ' + n);
  assert.equal(fileByName.get('validate-proposition'), 'value-proposition.md');
});

check('S1 every run-step command has the 4 job keys, status provisional, and valid slots', () => {
  const miss = [];
  for (const n of RUN_STEP) {
    const fm = commandFm(n);
    const slots = js.slotsFromFrontmatter(fm);
    if (!slots) { miss.push(n + ' (missing slot key)'); continue; }
    if (fm[K.status] !== 'provisional') miss.push(n + ' (status ' + fm[K.status] + ')');
    const errs = js.slotErrors(slots);
    if (errs.length) miss.push(n + ' (' + errs.join('; ') + ')');
  }
  assert.deepEqual(miss, [], miss.length + ' of 73 run-step commands fail: ' + miss.slice(0, 8).join(', '));
});

check('S2 the registry job_sentence equals the frontmatter slots; every other command is null', () => {
  const runSet = new Set(RUN_STEP.map((n) => '/mos:' + n));
  let labelled = 0;
  for (const row of registry.commands) {
    if (runSet.has(row.command)) {
      const fm = commandFm(row.command.replace(/^\/mos:/, ''));
      assert.deepEqual(
        row.job_sentence,
        { when: fm[K.when], want: fm[K.want], so: fm[K.so], status: fm[K.status] },
        'registry drift for ' + row.command
      );
      labelled++;
    } else {
      assert.equal(row.job_sentence, null, 'job_sentence is not null for ' + row.command);
    }
  }
  assert.equal(labelled, 73);
});

check('S3 each generated mirror holds the same 4 job lines as its command file', () => {
  const skipped = [];
  for (const n of RUN_STEP) {
    const f = fileByName.get(n);
    const base = f.replace(/\.md$/, '');
    // A skip-listed skill is hand-authored and the generator never writes it.
    if (SKIP_LIST.includes(base)) { skipped.push(base); continue; }
    const cmd = jobLines('commands/' + f);
    assert.equal(cmd.length, 4, 'commands/' + f + ' holds ' + cmd.length + ' job lines');
    assert.deepEqual(jobLines('skills/' + base + '/SKILL.md'), cmd, 'mirror drift for skills/' + base + '/SKILL.md');
  }
  assert.deepEqual(skipped, ['trending-to-absurd'], 'unexpected skip-listed run-step names');
});

check('S4 no two run-step sentences are identical; organize, mva-brief and mva-report are labelled (O-12)', () => {
  const seen = new Map();
  for (const n of RUN_STEP) {
    const slots = js.slotsFromFrontmatter(commandFm(n));
    assert.ok(slots, 'no slots for ' + n);
    const s = js.renderJob(slots);
    assert.ok(!seen.has(s), 'sentence of ' + n + ' equals the sentence of ' + seen.get(s));
    seen.set(s, n);
    const words = s.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 40, n + ' sentence has ' + words + ' words');
    assert.ok(!/larry|theo|mindrian|\/mos:|[0-9"]/i.test(s), n + ' sentence has a product name, a command name, a number or a quote');
  }
  for (const n of ['organize', 'mva-brief', 'mva-report']) {
    assert.ok(RUN_STEP.includes(n), n + ' left the run-step list');
    assert.ok(js.slotsFromFrontmatter(commandFm(n)), n + ' is not labelled');
  }
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
