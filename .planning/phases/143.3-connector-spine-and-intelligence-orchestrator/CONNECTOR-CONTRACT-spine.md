---
type: connector-contract-spec (the universal wiring contract - "Phase 122 generalized to the whole spine")
status: proposed (navigator directive 2026-06-07: "any future/existing skill or command has a way to be part of the wiring; same basic connectors and hooks, relevant parts each, a main spine")
precedent: Phase 122 workflow-layer (framework -> command registry generated from frontmatter, CI-validated, resolver = only door)
relates_to: 143.2 (the intelligence-orchestrator is the FIRST CONSUMER / the spine reader), 143 (sensors), 144 (engine-side consumer)
---

# The Connector Contract - a universal wiring spine

## The principle (navigator, 2026-06-07)

Any skill or command - existing or future, whenever introduced - must have a defined way to PLUG INTO the wiring (the sensor -> reach -> Decision-Gate -> resolve -> file spine). All conform to the SAME basic connectors and hooks; each declares only its RELEVANT parts; there is ONE main spine that reads them. New surfaces auto-join by declaring; existing ones are retrofitted.

This generalizes Phase 122: there, `frameworks:` frontmatter + a generated `command-registry.json` + a resolver made `framework -> command` reliable and self-extending. The Connector Contract does the same for the ENTIRE reach-wiring, not just the command edge.

## The contract (frontmatter every connectable skill/command declares)

A standard, additive frontmatter block. Each surface declares ONLY the parts relevant to it; absent fields degrade (the surface simply does not participate in that hook).

```yaml
connector:
  connects_to_spine: true                 # opt-in; absent/false = not wired (legacy, until retrofitted)
  sensor_triggers: [SENS-02]              # which sensor(s) surface this surface's reach (0..n)
  reach_id: context_block                 # MUST be one of the frozen 5 (drift-tested) - NEVER a new id
  sub_mode: reverse-salient               # the RENDER LABEL under that reach_id (free, but registered)
  framework: "Reverse Salient Analysis"   # EXACT frontmatter name (Phase 122 / data/framework-names.json) - resolver key
  posture: pull_back                      # one of the frozen 3 (push_forward | hold | pull_back)
  hierarchy_rank: 2                        # Intelligence Hierarchy position for one-reach-per-beat arbitration
  filing: fileEvidenceWithReadback        # the write hook: fileEvidenceWithReadback | memory_event_only | none
  plan_gated: false                       # true only for the deep_research escalation (the sanctioned exception)
  web_scope: null                         # hat-scoped web, when applicable (white|green|black|yellow|red|blue)
  surface: F.1                            # the Shape-F sub-shape the Decision Gate renders as
```

The 5 frozen reach_ids and 3 postures stay frozen (drift tests). The contract NEVER mints a 6th - `sub_mode` carries the intelligence-tool identity as a render label.

## The four pieces (mirror Phase 122's five reliability rules)

1. **The contract is the single source of truth.** `connector:` frontmatter on each skill/command is where wiring lives - never hardcoded in the orchestrator.
2. **`data/connector-registry.json` is GENERATED + CI-checked.** A generator (mirror `scripts/build-command-registry.cjs`) walks every skill/command frontmatter, emits the registry, and a `--check` tripwire (pre-commit + a Feynman/run-all suite) makes drift impossible to commit. Validates: every `reach_id` is one of the 5; every `framework` resolves via `commandsForFramework()` (the WFL-01 name-drift guard); every `posture` is one of the 3; no duplicate (sensor, reach, sub_mode) collisions.
3. **The spine is the only reader.** The `intelligence-orchestrator` reads `connector-registry.json` (never a hardcoded table) -> on a fired sensor, looks up the connectors whose `sensor_triggers` match -> arbitrates by `hierarchy_rank` (one-reach-per-beat) -> surfaces the chosen connector as its `surface` Decision Gate -> on APPROVE resolves `framework` via the resolver, fires, files via `filing`, reads back.
4. **Degrade-don't-fabricate, everywhere.** A connector whose framework returns no command -> "run it manually". A sensor with no matching connector -> nothing fires (silent, honest). A surface with `connects_to_spine` absent -> legacy, untouched until retrofitted. No invented commands, no invented reaches.

## Retrofit (the "some need updating, some adjusting")

- **New skills/commands:** declare `connector:` -> auto-join. Zero spine edit. A CI rule can WARN when a new methodology command ships without a `connector:` block (opt-in nudge, not a hard block).
- **Existing surfaces:** retrofitted incrementally. The Phase-143.2 PUSH families (the 6 in the routing table) are the FIRST retrofit set (they already have framework names from Phase 122). The ~70 other commands + the skills get `connector:` as they are touched, OR in a dedicated retrofit sweep. Priority: the algorithmic cohort (RS / HSI / whitespace / analogies / connections / hats / research) first - the ones the orchestrator routes today.

## Structural question (for the navigator)

This is FOUNDATIONAL and cross-cutting (every skill + command), bigger than 143.2's orchestrator. Two shapes:
- **(A) Own phase - the Connector Spine** (e.g. a sibling to Phase 122). It ships: the `connector:` frontmatter contract, the generator + CI tripwire, the registry, and the retrofit of the algorithmic cohort. The 143.2 intelligence-orchestrator becomes its FIRST CONSUMER (reads the registry). Cleanest; mirrors how Phase 122 was its own phase.
- **(B) Fold the contract into 143.2.** The orchestrator + the contract ship together; the registry is generated from the 6 PUSH connectors first; the broader retrofit follows. Faster to a working spine, but mixes the foundational contract with the milestone phase.

In BOTH: the orchestrator reads the registry (not a hardcoded table); the routing table doc becomes a derived view; Phase 122's resolver is reused as the framework->command door.

## Why this is the moat (Canon / MWP)

Per CLAUDE.md MWP mandate: "every feature must connect to the cascade pipeline; does it generate or consume edges?" The Connector Contract makes that STRUCTURAL - a surface is either wired (declares its connector, participates in the spine) or explicitly legacy. The integration of all surfaces on one spine IS the moat (Ashby's Law: requisite variety on a single nervous system). A competitor can copy a skill; copying the self-extending spine that knows when+how every skill fires is the hard part.
