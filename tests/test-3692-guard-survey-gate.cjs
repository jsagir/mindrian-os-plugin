#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261012-sc0 -- the Part 8 guard survey gate.
 * Debug session: part8-egress-guard-room-lexicon-false-positive-blocks-theo.
 *
 * Decision D-02 (navigator, 2026-10-12): the survey (rooms x questions,
 * retention probe, 10 negatives) is a release gate with SYNTHETIC rooms built
 * by a script, and it fails the cut when induced false positives on the 26 set
 * exceed 0 or any negative passes.
 *
 * DS-3: the 0 rule on the 26 set holds for every room except gate-segment. The
 * gate-segment pairs (the known S1 residual, the word "segment") are listed by
 * exact pair in the committed baseline; --stamp refuses any 26-set pair outside
 * gate-segment.
 * DS-4: the leaks GAP1 and GAP2 are tracked by known_leaks[].status in the
 * committed baseline (open or fixed). An open leak must be allowed; a fixed
 * leak that is allowed fails the gate.
 *
 * Tri-Polar (DS-8): one classify function (lib/core/part8-egress-guard.cjs)
 * serves the CLI PreToolUse hook and the in-process belt that the MCP server
 * uses on Desktop and Cowork. Leg M calls classify in process. Leg H spawns
 * the hook. The gate runs on the dev machine at the cut (release.sh Step 0.6c,
 * RELEASE_GATE_SUITES). No surface-specific code.
 *
 * Legs:
 *   L0  static checks (corpus counts, baseline parses, no dash, determinism)
 *   C0  comparator self-check (9 regression mutations, 3 improvement mutations)
 *   M   the real measurement, compared with the committed baseline
 *   H   the CLI hook agrees with classify
 *   N   no network call, time under the budget
 *
 * Flags:
 *   --baseline <path>          baseline file (default tests/fixtures/3692/guard-survey-baseline.json)
 *   --stamp --reason <text>    rewrite the baseline (refuses a hard-rule failure)
 *
 * Exit codes: 0 pass, 1 fail, 2 usage error. There is no exit 77 (DS-5): a
 * skip in the release suite is a silent pass.
 *
 * Size: 6 synthetic rooms x 7 configurations (6 rooms plus no room) x 560
 * questions (26 frozen positives, 522 extended, 10 negatives, 2 leak probes).
 * Planner time: about 4 s. Budget: 60 s.
 *
 * Every string is synthetic. No real room is opened. The rooms are built in a
 * temp folder and removed.
 *
 * No em-dash or en-dash anywhere (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const NO_NET_PRELOAD = path.join(ROOT, 'tests', 'fixtures', '356-no-network-preload.cjs');
const HELPER = path.join(__dirname, 'helpers', 'synthetic-room-db.cjs');
const CORPUS_PATH = path.join(__dirname, 'fixtures', '3692', 'guard-survey-corpus.json');
const DEFAULT_BASELINE = path.join(__dirname, 'fixtures', '3692', 'guard-survey-baseline.json');
const TIME_BUDGET_MS = 60000;
const RESIDUAL_ROOM = 'gate-segment';
const HARD_RETENTION_KINDS = ['claim', 'person', 'venture_name', 'room_name'];

let fetchCalls = 0;
let isolated = false;
let TMP = null;

// ---- isolation, before any require of plugin code -------------------------
function isolate() {
  if (isolated) return TMP;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos3692-gate-'));
  const tmpHome = path.join(TMP, 'home');
  fs.mkdirSync(tmpHome, { recursive: true });
  fs.mkdirSync(path.join(TMP, 'registry'), { recursive: true });
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.TAVILY_API_KEY;
  delete process.env.OPENALEX_API_KEY;
  globalThis.fetch = function noNetwork() {
    fetchCalls += 1;
    throw new Error('guard survey gate: network is not allowed');
  };
  isolated = true;
  return TMP;
}

function cleanup() {
  if (TMP) {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

// ---- small helpers --------------------------------------------------------
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ':' + stableStringify(v[k]);
  }).join(',') + '}';
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function fmt(v) {
  if (v === undefined) return 'absent';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function isBlock(v) {
  return !!v && v.verdict === 'block';
}

// ---- the extended set, generated at run time ------------------------------
function buildExtended(corpus) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8'));
  const ext = corpus.extended;

  const B = [].concat(doc.framework_names, doc.curated_extras || []).map(function (n, i) {
    return { id: 'B' + (i + 1), q: ext.frameworks.prefix + n };
  });

  const C = [];
  const rejectRe = new RegExp(ext.commands.reject_regex);
  const cmdDir = path.join(ROOT, 'commands');
  fs.readdirSync(cmdDir).filter(function (f) { return f.endsWith('.md'); }).sort().forEach(function (f) {
    const t = fs.readFileSync(path.join(cmdDir, f), 'utf8');
    const m = t.match(/^description:\s*(.+)$/m);
    if (!m) return;
    let d = m[1].trim().replace(/^["']|["']$/g, '');
    if (d.length < ext.commands.min || d.length > ext.commands.max) return;
    if (rejectRe.test(d)) return;
    d = d.charAt(0).toLowerCase() + d.slice(1);
    C.push({ id: 'C' + (C.length + 1), q: ext.commands.prefix + d.replace(/\.$/, '') });
  });

  const sections = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS;
  const D = Object.keys(sections).map(function (slug, i) {
    const label = String(sections[slug].label).toLowerCase().replace(/&/g, 'and');
    return { id: 'D' + (100 + i + 1), q: ext.sections.template.replace('{label}', label) };
  });

  return { B: B, C: C, D: D, all: B.concat(C, D) };
}

// ---- measure --------------------------------------------------------------
function measure() {
  const tmp = isolate();
  const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
  const lexMod = require(path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
  const helper = require(HELPER);
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));

  const roomPaths = {};
  helper.GATE_ROOMS.forEach(function (name) {
    const dir = path.join(tmp, 'rooms', name);
    helper.buildRoom(dir, name);
    roomPaths[name] = dir;
  });

  const ext = buildExtended(corpus);
  const leaks = corpus.known_leaks.map(function (g) {
    return { id: g.id, q: Array.isArray(g.q_parts) ? g.q_parts.join('') : g.q };
  });

  // configurations: no room first, then the 6 rooms in order.
  const configs = [{ name: 'none', dir: null }].concat(helper.GATE_ROOMS.map(function (n) {
    return { name: n, dir: roomPaths[n] };
  }));

  function verdictOf(q, dir) {
    return guard.classify({ question: q }, { toolName: 'brain_ask', roomDir: dir });
  }

  // verdicts[configName][setName] = array of verdicts in question order
  const sets = {
    pos26: corpus.positives_26,
    ext: ext.all,
    neg: corpus.negatives,
    leak: leaks,
  };
  const res = {};
  configs.forEach(function (cfg) {
    lexMod._resetLexiconCache();
    res[cfg.name] = {};
    Object.keys(sets).forEach(function (setName) {
      res[cfg.name][setName] = sets[setName].map(function (item) { return verdictOf(item.q, cfg.dir); });
    });
  });

  const measured = {
    catalog: { B: ext.B.length, C: ext.C.length, D: ext.D.length, total: ext.all.length },
  };

  // 26 set
  const induced = [];
  let posBlockedNoRoom = 0;
  corpus.positives_26.forEach(function (p, i) {
    if (isBlock(res.none.pos26[i])) posBlockedNoRoom += 1;
  });
  helper.GATE_ROOMS.forEach(function (room) {
    corpus.positives_26.forEach(function (p, i) {
      const v = res[room].pos26[i];
      if (isBlock(v) && !isBlock(res.none.pos26[i])) induced.push(room + ':' + p.id + ':' + v.token_class);
    });
  });
  measured.pos26 = { blocked_no_room: posBlockedNoRoom, induced: induced.sort() };

  // extended set
  let extBlockedNoRoom = 0;
  ext.all.forEach(function (q, i) {
    if (isBlock(res.none.ext[i])) extBlockedNoRoom += 1;
  });
  let extInduced = 0;
  const byClass = {};
  helper.GATE_ROOMS.forEach(function (room) {
    ext.all.forEach(function (q, i) {
      const v = res[room].ext[i];
      if (isBlock(v) && !isBlock(res.none.ext[i])) {
        extInduced += 1;
        const k = String(v.token_class);
        byClass[k] = (byClass[k] || 0) + 1;
      }
    });
  });
  measured.ext = { blocked_no_room: extBlockedNoRoom, induced_total: extInduced, induced_by_class: byClass };

  // negatives
  const negLeaks = [];
  let negEvals = 0;
  configs.forEach(function (cfg) {
    corpus.negatives.forEach(function (n, i) {
      negEvals += 1;
      if (!isBlock(res[cfg.name].neg[i])) negLeaks.push(cfg.name + ':' + n.id);
    });
  });
  measured.negatives = { evaluations: negEvals, leaks: negLeaks.sort() };

  // retention
  const retention = {};
  helper.GATE_ROOMS.forEach(function (room) {
    lexMod._resetLexiconCache();
    const lex = lexMod.loadRoomLexicon(roomPaths[room]);
    const entries = (lex && lex.entries) || [];
    entries.forEach(function (e) {
      const q = e.kind === 'claim' ? e.text : 'which framework fits ' + e.text;
      const v = verdictOf(q, roomPaths[room]);
      if (!retention[e.kind]) retention[e.kind] = { entries: 0, refused: 0 };
      retention[e.kind].entries += 1;
      if (isBlock(v)) retention[e.kind].refused += 1;
    });
  });
  const retSorted = {};
  Object.keys(retention).sort().forEach(function (k) { retSorted[k] = retention[k]; });
  measured.retention = retSorted;

  // must-refuse probes
  const failed = [];
  corpus.must_refuse.forEach(function (m, i) {
    lexMod._resetLexiconCache();
    const v = verdictOf(m.q, roomPaths[m.room]);
    const good = isBlock(v) && v.class === 'room_content' && v.token_class === m.token_class;
    if (!good) failed.push('M' + (i + 1) + ':' + m.room + ':' + m.token_class);
  });
  measured.must_refuse = { total: corpus.must_refuse.length, failed: failed };

  // known leaks
  const kl = {};
  leaks.forEach(function (g, i) {
    let allowed = 0;
    configs.forEach(function (cfg) {
      if (!isBlock(res[cfg.name].leak[i])) allowed += 1;
    });
    kl[g.id] = { allowed_in: allowed };
  });
  measured.known_leaks = kl;

  measured.fetch_calls = fetchCalls;
  return measured;
}

function measuredHash(measured) {
  return crypto.createHash('sha256').update(stableStringify(measured)).digest('hex');
}

// ---- compare --------------------------------------------------------------
function leakStatus(baseline, id) {
  const list = (baseline && Array.isArray(baseline.known_leaks)) ? baseline.known_leaks : [];
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function compare(measured, baseline) {
  const b = baseline || {};
  const rows = [];
  function row(metric, bv, mv, verdict, hard) {
    rows.push({ metric: metric, baseline: bv, measured: mv, verdict: verdict, hard: !!hard });
  }

  // catalog (a NOTE, never a fail)
  const bc = b.catalog;
  const same = bc && stableStringify(bc) === stableStringify(measured.catalog);
  row('catalog', bc, measured.catalog, same || !bc ? 'OK' : 'NOTE', false);

  // 26 set, no room
  row('pos26.blocked_no_room', 0, measured.pos26.blocked_no_room,
    measured.pos26.blocked_no_room > 0 ? 'FAIL' : 'OK', measured.pos26.blocked_no_room > 0);

  // 26 set, induced pairs
  const bInduced = (b.pos26 && b.pos26.induced) || [];
  const mInduced = measured.pos26.induced;
  const added = mInduced.filter(function (p) { return bInduced.indexOf(p) < 0; });
  const gone = bInduced.filter(function (p) { return mInduced.indexOf(p) < 0; });
  const outside = mInduced.filter(function (p) { return p.split(':')[0] !== RESIDUAL_ROOM; });
  let pv = 'OK';
  if (added.length > 0 || outside.length > 0) pv = 'FAIL';
  else if (gone.length > 0) pv = 'IMPROVED';
  row('pos26.induced', bInduced, mInduced, pv, outside.length > 0);

  // extended set
  const bExt = b.ext || {};
  function counter(metric, bv, mv) {
    const bn = (typeof bv === 'number') ? bv : 0;
    row(metric, bn, mv, mv > bn ? 'FAIL' : (mv < bn ? 'IMPROVED' : 'OK'), false);
  }
  counter('ext.induced_total', bExt.induced_total, measured.ext.induced_total);
  const classes = {};
  Object.keys(bExt.induced_by_class || {}).forEach(function (k) { classes[k] = true; });
  Object.keys(measured.ext.induced_by_class).forEach(function (k) { classes[k] = true; });
  Object.keys(classes).sort().forEach(function (k) {
    counter('ext.induced_by_class.' + k, (bExt.induced_by_class || {})[k], measured.ext.induced_by_class[k] || 0);
  });
  counter('ext.blocked_no_room', bExt.blocked_no_room, measured.ext.blocked_no_room);

  // negatives
  row('negatives.leaks', (b.negatives && b.negatives.leaks) || [], measured.negatives.leaks,
    measured.negatives.leaks.length > 0 ? 'FAIL' : 'OK', measured.negatives.leaks.length > 0);

  // retention
  const bRet = b.retention || {};
  const kinds = {};
  Object.keys(bRet).forEach(function (k) { kinds[k] = true; });
  Object.keys(measured.retention).forEach(function (k) { kinds[k] = true; });
  Object.keys(kinds).sort().forEach(function (k) {
    const bm = bRet[k];
    const mm = measured.retention[k];
    const metric = 'retention.' + k;
    if (!mm) {
      row(metric, bm, undefined, 'FAIL', false);
      return;
    }
    if (HARD_RETENTION_KINDS.indexOf(k) >= 0 && mm.refused < mm.entries) {
      row(metric, bm, mm, 'FAIL', true);
      return;
    }
    if (!bm) {
      row(metric, undefined, mm, 'NEW', false);
      return;
    }
    row(metric, bm, mm, mm.refused < bm.refused ? 'FAIL' : (mm.refused > bm.refused ? 'IMPROVED' : 'OK'), false);
  });

  // must-refuse probes
  row('must_refuse.failed', [], measured.must_refuse.failed,
    measured.must_refuse.failed.length > 0 ? 'FAIL' : 'OK', measured.must_refuse.failed.length > 0);

  // known leaks
  Object.keys(measured.known_leaks).sort().forEach(function (id) {
    const allowed = measured.known_leaks[id].allowed_in;
    const bl = leakStatus(b, id);
    const metric = 'known_leaks.' + id;
    if (!bl) {
      row(metric, undefined, 'allowed_in=' + allowed, 'NEW', false);
    } else if (bl.status === 'fixed') {
      row(metric, 'status=fixed', 'allowed_in=' + allowed, allowed > 0 ? 'FAIL' : 'OK', allowed > 0);
    } else {
      row(metric, 'status=open', 'allowed_in=' + allowed, allowed === 0 ? 'IMPROVED' : 'OK', false);
    }
  });

  // network
  row('fetch_calls', 0, measured.fetch_calls, measured.fetch_calls > 0 ? 'FAIL' : 'OK', measured.fetch_calls > 0);

  const failRows = rows.filter(function (r) { return r.verdict === 'FAIL'; });
  return {
    rows: rows,
    fail: failRows.length > 0,
    failCount: failRows.length,
    improved: rows.some(function (r) { return r.verdict === 'IMPROVED'; }),
    hardFailures: failRows.filter(function (r) { return r.hard; }),
  };
}

function canStamp(measured, baseline) {
  return compare(measured, baseline).hardFailures.length === 0;
}

function printRows(rows) {
  rows.forEach(function (r) {
    console.log('DELTA ' + r.metric + ' baseline=' + fmt(r.baseline) + ' measured=' + fmt(r.measured) + ' ' + r.verdict);
  });
}

// ---- baseline writer (used by --stamp and by C0) --------------------------
function makeBaseline(measured, prev, meta, leakSessions) {
  const date = meta.date;
  const leaks = Object.keys(measured.known_leaks).sort().map(function (id) {
    const old = leakStatus(prev, id);
    const allowed = measured.known_leaks[id].allowed_in;
    let status = 'open';
    let fixedOn = null;
    if (old && old.status === 'fixed') {
      status = 'fixed';
      fixedOn = old.fixed_on || date;
    } else if (allowed === 0) {
      status = 'fixed';
      fixedOn = date;
    }
    return {
      id: id,
      status: status,
      allowed_in: allowed,
      debug_session: (leakSessions && leakSessions[id]) || (old && old.debug_session) || null,
      fixed_on: fixedOn,
    };
  });
  return {
    schema: 1,
    stamped: { date: date, head: meta.head, reason: meta.reason },
    rooms: meta.rooms,
    catalog: measured.catalog,
    pos26: measured.pos26,
    ext: measured.ext,
    negatives: measured.negatives,
    retention: measured.retention,
    must_refuse: measured.must_refuse,
    known_leaks: leaks,
  };
}

// ---- legs -----------------------------------------------------------------
let passed = 0;
let failed = 0;
function pass(name) {
  passed += 1;
  console.log('PASS: ' + name);
}
function fail(name, detail) {
  failed += 1;
  console.log('FAIL: ' + name + ': ' + detail);
}

function legStatic(baselinePath) {
  const name = 'L0 static checks';
  const problems = [];
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  if (corpus.positives_26.length !== 26) problems.push('positives_26 has ' + corpus.positives_26.length);
  if (corpus.negatives.length !== 10) problems.push('negatives has ' + corpus.negatives.length);
  if (corpus.known_leaks.length !== 2) problems.push('known_leaks has ' + corpus.known_leaks.length);
  if (corpus.must_refuse.length !== 10) problems.push('must_refuse has ' + corpus.must_refuse.length);
  let baseline = null;
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch (e) {
    problems.push('baseline does not parse: ' + e.message);
  }
  if (baseline && (baseline.schema !== 1 || !baseline.stamped || !Array.isArray(baseline.known_leaks))) {
    problems.push('baseline has the wrong shape');
  }
  const dashes = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
  [HELPER, CORPUS_PATH, DEFAULT_BASELINE, __filename].forEach(function (f) {
    if (!fs.existsSync(f)) return;
    const text = fs.readFileSync(f, 'utf8');
    dashes.forEach(function (d) {
      if (text.indexOf(d) >= 0) problems.push('dash character in ' + path.relative(ROOT, f));
    });
  });
  const helper = require(HELPER);
  helper.GATE_ROOMS.forEach(function (n) {
    if (stableStringify(helper.nodesFor(n)) !== stableStringify(helper.nodesFor(n))) {
      problems.push('nodesFor is not deterministic for ' + n);
    }
  });
  if (problems.length > 0) fail(name, problems.join('; '));
  else pass(name);
}

function legSelfCheck() {
  const name = 'C0 comparator self-check';
  const problems = [];
  const m0 = {
    catalog: { B: 415, C: 96, D: 11, total: 522 },
    pos26: { blocked_no_room: 0, induced: ['gate-segment:N6:room_term'] },
    ext: { blocked_no_room: 37, induced_total: 0, induced_by_class: {} },
    negatives: { evaluations: 70, leaks: [] },
    retention: {
      claim: { entries: 7, refused: 7 },
      person: { entries: 1, refused: 1 },
      room_file: { entries: 1, refused: 1 },
      room_name: { entries: 6, refused: 6 },
      room_term: { entries: 41, refused: 41 },
      venture_name: { entries: 1, refused: 1 },
    },
    must_refuse: { total: 10, failed: [] },
    known_leaks: { GAP1: { allowed_in: 7 }, GAP2: { allowed_in: 7 } },
    fetch_calls: 0,
  };
  const meta = { date: '2026-01-01', head: 'selfcheck', reason: 'selfcheck', rooms: [] };
  const b0 = makeBaseline(m0, null, meta, { GAP1: 's', GAP2: 's' });
  const base = compare(m0, b0);
  if (base.fail || base.improved) problems.push('the unmutated measurement does not compare clean');

  function bFixed() {
    const b = clone(b0);
    b.known_leaks[0].status = 'fixed';
    return b;
  }
  const regressions = [
    { n: 'pos26 no-room block', hard: true, f: function (m) { m.pos26.blocked_no_room = 1; } },
    { n: 'new pos26 pair in gate-lexgen', hard: true, f: function (m) { m.pos26.induced.push('gate-lexgen:D3:room_term'); } },
    { n: 'ext.induced_total plus 1', hard: false, f: function (m) { m.ext.induced_total = 1; } },
    { n: 'ext.blocked_no_room plus 1', hard: false, f: function (m) { m.ext.blocked_no_room += 1; } },
    { n: 'negative leak', hard: true, f: function (m) { m.negatives.leaks = ['none:X1']; } },
    { n: 'retention room_term refused minus 1', hard: false, f: function (m) { m.retention.room_term.refused -= 1; } },
    { n: 'person refused below entries', hard: true, f: function (m) { m.retention.person.refused = 0; } },
    { n: 'fixed GAP with allowed_in 1', hard: true, base: bFixed, f: function (m) { m.known_leaks.GAP1.allowed_in = 1; } },
    { n: 'fetch_calls 1', hard: true, f: function (m) { m.fetch_calls = 1; } },
  ];
  regressions.forEach(function (r) {
    const m = clone(m0);
    r.f(m);
    const b = r.base ? r.base() : b0;
    const c = compare(m, b);
    if (!c.fail) problems.push('regression "' + r.n + '" did not give FAIL');
    if (r.hard && canStamp(m, b)) problems.push('regression "' + r.n + '" can be stamped');
    if (!r.hard && !canStamp(m, b)) problems.push('soft regression "' + r.n + '" cannot be stamped');
  });
  const improvements = [
    { n: 'gate-segment pair removed', f: function (m) { m.pos26.induced = []; } },
    { n: 'ext.blocked_no_room minus 1', f: function (m) { m.ext.blocked_no_room -= 1; } },
    { n: 'open GAP with allowed_in 0', f: function (m) { m.known_leaks.GAP2.allowed_in = 0; } },
  ];
  improvements.forEach(function (r) {
    const m = clone(m0);
    r.f(m);
    const c = compare(m, b0);
    if (c.fail) problems.push('improvement "' + r.n + '" gave FAIL');
    if (!c.improved) problems.push('improvement "' + r.n + '" gave no IMPROVED row');
  });
  if (problems.length > 0) fail(name, problems.join('; '));
  else pass(name + ' (' + regressions.length + ' regressions fail, ' + improvements.length + ' improvements pass)');
}

function spawnHook(text, roomEnv) {
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_ACTIVE_ROOM;
  if (roomEnv) env.CLAUDE_ACTIVE_ROOM = roomEnv;
  env.NODE_OPTIONS = '--require ' + NO_NET_PRELOAD;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'mcp__plugin_mos_mindrian-brain__brain_ask',
      tool_input: { question: text },
      session_id: 'tgate3692',
      cwd: roomEnv || ROOT,
    }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
  return { status: r.status, stderr: r.stderr || '' };
}

function legHook() {
  const name = 'H CLI hook agrees with classify';
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  const roomDir = path.join(TMP, 'rooms', 'gate-lexgen');
  const n1 = spawnHook(corpus.positives_26[0].q, roomDir);
  const x2 = spawnHook(corpus.negatives.filter(function (n) { return n.id === 'X2'; })[0].q, roomDir);
  const vel = spawnHook('which framework fits Veldmark', roomDir);
  const problems = [];
  if (n1.status !== 0) problems.push('N1 hook exit ' + n1.status + ', expected 0');
  if (x2.status !== 2) problems.push('X2 hook exit ' + x2.status + ', expected 2');
  if (vel.status !== 2) problems.push('room term hook exit ' + vel.status + ', expected 2');
  [n1, x2, vel].forEach(function (r) {
    if (r.stderr.indexOf('NETWORK_ATTEMPT_356') >= 0) problems.push('the hook child attempted a network call');
  });
  if (problems.length > 0) fail(name, problems.join('; '));
  else pass(name);
}

// ---- main -----------------------------------------------------------------
function usage() {
  console.log('usage: node tests/test-3692-guard-survey-gate.cjs [--baseline <path>] [--stamp --reason <text>]');
}

function parseArgs(argv) {
  const out = { baseline: DEFAULT_BASELINE, stamp: false, reason: null, bad: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--baseline':
        out.baseline = path.resolve(argv[i + 1] || '');
        if (!argv[i + 1]) out.bad = true;
        i += 1;
        break;
      case '--stamp':
        out.stamp = true;
        break;
      case '--reason':
        out.reason = argv[i + 1] || null;
        if (!argv[i + 1]) out.bad = true;
        i += 1;
        break;
      default:
        out.bad = true;
    }
  }
  if (out.stamp && !out.reason) out.bad = true;
  if (!out.stamp && out.reason) out.bad = true;
  return out;
}

function gitHead() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const sha = (r.status === 0 && r.stdout) ? r.stdout.trim() : '';
  return sha || 'unknown';
}

