---
layer: graph
status: active
canon_parts: [7, 8, 9]
implementing_phase: 348
sibling_contract: docs/LAYER-DECLARATION-CONTRACT.md
---

# The Supersession Contract

This document is the durable half of Phase 348 (the supersession node). `.planning/` is
gitignored (`.gitignore:97`, CLAUDE.md WORKSPACE GUARD), so every ruling this phase makes that
lives only in a `PLAN.md` evaporates at the next machine switch. This file is the tracked
survivor: the invalidated-not-deleted contract, the measured census, the four rulings, the
human gate, the D-08 scoping, the Tri-Polar statement, the layer declaration, the grounding
trail, and both ledgers (the nine navigator locks D-01..D-09 and the twelve reversible working
decisions WD-348-1..12) all live here, not in `348-01-PLAN.md`.

## Why this contract exists

The roadmap card that opened this phase asked for a supersession mechanism to be BUILT. The
mechanism already ships: `supersede()` (`lib/core/temporal/supersession.cjs`, Phase 160-04 Task
2), `walkSupersedesChain` (`lib/core/temporal/supersession.cjs:174`, Phase 223-02), `queryAsOf`
(`lib/core/temporal/point-in-time.cjs:45`, Phase 160-05), `'superseded'` in the Phase 109 CHECK
constraint (`lib/core/migrations/phase-109-nodes-provenance.cjs:300`), `confirmed->superseded`
in the closed `TRANSITIONS` set (`lib/core/navigation/transitions.cjs:60-69`), and `SUPERSEDES`
in the `ALLOWED_EDGE_TYPES` allow-list (`lib/core/navigation/edges.cjs:164`) since Phase 131.
What does not exist is the trigger: nothing in the fleet ever calls `supersede()` with a real
pair of claims.

## The measured state, stated once and never softened

A live read-only census across all 47 `room.db` files under `~/MindrianRooms` on 2026-09-16
found: 0 CONTRADICTS edges, 0 SUPERSEDES edges, 0 nodes at `review_status='superseded'`, 0
nodes with `invalidated_at` set, 0 nodes with `valid_to` set; only `confirmed` (28,577) and
`proposed` (11,064) are populated anywhere. This phase does NOT change those numbers. Every
proof this phase ships is fixture-driven, never fleet-observed, and Phase 350 is the card that
makes the loop fleet-observable, not this one.

## The contract: superseded is CLOSED, never deleted

Quoting `lib/core/temporal/supersession.cjs:12-16` verbatim:

```
//   - A.invalidated_at = reference now,
//   - A.valid_to = B.valid_from,
//   - A.review_status = 'superseded',
//   - a SUPERSEDES edge B->A is written,
//   - a status_superseded memory_event is logged.
```

A supersession does five things: it writes the `review_status='superseded'` status, it sets
`invalidated_at`, it sets `valid_to`, it writes a `SUPERSEDES` edge from the new claim B to the
old claim A, and it logs a `status_superseded` audit event. A supersession never does two
things: it never deletes the node, and it never deletes any edge incident to it. The old node
row keeps existing after supersession, so a point-in-time query as-of a moment BEFORE the
supersession still returns it, exactly the audit-trail guarantee Canon Part 9 role 5 and Part 4
demand.

## The one door (SUPER-01)

`supersede()` is the only supersession writer in the repo. `promoteNodeStatus`
(`lib/core/navigation/transitions.cjs`) is the only writer of `review_status='superseded'`.
This is a Canon Part 7 requirement (reuse before build, one governed write chokepoint), not a
style preference: a second supersession writer would be a second door into the same lock, and
Canon Part 9's substrate guard names exactly one door per truth-state mutation. A source
tripwire enforces this mechanically: it asserts no code outside
`lib/core/navigation/transitions.cjs::promoteNodeStatus` sets `review_status` to `'superseded'`,
and that no surface this phase ships issues a `DELETE` against `nodes` or `edges`.

## Ruling 1, the contradiction shape (D-03 / D-04)

