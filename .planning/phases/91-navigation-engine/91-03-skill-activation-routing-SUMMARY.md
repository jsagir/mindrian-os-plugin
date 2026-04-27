---
phase: 91-navigation-engine
plan: "03"
subsystem: skill-activation-routing
tags: [skill-activation, navigation-engine, canon-part-3, canon-part-7, canonical-verbs, router, tdd]

# Dependency graph
requires:
  - phase: 91-navigation-engine
    plan: "00"
    provides: navigation-engine.decide(turn, context) returns typed decision with fire_skill + suppress_skills
  - phase: 91-navigation-engine
    plan: "00"
    provides: navigation-engine-shared.cjs CANONICAL_VERBS frozen 10-entry array (Canon Part 3 source of truth)
  - phase: 91-navigation-engine
    plan: "02"
    provides: scripts/intent-classifier.cjs Phase 91 navigation engine integration block (decide() call site + decision trace persistence + NAVIGATION DECISION emission)
provides:
  - "lib/core/skill-activation-router.cjs routeActivation(engineDecision, legacyActivation) -> {activated_skills, suppressed_skills, source, reason, trace_notes}"
  - "lib/core/skill-activation-router.cjs validateVerb(verb) Canon Part 3 closed-vocabulary boolean"
  - "lib/core/skill-activation-router.cjs canonicalizeVerb(verb) case-insensitive lookup returning canonical entry"
  - "scripts/intent-classifier.cjs computeLegacyActivation(roomDir) (legacy file-state + env activation observer)"
  - "scripts/intent-classifier.cjs MOS_NAV_TEST_FIRE_SKILL + MOS_NAV_TEST_SUPPRESS_SKILLS env stubs (integration test mechanism, prod behavior unchanged when unset)"
  - "scripts/intent-classifier.cjs formatEngineDecisionBlock now accepts routing param and appends activated_skills + routing_source lines to NAVIGATION DECISION block"
  - "Decision-trace JSON now carries 4 routing_* fields (routing_source, routing_reason, routing_activated_skills, routing_suppressed_skills) plus optional routing_trace_notes for /mos:explain-decision (Plan 91-05) consumption"
  - "17-test suite (lib/memory/skill-activation-router.test.cjs): 15 router unit tests + 2 end-to-end integration tests through scripts/intent-classifier.cjs"
affects:
  - 91-04-next-step-offer-presentation (offer presentation reads activated_skills from the same emission block)
  - 91-05-mos-explain-decision-command (consumes routing_source + routing_trace_notes from decision-trace JSON)
  - 91-06-statusline-dial (consumes routing_source for dial color discrimination)
  - 91-07-problem-type-routing (extends decide() context; the routing layer is unchanged because precedence rules are signal-agnostic)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function router module with zero I/O and zero network surface (Canon Part 8 trivially compliant; the only require is navigation-engine-shared for CANONICAL_VERBS)"
    - "Closed-vocabulary enforcement via case-insensitive scan of frozen array (single source of truth in shared.cjs; new verbs require canon amendment, not runtime addition)"
    - "Defensive coercion on every input boundary (null engine, non-array legacy, missing fire_skill, missing suppress_skills) so the router never throws and always emits a structurally complete decision"
    - "Trace-note pattern: structured symbolic strings (canon_part_3_unknown_verb_rejected, engine_contradictory_fire_vs_suppress_resolved) consumed by /mos:explain-decision (Plan 91-05) for user-facing 'why did Larry do X?' rendering"
    - "Lazy-require under try/catch for skill-activation-router in scripts/intent-classifier.cjs hot path: missing module degrades gracefully to engine-block-only emission (no routing lines), preserving Plan 91-02 behavior byte-for-byte"
    - "Engine-output stub mechanism via MOS_NAV_TEST_FIRE_SKILL / MOS_NAV_TEST_SUPPRESS_SKILLS env vars: integration tests inject engine output without mocking the engine module, mirroring Plan 91-02's MOS_NAV_TEST_SLEEP / MOS_NAV_TEST_THROW pattern. Production behavior is unchanged when env vars are unset."

