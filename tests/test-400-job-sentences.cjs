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
const F1 = require(path.join(ROOT, 'scripts', 'check-frontmatter-split.cjs'));
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
    // Phase 401 plan F1 (quick 261127-f1a), cause (c): the plan rewrote the triple-dash comment lines inside
    // frontmatter, because the host ends frontmatter at the first triple dash. The same rewrite is applied to
    // the base side before the compare. No key changed.
    const base = F1.rewriteText(execFileSync('git', ['show', BASE + ':' + rel], { cwd: ROOT, encoding: 'utf8' })).text;
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
  assert.ok(!/[\u2013\u2014]/.test(raw), 'the file holds an en dash or an em dash');
});

// Plan 400-04 (JS-06): the one drift test over every surface. Each file check below is the
// same function for the real scan (F1) and for the mutation control (F2).
const os = require('node:os');
const RULED_WANT_EXEMPT = 'want does not begin with "to "';
function roundTripErrors(label, slots) {
  const back = js.parseJob(js.renderJob(slots));
  return JSON.stringify(back) === JSON.stringify(slots) ? [] : [label + ' (no round trip through parseJob(renderJob))'];
}
// One frontmatter file (command, standalone skill or agent): 4 keys, a known status, valid
// slots, a round trip.
function frontmatterFileErrors(label, absFile) {
  const fm = parseFrontmatter(fs.readFileSync(absFile, 'utf8'));
  const slots = js.slotsFromFrontmatter(fm);
  if (!slots) return [label + ' (missing slot key)'];
  const out = [];
  if (!js.SENTENCE_STATUSES.includes(fm[K.status])) out.push(label + ' (status ' + fm[K.status] + ')');
  const errs = js.slotErrors(slots);
  if (errs.length) out.push(label + ' (' + errs.join('; ') + ')');
  return out.concat(roundTripErrors(label, slots));
}
// The MCP sentence file: every entry passes mcpEntryErrors and round-trips.
function mcpFileErrors(absFile) {
  const data = JSON.parse(fs.readFileSync(absFile, 'utf8'));
  const out = [];
  for (const [surface, e] of Object.entries(data.tools || {})) {
    const errs = mcpEntryErrors(surface, e);
    out.push(...errs);
    if (!errs.length) out.push(...roundTripErrors(surface, { when: e.when, want: e.want, so: e.so }));
  }
  return out;
}

check('F1 every surface is labelled: vocabulary 20, commands 113, skills 12, agents 17, MCP tools 63, framework statements 184; all slots valid and round-trip', () => {
  const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/job-vocabulary.json'), 'utf8'));
  const commandFiles = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.endsWith('.md')).sort();
  const agentFiles = fs.readdirSync(path.join(ROOT, 'agents')).filter((f) => f.endsWith('.md')).sort();
  const mcp = readMcp().data;
  const frameworks = js.frameworkSentences();
  const totals = {
    vocabulary: vocab.ids.length,
    commands: commandFiles.length,
    skills: STANDALONE.length,
    agents: agentFiles.length,
    mcp_tools: Object.keys(mcp.tools).length,
    framework_statements: frameworks.length,
  };
  assert.deepEqual(totals, { vocabulary: 20, commands: 113, skills: 12, agents: 17, mcp_tools: 63, framework_statements: 184 });
  assert.equal(totals.mcp_tools, MCP_SURFACES.length, 'MCP total differs from the connector registry');
  const miss = [];
  for (const id of vocab.ids) {
    const j = vocab.jobs[id];
    const errs = js.slotErrors(j.slots);
    if (errs.length) miss.push('job ' + id + ' (' + errs.join('; ') + ')');
    else miss.push(...roundTripErrors('job ' + id, j.slots));
  }
  for (const f of commandFiles) miss.push(...frontmatterFileErrors('commands/' + f, path.join(ROOT, 'commands', f)));
  for (const d of STANDALONE) miss.push(...frontmatterFileErrors('skills/' + d, path.join(ROOT, 'skills', d, 'SKILL.md')));
  for (const f of agentFiles) miss.push(...frontmatterFileErrors('agents/' + f, path.join(ROOT, 'agents', f)));
  miss.push(...mcpFileErrors(path.join(ROOT, MCP_REL)));
  // Framework statements are ruled owner text, read and never written (S1 reuse rule). The
  // read-time view keeps a want without a leading "to " (lib/core/job-sentence.cjs
  // frameworkSlots), so that one style rule is exempt; every other slot rule holds.
  for (const fw of frameworks) {
    if (!fw.slots) { miss.push('framework ' + fw.name + ' (no slots)'); continue; }
    const errs = js.slotErrors(fw.slots).filter((e) => e !== RULED_WANT_EXEMPT);
    if (errs.length) miss.push('framework ' + fw.name + ' (' + errs.join('; ') + ')');
    miss.push(...roundTripErrors('framework ' + fw.name, fw.slots));
  }
  assert.deepEqual(miss, [], miss.length + ' sentences fail: ' + miss.slice(0, 8).join(', '));
});

check('F2 mutation control: the same file checks report a command without job_want and an MCP want that ends in a period', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400-04-'));
  try {
    const name = [...fileByName.keys()].sort()[0];
    const src = path.join(ROOT, 'commands', fileByName.get(name));
    assert.deepEqual(frontmatterFileErrors('real', src), [], 'the unmutated command fails');
    const cmdCopy = path.join(dir, 'command.md');
    const kept = fs.readFileSync(src, 'utf8').split('\n').filter((l) => !/^job_want:/.test(l));
    fs.writeFileSync(cmdCopy, kept.join('\n'));
    assert.deepEqual(frontmatterFileErrors('mutant', cmdCopy), ['mutant (missing slot key)']);

    const mcpSrc = path.join(ROOT, MCP_REL);
    assert.deepEqual(mcpFileErrors(mcpSrc), [], 'the unmutated MCP file fails');
    const data = JSON.parse(fs.readFileSync(mcpSrc, 'utf8'));
    const first = Object.keys(data.tools)[0];
    data.tools[first].want = data.tools[first].want + '.';
    const mcpCopy = path.join(dir, 'mcp.json');
    fs.writeFileSync(mcpCopy, JSON.stringify(data, null, 2));
    const errs = mcpFileErrors(mcpCopy);
    assert.equal(errs.length, 1, 'mutant MCP errors: ' + errs.join(', '));
    assert.ok(errs[0].startsWith(first + ' ') && errs[0].includes('want ends with punctuation'), errs[0]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(!fs.existsSync(dir), 'the scratch directory is still on disk');
});

check('F3 apply-job-sentences --check --require-all exits 0 with full counts', () => {
  // The real repo, never the test seam root.
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_APPLY_ROOT;
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts/apply-job-sentences.cjs'), '--check', '--require-all'], {
    cwd: ROOT,
    encoding: 'utf8',
    env,
  });
  assert.match(out, /commands 113\/113, skills 12\/12, agents 17\/17/);
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
