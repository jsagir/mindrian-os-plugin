---
phase: 163
plan: 04
subsystem: trending-to-absurd orchestrator + command surface + connector + skill
status: complete
tags: [trending-to-absurd, visionary-innovation-companion, futures-clone, harness-as-code, graph-native-seed, absurd-horizons, exclusive-ownership, connector-spine, shape-f-gate, D-163-04, D-163-05, wave-4-surface-a, part-7-reuse, part-8, part-9]
requires:
  - lib/core/futures/orchestrator.cjs (the 5-act harness CLONED + re-exported verbatim, Part 7)
  - lib/core/navigation/get-domains-for-trends.cjs (Wave 3 getDomainsForTrendExtrapolation reader -- Act 1 seed source)
  - lib/core/navigation.cjs (the writeEdge / confirmNode / getDomainsForTrendExtrapolation chokepoint)
  - commands/explore-trends.md (the frontmatter shape mirrored verbatim; the EXTENDED reference)
  - docs/CONNECTOR-CONTRACT.md (the Phase 143.3 11-sub-key connector schema)
  - scripts/build-connector-registry.cjs + scripts/build-command-registry.cjs (the pre-commit generators)
provides:
  - lib/core/trending-to-absurd/orchestrator.cjs (the 5-act trend pipeline -- seedFromDomains / extractTrends / generateAbsurdRings / registerTrendArtifacts / surfaceTrendSelectionGate + verbatim re-export of the futures harness)
  - commands/trending-to-absurd.md (/mos:trending-to-absurd + Phase 122 frontmatter + Phase 143.3 connector block)
  - skills/trending-to-absurd/SKILL.md (when/how the skill activates + canon_parts + chain/extend posture)
  - data/connector-registry.json regenerated (trending-to-absurd connector wired into the spine)
  - data/command-registry.json regenerated (the new command registered)
  - tests/run-all-163.sh connector-block validation gate (connects_to_spine + framework == frameworks:)
affects:
  - the v1.14.0 Visionary Innovation Companion surface (the user-facing /mos:trending-to-absurd)
  - the reach spine (the orchestrator/dispatcher can now reach trending-to-absurd via the registry)
  - Phase 166 gated-chain-executor (a future runChain consumer of this command)
tech-stack:
  added: []
  patterns:
    - "Part 7 clone + extend: require + re-export the futures harness functions VERBATIM (generateRing / writeCascadeEdges / registerConsequenceArtifacts / runHsiScan / surfaceBridgesAtGate / confirmRingDecisions / bankCandidateWithProvenance / runSignalResearch) so the harness logic is reused not duplicated"
    - "graph-native Act 1: seedFromDomains reads navigation.getDomainsForTrendExtrapolation (the Wave 3 reader), never a user-typed seed string (D-163-04)"
    - "frozen-enum reuse: generateAbsurdRings maps the 3 spec horizons (3-10/11-30/50yr) onto the reused HORIZON_ENUM without minting a new enum"
    - "exclusive file ownership: registerTrendArtifacts pins the seed under opportunity-bank/trending-to-absurd-<seed>/ via the reused registrar (T-163-10)"
    - "Shape F.1 gate assembly mirrors surfaceBridgesAtGate (LOCAL assembly only; never renders the gate itself)"
    - "explore-trends connector frontmatter shape mirrored verbatim; hierarchy_rank 33 chosen to not collide with explore-trends 32 / explore-domains 34"
    - "pre-commit registry regeneration: a new command with frameworks: + connector: makes BOTH data/command-registry.json and data/connector-registry.json stale; regenerate both"
key-files:
  created:
    - lib/core/trending-to-absurd/orchestrator.cjs
    - tests/test-trending-to-absurd-orchestrator.cjs
    - commands/trending-to-absurd.md
    - skills/trending-to-absurd/SKILL.md
  modified:
    - tests/run-all-163.sh
    - data/connector-registry.json
    - data/command-registry.json
decisions:
  - "CLONED the futures harness by REQUIRE + re-export (not copy-paste): the orchestrator requires lib/core/futures/orchestrator.cjs and re-exports its functions verbatim, so a futures harness fix flows through automatically and there is zero duplicated harness logic (the strongest reading of Part 7 clone + extend)"
  - "generateAbsurdRings stamps a horizon_spec ANNOTATION (3-10/11-30/50yr) on each consequence WITHOUT touching the frozen HORIZON_ENUM value -- the spec horizons are a render label over the reused enum, not a new enum (no over-minting)"
  - "hierarchy_rank 33 (between explore-trends 32 and explore-domains 34) per the plan's non-collision instruction"
  - "the connector framework is S-Curve Analysis -- the EXACT frameworks: value explore-trends uses -- so the resolver key matches and the --check tripwire stays green"
metrics:
  duration: ~1 session
  completed: 2026-06-18
  tasks: 2
  files: 7
---

# Phase 163 Plan 04: Trending-to-the-Absurd Orchestrator + Command + Connector + Skill Summary

