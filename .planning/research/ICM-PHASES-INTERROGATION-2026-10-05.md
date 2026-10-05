# ICM phases interrogation - 2026-10-05

Read-only audit of the plugin tree at branch main. Nothing was sent to any remote service. "Inferred" marks my own reading.

## 1. Executive summary

1. A Data Room is a folder tree. The folder IS the architecture (decisions.md:2, :10).
2. It started as ROOM.md in every folder (Phase 1, 2026-03-20) and grew by accretion, not by one design.
3. Five bends shaped it: KuzuDB to SQLite, the Obsidian nested folders, a central room registry, born-wired sub-rooms, and the 353 self-locating section rulings.
4. The newest layer (353) makes every section carry a ruling document and every folder know where it sits.
5. The code mostly follows the doctrine. It breaks it in ten places (section 5).
6. The biggest: three different statements of what "Layer 0" means, and a sub-room wiring contract that no production path calls.
7. A room carries no ask/tell posture. That lives in the user's home folder.
8. The JTBD layer has two job lists that disagree (13 versus 20 jobs).
9. The Theo-scored section ledger is a seed, not yet scored (353-VERIFICATION.md:4, :14-15).
10. Ten decisions wait for the navigator (section 7).

## 2. The ICM thesis as implemented

Doctrine: Canon Appendix B (MINDRIAN-CANON.md:760-770) and Part 9 (:326). Layer 0 to 4 in a room, as built:

| Layer | Real file (room / plugin) | One job |
|---|---|---|
| L0 identity | `ROOM.md` in root, sections, structural dirs, sub-rooms (templates/room-skeleton/ROOM.md.*.tmpl); `icm_self` block derived from `.mindrian/room-map.json` (room-map.cjs:5-12) | Say what this folder is and where it sits |
| L0 state | `STATE.md`, `USER.md` (scaffold:711-748); fleet `CLAUDE.md` (templates/icm/CLAUDE.md) | Stage and person; fleet identity |
| L1 routing | `statement:` field in section ROOM.md (ROOM.md.section.tmpl:3); fleet `INDEX.md`; `.rooms/registry.json` | One sentence per section; which room to open |
| L2 contract | per-section `CONTEXT.md`, six-part ruling (scaffold:415, :478) | What the section reads, does, writes, and its human check |
| L3 reference | `references/SECTION-SCHEMA.md`, `SUB-SCHEMAS.md`, `canon-translations.md` (scaffold:57; canon-translations.cjs:37) | Stable rules, read every run |
| L4 artifacts | `section/name/name.md` (decisions.md:20); `MINTO.md`, `FEYNMAN.md`, `BRAIN.md`, `DRIFT.md` | The work product and its reasoning |
| Graph | `.mindrian/room.db` (room-db.cjs:256-257); write chokepoints node-insert.cjs:202 and edges.cjs; read chokepoint navigation.cjs (navigation/CONTEXT.md:9-13) | Remember and navigate; humans confirm truth |
| Plugin side | section-registry.cjs, room-skeleton-scaffold.cjs, room-birth.cjs, room-map.cjs, folder-memory.cjs, `data/icm-parts.json` | Factory that builds and reads rooms |

## 3. Chronology of ICM phases

JTBD: "none" means no JTBD statement found in roadmap, CONTEXT, PLAN or SUMMARY. Dates are CONTEXT "gathered", milestone ship, or first git add.

