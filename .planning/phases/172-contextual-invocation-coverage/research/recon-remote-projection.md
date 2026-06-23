# RECON: Remote-Graph / Orchestration-Projection substrate for Phase 172

> Source: internal recon agent (2026-06-22), relayed inline (subagent Write was denied; parent persisted).
> Scope: INV-04/05/06 substrate — the remote orchestration projection + `methodology_tier` + counterpart nodes.

## Headline: the projection generator is BUILT, not deferred

Phase 157 shipped and verified 11/11 (`.planning/phases/157-*/157-VERIFICATION.md`). On disk:

- `scripts/build-orchestration-projection.cjs` — generator + full `--check` 3-mode tripwire
  (STALE / UN-WIRED / UN-RANKED). `validateProjection` ~L733-840, `runCheck` ~L842,
  `ALLOWED_EDGE_TYPES` frozen L106-122, `addEdge` referential-integrity throw L436.
- `data/brain-orchestration-projection.json` — LIVE: **220 nodes** (101 command, 14 skill,
  9 agent, 28 framework, 6 reach, 62 sub_mode), 55 edges (OPERATES + CROSS_DOMAIN_ANALOGUE).
- `--check` wired into BOTH gates: `scripts/hooks/pre-commit:184-186` and
  `lib/memory/run-feynman-tests.cjs:1262,1267`.
- Canon Part 8 dual-role amendment + `methodology_tier` minted: `docs/MINDRIAN-CANON.md:462`
  (Appendix D entry 19, v1.7→1.8). Contract: `docs/ORCHESTRATION-PROJECTION-CONTRACT.md`.

## The `mindrian-operation` second tier ALREADY EXISTS

192 nodes carry `methodology_tier` today. The tier is NOT net-new as a concept.

## What IS deferred (quoted from contract 4c / canon entry 19)

- live Brain WRITE of the projection (fast-follow)
- CONTINUOUS sync = **Phase 137** (`docs/CANON-PHASE-MAP.md:217` "NOT built (scoped-backlog)",
  only 137-CONTEXT.md + DRIFT.md on disk, LOCKED read-only)
- live nav-engine CONSUMPTION of the cache
- the CHAINS/FEEDS_INTO/PREREQUISITE chain layer is source-empty
  (`command-registry.json curated_chains` = `[]`) but the machinery accepts it.

## What 172 must ADD for `mindrian-operation` counterparts (the gap is the dark-command set, not new schema)

- Of 101 command nodes, only **55 are connector-ranked; 46 are bare (no reach_id);
  38 are fully dark (no OPERATES edge)** — e.g. `/mos:act, /mos:doctor, /mos:dashboard, /mos:causal`.
- Current gate LETS them ship dark: `--check` UN-RANKED **early-continues** on any node
  lacking `reach_id` (`build-orchestration-projection.cjs:824`); UN-WIRED is framework-grained,
  never command-grained.
- Net-new for 172:
  1. **enrich** warranted dark commands with connector ranking + a counterpart/OPERATES edge (INV-05);
  2. a **wired-XOR-EXCLUDED command ledger** mirroring `data/orchestration-unwired-allowlist.json` (INV-11);
  3. **invert the `:824` early-continue** so a bare command FAILs unless ranked-or-excluded (INV-11);
  4. **populate `curated_chains`** to materialize chain edges (INV-08);
  5. **document + exercise once** the promotion path dark → counterpart → `pws` frontier via the
     Phase 171 ingest pipeline (exists: `lib/core/methodology-ingest.cjs`, `commands/ingest-methodology.md`) (INV-06).
  The "counterpart / promotion path / frontier framework" vocabulary is 100% net-new as a CONCEPT
  (repo grep returns only unrelated hits).

## INV-12 LOCAL-ONLY consumption

Consume `data/brain-orchestration-projection.json` as a plain local file (Tier-0 resilient,
regenerated from local sources only, zero Brain I/O), rank with the existing
`rankReachesForProblem(projection, ...)`, enforce via the in-memory `--check`. Any Brain wire
belongs to Phase 137 (not built) and is OUT of 172.

## Edge-vocab note

The projection owns its OWN closed `ALLOWED_EDGE_TYPES`
(OPERATES / CHAINS / FEEDS_INTO / PREREQUISITE / CROSS_DOMAIN_ANALOGUE); it does NOT reuse the
separate frozen GSD/room edge set in `lib/core/navigation/edges.cjs:32`. Overlap is only the
name `FEEDS_INTO`.
