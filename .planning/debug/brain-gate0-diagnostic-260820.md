---
kind: qa-sweep
slug: brain-gate0-diagnostic-260820
title: "Gate 0 live diagnostic: confirmed broken, and the remediation set is one bounded archived batch, not ~750 scattered nodes"
date: 2026-08-20
status: open
severity: high
surface: brain-graph
repo: ProblemsWorthSolving-Brain
graph: BRAIN (pws-brain-db, Memgraph)
canon_parts: [8]
related_phases: [258, 259, 260, 261, 254, 257]
superseded_phase_refs: "253 and 256 were RETIRED on 2026-08-20 (commit d4998583) and replaced by 258-263. Section 11 re-points every finding in this document to the live phases."
related_docs:
  - .planning/2026-08-20-BRIEF-complete-system-loop.md
  - .planning/debug/brain-schema-entropy-and-cooccurs-bloat.md
  - docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md
  - ~/MindrianRooms/rethinking-mindrianos/research/2026-08-11-alias-collapse-live-audit/
method: read-only Cypher over the Brain MCP surface. No graph writes. One write probe attempted and correctly blocked by the Part 8 guard.
---

# Gate 0 live diagnostic (2026-08-20)

**Verdict: Gate 0 is BROKEN.** `:Framework` = 186 against an expected ~750.

**But the remediation set is much smaller and better bounded than the plan assumes**, and
two intuitions that looked obvious from the raw duplicate counts turned out to be WRONG when
checked against `ALIAS_OF` edges and actual edge counts. Both corrections are recorded in
section 5, because the wrong versions are the ones a reader would independently arrive at.

All numbers reproducible. Queries in section 8.

## 1. Headline census

| Metric | Value |
|---|---|
| Total nodes / relationships | 29,112 / 24,422 |
| `:Framework` labelled nodes | **186** |
| Concept nodes self-declaring "is an innovation framework" | **100** |
| ... also carrying `:Archived` | **99** |
| ... inside contiguous id block 28000-29000 | **95** |
| Nodes with `<SEP>` inside `.name` | 327 |
| Nodes with `.name` over 200 chars | 325 |
| `:Archived` nodes (all) | 602 |
| Duplicate name clusters (name < 60 chars) | 823 |
| Clusters split on `:Framework` label | 51 |
| ... of those, already carrying `ALIAS_OF` edges | **40** |
| ... with no alias edges at all | **11** |
| **Total `USES_FRAMEWORK` edges in the whole graph** | **86** |
| ... landing on a properly labelled `:Framework` | 75 |
| ... landing on an unlabelled target | 11 |
| ... landing on an `:Archived` target | **0** |
| `:MindrianCommand` nodes | 112 |
| Commands with zero edges reaching a `:Framework` | **59 (53%)** |
| ... rescued by traversing `ALIAS_OF` 1-2 hops | **0** |
| Commands with no outgoing edges at all | 9 |

## 2. The finding that actually reshapes Phase 253

**99 of the 100 demoted frameworks also carry `:Archived`, and 95 sit in the contiguous id
range 28000-29000.**

That is not the signature of a scattered relabel bug across ~750 nodes. It is the signature
of **a single batch operation against one ingestion block** that both stripped `:Framework`
and applied `:Archived`.

Practical consequence: the candidate set is **~95 to 100 nodes in one identifiable block**,
not 750 scattered. That is small enough for a human to read in one sitting, which removes
any argument for a bulk-automated relabel. The 2026-02-05 disaster happened because a bulk
mutation ran without a reviewed list. Here the reviewed list is one page.

**Higher-value action than triaging the output: find the operation.** Ask the Brain repo
history what ran against ids 28000-29000. That root cause is in no current phase.

**What is in the block:** the core PWS methodology. Six Thinking Hats, TRIZ, Design Thinking,
Lean Startup, MECE, The Pyramid Principle, The Cynefin Framework, Four Lenses of Innovation,
Jobs to Be Done (JTBD), Red Teaming, Pattern Recognition, Issue Trees, Causal Loop Diagrams,
Problems Worth Solving, The PWS Value Proposition Framework, The Taxonomy of Problems,
The Opportunity Bank Framework, White Space Analysis, Human-Centered Design, Effectuation,
Open Innovation.

