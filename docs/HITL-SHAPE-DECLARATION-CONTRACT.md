# The hitl_shape Declaration Contract (CIRS R16)

Status: Active
Canon anchor: docs/MINDRIAN-CANON.md Part 11 (the future R16 born-declared-shape rule) + Part 3 (the ten Shape-F sub-shapes)
Implementing phase: 190 (shape-f-declaration-mandate), Plan 01 (contract + data), Plan 02 (mechanical backfill), Plan 03 (gate hook)
Gate hook: scripts/check-shape-declaration.cjs (ships in Plan 03)
Sibling contract: docs/CIRS-RELATIONSHIP-CONTRACT.md (R12, the forward-declare rule for PLAN.md frontmatter)

---

## Why this contract exists

Canon Part 11 (The Invocation Constitution) makes WHEN / WHICH / SEQUENCE a constitutional concern. Two of its born-clauses already ship:

1. Born WIRED-or-EXCLUDED (R1/R2): every invocable surface is born either wired into the reach spine, or explicitly EXCLUDED-with-reason. The born-wired gate fails the build closed. See docs/CONNECTOR-CONTRACT.md.
2. Born forward-declared (R12): every phase that touches an invocable surface declares its relationship to CIRS in its plan frontmatter. See docs/CIRS-RELATIONSHIP-CONTRACT.md.

This contract adds the THIRD born-clause: born declared-shape (the new R16). Every invocable surface that reaches a genuine Decision-Gate fork (a place the navigator picks among options) must declare WHICH Shape-F fork it renders, in its own frontmatter, at birth.

The motivating failure mode is the Phase 188 GIX single-select bug: a surface that should have offered a multi-option Shape-F gate silently collapsed to a single hard-coded select, because nothing on the surface itself declared the shape it was supposed to render. There was no local, auditable statement of "this surface renders an F.5 branch" that a gate could check against the rendered reality. R16 closes that hole the same way R1 closed the dark-surface hole and R12 closed the undeclared-phase hole: by making the declaration a first-class, gate-enforced frontmatter fact.

R16 is a sibling of R12, not the same rule. R12 is the forward-declare rule for the PLAN.md that ships a change. R16 is the born-declare rule for the shipped surface file itself. A phase can satisfy R12 (its plan declares the CIRS relationship) and still violate R16 (the shipped command file carries no hitl_shape). Both must hold.

---

## The frontmatter contract

A declaring surface carries its shape in ONE of two forms.

### Form A: single-fork surfaces

A surface that reaches exactly one Decision-Gate fork carries two scalar fields:

```yaml
hitl_shape: F.x        # one member of the closed vocabulary (see below)
hitl_why: "..."        # one Feynman-simplified sentence explaining WHY that shape fires
```

`hitl_shape` is one of the closed ten canonical Shape-F ids (F.0 through F.9) OR the literal string `none`. `none` means a commands / agents / pipelines surface that reaches no genuine fork (a pure diagnostic, a read-only report, a render-only view). `hitl_why` is always a single plain-language sentence stating why the shape fires, never merely restating the id.

### Form B: multi-stage engines, pipelines, and skills

A surface that composes several forks into a staged flow carries `hitl_stages` instead, using the EXACT record shape already shipped in data/hitl-stages-schema.json:

```yaml
hitl_stages:
  - stage: "<non-empty stage name>"
    shapes: ["F.x", "..."]   # every id a member of the closed vocabulary
    mode: "parallel | ordered | gate"
```

`hitl_stages` is reused byte-compatibly with the existing hitl_stages contract (Phase 188). This contract does NOT invent a second, incompatible stage schema (Canon Part 7, reuse before build). The mode vocabulary (parallel | ordered | gate) is shared with data/hitl-stages-schema.json so the two schemas can never silently diverge.

A multi-stage surface still carries a single `hitl_why` sentence describing the staged flow as a whole.

---

## The closed vocabulary

