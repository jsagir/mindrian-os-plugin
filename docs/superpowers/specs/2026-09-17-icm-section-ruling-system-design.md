# ICM Section Ruling System - design

**Date:** 2026-09-17
**Status:** approved in dialogue (navigator, 2026-09-17), spec for one GSD phase of three plans
**Consults:** icm-architect (invariants 1, 4, 7, 8, 9), langtalks-graph-expert (context engineering, episode 55; memory, episode 57; the ICM note; path: context engineering builds on Agent builds on Knowledge Graph), Theo (standing consult; a Theo-side plan is a dependency, not part of this phase)
**Grounding numbers:** fleet census 2026-09-17 (31 rooms with `.mindrian`, 390 section directories, 7 roots without ROOM.md, 155 nested sub-rooms); Phase 343 close-out (7,824 of 7,836 claims fleet-wide carry no anchor edge); Spike 002 (Jev ranks Theo frameworks by section fit at Spearman 0.59-0.82 against graph degree 0.06-0.13; 305 of 410 Theo framework descriptions are stubs); Spike 004 (a stated policy executes 64 of 64 at confidence 0.90).

## 1. Summary

Every section of every room, main or sub-room, gets a **ruling system**: a generated Layer 2 document (its `CONTEXT.md`) that states the job the section exists to do (its JTBD), the methodology that serves that job in sequence (rooted in Theo), the writing rules for what may be filed there, the human gates that make a claim true, and the checks that fail when any of that is violated. Underneath it, every folder, root included, gets a generated self-location block so a cold reader answers "which room, what part, what is under me" from the folder itself. Jev enters twice and only over structure: it scores the relevance ledger once per release, and it grades the writers on fixture rooms. No vendor call ever sits at room birth or in the turn path, and no room content ever reaches Jev.

## 2. Rulings made in the design dialogue (locked)

1. **Order:** self-location first, then the ruling system with its relevance ledger, then Jev grading. One phase, three plans.
2. **Authority:** the generated room map (`.mindrian/room-map.json`) is the single home of a folder's self-knowledge; every ROOM.md carries a derived, fingerprinted block. The model reads one block per turn; tooling reads the map. Most resilient (rebuildable from disk at any time) and most token-efficient (60-120 tokens per block).
3. **Runtime:** code eligibility plus a precomputed Jev-scored table. No Theo or Jev call in the turn path; the reach dial falls back to today's sensor order when no row applies.
4. **Grading inputs:** fixture rooms only. Never a real room.
5. **Sub-rooms:** a sub-room declares its own job and gets its own ruling document and ledger row; an undeclared job resolves through the parent and is flagged until declared.
6. **Table shape:** the shipped ledger is truth; each ROOM.md's `default_methodologies` becomes a derived, fingerprinted view of it. The field that nothing read starts meaning something.
7. **Target (reframe):** the unit of value is the ruling document per section, rooted in Theo and in the section's JTBD; self-location is its addressing layer.

## 3. Architecture: three units, one per plan

### Unit 1 - Room Map (self-location), plan 1, deterministic

- `lib/core/room-map.cjs` walks a room directory and produces `.mindrian/room-map.json`:
  `{ room, built_at, fingerprint, nodes: [{ path, kind, job, job_id, parent, depth, children[], artifact_count, has_room_md }] }` where `kind` is one of `root | section | structural | sub-room`. Reads: the tree; each ROOM.md frontmatter (`section`, `statement`, `job_id`); `section-registry.cjs` (`CORE_SECTIONS`, `EXTENDED_SECTION_META`, `STRUCTURAL_DIRS`); the room registry entry (`~/MindrianRooms/.rooms/registry.json`) for nested rooms as a cross-check only, because today a nested entry can carry `parent` and `path` that disagree and no `depth`.
