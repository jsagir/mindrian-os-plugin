---
phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
plan: 06
subsystem: infra
tags: [security, tampering, portability, skills, plugin-root, fail-closed, codemod, mirrors]

# Dependency graph
requires:
  - phase: 234-01
    provides: tests/run-all-234.sh (the glob-discovering phase harness and its permanent Part 8 egress sweep)
  - phase: 234-03
    provides: scripts/check-skill-spec.cjs and its pluginRootCensus(), the authoritative 51-file migration surface
  - phase: 123
    provides: lib/core/active-plugin-root.cjs, the single documented resolver whose precedence #1 (MINDRIAN_OS_ROOT) this plan reuses
provides:
  - 51 skills/*/SKILL.md bodies whose 172 shell-outs resolve MINDRIAN_OS_ROOT first and fail closed when neither root variable is set
  - scripts/migrate-plugin-root-refs.cjs - the one-time, idempotent codemod and the single source of the wrapper string
  - scripts/build-skill-mirrors.cjs EXCEPTION CLASS 3 (plugin-root portability) - the first BODY-level mirror exception, which is what keeps the migration from being silently reverted
  - tests/test-234-plugin-root-migrated.cjs - a four-layer gate (textual, shape, behavioral, durability), 19 assertions
affects: [234-07, 234-08, any future foreign-host install path, any future skill-body codemod]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail closed, not silent: ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?message}} aborts the shell with an actionable message instead of expanding to an attacker-plantable absolute path"
    - "Idempotent-by-construction codemod: the replacement text cannot itself match the search token, so re-running is a provable no-op and no already-migrated heuristic is needed"
    - "A generated artifact's generator must learn every deliberate divergence in the same commit, or the next write-mode run silently reverts it"
    - "Duplicated constants across a dependency boundary get a byte-identity test, not vigilance"

key-files:
  created:
    - scripts/migrate-plugin-root-refs.cjs
    - tests/test-234-plugin-root-migrated.cjs
  modified:
    - scripts/build-skill-mirrors.cjs
    - skills/*/SKILL.md (51 files, 172 occurrences)

key-decisions:
  - "commands/*.md's parallel 51 references stay bare, and that is now asserted by a test rather than left as a comment. No Agent-Skills host loads a commands/ directory, so the reference is unreachable there by construction, and commands/ is the read-only source of truth for build-command-registry.cjs, build-render-coverage.cjs and check-help-coverage.cjs."
  - "MINDRIAN_OS_ROOT was reused, not re-invented. It is precedence #1 of the shipped resolver lib/core/active-plugin-root.cjs, so a foreign-host install exports one variable and both the CJS resolver and every skill-body shell-out agree on the answer."
  - "The mirror generator had to change. skills/*/SKILL.md are generated from commands/*.md; migrating the mirrors without teaching the generator would have made --check report 51 stale mirrors and the next write-mode run would have reverted the whole security fix. This is the same gap class D-1 already caught once in this phase, caught here before it landed."
  - "The wrapper constant is restated in build-skill-mirrors.cjs rather than imported, to keep that release-gate script fs/path-only (a missing node_modules must never take the gate down). The duplication is defended by a byte-identity assertion in the phase test."
  - "The plan's acceptance criterion of 8 occurrences in skills/rooms/SKILL.md was stale planning data. The file actually carries 27. The migration is driven by the live census, never by a frozen literal."

patterns-established:
  - "Behavioral security verification: a real line is lifted off the shipped artifact and executed under four environments, because text can lie about what a shell does and running it cannot"
  - "Harness honesty floors: the test asserts the census reached >= 100 skills and >= 45 migrated files BEFORE grading them, so a broken walker fails loudly instead of reporting a vacuous pass"
  - "Scope decisions get asserted: commands/ must STILL carry its bare references, so an over-eager future codemod trips a failing test"

requirements-completed: [D-01, D-02]

# Metrics
duration: 20min
completed: 2026-07-28
---

# Phase 234 Plan 06: Plugin-Root Portability and Fail-Closed Shell-Outs Summary

**Closed the phase's named Tampering finding: 172 skill-body shell-outs across 51 files that silently resolved to `/scripts/...` on any foreign host now resolve through `MINDRIAN_OS_ROOT` first and abort loudly when neither root variable is set.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-28T07:17+03:00
- **Completed:** 2026-07-28T07:37+03:00
- **Tasks:** 1 of 1
- **Files modified:** 54 (2 created, 52 modified)

## Accomplishments

