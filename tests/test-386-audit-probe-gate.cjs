#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 40 (E-PROBE): the audit probe regression gate.
 *
 * Re-runs the second audit's 694 probe cases (tests/fixtures/386-audit-probes)
 * against the live Part 8 egress guard after plans 386-28 (job-key shortcut),
 * 386-31 (key shapes) and 386-33 (context-based sprout design), and pins what
 * each fix must change. The before state is baseline-before.json (guard commit
 * f0df97036). Pinned lists live in expectations.json.
 *
 * Owner principle for Part 8 (2026-11-06): a keyword sprout may leave the room,
 * a body may not, credentials never leave, and the guard must not cripple
 * contextualised work. A body, an edge that fails a prose rule and a short
 * private claim are answered with the class sprouts_required (never silent,
 * never sent).
 *
 * Arms: PG0, PG28, PG31, PG33, PG33N, PG33I, PG33C, PG33S, PG33R, PG33U, PGM,
 * and the mutation controls PGX1 (checker of PG33C) and PGX2 (checker of
 * PG33S).
 *
 * Replay control:
 *   node tests/test-386-audit-probe-gate.cjs --replay <baseline-before.json>
 * uses the rows of that file instead of the live guard and does not apply the
 * decision skip. PG28, PG31, PG33, PG33C and PG33S must FAIL there, which proves
 * the arms detect the old behavior.
 *
 * Part 8: fixture rooms only, fake secrets built at run time (never stored), a
 * temporary HOME, no network (a counter stub), no real room. A product file is
 * not touched. Node built-ins, the loader and the shape helper only.
 *
 * Output lines: "ok - <arm>", "FAIL - <arm>", "SKIP - <arm>" (a SKIP does not
 * count as a failure). Exit 1 on any FAIL. No em dash, no en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const replayAt = argv.indexOf('--replay');
const REPLAY = replayAt >= 0;
const REPLAY_FILE = REPLAY ? path.resolve(argv[replayAt + 1] || '') : null;

// ---------------------------------------------------------------------------
// Isolation: a temporary HOME before the guard is required, no network.
// ---------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-40-'));
const HOME_DIR = path.join(TMP, 'home');
fs.mkdirSync(HOME_DIR, { recursive: true });
fs.mkdirSync(path.join(TMP, 'registry'), { recursive: true });
process.env.HOME = HOME_DIR;
process.env.USERPROFILE = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.TAVILY_API_KEY;
delete process.env.OPENALEX_API_KEY;
process.env.MINDRIAN_BRAIN_URL = 'http://brain-stub.invalid';
process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real-386-40';
process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

const loader = require('./helpers/audit-probe-loader.cjs');
const shapeMod = require('../lib/core/part8-sprout-shape.cjs');
const SPLIT = require('../lib/core/part8-split-route.cjs');
const net = loader.blockNetwork();

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
const FIXDIR = loader.FIXTURE_DIR;
const EXP = JSON.parse(fs.readFileSync(path.join(FIXDIR, 'expectations.json'), 'utf8'));
const BASELINE = JSON.parse(fs.readFileSync(path.join(FIXDIR, 'baseline-before.json'), 'utf8'));
const PROBES = loader.loadProbes();

// ---------------------------------------------------------------------------
// The plan 386-32 RCA: the owner decision and the owner acknowledgement.
// ---------------------------------------------------------------------------
const RCA_NAME = 'part8-over-blocks-ordinary-theo-and-context-questions.md';
function readRca() {
  const cands = [
    path.join(REPO, '.planning', 'debug', RCA_NAME),
    path.join(REPO, '.planning', 'debug', 'resolved', RCA_NAME),
  ];
  for (let i = 0; i < cands.length; i++) {
    if (fs.existsSync(cands[i])) return fs.readFileSync(cands[i], 'utf8');
  }
  return null;
}
const RCA = readRca();
function rcaLine(name) {
  if (RCA === null) return null;
  const m = RCA.match(new RegExp('^' + name + ':[ \\t]*(.*)$', 'm'));
  return m ? m[1].trim() : null;
}
function rcaIds(name) {
  const v = rcaLine(name);
  if (!v) return [];
  return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}
