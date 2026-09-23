---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 12
subsystem: hsi-classifier
tags: [direction-convention, readers, enums, stored-labels, d-57-file, d-07]

requires:
  - phase: 355-01
    provides: "lib/core/direction-convention.cjs (classify, classifyDiff, DIRECTIONS, NONE)"
  - phase: 355-02
    provides: "tests/fixtures/355/direction-pairs.json, tests/test-355-direction-agreement.cjs (legs A-H)"
  - phase: 355-05
    provides: "the D-57 gate / tool-router.cjs anchor precedent this plan's Task 1 re-reads before editing"
provides:
  - "lib/core/eureka-critic.cjs SURPRISE_TYPES, lib/core/eureka/eureka-offer.cjs DIRECTION_ENUM and lib/core/grill-engine.cjs EUREKA_SURPRISE_TYPES each alias direction-convention.cjs's DIRECTIONS instead of carrying a second copy of the two wire ids"
  - "lib/mcp/tool-router.cjs's eureka_critic zod schema uses z.enum(DIRECTIONS); schema_version field byte-unchanged"
  - "eureka-critic.cjs's classifyCandidate re-derives surprise_type from the candidate's own (lsa, semantic) pair via classify() when no explicit value is present, falling back to the historical default only when neither an explicit value nor a measurable pair exists"
  - "scripts/hsi-to-graph.cjs writes HSI_CONNECTION surprise_type as classify(lsa_sim, semantic_sim), never trusting the stored string from compute-hsi.py; a missing pair writes 'none'"
  - "lib/core/nl-graph-queries.cjs re-derives surprise_type fresh on every hsi_connections read and suppresses REVERSE_SALIENT innovation_type (NULL) unless the edge's own properties.source is 'rs-engine'"
  - "lib/chat/fabric-chat.cjs and scripts/generate-chat-embed.cjs's LLM-facing schema descriptions state the module's meaning and the re-derivation/suppression rule"
  - "tests/test-355-direction-readers.cjs: 29 legs across Task 1 (enum identity, static exception sweep, zod schema behavior) and Task 2 (write-time and read-time re-derivation, leg-H no-new-hits check)"
affects: [355-19]

tech-stack:
  added: []
  patterns:
    - "Alias, not re-freeze: a local enum constant that used to be its own Object.freeze([...]) becomes a bare assignment to the module's already-frozen export (const SURPRISE_TYPES = DIRECTIONS;), so every in-file reference keeps working under its original name with zero call-site changes"
    - "Read-time re-derivation via a post-query JS pass: when a SQL template cannot honestly express classify()'s null-sentinel logic, select the raw inputs (lsa_sim, semantic_sim) alongside the stored (untrusted) column and overwrite it in the JS layer that returns the rows, once, at the one query intent that needs it"
    - "Suppression via CASE WHEN, no label literal in SQL: gating REVERSE_SALIENT's innovation_type on properties.source = 'rs-engine' is expressed as a SQL CASE that returns the column or NULL, never a wire-id string literal, so leg H's repo-wide comparison-to-label sweep has nothing to catch here"

