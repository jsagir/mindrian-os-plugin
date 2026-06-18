---
phase: 167-harness-manifest-and-surface-generator
plan: 04
subsystem: infra
tags: [harness-as-code, new-surface-generator, connector-frontmatter, transitive-landing, shell-out, frozen-banks, part8]

# Dependency graph
requires:
  - phase: 167-01
    provides: scripts/build-harness-manifest.cjs (the manifest generator + --check the emitter shells out to) + data/harness-manifest.json (the 3-map digest the surface lands in transitively)
  - phase: 143.3
    provides: scripts/build-connector-registry.cjs (the connector-registry generator + the 11-key CONNECTOR_KEYS the emitted frontmatter mirrors) + docs/CONNECTOR-CONTRACT.md (the contract)
  - phase: 141/148
    provides: lib/core/sensors/sensor-types.cjs REACH_IDS (the frozen 6) + POSTURE_IDS (the frozen 3) the emitter validates against
provides:
  - scripts/build-new-surface.cjs (the deterministic surface emitter + connector-registry + manifest regen + a categorized --check)
  - commands/new-surface.md (the /mos:new-surface command surface, its own conformant 11-key connector block, surface F.1)
  - tests/test-new-surface-generator.cjs (the 5-behavior generator test)
  - "regenerated data/connector-registry.json (58 -> 59 connectors) + data/command-registry.json (97 -> 98) + data/harness-manifest.json (transitive digest update)"