const DECISION = rcaLine('decision');
function decisionSkipReason() {
  if (REPLAY) return null;
  if (RCA === null) return 'the plan 386-32 RCA file is missing';
  if (DECISION === null) return 'the decision line of the plan 386-32 RCA is missing';
  if (DECISION !== 'option-e') return 'the decision is ' + DECISION + ', not option-e';
  return null;
}

// ---------------------------------------------------------------------------
// Rows: live guard or the replay file.
// ---------------------------------------------------------------------------
function textOfCase(key) {
  const p = PROBES.p.find(function (c) { return c.key === key; });
  if (p) return p.payload.question || p.payload.query || p.payload.cypher || '';
  const a = PROBES.adv.find(function (c) { return c.key === key; });
  if (a) return a.text;
  const c = PROBES.corpora.find(function (x) { return x.key === key; });
  return c ? c.q : '';
}
const TEXT = {};
PROBES.p.concat(PROBES.adv, PROBES.corpora).forEach(function (c) { TEXT[c.key] = textOfCase(c.key); });

let guard = null;
let lexMod = null;
let rooms = null;
let ROWS;
if (REPLAY) {
  ROWS = JSON.parse(fs.readFileSync(REPLAY_FILE, 'utf8')).rows;
} else {
  guard = require('../lib/core/part8-egress-guard.cjs');
  lexMod = require('../lib/core/part8-room-lexicon.cjs');
  rooms = loader.makeRooms(path.join(TMP, 'rooms'), REPO);
  ROWS = loader.classifyAll({ classify: guard.classify, roomFor: rooms.roomFor, reset: lexMod._resetLexiconCache });
}
const NOW = new Map(ROWS.map(function (r) { return [r.key, r]; }));
const BEFORE = new Map(BASELINE.rows.map(function (r) { return [r.key, r]; }));

function pairOf(r) { return r.class + '/' + (r.token_class === null || r.token_class === undefined ? 'null' : r.token_class); }
function tag(r) { return r ? r.verdict + ' ' + pairOf(r) : 'missing'; }
function shapeOf(text) { return shapeMod.classifyShape(text); }

// ---------------------------------------------------------------------------
// Pure checkers (the mutation controls feed them fake rows).
// ---------------------------------------------------------------------------

// PG33C: the outcome contract. rec = { key, verdict, class, token_class, text,
// baseline_verdict }. A record that was block before and is not allow now must
// hold one of the pinned (class, token class) pairs. Returns failure strings.
function checkOutcomeContract(recs, exp) {
  const fails = [];
  const sr = exp.allowed_refusal_classes.sprouts_required;
  const lexKinds = exp.allowed_refusal_classes.room_content;
  const writeClasses = exp.allowed_refusal_classes.write_classes;
  const idPairs = exp.identifier_classes;
  recs.forEach(function (r) {
    if (r.baseline_verdict !== 'block' || r.verdict === 'allow') return;
    const tc = r.token_class === null || r.token_class === undefined ? null : r.token_class;
    let ok = false;
    if (r.verdict !== 'block') {
      ok = false; // ambiguous is not an outcome
    } else if (exp.write_cases.indexOf(r.key) !== -1) {
      ok = writeClasses.indexOf(r.class) !== -1;
    } else if (r.class === 'sprouts_required') {
      ok = tc !== null && sr.indexOf(tc) !== -1;
    } else if (r.class === 'content_set') {
      // credential, email, phone-like, SSN-like and name plus degree: pinned per case.
      ok = tc === null && exp.content_set_cases.indexOf(r.key) !== -1;
    } else if (r.class === 'room_content') {
      if (tc === 'identifier') {
        ok = Object.keys(idPairs).some(function (t) {
          return idPairs[t].class === 'room_content' && idPairs[t].token_class === 'identifier' && idPairs[t].cases.indexOf(r.key) !== -1;
        });
      }
      else ok = tc !== null && lexKinds.indexOf(tc) !== -1;
    }
    if (!ok) fails.push(r.key + ' ' + r.verdict + ' ' + r.class + '/' + tc + (r.text ? ' (' + shapeOf(r.text).kind + ')' : ''));
  });
  return fails;
}

