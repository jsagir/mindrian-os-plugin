# Phase 348 Close-Out: The Supersession Node

Status: CLOSED, 2026-09-16
Phase: 348 (the supersession node, graph-engineering learning 6, fact invalidation over time)
Ledger: `docs/SUPERSESSION-CONTRACT.md` (cited throughout, not restated)
Validation map: `.planning/phases/348-the-supersession-node-graph-engineering-learning-6-fact-inva/348-VALIDATION.md`

This document is the tracked record of what Phase 348 shipped, what it measured, what it
deliberately did not take, and who owns the follow-on. `.planning/` is gitignored in this
repository (`.gitignore:97`), so a reader on another machine cannot open `348-RESEARCH.md`,
`348-CONTEXT.md`, `348-LANGTALKS-CONSULT.md`, or any PLAN/SUMMARY/VALIDATION file this phase
produced. Everything load-bearing lives here, in `docs/SUPERSESSION-CONTRACT.md`, or in the code
itself.

---

## One: What shipped

| Artifact | What it does | SUPER id closed |
|---|---|---|
| `lib/core/navigation/transitions.cjs` (`setsSuperseded` predicate) | Widens the fleet-wide human-attribution guard so an agent-attributed close of a truth-claim node into `superseded` is refused with `agent_attribution_forbidden`, closing a live pre-existing hole | SUPER-02, SUPER-03 |
| `lib/core/navigation/transitions.cjs` (bitemporal-close schema gate) | A `PRAGMA table_info(nodes)` probe fails closed with `bitemporal_close_unsupported_schema` on a legacy schema, never degrading to a plain status UPDATE | SUPER-13 |
| `lib/core/navigation/insights.cjs` (`findContradictions` reshape) | Third `opts` bag, `includeSuperseded` default false, null-safe `review_status` filter, legacy-schema fall-through, D-04 reified-shape guard with an optional skip sink | SUPER-04, SUPER-08 |
| `lib/core/navigation.cjs`, `lib/core/navigation/packet.cjs`, `lib/core/navigation/room-home.cjs`, `lib/agents/reverse-salient-agent.cjs` | Five-caller declaration: four take the safer DEFAULT (superseded excluded), one line each | SUPER-05 |
| `lib/mcp/tools/sensors.cjs` (`contradiction_check`) | `include_superseded` optional boolean, mapped to `includeSuperseded`, declared `hitl_shape`/`layer` byte-unchanged | SUPER-06, SUPER-07 |
| `lib/core/navigation/typed-claim.cjs` (comment only) | Marks `properties.valid_from`/`valid_until` display-only at the write site; the integer columns are named authoritative | SUPER-10 |
| `lib/core/temporal/supersession-gate.cjs` (new) | `supersedeOnGateAnswer(db, params)`: the pure wire between a human-approved gate verdict and the shipped `supersede()`, with a closed 9-member refusal-reason set | SUPER-01, SUPER-03, SUPER-07, SUPER-09, SUPER-11, SUPER-17, SUPER-19 |
| `skills/larry-personality/SKILL.md` (`### Superseded is not deleted`) | The doctrine subsection under `## Honesty about memory`: closed-not-deleted, the include-superseded read, the honest never-fired-live state | SUPER-14, SUPER-16 |
| `docs/MINDRIAN-CANON.md` Version 1.28, Appendix D entry 41 | Narrows Part 9's Truth states subsection: only a human-attributed gate answer may promote a truth-claim node to `superseded` | SUPER-15 |
| `docs/CANON-PHASE-MAP.md`, `CLAUDE.md` | Lockstep v1.28 reference row and the parallel Part 9 bullet extension, same commit as the canon amendment | SUPER-15 |
| `docs/SUPERSESSION-CONTRACT.md` | The durable ledger: four rulings, nine navigator locks, twelve working decisions, the ratified Section 09 wording, the measured census | SUPER-20 |
| `.planning/ROADMAP.md` (`### Phase 350:` card) | The real, numbered, scoped sibling card for the deferred live-CONTRADICTS-writer work | SUPER-18 |
| `docs/OPEN-HANDOFFS.md` (dated row) | The langtalks Gemini-403 blocker's precise diagnosis and named owner | SUPER-16 |
| Fourteen `tests/test-348-*.cjs` files, `tests/helpers/fixture-room-348.cjs`, `tests/run-all-348.sh` | The phase's own proof surface: 26 legs, PASS=26 FAIL=0 SKIP=0 EXPECTED-RED=0 | all twenty |
| `tests/test-canon-entry-41-supersession-narrowing-floor.cjs`, registered in `tests/run-all-340.sh` | The canon amendment's own FLOOR test, 71 assertions | SUPER-15 |

