# Phase 260: Pipeline Fixes - Research

**Researched:** 2026-08-20
**Domain:** Brain graph alias topology (`ALIAS_OF`), `normalizeName` reader blast radius (FIX-03), self-loop minting surface (FIX-02)
**Confidence:** HIGH for every count (all reproduced live against pws-brain-db this session, read-only). MEDIUM for the FIX-03 recommendation, which is an inference from the topology rather than a code read of all four readers.
**Source of record:** `.planning/debug/brain-gate0-diagnostic-260820.md` (full artifact, all queries, section 8)
**Scope note:** this research covers FIX-02 and FIX-03 only. It says nothing about FIX-01 or FIX-04.

## Summary

**FIX-03's research flag is correct to exist, and the topology makes the case sharper than the ROADMAP entry does.** The ROADMAP says the alias-aware `normalizeName` blast radius across four name-matching readers "has never been analyzed" and calls it the one sub-plan in 258-263 needing deeper research. Live measurement supports treating it as the highest-leverage item in this phase, for a reason the entry does not yet state: **the alias edges are already dense, and a reader that does not traverse them gets nothing from any of that work.**

Measured this session:

- **823 duplicate name clusters** (name < 60 chars), covering **1,727 nodes**.
- **51 clusters are split on the `:Framework` label**: the same concept exists 2 to 4 times and typically exactly ONE copy carries `:Framework`, while siblings carry `Product`, `Event`, `DictionaryTerm`, `Tool`, `Person`, or `Organization`.
- **40 of those 51 already carry `ALIAS_OF` edges.** Only **11 have none at all.**
- **Traversing `ALIAS_OF` 1 to 2 hops rescues ZERO of the 59 commands that reach no `:Framework`.**

That last line is the finding. The alias layer is roughly 78 percent applied on the split set, and it currently buys the product nothing, because no consumer follows the edge. FIX-03 is therefore not a tidy-up. It is the step that activates work already done and paid for by the 2026-08-11 alias-collapse session.

## What this means for FIX-03 scoping

**Scope generously, not minimally.** The direct-match branch being alias-unaware is one symptom. The general shape is: **every name-matching reader must decide, explicitly, whether it resolves through `ALIAS_OF` or not**, and the before/after matrix should record that decision per reader rather than only measuring match-count deltas.

Concretely, the matrix should answer for each of the four readers plus the dedup write-path consumer:

1. Does it currently traverse `ALIAS_OF`? (Measured answer for the command-to-framework path: no.)
2. Should it, given what it is for?
3. If yes, at what hop depth, and what happens on a 2-hop chain where the intermediate node is itself an alias? The 2026-08-11 session already hit this exact case: `Scenario Analysis` (46099) would have stranded in a broken 2-hop chain once `34086` itself became an alias. That is a live precedent, not a hypothetical.
4. What is the behaviour on a cluster with NO canonical (`:Framework`-bearing) copy? **772 of the 823 clusters have no `:Framework` copy at all**, so this is the common case, not the edge case.

Item 4 is the one most likely to be missed. A matrix built only from the 51 split clusters would test the minority topology.

## What this means for FIX-02

The 11 split clusters carrying no alias edges are the remaining un-aliased backlog. **They should be checked against FIX-02's self-loop RCA fixture before any new `ALIAS_OF` edge is minted for them**, not after. The 42214 self-loop exists because a minting path had no `id(a) <> id(canon)` guard; minting 11 more clusters' worth of edges through an unfixed path is how a second 42214 appears.

Ordering implication inside this phase: FIX-02's guard should land before anything authors alias edges for those 11, and the 11 should be treated as FIX-02's live verification set rather than as separate work.

## Correction to a reading this phase might otherwise inherit

An earlier reading of the same data concluded "823 duplicate clusters, so this graph needs a large dedup pass." **That is wrong and this phase should not inherit it.** This graph's remediation model is **alias, not merge**, established by the 2026-08-11 alias-collapse runbook. Sizing a dedup workstream off the raw 823 would be an order of magnitude too large and would fight a model already chosen and already working.

Related correction, relevant because it changes what FIX work can be expected to deliver: the "missing `USES_FRAMEWORK` edges" are **not** hiding on the wrong duplicate copies. Graph-wide there are only **86** such edges, **75** already correctly targeted, **11** on unlabelled targets, **0** on archived targets. There is no reservoir to recover. See `261-RESEARCH.md`.

## Reproduce

```cypher
-- alias coverage across the 51 split clusters
MATCH (n) WHERE n.name IS NOT NULL AND size(n.name) < 60
WITH toLower(trim(n.name)) AS key, count(*) AS c,
     sum(CASE WHEN n:Framework THEN 1 ELSE 0 END) AS fw, collect(n) AS nodes
WHERE c > 1 AND fw > 0 AND fw < c
UNWIND nodes AS m
OPTIONAL MATCH (m)-[a:ALIAS_OF]-()
WITH key, c, fw, m, count(a) AS aliases
WITH key, c, fw, sum(CASE WHEN aliases > 0 THEN 1 ELSE 0 END) AS aliased
RETURN count(key) AS split_clusters,
       sum(CASE WHEN aliased = 0 THEN 1 ELSE 0 END) AS no_alias_edges_at_all,
       sum(CASE WHEN aliased > 0 THEN 1 ELSE 0 END) AS partially_aliased;

-- alias traversal rescues nothing today
MATCH (c:MindrianCommand)
OPTIONAL MATCH (c)-[]->(d) WHERE d:Framework
WITH c, count(d) AS direct
OPTIONAL MATCH (c)-[]->(x)-[:ALIAS_OF*1..2]-(y) WHERE y:Framework
WITH c, direct, count(DISTINCT y) AS via_alias
RETURN count(c) AS total_commands,
       sum(CASE WHEN direct = 0 THEN 1 ELSE 0 END) AS zero_direct,
       sum(CASE WHEN direct = 0 AND via_alias > 0 THEN 1 ELSE 0 END) AS rescued_by_alias_hop;

-- the majority topology FIX-03 must handle: clusters with no canonical copy
MATCH (n) WHERE n.name IS NOT NULL AND size(n.name) < 60
WITH toLower(trim(n.name)) AS key, count(*) AS c,
     sum(CASE WHEN n:Framework THEN 1 ELSE 0 END) AS fw
WHERE c > 1
RETURN count(key) AS clusters, sum(CASE WHEN fw = 0 THEN 1 ELSE 0 END) AS no_framework_copy;
```