// PG33S: the surface outcome. res = { kind: 'call', result, wire } or
// { kind: 'hook', status, stderr }. input is the text sent. Returns failures.
function checkSurfaceOutcome(res, input) {
  const fails = [];
  const windows = [];
  const words = String(input).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (let i = 0; i + 3 <= words.length; i++) windows.push(words.slice(i, i + 3).join(' '));
  function noEcho(blob, label) {
    const low = String(blob).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
    windows.forEach(function (w) { if (low.indexOf(w) !== -1) fails.push(label + ' echoes input words: ' + w); });
  }
  if (res.kind === 'call') {
    const r = res.result || {};
    if (r.error !== 'egress_blocked') fails.push('call: error is ' + r.error + ', expected egress_blocked');
    if (r.egress_class !== SPLIT.SPROUTS_REQUIRED) fails.push('call: egress_class is ' + r.egress_class + ', expected sprouts_required');
    if (r.route !== SPLIT.ROUTE) fails.push('call: route is ' + r.route + ', expected ' + SPLIT.ROUTE);
    if (!Array.isArray(r.split_guide) || r.split_guide.length !== 5) fails.push('call: split_guide does not hold 5 lines');
    else if (JSON.stringify(r.split_guide) !== JSON.stringify(SPLIT.SPLIT_GUIDE)) fails.push('call: split_guide differs from the module guide');
    if (res.wire !== undefined && res.wire !== 0) fails.push('call: ' + res.wire + ' network attempts, expected 0');
    noEcho(JSON.stringify(r), 'call result');
  } else if (res.kind === 'hook') {
    if (res.status !== 2) fails.push('hook: exit ' + res.status + ', expected 2');
    if (String(res.stderr).indexOf(SPLIT.refusalMessage()) === -1) fails.push('hook: stderr lacks the split guide message');
    noEcho(res.stderr, 'hook stderr');
  } else {
    fails.push('unknown surface kind');
  }
  return fails;
}

// ---------------------------------------------------------------------------
// Arms.
// ---------------------------------------------------------------------------
const out = [];
let failed = 0;
function emit(line) { out.push(line); process.stdout.write(line + '\n'); }
function ok(label, extra) { emit('ok - ' + label + (extra ? ' ' + extra : '')); }
function fail(label, why) { failed += 1; emit('FAIL - ' + label + ' ' + why); }
function skip(label, why) { emit('SKIP - ' + label + ' (' + why + ')'); }

const arms = [];
function arm(label, fn) { arms.push({ label: label, fn: fn }); }
// An arm body returns undefined (ok), { fails: [...] } (FAIL) or { skip: why }.

function liveClassify(text, opts) {
  return guard.classify({ question: text }, Object.assign({ toolName: 'brain_ask', roomDir: null }, opts || {}));
}

arm('PG0', async function () {
  const fails = [];
  const c = loader.countRows(BASELINE.rows);
  if (BASELINE.rows.length !== 694) fails.push('baseline holds ' + BASELINE.rows.length + ' rows, expected 694');
  if (PROBES.p.length !== 15 || PROBES.adv.length !== 23 || PROBES.corpora.length !== 656) fails.push('fixture counts differ from the README (15, 23, 656)');
  if (c.by_verdict.allow !== 587 || c.by_verdict.ambiguous !== 1 || c.by_verdict.block !== 106) fails.push('baseline verdict counts differ: ' + JSON.stringify(c.by_verdict));
  if (BASELINE.guard_head !== 'f0df97036') fails.push('baseline guard_head is ' + BASELINE.guard_head);
  if (BASELINE.network_calls !== 0) fails.push('baseline network_calls is ' + BASELINE.network_calls);
  const keys = new Set(PROBES.p.concat(PROBES.adv, PROBES.corpora).map(function (x) { return x.key; }));
  BASELINE.rows.forEach(function (r) { if (!keys.has(r.key)) fails.push('baseline key not in the fixtures: ' + r.key); });
  if (NOW.size !== 694) fails.push('the rows under test hold ' + NOW.size + ' keys, expected 694');
  // The pinned 37 are exactly the extended rows that are block in the baseline.
  const blockedExt = BASELINE.rows.filter(function (r) { return r.group === 'extended' && r.verdict === 'block'; }).map(function (r) { return r.key; }).sort();
  if (JSON.stringify(blockedExt) !== JSON.stringify(EXP.over_blocked_37.slice().sort())) fails.push('over_blocked_37 differs from the baseline extended blocks');
  if (EXP.over_blocked_37.length !== 37) fails.push('over_blocked_37 holds ' + EXP.over_blocked_37.length + ' keys');
  if (EXP.stays_split_edges.some(function (k) { return EXP.over_blocked_37.indexOf(k) === -1; })) fails.push('stays_split_edges holds a key outside over_blocked_37');
  // The structured identifier list equals the union of the per-type cases.
  Object.keys(EXP.identifier_classes).forEach(function (t) {
    EXP.identifier_classes[t].cases.forEach(function (k) {
      if (EXP.structured_identifier_cases.indexOf(k) === -1 && t !== 'name_degree') fails.push('identifier case not listed: ' + k);
      if (EXP.identifier_classes[t].class === 'content_set' && EXP.content_set_cases.indexOf(k) === -1) fails.push('content_set case not pinned: ' + k);
    });
  });
  return fails.length ? { fails: fails } : undefined;
});

