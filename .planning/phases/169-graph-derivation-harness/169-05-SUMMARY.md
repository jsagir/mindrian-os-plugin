---
phase: 169-graph-derivation-harness
plan: "05"
subsystem: graph-derivation-harness
tags: [graph-derivation, backfill, heal-first, gdh-02, gdh-06, gdh-07, gdh-08, gdh-09, stop-sweep, sessionstart-drain, idempotence, part-3, part-8, part-9, three-surface]
requires:
  - phase: 169-00
    provides: "NESTED_WITHIN minted into the frozen ALLOWED_EDGE_TYPES (the lineage edge the heal writes + the rollup walks)"
  - phase: 169-01
    provides: "the shared IFACE block + the RED stubs (test-derive-backfill-acceptance / test-derive-idempotence / test-graph-derive-sweep) + run-all-169.sh"
  - phase: 169-02
    provides: "lib/core/room-root.cjs resolveRoomRoot (the room resolver consumed by STEP 1)"
  - phase: 169-04
    provides: "lib/core/graph-derivation.cjs runDerivation + rollupSubRooms + the ROOT-FILES/sub-room-recursive rebuildGraph"
  - phase: 169-07
    provides: "lib/core/graph-self-heal.cjs detectUnsentineledArtifactFolder + healRoom (the STEP 0 heal)"
provides:
  - "lib/core/graph-backfill.cjs runDeriveBackfill -- the HEAL-FIRST /mos:graph --derive backfill: STEP 0 detect + Decision-Gate-confirm + healRoom, then resolve (resolveRoomRoot), rebuild TRANSITIVE (ROOT-FILES + sub-room recursive), runDerivation per room+sub-room, report typed-edge 0 -> N; discovers already-healed child rooms on a re-run (GDH-07 idempotent); LOCAL cue deriveFn fallback (zero Brain, deterministic CI)"
  - "scripts/gsd-graph-derive-sweep.cjs -- the NEW Stop sweep hook that ENQUEUES a derive request (cheap, exit-0-always, room resolved by .room-root walk-up, never per-keystroke)"
  - "scripts/gsd-graph-derive-drain.cjs -- the NEW SessionStart DRAIN hook (mirrors brain-derivation-drain.cjs): reads the queue, runs runDerivation per room, clears the entry"
  - "graph-derivation.cjs runDerivation idempotence guard (GDH-07): pre-propose probe of stable node id + review_status; minted=false on a re-run; never downgrade a confirmed node"
  - "hooks/hooks.json registration of the Stop sweep + the SessionStart drain (per-write structural hook unchanged, Pattern 3)"
  - "commands/graph.md --derive branch documenting the heal-first backfill"
affects:
  - "Plan 06 (brain-derive boundary scan): boundary-scans graph-backfill.cjs + the sweep/drain (all PASS the 169 Part-8 sweep already)"
tech-stack:
  added: []
  patterns:
    - "HEAL-FIRST backfill (D-169-09): STEP 0 self-heal BEFORE resolve/rebuild/derive so a sentinel-less folder becomes a real child room first"
    - "enqueue-then-drain debounce (D-169-01/08): the Stop handler ONLY enqueues a tiny JSON queue file (within the timeout); the expensive runDerivation runs on the SessionStart drain (the named drain trigger, mirroring brain-derivation-drain.cjs)"
    - "pre-propose idempotence guard (GDH-07 / Pitfall 3): probe stable node id + review_status before write; minted=false when already proposed/confirmed; never downgrade a confirmed node"
    - "LOCAL cue deriveFn: a deterministic Part-8-legal keyword-scan producer (zero Brain, zero LLM) so the backfill is functional + CI-deterministic with no credentials, while the command path may inject the anthropic-transport LLM producer"
    - "already-healed child discovery: a re-run finds child rooms by their .room-root sentinel so the idempotent re-run targets the healed child where the edges live"
key-files:
  created:
    - lib/core/graph-backfill.cjs
    - scripts/gsd-graph-derive-sweep.cjs
    - scripts/gsd-graph-derive-drain.cjs
    - tests/test-graph-derive-sweep.cjs
  modified:
    - lib/core/graph-derivation.cjs
    - commands/graph.md
    - hooks/hooks.json
    - tests/run-all-169.sh
key-decisions:
  - "the backfill returns SYNCHRONOUSLY (the acceptance test calls it sync + reads the result object): the rebuild is fire-and-forget (it indexes nodes), the LOCAL cue deriveFn writes the cascade edges directly so the result does not depend on an awaited rebuild"
  - "the LOCAL cue deriveFn is the DEFAULT producer for the backfill so CI is deterministic with zero credentials; the /mos:graph --derive command path may inject graph-candidate-producer.produceCandidates (the LLM producer) -- both are Part-8-legal (LOCAL text in, never the Brain)"
  - "the SessionStart drain (not UserPromptSubmit) is the named drain trigger per D-169-01/08; the Stop sweep enqueues so the expensive pass never blocks session end"
  - "the idempotence guard probes the DB pre-state truthfully (preProposed/preConfirmed) so minted reflects whether THIS run introduced the node, making the GDH-07 no-op verifiable"