WAVE 4 SURFACE-A landed: the Visionary Innovation Companion is now a graph-fed harness-as-code
surface. The 5-act trend pipeline is CLONED from the futures harness (Part 7: require + re-export
verbatim, never rewrite) and EXTENDED with a graph-native Act 1 seed (D-163-04), the
extrapolate-to-absurd horizon stamping across 3-10 / 11-30 / 50yr, an exclusive-ownership filing
wrapper (opportunity-bank/ only, T-163-10), and the two hybrid Shape F Decision Gates (D-163-05).
The `/mos:trending-to-absurd` command rides the connector spine, and the skill declares its
canon_parts + chain/extend posture.

## What shipped

### Task 1 (commit fc2d3392) -- the 5-act orchestrator clone + extend (TDD)

- `lib/core/trending-to-absurd/orchestrator.cjs` (new, 341 lines):
  - **Part 7 clone:** requires `lib/core/futures/orchestrator.cjs` and re-exports its harness
    functions VERBATIM -- `generateRing`, `writeCascadeEdges`, `registerConsequenceArtifacts`,
    `runHsiScan`, `surfaceBridgesAtGate`, `confirmRingDecisions`, `bankCandidateWithProvenance`,
    `surfaceChainingHandoffs`, `runSignalResearch`, the caps, `HORIZON_ENUM`, the validator. Zero
    duplicated harness logic.
  - **Act 1 net-new (D-163-04):** `seedFromDomains(roomDir, opts)` calls
    `navigation.getDomainsForTrendExtrapolation` (the Wave 3 reader) and projects each graph-walked
    domain hub into a trend-extraction seed (tier 2 when domains exist; tier 0 cold-start fallback).
    `extractTrends(domains)` derives ranked trend candidates from the hubs + their related-node
    counts (a LOCAL signal). The seed is the graph, never a user-typed string.
  - **Act 2 net-new:** `generateAbsurdRings(seed, horizon, parents, opts)` REUSES `generateRing` for
    the bounded "and then what?" expansion (clamped to the reused `FUTURES_DEPTH_CAP` /
    `FUTURES_FANOUT_CAP`) and stamps each consequence with one of the three spec horizons mapped
    onto the frozen `HORIZON_ENUM` (near -> 3-10yr, mid -> 11-30yr, long -> 50yr).
  - **Act 3 net-new:** `registerTrendArtifacts(roomDir, consequences, opts)` is a thin wrapper over
    the reused `registerConsequenceArtifacts` that pins the seed folder under
    `opportunity-bank/trending-to-absurd-<seed>/` (exclusive ownership; no write escapes
    opportunity-bank/). ROOM.md per folder rides the reused registrar (ICM Layer 0).
  - **Act 4 net-new:** `surfaceTrendSelectionGate(roomDir, trends, opts)` returns a Shape F.1 gate
    descriptor at the trend-selection judgment point (D-163-05 hybrid), mirroring
    `surfaceBridgesAtGate` (LOCAL assembly only; tri-context panels with a GENERIC S-Curve Analysis
    BRAIN handle, Part 8).
  - **Part 8:** zero Brain egress; the only external leg is the inherited `runSignalResearch`
    generic-handle path. **Part 9:** cascade edges route through `navigation.writeEdge` (zero raw
    `INSERT INTO edges` in the file).
- `tests/test-trending-to-absurd-orchestrator.cjs` (new, 5 behaviors): seedFromDomains seeds from
  the (stubbed) reader (tier 2); generateAbsurdRings clamps + stamps the 3 horizons;
  registerTrendArtifacts writes ONLY under opportunity-bank/ with ROOM.md; writeCascadeEdges routes
  ROOT_CAUSES through the chokepoint (+ grep gate: zero raw edge SQL); surfaceTrendSelectionGate
  returns the Shape F.1 descriptor.
- `tests/run-all-163.sh`: appended `test-trending-to-absurd-orchestrator.cjs` to `CJS_SUITES`, added
  the orchestrator + the new surfaces to the em-dash sweep, and added the connector-block validation
  gate (asserts `connects_to_spine: true` + the connector `framework` equals the `frameworks:`
  value). Prior wave entries untouched.

### Task 2 (commit b526d20a) -- the command surface + connector block + skill

- `commands/trending-to-absurd.md` (new): mirrors `commands/explore-trends.md` frontmatter shape
  verbatim -- name / description / help_jtbd / body_shape:methodology / serves_jtbd / teaching, the
  Phase 122 workflow-layer block (`kind: methodology`, `frameworks: ["S-Curve Analysis"]` -- the
  EXACT name explore-trends uses so the resolver key matches, `produces:
  "room/opportunity-bank/trending-to-absurd/*"`, `inputs: []`, `autonomous_safe: true`, allowed-tools
  Read/Write/Bash/Glob), and the Phase 143.3 connector block (the 11 sub-keys):
  `connects_to_spine: true`, `sensor_triggers: [SENS-04]`, `reach_id: context_block`, `sub_mode:
  trending-to-absurd`, `framework: "S-Curve Analysis"` (== frameworks:), `posture: push_forward`,
  `hierarchy_rank: 33` (non-colliding with explore-trends 32 / explore-domains 34),
  `filing: fileEvidenceWithReadback`, `plan_gated: false`, `web_scope: null`, `surface: F.1`. The
  BODY is a Larry-led walk through the 5 acts, references `references/methodology/explore-trends.md`
  (EXTEND posture, zero change), renders the two Shape F gates (D-163-05), and CHAINS to
  `/mos:futures` via the Phase 122 resolver.
