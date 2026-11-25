#!/usr/bin/env node
'use strict';
// Phase 400.2-06: the command contract of /mos:persona (PL-05). Legs C1 to C12 (plan 06);
// later plans add legs. The test reads commands/persona.md as text and checks what the
// command promises: stages, tools, modes, the refusal sentence, the builder contract,
// the door calls, the cards and the fire symbols.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const CMD_PATH = path.join(ROOT, 'commands', 'persona.md');
const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));

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

const text = fs.readFileSync(CMD_PATH, 'utf8');
const fmMatch = /^---\n([\s\S]*?)\n---\n/.exec(text);
const frontmatter = fmMatch ? fmMatch[1] : '';
const body = fmMatch ? text.slice(fmMatch[0].length) : text;

// The fixed prompt rule FS-3, word for word (400.2-01 PHASE RULES R-9).
const FS3 = 'Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it.';
const BUILDER_START = '<!-- contract:builder:start -->';
const BUILDER_END = '<!-- contract:builder:end -->';
const S2_FORBIDDEN_KEYS = ['research_handles', 'handles', 'brief', 'evidence', 'verdict'];

function builderBlock() {
  const a = text.indexOf(BUILDER_START);
  const b = text.indexOf(BUILDER_END);
  assert.ok(a >= 0 && b > a, 'builder contract markers present and ordered');
  return text.slice(a + BUILDER_START.length, b);
}