arm('PG28', async function () {
  const fails = [];
  EXP.job_key_cases.forEach(function (k) {
    const r = NOW.get(k);
    if (!r || r.verdict !== 'block') fails.push(k + ' is ' + tag(r) + ', expected block');
    else if (r.class === 'move_set') fails.push(k + ' is block but still class move_set');
  });
  const ctl = NOW.get(EXP.job_key_control);
  if (!ctl || ctl.verdict !== 'block') fails.push(EXP.job_key_control + ' (control) is ' + tag(ctl) + ', expected block');
  return fails.length ? { fails: fails } : undefined;
});

arm('PG31', async function () {
  const fails = [];
  EXP.credential_cases.forEach(function (k) {
    const r = NOW.get(k);
    if (!r || r.verdict !== 'block') fails.push(k + ' is ' + tag(r) + ', expected block');
  });
  if (REPLAY) {
    emit('SKIP - PG31 causal check (needs a live call; replay)');
  } else {
    Object.keys(EXP.credential_strip_control).forEach(function (k) {
      const v = liveClassify(EXP.credential_strip_control[k]);
      if (v.verdict !== 'allow') fails.push(k + ' with the key removed is ' + v.verdict + '/' + v.class + ', expected allow (the key must be the cause)');
    });
  }
  return fails.length ? { fails: fails } : undefined;
});

// PG33 is also the decision-gated list check.
arm('PG33', async function () {
  const why = decisionSkipReason();
  if (why) return { skip: why };
  const fails = [];
  const sr = [];
  EXP.over_blocked_37.forEach(function (k) {
    const r = NOW.get(k);
    const text = TEXT[k];
    const sh = shapeOf(text);
    const split = EXP.stays_split_edges.indexOf(k) !== -1;
    if (!r) { fails.push(k + ' missing'); return; }
    if (sh.kind === 'sprout') {
      if (r.verdict !== 'allow') fails.push(k + ' is a sprout (' + sh.words + ' words) and is ' + tag(r) + ', expected allow');
      if (split) fails.push(k + ' is listed in stays_split_edges but is a sprout by shape');
    } else if (r.verdict === 'allow') {
      emit('IMPROVED - PG33 ' + k + ' is ' + sh.kind + ' (' + sh.words + ' words) and is allow');
    } else if (r.class === 'sprouts_required' && r.verdict === 'block') {
      sr.push(k);
      emit('  sprouts_required - ' + k + ' class=' + r.class + '/' + r.token_class + ' words=' + sh.words + ' shape=' + sh.kind);
      if (!split) fails.push(k + ' is answered sprouts_required but is not listed in stays_split_edges');
    } else {
      fails.push(k + ' is ' + sh.kind + ' and is ' + tag(r) + ', expected allow or block sprouts_required (a plain block class on an edge is a failure)');
    }
  });
  EXP.named_generic.forEach(function (k) {
    const r = NOW.get(k);
    if (!r || r.verdict !== 'allow') fails.push(k + ' is ' + tag(r) + ', expected allow');
  });
  const listedNotSplit = EXP.stays_split_edges.filter(function (k) { return sr.indexOf(k) === -1; });
  listedNotSplit.forEach(function (k) {
    const r = NOW.get(k);
    if (r && r.verdict !== 'allow') fails.push(k + ' is listed in stays_split_edges but is ' + tag(r));
  });
  emit('  PG33 summary - ' + EXP.over_blocked_37.length + ' questions, ' + sr.length + ' answered sprouts_required (' + sr.join(' ') + ')');
  return fails.length ? { fails: fails } : undefined;
});