| Phase, date | JTBD (verbatim or inferred) | Reasoning and decisions | Shipped | Structural change |
|---|---|---|---|---|
| 1 Install and Larry Talks, 2026-03-20 | None. Inferred: when I start a venture, give me a room that already knows its parts. | "Folder structure follows ICM nested folder tree"; arbitrary depth from day one (01-CONTEXT.md) | 8 sections, ROOM.md per room | ROOM.md becomes L0 |
| 56-59.2 (v1.8.6), 2026-04-06 | None; goal: "ICM Layer 0/1 auto-generated, INDEX.md stays current" (v1.8.6-ROADMAP.md:22). Inferred: find the right room fast. | Central `~/MindrianRooms`, registry first, filesystem stays truth (59.2 D-03) | scripts/room-registry, scripts/resolve-room (bash plus inline python3), templates/icm/ | Fleet L0/L1; registry |
| 1.9.2 backlog + Decision 15, 2026-04-09 | None; origin "User directive 2026-04-09" (v1.9.2-ICM-LAYER0-BACKLOG.md:5). Inferred: nothing misfiled. | "Folders without identity cause misfiling" (decisions.md:19); sub-rooms were invisible to the graph | ROOM.md mandate in room-passive skill | ROOM.md in every dir |
| 77, 79 SQLite, 2026-04-10 | None. Inferred: keep a graph that survives a dead dependency. | KuzuDB "abandoned Oct 2025"; plain nodes+edges tables (77-CONTEXT.md) | room.db, lazygraph-ops rewrite | Graph path `.mindrian/room.db` |
| 1.9.7 Obsidian rule, 2026-04-12; 80 vault import, 2026-04-13 | None. Inferred: open the room in Obsidian with working graph view. | Decision 16: "the folder IS the artifact" | CHANGELOG.md:5580; lib/import/manifest.cjs | `section/name/name.md` |
| 81, 88 Feynman-MINTO memory triple, 2026-04-13 to 2026-05-01 | None. Inferred: reasoning stays current without me asking. | One read contract for ROOM+STATE+MINTO | folder-memory.cjs, minto-debouncer, recompile-room-references.cjs | L4 reasoning files |
| 100-104 JTBD, 2026-04-30 | None. Inferred: Larry reasons against the job I am doing now. | Heuristic classifier, no LLM | lib/hmi/jtbd-taxonomy.json, `.mindrian/jtbd-state.json`, `serves_jtbd` on commands | JTBD layer |
| 108, 109 reconcile + SQL spine, 2026-05-03 | None. Inferred: one vocabulary of node and edge types. | Canon Part 9 five roles | schema aliases, navigation spine | Graph doctrine |
| 119 room as receipt, 2026-05-05; 155 birth keystone, 2026-06-12 | None. | Rooms are receipts (Canon Part 10 sub-claim 3) | room-skeleton-scaffold.cjs, room-birth.cjs | Skeleton template, 7-step birth |
| 128.1 / 194 session binding, 2026-05-20 / 2026-07-01 | None. | Session-scoped active room | session room resolver | Self-location by session |
| 169 graph derivation, 2026-06-19 | None. | Mint NESTED_WITHIN (Canon amendment 23) | lineage edge | Sub-room lineage in graph |
| 195 fractal memory, 2026-07-01 | None. Inferred: sub-rooms are born wired, never orphaned. | Folds SEED-022 and SEED-001; human approval before mkdir; seventh memory kind DRIFT.md | room-birth.cjs:313-346 | Born-wired sub-rooms |
| 273 chokepoint hardening, about 2026-09-01 | None. | Review found 5 critical issues in the write path | edges.cjs fixes | Graph trust |
| 275 enlarge schema by layer, 2026-09-04 | None. Inferred: a stranger can open any section and know its job. | D-01 sections 8 to 11; L1 statement, L2 CONTEXT.md, L3 references/ | scaffold, 11 section contracts, SECTION-SCHEMA.md | L1-L3 built for real |
| 343-348, 2026-09-14 to 09-16 | Navigator intent is the goal anchor (345 goal text). | Audit node, layer contract, strategy node | ICM-NESTED-PART-CONTRACT.md, data/icm-parts.json | Named parts, measured |
| 353 section ruling, 2026-09-17 | "each ICM section has a system of ruling, and writing, that is rooted in Theo and in the JTBD of that section." (ROADMAP.md:942) | D-353-2 room-map is the single home; D-353-5 sub-room declares job; D-353-7 ruling is the L2 CONTEXT.md | room-map.cjs, jtbd-anchor.cjs, section-command-ledger.json | Self-location and rulings |
| 363, 363.1, 2026-09-29 | "the initial intent of it was building it as a deep research planner. deep and quick runs." (ROADMAP.md:1388) | D-12 run home is top-level `research/` | research-planner/, scaffold-as-content fixes | New non-section folder |
| 366, 2026-10-01 | "JTBD can help as the layer that explains the navigator's intent. the intent and context must lead not just names" (366-CONTEXT.md D-13) | D-14 `references/canon-translations.md` | canon-translations.cjs | Writable L3 file |
| 367, 2026-10-01 | "we need to run graph health checks every couple of turns" (ROADMAP.md:1614) | Newborn room must have a connected graph | integrity organ extended | Graph repair |
| 369, 2026-10-02 | "the ui worth sacrificing the CJS-only hard rule !" | Room read only via MCP; SQLite stays canonical (Phase 329) | UI shell | Fourth surface |

