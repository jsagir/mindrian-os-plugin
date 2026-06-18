---
phase: 167-harness-manifest-and-surface-generator
plan: 01
subsystem: infra
tags: [harness-manifest, generator, recipe-maps, sha256, part8, byte-stable, drift-gate]

# Dependency graph
requires:
  - phase: 166-gated-chain-executor
    provides: lib/core/recipe-maps.cjs (the live three-map read-join the manifest wraps)
  - phase: 157-brain-orchestration-graph-and-methodology-tiers
    provides: data/brain-orchestration-projection.json + methodology_tier=mindrian-operation + the build-orchestration-projection.cjs generator/--check template
provides:
  - scripts/build-harness-manifest.cjs (the 3-MAP DIGEST generator + STALE/UNRESOLVED/MALFORMED --check)
  - data/harness-manifest.json (the declared, versioned, byte-stable three-map descriptor)
  - lib/core/recipe-maps.cjs loadManifest() / manifest() accessor (the declared-descriptor reader)
  - tests/run-all-167.sh (the phase aggregator scaffold)
affects: [167-02-fable-mode, 167-03-new-surface-generator, pre-commit-manifest-check-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-MAP DIGEST: a manifest that names EXACTLY three maps by {role, path, digest(sha256), source_count}, never inlining contents and never a per-surface row (HIGH-1)"
    - "Generator idiom reuse: deterministic source read -> build -> serialize (JSON.stringify(...,2)+single trailing newline) -> 3-branch main (write / --check / --refresh)"
    - "recipe-maps WRAPS not becomes: additive loadManifest() declared-descriptor reader alongside the byte-unchanged live executable read-join"

key-files:
  created:
    - scripts/build-harness-manifest.cjs
    - data/harness-manifest.json
    - tests/test-harness-manifest-check.cjs
    - tests/test-recipe-maps-loadmanifest.cjs
    - tests/test-harness-manifest-part8-boundary.cjs
    - tests/run-all-167.sh
  modified:
    - lib/core/recipe-maps.cjs

key-decisions:
  - "Manifest is a 3-MAP DIGEST (HIGH-1): exactly three entries (posture/wiring/ranked_next_reach), never a per-surface registry; a surface is reflected only transitively via the wiring map's digest + source_count"
  - "Primary array per map: command-registry->commands (97), connector-registry->connectors (58), brain-orchestration-projection->nodes (207)"
  - "digest = sha256 hex of the raw on-disk map bytes = machinery metadata, never contents (so it never trips the Part 8 forbidden-value heuristic)"
  - "validateManifest MALFORMED leg also enforces exactly-three-roles, so a per-surface extra row or an invented role fails --check (D-166-03 inviolate)"
  - "recipe-maps loadManifest() degrades to a documented empty binding ({ maps: [] }) on missing/malformed manifest, mirroring _loadProjection"

patterns-established:
  - "Boundary-scan field allowlist exported from the generator (NODE_FIELD_ALLOWLIST + ENTRY_FIELD_ALLOWLIST) as the single source of truth the Part 8 scan asserts against"
  - "Aggregator em-dash sweep written via the bash codepoint escape ($'\\u2014') so the runner carries no literal em-dash to trip its own sweep"

requirements-completed: [HARN-01, D-167-01, D-167-02, D-167-06]

# Metrics
duration: ~25min
completed: 2026-06-18
---

# Phase 167 Plan 01: Harness Manifest Foundation Summary

**The declared harness MANIFEST landed as a generated, byte-stable, versioned 3-MAP DIGEST (data/harness-manifest.json via scripts/build-harness-manifest.cjs) naming the three existing recipe maps by role+path+sha256-digest+source_count without merging or retiring them; recipe-maps gained a loadManifest() declared-descriptor reader while staying the live executable read-join; a STALE/UNRESOLVED/MALFORMED --check and a planted-secret Part 8 boundary scan gate it by construction, all green under tests/run-all-167.sh.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 of 3 complete
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

### Task 1 - build-harness-manifest.cjs + data/harness-manifest.json (commit 1177d0d6)
- New generator mirroring the shipped `build-orchestration-projection.cjs` idiom end to end: `buildManifest()` -> `serializeManifest()` (JSON.stringify(...,2) + single trailing newline, byte-stable) -> `validateManifest()` -> `runCheck()` -> 3-branch `main()` (default write / `--check` / `--refresh`).
- node built-ins only (`node:fs`, `node:path`, `node:crypto`). NO new deps, NO YAML, NO TS.
- The manifest names EXACTLY three maps by `{ role, path, digest, source_count }`: `posture` -> command-registry.json (97 commands), `wiring` -> connector-registry.json (58 connectors), `ranked_next_reach` -> brain-orchestration-projection.json (207 nodes). `methodology_tier: mindrian-operation`, `version: 1`. NO per-surface rows; NO inlined contents.
- `validateManifest` returns categorized `{ stale, unresolved, malformed }` arrays each with a `Run: node scripts/build-harness-manifest.cjs` recovery line. MALFORMED also enforces exactly-three-roles (a per-surface extra row fails).
- Exported `NODE_FIELD_ALLOWLIST` + `ENTRY_FIELD_ALLOWLIST` frozen arrays for the Wave-1 boundary scan.
- `tests/test-harness-manifest-check.cjs`: 7 assertions covering well-formed, exactly-three-no-per-surface-row (Test 1b), STALE byte-compare, three-maps-resolve (positive in-process + UNRESOLVED subprocess proof), per-entry well-formed, and byte-stable + tier.

### Task 2 - recipe-maps loadManifest() accessor (commit e8f8fc9a)
- `lib/core/recipe-maps.cjs` extended ADDITIVELY: `DEFAULT_MANIFEST_PATH` + `MINDRIAN_HARNESS_MANIFEST` env override + `_manifestPath()` + `_loadManifest()` per-process cache/degrade (mirroring `_loadProjection`), public `loadManifest()` / `manifest()` alias, wired into `__reset` + `module.exports`.
- `postureForCommand` / `wiringForReach` / `rankedNextReach` byte-unchanged; recipe-maps NOT retired (D-166-03). Doc-comment names the declared-vs-executable split and cites D-167-02.
- Degrades to the documented empty binding (`{ maps: [] }`) on a missing/malformed manifest, never throws.
- `tests/test-recipe-maps-loadmanifest.cjs`: 4 assertions (binding + degrade, three-functions-unchanged, doc-comment split, zero-Brain forbidden-token scan). Existing 166 regression `tests/test-recipe-maps-authority.cjs` still 4/4.

### Task 3 - Part 8 boundary scan + run-all-167.sh (commit 069d56c7)
- `tests/test-harness-manifest-part8-boundary.cjs`: a 6-check verbatim-in-shape mirror of `tests/test-orchestration-projection-part8-boundary.cjs` (field allowlist, tier boundary-keeper, planted-secret RED then real-artifact GREEN, zero-live-Brain syntax scan, exactly-three-maps machinery-only entries, no-em-dash). The sha256 digests are machinery metadata so they never trip the forbidden-value heuristic.
- `tests/run-all-167.sh`: mirrors `tests/run-all-163.sh` - registers the three Wave-1 suites, runs the live `--check`, runs the Part 8 grep sweep (BRAIN_WRITE + RAW_FETCH + external-http over the generator + recipe-maps), and runs the em-dash sweep (codepoint escape `$'—'`, no literal em-dash). Runs to completion, per-suite PASS/FAIL + tally, exit 1 on any failure. 6/6 legs green.

## Deviations from Plan

None - plan executed exactly as written. The only mid-execution corrections were two of my own typos caught before commit:
1. Test 3 in `test-harness-manifest-check.cjs` referenced `b.path` instead of the binding's `b.relPath` key; fixed before the Task 1 commit (test was RED, then GREEN).
2. `run-all-167.sh` was initially written with a literal U+2014 em-dash in the `EMDASH=$'...'` assignment, which would have tripped its own sweep; replaced with the bash codepoint escape `$'—'` before the Task 3 commit (mirrors the run-all-163.sh idiom).

Neither is a plan deviation; both are author-typo self-corrections within the task.

## Authentication Gates

None.

## Known Stubs

None. Every surface is wired: the generator reads the three live maps, the manifest is committed and byte-stable, and recipe-maps.loadManifest() reads the committed artifact. The `--refresh` branch shares the write path with the default (named for parity with the connector generator's `--refresh-names`); this is intentional and complete, not a stub.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary schema change was introduced. The manifest is a LOCAL machinery-metadata cache; the generator and the recipe-maps wrapper make ZERO Brain/network calls (proven by the Part 8 boundary scan CHECK 4 + the run-all-167.sh grep sweep). The threat register dispositions T-167-01 (no per-surface rows / no merge) and T-167-02 (planted-secret) are mitigated by the boundary scan and the validateManifest MALFORMED exactly-three-roles leg.

## Verification

- `node scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`
- `node tests/test-harness-manifest-check.cjs` -> 7 passed, 0 failed
- `node tests/test-recipe-maps-loadmanifest.cjs` -> 4 passed, 0 failed
- `node tests/test-harness-manifest-part8-boundary.cjs` -> 6 passed, 0 failed (6 checks)
- `bash tests/run-all-167.sh` -> Total 6, Passed 6, Failed 0
- `node tests/test-recipe-maps-authority.cjs` (166 regression) -> 4/4 assertions passed

## Self-Check: PASSED

All 8 created/modified files exist on disk; all 3 per-task commit hashes (1177d0d6, e8f8fc9a, 069d56c7) are present in the git log.