**TRIZ correction for Phase 256:** TRIZ is NOT absent and NOT merely an uncurated stub. It
sits at **id 28666** as `[Archived, Method, Concept]` with a real description. Phase 256's
"promote TRIZ from stub to Framework" is really "un-archive and relabel TRIZ along with the
other 94 in the same block." **SAPPhIRE genuinely is absent** and does need creation.

## 3. The product symptom, and what does NOT explain it

**59 of 112 commands (53%) have zero edges reaching a `:Framework`.** Mean 0.64 framework
edges per command.

Three candidate explanations were tested. Two are false:

- **Not an alias-traversal problem.** Traversing `ALIAS_OF` 1-2 hops rescues **zero** of the
  59. The paths do not exist even with aliases followed.
- **Not a mis-targeted-edge problem.** Of 86 total `USES_FRAMEWORK` edges graph-wide, 75
  already land on properly labelled Frameworks, 11 land on unlabelled targets, and **0** land
  on archived nodes. Relabelling the archived block will therefore recover **at most 11
  edges**, not 59 commands.
- **It is a scarcity problem.** There are only **86 `USES_FRAMEWORK` edges in the entire
  graph** for 112 commands. The edges were never authored. Nine commands have no outgoing
  edges of any kind.

**So Phase 256's original framing was right and my first reading was wrong: the edges really
are missing and really do need authoring.** Relabelling alone will not move the 53% number
meaningfully.

## 4. Identifier corruption (P3), still real and still worth doing

327 nodes hold several whole paragraphs concatenated into `.name` with `<SEP>` separators.
325 names exceed 200 characters. Plus extraction noise promoted to first-class nodes:
`"A Framework"`, `"A Model"`, `"A Theory"`, `"A Deeper Analysis"`, `"A Targeted Analysis"`,
`": [ Set_Theory_Validation"`, `"Absurd Scenarios o Scenario Analysis"`,
`"Academic_review_framework"`.

This does not block relabelling, but it does degrade every lookup and every vector match,
and it makes any future merge decision unsafe. Worth its own workstream, not a blocker.

Sub-pathologies worth naming, both extraction-schema bugs:

- **Frameworks typed as `Person`.** Every De Bono hat has a `[Archived, Person, Concept]`
  duplicate alongside its `[Framework]` copy: `black hat analysis`, `green hat analysis`,
  `white hat analysis`, `yellow hat analysis`. Same for `minto pyramid`,
  `pws (problems worth solving)`, `the braintrust`, `the golden circle`.
- **Frameworks typed as `Organization`.** `Lean Startup`, `Lean Principles`,
  `Behavioral Economics`, `Hot Groups`, `Mission Innovation`, `The Three Box Solution`,
  `The Well-Defined Problem Framework`, `Jobs to Be Done (JTBD)`.

## 5. Two corrections, recorded deliberately

A reader looking at 823 duplicate clusters and 51 split-on-Framework clusters will reach
both of these conclusions independently. Both are wrong. Recording them so nobody re-derives
them.

**CORRECTION 1: "823 duplicate clusters need deduplication."**
Overstated. The 2026-08-11 alias-collapse session established that this graph's remediation
model is **alias, not merge** (`ALIAS_OF` edges linking variants to a canonical). **40 of the
51 split clusters already carry `ALIAS_OF` edges.** The duplication is substantially
intentional and already ~78% addressed on the split set. Only **11 split clusters have no
alias edges at all**, and those 11 are the real remaining work, not 823.
Source: `~/MindrianRooms/rethinking-mindrianos/research/2026-08-11-alias-collapse-live-audit/`.

**CORRECTION 2: "The missing USES_FRAMEWORK edges probably already exist on the wrong
duplicate copy."**
False, and measurably so. Only 86 such edges exist graph-wide and 75 are already correctly
targeted. There is no hidden reservoir of edges attached to the wrong copy. They were never
written.

**What this means for sequencing:** my initial instinct to invert the phase order (dedup
before relabel) does not survive. **Phase 253 -> 256 as currently ordered is defensible.**
What genuinely changes is 253's SCOPE (one bounded batch of ~95, plus a root-cause
investigation into what ran against that id block) and the expectation set on 256 (the edges
must be authored; relabelling recovers at most 11 of them).

## 6. Access verified this session

