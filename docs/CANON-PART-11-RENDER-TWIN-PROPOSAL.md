# Canon Proposal: The Render-Coverage Twin (CIRS render-side born-wired gate)

Status: RATIFIED - Option A (R15), navigator-LOCKED 2026-06-24. Lands as an atomic lockstep wave WITH Phase 178 (canon text + FLOOR test + version bump together; never piecemeal).
Date: 2026-06-24
Author: Jonathan Sagir with Claude-as-Larry
Implementing phase: 178 (universal-gate-chokepoint)
Evidence: .planning/phases/178-universal-gate-chokepoint/178-CONTEXT.md + 178-RESEARCH.md;
a 5-agent investigation (code-history + prior-research + Tavily + adversarial verify, HIGH
confidence, survived every refutation) run 2026-06-24.

---

## North Star

> Canon Part 11 (CIRS) made INVOCATION born-wired: a capability cannot ENTER, CHANGE, or LEAVE
> the system without the constitution knowing, and a surface neither WIRED nor EXCLUDED fails
> the gate CLOSED. The same must be true of RENDER: a surface that can REACH a Decision Gate
> cannot exist without declaring how it FIRES that gate's interactive card, and a reachable gate
> surface that declares nothing fails the gate CLOSED. A gate the engine can compose but the
> agent silently fails to fire is the render-side twin of a dark capability.

## The two planes - one discipline (navigator framing, 2026-06-24)

"Working" and "properly invoked by Larry" are two different guarantees, governed by two
different gates. The stack is covered only when BOTH hold.

- **Plane 1 - Invocation (CIRS, already born-wired):** does Larry reach for the right thing?
  Governed by R4 (one governed path: dispatchSensors -> decide() -> resolver), born-wired by
  R2/R9 (the build-connector-registry + build-orchestration-projection + check-cirs-declaration
  gates, hard-FAIL since Phase 172-13). Each surface declares a connector: block (WIRED) or
  connector:{excluded}. The resolver discipline keeps Larry honest: he never types a slug from
  memory - command-resolver/composeWorkflow attaches the command, so a framework, /mos:act, a
  pipeline, or a Brain consult is invoked through the one path, not improvised.
- **Plane 2 - Render (R15, this proposal):** when the reached surface surfaces a choice, does
  the card actually fire? Invocation can be perfectly governed and the gate still render as dead
  ASCII, because card-firing was agent-honored. R15 forces every reachable gate surface to
  declare its card-emission routing or break the build.

The navigator's surface list maps onto both planes: commands / skills / agents / pipelines /
Brain are the invocation surfaces (CIRS); any of them that surfaces a Decision Gate is ALSO a
render surface (R15). Same registry-driven, hard-FAIL discipline on both planes.

**Design consequence (separate render registry - CORRECTED 2026-06-24).** An initial "one
ledger, two columns" framing was rejected after the plan-checker verified it against the live
tree: the CIRS ledger is keyed on MARKDOWN surfaces (commands/skills/agents), but render entry
points are `.cjs` call sites in lib/ and scripts/ (the ~16 pickShape/renderDial sites), and 10
of 16 have NO owning markdown surface. The render plane is a DISTINCT keyspace; co-residency is
undefined for it. The corrected design: a dedicated render-coverage registry keyed on the `.cjs`
render entry points, walked by exhaustive AST/grep enumeration. The two-plane symmetry stays
STRUCTURAL in DISCIPLINE (same born-wired, hard-FAIL, registry-driven mechanism) but uses two
registries. Residual R-3 (registry-completeness drift) is dissolved NOT by co-residency but by
an EXHAUSTIVENESS FLOOR test: a render entry point that exists in the code but is absent from the
registry FAILS the build. That exhaustiveness check is the structural guarantee co-residency was
meant to provide.

**Two honest gaps (named, not papered over).** (1) CIRS invocation coverage is the target the
gate ENFORCES GOING FORWARD, not a claim every legacy surface is green today (Phase 172 baseline
still had surfaces being wired; 170/171 are conformance-held - shipped but release-gated until
they conform). R15 inherits the same enforced-forward posture. (2) The render terminal
tool-call residual (R-1): the gate proves every surface is WIRED to fire a card; proving the
MODEL fired it this turn needs the GA-4 PostToolUse-interceptor spike, otherwise it stays a
named debt.

## The gap (one paragraph)

