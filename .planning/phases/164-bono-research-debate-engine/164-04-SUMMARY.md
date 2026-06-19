---
phase: 164-bono-research-debate-engine
plan: 04
subsystem: bono
tags: [cell-fanout, parallel-dispatch, cost-governor-cap, fable-mode, part-2, part-8, persona-analyst, bono]

# Dependency graph
requires:
  - phase: 164-02
    provides: the expert library + assembleTeam (the assembled team this fan-out dispatches per cell)
  - phase: 156-01
    provides: lib/core/futures/orchestrator.cjs resolveFanoutCap + FUTURES_FANOUT_CAP (the cost-governor clamp idiom mirrored)
  - phase: AGENT-01
    provides: lib/core/dispatch-optimizer.cjs planDispatch / scaleSwarm / selectModel (the shipped cost-governed swarm planner)
  - phase: 130.5
    provides: lib/core/research-corpus.cjs fetchCorpus + auditQueryString (the Part 8 fail-closed web leg)
provides:
  - lib/core/bono/cell-fanout.cjs runCellFanout (the parallel (subdomain x hat) cell fan-out with cost-governor cap + per-cell fable-mode layer 1)
  - genericDomainHandle (the Part 8 generic-handle deriver) + defaultDispatchCell + defaultSelfCritique + normalizeReading + the frozen CELL_STANCES / WEB_HATS / CONFIDENCE_FLOOR / DEFAULT_CELL_CAP
  - the persona-analyst BONO cell-agent upgrade (hat-scoped web + local-graph-read + Brain-generic; the per-cell dispatch target)
  - tests/test-bono-cell-fanout.cjs + tests/test-bono-cell-selfcritique.cjs (registered in run-all-164.sh)
