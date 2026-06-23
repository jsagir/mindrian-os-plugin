---
kind: canon-proposal
proposed_part: 11
title: The Invocation Constitution (the Command Invocation Ruling System)
status: proposed-pending-ratification
created: 2026-06-22
author: navigator (Jonathan Sagir) + Claude-as-Larry, /gsd-discuss-phase 172 session
implementing_phase: 172 contextual-invocation-coverage (CIRS)
canon_version_at_proposal: 1.13
ratification: navigator-LOCKED blocking checkpoint BEFORE /gsd-plan-phase 172 (precondition)
grounding: .planning/phases/172-contextual-invocation-coverage/research/EXTERNAL-RESEARCH.md
  + recon-internal-synthesis.md + recon-remote-projection.md + recon-connector-spine.md
---

# PROPOSED CANON PART 11 — The Invocation Constitution

> Proposal for navigator ratification. Mirrors the Part 9 (.planning) and Part 10
> (docs/CANON-PART-10-PROPOSAL) precedents: a self-contained constitutional text reviewed
> adversarially, then ratified at a navigator-LOCKED checkpoint via the Part 6 dog-fooding
> canon-amendment-on-itself mechanism.

## Why a new Part (the scattered-doctrine problem)

CLAUDE.md states the moat plainly: *prompts can be copied; the graph that knows WHEN to use WHICH
prompt, in WHAT sequence is the moat.* WHEN / WHICH / SEQUENCE is **invocation**. Yet invocation has
no constitutional home. Its doctrine is scattered:

- Part 2 — the reaches/affordances arm the team; the 6 reaches.
- Part 3 — the Decision Gate, the 10 verbs, Shape F, option-generation tier-awareness, the 3-layer loop.
- Part 8 — the Brain dual-role, `methodology_tier`, the orchestration projection.
- Appendix D entries 15 (6th reach) + 19 (projection + tier).
- …and the connector spine, the dial, dispatchSensors, the navigation engine — all CODE, no canon.

No single Part owns "how every capability becomes invocable." The result is empirical: contextual
invocation has been wired and has REGRESSED multiple times (Phases 143.x, 144.1 RETRO-07) because the
governing contract lived nowhere — only in an orphaned, WARN-only gate. A moat-level doctrine governed
by a footnote is the failure mode this Part closes. The Graph Boundary (Part 8) and Memory Locality
(Part 9) are full Parts; the Invocation Constitution is the same altitude.

## North Star

> Every capability MindrianOS can invoke is GOVERNED: it knows when it should be reached for, it is
> reachable by exactly one path, it explains itself, it chains usefully, it stays local, it is
> represented in the orchestration graph, and it cannot enter, change, or leave the system without
> the constitution knowing. A capability the engine cannot reach — or can reach two different ways —
> is a hole in the moat.

## The doctrine

**The two wires.** A capability has a KNOWLEDGE wire (what it teaches — a `:Framework` node, Part 8)
and a TRIGGER wire (a connector mapping a navigator CONTEXT to the capability). The system reaches only
for capabilities that have the TRIGGER wire. Knowledge without trigger is a dark capability.

**The dual graph (control plane / data plane).** The remote orchestration projection is the CONTROL
plane: generic machinery topology — capabilities, reaches, routing, chains, policy — every node tagged
`methodology_tier` (`pws` | `mindrian-operation`, Part 8). The local room.db is the DATA plane: the
navigator's actual work. The invariant is one-directional: **control/policy flows down; user data NEVER
flows up** (Part 8 boundary, expressed as the T-Box/A-Box federation discipline). The local capability
view is a DERIVED, non-authoritative CQRS read-model of the control plane, version-stamped and
rebuilt-not-mutated; it is consumed LOCAL-ONLY at decide/rank time (no live Brain call on the hot path).

**One governed path.** Every invocation resolves through one spine (dispatchSensors → decide() →
resolver). No capability runs a second, ungoverned selection brain. (This is the lesson of /mos:act.)

**Born-wired lifecycle.** A capability cannot ENTER (be born), CHANGE, or LEAVE the system without the
constitution: a new or modified surface is wired or explicitly excluded, or it is rejected. Coverage is
not a number checked once — it is a lifecycle invariant enforced at every merge.

**Fractal coverage.** Coverage and chain health roll up across the nested-room hierarchy
(`NESTED_WITHIN`, Part 4) via ONE scale-invariant operator, depth-bounded, aggregate-only across room
boundaries (Simon near-decomposability) — so the constitution holds at every level of the fractal, not
only the root room.

## The Command Invocation Ruling System (CIRS) — the closed ruling set

A closed constitution, the invocation-layer counterpart of Part 3's closed verb vocabulary and Part 4's
closed edge vocabulary. Every invocable surface (command, skill, agent) MUST satisfy R1–R12; the gate
enforces them; a change to the closed set is a canon amendment, not a per-phase edit.

