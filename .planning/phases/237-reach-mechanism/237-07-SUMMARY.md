---
phase: 237-reach-mechanism
plan: 07
subsystem: infra
tags: [chain-dispatcher, node-cjs, spawn-sync, mutation-testing, canon-part-9]

requires:
  - phase: 237-05
    provides: "data/command-registry.json commands[].executable, the build-time-generated {script, args, produces} allowlist, and tests/test-237-executable-seam.cjs proving every claim names a live script"
provides:
  - "lib/core/chain-step-dispatcher.cjs, the two-tier honest step executor: TIER_EXECUTABLE genuinely spawns and verifies an artifact, TIER_HOST_DISPATCH honestly refuses with quality: null plus a requires_host_dispatch directive naming agents/framework-runner.md"
  - "the new chain_step_dispatched memory_event label (distinct from the legacy fabricated-success chain_step_executed label, no migration of old rows)"
  - "tests/test-237-dispatcher-tiers.cjs, the 9-leg tier-honesty gate with a live fabricated-quality mutation proof"
affects: [237-08]

tech-stack:
  added: []
  patterns:
    - "Two-tier honest dispatcher: TIER_EXECUTABLE (spawnSync with an argv array, no shell, bounded timeout, post-spawn artifact verification) vs TIER_HOST_DISPATCH (quality: null, never a fabricated success, plus a machine-readable directive naming the exact host-side executor and its documented Input Contract fields)"
    - "Registry-injection test seam: an optional context.registryPath / opts.registryPath override (test-only, never set by the production makeChainStepDispatcher wiring) lets a test drive synthetic executable joins without ever touching the generated data/command-registry.json"
    - "Containment-before-spawn: both the declared script path (against the plugin root) and the declared artifact path (against the room root) are resolved and containment-checked BEFORE anything runs, mirroring scripts/write-scope-check.cjs::targetRoomUnderRoot's relative-path-escape check"

key-files:
  created:
    - lib/core/chain-step-dispatcher.cjs
    - tests/test-237-dispatcher-tiers.cjs
  modified: []

key-decisions:
  - "DISPATCH_TIMEOUT_MS = 120000 (2 minutes). The real fixture (scripts/generate-hub.cjs against a normal room) runs in well under a second; 2 minutes gives a slow filesystem or a large room generous headroom without letting a hung script tie up the MCP server indefinitely. chain-executor.cjs's own EXEC-06 maxSteps brake (default 25) independently bounds how many steps a chain can dispatch; this constant only bounds ONE step's spawn duration."
  - "Leg 2 (Tier-1 honest failure) uses the REAL, unmodified /mos:snapshot command against a hostile REAL room fixture (exports/ pre-occupied by a plain file, so generate-hub.cjs throws ENOTDIR and exits non-zero) rather than a synthetic registry join. The plan's own behavior spec offered this as one of two valid options ('a room where the script cannot produce its artifact' OR 'a synthetic registry entry pointing at a script that exits non-zero') -- the real-room path is closer to the actual defect surface and needed zero synthetic-registry machinery."
  - "Legs 6 (containment) and 7 (bounded timeout) DO use the synthetic-registry seam (context.registryPath), since neither scenario exists in the real registry today. Leg 6 reuses the REAL scripts/generate-hub.cjs (a real, containment-passing script) with a hostile synthetic `produces` field. Leg 7 needed a script that deterministically outlives a short timeout, which does not exist in the shipped registry, so a tiny ephemeral sleep-fixture .cjs file is written under tests/.tmp-237-07-sleep-fixture/ (inside the plugin root, satisfying scriptPathFor's containment check, which is NOT test-relaxable) and deleted immediately after use, plus a process.on('exit') safety-net delete."
  - "The declared-script containment root (PLUGIN_ROOT, via scriptPathFor) is fixed and NOT overridable by opts/context, even in test mode -- only WHICH registry file to read is test-injectable (context.registryPath), never WHERE a declared script is allowed to live. This is a deliberate asymmetry: T-237-07-04 requires the script-path guarantee to hold even under test injection, so a synthetic join can only ever point at scripts that already live inside the real repo."
  - "chain_step_dispatched (new label) vs chain_step_executed (legacy, fabricated-success label) -- no migration of historical rows. Rewriting history would be a second falsification (T-237-07-07, accepted and disclosed, inherited unchanged from 237-RESEARCH.md's own framing)."

