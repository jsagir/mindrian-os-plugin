#!/usr/bin/env node
'use strict';
/*
 * Phase 369.25 plan 18 -- the reader-facing brief and the one next-move composition (pure renderers).
 *
 * RED first: this file is committed before lib/core/feyminto/next-move.cjs and lib/core/feyminto/brief.cjs exist.
 *
 * Arms:
 *   BR1  renderBrief on a born nest (two artifacts, regenerated MINTO, a Theo face from canned asks) returns markdown with
 *        the ten H2 headings in order, frontmatter generated true, edit_surface naming YOUR DECISION, editable_fields
 *        [your_decision], room_id equal to room.db's, and a body under BRIEF_MAX_TOKENS (2000) by bytes / 4; no banned
 *        agreement stem and no empty-answer sentinel
 *   BR2  WE CURRENTLY THINK: the governing thought, or the explicit unresolved line for a placeholder or a missing MINTO
 *   BR3  BECAUSE: each claim renders its state word, the definition and the record id; five labels by claimStateFor;
 *        a human-confirmed node renders canonically_confirmed; no unconfirmed claim line holds the word confirm
 *   BR4  BUT opens with "Weakest assumption: ..." then counterevidence; WHAT CHANGED is FEYNMAN's block; THE QUESTION THAT
 *        MATTERS NOW is the first what-would-change item, else the first cannot-explain item, else "Not yet stated."
 *   BR5  PROPOSED NEXT MOVE: the composed primary, why, sources, alternatives with the outcomes-differ line; four separate
 *        record lines; an interrupted or unrecognized run renders unresolved, a terminal run does not
 *   BR6  RECORD BASIS names the room id and, per input, a content hash and mtime; recordBasis changes when any input changes
 *   BR7  an oversized MINTO truncates with "(more in MINTO.md)" and the body stays under 2000 tokens
 *   BR8  a nextMove pair { cli, mcp } prints both surface lines when the primaries differ and one line when equal
 *   BR9  the Theo block renders "not asked" with its reason for a not-asked face (never blank, never the empty sentinel),
 *        decodes percent-encoded list scalars, and says "not recorded" for a legacy BRAIN.md with no face keys
 *   BR10 a section the navigator data and its contract both mark as having no dedicated command (legal-ip, financial-model)
 *        carries the capability.cjs marker line in PROPOSED NEXT MOVE; a section with a command does not
 *   NM1  agreement beats Theo's rank: Theo first X, ledger and contract both Y -> primary Y, X kept as an alternative
 *   NM2  an instruction-only suggestion is never primary on that surface; it can be an alternative labeled instruction-only
 *   NM3  toTierCandidates returns the buildLedgerCandidates shape with source 'feyminto_face', at most 3 items
 *   NM4  nextMoveForSection returns the same primary as composeNextMove fed the same inputs by hand
 *   NM5  Theo's rank is only the last tie-breaker (ledger order wins a score tie); a verified attempted command is dropped;
 *        an unresolved attempt is counted in provenance; no runnable command gives a null primary and the fixed line
 *   V1   data/claim-state-vocabulary.json holds exactly the five labels with definition and record, not_a_ladder true; dash guard
 *   V2   the two modules carry no Brain client or fetch and never the banned agreement stem
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs). Every Theo read
 * is an injected stub: zero network. Nothing is written under ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SEC = 'problem-definition';
const GEN = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const NO_SIGNAL = '(no ' + 'signal)';
const BANNED = new RegExp(['corro', 'borat'].join(''), 'i');
const TEN = [
  '## THIS NEST SERVES',
  '## WE CURRENTLY THINK',
  '## BECAUSE',
  '## BUT',
  '## WHAT CHANGED',
  '## THE QUESTION THAT MATTERS NOW',
  '## PROPOSED NEXT MOVE',
  "## THEO'S CONTRIBUTION",
  '## YOUR DECISION',
  '## RECORD BASIS',
];
const LABELS = ['quote_matched', 'source_reports', 'derived', 'independently_checked', 'canonically_confirmed'];
const UNRESOLVED_THOUGHT = 'No governing thought yet: an explicit unresolved position.';

const arms = [];
function arm(name, fn) { arms.push({ name, fn }); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}
function has(text, needle, msg) { check(text.indexOf(needle) !== -1, (msg || 'missing') + ': ' + JSON.stringify(needle) + ' in\n' + text.slice(0, 1800)); }

function brief() { return require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs')); }
function nextMove() { return require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs')); }
function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function vocab() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claim-state-vocabulary.json'), 'utf8')); }
function identity(roomDir) {
  return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')).readRoomIdentity(roomDir, { door: 'in_place' });
}

// ---- stubs (the plan 17 seam: a fake brain-client under the brain-derivation module) --------------------------------

const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
const NAV_CMDS = REG.filter((c) => c.surface === 'navigator').map((c) => c.command.replace(/^\/mos:/, ''));
function clone(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); }

function theoGood(tool, args) {
  if (tool === 'find_frameworks_for_problem_type') {
    return {
      rows: [{ problemType: args.problem_type, chapters: [{ chapterId: 'ch-01', phaseLabel: 'Frame the problem', toolTypes: ['Matrix'] }, { chapterId: 'ch-02', phaseLabel: 'Test the frame', toolTypes: ['Experiment'] }], matched: 2, total: 9 }],
      coverage: { matched: 2, total: 9, status: 'partial' },
    };
  }
  if (tool === 'commands_for_problem_type') return { rows: [{ command: NAV_CMDS[0], jtbd: 'Name the problem', framework: '5 Whys Technique' }] };
  if (tool === 'recommend_chain') return { grounded: true, chain: [{ step: 1, framework: '5 Whys Technique' }, { step: 2, framework: '80/20 Rule' }] };
  if (tool === 'framework_neighborhood') return { name: args.framework, chapters: [{ id: 'ch-07', label: 'Chapter 7' }], brainRecords: [], commands: [] };
  return null;
}

function uninstall() {
  const bc = require.resolve('../lib/core/brain-client.cjs');
  delete require.cache[bc];
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
}

function install() {
  const bc = require.resolve('../lib/core/brain-client.cjs');
  const real = require(bc);
  const fake = {
    isAvailable: () => true,
    schema: async () => ({ brain_graph_version: 21432 }),
    query: async () => ({ records: [{ name: 'SWOT', description: 'x' }] }),
    search: async () => ({ matches: [{ title: 'Analogy 1', score: 0.8 }] }),
    smartSearch: async () => null,
    callTool: async (tool, args) => theoGood(tool, clone(args)),
    getBrainUrl: () => 'https://theo-stub.invalid',
    _test: real._test,
  };
  require.cache[bc] = { id: bc, filename: bc, loaded: true, exports: fake };
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
  return require('../lib/core/brain-derivation.cjs');
}

// ---- fixtures ----------------------------------------------------------------------------------------------------

function born(tag) {
  const iso = H.mkIsolatedHome(tag);
  const slug = 'bf-' + tag;
  const b = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  return { iso, roomDir, slug, sectionPath: path.join(roomDir, SEC) };
}

function writeArtifacts(room) {
  fs.writeFileSync(path.join(room.sectionPath, 'interview-notes.md'),
    '---\ntitle: Zanzibar onboarding interview\nframework: 5 Whys Technique\n---\n# Zanzibar onboarding interview\n\nFounders say onboarding takes three weeks.\n', 'utf8');
  fs.writeFileSync(path.join(room.sectionPath, 'problem-statement.md'),
    '---\ntitle: Problem statement\nframeworks: [80/20 Rule]\n---\n# Problem statement\n\nNew hires wait too long to be useful.\n', 'utf8');
}

function gen(room) {
  const r = spawnSync(process.execPath, [GEN, '--write', room.roomDir, '--section', SEC], { env: room.iso.env, encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error('generator exit ' + r.status + '\n' + r.stderr + r.stdout);
}

function plantThought(room, text) {
  const mp = path.join(room.sectionPath, 'MINTO.md');
  const t = fs.readFileSync(mp, 'utf8').replace(/^governing_thought: ".*"$/m, 'governing_thought: "' + text + '"').replace(/^governing_thought_placeholder: true\n/m, '');
  fs.writeFileSync(mp, t, 'utf8');
}

// A born nest with two artifacts and a generated MINTO.md (the placeholder governing thought unless one is planted).
function withMinto(tag, thought) {
  const room = born(tag);
  writeArtifacts(room);
  gen(room);
  if (thought) plantThought(room, thought);
  return room;
}

async function withFace(room) {
  const derive = install();
  try {
    const res = await derive.deriveSection(room.roomDir, SEC, {});
    check(res.success === true, 'deriveSection success, got ' + JSON.stringify(res));
  } finally { uninstall(); }
}

function fm(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  m[1].split(/\r?\n/).forEach((ln) => {
    const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (k) out[k[1]] = k[2].replace(/^"(.*)"$/, '$1');
  });
  return out;
}
function bodyOf(text) { const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/); return m ? m[1] : text; }
function h2s(text) { return bodyOf(text).match(/^## .+$/gm) || []; }
function tokens(text) { return Math.ceil(Buffer.byteLength(bodyOf(text), 'utf8') / 4); }
// The text of one H2 block, heading excluded.
function block(text, heading) {
  const b = bodyOf(text);
  const a = b.indexOf('\n' + heading + '\n');
  if (a === -1) return null;
  const from = a + heading.length + 2;
  const rest = b.slice(from);
  const n = rest.search(/^## /m);
  return (n === -1 ? rest : rest.slice(0, n)).trim();
}
function sha(file) { return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

const mkCap = (cli, mcp) => ({ cli, mcp, label: cli === 'runnable' && mcp === 'runnable' ? 'runnable here (CLI and Desktop)' : (cli === 'runnable' ? 'runnable on CLI; instruction-only on Desktop and Cowork' : 'instruction-only') });
const stubCap = (instructionOnly) => (name) => {
  const io = (instructionOnly || []).indexOf(name) !== -1;
  const c = io ? mkCap('instruction-only', 'instruction-only') : mkCap('runnable', 'runnable');
  return Object.assign({ known: true, kind: 'command', name }, c);
};
const move = (command, sources, instructionOnly) => ({
  command,
  why: 'named by ' + sources.join(' and '),
  sources,
  capability: instructionOnly ? mkCap('instruction-only', 'instruction-only') : mkCap('runnable', 'runnable'),
  instruction_only: !!instructionOnly,
});

// ---- BR1 ---------------------------------------------------------------------------------------------------------

arm('BR1 ten blocks in order, generated marker, edit surface, room id, body under 2000 tokens', async () => {
  const room = withMinto('br1', 'Onboarding takes too long because nobody owns the first week');
  await withFace(room);
  const B = brief();
  eq(B.BRIEF_MAX_TOKENS, 2000, 'BRIEF_MAX_TOKENS');
  eq(Array.from(B.BRIEF_BLOCKS), TEN, 'BRIEF_BLOCKS');
  const text = B.renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  check(typeof text === 'string' && text.length > 0, 'renderBrief returns markdown text');
  eq(h2s(text), TEN, 'the ten H2 headings in order');
  const f = fm(text);
  eq(f.generated, 'true', 'generated: true');
  check(/YOUR DECISION/.test(f.edit_surface || ''), 'edit_surface names YOUR DECISION: ' + f.edit_surface);
  eq(f.editable_fields, '[your_decision]', 'editable_fields');
  eq(f.room_id, identity(room.roomDir).room_id, 'room_id equals readRoomIdentity');
  check(/^\d{4}-\d\d-\d\dT/.test(f.generated_at || ''), 'generated_at present (the walk counts a generated marker): ' + f.generated_at);
  check(/^sha256:[0-9a-f]{64}$/.test(f.record_basis_fingerprint || ''), 'record_basis_fingerprint: ' + f.record_basis_fingerprint);
  eq(f.section, SEC, 'section key');
  check(tokens(text) <= 2000, 'body tokens ' + tokens(text) + ' over 2000');
  check(!BANNED.test(text), 'the banned agreement stem appears');
  check(text.indexOf(NO_SIGNAL) === -1, 'the empty-answer sentinel appears');
  check(text.indexOf('\u2014') === -1 && text.indexOf('\u2013') === -1, 'no em or en dash');
});

// ---- BR2 ---------------------------------------------------------------------------------------------------------

arm('BR2 WE CURRENTLY THINK: the thought, or the explicit unresolved line', () => {
  const planted = withMinto('br2a', 'Onboarding takes too long because nobody owns the first week');
  const t1 = brief().renderBrief({ sectionPath: planted.sectionPath, roomDir: planted.roomDir });
  const b1 = block(t1, '## WE CURRENTLY THINK');
  has(b1, 'Onboarding takes too long because nobody owns the first week', 'governing thought verbatim');
  check(b1.indexOf(UNRESOLVED_THOUGHT) === -1, 'a real thought must not read unresolved');

  const placeholder = withMinto('br2b', null);
  const t2 = brief().renderBrief({ sectionPath: placeholder.sectionPath, roomDir: placeholder.roomDir });
  has(block(t2, '## WE CURRENTLY THINK'), UNRESOLVED_THOUGHT, 'placeholder reads unresolved');

  const noMinto = born('br2c');
  const t3 = brief().renderBrief({ sectionPath: noMinto.sectionPath, roomDir: noMinto.roomDir });
  has(block(t3, '## WE CURRENTLY THINK'), UNRESOLVED_THOUGHT, 'a nest with no MINTO reads unresolved');
  // THIS NEST SERVES carries the job from the room's own identity file and the job id
  const serves = block(t3, '## THIS NEST SERVES');
  has(serves, 'find-problem', 'the nest job id');
  has(serves, 'stated so a stranger can restate it', 'the ROOM.md statement');
});

// ---- BR3 ---------------------------------------------------------------------------------------------------------

arm('BR3 claim states: five labels with definition and record; confirmed only for a human-confirmed node', () => {
  const B = brief();
  const V = vocab();
  const def = {};
  V.labels.forEach((l) => { def[l.label] = l.definition; });

  // unit: the five labels, each from its own record shape
  const confirmed = B.claimStateFor({ id: 'claim:a', text: 'A', source: 'notes.md' }, { review_status: 'confirmed', confirmed_by: 'navigator', verification: [] });
  eq(confirmed.label, 'canonically_confirmed', 'human-confirmed node');
  has(confirmed.record, 'claim:a', 'record names the node');
  has(confirmed.record, 'navigator', 'record names who confirmed');
  eq(confirmed.definition, def.canonically_confirmed, 'definition from the vocabulary file');
  const byAgent = B.claimStateFor({ id: 'claim:b', text: 'B' }, { review_status: 'confirmed', confirmed_by: 'system', verification: [] });
  check(byAgent.label !== 'canonically_confirmed', 'a confirmation by an agent identity is not canonical');
  const proposed = B.claimStateFor({ id: 'claim:c', text: 'C' }, { review_status: 'proposed', confirmed_by: null, verification: [] });
  check(proposed.label !== 'canonically_confirmed', 'a proposed node is not canonical');
  const quote = B.claimStateFor({ id: 'claim:d', text: 'D' }, { review_status: 'proposed', verification: [{ against_id: 'artifact:problem-statement', against_kind: 'artifact', method: 'compare', result: 'supports', checked_by: 'system' }] });
  eq(quote.label, 'quote_matched', 'a compare record that supports');
  has(quote.record, 'artifact:problem-statement', 'record names the matched source');
  const indep = B.claimStateFor({ id: 'claim:e', text: 'E' }, { review_status: 'proposed', verification: [{ against_id: 'experiment:pilot-1', against_kind: 'experiment', method: 'test', result: 'supports', checked_by: 'user' }] });
  eq(indep.label, 'independently_checked', 'an experiment result that supports');
  has(indep.record, 'experiment:pilot-1', 'record names the check');
  const reports = B.claimStateFor({ id: null, text: 'F', source: 'interview-notes.md' }, { review_status: 'proposed', verification: [] });
  eq(reports.label, 'source_reports', 'a source reference only');
  has(reports.record, 'interview-notes.md', 'record names the source');
  const derived = B.claimStateFor({ id: 'claim:g', text: 'G' }, { review_status: 'proposed', verification: [] });
  eq(derived.label, 'derived', 'nothing else on record');
  const disputed = B.claimStateFor({ id: 'claim:h', text: 'H' }, { review_status: 'proposed', status: 'disputed', verification: [{ against_id: 'artifact:x', against_kind: 'artifact', method: 'compare', result: 'contradicts', checked_by: 'system' }] });
  check(disputed.label !== 'quote_matched', 'a contradicting record is not a match');
  has(disputed.record, 'disputed', 'a disputed claim says so in its record');
});

arm('BR3b BECAUSE on a born nest with planted claim nodes', () => {
  const room = withMinto('br3', 'Onboarding takes too long because nobody owns the first week');
  const db = nav().openRoomDbForCaller(room.roomDir);
  const ids = {};
  try {
    const mk = (key, text) => {
      const r = nav().writeClaimNode(db, { knowledge_type: 'fact', text, sessionId: 's-br3', sourceSegment: 'seg-' + key, extraProps: { section: SEC } });
      check(r.ok === true, 'writeClaimNode ' + key + ': ' + JSON.stringify(r));
      ids[key] = r.node_id;
    };
    mk('confirmed', 'Onboarding takes three weeks');
    mk('quote', 'New hires wait too long to be useful');
    mk('plain', 'Managers lose a week per hire');
    const c = nav().confirmNode(db, ids.confirmed, 'navigator');
    check(c.ok === true, 'confirmNode: ' + JSON.stringify(c));
    const v = nav().recordClaimVerification(db, { claim_id: ids.quote, against_id: 'artifact:problem-statement', against_kind: 'artifact', method: 'compare', result: 'supports', checked_by: 'system' });
    check(v.ok === true, 'recordClaimVerification: ' + JSON.stringify(v));
  } finally { nav().closeRoomDbForCaller(db); }

  const text = brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  const because = block(text, '## BECAUSE');
  const lineOf = (needle) => because.split('\n').find((l) => l.indexOf(needle) !== -1) || '';
  const V = vocab();
  const def = {};
  V.labels.forEach((l) => { def[l.label] = l.definition; });

  const lc = lineOf('Onboarding takes three weeks');
  has(lc, 'canonically_confirmed: ' + def.canonically_confirmed, 'the confirmed claim line');
  has(lc, ids.confirmed, 'the confirmed claim line names its node');
  const lq = lineOf('New hires wait too long to be useful');
  has(lq, 'quote_matched: ' + def.quote_matched, 'the matched claim line');
  has(lq, 'artifact:problem-statement', 'the matched claim line names its record');
  const lp = lineOf('Managers lose a week per hire');
  has(lp, 'derived: ' + def.derived, 'the plain claim line');
  has(because, 'source_reports: ' + def.source_reports, 'a MINTO key claim reads source_reports');
  has(because, 'interview-notes', 'a MINTO key claim names its source record');

  // confirmed appears only on the confirmed claim's own line
  const stripped = text.split('\n').filter((l) => l !== lc).join('\n');
  check(!/confirm/i.test(stripped), 'the word confirm appears outside the confirmed claim line: ' + (stripped.match(/.*confirm.*/i) || [''])[0]);
  check(!/confirm/i.test(lq) && !/confirm/i.test(lp), 'an unconfirmed claim line holds the word confirm');

  // every label occurrence is immediately followed by its definition
  LABELS.forEach((label) => {
    let at = text.indexOf(label);
    while (at !== -1) {
      const after = text.slice(at, at + label.length + 2 + def[label].length);
      check(after === label + ': ' + def[label], 'label ' + label + ' appears without its definition: ' + JSON.stringify(text.slice(at, at + 90)));
      at = text.indexOf(label, at + label.length);
    }
  });
});

