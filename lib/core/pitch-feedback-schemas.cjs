/**
 * MindrianOS Plugin - Pitch Feedback Contracts (Phase 229, HUJI pilot)
 *
 * The single zod source of truth for the two contracts that anchor the whole
 * PWS_grading pipeline:
 *
 *   EvidenceSchema        - Stage A extraction output. The ONLY thing the grading
 *                           spine ever sees (anti-hallucination anchor, D1). Every
 *                           claim carries its verbatim transcript quote; the
 *                           `evidenced` enum forces evidence-vs-assertion labelling
 *                           (sample 1's "smart light sensor" = 'asserted').
 *   FeedbackResultSchema  - Stage B result envelope. Encodes the Minto delivery
 *                           shape (D5): a governing thought first, then 2-3 MECE
 *                           branches, each ending in ONE teachable next step
 *                           (Canon Part 12: formative, teachable order).
 *
 * Both are consumed twice, deliberately (belt + suspenders, AI-SPEC 4b):
 *   1. CLI layer      - serialized to JSON Schema via toJsonSchemas() and passed
 *                       as `--json-schema`; Claude Code self-corrects to conform.
 *   2. Orchestrator   - Schema.safeParse(structured_output) in the batch loop,
 *                       catching CLI-version regressions and envelope corruption.
 *
 * Free-text fields are bounded with .max() so feedback LENGTH is a contract, not a
 * hope (AI-SPEC 4b token-bounds: a 4,000-word pyramid is a pedagogical failure for
 * a 2-minute pitch). Threat T-229-01-01: a schema that accepts anything cannot
 * catch fabrication downstream.
 *
 * zod note: schemas are defined with `require('zod/v4')` (the new core shipped
 * inside zod 3.25.x) so that `z.toJSONSchema` serializes them directly from this
 * one source - no hand-written JSON Schema literal (RESEARCH verified the v4
 * subpath resolves as a function under CJS on this machine).
 *
 * CJS only, no npm dependency beyond the already-vendored zod. No em-dashes.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod/v4');

// --------------------------------------------------------------------------
// Field bounds (free-text length is a contract, not a hope - AI-SPEC 4b).
// --------------------------------------------------------------------------
const MAX_GOVERNING_THOUGHT = 600;
const MAX_BRANCH_POINT = 500;
const MAX_TEACHABLE_STEP = 600;
const MAX_SUPPORT_ITEM = 600;
const MIN_GOVERNING_THOUGHT = 20;

// A diarized timestamp is "M:SS" / "MM:SS" (e.g. "1:10"). Anything else (a bare
// "70 seconds", prose) is rejected so the anchor stays machine-checkable.
const TIMESTAMP_RE = /^\d+:\d{2}$/;

/**
 * EvidenceSchema - Stage A extraction contract (evidence in).
 * Ported verbatim from AI-SPEC Section 4b, extended with the calibration-source
 * field it does NOT carry (that belongs to the result, not the evidence).
 */
const EvidenceSchema = z.object({
  submission_id: z.string().min(1),
  problem_claim: z.object({
    stated: z.boolean(),
    quote: z.string(), // verbatim from transcript - the anti-hallucination anchor (D1)
    timestamp: z.string().regex(TIMESTAMP_RE).nullable(),
  }),
  value_proposition: z.object({
    stated: z.boolean(),
    quote: z.string(),
  }),
  evidence_claims: z.array(
    z.object({
      claim: z.string(),
      quote: z.string(), // every claim carries its transcript quote
      // sample 1's "smart light sensor" = 'asserted'; a covered risk = 'evidenced';
      // a claimed-but-absent element = 'absent'. Enum-constrained so the spine
      // cannot invent a fourth disposition (T-229-01-01).
      evidenced: z.enum(['evidenced', 'asserted', 'absent']),
    })
  ),
  // sample 2 names its own gaps ("deeper market research, competitor analysis,
  // user testing") - captured here so feedback REWARDS metacognition and never
  // double-punishes a self-identified gap (AI-SPEC D6, CONTEXT eval note).
  self_identified_gaps: z.array(z.string()),
  speaker_count: z.number().int().positive(),
  // non-native English + machine transcript: disfluencies and diarization noise
  // are language notes, never content weaknesses (AI-SPEC D6, language-gentle).
  language_notes: z.string(),
});

/**
 * FeedbackResultSchema - Stage B result envelope (feedback out).
 * The Minto delivery contract: governing thought first, 2-3 MECE branches, each a
 * point + support(>=1) + ONE teachable next step. Free-text bounded so the pyramid
 * stays proportionate to a 2-minute pitch.
 */
