# Phase 262: Floor Green + SWEEP-02 Inversion - Research

**Researched:** 2026-09-02
**Domain:** Brain graph readiness measurement (Memgraph resolver + readiness scoring), plugin-side gate scripts, acceptance-fixture inversion
**Confidence:** HIGH (every load-bearing number in this document was measured live this session, not carried forward)

> No em-dashes anywhere in this file, per CLAUDE.md Conventions. Hyphens only.

---

## Summary

Phase 262 is the named exit gate for milestone v2.1.0, and its three requirements do not share a
repo, a mechanism, or a blast radius. FLOOR-02 is a pure MindrianOS-Plugin test refactor with a
green baseline today. FLOOR-03 is a live measurement plus a navigator ruling, runnable entirely
from this repo. FLOOR-01 is the hard one: it is a graph-state requirement whose fix surface is
almost entirely in `ProblemsWorthSolving-Brain`, and the write seam it needs is currently closed.

I ran the real gate live this session. `node scripts/check-flagship-floor.cjs` returned
**exit 1, 20/28 PASS, 8/28 MISS, 0 VOID** against the deployed Brain at
`https://pws-brain-mcp.onrender.com`. This is the first non-VOID floor run since Phase 261's
ceremony (261-13 recorded both of its attempts as transport-VOID, so no floor number existed
until now). The run is window-fresh, has zero probe failures, and therefore satisfies the
TRUST-02 trust condition in FLOOR-01's own text. FLOOR-01's remaining gap is not a trust gap.
It is eight real MISS rows. [VERIFIED: live run this session]

I then traced every one of those eight rows to a root cause, live. Three fail on the resolver
(`matches=2`) and six fail on readiness (`score < 3`), with HSI failing both. The three
resolver failures split into two distinct, separately-owned defects. Two of them (HSI,
PWS Triple Validation Compass) are a **regression introduced by Phase 261's own archived-block
relabel**: all 71 `:Framework` nodes carrying a `<SEP>`-corrupted name sit in id range
28000-29000, which is exactly the 71 nodes 261-09 restored, and two of them collide by substring
with ratified floor names. Both frameworks measured exactly-1 match in the pre-ceremony worklist
on 2026-08-21 and measure 2 today. The third (Scenario Planning, FLOOR-03) is a multi-hop
`ALIAS_OF` chain that `NORMALIZE_NAME_CYPHER`'s alias branch only follows one hop deep. Six of
the seven readiness misses share a single dimension failure: `pattern_type = 0`, which is the
exact defect the Brain repo filed as an unowned pending todo on 2026-09-02. [VERIFIED: live
`brain_query` + `normalize_framework_name` probes this session]

