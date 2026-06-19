---
kind: context
phase: 169
slug: graph-derivation-harness
milestone: v1.14.0
created: 2026-06-19
canon_parts: [3, 4, 6, 8, 9]
spec_loaded: true
status: context-captured
severity: CRITICAL
sequence: "before 164 (order ...167 -> 168 -> 169 -> 164 -> 165), navigator-LOCKED 2026-06-18"
---

# Phase 169 Context: Graph Derivation Harness

<domain>
Make the typed-edge moat self-wiring across rooms AND sub-rooms. Requirements LOCKED in 169-SPEC.md
(GDH-01..07); root causes in SEED-034. This CONTEXT locks the HOW.
</domain>

<spec_lock>
Requirements LOCKED by 169-SPEC.md (GDH-01 one resolver, GDH-02 derivation-in-loop, GDH-03 sub-room
rollup, GDH-04 non-.md reach, GDH-05 typed-edge derivation, GDH-06 backfill, GDH-07 idempotent). Read
169-SPEC.md + SEED-034 before planning.
</spec_lock>

<decisions>

### D-169-01: trigger = debounced Stop/SessionEnd sweep + explicit backfill (navigator-LOCKED)
The derivation pass fires as a DEBOUNCED sweep at Stop/SessionEnd (NOT per-keystroke) plus an explicit
`/mos:graph --derive` backfill command. Avoids per-write token cost + gate-fatigue (the Ralph
debounced lesson). Per-write-debounced derivation is DEFERRED to a follow-on. The structural index
(indexArtifact) may still run per-write; the expensive TYPED derivation is the swept/backfilled part.

### D-169-02: per-sub-room db keyed by .room-root + parent rollup (navigator-LOCKED)
Each room (incl. sub-rooms) owns its `.mindrian/room.db` keyed by its own `.room-root`; the parent
gets a ROLLUP view aggregating sub-room graphs (read-side aggregation, not a merged db). Matches the
shipped per-room room.db + `.room-root` model; preserves Part 8 room-boundary isolation; the parent
still sees everything via the rollup.

### D-169-03: non-destructive .docx/.html reader/extractor (navigator-LOCKED)
Add a `.docx`/`.html` TEXT EXTRACTOR the indexer + derivation read from; the SOURCE FILE IS UNTOUCHED
(never mutate the navigator's authored .docx -- the dense B2 dossiers stay as-is). The extractor feeds
text for indexing + edge derivation; no sidecar .md is generated. Pure-JS extraction (no new heavy
deps where avoidable; check CLAUDE.md stack -- a lightweight .docx text reader or unzip+XML parse).

### D-169-04: reuse the existing derivers, wired into runChain (navigator-LOCKED)
Wire the SHIPPED derivers into the runChain loop rather than writing a new one: Phase 90
`scripts/brain-derive-command.cjs` (BRAIN.md), `lib/core/findings-wirer.cjs`,
`lib/core/proactive-intelligence.cjs`, `scripts/cross-room-detect.cjs`. They already know the
cascade-edge semantics. Part 7 reuse; do not fork derivation logic.

### D-169-05: GDH-01 resolver unify + canon guards (carried, LOCKED)
- GDH-01: the auto-graph hook (`gsd-artifact-graph-hook.cjs:77-95`) resolves by the file's `.room-root`
  (walk up to the nearest sentinel), NOT the registry active room. Unify with the rebuild tool's
  `.room-root` resolution -- ONE resolver. A sub-room write indexes into the sub-room's db regardless
  of the active room.
- Part 9: all writes via `navigation.cjs`; derived edges land `review_status: proposed`; human confirms
  at a Decision Gate (Part 3); "why-not" captured (Part 4). Part 8: LOCAL only, Brain generic read-only,
  zero egress, boundary scan over any Brain-touching deriver. Edges only from the frozen set (complete
  after 168). fable-mode (167) self-critiques each derived edge before it lands. Idempotent re-run
  (GDH-07): proposed edges not re-proposed, confirmed untouched. NO em-dashes.
### D-169-06: the candidate-edge PRODUCER is an LLM derivation step in runChain (navigator-LOCKED 2026-06-19, plan-check revision)
The plan-checker (REVISE verdict, 2026-06-19) found the shipped derivers only WRITE pre-structured
findings; none GENERATE candidate edges from raw artifact text, so the b2 fixture (flat-root Hebrew
.docx, no wikilinks) would never reach 0 -> N -- a fuel-less engine. RESOLUTION (navigator-LOCKED):
the runChain `onStep` dispatches an LLM DERIVATION agent that reads artifact-pair text (incl. the
extracted .docx/.html via D-169-03) and PROPOSES candidate `{source, target, edge_type, reason}` tuples
drawn ONLY from the frozen ALLOWED_EDGE_TYPES set; fable-mode (167 `selfCritiqueFn`) critiques each so a
bad CONTRADICTS does not land; survivors are written as a PROPOSED truth-claim NODE + typed edge via
`findings-wirer` through the `navigation.cjs` chokepoint (so D-169-04 "findings-wirer writes" STILL
holds -- the LLM step is the producer, findings-wirer is the writer; the deriver is wired INTO runChain,
not forked). Net-new: the derivation agent prompt + a candidate->finding adapter. This makes the SPEC's
"fable-mode-critiqued so a bad CONTRADICTS does not land" language operative (a deterministic scan would
not need critique). The producer MUST cover BOTH edge families the SPEC Acceptance names (CONTRADICTS
AND CONVERGES across the value-chain + canon artifacts), not CONTRADICTS-only. Part 8: the derivation
agent reads LOCAL artifact text and writes LOCAL edges only; it does NOT call the Brain (brain-derive
stays the one Brain-touching deriver, boundary-scanned in Verify).

### D-169-07: rebuild must reach ROOT-LEVEL (flat) artifacts, not only canonical section folders (navigator-LOCKED 2026-06-19, plan-check revision)
The plan-checker found `rebuildGraph` walks `discoverSections(roomDir).all` (KNOWN section subfolders)
only; the b2 sub-room holds its 39 artifacts in the room ROOT (flat), so none are even re-indexed.
RESOLUTION: `rebuildGraph` (and the sweep) gains a ROOT-FILES pass alongside the section walk -- a
(sub-)room's root-level .md/.docx/.html artifacts are discovered + indexed too. General fix (handles any
flat room), NOT a fixture-prep hack. Without it GDH-03/04 reach the .docx extension but never the b2
files.

