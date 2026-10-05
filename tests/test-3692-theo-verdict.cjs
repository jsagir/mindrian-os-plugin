#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 01 (369.2-R04, CODE-07, J4, SW-10) -- the one-verdict
 * equivalence table for Theo free-form strings (brief test 9).
 *
 * One function, theoVerdict(), decides every free-form string Theo can see.
 * brain_ask, brain_search, brain_query and the PreToolUse hook must give ONE
 * disposition per row. A plain methodology question with no room-local token
 * reaches the wire on all three verbs (the J4 bolt); room content (a term from
 * the bound room's lexicon, a private-venture sentence, an unknown identifier,
 * every CONTENT-SET hit including the 8-city fence) blocks with ZERO bytes on
 * the wire. One error vocabulary: {error:'egress_blocked', tool, egress_class,
 * token_class}.
 *
 * Legs:
 *   V1  unit: theoVerdict on the 10 Phase 0 prompts, PB8-03, the 10 test-354
 *       PRIVATE canaries, CANARY7F3A2B, the lexicon rows, a corrupt room.db.
 *   V2  wire: every row through ask, search, query (capture server) and the
 *       hook; disagreements counted; sentinel shape on every block.
 *   V3  lexicon hygiene: no room.db created, read time, memoization.
 *   V4  fast path: the test-354 Case E typed rows answer typed_question.
 *   V5  no echo: no refusal carries the matched term, canary or city bytes.
 *   V6  hook budget: 10 spawns with a bound room, p95 under 400 ms.
 *
 * Isolation: HOME, USERPROFILE, MINDRIAN_ROOMS_HOME in mkdtemp dirs; the Brain
 * URL is the loopback capture server; vendor keys deleted; a fetch guard fails
 * the leg on any socket that is not the capture server.
 *
 * No em-dash or en-dash anywhere (CLAUDE.md HARD RULE). Exit 0 pass, 1 fail,
 * 77 only for an ENV GAP.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// ---- isolation, before any require of plugin code -------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos3692-01-'));
const TMP_HOME = path.join(TMP, 'home');
const TMP_ROOMS = path.join(TMP, 'rooms');
fs.mkdirSync(TMP_HOME, { recursive: true });
fs.mkdirSync(TMP_ROOMS, { recursive: true });
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = TMP_ROOMS;
process.env.MINDRIAN_BRAIN_KEY = 'synthetic-3692-01-key';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '4000';
delete process.env.TAVILY_API_KEY;
delete process.env.OPENALEX_API_KEY;
delete process.env.CLAUDE_ACTIVE_ROOM;

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');

const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const capture = require(path.join(__dirname, 'helpers', 'brain-capture-server.cjs'));
const { buildRoom363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));

// ---- the fixed rows -------------------------------------------------------
// The 10 Phase 0 prompts, verbatim from
// .planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/CODE-07/probe.cjs
// with the verdict the one-verdict contract assigns (9 allow, 1 block).
const PHASE0 = Object.freeze([
  { p: 'How do I decide which customer segment to pursue first?', v: 'allow', c: 'generic_question' },
  { p: 'What is the best way to validate a business idea?', v: 'allow', c: 'generic_question' },
  { p: 'How should I use the Minto Pyramid framework to structure an argument?', v: 'allow', c: 'generic_question' },
  { p: 'Which framework fits a wicked problem?', v: 'allow', c: 'typed_question' },
  { p: "MATCH (f:Framework) WHERE f.name CONTAINS 'Minto' RETURN f.name", v: 'allow', c: 'generic_question' },
  { p: 'MATCH (n) RETURN labels(n) AS labels, count(*) AS c', v: 'allow', c: 'generic_question' },
  { p: 'How do I price my product for Tel Aviv customers?', v: 'block', c: 'content_set' },
  { p: 'Which chain of frameworks follows discovery stage for an ill-defined problem?', v: 'allow', c: 'typed_question' },
  { p: 'How do I decide which customer segment to pursue first, using the framework approach?', v: 'allow', c: 'generic_question' },
  { p: "MATCH (n) WHERE n.text CONTAINS 'customer segment' RETURN n", v: 'allow', c: 'generic_question' },
]);

// lib/core/part8-egress-guard.test.cjs PB8-03 (lines 145-155).
const PB803_LEAKY = 'summarize this leaky prose from founder jane@startup.com about our pivot';
const PB803_GENERIC = 'What frameworks address an ill-defined problem at the discovery stage?';

