---
phase: 186-corpus-stats-hygiene
plan: 01
subsystem: docs
tags: [corpus-stats, generator, canon-part-8, brain-boundary, generated-artifact, de-stijl-generator-idiom]

# Dependency graph
requires:
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: "scripts/build-connector-registry.cjs - the generator + generated-stamp + deterministic-serializer idiom mirrored here (Canon Part 7 reuse)"
provides:
  - "data/corpus-stats-source.json - the committed single-input magnitude source (27,904 / 177 / 12,485 + 1024-dim)"
  - "scripts/build-corpus-stats.cjs - the Brain-free local generator (node:fs + node:path only)"
  - "docs/CORPUS-STATS.generated.md - the rendered, generated-stamped single source of truth for corpus magnitudes"
  - "data/corpus-stats.generated.json - the machine-readable sibling"
affects: [186-02-PLAN, corpus-literal-repoint, corpus-stats-tripwire]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generated-artifact idiom: a committed local source file -> a Brain-free generator (node built-ins only) -> a generated-stamped rendered artifact + json sibling, mirroring build-connector-registry.cjs"
    - "Deterministic serializer discipline: JSON.stringify(clean, null, 2) + trailing newline so the Plan 02 --check byte-compare is stable"

key-files:
  created:
    - data/corpus-stats-source.json
    - scripts/build-corpus-stats.cjs
    - docs/CORPUS-STATS.generated.md
    - data/corpus-stats.generated.json
  modified: []

key-decisions:
  - "D1: only three asserted magnitudes (27,904 nodes / 177 frameworks / 12,485 Pinecone vectors, 1024-dim); nothing else asserted as fact"
  - "D2: directional sub-counts omitted entirely and labelled non-authoritative in both the source note and the rendered artifact"
  - "D5 / T-186-01: generator requires only node:fs + node:path; no Brain client, no network module; magnitudes read from the committed source, never a live Brain query on the hot path"
  - "pinecone_dim renders as a plain integer (1024-dim), not grouped-thousands, since dimensionality is an embedding-width label, not a corpus magnitude"

patterns-established:
  - "Pattern 1: corpus magnitudes have ONE rendered home (the generated artifact); literals stop drifting because every number is rendered, not hand-typed"
  - "Pattern 2: the Part 8 boundary is made structural, not audited - a grep over the generator for forbidden import tokens returns nothing, proving Brain-free by construction"

requirements-completed: [CORPUS-01]

# Metrics
duration: 15min
completed: 2026-06-27
---

# Phase 186 Plan 01: Corpus Stats Hygiene Summary

**A committed magnitude source plus a Brain-free local generator that renders the generated-stamped single source of truth for the three asserted corpus magnitudes (27,904 nodes / 177 frameworks / 12,485 Pinecone vectors, 1024-dim), mirroring the build-connector-registry.cjs idiom.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-27T08:59:00Z (approx)
- **Completed:** 2026-06-27T09:14:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments
- `data/corpus-stats-source.json` committed as the single hand-edited input carrying exactly the three D1 magnitudes, the 1024 dim, the read date, and a directional-only note (D2).
- `scripts/build-corpus-stats.cjs` mirrors `build-connector-registry.cjs`: REPO_ROOT + path constants, a GENERATED_NOTE stamp, `loadSource` / `renderMarkdown` / `serializeArtifactJson` pure functions exported under `require.main === module`, a three-branch `main()` (default-write + a reserved `--check` stub Plan 02 owns), and the deterministic `JSON.stringify(..., null, 2)` + trailing-newline serializer.
- `docs/CORPUS-STATS.generated.md` rendered and generated-stamped (HTML comment + visible "do not hand-edit" line), asserting the three magnitudes with grouped-thousands formatting and explicitly NOT asserting any directional sub-count.
- `data/corpus-stats.generated.json` rendered as the machine-readable sibling (the three magnitudes + dim + stamp + read date).
- Part 8 / T-186-01 proven structurally: the generator imports only `node:fs` + `node:path`; the done-criteria grep for forbidden import tokens returns nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Committed magnitude source + the local generator (default-write)** - `298ca727` (feat)
2. **Task 2: Emit the artifact and prove it is generated-stamped, magnitude-correct, and Brain-free** - `bdbebcc7` (feat)