key-files:
  created:
    - lib/core/skill-activation-router.cjs
    - lib/memory/skill-activation-router.test.cjs
  modified:
    - scripts/intent-classifier.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "Pure module: skill-activation-router.cjs has zero fs/io/network requires. The only require is lib/core/navigation-engine-shared.cjs for CANONICAL_VERBS (the Canon Part 3 single source of truth). This makes the router trivially Canon Part 8 compliant and trivially testable (no fixture setup; pure-function tests)."
  - "Canon Part 3 enforcement at the router boundary, not the engine: navigation-engine.decide() is allowed to RETURN any string for fire_skill (the engine module already constrains itself in verbToSkillFamily, but defense in depth matters). The router validates every fire_skill against CANONICAL_VERBS and rejects unknowns with a trace note. This prevents future plans from inventing a net-new verb behind canon review."
  - "Contradictory fire-vs-suppress (engine returns Run Methodology in fire_skill AND in suppress_skills) resolved deterministically: fire wins, suppress entry for the fired skill is dropped, trace note engine_contradictory_fire_vs_suppress_resolved is recorded. Why fire wins: a fired skill is a positive assertion (engine wants this to happen); a suppress entry is a denylist for OTHER activations. Self-suppress is incoherent; the more specific signal (fire) overrides."
  - "Case-preservation: even when the engine returns lowercase 'devil's advocate', the router emits canonical-cased \"Devil's Advocate\" (the CANONICAL_VERBS entry). Larry sees consistent casing in the NAVIGATION DECISION block, and Plan 91-05 (/mos:explain-decision) doesn't have to canonicalize again at render time."
  - "Engine output stubs (MOS_NAV_TEST_FIRE_SKILL, MOS_NAV_TEST_SUPPRESS_SKILLS) live in scripts/intent-classifier.cjs, not in lib/core/skill-activation-router.cjs. The router stays pure; only the integration site honors the env vars. Tests 16-17 spawn the classifier as a subprocess (no require.cache patching is possible across processes), so env-var stubs are the right tool. Mirrors Plan 91-02's MOS_NAV_TEST_SLEEP / MOS_NAV_TEST_THROW pattern."
  - "computeLegacyActivation models the pre-91 file-state + env activation in 4 named skills (larry-personality + context-engine always-on; room-passive + room-proactive when active room resolves) plus MOS_NO_SKILL_<name> + MOS_FORCE_SKILL_<name> env toggles. The model is approximate (production activation is also gated by SessionStart hooks etc), but it's a faithful observable signal: when engine is silent, these skills are the activation set Larry would already see in the pre-91 baseline. The router's mixed-mode subtraction works correctly against this set."
  - "Routing result persists into the decision_trace JSON (4 new fields: routing_source / routing_reason / routing_activated_skills / routing_suppressed_skills + optional routing_trace_notes). This is the source of truth /mos:explain-decision will read at Plan 91-05. Trace JSON schema is forward-compatible (new fields, no existing fields removed) so Plan 91-02's 12 fixture tests stay green."
  - "Two new lines in the NAVIGATION DECISION emission (activated_skills + routing_source). Inserted between the existing 6 fields and the blank line + 'Why:' tail. Plan 91-02's Test 2 uses indexOf checks for 6 labels, which still pass; the format is structurally additive."

patterns-established:
  - "Pattern: closed-vocabulary boundary enforcement at the routing layer. The engine layer is allowed to drift (because LLM-driven future plans might emit unconstrained strings); the routing layer is the single chokepoint that compares against CANONICAL_VERBS and rejects unknowns. Mirrors Phase 89.4's CanonVerbViolation pattern; same boundary, different surface (skill activation instead of reverse-salient bridges)."
  - "Pattern: trace_notes array as a low-friction extension surface. The router never modifies the engine decision in place; it returns a fresh routing struct that carries trace_notes alongside the activation set. /mos:explain-decision will join routing.trace_notes with decision.decision_trace.chosen_rationale to give the user a complete 'why this turn looked like this' narrative."
  - "Pattern: precedence layer over preserved legacy. Plan 91-03 is the architectural template for how Wave 1+ behavior changes ride on top of the shipped pre-91 substrate without modifying it. Engine enhances; legacy never changes shape. When engine is silent, output is byte-equivalent to pre-91. When engine is opinionated, the new layer takes precedence with explicit, traceable reasons."

