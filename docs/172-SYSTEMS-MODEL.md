# Phase 172 Systems Model: The Invocation Surface as a Meadows System (INV-23 / D-172-n)

Status: Active
Phase: 172-contextual-invocation-coverage
Canon: Part 11 (The Invocation Constitution / CIRS), INV-23
Reference: Meadows 1999 (Leverage Points: Places to Intervene in a System); Meadows 2008 (Thinking in Systems); Simon 1962 (Architecture of Complexity)

---

## Why this document exists

Canon Part 11 R3 + INV-23 require Phase 172 to apply systems-thinking (Meadows) as a
first-class DESIGN LENS, not a decoration. The recurring regression (Phases 143.x, 144.1)
was not a coding mistake. It was a SYSTEMS failure: a balancing loop that was supposed to
hold the dark-surface stock at zero was wired as a WARN-only, CI-orphaned nudge, so the
loop had weak feedback and a long delay, and the dark stock grew unchecked.

This document models the invocation surface AS a system so the planner builds the
high-leverage intervention (the rule, the born-wired gate) rather than a low-leverage
symptom patch (flip a count, add another warning). It is the record INV-23 demands: the
gate is DESIGNED AS the balancing loop placed at the highest-leverage point.

It also confirms `/mos:systems-thinking` is itself wired under CIRS (R1 WIRED), so the
lens the phase applies is itself a governed, reachable capability and not a dark surface.
The fence for that confirmation is `tests/test-context-driven-trigger.cjs` (the
registry-wired assertion), and the connector lives at `commands/systems-thinking.md`
(`connects_to_spine: true`, `reach_id: context_block`, `sub_mode: systems-thinking-loop`).

---

## STOCKS (the accumulations the system holds at a point in time)

A stock is what has built up. The invocation surface holds these stocks:

- **Dark surfaces** -- commands / skills / agents that have a KNOWLEDGE wire but no
  TRIGGER wire. They exist but the engine cannot reach them. This is the stock the
  balancing loop must hold at (or drive toward) zero. Baseline 2026-06-22: 38 dark of
  101 commands; the connector ledger measured 62 gap of 124 surfaces (Plan 172-01).
- **Wired surfaces** -- surfaces with a conformant `connector:` block (R1 WIRED). The
  stock the system is trying to GROW.
- **Excluded surfaces** -- surfaces with `connector:{excluded:true, reason}` (R1 EXCLUDED,
  a first-class terminal state, never dark). 18 utility commands as of Plan 172-03.
- **Un-ranked counterparts** -- `mindrian-operation` projection nodes that lack a
  `reach_id` / `hierarchy_rank` / `posture`. A counterpart that exists but cannot be
  ranked is a half-built stock (the UN-RANKED check guards it).
- **Placeholder / absent chains** -- FEEDS_INTO edges with absent or uniform confidence.
  A chain that exists structurally but carries no earned confidence is a stock of
  un-useful sequence (R6 names absent/uniform confidence as the defect to remove).

The stocks are the legible substrate the coverage ledger emits
(`data/connector-coverage-ledger.json` + `data/orchestration-command-ledger.json`):
counts of wired / excluded / gap, byte-checked for staleness.

---

## FLOWS (the rates that change the stocks)

A flow moves a stock up or down. The invocation surface has these flows:

- **Surfaces born** -- a new command / skill / agent file enters under `commands/`,
  `skills/`, `agents/`. INFLOW to either the wired stock (if born-wired) or the dark
  stock (if born bare). R2 (born-wired) forces this inflow into the wired stock.
- **Surfaces modified** -- an existing surface changes its trigger / chain / exclusion.
  A flow BETWEEN stocks (wired <-> dark <-> excluded).
- **Surfaces removed** -- a surface retires. OUTFLOW, with a mandatory inbound-chain
  re-point-or-drop (R13) so removal never leaves a dangling FEEDS_INTO target.
- **Surfaces wired** -- a dark surface gains a TRIGGER wire. The DRAINING flow on the
  dark stock the phase exists to open (rs-* family first, Plan 172-04 onward).
- **Surfaces excluded** -- a dark surface is reclassified excluded-with-reason. The
  OTHER draining flow on the dark stock (utility commands, Plan 172-03).
- **Chains earned** -- a FEEDS_INTO edge gains curated confidence. The flow that
  converts placeholder chains into useful next-step chains (R6 / INV-08).

