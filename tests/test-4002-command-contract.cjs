#!/usr/bin/env node
'use strict';
// Phase 400.2-06: the command contract of /mos:persona (PL-05). Legs C1 to C12 (plan 06); C13 to C19 (plan 09:
// the reader contract, the Blue contract, steps 4 to 9, Stop 4); C20 to C26 and Z1 (plan 14: the handle contract, the
// four search cards, the approved file); C27 to C29 (plan 16: the quick run record, compare, the Rulings section); later plans add legs. The test reads commands/persona.md as text and checks what the
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
// Phase 400.2.1 (S5): the reader contract says that a hook screens the own searches of the hats while the run is open.
const FS3_READER = 'Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. While this run is open, a hook of the plugin also screens each WebSearch query and each WebFetch url for room words before it leaves the machine, and blocks a search that holds one.';
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

check('C1. hitl_stages holds the four stages with their shapes and modes; hitl_why names each stage id', () => {
  const stages = [];
  const re = /^ {2}- stage: "([^"]+)"\n {4}shapes: \[([^\]]*)\]\n {4}mode: "([^"]+)"/gm;
  let m;
  while ((m = re.exec(frontmatter)) !== null) stages.push({ stage: m[1], shapes: m[2].replace(/"/g, '').split(',').map((s) => s.trim()), mode: m[3] });
  assert.deepEqual(stages, [
    { stage: 'brief-confirm', shapes: ['F.6'], mode: 'gate' },
    { stage: 'generate-experts', shapes: ['F.8'], mode: 'parallel' },
    { stage: 'search-approve', shapes: ['F.0'], mode: 'gate' },
    { stage: 'resolve-tension', shapes: ['F.5'], mode: 'gate' },
  ]);
  const why = /^hitl_why: "([^"]*)"/m.exec(frontmatter);
  assert.ok(why, 'hitl_why line');
  for (const s of stages) assert.ok(why[1].includes(s.stage), 'hitl_why names ' + s.stage);
  assert.ok(!/validation-approve/.test(frontmatter), 'no validation-approve stage (FS-1, FS-13)');
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

check('C12. connector.web_scope is green in the command and in the connector registry; the body names no door fetch symbol', () => {
  assert.ok(/^ {2}web_scope: green$/m.test(frontmatter), 'web_scope is green in the command');
  assert.equal((frontmatter.match(/web_scope:/g) || []).length, 1, 'one web_scope key');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'connector-registry.json'), 'utf8'));
  const entry = reg.connectors.find((c) => c && c.surface === '/mos:persona');
  assert.ok(entry, 'the entry of /mos:persona');
  assert.equal(entry.web_scope, 'green', 'web_scope is green in the registry');
  // The door does the fetch of the cards; the command names no symbol of the old fetch path.
  for (const sym of ['fetchCorpus', 'seedGrounding', 'perRingResearch', 'tavily-search']) {
    assert.ok(!body.includes(sym), 'body holds ' + sym);
  }
  assert.ok(body.includes('WebSearch'), 'the first web tool is named, so the declaration is not less than the command');
  assert.ok(!/run_in_background/.test(text), 'no background-execution parameter');
});

// ---------------------------------------------------------------------------
// Plan 09: the reader contract, the Blue contract, steps 4 to 9 and Stop 4
// ---------------------------------------------------------------------------

const READER_START = '<!-- contract:reader:start -->';
const READER_END = '<!-- contract:reader:end -->';
const BLUE_START = '<!-- contract:blue:start -->';
const BLUE_END = '<!-- contract:blue:end -->';
const BLUE_FIXED = 'Blue hat. Read the process only. Say what was skipped, which hat was thin, and what to ask next. Add no content: no fact, no risk, no idea, no recommendation, no position on the target. You are not the judge.';
const NO_WEB = 'this step makes no web search: do not call WebSearch or WebFetch.';

function block(start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  assert.ok(a >= 0 && b > a, start + ' markers present and ordered');
  assert.equal(text.split(start).length - 1, 1, 'one start marker');
  return text.slice(a + start.length, b);
}
const readerBlock = () => block(READER_START, READER_END);
const blueBlock = () => block(BLUE_START, BLUE_END);
const hatLine = (b, hat) => {
  const line = b.split('\n').find((l) => l.startsWith('- ' + hat + ':'));
  assert.ok(line, 'a key line for ' + hat);
  return line;
};