arm('PG33N', async function () {
  const groups = ['positives_26', 'compliant', '354-generic', 'extended'];
  const fails = [];
  BASELINE.rows.forEach(function (b) {
    if (groups.indexOf(b.group) === -1 || b.verdict !== 'allow') return;
    const r = NOW.get(b.key);
    if (!r || r.verdict !== 'allow') fails.push(b.key + ' was allow and is ' + tag(r));
  });
  return fails.length ? { fails: fails } : undefined;
});

arm('PG33I', async function () {
  const fails = [];
  const types = EXP.identifier_classes;
  Object.keys(types).forEach(function (t) {
    const spec = types[t];
    if (REPLAY && spec.live_only) { emit('SKIP - PG33I ' + t + ' (needs a live call; replay)'); return; }
    spec.cases.forEach(function (k) {
      const r = NOW.get(k);
      if (!r) { fails.push(t + ' ' + k + ' missing'); return; }
      if (r.verdict !== 'block') fails.push(t + ' ' + k + ' is ' + tag(r) + ', expected block');
      else if (r.class === 'sprouts_required') fails.push(t + ' ' + k + ' is sprouts_required, an identifier must block with its own class');
      else if (r.class !== spec.class || (r.token_class === null ? null : r.token_class) !== spec.token_class) fails.push(t + ' ' + k + ' is ' + pairOf(r) + ', pinned ' + spec.class + '/' + spec.token_class);
    });
  });
  if (!REPLAY) {
    // The SSN-like type is built at run time. Never stored.
    const ssn = ['123', '45', '6789'].join('-');
    const v = liveClassify('which framework fits ' + ssn);
    const spec = types.ssn_like;
    if (v.verdict !== 'block' || v.class !== spec.class || (v.token_class === null || v.token_class === undefined ? null : v.token_class) !== spec.token_class) {
      fails.push('ssn_like (run time) is ' + v.verdict + ' ' + pairOf(v) + ', pinned ' + spec.class + '/' + spec.token_class);
    }
    emit('  PG33I live pairs - credential ' + pairOf(NOW.get('ADV:secret_fake_credential')) + ', email ' + pairOf(NOW.get('ADV:email_plain')) +
      ', phone_like ' + pairOf(NOW.get('ADV:phone_us')) + ', ssn_like ' + pairOf(v) + ', name_degree ' + pairOf(NOW.get('C:plurai:21')) +
      ', artifact_id ' + pairOf(NOW.get('C:negatives:X6')));
  }
  return fails.length ? { fails: fails } : undefined;
});

function outcomeRecords() {
  return BASELINE.rows.map(function (b) {
    const r = NOW.get(b.key);
    return { key: b.key, verdict: r.verdict, class: r.class, token_class: r.token_class, text: TEXT[b.key], baseline_verdict: b.verdict };
  });
}

arm('PG33C', async function () {
  const why = decisionSkipReason();
  if (why) return { skip: why };
  const fails = checkOutcomeContract(outcomeRecords(), EXP);
  return fails.length ? { fails: fails } : undefined;
});

// A call result needs the brain client; the hook needs a child process.
const PLUGIN_TOOL = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const BODY = 'The pilot ran for three weeks. The team liked the interface a lot. The next step is a wider trial with more users.';
const SURFACE_CASES = [
  { label: 'body', text: BODY },
  { label: 'edge (C:extended:C18)', text: TEXT['C:extended:C18'] },
  { label: 'private-marker sprout (P:P12)', text: TEXT['P:P12'] },
];

