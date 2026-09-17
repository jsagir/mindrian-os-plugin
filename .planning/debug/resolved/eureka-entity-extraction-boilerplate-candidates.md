---
status: resolved
kind: rca
trigger: "eureka-entity-extraction-boilerplate-candidates"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8, 9]
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "collectArtifacts() in scripts/entity-extract.cjs feeds the five per-directory
    scaffold kinds (ROOM/STATE/MINTO/BRAIN/FEYNMAN) to the tier-1 extractor as content
    (not just as DESCRIBES anchors); because every section carries a near-identical
    template copy of each, the same capitalized template words get extracted once per
    section and merged into one entity node whose DESCRIBES degree dwarfs real content
    (9-20 vs 1-2), so template words dominate ranking and the critic; and the entity
    node's source_path is minted self-referentially ('entity:sid:name') in
    lib/core/navigation/typed-entity.cjs, so no report can show the boilerplate origin
    without a hand walk of DESCRIBES edges."
  confirming_evidence:
    - "Reporter's direct test on the axiom room: all 11 unique top-25 entities trace via
      DESCRIBES to 9-20 different ROOM.md/FEYNMAN.md/MINTO.md scaffold artifacts spread
      across nearly every section; 528 entity:entity-extract:* nodes vs 65 real content
      artifacts (~8x)."
    - "Code read (this session) of scripts/entity-extract.cjs collectArtifacts: tier (a)
      reads every memory_artifact-backed file including kind ROOM/STATE/MINTO/BRAIN/
      FEYNMAN with no kind-based exclusion (confirmed unchanged at HEAD 9f1b77181)."
    - "Code read of lib/core/navigation/typed-entity.cjs writeEntityNode line 135:
      sourcePath hardcoded to 'entity:'+sid+':'+name, no override param existed; matches
      the reporter's observed self-referential source_path exactly."
  falsification_test: "If, after excluding scaffold-kind files from extraction input on a
    fixture room, template vocabulary (Seeded/Working/Current/etc.) still appears as a
    written entity node, the hypothesis is wrong (some other path still feeds scaffold
    text to the extractor). If entity source_path is still self-referential after the
    typed-entity.cjs param threading, the source_path half is wrong."
  fix_rationale: "Excluding scaffold-kind files as extraction input (while keeping them as
    DESCRIBES anchors) removes the ROOT CAUSE (repeated same-template-word extraction
    across sections), not merely a symptom -- it eliminates the degree amplification at
    its source rather than post-hoc capping it. The source_path fix threads the real
    artifact path through the existing navigation chokepoint (typed-entity.cjs) rather
    than duplicating the write logic in entity-extract.cjs, honoring Part 7/9 (single
    write chokepoint, no raw INSERT)."
  blind_spots: "Have NOT implemented the ranking/degree-cap step (eureka-portfolio-
    report.cjs) or the TEMPLATE_VOCAB stoplist in entity-extractor.cjs this pass --
    deferred as defense-in-depth/long-term since the input-selection fix removes the
    degree-amplification mechanism at its source for this specific symptom. Have NOT
    yet run the full test suite to confirm zero regressions (next action)."

Hypothesis CONFIRMED by the reporter's direct test (2026-09-17, DESCRIBES-edge provenance on
the axiom room) and the input-selection code read below. Root cause is in what
`scripts/entity-extract.cjs` feeds the extractor, not in the extractor's token heuristic and
not in the scorer or critic.

next_action: RESOLVED 2026-09-17. Human verification CONFIRMED FIXED (copy-run on a scratchpad
copy of `axiom`, see Evidence) for the three original checks, then the additive-only gap
(528 legacy self-referential rows persisting on an already-scanned room) was closed by a
navigator-approved purge, implemented directly in the orchestrator session (test-first) after
the session-manager's own delegation attempt was blocked by the Claude Code auto-mode classifier
("Irreversible Local Destruction") -- see Evidence. All four commits (`7b092fcd4`, `f33330c53`,
`06430c4e5`, `f48f5ed94`) are on main and green. See Resolution for the full closure record.

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

