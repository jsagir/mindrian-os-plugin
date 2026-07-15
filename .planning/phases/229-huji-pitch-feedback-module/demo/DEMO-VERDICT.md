# DEMO-VERDICT - Phase 229 PWS_grading demo (the sale)

> The demo IS the sale: two Minto-pyramid feedback artifacts, generated end to end
> from the two customer sample transcripts, that Amnon Dekel judges "better than a
> TA". This file records the pipeline output (Task 1) and, once captured, Amnon's
> verbatim verdict + Jonathan's sampling-pass sign-off (Task 2). No em-dashes.

**Plan:** 229-09  ·  **Recorded:** 2026-07-16  ·  **Executor:** GSD sequential (main tree)

---

## 1. Pipeline Output (Task 1)

**Status: BLOCKED - the two live demo artifacts were NOT generated this session.**

The automated half of the phase gate is fully green (Section 2). The live demo run
that emits `demo/feedback-sample-1.md` and `demo/feedback-sample-2.md` could not
execute, because the module's first-ever live `claude` spawn hits a three-layer
blocker chain (Section 3). No feedback artifact was fabricated - the demo is the
sale, and a fabricated or unfair artifact costs the deal (threat T-229-09-01). An
empty artifact is honest; a faked one is not.

| Field | Value |
|-------|-------|
| feedback-sample-1.md (SafeScan) | NOT PRODUCED - blocked at Stage A (see Section 3) |
| feedback-sample-2.md (study-app) | NOT PRODUCED - blocked at Stage A |
| total_cost_usd | $0.00 (no model call completed) |
| pinned model_id | n/a (Stage B grading spine never reached) |
| judge scores (Real/Win/Worth) | n/a - judge calibration is also key-blocked (Section 3c) |
| calibration_source | n/a |

### On-disk gates (would have been checked on the artifacts)

These gates are proven sound by their PASS+FAIL selftests (Section 2), but they had
no live artifact to run against this session:

- D1 quote-verifier clean (no fabricated critique): selftest green, no live artifact.
- D5 FeedbackResultSchema valid (Minto pyramid): selftest green, no live artifact.
- D6 sample-2 self-identified gaps CREDITED not double-punished; risks+mitigation
  (0:52) NOT marked missing; no disfluency/language penalization: encoded in the
  frozen rubric (`references/methodology/rubric-huji.md` sections 2-3), not yet
  exercised on a live grading pass.

### Cost-tier eval question (opus vs sonnet indistinguishability)

Deferred with the live run. The AI-SPEC Section 5 open question (is the sonnet spine
indistinguishable from opus at course-tier depth, letting the batch drop a tier)
requires two live grading passes to compare; neither could run. Do NOT silently swap
the pinned model - record the delta when the live demo runs.

---

## 2. Automated phase-gate half - GREEN (verified this session)