Every row names a real path that exists on disk as of this close.

---

## Two: What was measured

The full sweep, this session (2026-09-16), every command run before a single `Measured:` clause
was written:

- `bash tests/run-all-348.sh`: `PASS=26 FAIL=0 SKIP=0 EXPECTED-RED=0`.
- `node tests/test-348-supersession-e2e.cjs`: exit 0, 12 assertions -- the ten steps (confirmed
  A/B, the `CONTRADICTS` edge, the surfaced pair, the human-attributed gate approve, the
  non-lossy close, the default-excludes-B read, the `includeSuperseded` re-inclusion, the edge
  count unchanged-or-plus-one, the as-of-before-still-live read, the non-approved-verdict
  refusal) plus the three negative legs (non-approved verdict, direct agent-attributed
  `supersede()`, a proposed old node).
- `bash tests/run-all-340.sh`: `PASS=9 FAIL=0 SKIP=0` (the canon aggregator, now carrying the
  entry-41 floor leg).
- `node scripts/doctor.cjs --acceptance`: `20/20 points passed`.
- `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`,
  `node scripts/check-render-coverage.cjs`: all `OK`.
- `node scripts/check-layer-declaration.cjs`: `OK: 285 surfaces enumerated, 248 declared, 37
  exempt`. `node scripts/check-shape-declaration.cjs --check`: exits 0, 54 advisory WARN entries,
  unchanged from the 348-08/09 baseline, none touching a file this phase wrote.