function runHook(text) {
  const env = Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  const stdin = JSON.stringify({ tool_name: PLUGIN_TOOL, tool_input: { question: text }, session_id: 's386-40' });
  const res = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'part8-egress-guard-hook.cjs')], { input: stdin, env: env, encoding: 'utf8' });
  return { kind: 'hook', status: res.status, stderr: res.stderr || '' };
}

arm('PG33S', async function () {
  const fails = [];
  if (REPLAY) {
    // The recorded old surface answer: the plain block of the baseline commit.
    checkSurfaceOutcome({ kind: 'call', result: EXP.old_surface_sentinel_example, wire: 0 }, 'recorded old sentinel input').forEach(function (f) { fails.push('old sentinel: ' + f); });
    return fails.length ? { fails: fails } : undefined;
  }
  delete require.cache[require.resolve('../lib/core/brain-client.cjs')];
  const bc = require('../lib/core/brain-client.cjs');
  for (let i = 0; i < SURFACE_CASES.length; i++) {
    const sc = SURFACE_CASES[i];
    const before = net.count();
    const result = await bc.callTool('brain_ask', { question: sc.text });
    const wire = net.count() - before;
    checkSurfaceOutcome({ kind: 'call', result: result, wire: wire }, sc.text).forEach(function (f) { fails.push(sc.label + ' ' + f); });
    checkSurfaceOutcome(runHook(sc.text), sc.text).forEach(function (f) { fails.push(sc.label + ' ' + f); });
  }
  return fails.length ? { fails: fails } : undefined;
});

arm('PG33R', async function () {
  const why = decisionSkipReason();
  if (why) return { skip: why };
  const fails = [];
  const groups = ['negatives', '354-private', 'violation'];
  if (rcaLine('owner_ack') !== 'yes') fails.push('the plan 386-32 RCA has no line owner_ack: yes');
  const ackIds = rcaIds('owner_ack_ids').map(function (x) { return /^X\d+$/.test(x) ? 'C:negatives:' + x : x; });
  const ackProbe = rcaIds('owner_ack_probe_ids');
  const ack = ackIds.concat(ackProbe);
  const released = [];
  BASELINE.rows.forEach(function (b) {
    if (groups.indexOf(b.group) === -1 || b.verdict !== 'block') return;
    const r = NOW.get(b.key);
    if (r && r.verdict === 'allow') released.push(b.key);
  });
  released.forEach(function (k) {
    if (ack.indexOf(k) === -1) fails.push(k + ' leaves the room as written and the owner did not acknowledge it (NEW ACK NEEDED)');
  });
  emit('  PG33R released as written - ' + (released.length ? released.join(' ') : 'none'));
  if (!REPLAY) {
    if (JSON.stringify(released.slice().sort()) !== JSON.stringify(EXP.released_plain_sprouts.slice().sort())) {
      fails.push('measured released set ' + JSON.stringify(released) + ' differs from expectations released_plain_sprouts ' + JSON.stringify(EXP.released_plain_sprouts));
    }
    EXP.negatives_sprout_split_ids.concat(EXP.split_probe_ids).forEach(function (k) {
      const r = NOW.get(k);
      if (!r || r.verdict !== 'block' || r.class !== 'sprouts_required') fails.push(k + ' must be sprouts_required, is ' + tag(r));
    });
    const rcaSplit = rcaIds('split_probe_ids');
    if (JSON.stringify(rcaSplit.slice().sort()) !== JSON.stringify(EXP.split_probe_ids.slice().sort())) fails.push('split_probe_ids differs from the plan 386-32 RCA');
  } else {
    emit('SKIP - PG33R split-case check (needs the live guard; replay)');
  }
  return fails.length ? { fails: fails } : undefined;
});

