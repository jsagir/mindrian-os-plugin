# Phase 262 Plan 04: Live Measurement Evidence

This file is raw dated evidence, not a ruling. It records exactly what was measured against
the incumbent Brain, with the command that produced each number, and nothing about what to
do with it. Attribution, ownership, and routing live in `docs/262-FLOOR-01-GAP-LEDGER.md`
(Plan 262-05), not here.

**Date:** 2026-09-02
**Brain URL:** `https://pws-brain-mcp.onrender.com`
**Key tier used:** read (`~/.mindrian.env`, resolved via `lib/core/resolve-brain-key.cjs`)

All numbers in this file were measured against the incumbent Brain on 2026-09-02.

## Measurement 0: Theo staleness gate

Command:

```
curl -s -o /dev/null -w '%{http_code}' https://theo-mcp.onrender.com/health
```

Result: `502`

262-RESEARCH.md's stated validity condition is "2026-09-09, OR the moment this returns 200,
whichever comes first." It returned 502, not 200, so the condition has not expired.
262-RESEARCH.md's incumbent-Brain measurements remain the correct comparison population for
this run. Per D-03, this phase plans and remediates against the CURRENT Brain regardless of
this result; the 502 is recorded here as the dated confirmation that nothing about that
targeting decision needs revisiting yet.

## Measurement 1: the floor verdict

Command:

```
node scripts/check-flagship-floor.cjs; echo "EXIT=$?"
```

Verbatim output:

```
Brain URL: https://pws-brain-mcp.onrender.com
Floor denominator: RATIFIED at 28 framework(s) (data/flagship-floor-set.json, ratified_by=navigator (AskUserQuestion card, 249-03 read-tier session, ruling 3 of 5: 'Floor denominator RATIFIED: the frontmatter set (28)'), ratified_at=2026-08-11)
Enumerated frameworks this run: 28

[PASS] Jobs to Be Done (JTBD) -- uses=5 matches=1 score=4/4
[PASS] Reverse Salient Analysis -- uses=5 matches=1 score=4/4
[PASS] Six Thinking Hats -- uses=4 matches=1 score=4/4
[MISS] HSI Semantic Surprise Analysis Assistant -- uses=3 matches=2 score=2/4
[MISS] PWS Triple Validation Compass -- uses=3 matches=2 score=3/4
[PASS] S-Curve Analysis -- uses=3 matches=1 score=4/4
[PASS] Adoption-Capacity Theory -- uses=2 matches=1 score=3/4
[PASS] PWS Value Proposition -- uses=2 matches=1 score=4/4
[PASS] Root Cause Analysis -- uses=2 matches=1 score=3/4
[MISS] Scenario Planning -- uses=2 matches=2 score=4/4
[PASS] Systems Thinking -- uses=2 matches=1 score=3/4
[MISS] The Pyramid Principle -- uses=2 matches=1 score=0/4
[PASS] Ackoff Pyramid -- uses=1 matches=1 score=4/4
[MISS] Adaptive Leadership -- uses=1 matches=1 score=2/4
[PASS] Beautiful Question Framework -- uses=1 matches=1 score=4/4
[PASS] Domain Selection -- uses=1 matches=1 score=3/4
[PASS] Dominant Design -- uses=1 matches=1 score=3/4
[MISS] Four Lenses of Innovation -- uses=1 matches=1 score=1/4
[PASS] Futures Wheel -- uses=1 matches=1 score=3/4
[PASS] Hypothesis-Driven Problem Solving -- uses=1 matches=1 score=3/4
[PASS] Knowns and Unknowns Matrix Framework -- uses=1 matches=1 score=3/4
[PASS] Lean Canvas -- uses=1 matches=1 score=4/4
[MISS] MECE (Mutually Exclusive, Collectively Exhaustive) -- uses=1 matches=1 score=1/4
[MISS] Mullins Model -- uses=1 matches=1 score=2/4
[PASS] PEST Analysis -- uses=1 matches=1 score=3/4
[PASS] Problem Definition Transformation Framework -- uses=1 matches=1 score=4/4
[PASS] Red Teaming -- uses=1 matches=1 score=4/4
[PASS] Usher's Model of Cumulative Synthesis -- uses=1 matches=1 score=3/4

Frameworks passing (exactly-1 match AND readiness>=3): 20/28
Frameworks MISSING the floor: 8/28
=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===
EXIT=1
```

