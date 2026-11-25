---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 08
subsystem: decision-advisor
tags: [cynefin, gate-card, room-db, identity, suggest-next, part-8, part-9]

requires:
  - phase: 400-05
    provides: CAUSE_EFFECT_DOMAINS and isCauseEffectDomain in lib/core/problem-axes.cjs; data/cynefin-domains.json with the card block
  - phase: 345-07
    provides: the strategy-card precedent (kind, builder module, ratify soft step)
provides:
  - identity key problem.cause_effect with one writer and one reader (lib/core/navigation/cause-effect.cjs)
  - navigation.writeCauseEffect, readCauseEffect, readCauseEffectForRoom re-exports
  - gate card kind cause_effect_domain (lib/core/cause-effect-card.cjs) on gate_render and gate_answer
  - gate_answer reply key cause_effect (only for this kind)
  - suggest_next reply key cause_effect {state, domain, verb_order, how_to}
affects: [400-09, 400-10, 400-12, 400-14]

tech-stack:
  added: []
  patterns:
    - "A gate card kind with a server-side option normalizer: the caller names the ids, the server sets the question and the labels"
    - "An identity key owned by one navigation submodule, written only inside the gate_answer transaction"

key-files:
  created:
    - lib/core/navigation/cause-effect.cjs
    - lib/core/cause-effect-card.cjs
    - tests/test-400-domain-store.cjs
    - tests/test-400-domain-gate.cjs
    - tests/test-400-domain-suggest-next.cjs
  modified:
    - lib/core/navigation.cjs
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/sensors.cjs
    - .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml
    - tests/run-all-400.sh

key-decisions:
  - "A cause_effect_domain gate keeps no approving list: every option is an answer, so an approving list would refuse every reject and defer (verdict_chosen_mismatch)."
  - "The stored value is JSON with updated_at in epoch ms; the identity row keeps its ISO updated_at column."
  - "Q3 (no room) is proven at the function level: the MCP read resolver always floors to a directory, so suggest_next sees no room only as an empty room dir, the goal_job idiom."

requirements-completed: [CY-03]

duration: 20min
completed: 2026-11-24
---

# Phase 400 Plan 08: The navigator sets the room's cause and effect domain on a gate card Summary

A two-stage gate card of kind cause_effect_domain (4 options, then 2) lets the navigator set the room's Cynefin domain. An approve writes identity key problem.cause_effect through one navigation submodule inside the gate_answer transaction. suggest_next shows the state and the fixed card steps.

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-24T10:27:00Z
- **Completed:** 2026-11-24T10:47:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- lib/core/navigation/cause-effect.cjs is the one owner of problem.cause_effect. writeCauseEffect validates the domain with isCauseEffectDomain and upserts with the memory-ops setIdentity shape. The caller owns the transaction. readCauseEffect refuses invalid JSON, unknown domains and non-navigator sources. readCauseEffectForRoom uses the read-only door of spine-events.cjs and never creates room.db.
- aliases.yml registers problem_cause_effect (EXTEND identity, source_phase 400, Part 9) in the same commit as the module.
- lib/core/cause-effect-card.cjs reads the card block of data/cynefin-domains.json. normalizeOptions accepts exactly the stage-1 or the stage-2 id set, in any order, and replaces the header and the labels. answerFor maps one id to its domain or to stage 2 (ce-nobody). ratifyCauseEffect writes only on approve.
- gate.cjs (47 lines added, 0 deleted against base c1e496ae8): gate_render normalizes a cause_effect_domain card after the approving check and before detectClientCapabilities, else refuses bad_cause_effect_options with no mint. _applyRatification runs the soft step gate_ratify_cause_effect inside the approve branch, after the strategy-card block. Reject and defer of this kind give {ok: true, written: false}. The reply carries cause_effect only for this kind.
- sensors.cjs (40 lines added, 0 deleted): causeEffectFor(roomDir) beside goalJobFor; the reply key cause_effect follows goal_job; _internal.causeEffectFor is exposed for the test.

## Task Commits

1. **Task 1: The room-level store (CY-03)** - RED `4b3c32a0a` (test), GREEN `8543c0c46` (feat)
2. **Task 2: The two-stage card and its gate wiring (CY-03)** - RED `1bf240300` (test), GREEN `b7450bd12` (feat)
3. **Task 3: suggest_next carries the domain state (CY-03)** - RED `fd7667cb2` (test), GREEN `8d046c78b` (feat)

## Files Created/Modified