key-files:
  created:
    - tests/test-355-direction-readers.cjs
  modified:
    - lib/core/eureka-critic.cjs
    - lib/core/eureka/eureka-offer.cjs
    - lib/core/grill-engine.cjs
    - lib/mcp/tool-router.cjs
    - scripts/hsi-to-graph.cjs
    - lib/core/nl-graph-queries.cjs
    - lib/chat/fabric-chat.cjs
    - scripts/generate-chat-embed.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "eureka-critic.cjs's classifyCandidate (:676 area) now derives surprise_type via classify(candidate.lsa_similarity, candidate.semantic_similarity) when the candidate carries no explicit surprise_type, and falls back to the historical 'structural_transfer' default only when that derivation itself yields NONE (no measurable pair at all) -- the eureka_critic wire enum (SURPRISE_TYPES, now sourced from DIRECTIONS) is two-valued by design (D-04: the critic only ever sees pairs that already passed the generator's floors), so a classify() 'none' cannot be forwarded onto a closed two-member enum. Disclosed limitation, not a bug: a candidate with neither signal has nothing honest to report and this payload shape has no 'unknown' slot."
  - "Task 1's static exception sweep (leg 1a) verifies via a repo-wide regex scan (mirroring leg H's own idiom) that the ONLY remaining two-literal direction-id arrays under lib/ live in direction-convention.cjs itself, eureka-reach-runner.cjs and sensor-eureka.cjs -- the latter two are the 355-19 carve-outs (schema_version bump), left untouched since they are not in this plan's files_modified"
  - "Task 1's zod-schema leg (1f) captures the real tool-router.cjs eureka_critic schema via registerRouterTools(fakeServer, ...) (the same captured-server idiom test-232.1/test-248 already use), then calls the captured ZodEnum's own safeParse -- a behavioral proof against the actual registration code path, not a re-implementation of it"
  - "hsi-to-graph.cjs's surprise_type write reads pair.lsa_sim ?? pair.lsa and pair.semantic_sim ?? pair.semantic (the plan's own literal field-name fallback) even though the current writer (compute-hsi.py via .hsi-results.json) only ever populates lsa_sim/semantic_sim -- the ?? fallback is forward-compatible with any future producer shape, costs nothing today, and was verified against the real tests/fixtures/272/room/.hsi-results.json field names before writing it"
  - "nl-graph-queries.cjs's hsi_connections re-derivation lives in executeNLQuery's post-query JS pass, gated on intent === 'hsi_connections' only -- the other seven QUERY_TEMPLATES entries are untouched, so this is a single, scoped chokepoint rather than a blanket row-mutation pass over every query result"
  - "REVERSE_SALIENT's innovation_type suppression is expressed as SQL CASE WHEN ... THEN json_extract(...) ELSE NULL END (a column reference, not a wire-id string), so it neither needs nor risks a JS post-pass and produces zero new leg-H hits by construction"

patterns-established:
  - "Two-tier D-07 honesty: WRITE time re-derives and stores the honest label (hsi-to-graph.cjs); READ time re-derives again from the stored pair rather than trusting the stored label (nl-graph-queries.cjs) -- belt and suspenders, since a room's HSI_CONNECTION edges may have been written before this plan by the pre-355 code path and never get rewritten until the room's next HSI run"

requirements-completed: [HIPS-01]

duration: 90min
completed: 2026-09-24
---

# Phase 355 Plan 12: Readers and Duplicates (D-07) Summary

**Three duplicate direction-id enums and the eureka_critic MCP schema now alias `direction-convention.cjs`'s `DIRECTIONS` instead of carrying a second copy; `hsi-to-graph.cjs` writes `HSI_CONNECTION.surprise_type` as a fresh `classify(lsa_sim, semantic_sim)` call instead of trusting the stored string, `nl-graph-queries.cjs` re-derives it again on every read and suppresses `REVERSE_SALIENT.innovation_type` unless the edge is rs-engine-sourced, and `fabric-chat.cjs`/`generate-chat-embed.cjs`'s LLM-facing schema text now says so -- legs A through G of the cross-producer agreement test are green, with leg H's last two hits and one writer-side finding carried forward, precisely out of this plan's own `files_modified`.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-24 (sequential executor on the shared main tree)
- **Completed:** 2026-09-24
- **Tasks:** 2 completed
- **Files modified:** 1 created, 9 modified (8 code files + deferred-items.md + ROADMAP.md)

## Accomplishments