Direct claim-to-claim is in scope. The reified shape (`ContradictionEvent --CONCERNS-->
claim` plus `ContradictionEvent --CONTRADICTS--> rivalClaim`,
`lib/core/navigation/reified-claim.cjs:241-268`) is OUT of scope, because `findContradictions`
projects edge endpoints straight into `claimA` / `claimB`, and under the reified shape `claimA`
would resolve to an event node, not a claim, and superseding an event is meaningless. The
guard: skip with the named reason `reified_shape_out_of_scope`, never follow the `CONCERNS` hop
to reach the real claim, never fabricate a claim identity from an event node. The follow-on
owner is named, not silently dropped: Phase 350's own card carries the reified-shape question
forward alongside the live CONTRADICTS writer.

## Ruling 2, the validity window (D-06)

Two representations of a validity window exist in the repo today. `typed-claim.cjs:144-145`
writes `properties.valid_from` / `valid_until` as strings, on the additive JSON props bag, read
by nothing. The Phase 160 migration writes `nodes.valid_from` / `valid_to` /
`invalidated_at` as integer columns, read by `supersede()` and by `queryAsOf`. The two pairs
disagree on more than type: the props pair is named `valid_until`, the column pair is named
`valid_to`, a naming mismatch layered on top of the type mismatch.

The ruling: the COLUMNS are authoritative, because they are what `supersede()` and `queryAsOf`
actually read. The props strings are DISPLAY-ONLY, and this document states that plainly at
their write site rather than leaving it implicit. No third representation is added.
`WD-348-2` records the reasoning for taking the display-only branch rather than the
parse-at-write-time branch: the columns are already what the shipped readers read
(`supersession.cjs:73`, `point-in-time.cjs:45`), parsing would be a live behavior change on
every meeting-extracted claim, and the census measured ZERO claims carrying a non-empty props
`valid_until` in the dogfood room, so there is nothing to migrate and no consumer to benefit.
The consequence is stated plainly: a meeting-stated expiry does not close a claim today, and
will not until a future phase gives it a consumer.

## Ruling 3, TRANSITIONS does not move (D-05)

`TRANSITIONS` (`lib/core/navigation/transitions.cjs:60-69`) is a canon-named closed literal
with eight members. `confirmed->superseded` is the only entry into `superseded`. 11,064 fleet
nodes sit at `proposed`, structurally unsupersedable under the current set. The ruling: keep
the set byte-unchanged, and route a proposed rival through the already-legal
`proposed->rejected` transition instead of minting a new `proposed->superseded` entry. The
reason in plain words: a claim nobody ever confirmed was never a believed fact, so it cannot
become a stale fact; rejecting it is the honest transition, not superseding it. This reasoning
is written out here so a future phase does not re-litigate it blind, which is exactly what
D-05 asks for.

## Ruling 4, review_status is primary truth, not a projection (D-07, SUPER-20)

