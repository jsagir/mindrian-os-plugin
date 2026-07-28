---
phase: 237-reach-mechanism
plan: 05
subsystem: infra
tags: [registry, seam-liveness, chain-dispatcher, node-cjs, mutation-testing]

requires:
  - phase: 235-seam-liveness
    provides: "lib/core/seam-liveness.cjs::assertSeamLive, the generic claim/probe verdict primitive"
  - phase: 237-02
    provides: "recipe-maps.cjs as the one classification authority (autonomy parity), the registry this plan's executable join sits alongside"
provides:
  - "data/command-registry.json commands[].executable, a build-time-generated allowlist of {script, args, produces}, null when a command declares none"
  - "commands/snapshot.md's executable: frontmatter block naming scripts/generate-hub.cjs -> exports/hub.html, the first populated fixture"
  - "tests/test-237-executable-seam.cjs, a seam-liveness consumer proving every executable claim in the registry names a real file on disk"
affects: [237-07, 237-08]

tech-stack:
  added: []
  patterns:
    - "Seam-liveness consumption: call lib/core/seam-liveness.cjs::assertSeamLive with { name, claims, isLive } rather than writing a bespoke wrapper for a new claim/probe shape"
    - "Repo-root containment check before any filesystem probe of an authored path (path.resolve + path.relative + '..'/absolute rejection), mirroring scripts/write-scope-check.cjs::targetRoomUnderRoot"

key-files:
  created:
    - tests/test-237-executable-seam.cjs
  modified:
    - scripts/build-command-registry.cjs
    - commands/snapshot.md
    - data/command-registry.json
    - skills/snapshot/SKILL.md
    - data/harness-manifest.json
    - data/help-groups.json

key-decisions:
  - "Task 1's A3 probe path: the unknown executable: frontmatter key was tolerated as-is by all three blocking gates (connector-registry, orchestration-projection, render-coverage); no additive gate schema change was needed. check-shape-declaration.cjs remained advisory (WARN, non-blocking) as expected."
  - "Task 2 consumed the generic assertSeamLive primitive directly, never a fifth wrapper; lib/core/seam-liveness.cjs carries a zero-line diff."
  - "isLive never requires/evals/execs/spawns the claimed script; it only resolves the path under the repo root and checks fs.existsSync + statSync(...).isFile()."
  - "Added a fourth leg beyond the plan's minimum three (real seam, positive control, seeded-dead fixture): a path-traversal fixture asserting a claim that escapes the repo root resolves to dead, not followed -- directly proving T-237-05-02 rather than only implementing the guard."

patterns-established:
  - "Mutation proof for a seam-liveness consumer: rename the real claimed artifact on disk, re-run the test file unmodified, capture the non-zero exit and the named dead entry, restore, confirm git status clean on the touched directory."

requirements-completed: [REACH-01]

duration: 45min
completed: 2026-07-29
---

# Phase 237 Plan 05: Executable Registry Join + Seam-Liveness Gate Summary

**Build-time `executable` allowlist landed in the generated command registry and proven live by a seam-liveness consumer that catches a renamed or deleted claimed script, mutation-demonstrated red then restored green.**

## Performance

- **Duration:** ~45 min (this session, Task 2 only; Task 1 was executed and committed in a prior session)
- **Tasks:** 2/2 complete
- **Files modified (this session, Task 2):** 1 created (`tests/test-237-executable-seam.cjs`)
- **Files modified (Task 1, prior session, commit `f95fa0c6`):** `scripts/build-command-registry.cjs`, `commands/snapshot.md`, `data/command-registry.json`, plus lockstep regen of `skills/snapshot/SKILL.md`, `data/harness-manifest.json`, `data/help-groups.json`

## Accomplishments

- `data/command-registry.json` carries an explicit, build-time-generated `commands[].executable` join on every entry (`null` for commands with no script behind them). `/mos:snapshot` declares `scripts/generate-hub.cjs` with `args: ["${ROOM_DIR}"]` and `produces: exports/hub.html`.
- Research assumption A3 (whether the check gates tolerate an unknown frontmatter key) is resolved with evidence, not left open: all three blocking gates tolerated the new `executable:` key as-is; no additive schema change was needed anywhere.
- A seam-liveness gate (`tests/test-237-executable-seam.cjs`) now proves every executable claim in the registry names a file that actually exists, using the Phase 235 generic `assertSeamLive` primitive with zero modification to that module.
- The gate is mutation-proven: renaming the real claimed script (`scripts/generate-hub.cjs`) live-turned the gate red naming `/mos:snapshot` in `dead`; reverting restored green with `git status --porcelain scripts/` empty.

## Task Commits

1. **Task 1: Probe the check gates against an unknown frontmatter key, then teach the registry builder to emit the executable join** - `f95fa0c6` (feat) -- executed and committed in a prior session, not touched or redone in this session
2. **Task 2: Consume the Phase 235 seam-liveness primitive to prove every executable claim names a real script** - `836db461` (test)

## Files Created/Modified

### Task 1 (prior session, commit `f95fa0c6`, referenced for completeness, not re-touched here)
- `scripts/build-command-registry.cjs` - added an `executable` frontmatter pickup mirroring the existing `produces` derivation; emits `null` for any non-conforming block rather than throwing
- `commands/snapshot.md` - added the `executable:` frontmatter block (script/args/produces), the SC1 fixture
- `data/command-registry.json` - regenerated; every command entry now carries `executable` (null or populated)
- `skills/snapshot/SKILL.md`, `data/harness-manifest.json`, `data/help-groups.json` - regenerated in lockstep / fixed two unrelated pre-existing gaps per that commit's own message

