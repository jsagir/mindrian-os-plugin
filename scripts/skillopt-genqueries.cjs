#!/usr/bin/env node
'use strict';
/*
 * scripts/skillopt-genqueries.cjs - Phase 230-02, WS1.2: per-family eval-query generation.
 * ==========================================================================
 * One sonnet subagent per NAMESPACE FAMILY sees every sibling skill at once (name +
 * description each), so the negative eval queries it writes are REAL near-misses
 * (find-connections vs find-analogies), not generic noise. That per-family framing
 * is the whole design move (CONTEXT.md Specifics): a per-skill-in-isolation
 * generator cannot know which sibling a query would collide with.
 *
 * Two disciplines this file never bends:
 *   - The model only ever LABELS queries (expected_skill + kind). The
 *     train/validation SPLIT is assigned deterministically in code (splitQueries),
 *     never by the model - a model-chosen split would not be reproducible and could
 *     silently overfit (AI-SPEC Section 5, D3).
 *   - No silent skip (D5 / CFM3): a spawn error, nonzero exit, timeout, empty
 *     envelope, or safeParse failure - after ONE retry - is recorded as a
 *     UnitRecord with status 'not_evaluated' and its reason from the closed
 *     NOT_EVALUATED_REASONS vocabulary. It is never absorbed as a silent pass and
 *     never yields a written queries file.
 *
 * Spawn shape is copied from huji-run-one.cjs buildStageAArgs (255-269): the frozen
 * rubric rides --append-system-prompt-file (prompt-cache stable + provenance), the
 * per-family variable rides -p, keychain auth via --plugin-dir (NEVER --bare,
 * Pitfall 4), the schema is INLINE via inlineSchemaJson (never a path, Pitfall 2),
 * and every spawn carries all five fuses (--max-turns, --max-budget-usd, timeout,
 * --allowedTools, --no-session-persistence).
 *
 * Write-path containment (D6): every queries file resolves under .planning/.../out/
 * via assertUnderOut, fail-closed. CJS only, switch-case argv router, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { z } = require('zod/v4'); // NOT bare 'zod': the v4 subpath gives z.toJSONSchema

const {
  EvalQuerySetSchema,
  UnitRecordSchema,
  NOT_EVALUATED_REASONS,
  PHASE_OUT_DIR,
  inlineSchemaJson,
  assertUnderOut,
  assertPinnedModelId,
} = require('../lib/core/skillopt-schemas.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// The pinned FULL sonnet id, copied verbatim from the huji-eval.cjs judge config
// (JUDGE_MODEL default 'claude-sonnet-4-5'). Never a bare alias - assertPinnedModelId
// preflights it before any spend.
const PINNED_SONNET = 'claude-sonnet-4-5';

// The frozen generator instruction (stable bytes = prompt-cache bite per family).
const RUBRIC_PATH = path.join('references', 'methodology', 'skillopt-queries-rubric.md');

// --------------------------------------------------------------------------
// The families-output WRAPPER schema. It is EvalQuerySetSchema WITHOUT the split
// field: the model labels queries (query/expected_skill/family/kind), it never
// assigns a split. splitQueries adds split in code afterward.
// --------------------------------------------------------------------------
const GenQuerySchema = z.object({
  query: z.string().min(1),
  expected_skill: z.string().nullable(),
  family: z.string().min(1),
  kind: z.enum(['should_trigger', 'should_not_trigger']),
});
const GenQuerySetSchema = z.object({
  skill: z.string().min(1),
  family: z.string().min(1),
  queries: z.array(GenQuerySchema).min(4),
});
const FamilyOutputSchema = z.object({
  sets: z.array(GenQuerySetSchema).min(1),
});

// --------------------------------------------------------------------------
// writeAtomic - write-temp-then-rename (copied from huji-batch.writeAtomic:60-64).
// --------------------------------------------------------------------------
function writeAtomic(filePath, contents) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

// --------------------------------------------------------------------------
// resolveGenConfig - defaults for a generation run. A real run may override the
// model or budget; the selftest/dry-run paths take these defaults.
// --------------------------------------------------------------------------
function resolveGenConfig(config) {
  const c = config || {};
  return {
    model: c.model || PINNED_SONNET,
    pluginDir: c.pluginDir || REPO_ROOT,
    rubricPath: c.rubricPath || RUBRIC_PATH,
    genBudgetUsd: typeof c.genBudgetUsd === 'number' ? c.genBudgetUsd : 0.5,
    timeoutMs: typeof c.timeoutMs === 'number' ? c.timeoutMs : 180000,
  };
}

// Collapse any whitespace (incl. newlines) so a stub is one clean line.
function oneLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

// A filesystem-safe stem for a skill name (find-connections, mos:find-connections).
function safeStem(name) {
  return String(name || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

// --------------------------------------------------------------------------
// buildFamilyVariable(family, skills) - the per-family -p payload: the family name
// plus every sibling as a 'name: description' line. This is the variable half; the
// frozen instruction lives in the appended system-prompt file, never here.
// --------------------------------------------------------------------------
function buildFamilyVariable(family, skills) {
  const lines = [];
  lines.push('FAMILY: ' + family);
  lines.push('');
  lines.push('SKILLS IN THIS FAMILY (name: description) - you see every sibling at once:');
  for (const s of (skills || [])) {
    lines.push('- ' + s.skill + ': ' + oneLine(s.description));
  }
  lines.push('');
  lines.push('Write 6 to 8 eval queries per skill per the frozen instructions.');
  lines.push('Return ONLY the JSON object the schema describes (a sets array).');
  return lines.join('\n');
}

// --------------------------------------------------------------------------
// buildGenArgs(family, skills, config) - the spawn arg array on the buildStageAArgs
// shape (discrete args, no shell). Returns { args, variable }.
// --------------------------------------------------------------------------
function buildGenArgs(family, skills, config) {
  const cfg = resolveGenConfig(config);
  const variable = buildFamilyVariable(family, skills);
  const args = [
    '-p', variable,
    '--append-system-prompt-file', cfg.rubricPath,
    '--plugin-dir', cfg.pluginDir,            // keychain auth, NEVER --bare (Pitfall 4)
    '--model', cfg.model,                     // pinned full sonnet id
    '--output-format', 'json',
    '--json-schema', inlineSchemaJson(FamilyOutputSchema), // INLINE, $schema stripped (Pitfalls 2-3)
    '--allowedTools', 'Read',
    '--max-turns', '2',
    '--max-budget-usd', String(cfg.genBudgetUsd),
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',               // hermetic; never --continue/--resume
  ];
  return { args, variable };
}

// --------------------------------------------------------------------------
// parseEnvelope - unwrap the --output-format json envelope. Copied near-verbatim
// from huji-run-one.cjs:311-337. Prefers structured_output, falls back to
// JSON-parsing result, then the first {...} in the text.
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
// classifySpawn(res) - map a spawnSync result to { ok, structured, reason, env }.
// A failure reason is drawn from the closed NOT_EVALUATED_REASONS vocabulary.
// --------------------------------------------------------------------------
function classifySpawn(res) {
  if (!res || res.error) {
    // spawnSync sets .signal === 'SIGTERM' on a timeout kill; distinguish it.
    if (res && (res.signal === 'SIGTERM' || (res.error && /timed? ?out|ETIMEDOUT/i.test(String(res.error.message))))) {
      return { ok: false, reason: 'timeout', env: null };
    }
    return { ok: false, reason: 'spawn_failed', env: null };
  }
  if (res.signal === 'SIGTERM') return { ok: false, reason: 'timeout', env: null };
  if (typeof res.status === 'number' && res.status !== 0) return { ok: false, reason: 'nonzero_exit', env: null };
  const parsed = parseEnvelope(res.stdout);
  if (!parsed.structured || typeof parsed.structured !== 'object') {
    return { ok: false, reason: 'empty_envelope', env: parsed.envelope };
  }
  const v = FamilyOutputSchema.safeParse(parsed.structured);
  if (!v.success) return { ok: false, reason: 'schema_fail', env: parsed.envelope, issues: v.error.issues };
  return { ok: true, structured: v.data, env: parsed.envelope };
}

// --------------------------------------------------------------------------
// makeUnitRecord - build (and validate) a UnitRecord for one family generation
// unit. Cost/session pulled from the envelope when present.
// --------------------------------------------------------------------------
function makeUnitRecord(o) {
  const env = o.env || {};
  const rec = {
    unit_id: o.unitId,
    kind: 'genqueries',
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
    // A malformed unit record is a code bug, not a pipeline miss - surface it loud.
    throw new Error('skillopt-genqueries: internal UnitRecord invalid: ' + JSON.stringify(parsed.error.issues));
  }
  return rec;
}

// --------------------------------------------------------------------------
// splitQueries(queries, seed) - DETERMINISTIC stratified 60/40 train/validation
// split, done in code, never by the model. Partition by kind, sort each partition
// by query text, then pick validation members by a seeded stride so both splits
// carry a proportional kind mix. Round so validation gets at least ~40% and, for a
// real set (>= 5 queries), never fewer than 2.
// --------------------------------------------------------------------------
function splitQueries(queries, seed) {
  const s = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  const total = Array.isArray(queries) ? queries.length : 0;
  const wantMinVal = total >= 5 ? 2 : 0; // guarantee held-out signal on a real set
  const kinds = ['should_trigger', 'should_not_trigger'];
  const out = [];

  // First pass computes each partition's validation count; a second pass bumps the
  // largest partition if the global minimum-validation floor is not yet met.
  const parts = kinds.map((kind) => {
    const items = queries
      .filter((q) => q.kind === kind)
      .slice()
      .sort((a, b) => (a.query < b.query ? -1 : a.query > b.query ? 1 : 0));
    const n = items.length;
    let trainN = Math.round(0.6 * n);
    if (trainN >= n && n > 1) trainN = n - 1; // keep at least one validation when n>1
    if (trainN < 0) trainN = 0;
    return { kind, items, n, valN: n - trainN };
  });

  // Enforce the global validation floor (>=2 for total>=5) by moving borderline
  // items from train to validation in the largest partition first.
  let valTotal = parts.reduce((a, p) => a + p.valN, 0);
  const byBig = parts.slice().sort((a, b) => b.n - a.n);
  let bi = 0;
  while (valTotal < wantMinVal && byBig.some((p) => p.valN < p.n)) {
    const p = byBig[bi % byBig.length];
    if (p.valN < p.n) { p.valN += 1; valTotal += 1; }
    bi += 1;
    if (bi > 1000) break; // defensive
  }

  for (const p of parts) {
    const { items, n, valN } = p;
    const valIdx = new Set();
    if (valN > 0 && n > 0) {
      const stride = Math.max(1, Math.floor(n / valN));
      let idx = n > 0 ? s % n : 0;
      let guard = 0;
      while (valIdx.size < valN && guard < n * 4 + 8) {
        valIdx.add(idx % n);
        idx += stride;
        if (valIdx.size < valN && idx % n === s % n) idx += 1; // avoid re-hitting the start
        guard += 1;
      }
      // Fallback: if the stride under-filled, take the first free indices.
      for (let i = 0; i < n && valIdx.size < valN; i++) valIdx.add(i);
    }
    items.forEach((q, i) => {
      out.push(Object.assign({}, q, { split: valIdx.has(i) ? 'validation' : 'train' }));
    });
  }
  return out;
}

// A stable numeric seed for a skill name (so identical input yields identical split).
function seedForSkill(name) {
  let h = 0;
  const str = String(name || '');
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

// --------------------------------------------------------------------------
// generateQueriesForFamily({ family, skills, config, outDir, spawnImpl }) - the
// per-family orchestration: build args, spawn, ONE retry on failure, parse +
// safeParse, then EITHER write a not_evaluated UnitRecord (failure) OR apply
// splitQueries and write out/queries/<skill>.json per skill plus an ok UnitRecord.
// Returns { ok, unit, written }.
// --------------------------------------------------------------------------
function generateQueriesForFamily(opts) {
  const o = opts || {};
  const family = o.family;
  const skills = o.skills || [];
  const cfg = resolveGenConfig(o.config);
  const outDir = o.outDir || path.join(REPO_ROOT, PHASE_OUT_DIR);
  const spawn = o.spawnImpl || defaultSpawn;
  const unitId = 'genqueries-' + safeStem(family);

  const preflight = assertPinnedModelId(cfg.model);
  if (!preflight.ok) {
    throw new Error('skillopt-genqueries: model is not a pinned full id (' + preflight.reason + '): ' + cfg.model);
  }

  const { args } = buildGenArgs(family, skills, cfg);

  // Attempt + ONE retry on any failure classification.
  let res = spawn(args, cfg.timeoutMs);
  let cls = classifySpawn(res);
  if (!cls.ok) {
    res = spawn(args, cfg.timeoutMs);
    cls = classifySpawn(res);
  }

  const unitsDir = path.join(outDir, 'genqueries-units');
  const queriesDir = path.join(outDir, 'queries');

  if (!cls.ok) {
    const unit = makeUnitRecord({
      unitId, model: cfg.model, env: cls.env,
      exit: res && typeof res.status === 'number' ? res.status : null,
      status: 'not_evaluated', reason: cls.reason, issues: cls.issues || null,
    });
    writeUnit(unitsDir, unit, outDir);
    return { ok: false, unit, written: [] };
  }

  // Success: split each set in code and write per-skill files.
  const written = [];
  for (const set of cls.structured.sets) {
    const labeled = set.queries.map((q) => ({
      query: q.query,
      expected_skill: q.expected_skill,
      family: set.family || family,
      kind: q.kind,
    }));
    const withSplit = splitQueries(labeled, seedForSkill(set.skill));
    const querySet = { skill: set.skill, family: set.family || family, queries: withSplit };
    const v = EvalQuerySetSchema.safeParse(querySet);
    if (!v.success) {
      // The wrapper parsed but the assembled EvalQuerySet does not - treat the whole
      // family unit as not_evaluated (schema_fail); never write a partial set.
      const unit = makeUnitRecord({
        unitId, model: cfg.model, env: cls.env,
        exit: res && typeof res.status === 'number' ? res.status : null,
        status: 'not_evaluated', reason: 'schema_fail', issues: v.error.issues,
      });
      writeUnit(unitsDir, unit, outDir);
      return { ok: false, unit, written: [] };
    }
    const target = path.join(queriesDir, safeStem(set.skill) + '.json');
    const guard = assertUnderOut(target, outDir);
    if (!guard.ok) {
      throw new Error('skillopt-genqueries: refusing to write outside out sandbox (' + guard.reason + '): ' + target);
    }
    fs.mkdirSync(queriesDir, { recursive: true });
    writeAtomic(target, JSON.stringify(querySet, null, 2) + '\n');
    written.push(target);
  }

  const unit = makeUnitRecord({
    unitId, model: cfg.model, env: cls.env,
    exit: res && typeof res.status === 'number' ? res.status : 0,
    status: 'ok', reason: null,
  });
  writeUnit(unitsDir, unit, outDir);
  return { ok: true, unit, written };
}

// Write a UnitRecord under out/genqueries-units/<unit_id>.json (guarded).
function writeUnit(unitsDir, unit, outDir) {
  const target = path.join(unitsDir, safeStem(unit.unit_id) + '.json');
  const guard = assertUnderOut(target, outDir);
  if (!guard.ok) {
    throw new Error('skillopt-genqueries: refusing to write unit outside out sandbox: ' + target);
  }
  fs.mkdirSync(unitsDir, { recursive: true });
  writeAtomic(target, JSON.stringify(unit, null, 2) + '\n');
  return target;
}

// --------------------------------------------------------------------------
// loadInventory(outDir) - read out/inventory.json (Plan 01's ground truth).
// --------------------------------------------------------------------------
function loadInventory(outDir) {
  const fp = path.join(outDir, 'inventory.json');
  const raw = fs.readFileSync(fp, 'utf8');
  return JSON.parse(raw);
}

// Group inventory records into { family -> [records] }.
function groupByFamily(records) {
  const byFam = new Map();
  for (const r of records) {
    if (!byFam.has(r.family)) byFam.set(r.family, []);
    byFam.get(r.family).push(r);
  }
  return byFam;
}

// --------------------------------------------------------------------------
// runSelftest - deterministic fixtures, ZERO spawn, zero API spend.
//   1. splitQueries: 10 queries (5/5) -> 6 train / 4 validation, both kinds in both
//      splits, byte-identical on a second run with the same seed.
//   2. bad-envelope fixture (both attempts) -> UnitRecord not_evaluated schema_fail,
//      no queries file written.
//   3. good-envelope fixture -> per-skill files whose queries carry a split field.
// --------------------------------------------------------------------------
function runSelftest() {
  const assert = require('node:assert');

  // --- 1. splitQueries stratification ---
  const tenRaw = [];
  for (let i = 0; i < 5; i++) tenRaw.push({ query: 'trig-' + i, expected_skill: 'sX', family: 'plain:s', kind: 'should_trigger' });
  for (let i = 0; i < 5; i++) tenRaw.push({ query: 'neg-' + i, expected_skill: null, family: 'plain:s', kind: 'should_not_trigger' });
  const split1 = splitQueries(tenRaw, seedForSkill('sX'));
  const split2 = splitQueries(tenRaw, seedForSkill('sX'));
  assert.deepStrictEqual(split1, split2, 'selftest: splitQueries must be deterministic for the same seed');
  const trainAll = split1.filter((q) => q.split === 'train');
  const valAll = split1.filter((q) => q.split === 'validation');
  assert.strictEqual(trainAll.length, 6, 'selftest: 10-query set must split 6 train (got ' + trainAll.length + ')');
  assert.strictEqual(valAll.length, 4, 'selftest: 10-query set must split 4 validation (got ' + valAll.length + ')');
  for (const kind of ['should_trigger', 'should_not_trigger']) {
    assert.ok(trainAll.some((q) => q.kind === kind), 'selftest: train split missing kind ' + kind);
    assert.ok(valAll.some((q) => q.kind === kind), 'selftest: validation split missing kind ' + kind);
  }

  // A hermetic out dir UNDER .planning/.../out/ so assertUnderOut passes; cleaned up.
  const baseOut = path.join(REPO_ROOT, PHASE_OUT_DIR);
  fs.mkdirSync(baseOut, { recursive: true });
  const tmpOut = fs.mkdtempSync(path.join(baseOut, '.selftest-genqueries-'));

  try {
    // --- 2. bad-envelope fixture -> not_evaluated schema_fail, nothing written ---
    const badSpawn = () => ({ status: 0, stdout: JSON.stringify({ structured_output: { not: 'a valid family output' }, total_cost_usd: 0.01, session_id: 'sess-bad' }) });
    const badRes = generateQueriesForFamily({ family: 'plain:bad', skills: [{ skill: 'bad-one', description: 'x' }], config: {}, outDir: tmpOut, spawnImpl: badSpawn });
    assert.strictEqual(badRes.ok, false, 'selftest: bad-envelope family must not succeed');
    assert.strictEqual(badRes.unit.status, 'not_evaluated', 'selftest: bad-envelope must record not_evaluated');
    assert.strictEqual(badRes.unit.not_evaluated_reason, 'schema_fail', 'selftest: bad-envelope reason must be schema_fail');
    assert.strictEqual(badRes.written.length, 0, 'selftest: bad-envelope must write no queries files');
    assert.ok(!fs.existsSync(path.join(tmpOut, 'queries', 'bad-one.json')), 'selftest: bad-envelope must not leave a queries file');
    assert.ok(NOT_EVALUATED_REASONS.includes(badRes.unit.not_evaluated_reason), 'selftest: reason must be in the closed vocabulary');

    // --- 3. good-envelope fixture -> per-skill files WITH split fields ---
    const goodOutput = {
      sets: [
        {
          skill: 'find-connections', family: 'plain:find',
          queries: [
            { query: 'link these two ideas', expected_skill: 'find-connections', family: 'plain:find', kind: 'should_trigger' },
            { query: 'connect the dots between them', expected_skill: 'find-connections', family: 'plain:find', kind: 'should_trigger' },
            { query: 'what is this like in another field', expected_skill: 'find-analogies', family: 'plain:find', kind: 'should_not_trigger' },
            { query: 'summarize my notes', expected_skill: null, family: 'plain:find', kind: 'should_not_trigger' },
          ],
        },
      ],
    };
    const goodSpawn = () => ({ status: 0, stdout: JSON.stringify({ structured_output: goodOutput, total_cost_usd: 0.02, session_id: 'sess-good' }) });
    const goodRes = generateQueriesForFamily({ family: 'plain:find', skills: [{ skill: 'find-connections', description: 'find links' }], config: {}, outDir: tmpOut, spawnImpl: goodSpawn });
    assert.strictEqual(goodRes.ok, true, 'selftest: good-envelope family must succeed');
    assert.strictEqual(goodRes.unit.status, 'ok', 'selftest: good-envelope unit must be ok');
    assert.strictEqual(goodRes.written.length, 1, 'selftest: good-envelope must write one queries file');
    const wrote = JSON.parse(fs.readFileSync(goodRes.written[0], 'utf8'));
    assert.ok(EvalQuerySetSchema.safeParse(wrote).success, 'selftest: written set must pass EvalQuerySetSchema');
    for (const q of wrote.queries) {
      assert.ok(q.split === 'train' || q.split === 'validation', 'selftest: every written query must carry a split field');
    }
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  console.log('OK - skillopt-genqueries self-test passed: deterministic split, not_evaluated on bad envelope, per-skill files with splits.');
}

// --------------------------------------------------------------------------
// main - switch-case argv router (gsd-tools.cjs pattern), no Commander/yargs.
//   --selftest              deterministic fixtures, no spawn, exit
//   --dry-run               build + print arg vectors, spawn NOTHING
//   --families <csv>        limit to these families (default: all from inventory)
//   --out <dir>             out directory (default PHASE_OUT_DIR)
// --------------------------------------------------------------------------
function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--selftest')) { runSelftest(); return; }

  let outDir = path.join(REPO_ROOT, PHASE_OUT_DIR);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && args[outIdx + 1]) outDir = path.resolve(args[outIdx + 1]);

  let families = null;
  const famIdx = args.indexOf('--families');
  if (famIdx >= 0 && args[famIdx + 1]) families = args[famIdx + 1].split(',').map((s) => s.trim()).filter(Boolean);

  const dryRun = args.includes('--dry-run');

  // Group the inventory by family (best-effort: a dry-run for an unknown family
  // still emits its arg vector with an empty sibling list).
  let byFam = new Map();
  try { byFam = groupByFamily(loadInventory(outDir)); } catch (_e) { byFam = new Map(); }

  const targetFamilies = families || Array.from(byFam.keys());

  if (dryRun) {
    for (const fam of targetFamilies) {
      const skills = byFam.get(fam) || [];
      const { args: vec } = buildGenArgs(fam, skills, {});
      console.log('# dry-run genqueries family=' + fam + ' skills=' + skills.length);
      console.log(JSON.stringify(vec));
    }
    return;
  }

  // Live run: generate per family. (The full paid fleet run is Plan 07's opt-in.)
  const preflight = assertPinnedModelId(resolveGenConfig({}).model);
  if (!preflight.ok) { console.error('FATAL: model not pinned: ' + preflight.reason); process.exit(1); }

  let ok = 0; let notEval = 0;
  for (const fam of targetFamilies) {
    const skills = byFam.get(fam) || [];
    const r = generateQueriesForFamily({ family: fam, skills, config: {}, outDir });
    if (r.ok) ok += 1; else notEval += 1;
  }
  console.log('OK skillopt-genqueries: ' + ok + ' families generated, ' + notEval + ' not_evaluated -> ' + path.join(outDir, 'queries'));
}

module.exports = {
  generateQueriesForFamily,
  splitQueries,
  buildGenArgs,
  buildFamilyVariable,
  parseEnvelope,
  classifySpawn,
  seedForSkill,
  groupByFamily,
  FamilyOutputSchema,
  PINNED_SONNET,
};

if (require.main === module) {
  main(process.argv);
}