// Cut one section of the body: from a heading line that starts with `heading` to the next heading
// of the same or a higher level.
function section(heading) {
  const lines = body.split('\n');
  const level = /^#+/.exec(heading)[0].length;
  const start = lines.findIndex((l) => l.startsWith(heading));
  assert.ok(start >= 0, 'heading not found: ' + heading);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^(#+)\s/.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

check('C1. hitl_stages holds the three stages with their shapes and modes; hitl_why names each stage id', () => {
  const stages = [];
  const re = /^ {2}- stage: "([^"]+)"\n {4}shapes: \[([^\]]*)\]\n {4}mode: "([^"]+)"/gm;
  let m;
  while ((m = re.exec(frontmatter)) !== null) stages.push({ stage: m[1], shapes: m[2].replace(/"/g, '').split(',').map((s) => s.trim()), mode: m[3] });
  assert.deepEqual(stages, [
    { stage: 'brief-confirm', shapes: ['F.6'], mode: 'gate' },
    { stage: 'generate-experts', shapes: ['F.8'], mode: 'parallel' },
    { stage: 'resolve-tension', shapes: ['F.5'], mode: 'gate' },
  ]);
  const why = /^hitl_why: "([^"]*)"/m.exec(frontmatter);
  assert.ok(why, 'hitl_why line');
  for (const s of stages) assert.ok(why[1].includes(s.stage), 'hitl_why names ' + s.stage);
  assert.ok(!/validation-approve|search-approve/.test(frontmatter), 'no validation-approve or search-approve stage in this plan');
});

check('C2. allowed-tools holds Read, Write, Bash, Glob, Task and AskUserQuestion', () => {
  const block = /^allowed-tools:\n((?: {2}- .*\n)+)/m.exec(frontmatter + '\n');
  assert.ok(block, 'allowed-tools block');
  const tools = block[1].split('\n').map((l) => l.replace(/^ {2}- /, '').trim()).filter(Boolean);
  for (const t of ['Read', 'Write', 'Bash', 'Glob', 'Task', 'AskUserQuestion']) assert.ok(tools.includes(t), 'tool ' + t);
});

check('C3. the body keeps "persona --parallel" and "persona-ops"; the description is byte-equal to base; no em dash or en dash', () => {
  assert.ok(body.includes('persona --parallel'));
  assert.ok(body.includes('persona-ops'));
  const desc = /^description: .*$/m.exec(frontmatter);
  assert.equal(desc && desc[0], 'description: Generate Six-Hats lenses from room data');
  assert.ok(!/[\u2013\u2014]/.test(text), 'no em dash and no en dash');
});

check('C4. the body names the modes deep and quick and gives one line for each old spelling', () => {
  const modes = section('## Two modes');
  assert.ok(/\*\*deep\*\*/.test(modes) && /\*\*quick\*\*/.test(modes), 'both modes in bold');
  const parallelLines = modes.split('\n').filter((l) => l.includes('`--parallel`') && /old spelling/i.test(l) && /deep/.test(l));
  const analyzeLines = modes.split('\n').filter((l) => l.includes('`analyze`') && /old spelling/i.test(l) && /quick/.test(l));
  assert.equal(parallelLines.length, 1, 'one line for --parallel');
  assert.equal(analyzeLines.length, 1, 'one line for analyze');
});

check('C5. the body holds the refusal sentence DEEP_SURFACE_NOTE for a surface with no Agent tool or no shell', () => {
  assert.equal(typeof ops.DEEP_SURFACE_NOTE, 'string');
  assert.ok(body.includes(ops.DEEP_SURFACE_NOTE), 'sentence word for word');
  const rule = section('## Capability rule');
  assert.ok(/Agent tool/.test(rule) && /shell/.test(rule), 'rule names the Agent tool and the shell');
});

check('C6. the unattended-caller paragraph names quick mode and does not name deep', () => {
  const para = body.split('\n\n').find((p) => p.startsWith('**Unattended callers'));
  assert.ok(para, 'unattended paragraph');
  assert.ok(/quick/i.test(para), 'names quick');
  assert.ok(!/deep/i.test(para), 'does not name deep');
});

check('C7. the builder contract block: override list, bans, FS-3, no brief, forbidden keys, no brief placeholder', () => {
  const block = builderBlock();
  assert.ok(/You build the persona of one hat from the room\. You are one hat\./.test(block), 'role line');
  for (const range of ['lines 98 to 100', 'lines 105, 132 and 140 to 155', 'lines 111 to 119', 'lines 58 and 64']) {
    assert.ok(block.includes(range), 'override range: ' + range);
  }
  assert.ok(block.includes('read no file under `personas/`'), 'override of lines 98 to 100');
  assert.ok(block.includes('write one JSON file in your directory; your reply is the word done and the file path'), 'override of output lines');
  assert.ok(block.includes('you are one hat'), 'override of all-hat mode');
  assert.ok(block.includes('brain_search') && block.includes('brain_query'), 'both Brain tools banned by name');
  assert.ok(/Do not call brain_search or brain_query/.test(block), 'ban sentence');
  assert.ok(block.includes(FS3), 'FS-3 word for word');
  assert.ok(block.includes('no brief'), 'the words no brief');
  for (const k of S2_FORBIDDEN_KEYS) assert.ok(block.includes('`' + k + '`'), 'forbidden key ' + k);
  assert.ok(block.includes('mos.persona-spec/1'), 'S-2 schema id');
  for (const k of ['focus', 'hat_questions', 'must_not_judge', 'room_sources']) assert.ok(block.includes('`' + k + '`'), 'S-2 key ' + k);
  assert.ok(!/\{\{?\s*(brief|governing)/i.test(block), 'no brief placeholder');
  assert.ok(!/governing question/i.test(block.replace(/no governing question/gi, '')), 'no governing question given');
  assert.ok(!/sentinel/i.test(block), 'no run sentinel in the contract');
});

check('C8. the body calls the door with the plugin root variable for the four calls; navigator text only by JSON file', () => {
  for (const sub of ['status', 'start', 'write-persona', 'accept-persona']) {
    const re = new RegExp('node "\\$\\{CLAUDE_PLUGIN_ROOT\\}/scripts/persona-hats\\.cjs" ' + sub + ' ');
    assert.ok(re.test(body), 'door call: ' + sub);
  }
  assert.ok(/only (through|by) a JSON file/i.test(body), 'navigator text only through a JSON file');
  assert.ok(/never (as|in) argv/i.test(body), 'never as argv text');
});

check('C9. the body holds neither notice text; it tells Larry to print the notice field first', () => {
  assert.ok(!body.includes(ops.DEEP_NOTICE), 'no DEEP_NOTICE text');
  assert.ok(!body.includes(ops.QUICK_NOTICE), 'no QUICK_NOTICE text');
  assert.ok(/print the `notice` field/i.test(body), 'print the notice field');
  assert.ok(/first line/i.test(section('## Two modes')), 'first line wording in the modes section');
});

check('C10. the brief card: answers approve, edit, the other mode, cancel and defer; first line is the triage recommendation', () => {
  const card = section('### Step 2');
  for (const a of ['approve', 'edit', 'the other mode', 'cancel', 'defer']) assert.ok(card.includes(a), 'answer: ' + a);
  assert.ok(/first line[^\n]*triage recommendation/i.test(card), 'first line is the triage recommendation');
  assert.ok(/F\.6/.test(card), 'shape F.6');
  assert.ok(/not fresh/i.test(card), 'names each hat that is not fresh');
});

check('C11. Stop 2: accept, rebuild (one line of guidance, 2 rebuilds at most), refuse; a refused hat is not run', () => {
  const stop = section('### Step 3');
  for (const a of ['accept', 'rebuild', 'refuse']) assert.ok(stop.includes(a), 'answer: ' + a);
  assert.ok(/one line of guidance/i.test(stop), 'one line of guidance');
  assert.ok(/2 rebuilds at most/i.test(stop), '2 rebuilds at most');
  assert.ok(/not run/i.test(stop), 'refused hat reported as not run');
  assert.ok(/consecutive/i.test(stop), 'consecutive calls for more than 4 questions');
  assert.ok(/F\.8/.test(stop), 'shape F.8');
});

check('C12. while web_scope is null the body holds none of the five fire symbols', () => {
  assert.ok(/^ {2}web_scope: null/m.test(frontmatter), 'web_scope is null in this plan');
  for (const sym of ['fetchCorpus', 'seedGrounding', 'perRingResearch', 'tavily-search', 'WebSearch']) {
    assert.ok(!body.includes(sym), 'body holds ' + sym);
  }
  assert.ok(!/run_in_background/.test(text), 'no background-execution parameter');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