arm('PG33U', async function () {
  if (REPLAY) return { skip: 'replay: needs a live call' };
  const why = decisionSkipReason();
  if (why) return { skip: why };
  if (IS_ROOT) return { skip: 'running as root: chmod 000 does not stop root' };
  if (rcaLine('owner_ack_unreadable_db_lexicon') !== 'yes') return { fails: ['the plan 386-32 RCA has no line owner_ack_unreadable_db_lexicon: yes'] };
  const fails = [];
  const dir = path.join(TMP, 'unreadable-room');
  require('./helpers/synthetic-room-db.cjs').buildRoom(dir, 'gate-lexgen');
  const dbFile = path.join(dir, '.mindrian', 'room.db');
  const mode = fs.statSync(dbFile).mode & 0o777;
  lexMod._resetLexiconCache();
  fs.chmodSync(dbFile, 0);
  let skipped = 0;
  let unavailable = 0;
  let credBlocked = false;
  let lexProbe = null;
  try {
    PROBES.corpora.filter(function (c) { return c.group === 'extended'; }).forEach(function (c) {
      const sh = shapeOf(c.q);
      const v = guard.classify({ question: c.q }, { toolName: 'brain_ask', roomDir: dir });
      if (sh.kind === 'sprout') {
        if (v.verdict === 'allow' && v.class === 'room_check_skipped') skipped += 1;
        else fails.push(c.key + ' sprout is ' + tag(v) + ', expected allow room_check_skipped');
      } else if (v.verdict === 'block' && v.class === 'sprouts_required' && v.token_class === 'room_check_unavailable') {
        unavailable += 1;
      } else {
        fails.push(c.key + ' ' + sh.kind + ' is ' + tag(v) + ', expected block sprouts_required/room_check_unavailable');
      }
    });
    const key = ['sk-', 'ant-', 'api03-AbCdEf0123456789AbCdEf0123456789'].join('');
    const sprouts = PROBES.corpora.filter(function (c) { return c.group === 'extended' && shapeOf(c.q).kind === 'sprout'; }).slice(0, 5).map(function (c) { return c.q; });
    const joined = sprouts.join(' ') + ' ' + key;
    const cv = guard.classify({ question: joined }, { toolName: 'brain_ask', roomDir: dir });
    credBlocked = cv.verdict === 'block';
    if (!credBlocked) fails.push('5 sprouts joined with a fake credential are ' + tag(cv) + ', expected block');
    lexProbe = guard.classify({ question: EXP.unreadable_db_lexicon_probe }, { toolName: 'brain_ask', roomDir: dir });
    if (lexProbe.verdict !== 'allow' || lexProbe.class !== 'room_check_skipped') fails.push('the sprout with a fixture lexicon word is ' + tag(lexProbe) + ', expected allow room_check_skipped (the acknowledged exposure)');
  } finally {
    try { fs.chmodSync(dbFile, mode); } catch (_e) { /* best effort */ }
    lexMod._resetLexiconCache();
  }
  emit('  PG33U counts - sprouts allow room_check_skipped ' + skipped + ', edges and bodies sprouts_required/room_check_unavailable ' + unavailable +
    ', credential joined ' + (credBlocked ? 'block' : 'NOT blocked') + ', lexicon sprout ' + (lexProbe ? tag(lexProbe) : 'n/a') + ' (acknowledged exposure)');
  return fails.length ? { fails: fails } : undefined;
});

arm('PGX1', async function () {
  const fails = [];
  const edgeText = 'how should the Thessaly Gripper team plan the pilot with Harbor Quill Partners after the Tuesday kickoff';
  const bodyText = BODY;
  const mk = function (key, text, cls, tok) { return [{ key: key, verdict: 'block', class: cls, token_class: tok, text: text, baseline_verdict: 'block' }]; };
  // Control: a legitimate pair is accepted.
  if (checkOutcomeContract(mk('MUT:ok', edgeText, 'sprouts_required', 'edge_rule'), EXP).length !== 0) fails.push('the checker rejects a legitimate sprouts_required edge');
  if (checkOutcomeContract(mk('MUT:lex', edgeText, 'room_content', 'room_term'), EXP).length !== 0) fails.push('the checker rejects a legitimate room_content/room_term');
  // Mutations: each must be reported.
  const muts = [
    ['edge with plain room_content/null', mk('MUT:e1', edgeText, 'room_content', null)],
    ['edge with room_content/private_context', mk('MUT:e2', edgeText, 'room_content', 'private_context')],
    ['edge with room_content/name', mk('MUT:e3', edgeText, 'room_content', 'name')],
    ['body with content_set', mk('MUT:b1', bodyText, 'content_set', null)],
    ['edge with content_set', mk('MUT:e4', edgeText, 'content_set', null)],
    ['body with sprouts_required and no token class', mk('MUT:b2', bodyText, 'sprouts_required', null)],
    ['edge that stayed ambiguous', [{ key: 'MUT:a', verdict: 'ambiguous', class: 'unknown', token_class: null, text: edgeText, baseline_verdict: 'block' }]],
  ];
  muts.forEach(function (m) {
    if (checkOutcomeContract(m[1], EXP).length === 0) fails.push('the checker missed: ' + m[0]);
  });
  return fails.length ? { fails: fails } : undefined;
});