Phase 347's WD-347-2 ruling, quoted from `docs/2026-09-14-PHASE-347-SHARED-STATE-CLOSE-OUT.md`:
"The graph was not promoted to primary chain-state truth (WD-347-2). `room/.mindrian/pipeline-
state.json` remains the declared sole truth for resume position; the `chain_state` graph is a
projection, and the file wins on disagreement."

That analogy does NOT transfer to `review_status`. `chain_state` had a competing file-based
store (`pipeline-state.json`) to be a projection of. `review_status` has none: `room.db` is the
only place it lives, so there is nothing for it to project from. The narrower transferable
lesson carries forward instead: be explicit about precedence whenever two stores exist, which
is exactly why Ruling 2 above exists in this same document, naming the columns authoritative
over the display-only props strings.

## The human gate (SUPER-02, SUPER-03)

The pre-existing hole, stated plainly and dated: as of 2026-09-16, any agent, hook or
background job holding a `db` handle can call `supersede()` with the default `byUser: 'system'`
and close a human-confirmed truth claim, because the human-attribution guard at
`transitions.cjs:174-186` fires only for `confirmed` / `validated` targets, and its own comment
at `:179-181` says superseded is never gated. This phase closes that gap: a supersession of a
truth-claim node attributed to an agent identity (`larry` / `brain` / `system` / `assistant`)
is now REFUSED with `agent_attribution_forbidden`. This is a pre-existing hole this phase fixes,
not one this phase introduces. The human identity on the gate path is resolved through the
shipped `resolveByUser` door (`lib/core/navigation/confirm-node.cjs:46`), never read from a
caller-supplied string, so a poisoned `USER.md` cannot smuggle an agent identity into a
supersession.

## Scoping to the validated edge door (D-08, SUPER-19)

Every assertion this phase makes is scoped to edges reachable through `writeEdge`. The Phase
347 edge-chokepoint bypass (raw `INSERT INTO edges` at `lib/core/graph-ops.cjs:196,250,262` and
in `scripts/build-ecosystem-graph.cjs`) stays out of scope, reaffirming Phase 347's own ruling
not to re-open it. The supersession gate path runs a defensive endpoint-existence check so an
edge that bypassed edge validation cannot drive a supersession, a narrower move than closing
the bypass itself.

## Tri-Polar (the three surfaces)

One row per `CAPABILITY_MAP` key (`lib/mcp/surface-detect.cjs:22-26`), read live rather than
hand-typed:

| Surface | Mechanism reachable | Read flag reachable | Gate consequence surface |
|---|---|---|---|
| `cli` | yes (pure `lib/core/` function, caller-owned handle) | yes, via `contradiction_check` | not-applicable, no invocable surface ships this phase (WD-348-3) |
| `desktop` | yes (pure `lib/core/` function, caller-owned handle) | yes, via `contradiction_check` | not-applicable, no invocable surface ships this phase (WD-348-3) |
| `cowork` | yes (pure `lib/core/` function, caller-owned handle) | yes, via `contradiction_check` | not-applicable, no invocable surface ships this phase (WD-348-3) |

The mechanism is a pure `lib/core/` function reachable on all three surfaces through the
caller-owned handle contract. The read flag (`includeSuperseded`) reaches the model through
`contradiction_check` on all three. The gate-consequence path has no invocable surface on any
of the three surfaces in this phase, per WD-348-3: D-01/D-02 leave the trigger to the sibling
phase, and a registered surface with no trigger would be a CIRS-visible ghost. This is a stated
call, not an oversight.

## The layer declaration

`layer: graph`, declared against the closed vocabulary Phase 344-01 ships
(`data/layer-declaration-schema.json`'s `_doc.layer_vocabulary`). The one-value rule: this
surface declares the rung it ENGINEERS, never the highest rung it rests on. The counter-
argument, answered in writing: the human gate looks like a LOOP concern because it is a
stopping condition, but the thing being gated is a node-lifecycle write, and
`348-RESEARCH.md`'s own Architectural Responsibility Map files the status write and the
`SUPERSEDES` edge under HARNESS with GRAPH secondary, and files the edge-shape question under
GRAPH outright. Bi-temporal fact invalidation is edge-and-node-lifecycle vocabulary, the GRAPH
rung's own core concern, and the whole sibling cluster (Phase 345, 346, 347) declares the same
value.

## Grounding and its honest gaps

The Zep/Graphiti comparison is sourced to
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-14-mindrianos-classification-and-zep-graphiti-supersession-gap.md`,
NOT to a live langtalks corpus entry: five `get_entity` probes this session (Zep, Graphiti,
bi-temporal, Temporal Knowledge Graph, fact invalidation) all returned `found: false`. What the
corpus DOES carry, and what this phase cites instead: `Approval gate <--part_of [EXTRACTED]--
Human` for the human-gated-consequence requirement, and arXiv 2603.14828 ("retrieval drift", 1
citation) for why a stale uncorrected claim is a correctness bug rather than untidiness.
`Contradiction` is corpus whitespace, so every claim this document makes about ACTING on a
contradiction is this repo's own design, named as such rather than attributed to a source that
does not carry it.

## The navigator's locks (D-01..D-09)

These nine rows were ratified by the navigator on 2026-09-16 in `348-CONTEXT.md` after a
discuss-phase pass. They are the scope contract for the whole phase: no task in any plan in
this phase may narrow, widen or silently reinterpret one. Reproduced verbatim here so they
survive a machine switch, because `348-CONTEXT.md` is gitignored.