## 4. The logic chain

The room began as a tree of folders with an identity file in each (Phase 1). The registry (56-59.2) answered "which room" because a tree of rooms needs a map. Decision 15 closed the next hole: a folder with no identity gets misfiled. The first graph used KuzuDB; it was abandoned upstream, so Phases 77 and 79 moved it to SQLite at `.mindrian/room.db`. That is bend one.

Bend two is Decision 16 (v1.9.7): the artifact became a folder. This made Obsidian work but broke every walker that counted `.md` files directly under a section. section-registry.cjs:110-135 now descends one level to cope.

Phases 81 to 88 added reasoning files. Phases 100 to 104 added JTBD. Phases 108 and 109 wrote the doctrine (Part 9) that files keep meaning and SQL navigates. Phases 119 and 155 then automated birth. Phase 195 is bend three: sub-rooms must be born wired or not at all.

Phase 275 is the first time L1 to L3 were built as files. Phases 343 to 348 then named and measured them. Phase 353 is bend four: it made the folder answer "where am I" from one map file, and made the section's CONTEXT.md a Theo-rooted ruling. It follows 275 because it generates into 275's contract file.

Bend five is the research planner. Phases 363 and 366 read the room only through the navigation door and the section registry (eureka-recall.cjs:51-52, :549), but they also write: a top-level `research/` folder and an L3 translation file. The reader became a writer.

## 5. Where the code contradicts the doctrine

1. **Three L0s.** Canon Appendix B says L0 is "Who the navigator is right now" (MINDRIAN-CANON.md:764). Templates stamp `icm_layer: 0` on a directory identity file (ROOM.md.identity.tmpl:3). The fleet file maps L2 to STATE.md (templates/icm/CLAUDE.md:13-17). The Appendix B note admits L0 and L4 got no citation (:770).
2. **L1 stored in an L0 file.** The L1 statement sits in a file marked layer 0 (ROOM.md.section.tmpl:3, :9).
3. **"Every directory" is not enforced.** Decision 15 says no exceptions (decisions.md:19). The map blocks and the doctor check only four kinds (room-map.cjs:13; room-map-module.cjs:17).
4. **STATE.md is half generated.** Birth says "NEVER authored" (room-birth.cjs:26). The scaffold preserves human-authored STATE.md (scaffold:168-176) and the template holds authored keys (STATE.md.tmpl:3-4).
5. **`research/` is neither section nor structural.** It is written with a ROOM.md (semantic-index/research-filing.cjs:202-208; perspective.cjs:175; url-ingest.cjs:506). STRUCTURAL_DIRS lists three names (section-registry.cjs:44), so discoverSections treats it as an extended section (:70-135, inferred). The recall module keeps its own exclusion list (eureka-recall.cjs:113).
6. **Born-wired sub-rooms are test-only.** The wiring gate runs only when `bornWired === true` (room-birth.cjs:861). The one production sub-room birth does not pass it (graph-self-heal.cjs:212), and a grep finds no non-test caller. The room-passive skill tells Larry to hand-make ROOM.md (SKILL.md:70).
7. **Two job lists.** The classifier has 13 entries (lib/hmi/jtbd-taxonomy.json). Section jobs have 20 (section-registry.cjs:304). Seven jobs can never be classified: build, design-solution, model-business, model-finances, navigate, protect-assets, temporal-correction (read-only run, 2026-10-05).
8. **Active room has many authorities.** Registry field, env var, session binding, cwd hook, python resolver (resolve-active-room.cjs:6, :17-18; on-cwd-changed:2-3; resolve-room). That is not "one home per fact".
9. **No posture in the room.** The ask/tell stance lives in the user home (stance-state.cjs:3, :65-69). The room carries none.
10. **Factory dir is written at run time.** L3 is "read every run, edited rarely" (SECTION-SCHEMA.md:4), yet canon-translations.md is created and ratified at run time (canon-translations.cjs:73, :17), outside the two-file allowlist (scaffold:57). Also: Phase 273 found 208 raw-write violations against a baseline of 195 (ROADMAP.md:3303), and 12 of 7,836 fleet claims carried an anchor (353-CONTEXT.md, success criterion 3). Phase 290 still reads "To be planned" (ROADMAP.md:2373-2377) though 195 folded it in; the walk test (334) never ran (ICM-NESTED-PART-CONTRACT.md section 5).

