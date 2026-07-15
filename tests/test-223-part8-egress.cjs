'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-01 Task 3 -- Part 8 egress proof (SPEC Req 5).
 * =======================================================
 * ONE file combining the unit legs (behaviors 1-3, driven through the injectable
 * ctx seams from Task 2 -- no live Brain, no live web) and the static sweep leg
 * (behavior 4), since 223-VALIDATION maps the Part 8 row to exactly this file.
 *
 *   1. part8-egress-guard.classify rejects a seeded LOCAL-content breach payload
 *      built from REAL buildFixtureRoom223 bytes: verdict is NEVER 'allow'.
 *   2. personaDispatchCell (recording classifyFn stub) passes EVERY Brain-bound
 *      payload through classify BEFORE dispatch; each payload carries only the
 *      generic handle and NO fixture room content.
 *   3. classifyFn -> {verdict:'block'} skips the Brain leg (disclosed marker),
 *      and the injected Brain stub records ZERO invocations (fail-closed).
 *   4. static sweep: no raw network primitive in hat-governance.cjs /
 *      persona-research.cjs; a MISSING target file FAILS the leg (T-224-15 idiom).
 *
 * No test leg performs a live network or LLM call. NO em-dashes (CLAUDE.md).
 * PASS line + non-zero exit on failure.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const egressGuard = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const persona = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'persona-research.cjs'));
const { buildFixtureRoom223, MINTO_BODY } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-223.cjs'));

let passed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed += 1; console.log('  ok - ' + name); });
}