affects: [167-05-adversarial-verify-wave, future-surface-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SURFACE emitter mirrors the new-project SCAFFOLD-BACKEND deterministic-emit PATTERN (not ignite gate orchestration) + the build-connector-registry CONNECTOR_KEYS shape, adapted to surfaces (a command/agent/skill .md), not rooms"
    - "TRANSITIVE LANDING (HIGH-1): emit surface .md -> shell out (execFileSync fresh node, LOW-2) to regenerate connector-registry.json (the surface real home) THEN harness-manifest.cjs (wiring digest); NO per-surface manifest row (D-166-03)"
    - "env-overridable output base (MINDRIAN_SURFACE_OUT_DIR / opts.outDir) so a fixture emits to a tmp dir and never pollutes the real commands/ tree (LOW-5)"
    - "categorized --check taxonomy (MISSING_KEY / OFF_FROZEN / NOT_REGISTERED / MANIFEST_STALE) mirroring the Wave-1 manifest + connector --check idiom, each finding carrying a recovery line"

key-files:
  created:
    - scripts/build-new-surface.cjs
    - commands/new-surface.md
    - tests/test-new-surface-generator.cjs
  modified:
    - data/connector-registry.json
    - data/command-registry.json
    - data/harness-manifest.json
    - tests/run-all-167.sh

key-decisions:
  - "emitSurface validates spec.reach_id against the frozen 6 + spec.posture against the frozen 3 from the SINGLE frozen source (sensor-types.cjs); an off-frozen value THROWS -- a new tool identity rides sub_mode, never a 7th reach (T-167-15)"
  - "the emitter SHELLS OUT (execFileSync node, fresh processes) to regenerate the two downstream registries, NOT require()+internals -- LOW-2: identical byte-stable serialize path, no module-cache bleed"
  - "regeneration fires only when opts.cwd is set (the transitive-landing path) or in main(); a pure tmp emit (opts.outDir only) is write-only, so the test never touches the real registries"
  - "commands/new-surface.md ships framework: null + filing: none (no decision_surface that fires a command), so the WFL-01 firesCommand resolver gate does not fire -- mirroring commands/new-project.md, so the surface registers cleanly without a Brain framework"
  - "the CI --check fixture leg emits to a tmp dir via MINDRIAN_SURFACE_OUT_DIR and PASSES when --check correctly REFUSES the unregistered fixture (NOT_REGISTERED + exit 1) -- proving the gate works without mutating the real tree (LOW-5 / T-167-20)"

requirements-completed: [HARN-03, D-167-05, D-167-06]

# Metrics
duration: ~30min
completed: 2026-06-18
---

# Phase 167 Plan 04: New-Surface Generator Summary

**`/mos:new-surface` (commands/new-surface.md + scripts/build-new-surface.cjs) is the harness-as-code onboarding front door for SURFACES: given a spec it emits the correct command/agent/skill .md carrying the 11-key connector frontmatter (refusing any off-frozen reach_id or posture), then SHELLS OUT to fresh node processes to regenerate connector-registry.json (the surface real home) and the harness-manifest (the wiring digest), so a surface lands TRANSITIVELY with NO per-surface manifest row (D-166-03); a categorized --check (MISSING_KEY / OFF_FROZEN / NOT_REGISTERED / MANIFEST_STALE) proves the surface well-formed + registered + the manifest clean, the emitter makes zero Brain calls, and ignite is untouched.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 of 2 complete
- **Files created:** 3
- **Files modified:** 4

## Accomplishments

### Task 1 - scripts/build-new-surface.cjs + the generator test (commits d6cf7389 RED, a8ea50a3 GREEN)

- **TDD:** the 5-behavior test (`tests/test-new-surface-generator.cjs`) was committed RED first (module-not-found), then the generator made it GREEN (6/6 assertions).
- **emitSurface(spec, opts):** validates the spec against the frozen banks (`REACH_IDS` the 6, `POSTURE_IDS` the 3, required from `lib/core/sensors/sensor-types.cjs`), refusing an off-frozen reach_id or posture with a clear throw (a new tool identity rides `sub_mode`, never a 7th reach -- T-167-15). Composes the surface frontmatter carrying the 11 `CONNECTOR_KEYS` in the `docs/CONNECTOR-CONTRACT.md` order. Writes the .md to `commands/<name>.md` (command), `agents/<name>.md` (agent), or `skills/<name>/SKILL.md` (skill) -- a SURFACE artifact, distinct from new-project's ROOM folders. Honors an env-overridable output base (`MINDRIAN_SURFACE_OUT_DIR` / `opts.outDir`) so a test emits to a tmp dir (LOW-5). Idempotent byte-stable emission.
- **Transitive landing (HIGH-1):** after emit, when `opts.cwd` is set (or in `main()`), `regenerateDownstream` SHELLS OUT via `execFileSync('node', ['scripts/build-connector-registry.cjs'])` FIRST (the surface's real home -- closing MEDIUM-2) THEN `execFileSync('node', ['scripts/build-harness-manifest.cjs'])` (the wiring digest). Fresh processes, NOT require()+internals (LOW-2: no module-cache bleed).
- **validateSurface(spec, opts):** returns categorized `{ missing_key, off_frozen, not_registered, manifest_stale }`, each with a recovery line. `runCheck()` parses the emitted surface (reusing the shipped `parseConnectorFrontmatter`), re-validates, spawns the manifest `--check`, prints findings + recovery to stderr, exits non-zero on any finding else `new-surface: OK`.
- **main():** 3-branch -- default emits from a `--spec` file or argv flags then regenerates both registries; `--check` validates a named surface; `--refresh` re-emits idempotently. `require.main` guard exports `emitSurface` / `validateSurface` / `CONNECTOR_KEYS`.
- **Part 8:** zero Brain/network -- no `brain-client` require, no `fetch`, no http (proven by the test's forbidden-token scan + the run-all Part-8 grep sweep).

### Task 2 - commands/new-surface.md + suite registration (commit 1ff63206)

- **commands/new-surface.md:** the `/mos:new-surface` command surface, modeled on new-project's structure (frontmatter + a Larry-led flow delegating deterministic emission to the scaffold backend). Its OWN connector block is a conformant 11-key block: `connects_to_spine: true`, `reach_id: context_block`, `sub_mode: new-surface`, `framework: null`, `posture: push_forward`, `hierarchy_rank: 24`, `filing: none`, `plan_gated: false`, `web_scope: null`, `surface: F.1` (the discover.md precedent for a Larry-led generate flow). framework: null + filing: none -> the WFL-01 firesCommand gate does not fire (mirrors new-project), so the command registers cleanly.
- **Body** states explicitly: reuses the new-project SCAFFOLD-BACKEND pattern (not ignite); a SURFACE is not a ROOM (pattern reuse, not literal extension); a new tool identity rides sub_mode, never a new reach_id; a surface lands in connector-registry.json (its real home) and only TRANSITIVELY in the manifest wiring digest (no per-surface manifest row, D-166-03); bulk backfill of existing commands is OUT of scope.
- **Regenerated artifacts (MEDIUM-2):** the new command landed in all three maps transitively -- `data/connector-registry.json` (58 -> 59 connectors), `data/command-registry.json` (97 -> 98, the pre-commit hook caught this drift -- see Deviations), and `data/harness-manifest.json` (both the wiring and posture digests updated). The connector + manifest pre-commit `--check`s stay green.
- **run-all-167.sh:** registered `test-new-surface-generator.cjs` in `CJS_SUITES`; added a CI `--check` FIXTURE leg that emits a known-good fixture surface to a tmp dir via `MINDRIAN_SURFACE_OUT_DIR` (NEVER a committed commands/ file, LOW-5 / T-167-20) and asserts `--check` correctly REFUSES the unregistered fixture; added `build-new-surface.cjs` to the Part-8 sweep + the new files to the em-dash sweep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] command-registry.json drift on the new command**
- **Found during:** Task 2 commit (the pre-commit hook refused the commit).
- **Issue:** `commands/new-surface.md` is a new command with `serves_jtbd` / tracked frontmatter, so the command-registry pre-commit `--check` flagged `data/command-registry.json` as STALE. The plan's Task 2 files list named connector-registry + manifest but not command-registry.
- **Fix:** ran `node scripts/build-command-registry.cjs` (97 -> 98 commands), then re-ran `node scripts/build-harness-manifest.cjs` because the command-registry change flips the manifest's posture-map digest. Both `--check`s then green.
- **Files modified:** data/command-registry.json, data/harness-manifest.json (re-regenerated)
- **Commit:** 1ff63206

This is the harness behaving exactly as designed: a new command surface lands TRANSITIVELY across all three maps (posture / wiring / ranked_next_reach), and the pre-commit gates enforce that no map is left stale. No plan-logic deviation -- the transitive landing simply spans command-registry too for a new command.

## Authentication Gates

None.

## Known Stubs

None. The generator emits a real surface .md with a complete 11-key connector block; the real `commands/new-surface.md` is registered in all three maps (proven by `node scripts/build-new-surface.cjs --check --kind command --name new-surface` returning `new-surface: OK`); the CI fixture leg emits to tmp only. The emitted-surface body is a minimal Larry-led stub by design -- the wiring is the generated, complete artifact; the surface's actual behavior is the hand-written body the navigator edits afterward (stated in the command body Step 4).

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary schema. The emitter is LOCAL machinery (zero Brain/network, proven by the forbidden-token scan + the run-all Part-8 grep sweep over build-new-surface.cjs). Threat dispositions mitigated: T-167-15 (off-frozen reach refused by emitSurface + caught by --check OFF_FROZEN), T-167-16 (NOT_REGISTERED / MISSING_KEY / MANIFEST_STALE catch a hand-written partial surface), T-167-17 (machinery-metadata-only emit; zero Brain), T-167-18 (ignite untouched -- last modified Phase 166, never referenced by the emitter), T-167-19 (the shell-out regeneration closes the connector + manifest pre-commit --checks), T-167-20 (the CI fixture emits to tmp via the env override, never the real tree).

## Verification

- `node tests/test-new-surface-generator.cjs` -> 6 passed, 0 failed (emit 11-key to tmp + frozen reach/posture refusal + transitive landing via shell-out regen + --check categorized findings + zero Brain + ignite untouched)
- `node scripts/build-new-surface.cjs --check --kind command --name new-surface` -> `new-surface: OK` (the real command is well-formed + registered + manifest clean)
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK` (the new command's connector block conforms; the regeneration kept it green)
- `node scripts/build-command-registry.cjs --check` -> `command-registry: OK`
- `node scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`
- `bash tests/run-all-167.sh` -> Total 10, Passed 10, Failed 0
- Real commands/ tree clean: no ci-fixture-surface.md / fixture-surface.md / transitive-fixture.md leaked
- commands/ignite.md NOT modified by this phase (last touched Phase 166)
- No em-dashes in any created or modified file (codepoint sweep clean)

## Self-Check: PASSED

All 3 created files (scripts/build-new-surface.cjs, commands/new-surface.md, tests/test-new-surface-generator.cjs) exist on disk; all 4 modified files are tracked; all 3 per-task commit hashes (d6cf7389, a8ea50a3, 1ff63206) are present in the git log.