- `node scripts/check-substrate.cjs`: exit 0 (informational baseline; 205 pre-existing violations
  across `lib/`/`scripts/`, none introduced by this phase -- Plan 03 of a future phase wires this
  into the pre-commit hook, per the script's own closing note).
- `node scripts/run-harness.cjs --check`: `9 pass, 0 fail, 4 ghost, 2 declared, 15 total`.
- `node lib/core/temporal/supersession.test.cjs`, `node lib/core/temporal/point-in-time.test.cjs`,
  `node tests/test-223-supersedes-chain.cjs`, `node tests/test-198-chokepoint-guard.test.cjs`:
  all exit 0 (4/4, 4/4, 21/21, 18 assertions respectively) -- the four shipped suites over the
  mechanism this phase hardened, unregressed.
- **The fleet census, re-walked read-only across every `room.db` under `~/MindrianRooms`,
  2026-09-16:** 60 rooms found (up from 47 at this same phase's own start-of-day census, taken
  roughly four hours earlier the same day -- the fleet grew during the day, ordinary room
  creation, not a measurement error). `CONTRADICTS 0, SUPERSEDES 0, superseded_nodes 0,
  invalidated_at_set 0, valid_to_set 0`.

**The headline, stated in plain words and never softened: these are two different claims, and a
reader must be able to tell them apart.** The mechanism is now gated, reconciled, reshaped and
provable end to end on a fixture. The fleet census is EXACTLY where it was before this phase
started: `CONTRADICTS 0 -> 0`, `SUPERSEDES 0 -> 0`, `superseded nodes 0 -> 0`, across a room
count that moved from 47 to 60 for unrelated reasons. The reason in one sentence: nothing writes
the input edge. `lib/core/intel-pipeline.cjs:144`'s `void wirer;` is untouched by design (D-01),
and Phase 350 is the card that changes that number, not this one.

---

## Three: The four rulings, in one table

| Ruling | Verdict | Where recorded | What it forecloses |
|---|---|---|---|
| Contradiction shape (D-03/D-04) | Direct claim-to-claim is in scope; the reified `ContradictionEvent --CONTRADICTS--> rivalClaim` shape is out of scope, skipped with `reified_shape_out_of_scope` | `docs/SUPERSESSION-CONTRACT.md`, Ruling 1 | A future `findContradictions` change silently projecting an event node as a claim identity |
| Validity window (D-06) | The integer columns (`nodes.valid_from`/`valid_to`) are authoritative; the string props are display-only | `docs/SUPERSESSION-CONTRACT.md`, Ruling 2 | A third validity-window representation, or a silent parse-at-write-time behavior change |
| TRANSITIONS frozen (D-05) | `TRANSITIONS` stays byte-unchanged; `proposed` rivals route through `proposed->rejected` | `docs/SUPERSESSION-CONTRACT.md`, Ruling 3 | A `proposed->superseded` transition being minted later without re-litigating why it wasn't needed |
| `review_status` is primary truth (D-07/SUPER-20) | Phase 347's WD-347-2 projection-vs-primary-truth analogy does NOT transfer; `review_status` has no competing store | `docs/SUPERSESSION-CONTRACT.md`, Ruling 4 | A future phase reusing WD-347-2 as precedent for `review_status` without re-deriving why it doesn't apply |

Full reasoning for each lives in `docs/SUPERSESSION-CONTRACT.md`; it is not duplicated here.

---

## Four: The pre-existing hole this phase closed

Stated plainly with its file and line: before this phase, `transitions.cjs:174-186` gated
human-attribution only for the `confirmed`/`validated` targets, and its own comment at
`:179-181` said superseded is never gated; `supersession.cjs:90` defaults `byUser` to
`'system'`. The combination meant any agent, hook, or background job holding a `db` handle could
call `supersede()` and close a human-confirmed truth claim with zero human involvement. This is
a pre-existing hole this phase fixes, dated 2026-09-16, not new scope this phase introduces. It
is now refused with `agent_attribution_forbidden`, pinned by iterating `AGENT_IDENTITIES` (4
members) x `TRUTH_CLAIM_TYPES` (6 members) from their own exported sets so a later addition to
either is covered automatically.

---

## Five: What this phase deliberately did not do

- **No live `CONTRADICTS` writer.** `lib/core/intel-pipeline.cjs:144`'s `void wirer;` is
  untouched (D-01). Owner: Phase 350.
- **No reified-shape support.** The `ContradictionEvent` shape is refused with a named reason,
  not implemented (D-03). Owner: Phase 350's own card carries the question forward.
- **No new invocable surface for the gate consequence.** The wire ships as a pure `lib/core/`
  function (WD-348-3), no MCP tool, command, agent or pipeline. Owner: Phase 350, which
  registers it together with the writer that feeds it.
- **No parse of the validity-window strings into the columns.** They are display-only (D-06,
  WD-348-2). Owner: a future phase with a real consumer for a meeting-stated expiry.
- **No `TRANSITIONS` change.** Proposed rivals route to `proposed->rejected` (D-05).
- **No attempt to close the Phase 347 edge-chokepoint bypass.** Only a defensive
  endpoint-existence check on the gate path (D-08). Owner: still Phase 347's own open OQ-5.
- **No fix for the langtalks Gemini 403.** Only the tracking row (D-09). Owner: named in the
  `docs/OPEN-HANDOFFS.md` row, three sessions old as of this close.
- **The `close-loop-writer.cjs:478` human-attribution thread is a named, deferred item**
  (WD-348-6), not fixed here: that call site is the ONLY live caller of `supersede()` and
  supplies no `byUser`, so it defaults to `'system'`. It has produced 0 `SUPERSEDES` edges in 47
  (now 60) rooms; today it already fails with `invalid_transition` (its conclusion nodes are
  `claim`-typed at `proposed`), and after this phase it would additionally fail with
  `agent_attribution_forbidden` if a BONO conclusion were ever human-confirmed first. Either way
  it has never succeeded. Threading a `resolveByUser`-resolved human `byUser` into that call site
  is the fix, deliberately left outside this phase's `files_modified`.

---

## Six: The Tri-Polar statement

One row per `CAPABILITY_MAP` key, read live rather than hand-typed, reproduced from
`docs/SUPERSESSION-CONTRACT.md`:

| Surface | Mechanism reachable | Read flag reachable | Gate consequence surface |
|---|---|---|---|
| `cli` | yes (pure `lib/core/` function, caller-owned handle) | yes, via `contradiction_check` | not-applicable, no invocable surface ships this phase (WD-348-3) |
| `desktop` | yes (pure `lib/core/` function, caller-owned handle) | yes, via `contradiction_check` | not-applicable, no invocable surface ships this phase (WD-348-3) |
| `cowork` | yes (pure `lib/core/` function, caller-owned handle) | yes, via `contradiction_check` | not-applicable, no invocable surface ships this phase (WD-348-3) |

The mechanism is a pure `lib/core/` function reachable identically on Claude Code, Claude
Desktop and Cowork through the caller-owned handle contract. The `include_superseded` read
reaches the model through `contradiction_check` on all three surfaces, since an MCP tool is
wired identically everywhere. The gate consequence has no invocable surface on any of the three
surfaces in this phase, per WD-348-3 -- a stated call, not an oversight: D-01/D-02 leave the
trigger to Phase 350, and a registered surface with no trigger would be a CIRS-visible ghost
Canon Part 11 R16 would then have to declare a `hitl_shape` for a fork nothing can reach.

---

## Seven: Grounding and its honest gaps

Five `get_entity` corpus probes this phase's own consult session ran (Zep, Graphiti,
bi-temporal, Temporal Knowledge Graph, fact invalidation) all returned `found: false`; the
2026-09-14 comparison note never landed in the langtalks corpus. What the corpus DOES carry, and
what this phase cites instead: `Approval gate <--part_of [EXTRACTED]-- Human` for the
human-gated-consequence requirement, and arXiv 2603.14828 ("retrieval drift", one citation) for
why an uncorrected stale claim is a correctness bug, not untidiness. `Contradiction` itself is
corpus whitespace -- zero episodes, zero citations -- so every claim this phase's doctrine makes
about ACTING on a contradiction is this repo's own design, named as such rather than attributed
to a source that does not carry it. The filed research trail
(`~/MindrianRooms/rethinking-mindrianos/research/2026-09-14-mindrianos-classification-and-zep-graphiti-supersession-gap.md`)
is the grounding of record for the Zep/Graphiti comparison, extended by this close-out with a
2026-09-16 update section (see Nine below on the filing outcome), cited by both doctrine
surfaces this phase ships. Named assumption A1 (Zep/Graphiti's bi-temporal design as the closest
external prior art for this mechanism's shape) is MEDIUM confidence: no design decision in this
phase depends on it holding -- the mechanism itself (`supersede()`) predates this phase by two
releases (Phase 160-04/223-02) and was hardened, not designed, here.

---

## Eight: Open working decisions

`docs/SUPERSESSION-CONTRACT.md` carries the full twelve-row WD-348 ledger; it is not duplicated
here. Status as of this close: WD-348-10 was RULED at the 348-08 blocking checkpoint (the
navigator answered "Approved as specified" on the canon-narrowing content spec) and landed by
348-09. The remaining eleven rows (WD-348-1 through WD-348-9, WD-348-11, WD-348-12) all stay
WORKING -- shipped exactly as Claude's own working call, never challenged by a navigator
checkpoint, each with its own named reverse path if a future navigator wants to reopen it. Zero
rows are silently dropped; zero rows are upgraded to RULED without an actual navigator answer on
record.

---

## Nine: The rethinking-mindrianos filing outcome

The write to
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-14-mindrianos-classification-and-zep-graphiti-supersession-gap.md`
(extending it with the Phase 348 outcome, per CLAUDE.md's Dev-Research Compositing rule) was
attempted this session and correctly REFUSED by Claude Code's own `write-scope-check` PreToolUse
hook: "Blocked: write to rethinking-mindrianos denied. Active room is idem-room." This is the
identical refusal Phase 344's, Phase 345's and Phase 347's own close-outs all recorded for the
same situation -- a fourth occurrence of the same class -- and it is respected here rather than
routed around: no active-room switch was attempted, and no session state was force-changed. The
plugin-side fallback mirror landed instead at
`~/MindrianOS/research/2026-09-16-phase-348-supersession-node.md`, carrying the full drafted
update section and naming the refusal inline. A session with `rethinking-mindrianos` set active
(`/mos:rooms switch rethinking-mindrianos`) needs to append that drafted content into the room's
own research entry.

---

## Ten: What the next phase inherits

Phase 350 (registered in `.planning/ROADMAP.md` immediately after Phase 349, per WD-348-9) gets
a gated, tested mechanism with a fixed gate-module contract
(`lib/core/temporal/supersession-gate.cjs::supersedeOnGateAnswer`) and nine named refusal
reasons, so wiring a live `CONTRADICTS` writer is a wiring job rather than a design job. It also
inherits: the reified-shape question (D-03/D-04) this phase scoped out and named as Phase 350's
own to rule; the surface-registration question (WD-348-3) -- the gate consequence needs to be
born WIRED with its own declared `hitl_shape`/`layer` per Canon Part 11 R16, riding the existing
`gate-render`/`gate.cjs`/`gate-ledger` ladder rather than minting a second gate; the deferred
`close-loop-writer.cjs:478` human-attribution thread (WD-348-6); and the still-open Phase 347
edge-chokepoint bypass (OQ-5/D-08) as a live risk to any future live-writer wiring, since a
bypassed edge write is invisible to `findContradictions`. Any future phase touching truth states
inherits a Canon Part 9 that no longer permits silent system-rule supersession of a truth-claim
node -- the narrowing landed in Appendix D entry 41, version 1.28, is now the floor every later
phase builds on, not a decision to re-litigate.

---
*Phase: 348-the-supersession-node-graph-engineering-learning-6-fact-inva*
*Closed: 2026-09-16*