// ---- BR4 ---------------------------------------------------------------------------------------------------------

function plantRecords(room) {
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = nav().openRoomDbForCaller(room.roomDir);
  try {
    const opts = { source_path: 'test:br4', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed' };
    insertNode(db, 'claim:br-a', 'claim', JSON.stringify({ section: SEC, text: 'Customers do not feel this problem today' }), opts);
    insertNode(db, 'claim:br-b', 'claim', JSON.stringify({ section: 'market-analysis', text: 'Interviewed teams pay to fix this problem today' }), opts);
    const w = nav().writeEdge(db, { source_id: 'claim:br-a', target_id: 'claim:br-b', edge_type: 'CONTRADICTS' });
    check(w && w.ok === true, 'writeEdge: ' + JSON.stringify(w));
    insertNode(db, 'assumption:br-x', 'assumption', JSON.stringify({ section: SEC, text: 'The buyer is also the daily user' }), Object.assign({}, opts, { epistemic_type: 'assumption' }));
    db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, 'DEPENDS_ON', '{}')").run('claim:br-a', 'assumption:br-x');
  } finally { nav().closeRoomDbForCaller(db); }
}

arm('BR4 BUT opens with the weakest assumption; WHAT CHANGED and THE QUESTION come from the faces', () => {
  const room = born('br4');
  writeArtifacts(room);
  plantRecords(room);
  gen(room);
  const text = brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  const but = block(text, '## BUT');
  const first = but.split('\n').filter((l) => l.trim().length > 0)[0];
  eq(first, 'Weakest assumption: The buyer is also the daily user (proposed)', 'first line of BUT');
  has(but, 'Interviewed teams pay to fix this problem today', 'the MINTO counterevidence follows');
  const changed = block(text, '## WHAT CHANGED');
  has(changed, 'Sources added:', 'FEYNMAN what-changed block carried');
  const q = block(text, '## THE QUESTION THAT MATTERS NOW');
  has(q, 'Interviewed teams pay to fix this problem today', 'the first what-would-change item is the question');

  // no records: the question falls to FEYNMAN's first cannot-explain item
  const none = born('br4b');
  writeArtifacts(none);
  gen(none);
  const t2 = brief().renderBrief({ sectionPath: none.sectionPath, roomDir: none.roomDir });
  const q2 = block(t2, '## THE QUESTION THAT MATTERS NOW');
  check(/Thin coverage|Missing:/.test(q2), 'question falls to the first cannot-explain item: ' + q2);
  const but2 = block(t2, '## BUT');
  has(but2.split('\n').filter((l) => l.trim().length > 0)[0], 'Weakest assumption: none recorded in the room yet', 'no assumption on file is said, not hidden');

  // a born nest with nothing stated: Not yet stated.
  const fresh = born('br4c');
  const t3 = brief().renderBrief({ sectionPath: fresh.sectionPath, roomDir: fresh.roomDir });
  eq(block(t3, '## THE QUESTION THAT MATTERS NOW'), 'Not yet stated.', 'nothing stated anywhere');
});