check('C13. the reader contract: role, five line ranges, citation sentence, FS-3, the self lists, the bans, the keys of each hat', () => {
  const b = readerBlock();
  assert.ok(b.includes('You read the target as one hat, alone.'), 'role line');
  for (const range of ['lines 98 to 100', 'lines 105, 132 and 140 to 155', 'lines 111 to 119', 'lines 131 and 135', 'lines 58 and 64']) {
    assert.ok(b.includes(range), 'override range: ' + range);
  }
  assert.ok(b.includes('read no file under `personas/` except your own persona file'), 'override of lines 98 to 100');
  assert.ok(b.includes('write one JSON file in your directory; your reply is the word done and the file path'), 'override of the output lines');
  assert.ok(b.includes('you are one hat'), 'override of all-hat mode');
  assert.ok(b.includes('you may cite an evidence item of your own pack or of the White package by its id, or a source that you found yourself and listed in self_found_sources'), 'the citation sentence');
  assert.ok(b.includes(FS3_READER), 'FS-3 of the reader, with the screen hook sentence, word for word');
  assert.ok(!b.includes(FS3), 'the reader contract no longer says that no code checks the search');
  assert.ok(b.includes('List every search string you sent in self_search_strings and every source you used in self_found_sources.'), 'the sentence about the two lists');
  assert.ok(/Do not call brain_search or brain_query/.test(b), 'both Brain tools banned');
  assert.ok(/Do not read the directory of another hat/.test(b), 'no read of another hat directory');
  assert.ok(b.includes('mos.persona-reading/1'), 'reading schema id');
  assert.ok(b.includes('`reading.json`'), 'the output file');
  const common = b.split('\n').find((l) => l.startsWith('Keys of every hat:'));
  assert.ok(common, 'common key line');
  for (const k of ['schema', 'run_id', 'hat', 'positions']) assert.ok(common.includes('`' + k + '`'), 'common key ' + k);
  const SELF = ['self_search_strings', 'self_found_sources'];
  const want = {
    white: ['evidence', 'missing_data', 'nothing_missing'].concat(SELF),
    black: ['evidence', 'steelman'].concat(SELF),
    yellow: ['evidence', 'none_found'].concat(SELF),
    green: ['provocations', 'evidence'].concat(SELF),
  };
  for (const hat of Object.keys(want)) {
    const line = hatLine(b, hat);
    for (const k of want[hat]) assert.ok(line.includes('`' + k + '`'), hat + ' key ' + k);
  }
  const red = hatLine(b, 'red');
  assert.ok(red.includes('`positions` only'), 'red holds positions only');
  for (const k of ['evidence', 'self_search_strings', 'self_found_sources', 'justification']) assert.ok(!red.includes('`' + k + '`'), 'red names no ' + k + ' key');
  assert.ok(!/sentinel|validation_requests/i.test(b), 'no sentinel and no validation_requests key');
});

check('C14. the reader contract: WebSearch and WebFetch for white, black, yellow and green; red makes no search; the Brain tools stay banned', () => {
  const b = readerBlock();
  assert.ok(/White, black, yellow and green may use WebSearch and WebFetch/.test(b), 'four hats may search');
  assert.ok(/Red makes no search and gives no evidence and no justification/.test(b), 'red makes no search');
  assert.ok(b.toLowerCase().includes(NO_WEB.toLowerCase()), 'red rule: the step makes no web search');
  assert.ok(!/Tavily/i.test(b), 'no Tavily tool is offered');
});

