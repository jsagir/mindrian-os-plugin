---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 05
subsystem: infra
tags: [mcp, node-insert, typed-claim, gate, navigator-decision, claim-write]

# Dependency graph
requires:
  - phase: 273
    provides: "node-insert.cjs single node-write chokepoint, ALLOWED_EPISTEMIC_TYPES fail-closed gate"
provides:
  - "Ratified navigator ruling on the three-vocabulary collision (EPISTEMIC_LEVELS / ALLOWED_EPISTEMIC_TYPES / KNOWLEDGE_TYPES): mapping table placement is typed-claim.cjs, operator-cap comparison deferred to 276-16"
  - "A proposed (not-yet-ratified) knowledge_type -> epistemic_type mapping table, one row per KNOWLEDGE_TYPES member, pinned by 276-12's test"
  - "Ratified navigator ruling on the claim_write MCP surface: one tool, home lib/mcp/tools/claim.cjs, writes at proposed through node-insert.cjs, gate_answer promotes"
  - "Six D-276-1..D-276-6 dispositions of record restated so no later plan re-opens them"
affects: [276-12, 276-14, 276-16]

# Tech tracking
tech-stack:
  added: []
  patterns: ["decisions-file navigator-gate shape (270-DECISIONS.md precedent), verbatim-quote ruling capture"]

key-files:
  created:
    - .planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-DECISIONS.md
  modified: []

key-decisions:
  - "OQ-276-1: navigator selected b+d - mapping table lives in typed-claim.cjs (not node-insert.cjs), operator-cap comparison is a named follow-up owned by 276-16, not built in this phase"
  - "OQ-276-1 mapping table content (fact->extracted_fact, causal->derived_fact, heuristic->interpretation, anomaly_cue->observation, mental_model->model_derived_assertion, assumption->assumption) is executor-proposed, marked status: proposed, NOT navigator-ratified - only placement and scope were ratified"
  - "OQ-276-2: navigator selected option a - one tool, claim_write, home lib/mcp/tools/claim.cjs (minted by 276-12), writes at review_status proposed through typed-claim.cjs -> node-insert.cjs only, gate_answer approve branch promotes to confirmed"

requirements-completed: [TOOLHON-07]

# Metrics
duration: 4min
completed: 2026-09-03
---

# Phase 276 Plan 05: MCP Tool Honesty Navigator Decisions Summary

**Navigator ruled both blocking questions gating the meeting-claim MCP write path: the knowledge_type-to-epistemic_type mapping lives in typed-claim.cjs (not the generic node-insert.cjs gate) with the operator-cap comparison deferred to 276-16, and claim_write ships as a single MCP tool that files at `proposed` with promotion routed through the existing gate_answer approve branch.**

## Performance

- **Duration:** ~4 min (this continuation session's execution time; excludes the navigator's own decision-making time between the prior executor's checkpoint and this session's resume)
- **Started:** 2026-09-03T17:58:17Z (prep commit `ded55c17`, prior session)
- **Completed:** 2026-09-03T18:01:56Z (ratify commit `26083bac`, this session)
- **Tasks:** 3 (prep task + 2 checkpoint:decision tasks, presented by a prior executor; Task 3 executed and closed by this session)
- **Files modified:** 2 (`276-DECISIONS.md` ratified; `276-05-SUMMARY.md` created)

## Accomplishments
- OQ-276-1 (the three-vocabulary collision between `EPISTEMIC_LEVELS`, `ALLOWED_EPISTEMIC_TYPES`, and `KNOWLEDGE_TYPES`) ruled: mapping placement is `typed-claim.cjs`, scope is knowledge_type-to-epistemic_type only, cap-comparison named as a 276-16 follow-up
- OQ-276-2 (the `claim_write` MCP surface shape and gate placement) ruled: one tool, write-then-gate, `gate_answer` promotes
- A proposed (executor-derived, not navigator-ratified) mapping table written to unblock plan 276-12's implementation, correctly labeled as proposed per the navigator's explicit instruction not to present it as ratified
- Six already-locked D-276-1..D-276-6 dispositions restated as dispositions of record, none re-opened

## Task Commits

1. **Prep: Draft 276-DECISIONS.md with both questions, all options, empty ANSWER slots** - `ded55c17` (docs, prior session)
2. **Task 1: OQ-276-1 checkpoint:decision** - presented by prior executor, no file write (decision-only task, ruled by navigator between sessions)
3. **Task 2: OQ-276-2 checkpoint:decision** - presented by prior executor, no file write (decision-only task, ruled by navigator between sessions)
4. **Task 3: write the ratified 276-DECISIONS.md** - `26083bac` (docs)

**Plan metadata:** this commit (docs: complete plan, includes this SUMMARY.md, STATE.md, ROADMAP.md)

## Files Created/Modified
- `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-DECISIONS.md` - flipped `status: draft` to `ratified`, filled both OQ ANSWER sections with the navigator's verbatim ruling, added the proposed knowledge_type -> epistemic_type mapping table, restated the six dispositions of record and the assumption ledger

## Decisions Made
- OQ-276-1: b+d (mapping at the claim writer, cap-comparison deferred to 276-16) - see key-decisions above and the file's `## OQ-276-1 ANSWER` section for the full verbatim ruling
- OQ-276-2: a (one tool, write-then-gate) - see key-decisions above and the file's `## OQ-276-2 ANSWER` section for the full verbatim ruling
- The mapping table's row content was NOT dictated by the navigator; it is recorded as executor-proposed and explicitly marked `status: proposed`, per the navigator's instruction, confirmable at 276-16's human verification rather than presented as ratified now

## Deviations from Plan

None - plan executed exactly as written. Task 3's `action` block explicitly anticipated that the navigator might rule placement/scope without dictating the row-by-row mapping table, and the plan's own acceptance criteria ("if a mapping was ruled") accommodates recording an executor-derived table; this is not a deviation, it is the plan's designed path.

## Issues Encountered
None. Verified `ded55c17` and its prior draft content from git before proceeding (resume_instructions step 1), confirmed the shared working tree's pre-existing modifications (`scripts/__pycache__/compute-hsi.cpython-312.pyc`, six deleted persona fixtures) were untouched by this plan, staged exactly one file (`git diff --cached --name-only` audited before commit), and confirmed no em-dash characters and no `lib/`, `scripts/`, `bin/`, or `tests/` files were touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 276-12 and 276-14 now have a decided contract: `claim_write` (home `lib/mcp/tools/claim.cjs`), the mapping table's placement and scope, and the gate-order ruling
- Plan 276-12 must implement the mapping table at `typed-claim.cjs` per the proposed rows in `276-DECISIONS.md`, pin it with a test, and confirm or revise the row content at 276-16's human verification
- Plan 276-16's close-out must register the operator-cap comparison as a named follow-up, per the navigator's ruling; it is not built in this phase

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*