- Derived view: every ROOM.md, root included, gets a generated `icm_self:` frontmatter block: `room, path, parent, depth, children, artifact_count, fingerprint`. Regenerated only from the map, never hand-edited (invariant 9). A missing root ROOM.md is created from `templates/room-skeleton/ROOM.md.identity.tmpl`.
- Write moments: room birth (`room-skeleton-scaffold.cjs`); sub-room birth as SEED-001's sixth side effect inside the existing ACID block in `room-birth.cjs` (parent and child maps rebuild together or the birth unwinds); `doctor --fix`.
- Doctor module `room-map` (registered in `data/doctor-modules.json` with the existing `{id, introduced_version, cadence, flag, fix_supported, runner, description}` shape). Fails on: missing map; map fingerprint disagreeing with a fresh disk walk; any directory without ROOM.md; a self block whose fingerprint disagrees with the map; a sub-room whose registry `parent` or `path` disagrees with the disk. `fix_supported: true` rebuilds.
- Consumer: the room-context leg of `context_assemble` reads one self block (the active focus folder) plus the root's; the reach tuple gains `folder_job_id`, `depth`, `children_count`. This is the only per-turn read.

### Unit 2 - Section Ruling System, plan 2, code at runtime, Jev at release time

**Section JTBD canon.** `section-registry.cjs` gains, per canonical section, `job_id` and `serves_jtbd` drawn from the closed 16-job vocabulary the command registry already uses (`find-problem`, `understand-market`, `validate-idea`, `decide-pursue`, `prepare-pitch`, `compare-options`, `surface-contradiction`, `plan-execution`, `audit-room`, `find-bottleneck`, `explore`, `temporal-correction`, and the rest as listed in `data/command-registry.json`). A sub-room declares `job_id` through one F.8 card at birth ("what kind of folder is this") written into its ROOM.md; `custom` resolves through the parent until declared.

**Relevance ledger.** `data/section-command-ledger.json` ships with the plugin, keyed by `(job_id, problem_type, stage)`; each row is a ranked list of `{command, framework, score, confidence}`. Built by `scripts/build-section-command-ledger.cjs` at release: Theo's canonical frameworks (pulled through `brain-client.query` with parameterized, bucketed predicates, per the Spike 002 puller) joined to the 113 commands through `framework_index` and each command's `frameworks`, scored by Jev in batches of 20 with the Spike 002 rubric, dev-time key only, name plus JTBD statement plus glossary line crossing and nothing else. Rebuilt on `theo-resync`. Committed as data.

**The ruling document.** Each section's `CONTEXT.md` (Layer 2, written today by Phase 275's `writeSectionContracts`) becomes generated from canon, ledger and writer contracts, fingerprinted, with six parts:
1. **Job** - the JTBD sentence and `job_id`.
2. **Methodology sequence** - which frameworks and commands, in what order, from the ledger row for `(job_id, room problem_type, room stage)`; the WHEN, WHICH and SEQUENCE the moat is made of.
3. **Writing rules** - allowed artifact kinds, required frontmatter, allowed `epistemic_type` values, minimum evidence tier, the folder-per-artifact convention (Decision 16).
4. **Gates** - what a human confirms before a claim filed here becomes true (Canon Part 9).
5. **Checks** - what `doctor section-ruling` fails on.
6. **Commands that write here** - kept from today's contract (ground-truth `produces` matches and framework-matched wildcards).
The existing Inputs / Process / Human check prose is preserved as authored context under the generated parts, never overwritten; the generated parts are marked and fingerprinted.

**Enforcement.**
- Filing gate: `artifact_file` and `claim_write` require the artifact's `serves_jtbd` to match the section's `job_id` (or a declared cross-section reason). Default `flag` (the write lands with a `job_mismatch` disclosure); `strict` mode refuses. Every new claim filed into a section lands an anchor edge (`SOURCED_FROM` or `PART_OF`, whichever `edges.cjs` already allows for this pair) to the section's `jtbd:<job_id>` node, seeded at map build (the Phase 345 carried-forward item (b)). This closes the unanchored-claims gap for new claims; legacy claims are out of scope.
- Doctor module `section-ruling`: fails on a ruling document whose fingerprint disagrees with canon plus ledger, a section or sub-room without `job_id`, or a claim written after this phase with no anchor edge.
- Per turn, in `decide()` under its existing 1200 ms budget: code filters the 113 commands (produces glob against this folder, stage gate, `autonomous_safe`, not run in this folder in the last N turns per decision traces, HITL shape declared), orders survivors by the ruling document's sequence, and hands the reach dial the top three with confidence. Below a confidence floor, or with no row, the dial falls back to the sensor order unchanged.

