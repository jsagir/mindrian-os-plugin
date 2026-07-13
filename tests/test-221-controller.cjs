#!/usr/bin/env node
'use strict';
/*
 * Phase 221 Plan 03 -- REQ-3 controller suite (case file + state machine).
 *
 * Task 1 groups (CF): atomic case-file persistence + schema validators
 *   CF1 openCaseFile + writeArtifact atomicity (tmp+rename, fault-injected
 *       write leaves prior file intact, zero .tmp residue)
 *   CF2 appendLedger: exactly one JSON line per call, ts + model + version
 *   CF3 validateCaseFile write-ordering invariants (plan-before-execute,
 *       claims-before-synthesis) + complete ordered case file ok
 *   CF4 CASE_ARTIFACTS frozen allowlist + path containment vs hostile run_id
 *
 * Task 2 groups (CS): the 7-step controller state machine
 *   CS1 step order + pipeline-state journal + crash/resume at boundary
 *   CS2 write ordering: recovery-plan BEFORE executeFn, claim ledger BEFORE
 *       reconcileFn (fs spies inside the stubs)
 *   CS3 profiles: diagnostic one path; high_effort multi-path; forensic
 *       PROHIBITS mutation (refusal + byte-identical room tree) + review packet
 *   CS4 budgets + stop conditions: MAX_MODEL_CALLS exhaustion -> honest
 *       partial, repeated identical failure fingerprint -> early termination
 *   CS5 gated entry: material without accepted REFUSED (D-20/D-07); cadence
 *       origin REFUSED (D-04); spend_limit_exceeded context REFUSED (D-11
 *       defense in depth behind the dispatcher predicate)
 *   CS6 model recording: every hook call ledgered with model+version; a model
 *       change never alters governance (D-06)
 *
 * Hermetic: temp room fixture, every hook stubbed, zero network.
 * No em-dashes anywhere (CLAUDE.md). CJS only.
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

const CASE_FILE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'recovery', 'case-file.cjs');
const CONTROLLER_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'recovery', 'controller.cjs');
const SE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'recovery', 'stage-envelope.cjs');

const cf = require(CASE_FILE_PATH);
const se = require(SE_PATH);

function makeRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-221-03-'));
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '# fixture room\n', 'utf8');
  return dir;
}

function sha(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function listTmpResidue(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) { return f.indexOf('.tmp.') !== -1; });
}

// Valid artifact bodies for the CF3 complete-case-file leg.
const VALID_DIAGNOSIS = {
  envelopes: [se.makeStageEnvelope({
    stage: 'retrieval', engine: 'tavily', status: 'failed',
    failure_class: 'network_timeout', retryable: true, error: 'timed out',
  })],
  classified: [{ stage: 'retrieval', engine: 'tavily', failure_class: 'network_timeout', tier_hint: 3 }],
};
const VALID_PLAN = {
  alternate_tools: ['room-corpus'],
  budgets: { MAX_MODEL_CALLS: 12 },
  permissions: { mutation: false, egress: false },
  stop_conditions: ['policy_block'],
  paths: [{ path_id: 'p1', stage: 'retrieval', engine: 'tavily', tool: 'room-corpus' }],
  queries: ['generic topic'],
};
const VALID_REPORT = {
  checks: {
    schema: { ok: true, detail: '' }, provenance: { ok: true, detail: '' },
    locator: { ok: true, detail: '' }, freshness: { ok: true, detail: '' },
    dedup: { ok: true, detail: '' }, privacy: { ok: true, detail: '' },
    policy: { ok: true, detail: '' }, readback: { ok: true, detail: '' },
  },
};
const VALID_CLAIMS = { claims: [{ claim: 'x is y', state: 'supported', evidence: ['p1'] }] };
const VALID_BUNDLE = { resume_stage: 'retrieval', recovered_payloads: [], claims: [] };

// ---------- CF1: openCaseFile + atomic writeArtifact ----------

record('CF1 openCaseFile creates <roomDir>/.mindrian/recovery/<run_id>/ with a filesystem-safe run_id', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  assert.ok(h && typeof h.dir === 'string', 'handle carries dir');
  assert.ok(fs.existsSync(h.dir), 'case dir exists');
  const base = path.join(room, '.mindrian', 'recovery');
  assert.ok(h.dir.indexOf(base + path.sep) === 0, 'case dir under .mindrian/recovery');
  assert.ok(/^[a-z0-9-]+$/.test(h.run_id), 'run_id filesystem-safe: ' + h.run_id);
});

record('CF1 writeArtifact lands atomically with zero .tmp residue and round-trips', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  const res = cf.writeArtifact(h, 'failure-diagnosis.json', VALID_DIAGNOSIS);
  assert.strictEqual(res.ok, true);
  const raw = fs.readFileSync(path.join(h.dir, 'failure-diagnosis.json'), 'utf8');
  assert.deepStrictEqual(JSON.parse(raw), JSON.parse(JSON.stringify(VALID_DIAGNOSIS)));
  assert.deepStrictEqual(listTmpResidue(h.dir), [], 'no .tmp residue');
});

record('CF1 fault-injected write leaves the prior file intact (tmp+rename, never a torn file)', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  cf.writeArtifact(h, 'failure-diagnosis.json', VALID_DIAGNOSIS);
  const before = fs.readFileSync(path.join(h.dir, 'failure-diagnosis.json'), 'utf8');
  const second = {
    envelopes: VALID_DIAGNOSIS.envelopes,
    classified: [{ stage: 'retrieval', engine: 'brave', failure_class: 'http_error', tier_hint: 1 }],
  };
  assert.throws(function () {
    cf.writeArtifact(h, 'failure-diagnosis.json', second, {
      _faultFn: function () { throw new Error('injected fs fault'); },
    });
  }, /injected fs fault/);
  const after = fs.readFileSync(path.join(h.dir, 'failure-diagnosis.json'), 'utf8');
  assert.strictEqual(after, before, 'prior file intact after fault');
  assert.deepStrictEqual(listTmpResidue(h.dir), [], 'no .tmp residue after fault');
});

// ---------- CF2: appendLedger ----------

record('CF2 appendLedger appends exactly one JSON line per call with ts + model + version', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  cf.appendLedger(h, { step: 'diagnose', hook: 'diagnoseFn', model: 'claude-fable-5', version: '2026-01' });
  cf.appendLedger(h, { step: 'execute', hook: 'executeFn', model: 'claude-fable-5', version: '2026-01' });
  cf.appendLedger(h, { step: 'execute', hook: 'executeFn' });
  const raw = fs.readFileSync(path.join(h.dir, 'attempt-ledger.jsonl'), 'utf8');
  const lines = raw.split('\n').filter(function (l) { return l.length > 0; });
  assert.strictEqual(lines.length, 3, 'three lines for three calls');
  const parsed = lines.map(function (l) { return JSON.parse(l); });
  for (const entry of parsed) {
    assert.ok(typeof entry.ts === 'string' && entry.ts.length > 0, 'ts stamped');
  }
  assert.strictEqual(parsed[0].model, 'claude-fable-5');
  assert.strictEqual(parsed[0].version, '2026-01');
  assert.strictEqual(parsed[1].model, 'claude-fable-5');
});

// ---------- CF3: validateCaseFile write-ordering invariants ----------

record('CF3 plan-before-execute violation: execute in ledger without recovery-plan.json -> ok:false', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  cf.writeArtifact(h, 'failure-diagnosis.json', VALID_DIAGNOSIS);
  cf.appendLedger(h, { step: 'execute', hook: 'executeFn', model: 'm', version: 'v' });
  const v = cf.validateCaseFile(h);
  assert.strictEqual(v.ok, false);
  assert.ok(v.violations.some(function (s) { return s.indexOf('plan_before_execute') !== -1; }),
    'names plan_before_execute: ' + JSON.stringify(v.violations));
});

record('CF3 claims-before-synthesis violation: bundle without claim-evidence-ledger -> ok:false', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  cf.writeArtifact(h, 'failure-diagnosis.json', VALID_DIAGNOSIS);
  cf.writeArtifact(h, 'recovery-plan.json', VALID_PLAN);
  cf.writeArtifact(h, 'recovery-bundle.json', VALID_BUNDLE);
  const v = cf.validateCaseFile(h);
  assert.strictEqual(v.ok, false);
  assert.ok(v.violations.some(function (s) { return s.indexOf('claims_before_synthesis') !== -1; }),
    'names claims_before_synthesis: ' + JSON.stringify(v.violations));
});

record('CF3 complete ordered case file validates ok:true', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  cf.writeArtifact(h, 'failure-diagnosis.json', VALID_DIAGNOSIS);
  cf.writeArtifact(h, 'recovery-plan.json', VALID_PLAN);
  cf.appendLedger(h, { step: 'execute', hook: 'executeFn', model: 'm', version: 'v' });
  cf.writeArtifact(h, 'validation-report.json', VALID_REPORT);
  cf.writeArtifact(h, 'claim-evidence-ledger.json', VALID_CLAIMS);
  cf.writeArtifact(h, 'recovery-bundle.json', VALID_BUNDLE);
  cf.writeArtifact(h, 'recovery-notice.md', '# Recovery notice\n\nPlain-language summary.\n');
  const v = cf.validateCaseFile(h);
  assert.deepStrictEqual(v, { ok: true, violations: [] });
});

record('CF3 schema-invalid artifact body is refused at write time (deterministic validators)', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  assert.throws(function () {
    cf.writeArtifact(h, 'recovery-plan.json', { alternate_tools: 'not-an-array' });
  }, /schema_invalid/);
});

// ---------- CF4: allowlist + path containment ----------

record('CF4 unknown artifact names are REFUSED (CASE_ARTIFACTS frozen allowlist)', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room);
  assert.throws(function () {
    cf.writeArtifact(h, 'evil.json', { anything: true });
  }, /unknown_artifact/);
  assert.ok(Object.isFrozen(cf.CASE_ARTIFACTS), 'CASE_ARTIFACTS frozen');
  assert.deepStrictEqual(cf.CASE_ARTIFACTS.slice().sort(), [
    'attempt-ledger.jsonl',
    'claim-evidence-ledger.json',
    'failure-diagnosis.json',
    'recovery-bundle.json',
    'recovery-notice.md',
    'recovery-plan.json',
    'validation-report.json',
  ].sort());
});

record('CF4 hostile run_id is sanitized and every write stays inside the case dir', function () {
  const room = makeRoom();
  const h = cf.openCaseFile(room, { run_id: '../../../escape/attempt' });
  const base = path.resolve(room, '.mindrian', 'recovery');
  const resolved = path.resolve(h.dir);
  assert.ok(resolved === base || resolved.indexOf(base + path.sep) === 0,
    'case dir contained: ' + resolved);
  assert.ok(resolved.indexOf('escape') === -1 || resolved.indexOf('..') === -1,
    'no traversal survived');
  const res = cf.writeArtifact(h, 'failure-diagnosis.json', VALID_DIAGNOSIS);
  const written = path.resolve(res.path);
  assert.ok(written.indexOf(base + path.sep) === 0, 'artifact path contained: ' + written);
});

record('CF4 collision-suffix rule: same run_id twice yields two distinct dirs', function () {
  const room = makeRoom();
  const h1 = cf.openCaseFile(room, { run_id: 'fixed-id' });
  const h2 = cf.openCaseFile(room, { run_id: 'fixed-id' });
  assert.notStrictEqual(h1.dir, h2.dir, 'collision resolved with a suffix');
  assert.ok(fs.existsSync(h1.dir) && fs.existsSync(h2.dir));
});

// =====================================================================
// Task 2 groups (CS): controller state machine (added in the Task 2 RED
// step; require lazily so the CF legs stay runnable while controller.cjs
// does not exist yet).
// =====================================================================

const STEPS = ['diagnose', 'plan', 'execute', 'validate', 'reconcile', 'resume', 'surface'];

function envTimeout(engine) {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine || 'tavily', status: 'failed',
    failure_class: 'network_timeout', retryable: true, error: 'timed out',
  });
}
function envSpend() {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: 'anthropic', status: 'blocked',
    failure_class: 'spend_limit_exceeded', error: 'monthly spend limit hit',
  });
}

function baseCtx(room, over) {
  const ctx = {
    roomDir: room,
    envelopes: [envTimeout('tavily')],
    dispatch: { action: 'offer_tier3', resume_stage: 'retrieval' },
    profile: 'high_effort',
    accepted: true,
    origin: 'on_demand',
    material: false,
    topicHandles: ['generic topic'],
    modelInfo: { model: 'claude-fable-5', version: '2026-01' },
    diagnoseFn: function () { return { note: 'stub enrichment' }; },
    executeFn: function (p) {
      return {
        payloads: [{
          id: 'payload-' + p.path_id, content: 'recovered content for ' + p.engine,
          provenance: ['room-corpus'], components: { score: 0.5 },
          claims: [{ claim: 'claim for ' + p.engine, locator: 'room-corpus#1' }],
        }],
      };
    },
    reconcileFn: function (claims) {
      return claims.map(function (c) { return Object.assign({}, c, { state: 'supported' }); });
    },
  };
  return Object.assign(ctx, over || {});
}

function readLedger(caseDir) {
  const raw = fs.readFileSync(path.join(caseDir, 'attempt-ledger.jsonl'), 'utf8');
  return raw.split('\n').filter(function (l) { return l.length > 0; })
    .map(function (l) { return JSON.parse(l); });
}

async function runControllerSuite() {
  const controller = require(CONTROLLER_PATH);
  const ps = require(path.resolve(__dirname, '..', 'lib', 'mcp', 'pipeline-state.cjs'));

  // ---------- CS1: order + journal + crash/resume ----------

  await recordAsync('CS1 stubbed full run executes the 7 steps in order, each journaled via recordStep', async function () {
    const room = makeRoom();
    const order = [];
    const ctx = baseCtx(room, {
      diagnoseFn: function () { order.push('diagnoseFn'); return {}; },
      executeFn: function (p) { order.push('executeFn'); return baseCtx(room).executeFn(p); },
      reconcileFn: function (claims) { order.push('reconcileFn'); return baseCtx(room).reconcileFn(claims); },
    });
    const res = await controller.runRecovery(ctx);
    assert.ok(res && typeof res.case_dir === 'string', 'result carries case_dir');
    const state = ps.read(res.case_dir);
    assert.ok(state, 'journal exists in the case dir');
    const journaled = state.history.map(function (hh) { return hh.tool; });
    assert.deepStrictEqual(journaled, STEPS, 'all 7 steps journaled in order');
    assert.deepStrictEqual(order, ['diagnoseFn', 'executeFn', 'reconcileFn'], 'hooks in state-machine order');
    assert.strictEqual(res.outcome, 'recovered');
  });

  await recordAsync('CS1 crash at validate resumes AT validate; completed steps never re-run', async function () {
    const room = makeRoom();
    let diagCalls = 0;
    let execCalls = 0;
    const mk = function (extra) {
      return baseCtx(room, Object.assign({
        diagnoseFn: function () { diagCalls += 1; return {}; },
        executeFn: function (p) { execCalls += 1; return baseCtx(room).executeFn(p); },
      }, extra));
    };
    const crashed = await controller.runRecovery(mk({ _faultAt: 'validate' }));
    assert.notStrictEqual(crashed.outcome, 'recovered');
    assert.strictEqual(crashed.halted_at, 'validate');
    assert.strictEqual(diagCalls, 1);
    const execAfterCrash = execCalls;
    assert.ok(execAfterCrash >= 1);

    const resumed = await controller.runRecovery(mk({ resume_run_id: crashed.run_id }));
    assert.strictEqual(resumed.outcome, 'recovered');
    assert.strictEqual(diagCalls, 1, 'diagnose never re-ran');
    assert.strictEqual(execCalls, execAfterCrash, 'execute never re-ran');
    const state = ps.read(resumed.case_dir);
    const journaled = state.history.map(function (hh) { return hh.tool; });
    assert.deepStrictEqual(journaled, STEPS, 'each step journaled exactly once across crash + resume');
  });

  // ---------- CS2: write ordering ----------

  await recordAsync('CS2 recovery-plan.json exists on disk BEFORE the first executeFn call', async function () {
    const room = makeRoom();
    let planSeen = null;
    const ctx = baseCtx(room, {
      executeFn: function (p, tools) {
        if (planSeen === null) {
          planSeen = fs.existsSync(path.join(tools.case_dir, 'recovery-plan.json'));
        }
        return baseCtx(room).executeFn(p);
      },
    });
    await controller.runRecovery(ctx);
    assert.strictEqual(planSeen, true, 'plan written before execution');
  });

  await recordAsync('CS2 claim-evidence-ledger.json exists BEFORE reconcileFn runs', async function () {
    const room = makeRoom();
    let ledgerSeen = null;
    let caseDir = null;
    const ctx = baseCtx(room, {
      executeFn: function (p, tools) { caseDir = tools.case_dir; return baseCtx(room).executeFn(p); },
      reconcileFn: function (claims) {
        ledgerSeen = fs.existsSync(path.join(caseDir, 'claim-evidence-ledger.json'));
        return baseCtx(room).reconcileFn(claims);
      },
    });
    await controller.runRecovery(ctx);
    assert.strictEqual(ledgerSeen, true, 'claim ledger written before reconcile');
  });

  // ---------- CS3: profiles ----------

  await recordAsync('CS3 diagnostic profile runs exactly ONE alternate path', async function () {
    const room = makeRoom();
    let execCalls = 0;
    const ctx = baseCtx(room, {
      profile: 'diagnostic',
      envelopes: [envTimeout('tavily'), envTimeout('brave')],
      executeFn: function (p) { execCalls += 1; return baseCtx(room).executeFn(p); },
    });
    await controller.runRecovery(ctx);
    assert.strictEqual(execCalls, 1, 'one path only under diagnostic');
  });

  await recordAsync('CS3 high_effort profile decomposes multi-path', async function () {
    const room = makeRoom();
    let execCalls = 0;
    const ctx = baseCtx(room, {
      profile: 'high_effort',
      envelopes: [envTimeout('tavily'), envTimeout('brave')],
      executeFn: function (p) { execCalls += 1; return baseCtx(room).executeFn(p); },
    });
    await controller.runRecovery(ctx);
    assert.strictEqual(execCalls, 2, 'one path per failed engine under high_effort');
  });

  await recordAsync('CS3 forensic profile PROHIBITS mutation: write attempt refused, room tree byte-identical, review packet emitted', async function () {
    const room = makeRoom();
    fs.writeFileSync(path.join(room, 'entry.md'), 'existing room content\n', 'utf8');
    const snapshot = function () {
      const acc = {};
      const walk = function (dir) {
        for (const name of fs.readdirSync(dir)) {
          const p = path.join(dir, name);
          const rel = path.relative(room, p);
          if (rel === path.join('.mindrian', 'recovery')
            || rel.indexOf(path.join('.mindrian', 'recovery') + path.sep) === 0) continue;
          const st = fs.statSync(p);
          if (st.isDirectory()) walk(p);
          else acc[rel] = sha(fs.readFileSync(p));
        }
      };
      walk(room);
      return acc;
    };
    const before = snapshot();
    let refusal = null;
    const ctx = baseCtx(room, {
      profile: 'forensic',
      executeFn: function (p, tools) {
        refusal = tools.file({ topic: 't', source: 's', url: 'u', retrieved_at: 'r', evidence_tier: 'C', summary: 'x' });
        return { payloads: [{ id: 'f1', content: 'forensic finding', provenance: ['lineage'], components: {} }] };
      },
    });
    const res = await controller.runRecovery(ctx);
    assert.ok(refusal && refusal.ok === false && refusal.refused === true, 'write attempt refused');
    assert.ok(/forensic/.test(String(refusal.reason)), 'refusal names the forensic prohibition');
    assert.deepStrictEqual(snapshot(), before, 'room tree byte-identical outside the case dir');
    assert.strictEqual(res.profile, 'forensic');
    assert.ok(fs.existsSync(path.join(res.case_dir, 'recovery-notice.md')), 'human review packet: notice');
    assert.ok(fs.existsSync(path.join(res.case_dir, 'validation-report.json')), 'human review packet: report');
    assert.strictEqual(res.filing.attempted, false, 'forensic never files');
  });

  // ---------- CS4: budgets + stop conditions ----------

  await recordAsync('CS4 MAX_MODEL_CALLS exhaustion stops honestly (never a complete-looking bundle)', async function () {
    const room = makeRoom();
    const ctx = baseCtx(room, {
      envelopes: [envTimeout('tavily'), envTimeout('brave'), envTimeout('exa')],
      budgets: { MAX_MODEL_CALLS: 2 },
    });
    const res = await controller.runRecovery(ctx);
    assert.strictEqual(res.budget.exhausted, true);
    assert.strictEqual(res.budget.stopped_on, 'max_model_calls');
    assert.ok(res.outcome === 'partial_recovery' || res.outcome === 'insufficient_evidence',
      'honest outcome, got ' + res.outcome);
    assert.notStrictEqual(res.outcome, 'recovered');
  });

  await recordAsync('CS4 repeated identical failure fingerprint triggers early termination with stopped_on named', async function () {
    const room = makeRoom();
    const ctx = baseCtx(room, {
      envelopes: [envTimeout('tavily'), envTimeout('brave'), envTimeout('exa')],
      executeFn: function () { throw new Error('identical boom'); },
    });
    const res = await controller.runRecovery(ctx);
    assert.strictEqual(res.budget.stopped_on, 'repeated_failure_fingerprint');
    assert.notStrictEqual(res.outcome, 'recovered');
  });

  // ---------- CS5: gated entry ----------

  await recordAsync('CS5 material surface without accepted:true REFUSES naming the D-20 offer requirement', async function () {
    const room = makeRoom();
    const ctx = baseCtx(room, { material: true, accepted: false });
    const res = await controller.runRecovery(ctx);
    assert.strictEqual(res.refused, true);
    assert.ok(/D-20/.test(String(res.reason)), 'reason names D-20: ' + res.reason);
    assert.strictEqual(res.outcome, 'manual_intervention_required');
  });

  await recordAsync('CS5 cadence origin is REFUSED outright (D-04 defense in depth)', async function () {
    const room = makeRoom();
    const ctx = baseCtx(room, { origin: 'cadence' });
    const res = await controller.runRecovery(ctx);
    assert.strictEqual(res.refused, true);
    assert.ok(/cadence/.test(String(res.reason)));
  });

  await recordAsync('CS5 entry without an offer_tier3 dispatch (and no direct seam) is REFUSED', async function () {
    const room = makeRoom();
    const ctx = baseCtx(room, { dispatch: { action: 'terminated' } });
    const res = await controller.runRecovery(ctx);
    assert.strictEqual(res.refused, true);
    const res2 = await controller.runRecovery(baseCtx(room, { dispatch: null }), { direct: true });
    assert.notStrictEqual(res2.refused, true, 'direct test seam admits');
  });

  await recordAsync('CS5 spend_limit_exceeded-tagged context is REFUSED at the controller entry (D-11 defense in depth)', async function () {
    const room = makeRoom();
    const ctx = baseCtx(room, { envelopes: [envSpend(), envTimeout('tavily')] });
    const res = await controller.runRecovery(ctx);
    assert.strictEqual(res.refused, true);
    assert.ok(/spend_limit_exceeded/.test(String(res.reason)));
    assert.strictEqual(res.outcome, 'manual_intervention_required');
  });

  // ---------- CS6: model recording ----------

  await recordAsync('CS6 every hook invocation is ledgered with model + version', async function () {
    const room = makeRoom();
    const res = await controller.runRecovery(baseCtx(room));
    const hookLines = readLedger(res.case_dir).filter(function (l) { return typeof l.hook === 'string'; });
    assert.ok(hookLines.length >= 3, 'diagnose + execute + reconcile all ledgered');
    for (const line of hookLines) {
      assert.strictEqual(line.model, 'claude-fable-5');
      assert.strictEqual(line.version, '2026-01');
    }
    assert.deepStrictEqual(res.model, { model: 'claude-fable-5', version: '2026-01' });
  });

  await recordAsync('CS6 swapping modelInfo changes ONLY the recorded strings; governance identical (D-06)', async function () {
    const roomA = makeRoom();
    const roomB = makeRoom();
    const resA = await controller.runRecovery(baseCtx(roomA));
    const resB = await controller.runRecovery(baseCtx(roomB, {
      modelInfo: { model: 'other-model', version: '9.9' },
    }));
    assert.strictEqual(resA.outcome, resB.outcome, 'same outcome');
    assert.deepStrictEqual(resA.filing, resB.filing, 'same filing governance');
    assert.strictEqual(cf.validateCaseFile({ dir: resA.case_dir }).ok, true);
    assert.strictEqual(cf.validateCaseFile({ dir: resB.case_dir }).ok, true);
    const linesB = readLedger(resB.case_dir).filter(function (l) { return typeof l.hook === 'string'; });
    for (const line of linesB) {
      assert.strictEqual(line.model, 'other-model');
      assert.strictEqual(line.version, '9.9');
    }
  });
}

// ---------- main ----------

(async function main() {
  let controllerExists = true;
  try { require.resolve(CONTROLLER_PATH); } catch (_e) { controllerExists = false; }
  if (controllerExists) {
    await runControllerSuite();
  } else {
    process.stdout.write('  (controller.cjs not landed yet; CS legs pending)\n');
    failed += 1; // RED until Task 2 lands the controller
  }
  process.stdout.write('\ntest-221-controller: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}());