| Path | Status |
|---|---|
| Brain graph read (MCP) | WORKING |
| `ProblemsWorthSolving-Brain` repo | ADMIN, auto-deploys to `pws-brain-mcp` on push to main |
| Render control plane | FULL. `pws-brain-mcp` pro/active, `pws-brain-db` standard/active |
| Brain graph write over MCP | **BLOCKED by the Part 8 egress guard, correctly** |
| Direct SSH / Bolt to `pws-brain-db` | NO KEY. Address exists, credential does not |

Sanctioned path (reviewed migration scripts committed to the Brain repo, auto-deploy on push)
is fully open. Surgical one-offs still queued (7 vector-index DROPs, Nested Hierarchies 42214
self-loop DELETE) need an SSH key provisioned.

**Vector index state:** 9 indexes, only ONE in the live corpus space.
`mindrian_methodology_vec` is 1024-dim and e5-queryable. The other 8 are foreign space (seven
at 384-dim, one at 1536-dim OpenAI) and are not queryable against the current corpus.
Consistent with the standing DROP queue.

**The blocked write is evidence for Phase 257.** The guard fired because Claude Code's
`PreToolUse` matcher covers `mcp__*brain*`. The identical call on a host without MCP-scoped
tool hooks (Codex fires PreToolUse for Bash events only; ChatGPT connectors have no hook
surface) would not be blocked. See `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md`,
hole H3.

## 7. The 11 split clusters with NO alias edges (the real remaining dedup work)

The 51 split clusters are listed in full below with node ids; **40 already carry `ALIAS_OF`
edges and are largely handled**. A first task for whoever owns this is to identify which 11
have none and treat only those as open. The query in section 8 isolates them directly.

```
jobs to be done                                   4 copies, 1 fw   ids 26312 27265 28579 45915
disruptive innovation                             3 copies, 1 fw   ids 26914 45880 46707
feedback loops                                    3 copies, 1 fw   ids 27080 33253 46098
logic trees                                       3 copies, 1 fw   ids 18571 18644 28165
process mapping                                   3 copies, 1 fw   ids 24872 31112 44541
root cause analysis                               3 copies, 1 fw   ids 27593 37820 46909
scenario analysis                                 3 copies, 1 fw   ids 21362 37038 46099
scenario planning                                 3 copies, 1 fw   ids 32108 34086 39835
stock and flow diagrams                           3 copies, 1 fw   ids 21573 27206 45084
systems thinking                                  3 copies, 1 fw   ids 24231 27018 27648
adaptive leadership                               2 copies, 1 fw   ids 22138 23705
black hat analysis                                2 copies, 1 fw   ids 28676 42366
bono framework                                    2 copies, 1 fw   ids 28452 42155
causal loop diagrams                              2 copies, 1 fw   ids 30481 33525
changing terms of competition                     2 copies, 1 fw   ids 22025 24717
competitive advantage                             2 copies, 1 fw   ids 34161 46031
creative destruction                              2 copies, 1 fw   ids 34282 46713
cross-disciplinary thinking                       2 copies, 1 fw   ids 26293 33782
design thinking                                   2 copies, 1 fw   ids 23854 31161
diverge-converge model                            2 copies, 1 fw   ids 18045 22716
dominant design                                   2 copies, 1 fw   ids 21028 44038
dual-use technology                               2 copies, 1 fw   ids 24562 47154
futures wheel                                     2 copies, 1 fw   ids 21029 25430
green hat analysis                                2 copies, 1 fw   ids 28679 42388
issue trees                                       2 copies, 1 fw   ids 22190 28240
macro trends                                      2 copies, 1 fw   ids 33498 37143
minto pyramid                                     2 copies, 1 fw   ids 28711 38968
neo4j-powered pyramid logic assessment framework  2 copies, 1 fw   ids 30332 43608
ooda loop                                         2 copies, 1 fw   ids 30878 36476
outcome-driven innovation                         2 copies, 1 fw   ids 18103 30466
pain points                                       2 copies, 1 fw   ids 24897 26706
pattern recognition                               2 copies, 1 fw   ids 21617 29816
platform thinking                                 2 copies, 1 fw   ids 31142 33756
poverty                                           2 copies, 1 fw   ids 27031 37406
problems worth solving                            2 copies, 1 fw   ids 29484 37778
pws (problems worth solving)                      2 copies, 1 fw   ids 38305 40377
red teaming                                       2 copies, 1 fw   ids 18541 21995
reverse salient                                   2 copies, 1 fw   ids 18078 22141
scenario planning methodology                     2 copies, 1 fw   ids 18880 23450
structured trend extrapolation process            2 copies, 1 fw   ids 23571 30618
the braintrust                                    2 copies, 1 fw   ids 34350 46073
the flywheel                                      2 copies, 1 fw   ids 46069 46103
the golden circle                                 2 copies, 1 fw   ids 34498 46064
the innovation landscape                          2 copies, 1 fw   ids 36571 45274
the pyramid principle                             2 copies, 1 fw   ids 30242 39014
trend_detection_framework                         2 copies, 1 fw   ids 23098 45258
trending to the absurd                            2 copies, 1 fw   ids 21357 34061
value proposition                                 2 copies, 1 fw   ids 45894 45904
well-defined problem framework                    2 copies, 1 fw   ids 31368 37650
white hat analysis                                2 copies, 1 fw   ids 28457 42166
yellow hat analysis                               2 copies, 1 fw   ids 28677 42377
```

