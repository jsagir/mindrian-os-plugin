#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-03 -- RENDER-102-03 JTBD-aware Zone 4 regression fence.
 *
 * Replaces the Phase 102-00 Wave-0 stub at this path. Plan 102-03 wires
 * the Phase 100 JTBD signal + Phase 101 selector-dispatcher into
 * render-v2's Zone 4 (the action footer). This file is the contract
 * fence that locks the wiring against silent regressions.
 *
 * Six IIFE assertions per Plan 102-03 Task 2:
 *
 *   1. jtbd_verbs            jtbd='find-bottleneck' + BUILD_ROOM ->
 *                            Zone 4 contains taxonomy next_move_verbs[]
 *                            (Run Methodology, Spawn Sub-Agent, Navigate
 *                            Graph, Synthesize) + Free-Text appended last.
 *   2. null_fallback         jtbd=null + BUILD_ROOM -> Zone 4 falls back
 *                            to F.1 canonical 10 verbs (per frontmatter
 *                            must_haves "When jtbd null, Zone 4 falls
 *                            back to canonical 10 (existing F.1 behavior)"
 *                            + CONTEXT D-04). Free-Text last.
 *   3. just_talk_suppress    operator='JUST_TALK' regardless of jtbd ->
 *                            { rendered: '', contract: { suppressed:true,
 *                            reason: 'just-talk' } }. Dispatcher MUST NOT
 *                            be invoked (operator gate beats Z4 dispatch).
 *   4. methodology_suppress  operator='METHODOLOGY' mid-session ->
 *                            Zone 4 stripped from composed output (step 6
 *                            gate beats step 2 enrichment per algorithm
 *                            order in render-v2.cjs).
 *   5. caller_override       caller supplies zones.footer explicitly ->
 *                            footer preserved verbatim, dispatcher NOT
 *                            called (zones.footer === undefined check
 *                            short-circuits the dispatch).
 *   6. dispatcher_error      dispatcher throws -> render does not crash;
 *                            footer stays undefined; envelope shape
 *                            ({ rendered, contract }) preserved.
 *
 * Exit 0 on full pass; exit 1 on any failure.
 *
 * Pure CJS, node built-ins only, zero new runtime deps (Phase 87 invariant).
 *
 * Canon Part 3 (Tri-Context Decision Gate -- Zone 4 verb closure to the
 * 10 MindrianOS-native verbs); Part 7 (Reuse Before Build -- this fence
 * tests the wiring of Phase 100 + Phase 101 + Phase 102 modules without
 * adding any new surface); Part 8 (Graph Boundary -- entire test runs
 * LOCAL-only, no Brain queries).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '..');
const V2_PATH = path.join(REPO_ROOT, 'lib', 'render', 'render-v2.cjs');
const JTBD_STATE_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-state.cjs');
const DISPATCHER_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs');

// Closed 10-verb MindrianOS-native vocabulary (Canon Part 3 § The 10 verbs).
// Mirrored here so the test fence is self-contained; the F.1 fallback
// exports CANONICAL_VERBS but we deliberately re-state the contract.
const CANONICAL_VERBS_10 = [
  'Run Methodology',
  'Reformulate',
  'Spawn Sub-Agent',
  'Navigate Graph',
  "Devil's Advocate",
  'Scenario Plan',
  'Synthesize',
  'Bank Opportunity',
  'Defer',
  'Free-Text',
];

// find-bottleneck taxonomy verbs (Phase 100 jtbd-taxonomy.json) -- the
// expected F.6 verb set BEFORE Free-Text is appended. Test fence reads
// the taxonomy at runtime so a JTBD vocabulary update flips this list
// automatically; the assertion checks containment + Free-Text last.
function readFindBottleneckTaxonomyVerbs() {
  const taxPath = path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');
  const tax = JSON.parse(fs.readFileSync(taxPath, 'utf8'));
  const entry = (tax.entries || []).find(function (e) { return e && e.id === 'find-bottleneck'; });
  if (!entry || !Array.isArray(entry.next_move_verbs)) {
    throw new Error('find-bottleneck taxonomy entry or next_move_verbs missing');
  }
  return entry.next_move_verbs.slice();
}

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function makeRoom(prefix) {
  const tmp = fs.mkdtempSync('/tmp/' + prefix + '-');
  fs.writeFileSync(path.join(tmp, '.room-root'), '');
  return tmp;
}

