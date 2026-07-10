---
phase: 213-eureka-reach-wiring
plan: 04
subsystem: eureka
tags: [eureka, larryreacts, shape-f, offer, part8, hedged, recommend-never-trigger]

# Dependency graph
requires:
  - phase: 213-02
    provides: "the plan-02 closed-schema eureka side-channel (last-eureka.json: guard{verdict,confidence} + bridge{a_handle,b_handle,surprise_type,band}) that this composer consumes"
  - phase: 122-03
    provides: "recommendFrameworkChain (chain-recommender.cjs) + composeWorkflow (command-resolver.cjs) - the ~85%-shipped recommend + resolve substrate wired INTO, never rebuilt"
provides:
  - "lib/core/eureka/eureka-offer.cjs: composeEurekaOffer - turns a guard-cleared eureka side-channel into ONE hedged Shape-F offer object { text, a_handle, b_handle, direction, confidence, next:{chain,workflow} } or null; DIRECTION_ENUM = ['structural_transfer','semantic_implementation']"
affects: [213-05, eureka-reach-wiring, fired-reach-render-path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-offer-or-null content composer (the navigation-engine-offer idiom): emit exactly ONE hedged offer or abstain, never a list, never an execution"
    - "Part-8 fence at the text layer: the rendered line is composed ONLY from a fixed template + two opaque handles + a direction enum member (the token-whitelist test is the mechanical fence)"
    - "Confidence passthrough (D-02): the guard confidence band flows straight through, never re-derived or re-weighted downstream"
    - "Wired-into-not-rebuilt: composeEurekaOffer defaults to recommendFrameworkChain + composeWorkflow, both injectable seams for hermetic tests; the command truth is the registry/frontmatter ONLY"

key-files:
  created:
    - lib/core/eureka/eureka-offer.cjs
    - tests/test-213-eureka-offer.cjs
  modified:
    - tests/test-213-no-force.cjs
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "The offer file is WIRED into command-resolver by design (213-04 key_link + threat model T-213-12, which forbids only chain-executor for this file). The plan-03 no-force suite reused one broad regex (chain-executor|command-resolver|navigation-engine) meant for the PRODUCER files; applied to the offer file it contradicted the mandated wiring. Narrowed the offer-file arm to bar only the EXECUTION + ROUTING surfaces, permitting command-resolver (the pure read-only registry door, zero network, never executes)."
  - "Direction renders as the LITERAL enum token (structural_transfer, underscore preserved) so the token-whitelist fence recognises it as an enum member rather than free prose that would leak past the fence."

requirements-completed: [EUREKA-03, EUREKA-07]

# Metrics
duration: ~6min
completed: 2026-07-10
---

# Phase 213 Plan 04: The LarryReacts Leg (eureka-offer composer) Summary

**A guard-cleared eureka side-channel becomes ONE hedged, handle-and-enum-only Shape-F offer with a registry-derived next-command segue, fully offline-capable, and structurally incapable of executing anything - LarryReacts recommends, the navigator triggers.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-10
- **Tasks:** 2 (composer + contract suite)
- **Files:** 2 created (1 module + 1 test), 1 modified (the plan-03 no-force arm activated)

## Accomplishments

- **The pure composer (`lib/core/eureka/eureka-offer.cjs`, 225 lines):** `composeEurekaOffer({ payload, recommendFn?, composeWorkflowFn?, problemType? })` returns EXACTLY one offer `{ text, a_handle, b_handle, direction, confidence, next: { chain, workflow } }` or `null`. Never a list, never an execution (the single-offer contract, the navigation-engine-offer idiom). `DIRECTION_ENUM = Object.freeze(['structural_transfer','semantic_implementation'])`.
- **Part-8 fence at the text layer:** the hedged Larry line is built from a FIXED template (`OFFER_TEMPLATE`) filled with ONLY the two opaque node HANDLES + the direction enum member. Nothing from any bridge content field can reach the rendered text (the side-channel carries no content by schema; the token-whitelist test arm is the mechanical fence - every non-fixed-template token in the text must be a handle or a DIRECTION_ENUM member).
- **Confidence passthrough (D-02):** `offer.confidence === payload.guard.confidence` - the guard band flows straight through, never re-derived. No local scoring code path exists; the passthrough is pinned by two arms (high and medium bands).
- **Hedged voice (Canon Part 12):** the line names the two handles + the direction, states the opportunity, and ends in a question ("Want to pursue this bridge?"). Zero grading vocabulary, zero forcing imperative, zero em-dash - all asserted mechanically.
- **Wired into, never rebuilt:** the next-command segue defaults to `recommendFrameworkChain({ problemType })` (chain-recommender) then `composeWorkflow(chain)` (command-resolver, the SINGLE registry command-truth door). Both are injectable seams so every test is hermetic; one arm pins the REAL `composeWorkflow` against the live `data/command-registry.json` (guarded by `fs.existsSync` + a SKIP log).
- **Offline-full-function:** a seed-only chain (Brain unavailable) still emits an offer with `next.chain` length 1; a throwing recommend seam degrades to the fallback seed and the offer survives.
- **Recommend, never trigger:** the module never requires the chain runner and never invokes a command (pure composition). The returned workflow is inert data; the navigator confirm is the only bridge to execution.

## Task Commits

1. **Task 1: composeEurekaOffer + DIRECTION_ENUM (the composer)** - `d3ca3161` (feat)
2. **Task 2: the 10-arm contract suite + activate the plan-03 no-force arm** - `34904375` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified

- `lib/core/eureka/eureka-offer.cjs` - `composeEurekaOffer`, `DIRECTION_ENUM`, `OFFER_TEMPLATE`, `FALLBACK_SEED`. Pure, synchronous, never throws (abstains to null on any fault).
- `tests/test-213-eureka-offer.cjs` - 10 hermetic arms (the 6 plan behaviors + passthrough-holds + token-whitelist + voice + degrade), exit 0.
- `tests/test-213-no-force.cjs` - the plan-03 offer-file arm was SKIP-logged until this file landed; narrowed its fence for the offer file (see Deviations) so the arm now applies and passes.

## Acceptance Criteria (all objective gates hold)

- `node tests/test-213-eureka-offer.cjs` -> exit 0 (PASS=10)
- `grep -c "recommendFrameworkChain" lib/core/eureka/eureka-offer.cjs` -> 3 (>=1) AND `grep -c "composeWorkflow" ...` -> 11 (>=1) (wired into, not rebuilt)
- `grep -cE "command-research|room\.db|RELATED_TO|dossier" ...` -> 0 (single command-truth source; enrichment inputs never a runtime path)
- `grep -cE "require\(.*chain-executor" ...` -> 0 (composes an offer, never executes)
- `grep -cP '\x{2014}'` -> 0 per file (module + test)
- Regressions green: `test-213-sensor-eureka` (PASS=11), `test-213-reach-wired` (5 arms), `test-213-no-force` (4 invariants, offer arm now ACTIVE), `test-sensors-part8-sweep` + `test-sensors-routing-fence` (auto-span the new file)

## TDD Gate Compliance

Task 1 was marked `tdd="true"`, but the plan's own structure places the full behavior suite in Task 2's separate file (Task 1 ships the composer + its inline `node -e` verify: loads + abstains; Task 2 writes the 6-behavior contract suite). Executed per that prescribed layout - the composer landed with its immediate gate green, and the comprehensive RED/GREEN behavior suite (10 arms including the token-whitelist and voice fences) landed in `tests/test-213-eureka-offer.cjs`. This mirrors 213-02's identical structure and is the plan's layout, not a deviation from TDD intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed the plan-03 no-force offer-file fence so this plan's mandated command-resolver wiring is permitted**
- **Found during:** Task 2 (the plan-03 no-force suite's `eureka-offer.cjs` arm activated the moment the file landed and failed)
- **Issue:** `tests/test-213-no-force.cjs` used ONE broad `FORBIDDEN_REQUIRE` regex (`chain-executor|command-resolver|navigation-engine`) for all three eureka files. That set is correct for the PRODUCER files (sensor + runner must name no command at all), but it directly contradicts plan-04's explicit design: the key_link `eureka-offer.cjs -> command-resolver.cjs via composeWorkflow` and the `<action>` default `(composeWorkflowFn || composeWorkflow)`. The offer file's whole job is attaching the recommended next command from the registry. The offer arm's OWN failure message already read "requires chain-executor in CODE" - confirming the intent for this file was always chain-executor specifically; the shared broad regex was the defect.
- **Fix:** Added `FORBIDDEN_REQUIRE_OFFER` (bars only `chain-executor` + `navigation-engine`, the EXECUTION + ROUTING surfaces) and applied it to the offer-file arm only. `command-resolver` - a pure read-only registry mapper (zero network, never executes, per its own header) - is permitted for the offer file by design. This aligns the plan-03 fence with plan-04's threat model T-213-12 ("module never requires chain-executor") and its mandated key_link. The producer files keep the full broad fence unchanged.
- **Files modified:** tests/test-213-no-force.cjs (test fence only; no source change to any producer)
- **Verification:** `node tests/test-213-no-force.cjs` exit 0, offer arm ACTIVE ("execution+routing fence applied; command-resolver permitted by design")
- **Committed in:** `34904375`

**Total deviations:** 1 auto-fixed (Rule 3). No source/engine change beyond the plan's own new module; the recommend-never-trigger doctrine is preserved (the offer file still requires no executor and executes nothing - the behavioral + structural arms both prove it).

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary schema beyond the plan's own `<threat_model>` (T-213-11..13, all mitigated as designed): the token-whitelist arm fences the text composition (T-213-11), the no-chain-executor grep + the no-force behavioral arm fence execution (T-213-12), and the D-02 passthrough (pinned by two arms) fences fabricated confidence (T-213-13).

## Known Stubs

None. The composer is fully wired: it consumes the real plan-02 side-channel schema, defaults to the real recommendFrameworkChain + composeWorkflow, and one arm pins the real registry integration. Consumption by the F.7 dial render path happens through the existing fired-reach surface (deep_research -> the closed Spawn Sub-Agent shape); this module adds no new selector and no render fork, exactly as scoped. The live `deriveFn` that turns 213-02's born-invoked producer from `substrate_unavailable` into a live bridge scan remains a later plan's debt (unchanged by this plan, which consumes a payload once produced).

## Self-Check: PASSED

Both created files exist on disk; both task commits (`d3ca3161`, `34904375`) are in the git log; the suite re-runs at exit 0 (PASS=10); all three 213 regression suites are green (sensor PASS=11, reach-wired 5 arms, no-force 4 invariants with the offer arm now active).

---
*Phase: 213-eureka-reach-wiring*
*Completed: 2026-07-10*
