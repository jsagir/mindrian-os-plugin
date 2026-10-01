#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 18 -- /mos:research becomes the one runner of research plans.
 * Contract test, legs K1-K9.
 *
 * Pins: the Form B hitl_stages declaration and the unchanged connector keys
 * (K1), byte preservation of every pre-phase section and the D-05 exception
 * paragraph placement (K2), the ten body anchors and their ordering (K3), the
 * plan-run section wording (K4), the Tri-Polar statement (K5), the two D-05
 * pointer sentences in scout.md and scheduled-tasks.md (K6), the Read-only
 * lane analyst agent (K7), the registry rows (K8), and dash and phrase hygiene
 * (K9).
 *
 * Plain node:assert/strict, zero dependencies, text and JSON assertions only,
 * no network. Pre-phase text comes from `git show <base_sha>:<path>` with the
 * base_sha in tests/fixtures/363-pre-phase.json. The frontmatter reader is a
 * small YAML-subset parser copied by value from tests/test-361-command-contract.cjs.
 *
 * exit 0 -> PASSED, exit 1 -> FAILED, exit 77 -> ENV GAP (fixture or git object absent).
 *
 * House rule: hyphens only. The dash characters below are spelled as unicode escapes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', '363-pre-phase.json');

const EM = '\u2014';
const EN = '\u2013';

// --- Anchors (363-18-PLAN.md <context>) ------------------------------------

const R1 = '## Plan-run mode (the one research runner)';
const R2 = 'Deep research runs never start unattended. When no navigator can answer the card (inside /mos:act, chain_run, or any caller that cannot answer), save the plan and fetch nothing.';
const R3 = 'Never write a query string yourself. Every query comes from the composer.';
const R4 = 'There is no send-anyway path.';
const R5 = 'No agent is dispatched before the navigator approves the deep research run.';
const R6 = 'subagent_type: research-lane-analyst';
const R7_PENDING = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" pending --room <room dir>';
const R7_DEEPFETCH = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" deep-fetch <run_id> --room <room dir>';
const R8 = 'A grant lets the room fetch. It never files anything.';
const R9 = '### Scientific research perspective (Scientific Roadmapping)';
const R10_START = '**Exception (Phase 363, D-05):**';
const R10 =
  '**Exception (Phase 363, D-05):** inside a standing research grant the navigator approved on an F.0 card, the room itself may start a quick research run in the 355.1 ambient child. Approving the grant is the ask. Anything outside the grant asks again, the grant is visible and revocable, and every query lands in the room\'s audit ledger. Deep research runs never start this way.';
const F6_INSTRUCTION = 'Fire the F.6 Plan Review card with AskUserQuestion';
const F8_INSTRUCTION = 'Fire the F.8 basket with AskUserQuestion';
const FILE_RUN_LINE = 'research-planner.cjs" file-run';

const POINTER = 'Grant-covered quick research runs (Phase 363, D-05) execute in the 355.1 ambient child under the navigator\'s standing research grant, never in this cadence runner, which stays zero-egress.';

const SCOUT_BASE_SENTENCE = 'It is Canon Part 8 zero-egress: no Brain query, no web fetch; competitor watch is emitted as a public-SIGNAL query plan for the surface layer, never fetched inside the runner.';
const SCHED_BASE_SENTENCE = 'It is Canon Part 8 zero-egress (inherited from Plan 01): no Brain query, no web fetch.';

// --- Local frontmatter helpers (copied by value, per plan) -----------------

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function extractFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return m ? { text: m[0], inner: m[1] } : null;
}

function extractBody(raw) {
  const bodyStart = raw.indexOf('\n---', 4);
  return bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw;
}

function extractTopScalar(fm, key) {
  const re = new RegExp('^' + key + ':[ \\t]*(.*)$', 'm');
  const m = re.exec(fm);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/, '').replace(/["']$/, '');
}

function hasTopKey(fm, key) {
  return new RegExp('^' + key + ':', 'm').test(fm);
}

function extractDashList(fm, key) {
  const re = new RegExp('^' + key + ':\\s*\\r?\\n((?:[ \\t]+-[ \\t]+.*\\r?\\n?|[ \\t]*#.*\\r?\\n?)+)', 'm');
  const m = re.exec(fm);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l))
    .map((l) => l.replace(/^[ \t]*-[ \t]+/, '').trim());
}