// ---- BR5 ---------------------------------------------------------------------------------------------------------

function writeRun(room, id, o) {
  const dir = path.join(room.roomDir, '.mindrian', 'research-runs', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ schema: 'mos.research-plan/1', run_id: id, return_target: { section: o.section || SEC } }), 'utf8');
  const files = [path.join(dir, 'plan.json')];
  if (o.state) { fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(o.state), 'utf8'); files.push(path.join(dir, 'state.json')); }
  if (o.run) { fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(o.run), 'utf8'); files.push(path.join(dir, 'run.json')); }
  const t = new Date(o.mtime);
  files.forEach((f) => fs.utimesSync(f, t, t));
}

arm('BR5 PROPOSED NEXT MOVE: composed primary, alternatives, four separate records, unresolved runs', () => {
  const room = withMinto('br5', 'Onboarding takes too long because nobody owns the first week');
  const mk = (nm) => brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir, nextMove: nm });
  const nm = { primary: move('diagnose', ['the section contract', 'the ledger']), alternatives: [move('whitespace', ['Theo']), move('futures', ['the ledger'])], outcomes_differ: true, provenance: {} };
  const t1 = mk(nm);
  const pm = block(t1, '## PROPOSED NEXT MOVE');
  has(pm, '/mos:diagnose', 'primary');
  has(pm, 'named by the section contract and the ledger', 'why');
  has(pm, 'runnable here (CLI and Desktop)', 'capability');
  has(pm, '/mos:whitespace', 'alternative 1');
  has(pm, '/mos:futures', 'alternative 2');
  check(/outcomes differ/i.test(pm), 'the outcomes-differ line is present');
  ['Proposed:', 'Selected:', 'Attempted:', 'Verified:'].forEach((k) => check(new RegExp('^' + k, 'm').test(pm), 'record line ' + k + ' missing'));
  has(pm.split('\n').find((l) => /^Selected:/.test(l)), 'none yet', 'no decision recorded yet');
  has(pm.split('\n').find((l) => /^Attempted:/.test(l)), 'none yet', 'no run recorded yet');
  has(pm.split('\n').find((l) => /^Verified:/.test(l)), 'none yet', 'no checking record yet');

  const same = mk({ primary: move('diagnose', ['the ledger']), alternatives: [], outcomes_differ: false, provenance: {} });
  check(!/outcomes differ/i.test(block(same, '## PROPOSED NEXT MOVE')), 'no outcomes-differ line without alternatives');

  // selected: the latest decision record with a user response
  const mp = path.join(room.sectionPath, 'MINTO.md');
  const log = 'decision_log:\n  - session_id: "s-br5"\n    timestamp: "2026-10-06T01:00:00Z"\n    action: "run diagnose"\n    user_response: "approved"\n    reason: "the first week is unowned"\n';
  fs.writeFileSync(mp, fs.readFileSync(mp, 'utf8').replace(/^decision_log: \[\]$/m, log.trimEnd()), 'utf8');
  const sel = block(mk(nm), '## PROPOSED NEXT MOVE').split('\n').find((l) => /^Selected:/.test(l));
  has(sel, 'run diagnose', 'selected names the decision');
  has(sel, 'approved', 'selected names the response');

  // attempted: an interrupted run (state, no run.json) is unresolved
  writeRun(room, 'run-interrupted', { state: { step: 'fetch_round', run_id: 'run-interrupted' }, mtime: '2026-10-06T02:00:00Z' });
  let att = block(mk(nm), '## PROPOSED NEXT MOVE').split('\n').find((l) => /^Attempted:/.test(l));
  has(att, 'unresolved', 'an interrupted run is unresolved');
  has(att, 'run-interrupted', 'names the run');
  // an unrecognized run.json shape is unresolved too
  writeRun(room, 'run-odd', { run: { schema: 'other/9', stop_reason: 'pass_complete' }, mtime: '2026-10-06T03:00:00Z' });
  att = block(mk(nm), '## PROPOSED NEXT MOVE').split('\n').find((l) => /^Attempted:/.test(l));
  has(att, 'unresolved', 'an unrecognized shape is unresolved');
  // a terminal run does not read unresolved, and the verified line stays separate
  writeRun(room, 'run-done', { run: { schema: 'mos.research-run/1', run_id: 'run-done', mode: 'quick', stop_reason: 'pass_complete', finished_at: '2026-10-06T04:00:00Z' }, mtime: '2026-10-06T04:00:00Z' });
  const pm3 = block(mk(nm), '## PROPOSED NEXT MOVE');
  att = pm3.split('\n').find((l) => /^Attempted:/.test(l));
  check(att.indexOf('unresolved') === -1, 'a terminal run reads unresolved: ' + att);
  has(att, 'pass_complete', 'terminal run names its stop reason');
  has(pm3.split('\n').find((l) => /^Verified:/.test(l)), 'none yet', 'a finished run is not a verified result');
  // the earlier interrupted and unrecognized runs stay visibly unresolved until reconciled
  const unresolvedLines = pm3.split('\n').filter((l) => /^Unresolved:/.test(l));
  check(unresolvedLines.length >= 1 && /run-interrupted/.test(unresolvedLines.join('\n')) && /run-odd/.test(unresolvedLines.join('\n')), 'earlier unresolved runs are listed: ' + JSON.stringify(unresolvedLines));
  // a run for another nest never shows here
  writeRun(room, 'run-elsewhere', { section: 'market-analysis', run: { schema: 'mos.research-run/1', run_id: 'run-elsewhere', mode: 'quick', stop_reason: 'cap', finished_at: '2026-10-06T05:00:00Z' }, mtime: '2026-10-06T05:00:00Z' });
  att = block(mk(nm), '## PROPOSED NEXT MOVE').split('\n').find((l) => /^Attempted:/.test(l));
  check(att.indexOf('run-elsewhere') === -1, 'another nest\'s run appears here');
});