- **The vulnerability was demonstrated before it was fixed, not assumed.** `CLAUDE_PLUGIN_ROOT` is exported by Claude Code and by nothing else. Every `skills/<name>/SKILL.md` is precisely the artifact a foreign Agent-Skills host loads into its active instructions. Running the pre-migration form with both variables unset produced, verbatim: `would run: node "/scripts/soft-alias-runner.cjs"`, exit status 0, no warning. That is an absolute path at the filesystem root, a location any other package or attacker can plant a file at, reached with no signal that resolution failed. The silence was the vulnerability.
- **The fix makes the failure loud rather than making the guess better.** All 172 occurrences now read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}`. This is plain POSIX nested parameter expansion, verified evaluable on both bash and dash before it was written into a single file.
- **It reuses the shipped escape hatch instead of inventing a second one.** `MINDRIAN_OS_ROOT` is precedence #1 of `lib/core/active-plugin-root.cjs` ("tests, dev boxes, hand clones"). A foreign-host install exports one variable and both the CJS resolver and every skill-body shell-out agree on the answer. The test asserts that resolver still honors it, so the two cannot drift apart quietly.
- **Zero regression on Claude Code, proved on the wire.** With `MINDRIAN_OS_ROOT` unset and `CLAUDE_PLUGIN_ROOT` set, the wrapper expands to exactly what the bare token expanded to. A fix that broke the primary surface would have been worse than the hole it closed, so that leg is a first-class assertion, not an afterthought.
- **The silent-revert trap was caught before it landed.** `skills/*/SKILL.md` are GENERATED mirrors of `commands/*.md`. Migrating the mirrors without teaching `scripts/build-skill-mirrors.cjs` would have made `--check` report 51 stale mirrors, and the next write-mode run would have quietly undone the entire security migration. The generator gained EXCEPTION CLASS 3 in the same commit as the migration, so no intermediate commit is ever red. Write mode is now a verified no-op: `unchanged 111 ... plugin-root portable 51`.
- **Idempotent by construction, not by heuristic.** The replacement contains `${CLAUDE_PLUGIN_ROOT:?...}`, a colon rather than a closing brace after the name, so the bare token `${CLAUDE_PLUGIN_ROOT}` cannot survive in the output. A second codemod run reports `0 file(s) changed`. That same property is what lets the census and the test just grep for the bare token instead of hand-parsing shell.
- **The gate is mutation-verified.** Reverting one skill to the bare form turns 19 passed into 17 passed / 2 failed. The test was proven to bite before it was trusted.

## Task Commits

1. **Task 1a: the codemod** - `4a99be73` (feat) - `scripts/migrate-plugin-root-refs.cjs`, script only, tree still green
2. **Task 1b: the migration plus the mirror exception class** - `1d76e30e` (fix) - 51 skills + `scripts/build-skill-mirrors.cjs`, landed together because either alone leaves a gate red
3. **Task 1c: the four-layer gate** - `914bc0e3` (test) - `tests/test-234-plugin-root-migrated.cjs`

The plan carried one task. It was split into three commits so that every intermediate state keeps `build-skill-mirrors --check` green, which a single squashed commit would not have made legible.

## Files Created/Modified

- `scripts/migrate-plugin-root-refs.cjs` - New. One-time, idempotent codemod. Takes its file list from `check-skill-spec.cjs`'s `pluginRootCensus()` rather than re-deriving it, so the codemod and the checker cannot disagree about the surface. Rewrites BODY lines only (matching the census's own scope), by plain `String.split/join` on raw bytes rather than a markdown or YAML round-trip, because these bodies carry hand-written prose, fenced examples and load-bearing comments. Its top-level require surface is `fs`/`path` only; `check-skill-spec.cjs` (which needs gray-matter) is required lazily inside `main()`.
- `skills/*/SKILL.md` (51 files, 172 occurrences) - Every bare `${CLAUDE_PLUGIN_ROOT}` wrapped. Densest: `rooms` (27), `new-project` (12), `admin` (11), then `whitespace`/`research`/`publish`/`eureka` (8 each).
- `scripts/build-skill-mirrors.cjs` - EXCEPTION CLASS 3 (plugin-root portability): a documented header block, `applyPluginRootPortability(lines, fmEnd)`, and its wiring into `computeExpectedMirror` as the LAST transformation with a recomputed fence index (every frontmatter splice above it shifts the fence down). The first body-level mirror exception; the previous two are frontmatter-only. Summary line and return shape gained a `portableCount`. Dependency surface verified unchanged: still zero external requires.
- `tests/test-234-plugin-root-migrated.cjs` - New. 19 assertions in four layers, glob-discovered by `tests/run-all-234.sh` automatically.

## Decisions Made

- **`commands/` stays bare, and the decision is now enforced by a test.** Threat T-234-12, disposition accept. `commands/` is a Claude-Code-only plugin concept; no Agent-Skills-compliant host loads or executes a `commands/` directory at all, so a `${CLAUDE_PLUGIN_ROOT}` reference there is unreachable on a foreign host by construction and carries zero Tier-0 exposure. It is also the read-only source of truth for `build-command-registry.cjs`, `build-render-coverage.cjs` and `check-help-coverage.cjs`, so touching it is not free. The test asserts commands/ STILL carries its 51 bare references, so a future codemod that "helpfully" migrates it fails a test instead of quietly mutating a registry source of truth. `git diff --name-only commands/` across all three commits: 0.
- **The wrapper constant is duplicated on purpose, and the duplication is defended.** `build-skill-mirrors.cjs` runs from pre-commit, `verify-release` and `doctor`, where a missing `node_modules` must not take the gate down, so it stays `fs`/`path` only and restates the constant rather than importing the codemod. That is the same rationale its EXCEPTION CLASS 2 already uses. What is new: the phase test asserts the two copies are byte-identical, so drift is caught mechanically rather than left to whoever edits one of them next.
- **Canon Part 8 holds, unchanged.** This plan rewrites local text and spawns local `bash -c` probes. Zero network reach, zero new egress surface, nothing user-specific crosses the Brain boundary. Verified by the phase harness's permanent Part 8 sweep (PASS).
- **Entitlement and pricing were not touched.** `mcp-server-brain/lib/auth.cjs` is untouched and no `/mos:` behavior was gated behind payment (D-12 respected, per the phase-wide scope rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `skills/*/SKILL.md` are generated mirrors, so the migration needed `build-skill-mirrors.cjs` to change with it**

- **Found during:** Task 1, before any file was written
- **Issue:** The plan's `files_modified` listed only the codemod, the 51 skills and the test. But all 51 affected skills are generated mirrors of `commands/*.md` (confirmed: 51 of 51 have a `commands/<name>.md` counterpart). `computeExpectedMirror` derives EXPECTED content from the command bytes with only frontmatter-level exceptions applied, so a body edit in `skills/` reads as divergence. Migrating without teaching the generator would have produced 51 stale mirrors at `--check` and, worse, a later write-mode run would have SILENTLY REVERTED the entire security fix. This is the identical gap class that D-1 already had to close in this phase for 234-03's frontmatter migration.
- **Fix:** Added EXCEPTION CLASS 3 to `scripts/build-skill-mirrors.cjs` (documented header block plus `applyPluginRootPortability`), landed in the SAME commit as the 51-file migration so no intermediate commit leaves a gate red. Did NOT push the transformation back onto `commands/` (that would break the read-only invariant and the plan's own scoping decision).
- **Files modified:** `scripts/build-skill-mirrors.cjs`
- **Commit:** `1d76e30e`
- **Verification:** `build-skill-mirrors --check: OK (111 mirrors match expected content)`; write mode reports `created 0, unchanged 111, overwritten 0 ... plugin-root portable 51`, proving the revert path is closed rather than merely unlikely. The phase test recomputes EXPECTED for every migrated file and compares against disk, so this cannot regress silently.

**2. [Rule 1 - Stale plan data] The plan's occurrence counts for `skills/rooms/SKILL.md` were 8; the file carries 27**

- **Found during:** Task 1 pre-flight
- **Issue:** The plan's `read_first` cited 8 occurrences at specific line numbers (71, 163, 176, 179, 229, 237, 244, 271) and its acceptance criteria asserted `grep -c 'MINDRIAN_OS_ROOT' skills/rooms/SKILL.md` returns 8. Neither the line numbers nor the count match the file on disk: it carries 27 occurrences, and the cited line numbers are off by 4 to 8 lines throughout. The planning-time census was partial.
- **Fix:** Drove the migration entirely from the live `pluginRootCensus()` rather than any frozen literal, exactly as the plan's `action` (correctly) instructed. Total surface is 51 files / 172 occurrences. The acceptance criterion's expected value is 27, not 8; every other acceptance criterion passes as written.
- **Files modified:** none (this is a plan-vs-reality reconciliation)
- **Verification:** `grep -c 'MINDRIAN_OS_ROOT' skills/rooms/SKILL.md` returns 27; census `count: 0` across all 125 skills.

## Verification

All plan acceptance criteria and `<verify><automated>` commands were run.

| Check | Command | Result |
|-------|---------|--------|
| No unwrapped references | `grep -rE '\$\{CLAUDE_PLUGIN_ROOT\}' skills --include=SKILL.md \| grep -v 'MINDRIAN_OS_ROOT:-' \| wc -l` | 0 |
| No bare token at all | `grep -rE '\$\{CLAUDE_PLUGIN_ROOT\}' skills --include=SKILL.md \| wc -l` | 0 |
| Census | `node scripts/check-skill-spec.cjs --plugin-root-census` | `count: 0, scanned: 125` |
| rooms exemplar | `grep -c 'MINDRIAN_OS_ROOT' skills/rooms/SKILL.md` | 27 (plan said 8; see Deviation 2) |
| commands/ untouched | `git diff --name-only commands/ \| wc -l` | 0 |
| Fail-closed syntax spot-check | `bash -c 'unset ...; eval ...'` | non-zero exit + custom message, on bash AND dash |
| Plan's automated verify | `node tests/test-234-plugin-root-migrated.cjs && test "$(git diff --name-only commands/ \| wc -l)" -eq 0` | 19 passed, 0 failed |
| Idempotence | second `node scripts/migrate-plugin-root-refs.cjs` run | `0 file(s) changed` |
| Mirror gate | `node scripts/build-skill-mirrors.cjs --check` | OK, 111 match |
| Mirror write no-op | `node scripts/build-skill-mirrors.cjs` | `unchanged 111, overwritten 0, plugin-root portable 51` |
| Skill spec | `node scripts/check-skill-spec.cjs --check` | OK, 125 conform |
| Catalog budget | `node scripts/check-skill-spec.cjs --catalog-budget` | 12965 / 51200 bytes (25%) |
| Command registry | `node scripts/build-command-registry.cjs --check` | OK |
| Render coverage | `node scripts/check-render-coverage.cjs` | 0 gap, 0 unwired |
| Phase gate | `bash tests/run-all-234.sh` | PASS=9 FAIL=0 SKIP=0 |
| Mutation test | revert one skill to bare form | 17 passed / 2 failed (gate bites) |

### Behavioral verification (the fail-closed claim, executed not asserted)

A real line was lifted off `skills/hmi-status/SKILL.md` and run in four environments:

| Environment | Result |
|-------------|--------|
| Neither variable set (foreign host, the threat case) | exit 127, stderr `MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.`, script NOT executed |
| `MINDRIAN_OS_ROOT` only (foreign host with the escape hatch) | resolved and ran the real `soft-alias-runner.cjs`, exit 0, genuine JSON output |
| `CLAUDE_PLUGIN_ROOT` only (Claude Code today) | resolution byte-identical to pre-migration, exit 0 |
| Both set | `MINDRIAN_OS_ROOT` wins (documented precedence #1) |

For contrast, the pre-migration form under the same threat environment: `would run: node "/scripts/soft-alias-runner.cjs"`, exit 0, silent.

## Known Stubs

None. Every affected shell-out is fully wired to the live resolver precedence; nothing is placeholder, mocked or deferred.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no schema change at a trust boundary. It narrows an existing filesystem-path trust boundary and adds no new one.

## Notes for the Next Plan

- **Prose fallbacks in ~12 skill bodies are now half-contradicted, and they live in `commands/`.** Lines such as `skills/rooms/SKILL.md:179` ("If `CLAUDE_PLUGIN_ROOT` is not set, resolve the templates relative to the plugin's installed location") are natural-language instructions to the model, not shell, so the codemod correctly left them alone. They are now weaker guidance than the shell-level fail-closed behavior sitting beside them. They also originate in `commands/*.md`, so correcting them means editing the mirror SOURCE, which is out of this plan's scope by construction. Worth a follow-up sweep; not a security regression (the prose fallbacks are relative paths, not the attacker-plantable absolute ones this plan closed).
- **Context cost of the wrapper:** roughly 130 bytes per occurrence, about 22KB spread across 51 skill bodies, worst single file `skills/rooms/SKILL.md` at about 3.5KB. Skill bodies load only on activation and the Zed catalog budget (name + description only) is unaffected at 25%. If a shorter form is ever wanted, the constant lives in exactly two places and the byte-identity test will catch a partial change.

## Self-Check: PASSED

- Files claimed created/modified: all 4 verified present on disk.
- Commits claimed: `4a99be73`, `1d76e30e`, `914bc0e3` all verified in git history.
- No em-dashes (CLAUDE.md hard rule): 0 found.
