---
phase: 235-cirs-commit-gate-seam-liveness-helper
plan: 02
subsystem: infra
tags: [cirs, born-wired, seam-liveness, mcp-tools, coverage-ledger, mutation-testing, canon-part-11]

# Dependency graph
requires:
  - phase: 198-04
    provides: listMcpToolConnectorDescriptors() and the MCP-tool connector projection, the silently-swallowing path whose blind spot this plan closes
  - phase: 172-13
    provides: the R9 gap HARD-FAIL in main() --check, generic over report.surfaces, which now catches a dead MCP tool file with zero changes to main()
  - phase: 172-01
    provides: coverageReport() / serializeLedger() / the wired-XOR-excluded ledger this plan widens
  - phase: 235-01
    provides: the pre-commit hook that actually runs the gate this plan widens (without it the widening would be inert at commit time)
provides:
  - lib/core/seam-liveness.cjs, a generic repo-wide seam-liveness primitive with four named wrappers
  - listMcpToolClaimedSources() + listMcpToolFileHealth() in scripts/build-connector-registry.cjs
  - coverageReport() extended to a two-slice census (command/skill/agent files PLUS claimed MCP tool files)
  - data/connector-coverage-ledger.json carrying the 10 mcp_tool surfaces
  - tests/test-235-seam-liveness-mcp-coverage.cjs (fixtures + self-updating census + textual wiring proof)