function rmRoom(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// freshRender: clear require cache for render-v2 + dispatcher + jtbd-state
// so each scenario gets a clean module state. Critical for scenario 6
// (dispatcher error injection).
function freshRender() {
  delete require.cache[V2_PATH];
  delete require.cache[DISPATCHER_PATH];
  delete require.cache[JTBD_STATE_PATH];
  return require(V2_PATH);
}

// ---------------------------------------------------------------------------
// Scenario 1: jtbd_verbs.
// jtbd='find-bottleneck' + BUILD_ROOM -> Zone 4 contains taxonomy verbs +
// Free-Text appended last.
// ---------------------------------------------------------------------------
(function test1_jtbdVerbs() {
  const label = 'jtbd_verbs: find-bottleneck + BUILD_ROOM -> taxonomy verbs + Free-Text last';
  const tmp = makeRoom('zone4-fb');
  try {
    const jtbdState = require(JTBD_STATE_PATH);
    jtbdState.setCurrent(tmp, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      evidence: ['unit-test'],
      trigger: 'manual',
      manual: true,
    });

    const { render } = freshRender();
    const env = render({
      zones: { header: '-- test --', body: 'b' },
      mode: 'A',
      operator: 'BUILD_ROOM',
      tier: 1,
      jtbd: 'find-bottleneck',
      tokenBudget: { used: 0, total: 1 },
      roomDir: tmp,
    });

    assert.equal(typeof env.rendered, 'string', 'rendered is a string');

    const taxVerbs = readFindBottleneckTaxonomyVerbs();
    for (const verb of taxVerbs) {
      assert.ok(
        env.rendered.indexOf(verb) !== -1,
        'rendered output contains taxonomy verb "' + verb + '"'
      );
    }

    // Free-Text must appear and must be the last verb-line in Zone 4.
    assert.ok(env.rendered.indexOf('Free-Text') !== -1, 'rendered contains Free-Text');

    const lines = env.rendered.split('\n');
    // Find the last line that mentions any of the canonical 10 verbs; it
    // must be the Free-Text line.
    let lastVerbLineIdx = -1;
    let lastVerb = null;
    for (let i = 0; i < lines.length; i += 1) {
      for (const v of CANONICAL_VERBS_10) {
        if (lines[i].indexOf(v) !== -1) {
          lastVerbLineIdx = i;
          lastVerb = v;
        }
      }
    }
    assert.notEqual(lastVerbLineIdx, -1, 'at least one verb line found');
    assert.equal(lastVerb, 'Free-Text', 'last verb line is Free-Text (ensureFreeTextLast invariant)');

    // Closed-vocabulary fence: every "▷ N. <verb>" or "▶ N. <verb>" line
    // must reference a verb from the closed 10-verb set.
    const verbLineRe = /^[▶▷]\s+\d+\.\s+(.+)$/;
    for (const line of lines) {
      const m = line.match(verbLineRe);
      if (m) {
        const seen = m[1].trim();
        assert.ok(
          CANONICAL_VERBS_10.indexOf(seen) !== -1,
          'verb "' + seen + '" is in the closed 10-verb vocabulary'
        );
      }
    }
    ok(label);
  } catch (e) { fail(label, e); }
  rmRoom(tmp);
})();

// ---------------------------------------------------------------------------
// Scenario 2: null_fallback.
// jtbd=null + BUILD_ROOM -> dispatcher fires, F.1 fallback returns the
// canonical 10 verbs (per frontmatter must_haves + CONTEXT D-04). The
// dispatcher's ensureFreeTextLast keeps Free-Text last; the closed
// vocabulary fence is identical to scenario 1.
// ---------------------------------------------------------------------------
(function test2_nullFallback() {
  const label = 'null_fallback: jtbd=null + BUILD_ROOM -> F.1 canonical 10 + Free-Text last';
  const tmp = makeRoom('zone4-null');
  try {
    // No JTBD state -> dispatcher sees jtbdId=null -> F.1 fallback path.
    const { render } = freshRender();
    const env = render({
      zones: { header: '-- test --', body: 'b' },
      mode: 'A',
      operator: 'BUILD_ROOM',
      tier: 1,
      jtbd: null,
      tokenBudget: { used: 0, total: 1 },
      roomDir: tmp,
    });

    assert.equal(typeof env.rendered, 'string', 'rendered is a string');

    // F.1 emits all 10 canonical verbs as numbered ▷ rows.
    for (const verb of CANONICAL_VERBS_10) {
      assert.ok(
        env.rendered.indexOf(verb) !== -1,
        'F.1 fallback contains canonical verb "' + verb + '"'
      );
    }

    // Free-Text last (ensureFreeTextLast invariant).
    const lines = env.rendered.split('\n');
    let lastVerbLineIdx = -1;
    let lastVerb = null;
    for (let i = 0; i < lines.length; i += 1) {
      for (const v of CANONICAL_VERBS_10) {
        if (lines[i].indexOf(v) !== -1) {
          lastVerbLineIdx = i;
          lastVerb = v;
        }
      }
    }
    assert.notEqual(lastVerbLineIdx, -1, 'at least one verb line found');
    assert.equal(lastVerb, 'Free-Text', 'F.1 last verb is Free-Text');

    // Verbs[] count via numbered "<n>." lines: must be exactly 10.
    let numberedCount = 0;
    const numberedRe = /^[▶▷]\s+\d+\.\s+/;
    for (const line of lines) {
      if (numberedRe.test(line)) numberedCount += 1;
    }
    assert.equal(numberedCount, 10, 'F.1 fallback emits exactly 10 numbered verb rows');
    ok(label);
  } catch (e) { fail(label, e); }
  rmRoom(tmp);
})();