- `lib/core/eureka-critic.cjs`'s `SURPRISE_TYPES`, `lib/core/eureka/eureka-offer.cjs`'s `DIRECTION_ENUM` and `lib/core/grill-engine.cjs`'s `EUREKA_SURPRISE_TYPES` each became a bare alias of `direction-convention.cjs`'s `DIRECTIONS` (`const X = DIRECTIONS;`), so every in-file reference (`SURPRISE_TYPES.indexOf(...)`, `DIRECTION_ENUM.indexOf(...)`, `EUREKA_SURPRISE_TYPES.indexOf(...)`) keeps working unchanged
- `lib/mcp/tool-router.cjs`'s `eureka_critic` zod input schema's `surprise_type` field is `z.enum(DIRECTIONS)`; `schema_version` stays `z.number().int()`, byte-unchanged
- `eureka-critic.cjs`'s `classifyCandidate` now re-derives `surprise_type` from the candidate's own `(lsa_similarity, semantic_similarity)` pair via `classify()` when the candidate carries no explicit value, falling back to the historical default only when the pair itself is unmeasurable (a disclosed, documented limitation of the two-valued critic enum, per D-04)
- `eureka-reach-runner.cjs` and `sensor-eureka.cjs` (the two 355-19 carve-outs) are untouched, confirmed by a repo-wide static sweep to be the ONLY remaining two-literal direction-id arrays outside `direction-convention.cjs` itself
- `scripts/hsi-to-graph.cjs`'s `HSI_CONNECTION` write now computes `surprise_type: directionConvention.classify(pair.lsa_sim ?? pair.lsa, pair.semantic_sim ?? pair.semantic)`, ignoring `pair.surprise_type` entirely; a pair with a missing similarity value writes `'none'`, never a fabricated direction
- `lib/core/nl-graph-queries.cjs`: the `hsi_connections` SQL template now selects `lsa_sim`/`semantic_sim` alongside the stored `surprise_type`, and `executeNLQuery` overwrites `row.surprise_type` via `classify(row.lsa_sim, row.semantic_sim)` for that one intent, every call; the `reverse_salients` SQL template returns `innovation_type` through a `CASE WHEN json_extract(e.properties, '$.source') = 'rs-engine' THEN json_extract(e.properties, '$.innovation_type') ELSE NULL END` (no wire-id literal in the SQL)
- `lib/chat/fabric-chat.cjs`'s `GRAPH_SCHEMA.edgeTypes` descriptions for `HSI_CONNECTION` and `REVERSE_SALIENT`, and `scripts/generate-chat-embed.cjs`'s fallback schema (used only if requiring `fabric-chat.cjs` fails), both gained the Phase 355 honesty note the LLM sees when composing NL-to-SQL queries
- `tests/test-355-direction-readers.cjs` ships 29 checks across both tasks: Task 1's static exception sweep, four `require(direction-convention.cjs)` presence legs, `eureka-critic.criticRule`'s closed-enum accept/reject behavior, `eureka-offer.DIRECTION_ENUM` deep-equality, a `grill-engine.cjs` load-cleanliness smoke check, and a real captured-server `tool-router.cjs` zod `safeParse` behavioral proof; Task 2's write-time re-derivation (3 pairs including a missing-value 'none' case) via a real `hsi-to-graph.cjs` subprocess run against a `mos-355-`-prefixed scratch room, read-time re-derivation for both `nl-graph-queries` query intents, and a leg-H no-new-hits check against the four Task 2 files
- Legs A through G of `tests/test-355-direction-agreement.cjs` are all green (187 PASS / 1 FAIL); the sole remaining FAIL is leg H, with the same two unresolved hits 355-11 left (`lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`) -- confirmed out of this plan's `files_modified` scope, documented below and in `deferred-items.md`, not a regression from this plan (355-11 already left leg H at exactly these two hits)

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: Duplicate enums and the eureka_critic zod enum take DIRECTIONS (D-07)** - `3e1e7104d` (refactor)
2. **Task 2: Readers re-derive stored labels from the stored pair (D-07)** - `7dfcd0478` (fix)

