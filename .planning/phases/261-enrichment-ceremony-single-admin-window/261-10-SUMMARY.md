---
phase: 261-enrichment-ceremony-single-admin-window
plan: 10
subsystem: brain-graph-enrichment
tags: [memgraph, cypher, mcp, frontmatter-derivation, uses-framework, brain-repo]

# Dependency graph
requires:
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: 01
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain), the
      single measured worklist this plan reads, including the [W-7] USES_FRAMEWORK
      edge-scarcity baseline (86 edges, 112 commands, 59 zero-framework) this plan
      re-measures and confirms unchanged"
provides:
  - "scripts/derive-command-framework-edges.mjs (ProblemsWorthSolving-Brain): re-runnable,
    read-tier derivation of the command -> framework USES_FRAMEWORK edge list from tracked
    command frontmatter, reusing the plugin's shipped scanMethodologyCommands()"
  - "payloads/command-framework-edges-2026-08-21/ (ProblemsWorthSolving-Brain): the guarded
    edge-merge payload directory (compile_only, never executed), authored at AUTHORABLE=0
    with the live finding fully documented"
affects: [262, 263]

# Tech tracking
tech-stack:
  added: []
  patterns: ["cross-repo CJS-to-ESM bridge via node:module's createRequire on an absolute
    path, chosen over a child-process spawn since the shipped function has no top-level
    side effects", "per-command frontmatter attribution reconstructed alongside a shipped
    aggregate-only scanner, cross-validated against that scanner's own totals before any
    row is trusted (TRUST-02 VOID on mismatch), documented as a bridging gap rather than
    silently duplicating a second parser"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/scripts/derive-command-framework-edges.mjs
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/00-derivation.md
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/01-merge-uses-framework.cypher
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/90-dry-run.cypher
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/91-verify.cypher
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/99-undo.cypher
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/manifest.json
    - ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/README.md
  modified: []

key-decisions:
  - "Bridged the plugin's shipped scanMethodologyCommands() (aggregate framework->uses only,
    no per-command attribution) with a minimal, byte-identical-regex per-command walk,
    cross-validated against the shipped aggregate on every run rather than trusted blind --
    the shipped function's return shape does not carry the per-(command,framework) pairing
    this derivation needs, and this is the honest bridge rather than a silent second parser"
  - "AUTHORABLE=0 is the correct, measured live outcome, not a bug: 50 of 51
    frontmatter-declared (command, framework) pairs already carry an unstamped
    USES_FRAMEWORK edge in canon (batch_id null, predating this repo's provenance
    convention); the 51st (PEST Analysis) has no live :Framework node to resolve against.
    The roadmap's retired 25-edge figure, sourced from an unreachable claude.ai artifact,
    is superseded by this live measurement rather than reconciled against it"
  - "Neither this batch nor plan 261-09's archived-block relabel moves the 59/112
    zero-framework-command metric the worklist's own Section 9 named edge authoring as
    the sole lever for -- recorded plainly in 00-derivation.md and the payload README
    rather than letting a payload with a real batch_id imply a real fix landed"

patterns-established:
  - "A compile_only payload directory can be fully authored, reviewed-shaped, and
    guarded at a genuine AUTHORABLE=0, the same pattern plan 261-08 established for its
    zero-active-statement entity-dedup card -- the payload's value is the re-runnable
    derivation and the guard rails, not a forced non-zero row count"

requirements-completed: []  # CER-05 mismatch flagged, not marked complete -- see note below

# Metrics
duration: ~30min
completed: 2026-08-21
---

# Phase 261 Plan 10: Command -> Framework USES_FRAMEWORK Derivation Summary

**Authored a re-runnable, frontmatter-sourced USES_FRAMEWORK derivation script plus its guarded
edge-merge payload, and found live AUTHORABLE=0: the graph already silently holds 50 of 51
frontmatter-declared command-framework edges, so neither this batch nor plan 261-09's relabel
moves the 59/112 zero-framework-command metric.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2/2 completed
- **Files modified:** 8 (all created, all in `ProblemsWorthSolving-Brain`)

## Accomplishments

- Built `scripts/derive-command-framework-edges.mjs`: reuses the plugin's shipped
  `scanMethodologyCommands()` via an absolute-path `require()` bridge (CJS plugin repo into this
  ESM script, no child process needed, no top-level side effects in the bridged module), adds a
  minimal per-command frontmatter attribution walk using byte-identical extraction regexes, and
  cross-validates the reconstruction against the shipped function's own aggregate before trusting
  a single row (VOID/exit 3 on any disagreement, per TRUST-02).
  Resolves each declared `(command, framework)` pair against the live graph via three batched
  read-tier queries (all `:MindrianCommand` nodes, all matching `:Framework` nodes with an
  archived flag, all existing `USES_FRAMEWORK` edge endpoints) rather than one query per pair,
  keeping the run well under the platform's 120-req/60s rate limit.
