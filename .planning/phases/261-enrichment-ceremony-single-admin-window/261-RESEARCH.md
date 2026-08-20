# Phase 261: Enrichment Ceremony - Research

**Researched:** 2026-08-20
**Domain:** Brain graph write scope for the single admin window: framework relabel set, `USES_FRAMEWORK` edge scarcity, TRIZ/SAPPhIRE status, vector-index cleanup
**Confidence:** HIGH for every count (reproduced live against pws-brain-db this session, read-only). No writes attempted beyond one probe, correctly blocked by the Part 8 guard.
**Source of record:** `.planning/debug/brain-gate0-diagnostic-260820.md` (full artifact, all queries, section 8)

## Summary

This phase inherits the writes that Phases 253 and 256 used to own before they were retired. Live measurement changes the size of one of them, changes the nature of another, and resets what the 262 floor run can be expected to show.

**The relabel set is far smaller than planned, and it is contiguous.** Gate 0 is broken: `:Framework` is **186** against an expected ~750. But **99 of the 100 demoted frameworks also carry `:Archived`, and 95 sit in the contiguous id block 28000-29000**. That is the signature of a single batch operation, not a scattered relabel bug. The remediation candidate set is therefore roughly **95 to 100 nodes in one identifiable block**, not 750 scattered, which is small enough for a full human review list and removes any argument for a bulk automated relabel. (The root-cause hunt for what ran against that block belongs to 258 RECON-01, not here.)

**The edges are genuinely absent, not misplaced, and they are the only thing that moves the product metric.** Graph-wide there are only **86 `USES_FRAMEWORK` edges** for **112 `MindrianCommand` nodes**. Of those 86: **75 already land on a properly labelled `:Framework`**, 11 land on unlabelled targets, and **0 land on an archived node**. Meanwhile **59 of 112 commands (53%) reach zero frameworks**, and traversing `ALIAS_OF` 1 to 2 hops rescues **zero** of them. Nine commands have no outgoing edges of any kind.

## The expectation reset this phase must carry into 262

**Relabelling the archived block will recover at most 11 edges and will rescue 0 of the 59 zero-framework commands.**

This is the single most important line in this document. The 53 percent figure is the visible product symptom, and the intuitive fix (restore the `:Framework` labels) does not touch it, because the edges pointing at those nodes do not exist in the first place. Zero `USES_FRAMEWORK` edges currently target an archived node.

Two consequences for planning:

1. **Do not treat a flat 53 percent after the relabel as the remediation failing.** It is the predicted outcome. Authoring edges is what moves it.
2. **If this window both relabels the block AND authors edges, log the two operations separately**, or 262's floor movement will be unattributable. Only the edge authoring can move it, so a combined write with a single log entry destroys the ability to confirm that prediction afterwards. A separate before/after floor probe between the two operations would settle it cheaply.

## What is in the relabel block

The core PWS methodology. Six Thinking Hats, TRIZ, Design Thinking, Lean Startup, MECE, The Pyramid Principle, The Cynefin Framework, Four Lenses of Innovation, Jobs to Be Done (JTBD), Red Teaming, Pattern Recognition, Issue Trees, Causal Loop Diagrams, Problems Worth Solving, The PWS Value Proposition Framework, The Taxonomy of Problems, The Opportunity Bank Framework, White Space Analysis, Human-Centered Design, Effectuation, Open Innovation.

