#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 05 Task 1 (NS369.6-15, NS369.6-17; D-29, D-31, D-35, D-36 to D-40, R-13, R-14, R-17 to R-22).
 * The operation doctrine check. It states, leg by leg, what the persona, the skill, their references, voice-dna and the
 * MCP wire instruct and permit for each operation of the contract, and it names every gap as a KNOWN leg with the plan
 * or the route that owns it. It reads the files at run time. It runs no model and makes no network call.
 *
 * Sources read: the body of agents/larry-extended.md, skills/larry-personality/SKILL.md, every
 * references/personality/*.md (a glob, so a reference that plans 08 and 10 create is read when it lands),
 * skills/larry-personality/mode-engine.md, voice-dna.md, RUNTIME_INSTRUCTIONS (the MCP wire),
 * output-styles/destijl.md, skills/room-proactive/SKILL.md and skills/room-passive/SKILL.md.
 *
 * Legs required now: D1 D2 D4 D5 D6 D9 D-POSTURE D7g D7a (D7a flipped by 369.6-07 Task 2: destijl.md carve-out), D13 D14 (369.6-09 Task 1), D3 D8 D10 D11 D12 (369.6-09 Task 2).
 * Legs KNOWN (the gap exists at this commit; the closing plan or the route is printed):
 *   D7b D7c D7d D7e D7f, every D7h entry, RT1 to RT5.
 * D7h scans for imperative lines that tell Larry to say or name a command or a tool id to the navigator. Every hit at
 * this commit is a frozen entry keyed by the sha256 of its normalised text (file and line are information only, so a
 * line-for-line move does not reopen an entry). A new hit fails.
 *
 * KNOWN rule of this phase: a KNOWN leg that fails prints "KNOWN <leg> closes in <plan>" (or "route <line>") and does not
 * fail the test. A KNOWN leg that now passes FAILS the test: flip it to required in the same commit (transition rule,
 * Codex C6); the SUMMARY of the task records "KNOWN moved: <leg>, owner <plan>, closed by <plan> Task <n>".
 * Tool ids in persona text resolve through tests/test-3696-persona-drift.cjs (persona-drift), never a second resolver.
 * The posture ladder is cited from lib/core/recipe-maps.cjs (postureForCommand), the folded harness-audit todo; no audit
 * runs here.
 *
 * Output: one PASS, FAIL or KNOWN line per leg, then "PASS: n FAIL: n" as the last line. With --counts, one line
 * "DOCTRINE PASS: <n> KNOWN: <n> FAIL: <n>" is printed before it. Exit 0 when no required leg fails.
 * Hermetic: the five home variables are mkdtemp dirs before any repo require; a net guard counts any fetch.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-opdoctrine-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();

const ROOT = path.resolve(__dirname, '..');
const drift = require('./test-3696-persona-drift.cjs'); // persona-drift: the one resolver for tool ids
const { RUNTIME_INSTRUCTIONS } = require(path.join(ROOT, 'lib', 'mcp', 'runtime-instructions.cjs'));
const recipeMaps = require(path.join(ROOT, 'lib', 'core', 'recipe-maps.cjs'));
const stampFormat = require(path.join(ROOT, 'lib', 'core', 'verification-stamp-format.cjs'));

const COUNTS = process.argv.includes('--counts');
let nPass = 0;
let nFail = 0;
let nKnown = 0;

function pass(name) { nPass += 1; console.log('PASS: ' + name); }
function failLine(name, detail) { nFail += 1; console.log('FAIL: ' + name + (detail ? ' (' + detail + ')' : '')); }
function check(name, cond, detail) { if (cond) pass(name); else failLine(name, detail); return !!cond; }

// The KNOWN table. Every KNOWN leg has closes_in (a plan) or route (a line). The gap behind each one is the O1 gap
// named in its why.
const KNOWN = {
  D7b: { closes_in: '369.6-11', why: 'the Thinking Trace runs in Blend and Insight mode without being asked (O1 gap 2, D-36, R-16)' },
  D7c: { closes_in: '369.6-11', why: 'the consult offer names the Brain and asks permission: "Brain has a chain ... Pull it in?" (O1 gap 4, D-38, R-17)' },
  D7d: { closes_in: '369.6-11', why: 'the Provoked mode pitches a command every 3 to 5 turns (O1 gap 5, D-39, R-18)' },
  D7e: { closes_in: '369.6-11', why: 'two supersession examples name an edge type or a tool (O1 gap 11, D-37)' },
  D7f: { closes_in: '369.6-11', why: 'the room-proactive "No ceremony" line cites a rule that has no text (O1 gap 3, D-37)' },
  RT1: { route: '369.7 (scope split: room facts supplied each turn by code)', why: 'no UserPromptSubmit hook calls context_assemble, suggest_next or logs the turn memory_event for Larry (O1 finding 4, gap 7)' },
  RT2: { route: 'a seed (Deferred Ideas: routing for the operations with no instruction today)', why: 'registered tools that no persona or wire text routes (O1 gap 6)' },
  RT3: { route: '369.3 (SW-15, REV-03)', why: 'MCP tools that return instructions instead of executing; the wire says "Instructions returned are not execution"' },
  RT4: { route: 'R-19: no wire change beyond the PwS spelling; voice-dna carries the compact rule', why: 'the wire omits memory_event, recall, research and Eureka (O1 gap 9)' },
  RT5: { route: '369.4 (observer mode on Desktop and Cowork, R-22)', why: 'the Desktop bind and briefing ritual shows the system before the answer (O1 gap 10)' },
};

// A leg whose id is in KNOWN: the leg value is "the gap is closed". A closed gap fails the test until it is flipped.
function leg(id, name, closed, detail) {
  const k = KNOWN[id];
  const label = id + ' ' + name;
  if (!k) return check(label, closed, detail);
  if (closed) return failLine(label + ': KNOWN ' + id + ' now passes: flip it to required', k.why);
  nKnown += 1;
  console.log('KNOWN ' + id + ' ' + (k.closes_in ? 'closes in ' + k.closes_in : 'route ' + k.route) + ': ' + name + ' (' + k.why + (detail ? '; ' + detail : '') + ')');
  return true;
}

// ---- the text under test -----------------------------------------------------------------------------------------
function readRel(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function bodyOf(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;
  const end = lines.indexOf('---', 1);
  return end === -1 ? text : lines.slice(end + 1).join('\n');
}
const norm = function (s) { return String(s).replace(/’/g, "'").replace(/\s+/g, ' ').trim(); };

const AGENT = bodyOf(readRel('agents/larry-extended.md'));
const SKILL = bodyOf(readRel('skills/larry-personality/SKILL.md'));
const MODE = bodyOf(readRel('skills/larry-personality/mode-engine.md'));
const ROOM_PRO = bodyOf(readRel('skills/room-proactive/SKILL.md'));
const ROOM_PAS = bodyOf(readRel('skills/room-passive/SKILL.md'));
const DESTIJL = bodyOf(readRel('output-styles/destijl.md'));
const REF_FILES = fs.readdirSync(path.join(ROOT, 'references', 'personality')).filter(function (f) { return /\.md$/.test(f); }).sort();
const REFS = {};
REF_FILES.forEach(function (f) { REFS[f] = bodyOf(readRel('references/personality/' + f)); });
const DNA = REFS['voice-dna.md'] || '';
// 369.6-10 (D-04): the skill's operator manual moved line for line to three references. The legs that read the moved doctrine
// read SKILL_HOME, the skill plus those references, so a move alone closes no KNOWN leg and weakens no leg. Plan 369.6-11
// rewords the lines in their new home.
const SKILL_HOME = [SKILL, REFS['reach-and-dial.md'] || '', REFS['memory-and-findings.md'] || '', REFS['onboarding.md'] || ''].join('\n');
const CLI = [AGENT, SKILL, MODE].concat(REF_FILES.map(function (f) { return REFS[f]; })).join('\n');
const WIRE = RUNTIME_INSTRUCTIONS;
const ALL_TEXT = CLI + '\n' + WIRE + '\n' + ROOM_PRO + '\n' + ROOM_PAS;

function sectionOf(text, headingPrefix) {
  const lines = text.split('\n');
  const start = lines.findIndex(function (ln) { return ln.replace(/’/g, "'").indexOf(headingPrefix) === 0; });
  if (start === -1) return '';
  const level = /^(#+)/.exec(lines[start])[1].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

console.log('SOURCES: agent body ' + AGENT.length + ' chars, skill ' + SKILL.length + ' chars, ' + REF_FILES.length + ' references, wire ' + Buffer.byteLength(WIRE) + ' B');

// ---- D1 to D6, D9: required now --------------------------------------------------------------------------------
check('D1 context assembly at turn start is instructed on the CLI text and on the wire',
  /context_assemble[^\n]*(turn start|every turn)/i.test(CLI) && /context_assemble/.test(WIRE) && /room_bind[^\n]*context_assemble/.test(WIRE));

check('D2 memory events are instructed and marked silent on the CLI text',
  /memory_event[^\n]*(silent|never narrated)|(silent|never narrated)[^\n]*memory_event/i.test(AGENT) &&
  /memory_event[^\n]*(silent|never narrated)|(silent|never narrated)[^\n]*memory_event/i.test(SKILL));

leg('D3', 'a room read before a room answer is instructed',
  /before (you )?(answer|answering|reply|replying)[^.\n]*\b(room|venture)\b/i.test(CLI) || /\b(room|venture)\b[^.\n]*before (you )?(answer|answering|reply|replying)/i.test(CLI));

check('D4 research and Eureka reach through the engine, and a material step waits at a gate',
  /suggest_next|composeWorkflow|command-resolver/.test(CLI) && /Reach rules/.test(SKILL_HOME) && /Deep Research Escalation/.test(SKILL_HOME) &&
  /(HALTS|halts) at the (FIRST|first) material/.test(AGENT) && /Decision Gate/.test(SKILL_HOME) && /suggest_next/.test(WIRE) && /chain_run pauses material work/.test(WIRE),
  'engine ' + /suggest_next|composeWorkflow/.test(CLI));

check('D5 Theo is reached only through the guarded brain tools and never with room content, on the CLI text and on the wire',
  /brain_ask|brain_query/.test(AGENT) && /Part 8/.test(AGENT + SKILL) && /(room content|LOCAL data|never egress|zero Brain calls)/i.test(AGENT + SKILL) &&
  /guarded mindrian-brain brain_\* tools/.test(WIRE) && /room content NEVER enters mindrian-brain brain_\* calls/.test(WIRE));

{
  // D6 through persona-drift: every tool id the persona text names resolves, or it is a KNOWN name of the drift test.
  const S = drift.loadSources();
  const bad = [];
  let toolRefs = 0;
  drift.SCOPE_FILES().forEach(function (rel) {
    drift.extractReferences(readRel(rel), { file: rel }).forEach(function (h) {
      if (h.kind !== 'tool') return;
      toolRefs += 1;
      const r = drift.resolveReference(h, S);
      if (!r.ok && !drift.KNOWN['tool|' + h.text]) bad.push(h.text + ' at ' + rel + ':' + h.line);
    });
  });
  check('D6 every tool id the persona text names resolves through persona-drift (' + toolRefs + ' tool references read)', bad.length === 0 && toolRefs > 20, bad.join('; '));
}

leg('D8', 'the agent body carries "## Operating invisibly" with a never-say list and an allowed list',
  /^## Operating invisibly/m.test(AGENT) && /never[- ]say/i.test(sectionOf(AGENT, '## Operating invisibly')) && /allowed/i.test(sectionOf(AGENT, '## Operating invisibly')));

check('D9 the wire carries the loop: room_list, room_bind, context_assemble, room_startup, suggest_next and a gate',
  ['room_list', 'room_bind', 'context_assemble', 'room_startup', 'suggest_next', 'gate_render', 'gate_answer'].every(function (t) { return WIRE.indexOf(t) !== -1; }));

leg('D10', 'voice-dna carries the compact operation rule for the MCP prompt path',
  /(never|do not)[^.\n]*(announce|narrate)[^.\n]*(tool|search|room)/i.test(DNA) && /operat/i.test(DNA));

leg('D11', 'a failure and refusal rule keeps error codes, guard names and argument names out of speech',
  /(failure|fails?|refus)[^.\n]*(never|not)[^.\n]*(error code|guard'?s? name|argument names?)/i.test(CLI) ||
  /(never|not)[^.\n]*(error code|guard'?s? name|argument names?)/i.test(CLI));

leg('D12', 'the knowledge-first stance: the room is the default source for a venture question, cited in the navigator\'s own words',
  /(default source|start from what the room (already )?holds)/i.test(CLI));

leg('D13', 'Theo is a named partner: "Theo suggests X" with a frame is allowed and no sentence says to never volunteer Theo',
  /Theo suggests/.test(CLI) && !/never volunteer/i.test(sectionOf(AGENT, '## If asked about Theo by name')));

leg('D14', 'the closing rule: end on the step the engine surfaced, at most one question, say so when the engine has nothing',
  /(engine|suggest_next|chain_resolve)[^.\n]*(surfaced|returned)[^.\n]*(step|move)/i.test(CLI) && /at most one question/i.test(CLI));

// ---- D-POSTURE: the posture ladder is the cited source of what may run unattended after the gate -----------------
// 369.6-08 (D-03): the Post-Gate Handoff section moved to references/personality/agent-operations.md; read it there.
check('D-POSTURE the post-gate handoff cites postureForCommand and lib/core/recipe-maps.cjs exports it',
  /postureForCommand/.test(sectionOf(REFS['agent-operations.md'] || '', '## Post-Gate Handoff')) && typeof recipeMaps.postureForCommand === 'function' &&
  /autonomous_safe/.test(sectionOf(REFS['agent-operations.md'] || '', '## Post-Gate Handoff')));

// ---- D7a to D7g: the O1 contradictions ----------------------------------------------------------------------------
leg('D7a', 'destijl Zone 1 and Zone 4 do not govern Larry\'s conversational turns (body shape methodology)',
  /(Zone 1|header panel)[^.\n]*(Zone 4|footer)[^.\n]*(do(?:es)? not|never|not)[^.\n]*(govern|apply|appear)/i.test(DESTIJL) &&
  /methodology/.test(DESTIJL));

{
  const trace = sectionOf(SKILL, '## Thinking Trace');
  leg('D7b', 'the Thinking Trace runs only when the navigator asks to see the reasoning, or in report mode',
    /(only when|only if)[^.\n]*(asks?|asked|requests?)[^.\n]*(reasoning|trace|work)/i.test(trace) || /report mode/i.test(trace));
}

leg('D7c', 'no consult offer names the Brain or asks permission for a lookup',
  !/Brain has a chain/.test(SKILL_HOME) && !/Pull it in\?/.test(SKILL_HOME));

leg('D7d', 'no every-3-to-5-turns command pitching',
  !/Every 3-5 turns/i.test(SKILL_HOME + AGENT + ROOM_PAS) && !/Mode 2: Provoked/.test(SKILL_HOME));

leg('D7e', 'the supersession examples speak the insight with no edge type and no tool name',
  !/SUPERSEDES edge links the two/.test(SKILL_HOME) && !/I am running contradiction_check/.test(SKILL_HOME));

{
  // The room-proactive line cites a standing rule by quoted phrase. It must exist as text somewhere else.
  const line = ROOM_PRO.split('\n').filter(function (ln) { return /No ceremony/.test(ln); })[0] || '';
  const m = /"([^"]{6,80})"\s+rule/.exec(line);
  const phrase = m ? norm(m[1]).toLowerCase() : null;
  const elsewhere = phrase ? (CLI + '\n' + ROOM_PAS).split('\n').some(function (ln) { return norm(ln).toLowerCase().indexOf(phrase) !== -1; }) : true;
  leg('D7f', 'the room-proactive "No ceremony" citation names a rule that exists', elsewhere, 'cited: ' + (phrase || 'none found'));
}

{
  // D7g: the verbatim stamp sentences are an allowlisted exception (D-33, R-13; O1 gap 12). The allowlist is read from
  // the formatter, so it cannot drift from the code that renders them.
  const unchecked = stampFormat.formatUncheckedDesktop();
  const uncheckedText = Array.isArray(unchecked) ? unchecked.join(' ') : String(unchecked);
  const STAMP_ALLOWLIST = Object.freeze([
    { id: 'unchecked_desktop', text: uncheckedText },
    { id: 'verified_header', text: 'Checked: {tier}. The methodology graph links them in {hop words}: {path text}.' },
    { id: 'unverified_header', text: 'Not verified: {reason phrase}.' },
  ]);
  const skillFlat = norm(SKILL_HOME);
  const missing = STAMP_ALLOWLIST.filter(function (a) { return skillFlat.indexOf(norm(a.text)) === -1; }).map(function (a) { return a.id; });
  check('D7g the verbatim stamp sentences of lib/core/verification-stamp-format.cjs are an allowlisted exception, recorded and present (' + STAMP_ALLOWLIST.length + ' sentences)',
    missing.length === 0 && uncheckedText.length > 10, 'missing ' + missing.join(','));
  global.__STAMP_ALLOWLIST = STAMP_ALLOWLIST;
}

// D7h frozen entries, one per hit at this commit (filled below from --list-d7h and reviewed by hand).
const D7H_ENTRIES = [
  { hash: 'bdb01c98659f9387', file: 'agents/larry-extended.md', line: 91, route: 'reviewed, not changed: the Decision Gates section is byte-frozen by D-09 (V9); the line orders a tool call, it is not speech', text: 'At a genuine, unanswered fork relevant to the conversation, fire the AskUserQuestion tool ' },
  { hash: '60355ce2ad1dd2ca', file: 'skills/larry-personality/SKILL.md', line: 110, closes_in: '369.6-11', text: '1. **GUIDED default.** Reaching surfaces evidence; it never decides for the navigator. Eve' },
  { hash: 'bcf172b760a210ee', file: 'skills/larry-personality/SKILL.md', line: 111, closes_in: '369.6-11', text: '- **PROACTIVE Brain push (SENS-03, brain_consult).** When SENS-03 fires (a framework is na' },
  { hash: '2977a3951cdbb1b7', file: 'skills/larry-personality/SKILL.md', line: 134, closes_in: '369.6-11', text: '7e. **HSI and whitespace are two framings of one reach, both render labels.** Whitespace i' },
  { hash: 'b0ad7dddddfb85f8', file: 'skills/larry-personality/SKILL.md', line: 158, closes_in: '369.6-11', text: 'Offer the quick pass first. Offer the research deep dive only when the navigator wants sou' },
  { hash: '94daab015b23e23e', file: 'skills/larry-personality/SKILL.md', line: 160, closes_in: '369.6-11', text: '**How it surfaces.** SENS-09 (the diffusion/adoption sensor) fires the `brain_consult` rea' },
  { hash: '00832a5d81350de2', file: 'skills/larry-personality/SKILL.md', line: 190, closes_in: '369.6-11', text: '**Offered when genuinely relevant, never forced.** Larry\'s Action Footer / closing line SH' },
  { hash: 'c7d85304f877ed0b', file: 'skills/larry-personality/SKILL.md', line: 352, closes_in: '369.6-11', text: 'When the conversation itself has produced something worth keeping - a sharpened problem de' },
  { hash: 'f46bd1f384511bfc', file: 'skills/larry-personality/SKILL.md', line: 459, closes_in: '369.6-11', text: 'of these shapes fires the clause: the `brain_ask` tool\'s own description now says its' },
  { hash: '238f1ad117854c96', file: 'skills/larry-personality/SKILL.md', line: 657, closes_in: '369.6-11', text: '4. When a context_block reach carries signal `room_delta` (SENS-21), Larry says once and p' },
  { hash: '995ad9d995746757', file: 'skills/larry-personality/SKILL.md', line: 658, closes_in: '369.6-11', text: '5. `/mos:auto-explore` is a fallback everywhere Larry mentions it, on Desktop, Cowork or t' },
  { hash: 'd362f28573689447', file: 'skills/larry-personality/mode-engine.md', line: 162, route: 'a seed (mode-engine.md names Brain tools; the file is outside every persona plan)', text: '1. **Gap-informed shifts:** When `brain_gap_assess` shows heavy conceptual gaps (missing p' },
  { hash: '259ffdf49d55bd94', file: 'skills/larry-personality/mode-engine.md', line: 164, route: 'a seed (mode-engine.md names Brain tools; the file is outside every persona plan)', text: '2. **Pattern-informed shifts:** When `brain_find_patterns` shows the user\'s venture matche' },
  { hash: '54d8e7c586a8cf90', file: 'skills/larry-personality/mode-engine.md', line: 166, route: 'a seed (mode-engine.md names Brain tools; the file is outside every persona plan)', text: '3. **Stage-informed shifts:** When `brain_framework_chain` shows the user has applied many' },
  { hash: '863c1d1022e92ef2', file: 'skills/room-proactive/SKILL.md', line: 233, closes_in: '369.6-11', text: '**Where the ids come from.** Name the real sources by registered tool name: a prior `room_' },
  { hash: '78ac5065fb96aee7', file: 'skills/room-proactive/SKILL.md', line: 237, closes_in: '369.6-11', text: '**Graceful degradation.** The parameter may not exist on the server this session is talkin' },
  { hash: 'b184e0b85519ab66', file: 'skills/room-passive/SKILL.md', line: 145, closes_in: '369.6-11', text: 'For ad-hoc meeting mentions, suggest `/mos:file-meeting` for structured filing.' },
  { hash: '4e604b2cd83562b9', file: 'skills/room-passive/SKILL.md', line: 174, closes_in: '369.6-11', text: 'When room has 2+ sections with content, mention wiki once per session after filing, analyz' },
];

// ---- D7h: imperative lines that tell Larry to say a command or a tool id to the navigator ------------------------
{
  const SCAN_FILES = ['agents/larry-extended.md', 'skills/larry-personality/SKILL.md', 'skills/larry-personality/mode-engine.md',
    'skills/room-proactive/SKILL.md', 'skills/room-passive/SKILL.md'].concat(REF_FILES.map(function (f) { return 'references/personality/' + f; }));
  const connectors = JSON.parse(readRel('data/mcp-tool-connectors.json')).connectors;
  const ids = connectors.map(function (c) { return String(c.surface || '').replace(/^mcp:/, ''); }).filter(Boolean);
  const toolRe = new RegExp('\\b(?:' + ids.join('|') + '|brain_[a-z_]+)\\b');
  const cmdRe = /\/mos:[a-z0-9-]+/;
  // speech verbs: what Larry does with the words in front of the navigator
  const verbRe = /\b(says?|tells?|names?|shows?|announces?|mentions?|suggests?|prints?|surfaces?|offers?)\b/i;
  const stampSentences = (global.__STAMP_ALLOWLIST || []).map(function (a) { return norm(a.text); });
  function hash(line) { return crypto.createHash('sha256').update(norm(line)).digest('hex').slice(0, 16); }
  const hits = [];
  SCAN_FILES.forEach(function (rel) {
    const lines = readRel(rel).split('\n');
    let fm = false;
    lines.forEach(function (ln, i) {
      if (i === 0 && ln === '---') { fm = true; return; }
      if (fm) { if (ln === '---') fm = false; return; }
      if (/^\s*(\||```|#)/.test(ln)) return;
      if (!(verbRe.test(ln) && (toolRe.test(ln) || cmdRe.test(ln)))) return;
      if (stampSentences.some(function (s) { return norm(ln).indexOf(s) !== -1; })) return; // D7g exception
      hits.push({ file: rel, line: i + 1, hash: hash(ln), text: norm(ln).slice(0, 90) });
    });
  });
  // The frozen entries at this commit: hash -> closing plan or route. Hash only; the first 90 characters are information.
  const FROZEN = { entries: D7H_ENTRIES };
  const byHash = {};
  FROZEN.entries.forEach(function (e) { byHash[e.hash] = e; });
  const seen = {};
  hits.forEach(function (h) { seen[h.hash] = h; });
  const fresh = hits.filter(function (h) { return !byHash[h.hash]; });
  check('D7h no new imperative line tells Larry to say a command or a tool id to the navigator (' + hits.length + ' hits, ' + FROZEN.entries.length + ' frozen)', fresh.length === 0,
    fresh.map(function (h) { return h.file + ':' + h.line + ' [' + h.hash + '] ' + h.text; }).join(' | '));
  FROZEN.entries.forEach(function (e) {
    const id = 'D7h[' + e.hash + ']';
    if (seen[e.hash]) {
      nKnown += 1;
      console.log('KNOWN ' + id + ' ' + (e.closes_in ? 'closes in ' + e.closes_in : 'route ' + e.route) + ' (base ' + e.file + ':' + e.line + '; now ' + seen[e.hash].file + ':' + seen[e.hash].line + '; ' + e.text + ')');
    } else {
      failLine(id + ': the frozen line no longer appears: remove the entry from D7H_ENTRIES in this file', e.text);
    }
  });
  if (process.argv.includes('--list-d7h')) {
    hits.forEach(function (h) { console.log(JSON.stringify({ hash: h.hash, file: h.file, line: h.line, text: h.text })); });
  }
}

// ---- RT1 to RT5: runtime facts, each a KNOWN leg with a routing line -----------------------------------------------
{
  const hooks = JSON.parse(readRel('hooks/hooks.json'));
  const promptCmds = [];
  JSON.stringify(hooks.hooks.UserPromptSubmit || [], function (k, v) { if (k === 'command') promptCmds.push(v); return v; });
  const scripts = new Set();
  promptCmds.forEach(function (c) { (c.match(/scripts\/[A-Za-z0-9_.-]+/g) || []).forEach(function (s) { scripts.add(s); }); });
  const callers = Array.from(scripts).filter(function (s) {
    try { return /\b(context_assemble|suggest_next)\b|logMemoryEvent\([^)]*turn/i.test(readRel(s)); } catch (_e) { return false; }
  });
  leg('RT1', 'a UserPromptSubmit hook runs the per-turn operations for Larry', callers.length > 0, scripts.size + ' prompt scripts read');
}
{
  const connectors = JSON.parse(readRel('data/mcp-tool-connectors.json')).connectors;
  const ids = connectors.map(function (c) { return String(c.surface || '').replace(/^mcp:/, ''); }).filter(Boolean);
  const unrouted = ids.filter(function (id) { return !new RegExp('\\b' + id + '\\b').test(ALL_TEXT); });
  leg('RT2', 'every registered tool has a routing instruction', unrouted.length === 0, unrouted.length + ' of ' + ids.length + ' tool ids named nowhere: ' + unrouted.slice(0, 6).join(', ') + (unrouted.length > 6 ? ', ...' : ''));
}
leg('RT3', 'no MCP tool returns instructions instead of executing', !/Instructions returned are not execution/.test(WIRE));
leg('RT4', 'the wire routes memory_event, recall, research and Eureka', /memory_event|graph_query|research_run|eureka/i.test(WIRE));
leg('RT5', 'the Desktop bind and briefing ritual does not show the system before the answer', !/room_startup briefing -> room-dashboard/.test(WIRE));

// ---- X: hygiene --------------------------------------------------------------------------------------------------------
{
  const own = fs.readFileSync(__filename, 'utf8');
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  check('X1 no em dash or en dash in this file', own.split(EM).length === 1 && own.split(EN).length === 1);
  check('X2 no network call was attempted', NET.attempts() === 0);
  check('X3 the file reuses persona-drift and cites postureForCommand', /persona-drift/.test(own) && /postureForCommand/.test(own));
}

if (COUNTS) console.log('DOCTRINE PASS: ' + nPass + ' KNOWN: ' + nKnown + ' FAIL: ' + nFail);
console.log('PASS: ' + nPass + ' FAIL: ' + nFail);
process.exitCode = nFail === 0 ? 0 : 1;