async function main() {
  // Build the fixture once; harvest a REAL LOCAL-content slice for the breach.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'part8-223-'));
  const fx = await buildFixtureRoom223(tmp, { artifactCount: 4 });
  const roomContent = fs.readFileSync(fx.relatedPair.a, 'utf8');
  const roomSlice = roomContent.slice(0, 400); // a genuine body slice, not a synthetic marker

  // ----- Behavior 1: the guard rejects a seeded LOCAL-content breach -----
  await check('behavior1: classify rejects a real room-content breach (never allow)', () => {
    // A typed-packet-shaped payload smuggling raw room prose in a summary leaf --
    // the H5-style breach. The guard proves the MOVE-SET shape and, failing that,
    // fails closed. It must NEVER return 'allow' for real room bytes.
    const breachPacket = { job: 'reach_context', packet_version: 1, summary: roomSlice };
    const v1 = egressGuard.classify(breachPacket, { toolName: 'brain_write' });
    assert.notEqual(v1.verdict, 'allow', 'packet breach must not be allowed');
    assert.ok(v1.verdict === 'block' || v1.verdict === 'ambiguous', 'block or ambiguous');

    // A bare content payload (no packet, no free-form tool) is fail-closed too.
    const breachBare = { context: roomSlice, minto: MINTO_BODY };
    const v2 = egressGuard.classify(breachBare, {});
    assert.notEqual(v2.verdict, 'allow', 'bare room-content payload must not be allowed');

    // The reason string carries NO offending bytes (scalar-only disclosure).
    assert.ok(typeof v1.reason === 'string');
    assert.equal(v1.reason.indexOf(roomSlice.slice(0, 40)), -1, 'reason leaks no content');
  });

  // ----- Behavior 2: classify wraps every Brain-bound payload, generic only -----
  await check('behavior2: every Brain-bound payload is classified first, handle-only', () => {
    const events = [];
    const HANDLE = 'urban logistics network';
    const brainStub = (payload) => { events.push({ kind: 'brain', payload }); return { hints: [] }; };
    const classifyStub = (payload, opts) => {
      events.push({ kind: 'classify', payload, opts });
      return { verdict: 'allow', class: 'move_set', reason: 'stub allow' };
    };
    return persona.personaDispatchCell(
      { subdomain: 'logistics', hat: 'Black', handle: HANDLE },
      {
        extractContextFn: () => ({ ok: true, lens_set: [{ lens: 'adversarial', weight: 1 }] }),
        runSourceLensFn: async () => ({ ok: true, findings: [] }),
        wireAcceptFn: () => ({ ok: true, node_id: 'n' }),
        classifyFn: classifyStub,
        brainFn: brainStub,
        db: {}, roomDir: fx.roomDir, topic: HANDLE, sessionId: 's',
      }
    ).then(() => {
      const classifyCalls = events.filter((e) => e.kind === 'classify');
      const brainCalls = events.filter((e) => e.kind === 'brain');
      assert.ok(classifyCalls.length >= 1, 'classify was called');
      assert.ok(brainCalls.length >= 1, 'brain was called (verdict allow)');
      // classify precedes every brain call (BEFORE dispatch).
      const firstBrainIdx = events.findIndex((e) => e.kind === 'brain');
      const firstClassifyIdx = events.findIndex((e) => e.kind === 'classify');
      assert.ok(firstClassifyIdx !== -1 && firstClassifyIdx < firstBrainIdx, 'classify precedes brain');
      // Every classified + Brain-bound payload carries the generic handle and NO
      // fixture room content.
      for (const e of classifyCalls.concat(brainCalls)) {
        const serialized = JSON.stringify(e.payload);
        assert.ok(serialized.indexOf(HANDLE) !== -1, 'payload carries the generic handle');
        assert.equal(serialized.indexOf(roomSlice.slice(0, 40)), -1, 'payload carries no room content');
        assert.equal(serialized.indexOf('meal-kit'.toLowerCase()), -1, 'payload carries no venture body');
      }
    });
  });

  // ----- Behavior 3: a block verdict skips the Brain leg, fail-closed -----
  await check('behavior3: classify block skips Brain, zero invocations, disclosed', () => {
    let brainCount = 0;
    const brainStub = () => { brainCount += 1; return { hints: [] }; };
    const classifyBlock = () => ({ verdict: 'block', class: 'content_set', reason: 'seeded block' });
    return persona.personaDispatchCell(
      { subdomain: 'logistics', hat: 'Black', handle: 'urban logistics network' },
      {
        extractContextFn: () => ({ ok: true, lens_set: [{ lens: 'adversarial', weight: 1 }] }),
        runSourceLensFn: async () => ({ ok: true, findings: [] }),
        wireAcceptFn: () => ({ ok: true, node_id: 'n' }),
        classifyFn: classifyBlock,
        brainFn: brainStub,
        db: {}, roomDir: fx.roomDir, topic: 'urban logistics network', sessionId: 's',
      }
    ).then((reading) => {
      assert.equal(brainCount, 0, 'no Brain call fired on a block verdict');
      assert.equal(reading.brain_skipped, true, 'brain skip is disclosed');
      assert.ok(Array.isArray(reading.degraded_reasons));
      assert.ok(reading.degraded_reasons.some((r) => r.indexOf('brain_egress_block') !== -1), 'disclosed reason');
    });
  });

  // ----- Behavior 4: static sweep, missing-target-fails -----
  await check('behavior4: static sweep finds no network primitive; missing target fails', () => {
    // Reimplement the run-all-224 strip-comments idiom locally.
    function stripComments(src) {
      return src
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
    }
    const PART8_RE = /fetch\(|https?:\/\/|require\((['"])node:https?|\b(curl|wget)\b/;
    const targets = [
      path.join(REPO_ROOT, 'lib', 'core', 'bono', 'hat-governance.cjs'),
      path.join(REPO_ROOT, 'lib', 'core', 'bono', 'persona-research.cjs'),
    ];
    for (const tgt of targets) {
      // MISSING target FAILS the leg (never a silent skip).
      assert.ok(fs.existsSync(tgt), 'sweep target exists: ' + tgt);
      const stripped = stripComments(fs.readFileSync(tgt, 'utf8'));
      assert.equal(PART8_RE.test(stripped), false, 'no raw network primitive in ' + path.basename(tgt));
    }
  });

  console.log('\nPASS: test-223-part8-egress (' + passed + ' checks)');
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
