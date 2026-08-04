---
phase: quick-260804-ptk
plan: 01
subsystem: docs
tags: [pws-brain, memgraph, skill-mirrors, connector-registry, canon-part-11, retirement]

requires:
  - phase: "2026-07-22 Memgraph migration"
    provides: "The unified pws-brain-mcp backend that supersedes both routes this harness compared"
provides:
  - "commands/pws-brain.md marked RETIRED in three reachable places (frontmatter description, connector.reason, blockquote note under the H1)"
  - "skills/pws-brain/SKILL.md regenerated as an in-sync mirror carrying the identical marking"
  - "An interactive_first_reward declaration for pws-brain, closing a latent reward-before-investment guard failure"
affects: [next-release-cut, dist-bundle-regeneration, changelog, any-future-skill-edit-task]

tech-stack:
  added: []
  patterns:
    - "commands/ is the single source of truth; skills/*/SKILL.md are generated mirrors, never hand-edited"

key-files:
  created: []
  modified:
    - commands/pws-brain.md
    - skills/pws-brain/SKILL.md

key-decisions:
  - "Edited commands/pws-brain.md and regenerated the mirror rather than hand-editing skills/pws-brain/SKILL.md, which would have turned the build-skill-mirrors --check release gate red"
  - "Merged the plan's two tasks into one commit because the pre-commit hook enforces mirror sync, making a source-only commit impossible without bypassing a release gate"
  - "Declared interactive_first_reward: --none (scripting only) for pws-brain: a retired harness is not a navigator entry flow and has no first variable reward to deliver"
  - "Left dist/ bundles unregenerated: already stale at baseline from unrelated version drift (1.15.3-beta.51 vs 1.16.0-beta.8) and no gate blocks on it"

patterns-established:
  - "Retirement marking pattern: state the superseded status in the frontmatter description (tool-reachable), in connector.reason (build-reachable), and in a body note (human-reachable), then preserve the mechanics below as historical reference"

requirements-completed: [QUICK-PWS-BRAIN-RETIRE-01]

duration: ~12min
completed: 2026-08-04
---

# Quick 260804-ptk: Retire the pws-brain Comparison Harness Summary

**The /mos:pws-brain harness now announces, before any mechanics, that both backends it compares were superseded by the 2026-07-22 Memgraph migration and that the live backend is the unified pws-brain-mcp service, with the harness mechanics preserved intact as historical reference.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 planned, both complete (delivered in 1 commit, see Deviations)
- **Files modified:** 2

## Accomplishments

### The problem this closes

`/mos:pws-brain` ran one methodology question through two routes and showed the answers side by side:

- **Route A:** the `mindrian-brain` MCP (Neo4j plus Pinecone vectors), described in the file as "the real Brain every user reaches"
- **Route B:** the `neo4j-agent` Aura Agent over the same Neo4j graph

Both routes were superseded by the 2026-07-22 Memgraph migration. `lib/core/brain-client.cjs` hardcodes `https://pws-brain-mcp.onrender.com` as its `BRAIN_URL` default, and its file header names that URL "step 4 of the 2026-07-22 Memgraph migration." A navigator running the harness today therefore measured a backend pair production no longer uses, while the file's own prose told them route A was live truth.

### What changed

Three edits to `commands/pws-brain.md`, then a regenerated mirror:

1. **Frontmatter `description`** now opens `RETIRED TEST HARNESS (superseded 2026-07-22)`, names both superseded routes, and names the replacement. Kept as a single quoted YAML scalar so the hand-rolled frontmatter parsers keep parsing it.
2. **`connector.reason`** now records the retirement, names the unified `pws-brain-mcp` Memgraph backend with its URL, and cites the `brain-client.cjs` `BRAIN_URL` default as in-repo proof. `excluded: true` and the closing Part 11 R1 clause are unchanged, so the CIRS classification still reads correctly.
3. **A blockquote note under the H1**, above the untouched `**EXPERIMENTAL.**` paragraph, tells the reader not to run this to learn how the Brain behaves and states that everything below is preserved for a deliberate re-run.

The retirement is now reachable three ways: by a tool reading frontmatter, by a build script reading `connector.reason`, and by a human reading the body.

### What was deliberately preserved

