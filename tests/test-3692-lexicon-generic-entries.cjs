#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261012-sbz -- the Part 8 room lexicon must not keep entries made only
 * of methodology words.
 * Debug session: part8-egress-guard-room-lexicon-false-positive-blocks-theo.
 *
 * Decision D-S1 (navigator, 2026-10-12): at lexicon build time, drop a
 * room_term or room_file entry when every one of its tokens is in the union of
 * the tokens of CANONICAL_PHRASES, COMMAND_SLUG_SET, METHODOLOGY_TOKEN_SET,
 * QUESTION_FUNCTION_WORDS and the CORE_SECTIONS slugs and labels. Claim,
 * person, venture_name and room_name entries are not touched.
 *
 * Legs:
 *   L0  fixture validity (generic names are inside the union; retention names
 *       have a token outside it; the framework-names snapshot is large enough)
 *   L1  lexicon build on the fixture (no generic entry; the right kind counts;
 *       the _genericTokenSet seam equals the union)
 *   L2  the 26 methodology questions allow with the fixture room bound
 *   L3  the same 26 allow with no room bound
 *   L4  retention: real room content still blocks (person, company, venture,
 *       claim, one-word institution)
 *   L5  the "solar cold locker" sentence blocks with the room bound
 *   L6  the 10 negatives block with the room bound and with no room bound
 *   L7  the CLI PreToolUse hook agrees with the in-process classify
 *   L8  no network call was made
 *
 * Tri-Polar: one classify function (lib/core/part8-egress-guard.cjs) serves the
 * CLI PreToolUse hook and the in-process brain-client belt that the MCP server
 * uses on Desktop and Cowork. L2 to L6 call that function in process. L7 spawns
 * the hook.
 *
 * Every string in this file is synthetic. No real room is opened. The fixture
 * room is built in a temp dir.
 *
 * No em-dash or en-dash anywhere (CLAUDE.md HARD RULE). Exit 0 pass, 1 fail,
 * 77 ENV GAP.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// ---- isolation, before any require of plugin code -------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos3692-lexgen-'));
const TMP_HOME = path.join(TMP, 'home');
const TMP_ROOMS = path.join(TMP, 'rooms');
fs.mkdirSync(TMP_HOME, { recursive: true });
fs.mkdirSync(TMP_ROOMS, { recursive: true });
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = TMP_ROOMS;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.TAVILY_API_KEY;
delete process.env.OPENALEX_API_KEY;

let fetchCalls = 0;
globalThis.fetch = function noNetwork() {
  fetchCalls += 1;
  throw new Error('lexgen net guard: network is not allowed in this test');
};

try {
  require('node:sqlite');
} catch (_e) {
  console.log('SKIP: node:sqlite unavailable (ENV GAP)');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e2) { /* best-effort */ }
  process.exit(77);
}

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const lexMod = require(path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
const { CORE_SECTIONS } = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));

// ---- the questions --------------------------------------------------------
// The 6 named methodology questions and the 20 derived ones follow the debug
// corpus (stride 20 over data/framework-names.json, 4 templates).
const NAMED = [
  "which framework tests a business model's riskiest assumption first",
  'how does the lean canvas relate to the value proposition canvas',
  'what is the difference between an ill-defined and a wicked problem',
  'which framework comes after jobs to be done in the PWS sequence',
  'explain dominant design',
  'what does customer segment mean in the lean canvas',
];
const TEMPLATES = [
  function (x) { return 'explain ' + x; },
  function (x) { return 'when should I use ' + x; },
  function (x) { return 'what is ' + x + ' and how does it work'; },
  function (x) { return 'which problem type fits ' + x; },
];
const FRAMEWORK_NAMES = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8')
).framework_names;

function buildPositives() {
  const out = NAMED.map(function (q, i) { return { id: 'N' + (i + 1), q: q }; });
  for (let k = 0; k < 20; k += 1) {
    const name = FRAMEWORK_NAMES[10 + k * 20];
    out.push({ id: 'D' + (k + 1), q: TEMPLATES[k % TEMPLATES.length](name) });
  }
  return out;
}
const POSITIVES = buildPositives();

