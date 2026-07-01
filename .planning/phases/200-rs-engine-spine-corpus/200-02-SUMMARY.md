---
phase: 200-rs-engine-spine-corpus
plan: 02
subsystem: reverse-salient-engine
tags: [part8, part9, brain-boundary, chokepoint, expert-graph, D-200-2]
requires:
  - "200-01 (RS corpus-quality gate)"
  - "196 (part8-egress-guard, part8-egress-ontology)"
  - "navigation.cjs Part-9 chokepoint"
provides:
  - "RS Tier-0 graph writes routed through the navigation Part-9 chokepoint"
  - "DISCOVERED + AUTHORED_BY minted into the navigation frozen edge set"
  - "LOCAL-only Tier-0 expert base locked + documented (D-200-2 (b) base half)"
  - "lib/core/rs-expert-brain-projection.cjs: Part-8 fail-closed Brain generic-handle projection (D-200-2 (b) additive half)"
affects:
  - "Phase 203 synthetic-expert reader (consumes the projection; 203 no longer the Brain reader)"
tech_stack:
  added: []
  patterns: ["part9-chokepoint", "part8-fail-closed-projection", "whitelist-plus-leak-scan"]
key_files:
  created:
    - "lib/core/rs-expert-brain-projection.cjs"
    - "tests/test-200-brain-projection.cjs"
    - "tests/test-200-local-tier0.cjs"
  modified:
    - "lib/core/rs-sqlite-mirror.cjs (Tasks 1-2, parallel session)"
    - "lib/core/navigation.cjs (Tasks 1-2, parallel session)"
    - "commands/rs-experts.md"
    - "commands/rs-thesis.md"
    - "tests/test-200-graph-chokepoint.cjs (Tasks 1-2, parallel session)"
decisions:
  - "D-200-2 resolved to (b): keep LOCAL-only Tier-0 as the base AND add a Brain generic-handle projection as a Mode-A reader"
  - "The projection whitelists 6 methodology-enum keys and NEVER reads person keys; a token-level leak scan is the fail-closed belt"
metrics:
  duration: "Tasks 1-2 parallel session; Tasks 3-4 this session"
  completed: "2026-07-01"
  tasks: 4
  files_created: 3
---

# Phase 200 Plan 02: RS Chokepoint Reroute + Expert-Graph Brain Boundary Summary

RS Tier-0 graph writes now flow through the single Part-9 navigation chokepoint, and the expert-graph's Brain boundary is resolved to navigator decision D-200-2 (b): the LOCAL-only Tier-0 people-graph stays the base (no person byte ever egresses), plus an additive, fail-closed Brain projection that reads the expert-network as generic framework/enum handles only.

## What shipped

### Tasks 1-2 (parallel session, verified green, treated as frozen prior-wave output)

- **Task 1 -- `2ff5f3ac`** `feat(200-02): mint DISCOVERED + AUTHORED_BY into navigation frozen edge set`. The navigation closed surface can now express the RS typed node + edge writes.
- **Task 2 -- `f87b2d79`** `fix(200-02): route RS Tier-0 writes through the navigation Part-9 chokepoint`. `rs-sqlite-mirror.writeDiscovery` routes edge writes through `navigation.writeEdge` and emits a `reverse_salient_detected` memory_event instead of a direct `INSERT`. The RS node/edge schema is preserved byte-for-byte; re-runs are idempotent (0 new edges). Proven by `tests/test-200-graph-chokepoint.cjs` (still green this session).

These files (`rs-sqlite-mirror.cjs`, `navigation.cjs`, `edges.cjs`, `test-200-graph-chokepoint.cjs`) were owned by the parallel session and were NOT touched here.

### Task 3 (this session) -- lock the LOCAL-only Tier-0 base -- `8b3492a3`

`docs(200-02): lock RS expert-graph LOCAL-only Tier-0 base (D-200-2 (b), Part 8)`

- `commands/rs-experts.md` + `commands/rs-thesis.md` (append-only) now document that Tier-0 Author/Paper/Institution resolution is LOCAL-only from `room.db`, needs no Brain call and no Brain key, and degrades cleanly when Brain is absent (Canon Part 8: people/paper data is LOCAL and never egresses).
- `tests/test-200-local-tier0.cjs` proves it two ways: structurally (neither command carries a `mcp__mindrian-brain__*` tool in `allowed-tools`, and both bodies document the LOCAL-only Part-8 base) and functionally (Tier-0 resolves Author + Institution from a LOCAL `room.db` with the Brain key absent, with no throw).