const FeedbackResultSchema = z.object({
  submission_id: z.string().min(1),
  // Minto: the pyramid top, stated first. Min 20 chars rejects a one-word verdict;
  // max bound keeps it a thesis sentence, not an essay.
  governing_thought: z.string().min(MIN_GOVERNING_THOUGHT).max(MAX_GOVERNING_THOUGHT),
  branches: z
    .array(
      z.object({
        point: z.string().min(1).max(MAX_BRANCH_POINT),
        support: z.array(z.string().max(MAX_SUPPORT_ITEM)).min(1),
        // Canon Part 12: every branch ends in ONE concrete, course-level next step
        // (feed-forward). Formative, not summative.
        teachable_next_step: z.string().min(1).max(MAX_TEACHABLE_STEP),
      })
    )
    .min(2) // 2-3 branches at the student's level (navigator ruling); MECE, not a
    .max(3), // laundry list. 1 branch is not a pyramid; 4 overwhelms a 2-min pitch.
  // per-dimension rubric-tiered scores, bounded 0-100.
  scores: z.record(z.string(), z.number().min(0).max(100)),
  // provenance: which pinned model graded this student (fairness, D3).
  model_id: z.string().min(1),
  // Brain posture audit (AI-SPEC 4 Brain posture): 'local-anchors' = Tier 0 (Brain
  // unreachable, local calibration corpus only); 'brain+local-anchors' = read-only
  // generic-handle enrichment succeeded. Makes cohort consistency auditable.
  calibration_source: z.enum(['local-anchors', 'brain+local-anchors']),
});

/**
 * toJsonSchemas(outDir) - emit both contracts as JSON Schema files from the ONE
 * zod source, so the CLI `--json-schema` argument never drifts from the
 * orchestrator's safeParse. Writes evidence.schema.json + feedback-result.schema.json
 * into outDir and returns the two paths.
 *
 * Uses `require('zod/v4').z.toJSONSchema` (verified to resolve under CJS). No
 * hand-written JSON Schema literal.
 */
function toJsonSchemas(outDir) {
  const zv4 = require('zod/v4');
  if (typeof zv4.z.toJSONSchema !== 'function') {
    throw new Error('require("zod/v4").z.toJSONSchema is not a function - cannot emit JSON Schema');
  }
  fs.mkdirSync(outDir, { recursive: true });

  const evidencePath = path.join(outDir, 'evidence.schema.json');
  const feedbackPath = path.join(outDir, 'feedback-result.schema.json');

  const evidenceJson = zv4.z.toJSONSchema(EvidenceSchema);
  const feedbackJson = zv4.z.toJSONSchema(FeedbackResultSchema);

  // DI-2: zod v4 emits `"$schema":"https://json-schema.org/draft/2020-12/schema"`,
  // but the `claude` CLI 2.1.211 `--json-schema` validator does not resolve that
  // meta-schema ref and rejects the whole schema ("no schema with key or ref
  // .../draft/2020-12/schema"). These contracts use ONLY draft-07-compatible
  // keywords (no $defs / prefixItems / unevaluated* / if-then-else), so dropping
  // the `$schema` declaration lets the CLI validate against its built-in default
  // with IDENTICAL semantics. This is a self-contained internal contract, not
  // consumed by any external system expecting a specific draft (navigator ruling).
  if (evidenceJson && typeof evidenceJson === 'object') delete evidenceJson.$schema;
  if (feedbackJson && typeof feedbackJson === 'object') delete feedbackJson.$schema;

  fs.writeFileSync(evidencePath, JSON.stringify(evidenceJson, null, 2) + '\n', 'utf8');
  fs.writeFileSync(feedbackPath, JSON.stringify(feedbackJson, null, 2) + '\n', 'utf8');

  return { evidencePath, feedbackPath };
}

/**
 * inlineSchemaJson(schemaPath) - read an on-disk JSON Schema file and return it as
 * a compact INLINE JSON string suitable for the `claude` CLI `--json-schema` arg.
 *
 * DI-1: CLI 2.1.211 expects the schema object INLINE (`{"type":"object",...}`), not a
 * file path - passing a path makes it JSON-parse the leading `/` and fail
 * ("Unrecognized token '/'"). DI-2 (defence-in-depth): the `$schema` meta-ref is
 * stripped here too, so even a hand-authored schema file (eval/judge-schema.json,
 * draft-07) inlines clean regardless of what draft it declares on disk. The single
 * inlining chokepoint for all three call sites (Stage A, Stage B, the judge).
 */
function inlineSchemaJson(schemaPath) {
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const obj = JSON.parse(raw);
  if (obj && typeof obj === 'object') delete obj.$schema;
  return JSON.stringify(obj);
}

module.exports = {
  EvidenceSchema,
  FeedbackResultSchema,
  toJsonSchemas,
  inlineSchemaJson,
  // bounds exported so downstream prompts/tests reference the same numbers.
  BOUNDS: Object.freeze({
    MAX_GOVERNING_THOUGHT,
    MIN_GOVERNING_THOUGHT,
    MAX_BRANCH_POINT,
    MAX_TEACHABLE_STEP,
    MAX_SUPPORT_ITEM,
    TIMESTAMP_RE,
  }),
};

