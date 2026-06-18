#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-08 -- the adversarial structured verdict (WAVE 8 VERIFY).
 * ==================================================================
 * The harness-as-code property 6: "adversarial verify returns a structured
 * verdict, not a vibe." Mirrors the Phase 163 verify wave that caught
 * FINDING-163-06-01 (tests/test-trending-to-absurd-verdict.cjs) -- the
 * record(check, passed, detail) accumulator that pushes { check, passed, detail }
 * into findings[] and exits non-zero printing findings if ANY check failed, so a
 * REAL defect is surfaced as a FINDING rather than silently passed.
 *
 * The verdict drives the SHIPPED runChain spine (lib/core/chain-executor.cjs)
 * through every SPEC acceptance scenario by INSTRUMENTATION, plus the canon
 * guards. The eight SPEC acceptance tests (166-SPEC.md "Acceptance / tests"):
 *
 *   (1) three autonomous_safe steps run end to end with NO gate, output passed
 *       each hop, ONE trace (EXEC-01 / 02 / 04).
 *   (2) a hold-tagged step at position 2 auto-runs step 1, HALTS at step 2
 *       rendering the gate, resumes step 3 after APPROVE (EXEC-03).
 *   (3) a step returning quality:low forces a halt even though autonomous_safe
 *       (EXEC-02 quality carry).
 *   (4) an irreversible step forces a halt regardless of tag (EXEC-03
 *       forced-material HARD RULE).
 *   (5) [stop] mid-chain flushes filed artifacts and ends cleanly with a
 *       complete trace (EXEC-04 kill switch).
 *   (6) resume -- kill a chain at step 2, resume from pipeline-state.json, step 1
 *       is NOT re-run (B1 / D-166-02 via the isNext hard gate).
 *   (7) Part 8 sweep -- delegate to the leak-scan suite (assert it exits zero);
 *       no user bytes reach the Brain (B4 / D-166-03).
 *   (8) regression -- the act/pipeline/ignite/larry migration suites stay green
 *       (assert each Wave-4..7 suite exits zero).
 *
 * Plus the canon guards by instrumentation (the gap this wave closes):
 *   - B2 (decide() return-shape UNCHANGED): the recorded decision_trace handle is
 *     the SAME reference decide() returned (deep-equal + reference identity).
 *   - B3 (NO autonomous-convergence stop branch): a DEDICATED NEGATIVE grep over
 *     lib/core/chain-executor.cjs source, COMMENTS STRIPPED so a comment that
 *     names the rejected pattern cannot self-invalidate the count (mirrors the B2
 *     grep-assert). The chain halts on POSTURE (Part 3), never on convergence.
 *   - Part 9 (proposed-not-confirmed): any chain-state journal write lands a
 *     generic step handle, never a confirmed truth-claim (the spine writes
 *     bookkeeping, not truth).
 *   - Part 3 (gate halts on non-autonomous_safe): a hold-tagged step halts.
 *   - EXEC-05 (graceful partial): a transient 5xx exhaustion returns a partial
 *     preserving the upstream trace.
 *   - EXEC-06 (maxSteps cap): the budget brake stops the run.
 *   - no em-dashes across the Phase-166 lib surfaces.
 *
 * Pure node built-ins + child_process. Zero npm deps. NO em-dashes (CLAUDE.md
 * HARD RULE: hyphens only).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');

const SUITE = 'test-chain-executor-verdict';
const REPO = path.resolve(__dirname, '..');

