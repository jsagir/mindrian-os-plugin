# The layer Declaration Contract (Canon Part 11 candidate born-clause)

Status: Active
Canon anchor: docs/MINDRIAN-CANON.md Part 11, as a CANDIDATE fourth born-clause, drafted not enforced (WD-8)
Implementing phase: 344 (the layer contract)
Gate hook: scripts/check-layer-declaration.cjs (ships in 344-02)
Sibling contracts: docs/HITL-SHAPE-DECLARATION-CONTRACT.md (R16, the born-declared-shape rule) and docs/CONNECTOR-CONTRACT.md (R1, the born-wired-or-excluded rule)

---

## Why this contract exists

MindrianOS implements five engineering scopes, named and defined in `docs/LAYER-CONTRACT.md` (344-06) and enumerated as the closed `layer_vocabulary` in `data/layer-declaration-schema.json`, each one wider in what it coordinates than the one before it. Every one of the five is already implemented, and none of them has ever been named on the surfaces that engineer it. Nothing on a command, an agent, a pipeline, a skill, or an MCP tool states which scope it engineers, and no gate can check a fact that no surface declares.

This is the declaration half of a two-part doctrine. `docs/LAYER-CONTRACT.md` (ships in 344-06) is the architecture half: it names, per rung, the definition, the core question, the implementing components with file paths, and the single owner surface. This contract is narrower and mechanical: it states the frontmatter fact every surface carries, points at the closed vocabulary that fact is drawn from, and records the working decisions this phase adopted while drafting it.

Canon Part 11 already ships two born-clauses: R1 (born WIRED or EXCLUDED, docs/CONNECTOR-CONTRACT.md) and R16 (born declared-shape, docs/HITL-SHAPE-DECLARATION-CONTRACT.md). This contract proposes a fourth sibling, a candidate born-declared-layer rule. It is drafted here as prose and a schema; it is NOT promoted into the Canon's constitutional text in this phase (WD-8). Promotion is a separate, later, navigator-governed act, exactly as R16 itself was drafted before it was ratified.

---

## The frontmatter contract

A declaring surface carries a single `layer:` scalar in its own frontmatter:

```yaml
layer: <one member of layer_vocabulary>
layer_why: "..."   # REQUIRED only when layer is none, optional otherwise
```

The closed vocabulary, the own-rung classification rubric, the fail-closed default, and the never-hardcoded surface-count discipline all live in ONE place: `data/layer-declaration-schema.json`. This document does not restate the vocabulary; it names the file. One home per fact.

An MCP tool has no frontmatter, so its declaration home is its own module's exported `connectors` descriptor: one entry of that array carries `layer` (and `layer_why` when `layer` is `none`), the same way `hitl_shape` already rides that descriptor for MCP tools today.

---

## Which surfaces must declare

Four markdown surface classes, plus MCP tool connector descriptors (WD-7):

1. `commands/*.md`
2. `agents/*.md`
3. `pipelines/*/CHAIN.md`
4. `skills/*/SKILL.md` (qualifying skills only, see the exemption rule below)
5. every MCP tool's exported `connectors` descriptor entry

The exemption rule is the R16 sibling, stated verbatim so the two mandates cannot silently diverge: a render-only or pure-capability skill is exempt through its EXISTING `connector.excluded: true` plus a `reason`, never through declaring a rung it does not have. It does not additionally write `layer: none`; it is simply absent from the backfill map, and the gate reads that absence as conformant if and only if `connector.excluded: true` plus `reason` are present.

---

## Layer is not lane

`data/help-groups.json` already carries a four-value `lane` axis (`start`, `methodology`, `explore`, `view`) answering "what is the user trying to do." `layer` answers a different question: "what scope of the system does this surface engineer." The two axes are orthogonal over the same command set. A `start` lane command can engineer any layer; a `methodology` lane command is usually a LOOP but is not required to be one. Neither axis is derivable from the other, and this contract does not attempt to collapse them. `docs/LAYER-CONTRACT.md` (344-06) names `data/command-registry.json`'s `layer` field as the interface Phase 343 item 4 consumes for the help family map; `data/help-groups.json` itself is unchanged by this phase.

---

## Decision ledger

