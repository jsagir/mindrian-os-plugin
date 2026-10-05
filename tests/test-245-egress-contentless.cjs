#!/usr/bin/env node
'use strict';

/*
 * Phase 245-03 (R5 / F-4, F-5) -- the Part 8 contentless-payload fix, pinned at
 * BOTH levels.
 *
 * WHY TWO LEGS. A unit-only test on classify() is the mutation-blind shape the
 * Phase 244 verifier flagged: the classifier can return the right verdict while
 * the production hook still blocks, because the hook is what translates
 * 'ambiguous' + brainAvailable() into exit 2. So this file drives:
 *
 *   LEG 1 (unit): lib/core/part8-egress-guard.cjs::classify() directly.
 *   LEG 2 (hook): scripts/part8-egress-guard-hook.cjs as a child process with a
 *                 synthetic PreToolUse envelope on stdin and
 *                 PART8_FORCE_BRAIN_AVAILABLE=1, so the BLOCK branch is
 *                 deterministically reachable with no live Brain wire.
 *
 * WHAT IS BEING PROVEN, in one line each:
 *   - A zero-key payload ({}) classifies as allow / empty_payload and passes
 *     the hook with exit 0. This unblocks brain-client.cjs:575
 *     callTool('brain_stats', {}) and :488 callTool('brain_schema', {}).
 *   - Anything carrying a byte still falls to the UNCHANGED fail-closed
 *     catch-all: {a:1}, {question:''}, [], null, undefined all stay ambiguous.
 *   - A CONTENT-SET payload still blocks, at both the classifier and the hook.
 *
 * The hook leg's scoped tool names are DERIVED at run time from
 * scripts/check-brain-tool-liveness.cjs (the same authority
 * tests/part8-egress-guard-hook.test.cjs uses), never hand-typed: the hook
 * calls sanitizer.isBrainTool(toolName) BEFORE classify(), so a bare name would
 * allow() before the classifier ever runs and the test would pass vacuously.
 *
 * Zero-dep: node assert + child_process. CJS only. NO em-dashes.
 *
 * License: BSL 1.1.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');

const guard = require(GUARD);

const STATS_TOOL = 'mcp__plugin_mos_mindrian-brain__brain_stats';
const SCHEMA_TOOL = 'mcp__plugin_mos_mindrian-brain__brain_schema';

let checks = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

// ---------------------------------------------------------------------------
// 369.2-07 (CODE-07, 2026-10-05): the plain-question-green and the
// room-content-red legs. A free-form Theo string is allow or block by content,
// never ambiguous. The room fixture is built through lib/core/navigation.cjs
// (never raw SQL) under os.tmpdir(); the lexicon term is invented, so only the
// bound-room lexicon can block it. legs369207 returns [ok, message] pairs so
// each suite reports through its own assertion style.
// ---------------------------------------------------------------------------
const PLAIN_QUESTION_369207 = 'How do I decide which customer segment to pursue first?';
const ROOM_TERM_369207 = 'solar cold locker';
const ROOM_QUESTION_369207 = 'How should I validate the ' + ROOM_TERM_369207 + ' with resellers?';
const CANARY_369207 = 'CANARY7F3A2B';

function buildLexiconRoom369207() {
  const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
  const nav = require('../lib/core/navigation.cjs');
  const roomDbMod = require('../lib/core/room-db.cjs');
  const room = buildRoom363({});
  const db = roomDbMod.openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const w = nav.writeEntityNode(db, { entityType: 'technology', name: ROOM_TERM_369207, sessionId: 's3692-07' });
    if (!w || w.ok !== true) throw new Error('369.2-07 fixture: writeEntityNode failed ' + JSON.stringify(w));
  } finally {
    roomDbMod.closeRoomDb(db);
  }
  return room;
}

function spawnHook369207(hookPath, toolName, question, roomDir) {
  const env = Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  delete env.CLAUDE_ACTIVE_ROOM;
  if (roomDir) env.CLAUDE_ACTIVE_ROOM = roomDir;
  const r = require('node:child_process').spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { question: question }, session_id: 't3692-07', cwd: roomDir || process.cwd() }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
  return { status: r.status, stderr: r.stderr || '' };
}

function legs369207(guard, hookPath, askTool) {
  const out = [];
  function t(cond, msg) { out.push([!!cond, msg]); }
  const room = buildLexiconRoom369207();
  try {
    // plain methodology question allowed (369.2 CODE-07)
    const plain = guard.classify({ question: PLAIN_QUESTION_369207 }, { toolName: askTool });
    t(plain && plain.verdict === 'allow' && (plain.class === 'typed_question' || plain.class === 'generic_question'),
      'plain methodology question allowed (369.2 CODE-07): classify got ' + JSON.stringify(plain));
    const plainHook = spawnHook369207(hookPath, askTool, PLAIN_QUESTION_369207, null);
    t(plainHook.status === 0,
      'plain methodology question allowed (369.2 CODE-07): hook exit 0, got ' + plainHook.status + ' stderr=' + JSON.stringify(plainHook.stderr));

    // room content blocked (369.2 CODE-07)
    const roomV = guard.classify({ question: ROOM_QUESTION_369207 }, { toolName: askTool, roomDir: room.roomDir });
    t(roomV && roomV.verdict === 'block' && roomV.class === 'room_content' && roomV.token_class === 'room_term',
      'room content blocked (369.2 CODE-07): bound-room term must block room_content/room_term, got ' + JSON.stringify(roomV));
    const roomHook = spawnHook369207(hookPath, askTool, ROOM_QUESTION_369207, room.roomDir);
    t(roomHook.status === 2 && roomHook.stderr.trim().length > 0,
      'room content blocked (369.2 CODE-07): hook exit 2 with stderr, got ' + roomHook.status + ' stderr=' + JSON.stringify(roomHook.stderr));
    t(roomHook.stderr.toLowerCase().indexOf(ROOM_TERM_369207) === -1,
      'room content blocked (369.2 CODE-07): the refusal must not echo the room term, got ' + JSON.stringify(roomHook.stderr));
    const canaryQ = 'Which framework fits ' + CANARY_369207 + '?';
    const canaryV = guard.classify({ question: canaryQ }, { toolName: askTool, roomDir: null });
    t(canaryV && canaryV.verdict === 'block' && canaryV.token_class === 'identifier',
      'room content blocked (369.2 CODE-07): ' + CANARY_369207 + ' must block with token_class identifier, got ' + JSON.stringify(canaryV));
    const canaryHook = spawnHook369207(hookPath, askTool, canaryQ, null);
    t(canaryHook.status === 2, 'room content blocked (369.2 CODE-07): ' + CANARY_369207 + ' hook exit 2, got ' + canaryHook.status);
  } finally {
    room.cleanup();
  }
  return out;
}

function verdictOf(payload, toolName) {
  return guard.classify(payload, { toolName: toolName });
}

function expectVerdict(payload, toolName, wantVerdict, wantClass, label) {
  const r = verdictOf(payload, toolName);
  ok(
    r && r.verdict === wantVerdict,
    label + ': expected verdict "' + wantVerdict + '", got ' + JSON.stringify(r)
  );
  if (wantClass) {
    ok(
      r.class === wantClass,
      label + ': expected class "' + wantClass + '", got ' + JSON.stringify(r)
    );
  }
  return r;
}

// ---------------------------------------------------------------------------
// LEG 1: the unit verdicts.
// ---------------------------------------------------------------------------
function unitLeg() {
  console.log('--- LEG 1: classify() unit verdicts ---');

  // The fix itself: the two shipped contentless callers.
  expectVerdict({}, STATS_TOOL, 'allow', 'empty_payload', 'brain_stats {}');
  expectVerdict({}, SCHEMA_TOOL, 'allow', 'empty_payload', 'brain_schema {}');

  // The recognizer is PAYLOAD-shaped, not tool-scoped, and that is deliberate.
  // Asserted so the behavior is a decision on record, not an accident.
  expectVerdict({}, 'Write', 'allow', 'empty_payload', 'non-Brain tool {}');
  expectVerdict({}, '', 'allow', 'empty_payload', 'empty tool name {}');

  // Fail-closed: a missing envelope field is NOT an explicitly empty object.
  expectVerdict(undefined, STATS_TOOL, 'ambiguous', 'unknown', 'undefined payload');
  ok(
    verdictOf(undefined, STATS_TOOL).reason === 'non-object payload',
    'undefined payload must keep the "non-object payload" reason'
  );
  expectVerdict(null, STATS_TOOL, 'ambiguous', 'unknown', 'null payload');

  // Spoofing guard (T-245-12): an empty ARRAY is not a plain object.
  expectVerdict([], STATS_TOOL, 'ambiguous', 'unknown', 'empty array payload');

  // Any key at all falls through to the UNCHANGED catch-all.
  expectVerdict({ a: 1 }, STATS_TOOL, 'ambiguous', 'unknown', '{a:1}');
  expectVerdict({ question: '' }, STATS_TOOL, 'ambiguous', 'unknown', "{question:''}");
  expectVerdict({ topK: 5 }, SCHEMA_TOOL, 'ambiguous', 'unknown', '{topK:5}');

  // The default-deny scan still runs FIRST and still blocks (T-245-11).
  expectVerdict(
    { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    'mcp__plugin_mos_mindrian-brain__brain_query',
    'block',
    'content_set',
    'CONTENT-SET payload'
  );

  // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by content, never ambiguous.
  // History: 354-06 (D-354-EGR) made 'pottery kiln methodology' ambiguous
  // (freeform_unproven) because 'pottery' and 'kiln' are not closed-vocabulary
  // tokens; before that it was 'allow' / 'move_set'. Under the one-verdict
  // model the string carries no room-local token (no CONTENT-SET hit, no
  // lexicon term, no identifier, no private-venture context), so it is a plain
  // methodology question: allow, class generic_question. Room content is still
  // blocked by the legs added in 369.2-07 (legs369207 at LEG 2).
  // Quick 261001-lsd re-pin: the fixture used to be 'lean startup methodology',
  // but 355-08 (f55f004f6) regenerated data/framework-names.json and 'lean
  // startup' became a canonical framework phrase, so that payload now proves
  // closed-vocabulary and is correctly allowed. 'pottery' and 'kiln' are
  // absent from data/ (grep-verified), keeping this the unproven-token case.
  expectVerdict(
    { question: 'pottery kiln methodology' },
    'mcp__plugin_mos_mindrian-brain__brain_ask',
    'allow',
    'generic_question',
    'brain_ask methodology question (no room-local token)'
  );

  // Quick task 260807-h5s is the reversal authority: the Phase 245 D-28 FLAGGED
  // disposition (brain_search deliberately left out of _isFreeFormTool) was
  // REVERSED with navigator approval, so the inverse assertion that used to sit
  // here is replaced by its positive twin.
  ok(
    guard._isFreeFormTool('mcp__plugin_mos_mindrian-brain__brain_search') === true,
    'quick 260807-h5s: _isFreeFormTool must now recognize a scoped brain_search name'
  );

  // The recognizer is exported as a test seam.
  ok(
    typeof guard._isProvablyEmptyPayload === 'function',
    '_isProvablyEmptyPayload must be exported alongside the other test seams'
  );
  ok(guard._isProvablyEmptyPayload({}) === true, '_isProvablyEmptyPayload({}) must be true');
  ok(guard._isProvablyEmptyPayload([]) === false, '_isProvablyEmptyPayload([]) must be false');
  ok(guard._isProvablyEmptyPayload(null) === false, '_isProvablyEmptyPayload(null) must be false');
  ok(
    guard._isProvablyEmptyPayload(undefined) === false,
    '_isProvablyEmptyPayload(undefined) must be false'
  );
  ok(
    guard._isProvablyEmptyPayload({ a: 1 }) === false,
    '_isProvablyEmptyPayload({a:1}) must be false'
  );

  console.log('LEG 1 ok (' + checks + ' assertions)');
}

// ---------------------------------------------------------------------------
// LEG 2: the production hook chain.
// ---------------------------------------------------------------------------
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

async function hookLeg() {
  console.log('--- LEG 2: part8-egress-guard-hook.cjs child-process exit codes ---');

  if (!fs.existsSync(HOOK)) {
    console.log('SKIP: scripts/part8-egress-guard-hook.cjs absent');
    return;
  }

  // Derive live SCOPED names from the shipped liveness authority. The hook
  // calls isBrainTool() before classify(), so a bare name allows vacuously.
  const liveness = require('../scripts/check-brain-tool-liveness.cjs');
  const enumeration = await liveness.enumerateLiveBrainTools();
  ok(
    enumeration.names && enumeration.names.length > 0,
    'setup: enumerateLiveBrainTools must return at least one live bare tool name'
  );
  const allScoped = liveness.composeScopedNames(
    enumeration.names,
    liveness.resolvePluginName(),
    liveness.resolveServerName()
  );
  function scopedContaining(bare) {
    const hit = allScoped.find(function (n) {
      return n.indexOf('mcp__plugin_') === 0 && n.indexOf(bare) !== -1;
    });
    ok(!!hit, 'setup: no live plugin-scoped name found containing "' + bare + '"');
    return hit;
  }
  const statsScoped = scopedContaining('brain_stats');
  const queryScoped = scopedContaining('brain_query');

  // Case A: the contentless call the fix exists to unblock -> exit 0, no gate.
  const contentless = JSON.stringify({
    tool_name: statsScoped,
    tool_input: {},
    session_id: 'p245-03-a',
  });
  const a = runHook(contentless, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(
    a.status === 0,
    'HOOK A: contentless brain_stats must exit 0 even with Brain available, got ' + a.status +
      ' stderr=' + JSON.stringify(a.stderr)
  );
  ok(
    !/part 8/i.test(a.stderr),
    'HOOK A: contentless call must render NO leak-prevention gate, got stderr=' +
      JSON.stringify(a.stderr)
  );

  // Case B: a content-carrying payload must still block -> exit 2 + gate text.
  const contentful = JSON.stringify({
    tool_name: queryScoped,
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 'p245-03-b',
  });
  const b = runHook(contentful, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(
    b.status === 2,
    'HOOK B: content-carrying Brain payload must still exit 2 (block), got ' + b.status
  );
  ok(
    b.stderr && b.stderr.trim().length > 0,
    'HOOK B: a block must carry gate text on stderr'
  );

  // Research Assumption A1: record which branch actually fired by printing the
  // verbatim first stderr line of the blocking case.
  const firstLine = (b.stderr.split('\n')[0] || '').trim();
  console.log('A1 EVIDENCE (CONTENT-SET block, stderr line 1): ' + firstLine);

  // Case C: the AMBIGUOUS branch, which is the one a pre-fix contentless
  // brain_stats fell into. Driving it with a payload that carries a key (so
  // the new recognizer cannot claim it) still reaches the SAME classifier
  // catch-all (step 4 still returns ambiguous / unknown -- "catch-all
  // untouched" is still true at the classifier). What changed (quick task
  // 260917-dgf) is the hook's DISPOSITION of that verdict: statsScoped is a
  // TRUSTED plugin scope, so an ambiguous/unknown verdict now proceeds to
  // the shim (exit 0) instead of blocking. The stderr print is guarded so it
  // does not crash on the now-empty stderr of an allow.
  const ambiguous = JSON.stringify({
    tool_name: statsScoped,
    tool_input: { a: 1 },
    session_id: 'p245-03-c',
  });
  const c = runHook(ambiguous, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  ok(
    c.status === 0,
    '260917-dgf: an ambiguous/unknown payload on a TRUSTED scope must exit 0 (proceeds to the shim; classifier catch-all still untouched), got ' +
      c.status
  );
  const ambigLine = ((c.stderr || '').split('\n')[0] || '').trim();
  console.log('A1 EVIDENCE (ambiguous disposition, stderr line 1): ' + (ambigLine || '(empty -- allowed, no stderr)'));

  // Case D: the same contentless call with Brain UNAVAILABLE stays exit 0.
  const d = runHook(contentless, { PART8_FORCE_BRAIN_AVAILABLE: '0' });
  ok(d.status === 0, 'HOOK D: contentless call must exit 0 Brain-less too, got ' + d.status);

  // 369.2-07 (CODE-07, 2026-10-05): plain question green, room content red.
  legs369207(guard, HOOK, scopedContaining('brain_ask')).forEach(function (r) { ok(r[0], r[1]); });

  console.log('LEG 2 ok (' + checks + ' assertions cumulative)');
}

async function main() {
  unitLeg();
  await hookLeg();
  console.log('PASS: test-245-egress-contentless (unit leg + hook leg, ' + checks + ' assertions)');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
