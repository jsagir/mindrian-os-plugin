# DEMO-VERDICT - Phase 229 PWS_grading demo (the sale)

> The demo IS the sale: two Minto-pyramid feedback artifacts, generated end to end
> from the two customer sample transcripts, that Amnon Dekel judges "better than a
> TA". This file records the pipeline output (Task 1) and, once captured, Amnon's
> verbatim verdict + Jonathan's sampling-pass sign-off (Task 2). No em-dashes.

**Plan:** 229-09  ·  **Recorded:** 2026-07-16  ·  **Executor:** GSD sequential (main tree)

---

## 1. Pipeline Output (Task 1)

**Status (2026-07-16, SECOND fix-and-verify session): DI-4 and DI-5 RESOLVED and verified
live - the pipeline now produces REAL course-tier grades of real pitch content, end to end,
and extraction is byte-verbatim. Demo STILL NOT gate-clean: two NEW Stage-B-side blockers
surfaced (DI-6 non-verbatim feedback quotes, DI-7 a D1 verifier blind spot that masks DI-6 as
a false green). No artifact was fabricated or force-passed.**

### What the two fixes bought (verified live this session)

- **DI-4 FIXED (`scripts/huji-intake.cjs` dual-write).** `populateRoom` now renders the Stage A
  evidence into the section ROOM.md markdown the grading spine reads (problem-definition +
  solution-design + a consolidated root pitch-intake artifact), mirroring file-meeting. Stage B
  (opus) graded REAL content on BOTH samples - no more empty-room refusal. Confirmed on disk:
  the populated sections no longer read "Awaiting first content"; the 6 sections the pitch does
  not cover honestly stay empty.
- **DI-5 FIXED (`huji-stage-a-intake.md` + `huji-run-one.cjs`).** Byte-verbatim quoting rule
  added. Verified live: study-app evidence.json preserves `vali- validating` and
  `surprising-- important` byte-verbatim; D1 passes those extraction quotes.

### The two NEW blockers (why the demo is still not gate-clean)

- **DI-6 (Stage B packages non-verbatim quotes).** safescan feedback quoted two ELLIPTICAL,
  non-contiguous spans - `"biosensor engineer... a mobile app developer"` and
  `"a safety expert... an operation manager"` - joining non-adjacent transcript fragments with
  `...`. D1 correctly rejected them (quote-verifier: FAILED, 2 misses). study-app cleaned a
  disfluency in its feedback (`handled by validating` for the transcript's
  `handled by vali- validating`) - the DI-5 cleaning reappearing on the FEEDBACK side.
- **DI-7 (D1 extractor single-quote blind spot, masks DI-6).** study-app reported
  quote-verifier PASSED, but VACUOUSLY: all 8 of its feedback quotes use single quotes
  (`'...'`), and `extractQuotedSpans` (huji-eval.cjs) only recognizes `"..."`, curly quotes,
  and `> ` blockquotes. It extracted ZERO feedback spans, so it checked none - and the one
  non-verbatim quote sailed through silently. A false green. This is the silently-skipped-gate
  failure class we track.

Full reproductions + candidate fixes in `deferred-items.md` (DI-6, DI-7). Real, UNEDITED
pipeline outputs preserved under `demo/blocked-run-2026-07-16/`. Nothing fabricated, nothing
hand-cleaned (threat T-229-09-01).

| Field | Value (REAL, 2026-07-16 second session) |
|-------|------------------------------------------|
| feedback-sample-1.md (SafeScan) | NOT gate-clean - a REAL opus grade was produced (10 questions scored 4/10, 3 Minto branches), but D1 FAILED on 2 elliptical feedback quotes (DI-6). Raw output: `blocked-run-2026-07-16/safescan-001.feedback.RAW.md` |
| feedback-sample-2.md (study-app) | NOT trustworthy - a REAL opus grade (overall 85), quote-verifier reported PASS but only because DI-7 skipped its single-quoted feedback quotes, one of which is non-verbatim (DI-6). Raw output: `blocked-run-2026-07-16/study-app-001.feedback.RAW.md` |
| Stage A extraction (both) | WORKS - haiku, `--plugin-dir` + keychain, valid structured evidence.json, disfluencies preserved byte-verbatim (DI-5) |
| DI-4 dual-write | WORKS - section ROOM.md populated; Stage B grades real content, not an empty room |
| pinned model_id (Stage B, both) | `claude-opus-4-8` (verified in both result.json) |
| pinned model_id (Stage A, both) | `claude-haiku-4-5` |
| calibration_source (both) | `local-anchors` (Tier 0, Brain not queried - Canon Part 8 intact) |
| Stage A cost / sample | $0.164 (safescan), $0.136 (study-app) |
| Stage B cost / sample | $2.540 (safescan), $2.785 (study-app) - opus, on REAL grades this time |
| total_cost_usd / unit | $2.704 (safescan), $2.921 (study-app) - both under the $3.00 fuse |
| gate: schema (both) | PASSED (FeedbackResultSchema valid) |
| gate: quote-verifier | safescan FAILED (DI-6, real); study-app PASSED but vacuously (DI-7) |
| Judge calibration (LIVE, prior session) | **Spearman 0.901 (min 0.7) PASS**; Dental post>pre PASS; DnATA<Lucid PASS -> JUDGE CALIBRATED (not re-run this session; no gate-clean artifacts to judge yet) |
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

DI-1/2/3 (CLI/auth) and DI-4/DI-5 (handoff + extraction) are all RESOLVED. The
remaining path to two genuinely gate-clean artifacts:

1. **Fix DI-7 first (the gate must not lie).** Extend `extractQuotedSpans` in
   `scripts/huji-eval.cjs` to also capture single-quoted (`'...'`) feedback spans
   (guarding against apostrophe-contraction false positives via a min length / same-line
   balance), and add a FAIL fixture (a single-quoted non-verbatim feedback quote) so the
   check turns red on this exact regression. Until this lands, any DI-6 fix could be
   "confirmed" green while single-quoted misses still slip through.
2. **Then fix DI-6 (make Stage B quote verbatim).** Port the DI-5 BYTE-VERBATIM QUOTING
   RULE onto the Stage B side: amend `references/methodology/rubric-huji.md` (and/or
   `pipelines/PWS_grading/04-structure-argument.md`) to require every quoted span in the
   delivered feedback to be a single contiguous byte-verbatim run from the transcript -
   no ellipsis joins, no cleaned disfluencies. Quote less, but exactly.
3. **Re-run both samples** end to end (the working out-of-tree driver pattern:
   `runOne` over a 2-item workspace, used this session), and confirm quote-verifier +
   schema PASS on BOTH (with DI-7's fixed extractor now actually checking the feedback
   quotes). Then re-run `--suite anchors --judge` to reconfirm the 0.7 Spearman gate on
   the real artifacts, and hand the two gate-clean artifacts to Amnon.

Real, unedited outputs from the DI-6/DI-7-blocked run are under
`demo/blocked-run-2026-07-16/` for diagnosis.
