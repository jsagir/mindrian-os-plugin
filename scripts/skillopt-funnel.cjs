#!/usr/bin/env node
'use strict';
/*
 * scripts/skillopt-funnel.cjs - Phase 230-02, WS1.3-4: the cheap roster-wide judge funnel.
 * ==========================================================================
 * ONE isolated headless subagent judges ONE eval query against the FULL 124-skill
 * roster (name + description stubs ONLY, never bodies - the exact bytes progressive
 * disclosure shows). This is the pipeline's cost-defining move: ~800-1,000 sonnet
 * calls at fleet scale instead of agentskills.io's ~7,500-call literal per-skill
 * loop. Only FLAGGED skills escalate to the expensive real trigger-test (Plan 03).
 *
 * The flag rule is the locked CONTEXT.md Rigor decision, verbatim: a skill is
 * FLAGGED when any TRAIN-split query has predicted_skill !== expected_skill, OR any
 * of its verdicts has confidence 'low' or 'medium'. Fail OPEN toward scrutiny - a
 * low-confidence judgment never counts as a silent pass. Validation-split queries
 * are judged too, but they NEVER drive description revision; they exist for Plan
 * 03's do-no-harm gate.
 *
 * No silent skip (D5 / CFM3): a spawn error, nonzero exit, timeout, empty envelope,
 * or safeParse failure - after ONE retry - is recorded as a UnitRecord status
 * 'not_evaluated' with its reason, NEVER counted as a pass. The D5 identity
 * spawned === ok + not_evaluated MUST hold or the script exits 1.
 *
 * Fan-out uses runPool (copied verbatim from huji-batch.cjs:200-229) with getLimit
 * re-read each iteration and hard-capped at 4 (clamp + warn on higher - Pitfall 5).
 * Resume via a .done sentinel per unit. Write-path containment via assertUnderOut.
 * CJS only, switch-case argv router, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  JudgeVerdictSchema,
  UnitRecordSchema,
  NOT_EVALUATED_REASONS,
  PHASE_OUT_DIR,
  inlineSchemaJson,
  assertUnderOut,
  assertPinnedModelId,
} = require('../lib/core/skillopt-schemas.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// The pinned FULL sonnet id, copied verbatim from the huji-eval.cjs judge config
// (JUDGE_MODEL default 'claude-sonnet-4-5'). assertPinnedModelId preflights it.
const PINNED_SONNET = 'claude-sonnet-4-5';

// The frozen judge instruction (stable bytes = prompt-cache bite across ~1,000 calls).
const JUDGE_RUBRIC_PATH = path.join('references', 'methodology', 'skillopt-judge-rubric.md');

const DEFAULT_CONCURRENCY = 3;
const HARD_CAP_CONCURRENCY = 4; // Pitfall 5: never above 4 (429-storm guard)

// --------------------------------------------------------------------------
// writeAtomic - write-temp-then-rename (copied from huji-batch.writeAtomic:60-64).
// --------------------------------------------------------------------------
function writeAtomic(filePath, contents) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

// Resume predicate: a unit is done if its .done idempotency marker exists on disk
// (huji-batch.isDone:83-86 shape, sentinel-only variant).
function isDone(unitsDir, unitId) {
  return fs.existsSync(path.join(unitsDir, safeStem(unitId) + '.done'));
}

// Collapse whitespace (incl. newlines) so a roster stub is exactly one line.
function oneLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

function safeStem(name) {
  return String(name || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

// --------------------------------------------------------------------------
// runPool - dependency-free bounded concurrency pool. Copied VERBATIM from
// huji-batch.cjs:200-229. getLimit re-read every iteration so a clamp takes effect
// at once. Never an unbounded parallel-all over units (429 storm, Pitfall 5).
// --------------------------------------------------------------------------
async function runPool({ items, getLimit, worker, onSettle }) {
  let idx = 0;
  const running = [];
  const results = [];
  const limitNow = () => Math.max(0, getLimit());
  while (idx < items.length || running.length > 0) {
    while (idx < items.length && running.length < limitNow()) {
      const item = items[idx++];
      const entry = { done: false };
      entry.promise = (async () => {
        try { entry.settled = { item, res: await worker(item) }; }
        catch (err) { entry.settled = { item, err }; }
        entry.done = true;
        return entry.settled;
      })();
      running.push(entry);
    }
    if (running.length === 0) break; // halted to 0 with nothing in flight
    await Promise.race(running.map((e) => e.promise));
    for (let i = running.length - 1; i >= 0; i--) {
      if (running[i].done) {
        const settled = running[i].settled;
        results.push(settled);
        running.splice(i, 1);
        if (onSettle) onSettle(settled);
      }
    }
  }
  return results;
}

// --------------------------------------------------------------------------
// resolveFunnelConfig - defaults; clamp concurrency to the hard cap (warn once).
// --------------------------------------------------------------------------
function resolveFunnelConfig(config) {
  const c = config || {};
  let concurrency = typeof c.concurrency === 'number' && c.concurrency > 0 ? c.concurrency : DEFAULT_CONCURRENCY;
  let clamped = false;
  if (concurrency > HARD_CAP_CONCURRENCY) { concurrency = HARD_CAP_CONCURRENCY; clamped = true; }
  return {
    model: c.model || PINNED_SONNET,
    pluginDir: c.pluginDir || REPO_ROOT,
    judgeRubricPath: c.judgeRubricPath || JUDGE_RUBRIC_PATH,
    budgetPerQueryUsd: typeof c.budgetPerQueryUsd === 'number' ? c.budgetPerQueryUsd : 0.05,
    timeoutMs: typeof c.timeoutMs === 'number' ? c.timeoutMs : 120000,
    concurrency,
    concurrencyClamped: clamped,
  };
}

// --------------------------------------------------------------------------
// buildRosterStubs(inventory) - 'name: description' lines for ALL records (never
// bodies - AI-SPEC Context Window Strategy). Even a smoke-scoped run judges against
// the FULL roster; only the evaluated query set shrinks. Exactly one line per record.
// --------------------------------------------------------------------------
function buildRosterStubs(inventory) {
  const recs = Array.isArray(inventory) ? inventory : [];
  return recs.map((r) => r.skill + ': ' + oneLine(r.description)).join('\n');
}

// --------------------------------------------------------------------------
// buildJudgePrompt - the per-unit -p variable: the full roster + one query + the
// expected label. The frozen instruction lives in --append-system-prompt-file.
// --------------------------------------------------------------------------
function buildJudgePrompt(rosterText, query, expected) {
  const lines = [
    'FULL SKILL ROSTER (name: description, one per line):',
    rosterText,
    '',
    'USER QUERY: ' + query,
    '',
    'EXPECTED LABEL (for scoring only, do not let it bias your prediction): ' +
      (expected === null || expected === undefined ? 'null' : String(expected)),
    '',
    'Predict which ONE skill fires, or null. Return only the JSON the schema describes.',
  ];
  return lines.join('\n');
}

// --------------------------------------------------------------------------
// buildJudgeArgs - the judge spawn arg array (AI-SPEC Section 3 reference shape).
// --------------------------------------------------------------------------
function buildJudgeArgs(rosterText, query, expected, config) {
  const cfg = resolveFunnelConfig(config);
  return [
    '-p', buildJudgePrompt(rosterText, query, expected),
    '--append-system-prompt-file', cfg.judgeRubricPath,
    '--plugin-dir', cfg.pluginDir,            // keychain auth, NEVER --bare (Pitfall 4)
    '--model', cfg.model,                     // pinned full sonnet id
    '--output-format', 'json',
    '--json-schema', inlineSchemaJson(JudgeVerdictSchema), // INLINE, $schema stripped (Pitfalls 2-3)
    '--allowedTools', 'Read',
    '--max-turns', '2',
    '--max-budget-usd', String(cfg.budgetPerQueryUsd),
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',               // hermetic; never --continue/--resume
  ];
}

// --------------------------------------------------------------------------
// parseEnvelope - unwrap the --output-format json envelope. Copied near-verbatim
// from huji-run-one.cjs:311-337 (structured_output first, then result, then {...}).
// --------------------------------------------------------------------------
function parseEnvelope(stdout) {
  const out = { envelope: null, structured: null };
  if (!stdout) return out;
  let env = null;
  try { env = JSON.parse(String(stdout)); } catch (_e) { env = null; }
  if (env && typeof env === 'object') {
    out.envelope = env;
    if (env.structured_output && typeof env.structured_output === 'object') {
      out.structured = env.structured_output;
      return out;
    }
    if (typeof env.result === 'string') {
      try { out.structured = JSON.parse(env.result); return out; } catch (_e) { /* fall through */ }
      const m = env.result.match(/\{[\s\S]*\}/);
      if (m) { try { out.structured = JSON.parse(m[0]); return out; } catch (_e2) { /* ignore */ } }
    }
    return out;
  }
  const m = String(stdout).match(/\{[\s\S]*\}/);
  if (m) { try { out.structured = JSON.parse(m[0]); } catch (_e) { /* ignore */ } }
  return out;
}