const executor = require(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'));
const recipeMaps = require(path.join(REPO, 'lib', 'core', 'recipe-maps.cjs'));
const pipelineState = require(path.join(REPO, 'lib', 'mcp', 'pipeline-state.cjs'));

const { runChain, makeGateFn, isIrreversibleStep } = executor;

// The structured verdict accumulator (the Phase 163 idiom verbatim in shape).
const findings = [];
function record(check, passed, detail) {
  findings.push({ check, passed, detail });
}

// A posture stub the gate honors: a map of command -> autonomous_safe verdict.
// Lets the verdict drive the gate deterministically WITHOUT depending on the
// live command-registry (the gate predicate itself -- makeGateFn -- is the
// SHIPPED code under test; only the posture authority is stubbed).
function stubPostureFn(autoSafeMap) {
  return function postureFn(command) {
    const safe = !!autoSafeMap[command];
    return { command: command || null, autonomous_safe: safe, posture: safe ? 'run' : 'halt' };
  };
}

// A no-op onStep that echoes a chain_output carrying the named quality, and
// records the previousOutput it SAW (to prove output passing hop to hop).
function makeRecordingOnStep(seen, qualityByCommand) {
  qualityByCommand = qualityByCommand || {};
  return function onStep(step, previousOutput) {
    seen.push({ command: step.command, previousOutput: previousOutput });
    const q = qualityByCommand[step.command] || 'high';
    return { chain_output: 'out:' + step.command, quality: q };
  };
}

async function runVerdict() {
  // =====================================================================
  // CHECK 1 -- three autonomous_safe steps run end to end, NO gate, ONE trace.
  // =====================================================================
  {
    const sub = [];
    try {
      const steps = [
        { step: 1, command: 'lean-canvas' },
        { step: 2, command: 'think-hats' },
        { step: 3, command: 'mullins' },
      ];
      const autoSafe = { 'lean-canvas': true, 'think-hats': true, 'mullins': true };
      const seen = [];
      const out = runChain(steps, {
        postureFn: stubPostureFn(autoSafe),
        onStep: makeRecordingOnStep(seen),
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
      });
      if (out.completed !== true) sub.push('chain did not complete (haltedAt=' + JSON.stringify(out.haltedAt) + ')');
      if (out.haltedAt !== null) sub.push('haltedAt is not null on a clean run');
      if (!Array.isArray(out.trace) || out.trace.length !== 3) sub.push('trace length is ' + (out.trace && out.trace.length) + ' (expected ONE trace with 3 entries)');
      // EXEC-02 output passing: step 2 must have SEEN step 1's chain_output.
      if (seen.length !== 3) sub.push('onStep ran ' + seen.length + ' times (expected 3)');
      else {
        if (seen[0].previousOutput !== null) sub.push('step 1 previousOutput should be null');
        if (seen[1].previousOutput !== 'out:lean-canvas') sub.push('step 2 did not receive step 1 chain_output (got ' + seen[1].previousOutput + ')');
        if (seen[2].previousOutput !== 'out:think-hats') sub.push('step 3 did not receive step 2 chain_output (got ' + seen[2].previousOutput + ')');
      }
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('acc1_three_autonomous_no_gate_one_trace', sub.length === 0, sub.length === 0
      ? 'three autonomous_safe steps ran end to end with no gate, output passed each hop, ONE trace of 3 entries (EXEC-01/02/04)'
      : sub.join('; '));
  }

  // =====================================================================
  // CHECK 2 -- hold-tagged step at position 2 halts; resume runs step 3 after APPROVE.
  // =====================================================================
  {
    const sub = [];
    try {
      const steps = [
        { step: 1, command: 'lean-canvas' },     // autonomous_safe -> auto-run
        { step: 2, command: 'compare-ventures' }, // hold -> halts
        { step: 3, command: 'mullins' },
      ];
      const autoSafe = { 'lean-canvas': true, 'compare-ventures': false, 'mullins': true };
      const seen = [];
      const out = runChain(steps, {
        postureFn: stubPostureFn(autoSafe),
        onStep: makeRecordingOnStep(seen),
        onHalt: function () { return 'approve'; },
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
      });
      if (out.completed !== false) sub.push('chain should NOT complete -- it must halt at the hold-tagged step 2');
      if (!out.haltedAt || out.haltedAt.reason !== 'gate_halt') sub.push('haltedAt.reason is ' + (out.haltedAt && out.haltedAt.reason) + ' (expected gate_halt)');
      if (!out.haltedAt || (out.haltedAt.step && out.haltedAt.step.command !== 'compare-ventures')) sub.push('halted at the wrong step: ' + (out.haltedAt && out.haltedAt.step && out.haltedAt.step.command));
      // Step 1 auto-ran (1 onStep), step 2 halted before dispatch.
      if (seen.length !== 1) sub.push('onStep ran ' + seen.length + ' times (expected 1 -- step 1 auto-ran, step 2 halted)');
      if (out.trace.length !== 1) sub.push('trace length is ' + out.trace.length + ' (expected 1 -- only step 1 completed before the halt)');

      // RESUME after APPROVE: re-run the remaining steps; step 1 is NOT re-run
      // (the resume sub-chain begins at the gated step). We drive the resume as
      // the caller would: re-invoke runChain over the remaining tail with the
      // hold step now APPROVED (autonomous-equivalent for this beat).
      const tail = [
        { step: 2, command: 'compare-ventures' },
        { step: 3, command: 'mullins' },
      ];
      const seen2 = [];
      const out2 = runChain(tail, {
        postureFn: stubPostureFn({ 'compare-ventures': true, 'mullins': true }),
        onStep: makeRecordingOnStep(seen2),
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
      });
      if (out2.completed !== true) sub.push('resume tail did not complete after APPROVE');
      if (seen2.some((s) => s.command === 'lean-canvas')) sub.push('resume RE-RAN step 1 (lean-canvas) -- B1 violation');
      if (seen2.length !== 2) sub.push('resume ran ' + seen2.length + ' steps (expected 2: step 2 + step 3)');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('acc2_hold_halts_resume_after_approve', sub.length === 0, sub.length === 0
      ? 'a hold-tagged step at position 2 auto-ran step 1, HALTED at step 2, and resumed step 3 after APPROVE without re-running step 1 (EXEC-03)'
      : sub.join('; '));
  }

  // =====================================================================
  // CHECK 3 -- quality:low forces a halt even on an autonomous_safe step.
  // =====================================================================
  {
    const sub = [];
    try {
      const steps = [
        { step: 1, command: 'lean-canvas' },
        { step: 2, command: 'think-hats' },  // autonomous_safe BUT inbound quality is low
        { step: 3, command: 'mullins' },
      ];
      const autoSafe = { 'lean-canvas': true, 'think-hats': true, 'mullins': true };
      // Step 1 emits quality:low; the gate must halt step 2 despite autonomous_safe.
      const seen = [];
      const out = runChain(steps, {
        postureFn: stubPostureFn(autoSafe),
        onStep: makeRecordingOnStep(seen, { 'lean-canvas': 'low' }),
        onHalt: function () { return 'defer'; },
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
      });
      // Step 1 ran and returned quality:low. The spine early-stops on a
      // gate-passed low-quality step (haltedAt.reason quality_early_stop), OR the
      // next gate halts on the low-quality carry. Either way the chain must NOT
      // complete and must NOT dispatch a downstream step after the low signal.
      if (out.completed !== false) sub.push('chain completed despite a quality:low step (garbage propagated)');
      const lowReason = out.haltedAt && (out.haltedAt.reason === 'quality_early_stop' || out.haltedAt.reason === 'gate_halt');
      if (!lowReason) sub.push('haltedAt.reason is ' + (out.haltedAt && out.haltedAt.reason) + ' (expected quality_early_stop or gate_halt on the low-quality carry)');
      // Defense-in-depth: assert the gate predicate itself halts an autonomous_safe
      // step when priorOutput.quality is low.
      const g = makeGateFn({ postureFn: stubPostureFn({ 'think-hats': true }) });
      const verb = g({ command: 'think-hats' }, null, { quality: 'low' });
      if (verb !== 'halt') sub.push('makeGateFn returned ' + verb + ' for an autonomous_safe step with priorOutput.quality=low (expected halt)');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('acc3_quality_low_forces_halt', sub.length === 0, sub.length === 0
      ? 'a quality:low output halts the chain even on an autonomous_safe step -- garbage-in-garbage-out propagation is stopped (EXEC-02 quality carry)'
      : sub.join('; '));
  }

  // =====================================================================
  // CHECK 4 -- an irreversible step forces a halt regardless of tag.
  // =====================================================================
  {
    const sub = [];
    try {
      // An autonomous_safe-tagged step whose command is irreversible (publish)
      // MUST still halt (forced-material HARD RULE).
      const steps = [
        { step: 1, command: 'lean-canvas' },
        { step: 2, command: 'publish-deck' }, // irreversible keyword 'publish'
      ];
      const autoSafe = { 'lean-canvas': true, 'publish-deck': true }; // tagged safe!
      const seen = [];
      const out = runChain(steps, {
        postureFn: stubPostureFn(autoSafe),
        onStep: makeRecordingOnStep(seen),
        onHalt: function () { return 'defer'; },
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
      });
      if (out.completed !== false) sub.push('chain completed -- an irreversible step did NOT halt (forced-material breach)');
      if (!out.haltedAt || out.haltedAt.reason !== 'forced_material') sub.push('haltedAt.reason is ' + (out.haltedAt && out.haltedAt.reason) + ' (expected forced_material)');
      if (seen.some((s) => s.command === 'publish-deck')) sub.push('the irreversible publish step was DISPATCHED before the gate halted it (T-166-28)');
      // Defense-in-depth: isIrreversibleStep recognizes the explicit flag + the keywords.
      if (isIrreversibleStep({ command: 'publish-deck' }) !== true) sub.push('isIrreversibleStep failed to flag a publish command');
      if (isIrreversibleStep({ command: 'send-email', irreversible: false }) !== true) sub.push('isIrreversibleStep failed to flag a send-email command');
      if (isIrreversibleStep({ command: 'whatever', irreversible: true }) !== true) sub.push('isIrreversibleStep ignored the explicit irreversible flag');
      if (isIrreversibleStep({ command: 'lean-canvas' }) !== false) sub.push('isIrreversibleStep false-flagged a reversible command');
      // The gate predicate halts an autonomous_safe irreversible step.
      const g = makeGateFn({ postureFn: stubPostureFn({ 'publish-deck': true }) });
      if (g({ command: 'publish-deck' }, null, null) !== 'halt') sub.push('makeGateFn ran an autonomous_safe irreversible step (forced-material breach)');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('acc4_irreversible_forces_halt', sub.length === 0, sub.length === 0
      ? 'an irreversible step (publish/email/deploy) is forced-material and halts regardless of an autonomous_safe tag, never dispatched (EXEC-03 HARD RULE)'
      : sub.join('; '));
  }

  // =====================================================================
  // CHECK 5 -- [stop] mid-chain flushes filed artifacts and ends cleanly.
  // =====================================================================
  {
    const sub = [];
    try {
      const steps = [
        { step: 1, command: 'lean-canvas' },
        { step: 2, command: 'compare-ventures' }, // hold -> halts; user types [stop]
        { step: 3, command: 'mullins' },
      ];
      const autoSafe = { 'lean-canvas': true, 'compare-ventures': false, 'mullins': true };
      const seen = [];
      const out = runChain(steps, {
        postureFn: stubPostureFn(autoSafe),
        onStep: makeRecordingOnStep(seen),
        onHalt: function () { return '[stop]'; }, // the kill switch
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
      });
      if (out.completed !== false) sub.push('chain completed -- a [stop] should end it as not-completed');
      if (!out.haltedAt || out.haltedAt.stopped !== true) sub.push('haltedAt.stopped is ' + (out.haltedAt && out.haltedAt.stopped) + ' (expected true -- the kill switch fired)');
      // The trace built ABOVE the stop is FLUSHED (preserved), never dropped:
      // step 1 completed and is in the trace.
      if (out.trace.length !== 1) sub.push('the pre-stop trace was dropped: trace length is ' + out.trace.length + ' (expected 1 -- step 1 flushed)');
      if (out.trace.length === 1 && out.trace[0].chain_output !== 'out:lean-canvas') sub.push('the flushed trace lost step 1 chain_output');
      // Step 3 never ran after [stop].
      if (seen.some((s) => s.command === 'mullins')) sub.push('step 3 ran AFTER [stop] -- the kill switch did not end the chain');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('acc5_stop_kill_switch_flushes', sub.length === 0, sub.length === 0
      ? '[stop] mid-chain ended the chain cleanly with the pre-stop trace flushed (preserved) and no downstream dispatch (EXEC-04 kill switch)'
      : sub.join('; '));
  }

  // =====================================================================
  // CHECK 6 -- resume from pipeline-state.json: step 1 is NOT re-run (B1 / D-166-02).
  // =====================================================================
  {
    const sub = [];
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-verdict-c6-'));
    try {
      // Init a chain in the SOLE source of truth (pipeline-state.json) and journal
      // step 1 as completed (chain_position advances to 0).
      pipelineState.initChain(roomDir, ['lean-canvas', 'think-hats', 'mullins'], 'manual');
      pipelineState.recordStep(roomDir, 'lean-canvas', 'chain-output:lean-canvas');
      const after1 = pipelineState.read(roomDir);
      if (!after1 || after1.chain_position !== 0) sub.push('after step 1 the journal chain_position is ' + (after1 && after1.chain_position) + ' (expected 0)');

      // The isNext hard gate: step 1 (already journaled) must NOT be next; step 2 IS.
      const gate1 = pipelineState.checkPosition(roomDir, 'lean-canvas');
      if (gate1.gate !== 'withhold' || gate1.reason !== 'not_next') sub.push('checkPosition(lean-canvas) gate=' + gate1.gate + ' reason=' + gate1.reason + ' (expected withhold/not_next -- step 1 already ran)');
      const gate2 = pipelineState.checkPosition(roomDir, 'think-hats');
      if (gate2.gate !== 'run') sub.push('checkPosition(think-hats) gate=' + gate2.gate + ' (expected run -- it is the resume re-entry point)');

      // Now resume the FULL chain through runChain with resume:true; the resilient
      // path SKIPS the journaled step 1 (no re-dispatch), re-enters at step 2.
      const seen = [];
      const out = await runChain(
        [
          { step: 1, command: 'lean-canvas' },
          { step: 2, command: 'think-hats' },
          { step: 3, command: 'mullins' },
        ],
        {
          postureFn: stubPostureFn({ 'lean-canvas': true, 'think-hats': true, 'mullins': true }),
          onStep: makeRecordingOnStep(seen),
          decideFn: function () { return { decision_trace: { tag: 'live' } }; },
          roomDir: roomDir,
          resume: true,
          journal: true,
        }
      );
      if (seen.some((s) => s.command === 'lean-canvas')) sub.push('RESUME RE-RAN step 1 (lean-canvas) -- B1 / D-166-02 violation: the isNext hard gate did not skip the journaled step');
      if (!seen.some((s) => s.command === 'think-hats')) sub.push('resume did not run step 2 (think-hats) -- the re-entry point was skipped');
      // The sole-truth marker is the documented invariant.
      if (pipelineState.CHAIN_STATE_SOURCE !== 'pipeline-state.json') sub.push('CHAIN_STATE_SOURCE is ' + pipelineState.CHAIN_STATE_SOURCE + ' (expected pipeline-state.json -- the sole truth marker, B1)');
      void out;
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
    record('acc6_resume_does_not_rerun_upstream', sub.length === 0, sub.length === 0
      ? 'a chain killed at step 2 resumes from pipeline-state.json (the sole truth) and does NOT re-run step 1 -- the isNext hard gate skips the journaled step (B1 / D-166-02)'
      : sub.join('; '));
  }

  // =====================================================================
  // CHECK 7 -- Part 8 leak sweep (delegate to the leak-scan suite).
  // =====================================================================
  {
    const leakSuite = path.join(__dirname, 'test-chain-executor-part8-leak.cjs');
    try {
      execFileSync(process.execPath, [leakSuite], { stdio: 'pipe' });
      record('acc7_part8_no_brain_egress', true, 'the Part 8 leak scan over all Phase-166 surfaces exits zero -- no Brain-write / raw-fetch / external-http token; posture joined from the LOCAL registry only (B4 / D-166-03)');
    } catch (e) {
      const out = (e && e.stdout ? e.stdout.toString() : '') + (e && e.stderr ? e.stderr.toString() : '');
      record('acc7_part8_no_brain_egress', false, 'the Part 8 leak scan FAILED: ' + out.split('\n').filter((l) => l.indexOf('XX') !== -1).join(' | ').slice(0, 300));
    }
  }

  // =====================================================================
  // CHECK 8 -- regression: the Wave-4..7 migration suites stay green.
  // =====================================================================
  {
    const sub = [];
    const regressionSuites = [
      'test-act-on-runchain.cjs',
      'test-pipeline-on-runchain.cjs',
      'test-ignite-on-runchain.cjs',
      'test-larry-handoff-seam.cjs',
    ];
    for (const s of regressionSuites) {
      const p = path.join(__dirname, s);
      if (!fs.existsSync(p)) { sub.push('MISSING migration suite: ' + s); continue; }
      try {
        execFileSync(process.execPath, [p], { stdio: 'pipe' });
      } catch (_e) {
        sub.push('migration suite FAILED: ' + s);
      }
    }
    record('acc8_migration_suites_green', sub.length === 0, sub.length === 0
      ? 'the act/pipeline/ignite/larry migration suites all exit zero -- the migration onto runChain did not regress the shipped surfaces'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD B2 -- decide()'s return shape is recorded UNCHANGED in the trace.
  // =====================================================================
  {
    const sub = [];
    try {
      // A decideFn whose return we OWN, so we can prove the trace handle is the
      // SAME reference (never a copy / reshape -- B2: the executor never mutates
      // decide()'s return).
      const sentinelTrace = { brain_md_tier_mode: 'tier_0', sql_signals: { x: 1 }, _sentinel: Symbol('b2') };
      const decision = { fire_skill: 'lean-canvas', offer_next_step: null, decision_trace: sentinelTrace };
      let recordedHandle = null;
      const out = runChain(
        [{ step: 1, command: 'lean-canvas' }],
        {
          postureFn: stubPostureFn({ 'lean-canvas': true }),
          onStep: function () { return { chain_output: 'x', quality: 'high' }; },
          decideFn: function () { return decision; },
        }
      );
      recordedHandle = out.trace[0] && out.trace[0].decision_trace;
      // Reference identity: the recorded handle IS decide()'s decision_trace.
      if (recordedHandle !== sentinelTrace) sub.push('the recorded decision_trace is NOT the same reference decide() returned (B2: shape was copied/reshaped)');
      // Deep-equal: nothing was mutated.
      try {
        assert.deepStrictEqual(recordedHandle, sentinelTrace);
      } catch (_e) {
        sub.push('the recorded decision_trace is not deep-equal to decide()s return (B2 mutation)');
      }
      // The decision object itself is untouched (no keys added/removed).
      if (Object.keys(decision).sort().join(',') !== 'decision_trace,fire_skill,offer_next_step') sub.push('the decision object keys changed (B2: decide() return mutated)');
      // Defense-in-depth against the LIVE decide(): the real engine still returns
      // the documented 5-key shape after the executor calls it in a loop.
      const ne = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));
      const live = ne.decide({ step: { command: 'lean-canvas' }, index: 0 }, { previousOutput: null });
      const liveKeys = Object.keys(live).sort().join(',');
      if (liveKeys !== 'decision_trace,fire_skill,offer_next_step,persona_updates,suppress_skills') sub.push('LIVE decide() return shape drifted: ' + liveKeys);
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('guard_b2_decide_shape_unchanged', sub.length === 0, sub.length === 0
      ? 'decide()s decision_trace is recorded by REFERENCE in the chain trace (deep-equal, no reshape) and the LIVE decide() still returns its documented 5-key shape (B2)'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD B3 -- NO autonomous-convergence stop branch (dedicated NEGATIVE grep).
  // =====================================================================
  {
    const sub = [];
    try {
      const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'), 'utf8');
      // Strip comment lines (grep -v '^#'-style filtering for CJS) so a doc-comment
      // that names the REJECTED convergence pattern (the header explicitly says
      // "NO convergence stop (B3) ... is REJECTED") cannot self-invalidate the
      // count. We scan the CODE only.
      const codeLines = src.split('\n').filter((line) => {
        const t = line.replace(/^[\s]+/, '');
        return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
      });
      const code = codeLines.join('\n');
      // The forbidden autonomous-convergence stop-condition patterns. If any
      // matches the CODE, the harness "loop until all features pass" stop branch
      // was smuggled in -- a B3 breach (T-166-33).
      const FORBIDDEN = [
        /all.?passing/i,
        /all.?green/i,
        /loop until all/i,
        /until.*converge/i,
        /convergence/i,
      ];
      for (const re of FORBIDDEN) {
        if (re.test(code)) sub.push('chain-executor.cjs CODE matches a forbidden convergence-stop pattern: ' + re.toString());
      }
      // Positive proof that the legitimate posture/quality/maxSteps stop conditions
      // ARE present (the chain halts on posture per Part 3, never on convergence).
      if (!/gate_halt/.test(code)) sub.push('the posture gate_halt stop condition is missing (the chain has no Part 3 halt)');
      if (!/budget_brake/.test(code)) sub.push('the maxSteps budget_brake stop condition is missing (EXEC-06)');
      if (!/quality_early_stop/.test(code)) sub.push('the quality_early_stop condition is missing (EXEC-02 carry)');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('guard_b3_no_convergence_stop', sub.length === 0, sub.length === 0
      ? 'chain-executor.cjs CODE (comments stripped) has NO autonomous-convergence termination branch; the only stop conditions are posture (gate_halt), quality (quality_early_stop), and the budget brake -- the chain halts on posture per Part 3, never on convergence (B3 by instrumentation, mirroring B2)'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD B4 -- the three recipe maps are layered, read each for one job, none merged.
  // =====================================================================
  {
    const sub = [];
    try {
      // postureForCommand (JOB 1: posture authority) returns the posture shape.
      const pv = recipeMaps.postureForCommand('lean-canvas');
      if (!pv || typeof pv.autonomous_safe !== 'boolean' || typeof pv.posture !== 'string') sub.push('postureForCommand did not return the { autonomous_safe, posture } authority shape');
      // wiringForReach (JOB 2: reach -> surface) returns an array.
      const wiring = recipeMaps.wiringForReach('act');
      if (!Array.isArray(wiring)) sub.push('wiringForReach did not return an array (JOB 2 wiring authority)');
      // rankedNextReach (JOB 3: ranked next-reach) returns an array (contract-only reader).
      const ranked = recipeMaps.rankedNextReach();
      if (!Array.isArray(ranked)) sub.push('rankedNextReach did not return an array (JOB 3 contract-only reader)');
      // An unknown command degrades to a withhold-default -- NEVER a fabricated
      // autonomous_safe (T-166-02).
      const unknown = recipeMaps.postureForCommand('totally-made-up-command-xyz');
      if (unknown.autonomous_safe !== false || unknown.posture !== 'halt') sub.push('an unknown command did NOT degrade to a withhold-default (fabricated autonomous_safe risk, T-166-02)');
      // The three are distinct exports (layered, not merged into one mega-map).
      const exp = Object.keys(recipeMaps);
      for (const fn of ['postureForCommand', 'wiringForReach', 'rankedNextReach']) {
        if (exp.indexOf(fn) === -1) sub.push('recipe-maps is missing the ' + fn + ' authority (the three maps must stay layered)');
      }
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('guard_b4_three_map_authority_layered', sub.length === 0, sub.length === 0
      ? 'recipe-maps exposes three layered authorities (postureForCommand / wiringForReach / rankedNextReach), each read for one job; an unknown command degrades to a withhold-default, never a fabricated autonomous_safe (B4 / D-166-03 / T-166-02)'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD Part 9 -- the chain journal writes bookkeeping, never a confirmed truth-claim.
  // =====================================================================
  {
    const sub = [];
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-verdict-p9-'));
    try {
      pipelineState.initChain(roomDir, ['lean-canvas', 'think-hats'], 'manual');
      const seen = [];
      await runChain(
        [{ step: 1, command: 'lean-canvas' }, { step: 2, command: 'think-hats' }],
        {
          postureFn: stubPostureFn({ 'lean-canvas': true, 'think-hats': true }),
          onStep: makeRecordingOnStep(seen),
          decideFn: function () { return { decision_trace: { tag: 'live' } }; },
          roomDir: roomDir,
          journal: true,
        }
      );
      // The journaled history is a generic step handle ('chain-output:<command>'),
      // never a confirmed truth-claim node carrying user content (Part 9: the spine
      // writes bookkeeping, the human confirms truth). No review_status:confirmed
      // truth-claim is written by the spine.
      const state = pipelineState.read(roomDir);
      if (!state || !Array.isArray(state.history)) sub.push('no journal history was written');
      else {
        for (const h of state.history) {
          if (typeof h.output_path !== 'string') sub.push('a journal entry carries a non-string output_path (possible body leak)');
          if (/review_status/.test(JSON.stringify(h))) sub.push('a journal entry carries a review_status (the spine must NOT confirm truth-claims -- Part 9 role 5)');
        }
        // The handle is the generic 'chain-output:<command>' reference, not a body.
        const leak = state.history.find((h) => h.output_path && h.output_path.indexOf('out:') === 0);
        if (leak) sub.push('a journal entry stored the chain_output BODY (' + leak.output_path + ') -- Part 8/9 body leak');
      }
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
    record('guard_part9_journal_is_bookkeeping_not_truth', sub.length === 0, sub.length === 0
      ? 'the chain journal records a generic step handle (chain-output:<command>), never a confirmed truth-claim node and never the chain_output body -- the spine writes bookkeeping; the human confirms truth (Part 9)'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD EXEC-05 -- a transient 5xx exhaustion returns a graceful partial.
  // =====================================================================
  {
    const sub = [];
    try {
      // Step 2 always throws a transient 503; retries exhaust; the chain must
      // return a GRACEFUL PARTIAL preserving the upstream (step 1) trace -- never
      // a silent drop (SEED-028 / the AION failure mode).
      let calls = 0;
      const out = await runChain(
        [{ step: 1, command: 'lean-canvas' }, { step: 2, command: 'think-hats' }],
        {
          postureFn: stubPostureFn({ 'lean-canvas': true, 'think-hats': true }),
          onStep: function (step) {
            if (step.command === 'think-hats') {
              calls += 1;
              const e = new Error('Service Unavailable 503');
              e.status = 503;
              throw e;
            }
            return { chain_output: 'out:' + step.command, quality: 'high' };
          },
          decideFn: function () { return { decision_trace: { tag: 'live' } }; },
          retries: 2,
          sleep: function () { return Promise.resolve(); }, // no real wait
        }
      );
      if (out.partial !== true) sub.push('the run did not return partial:true on retry exhaustion');
      if (out.completed !== false) sub.push('the run reported completed:true despite an exhausted transient failure');
      // Upstream PRESERVED: step 1 is in the trace; step 2 is the partial marker.
      const step1 = out.trace.find((t) => t.step && t.step.command === 'lean-canvas');
      if (!step1 || step1.chain_output !== 'out:lean-canvas') sub.push('the upstream step 1 trace was NOT preserved on the partial (silent drop)');
      const failMarker = out.trace.find((t) => t.partial === true && t.failure);
      if (!failMarker) sub.push('no failure marker was folded into the trace (the partial was a silent drop)');
      else if (failMarker.failure.code !== 503) sub.push('the failure marker code is ' + failMarker.failure.code + ' (expected 503)');
      // Retries were actually attempted (the bounded retry fired): initial + 2 retries = 3.
      if (calls < 2) sub.push('the transient onStep was attempted only ' + calls + ' time(s) (the bounded retry did not fire)');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('guard_exec05_graceful_partial', sub.length === 0, sub.length === 0
      ? 'a transient 5xx exhaustion returns a graceful partial -- the upstream trace is preserved, a failure marker (code 503) is folded into the ONE trace, never a silent drop (EXEC-05 / SEED-028)'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD EXEC-06 -- maxSteps caps the run (the budget brake).
  // =====================================================================
  {
    const sub = [];
    try {
      const steps = [];
      const autoSafe = {};
      for (let i = 1; i <= 10; i += 1) { steps.push({ step: i, command: 'cmd' + i }); autoSafe['cmd' + i] = true; }
      const seen = [];
      const out = runChain(steps, {
        postureFn: stubPostureFn(autoSafe),
        onStep: makeRecordingOnStep(seen),
        decideFn: function () { return { decision_trace: { tag: 'live' } }; },
        maxSteps: 3, // cap below the chain length
      });
      if (out.completed !== false) sub.push('the chain completed despite maxSteps below its length (the budget brake did not fire)');
      if (!out.haltedAt || out.haltedAt.reason !== 'budget_brake') sub.push('haltedAt.reason is ' + (out.haltedAt && out.haltedAt.reason) + ' (expected budget_brake)');
      if (out.haltedAt && out.haltedAt.maxSteps !== 3) sub.push('the budget_brake did not record maxSteps=3');
      if (seen.length > 3) sub.push('onStep ran ' + seen.length + ' times (expected at most 3 -- the cap)');
    } catch (e) {
      sub.push('threw: ' + (e && e.message ? e.message : String(e)));
    }
    record('guard_exec06_maxsteps_cap', sub.length === 0, sub.length === 0
      ? 'maxSteps caps the run -- a chain longer than the cap halts with a budget_brake at the cap, never running past it (EXEC-06)'
      : sub.join('; '));
  }

  // =====================================================================
  // GUARD no-em-dash -- the Phase-166 lib surfaces carry no U+2014.
  // =====================================================================
  {
    const sub = [];
    // U+2014 via codepoint escape so THIS verdict file carries no literal em-dash
    // to trip its own sweep (the run-all-166.sh discipline).
    const EMDASH = String.fromCharCode(0x2014);
    const libSurfaces = [
      'lib/core/chain-executor.cjs',
      'lib/core/chain-retry.cjs',
      'lib/core/recipe-maps.cjs',
      'lib/mcp/pipeline-state.cjs',
      'tests/test-chain-executor-verdict.cjs',
      'tests/test-chain-executor-part8-leak.cjs',
    ];
    for (const rel of libSurfaces) {
      const abs = path.join(REPO, rel);
      if (!fs.existsSync(abs)) { sub.push('MISSING em-dash target: ' + rel); continue; }
      if (fs.readFileSync(abs, 'utf8').indexOf(EMDASH) !== -1) sub.push('FORBIDDEN em-dash in: ' + rel);
    }
    record('guard_no_em_dash', sub.length === 0, sub.length === 0
      ? 'no em-dash (U+2014) across the Phase-166 lib surfaces + the Wave-8 verdict/leak suites (CLAUDE.md HARD RULE)'
      : sub.join('; '));
  }

  // ---------------------------------------------------------------------
  // The structured verdict.
  // ---------------------------------------------------------------------
  const passed = findings.every((f) => f.passed);
  const verdict = { passed, findings };

  console.log(SUITE);
  for (const f of findings) {
    console.log('  ' + (f.passed ? 'ok' : 'XX') + ' - ' + f.check + ': ' + f.detail);
  }
  console.log('\nVERDICT: ' + JSON.stringify({ passed: verdict.passed, checks: findings.map((f) => ({ check: f.check, passed: f.passed })) }));

  if (!passed) {
    console.error('\n' + SUITE + ': FAIL -- adversarial verdict found ' + findings.filter((f) => !f.passed).length + ' defect(s) above.');
    process.exit(1);
  }
  console.log('\n' + SUITE + ': PASS (' + findings.length + '/' + findings.length + ' checks; the runChain spine honors the constitution)');
  process.exit(0);
}

runVerdict().catch((e) => {
  console.error(SUITE + ': FAIL (verdict harness threw): ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
