---
quick: 260911-juq
phase: quick-260911-juq
plan: 01
subsystem: hooks-manifest
tags: [hooks, plugin-loader, canon-part-11, quick-task]
requirements: [JUQ-01, JUQ-02, JUQ-03]
dependency-graph:
  requires: []
  provides:
    - "data/hooks-markers.json (build-metadata sidecar)"
    - "hooks/hooks.json top level is hooks-only"
    - "tests/test-quick-260911-juq-hooks-json-top-level.cjs"
  affects:
    - "lib/mcp/hook-adapter-audit.cjs"
    - "tests/test-198-adapter-budget.test.cjs"
    - "tests/run-all-198.sh"
tech-stack:
  added: []
  patterns:
    - "Sidecar JSON for loader-invisible build metadata, whole-file slice transform to avoid reserializing (preserves matcher/command byte-parity)"
key-files:
  created:
    - data/hooks-markers.json
    - tests/test-quick-260911-juq-hooks-json-top-level.cjs
    - .planning/quick/260911-juq-silence-the-claude-code-hooks-json-unkno/deferred-items.md
  modified:
    - hooks/hooks.json
    - lib/mcp/hook-adapter-audit.cjs
    - tests/test-198-adapter-budget.test.cjs
    - tests/run-all-198.sh
    - CHANGELOG.md
decisions:
  - "Used the plan's exact whole-file slice transform ('{' + raw.slice(index)) instead of JSON.stringify, so every matcher/command/timeout byte in the hooks block stays untouched."
  - "Left the plan's literal Task 1 byte-identity verify script uncorrected (it is read-only plan text); ran a corrected form to confirm true byte-identity and documented the off-by-one as a deviation."
  - "Deferred three pre-existing, unrelated test failures (scripts/on-stop line-budget overrun, Part 8 local-only floor on sensors.cjs, SPEC-2 contract-schema) rather than fixing them, per the scope-boundary rule."
metrics:
  duration: "~45 minutes"
  completed: "2026-09-11"
---

# Quick Task 260911-juq: Silence the Claude Code hooks.json unknown-keys warning Summary

One-liner: Moved two build-metadata markers out of `hooks/hooks.json` into a new `data/hooks-markers.json` sidecar via a byte-preserving whole-file slice transform, so the plugin loader's top-level key set is exactly `["hooks"]` and the Claude Code 2.1.268 unknown-keys warning stops firing on every session start, on every surface.

## What Changed

**Task 1 (commit `2a0c3a2f`):**
- Created `data/hooks-markers.json` by reading `hooks/hooks.json` with node, picking off `_mcpFirst198Migrated` and `_firstInstallRouterOrdering`, and writing `JSON.stringify({...}, null, 2) + '\n'` (key order preserved: `_mcpFirst198Migrated` first). Both `_note` strings and every `surfaces[]` entry are byte-identical except for the one permitted text change: `which only reads the 'hooks' key below` became `which only reads the 'hooks' key in hooks/hooks.json` (applied once per note, verified programmatically that this is the ONLY diff between the sidecar and the extracted originals).
- Rewrote `hooks/hooks.json` as `'{' + raw.slice(raw.indexOf('\n  "hooks": {'))`, never reserializing through `JSON.stringify`. `Object.keys(require('./hooks/hooks.json'))` is now exactly `['hooks']`. Confirmed the hooks block is byte-identical to HEAD `fe45ad98` (see Deviations below for the exact comparison used).
- Repointed `lib/mcp/hook-adapter-audit.cjs`: replaced `HOOKS_JSON_PATH` with `HOOKS_MARKERS_PATH` (pointing at `data/hooks-markers.json`), removed the now-dead old constant, updated `migratedSurfaces()`'s `readFileSync` call and its header/jsdoc comments to name the new source and the reason it moved. The never-throws `try`/`catch (_e) { return []; }` contract is unchanged.
- Split `tests/test-198-adapter-budget.test.cjs`'s Stop-migration test: `surfaces` now reads from `data/hooks-markers.json`, the `parsed.hooks.Stop` dispatch assertion still reads `hooks/hooks.json`. Updated the test title and the header comment's enumeration-source reference.