// --------------------------------------------------------------------------
// Deterministic self-test (no model calls). Run: node lib/core/pitch-feedback-schemas.cjs
// Asserts the behaviors the plan pins, then regenerates the JSON Schema files.
// --------------------------------------------------------------------------
if (require.main === module) {
  const assert = require('assert');

  // A fully-valid evidence object (grounds every positive assertion below).
  const validEvidence = {
    submission_id: 'safescan-001',
    problem_claim: {
      stated: true,
      quote: 'Food allergies are a big problem around the world.',
      timestamp: '0:10',
    },
    value_proposition: {
      stated: true,
      quote: 'a tiny device that tests your food right at the table',
    },
    evidence_claims: [
      { claim: 'uses a smart light sensor', quote: 'The science inside uses smart light sensor.', evidenced: 'asserted' },
    ],
    self_identified_gaps: ['expanding market analysis', 'studying FDA compliance'],
    speaker_count: 1,
    language_notes: 'Non-native English; minor disfluencies. Not content weaknesses.',
  };

  // --- EvidenceSchema behaviors ---
  assert.strictEqual(EvidenceSchema.safeParse(validEvidence).success, true, 'valid evidence should parse');
  assert.strictEqual(EvidenceSchema.safeParse({}).success, false, 'evidence missing evidence_claims must reject');

  // evidenced enum only in {evidenced,asserted,absent}; 'maybe' rejected
  const badEnum = JSON.parse(JSON.stringify(validEvidence));
  badEnum.evidence_claims[0].evidenced = 'maybe';
  assert.strictEqual(EvidenceSchema.safeParse(badEnum).success, false, "evidenced 'maybe' must reject");

  // timestamp accepts "1:10" and null; rejects "70 seconds"
  const tsOk = JSON.parse(JSON.stringify(validEvidence));
  tsOk.problem_claim.timestamp = '1:10';
  assert.strictEqual(EvidenceSchema.safeParse(tsOk).success, true, 'timestamp "1:10" should parse');
  const tsNull = JSON.parse(JSON.stringify(validEvidence));
  tsNull.problem_claim.timestamp = null;
  assert.strictEqual(EvidenceSchema.safeParse(tsNull).success, true, 'timestamp null should parse');
  const tsBad = JSON.parse(JSON.stringify(validEvidence));
  tsBad.problem_claim.timestamp = '70 seconds';
  assert.strictEqual(EvidenceSchema.safeParse(tsBad).success, false, 'timestamp "70 seconds" must reject');

  // --- FeedbackResultSchema behaviors ---
  const mkBranch = (n) => ({ point: 'point ' + n, support: ['support ' + n], teachable_next_step: 'step ' + n });
  const mkFeedback = (branchCount) => ({
    submission_id: 'safescan-001',
    governing_thought: 'A'.repeat(25),
    branches: Array.from({ length: branchCount }, (_, i) => mkBranch(i + 1)),
    scores: { grounding: 80, structure: 72 },
    model_id: 'claude-opus-4-8',
    calibration_source: 'local-anchors',
  });

  assert.strictEqual(FeedbackResultSchema.safeParse(mkFeedback(2)).success, true, '2 branches should parse');
  assert.strictEqual(FeedbackResultSchema.safeParse(mkFeedback(3)).success, true, '3 branches should parse');
  assert.strictEqual(FeedbackResultSchema.safeParse(mkFeedback(1)).success, false, '1 branch must reject');
  assert.strictEqual(FeedbackResultSchema.safeParse(mkFeedback(4)).success, false, '4 branches must reject');

  // governing_thought under 20 chars rejected
  const shortGt = mkFeedback(2);
  shortGt.governing_thought = 'too short';
  assert.strictEqual(FeedbackResultSchema.safeParse(shortGt).success, false, 'short governing_thought must reject');

  // each branch requires point + support(>=1) + teachable_next_step
  const noSupport = mkFeedback(2);
  noSupport.branches[0].support = [];
  assert.strictEqual(FeedbackResultSchema.safeParse(noSupport).success, false, 'empty support must reject');
  const noStep = mkFeedback(2);
  delete noStep.branches[0].teachable_next_step;
  assert.strictEqual(FeedbackResultSchema.safeParse(noStep).success, false, 'missing teachable_next_step must reject');

  // calibration_source enum honored
  const badCal = mkFeedback(2);
  badCal.calibration_source = 'brain-only';
  assert.strictEqual(FeedbackResultSchema.safeParse(badCal).success, false, "calibration_source 'brain-only' must reject");

  // --- toJsonSchemas emits parseable files containing the anchor keys ---
  const outDir = path.join(__dirname, '..', '..', '.planning', 'phases', '229-huji-pitch-feedback-module', 'schemas');
  const { evidencePath, feedbackPath } = toJsonSchemas(outDir);
  const evidenceRaw = fs.readFileSync(evidencePath, 'utf8');
  const feedbackRaw = fs.readFileSync(feedbackPath, 'utf8');
  JSON.parse(evidenceRaw); // must parse cleanly
  JSON.parse(feedbackRaw);
  assert.ok(evidenceRaw.includes('evidence_claims'), 'evidence.schema.json must contain evidence_claims');
  assert.ok(feedbackRaw.includes('governing_thought'), 'feedback-result.schema.json must contain governing_thought');

  console.log('OK - pitch-feedback-schemas self-test passed; JSON Schemas emitted to', path.relative(process.cwd(), outDir));
}