check('C15. the Blue contract: fixed text, three output keys, no search, both Brain bans, ledger.json; no evidence file and no reading of another hat', () => {
  const b = blueBlock();
  assert.ok(b.includes(BLUE_FIXED), 'Blue fixed text of DESIGN 4.6 word for word');
  for (const k of ['skipped', 'thin', 'ask_next']) assert.ok(b.includes('`' + k + '`'), 'output key ' + k);
  assert.ok(/skipped`, `thin` and `ask_next` only/.test(b), 'those three keys only');
  assert.ok(/no search/i.test(b), 'the words no search');
  assert.ok(/Do not call brain_search or brain_query/.test(b), 'both Brain bans');
  assert.ok(b.includes('`ledger.json`'), 'names ledger.json');
  assert.ok(!/evidence\.json|shared-white|EvidenceClaim/.test(b), 'names no evidence file');
  assert.ok(!/reading of (an|any)\s*(other|another)\s*hat|readings of (the )?other hats/i.test(b), 'no reading of another hat');
  assert.ok(b.includes(FS3), 'FS-3 is in every contract');
  assert.ok(b.includes('lines 58 and 64'), 'the override list names lines 58 and 64');
});

check('C16. the body calls the door for plan-research, check, merge and record-ruling; Larry prints notice_lines first and adds nothing; code checks the filed artifact', () => {
  for (const sub of ['plan-research', 'check', 'merge', 'record-ruling']) {
    const re = new RegExp('node "\\$\\{CLAUDE_PLUGIN_ROOT\\}/scripts/persona-hats\\.cjs" ' + sub + ' ');
    assert.ok(re.test(body), 'door call: ' + sub);
  }
  assert.ok(/print the `notice_lines`/i.test(body), 'print notice_lines');
  assert.ok(/notice_lines[^\n]*first/i.test(body), 'first');
  assert.ok(/dissent register[^\n]*before the tensions/i.test(body), 'dissent register before the tensions');
  assert.ok(/add no fact, no risk, no idea and no recommendation/i.test(body), 'add nothing');
  assert.ok(/code checks the filed artifact[^\n]*not the (spoken )?(text|words)/i.test(body), 'code checks the filed artifact and not the spoken text');
  // The headings of the cycle are in order.
  const heads = ['### Step 4', '### Step 5', '### Step 6', '### The reader contract', '### Step 7', '### The Blue contract', '### Step 8', '### Step 9'];
  const at = heads.map((h) => body.indexOf('\n' + h));
  assert.ok(at.every((i) => i >= 0), 'every heading exists: ' + JSON.stringify(at));
  assert.deepEqual(at.slice().sort((x, y) => x - y), at, 'headings in order');
  // The pinned strings of the earlier suites stay.
  assert.ok(body.includes('subagent_type: persona-analyst'), 'subagent_type');
  assert.ok(body.includes('CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'), 'the concurrency cap name');
  assert.ok(body.includes("resolveModel(roomPath, 'persona-analyst')"), 'resolveModel call form');
  assert.ok(/one message/i.test(section('### Step 6')), 'five agents in one message');
  assert.ok(/--counts/.test(section('### Step 8')) && /counts\.json/.test(section('### Step 8')), 'the counts file');
});

check('C17. Stop 4 offers side_a, side_b, both hold and defer with an optional reason; a settled tension is not asked again; consecutive calls above 4', () => {
  const stop = section('### Step 9');
  for (const a of ['side_a', 'side_b', 'both hold', 'defer']) assert.ok(stop.includes(a), 'answer: ' + a);
  assert.ok(/reason/i.test(stop), 'optional reason line');
  assert.ok(/settled tension is not asked again/i.test(stop), 'a settled tension is not asked again');
  assert.ok(/more than 4 open tensions/i.test(stop) && /consecutive/i.test(stop), 'consecutive calls');
  assert.ok(/F\.5/.test(stop), 'shape F.5');
  assert.ok(/reopen/.test(stop), 'only the navigator re-opens');
  assert.ok(/mos\.persona-ruling-answer\/1/.test(stop), 'the answer schema id');
});

check('C18. every claim of a hat stays proposed until the navigator confirms it', () => {
  assert.ok(/every claim of a hat stays proposed until the navigator confirms it/i.test(body));
});

check('C19. the six-agent dispatch with the hand-narrated tension map is gone', () => {
  assert.ok(!body.includes('Hat 1: White'), 'no Hat 1: White status block');
  assert.ok(!body.includes('Emergent (parallel-only)'), 'no Emergent (parallel-only) heading');
  assert.ok(!body.includes('[PARALLEL] Dispatching 6'), 'no six-agent dispatch block');
  assert.ok(!/Build the Tension Map/.test(body), 'no hand-built tension map step');
  assert.ok(!/compute-hsi/.test(body), 'the old HSI trigger line is removed');
  assert.ok(!/[\u2013\u2014]/.test(text), 'no em dash and no en dash');
});

// ---------------------------------------------------------------------------
// Plan 14: the handle contract, Stop 3 (the four search cards) and the fetch call
// ---------------------------------------------------------------------------

const HANDLES_START = '<!-- contract:handles:start -->';
const HANDLES_END = '<!-- contract:handles:end -->';
// Phase 400.2.1 (S5): the own searches of the hats now pass the reader search screen hook (owner ruling 2026-11-26).
const FIXED_CARDS_SENTENCE = 'These cards cover the searches that the door sends. Each reading hat may also search the web on its own to validate and build its case. Those searches pass the reader search screen (a hook) before they leave the machine: a search that holds a room word is blocked. The screen cannot catch a figure or a detail that holds no screened word. The review lists every string a hat reports and every source it found, under their own label.';
const FAILED_PROVIDER = 'A failed provider may be asked again with the same string.';

check('C20. the handle contract: role, override list, inputs with "no room section", handle rule, green rule, web ban, both Brain bans, FS-3, the S-3a keys', () => {
  const b = block(HANDLES_START, HANDLES_END);
  assert.ok(b.includes('You propose search handles for one hat and one brief. You are one hat.'), 'role line');
  for (const range of ['lines 98 to 100', 'lines 105, 132 and 140 to 155', 'lines 111 to 119', 'lines 58 and 64']) {
    assert.ok(b.includes(range), 'override range: ' + range);
  }
  assert.ok(b.includes('read no file under `personas/` except your own persona file'), 'override of lines 98 to 100');
  assert.ok(b.includes('write one JSON file in your directory; your reply is the word done and the file path'), 'override of the output lines');
  assert.ok(b.includes('you are one hat'), 'override of all-hat mode');
  assert.ok(/no room section/i.test(b), 'the words no room section');
  assert.ok(/no White package/i.test(b), 'the words no White package');
  assert.ok(/1 to 4 lower-case words/.test(b), 'the handle rule: 1 to 4 lower-case words');
  assert.ok(/no digit/.test(b), 'no digit');
  assert.ok(/no name of the venture, of a person, of a product or of a place/.test(b), 'no name rule');
  assert.ok(/2 handles at most/.test(b), '2 handles at most');
  assert.ok(/another than the field of the room|a field other than the field of the room/.test(b) && /green/i.test(b), 'the green rule');
  assert.ok(b.toLowerCase().includes(NO_WEB.toLowerCase()), 'this step makes no web search');
  assert.ok(/Do not call brain_search or brain_query/.test(b), 'both Brain bans');
  assert.ok(b.includes('brain_search') && b.includes('brain_query'), 'both Brain tools by name');
  assert.ok(b.includes(FS3), 'FS-3 word for word');
  assert.ok(b.includes('mos.persona-handles/1'), 'S-3a schema id');
  assert.ok(b.includes('`handles.json`'), 'the output file');
  for (const k of ['schema', 'hat', 'handles', 'handle', 'why']) assert.ok(b.includes('`' + k + '`'), 'S-3a key ' + k);
  assert.ok(!/sentinel|validation_requests|followup|validation-approve/i.test(b), 'no sentinel and no follow-up in the contract');
});

check('C21. the body tells Larry to dispatch one handle agent for each hat of handles_needed in one message, and none when the list is empty', () => {
  const step = section('### Step 4');
  assert.ok(/handles_needed/.test(step), 'names handles_needed');
  assert.ok(/one handle agent for each hat of `handles_needed`/.test(step), 'one handle agent for each hat');
  assert.ok(/one message/i.test(step), 'one message');
  assert.ok(/subagent_type: persona-analyst/.test(step), 'the persona-analyst agent');
  assert.ok(step.includes("resolveModel(roomPath, 'persona-analyst')"), 'model through resolveModel');
  assert.ok(/dispatch (no agent|none)[^\n]*(empty|nothing)|(empty|nothing)[^\n]*dispatch (no agent|none)/i.test(step), 'none when the list is empty');
  assert.ok(/plan-research/.test(step), 'the plan-research call is in step 4');
  // The step names no red and no blue handle agent.
  assert.ok(/never (for )?red or blue|red and blue (never|get no)/i.test(step), 'red and blue get no handle agent');
});

check('C22. Stop 3: four cards in one interaction; each hat approved, edited or refused on its own; the card shows strings, providers, unavailable line and the failed-provider sentence', () => {
  const stop = section('### Step 5');
  assert.ok(/F\.0/.test(stop), 'shape F.0');
  assert.ok(/four cards[^\n]*together[^\n]*one (AskUserQuestion )?(call|interaction)|one (AskUserQuestion )?(call|interaction)[^\n]*four cards/i.test(stop), 'four cards together in one interaction');
  assert.ok(/each hat is approved, edited or refused on its own/i.test(stop), 'each hat on its own');
  for (const a of ['approve', 'edit', 'refuse', 'defer']) assert.ok(stop.includes(a), 'answer: ' + a);
  assert.ok(/exact strings?/i.test(stop), 'the exact strings');
  assert.ok(/providers/i.test(stop), 'the providers');
  assert.ok(/unavailable_line/.test(stop), 'the unavailable line');
  assert.ok(stop.includes(FAILED_PROVIDER), 'the failed-provider sentence word for word');
  assert.ok(/refused_shown/.test(stop), 'refused handles are shown with their reasons');
  assert.ok(/not planned/i.test(stop) && /no card/i.test(stop), 'a hat that is not planned gets no card');
  assert.ok(/mktemp -d/.test(stop), 'the edited and approved files go into a private directory');
  assert.ok(/(remove|delete)[^\n]*(directory|dir)/i.test(stop), 'the private directory is removed after use');
});

check('C23. the approved file is written right after the cards with hashes and providers copied from the plan; an edit goes back through plan-research; Larry composes no string', () => {
  const stop = section('### Step 5');
  assert.ok(/mos\.persona-approved\/1/.test(stop), 'S-4 schema id');
  assert.ok(/immediately after the cards/i.test(stop), 'immediately after the cards');
  assert.ok(/copy[^\n]*`?q_hashes`?[^\n]*providers[^\n]*(from )?the plan|copy[^\n]*providers[^\n]*q_hashes[^\n]*plan/i.test(stop), 'hashes and providers copied from the plan');
  assert.ok(/node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/persona-hats\.cjs" run-research /.test(stop), 'the run-research door call');
  assert.ok(/--approved/.test(stop), 'the --approved flag');
  assert.ok(/mos\.persona-edited\/1/.test(stop), 'S-3b schema id');
  assert.ok(/plan-research[^\n]*--edited/.test(stop), 'an edit goes back through plan-research --edited');
  assert.ok(/cards (are|is) shown again/i.test(stop), 'the cards are shown again');
  assert.ok(/no (web )?fetch[^\n]*(before|until)[^\n]*approved/i.test(stop), 'no fetch before the approved file exists');
  assert.ok(!/Larry (composes|writes|makes up|invents|changes) (a|the|any|its own) (search )?string/i.test(body), 'Larry never composes a string');
  assert.ok(/Larry (never|does not) (compose|write|change)[^\n]*string/i.test(stop), 'the command says Larry does not compose or change a string');
  for (const reason of ['step_out_of_order:plan_research', 'plan_changed', 'plan_seq_stale', 'string_not_in_plan', 'too_many_strings', 'provider_list_mismatch', 'hat_never_searches', 'approved_file_missing']) {
    assert.ok(stop.includes(reason), 'refusal reason mapped: ' + reason);
  }
});

check('C24. the body holds the fixed sentence about the door searches and the hat own searches, word for word', () => {
  assert.ok(body.includes(FIXED_CARDS_SENTENCE), 'the fixed sentence');
  const at = body.indexOf(FIXED_CARDS_SENTENCE);
  const stopAt = body.indexOf('\n### Step 5');
  assert.ok(stopAt >= 0 && at > stopAt, 'the sentence is inside or after the Stop 3 heading');
  assert.ok(/Tier 1|same approved search once|ask(ed)? again/i.test(section('### Step 5')), 'the resend is named');
});

check('C25. the deep cycle holds none of "validation-approve", "followup" or "sentinel"; the frontmatter holds none of the first two', () => {
  // The Persona Override section keeps its own, unrelated "local-only sentinel file" (Phase 265); the run sentinel of
  // design v1 is what this leg bans, so it reads the deep cycle and the contract blocks.
  const cycle = section('## The deep cycle');
  for (const w of ['validation-approve', 'followup', 'sentinel']) assert.ok(!cycle.includes(w), 'the deep cycle holds ' + w);
  for (const w of ['validation-approve', 'followup']) assert.ok(!text.includes(w), 'text holds ' + w);
});

check('C26. the step 4 paragraph of plan 09 is gone', () => {
  assert.ok(!/plans no handle search/.test(body), 'no "plans no handle search"');
  assert.ok(!/every hat that researches is `not_planned`/.test(body), 'no "every hat that researches is not_planned"');
  assert.ok(!/Make no call and no fetch here/.test(body), 'the old Step 5 stub is gone');
  assert.ok(!/marks this step as skipped in the output of Step 4/.test(body), 'the old skip line is gone');
});

check('C27. the quick section: the result file into the inbox, merge with it, notice_lines first, rulings offered; no agent run, no fetch and no web search', () => {
  const q = section('## Quick mode');
  assert.ok(/quick-result\.json/.test(q) && /inbox/i.test(q), 'the quick result file goes into the inbox');
  assert.ok(/node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/persona-hats\.cjs" merge /.test(q), 'merge door call');
  assert.ok(/--quick-result/.test(q) && /--counts/.test(q), 'merge flags');
  assert.ok(/print the `notice_lines`[^\n]*first/i.test(q), 'notice_lines first');
  assert.ok(/offer[^\n]*(rulings|record-ruling)/i.test(q), 'record-ruling offered as an option');
  assert.ok(/no agent run, no fetch and no web search/i.test(q), 'no agent run, no fetch and no web search');
  assert.ok(/not an independent review/i.test(q), 'not an independent review');
  assert.ok(/no source, no URL/i.test(q), 'no source in a quick line');
  assert.ok(!q.includes(ops.QUICK_NOTICE) && !q.includes('Checks that need evidence were not run'), 'the fixed texts are the door texts, not written here');
  assert.ok(!/WebSearch|WebFetch|Task\b|subagent_type/.test(q), 'no tool of research or dispatch in the quick section');
});

check('C28. the compare section: Larry may call compare when a deep run and a quick run of one brief exist; a surface with no shell has no run record and no compare', () => {
  const c = section('## Compare');
  assert.ok(/node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/persona-hats\.cjs" compare /.test(c), 'compare door call');
  assert.ok(/--deep/.test(c) && /--quick/.test(c), 'flags');
  assert.ok(/compare\.md/.test(c), 'compare.md');
  assert.ok(/both a deep run and a quick run/i.test(c) && /same brief/i.test(c), 'both runs of one brief');
  assert.ok(/no run record and no compare/i.test(c) && /shell/i.test(c), 'a surface with no shell');
  assert.ok(/not say which mode/i.test(c), 'no verdict on a mode');
  assert.ok(/Navigator note/.test(c), 'the navigator note stays empty');
});

check('C29. Step 9 says that the filed artifact gets a Rulings section and reads the artifact field of the output', () => {
  const stop = section('### Step 9');
  assert.ok(/## Rulings/.test(stop) || /Rulings section/.test(stop), 'Rulings section');
  assert.ok(/`artifact`/.test(stop), 'artifact field of the output');
});

check('C30. the command text matches the door: the resend budget is 2 for each failed lens run, and write-persona is skipped when start skipped it', () => {
  const dispatcher = require(path.join(ROOT, 'lib', 'core', 'recovery', 'dispatcher.cjs'));
  const n = dispatcher.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE;
  assert.equal(n, 2, 'the recovery budget the text names');
  const step5 = section('### Step 5');
  assert.ok(/same provider up to 2 times/.test(step5), 'the resend count is 2');
  assert.ok(!/same provider once/.test(step5), 'the old "once" is gone');
  const step3 = section('### Step 3');
  assert.ok(!/Always make this call/.test(step3), 'the old "always" is gone');
  assert.ok(/Make this call unless `start` skipped it/.test(step3), 'the call depends on the start output');
  assert.ok(/both `to_build` and `to_accept` are empty/.test(step3), 'the skip rule is named');
});

check('C31. CR-01: each persona-agent dispatch (Step 4 handles, Step 6 readers, Step 7 Blue) names the door field of the persona file, never the persona state word', () => {
  // The start output field hats.<hat>.persona is a state word (fresh, missing, stale, unaccepted, preview_only),
  // never a file name. The door prints the file name itself: persona_files.<hat> in the accept-persona output that
  // closed Step 3, and hats.<hat>.persona_file in the start output when Step 3 had nothing to build or accept.
  const parts = {
    'Step 4': section('### Step 4'),
    'Step 6': section('### Step 6'),
    'Step 7': section('### Step 7'),
  };
  for (const [name, s] of Object.entries(parts)) {
    assert.ok(/`persona_files\.(<hat>|blue)`/.test(s), name + ' names persona_files of the accept-persona output');
    assert.ok(/`hats\.(<hat>|blue)\.persona_file`/.test(s), name + ' names hats.<hat>.persona_file of the start output');
    assert.ok(!/`hats\.(<hat>|blue)\.persona`/.test(s), name + ' does not give the state word as the persona file');
  }
});

check('C32. PS-09: the handle contract asks green for one nature handle (nature_handle); Step 5 shows the AskNature string, approves nature.q_hash and prints the nature state', () => {
  const a = text.indexOf('<!-- contract:handles:start -->');
  const b = text.indexOf('<!-- contract:handles:end -->');
  assert.ok(a >= 0 && b > a, 'handle contract markers');
  const h = text.slice(a, b);
  assert.ok(/Nature rule \(green only\)/.test(h), 'the nature rule');
  assert.ok(/`nature_handle`/.test(h), 'the output key');
  assert.ok(/AskNature only/.test(h) && /no qualifier/.test(h), 'AskNature only, no qualifier');
  assert.ok(/no name of the venture/.test(h.slice(h.indexOf('Nature rule'))), 'the identity rule of the nature handle');
  const s5 = section('### Step 5');
  assert.ok(/the `nature` entry/.test(s5), 'the card shows the nature entry');
  assert.ok(/AskNature: not planned \(<reason>\)/.test(s5), 'a nature lens that is not planned is named with its reason');
  assert.ok(/`nature\.q_hash`/.test(s5), 'the approved file holds the nature q_hash');
  assert.ok(/Research green \(AskNature\): <nature>\./.test(s5), 'the research line of the nature lens');
});

check('Z1. the personas one_job_note says "is wired by Phase 400.2" and not "not wired yet"; the two job ids are unchanged', () => {
  const canon = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-job-canon.json'), 'utf8'));
  const list = Array.isArray(canon.sections) ? canon.sections : (Array.isArray(canon) ? canon : null);
  let entry = null;
  if (list) entry = list.find((e) => e && (e.section === 'personas' || e.name === 'personas'));
  if (!entry) {
    const walk = (o) => { if (o && typeof o === 'object') { if (o.one_job_note && /personas\/ holds the six De Bono hat lenses/.test(o.one_job_note)) return o; for (const v of Object.values(o)) { const r = walk(v); if (r) return r; } } return null; };
    entry = walk(canon);
  }
  assert.ok(entry, 'the personas entry');
  assert.ok(entry.one_job_note.includes('Hat-scoped research inside /mos:persona is wired by Phase 400.2: the four researching hats search through approved cards, and web_scope is green.'), 'the new sentence');
  assert.ok(!/not wired yet/.test(entry.one_job_note), 'no "not wired yet"');
  assert.equal(entry.job_id, 'validate-idea');
  assert.equal(entry.secondary_job_id, 'explore');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