`poverty` (id 27031) carries `[Concept, Framework]`. That is a mislabel in the opposite
direction and should be reviewed for demotion, not aliased upward.

## 8. Reproduce

```cypher
-- P0: the archived batch signature (the keystone finding)
MATCH (n:Concept) WHERE NOT n:Framework
  AND toLower(coalesce(n.name,'')) CONTAINS 'is an innovation framework'
WITH count(n) AS demoted,
     sum(CASE WHEN n:Archived THEN 1 ELSE 0 END) AS also_archived,
     min(id(n)) AS min_id, max(id(n)) AS max_id,
     sum(CASE WHEN id(n) >= 28000 AND id(n) <= 29000 THEN 1 ELSE 0 END) AS in_28k_block
RETURN demoted, also_archived, min_id, max_id, in_28k_block;

-- Edge scarcity: only 86 exist, 75 already correct
MATCH ()-[r:USES_FRAMEWORK]->(t)
RETURN count(r) AS total_uses_framework_edges,
       sum(CASE WHEN t:Framework THEN 1 ELSE 0 END) AS target_is_framework,
       sum(CASE WHEN NOT t:Framework THEN 1 ELSE 0 END) AS target_not_labelled,
       sum(CASE WHEN t:Archived THEN 1 ELSE 0 END) AS target_is_archived;

-- Alias traversal rescues nothing
MATCH (c:MindrianCommand)
OPTIONAL MATCH (c)-[]->(d) WHERE d:Framework
WITH c, count(d) AS direct
OPTIONAL MATCH (c)-[]->(x)-[:ALIAS_OF*1..2]-(y) WHERE y:Framework
WITH c, direct, count(DISTINCT y) AS via_alias
RETURN count(c) AS total_commands,
       sum(CASE WHEN direct = 0 THEN 1 ELSE 0 END) AS zero_direct,
       sum(CASE WHEN direct = 0 AND via_alias > 0 THEN 1 ELSE 0 END) AS rescued_by_alias_hop;

-- Isolate the 11 split clusters with NO alias edges (the real dedup backlog)
MATCH (n) WHERE n.name IS NOT NULL AND size(n.name) < 60
WITH toLower(trim(n.name)) AS key, count(*) AS c,
     sum(CASE WHEN n:Framework THEN 1 ELSE 0 END) AS fw, collect(n) AS nodes
WHERE c > 1 AND fw > 0 AND fw < c
UNWIND nodes AS m
OPTIONAL MATCH (m)-[a:ALIAS_OF]-()
WITH key, c, fw, m, count(a) AS aliases
WITH key, c, fw, sum(CASE WHEN aliases > 0 THEN 1 ELSE 0 END) AS aliased
WHERE aliased = 0
RETURN key, c AS copies, fw AS framework_copies ORDER BY key;

-- Identifier corruption
MATCH (n)
WITH sum(CASE WHEN n.name CONTAINS '<SEP>' THEN 1 ELSE 0 END) AS sep_merged,
     sum(CASE WHEN n.name IS NOT NULL AND size(n.name) > 200 THEN 1 ELSE 0 END) AS over_200ch
RETURN sep_merged, over_200ch;
```

## 9. Open decisions

1. **Root cause.** What ran against id block 28000-29000, applying `:Archived` and stripping
   `:Framework`? Not in any current phase. Highest-value open question here.
2. **253 scope revision.** From "triage ~750 scattered" to "review ~95 in one block, plus the
   root-cause investigation." Sequence 253 -> 256 stands; scope changes.
