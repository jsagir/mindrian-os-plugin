# 2026-08-20 HANDOFF: Brain dev team, Gate 0 diagnostic (email body, v4 final)

> **What this is:** the verbatim body of the Gmail draft sent to the Brain dev team on
> 2026-08-20. Kept in the repo so the finding travels as a tracked file rather than living only
> in an inbox (`.planning/` is gitignored and does not cross machines).
> **Supersedes:** three earlier drafts. v1 argued a sequence inversion that was wrong. v2 fixed
> the graph findings but referenced Phases 253/256, retired the same day (commit `d4998583`).
> v3 fixed the phase refs but dropped v1's governance section and inline queries. v4 is complete.
> **Companion artifacts:** `.planning/debug/brain-gate0-diagnostic-260820.md` (full evidence),
> `.planning/phases/260-*/260-RESEARCH.md`, `.planning/phases/261-*/261-RESEARCH.md`,
> `.planning/seeds/SEED-079-brain-identifier-corruption-and-role-blind-extraction.md`.
> **Status update (same day, after this doc was written):** item 2 in section 10 below said
> "confirm the archived block folds into 258 RECON-01" because nothing auto-fed this finding to
> that phase's planner -- 258's CONTEXT.md/DISCUSSION-LOG.md predate this diagnostic and never
> listed it as a canonical ref. That gap is now closed: Phase 258's plan-phase run (in progress
> as of this update) was handed this file, `SEED-079`, and `260`/`261-RESEARCH.md` directly via
> cross-session message, and is folding the 28000-29000 block into RECON-01's task breakdown
> before `PLAN.md` locks. Still genuinely open: whether this is the SAME event as the
> 2026-08-11/12 wave RECON-01 already names, or a separate older one -- that's what RECON-01's
> own census-diff work resolves, not something to settle here. The body below is otherwise
> unchanged and still verbatim v4.

---

Team,

Final version of today's Gate 0 handoff. Three earlier drafts exist; ignore all of them. v1
argued a sequence inversion that turned out to be wrong. v2 fixed the graph findings but still
referenced Phases 253 and 256, which were RETIRED later the same day (commit d4998583) and
replaced by 258-263. v3 fixed the phase references but dropped v1's governance section and its
inline queries. This version carries everything.

All of it is read-only. No graph writes were made.

```
  Full artifact:      MindrianOS-Plugin  .planning/debug/brain-gate0-diagnostic-260820.md
  Phase research:     .planning/phases/260-.../260-RESEARCH.md, 261-.../261-RESEARCH.md
  Unowned finding:    .planning/seeds/SEED-079-brain-identifier-corruption-and-role-blind-extraction.md
  Reasoning trail:    rethinking-mindrianos  research/2026-08-20-gate0-live-diagnostic/
```

## 1. GATE 0: BROKEN, CONFIRMED

```
  :Framework labelled nodes                                    186    (expected ~750)
  Concept nodes self-declaring "is an innovation framework"     100
    ... also carrying :Archived                                  99
    ... inside contiguous id block 28000-29000                   95

  Total nodes / relationships                       29,112 / 24,422
  Nodes with "<SEP>" inside .name                              327
  Nodes with .name over 200 chars                              325
  :Archived nodes (all)                                        602

  Duplicate name clusters (name < 60 chars)                    823
  Nodes inside those clusters                                1,727
  Clusters SPLIT on the :Framework label                        51
    ... already carrying ALIAS_OF edges                         40
    ... with no alias edges at all                              11
  Clusters with NO :Framework copy at all                      772

  MindrianCommand nodes                                        112
  Commands reaching ZERO :Framework                             59    (53%)
    ... rescued by traversing ALIAS_OF 1-2 hops                  0
  Commands with no outgoing edges at all                         9

  TOTAL USES_FRAMEWORK edges in the whole graph                 86
    ... already landing on a real :Framework                    75
    ... landing on an unlabelled target                         11
    ... landing on an :Archived target                           0
```

## 2. THE FINDING THAT MATTERS

99 of 100 demoted frameworks are ALSO archived, and 95 sit in ONE contiguous id block
(28000-29000).

A scattered relabel bug does not produce a contiguous block. A single batch operation does.

  a) The remediation candidate set is ~95 nodes in one identifiable block, NOT ~750
     scattered. That is a review list one person reads in a sitting.

  b) The higher-value action is finding the OPERATION, not triaging its output. Please check
     Brain repo history for whatever ran against ids 28000-29000 applying :Archived and
     stripping :Framework.

What is in the block: the core PWS methodology. Six Thinking Hats, TRIZ, Design Thinking,
Lean Startup, MECE, The Pyramid Principle, Cynefin, Four Lenses of Innovation, JTBD, Red
Teaming, Issue Trees, The Taxonomy of Problems, The PWS Value Proposition Framework.

TRIZ: not absent, not an uncurated stub. It is id 28666, [Archived, Method, Concept], with a
real description. "Promote TRIZ" is really "un-archive and relabel TRIZ with the other 94."
SAPPhIRE genuinely IS absent and does need creating.