### D-169-08: the b2 acceptance proof must run against the REAL fixture; synthetic is CI-determinism only (navigator-LOCKED 2026-06-19, plan-check revision)
The synthetic two-artifact fallback may keep CI deterministic, but it must NOT be the SOLE evidence for
GDH-06. The Verify verdict (169-06) runs the 0 -> N check against the REAL b2 path
(`~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/b2-journey`) as a non-skippable
check WHEN the fixture is present (the dogfood/maintainer box), recording the actual N + the edge types
in the SUMMARY; a manual-verify gate in VALIDATION.md asserts "real b2 fixture, count before/after
captured" before /gsd-verify-work closes the phase. The legacy raw-SQL cascade writer in
`_indexArtifactBody` (which writes CONTRADICTS/INFORMS/ENABLES via raw INSERT, bypassing the chokepoint
and auto-confirming) MUST be reconciled in Plan 04 (disable it so derivation is the sole cascade writer,
OR document why structural-index edges coexisting with proposed derivation edges is non-conflicting under
the PRIMARY KEY); the GDH-02 sweep drain MUST name its trigger (SessionStart drain, mirroring the
brain-derivation-drain precedent), not enqueue-and-never-drain.

</decisions>

<canonical_refs>
- 169-SPEC.md (LOCKED requirements) + SEED-034 (verified four-cause diagnosis + acceptance fixture).
- `scripts/gsd-artifact-graph-hook.cjs:77-95` (the resolver to fix, GDH-01).
- `lib/core/lazygraph-ops.cjs` (indexArtifact :420, rebuild :457 walks sections-only, .md-only :488 -- extend for sub-rooms + non-.md).
- `lib/core/navigation.cjs` writeEdge chokepoint (Part 9) + `lib/core/navigation/edges.cjs` (frozen set, complete post-168).
- `lib/core/chain-executor.cjs` runChain + the fable-mode selfCritiqueFn seam (the derivation loop).
- the shipped derivers: `scripts/brain-derive-command.cjs`, `lib/core/findings-wirer.cjs`, `lib/core/proactive-intelligence.cjs`, `scripts/cross-room-detect.cjs`.
- `commands/reanalyze.md` + `commands/graph.md` (the backfill entry, GDH-06).
- the vault reformatter (`scripts/vault-content-reformatter.cjs`) -- reference for .docx handling (but D-169-03 chose a non-destructive reader, not conversion).
- acceptance fixture: `~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/b2-journey`.
</canonical_refs>

<code_context>
NET-NEW (minority): the `.room-root` resolver unify; the sub-room rollup walk; the .docx/.html extractor;
the runChain derivation-composition that wires the existing derivers + writes proposed typed edges; the
/mos:graph --derive backfill; the Stop/SessionEnd debounced sweep trigger. REUSE (majority): indexArtifact
+ rebuild, navigation.cjs writeEdge, the four shipped derivers, runChain + fable-mode, reanalyze/graph
commands, the confirm-node promotion path.
</code_context>

<deferred>
- Per-write debounced derivation (cost; sweep+backfill ships first).
- Cross-room typed edges (Part-8-gated, Phase 83).
- The lazygraph two-vocabulary unification (SEED-034 note).
- Sidecar-.md conversion for .docx (rejected in favor of the non-destructive reader, D-169-03).
</deferred>

<open_for_planner>
- The .docx extractor: a tiny pure-JS unzip+document.xml text pull vs a vetted lightweight dep (check CLAUDE.md no-new-deps posture; prefer built-ins).
- The parent rollup shape: a read-side UNION view vs a materialized rollup table.
- Whether the Stop/SessionEnd sweep is a new hook or extends the existing graph hook.
</open_for_planner>