---

## FEEDBACK LOOPS (what makes the system self-correct, or not)

The CENTRAL feedback structure is a BALANCING loop. A balancing loop seeks a goal and
corrects deviation from it. Here the goal is: the dark-surface stock at zero.

- **The coverage gate IS the balancing loop holding the dark-surface stock at zero.**
  When a surface is born bare (dark stock rises), the gate detects the deviation from
  the zero-dark goal and FAILS the merge, forcing the surface to be wired or excluded
  before it can land. The dark stock is driven back to zero. That is the textbook
  balancing-loop signature: sense the gap, act to close it, hold the goal.

- **The prior regression was a BROKEN balancing loop.** Before Phase 172 the loop existed
  only as a WARN-only, CI-orphaned nudge (the 143.x / 144.1 RETRO-07 history). A warning
  that nothing enforces is WEAK feedback; an audit that runs long after merge is a LONG
  DELAY. Weak feedback plus long delay is the classic recipe for a stock that drifts away
  from its goal unchecked. The dark stock accumulated exactly as systems theory predicts a
  goal-seeking loop with a severed actuator will drift. Phase 172 repairs the actuator: it
  rewires the loop from WARN-only into a hard gate (warn -> report -> hard-FAIL once the
  baseline is wired/excluded, so CI never goes RED mid-sweep).

- A secondary REINFORCING loop runs in the good direction: each wired surface makes the
  next FEEDS_INTO chain reachable, which makes the suggester more useful, which motivates
  wiring the next surface. Reuse compounds the moat (Canon Part 7). The balancing loop
  keeps the dark stock at zero; the reinforcing loop grows the useful-chain stock.

---

## LEVERAGE POINTS (where a small shift changes system behavior the most)

Meadows ranks places to intervene. Low-leverage interventions tweak parameters; high-
leverage interventions change rules, goals, and the system's power to self-organize.

- **The born-wired hard gate (R2 / INV-14) is a HIGH-leverage intervention.** It is
  Meadows #5 (the RULES of the system: who can enter, and on what condition) and Meadows
  #4 (self-organization: CIRS gives the system the power to govern its own invocation
  surface). Changing the rule -- "no surface enters dark" -- restructures the inflow
  itself, so the dark stock cannot grow in the first place.