**Task 2 (commit `8da1fc85`):**
- Created `tests/test-quick-260911-juq-hooks-json-top-level.cjs` (115 lines, `node:test` + `node:assert/strict`, no network/room/tmpdir writes), four arms:
  - Arm 1: `Object.keys(JSON.parse(hooks.json))` deep-equals `['hooks']`, failure message enumerates offending keys.
  - Arm 2: `data/hooks-markers.json` parses; `_mcpFirst198Migrated.surfaces` names all three migrated scripts; `_firstInstallRouterOrdering._note` is non-empty and still mentions `first-install-router.cjs` and `mva-detect.cjs`.
  - Arm 3 (the important one): `require('../lib/mcp/hook-adapter-audit.cjs').migratedSurfaces()` returns exactly the 3 expected scripts through the sidecar, so a wrong path cannot silently return `[]` and make the D-06 adapter budget vacuous.
  - Arm 4: runs the Arm 1 key-equality assertion against an in-memory fixture carrying an extra top-level key and asserts it throws, proving the guard discriminates.
- Registered the new test as a `run_if` leg in `tests/run-all-198.sh`'s SPEC-5 section, immediately after the existing adapter-only-budget leg, labeled `SPEC-5 hooks.json top level is hooks-only (loader unknown-keys warning, quick 260911-juq)`.
- Added a `### Fixed` block to `CHANGELOG.md` under the existing `## [Unreleased] -- v2.0.0-beta.36 (in progress)` heading (the pre-existing `### Added` block for 260911-iko stayed in place, untouched), naming Claude Code 2.1.268, quoting the exact warning line, naming `data/hooks-markers.json` as the new home, and stating no matcher/command/timeout inside the hooks block changed.

## Verification Commands Run (with exit codes)

