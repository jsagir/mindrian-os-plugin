#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 237-03 -- decide() call-site census + seam preservation (REACH-01, Task 1)
 * ==================================================================================
 * Real behavior proven: lib/core/chain-executor.cjs must NEVER compute a chain-step
 * decision from the real navigation-engine.cjs::decide() UNLESS a caller explicitly
 * injects an adapted decideFn (opts.decideFn). Today it does not honor that -- both
 * runChain call sites (sync + async) fall back to a DEFAULT loader (_loadDecide())
 * that calls the real decide() with an unadapted ({step,index},{previousOutput})
 * shape decide() never documented. Every field decide() reads off that shape is
 * undefined, decide() never throws (it falls through to emptyDecision()), so the
 * default reliably computes and stores an EMPTY decision_trace that a 27-hit grep
 * across lib/ and scripts/ shows has zero readers. It costs work and produces
 * nothing -- the decorative call this plan removes.
 *
 * The trap this census guards against: scripts/act-command.cjs:250-268 INJECTS a
 * properly ADAPTED decideFn that reshapes runChain's call onto a real
 * decide({userText,sectionPath,sessionId}, context) call (Phase 172-08 CIRS R4).
 * That seam -- the decideFn call site itself, decideFn({step,index},{previousOutput})
 * -- is NOT decorative and must survive byte-identically. Only the DEFAULT (what
 * runs when no seam is injected) is removed.
 *
 * Leg map (6 legs):
 *   Leg 1 SOURCE FENCE:       comment-stripped source has zero occurrences of
 *                             _loadDecide, and every decideFn default-fallback
 *                             ternary resolves to exactly `null` (never a call
 *                             that would compute a real decision unattended).
 *   Leg 2 DEFAULT IS GONE:    runChain over a 2-step fixture, no decideFn injected
 *                             -> every trace entry's decision_trace === null, and a
 *                             spy on navigation-engine.cjs::decide records ZERO
 *                             invocations (sync path).
 *   Leg 3 SEAM SURVIVES:      the same fixture with an injected decideFn -> invoked
 *                             exactly once per executed step, each trace entry's
 *                             decision_trace equals that step's injected return.
 *   Leg 4 ASYNC PATH PARITY:  legs 2 and 3 repeated against _runChainResilient
 *                             (forced via opts.roomDir) -- the defect exists at TWO
 *                             sites; fixing only the sync one leaves the MCP path
 *                             (which always sets roomDir) broken.
 *   Leg 5 FAULT TOLERANCE:    an injected decideFn that throws leaves
 *                             decision_trace === null and does NOT abort the chain
 *                             (the existing try/catch contract is preserved).
 *   Leg 6 MUTATION:           a tmp copy of chain-executor.cjs with the decorative
 *                             default TEXTUALLY RESTORED (the `: null` fallback
 *                             replaced with a require-and-call of the real decide())
 *                             makes Leg 2's spy record a non-zero invocation count,
 *                             proving the census can actually fail, not just pass.
 *
 * Leg 1 implementation note (read before touching this file): the plan's own prose
 * describes Leg 1's second check as "zero occurrences of a decideFn( call whose
 * first argument literal is { step:". Read literally that pattern is unsatisfiable
 * together with Task 2's own requirement to KEEP the seam call site
 * (decideFn({ step: step, index: i }, { previousOutput: previousOutput })) at BOTH
 * sites byte-identical -- that literal text is exactly what the census must NOT
 * flag, because it is the seam act-command.cjs's adapted injection relies on. What
 * the plan is actually guarding against is a DEFAULT that resolves to a real
 * decide() call fed that unadapted shape. This test therefore scans the DEFAULT
 * FALLBACK of each decideFn ternary directly (must be exactly `null`) instead of
 * grepping for the seam's own call-site literal, which would produce a permanent
 * false failure. Recorded here and in the SUMMARY per the plan's own instruction
 * to state any leg substitution explicitly rather than quietly weaken it.
 *
 * Harness idioms reused (source, per 237-03-PLAN.md Task 1's <read_first>):
 *   - check()/results[] leg runner + tmpdir lifecycle + mutated-tmp-copy harness
 *     (pin absolute require paths, needle assertions, assert.notEqual(mutated, src)
 *     proof a mutation actually changed the source, require() the tmp copy fresh):
 *     tests/test-237-autonomy-parity.cjs, tests/test-241-guardian-tripolar-parity.cjs
 *     (lines 160-215).
 *   - comment-stripped forbidden/required-token source scan:
 *     tests/test-recipe-maps-authority.cjs (lines 88-103).
 *
 * Node built-in assert only. No em-dashes. Zero npm deps.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB_CORE_DIR = path.join(REPO_ROOT, 'lib', 'core');
const CHAIN_EXECUTOR_PATH = path.join(LIB_CORE_DIR, 'chain-executor.cjs');
const NAV_ENGINE_PATH = path.join(LIB_CORE_DIR, 'navigation-engine.cjs');

const chainExecutor = require(CHAIN_EXECUTOR_PATH);
const navEngine = require(NAV_ENGINE_PATH);

// ---------------------------------------------------------------------------
// tmpdir lifecycle (test-241 / test-237-autonomy-parity idiom).
// ---------------------------------------------------------------------------
const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------------------------------------------------------------------------
// Fixture: a deterministic 2-step chain. postureFn and onStep are supplied
// EXPLICITLY so this test's classification is deterministic (no coupling to
// registry contents) and does not depend on Plan 05's dispatcher.
// ---------------------------------------------------------------------------
function makeSteps() {
  return [
    { step: 1, command: '/mos:test-237-03-fixture-a' },
    { step: 2, command: '/mos:test-237-03-fixture-b' },
  ];
}
function alwaysRunPostureFn(command) {
  return { command: command || null, autonomous_safe: true, posture: 'run' };
}
function benignOnStep(step, _previousOutput) {
  return { chain_output: { ok: true, step: step && step.step }, quality: 'high' };
}

// ---------------------------------------------------------------------------
// decide() spy helper. Installs a counting wrapper on navEngine.decide,
// restores the original in a finally, supports sync or async leg bodies.
// ---------------------------------------------------------------------------
async function withDecideSpy(fn) {
  const original = navEngine.decide;
  assert.equal(typeof original, 'function',
    'navigation-engine.cjs must export a real decide() function to spy on; source drifted');
  let callCount = 0;
  navEngine.decide = function spy() {
    callCount += 1;
    return original.apply(this, arguments);
  };
  try {
    return await fn(() => callCount);
  } finally {
    navEngine.decide = original;
  }
}

// require-cache identity check (Task 1's Leg 2 pre-requisite): confirm that
// chain-executor.cjs's own lazy require of navigation-engine.cjs resolves to
// the EXACT SAME cache entry this test just required, so mutating
// navEngine.decide here is actually observed by the module under test.
function assertRequireCacheIdentity() {
  const resolvedFromChainExecDir = require.resolve(path.join(LIB_CORE_DIR, 'navigation-engine.cjs'));
  const resolvedFromTestPath = require.resolve(NAV_ENGINE_PATH);
  assert.equal(resolvedFromChainExecDir, resolvedFromTestPath,
    'require cache identity check failed: chain-executor.cjs would load navigation-engine.cjs from ' +
    'a different resolved path (' + resolvedFromChainExecDir + ') than this test requires (' +
    resolvedFromTestPath + '); the decide() spy would not be observed by the module under test.');
}

// ---------------------------------------------------------------------------
// Leg runner (test-241 / test-237-autonomy-parity idiom): each leg runs
// independently in try/catch so a failing early leg does not hide later ones.
// ---------------------------------------------------------------------------
const results = [];
async function runLeg(name, fn) {
  try {
    await fn();
    results.push({ name: name, status: 'PASS' });
  } catch (e) {
    results.push({ name: name, status: 'FAIL', error: e });
  }
}

// ---------------------------------------------------------------------------
// Leg 6 mutation-harness helpers.
// ---------------------------------------------------------------------------

// chain-executor.cjs resolves all of its lazy requires via
// path.join(__dirname, ...). A tmp copy has a different __dirname (the tmp
// dir itself), so every one of those requires would resolve to a wrong,
// nonexistent location. Pin __dirname to the REAL lib/core directory
// (test-241's pinRequiresToRealRepo technique, applied via a global token
// replace since chain-executor.cjs uses ONLY __dirname-based path joins for
// its requires, never a literal relative require string).
function pinChainExecutorDirnameToRealRepo(src) {
  const occurrences = (src.match(/__dirname/g) || []).length;
  assert.ok(occurrences >= 5,
    'expected chain-executor.cjs to use __dirname at least 5 times for its lazy require ' +
    'path-joins; source drifted (found ' + occurrences + ')');
  return src.split('__dirname').join(JSON.stringify(LIB_CORE_DIR));
}

// The mutation under test: restores the DECORATIVE default this plan removes
// -- the decideFn ternary's `: null` fallback replaced with a require-and-call
// of the real decide(). This targets the POST-Task-2 source shape; if this
// leg runs BEFORE Task 2 lands, the needle is not found yet and the assertion
// below fails loudly (a Leg 6 FAIL pre-fix is expected and harmless -- Legs 1
// and 2 are the RED legs Task 1 is required to demonstrate).
function mutateRestoreDecorativeDefault(pinnedSrc) {
  const needle = "o.decideFn === 'function') ? o.decideFn : null;";
  const occurrences = pinnedSrc.split(needle).length - 1;
  assert.ok(occurrences >= 2,
    'expected the decideFn default-fallback needle to appear at least twice (sync + async ' +
    'sites); found ' + occurrences + ' (this leg targets the POST-Task-2 source shape -- if run ' +
    'before Task 2 lands, it fails loudly here rather than silently passing)');
  const realDecideRequire = 'require(' + JSON.stringify(NAV_ENGINE_PATH) + ').decide';
  const replacement = "o.decideFn === 'function') ? o.decideFn : " + realDecideRequire + ';';
  return pinnedSrc.split(needle).join(replacement);
}

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------
async function main() {
  await runLeg(
    'Leg 1 SOURCE FENCE: _loadDecide symbol gone; every decideFn default fallback is exactly null',
    async () => {
      const src = fs.readFileSync(CHAIN_EXECUTOR_PATH, 'utf8');
      const codeLines = src.split('\n').filter((line) => {
        const t = line.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      });
      const code = codeLines.join('\n');

      const loadDecideCount = (code.match(/_loadDecide/g) || []).length;
      assert.equal(loadDecideCount, 0,
        'expected zero occurrences of _loadDecide in comment-stripped source; got ' + loadDecideCount);

      // See the file header note above for why this scans the ternary's
      // DEFAULT FALLBACK rather than grepping for the seam's own call-site
      // literal (which must survive unchanged).
      const defaultFallbackPattern =
        /o\.decideFn\s*===\s*'function'\)\s*\?\s*o\.decideFn\s*:\s*([^;]+);/g;
      const fallbacks = [];
      let m;
      while ((m = defaultFallbackPattern.exec(code)) !== null) {
        fallbacks.push(m[1].trim());
      }
      assert.ok(fallbacks.length >= 2,
        'expected at least 2 decideFn default-fallback ternaries (sync + async sites); found ' +
        fallbacks.length);
      for (const fb of fallbacks) {
        assert.equal(fb, 'null',
          'expected every decideFn default fallback to be exactly "null" (no default that ' +
          'computes a real decision when no seam is injected); found "' + fb + '"');
      }
    }
  );

  await runLeg(
    'Leg 2 DEFAULT IS GONE: no decideFn injected -> decision_trace null, zero decide() calls (sync path)',
    async () => {
      assertRequireCacheIdentity();
      await withDecideSpy(async (getCallCount) => {
        const result = chainExecutor.runChain(makeSteps(), {
          postureFn: alwaysRunPostureFn,
          onStep: benignOnStep,
        });
        assert.ok(Array.isArray(result.trace) && result.trace.length === 2,
          'expected both fixture steps to execute; got trace length ' +
          (result.trace && result.trace.length));
        for (const entry of result.trace) {
          assert.equal(entry.decision_trace, null,
            'expected decision_trace === null on every trace entry when no decideFn is injected');
        }
        assert.equal(getCallCount(), 0,
          'expected ZERO invocations of the real decide() when no decideFn seam is injected; got ' +
          getCallCount());
      });
    }
  );

  await runLeg(
    'Leg 3 SEAM SURVIVES: an injected decideFn fires once per executed step and lands its own trace value (sync path)',
    async () => {
      const calls = [];
      function injectedDecideFn(turn) {
        calls.push(turn);
        return { decision_trace: 'SEAM-PROOF-' + turn.index };
      }
      const result = chainExecutor.runChain(makeSteps(), {
        postureFn: alwaysRunPostureFn,
        onStep: benignOnStep,
        decideFn: injectedDecideFn,
      });
      assert.equal(calls.length, 2,
        'expected the injected decideFn to be invoked exactly once per executed step (2 steps); got ' +
        calls.length);
      assert.equal(result.trace.length, 2, 'expected both fixture steps to execute');
      result.trace.forEach((entry, i) => {
        assert.equal(entry.decision_trace, 'SEAM-PROOF-' + i,
          'expected trace entry ' + i + ' to carry the injected decideFn return value for that index');
      });
    }
  );

  await runLeg(
    'Leg 4 ASYNC PATH PARITY: legs 2 and 3 repeated against _runChainResilient (roomDir forces the async path)',
    async () => {
      const roomDir = mkTmp('test-237-03-async-fixture-');

      // 4a: default is gone, zero decide() invocations, decision_trace null.
      await withDecideSpy(async (getCallCount) => {
        const result = await chainExecutor.runChain(makeSteps(), {
          postureFn: alwaysRunPostureFn,
          onStep: benignOnStep,
          roomDir: roomDir,
        });
        assert.ok(Array.isArray(result.trace) && result.trace.length === 2,
          'async path: expected both fixture steps to execute; got trace length ' +
          (result.trace && result.trace.length));
        for (const entry of result.trace) {
          assert.equal(entry.decision_trace, null,
            'async path: expected decision_trace === null on every trace entry when no decideFn is injected');
        }
        assert.equal(getCallCount(), 0,
          'async path: expected ZERO invocations of the real decide() when no decideFn seam is injected; got ' +
          getCallCount());
      });

      // 4b: the seam survives on the async path too.
      const calls = [];
      function injectedDecideFn(turn) {
        calls.push(turn);
        return { decision_trace: 'SEAM-PROOF-ASYNC-' + turn.index };
      }
      const result2 = await chainExecutor.runChain(makeSteps(), {
        postureFn: alwaysRunPostureFn,
        onStep: benignOnStep,
        decideFn: injectedDecideFn,
        roomDir: roomDir,
      });
      assert.equal(calls.length, 2,
        'async path: expected the injected decideFn to be invoked exactly once per executed step; got ' +
        calls.length);
      assert.equal(result2.trace.length, 2, 'async path: expected both fixture steps to execute');
      result2.trace.forEach((entry, i) => {
        assert.equal(entry.decision_trace, 'SEAM-PROOF-ASYNC-' + i,
          'async path: expected trace entry ' + i + ' to carry the injected decideFn return value for that index');
      });
    }
  );

  await runLeg(
    'Leg 5 FAULT TOLERANCE: a throwing injected decideFn leaves decision_trace null and does not abort the chain',
    async () => {
      function throwingDecideFn() {
        throw new Error('test-237-03 leg5 deliberate throw');
      }
      const result = chainExecutor.runChain(makeSteps(), {
        postureFn: alwaysRunPostureFn,
        onStep: benignOnStep,
        decideFn: throwingDecideFn,
      });
      assert.equal(result.completed, true,
        'expected the chain to complete despite the throwing decideFn (existing try/catch contract preserved)');
      assert.equal(result.trace.length, 2,
        'expected both fixture steps to still execute despite the throwing decideFn');
      for (const entry of result.trace) {
        assert.equal(entry.decision_trace, null,
          'expected decision_trace === null when the injected decideFn throws');
      }
    }
  );

  await runLeg(
    'Leg 6 MUTATION: restoring the decorative default in a tmp copy makes the spy record non-zero invocations',
    async () => {
      const src = fs.readFileSync(CHAIN_EXECUTOR_PATH, 'utf8');
      const pinned = pinChainExecutorDirnameToRealRepo(src);
      const mutated = mutateRestoreDecorativeDefault(pinned);
      assert.notEqual(mutated, src, 'mutation must actually change the source');

      const tmp = mkTmp('test-237-03-leg6-');
      const dest = path.join(tmp, 'chain-executor-mutated.cjs');
      fs.writeFileSync(dest, mutated);
      const mutatedChainExecutor = require(dest);

      await withDecideSpy(async (getCallCount) => {
        const result = mutatedChainExecutor.runChain(makeSteps(), {
          postureFn: alwaysRunPostureFn,
          onStep: benignOnStep,
        });
        assert.ok(Array.isArray(result.trace) && result.trace.length === 2,
          'expected the mutated module to still execute both fixture steps');
        assert.ok(getCallCount() > 0,
          'expected the MUTATED (default-restored) chain-executor to invoke the real decide() at ' +
          'least once when no decideFn is injected; got ' + getCallCount() +
          ' (if this is 0, the mutation harness itself is broken, not the census)');
      });
    }
  );

  // ---------------------------------------------------------------------------
  // Epilogue
  // ---------------------------------------------------------------------------
  let passCount = 0;
  let failCount = 0;
  console.log('test-237-decide-census');
  for (const r of results) {
    if (r.status === 'PASS') {
      passCount += 1;
      console.log('  ok - ' + r.name);
    } else {
      failCount += 1;
      console.error('  FAIL - ' + r.name);
      console.error('    ' + (r.error && (r.error.message || r.error.stack) || String(r.error)));
    }
  }
  console.log('');
  if (failCount === 0) {
    console.log('PASS: test-237-decide-census (' + passCount + '/' + results.length + ' legs)');
    process.exit(0);
  } else {
    console.error(
      'FAIL: test-237-decide-census (' + failCount + ' failed, ' + passCount + ' passed, of ' +
      results.length + ' legs)'
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL: unhandled error in test-237-decide-census');
  console.error(e && (e.stack || e.message) || String(e));
  process.exit(1);
});
