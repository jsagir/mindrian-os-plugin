---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 01
subsystem: constitution
tags: [typescript, constitution, node-floor, wave-0, seed-107, claude-md, generate-claude-md]

requires: []
provides:
  - CJS-only rule lifted in its GSD source and in the generated CLAUDE.md conventions block (D-17)
  - Node floor >=22.18.0 on seven surfaces at once
  - tracked GSD sources for the conventions block and the stack block
  - test pins for rule text, source-to-block equality and the floor
affects: [369-02, 369-03, every later 369 plan that writes TypeScript or depends on the floor]

tech-stack:
  added: []
  patterns:
    - "CLAUDE.md blocks are regenerated block-scoped from tracked .planning/codebase sources, never hand edited between sentinels"

key-files:
  created:
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md
    - tests/test-369-constitution.cjs
  modified:
    - CLAUDE.md
    - .planning/spikes/CONVENTIONS.md
    - .claude/includes/decisions.md
    - package.json
    - package-lock.json
    - npm-shrinkwrap.json
    - tests/test-236-engines-floor.cjs
    - CHANGELOG.md

key-decisions:
  - "Only the conventions and stack blocks of CLAUDE.md are regenerated; project and skills drift is named, not landed"
  - "The 22.16.0 timeout reason stays recorded as the sub-floor under the new 22.18.0 type-stripping reason"

patterns-established:
  - "Block-scoped regeneration: dry run to a scratch copy, per-block diff count, splice only the named sentinel span, re-dry-run to prove 0"

requirements-completed: [TS369-01, TS369-02]

duration: 25min
completed: 2026-10-02
---

# Phase 369 Plan 01: Constitution edit and Node floor Summary

**CJS-only lifted through the tracked GSD sources (CLAUDE.md conventions and stack blocks are generator output, so a regeneration is a no-op), erasable-only TypeScript shape and module system written down, and the Node floor moved to >=22.18.0 on seven surfaces with the 22.16.0 reason kept as history.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-02
- **Tasks:** 2 of 2
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- `.planning/codebase/CONVENTIONS.md` now force-tracked; the single CJS-only bullet is replaced by five D-17 bullets (TypeScript allowed plugin-wide; erasable-only core `.ts` under Node >=22.18.0 with `erasableSyntaxOnly` and `verbatimModuleSyntax` via `tools/ts-check`; hooks and the MCP server stay `.cjs` and `.ts` enters `lib/core` only after the installed-layout test; the CommonJS shape for `lib/core` `.ts` and ESM for `ui/`; TypeScript, UI and build packages never enter the root manifest).
- CLAUDE.md conventions block regenerated with `gsd-tools generate-claude-md` and spliced block-scoped; the diff touches only the conventions span (hunk at line 134) and later the stack span (lines 103 and 125).
- `.planning/codebase/STACK.md` created and force-tracked as the stack block source, so the generator no longer falls back to the unrelated `.planning/research/STACK.md` (untouched, verified `git diff --quiet`). CLAUDE.md stack sentinel now reads `source:codebase/STACK.md`.
- Spikes convention rewritten, decisions row 17 added, floor moved to `>=22.18.0` in package.json, package-lock.json root engines, npm-shrinkwrap.json root engines (one changed line each), the CLAUDE.md stack row, the new STACK.md source, test-236, and a CHANGELOG `[Unreleased]` Changed line.
- Tests: `tests/test-369-constitution.cjs` (7 scenarios) and `tests/test-236-engines-floor.cjs` (5 scenarios, new scenario 5 pins source-to-block equality for the stack and the type-stripping floor).

## Task Commits

1. **Task 1: conventions source, CLAUDE.md block, spikes, decisions, constitution test** - `5ea3c6c4b`
2. **Task 2: Node floor on every surface, stack source, floor test, CHANGELOG** - `fcebd2ce6`

## Block-by-block drift record (changed-line counts, CLAUDE.md vs generator output)

| Block | Baseline (before any edit) | After Task 1 regeneration (before splice) | After Task 1 splice | After Task 2 splice (final) |
|-------|---------------------------|-------------------------------------------|---------------------|-----------------------------|
| project | 4 | 4 | 4 | 4 |
| stack | 109 | 109 | 109 | 0 |
| conventions | 2 | 6 (CJS bullet out, five D-17 bullets in) | 0 | 0 |
| architecture | 0 | 0 | 0 | 0 |
| workflow | 0 | 0 | 0 | 0 |
| skills | 7 | 7 | 7 | 7 |