function extractConnectorBlock(fm) {
  const m = /\nconnector:\r?\n([\s\S]*?)(\r?\n[a-zA-Z_][a-zA-Z0-9_-]*:|$)/.exec('\n' + fm);
  return m ? m[1] : null;
}

function extractNestedScalar(block, key) {
  if (block === null) return null;
  const re = new RegExp('^[ \\t]+' + key + ':[ \\t]*(.*)$');
  for (const line of block.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = re.exec(line);
    if (m) return m[1].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/, '').replace(/["']$/, '');
  }
  return null;
}

// hitl_stages: a list of maps with stage / shapes / mode scalars.
function extractHitlStages(fm) {
  const m = /^hitl_stages:\s*\r?\n((?:[ \t]+.*\r?\n?)+)/m.exec(fm);
  if (!m) return null;
  const stages = [];
  let cur = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    const s = /^\s*-\s+stage:\s*"(.*)"\s*$/.exec(line);
    if (s) { cur = { stage: s[1] }; stages.push(cur); continue; }
    const sh = /^\s+shapes:\s*\[(.*)\]\s*$/.exec(line);
    if (sh && cur) { cur.shapes = sh[1].split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean); continue; }
    const md = /^\s+mode:\s*"(.*)"\s*$/.exec(line);
    if (md && cur) { cur.mode = md[1]; continue; }
  }
  return stages;
}

function gitShow(sha, rel) {
  const r = spawnSync('git', ['show', sha + ':' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git show ' + sha + ':' + rel + ' failed');
  return r.stdout;
}

function sections(body) {
  // Split a markdown body into "## " chunks; each chunk keeps its heading and trailing text.
  const out = new Map();
  const re = /^## .*$/gm;
  const idxs = [];
  let m;
  while ((m = re.exec(body)) !== null) idxs.push({ i: m.index, h: m[0] });
  idxs.forEach((x, n) => {
    const end = n + 1 < idxs.length ? idxs[n + 1].i : body.length;
    out.set(x.h, body.slice(x.i, end));
  });
  return out;
}

let pass = 0;
let fail = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    pass += 1;
  } catch (err) {
    console.log('FAIL: ' + name + ' -- ' + (err && err.message ? err.message.split('\n')[0] : err));
    fail += 1;
  }
}

// --- Load state --------------------------------------------------------------

let fixture;
let baseSha;
try {
  fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  baseSha = fixture.base_sha;
} catch (err) {
  console.log('ENV GAP: fixture not readable at ' + FIXTURE_PATH + ' -- ' + err.message);
  process.exit(77);
}