// ---------------------------------------------------------------------------
// Scenario 3: just_talk_suppress.
// operator='JUST_TALK' -> { rendered: '', contract: { suppressed:true, ... } }
// regardless of jtbd. The render-v2 step 6 operator gate beats the step 2
// Z4 dispatcher enrichment.
// ---------------------------------------------------------------------------
(function test3_justTalkSuppress() {
  const label = 'just_talk_suppress: JUST_TALK -> suppressed:true regardless of jtbd';
  const tmp = makeRoom('zone4-just');
  try {
    const jtbdState = require(JTBD_STATE_PATH);
    jtbdState.setCurrent(tmp, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      evidence: ['unit-test'],
      trigger: 'manual',
      manual: true,
    });

    const { render } = freshRender();
    const env = render({
      zones: { header: '-- test --', body: 'b' },
      mode: 'A',
      operator: 'JUST_TALK',
      tier: 1,
      jtbd: 'find-bottleneck',
      tokenBudget: { used: 0, total: 1 },
      roomDir: tmp,
    });

    assert.equal(env.rendered, '', 'JUST_TALK rendered === ""');
    assert.ok(env.contract && typeof env.contract === 'object', 'contract is object');
    assert.equal(env.contract.suppressed, true, 'contract.suppressed === true');
    assert.equal(env.contract.reason, 'just-talk', 'contract.reason === "just-talk"');

    // Free-Text MUST NOT leak into rendered (dispatcher must not have
    // composed output before suppression).
    assert.equal(env.rendered.indexOf('Free-Text'), -1, 'no Free-Text leaks under JUST_TALK');
    ok(label);
  } catch (e) { fail(label, e); }
  rmRoom(tmp);
})();

// ---------------------------------------------------------------------------
// Scenario 4: methodology_suppress.
// operator='METHODOLOGY' mid-session -> Zone 4 stripped. The render-v2
// step 6 gate deletes zones.footer when body.endingSignal is falsy. The
// step 2 enrichment we just added IS allowed to populate footer first;
// step 6 then strips it. End state: composed output has no verb rows.
// ---------------------------------------------------------------------------
(function test4_methodologySuppress() {
  const label = 'methodology_suppress: METHODOLOGY mid-session -> Zone 4 stripped';
  const tmp = makeRoom('zone4-meth');
  try {
    const jtbdState = require(JTBD_STATE_PATH);
    jtbdState.setCurrent(tmp, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      evidence: ['unit-test'],
      trigger: 'manual',
      manual: true,
    });

    const { render } = freshRender();
    // body.endingSignal is falsy -> mid-session -> footer stripped.
    const env = render({
      zones: { header: '-- test --', body: { text: 'b', endingSignal: false } },
      mode: 'A',
      operator: 'METHODOLOGY',
      tier: 1,
      jtbd: 'find-bottleneck',
      tokenBudget: { used: 0, total: 1 },
      roomDir: tmp,
    });

    assert.equal(typeof env.rendered, 'string', 'rendered is a string');
    // No Free-Text (Zone 4 stripped); no numbered verb rows.
    assert.equal(env.rendered.indexOf('Free-Text'), -1, 'no Free-Text in METHODOLOGY mid-session');
    const numberedRe = /^[▶▷]\s+\d+\.\s+/m;
    assert.ok(!numberedRe.test(env.rendered), 'no numbered verb rows in METHODOLOGY mid-session');
    ok(label);
  } catch (e) { fail(label, e); }
  rmRoom(tmp);
})();