// ---- BR6 ---------------------------------------------------------------------------------------------------------

arm('BR6 RECORD BASIS names the room id and each input revision; recordBasis changes with any input', async () => {
  const room = withMinto('br6', 'Onboarding takes too long because nobody owns the first week');
  await withFace(room);
  const B = brief();
  const id = identity(room.roomDir);
  const text = B.renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  const rb = block(text, '## RECORD BASIS');
  has(rb, id.room_id, 'the room id');
  ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'CONTEXT.md', 'ROOM.md'].forEach((f) => {
    const line = rb.split('\n').find((l) => l.indexOf(f) !== -1);
    check(line, 'no RECORD BASIS line for ' + f);
    has(line, sha(path.join(room.sectionPath, f)), f + ' content hash');
    check(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(line), f + ' mtime missing: ' + line);
  });
  const base = B.recordBasis(room.sectionPath, id);
  eq(base.room_id, id.room_id, 'recordBasis room_id');
  eq(base.inputs.map((i) => i.file).sort(), ['BRAIN.md', 'CONTEXT.md', 'FEYNMAN.md', 'MINTO.md', 'ROOM.md'], 'recordBasis inputs');
  check(/^sha256:[0-9a-f]{64}$/.test(base.fingerprint), 'fingerprint shape');
  eq(fm(text).record_basis_fingerprint, base.fingerprint, 'the frontmatter fingerprint is the recordBasis fingerprint');
  eq(B.recordBasis(room.sectionPath).fingerprint, base.fingerprint, 'recordBasis without an identity gives the same fingerprint (the session-start reader has none)');
  // any input change moves the fingerprint
  ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'CONTEXT.md', 'ROOM.md'].forEach((f) => {
    const p = path.join(room.sectionPath, f);
    const before = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, before + '\nbr6 change\n', 'utf8');
    const after = B.recordBasis(room.sectionPath, id).fingerprint;
    fs.writeFileSync(p, before, 'utf8');
    check(after !== base.fingerprint, 'recordBasis did not change when ' + f + ' changed');
  });
  eq(B.recordBasis(room.sectionPath, id).fingerprint, base.fingerprint, 'restoring the inputs restores the fingerprint');
  // an extras digest (claim and run records) moves the full fingerprint, not the files fingerprint
  const withExtra = B.recordBasis(room.sectionPath, id, [{ label: 'claim records', digest: 'abc' }]);
  eq(withExtra.fingerprint, base.fingerprint, 'extras leave the files fingerprint alone');
  check(withExtra.full_fingerprint !== base.full_fingerprint, 'extras move the full fingerprint');
});