// The 10 PRIVATE canaries, copied from tests/test-354-egress-typed-question.cjs
// lines 50-71 (that file runs main() on require and exports nothing).
const PRIVATE_CORPUS = Object.freeze([
  { text: 'Use the SWOT framework on our confidential plan: cedar will acquire juniper next autumn.', marker: 'cedar' },
  { text: 'Apply first-principles thinking to my acquisition of Meridian Robotics before March.', marker: 'Meridian' },
  { text: 'Which framework fits our secret merger with Solstice Ventures?', marker: 'Solstice' },
  { text: 'Recommend a methodology for the Blackwood expansion our board approved yesterday.', marker: 'Blackwood' },
  { text: "Use Porter's five forces on our confidential Northwind deal.", marker: 'Northwind' },
  { text: 'What chain of frameworks should I use for our Ashgrove pilot launch?', marker: 'Ashgrove' },
  { text: 'Apply design-thinking to my proprietary Halcyon roadmap for next quarter.', marker: 'Halcyon' },
  { text: 'Use the value-chain framework to analyze our merger with Cobalt Systems.', marker: 'Cobalt' },
  { text: 'Recommend a technique for our undisclosed Ridgeline acquisition next spring.', marker: 'Ridgeline' },
  { text: 'Which methodology should I use for our secret Ferrow expansion plan?', marker: 'Ferrow' },
]);

const CANARY_CYPHER = 'MATCH (f:Framework) WHERE f.name = "CANARY7F3A2B" RETURN f';
const LEX_SENTENCE = 'How should I validate the solar cold locker with resellers?';
const LEX_TERM = 'solar cold locker';

// The test-354 Case E typed rows (lines 90-145 there): the three internal
// templates instantiated with canonical inputs. Must stay typed_question.
function buildTypedRows() {
  const rows = [];
  ['undefined', 'ill-defined', 'well-defined'].forEach(function (d) {
    ['simple', 'complex', 'wicked'].forEach(function (c) {
      rows.push('recommend a framework for a ' + d + ' definition ' + c + ' problem');
    });
  });
  ['undefined', 'ill-defined', 'well-defined', 'wicked'].forEach(function (pt) {
    ['discovery', 'investment', 'scoping', 'execution'].forEach(function (st) {
      rows.push('what frameworks feed into the reverse salient framework for a ' + pt + ' problem at the ' + st + ' stage?');
    });
  });
  ['Design Thinking', 'Adaptive Leadership', 'Black Hat Analysis'].forEach(function (n) {
    rows.push('what frameworks chain from ' + n + ' via FEEDS_INTO?');
  });
  ['diagnose', 'act', 'research'].forEach(function (s) {
    rows.push('what methodology chain follows ' + s + '?');
  });
  return rows;
}

// ---- harness --------------------------------------------------------------
let passed = 0;
let failed = 0;
const failLines = [];
async function leg(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? err.message : String(err);
    failLines.push('FAIL: ' + name + ' :: ' + msg);
    console.log('FAIL: ' + name + ' :: ' + msg);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
function keyFor(p) {
  return /^\s*MATCH\b/.test(p) ? 'cypher' : 'question';
}
function toolFor(p) {
  return keyFor(p) === 'cypher' ? 'brain_query' : 'brain_ask';
}

function listTree(dir) {
  const out = [];
  (function walk(d, rel) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const r = rel ? rel + '/' + e.name : e.name;
      out.push(r);
      if (e.isDirectory()) walk(path.join(d, e.name), r);
    });
  })(dir, '');
  return out.sort();
}

function spawnHook(verb, text, roomEnv) {
  const keyByVerb = { ask: 'question', search: 'query', query: 'cypher' };
  const toolInput = {};
  toolInput[keyByVerb[verb]] = text;
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_ACTIVE_ROOM;
  if (roomEnv) env.CLAUDE_ACTIVE_ROOM = roomEnv;
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'mcp__plugin_mos_mindrian-brain__brain_' + verb,
      tool_input: toolInput,
      session_id: 't3692',
      cwd: roomEnv || ROOT,
    }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { status: r.status, stderr: r.stderr || '', stdout: r.stdout || '', ms: ms };
}