3. **256 expectation reset.** The edges must be authored. Relabelling recovers at most 11 of
   86. Do not expect the 53% zero-framework-command number to move from relabelling.
4. **The 11 unaliased split clusters** need an owner and a survivor rule.
5. **`poverty` (27031)** confirm demotion rather than alias.
6. **SSH key for `pws-brain-db`** if the 7 index DROPs ride this pass.

## 11. Re-pointed to the live phase set (253 and 256 were retired mid-session)

This diagnostic was written against phases 253 and 256. Both were **RETIRED on 2026-08-20**
(commit `d4998583`) and replaced by 258-263 while this session was running. Nothing in
sections 1-9 changes; only the ownership does. Mapping:

| Finding | Was | Now | Why |
|---|---|---|---|
| **P0 archived batch** (99/100 archived, 95 in ids 28000-29000) | 253 | **258, RECON-01** | RECON-01 is scoped to attributing an untracked write wave via read-tier census diff plus a tracked GRAPH-WRITE-LOG convention. This is precisely that: an unattributed batch write, already id-bounded. RECON-01 currently has no concrete target range; this gives it one. Note the block may predate the 2026-08-11/12 wave RECON-01 names, so confirm scope before assuming they are the same event. |
| **Root-cause hunt** ("what ran against 28000-29000") | nowhere | **258, RECON-01** | Same reason. The GRAPH-WRITE-LOG convention exists to make exactly this answerable next time. |
| **Alias state** (40 of 51 split clusters already aliased; alias traversal rescues 0 of 59 commands) | 256 | **260, FIX-02 and FIX-03** | FIX-03's research flag says the alias-aware `normalizeName` blast radius across four name-matching readers has never been analyzed, and calls it the one sub-plan in 258-263 needing deeper research. This is live evidence for that matrix: aliasing is already dense on the split set, and a reader that does not traverse `ALIAS_OF` gets nothing from it. |
| **`ALIAS_OF` self-loops** | 256 | **260, FIX-02** | FIX-02 kills the self-loop minting path (42214 as RCA fixture). The 11 unaliased split clusters in section 7 should be checked against that fixture before any new alias edges are minted. |
| **Edge scarcity** (86 `USES_FRAMEWORK` total, 75 already correct, 0 archived targets) | 256 | **261 Enrichment Ceremony, and 262 floor baseline** | The edges need authoring inside the single admin window. Also resets what 262's floor run can be expected to show. |
| **Relabel of the ~95-node block** | 253 | **261 Enrichment Ceremony** | It is a write. Per 258/260, no write lands before the reconcile and the pipeline fixes. Relabelling before FIX-01 (additive props to live nodes) risks the same silent prop drops at scale. |
| **Identifier corruption P3** (327 `<SEP>`, 325 over 200 chars, noise nodes) | 253 | **unowned. Flag for 263 carry-folds** | No current phase covers it. It degrades every lookup and vector match and makes future merges unsafe. Should be filed as a carry-fold rather than silently dropped. |
| **Part 8 guard blocked write** | 257 | **257, unchanged** | Still gated on 254. Phase 259 ("Plugin-Side Gate Trust") is a DIFFERENT concern despite the similar name: it is 429 handling and floor-check honesty (TRUST-01/02), not Part 8 enforcement locus. 257 is not redundant with 259. |
| **TRIZ is id 28666, not absent** | 256 | **261** | Rides the relabel of the block. SAPPhIRE is genuinely absent and still needs creating. |
| **Vector index cleanup** (8 of 9 foreign space) | carried queue | **261** | Needs the SSH key. Same admin window. |

**One ordering consequence worth flagging to whoever plans 261.** Section 3 measured that
relabelling recovers at most 11 of 86 edges and rescues 0 of the 59 zero-framework commands.
So if the Enrichment Ceremony relabels the block AND authors edges in the same window, the
floor movement in 262 will be attributable to the edge authoring, not the relabel. Worth
sequencing or logging them separately inside the window if anyone wants to tell those two
effects apart afterwards.

## 10. Classification

**NEW FAILURE** for P0 (the archived-batch signature) and for the measured edge scarcity
(86 total, 0 archived targets, 0 alias rescues), neither previously quantified.
**KNOWN/TRACKED** for the label demotion itself
(`.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md`) and for the alias work
(2026-08-11 room entry). No ENV GAP. No fix applied. No graph writes made.