// ---- BR7 ---------------------------------------------------------------------------------------------------------

arm('BR7 an oversized MINTO truncates with a link and the body stays under 2000 tokens', () => {
  const iso = H.mkIsolatedHome('br7');
  const dir = path.join(iso.roomsHome, 'synthetic-room', SEC);
  fs.mkdirSync(dir, { recursive: true });
  const long = 'a long supporting sentence that takes many bytes to say very little about the venture ';
  const claims = [];
  for (let i = 1; i <= 60; i++) claims.push('### Claim ' + i + ': ' + long.repeat(2) + i + '\n\n> [!example] Evidence\n> Source: [[source-' + i + '.md|Source ' + i + ']]\n> -- ' + long.repeat(3) + '\n');
  const counter = [];
  for (let i = 1; i <= 30; i++) counter.push('- Counter item ' + i + ' ' + long + '(contradicts: ' + long + ')');
  const assume = [];
  for (let i = 1; i <= 30; i++) assume.push('- Assumption item ' + i + ' ' + long + '(validity: proposed)');
  const minto = '---\nschema_version: "1.0"\ntype: section-minto\nsection: ' + SEC + '\ngoverning_thought: "A thought that stands"\nlast_generated_at: "2026-10-06T00:00:00Z"\ndecision_log: []\n---\n\n# Problem Definition -- Minto Reasoning\n\n## Key Claims\n\n' + claims.join('\n') + '\n## Counterevidence\n\n' + counter.join('\n') + '\n\n## Assumptions\n\n' + assume.join('\n') + '\n\n## What would change the conclusion\n\n- If "x" holds, the governing thought needs revision.\n';
  fs.writeFileSync(path.join(dir, 'MINTO.md'), minto, 'utf8');
  const text = brief().renderBrief({ sectionPath: dir, roomDir: path.dirname(dir) });
  check(tokens(text) <= 2000, 'oversized MINTO body tokens ' + tokens(text) + ' over 2000');
  has(text, '(more in MINTO.md)', 'truncation points at the face');
  eq(h2s(text), TEN, 'all ten blocks survive truncation');
  has(text, 'Weakest assumption: Assumption item 1', 'the weakest assumption survives truncation');
});