| ID | Lock |
|---|---|
| D-01 | Narrow scope: harden the shipped mechanism, reconcile the validity windows, reshape `findContradictions`, write the doctrine, and prove it end to end on a fixture. Do NOT mint a live `CONTRADICTS` writer. |
| D-02 | A new sibling-phase ROADMAP card for the live CONTRADICTS writer is this phase's OWN deliverable to register, not a prose mention. |
| D-03 | Direct claim-to-claim is this phase's in-scope contradiction shape. The reified `ContradictionEvent --CONTRADICTS--> rivalClaim` shape is explicitly OUT of scope, named with a follow-on, never silently ignored. |
| D-04 | A reified-shape edge must not be silently misread as "claim A". Fail closed, skip with a named reason, never fabricate a claim identity from an event node. |
| D-05 | `TRANSITIONS` stays byte-unchanged. Proposed-status rivals route through the already-legal `proposed->rejected`. Document the reasoning so a future phase does not re-litigate it blind. |
| D-06 | The integer columns (`nodes.valid_from` / `nodes.valid_to`) are authoritative. The string props `typed-claim.cjs` writes are either parsed into the columns at write time or explicitly marked display-only. No third representation. |
| D-07 | Phase 347's WD-347-2 projection-vs-primary-truth analogy does NOT transfer. `review_status` is primary truth; there is no competing store. Carry forward only the narrower lesson: be explicit about precedence whenever two stores exist. |
| D-08 | The Phase 347 edge-chokepoint bypass stays out of scope. Scope every 348 assertion to edges reachable through `writeEdge`, and add a defensive endpoint-existence check on the supersession gate path without attempting to close the bypass. |
| D-09 | The langtalks `add_source` Gemini-403 blocker gets a named owner and a tracked `docs/OPEN-HANDOFFS.md` row. The blocker itself is not this phase's to fix. |

## Working decisions, reversible by the navigator

This table, not `348-01-PLAN.md`, is the durable home for these twelve decisions, because
`.planning/` is gitignored and a decision recorded only in a plan evaporates at the next
machine switch. Every row is Claude's working call, adopted so planning could proceed without
stopping for a ruling; each is a bounded edit to overturn.