| Command | Exit | Notes |
|---|---|---|
| `node -e "...Object.keys...migratedSurfaces()..."` (Task 1 verify 1) | 0 | Top-level keys `["hooks"]`; sidecar has both markers; `migratedSurfaces()` returns all 3 scripts |
| `node tests/test-198-adapter-budget.test.cjs` (initial, before Task 2 commit) | 1 | 14/15 pass; 1 pre-existing unrelated failure (see Deviations) |
| `node tests/test-brain-response-sanitize.cjs` | 0 | 20/20 assertions pass |
| `git diff -- hooks/hooks.json \| grep -c '^[-+]'` threshold check | 0 | 25 changed lines, under the 26-line ceiling |
| `git show HEAD:hooks/hooks.json \| node -e "..."` (plan's literal byte-identity check) | 1 | Off-by-one bug in the plan's own script; see Deviations for the corrected form that passes |
| (corrected byte-identity check: `a.slice(i) === b.slice(1)`) | 0 (`true`) | Confirms the hooks block is genuinely byte-identical to HEAD |
| `node tests/test-quick-260911-juq-hooks-json-top-level.cjs` | 0 | All 4 arms pass |
| `bash tests/run-all-198.sh` (after Task 2 commit) | 1 | 13 passed, 3 failed (all 3 pre-existing/unrelated, documented below), 0 skipped; the new guard leg itself PASSED |
| `grep -rn em-dash across new/modified files` | 0 (no em-dash) | Zero em-dashes in files this task authored; pre-existing em-dashes elsewhere in `CHANGELOG.md` (unrelated historical entries) are out of scope |
| `node scripts/doctor.cjs --acceptance` (after Task 2 commit) | 0 | 20/20 on a clean tree |
| `claude plugin validate .` | 0 | `Validation passed with warnings`, exactly 1 pre-existing warning (root CLAUDE.md not loaded as project context) -- unchanged baseline, no regression |

Manual observation from the plan's `<verification>` block (a fresh Claude Code session confirming the warning is gone) was not performed in this non-interactive execution; the `Object.keys()` assertion (Arm 1, run both standalone and inside `run-all-198.sh`) is the mechanical proof the plan itself names as definitive, since `claude plugin validate .` does not surface that line either way.

## Deviations from Plan

### Auto-fixed Issues

None - Task 1 and Task 2's own file edits were executed exactly as the plan's action text specified (whole-file slice transform, not `JSON.stringify`; phrase substitution applied exactly once per note; reader repoints exactly as scoped).

### Documented, Not Auto-fixed (Rule: scope boundary)

**1. Plan's literal Task 1 byte-identity verify command has an off-by-one bug**
- **Found during:** Task 1 verify
- **Issue:** The plan's verify script computes `a.slice(i+1) !== b.slice(1)` where `i = a.indexOf('\n  "hooks": {')`. Since the write transform is `b = '{' + raw.slice(i)`, the correct comparison is `a.slice(i) === b.slice(1)` (no `+1`). The literal `+1` form always fails by exactly one leading newline character, regardless of whether the transform is correct.
- **Verification:** Ran both forms. The literal plan form throws `hooks block is NOT byte-identical to HEAD` (exit 1). The corrected form (`a.slice(i) === b.slice(1)`) evaluates `true` and both slices measure the identical 12,367-character length.
- **Resolution:** Did not modify the plan file (read-only, execute-exactly-as-written per task instructions). Documented the discrepancy here; the deliverable itself (the hooks block) is confirmed genuinely byte-identical to HEAD `fe45ad98`.
- **Files modified:** none (verification-only finding)
- **Commit:** n/a

**2. Three pre-existing, unrelated test failures surfaced by running the full suites**
- **Found during:** Task 1 and Task 2 verify (`node tests/test-198-adapter-budget.test.cjs`, `bash tests/run-all-198.sh`)
- **Issues (all confirmed pre-existing at HEAD `fe45ad98`, before any edit in this task, and in files this task never touches):**
  1. `scripts/on-stop` measures 617-618 lines against its 570-line D-06 budget (`LINE_BUDGETS['scripts/on-stop']`). Confirmed via `git show HEAD:scripts/on-stop | wc -l` = 617, from unrelated later commits (`01c3ca19`, `c7fb00db`, `0d02e112`).
  2. `198 Part 8 local-only floor` fails on `lib/mcp/tools/sensors.cjs: forbidden token 'brain-client.cjs'`. Last commit touching that file is `78ae0e53`, unrelated to and predating this task.
  3. `SPEC-2 contract-version + per-tool schema validity` fails: `context_assemble schema PARSES a synthesized sample input` assertion in `tests/test-198-contract-schema.test.cjs`. `lib/mcp/contract-version.cjs` is untouched by this task's commits.
- **Resolution:** Not fixed, per the scope-boundary rule (only issues directly caused by this task's own changes are auto-fixed). Logged in `.planning/quick/260911-juq-silence-the-claude-code-hooks-json-unkno/deferred-items.md` with recommendation to open a follow-up quick task or `/gsd:debug` slug for each.
- **Files modified:** none
- **Commit:** none

## Known Stubs

None.

## Threat Flags

None - both threat-model mitigations (T-juq-01 top-level-keys guard, T-juq-03 sidecar-liveness guard) are implemented exactly as specified in the plan's `<threat_model>`, and no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced.

## Self-Check: PASSED

- `data/hooks-markers.json`: FOUND
- `hooks/hooks.json`: FOUND (top-level keys `["hooks"]` confirmed)
- `lib/mcp/hook-adapter-audit.cjs`: FOUND (repointed, confirmed via `grep -n HOOKS_MARKERS_PATH`)
- `tests/test-198-adapter-budget.test.cjs`: FOUND (updated test title present)
- `tests/test-quick-260911-juq-hooks-json-top-level.cjs`: FOUND (115 lines, exceeds the 60-line minimum)
- `tests/run-all-198.sh`: FOUND (new `run_if` leg present, `grep -c` returns 2 occurrences of the test filename)
- `CHANGELOG.md`: FOUND (`### Fixed` block present under `[Unreleased]`)
- `.planning/quick/260911-juq-silence-the-claude-code-hooks-json-unkno/deferred-items.md`: FOUND
- Commit `2a0c3a2f`: FOUND in `git log --oneline`
- Commit `8da1fc85`: FOUND in `git log --oneline`