## 3. THE PART THAT IS NOT NEGOTIABLE

No bulk mutation without a human-reviewed list first.

The 2026-02-05 relabel is what produced this state, and it happened because a bulk automated
relabel ran with no reviewed triage list. The existing remediation plan in
`.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md` (P1-2) already gets this right by
proposing a reviewed candidate list before any node gets its Framework label back, explicitly
rejecting a blind bulk re-add.

Anything we do here follows the same shape: propose, get sign-off, then execute.

Section 2 makes this cheaper, not optional. The candidate set is ~95 nodes in one block, which
is one page of review. There is no cost argument for skipping it.

For the 11 unaliased split clusters the merge decision is NOT mechanical. Someone has to decide
which copy survives and which properties win, because the copies carry different label sets and
different edges. Every schema-touching PR here also needs Canon Custodian review per the Part 8
PR gate (anything touching `mcp-server-brain/`, `lib/core/brain-*`, or an MCP tool that queries
the Brain).

## 4. WHY 53% OF COMMANDS REACH NO FRAMEWORK (and what will NOT fix it)

Three explanations tested. Two are false:

```
  NOT alias traversal.     Following ALIAS_OF 1-2 hops rescues ZERO of the 59.
  NOT mis-targeted edges.  Of 86 USES_FRAMEWORK edges graph-wide, 75 are already correctly
                           targeted and ZERO point at archived nodes. Relabelling the block
                           recovers at most 11 edges.
  IT IS SCARCITY.          86 edges exist for 112 commands. They were never authored.
```

Please reset expectations accordingly: a relabel pass will NOT move the 53% number
meaningfully. If it does not move, that is not the remediation failing. Authoring the edges
is what moves it.

## 5. TWO CORRECTIONS (both are conclusions you would reach independently)

**CORRECTION 1.** "823 duplicate clusters, 51 split on the Framework label, so we need a big dedup."
Overstated. This graph's model is ALIAS, NOT MERGE, established by the 2026-08-11
alias-collapse runbook. 40 of the 51 split clusters ALREADY carry ALIAS_OF edges. The real
remaining backlog is 11 clusters, not 823. A dedup plan sized off the raw count would be an
order of magnitude too big and would fight a model already chosen and already working.

**CORRECTION 2.** "The missing edges are attached to the duplicate copy that lost its label, so
dedup recovers them."
False. 86 edges exist total, 75 already correct, 0 on archived targets. No reservoir.

## 6. WHERE EACH FINDING NOW LIVES (253 and 256 are RETIRED)

**Archived batch + root-cause hunt -> 258 RECON-01.**
RECON-01 exists to attribute untracked writes via read-tier census diff plus the new
GRAPH-WRITE-LOG convention. It currently has no concrete target range. This gives it one.
Caveat: this block may predate the 2026-08-11/12 wave RECON-01 names, so confirm scope
before assuming they are the same event.

**Alias state, ALIAS_OF self-loops -> 260 FIX-02 and FIX-03.**
FIX-03's own research flag says the alias-aware normalizeName blast radius across four
name-matching readers has never been analyzed, and calls it the one sub-plan in 258-263
needing deeper research. Sections 1 and 4 are direct evidence for that matrix. One thing
the matrix will miss if built only from the 51 split clusters: 772 of the 823 clusters
have NO canonical copy at all, so that is the majority topology a reader actually meets.
The 11 unaliased clusters should be checked against FIX-02's self-loop fixture BEFORE any
new alias edges are minted, not after. Full detail: `260-RESEARCH.md`.

**Edge authoring, relabel, TRIZ -> 261 Enrichment Ceremony.**
All writes. Per 258 and 260, nothing lands before the reconcile and the pipeline fixes.
Relabelling before FIX-01 risks the same silent prop drops at scale. Full detail:
`261-RESEARCH.md`.

**Identifier corruption (327 `<SEP>`) -> UNOWNED. Filed as SEED-079.**
No phase in 258-263 covers it. Filed rather than dropped. Suggest folding into 263.

**ONE SEQUENCING NOTE for whoever plans 261:** relabelling recovers at most 11 of 86 edges and
rescues 0 of the 59 zero-framework commands. If the ceremony relabels AND authors edges in the
same logged operation, 262's floor movement will be unattributable, since only the edge
authoring can have caused it. Log them separately, ideally with a floor probe in between.

## 7. SECOND-ORDER: THE EXTRACTION PIPELINE ITSELF

Three label pathologies, one root: a pass that types by surface form rather than by role.

```
  Frameworks typed as Person:        every De Bono hat has an [Archived, Person, Concept]
                                     twin. Also minto pyramid, the golden circle,
                                     the braintrust, pws (problems worth solving).
  Frameworks typed as Organization:  Lean Startup, Lean Principles, Behavioral Economics,
                                     The Three Box Solution, Jobs to Be Done (JTBD).
  Identifier corruption:             327 nodes with whole paragraphs concatenated into .name
                                     via <SEP>, 325 names over 200 chars, plus noise promoted
                                     to first-class nodes ("A Framework", "A Model",
                                     "A Theory", ": [ Set_Theory_Validation").
```

