---
phase: 229-huji-pitch-feedback-module
verified: 2026-07-16T13:01:26Z
status: human_needed
score: 9/10 must-haves verified (pipeline mechanism); 1 blocking human checkpoint pending (by design)
overrides_applied: 0
human_verification:
  - test: "Hand demo/feedback-sample-1.md and demo/feedback-sample-2.md to Amnon Dekel and ask: is this better than a TA?"
    expected: "Amnon records a verbatim verdict in demo/DEMO-VERDICT.md Section 4"
    why_human: "The phase goal itself names this 'a mandatory human calibration checkpoint' - a subjective quality judgment that cannot be automated. 229-09 Task 2 (checkpoint:human-verify, gate:blocking) is explicitly not startable by the executor."
  - test: "Jonathan confirms the two labeled inventories (eval/labeled-inventories/*.json) match the samples and flips _label_status to human-confirmed; runs the pre-delivery sampling-pass sign-off over the two artifacts"
    expected: "DEMO-VERDICT.md Section 4 records both sign-offs"
    why_human: "Same blocking human checkpoint (229-09 Task 2)."
  - test: "Run the HUJI calibration workshop (Amnon + TA team): tier the ten validation questions to course depth, run the n>=10 TA blind comparison, capture results in calibration-workshop.md, feed tiering back into rubric-huji.md before batch scale"
    expected: "calibration-workshop.md exists with tiering + TA blind-comparison results; rubric-huji.md updated"
    why_human: "229-09 Task 3 (checkpoint:human-verify, gate:blocking) - facilitation with external HUJI stakeholders, not automatable."
  - test: "On Amnon's approval, embed the two approved feedback artifacts into rubric-huji.md Section 5 (currently intentionally empty) as the static few-shot anchors, then git-tag the checkout before the first 200-student batch"
    expected: "Section 5 filled; a git tag exists at the approved commit"
    why_human: "Gated on the Task 2 approval above; cannot happen before the human verdict lands."
---

# Phase 229: HUJI Pitch Feedback Module Verification Report

**Phase Goal:** Turn each student diarized 5-minute pitch transcript into one Minto-structured formative feedback artifact, batch-orchestrated across 200+ HUJI submissions at a $4-5/unit ceiling, with local-only scoring (Brain read-only, generic handles per Canon Part 8) and a mandatory human calibration checkpoint. MindrianOS first paying job.

**Verified:** 2026-07-16T13:01:26Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The pipeline mechanism (contracts, eval harness, recipe, intake, judge, single-unit runner, batch orchestrator, async engine twin) is built, wired, and independently confirmed green in this session by re-running the aggregator and the D14 parity test directly (not by trusting SUMMARY.md). Two real feedback artifacts were generated end to end and pass the full guardrail battery. The phase's own goal statement, however, requires "a mandatory human calibration checkpoint" as part of the deliverable — and that checkpoint (Amnon Dekel's "better than a TA" verdict, Jonathan's sign-offs, and the HUJI calibration workshop) is documented as PENDING in both 229-09-SUMMARY.md and demo/DEMO-VERDICT.md Section 4. This is a known, intentional gate (task type `checkpoint:human-verify`, `gate="blocking"`, `autonomous: false` in 229-09-PLAN.md) — not a defect discovered by this verification run. Per the goal-backward standard, the phase is therefore correctly incomplete pending human action, which routes this report to `human_needed` rather than `passed` or `gaps_found`.