// ---------------------------------------------------------------------------
// Scenario 5: caller_override.
// Caller supplies zones.footer explicitly -> footer preserved verbatim,
// dispatcher NOT called (the `zones.footer === undefined` short-circuit).
// ---------------------------------------------------------------------------
(function test5_callerOverride() {
  const label = 'caller_override: caller-supplied footer preserved, dispatcher NOT called';
  const tmp = makeRoom('zone4-over');
  try {
    const jtbdState = require(JTBD_STATE_PATH);
    jtbdState.setCurrent(tmp, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      evidence: ['unit-test'],
      trigger: 'manual',
      manual: true,
    });

    const sentinel = '__CALLER_OVERRIDE_SENTINEL__';
    const { render } = freshRender();
    const env = render({
      zones: { header: '-- test --', body: 'b', footer: sentinel },
      mode: 'A',
      operator: 'BUILD_ROOM',
      tier: 1,
      jtbd: 'find-bottleneck',
      tokenBudget: { used: 0, total: 1 },
      roomDir: tmp,
    });

    assert.equal(typeof env.rendered, 'string', 'rendered is a string');
    assert.ok(env.rendered.indexOf(sentinel) !== -1, 'sentinel preserved in output');
    // Dispatcher would have produced Free-Text; its absence proves the
    // dispatcher was not invoked.
    assert.equal(
      env.rendered.indexOf('Free-Text'), -1,
      'no Free-Text -> dispatcher was not called'
    );
    // Closed-vocabulary fence still applies: no verb leak from sentinel.
    const numberedRe = /^[▶▷]\s+\d+\.\s+/m;
    assert.ok(!numberedRe.test(env.rendered), 'no F.x numbered verb rows when caller overrides');
    ok(label);
  } catch (e) { fail(label, e); }
  rmRoom(tmp);
})();

// ---------------------------------------------------------------------------
// Scenario 6: dispatcher_error_graceful.
// Inject a dispatcher that throws on pickShape; render-v2 must not crash;
// envelope shape preserved; footer stays undefined (no verbs in output).
// We swap the dispatcher via require.cache surgery -- the throwing module
// replaces the real selector-dispatcher.cjs entry, then a fresh render-v2
// require resolves the patched cache hit.
// ---------------------------------------------------------------------------
(function test6_dispatcherErrorGraceful() {
  const label = 'dispatcher_error_graceful: dispatcher throw -> render does not crash';
  const tmp = makeRoom('zone4-err');
  try {
    const jtbdState = require(JTBD_STATE_PATH);
    jtbdState.setCurrent(tmp, {
      jtbd: 'find-bottleneck',
      confidence: 0.8,
      evidence: ['unit-test'],
      trigger: 'manual',
      manual: true,
    });

    // Drop any cached copies first.
    delete require.cache[V2_PATH];
    delete require.cache[DISPATCHER_PATH];
    delete require.cache[JTBD_STATE_PATH];

    // Plant a fake dispatcher in the require cache. render-v2 calls
    // require('../hmi/selector-dispatcher.cjs') -- the resolved absolute
    // path is DISPATCHER_PATH. We construct a fake Module entry with
    // .loaded = true so Node's loader returns the cached exports without
    // re-executing the real source.
    const fakeMod = new Module(DISPATCHER_PATH, null);
    fakeMod.filename = DISPATCHER_PATH;
    fakeMod.loaded = true;
    fakeMod.exports = {
      pickShape: function () { throw new Error('synthetic dispatcher error'); },
    };
    require.cache[DISPATCHER_PATH] = fakeMod;

    let thrown = null;
    let env = null;
    try {
      const { render } = require(V2_PATH);
      env = render({
        zones: { header: '-- test --', body: 'b' },
        mode: 'A',
        operator: 'BUILD_ROOM',
        tier: 1,
        jtbd: 'find-bottleneck',
        tokenBudget: { used: 0, total: 1 },
        roomDir: tmp,
      });
    } catch (e) {
      thrown = e;
    } finally {
      // Always restore real dispatcher cache for subsequent tests.
      delete require.cache[DISPATCHER_PATH];
      delete require.cache[V2_PATH];
    }

    assert.equal(thrown, null, 'render did not throw on dispatcher error');
    assert.ok(env && typeof env === 'object', 'envelope is an object');
    assert.equal(typeof env.rendered, 'string', 'rendered is a string');
    assert.ok(env.contract && typeof env.contract === 'object', 'contract is an object');

    // No Free-Text (footer never populated -- caught error path).
    assert.equal(env.rendered.indexOf('Free-Text'), -1, 'no Free-Text on dispatcher error');
    // No numbered verb rows.
    const numberedRe = /^[▶▷]\s+\d+\.\s+/m;
    assert.ok(!numberedRe.test(env.rendered), 'no verb rows on dispatcher error');
    // Header + body still composed normally.
    assert.ok(env.rendered.indexOf('-- test --') !== -1, 'header still composed');
    assert.ok(env.rendered.indexOf('b') !== -1, 'body still composed');
    ok(label);
  } catch (e) { fail(label, e); }
  rmRoom(tmp);
})();

process.stdout.write('\n');
process.stdout.write(
  'Phase 102-03 JTBD-aware Zone 4 regression: '
  + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