### Task 2 (this session, commit `836db461`)
- `tests/test-237-executable-seam.cjs` (new, 218 lines) - seam-liveness consumer over the real registry (real-seam leg + positive control), a seeded-dead in-memory fixture, and a path-traversal fixture; never mutates the working tree itself

## Decisions Made

- **A3 probe outcome (Task 1, verified independently this session by re-running the gates against the current tree state):**
  - `node scripts/build-connector-registry.cjs --check` -> exit 0
  - `node scripts/build-orchestration-projection.cjs --check` -> exit 0
  - `node scripts/check-render-coverage.cjs` -> exit 0 (16 covered, 0 gap)
  - `node scripts/check-shape-declaration.cjs --check` -> exit 0 (advisory WARNs present, as expected under the Phase 210 non-blocking contract; unrelated to `executable:`)
  - Path taken: **key tolerated as-is**. No gate needed an additive schema change to accept the new `executable:` frontmatter block.
- **No fifth wrapper.** `assertSeamLive` was called directly with `{ name, claims, isLive }`; `checkMintRatifierLiveness`, `checkEnqueueConsumerLiveness`, and `checkClaimedModuleLiveness` were confirmed the wrong fit (per the module's own header) and are not invoked anywhere in the new test file (grep-verified: 0 hits).
- **Traversal guard added beyond the plan's literal minimum.** The plan's threat model (T-237-05-02) requires `isLive` to reject a resolved path outside the repo root; this was implemented as `resolveUnderRoot()` (mirroring `scripts/write-scope-check.cjs::targetRoomUnderRoot`'s containment check) and given its own fourth test leg rather than only being implemented and left unasserted.

## Deviations from Plan

None - Task 2 executed exactly as specified. The traversal-guard fourth leg is an assertion of a threat-model mitigation the plan's own Task 2 action paragraph explicitly requires ("resolve the declared script against the repo root with path.resolve, assert the resolved path stays under the repo root") -- adding a test leg for a mitigation the plan already mandates is not scope creep, it is proving the mandate.

## Mutation Proof Evidence

**Rename (RED):**
```
$ mv scripts/generate-hub.cjs scripts/generate-hub.cjs.renamed-for-mutation-proof
$ node tests/test-237-executable-seam.cjs
  ok  1a: the real registry carries at least one executable claim (claimedCount > 0, the gate can fail)
  FAIL  1b: every real executable claim names a live script (ok:true, dead: ["/mos:snapshot"])
  FAIL  1c: the dead list is empty for the real registry
  ok  2a: /mos:snapshot is among the real executable claims (caught by name, not only by count)
  FAIL  2b: /mos:snapshot resolved script path exists on disk (scripts/generate-hub.cjs)
  ok  3a: the seeded-dead fixture reports ok:false
  ok  3b: the missing entry (/mos:does-not-exist) appears in dead
  FAIL  3c: the live entry (/mos:snapshot) in the same fixture is not flagged dead
  ok  4: a claimed script path that escapes the repo root is treated as dead, never followed

test-237-executable-seam: 4 FAILURE(S)
EXIT CODE: 1
```

**Restore (GREEN):**
```
$ mv scripts/generate-hub.cjs.renamed-for-mutation-proof scripts/generate-hub.cjs
$ node tests/test-237-executable-seam.cjs
  ok  1a ... ok  1b ... ok  1c ... ok  2a ... ok  2b ... ok  3a ... ok  3b ... ok  3c ... ok  4
test-237-executable-seam: all checks passed
EXIT CODE: 0
$ git status --porcelain scripts/
(empty)
```

## Issues Encountered

- `bash tests/run-all-237.sh` reports one pre-existing, unrelated failure: `REGRESSION act-command adapted decideFn still reaches decide()` (`tests/test-act-on-runchain.cjs`). Confirmed pre-existing and unrelated to this plan by reproducing it against a `git stash`-clean copy of the tree at Task 1's commit (`f95fa0c6`), before `tests/test-237-executable-seam.cjs` existed -- it fails identically. This matches the prior session's own STATE.md finding (tracked as `deferred-items.md` item 1, a stale render-baseline fixture predating an earlier `FIRE-IF-FORK` block). Not fixed here: out of Task 2's `files_modified` and out of this plan's scope entirely.
- `REACH-01 executable seam-liveness: PASSED` confirmed in the full aggregator run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The closed, build-time-generated executable allowlist (`data/command-registry.json commands[].executable`) is now proven live, which is the safety property 237-07's `lib/core/chain-step-dispatcher.cjs` (the one genuine privilege increase in this phase: spawning a child process from the MCP server) depends on. 237-07 and 237-08 were both blocked behind this plan per their `depends_on` frontmatter; that dependency is now cleared.

---
*Phase: 237-reach-mechanism*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `tests/test-237-executable-seam.cjs`
- FOUND: `.planning/phases/237-reach-mechanism/237-05-SUMMARY.md`
- FOUND commit: `836db461` (Task 2)
- FOUND commit: `f95fa0c6` (Task 1)
