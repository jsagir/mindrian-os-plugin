# DEMO-VERDICT - Phase 229 PWS_grading demo (the sale)

> The demo IS the sale: two Minto-pyramid feedback artifacts, generated end to end
> from the two customer sample transcripts, that Amnon Dekel judges "better than a
> TA". This file records the pipeline output (Task 1) and, once captured, Amnon's
> verbatim verdict + Jonathan's sampling-pass sign-off (Task 2). No em-dashes.

**Plan:** 229-09  ·  **Recorded:** 2026-07-16  ·  **Executor:** GSD sequential (main tree)

---

## 1. Pipeline Output (Task 1)

**Status: DI-1/2/3 RESOLVED + judge calibrated live; demo STILL BLOCKED by a deeper,
newly-surfaced architectural bug (DI-4). The two artifacts were NOT generated and NOT
fabricated.**

Update 2026-07-16 (fix-and-verify session). The three CLI/auth blockers from the first
session (DI-1 json-schema-as-path, DI-2 draft 2020-12, DI-3 Stage A `--bare` credential)
are FIXED and committed. That let the opus grading spine (Stage B) spawn for the FIRST
time ever - which immediately exposed two deeper bugs that were masked behind DI-1/2/3:

- **DI-4 (blocker, architectural):** the Stage A -> Stage B evidence handoff is broken.
  `populateRoom` writes the evidence into the room GRAPH (`.mindrian/room.db`, 11 claim
  nodes, verified), but the grading session is tool-scoped to `Bash(node lib/core/*)` and
  CANNOT read `room.db` (no `sqlite3`), so it reads the section markdown - which are EMPTY
  auto-scaffolds. Stage B (opus) therefore graded an EMPTY ROOM and CORRECTLY refused to
  fabricate: it returned a setup-state finding, `scores: {}`, not a Minto grade. The
  anti-fabrication guard worked; the orchestration is what is broken.
- **DI-5 (blocker, extraction):** Stage A (haiku) cleaned the transcript's speech
  disfluencies ("vali- validating" -> "validating"; "surprising-- important" ->
  "important"), so 2 evidence quotes were no longer verbatim and the D1 quote-verifier
  correctly flagged them.

Full reproductions + candidate fixes are in `deferred-items.md` (DI-4, DI-5). No feedback
artifact was fabricated - the demo is the sale, and a fabricated or unfair artifact costs
the deal (threat T-229-09-01).

| Field | Value (REAL, this session) |
|-------|----------------------------|
| feedback-sample-1.md (SafeScan) | NOT PRODUCED - Stage B (opus) ran >10 min then exited nonzero, no artifact (DI-4 empty-room grind) |
| feedback-sample-2.md (study-app) | NOT PRODUCED as a valid artifact - Stage B emitted a setup-state finding (empty room), `scores: {}`, and D1 flagged 2 disfluency-cleaned quotes (DI-4 + DI-5) |
| Stage A extraction | WORKS - haiku, `--plugin-dir` + keychain, ~40s, valid structured evidence.json, num_turns 3 |
| pinned model_id (Stage B) | `claude-opus-4-8` (verified in study-app result.json) |
| calibration_source | `local-anchors` (Tier 0, Brain not queried) |
| Stage A cost / sample | ~$0.12 (haiku) |
| Stage B cost (study-app) | $1.157 (opus) - spent on a NON-grade (empty room) |
| total_cost_usd (study-app unit) | $1.277 (Stage A $0.120 + Stage B $1.157) |
| Judge calibration (LIVE) | **Spearman 0.901 (min 0.7) PASS**; Dental post>pre PASS; DnATA<Lucid PASS -> JUDGE CALIBRATED |
| Judge model / spine | `claude-sonnet-4-5` judging `claude-opus-4-8` (pinned different, self-preference dodge) |

### Judge calibration - the one gate that DID clear live

`HUJI_JUDGE_LIVE=1 node scripts/huji-eval.cjs --suite anchors --judge` ran the 7-point
protocol over the 6 graded anchors (keychain, no plugin, no tools). Result:
- Spearman vs known ordering: **0.901** (min 0.7) - PASS
- Dental post-revision > pre-revision: PASS
- DnATA (10) < Lucid (09) on every dimension: PASS
- Sample anchor scores observed: 04-circular Real 2/Win 2/Worth ~ (canonical 24/100, low);
  10-dnata Real 3/Win 2/Worth 3 (matches its known scorecard exactly).
- Verdict: **JUDGE CALIBRATED** - may gate delivery (after the human re-rank). This is a
  real, strong result; the judge is trustworthy once the pipeline can emit real artifacts.

### Cost-tier eval question (opus vs sonnet indistinguishability)

Still deferred - it needs two GRADED passes to compare, and DI-4 means no gradable pass
exists yet. Do NOT silently swap the pinned model; record the delta once DI-4/DI-5 clear.

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

## 3. Original blocker chain (DI-1/2/3) - NOW RESOLVED (kept for the record)

> All three layers below were FIXED in the 2026-07-16 fix-and-verify session (commits
> `da494c2e`, `1d6d94ce`, `0f8427b7`, `a44157a2`, `a4e16f7e`). Stage A now runs and
> the judge calibrates live (Section 1). The demo is now blocked by DI-4/DI-5, not by
> these. This section documents the original reproductions.

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