- 2026-09-17 (this session, code-vs-RCA contradiction #1): `origin/main @ 417e07657`
  is an ancestor of HEAD (`9f1b77181`) and no commit between them touched
  `scripts/entity-extract.cjs`, `lib/core/eureka/room-native-substrate.cjs`, or
  `lib/core/eureka/entity-extractor.cjs`, so the RCA's code-read evidence against those
  three files is still accurate at HEAD. HOWEVER the RCA's Required Code Changes names
  `lib/core/eureka/eureka-portfolio-report.cjs` for the ranking/degree-cap step; that
  path does not exist. The real file is `scripts/eureka-portfolio-report.cjs` (confirmed
  via `find`; also the module `room-native-substrate.cjs`'s own `sectionFor` comment
  cites "eureka-portfolio-report.cjs techFor and loadGraph" without a `lib/core/eureka/`
  prefix). Adjusted plan: any ranking-cap work, if attempted, targets
  `scripts/eureka-portfolio-report.cjs`.
- 2026-09-17 (contradiction #2, source_path minting site): the RCA's Required Code
  Changes says the source_path fix belongs in "Entity minting in
  `scripts/entity-extract.cjs` (DESCRIBES write loop, lines ~854-880)". Traced the
  actual write path: `scripts/entity-extract.cjs`'s step-1 loop calls
  `navigation.writeEntityNode(db, {...})`, which is a re-export
  (`lib/core/navigation.cjs:359`) of `writeEntityNode` in
  `lib/core/navigation/typed-entity.cjs`. THAT function (line 135, pre-fix) hardcodes
  `const sourcePath = 'entity:' + sid + ':' + name;` with no caller-supplied override
  in its params contract -- this is the actual origin of the self-referential
  `entity:entity-extract:{Name}` source_path the reporter traced by hand. The
  entity-extract.cjs "DESCRIBES write loop" (step 2, edges) never touches source_path
  at all; it only writes DESCRIBES edges. Also confirmed via `node-insert.cjs`'s
  `insertNode`: `ON CONFLICT(id) DO UPDATE SET type=excluded.type,
  properties=excluded.properties, last_seen_at=excluded.last_seen_at` -- source_path is
  NEVER in the UPDATE SET list, so it is fixed at first-insert time only and cannot be
  patched after the fact by a second insertNode call from entity-extract.cjs alone.
  Adjusted plan: `writeEntityNode` (`lib/core/navigation/typed-entity.cjs`) gains an
  additive optional `sourcePath` param (falls back to the prior self-referential
  default when absent or when it contains ':'); `entity-extract.cjs` tags each
  candidate with `e.sourceRelPath = art.relPath` at extraction time and passes it as
  `sourcePath` in the step-1 write loop. This touches one file
  (`lib/core/navigation/typed-entity.cjs`) outside the dispatch's originally-listed
  file scope; noted here per the dispatch's own instruction to record and adjust
  rather than silently diverge. `typed-entity.cjs` is the allow-listed chokepoint
  entity-extract.cjs already routes every entity write through (Canon Part 7/9); no
  new write surface, no raw INSERT, no navigation bypass.
- 2026-09-17 (contradiction #3 / refinement, scaffold-exclusion discriminator): the
  RCA's short-term patch says exclude "scaffold kinds (ROOM, STATE, MINTO, BRAIN,
  FEYNMAN)" by `kind` alone. Traced `lib/core/navigation/memory-artifacts.cjs`
  (`MEMORY_ARTIFACT_NODE_ID(section, kind)` mints `memory_artifact:<section>:<kind>`,
  one node per (section, kind)) and the ONLY production writer of these five kinds,
  `lib/core/memory/reconcile-memory-runner.cjs`'s `BASENAME_TO_KIND`
  (`{'ROOM.md':'ROOM', 'STATE.md':'STATE', ...}`, exact-basename match): in a real
  room `kind` and basename always agree. But three EXISTING tests
  (`tests/test-219-metadata.cjs`, `tests/test-219-low-confidence-disclosure.cjs`)
  seed synthetic memory_artifact nodes with `kind: 'ROOM'` on arbitrary non-ROOM.md
  paths (`analysis/brief.md`, `notes/plain.md`, `weird/list.md`) specifically to
  exercise the frontmatter-merge and WHY-classifier pipeline over real prose content
  -- NOT to model an actual scaffold file. Excluding by `kind` alone would silently
  stop reading those fixtures' content and regress both tests (test-219-metadata.cjs
  Test 2's "Hexcel" disclosure assertion in particular). Adjusted plan: the exclusion
  gate requires BOTH `kind` in the scaffold set AND `path.basename(rel)` equal to
  that kind's exact scaffold basename (mirrors BASENAME_TO_KIND exactly, Canon Part 7
  reuse). Verified this reclassification leaves all three fixtures' assertions
  intact (none of their seeded paths match their kind's required basename) while
  still excluding the RCA's real target (a literal ROOM.md/STATE.md/MINTO.md/
  BRAIN.md/FEYNMAN.md file registered under its matching kind).
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
- 2026-09-17 copy-run of scripts/entity-extract.cjs on a scratchpad copy of the axiom room:
  BEFORE 528 entity nodes, 528 with self-referential source_path; run read 44 artifacts,
  status.json scaffold_files_skipped=42 (14 sections x ROOM/FEYNMAN/MINTO), wrote 5 entities /
  5 DESCRIBES edges, all 5 with real room-relative source_path
  (competitive-analysis/tactile-mobility-business-model-deep-dive-2026-09...,
  problem-definition/working-problem-statement-and-hypotheses.md,
  solution-design/evidence-inventory-2026-09-17.md), names Nexteer Automotive / Doron Livnat /
  Working Problem Statement / Chemothal / FMCSA, zero of the eleven template tokens. AFTER 533
  entity nodes: the run is additive and the 528 legacy rows persist. (Human verification,
  performed by the orchestrator on a copy of ~/MindrianRooms/axiom in the scratchpad, real room
  untouched, dev tree at 7b092fcd4/f33330c53 -- CONFIRMED FIXED for the three original checks.)
- 2026-09-17 (new requirement, navigator-approved, card answer "Purge in the extractor run"):
  the 528 legacy rows persisting means the fix is additive, not corrective, on an already-run
  room. entity-extract `run` must also purge legacy machine-authored entity rows matching the
  exact signature (node id LIKE 'entity:%' AND source_path LIKE 'entity:%') together with their
  DESCRIBES edges, once per run, reporting `legacy_entities_purged` in status.json. The
  session-manager's attempt to delegate this (an irreversible local DB deletion) to a
  continuation debugger agent was blocked by the Claude Code auto-mode classifier
  ("Irreversible Local Destruction") and required explicit user permission before an agent could
  implement and run it.
- 2026-09-17 (purge implemented, unblocked by the navigator): implemented directly in the
  orchestrator session under explicit human choice ("I implement it here, test-first"), so no
  re-delegation was needed. Commits on main: `06430c4e5` test(eureka): pin the legacy
  self-referential entity purge on extractor run (RED); `f48f5ed94` fix(eureka): purge legacy
  self-referential entity rows on extractor run. What shipped:
  `lib/core/navigation/typed-entity.cjs` gained `purgeLegacySelfReferentialEntities(db)`
  (signature `id LIKE 'entity:%' AND source_path LIKE 'entity:%' AND type IN` the entity enum
  `AND review_status NOT 'confirmed'`; per-id prepared deletes of the node and every edge
  touching it, inside one transaction, fixed SQL text), re-exported through
  `lib/core/navigation.cjs`; `scripts/entity-extract.cjs` `runExtraction` calls it before any
  write, threads `legacyEntitiesPurged` / `legacyEdgesPurged` into the result and status.json
  (`legacy_entities_purged`, `legacy_edges_purged`), and logs a best-effort
  `legacy_entity_purge` memory event through `navigation.logMemoryEvent`.
  `tests/test-eureka-scaffold-entity-noise.cjs` Leg 4 seeds 3 legacy rows + edges, a real-path
  survivor, and a human-confirmed survivor; RED against `f33330c53`
  (`legacy_entities_purged` undefined), GREEN after. Tallies: noise test 4/4; run-all-212 6/6;
  test-213-sensor-eureka 11/11; test-213-part8-boundary 6/6; test-216-field-contract 11
  assertions; test-216-room-substrate 47; run-all-218 PASS=10 FAIL=9 (all nine the
  pre-existing `insertNode: invalid epistemic_type "undefined"` fixture drift, unchanged from
  before this session -- see Non-Code Follow-ups ENV GAP). Substrate check clean, no em-dashes.

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
- Ranking / sampler (`scripts/eureka-portfolio-report.cjs` -- corrected path, see Evidence
  contradiction #1; not `lib/core/eureka/eureka-portfolio-report.cjs`, which does not exist --
  or wherever degree enters the AHP weights): cap or zero the degree contribution of DESCRIBES
  edges whose target artifact kind is a scaffold, so a residual template entity cannot outrank
  content.
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
- DEFERRED (not implemented this pass, see Resolution) as defense-in-depth / SEED candidates,
  not required to close this symptom: the TEMPLATE_VOCAB stoplist in
  `lib/core/eureka/entity-extractor.cjs` and the DESCRIBES-degree cap in
  `scripts/eureka-portfolio-report.cjs` (Required Code Changes "Long-term fix" items 1 and
  3). The input-selection fix (Required Code Changes "Short-term patch") already removes the
  root-cause mechanism (repeated same-template-word extraction across sections) that produces
  the degree amplification, so these two items are defense-in-depth for a DIFFERENT future
  path into the same class of bug (e.g. a scaffold word that also happens to be genuine
  cross-section content), not required to close THIS symptom. File as SEED candidates; re-open
  if a future report shows scaffold-adjacent noise through a path the input-selection fix does
  not cover.
- ENV GAP discovered during verification (unrelated to this RCA, NOT fixed here -- out of
  file-scope and out of symptom-scope): `lib/core/node-insert.cjs`'s R17-02 change
  (commit `1efca00bd`, 2026-09-03, "260903-gdm Task 5") made `opts.epistemic_type` a
  REQUIRED, no-default param on `insertNode`. At least 9 test files under the 218 family and
  2 under the 219 family predate that commit (last touched 2026-07-12 through 2026-07-19) and
  call `insertNode` directly with only `{source_path, created_by}`, so they now throw
  `insertNode: invalid epistemic_type "undefined"` before ever reaching the assertions they
  were written to check: `tests/test-218-entity-writer.cjs` (Test 7 only; Tests 1-6, which
  exercise `writeEntityNode` directly, pass clean), `tests/test-218-what-why-classifier.cjs`,
  `tests/test-218-cohort-stratification.cjs`, `tests/test-218-extend-to-artifacts.cjs`,
  `tests/test-218-eureka-auto-extract.cjs`, `tests/test-218-noise-reduction.cjs`,
  `tests/test-218-scaffold-pair-filter.cjs`, `tests/test-218-low-trust-exclusion.cjs`,
  `tests/test-218-duplicate-entity-reconciliation.cjs`, `tests/test-219-metadata.cjs`,
  `tests/test-219-low-confidence-disclosure.cjs`, and (219-01 banking family, different
  subsystem, same root cause) `tests/test-219-banking.cjs`. Verified via `git stash` (stashing
  only this session's two changed files) that this EXACT failure set reproduces identically
  with this session's fix absent, and `git diff --stat lib/core/node-insert.cjs` shows zero
  changes from this session -- confirming the gap predates and is fully independent of this
  RCA. Recommend a follow-up `/gsd-quick` or `/gsd-debug` pass to add
  `epistemic_type: 'observation'` (the value `entity-extract.cjs`'s own
  `existingOrDefaultEpistemicType()` already uses for this class of system-bookkeeping node) to
  each affected fixture's `insertNode` call.

## Resolution

root_cause: Three compounding defects, all confirmed against `origin/main`/HEAD source and the
reporter's live evidence (see Technical Root Cause above for full detail): (1) INPUT SELECTION
-- `scripts/entity-extract.cjs`'s `collectArtifacts()` fed the five per-directory scaffold
kinds (ROOM/STATE/MINTO/BRAIN/FEYNMAN) to the tier-1 extractor as content, not just as
DESCRIBES anchors, so the same template words were re-extracted once per section (Decision 15:
every directory gets a near-identical scaffold copy); (2) DEGREE AMPLIFICATION -- the repeated
per-section extraction gave template-word entity nodes DESCRIBES degree 9-20 vs 1-2 for real
content, dominating ranking; (3) PROVENANCE BLINDNESS -- `lib/core/navigation/typed-entity.cjs`
`writeEntityNode` hardcoded every entity's `source_path` to a self-referential
`entity:{sessionId}:{name}` handle (not `scripts/entity-extract.cjs`'s DESCRIBES write loop as
originally suspected in Required Code Changes -- see Evidence contradiction #2), which
`room-native-substrate.cjs`'s `sectionFor` maps to 'unknown' by design, hiding the boilerplate
origin from every report. A fourth, downstream consequence surfaced only during human
verification: because the input-selection fix is additive (it changes what future runs write,
not what past runs already wrote), any room already scanned before the fix keeps its legacy
machine-authored entity rows forever unless something purges them -- confirmed on a scratchpad
copy of the reporter's `axiom` room (528 legacy rows persisted after a post-fix re-run that
correctly wrote only 5 new, real-sourced entities).

fix: (1) `scripts/entity-extract.cjs` `collectArtifacts()`: a memory_artifact row is now
excluded as extraction input when BOTH its `kind` is one of ROOM/STATE/MINTO/BRAIN/FEYNMAN AND
`path.basename(rel)` matches that kind's exact scaffold basename (never `kind` alone -- see
Evidence contradiction #3: this protects existing test fixtures that tag `kind:'ROOM'` on a
non-ROOM.md path for unrelated frontmatter-merge testing). Excluded files stay valid DESCRIBES
anchors (`sectionAnchor` unchanged) and are still marked `coveredPaths` (never re-read via tier
b). The exclusion count is returned additively (`artifacts.scaffoldFilesSkipped`) and threaded
through `runExtraction` to `status.json.scaffold_files_skipped`, never silently. (2)
`lib/core/navigation/typed-entity.cjs` `writeEntityNode()`: gained an additive optional
`sourcePath` param (a real room-relative path, no ':') that overrides the prior synthetic
handle; falls back to the old self-referential default when absent or when it contains ':'.
`scripts/entity-extract.cjs` now tags each extracted candidate with `e.sourceRelPath =
art.relPath` at extraction time and passes it through in the step-1 entity-write loop; because
`insertNode`'s `ON CONFLICT DO UPDATE` never touches `source_path`, this lands the FIRST
artifact's real path on first write, exactly matching the RCA's contract, and is stable against
later re-writes of the same (sessionId, name). (3) Purge (navigator-approved, added after human
verification exposed the additive-only gap): `lib/core/navigation/typed-entity.cjs` gained
`purgeLegacySelfReferentialEntities(db)` -- signature `id LIKE 'entity:%' AND source_path LIKE
'entity:%' AND type IN` the entity enum `AND review_status NOT 'confirmed'`; per-id prepared
deletes of the node and every edge touching it, inside one transaction, fixed SQL text (never
raw SQL outside `lib/core`) -- re-exported through `lib/core/navigation.cjs` (the single door,
Canon Part 7/9). `scripts/entity-extract.cjs` `runExtraction` calls it before any write, threads
`legacyEntitiesPurged` / `legacyEdgesPurged` into the result and `status.json`
(`legacy_entities_purged`, `legacy_edges_purged`), and logs a best-effort `legacy_entity_purge`
memory event via `navigation.logMemoryEvent`. A row with a real `source_path` or a
human-confirmed `review_status` is never touched (Canon Part 9: only a human closes a confirmed
node). DEFERRED this pass (see Non-Code Follow-ups), filed as SEED candidates: the
TEMPLATE_VOCAB stoplist and the DESCRIBES-degree ranking cap (Required Code Changes "Long-term
fix" items 1 and 3) -- the input-selection fix already removes the degree-amplification
mechanism at its source for this symptom.

verification: New hermetic fixture-room test `tests/test-eureka-scaffold-entity-noise.cjs`
(3 sections x [5 scaffold files + 2 content files], the full scaffold set + 6 real-content
concepts, matching the RCA's Tests-to-Add spec) proven RED-then-GREEN via `git stash` (stashed
only this session's 2 changed files, confirmed the test fails in the exact predicted way --
`scaffoldFilesSkipped` undefined -- then confirmed all 3 legs green after `git stash pop`).
Registered in `tests/run-all-218.sh`. Full-suite regression check (`git stash`/`pop` used again
to produce a definitive before/after diff): `bash tests/run-all-212.sh` (6/6 PASS),
`node tests/test-213-sensor-eureka.cjs` (11/11 PASS), `node tests/test-213-part8-boundary.cjs`
(6/6 PASS), `node tests/test-216-field-contract.cjs` (11/11 PASS),
`node tests/test-216-room-substrate.cjs` (47/47 PASS), `bash tests/run-all-218.sh` (10 PASS
including the new test, 9 PASS-before-this-fix-too failures all confirmed pre-existing/
unrelated -- see Non-Code Follow-ups ENV GAP entry), `bash tests/run-all-219.sh` (same pattern,
2 additional pre-existing failures in the same ENV GAP family). `node scripts/check-substrate.cjs
--diff` clean. Confirmed zero other production callers of `writeEntityNode` exist besides
`scripts/entity-extract.cjs` (`grep -rln writeEntityNode lib/ scripts/`), so the additive
`sourcePath` param changes no other call site's behavior; `tests/test-218-entity-writer.cjs`
Tests 1-6 (direct `writeEntityNode` exercises) pass clean, confirming the signature change
itself is non-regressive independent of the unrelated Test 7 ENV GAP. Checked
`scripts/eureka-portfolio-report.cjs`'s two `source_path` consumers (`catalogId`,
`deriveBankSection`): both degrade safely and `deriveBankSection` specifically gains a
beneficial capability (can now derive a real section for an entity-sourced opportunity instead
of always falling through to 'unknown') with no existing test asserting the old blind
behavior.

Human verification (2026-09-17, orchestrator, copy-run of `scripts/entity-extract.cjs` on a
scratchpad copy of the reporter's `axiom` room, real room untouched, dev tree at
`7b092fcd4`/`f33330c53`): BEFORE 528 entity nodes, all 528 with self-referential source_path;
run read 44 artifacts, `status.json.scaffold_files_skipped=42` (14 sections x
ROOM/FEYNMAN/MINTO), wrote 5 entities / 5 DESCRIBES edges, all 5 with real room-relative
source_path (`competitive-analysis/tactile-mobility-business-model-deep-dive-2026-09...`,
`problem-definition/working-problem-statement-and-hypotheses.md`,
`solution-design/evidence-inventory-2026-09-17.md`), names Nexteer Automotive / Doron Livnat /
Working Problem Statement / Chemothal / FMCSA, zero of the eleven template tokens. AFTER 533
entity nodes: confirmed the fix is additive and the 528 legacy rows persist on an already-run
room -- CONFIRMED FIXED for the three original checks, and the trigger for the navigator-approved
purge requirement below.

Purge verification (`06430c4e5` RED / `f48f5ed94` GREEN, implemented directly in the orchestrator
session, test-first): `tests/test-eureka-scaffold-entity-noise.cjs` Leg 4 seeds 3 legacy rows +
DESCRIBES edges, one real-path survivor, one human-confirmed survivor; RED against `f33330c53`
(`legacy_entities_purged` undefined, rows persist), GREEN after (rows and edges gone, both
survivors untouched, `status.json.legacy_entities_purged === 3`). Full tallies post-purge: noise
test 4/4; `bash tests/run-all-212.sh` 6/6; `node tests/test-213-sensor-eureka.cjs` 11/11;
`node tests/test-213-part8-boundary.cjs` 6/6; `node tests/test-216-field-contract.cjs` 11
assertions; `node tests/test-216-room-substrate.cjs` 47; `bash tests/run-all-218.sh` PASS=10
FAIL=9 (all nine the pre-existing `insertNode: invalid epistemic_type "undefined"` fixture
drift documented in Non-Code Follow-ups, unchanged by this session's work).
`node scripts/check-substrate.cjs --diff` clean. No em-dashes. Zero regressions beyond the
already-documented, pre-existing, out-of-scope ENV GAP.

files_changed:
  - scripts/entity-extract.cjs
  - lib/core/navigation/typed-entity.cjs
  - lib/core/navigation.cjs
  - tests/test-eureka-scaffold-entity-noise.cjs (new, extended with purge Leg 4)
  - tests/run-all-218.sh
  - .planning/debug/eureka-entity-extraction-boilerplate-candidates.md

commits:
  - 7b092fcd4 fix(eureka): exclude scaffold-kind files from entity extraction, mint real entity source_path
  - f33330c53 test(eureka): add scaffold entity-noise fixture-room regression test
  - 06430c4e5 test(eureka): pin the legacy self-referential entity purge on extractor run (RED)
  - f48f5ed94 fix(eureka): purge legacy self-referential entity rows on extractor run