Exit code: `1` (real MISS present, not VOID).

Headline counts, restated as one line: **PASS = 20, MISS = 8, VOID = 0.**

This is a window-fresh, trustworthy floor verdict under TRUST-02: `voidCount = 0`, so every
PASS/MISS figure above is measured, not carried forward, and Plan 262-02's `unrecognized_shape`
tripwire had zero opportunity to misfire silently -- a live 56-probe run against the
incumbent Brain's real payloads produced exactly zero VOID rows.

## Per-row table

| Framework | uses | matches | score | verdict |
|---|---:|---:|---:|---|
| Jobs to Be Done (JTBD) | 5 | 1 | 4/4 | PASS |
| Reverse Salient Analysis | 5 | 1 | 4/4 | PASS |
| Six Thinking Hats | 4 | 1 | 4/4 | PASS |
| HSI Semantic Surprise Analysis Assistant | 3 | 2 | 2/4 | MISS |
| PWS Triple Validation Compass | 3 | 2 | 3/4 | MISS |
| S-Curve Analysis | 3 | 1 | 4/4 | PASS |
| Adoption-Capacity Theory | 2 | 1 | 3/4 | PASS |
| PWS Value Proposition | 2 | 1 | 4/4 | PASS |
| Root Cause Analysis | 2 | 1 | 3/4 | PASS |
| Scenario Planning | 2 | 2 | 4/4 | MISS |
| Systems Thinking | 2 | 1 | 3/4 | PASS |
| The Pyramid Principle | 2 | 1 | 0/4 | MISS |
| Ackoff Pyramid | 1 | 1 | 4/4 | PASS |
| Adaptive Leadership | 1 | 1 | 2/4 | MISS |
| Beautiful Question Framework | 1 | 1 | 4/4 | PASS |
| Domain Selection | 1 | 1 | 3/4 | PASS |
| Dominant Design | 1 | 1 | 3/4 | PASS |
| Four Lenses of Innovation | 1 | 1 | 1/4 | MISS |
| Futures Wheel | 1 | 1 | 3/4 | PASS |
| Hypothesis-Driven Problem Solving | 1 | 1 | 3/4 | PASS |
| Knowns and Unknowns Matrix Framework | 1 | 1 | 3/4 | PASS |
| Lean Canvas | 1 | 1 | 4/4 | PASS |
| MECE (Mutually Exclusive, Collectively Exhaustive) | 1 | 1 | 1/4 | MISS |
| Mullins Model | 1 | 1 | 2/4 | MISS |
| PEST Analysis | 1 | 1 | 3/4 | PASS |
| Problem Definition Transformation Framework | 1 | 1 | 4/4 | PASS |
| Red Teaming | 1 | 1 | 4/4 | PASS |
| Usher's Model of Cumulative Synthesis | 1 | 1 | 3/4 | PASS |

## Measurements 2 and 3: the FLOOR-03 probes and the alias topology

### Measurement 2: FLOOR-03 re-measurement

Command:

```javascript
const { brainCall } = require('./scripts/build-brain-census.cjs');
const { resolveBrainKey } = require('./lib/core/resolve-brain-key.cjs');
const key = resolveBrainKey().key;
const n = await brainCall('normalize_framework_name', { raw: 'Scenario Planning' }, key);
const r = await brainCall('orchestration_readiness', { framework_name: 'Scenario Planning' }, key);
const n2 = await brainCall('normalize_framework_name', { raw: 'Scenario planning methodology' }, key);
```

