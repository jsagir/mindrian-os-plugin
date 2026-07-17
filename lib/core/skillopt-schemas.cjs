/**
 * MindrianOS Plugin - Skill Fleet Optimization Contracts (Phase 230)
 *
 * The single zod source of truth for EVERY structured verdict and on-disk
 * artifact shape in the Phase 230 skill-fleet-optimization pipeline. This module
 * is interface-first: Wave 2 plans (02 genqueries+funnel, 03 triggerloop, 04
 * codereview) build against these contracts instead of inventing their own. If a
 * downstream script needs a verdict or artifact shape, it requires THIS file - it
 * never hand-rolls a second copy.
 *
 * Discipline ported verbatim from lib/core/pitch-feedback-schemas.cjs (Phase 229
 * HUJI pilot), the exact analog:
 *   - zod/v4 subpath (NEVER bare 'zod'): gives z.toJSONSchema so the CLI
 *     --json-schema argument serializes straight from this one source.
 *   - Every free-text field is bounded with .max(): token budget IS a contract,
 *     not a hope. A verdict that wants 4,000 tokens for a one-line decision is a
 *     failure, not a feature (AI-SPEC 4b).
 *   - Enum-forced verdicts: confidence low/medium NEVER passes (it flags, failing
 *     open toward scrutiny, CONTEXT.md Rigor decision); a refuted code finding is
 *     DROPPED, never silently downgraded.
 *   - Dual consumption (belt + suspenders): inlineSchemaJson() feeds the CLI
 *     --json-schema (self-correction), Schema.safeParse() re-checks in the
 *     orchestrator (catches CLI-version regressions + envelope corruption).
 *
 * Two guards travel with the contracts because every pipeline script needs them:
 *   - assertUnderOut(): the D6/CFM4 write-path containment guard. Every generated
 *     byte must resolve INSIDE .planning/.../out/ - fail closed otherwise. This is
 *     assertOutsideRepo from huji-batch inverted (writes land INSIDE the sandbox).
 *   - assertPinnedModelId(): reject bare aliases before spending (fairness /
 *     provenance), copied from huji-batch.
 *
 * NOT_EVALUATED_REASONS is the closed vocabulary for the no-silent-skip discipline
 * (D5 / Critical Failure Mode 3): a killed, timed-out, or errored unit is recorded
 * with one of these reasons, NEVER absorbed as a pass or no-finding.
 *
 * CJS only, no npm dependency beyond the already-pinned zod. No em-dashes.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { z } = require('zod/v4'); // NOT bare 'zod': the v4 subpath gives z.toJSONSchema

// --------------------------------------------------------------------------
// Shared vocabulary + constants.
// --------------------------------------------------------------------------

// The closed set of reasons a unit can be recorded as not_evaluated (D5 / CFM3).
// Frozen so no call site can invent a fourth disposition that hides a silent skip.
const NOT_EVALUATED_REASONS = Object.freeze([
  'spawn_failed',      // spawnSync res.error - the process never started
  'nonzero_exit',      // claude exited non-zero
  'timeout',           // per-unit timeout tripped
  'schema_fail',       // structured_output failed safeParse after one retry
  'empty_envelope',    // stdout unparseable / no structured_output and no result
  'budget_exceeded',   // --max-budget-usd fuse tripped, partial result never banked
  'fabricated_evidence', // WS2: evidence_quote is not a verbatim substring of the file
  'induced_probe',     // the deliberately-induced not-evaluated smoke probe (D5 test)
]);

// The single canonical out root every Phase 230 script defaults to. Relative on
// purpose (resolved against CWD at call time), so the whole pipeline writes under
// one sandbox and assertUnderOut can prove containment.
const PHASE_OUT_DIR = path.join(
  '.planning',
  'phases',
  '230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur',
  'out'
);

// --------------------------------------------------------------------------
// Workstream 1 - trigger accuracy contracts.
// --------------------------------------------------------------------------

/**
 * JudgeVerdictSchema - WS1.3-4 funnel verdict. One roster-wide judgment: which
 * ONE skill would fire for a query under progressive disclosure, and how sure.
 * confidence 'low'/'medium' does NOT pass - it flags the skill for the full
 * trigger-test loop (fail open toward scrutiny, CONTEXT.md Rigor decision).
 */
