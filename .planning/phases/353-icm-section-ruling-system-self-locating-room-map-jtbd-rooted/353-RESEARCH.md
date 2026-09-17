# Phase 353: ICM Section Ruling System - Research

**Researched:** 2026-09-17
**Domain:** ICM room structure, section contracts, graph anchoring, doctor modules, release-time data builds, eval harness
**Confidence:** HIGH on the code seams (every path, export and line below was read in this session); MEDIUM on the two dependency edges (Phase 352's `auto_heal` key and Theo-side Section emission, neither shipped); HIGH on the pitfalls (three of them were reproduced by running the tests).

**Design is locked.** This file does not re-open it. It grounds the locked design in the code as it exists at HEAD (`c9d8cf91b`, v2.0.0-beta.45 line) so the planner writes plans against real seams, reuses what exists (Canon Part 7), and does not discover a broken assumption at execute time.

<user_constraints>
## User Constraints (from 353-CONTEXT.md)

### Locked Decisions (D-353-1 .. D-353-10, verbatim)

- D-353-1. Order: Plan 1 Room Map (self-location), Plan 2 Section Ruling System with its relevance ledger, Plan 3 fixture grading. One phase, three plans.
- D-353-2. Authority: `.mindrian/room-map.json` is the single home of a folder's self-knowledge; every ROOM.md carries a derived, fingerprinted `icm_self:` block (60-120 tokens). The model reads one block per turn; tooling reads the map. Rebuildable from disk at any time (icm-architect invariant 9).
- D-353-3. Runtime: code filters the 113 commands (produces glob, stage gate, autonomous_safe, recency window, HITL shape declared) and orders survivors by the ruling document's sequence; the dial gets the top three with confidence. No Theo or Jev call in the turn path; below the confidence floor, or with no ledger row, the sensor order applies unchanged. `decide()` stays inside its existing 1200 ms budget, measured.
- D-353-4. Grading inputs: fixture rooms under `tests/fixtures/icm-rooms/` only. Never a real room. `scripts/eval-icm-writers.cjs` runs with the dev-time key, never in a user hook.
- D-353-5. Sub-rooms: a sub-room declares its own `job_id` through one F.8 card at birth; undeclared resolves through the parent and is flagged by the doctor until declared. Birth writes parent and child maps inside the existing SEED-001 ACID block as side effect six, or unwinds.
- D-353-6. The shipped `data/section-command-ledger.json` is truth; each ROOM.md's `default_methodologies` becomes a derived, fingerprinted view of it. Rebuilt at release by `scripts/build-section-command-ledger.cjs` (Theo pull through `brain-client.query` with parameterized bucketed predicates per the Spike 002 puller; Jev scoring in batches of 20; name + JTBD statement + glossary line only). Rebuilt on `theo-resync`. Jev unavailable at release keeps the last ledger and logs an audited flag, the `--no-theo-check` shape.
- D-353-7. The ruling document is each section's generated Layer 2 `CONTEXT.md` (Phase 275's `writeSectionContracts` becomes the generator): six marked, fingerprinted parts (Job; Methodology sequence; Writing rules; Gates; Checks; Commands that write here) above the preserved authored Inputs / Process / Human check prose.
- D-353-8. Filing gate: `artifact_file` and `claim_write` require `serves_jtbd` to match the section's `job_id` or carry a declared cross-section reason; default `flag` (write lands with a `job_mismatch` disclosure and a `memory_event`), `strict` refuses. Every new claim lands an anchor edge to the section's `jtbd:<job_id>` node (seeded at map build, `epistemic_type: observation`, `created_by: system`, `review_status: proposed`, written through the navigation door). Legacy claims out of scope.
- D-353-9. Doctor modules `room-map` and `section-ruling`, registered in `data/doctor-modules.json` with the existing row shape and `auto_heal` classification per Phase 352; report mode over all fleet rooms first, `--fix` on a real room only as the navigator's explicit act.
- D-353-10. Canon: Part 7 (reuse: section-registry, command-registry serves_jtbd vocabulary, room-birth ACID block, navigation door, doctor module engine, Spike 002 puller), Part 8 (no room content to Theo or Jev), Part 9 (anchor edges and gates through navigation; a human confirms a truth claim), Part 11 (born-wired doctor modules and any new command surface).

### Claude's / planner's discretion (WD and OQ, verbatim)