- **What 172 deliberately does NOT do is the low-leverage move.** Merely flipping a
  threshold or bumping a count (Meadows #12, the lowest-leverage numbers/parameters) is
  the symptom patch the prior phases effectively shipped (a WARN count nobody enforced).
  172 targets the RULE, not the symptom. The fix lives at the rule layer (the gate as
  law), which is why it sticks this time.

- The leverage analysis is itself the reason the gate is placed at MERGE and not at
  audit-time (see DELAYS): the highest-leverage place to put a balancing loop is where it
  shortens the feedback delay to near zero.

---

## DELAYS (the lag between deviation and correction)

Delay length determines whether a balancing loop stabilizes a stock or lets it oscillate
and drift.

- **The gate fires at MERGE (minimal delay).** The deviation (a bare surface) is sensed
  and corrected at the moment of entry, before the dark stock ever accumulates. A near-
  zero feedback delay is what lets the balancing loop actually hold the goal.

- **The prior regression had a LONG delay** -- detection happened at audit-time, long
  after the surfaces had merged and the dark stock had grown. A long delay in a goal-
  seeking loop is itself a defect; shortening the feedback delay is, in Meadows' ranking,
  its own leverage point (delays are #9 on her list). Moving the check from audit-time to
  merge-time is therefore both a delay fix AND a leverage-point intervention.

---

## HIERARCHY (near-decomposability across nested rooms)

Simon (1962): complex systems that persist are hierarchically organized into near-
decomposable subsystems.

- **The fractal coverage rollup (R11 / INV-16) is the system's near-decomposable
  hierarchy.** The balancing loop holds at EVERY nested level: each room governs its own
  invocation surface, and coverage / chain-health rolls up across the `NESTED_WITHIN`
  lineage via ONE scale-invariant operator, depth-bounded (depth-3 capped).

- The rollup is **aggregate-SCALAR-only across room boundaries** (Simon near-
  decomposability + Canon Appendix D entry 23): a parent reads a child's coverage SCALARS,
  never the child's lineage edges across the room.db boundary. The subsystems are weakly
  coupled (scalars cross the boundary) and strongly cohesive (each room's full edge graph
  stays local). That is exactly the weak-interaction-between-subsystems property Simon
  proved persistent systems must have, applied to the invocation surface.

---

## The design conclusion (what the planner must build)

Phase 172 DESIGNS the coverage gate AS the balancing loop, placed at the highest-leverage
point (the rule layer, at merge-time, with near-zero delay), holding the dark-surface
stock at zero, and rolling that same loop up the near-decomposable room hierarchy via one
scale-invariant operator. The intervention targets the RULE (Meadows #5) and the system's
power to govern its own surface (Meadows #4), not a parameter (Meadows #12). This is the
leverage-point intervention INV-23 mandates, recorded here so the build is the cure and
not another symptom patch.

`/mos:systems-thinking` -- the lens this document applies -- is itself a WIRED, governed,
reachable capability under CIRS (R1), confirmed by the registry-wired assertion in
`tests/test-context-driven-trigger.cjs`. The system that models its own invocation surface
is part of that surface, and it is not dark.

---

## v2 addendum (2026-08-19): two more instances of the same broken-loop signature

The 2026-08-18/19 brain-plugin sync work surfaced two systems that had EXACTLY the
143.x/144.1 disease this document diagnosed -- a stock meant to be held at a goal, with
weak feedback and a long delay -- and applied the same cure. Recorded here because the
model generalizes: the invocation surface was the first patient, not the only one.

### Instance 2: the graph mirror (reflected-surface stock)

- STOCK: plugin surfaces WITHOUT a reflective counterpart in the Brain graph. Baseline
  measured 2026-08-18: 112 MindrianCommand nodes existed but carried ZERO framework
  edges, and agents / skills / sensors / MCP tools / workflows (201 surfaces) had no
  nodes at all. The mirror stock had drifted for months with NO sensor -- not even a
  WARN-only one. Weaker than the 143.x case: the loop did not exist.
- THE BALANCING LOOP BUILT: `scripts/mindrian-surface-sync.mjs` (ProblemsWorthSolving-
  Brain repo) inventories every plugin surface per version (314 at 2.0.0-beta.1),
  content-hashes each, diffs against the prior version's manifest, and emits compile-only
  payloads (create / update / Archive-never-delete). The release checklist runs it per
  version -- the sensor fires at RELEASE time (short delay), and the payload is the
  actuator. Meadows #5 again: the rule is "no release without a mirror diff", not a
  parameter tweak.
- The hand-curated seed (payloads/framework-command-map-2026-08-18: 77 command->framework
  mappings, 48 FEEDS_INTO chains with earned confidence, 52 problem-type wirings) is the
  initial stock-fill; the sync mechanism is the loop that keeps it from drifting again.

### Instance 3: store identity (the canon-drift stock)

- STOCK: consumer wires pointed at NON-CANON graph stores. Found 2026-08-18/19: the
  claude.ai/Cowork connector, two local config files, and a device-bridge wire all read
  the retired Aura-era replica (frozen ~July, 730 nodes behind canon). Three separate
  sessions produced false data-integrity verdicts from it in ONE day. The drift sensor
  did not exist; detection was a human eyeballing a 23,014-edge signature. Luck is not a
  balancing loop.
- THE LOOP TO BUILD (handed off, docs/2026-08-19-HANDOFF-brain-plugin-sync-release.md
  section 7): a GraphRagMeta version-stamp node bumped inside every admin window (the
  sensed variable), stale-store detection on connect that banners mismatches and refuses
  to silently mix (the actuator, at CONNECT time -- near-zero delay), /mos:doctor
  reporting per-wire store identity (the audit surface), and suspension of the stale
  service so a wrong wire fails LOUDLY instead of answering plausibly (removing the
  decoy stock entirely -- the highest-leverage move on the list).

### The generalized rule this document now carries

Any stock the system claims to hold at a goal MUST name (a) its sensor, (b) its
actuator, (c) the delay between deviation and correction, and (d) what happens when the
sensor is absent. A goal with no loop is a wish. Phase 172 proved it for invocation
coverage; the graph mirror and store identity are the second and third proofs. The next
planner who finds a "should always be true" without a gate holding it true has found
patient four.