### Unit 3 - Fixture grading, plan 3, Jev as grader, fixtures only

- `tests/fixtures/icm-rooms/`: authored fixture rooms with sections carrying authored MINTO and FEYNMAN content, template-identical stubs, sub-rooms with and without `job_id`, rejected and confirmed rows.
- `evals/icm/`: one checklist per writer, derived from that writer's own contract: scaffolder (self block and root ROOM.md correct: code); ruling writer (the six parts present and consistent with canon and ledger: code; the methodology sequence fits the job: Jev Score); MINTO refresher (governing thought summarizes the section's artifacts: Jev Noul); claim filer (anchor edge present and `serves_jtbd` honoured: code; `epistemic_type` plausible: Jev); entity extractor (no template words: code; entity is a concept: Jev).
- `scripts/eval-icm-writers.cjs` runs them with the dev-time key, writes JSON plus a De Stijl report, and gates the dev acceptance run. It never runs in a user hook and never reads a real room.

## 4. Data shapes

- `.mindrian/room-map.json`: see Unit 1. `fingerprint` = sha256 over the sorted `(path, kind, job_id, parent, children)` tuples.
- ROOM.md `icm_self:` block: `{ room, path, parent, depth, children: [names], artifact_count, fingerprint }`; `children` are bare names, no descriptions (token rule).
- `data/section-command-ledger.json`: `{ built_at, theo_frameworks, plugin_version, jev_model, rows: { "<job_id>|<problem_type>|<stage>": [{ command, framework, score, confidence }] } }`.
- Ruling `CONTEXT.md`: frontmatter `{ icm_layer: 2, job_id, ruling_fingerprint, generated_at }`; six generated parts under a marked block; authored prose below it.
- `jtbd:<job_id>` node: typed anchor node, `epistemic_type: observation` (a folder's declared job is a fact about the folder, not a claim about the venture), `created_by: system`, `review_status: proposed`, one per job per room, written through the navigation door. The anchor edge type from a claim to it is the one `edges.cjs` already allows for a claim-to-anchor link (Phase 345 used `SOURCED_FROM` for gate decisions); the planner confirms the exact type against the allow-list and adds no new member.

## 5. Data flow

- **Birth** (room or sub-room): scaffold writes ROOM.md files, then the map, then every self block, then every ruling document from canon plus the shipped ledger; sub-room birth does this inside the existing ACID block as side effect six.
- **Filing**: `artifact_file` / `claim_write` run the filing gate, land the anchor edge, log a `memory_event` on a job mismatch.
- **Turn**: `context_assemble` reads one self block plus the root's and the active folder's ruling sequence; `decide()` filters and orders; the dial shows the top three.
- **Release**: `build-section-command-ledger.cjs` rebuilds the ledger with Jev; `theo-resync` carries the section registry so Theo can emit Section nodes with JTBD and framework links (Theo-side plan, registered as a dependency).
- **Doctor**: `room-map` and `section-ruling` report drift; `--fix` rebuilds maps, self blocks and ruling documents.

## 6. Failure handling

- Missing map or ruling document: rebuild on next birth-time or `doctor --fix`; the turn path degrades to today's behaviour (no crash, no block).
- Drift (map vs disk, block vs map, ruling vs canon plus ledger): doctor fails with a named fix; nothing at runtime blocks on drift.
- Sub-room without `job_id`: parent fallback plus a doctor warning; never a network call to guess it.
- Missing ledger row or confidence below floor: sensor order, unchanged from today.
- Jev unavailable at release: the last shipped ledger is kept and the release log carries an audited flag (same shape as `--no-theo-check`).
- Filing gate mismatch: `flag` by default (the write lands with a disclosure); `strict` refuses. Never silent.
- Registry and disk disagree on a sub-room's ancestry: disk wins for the map; doctor reports the registry drift.

## 7. Testing

- RED then GREEN per unit; fixture rooms under `tests/fixtures/icm-rooms/` with sub-rooms, authored scaffolds, template stubs, rejected and confirmed rows, cross-section artifacts.
- Unit 1: map build idempotent; block regeneration byte-stable; root ROOM.md created; sub-room birth rebuilds both maps atomically and unwinds on failure; doctor detects each drift class.
- Unit 2: canon covers every core and extended section; ledger build is deterministic given a fixed Jev response fixture (the network call is injected); ruling document regenerates from canon plus ledger and preserves authored prose; filing gate flags and refuses per mode; anchor edge lands; `decide()` stays inside its budget with the filter (measured).
- Unit 3: each checklist has a labeled fixture set; grader agreement is measured against a Claude-judge baseline once.
- Fleet walk test: `doctor room-map` and `doctor section-ruling` run in report mode over all 31 fleet rooms and 155 sub-rooms before any `--fix` touches a real room; `--fix` on real rooms is the navigator's explicit act.

## 8. Success criteria (measured, reported)

1. `doctor room-map` and `doctor section-ruling` green on all 31 fleet rooms after `--fix`: 0 directories without ROOM.md (7 today), 0 drift.
2. Per-turn self-location plus ruling read under 400 tokens (one block plus one sequence).
3. 100 percent of new claims filed on fixture rooms carry an anchor edge (fleet today: 12 of 7,836).
4. Reach top-3 hit rate on a labeled fixture turn set at least equal to today's sensor order; both numbers reported.
5. Ledger build cost and wall time recorded per release (Spike 002 baseline: about $0.018 and under 30 s for 4 x 410 at the vendor-claimed rate).
6. Grader agreement with the Claude-judge baseline at least 0.8 on the fixture set.

## 9. Out of scope

- A live Theo or Jev call in the turn path or at birth.
- Grading real rooms (a later, opt-in, dev-only decision).
- The Theo content backfill (SEED-096): a quality prerequisite for the ledger, not a mechanism prerequisite.
- The Larry constitution judge (Spike 005) and the command eval grader (a sibling spike).
- Projecting the map into `room.db` as Folder nodes (a later phase, chain-state precedent).
- Migrating legacy unanchored claims.

## 10. Canon compliance

- **Part 8:** the ledger build sends generic handles only (framework name, JTBD statement, glossary line, section enums); runtime is zero network; no room content reaches Jev or Theo.
- **Part 9:** maps, blocks and ruling documents are bookkeeping, not truth claims; claims still land `proposed` and only a human confirms; anchor edges go through the navigation door.
- **Part 7:** reuses `section-registry.cjs`, `writeSectionContracts`, `serves_jtbd`, the goal-anchor precedent, the doctor module pattern, `room-birth.cjs`'s ACID block, and the Spike 002 puller and rubric.
- **Part 11:** no new invocable command in this phase; two doctor modules and one build script. Any later `/mos:` surface is born wired with a declared HITL shape.
- **Part 12:** the F.8 card at sub-room birth is a real fork and fires as a card, never a drawn box.

## 11. Dependencies and hand-offs

- SEED-095 (section framework ledger) is absorbed by Unit 2. SEED-096 (Theo content backfill) stays a quality prerequisite.
- Theo-side plan: `theo-resync` payload gains `section_registry_path` and a registry hash; Theo emits Section nodes with JTBD and `USES_FRAMEWORK` links. Owner: the Theo repo.
- Research trail: this spec, the design decisions and the fleet census are filed in `rethinking-mindrianos/research/` and mirrored to `mindrianOS/research/` per the dev-compositing rule.

## 12. Plan decomposition

- Plan 1: Room Map (Unit 1) with doctor `room-map`, sub-room side effect six, fixture rooms, fleet report.
- Plan 2: Section Ruling System (Unit 2) with canon, ledger build script and shipped ledger, ruling document generator, filing gate, anchor edges, doctor `section-ruling`, `decide()` filter.
- Plan 3: Fixture grading (Unit 3) with checklists, runner, De Stijl report, acceptance wiring.

Planner defaults, to be confirmed in discussion: top-K 3; confidence floor 0.5 (the vendor's "do not act" line, to be evaluated on our labeled set); recency window N = 5 turns; filing gate default `flag`.