Baseline matched the orchestrator-measured expectation exactly for architecture, workflow, conventions, project and skills; stack measured 109 (expected "about 100"). No unknown drift.

Baseline diffs recorded (what the generator would write if the full file were regenerated):

- **conventions (2 lines, landed):** the source's reuse-before-build bullet said "search the 25 methodology commands first"; CLAUDE.md enumerates the surface from disk. The source now carries CLAUDE.md's wording verbatim.
- **project (4 lines, NOT landed):** `.planning/PROJECT.md` still carries the stale description ("optionally connects to the remote Brain for enrichment") and Core Value ("25 methodology bots"), which contradict Key Decisions rows 1 and 5. Regeneration would regress hand-maintained CLAUDE.md text.
- **skills (7 lines, NOT landed):** the generator reads `.claude/skills/*/SKILL.md` frontmatter: it would add an `agentshield` row, swap the `claude-md-optimizer` and `spike-findings-MindrianOS-Plugin` descriptions for the long frontmatter ones, quote the optimizer name, and drop the "Spike findings" `Skill()` line.
- **stack (109 lines, landed with Task 2):** the generator fell back to the Memgraph research. After STACK.md existed the only differences were the sentinel label and the Node row, both intended.

### Follow-up (named, not done here)

A `/gsd-quick` should reconcile `.planning/PROJECT.md` (description and Core Value) and the skill frontmatter descriptions (plus add the agentshield row decision) so that a full `generate-claude-md` regeneration is a no-op for the project and skills blocks. Until then every regeneration must stay block-scoped.

## Tracking changes

- `.planning/codebase/CONVENTIONS.md` and `.planning/codebase/STACK.md` are now tracked (`git add -f`; `.gitignore` has `.planning/*`). Before this plan another clone had no source and a regeneration there fell back to GSD defaults.
- `.planning/codebase/ARCHITECTURE.md` stays untracked (its block is identical and this plan did not edit it).

## Deviations from Plan

None in substance. Two small mechanics worth recording:

- The first draft of `tests/test-369-constitution.cjs` carried literal dash characters in its own dash-check (an escape sequence was expanded on write), which failed scenario 7 against the test file itself. Fixed in the same task before commit: the characters are now built with `String.fromCharCode(0x2014)` and `0x2013`, so the file never contains what it forbids. [Rule 1 - Bug, Task 1]
- The CHANGELOG line went under the existing `[Unreleased]` `### Changed` section rather than the empty `### Added` placeholder bullet, to leave that placeholder untouched for peers.

## Verification

- `node tests/test-369-constitution.cjs`: 7 passed, 0 failed
- `node tests/test-236-engines-floor.cjs`: 5 passed, 0 failed
- `node tests/test-341-shrinkwrap-no-dev.cjs`: PASS=4 FAIL=0
- `node -p` on package.json, package-lock.json, npm-shrinkwrap.json root engines: all `>=22.18.0`; one changed line each
- Final dry run of `generate-claude-md --output <copy of CLAUDE.md>`: stack, conventions, architecture, workflow all 0
- `git diff --quiet -- .planning/research/STACK.md`: exit 0
- Zero em-dash or en-dash characters in the files this plan edited or created (CHANGELOG has pre-existing ones; the diff adds none)
- Post-commit deletion check on both commits: no deletions
- Commit hooks ran (corpus-stats OK); no `--no-verify`

## Known Stubs

None.

## Threat Flags

None. Threat register T-369-01-01 through -04 mitigated as planned (sources tracked, equality tests, block-scoped splice, one-line lockfile diffs, CHANGELOG note).

## Notes for later plans

- The Node floor is `>=22.18.0` in test-236; the nvm Node v22.23.1 satisfies it, `/usr/bin/node` (v20) does not.
- `tests/test-369-constitution.cjs` scenario 3 will fail if CLAUDE.md's conventions block is hand edited or the source changes without a block-scoped regeneration; regenerate by dry running `generate-claude-md --output <copy>` and splicing only the conventions span.

## Self-Check: PASSED

- FOUND: .planning/codebase/CONVENTIONS.md, .planning/codebase/STACK.md, tests/test-369-constitution.cjs
- FOUND commits: 5ea3c6c4b, fcebd2ce6