Part 11 governs the TRIGGER wire (does a surface get REACHED). It explicitly scopes RENDER out:
`scripts/build-orchestration-projection.cjs:113-138` classifies render-only surfaces
(/mos:dashboard, /mos:splash) as "not a reach-dispatched thinking surface" and EXCLUDES them. So
whether a REACHED gate actually fires its interactive card has no constitutional home. The
result is a five-phase slip (143.1, 144.1, 148, 150.5, 177): the terminal load-bearing step (the
model firing the AskUserQuestion card) is AGENT-HONORED, not machine-enforced. Verified:
`AskUserQuestion` is invoked as a tool call NOWHERE in `lib/` or `scripts/` (90 grep hits, all
marker strings); the sole enforcement is one prose line, `skills/larry-personality/SKILL.md:129`
("no card, no picture"); `render_gate_ever_proposed` across all prior research = false. Every
prior fix patched one path/surface, enforced by per-path tests + SKILL fences - exactly the
WARN tier CIRS R9 had to flip to hard-FAIL for invocation. A new surface always escapes (Phase
177 minted `lib/hmi/dial-selector.cjs` F.7-dial with no marker).

## The proposed rule (the render-coverage twin)

> Every surface that can REACH a Decision Gate (Part 3 Shape F) MUST declare, at the
> registry/type level, either (a) it routes through atomic interactive-card emission (the single
> SEED-020 construction door), or (b) it is render-only and EXCLUDED. The render-coverage gate
> fails the build CLOSED (hard-FAIL, nonzero exit) when a reachable gate surface declares
> neither. The declaration is DERIVED by exhaustive enumeration of render entry points, never a
> hand-maintained list; the coverage predicate is deterministic and code-evaluated, never an
> LLM-judge.

This is the structural peer to R2 (born-wired) + R9 (enforced-not-aspirational), applied to the
render plane instead of the trigger plane. The mechanism is the proven CIRS generator+--check
pattern (`build-connector-registry.cjs` / `build-orchestration-projection.cjs` /
`check-cirs-declaration.cjs`) mirrored as `check-render-coverage.cjs`, wired into the same four
enforcement surfaces (pre-commit + install-pre-commit + release.sh + doctor --acceptance).

## Two framings (navigator picks)

- **Option A - new CIRS rule R15 (Render Coverage).** Add R15 to the closed ruling set R1-R14,
  scoped to render. Cleanest constitutional statement; makes render a first-class CIRS concern.
  Cost: moves the closed set R1-R14 -> R1-R15 (a frozen-set move, like the Phase 148 reach-count
  5 -> 6), so it is a navigator-LOCKED amendment with a FLOOR test and lockstep wave.
- **Option B - Part 3 enforcement clause + reuse CIRS machinery.** Add the render-coverage
  obligation as a clause under Part 3 (which already owns the Decision Gate as "the universal UX
  primitive ... no bespoke dialogs"), enforced by a CIRS-style born-wired gate without minting a
  new R-rule. Lighter; keeps CIRS R1-R14 frozen. Cost: the gate machinery lives in CIRS's domain
  while the doctrine lives in Part 3, a small seam.

RECOMMENDATION: Option A (R15). Render coverage IS a lifecycle/born-wired concern, which is
exactly what CIRS is; housing it as a peer rule keeps the enforcement and the doctrine in one
Part and makes "a new surface must declare its render coverage or break the build" a closed-set
guarantee rather than a clause that can drift. The closed-set move is the honest cost and is
handled by the same navigator-LOCKED + FLOOR-test + lockstep-wave discipline used for entries
15/18/21/22/23/24/26.

## What this does NOT change (frozen, restated)

MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 recommend gate, the 6-reach bank, the body glyphs, the
F.1 keyboard contract - all frozen, untouched. Mints no reach, no posture, no edge type, no node
type. Opens NO Brain wire (Part 8 clean): the render registry is LOCAL generic machinery
metadata (a surface path + a card-emission enum), never user data.

## Scope and named residuals (do not let the rule over-claim)

- The gate makes the REACHED-gate composition-to-emission PATH machine-enforced and fail-closed.
  It proves "every reachable surface is WIRED to emit a card", NOT "the model fired the tool this
  turn." The terminal LLM tool-call may stay partly agent-honored (the named debt; Phase 178
  GA-4 spikes a PostToolUse interceptor to close it).
- Prose-mimicry (the model hand-painting glyphs on a turn the code never reached a gate; 150.5
  hole #4) is OUT of scope; the SKILL doctrine line stays as the named residual for that case.
- Tri-Polar: Desktop/Cowork have no AskUserQuestion card guarantee (render proof V8 deferred,
  BIRTH-FLOW-BRIEF.md constraint 9). The rule as scoped governs the CLI card path; Desktop/Cowork
  needs its own render proof or the coverage claim is CLI-only. State this explicitly.

## External grounding (Tavily)

The cure is a proven pattern, not novel: the TypeScript `never`/`assertNever` total function
(add a variant -> build fails closed unless the handler is wired), OPA policy-as-code (enforce
deterministically "where the LLM has no say"), ArbiterOS (VERIFY as a non-bypassable
post-condition of GENERATE), ARMO's independent observation plane (claim vs reality disagreement
IS the failure), and Pact (serialize the implicit contract; verify in a job that blocks
promotion). ESLint switch-exhaustiveness supplies the negative proof: a WARN-only rule rots; you
must promote it to a hard error.