| # | Decision | Why | Status | Reverses by |
|---|---|---|---|---|
| WD-348-1 | The requirement prefix is `SUPER`, twenty ids, one family. | Verified free this session: `grep -rohE "\b(SUPER\|SUPERSEDE\|BITEMP\|TEMPORAL\|INVAL)-[0-9]{2}\b" .planning/` returns zero hits, and `SUPER` is not among the live prefixes in `.planning/REQUIREMENTS.md`. Matches the sibling pattern (345 `STRAT`, 346 `ARB`, 347 `SHARED`). | WORKING | a family-wide rename before execution starts |
| WD-348-2 | D-06 takes its DISPLAY-ONLY branch, not its parse-at-write-time branch. `typed-claim.cjs`'s `properties.valid_from` / `valid_until` strings are marked display-only at the write site and in this contract; nothing parses them into the columns. | The columns are already what the shipped readers read (`supersession.cjs:73`, `point-in-time.cjs:45`). Parsing would be a live behavior change on every meeting-extracted claim, and the census measured ZERO claims carrying a non-empty props `valid_until` in the dogfood room, so there is nothing to migrate and no consumer to benefit. D-06 explicitly permits either branch. | WORKING | adding a parse step in `typed-claim.cjs` and a column write in `insertNode` |
| WD-348-3 | The gate-consequence path ships as a pure `lib/core/temporal/supersession-gate.cjs` function with NO new invocable surface (no MCP tool, no command, no agent, no pipeline) in this phase. | D-01/D-02 leave the trigger to the sibling phase. A registered surface with no trigger is a CIRS-visible ghost, and Canon Part 11 R16 would make it declare a HITL shape for a fork nothing can reach. The sibling phase registers it together with the writer that feeds it. | WORKING | registering the module as an MCP tool with its own `hitl_shape` / `layer`, which is the sibling phase's own first task |
| WD-348-4 | The D-04 skip reason is surfaced through an OPTIONAL caller-supplied `opts.skipped` sink array. Absent bag, absent sink, byte-identical return. | The additive-floor idiom (`edges.cjs:812-816`) forbids changing the return shape, and an honest refusal (Pattern 4) requires the reason be retrievable rather than implied. A sink satisfies both at zero default cost; a second exported function would be a second read surface to keep in sync. | WORKING | swapping the sink for a callback, or dropping it and leaving the reason in the contract and the test name only |
| WD-348-5 | The human-attribution guard is widened by adding a SEPARATE `setsSuperseded` predicate to the guard condition only. `setsConfirmed` is never widened. | `setsConfirmed` also selects the `confirmed_by` / `confirmed_at` UPDATE branch at `transitions.cjs:195-197`. Widening it would write `confirmed_by` on a supersession and skip the bitemporal close entirely, silently destroying the `invalidated_at` / `valid_to` write. | WORKING | n/a as a design; the alternative considered and rejected was a separate guard function above the branch |
| WD-348-6 | The guard's blast radius on `close-loop-writer.cjs:478` is ACCEPTED rather than routed around: BONO conclusion version cuts must be human-attributed too. | That call site is the ONLY live caller of `supersede()` and it supplies no `byUser`, so `supersession.cjs:90` defaults it to `'system'`. It has produced 0 SUPERSEDES edges in 47 rooms. Today it already fails with `invalid_transition` (its conclusion nodes are `claim` type at `proposed`); after this phase it would fail with `agent_attribution_forbidden` if a conclusion were ever confirmed first. Either way it has never succeeded. | WORKING | threading a `resolveByUser`-resolved human `byUser` into the `supersedeFn` call at `close-loop-writer.cjs:478`, which is outside this phase's `files_modified` and is registered as a deferred item at phase close |
| WD-348-7 | The bitemporal-close schema guard fails CLOSED with the named reason `bitemporal_close_unsupported_schema`, never degrading to the plain status UPDATE. | A superseded node with no `invalidated_at` and no `valid_to` is exactly the non-traceable close deliverable 2 forbids. Silent degradation would produce it. | WORKING | changing the fallback branch |
| WD-348-8 | `layer: graph`, against the Phase 344 closed vocabulary. | Bi-temporal fact invalidation is edge-and-node-lifecycle vocabulary, the GRAPH rung's own core concern per `348-RESEARCH.md`'s Architectural Responsibility Map, and the whole sibling cluster (345, 346, 347) declares the same. | WORKING | one frontmatter value in `docs/SUPERSESSION-CONTRACT.md` |
| WD-348-9 | The D-02 sibling phase is registered as Phase 350, the next free number after 349, not inserted between 348 and 349. | 349 is already scoped and its own `Depends on:` line says "Not sequential on Phase 348", so inserting ahead of it buys nothing and renumbers a live card. D-02's own text leaves the sequencing to the planner and requires only that the card be real, numbered and scoped. | WORKING | renumbering the card in `.planning/ROADMAP.md` |
| WD-348-10 | RULED at the 348-08 blocking checkpoint (2026-09-16): the navigator replied "Approved as specified" - the Part 9 narrowing lands as a full canon amendment (Appendix D entry 41, version 1.27 -> 1.28, the CANON-PHASE-MAP row, a new FLOOR test, every existing canon FLOOR test's version anchor moved, the `CLAUDE.md` Part 9 sibling edit in the same commit), per the entry 39 / entry 40 precedent, with zero wording changes requested. Landed by 348-09. | Canon as written PERMITTED what this phase forbids ("only user confirmation or system rules can promote a status", `docs/MINDRIAN-CANON.md`'s pre-1.28 Part 9 text). Narrowing it is a doctrine change, not a cross-reference, and every doctrine change in this repo's history has carried the full lockstep. | RULED | n/a - ratified and landed; a future navigator reopening the narrowing would be a fresh amendment, not a reversal of this row |
| WD-348-11 | The phase goal text states plainly that the fleet census stays at zero after this phase ships, and that every proof is fixture-driven. | `348-RESEARCH.md` Risk (a): this phase can ship fully green and change nothing observable, because nothing writes the input edge. Saying so in the goal is the difference between an honest phase and a green dashboard. | WORKING | taking the sibling phase's writer into this phase, which D-01 explicitly rejected |
| WD-348-12 | All four `lib/core` callers of `findContradictions` take the new DEFAULT (superseded excluded). Only the MCP surface opts in, through `include_superseded`. Each call site carries a one-line declaration comment. | `348-RESEARCH.md` Risk (b): the exclusion is a default-behavior change on five callers, one of which (`packet.cjs:340`) is a Canon Part 8 wire surface. Excluding a closed claim from the Brain packet is strictly safer, and a surfaced contradiction against a claim nobody believes any more is noise on the other three. | WORKING | flipping any one caller's declaration to `includeSuperseded: true` |