affects: [164 Wave-5 debate orchestrator (consumes the collected cell array)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A parallel sub-agent fan-out is Promise.all over an injectable per-cell dispatch fn, capped by the FUTURES_FANOUT_CAP clamp idiom (resolveFanoutCap) and planned via the SHIPPED dispatch-optimizer.planDispatch -- never a new loop runtime, never the sequential chain executor"
    - "Defensive per-cell isolation: a cell error collapses to a neutral low-confidence stub INSIDE the per-cell promise, so a single rejection never rejects the whole Promise.all"
    - "Fable-mode layer 1: a per-cell self-critique runs BEFORE collection; a below-floor / no-evidence reading is dropped (with a reason) so a bad cell cannot propagate into the debate"
    - "Part 8 web leg: a GENERIC subdomain handle (bounded to 6 words) is the only thing that crosses fetchCorpus; the venture body never rides through; auditQueryString is the fail-closed pre-egress gate"

key-files:
  created:
    - lib/core/bono/cell-fanout.cjs
    - tests/test-bono-cell-fanout.cjs
    - tests/test-bono-cell-selfcritique.cjs
  modified:
    - agents/persona-analyst.md
    - tests/run-all-164.sh

key-decisions:
  - "The fan-out rides dispatch-optimizer.planDispatch + the futures FUTURES_FANOUT_CAP clamp idiom (resolveFanoutCap), NOT a cloned orchestrator and NOT act-command --swarm (the recalibrated reuse pointers); the not-runChain test grep-asserts zero chain-executor / runChain dependency (D-164-S2)"
  - "dispatchCell is injected for testability; the default per-cell dispatch runs the hat-scoped web leg (research-corpus.fetchCorpus with a generic subdomain handle) and returns {stance, evidence, confidence}; Red=none and Blue=synthesis run no fresh web leg per the Canon Part 2 TOOL ACCESS contract"
  - "A cell error collapses to a neutral confidence-0 stub inside the per-cell promise so the fan-out never crashes (Test 2 defensive contract); the stub cannot tilt the debate"
  - "Fable-mode layer 1 (D-164-S3) runs selfCritique(cell) BEFORE collection; the DEFAULT critique drops below-CONFIDENCE_FLOOR (0.3) or non-neutral-with-no-evidence readings, recording a reason so the drop is graph-data-ready; an injected critique overrides"
  - "The persona-analyst connector wiring stays on the FROZEN context_block reach + persona-hats sub_mode (no 7th reach); web_scope stays null in the static block because the hat scope is resolved per-cell at dispatch time; the wiring is regenerated via build-connector-registry --check (D-164-S4 generated path), never hand-minted"

patterns-established:
  - "Pattern: the net-new parallel mechanic reuses the shipped cost-governor (planDispatch) + the shipped futures cap (resolveFanoutCap) + the shipped audited web leg (fetchCorpus) -- zero new dependency, zero new fetch path, zero new loop runtime"
  - "Pattern: a two-layered fable-mode -- the swarm-side self-critique (this wave, pre-collection) + the debate-side selfCritiqueFn (Wave 5, in the sequential debate)"

requirements-completed: [D-164-S2, D-164-S3, D-164-S4]

# Metrics
duration: ~25min
completed: 2026-06-19
---

# Phase 164 Plan 04: BONO Cell Agent + Parallel (Subdomain x Hat) Cell Fan-Out Summary

**The persona-analyst BONO cell-agent upgrade (hat-scoped web + local-graph-read + Brain-generic via generated connector wiring) plus the genuinely net-new parallel (subdomain x hat) cell fan-out (`runCellFanout`): cost-governed via the SHIPPED dispatch-optimizer.planDispatch, capped by the futures FUTURES_FANOUT_CAP clamp idiom, dispatched in PARALLEL (Promise.all, not the sequential chain executor), each cell returning a structured {stance, evidence, confidence} from a Part-8-audited generic-handle web leg, with fable-mode layer 1 dropping a bad reading BEFORE collection. Zero new deps, zero Brain egress.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-19 (post-164-03 main)
- **Completed:** 2026-06-19
- **Tasks:** 2 (Task 1 auto, Task 2 auto TDD RED-then-GREEN)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

### Task 1 -- persona-analyst.md upgraded into the BONO cell agent (generated connector wiring)
- `agents/persona-analyst.md` now documents its DUAL role: (a) the per-(subdomain x hat) BONO cell agent returning `{stance, evidence, confidence}` (stance in `supports | challenges | refines | neutral`, confidence a scalar in `[0,1]`), and (b) the Wave-5 debate consolidator (the `onStep` target that folds the collected readings into the ruling, the sequential debate-side half of two-layered fable-mode).
- The hat-scoped TOOL ACCESS contract (Canon Part 2) is documented verbatim: LOCAL GRAPH read (via the navigation chokepoint `getNeighborhood`), REMOTE BRAIN generic-only (`brain_search` / `brain_query` with framework names + problem-type enums ONLY, ZERO user egress), and EXTERNAL WEB hat-scoped (White=data, Black=failure-cases, Green=innovation, Yellow=success-cases, Red=none/intuition, Blue=synthesis).
- The `allowed-tools` list gained `WebSearch`, `WebFetch`, `mcp__brain_search`, `mcp__brain_query` while keeping `Read`/`Write`/`Glob`. The Phase 95.6 D-10 no-Brain note is explicitly REVERSED for the cell role with the generic-handles-only caveat restated.
- The beautiful-question openers per SME archetype (Canon Appendix E) are present (Founder / Researcher / Operator / Investor / Mentor / Domain Expert / Student).
- CRITICAL (D-164-S4): the connector wiring is GENERATED, not hand-minted. The `connector:` block stays on the FROZEN `context_block` reach + `persona-hats` sub_mode (NO 7th reach); `web_scope` stays `null` in the static block because the hat scope is resolved per-cell at dispatch time by the fan-out. `node scripts/build-connector-registry.cjs` was re-run (the generated path); the tuple was unchanged so `data/connector-registry.json` showed no diff, proving no new reach was minted. `--check` is clean.
- Task 1 verify: `node scripts/build-connector-registry.cjs --check && grep stance && grep hat-scope` returns `AGENT_OK`.

### Task 2 -- the parallel (subdomain x hat) cell fan-out with cost-governor cap + fable-mode layer 1
- `lib/core/bono/cell-fanout.cjs` (305 lines) ships `runCellFanout(opts)`:
  - builds the (subdomain x hat) grid, CLAMPS the grid length to the cost-governor cap via `resolveFanoutCap` (the FUTURES_FANOUT_CAP clamp idiom from `lib/core/futures/orchestrator.cjs`; default cap = `FUTURES_FANOUT_CAP` = 5), and plans the parallel dispatch via the SHIPPED `lib/core/dispatch-optimizer.cjs::planDispatch` (the cost-governor + swarm-scale planner; the plan is advisory budget metadata over the dispatched count, degrading to a planless run when no `roomDir` is supplied -- the fan-out still executes).
  - dispatches ALL planned cells in PARALLEL via `Promise.all` over `dispatchCell` (injected for testability; in production it dispatches the upgraded persona-analyst cell agent). NOT a sequential await-loop, NOT a sequential chain sequence (D-164-S2).
  - each cell: derives a GENERIC domain handle from its subdomain (`genericDomainHandle`, bounded to 6 words so a long body cannot smuggle through), runs the hat-scoped web leg via `researchFn` (default `research-corpus.fetchCorpus`, which runs `auditQueryString` fail-closed pre-dispatch, Part 8), and returns `{subdomain, hat, stance, evidence, confidence}`. `Red`=none and `Blue`=synthesis run no fresh web leg per the TOOL ACCESS contract.
  - defensive: a cell error collapses to a neutral confidence-0 stub INSIDE the per-cell promise, so a single rejection never rejects the whole `Promise.all` (the fan-out never crashes).
  - fable-mode layer 1 (D-164-S3): each returned cell is self-critiqued via `selfCritique(cell)` (injected; the DEFAULT drops below-`CONFIDENCE_FLOOR` (0.3) or non-neutral-with-no-evidence readings) BEFORE collection; a dropped cell records a reason so the drop is graph-data-ready.
  - returns `{ cells: collected[], dropped: [], plan: { requested, dispatched, capped }, dispatchPlan }`. The module requires NO `lib/core/chain-executor.cjs` and references NO `runChain` (grep-asserted by the not-runChain test).
- `tests/test-bono-cell-fanout.cjs` (189 lines, 4/4 blocks): Test 1 parallel-dispatch + cap (a concurrency spy proves `maxConcurrent > 1`, the cap clamps 12 -> 5, `plan.capped` flags the bit), Test 2 shape + defensive neutral stub on a cell error, Test 3 Part 8 web leg (a fetchCorpus spy asserts only the generic subdomain handle crossed, the venture body never did), Test 5 not-runChain (source grep-asserts zero `chain-executor` / `runChain`; AND asserts `planDispatch` + `FUTURES_FANOUT_CAP`/`resolveFanoutCap` + `fetchCorpus` ARE wired).
- `tests/test-bono-cell-selfcritique.cjs` (128 lines, 3/3 blocks): Test 4a a bad cell dropped pre-collection (with a reason), Test 4b a clean cell passes through unchanged, Test 4c the DEFAULT critique gates a below-floor reading.
- `tests/run-all-164.sh` updated: both Wave-4 suites appended to `CJS_SUITES`, both source files + both tests + `agents/persona-analyst.md` added to the em-dash sweep targets.

### Phase gate
- `bash tests/run-all-164.sh` is GREEN at 11/11 (5 CJS suites + schema-alias guard + frozen-set assertion + connector --check + diagnose issue-tree sub_mode + em-dash sweep).
- `node scripts/build-connector-registry.cjs --check` is clean (no 7th reach, no duplicate tuple).
- Carried floors green: `run-all-163.sh`, `run-all-168.sh`, `run-all-169.sh` all GREEN.
- Wave-5 stubs (the debate orchestrator + the verdict) remain RED-by-absence (not on disk, unregistered in run-all-164.sh); they append their suites as they land.

## Task Commits

1. **Task 1** -- `c10bf734` (feat): persona-analyst BONO cell-agent upgrade; connector wiring regenerated (no new reach); `AGENT_OK`.
2. **Task 2 RED** -- `e7a5d1a3` (test): both failing Wave-4 suites + run-all-164.sh registration (module not yet created).
3. **Task 2 GREEN** -- `dfeb81c5` (feat): `lib/core/bono/cell-fanout.cjs`; both suites green; full gate 11/11.

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md committed in the final docs commit.

## Files Created/Modified
- `lib/core/bono/cell-fanout.cjs` (created) -- runCellFanout + genericDomainHandle + defaultDispatchCell + defaultSelfCritique + normalizeReading + frozen CELL_STANCES / WEB_HATS / CONFIDENCE_FLOOR / DEFAULT_CELL_CAP
- `tests/test-bono-cell-fanout.cjs` (created) -- parallel + cap + shape + Part 8 web leg + not-runChain
- `tests/test-bono-cell-selfcritique.cjs` (created) -- fable-mode layer 1 (drop a bad reading pre-collection, clean passes, default critique gates)
- `agents/persona-analyst.md` (modified) -- the BONO cell-agent upgrade (hat-scoped web + local-graph-read + Brain-generic + {stance, evidence, confidence} return + consolidator role + beautiful-question openers; connector wiring regenerated)
- `tests/run-all-164.sh` (modified) -- both Wave-4 suites registered + added to the em-dash sweep

## Decisions Made
- Reused the SHIPPED parallel-dispatch substrate (the recalibrated Part-7 reuse pointers): `dispatch-optimizer.planDispatch` for the cost-governed plan + the futures `FUTURES_FANOUT_CAP` clamp idiom (`resolveFanoutCap`) for the cap + `research-corpus.fetchCorpus` for the audited web leg. Did NOT clone a fresh orchestrator and did NOT cite `scripts/act-command.cjs` / `act --swarm` (the stale pointers the recalibration corrected).
- `dispatchCell` / `researchFn` / `selfCritique` are all injectable for headless testability; production runs the defaults (the hat-scoped web leg + the below-floor critique).
- A cell error collapses to a neutral confidence-0 stub inside the per-cell promise (not a thrown rejection), so a single bad cell never crashes the whole fan-out.
- The persona-analyst connector wiring stays on the frozen `context_block` reach + `persona-hats` sub_mode; `web_scope` is `null` statically because the hat scope is a per-cell runtime concern. The registry was regenerated (the generated path), proving no new reach landed.

## Deviations from Plan

**1. [Rule 1 - Bug] Reworded source comments to avoid the literal `runChain` / `chain-executor` tokens**
- **Found during:** Task 2 GREEN (Test 5 the not-runChain source grep-assert failed).
- **Issue:** my first GREEN draft of `cell-fanout.cjs` used the words "runChain" and "chain-executor.cjs" in explanatory comments. The not-runChain test (correctly) grep-asserts the source contains NEITHER literal token, so the comments tripped the very assertion they described.
- **Fix:** reworded every such comment to "the sequential chain executor" / "the sequential debate executor" while preserving the meaning (the fan-out is parallel; Wave 5 is the sequential consumer). No behavior change.
- **Files modified:** lib/core/bono/cell-fanout.cjs
- **Commit:** dfeb81c5 (the change was made before the GREEN commit landed)

## Issues Encountered
- `.planning/` is gitignored, so staging this SUMMARY requires `git add -f` (the established Phase-169 / 164-01/02/03 fallback). `gsd-tools` was unavailable, so STATE.md / ROADMAP.md were updated directly and committed.

## User Setup Required
None - no external service configuration required. Zero new dependencies (pure Node built-ins + the shipped dispatch-optimizer + futures cap + research-corpus). Zero Brain egress (Part 8): the cell web leg carries only a generic subdomain handle through the auditQueryString fail-closed gate; the agent's Brain leg (per the doctrine) carries generic framework handles + enums only, never venture content.

## Next Phase Readiness
- The parallel cell fan-out is live: the BONO research path can now dispatch N = (subdomains x hats) cells in parallel (cost-governed, capped, defensive, self-critiqued) and return the collected `{stance, evidence, confidence}[]` array.
- Wave 5 (the debate orchestrator + the verdict) remains RED-by-absence: it consumes this wave's collected cell array into the sequential debate executor (the debate-side half of two-layered fable-mode via the `selfCritiqueFn`).
- `edges.cjs` + `transitions.cjs` untouched; the connector registry carries no new reach.

## Known Stubs
None introduced. No hardcoded empty values flowing to UI, no placeholder text, no unwired data sources. `defaultDispatchCell` is a deliberately conservative default reading shaper (the production cell agent persona-analyst shapes a richer stance); `dispatchCell` is injectable so production wires the real cell agent. This is the documented contract, not a stub.

## Threat Flags
None. The module introduces no new network surface (it reuses the shipped `fetchCorpus` audited path), no new auth path, no schema change at a trust boundary. The threat register dispositions are honored: T-164-14 (the web leg is fetchCorpus with a generic handle; auditQueryString is the fail-closed pre-egress gate -- asserted by the Part 8 web-leg test), T-164-15 (fable-mode layer 1 self-critiques each cell pre-collection; the self-critique test asserts a bad reading is dropped with a reason), T-164-16 (the cost-governor cap clamps the grid via resolveFanoutCap + planDispatch -- asserted by the cap test), T-164-17 (the module must not require the chain executor; the test grep-asserts no chain-executor / runChain dependency), T-164-18 (the cell agent Brain leg restricted to generic handles + enums -- the agent doctrine), T-164-SC (zero new packages).

## TDD Gate Compliance
Task 2 carried `tdd="true"`. It followed RED-then-GREEN with separate commits: a `test(...)` commit (e7a5d1a3) landing both failing suites (the module not yet created -> module-not-found), then a `feat(...)` commit (dfeb81c5) landing `cell-fanout.cjs` that turns them green. The RED commit failed for the right reason (missing module), so the GREEN gate is behaviorally meaningful. Task 1 (the agent-doc upgrade) is `type="auto"` (a documentation + connector-regeneration task, not a behavior-adding code task), committed once (c10bf734).

## Self-Check: PASSED

- All created/modified files exist on disk: cell-fanout.cjs, test-bono-cell-fanout.cjs, test-bono-cell-selfcritique.cjs, persona-analyst.md (upgrade), run-all-164.sh (registration), this SUMMARY.
- All three task commits exist in git history: c10bf734, e7a5d1a3, dfeb81c5.
- `node tests/test-bono-cell-fanout.cjs` 4/4 green; `node tests/test-bono-cell-selfcritique.cjs` 3/3 green; `bash tests/run-all-164.sh` 11/11 green; carried 163/168/169 floors green.
- `node scripts/build-connector-registry.cjs --check` clean (no 7th reach).
- No em-dashes in any created or modified file (the run-all-164.sh em-dash sweep covers all six artifacts + passes).
- min_lines satisfied: cell-fanout.cjs 305 (>=100), test-bono-cell-fanout.cjs 189 (>=50), test-bono-cell-selfcritique.cjs 128 (>=40).

---
*Phase: 164-bono-research-debate-engine*
*Completed: 2026-06-19*
