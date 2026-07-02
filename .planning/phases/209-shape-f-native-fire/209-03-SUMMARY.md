---
phase: 209-shape-f-native-fire
plan: 03
subsystem: build-gate
tags: [declared-implies-wired, render-coverage, shape-declaration, futures-drift]

requires:
  - phase: 209-shape-f-native-fire (plan 02)
    provides: "scripts/stamp-firing-block.cjs (STAMP_MARKER, parseShape, grantTool) - the shared definition site this plan imports rather than duplicating"
provides:
  - "Three new declared-implies-wired predicates in scripts/check-shape-declaration.cjs (wired-body, tool-grant, declared-matches-body), scoped to the 'command' surface class"
  - "commands/futures.md reconciled (body citation fixed to Shape F.2, matching the frontmatter and hitl_why's verbatim F.2 definition)"
  - "scripts/build-render-coverage.cjs buildMdKeyspace() - the .md keyspace walk, additive to the existing .cjs walk"
  - "scripts/check-render-coverage.cjs checkMdEntries() - the fail-closed .md predicate"
  - "data/render-coverage-registry.json regenerated with 97 new .md entries (113 total)"
  - "tests/test-209-declared-implies-wired.cjs - 10-assertion proof across B2+B3"
affects: [209-05, 209-06, 209-07]

tech-stack:
  added: []
  patterns:
    - "Scope predicates to the exact wiring domain a prior plan touched, not the full theoretical surface set - discovered via live-tree audit, not assumed from the plan text"
    - "A precise textual anchor ('Part 3, Shape F.N') beats a naive keyword scan when body text legitimately references multiple shapes for different sub-decisions within one command"
    - "Reuse the mutation function itself as the read predicate: grantTool(content) === content correctly means 'already satisfies the grant rule' for BOTH the absent-key and already-granted cases, with zero new logic"

key-files:
  created:
    - tests/test-209-declared-implies-wired.cjs
  modified:
    - scripts/check-shape-declaration.cjs
    - scripts/build-render-coverage.cjs
    - scripts/check-render-coverage.cjs
    - data/render-coverage-registry.json
    - commands/futures.md

key-decisions:
  - "B2's three new predicates apply ONLY to the 'command' surface class, not agents/pipelines/skills and not hitl_stages commands - this required discovering, mid-implementation, that a naive 'apply everywhere check-shape-declaration.cjs already scans' interpretation produces ~25 violations across surfaces the B1 stamp (plan 02) never touched. Scoping to exactly B1's wiring domain (hitl_shape-declaring commands/*.md) is the only interpretation consistent with the plan's own acceptance criterion ('exits 0 on the live tree AFTER the futures.md reconcile') and with B3's explicitly-stated commands/*.md-only keyspace."
  - "BODY_SHAPE_MENTION_RE narrowed to the exact 'Part 3, Shape F.N' citation form (not any 'Shape F.N' mention) after manually auditing 5 flagged commands: file-meeting.md, memory.md, new-project.md, and systems-thinking.md are legitimate multi-gate commands that cite OTHER shapes for clearly-scoped internal sub-decisions (a nested date-sync gate, a per-subcommand shape table, a named B2 sub-stage, a step-2 sub-offer) - none are drift. Only futures.md uses the Canon-referenced 'Part 3, Shape F.N' citation convention for its own top-level gate (grep-confirmed: the only hit in the entire commands/ tree), which is exactly why it is the phase's sole named case."
  - "futures.md reconciled in the OPPOSITE direction from the plan's default assumption: the frontmatter hitl_shape:'F.2' was correct (hitl_why quotes F.2's canonical schema definition, 'a dependency path where each step needs the last', verbatim), so the body's stray '(Part 3, Shape F.1)' citation was fixed to F.2 instead of flipping the frontmatter. The plan explicitly delegated this direction as discretion ('UNLESS the body reading shows the gate is genuinely [something else]... record which way and why')."
  - "The plan's cited line numbers for futures.md's drift (69, 77, 'twice') are stale - the live file has exactly ONE occurrence (line 79), consistent with the Wave-1-style drift already seen in 209-02's PATTERNS.md; the actual fix targeted the live line, not the stale citation."

patterns-established:
  - "The B1/B2/B3 STAMP_MARKER single-definition-site invariant (T-209-10) is regression-locked by its own assertion in the test suite (grepping for a stray 'const STAMP_MARKER =' redefinition)"

requirements-completed: [B2, B3]

duration: unknown (manual implementation, no subagent stall)
completed: 2026-07-02
---

# Phase 209 Plan 03: Declared-Implies-Wired Build Gate (B2 + B3) Summary

**"Declared implies wired" is now enforced at both the frontmatter-validation layer (check-shape-declaration.cjs) and the render-coverage registry layer (build/check-render-coverage.cjs) for every hitl_shape-declaring command, closing RC-4 one plane up from the Phase 190 shape-declaration mandate - and futures.md's F.2/F.1 drift is reconciled with a documented, semantically-justified direction.**

## Performance

- **Tasks:** 2 completed
- **Files modified:** 6 (1 new test, 5 modified: 2 scripts extended for B2, 2 scripts extended for B3, futures.md reconciled, registry regenerated)

## Accomplishments