const JudgeVerdictSchema = z.object({
  query: z.string().min(1),
  predicted_skill: z.string().nullable(), // the skill the roster would fire, or null for none
  expected_skill: z.string().nullable(),  // the label from eval_queries.json, or null
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().max(600),         // bounded: a routing decision is not an essay
});

/**
 * ReviewFindingSchema - WS2 pass-1 output, BEFORE the adversarial verdict exists.
 * A raw candidate finding: what the reviewer claims and the verbatim line it
 * points at. No verdict field yet - that is added by CodeFindingSchema after the
 * refute-or-promote pass.
 */
const ReviewFindingSchema = z.object({
  skill: z.string().min(1),
  file: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  claim: z.string().max(800),
  evidence_quote: z.string().max(800), // verbatim from the .cjs - the anti-fabrication anchor (D4)
});

/**
 * CodeFindingSchema - WS2 pass-2 output. ReviewFindingSchema PLUS the adversarial
 * verdict. 'refuted' is DROPPED from the report, never silently downgraded to a
 * lower severity (the systematic-overcorrection guard, D4 / CFM2). Only
 * confirmed/plausible survivors are ever reported.
 */
const CodeFindingSchema = ReviewFindingSchema.extend({
  verdict: z.enum(['confirmed', 'plausible', 'refuted']),
  refutation_attempt: z.string().max(800), // what the second pass tried and why it failed to refute
});

/**
 * TriggerResultSchema - WS1.5 per-query real-invocation observation. One row per
 * (skill, query, iteration): how many of the runs actually fired the Skill tool,
 * observed via stream-json --verbose (never the json envelope, which has no
 * reliable tool trace - AI-SPEC Pitfall 1).
 */
const TriggerResultSchema = z.object({
  skill: z.string().min(1),
  query: z.string().min(1),
  split: z.enum(['train', 'validation']),
  iteration: z.number().int().min(0),
  runs: z.number().int().min(0),  // typically 3
  fires: z.number().int().min(0),
  trigger_rate: z.number().min(0).max(1),
});

/**
 * LoopSummarySchema - WS1.5 per-flagged-skill loop outcome. best_iteration is
 * chosen BY validation pass-rate (selected_by is a literal, so the selector can
 * never drift to "last iteration"). regressed_query_count MUST be 0 for a diff to
 * be proposed - the do-no-harm hard gate (D3 / CFM1).
 */
const LoopSummarySchema = z.object({
  skill: z.string().min(1),
  iterations_run: z.number().int().min(0).max(5),
  best_iteration: z.number().int().min(0),
  selected_by: z.literal('validation_pass_rate'),
  baseline_validation_rate: z.number().min(0).max(1),
  best_validation_rate: z.number().min(0).max(1),
  regressed_query_count: z.number().int().min(0), // MUST be 0 to propose a diff (D3/CFM1)
  converged: z.boolean(),
  proposed_description: z.string().max(1024).nullable(),
});

/**
 * DescriptionRevisionSchema - WS1.5 revision-subagent output for one loop
 * iteration: the rewritten description and why.
 */
const DescriptionRevisionSchema = z.object({
  skill: z.string().min(1),
  iteration: z.number().int().min(0),
  description: z.string().max(1024),
  rationale: z.string().max(400),
});

/**
 * EvalQuerySchema - WS1.2 one generated eval query. expected_skill null means no
 * skill should fire (a should_not_trigger negative). kind pins whether this query
 * is a positive (should_trigger) or a near-miss negative (should_not_trigger).
 */
const EvalQuerySchema = z.object({
  query: z.string().min(1),
  expected_skill: z.string().nullable(), // null == no skill should fire
  family: z.string().min(1),
  split: z.enum(['train', 'validation']),
  kind: z.enum(['should_trigger', 'should_not_trigger']),
});

/**
 * EvalQuerySetSchema - WS1.2 the per-skill query set. min 4 queries so a skill
 * always carries enough signal to split train/validation and cover both kinds.
 */
