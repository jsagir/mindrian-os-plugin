#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Regression test for debug session
 * part8-egress-guard-name-class-blocks-unknown-tool-names (2026-10-18).
 *
 * Defect: the Part 8 proper-name rule (lib/core/part8-egress-guard.cjs,
 * _hasUnknownProperName, reached from theoVerdict step 4) reads a capitalized
 * methodology tool name as a person or venture name and blocks the question as
 * room_content / token_class "name". The rule exempts a capitalized phrase only
 * when the phrase is a canonical framework name (data/framework-names.json), a
 * hyphenated compound, an acronym, or sits next to a head noun. A tool that
 * Theo does not know yet (Problem Interview, Opportunity Fitness Check, Five
 * Whys) fails the exemption. The lowercase twin of the same question passes
 * because the rule only inspects TitleCase words.
 *
 * Fix (navigator option B, approved 2026-10-18): three head nouns join
 * METHODOLOGY_HEAD_NOUNS: interview, check, whys. Nothing else changes.
 *
 * Groups:
 *   GROUP A (policy, fixed): the five reported questions that name tools Theo
 *     does not know. They allow after the head-noun widening.
 *   GROUP B (plain bug, OUT OF SCOPE): a Theo framework whose snapshot name
 *     carries an alias in parentheses or after a slash ("Jobs to Be Done
 *     (JTBD)") is exempt only in that exact spelling, so the bare name blocks.
 *     The fix is alias normalization. The navigator did not approve it. The
 *     legs run and are tagged XFAIL with the reason "alias normalization not
 *     approved". They never count as a pass and never fail the run. Filed as
 *     SEED-132.
 *   GROUP C (Canon Part 8 direction): an unrecorded two-word human name must
 *     still block, alone and beside an allowed tool name. GREEN before and
 *     after the fix.
 *   GROUP K (known leak, documented): the widening exempts a person name that
 *     sits within two tokens of a new head noun. The leg prints
 *     KNOWN-UNDER-BLOCK. It never counts as a pass and never fails the run.
 *     Filed as SEED-130. The related lowercase blind spot is SEED-129.
 *
 * Tags: PASS, FAIL, XFAIL (expected failure, skipped), XPASS (an XFAIL leg that
 * now passes; counted as skipped, the marker should be removed),
 * KNOWN-UNDER-BLOCK (a documented leak that is still open).
 *
 * Every string is synthetic. No real room is opened. The fixture room is built
 * in a temp dir. Names are invented pseudonyms.
 *
 * No em-dash or en-dash anywhere (CLAUDE.md HARD RULE). Exit 0 when failed is
 * 0, 1 otherwise, 77 ENV GAP.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// ---- isolation, before any require of plugin code -------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-p8-name-'));
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
  throw new Error('p8 name net guard: network is not allowed in this test');
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

// ---- the questions --------------------------------------------------------
// GROUP A: the five blocked questions, verbatim from the report.
const REPORTED = [
  { id: 'Q2', q: 'When should you use a Problem Interview, and what does it let you distinguish?' },
  { id: 'Q5', q: 'What are the seven lenses of the Opportunity Fitness Check?' },
  { id: 'Q7', q: 'Which chapters teach Five Whys, and for which problem type?' },
  { id: 'Q8', q: 'Which PWS core idea does the Problem Interview serve?' },
  { id: 'Q11', q: 'Are "5 Whys Technique" and "Five Whys Technique" the same framework?' },
];
// The lowercase twin of Q2 passes today; it is the diagnostic from the report.
const LOWERCASE_TWIN = 'when should you use a problem interview, and what does it let you distinguish?';
// The seven control questions from the report. All pass today and must keep passing.
const CONTROLS = [
  'When would a navigator hire a Pre-Mortem, and for what outcome?',
  'What kind of entity is Lean Canvas: a framework, a method, or a canvas/template?',
  'Which techniques make up Scientific Roadmapping?',
  'What primary source supports the steps of Process Mapping?',
  'After a Jobs to Be Done analysis, which tool comes next and what is handed over?',
  'After analyzing a system, which tool finds where it is constrained?',
  'Is OODA for agentic AI a separate framework or a case study of the OODA Loop?',
];

// GROUP C: unrecorded two-word human names (invented). They are NOT in the
// fixture room, so only the proper-name rule can stop them.
const HUMAN_NAMES = [
  { id: 'H1', q: 'Which framework did Marrowby Pell use for the pilot?' },
  { id: 'H2', q: 'What did Marrowby Pell say?' },
  { id: 'H3', q: 'What did Marrowby Pell learn from the Opportunity Fitness Check?' },
  { id: 'H4', q: 'Did Odalys Brennick run the Problem Interview well?' },
  { id: 'H5', q: 'Which tool follows the Five Whys that Kestrel Voss presented?' },
];

// GROUP K: a pseudonym human name beside a head noun that the widening added
// (interview, check, whys). Each string passes the guard today. Each one
// blocked as room_content / name before the widening. Invented names only.
const LEAK_PROBES = [
  { id: 'K-interview', noun: 'interview', q: 'Which framework did Marrowby Pell Interview use?' },
  { id: 'K-check', noun: 'check', q: 'Which question set does Fennick Harlow Check use?' },
  { id: 'K-whys', noun: 'whys', q: 'Which tool follows the Five Whys of Marrowby Pell?' },
  { id: 'K-check-lowercase', noun: 'check (lowercase verb)', q: 'Did Marrowby Pell check the plan?' },
];

// GROUP B: bare forms of snapshot names that carry an alias.
const FRAMEWORK_DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8'));
const ALL_NAMES = [].concat(FRAMEWORK_DATA.framework_names || [], FRAMEWORK_DATA.curated_extras || []);
function bareForm(name) {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').split(/\s+\/\s+/)[0].replace(/\s+/g, ' ').trim();
}
const ALIAS_EXAMPLES = ['Jobs to Be Done (JTBD)', 'Minimum Viable Product / MVP', 'Diffusion of Innovations (Rogers)'];
const XFAIL_REASON = 'alias normalization not approved';

// ---- harness --------------------------------------------------------------
let passed = 0;
let failed = 0;
let skipped = 0;
let knownUnderBlock = 0;
function errText(err) {
  return (err && err.message) ? err.message : String(err);
}
function leg(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (err) {
    failed += 1;
    console.log('FAIL: ' + name + ' :: ' + errText(err));
  }
}
// An out-of-scope leg. It runs, so the evidence stays live, but it never
// counts as a pass and never fails the run.
function xfailLeg(name, reason, fn) {
  try {
    fn();
    skipped += 1;
    console.log('XPASS: ' + name + ' :: ' + reason + ' (the leg now passes; remove the XFAIL marker)');
  } catch (err) {
    skipped += 1;
    console.log('XFAIL: ' + name + ' :: ' + reason);
    console.log('       observed: ' + errText(err));
  }
}
// A documented leak. fn returns the list of probes that still leak. A leak that
// is still open prints KNOWN-UNDER-BLOCK and counts in its own bucket. When no
// probe leaks any more the leak is closed, which is a real pass.
function knownLeakLeg(name, seed, total, fn) {
  let leaking;
  try {
    leaking = fn();
  } catch (err) {
    failed += 1;
    console.log('FAIL: ' + name + ' :: ' + errText(err));
    return;
  }
  if (leaking.length === 0) {
    passed += 1;
    console.log('PASS: ' + name + ' :: the leak is closed, every probe blocks (retire ' + seed + ')');
    return;
  }
  knownUnderBlock += 1;
  console.log('KNOWN-UNDER-BLOCK: ' + name + ' :: ' + seed + ' :: ' + leaking.length + ' of ' + total + ' probe runs pass the guard');
  leaking.forEach(function (l) { console.log('       leaks: ' + l); });
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildFixture() {
  const roomDir = path.join(TMP_ROOMS, 'fixture-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'),
    '---\nventure_name: Brightmoor Kiln\n---\n\n# Fixture room\n', 'utf8');
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    const w = navigation.writeEntityNode(db, {
      entityType: 'company', name: 'Quillfern Labs', sessionId: 'p8name', evidenceTier: 'fallback',
    });
    if (!w || w.ok !== true) throw new Error('fixture write failed');
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

function spawnHook(text, roomDir) {
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_ACTIVE_ROOM;
  if (roomDir) env.CLAUDE_ACTIVE_ROOM = roomDir;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'mcp__plugin_mos_mindrian-brain__brain_ask',
      tool_input: { question: text },
      session_id: 'tp8name',
      cwd: roomDir || ROOT,
    }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
  return { status: r.status, stderr: r.stderr || '' };
}

function main() {
  const roomDir = buildFixture();
  const rooms = [{ label: 'no room', dir: null }, { label: 'fixture room', dir: roomDir }];

  leg('N0: snapshot loaded, fixture room readable, aliases present in the data', function () {
    ok(Array.isArray(guard.CANONICAL_PHRASES) && guard.CANONICAL_PHRASES.length >= 400,
      'CANONICAL_PHRASES has ' + (guard.CANONICAL_PHRASES && guard.CANONICAL_PHRASES.length) + ' entries');
    lexMod._resetLexiconCache();
    const lex = lexMod.loadRoomLexicon(roomDir);
    ok(lex && lex.ok === true, 'fixture room lexicon is not readable');
    ALIAS_EXAMPLES.forEach(function (n) {
      ok(ALL_NAMES.indexOf(n) !== -1, 'alias example missing from data/framework-names.json: ' + n);
    });
  });

  // ---- GROUP A (policy, option B: the head-noun widening) ----
  rooms.forEach(function (r) {
    leg('A1 [' + r.label + ']: the 5 reported questions allow', function () {
      const bad = [];
      REPORTED.forEach(function (p) {
        const v = verdict(p.q, r.dir);
        if (isBlock(v)) bad.push(p.id + ' ' + describe(v));
      });
      ok(bad.length === 0, bad.length + ' of 5 blocked: ' + bad.join('; '));
    });
  });

  leg('A2: the CLI hook agrees on Q2 (exit 0 expected)', function () {
    const h = spawnHook(REPORTED[0].q, roomDir);
    ok(h.status === 0, 'hook exit ' + h.status + ' :: ' + h.stderr.trim().slice(0, 160));
  });

  // ---- GROUP B (plain bug, OUT OF SCOPE: alias normalization not approved) ----
  rooms.forEach(function (r) {
    xfailLeg('B1 [' + r.label + ']: the bare form of an aliased Theo name allows', XFAIL_REASON, function () {
      const bad = [];
      ALIAS_EXAMPLES.forEach(function (n) {
        const bare = bareForm(n);
        const v = verdict('Which tool follows ' + bare + '?', r.dir);
        if (isBlock(v)) bad.push(bare + ' ' + describe(v));
      });
      ok(bad.length === 0, bad.length + ' of ' + ALIAS_EXAMPLES.length + ' blocked: ' + bad.join('; '));
    });
  });

  xfailLeg('B2: every snapshot name that carries an alias allows in its bare form', XFAIL_REASON, function () {
    const bad = [];
    ALL_NAMES.forEach(function (n) {
      const bare = bareForm(n);
      if (bare === n) return;
      const v = verdict('Which tool follows ' + bare + '?', null);
      if (isBlock(v)) bad.push(bare);
    });
    ok(bad.length === 0, bad.length + ' bare forms blocked: ' + bad.join(' | '));
  });

  // ---- GROUP C (Canon Part 8 direction, GREEN before and after the fix) ----
  rooms.forEach(function (r) {
    leg('C1 [' + r.label + ']: controls and the lowercase twin allow', function () {
      const bad = [];
      CONTROLS.concat([LOWERCASE_TWIN]).forEach(function (q) {
        const v = verdict(q, r.dir);
        if (isBlock(v)) bad.push(q.slice(0, 50) + ' ' + describe(v));
      });
      ok(bad.length === 0, bad.length + ' blocked: ' + bad.join('; '));
    });
    leg('C2 [' + r.label + ']: an unrecorded two-word human name still blocks as room_content/name', function () {
      const bad = [];
      HUMAN_NAMES.forEach(function (p) {
        const v = verdict(p.q, r.dir);
        if (!(isBlock(v) && v.class === 'room_content' && v.token_class === 'name')) bad.push(p.id + ' ' + describe(v));
      });
      ok(bad.length === 0, bad.length + ' of ' + HUMAN_NAMES.length + ' not blocked as name: ' + bad.join('; '));
    });
  });

  leg('C3: the CLI hook blocks a human name (exit 2) and names the class, not the token', function () {
    const h = spawnHook(HUMAN_NAMES[0].q, roomDir);
    ok(h.status === 2, 'hook exit ' + h.status);
    ok(/room_content/.test(h.stderr) && /name/.test(h.stderr), 'stderr lacks the class: ' + h.stderr.trim().slice(0, 160));
    ok(!/Marrowby|Pell/.test(h.stderr), 'stderr echoes the name');
  });

  // ---- GROUP K (known leak created by the widening, documented) ----
  // SEED-130: a person name within two tokens of a head noun is exempt, and
  // the nouns interview, check and whys widen that. "check" and "interview"
  // are also plain English words, and the head-noun match is case-blind, so a
  // lowercase verb exempts the name beside it. SEED-129 holds the older blind
  // spot of the same rule: a lowercased person name is never inspected.
  knownLeakLeg('K1: a pseudonym human name beside a new head noun passes the guard', 'SEED-130', LEAK_PROBES.length * rooms.length, function () {
    const leaking = [];
    LEAK_PROBES.forEach(function (p) {
      rooms.forEach(function (r) {
        const v = verdict(p.q, r.dir);
        if (!isBlock(v)) leaking.push(p.id + ' [' + r.label + '] new noun: ' + p.noun + ' :: ' + p.q);
      });
    });
    return leaking;
  });

  leg('C4: no network call was made', function () {
    ok(fetchCalls === 0, 'fetch was called ' + fetchCalls + ' times');
  });

  console.log('');
  console.log('p8 name-class methodology names: ' + passed + ' passed, ' + failed + ' failed, ' +
    skipped + ' skipped, ' + knownUnderBlock + ' known-under-block');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main();