- **B2** (`scripts/check-shape-declaration.cjs`): three new predicates - wired-body (the B1 `STAMP_MARKER` or an `AskUserQuestion` mention), tool-grant (an absent `allowed-tools` key passes; a present list must include the grant; handles B1's bare comma-separated scalar dialect), declared-matches-body (a `Part 3, Shape F.N` citation contradicting the declared shape). All three are scoped to genuinely `hitl_shape`-declaring commands (not `hitl_stages`, not agents/pipelines/skills) and honor the existing `excluded:true` + reason escape hatch.
- **futures.md reconciled**: body's `(Part 3, Shape F.1)` citation corrected to `Shape F.2`, since `hitl_why` verbatim quotes F.2's canonical schema definition and the frontmatter was actually correct.
- **B3** (`scripts/build-render-coverage.cjs` + `scripts/check-render-coverage.cjs`): a new, additive `.md` keyspace in the render-coverage registry alongside the existing 16 `.cjs` entries. `buildMdKeyspace()` reuses B1's own `parseShape`/`grantTool`/`STAMP_MARKER` (one shared definition site, Canon Part 7). `checkMdEntries()` fails closed on any `declared_shape` + `wired:false` entry with no valid exclusion.
- Live tree: `node scripts/check-shape-declaration.cjs --check` exits 0 (128 declared, 5 skill-exempt, 133 scanned); `node scripts/check-render-coverage.cjs` exits 0 with 97 declaring commands, 97 wired, 0 unwired.

## Task Commits

1. **Task 1: B2 predicates + futures.md reconcile**
   - `f94cc1a6` feat(209-03): B2 declared-implies-wired predicates + futures.md reconcile
2. **Task 2: B3 render-coverage .md keyspace**
   - `84d14f80` feat(209-03): B3 extend render coverage to the commands/*.md keyspace

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/check-shape-declaration.cjs` - three new predicates in `check()`, `frontmatterToFixture()` extended to accept `bodyText` and derive `body_has_firing_block`/`body_mentions_tool`/`body_shape_mentions`/`allowed_tools`, `checkTree()` passes `bodyText` only for `s.klass === 'command'`, `extractBodyShapeMentions()` new helper, `STAMP_MARKER` imported from `stamp-firing-block.cjs`.
- `commands/futures.md` - one-line body fix (`Shape F.1` -> `Shape F.2` at the `Part 3,` citation).
- `scripts/build-render-coverage.cjs` - `buildMdKeyspace(opts)`, `stripFrontmatter()`, `MD_RENDER_ONLY_EXCLUDED` table; `buildRegistry()` appends the md entries and extends `render_counts` with `md_declared_wired`/`md_declared_unwired`; `GENERATED_NOTE` updated to name both keyspaces.
- `scripts/check-render-coverage.cjs` - `checkMdEntries()`; `renderCoverageReport()` scoped to `.cjs`-shaped entries (`typeof e.kind === 'string'`) so md entries never corrupt the covered/excluded/gap classification; `main()` runs both checks and prints both summaries.
- `data/render-coverage-registry.json` - regenerated: 113 entries (16 `.cjs` + 97 `.md`), 97 wired, 0 unwired.
- `tests/test-209-declared-implies-wired.cjs` - new, 10 assertions across B2 behaviors 1-5 plus a STAMP_MARKER single-definition-site check, and B3 behaviors 6-9.

## Decisions Made

See key-decisions in frontmatter. The two most consequential, both discovered mid-implementation via live-tree audits rather than assumed from the plan text:

1. Scoping the new B2 predicates to the exact `commands/*.md` + `hitl_shape` (not `hitl_stages`) domain that B1 actually wired, after a first pass surfaced ~25 violations across agents, pipelines, skills, and `hitl_stages` commands that were never in B1's scope.
2. Narrowing the shape-contradiction regex to the precise `Part 3, Shape F.N` citation form after manually auditing all 5 initially-flagged commands and confirming 4 of them are legitimate multi-gate designs, not drift.

## Deviations from Plan

The plan's acceptance criterion assumed only `futures.md` would need reconciliation for `check-shape-declaration.cjs` to exit 0 on the live tree. In practice, applying the naive "any Shape F.N mention" version of predicate 9 across all four surface classes produced ~25 additional violations. This was resolved by scope-correction (documented above), not by weakening the predicate's intent - the final implementation still catches the real futures.md drift with zero false positives, verified against the full live tree.

## Issues Encountered

None requiring escalation - both issues above were resolved through direct investigation (reading the actual body context of each flagged command) rather than guesswork, and are documented as decisions rather than open questions.

## Verification Results

- `node tests/test-209-declared-implies-wired.cjs` - exits 0, 10/10 assertions
- `node scripts/check-shape-declaration.cjs --check` - exits 0 (128 declared, 5 skill-exempt, 133 scanned)
- `node scripts/build-render-coverage.cjs && node scripts/check-render-coverage.cjs` - exits 0 (16 covered/0/0 gap on `.cjs`; 97 wired/0 excluded/0 unwired on `.md`)
- `node -e "...md.length>=90..."` - 97 `.md` entries (>= 90 required)
- `node scripts/build-connector-registry.cjs --check` - OK (no collateral)
- `node scripts/build-orchestration-projection.cjs --check` - OK (no collateral)
- `bash tests/run-all-209.sh` - PASS=4 FAIL=0 SKIP=5 (209-01/02/03/04 green; 05/06 x2/07 x2 correctly SKIP)
- No em-dashes across all touched files

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The command plane's declared-implies-wired loop is closed: B1's stamp, B2's frontmatter-level validator, and B3's render-coverage registry all agree via the single shared `STAMP_MARKER`/`parseShape`/`grantTool` definitions in `stamp-firing-block.cjs`. Plans 209-05, 209-06, and 209-07 can proceed; none share files with this plan's changes.

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
