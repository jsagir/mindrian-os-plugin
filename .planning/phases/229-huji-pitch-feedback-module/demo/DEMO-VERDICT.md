# DEMO-VERDICT - Phase 229 PWS_grading demo (the sale)

> The demo IS the sale: two Minto-pyramid feedback artifacts, generated end to end
> from the two customer sample transcripts, that Amnon Dekel judges "better than a
> TA". This file records the pipeline output (Task 1) and, once captured, Amnon's
> verbatim verdict + Jonathan's sampling-pass sign-off (Task 2). No em-dashes.

**Plan:** 229-09  ·  **Recorded:** 2026-07-16  ·  **Executor:** GSD sequential (main tree)

---

## 1. Pipeline Output (Task 1) - GATE-CLEAN

**Status (2026-07-16, THIRD fix-and-verify session): DI-6 and DI-7 RESOLVED and verified live.
The pipeline now produces TWO genuinely gate-clean course-tier feedback artifacts, end to end,
from the two customer sample transcripts. Both pass the FULL per-unit guardrail battery
(G1 quote-grounding, G2 schema, G3 Part-8 egress hygiene, G4 model provenance, G6 Minto
shape + length). Nothing was fabricated, hand-cleaned, or force-passed. The real artifacts are
`demo/feedback-sample-1.md` (SafeScan) and `demo/feedback-sample-2.md` (study-app), written
verbatim from the pipeline output; per-stage provenance is in the sibling `*.result.json`.**

### What the two fixes did (verified live this session)

- **DI-7 FIXED (`scripts/huji-eval.cjs` `extractQuotedSpans`).** The D1 span extractor now
  recognizes single-quoted (`'...'`) and curly-single spans in addition to double / curly-double
  / blockquote. The grammar is boundary-aware so contraction and possessive apostrophes
  (`we'll`, `don't`, `students'`) are never mistaken for span delimiters - the grammar widens,
  the check does NOT loosen. Proven non-vacuous two ways: (a) new selftest fixtures (a PASS
  verbatim-single-quote + contraction-safety case, and a FAIL non-verbatim single-quote case),
  and (b) re-running the OLD blocked study-app feedback now correctly FAILS on 3 previously
  hidden single-quoted misses (including the dropped `vali- ` disfluency) that had produced a
  false green.
- **DI-6 FIXED (`references/methodology/rubric-huji.md` Section 3b + `pipelines/PWS_grading/04-structure-argument.md`).**
  The Stage A byte-verbatim discipline is now ported onto the Stage B FEEDBACK side: every
  quoted span must be a single contiguous byte-verbatim run - no ellipsis joins across
  non-adjacent fragments, no cleaned disfluencies, and (follow-up) quotation marks are reserved
  EXCLUSIVELY for verbatim transcript spans, never for a counterfactual/hypothetical/emphasis
  phrase the student did not say. Verified live: the safescan feedback now quotes the contiguous
  span `our initial recruitment plan is to hire a hardware and biosensor engineer for the
  device` (the old ellipsis stitch `biosensor engineer... a mobile app developer` is gone); the
  study-app feedback PRESERVES the `vali- validating` and `uh` disfluencies verbatim on the
  feedback side and renders the "you did not settle for a good team" contrast as plain text
  instead of the earlier fabricated quote `'a good team'`.

### The two gate-clean artifacts (REAL, 2026-07-16 third session)

| Field | feedback-sample-1.md (SafeScan) | feedback-sample-2.md (study-app) |
|-------|--------------------------------|----------------------------------|
| gate battery (G1/G2/G3/G4/G6) | ALL CLEAN | ALL CLEAN |
| Ten-Questions total | 7 / 10 | 8 / 10 |
| Minto branches | 3 | 3 |
| feedback length | 616 words (ceiling 900) | 770 words (ceiling 900) |
| pinned Stage B model_id | `claude-opus-4-8` | `claude-opus-4-8` |
| pinned Stage A model_id | `claude-haiku-4-5` | `claude-haiku-4-5` |
| calibration_source | `local-anchors` (Tier 0, no Brain egress) | `local-anchors` (Tier 0, no Brain egress) |
| Stage A cost | $0.113 | $0.111 |
| Stage B cost | $1.488 | $1.755 |
| total_cost_usd / unit | $1.601 (under $3.00 fuse) | $1.866 (under $3.00 fuse) |
| schema (G2) | PASSED | PASSED |
| quote-verifier (G1) | PASSED (evidence quotes verbatim; every feedback citation independently verified verbatim) | PASSED (evidence quotes verbatim; disfluencies preserved; no counterfactual quote) |
| session_id (Stage B) | `026455ed-7c9d-47c6-9cd6-dac12ebe3387` | `ed321901-682b-4c5f-9f12-226c2ce22539` |

