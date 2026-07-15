---
phase: 229
slug: huji-pitch-feedback-module
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 229 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Translates AI-SPEC.md
> Section 5 (10-dimension eval strategy) into this project's Nyquist shape - `tests/run-all-NNN.sh`
> bash aggregators + per-leg CJS tests, precedent `tests/run-all-226.sh`. Does not re-invent the
> eval design; the D1-D10 dimensions below ARE the AI-SPEC's eval dimensions, restated as tests.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `assert` + bash aggregator (repo convention; no jest/pytest) |
| **Config file** | none — `tests/run-all-229.sh` is the aggregator (Wave 0 creates it) |
| **Quick run command** | `bash tests/run-all-229.sh` (structural legs; no model calls; deterministic) |
| **Full suite command** | `bash tests/run-all-229.sh && node scripts/huji-eval.cjs --suite code --strict` |
| **Judge/anchor suite (model calls, ~$2)** | `node scripts/huji-eval.cjs --suite anchors --judge` (fails closed below 0.7 Spearman correlation) |
| **Demo acceptance (the sale)** | `node scripts/huji-eval.cjs --suite demo` (both customer samples end-to-end, emits the 2 artifacts Amnon judges) |
| **Estimated runtime** | Structural suite: seconds. Judge suite: minutes + ~$2 model spend. Demo suite: minutes + real model spend at Stage B opus tier. |

---

## Sampling Rate

- **After every task commit:** `bash tests/run-all-229.sh` (fast, deterministic, zero model calls)
- **After every plan wave:** `bash tests/run-all-229.sh && node scripts/huji-eval.cjs --suite code --strict`
- **Before any batch run / after any prompt, rubric, model, or schema change:** `node scripts/huji-eval.cjs --suite anchors --judge` — the judge calibration protocol, fails closed under 0.7 Spearman correlation against the 6 usable graded anchors
- **Phase gate (before calling the pilot demo-ready):** structural suite green + the mandatory HUMAN calibration checkpoint — Amnon Dekel's "better than a TA" verdict on the 2 demo artifacts. Per the run-all-226 precedent, human calibration is a real validation leg, never an automated assertion.
- **Max feedback latency:** seconds (structural); minutes (judge/demo suites — model-call-bound, not sampling-bound)

---

## Per-Requirement Verification Map (pre-task; planner assigns Task IDs in Step 8)