`hitl_shape` (and every `shapes[]` entry) is drawn from a closed set. There is no eleventh shape; inventing one is a gate failure.

| Id | Shape (Canon Part 3) | The decision moment it renders |
|----|----------------------|--------------------------------|
| F.0 | Mini Decision Gate | a single APPROVE / REJECT (reason) / DEFER on one surfaced item |
| F.1 | Next Move | pick one next move from a small numbered set (or free text) |
| F.2 | Path | a dependency path where each step needs the last |
| F.3 | Depth Budget | how far to push a single line of exploration |
| F.4 | Harvest Scope | how wide to gather before stopping |
| F.5 | Branches | resolve among parallel branches or scenarios |
| F.6 | Plan Review | review and approve a multi-part plan / JTBD |
| F.7 | Ranked Reach | pick from a ranked set of capability reaches (the dial) |
| F.8 | Unordered Basket | an any-order set of independent jobs |
| F.9 | Ordered Walk | a fixed-order sequence where order is the meaning |
| none | (no fork) | commands / agents / pipelines only; never a skill |

The decision rule (transcribed from SEED-041) for choosing the shape:

- ordered / dependent flow -> F.9 or F.2
- an independent, any-order set -> F.8
- parallel branches or scenarios -> F.5
- a single move or yes-or-no -> F.1 or F.0
- a depth budget on one line of inquiry -> F.3
- a harvest scope (how wide to gather) -> F.4
- a plan review or JTBD approval -> F.6
- a ranked set of capability reaches -> F.7

---

## The trigger: four surface classes

R16 fires for every file under FOUR surface classes:

1. `commands/*.md` (one command file each)
2. `agents/*.md` (one agent file each)
3. `pipelines/*/CHAIN.md` (one pipeline manifest each)
4. `skills/*/SKILL.md` (one skill file each) -- the FOURTH surface class, folded into the mandate navigator-directed 2026-07-01

Folding skills in is the change this phase introduces. A skill that reaches a genuine Decision-Gate fork must declare a shape exactly like a command or agent. A pure-capability / render-only / ambient-substrate skill with no fork is EXEMPT (see the next section).

---

## Skills: the fork test, not the wiring test

The classification rule for skills, stated verbatim:

> A skill declares a shape IF AND ONLY IF it reaches a genuine Decision-Gate fork (a place the navigator picks among options), REGARDLESS of its Canon Part 11 R1 connector.connects_to_spine / connector.excluded status. A skill that is CIRS-excluded (ambient substrate, no reach-spine wiring) can still reach a fork and MUST still declare (four such skills ship in this phase). A skill with NO fork is exempt from THIS mandate by virtue of its EXISTING connector.excluded:true + reason -- it does not additionally declare hitl_shape:none, it is simply absent from data/hitl-shape-backfill.json, and the gate (Plan 03) treats "absent declaration + connector.excluded present" as a conformant exempt state, never a gap.

Two axes, orthogonal:

- The CIRS wiring axis (R1): is this skill WIRED into the reach spine, or EXCLUDED-with-reason? This is about whether a sensor can dispatch it.
- The HITL-shape fork axis (R16): does this skill reach a place where the navigator picks among options? This is about whether it renders a Decision Gate.

These are NOT the same test. Four skills in this phase are CIRS-excluded (ambient substrate, no reach-spine wiring) YET reach genuine forks: conversation-mode (its Lane Picker is an explicit F.1), intelligence-orchestrator (its APPROVE/REJECT/DEFER dispatch mini-gate is F.0), room-proactive (an F.0 finding gate and an F.1 filing gate), and larry-personality (four gates: F.0, F.1, F.1, F.7). Their CIRS-excluded status governs only whether a sensor dispatches them; it says nothing about the forks they render once active. They MUST declare.

### Why skills reuse connector.excluded instead of minting a second "none"

