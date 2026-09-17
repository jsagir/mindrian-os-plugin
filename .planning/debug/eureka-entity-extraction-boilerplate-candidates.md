---
status: investigating
kind: rca
trigger: "eureka-entity-extraction-boilerplate-candidates"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8, 9]
---

## Current Focus

Hypothesis CONFIRMED by the reporter's direct test (2026-09-17, DESCRIBES-edge provenance on
the axiom room) and the input-selection code read below. Root cause is in what
`scripts/entity-extract.cjs` feeds the extractor, not in the extractor's token heuristic and
not in the scorer or critic. Next step: `/gsd-debug eureka-entity-extraction-boilerplate-candidates`
to implement the changes under Required Code Changes, test-first on a fixture room.

## Meta

- Filed: 2026-09-17 by the Jev spike session, relaying jsagi-5e (Larry, working the `axiom` room) via jsagi-40.
- Source-of-Truth Preamble:
  - CODE claims read against: not yet read; relayed observation only. Re-verify against `origin/main` HEAD before any finding lands (tag `needs-source-reverify`).
  - WIRE claims probe against: local Eureka engine in embedded mode (MongoDB/mdbr-leaf-ir encoder, sqlite-vec backend) on plugin `2.0.0-beta.41` (reporter-confirmed 2026-09-17 via jsagi-40).
  - Date of audit: 2026-09-17.
  - Reporter's `status.json` (embedded run): `state: done`, `started_at: 2026-09-17T06:44:02.700Z`, `finished_at: 2026-09-17T06:44:40.766Z` (38 s for 176,871 scored pairs), `pid: 1706125`, `out: ~/MindrianRooms/axiom/.mindrian/eureka/portfolio-report.md`, `json: ~/MindrianRooms/axiom/.mindrian/eureka/portfolio-report.json`.
  - Reporter (jsagi-5e) offers `portfolio-report.json` and the reasoning-mode `pairs/mappings/answers.json` on request; ask for the top-25 entity rows with their source file paths first, since that is the direct test of the frontmatter/stub hypothesis.
- Classification: NEW FAILURE (not in the two 2026-09-17 mentor reports; adjacent to Spike 004, which tested the critic on clean packets and found the critic itself correct).

## Problem Statement

The Eureka engine's candidate-pair generation feeds the AHP scorer and the critic with
"entities" extracted from room markdown boilerplate (persona name, frontmatter status
words, literal strings from empty per-section BRAIN.md stubs) instead of the concepts in
the room's real artifacts, so every critiqued candidate fails `entity_nonspecific` or
`domain_swap_invariant` and the scan reports nothing on a room with real content.

## Symptoms

- Room `axiom`, 69 artifacts across 14 sections.
- Run 1 (reasoning mode, no local encoder): sampler pulled 1 entry per section (12 of 65
  artifacts); 7 of those were empty per-section BRAIN.md stubs. 1 of 25 candidate pairs had
  real content on both sides; it failed the transferability rubric.
- Run 2 (embedded mode after `/mos:eureka enable`): TRUE embedded mode confirmed, no
  degrade; 1013 graph nodes, 1208 typed edges, 176,871 pairs scored. Top "entities":
  "Larry", "Seeded", "Working", "Key Decision", "Five", "Current", "BRAIN". None of the 65
  real artifacts (named competitor analyses, buyer personas, a ratified decision node)
  reached the top 25. All 25 critiqued candidates failed `entity_nonspecific` or
  `domain_swap_invariant`. Weak-signal tail flagged `suspect_noise` (attention and growth
  scores collapsed to two repeated values across ~200 items).
- Reporter's files, room `axiom`: `.mindrian/eureka/portfolio-report.{json,md,html}`,
  `.mindrian/eureka/status.json` (embedded run); `.mindrian/eureka/reasoning/{pairs,mappings,answers}.json`
  (reasoning run). Write-up: `~/MindrianRooms/axiom/strategy/eureka-scan-outcome-2026-09-17.md`.

## Scope and Impact

