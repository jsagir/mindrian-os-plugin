---
kind: context
phase: 178
slug: universal-gate-chokepoint
milestone: v1.14.0
created: 2026-06-24
canon_parts: [3, 6, 7, 11]
proposes_canon_amendment: true
cirs_relationship:
  surfaces_added:
    - check-render-coverage
  surfaces_modified:
    - selector-dispatcher
    - dial-presenter
    - intent-classifier
    - dial-selector
    - offer-closer
    - room-naming-selector
    - research-filing-selector
    - breakthrough-scanner
    - suggest-next-command
    - auto-explore-agent
    - render-v2
    - room-auto-create-nudge
    - navigation-engine-offer
    - act-command
    - reverse-salient-agent
    - tension-hook-agent
    - operator-command
  surfaces_removed: []
  spine_consumed:
    - lib/hmi/selector-dispatcher.cjs
    - lib/hmi/dial-presenter.cjs
    - lib/hmi/shape-f1-renderer.cjs
    - lib/hmi/dial-selector.cjs
    - lib/hmi/dial-reach-orchestrator.cjs
    - scripts/intent-classifier.cjs
    - scripts/build-orchestration-projection.cjs
    - scripts/build-connector-registry.cjs
  gate_impact: "Builds the rendering-layer twin of CIRS Part 11 R2/R9: a BORN-WIRED, FAIL-CLOSED render-coverage gate. CIRS made INVOCATION born-wired (a new surface fails CI closed unless it declares its trigger wiring). No twin exists for RENDER: nothing fails the build when a reachable Decision-Gate surface lacks atomic interactive-card emission. This phase adds a registry-driven --check (sibling of build-orchestration-projection.cjs) that walks an exhaustive enumeration of render surfaces and FAILS CLOSED (nonzero exit, hard-FAIL not WARN) if any surface that can reach a gate lacks a card-emission routing declaration. The atomic gate-emitter chokepoint (the universal pickShape/dial path) is the MECHANISM the gate verifies, not the deliverable. No reach/posture/edge/node minted; MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs frozen; no Brain wire."
  explanation: "The F.7 gate-render has slipped across five phases (143.1, 144.1, 148, 150.5, 177) because the final load-bearing step - the model firing the AskUserQuestion card - is AGENT-HONORED, not machine-enforced (verified: AskUserQuestion is NEVER invoked as a tool call anywhere in lib/ or scripts/; it exists only as marker strings; the sole enforcement is one prose line in skills/larry-personality/SKILL.md:129). Every prior fix patched one path/surface, enforced by per-path tests + SKILL fences - the WARN tier CIRS R9 had to flip to hard-FAIL for invocation. A new surface always escapes (177 minted dial-selector.cjs F.7-dial with NO marker). The cure is the same born-wired mechanism CIRS already proved for invocation, applied to render: fail the build closed when a reachable gate surface is not wired to emit a card. Part 6 dog-fooding: the silent-degrade is a self-CONTRADICTS of Part 3, which this gate resolves structurally."
status: context-captured
severity: NORMAL
sequence: "Follows Phase 177 (larry-behavioral-channel, CODE-COMPLETE 2026-06-24). Re-scoped 2026-06-24 from 'universal chokepoint + contract test' to 'born-wired render-coverage gate' after a 5-agent investigation (code-history + prior-research + Tavily + adversarial verify, high confidence) named the contract-test framing as the exact trap that produced the five-phase slip."
---

# Phase 178 Context: The Born-Wired Render-Coverage Gate

> RE-SCOPED 2026-06-24. The original framing (universal chokepoint + a cross-surface
> contract test) was investigated and found to be the TRAP, not the cure: another
> hand-written test inherits the identical per-path coverage hole (150.5 engine-arm,
> 177 behavioral-channel) it exists to kill. The spine is now the GATE; the chokepoint
> is the mechanism the gate verifies.

<domain>
Canon Part 11 (CIRS) made INVOCATION born-wired: a new or modified surface fails CI CLOSED
(R2) unless it declares its trigger wiring, and R9 flipped that from WARN to hard-FAIL.
That cured the invocation slip - the exact 143.x / 144.1 regressions that motivated CIRS.

There is no twin Part for RENDER. The CIRS gate governs the TRIGGER wire (does a surface
get REACHED) and treats render (does a reached gate FIRE its interactive card) as out of
scope - proven by build-orchestration-projection.cjs:113-138, which explicitly classifies
render-only surfaces (/mos:dashboard, /mos:splash) as "not a reach-dispatched thinking
surface" and EXCLUDES them. So rendering still lives in the orphaned-WARN-only-gate state
that Part 11 was created to kill: per-path tests plus prose doctrine, the two weakest
tiers. This phase builds the missing twin.
</domain>