`.planning/` is gitignored in this repo, so this table is the only copy of these decisions that travels between machines. Every row below is seeded WORKING with today's date; the 344-03 checkpoint (immediately before the command backfill lands) is where the navigator's five reserved rulings (WD-1 through WD-5) move from WORKING to RULED. The five design forks (WD-6 through WD-10) and the two mechanical decisions this plan itself settled (WD-11, WD-12) are Claude's discretion per the phase research, tracked here for the same reason: so the reasoning behind them survives a machine switch.

| id | decision | status | ruled-by | date | notes |
|---|---|---|---|---|---|
| WD-1 | The canonical ICM L0-L4 statement is `docs/MINDRIAN-CANON.md` Appendix B; the other three statements become pointers | RULED | navigator | 2026-09-14 | Navigator's to rule. Least-wrong candidate per `344-RESEARCH.md` Q2; the alternative statements (`.claude/includes/architecture.md`, `docs/ARCHITECTURE-DEEP-DIVE.md`, `templates/icm/CLAUDE.md`) are read, not re-derived. Ratified as written at the 344-03 checkpoint |
| WD-2 | `MINTO.md` is a reasoning product that sits UNDER the per-section `CONTEXT.md` L2 contract; `CONTEXT.md` is L2 | RULED | navigator | 2026-09-14 | Navigator's to rule. Ratified as written at the 344-03 checkpoint |
| WD-3 | The PROMPT owner surface is `skills/larry-personality/SKILL.md` as the single source, everything else generated. Scoped here to a declaration only; the generation step is a follow-up phase | RULED | navigator | 2026-09-14 | Navigator's to rule. Ratified as written at the 344-03 checkpoint |
| WD-4 | `seeds/` is NOT a room part and is removed from the ICM part list | RULED | navigator | 2026-09-14 | Navigator's to rule. Ratified as written at the 344-03 checkpoint |
| WD-5 | One context assembler is the goal. This phase declares that goal and measures the two budgets; it changes no assembly path | RULED | navigator | 2026-09-14 | Navigator's to rule. Ratified as written at the 344-03 checkpoint |
| WD-6 | A surface declares its OWN rung, one value, not the highest rung it transitively touches | RULED | navigator | 2026-09-14 | Design fork. A highest-rung reading would collapse every chain-touching surface onto `graph`. Ratified as written at the 344-03 checkpoint |
| WD-7 | The mandate covers four classes (commands, agents, pipelines, qualifying skills) plus MCP tool connector descriptors | RULED | navigator | 2026-09-14 | Design fork. Ratified as written at the 344-03 checkpoint |
| WD-8 | `layer:` is a Canon Part 11 born-clause CANDIDATE: drafted here as a prose contract, not enforced constitutionally in this phase | RULED | navigator | 2026-09-14 | Design fork. Ratified as written at the 344-03 checkpoint |
| WD-9 | `body_shape` normalization is OUT of scope. Its vocabulary is declared beside `layer` and its 19 distinct values are counted; enforcement is a separate phase | RULED | navigator | 2026-09-14 | Design fork. Ratified as written at the 344-03 checkpoint |
| WD-10 | The doctor module reads live rooms through the Phase 232.1 read-only door only, counts only, and opens no database at all in its shipped form | RULED | navigator | 2026-09-14 | Design fork. Ratified as written at the 344-03 checkpoint |
| WD-11 | A sixth vocabulary member `none` exists for a surface that engineers no rung, mirroring `data/hitl-shape-declaration-schema.json`'s own literal `none` | RULED | navigator | 2026-09-14 | Settled mechanically by this plan. Ratified as written at the 344-03 checkpoint |
| WD-12 | `layer_why` is REQUIRED only when the declared value is `none`, and optional otherwise | RULED | navigator | 2026-09-14 | Settled mechanically by this plan. Ratified as written at the 344-03 checkpoint |

---

## What this contract does NOT do

- It does not amend the Canon. Promoting `layer:` from a candidate born-clause to constitutional text is a separate, later, navigator-governed act.
- It does not promote the gate shipped in 344-02 to blocking. That gate enters at the honest `declared` rung, per `data/harness-policies/_schema.json`'s own discipline: a policy with no evidence log yet has no basis for a promotion rule to be met.
- It does not normalize `body_shape`. Its 19 distinct values are counted and named beside the layer vocabulary; fixing them is a separate phase.
- It does not change any context assembly path. Navigator decision WD-5 (one assembler versus two) is declared as a goal here and left untouched in code.
