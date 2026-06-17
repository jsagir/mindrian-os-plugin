# Phase 164 Scoping - BONO Research-Debate Engine

- **Date:** 2026-06-17
- **Milestone:** v1.14.0 (queued, after Phase 163)
- **Canon parts:** 2, 3, 4, 8, 9
- **Provenance:** brainstormed with the navigator this session; reconciled against canon v1.9 + the live v1.14.0 roadmap after a re-baseline from a stale clone.

## Thesis

Today de Bono's hats are *opinions* (think-hats / persona / hat-briefing). Phase 164 turns them into *researched, adversarial arguments* over the venture's own domain graph. It is the cognitive capstone that consumes the v1.14.0 domain-lens substrate (Phase 163) and the cognitive lens family (Phase 130).

## The model (navigator-confirmed)

1. **Domain -> Subdomain -> Hat tree.** The hats stop being six floating opinions and become a traversable graph: the same subdomain can light up under multiple hats, and the consolidator finds where those readings collide. This IS Canon Part 2's team-member identity (`Hat + Name(domain) + Surname(subdomain)`), now graph-walkable via the Phase 163 first-class domain nodes.

2. **Fan-out unit = per (subdomain x hat) cell.** Finest grain; capped + scoped by a Shape F selector (the cost governor). Each cell agent returns `{stance, evidence, confidence}` drawing on web + local-graph-read + Brain-generic.

3. **Synthesis = structured ARGUMENT between hats over a hypothesis.** Not a tension-map report - a debate moderator. The graph proposes "what if..." hypotheses (from gaps / contradictions / reverse-salients); the navigator confirms/edits; the hats argue; the consolidator returns a ruling + residual tension (with an adversarial verify pass).

4. **Hypothesis source = both** - graph proposes candidates, navigator confirms/edits (human-in-the-loop).

5. **Execution = hybrid.** Inline (Larry) for the selector + hypothesis confirm; deterministic capped Workflow (harness-as-code) for the cell fan-out + debate; Larry voices + files.

6. **Incremental filing (load-bearing).** Every pipeline step (tree / hypotheses / cells / debate / synthesis) files an artifact to the room AND embeds its analysis into the local graph via `navigation.cjs` BEFORE the next step. Crash-resumable, queryable per step. This is the navigator's explicit requirement.

## Substrates (all four)

- **Local room graph (read+write)** via `navigation.cjs` chokepoint - the moat; write typed edges from the frozen allow-list.
- **Remote web research** - hat-scoped (White=data, Black=failures, Green=innovations, Yellow=success, per Canon Part 2 TOOL ACCESS).
- **Brain spine (generic methodology, READ-ONLY)** - `brain_search`/`brain_query`, framework names + problem-type enums only. ZERO user-content egress (Part 8/9). Typed packet only.
- **Larry reach integration** - unresolved tensions become candidate reaches / F.0 decision gates via the live dial (Phase 141/144 spine).

## Reuse boundary (Canon Part 7)

| Consume (do NOT fork) | Net-new |
|---|---|
| Phase 163 domain/subdomain/focus_area typed nodes + typed-domain.cjs writer | per-(subdomain x hat) cell fan-out Workflow |
| Phase 130 cognitive lens family (think-hats/persona/hat-briefing) | inter-hat DEBATE over a graph-proposed hypothesis |
| Engine 1 commands (explore-domains/whitespace/find-*) | incremental per-step file + graph-embed contract |
| navigation.cjs chokepoint; lens-engine.cjs registry | the `/mos:bono` front door + Shape F selector wiring |
| harness-as-code 9-property architecture | adversarial verify pass on each ruling |

## Pipeline (hybrid)

| Phase | Mode | Files artifact? | Embeds to graph? |
|---|---|---|---|
| P0 tree (from Phase 163 domain nodes) | inline | yes | tree nodes/edges |
| P1 hypotheses (graph-proposed, user confirms) | inline | yes | Hypothesis nodes |
| P2 per-(subdomain x hat) cell fan-out | Workflow (capped) | one per cell | CellReading + READS edges |
| P3 inter-hat debate -> ruling + residual tension | Workflow | one per hypothesis | ARGUED_BY / RESOLVED_AS / TENSION (frozen-set edges) |
| P4 synthesis + reach candidates | inline | yes + terminal report | reach candidates linked |

## Open items for plan-phase

- Confirm the exact edge types for the debate (reuse frozen allow-list; if a genuinely new type is needed it is a canon amendment, navigator-gated - NOT a command-level invention).
- Dial-TUI selector API (Shape F.7) on current main.
- Whether the engine logic lives in `lens-engine.cjs` (cognitive+domain families) vs a thin skill - prefer lens-engine to avoid a parallel surface.
- Cap defaults (max cells, model tier).
- Tri-polar fallback shape for Desktop/Cowork (no TUI).

## Hard gates (RCA Section 5 + canon)

Canon Part 8 Brain-boundary; Tri-Polar three-surface; cross-platform; release lockstep; no em-dashes; reuse-before-build. The phase plan must clear all six before any "done" claim.