- `lib/core/navigation/cause-effect.cjs` - KEY, writeCauseEffect, readCauseEffect, readCauseEffectForRoom
- `lib/core/cause-effect-card.cjs` - CARD_KIND, isCauseEffectCard, normalizeOptions, answerFor, ratifyCauseEffect, howToSentences
- `lib/core/navigation.cjs` - 3 lazy re-exports and 1 comment line
- `lib/mcp/tools/gate.cjs` - additive: the require, the gate_render normalizer, the soft step, the reject or defer result, the reply key
- `lib/mcp/tools/sensors.cjs` - additive: _verbOrderOf, causeEffectFor, the reply key, the _internal export
- `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` - the problem_cause_effect entry
- `tests/test-400-domain-store.cjs` - legs N1 to N7
- `tests/test-400-domain-gate.cjs` - legs G1 to G9
- `tests/test-400-domain-suggest-next.cjs` - legs Q1 to Q5
- `tests/run-all-400.sh` - runs the 3 new tests after test-400-labels-only-domain.cjs

## Decisions Made

- No approving list on a cause_effect_domain gate (see Deviations 1).
- The stored JSON value carries updated_at as an integer (epoch ms), so leg N1 reads an integer; the identity row keeps the ISO text column that every identity row has.
- The how_to sentences name the closed-dialog case as card_pending (the reply gate_answer gives for a dismissed dialog) and the inline-dialog case as unknown_gate, the same two cases GOAL_JOB_STEPS names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] No approving list on the cause_effect_domain gate**
- **Found during:** Task 2
- **Issue:** The plan sets approvingIds to the normalized approving list (every option id). gate-render checkVerdictAgainstApproving refuses a reject or defer that names an approving id (verdict_chosen_mismatch), and gate_answer needs at least 1 chosen id from the card. So every reject and defer would be refused, and the plan's reject or defer result {ok: true, written: false} could never reach a reply. An approve check is empty when every id approves.
- **Fix:** gate_render sets approvingIds to null for this kind (caller approving is ignored). normalizeOptions still returns approving (leg G1). The strategy card has no approving list either (precedent).
- **Files modified:** lib/mcp/tools/gate.cjs
- **Commit:** b7450bd12

**2. [Rule 3 - Blocking] Test harness binding**
- **Found during:** Task 2
- **Issue:** The test-345-gate-ratify.cjs harness (fallbackRoomDir only) now gets no_bound_room from gate_answer; that file fails at base for this reason.
- **Fix:** test-400-domain-gate.cjs uses the test-399-selection-log.cjs harness (CLAUDE_ACTIVE_ROOM set to the scratch room, no session id, surface cli).
- **Files modified:** tests/test-400-domain-gate.cjs
- **Commit:** 1bf240300

**3. [Rule 3 - Blocking] Q3 has no reachable no-room reply**
- **Found during:** Task 3
- **Issue:** resolveMcpSessionRoom floors to process.cwd() when nothing is bound, so suggest_next always has a room dir.
- **Fix:** Q3 proves causeEffectFor returns undefined for an empty room dir and that the reply drops the key; a directory with no room.db gives not_set and creates no file.
- **Files modified:** tests/test-400-domain-suggest-next.cjs
- **Commit:** fd7667cb2

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking).
**Impact on plan:** The approving change keeps reject and defer recordable (Decision 13, rejection is data). No scope change.

## Base Exit Codes (recorded before each edit)

- test-345-gate-ratify.cjs: 1 at base, 1 after, identical output (no_bound_room on its approve leg, unrelated).
- test-345-gate-anchor.cjs: 0 at base, 0 after.
- check-shape-declaration.cjs --check: 0 at base, 0 after, identical WARN lines.
- 107 tests that name gate_answer, gate.cjs or gate-render: 15 fail after the gate edit; each of the 15 gives the same exit code with the base gate.cjs (test-198-contract-schema, test-237-autonomy-parity, test-237-approve-executes, test-345-gate-ratify, test-289-contract-recommended, test-3551-tri-polar, test-369.26-review-answer 124, test-365-never-do-gate, test-365-floor-gate, test-369-shared-core, test-369-writer-inventory, test-369.26-source-guards 77, test-369-shell-actions 77, test-mux-card-before-answer, test-395-job-shown). test-369-writer-inventory names only scripts/eureka-portfolio-calibrate.cjs.
- 34 tests that name suggest_next or sensors.cjs: 8 fail after the sensors edit; each gives the same exit code with the base sensors.cjs, and 5 checked have the same count of failure lines.
- Q5 tests (test-c8j-suggest-next-offer, test-399-selector-advisor, test-sensors-part8-sweep, test-sensors-routing-fence): 0 at base, 0 after.

## Issues Encountered

- The RED commit of Task 3 first held a literal en dash and em dash inside a regex. The commit was amended before any other commit to use escape sequences.

## Known Stubs

None.

## Threat Flags

None. T-400-18 to T-400-20 are mitigated by legs G1, G7, N3, G4 to G6 and N6.

## User Setup Required

None.

## Next Phase Readiness

- Plan 400-09 and later can read the domain with navigation.readCauseEffectForRoom (a read-only door, no require cycle) and the verb order from data/cynefin-domains.json.
- The Brain packet builder does not read the key (leg N6).

## Self-Check: PASSED

- 5 created files found; 6 task commits found (4b3c32a0a, 8543c0c46, 1bf240300, b7450bd12, fd7667cb2, 8d046c78b).
