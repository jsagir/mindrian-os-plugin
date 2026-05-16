# lib/render/ -- Universal Renderer

> ICM Layer 0 identity for the renderer module.

## Purpose

The universal renderer translates a 4-zone payload + render mode + conversation operator + tier into the actual on-screen output. Owns the `render(zones, mode, operator, tier)` contract.

## Phase status

- **Phase 99-03 (shipped):** contract surface + no-op pass-through stub. Callers can import `{ render }` today; envelope returns `rendered: false` + `_stub: 'phase-99-03'` provenance tag. Operator validation against the 5 canonical values (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE) ships now so Phase 102 inherits the fence.
- **Phase 102 (shipped):** replaces the stub internals with real rendering logic per Phase 99 CONTEXT.md D-16. Same import surface; no caller changes. The destructured `render({ zones, mode, operator, tier, jtbd, tokenBudget, roomDir, provenance })` API ships; the legacy 4-arg signature stays alive at `lib/render/render.cjs` as a thin shim that forwards to v2.
- **Phase 121.5-04 (shipped, Sub-plan E):** the long-open question of whether render-v2 should be wired into the ordinary Larry prose path is resolved -- see **Disposition** below.

## Disposition (Sub-plan E, 2026-05-16)

> **render-v2 stays agent-surface-only by design.** SKILL.md remains the canonical prose contract for Larry's main conversation path. The v2 destructured `render()` entry is reserved for /mos:* command surfaces and the Shape F decision-gate output side that route through `lib/hmi/selector-dispatcher.cjs`.

This is the disposition that Phase 121.5 commits to for v1.13.0 final. The verdict was locked at plan-phase after the 2026-05-16 dual-graph review. Sub-plan E (this plan, 121.5-04) closes the open question; Sub-plan E ALSO closes the Phase 102 release loop by shipping `102-VERIFICATION.md` and flipping `102-VALIDATION.md` out of `status: draft`.

### Allowed render-v2 consumers (current production set)

| Consumer | Role | Why allowed |
|----------|------|-------------|
| `lib/render/render.cjs` | v1 legacy-signature shim | Reuses v2 muscle for the 4-arg positional API per Phase 102 CONTEXT D-10. One renderer, two entry points (Canon Part 7). |
| `lib/hmi/selector-dispatcher.cjs` | Shape F / Shape E agentic dispatcher | The /mos:* command output side -- Canon Part 3 tri-context decision-gate enforcement surface. NOT the ordinary prose path. |

CI gate: `lib/memory/render-v2-disposition.test.cjs` asserts the allowlist matches this table on every test run. The operator-facing audit lives at `scripts/disposition-render-v2.cjs` (`--json` for machine-readable, default for human summary; exit 1 on any prose-path import).

### Why not wire it into the prose path

Three reasons, in priority order:

1. **Canon Part 7 (Reuse Before Build).** SKILL.md is the canonical prose contract today; it ships, it is exercised on every Larry turn, and the 4-zone format is enforced by skill instruction. Replacing instruction-side enforcement with code-side enforcement would be a parallel implementation rather than reuse, which is the bar the canon explicitly raises against.
2. **Canon Part 3 (the gate output side).** The v2 destructured signature was designed for Shape F.x gate surfaces -- decision-gate output, not free prose. The compaction layer (102-02), JTBD-aware Zone 4 (102-03), provenance envelope (102-04), and color overlay (102-05) all assume gate-bounded payloads. Wrapping them around ordinary prose would silently change Larry's conversational shape -- a regression risk against Phase 88.1 + 88.2 + the Part 10 capstone work.
3. **Phase 121.5 capstone scope.** Sub-plan C reconciles SKILL.md v2 with the shipped Shape F set + dual palette + the 🎯/JTBD disambiguation. After 121.5 lands, SKILL.md IS the source of truth -- a separate v1.14.0 phase can revisit whether code-side prose rendering still earns its keep against a freshly-reconciled SKILL.md.

### Current rankable input signal types (additive expansion reserved)

The render-v2 entry today consumes a closed-by-version-but-open-by-future set of typed inputs:

| Signal | Source | Phase shipped |
|--------|--------|----------------|
| `operator` (5 canonical: JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE) | Phase 99 conversation operator state machine | 99-03 |
| `mode` ('A' / 'B' / 'tier-0') | Phase 90 brain-derivation tier-awareness | 102-04 |
| `tier` (0/1/2/3) | Phase 90 brain-derivation gating | 102-04 |
| `jtbd` (one of 13 canonical Phase 100 handles or null) | Phase 100 JTBD inference engine | 102-03 |
| `tokenBudget` ({used, total}) | Phase 102-02 compaction layer | 102-02 |
| `provenance` (caller-supplied; NOT folded into `_provenance`) | Phase 90 brain-derived inputs | 102-04 |