**TRIZ correction (was Phase 256's "promote TRIZ from uncurated stub").** TRIZ is neither absent nor a stub. It is **id 28666**, labelled `[Archived, Method, Concept]`, carrying a real description. The correct action is "un-archive and relabel TRIZ along with the other 94 in the same block", which means it is not separate work at all. **SAPPhIRE genuinely is absent** and still needs creating as net-new content.

## Ordering constraints inherited from 258 and 260

- **No write lands before the reconcile (258) and the pipeline fixes (260).** In particular, relabelling before FIX-01 (additive framework-level props applied to live nodes) risks the same silent prop drops this milestone is fixing, at the scale of a ~95-node batch.
- **The 2026-02-05 precedent is the standing reason nothing bulk runs unreviewed.** Since the candidate list here is one page, there is no cost argument for skipping review. Propose, sign off, then execute.
- **Alias work is 260's, not this phase's.** 40 of the 51 `:Framework`-split clusters already carry `ALIAS_OF` edges; the 11 that do not should be checked against FIX-02's self-loop fixture before any new alias edges are minted. See `260-RESEARCH.md`.

## Vector index cleanup (rides this window if the SSH key exists)

`pws-brain-db` carries **9 vector indexes, of which only ONE is in the live corpus space**. `mindrian_methodology_vec` is 1024-dim and e5-queryable. The other 8 are foreign space (seven at 384-dim: `concept_embeddings`, `creativework_embeddings`, `entity_embeddings`, `framework_embeddings`, `person_embeddings`, `product_embeddings`, `vector`; one at 1536-dim: `mindrian_methodology_vec_openai`) and are not queryable against the current corpus. Consistent with the standing 7-DROP queue plus the Nested Hierarchies 42214 self-loop DELETE.

**Access blocker:** these are DDL and there is no HTTPS seam. The Bolt/SSH address exists (`srv-d9geq2urnols73cimkfg@ssh.oregon.render.com`) but **no SSH key is provisioned**. If the DROPs are to ride this window, the key is a prerequisite, not a step.

## Access verified this session

| Path | Status |
|---|---|
| Brain graph read (MCP) | WORKING |
| `ProblemsWorthSolving-Brain` repo | ADMIN, auto-deploys to `pws-brain-mcp` on push to main |
| Render control plane | FULL |
| Brain write over MCP | BLOCKED by the Part 8 egress guard, correctly |
| Direct SSH / Bolt to `pws-brain-db` | NO KEY |

The sanctioned write path (reviewed migration scripts committed to the Brain repo, auto-deployed on push) is fully open and is sufficient for the relabel and the edge authoring. Only the index DROPs need the key.

## Reproduce

```cypher
-- the relabel set: contiguous archived block
MATCH (n:Concept) WHERE NOT n:Framework
  AND toLower(coalesce(n.name,'')) CONTAINS 'is an innovation framework'
WITH count(n) AS demoted,
     sum(CASE WHEN n:Archived THEN 1 ELSE 0 END) AS also_archived,
     min(id(n)) AS min_id, max(id(n)) AS max_id,
     sum(CASE WHEN id(n) >= 28000 AND id(n) <= 29000 THEN 1 ELSE 0 END) AS in_28k_block
RETURN demoted, also_archived, min_id, max_id, in_28k_block;

-- edge scarcity, and the zero-archived-target proof
MATCH ()-[r:USES_FRAMEWORK]->(t)
RETURN count(r) AS total_edges,
       sum(CASE WHEN t:Framework THEN 1 ELSE 0 END) AS target_is_framework,
       sum(CASE WHEN NOT t:Framework THEN 1 ELSE 0 END) AS target_not_labelled,
       sum(CASE WHEN t:Archived THEN 1 ELSE 0 END) AS target_is_archived;

-- the product symptom this phase is expected to move
MATCH (c:MindrianCommand)
OPTIONAL MATCH (c)-[r]->(f) WHERE f:Framework
WITH c, count(r) AS fw_edges
RETURN count(c) AS total_commands,
       sum(CASE WHEN fw_edges = 0 THEN 1 ELSE 0 END) AS zero_framework_commands,
       avg(fw_edges) AS mean_edges;
```

## Open questions for the planner

1. Are relabel and edge-authoring logged as separate operations inside the window, so 262's movement is attributable? Recommended: yes, with a floor probe between them.
2. Who signs off the ~95-node relabel list, and is the sign-off recorded in the runbook or only in the commit?
3. Does the SSH key get provisioned in time for the index DROPs, or do they carry to 263?
4. SAPPhIRE definition: approve as drafted in the complete-system-loop brief (Chakrabarti et al. 2005, the State-Action-Parts-Phenomena-Physics-Input-oRgan-Effect causal chain), or revise?
5. `poverty` (id 27031) currently carries `[Concept, Framework]`. That is a mislabel in the opposite direction. Confirm demotion rather than leaving it in the Framework population.