- Live run (2026-08-21): 50 `kind: methodology` commands, 28 distinct declared framework names, 51
  total declared pairs. **AUTHORABLE: 0. ALREADY PRESENT: 50. UNRESOLVABLE: 1** (`PEST Analysis`,
  declared by `/mos:macro-trends`, resolves to 0 live `:Framework` nodes -- matches
  `docs/2026-08-21-WORKLIST-261-ceremony.md`'s independently-measured CER-04 row exactly, a strong
  cross-check on correctness).
- Wrote `payloads/command-framework-edges-2026-08-21/00-derivation.md`: the roadmap's unreachable
  25-edge claim named and contrasted side by side with the derived 0; the 50 already-present pairs
  listed in full (idempotency visible); the one unresolvable row with its specific reason;
  Section 5's before/projected-after metric numbers (86 total edges, 59/112 zero-framework, both
  unchanged); Section 6's three-reason exclusion of `payloads/framework-command-map-2026-08-18/`.
- Authored the six remaining payload files (`01-merge-uses-framework.cypher` through `README.md`),
  `batch_id` `pws-cmdfwedges-2026-08-21`, all compile-only, none executed: the merge statement
  double-binds both endpoints by internal id AND name (guarding against the exact unbounded-`MATCH`
  fan-out class `docs/2026-08-20-RCA-alias-self-loop-minting.md` documents), requires `f:Framework`,
  and stamps `batch_id`/`created_by`/`created_at` on the edge only; `90-dry-run.cypher` reproduces
  the `[W-7]`-style before numbers live; `91-verify.cypher` carries both required negative controls
  (`[91.4]` out-of-scope-pair, `[91.5]` non-`:Framework` target); `99-undo.cypher` is a clean, full
  revert (every edge this batch could ever write is brand new, so deletion by `batch_id` restores
  the exact pre-batch state); `manifest.json` summarises the one `UNRESOLVABLE` row by reason
  category; `README.md` states plainly that this batch does not move the product metric and why.

## Task Commits

Both commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing freeze):

1. **Task 1: Build the re-runnable derivation and record what it found** - `3899760` (feat)
2. **Task 2: Author the edge payload directory** - `19f67f5` (feat)