affects: [237, 238, 239, release-process, any phase adding a lib/mcp/tools/*.cjs file]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Census versus probe: enumerate what the repo CLAIMS from disk without requiring anything, then probe separately, so the gap between the two censuses IS the dead seam"
    - "Shared liveness primitive over a per-call-site reimplementation, so the same seam shape is checked the same way everywhere"
    - "Self-updating census assertion: both sides of the equality are computed at run time, so the test never needs editing when a tool file is added"
    - "Additive enum member alongside a closed set, never inside it, so a floor test that checks membership (not size) stays green"

key-files:
  created:
    - lib/core/seam-liveness.cjs
    - lib/core/seam-liveness.test.cjs
    - tests/test-235-seam-liveness-mcp-coverage.cjs
  modified:
    - scripts/build-connector-registry.cjs
    - data/connector-coverage-ledger.json
    - tests/test-connector-coverage-ledger.cjs

key-decisions:
  - "A liveness probe that THROWS counts as dead, not as a crash: a broken check is exactly as untrustworthy as a missing far end"
  - "Zero claims is vacuously live: a seam that claims nothing cannot be dead, so malformed input degrades to ok rather than throwing"
  - "No options object anywhere in seam-liveness.cjs, mirroring statusline-liveness-gate.cjs: a verdict a caller can override is not a verdict"
  - "mcp_tool is an ADDITIVE fifth member of SURFACE_CLASS_ENUM, never a member of FOUR_CLASSES, because an MCP tool file is a module-liveness surface not a governance class"
  - "The dead/live decision inside coverageReport() is delegated to the shared helper and never duplicated inline, so the textual wiring proof and the behavioral census proof cover the same call"
  - "The old coverage-ledger parity test was SPLIT (per-slice plus full census), not relaxed, so widening the census did not weaken the invariant"

patterns-established:
  - "Any future seam (hook matcher, enqueue consumer, minted gate, claimed module) is checked through lib/core/seam-liveness.cjs rather than a local reimplementation"
  - "A new lib/mcp/tools/*.cjs file that throws at require time or forgets its connectors export is now a HARD-FAIL gap at commit and release"

requirements-completed: [CIRS-02]

# Metrics
duration: 45min
completed: 2026-07-28
---

# Phase 235 Plan 02: Seam-Liveness Helper + MCP Coverage Summary

**MCP tool files are now inside CIRS's wired-XOR-excluded invariant, routed through a new generic seam-liveness primitive (`lib/core/seam-liveness.cjs`) that any future phase can reuse for hook-matcher, enqueue-consumer, and mint-ratifier liveness instead of reinventing it.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-28
- **Completed:** 2026-07-28
- **Tasks:** 3 (Task 1 run as TDD: RED commit then GREEN commit)
- **Files modified:** 6 (3 created, 3 modified)

## What was actually broken (root cause, in plain terms)

CIRS's job is simple to state: every invocable surface is born WIRED or EXCLUDED, and the build fails closed if one is neither. The function that decides this is `coverageReport()` in `scripts/build-connector-registry.cjs`. It is the source of truth for the R9 gap hard-fail that both `--check` and the pre-commit hook run.

It walked `listSourceFiles()` only: commands, skills, agents. **It never looked at MCP tool files at all.**

There WAS a separate MCP path, `listMcpToolConnectorDescriptors()`, but it answers a different question. It asks "what loaded?", and it answers by requiring each file inside `try { ... } catch (_e) { continue }` and reading `mod.connectors`. Both failure modes vanish without a trace:

- a file that **throws at require time** contributes nothing and is skipped silently
- a file that **forgets its `connectors` export** yields an empty array, which is indistinguishable from a file that legitimately has no connectors

So a new MCP tool could be born dark, the born-wired gate would stay green, and the gate's own printed recovery command (`node scripts/build-connector-registry.cjs`) would just regenerate the registry missing the same entries. The gate would confirm its own blindness.

The fix is a census-versus-probe split. `listMcpToolClaimedSources()` answers **"what does the repo claim should be there?"** purely from the filesystem, requiring nothing, so it cannot be fooled by a load failure. `listMcpToolFileHealth()` probes each claimed source and reports the load error or the missing export instead of swallowing it. The gap between the two censuses is the dead seam, and it is now a `gap`-state surface that `main()`'s pre-existing generic `state === 'gap'` filter hard-fails on with **zero changes to `main()`**.

The higher-leverage half: that "a claim on one side, unverified reachability on the other" shape is not unique to CIRS. This session's audit found roughly ten instances of it in pieces CIRS's build-time enumeration was never designed to reach. So the dead/live decision lives in a new generic module, `lib/core/seam-liveness.cjs`, and CIRS-02's own fix is its first consumer rather than a CIRS-local patch.

## Task Commits

1. **Task 1 (RED): failing seam-liveness proof** - `077b55eb` (test)
2. **Task 1 (GREEN): the generic seam-liveness helper** - `dfd83599` (feat)
3. **Task 2: MCP tool files inside the born-wired coverage gate** - `a6d89c8c` (fix)
4. **Task 3: mutation-proof the CIRS-MCP integration** - `4666486e` (test)

## Files Created/Modified

- `lib/core/seam-liveness.cjs` - `assertSeamLive(seam)` generic core plus four named wrappers (`checkHookMatcherLiveness`, `checkEnqueueConsumerLiveness`, `checkMintRatifierLiveness`, `checkClaimedModuleLiveness`). Exactly five exports, nothing else.
- `lib/core/seam-liveness.test.cjs` - the 10 behavior cases: three dead-seam shapes each paired with a live control, the generic core both ways, the claimed-module wrapper, and the malformed-input degrade.
- `scripts/build-connector-registry.cjs` - `CLASS_MCP_TOOL` additive enum member, the `listMcpToolClaimedSources()` / `listMcpToolFileHealth()` discovery pair, the seam-liveness require, the `coverageReport()` MCP walk, three new exports.
- `data/connector-coverage-ledger.json` - regenerated: 187 wired / 69 excluded / 0 gap, 256 surfaces (was 246), the 10 new `mcp_tool_file:*` entries all `wired`.
- `tests/test-235-seam-liveness-mcp-coverage.cjs` - 14 assertions across the three required groups.
- `tests/test-connector-coverage-ledger.cjs` - Test 1 split into a per-slice parity check plus a full-census check (see Deviations).

## Consultation performed (Objective + Task 2 requirement)

The plan bound two consults before writing the hook-matcher wrapper's fixture shape or touching the registry generator. Both were performed by the orchestrator and their outcomes are recorded as code comments above `checkHookMatcherLiveness` in `lib/core/seam-liveness.cjs`.

**Method note (honest reporting):** as in Plan 01, this executor context exposes no Skill or Task tool, so the `claude-api` skill and `claude-code-guide` agent were not invocable from inside the run itself. The findings below came from the orchestrator, and the first one was independently re-verified against direct repo evidence before being written down.

**(a) Hook-matcher / MCP tool-name shape.** The correct current form is `mcp__<server>__<tool>`, double underscore between server and tool. Verified in this repo, not assumed: `hooks/hooks.json` lines 236 and 338 already carry `"matcher": "mcp__brain_.*"` on its `PreToolUse` / `PostToolUse` entries, and the same convention is visible in live registered tool names such as `mcp__langtalks-graph-expert__query_relationship`.

The load-bearing gotcha, and the reason the wrapper needs to exist at all: **Claude Code evaluates a hook matcher per tool-call event and never validates it against a live tool registry at startup.** A matcher naming a tool that has been removed does not warn and does not error. It silently stops firing, forever. That silent no-op is precisely the dead seam the product gives no signal for, which is why an external liveness assertion is the only way to catch it.

**(b) langtalks-graph-expert prior art.** A direct `query_relationship` call for "liveness or health checking of registered tool surfaces in agent/LLM tool-use systems" returned zero relationship edges (`"edges": []`). Not in the corpus yet. Per this repo's own grounding rule that is a valid and expected answer, so nothing is cited from it rather than papering the gap with an invented source.

## Verification (mutation-proofed, not asserted)

The plan's full `<verification>` block, run in order:

| # | Command | Exit |
|---|---------|------|
| 1 | `node lib/core/seam-liveness.test.cjs` | 0 (10/10) |
| 2 | `node scripts/build-connector-registry.cjs --check` | 0 on the real tree |
| 3 | `node tests/test-cirs-four-class-floor.cjs` | 0 (23 assertions) |
| 4 | `node tests/test-235-seam-liveness-mcp-coverage.cjs` | 0 (14/14) |
| 5 | `git diff --stat data/connector-coverage-ledger.json data/connector-registry.json` | ledger changed (+61/-1), registry UNCHANGED |

`data/connector-registry.json` is untouched: its last commit is still `33677a8f` (Phase 234-04), confirming this plan modified `coverageReport()` and not `buildRegistry()`, exactly as the plan required.

### The live mutation-and-revert check (Task 3 acceptance criterion)

The whole MCP-tool-file loop inside `coverageReport()` (the `listMcpToolFileHealth()` call, the `checkClaimedModuleLiveness()` call, and the surface-push loop, 20 lines) was commented out in place, the test re-run, then the file restored byte-for-byte from a backup and re-run. Observed red:

```
  FAIL  (2) coverageReport() reports at least one mcp_tool surface (0)
  FAIL  (2) coverageReport() mcp_tool surface count === listMcpToolClaimedSources() count (0 === 10)
  FAIL  (2) the full census === command+skill+agent files + claimed MCP tool files

test-235-seam-liveness-mcp-coverage: 3 FAILURE(S)
```

That is exactly the regression shape the census assertion exists to catch: the claimed-source count stays at 10 while the reported surface count silently drops to 0. After restore, `git diff --stat scripts/build-connector-registry.cjs` was empty (identical to the committed file), `grep -c MUTATION` returned 0, and the test returned 14/14 green. **No mutation remains in the final diff.**

Note that group (3), the textual wiring proof, correctly stayed green under this particular mutation because the commented-out text still contains the substring. That is the reason the plan required BOTH proofs: group (3) catches a deletion, group (2) catches a bypass. Together they cover both directions.

### Phase aggregator (the plan's stated exit condition)

```
Phase 235: PASS=6 FAIL=0 SKIP=0
```

Full green, up from Plan 01's `PASS=4 FAIL=0 SKIP=1`. The SKIP was `lib/core/seam-liveness.test.cjs` not existing yet; it now runs and passes 10/10.

### No-regression sweep

`bash tests/run-all-172.sh` (the CIRS suite, wired into the release-verification chain): **Total 20, Passed 20, Failed 0.** Also verified individually: `node scripts/build-orchestration-projection.cjs --check` exit 0, `node scripts/check-render-coverage.cjs` exit 0, `tests/test-cirs-adversarial-verify.cjs` exit 0 (its `counts.gap === 0` assertion holds with the 10 new surfaces present).

## Decisions Made

- **A throwing probe counts as dead, not as a crash.** If the liveness check itself is broken, the seam is not provably alive, and "not provably alive" is the same operational state as "dead". Letting the exception escape would turn a reportable dead seam into a build crash with a worse error message.
- **Zero claims is vacuously live.** A seam that claims nothing cannot have a dead far end. This makes `assertSeamLive({})` return ok rather than throw, which matters because the wrappers are called with possibly-empty arrays from real discovery code.
- **No options object anywhere.** `statusline-liveness-gate.cjs`'s "a gate that cannot fail is not a gate" discipline, carried forward literally: none of the five functions accept a second parameter, so there is no place to pass a force-green flag.
- **`mcp_tool` as an additive fifth enum member, not a fifth governance class.** `FOUR_CLASSES` is a closed set of governance classes (mechanical / framework / intelligence / pipeline). An MCP tool file is not a methodology, it is a module-liveness surface, so it sits alongside `utility-excluded`. The four-class floor test deliberately never asserts a class count (its own header says so) precisely to allow this.
- **The census assertion is computed on both sides at run time.** A hardcoded "expect 10" would rot the day someone adds a tool file, and the natural fix would be to bump the literal, which trains people to edit the gate instead of trusting it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/test-connector-coverage-ledger.cjs` Test 1 hard-asserted the old one-slice census**

- **Found during:** Task 2, immediately after the `coverageReport()` edit
- **Issue:** Test 1 asserted `report.surfaces.length === listSourceFiles().length`, an exact identity that only held while the census had one slice. Widening the census turned it red on the first run: `FAIL coverageReport().surfaces covers every command+skill+agent file (256 === 246)`. This is the same class of blocker the plan itself flagged for `SURFACE_CLASS_ENUM`, in a second file the plan's `read_first` did not name. It is wired into `tests/run-all-172.sh`, which is part of the release-verification chain, so leaving it red would have broken releases.
- **Fix:** SPLIT the assertion rather than relaxing it. The command/skill/agent SLICE must still cover every such file exactly (`fileSourced.length === total`), AND the full census must equal that total plus `listMcpToolClaimedSources().length`. Nothing can fall outside both slices, so the invariant is strictly stronger than before, not weaker. Rationale written into the test as a comment so a future reader does not "restore" the single-identity form.
- **Files modified:** `tests/test-connector-coverage-ledger.cjs`
- **Verification:** both new assertions green (`246 === 246`, `256 === 246 + 10`); the whole file exits 0; `run-all-172.sh` 20/20.
- **Committed in:** `a6d89c8c` (Task 2 commit)

**2. [Rule 2 - Missing correctness] `coverageReport()`'s docstring stated an invariant the code no longer holds**

- **Found during:** Task 2
- **Issue:** The header comment asserted `surfaces.length === the total command+skill+agent file count`. After the widening that is false, and this docstring is exactly what a future maintainer would read before "fixing" the count back down.
- **Fix:** Rewrote the invariant statement to name both slices explicitly and restate the XOR partition in the widened terms.
- **Files modified:** `scripts/build-connector-registry.cjs`
- **Committed in:** `a6d89c8c` (Task 2 commit)

**3. [Process, not a code change] Task 1 executed as a TDD RED/GREEN pair**

The plan marks Task 1 `tdd="true"`, so it produced two commits rather than one: `077b55eb` (the test file alone, failing with `MODULE_NOT_FOUND` because `lib/core/seam-liveness.cjs` did not exist) then `dfd83599` (the implementation, 10/10 green). Noted here only so the four-commit count against a three-task plan is not read as a discrepancy. No REFACTOR commit was needed.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 correctness) plus 1 process note
**Impact on plan:** Deviation 1 was mandatory. Without it the plan would have shipped a red release-chain test, which is the same "gate that reads green while something is broken" failure this phase exists to eliminate, just inverted. No file outside the plan's `files_modified` was touched except that one test, and it was strengthened rather than weakened.

## Issues Encountered

- **Consultation sources not invocable inside the executor context** (same constraint Plan 01 hit: no Skill or Task tool exposed). The findings were supplied by the orchestrator; finding (a) was independently re-verified against `hooks/hooks.json` before being written into the code comment, so nothing rests on an unverified assertion.
- **Pre-existing, out of scope, unchanged:** D-235-01-a in `deferred-items.md` (the four skills declaring both a `hitl_shape` and `connector.excluded: true`, which block `release.sh --strict-shape`) is untouched by this plan.

## Known Stubs

None. Every function added here is called by a real code path and exercised by a real test. `lib/core/seam-liveness.cjs`'s three non-CIRS wrappers (`checkHookMatcherLiveness`, `checkEnqueueConsumerLiveness`, `checkMintRatifierLiveness`) have no production consumer YET, by design: the plan's stated purpose is to leave a tested primitive for Phases 237/238/239. They are not stubs (each is fully implemented and proven red-and-green by its own paired fixtures), but they are deliberately ahead of their consumers.

## Threat Flags

None. No network endpoint, no auth path, no schema change at a trust boundary. The plan's register is addressed as declared: T-235-04 mitigated (the MCP blind spot is now a hard-fail gap proven by a census test), T-235-05 accepted (require() error messages name only the repo's own source files, never user data, Part 8 unaffected), T-235-06 accepted (requiring a repo-local `.cjs` is the same trust level this generator already operated at).

## User Setup Required

None.

**One thing worth knowing:** because MCP tool files are now inside the born-wired gate, a new `lib/mcp/tools/*.cjs` that throws at require time or forgets its `connectors` export will be **rejected at commit**, naming the file and the reason. That is the gate doing its job on a surface it was previously blind to, not a new restriction on healthy files. All 10 current claimed sources are healthy and `--check` is green.

## Next Phase Readiness

- Phases 237 / 238 / 239 can consume `lib/core/seam-liveness.cjs` directly for their own hook-matcher / enqueue-consumer / mint-ratifier liveness proofs. The wrappers, their argument shapes, and their red/green behavior are already fixed by `lib/core/seam-liveness.test.cjs`.
- `tests/run-all-235.sh` is now full green (`PASS=6 FAIL=0 SKIP=0`); the phase has no remaining SKIP.
- Still open for a future phase: D-235-01-a in `deferred-items.md`.

---
*Phase: 235-cirs-commit-gate-seam-liveness-helper*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 7 claimed files verified present on disk; all 5 claimed commit hashes verified
present in git history; no uncommitted changes remain in any path this plan owns;
zero em-dashes in any file this plan created.