## Files Created/Modified
- `data/corpus-stats-source.json` - the committed single input (three D1 magnitudes + dim + read date + directional-only note)
- `scripts/build-corpus-stats.cjs` - the Brain-free local generator (node built-ins only; deterministic serializer; pure functions exported)
- `docs/CORPUS-STATS.generated.md` - the rendered, generated-stamped single source of truth
- `data/corpus-stats.generated.json` - the machine-readable sibling

## Decisions Made
- Rendered `pinecone_dim` as a plain integer (`1024-dim`) rather than grouped-thousands, matching the canonical "1024-dim" phrasing in the hard constraints. Dimensionality is an embedding-width label, not a corpus magnitude.
- Phrased the generator's Part 8 header comment to avoid the literal forbidden import tokens (`brain-client`, `fetch(`, `node:https`, `node:http`) so the done-criteria proof-grep returns nothing - the comment describing the boundary must not itself defeat the boundary proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Part 8 proof-grep defeated by the generator's own comment**
- **Found during:** Task 1 (generator authoring)
- **Issue:** The initial Part 8 header comment contained the literal tokens `brain-client`, an example `fetch(` regex, and `node:http`, so the Task 2 done-criteria grep (which must return nothing to PROVE no network module) matched the comment - a false positive that would defeat the structural proof.
- **Fix:** Reworded the comment to describe the boundary in plain words ("no Brain MCP client", "no network module of any kind") without embedding the trigger literals.
- **Files modified:** scripts/build-corpus-stats.cjs
- **Verification:** Both the Task 2 done-criteria grep and the phase verification grep now return nothing.
- **Committed in:** `298ca727` (Task 1 commit)

**2. [Rule 1 - Bug] Dimensionality rendered as "1,024-dim" instead of "1024-dim"**
- **Found during:** Task 2 (artifact emission inspection)
- **Issue:** The first render applied grouped-thousands to `pinecone_dim`, producing "1,024-dim"; the canonical phrasing (and the hard constraint) is "1024-dim".
- **Fix:** Render `pinecone_dim` as a plain integer in both the markdown and the console log; magnitudes stay grouped-thousands.
- **Files modified:** scripts/build-corpus-stats.cjs
- **Verification:** `grep -q "1024-dim"` passes; the three magnitudes still render grouped (27,904 / 177 / 12,485).
- **Committed in:** `bdbebcc7` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes were correctness refinements to the generator that ships in this plan; no scope creep. The artifact and source land exactly as specified.

## Issues Encountered
None. The connector-registry idiom transferred cleanly.

## User Setup Required
None - no external service configuration required. The generator is local and Brain-free.

## Next Phase Readiness
- CORPUS-01 satisfied: the generated-stamped single-source-of-truth artifact carries the three D1 magnitudes, rendered from a committed local source by a Brain-free local generator.
- Plan 02 (186-02) is ready: it owns the `--check` tripwire (the stub is reserved in `main()`), the historical-provenance exclude list, the LIVE-surface repoint to 27,904 / 177 / 12,485, the pre-commit/release wiring, and `tests/run-all-186.sh`.

## Known Stubs
- `scripts/build-corpus-stats.cjs` `--check` branch is an intentional stub (re-renders in memory, exits 0, logs that Plan 02 owns the tripwire). This is by-design per the plan's Task 1 action ("reserve a --check branch as a stub that Plan 02 fills") and is explicitly resolved by Plan 186-02 (CORPUS-02). The default-write path is fully functional.

## Self-Check: PASSED

All four created files exist on disk; both task commits (`298ca727`, `bdbebcc7`) are present in git history.

---
*Phase: 186-corpus-stats-hygiene*
*Completed: 2026-06-27*