**The Theo flip changes the shape of this phase and is the highest-urgency finding here.** The
floor gate reads two response keys (`result.canonical_matches` and `result.readiness.readiness_score`)
that **neither exist in Theo's payloads**. Theo returns `{canonical, matched_via, coverage}` and
`{framework, score, inputs, evidence, unsynced_inputs, coverage, diagnostics}`. Both reads
degrade to `null`, `null` is not `1` and not `>= 3`, and neither produces a `failures[]` entry,
so the gate would report a **silent false RED at 0/28 with zero error signal** the first time it
runs against Theo. The gate does not use `brain-client.cjs`, so the Theo shape fix already
shipped in commit `21fdd7bc` does not protect it, and neither `check-flagship-floor.cjs` nor
`build-brain-census.cjs` appears on Theo's own 7-file plugin adaptation list. See the dedicated
section below. [VERIFIED: read Theo's source and its own cutover contract this session]

**Primary recommendation:** Plan Phase 262 as three independent tracks with three different
definitions of done, and do NOT plan FLOOR-01 as "run the script until it goes green." FLOOR-02
ships this repo, this phase, unconditionally. FLOOR-03 ships this repo as a re-ruling backed by
the live evidence below (the honest answer is that neither 1 nor 2 is "correct": 2 is a resolver
defect with a named one-line Brain-side fix). FLOOR-01 should ship as a **ratified, evidence-
backed gap ledger plus the cross-repo work orders that close it**, with the green run itself
gated on Brain-side work that Phase 262 cannot execute from this repo. Attempting to close
FLOOR-01 by narrowing `data/flagship-floor-set.json` is gaming the gate and must be named as a
rejected option in the plan. **Add a fourth track: make the gate shape-aware and fail LOUD on an
unrecognized envelope, before the flip lands.**

---

## Repo Ruling (the question this research was asked to settle)

`ROADMAP.md` labels Phase 262 **Repo: ProblemsWorthSolving-Brain**. That label is wrong as
written, and deferring to it blindly would misplan the phase. The verified state:

| Evidence | Finding |
|---|---|
| `scripts/check-flagship-floor.cjs` | Lives in **MindrianOS-Plugin**, 310 lines, runs here [VERIFIED: read this session] |
| `data/flagship-floor-set.json` | The ratified 28-name floor denominator lives in **MindrianOS-Plugin** [VERIFIED: read this session] |
| `tests/fixtures/127-03-acceptance/tier-0-no-key/` | FLOOR-02's target lives in **MindrianOS-Plugin** [VERIFIED] |
| `.planning/REQUIREMENTS.md` FLOOR-01/02/03 | Tracked only in **MindrianOS-Plugin** [VERIFIED: grep] |
| `ProblemsWorthSolving-Brain/.planning/ROADMAP.md` | Its own independent roadmap, Phases 1-6. Zero occurrences of "Phase 262", FLOOR-01, FLOOR-02 or FLOOR-03 [VERIFIED: grep this session] |
| Live `tools/list` on the deployed Brain | 31 tools. `brain_write` **ABSENT**, `ingest_framework` **ABSENT**, `brain_query` **PRESENT** [VERIFIED: live HTTP this session] |

**Ruling for the planner:** Phase 262 is **planned and tracked in MindrianOS-Plugin**. Two of its
three requirements execute entirely here. FLOOR-01's *measurement* executes here; FLOOR-01's
*remediation* is Brain-repo work that this phase can only specify and hand off, because the
admin write surface (`brain_write`, `ingest_framework`) was closed at the end of Phase 261's
window on 2026-09-01T20:54:40Z and is still closed as of this research. No graph write is
possible from any repo right now without reopening an operator window.

---

## The Theo Flip (raised mid-research by the navigator, and it is load-bearing)

Theo (`/home/jsagi/Theo/`, a separate repo with its own GSD tree) is the designated replacement
for the Brain hookup. Its Phase 09 "Brain-Contract Cutover" ships a `09-MOS-LEARNING.md` written
specifically for a MindrianOS-Plugin audience, naming the fate of every cutover tool. I read it
and Theo's source this session. Phase 262 measures the floor **through two of those tools**, so
the flip is not adjacent to this phase. It is upstream of its primary instrument.

### How close is "soon"?

The 2026-09-01 handoff says Theo Phase 08.4 (remote hosting, the flip's hard blocker) had "7
plans, zero executed." That is **already stale**. Verified on disk this session:

| Item | State as of 2026-09-02 |
|---|---|
| Theo Phase 08.4 (remote hosting) | 6 of 7 plans have SUMMARYs. `08.4-06` is PARTIAL, halted at a navigator checkpoint. `08.4-07` planned, not executed. |
| Theo remote origin | **Exists**: `https://theo-mcp.onrender.com`, service `srv-dabhg8dcqm1c73dkp7c0`, paid `starter` tier, created 2026-09-01T18:23:29Z from a committed `render.yaml` Blueprint |
| Live probe | `GET /health` returned **HTTP 502** (Render edge error, not a Theo body). Recorded honestly in `08.4-DEPLOY-PROBE.md`: "the service object exists and its build pipeline is proven, but the process does not currently serve traffic" |
| Theo Phase 09 | 10 of 12 plans done. `09-11` and `09-12` both carry `external_gate: "Phase 08.4 COMPLETE"` |
| The flip itself | `09-12`, `autonomous: false`, and its own gate text says: "The flip itself also requires a MindrianOS-Plugin release (plugin-repo work, coordinated here, never executed from this repo)" |

[VERIFIED: read Theo's phase directories, deploy probe and plan frontmatter this session]

So the sequence is: diagnose one 502, clear one navigator checkpoint, close `08.4-07`, run two
Theo plans, then cut a coordinated plugin release. That is weeks, not months, and it is much
closer than the handoff's own snapshot implies. **Phase 262's floor numbers have a shelf life
measured against that date, not against a generic staleness window.**

### The break, precisely

`check-flagship-floor.cjs::probeFramework` reads exactly two paths:

```javascript
const normalizeMatches = normRes.ok && normRes.result && Array.isArray(normRes.result.canonical_matches)
  ? normRes.result.canonical_matches.length : null;
const readinessScore = readyRes.ok && readyRes.result && readyRes.result.readiness
  ? readyRes.result.readiness.readiness_score : null;
```

Incumbent Brain versus Theo, both verified from source:

| Tool | Incumbent shape (measured live this session) | Theo shape (read from Theo's source) | Gate result |
|---|---|---|---|
| `normalize_framework_name` | `{tool, backend, grounded, note, canonical_matches: [...]}` | `{canonical, matched_via: 'exact'\|'alias', coverage}`. **Not-found omits `canonical` and `matched_via` entirely** rather than nulling them. No `canonical_matches` key at any time. | `Array.isArray(undefined)` is false, so `normalizeMatches = null` |
| `orchestration_readiness` | `{tool, backend, grounded, note, readiness: {name, readiness_score, orchestration_status, dimensions}}` | `{framework, score, inputs, evidence, unsynced_inputs, coverage, diagnostics}`. **No `readiness` wrapper; the key is `score`, not `readiness_score`.** | `result.readiness` is undefined, so `readinessScore = null` |

Feed both nulls into `evaluateFloor`:

- `failures` is empty, because `normRes.ok === true` and `readyRes.ok === true`. The calls
  succeed. Nothing is wrong at the transport layer.
- Therefore the VOID branch does not fire. TRUST-02 cannot save this.
- `matches === 1` is `null === 1`, false. `typeof score === 'number'` is false.
- Verdict: **MISS**, for every enumerated framework.

Output: `Frameworks passing: 0/28`, `Frameworks MISSING the floor: 28/28`,
`=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===`, exit 1. Indistinguishable from a genuinely
red floor. [VERIFIED: gate source read, Theo source read; the composed outcome is reasoned from
both and is tagged A6]

This is the same failure class Theo's own doc calls "the single highest-risk line in this
document," and it names the reason it is dangerous: "a consumer would have to notice that
queries which used to return rows now consistently return none, not see a crash or a type error."

### Why the existing Theo fix does not cover this

The 2026-09-01 handoff records finding #1 as FIXED and pushed: `lib/core/brain-client.cjs`'s
`query()` now recognizes `{rows, diagnostics}` (commits `719f4499` RED, `21fdd7bc` GREEN, plus
`tests/test-brain-client-theo-rows-shape.cjs`). That fix is real and correct, and it is
**irrelevant to the floor gate**:

- `check-flagship-floor.cjs` imports `brainCall` from `scripts/build-brain-census.cjs`.
- `scripts/build-brain-census.cjs` requires only `node:fs`, `node:path`, and
  `lib/core/resolve-brain-key.cjs`. It **never requires `brain-client.cjs`**. Its `brainCall` is
  an independent direct-`fetch` client. [VERIFIED: grep of the require list this session]
- The fix was to `query()` (the `brain_query` wrapper). The gate calls
  `normalize_framework_name` and `orchestration_readiness`, different tools with different
  shapes, through a different client.

And neither file is on Theo's named 7-file plugin adaptation list
(`scripts/probe-brain-contract.cjs`, `lib/brain/chain-recommender.cjs`,
`lib/core/enrichment-queue.cjs`, `bin/mindrian-brain-mcp-client.cjs`,
`lib/core/resolve-brain-key.cjs`, `data/brain-surface-contract.json`,
`BRAIN_TOOL_MATCHER`/`hooks/hooks.json`). **The floor gate is an unlisted, uncovered consumer.**
That is a genuine gap in the flip's own coverage, and Phase 262 is the phase that should find it,
because Phase 262 is the only phase that runs the gate.

### Three more consequences the planner must price in

1. **`pattern_known` is hardcoded unsynced on Theo.** `src/mcp/content/orchestration-readiness.ts:501`
   emits `unsynced_inputs: ['pattern_known']` unconditionally, with a header comment explaining
   that its backing data was never synced. That is the same dimension as the incumbent's
   `pattern_type`, which measures 0 on all seven of my readiness-miss rows. After the flip,
   readiness is capped at **3 of 4 for every framework in the population**. The floor's
   `>= 3` threshold survives (3 is still reachable) but with zero headroom, and the six rows
   currently missing on readiness would need all three remaining inputs perfect. Getting the
   floor green gets strictly harder after the flip, not easier.

2. **`brain_write` refuses unconditionally on Theo.** Its cutover row reads: "Refuses. Every
   call, unconditionally, by name, with no write path behind it to route to." The incumbent's
   admin surface is closed today but can be reopened by an operator. Theo's cannot be reopened at
   all. **Every FLOOR-01 graph remediation must land on the incumbent Brain before the flip, or
   be re-expressed as a Theo-side ingestion** (Theo has a Phase 10 "framework-ingestion-contract"
   for exactly this). This turns "schedule an admin window sometime" into a dated deadline.

3. **The population is different, so the ratified denominator may not resolve.** Theo measured
   its canon live on 2026-09-01 at **712 nodes, 914 relationships, 149 frameworks**. The
   incumbent measures **29,200 nodes, 24,375 relationships, 258 `:Framework`**. The 28 ratified
   floor names were ratified against the incumbent population on 2026-08-11. Whether all 28
   resolve on Theo is unmeasured and unmeasurable until `theo-mcp` serves traffic.

### What Phase 262 should do about it

Add a fourth track, and keep it small. The recommendation is **not** to adapt the gate to Theo
now (the origin is 502 and the payloads cannot be exercised). It is to make the gate incapable of
lying:

- **Make an unrecognized envelope a VOID, not a MISS.** Today the gate distinguishes only
  "probe failed" from "probe succeeded." It needs a third state: "probe succeeded but I do not
  recognize the payload." A `null` `normalizeMatches` or `readinessScore` where the HTTP call
  succeeded is exactly that, and it should push a `failures[]` entry with a new
  `kind: 'unrecognized_shape'` so the existing VOID machinery (banner, exit 3, per-row detail
  lines, mandatory human re-run) fires unchanged. This is a small, additive change to
  `probeFramework`, is provable hermetically against `evaluateFloor`, needs no network, and is
  correct **today** regardless of when the flip lands. It converts the worst outcome (a silent
  false RED that gets recorded as a milestone number) into the designed one (a loud VOID that
  demands a human).
- **Do not adapt the gate's readers to Theo's shape in this phase.** That is flip-day work,
  belongs with the other 7 files, and cannot be tested until the origin serves. Phase 262's job
  is to add the tripwire and to get `check-flagship-floor.cjs` and `build-brain-census.cjs`
  **added to Theo's adaptation list**, which is a message to Theo's session, not a code change.
- **Date the evidence.** Every floor number in the plan should carry "measured against the
  incumbent Brain on <date>" so a post-flip reader does not compare across populations.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLOOR-01 | `check-flagship-floor.cjs` exits 0 on a window-fresh run (no probe failures, per TRUST-02) | Live run measured 20/28 PASS, 8/28 MISS, 0 VOID, exit 1. Per-row root causes traced below. The TRUST-02 condition is already satisfied (zero VOID rows); the gap is eight genuine MISS rows, six of which need graph writes and one of which needs a Brain-side resolver fix. |
| FLOOR-02 | The tier-0-no-key acceptance fixture is REPURPOSED to assert the keyless path refuses correctly - coverage kept, assertion inverted, never deleted | Exact file set enumerated below. Baseline measured green today (5/5 gates, 1 SKIP). The wire contract is deliberately byte-locked, so "inversion" is a semantic/assertion change, not a wire-string change. |
| FLOOR-03 | Scenario Planning resolver count re-ruled against a fresh live measurement; do not carry the exactly-1 assumption forward | Measured live this session: **2 canonical matches**. Root cause traced to a hop-depth-1 alias-branch defect in `NORMALIZE_NAME_CYPHER`, with the exact node chain identified. Neither "1" nor "2" is the correct assertion; the correct answer is "1 after a named Brain-side fix." |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Floor gate enumeration + evaluation + exit code | Plugin (MindrianOS-Plugin scripts) | - | `evaluateFloor` is a pure exported function here; the denominator override file is here |
| Floor gate probe transport | Plugin (`build-brain-census.cjs` `brainCall`) | Brain HTTP `/mcp` | One HTTP client, already shared, Part 7 compliant |
| Framework name resolution (`normalize_framework_name`) | Brain (`src/arm1-orchestrator.mjs`) | - | The 2-match defect is a Cypher-shape defect on the far side of the wire; no plugin change can fix it |
| Readiness scoring (`orchestration_readiness`) | Brain | - | Reads node props; `pattern_type` write path is the Brain's own pending todo |
| Graph node/property repair (`<SEP>` names, `pattern_type`, alias chains) | Brain repo + operator admin window | - | `brain_write` / `ingest_framework` are absent from the live tool surface; no write seam exists today |
| Keyless refusal behavior | Plugin (`lib/core/refusal-messaging.cjs`, `bin/mindrian-brain-mcp-client.cjs`) | - | Wire shape is byte-locked in the plugin; the Brain is never contacted on the keyless path |
| Acceptance-fixture assertion | Plugin (`tests/`) | - | Hermetic, zero network on the keyless gate |

**Planner check:** any task that proposes editing Cypher, node properties, or labels is a
Brain-repo task and must be written as a cross-repo work order or a handoff, not as an inline
edit under `/home/jsagi/dev/MindrianOS-Plugin/`.

---

## The Live Floor Run (the phase's ground truth)

Command run this session from `/home/jsagi/dev/MindrianOS-Plugin/`:

```
node scripts/check-flagship-floor.cjs
```

Header lines (verbatim shape):

```
Brain URL: https://pws-brain-mcp.onrender.com
Floor denominator: RATIFIED at 28 framework(s) (data/flagship-floor-set.json,
  ratified_by=navigator (AskUserQuestion card, 249-03 read-tier session, ruling 3 of 5:
  'Floor denominator RATIFIED: the frontmatter set (28)'), ratified_at=2026-08-11)
Enumerated frameworks this run: 28
```

Summary lines:

```
Frameworks passing (exactly-1 match AND readiness>=3): 20/28
Frameworks MISSING the floor: 8/28
=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===
exit 1
```

Zero VOID rows. Zero probe failures. This IS a window-fresh, trustworthy floor verdict per
TRUST-02. [VERIFIED: live run 2026-09-02]

### The eight MISS rows, with per-dimension root cause

| # | Framework | matches | score | Failing leg | `pattern_type` | `structure` | `techniques` | `flow` |
|---|-----------|--------:|------:|-------------|---:|---:|---:|---:|
| 1 | HSI Semantic Surprise Analysis Assistant | **2** | **2/4** | both | 0 | 1 | 0 | 1 |
| 2 | PWS Triple Validation Compass | **2** | 3/4 | resolver only | 0 | 1 | 1 | 1 |
| 3 | Scenario Planning | **2** | 4/4 | resolver only | 1 | 1 | 1 | 1 |
| 4 | The Pyramid Principle | 1 | **0/4** | readiness only | 0 | 0 | 0 | 0 |
| 5 | Adaptive Leadership | 1 | **2/4** | readiness only | 0 | 1 | 0 | 1 |
| 6 | Four Lenses of Innovation | 1 | **1/4** | readiness only | 0 | 1 | 0 | 0 |
| 7 | MECE (Mutually Exclusive, Collectively Exhaustive) | 1 | **1/4** | readiness only | 0 | 0 | 1 | 0 |
| 8 | Mullins Model | 1 | **2/4** | readiness only | 0 | 1 | 1 | 0 |

[VERIFIED: live `normalize_framework_name` + `orchestration_readiness` probes, this session]

**The single most useful pattern in this table:** `pattern_type = 0` on all seven readiness-
relevant rows. The only MISS row with `pattern_type = 1` is Scenario Planning, whose failure is
purely resolver-side. This is the exact defect the Brain repo filed on 2026-09-02 as
`.planning/todos/pending/2026-09-02-fix-pattern-type-readiness-shortfall-on-existing-frameworks.md`,
explicitly reviewed during `/gsd-discuss-phase 5` and explicitly **kept out of Brain Phase 5's
scope** as a different domain. It is therefore currently **unowned by any planned phase in either
repo**. [VERIFIED: read the Brain repo commit `56bf75a` this session]

**Arithmetic the planner needs:** fixing `pattern_type` alone does not green the floor. Applying
+1 to each row: HSI 3/4 (still 2 matches), Adaptive 3/4 PASS, Mullins 3/4 PASS, Four Lenses 2/4
still MISS, MECE 2/4 still MISS, Pyramid 1/4 still MISS. That is 22/28, not 28/28. Four Lenses
and MECE both carry honest sub-floor ceilings their own Phase 261 payloads already disclosed
(261-05 recorded MECE's "honest ceiling that does not clear the floor even on approval";
261-07 recorded Four Lenses at an honest 2/4). Pyramid is the known 261-04 RETARGET finding:
`minto-pyramid.mjs` enriches "Minto Pyramid" (id 38968, 3/4) while the ratified floor name is
"The Pyramid Principle" (id 30242, measured 0/4 today).

---

## Root Cause 1: the `<SEP>` regression (FLOOR-01 rows 1 and 2)

This is a **new finding not recorded in any Phase 261 artifact**, and it is the highest-value
item in this research.

### What was measured

```
normalize_framework_name("PWS Triple Validation Compass")
  -> ["PWS Triple Validation Compass",
      "The PWS Triple Validation Compass is a framework designed for innovation and
       problem-solving, emphasizing solution validation.<SEP>PWS Triple Validation Compass
       is an innovation framework designed for problem-solving and creative thinking,
       involving a three-question validation process."]
```

The second "canonical match" is not a framework. It is a description blob stored in a node's
`name` property with a `<SEP>` separator. Same shape for HSI. [VERIFIED: live probe]

### The graph state behind it

| Query | Result |
|---|---|
| `MATCH (f:Framework) RETURN count(f)` | **258** |
| `MATCH (f:Framework) WHERE f.name CONTAINS '<SEP>' RETURN count(f)` | **71** |
| Same, restricted to `id(f) >= 28000 AND id(f) <= 29000` | **71** (all of them) |
| HSI phantom node | `id 28757`, labels `[Concept, Organization, Framework]` |
| TVC phantom node | `id 28775`, labels `[Concept, Framework]` |

[VERIFIED: live `brain_query` this session]

### Why this is a regression, not pre-existing damage

Phase 261's ceremony record states the archived-block relabel "restored 71 Framework labels."
The count of `<SEP>`-corrupted `:Framework` nodes is exactly 71, and every one sits in the
28000-29000 block the relabel targeted. The pre-ceremony worklist
(`ProblemsWorthSolving-Brain/docs/2026-08-21-WORKLIST-261-ceremony.md`) records:

```
| HSI Semantic Surprise Analysis Assistant | 1 | 0 | 0 0 0 0 | MISS (readiness 0) |
| PWS Triple Validation Compass            | 1 | 2 | 0 1 0 1 | MISS (readiness 2) |
```

Both had **1** resolver match before the window. Both have **2** now. [VERIFIED: read the
tracked worklist + live probe]

The sharpest consequence: PWS Triple Validation Compass's readiness rose from 2 to 3 during the
ceremony (its CER-03 payload worked), which should have converted it to a PASS. The relabel
simultaneously broke its resolver count, so the floor never saw the gain. **Phase 261 paid for
that row and lost it to its own side effect.** The ceremony record noticed TVC's 2-match and
recorded it as "still resolves to two candidates," which reads as pre-existing and is not what
the tracked pre-ceremony worklist says. HSI's 2-match is not mentioned anywhere.

### Ownership

`ProblemsWorthSolving-Brain` Phase 5 Success Criterion 3 explicitly owns this:

> All 100 archived-block nodes touched by `payloads/archived-block-relabel-2026-08-21/` carry a
> corrected, non-corrupted (single-field, not multi-sentence) name - currently 99/100 remain
> corrupted per the 2026-09-02 freeze-lift ceremony finding.

Decision D-04 in `05-CONTEXT.md` folds it into that phase's scope. [VERIFIED: read this session]

**Planner implication:** FLOOR-01 rows 1 and 2 close when Brain Phase 5 executes, which requires
an operator admin window in the Brain repo. Phase 262 cannot close them. What Phase 262 CAN do
is supply Brain Phase 5 with the two specific node ids (28757, 28775) and the causal link to the
floor gate, so the name repair is prioritized against a named consumer rather than treated as
cosmetic hygiene.

---

## Root Cause 2: FLOOR-03, the Scenario Planning hop-depth-1 defect

### Fresh live measurement (this is the number FLOOR-03 asked for)

```
normalize_framework_name("Scenario Planning")
  -> ["Shell Scenario Planning Method", "Scenario planning methodology"]     (2 matches)
orchestration_readiness("Scenario Planning")
  -> readiness_score 4/4, dimensions {pattern_type:1, structure:1, techniques:1, flow:1}
```

**The live count is 2.** It was 2 on 2026-08-21 (260-05's post-deploy round-trip), 2 at the
Phase 261 post-close probe, and 2 today. It has been stable at 2 across three independent
measurements on two different graph states. [VERIFIED: live probe this session]

### The exact mechanism, traced to Cypher

`ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs:87` (the FIX-03 form):

```cypher
OPTIONAL MATCH (f:Framework)
  WHERE toLower(f.name) CONTAINS toLower($raw)
    AND NOT exists((f)-[:ALIAS_OF]->(:Framework))
WITH collect(DISTINCT f.name) AS direct
OPTIONAL MATCH (a)-[:ALIAS_OF]->(canon:Framework)
  WHERE toLower(a.name) CONTAINS toLower($raw)
WITH direct, collect(DISTINCT canon.name) AS resolved
WITH [m IN direct + resolved WHERE m IS NOT NULL] AS raw_matches
RETURN reduce(acc = [], m IN raw_matches | CASE WHEN m IN acc THEN acc ELSE acc + m END)
  AS canonical_matches
```

The live alias topology around Scenario Planning:

```
  18880 "Scenario Planning Methodology"  (:Product)
      -[:ALIAS_OF]-> 23450 "Scenario planning methodology" (:Framework)
          -[:ALIAS_OF]-> 34362 "Shell Scenario Planning Method" (:Framework, terminal)

  34086 "Scenario Planning" (:DictionaryTerm :Tool :Framework :Concept :Technique)
      -[:ALIAS_OF]-> 32108 "scenario planning"
      -[:ALIAS_OF]-> 39835 "Scenario planning"
      -[:ALIAS_OF]-> 34362 "Shell Scenario Planning Method"

  34383 "PWS-Scenario Planning Integration Framework" -[:ALIAS_OF]-> 34362
```

[VERIFIED: live `brain_query` this session]

Walk it for `$raw = "scenario planning"`:

- **Direct branch:** every `:Framework` whose name contains the fragment except 34362 has an
  outgoing `ALIAS_OF` to a `:Framework` and is correctly excluded. 34362's own name
  ("Shell Scenario Planning Method") contains the fragment and it has no outgoing alias, so
  `direct = ["Shell Scenario Planning Method"]`. Correct.
- **Alias branch:** `(a)-[:ALIAS_OF]->(canon:Framework)` where `a.name` contains the fragment.
  `a = 18880` matches, and its `canon` is **23450**, whose name is "Scenario planning
  methodology". 23450 is *itself* an alias of 34362, but the branch stops at one hop and emits
  it as canonical. So `resolved` contains an intermediate alias.
- `reduce` dedups by **string**, not by node, and the two strings differ, so both survive.

Result: `["Shell Scenario Planning Method", "Scenario planning methodology"]`, exactly what the
live tool returned, in that order.

### Independent confirmation of the mechanism

```
normalize_framework_name("Scenario planning methodology")
  -> ["Scenario planning methodology", "Shell Scenario Planning Method"]
```

The tool returns an alias node's own name as a canonical match alongside its canonical target.
The tool's own shipped description says the opposite:

> "A name that is itself an ALIAS_OF another framework is resolved to its canonical name rather
> than returned as-is, so every entry in canonical_matches is canonical."

That is a live contract violation, on the deployed surface, of the behavior FIX-03 was written
to guarantee. FIX-03 made the **direct** branch alias-aware; the **alias** branch is still
hop-depth-1. [VERIFIED: live probe + source read]

### The FLOOR-03 ruling this evidence supports

Neither of the two numbers carried forward is the right assertion.

| Candidate ruling | Verdict |
|---|---|
| "exactly-1 is correct, the graph is wrong, fix the graph" | Partially right, wrong lever. Requires an admin window to retarget 18880's alias. Fixes one instance, not the class. |
| "2 is genuinely correct, update the assertion to 2" | **Reject.** 2 is a defect, not a legitimate multi-canonical result. Encoding it into the gate would bless a resolver bug and make the exactly-1 rule unenforceable for every other framework. |
| **"exactly-1 remains correct; the defect is a hop-depth-1 alias branch; fix the Cypher"** | **Recommended.** Read-path code change in the Brain repo, no graph write, no admin window, fixes the whole class. |

**Recommended fix shape (Brain repo, needs verification against the deployed Memgraph build):**
add a terminal guard to the alias branch so an intermediate alias is never emitted as canonical.

```cypher
OPTIONAL MATCH (a)-[:ALIAS_OF]->(canon:Framework)
  WHERE toLower(a.name) CONTAINS toLower($raw)
    AND NOT exists((canon)-[:ALIAS_OF]->(:Framework))
```

This mirrors the guard the direct branch already uses, which is the Part 7 reuse-before-invent
answer. A variable-length `-[:ALIAS_OF*1..3]->` form is the alternative but is riskier
(cycle exposure, cost) and needs a live execution check on this Memgraph build. Both forms must
be executed read-only against canon before being written into a plan, exactly as 260's research
flag was discharged. [ASSUMED: the guard form is correct; the *defect* is VERIFIED, the *fix*
is not yet executed live]

**Blast-radius warning for the planner:** the same guard changes `normalize_framework_name` for
every framework, so it is a floor-wide change. Before it ships, re-run the full 28-row floor
gate against the modified Cypher. `NORMALIZE_NAME_CYPHER` is exported from
`src/arm1-orchestrator.mjs` (260-03 exported it deliberately), so a before/after matrix across
all name-matching readers is reproducible using the same method 260-02 used.

---

## FLOOR-02: what "inverted, never deleted" means concretely

This is the one requirement that is entirely in this repo, entirely hermetic, and has a green
baseline today.

### Baseline measured this session

```
bash tests/test-127-03-acceptance-gates.sh
  gate-1  PASS :: Tier-0 sentinel returned on brain_schema
  gate-2  SKIP :: MINDRIAN_TEST_LIVE_KEY not set
  gate-3  PASS :: migration removed legacy entry, snapshot + log present
  gate-4  PASS :: shim emitted canonical startup line
  gate-5  PASS :: Class-M reported expected cascade (L1 PASS, L2 FAIL, L3-L6 skipped)
  VERDICT: ALL ACCEPTANCE GATES PASSED, exit 0
```

[VERIFIED: live run this session]

### The complete file set

| File | Line / anchor | What it is today | What "inversion" means |
|---|---|---|---|
| `tests/fixtures/127-03-acceptance/tier-0-no-key/README.md` | whole file, 5 lines | Fixture identity doc. Frames the keyless state as "proves the install works without a key" and names the "silent-failure cohort... gets unblocked" | Rewrite as a **refusal** fixture identity. `git mv` the directory to a refusal name so history follows (the same technique 252-01 used for `tier0-messaging.cjs -> refusal-messaging.cjs`). Do NOT delete. |
| `tests/test-127-03-acceptance-gates.sh` | `run_gate_1`, lines 31-70 | Asserts `parsed.status === "DIRECTOR_NOT_AVAILABLE"`; records the label "Tier-0 sentinel returned on brain_schema" | Keep the wire assertion (it is byte-locked, see below). **Add** the assertions that make it a refusal proof: `kind`/`reason` honesty, `upgrade_hint` present, and above all a **negative** assertion that no methodology content is served on the keyless path. Rename the recorded label away from "Tier-0 sentinel". |
| `tests/test-127-03-acceptance-gates.sh` | `run_gate_4`, lines 149-165 + header line 8 | "Gate 4: Tier-0 cohort -> canonical shim startup line" | Reframe the gate comment and the fixture reference. The assertion (canonical stderr startup line) is orthogonal to the doctrine and stays. |
| `tests/test-127-02-doctor-class-m.sh` | line 79, `run "T4-tier-0-no-key-cascade"` | Test label carries the dead doctrine name | Rename the label. Behavior unchanged. |
| `tests/test-127-00-shim-handshake.sh` | line ~13 and ~252, "Test 8: live tools/call brain_schema returns DIRECTOR_NOT_AVAILABLE" | Same wire assertion, different harness | Same treatment: keep the wire assertion, reframe the label to name refusal. |
| `tests/run-all-127.sh` | lines 7-9, 48-50 | The aggregator that discovers these files | Update only if filenames change. |

### The trap: do NOT change the wire string

`lib/core/refusal-messaging.cjs:84` locks `DIRECTOR_NOT_AVAILABLE` and its own header calls it
"a phase-amendment boundary." Line 187 maps `no_key -> DIRECTOR_NOT_AVAILABLE` with an explicit
comment that it "keeps the byte-locked DIRECTOR_NOT_AVAILABLE wire string for downstream compat
(shim, statusline, doctor smoke)." `lib/core/doctor/class-m-brain-smoke.cjs` reads it in
`STRUCTURED_REFUSAL_STATUSES`. Phase 252-01 renamed the whole module and deliberately made
**zero** export renames and **zero** value edits for exactly this reason. [VERIFIED: read this
session]

So FLOOR-02's "assertion inverted" is a **semantic** inversion, not a string change. Today the
fixture reads "keyless works, here is the fallback." After inversion it must read "keyless
refuses, and here is the proof it served nothing." A plan that changes `DIRECTOR_NOT_AVAILABLE`
breaks the shim, the doctor Class-M cascade, and `test-127-00`. State this as a locked
constraint in the plan.

### Already done, do not redo (Part 7)

- `lib/core/tier0-messaging.cjs -> lib/core/refusal-messaging.cjs`: renamed in 252-01 (SWEEP-01).
- `getTier0Chain()` / `getFrameworkChain()` in `brain-client.cjs`: **DELETED** in 252-01. The
  comment block at `lib/core/brain-client.cjs:1609` records it, and the export block at ~2028
  carries a tombstone comment. Zero CJS consumers at deletion time. [VERIFIED: read this session]
- `docs/BRAIN-IDENTITY-DESIGN.md` already records the ratified doctrine: "Option C (anonymous
  degraded tier) is dead by navigator ruling... SWEEP-02 inverts the keyless fixture to assert
  REFUSAL." That document is the authority for what the inverted assertion must say.
- Residual `tier0Response()` / `larryTier0Hint()` export names in `refusal-messaging.cjs` are a
  **deliberate** non-rename (byte-locked contract). Do not fold a rename into FLOOR-02 without a
  separate amendment.

### The origin spec, quoted

`docs/2026-08-09-HANDOFF-tier0-removal-milestone.md:135`:

> That last one exists specifically to prove the product works WITHOUT a key. Killing Tier 0
> means deleting the artifact that currently proves the install works. Decide consciously
> whether it is deleted or repurposed into a *refusal* fixture (asserting the keyless path
> refuses correctly). Repurposing is almost certainly better than deleting: it keeps the
> coverage and inverts the assertion.

`docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md:165` carries it as ledger item 5, ratified.

---

## Did Phase 261 change anything the floor validates against? (question 4)

Yes, in four ways, two helpful and two harmful. Verified against
`ProblemsWorthSolving-Brain/docs/2026-08-21-RECORD-261-ceremony.md` section 3 plus live probes.

| Quantity | Before ceremony | After (record) | Live now (2026-09-02) | Effect on the floor |
|---|---:|---:|---:|---|
| `:Framework` nodes | 186 | 258 | **258** | Population grew 39 percent, mostly the 71 relabels |
| ratified-28 PASS | 11 | 20 | **20** | +9, the ceremony's real product win |
| `ALIAS_OF` self-loops | 165 | 0 | (0 per record) | Removed a whole class of resolver noise |
| `USES_FRAMEWORK` | 86 | 86 | - | Zero movement |
| zero-framework commands | 59 | 59 | - | Zero movement, headline metric did not budge |
| `<SEP>`-corrupted `:Framework` names | 0 | (not measured) | **71** | **New. Broke 2 floor rows.** |

The live state today matches the post-close state exactly. Nothing has drifted in the day since.

**The two harmful changes:**

1. The `<SEP>` regression above (2 rows lost, 1 of them a row the ceremony had just earned).
2. The systematic `pattern_type` write-path shortfall. The ceremony record names it plainly:
   "Every approved payload targeting an existing framework remained one point below prediction
   because `pattern_type` did not land. This includes MECE at 1/4 rather than 2/4, Mullins at
   2/4 rather than 3/4." My live probe confirms both numbers exactly. Only PEST Analysis, a
   genuinely new node, landed `pattern_type` and hit its predicted 3/4 (live: PASS at 3/4).

**Planner implication:** Phase 261 was not floor-neutral. Any FLOOR-01 gap ledger this phase
writes must attribute these two items to 261 and route them, or the record will read as if the
floor simply "did not go green" rather than "went green in nine places and regressed in two."

---

## Architecture Patterns

### The gate pipeline, end to end

```
  commands/*.md frontmatter (kind: methodology)
        |
        v
  scanMethodologyCommands()            [scripts/build-brain-census.cjs, exported]
        |  50 commands -> 28 distinct framework names
        v
  data/flagship-floor-set.json          [RATIFIED denominator, 28 names, exact-string filter]
        |  strict Set.has() membership, case-sensitive
        v
  for each framework:
        probeFramework(name, key)       [check-flagship-floor.cjs]
           |-> brainCall('normalize_framework_name', {raw})   --HTTPS--> Brain /mcp
           |-> brainCall('orchestration_readiness', {framework_name}) --HTTPS--> Brain /mcp
           |-> failures[] built from errorKind (never re-sniffed from bodyText)
        v
  evaluateFloor(frameworks, probeResultsByName)   [PURE, exported, fixture-injectable]
        |  precedence: failures>0 -> VOID | matches===1 && score>=3 -> PASS | else MISS
        v
  exitCode = voidCount>0 ? 3 : (missCount>0 ? 1 : 0)
        |
        v
  renderVoidDetailLines() + renderFloorSummaryLines()   [PURE, three distinct banners]
```

Key design property to preserve: `evaluateFloor` and both renderers are **pure and exported**
precisely so `tests/test-249-floor-gate.cjs` and `tests/test-259-floor-void.cjs` inject fixtures
with zero network. Any FLOOR-01 change to gate logic must land in the pure function and be
proven hermetically, never by "run it live and see."

### Pattern: the phase-close aggregator

`tests/run-all-<phase>.sh` is the established convention (`run-all-259.sh` is the best template
for this phase, and is the direct ancestor since it owns TRUST-01/TRUST-02). Its load-bearing
properties, all of which a `run-all-262.sh` should copy:

- **Discovery is by glob, not by list.** `PREFIX="${TEST_262_PREFIX:-tests/test-262-}"`, then
  glob `.cjs` (run with `node --test`) and `.sh` (run with `bash`).
- **The `found -eq 0` guard is load-bearing.** A harness that discovers nothing must FAIL, not
  print green. The prefix is a variable *only* so this guard is provable:
  `TEST_262_PREFIX=tests/test-262-nonexistent- bash tests/run-all-262.sh` must exit non-zero.
- **Header enumerates the mandatory tests by filename** even though the glob does discovery, so
  a missing test is visible by reading the header.
- **A no-em-dash fence** sweeping every file the phase touches, via `grep -P '\x{2014}'` (the
  codepoint escape, so the runner carries no literal em-dash that would trip its own sweep).
  `rc >= 2` from grep must FAIL the fence, never silently pass.
- **`run_may_skip`** for `.sh` legs that can legitimately SKIP.
- Self-exclusion guard so the runner never re-runs itself.

### Anti-patterns to avoid

- **Narrowing `data/flagship-floor-set.json` to make the gate green.** The file is
  navigator-ratified (`ratified_by`, `ratified_at` are read and printed by the gate). Removing
  the 8 failing names would print "RATIFIED at 20 framework(s)" and exit 0 while measuring
  nothing. Name this as an explicitly rejected option in the plan so the record shows it was
  considered and refused.
- **Weakening the exactly-1 rule to `>= 1`.** The gate's own header explains why exactly-1 is
  load-bearing: "A multi-match name makes every readiness probe ambiguous (T6 takes exact-first
  LIMIT 1)." Relaxing it makes the readiness column meaningless.
- **Adding a `<SEP>` filter to the plugin-side gate.** Tempting (it would green rows 1 and 2
  today) but it hides a real graph defect behind a client-side band-aid, on the wrong side of
  the wire, and would silently mask future corruption. The repair belongs in Brain Phase 5.
- **Auto-retrying a VOID run.** D-08 from Phase 259 is explicit: a VOID run requires a human
  re-run, nothing auto-retries.
- **Treating "the probe succeeded" as "the answer is trustworthy."** The gate currently conflates
  them, which is exactly what makes the Theo shape change a silent false RED instead of a loud
  VOID. A successful HTTP call carrying a payload the gate cannot read is a measurement failure,
  not a measurement.
- **Declaring FLOOR-01 done on a measurement.** The Phase 261 record already made this
  distinction correctly: "The fresh post-close state is 20 of 28 PASS... This is a Phase 261
  measurement, not FLOOR-01 completion." Hold that line.

---

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---|---|---|---|
| HTTP calls to the Brain from a script | A second `fetch` wrapper | `brainCall` exported from `scripts/build-brain-census.cjs` | Part 7. It already carries `errorKind` classification (259-03), Retry-After handling, and the 300-char body cap. A second client re-introduces the 429-as-unreachable bug TRUST-01 killed. |
| Parsing command frontmatter for framework names | A regex over `commands/*.md` | `scanMethodologyCommands()` from the same module | Already exported, already the gate's source of truth, already cross-validated by 261-10 |
| Resolving a Brain key | Reading `~/.mindrian.env` directly | `lib/core/resolve-brain-key.cjs` `resolveBrainKey()` | Single chokepoint; the gate already refuses cleanly with a named reason when unavailable |
| Deciding PASS/MISS/VOID | New comparison logic in a test | `evaluateFloor()` (exported, pure) | Two existing test files pin its behavior; a parallel implementation drifts |
| Rendering the verdict banner | A new print block | `renderFloorSummaryLines()` / `renderVoidDetailLines()` | The three-distinct-banner rule (D-06) exists so a VOID never reads like a RED in the operator's head |
| Running arbitrary read Cypher against canon | `text2cypher` | `brain_query` | `brain_query` is read-only, bounded, refuses non-reads, and is available on a normal read key. `text2cypher` executes model-authored Cypher and is a known open exposure per the 2026-08-10 Brain service audit. |
| A phase test aggregator | A bespoke runner | Copy `tests/run-all-259.sh` | Glob discovery + `found -eq 0` guard + em-dash fence are all already correct there |

**Key insight:** every mechanism this phase needs already exists and is exported. Phase 262
should write approximately zero new infrastructure. Its output is measurements, rulings, an
inverted fixture, and cross-repo work orders.

---

## Runtime State Inventory

This phase's subject IS runtime state, so this section is load-bearing rather than perfunctory.

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data (live graph)** | 258 `:Framework` nodes on the deployed Memgraph. 71 carry `<SEP>`-corrupted `name` values (ids 28000-29000). Node ids 28757 (HSI phantom) and 28775 (TVC phantom) directly break floor rows. Node 30242 "The Pyramid Principle" measures 0/4 while node 38968 "Minto Pyramid" measures 3/4. Alias chain 18880 -> 23450 -> 34362 breaks Scenario Planning. `pattern_type` is 0 on all seven readiness-relevant MISS rows. | **Data migration, Brain repo, operator admin window.** None of it is reachable from MindrianOS-Plugin. |
| **Live service config** | `BRAIN_HTTP_ADMIN=deny` on Render, set at Phase 261's window close 2026-09-01T20:54:40Z. Confirmed live this session: `tools/list` returns 31 tools, `brain_write` ABSENT, `ingest_framework` ABSENT. This config lives in the Render dashboard, not in git. | **No action by this phase.** Any FLOOR-01 remediation requiring a write must first schedule an operator window. Treat as a hard gate, not a preference. |
| **OS-registered state** | None. Verified: this phase touches no cron, no Task Scheduler entry, no pm2 process. | None. |
| **Secrets / env vars** | `~/.mindrian.env` holds a READ-tier `MINDRIAN_BRAIN_KEY` (40 chars, resolved successfully this session). The gate needs read tier only and refuses cleanly without it. `MINDRIAN_TEST_LIVE_KEY` is unset, which makes acceptance gate-2 SKIP (non-fatal by design). `MINDRIAN_DISABLE_AUTO_REGISTER=1` is set inside the keyless fixtures deliberately, so a live `/register` cannot mint a token and break the assertion. | **No key change.** FLOOR-02 must preserve `MINDRIAN_DISABLE_AUTO_REGISTER=1` in every keyless gate or the inverted fixture becomes non-deterministic. |
| **Build artifacts** | `dist/` mirrors exist for docs/skills/commands per the 252 sweep notes. If FLOOR-02 renames a fixture directory, check for mirrored copies. | Check `dist/` after any rename; low risk since fixtures are test-only. |
| **Working tree** | The tree is **not clean**: multiple staged additions (`prototypes/ink-tui/*`, `docs/MINDRIANOS-PRD.md`, `docs/2026-08-20-gate0-queries.cypher`) from a concurrent session sharing this checkout. | `doctor --acceptance`'s `verify-release-clean-tree` leg will report dirty. This is the documented environmental baseline from 259-04; treat as pre-existing, not a new regression. Do not "fix" another session's staged work. |

---

## Common Pitfalls

### Pitfall 1: Reading a VOID run as a RED run
**What goes wrong:** A transport failure produces exit code 3 with every row VOID, and it gets
recorded as "the floor is red at N/28."
**Why it happens:** Both are non-zero exits. Phase 261 hit this twice in one session and
correctly refused to report a number.
**How to avoid:** Check `voidCount` before reading any pass/miss figure. The gate already prints
a third distinct banner ("FLOOR RUN VOID... this is NOT a floor verdict") specifically so this
cannot happen by reading the output.
**Warning signs:** exit code 3; the miss line qualified as "(lower bound, N row(s) VOID)".

### Pitfall 2: Trusting a carried-forward count
**What goes wrong:** FLOOR-03 has already been wrong twice by carrying a number: the original
requirement assumed 1, 260-05 measured 2, and the requirement text was never updated.
**How to avoid:** Every count in a Phase 262 plan must be re-measured at plan time. The
requirement text itself instructs this. This document's counts are dated 2026-09-02 and should
be re-run, not cited, if the plan locks more than a few days later.
**Warning signs:** any plan sentence containing a number without a measurement command beside it.

### Pitfall 3: Assuming the floor set is the frontmatter scan
**What goes wrong:** `data/flagship-floor-set.json` exists, so the gate filters to 28 ratified
names by **exact, case-sensitive** string membership. A name that drifts by one character in
command frontmatter silently drops out of the floor rather than failing loud.
**How to avoid:** The file's own `_comment` documents this trap and records that the 28-name set
was diffed 1:1 against a live `scanMethodologyCommands()` run with zero mismatches. Re-run that
diff if any command frontmatter changed since 2026-08-11.
**Warning signs:** "Enumerated frameworks this run" printing anything other than 28.

### Pitfall 4: Treating the `<SEP>` nodes as cosmetic
**What goes wrong:** The corruption reads as a display problem, gets deprioritized, and two floor
rows stay red for a milestone.
**Why it happens:** Nothing in the Phase 261 record connects the corruption to the floor gate.
**How to avoid:** Phase 262 must carry the causal link (node ids 28757 and 28775 break named
floor rows) into Brain Phase 5's planning input explicitly.

### Pitfall 5: Fixing `pattern_type` and expecting green
**What goes wrong:** The `pattern_type` defect is the most visible pattern in the miss table, so
it looks like the whole answer. It is not: +1 to every affected row yields 22/28, not 28/28.
**How to avoid:** Use the per-dimension table above. Four Lenses, MECE and Pyramid need separate
work (source-grounded structure/technique/flow enrichment for the first two, a node retarget
ruling for the third).

### Pitfall 6: Editing the Brain repo from a MindrianOS-Plugin GSD phase
**What goes wrong:** The two repos have independent `.planning/` trees and independent roadmaps.
Brain-repo edits made under a Plugin phase number are invisible to the Brain's own STATE and
ledger, which is exactly the unattributable-write class RECON-01 was created to kill.
**How to avoid:** FLOOR-01 remediation is handed off as a written work order with node ids and
measured evidence, filed into the Brain repo's own todo/phase intake, not executed inline.

### Pitfall 7: Rate limits on a 56-probe run
**What goes wrong:** The floor gate makes 2 HTTPS calls per framework, 56 total. A 429 mid-run
previously rendered as BRAIN_UNREACHABLE with zero retries.
**How to avoid:** TRUST-01 fixed this and TRUST-02 makes any residual failure VOID rather than a
false MISS. The 261-13 record notes deployment verification returned exit 0 only on attempt 2
after an initial HTTP 429, so cold-start 429s on the Render instance are real. Expect an
occasional VOID and re-run by hand.

---

## Code Examples

### Reproduce the floor verdict (the phase's primary measurement)

```bash
cd /home/jsagi/dev/MindrianOS-Plugin
node scripts/check-flagship-floor.cjs; echo "EXIT=$?"
# 0 = green, 1 = real MISS present, 2 = malformed override file, 3 = VOID (re-run)
```

### Probe one framework without running the full 56-probe gate

```javascript
// Reuses the gate's own exported client. No second HTTP client (Part 7).
const { brainCall } = require('./scripts/build-brain-census.cjs');
const { resolveBrainKey } = require('./lib/core/resolve-brain-key.cjs');

(async () => {
  const key = resolveBrainKey().key;
  const n = await brainCall('normalize_framework_name', { raw: 'Scenario Planning' }, key);
  const r = await brainCall('orchestration_readiness', { framework_name: 'Scenario Planning' }, key);
  console.log(n.result.canonical_matches);          // -> 2 entries as of 2026-09-02
  console.log(r.result.readiness);                  // -> readiness_score 4
})();
```

### Read-only graph inspection over the read-tier key

```javascript
// brain_query is READ-ONLY and bounded; it refuses any non-read statement.
// Canon Part 8: only generic methodology handles (framework names) cross the wire.
const res = await fetch('https://pws-brain-mcp.onrender.com/mcp', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'accept': 'application/json, text/event-stream',
    'authorization': 'Bearer ' + key,
  },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'brain_query', arguments: {
      cypher: "MATCH (f:Framework) WHERE f.name CONTAINS '<SEP>' RETURN count(f) AS n"
    }},
  }),
});
```

### Prove the aggregator's discovery guard (copy from run-all-259.sh)

```bash
# Must exit non-zero. A harness that discovers nothing must FAIL, not print green.
TEST_262_PREFIX=tests/test-262-nonexistent- bash tests/run-all-262.sh; echo "EXIT=$?"
```

---

## State of the Art

| Old belief | Current verified state | When it changed | Impact |
|---|---|---|---|
| `brain_query` is not registered over HTTPS (2026-08-10 Brain service audit) | `brain_query` **is** live on the read tier, read-only and bounded, 31 tools total | Some time before 2026-09-02 | Live graph inspection is now possible from this repo with a read key. This research depended on it. Update any plan that still assumes an admin key is required to inspect the graph. |
| Floor at 11/28 (Phase 261 Wave 1 baseline, 2026-08-21) | **20/28** | Phase 261 ceremony, 2026-09-01 | +9 rows, the ceremony's real win |
| `:Framework` = 186 (Gate 0 diagnostic) | **258** | Phase 261 relabel | Population is 39 percent larger and 71 of the additions carry corrupted names |
| FLOOR-01 unmeasurable (both 261 attempts VOID) | Measured cleanly, 0 VOID | this session | FLOOR-01 now has a real, trustworthy baseline |
| Scenario Planning "should be 1, measured 2, unexplained" | 2, with the exact Cypher mechanism and node chain identified | this session | The ruling can now be made on evidence rather than on a coin flip between two numbers |
| Tier 0 is a doctrine to be swept | Already dead in code: `tier0-messaging.cjs` renamed 252-01, `getTier0Chain`/`getFrameworkChain` deleted 252-01 | Phase 252 | FLOOR-02's remaining surface is only the fixture and its labels, much smaller than the handoffs imply |

**Deprecated / do not reintroduce:**
- Tier-0 as a serving tier. Ruled dead (`docs/BRAIN-IDENTITY-DESIGN.md`: "Option C is dead by
  navigator ruling"). The keyless path refuses; it never degrades.
- Edge-level `r.order` as an order channel. RECON-02 ruled node-prop `order` the single truth.
- Pinecone / Neo4j as the Brain backend. Retired; Memgraph plus local e5 is current.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The `NOT exists((canon)-[:ALIAS_OF]->(:Framework))` guard is the correct fix for the hop-depth-1 defect | Root Cause 2 | The defect itself is VERIFIED live; the fix form is reasoned from the source, not executed. If wrong, FLOOR-03's recommended ruling still holds (exactly-1 stays correct, 2 is a defect) but the fix needs a different shape. Discharge by executing both candidate forms read-only against canon before the plan locks, exactly as 260's research flag was discharged. |
| A2 | Brain Phase 5's name repair will fully close floor rows 1 and 2 | Root Cause 1 | Phase 5 criterion 3 promises "single-field, not multi-sentence" names for all 100 nodes. If the repaired name still contains the floor framework name as a substring (for example if it is truncated to the leading sentence), the direct branch could still return 2 matches. Discharge by writing the acceptance condition as "`normalize_framework_name` returns exactly 1 for HSI and TVC," not "names are repaired." |
| A3 | The 71 `<SEP>` `:Framework` nodes are exactly the 71 the relabel restored | Root Cause 1 | Counts match exactly (71 = 71) and the id range matches exactly (all in 28000-29000), which is strong but circumstantial. If a pre-existing `<SEP>` node happened to be relabeled independently, the attribution is slightly off; the floor impact is unchanged either way. |
| A4 | The keyless fixture inversion can keep all 5 acceptance gates green | FLOOR-02 | Baseline is green today. Risk is low; the inversion adds assertions rather than changing behavior. |
| A5 | No further graph drift between this research and Phase 262's plan lock | throughout | The admin write surface is closed, so unattributed drift is unlikely. Still, re-run the floor gate at plan time rather than citing this document's numbers. |
| A6 | The floor gate reports a silent 0/28 false RED against Theo | Theo Flip | The two payload shapes are VERIFIED from both sides' source; the composed outcome is reasoned, not executed, because `theo-mcp` returns 502 and cannot be probed. Discharge by running the gate against Theo the moment `/health` returns 200, BEFORE the flip. If wrong, the recommended `unrecognized_shape` VOID tripwire is still correct and costs almost nothing. |
| A7 | All 28 ratified floor names resolve against Theo's 149-framework population | Theo Flip | Unmeasurable until the origin serves. If wrong, the ratified denominator needs re-ratification against a different population, which is a navigator decision, not an engineering one. |
| A8 | Theo's flip does not land before Phase 262 executes | throughout | 08.4 is one 502 and one checkpoint from closing. If the flip lands mid-phase, every incumbent measurement in this document becomes historical and the phase must re-baseline against Theo. |

---

## Open Questions

1. **Who owns the `pattern_type` write-path defect?**
   - What we know: the Brain repo filed it as a pending todo on 2026-09-02 and explicitly kept
     it out of Phase 5's scope as "a scoring/readiness-pipeline defect, not a graph-schema one."
     It blocks at least 2 floor rows outright (Adaptive, Mullins) and contributes to 3 more.
   - What is unclear: no phase in either repo owns it. FIX-01 passed for an id-targeted payload
     but the name-targeted existing-framework payloads did not land the property, so the defect
     is narrower than "FIX-01 failed."
   - Recommendation: Phase 262 names it in the gap ledger with the measured evidence and routes
     it as a Brain-repo scoping request. Do not absorb it into 262; it needs its own root-cause
     pass and probably its own Brain phase.

2. **Does FLOOR-01 close in this milestone at all?**
   - What we know: 6 of 8 rows need graph writes, the write surface is closed, and the two
     phases that would open it (Brain Phase 5, plus an unowned `pattern_type` phase) are not
     scheduled against v2.1.0.
   - What is unclear: whether the navigator wants v2.1.0 to wait, or wants FLOOR-01 re-scoped to
     "measured, attributed, and routed" with the green run itself moved to a successor.
   - Recommendation: put this to the navigator as a blocking Decision Gate in the plan's first
     wave, with three options: (a) wait for Brain-side work, (b) accept a ratified 20/28 with a
     signed gap ledger and move FLOOR-01's green run to a successor milestone, (c) reduce the
     ratified denominator, which this research recommends rejecting.

3. **Do Phases 254 and 255 actually need 28/28, or do they need 20/28 plus a known-gap list?**
   - What we know: both are gated on 262 because "they read the `:Framework` population and need
     it clean." The population is measurably cleaner than before (self-loops zero, 20/28 passing)
     but carries 71 corrupted names.
   - What is unclear: whether 254's projection consumption and 255's section-affinity ranking are
     actually harmed by a corrupted-name node that no exact-name lookup will ever hit.
   - Recommendation: measure it rather than assume. A cheap probe (does the orchestration
     projection surface any `<SEP>` node?) turns this from a blocking assumption into a fact, and
     may unblock 254/255 independently of FLOOR-01.

4. **Should FLOOR-02 ship before or after FLOOR-01 goes green?**
   - What we know: the original SWEEP-02 framing gated the fixture inversion on
     `check-flagship-floor.cjs` exiting 0 (`docs/AMENDMENT...:167`, "gated on exit 0").
   - What is unclear: whether that gate was a sequencing preference or a real dependency. There
     is no technical coupling: the fixture is hermetic and never contacts the Brain.
   - Recommendation: propose decoupling. FLOOR-02 is fully deliverable now and holding it hostage
     to a graph-state requirement it does not depend on costs the milestone a shippable win.

5. **Does FLOOR-01 remediation have a hard deadline at the Theo flip?**
   - What we know: Theo's `brain_write` "refuses, every call, unconditionally, by name, with no
     write path behind it." The incumbent's admin surface is closed but reopenable. Theo's is
     not. Theo's hosting blocker is one 502 and one navigator checkpoint from closing.
   - What is unclear: whether the incumbent Brain stays writable in parallel after the flip, or
     is decommissioned, and whether Theo Phase 10's framework-ingestion contract is the intended
     successor path for exactly this kind of enrichment.
   - Recommendation: put this to the navigator with Open Question 2, as one decision rather than
     two. "Do the FLOOR-01 graph fixes before the flip, or re-express them as Theo ingestion"
     is the real fork, and the answer changes what Phase 262 hands off and to whom.

6. **Should the floor gate be adapted to Theo in this phase or at flip time?**
   - What we know: the gate is an uncovered consumer, absent from Theo's 7-file list. The
     tripwire (unrecognized shape becomes VOID) is correct today and testable hermetically. The
     actual shape adaptation is not testable at all while `theo-mcp` returns 502.
   - Recommendation: tripwire now in 262; shape adaptation at flip time with the other 7 files.
     Send `check-flagship-floor.cjs` and `scripts/build-brain-census.cjs` to Theo's session for
     addition to the adaptation list, and check for a reply from
     `Brain-Theo graph reconciliation execution [3228bb]` before assuming the open question
     about starting plugin-side adaptation is still unanswered.

7. **Pyramid Principle: retarget or enrich?**
   - What we know: 261-04 found `minto-pyramid.mjs` targets "Minto Pyramid" (38968, 3/4) while
     the ratified floor name is "The Pyramid Principle" (30242, measured 0/4 live today). 261-04
     disposed it RETARGET but the content was held, and 261-12's residue confirms "Pyramid
     retarget content was held."
   - Recommendation: this is a one-row, well-understood ruling. Surface it as a card in 262 with
     both competing survivor rulings intact, since 261-08 recorded them unadjudicated.

8. **[ADDENDUM, orchestrator-level check post-research] Does Theo's own resolver already avoid
   the FLOOR-03 defect class, and does that change what the plan asks the Brain repo to build?**
   - What we know, read directly from Theo's source this session (not covered by Q5/Q6 above,
     which were scoped to the flip-timing question rather than the resolver's actual shape):
     `Theo/src/mcp/content/normalize-framework-name.ts` documents its `resolveFramework` door as
     doing an exact `:Framework` lookup, then an `ALIAS_OF` walk bounded at `MAX_ALIAS_HOPS`,
     "the cycle control, the fork refusal, and the five refusal codes." A fork -- the EXACT shape
     of the FLOOR-03 defect (two survivor names off one hop-depth-1 branch) -- is a named,
     explicit `ALIAS_FORK` refusal code in Theo's design, not a silent multi-match. Theo already
     treats "two canonical candidates" as a canon-repair signal to surface, not something to
     resolve and return.
   - What this changes: the planner should NOT write 262's Brain-repo work order as "add a fork
     guard to `NORMALIZE_NAME_CYPHER`" framed as new invention -- frame it as "close the gap
     between the current Brain's silent-fork behavior and the refusal-on-fork behavior Theo's
     resolver already ships," citing Theo's `ALIAS_FORK` code as the target shape. This is the
     same fix (assumption A1's `NOT exists(...)` guard direction still holds), but the work order
     now has a working reference implementation to point at instead of a from-scratch design, and
     the finding is worth a line in the phase's gap ledger for whoever picks up the Brain-repo
     side. Live counts as of this research: Theo holds 149 Frameworks / 29 `ALIAS_OF` edges
     (2026-08-31 count) against the current Brain's 184 `:Framework` nodes -- a smaller, growing
     population, not yet at parity, so this is a design-shape finding to carry forward, not proof
     Theo is already floor-ready.
   - Not independently re-verified against a live Theo instance this session (source-read only);
     tag confidence MEDIUM, same tier as assumption A1.

---

## Environment Availability

| Dependency | Required by | Available | Version / state | Fallback |
|---|---|---|---|---|
| Node.js | every script | yes | repo floor is >= 22.16.0 | none needed |
| Read-tier Brain key | FLOOR-01, FLOOR-03 measurement | **yes** | `~/.mindrian.env`, 40 chars, resolved this session | none; the gate refuses cleanly with a named reason |
| Deployed Brain HTTPS `/mcp` | FLOOR-01, FLOOR-03 | **yes** | `https://pws-brain-mcp.onrender.com`, 31 tools, HTTP 200 | none; a failure produces VOID, not a false verdict |
| `brain_query` (read-only Cypher) | root-cause tracing | **yes** | live on read tier | `text2cypher` exists but is a known exposure; do not use |
| `brain_write` / `ingest_framework` | any FLOOR-01 remediation | **NO** | ABSENT from live `tools/list`; `BRAIN_HTTP_ADMIN=deny` since 2026-09-01T20:54:40Z | **No fallback.** Requires an operator-opened admin window. |
| Brain MCP tools via `mcp__plugin_mos_mindrian-brain__*` | optional | not used this session | a 401 was reported earlier in this session | Direct HTTPS via `brainCall` and `brain_query` worked perfectly and is the recommended path for scripted probes anyway |
| `MINDRIAN_TEST_LIVE_KEY` | acceptance gate-2 only | no | unset | gate-2 SKIPs, non-fatal by design |
| Clean working tree | `doctor --acceptance` `verify-release-clean-tree` leg | **no** | staged files from a concurrent session | documented environmental baseline (259-04); treat as pre-existing, gate on no-NEW-regression |
| `~/MindrianRooms/rethinking-mindrianos/research/` | Dev-Research Compositing convention | yes | exists | none |
| Theo remote origin `https://theo-mcp.onrender.com` | post-flip floor measurement | **NO** | service exists (paid starter, `srv-dabhg8dcqm1c73dkp7c0`), `/health` returns **HTTP 502**, not serving | none; the incumbent Brain is the only measurable surface today. Re-probe before assuming any Theo behavior. |
| `/home/jsagi/Theo/` repo on disk | reading the cutover contract | yes | Phase 08.4 at 6/7, Phase 09 at 10/12 | none needed; source and `09-MOS-LEARNING.md` read directly this session |

**Missing dependencies with no fallback:** the Brain admin write surface. This is the single
hard blocker on FLOOR-01 and must appear in the plan as a gate, not a task.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|---|---|
| Framework | `node --test` (Node.js built-in) for `.cjs`; plain `bash` for `.sh` |
| Config file | none; discovery is by `tests/run-all-<phase>.sh` glob convention |
| Quick run command | `node --test tests/test-262-<leg>.cjs` |
| Full suite command | `bash tests/run-all-262.sh` |

### Phase Requirements to Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| FLOOR-01 | The gate's pure evaluator still returns the documented verdict precedence after any 262 change | unit, hermetic | `node --test tests/test-249-floor-gate.cjs` | yes, reuse |
| FLOOR-01 | VOID precedence and the three distinct banners are unchanged | unit, hermetic | `node --test tests/test-259-floor-void.cjs` | yes, reuse |
| FLOOR-01 | The ratified denominator still matches the live frontmatter scan 1:1 | unit, zero network | `node --test tests/test-262-floor-denominator.cjs` | **no, Wave 0** |
| FLOOR-01 | A successful probe with an unrecognized payload shape produces VOID, never MISS (the Theo tripwire) | unit, zero network | `node --test tests/test-262-unrecognized-shape-voids.cjs` | **no, Wave 0** |
| FLOOR-01 | The live gap ledger matches a live run (evidence freshness) | live, human-gated | `node scripts/check-flagship-floor.cjs` at a `checkpoint:human-verify` | n/a, checkpoint |
| FLOOR-02 | Keyless path returns the byte-locked `no_key` refusal AND serves no methodology content | integration, hermetic | `bash tests/test-127-03-acceptance-gates.sh` | yes, modify |
| FLOOR-02 | The refusal fixture directory still exists (never-deleted proof) | unit, zero network | `node --test tests/test-262-refusal-fixture-retained.cjs` | **no, Wave 0** |
| FLOOR-02 | Shim handshake keyless assertion still green under the new labels | integration | `bash tests/test-127-00-shim-handshake.sh` | yes, reuse |
| FLOOR-02 | Class-M cascade unaffected by the relabel | integration | `bash tests/test-127-02-doctor-class-m.sh` | yes, modify (label only) |
| FLOOR-02 | Wire string `DIRECTOR_NOT_AVAILABLE` unchanged | unit | `node --test lib/core/refusal-messaging.test.cjs` | yes, reuse (regression lock) |
| FLOOR-03 | The re-ruling is recorded with its live measurement and date | doc gate | grep the plan/summary for the measured count plus its command | n/a |
| all | No em-dashes in any file this phase touches | lint | the `run-all-262.sh` em-dash fence | **no, Wave 0** |

### Sampling rate

- **Per task commit:** `node --test tests/test-262-*.cjs` (hermetic, sub-second)
- **Per wave merge:** `bash tests/run-all-262.sh`
- **Phase gate:** `bash tests/run-all-262.sh` plus `bash tests/run-all-127.sh` plus
  `bash tests/run-all-259.sh` (the two suites 262 modifies or depends on) all green before
  `/gsd-verify-work`
- **Live legs are never in the automated sampling rate.** The floor run is a human-gated
  checkpoint, because a 429 makes it VOID and D-08 forbids auto-retry.

### Wave 0 gaps

- [ ] `tests/run-all-262.sh` - aggregator, copied from `run-all-259.sh`, with the
      `TEST_262_PREFIX` discovery guard and the em-dash fence
- [ ] `tests/test-262-floor-denominator.cjs` - proves `data/flagship-floor-set.json` still
      matches `scanMethodologyCommands()` 1:1, and proves the file was not narrowed
      (assert `frameworks.length === 28` and pin `ratified_at`)
- [ ] `tests/test-262-refusal-fixture-retained.cjs` - proves the repurposed fixture directory
      still exists and its README asserts refusal, not availability (the "never deleted" clause
      made machine-checkable)
- [ ] `tests/test-262-unrecognized-shape-voids.cjs` - feeds `evaluateFloor` a row whose probe
      succeeded but whose payload carried neither `canonical_matches` nor
      `readiness.readiness_score` (that is, Theo's actual shapes) and asserts VOID with exit 3,
      not MISS with exit 1. Zero network; this is the Theo tripwire made hermetic.
- [ ] No framework install needed; `node --test` is built in

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this phase |
|---|---|---|
| V2 Authentication | yes | Read-tier bearer key resolved only through `lib/core/resolve-brain-key.cjs`. Never hard-code, never log, never echo a key value. The gate already refuses cleanly with a reason when the key is unavailable. |
| V3 Session Management | no | Stateless HTTPS tool calls |
| V4 Access Control | **yes, critically** | The floor gate is a READ-tier operation by design (`check-flagship-floor.cjs`: "This gate needs a READ-tier key... No admin key is used"). Any 262 task that reaches for an admin key violates the admin-window discipline that Phase 261 spent a whole plan establishing. |
| V5 Input Validation | yes | `parseOverrideFile()` fails loud with a distinct exit code 2 on malformed JSON or shape. Never silently accept a partial override. |
| V6 Cryptography | no | No crypto authored here |
| V7 Error Handling / Logging | yes | `_capDetail()` collapses whitespace runs and caps Brain-supplied text at 300 chars before printing. This is a log-injection and disclosure control, not cosmetics (Phase 259 D-06). Any new printer for Brain text must reuse it. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Cypher injection via a framework name | Tampering | Parameterized Cypher only (`$raw`). Never interpolate a name into a query string. `brain_query` refuses non-read statements server-side. |
| Log injection via Brain-returned text | Tampering / Repudiation | `_capDetail()`: collapse `\s+`, trim, slice to 300 |
| Admin-surface exposure | Elevation of privilege | `brain_write` / `ingest_framework` stay ABSENT. Admin disable is the LAST scripted write item of any window (the 2-day-open lesson). This phase opens no window. |
| `text2cypher` executing model-authored Cypher | Elevation of privilege | Do not use. Named as an open exposure in the 2026-08-10 Brain service audit. Use `brain_query`. |
| Canon Part 8 breach (LOCAL to BRAIN egress) | Information disclosure | Only generic methodology handles cross the wire. Every probe in this research sent a framework name and nothing else. Room content, user text and file paths must never appear in a `brain_*` argument. |
| Secret disclosure in a refusal message | Information disclosure | Refusal reasons may name a key FILE PATH but never a key VALUE or file CONTENTS (`refusal-messaging.cjs` header, V5 rule). FLOOR-02's new assertions must not print the key. |

---

## Project Constraints (from CLAUDE.md)

Directives the planner must honor and the plan-checker must verify:

1. **Workspace guard.** Every commit and git operation runs from
   `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/mindrian-os/`. Run `pwd`,
   `git fetch origin main`, and check ahead/behind before starting.
2. **No em-dashes anywhere.** Hyphens only. Enforce with the `grep -P '\x{2014}'` fence in the
   phase aggregator.
3. **GSD-only edits.** No direct repo edits outside a GSD workflow.
4. **Canon Part 8 (Graph Boundary).** User data never egresses to the Brain; only generic
   methodology handles cross. Absolute.
5. **Canon Part 7 (Reuse Before Build).** Justify any net-new surface. This phase should author
   approximately zero new infrastructure; every client, parser and evaluator already exists and
   is exported.
6. **Canon Part 11 (CIRS).** Any new invocable surface is born WIRED or EXCLUDED with a declared
   HITL shape. A test script and an aggregator are not invocable surfaces, so this is likely
   inert here, but verify if the plan adds a `/mos:` command or a skill.
7. **Canon Part 6 (Dog-Fooding).** The plugin honors its own canon in its own room.
8. **Tri-Polar Design Rule.** Evaluate CLI, Desktop and Cowork. FLOOR-02's keyless refusal is a
   three-surface behavior: a skip on any surface must be a stated call, not an oversight.
9. **Dev-Research Compositing.** This phase touches MindrianOS's own architecture, so findings
   file in BOTH `.planning/phases/262-.../` AND
   `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, mirrored to
   `mindrianOS/research/`, cross-linked. Neither substitutes for the other.
10. **Consult all relevant grounding sources.** Context7 for library/API contracts,
    claude-code-guide for Claude Code internals, icm-architect for room/local-graph work,
    langtalks for agent/LLM concepts. Pick the source that actually covers the claim.
11. **QA and RCA reporting.** If the `pattern_type` defect or the `<SEP>` regression is worked as
    a defect rather than routed, it goes to `.planning/debug/<slug>.md` in the RCA template
    (`docs/RCA-TEMPLATE.md`), `git add -f` since `.planning/` is gitignored.
12. **Verification before done.** `bash tests/run-all-<phase>.sh`, `scripts/verify-release`,
    `node scripts/doctor.cjs --acceptance`. Users never run these; Claude runs them.
13. **Release lockstep.** Never bump versions by hand; `scripts/release.sh <version>` enforces
    all five gates.
14. **Cross-repo awareness.** The Brain lives in `jsagir/ProblemsWorthSolving-Brain` with its own
    CLAUDE.md and its own planning tree. Changes there do not appear in this repo's history.
    Check both when Brain behavior is in question.

---

## Sources

### Primary (HIGH confidence, measured or read this session)

- **Live floor gate run**, `node scripts/check-flagship-floor.cjs` against
  `https://pws-brain-mcp.onrender.com`, 2026-09-02: exit 1, 20/28 PASS, 8/28 MISS, 0 VOID
- **Live `normalize_framework_name` probes** for all 8 MISS rows plus
  "Scenario planning methodology" and "Shell Scenario Planning Method"
- **Live `orchestration_readiness` probes** for all 8 MISS rows, with per-dimension breakdown
- **Live `brain_query` reads**: `:Framework` count (258), `<SEP>` count (71), `<SEP>` count in
  ids 28000-29000 (71), HSI phantom (28757), TVC phantom (28775), the full Scenario alias
  topology
- **Live `tools/list`**: 31 tools, `brain_write` ABSENT, `ingest_framework` ABSENT,
  `brain_query` PRESENT
- **Live acceptance-gate run**, `bash tests/test-127-03-acceptance-gates.sh`: 4 PASS, 1 SKIP, exit 0
- `/home/jsagi/dev/MindrianOS-Plugin/scripts/check-flagship-floor.cjs` (310 lines, read in full)
- `/home/jsagi/dev/MindrianOS-Plugin/lib/core/refusal-messaging.cjs` (lines 1-200)
- `/home/jsagi/dev/MindrianOS-Plugin/tests/test-127-03-acceptance-gates.sh` (215 lines, read in full)
- `/home/jsagi/dev/MindrianOS-Plugin/tests/run-all-259.sh` (the aggregator template)
- `/home/jsagi/dev/MindrianOS-Plugin/data/flagship-floor-set.json`
- `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md` and its four `@include` files
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs` (lines 75-120,
  `NORMALIZE_NAME_CYPHER`)
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/docs/2026-08-21-RECORD-261-ceremony.md`
  (sections 3-8, including the Phase 262 handoff)
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/docs/2026-08-21-WORKLIST-261-ceremony.md`
  (pre-ceremony per-row table, lines 30-31 and 107/126)
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/.planning/ROADMAP.md` (Phases 1-6, no FLOOR ids)
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/.planning/phases/05-.../05-CONTEXT.md` (D-04)
- Brain repo commit `56bf75a` (the `pattern_type` pending todo, dated 2026-09-02)
- `.planning/phases/261-.../261-12-SUMMARY.md` and `261-13-SUMMARY.md` (13/13 on disk)
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md` (the cutover
  contract: all 13 tool fates, the response-envelope section, the silent-empty warning)
- `/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts` (lines 485-505, the payload
  shape and the hardcoded `unsynced_inputs: ['pattern_known']`)
- `/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts` (the `{canonical, matched_via,
  coverage}` shape and the omit-on-not-found rule)
- `/home/jsagi/Theo/.planning/phases/08.4-remote-hosting-mcp-server/08.4-DEPLOY-PROBE.md`
  (the live 502, the origin, the service id, the instance tier)
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-11-PLAN.md` and
  `09-12-PLAN.md` frontmatter (the `external_gate` on 08.4 and the coordinated-release note)
- `docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md` (finding #1 fixed
  in `brain-client.cjs`, the 7-file adaptation list, the stale 269-05 checklist warning)

### Secondary (HIGH confidence, tracked repo docs)

- `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` (ledger item 5, the fixture inversion, ratified)
- `docs/BRAIN-IDENTITY-DESIGN.md` (Option C dead; SWEEP-02 inverts the keyless fixture)
- `docs/2026-08-09-HANDOFF-tier0-removal-milestone.md:135` (the origin spec for the inversion)
- `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md:106` ("repurpose, do not delete")
- `.planning/REQUIREMENTS.md` (FLOOR-01/02/03, TRUST-01/02, FIX-01..04, CER-01..06)
- `.planning/ROADMAP.md` (Phases 254, 255, 258, 259, 260, 261, 262, 263)
- `.planning/STATE.md` (259-04 live floor checkpoint at 11/28; the doctor --acceptance 15/16
  environmental baseline)

### Not consulted (and why)

- Context7: this phase authors no new library dependency and touches no third-party API contract.
  Every API in scope is first-party (the Brain's own MCP tools) and was probed live, which is
  strictly more authoritative than any doc for a deployed surface.
- WebSearch: nothing here is time-sensitive or external.
- `mcp__plugin_mos_mindrian-brain__*`: a 401 was reported earlier in this session. Direct HTTPS
  via the repo's own `brainCall` and `brain_query` worked, and is the correct scripted path
  regardless.

---

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. Every dependency is first-party
and already in the repo: `node --test` (built in), `scripts/build-brain-census.cjs`,
`lib/core/resolve-brain-key.cjs`, `lib/core/refusal-messaging.cjs`. No `npm install` line should
appear in any Phase 262 plan. If one does, the plan has drifted from Part 7.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Floor state (20/28, the 8 rows, per-dimension) | HIGH | Measured live this session, zero VOID rows, cross-checks exactly against the Phase 261 post-close record |
| `<SEP>` regression attribution | HIGH | Three independent confirmations: count matches 71 to 71, id range matches exactly, tracked pre-ceremony worklist shows 1 match for both rows |
| FLOOR-03 root cause | HIGH | Cypher read from source, alias topology queried live, and the mechanism reproduced by an independent probe on "Scenario planning methodology" |
| FLOOR-03 recommended fix form | MEDIUM | Reasoned from the source, not executed live. Tagged A1 in the assumptions log with a discharge procedure |
| FLOOR-02 file set and scope | HIGH | Every file read, baseline run green this session |
| Repo ruling | HIGH | Both repos' planning trees inspected; live tool surface confirms the write seam is closed |
| `pattern_type` ownership gap | HIGH | The Brain repo's own todo file states it was reviewed and excluded from Phase 5 |
| Whether 254/255 truly need 28/28 | LOW | Assumed from the roadmap's prose, never measured. Open Question 3 |
| Theo payload shapes and the gate's two unread keys | HIGH | Both sides read from source this session; the mismatch is structural, not inferred |
| The composed 0/28 silent-false-RED outcome | MEDIUM | Reasoned from two verified shapes plus verified gate code, but not executed, because `theo-mcp` returns 502. Tagged A6 with a discharge procedure |
| Theo flip timing | MEDIUM | 08.4 at 6/7 with a live-but-502 origin is a strong signal, but it sits behind a navigator checkpoint whose timing is not mine to predict |

**Research date:** 2026-09-02
**Valid until:** 2026-09-09 (7 days), **or the moment `https://theo-mcp.onrender.com/health`
returns 200, whichever comes first.** That second condition is the real one. This is fast-moving
on three axes: the graph is live and an operator window could open at any time, a concurrent
session shares this working tree, and Theo's hosting blocker is one 502 and one navigator
checkpoint from closing. Re-run `node scripts/check-flagship-floor.cjs` at plan lock rather than
citing this document's numbers, and re-probe Theo's `/health` before trusting any statement here
about which Brain the gate is measuring.
