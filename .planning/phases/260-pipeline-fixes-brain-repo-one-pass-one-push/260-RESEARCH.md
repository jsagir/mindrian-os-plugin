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

## Open questions for the planner

1. Does the FIX-03 matrix cover the no-canonical-copy case (772 of 823 clusters), or only the split case (51)?
2. Are the 11 unaliased split clusters FIX-02's verification set, or separate work with its own owner?
3. Does any reader intentionally NOT traverse `ALIAS_OF`, and if so, is that recorded as a decision or is it incidental?