Every deterministic, model-free leg passes. This is necessary but NOT sufficient for
the sale (the sale is Amnon's human verdict, Section 4).

| Suite | Command | Result |
|-------|---------|--------|
| Structural aggregator | `bash tests/run-all-229.sh` | **PASS=9 FAIL=0 SKIP=0** |
| Code checks (strict) | `node scripts/huji-eval.cjs --suite code --strict` | **7/7 passed** |
| Judge calibration MATH | `node scripts/huji-eval.cjs --suite anchors --judge` | 1 PASS + 4 FAIL fixtures verified; live judge SKIPPED (no key) |
| Scratch-room scaffold | `node scripts/huji-run-one.cjs --selftest-scaffold` | Validation stage, grading -> claude-opus-4-8, 8-section skeleton |
| Runner arg contract | `node scripts/huji-run-one.cjs --dry-run` | Stage A/B arg arrays well-formed |
| Batch pool + resume | `node scripts/huji-batch.cjs --dry-run 5` / `--test-d10` | ledger transitions, concurrency cap, kill/resume, zero cross-bleed |

The seven code checks (quote-verifier, inventory-recall, schema, drift, similarity,
cost-ledger, part8-hygiene) each self-verify with a known-good PASS fixture and a
known-bad FAIL fixture, so they turn red the moment the check logic regresses.

---

## 3. Blocker chain - why the live demo could not run

The demo run is the FIRST time any Phase 229 code spawns a live `claude` session.
Every prior test (Plans 01-08) is model-free: the dry-runs assert the argument ARRAY
contains `--json-schema`, but never actually spawn the CLI. So this is the first
exposure of three incompatibilities with the installed CLI (`claude` 2.1.211), which
fire in order. Each was reproduced empirically this session.

### 3a. `--json-schema` takes INLINE JSON, not a file path (fires first, ~524 ms)

`scripts/huji-run-one.cjs` (Stage A `buildStageAArgs`, Stage B `buildStageBArgs`) and
`scripts/huji-eval.cjs` (`spawnJudge`) all pass a FILE PATH to `--json-schema`
(`config.evidenceSchemaPath`, `config.feedbackSchemaPath`, `JUDGE_SCHEMA_PATH`). CLI
2.1.211 expects the schema INLINE:

```
--json-schema <schema>   JSON Schema for structured output validation.
                         Example: {"type":"object","properties":{...},"required":[...]}
```

Observed (real `runOne` over sample-1):
```
reason: "stageA_nonzero"
detail: "Error: --json-schema is not valid JSON: JSON Parse error: Unrecognized token '/'"
```
The leading `/` of the path is what the CLI tried to JSON-parse. The `@file` load
convention also fails: `Unrecognized token '@'`. This blocks Stage A, Stage B, AND the
sonnet judge identically.

### 3b. Schema draft 2020-12 not accepted by the CLI validator (fires second)

Even inlined, the on-disk schemas declare `"$schema":"https://json-schema.org/draft/2020-12/schema"`
(emitted by the zod `z.toJSONSchema` generator in `lib/core/pitch-feedback-schemas.cjs`).
The CLI validator rejects it:
```
Error: --json-schema is not a valid JSON Schema:
       no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
```
A minimal draft-07 (or no-`$schema`) inline object gets past this layer.

### 3c. Stage A auth: `--bare` has no credential (fires third - the anticipated gate)

With an inline draft-07 schema, the spawn finally reaches the API and returns:
```
is_error: true   result: "Not logged in - Please run /login"   terminal_reason: "api_error"
```
Root cause, from reading `scripts/huji-run-one.cjs`: Stage A is `--bare` (line 240,
`buildStageAArgs`) and sources its key from `config.apiKey = process.env.ANTHROPIC_API_KEY || ''`
(resolveConfig line 102, applied at runOne lines 454-455). `--bare` deliberately skips
plugin discovery AND the OAuth/keychain session, so the API key env var is its ONLY
credential source - and `ANTHROPIC_API_KEY` is unset in this environment. This is
exactly the CONTRACTS.md AUTH_PATH risk: "Stage A may have been built expecting --bare
+ API key."

**Not a blanket auth outage - Stage A specific.** A NON-bare spawn (the Stage B path,
keychain/OAuth) authenticates cleanly here and even loads the plugin:
```
is_error: false   result: "Ready. MindrianOS v1.15.3-beta.24 loaded, workspace confirmed, Larry active."
```
So Stage B's grading-spine auth works in this environment; only Stage A's `--bare`
path is credential-less, because `--bare` bypasses the keychain that Stage B uses.

---

## 4. Amnon Dekel verdict + Jonathan sign-off (Task 2) - PENDING

_Blocking-human checkpoint. To be filled after the live demo artifacts exist and are
handed to Amnon. Do not fabricate._

- **Amnon's verbatim "better than a TA" verdict:** _(pending)_
- **Jonathan - labeled inventories (Plan 02) confirmed, `_label_status` -> human-confirmed:** _(pending)_
- **Jonathan - pre-delivery sampling-pass sign-off (AI-SPEC Section 7, here the 2 artifacts):** _(pending)_
- **On approval:** embed the 2 approved artifacts into the `rubric-huji.md` few-shot slot (section 5, currently intentionally empty). Not done - no approved artifacts exist yet.

---

## 5. What is needed to generate the real artifacts

1. **Resolve the `--json-schema` contract (3a)** - inline the schema JSON into the
   arg instead of passing a path, in `huji-run-one.cjs` (both stages) and
   `huji-eval.cjs` (`spawnJudge`). See `deferred-items.md`.
2. **Resolve the schema draft (3b)** - the zod-generated schemas emit draft 2020-12;
   the CLI validator wants an accepted draft. This touches the schema-generation
   choice (grade-provenance surface), so it is a decision for Jonathan, not a blind
   downgrade. See `deferred-items.md`.
3. **Provide Stage A credentials (3c)** - either export `ANTHROPIC_API_KEY` for the
   `--bare` Stage A path (the designed contract), OR revise AUTH_PATH so Stage A uses
   the keychain like Stage B (drop `--bare`; it works here). A CONTRACTS decision.
4. Then run the live demo over both samples (a small driver calling `runOne`, or
   `runBatch` over a 2-item out-of-tree workspace - note `--suite demo` referenced in
   VALIDATION.md is not implemented in `huji-eval.cjs`), confirm D1/D5/D6 gates on the
   real artifacts, run `--suite anchors --judge` to clear the 0.7 Spearman gate, then
   hand the two artifacts to Amnon.
