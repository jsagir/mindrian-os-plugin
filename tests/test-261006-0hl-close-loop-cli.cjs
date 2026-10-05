#!/usr/bin/env node
'use strict';
/*
 * Quick 261006-0hl -- the BONO close-loop CLI door (scripts/close-loop.cjs).
 *
 * WHY THIS TEST EXISTS. The shipped close-the-loop spine (lib/core/close-loop-writer.cjs) had no shell entry
 * point, so a governed BONO run could not write its conclusion, could not start a SUPERSEDES chain, and could
 * not offer its hats as reusable experts. scripts/close-loop.cjs is that door: close, version-log,
 * offer-experts, file-expert. This test drives the door as a child process against a birthRoom fixture room.
 *
 * ISOLATION. HOME and the rooms home are mkdtemp dirs for every in-process and spawned use; nothing here
 * touches ~/.mindrian or ~/MindrianRooms. Payload, hats and spec files live in a separate mkdtemp dir, never
 * inside the room.
 *
 * LITERALS. Every expected number comes from the payload design (2 claims + 1 known + 1 killed = 4
 * non-conclusion claim nodes; known SUPPORTS + killed REJECTED_BECAUSE + 1 relation = 3 semantic edges) or from
 * the shipped contributionRank sum (EVIDENCE_TIER_RANK / 4 + survivalRate).
 *
 * Arms: A B B2 B3 C C2 C3 D E F G R U.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DOOR = path.join(ROOT, 'scripts', 'close-loop.cjs');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function arm(name, fn) {
  try {
    const r = fn();
    if (r === 'SKIP') { console.log('SKIP: ' + name); return; }
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': expected ' + b + ' got ' + a);
}

const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '0hl-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

// -- isolation ---------------------------------------------------------------------------------------------
const HOME = mk('home');
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
delete process.env.TAVILY_API_KEY;
const ROOMS = path.join(mk('rooms'), 'rooms');
fs.mkdirSync(ROOMS, { recursive: true });
process.env.MINDRIAN_ROOMS_HOME = ROOMS;
const FILES = mk('files');
const ENV = Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: ROOMS });

const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const { SYNTHETIC_EXPERT_NODE_ID } = require(path.join(ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs'));
const { AGENT_IDENTITIES } = require(path.join(ROOT, 'lib', 'core', 'navigation', 'transitions.cjs'));

// -- the fixture room, born by birthRoom --------------------------------------------------------------------
const SLUG = 'close-loop-0hl';
const ROOM = path.join(ROOMS, SLUG);
const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
  slug: SLUG, roomDir: ROOM, sessionId: '0hl-test', ventureText: 'A venture for the close-loop door test',
  jtbd: '', approvedBy: '0hl-test', canonicalRole: 'founder', vname: 'Close Loop 0hl', vstage: 'Pre-Opportunity',
});
if (!birth || birth.ok !== true) {
  console.log('SETUP FAIL: birthRoom ' + JSON.stringify(birth));
  process.exit(1);
}
const ROOM_REAL = fs.realpathSync(ROOM);

// -- helpers -------------------------------------------------------------------------------------------------
function door(args, opts) {
  const o = opts || {};
  return cp.spawnSync(process.execPath, [DOOR].concat(args), {
    env: ENV, encoding: 'utf8', cwd: o.cwd || ROOT, timeout: 60000,
  });
}
function json(r) {
  try { return JSON.parse(r.stdout); } catch (_e) { throw new Error('stdout is not JSON: ' + String(r.stdout).slice(0, 200) + ' | stderr: ' + String(r.stderr).slice(0, 200)); }
}
function writeJson(name, obj) {
  const f = path.join(FILES, name);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  return f;
}
const SEMANTIC = ['SUPPORTS', 'CONTRADICTS', 'CONVERGES', 'INFORMS', 'REJECTED_BECAUSE'];
function counts(room) {
  const db = navigation.openRoomDbReadOnlyForCaller(room);
  if (!db) throw new Error('cannot open room.db read-only for counts');
  try {
    const n = (sql) => db.prepare(sql).get().c;
    const claimRows = db.prepare("SELECT properties FROM nodes WHERE type = 'claim'").all();
    let conclusion = 0;
    for (const r of claimRows) {
      let p = {};
      try { p = JSON.parse(r.properties || '{}'); } catch (_e) { p = {}; }
      if (p && p.kind === 'conclusion') conclusion += 1;
    }
    return {
      claim: claimRows.length - conclusion,
      conclusion: conclusion,
      open_question: n("SELECT COUNT(*) AS c FROM nodes WHERE type = 'open_question'"),
      opportunity: n("SELECT COUNT(*) AS c FROM nodes WHERE type = 'opportunity'"),
      expert: n("SELECT COUNT(*) AS c FROM nodes WHERE type = 'SyntheticExpert'"),
      nodes: n('SELECT COUNT(*) AS c FROM nodes'),
      edges: n('SELECT COUNT(*) AS c FROM edges'),
      semantic: n("SELECT COUNT(*) AS c FROM edges WHERE type IN (" + SEMANTIC.map((s) => "'" + s + "'").join(',') + ')'),
      supersedes: n("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'"),
      nonProposed: n("SELECT COUNT(*) AS c FROM nodes WHERE type IN ('claim','open_question','opportunity','SyntheticExpert') AND review_status <> 'proposed'"),
    };
  } finally { navigation.closeRoomDbForCaller(db); }
}
function delta(a, b) {
  const d = {};
  for (const k of Object.keys(a)) d[k] = b[k] - a[k];
  return d;
}
const ZERO = { claim: 0, conclusion: 0, open_question: 0, opportunity: 0, expert: 0, nodes: 0, edges: 0, semantic: 0, supersedes: 0, nonProposed: 0 };
function treeHash(dir) {
  const out = {};
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile()) out[path.relative(dir, f)] = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    }
  })(dir);
  return out;
}
function diffMaps(a, b) {
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  const changed = [];
  for (const k of keys) if (a[k] !== b[k]) changed.push(k);
  return changed.sort();
}
function fileSha(f) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch (_e) { return 'absent'; }
}
const STACK_RE = /^\s+at .*(\(.*:\d+:\d+\)|:\d+:\d+)\s*$/m;
function noStack(r, what) {
  check(!STACK_RE.test(r.stdout) && !STACK_RE.test(r.stderr), what + ': a stack frame leaked into the output');
}

function payload(topic, nth, extra) {
  const base = {
    conclusion: {
      governing_thought: 'Revision ' + nth + ': the wedge is corporate wellness subsidies that lower CAC.',
      key_claims: [
        'Corporate programs subsidize the first two months.',
        'Referral loops keep paid acquisition near zero.',
        'Menu personalization cuts the churn that kills LTV.',
      ],
      topic: topic,
    },
    claims: [], knowns: [], unknowns: [], killed: [], relations: [], opportunities: [],
  };
  return Object.assign(base, extra || {});
}
function fullPayload(topic, nth) {
  return payload(topic, nth, {
    claims: [
      { text: 'Employers pay for measurable wellness outcomes.', knowledge_type: 'fact' },
      { text: 'Subsidized first months cut early churn.', knowledge_type: 'fact' },
    ],
    knowns: [{ text: 'Churn peaks in month two for meal-kit subscribers.', knowledge_type: 'fact' }],
    unknowns: ['Which employer segment adopts first?'],
    killed: [{ text: 'Direct-to-consumer paid social is the cheapest channel.', reason: 'CAC above LTV' }],
    relations: [{ source_index: 0, target_index: 1, edge_type: 'SUPPORTS', reason: 'outcomes justify the subsidy' }],
    opportunities: [{
      name: 'Corporate Wellness Subsidy Pilot',
      problem: 'Employers want measurable wellness outcomes but lack a healthy-cooking benefit.',
      funder: 'Acme Wellness Fund', program: 'Employee Nutrition Pilot', deadline: '2026-12-01', relevance_score: 0.82,
    }],
  });
}
function closeArgs(pf, surface, extra) {
  return ['close', '--room', ROOM, '--surface', surface || 'bono', '--payload', pf].concat(extra || []);
}

const T1 = 'egain-close-test-one';
const T2 = 'egain-close-test-two';
let t1PriorId = null;

// ARM A: a first close writes everything, proposed, and writes nothing else ---------------------------------
arm('A first close writes 4+1+1+1 nodes and 3 semantic edges, proposed, SUPERSEDES 0, contained', () => {
  const pf = writeJson('a.json', fullPayload(T1, 1));
  const before = counts(ROOM);
  const roomBefore = treeHash(ROOM_REAL);
  const homeBefore = treeHash(HOME);
  const r = door(closeArgs(pf, 'bono', ['--run-id', 'run-t1-a']));
  eq(r.status, 0, 'exit status (stderr: ' + String(r.stderr).slice(0, 200) + ')');
  const out = json(r);
  const after = counts(ROOM);
  const roomAfter = treeHash(ROOM_REAL);
  const homeAfter = treeHash(HOME);
  eq(delta(before, after), Object.assign({}, ZERO, { claim: 4, conclusion: 1, open_question: 1, opportunity: 1, nodes: 7, edges: 3, semantic: 3 }), 'row deltas');
  eq(out.ok, true, 'ok');
  eq(out.chain.written, false, 'chain.written');
  eq(out.chain.reason, 'no_prior', 'chain.reason');
  eq(out.room, ROOM_REAL, 'output.room');
  eq(out.surface, 'bono', 'output.surface');
  eq(out.run_id, 'run-t1-a', 'output.run_id');
  t1PriorId = out.summary.conclusion_id;
  check(typeof t1PriorId === 'string' && t1PriorId.length > 0, 'a conclusion id');
  const md = out.summary.opportunity[0].md_path;
  check(typeof md === 'string' && md.startsWith(path.join(ROOM_REAL, 'opportunity-bank') + path.sep), 'bank path under realpath(room)/opportunity-bank, got ' + md);
  const changed = diffMaps(roomBefore, roomAfter);
  const allowed = (p) => p === path.join('.mindrian', 'room.db') || p === path.join('.mindrian', 'room.db-wal')
    || p === path.join('.mindrian', 'room.db-shm') || p.startsWith('opportunity-bank' + path.sep);
  const stray = changed.filter((p) => !allowed(p));
  eq(stray, [], 'room files outside room.db and opportunity-bank that changed');
  eq(diffMaps(homeBefore, homeAfter), [], 'HOME tree changes');
});

// ARM B: a re-run over a confirmed prior writes exactly one SUPERSEDES edge ------------------------------------
arm('B re-run over a confirmed prior: one NULL SUPERSEDES edge, human attribution, version-log newest first', () => {
  const db = navigation.openRoomDbForCaller(ROOM);
  try {
    const conf = navigation.confirmNode(db, t1PriorId, 'navigator');
    eq(conf.ok, true, 'test-side human confirm');
  } finally { navigation.closeRoomDbForCaller(db); }
  const pf = writeJson('b.json', payload(T1, 2));
  const before = counts(ROOM);
  const r = door(closeArgs(pf, 'bono', ['--run-id', 'run-t1-b']));
  eq(r.status, 0, 'exit status (stderr: ' + String(r.stderr).slice(0, 200) + ')');
  const out = json(r);
  const after = counts(ROOM);
  eq(delta(before, after), Object.assign({}, ZERO, { conclusion: 1, nodes: 2, edges: 1, supersedes: 1 }), 'row deltas (one conclusion, one status_superseded memory_event, one SUPERSEDES edge)');
  eq(out.chain.written, true, 'chain.written');
  eq(out.chain.superseded_node_id, t1PriorId, 'chain.superseded_node_id');
  eq(out.prior.node_id, t1PriorId, 'prior.node_id');
  eq(out.prior.review_status, 'confirmed', 'prior.review_status');
  const db2 = navigation.openRoomDbReadOnlyForCaller(ROOM);
  try {
    const edge = db2.prepare("SELECT source, target, review_status FROM edges WHERE type = 'SUPERSEDES'").get();
    eq(edge.source, out.summary.conclusion_id, 'SUPERSEDES source is the new conclusion');
    eq(edge.target, t1PriorId, 'SUPERSEDES target is the prior conclusion');
    eq(edge.review_status, null, 'SUPERSEDES review_status');
    eq(db2.prepare('SELECT review_status FROM nodes WHERE id = ?').get(t1PriorId).review_status, 'superseded', 'prior review_status');
    // Attribution: the status_superseded memory_event stores the literal human identity in its confirmed_by payload field.
    const ev = db2.prepare("SELECT properties FROM nodes WHERE type = 'memory_event' AND properties LIKE '%status_superseded%' AND properties LIKE ?").all('%' + t1PriorId + '%');
    eq(ev.length, 1, 'status_superseded memory_event rows for the prior');
    const by = JSON.parse(ev[0].properties).confirmed_by;
    eq(by, navigation.resolveByUser(ROOM), 'memory_event confirmed_by equals resolveByUser(room)');
    check(!AGENT_IDENTITIES.has(String(by).toLowerCase()), 'confirmed_by is not an agent identity, got ' + by);
  } finally { navigation.closeRoomDbForCaller(db2); }
  // version-log: newest first, read-only.
  const dbPath = path.join(ROOM_REAL, '.mindrian', 'room.db');
  const shaBefore = [fileSha(dbPath), fileSha(dbPath + '-wal')];
  const v = door(['version-log', '--room', ROOM, '--topic', T1]);
  eq(v.status, 0, 'version-log exit status');
  const shaAfter = [fileSha(dbPath), fileSha(dbPath + '-wal')];
  eq(shaAfter, shaBefore, 'room.db and WAL sha256 across version-log');
  const lines = v.stdout.split('\n').filter((l) => /^\d+\. /.test(l));
  eq(lines.length, 2, 'numbered chain lines');
  check(/^1\. \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /.test(lines[0]) && lines[0].includes('Revision 2'), 'line 1 is the newest: ' + lines[0]);
  check(/^2\. \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /.test(lines[1]) && lines[1].includes('Revision 1'), 'line 2 is the oldest: ' + lines[1]);
  check(v.stdout.indexOf('2 conclusion(s)') !== -1, 'header names the count');
  check(!/off-chain:/.test(v.stdout), 'no off-chain line on a clean chain');
});

// ARM B2: a re-run over an UNCONFIRMED prior discloses prior_unconfirmed and chains nothing -----------------------
arm('B2 re-run over an unconfirmed prior: written, prior_unconfirmed disclosed, no chain, off-chain named', () => {
  const p1 = writeJson('b2a.json', payload(T2, 1));
  const r1 = door(closeArgs(p1, 'bono', ['--run-id', 'run-t2-a']));
  eq(r1.status, 0, 'first close exit status');
  const first = json(r1);
  const p2 = writeJson('b2b.json', payload(T2, 2));
  const before = counts(ROOM);
  const r2 = door(closeArgs(p2, 'bono', ['--run-id', 'run-t2-b']));
  eq(r2.status, 0, 'second close exit status (stderr: ' + String(r2.stderr).slice(0, 200) + ')');
  const out = json(r2);
  const after = counts(ROOM);
  eq(delta(before, after), Object.assign({}, ZERO, { conclusion: 1, nodes: 1 }), 'row deltas');
  eq(out.chain.written, false, 'chain.written');
  eq(out.chain.reason, 'prior_unconfirmed', 'chain.reason');
  eq(out.chain.prior_review_status, 'proposed', 'chain.prior_review_status');
  eq(out.chain.prior_node_id, first.summary.conclusion_id, 'chain.prior_node_id');
  const db = navigation.openRoomDbReadOnlyForCaller(ROOM);
  try {
    eq(db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(first.summary.conclusion_id).review_status, 'proposed', 'prior stays proposed');
  } finally { navigation.closeRoomDbForCaller(db); }
  const v = door(['version-log', '--room', ROOM, '--topic', T2]);
  eq(v.status, 0, 'version-log exit status');
  eq(v.stdout.split('\n').filter((l) => /^\d+\. /.test(l)).length, 1, 'numbered chain lines');
  check(v.stdout.split('\n').some((l) => l.startsWith('off-chain: 1')), 'an off-chain: 1 line, got: ' + v.stdout);
});

// ARM B3: a reused run id is refused ---------------------------------------------------------------------------
arm('B3 a close reusing the newest run id refuses run_id_reused and writes nothing', () => {
  const pf = writeJson('b3.json', payload(T2, 3));
  const before = counts(ROOM);
  const r = door(closeArgs(pf, 'bono', ['--run-id', 'run-t2-b']));
  eq(r.status, 1, 'exit status');
  const out = json(r);
  eq(out.reason, 'run_id_reused', 'reason');
  eq(delta(before, counts(ROOM)), ZERO, 'row deltas');
});

// ARM C: an invalid conclusion rolls the whole close back -------------------------------------------------------
arm('C invalid conclusion: close_failed, rolled_back, every row delta 0', () => {
  const bad = payload('egain-close-test-bad', 1, {
    claims: [{ text: 'Claim one for the bad run.' }, { text: 'Claim two for the bad run.' }],
  });
  bad.conclusion.governing_thought = 'x'.repeat(251);
  const pf = writeJson('c.json', bad);
  const before = counts(ROOM);
  const r = door(closeArgs(pf, 'bono'));
  eq(r.status, 1, 'exit status');
  const out = json(r);
  eq(out.reason, 'close_failed', 'reason');
  eq(out.rolled_back, true, 'rolled_back');
  const f = out.failures.find((x) => x.section === 'conclusion');
  check(f && f.reason === 'invalid_narrative', 'failures holds the conclusion invalid_narrative section: ' + JSON.stringify(out.failures));
  eq(delta(before, counts(ROOM)), ZERO, 'row deltas');
  check(/close-loop close: refused \(close_failed\)/.test(r.stderr), 'stderr names the refusal: ' + r.stderr);
});

// ARM C2: priorConclusionId smuggling is refused ------------------------------------------------------------------
arm('C2 a payload carrying priorConclusionId refuses prior_conclusion_id_not_allowed', () => {
  const pf = writeJson('c2.json', payload(T1, 9, { priorConclusionId: 'claim:anything' }));
  const before = counts(ROOM);
  const r = door(closeArgs(pf, 'bono'));
  eq(r.status, 1, 'exit status');
  eq(json(r).reason, 'prior_conclusion_id_not_allowed', 'reason');
  eq(delta(before, counts(ROOM)), ZERO, 'row deltas');
});

// ARM C3: malformed payloads are typed refusals with no stack ---------------------------------------------------
arm('C3 non-JSON, non-object and topic-less payloads refuse typed, no stack frames', () => {
  const before = counts(ROOM);
  const cases = [
    ['payload_not_json', writeJson('c3a.json', '{not json')],
    ['payload_not_object', writeJson('c3b.json', '[1,2,3]')],
    ['conclusion_topic_missing', writeJson('c3c.json', { conclusion: { governing_thought: 'x', key_claims: ['a', 'b', 'c'] } })],
  ];
  for (const [reason, pf] of cases) {
    const r = door(closeArgs(pf, 'bono'));
    eq(r.status, 1, reason + ' exit status');
    eq(json(r).reason, reason, 'reason');
    noStack(r, reason);
  }
  eq(delta(before, counts(ROOM)), ZERO, 'row deltas');
});

// ARM D: a SUPERSEDES relation is refused and rolled back --------------------------------------------------------
arm('D a relations entry with edge_type SUPERSEDES rolls the close back, edge_type_not_allowed', () => {
  const p = payload('egain-close-test-d', 1, {
    claims: [{ text: 'Claim one for arm D.' }, { text: 'Claim two for arm D.' }],
    relations: [{ source_index: 0, target_index: 1, edge_type: 'SUPERSEDES', reason: 'not allowed here' }],
  });
  const pf = writeJson('d.json', p);
  const before = counts(ROOM);
  const r = door(closeArgs(pf, 'bono'));
  eq(r.status, 1, 'exit status');
  const out = json(r);
  eq(out.reason, 'close_failed', 'reason');
  const f = out.failures.find((x) => x.section === 'relation[0]');
  check(f && f.reason === 'edge_type_not_allowed' && f.detail === 'SUPERSEDES', 'failures holds relation[0] edge_type_not_allowed SUPERSEDES: ' + JSON.stringify(out.failures));
  const d = delta(before, counts(ROOM));
  eq(d.nodes, 0, 'node delta');
  eq(d.supersedes, 0, 'SUPERSEDES delta');
  eq(d, ZERO, 'all deltas');
});

// ARM E: offer-experts ranks by the one shipped sum, writes nothing -------------------------------------------------
arm('E offer-experts ranks by tier/4 + survival (Black, White, Green, Red), writes nothing', () => {
  const hats = [
    { hat: 'White', name: 'Ada', surname: 'Lovelace', evidenceTier: 'Academic', survivalRate: 0.40 },
    { hat: 'Black', name: 'Boaz', surname: 'Kline', evidenceTier: 'Operational', survivalRate: 0.90 },
    { hat: 'Green', name: 'Gita', surname: 'Moreno', evidenceTier: 'Practitioner', survivalRate: 0.30 },
    { hat: 'Red', name: 'Rina', surname: 'Okafor', evidenceTier: 'None', survivalRate: 0.10 },
  ];
  const hf = writeJson('hats.json', hats);
  const cwd = mk('cwd');
  const cwdBefore = treeHash(cwd);
  const homeBefore = treeHash(HOME);
  const r = door(['offer-experts', '--hats', hf], { cwd: cwd });
  eq(r.status, 0, 'exit status');
  const out = json(r);
  eq(out.ok, true, 'ok');
  eq(out.count, 4, 'count');
  eq(out.candidates.map((c) => c.hat), ['Black', 'White', 'Green', 'Red'], 'order');
  check(out.candidates[0].hat !== 'White', 'not the tier-first order');
  eq(out.candidates.map((c) => c.contributionRank.toFixed(2)), ['1.65', '1.40', '0.80', '0.35'], 'contributionRank');
  eq(treeHash(cwd), cwdBefore, 'cwd tree');
  eq(treeHash(HOME), homeBefore, 'HOME tree');
  const bad = door(['offer-experts', '--hats', writeJson('hats-bad.json', { hat: 'White' })]);
  eq(bad.status, 1, 'non-array exit status');
  eq(json(bad).reason, 'hats_not_array', 'reason');
});

// ARM F: file-expert files one proposed node, refuses forbidden keys -------------------------------------------------
arm('F file-expert writes one proposed SyntheticExpert, UPSERTs, refuses ventureNotes by name', () => {
  const spec = { hat: 'Black', name: 'Boaz', surname: 'Kline', archetype: 'The skeptical operator', evidenceTier: 'Operational' };
  const sf = writeJson('spec.json', spec);
  const before = counts(ROOM);
  const r = door(['file-expert', '--room', ROOM, '--spec', sf, '--session-id', 's-0hl']);
  eq(r.status, 0, 'exit status (stderr: ' + String(r.stderr).slice(0, 200) + ')');
  const out = json(r);
  const mid = counts(ROOM);
  eq(mid.expert - before.expert, 1, 'SyntheticExpert delta');
  eq(out.node_id, SYNTHETIC_EXPERT_NODE_ID('s-0hl', 'Black', 'Kline'), 'node id');
  eq(out.review_status, 'proposed', 'review_status');
  eq(out.hat, 'Black', 'hat');
  eq(out.session_id, 's-0hl', 'session_id');
  const r2 = door(['file-expert', '--room', ROOM, '--spec', sf, '--session-id', 's-0hl']);
  eq(r2.status, 0, 'repeat exit status');
  eq(counts(ROOM).expert, mid.expert, 'UPSERT leaves the count unchanged');
  const bad = door(['file-expert', '--room', ROOM, '--spec', writeJson('spec-bad.json', Object.assign({ ventureNotes: 'secret venture text' }, spec)), '--session-id', 's-0hl']);
  eq(bad.status, 1, 'forbidden exit status');
  const bo = json(bad);
  eq(bo.reason, 'forbidden_field', 'reason');
  eq(bo.key, 'ventureNotes', 'key');
  check(bad.stderr.includes('ventureNotes'), 'stderr names ventureNotes: ' + bad.stderr);
  eq(counts(ROOM).expert, mid.expert, 'count after the refusal');
});

// ARM G: source guards ----------------------------------------------------------------------------------------------
arm('G source: no dashes, no room-db or sqlite or network, one writeCloseLoop call, no confirm or promote', () => {
  const src = fs.readFileSync(DOOR, 'utf8');
  const tst = fs.readFileSync(__filename, 'utf8');
  eq(src.split(EM).length - 1, 0, 'U+2014 in the script');
  eq(src.split(EN).length - 1, 0, 'U+2013 in the script');
  eq(tst.split(EM).length - 1, 0, 'U+2014 in the test');
  eq(tst.split(EN).length - 1, 0, 'U+2013 in the test');
  check(!/room-db\.cjs|node:sqlite|better-sqlite3/.test(src), 'the script must not require room-db.cjs, node:sqlite or better-sqlite3');
  const code = src.split('\n').filter((l) => { const t = l.trim(); return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')); }).join('\n');
  check(!/fetch\(|require\(['"](node:)?(https?|net)['"]\)|undici|brain-client/.test(code), 'no network surface on a code line');
  check(!/confirmNode\(|promoteNodeStatus\(/.test(code), 'no confirmNode( or promoteNodeStatus( on a code line');
  eq((code.match(/writeCloseLoop\(/g) || []).length, 1, 'writeCloseLoop( call sites');
  for (const name of ['withRoomTx', 'openRoomDbForCaller', 'openRoomDbReadOnlyForCaller', 'resolveByUser']) {
    check(src.includes(name), 'the source names ' + name);
  }
});

// ARM R: room resolution ----------------------------------------------------------------------------------------------
arm('R room resolution: missing path, no room.db (nothing created), symlink resolves to realpath', () => {
  const pf = writeJson('r.json', payload('egain-close-test-r', 1));
  const missing = door(['version-log', '--room', path.join(FILES, 'no-such-room'), '--topic', 'x']);
  eq(missing.status, 1, 'missing exit status');
  eq(json(missing).reason, 'room_not_found', 'missing reason');
  const empty = mk('emptyroom');
  const noDb = door(closeArgs(pf, 'bono').map((a) => (a === ROOM ? empty : a)));
  eq(noDb.status, 1, 'no room.db exit status');
  eq(json(noDb).reason, 'room_db_missing', 'no room.db reason');
  check(!fs.existsSync(path.join(empty, '.mindrian')), 'the refused dir still has no .mindrian');
  const link = path.join(mk('link'), 'room-link');
  try { fs.symlinkSync(ROOM, link, 'dir'); } catch (_e) { return 'SKIP'; }
  const r = door(['close', '--room', link, '--surface', 'bono', '--payload', pf, '--run-id', 'run-r-link']);
  eq(r.status, 0, 'symlink close exit status (stderr: ' + String(r.stderr).slice(0, 200) + ')');
  eq(json(r).room, fs.realpathSync(ROOM), 'output.room is the realpath');
});

// ARM U: usage ------------------------------------------------------------------------------------------------------------
arm('U usage: no subcommand 2, unknown subcommand 2, missing --payload 2 naming it, --help 0', () => {
  eq(door([]).status, 2, 'no subcommand');
  eq(door(['frobnicate']).status, 2, 'unknown subcommand');
  const np = door(['close', '--room', ROOM, '--surface', 'bono']);
  eq(np.status, 2, 'missing --payload');
  check(np.stderr.includes('--payload'), 'stderr names --payload: ' + np.stderr);
  eq(door(['--help']).status, 0, '--help');
});

console.log('test-261006-0hl-close-loop-cli: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
