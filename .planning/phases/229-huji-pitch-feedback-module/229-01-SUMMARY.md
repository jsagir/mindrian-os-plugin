---
phase: 229-huji-pitch-feedback-module
plan: 01
subsystem: api
tags: [zod, json-schema, structured-outputs, minto, claimify, recipe-maps, pipeline, part8]

# Dependency graph
requires:
  - phase: 229-huji-pitch-feedback-module
    provides: AI-SPEC Section 4b schema shapes, RESEARCH call sites, CONTEXT navigator rulings
provides:
  - "EvidenceSchema + FeedbackResultSchema (single zod source) with quote anchors, evidenced enum, Minto 2-3 branch shape"
  - "toJsonSchemas() emitter generating evidence.schema.json + feedback-result.schema.json from the one zod source via zod/v4 toJSONSchema"
  - "CONTRACTS.md resolving all 5 Wave-0 open questions (PIPELINE_ARG, INTAKE_PATH, SCORED_MODE, AUTH_PATH, RECIPE_HOME) with file:line evidence"
  - "Proven headless intake path: navigation.writeClaimNode against a scratch room.db (writer-spike passed)"
affects: [229-04-intake-adapter, 229-05-recipe-and-scored-mode, 229-07-batch-orchestrator, 229-08-eval-harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single zod source of truth -> JSON Schema serialization via require('zod/v4').z.toJSONSchema (no hand-written JSON Schema)"
    - "Bounded free-text schema fields (.max) so feedback LENGTH is a contract (anti-fabrication T-229-01-01)"
    - "Wave-0 CONTRACTS.md: empirically-resolved open questions with DECISION/EVIDENCE(file:line)/CONSUMED-BY blocks"

key-files:
  created:
    - lib/core/pitch-feedback-schemas.cjs
    - .planning/phases/229-huji-pitch-feedback-module/schemas/evidence.schema.json
    - .planning/phases/229-huji-pitch-feedback-module/schemas/feedback-result.schema.json
    - .planning/phases/229-huji-pitch-feedback-module/CONTRACTS.md
  modified: []

key-decisions:
  - "Schemas defined with zod/v4 (not classic zod) so z.toJSONSchema serializes the same source directly"
  - "PWS_grading resolves via pipelines/PWS_grading/CHAIN.md AND a recipe-maps NAMED_RECIPES registration (two resolvers, both needed)"
  - "Intake drives navigation.writeClaimNode directly, bypassing the F.8-HITL /mos:file-meeting (proven by writer-spike)"
  - "6/10 build-thesis gate neutralized at rubric/prompt layer (rubric-huji.md primary, build-thesis-scored.md fallback), never a code fork"
  - "Two-stage auth: Stage A --bare + ANTHROPIC_API_KEY; Stage B --plugin-dir + keychain"

patterns-established:
  - "Belt-and-suspenders validation: same zod schema -> CLI --json-schema + orchestrator safeParse"
  - "Recipe name PWS_grading is the sole invocable identifier; pitch-feedback is only a directory label"

requirements-completed: [D1, D2, D5, D9]

# Metrics
duration: ~50min
completed: 2026-07-16
---

# Phase 229 Plan 01: Pipeline Contracts and Wave-0 Resolutions Summary

**Two zod contracts (quote-anchored EvidenceSchema in, Minto FeedbackResultSchema out) generating their JSON Schema serializations from one source, plus CONTRACTS.md settling all 5 Wave-0 open questions with file:line evidence and a passing headless writer-spike.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-07-15T20:15Z (approx)
- **Completed:** 2026-07-15T21:06Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- `EvidenceSchema` (Stage A anti-hallucination anchor): every claim carries its verbatim `quote`; `evidenced` enum locked to `['evidenced','asserted','absent']`; `problem_claim.timestamp` accepts `M:SS` or `null` and rejects prose; `self_identified_gaps` captured so metacognition is rewarded, never double-punished.
- `FeedbackResultSchema` (Stage B Minto contract): `governing_thought` first (min 20 chars), 2-3 MECE `branches` each = point + support(>=1) + one `teachable_next_step`, `scores` 0-100, `model_id` provenance, `calibration_source` enum for Part 8 audit. Free-text fields bounded with `.max()` so a 2-minute pitch cannot draw a 4,000-word pyramid.
- `toJsonSchemas()` emits both `.schema.json` files from the single zod source via `require('zod/v4').z.toJSONSchema` (verified to resolve under CJS) - no hand-written JSON Schema drift.
- Deterministic `require.main` self-test asserts all pinned behaviors and regenerates the schemas; passes clean.
- CONTRACTS.md resolves all 5 Wave-0 open questions empirically (not guessed), each with a DECISION / EVIDENCE(file:line) / CONSUMED-BY block, unblocking the downstream intake / recipe / orchestrator / eval plans.
- Ran a live writer-spike proving `navigation.writeClaimNode(openRoomDb(scratchRoom), params)` persists typed claim nodes (`review_status='proposed'`) against a freshly scaffolded scratch `room.db` - confirming the intake adapter can run headlessly without the interactive `/mos:file-meeting` HITL.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author evidence + feedback zod schemas and emit JSON Schema (tdd)** - `71b9cc64` (feat, source module + self-test) and `6cded4e3` (feat, generated JSON Schema artifacts)
2. **Task 2: Resolve the 5 Wave-0 open questions into CONTRACTS.md** - `495c8b30` (docs)

_Note: Task 1 self-test (RED/GREEN) is embedded in the module's `require.main` block per the plan action; the schema JSON artifacts were committed separately from the source per repo convention._

## Files Created/Modified
- `lib/core/pitch-feedback-schemas.cjs` - The single zod source: EvidenceSchema, FeedbackResultSchema, toJsonSchemas() emitter, BOUNDS export, deterministic self-test.
- `.planning/phases/229-huji-pitch-feedback-module/schemas/evidence.schema.json` - Stage A `--json-schema` extraction contract (generated).
- `.planning/phases/229-huji-pitch-feedback-module/schemas/feedback-result.schema.json` - Stage B result-envelope contract (generated).
- `.planning/phases/229-huji-pitch-feedback-module/CONTRACTS.md` - Wave-0 decision blocks for PIPELINE_ARG, INTAKE_PATH, SCORED_MODE, AUTH_PATH, RECIPE_HOME.

## Decisions Made
- **zod/v4 for definition, not classic zod.** Defining the schemas with `require('zod/v4')` lets `z.toJSONSchema` serialize the exact same objects; classic `require('zod')` schemas would need a separate v4 re-declaration. safeParse behaves identically for the orchestrator layer.
- **PWS_grading needs two homes.** `/mos:pipeline <name>` resolves named pipelines via `pipelines/<name>/CHAIN.md` + numbered stage contracts (a different resolver from the SENS-10 recipe-maps path). So PWS_grading gets both a `pipelines/PWS_grading/` chain dir (the shipped resolver runs it) and a `NAMED_RECIPES` registration (the order/posture authority the CHAIN.md mirrors).
- **Intake bypasses the interactive command.** `/mos:file-meeting` carries an F.8 nugget-routing HITL and `AskUserQuestion` - it would block a `dontAsk` session. The Claimify WRITER is a plain function, proven callable against a scratch room.db, so the adapter reuses the machinery without the shell.
- **6/10 gate is prompt-level.** Neutralize at the rubric/prompt layer (rubric-huji.md via `--append-system-prompt-file` primary; build-thesis-scored.md fallback); the demo run decides. Never a code fork (breaks frozen-prefix cache) and never a CLI flag (commands are markdown).

## Deviations from Plan

None - plan executed exactly as written. The two Task-1 commits (source, then generated artifacts) are a commit-granularity choice to match the repo convention that generated `.planning` artifacts are tracked separately via `git add -f`, not a scope deviation.

## Issues Encountered
- `.planning/` is gitignored at line 66 of `.gitignore`, yet 2198 phase artifacts (including phase 229's PLAN/CONTEXT/RESEARCH/AI-SPEC) are already tracked. Resolved by following the established repo convention (CLAUDE.md: "`.planning/` is gitignored, so `git add -f`") - the schema JSONs and CONTRACTS.md were force-added so downstream plans read them from a committed source, consistent with every prior phase.
- `.planning/STATE.md` is 885KB and exceeds the read cap; state reads/writes go through `gsd-tools query` handlers rather than a direct file read.

## User Setup Required
None - no external service configuration required. No packages installed (zod already vendored; RESEARCH Package Legitimacy Audit = none required).

## Next Phase Readiness
- Downstream plans build against settled contracts: the intake adapter (seam b) has a proven `writeClaimNode` path and the evidence schema; the recipe plan (seams c/d) has the RECIPE_HOME + SCORED_MODE + PIPELINE_ARG decisions; the orchestrator (seam e) has AUTH_PATH and the invocation string; the eval harness has both JSON Schema files for its schema leg.
- Open, testable-at-demo item flagged for the recipe plan: whether `rubric-huji.md` alone stops build-thesis's prompt-level 6/10 halt (fallback documented).

## Self-Check: PASSED

- All 5 created files present on disk (source module, 2 JSON Schemas, CONTRACTS.md, SUMMARY.md).
- All 3 task commits present in git history (71b9cc64, 6cded4e3, 495c8b30).
- Schema self-test re-run green.

---
*Phase: 229-huji-pitch-feedback-module*
*Completed: 2026-07-16*