## Ratified wording for 348-09 (recorded at the 348-08 checkpoint)

The 348-08 blocking checkpoint (Task 1) ratified two texts in one sitting, alongside the
version target (v1.27 -> v1.28), the entry-31 self-binding release, and WD-348-10 (full atomic
lockstep). Provenance: the orchestrator ran `bash tests/run-all-348.sh` (PASS=24 FAIL=0 SKIP=2
EXPECTED-RED=0) and `node scripts/doctor.cjs --acceptance` (20/20) live in the session, confirmed
`git diff --name-only skills/larry-personality/SKILL.md docs/MINDRIAN-CANON.md` was empty,
quoted the current Part 9 sentence verbatim, and presented both content specs to the navigator
honestly labeled as specs, not pre-written prose. The navigator's real answer, recorded in the
conversation transcript: **"Approved as specified"** - land both texts as scoped, full atomic
lockstep (WD-348-10), version to 1.28, entry-31 released the same way entries 32-40 recorded it.
Zero wording changes were requested. The skill half of this ratification landed at 348-08 Task 2
(`skills/larry-personality/SKILL.md`, commit `7fb0030dc`). The canon half below is what 348-09
must transcribe verbatim, per its own instruction: "Land THAT wording. Do not re-derive it, do
not improve it, and do not paraphrase it."

### The Part 9 narrowing paragraph (for `docs/MINDRIAN-CANON.md`, Part 9, "Truth states (canonical)")

Insert immediately after the existing sentence "Every node in `room.db` carries a
`review_status` from a closed set: `proposed | confirmed | rejected | stale | superseded |
needs_evidence | validated | invalidated`. Brain may *propose* a status; only user confirmation
or system rules can *promote* a status. Status transitions are events in the memory log, never
silent overwrites." Land this paragraph verbatim, as its own paragraph in the same subsection:

> **Narrowing for `superseded` (Phase 348, Appendix D entry 41).** For the `superseded` target
> specifically, on a truth-claim node, the "or system rules" clause above does not hold: only a
> human-attributed gate answer may *promote* a truth-claim node's status to `superseded`. Closing
> a believed fact is itself an assertion about the venture's world, and it carries the same human
> bar role 5 already places on promoting a node to `confirmed`. This narrows nothing else:
> `rejected` and `stale` remain agent-reachable, and the audit-node carve-out below is untouched -
> system-bookkeeping nodes stay exempt, as they already are. The chokepoint that enforces this
> narrowing: `lib/core/navigation/transitions.cjs::promoteNodeStatus` refuses an agent-attributed
> transition into `superseded` for a truth-claim node as of Phase 348. Full contract:
> `docs/SUPERSESSION-CONTRACT.md`.

### Appendix D entry 41 (for `docs/MINDRIAN-CANON.md`, appended after entry 40)

Land this entry verbatim, numbered `41.`, in the shape entries 39 and 40 established:

> 41. **Part 9 narrowed: only a human-attributed gate answer may close a truth-claim node as
> `superseded` (Phase 348, 2026-09-16).** Phase 348 (the-supersession-node) narrows Part 9's Truth
> states (canonical) subsection for one target status. As written, that subsection permitted
> "user confirmation or system rules" to promote any status, including `superseded`; the roadmap
> card that opened Phase 348 forbids a system rule from closing a believed fact with no human, and
> this entry brings the Canon's own text into agreement with the code Phase 348-03 already
> shipped. The narrowing: for the `superseded` target specifically, on a truth-claim node, the "or
> system rules" clause no longer applies; only a human-attributed gate answer may promote a
> truth-claim node's status to `superseded`. The reason, in one clause: closing a believed fact is
> itself an assertion about the venture's world, carrying the same human bar role 5 already places
> on promoting a node to `confirmed`. What is NOT narrowed, stated so the narrowing cannot be
> over-read: `rejected` and `stale` remain agent-reachable, and the audit-node carve-out
> (system-bookkeeping nodes exempt) is untouched. This entry RATIFIES already-shipped code rather
> than minting a new mechanism: `lib/core/navigation/transitions.cjs::promoteNodeStatus`, the
> truth-state chokepoint, has refused an agent-attributed transition into `superseded` for a
> truth-claim node since Phase 348-03, so canon and code are consistent the instant this entry
> lands. This was navigator-APPROVED at a blocking checkpoint on 2026-09-16 BEFORE any canon byte
> was written (the navigator confirmed the version target v1.27 -> v1.28). Entry 31's
> self-binding clause (no further Appendix D entry until entry 31 returns a live two-gauge
> reading) was RELEASED for this amendment by the Part-10 navigator-authority override (entry
> 20), recorded truthfully - no two-gauge reading was taken or fabricated, the release rests on
> navigator authority, the deferred reading stays a named debt, mirroring entries
> 32/33/34/35/36/37/38/39/40. Applied via the Part 6 dog-fooding canon-amendment-on-itself
> mechanism, mirroring entries 14/15/25/26/27/36/37/38/39/40. The amendment mints NO new reach, NO
> new edge type, NO new node type, and opens NO Brain wire. The frozen Part 3 scalars are
> byte-identical: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate are UNCHANGED. Requirement id:
> SUPER-15. Implementing phase: 348 (the 348-03 guard); this Phase 348 Plan 09 is the canon
> ratification. Landed as ONE atomic lockstep wave so CI never went RED: the Part 9 narrowing
> paragraph + this Appendix D entry 41 + the header/footer Version 1.27 -> 1.28 + the
> CANON-PHASE-MAP v1.28 version-history row + the new canonical FLOOR test
> (`tests/test-canon-entry-41-supersession-narrowing-floor.cjs`, registered in
> `tests/run-all-340.sh` - slice-scoped presence-and-absence assertions inside Part 9, entry 41
> body isolation, prior entries 1-40 preserved, frozen scalars byte-present, version 1.28, never a
> raw count of Appendix D entries) + the parallel `CLAUDE.md` Part 9 Canon Compliance Core bullet
> carrying the identical narrowing in the SAME commit (closing 340-RESEARCH.md Pitfall 3) + six
> existing canon FLOOR tests' version anchors moved 1.27 -> 1.28
> (`tests/test-canon-entry-31-two-gauge-floor.cjs`,
> `tests/test-canon-entry-36-shape-declaration-floor.cjs`,
> `tests/test-canon-entry-38-sourced-claims-floor.cjs`,
> `tests/test-canon-entry-39-graph-substrate-floor.cjs`,
> `tests/test-canon-entry-40-corpus-figures-floor.cjs`, `tests/test-canon-part-9-ratification.cjs`,
> each with its prior-entry loop and frozen-scalar assertions unweakened) + the frozen-scalar
> FLOOR test (`tests/test-canon-frozen-scalars-floor.cjs`) kept GREEN, all moving together.
> Header/footer Version 1.27 -> 1.28. Canon version bumped to 1.28.

### The CLAUDE.md Part 9 bullet extension (for `CLAUDE.md`, Canon Compliance Core, Part 9 bullet)

The bullet currently ends "...only a human confirms a truth-claim node. Deep dive:
docs/MINDRIAN-CANON.md (Part 9)." Extend it with one clause, landing this sentence verbatim:

> ...only a human confirms a truth-claim node, and only a human closes one as superseded
> (Appendix D entry 41). Deep dive: docs/MINDRIAN-CANON.md (Part 9).

## What later plans in this phase land

This document is authored by `348-01-PLAN.md` alongside `.planning/REQUIREMENTS.md`
(SUPER-01..20) and the phase's test aggregator. The code this document describes lands in later
plans in the same phase: `lib/core/temporal/supersession-gate.cjs`, the `transitions.cjs` guard
extension and schema gate, the `insights.cjs` options bag and reified guard, the
`typed-claim.cjs` display-only marking, the `sensors.cjs` `include_superseded` parameter and
regenerated registries, the `skills/larry-personality/SKILL.md` doctrine subsection, the
`docs/MINDRIAN-CANON.md` Part 9 narrowing with Appendix D entry 41, and the remaining
`tests/test-348-*.cjs` files. `tests/run-all-348.sh` names every one of them as a guarded leg
from day one.