// 10 strings that MUST be refused. Invented names, ids and keys only.
const NEGATIVES = [
  { id: 'X1', cls: 'content_set', q: 'Orla Venn said her company reached $4.2M revenue last quarter, which framework fits?' },
  { id: 'X2', cls: 'room_content', tc: 'private_context', q: 'our startup pivoted to selling to hospitals, which framework fits that move' },
  { id: 'X3', cls: 'content_set', q: 'which framework should orla.venn@fennickrobotics.example use for pricing' },
  { id: 'X4', cls: 'room_content', tc: 'identifier', q: 'explain the lean canvas AKIAIOSFODNN7EXAMPLE framework' },
  { id: 'X5', cls: 'content_set', q: 'Fennick Robotics plans to sell the Thessaly gripper to Harbor Quill Partners after the Tuesday pilot' },
  { id: 'X6', cls: 'room_content', tc: 'identifier', q: 'what framework applies to artifact MOS2026X7 in the pricing section' },
  { id: 'X7', cls: 'room_content', tc: 'private_context', q: 'this is confidential: which framework tests the riskiest assumption' },
  { id: 'X8', cls: 'content_set', q: 'which framework helps when the budget is $750K' },
  { id: 'X9', cls: 'content_set', q: 'on 14 March 2026 Fennick Robotics Ltd signed the term sheet, which framework fits' },
  { id: 'X10', cls: 'room_content', tc: 'private_context', q: 'which framework fits my customers and my pricing' },
];

// Retention: real room content must still block.
const CLAIM_TEXT = 'Larkspur depots cut chiller downtime by forty percent after the retrofit';
const RETENTION = [
  { id: 'R1', q: 'which framework fits Tamsin Rourke', tc: 'person' },
  { id: 'R2', q: 'which framework fits Quillfern Labs', tc: 'room_term' },
  { id: 'R3', q: 'which framework fits Brightmoor Kiln', tc: 'venture_name' },
  { id: 'R4', q: CLAIM_TEXT, tc: 'claim' },
  { id: 'R5', q: 'which framework fits Veldmark', tc: 'room_term' },
];
const LEX_SENTENCE = 'How should I validate the solar cold locker with resellers?';

// Generic fixture names: every token must sit in the union.
const GENERIC_COMPANIES = ['Design', 'Value', 'Customer', 'Canvas', 'Strategy', 'Innovation', 'Model',
  'Market', 'Lean', 'Business', 'Proposition', 'Dominant', 'Loop', 'Diagrams', 'Theory', 'Solution',
  'Options', 'Trends'];
const GENERIC_TECH = ['Value Proposition', 'Business Model', 'Innovation Management', 'Real Options',
  'Three Horizons', 'Stock Flow', 'Technology Adoption', 'Decision Pods', 'Search Gradient',
  'Problem Taxonomy', 'Design Strategy', 'Customer Value'];