// --------------------------------------------------------------------------
// defaultSpawn(args, timeoutMs) - the real spawnSync with all fuses. The selftest
// injects a fake in its place so it spends zero budget.
// --------------------------------------------------------------------------
function defaultSpawn(args, timeoutMs) {
  return spawnSync('claude', args, {
    env: process.env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs,
  });
}

// --------------------------------------------------------------------------
// judgeOneQuery({ query, expected, rosterText, config, spawnImpl, timeoutOverrideMs })
// - one isolated judge spawn. Unwraps via parseEnvelope, double-validates with
// JudgeVerdictSchema.safeParse (belt + suspenders). Returns { ok, verdict, env,
// reason, exit }. A failure reason is drawn from the closed vocabulary.
// --------------------------------------------------------------------------
function judgeOneQuery(opts) {
  const o = opts || {};
  const cfg = resolveFunnelConfig(o.config);
  const spawn = o.spawnImpl || defaultSpawn;
  const timeoutMs = typeof o.timeoutOverrideMs === 'number' ? o.timeoutOverrideMs : cfg.timeoutMs;

  const args = buildJudgeArgs(o.rosterText, o.query, o.expected, cfg);
  const res = spawn(args, timeoutMs);

  if (!res || res.error) {
    if (res && (res.signal === 'SIGTERM' || (res.error && /timed? ?out|ETIMEDOUT/i.test(String(res.error.message))))) {
      return { ok: false, reason: 'timeout', env: null, exit: null };
    }
    return { ok: false, reason: 'spawn_failed', env: null, exit: null };
  }
  if (res.signal === 'SIGTERM') return { ok: false, reason: 'timeout', env: null, exit: null };
  if (typeof res.status === 'number' && res.status !== 0) {
    return { ok: false, reason: 'nonzero_exit', env: null, exit: res.status };
  }
  const parsed = parseEnvelope(res.stdout);
  if (!parsed.structured || typeof parsed.structured !== 'object') {
    return { ok: false, reason: 'empty_envelope', env: parsed.envelope, exit: res.status || 0 };
  }
  // Force the expected label onto the verdict so scoring never depends on the model
  // echoing it back correctly; the model's job is predicted_skill + confidence.
  const raw = Object.assign({}, parsed.structured, {
    query: o.query,
    expected_skill: o.expected === undefined ? null : o.expected,
  });
  const v = JudgeVerdictSchema.safeParse(raw);
  if (!v.success) return { ok: false, reason: 'schema_fail', env: parsed.envelope, exit: res.status || 0, issues: v.error.issues };
  return { ok: true, verdict: v.data, env: parsed.envelope, exit: res.status || 0 };
}

