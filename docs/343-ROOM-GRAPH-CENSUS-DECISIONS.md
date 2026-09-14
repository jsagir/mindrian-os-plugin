# Phase 343 Room-Graph Census: Decisions, Baseline, and Non-Goals

Status: Active
Implementing phase: 343 (the room-graph audit node and the counter-metric rule)
Sibling contracts: docs/LAYER-DECLARATION-CONTRACT.md (the same registry-is-the-table shape, Phase 344)

---

## Section 1: Why this file is in docs/

`.planning/*` is gitignored in this repository, with only `.planning/debug/` un-ignored (`.gitignore:97-98`). That means `343-RESEARCH.md`, `343-ICM-CONSULT.md`, `343-LANGTALKS-CONSULT.md`, and every PLAN and SUMMARY file this phase writes under `.planning/phases/343-.../` are local-only: they exist on this machine and evaporate at the next machine switch. A decision this phase adopts, a number this phase measured, or a scope fence this phase drew must land here, in a tracked file, or it does not survive.

A reader on another machine is missing the three source files named above and should treat every conclusion below as this file's own reproduction of their content, not a pointer to files they can open.

---

## Section 2: Working decisions, reversible by the navigator

The navigator may reverse any row below. Reversing a WORKING decision is a documented amendment to this table, dated and reasoned, never a silent edit made only in code. Three rows (WD-3, WD-8, WD-16) overturn a recommendation stated in `343-RESEARCH.md` on the strength of `343-ICM-CONSULT.md`'s findings, which the navigator ruled binding; one row (WD-16) overturns a literal reading of the Phase 343 roadmap entry. The overturns column names this honestly rather than leaving a later reader to infer that research and decision disagree.

**Status legend, settled at phase close (2026-09-15):** RULED means the navigator personally reversed or ratified the row at a checkpoint. STANDING means the row shipped exactly as decided, was never challenged, and the phase is closing on it as-is. Nothing below is left as bare WORKING; every row has one of these two closed statuses, or is named as still genuinely open in Section 6.