- **R1** Two states, no third — WIRED (`connector:` block) or EXCLUDED (`connector:{excluded,reason}`).
- **R2** Born-wired — a new/modified surface fails the gate CLOSED unless it satisfies R1.
- **R3** Context-triggered — trigger keys on navigator problem-state (LOCAL via navigation.cjs); keyword is fallback.
- **R4** One governed path — invocation resolves through dispatchSensors → decide() → resolver; no second selection brain.
- **R5** Remote counterpart — every surface has an orchestration-projection node carrying `methodology_tier`; non-framework commands get a `mindrian-operation` counterpart.
- **R6** Earned chains — FEEDS_INTO carries curated confidence (v1), surfaced via the LOCAL projection; absent/uniform confidence is illegal; learned weights are a gated future.
- **R7** Local-only at decide/rank — the projection is a CQRS read-model (control plane) with source-version + per-room checkpoint + freshness markers; user data never flows up (Part 8).
- **R8** Promotion path — dark → `mindrian-operation` counterpart → `pws` frontier framework, navigator-gated.
- **R9** Enforced, not aspirational — the gate is wired into pre-commit + release + doctor + the ingest pipeline; warn→report, then hard-FAIL once the baseline is wired/excluded.
- **R10** Lockstep on change — any add/modify/update/remove re-runs the gate and keeps the projection in lockstep (drift-detection over the machinery).
- **R11** Fractal coverage — coverage + chain monitoring rolls up across nested rooms via one scale-invariant operator over `NESTED_WITHIN`, depth-bounded, aggregate-only across boundaries.
- **R12** Forward-declaration & explainability — every future phase that adds/modifies/removes an invocable surface, OR consumes the spine, MUST declare and explain how it USES and/or is USED BY CIRS (a `cirs_relationship:` block + prose). A phase that touches a surface without a conformant declaration is gate-FAILED. Recorded via a CIRS column in docs/CANON-PHASE-MAP.md.

## Relationship to the existing Parts (what this PULLS TOGETHER, what it does NOT change)

- **Part 2 (Team / reaches).** The reaches remain the team's affordances. Part 11 governs how a reach
  is wired to a capability; it does NOT change the 6 reaches or the 3 postures (frozen).
- **Part 3 (Decision Gate).** The reaches still render through the Shape F selector + the 3-layer loop +
  tier-awareness. Part 11 does NOT change Shape F, MAX_K=3, DIAL_REACH_K=6, or the 0.70/0.15 gate. It
  adds the rule that the OPTIONS the gate offers come from a governed, fully-covered capability set.
- **Part 4 (Every Choice Is Graph Data).** Chains/counterparts reuse the existing edge vocabularies
  (the projection's OPERATES/CHAINS/FEEDS_INTO/PREREQUISITE/CROSS_DOMAIN_ANALOGUE). Part 11 mints NO new
  edge type by itself; a future need for one is a separate Part 4 amendment.
- **Part 7 (Reuse Before Build).** Part 11 is the structural expression of Part 7 at the invocation
  layer: capabilities are repointed and wired, not rebuilt; the moat is made self-extending.
- **Part 8 (Graph Boundary).** Part 11 is BOUNDED BY Part 8 and adds no new wire. The control plane is
  the Part-157 orchestration projection it already sanctioned; `methodology_tier` remains the
  boundary-keeper; LOCAL→BRAIN: NO is unchanged and restated.
- **Part 9 (Memory Locality).** Invocation reads/writes the local graph via the navigation.cjs
  chokepoint; calibration intent is journaled as memory_event; the proposed→confirmed gate is honored.
  Part 11 mints NO new node type by itself.
- **Part 10 (Conversation as Product).** Invocation is the machinery that serves the conversation;
  commands stay internals; /mos:act becomes a governed, self-explaining, intent-calibrated conversation
  surface. Part 11 is HOW Part 10's "commands are internals" is made true and safe.

## Implementing phase

Phase 172 (contextual-invocation-coverage) is the implementing phase — it ships CIRS R1–R12 as code:
the born-wired gate (wired into pre-commit/release/doctor/ingest), the exclude ledger, the dark-surface
wiring (rs-* first), the `mindrian-operation` counterparts, the curated chains, the /mos:act
reconciliation (governed + suggested + F.1-rendered + intent-calibrated), the fractal rollup, and the
R12 forward-declaration contract. Per Part 6 (Product-as-Venture), the canon names the phase that
implements the canon. 170 + 171 are the first conformance targets (gated before release).

## Ratification provenance

Proposed 2026-06-22 in the /gsd-discuss-phase 172 session, after a 14-stream research fan-out confirmed
(a) the scattered-doctrine problem, (b) that 172 is gate-tightening over shipped substrate (the
projection + spine already exist), and (c) external validation for every pillar (control/data plane,
CQRS projection, T-Box/A-Box federation, scale-invariant fractal rollup, state-conditioned routing,
earned chains, drift-detection gate — see EXTERNAL-RESEARCH.md). Navigator chose: NEW Part 11 (not an
appendix entry), run as a precondition to 172 planning. To be ratified at a navigator-LOCKED blocking
checkpoint via the Part 6 dog-fooding canon-amendment-on-itself mechanism (mirroring Parts 9 and 10),
with a new Appendix D entry + a canon version bump (1.13 → 1.14) + the CANON-PHASE-MAP Part 11 section.

## Open questions for the adversarial review
1. Is Part 11 the right altitude, or does CIRS belong folded into Part 8 (boundary) / Part 3 (gate)?
2. Does any R1–R12 rule CONTRADICT a frozen contract in Parts 2/3/4/8/9 (reaches, Shape F scalars,
   edge/node vocabularies, the boundary)?
3. Does Part 11 overreach — claim governance over surfaces that should stay manual utilities?
4. Is the control/data-plane framing redundant with Part 8's existing dual-role, or does it add clarity?
5. Does R12 (forward-declaration) duplicate the existing canon_parts forward-compatibility rule, or
   complement it?