metrics:
  duration_min: 18
  completed: 2026-06-19
  tasks: 2
  files: 8
  commits: 2
---

# Phase 169 Plan 05: HEAL-FIRST Backfill + the Two Triggers + Idempotence Summary

Landed the two GDH-02 triggers (a debounced Stop sweep that enqueues + a named SessionStart drain that runs) and the HEAL-FIRST `/mos:graph --derive` backfill (STEP 0 self-heal + Decision-Gate-confirm + healRoom, THEN resolve/rebuild/derive per room and sub-room, reporting the typed-edge 0 -> N), and closed GDH-07 idempotence with a pre-propose guard -- turning test-derive-backfill-acceptance.cjs + test-derive-idempotence.cjs + test-graph-derive-sweep.cjs GREEN with zero Brain egress and zero new deps.

## What Was Built

- **The HEAL-FIRST backfill (`lib/core/graph-backfill.cjs`, `runDeriveBackfill`).** The universal net for an existing room and its sub-rooms in one pass, working on the hook-less surfaces (Desktop/Cowork). The ordered sequence is the load-bearing part (D-169-09):
  - STEP 0 (FIRST): `detectUnsentineledArtifactFolder(roomDir)`; for each sentinel-less artifact folder, surface at the Part 3 Decision Gate and on APPROVE (approvedBy threaded) call `healRoom` so it becomes a full-citizen child room (birthRoom + NESTED_WITHIN lineage edge + registry/sentinel parent + `## Timeline (auto)`) BEFORE the resolver can roll its artifacts into the parent. Without this the real b2-journey 0 -> N is unreachable.
  - STEP 1: resolve by `resolveRoomRoot`.
  - STEP 2: rebuild TRANSITIVELY (ROOT-FILES-aware + non-.md-aware + sub-room recursive, the Plan 04 rebuildGraph) -- fire-and-forget node indexing.
  - STEP 3: `runDerivation` once per room AND per healed/citizen sub-room; edges land PROPOSED (never auto-confirmed, Part 3/9).
  - STEP 4: report `typedEdgesBefore -> typedEdgesAfter`.
  - A re-run discovers already-healed child rooms by their `.room-root` sentinel (so the idempotent re-run targets the healed child where the edges live), and STEP 0 detects nothing (the heal no-ops).
- **The Stop sweep hook (`scripts/gsd-graph-derive-sweep.cjs`).** The cheap half of the enqueue-then-drain debounce (D-169-01). On Stop it ENQUEUES a derive request for the resolved room (`.room-root` walk-up, so a sub-room Stop enqueues the sub-room) into a tiny JSON queue file under the room's `.mindrian/` and exits 0 always. It NEVER runs the expensive typed derivation inline (T-169-11); the enqueue is deduped by resolved roomDir.
- **The SessionStart drain hook (`scripts/gsd-graph-derive-drain.cjs`).** The named drain trigger (MEDIUM-5 / T-169-19), structured exactly like the SHIPPED `scripts/brain-derivation-drain.cjs`: on SessionStart it READS the queue (written by the sweep), runs `runDerivation` once per queued room (injectable `deriveRunner` for the round-trip spy), and CLEARS the drained entry. Silent-fail, exit-0-always.
- **The idempotence guard (`lib/core/graph-derivation.cjs runDerivation`).** Before proposing a node, the loop probes the stable node id's `review_status` in the db; when it is already `proposed` OR `confirmed`, `minted` is recorded `false` (the no-op contract) and a `confirmed` node is never downgraded (writeClaimNode's ON CONFLICT already EXCLUDES review_status; the guard records the pre-state truthfully so GDH-07 is verifiable).
- **The hook registration (`hooks/hooks.json`).** The Stop sweep is registered on the Stop event and the SessionStart drain on the SessionStart event (alongside the existing SessionStart cascade); the per-write structural index hook (`gsd-artifact-graph-hook.cjs`) is UNCHANGED (Pattern 3 two-trigger split). hooks.json stays valid JSON.
- **The command surface (`commands/graph.md`).** A `--derive` branch documenting the HEAL-FIRST sequence (STEP 0 self-heal at the Decision Gate, then resolve/rebuild/derive, then 0 -> N), the universal-net + three-surface posture, the GDH-07 idempotence, and the Part 8 zero-Brain boundary.
- **The round-trip test (`tests/test-graph-derive-sweep.cjs`).** Proves the FULL enqueue-then-drain round-trip (not merely that the hook loads): enqueue via the sweep, drain with an injected spy runDerivation, assert the drain READ the entry, CALLED runDerivation for the enqueued room, and CLEARED the queue; plus enqueue-dedupe and empty-queue no-op.