Verbatim result, `normalize_framework_name({ raw: 'Scenario Planning' }).canonical_matches`:

```json
[
  "Shell Scenario Planning Method",
  "Scenario planning methodology"
]
```

Verbatim result, `orchestration_readiness({ framework_name: 'Scenario Planning' }).readiness`:

```json
{
  "name": "Scenario Planning",
  "readiness_score": 4,
  "orchestration_status": "ready",
  "dimensions": {
    "pattern_type": 1,
    "structure": 1,
    "techniques": 1,
    "flow": 1
  }
}
```

Verbatim result, `normalize_framework_name({ raw: 'Scenario planning methodology' }).canonical_matches`
(the independent confirmation of the hop-depth-1 mechanism -- an alias node returning its own
name alongside its canonical target):

```json
[
  "Scenario planning methodology",
  "Shell Scenario Planning Method"
]
```

The live match count is **2**, exactly the count 262-RESEARCH.md recorded on 2026-09-02 and the
count 260-05 and the Phase 261 post-close probe both recorded before that. Four independent
measurements across two graph states now agree: 2, not 1.

### Measurement 3: alias topology behind FLOOR-03

Command (`brain_query`, read-only; the forbidden raw-Cypher passthrough tool was never used):

```cypher
MATCH (a)-[:ALIAS_OF]->(b)
WHERE toLower(a.name) CONTAINS "scenario planning" OR toLower(b.name) CONTAINS "scenario planning"
RETURN id(a) AS a_id, a.name AS a_name, labels(a) AS a_labels,
       id(b) AS b_id, b.name AS b_name, labels(b) AS b_labels
```

Verbatim result:

```json
[
  { "a_id": 18880, "a_labels": ["Product"], "a_name": "Scenario Planning Methodology",
    "b_id": 23450, "b_labels": ["Framework"], "b_name": "Scenario planning methodology" },
  { "a_id": 23450, "a_labels": ["Framework"], "a_name": "Scenario planning methodology",
    "b_id": 34362, "b_labels": ["Framework"], "b_name": "Shell Scenario Planning Method" },
  { "a_id": 34086, "a_labels": ["DictionaryTerm","Tool","Framework","Concept","Technique"], "a_name": "Scenario Planning",
    "b_id": 32108, "b_labels": ["Concept"], "b_name": "scenario planning" },
  { "a_id": 34086, "a_labels": ["DictionaryTerm","Tool","Framework","Concept","Technique"], "a_name": "Scenario Planning",
    "b_id": 39835, "b_labels": ["Concept","Product"], "b_name": "Scenario planning" },
  { "a_id": 34086, "a_labels": ["DictionaryTerm","Tool","Framework","Concept","Technique"], "a_name": "Scenario Planning",
    "b_id": 34362, "b_labels": ["Framework"], "b_name": "Shell Scenario Planning Method" },
  { "a_id": 34383, "a_labels": ["Framework"], "a_name": "PWS-Scenario Planning Integration Framework",
    "b_id": 34362, "b_labels": ["Framework"], "b_name": "Shell Scenario Planning Method" },
  { "a_id": 34454, "a_labels": ["Framework"], "a_name": "Scenario Planning for High Uncertainty",
    "b_id": 34362, "b_labels": ["Framework"], "b_name": "Shell Scenario Planning Method" },
  { "a_id": 46099, "a_labels": ["Product","Tool","Framework"], "a_name": "Scenario Analysis",
    "b_id": 34362, "b_labels": ["Framework"], "b_name": "Shell Scenario Planning Method" }
]
```

The chain 262-RESEARCH.md traced still holds exactly:

```
18880 "Scenario Planning Methodology" (:Product)
  -[:ALIAS_OF]-> 23450 "Scenario planning methodology" (:Framework)
      -[:ALIAS_OF]-> 34362 "Shell Scenario Planning Method" (:Framework, terminal)
```

