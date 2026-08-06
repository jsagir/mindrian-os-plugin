---
status: complete
---
# Quick task: grade-grant room-mode + roadmap + decompose + graph substrate

Extend the just-shipped `/mos:grade-grant` (commits `e32b18ad` + `aba72823`) per the
navigator's four follow-on asks this session: the room already holds everything a Tnufa
application needs, so (1) grade the ROOM directly alongside paste-mode, (2) turn the grade
into a build ROADMAP ("build this in room/<section>/"), (3) run the INVERSE direction
(decompose a finished application INTO a room, then grade that room), and (4) make the
criteria/room_section relationship real typed graph structure so Brain can coach on
STRUCTURAL shape (which sections are covered/partial/missing), not just per-gap content.
One `room_section` map (already sitting uncommitted on every tnufa criterion), used in
both directions. Predecessor trail:
`~/MindrianRooms/rethinking-mindrianos/research/2026-08-05-tnufa-graphrag-grant-grader/`.

## Decisions (these are choices, not outcomes)

- **D1 - decompose targets a NEW dedicated room, never the active venture room.**
  `tnufa-app-<slug>` born via `navigation.birthRoom()` (the real ICM birth keystone:
  ROOM.md identity files, STATE.md, sentinel, registry, Section nodes, the works) with the
  navigator's explicit approval as `approvedBy`. Rationale: filing grant-application-sourced
  prose into a live venture room pollutes real venture data the navigator may not want
  merged; a dedicated room is reversible (archive it) and mirrors how `/mos:rooms new` +
  ignite already birth rooms. Selective merge into the venture room stays a manual,
  navigator-driven follow-up, deliberately NOT automated this pass.
- **D2 - graph shape: criterion anchor nodes + ONE new edge type.**
  `grant_criterion:<program>:<criterion_id>` nodes (system-bookkeeping structural anchors,
  Part 9 v1.5 audit-node carve-out, same class as Section/Room/birth_gate_anchor nodes) +
  a NEW additive `MAPS_TO_SECTION` member in `ALLOWED_EDGE_TYPES` (criterion -> Section,
  the rubric map as graph). Verdict -> Section gap-profile edges REUSE `INFORMS` with
  scalar count properties - deliberately aggregated per section because the edges PK is
  (source, target, type), so per-criterion verdict->section edges for the 3 financial-model
  criteria would silently collapse into one row. Lighter additive-comment idiom for the
  frozen-set move (precedent: quick 260725-9ca minting CONCERNS).
- **D3 - Brain strategy is a SIBLING composer, not a rewrite.** `askBrainForStrategy()`
  next to `askBrainForCoaching()`, same recommend-never-trigger idiom verbatim: a
  section_profile enum bag (covered | partial | missing per mapped standard section slug -
  generic MindrianOS vocabulary, not user content) + gap categories. Prose never crosses;
  the host command fires the wire; degrades `brain_available:false`.
- **D4 - `writeGradingResult` stays byte-unchanged.** Graph writes are additive siblings
  in a new allow-listed `lib/core/navigation/grant-rubric.cjs` submodule (raw node INSERTs
  are substrate-banned outside `lib/core/navigation/`), re-exported on `navigation.cjs`
  per the standing thin-additive-re-export idiom. The existing 10 tests stay green
  untouched, including the "writeGradingResult writes zero edges" pin.
- **D5 - validation extracted, not duplicated.** `loadRubric`'s body validation moves into
  an exported `validateRubric(data)` so the new `room_section` vocabulary rule (null OR one
  of the 8 standard section slugs, fail closed on garbage) is directly testable without
  planting bad fixtures in the shipped fixtures dir.

## Build

1. `data/grant-rubric-schema.json` - `room_section` joins the criterion record contract +
   validation rule + a `room_section_vocabulary` list (8 standard slugs + null).
2. `lib/core/eureka/grade-grant.cjs` - `ROOM_SECTION_VALUES`, `validateRubric`,
   `sectionMap(rubric)` (the one map, both directions), `buildRoadmap(rubric, verdict)`
   (gaps grouped by room_section + the null-section process checklist, never a fake
   mapping), `askBrainForStrategy(verdict, rubric)`. All pure, isPlainObject-guarded,
   `{ok,...}`, never throw.
3. `lib/core/navigation/edges.cjs` - additive `MAPS_TO_SECTION` block;
   `lib/core/navigation/grant-rubric.cjs` - `writeGrantRubricGraph(db, rubric)` +
   `writeGradingSectionEdges(db, params)`; `navigation.cjs` re-exports both.
4. `commands/grade-grant.md` - room-mode Setup/Session Flow (mirrors `grade.md`'s
   read-all-populated-sections steps), roadmap step, decompose flow (D1 documented in the
   command body), Brain strategy step. Skill mirror regenerated, never hand-edited.
5. `tests/test-grade-grant.cjs` - extended in place, same `check()` harness, real room.db
   round-trips, no graph mocking.
6. Gates: build-connector-registry, build-orchestration-projection, build-command-registry,
   build-skill-mirrors, build-harness-manifest, build-render-coverage,
   check-shape-declaration --check (no NEW warning), edge-floor tests re-run.
7. CHANGELOG folded into the open `## [Unreleased] -- v1.16.0-beta.10` section.
8. NEW dated research-trail entry in `~/MindrianRooms/rethinking-mindrianos/research/`
   cross-linked to the 2026-08-05 entry + the new commits. No release cut, no version bump.

## Deliberately out of scope this pass

- Automated merge of a decomposed application room back into the venture room (D1).
- Per-criterion verdict->section edges (D2 collision rationale).
- Criteria for the 7 stub programs; the sector-specific tracks; the IIA PDFs.
- Any Brain-side (remote) schema change - Part 8 boundary byte-identical to before.