**Plan metadata:**
- `d3d84b9a6` (docs: deferred-items.md -- leg H's remaining two hits and the hsi-to-graph.cjs REVERSE_SALIENT DELETE finding stay open, `git add -f` since `.planning/phases/**` is gitignored-but-force-tracked)
- `d464c2170` (docs: ROADMAP.md checkbox + Plans counter 10/28 -> 11/28, staged via `git apply --cached` against a hand-built patch to avoid sweeping a peer session's concurrent unrelated hunk near Phase 267 and the 355-11 line, exactly as the 355-10/355-11 precedent)

## Files Created/Modified

- `tests/test-355-direction-readers.cjs` - Task 1 + Task 2 legs (29 checks)
- `lib/core/eureka-critic.cjs` - `SURPRISE_TYPES` alias; `classifyCandidate`'s surprise_type re-derivation
- `lib/core/eureka/eureka-offer.cjs` - `DIRECTION_ENUM` alias
- `lib/core/grill-engine.cjs` - `EUREKA_SURPRISE_TYPES` alias
- `lib/mcp/tool-router.cjs` - `eureka_critic` schema's `surprise_type: z.enum(DIRECTIONS)`
- `scripts/hsi-to-graph.cjs` - `HSI_CONNECTION` write re-derives `surprise_type` via `classify()`
- `lib/core/nl-graph-queries.cjs` - `hsi_connections` re-derivation, `reverse_salients` source-gated suppression
- `lib/chat/fabric-chat.cjs` - schema description honesty notes
- `scripts/generate-chat-embed.cjs` - fallback schema description honesty notes
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - leg H's remaining two hits + the DELETE finding, carried forward and re-confirmed unresolved
- `.planning/ROADMAP.md` - 355-12 row checked, Plans counter 10/28 -> 11/28

## Decisions Made

See key-decisions in frontmatter: the eureka-critic.cjs disclosed-limitation fallback, the static exception-sweep proof for the two 355-19 carve-outs, the real captured-server zod-schema behavioral test, the forward-compatible `??` field-name fallback in hsi-to-graph.cjs, the single-intent scope of the JS-layer HSI re-derivation, and the SQL-only (no JS pass needed) REVERSE_SALIENT suppression.

## Deviations from Plan

### Auto-fixed Issues

None - both tasks' action steps were followed as written. No Rule 1/2/3 auto-fixes were needed.

### Documented scope corrections (no functional impact on this plan's own deliverables)

**1. [Scope correction, not a fix] Leg H is not fully closed by this plan; the shared-tree briefing's conditional resolves to "otherwise log it"**
- **Found during:** Task 2's own verification (`node tests/test-355-direction-agreement.cjs`)
- **Issue:** The orchestrator's shared-tree briefing asked to "fold those two [`lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`] in if the plan's D-07 scope covers them, otherwise state precisely why not." Re-reading `355-12-PLAN.md`'s own frontmatter (`files_modified`, both tasks' `<files>` and action text) confirms neither file is in this plan's declared surface; the plan's own must_haves truth reads "Leg H ... gains no new hits" (a no-new-regression bar), never full leg H closure.
- **Why not fixed:** Editing either file's `feeds_into` routing rule (a downstream consumer of an already-computed classification, not the comparison-to-label rule itself, but a leg H pattern hit regardless) is a real code change to a file this plan was never asked to touch (Scope Boundary rule).
- **Files modified:** none beyond the nine planned; logged to `deferred-items.md` instead, with the exact regex-triggering lines quoted for the next plan.
- **Verification:** `node tests/test-355-direction-agreement.cjs 2>&1 | grep -E "^FAIL: H "` -- exactly the same two files as 355-11 left, zero new ones (187 PASS / 1 FAIL, same FAIL count as the pre-plan baseline's leg H).
- **Committed in:** `d3d84b9a6` (deferred-items.md addition)

**2. [Scope correction, not a fix] The hsi-to-graph.cjs REVERSE_SALIENT DELETE's missing source filter (355-11's sixth finding) stays open**
- **Found during:** Re-reading `355-11`'s deferred-items.md entry per the shared-tree briefing's instruction 2
- **Issue:** `scripts/hsi-to-graph.cjs`'s cleanup (`DELETE FROM edges WHERE type = 'REVERSE_SALIENT'`, unconditional, no source filter) would delete rs-engine-sourced edges too on every hsi-to-graph pass.
- **Why not fixed:** Task 2's own action text is explicit about `hsi-to-graph.cjs`: "change nothing else (the stamp is added in 355-16)" beyond the `HSI_CONNECTION` `surprise_type` write. The DELETE line was read (per Task 2's `read_first`) but deliberately left untouched, per that literal instruction.
- **Files modified:** none; re-confirmed and re-logged in `deferred-items.md` for a later plan or the navigator.
- **Verification:** N/A (no code change); `git diff scripts/hsi-to-graph.cjs` shows only the `surprise_type` line and its require changed.
- **Committed in:** `d3d84b9a6` (deferred-items.md addition)

---

**Total deviations:** 0 auto-fixed; 2 documented scope corrections (both carried forward from 355-11's own findings, re-confirmed unresolved, no functional impact on this plan's own nine-file deliverable).
**Impact on plan:** None on this plan's own acceptance criteria -- both tasks' verify commands and acceptance_criteria lines pass exactly as specified; legs A-G of the agreement test are fully green, which is this plan's own stated gate (must_haves truth: "gains no new hits", satisfied).

## Issues Encountered

- `bash tests/run-all-355.sh` was not re-run in full this session (per the 355-09/355-10 precedent: a full run is expensive in this concurrent shared tree; every individual leg command named in the plan's own `<verify>` blocks was run directly and confirmed green instead): `node tests/test-355-direction-readers.cjs`, `node tests/test-212-critic-rubric.cjs`, `node tests/test-213-eureka-offer.cjs`, `node tests/test-212-part8-boundary.cjs`, `node scripts/check-tool-honesty.cjs --check`, `node tests/test-reverse-salient-telemetry.cjs`, `node tests/test-355-floor-sweep.cjs`, the negated leg-H grep from Task 2's own `<verify>` line, `node scripts/build-connector-registry.cjs --check`, `node scripts/check-render-coverage.cjs` -- all exit 0.
- `.planning/ROADMAP.md` on disk carried a peer session's concurrent, unrelated uncommitted hunk (a blank-line removal near Phase 267, plus what appears to be a truncation of the 355-11 row's own completed-detail text -- neither touching Phase 355's 355-12 row or its Plans counter). Resolved via the 355-10/355-11 precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus my own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, confirmed via `git diff --cached` that exactly my two hunks were staged and via `git diff` after committing that the peer's hunks remain unstaged and untouched on disk.
- `.planning/phases/355-.../deferred-items.md` is gitignored-but-already-tracked (per the 355-11 precedent, `git add` alone fails with "The following paths are ignored"); resolved with `git add -f` on that single file, confirmed via `git diff --cached --name-only` that only it was staged, then a plain `git commit` (no `--only`) on the clean single-file index.
- Verified RED-before-GREEN by inspection rather than a working-tree revert (the shared tree's destructive-git prohibition rules out `git stash`/`git checkout --`/`git reset` for a temporary revert-and-restore): `git show HEAD:<path>` on all nine touched files, before any edit, confirmed each carried the exact pre-fix shape the new test's legs are designed to catch (the four two-literal arrays with no `direction-convention.cjs` require, `hsi-to-graph.cjs` writing `pair.surprise_type` raw, `nl-graph-queries.cjs`'s `hsi_connections`/`reverse_salients` templates with neither re-derivation nor source filtering).
- `mos-355-` scratch-room cleanup verified across two consecutive runs of `tests/test-355-direction-readers.cjs`: `ls /tmp | grep -c mos-355` held constant (342 before, 342 after) and a targeted `ls /tmp | grep -c "mos-355-write\|mos-355-query"` returned 0 after the run, confirming the `finally`-block cleanup removes every scratch room this test creates, not just some.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Legs A through G of `tests/test-355-direction-agreement.cjs` are green; leg H remains red with exactly the same two hits 355-11 left (`lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`) -- outside every 355 plan's stated scope so far, carried forward for a later plan or the navigator to close.
- `scripts/hsi-to-graph.cjs`'s unconditional `DELETE FROM edges WHERE type = 'REVERSE_SALIENT'` (no source filter, would delete rs-engine-sourced edges on every pass) is still open, re-logged in `deferred-items.md`; this plan's own Task 2 action text explicitly forbade touching it ("change nothing else").
- `tests/test-355-direction-readers.cjs` is committed and available as a standing regression guard: re-running it after any future edit to the nine files this plan touched proves whether the D-07 honesty invariant (no duplicate enum, no trusted stored label) still holds.
- Blocker/concern carried forward: none blocking any other 355 plan; both documented items above are carried-forward findings from 355-11, re-confirmed rather than newly discovered, and neither is in any later-numbered 355 plan's stated file scope either as of this writing.
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..11 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-12 checked, Plans counter 11/28) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 9 code/config files plus `deferred-items.md`, `.planning/ROADMAP.md` and
this SUMMARY.md verified present on disk (`tests/test-355-direction-readers.cjs`,
`lib/core/eureka-critic.cjs`, `lib/core/eureka/eureka-offer.cjs`,
`lib/core/grill-engine.cjs`, `lib/mcp/tool-router.cjs`,
`scripts/hsi-to-graph.cjs`, `lib/core/nl-graph-queries.cjs`,
`lib/chat/fabric-chat.cjs`, `scripts/generate-chat-embed.cjs`); all four
commits (`3e1e7104d`, `7dfcd0478`, `d3d84b9a6`, `d464c2170`) verified present
in `git log`.
