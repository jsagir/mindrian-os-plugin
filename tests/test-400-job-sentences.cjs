#!/usr/bin/env node
'use strict';
// Phase 400-02 Task 2: job sentences on every run-step command (JS-02, O-01, O-11, O-12).
// Legs S1 to S4 (plan 400-02); legs S5 to S7 (plan 400-03: the other 40 commands, the 12
// standalone skills and the 17 agents, JS-03); legs M1 to M4 and F1 to F3 (plan 400-04: the 63
// MCP tools, JS-04, and the one drift test over every surface, JS-06).
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

check('S2 the registry job_sentence equals the frontmatter slots for all 113 commands (plan 400-03)', () => {
  let labelled = 0;
  for (const row of registry.commands) {
    const fm = commandFm(row.command.replace(/^\/mos:/, ''));
    assert.deepEqual(
      row.job_sentence,
      { when: fm[K.when], want: fm[K.want], so: fm[K.so], status: fm[K.status] },
      'registry drift for ' + row.command
    );
    labelled++;
  }
  assert.equal(labelled, 113);
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

// Plan 400-03 (JS-03). The shared slot check of one frontmatter: 4 keys, provisional, valid
// slots, sentence style (at most 40 words, no product name, command name, digit or quote).
const { execFileSync } = require('node:child_process');
const BASE = 'c1e496ae8';
const allSentences = new Map();
function labelErrors(label, fm) {
  const slots = js.slotsFromFrontmatter(fm);
  if (!slots) return [label + ' (missing slot key)'];
  const out = [];
  if (fm[K.status] !== 'provisional') out.push(label + ' (status ' + fm[K.status] + ')');
  const errs = js.slotErrors(slots);
  if (errs.length) out.push(label + ' (' + errs.join('; ') + ')');
  const s = js.renderJob(slots);
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words > 40) out.push(label + ' (' + words + ' words)');
  if (/larry|theo|mindrian|\/mos:|[0-9"]/i.test(s)) out.push(label + ' (product name, command name, digit or quote)');
  if (allSentences.has(s)) out.push(label + ' (same sentence as ' + allSentences.get(s) + ')');
  allSentences.set(s, label);
  return out;
}

check('S5 all 113 commands have the 4 job keys, valid slots and distinct sentences; the registry has 113 non-null rows', () => {
  const miss = [];
  const names = [...fileByName.keys()];
  assert.equal(names.length, 113, 'command file count');
  for (const n of names) miss.push(...labelErrors('command ' + n, commandFm(n)));
  assert.deepEqual(miss, [], miss.length + ' commands fail: ' + miss.slice(0, 8).join(', '));
  assert.equal(registry.commands.length, 113);
  assert.equal(registry.commands.filter((r) => r.job_sentence).length, 113);
});

// Standalone skills: skills/<dir>/SKILL.md with no commands/<dir>.md and no command whose
// frontmatter name is <dir> (the rule of scripts/apply-job-sentences.cjs).
const STANDALONE = fs
  .readdirSync(path.join(ROOT, 'skills'))
  .filter((d) => fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md')))
  .filter((d) => !fs.existsSync(path.join(ROOT, 'commands', d + '.md')) && !fileByName.has(d))
  .sort();

check('S6 the 12 standalone skills have the 4 job keys and valid slots', () => {
  assert.equal(STANDALONE.length, 12, 'standalone skills: ' + STANDALONE.join(', '));
  const miss = [];
  for (const d of STANDALONE) {
    const rel = 'skills/' + d + '/SKILL.md';
    miss.push(...labelErrors('skill ' + d, parseFrontmatter(fs.readFileSync(path.join(ROOT, rel), 'utf8'))));
    if (jobLines(rel).length !== 4) miss.push('skill ' + d + ' (' + jobLines(rel).length + ' job lines)');
  }
  assert.deepEqual(miss, [], miss.length + ' skills fail: ' + miss.slice(0, 8).join(', '));
});

check('S7 the 17 agents have the 4 job keys; each differs from base ' + BASE + ' only by those 4 lines (T-400-06)', () => {
  const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter((f) => f.endsWith('.md')).sort();
  assert.equal(agents.length, 17, 'agent count');
  const miss = [];
  const re = new RegExp('^(' + KEY_ORDER.join('|') + '):');
  for (const f of agents) {
    const rel = 'agents/' + f;
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    miss.push(...labelErrors('agent ' + f, parseFrontmatter(text)));
    const lines = text.split('\n');
    const kept = lines.filter((l) => !re.test(l.replace(/\r$/, '')));
    if (lines.length - kept.length !== 4) miss.push('agent ' + f + ' (' + (lines.length - kept.length) + ' job lines)');
    const base = execFileSync('git', ['show', BASE + ':' + rel], { cwd: ROOT, encoding: 'utf8' });
    if (kept.join('\n') !== base) miss.push('agent ' + f + ' (changed beyond the 4 job lines)');
  }
  assert.deepEqual(miss, [], miss.length + ' agents fail: ' + miss.slice(0, 8).join(', '));
});

// Plan 400-04 (JS-04). MCP tools have no frontmatter, so their sentences live in one data
// file keyed by connector surface (the Phase 399 data/capability-job-labels.json precedent).
const MCP_REL = 'data/mcp-tool-job-sentences.json';
const MCP_SCHEMA = 'mos.mcp-tool-job-sentences/1';
const connectors = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mcp-tool-connectors.json'), 'utf8'));
const MCP_SURFACES = connectors.connectors.map((c) => c.surface).sort();
function readMcp(rel) {
  const abs = path.join(ROOT, rel || MCP_REL);
  assert.ok(fs.existsSync(abs), (rel || MCP_REL) + ' does not exist');
  return { raw: fs.readFileSync(abs, 'utf8'), data: JSON.parse(fs.readFileSync(abs, 'utf8')) };
}
// The per-entry check of one MCP sentence; [] means the entry is valid.
function mcpEntryErrors(surface, e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return [surface + ' (entry is not an object)'];
  const out = [];
  const keys = Object.keys(e).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['so', 'status', 'want', 'when'])) out.push(surface + ' (keys ' + keys.join(',') + ')');
  if (e.status !== 'provisional') out.push(surface + ' (status ' + e.status + ')');
  const slots = { when: e.when, want: e.want, so: e.so };
  const errs = js.slotErrors(slots);
  if (errs.length) { out.push(surface + ' (' + errs.join('; ') + ')'); return out; }
  const s = js.renderJob(slots);
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words > 40) out.push(surface + ' (' + words + ' words)');
  if (/larry|theo|mindrian|eureka|\/mos:|[0-9"]/i.test(s)) out.push(surface + ' (product name, command name, digit or quote)');
  if (/[a-z]+_[a-z_]+/.test(s)) out.push(surface + ' (holds a tool name)');
  return out;
}

check('M1 the MCP sentence file key set equals the ' + MCP_SURFACES.length + ' connector surfaces', () => {
  const { data } = readMcp();
  assert.equal(MCP_SURFACES.length, 63, 'connector surface count');
  assert.deepEqual(Object.keys(data.tools || {}), MCP_SURFACES, 'tools keys differ from the connector surfaces, or are not sorted');
});

check('M2 each MCP entry is {when, want, so, status: provisional} with valid slots', () => {
  const { data } = readMcp();
  const miss = [];
  for (const [surface, e] of Object.entries(data.tools || {})) miss.push(...mcpEntryErrors(surface, e));
  assert.deepEqual(miss, [], miss.length + ' MCP entries fail: ' + miss.slice(0, 8).join(', '));
});

check('M3 no MCP sentence equals a command sentence or another MCP sentence', () => {
  const { data } = readMcp();
  const cmd = new Map();
  for (const n of fileByName.keys()) {
    const slots = js.slotsFromFrontmatter(commandFm(n));
    if (slots) cmd.set(js.renderJob(slots), n);
  }
  const seen = new Map();
  const miss = [];
  for (const [surface, e] of Object.entries(data.tools || {})) {
    const s = js.renderJob({ when: e.when, want: e.want, so: e.so });
    if (cmd.has(s)) miss.push(surface + ' = command ' + cmd.get(s));
    if (seen.has(s)) miss.push(surface + ' = ' + seen.get(s));
    seen.set(s, surface);
  }
  assert.deepEqual(miss, []);
});

check('M4 the MCP file has keys schema, _note, tools only; no en dash or em dash', () => {
  const { raw, data } = readMcp();
  assert.deepEqual(Object.keys(data), ['schema', '_note', 'tools']);
  assert.equal(data.schema, MCP_SCHEMA);
  assert.ok(typeof data._note === 'string' && data._note.length > 0, '_note is blank');
  assert.ok(!/[–—]/.test(raw), 'the file holds an en dash or an em dash');
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
