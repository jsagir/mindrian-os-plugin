#!/usr/bin/env node
'use strict';
/*
 * Phase 221 Plan 04 -- REQ-4 result semantics + REQ-5 validation matrix.
 *
 * Task 1 groups (S): the result-semantics composer + additive seam wiring
 *   S1 all-ok run: research_mode 'normal', outcome null, empty failed_engines
 *      (byte-honest no-op); RESEARCH_MODES extends the 219 four ADDITIVELY;
 *      OUTCOMES is the frozen annex-6 five
 *   S2 Tier-3-recovered run: research_mode 'llm_engine_recovery', disclosure
 *      complete; outcome 'recovered' ONLY when contracts pass AND filing is
 *      readback-confirmed; an unconfirmed filing forces partial_recovery
 *   S3 dispatch human_required -> 'manual_intervention_required' (mode +
 *      outcome); policy_blocked maps terminally
 *   S4 the VANTAGE RULE (unit level): authoritative-source blocked +
 *      accessible corpus empty_valid -> unresolved_gaps {scope:'corpus',
 *      tag:'authoritative_workspace_unavailable'}; NO input combination
 *      produces a project-scoped nonexistence gap from absence alone
 *   S5 additive seams: the landed 219/220 fields on exploreOpportunity /
 *      queryRoomCorpus / ingestUrl are ALL still present unrenamed, with the
 *      full stage envelope + disclosure riding alongside (D-02)
 *
 * Task 2 group (P): the D-08 doc-parity gate (the 219-05 grep idiom)
 *   P1 all 12 tokens (six research_mode values + five outcomes +
 *      'spend_limit_exceeded', D-11) grep >0 in BOTH commands/research.md and
 *      skills/research/SKILL.md; 'paid -> native' greps 0 in both; the added
 *      documentation carries zero em-dashes
 *
 * Task 3 groups (C): the 14-class REQ-5 validation matrix, fixture-first,
 *   offline, driven through the REAL pipeline seam (runSourceLens /
 *   dispatchRecovery / runRecovery / composeRecoveryResult with stubs +
 *   MINDRIAN_FORCE_* seams). Class 13 (the vantage fixture) lives in its own
 *   PERMANENT file, tests/test-221-vantage.cjs, so it can never be quietly
 *   dropped in a refactor. Class 14 (spend_limit_exceeded, D-11) is the
 *   second self-validated permanent class, proven END TO END here (Plan 02's
 *   dispatcher D7 already pins the unit level).
 *
 * Hermetic: every engine stubbed, zero network, temp fixture rooms.
 * No em-dashes anywhere (CLAUDE.md HARD RULE). CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

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

// ---------- envelope fixtures ----------

function envOk(engine, items) {
  const results = Array.isArray(items) ? items : [{ id: 'https://x/' + engine }];
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine, status: 'ok',
    payload: { results: results }, output: results,
  });
}
function envEmpty(engine) {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine, status: 'empty_valid',
    payload: { results: [] }, output: [],
  });
}
function envFail(engine, failureClass, retryable) {
  const d = { network_timeout: 'failed', engine_unavailable: 'blocked', policy_blocked: 'blocked' };
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine,
    status: d[failureClass] || 'failed',
    failure_class: failureClass, retryable: retryable === true,
    error: 'forced_' + failureClass,
  });
}

function tier3Recovery(overrides) {
  return Object.assign({
    outcome: 'recovered',
    profile: 'high_effort',
    case_dir: '/tmp/case', run_id: 'r1',
    bundle: {
      resume_stage: 'retrieval',
      recovered_payloads: [{ id: 'payload-1', fingerprint: 'f'.repeat(64) }],
      claims: [{ claim: 'claim text', state: 'supported', evidence: ['payload-1'], locator: 'doc#1', origin: 'payload_claim' }],
    },
    filing: { attempted: true, confirmed_by_readback: true, reason: null },
    model: { model: 'capability-resolved', version: 'v1' },
    budget: { exhausted: false, stopped_on: null },
  }, overrides || {});
}

(async function main() {
  // =========================================================================
  // Task 1 group S -- the result-semantics composer (D-08).
  // =========================================================================

  record('S0 exports: composeRecoveryResult + deriveCoverage functions; RESEARCH_MODES extends the 219 four ADDITIVELY; OUTCOMES is the annex-6 five', function () {
    assert.equal(typeof rs.composeRecoveryResult, 'function');
    assert.equal(typeof rs.deriveCoverage, 'function');
    // D-08: the 219-shipped four, unrenamed, in place, PLUS the two new values.
    for (const m of driver.RESEARCH_MODES) {
      assert.ok(rs.RESEARCH_MODES.includes(m), '219 mode ' + m + ' survives unrenamed');
    }
    assert.ok(rs.RESEARCH_MODES.includes('llm_engine_recovery'), 'llm_engine_recovery added');
    assert.ok(rs.RESEARCH_MODES.includes('manual_intervention_required'), 'manual_intervention_required added');
    assert.equal(rs.RESEARCH_MODES.length, driver.RESEARCH_MODES.length + 2, 'ADDITIVE: exactly two new values');
    assert.deepEqual(rs.OUTCOMES.slice().sort(), [
      'insufficient_evidence', 'manual_intervention_required', 'partial_recovery', 'policy_blocked', 'recovered',
    ], 'the annex-6 outcome five');
  });

  record('S1 all-ok run: research_mode normal, outcome null, empty failed_engines (byte-honest no-op)', function () {
    const out = rs.composeRecoveryResult({
      envelopes: [envOk('tavily'), envOk('openalex')],
      dispatch: null,
      recovery: null,
      ctx: { requestedScope: ['industry', 'scholarly'] },
    });
    assert.equal(out.research_mode, 'normal');
    assert.strictEqual(out.outcome, null, 'no failure -> outcome null, never an invented verdict');
    assert.deepEqual(out.disclosure.failed_engines, [], 'nothing failed');
    assert.equal(out.disclosure.recovery_profile, null);
    assert.deepEqual(out.disclosure.recovery_paths, []);
    assert.equal(out.disclosure.filing.attempted, false);
    assert.deepEqual(out.disclosure.unresolved_gaps, []);
  });

  record('S2a Tier-3-recovered run: research_mode llm_engine_recovery + the COMPLETE disclosure (failed_engines, profile, paths, coverage, freshness, filing, model)', function () {
    const failedEnv = envFail('tavily', 'network_timeout', true);
    const out = rs.composeRecoveryResult({
      envelopes: [failedEnv, envOk('openalex')],
      dispatch: {
        action: 'offer_tier3', outcome: null, resume_stage: 'retrieval',
        attempts: [{ tier: 1, engine: 'tavily', stage: 'retrieval', attempt: 1, result: 'failed' }],
        substitutions: [], unresolved: [{ stage: 'retrieval', engine: 'tavily', failure_class: 'network_timeout' }],
        budget: { retries_used: 1, engines_tried: 0, exhausted: false },
      },
      recovery: tier3Recovery(),
      ctx: { requestedScope: ['industry', 'scholarly'] },
    });
    assert.equal(out.research_mode, 'llm_engine_recovery',
      'Tier-3 contributed content -> the run is DISCLOSED as llm_engine_recovery');
    assert.equal(out.outcome, 'recovered', 'contracts pass + readback-confirmed filing -> recovered');
    // The annex-6 disclosure, complete:
    const d = out.disclosure;
    assert.deepEqual(d.failed_engines, [{ stage: 'retrieval', engine: 'tavily', failure_class: 'network_timeout' }]);
    assert.equal(d.recovery_profile, 'high_effort');
    assert.ok(Array.isArray(d.recovery_paths) && d.recovery_paths.length >= 1, 'paths used are named');
    assert.ok(d.recovery_paths.some(function (p) { return p.indexOf('tier3') !== -1; }), 'the Tier-3 path is named');
    assert.deepEqual(d.coverage.requested, ['industry', 'scholarly']);
    assert.ok(Array.isArray(d.coverage.supported) && Array.isArray(d.coverage.conflicting)
      && Array.isArray(d.coverage.unsupported), 'coverage buckets present');
    assert.equal(typeof d.freshness.live_verified, 'boolean');
    assert.ok('newest_source_at' in d.freshness && 'warning' in d.freshness, 'freshness fields present');
    assert.deepEqual(d.filing, { attempted: true, confirmed_by_readback: true, reason: null });
    assert.deepEqual(d.model, { model: 'capability-resolved', version: 'v1' }, 'model+version recorded');
  });

  record('S2b readback-UNCONFIRMED filing forces partial_recovery even when the controller claims recovered', function () {
    const out = rs.composeRecoveryResult({
      envelopes: [envFail('tavily', 'network_timeout', true)],
      dispatch: {
        action: 'offer_tier3', outcome: null, resume_stage: 'retrieval',
        attempts: [], substitutions: [],
        unresolved: [{ stage: 'retrieval', engine: 'tavily', failure_class: 'network_timeout' }],
        budget: { retries_used: 0, engines_tried: 0, exhausted: false },
      },
      recovery: tier3Recovery({
        filing: { attempted: true, confirmed_by_readback: false, reason: 'filing_did_not_land' },
      }),
      ctx: { requestedScope: ['industry'] },
    });
    assert.equal(out.outcome, 'partial_recovery',
      'an attempted-but-unconfirmed filing can NEVER compose recovered (annex 6)');
    assert.equal(out.disclosure.filing.confirmed_by_readback, false);
    assert.equal(out.disclosure.filing.reason, 'filing_did_not_land');
  });

  record('S2c a malformed stage envelope (contract violation) blocks recovered even with a confirmed filing', function () {
    const bad = envOk('tavily');
    bad.status = 'failed'; // failed without failure_class = contract violation
    const out = rs.composeRecoveryResult({
      envelopes: [bad],
      dispatch: null,
      recovery: tier3Recovery(),
      ctx: { requestedScope: ['industry'] },
    });
    assert.notStrictEqual(out.outcome, 'recovered',
      'recovered ONLY when every required stage contract passes');
  });

  record('S3a dispatch human_required -> research_mode manual_intervention_required + the same-named outcome; the actionable message rides the disclosure', function () {
    const spendEnv = envFail('tavily', 'spend_limit_exceeded');
    const MSG = 'Account-level LLM spend limit exhausted: raise your limit at claude.ai/settings/usage, or wait for the monthly reset.';
    const out = rs.composeRecoveryResult({
      envelopes: [spendEnv],
      dispatch: {
        action: 'human_required', outcome: 'manual_intervention_required',
        message: MSG, resume_stage: 'retrieval',
        attempts: [], substitutions: [],
        unresolved: [{ stage: 'retrieval', engine: 'tavily', failure_class: 'spend_limit_exceeded' }],
        budget: { retries_used: 0, engines_tried: 0, exhausted: false },
      },
      recovery: null,
      ctx: { requestedScope: ['industry'] },
    });
    assert.equal(out.research_mode, 'manual_intervention_required');
    assert.equal(out.outcome, 'manual_intervention_required');
    assert.ok(JSON.stringify(out.disclosure).indexOf('claude.ai/settings/usage') !== -1,
      'the exact actionable message is IN the disclosure');
  });

  record('S3b dispatch policy_blocked maps terminally: outcome policy_blocked, never softened', function () {
    const out = rs.composeRecoveryResult({
      envelopes: [envFail('tavily', 'policy_blocked')],
      dispatch: {
        action: 'terminated', outcome: 'policy_blocked', resume_stage: 'retrieval',
        attempts: [], substitutions: [],
        unresolved: [{ stage: 'retrieval', engine: 'tavily', failure_class: 'policy_blocked' }],
        budget: { retries_used: 0, engines_tried: 0, exhausted: false },
      },
      recovery: null,
      ctx: { requestedScope: ['industry'] },
    });
    assert.equal(out.outcome, 'policy_blocked');
    assert.notEqual(out.research_mode, 'llm_engine_recovery', 'a policy block is never recovery');
  });

  record('S4a THE VANTAGE RULE: authoritative source blocked + accessible corpus empty_valid -> corpus-scoped provisional gap tagged authoritative_workspace_unavailable', function () {
    const out = rs.composeRecoveryResult({
      envelopes: [
        envFail('authoritative-workspace', 'engine_unavailable'),
        envEmpty('room-corpus'),
      ],
      dispatch: null,
      recovery: null,
      ctx: { requestedScope: ['workspace', 'local'], authoritativeEngines: ['authoritative-workspace'] },
    });
    const gap = out.disclosure.unresolved_gaps.find(function (g) {
      return g.tag === 'authoritative_workspace_unavailable';
    });
    assert.ok(gap, 'the vantage gap is present');
    assert.equal(gap.scope, 'corpus', 'the gap is CORPUS-scoped');
    assert.ok(/provisional/i.test(gap.detail), 'provisional wording');
  });

  record('S4b NO input combination produces a project-scoped gap: every gap the composer can emit is corpus-scoped (structural)', function () {
    // Sweep the absence + unavailability permutations: the composer must be
    // INCAPABLE of a project-scope emission from absence alone (no code path).
    const perms = [
      [envFail('auth-ws', 'engine_unavailable'), envEmpty('room-corpus')],
      [envEmpty('room-corpus'), envFail('auth-ws', 'engine_unavailable')],
      [envFail('auth-ws', 'network_timeout', true), envEmpty('room-corpus')],
      [envFail('auth-ws', 'policy_blocked'), envEmpty('room-corpus')],
      [envEmpty('room-corpus')],
      [envFail('auth-ws', 'engine_unavailable')],
      [envFail('auth-ws', 'engine_unavailable'), envEmpty('room-corpus'), envOk('tavily')],
    ];
    for (const envelopes of perms) {
      const out = rs.composeRecoveryResult({
        envelopes: envelopes,
        dispatch: null,
        recovery: null,
        ctx: { requestedScope: ['workspace'], authoritativeEngines: ['auth-ws'] },
      });
      const serialized = JSON.stringify(out);
      assert.equal(serialized.indexOf('"scope":"project"'), -1,
        'no project-scoped gap from absence input: ' + serialized.slice(0, 120));
      for (const g of out.disclosure.unresolved_gaps) {
        assert.equal(g.scope, 'corpus', 'every emitted gap is corpus-scoped');
      }
    }
  });

  // ---- S5: the additive 219/220 seams (real fixture room, hermetic) ----

  const { buildFixtureRoom } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-219.cjs'));
  const researchFiling = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'research-filing.cjs'));
  const urlIngest = require(path.join(REPO_ROOT, 'lib', 'core', 'url-ingest.cjs'));

  function freshRoom(tag) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-221-matrix-' + tag + '-'));
    return buildFixtureRoom(tmp);
  }

  await recordAsync('S5a queryRoomCorpus keeps EVERY landed 219 field unrenamed + gains stage_envelopes + disclosure (D-02 additive)', async function () {
    const fixture = freshRoom('qrc');
    const out = researchFiling.queryRoomCorpus(fixture.roomDir, ['cryogenic', 'pump']);
    // The landed 219-05 fields, byte-present:
    assert.equal(out.ok, true);
    assert.ok(Array.isArray(out.results), 'results[] survives');
    assert.ok(typeof out.research_mode === 'string', 'research_mode survives');
    assert.ok(Array.isArray(out.providers), 'providers[] survives');
    assert.equal(out.provenance, 'web: absent (room-corpus degrade)', 'the exact D-16 provenance survives');
    assert.ok(typeof out.fts_backend === 'string', 'fts_backend survives');
    // The 221-04 additive envelope + disclosure:
    assert.ok(Array.isArray(out.stage_envelopes) && out.stage_envelopes.length >= 1,
      'the full stage envelope rides alongside');
    for (const env of out.stage_envelopes) {
      assert.equal(se.validateStageEnvelope(env).ok, true, 'every attached envelope validates');
    }
    assert.ok(out.disclosure && Array.isArray(out.disclosure.failed_engines),
      'the disclosure rides alongside');
  });

  await recordAsync('S5b ingestUrl keeps EVERY landed 220-02 field unrenamed + gains stage_envelopes + disclosure (D-02 additive)', async function () {
    const fixture = freshRoom('ingest');
    const out = await urlIngest.ingestUrl(fixture.roomDir, 'https://example.com/whitepaper', {
      content: '# Whitepaper\n\nCryogenic pump adoption content.\n',
      contentSource: 'tavily-extract',
      title: 'Whitepaper',
      sessionId: 'matrix-s5b',
    });
    // The landed 220-02 envelope fields, byte-present:
    assert.equal(out.ok, true);
    assert.equal(out.outcome, 'filed');
    assert.ok(typeof out.research_mode === 'string', 'research_mode survives');
    assert.ok(out.providers && out.providers.tavily_extract, 'providers bag survives');
    assert.ok(out.artifact && typeof out.artifact.node_id === 'string', 'artifact survives');
    assert.ok(out.extraction, 'extraction visibility survives');
    // The 221-04 additive envelope + disclosure:
    assert.ok(Array.isArray(out.stage_envelopes) && out.stage_envelopes.length >= 1,
      'the full stage envelope rides alongside');
    for (const env of out.stage_envelopes) {
      assert.equal(se.validateStageEnvelope(env).ok, true, 'every attached envelope validates');
    }
    assert.ok(out.disclosure && Array.isArray(out.disclosure.failed_engines), 'the disclosure rides alongside');
  });

  await recordAsync('S5c exploreOpportunity keeps EVERY landed 219-05 field unrenamed + gains stage_envelopes + disclosure (D-02 additive)', async function () {
    const fixture = freshRoom('explore');
    const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
    const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
    const qualify = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'qualify-opportunity.cjs'));
    const exploreChain = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'explore-chain.cjs'));
    // Seed a QUALIFIED opportunity via the shipped human-gate path.
    const db = openRoomDb(fixture.roomDir);
    let nodeId;
    try {
      const minted = navigation.writeOpportunityNode(db, {
        name: 'Vantorix Systems x Cryogenic Pump Array',
        sessionId: 'matrix-s5c', lifecycle: 'candidate', lens: 'leveraging_resources',
        score: 0.8, section: 'competitive-analysis', actor: 'system',
        reason: 'seeded for matrix seam test',
        evidence_ids: [fixture.ids.bridgeA, fixture.ids.bridgeB],
        formula_version: 'HarvestIndex_v1',
      });
      assert.equal(minted.ok, true, 'seed mint ok');
      const q = qualify.qualifyCandidate(db, fixture.roomDir, {
        candidate_id: 'cand-matrix-1', name: 'Vantorix Systems x Cryogenic Pump Array',
        session_id: 'matrix-s5c', node_handle: minted.node_id, lens: 'leveraging_resources',
        score: 0.8, evidence_handles: [fixture.ids.bridgeA, fixture.ids.bridgeB],
        source_event: 'bridge',
      }, 'navigator');
      assert.equal(q.ok, true, 'qualify ok');
      nodeId = minted.node_id;
    } finally {
      closeRoomDb(db);
    }
    // Run offline-degraded (the D-16 item 3 seam) and DEFER at the gate.
    const out = await exploreChain.exploreOpportunity(fixture.roomDir, nodeId, {
      onStep: function (step) {
        return { chain_output: { leg: step.leg, summary: 'stub analysis for ' + step.leg }, quality: 'medium' };
      },
      onHalt: function () { return 'defer'; },
      forceOffline: true,
      sessionId: 'matrix-s5c',
    });
    // The landed 219-05 fields, byte-present:
    assert.equal(out.ok, true);
    assert.ok(Array.isArray(out.trace), 'trace survives');
    assert.ok('completed' in out && 'haltedAt' in out, 'chain fields survive');
    assert.ok(typeof out.research_mode === 'string' || out.research_mode === null, 'research_mode survives');
    assert.ok(Array.isArray(out.providers), 'providers survives');
    assert.ok(typeof out.engine_mode === 'string', 'engine_mode survives');
    assert.ok('filed' in out, 'filed survives');
    // The 221-04 additive envelope + disclosure:
    assert.ok(Array.isArray(out.stage_envelopes), 'the full stage envelope rides alongside');
    for (const env of out.stage_envelopes) {
      assert.equal(se.validateStageEnvelope(env).ok, true, 'every attached envelope validates');
    }
    assert.ok(out.disclosure && Array.isArray(out.disclosure.failed_engines), 'the disclosure rides alongside');
  });

  await recordAsync('S5d runSourceLens on a failure path: the landed fields + recovery + the NEW outcome + disclosure ride together; healthy runs stay byte-identical (M4 pin unbroken)', async function () {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: [{ lens: 'industry', weight: 1.0 }],
      preflight: { current_section: 'market', evidence_gaps: [], prior_research: [] },
      stage: 'explore',
      _sleep: async function () {},
      _fetchCorpusEnvelope: async function (args) {
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'blocked',
          failure_class: 'spend_limit_exceeded', error: 'monthly spend limit hit',
        });
      },
    });
    assert.equal(res.ok, true);
    assert.ok(res.recovery, 'the dispatch result rides the run result');
    assert.equal(res.recovery.action, 'human_required');
    assert.equal(res.research_mode, 'manual_intervention_required',
      'the NEW additive mode value is live on the driver result path');
    assert.equal(res.outcome, 'manual_intervention_required', 'the composed outcome rides alongside');
    assert.ok(res.disclosure && Array.isArray(res.disclosure.failed_engines), 'the disclosure rides alongside');
    assert.ok(JSON.stringify(res.disclosure).indexOf('claude.ai/settings/usage') !== -1,
      'the actionable message reaches the user-visible disclosure');
  });

  // =========================================================================
  // Task 2 group P -- the D-08 doc-parity gate (the 219-05 grep idiom).
  // =========================================================================

  record('P1 doc-parity: all 12 tokens (6 modes + 5 outcomes + spend_limit_exceeded) grep >0 in BOTH research.md surfaces; paid -> native greps 0; zero em-dashes', function () {
    const cmdDoc = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'research.md'), 'utf8');
    const skillDoc = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'research', 'SKILL.md'), 'utf8');
    // The 12 D-08/D-11 tokens: the six research_mode values + the five
    // outcomes + 'spend_limit_exceeded' (the 12th searchable term, so a
    // capped user can find themselves in the docs).
    const TOKENS = [
      // six modes
      'normal', 'web_degraded_local_fallback', 'local_only', 'insufficient_evidence',
      'llm_engine_recovery', 'manual_intervention_required',
      // five outcomes
      'recovered', 'partial_recovery', 'insufficient_evidence',
      'manual_intervention_required', 'policy_blocked',
      // D-11: the capped-user search term
      'spend_limit_exceeded',
    ];
    assert.equal(TOKENS.length, 12, 'the doc-parity token bank is exactly 12');
    for (const token of TOKENS) {
      assert.ok(cmdDoc.indexOf(token) !== -1, 'commands/research.md carries "' + token + '"');
      assert.ok(skillDoc.indexOf(token) !== -1, 'skills/research/SKILL.md carries "' + token + '"');
    }
    // The 219-05 drift fix carried through the regenerated mirror: the
    // unshipped paid -> native ordering claim stays gone from BOTH.
    for (const doc of [cmdDoc, skillDoc]) {
      assert.ok(!/paid\s*->\s*native/.test(doc), 'no paid -> native claim');
      assert.ok(!/paid\s*(?:-|–|—)>\s*native/.test(doc), 'no dash-variant of the claim');
      assert.equal(doc.indexOf('—'), -1, 'zero em-dashes (CLAUDE.md HARD RULE)');
    }
    // The capped-user guidance is discoverable next to its search term.
    assert.ok(cmdDoc.indexOf('claude.ai/settings/usage') !== -1, 'the actionable spend-cap step is documented');
    assert.ok(skillDoc.indexOf('claude.ai/settings/usage') !== -1, 'and mirrored');
  });

  console.log('=== 221-04 matrix suite: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) process.exit(1);
})().catch(function (err) {
  console.error('suite crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