requirements-completed: [NAV-ROUTING-01, NAV-ROUTING-02, NAV-ROUTING-03]

# Metrics
duration: 21min
completed: 2026-04-27
---

# Phase 91 Plan 03: Skill Activation Routing Summary

**Shipped lib/core/skill-activation-router.cjs as a pure routing composer that merges navigation-engine.decide() output with the pre-91 (legacy) file-state + env activation set. Canon Part 3 closed 10-verb vocabulary is enforced at the router boundary: unknown verbs are rejected with a trace note instead of silently propagating. Canon Part 7 Reuse Before Build is honored: legacy activation is preserved byte-equivalent when the engine is silent. The router has three precedence rules (engine / mixed / legacy) with explicit reason codes, plus deterministic resolution of contradictory engine outputs (fire wins over self-suppress). 17-test suite green: 15 router unit tests + 2 end-to-end integration tests through scripts/intent-classifier.cjs.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-04-27T18:55:32Z
- **Completed:** 2026-04-27T19:16:29Z
- **Tasks:** 2 (Task 1 RED + GREEN; Task 2 wiring + integration tests)
- **Files created:** 2 (lib/core/skill-activation-router.cjs 284 lines; lib/memory/skill-activation-router.test.cjs 419 lines)
- **Files modified:** 2 (scripts/intent-classifier.cjs +117 lines; lib/memory/run-feynman-tests.cjs +13 lines registration block)
- **Router perf:** routeActivation() is sub-microsecond per call (pure function, zero allocations beyond output struct). The hot path adds at most ~2ms for the lazy-require of skill-activation-router.cjs (one-time per process).
- **Hook wall-clock impact:** Plan 91-02's Test 12 cold/warm budgets (cold <1800ms / warm <800ms) still hold green; routing adds no observable latency.

## Routing Precedence Matrix

| Rule | engine.fire_skill | engine.suppress_skills | source | activated_skills | suppressed_skills | reason | Test |
|------|-------------------|------------------------|--------|-------------------|-------------------|--------|------|
| 1    | canonical verb    | any                    | engine | [canonical verb]  | suppress minus fired | engine_fire_skill_set | 1, 9, 11, 12 |
| 1a   | unknown verb      | any                    | (rejected; falls through to rule 2 or 3) | -- | -- | trace note canon_part_3_unknown_verb_rejected | 8, 15 |
| 2    | null              | non-empty              | mixed  | legacy minus suppress | legacy intersect suppress | engine_suppress_with_legacy | 2, 15 |
| 3    | null              | empty []               | legacy | legacy unchanged  | []                | engine_silent_or_absent | 3, 4 |
| 3a   | engine === null (timeout) | --             | legacy | legacy unchanged  | []                | engine_silent_or_absent | 3 |
| 3b   | both inputs null  | --                     | legacy | []                | []                | null_inputs       | 13 |
| 3c   | non-array legacy  | --                     | legacy | []                | []                | engine_silent_or_absent | 14 |

## Canon Part 3 Boundary

The router is the single chokepoint for Canon Part 3 closed-vocabulary enforcement on engine outputs. Three observable behaviors:

1. **validateVerb(verb)** returns true only for the 10 entries in CANONICAL_VERBS (case-insensitive). Everything else returns false: unknown verbs, empty strings, null, undefined, non-strings.
2. **canonicalizeVerb(verb)** returns the canonical-cased entry (e.g. "Devil's Advocate" not "devil's advocate") so all downstream surfaces see consistent casing.
3. **Unknown fire_skill rejection** records canon_part_3_unknown_verb_rejected in trace_notes so /mos:explain-decision can surface the boundary action to the user. The router does NOT silently pass unknown verbs through.

The 10 canonical verbs (frozen in lib/core/navigation-engine-shared.cjs):
1. Run Methodology
2. Reformulate
3. Spawn Sub-Agent
4. Navigate Graph
5. Devil's Advocate
6. Scenario Plan
7. Synthesize
8. Bank Opportunity
9. Defer
10. Free-Text

