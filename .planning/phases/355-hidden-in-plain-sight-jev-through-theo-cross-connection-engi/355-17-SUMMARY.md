---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 17
subsystem: reverse-salient-connections
tags: [verification-stamp, find-bottlenecks, find-connections, rs-engine, stamp-connections, d-16, d-18]

requires:
  - phase: 355-01
    provides: "lib/core/direction-convention.cjs (classify, classifyDiff, DIRECTIONS, NONE, NONE_MEANING)"
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs (Stamp, extractCarried, resolveEndpoint, stampFinding(s), toNodeProps/fromNodeProps), lib/core/verification-stamp-format.cjs (formatStampLines, assertNoScalar), tests/helpers/theo-replay-355.cjs, tests/fixtures/355/theo-stub-responses.json"
  - phase: 355-04
    provides: "lib/core/floor-disclosure.cjs (disclosureLine/disclosureFor)"
  - phase: 355-16
    provides: "the opt-in --stamp write-boundary pattern proven end-to-end on two producers (whitespace, HSI) -- this plan's rs-engine.cjs/reverse-salient-agent.cjs split follows the identical hsi-engine.cjs/hsi-to-graph.cjs precedent"
provides:
  - "lib/core/rs-engine.cjs: runModeInternal gains optional opts.stampFn, awaited before writeReverseSalientEdges opens the graph; writeReverseSalientEdges(roomDir, pairs, opts) gains opts.stampsByPairKey, a Map of already-flattened stamp props merged into the SAME REVERSE_SALIENT edge write; never requires the stamp module; byte-identical without opts.stampFn"
  - "lib/agents/reverse-salient-agent.cjs: rsEndpoints(pair, roomDir) (D-48 local resolution); runRsEngine's cjs branch builds a stampFn on verification-stamp.stampFindings and returns stampsByPairKey; detectAndSurface reuses those stamps for the surfaced finding (python backend stamps individually, no stored props), attaching stamp/stamp_lines/disclosure; composeFinding drops the bracketed signed_diff/abs_diff number from body_text; renderBottleneckFinding(finding, stamp) is the new pure render seam feeding surfaceFinding's F.0 zones.body"
  - "scripts/stamp-connections.cjs: the D-18 find-connections CLI stamp entry (--pair, --pairs-json, --json, --help; exports main, parsePairs); not an MCP tool, no direct network"
  - "commands/find-bottlenecks.md, skills/find-bottlenecks/SKILL.md, commands/find-connections.md, skills/find-connections/SKILL.md: stamp block reproduction rule, 'confidence scores' removed, D-50 Desktop/Cowork fallback sentence"
  - "tests/fixtures/355/producers/rs-pairs.json, tests/test-355-producer-rs-connections.cjs: 43 assertions across a bottlenecks section (rs-engine's opts.stampsByPairKey node-prop proof, the stampFn-before-write static order proof, the renderBottleneckFinding render seam Theo up/down) and a connections section (stamp-connections.cjs replay/null, exact-name refusal, --json re-parse)"
affects: [355-20, 355-23, 355-27]

tech-stack:
  added: []
  patterns:
    - "Compute-engine / write-and-render split, mirrored from 355-16's hsi-engine.cjs/hsi-to-graph.cjs pair: lib/core/rs-engine.cjs stays the stamp-module-free compute engine (D-08), lib/agents/reverse-salient-agent.cjs is the writer/dispatcher that builds the stampFn on verification-stamp.cjs and hands rs-engine.cjs only an opaque Map of flattened properties"
    - "Stamp-reuse across write and display: the SAME Theo answer computed once inside the cjs backend's stampFn (for the stored edge) is captured in a closure Map and reused for the surfaced F.0 finding, so a single /mos:find-bottlenecks run never asks Theo twice for the same pair; the python backend (no write-boundary hook) stamps its surfaced finding individually instead, documented as a scope difference, not a bug"
    - "Thin CLI stamp entry for a prompt-driven producer with no engine of its own (D-18): scripts/stamp-connections.cjs takes typed framework-name pairs directly from Larry's own argv, resolves them exactly (never fuzzy), and prints formatStampLines blocks plus one disclosureLine -- the same shape every other 355 producer converged on, without inventing a second engine or a new MCP tool (Phase 268 ruling upheld)"