## 6. A room today

```
<room>/
  ROOM.md              L0 identity + icm_self block (derived)
  STATE.md             L0 state, generated by compute-state
  USER.md              L0 person
  MINTO.md             L4 reasoning, sentinel-bounded
  <section>/           11 sections (scaffold:67-79)
    ROOM.md            L0 identity + L1 statement
    CONTEXT.md         L2 six-part ruling + authored prose
    <artifact>/<artifact>.md   L4 work (decision 16)
  meetings/ team/      structural dirs
  references/          L3: SECTION-SCHEMA.md, SUB-SCHEMAS.md, canon-translations.md
  research/            run folders (unclassified, see 5.5)
  sub-rooms/<name>/    own .room-root, room.db, room map
  .mindrian/           room.db, room-map.json, jtbd-state.json
  .snapshots/ .context/ .intelligence/ assets/   identity dirs (scaffold:98-104)
```

Fleet level: `~/MindrianRooms/CLAUDE.md`, `INDEX.md`, `.rooms/registry.json`.

## 7. Open questions for the navigator

1. Which L0-L4 statement is canon? A) Appendix B as is, rename the room-file layers. B) Rewrite Appendix B to name files. C) Keep both, scope each.
2. Where does the L1 statement live? A) Keep in ROOM.md, relabel. B) Move to a room-level CONTEXT.md router.
3. Is `research/` a structural dir? A) Add to STRUCTURAL_DIRS. B) Make it a twelfth section. C) Move runs under sections.
4. Do sub-rooms get wired by one door? A) Route all sub-room birth through bornWired. B) Keep self-heal, add a doctor repair.
5. Which job list wins? A) Merge into the 20. B) Keep two, document the split.
6. Should ROOM.md be required in artifact folders? A) Yes, doctor checks. B) No, amend Decision 15.
7. Is STATE.md generated or authored? A) Split into two files. B) Declare it authored, drop "NEVER".
8. Where should a posture live? A) Per room in STATE.md. B) Stay in user home.
9. May the planner write into `references/`? A) Yes, name it product. B) Move translations to `.mindrian/`.
10. Close Phase 290 and 278 as absorbed by 195? A) Yes. B) Re-plan the walk test (334) first.

## 8. Sources

Docs: MINDRIAN-CANON.md Appendix B and Part 9; decisions.md; architecture.md; LAYER-CONTRACT.md; ICM-NESTED-PART-CONTRACT.md; 2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md; LIVE_DATA_ROOM_JTBD_PAPER.md; lib/core/navigation/CONTEXT.md.
Planning: ROADMAP.md (phases 273, 275, 290, 343-345, 353, 363, 366, 367, 369); MILESTONES.md; v1.8.6-ROADMAP.md; v1.9.2-ICM-LAYER0-BACKLOG.md; CHANGELOG.md:5560-5580; CONTEXT files for phases 1, 57, 59.2, 77, 100, 195, 275, 353, 363, 366, 369; 353-VERIFICATION.md.
Code: files cited inline. Dates marked first git add were taken from git log.