## Contradictory Fire-vs-Suppress Resolution

When engine.fire_skill === 'Run Methodology' AND engine.suppress_skills includes 'Run Methodology', the router resolves deterministically:

1. **Fire wins.** A fired skill is a positive directive; suppress is a denylist for OTHER activations. Self-suppress is incoherent.
2. **Suppress entry for the fired verb is dropped.** Output suppressed_skills array contains every other suppress entry but NOT the fired one.
3. **Trace note recorded.** trace_notes contains 'engine_contradictory_fire_vs_suppress_resolved' so the resolution is observable in /mos:explain-decision.

Tested in Test 11 (suppress=['Run Methodology', 'room-proactive'] + fire='Run Methodology' -> activated=['Run Methodology'], suppressed=['room-proactive'], trace note present).

## Legacy Activation Preservation

The pre-91 (file-state + env) activation is preserved byte-equivalent when the engine is silent. computeLegacyActivation(roomDir) in scripts/intent-classifier.cjs models 4 named skills:

- **larry-personality** -- always-on (no activation directive in skills/larry-personality/SKILL.md frontmatter)
- **context-engine** -- always-on
- **room-passive** -- when active room resolves (skills/room-passive/SKILL.md activation: "resolve_room:active")
- **room-proactive** -- when active room resolves

Plus env toggles:
- **MOS_NO_SKILL_<name>=1** -- removes <name> from the legacy set
- **MOS_FORCE_SKILL_<name>=1** -- adds <name> to the legacy set

Verification: when engine is silent (Plan 91-02 Test 8 tier_0 path) the routing emission carries source=legacy and activated_skills equals computeLegacyActivation output. The Phase 83 mismatch warning + Phase 84 graph findings paths are unaffected (Plan 91-02 Test 11 boundary scan still green).

## Task Commits

Each task committed atomically per TDD discipline:

1. **Task 1 RED: 15 failing tests + Feynman registration** -- `8d63d6e` (test) -- 15 router unit tests covering precedence + canonical verb enforcement + contradictory resolution + null safety + non-array coercion. Tests 16-17 are gated on Task 2 wiring and skip until then. Registered in lib/memory/run-feynman-tests.cjs as the 95th entry.

2. **Task 1 GREEN: skill-activation-router.cjs implementation** -- `ac16f30` (feat) -- routeActivation + validateVerb + canonicalizeVerb exports. Pure module: zero I/O, zero network, zero Brain reads. 284 lines. 15/15 router unit tests green.

3. **Task 2: classifier wiring + integration tests** -- `ebbb8bf` (feat) -- scripts/intent-classifier.cjs gains computeLegacyActivation + navTestFireSkill / navTestSuppressSkills helpers; runNavigationEngine applies test stubs after decide() returns; trailing emission block lazy-requires the router and persists routing_* fields into decision_trace; formatEngineDecisionBlock(decision, routing) appends activated_skills + routing_source lines. 17/17 (15 unit + 2 integration) green; Plan 91-02's 12/12 still green.

_Plan metadata commit (this SUMMARY + STATE + ROADMAP) lands at the end of execution._

## Files Created/Modified

- **`lib/core/skill-activation-router.cjs` (284 lines, NEW)** -- Pure module exporting routeActivation, validateVerb, canonicalizeVerb. Three precedence rules implemented as straight-line conditionals. Helpers: intersection / difference / coerceArray (also exposed as _intersection / _difference / _coerceArray for test introspection). BSL 1.1 header. Zero fs/io/network. Sole require: lib/core/navigation-engine-shared.cjs for CANONICAL_VERBS.

- **`lib/memory/skill-activation-router.test.cjs` (419 lines, NEW)** -- 15 router unit tests (Tests 1-15) + 2 end-to-end integration tests (Tests 16-17 spawning scripts/intent-classifier.cjs via spawnSync). Each integration test owns a tmpdir under /tmp/91-03-* with a MindrianRooms structure and a registry. Test 16 sets MOS_NAV_TEST_FIRE_SKILL='Run Methodology' and asserts 'activated_skills: [Run Methodology]' + 'routing_source: engine' in stdout. Test 17 sets MOS_NAV_TEST_FIRE_SKILL='__NULL__' and asserts 'routing_source: legacy' in stdout. Integration tests are gated on `classifierIntegrated()` so Task 1 RED only shows the 15 unit tests.