## Live update (same day, from a session working directly in the ProblemsWorthSolving-Brain repo)

A live re-derivation (case-insensitive check of all 186 `:Framework` nodes against every other node, keeping only pairs with no existing `ALIAS_OF` edge in either direction) **corrects this document's "11 unaliased split clusters" figure to 18.** 16 are resolved in a drafted (not executed, not committed) payload: `payloads/relabel-fix-260820/` in the Brain repo (`90-dry-run.cypher`, `01-demote-poverty.cypher`, `02-alias-unaliased-clusters.cypher`, `91-verify.cypher`, `99-undo.cypher`, batch id `pws-relabelfix-2026-08-20`). Follows the repo's live payload convention (`payloads/chunk-document-repair` etc.), not the older `scripts/migrations/*.mjs` pattern (targets a retired Neo4j HTTP endpoint per the Brain repo's own CLAUDE.md).

**2 residue clusters need a human survivor rule before this phase's alias work touches them:**
- **"Jobs To Be Done"** (id 45915, `[Concept, Tool]`) -- 6 candidate Framework-labeled JTBD variants already exist (32292, 28579, 31103, 18102, 34335, 26521). Picking one without a stated rule relocates the JTBD-x5 duplication problem `scripts/migrations/03-fix-framework-gaps.mjs` already flagged once.
- **"The Pyramid Principle"** (id 39014, `[Book]`) -- an entity-type mismatch, not a duplicate: a book/citation node, not a second copy of the framework concept. Recommended: a `DESCRIBES` or `SOURCE_FOR` edge instead of `ALIAS_OF` -- flagged as a schema call this payload does not make unilaterally.

Also confirms **item 5 of the v4 Gate-0 handoff** ("poverty," id 27031): CONFIRMED demote, don't alias -- it already carries an `ALIAS_OF` edge to id 37406 (`alias_backfilled_at: 2026-08-18`, mechanism `case-variant-w2a`). The payload's `01-demote-poverty.cypher` implements exactly this.

**11 vs 18, resolved: not a contradiction, two different units of counting -- name the one this phase actually needs.** The diagnostic's original 11 counts at the CLUSTER level: a cluster only counts as "unaliased" if NO member carries any `ALIAS_OF` edge to anyone. The corrected 18 counts at the PAIR level: whether the specific `:Framework` node and its specific same-name twin are linked to EACH OTHER. Example -- "Root Cause Analysis" has 3 nodes: 27593 (`:Framework`), 37820 (`Product`, aliased TO 27593), 46909 (`Concept`, aliased to nothing). The cluster-level count sees one aliased member, calls the whole cluster "partially aliased," and drops it from the 11. The pair-level count sees 46909 specifically unlinked and keeps it in the 18. **For THIS phase's actual work (minting the missing links), the 18 is the right number** -- it is "which specific node still needs a link," not "which cluster needs someone's glance." The 11 is closer to a triage metric (how many clusters need attention at all) than a work list. FIX-02/FIX-03's task breakdown and the drafted payload's edge count should be sized off 18, not 11.

**New hard precondition on the drafted payload, not just a nice-to-have:** the payload mints 16 new `ALIAS_OF` edges and has NOT yet been checked against FIX-02's self-loop fixture (the `id(a) <> id(canon)` guard that prevents a second 42214). This is now a blocking precondition before `02-alias-unaliased-clusters.cypher` runs, not something resolved by team sign-off alone -- flagged directly in the payload's own manifest by the session that drafted it.

**Root-cause hunt for the 28000-29000 archived batch (258 RECON-01's task, cross-linked here since this phase inherits the same block via alias/relabel work): confirmed DEAD END.** Both locally-available Brain repo histories checked (`ProblemsWorthSolving-Brain`, earliest commit 2026-07-22; `mindrian-brain-local`, earliest commit 2026-07-16) -- neither reaches back to 2026-02-05. Not a committed migration script in either repo on this machine. If a record exists, it's in an Aura console audit log or a pre-repo environment.

## Open questions for the planner

1. Does the FIX-03 matrix cover the no-canonical-copy case (772 of 823 clusters), or only the split case (51)?
2. RESOLVED: the 18 (pair-level unlinked nodes) is FIX-02's verification set, not the original 11 (cluster-level, a different unit of counting -- see the live-update section above for why they're not a contradiction). 16 of the 18 already have a drafted resolution, gated on the self-loop-fixture precondition above; the 2 residue items need an explicit survivor rule first.
3. Does any reader intentionally NOT traverse `ALIAS_OF`, and if so, is that recorded as a decision or is it incidental?