"Minto Pyramid is a Person" and "name field holds three paragraphs" are the same failure at
different severities. Fix labels without fixing that pass and we re-fix labels after the next
ingest. This is the argument for FIX-03 being scoped generously rather than minimally, and it
is why SEED-079 exists.

## 8. ACCESS, VERIFIED TODAY

```
  Brain graph read                   WORKING
  ProblemsWorthSolving-Brain repo    ADMIN (auto-deploys to pws-brain-mcp on push to main)
  Render control plane               FULL (pws-brain-mcp pro/active, pws-brain-db std/active)
  Brain write over MCP               BLOCKED by the Part 8 egress guard, correctly
  Direct SSH / Bolt to pws-brain-db  NO KEY (address exists, credential does not)
```

Sanctioned path fully open: reviewed migration scripts committed to the Brain repo,
auto-deployed on push. That covers the relabel and the edge authoring. Only the queued surgical
one-offs (7 vector-index DROPs, the Nested Hierarchies 42214 self-loop DELETE) need the key,
because they are DDL and there is no HTTPS seam.

Vector indexes: 9 exist, only ONE in the live corpus space. `mindrian_methodology_vec` is
1024-dim and e5-queryable; the other 8 are foreign space (seven 384-dim: `concept_embeddings`,
`creativework_embeddings`, `entity_embeddings`, `framework_embeddings`, `person_embeddings`,
`product_embeddings`, `vector`; one 1536-dim: `mindrian_methodology_vec_openai`) and are not
queryable against the current corpus. Matches the DROP queue.

## 9. REPRODUCE IT YOURSELF

Label census:

```cypher
MATCH (n) UNWIND labels(n) AS l
RETURN l AS label, count(*) AS n ORDER BY n DESC LIMIT 30;
```

The keystone finding, the archived batch signature:

```cypher
MATCH (n:Concept) WHERE NOT n:Framework
  AND toLower(coalesce(n.name,'')) CONTAINS 'is an innovation framework'
WITH count(n) AS demoted,
     sum(CASE WHEN n:Archived THEN 1 ELSE 0 END) AS also_archived,
     min(id(n)) AS min_id, max(id(n)) AS max_id,
     sum(CASE WHEN id(n) >= 28000 AND id(n) <= 29000 THEN 1 ELSE 0 END) AS in_28k_block
RETURN demoted, also_archived, min_id, max_id, in_28k_block;
```

Edge scarcity, and the zero-archived-target proof:

```cypher
MATCH ()-[r:USES_FRAMEWORK]->(t)
RETURN count(r) AS total_edges,
       sum(CASE WHEN t:Framework THEN 1 ELSE 0 END) AS target_is_framework,
       sum(CASE WHEN NOT t:Framework THEN 1 ELSE 0 END) AS target_not_labelled,
       sum(CASE WHEN t:Archived THEN 1 ELSE 0 END) AS target_is_archived;
```

Alias traversal rescues nothing today:

```cypher
MATCH (c:MindrianCommand)
OPTIONAL MATCH (c)-[]->(d) WHERE d:Framework
WITH c, count(d) AS direct
OPTIONAL MATCH (c)-[]->(x)-[:ALIAS_OF*1..2]-(y) WHERE y:Framework
WITH c, direct, count(DISTINCT y) AS via_alias
RETURN count(c) AS total_commands,
       sum(CASE WHEN direct = 0 THEN 1 ELSE 0 END) AS zero_direct,
       sum(CASE WHEN direct = 0 AND via_alias > 0 THEN 1 ELSE 0 END) AS rescued_by_alias_hop;
```

Cluster sizing, and alias coverage across the 51 split clusters:

```cypher
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
```

Identifier corruption:

```cypher
MATCH (n)
WITH sum(CASE WHEN n.name CONTAINS '<SEP>' THEN 1 ELSE 0 END) AS sep_merged,
     sum(CASE WHEN n.name IS NOT NULL AND size(n.name) > 200 THEN 1 ELSE 0 END) AS over_200ch
RETURN sep_merged, over_200ch;
```

The full 51-cluster list with node ids is in section 7 of the `.planning/debug` artifact. Say the
word and I will send the full 823-cluster dump; it is a read, it costs nothing.

## 10. WHAT I NEED FROM YOU

1. Someone to check Brain repo history for what ran against ids 28000-29000. Highest value
   item here, and the only one that stops this recurring.
2. Confirm the archived block folds into 258 RECON-01, and whether it is the same event
   RECON-01 already names or a separate older one.
3. Acknowledge the expectation reset in section 4, so nobody reads a flat 53% as failure.
4. An owner and a survivor rule for the 11 unaliased split clusters.
5. Confirm "poverty" (id 27031, currently [Concept, Framework]) should be DEMOTED, not
   aliased upward. That is a mislabel in the opposite direction.
6. Provision an SSH key for pws-brain-db if the index DROPs ride the 261 window.
7. Decide whether identifier corruption (SEED-079) gets an owner now or folds into 263.

Thanks,
Jonathan