### Grounding integrity note (why the gate pass is honest, not vacuous)

Both final artifacts render the student's citations as plain-text verbatim bullets and reserve
quotation marks strictly for verbatim spans, so on these particular artifacts the feedback side
happens to carry zero quote-wrapped spans. That is NOT the DI-7 vacuous-pass pathology (an
unchecked BAD quote): every citation bullet was independently verified to be a full byte-verbatim
transcript span (safescan 9/9; study-app 7/9, the remaining two being the grader's own analysis
prose, not citations), and the Stage A evidence.json quotes ARE checked by G1. The DI-7 gate's
non-vacuous power is proven by its fixtures and by the re-verified old blocked output above.

### Environmental note (honest record of the run)

The live end-to-end run was intermittently disrupted by a plugin install swap
(`1.15.3-beta.25` <-> `beta.24`) firing mid-session, which twice left the spawned grading
session without its chain definition and MCP/Bash tools; in those runs the grading spine
correctly REFUSED to grade (it saw an unreachable chain / unreadable room and would not
fabricate a grade) rather than inventing one - the anti-fabrication rule working as designed.
Once the install churn settled, both samples graded cleanly on a fresh spawn. No refusal run
was ever dressed up as a grade. Raw diagnostic outputs are retained under `demo/blocked-run-2026-07-16/`.

### Judge calibration - RE-CONFIRMED live this session

`HUJI_JUDGE_LIVE=1 node scripts/huji-eval.cjs --suite anchors --judge` ran the calibration
protocol over the 6 graded anchors (keychain, `--setting-sources "" --tools ""`, no plugin).
Result (2026-07-16 third session):
- Spearman vs known ordering: **0.883** (min 0.7) - PASS
- Dental post-revision > pre-revision: PASS
- DnATA (10) < Lucid (09) on every dimension: PASS
- Verdict: **JUDGE CALIBRATED** - may gate delivery (after the human re-rank).
- (Prior session recorded 0.901; the ~0.02 delta is sonnet stochasticity, both well above the
  0.7 gate. The judge scores the fixed calibration anchors, so the DI-6/DI-7 fixes do not
  change this number - the re-run confirms the judge is still trustworthy for the real run.)
- The judge model (`claude-sonnet-4-5`) is pinned DIFFERENT from the grading spine
  (`claude-opus-4-8`) to dodge self-preference bias.
- The human re-rank (Jonathan blind-ranks a 10-artifact sample) is still required before the
  judge may gate delivery (threat T-229-06-01) - part of the Task 2 human half.

### Cost-tier eval question (opus vs sonnet indistinguishability)

Still deferred - it needs two GRADED passes at different tiers to compare. Now that the
pipeline emits real gradable artifacts, this can be run in a follow-up; do NOT silently swap
the pinned model - record the delta first.

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

## 5. What is left (Task 1 done; Tasks 2/3 are the human checkpoints)

DI-1/2/3 (CLI/auth), DI-4/DI-5 (handoff + extraction), and DI-6/DI-7 (Stage B verbatim
quoting + the D1 single-quote blind spot) are ALL RESOLVED and verified live. Task 1 (the
pipeline half) is DONE and gate-clean: the two real artifacts exist at
`demo/feedback-sample-1.md` and `demo/feedback-sample-2.md`.

What remains is the HUMAN half, which the pipeline cannot self-complete:

1. **Task 2 - Amnon Dekel's "better than a TA" verdict (Section 4).** Hand the two
   gate-clean artifacts to Amnon and record his verbatim judgment. This is the actual
   sale; structural green is necessary but not sufficient.
2. **Task 2 - Jonathan's sign-offs (Section 4).** Confirm the Plan 02 labeled inventories
   (`_label_status` -> human-confirmed) and give the pre-delivery sampling-pass sign-off
   (AI-SPEC Section 7) over the two artifacts.
3. **Task 3 - embed the approved anchors.** On approval, embed the two artifacts into the
   `rubric-huji.md` Section 5 few-shot slot (currently intentionally empty so the frozen
   prefix stays bit-stable), then git-tag the checkout before the first real 200-student
   batch so grading conditions are identical for student 1 and student 200.

Real, unedited outputs from the earlier DI-6/DI-7-blocked run remain under
`demo/blocked-run-2026-07-16/` for the diagnostic record; the gate-clean deliverables are the
`feedback-sample-*.md` files in this directory.