arm('PGX2', async function () {
  const fails = [];
  const old = Object.assign({}, EXP.old_surface_sentinel_example);
  if (checkSurfaceOutcome({ kind: 'call', result: old, wire: 0 }, 'recorded old sentinel input').length === 0) fails.push('the checker missed the old plain block (no split_guide)');
  const partial = { error: 'egress_blocked', egress_class: 'sprouts_required', route: SPLIT.ROUTE, split_guide: SPLIT.SPLIT_GUIDE.slice(0, 3) };
  if (checkSurfaceOutcome({ kind: 'call', result: partial, wire: 0 }, 'x y z').length === 0) fails.push('the checker missed a 3 line split_guide');
  const good = SPLIT.sproutsRequiredResult('brain_ask');
  if (checkSurfaceOutcome({ kind: 'call', result: good, wire: 0 }, 'swot analysis for pricing').length !== 0) fails.push('the checker rejects the real sentinel');
  const echo = Object.assign({}, good, { message: good.message + ' pilot ran for' });
  if (checkSurfaceOutcome({ kind: 'call', result: echo, wire: 0 }, 'The pilot ran for three weeks').length === 0) fails.push('the checker missed an echoed input');
  if (checkSurfaceOutcome({ kind: 'hook', status: 0, stderr: '' }, 'a b c').length === 0) fails.push('the checker missed a hook that exits 0');
  return fails.length ? { fails: fails } : undefined;
});

arm('PGM', async function () {
  const before = loader.countRows(BASELINE.rows);
  const after = loader.countRows(ROWS);
  function line(name, b, a) {
    emit('  PGM ' + name + ' before allow=' + b.allow + ' ambiguous=' + b.ambiguous + ' block=' + b.block +
      ' | after allow=' + a.allow + ' ambiguous=' + a.ambiguous + ' block=' + a.block);
  }
  line('ALL', before.by_verdict, after.by_verdict);
  Object.keys(before.by_set).forEach(function (s) { line('set ' + s, before.by_set[s], after.by_set[s]); });
  Object.keys(before.by_group).forEach(function (g) { line('group ' + g, before.by_group[g], after.by_group[g]); });
  let n = 0;
  BASELINE.rows.forEach(function (b) {
    const r = NOW.get(b.key);
    if (r && r.verdict !== b.verdict) {
      n += 1;
      emit('  PGM changed ' + b.key + ' ' + b.verdict + ' > ' + r.verdict + ' ' + pairOf(r));
    }
  });
  emit('  PGM verdict changes ' + n + ', network attempts ' + net.count());
  return undefined;
});

(async function main() {
  emit('# probe gate ' + (REPLAY ? 'REPLAY of ' + path.basename(REPLAY_FILE) : 'LIVE') + ', decision ' + (DECISION || 'none') + ', root ' + IS_ROOT);
  for (let i = 0; i < arms.length; i++) {
    const a = arms[i];
    let res;
    try {
      res = await a.fn();
    } catch (e) {
      res = { fails: ['threw: ' + (e && e.message ? e.message : String(e))] };
    }
    if (res && res.skip) skip(a.label, res.skip);
    else if (res && res.fails && res.fails.length) {
      fail(a.label, res.fails.length + ' problem(s)');
      res.fails.slice(0, 60).forEach(function (f) { emit('  - ' + f); });
    } else ok(a.label);
  }
  if (net.count() !== 0 && !REPLAY) {
    // The loader counts attempts; the surface checks use no network at all.
    failed += 1;
    emit('FAIL - network attempts ' + net.count() + ', expected 0');
  }
  net.restore();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  emit(failed ? 'RESULT - FAIL (' + failed + ')' : 'RESULT - PASS');
  process.exit(failed ? 1 : 0);
})();