// ---- BR8 ---------------------------------------------------------------------------------------------------------

arm('BR8 a nextMove pair prints both surface lines when primaries differ, one when equal', () => {
  const room = born('br8');
  const mk = (pair) => block(brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir, nextMove: pair }), '## PROPOSED NEXT MOVE');
  const cli = { primary: move('diagnose', ['the ledger']), alternatives: [], outcomes_differ: false, provenance: {} };
  const mcp = { primary: move('whitespace', ['the ledger']), alternatives: [], outcomes_differ: false, provenance: {} };
  const both = mk({ cli, mcp });
  has(both, 'On the command line: /mos:diagnose', 'cli line');
  has(both, 'In Desktop and Cowork: /mos:whitespace', 'mcp line');
  const one = mk({ cli, mcp: cli });
  check(one.indexOf('On the command line:') === -1 && one.indexOf('In Desktop and Cowork:') === -1, 'equal primaries must print one line');
  has(one, '/mos:diagnose', 'the single primary');
  const none = mk({ cli: { primary: null, alternatives: [], outcomes_differ: false, why: 'Nothing runnable here for this nest; see the alternatives or assisted work.', provenance: {} }, mcp: { primary: null, alternatives: [], outcomes_differ: false, why: 'Nothing runnable here for this nest; see the alternatives or assisted work.', provenance: {} } });
  has(none, 'Nothing runnable here for this nest', 'a null primary says so');
});

// ---- BR9 ---------------------------------------------------------------------------------------------------------

arm('BR9 THEO\'S CONTRIBUTION: not asked with its reason, decoded lists, legacy face, no face', async () => {
  // a born nest: the face says not asked (at birth)
  const fresh = born('br9a');
  const t1 = brief().renderBrief({ sectionPath: fresh.sectionPath, roomDir: fresh.roomDir });
  const tb = block(t1, "## THEO'S CONTRIBUTION");
  has(tb, 'not asked: the room was just created', 'the not-asked reason line');
  has(tb, 'no Theo guidance', 'says what the absence means');
  has(tb, 'tier_0', 'a not-asked face behaves as tier_0');
  check(tb.length > 40 && tb.indexOf(NO_SIGNAL) === -1, 'never blank, never the empty sentinel');

  // an asked face: what the face recorded, and a decoded framework name with a comma
  const room = withMinto('br9b', 'A thought');
  await withFace(room);
  const bp = path.join(room.sectionPath, 'BRAIN.md');
  const raw = fs.readFileSync(bp, 'utf8').replace(/^suggested_frameworks: .*$/m, 'suggested_frameworks: MECE (Mutually Exclusive%2C Collectively Exhaustive),Brooks%27s Law');
  fs.writeFileSync(bp, raw, 'utf8');
  const t2 = brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  const tb2 = block(t2, "## THEO'S CONTRIBUTION");
  has(tb2, 'MECE (Mutually Exclusive, Collectively Exhaustive)', 'decoded comma');
  has(tb2, "Brooks's Law", 'decoded apostrophe');
  check(tb2.indexOf('%2C') === -1 && tb2.indexOf('%27') === -1, 'no percent-encoded text reaches the reader');
  has(tb2, 'Theo was asked', 'asked says so');
  has(tb2, 'BRAIN.md', 'links the face for the omitted detail');

  // a legacy BRAIN.md with no face keys
  const legacy = born('br9c');
  fs.writeFileSync(path.join(legacy.sectionPath, 'BRAIN.md'), '---\nsection: "problem-definition"\nbrain_generated_at: "2026-04-20T12:00:00Z"\nbrain_graph_version: 1\ngoverning_thought_hash: "sha256:abc"\nstaleness: "fresh"\nauthor: "brain"\n---\n\n## Pattern Matches\n\n- x\n', 'utf8');
  const t3 = brief().renderBrief({ sectionPath: legacy.sectionPath, roomDir: legacy.roomDir });
  has(block(t3, "## THEO'S CONTRIBUTION"), 'not recorded', 'a legacy face says not recorded');

  // no BRAIN.md at all
  const bare = born('br9d');
  fs.rmSync(path.join(bare.sectionPath, 'BRAIN.md'));
  const t4 = brief().renderBrief({ sectionPath: bare.sectionPath, roomDir: bare.roomDir });
  has(block(t4, "## THEO'S CONTRIBUTION"), 'not asked', 'no face reads not asked');
});