// --------------------------------------------------------------------------
// makeUnitRecord - build (and validate) a funnel UnitRecord for one query.
// --------------------------------------------------------------------------
function makeUnitRecord(o) {
  const env = o.env || {};
  const rec = {
    unit_id: o.unitId,
    kind: 'funnel',
    model: o.model,
    session_id: typeof env.session_id === 'string' ? env.session_id : null,
    total_cost_usd: typeof env.total_cost_usd === 'number' ? env.total_cost_usd : null,
    exit: typeof o.exit === 'number' ? o.exit : null,
    status: o.status,
    not_evaluated_reason: o.reason || null,
    error_issues: o.issues || null,
    payload: o.payload != null ? o.payload : null,
  };
  const parsed = UnitRecordSchema.safeParse(rec);
  if (!parsed.success) {
    throw new Error('skillopt-funnel: internal UnitRecord invalid: ' + JSON.stringify(parsed.error.issues));
  }
  return rec;
}

// --------------------------------------------------------------------------
// enumerateQueries(queriesDir, skillsFilter) - flatten every out/queries/*.json
// (EvalQuerySet) into per-query work items. skillsFilter (a Set) narrows which
// skills are evaluated; the roster judged against is ALWAYS the full inventory.
// --------------------------------------------------------------------------
function enumerateQueries(queriesDir, skillsFilter) {
  const items = [];
  let files = [];
  try { files = fs.readdirSync(queriesDir).filter((f) => f.endsWith('.json')); } catch (_e) { files = []; }
  files.sort();
  for (const f of files) {
    let set = null;
    try { set = JSON.parse(fs.readFileSync(path.join(queriesDir, f), 'utf8')); } catch (_e) { continue; }
    if (!set || !Array.isArray(set.queries)) continue;
    if (skillsFilter && skillsFilter.size > 0 && !skillsFilter.has(set.skill)) continue;
    set.queries.forEach((q, i) => {
      items.push({
        skill: set.skill,
        family: set.family,
        index: i,
        query: q.query,
        expected_skill: q.expected_skill === undefined ? null : q.expected_skill,
        split: q.split,
        kind: q.kind,
        unit_id: 'funnel-' + safeStem(set.skill) + '-' + i,
      });
    });
  }
  return items;
}