// ---- harness --------------------------------------------------------------
let passed = 0;
let failed = 0;
function leg(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (err) {
    failed += 1;
    console.log('FAIL: ' + name + ' :: ' + ((err && err.message) ? err.message : String(err)));
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

function tokenize(s) {
  return String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (t) { return t.length > 0; });
}

function computeUnion() {
  const u = new Set();
  function add(v) { tokenize(v).forEach(function (t) { u.add(t); }); }
  (guard.CANONICAL_PHRASES || []).forEach(add);
  Array.from(guard.COMMAND_SLUG_SET).forEach(add);
  Array.from(guard.METHODOLOGY_TOKEN_SET).forEach(add);
  Array.from(guard.QUESTION_FUNCTION_WORDS).forEach(add);
  Object.keys(CORE_SECTIONS).forEach(function (slug) {
    add(slug);
    add(CORE_SECTIONS[slug].label);
  });
  return u;
}

// ---- the fixture room -----------------------------------------------------
function buildFixture() {
  const roomDir = path.join(TMP_ROOMS, 'fixture-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'),
    '---\nventure_name: Brightmoor Kiln\n---\n\n# Fixture room\n', 'utf8');
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    function must(res, what) {
      if (!res || res.ok !== true) throw new Error('fixture write failed: ' + what);
    }
    Object.keys(CORE_SECTIONS).forEach(function (slug) {
      insertNode(db, 'artifact:sbz:' + slug, 'Artifact',
        JSON.stringify({ title: slug, section: slug }), { epistemic_type: 'observation' });
    });
    GENERIC_COMPANIES.forEach(function (n) {
      must(navigation.writeEntityNode(db, { entityType: 'company', name: n, sessionId: 'sbz', evidenceTier: 'fallback' }), n);
    });
    GENERIC_TECH.forEach(function (n) {
      must(navigation.writeEntityNode(db, { entityType: 'technology', name: n, sessionId: 'sbz', evidenceTier: 'fallback' }), n);
    });
    insertNode(db, 'person:sbz:tamsin', 'person', JSON.stringify({ name: 'Tamsin Rourke' }),
      { epistemic_type: 'extracted_fact' });
    must(navigation.writeEntityNode(db, { entityType: 'company', name: 'Quillfern Labs', sessionId: 'sbz', evidenceTier: 'fallback' }), 'Quillfern Labs');
    insertNode(db, 'organization:sbz:veldmark', 'organization', JSON.stringify({ name: 'Veldmark' }),
      { epistemic_type: 'extracted_fact' });
    must(navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: CLAIM_TEXT, sessionId: 'sbz', sourceSegment: 'seg-sbz-1',
    }), 'claim');
    must(navigation.writeEntityNode(db, { entityType: 'technology', name: 'solar cold locker', sessionId: 'sbz', evidenceTier: 'fallback' }), 'solar cold locker');
  } finally {
    closeRoomDb(db);
  }
  return roomDir;
}

function verdict(q, roomDir) {
  lexMod._resetLexiconCache();
  return guard.classify({ question: q }, { toolName: 'brain_ask', roomDir: roomDir });
}
function describe(v) {
  return 'verdict=' + (v && v.verdict) + ' class=' + (v && v.class) + ' token_class=' + (v && v.token_class);
}
function isBlock(v) {
  return !!v && v.verdict === 'block';
}

function spawnHook(text, roomEnv) {
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_ACTIVE_ROOM;
  if (roomEnv) env.CLAUDE_ACTIVE_ROOM = roomEnv;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'mcp__plugin_mos_mindrian-brain__brain_ask',
      tool_input: { question: text },
      session_id: 'tlexgen',
      cwd: roomEnv || ROOT,
    }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
  return { status: r.status, stderr: r.stderr || '' };
}