function readBaselineOrNull(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function doStamp(args) {
  const prev = readBaselineOrNull(args.baseline);
  const measured = measure();
  const before = compare(measured, prev);
  console.log('--- stamp: old baseline against the measurement');
  printRows(before.rows);
  if (before.hardFailures.length > 0) {
    before.hardFailures.forEach(function (r) {
      console.log('REFUSED: hard rule failed: ' + r.metric + ' baseline=' + fmt(r.baseline) + ' measured=' + fmt(r.measured));
    });
    console.log('STAMP: refused, the baseline was not written');
    return 1;
  }
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  const sessions = {};
  corpus.known_leaks.forEach(function (g) { sessions[g.id] = g.debug_session; });
  const next = makeBaseline(measured, prev, {
    date: new Date().toISOString().slice(0, 10),
    head: gitHead(),
    reason: args.reason,
    rooms: require(HELPER).GATE_ROOMS,
  }, sessions);
  fs.writeFileSync(args.baseline, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log('--- stamp: new baseline against the measurement');
  printRows(compare(measured, next).rows);
  console.log('STAMP: wrote ' + args.baseline);
  console.log('MEASURED_SHA256: ' + measuredHash(measured));
  return 0;
}

function main() {
  const t0 = Date.now();
  const args = parseArgs(process.argv.slice(2));
  if (args.bad) {
    usage();
    return 2;
  }
  try {
    require('node:sqlite');
  } catch (_e) {
    console.log('FAIL: node:sqlite unavailable, the gate cannot measure');
    return 1;
  }
  isolate();
  try {
    if (args.stamp) return doStamp(args);

    legStatic(args.baseline);
    legSelfCheck();

    let measured = null;
    let cmp = null;
    try {
      measured = measure();
      const baseline = readBaselineOrNull(args.baseline);
      cmp = compare(measured, baseline);
      printRows(cmp.rows);
      if (cmp.fail) {
        console.log('GATE: FAIL (' + cmp.failCount + ' rows)');
        fail('M measurement against the baseline', cmp.failCount + ' rows failed');
      } else {
        console.log('GATE: PASS');
        pass('M measurement against the baseline');
      }
      if (cmp.improved) {
        console.log('NOTE: numbers improved; re-stamp on purpose: node tests/test-3692-guard-survey-gate.cjs --stamp --reason "<why>"');
      }
    } catch (e) {
      fail('M measurement against the baseline', (e && e.stack) ? e.stack : String(e));
    }

    if (measured) {
      try {
        legHook();
      } catch (e) {
        fail('H CLI hook agrees with classify', (e && e.message) ? e.message : String(e));
      }
    }

    const elapsed = Date.now() - t0;
    if (fetchCalls > 0) fail('N net and time', 'fetch was called ' + fetchCalls + ' times');
    else if (elapsed >= TIME_BUDGET_MS) fail('N net and time', 'elapsed ' + elapsed + ' ms, budget ' + TIME_BUDGET_MS + ' ms');
    else pass('N net and time (fetch calls 0, ' + elapsed + ' ms of ' + TIME_BUDGET_MS + ' ms)');

    console.log('PASS: ' + passed + ' FAIL: ' + failed);
    if (measured) console.log('MEASURED_SHA256: ' + measuredHash(measured));
    console.log('ELAPSED_MS: ' + (Date.now() - t0));
    return failed === 0 ? 0 : 1;
  } finally {
    cleanup();
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { measure: measure, compare: compare, canStamp: canStamp };
