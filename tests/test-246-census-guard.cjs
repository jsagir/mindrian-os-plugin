#!/usr/bin/env node
'use strict';

/*
 * Phase 246-02 - Claim (c) extension, re-pinned for D-354-EGR (354-06).
 *
 * WHAT THIS PROVES. Every census Cypher string (scripts/build-brain-census.cjs
 * CENSUS_QUERIES) is content-free at the Part 8 egress boundary:
 *   1. scanForContent() (the default-deny CONTENT-SET scan, the actual
 *      boundary) reports no hit,
 *   2. classify() never returns 'block' and never falls back to
 *      'freeform_unmatched' (the vocabulary-regression tripwire this file has
 *      always carried),
 *   3. the verdict is the documented post-354-06 contract: ambiguous /
 *      freeform_unproven. Since commit 8f87980e5 "generic" means structurally
 *      proven against a closed NATURAL-LANGUAGE vocabulary; Cypher keywords
 *      (MATCH, RETURN, a variable name) are outside it, so no Cypher string
 *      classifies allow. This is intentional (test-239 LEG 4: the template
 *      laundering canary is the same class). Pinning the exact class means a
 *      future change that widens or narrows it turns this red and gets a
 *      conscious review, instead of drifting.
 *   4. the live disposition on the shim-backed scope is unchanged: the
 *      PreToolUse hook exits 0 for every census string (the shim, then
 *      brain-client.cjs, still carries it with an additive egress_disclosure).
 *   5. a NEGATIVE CONTROL: a Cypher string with embedded user content still
 *      classifies block, so this file can fail.
 *
 * The census builder itself never calls classify(): it POSTs through its own
 * brainCall() fetch, so the live census run is independent of this verdict.
 *
 * CJS, node assert only. No em-dashes.
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const builder = require(path.join(ROOT, 'scripts', 'build-brain-census.cjs'));
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');

const PLUGIN_SCOPED_QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';

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

function hookExit(cypher) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: PLUGIN_SCOPED_QUERY, tool_input: { cypher: cypher }, session_id: 'test-246-census' }),
    encoding: 'utf8',
    timeout: 10000,
    cwd: os.tmpdir(),
    env: Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' }),
  });
  return res.status;
}

function main() {
  console.log('--- test-246-census-guard: every CENSUS_QUERIES string is content-free at the Part 8 boundary ---');

  const queries = builder.CENSUS_QUERIES;
  ok(Array.isArray(queries) && queries.length > 0, 'CENSUS_QUERIES must be a non-empty array');

  const requiredIds = ['C1', 'C2', 'C2a', 'C2b', 'C2c', 'C2d', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const ids = queries.map((q) => q.id);
  for (const id of requiredIds) {
    ok(ids.includes(id), 'CENSUS_QUERIES must include id ' + id + ', got ' + JSON.stringify(ids));
  }

  for (const q of queries) {
    const label = 'entry ' + q.id + ' (' + (q.sub || '') + ')';
    ok(typeof q.cypher === 'string' && q.cypher.length > 0, label + ' must carry a non-empty cypher string');

    // 1. The actual boundary: default-deny CONTENT-SET scan.
    const scan = guard.scanForContent({ cypher: q.cypher });
    ok(scan.hit === false, label + ' must carry no CONTENT-SET pattern, got ' + JSON.stringify(scan));

    // 2 + 3. Verdict contract, each asserted EXPLICITLY (never folded).
    const verdict = guard.classify({ cypher: q.cypher }, { toolName: PLUGIN_SCOPED_QUERY });
    ok(verdict.verdict !== 'block', label + ' must never classify block, got ' + JSON.stringify(verdict));
    ok(
      verdict.class !== 'freeform_unmatched',
      label + ' must not fall back to freeform_unmatched (vocabulary regression), got ' + JSON.stringify(verdict)
    );
    ok(
      verdict.verdict === 'ambiguous' && verdict.class === 'freeform_unproven',
      label + ' must classify ambiguous/freeform_unproven under D-354-EGR (354-06), got ' + JSON.stringify(verdict)
    );

    // 4. Live disposition on the shim-backed scope: proceeds (exit 0).
    ok(hookExit(q.cypher) === 0, label + ' must pass the PreToolUse hook on the shim-backed plugin scope (exit 0)');
  }

  // 5. Negative control: embedded user content still blocks.
  const poisoned = guard.classify(
    { cypher: "MATCH (f:Framework) WHERE f.owner = 'someone@example.com' RETURN f" },
    { toolName: PLUGIN_SCOPED_QUERY }
  );
  ok(poisoned.verdict === 'block', 'negative control: Cypher with embedded user content must classify block, got ' + JSON.stringify(poisoned));

  // 369.2-07 (CODE-07, 2026-10-05): plain question green, room content red.
  legs369207(guard, HOOK, 'mcp__plugin_mos_mindrian-brain__brain_ask').forEach(function (r) { ok(r[0], r[1]); });

  console.log('PASS: test-246-census-guard (' + checks + ' assertions over ' + queries.length + ' census queries)');
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