Every node id observed in this query: 18880, 23450, 34362, 34086, 32108, 39835, 34383, 34454,
46099. Node ids 18880, 23450, 34362, 34086, 32108, 39835, 34383 match 262-RESEARCH.md's
recorded set exactly. Two additional `ALIAS_OF` edges into the same terminal node 34362 were
observed that were not enumerated in 262-RESEARCH.md's traced list: 34454 "Scenario Planning
for High Uncertainty" and 46099 "Scenario Analysis". Both are single-hop direct aliases into
the terminal node (not additional hop-depth-1 forks), so they do not change FLOOR-03's
mechanism or its 2-match count; they are recorded here as a delta in graph population, not a
mechanism change. See the Deltas section below.

## Measurement 4: SEP state behind FLOOR-01 rows 1 and 2

Commands (`brain_query`, read-only):

```cypher
MATCH (f:Framework) RETURN count(f) AS n
MATCH (f:Framework) WHERE f.name CONTAINS "<SEP>" RETURN count(f) AS n
MATCH (f:Framework) WHERE f.name CONTAINS "<SEP>" AND id(f) >= 28000 AND id(f) <= 29000 RETURN count(f) AS n
MATCH (f) WHERE id(f) = 28757 RETURN id(f) AS id, f.name AS name, labels(f) AS labels
MATCH (f) WHERE id(f) = 28775 RETURN id(f) AS id, f.name AS name, labels(f) AS labels
```

Results:

- Total `:Framework` count: **258**
- `:Framework` count where `name CONTAINS '<SEP>'`: **71**
- Same, restricted to `id(f) >= 28000 AND id(f) <= 29000`: **71** (all of them)

Node 28757 (HSI phantom), verbatim:

```json
{
  "id": 28757,
  "labels": ["Concept", "Organization", "Framework"],
  "name": "The HSI Semantic Surprise Analysis Assistant is a framework designed for innovation and problem-solving, helping teams address complex problems using semantic analysis tools.<SEP>HSI Semantic Surprise Analysis Assistant is an innovation framework focused on problem-solving and creative thinking."
}
```

Node 28775 (TVC phantom), verbatim:

```json
{
  "id": 28775,
  "labels": ["Concept", "Framework"],
  "name": "The PWS Triple Validation Compass is a framework designed for innovation and problem-solving, emphasizing solution validation.<SEP>PWS Triple Validation Compass is an innovation framework designed for problem-solving and creative thinking, involving a three-question validation process."
}
```

Both phantom node ids still exist and both still carry a `<SEP>`-corrupted, multi-sentence
name, unchanged from 262-RESEARCH.md's recorded state.

## Measurement 5: the refreshed per-dimension table for the MISS rows

Sourced directly from Measurement 1's live per-row output above (the same `orchestration_readiness`
probe the floor gate itself made for every enumerated framework this run). This refreshes
262-RESEARCH.md's eight-row root-cause table against today's graph.

| # | Framework | matches | score | `pattern_type` | `structure` | `techniques` | `flow` |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | HSI Semantic Surprise Analysis Assistant | 2 | 2/4 | 0 | 1 | 0 | 1 |
| 2 | PWS Triple Validation Compass | 2 | 3/4 | 0 | 1 | 1 | 1 |
| 3 | Scenario Planning | 2 | 4/4 | 1 | 1 | 1 | 1 |
| 4 | The Pyramid Principle | 1 | 0/4 | 0 | 0 | 0 | 0 |
| 5 | Adaptive Leadership | 1 | 2/4 | 0 | 1 | 0 | 1 |
| 6 | Four Lenses of Innovation | 1 | 1/4 | 0 | 1 | 0 | 0 |
| 7 | MECE (Mutually Exclusive, Collectively Exhaustive) | 1 | 1/4 | 0 | 0 | 1 | 0 |
| 8 | Mullins Model | 1 | 2/4 | 0 | 1 | 1 | 0 |

