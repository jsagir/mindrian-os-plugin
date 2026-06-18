---
phase: 167-harness-manifest-and-surface-generator
plan: 02
subsystem: infra
tags: [harness-manifest, pre-commit, drift-gate, d-167-03, part8, enforcement]

# Dependency graph
requires:
  - phase: 167-harness-manifest-and-surface-generator
    plan: 01
    provides: scripts/build-harness-manifest.cjs (the 3-MAP DIGEST generator + STALE/UNRESOLVED/MALFORMED --check) + data/harness-manifest.json
  - phase: 122-workflow-layer
    provides: the command-registry pre-commit guard idiom (.git/hooks/pre-commit:143-147)
  - phase: 110-brain-context-packet-contract
    provides: the brain-packet-schema pre-commit guard idiom (.git/hooks/pre-commit:159-163)
provides:
  - .git/hooks/pre-commit harness-manifest drift guard (untracked live hook; the third harness-registry guard, sitting with command-registry + brain-packet-schema)
  - scripts/install-pre-commit.sh harness-manifest guard in BOTH branches (splice + fresh-file HOOK_BODY) so a fresh dev clone inherits it
  - tests/test-harness-manifest-precommit-wiring.cjs (the wiring regression fence)
  - tests/run-all-167.sh registers the wiring suite; the manifest --check CI leg (Wave 1) satisfies D-167-03 BOTH