patterns-established:
  - "Mutation proof for a fabricated-success gate: reintroduce the exact production defect (quality: 'high' in place of quality: null) directly in the working tree, run the real gate file unmodified, observe the specific assertion (not just 'a' failure) go red, restore byte-identical, confirm git status --porcelain clean on the touched file. Distinct from the tmp-copy mutation pattern (Leg 9, used for chain-step-dispatcher.cjs's own OWN internal proof) -- both were run in this plan, one against a tmp copy (never touches the working tree) and one live against the real file (the Task 2 acceptance criterion's own 'demonstrated live not asserted' requirement)."

requirements-completed: [REACH-01]

duration: 55min
completed: 2026-07-29
---

# Phase 237 Plan 07: Two-Tier Honest Step Dispatcher Summary

**lib/core/chain-step-dispatcher.cjs replaces the fabricated-success chain_run stub with a genuine spawnSync executor for script-backed steps and an honest quality:null refusal for methodology steps, proven by a 9-leg mutation-tested gate.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2/2 complete
- **Files modified:** 2 created (`lib/core/chain-step-dispatcher.cjs`, `tests/test-237-dispatcher-tiers.cjs`), 0 modified

## Accomplishments

- `lib/core/chain-step-dispatcher.cjs` (397 lines) ships the two-tier dispatcher REACH-01 requires. Tier 1 (`TIER_EXECUTABLE`) genuinely spawns a registry-declared script via `spawnSync(process.execPath, argv, ...)` -- argv array, no shell, `DISPATCH_TIMEOUT_MS` = 120000ms -- and returns `quality: 'high'` ONLY when the exit status is 0 AND the declared artifact exists on disk afterward. Tier 2 (`TIER_HOST_DISPATCH`) covers every other case (unknown command, no executable join, missing script on disk) and returns `quality: null` -- never a fabricated `'high'`, never a mistaken `'low'` -- plus a `requires_host_dispatch` directive naming `agents/framework-runner.md` and only the fields its own documented Input Contract names (`agent`, `command`, `room_path`, `target_section`).
- Both the declared script path (against the plugin root) and the declared artifact path (against the room root) are containment-checked before anything runs, mirroring `scripts/write-scope-check.cjs::targetRoomUnderRoot`'s relative-path-escape pattern.
- Both tiers log exactly one `memory_event` through `lib/core/navigation.cjs`'s caller-owned handle trio (open/log/close-in-finally), under the NEW `chain_step_dispatched` label -- deliberately distinct from the prior stub's fabricated-success `chain_step_executed` label, with zero migration of historical rows.
- `tests/test-237-dispatcher-tiers.cjs` (534 lines, 9 legs) proves: genuine Tier-1 execution against the real `/mos:snapshot` -> `scripts/generate-hub.cjs` -> `<roomDir>/exports/hub.html` fixture; an honest Tier-1 failure against a real hostile room (no synthetic registry needed); Tier-2 honesty with an EXPLICIT `assert.notStrictEqual(quality, 'high')`; a closed allowlist that spawns nothing for shell-metacharacter and path-traversal command strings; a comment-stripped source scan proving no shell/exec/execSync usage; pre-spawn artifact-containment refusal; a bounded timeout that returns in ~300ms rather than hanging for 5 seconds; Canon Part 9 routing (no direct `node:sqlite`, no direct `openRoomDb(` call, a real observable `chain_step_dispatched` row); and a tmp-copy mutation proof that reintroducing `quality: 'high'` on tier 2 turns the honesty assertion red.
- Both the weak RED (module-absent, `MODULE_NOT_FOUND`) and the REAL defect reproduction (driving `lib/mcp/tools/chain.cjs::_internal.makeDefaultOnStep` against the identical fixture shape) were captured before Task 2, per the plan's own Task 1 action paragraph -- see "RED/GREEN Evidence" below.
- A SECOND, LIVE mutation re-check (Task 2's own acceptance criterion, "demonstrated live not asserted") was run directly against the working tree's real file: changed the tier-2 return to `quality: 'high'`, ran the suite, captured the exact red assertion, reverted byte-identical, confirmed `git status --porcelain` clean. See below.

## Task Commits

1. **Task 1: Author the tier-honesty gate covering both tiers, spawn safety, artifact containment and the fabricated-quality mutation** - `b70099a4` (test)
2. **Task 2: Build lib/core/chain-step-dispatcher.cjs as the two-tier honest executor** - `a6139396` (feat)

## Files Created/Modified

- `tests/test-237-dispatcher-tiers.cjs` (new, 534 lines) - the 9-leg tier-honesty gate; standalone `node:assert` executable, async `main()` shape (mirrors `tests/test-198-chain-run-halt.test.cjs`'s own `await chainTool.chainRun(...)` + `main().catch(...)` pattern, since `dispatchStep` is async)
- `lib/core/chain-step-dispatcher.cjs` (new, 397 lines) - the two-tier dispatcher itself: `dispatchStep`, `makeChainStepDispatcher`, `resolveExecutable`, `executableCommands`, `scriptPathFor`, `TIER_EXECUTABLE`, `TIER_HOST_DISPATCH`, `DISPATCH_TIMEOUT_MS`

## Decisions Made

See `key-decisions` in the frontmatter for the full list with rationale. Summary:

- `DISPATCH_TIMEOUT_MS = 120000` (2 minutes), reasoned against the real fixture's actual runtime and `chain-executor.cjs`'s independent `maxSteps` step-count brake.
- Leg 2 (Tier-1 honest failure) uses a real hostile room, not a synthetic registry join -- one of the two options the plan's behavior spec explicitly named, chosen because it needs zero synthetic-join machinery and stays closer to the real defect surface.
- Legs 6 and 7 use the `context.registryPath` synthetic-join test seam. Leg 7's sleep fixture had to live inside the plugin root (a small file under `tests/.tmp-237-07-sleep-fixture/`, deleted immediately after use plus an exit-handler safety net) because `scriptPathFor`'s plugin-root containment check is deliberately NOT test-relaxable -- only which registry file is read is test-injectable, never where a declared script is allowed to live.
- `chain_step_dispatched` is a new label; the legacy `chain_step_executed` rows already sitting in dogfood rooms are left untouched (T-237-07-07, accepted/disclosed, unchanged from 237-RESEARCH.md's framing).

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed with all acceptance criteria green on the first implementation attempt (no auto-fix iterations were needed against the module itself).

## RED/GREEN Evidence

### Weak RED (module-absent, before Task 2)

```
$ node tests/test-237-dispatcher-tiers.cjs
node:internal/modules/cjs/loader:1433
  throw err;
Error: Cannot find module '.../lib/core/chain-step-dispatcher.cjs'
...
code: 'MODULE_NOT_FOUND'
Node.js v22.23.1
EXIT: 1
```

### Real defect reproduction (chain.cjs::_internal.makeDefaultOnStep against the identical fixture, captured separately per the plan's Task 1 action)

```
=== REPRO: chain.cjs::_internal.makeDefaultOnStep against the SC1 fixture ===
command dispatched: /mos:snapshot
outcome.quality: "high"
outcome.chain_output: {
  "step": 1,
  "command": "/mos:snapshot",
  "memory_event": { "ok": true, "eventId": "memory_event:mcp_client_event_logged:...:70a633ab" }
}
exports/hub.html exists on disk: false

DEFECT CONFIRMED: quality:'high' fabricated while the declared artifact was NEVER created (the script never ran).
memory_event labels present: ["chain_step_executed"]
```

This is the exact shape 237-RESEARCH.md's REACH-01 section names: a fabricated `quality: 'high'`, zero artifact, logged under the legacy label.

### GREEN (post-Task-2, all 9 legs)

```
$ node tests/test-237-dispatcher-tiers.cjs
  ok  1a..1h  (Tier 1 genuine execution, hub.html present, quality: 'high')
  ok  2a..2e  (Tier 1 honest failure, real hostile room, quality: 'low', never 'high')
  ok  3a..3h  (Tier 2 honesty, quality === null, explicit notStrictEqual !== 'high')
  ok  4       (closed allowlist, 3 hostile command strings, spawns nothing)
  ok  5a..5e  (no-shell source scan)
  ok  6a..6d  (artifact containment, pre-spawn refusal, nothing created outside room)
  ok  7a..7d  (bounded timeout, 300ms override, elapsed 334ms not 5000ms)
  ok  8a..8c  (Part 9: no node:sqlite, no direct openRoomDb(, real chain_step_dispatched row observed)
  ok  9a..9b  (tmp-copy mutation proof: reintroducing quality:'high' on tier 2 turns Leg-3's own assertion red)

test-237-dispatcher-tiers: all checks passed
EXIT: 0
```

### Live mutation re-check (Task 2 acceptance criterion, demonstrated against the working tree's real file, not just the tmp-copy Leg 9)

```
$ # edited lib/core/chain-step-dispatcher.cjs in place: quality: null, -> quality: 'high',
$ node tests/test-237-dispatcher-tiers.cjs
  ...
  ok  3f: dispatch.target_section carries context.targetSection
  FAIL  3g: quality === null for Tier 2, never a fabricated value
AssertionError [ERR_ASSERTION]: 3h: EXPLICIT assertion: quality !== 'high' for a Tier-2 refusal
EXIT: 1

$ # reverted byte-identical (diff against pre-mutation backup: IDENTICAL)
$ node tests/test-237-dispatcher-tiers.cjs
  ... all checks passed
EXIT: 0
$ git status --porcelain lib/core/chain-step-dispatcher.cjs
(empty)
```

## Full Verification Sweep

All commands from the plan's `<verification>` block, run after both commits:

1. `node tests/test-237-dispatcher-tiers.cjs` -> exit 0, 9/9 legs
2. `node tests/test-237-executable-seam.cjs` -> exit 0 (9 legs, Phase 237-05's gate, unaffected)
3. `node tests/test-198-local-only.test.cjs` -> exit 0, "20 of 20 198 modules present, zero Brain-egress token"
4. `node tests/test-198-chain-run-halt.test.cjs` -> exit 0, 18 assertions (chain_run halt/resume behavior unaffected -- this plan does not touch `chain.cjs` or `chain-executor.cjs`; Plan 08 owns that rewire)
5. `node scripts/build-connector-registry.cjs --check` -> exit 0 ("connector-registry: OK")
6. `bash tests/run-all-237.sh` -> `Passed: 13  Failed: 1  Skipped: 1`. The 1 failure (`tests/test-act-on-runchain.cjs`, "REGRESSION act-command adapted decideFn still reaches decide()") is the SAME pre-existing, unrelated staleness documented in `.planning/phases/237-reach-mechanism/deferred-items.md` item 1 and in STATE.md's Wave 2 close-out entry -- confirmed here again by grepping the failing test file for any reference to `chain-step-dispatcher` or `makeDefaultOnStep` (zero hits: this plan's files are never touched by that test). The 1 skip (`tests/test-237-approve-executes.cjs`) is expected: that file is Plan 08's own output, not yet landed.
7. `git status --porcelain` after both commits -> empty (only the two declared `files_modified` were ever touched)
8. `git status --porcelain data/command-registry.json` -> empty throughout (the synthetic-join legs never touch the generated file)

All 8 verification commands pass exactly as the plan specifies.

## Registry-Injection Seam Used By The Tier Test

`context.registryPath` (plumbed through `dispatchStep`'s `context` parameter, and forwarded to `resolveExecutable`/`scriptPathFor` internally as `opts.registryPath`) is the seam. It overrides WHICH registry JSON file is read; it does NOT relax `scriptPathFor`'s plugin-root containment check on the declared script path, which stays fixed regardless of registry source. `makeChainStepDispatcher` (the production wiring Plan 08 will install) never sets this option, so production dispatch always reads the real generated `data/command-registry.json`.

## Issues Encountered

None. Both tasks' acceptance criteria passed on the first implementation attempt; no auto-fix iterations (Rules 1-3) were needed.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. All threat-model mitigations named in the plan's `<threat_model>` (T-237-07-01 through T-237-07-10, T-237-07-SC) are implemented exactly as specified and asserted by the corresponding test legs (see `patterns-established` and the leg map above). No new security-relevant surface was introduced beyond what the plan's own threat model already names.

## Next Phase Readiness

`lib/core/chain-step-dispatcher.cjs` is a complete, independently-tested, drop-in replacement shape for `lib/mcp/tools/chain.cjs`'s `makeDefaultOnStep`. Plan 08 (Wave 4, depends on 237-02 + 237-07) owns the actual rewire: replacing `makeDefaultOnStep`'s body with `makeChainStepDispatcher`, proving the approve-to-execute seam end to end (`tests/test-237-approve-executes.cjs`, currently SKIPPED in the aggregator because it does not exist yet), and the mutation proof that restoring the log-only stub turns that gate red. Nothing in this plan touched `chain.cjs` or `chain-executor.cjs` -- both remain exactly as Wave 1/2 left them, confirmed by `git status --porcelain` being empty for both files across this plan's two commits.

---
*Phase: 237-reach-mechanism*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `lib/core/chain-step-dispatcher.cjs`
- FOUND: `tests/test-237-dispatcher-tiers.cjs`
- FOUND: `.planning/phases/237-reach-mechanism/237-07-SUMMARY.md`
- FOUND commit: `b70099a4` (Task 1)
- FOUND commit: `a6139396` (Task 2)