<why_now>
A live student-persona /mos:ignite test on v1.15.0-beta.1 (2026-06-24) reproduced the B1
starting-point gate rendering as flat ASCII with no interactive card. A 5-agent
investigation the same day (code-history + on-disk prior research + Tavily external +
adversarial verify) CONFIRMED at high confidence, surviving every refutation attempt, that
this is not five bugs but one architectural gap appearing in five places. The diagnosis is
grounded in the live tree, and Phase 178 is the first artifact in the project's history to
name the universal render gate (render_gate_ever_proposed across all prior research: false).
</why_now>

## The thesis in one paragraph

The code GUARANTEES the marker STRING is composed (selector-dispatcher.cjs:537, unconditional
on every Shape F.* return). The code NEVER fires the card: AskUserQuestion is invoked as a
tool call NOWHERE in lib/ or scripts/ (verified by grep across 90 hits - all comments,
markers, trailers, and a downstream classifier that reacts AFTER the agent already fired).
The terminal load-bearing step lives only in the model reading a string and honoring one
prose line. CIRS proved the cure for the identical class on the invocation side: make adding
a surface mechanically force "declare your wiring or break the build." This phase applies
that same born-wired, fail-closed mechanism to render. The atomic gate-emitter chokepoint is
the thing the gate VERIFIES exists for every reachable surface - not a test anyone has to
remember to write.

## The load-bearing requirement (the spine)

A BORN-WIRED, FAIL-CLOSED, REGISTRY-DRIVEN render-coverage gate, with three non-negotiable
implementation constraints (any one missing reverts this to the five-phase slip):

- **C-1 Registry-driven, not hand-written.** Derive a surface/path registry of every render
  surface that can reach a Decision Gate (the F.* shapes plus any new F.7-dial-class HUD).
  Each entry DECLARES either "routes through atomic interactive-card emission" or
  "render-only, excluded" - the same two-state ledger CIRS already uses for invocation. A
  build script (sibling of build-orchestration-projection.cjs) walks the registry and FAILS
  CLOSED if any reachable gate surface lacks the declaration. The registry walk is an
  exhaustive enumeration of render entry points (grep/AST over the dispatcher branches), NOT
  a hand-maintained list - or a future surface bypasses the registry the way 177's F.7-dial
  was minted with no marker. This is the load-bearing constraint: a hand-written test only
  covers the path someone remembered to write.
- **C-2 Deterministic, code-evaluated binary.** "Did a reached-gate render route through the
  single card-emission door" is a pure code predicate over the registry and the dispatcher
  wiring. NO LLM-judge in the hard gate (LLM-judge is for soft quality only), so the gate is
  CI-stable and reproducible.
- **C-3 Hard-FAIL from day one.** If the gate cannot CONFIRM card-emission routing on a
  reachable gate surface, it DENIES (nonzero CI exit), not passes. A WARN-only render gate is
  the SKILL fence with extra steps and will rot exactly as 143.x/144.1 did before R9.

The atomic gate-emitter chokepoint (promote SEED-020's single construction door,
selector-dispatcher.cjs:537, from "mints a marker" to "the registry-verified chokepoint") is
the MECHANISM the gate verifies. The one-time contract tests (test-150-5, ACPT-06) stay as
unit smoke checks but are explicitly NOT the gate.

## Candidate Canon amendment (navigator-gated)

This gate is the rendering-layer peer to Part 11. It is a candidate for a Canon amendment
(a Part 11 render-twin rule, or a Part 3 enforcement clause): "any surface that can reach a
Decision Gate must route through atomic interactive-card emission, declared at the
registry/type level, with the build failing closed when a reachable gate surface lacks that
routing." NAVIGATOR-GATED via the Part 6 dog-fooding canon-amendment-on-itself mechanism;
proposed here, not self-applied. The render-twin rule does NOT change Part 3's frozen
contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs).

## Verified evidence (5-agent investigation, 2026-06-24, high confidence)

- The seam: scripts/intent-classifier.cjs:934-936 reads askuserquestion_marker and
  concatenates it as TEXT into the turn block; from :936 the card-firing is agent-only.
- AskUserQuestion is NEVER a tool call in lib/ or scripts/ (grep, 90 hits, all strings).
- The only enforcement of "a gate fires its card": skills/larry-personality/SKILL.md:129
  prose ("no card, no picture"); mirrored in conversation-mode/ui-system/room-proactive.
- No born-wired render gate exists; build-orchestration-projection.cjs:113-138 EXCLUDES
  render-only surfaces, proving CIRS governs invocation and scopes render out.
- Prior research KNEW: SEED-021 named the failure mode but scoped the cure to the engine
  arm; 150.5-RESEARCH calls the card half "PURE PROMPT DOCTRINE" and marks gate 12 (card =
  model tool-call) UNGATED/DEFECT; render_gate_ever_proposed = false.
