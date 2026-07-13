#!/usr/bin/env node
'use strict';
/*
 * Phase 221 Plan 04 -- THE PERMANENT VANTAGE FIXTURE (matrix class 13).
 *
 * This file exists so the Phase-218 vantage lesson can never be quietly
 * dropped in a refactor (annex 10, 221-INPUT-MANUS-RECOVERY.md; T-221-21).
 *
 * THE LESSON (the correction record, annex 10): Manus's original "Phase 218
 * missing" verdict was WRONG - the phase was not independently visible from
 * the accessible remote baseline; local existence was authoritative
 * user-supplied state pending sync. Absence-of-evidence from ONE vantage is
 * never evidence-of-absence for the PROJECT.
 *
 * THE RULE (structural, not just tested): when an AUTHORITATIVE workspace's
 * envelope is blocked or failed (the workspace is UNAVAILABLE, not empty)
 * while an accessible corpus legitimately lacks the entity (empty_valid),
 * the composed result carries a CORPUS-scoped PROVISIONAL gap tagged
 * 'authoritative_workspace_unavailable' - and composeRecoveryResult has NO
 * code path capable of emitting a project-scoped nonexistence claim from
 * that input. This suite asserts the behavior (V1-V3), the full-pipeline
 * seam (V4), and the structural property in the SOURCE itself (V5).
 *
 * Hermetic: stubs only, zero network. No em-dashes anywhere (CLAUDE.md).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let passed = 0;
let failed = 0;

function record(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

async function recordAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

const REPO_ROOT = path.resolve(__dirname, '..');
const se = require(path.join(REPO_ROOT, 'lib', 'core', 'recovery', 'stage-envelope.cjs'));
const rs = require(path.join(REPO_ROOT, 'lib', 'core', 'recovery', 'result-semantics.cjs'));
const driver = require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));

const RS_SOURCE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'recovery', 'result-semantics.cjs');
const TAG = 'authoritative_workspace_unavailable';

// Wording that would claim project-level nonexistence. The FULL serialized
// result must never match any of these (the negative assertion the fixture
// exists for).
const NONEXISTENCE_CLAIMS = /does not exist|nonexistent|no such (entity|phase|node)|missing from the project|absent from the project|"scope":"project"/i;

function envAuthUnavailable(failureClass) {
  const cls = failureClass || 'engine_unavailable';
  const status = (cls === 'network_timeout') ? 'failed' : 'blocked';
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: 'authoritative-workspace',
    status: status, failure_class: cls,
    retryable: cls === 'network_timeout',
    error: 'workspace unavailable this run',
    payload: { authoritative: true },
  });
}

function envCorpusEmpty() {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: 'room-corpus', status: 'empty_valid',
    payload: { results: [] }, output: [],
    provenance: ['room-corpus'],
  });
}

(async function main() {
  record('V1 THE FIXTURE: authoritative workspace unavailable + accessible corpus legitimately empty -> corpus-scoped PROVISIONAL gap tagged ' + TAG, function () {
    const out = rs.composeRecoveryResult({
      envelopes: [envAuthUnavailable(), envCorpusEmpty()],
      dispatch: null,
      recovery: null,
      ctx: { requestedScope: ['workspace', 'local'], authoritativeEngines: ['authoritative-workspace'] },
    });
    const gap = out.disclosure.unresolved_gaps.find(function (g) { return g.tag === TAG; });
    assert.ok(gap, 'the vantage gap is present');
    assert.equal(gap.scope, 'corpus', 'CORPUS-scoped, never project');
    assert.ok(/provisional/i.test(gap.detail), 'provisional wording');
    assert.ok(/authoritative workspace/i.test(gap.detail), 'names the unavailable authority');
    // The mode is honest about the degraded vantage: zero content anywhere
    // composes insufficient_evidence, never normal.
    assert.equal(out.research_mode, 'insufficient_evidence', 'degraded vantage disclosed honestly');
    assert.notEqual(out.outcome, 'recovered', 'nothing is recovered out of absence');
  });

  record('V2 the NEGATIVE assertion: the FULL serialized result never claims project-level nonexistence', function () {
    const out = rs.composeRecoveryResult({
      envelopes: [envAuthUnavailable(), envCorpusEmpty()],
      dispatch: null,
      recovery: null,
      ctx: { requestedScope: ['workspace'], authoritativeEngines: ['authoritative-workspace'] },
    });
    const serialized = JSON.stringify(out);
    assert.ok(!NONEXISTENCE_CLAIMS.test(serialized),
      'no project-level nonexistence wording anywhere in the composed result: ' + serialized.slice(0, 200));
  });

  record('V3 permutation sweep: every unavailability class x input order keeps the gap corpus-scoped (no input combination reaches a project scope)', function () {
    const classes = ['engine_unavailable', 'missing_credential', 'network_timeout', 'policy_blocked'];
    for (const cls of classes) {
      for (const envelopes of [
        [envAuthUnavailable(cls), envCorpusEmpty()],
        [envCorpusEmpty(), envAuthUnavailable(cls)],
      ]) {
        // Both identification channels: ctx list AND the payload marker.
        for (const ctx of [
          { requestedScope: ['workspace'], authoritativeEngines: ['authoritative-workspace'] },
          { requestedScope: ['workspace'] }, // payload.authoritative:true carries it alone
        ]) {
          const out = rs.composeRecoveryResult({ envelopes: envelopes, dispatch: null, recovery: null, ctx: ctx });
          const gap = out.disclosure.unresolved_gaps.find(function (g) { return g.tag === TAG; });
          assert.ok(gap, 'vantage gap present for class ' + cls);
          assert.equal(gap.scope, 'corpus', 'corpus scope for class ' + cls);
          for (const g of out.disclosure.unresolved_gaps) {
            assert.equal(g.scope, 'corpus', 'EVERY gap is corpus-scoped');
          }
          assert.ok(!NONEXISTENCE_CLAIMS.test(JSON.stringify(out)), 'no nonexistence claim for class ' + cls);
        }
      }
    }
  });

  await recordAsync('V4 the FULL pipeline seam: runSourceLens with the authoritative lens down + the accessible corpus empty carries the vantage gap in its disclosure', async function () {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'phase 218 entity',
      lensSet: [{ lens: 'brain', weight: 1.0 }, { lens: 'industry', weight: 0.8 }],
      preflight: { current_section: 'x', evidence_gaps: [], prior_research: [] },
      stage: 'explore',
      origin: 'cadence', // honest termination path (no unattended Tier-3)
      _sleep: async function () {},
      authoritativeEngines: ['brain-cypher'],
      _fetchCorpusEnvelope: async function (args) {
        if (args.source === 'brain-cypher') {
          return se.makeStageEnvelope({
            stage: 'retrieval', engine: 'brain-cypher', status: 'blocked',
            failure_class: 'engine_unavailable', error: 'authoritative workspace unreachable',
          });
        }
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'empty_valid',
          payload: { results: [] }, output: [],
        });
      },
      _substituteFn: async function () { return null; },
    });
    assert.equal(res.ok, true);
    assert.ok(res.disclosure, 'the disclosure rides the pipeline result');
    const gap = res.disclosure.unresolved_gaps.find(function (g) { return g.tag === TAG; });
    assert.ok(gap, 'the vantage gap survives the full pipeline seam');
    assert.equal(gap.scope, 'corpus');
    assert.ok(!NONEXISTENCE_CLAIMS.test(JSON.stringify(res.disclosure)), 'no project-level nonexistence out of the pipeline');
    assert.equal(res.findings.length, 0, 'no invented findings from absence');
    assert.notEqual(res.outcome, 'recovered', 'absence is never recovered');
  });

  record('V5 STRUCTURAL: the composer source has no project-scope emission path (comment-filtered source scan)', function () {
    const src = fs.readFileSync(RS_SOURCE_PATH, 'utf8');
    const codeLines = src.split('\n').filter(function (line) {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    });
    const code = codeLines.join('\n');
    assert.ok(!/scope\s*[:=]\s*['"]project['"]/.test(code),
      'NO code path assigns a project scope - the vantage rule is structural');
    assert.ok(/GAP_SCOPE\s*=\s*'corpus'/.test(code),
      'the single scope constant is corpus');
    // Every gap literal routes through the constant (no second scope source).
    const scopeAssignments = code.match(/scope\s*:\s*[A-Za-z_$][\w$]*/g) || [];
    for (const a of scopeAssignments) {
      assert.ok(/scope\s*:\s*GAP_SCOPE/.test(a), 'every gap uses GAP_SCOPE: ' + a);
    }
    assert.ok(scopeAssignments.length >= 1, 'the gap constructor exists and routes through the constant');
  });

  console.log('=== 221-04 vantage fixture (PERMANENT): ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) process.exit(1);
})().catch(function (err) {
  console.error('suite crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