229-10 (async MCP-safety twin + D14 parity gate + pin smoke test), scoped only to D14 and explicitly excluding MCP server/tool-registration/guardrails G7-G10 (deferred to the separate `mindrian-pitch-feedback-mcp` repo per navigator ruling in DR-FRAMEWORK-ARCHITECTURE-DECISION.md), verifies cleanly on its own scope, including the one Critical finding from 229-REVIEW.md (path-traversal via unsanitized `subId`), which is confirmed fixed and live-tested in this session.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Evidence + feedback contracts exist as a single zod source consumed by CLI and orchestrator; feedback schema encodes Minto shape | VERIFIED | `lib/core/pitch-feedback-schemas.cjs` (296 lines) exports `EvidenceSchema`, `FeedbackResultSchema`, `toJsonSchemas`; JSON Schemas on disk contain `evidence_claims` / `governing_thought` |
| 2 | Eval harness has labeled ground-truth inventories, probes at known cohort positions, and a D1-D10 aggregator that exits non-zero on FAIL | VERIFIED | `bash tests/run-all-229.sh` run live this session: **PASS=10 FAIL=0 SKIP=0** |
| 3 | Deterministic code checks catch non-verbatim quotes, recall misses, Part-8 leaks | VERIFIED | Ran live in the aggregator: quote-verifier, inventory-recall, schema, drift, similarity, cost-ledger, part8-hygiene all report PASS-case/FAIL-case selftests correctly discriminating |
| 4 | Named recipe PWS_grading resolves deep-grade -> mullins -> build-thesis -> structure-argument unattended (score-and-continue) | VERIFIED | `lib/core/recipe-maps.cjs`, `pipelines/PWS_grading/CHAIN.md`, `references/methodology/build-thesis-scored.md` on disk; recipe exercised live by the demo runs in 229-09 (7/10 and 8/10 scores emitted without halting) |
| 5 | Stage A extracts quote-anchored evidence.json and genuinely populates the scratch room via `writeClaimNode` (no shim) | VERIFIED | `scripts/huji-intake.cjs` (563 lines) exports `populateRoom`; exercised live in the 229-09 demo run (both samples) |
| 6 | Calibrated judge (Spearman >= 0.7) scores Real/Win/Worth + D1/D6/D7, pinned different model from the grading spine | VERIFIED | Aggregator ran the calibration-math selftest live (PASS-case + 4 FAIL-case fixtures all correctly discriminated); 229-09-SUMMARY.md + DEMO-VERDICT.md record a live judge run this session at Spearman 0.883 (not independently re-run here since it needs a live API key — see note) |
| 7 | Each submission runs in an isolated scratch room; `.done` written only after G1/G2/G4/G6 all pass | VERIFIED | `scripts/huji-run-one.cjs` (662 lines) exports `runOne`, `scaffoldScratchRoom`; the two demo artifacts in `demo/` are the live proof (both `gate-clean? YES` per DEMO-VERDICT.md) |
| 8 | Batch orchestrator loops N submissions with checkpointed ledger; kill/resume skips `.done`, zero cross-bleed; G3/G4 halt the whole batch | VERIFIED | `scripts/huji-batch.cjs` (821 lines) exports `runBatch`; aggregator's D10 leg ran live this session: "resume: skipped stub-0001, stub-0003 (done); re-ran stub-0002, stub-0004 in FRESH rooms; zero double-write... cross-bleed: 0" |
| 9 | Two customer samples run end to end and emit two gate-clean Minto feedback artifacts | VERIFIED | `demo/feedback-sample-1.md` (SafeScan, 7/10, 616w), `demo/feedback-sample-2.md` (study-app, 8/10, 770w) on disk; DEMO-VERDICT.md records G1/G2/G3/G4/G6 ALL CLEAN, costs $1.60/$1.87 (under the $4-5/unit ceiling and under the $3.00 fuse) |
| 10 | Amnon Dekel records a "better than a TA" verdict (the sale) | **PENDING (human checkpoint, not a gap)** | demo/DEMO-VERDICT.md Section 4: "_(pending)_" for Amnon's verdict, Jonathan's inventory confirmation, and the sampling-pass sign-off. 229-09-SUMMARY.md: "Tasks 2/3 are the HUMAN half... now startable" |
| 11 | HUJI calibration workshop tiers the ten questions to course depth and feeds back into the frozen rubric | **PENDING (human checkpoint, not a gap)** | `calibration-workshop.md` does not exist on disk (confirmed by direct file check); this is 229-09 Task 3's deliverable, gated behind Task 2's approval |
| 12 | An async-safe entry point exists that never calls the blocking sync spawn primitive, with an identical failure envelope to `runOne` | VERIFIED | `scripts/huji-run-one-async.cjs` (305 lines) — `runOneAsync` awaits `execFileAsync`, never `spawnSync`; `lib/memory/huji-run-one-async-parity.test.cjs` run live this session: "all checks passed (D14: stageA_nonzero + stageB_nonzero envelopes structurally identical across runOne/runOneAsync)", exit 0 |
| 13 | The shipped batch orchestrator is unaffected; `huji-run-one.cjs`/`huji-batch.cjs` remain byte-for-byte unmodified by 229-10 | VERIFIED | `git log --oneline ee9246b1^..HEAD -- scripts/huji-run-one.cjs scripts/huji-batch.cjs` returns empty (no commits touched either file in the 229-10 range); last real edits to both predate 229-10 (229-09/229-08 commits) |
| 14 | The git-tag-pin mechanism (`claude --plugin-dir` from outside the repo) is verified against a real invocation, not assumed; the external repo's documented v1.15.2 pin is checked against real git history | VERIFIED | `.planning/phases/229-huji-pitch-feedback-module/229-10-PIN-SMOKETEST.md`: live run, verdict RESOLVED, proof of routing via `permission_denials` (Read attempts on `checkout/pipelines/PWS_grading/CHAIN.md`); confirms v1.15.2 does NOT carry the recipe (recipe starts at v1.15.3-beta.22) |