const RESEARCH_REL = 'commands/research.md';
let baseResearch;
let baseScout;
let baseSched;
let baseRegistry;
try {
  baseResearch = gitShow(baseSha, RESEARCH_REL);
  baseScout = gitShow(baseSha, 'commands/scout.md');
  baseSched = gitShow(baseSha, 'commands/scheduled-tasks.md');
  baseRegistry = JSON.parse(gitShow(baseSha, 'data/command-registry.json'));
} catch (err) {
  console.log('ENV GAP: base_sha git objects not readable -- ' + err.message);
  process.exit(77);
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const raw = read(RESEARCH_REL);
const fmMatch = extractFrontmatter(raw);
assert.ok(fmMatch, 'commands/research.md must open with a --- frontmatter block');
const fm = fmMatch.inner;
const body = extractBody(raw);
const connectorBlock = extractConnectorBlock(fm);
const baseFm = extractFrontmatter(baseResearch).inner;

const r1Start = body.indexOf(R1);
function r1Section() {
  assert.ok(r1Start !== -1, 'R1 heading must be present');
  const after = r1Start + R1.length;
  const next = body.indexOf('\n## ', after);
  return body.slice(r1Start, next === -1 ? body.length : next);
}

// K1 --------------------------------------------------------------------------
leg('K1 frontmatter: no hitl_shape, Form B hitl_stages exact, hitl_why, Agent and Write, connector keys unchanged', () => {
  assert.ok(!hasTopKey(fm, 'hitl_shape'), 'hitl_shape key must be removed');
  assert.deepEqual(extractHitlStages(fm), [
    { stage: 'deep plan review', shapes: ['F.6'], mode: 'gate' },
    { stage: 'deep extend budget', shapes: ['F.3'], mode: 'gate' },
    { stage: 'quick policy grant', shapes: ['F.0'], mode: 'gate' },
    { stage: 'filing', shapes: ['F.8'], mode: 'parallel' },
    // Phase 365-14: the constraint halt and the never-do offer are two more F.1 gates.
    { stage: 'constraint halt', shapes: ['F.1'], mode: 'gate' },
    { stage: 'never-do offer', shapes: ['F.1'], mode: 'gate' },
  ]);
  const why = extractTopScalar(fm, 'hitl_why');
  assert.ok(why && why.length > 20, 'hitl_why must be non-empty');
  assert.notEqual(why, extractTopScalar(baseFm, 'hitl_why'), 'hitl_why must describe the staged flow');
  const tools = extractDashList(fm, 'allowed-tools') || [];
  assert.ok(tools.includes('Agent'), 'allowed-tools must keep Agent');
  assert.ok(tools.includes('Write'), 'allowed-tools must add Write');
  assert.ok(/pre-approval/i.test(fmMatch.text), 'frontmatter must contain the word pre-approval');
  assert.equal(extractNestedScalar(connectorBlock, 'plan_gated'), 'true');
  assert.equal(extractNestedScalar(connectorBlock, 'web_scope'), 'green');
  assert.equal(extractNestedScalar(connectorBlock, 'reach_id'), 'deep_research');
  assert.equal(extractTopScalar(fm, 'autonomous_safe'), 'true');
  assert.equal(extractTopScalar(fm, 'emits_evidence_claims'), 'true');
  assert.equal(extractTopScalar(fm, 'frameworks'), extractTopScalar(baseFm, 'frameworks'));
  const teaching = extractTopScalar(fm, 'teaching');
  assert.notEqual(teaching, extractTopScalar(baseFm, 'teaching'), 'teaching must change');
  assert.ok(/research run/i.test(teaching), 'teaching must name the plan-run mode');
});

// K2 --------------------------------------------------------------------------
leg('K2 byte preservation: every pre-phase section is identical (the R10 paragraph excepted)', () => {
  const baseBody = extractBody(baseResearch);
  const anchors = (fixture.anchors && fixture.anchors[RESEARCH_REL]) || [];
  assert.equal(anchors.length, 1, 'fixture must hold the auto-dispatch anchor');
  assert.ok(body.indexOf(anchors[0]) !== -1, 'the auto-dispatch rule paragraph must be byte-identical');
  // Remove the R10 paragraph (and its trailing blank line) once when present, then compare section by section.
  let stripped = body;
  const r10Idx = body.indexOf(R10_START);
  if (r10Idx !== -1) {
    const lineEnd = body.indexOf('\n\n', r10Idx);
    stripped = body.slice(0, r10Idx) + body.slice(lineEnd + 2);
  }
  const baseSecs = sections(baseBody);
  const curSecs = sections(stripped);
  assert.ok(baseSecs.size >= 10, 'base must have sections');
  for (const [heading, text] of baseSecs) {
    assert.ok(curSecs.has(heading), 'section missing: ' + heading);
    assert.equal(curSecs.get(heading), text, 'section changed: ' + heading);
  }
  // The preamble before the first "## " heading is also byte-identical.
  const firstBase = baseBody.search(/^## /m);
  const firstCur = stripped.search(/^## /m);
  assert.equal(stripped.slice(0, firstCur), baseBody.slice(0, firstBase), 'title and intro must be identical');
});

// K3 --------------------------------------------------------------------------
leg('K3 anchors R1-R10 present, R10 placed, ordering pins hold', () => {
  for (const [n, a] of [['R1', R1], ['R2', R2], ['R3', R3], ['R4', R4], ['R5', R5], ['R6', R6], ['R7 pending', R7_PENDING],
    ['R7 deep-fetch', R7_DEEPFETCH], ['R8', R8], ['R9', R9], ['R10', R10]]) {
    assert.ok(body.indexOf(a) !== -1, n + ' must be present verbatim');
  }
  const sec = r1Section();
  assert.ok(sec.indexOf(R3) !== -1 && sec.indexOf(R4) !== -1 && sec.indexOf(R2) !== -1, 'R2, R3, R4 live in the R1 section');
  assert.ok(body.indexOf(R5) < body.indexOf(R6), 'R5 must precede R6');
  const f6 = body.indexOf(F6_INSTRUCTION);
  assert.ok(f6 !== -1, 'the F.6 AskUserQuestion instruction must be present');
  assert.ok(f6 < body.indexOf(R7_DEEPFETCH), 'the F.6 card must precede deep-fetch');
  const f8 = body.indexOf(F8_INSTRUCTION);
  assert.ok(f8 !== -1, 'the F.8 basket AskUserQuestion instruction must be present');
  const fileRun = body.indexOf(FILE_RUN_LINE);
  assert.ok(fileRun !== -1, 'the file-run line must be present');
  assert.ok(f8 < fileRun, 'the F.8 basket must precede file-run');
  assert.ok(body.indexOf(R7_PENDING) < f6, 'pending cards are handled first');
  const anchor = fixture.anchors[RESEARCH_REL][0];
  assert.equal(body.split(anchor + '\n\n' + R10_START).length - 1, 1, 'R10 must follow the auto-dispatch paragraph directly');
});

// K4 --------------------------------------------------------------------------
leg('K4 the R1 section: forbidden words absent, required words present', () => {
  const sec = r1Section();
  const lower = sec.toLowerCase();
  for (const bad of ['quick pass', 'deep dive', 'tavily', 'websearch']) {
    assert.ok(lower.indexOf(bad) === -1, 'R1 section must not contain: ' + bad);
  }
  for (const need of ['quick research run', 'deep research run', 'resolveFanoutCap', 'approved', 'counterevidence',
    'unresolved', 'F.8', 'next-framework', 'research_run']) {
    assert.ok(sec.indexOf(need) !== -1, 'R1 section must contain: ' + need);
  }
  assert.ok(sec.indexOf('hash_not_approved') !== -1 || sec.indexOf('approved') !== -1);
});

// K5 --------------------------------------------------------------------------
leg('K5 Tri-Polar: a section names Claude Desktop, Cowork, research_run; deep runs execute in Claude Code', () => {
  const secs = sections(body);
  const tri = [...secs.entries()].filter(([h]) => h.startsWith('## Tri-Polar'));
  assert.ok(tri.length >= 1, 'a ## Tri-Polar section must be present');
  const ok = tri.some(([, sec]) => sec.indexOf('Claude Desktop') !== -1 && sec.indexOf('Cowork') !== -1
    && sec.indexOf('research_run') !== -1 && /deep research runs? execute in Claude Code/i.test(sec));
  assert.ok(ok, 'one Tri-Polar section must name Claude Desktop, Cowork, research_run and say deep research runs execute in Claude Code');
});

// K6 --------------------------------------------------------------------------
leg('K6 scout.md and scheduled-tasks.md: base sentences intact, D-05 pointer added', () => {
  const scout = read('commands/scout.md');
  const sched = read('commands/scheduled-tasks.md');
  assert.ok(baseScout.indexOf(SCOUT_BASE_SENTENCE) !== -1, 'base scout sentence sanity');
  assert.ok(baseSched.indexOf(SCHED_BASE_SENTENCE) !== -1, 'base scheduled-tasks sentence sanity');
  assert.ok(scout.indexOf(SCOUT_BASE_SENTENCE + ' ' + POINTER) !== -1, 'scout.md pointer must follow the zero-egress sentence');
  assert.ok(sched.indexOf(SCHED_BASE_SENTENCE + ' ' + POINTER) !== -1, 'scheduled-tasks.md pointer must follow the zero-egress sentence');
  for (const t of [scout, sched]) {
    assert.ok(t.indexOf('ambient child') !== -1 && t.indexOf('standing research grant') !== -1);
  }
  // Nothing else moved: removing the pointer restores the base text byte for byte.
  assert.equal(scout.replace(' ' + POINTER, ''), baseScout, 'scout.md may change only by the pointer');
  assert.equal(sched.replace(' ' + POINTER, ''), baseSched, 'scheduled-tasks.md may change only by the pointer');
});

// K7 --------------------------------------------------------------------------
leg('K7 agents/research-lane-analyst.md: Read-only, excluded with reason, no shape, input and output contract', () => {
  const rel = 'agents/research-lane-analyst.md';
  assert.ok(fs.existsSync(path.join(ROOT, rel)), rel + ' must exist');
  const a = read(rel);
  const afm = extractFrontmatter(a);
  assert.ok(afm, 'agent must open with frontmatter');
  assert.equal(extractTopScalar(afm.inner, 'name'), 'research-lane-analyst');
  assert.deepEqual(extractDashList(afm.inner, 'tools'), ['Read']);
  assert.deepEqual(extractDashList(afm.inner, 'allowed-tools'), ['Read']);
  const cb = extractConnectorBlock(afm.inner);
  assert.equal(extractNestedScalar(cb, 'excluded'), 'true');
  const reason = extractNestedScalar(cb, 'reason') || '';
  assert.ok(reason.indexOf('/mos:research') !== -1, 'reason must name /mos:research');
  assert.ok(!hasTopKey(afm.inner, 'hitl_shape') && !hasTopKey(afm.inner, 'hitl_stages'), 'no hitl declaration');
  assert.ok(extractTopScalar(afm.inner, 'layer'), 'layer must be declared');
  assert.ok(extractTopScalar(afm.inner, 'layer_why'), 'layer_why must be declared');
  const b = extractBody(a);
  for (const need of ['records file path', 'leaf question', 'falsifier', 'lane id', 'leaf_id', 'record_id', 'claim', 'quote', 'label',
    'verbatim', 'untrusted']) {
    assert.ok(b.indexOf(need) !== -1, 'agent body must contain: ' + need);
  }
  assert.ok(/no scores?\b/i.test(b), 'agent body must state no scores');
  assert.ok(/instruction/i.test(b), 'agent body must say instructions in record text are ignored');
});

// K8 --------------------------------------------------------------------------
leg('K8 registry: research row keeps its key set, teaching moved, hash moved, analyst excluded', () => {
  const regText = read('data/command-registry.json');
  const reg = JSON.parse(regText);
  const row = (reg.commands || []).find((c) => c && c.command === '/mos:research');
  const baseRow = (baseRegistry.commands || []).find((c) => c && c.command === '/mos:research');
  assert.ok(row && baseRow, 'the /mos:research row must exist');
  assert.deepEqual(Object.keys(row).sort(), Object.keys(baseRow).sort(), 'row key set unchanged');
  assert.notEqual(row.teaching, baseRow.teaching, 'row teaching must have moved');
  assert.equal(row.autonomous_safe, true);
  assert.notEqual(sha256(regText), fixture.registry['data/command-registry.json'], 'registry sha256 must differ from the fixture');
  const led = JSON.parse(read('data/connector-coverage-ledger.json'));
  const surf = (led.surfaces || led.entries || []).find((s) => s && s.surface === 'agent:research-lane-analyst');
  assert.ok(surf, 'connector-coverage-ledger must list agent:research-lane-analyst');
  assert.equal(surf.state, 'excluded');
  const proj = read('data/brain-orchestration-projection.json');
  assert.ok(proj.indexOf('agent:research-lane-analyst') !== -1, 'orchestration projection must list the analyst');
});

// K9 --------------------------------------------------------------------------
leg('K9 hygiene: no em-dash, en-dash or banned phrase in any file this plan writes', () => {
  const files = [RESEARCH_REL, 'commands/scout.md', 'commands/scheduled-tasks.md', 'agents/research-lane-analyst.md',
    'tests/test-363-runner-contract.cjs'];
  for (const rel of files) {
    if (!fs.existsSync(path.join(ROOT, rel))) { assert.fail('missing file: ' + rel); }
    const t = read(rel);
    if (rel.startsWith('tests/')) {
      // This test names the characters only as escapes; check its raw source has no literal dash.
      assert.ok(t.indexOf(String.fromCharCode(0x2014)) === -1 && t.indexOf(String.fromCharCode(0x2013)) === -1, rel + ' has a literal dash');
      continue;
    }
    assert.ok(t.indexOf(EM) === -1, rel + ' has an em-dash');
    assert.ok(t.indexOf(EN) === -1, rel + ' has an en-dash');
    assert.ok(!/silent\s+fallback/i.test(t), rel + ' says the banned phrase');
  }
});

console.log('--- 363-18 runner contract ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