A skill with no fork is exempt by virtue of its EXISTING `connector.excluded: true` + `reason` frontmatter (shipped Phase 172-06). This is deliberate asymmetry against commands / agents / pipelines, which DO use the literal `none`. The reason is Canon Part 7 (reuse before build):

- A no-fork skill already carries a first-class, on-disk signal that says, in its own frontmatter, "this is ambient substrate / render-only / reference material with no discrete trigger of its own." That signal is `connector.excluded: true` + a `reason`.
- Minting a second closed-vocabulary path (`hitl_shape: none`) onto those five files would write a redundant declaration onto surfaces that already say the same thing a different way. Two signals for one fact is exactly the drift risk R16 exists to remove.
- So a no-fork skill is exempt by ABSENCE from data/hitl-shape-backfill.json, and the R16 gate reads that absence as conformant if and only if the skill carries connector.excluded:true + reason.

The four exempt skills as of Phase 250-02: context-engine, room-passive, pws-methodology, ui-system. Each is deliberately absent from data/hitl-shape-backfill.json and each carries connector.excluded:true + reason in its own frontmatter (the exemption is real, verified on disk, not a forgotten gap). brain-connector shipped this phase's original exempt-five list but moved to DECLARED (Form B hitl_stages, stage brain-refusal-fork, shape F.1) once its refusal fork became a genuine Decision-Gate moment (Phase 250-02, HONEST-02) - it keeps connector.excluded:true (Canon Part 11 R1 ledger requirement) alongside its Form B declaration, per the larry-personality precedent above.

Skills NEVER use `none`. A skill either (a) reaches a genuine fork and declares a real hitl_shape or hitl_stages, or (b) has no fork and is exempt via its existing connector.excluded. There is no third state.

---

## The dynamic surface-count principle

The total count of declaring surfaces is NEVER hardcoded. It is always:

```
count(commands/*.md) + count(agents/*.md) + count(pipelines/*/CHAIN.md) + count(qualifying skills/*/SKILL.md)
```

enumerated from disk by the gate at check time. As of this phase that total is 126 (105 commands + 9 agents + 3 pipelines + 9 qualifying skills). Cite this number for illustration only, never as a frozen constant a future gate hardcodes.

This phase itself demonstrates why the count must never be frozen: at plan-authoring time the total was 125 (104 commands), and it grew to 126 when commands/agentshield.md landed in phase 199-05 (a born-wired security-scan command) after this plan was written. A gate that hardcoded 125 would have gone RED the moment a legitimate new command shipped. The count is data; the gate enumerates it from disk every run.

---

## Where the declaration is recorded

The declaration lives in the surface file's OWN frontmatter (the shipped command / agent / pipeline / skill), applied mechanically by Plan 02 from data/hitl-shape-backfill.json. This is the born-declare location: the fact travels with the surface, not with a separate ledger. (Contrast R12, whose declaration lives in the PLAN.md frontmatter and is summarized in docs/CANON-PHASE-MAP.md.)

---

## The gate hook

scripts/check-shape-declaration.cjs is the R16 gate hook (ships in Plan 03). It enumerates every declaring surface from disk (the four classes above), requires a conformant declaration on each (Form A or Form B, every id a member of the closed vocabulary), and treats an absent skill declaration as conformant if and only if that skill carries connector.excluded:true + reason. It reads LOCAL files only: zero Brain, zero network (Canon Part 8). Enforcement history: it ran warn-first during the Phase 190 sweep, hard-FAILed once the baseline was conformant, and as of Phase 210 (navigator decision) it is ADVISORY BY DEFAULT again at every wiring site (commit hook, release.sh Step 2, doctor --acceptance): every violation is still detected and enumerated as WARN lines, but --check exits 0; --check --strict restores the hard-fail contract as an opt-in.

The gate validates against the closed vocabulary in data/hitl-shape-declaration-schema.json and the shared mode vocabulary in data/hitl-stages-schema.json.