- `skills/trending-to-absurd/SKILL.md` (new, 67 lines): declares when the skill activates (the
  navigator wants to push trends to their absurd extreme to surface disruptive opportunities), its
  `canon_parts: [Part 2, Part 3, Part 4, Part 7, Part 8, Part 9, Part 10]`, and that it CHAINS to
  `/mos:futures` at the Stage 5-6 boundary + EXTENDS `/mos:explore-trends`.
- `data/connector-registry.json` regenerated (58 connectors; trending-to-absurd wired) +
  `data/command-registry.json` regenerated (97 commands). Both `--check` OK.

## Verification

- `node tests/test-trending-to-absurd-orchestrator.cjs` -> PASS (5/5).
- Task 1 gate: `node tests/test-... && grep -cE "INSERT INTO edges" lib/core/trending-to-absurd/orchestrator.cjs | grep -q '^0$' && echo NO_RAW_EDGE_SQL` -> NO_RAW_EDGE_SQL.
- Task 2 gate: `bash tests/run-all-163.sh && grep connects_to_spine + grep framework + test -f SKILL.md` -> SURFACE_OK.
- `bash tests/run-all-163.sh` -> 7/7 PASS (the 4 prior-wave suites + the new orchestrator suite + the
  connector-block validation + the em-dash sweep). Em-dash sweep green (no em-dashes).
- `node scripts/build-connector-registry.cjs --check` -> connector-registry: OK.
- `node scripts/build-command-registry.cjs --check` -> command-registry: OK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] data/connector-registry.json + data/command-registry.json were stale**
- **Found during:** Task 2 (the pre-commit hook blocked the commit)
- **Issue:** Adding `commands/trending-to-absurd.md` with both a `frameworks:` block (Phase 122) and
  a `connector:` block (Phase 143.3) made BOTH generated registries stale vs. the frontmatter; the
  `--check` tripwires (run in the pre-commit hook + the test runner) fail closed on drift. This is
  expected and required behavior, not a bug in the plan.
- **Fix:** Ran `node scripts/build-connector-registry.cjs` (-> 58 connectors) and
  `node scripts/build-command-registry.cjs` (-> 97 commands) to regenerate both registries from the
  new frontmatter, then re-verified both `--check` paths returned OK. This satisfies the plan's
  key_link "connector: block (generated by build-connector-registry.cjs pre-commit)".
- **Files modified:** data/connector-registry.json, data/command-registry.json
- **Commit:** b526d20a

## Authentication Gates

None.

## Known Stubs

None. The Tier-0 cold-start path inherited via `seedFromDomains` is a documented fallback (D-163-04),
not a stub: Tier 2 (the graph-walked seed) is the built primary path, wired to the Wave 2/3
substrate via `getDomainsForTrendExtrapolation`. The orchestrator is a thin clone of a fully-shipped
harness; every act calls real, tested functions.

## Threat surface scan / compliance

- **T-163-10 (exclusive file ownership):** `registerTrendArtifacts` pins every write under
  `opportunity-bank/trending-to-absurd-<seed>/`. Test 3 asserts no write path escapes
  opportunity-bank/ (the room top-level carries only opportunity-bank/ + the .mindrian/room.db).
- **T-163-11 (confirmNode promotion):** the opportunity-pick gate reuses `confirmRingDecisions`,
  which routes APPROVE through `navigation.confirmNode` with `resolveByUser` (a human byUser, never
  the agent).
- **T-163-12 (information disclosure):** zero Brain egress. The connector `framework` is a generic
  S-Curve Analysis handle; the only external leg is the inherited `runSignalResearch` generic-handle
  path. No new network surface.
- **T-163-SC (installs):** zero new packages (clones the futures orchestrator + reuses navigation).
  The RESEARCH Package Legitimacy gate is N/A (no installs).
- **Part 7 (Reuse Before Build):** the harness is CLONED by require + verbatim re-export (the
  strongest reuse); the command mirrors explore-trends; the reference is EXTENDED with zero change.
- **Part 8 / Part 9:** zero Brain egress; every graph write through the chokepoint; zero raw edge SQL.

## Self-Check: PASSED

- FOUND: lib/core/trending-to-absurd/orchestrator.cjs (341 lines, min 120)
- FOUND: tests/test-trending-to-absurd-orchestrator.cjs
- FOUND: commands/trending-to-absurd.md (contains connector:)
- FOUND: skills/trending-to-absurd/SKILL.md (67 lines, min 30)
- FOUND commit: fc2d3392 (Task 1)
- FOUND commit: b526d20a (Task 2)