- Surface: CLI (`/mos:eureka`), both reasoning and embedded modes.
- Impact: the engine produces zero usable candidates on a populated room; the critic and
  scorer spend their budget on noise. Every downstream Eureka artifact on such a room is
  empty or misleading.
- Not affected (per Spike 004, 2026-09-17): `criticRule` / `verdictFromRubric` on a
  well-formed packet.

## Eliminated

- Encoder / embedded-mode degrade: reporter confirmed true embedded mode, no degrade.
- Scoring math and critic: reporter's diagnosis and Spike 004 agree they ruled correctly on
  the input they were given.

## Evidence

- 2026-09-17: relayed observation (jsagi-5e via jsagi-40). Top-25 entity list and the
  all-fail critic outcome as listed under Symptoms. Not yet reproduced here.
- 2026-09-17 (direct test, jsagi-5e, room `axiom`, plugin 2.0.0-beta.41): `source_path` on
  every entity node is self-referential (`entity:entity-extract:{Name}`), so provenance was
  traced through DESCRIBES edges instead. Every top-ranked entity connects to 9-20 DIFFERENT
  ROOM.md / FEYNMAN.md / MINTO.md scaffold artifacts spread across nearly every section
  (business-model, competitive-analysis, financial-model, funding, legal-ip, market-analysis,
  opportunity-bank, problem-definition, solution-design, strategy, team-execution). The 11
  unique entities in the top-25 pairs, with DESCRIBES degree and source kinds: "Larry" (13,
  MINTO/ROOM), "Seeded" (20, FEYNMAN/MINTO), "Working" (13, MINTO/ROOM), "Key Decision"
  (12, MINTO/ROOM), "Five" (12, MINTO/ROOM), "Current" (12, FEYNMAN/ROOM), "BRAIN" (12,
  MINTO/ROOM), "First Proof" (9, MINTO/ROOM), "Available" (11, FEYNMAN), "Brain-gated" (11,
  FEYNMAN), "Recent" (11, FEYNMAN). Sample DESCRIBES targets for "Larry":
  `memory_artifact:_root:MINTO`, `memory_artifact:business-model:ROOM`,
  `memory_artifact:competitive-analysis:ROOM` (+10 more, one per section). Room-wide: 528
  `entity:entity-extract:*` nodes vs 65 real content artifacts (about 8x).
- 2026-09-17 (code read, this session, `origin/main` @ 417e07657): `scripts/entity-extract.cjs`
  lines 217-235 document the walk as (a) memory_artifact-backed files with kind in
  ROOM / STATE / MINTO / BRAIN / FEYNMAN plus (b) every other `.md` in a section directory;
  the scaffold kinds are INCLUDED as extraction inputs, not only as DESCRIBES anchors.
  `lib/core/eureka/entity-extractor.cjs` is a capitalized-term heuristic with STOPWORDS
  (line 52), a FRAMEWORK_TERMS stoplist, a "filename is never an entity" rule (line 196)
  and heading / code-block / table skips (lines 275-301); it carries no template-body
  vocabulary, so scaffold sentence words ("Seeded", "Working", "First Proof", "Brain-gated")
  pass. `lib/core/eureka/room-native-substrate.cjs` `sectionFor` (lines 129-152) drops any
  `source_path` containing ':' to 'unknown' BY DESIGN (system-authored rows), which is why
  the entity rows' self-referential `source_path` yields no section.

## Technical Root Cause

Three defects compound; the first is the cause, the other two amplify and hide it.

1. INPUT SELECTION (cause). Because `scripts/entity-extract.cjs` (walk documented at lines
   217-235, implemented from line ~283) feeds the ICM scaffold files (kinds ROOM, STATE,
   MINTO, BRAIN, FEYNMAN) to the extractor as content, and every section of a room carries
   a near-identical copy of each scaffold (Decision 15: every directory gets a ROOM.md; the
   FEYNMAN and MINTO stubs follow the same template), the same capitalized template words
   are extracted once per section and merged into one entity node with one DESCRIBES edge
   per section. Real artifacts (65 in axiom) mention their concepts in 1-2 files each.