## The Idempotence + Heal-First Holds

- GDH-07: the backfill re-run is a no-op (STEP 0 detects no unsentineled folder; the NESTED_WITHIN ON CONFLICT no-ops; the pre-propose guard mints no duplicate). The idempotence test asserts a second runDerivation mints no duplicate proposed node and leaves a confirmed node untouched.
- D-169-09 heal-first: STEP 0 runs the heal BEFORE resolve/rebuild/derive; the acceptance test asserts the sentinel-less folder gains its own `.room-root` and is healed FIRST, THEN the typed-edge count goes 0 -> N.

## Verification

- `node tests/test-derive-backfill-acceptance.cjs` GREEN (3/3): heal-first then 0 -> N, synthetic fallback + real-b2 skip-if-absent.
- `node tests/test-derive-idempotence.cjs` GREEN (3/3).
- `node tests/test-graph-derive-sweep.cjs` GREEN (4/4): the enqueue-then-drain round-trip.
- `grep -- "--derive" commands/graph.md` and `grep -E "detectUnsentineledArtifactFolder|healRoom|self-heal" commands/graph.md` both match.
- `grep gsd-graph-derive-sweep hooks/hooks.json` + `grep gsd-graph-derive-drain hooks/hooks.json` both match; `node -e "JSON.parse(...hooks.json...)"` valid.
- `bash tests/run-all-169.sh`: Total 18, Passed 17, Failed 1. The single FAILED is `test-169-brain-boundary.cjs` -- the carried Plan-06 brain-boundary stub, RED-by-design because of the anthropic-transport raw `fetch(` in `graph-candidate-producer.cjs` (Plan 04), which Plan 06's boundary scan reconciliation handles. NOT a regression: the new graph-backfill.cjs + sweep + drain PASS the 169 Part-8 grep sweep (no Brain-WRITE token, no Brain-host egress).
- Both Phase-168/169-00 floor tests still GREEN (frozen prior vocabulary untouched). No package.json / package-lock.json change (no new deps). Em-dash sweep over all Task-1 + Task-2 surfaces: zero literal em-dashes.

## Deviations from Plan

None - plan executed exactly as written. Two `type="auto"` tasks; no auto-fixes, authentication gates, or architectural escalations. The idempotence test already passed at the stable-id DB layer before the guard was added (writeClaimNode already UPSERTs and never downgrades review_status); the plan's explicit pre-propose guard was added anyway to make the no-op verifiable via truthful `minted`/`preConfirmed` flags (GDH-07 hardening, in the spirit of the contract's "pre-propose check that no-ops when already proposed/confirmed").

## Authentication Gates

None.

## Known Stubs

- `tests/test-169-brain-boundary.cjs` remains RED by design (the Plan-06 brain-boundary scan stub). The rules for this plan explicitly require it to stay RED-untouched; it is the only failing leg of run-all-169.sh and Plan 06 reconciles it. This is NOT a stub that prevents this plan's goal -- the plan's deliverables (the heal-first backfill, the two triggers, idempotence, the round-trip test) are all GREEN.
- The backfill's default `_localCueDeriveFn` is a deterministic LOCAL keyword-cue producer (NOT the LLM producer). This is intentional, not a gap: it keeps CI deterministic and the backfill functional with zero credentials, and is Part-8-legal (LOCAL text scan, zero Brain). The richer LLM producer (`graph-candidate-producer.produceCandidates`, anthropic-transport) is injectable via the `deriveFn` option for the command path.

## Threat Flags

None. No new network endpoint, auth path, or schema change at a trust boundary was introduced. The backfill, the sweep, and the drain are LOCAL fs + navigation.cjs only and PASS the run-all-169.sh Part-8 grep sweep. The enqueue/drain queue file is a room-local `.mindrian/graph-derive-queue.json` with no network surface.

## Commits

- `bdb3a6bc` feat(169-05): idempotence guard + Stop sweep hook + SessionStart drain hook
- `fc89b178` feat(169-05): /mos:graph --derive HEAL-FIRST backfill + hook registration + round-trip test

## Self-Check: PASSED

- Created files exist: lib/core/graph-backfill.cjs, scripts/gsd-graph-derive-sweep.cjs, scripts/gsd-graph-derive-drain.cjs, tests/test-graph-derive-sweep.cjs, this SUMMARY (all FOUND).
- Commit hashes exist in git: bdb3a6bc, fc89b178 (both FOUND).
- Em-dash sweep over this SUMMARY + all created/modified surfaces: zero literal em-dashes.