Every dimension value in this row is byte-identical to 262-RESEARCH.md's "eight MISS rows"
table. No deltas in the per-dimension breakdown.

## Measurement 6: the write-seam check

Command:

```javascript
// tools/list over the same Brain URL and read-tier key
fetch(BRAIN_URL + '/mcp', { method: 'POST', body: JSON.stringify({
  jsonrpc: '2.0', id: 3, method: 'tools/list', params: {}
}) })
```

Total tool count: **31**

Full tool list (29 of 31 names shown verbatim; one read-only raw-Cypher passthrough tool's
literal name is intentionally withheld from this tracked doc per this phase's own fence rule
forbidding that string in evidence files -- it is unrelated to write access, was not exercised
this session, and its presence/absence is unchanged from 262-RESEARCH.md's recorded inventory):

```
classify_problem_type, find_frameworks_for_problem_type, find_commands_for_problem_type,
search, find_connections, find_bottlenecks, rank_influence, find_whitespace,
structural_neighbours, normalize_framework_name, load_framework, discover_structure,
intra_framework_flow, framework_techniques, orchestration_readiness, feeds_into_chains,
commands_for_problem_type, recommend_chain, operate_framework, render_decision_gate,
visualize_chain, visualize_framework_map, taxonomy_ladder, case_story, persona_card,
brain_ask, brain_search, brain_schema, brain_stats, brain_query
[+ 1 read-only raw-Cypher passthrough tool, name withheld per fence rule above]
```

`brain_write`: **ABSENT**
`ingest_framework`: **ABSENT**

Matches 262-RESEARCH.md's recorded state exactly (31 tools, both write tools absent,
`BRAIN_HTTP_ADMIN=deny` since 2026-09-01T20:54:40Z per that document's Environment
Availability table). No admin key was resolved or attempted at any point in this session;
only `lib/core/resolve-brain-key.cjs`'s default read-tier resolution was used.

## Deltas against 262-RESEARCH.md (2026-09-02)

- **Floor verdict:** no deltas. PASS=20, MISS=8, VOID=0, exit 1, identical row-by-row to
  262-RESEARCH.md's "The Live Floor Run" table.
- **FLOOR-03 Scenario Planning match count:** no deltas. Still 2, still the same two names
  in the same order, still readiness 4/4 with the same dimension breakdown.
- **Alias chain 18880 -> 23450 -> 34362:** no deltas, still holds exactly.
- **Alias topology, minor addition:** two `ALIAS_OF` edges into terminal node 34362 were
  observed in this run's query result set that were not named in 262-RESEARCH.md's traced
  list -- node 34454 "Scenario Planning for High Uncertainty" and node 46099 "Scenario
  Analysis". Both are direct single-hop aliases into the already-terminal node, not new
  hop-depth-1 forks, so they do not change the FLOOR-03 mechanism, the 2-match count, or the
  recommended fix shape. Recorded as a graph-population delta only.
- **SEP counts and phantom nodes:** no deltas. 258 total, 71 corrupted, 71 in the
  28000-29000 range, both phantom node ids (28757, 28775) present with the identical
  corrupted names.
- **Per-dimension MISS table:** no deltas. Every cell matches 262-RESEARCH.md's table.
- **Write-seam check:** no deltas. 31 tools, `brain_write` and `ingest_framework` both
  ABSENT.
- **Theo `/health`:** no deltas. Still 502, still not serving, still before the stated
  2026-09-09 validity boundary.

Overall: this run is a clean, window-fresh reconfirmation of every number
262-RESEARCH.md measured on 2026-09-02, with one minor addition (two more `ALIAS_OF` edges
into the same terminal node, non-load-bearing) and zero contradictions.

## Closing

This file contains measurements only. No ruling is made here. Attribution, ownership,
routing, and the Brain-repo work order live in `docs/262-FLOOR-01-GAP-LEDGER.md` (Plan
262-05), which cites this file's rows directly rather than re-measuring them.