- 177 minted dial-selector.cjs F.7-dial (renderDialShape :216-228) with NO
  askuserquestion_marker - a new gate surface with zero render coverage, the slip in real time.

## External grounding (Tavily, converges hard)

- TypeScript never/assertNever total function: adding a variant FAILS THE BUILD CLOSED unless
  its handler is wired - the purest born-wired pattern, exactly how CIRS cured invocation.
- ESLint switch-exhaustiveness only WARNs unless promoted to a never-typed default - the
  negative proof: the orphaned-WARN-only tier is where render still lives.
- OPA policy-as-code: prompt-embedded rules are "too fragile"; enforce deterministically
  "where the LLM has no say."
- ArbiterOS: non-bypassable kernel makes VERIFY a post-condition of GENERATE before a
  high-stakes action - the card as a kernel-enforced post-condition of reaching a gate.
- ARMO five-rung ladder: code "composes the gate" (claim) vs the card actually firing
  (reality); the render gate is the missing independent observation plane.
- Pact: serialize the implicit contract into an explicit artifact, verify in a job that
  blocks promotion - a marker string the agent "should honor" is the implicit-contract
  anti-pattern Pact exists to replace.

## Locked decisions (navigator, 2026-06-24)

- D-178-01 The deliverable is the BORN-WIRED render-coverage GATE, not a contract test.
- D-178-02 Build on Phase 177 (dial-selector.cjs) + the 150.5 atomic seam; reuse, do not
  duplicate (Part 7); the chokepoint is the mechanism the gate verifies.
- D-178-03 Three non-negotiables: registry-driven (C-1), deterministic code-evaluated (C-2),
  hard-FAIL from day one (C-3).
- D-178-04 Additive enforcement only: no reach/posture/edge/node minted; Part 3 frozen
  contracts untouched.
- D-178-05 Brain suggestions + framework invocations render through the same verified
  chokepoint (Part 11 one governed path).
- D-178-06 Propose the render-twin Canon amendment; navigator-gated, not self-applied.
- D-178-07 Name every residual honestly (below); do not let the gate's scope quietly expand
  to claim it covers them.

## Residual risks (named, not hidden)

- R-1 Irreducible agent-honored residual: the gate makes the REACHED-gate
  composition-to-emission PATH machine-enforced; the terminal LLM tool-call on a real surface
  may stay agent-honored (Phase 178 GA-5, 150.5 hole #1). The gate proves "every reachable
  surface is WIRED to emit a card," not "the model called the tool this turn."
- R-2 Prose-mimicry is OUT of scope: the model hand-painting interactive-looking glyphs on a
  turn the code never reached a gate (150.5 hole #4) has no marker to verify. Keep the SKILL
  doctrine line as the named, accepted residual for the unreached case.
- R-3 Registry-completeness is the new single point of failure: born-wired only holds if
  EVERY render surface is in the registry; the walk must be an exhaustive enumeration, not a
  hand list (C-1).
- R-4 Tri-Polar still deferred: Desktop/Cowork have "no AskUserQuestion card guarantee"
  (BIRTH-FLOW-BRIEF.md constraint 9, render-proof V8); the gate as scoped governs the CLI card
  path; Desktop/Cowork needs its own render proof or the coverage claim is CLI-only.
- R-5 Enforcement-tier regression: if the gate ships WARN it rots exactly as 143.x/144.1 did;
  it MUST land hard-FAIL (C-3).

## Scope boundary / deferred

DEFERRED to a separate phase (navigator: "fix first, feature second"): CV-second-select in
the F.7 selector for every persona + per-persona JTBD statements (researcher / student /
venture / entrepreneur). Composes with the persona/CV substrate; not part of the gate.

## Gray areas for the researcher/planner

- GA-1 The registry source: enumerate render entry points by AST/grep over the dispatcher
  branches (the F_SUBSHAPES array + the F.7-dial branch + the ~14 pickShape callers). Define
  the exhaustive walk so a new branch cannot escape.
- GA-2 The declaration shape: the two-state ledger entry per surface ("card-emission" vs
  "render-only excluded") and where it lives (frontmatter, a data/ json, or derived).
- GA-3 The deterministic predicate (C-2): what exactly proves "this surface routes through
  the card-emission door" as pure code over the registry + dispatcher wiring.
- GA-4 GA-5 from the prior scope stands: can the terminal card-fire be made structural rather
  than agent-honored at all (a PostToolUse interceptor that validates a card fired on a
  reached-gate turn)? If not, it is the named R-1 debt.
- GA-5 Tri-Polar: define the Desktop/Cowork named-degrade render proof or scope the gate
  CLI-only and say so (R-4).