**Score:** 12/14 truths independently VERIFIED. 2 are correctly PENDING — a mandatory, plan-declared human checkpoint (`checkpoint:human-verify`, `gate="blocking"`), not a gap discovered by this run.

### Critical Finding Remediation (229-REVIEW.md CR-01)

| Finding | File:Line | Status | Evidence |
|---------|-----------|--------|----------|
| CR-01: unsanitized `subId` (JSDoc-documented "untrusted external input") interpolated directly into `path.join()`, allowing directory-traversal writes | `scripts/huji-run-one-async.cjs:167,195,199-202` | **FIXED, confirmed live** | Commit `955e8954` ("fix(229-10): reject path-traversal subId in runOneAsync (CR-01)") adds `const SAFE_SUB_ID = /^[A-Za-z0-9_-]{1,128}$/;` gate at line 201-202. Live-tested this session: `runOneAsync({ subId: '../../../../tmp/pwn', ... })` returns `{"ok":false,"reason":"invalid_subId"}` — traversal rejected before any filesystem write. D14 parity test and full `run-all-229.sh` re-run PASS=10/FAIL=0 after the fix. |

The three Warnings (WR-01 re-entrancy, WR-02 residual sync FS calls, WR-03 temp-dir cleanup on exception) and five Info items from 229-REVIEW.md remain open but are non-blocking per the review's own severity classification, and were correctly not claimed as fixed by 229-10-SUMMARY.md.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/pitch-feedback-schemas.cjs` | zod contracts + JSON Schema emitter | VERIFIED | 296 lines, exports match |
| `scripts/huji-eval.cjs` | code checks + judge spawner + calibration protocol | VERIFIED | 1158 lines, exercised live |
| `tests/run-all-229.sh` | D1-D10+D14 aggregator | VERIFIED | ran live: PASS=10 FAIL=0 SKIP=0 |
| `lib/core/recipe-maps.cjs` + `pipelines/PWS_grading/CHAIN.md` | named recipe resolution | VERIFIED | present, `PWS_grading` key confirmed |
| `references/methodology/huji-stage-a-intake.md` + `scripts/huji-intake.cjs` | Stage A adapter | VERIFIED | present, `populateRoom` exported |
| `scripts/huji-run-one.cjs` | single-submission runner | VERIFIED | 662 lines, `runOne`/`scaffoldScratchRoom` exported |
| `scripts/huji-batch.cjs` | batch orchestrator | VERIFIED | 821 lines, `runBatch` exported, D10 leg passed live |
| `demo/feedback-sample-1.md`, `demo/feedback-sample-2.md` | gate-clean demo artifacts | VERIFIED | both present, both gate-clean per DEMO-VERDICT.md |
| `demo/DEMO-VERDICT.md` | Amnon's verdict + Jonathan sign-off | **PARTIAL** | file exists; pipeline-output section (Task 1) complete; Section 4 (human verdict) explicitly marked `(pending)` |
| `calibration-workshop.md` | TA blind-comparison + tiering | **MISSING (expected)** | not on disk — this is Task 3's own deliverable, gated behind Task 2 approval; matches 229-09-PLAN.md's `checkpoint:human-verify` task design, not a build defect |
| `scripts/huji-run-one-async.cjs` | CASCADE-06 async twin | VERIFIED | 305 lines, CR-01 fix present and live-tested |
| `lib/memory/huji-run-one-async-parity.test.cjs` | D14 parity gate | VERIFIED | ran live, exit 0, both fixtures pass |
| `scripts/huji-pin-smoketest.cjs` + `229-10-PIN-SMOKETEST.md` | live pin verification | VERIFIED | real findings on disk, verdict RESOLVED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tests/run-all-229.sh` | `scripts/huji-eval.cjs` | run_if guarded legs | WIRED | confirmed by live run |
| `scripts/huji-eval.cjs` | `lib/core/part8-egress-guard.cjs` | require classify/scanForContent (D4) | WIRED | `scripts/huji-run-one.cjs:65` requires it; G3 gate uses `verdict.verdict === 'block'` |
| `scripts/huji-batch.cjs` | `scripts/huji-run-one.cjs runOne` | pool calls runOne per submission | WIRED | confirmed unmodified import; D10 leg exercised it live |
| `lib/memory/huji-run-one-async-parity.test.cjs` | `scripts/huji-run-one-async.cjs` | require + envelope-shape assertions | WIRED | ran live, both Stage A/B injected-failure fixtures pass |
| `scripts/huji-run-one-async.cjs` | `scripts/huji-run-one.cjs` | reuse-before-build require of exported helpers | WIRED | `scaffoldScratchRoom, buildStageAPrompt, buildStageAArgs, buildStageBArgs, parseEnvelope, renderFeedbackMarkdown, runGuardrails, resolveConfig` all required, none re-implemented |
| demo artifacts (approved) | `rubric-huji.md` few-shot slot | static anchor embedding | **NOT YET WIRED (expected)** | rubric-huji.md Section 5: "(Anchors pending demo approval - Plan 09.)" — correctly gated on Task 2 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase aggregator | `bash tests/run-all-229.sh` | `Phase 229: PASS=10 FAIL=0 SKIP=0` | PASS |
| D14 parity gate standalone | `node lib/memory/huji-run-one-async-parity.test.cjs` | exit 0, both fixtures pass | PASS |
| CR-01 traversal-rejection (manual) | `runOneAsync({subId:'../../../../tmp/pwn',...})` | `{"ok":false,"reason":"invalid_subId"}` | PASS |
| `huji-run-one.cjs`/`huji-batch.cjs` untouched by 229-10 | `git log --oneline ee9246b1^..HEAD -- scripts/huji-run-one.cjs scripts/huji-batch.cjs` | empty output | PASS |
| Commit `955e8954` (CR-01 fix) present in history | `git show 955e8954 --stat` | commit found, diff matches described fix | PASS |

### Requirements Coverage

No REQUIREMENTS.md REQ-IDs are mapped to Phase 229 (confirmed: `grep -n "229" .planning/REQUIREMENTS.md` returns nothing) — this is a net-new business-opportunity phase per the ROADMAP.md phase header, as declared in the task brief. The requirement axis instead is the AI-SPEC D1-D10 (+D14 this session) evaluation dimensions, distributed across plans:

| Dimension | Covered by | Status |
|-----------|-----------|--------|
| D1 (zero fabrication / quote grounding) | 01, 03, 05, 06, 07 | SATISFIED — quote-verifier + G1 gate live-tested |
| D2 (extraction recall) | 01, 02, 03, 05 | SATISFIED — inventory-recall selftest live-tested |
| D3 (cohort drift) | 02, 03, 04, 06, 07, 08 | SATISFIED — drift selftest live-tested |
| D4 (Part 8 hygiene) | 03, 07, 08 | SATISFIED — part8-hygiene selftest live-tested, G3 wired to `part8-egress-guard.cjs` |
| D5 (Minto/schema shape) | 01, 03, 04 | SATISFIED — schema selftest live-tested |
| D6 (formative tone / metacognition) | 06, 09 | SATISFIED (judge) — live calibration recorded in 229-09-SUMMARY.md (Spearman 0.883); human re-rank still required per T-229-06-01, part of the pending checkpoint |
| D7 (course-tier feed-forward) | 04, 06, 09 | PARTIAL — rubric/recipe built and exercised; the tiering feedback loop (calibration workshop) is the pending Task 3 |
| D8 (individuation / similarity ceiling) | 02, 03 | SATISFIED — similarity selftest live-tested |
| D9 (cost adherence) | 01, 03, 07, 08 | SATISFIED — cost-ledger selftest live-tested; real unit costs $1.60/$1.87, under the $4-5 ceiling |
| D10 (kill/resume + cross-bleed) | 02, 07, 08 | SATISFIED — D10 leg live-tested, zero cross-bleed confirmed |
| D14 (async/sync exit-code parity) | 10 (this session) | SATISFIED — parity test live-tested |
| D11, D12, D13, D15 | none (by design) | OUT OF SCOPE for this phase — explicitly deferred to the separate `mindrian-pitch-feedback-mcp` repo per navigator ruling in DR-FRAMEWORK-ARCHITECTURE-DECISION.md ("Wave 6 ... scoped down ... after the navigator moved MCP tool registration/job registry/guardrails G7-G10 to a separate standalone repo"). Confirmed present in 229-AI-SPEC.md as the v1.1-addition dimensions for the MCP delivery seam, not this phase's build. No orphaned requirement — they are a documented, deliberate scope boundary, not something 229's plans silently dropped. |

No orphaned requirement IDs found: every D1-D10 dimension traces to at least one plan; D14 traces to 229-10; D11/D12/D13/D15 trace to an explicit, documented deferral, not silence.

### Anti-Patterns Found

None. Scanned all files touched by 229-09 and 229-10 (`scripts/huji-run-one-async.cjs`, `lib/memory/huji-run-one-async-parity.test.cjs`, `scripts/huji-pin-smoketest.cjs`, `tests/run-all-229.sh`, `references/methodology/rubric-huji.md`, `pipelines/PWS_grading/04-structure-argument.md`, `lib/core/pitch-feedback-schemas.cjs`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and "not yet implemented" style phrases — zero matches. The one Critical finding from the phase's own code review (CR-01) is fixed and independently confirmed live above; the three Warnings and five Info items are documented, non-blocking, and correctly not claimed as resolved.

### Human Verification Required

### 1. Amnon Dekel's "better than a TA" verdict

**Test:** Hand `demo/feedback-sample-1.md` and `demo/feedback-sample-2.md` to Amnon Dekel; ask the single acceptance question.
**Expected:** His verbatim verdict recorded in `demo/DEMO-VERDICT.md` Section 4.
**Why human:** The phase goal statement itself names this "a mandatory human calibration checkpoint" — a subjective quality judgment. 229-09-PLAN.md Task 2 is declared `type="checkpoint:human-verify" gate="blocking"` and `autonomous: false`; the executor explicitly could not start it.

### 2. Jonathan's inventory confirmation and sampling-pass sign-off

**Test:** Confirm the two labeled inventories (`eval/labeled-inventories/*.json`) match the samples; flip `_label_status` to human-confirmed; run the pre-delivery sampling-pass doctrine over the two artifacts.
**Expected:** Both sign-offs recorded in `demo/DEMO-VERDICT.md` Section 4.
**Why human:** Same blocking checkpoint (229-09 Task 2).

### 3. HUJI calibration workshop

**Test:** Facilitate the workshop with Amnon + the HUJI TA team; tier the ten validation questions to course depth; run the n>=10 TA blind comparison; capture results in `calibration-workshop.md`; feed the tiering back into `rubric-huji.md` before any 200-student batch.
**Expected:** `calibration-workshop.md` exists with tiering + comparison results; `rubric-huji.md` updated.
**Why human:** 229-09-PLAN.md Task 3, also `checkpoint:human-verify gate="blocking"`, requires facilitation with external HUJI stakeholders that cannot be automated.

### 4. Embed approved anchors + git-tag before batch scale

**Test:** On Amnon's approval, embed the two approved artifacts into `rubric-huji.md` Section 5 (currently intentionally empty); git-tag the checkout before the first real 200-student batch.
**Expected:** Section 5 filled with the two approved samples; a git tag exists at the approved commit.
**Why human:** Gated on the Task 2 approval above (229-09 Task 3's closing step) — cannot happen before the human verdict lands, and is also flagged in 229-10-SUMMARY.md as the prerequisite the external `mindrian-pitch-feedback-mcp` repo is waiting on for a non-stale pin.

### Gaps Summary

No code-level gaps were found. All ten wave-1-through-6 plans (229-01 through 229-10) have their declared artifacts on disk, substantive (not stubs), and wired — independently re-confirmed in this session by running `bash tests/run-all-229.sh` live (PASS=10 FAIL=0 SKIP=0, not just read from a prior SUMMARY), by running `lib/memory/huji-run-one-async-parity.test.cjs` live, and by live-testing the CR-01 security fix with an actual malicious `subId`. The phase's stated goal explicitly includes "a mandatory human calibration checkpoint" as a deliverable component, and that checkpoint (Amnon's verdict, Jonathan's sign-offs, and the HUJI calibration workshop) has not yet occurred — this is documented as pending in the phase's own artifacts (demo/DEMO-VERDICT.md Section 4, 229-09-SUMMARY.md) and is structurally a blocking human-verify checkpoint (`autonomous: false`), not something the executor skipped or a defect this verification run discovered. Status is therefore `human_needed`: proceed to the human checkpoint, not to further automated remediation.

---

*Verified: 2026-07-16T13:01:26Z*
*Verifier: Claude (gsd-verifier)*