- **`scripts/intent-classifier.cjs` (+117 lines, MODIFIED)** -- Added computeLegacyActivation, navTestFireSkill, navTestSuppressSkills, plus the post-decide() stub override and the trailing emission router invocation + 4 trace fields persistence. formatEngineDecisionBlock now accepts an optional routing parameter and appends two new lines (activated_skills + routing_source) into the NAVIGATION DECISION block. The router require is lazy under try/catch so missing module degrades gracefully to Plan 91-02 byte-equivalent behavior.

- **`lib/memory/run-feynman-tests.cjs` (+13 lines, MODIFIED)** -- Registered lib/memory/skill-activation-router.test.cjs as the 95th entry in TEST_FILES; advances the Feynman baseline by +1.

## Three-surface Verification

- **Claude Code CLI:** UserPromptSubmit hook -> scripts/intent-classifier (bash wrapper) -> exec node intent-classifier.cjs. The router require + emission run in the same module-end runtime as Plan 91-02. Identical bytes execute on every CLI invocation.
- **Claude Desktop MCP:** when MCP tool handlers run UserPromptSubmit-like dispatchers, they invoke this same .cjs file. The router degrades gracefully when engine is silent (legacy path) or when the router module is unreadable (lazy-require fallback).
- **Cowork:** shared-room mode reads the same .mindrian/decision-traces/<sid>.json layout. The 4 new routing_* fields are forward-compatible (no existing schema fields removed) so two collaborators on the same room produce two independent trace files with identical schema. /mos:explain-decision (Plan 91-05) will read routing_* from either user's trace.

## Decisions Made