All five harness sections survive verbatim in both files: `Part 8 Boundary (LOCKED)`, `Pre-flight`, `Run the comparison`, `Present the report (Shape E)`, and `Zone 4 (Action Footer)`. Nothing was deleted. The Part 8 GENERIC-ONLY screen matters most here: the harness still sends navigator-authored text to external backends if re-run, so the boundary it enforced had to stay intact rather than being softened alongside the retirement.

## The architectural finding (READ THIS BEFORE ANY FUTURE "edit skills/<name>/SKILL.md" TASK)

**`skills/*/SKILL.md` files are GENERATED MIRRORS, not hand-authored files.**

- 111 of them are produced by `scripts/build-skill-mirrors.cjs` from `commands/*.md`, which is the documented single source of truth. That script's own header says so: "WHY commands/ STAYS THE SINGLE SOURCE OF TRUTH (read-only here)."
- The mirrors exist to work around a confirmed Windows Claude Code command-registration host bug.
- **Only `trending-to-absurd` is genuinely hand-authored** and skip-listed. Every other skill is generated.
- The staleness gate is a **blocker in two places**: `scripts/verify-release:327` and the `doctor --acceptance` gate list (`scripts/doctor.cjs`, id `skill-mirrors`). It also runs as a **pre-commit hook**, which is how this session found out (see Deviations).

So any task phrased as "edit `skills/<name>/SKILL.md`" must instead edit `commands/<name>.md` and run `node scripts/build-skill-mirrors.cjs`. A direct edit to the mirror desyncs it from its command and turns the release gate red.

The generator applies two documented exception classes (DESENSITIZE, SKILL-SPEC NORMALIZATION), which is why the skill carries `license:`/`compatibility:` fields and a flattened `allowed-tools:` line that the command does not. That divergence is correct; do not try to reconcile it by hand.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Tasks 1 and 2 merged into a single commit

- **Found during:** Task 1 commit
- **Issue:** The plan specified two atomic commits, one per task. The repo's pre-commit hook runs `build-skill-mirrors --check` and rejected the source-only commit with `pws-brain (DIVERGES)`. A source-only commit is structurally impossible here.
- **Fix:** Regenerated the mirror first (Task 2 step 1), then committed both files together. The alternative was `COMMIT_NO_VERIFY=1`, which bypasses a release gate and was rejected.
- **Why this is correct, not a workaround:** a source file and its generated mirror are one atomic unit by design. The hook is enforcing exactly the invariant the plan's critical finding identified.
- **Commit:** e42752c0

### 2. [Rule 3 - Blocking] Added a missing `interactive_first_reward` declaration

- **Found during:** Task 2 commit
- **Issue:** A second pre-commit guard, `mva-rule-linter` (`lib/core/mva-rule-linter.cjs`, per `docs/reward-before-investment-rule.md`), hard-fails on any staged `commands/*.md` lacking an `interactive_first_reward` frontmatter field. `commands/pws-brain.md` never had one. This was a **latent pre-existing gap**: the linter only scans STAGED files, so it had never fired on this command. Only 12 of 112 commands currently declare the field, so many others carry the same latent gap.
- **Fix:** Declared `interactive_first_reward: --none (scripting only)`, the rule doc's explicit opt-out, with a three-line frontmatter comment explaining why. A retired, deliberately-invoked evaluation harness (`disable-model-invocation: true`, `connector.excluded: true`) is not a navigator entry flow and has no first variable reward to deliver. Claiming any of the five positive reward types would have been a false declaration.
- **Verified safe:** `data/command-registry.json` does not bake this field, so the registry stayed in sync (`build-command-registry.cjs --check` -> OK).
- **Files modified:** `commands/pws-brain.md` (plus the regenerated mirror)
- **Commit:** e42752c0

### 3. [Scope note] `git status --porcelain` baseline includes pre-existing untracked files

- The plan's verification expected `git status --porcelain` to list exactly two entries. The working tree carries 18 pre-existing **untracked** paths (`.planning/debug/*`, `prototypes/`, `docs/MINDRIANOS-PRD.md`, `dist/zed/.agents/mcp_config.json`) that predate this task.
- The check was run as `git status --porcelain --untracked-files=no`, which is the assertion the plan actually intended (no unexpected *tracked* modifications). That returned exactly the two pws-brain files, and is now empty post-commit.

