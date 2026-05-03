---
phase: 108-graph-memory-schema-reconciliation
plan: "03"
subsystem: graph-memory-schema
tags: [truth-state, review_status, taxonomy, status_aliases, transition-table, auto-stale, transitionStatus, canon-part-9, canon-part-4, canon-part-5, memory_event]

# Dependency graph
requires:
  - phase: 108-graph-memory-schema-reconciliation
    provides: "108-00 RECONCILE-108-04 requirement scaffolded; tests/test-truth-state-taxonomy.cjs Wave-0 stub registered in Feynman runner"
  - phase: 108-graph-memory-schema-reconciliation
    provides: "108-01 RECONCILIATION.md (assumption row marked EXTEND; 8-state taxonomy is the EXTEND mechanism)"
  - phase: 108-graph-memory-schema-reconciliation
    provides: "108-02 PROVENANCE.md (review_status field declared; this plan defines its 8 valid values)"
provides:
  - "Closed 8-state truth-state taxonomy (proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated)"
  - "9-row state transition table with triggers + Canon Part 5 evidence requirements per transition"
  - "4 forbidden transitions enumerated (rejected terminal; stale must regress through proposed; needs_evidence cannot directly invalidate; nothing regresses to proposed)"
  - "status_aliases mapping reconciling existing assumptions.validity 4-state enum (untested -> proposed, supported -> validated, contradicted -> invalidated, stale -> stale)"
  - "Auto-stale rule contract (90-day default, edges-not-touched window, confirmed/validated only, 4 staleable node types: claim/assumption/decision/opportunity)"
  - "transitionStatus(nodeId, fromStatus, toStatus, actorId, reason) chokepoint contract for Phase 109"
  - "10-assertion test harness asserting TRUTH-STATES.md content invariants"