async function main() {
  const cap = await capture.startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = cap.url;

  // Fetch guard scoped to the capture server (hygiene-355 installNetGuard
  // throws on every fetch, which would also stop the capture-server legs).
  const realFetch = globalThis.fetch;
  let strayFetches = 0;
  globalThis.fetch = function guardedFetch(input, init) {
    const u = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (u.indexOf(cap.url) !== 0) {
      strayFetches += 1;
      throw new Error('3692-01 net guard: non-capture socket ' + u);
    }
    return realFetch(input, init);
  };

  const brainPath = path.join(ROOT, 'lib', 'core', 'brain-client.cjs');
  delete require.cache[brainPath];
  const brain = require(brainPath);
  const guardPath = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
  const guard = require(guardPath);

  let lexMod = null;
  try { lexMod = require(path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs')); } catch (_e) { lexMod = null; }
  function resetLex() { if (lexMod && lexMod._resetLexiconCache) lexMod._resetLexiconCache(); }

  // ---- rooms ----
  const room = buildRoom363({});
  const nav = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  {
    const db = roomDbMod.openRoomDb(room.roomDir, { allowExtension: true });
    try {
      const w = nav.writeEntityNode(db, { entityType: 'technology', name: LEX_TERM, sessionId: 's3692' });
      if (!w || w.ok !== true) throw new Error('fixture: writeEntityNode failed ' + JSON.stringify(w));
    } finally {
      roomDbMod.closeRoomDb(db);
    }
  }
  const corruptRoom = path.join(TMP, 'corrupt-room');
  fs.mkdirSync(path.join(corruptRoom, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(corruptRoom, 'ROOM.md'), '---\nventure_name: Corrupt Fixture\n---\n# Corrupt\n');
  fs.writeFileSync(path.join(corruptRoom, '.mindrian', 'room.db'), 'this is not a sqlite database, it is text');

  function bind(dir) {
    if (dir) process.env.CLAUDE_ACTIVE_ROOM = dir; else delete process.env.CLAUDE_ACTIVE_ROOM;
    resetLex();
  }

  const refusals = []; // every refusal text, for V5
  const probes = []; // every probe string, for V5 cross-check

  // ======================================================================
  // V1: theoVerdict unit table
  // ======================================================================
  function tv(text, key, tool, roomDir) {
    const payload = {};
    payload[key] = text;
    return guard.theoVerdict(payload, { toolName: tool, roomDir: roomDir || null });
  }

  await leg('V1a: theoVerdict is exported with 9 token classes', async function () {
    ok(typeof guard.theoVerdict === 'function', 'theoVerdict missing from the guard exports');
    ok(Array.isArray(guard.TOKEN_CLASSES) && guard.TOKEN_CLASSES.length === 9, 'TOKEN_CLASSES must hold 9 entries');
  });

  await leg('V1b: the 10 Phase 0 prompts give 9 allow (2 typed_question, 7 generic_question) and 1 block content_set', async function () {
    bind(null);
    let allow = 0; let typed = 0; let generic = 0;
    PHASE0.forEach(function (row) {
      const v = tv(row.p, keyFor(row.p), toolFor(row.p), null);
      ok(v.verdict === row.v, 'verdict for "' + row.p + '" is ' + v.verdict + '/' + v.class + ', expected ' + row.v);
      ok(v.class === row.c, 'class for "' + row.p + '" is ' + v.class + ', expected ' + row.c);
      if (v.verdict === 'allow') allow += 1;
      if (v.class === 'typed_question') typed += 1;
      if (v.class === 'generic_question') generic += 1;
    });
    ok(allow === 9 && typed === 2 && generic === 7, 'allow=' + allow + ' typed=' + typed + ' generic=' + generic);
  });

  await leg('V1c: PB8-03 generic allows, the leaky sentence blocks content_set', async function () {
    bind(null);
    const g = tv(PB803_GENERIC, 'question', 'brain_ask', null);
    ok(g.verdict === 'allow', 'PB8-03 generic: ' + JSON.stringify(g));
    const l = tv(PB803_LEAKY, 'question', 'brain_ask', null);
    ok(l.verdict === 'block' && l.class === 'content_set', 'PB8-03 leaky: ' + JSON.stringify(l));
  });

  await leg('V1d: each of the 10 test-354 PRIVATE canaries blocks (content_set or room_content)', async function () {
    bind(null);
    PRIVATE_CORPUS.forEach(function (row) {
      const v = tv(row.text, 'question', 'brain_ask', null);
      ok(v.verdict === 'block' && (v.class === 'content_set' || v.class === 'room_content'),
        'canary "' + row.marker + '" gave ' + v.verdict + '/' + v.class);
    });
  });

  await leg('V1e: the CANARY7F3A2B cypher blocks room_content with token_class identifier', async function () {
    bind(null);
    const v = tv(CANARY_CYPHER, 'cypher', 'brain_query', null);
    ok(v.verdict === 'block' && v.class === 'room_content' && v.token_class === 'identifier', JSON.stringify(v));
  });

  await leg('V1f: a bound room lexicon blocks "solar cold locker" (room_term); no room bound allows the same sentence', async function () {
    bind(room.roomDir);
    const blocked = tv(LEX_SENTENCE, 'question', 'brain_ask', room.roomDir);
    ok(blocked.verdict === 'block' && blocked.class === 'room_content' && blocked.token_class === 'room_term', 'bound: ' + JSON.stringify(blocked));
    bind(null);
    const open = tv(LEX_SENTENCE, 'question', 'brain_ask', null);
    ok(open.verdict === 'allow', 'unbound: ' + JSON.stringify(open));
  });

  await leg('V1g: a bound room with a corrupt room.db blocks room_check_unavailable (fail closed)', async function () {
    bind(corruptRoom);
    const v = tv('How do I decide which customer segment to pursue first?', 'question', 'brain_ask', corruptRoom);
    ok(v.verdict === 'block' && v.class === 'room_check_unavailable', JSON.stringify(v));
  });

  // ======================================================================
  // V2: wire equivalence across ask, search, query and the hook
  // ======================================================================
  const VERBS = ['ask', 'search', 'query'];
  const SENTINEL_TOOL = { ask: 'brain_ask', search: 'brain_search', query: 'brain_query' };

  async function driveVerb(verb, text) {
    capture.resetCaptured();
    let result;
    try {
      if (verb === 'ask') result = await brain.ask(text);
      else if (verb === 'search') result = await brain.search(text);
      else result = await brain.query(text);
    } catch (e) {
      result = { threw: String(e && e.message) };
    }
    const wire = capture.captured.length;
    return { disposition: wire > 0 ? 'proceed' : 'blocked', result: result, wire: wire };
  }

  async function driveRow(text, roomDir) {
    const out = { text: text, perVerb: {}, hook: null };
    for (const verb of VERBS) {
      out.perVerb[verb] = await driveVerb(verb, text);
    }
    // the hook, spawned once per verb with the matching tool_name
    const hookRes = VERBS.map(function (verb) { return spawnHook(verb, text, roomDir); });
    out.hookPerVerb = hookRes;
    out.hook = hookRes.map(function (h) { return h.status === 2 ? 'blocked' : 'proceed'; });
    return out;
  }

  function dispositions(row) {
    const d = VERBS.map(function (v) { return row.perVerb[v].disposition; });
    return d.concat(row.hook);
  }
  function disagrees(row) {
    return new Set(dispositions(row)).size > 1;
  }

  const allRows = [];
  PHASE0.forEach(function (r) { allRows.push({ text: r.p, expect: r.v, group: 'phase0' }); });
  allRows.push({ text: PB803_GENERIC, expect: 'allow', group: 'pb8' });
  allRows.push({ text: PB803_LEAKY, expect: 'block', group: 'pb8' });
  PRIVATE_CORPUS.forEach(function (r) { allRows.push({ text: r.text, expect: 'block', group: 'private' }); });
  allRows.push({ text: CANARY_CYPHER, expect: 'block', group: 'canary' });

  bind(null);
  const driven = [];
  await leg('V2a: every row (no room bound) gives one disposition across ask, search, query and the hook; phase0 disagreements=0', async function () {
    let phase0Dis = 0; let allDis = 0;
    const bad = [];
    for (const r of allRows) {
      probes.push(r.text);
      const row = await driveRow(r.text, null);
      row.expect = r.expect; row.group = r.group;
      driven.push(row);
      const dis = disagrees(row);
      if (dis) { allDis += 1; if (r.group === 'phase0') phase0Dis += 1; bad.push(r.group + ':' + JSON.stringify(dispositions(row)) + ' ' + r.text.slice(0, 40)); }
    }
    console.log('  V2a phase0 disagreements=' + phase0Dis + ' of ' + PHASE0.length + '; all-rows disagreements=' + allDis + ' of ' + allRows.length);
    ok(allDis === 0, 'disagreements=' + allDis + ' (phase0=' + phase0Dis + '): ' + bad.join(' | '));
  });

  await leg('V2b: the expected disposition holds on every row (allow reaches the wire, block leaves zero captured requests)', async function () {
    const bad = [];
    driven.forEach(function (row) {
      const want = row.expect === 'allow' ? 'proceed' : 'blocked';
      const got = dispositions(row);
      if (got.some(function (g) { return g !== want; })) bad.push(want + ' vs ' + JSON.stringify(got) + ' ' + row.text.slice(0, 40));
    });
    ok(bad.length === 0, bad.join(' | '));
  });

  await leg('V2c: every block returns {error:egress_blocked, tool, egress_class, token_class}; brain_query never returns null', async function () {
    const bad = [];
    driven.forEach(function (row) {
      if (row.expect !== 'block') return;
      VERBS.forEach(function (verb) {
        const r = row.perVerb[verb].result;
        refusals.push(JSON.stringify(r));
        if (r === null) { bad.push(verb + ' returned null for ' + row.text.slice(0, 30)); return; }
        const shaped = r && r.error === 'egress_blocked' && r.tool === SENTINEL_TOOL[verb]
          && typeof r.egress_class === 'string' && Object.prototype.hasOwnProperty.call(r, 'token_class');
        if (!shaped) bad.push(verb + ' sentinel malformed: ' + JSON.stringify(r).slice(0, 120));
      });
    });
    ok(bad.length === 0, bad.slice(0, 4).join(' | '));
  });

  // Room bound: the lexicon row blocks on all four, the plain rows still allow.
  const lexDriven = [];
  await leg('V2d: with the room bound, the "solar cold locker" sentence blocks on all four; the plain Phase 0 rows still allow', async function () {
    bind(room.roomDir);
    probes.push(LEX_SENTENCE);
    const lexRow = await driveRow(LEX_SENTENCE, room.roomDir);
    lexDriven.push(lexRow);
    ok(!disagrees(lexRow), 'lexicon row disagrees: ' + JSON.stringify(dispositions(lexRow)));
    ok(dispositions(lexRow)[0] === 'blocked', 'lexicon row not blocked: ' + JSON.stringify(dispositions(lexRow)));
    VERBS.forEach(function (verb) {
      const r = lexRow.perVerb[verb].result;
      refusals.push(JSON.stringify(r));
      ok(r && r.error === 'egress_blocked' && r.egress_class === 'room_content' && r.token_class === 'room_term',
        verb + ' sentinel: ' + JSON.stringify(r));
    });
    const plain = PHASE0.filter(function (r) { return r.v === 'allow'; }).slice(0, 4);
    for (const r of plain) {
      const row = await driveRow(r.p, room.roomDir);
      ok(!disagrees(row) && dispositions(row)[0] === 'proceed', 'plain row blocked under a bound room: ' + JSON.stringify(dispositions(row)) + ' ' + r.p);
    }
  });

  await leg('V2e: a bound room with a corrupt room.db blocks every verb and the hook (room_check_unavailable)', async function () {
    bind(corruptRoom);
    const row = await driveRow('How do I decide which customer segment to pursue first?', corruptRoom);
    ok(!disagrees(row) && dispositions(row)[0] === 'blocked', JSON.stringify(dispositions(row)));
    VERBS.forEach(function (verb) {
      const r = row.perVerb[verb].result;
      refusals.push(JSON.stringify(r));
      ok(r && r.error === 'egress_blocked' && r.egress_class === 'room_check_unavailable', verb + ': ' + JSON.stringify(r));
    });
    bind(null);
  });

  // ======================================================================
  // V3: lexicon hygiene
  // ======================================================================
  await leg('V3a: loadRoomLexicon creates nothing in a room with no room.db', async function () {
    ok(lexMod && typeof lexMod.loadRoomLexicon === 'function', 'part8-room-lexicon.cjs missing');
    const bare = path.join(TMP, 'bare-room');
    fs.mkdirSync(bare, { recursive: true });
    fs.writeFileSync(path.join(bare, 'ROOM.md'), '---\nventure_name: Bare Fixture\n---\n# Bare\n');
    const before = listTree(bare);
    const res = lexMod.loadRoomLexicon(bare, {});
    const after = listTree(bare);
    ok(JSON.stringify(before) === JSON.stringify(after), 'directory listing changed: ' + JSON.stringify(after));
    ok(res && res.ok === true, 'bare room must read ok (names only): ' + JSON.stringify(res));
  });

  await leg('V3b: lexicon read on the 363 fixture room is under 50 ms', async function () {
    ok(lexMod, 'part8-room-lexicon.cjs missing');
    resetLex();
    const t0 = process.hrtime.bigint();
    const res = lexMod.loadRoomLexicon(room.roomDir, {});
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log('  V3b lexicon read ms=' + ms.toFixed(2) + ' entries=' + (res && res.entries ? res.entries.length : 'n/a'));
    ok(res && res.ok === true, 'read failed: ' + JSON.stringify(res));
    ok(ms < 50, 'read took ' + ms.toFixed(2) + ' ms');
    ok(res.entries.some(function (e) { return e.text.toLowerCase() === LEX_TERM; }), 'entity name missing from the lexicon');
  });

  await leg('V3c: a second call with an unchanged room.db mtime returns the memoized object', async function () {
    ok(lexMod, 'part8-room-lexicon.cjs missing');
    resetLex();
    const a = lexMod.loadRoomLexicon(room.roomDir, {});
    const b = lexMod.loadRoomLexicon(room.roomDir, {});
    ok(a === b, 'second call returned a different object');
  });

  // ======================================================================
  // V4: the recognizer stays the allow fast path
  // ======================================================================
  await leg('V4: every test-354 Case E typed row answers typed_question', async function () {
    bind(null);
    const rows = buildTypedRows();
    ok(rows.length >= 20, 'typed rows: ' + rows.length);
    rows.forEach(function (t) {
      const v = tv(t, 'question', 'brain_ask', null);
      ok(v.verdict === 'allow' && v.class === 'typed_question', '"' + t + '" gave ' + v.verdict + '/' + v.class);
    });
  });

  // ======================================================================
  // V5: no echo
  // ======================================================================
  await leg('V5: no refusal carries the matched room term, the canary, the city or a private marker', async function () {
    ok(refusals.length >= 10, 'too few refusals captured: ' + refusals.length);
    const needles = [LEX_TERM, 'CANARY7F3A2B', 'Tel Aviv', 'Aviv', 'jane@startup.com']
      .concat(PRIVATE_CORPUS.map(function (r) { return r.marker; }));
    const hay = refusals.join('\n');
    needles.forEach(function (n) {
      ok(hay.indexOf(n) === -1, 'a refusal echoes "' + n + '"');
    });
    // the hook's own stderr on a block
    const hookBlocked = spawnHook('ask', LEX_SENTENCE, room.roomDir);
    ok(hookBlocked.status === 2, 'hook did not block the lexicon sentence: status ' + hookBlocked.status);
    needles.forEach(function (n) {
      ok(hookBlocked.stderr.indexOf(n) === -1, 'hook stderr echoes "' + n + '"');
    });
    const direct = tv(LEX_SENTENCE, 'question', 'brain_ask', room.roomDir);
    needles.forEach(function (n) {
      ok(String(direct.reason || '').indexOf(n) === -1, 'verdict reason echoes "' + n + '"');
    });
  });

  // ======================================================================
  // V6: hook budget
  // ======================================================================
  await leg('V6: 10 hook spawns on a plain question with a bound room, p95 under 400 ms', async function () {
    const times = [];
    for (let i = 0; i < 10; i += 1) {
      const h = spawnHook('ask', 'How do I decide which customer segment to pursue first?', room.roomDir);
      ok(h.status === 0, 'hook exit ' + h.status + ' on a plain question: ' + h.stderr.slice(0, 120));
      times.push(h.ms);
    }
    times.sort(function (a, b) { return a - b; });
    const min = times[0];
    const med = (times[4] + times[5]) / 2;
    const p95 = times[Math.min(9, Math.ceil(0.95 * 10) - 1)];
    console.log('  V6 hook ms min=' + min.toFixed(0) + ' median=' + med.toFixed(0) + ' p95=' + p95.toFixed(0));
    ok(p95 < 400, 'p95 ' + p95.toFixed(0) + ' ms');
  });

  await leg('V7: no stray socket was opened (net guard)', async function () {
    ok(strayFetches === 0, 'stray fetches: ' + strayFetches);
  });

  globalThis.fetch = realFetch;
  await capture.stopCaptureServer(cap.server);
  try { room.cleanup(); } catch (_e) { /* best-effort */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

  console.log('PASS: ' + passed + ' FAIL: ' + failed);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (err) {
  console.log('FAIL: harness :: ' + (err && err.stack ? err.stack : err));
  console.log('PASS: ' + passed + ' FAIL: ' + (failed + 1));
  process.exit(1);
});
