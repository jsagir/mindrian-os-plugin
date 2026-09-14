# The ICM Nested-Part Contract

Status: Active
Baseline: Phase 275's ICM audit, carried forward through `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` section 4 (the IS / NEEDS TO BE / gap table this document turns into per-part rows)
Declaration file: `data/icm-parts.json` (hand-authored; this document mirrors that file row for row, in the same order, and neither may drift from the other without `tests/test-344-icm-parts-contract.cjs` going red)
Measured by: `lib/core/doctor/icm-part-wiring-module.cjs` (the counts-only doctor organ shipped in 344-05); `node scripts/doctor.cjs` runs its repo-side leg on every invocation, `node scripts/doctor.cjs --cascade-rooms` adds the live-room section-contract census
Sibling contract: `docs/LAYER-CONTRACT.md` (the five-engineering-layer architecture contract; this document is its ICM-nested-part cousin, one room's folder structure at a time)

---

## Baseline corrections

Two measurements in the baseline draft are superseded by numbers this same phase measured directly. Both are carried here with the number they replace, per this plan's baseline rule, rather than re-measured a third time.

- The per-command firing block (the PROMPT layer's `commands/*.md` injection, `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` section 2.1) is present in 84 of the command files, not in every one of them. `scripts/stamp-firing-block.cjs:19-21` deliberately skips a body that already mentions AskUserQuestion (18 pre-wired bodies), so a body-stamped count of "every command file" was never an accurate reading of what the script does.
- The stale `.room-graph/` name survives in three live skip-list constants, not two: `lib/core/rs-engine.cjs:87`, `lib/core/cross-room-aggregator.cjs:127`, `lib/core/eureka/reasoning-mode.cjs:72`. The real path those constants mean to name is `.mindrian/room.db` (see the `room-db` part below). This is documented, not fixed, here: removing a skip-list entry changes what three walkers traverse, and that change needs its own proof and its own plan.

---

## 1. What a nested part is

A nested part is one file or one folder inside a room's directory tree that carries a specific, named job: identity, state, a reasoning artifact, a reference rule, a piece of the local graph. The room's folder structure is not a filing convenience sitting beside the system's real architecture; it is the architecture, expressed as files a person can open and a script can walk. The langtalks-graph-expert corpus grounds this claim directly: Memory is `part_of` context engineering at one hop (ep55 Context Engineering; ep57 Memory; the ICM note), and the Interpretable Context Methodology (ICM) note itself `builds_on` context engineering at one hop. Chaining those two one-hop edges gives the reading this contract stands on: memory, and by the same argument every ICM nested part, is a sub-part of the CONTEXT engineering layer rather than a layer of its own, and the harness is the machinery that actually reads and writes these files on disk.

## 2. The reference form

The reference form (`icm-architect` skill, `references/core.md`) states ten invariants; five are load-bearing for this document. Invariant 1: one folder, one job, stated inside itself. Invariant 2: the entry file routes, and holds no content of its own. Invariant 4: every working folder carries a `CONTEXT.md` with Inputs, Process, Outputs, and a Human check. Invariant 8: one home per fact, never two files disagreeing about the same thing. Invariant 9: the filesystem is the state machine, and any generated index is rebuilt by script, never hand-edited. These invariants sit inside a five-rung hierarchy: L0 (`CLAUDE.md`, where am I), L1 (root `CONTEXT.md`, where do I go), L2 (per-section `CONTEXT.md`, what do I do, the control point of the whole system), L3 (`references/`, what rules apply), and L4 (`output/`, the product). Every part below is measured against this hierarchy and these five invariants, not against a new standard invented for this document.

## 3. Parts

One subsection per row in `data/icm-parts.json`, in that file's own id order, so the two documents can be diffed side by side. Each subsection copies the five-heading shape of `data/harness-policies/CONTEXT.md`, the in-repo L2 contract this document is modeled on, applied to a room file or folder instead of a policy directory:

- **Reads** states what the part's own producer(s) consult to write it, or "Nothing" when the part is authored directly with no upstream input.
- **Does** states the part's one job as it stands today.
- **Writes** states what downstream effect exists because this part is present, if any.
- **Human check** is the Feynman- or Minto-style question a person actually asks of the part.
- **Change-impact** is the direct consumer table: which code reads this part, and what it does with it. An empty table means "no code consumer today," a fact, not a judgment, and it is written as a fact below rather than softened into a plan.

Three labeled lines precede those five headings in every subsection: **IS today** (what the part is right now, with file citations), **NEEDS TO BE** (the reference form's answer), and **Gap** (the difference between the two, with the phase that owns closing it when one is registered, or "unowned" when none is).

### Part: room-md

- **IS today:** Identity frontmatter only, produced by `lib/core/room-skeleton-scaffold.cjs:545-620`.
- **NEEDS TO BE:** L0 identity only, no content, per invariant 1.
- **Gap:** Inline-content drift. Five of twelve sections in the audited dogfood room carried real content inside `ROOM.md` instead of an L4 entry folder. Phase 275 shipped drift reporting only; nothing blocks the drift from recurring. Unowned beyond that report.

**Reads:** Nothing. `room-skeleton-scaffold.cjs` writes this file directly from section metadata at scaffold time; it does not read another room file to build it.

**Does:** States one directory's identity, stated inside itself, per invariant 1.

**Writes:** Nothing downstream by construction. When a human or a command writes real content into this file instead of an L4 entry folder, that is the drift measured above, not an intended write path.

**Human check:** Can a stranger open this file and read only identity, never content?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it as one of the files read into context every turn (docs section 2.2, the four-leg context assembly). |

### Part: section-context-md

- **IS today:** Fixed heading order (Statement, One job, Inputs, Process, Outputs, Human check, Commands that write here), eleven templates, scaffolded by `lib/core/room-skeleton-scaffold.cjs:314-380`.
- **NEEDS TO BE:** The control point of the whole system (L2).
- **Gap:** The best-realized ICM artifact in the repo had zero code consumer before this phase. `lib/core/doctor/icm-part-wiring-module.cjs` (344-05) closed the zero-consumer half by counting two of its headings under `--cascade-rooms`; no context-assembly leg and no command reads this file's content yet, so the control-point half of the gap stays open. Owner: 344 (the counting half, closed); the content-consuming half is unowned.

**Reads:** Nothing itself. The scaffold writes it once, from `templates/room-skeleton/section-contracts/*.md`.

**Does:** Declares the control point per invariant 4: Inputs, Process, Outputs, and a Human check for one working folder.

**Writes:** Nothing on its own. A change to its two declared headings (`## Inputs`, `## Commands that write here`) directly changes what `icm-part-wiring-module.cjs` counts, which is the whole of its Change-impact today.

**Human check:** Business-model.md's own Human check style applies here too: can a stranger restate this section's governing thought in one sentence, and does the apex claim sit on MECE-grouped support?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/doctor/icm-part-wiring-module.cjs` | Under `--cascade-rooms`, reads every registered room's per-section `CONTEXT.md` as a flat file and counts the presence of `## Commands that write here` and `## Inputs`. This is a READ that validates, not a READ that injects; it adds no assembly path (see gap 3 below). |

### Part: state-md

- **IS today:** Frontmatter carrying `phase`, `role_blend`, `journey_stage`, `venture`; produced by `lib/core/room-skeleton-scaffold.cjs` and `scripts/compute-state`.
- **NEEDS TO BE:** A generated index, never hand-edited, per invariant 9.
- **Gap:** Half generated, half authored, with an `isHumanAuthored` skip protecting the `auto_created` fields from being overwritten. `STATE.md` also nests inside `opportunity-bank/` and `funding/`, each a second state machine. Unowned.

**Reads:** `scripts/compute-state` reads the room's own signals (commits, session activity) to regenerate the `auto_created` fields; fields carrying `isHumanAuthored` are left untouched.

**Does:** Tracks the room's (or the nested section's) current phase and stage as a small, mixed generated-and-authored frontmatter block.

**Writes:** Nothing downstream directly; every consumer reads the merged frontmatter as-is.

**Human check:** Does every `auto_created` field actually trace to `compute-state`, and does every human-set field carry `isHumanAuthored` so a regeneration cannot silently overwrite it?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn as one of the room-state summary files. |

### Part: user-md

- **IS today:** Per-room identity and working style, written atomically by `lib/core/user-md-ops.cjs`.
- **NEEDS TO BE:** Per-user factory material at L3, one home, since the fact it holds is a cross-room fact about one person, not one room.
- **Gap:** `identity_write` writes one home-directory-style file that every room reads its own copy of: two homes for one fact, which is exactly what invariant 8 forbids. Unowned.

**Reads:** Nothing external. `user-md-ops.cjs` writes it directly from the onboarding or interview flow that produced it.

**Does:** Holds today's per-room identity and working style.

**Writes:** Nothing downstream from this file directly; because it is copied per room instead of shared, a change to one room's copy does not propagate to any other room's copy, which is the gap itself.

**Human check:** If a person's working style changes, does a human have to edit every room's copy, or one home?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn as the per-room identity leg. |

### Part: feynman-md

- **IS today:** A human-written body plus a sentinel-bounded auto-generated timeline; produced by `/mos:feynman-timeline-refresh`, rendered and run by `lib/core/feynman/`, healed by `graph-self-heal.cjs`.
- **NEEDS TO BE:** A generated index, script-rebuilt, per invariant 9. This part already meets that target ("it is," per the baseline's own reading), unlike most of the parts in this document.
- **Gap:** Two writers touch one file (the timeline-runner and the dial-memory-runner), and `connector.excluded` means it never fires contextually. `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` section 4 does not assign this part an explicit rung, so `icm_layer` is `null` in `data/icm-parts.json` rather than guessed. Unowned.

**Reads:** The timeline-runner reads the file's own human body plus its sentinel-bounded auto-section, so it can append new entries without clobbering the human-written part.

**Does:** Holds a per-section timeline: human narrative plus an automatically maintained, sentinel-bounded log.

**Writes:** Nothing downstream on its own; `graph-self-heal.cjs` watches for and repairs drift between the two writers rather than this file writing anything forward.

**Human check:** Does the human-written body still read cleanly as the auto-timeline grows underneath it?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn. |

### Part: brain-md

- **IS today:** Flat-scalar frontmatter with `author` frozen to `"brain"`; produced by `/mos:brain-derive`; read only through `readQuadruple`'s Part 8 fence.
- **NEEDS TO BE:** L3 reference material, derived rather than authored.
- **Gap:** `filing: memory_event_only`. The derivation writes no claim node into the room graph, so what this file holds never becomes a reviewable, promotable fact. Unowned.

**Reads:** `/mos:brain-derive` reads the room's own local context to form its query (never sending room content to the Brain, per Canon Part 8) and writes back a generic-methodology derivation.

**Does:** Holds machine-derived L3 reference material for the section.

**Writes:** Nothing into the graph. No claim node is created from this file's content, which is the gap itself, not an intentional design choice this document can wave away.

**Human check:** Does anything in this file ever get promoted to a human-confirmed graph node, or does it stop here?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn, through the Part 8 fence in `readQuadruple`. |

### Part: section-reasoning

- **IS today:** Bundles two artifacts: the per-section `MINTO.md` sentinel-bounded governing thought (producer `/mos:mos-reason`) and the `.reasoning/<section>/REASONING.md` Minto/MECE artifact (`lib/core/reasoning-ops.cjs:378-416`, consumed by `room_graph` reasoning actions and `/mos:grade`).
- **NEEDS TO BE:** One home per fact, per invariant 8.
- **Gap:** Three paths write one idea: `mos-reason` declares `room/**/reasoning/*`, writes the per-section `MINTO.md`, and `reasoning-ops.cjs` writes `.reasoning/<section>/REASONING.md` separately. `data/icm-parts.json` records `icm_layer: null` here because `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` section 7 lists "is `MINTO.md` the L2 contract, or a reasoning product under it" as an open `[NAVIGATOR DECISION]`. That decision is RULED as of the 344-03 checkpoint (WD-2, `docs/LAYER-DECLARATION-CONTRACT.md`): `MINTO.md` is a reasoning product that sits under the per-section `CONTEXT.md` L2 contract; `CONTEXT.md` is L2. This document carries that ruling here, plainly, without silently editing `data/icm-parts.json`'s own `null` value, which is out of this plan's scope and stays a fact for a future plan to reconcile.

**Reads:** `mos-reason` reads the section's accumulated signals to produce the governing thought; `reasoning-ops.cjs` reads `references/reasoning/*` templates for its own Minto/MECE structure.

**Does:** Produces the section's governing thought (the apex claim) and its MECE-grouped support, today as two separately-written artifacts rather than one.

**Writes:** Nothing downstream that reads both together; the two consumers below read `REASONING.md` only, never `MINTO.md` alongside it.

**Human check:** Minto test: does the apex claim in `MINTO.md` actually sit on the MECE support in `REASONING.md`, or do the two silently disagree because nothing checks them against each other?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `room_graph` reasoning actions | Reads `.reasoning/<section>/REASONING.md` for its Minto/MECE structure. |
| `/mos:grade` | Reads `.reasoning/<section>/REASONING.md` as grading input. |

### Part: room-db

- **IS today:** SQLite nodes and edges with provenance and bitemporal `review_status`, produced by `lib/core/room-db.cjs` and `lib/core/node-insert.cjs`, read only through `lib/core/navigation.cjs`.
- **NEEDS TO BE:** A queryable graph with measured integrity.
- **Gap:** Integrity is unmeasured (Phase 343 owns closing this). The stale `.room-graph/` name survives in three live skip-list constants, not two (see Baseline corrections above): `lib/core/rs-engine.cjs:87`, `lib/core/cross-room-aggregator.cjs:127`, `lib/core/eureka/reasoning-mode.cjs:72`, while `.mindrian/room.db` is the real path those constants mean to name. Documented, not fixed: editing a skip list changes what three walkers traverse and needs its own proof.

**Reads:** `node-insert.cjs` reads the existing graph before every write (its CAS guard); `navigation.cjs` is the sole read chokepoint for every other surface in the repo.

**Does:** Holds the local mind (Canon Part 9): typed nodes and edges, provenance, and bitemporal review status.

**Writes:** Every mutation here is what every other harness surface (memory, gates, chains) ultimately reads back through `navigation.cjs`.

**Human check:** Does a claim in this database carry a human-confirmed `review_status`, or is it still `proposed`?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/navigation.cjs` | The sole read door: a closed 13-function surface, pre-commit guarded, with bypass telemetry. Every other read of this part goes through here or nowhere. |

### Part: snapshots

- **IS today:** Dated `STATE.md` copies, produced by `scripts/generate-snapshot.cjs`.
- **NEEDS TO BE:** An underscore-prefixed meta folder with a change index.
- **Gap:** Dot-prefixed instead of underscore-prefixed, and no change index exists. Unowned.

**Reads:** `scripts/generate-snapshot.cjs` reads the room's current `STATE.md` at export time.

**Does:** Holds a dated backup and nothing else today.

**Writes:** Nothing; no consumer reads this folder back.

**Human check:** If a room needs to roll back, does anything point a human at which snapshot to restore?

**Change-impact:** No code consumer today.

### Part: context-dir

- **IS today:** Holds `last-session`, `methodology-history`, `rejection-log`, and `weekly-digest`; produced by `scripts/sessionstart-coordinator.cjs`; read by `lib/sessionstart/precedence-ladder.cjs`.
- **NEEDS TO BE:** Its own `CONTEXT.md` with declared producers and consumers, the same way every other working folder is required to carry one (invariant 4).
- **Gap:** None declared. This is gap 5.1's cousin: the room root has no L1 router, and this dot-folder has no L2 contract of its own either. Unowned.

**Reads:** `sessionstart-coordinator.cjs` reads session signals to write these four files at every SessionStart.

**Does:** Holds the 11-rung precedence ladder's working state.

**Writes:** `precedence-ladder.cjs` reads this folder every SessionStart to assemble the 2000-char budget.

**Human check:** Could a stranger tell what feeds this folder without reading `sessionstart-coordinator.cjs`'s source?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/sessionstart/precedence-ladder.cjs` | Reads all four files every SessionStart to build the precedence-ordered context budget. |

### Part: intelligence-dir

- **IS today:** Sentinel alerts and digests, produced by `/mos:scout`.
- **NEEDS TO BE:** A product (L4) folder, not a dot-prefixed meta directory.
- **Gap:** Sits in a dot-directory beside meta folders instead of as a product folder. It is a pure diagnostic output with no code consumer today, which is why `engineering_layer` is the honest `none` in `data/icm-parts.json` rather than a guessed rung. Unowned.

**Reads:** `/mos:scout` reads the room's own signals to produce its alerts and digests.

**Does:** Produces diagnostic output only.

**Writes:** Nothing; no consumer today.

**Human check:** Does a human ever see these alerts, or do they sit unread in a dot-folder?

**Change-impact:** No code consumer today.

### Part: memory-layers

- **IS today:** Three memory layers: within-session `.mindrian/jtbd-state.json`, across-session `~/MindrianRooms/.memory/jtbd-history.json`, and cross-room Brain Mode A plus filesystem Mode B.
- **NEEDS TO BE:** Memory as a sub-part of the context layer, per the corpus grounding in section 1 above, not a numbered ICM rung of its own.
- **Gap:** Only the within-session layer actually lives in the room today; `/mos:memory` files nothing back into the across-session or cross-room layers. Unowned.

**Reads:** `lib/hmi/jtbd-state.cjs` both reads and writes the within-session file; the other two layers are not exercised today.

**Does:** Tracks JTBD state within one session.

**Writes:** Nothing across sessions or across rooms today, which is the gap itself.

**Human check:** Does the across-session or cross-room layer receive anything at all, or does state reset every session?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/hmi/jtbd-state.cjs` | Reads and writes the within-session layer only. |

### Part: opportunity-bank

- **IS today:** A real section since Phase 275, with sub-schemas in `references/SUB-SCHEMAS.md`, driven by `lib/core/opportunity-ops.cjs`.
- **NEEDS TO BE:** One sequential pipeline covering both the non-dilutive and dilutive directions, in both L2 contracts.
- **Gap:** Covers the non-dilutive half only, and carries a nested `STATE.md`, a second state machine (see `state-md` above). Unowned.

**Reads:** `opportunity-ops.cjs` reads the room's own `market-analysis/` and `solution-design/` outputs, the same Inputs pattern named in `templates/room-skeleton/section-contracts/business-model.md`.

**Does:** Runs the non-dilutive funding pipeline today.

**Writes:** Its own nested `STATE.md`.

**Human check:** Does this section ask, and answer, who signs the cheque, and whether that is the same person as the user?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn. |

### Part: funding

- **IS today:** A sibling section to `opportunity-bank/`, real since Phase 275, driven by `lib/core/opportunity-ops.cjs`.
- **NEEDS TO BE:** Shares `opportunity-bank/`'s target: one sequential pipeline covering both directions in both L2 contracts.
- **Gap:** Same gap as `opportunity-bank/`: the non-dilutive half only, and its own nested `STATE.md`. Unowned.

**Reads:** `opportunity-ops.cjs` reads the same working inputs as `opportunity-bank/`.

**Does:** Runs the non-dilutive half of the funding pipeline today.

**Writes:** Its own nested `STATE.md`.

**Human check:** Same as `opportunity-bank/`: who signs the cheque, and is it the user?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn. |

### Part: personas

- **IS today:** Six-hat lens files, produced by `/mos:persona`.
- **NEEDS TO BE:** One home per fact (invariant 8).
- **Gap:** Known path drift, documented rather than fixed per this plan's own instruction: the declaration names `room/team/ai-personas/*` as the NEEDS-TO-BE path, but the live code actually reads `room/personas/`, one fact with two homes. Unowned.

**Reads:** `/mos:persona` reads the room's own signals to synthesize each hat's voice.

**Does:** Produces six lens files.

**Writes:** Nothing downstream; the drift above means a fix to either path must move both together, not just one.

**Human check:** If someone fixes the declared path, does the live code's read path move with it, or does the drift widen?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles it into context every turn, reading the live `room/personas/` path. |

### Part: references-dir

- **IS today:** A frozen two-item allowlist (`SECTION-SCHEMA.md`, `SUB-SCHEMAS.md`).
- **NEEDS TO BE:** 500-2k tokens of voice, brand, schema, and taxonomy rules, read every run (L3).
- **Gap:** The plugin root holds 22 subdirectories of exactly this material, and none of it reaches a room. Unowned.

**Reads:** `lib/core/room-skeleton-scaffold.cjs` copies the two allowlisted files at scaffold time; nothing else.

**Does:** Holds L3 reference rules, read every run per the reference form.

**Writes:** Nothing; the 22-subdirectory gap means most of the intended reference material never becomes a write target at all.

**Human check:** Does a room's `references/` folder actually carry the voice, brand, and schema rules a person would expect, or only the two allowlisted files?

**Change-impact:**

| Consumer | What it does with this part |
|---|---|
| `lib/core/folder-memory.cjs` | Assembles the allowlisted files into context every turn. |

### Part: vault-manifest

- **IS today:** Export-time JSON generated inline inside the snapshot generator only; `exists_in_room` is `false` because no `MANIFEST.json` file exists inside a live room.
- **NEEDS TO BE:** A generated room index.
- **Gap:** No MANIFEST file exists in a room at all today; the target is a future generated-room-index, not yet built. Unowned.

**Reads:** `scripts/generate-snapshot.cjs` reads the room tree at export time to build the manifest inline.

**Does:** Produces a transient export artifact, never a persistent room file.

**Writes:** Nothing into the live room; only into the exported snapshot bundle.

**Human check:** Could a person open a live room today and find a `MANIFEST.json`? No; that absence is the gap itself, stated as a fact.

**Change-impact:** No code consumer today.

### Part: fleet-index

- **IS today:** `templates/icm/CLAUDE.md` (31 lines, routing only, the "correct L0" per the baseline); `INDEX.md`, a hand-maintained table shipped empty; `.rooms/registry.json`, the machine index.
- **NEEDS TO BE:** L1, generated, never hand-edited (invariant 9).
- **Gap:** Duplicated entry files that drift, the anti-pattern already named at `icm-architect/SKILL.md:106`; a third incompatible statement of what the ICM L0-L4 mapping is (cross-cutting gap 4 below). `icm_layer` stays `null` in `data/icm-parts.json` because this one row bundles an already-L0 file (`CLAUDE.md`) with a hand-maintained `INDEX.md` whose NEEDS-TO-BE target is L1, and picking one number for the row would hide that split. Owner: 344-08 (the L0-L4 canonicalization).

**Reads:** Nothing; `templates/icm/CLAUDE.md` is a shipped scaffold template, copied at room creation, not read from elsewhere.

**Does:** Provides fleet-root routing (`CLAUDE.md`, L0) plus a hand-maintained index (`INDEX.md`) that duplicates the real machine index (`.rooms/registry.json`).

**Writes:** Nothing downstream; no consumer reads either entry file back today.

**Human check:** If the fleet's room list drifts, does a human notice `INDEX.md` disagreeing with `.rooms/registry.json`, or does one silently go stale while the other stays current?

**Change-impact:** No code consumer today.

## 4. Parts this contract does not carry

### seeds/

`seeds/` is not carried as a row in `data/icm-parts.json` and has no subsection above. This is a RULED decision, not an open one: WD-4 (`docs/LAYER-DECLARATION-CONTRACT.md`, ratified at the 344-03 checkpoint, 2026-09-14) states plainly that `seeds/` is NOT a room part and is removed from the ICM part list. The reasoning, carried forward rather than re-derived: `seeds/` exists only in this dev repository and never inside a scaffolded room, so a part row for it would describe something that has zero implementation in any room a user actually runs. Omitting it here records the ruling as an absence, exactly as `data/icm-parts.json`'s own `_doc.omissions` field records it, rather than silently forgetting a part the input spec once listed.