### Task 4 (this session) -- the Part-8 Brain generic-handle projection -- `483b9d48`

`feat(200-02): Brain generic-handle expert projection, Part-8 fail-closed (D-200-2 (b))`

- `lib/core/rs-expert-brain-projection.cjs` exports `projectExpertHandles(localExpertNode, opts)` -- the additive Mode-A reader that Phase 203 will consume.
- `tests/test-200-brain-projection.cjs` is the adversarial proof: (a) the outbound payload the REAL Phase 196 guard sees is generic-only, hard-failing on any person-byte string; (b) a synthetic person byte smuggled onto a generic-looking key (`slug` / `domain`) never egresses; (c) a guard block / ambiguous / throw all yield `[]` with no throw; (d) Brain absent yields `[]` (pure Tier-0 degrade) with no throw; (e) a read-back handle that echoes a person identity is dropped while generic handles survive.

## The Part-8 property (stated explicitly)

**No local person byte may cross the wire to the Brain, and the projection fails closed on any doubt.** This is enforced in code and proven by the test, at four layers:

1. **Whitelist by construction.** The projection reads ONLY six methodology-enum keys off the local expert node (`framework`, `domain`, `methodology`, `problem_type`, `enum`, `tier`). It never reads `name`, `institution`, `affiliation`, `orcid`, `author`, or `email`, so a person byte cannot enter the outbound payload through the intended path.
2. **Token-level leak scan (belt-and-suspenders).** Person bytes are collected AND expanded into identifying tokens (a bare surname counts), then any outbound handle or composed query containing one is dropped; if a person byte still reaches the outbound string, the whole projection returns `[]`.
3. **Every Brain call rides the Phase 196 guard.** `part8-egress-guard.classify()` gates the payload; a verdict that is not `allow` -- or a guard throw -- is treated as "degrade to Tier-0" (`[]`), never an error. The guard suite (`run-all-196.sh`) is still 5/5 green, so the projection did not weaken it.
4. **Inbound filter + clean degrade.** The read keeps only generic framework/enum handles; any handle echoing a person identity is dropped (return nothing if that empties it). Brain absent (no key / no MCP) => `[]`, no throw.

Canon Part 7 is honored: the projection reuses the shipped 196 guard and the `rs-brain-substrate` read surface; it adds one reader module, no second Brain client.

## Verification

- `node tests/test-200-brain-projection.cjs` -> PASS (incl. the no-person-byte-egress hard assertion through the real guard).
- `node tests/test-200-local-tier0.cjs` -> PASS.
- `node tests/test-200-graph-chokepoint.cjs` -> PASS (frozen Tasks 1-2, still green).
- `bash tests/run-all-196.sh` -> Passed 5 / Failed 0 (the projection did not weaken the guard).
- Frozen Task 1-2 files (`rs-sqlite-mirror.cjs`, `navigation.cjs`, `edges.cjs`) untouched by this session.

## Deviations from Plan

**1. [Rule 1 - Bug] Token-level person-byte scan needed for the read-back drop.**
- **Found during:** Task 4, test assertion (e).
- **Issue:** the initial leak scan collected person bytes only as whole field values, so a read-back handle echoing a single name token (a bare surname without the first name) slipped the substring check.
- **Root cause:** substring matching against the full value `henrietta quibblesworth` cannot catch the fragment `quibblesworth methodology`.
- **Fix:** `_collectPersonBytes` now expands each person value into identifying tokens (length >= 3, minus a tiny stopword set) as well as keeping the full value; the scan is now fail-closed against partial echoes. This also hardens the outbound path against a partial affiliation smuggled onto a generic key.
- **Files modified:** `lib/core/rs-expert-brain-projection.cjs`.
- **Commit:** `483b9d48`.

## Known Stubs

None. The default Brain reader wires to the shipped `rs-brain-substrate.loadSubstrate`; tests inject an offline reader for determinism, which is the intended test seam, not a stub.

## Threat Flags

None. The one new Brain-reading surface (`rs-expert-brain-projection.cjs`) is exactly the surface the plan's boundary analysis covers; it routes through the existing Phase 196 egress guard and is proven fail-closed on person-byte egress.

## Self-Check: PASSED

- All 3 created files present on disk; SUMMARY present.
- All 4 commits present: `8b3492a3` (Task 3), `483b9d48` (Task 4), `2ff5f3ac` (Task 1), `f87b2d79` (Task 2).