affects: [167-03-new-surface-generator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard idiom reuse (Part 7): the manifest guard is a verbatim-in-shape mirror of the command-registry + brain-packet-schema guards -- same git diff --cached --name-only | grep -qE path-scoped trigger, same command -v node + -f generator preconditions, same node <generator> --check || { echo recovery >&2; exit N; } shape"
    - "D-167-03 BOTH: the same drift gate fires at commit time (live hook + tracked template) AND in CI (run-all-167.sh leg), STRONGER than the connector/projection precedent whose --checks run only in test aggregators"
    - "Unquoted-heredoc escape: in the fresh-file HOOK_BODY heredoc (<<HOOK_BODY, unquoted) the grep regex tail anchor is written as \\$' so the literal $ lands in the generated hook instead of being expanded at write time"

key-files:
  created:
    - tests/test-harness-manifest-precommit-wiring.cjs
  modified:
    - scripts/install-pre-commit.sh
    - tests/run-all-167.sh
  modified-untracked:
    - .git/hooks/pre-commit

key-decisions:
  - "The live .git/hooks/pre-commit is NOT git-tracked (standard git convention, documented by both the command-registry and brain-packet-schema guards). The tracked source the live hook is installed from is scripts/install-pre-commit.sh, so the wiring test asserts on the TEMPLATE; the live hook was edited directly and its guard proven by a staged-staleness fire test"
  - "Path-scoped trigger covers FIVE paths (the manifest + its generator + the three named source maps) because a change to any source map can stale the manifest digests"
  - "The manifest guard exits 2 in the live hook (matching the command-registry guard) and exit 1 in the installable template (matching the template's existing schema-aliases/substrate || exit 1 idiom)"
  - "The manifest --check CI leg already existed in run-all-167.sh from Wave 1 (lines 68-81); Wave 2 added the wiring test to CJS_SUITES rather than re-adding the leg, so D-167-03 BOTH was satisfied without duplicating the gate"

requirements-completed: [HARN-01, D-167-03, D-167-06]

# Metrics
duration: ~20min
completed: 2026-06-18
---

# Phase 167 Plan 02: Harness Manifest Pre-Commit Enforcement Summary

**The Wave-1 harness-manifest --check is now a LIVE commit-time gate: a path-scoped guard in BOTH the untracked .git/hooks/pre-commit (sitting beside the command-registry + brain-packet-schema guards) AND the tracked scripts/install-pre-commit.sh template (so a fresh clone inherits it), firing exit-2/exit-1 with a regenerate recovery line when the manifest, its generator, or any of the three named source maps is staged against a stale manifest; the wiring regression fence (test-harness-manifest-precommit-wiring.cjs) proves the template carries the guard additively and the manifest --check CI leg (Wave 1) carries the same gate in run-all-167.sh, closing the connector/projection enforcement gap for the manifest (D-167-03 BOTH).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 of 2 complete
- **Files created:** 1
- **Files modified:** 2 tracked (+ 1 untracked live hook)

## Accomplishments

### Task 1 - wire the manifest --check into the live pre-commit + the installable template (commit 9d6248c7)
- **Live `.git/hooks/pre-commit` (untracked):** added the Phase 167 harness-manifest guard immediately after the brain-packet-schema guard, so the three harness-registry guards (command-registry / brain-packet-schema / harness-manifest) sit together. The block mirrors the command-registry guard verbatim in shape: a `git diff --cached --name-only | grep -qE` path-scoped trigger over the five paths (`scripts/build-harness-manifest.cjs`, `data/harness-manifest.json`, `data/command-registry.json`, `data/connector-registry.json`, `data/brain-orchestration-projection.json`), guarded by `command -v node` + `[ -f "$REPO_ROOT/scripts/build-harness-manifest.cjs" ]`, running `node "$REPO_ROOT/scripts/build-harness-manifest.cjs" --check || { echo "harness-manifest drift -- run: node scripts/build-harness-manifest.cjs" >&2; exit 2; }`. A documentary comment header cites D-167-03, names it the Phase 167 guardian, states Canon Part 8 (local byte-compare + map-resolve, never touches the Brain), and gives the recovery line.
- **Tracked `scripts/install-pre-commit.sh` template:** added the same guard in BOTH code paths so the live hook and the template stay byte-consistent for a fresh clone:
  - the **splice branch** (existing hook missing a guard): a `HOOK_TRAILER_MANIFEST` quoted heredoc snippet with `$REPO_ROOT_PLACEHOLDER` (substituted at install time, matching the schema-aliases/substrate snippets) and `exit 1` (matching the template's `|| exit 1` idiom);
  - the **fresh-file branch** (`HOOK_BODY`, unquoted heredoc): the guard with `$REPO_ROOT` expanded at write time and the grep regex tail anchor written as `\$` so the literal `$` lands in the generated hook;
  - the **idempotency check** extended to require `build-harness-manifest.cjs --check` alongside schema-aliases + substrate before reporting "already installed".
- Verified both template branches generate a `bash -n`-clean hook (two throwaway temp repos: a fresh-file install + a splice-into-existing-hook install, both with the manifest block landing BEFORE the terminal `exit 0`).
- `bash -n .git/hooks/pre-commit` + `bash -n scripts/install-pre-commit.sh` both parse clean; both files carry `build-harness-manifest.cjs --check`.

### Task 2 - assert the wiring + register the suite in run-all-167.sh (commit 6754ef41)
- `tests/test-harness-manifest-precommit-wiring.cjs` (plain node assert harness, 6 checks): reads the tracked template and asserts (1) the path-scoped trigger matches all five paths, (2) the `build-harness-manifest.cjs --check` invocation, (3) the `harness-manifest drift` recovery line naming `node scripts/build-harness-manifest.cjs`, (4) the `command -v node` + `-f` generator preconditions, (5) ADDITIVE -- the schema-aliases + substrate guards are not displaced, (6) no em-dash (U+2014 via `String.fromCharCode(0x2014)`) in the template or the test.
- `tests/run-all-167.sh`: registered `test-harness-manifest-precommit-wiring.cjs` in `CJS_SUITES` and added the new test + the template to the em-dash sweep targets. The Wave-1 comment was extended (not rewritten) to note Wave 2's append. The manifest `--check` CI leg already ran in the aggregator from Wave 1 (lines 68-81), so D-167-03 BOTH was satisfied without duplicating the gate.
- `bash tests/run-all-167.sh` -> Total 7, Passed 7, Failed 0.

## Guard-fires verification (HARD RULE)

Proven the guard FIRES on a stale manifest, then restored:
1. Deliberately staled `data/harness-manifest.json` (corrupted a source-map digest), staged it.
2. The live guard block ran `--check` -> RED: `STALE: data/harness-manifest.json diverges from the regenerated manifest ... Run: node scripts/build-harness-manifest.cjs` + `harness-manifest drift -- run: node scripts/build-harness-manifest.cjs` (exit 2).
3. End-to-end `git commit` with the stale manifest staged -> REJECTED (COMMIT_EXIT 1; the live hook blocked it).
4. Restored the real manifest from a saved copy + `git reset HEAD` the stale staging; `--check` -> `harness-manifest: OK` (exit 0). No spurious staleness left in the working tree.

## Deviations from Plan

None - plan executed exactly as written. One worth noting (not a deviation): the manifest `--check` CI leg the plan's Task 2 action describes was ALREADY present in `run-all-167.sh` from Wave 1 (the Wave-1 SUMMARY's Task 3 added it). So Task 2's run-all-167.sh edit was the additive registration of the new wiring suite in `CJS_SUITES` plus the em-dash sweep targets; D-167-03 BOTH was already half-satisfied by Wave 1's CI leg, and this wave completed it by landing the live + template pre-commit guard. The plan's `<done>` for Task 2 (the aggregator runs the manifest --check alongside the suites and stays green) holds exactly.

## Authentication Gates

None.

## Known Stubs

None. The guard is fully wired: the live hook carries it, the tracked template carries it in both branches (so a fresh clone inherits it), the wiring test proves the template carries it additively, and the CI aggregator carries the same gate. The guard was proven to fire RED on real staleness and block a real commit.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary schema change. The manifest `--check` is a LOCAL byte-compare + map-resolve that makes ZERO Brain calls (Wave-1 boundary scan CHECK 4 + the run-all-167.sh Part-8 grep sweep prove the generator clean); the guard adds no new surface, only a commit-time invocation of that local check. Threat register dispositions T-167-05 (stale manifest committed past the hook) and T-167-06 (a fresh clone missing the guard) are now mitigated: the path-scoped pre-commit guard regenerates + byte-compares + exits non-zero on drift, and the guard lives in the TRACKED template so fresh clones inherit it. T-167-07 (guard crashing when node absent) is handled by the `command -v node` + `-f` generator preconditions. T-167-SC (package installs) -- zero new packages.

## Verification

- `grep -q 'build-harness-manifest.cjs --check'` on `.git/hooks/pre-commit` -> match
- `grep -q 'build-harness-manifest.cjs --check'` on `scripts/install-pre-commit.sh` -> match
- `bash -n .git/hooks/pre-commit` + `bash -n scripts/install-pre-commit.sh` -> parse clean
- fresh-file + splice template installs into throwaway repos -> both `bash -n` clean, manifest block before terminal `exit 0`
- `node tests/test-harness-manifest-precommit-wiring.cjs` -> 6 passed, 0 failed
- `bash tests/run-all-167.sh` -> Total 7, Passed 7, Failed 0
- guard-fires test: stale manifest -> RED (exit 2) + end-to-end commit REJECTED (exit 1) -> restored to OK (exit 0)
- em-dash sweep over all wave-2 edited/created files (test, run-all-167.sh, install-pre-commit.sh, .git/hooks/pre-commit) -> clean

## Self-Check: PASSED

All created/modified files exist on disk (tests/test-harness-manifest-precommit-wiring.cjs, scripts/install-pre-commit.sh, tests/run-all-167.sh, the SUMMARY); both per-task commit hashes (9d6248c7, 6754ef41) are present in the git log; the SUMMARY is em-dash clean.