// ---- BR10 --------------------------------------------------------------------------------------------------------

arm('BR10 a section with no dedicated command says so in PROPOSED NEXT MOVE (the plan 06 marker); one with a command does not', () => {
  const room = born('br10');
  const LINE = 'no runnable command here; instruction-only or assisted';
  ['legal-ip', 'financial-model'].forEach((sec) => {
    const t = brief().renderBrief({ sectionPath: path.join(room.roomDir, sec), roomDir: room.roomDir });
    const pm = block(t, '## PROPOSED NEXT MOVE');
    has(pm, LINE, sec + ' carries the section marker');
    has(pm, 'general command', sec + ' says the primary is a general command, not a dedicated one');
  });
  const t = brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  check(block(t, '## PROPOSED NEXT MOVE').indexOf(LINE) === -1, 'a section with a dedicated command must not carry the marker');
});

// ---- NM ----------------------------------------------------------------------------------------------------------

const face = (names) => ({ asked: true, commands: names.map((n) => ({ name: n, cli: 'runnable', mcp: 'runnable' })), frameworks: [] });
const src = (contract, ledger, table) => ({ contract: { names: contract || [] }, ledger: { names: ledger || [], provenance: { stamp: 'test' } }, navigator_table: { names: table || [] } });
const led = (names) => (names.length ? [{ source: 'section_ledger', items: names.map((n) => ({ id: n, confidence: null, source: 'ground-truth' })) }] : null);

arm('NM1 agreement beats Theo\'s rank', () => {
  const NM = nextMove();
  const r = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face(['X', 'Y']), sources: src(['Y', 'Z'], ['Y'], []), ledgerCandidates: led(['Y']), surface: 'cli', attempted: [], capabilityFor: stubCap([]) });
  eq(r.primary.command, 'Y', 'agreement beats Theo\'s first suggestion');
  check(r.primary.sources.length >= 2, 'the primary names its sources: ' + JSON.stringify(r.primary.sources));
  check(r.alternatives.some((a) => a.command === 'X'), 'Theo\'s first suggestion is kept as an alternative');
  check(r.alternatives.length <= 2, 'at most two alternatives');
  eq(r.outcomes_differ, true, 'the alternatives rest on different sources');
  check(typeof r.primary.why === 'string' && /contract/i.test(r.primary.why) && /ledger/i.test(r.primary.why), 'why names the agreeing sources: ' + r.primary.why);
  eq(r.provenance.face_asked, true, 'provenance names whether Theo was asked');
  eq(r.provenance.theo_top, 'X', 'provenance names what Theo ranked first');
  // alternatives that rest on the same sources do not claim different outcomes
  const same = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face([]), sources: src(['Y'], ['Y'], []), ledgerCandidates: led(['Y']), surface: 'cli', attempted: [], capabilityFor: stubCap([]) });
  eq(same.alternatives, [], 'a single candidate has no alternatives');
  eq(same.outcomes_differ, false, 'no alternatives, no differing outcomes');
});

arm('NM2 an instruction-only suggestion is never primary on that surface', () => {
  const NM = nextMove();
  const r = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face(['X', 'Y']), sources: src(['Y'], ['Y'], []), ledgerCandidates: led(['Y']), surface: 'cli', attempted: [], capabilityFor: stubCap(['Y']) });
  check(r.primary && r.primary.command !== 'Y', 'an instruction-only command is primary: ' + JSON.stringify(r.primary));
  const y = r.alternatives.find((a) => a.command === 'Y');
  check(y, 'the instruction-only command can be an alternative');
  eq(y.instruction_only, true, 'it is labeled instruction-only');
  has(y.capability.label, 'instruction-only', 'the label says so');
});

arm('NM3 toTierCandidates returns the ledger shape with source feyminto_face', () => {
  const NM = nextMove();
  const r = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face(['A', 'B', 'C', 'D']), sources: src(['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D'], []), ledgerCandidates: led(['A', 'B', 'C', 'D']), surface: 'cli', attempted: [], capabilityFor: stubCap([]) });
  const t = NM.toTierCandidates(r);
  check(Array.isArray(t) && t.length === 1, 'one tier entry like buildLedgerCandidates');
  eq(t[0].source, 'feyminto_face', 'source');
  check(Array.isArray(t[0].items) && t[0].items.length <= 3 && t[0].items.length >= 1, 'items at most 3 (Canon Part 3 MAX_K): ' + t[0].items.length);
  eq(t[0].items[0].id, r.primary.command, 'the primary first');
  t[0].items.forEach((i) => check(typeof i.id === 'string' && i.id.length > 0, 'every item has an id'));
  const empty = NM.toTierCandidates({ primary: null, alternatives: [], outcomes_differ: false });
  check(empty === null || (Array.isArray(empty) && empty.length === 0), 'no primary, no candidates (the ledger stays the fallback)');
});

arm('NM4 nextMoveForSection equals composeNextMove fed the same inputs by hand', async () => {
  const room = withMinto('nm4', 'Onboarding takes too long because nobody owns the first week');
  await withFace(room);
  const NM = nextMove();
  const { decodeFaceList } = require(path.join(ROOT, 'lib', 'core', 'brain-md-schema.cjs'));
  const f = fm(fs.readFileSync(path.join(room.sectionPath, 'BRAIN.md'), 'utf8'));
  const cmds = decodeFaceList(f.suggested_commands).map((e) => { const p = e.split(':'); return { name: p[0], cli: p[1], mcp: p[2] }; });
  check(cmds.length >= 1, 'the fixture face suggests at least one command: ' + f.suggested_commands);
  const sources = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'command-sources.cjs')).sourcesForSection(SEC);
  const ledger = require(path.join(ROOT, 'lib', 'core', 'section-ruling-candidates.cjs')).buildLedgerCandidates({ jobId: 'find-problem' });
  ['cli', 'mcp'].forEach((surface) => {
    const hand = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: { asked: true, commands: cmds, frameworks: [] }, sources, ledgerCandidates: ledger, surface, attempted: [] });
    const got = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: room.sectionPath, surface });
    eq(got.primary, hand.primary, 'primary on ' + surface);
    eq(got.alternatives.map((a) => a.command), hand.alternatives.map((a) => a.command), 'alternatives on ' + surface);
  });
  // the brief proposes exactly the move nextMoveForSection composes (one decision path)
  const t = brief().renderBrief({ sectionPath: room.sectionPath, roomDir: room.roomDir });
  const got = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: room.sectionPath, surface: 'cli' });
  has(block(t, '## PROPOSED NEXT MOVE'), '/mos:' + got.primary.command, 'the brief names the composed primary');
});