2. DEGREE AMPLIFICATION (ranking). Because the candidate-pair sampler and the AHP scorer
   weight an entity by its graph neighborhood (DESCRIBES degree 9-20 for template words vs
   1-2 for content concepts), template entities occupy the entire top 25 and the
   attention / growth scores collapse to the two values a uniform stub profile produces
   (the reporter's `suspect_noise` tail).
3. PROVENANCE BLINDNESS (hiding). Because entity rows are minted with a self-referential
   `source_path` (`entity:entity-extract:{Name}`) and `room-native-substrate.cjs`
   `sectionFor` maps any ':'-bearing `source_path` to 'unknown' by design, no report can
   show WHERE an entity came from; the boilerplate origin was invisible until the reporter
   walked DESCRIBES edges by hand.

Not the cause: the extractor's token heuristic (it did what it does), the encoder, the
scorer math, the critic (Spike 004 and the reporter agree it ruled correctly on the input).

## Required Code Changes

Short-term patch (closes the symptom, one file):
- `scripts/entity-extract.cjs`, the artifact walk (lines ~283-310): scaffold kinds (ROOM,
  STATE, MINTO, BRAIN, FEYNMAN) remain DESCRIBES ANCHORS for their section but are
  EXCLUDED as extraction INPUTS. Only files under (b), the section's real `.md` artifacts,
  are read for entities. Count the exclusions and write them to `status.json` as
  `scaffold_files_skipped`.

Long-term fix (makes the class of bug impossible):
- `lib/core/eureka/entity-extractor.cjs`: add a TEMPLATE_VOCAB stoplist DERIVED at load
  time from the shipped scaffold templates (the same source the room scaffolder writes
  from), never hand-listed, so template sentence words cannot become entities from any
  file. Keep the existing STOPWORDS / FRAMEWORK_TERMS untouched.
- Entity minting in `scripts/entity-extract.cjs` (DESCRIBES write loop, lines ~854-880):
  set the entity row's `source_path` to the room-relative path of the FIRST artifact it
  was extracted from (a real path, no ':'), so `sectionFor` derives a section and reports
  can show origin. The DESCRIBES edges stay the full provenance.
- Ranking / sampler (`lib/core/eureka/eureka-portfolio-report.cjs` or wherever degree
  enters the AHP weights): cap or zero the degree contribution of DESCRIBES edges whose
  target artifact kind is a scaffold, so a residual template entity cannot outrank content.
- Diagnostics: `status.json` gains `entity_source_share: { content: n, scaffold: m }` and
  the report prints a WARN when `scaffold / (content + scaffold) > 0.5`.

Gates before done: Canon Part 8 (no change to what crosses to the Brain; all local), Tri-Polar
(the extractor runs identically on CLI, Desktop and Cowork), no em-dashes, reuse-before-build
(the stoplist derives from the existing scaffold templates; no new template source).

## Tests to Add or Update

- Fixture room: N=6 content artifacts across 3 sections plus the full scaffold set
  (ROOM / STATE / MINTO / BRAIN / FEYNMAN per section, byte-identical to the shipped
  templates). After `entity-extract run`: the top-K entity list contains zero tokens from
  the template vocabulary and at least one concept per content artifact; every entity
  row's `source_path` is a real room-relative path; `status.json.scaffold_files_skipped`
  equals the number of scaffold files.
- Extractor unit: feeding a bare shipped template yields an empty entity set (regression
  for the TEMPLATE_VOCAB derivation).
- Ranking unit: an entity with 20 scaffold-only DESCRIBES edges ranks below an entity with
  2 content DESCRIBES edges.
- Existing suites to keep green: the Eureka / 212 / 213 / 216 / 218 test families
  (`tests/run-all-212.sh`, `tests/test-213-sensor-eureka.cjs`, `tests/test-213-part8-boundary.cjs`).

## Non-Code Follow-ups

- Ask the reporter for the plugin version and for `status.json` so the Source-of-Truth
  Preamble can be completed.
- Cross-link this RCA from the `axiom` room write-up once resolved.

## Resolution

Open.