## Ratification path

Navigator-gated via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring
Appendix D entries 15/18/21/22/23/24/26. If Option A: the R15 addition + the canon text + a FLOOR
test (mirroring tests/test-cirs-four-class-floor.cjs) + the header/footer version bump move
together as ONE atomic lockstep wave so CI never goes RED. The amendment binds on ratification;
Phase 178 implements it (the registry walk + check-render-coverage.cjs + the hard-FAIL wiring).
Per Part 5 (Evidence Is Graded By Context), the irreducible terminal-tool-call residual is a
named, deferred debt, not a precondition for the rule binding.

---

## RATIFIED amendment text (Option A, navigator-LOCKED 2026-06-24) - lands atomically with Phase 178

The exact bytes below land as ONE lockstep wave during Phase 178 (plan 178-04), together with
the FLOOR test and the version bump, so CI never goes RED.

### R15 rule text (append to Part 11 CIRS ruling set; closed set R1-R14 -> R1-R15)

> - **R15** Render coverage - every surface that can REACH a Decision Gate (Part 3 Shape F)
>   declares at the registry/type level either (a) it routes through atomic interactive-card
>   emission (the single SEED-020 construction door), or (b) it is render-only and EXCLUDED. The
>   render-coverage gate fails the build CLOSED (hard-FAIL, nonzero exit) on a reachable gate
>   surface that declares neither. The declaration is DERIVED by exhaustive enumeration of render
>   entry points, never a hand-maintained list; the coverage predicate is deterministic and
>   code-evaluated, never an LLM-judge. R15 is the render-plane peer of R2 (born-wired) + R9
>   (enforced-not-aspirational); it governs whether a REACHED gate FIRES its interactive card,
>   distinct from R3's trigger wire (whether a surface gets reached). The terminal LLM tool-call
>   residual is a named debt (the gate proves WIRED-to-emit, not fired-this-turn). Frozen Part 3
>   contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs) are
>   UNCHANGED. The mechanism reuses the CIRS generator+--check pattern as
>   scripts/check-render-coverage.cjs wired into pre-commit + install-pre-commit + release.sh +
>   doctor --acceptance (the R9 enforcement surfaces).

### Appendix D entry 27 (draft)

> 27. **Part 11 R15 (Render Coverage) minted - the render-plane born-wired twin (Phase 178,
> 2026-06-24).** Phase 178 (universal-gate-chokepoint) amended Part 11's closed ruling set,
> adding R15 (Render Coverage) as the render-plane peer of R2 (born-wired) + R9
> (enforced-not-aspirational). CIRS governed only the TRIGGER wire (whether a surface gets
> REACHED) and explicitly excluded render (build-orchestration-projection.cjs:113-138). A 5-agent
> investigation (HIGH confidence, survived adversarial refutation) proved the F.7 gate-render
> slipped across five phases (143.1/144.1/148/150.5/177) because the terminal step (the model
> firing the AskUserQuestion card) was AGENT-HONORED, not machine-enforced (AskUserQuestion is a
> tool call NOWHERE in lib/ or scripts/; the sole enforcement was one SKILL prose line). R15
> makes "a reachable gate surface must declare its card-emission routing or break the build" a
> closed-set guarantee. The closed-set move R1-R14 -> R1-R15 is a navigator-LOCKED frozen-set
> amendment (mirroring entries 15/26) applied via the Part 6 dog-fooding canon-amendment-on-itself
> mechanism; it mints NO reach/posture/edge/node, opens NO Brain wire (the render registry is
> LOCAL generic machinery metadata), and leaves every frozen Part 3 contract unchanged. Landed as
> ONE atomic lockstep wave: R15 text + Appendix D entry 27 + the FLOOR test
> (tests/test-cirs-render-coverage-floor.cjs, mirroring tests/test-cirs-four-class-floor.cjs) +
> header/footer Version 1.15 -> 1.16 + the CANON-PHASE-MAP version-history row, all moving
> together so CI never went RED. The irreducible terminal-tool-call residual is a named debt
> (Phase 178 GA-4). Canon version bumped to 1.16.

### Lockstep wave checklist (Phase 178 plan 178-04)

1. MINDRIAN-CANON.md Part 11: append R15 to the ruling set; update the "R1-R14" closed-set
   references to "R1-R15" where they enumerate the bound.
2. MINDRIAN-CANON.md Appendix D: add entry 27.
3. MINDRIAN-CANON.md header + footer Version 1.15 -> 1.16.
4. docs/CANON-PHASE-MAP.md: add the v1.16 version-history row + the Phase 178 CIRS row.
5. tests/test-cirs-render-coverage-floor.cjs: the FLOOR test (R15 membership + the prior R1-R14
   preserved + frozen-set assertion + a reachable-undeclared-surface negative that the gate
   rejects), registered in tests/run-all-178.sh.
6. All of 1-5 in ONE commit so CI never goes RED.
