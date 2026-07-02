# The cirs_relationship Declaration Contract (CIRS R12)

Status: Active
Canon anchor: docs/MINDRIAN-CANON.md Part 11 R12 + Appendix D entry 25
Implementing phase: 172 (contextual-invocation-coverage), Plan 02
Gate hook: scripts/check-cirs-declaration.cjs

See also: docs/HITL-SHAPE-DECLARATION-CONTRACT.md. R12 (this contract: forward-declare a touched surface in the PLAN.md frontmatter) and R16 (born-declare the Shape-F on the shipped surface, across all four surface classes -- commands, agents, pipelines, and qualifying skills) are SIBLING rules, not the same rule. R12 governs the phase-boundary declaration; R16 governs the surface-file declaration. A phase can satisfy R12's forward-declaration and still ship a surface that violates R16's born-shape mandate, and vice versa; both gates run.

---

## Why this contract exists

Canon Part 11 (The Invocation Constitution) makes WHEN / WHICH / SEQUENCE a constitutional concern: every capability MindrianOS can invoke must be governed, reachable by exactly one path, and represented in the orchestration graph. CIRS R12 (Forward-declaration and explainability) is the rule that keeps that governance from regressing at the phase boundary. A future phase that silently changes the invocation surface is exactly the failure mode that Phases 143.x and 144.1 demonstrated, where the governing contract lived nowhere but an orphaned WARN-only gate.

R12 closes that hole. Every future phase that adds, modifies, or removes an invocable surface, OR that consumes the invocation spine, must declare and explain its relationship to the Command Invocation Ruling System via a `cirs_relationship:` frontmatter block. The block is auditable, local to the phase plan, and gate-enforced: a phase that touches a surface without a conformant declaration is gate-FAILED.

CIRS is self-propagating only because it is self-enforcing. This contract is the schema the gate enforces.

---

## The cirs_relationship frontmatter block

A phase plan declares its relationship to CIRS in its frontmatter as a nested map. The block has five structured fields plus a required prose explanation:

```yaml
cirs_relationship:
  surfaces_added: []          # array of surface slugs newly created (commands/, skills/, agents/)
  surfaces_modified: []       # array of surface slugs whose invocation behavior changes
  surfaces_removed: []        # array of surface slugs retired (transition to the RETIRED ledger state, R13)
  spine_consumed: []          # array of spine assets this phase reads (see "The spine" below)
  gate_impact: "..."          # string: how this phase changes the gate (adds a check, ships a hook, none)
  explanation: "..."          # prose: how this phase USES and/or is USED BY CIRS
```

Field semantics:

- **surfaces_added** is the array of surface slugs (one command file, one skill SKILL.md, one agent file each, per R1's unit-of-coverage) that this phase newly creates. Each added surface must be WIRED or EXCLUDED at birth (R2 born-wired). An empty array is conformant when the phase adds no surface.
- **surfaces_modified** is the array of surface slugs whose invocation behavior this phase changes (a new trigger, a changed reach, an altered chain). A modified surface re-runs the gate (R10 lockstep on change).
- **surfaces_removed** is the array of surface slugs this phase retires. A removed surface transitions to the RETIRED ledger state with mandatory inbound-chain re-point-or-drop (R13). A live chain whose target is retired is a gate failure.
- **spine_consumed** is the array of spine assets this phase reads. Declaring a non-empty spine_consumed also triggers the requirement: a phase that consumes the spine without declaring it is gate-FAILED, even if it touches no surface file directly (this closes the undeclared-spine-consumption repudiation surface).
- **gate_impact** is a one-line string stating how this phase changes the CIRS gate: ships a new check, lands a hook, extends the coverage ledger, or has no gate impact.
- **explanation** is the required prose field. It states, in plain language, how the phase USES CIRS (it reaches through the spine, it is triggered by a sensor) and/or how it is USED BY CIRS (its surface is wired, its counterpart is ranked). The explanation is what makes the declaration self-documenting: a future reader understands the phase's relationship to the invocation ruling system without re-deriving it from the code.

A declaration is conformant when all five structured fields are present and the explanation prose is non-empty.

---

## The canon_parts-11 auto-derivation rule

R12 is a SPECIALIZATION of the existing canon_parts forward-compatibility rule (every phase declares the canon parts it touches). The specialization is a derivation rule: declaring ANY cirs_relationship field auto-implies the value `11` in the phase's `canon_parts` array. The gate derives one from the other so they cannot disagree.

Concretely: if a phase carries a `cirs_relationship:` block, its `canon_parts:` MUST contain `11`. A phase that declares a cirs_relationship field but omits `11` from canon_parts is a derivation disagreement, and the gate FAILS it. The two declarations are kept in lockstep by construction: the presence of the relationship block IS the assertion that the phase touches the Invocation Constitution, and Part 11 is that constitution.

This mirrors the way the canon_parts rule itself works (a phase that touches a canon concept declares the part), narrowed to the invocation layer.

---

## The trigger: when a phase MUST declare

A phase MUST carry a conformant cirs_relationship block when EITHER condition holds:

1. The phase's plans modify files under `commands/`, `skills/`, or `agents/` (it touches an invocable surface). This is the surface-touching trigger.
2. The phase consumes the invocation spine. This is the spine-consuming trigger.

The spine assets that count as consumption: the connector registry generator (build-connector-registry), the orchestration projection generator (build-orchestration-projection), the navigation engine decide() path, the chain-executor runChain, and the connector and projection registries themselves. A phase that reads or extends any of these consumes the spine and must declare.

A phase that touches no invocable surface and consumes no spine asset is NOT required to declare. The declaration is required only when triggered; an untriggered phase carrying no cirs_relationship block is conformant.

---

## Where the declaration is recorded

The declaration is recorded in docs/CANON-PHASE-MAP.md via a CIRS column, keyed on phase SLUG (not phase number). Keying on slug absorbs the map's own phase-number-collision warning (the same canon obligation can be keyed to a non-unique number, which is structurally fragile; the slug is unique). The CIRS column is the slug-keyed forward-declaration ledger: every future phase row in the Part 11 section carries its cirs_relationship summary (surfaces touched, spine consumed, gate impact).

---

## The gate hook

scripts/check-cirs-declaration.cjs is the R12 gate hook. It scans plan frontmatter and, for any plan that satisfies the trigger above, requires a conformant cirs_relationship block AND `11` in canon_parts. It reads LOCAL plan files only: zero Brain, zero network (Canon Part 8). It runs warn-first where the phase plan directs, then hard-FAILs once the baseline is conformant, so CI never goes RED mid-sweep.

This plan (172-02) dog-foods the contract: its own frontmatter is the gate's first conformant test case. The validator self-validates the plan that ships it.