arm('NM5 Theo rank is the last tie-breaker; verified attempts drop; unresolved attempts count; null primary line', () => {
  const NM = nextMove();
  // A and B are each named by Theo and the ledger (score 2); Theo ranks A first, the ledger ranks B first: ledger order wins
  const r = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face(['A', 'B']), sources: src([], ['B', 'A'], []), ledgerCandidates: led(['B', 'A']), surface: 'cli', attempted: [], capabilityFor: stubCap([]) });
  eq(r.primary.command, 'B', 'the ledger order breaks a score tie before Theo\'s rank');
  // Theo alone orders candidates nobody else names
  const t = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face(['P', 'Q']), sources: src([], [], []), ledgerCandidates: null, surface: 'cli', attempted: [], capabilityFor: stubCap([]) });
  eq(t.primary.command, 'P', 'Theo rank orders what no other source names');
  // a command already run to a verified terminal result is dropped
  const d = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face([]), sources: src(['Y', 'Z'], ['Y', 'Z'], []), ledgerCandidates: led(['Y', 'Z']), surface: 'cli', attempted: [{ command: 'Y', status: 'terminal', verified: true }], capabilityFor: stubCap([]) });
  eq(d.primary.command, 'Z', 'a verified attempted command is dropped');
  // a terminal but unverified attempt is not dropped; an unresolved one is counted
  const u = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face([]), sources: src(['Y'], ['Y'], []), ledgerCandidates: led(['Y']), surface: 'cli', attempted: [{ command: 'Y', status: 'terminal', verified: false }, { command: null, status: 'unresolved', verified: false, run_id: 'r1' }], capabilityFor: stubCap([]) });
  eq(u.primary.command, 'Y', 'an unverified attempt does not drop the command');
  eq(u.provenance.unresolved_attempts, 1, 'unresolved attempts are counted');
  // nothing runnable here
  const n = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face(['X']), sources: src(['X'], ['X'], []), ledgerCandidates: led(['X']), surface: 'mcp', attempted: [], capabilityFor: stubCap(['X']) });
  eq(n.primary, null, 'no runnable command, no primary');
  eq(n.why, 'Nothing runnable here for this nest; see the alternatives or assisted work.', 'the fixed line');
  check(n.alternatives.some((a) => a.command === 'X' && a.instruction_only === true), 'the instruction-only command is still shown as an alternative');
  // an asked-false face with no suggestions still composes from the contract and the ledger
  const w = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: { asked: false, not_asked_reason: 'at_birth', commands: [], frameworks: [] }, sources: src(['Y'], ['Y'], []), ledgerCandidates: led(['Y']), surface: 'cli', attempted: [], capabilityFor: stubCap([]) });
  eq(w.primary.command, 'Y', 'a not-asked face leaves the other sources in charge');
  eq(w.provenance.face_asked, false, 'provenance says Theo was not asked');
  // the minto need adds a source to a command that already has candidates
  const reg = REG.find((c) => (c.serves_jtbd || []).indexOf('surface-contradiction') !== -1);
  const rn = reg ? reg.command.replace(/^\/mos:/, '') : null;
  check(rn, 'the registry has a surface-contradiction command');
  const m = NM.composeNextMove({ section: SEC, jobId: 'find-problem', face: face([]), sources: src(['K', rn], ['K', rn], []), ledgerCandidates: led(['K', rn]), surface: 'cli', attempted: [], need: { counterevidence: 1, assumptions: 0 }, capabilityFor: stubCap([]) });
  eq(m.primary.command, rn, 'open counterevidence lifts the command that serves surface-contradiction');
  check(m.primary.sources.some((s) => /counterevidence|assumption/i.test(s)), 'the primary says the MINTO face contributed: ' + JSON.stringify(m.primary.sources));
});

// ---- V1 ----------------------------------------------------------------------------------------------------------

arm('V1 claim-state vocabulary: five labels, definitions, records, not a ladder; dash guard', () => {
  const v = vocab();
  eq(v.labels.map((l) => l.label), LABELS, 'the five labels');
  v.labels.forEach((l) => {
    check(typeof l.definition === 'string' && l.definition.length > 20, l.label + ' definition');
    check(typeof l.record === 'string' && l.record.length > 3, l.label + ' record');
    if (l.label !== 'canonically_confirmed') check(!/confirm/i.test(l.definition + ' ' + l.record), l.label + ' must not hold the word confirm');
  });
  eq(v.not_a_ladder, true, 'not_a_ladder');
  check(/annex C16/.test(v.provenance) && /amend/.test(v.provenance), 'provenance names the annex and the navigator\'s right to amend');
  const files = [
    'data/claim-state-vocabulary.json', 'tests/test-36925-brief.cjs',
    'lib/core/feyminto/next-move.cjs', 'lib/core/feyminto/brief.cjs',
  ].map((f) => path.join(ROOT, f));
  eq(H.dashGuard(files), [], 'no em or en dash in the plan 18 files (a file not written yet is skipped)');
});

arm('V2 the two modules are local and never carry the banned agreement stem', () => {
  [path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'), path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs')].forEach((f) => {
    check(fs.existsSync(f), 'missing module ' + f);
    const t = fs.readFileSync(f, 'utf8');
    check(!/brain-client|fetch\(/.test(t), f + ' reaches the network or the Brain client');
    check(!BANNED.test(t), f + ' carries the banned stem (build it from pieces, the way theo-face does)');
  });
});

// ---- runner ------------------------------------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;
  const failedNames = [];
  for (const a of arms) {
    try {
      await a.fn();
      passed += 1;
      console.log('PASS: ' + a.name);
    } catch (e) {
      failed += 1;
      failedNames.push(a.name);
      console.log('FAIL: ' + a.name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
    }
  }
  console.log('\ntest-36925-brief: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) { console.log('failed: ' + failedNames.join(' | ')); process.exit(1); }
})();
