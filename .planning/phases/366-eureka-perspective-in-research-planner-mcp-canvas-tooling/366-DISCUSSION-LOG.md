# Phase 366: Eureka becomes a perspective of the research planner; the MCP canvas tooling; one home for Claude model routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
**Areas discussed:** Retire the standalone runner; Canvas op shape for RS / HSI / whitespace / find-analogies / find-connections; Theo readiness: canon handles on nodes
**Not selected:** Egress: Jev runtime + Haiku pre-step (offered, not chosen; planning default recorded under Claude's Discretion)

---

## Retire the standalone runner

| Option | Description | Selected |
|--------|-------------|----------|
| Now, alias first | /mos:eureka becomes the quick-run alias on the perspective path; the old runner stays behind a legacy flag until the spike closes, then is deleted | ✓ |
| After the spike | /mos:eureka keeps the old runner until the spike picks a judge | |
| Delete it now | Remove the runner in this phase, no fallback | |

**User's choice:** Now, alias first.
**Notes:** Unprompted ruling during this area: "Eureka still a great action name, just not the engine."

| Option | Description | Selected |
|--------|-------------|----------|
| Perspective recall, offer only | Ambient producer calls the same substrate + recall and hands top candidates to the planner's ambient.cjs as an offer; no judge, fetch or filing in the background | ✓ |
| Keep the old ambient scorer until the spike | Title-only abs_diff ranking stays for one more phase | |
| Drop Eureka from the ambient run | Ambient runs the other four producers only | |

**User's choice:** Perspective recall, offer only.

| Option | Description | Selected |
|--------|-------------|----------|
| Planner filing, F.8 basket | filing.cjs, writeOpportunityNode (candidate, proposed), DERIVED_FROM edges, 355 stamp fields; bankStatements retires | ✓ |
| Keep bankStatements for Eureka | A second filer next to the planner's | |
| No banking this phase | Stop at verdicts and statements | |

**User's choice:** Planner filing, F.8 basket.

| Option | Description | Selected |
|--------|-------------|----------|
| You, blind, three 355 rooms | Same protocol and fixtures as Phase 355; comparable to 44.8% | ✓ |
| You, blind, one real room copy | Closer to production, no comparable baseline | |
| External labeler (Opus 5.5) first, you spot-check | Fastest; band reads from the spot-check n only | |

**User's choice:** You, blind, three 355 rooms.

---

## Canvas op shape for RS / HSI / whitespace / find-analogies / find-connections

**Notes:** The navigator added find-analogies and find-connections ("also find analogies, and cross-domain") mid-discussion; the area was widened from three perspectives to five.

| Option | Description | Selected |
|--------|-------------|----------|
| All five now | Every perspective contributes recall, template and falsifier; one shared judge / candidates / plan path; the router stubs go away | ✓ |
| Outward-facing three now, local two next | Whitespace, analogies, connections now; RS and HSI later | |
| Eureka + whitespace only, rest later | Prove the shape on two | |

**User's choice:** All five now.

| Option | Description | Selected |
|--------|-------------|----------|
| One perspective op set on research_run | perspective_recall / perspective_candidates / perspective_judge with a perspective enum; tool count stays 45 | ✓ |
| One MCP tool per perspective | Six tools; breaks the 45-tool pin and the bytes budget | |
| A single new tool: canvas_run | One new tool beside research_run; tool count 46 | |

**User's choice:** One perspective op set on research_run.

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap the existing engines as recall | rs-engine and hsi-engine keep their math behind the recall stage | |
| Re-derive them from the local graph too | RS from graph structure, HSI from lexical vs graph co-occurrence; no embeddings; 355 direction convention and floor ledger re-measured | ✓ |
| Recall only, no judge for RS/HSI this phase | Wrap, write the file, stop | |

**User's choice:** Re-derive them from the local graph too.

| Option | Description | Selected |
|--------|-------------|----------|
| Local recall, outward only through the planner | Same substrate; analogies add a SAPPhIRE template at the statement stage; connections add the Theo lateral check on resolved handles; web and Theo reach only as audited planner queries | ✓ |
| Keep their current external reach inside recall | Faster; recall egresses | |
| Local recall only, no outward reach this phase | Web and Theo legs return later | |

**User's choice:** Local recall, outward only through the planner.

---

## Theo readiness: canon handles on nodes

| Option | Description | Selected |
|--------|-------------|----------|
| At filing + a one-time backfill | artifact_file and the indexer resolve by the D-10 exact-match rule; a backfill does it once for existing rooms | ✓ |
| By entity-extract only | A proposed claim per artifact, ratified at a gate | |
| Backfill script only, no runtime write | New rooms drift until the script runs | |

**User's choice:** At filing + a one-time backfill.

| Option | Description | Selected |
|--------|-------------|----------|
| A Phase 343 statement | canon coverage joins graph-integrity-counts.cjs, doctor and SENS-19 | ✓ |
| Per-run field only | Stays in the run header | |
| Both, independently computed | Two numbers | |

**User's choice:** A Phase 343 statement.

| Option | Description | Selected |
|--------|-------------|----------|
| A local framework node + typed edge | One framework node per canon name, USES_FRAMEWORK edge through navigation.writeEdge | ✓ |
| A property on the thing | canon_handle string in properties | |
| Both: property now, edge in the backfill | | |

**User's choice:** A local framework node + typed edge.

| Option | Description | Selected |
|--------|-------------|----------|
| A navigator-ratified translation table | Per-room table; entries proposed locally, ratified at a gate | |
| Leave misses null; measure only | No translation this phase | |
| Ask Theo to propose names | Send the room term to Theo (flagged: breaks 355 D-10 and Part 8 as stated) | ✓ (initial) |

**User's choice:** Ask Theo to propose names. Claude pushed back on the Part 8 / 355 D-10 collision and asked for a ruling:

| Option | Description | Selected |
|--------|-------------|----------|
| Gated per term, navigator releases | A miss proposes the term on an F.8 card; only released terms go to Theo; the answer lands as a proposed translation entry; 355 D-10 amended for this one path; Part 8 holds | ✓ |
| Amend Part 8: room terms may go to Theo for names | Automatic, logged; a canon exception | |
| Revert to the translation table | No Theo lookup | |

**User's choice:** Gated per term, navigator releases.

Four more questions (navigator chose "More on Theo readiness"):

| Question | Options | Selected |
|---|---|---|
| Backfill scope | Every registered room, once, via doctor / Active room only, on first run / Opt-in per room | Every registered room, once, via doctor |
| Translation table home | references/canon-translations.md / .mindrian/canon-translations.json / Global ~/.mindrian | references/canon-translations.md |
| Theo check on an unresolved side | Stamp not_called, offer the gated release / Ask Theo with the one resolved side / Skip the pair | Stamp not_called, offer the gated release |
| framework-names.json currency | Release lockstep / Doctor warning when stale / Manual refresh | Release lockstep |

---

## Todos

All four matched todos were folded by the navigator (registry-drift gate keyed to F-shape; F7 rescope of 212/213 against registerCapability; deck slide-count on first pass; never git stash mid-merge). None is in the phase domain; CONTEXT.md records each as a constraint or a closing task.

## Claude's Discretion

The egress policy file (Jev at runtime, the Haiku pre-step); per-perspective budgets and ambient offer sizes; CLI door subcommand names; the legacy flag spelling; counter-metric pairs per stage.

## Deferred Ideas

The egress policy ruling itself; the semantic-index folder split (ADR-E12); Phase 367 (SEED-101) and Phase 368 (SEED-099); Phase 364 reuse of the same planner.