// --------------------------------------------------------------------------
// classifySkills(units) - apply the locked flag rule per skill and build the
// per-skill funnel-results rows. units = array of { item, unit, verdict? }.
//   verdict 'not_evaluated' iff the skill has zero ok units.
//   else 'flagged' iff any TRAIN query missed (predicted !== expected), OR any
//        verdict is low/medium confidence, OR any unit is not_evaluated (fail open).
//   else 'pass'.
// --------------------------------------------------------------------------
function classifySkills(units) {
  const bySkill = new Map();
  for (const u of units) {
    if (!bySkill.has(u.item.skill)) bySkill.set(u.item.skill, []);
    bySkill.get(u.item.skill).push(u);
  }
  const rows = [];
  for (const [skill, us] of bySkill) {
    const okUnits = us.filter((u) => u.unit.status === 'ok');
    const notEvalUnits = us.filter((u) => u.unit.status === 'not_evaluated');
    const unit_ids = us.map((u) => u.unit.unit_id).sort();
    let train_miss_count = 0;
    let low_conf_count = 0;
    for (const u of okUnits) {
      const v = u.verdict;
      if (u.item.split === 'train' && v && v.predicted_skill !== v.expected_skill) train_miss_count += 1;
      if (v && (v.confidence === 'low' || v.confidence === 'medium')) low_conf_count += 1;
    }
    let verdict;
    if (okUnits.length === 0) {
      verdict = 'not_evaluated';
    } else if (train_miss_count > 0 || low_conf_count > 0 || notEvalUnits.length > 0) {
      verdict = 'flagged';
    } else {
      verdict = 'pass';
    }
    rows.push({ skill, verdict, train_miss_count, low_conf_count, not_evaluated_count: notEvalUnits.length, unit_ids });
  }
  rows.sort((a, b) => (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0));
  return rows;
}