These are the input signal types render-v2 accepts **as of Phase 121.5-04** (additive expansion is reserved for future lens-aware variants once the dual-graph proposal lands -- ASSOCIATION_LENS + TRANSITION_LENS lens classes may add lens-derived signals). The set is current; it is not closed for all time. Per Canon Part 7 language discipline: "current" / "as of" / "today" framing is the convention -- never "final" / "complete" / "closed set" framing.

## Files

| File | Role |
|------|------|
| render-v2.cjs | Contract surface + Phase 102 implementation. Exports `{ render, OPERATORS, composeZones, isCompact, applyCompaction, JTBD_CLI_COLOR, ANSI }`. |
| render.cjs | v1 legacy-signature shim. Forwards to render-v2 with defensive defaults; returns just the `rendered` string. |
| render-v2.test.cjs | Contract regression fence: 8 IIFE scenarios (5-operator round-trip, JUST_TALK default for undefined and null, unknown-operator tolerated, envelope shape stable, mode passthrough, tier passthrough, OPERATORS frozen). Registered in lib/memory/run-feynman-tests.cjs. |
| JTBD-PALETTES.md | CLI + Mondrian dual-palette tables for the 13 canonical JTBDs (Phase 102-05). |
| ROOM.md | This file -- ICM Layer 0 identity per CLAUDE.md Decision #15. |

## Render contract (Phase 99 CONTEXT.md D-16, refined in Phase 102)

```
render({ zones, mode, operator, tier, jtbd, tokenBudget, roomDir, provenance })
  -> { rendered: string, contract: object, _provenance: <non-enumerable, frozen> }

operator == JUST_TALK        -> emit prose only; suppress envelope             (Phase 102-01)
operator == EXPLORE_CAPTURE  -> prose; Shape E only on crystallization         (Phase 102)
operator == BUILD_ROOM       -> full 4-zone anatomy + JTBD-aware Zone 4        (Phase 102-03)
operator == METHODOLOGY      -> no Zone 4 mid-session; Shape E at gate         (Phase 102-01)
operator == DECISION_GATE    -> Shape F.x; keyboard only                       (Phase 102-03)
```

The legacy 4-arg signature lives at `lib/render/render.cjs`:

```
render(zones, mode, operator, tier) -> string
```

## Canon refs

- **Part 3 (Tri-Context Decision Gate):** DECISION_GATE locks Shape F.x; the renderer enforces this at output time. The v2 entry is reserved for this gate-output side.
- **Part 4 (Every Choice Is Graph Data):** operator transitions written by Phase 99-01 are read by this renderer to pick shape.
- **Part 7 (Reuse Before Build):** the v1 shim wraps v2 -- one renderer, two entry points. The Sub-plan E disposition (this section) is itself a Canon Part 7 decision: don't add a parallel prose-side renderer when SKILL.md is the canonical prose contract.
- **Part 8 (Graph Boundary):** the renderer is pure formatting; no Brain calls anywhere in the chain (D-09).

## Downstream consumers

- **lib/render/render.cjs (v1 shim):** the legacy 4-arg positional signature surface. Reuses v2 muscle by construction.
- **lib/hmi/selector-dispatcher.cjs:** the Shape F / Shape E agent-surface dispatcher; the /mos:* command output side. This is the canonical gate-output consumer.

Any consumer outside this set is a violation of the Sub-plan E disposition. The CI gate at `lib/memory/render-v2-disposition.test.cjs` catches drift; the operator-facing audit at `scripts/disposition-render-v2.cjs` answers the question at any moment.

## Constraints

- Zero new runtime dependencies (Phase 87 invariant).
- CJS only (Phase 87 invariant).
- `render()` import surface MUST remain byte-stable across the Phase 102 swap (RENDER-102-06 fence).
- Operator vocabulary frozen at 5 canonical values; any 6th operator requires a Gate 1 review per Phase 99 CONTEXT.md D-03.
- Disposition: agent-surface-only. Adding a new consumer requires updating the allowlist in `scripts/disposition-render-v2.cjs` AND this ROOM.md in the same commit -- the CI gate enforces parity.

## See also

- `.planning/phases/99-conversation-operator-state-machine/99-CONTEXT.md` -- operator taxonomy, transition table, renderer signature contract D-16, graceful degradation D-17.
- `.planning/phases/102-context-aware-rendering/102-CONTEXT.md` -- the Phase 102 implementation spec.
- `.planning/phases/102-context-aware-rendering/102-VALIDATION.md` -- the Phase 102 validation strategy (Sub-plan E flips this out of draft).
- `.planning/phases/102-context-aware-rendering/102-VERIFICATION.md` -- the Phase 102 verification record (shipped by Sub-plan E).
- `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` -- Sub-plan E disposition rationale.
- `docs/MINDRIAN-CANON.md` -- North Star, Part 3 (Tri-Context Decision Gate), Part 4 (Every Choice Is Graph Data), Part 7 (Reuse Before Build), Part 8 (Graph Boundary).