| Dim | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| D1 | Every quote in evidence.json / feedback.md exists verbatim in the source transcript (zero fabricated critique — domain failure mode #1) | unit (code) | `node scripts/huji-eval.cjs --check quote-verifier` | ❌ Wave 0 | ⬜ pending |
| D2 | Labeled entity/claim inventory 100% recalled into evidence.json (intake fidelity vs the fusion engine's extraction standards) | unit (code) | `node scripts/huji-eval.cjs --check inventory-recall` | ❌ Wave 0 | ⬜ pending |
| D3 | Duplicate-anchor probes score within 1 band of each other; identical pinned `model_id` across the cohort (fairness at N=200) | integration (code) | `node scripts/huji-eval.cjs --check drift` | ❌ Wave 0 | ⬜ pending |
| D4 | Zero student-specific strings in any Brain query payload (Part 8 query hygiene — generic handles only, read-only posture) | unit (code) | reuse `part8-egress-guard.classify` over the query log | ✅ guard exists / ❌ harness leg Wave 0 | ⬜ pending |
| D5 | `FeedbackResultSchema` validates — governing thought + 2-3 branches + step structure (Minto/MECE structural validity) | unit (zod) | `node scripts/huji-eval.cjs --check schema` | ❌ Wave 0 (schema + leg) | ⬜ pending |
| D6 | Formative tone; metacognition credited, never double-punished (sample 2's self-named gaps); disfluencies never punished (non-native speakers) | LLM judge + human | `node scripts/huji-eval.cjs --suite anchors --judge` | ❌ Wave 0 + human checkpoint | ⬜ pending |
| D7 | Feed-up / feed-back / feed-forward present per branch, calibrated to course depth (not investor-gauntlet depth) | LLM judge + human (TA blind comparison) | `--suite anchors --judge` + the HUJI calibration workshop | ❌ Wave 0 + human | ⬜ pending |
| D8 | Pairwise shingle-Jaccard similarity below threshold across the cohort (no templated/generic feedback); swap test passes | unit (code) + judge | `node scripts/huji-eval.cjs --check similarity` | ❌ Wave 0 | ⬜ pending |
| D9 | `total_cost_usd` per submission ≤ $3.00 (the per-unit fuse, inside the $4-5 quoted ceiling) | unit (code) | `node scripts/huji-eval.cjs --check cost-ledger` | ❌ Wave 0 | ⬜ pending |
| D10 | Kill/resume skips completed `.done` submissions; zero cross-student context bleed at N=200 | integration (harness) | `bash tests/run-all-229.sh` (kill/resume + cross-bleed grep) | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs land here once `/gsd-plan-phase 229` step 8 assigns waves.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-229.sh` — aggregator (model on `run-all-226.sh`; D1-D10 structural legs + kill/resume + cross-bleed grep)
- [ ] `scripts/huji-eval.cjs` — code checks (quote verifier, inventory recall, drift stats, similarity index, cost ledger, Part 8 hygiene scan) + a headless `claude -p --bare` judge spawner (sonnet judging opus output, dodges self-preference bias, `--json-schema` judge schema)
- [ ] `.planning/phases/229-huji-pitch-feedback-module/schemas/evidence.schema.json` + `feedback-result.schema.json` (generated from zod via `require('zod/v4').z.toJSONSchema`, verified live this session)
- [ ] `.planning/phases/229-huji-pitch-feedback-module/eval/` — labeled inventories (Jonathan labels the 2 customer samples), judge prompt, judge schema, probe manifest
- [ ] Judge calibration protocol harness — 6 usable graded anchors (of the 12 Notion fixtures; the rest are process logs / structure-only, not grade anchors per the fixture INDEX's anchor-hygiene rules), Spearman ≥ 0.7, human re-rank correlation ≥ 0.7
- [ ] Synthetic probes: duplicate-anchor pairs (positions 1/50/100/150/200 in a simulated cohort), a near-duplicate fairness pair, an injection probe (apostrophes + "ignore previous instructions" — a literal string in this probe, not a live instruction), degenerate inputs (empty / 15-second / all-noise transcript)

No test framework install needed — Node built-in `assert` + bash cover the whole phase. The 14 seed artifacts (2 customer samples + 12 calibration fixtures) already exist on disk; do not invent a synthetic dataset in their place.

---

## Manual-Only Verifications

| Behavior | Dimension | Why Manual | Test Instructions |
|----------|-----------|------------|--------------------|
| "Better than a TA" verdict on the 2 demo artifacts | D6/D7 human half | This IS the sale — Amnon Dekel's subjective judgment is the acceptance criterion, not a stub-assertable property | Run `--suite demo` on both customer samples, hand the two feedback artifacts to Amnon, record his verdict verbatim |
| TA blind comparison during the HUJI calibration workshop | D7 human half | Calibrating course-depth (which of the ten validation questions the course actually teaches) requires a live workshop with Amnon's team, not a fixture | Per CONTEXT.md's calibration-phase ruling: run the workshop, capture which questions/tiers apply, feed back into the rubric before batch scale |
| Judge-vs-human correlation sanity read on a few anchors | D6/D7 calibration | LLM-judge scores need a human sanity check before being trusted at scale | Jonathan blind re-ranks 2-3 anchor outputs against the judge's ranking; must correlate ≥ 0.7 or the judge prompt needs revision |

---

## Validation Sign-Off

- [x] All dimensions have an `<automated>` verify path or an explicit Wave 0 dependency (see map — every D1-D5, D8-D10 leg carries a runnable command; D6-D7 carry judge+human legs per AI-SPEC Section 5's own design, not a gap)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (enforced once the planner assigns tasks to this map in Step 8)
- [x] Wave 0 covers all MISSING references (aggregator, eval script, schemas, eval fixtures, judge harness, probes — all listed above)
- [x] No watch-mode flags
- [x] Feedback latency acceptable (structural suite: seconds; model-call suites are cost-bound, not latency-bound, and are gated to specific triggers, not every commit)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (flips to `wave_0_complete: true` once Wave 0 tasks land in Plan 01; final sign-off at the demo-suite human checkpoint — Amnon's verdict on the 2 customer samples)