function main() {
  const U = computeUnion();
  const roomDir = buildFixture();

  leg('L0: fixture validity, generic names inside the union, retention names outside, snapshot size', function () {
    GENERIC_COMPANIES.concat(GENERIC_TECH, Object.keys(CORE_SECTIONS)).forEach(function (n) {
      tokenize(n).forEach(function (t) {
        ok(U.has(t), 'generic fixture name has a token outside the union: ' + n + ' / ' + t);
      });
    });
    ['Tamsin Rourke', 'Quillfern Labs', 'Veldmark', 'solar cold locker'].forEach(function (n) {
      ok(tokenize(n).some(function (t) { return !U.has(t); }), 'retention name has no token outside the union: ' + n);
    });
    ok(Array.isArray(FRAMEWORK_NAMES) && FRAMEWORK_NAMES.length >= 391,
      'framework_names has ' + (FRAMEWORK_NAMES && FRAMEWORK_NAMES.length) + ' entries, expected 391 or more');
    ok(POSITIVES.length === 26, 'positives count ' + POSITIVES.length);
  });

  leg('L1: lexicon build keeps no generic-only entry and keeps the room specific entries', function () {
    lexMod._resetLexiconCache();
    const lex = lexMod.loadRoomLexicon(roomDir);
    ok(lex && lex.ok === true, 'loadRoomLexicon(fixture).ok is not true');
    const slugs = new Set(Object.keys(CORE_SECTIONS));
    const generic = new Set(GENERIC_COMPANIES.concat(GENERIC_TECH).map(function (n) { return n.toLowerCase(); }));
    const counts = {};
    lex.entries.forEach(function (e) {
      counts[e.kind] = (counts[e.kind] || 0) + 1;
      ok(!(e.kind === 'room_file' && slugs.has(e.text)), 'room_file entry titled with a core section slug is kept: ' + e.text);
      ok(!(e.kind === 'room_term' && generic.has(e.text.toLowerCase())), 'room_term entry made of generic words is kept: ' + e.text);
    });
    const want = { person: 1, venture_name: 1, claim: 1, room_name: 1, room_term: 3, room_file: 0 };
    Object.keys(want).forEach(function (k) {
      ok((counts[k] || 0) === want[k], 'kind ' + k + ' count ' + (counts[k] || 0) + ', expected ' + want[k]);
    });
    ok(typeof lexMod._genericTokenSet === 'function', '_genericTokenSet is not an exported function');
    const gs = lexMod._genericTokenSet();
    ok(gs instanceof Set && gs.size === U.size, '_genericTokenSet size ' + (gs && gs.size) + ', union size ' + U.size);
    U.forEach(function (t) { ok(gs.has(t), '_genericTokenSet misses union token ' + t); });
  });

  leg('L2: the 26 methodology questions allow with the fixture room bound', function () {
    const bad = [];
    POSITIVES.forEach(function (p) {
      const v = verdict(p.q, roomDir);
      if (isBlock(v)) bad.push(p.id + ' ' + describe(v));
    });
    ok(bad.length === 0, bad.length + ' of 26 blocked: ' + bad.join('; '));
  });

  leg('L3: the 26 methodology questions allow with no room bound', function () {
    const bad = [];
    POSITIVES.forEach(function (p) {
      const v = verdict(p.q, null);
      if (isBlock(v)) bad.push(p.id + ' ' + describe(v));
    });
    ok(bad.length === 0, bad.length + ' of 26 blocked: ' + bad.join('; '));
  });

  leg('L4: retention, real room content still blocks with the right token class', function () {
    RETENTION.forEach(function (r) {
      const v = verdict(r.q, roomDir);
      ok(isBlock(v) && v.class === 'room_content' && v.token_class === r.tc,
        r.id + ' expected room_content/' + r.tc + ', got ' + describe(v));
    });
  });

  leg('L5: the solar cold locker sentence blocks with the room bound and allows with none', function () {
    const bound = verdict(LEX_SENTENCE, roomDir);
    ok(isBlock(bound) && bound.class === 'room_content' && bound.token_class === 'room_term',
      'bound: ' + describe(bound));
    const none = verdict(LEX_SENTENCE, null);
    ok(!isBlock(none), 'no room bound: ' + describe(none));
  });

  leg('L6: the 10 negatives block with the room bound and with no room bound', function () {
    const bad = [];
    [roomDir, null].forEach(function (rd) {
      NEGATIVES.forEach(function (n) {
        const v = verdict(n.q, rd);
        const good = isBlock(v) && v.class === n.cls && (!n.tc || v.token_class === n.tc);
        if (!good) bad.push((rd ? 'bound ' : 'unbound ') + n.id + ' expected ' + n.cls + (n.tc ? '/' + n.tc : '') + ', got ' + describe(v));
      });
    });
    ok(bad.length === 0, bad.join('; '));
  });

  leg('L7: the CLI hook agrees with classify (generic allows, room content blocks)', function () {
    lexMod._resetLexiconCache();
    const n1 = spawnHook(NAMED[0], roomDir);
    ok(n1.status === 0, 'N1 hook exit ' + n1.status + ', expected 0');
    const n5 = spawnHook(NAMED[4], roomDir);
    ok(n5.status === 0, 'N5 hook exit ' + n5.status + ', expected 0');
    const person = spawnHook(RETENTION[0].q, roomDir);
    ok(person.status === 2, 'person question hook exit ' + person.status + ', expected 2');
    const x2 = spawnHook(NEGATIVES[1].q, roomDir);
    ok(x2.status === 2, 'X2 hook exit ' + x2.status + ', expected 2');
  });

  leg('L8: no network call was made', function () {
    ok(fetchCalls === 0, 'fetch was called ' + fetchCalls + ' times');
  });

  console.log('PASS: ' + passed + ' FAIL: ' + failed);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main();