| id | decision | status | date | source | overturns |
|---|---|---|---|---|---|
| WD-1 | FOUR measurable defect statements ship (edge rows with a missing endpoint, claim nodes with no SOURCED_FROM or DERIVED_FROM anchor, proposed nodes older than N days, and edge rows whose type is outside `ALLOWED_EDGE_TYPES`); self-loops and unresolved CONTRADICTS ship as counts beside them; "stub node" and "memory-event provenance edge" ship as `not_measurable` records naming their reason | STANDING | 2026-09-14 | ICM R3, AP-7; research OQ-1, OQ-2; Phase 347 addendum 2026-09-14 | - |
| WD-2 | The dangling-endpoint measure counts DISTINCT edge rows (2,657 fleet-wide at research time), never the endpoint sum (5,034); the definition is stated in the module header and pinned by one fixture edge missing BOTH endpoints | STANDING | 2026-09-14 | ICM R5; research Pitfall 2 | - |
| WD-3 | The integrity module reuses the shipped `ctx.flags.cascadeRooms` flag rather than minting `flag: "roomGraphIntegrity"`: active room by default, every registered room plus fleet totals under `--cascade-rooms`. No `scripts/doctor.cjs` parseArgs edit | STANDING | 2026-09-14 | navigator instruction; `graph-derive-health-module.cjs` precedent; 344-05 sibling | research "Primary recommendation" |
| WD-4 | `unanchored_claims` reports TWO columns from day one, legacy cohort and new writes, even though new writes is meaningless today | STANDING | 2026-09-14 | ICM R11 | - |
| WD-5 | The sensor threshold is PER ROOM, never a fleet average; the ctx producer measures the BOUND room only and the fleet census stays the doctor's job | STANDING | 2026-09-14 | ICM R9; research OQ-6; three rooms carry 99 percent of dangling edges | - |
| WD-6 | SENS-19 reuses the frozen `contradiction` reach id at posture `hold`. No seventh reach is minted | STANDING | 2026-09-14 | ICM card (b); research A5 | - |
| WD-7 | SENS-19 is placed in `SENS_PRIORITY` Group A (a confirmed room-state fact), not appended at the end | STANDING | 2026-09-14 | ICM R1 | - |
| WD-8 | The counter-metric declaration lands INSIDE `lib/core/sensors/sensor-priority.cjs` as a per-id record `{ id, optimizes, watched_by, why }`, not as a third index-parallel array | STANDING | 2026-09-14 | ICM R7 (one home per fact) | research "Where the declaration lives" |
| WD-9 | The first pair is claims filed versus claims carrying a CONTRADICTS edge versus claims that are no edge's target; divergence is two counts plus one boolean, never a score, and the doctrine carries the unread-log counting rule verbatim | STANDING | 2026-09-14 | ICM R8; roadmap deliverable 3 | - |
| WD-10 | Two windows, both named constants in one file, never literals scattered across statements: `STALE_PROPOSED_DAYS = 30` and `ANCHOR_GRACE_DAYS = 7` (a claim younger than the grace window is reported as pending anchor, not as a defect) | STANDING | 2026-09-14 | research Pitfall 3, A9; LangExtract two-tier rule | - |
| WD-11 | The help-map plan depends on `344-03` and halts with a stated reason if `data/command-registry.json` carries no `layer` field. It never backfills `layer:` itself | STANDING | 2026-09-14 | navigator instruction; 344-06 declared interface | 344-03 confirmed landed before 343-08 ran; the halt path was never exercised (344-03-SUMMARY.md, 343-08-SUMMARY.md) |
| WD-12 | The release lockstep count gets ONE home (`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5) BEFORE the seventh step is written; `CLAUDE.md:64` becomes a pointer carrying no number | STANDING | 2026-09-14 | ICM R2, AP-6 | - |
| WD-13 | The Theo step is a LAGGING gate: it verifies the CURRENT version's stamp before any mutation, and fails closed on a stamp mismatch AND on a network error. `--no-theo-check` exists and is audit-logged | RULED | 2026-09-14 | research shape A, A7, A8, T-343-06; navigator checkpoint ruling `ship-as-designed`, 343-07 Task 2 | - |
| WD-14 | `VERSION-BUMP-CHECKLIST.md` is NOT created in this repo. The seventh place is the `release.sh` step plus RULE 5's enumeration; the roadmap's reference to that filename is recorded as resolved | STANDING | 2026-09-14 | research OQ-3; ICM card (d) | roadmap wording |
| WD-15 | The unanchored-claim FIX is Phase 273 territory. Phase 343 measures it and carries the anchor-ownership blast-radius map forward as a non-goal with its file table intact | STANDING | 2026-09-14 | ICM R10; roadmap scope fence | - |
| WD-16 | The four stale `.room-graph` skip-list entries are ANNOTATED, not removed: removing one changes what four walkers traverse and needs its own proof. Only the wrong path in `docs/lazygraph-schema.md:3` is corrected | STANDING | 2026-09-14 | ICM R13; 344-05's stated behaviour-change rule | a literal reading of roadmap deliverable 7 |
| WD-17 | The five layer names are adopted from Phase 344's `data/layer-declaration-schema.json` and never authored here. If 344 renames a rung, the help map follows the schema | STANDING | 2026-09-14 | research A6, Pattern 4 | - |
| WD-18 | The fourth defect statement is a set difference against the EXPORTED `ALLOWED_EDGE_TYPES` from `lib/core/navigation/edges.cjs`, never a literal copy of the vocabulary; the offending type names are reported, capped and shape-filtered; the bypassing writers are named in the output and not fixed here | STANDING | 2026-09-14 | Phase 347 research addendum, measured 2026-09-14; ICM R10 scope fence | - |
| WD-19 | The SENS-19 threshold sums ONLY the defect classes that vary by room (`edge_rows_missing_endpoint` and `claim_nodes_no_anchor_new`), default 25; the legacy anchor cohort and the edge-type-outside-allowlist count are EXCLUDED from the trigger and ride the reach evidence as information, because a class explained by one named writer gap and present fleet-wide would fire the sensor in every room on every turn and carry no information | STANDING | 2026-09-14 | 343-06 design, against the measured per-room distribution | research sensor skeleton, which sums dangling plus unanchored |
| WD-20 | Under `release.sh --dry-run` the Theo gate performs the read and PRINTS its verdict without aborting; it fails closed only on a real release. Reason: `scripts/doctor.cjs --acceptance` shells `release.sh --dry-run` (RULE 4), so an aborting network call there would let a Theo outage red the whole acceptance roll-up | RULED | 2026-09-14 | 343-07 design; RELEASE-CEREMONY-RULING-SYSTEM RULE 4; navigator checkpoint ruling `ship-as-designed`, unamended, 343-07 Task 2 | - |
| WD-21 | The Theo stamp read is obtained through a command held in an overridable environment variable (`MINDRIAN_THEO_STAMP_CMD`), so the gate's mismatch and unreadable paths are provable hermetically with no network call. A gate whose failure path cannot be tested is an untested backup | STANDING | 2026-09-14 | 343-07 design | - |

### Amendment note: the WD-6 label collision in 343-03-SUMMARY.md

`343-03-PLAN.md` (line 82) and `343-03-SUMMARY.md` both cite "WD-6" as the decision governing the routing-row placement (`.claude/includes/architecture.md` under Connector Spine, rather than inside the `CLAUDE.md` GSD-generated sentinel block, because that block regenerates from a gitignored `.planning/codebase/ARCHITECTURE.md` source and would silently drop a hand-added row). That citation is a mislabel: this table's own WD-6 governs a different decision entirely (SENS-19's reuse of the frozen `contradiction` reach id). The routing-row placement is not a numbered row in this table at all; it directly implements `343-ICM-CONSULT.md`'s R12 recommendation (line 518, "Land the two-file structural move ... plus one routing row in `CLAUDE.md` under Connector Spine"), refined at implementation time to land in the tracked `@include` file rather than the sentinel block for the reason stated. Recorded here, at phase close, so a future reader who opens `343-03-SUMMARY.md` and searches this table for "WD-6" does not conclude the routing row was undone or that WD-6 above was reversed -- it was not; the summary's own internal citation was simply wrong, and CENSUS-06's closure (measured in `.planning/REQUIREMENTS.md`) is unaffected by this correction.

### Checkpoint ruling: 343-07 Task 2, the Theo stamp gate's shape

Ruled by: navigator. Date: 2026-09-14. Selection: `ship-as-designed`.

WD-13 and WD-20 flip from WORKING to RULED, ship-as-designed, on the shape proposed at the checkpoint: a LAGGING gate in `scripts/release.sh`'s preamble, before any mutation, asserting Theo's `mappedBy` equals the CURRENT plugin version (the one about to be superseded); an AUDITED `--no-theo-check` opt-out on the `--no-minisite` / `--no-website` precedent, naming the flag, the version and the consequence in the release log; fails closed when Theo is unreachable. WD-20's dry-run carve-out stands UNAMENDED: under `--dry-run` the gate performs the read and prints its verdict without aborting.

Measured live at the checkpoint (no key value printed): a key resolves through `lib/core/brain-client.cjs` in this shell; `bc.stats()` returns a real object, confirming the wire is reachable; `bc.callTool('command_neighborhood', { command: '/mos:act' })` returns `rows[0]` with `mappedBy` and `registryHash` populated. Today's stamp reads `mappedBy: command-registry@2.0.0-beta.12` against a repo version of `2.0.0-beta.40`, so the gate, once shipped, correctly FAILS on the current tree until Theo re-emits (Theo Phase 19 is that re-emission; Theo Phase 21's counter-metric pairs with this gate).

---

## Section 3: Measured and not measurable

### Measured fleet baseline, 2026-09-14

Every number below was produced by running SQL directly against the 30 real `room.db` files reachable from `~/MindrianRooms/.rooms/registry.json` on 2026-09-14, opened through `openRoomDbReadOnlyForCaller` (`mode=ro`), never by reasoning about the schema.

- 46 registry entries, 30 with a `room.db` on disk.
- 36,555 node rows fleet-wide; 11,896 edge rows fleet-wide.
- 2,657 edge rows with a missing source or target node, counted as DISTINCT rows (counting endpoints separately gives 5,034; WD-2 pins DISTINCT rows as the definition).
- 7,824 of 7,894 claim nodes carry no `SOURCED_FROM` or `DERIVED_FROM` out-edge (99.1 percent).
- 10,219 of 10,807 `proposed` nodes are older than 30 days.
- 0 `CONTRADICTS` edges exist in any room.
- 10 self-loop edges (`source = target`), concentrated in `mindrianOS` (6) and `aion-eureka-synergy` (3).
- Edge rows carrying a type outside the exported `ALLOWED_EDGE_TYPES`: `BELONGS_TO` 1,032, `WHITESPACE_DETECTED` 215, `HSI_CONNECTION` 47 fleet-wide; none of them a member of the 44-member allowlist; written by raw inserts at `lib/core/graph-ops.cjs:196,250,262` and `scripts/build-ecosystem-graph.cjs`.
- Three schema variants in the wild: 23 rooms migrated (16-column), 3 rooms partially migrated (12-column), 4 rooms legacy (3-column).
- A full fleet sweep across all five/nine counting statements completes in 186 ms on this machine.

Consequence recorded here because it is load-bearing: `CLAUDE.md:153`'s statement that typed edges are written only through `navigation.cjs` is currently false on this measured evidence. The bypass (`graph-ops.cjs`, `build-ecosystem-graph.cjs`) is measured here and its fix belongs to Phase 273, not this phase.

These are a snapshot. They will drift with every session that writes a claim, opens an edge, or ages a proposed node past 30 days. A number quoted in a later plan, summary, or doctor run must be re-measured against the live fleet, never copied from this table.

### Not measurable: two records the phase deliberately does not ship as defects

**"Stub or placeholder node."** No working definition survives contact with the schema. The obvious test (`properties IS NULL OR properties = '' OR properties = '{}'`) returns zero across the entire fleet, because `insertNode` requires `epistemic_type` and fills provenance columns on every write, making a structurally empty node close to unwritable through the chokepoint. No candidate definition tried during research produced a non-zero, meaningful count. Reason recorded: a measurement that cannot be non-zero is worse than no measurement, because it reads as a clean bill of health rather than as an unmeasured gap.

**"Memory-event provenance edge."** Named in the LangExtract two-tier anchor rule as a second structural anchor alongside `SOURCED_FROM`, but it has no writer anywhere in the repository: `lib/core/navigation/memory-events.cjs:764-777`'s `logEvent` writes exactly zero edges. No edge type in the fleet links a claim to a `memory_event` node; of 23,736 `memory_event` nodes, only 953 are any edge's endpoint at all, and none of those edges are a provenance link. This phrase names a design, not a shipped mechanism. It is ghosted here rather than measured, because a defect statement against a mechanism with zero writers and zero possible instances would report a structural zero indistinguishable from a clean bill of health.

The rule this phase inherits from both records: a measurement that cannot be non-zero is worse than no measurement, so neither ships as a defect statement.

---

## Section 4: The name collision, stated once

Two databases share one name fragment, at two different levels of the system, and nothing in the repository states this in one place before this document.

**Fleet level.** `$ROOMS_HOME/.rooms/.room-graph/rooms.db` is the LIVE rooms registry database. This is the real, current fleet-level registry graph, referenced correctly at `scripts/sync-rooms-graph:29` and `references/brain/room-hierarchy-schema.md:121`.

**Room level.** `.room-graph/` as a per-room path is DEAD. The real per-room database path is `<roomDir>/.mindrian/room.db` (`lib/core/room-db.cjs:255-256`).

**Consequence.** A plan or a script that globs `.room-graph/room.db` finds exactly one file on this machine, and it is the fleet registry, not a room graph. Treating that file as a room's local graph is a category error with no error message to catch it.

**The five stale in-code sites**, measured this session, each carrying a per-room skip-list entry that references the dead `.room-graph` path and is annotated rather than removed per WD-16:

- `lib/core/rs_corpus_exclude.py:48`
- `lib/core/cross-room-aggregator.cjs:127`
- `lib/core/rs-engine.cjs:87`
- `lib/core/eureka/reasoning-mode.cjs:72`
- `scripts/eureka-command.cjs:170` (in a comment)

WD-16 records why these are annotated, not removed: all four skip-lists already carry `.mindrian` alongside the stale `.room-graph` entry, so the `.room-graph` entry is inert dead weight, not an active bug. Removing an inert entry still changes what four walkers traverse on disk and needs its own proof, which is out of this phase's scope. Only the genuinely wrong doctrine line, `docs/lazygraph-schema.md:3`'s 2026-06-14 correction notice (which fixes one error, KuzuDB to SQLite, and introduces another in the same sentence by naming the room-level path as `room/.room-graph/room.db`), is corrected in this phase, because a wrong correction notice reads as freshly verified and is the more expensive kind of stale doctrine.

---

## Section 5: Non-goal: the anchor fix is Phase 273

**The question.** Which part of the system owns the fix for claims written with no structural anchor: the writer `typed-claim.cjs`, the write chokepoint `node-insert.cjs`, the filing tool `artifact_file`, or the reasoning writer `reasoning-write.cjs`?

**The answer, carried forward from the ICM consult intact.** None of the four alone. The owner is the claim-write PROCESS, and its enforcement point is the writer's contract, `lib/core/navigation/typed-claim.cjs:121` `writeClaimNode`, with the actual anchor values supplied by its callers.

- **Not `node-insert.cjs`.** It is the node write chokepoint and has no edge surface at all; its entire contract is inserting one row into `nodes` correctly across three schema variants. An anchor is a row in `edges`. This is the obvious next file and it is the wrong one.
- **Not `reasoning-write.cjs`.** It already does the right thing: it writes `SOURCED_FROM` per target, and its zero-row output is caused entirely by empty target lists, guarded by an explicit and correct design floor at `:163-165` (never fabricate provenance). Changing this file to invent an anchor would replace an honest zero with a fabricated edge, which is worse than the defect.
- **Not `artifact_file`.** It is one caller of one of the two writers. Fixing it fixes only its own claims and leaves `writeClaimNode`'s 6,749 dominant rows untouched.
- **Yes, `typed-claim.cjs::writeClaimNode`, as the enforcement point.** It is the dominant claim producer, it already owns the claim's shape and its idempotency key, and it is the one place where "a claim was created" is observable.

**File-by-file table: what changes if the structural anchor becomes mandatory at creation**, carried intact from the consult:

| File | Change | Breaks? |
|---|---|---|
| `lib/core/navigation/typed-claim.cjs:121` | New required param `anchor: { target_id, edge_type }` validated against `{SOURCED_FROM, DERIVED_FROM}`; returns `{ok:false, reason:'missing_structural_anchor'}` when absent; writes the edge via `edges.writeEdge` after `insertNode` succeeds | contract change |
| `lib/core/navigation/edges.cjs` | none. `SOURCED_FROM` is already a legal member | no |
| `lib/core/node-insert.cjs` | none | no |
| `lib/core/graph-derivation.cjs:330` | already writes a typed edge at `:357`; pass its existing target as the anchor, or add a `DERIVED_FROM` alongside | adapt, 1 line |
| `lib/core/unknowns/edge-writer.cjs:128` | already writes a cascade edge at `:146`; same adaptation | adapt, 1 line |
| `scripts/huji-intake.cjs:393` | already writes `RELATED_TO`/`SUPPORTS` at `:409+`; same adaptation | adapt, 1 line |
| `lib/core/domain-insight-sweep.cjs:176` | no edge today. Needs an anchor source: the domain handle node it swept | BREAKS |
| `lib/core/eureka/grade-grant.cjs:493` | no edge today. Anchor: the grant/opportunity node being graded | BREAKS |
| `lib/core/navigation/room-birth.cjs:856` | no edge today. The venture claim is the room's root claim and has nothing above it | BREAKS, and is the genuine hard case |
| `lib/mcp/tools/claim.cjs:133` | no edge today. MCP `claim_write` has no anchor parameter in its schema | BREAKS, schema change |
| `lib/mcp/tool-router.cjs:1475` | no edge today. `meeting file-meeting` writes one claim from a transcript segment | BREAKS, schema change |
| `lib/mcp/tools/views.cjs:221` | separate writer (`writeReasoningNode`); needs its own mandatory-subject change or it becomes the new leak | parallel change |

Five call sites break, two of them MCP tool schemas, one of them a genuine design problem: `room-birth.cjs:856`'s root venture claim is legitimately unanchored because it has no parent claim above it in the graph. This is the case that makes the rule "anchor, or an explicit, recorded exemption" rather than "anchor, full stop": a root node is legitimately unanchored and should be marked so, not counted as a defect.

**The three-tier migration for the 7,824 existing unanchored claims**, should Phase 273 take this on: (1) derivable claims, whose `source_segment` resolves to a known artifact or memory_event id, anchored deterministically, scale unmeasured; (2) root-exempt claims from `room-birth.cjs`, given an explicit exemption marker rather than a fabricated edge; (3) the vast un-derivable majority, left as-is and reported as a legacy cohort with a frozen count, so a post-fix `unanchored_claims_new` column can be structurally zero and a non-zero value there becomes a genuine alarm rather than background noise.

**Stated plainly, as this phase's own scope fence requires.** The fix is Phase 273 territory. Phase 343 measures it. A Phase 343 change that adds an anchor edge to `writeClaimNode` has left the phase. The value of carrying this map forward is that when Phase 273 opens, the blast radius is already known: one writer contract, five broken callers, two MCP tool schemas, one root-node exemption, and a three-tier migration, not an unbounded audit.

---

## Section 6: Open questions the navigator has not answered

Each row below was OPEN as of 2026-09-14, carried forward from `343-RESEARCH.md`'s Open Questions and Assumptions Log, named with the later plan its answer would affect. At phase close (2026-09-15) two of the four are RESOLVED; two remain genuinely OPEN and are handed to whichever future plan touches this territory next.

- **OPEN. The divergence ratio that counts as a finding.** The first counter-metric pair reads 7,836 claims filed, 0 contradicted, 7,026 never cited past the citation lag as of the 2026-09-15 close-out measurement (drifted from the 343-04 research-time snapshot of 7,794/0/7,791, exactly as Section 3's drift warning predicts). What ratio, or what threshold, turns that divergence into a doctor or sensor finding rather than a passive count is still unset. This phase deliberately ships counts and a boolean, never a ratio (WD-9), so this question was never in this phase's own scope to answer. Affects: whichever future plan revisits `343-05`'s territory.
- **RESOLVED 2026-09-14, at the 343-07 Task 2 checkpoint.** Whether `--no-theo-check` should exist at all. The navigator ruled `ship-as-designed`: the audited opt-out stands, on the `--no-minisite`/`--no-website` precedent, visible and logged, never silent. See the checkpoint ruling above WD-13/WD-20 for the full ruling text.
- **OPEN. Whether `contradiction` or `context_block` is the right reach id for SENS-19.** WD-6 shipped `contradiction` at MEDIUM confidence (research A5) and is STANDING (unchallenged, the phase is closing on it); `context_block` remains the alternative most recent sensors have chosen, and this is a semantic product decision, not a purely mechanical one, that no checkpoint in this phase revisited. Affects: any future sensor-taxonomy pass touching SENS-19 or SENS-11/SENS-16's shared reach.
- **RESOLVED 2026-09-14, by the 343-07 Task 1/2 live probe.** Whether `release.sh` can reach Theo without a credential. Measured live, no key value printed: a key resolves through `lib/core/brain-client.cjs` in the release environment, `bc.stats()` returns a real object confirming the wire is reachable, and `bc.callTool('command_neighborhood', ...)` returns a populated `mappedBy`/`registryHash` row. The release environment DOES hold a working credential; the gate is a real gate that can fail, not a decoration that cannot.