key-files:
  created:
    - scripts/stamp-connections.cjs
    - tests/fixtures/355/producers/rs-pairs.json
    - tests/test-355-producer-rs-connections.cjs
  modified:
    - lib/core/rs-engine.cjs
    - lib/agents/reverse-salient-agent.cjs
    - commands/find-bottlenecks.md
    - skills/find-bottlenecks/SKILL.md
    - commands/find-connections.md
    - skills/find-connections/SKILL.md

key-decisions:
  - "The 'first topk pairs' stamped at the write boundary and the pairs shown via F.0 are the SAME set by construction: rs-engine.cjs's own topk option already bounds pairDicts before opts.stampFn ever runs, so no separate 'top-N of the shown set' selection was needed the way hsi-to-graph.cjs needed one (HSI's on-disk pair count is independent of what gets shown; rs-engine's is not)"
  - "runRsEngine's cjs branch captures the full Stamp objects (not just the flattened node-props handed to rs-engine.cjs) in a closure Map, returned as stampsByPairKey on the runRsEngine result; detectAndSurface looks up by pairKey first and only falls back to a fresh stampFinding call when the key is absent (the python backend's own path, or a defensive miss) -- this is the mechanism that avoids a second Theo call per pair on the cjs backend without rs-engine.cjs ever seeing a Stamp object itself"
  - "scripts/stamp-connections.cjs resolves each side via verification-stamp.resolveEndpoint({framework: name}) rather than a bespoke Set.has() check, so an unresolved side gets the SAME via:null / not_called/handle_unresolved shape every other producer's resolution miss produces, and a case-variant name (D-18's own exact-match requirement) never silently coerces"
  - "direction is hardcoded to directionConvention.NONE for every stamp-connections.cjs finding (D-49): find-connections has no (lsa, semantic) pair to compare, so there is no signal to derive a direction from, unlike find-bottlenecks whose pair.direction comes straight from rs-math's own classification"
  - "commands/find-connections.md and skills/find-connections/SKILL.md gained Bash in allowed-tools (scoped by instruction text to stamp-connections.cjs only, per the plan's own D-17 'no new reach id' constraint) while hitl_shape (F.8) stayed untouched, matching the plan's literal instruction"

patterns-established: []

requirements-completed: []

duration: ~160min
completed: 2026-09-24
---

# Phase 355 Plan 17: find-bottlenecks and find-connections Verification Stamps Summary

**`lib/core/rs-engine.cjs`'s `writeReverseSalientEdges` now stores a caller-supplied verification stamp on the SAME `REVERSE_SALIENT` edge write via an opt-in `opts.stampFn` hook (never requiring the stamp module itself); `lib/agents/reverse-salient-agent.cjs` builds that hook on `lib/core/verification-stamp.cjs`, reuses the computed stamp for the surfaced F.0 finding, and a new `renderBottleneckFinding` seam puts the stamp block (not a raw `signed_diff`/`abs_diff` bracket) in the F.0 body; `scripts/stamp-connections.cjs` ships the thin D-18 CLI entry find-connections needed to verify a framework bridge on demand.**

## Performance

- **Duration:** ~160 min (single continuous session, sequential executor on the shared main tree)
- **Tasks:** 2 completed
- **Files modified:** 3 created, 6 modified

## Accomplishments