const EvalQuerySetSchema = z.object({
  skill: z.string().min(1),
  family: z.string().min(1),
  queries: z.array(EvalQuerySchema).min(4),
});

// --------------------------------------------------------------------------
// Inventory + trace contracts (WS1.1 + cross-workstream).
// --------------------------------------------------------------------------

/**
 * InventoryRecordSchema - WS1.1 one row per skill. backed marks the WS2 subset
 * (the skill body references real scripts/*.cjs, bin/*.cjs, or Workflow(
 * machinery); backing_refs are the unique matched strings). description is the
 * exact bytes progressive disclosure shows the model, bounded generously (2048)
 * because a real skill description can be a full folded paragraph.
 */
const InventoryRecordSchema = z.object({
  skill: z.string().min(1),
  dir: z.string().min(1),
  description: z.string().max(2048),
  family: z.string().min(1),
  backed: z.boolean(),
  backing_refs: z.array(z.string()),
  body_lines: z.number().int().min(0),
});

/**
 * UnitRecordSchema - the per-spawn trace record (AI-SPEC Section 7). One JSON row
 * per spawned subagent. status 'not_evaluated' MUST carry a not_evaluated_reason
 * from the closed vocabulary - this is the coded form of no-silent-skip (D5). A
 * unit that errored, timed out, or failed schema is recorded here honestly, never
 * counted as a pass.
 */
const UnitRecordSchema = z.object({
  unit_id: z.string().min(1),
  kind: z.enum(['genqueries', 'funnel', 'trigger', 'revise', 'review', 'refute']),
  model: z.string().min(1),
  session_id: z.string().nullable(),
  total_cost_usd: z.number().nullable(),
  exit: z.number().int().nullable(),
  status: z.enum(['ok', 'not_evaluated']),
  not_evaluated_reason: z.enum(NOT_EVALUATED_REASONS).nullable(),
  error_issues: z.array(z.unknown()).nullable(),
  payload: z.unknown().nullable(),
});

/**
 * SmokeLabelSchema - the hand-labeled smoke calibration row (AI-SPEC Section 5).
 * Jonathan pre-labels a handful of known skills with their expected funnel/WS2
 * outcomes BEFORE the full spend, so the judge and the detectors are calibrated
 * against manual expectation, not trusted blind (D7).
 */
const SmokeLabelSchema = z.object({
  skill: z.string().min(1),
  role: z.enum([
    'clear_fire',
    'near_miss_pair',
    'weak_description',
    'good_description',
    'ws2_defect',
    'ws2_clean',
    'not_evaluated_probe',
  ]),
  expected_funnel: z.enum(['pass', 'flagged', 'not_evaluated']).nullable(),
  expected_ws2: z.enum(['finding_expected', 'no_finding_expected']).nullable(),
  notes: z.string().max(500),
});

// --------------------------------------------------------------------------
// The schema registry (drives toJsonSchemas + the selftest sweep).
// --------------------------------------------------------------------------
const SCHEMAS = Object.freeze({
  JudgeVerdictSchema,
  ReviewFindingSchema,
  CodeFindingSchema,
  TriggerResultSchema,
  LoopSummarySchema,
  DescriptionRevisionSchema,
  EvalQuerySchema,
  EvalQuerySetSchema,
  InventoryRecordSchema,
  UnitRecordSchema,
  SmokeLabelSchema,
});

// --------------------------------------------------------------------------
// inlineSchemaJson(schema) - THE single inlining chokepoint for every spawn call
// site in the phase. Takes a zod schema, returns a compact INLINE JSON string for
// the CLI --json-schema arg.
//
// DI-1: CLI 2.1.211 wants the schema object INLINE, never a file path (a path
// makes it JSON-parse the leading '/' and die "Unrecognized token '/'").
// DI-2: zod v4 stamps "$schema":"https://json-schema.org/draft/2020-12/schema";
// CLI 2.1.211 cannot resolve that meta-ref and rejects the whole schema. Every
// contract here uses ONLY draft-07-compatible keywords, so dropping $schema lets
// the CLI validate against its built-in default with identical semantics.
// --------------------------------------------------------------------------
function inlineSchemaJson(schema) {
  const obj = z.toJSONSchema(schema);
  if (obj && typeof obj === 'object') delete obj.$schema;
  return JSON.stringify(obj);
}