affects:
  - 108-04 (aliases.yml machine-readable companion ships status_aliases section verbatim from this taxonomy)
  - 108-05 (pre-commit hook references review_status enum; CREATE-TABLE-level guard scope acknowledged)
  - 109 (sql-spine implements review_status column, transition function, auto-stale job)
  - 110 (brain-context-packets enforces brain_insight nodes always start at review_status = 'proposed')

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document-first phase deliverable: TRUTH-STATES.md as authority text + tests/*.cjs as enforcement harness"
    - "Closed-set taxonomy with explicit forbidden-transition table (state machine specification)"
    - "Direct-CJS test pattern (test pattern source: tests/test-cascade-side-channel.cjs); fs.readFileSync + assert.equal/ok"
    - "Chokepoint contract specification for Phase 109 (single-function gate around UPDATE)"

key-files:
  created:
    - .planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md
  modified:
    - tests/test-truth-state-taxonomy.cjs (Wave-0 stub -> 148-line 10-assertion harness)

key-decisions:
  - "8-state set is CLOSED; net-new states require canon amendment (no expansion via plan deviation)"
  - "status_aliases mapping is non-negotiable: untested -> proposed, supported -> validated, contradicted -> invalidated, stale -> stale (per RESEARCH section 4)"
  - "Auto-stale job runs in Phase 109 (NOT Phase 108); Phase 108 documents the rule (90-day default, edges-not-touched, 4 staleable types)"
  - "transitionStatus chokepoint enforces all 9 allowed transitions and refuses the 4 forbidden ones; runtime enforcement is Phase 109 not 108"
  - "Pre-commit hook (Plan 108-05) is a CREATE-TABLE-level guard; runtime status mutations need a different defense (Phase 109 trigger or db.prepare wrapper)"

patterns-established:
  - "TRUTH-STATES.md as canonical state machine spec (states + triggers + transitions + forbidden transitions + auto-rules + chokepoint contract)"
  - "Status aliases reconcile a partial enum via a fixed mapping table (4 mapped, 4 net-new states have no equivalent)"

requirements-completed:
  - RECONCILE-108-04

# Metrics
duration: 30min
completed: 2026-05-03
---

# Phase 108 Plan 03: Truth-State Taxonomy Summary

**Closed 8-state truth-state taxonomy (proposed/confirmed/rejected/stale/superseded/needs_evidence/validated/invalidated) with 9-row transition table, 4 forbidden transitions, status_aliases reconciling memory-ops.cjs:64-74 4-state enum, 90-day auto-stale rule, and transitionStatus chokepoint contract for Phase 109**

## Performance

- **Duration:** 30 min
- **Started:** 2026-05-03T11:16:25Z
- **Completed:** 2026-05-03T11:46:26Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 stub-replaced)

## Accomplishments

- TRUTH-STATES.md ships as the canonical D-03 deliverable: 8-state closed taxonomy with semantic, trigger, evidence requirement per state.
- 9-row transition table documents allowed transitions (proposed -> confirmed, proposed -> needs_evidence, proposed -> rejected, needs_evidence -> validated, confirmed -> validated, validated -> invalidated, confirmed -> superseded, confirmed -> stale, validated -> stale).
- 4 forbidden transitions explicitly enumerated (rejected terminal; stale -> confirmed must regress through proposed; needs_evidence -> invalidated forbidden; no regression to proposed).
- status_aliases section reconciles the existing 4-state assumptions.validity enum (untested -> proposed, supported -> validated, contradicted -> invalidated, stale -> stale identity); the other 4 new states are net-new and have no legacy equivalent.
- Auto-stale rule documented: 90-day default, applies only to confirmed/validated nodes, requires edges-not-touched in same window, restricted to 4 staleable types (claim, assumption, decision, opportunity); excludes 7 fact-about-the-world types (room, folder, artifact, meeting, evidence, entity, Stakeholder).
- transitionStatus(nodeId, fromStatus, toStatus, actorId, reason) chokepoint contract specifies 6-step semantics for Phase 109: verify fromStatus matches current, verify (from,to) is allowed, write memory_event row, update review_status atomically, enforce Canon Part 9 user-only-confirmation, return {ok, event_id} or throw TruthStateViolation.
- Cross-references wire to PROVENANCE.md (review_status field declaration), aliases.yml (machine-readable companion), memory-ops.cjs:64-74 (legacy enum source), Canon Part 5 (evidence tier model), and Canon Part 4 (state transitions are events per memory_event).
- tests/test-truth-state-taxonomy.cjs replaced from 6-line Wave-0 stub to 148-line 10-assertion harness; Feynman runner shows 172/176 pass (zero new failures vs prior 170/176 baseline; the 2-step delta is the new test landing as PASS).

## Task Commits

1. **Task 1: Author TRUTH-STATES.md** - `09eedc4` (feat) - 118 insertions; 8-state taxonomy + transition table + status_aliases + auto-stale + chokepoint contract; em-dash/en-dash audit clean.
2. **Task 2: Fill tests/test-truth-state-taxonomy.cjs** - `b776f73` (test) - 148-line harness; 10/10 PASS, exit 0; Feynman regression check zero new failures (172/176 vs baseline 170/176).

## Files Created/Modified

- `.planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md` - Closed 8-state truth-state taxonomy + transition rules + forbidden transitions + status_aliases mapping + auto-stale rule + transitionStatus chokepoint contract for Phase 109.
- `tests/test-truth-state-taxonomy.cjs` - Stub-to-real replacement; 10 assertions verifying canonical states, alias mappings, transition table, auto-stale rule, staleable types, transitionStatus chokepoint, memory_event reference, Canon Part 5 evidence tier, closed-set framing, em-dash/en-dash absence.

## The 8 States (one-line semantic each)

1. **proposed** - default for any agent-created node (Larry, Brain, sub-agents, hooks).
2. **confirmed** - promoted by human via Decision Gate APPROVE; only state that counts as trusted memory.
3. **rejected** - explicitly declined; reason captured as graph data per Canon Part 4.
4. **stale** - has not been seen or cited in 90 days (default); auto-marked by job.
5. **superseded** - replaced by a newer node; REPLACES edge points to the (confirmed) successor.
6. **needs_evidence** - claim confirmed in principle but lacks Academic/Operational support.
7. **validated** - claim with Academic or Operational evidence attached via SUPPORTS edge.
8. **invalidated** - claim with contradicting Academic or Operational evidence attached via CONTRADICTS edge.

## status_aliases Mappings (existing assumptions.validity -> new review_status)

1. `untested` -> `proposed` (default state for any agent-created assumption).
2. `supported` -> `validated` (supported implies evidence is attached).
3. `contradicted` -> `invalidated` (same semantic; vocabulary consistency rename).
4. `stale` -> `stale` (direct match, no rename).

The 4 net-new states (`confirmed`, `rejected`, `superseded`, `needs_evidence`) have no equivalent in the legacy enum and only apply after Phase 109 migration.

## Auto-Stale Rule Defaults

- Window: 90 days (configurable per room via `room.db` settings).
- Eligible source states: `confirmed` OR `validated`.
- Edge-touch window: no INFORMS / CONTRADICTS / SUPPORTS / etc. edges touched in the same window.
- Staleable node types: `claim`, `assumption`, `decision`, `opportunity` (4 types).
- Excluded from staling: `room`, `folder`, `artifact`, `meeting`, `evidence`, `entity`, `Stakeholder` (facts about the world, not beliefs).
- Job runs as a Phase 109 nightly job (not Phase 108).

## transitionStatus Chokepoint Contract (Phase 109 Implementation)

Signature: `transitionStatus(nodeId, fromStatus, toStatus, actorId, reason)`.

6-step contract:

1. Verify `fromStatus` matches the current `review_status` of the node.
2. Verify the `(fromStatus, toStatus)` tuple is in the allowed transition table.
3. Write a `memory_event` row capturing: `event_type='state_transition'`, `node_id=nodeId`, `from_status=fromStatus`, `to_status=toStatus`, `actor=actorId`, `reason=reason`, `timestamp=NOW()`.
4. Update the node's `review_status` atomically in the same transaction.
5. If `toStatus = 'confirmed'`, verify `actorId` corresponds to a user (Canon Part 9 invariant).
6. Return `{ok: true, event_id}` or throw `TruthStateViolation` with offending detail.

Phase 109 implements; Phase 108 specifies. Direct `UPDATE nodes SET review_status` outside this chokepoint is a Canon Part 9 violation.

## Decisions Made

- **8-state set is CLOSED.** Adding a 9th state requires canon amendment, not plan deviation. The closed-set framing is asserted by the test harness ("explicit framing as a closed set" assertion).
- **status_aliases mapping is fixed.** Per RESEARCH section 4, the 4-mapping resolution is non-negotiable. The 4 net-new states (confirmed/rejected/superseded/needs_evidence) are explicitly called out as having no legacy equivalent.
- **Auto-stale job is Phase 109.** Phase 108 documents the rule; Phase 109 implements the nightly job. The 4 staleable types and 7 excluded types are baked in by this plan.
- **transitionStatus is a CONTRACT, not a script.** Phase 108 specifies the 6-step semantics; Phase 109 ships the implementation. No JavaScript prototype shipped here.
- **Forbidden transitions are explicit.** 4 transitions are enumerated as forbidden (rejected -> anything, stale -> confirmed, needs_evidence -> invalidated, anything -> proposed). This makes Phase 109's enforcement trivially verifiable.

## Deviations from Plan

None - plan executed exactly as written. The TRUTH-STATES.md content matches the verbatim block specified in Task 1; the test harness matches the verbatim block in Task 2.

## Issues Encountered

- **Initial `git add` rejected by .gitignore.** The `.planning/` directory is gitignored project-wide. Resolved by using `git add -f` (matches the pattern used by all prior 108-XX commits including 8dbf321/0a6f0d3/101d7af).
- **Sibling commit landed mid-plan.** Commit `092bfe6 docs(108-04)` from the parallel 108-04 executor landed in git log between Task 1 commit `09eedc4` and Task 2 commit `b776f73`. File scopes were disjoint (108-03 owns TRUTH-STATES.md + tests/test-truth-state-taxonomy.cjs; 108-04 owns aliases.yml + tests/test-aliases-yaml-schema.cjs) so no merge conflict surfaced. This is the expected behavior for Wave-2 parallel execution.

## Authentication Gates

None - no external services touched.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- File present: `.planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md` confirmed via `test -f` returning 0.
- Commit present: `09eedc4` (Task 1 feat commit) confirmed via `git log --oneline -2 | grep 09eedc4`.
- Commit present: `b776f73` (Task 2 test commit) confirmed via `git log --oneline -2 | grep b776f73`.
- Em-dash audit: `grep -P "[\x{2014}\x{2013}]" TRUTH-STATES.md` returned zero matches.
- Test execution: `node tests/test-truth-state-taxonomy.cjs` exited 0 with 10 PASS + 0 FAIL.
- Feynman regression: `node lib/memory/run-feynman-tests.cjs` reports 172/176 (4 pre-existing failures inherited from prior phases; my new test landed as +2 PASS over the prior 170/176 baseline).

## Next Phase Readiness

- TRUTH-STATES.md ready for consumption by Plan 108-04 aliases.yml (status_aliases section reads this taxonomy verbatim).
- TRUTH-STATES.md ready for cross-reference by Plan 108-05 pre-commit hook (review_status enum surface acknowledged as out-of-hook-scope; runtime defense in Phase 109).
- transitionStatus chokepoint contract ready for Phase 109 plan-phase implementation.
- Status aliases mapping ready for Phase 109 SQL migration (read existing assumptions.validity, look up new review_status, write to graph node, log memory_event with `event_type: 'state_alias_migration'`).
- No blockers for Plan 108-05 or Plan 108-06.

## Hand-off to Plan 108-04

Plan 108-04 (aliases.yml) is the machine-readable companion. The status_aliases section in aliases.yml MUST mirror this 4-row mapping (untested -> proposed, supported -> validated, contradicted -> invalidated, stale -> stale). Plan 108-04 ran in parallel (Wave 2, file-disjoint) and landed commit 092bfe6 between this plan's two task commits; cross-validation that aliases.yml status_aliases section matches TRUTH-STATES.md status_aliases table is left for Plan 108-05's pre-commit hook validation work or for the Phase 108 verifier.

---
*Phase: 108-graph-memory-schema-reconciliation*
*Completed: 2026-05-03*