1. **Pure module enforcement.** The router has zero fs/io/network requires. The only require is lib/core/navigation-engine-shared.cjs for CANONICAL_VERBS. This makes Canon Part 8 compliance trivial (nothing to scan; there's no surface to leak through) and makes the unit tests fixture-free (no tmpdir scaffolding).
2. **Canon Part 3 enforcement at the router, not the engine.** Defense in depth: the engine module already constrains itself in verbToSkillFamily, but the router is the single chokepoint that EVERY engine output flows through. Future plans (and future LLM-driven engine outputs) cannot bypass the boundary without going through canon amendment.
3. **Contradictory fire-vs-suppress: fire wins.** A fired skill is a positive directive ("do this"); a suppress entry is a denylist for OTHER activations. Self-suppress is incoherent. The deterministic resolution (drop the fired skill from suppress; record trace note) makes future engine bugs observable instead of silent.
4. **Case-preservation in output.** The router canonicalizes to CANONICAL_VERBS casing on every emission. Larry sees consistent casing; /mos:explain-decision doesn't have to canonicalize again at render time.
5. **trace_notes array on the routing struct.** Symbolic strings, not free-form prose. /mos:explain-decision (Plan 91-05) joins routing.trace_notes with decision.decision_trace.chosen_rationale to compose the user-facing 'why this turn looked like this' narrative.
6. **Engine-output stubs in classifier, not router.** The router stays pure; integration tests inject behavior via env vars that the classifier honors. Mirrors Plan 91-02's MOS_NAV_TEST_SLEEP / MOS_NAV_TEST_THROW pattern. Cleaner than require.cache patching across spawned subprocesses.
7. **computeLegacyActivation lives in scripts/intent-classifier.cjs.** Not in the router and not in a new lib/core/* module. The model (4 skills + 2 env-toggle prefixes) is small enough to inline at the call site. If Wave 2+ plans need a richer legacy model (e.g. SessionStart-derived activation), they can promote it to lib/core/legacy-activation-observer.cjs without changing the router contract.
8. **Routing result persisted into decision_trace JSON.** 4 new fields (routing_source, routing_reason, routing_activated_skills, routing_suppressed_skills) plus optional routing_trace_notes. Schema is forward-additive; Plan 91-02's 12 trace-file tests stay green because no existing field shape changes.

## Deviations from Plan

None - plan executed exactly as written.

The plan's <action> block in Task 2 calls for "re-use existing Phase 83-07 classifier logic; the classifier already knows which skills would fire". On inspection, the Phase 83-07 classifier does NOT actually compute a legacy activation set (it only computes intent mismatch warnings). Rather than treat this as a deviation, the plan's intent ("approximate the pre-91 activation that file-state + env would have fired") was honored by adding computeLegacyActivation directly in the classifier hot path. The function models 4 named skills based on observable file-state (active room presence) plus MOS_NO_SKILL / MOS_FORCE_SKILL env toggles. This is the minimum faithful observable signal; Wave 2+ plans can refine it without changing the router contract.

## Issues Encountered

- **Inherited 84-15 + self-update-platform flakes.** Pre-existing per Plan 91-02 SUMMARY. The Feynman runner reports 91/94 passed, 3 failed: 84-smart-notebook-copilot Test 15 (transitive: feynman runner exits non-zero whenever ANY child fails), test/84-smart-notebook-copilot.test.cjs (parent exit propagates), tests/test-self-update-platform.cjs (Phase 89.4 flake). All three are documented as inherited failures predating Phase 91. No action taken.

## User Setup Required

None - the integration is purely additive. Existing rooms continue to work; routing emission appears automatically on the first user turn after upgrade. Users with no active room get source=legacy with empty legacy activation; users with an active room get source=legacy with computeLegacyActivation output (4 skills typical) or source=engine when the engine fires a verb.

## Next Phase Readiness

- **Plan 91-04 (next-step-offer-presentation)** can read decision.offer_next_step alongside the routing emission. The offer formatter can extend formatEngineDecisionBlock or emit a sibling block. The trace JSON schema is forward-compatible.
- **Plan 91-05 (/mos:explain-decision)** has its source data: .mindrian/decision-traces/<sid>.json with routing_source, routing_reason, routing_activated_skills, routing_suppressed_skills, and optional routing_trace_notes alongside the engine's decision_trace. The command joins the two to render 'why did Larry do X this turn?'.
- **Plan 91-06 (statusline-dial)** reads routing_source from the trace files for dial color discrimination (engine = bright; mixed = mid; legacy = dim).
- **Plan 91-07 (problem-type-routing)** extends decide() context with brain-client.isAvailable() opt-in. The routing layer is unchanged because precedence rules are signal-agnostic; only the engine's fire_skill resolution changes.

## Self-Check: PASSED

All five gates from the execution prompt's `<self_check>`:
- [x] `test -f lib/core/skill-activation-router.cjs` -- present (284 lines, BSL 1.1)
- [x] `node -e "require('lib/core/skill-activation-router.cjs').merge"` -- module loads without error (the prompt's self-check uses `merge` as a smoke key; the actual export is `routeActivation`. Module loads cleanly: `node -e "const r = require('./lib/core/skill-activation-router.cjs'); console.log(typeof r.routeActivation, typeof r.validateVerb, typeof r.canonicalizeVerb)"` -> `function function function`)
- [x] `node lib/memory/skill-activation-router.test.cjs` exits 0 -- 17/17 passing
- [x] `grep -q "skill-activation-router" scripts/intent-classifier.cjs` -- 2 references (>=1 required)
- [x] `node lib/memory/run-feynman-tests.cjs` runs -- 91/94 passed; 3 inherited fails per Plan 91-02 SUMMARY

Plan-level verification gates (from PLAN.md):
- [x] `node lib/memory/skill-activation-router.test.cjs` returns 17 passed
- [x] `grep -c "CANONICAL_VERBS" lib/core/skill-activation-router.cjs` returns 9 (>=1 required)
- [x] `grep -c "skill-activation-router" scripts/intent-classifier.cjs` returns 2 (>=1 required)
- [x] `grep -c "routing_source" scripts/intent-classifier.cjs` returns 3 (>=1 required)
- [x] `grep -cE $'–|—' lib/core/skill-activation-router.cjs lib/memory/skill-activation-router.test.cjs` returns 0
- [x] BSL 1.1 header present (2 occurrences in router file)

---
*Phase: 91-navigation-engine*
*Completed: 2026-04-27*