// Kebab-case a schema export name into a filename stem: JudgeVerdictSchema ->
// judge-verdict.
function schemaFileStem(exportName) {
  return exportName
    .replace(/Schema$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

// --------------------------------------------------------------------------
// toJsonSchemas(outDir) - emit one .json file per schema from the ONE zod source,
// $schema stripped, so a CLI --json-schema arg read off disk never drifts from the
// orchestrator's safeParse. Mirrors pitch-feedback-schemas.toJsonSchemas.
// --------------------------------------------------------------------------
function toJsonSchemas(outDir) {
  if (typeof z.toJSONSchema !== 'function') {
    throw new Error('require("zod/v4").z.toJSONSchema is not a function - cannot emit JSON Schema');
  }
  fs.mkdirSync(outDir, { recursive: true });
  const written = {};
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const obj = z.toJSONSchema(schema);
    if (obj && typeof obj === 'object') delete obj.$schema; // DI-2 (see inlineSchemaJson)
    const fp = path.join(outDir, schemaFileStem(name) + '.schema.json');
    fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    written[name] = fp;
  }
  return written;
}

// --------------------------------------------------------------------------
// assertUnderOut(targetPath, outRoot) - the D6/CFM4 write-path containment guard.
// Adapted from huji-batch assertOutsideRepo, INVERTED: a pipeline write must land
// INSIDE the phase out sandbox, and that sandbox must itself be under a .planning
// tree. Fail closed on anything else. Nothing pipeline-generated may land under
// skills/ or scripts/.
// --------------------------------------------------------------------------
function assertUnderOut(targetPath, outRoot) {
  if (typeof targetPath !== 'string' || targetPath.length === 0) {
    return { ok: false, reason: 'outside_out' };
  }
  if (typeof outRoot !== 'string' || outRoot.length === 0) {
    return { ok: false, reason: 'outside_out' };
  }
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(outRoot);
  const insideOut = resolvedTarget.startsWith(resolvedRoot + path.sep);
  const rootedInPlanning = resolvedRoot.includes(path.sep + '.planning' + path.sep);
  if (insideOut && rootedInPlanning) {
    return { ok: true, target: resolvedTarget, outRoot: resolvedRoot };
  }
  return { ok: false, reason: 'outside_out', target: resolvedTarget, outRoot: resolvedRoot };
}

// --------------------------------------------------------------------------
// assertPinnedModelId(model) - reject a bare alias (opus/sonnet/haiku) before any
// spend. Provenance/fairness: the full ID pattern is claude-<family>-<digit...>.
// Copied from huji-batch assertPinnedModelId.
// --------------------------------------------------------------------------
function assertPinnedModelId(model) {
  const BARE_ALIASES = ['opus', 'sonnet', 'haiku', 'opusplan', 'default', 'inherit'];
  if (!model || typeof model !== 'string') return { ok: false, reason: 'model_missing' };
  if (BARE_ALIASES.includes(model.toLowerCase())) return { ok: false, reason: 'bare_alias', model };
  if (!/^claude-[a-z]+-[0-9]/.test(model)) return { ok: false, reason: 'not_full_model_id', model };
  return { ok: true, model };
}

module.exports = {
  // WS1 trigger-accuracy contracts
  JudgeVerdictSchema,
  ReviewFindingSchema,
  CodeFindingSchema,
  TriggerResultSchema,
  LoopSummarySchema,
  DescriptionRevisionSchema,
  EvalQuerySchema,
  EvalQuerySetSchema,
  // inventory + trace contracts
  InventoryRecordSchema,
  UnitRecordSchema,
  SmokeLabelSchema,
  // vocabulary + constants
  NOT_EVALUATED_REASONS,
  PHASE_OUT_DIR,
  // helpers + guards
  inlineSchemaJson,
  toJsonSchemas,
  assertUnderOut,
  assertPinnedModelId,
};

// --------------------------------------------------------------------------
// Deterministic self-test (no model calls, zero API spend).
// Run: node lib/core/skillopt-schemas.cjs
// For EVERY schema: one valid fixture that parses + one reject fixture that fails.
// Then the guard + inlining assertions. Exit 1 naming the first failing fixture.
// --------------------------------------------------------------------------
if (require.main === module) {
  const assert = require('node:assert');
  const fail = (name, msg) => {
    console.error('FAIL [' + name + ']: ' + msg);
    process.exit(1);
  };

  // Each entry: [schema, validFixture, rejectFixture, rejectWhy].
  const cases = {
    JudgeVerdictSchema: [
      JudgeVerdictSchema,
      { query: 'find links between ideas', predicted_skill: 'find-connections', expected_skill: 'find-connections', confidence: 'high', reasoning: 'clear match' },
      { query: 'q', predicted_skill: null, expected_skill: null, confidence: 'certain', reasoning: 'bad enum' },
      "confidence 'certain' must reject",
    ],
    ReviewFindingSchema: [
      ReviewFindingSchema,
      { skill: 'doctor', file: 'scripts/doctor.cjs', severity: 'high', claim: 'unreachable branch', evidence_quote: 'if (false) {' },
      { skill: 'doctor', file: 'scripts/doctor.cjs', severity: 'catastrophic', claim: 'x', evidence_quote: 'y' },
      "severity 'catastrophic' must reject",
    ],
    CodeFindingSchema: [
      CodeFindingSchema,
      { skill: 'doctor', file: 'scripts/doctor.cjs', severity: 'high', claim: 'unreachable branch', evidence_quote: 'if (false) {', verdict: 'confirmed', refutation_attempt: 'tried to reach it, cannot' },
      { skill: 'doctor', file: 'scripts/doctor.cjs', severity: 'high', claim: 'x', verdict: 'confirmed', refutation_attempt: 'r' },
      'missing evidence_quote must reject',
    ],
    TriggerResultSchema: [
      TriggerResultSchema,
      { skill: 'find-connections', query: 'q', split: 'train', iteration: 0, runs: 3, fires: 2, trigger_rate: 0.6667 },
      { skill: 'find-connections', query: 'q', split: 'train', iteration: 0, runs: 3, fires: 2, trigger_rate: 1.5 },
      'trigger_rate 1.5 (>1) must reject',
    ],
    LoopSummarySchema: [
      LoopSummarySchema,
      { skill: 'find-connections', iterations_run: 3, best_iteration: 2, selected_by: 'validation_pass_rate', baseline_validation_rate: 0.5, best_validation_rate: 0.8, regressed_query_count: 0, converged: true, proposed_description: 'better' },
      { skill: 'find-connections', iterations_run: 6, best_iteration: 2, selected_by: 'validation_pass_rate', baseline_validation_rate: 0.5, best_validation_rate: 0.8, regressed_query_count: 0, converged: true, proposed_description: null },
      'iterations_run 6 (>5) must reject',
    ],
    DescriptionRevisionSchema: [
      DescriptionRevisionSchema,
      { skill: 'find-connections', iteration: 1, description: 'new desc', rationale: 'clearer trigger' },
      { skill: 'find-connections', iteration: 1, description: 'new desc' },
      'missing rationale must reject',
    ],
    EvalQuerySchema: [
      EvalQuerySchema,
      { query: 'link two ideas', expected_skill: 'find-connections', family: 'plain:find', split: 'train', kind: 'should_trigger' },
      { query: 'link two ideas', expected_skill: 'find-connections', family: 'plain:find', split: 'train', kind: 'maybe' },
      "kind 'maybe' must reject",
    ],
    EvalQuerySetSchema: [
      EvalQuerySetSchema,
      {
        skill: 'find-connections',
        family: 'plain:find',
        queries: [
          { query: 'a', expected_skill: 'find-connections', family: 'plain:find', split: 'train', kind: 'should_trigger' },
          { query: 'b', expected_skill: 'find-connections', family: 'plain:find', split: 'train', kind: 'should_trigger' },
          { query: 'c', expected_skill: 'find-analogies', family: 'plain:find', split: 'validation', kind: 'should_not_trigger' },
          { query: 'd', expected_skill: null, family: 'plain:find', split: 'validation', kind: 'should_not_trigger' },
        ],
      },
      { skill: 'find-connections', family: 'plain:find', queries: [] },
      'fewer than 4 queries must reject',
    ],
    InventoryRecordSchema: [
      InventoryRecordSchema,
      { skill: 'doctor', dir: 'doctor', description: 'run diagnostics', family: 'plain:doctor', backed: true, backing_refs: ['scripts/doctor.cjs'], body_lines: 42 },
      { skill: 'doctor', dir: 'doctor', description: 'run diagnostics', family: 'plain:doctor', backed: true, backing_refs: ['scripts/doctor.cjs'], body_lines: -1 },
      'body_lines -1 must reject',
    ],
    UnitRecordSchema: [
      UnitRecordSchema,
      { unit_id: 'funnel-0001', kind: 'funnel', model: 'claude-sonnet-5', session_id: null, total_cost_usd: null, exit: null, status: 'not_evaluated', not_evaluated_reason: 'timeout', error_issues: null, payload: null },
      { unit_id: 'funnel-0001', kind: 'funnel', model: 'claude-sonnet-5', session_id: null, total_cost_usd: null, exit: null, status: 'not_evaluated', not_evaluated_reason: 'gremlins', error_issues: null, payload: null },
      "not_evaluated_reason 'gremlins' (outside vocabulary) must reject",
    ],
    SmokeLabelSchema: [
      SmokeLabelSchema,
      { skill: 'find-connections', role: 'near_miss_pair', expected_funnel: 'flagged', expected_ws2: null, notes: 'sibling collision candidate' },
      { skill: 'find-connections', role: 'wildcard', expected_funnel: 'flagged', expected_ws2: null, notes: 'bad role' },
      "role 'wildcard' must reject",
    ],
  };

  for (const [name, [schema, valid, reject, why]] of Object.entries(cases)) {
    const okRes = schema.safeParse(valid);
    if (!okRes.success) {
      fail(name, 'valid fixture should parse but failed: ' + JSON.stringify(okRes.error.issues));
    }
    const badRes = schema.safeParse(reject);
    if (badRes.success) {
      fail(name, 'reject fixture should fail (' + why + ') but parsed');
    }
  }

  // inlineSchemaJson strips $schema (DI-2) for every schema.
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const inlined = inlineSchemaJson(schema);
    if (inlined.includes('$schema')) {
      fail(name, 'inlineSchemaJson output still contains "$schema"');
    }
  }

  // assertUnderOut: rejects a target under skills/, accepts a target under PHASE_OUT_DIR.
  const outside = assertUnderOut('skills/act/SKILL.md', PHASE_OUT_DIR);
  assert.strictEqual(outside.ok, false, 'assertUnderOut must reject a target under skills/');
  const inside = assertUnderOut(path.join(PHASE_OUT_DIR, 'inventory.json'), PHASE_OUT_DIR);
  assert.strictEqual(inside.ok, true, 'assertUnderOut must accept a target under PHASE_OUT_DIR');

  // assertPinnedModelId: rejects a bare alias, accepts a full pinned id.
  assert.strictEqual(assertPinnedModelId('opus').ok, false, "assertPinnedModelId must reject 'opus'");
  assert.strictEqual(assertPinnedModelId('claude-opus-4-8').ok, true, "assertPinnedModelId must accept 'claude-opus-4-8'");

  // toJsonSchemas emits parseable files (into a temp dir, hermetic - no repo pollution).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillopt-schemas-selftest-'));
  const written = toJsonSchemas(tmpDir);
  for (const [name, fp] of Object.entries(written)) {
    const raw = fs.readFileSync(fp, 'utf8');
    JSON.parse(raw); // must parse cleanly
    if (raw.includes('$schema')) fail(name, 'emitted schema file still contains "$schema"');
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(
    'OK - skillopt-schemas self-test passed: ' +
      Object.keys(cases).length +
      ' schemas (valid + reject each), inlining chokepoint clean, guards enforced.'
  );
}