**Plan metadata (this repo, MindrianOS-Plugin):** pending final commit alongside STATE.md/
ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/scripts/derive-command-framework-edges.mjs` - the re-runnable
  derivation script
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/00-derivation.md` - the
  derived edge list, provenance, and the AUTHORABLE=0 finding
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/01-merge-uses-framework.cypher` -
  the guarded `UNWIND $rows` merge statement
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/90-dry-run.cypher` -
  read-only pre-window checks
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/91-verify.cypher` -
  read-only post-window checks, two negative controls
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/99-undo.cypher` - clean
  full revert by `batch_id`
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/manifest.json` - batch
  metadata, `unresolved_residue` by reason category
- `ProblemsWorthSolving-Brain/payloads/command-framework-edges-2026-08-21/README.md` - what the
  batch does and the honest AUTHORABLE=0 / metric-unmoved statement

## Decisions Made

- **Bridged the CJS-to-ESM gap via `createRequire` on an absolute path**, not a child-process
  spawn: `scanMethodologyCommands()` is a pure function (confirmed by reading its source before
  writing the bridge -- no network calls, no side effects outside its `require.main === module`
  guard), so requiring it directly is simpler and has the identical effect to spawning a
  subprocess and parsing its stdout.
- **Reconstructed per-command attribution alongside the shipped aggregate, cross-validated rather
  than trusted.** `scanMethodologyCommands()` returns `{ name, uses }` per framework, discarding
  which command declared which framework -- exactly the fact this derivation needs to author an
  edge and cite a source. Rather than silently writing a second, competing frontmatter parser, the
  per-command walk uses byte-identical extraction rules to the shipped function and its output is
  checked against the shipped function's own totals (`commandCount`, per-framework `uses`) before
  a single row is trusted; any disagreement is a hard VOID (exit 3), not a silent proceed.
- **Reused three batched read-tier queries** (all commands, all matching frameworks, all existing
  edges) instead of one query per `(command, framework)` pair, keeping the live run to 4 total
  Brain calls (`initialize` + 3 `brain_query` calls) rather than ~130+, well inside the
  120-request/60-second rate limit `261-01-SUMMARY.md` already hit once this phase.
- **Did not force a non-zero AUTHORABLE list.** The live measurement is what it is: 50 of 51
  declared pairs already have an edge. Manufacturing a workaround (loosening the resolution rule,
  treating "already present" pairs as re-mintable) would have hidden the real finding. Section 5
  of `00-derivation.md` and the payload `README.md` both state plainly that this means neither
  this batch nor plan 261-09's relabel moves the phase's own target metric.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's assumed data shape from `scanMethodologyCommands()` did not match reality**
- **Found during:** Task 1, reading `scripts/build-brain-census.cjs` per the plan's own
  `<read_first>` instruction
- **Issue:** The plan's action text says to enumerate "every methodology command and its declared
  `frameworks:` array, by invoking the plugin's shipped `scanMethodologyCommands()`." The shipped
  function's actual return shape is `{ commandCount, scannedAt, frameworks: [{ name, uses }] }` --
  an aggregate of framework name to usage COUNT across all commands, not a per-command list of
  declared frameworks. Without per-command attribution, no `(command, framework)` edge and no
  source citation per row (both explicitly required by the plan's acceptance criteria) could be
  produced from the shipped function's output alone.
- **Fix:** Added a minimal, byte-identical-regex per-command walk (see Decisions above) that
  reconstructs the per-command attribution the shipped function discards, cross-validated against
  the shipped function's own totals on every run so the reconstruction can never silently drift
  from what the shipped scanner itself reports.
- **Files modified:** `ProblemsWorthSolving-Brain/scripts/derive-command-framework-edges.mjs`
- **Verification:** Live run's cross-validation passed with zero disagreements (50 commands, 28
  frameworks, every per-framework use-count matching); the acceptance criterion's grep check
  (script references `scanMethodologyCommands` and `probe-wave-attribution`, no standalone
  `fetch(`) also passes, since the reused shipped function is still the sole source of the
  canonical command/framework universe and the bridge mints no second HTTP client.
- **Committed in:** `3899760` (Task 1 commit)

**2. [Rule 3 - Blocking] `q()` from the imported transport has no params argument**
- **Found during:** Task 1, writing the framework-name resolution query
- **Issue:** `probe-wave-attribution.mjs`'s exported `q(key, cypher)` takes no `params` argument,
  but resolving 28 distinct framework names safely (without raw string interpolation into Cypher)
  requires `brain_query`'s own `params` field, which the tool itself supports
  (`src/http/brain-query-tool.mjs`).
- **Fix:** Added a local `qp(key, cypher, params)` helper that calls the SAME imported `call()`
  transport with a `params` argument added, mirroring `q()`'s own result-parsing exactly. No
  second HTTP client is minted; this is a two-line wrapper around the already-imported `call()`.
- **Files modified:** `ProblemsWorthSolving-Brain/scripts/derive-command-framework-edges.mjs`
- **Verification:** Live framework-resolution query ran cleanly with the `$names` param bound;
  acceptance criterion's `no standalone fetch(` grep still passes.
- **Committed in:** `3899760` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug/gap in the plan's assumed data shape, 1 blocking
transport gap). Both necessary to produce a working, honest derivation; neither expanded scope
beyond what the plan's own acceptance criteria required.

## Issues Encountered

- The live derivation's AUTHORABLE=0 result is not itself an "issue" in the problem-to-be-fixed
  sense, but it is a finding worth flagging loudly for the next reader (and is flagged loudly, in
  `00-derivation.md` Section 5 and the payload `README.md`): the worklist's own Section 9 named
  edge authoring as the one lever in this phase that could move the 59/112 zero-framework-command
  metric, and this plan's live measurement shows it does not, for a different reason than plan
  261-09's relabel (not wrong targets, but that the graph already silently holds the content).
  Not fixed here -- there is nothing to fix; CER-04's separate job (authoring a `PEST Analysis`
  framework node) is the only remaining lever this worklist names, and even that only resolves one
  of the 59.

- **CER-05 requirement mismatch, flagged not fixed** (the same class plan 261-09 already flagged
  in its own SUMMARY): this plan's own frontmatter names `requirements: [CER-05]`, but
  `.planning/REQUIREMENTS.md`'s CER-05 is "The 42214 self-loop is DELETEd over HTTPS" -- plan
  261-08's scope, still unchecked there because that DELETE is compile-only/unexecuted pending the
  same admin window this plan's batch is also pending. This plan's actual deliverable (the
  frontmatter-derived `USES_FRAMEWORK` edge batch) is not named by any REQUIREMENTS.md id under
  its own frontmatter's CER-05 label. `requirements-completed` is left empty rather than
  incorrectly checking off CER-05 for work that is not what CER-05 describes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/derive-command-framework-edges.mjs` is committed and re-runnable: Phase 262 or 263 can
  run it again against a later graph state (a newly authored `PEST Analysis` node from CER-04, a
  new methodology command) and it will populate `$rows` without any change to
  `01-merge-uses-framework.cypher`'s reviewed statement text.
- `payloads/command-framework-edges-2026-08-21/` is fully authored, guarded, and ready for a
  future admin window to execute at whatever row count a fresh derivation run produces -- currently
  0, so the window's most honest action may be to record that this batch had nothing to execute
  and close it as such, per the payload's own `README.md` note.
- Both this batch and plan 261-09's relabel are ready to log separate `GraphWriteEvent` /
  `GRAPH-WRITE-LOG.md` rows with a read-tier probe between them, per the attribution rule both
  payloads' `README.md` states, whenever plan 261-13 opens the phase's single admin window.
- The 59/112 zero-framework-command metric is now confirmed, by two independent operations this
  phase authored (261-09's relabel and this plan's edge derivation), to require different work
  than either operation performs -- most plausibly new command/framework content, or the
  unattributed pre-existing edges' own provenance investigation, neither of which is in this
  phase's scope.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*