// --------------------------------------------------------------------------
// runFunnel({ inventory, queriesDir, config, outDir, spawnImpl, skills,
//   probeTimeoutUnit, probeMark, _injectReconcileDrift }) - the roster-wide funnel.
// Returns { results, reconciliation, reconcileOk, concurrency }. Does NOT call
// process.exit (testable); main() enforces the D5 identity with exit 1.
// --------------------------------------------------------------------------
async function runFunnel(opts) {
  const o = opts || {};
  const cfg = resolveFunnelConfig(o.config);
  const outDir = o.outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const queriesDir = o.queriesDir || path.join(outDir, 'queries');
  const unitsDir = path.join(outDir, 'funnel', 'units');
  const spawn = o.spawnImpl || defaultSpawn;

  const preflight = assertPinnedModelId(cfg.model);
  if (!preflight.ok) throw new Error('skillopt-funnel: model not pinned (' + preflight.reason + '): ' + cfg.model);
  if (cfg.concurrencyClamped) {
    console.error('WARN skillopt-funnel: concurrency clamped to the hard cap of ' + HARD_CAP_CONCURRENCY + ' (429-storm guard).');
  }

  const rosterText = buildRosterStubs(o.inventory || []);
  const skillsFilter = o.skills && o.skills.length ? new Set(o.skills) : null;
  const items = enumerateQueries(queriesDir, skillsFilter);

  fs.mkdirSync(unitsDir, { recursive: true });

  // Track which skill's first unit is the induced-timeout probe target (D5).
  const probeSkill = o.probeTimeoutUnit || null;
  const probeFiredForSkill = new Set();

  // Independent reconciliation counters (so a drift is a real, catchable violation).
  let spawnedCount = 0;
  let okCount = 0;
  let notEvalCount = 0;

  const units = []; // { item, unit, verdict? }

  const worker = async (item) => {
    // Resume: a .done sentinel means this unit already settled in a prior run.
    if (isDone(unitsDir, item.unit_id)) {
      let prior = null;
      try { prior = JSON.parse(fs.readFileSync(path.join(unitsDir, safeStem(item.unit_id) + '.json'), 'utf8')); } catch (_e) { prior = null; }
      return { item, resumed: true, unit: prior };
    }

    // Induced not-evaluated probe (Plan 07 D5 hook): force a 1ms timeout on this
    // skill's FIRST unit; it must land not_evaluated, reason 'timeout' (or
    // 'induced_probe' when --probe-mark is set).
    let timeoutOverrideMs;
    let isProbe = false;
    if (probeSkill && item.skill === probeSkill && !probeFiredForSkill.has(item.skill)) {
      probeFiredForSkill.add(item.skill);
      timeoutOverrideMs = 1;
      isProbe = true;
    }

    // Attempt + ONE retry on any failure (skip the retry for the induced probe -
    // its whole point is to land not_evaluated).
    let jr = judgeOneQuery({ query: item.query, expected: item.expected_skill, rosterText, config: cfg, spawnImpl: spawn, timeoutOverrideMs });
    if (!jr.ok && !isProbe) {
      jr = judgeOneQuery({ query: item.query, expected: item.expected_skill, rosterText, config: cfg, spawnImpl: spawn, timeoutOverrideMs });
    }
    return { item, resumed: false, jr, isProbe };
  };

  const onSettle = (settled) => {
    const res = settled.res;
    if (!res) return; // worker threw (shouldn't; judgeOneQuery is total)
    if (res.resumed) {
      // Prior unit: classify from disk, do NOT count as a fresh spawn.
      const unit = res.unit && UnitRecordSchema.safeParse(res.unit).success ? res.unit : null;
      if (unit) {
        if (unit.status === 'ok') okCount += 1; else notEvalCount += 1;
        spawnedCount += 1;
        units.push({ item: res.item, unit, verdict: unit.payload || null });
      }
      return;
    }
    spawnedCount += 1;
    const item = res.item;
    if (res.jr.ok) {
      const unit = makeUnitRecord({
        unitId: item.unit_id, model: cfg.model, env: res.jr.env, exit: res.jr.exit,
        status: 'ok', reason: null, payload: res.jr.verdict,
      });
      okCount += 1;
      persistUnit(unitsDir, unit, outDir);
      units.push({ item, unit, verdict: res.jr.verdict });
    } else {
      let reason = res.jr.reason;
      if (res.isProbe && o.probeMark) reason = 'induced_probe';
      const unit = makeUnitRecord({
        unitId: item.unit_id, model: cfg.model, env: res.jr.env, exit: res.jr.exit,
        status: 'not_evaluated', reason, issues: res.jr.issues || null,
      });
      notEvalCount += 1;
      persistUnit(unitsDir, unit, outDir);
      units.push({ item, unit, verdict: null });
    }
  };

  await runPool({
    items,
    getLimit: () => cfg.concurrency,
    worker,
    onSettle,
  });

  // Deliberate drift injection for the selftest's broken-reconciliation fixture.
  if (typeof o._injectReconcileDrift === 'number') spawnedCount += o._injectReconcileDrift;

  const results = classifySkills(units);
  const reconciliation = { spawned: spawnedCount, ok: okCount, not_evaluated: notEvalCount };
  const reconcileOk = reconciliation.spawned === reconciliation.ok + reconciliation.not_evaluated;

  const funnelResults = {
    reconciliation,
    reconcile_ok: reconcileOk,
    concurrency: cfg.concurrency,
    skills: results,
  };

  // Persist funnel-results.json (guarded) unless the caller is a pure in-memory test.
  if (!o._noWriteResults) {
    const target = path.join(outDir, 'funnel', 'funnel-results.json');
    const guard = assertUnderOut(target, outDir);
    if (!guard.ok) throw new Error('skillopt-funnel: refusing to write results outside out sandbox: ' + target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeAtomic(target, JSON.stringify(funnelResults, null, 2) + '\n');
  }

  return { results, reconciliation, reconcileOk, concurrency: cfg.concurrency, funnelResults };
}

// Persist a unit record + its .done sentinel (both guarded).
function persistUnit(unitsDir, unit, outDir) {
  const target = path.join(unitsDir, safeStem(unit.unit_id) + '.json');
  const guard = assertUnderOut(target, outDir);
  if (!guard.ok) throw new Error('skillopt-funnel: refusing to write unit outside out sandbox: ' + target);
  fs.mkdirSync(unitsDir, { recursive: true });
  writeAtomic(target, JSON.stringify(unit, null, 2) + '\n');
  writeAtomic(path.join(unitsDir, safeStem(unit.unit_id) + '.done'), '');
}

// --------------------------------------------------------------------------
// loadInventory(outDir) - read out/inventory.json (Plan 01's ground truth).
// --------------------------------------------------------------------------
function loadInventory(outDir) {
  return JSON.parse(fs.readFileSync(path.join(outDir, 'inventory.json'), 'utf8'));
}

// --------------------------------------------------------------------------
// runSelftest - deterministic fixtures, ZERO real spawn, zero API spend. Covers the
// five required fixtures plus a reconciliation-drift violation and a concurrency clamp.
// --------------------------------------------------------------------------
async function runSelftest() {
  const assert = require('node:assert');

  // Roster stub builder: one line per record, no body text.
  const fixtureInventory = [
    { skill: 'sA', description: 'alpha skill\nwith a newline body ref scripts/a.cjs' },
    { skill: 'sB', description: 'beta skill' },
    { skill: 'sC', description: 'gamma skill' },
    { skill: 'sD', description: 'delta skill' },
    { skill: 'sE', description: 'epsilon skill' },
  ];
  const roster = buildRosterStubs(fixtureInventory);
  assert.strictEqual(roster.split('\n').length, fixtureInventory.length, 'selftest: roster must have exactly one line per record');
  assert.ok(!/\n.*\n.*scripts\/a\.cjs/.test(roster) || roster.split('\n')[0].includes('sA:'), 'selftest: roster sA must be a single collapsed line');
  assert.ok(roster.split('\n')[0] === 'sA: alpha skill with a newline body ref scripts/a.cjs', 'selftest: description newlines must collapse to one line');

  // A hermetic out dir UNDER .planning/.../out/ so assertUnderOut passes; cleaned up.
  const baseOut = path.join(REPO_ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmpOut = fs.mkdtempSync(path.join(baseOut, '.selftest-funnel-'));

  try {
    const queriesDir = path.join(tmpOut, 'queries');
    fs.mkdirSync(queriesDir, { recursive: true });

    // Five single-query skills, each a distinct fixture case keyed by CASE marker.
    const mk = (skill, marker, expected) => ({
      skill, family: 'plain:s',
      queries: [{ query: marker, expected_skill: expected, family: 'plain:s', split: 'train', kind: 'should_trigger' }],
    });
    fs.writeFileSync(path.join(queriesDir, 'sA.json'), JSON.stringify(mk('sA', 'CASE-miss', 'sA')));
    fs.writeFileSync(path.join(queriesDir, 'sB.json'), JSON.stringify(mk('sB', 'CASE-medium', 'sB')));
    fs.writeFileSync(path.join(queriesDir, 'sC.json'), JSON.stringify(mk('sC', 'CASE-clean', 'sC')));
    fs.writeFileSync(path.join(queriesDir, 'sD.json'), JSON.stringify(mk('sD', 'CASE-unparseable', 'sD')));
    fs.writeFileSync(path.join(queriesDir, 'sE.json'), JSON.stringify(mk('sE', 'CASE-resume', 'sE')));

    // Pre-seed sE as already done (resume): the worker must NOT be called for it.
    const unitsDir = path.join(tmpOut, 'funnel', 'units');
    fs.mkdirSync(unitsDir, { recursive: true });
    const priorVerdict = { query: 'CASE-resume', predicted_skill: 'sE', expected_skill: 'sE', confidence: 'high', reasoning: 'prior run' };
    const priorUnit = makeUnitRecord({ unitId: 'funnel-sE-0', model: PINNED_SONNET, env: { session_id: 'sess-prior', total_cost_usd: 0.01 }, exit: 0, status: 'ok', payload: priorVerdict });
    fs.writeFileSync(path.join(unitsDir, 'funnel-sE-0.json'), JSON.stringify(priorUnit));
    fs.writeFileSync(path.join(unitsDir, 'funnel-sE-0.done'), '');

    // A fake spawn keyed by the CASE marker embedded in the -p prompt. Also records
    // which markers it was asked to judge (so we can prove sE was skipped).
    const spawnedMarkers = [];
    const fakeSpawn = (args, _timeoutMs) => {
      const prompt = args[1] || '';
      const marker = (prompt.match(/CASE-[a-z]+/) || [''])[0];
      spawnedMarkers.push(marker);
      const mkEnv = (verdict) => ({ status: 0, stdout: JSON.stringify({ structured_output: verdict, session_id: 'sess-' + marker, total_cost_usd: 0.01 }) });
      if (marker === 'CASE-miss') return mkEnv({ query: 'x', predicted_skill: 'sB', expected_skill: 'sA', confidence: 'high', reasoning: 'sibling stole it' });
      if (marker === 'CASE-medium') return mkEnv({ query: 'x', predicted_skill: 'sB', expected_skill: 'sB', confidence: 'medium', reasoning: 'ambiguous' });
      if (marker === 'CASE-clean') return mkEnv({ query: 'x', predicted_skill: 'sC', expected_skill: 'sC', confidence: 'high', reasoning: 'clear' });
      if (marker === 'CASE-unparseable') return { status: 0, stdout: 'not json at all <<<' };
      return mkEnv({ query: 'x', predicted_skill: null, expected_skill: null, confidence: 'high', reasoning: 'default' });
    };

    const run = await runFunnel({ inventory: fixtureInventory, queriesDir, outDir: tmpOut, spawnImpl: fakeSpawn, config: { concurrency: 2 } });

    const bySkill = {};
    for (const r of run.results) bySkill[r.skill] = r;
    assert.strictEqual(bySkill.sA.verdict, 'flagged', 'selftest: train miss must flag (sA)');
    assert.strictEqual(bySkill.sB.verdict, 'flagged', 'selftest: medium confidence must flag (sB)');
    assert.strictEqual(bySkill.sC.verdict, 'pass', 'selftest: clean high-correct must pass (sC)');
    assert.strictEqual(bySkill.sD.verdict, 'not_evaluated', 'selftest: unparseable must be not_evaluated (sD)');
    assert.ok(bySkill.sE, 'selftest: resumed sE must appear in results');
    assert.ok(!spawnedMarkers.includes('CASE-resume'), 'selftest: resumed sE must NOT be re-spawned');

    // Reconciliation identity holds for a clean run.
    assert.strictEqual(run.reconcileOk, true, 'selftest: reconciliation identity must hold on a clean run');
    assert.strictEqual(run.reconciliation.spawned, run.reconciliation.ok + run.reconciliation.not_evaluated, 'selftest: spawned == ok + not_evaluated');

    // Deliberately broken reconciliation -> reconcileOk false (main() would exit 1).
    const broken = await runFunnel({ inventory: fixtureInventory, queriesDir, outDir: tmpOut, spawnImpl: fakeSpawn, config: { concurrency: 2 }, _injectReconcileDrift: 1, _noWriteResults: true });
    assert.strictEqual(broken.reconcileOk, false, 'selftest: injected drift must break the reconciliation identity');

    // Concurrency clamp: request 10 -> clamped to the hard cap of 4.
    const clamped = await runFunnel({ inventory: fixtureInventory, queriesDir, outDir: tmpOut, spawnImpl: fakeSpawn, config: { concurrency: 10 }, _noWriteResults: true });
    assert.strictEqual(clamped.concurrency, HARD_CAP_CONCURRENCY, 'selftest: concurrency 10 must clamp to ' + HARD_CAP_CONCURRENCY);

    // Induced-timeout probe: a SIGTERM-simulating spawn lands not_evaluated, and
    // --probe-mark rewrites the reason to induced_probe.
    const probeQueriesDir = path.join(tmpOut, 'queries-probe');
    fs.mkdirSync(probeQueriesDir, { recursive: true });
    fs.writeFileSync(path.join(probeQueriesDir, 'sP.json'), JSON.stringify(mk('sP', 'CASE-probe', 'sP')));
    const timeoutSpawn = () => ({ signal: 'SIGTERM', status: null, stdout: '' });
    const probeRun = await runFunnel({ inventory: fixtureInventory, queriesDir: probeQueriesDir, outDir: tmpOut, spawnImpl: timeoutSpawn, config: { concurrency: 1 }, probeTimeoutUnit: 'sP', probeMark: true, _noWriteResults: true });
    assert.strictEqual(probeRun.results[0].verdict, 'not_evaluated', 'selftest: probe unit must be not_evaluated');
    const probeUnit = JSON.parse(fs.readFileSync(path.join(tmpOut, 'funnel', 'units', 'funnel-sP-0.json'), 'utf8'));
    assert.strictEqual(probeUnit.not_evaluated_reason, 'induced_probe', 'selftest: --probe-mark must record reason induced_probe');
    assert.ok(NOT_EVALUATED_REASONS.includes(probeUnit.not_evaluated_reason), 'selftest: probe reason in closed vocabulary');
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  console.log('OK - skillopt-funnel self-test passed: miss->flag, medium->flag, clean->pass, unparseable->not_evaluated, resume skip, reconciliation gate, concurrency clamp, induced probe.');
}

// --------------------------------------------------------------------------
// main - switch-case argv router (gsd-tools.cjs pattern), no Commander/yargs.
//   --selftest                deterministic fixtures, no spawn, exit
//   --dry-run                 build + print one judge arg vector, spawn NOTHING
//   --skills <csv>            limit evaluated skills (roster stays full)
//   --concurrency <n>         pool size (default 3, hard cap 4)
//   --out <dir>               out directory (default PHASE_OUT_DIR)
//   --probe-timeout-unit <s>  force a 1ms timeout on that skill's first unit (D5)
//   --probe-mark              record the induced probe reason as 'induced_probe'
//   --budget-per-query <usd>  per-judge-call --max-budget-usd fuse (default 0.05).
//                             The default is too low for the real 124-skill roster
//                             (a cold judge call costs ~0.16 on cache-creation), so a
//                             live smoke run must raise it or every unit dies
//                             error_max_budget_usd -> nonzero_exit (Plan 07 deviation).
// --------------------------------------------------------------------------
async function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--selftest')) { await runSelftest(); return; }

  let outDir = path.join(REPO_ROOT, PHASE_OUT_DIR);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) outDir = path.resolve(args[outIdx + 1]);

  let skills = null;
  const skIdx = args.indexOf('--skills');
  if (skIdx >= 0 && args[skIdx + 1]) skills = args[skIdx + 1].split(',').map((s) => s.trim()).filter(Boolean);

  let concurrency = DEFAULT_CONCURRENCY;
  const cIdx = args.indexOf('--concurrency');
  if (cIdx >= 0 && args[cIdx + 1]) concurrency = parseInt(args[cIdx + 1], 10) || DEFAULT_CONCURRENCY;

  let probeTimeoutUnit = null;
  const pIdx = args.indexOf('--probe-timeout-unit');
  if (pIdx >= 0 && args[pIdx + 1]) probeTimeoutUnit = args[pIdx + 1];
  const probeMark = args.includes('--probe-mark');

  let budgetPerQueryUsd;
  const bIdx = args.indexOf('--budget-per-query');
  if (bIdx >= 0 && args[bIdx + 1]) {
    const b = parseFloat(args[bIdx + 1]);
    if (!Number.isNaN(b) && b > 0) budgetPerQueryUsd = b;
  }
  const funnelConfig = { concurrency };
  if (budgetPerQueryUsd !== undefined) funnelConfig.budgetPerQueryUsd = budgetPerQueryUsd;

  let inventory = [];
  try { inventory = loadInventory(outDir); } catch (_e) { inventory = []; }

  if (args.includes('--dry-run')) {
    const rosterText = buildRosterStubs(inventory);
    const sampleSkill = (skills && skills[0]) || 'sample-skill';
    const vec = buildJudgeArgs(rosterText, 'sample query for ' + sampleSkill, sampleSkill, funnelConfig);
    console.log('# dry-run funnel judge skills=' + (skills ? skills.join(',') : 'all') + ' concurrency=' + resolveFunnelConfig(funnelConfig).concurrency);
    console.log(JSON.stringify(vec));
    return;
  }

  const run = await runFunnel({ inventory, config: funnelConfig, outDir, skills, probeTimeoutUnit, probeMark });
  console.log('funnel: spawned=' + run.reconciliation.spawned + ' ok=' + run.reconciliation.ok + ' not_evaluated=' + run.reconciliation.not_evaluated);
  if (!run.reconcileOk) {
    console.error('FATAL skillopt-funnel: reconciliation identity violated (spawned != ok + not_evaluated) - D5 breach.');
    process.exit(1);
  }
  const flagged = run.results.filter((r) => r.verdict === 'flagged').length;
  console.log('OK skillopt-funnel: ' + run.results.length + ' skills, ' + flagged + ' flagged -> ' + path.join(outDir, 'funnel', 'funnel-results.json'));
}

module.exports = {
  judgeOneQuery,
  buildRosterStubs,
  runFunnel,
  runPool,
  buildJudgeArgs,
  buildJudgePrompt,
  parseEnvelope,
  enumerateQueries,
  classifySkills,
  resolveFunnelConfig,
  HARD_CAP_CONCURRENCY,
  PINNED_SONNET,
};

if (require.main === module) {
  main(process.argv).catch((e) => { console.error('FATAL skillopt-funnel:', e && e.message || e); process.exit(1); });
}