- WD-353-1. Planner defaults to confirm in discussion: top-K 3; confidence floor 0.5 (the vendor's "do not act" line, to be evaluated on the labeled fixture set); recency window N = 5 turns; filing gate default `flag`.
- WD-353-2. The anchor edge type from a claim to `jtbd:<job_id>` is whichever member `edges.cjs` already allows for a claim-to-anchor link (Phase 345 used `SOURCED_FROM` for gate decisions); the planner confirms against the allow-list and adds no new member.
- OQ-353-1. Section JTBD canon: the mapping of every core and extended section to the closed job vocabulary in `data/command-registry.json`. Planner default, to be ratified: extend the closed vocabulary by exactly four members (`model-business`, `model-finances`, `protect-assets`, `design-solution`).
- OQ-353-2. Theo-side dependency: Section-node emission with JTBD and framework links (registered as a Theo-repo item; this phase ships without it and reads the ledger it builds itself).

### Out of scope (from the spec section 9, do not plan any of this)

Re-anchoring legacy claims; Theo Section-node emission (Theo-side); any Jev call at room birth or in the turn path; widening the Part 8 guard; a second selection brain beside `dispatchSensors -> decide()`; grading real rooms; the SEED-096 Theo content backfill; the Larry constitution judge (Spike 005); projecting the map into `room.db` as Folder nodes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research support (where the plan lands) |
|----|-------------|------------------------------------------|
| ICM-353-01 | Room map + `icm_self` blocks + doctor `room-map` + sub-room side effect six | Seams 1, 2, 3, 4. New `lib/core/room-map.cjs`; extend `room-skeleton-scaffold.cjs`; extend `room-birth.cjs` FINALIZE block (line 1183-1218); new `lib/core/doctor/room-map-module.cjs` + a row in `data/doctor-modules.json`. |
| ICM-353-02 | Section JTBD canon + ledger build + shipped ledger + ruling document generator + filing gate with anchor edge + doctor `section-ruling` + `decide()` filter | Seams 1, 5, 6, 7, 8. Extend `section-registry.cjs`; new `scripts/build-section-command-ledger.cjs` + `data/section-command-ledger.json`; rewrite `writeSectionContracts`; new `lib/core/navigation/jtbd-anchor.cjs` (clone of `goal-anchor.cjs`); gate inside `claim.cjs` / `views.cjs`; the ledger ordering rides `rankForSelector`'s existing `tierCandidates` input, NOT the frozen 6-reach dial. |
| ICM-353-03 | Fixture rooms + per-writer checklists + eval runner + De Stijl report + acceptance wiring | Seams 4, 9, 10. New `tests/fixtures/icm-rooms/`; new `evals/icm/`; new `scripts/eval-icm-writers.cjs`; a 22nd acceptance point in `scripts/doctor.cjs`. |

**ID-family note (blocking, read before minting IDs).** The register at `.planning/REQUIREMENTS.md` (lines 2620-2704) uses `<PREFIX>-NN` phase-local families (`ICML-01..16`, `STRAT-01..18`, `NOTIFY-01..14`), never a phase-numbered `ICM-353-01` shape. **`ICML-` is already taken by Phase 275.** The planner must mint a fresh, unused prefix (`RULE-`, `SECRULE-` or `MAP-` are free as of this reading), register the rows as `- [ ]` at plan time per the Phase 254/257/339/343/344/345 precedent, and close them with measured proof in the phase's own close-out plan. The `ICM-353-0N` ids in the phase brief are working labels, not register-shaped ids.
</phase_requirements>

## Summary

Phase 353 is almost entirely an **extension phase**, not a build phase. Every mechanism the design names already exists in this repo and has a shipped precedent: the section registry, the L2 contract writer, the ACID sub-room birth block, the payload-free anchor node, the accumulative doctor-module engine, the parameterized Theo puller, the caller-supplied candidate list on the F-selector ranker, and a chars-over-4 token estimator. Eight of the ten seams are `extend`; two are `new` (`lib/core/room-map.cjs` and `scripts/build-section-command-ledger.cjs`), and both are new files that consume existing exports rather than new mechanisms.

Two things in the design are **imprecise against the code and must be corrected at plan time, not at execute time**. First, "the dial gets the top three" conflates two different surfaces: `lib/hmi/dial-reach-orchestrator.cjs` carries a **frozen six-member machine-reach vocabulary** (`context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`, `hats`) with Canon Part 3 frozen scalars (`DIAL_REACH_K=6`, `RECOMMEND_FLOOR=0.70`, `MARGIN_THRESHOLD=0.15`); it does not rank commands at all. Commands are ranked by `lib/workflow/f-selector-ranker.cjs::rankForSelector` at `MAX_K=3`, and that function **already accepts a caller-supplied pre-ranked list** (`o.tierCandidates`, Phase 244 TRIG-02). That is the reuse seam for the ledger ordering, and it means zero change to any frozen scalar. Second, the six generated, fingerprinted parts with YAML frontmatter directly contradict two shipped assertions in `tests/test-275-section-schema.cjs` (line 330 "no contract template has YAML frontmatter"; line 366 "every landed CONTEXT.md is byte-identical to its template"). Those two assertions must be deliberately amended by a named task, not stumbled over.

The fleet scope is also larger than the design's census implies. Measured this session: **2,024 non-dot directories under the 31 top-level rooms, of which 914 have no ROOM.md**; 401 depth-1 directories of which 102 have no ROOM.md; 6 roots with no ROOM.md; 31 nested `.room-root` sentinels. And **only one room in the entire fleet (`axiom`, 11 files) has any section `CONTEXT.md` at all**: Phase 275's migration never ran on the other 30. Success criterion 1's "0 directories without ROOM.md (7 today)" is true only for roots. The planner must scope which directory class gets an `icm_self` block before Plan 1 is written.

**Primary recommendation:** plan Unit 1 against `room-map.cjs` + the `room-birth.cjs` FINALIZE block + one new doctor module and scope `icm_self` to the L0/L1/L2 folder classes the section registry already recognizes (root, section, structural, sub-room), explicitly excluding per-artifact folders (Decision 16) so `--fix` writes ~400 blocks, not ~2,000; plan Unit 2's runtime leg onto `rankForSelector`'s existing `tierCandidates` input and its anchor node as a clone of `lib/core/navigation/goal-anchor.cjs`; reuse `mcp_client_event_logged` for the `job_mismatch` disclosure rather than minting a new `EVENT_TYPES` member.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|------------|-------------|----------------|-----------|
| Room map build and fingerprint | Local filesystem walker (`lib/core/*.cjs`) | - | Pure disk read plus sha256; zero db, zero network. Same tier as `section-registry.cjs`. |
| `icm_self` block write | Local filesystem writer (`room-skeleton-scaffold.cjs` idiom) | - | Atomic tmp+rename, existence-check-before-write, the shipped scaffold discipline. |
| Sub-room side effect six | Birth transaction (`navigation/room-birth.cjs` FINALIZE) | Registry (`~/MindrianRooms/.rooms/registry.json`) | The ACID contract already owns all-or-unwind; a sixth flag joins `se.s1..s5`. |
| Section JTBD canon | Shipped data (`lib/core/section-registry.cjs` tables) | `data/command-registry.json` vocabulary | Factory layer per icm-architect invariant 5; canon is shipped, ruling documents are generated product. |
| Relevance ledger build | Release-time build script (`scripts/build-*.cjs --check` family) | Theo via `brain-client.query`; Jev via direct fetch | Network is dev-time only. The `--check` idiom is the shipped staleness gate. |
| Ruling document generation | Local filesystem writer (`writeSectionContracts`) | Ledger data + canon | L2 control surface; generated parts above authored prose. |
| Filing gate and anchor edge | Graph write door (`lib/core/navigation.cjs`) | MCP tool layer (`lib/mcp/tools/claim.cjs`, `views.cjs`) | Canon Part 9: `navigation.cjs` is the only door. The gate decision itself belongs at the tool boundary; the edge write belongs behind the door. |
| Runtime command ordering | Selection engine (`f-selector-ranker.cjs` via `decide()`) | Ledger data (pure read of a shipped JSON) | No second selection brain (out of scope). The existing `tierCandidates` input is the widening seam. |
| Drift detection | Doctor module engine (`scripts/doctor.cjs` cadence:always) | `data/doctor-modules.json` | Registry-driven, sync `check()`/`fix()`, fix-then-recheck already owned by the engine. |
| Grading | Dev-time eval runner (`scripts/eval-*.cjs`) | Fixture rooms only | Never a hook, never a real room (D-353-4). |

## Project Constraints (from CLAUDE.md)

Binding on every plan in this phase. Each is quoted from the project guide, not paraphrased into a softer form.

1. **Workspace guard.** Every commit, git operation and GSD phase runs from `/home/jsagi/dev/MindrianOS-Plugin/`. Never `~/.claude/plugins/mindrian-os/`.
2. **CJS only, no TypeScript.** `lib/core/*.cjs` ships as source. CLI entry points parse `process.argv` with a switch-case router (the `gsd-tools.cjs` pattern). No Commander, no yargs.
3. **No em-dashes anywhere.** Hyphens only. Enforced by `scripts/check-voice-style.cjs` and by targeted globs inside each `tests/run-all-<phase>.sh`.
4. **`lib/core/navigation.cjs` is the single SQL navigation chokepoint.** Typed edges and `memory_event` nodes are written only through it. Enforced by `scripts/check-substrate.cjs` (rules `chokepoint-require`, `m2-raw-room-db-read`, `m3-direct-sqlite-require`, `raw-graph-write`, `opengraph-bypass`, `m4-cypher-interpolation`), in `--diff` mode at pre-commit with exit 1 on any staged violation.
5. **One governed reach path:** `dispatchSensors` -> `decide()` -> resolver. No second selection brain.
6. **Canon Part 8:** LOCAL data never egresses. Only generic framework handles and enums cross the wire.
7. **Canon Part 7 (reuse before build):** search the methodology surface enumerated from disk first and justify any net-new surface against it.
8. **Canon Part 11 (CIRS):** every invocable surface is born WIRED or EXCLUDED, and carries a declared HITL shape (`hitl_shape`/`hitl_why`), checked by `scripts/check-shape-declaration.cjs`.
9. **Canon Part 9:** only a human confirms a truth-claim node. Maps, blocks and ruling documents are bookkeeping, not truth claims.
10. **Releases go through `scripts/release.sh <version>`.** Never bump versions by hand. Five-place version lockstep.
11. **Tri-polar rule:** evaluate every feature across CLI, Desktop and Cowork; a skip is a stated call, never an oversight.
12. **Dev-research compositing:** this phase touches MindrianOS's own architecture, so findings composite with `~/MindrianRooms/rethinking-mindrianos/research/` and mirror to `mindrianOS/research/`.
13. **Verification suites:** `bash tests/run-all-<phase>.sh`, `scripts/verify-release`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`, `node scripts/run-harness.cjs --check`.
14. **GSD workflow enforcement:** no direct repo edits outside a GSD workflow.

## Seams

Every path, export name, signature and line number below was read at HEAD in this session. Where a seam does not exist, it says so.

### Seam 1 - Room structure (section registry, templates, scaffolder, Phase 275 contract writer)

**Verdict: EXTEND (registry, scaffolder, contract writer) + NEW (`lib/core/room-map.cjs`).**

`lib/core/section-registry.cjs` (167 lines, zero deps beyond `node:fs`/`node:path`):

| Export | Line | Shape |
|--------|------|-------|
| `CORE_SECTIONS` | 17-29 | 11 slugs -> `{ label, color }`. Slugs: problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model, opportunity-bank, funding, strategy. |
| `EXTENDED_SECTION_META` | 34-36 | 1 slug -> `{ label, color }`. Only `personas`. |
| `STRUCTURAL_DIRS` | 44 | `['meetings', 'team', 'references']` |
| `isIndexableArtifactFile(name)` | 53-60 | Excludes `STATE.md`, `ROOM.md`, `CONTEXT.md`, dot-files; accepts `.md/.docx/.html/.htm`. |
| `discoverSections(roomDir)` | 70-165 | Returns `{ core: string[], extended: string[], all: string[], getMeta: fn }`. Skips dot-dirs and `STRUCTURAL_DIRS`. Qualifies a dir by STATE.md, a flat `.md`, or one-level-down nested artifacts; **skips a child carrying a `.room-root` sentinel** (line 128), which is exactly the sub-room boundary the room map needs. |

`CORE_SECTIONS` and `EXTENDED_SECTION_META` are the natural home for the new per-section `job_id` / `serves_jtbd` / `secondary_job` keys (D-353-7 part 1). They are plain frozen-by-convention object literals (NOT `Object.freeze`d, unlike `SECTION_NAMES` in the scaffolder), so adding keys is a data edit. `getMeta` (line 153-162) already returns a synthesized fallback for an unknown extension section, which is the natural place to return `job_id: null` so the doctor can report "undeclared".

`templates/room-skeleton/` holds: `MINTO.md.tmpl`, `ROOM.md.identity.tmpl`, `ROOM.md.section.tmpl`, `STATE.md.tmpl`, `USER.md.tmpl`, `references/`, `section-contracts/`.

- `ROOM.md.identity.tmpl` frontmatter: `directory_type`, `icm_layer: 0`, `auto_scaffolded: true`, `purpose`. This is the template a missing root ROOM.md is created from (spec Unit 1). Note it declares `directory_type`, not `section`, so the root case needs either a third template or a substitution branch.
- `ROOM.md.section.tmpl` frontmatter: `section`, `statement`, `purpose`, `stage_relevance` (list), `default_methodologies` (list), `icm_layer: 0`, `auto_scaffolded: true`. `{{...}}` substitution tokens.
- `section-contracts/*.md`: **11 files, one per `CORE_SECTIONS` slug, `personas` has none.** Verified: `business-model.md competitive-analysis.md financial-model.md funding.md legal-ip.md market-analysis.md opportunity-bank.md problem-definition.md solution-design.md strategy.md team-execution.md`. **They carry NO YAML frontmatter** and their fixed heading order is: H1 (section + job), `**Statement:**` line, `One job:` line, `## Inputs`, `## Process`, `## Outputs`, `## Human check`, `## Commands that write here`. (`problem-definition.md` additionally carries a `Do NOT load:` line inside `## Inputs`, which icm-architect invariant 4 requires be preserved.)

The scaffolder is **`lib/core/room-skeleton-scaffold.cjs` (670 lines)**, found via `grep -rl "room-skeleton" lib scripts`. Exports (lines 658-669): `SECTION_NAMES`, `SECTION_METADATA`, `IDENTITY_DIRECTORIES`, `scaffoldRoomSkeleton`, `writeSectionContracts`, `writeReferenceDocs`, `REFERENCE_DOCS`, `renderTemplate`, `isStateAuthored`, `escapeYamlDoubleQuoted`.

- `SECTION_NAMES` (line 59-71) is `Object.freeze`d with an explicit **FROZEN TABLE CONTRACT** comment at line 538-544: the table is "never modified SILENTLY or by a drive-by edit. A deliberate, versioned, phase-cited extension is the established move". Precedents named: Phase 179-04 and Phase 275 (8 -> 11).
- `SECTION_METADATA` (line 73-85) is `Object.freeze`d and holds per-slug `{ statement, purpose, stage_relevance, default_methodologies }`. **This is the second home of the statement string** (the first being the contract template's `**Statement:**` line). A third home would violate icm-architect invariant 8.
- `IDENTITY_DIRECTORIES` (line 90-97) covers `team`, `references`, `assets`, `.intelligence`, `.snapshots`, `.context`. Three of those six are dot-directories, which every walker in the repo skips.
- `scaffoldRoomSkeleton(roomDir, opts)` (line 436-656) returns `{ ok, sections_created[], identity_files_created[], state_written, minto_written, user_written, thinness_acknowledged, blueprint_family, errors[], warnings[], contracts_created[], reference_docs_created[] }`. Write order: STATE.md -> MINTO.md -> USER.md -> section loop (ROOM.md per section) -> `writeSectionContracts` (line 603) -> identity dirs -> `writeReferenceDocs` (line 641). **The room map and `icm_self` writes belong after line 641** so every ROOM.md exists before the map is walked.
- `writeSectionContracts(roomDir, sectionList, result)` (line 354-379). Today it is a **verbatim copier**: it reads `SECTION_CONTRACTS_DIR/<slug>.md` and `atomicWrite`s it to `<roomDir>/<slug>/CONTEXT.md` with **no `renderTemplate` substitution pass** (T-275-13, line 318-320: "running substitution over them would let a stray `{{` in prose corrupt a room file") and **skips silently if the target exists** (line 357, Canon Part 9 never-overwrite). It pushes `contract_template_missing:<slug>` warnings, `contract_write_failed:<slug>` errors.
- **The Phase 275 CONTEXT.md files carry no frontmatter and are NOT fingerprinted.** Nothing in the repo computes or checks a contract fingerprint today.

`scripts/migrate-room-sections-v275.cjs` exists and reuses `scaffoldRoomSkeleton`, `writeSectionContracts` and `writeReferenceDocs` rather than re-implementing them (Canon Part 7). It backfills a missing `statement:` key into an existing section ROOM.md as a single-line addition after `section:` and **never overwrites an existing value**. That is the exact idiom the `icm_self` backfill should copy, with one difference: `icm_self` IS regenerated (invariant 9), so its write rule is replace-the-marked-block, not never-touch.

**Measured, 2026-09-17: the migration was never run on the fleet.** `find ~/MindrianRooms -name CONTEXT.md -not -path "*/.*"` returns **11 files, all in one room (`axiom`)**. Thirty of the thirty-one fleet rooms have zero L2 contracts.

**What Plan 1 adds:** a new `lib/core/room-map.cjs` with (suggested) `buildRoomMap(roomDir) -> {room, built_at, fingerprint, nodes[]}`, `writeRoomMap(roomDir, map)`, `renderSelfBlock(node) -> string`, `writeSelfBlocks(roomDir, map) -> {written[], errors[]}`, `mapFingerprint(nodes) -> sha256hex`. It consumes `discoverSections`, `CORE_SECTIONS`, `EXTENDED_SECTION_META`, `STRUCTURAL_DIRS` and `isIndexableArtifactFile` and reuses `escapeYamlDoubleQuoted` + `atomicWrite`'s tmp+rename idiom from the scaffolder.

### Seam 2 - Sub-room birth (the SEED-001 ACID block, the registry, room resolution)

**Verdict: EXTEND (one flag in the FINALIZE block).**

`lib/core/navigation/room-birth.cjs` (1227 lines). Exports (line 1223-1227): `birthRoom`, `drainBirthGateAnswers`, `writeSectionNodes`, `SECTION_NAMES`, `BRAIN_STUB_TEMPLATE`.

The born-wired contract is documented at lines 305-324. The five side effects and their helpers:

| # | What | Helper | Line |
|---|------|--------|------|
| 1 | parent STATE.md gets `[[<child>]]` under `## Sub-rooms` | `_patchParentStateSubroom(parentRoomDir, childSlug)` | 473-491 |
| 2 | child STATE.md gets `parent: [[<parent>]]` + `## Parent Room` | `_patchChildStateParent(roomDir, parentSlug)` | 447-469 |
| 3 | `NESTED_WITHIN` lineage edge, **written inside the STEP-2 SQLite transaction** | verified by `_verifyNestedWithin` | landed line 943, verified line 1185 |
| 4 | child registry entry gets `parent`/`depth`/`path`; parent's `children[]` updated | `_patchRegistryLineage(roomsHome, slug, parentSlug, roomDir, depth)` | 424-443 |
| 5 | parent wikilink resolver cache invalidated | `_invalidateParentWikilinkCache(parentRoomDir)` | 499-505 |

**The FINALIZE block is lines 1183-1218.** Its exact shape:

```
const se = { s1:false, s2:false, s3:false, s4:false, s5:false };
se.s3 = _verifyNestedWithin(roomDir, slug, parent);
try { se.s2 = ...; se.s4 = ...; se.s1 = ...; se.s5 = ...; }
catch (e) { _bornWiredRollback(...); return { ok:false, reason:'born_wired_side_effect_failed', detail, side_effects: se }; }
const allWired = se.s1 && se.s2 && se.s3 && se.s4 && se.s5;
if (!allWired) { _bornWiredRollback(...); return { ok:false, reason:'born_wired_incomplete', side_effects: se }; }
return { ok:true, roomDir, slug, db_created:true, born_wired:true, side_effects: se };
```

**Adding side effect six is a four-line edit:** add `s6:false` to the initializer, call the map writer inside the same `try`, add `&& se.s6` to `allWired`, and the existing `_bornWiredRollback` (line 392-396: close db handle -> `fs.rmSync(roomDir, {recursive:true,force:true})` -> `_removeRegistryKey`) already handles unwind with no change. **"Unwind" here means the child directory is deleted outright and the registry key + the parent's `children[]` entry are reverted.** The parent room's own map rebuild must therefore be idempotent and safe to leave in place after an unwind, or be re-run by the rollback; the planner should state which.

**Test seam already present:** `options._faultInject` (line 1193) accepts `/^s[1-5]$/` and forces a side effect to read as failed. **This regex must be widened to `s[1-6]`** or the Unit 1 unwind test cannot be written. Named explicitly because it is a one-character change that is easy to miss.

`~/MindrianRooms/.rooms/registry.json` top-level keys: `version, root, active, rooms, sessions, last_active, active_session, active_session_at, active_session_pid`. `rooms` is an **object keyed by slug**, 56 entries. Entry shape (measured): `{ path, venture_name, venture_stage, status, created, last_opened, parent?, cluster?, depth?, children?, git_enabled?, ... }`.

**Measured registry drift, confirming the design's cross-check-only ruling:** 25 of 56 entries carry `parent`; the `depth` field is present on only some of them (values seen: `1` and absent). The `polygon` entry carries `"path": "align-ecosystem/sub-rooms/polygon"` while `"parent": "mindrian-ecosystem"` - the two disagree, exactly as the spec's Unit 1 note says. **Disk wins for the map; the doctor reports the registry drift** (spec section 6).

Registry readers already in `room-birth.cjs` and directly reusable: `_roomsHome()` (350-352, honors `MINDRIAN_ROOMS_HOME`), `_readRegistry(roomsHome)` (354-360), `_registryEntry(reg, slug)` (362-368, handles both array and object `rooms` shapes), `_resolveRoomDirFromRegistry(slug, roomsHome)` (372-380), `_computeDepth(roomsHome, parentSlug)` (383-387, defaults to 1 when the parent has no `depth`).

`lib/core/rooms-home-env.cjs` exports exactly one function: `roomsHomeEnv` (line 35). `lib/core/resolve-active-room.cjs` exports (line 581-591): `resolveActiveRoom`, `resolveActiveRoomSlug`, `resolveActiveRoomDir`, `resolveWriteRoom`, `resolveSessionRoom`, `resolveSessionScope`, `registryRoomPath`, `resolveActiveOwnership`, `OWNERSHIP_MAX_AGE_MS`. A doctor module scoped to the active room uses `readRegistry` from `lib/core/doctor/shared.cjs` instead (see Seam 4).

### Seam 3 - ROOM.md frontmatter (who reads it, who writes it, is there a fingerprinting writer)

**Verdict: EXTEND `lib/core/frontmatter-schemas.cjs` (mandatory, or the hook goes noisy) + NEW block writer. There is NO existing fingerprinted frontmatter writer to reuse.**

**`default_methodologies` has zero runtime readers.** Grepped across `lib scripts hooks tests commands`. Every hit is either the scaffolder's own write path (`room-skeleton-scaffold.cjs:74-84, 306-307, 555-562`), the blueprint-family validator (`scripts/check-room-blueprints.cjs:141-170`, which checks the BLUEPRINT's array, not a room's), the Phase 275 migration (`migrate-room-sections-v275.cjs:276`), or a test. **Nothing consumes the key a room's ROOM.md carries.** D-353-6's "the field that nothing read starts meaning something" is factually correct at HEAD.

**There is no shared frontmatter parse/write helper.** There are at least **twelve independent local `parseFrontmatter` implementations**: `lib/core/mva-rule-linter.cjs:127`, `opportunity-ops.cjs:24`, `scheduled-scanner.cjs:33`, `decision-capture.cjs:89`, `brain-md-staleness.cjs:131`, `user-md-ops.cjs:145`, `reasoning-ops.cjs:39`, `persona-ops.cjs:32`, `feynman/timeline-runner.cjs:35`, `lib/vault/frontmatter-schema.cjs:90`, `lib/vault/room-scanner.cjs:87`, `lib/mcp/app-views.cjs:65`. **Do not add a thirteenth.**

**The repo's declared YAML frontmatter parser is `gray-matter` ^4.0.3** (`package.json:50`), already required by `lib/wiki/room-home.cjs:25`, `lib/wiki/wiki-server.cjs:12`, `lib/wiki/page-renderer.cjs:12`, `lib/import/vault-scanner.cjs:17`, `lib/import/branding.cjs:43`. `tests/test-275-section-schema.cjs:26-28` records the WR-02 ruling explicitly: "gray-matter is the repo's own YAML frontmatter parser" and should be used "instead of regex-matching raw bytes". **That is the parser the `icm_self` reader and the map builder should use.** It is already a dependency; nothing new installs.

The single YAML-escaping helper that already exists is `escapeYamlDoubleQuoted` (exported from `room-skeleton-scaffold.cjs:668`), added by the Phase 275-08 CR-01 fix precisely because a raw `renderTemplate` substitution into a double-quoted YAML scalar corrupts the block on a mid-sentence `": "` or an embedded quote. **The `icm_self` writer must use it for every string value** (`room`, `path`, `parent`, and each child name).

**Frontmatter schema validator (the trap).** `lib/core/frontmatter-schemas.cjs` exports `SCHEMAS`, `validate(filePath, frontmatter)`, `selectSchemaKey`, `aggregateSeverity` (lines 479-485). `selectSchemaKey` (line 279-289) switches on `path.basename`: `ROOM.md`, `STATE.md`, `MINTO.md`, `USER.md`, else `artifact-default`. **`CONTEXT.md` falls through to `artifact-default`.** The `ROOM.md` schema has `required: []` and an explicit `optional` allow-list (name, type, references, description, parent, slug, section, statement, purpose, stage_relevance, default_methodologies, icm_layer, auto_scaffolded, directory_type, room, room_id, room_kind, blueprint_family, venture_name, venture_stage, created, navigator, founder, shared_with). An unlisted key emits a `{ type: 'unknown' }` violation (line 318). Line 466 records that unknown fields "do NOT invalidate (unknown fields are advisory drift signals)", so this is a **WARN, not a block** - but it is a PostToolUse hook that fires on every write and its own header (lines 24-34) names the last time this drifted as "a Canon Part 6 dog-food self-violation".

**Required edits (name them as tasks):**
- Add `icm_self` and `job_id` to the `ROOM.md` schema `optional` array.
- Add a `CONTEXT.md` arm to `selectSchemaKey` with its own schema carrying `icm_layer`, `job_id`, `ruling_fingerprint`, `generated_at`, or the ruling document's frontmatter lands four `unknown` violations on every regeneration under `artifact-default`.

### Seam 4 - Doctor modules (row shape, template, engine invocation, D-03 parity, acceptance)

**Verdict: EXTEND (`data/doctor-modules.json` + two new runner files under `lib/core/doctor/`).**

`data/doctor-modules.json` top-level keys: `$schema_note`, `schema_version`, `phase`, `canon_parts`, `modules`. **24 modules today.** Every one of the 24 carries exactly these seven keys and no others:

```json
{
  "id": "capability-ledger",
  "introduced_version": "2.0.0-beta.12",
  "cadence": "always",
  "flag": null,
  "fix_supported": false,
  "runner": "lib/core/doctor/capability-ledger-module.cjs",
  "description": "..."
}
```

**`auto_heal` does not exist in the file, in any runner, in any test, or anywhere in `lib`, `scripts`, `data`, `tests` or `docs`.** Grep returned zero hits. It is a **Phase 352 deliverable** (`.planning/phases/352-.../352-CONTEXT.md` D-352-4: "New boolean in `data/doctor-modules.json`, mandatory for every `fix_supported: true` row, enforced by a new D-03 parity rule"). **Phase 352 is registered but not planned** (`.planning/STATE.md:6814-6823`; the phase directory holds only CONTEXT, RESEARCH-GROUNDING, UI-SPEC and evidence files, no plans). See Open Question 1.

**Template module (read in full): `lib/core/doctor/room-md-module.cjs` (207 lines).** Contract, stated at lines 22-26:

- `check(ctx) -> { status: 'ok'|'warn'|'skip', detail, missing[], roomPath?, subdirs? }`
- `fix(ctx) -> { status: 'ok'|'partial'|'error'|'skip', detail, tool }`, reading `ctx.check_result`.
- Exports (line 203-206): `{ check, fix }`. **Both are synchronous.**

Its own directory walker `listSubdirs(rootDir, opts)` (line 47-75) is directly reusable by the room-map module: `SKIP_DIRS` set at line 39-42 (`.git, .mindrian, .context, .lazygraph, .rooms, node_modules, .next, dist, build, .cache`), a categorical `entry.name.startsWith('.')` skip at line 66, and `maxDepth` default 8 at line 50.

`lib/core/doctor/shared.cjs` provides `readRegistry` and `PLUGIN_ROOT` (required at line 36). `readRegistry()` returns `{ registry, roomsHome }`; `registry.active` is the active room slug and `registry.rooms[name].path` the path, resolved relative to `roomsHome` when not absolute (room-md-module lines 107-117). The `.room-root` sentinel is the class-scope gate (line 119-121).

**Engine invocation (`scripts/doctor.cjs`).** `DOCTOR_MODULES_PATH` at line 106. `runAccumulativeEngine(flags)` at line 2599. Two passes:

- **ONCE pass** (lines 2580-2650): watermark-gated, window `(applied_through, running]`, advances `~/.mindrian/doctor-applied.json`. Not what these modules want.
- **ALWAYS pass** (lines 2657-2720+): for each `cadence: 'always'` module in registry array order: flag gate (`mod.flag === null` means the `baseWanted` gate `flags.all || flags.fix || !classFlagsActive`; a named flag means it runs only when that parseArgs flag is set); deferred guard (a `introduced_version` above `running` is deferred, no watermark lower bound); build `ctx = { home, running, dryRun, fix: wantFix, flags: callerFlags, checks: alwaysChecks }`; resolve via `resolveAlwaysRunner(mod)` (line 2576-2595, test seams `mod._check`/`mod._fix` win, else `require(path.join(PLUGIN_ROOT, mod.runner))`); **call `checkFn(ctx)` synchronously inside try/catch**; then the fix-then-recheck flow.

**`check()` and `fix()` are called SYNCHRONOUSLY. There is no `await` anywhere in the dispatch.** A `Promise`-returning `check` would be recorded as an object with no `status` and misreported. The room-map walk, the fingerprint compare and the ruling-fingerprint compare must all be sync (`fs.readdirSync`, `crypto.createHash('sha256')`), which they naturally are.

**Fix-then-recheck gate (line 2690-2700):** the fixer runs only when `wantFix && mod.fix_supported === true && typeof fixFn === 'function' && (result.status === 'warn' || result.status === 'error') && result.recoverable !== false`. Then `check()` is **re-run** and `result.fix_result = fixRes` is attached. Note `result.recoverable === false` is the explicit opt-out for a drift class the module refuses to auto-fix; that is the seam for D-353-9's "`--fix` on a real room only as the navigator's explicit act".

**D-03 parity rule = "every path carries a non-empty detail".** Named at `room-md-module.cjs:139` ("D-03 rule 9: non-empty detail on the ok path"), `cascade-rooms-module.cjs:88`, `cascade-rooms-active-module.cjs:24`, `ui-compliance-module.cjs:206`, `card-fire-health-module.cjs:140`. **Every return from the two new modules, including `skip` and `ok`, must carry a non-empty `detail` string.**

**Release gate on the registry:** `scripts/release.sh` Step 6.6a already verifies "every runner exists" in `data/doctor-modules.json` with the same rollback as Step 6.6. A registry row pointing at a missing file reds the release.

**Acceptance points.** `scripts/doctor.cjs` `--acceptance` (block documented lines 738-758) is a HARD ABORT with its own exit contract (0 all passed, 1 any failed) and **no `--allow` override**. There are **21 points today** (the "7-point" label in the help text at line 460 is historical). Point shape:

```js
{
  id: 'capability-ledger-fresh',
  label: '...',
  severity: 'blocker',            // 'blocker' hard-aborts
  applies_to: ['pre-tag', 'full'],
  run: async function () { ... return { ok, finding, detail }; },
}
```

The `capability-ledger-fresh` point (lines 1857-1905) is the exact template for ICM-353-03's acceptance wiring: it `require`s the module's runner directly and calls `check({})` **in-process** (no re-spawn of doctor.cjs), honours `DOCTOR_TEST_FAIL_POINT` in test mode and a `DOCTOR_SKIP_<NAME>=1` hermetic-CI escape. `applies_to: ['pre-tag','full']` is correct for a purely local point (Canon Part 8 zero network); the eval runner is NOT purely local (it calls Jev) and therefore must either be `'full'`-only behind a skip env, or assert on a **previously written** eval JSON rather than running Jev itself. **Recommended: the acceptance point reads `evals/icm/last-run.json` and asserts freshness plus the >= 0.8 agreement threshold; it never fires a vendor call on the release path.**

`tests/test-doctor-acceptance-self-coverage.cjs` asserts a **per-fixture pass/fail signature** across five scaffolded broken-state fixtures (header lines 17-27), not a point count. Grepped: no `checklist.length` assertion. **Adding a 22nd point is safe** provided the new point returns `ok: true` under all five fixtures (it will, if it degrades to `ok` on a missing eval file with a named `detail`).

### Seam 5 - Command registry (`serves_jtbd` vocabulary, where it is validated, what four new members would break)

**Verdict: EXTEND (`section-registry.cjs` only). The command registry itself needs NO edit in this phase.**

`data/command-registry.json` top-level keys: `ontology_ref`, `generated_note`, `commands`, `framework_index`, `curated_chains`. **`commands` is an array of 113 objects**, every one carrying exactly these 15 keys:

`command, kind, surface, visibility, frameworks, produces, executable, inputs, autonomous_safe, body_shape, layer, serves_jtbd, teaching, jtbd_label, jtbd_summary`

**There is no `hitl_shape` key on a command-registry row.** HITL shapes live on the connector registry (`data/connector-registry.json`, built by `scripts/build-connector-registry.cjs` from each surface's own `connectors` export) and are lint-checked by `scripts/check-shape-declaration.cjs`. D-353-3's "HITL shape declared" filter must therefore read the **connector** registry, not the command registry, or join across the two on `command`/`surface`. Name this in the plan; it is not a one-key read.

**Measured `serves_jtbd` vocabulary (union over all 113 commands), 16 members with counts:**

`explore` 36, `audit-room` 28, `prepare-pitch` 17, `understand-market` 12, `find-problem` 9, `validate-idea` 9, `find-bottleneck` 8, `compare-options` 7, `plan-execution` 6, `connect-domains` 6, `decide-pursue` 5, `file-meeting` 3, `surface-contradiction` 2, `build` 2, `navigate` 2, `temporal-correction` 1.

**The "closed 16-job vocabulary" is NOT closed anywhere in code.** There is no enum, no schema, no allow-list. The 16 are the observed union of values authored in each command's markdown frontmatter, re-derived from disk at build time by `scripts/build-command-registry.cjs` (line 346: `const servesJtbd = Array.isArray(fm.serves_jtbd) ? fm.serves_jtbd.slice() : []`), with `jtbd_label` and `jtbd_summary` derived from `serves_jtbd[0]` (line 358) and never authored per command. `--check` (line 525) regenerates in memory and exits non-zero on drift.

A **separate, smaller** table exists: `lib/hmi/jtbd-taxonomy.json`, `entries` is an array of **13** objects keyed by `id` with `{ id, one_line, cues[], methodology_hooks[], next_move_verbs[], completion_shape, operator_affinity[], persona_affinity[], completion_pattern }`. Its ids: `decide-pursue, find-problem, understand-market, find-bottleneck, prepare-pitch, validate-idea, compare-options, connect-domains, surface-contradiction, plan-execution, file-meeting, audit-room, explore`. **Three registry values (`build`, `navigate`, `temporal-correction`) are already taxonomy orphans** and the shipped test explicitly tolerates them: `lib/memory/per-command-jtbd-derivation.test.cjs:52-70` splits offenders into `orphans` (not in the taxonomy, excused) and `realOffenders` (in the taxonomy but missing a summary, asserted).

**Consequence for OQ-353-1 (the four new members).** Adding `model-business`, `model-finances`, `protect-assets`, `design-solution` **as section-canon `job_id` values only**, without touching any command's frontmatter:

- Breaks **nothing**. No test, schema or build gate enumerates the vocabulary. `build-command-registry.cjs --check` is a byte-compare of a regeneration from command frontmatter; unchanged frontmatter means an unchanged registry.
- The four are automatically taxonomy orphans, the same class as the three already shipped, so `per-command-jtbd-derivation.test.cjs` stays green.
- **But the ledger row for each of the four jobs will be EMPTY**, because `data/section-command-ledger.json` is keyed by `(job_id, problem_type, stage)` and joins Theo frameworks to commands through `framework_index` and each command's `frameworks`/`serves_jtbd`. No command declares the four new jobs, so no command survives the job filter for `business-model`, `financial-model`, `legal-ip` or `solution-design`. Those four sections would fall back to the sensor order on every turn (D-353-3's designed degrade, but silently and permanently, not as an edge case). **The planner must decide whether the join is on `serves_jtbd` alone or on `produces`-into-this-section as well.** The 11 shipped `section-contracts/*.md` files each already carry a `## Commands that write here` section listing "Ground truth (the command's own `produces` path names this section)" plus "Framework-matched" - that hand-authored table is ground truth the ledger build can seed from.
- Two consumers build a recipe key from the string: `lib/core/sensors/sensor-jtbd-reweight.cjs:111-115` (`'serves_jtbd:' + currentSlug`) and `lib/core/sensors/sensor-strategy-reach.cjs:163` (`'serves_jtbd:' + goal.jtbd`). Neither validates membership; an unknown slug simply misses in `recipe-maps.cjs`. No crash, no test break.

`framework_index` and `curated_chains` are the other two top-level keys the ledger build reads. `lib/workflow/command-resolver.cjs` exposes `commandsForFramework(fw)`, `frameworksForCommand(cmd)`, `composeWorkflow(frameworkChain)` (line 189-, maps a chain to `{step, framework, command, ...}` taking `cmds[0]` per step), `validateChainAutonomy`, `__reset` (lines 250-257). `composeWorkflow` is the **chain** composer, not the per-turn ranker; the ledger's ordering feeds the ranker, not this.

### Seam 6 - The reach path (`decide()`, sensors, recipe maps, resolver, `context_assemble`)

**Verdict: EXTEND `rankForSelector` via its EXISTING `tierCandidates` input. Do NOT touch the reach dial. Do NOT add a sensor.**

**This is the seam the design describes imprecisely. Two different surfaces are both called "top three".**

`lib/hmi/dial-reach-orchestrator.cjs`:
- `REACH_DEFS` (line 129-137) is a **frozen six-member machine-reach vocabulary**: `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`, `hats`. `REACH_IDS = REACH_DEFS.map(d => d.reach_id)` (line 139).
- `DIAL_REACH_K = 6` (line 112), `RECOMMEND_FLOOR = 0.70` (line 116), `MARGIN_THRESHOLD = 0.15` (line 117). `OFFERED_CAP` reads `ranker.MAX_K` (line 120) and the comment says "read, never raised".
- `REGISTRY_DEFAULT_BRAIN_CONFIDENCE = 0.5` (line 142), with the comment "Below the 0.70 floor by construction... so they can never solo-cross 0.70".
- `navigation-engine.cjs:1845-1880` calls these the **frozen constitutional set**: `MAX_K` 3, `DIAL_REACH_K` 6, `RECOMMEND_FLOOR` 0.70, `MARGIN_THRESHOLD` 0.15. CLAUDE.md Canon Part 3 calls them "0.70/0.15 frozen".

**The dial does not rank commands.** It ranks six named machine reaches. Handing it "the top three commands" is not expressible.

`lib/workflow/f-selector-ranker.cjs`:
- `MAX_K = 3` (line 87), with the comment at line 917-922: a caller asking `k=20` silently receives `k=MAX_K`.
- `rankForSelector(args)` (line 905) is **pure, synchronous, no Promise, no await, no Brain call, no db write, no memory_event write, no event subscription** (D10 invariant, stated lines 893-903). It loads the command registry itself (`const reg = _loadRegistry(); const commands = reg.commands` at line 972-973) and scores all 113.
- Accepted args include `jtbd`, `problemType`, `focusNodeId`, `roomState`, `packetOptional`, `k`, `isAdmin`, `sens10`, and **`tierCandidates`** (line 941: "Phase 244 TRIG-02: the optional cross-family tier-candidate lists. Absent or not-an-array => the fusion pass never runs (byte-identical no-op)"). The header note at lines 896-903 is explicit: `tierCandidates` is "caller-supplied LOCAL data (pre-ranked tier-tagged command-slug lists a production caller builds from its OWN scope)" and it "widens what this function ACCEPTS, not what it DOES".
- Existing producer to copy: `buildTierCandidates(sensorReaches, projectionOffer)` in `lib/core/orchestration-candidate-lift.cjs:79`, which groups option command slugs by family preserving option order.
- Exports (line 1082-): `rankForSelector`, `selectWhyContent`, `renderInvestmentBadge`, `renderSliceBadge`, `renderNoneFitAffordance`, `MAX_K`, `BEHAVIORAL_CHANNEL_FLOOR/CEILING/MARGIN`, and more.
- Line 378-380 already reads `serves_jtbd`: "one of the command's `serves_jtbd` entries; otherwise fall back to `serves_jtbd[0]`".

**Recommendation (Canon Part 7):** the ledger-ordered survivors enter as a `tierCandidates`-shaped list built by a new pure producer (suggested `lib/core/section-ruling-candidates.cjs::buildLedgerCandidates(folderJobId, problemType, stage, ledger, decisionTraces)`), threaded through `decide()` alongside the existing producers. **No frozen scalar changes. No new sensor. No second selection brain.** This satisfies D-353-3 verbatim while leaving the dial untouched, and it keeps WD-353-1's "confidence floor 0.5" from colliding with the frozen 0.70 detent (they measure different things: the ledger's Jev score-confidence vs the dial's brain_confidence).

`lib/core/navigation-engine.cjs` (1926 lines):
- `decide(turn, context)` at **line 945**. `const decideStartMs = Date.now()` at line 949, comment: "LOCAL monotonic clock for the decide()-body latency budget telemetry... guards the 1200ms NAV budget". The result lands in `_meta.latencies_ms`, LOCAL trace JSON only. **The 1200 ms budget is measured through `_meta.latencies_ms`, not enforced by a timer**; nothing aborts on overrun. Measurement is therefore a test assertion, not a runtime guard.
- `dispatchSensors` is consumed **once**, before any return path (line 956-962), with `sensorTuple = { problem_type, complexity, stage }` and `sensorCtx = { roomDir, lowFillSections, ... }`.
- The producer-block idiom is established three times over (MED-01 cortex at 981-1000, SENS-11 expert at 1002-1045, SENS-16 content-relevance at 1046-1100+). Each reads LOCAL state in the engine at ctx-assembly time, never inside a pure sensor, and each is wrapped in try/catch with a soft-fail degrade. **A ledger-candidate producer follows this exact shape.** The SENS-16 block's own comment (line 1058-1060) even sets the cost expectation: "lexicalSearch is sync and measured at 0-1 ms on a warm index, so this block is free against the 1200ms NAV budget". A JSON read of the shipped ledger, cached at module load, is in the same class.

`lib/core/insight-sensors.cjs`:
- `SENSOR_REGISTRY` (line 733-772): **22 sensors**, ending at `sensorStrategyReach` (SENS-20, Phase 345).
- `SENSOR_REGISTRY_IDS` (line 797-821): **index-parallel**, `Object.freeze`d, 22 ids. Lockstep is enforced by TWO gates named in the header (lines 782-789): `node scripts/build-connector-registry.cjs --check` and `node tests/test-245-priority-complete.cjs`, plus a `SENS_PRIORITY` doctrine table.
- Exports (line 936-943) include `dispatchSensors` (line 891) and both arrays.
- **This phase adds no sensor**, so the seven-place lockstep is untouched. Stating it here so no plan drifts into adding one.

`lib/core/recipe-maps.cjs` (442 lines): `postureForCommand` (181), `wiringForReach` (210), `rankedNextReach` (243), `recipeForCause` (326), `NAMED_RECIPES` (355), `recipeForName` (373), `loadManifest` (411), `manifest` (416), `__reset` (421). It loads `data/connector-registry.json`, `data/brain-orchestration-projection.json`, `data/harness-manifest.json` (lines 76-78). This is where a `serves_jtbd:<slug>` recipe key resolves; an unknown slug misses cleanly.

**`context_assemble`** is `lib/mcp/tools/context.cjs` (registered line 34-90). It delegates to `navigation.getRoomContext(db, roomId, opts)`.

`lib/core/navigation/room-context.cjs`:
- `async function getRoomContext(db, roomId, opts)` at **line 287**. Signature documented lines 279-286: `@param opts { seedFragments?, topK?, fragmentWindow?, maxDepth? }`, returns `Promise<{summary, recentMessages, relevantNodes, cortexNodes, _meta}>`.
- **Four legs**, timed into `_meta.legTimingsMs.{legA,legB,legC,legD}` (line 411-416).
- **`_meta` already carries `legCostChars` and `legCostTokensApprox`** (lines 417-418) and an `estimateOnly` mode (line 390) that nulls the bodies and returns exact costs. Comment at line 380-385: all four legs are "inside the same 1200ms NAV budget every normal call already respects". **This is the measurement surface for success criterion 2** (see Seam 10).
- The tool's own MCP schema exposes `fragment_window`, `fragment_char_cap`, `top_k`, `max_depth`, `focus_node_id`, `estimate_only`. Adding a fifth leg (the `icm_self` room-context read) means adding `legE` to `legTimingsMs`, `legCostChars` and `legCostTokensApprox`; the return shape comment at line 393-399 warns every existing field must stay byte-stable, so the add must be **purely additive**.
- `connectors` export (line 97-107): `hitl_shape: 'none'`, `layer: 'context'`. Adding a read leg does not change either; adding a write would.

### Seam 7 - Filing (`artifact_file`, `claim_write`, the navigation write door, the anchor precedent)

**Verdict: EXTEND (gate at the tool boundary) + NEW `jtbd-anchor.cjs` as a near-clone of `goal-anchor.cjs`. Zero new edge types, zero new epistemic types.**

`lib/mcp/tools/claim.cjs`:
- `claim_write` registered at line 97. Schema: `knowledge_type` (`z.enum(Array.from(navigation.KNOWLEDGE_TYPES))`), `text` (1..10000), `source_segment` (doubles as the idempotency key), `source_speaker`, `conditions`, `counter_conditions`, `valid_from`, `valid_until`, `disambiguation`. **There is NO `section` parameter and no `serves_jtbd` parameter.** The section is implicit in the session-bound room, not the folder.
- Handler flow: `writePathRefusal(server, ctx)` (line 85-93, refuses with `reason:'write_path_disabled'`) -> `resolveEffectiveSessionId` -> `resolveSessionRoomDir` -> `navigation.openRoomDbForCaller(roomDir)` -> `navigation.writeClaimNode(db, {...})` -> `textResponse(...)` -> `finally navigation.closeRoomDbForCaller(db)`.
- `connectors` (line 163-174): `hitl_shape: 'F.1'`, `layer: 'harness'`.
- **Planning consequence:** D-353-8's gate on `claim_write` needs a section/job to compare against. Either add a `section` parameter (a schema widening, which changes the born-wired source of truth and requires `build-connector-registry.cjs` regeneration) or resolve the section from `navigation.getActiveFocus(db)` (exported at `navigation.cjs:75`). **The focus route is the reuse answer** and keeps the MCP schema byte-stable.

`lib/mcp/tools/views.cjs`:
- `artifact_file` registered at line 317. Schema: `section` (`z.string().regex(SECTION_RE)`), `filename`, `content`, `epistemic_type` (`z.enum(Array.from(ALLOWED_EPISTEMIC_TYPES))`, default `'conclusion'`), `evidence_node_ids` (array, max 64).
- `fileArtifact(db, roomDir, p)` already does three things the phase needs: it logs `navigation.logMemoryEvent(db, 'mcp_client_event_logged', { label:'artifact_file', section, filename, artifact_id })` (line 195-200), mints `navigation.REASONING_NODE_ID('claim:artifact', artifactId)` (line 208), and calls `navigation.writeReasoningNode(db, { nodeId, nodeType:'claim', epistemicType, text, section, sourcePath:'artifact:'+artifactId, evidenceNodeIds, framework:null, origin:'artifact_file' })` (line 214-224). The tool docstring (line 319) states it "writes ... plus SOURCED_FROM provenance edges to evidence_node_ids, through the SAME shared writer gate_answer's approve branch uses". **`SOURCED_FROM` from a claim node is therefore already the shipped idiom on this exact path.**
- Returns `{ ok, file_path, artifact_id, memory_event, reasoning_node }` (line 250-256). `connectors` (line 371-378): `hitl_shape: 'F.1'`, `layer: 'harness'`.

`lib/core/navigation/edges.cjs`:
- `ALLOWED_EDGE_TYPES` is `Object.freeze(new Set([...]))` starting line 32. **Measured: 44 members.** Full list: `DEFERRED, REJECTED, DERIVED_FROM, FILED_AS_DECISION, FOLLOWS_FROM, OPERATOR_TRANSITION, INFORMS, REJECTED_BECAUSE, CONTRADICTS, SUPERSEDES, AFFILIATED_WITH, PIVOTED, SELECTED_REACH, FEEDS_INTO, VALIDATES, STATES, SUPPORTS, DESCRIBES, REFINES, ROOT_CAUSES, INSTANTIATES, DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO, CONVERGES, INVALIDATES, ENABLES, NESTED_WITHIN, SHARES_JOB, ELEVATES_TO, UMBILICAL_TO, DISCOVERED, AUTHORED_BY, REMEMBERED_AS, ATTRIBUTED_TO, NOT_REMEMBERED_BECAUSE, COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO, CONCERNS, MAPS_TO_SECTION, SOURCED_FROM, USES_FRAMEWORK`.
- **WD-353-2 resolves to `SOURCED_FROM`.** It is the type `artifact_file`'s own shipped path already writes from a claim node, and Phase 345 used it for gate decisions into `goal:<slug>`. Three other members are semantically tempting and should be explicitly rejected in the plan so the choice is recorded: `SHARES_JOB` is in use by `lib/core/fusion-router.cjs:358` for a frame-to-frame horizontal move, `MAPS_TO_SECTION` by `lib/core/navigation/grant-rubric.cjs:134` for a criterion-to-Section link, and `PART_OF` has no claim-to-anchor precedent. **Add no new member** (D-353-10, WD-353-2).
- The header comment at lines 575-577 records the test convention: "tests assert a FLOOR + named membership, never an exact count", so a future addition cannot regress the baseline. That is why adding an edge type is safe and adding an EVENT_TYPE is not (see Pitfalls).
- `writeEdge(db, params)` at **line 1048**. Params destructured line 1052: `{ source_id, target_id, edge_type, properties, review_status }`. Validation order: params object (1049), `source_id` non-empty string (1053), `target_id` (1056), `edge_type` in `ALLOWED_EDGE_TYPES` (1059), deprecation probe (1068), optional `review_status` against `VALID_REVIEW_STATUS` (1071-1073).
- **`writeEdge` never probes whether either endpoint has a node row** (the FK was removed in Phase 169 D-169-11). This is stated as a BLOCKING ordering rule in `goal-anchor.cjs:47-56`: an edge to an id that was never inserted **succeeds and becomes a new dangling-edge row**, one of the exact defects Phase 343 counts. **Mint the `jtbd:<job_id>` node first, confirm `ok:true`, then write the edge. Every time.**

`lib/core/node-insert.cjs`:
- `ALLOWED_EPISTEMIC_TYPES` at line 113-117, **exactly 10 members**: `observation, extracted_fact, derived_fact, model_derived_assertion, interpretation, hypothesis, assumption, conclusion, recommendation, decision`. `observation` (D-353-8's choice) is already a member. **No change needed.** `lib/core/node-insert-epistemic.test.cjs:84` asserts `ALLOWED_EPISTEMIC_TYPES.size === 10` exactly; adding a member would break it. Nothing in this phase needs one.
- `insertNode(db, id, type, propertiesJson, opts)` validates `opts.epistemic_type` against the set at line 211.

**The anchor precedent to clone: `lib/core/navigation/goal-anchor.cjs` (160 lines, Phase 345-06).** Exports `{ mintGoalAnchor, GOAL_ANCHOR_ID }`, re-exported at `navigation.cjs:258-259`. Its header states five things the `jtbd:` anchor must copy verbatim in spirit:

1. The node is a **projection, not a home**. The home is `<roomDir>/.mindrian/jtbd-state.json` for the goal; for this phase the home is `.mindrian/room-map.json` + the section canon. "Do not build a second store here."
2. **Point 2 explicitly defers this phase's node:** "Seeding `jtbd:<slug>` to revive focus.cjs Rule 1 is a different fact and a different phase (345-ICM-CONSULT R10)." That is Phase 353.
3. **`node.type` is `'goal'` and NEVER `'claim'`** - "a `claim`-typed anchor with nothing above it would land in Phase 343's `unanchored_claims` numerator as a brand-new unanchored claim in every room". **The `jtbd:<job_id>` node must therefore use a non-claim type (suggested `'jtbd'`), or this phase will manufacture up to 16 new unanchored claims per room while claiming to close the unanchored-claim gap.** This is the single sharpest trap in Seam 7.
4. `epistemic_type` is the weakest honest member at `review_status: 'proposed'`. `goal-anchor` chose `'assumption'`; D-353-8 chose `'observation'` for the jtbd node (a folder's declared job is a fact about the folder), which is consistent with the same reasoning and stronger-but-honest. Keep `review_status: 'proposed'`, promoted only by `navigation.confirmNode`.
5. An anchor with zero inbound edges is harmless but increments the node census. Say so in the module header.

Implementation body (lines 100-138): validate `db` and slug first, `SELECT id FROM nodes WHERE id = ?` to compute `created`, then `insertNode(db, id, 'goal', '{}', { source_path:'system:goal-anchor', created_by:'system', epistemic_type:'assumption', review_status:'proposed', on_conflict:'nothing' })`, wrapped so a fault returns `{ ok:false, reason:'anchor_write_failed', detail }` and never throws. **`on_conflict: 'nothing'` is load-bearing**: it makes the re-mint byte-identical and never touches `last_seen_at`.

**Phase 345's `jtbd-state.json`:** `lib/hmi/jtbd-state.cjs`, `statePath(roomDir)` at line 48 returns `path.join(roomDir, '.mindrian', 'jtbd-state.json')`, atomic tmp+rename `writeStateAtomic` at line 77-83. Exports include `getCurrent`, `setCurrent`, `bumpTurnCount`, `clear`, `history`, `getGoal`, `setGoal`, `goalHistory`, `isStale`. **`.mindrian/room-map.json` is a direct sibling of `.mindrian/jtbd-state.json`** and inherits the same atomic-write idiom. Measured: `jtbd-state.json` exists in 10 rooms today.

`lib/core/navigation.cjs` re-exports the whole write door. Relevant lines: `getActiveFocus` 75, `setFocus` 76, `logMemoryEvent` 124, `writeEdge` 161, `writeClaimNode` 224, `KNOWLEDGE_TYPES` 225, `CLAIM_NODE_ID` 226, `writeReasoningNode` 242, `REASONING_NODE_ID` 243, `mintGoalAnchor` 258, `GOAL_ANCHOR_ID` 259, `promoteNodeStatus` 118.

### Seam 8 - Theo pull and the release hook

**Verdict: NEW `scripts/build-section-command-ledger.cjs` + `data/section-command-ledger.json`. The puller is a verbatim port of the Spike 002 code; the release wiring is EXTEND.**

`lib/core/brain-client.cjs`:
- `async function query(cypher, params)` at **line 920**. It classifies the payload through `part8-egress-guard.cjs::classify({cypher}, {toolName:'brain_query'})` first and returns `null` on a proven `block` verdict (an `ambiguous` verdict is expected policy and is NOT blocked). It then calls `callTool('brain_query', { cypher, params })`.
- **Return-shape normalization is the trap.** Three shapes are recognized: a bare array -> `{ records: [...] }`; an already-normalized `{records:[]}`; and **Theo's own `{ rows, diagnostics }` contract shape**, guarded on `Array.isArray(result.rows)` never mere key presence. An unrecognized shape returns `{ records: [], error: 'brain_query_unrecognized_shape', shape_type, shape_keys }` plus one warn-once line (the 2026-09-03 quick/260903-eit fix). **The caller must read `(res && (res.rows || res.records)) || []`**, which is exactly what the Spike 002 puller does.
- `lib/core/brain-client.cjs:24` is the single source of the default Theo URL (`theo-mcp.onrender.com`).

**Spike 002 puller, `.planning/spikes/002-jev-section-framework-ranker/rank.cjs::pullTheoFrameworks` (line 145-195).** The traps it encodes, each measured 2026-09-17, all of which apply verbatim:
- Theo enforces `ROW_CAP=100`; an over-cap query returns **only** `{text:"ROW_CAP: ..."}` with **zero rows** while the message claims it returned 100.
- `SKIP` is `PLAN_REJECTED` (not on the read allow-list). So is a range predicate on the indexed `name` (`NodeUniqueIndexSeekByRange`), and so is `Distinct` (which an `OR ... IS NULL` plans).
- A **function-wrapped** predicate forces `NodeByLabelScan + Filter`, both allow-listed. Hence `toLower(left(f.name, $n)) = $prefix`.
- **Two FIXED query texts; every variation rides in `$params`** (line 157-158: "The substrate rule m4 forbids Cypher assembled by concatenation, and this is exactly why it exists"). `CYPHER_PREFIX` at 160-167, `CYPHER_OTHER` at 168-175.
- 36 buckets (`0-9`, `a-z`) plus one catch-all `NOT toLower(left(f.name,1)) IN $alnum`; recursive split to `depth >= 2` on a cap hit (line 177-188). Largest bucket observed: 47. 410 rows in about 48 s.
- `coalesce(f.alias_of,'') = '' AND coalesce(f.canonical,true) <> false` is the canonical filter. 452 Framework nodes, 410 canonical.

**IP egress ruling (navigator, 2026-09-17, from `.claude/skills/spike-findings-MindrianOS-Plugin/references/section-framework-ledger.md:8-12):** only the framework **name**, a **JTBD statement** (rendered from the Brain's closed job vocabulary on `jtbd_anchor` through a `JTBD_MAP`) and a **glossary line** (`definition`, else the first sentence of `description` capped at 140 chars) may cross to Jev. Full Theo descriptions never cross unless the navigator runs it himself with `SPIKE_DESC=full`.

**Jev API contract** (`.claude/skills/spike-findings-MindrianOS-Plugin/references/jev-typed-decisions-api.md`, measured against `jev-1.13.0`): `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`, body `{ model, state, questions }`. Question types `choice`/`score`/`noul`. Key at `~/.secrets/typesafe.env` mode 600 as `TYPESAFE_API_KEY=`, never hardcoded, never printed, never committed. Backoff `400 * 2 ** attempt` ms, max 4 attempts, on 429/529; pool at concurrency 4-6. 20 Score questions per call was safe across 84 calls with 0 failures. Level descriptions "describe situations, not degrees".

**Release wiring.** `scripts/release.sh`:
- **Step 2.4** (line 356-370) is the coverage-gate step and already runs three `--check` gates: `build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs`. **This is the wrong place for the ledger build** (it would require a Theo connection and a Jev key on every release), but it IS the right place for a `build-section-command-ledger.cjs --check` **staleness assertion** that compares the shipped ledger's `plugin_version`/`built_at` against the release without calling anything.
- **Eleven `scripts/build-*.cjs` support `--check`** today: brain-census, brain-packet-schema, command-registry, connector-registry, corpus-stats, dist-bundles, harness-manifest, new-surface, orchestration-projection, render-coverage, skill-mirrors. The new builder joins that family.
- **Step 0.6** (line 185-196) is the **LAGGING** Theo stamp gate (`mos_theo_stamp_gate "$PLUGIN_DIR" "$DRY_RUN" "$NO_THEO_CHECK"`), run before any mutation and **before `NEW_VERSION` is computed**; under `--dry-run` it performs the real read and prints the verdict but never aborts.
- **Step 5.6** (line 313) is the **LEADING** half: a `repository_dispatch` at `jsagir/theo`, event `theo-resync`, payload `{version, commit, registryHash, command_registry_path}`, fired immediately after the tag is verified at origin.
- `scripts/release-lib/theo-notify-gate.sh` (340 lines) holds both halves and is sourced in the preamble (line 123-127), with a hard refusal if the file is missing.
- **The two opt-outs are separate flags, both audited, never silent:** `--no-theo-check` (`NO_THEO_CHECK`, line 147/165) and `--no-theo-notify` (`NO_THEO_NOTIFY`, line 148/166). D-353-6's "Jev unavailable at release keeps the last ledger and logs an audited flag, the `--no-theo-check` shape" maps to a third flag of the same family, e.g. `--no-ledger-rebuild`, declared in `USAGE_BLOCK` (line 149) and named in the release log with its consequence.
- Step 6.6a already verifies every `data/doctor-modules.json` runner exists, with the same rollback as Step 6.6.
- **The `theo-resync` payload would need a `section_registry_path` + registry hash for OQ-353-2.** That field does not exist today (payload is the four keys above). Adding it is a Phase 353 edit; Theo consuming it is the Theo-repo side, out of scope.

### Seam 9 - Fixtures and evals

**Verdict: EXTEND conventions, NEW directories.**

`tests/fixtures/` holds ~40 entries. **Existing fixture rooms** (the naming is not uniform): `tests/test-room`, `tests/fixtures/sample-room`, `sample-room-opp`, `sample-room-personas`, `test-room-meeting`, `test-room-causal`, `test-room-reasoning`, `test-room-graph`, `test-room-visual`, `graph-export-golden-room`, `wiki-room-232`, `futures-seed-room`, `tests/claim-harness/fixtures/claim-room`, and per-phase `phase-109/sample-room`, `phase-129/sample-room`, `phase-129.5/sample-room`, `phase-130.5/sample-room`, `phase-131/sample-room`.

**The best template for `tests/fixtures/icm-rooms/` is `tests/fixtures/195-nested-room-tree/`**, because it is the only committed fixture that models nesting:

```
195-nested-room-tree/root-room/{.room-root, ROOM.md, STATE.md, MINTO.md, USER.md, FEYNMAN.md, BRAIN.md}
  section-alpha/{ROOM.md, STATE.md, MINTO.md, USER.md, FEYNMAN.md, BRAIN.md}
    sub-room/{.room-root, ROOM.md, STATE.md, MINTO.md, USER.md, FEYNMAN.md, BRAIN.md}
      sub-sub-room/{...}
```

Note the **six-file memory complement** at every level (ROOM, STATE, MINTO, USER, FEYNMAN, BRAIN) and the `.room-root` sentinel at each room boundary but NOT at `section-alpha`. `tests/test-195-recursive-reconcile.cjs:172` asserts `files.length === 16` ("8 dirs x 2") against this tree - **an exact-count assertion on a fixture tree.** If Phase 353 adds files to this fixture, that test breaks. **Build `icm-rooms/` as a NEW sibling; do not extend `195-nested-room-tree`.**

`evals/` exists with two sub-directories, `evals/eureka/` and `evals/plurai/`. `evals/eureka/` is the closer model: it holds a `README.md`, per-phase report `.md` + `.json` pairs (`211-room-report.md`, `212-calibration-report.md`, `212-critic-baseline.json`, `215-jhtv-portfolio-report.{md,json,graph-mode.md,graph-mode.json}`), a `cases/` dir and a `.calib-work/` scratch dir. `evals/plurai/` is baseline JSON + labelled CSV. **`evals/icm/` follows the eureka shape: `README.md`, one checklist file per writer, `cases/`, and a `last-run.json` the acceptance point reads.**

`tests/run-all-<phase>.sh` convention, from `tests/run-all-345.sh` (the most recent full example):
- `#!/usr/bin/env bash`, a header block listing **which requirement id each leg gates**, then `set -uo pipefail`, `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"`, `cd "$ROOT"`, counters `PASS/FAIL/SKIP`, and `run()` / `run_if()` helpers.
- **A binding convention is stated in that file's header (lines 25-31) and should be honoured here:** "this aggregator is written ONCE, here, in 345-01, and NO LATER PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file; the `run_if` legs below and the em-dash guard's targeted glob both pick up a landed file automatically."
- Each aggregator carries its own **targeted em-dash guard glob** over the phase's own files.

**De Stijl report renderer.** There is **no shared renderer module**; each report inlines its own CSS. The closest and most directly reusable is **`.planning/spikes/002-jev-section-framework-ranker/report.cjs`**, whose header states the exact contract Unit 3 needs: "renders results.json as a static De Stijl HTML page the navigator can open and feel. No CDN, no deps, inline CSS/JS, hyphens only." Its palette is `--red:#D40920; --blue:#1356A2; --yellow:#F7D842; --black:#111; --white:#FAFAF7`, 3px/6px black rules, IBM Plex Sans. It also ships a mirrored `report.html`. Other in-repo De Stijl renderers for reference: `scripts/eureka-portfolio-report.cjs`, `scripts/generate-deck.cjs`, `scripts/generate-snapshot.cjs`, `scripts/generate-hub.cjs`, `scripts/help-renderer.cjs`. **Port `report.cjs` into `scripts/eval-icm-writers.cjs`'s renderer half rather than authoring a new palette.**

### Seam 10 - Token measurement

**Verdict: REUSE. Two existing estimators, one already wired into the exact code path success criterion 2 measures.**

`lib/core/token-estimator.cjs`:
- `estimateTokens(str)` at **line 123-127**: `Math.ceil(str.length / 4)`, returns 0 on a non-string or empty string. Header comment line 30 and 118-122: "Chars-over-4 estimator, matching Phase 88-07 triple-context-formatter... so the two producers are interchangeable."
- Also exports `estimateRoomTokens` (walks a room summing `.md` byte length / 4, `MAX_ROOM_DEPTH = 12`, module-level `roomTokenCache` Map), `clearCache`, `validateEventShape`, `classifyRatio`, `aggregateEvents`, `BELOW_THRESHOLD_RATIO`, `EVENT_REQUIRED_FIELDS` (lines 338-348).

Two sibling copies of the same function exist with the same semantics: `lib/memory/sessionstart-banner-formatter.cjs:135` (exported line 316, used for a per-row budget at line 275-294 with a `ROW_OVERHEAD_TOKENS` constant) and `lib/memory/triple-context-formatter.cjs:105` (exported line 468, with a hard guarantee at line 384: "`estimateTokens(output) <= getBudgetTokens()`"). **Use `lib/core/token-estimator.cjs::estimateTokens` as the single measurement function** and cite the interchangeability comment; do not add a fourth copy.

**The already-wired measurement surface is `getRoomContext`'s `_meta.legCostChars` and `_meta.legCostTokensApprox`** (`lib/core/navigation/room-context.cjs:417-418`), with `opts.estimateOnly` (line 390) nulling the bodies while keeping the exact numbers. Its own header (lines 380-389) states these are "EXACT size, not a guess". Success criterion 2 ("per-turn self-location plus ruling read under 400 tokens") is therefore measured, not estimated, by adding the `icm_self` block and the ruling sequence as a fifth cost entry and asserting `legCostTokensApprox.legE < 400` on the fixture rooms.

**Nothing in this repo uses a real tokenizer.** Every "token" number is chars/4. That is a house convention, not a measurement error, but the plan should say "chars-over-4 approximation, the repo's own estimator" rather than "tokens" unqualified, so the < 400 claim is honest.

## Measured Fleet Census (2026-09-17, this session)

Re-measured because three of the six success criteria quote fleet numbers, and two of those numbers are ambiguous against what the code actually walks.

| Measure | Count | Command |
|---------|-------|---------|
| Top-level rooms with `.mindrian` | **31** | `ls -d ~/MindrianRooms/*/.mindrian \| wc -l` |
| Root `.room-root` sentinels (depth 2) | **31** | `find . -mindepth 2 -maxdepth 2 -name .room-root \| wc -l` |
| Nested `.room-root` sentinels (depth >= 3) | **31** | `find . -mindepth 3 -maxdepth 9 -name .room-root \| wc -l` |
| Registry entries carrying `parent` | **25 of 56** | parsed from `~/MindrianRooms/.rooms/registry.json` |
| Registry entries carrying `depth` | **partial** (values seen: `1`, absent) | same |
| Depth-1 directories under the 31 roots (sections + structural) | **401** | per-room `find -mindepth 1 -maxdepth 1 -type d -not -name '.*'` |
| ... of which **missing ROOM.md** | **102** | same walk |
| **All** non-dot directories under the 31 roots, maxdepth 8 | **2,024** | per-room `find -mindepth 1 -maxdepth 8 -type d -not -path '*/.*'` |
| ... of which **missing ROOM.md** | **914** | same walk |
| **Roots** missing ROOM.md | **6** | per-room `[ -f "$r/ROOM.md" ]` |
| Section `CONTEXT.md` files in the entire fleet | **11, all in one room (`axiom`)** | `find ~/MindrianRooms -name CONTEXT.md -not -path '*/.*'` |
| Rooms carrying `.mindrian/jtbd-state.json` | **10** | `find ~/MindrianRooms -maxdepth 3 -name jtbd-state.json` |
| Commands in `data/command-registry.json` | **113** | parsed |
| Distinct `serves_jtbd` values | **16** | parsed |
| Entries in `lib/hmi/jtbd-taxonomy.json` | **13** | parsed |
| Modules in `data/doctor-modules.json` | **24** | parsed |
| Acceptance points in `scripts/doctor.cjs` | **21** | `grep -c "      id: '"` |
| `ALLOWED_EDGE_TYPES` members | **44** | parsed from `edges.cjs` |
| `ALLOWED_EPISTEMIC_TYPES` members | **10** | `node -e` require |
| `EVENT_TYPES` members | **102** | `node -e` require |
| Sensors in `SENSOR_REGISTRY` | **22** | read |

**Three reconciliations the planner must make explicitly:**

1. **"0 directories without ROOM.md (7 today)" is true only for ROOTS** (measured 6, not 7, today; one was presumably healed since the census). The whole-tree number is **914**. If `icm_self` goes on every directory's ROOM.md, `--fix` creates 914 new ROOM.md files fleet-wide and writes ~2,000 blocks.
2. **"155 nested sub-rooms" does not reproduce.** Measured: 31 nested `.room-root` sentinels, 25 registry entries with `parent`. The 155 may count `sub-rooms/*` children (510 measured, but those include per-artifact folders under Decision 16). The doctor's sub-room checks should key on the **`.room-root` sentinel**, which is the boundary `discoverSections` already respects (`section-registry.cjs:128`) and `room-md-module.cjs` uses (`room-md-module.cjs:119`).
3. **"390 section directories" is close to the measured 401 depth-1 directories**, which includes the three `STRUCTURAL_DIRS` plus dot-identity dirs excluded. The design's Unit 1 `kind` enum (`root | section | structural | sub-room`) covers all four classes, so this reconciles.

## Pitfalls

Ordered by how expensive each one is to discover at execute time rather than plan time.

### Pitfall 1: The two Phase 275 assertions that directly contradict D-353-7

`tests/test-275-section-schema.cjs`:
- **line 330**: `assert(noFrontmatter, 'no contract template has YAML frontmatter')`
- **line 366**: `assert(allByteIdentical, 'every landed CONTEXT.md is byte-identical to its template')`

D-353-7 requires the ruling document to carry frontmatter (`icm_layer: 2, job_id, ruling_fingerprint, generated_at`) and six generated parts that are NOT byte-identical to any template. **Both assertions will fail.** They are not incidental: they encode T-275-13's deliberate ruling that contracts are static prose, not parameterised templates, because "a stray `{{` in prose corrupt[s] a room file".

**How to avoid:** a named task in Plan 2 that amends both assertions with a phase-cited comment (the established idiom in this repo, e.g. the `SECTION_NAMES` FROZEN TABLE CONTRACT note at `room-skeleton-scaffold.cjs:538-544`). The replacement assertions should be: (a) every generated part is inside the marked block and every byte outside it is byte-identical to the authored prose; (b) `ruling_fingerprint` recomputes to the same value on a second generation. **Do not** re-introduce `renderTemplate` substitution over the contract prose; the T-275-13 reasoning still holds. Compose the generated block separately and splice it, never substitute into the authored text.

### Pitfall 2: EVENT_TYPES exact-size assertions (two already RED at HEAD)

`EVENT_TYPES` in `lib/core/navigation/memory-events.cjs:10` has **102** members today.

- `tests/test-auto-explore-telemetry.cjs:432`: `assert.equal(EVENT_TYPES.size, 32, ...)`. **Verified RED this session:** `node tests/test-auto-explore-telemetry.cjs` -> `pass 14, fail 1`.
- `tests/test-131-substrate.cjs:98`: `equal(EVENT_TYPES.size, PRE_131_EVENT_BASELINE + 3)` with `PRE_131_EVENT_BASELINE = 70` (line 52), so it expects 73. **Verified RED this session:** `12 passed, 2 failed`.
- The correct convention is at `tests/test-130-lens-engine.cjs:100-110`, which computes a baseline by subtraction and asserts a **delta of exactly 5**, with the comment "FLOOR-not-exact-size convention... never a brittle absolute size".

**How to avoid:** **do not mint a new `EVENT_TYPES` member for the `job_mismatch` disclosure.** `artifact_file` already logs through `navigation.logMemoryEvent(db, 'mcp_client_event_logged', { label: 'artifact_file', section, filename, artifact_id })` (`views.cjs:195-200`). The disclosure rides as additional properties on that same event (`job_mismatch: true, declared_job, section_job, reason`). This is Canon Part 7 reuse and it sidesteps both red assertions entirely. **Warning sign:** if a plan task says "add `job_mismatch` to EVENT_TYPES", it has taken the expensive route. **Separately: the two red tests are PRE-EXISTING failures unrelated to this phase. No plan may claim them as green, and no plan should silently "fix" them by editing the literal without a phase-cited comment.**

### Pitfall 3: `ALLOWED_EPISTEMIC_TYPES.size === 10` is an exact assertion

`lib/core/node-insert-epistemic.test.cjs:84`: `assert.strictEqual(ALLOWED_EPISTEMIC_TYPES.size, 10, 'the closed enum has exactly 10 members')`. **This phase needs no new member** (`observation` is already in). Named so no plan drifts into one. Note the contrast with `ALLOWED_EDGE_TYPES`, whose own header (`edges.cjs:575-577`) records that "tests assert a FLOOR + named membership, never an exact count" - the two enums have opposite test conventions.

### Pitfall 4: `writeEdge` writes a dangling edge if the anchor node was not minted first

`writeEdge` (`edges.cjs:1048`) validates only the two id strings and the edge type. **The foreign key was deliberately removed in Phase 169 D-169-11.** `goal-anchor.cjs:47-56` names this as BLOCKING: an edge to a never-inserted id "still succeeds and becomes a NEW dangling-edge row - one of the exact defects Phase 343 exists to count. Mint first, or do not point at it."

**How to avoid:** the filing gate calls `mintJtbdAnchor(db, roomSlug, jobId)` and checks `ok === true` **before** `writeEdge`. A failed mint means no edge, and the write still lands (Canon Part 9, the write is never blocked by bookkeeping). **Warning sign:** any code path where the edge write and the node mint are in the same `try` with the edge first.

### Pitfall 5: A `claim`-typed `jtbd:` anchor would manufacture unanchored claims

`goal-anchor.cjs:27-31` point 3, verbatim: "`node.type` IS `'goal'` AND NEVER `'claim'`. A `claim`-typed anchor with nothing above it would land in Phase 343's `unanchored_claims` numerator as a brand-new unanchored claim in every room that ever renders a strategy card."

The `jtbd:<job_id>` node is seeded **one per job per room** at map build. With up to 16 (or 20 after the vocabulary extension) jobs across 31 rooms, a `claim` type would add up to ~500 new unanchored claims fleet-wide **while the phase's own success criterion 3 claims to close that gap.** Use a distinct `type` (suggested `'jtbd'`), and state the node-census increment in the module header exactly as `goal-anchor.cjs:41-45` does.

### Pitfall 6: D-03 parity (non-empty `detail` on EVERY doctor return path)

Named at `room-md-module.cjs:139`, `cascade-rooms-module.cjs:88`, `cascade-rooms-active-module.cjs:24`, `ui-compliance-module.cjs:206`, `card-fire-health-module.cjs:140`. Every `ok`, `warn`, `error` and `skip` return from both new modules needs a non-empty `detail` string. **Warning sign:** an early-return `{ status: 'skip' }` with no detail; the engine records it and the report row prints blank.

**Related, separate:** Phase 352's D-352-4 adds a **new parity rule** making `auto_heal` mandatory on every `fix_supported: true` row. Both new modules are `fix_supported: true` per D-353-9. See Open Question 1.

### Pitfall 7: `check()` and `fix()` are called synchronously

`scripts/doctor.cjs` `runAccumulativeEngine` ALWAYS pass (lines 2657-2720+) calls `checkFn(ctx)` and `fixFn(...)` with **no `await`** anywhere in the dispatch. An `async` runner returns a `Promise`, which `Object.assign({id, status:'ok'}, promise)` flattens into a row with no `status` and no `detail`. **Everything in both modules must be sync:** `fs.readdirSync`, `crypto.createHash('sha256')` over sorted tuples, `gray-matter` parse (sync). **Warning sign:** an `async function check` or a `.then()` in a runner.

### Pitfall 8: `check-substrate.cjs` chokepoint rules (pre-commit, exit 1 on staged violations)

`scripts/check-substrate.cjs` in `--diff` mode exits 1 on any staged violation. Six rules, with their exact regexes:

| Rule | Regex/pattern | Risk in this phase |
|------|---------------|--------------------|
| `chokepoint-require` | `require('.../{room-db,lazygraph-ops,memory-ops}.cjs')` | A room-map module tempted to read the db directly. |
| `m3-direct-sqlite-require` | `require('node:sqlite'\|'better-sqlite3')` | Same. |
| `m2-raw-room-db-read` | `(readFileSync\|readFile\|createReadStream)(... room.db` | Low. |
| `raw-graph-write` | `(INSERT INTO\|UPDATE\|DELETE FROM) (nodes\|edges\|memory_event)` | **The jtbd-anchor module must use `insertNode`, never raw SQL.** `goal-anchor.cjs` does one bare `SELECT id FROM nodes WHERE id = ?` (line 113) which is a read and passes. |
| `opengraph-bypass` | `openGraph(` | Low. |
| `m4-cypher-interpolation` | `MATCH (` on a line with `${...}`, or a quoted `MATCH (` followed by `+` | **HIGH for `build-section-command-ledger.cjs`.** The Spike 002 puller assembles `CYPHER_PREFIX` via `[...].join(' ')` on a line-array of string literals; no line contains both `MATCH (` and a `+` or `${}` concatenation of a variable. **Port it verbatim.** The moment a plan writes `'MATCH (f:Framework) WHERE f.name = "' + name + '"'` the commit is refused. |

Note `isPureLineComment` (line 245-247) skips lines starting with `//` or `*`, so documentation prose mentioning a banned pattern is safe.

### Pitfall 9: The frozen constitutional set and the frozen 6-reach dial

`navigation-engine.cjs:1845-1880` (`frozenConstitutionalSet()`) enumerates `MAX_K` 3, `DIAL_REACH_K` 6, `RECOMMEND_FLOOR` 0.70, `MARGIN_THRESHOLD` 0.15. CLAUDE.md Canon Part 3 calls 0.70/0.15 "frozen". `dial-reach-orchestrator.cjs:118-120` says `OFFERED_CAP` mirrors `ranker.MAX_K` "read, never raised", and line 111 pins "DIAL_REACH_K-must-be-distinct-from-MAX_K invariant still holds: 6 != 3".

WD-353-1's "top-K 3" already equals `MAX_K`, so nothing changes. **WD-353-1's "confidence floor 0.5" must be named as a DIFFERENT scalar from the dial's `RECOMMEND_FLOOR` 0.70 and from `REGISTRY_DEFAULT_BRAIN_CONFIDENCE` 0.5** (`dial-reach-orchestrator.cjs:142`), or a reader will conclude the phase moved a frozen detent. **Warning sign:** a plan task that touches `dial-reach-orchestrator.cjs` at all.

### Pitfall 10: The 1200 ms `decide()` budget is measured, never enforced

`decide()` (line 945) stamps `decideStartMs = Date.now()` and writes `_meta.latencies_ms`; nothing aborts on overrun. So "stays inside its existing 1200 ms budget, measured" (D-353-3) is a **test assertion the phase must write**, not a guarantee the engine provides. The producer must be cheap by construction: a module-level cached JSON read plus an array filter, following the SENS-16 precedent whose own comment (`navigation-engine.cjs:1058-1060`) justifies its cost as "sync and measured at 0-1 ms... free against the 1200ms NAV budget". **Warning sign:** a producer that reads a file per turn instead of caching at module load, or one that walks the room tree.

### Pitfall 11: Frontmatter schema hook goes noisy on `icm_self` / `job_id` / the CONTEXT.md keys

`lib/core/frontmatter-schemas.cjs` `selectSchemaKey` (line 279-289) routes `CONTEXT.md` to `artifact-default`; the `ROOM.md` schema's `optional` array does not contain `icm_self` or `job_id`. Unknown keys emit advisory `unknown` violations (line 318) through a PostToolUse hook on every write. This is a WARN not a block (line 466), **but** the module's own header (lines 24-34) records that the last time the validator drifted from the writers it was "a Canon Part 6 dog-food self-violation" and "a noisy false-positive generator". Two edits, named in Seam 3.

### Pitfall 12: Fixture-tree hash and exact-count tripwires

- `tests/test-195-recursive-reconcile.cjs:172`: `assert.equal(files.length, 16, 'expected 16 discovered memory files (8 dirs x 2)')` against `tests/fixtures/195-nested-room-tree/`. **Adding any memory file to that tree breaks it.** Build `tests/fixtures/icm-rooms/` as a new sibling.
- `tests/fixtures/310-release-step-block-hashes.txt` and `tests/fixtures/341-release-step-block-hashes.txt` pin **hashes of `scripts/release.sh` step blocks**. Any edit to a release step (Step 2.4, Step 5.6, the `USAGE_BLOCK`) invalidates the pinned hash. The planner must include a re-pin task for whichever block the ledger wiring touches, and must read those two fixtures before editing `release.sh`.
- `tests/fixtures/341-registry-drift-baseline.json` is a registry drift baseline; a doctor module that changes the registry read path should be checked against it.
- `tests/test-209-declared-implies-wired.cjs:227`: `assert.equal(cjsEntriesBefore.length, 16, 'expected the 16 pre-existing .cjs render entry points')`. `scripts/eval-icm-writers.cjs` emitting HTML could be discovered as a 17th render entry point. Check `scripts/check-render-coverage.cjs`'s discovery rule before naming the file.

### Pitfall 13: Hooks budget

`hooks/hooks.json` SessionStart entries carry explicit `timeout` values (120000 ms for `sessionstart-npm-reconcile.cjs`, 12000 for `sessionstart-post-update-preflight.cjs`, 10000 for `run-hook.cmd session-start` and `sessionstart-coordinator.cjs`). **Nothing in this phase belongs in a hook.** D-353-4 states the eval runner "never runs in a user hook", and the map rebuild is a birth-time / `doctor --fix` act. Named because Phase 352's auto-heal will be adding hook work in the same window; the two phases must not both claim the SessionStart budget.

### Pitfall 14: `.mindrian/` is not a clean directory

Measured: `~/MindrianRooms/mindrianOS/.mindrian/` contains hundreds of `auto-explore-<hash>.json` files alongside `analogy-edges.json`, `auto-commit-throttle.json`, `jtbd-state.json` and more. `room-map.json` lands as one more sibling, which is fine, but **any code that globs `.mindrian/*` will pull in hundreds of irrelevant files.** Read the exact path. Also note every doctor walker (`room-md-module.cjs:66`) and `discoverSections` (`section-registry.cjs:87`) skip dot-directories categorically, so `.mindrian` itself is never a map node.

### Pitfall 15: The `_faultInject` regex is `s[1-5]`

`room-birth.cjs:1193`: `if (typeof options._faultInject === 'string' && /^s[1-5]$/.test(options._faultInject))`. Side effect six cannot be fault-injected until this becomes `s[1-6]`. One character; easy to miss; without it the Unit 1 unwind test cannot be written at all.

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|--------------|-------------|-----|
| Parse ROOM.md / CONTEXT.md frontmatter | A 13th local `parseFrontmatter` | `gray-matter` (already a dep at `package.json:50`; the WR-02 ruling at `tests/test-275-section-schema.cjs:26-28` names it as the repo's parser) | Twelve incompatible copies already exist. |
| Escape a string into a double-quoted YAML scalar | `JSON.stringify` or a hand regex | `room-skeleton-scaffold.cjs::escapeYamlDoubleQuoted` (exported) | It exists because a mid-sentence `": "` already corrupted a room file once (Phase 275-08 CR-01). |
| Atomic file write | `fs.writeFileSync` | The tmp+rename idiom used at `room-birth.cjs:414-416, 465-467, 487-489` and `room-skeleton-scaffold.cjs::atomicWrite` | Phase 124-02 precedent; a torn ROOM.md is worse than a missing one. |
| Mint an anchor node | A raw `INSERT INTO nodes` | `insertNode` via a clone of `goal-anchor.cjs::mintGoalAnchor` (`on_conflict:'nothing'`) | `raw-graph-write` is a `check-substrate.cjs` refusal; the on-conflict semantics are what make the re-mint byte-identical. |
| Write a typed edge | A raw `INSERT INTO edges` | `navigation.writeEdge` | Canon Part 9, the only door. |
| Estimate tokens | A fourth chars/4 helper | `lib/core/token-estimator.cjs::estimateTokens`, and `getRoomContext`'s `_meta.legCostTokensApprox` for the per-turn number | Three copies already agree by design; a fourth adds drift with no benefit. |
| Pull frameworks from Theo | New Cypher | Verbatim port of `.planning/spikes/002-.../rank.cjs::pullTheoFrameworks` (lines 145-195) | ROW_CAP=100, SKIP/Distinct/IndexSeekByRange are PLAN_REJECTED, only a function-wrapped predicate plans. All measured. |
| Call Jev | A new client | The zero-dep `jev(key, body)` + `pool(items, n, fn)` + `400 * 2**attempt` backoff from the spike sources | 84 calls, 0 failures at batch 20 / concurrency 4. |
| Walk a room's subdirectories in a doctor module | A new walker | `room-md-module.cjs::listSubdirs(rootDir, {recursive, maxDepth})` + its `SKIP_DIRS` set | Already tuned for the dot-dir and `node_modules` cases. |
| Feed the F-selector a pre-ranked candidate list | A new selection path | `rankForSelector`'s existing `o.tierCandidates`, producer modelled on `orchestration-candidate-lift.cjs::buildTierCandidates` | "No second selection brain" (CLAUDE.md, spec section 9). |
| Render a De Stijl report | A new palette | Port `.planning/spikes/002-.../report.cjs` (inline CSS, no CDN, no deps) | Already navigator-approved and hyphens-only. |
| Register a doctor check | Inline code in `doctor.cjs` main() | A runner file + a row in `data/doctor-modules.json` | Phase 217 migrated the last inline checks out; Step 6.6a gates the registry. |

**Key insight:** in this repo the expensive mistake is almost never a missing mechanism. It is duplicating one that exists under a slightly different name, which then drifts. Every seam above has a named precedent and a phase citation; the plan should cite the precedent in the task, not just the behaviour.

## Standard Stack

**No new packages. Zero installs. Zero registry risk.**

| Dependency | Version | Already present | Role in this phase |
|------------|---------|-----------------|--------------------|
| Node.js built-ins (`node:fs`, `node:path`, `node:crypto`, `node:os`) | >= 22.16.0 floor | yes | Map walk, sha256 fingerprint, atomic writes. |
| `gray-matter` | ^4.0.3 (`package.json:50`) | yes | Frontmatter parse for ROOM.md and CONTEXT.md. |
| `zod` | ^3.25.76 | yes | Only if an MCP schema widens (avoidable via `getActiveFocus`). |
| `semver` | already required by `doctor.cjs` | yes | `introduced_version` window math, handled by the engine. |
| Global `fetch` | Node built-in | yes | Jev calls in the dev-time build script only. |

`bash tests/run-all-353.sh` is the new aggregator. No test framework installs: this repo uses `node:test` (`test(...)` from `node:test`) for `.test.cjs` files and hand-rolled `PASS/FAIL` counters for `tests/test-<phase>-*.cjs` files, both invoked by the bash aggregator.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external package. Every dependency it touches is already in `package.json` and already required by shipped code. No `slopcheck` run is warranted because there is no candidate package.

## Architecture Patterns

### Pattern 1: The generated-block-in-an-authored-file (the ruling document)

**What:** a fenced, marked, fingerprinted block that a generator owns, sitting above prose a human owns, in one file.
**When:** D-353-7's six parts above the preserved Inputs / Process / Outputs / Human check.
**Precedent in repo:** `templates/room-skeleton/MINTO.md.tmpl` is described at `room-skeleton-scaffold.cjs:506-507` as "the sentinel-bounded content is the contract", and the scaffolder skips MINTO.md entirely if it exists.

```markdown
---
icm_layer: 2
job_id: find-problem
ruling_fingerprint: <sha256 over canon-row + ledger-row + writer-contract version>
generated_at: <iso>
---

<!-- mos:ruling:begin  DO NOT EDIT. Regenerated from data/section-command-ledger.json
     and lib/core/section-registry.cjs by doctor --fix. Edits here are drift. -->
## 1. Job
## 2. Methodology sequence
## 3. Writing rules
## 4. Gates
## 5. Checks
## 6. Commands that write here
<!-- mos:ruling:end -->

# problem-definition - the problem, not a solution
**Statement:** ...
One job: ...
## Inputs
Do NOT load: ...
## Process
## Outputs
## Human check
```

**Non-negotiables from icm-architect invariant 4 and 6:** the generated parts are NOT an edit surface; the prose below IS; the marked boundary is what makes that honest. The `Do NOT load:` line stays authored and mandatory. Exactly one human check per section. The whole file stays in the L2 band (200-500 tokens per `~/.claude/skills/icm-architect/references/core.md:25`); overflow goes to `references/SECTION-SCHEMA.md` (L3, 500-2k), which `writeReferenceDocs` already ships.

### Pattern 2: The payload-free anchor node (`jtbd:<job_id>`)

Clone `lib/core/navigation/goal-anchor.cjs` structurally: validate first, `SELECT id` to compute `created`, `insertNode(db, id, '<non-claim type>', '{}', { source_path:'system:jtbd-anchor', created_by:'system', epistemic_type:'observation', review_status:'proposed', on_conflict:'nothing' })`, return `{ok, node_id, created}` or `{ok:false, reason, detail}`, never throw. Re-export from `navigation.cjs` alongside `mintGoalAnchor` at line 258.

### Pattern 3: The ctx-assembly producer (the ledger candidates)

Copy the MED-01 / SENS-11 / SENS-16 block shape in `decide()` (`navigation-engine.cjs:981-1100`): a braced block, a try/catch that soft-fails to a neutral value, caller-threaded `ctx.*` overrides winning as the test seam, and a comment stating the measured cost against the 1200 ms budget. The producer reads a module-level-cached `data/section-command-ledger.json` and returns a `tierCandidates`-shaped array.

### Pattern 4: The cadence:always doctor module

`{ check(ctx), fix(ctx) }`, both sync, both returning a non-empty `detail` on every path, registered with `cadence: 'always'`, `flag: null` (so it runs on bare / `--all` / `--fix`) or a named flag (so it runs only on `--room-map`), `fix_supported: true`, `runner: 'lib/core/doctor/<id>-module.cjs'`. Set `result.recoverable = false` on the classes `--fix` must not auto-heal on a real room.

### Pattern 5: The `--check` data-build script

`node scripts/build-section-command-ledger.cjs` regenerates; `--check` regenerates in memory and exits non-zero on drift. Eleven siblings already do this. **Difference for this one:** the full rebuild needs Theo and Jev, so `--check` must NOT rebuild. It should assert only what is verifiable offline (the ledger's `plugin_version`, `built_at` age, `theo_frameworks` count, `jev_model`, and that every `rows` key parses as `<job_id>|<problem_type>|<stage>` with a known `job_id`). State this divergence from the sibling contract in the script header.

### Anti-patterns to avoid

- **Touching `dial-reach-orchestrator.cjs`.** The frozen six reaches are not commands.
- **Adding a sensor.** `SENSOR_REGISTRY` / `SENSOR_REGISTRY_IDS` / `SENS_PRIORITY` is a seven-place lockstep with two build gates; this phase needs none of it.
- **Substituting `{{TOKENS}}` into contract prose.** T-275-13 exists because that corrupts room files.
- **A second self-location store.** The map is truth, the block is the view (icm-architect authority rule). A block that disagrees is a doctor finding, not a preference.
- **Blocking a write on bookkeeping.** Canon Part 9: maps, blocks and ruling documents are bookkeeping. A failed anchor mint means no edge, never a refused claim (unless the navigator set `strict`).

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) for `*.test.cjs`; hand-rolled `PASS/FAIL` counters for `tests/test-<phase>-*.cjs`; bash aggregator per phase |
| Config file | none (no jest/vitest/pytest config in this repo) |
| Quick run command | `node tests/test-353-<leg>.cjs` |
| Full suite command | `bash tests/run-all-353.sh` |
| Phase gate | `bash tests/run-all-353.sh` green, then `node scripts/doctor.cjs --acceptance` |

### Success criteria -> measurement map

| # | Criterion | How it is MEASURED (not estimated) | Test file | Fixture / target | What the assertion says |
|---|-----------|------------------------------------|-----------|------------------|-------------------------|
| 1 | `doctor room-map` + `doctor section-ruling` green on all fleet rooms after `--fix`; 0 dirs without ROOM.md, 0 drift | Two-stage: (a) hermetic `--fix` + recheck on `tests/fixtures/icm-rooms/`; (b) **report-mode-only** fleet walk producing a counted JSON, committed as evidence. `--fix` on a real room is the navigator's explicit act (D-353-9), so the suite never runs it against `~/MindrianRooms`. | `tests/test-353-doctor-room-map.cjs`, `tests/test-353-doctor-section-ruling.cjs`, `tests/test-353-fleet-report.cjs` | `icm-rooms/` for (a); the 31 live rooms read-only for (b) | (a) post-`--fix` `check()` returns `status:'ok'` with a non-empty detail and 0 entries in every drift array. (b) the report JSON parses, names every room, and every count is an integer. **The number "0 drift fleet-wide" is an evidence artifact the navigator ratifies, not a green test.** |
| 2 | Per-turn self-location + ruling read under 400 tokens | `getRoomContext(db, roomId, { estimateOnly: true })` and read `_meta.legCostTokensApprox` for the new leg. Chars-over-4 per `lib/core/token-estimator.cjs:123`. | `tests/test-353-turn-budget.cjs` | every room in `icm-rooms/`, deepest folder + root | `assert(legCostTokensApprox.<newLeg> < 400)` per fixture room, and separately `estimateTokens(selfBlock) <= 120` per D-353-2's 60-120 band, and `estimateTokens(rulingDoc) <= 500` per the icm-architect L2 band. |
| 3 | 100% of new claims filed on fixture rooms carry an anchor edge | File N claims through `claim_write` and `artifact_file` against a fixture room db, then count `SELECT ... FROM edges WHERE edge_type='SOURCED_FROM' AND target_id LIKE 'jtbd:%'` through the navigation read path. | `tests/test-353-anchor-edge.cjs` | one `icm-rooms/` room with a real room.db | Every claim id minted in the test appears as an edge `source_id`; the anchor node exists with `type != 'claim'`; a second identical file is idempotent (`on_conflict:'nothing'` leaves `last_seen_at` untouched). |
| 4 | Reach top-3 hit rate on a labelled fixture turn set at least equal to today's sensor order; both numbers reported | Run `rankForSelector` twice over the same labelled turns: once with `tierCandidates` absent (today's order) and once with the ledger candidates. Compare top-3 hit rate against hand-written labels authored BEFORE the ledger exists. | `tests/test-353-reach-hitrate.cjs` | `evals/icm/cases/turns.json` (labelled before any ledger build, per the eval-honesty rule in `.planning/REQUIREMENTS.md` cross-cutting rules) | `assert(withLedger >= baseline)` **and both numbers printed**. A regression is a real finding, not a test to loosen. |
| 5 | Ledger build cost and wall time recorded per release | The build script writes `{ built_at, wall_ms, jev_calls, input_tokens, output_tokens, estimated_cost_usd }` into the ledger's own header from the **vendor-returned usage**, never from an assumption. | `tests/test-353-ledger-shape.cjs` | `data/section-command-ledger.json` | The six cost keys are present, numeric and non-negative; `jev_model` is a non-empty string; **`estimated_cost_usd` is labelled vendor-claimed** (the Spike rule: only measured numbers are quoted as facts; the $0.018 / under 30 s baseline is at a vendor-claimed rate). |
| 6 | Grader agreement with the Claude-judge baseline at least 0.8 on the fixture set | Spearman or exact-agreement (planner picks one and states it) between `scripts/eval-icm-writers.cjs` output and a **once-authored** Claude-judge baseline committed as `evals/icm/claude-judge-baseline.json`. | `tests/test-353-grader-agreement.cjs` | `evals/icm/cases/` | `assert(agreement >= 0.8)`. Runs only when `TYPESAFE_API_KEY` resolves; **skips loudly with a named detail otherwise**, never silently passes. |

### The acceptance point (ICM-353-03)

Model on `capability-ledger-fresh` (`scripts/doctor.cjs:1857-1905`). Suggested shape:

```js
{
  id: 'icm-ruling-eval-fresh',
  label: 'ICM writer eval: evals/icm/last-run.json is fresh and agreement >= 0.8',
  severity: 'blocker',
  applies_to: ['pre-tag', 'full'],
  run: async function () { /* reads evals/icm/last-run.json; NO vendor call */ },
}
```

**What it asserts:** the eval JSON exists, its `plugin_version` is not more than one release behind, and `agreement >= 0.8`. **What it must never do:** call Jev. The release path stays Part-8 clean and key-free. Honour `DOCTOR_TEST_FAIL_POINT` and a `DOCTOR_SKIP_ICM_EVAL=1` escape, and make sure it returns `ok:true` under all five `test-doctor-acceptance-self-coverage.cjs` fixtures (it will, if a missing file degrades to `ok` with a named detail rather than failing).

### Wave 0 gaps (nothing exists yet)

- [ ] `tests/run-all-353.sh` - the aggregator, written ONCE in plan 353-01, never edited by a later plan (the run-all-345 convention), with its own targeted em-dash guard glob.
- [ ] `tests/fixtures/icm-rooms/` - authored fixture rooms: sections with real MINTO/FEYNMAN content, template-identical stubs, a sub-room WITH `job_id`, a sub-room WITHOUT, a cross-section artifact, a rejected row and a confirmed row. Built as a NEW sibling of `195-nested-room-tree`, never an extension of it.
- [ ] `evals/icm/README.md`, `evals/icm/cases/`, `evals/icm/claude-judge-baseline.json`, `evals/icm/last-run.json`.
- [ ] The eight `tests/test-353-*.cjs` legs named above.
- [ ] Amendment tasks for `tests/test-275-section-schema.cjs:330` and `:366`.
- [ ] A re-pin task for whichever `tests/fixtures/{310,341}-release-step-block-hashes.txt` block the release wiring touches.

### Tripwires the phase should ship (following the STRAT-11 precedent)

- No file under `lib/` contains the literal `api.typesafe.ai` (Jev is dev-time only; a hit means it leaked into the turn path or a hook).
- No file under `hooks/` references `eval-icm-writers` or `build-section-command-ledger`.
- `scripts/eval-icm-writers.cjs` contains no path under `~/MindrianRooms` and refuses a `--room` outside `tests/fixtures/icm-rooms/` (D-353-4, never a real room).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The four new `serves_jtbd` members can be section-canon-only without any command adopting them, and no gate enumerates the vocabulary | Seam 5 | Verified by grep across `lib scripts tests hooks commands` and by reading `build-command-registry.cjs`, so risk is LOW. If wrong, the four sections fall back to parent/sensor order, which is the designed degrade. |
| A2 | The `jtbd:` anchor node type should be `'jtbd'` | Seam 7, Pitfall 5 | Suggested, not locked. The BINDING constraint (verified in `goal-anchor.cjs:27-31`) is only "never `'claim'`". Any non-claim type satisfies it; the planner names the string. |
| A3 | `getRoomContext` is the right home for the `icm_self` read leg | Seam 6 | The spec says "the room-context leg of `context_assemble`". If a fifth leg proves to break the byte-stability contract at `room-context.cjs:393-399`, the alternative is a separate sync reader called by the same MCP tool. |
| A4 | The `job_mismatch` disclosure can ride `mcp_client_event_logged` rather than a new EVENT_TYPE | Pitfall 2 | If the navigator wants a distinctly queryable event type, a new member is needed and the two already-red size assertions must be converted to the delta convention first. |
| A5 | `icm_self` blocks are scoped to root / section / structural / sub-room folders, excluding per-artifact folders | Census, Summary | This is a scoping RECOMMENDATION, not a design lock. R2 says "each part of an ICM room", which is ambiguous between 401 and 2,024 directories. See Open Question 2. |
| A6 | The Spike 002 Theo puller still works against Theo at HEAD | Seam 8 | Measured 2026-09-17 by the spike, one day old. Theo is a separate repo under active change; the build script must handle `{records: [], error:'brain_query_unrecognized_shape'}` as a named failure, not an empty result. |
| A7 | `estimated_cost_usd` in criterion 5 is at a vendor-claimed rate | Validation Architecture | Already labelled in the spike findings ("about $0.018 at the vendor-claimed rate; unverified rate"). Quoting it as a fact would violate the repo's own measured-numbers-only rule. |

## Open Questions for the planner

Limited to what the code made ambiguous. Each names what is known, what is not, and a recommendation.

**1. `auto_heal` does not exist yet, and Phase 352 is not planned.**
- Known: `data/doctor-modules.json` rows carry exactly seven keys, none of them `auto_heal`. Grep across `lib scripts data tests docs` returns zero hits. D-352-4 defines it as a new mandatory boolean on every `fix_supported: true` row, enforced by a new D-03 parity rule. Phase 352 has a CONTEXT and grounding but no plans (`.planning/STATE.md:6814-6823`).
- Unclear: whether Phase 353 lands before or after Phase 352, and therefore whether the two new rows carry the key.
- Recommendation: **Phase 353 writes the two rows WITHOUT `auto_heal`** (matching the shipped 24-row shape exactly, so no schema divergence ships), and records in the plan that Phase 352 must classify both when it lands. Proposed classification to carry forward: `room-map` -> `auto_heal: true` (rebuild from disk is mechanical and reversible, the same class as D-352-4's "room-md generate TRUE"); `section-ruling` -> `auto_heal: false` (regenerating a ruling document rewrites a file a human may have authored prose into, which is a judgment fix, the same class as D-352-4's "legacy-clone remove FALSE"). **If the navigator sequences 352 first, invert: both rows carry the key at birth.**

**2. Which directory class gets an `icm_self` block?**
- Known, measured: 401 depth-1 directories (102 without ROOM.md); 2,024 non-dot directories at maxdepth 8 (914 without ROOM.md); 6 roots without ROOM.md. Key Decision 16 puts every artifact in its own folder (`section/name/name.md`), so most of the 2,024 are artifact folders. `room-md-module.cjs` walks to maxDepth 8 and flags all of them today.
- Unclear: R2 says "each part of an ICM room"; success criterion 1 says "0 directories without ROOM.md (7 today)", a number that only reconciles with roots.
- Recommendation: **scope `icm_self` to the four `kind` values the spec's own map node enum already names - `root | section | structural | sub-room` - and exclude artifact folders explicitly**, with the exclusion rule stated in `room-map.cjs`'s header and encoded as a doctor check (an artifact folder carrying an `icm_self` block is itself drift). That makes `--fix` write ~400 blocks, not ~2,000, keeps the map small enough to stay in the L1 band, and matches the icm-architect ladder guardrail ("the phase climbs no rung"). Ratify with the navigator at plan review, since it narrows R2's literal wording.

**3. Does the ledger join on `serves_jtbd` alone, or also on `produces`-into-this-section?**
- Known: `serves_jtbd` is on the command registry (113 commands, 16 values). `produces` is also there. The 11 shipped `section-contracts/*.md` files each already hand-author a `## Commands that write here` section split into "Ground truth (the command's own `produces` path names this section)" and "Framework-matched". Phase 275 D-05 corrected one misfiling (`/mos:trending-to-absurd`).
- Unclear: after the four-member vocabulary extension, four sections have `job_id` values no command declares, so a `serves_jtbd`-only join yields empty ledger rows for `business-model`, `financial-model`, `legal-ip`, `solution-design`.
- Recommendation: **join on the union of (`produces` names this section) and (`serves_jtbd` includes the section's `job_id` or its declared secondary)**, and seed the ground-truth half from the existing hand-authored contract tables rather than recomputing them. State in the ledger header which half produced each row, so a future reader can see when the vocabulary gap closes.

**4. Where does `claim_write` learn its section?**
- Known: `claim_write`'s MCP schema has no `section` parameter (`lib/mcp/tools/claim.cjs:97-120`). `artifact_file` does. `navigation.getActiveFocus(db)` is exported (`navigation.cjs:75`).
- Unclear: whether D-353-8's gate on `claim_write` justifies widening a born-wired MCP schema.
- Recommendation: **resolve through `getActiveFocus`, do not widen the schema.** Widening changes the born-wired source of truth in `claim.cjs`'s `connectors` export and requires `build-connector-registry.cjs` regeneration plus a `check-shape-declaration.cjs` pass, for a value the session already knows. If focus is unset, the gate degrades to "no section, no check" with a named `memory_event` property, never a refusal.

**5. What exactly does "unwind" have to undo for the parent's map?**
- Known: `_bornWiredRollback` (`room-birth.cjs:392-396`) deletes the CHILD directory, closes the db and reverts the registry key plus the parent's `children[]`. It does nothing to the parent's other files.
- Unclear: side effect six rebuilds BOTH maps. After an unwind, the parent's `room-map.json` may list a child that no longer exists.
- Recommendation: **make the parent map rebuild the LAST action inside the try, and have `_bornWiredRollback` re-run the parent map rebuild after `fs.rmSync`.** A rebuild from disk is idempotent and cheap, so the compensating action is "rebuild again", not "restore a backup". State this in the plan as the sixth side effect's own rollback clause, and cover it with the `_faultInject: 's6'` test (which requires the `s[1-5]` -> `s[1-6]` regex widening, Pitfall 15).

**6. Which requirement-ID prefix?**
- Known: `.planning/REQUIREMENTS.md:2620-2704` uses `<PREFIX>-NN`. `ICML-` is taken by Phase 275. The brief's `ICM-353-0N` labels match no register row shape.
- Recommendation: mint one unused prefix covering all three units (`RULE-01..NN` reads cleanly against "ruling system"), register as `- [ ]` at plan time, close with measured proof in the phase's own close-out plan, per the Phase 254/257/339/343/344/345/348/349 precedent. State the phase-local caveat the register already carries for every such family.

**7. Where does the ledger rebuild actually run?**
- Known: `release.sh` Step 2.4 runs three `--check` gates offline. Step 0.6 (lagging Theo stamp) and Step 5.6 (leading `theo-resync` dispatch) are the two Theo touchpoints. D-353-6 says "rebuilt at release" AND "rebuilt on `theo-resync`", which are two different machines: the release runs on the navigator's box, `theo-resync` fires at `jsagir/theo`.
- Unclear: whether a release is expected to hold a `TYPESAFE_API_KEY` at all.
- Recommendation: **the rebuild is a navigator-invoked pre-release act, not a release step.** `release.sh` Step 2.4 gains only `build-section-command-ledger.cjs --check` (offline staleness, no vendor call), and the audited opt-out flag (`--no-ledger-check`, the `--no-theo-check` shape) covers a deliberately stale ledger. That keeps the release path key-free and Part-8 clean, and it matches D-353-6's own fallback ("Jev unavailable at release keeps the last ledger and logs an audited flag"). Ratify with the navigator.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | repo floor >= 22.16.0 | none needed |
| `gray-matter` | frontmatter parse | yes (`package.json:50`) | ^4.0.3 | none needed |
| Theo (`theo-mcp.onrender.com`) | ledger build only | dev-time, not re-probed this session | n/a | Keep the last shipped ledger, log the audited flag (D-353-6) |
| Jev (`api.typesafe.ai`) | ledger build + Unit 3 grading | dev-time key at `~/.secrets/typesafe.env`, not probed this session (would print nothing, but the file was not read) | `jev-1.13.0` served as of 2026-09-17 | Keep the last ledger; the eval leg skips loudly with a named detail |
| `~/MindrianRooms` fleet | report-mode fleet walk | yes, 31 rooms measured this session | n/a | The fleet report is evidence, not a test gate |

**Missing with no fallback:** none.
**Missing with fallback:** Theo and Jev, both dev-time only, both with a designed degrade already locked in D-353-6.

## Sources

### Primary (HIGH confidence) - read in this session at HEAD

- `lib/core/section-registry.cjs` (full), `lib/core/room-skeleton-scaffold.cjs` (lines 1-120, 280-670), `lib/core/navigation/room-birth.cjs` (290-520, 1130-1227), `lib/core/navigation/goal-anchor.cjs` (full), `lib/core/doctor/room-md-module.cjs` (full), `scripts/doctor.cjs` (738-800, 1840-1930, 2380-2720), `lib/core/frontmatter-schemas.cjs` (1-80, 140-230, 279-310, 460-485), `lib/core/navigation-engine.cjs` (945-1100, 1845-1890), `lib/core/insight-sensors.cjs` (733-840), `lib/workflow/f-selector-ranker.cjs` (880-975, 1082-1100), `lib/hmi/dial-reach-orchestrator.cjs` (110-150), `lib/core/navigation/room-context.cjs` (260-425), `lib/mcp/tools/context.cjs` (full), `lib/mcp/tools/claim.cjs` (85-175), `lib/mcp/tools/views.cjs` (180-380), `lib/core/navigation/edges.cjs` (32-90, 560-600, 1048-1080), `lib/core/node-insert.cjs` (108-130), `lib/core/brain-client.cjs` (900-990), `lib/core/token-estimator.cjs` (100-145, 335-350), `scripts/check-substrate.cjs` (1-60, 200-290), `scripts/release.sh` (36-370), `scripts/build-command-registry.cjs` (grep), `lib/workflow/command-resolver.cjs` (189-257), `lib/core/recipe-maps.cjs` (grep), `lib/core/orchestration-candidate-lift.cjs` (79-110).
- Data read and parsed: `data/command-registry.json`, `data/doctor-modules.json`, `lib/hmi/jtbd-taxonomy.json`, `~/MindrianRooms/.rooms/registry.json`, `package.json`, `hooks/hooks.json`.
- Templates read: `templates/room-skeleton/ROOM.md.identity.tmpl`, `ROOM.md.section.tmpl`, `section-contracts/problem-definition.md`.
- Tests read or RUN: `tests/test-275-section-schema.cjs` (grep, lines 26-28, 137-174, 330, 366), `tests/test-auto-explore-telemetry.cjs` (**run**, 1 fail), `tests/test-131-substrate.cjs` (**run**, 2 fail), `tests/test-130-lens-engine.cjs:100-110`, `tests/test-doctor-acceptance-self-coverage.cjs` (header), `tests/run-all-345.sh`, `lib/core/node-insert-epistemic.test.cjs:84`, `tests/test-195-recursive-reconcile.cjs:172`, `tests/test-209-declared-implies-wired.cjs:227`.
- Live measurement: the fleet census table above, all commands shown.

### Secondary (HIGH-MEDIUM) - project documents

- `docs/superpowers/specs/2026-09-17-icm-section-ruling-system-design.md` (the approved design, read in full).
- `353-CONTEXT.md`, `353-RESEARCH-GROUNDING.md`, `353-RESEARCH-GROUNDING-icm.md`, `353-RESEARCH-GROUNDING-jev.md` (all read in full).
- `CLAUDE.md` + its four `@include`s (`architecture.md`, `moat.md`, `decisions.md`, `release-process.md`).
- `.claude/skills/spike-findings-MindrianOS-Plugin/references/section-framework-ledger.md` and `jev-typed-decisions-api.md` (read in full).
- `.planning/spikes/002-jev-section-framework-ranker/rank.cjs` (`pullTheoFrameworks`, lines 145-195) and `report.cjs` (header + CSS).
- `~/.claude/skills/icm-architect/references/core.md` (five-layer table lines 23-30, the L2 control-surface line, the 2k-8k per-step band at line 82).
- `.planning/REQUIREMENTS.md:2620-2704` (ID-family convention).
- `.planning/STATE.md:1-60, 6805-6835` (Phase 352 / 353 roadmap entries).
- `.planning/phases/352-.../352-CONTEXT.md` D-352-4 (the `auto_heal` definition).

### Tertiary (LOW, flagged) - none

No WebSearch, no Context7, no external source was used. Every claim above is grounded in a file in this repo, a file in `~/MindrianRooms`, or a command run in this session. **`353-RESEARCH-GROUNDING-langtalks.md` records the honest "not in the corpus yet" answer for the external-grounding leg; nothing external grounds or contradicts this design, and this file does not manufacture a citation to fill that gap.**

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Seams 1-10 (paths, exports, signatures, line refs) | HIGH | Every one was read at HEAD in this session. Line numbers are from the files as they stand at `c9d8cf91b`. |
| Pitfalls 1-3 | HIGH | Two were reproduced by running the tests; the third was read as a literal. |
| Pitfalls 4-15 | HIGH | Each is a quoted comment or a read regex, not an inference. |
| Fleet census | HIGH | Measured this session; every command is shown so it can be re-run. |
| Vocabulary-extension safety (A1) | HIGH | Established by exhaustive grep plus reading the registry builder. |
| `auto_heal` / Phase 352 sequencing | MEDIUM | The key's absence is verified; the sequencing is a navigator decision not yet made. |
| Theo puller currency (A6) | MEDIUM | Measured 2026-09-17 by the spike, one day old, in a separately-moving repo. Not re-probed here. |
| Jev API currency | MEDIUM | Same provenance, same one-day age; `jev-1.13.0` was the served model. |
| icm-architect invariant mapping | HIGH | `353-RESEARCH-GROUNDING-icm.md` did the mapping; `core.md`'s bands were re-read here to confirm the numbers. |

**Research date:** 2026-09-17
**Valid until:** 2026-10-01 for the in-repo seams (14 days; this repo moves fast and beta cuts land weekly). **7 days** for the Theo and Jev facts, which live in other repos and at a vendor.

**No em-dashes in this file.** Hyphens only, per CLAUDE.md hard rule.