## Verification Results

Run from `/home/jsagi/dev/MindrianOS-Plugin/` (WORKSPACE GUARD honored).

| # | Check | Result |
|---|-------|--------|
| 1 | `node scripts/build-skill-mirrors.cjs --check` | exit 0, "111 mirrors match expected content" |
| 2 | `node scripts/build-connector-registry.cjs --check` | exit 0, `connector-registry: OK` |
| 3 | `node scripts/build-orchestration-projection.cjs --check` | exit 0, `orchestration-projection: OK` |
| 4 | `node scripts/check-render-coverage.cjs` | exit 0 |
| 5 | `node scripts/build-command-registry.cjs --check` | exit 0, `command-registry: OK` |
| 6 | em-dash scan (`grep -n $'\\u2014'`) over both touched files | no output (zero em-dashes) |
| 7 | `git diff --name-only HEAD~1 HEAD` | exactly the two pws-brain surface files |
| 8 | `git diff --quiet bbc25d32 HEAD -- lib/core/brain-client.cjs` | exit 0 (runtime byte-identical) |
| 9 | `git diff HEAD~1 HEAD --stat -- lib/ scripts/ data/ dist/` | empty (no generated artifact or runtime drift) |
| 10 | `git diff --diff-filter=D --name-only HEAD~1 HEAD` | empty (nothing deleted) |
| 11 | All five H2 sections present in the regenerated mirror | confirmed (lines 60, 79, 104, 122, 149) |

**Advisory, not blocking:** `node scripts/check-shape-declaration.cjs --check` exits 0 at its Phase 210 baseline; its WARNs concern `skills/vault` and `skills/visualize`, both pre-existing and unrelated. The `command-registration sweep` emits a pre-existing `long_description` WARN class (37 warnings across 112 commands); `pws-brain` was already in that list at 154 chars and is now 259. Sweep result is PASS.

## Deferred Items

- **`dist/` bundles not regenerated.** `dist/generic-claude-dir/.claude/skills/pws-brain/SKILL.md` and `dist/zed/.agents/skills/pws-brain/SKILL.md` are git-tracked and generated from `skills/`, so they now lag by this change. They were **already stale at baseline for an unrelated reason**: `build-dist-bundles.cjs --check-stale` reports "generated from 1.15.3-beta.51, the live plugin is 1.16.0-beta.8". Regenerating would sweep a large version-wide diff across 111+ skills into a docs-only quick task. No gate blocks on dist staleness (`build-dist-bundles` appears in neither `verify-release` nor `release.sh`). Resolves at the next release cut.
- **`CHANGELOG.md` not touched.** Retiring a navigator-visible surface is arguably changelog-worthy at the next beta cut. Out of scope per the task brief's explicit file constraint.
- **The latent `interactive_first_reward` gap is repo-wide.** 100 of 112 commands still lack the field and will each hard-fail their next commit the moment they are staged. Worth a dedicated sweep rather than discovering it one command at a time.

## Known Stubs

None. This was a docs-only change; no code paths, no placeholder values, no unwired data sources.

## Threat Flags

None. This plan added no network path, no endpoint, no auth path, and no schema change. The one security-relevant surface in scope, the Part 8 GENERIC-ONLY screen at the navigator-to-Brain boundary, was explicitly preserved verbatim rather than modified (register entry T-ptk-03, disposition accept). Both mitigate-disposition entries were honored: T-ptk-01 (never hand-edit the mirror; regenerated and proven in sync) and T-ptk-02 (`connector.reason` kept a single quoted scalar; `build-connector-registry.cjs --check` proves it parses).

## Commits

| Hash | Message |
|------|---------|
| e42752c0 | `docs(quick-260804-ptk): mark the pws-brain comparison harness RETIRED` |

## Self-Check: PASSED

- `commands/pws-brain.md` FOUND, contains `pws-brain-mcp`, `RETIRED`, `brain-client.cjs`
- `skills/pws-brain/SKILL.md` FOUND, contains `pws-brain-mcp.onrender.com`, `RETIRED` (4 occurrences)
- Commit `e42752c0` FOUND in `git log`
- `lib/core/brain-client.cjs` unmodified since `bbc25d32`
- Zero em-dashes in both touched files