- `lib/core/rs-engine.cjs`: `runModeInternal` gains an optional `opts.stampFn`, awaited (with the computed `pairDicts`) strictly before `writeReverseSalientEdges` opens the graph (confirmed via a static source-order check: `await options.stampFn` textually precedes the `writeReverseSalientEdges(resolvedRoomDir` call); `writeReverseSalientEdges(roomDir, pairs, opts)` gains an optional `opts.stampsByPairKey` (a Map keyed `source_artifact_id + '\u0000' + target_artifact_id`) merged into the SAME `properties` object the existing `upsertEdge` call already writes -- no second writer, no raw SQL; a repo-wide non-comment grep for `verification-stamp` against this file returns 0, and `writeReverseSalientEdges` called with no third argument is byte-identical to its pre-355 shape (proved by a dedicated no-op test leg)
- `lib/agents/reverse-salient-agent.cjs`: new `rsEndpoints(pair, roomDir)` reads each side's carried name locally (frontmatter `framework:`/`methodology:`, else the pair's own title, D-48), gracefully degrading to title-only resolution when no artifact file backs the pair; `runRsEngine`'s `cjs` branch builds a `stampFn` closure on `verification-stamp.stampFindings`, hands `rs-engine.cjs` a Map of `toNodeProps(stamp)` values, and separately captures the full `Stamp` objects for reuse; `detectAndSurface` attaches `stamp`/`stamp_lines`/`disclosure` to every surfaced finding, reusing the cjs backend's already-computed stamp when the pair key matches (zero extra Theo calls for the shown finding) and falling back to an individual `stampFinding` call for the `python` backend (documented: no stored edge props on that path, D-16's scope is the cjs write boundary only); `composeFinding`'s `body_text` no longer carries the bracketed `[signed_diff=..., abs_diff=...]` differential; the new pure `renderBottleneckFinding(finding, stamp)` seam (body text, framework chain, `formatStampLines('cli')`, `disclosureLine('find-bottlenecks')`, swept through `assertNoScalar`) now composes `surfaceFinding`'s F.0 `zones.body` evidence
- `scripts/stamp-connections.cjs`: the D-18 thin CLI entry (`--pair "<A>|<B>"` repeatable, `--pairs-json <path>`, `--json`, `--help`; exports `main(argv, deps)`, `parsePairs(argv)`); each side resolved exactly via `verification-stamp.resolveEndpoint({framework: name})` (a case-variant or unknown name stamps `unverified`/`not_called`/`handle_unresolved` with zero Theo calls and still prints under its original typed name); `direction` is always `directionConvention.NONE` (D-49, no similarity pair to compare here); prints `"<A> and <B>"` then `formatStampLines(stamp, 'cli')` per pair, ending in one `disclosureLine('find-connections')`; a repo-wide non-comment grep confirms zero `fetch(`/`https?://`/`registerTool`/`server.tool(` tokens (not an MCP tool, Phase 268 ruling upheld)
- `commands/find-bottlenecks.md`, `skills/find-bottlenecks/SKILL.md`: a new "Verification stamp" subsection tells Larry to reproduce the F.0 body's stamp block verbatim, never restate a number, and say exactly `"Not yet checked; run the CLI to verify."` on Desktop/Cowork when a finding's stamp was never computed
- `commands/find-connections.md`, `skills/find-connections/SKILL.md`: `Bash` added to `allowed-tools` (scoped to `stamp-connections.cjs`); `"and confidence scores"` removed from the `brain_concept_connect` description; a new "3a. Verify each surfaced bridge" step instructs running `stamp-connections.cjs --pair "<A>|<B>"` per surfaced pair and pasting its lines verbatim, with the same D-50 Desktop/Cowork fallback sentence; `hitl_shape` (F.8) left untouched per the plan's literal instruction
- `tests/fixtures/355/producers/rs-pairs.json`: 6 recorded `rs-engine.cjs` pairDicts (4 resolve to canon Framework names with a matching `theo-stub-responses.json` entry -- one strong 1-hop, one indirect 3-hop, two more strong 2-hop -- and 2 do not resolve, one on each side and one on neither)
- `tests/test-355-producer-rs-connections.cjs`: 43/43 assertions -- a `bottlenecks` section (the `stampsByPairKey` node-prop merge/no-op/empty-Map legs against `writeReverseSalientEdges` directly, the static stampFn-before-write source-order proof, the `renderBottleneckFinding` render seam Theo up (replay) and Theo down (null), a `finding.stamp`-attached-without-explicit-arg leg) and a `connections` section (`parsePairs` unit legs, `stamp-connections.cjs main()` Theo up/down, the case-variant exact-name refusal with a Theo-call count proof, `--json` output re-parsing through `Stamp.safeParse`, a no-pairs and a `--help` leg, the not-an-MCP-tool grep)

## Task Commits

Each task was committed atomically (normal `git commit`, sequential executor on the main working tree):

1. **Task 1: find-bottlenecks - rs-engine write-boundary stampFn, agent wiring, F.0 body, docs** - `ec92de29f` (feat)
2. **Task 2: find-connections - scripts/stamp-connections.cjs and the docs (D-18, D-50)** - `ec28ad693` (feat)

**Plan metadata:**
- `8255ae957` (docs: ROADMAP checkbox + Plans counter 13/28 -> 14/28, staged via `git apply --cached` against a hand-built patch to avoid sweeping a peer session's concurrent unrelated blank-line hunk near Phase 267, exactly as the 355-10/355-11/355-12/355-16 precedent)

## Files Created/Modified

- `lib/core/rs-engine.cjs` - `runModeInternal`'s `opts.stampFn`, `writeReverseSalientEdges`'s `opts.stampsByPairKey`
- `lib/agents/reverse-salient-agent.cjs` - `rsEndpoints`, `renderBottleneckFinding`, `runRsEngine`/`detectAndSurface`/`surfaceFinding`/`composeFinding` wiring
- `scripts/stamp-connections.cjs` - the D-18 CLI stamp entry (`main`, `parsePairs`)
- `commands/find-bottlenecks.md`, `skills/find-bottlenecks/SKILL.md` - stamp reproduction rule, D-50 fallback
- `commands/find-connections.md`, `skills/find-connections/SKILL.md` - `Bash` in allowed-tools, "confidence scores" removed, CLI stamp step, D-50 fallback
- `tests/fixtures/355/producers/rs-pairs.json` - 6 recorded rs-engine pairDicts
- `tests/test-355-producer-rs-connections.cjs` - 43 assertions, bottlenecks + connections sections

## Decisions Made

See key-decisions in frontmatter: the "shown set equals the write-boundary set" simplification versus HSI's own top-N selection, the closure-Map stamp-reuse mechanism between the write path and the surfaced finding, `stamp-connections.cjs`'s reuse of `resolveEndpoint` over a bespoke lookup, the hardcoded `NONE` direction for find-connections, and the `Bash`-only `allowed-tools` addition with `hitl_shape` left untouched.

## Deviations from Plan

### Auto-fixed Issues

None - the plan's own action steps were followed for both tasks. No Rule 1/2/3 auto-fixes were needed on the plan's literal text.

### Scope-boundary items (documented, not auto-fixed)

**1. [Scope Boundary] Leg H of `tests/test-355-direction-agreement.cjs` remains open, unrelated to this plan**
- **Found during:** Pre-execution review of `deferred-items.md`
- **Issue:** Leg H's two remaining hits (`lib/core/rs-chain-feeder.cjs`, `lib/memory/test-rs-discovery-engine.cjs`) are carried forward from 355-11/355-12; neither file is in this plan's `files_modified`.
- **Why not fixed:** Out of this plan's declared scope (find-bottlenecks/find-connections stamping only); re-confirmed via `node tests/test-355-direction-agreement.cjs 2>&1 | grep -E "^FAIL: H "` still showing exactly the same two files, zero new hits.
- **Files modified:** none; not re-logged (already recorded by 355-11/355-12, nothing new to add)
- **Verification:** grep above; `tests/run-all-355.sh` still reports the same pre-existing FAIL set (agreement leg H, `run-all-272` transformers gap, `part8-egress-guard` PB8-03) plus zero new failures

---

**Total deviations:** 0 auto-fixed; 1 documented scope re-confirmation (a carried-forward finding from 355-11/355-12, not newly discovered, no functional impact on this plan's own deliverables).
**Impact on plan:** None on any stated acceptance criterion -- both tasks' automated verify commands and acceptance_criteria greps pass exactly as specified; the producer test is 43/43 green; `bash tests/run-all-355.sh` reports `PASS=42 FAIL=3 SKIP=3` (up from 355-16's `PASS=39 FAIL=3 SKIP=5`: the new producer test file plus `scripts/stamp-connections.cjs`'s Part 8/Part 9 sweep legs moving from SKIPPED to PASSED account for the delta; the 3 FAILs are the same pre-existing, documented failures every 355 plan since 355-01 has carried).

## Issues Encountered

- `.planning/ROADMAP.md` on disk carried the same peer-session concurrent unrelated hunk flagged in the shared-tree briefing (a blank-line removal near Phase 267). Resolved via the 355-10/355-11/355-12/355-16 precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus my own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, confirmed via `git diff --cached` that exactly my two hunks were staged, committed the index directly (no `--only`, no `-a`), then hand-applied the identical two edits to the on-disk working-tree file via `Edit` so it matches the new `HEAD` for my rows while leaving the peer's hunk untouched and still unstaged.
- `node scripts/check-shape-declaration.cjs --check` and `node lib/core/command-registration-check.cjs` both print the same pre-existing advisory WARN sets every prior 355 plan has seen (53 shape-declaration violations, 40 long-description warnings), none naming a file this plan touched; both exit 0, non-blocking per CLAUDE.md's own description of these gates.
- `bash tests/run-all-355.sh` full run: `PASS=42 FAIL=3 SKIP=3`, `doctor --acceptance (no-new-regression vs BASE_355 baseline)` PASSED (the sole failing point, `verify-release-clean-tree`, matches the documented BASE_355 baseline).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/core/rs-engine.cjs`'s `opts.stampFn`/`opts.stampsByPairKey` pattern and `lib/agents/reverse-salient-agent.cjs`'s stamp-reuse-across-write-and-display mechanism are a reusable precedent for any future producer whose compute engine and display surface are two separate modules with an existing writer in between.
- `scripts/stamp-connections.cjs` is a standalone, dependency-free CLI entry point (`main`, `parsePairs` exported) any future find-connections-adjacent surface can reuse or extend (e.g. a `--pairs-json` batch mode already exists for a future scripted verification pass).
- 355-18 (eureka renders carry the stamp line, Score/lsa columns dropped) can follow this exact same pattern for its own producer.
- 355-20/355-23 (filing, side-channel wiring) have both `find-bottlenecks` and `find-connections` findings now carrying a `stamp`/`stamp_lines`/`disclosure` shape ready to file.
- Blocker/concern carried forward: none blocking any other 355 plan. Leg H's two remaining hits (outside every 355 plan's scope so far) remain open for a later plan or the navigator to close. HIPS-04/HIPS-05 remain unregistered in `.planning/REQUIREMENTS.md` by design (355-27 registers and closes the whole HIPS family at phase close-out, per the 355-06 precedent).
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..16 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-17 checked, Plans counter 14/28) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 3 created files and 6 modified files verified present on disk
(`scripts/stamp-connections.cjs`, `tests/fixtures/355/producers/rs-pairs.json`,
`tests/test-355-producer-rs-connections.cjs`, `lib/core/rs-engine.cjs`,
`lib/agents/reverse-salient-agent.cjs`, `commands/find-bottlenecks.md`,
`skills/find-bottlenecks/SKILL.md`, `commands/find-connections.md`,
`skills/find-connections/SKILL.md`); all three commits (`8255ae957`,
`ec92de29f`, `ec28ad693`) verified present in `git log`; the producer test
re-run clean at commit time (`PASS: 43 FAIL: 0`).
