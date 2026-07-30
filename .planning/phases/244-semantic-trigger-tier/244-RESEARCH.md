# Phase 244: Semantic Trigger Tier - Research

**Researched:** 2026-07-30
**Domain:** local lexical retrieval (SQLite FTS5/bm25), rank fusion (RRF), diversity reranking (MMR), sensor/dial wiring
**Verified against HEAD:** `a282abe4` ("docs: seed Phase 244 (Semantic Trigger Tier) into the v1.16.x pipeline")
**Confidence:** HIGH on the codebase findings (every one re-read live and probe-verified this session), MEDIUM on the RRF/MMR literature constants (WebSearch-sourced, cross-checked against this repo's own shipped implementation).

> **Concurrency note.** Another session is committing to this repo in parallel. Every file:line
> citation below was read at `a282abe4` and, where load-bearing, verified by executing code against
> the live tree. Re-grep before editing; line numbers can shift, but the SYMBOL names cited are
> stable anchors.

---

## Summary

This phase is **not the greenfield build the ROADMAP describes**. The single most important finding
of this research is that **the FTS5+bm25 retrieval leg and the Reciprocal Rank Fusion implementation
that TRIG-01 and TRIG-02 ask for already ship in this repo**, in production, written in Phase 211-02
and hardened in Phase 219-02. `lib/core/eureka/tri-modal-index.cjs` owns an `eureka_fts` FTS5 virtual
table with the porter tokenizer, a `bm25()` ranked `lexicalSearch()`, a capability probe, and a
graceful bi-modal degrade. `lib/core/eureka/hybrid-retrieve.cjs` owns `rrfFuse(rankedLists, k)`,
rank-position based, 1-based, `1/(k+rank)`, with a researched room-scale `k=25`. Building either from
scratch would be a Canon Part 7 (reuse before build) violation of exactly the kind the Canon exists to
prevent.

The second finding reshapes the phase's other half. **`trigger_tier` is decorative today.** It is
computed once in `normalizeTurn` and stamped onto a copy of the turn; 2 of the 17 registered sensors
copy it into their evidence bag; **zero consumers gate, score, rank, or filter on it.** Its own
doctrine comment says so: "Mints NO reach and NO edge - it is a classifier only"
(`sensor-types.cjs:72`). Adding a `'content'` string to the `TRIGGER_TIERS` array therefore satisfies
the letter of TRIG-01 and changes nothing at runtime. TRIG-01 needs a real **sensor** that queries the
index and mints a candidate reach.

The third finding is a genuine defect in the ROADMAP's own premise and is flagged below as
**RESEARCH BLOCKER B-1**. `f-selector-ranker.cjs:733` is confirmed byte-for-byte as described, but the
`scored` array it sorts contains **commands read from `data/command-registry.json`**, not sensor
candidate reaches. It carries no trigger-tier field and never has. Sensor reaches flow through a
completely different path (`dispatchSensors` -> `decide()` -> `buildReachList`). "Fuse candidate
scores across trigger-tier families at line 733" is not implementable as written, because no trigger
families are present at that line. The planner must pick a target surface, and both defensible options
are laid out below.

**Primary recommendation:** Reframe Phase 244 as a **wiring-and-lifecycle phase, not a build phase**.
Author one new `sensor-content-relevance.cjs` following the exact 3-layer split
`sensor-expert-skill.cjs` already establishes (pure sensor / ctx-assembly db-reading producer / gate
action), have its producer call the **already-shipped** `tri-modal-index.lexicalSearch`, close the
`eureka_fts` index-lifecycle gap (Pitfall 2, the index does not exist in live rooms), and add the one
genuinely net-new piece, the MMR diversity pass, reusing the Jaccard similarity primitive that also
already ships at `lexical-overlap.cjs:75`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Turn-text tokenize + FTS MATCH sanitization | Pure CJS core (`lib/core/eureka/tri-modal-index.cjs`) | - | Already owned by `toFtsMatch`; raw text throws (proven, Pitfall 1) |
| bm25 lexical retrieval over room.db | SQLite (room.db, `eureka_fts` virtual table) | - | Storage tier owns the index; zero deps |
| room.db read for the sensor | Engine ctx-assembly (`navigation-engine.cjs` sensorCtx block) | - | Sensors are pure/sync/zero-IO by contract; `sensor-expert-skill.cjs` precedent |
| Candidate-reach minting | Pure sensor (`lib/core/sensors/`) | - | `dispatchSensors` chokepoint, Phase 144 fence |
| Cross-family rank fusion (RRF) | Pure CJS (`lib/core/eureka/hybrid-retrieve.cjs::rrfFuse`) | Ranker (`f-selector-ranker.cjs`) | Fusion primitive already exists; only the call site is new |
| Diversity/MMR pass | Ranker layered-adjustment pass (`f-selector-ranker.cjs`) | `lexical-overlap.cjs` for `sim()` | Third instance of the `_applySens10Flip`/`_applyRoleLevelBias` pattern |
| Index build/refresh lifecycle | room-db migration chain + a refresh hook | `scripts/entity-extract.cjs` | Currently an orphan; see Pitfall 2 |

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that bind this phase. The planner must verify compliance.

| Directive | Source | Effect on this phase |
|-----------|--------|----------------------|
| **No em-dashes anywhere; hyphens only** | Conventions block | Every file this phase writes, including tests and comments |
| **CJS only, no TypeScript**; `lib/core/*.cjs` ships as source | Conventions | New sensor is `.cjs`, no build step |
| **Canon Part 7 - Reuse Before Build** | Canon Compliance Core | **Binding and decisive here.** `rrfFuse` and `lexicalSearch` exist. Rebuilding either is a violation |
| **Canon Part 8 - Graph Boundary (LOCAL -> BRAIN: NO)** | Canon Compliance Core | Reach evidence carries closed scalars/enums only, never turn prose or matched text |
| **Canon Part 9 - Memory Locality** | Canon Compliance Core | `navigation.cjs` is the single SQL chokepoint; the FTS index is a derived projection, not graph memory |
| **Canon Part 11 R3 (CIRS)** | Canon Compliance Core | Every invocable surface born WIRED or EXCLUDED, with a declared HITL shape |
| **Tri-Polar Design Rule** | CLAUDE.md | Content tier must behave on CLI, Desktop, and Cowork, or the skip is a stated call |
| **Frozen REACH_IDS (exactly 6) / POSTURE_IDS (exactly 3)** | `sensor-types.cjs:43-58` + Phase 148 D-09 | The content sensor must ride an EXISTING reach id. Minting a 7th fails the drift contract |
| **Shape F frozen scalars: MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 detent** | Canon Part 3 | The MMR pass must not change these |
| **Run `bash tests/run-all-<phase>.sh` before declaring done** | Verification block | Phase needs `tests/run-all-244.sh` |
| **Consult ALL relevant grounding sources** | CLAUDE.md mandate | See Grounding Consultation Record below |
| **Dev-Research Compositing** | CLAUDE.md | This file must be mirrored to `~/MindrianRooms/rethinking-mindrianos/research/` |

---

## Grounding Consultation Record

Honest reporting of what was and was not reachable this session.

| Source | Mandated for | Status | Outcome |
|--------|-------------|--------|---------|
| **Context7 MCP** (`node:sqlite` FTS5 API) | CLAUDE.md, "any claim about a named library/runtime API" | **UNAVAILABLE.** MCP tools are stripped from this agent (upstream `anthropics/claude-code#13898`); `ctx7` CLI not installed | **Substituted with something stronger:** the official SQLite FTS5 specification (`sqlite.org/fts5.html`) fetched directly, PLUS live execution against this repo's own runtime. Every API claim below is `[VERIFIED: live execution on v22.23.1]`, not doc-inferred |
| **langtalks-graph-expert MCP** | CLAUDE.md, agent/LLM retrieval-and-ranking concepts | **UNAVAILABLE** (same MCP stripping) | RRF/MMR grounded via primary literature search instead, then **cross-verified against this repo's own shipped `rrfFuse`**, which independently arrived at the same formula. Recorded as a real gap: a langtalks pass on "content-tier trigger design" is still owed and should run at `/gsd-discuss-phase` time |
| **SQLite official FTS5 docs** | bm25 sign convention, external-content, tokenizers | Reached | `[CITED: sqlite.org/fts5.html]` |
| **Live runtime probes** | Everything load-bearing | Reached | Node v22.23.1, SQLite 3.51.3, `ENABLE_FTS5=1` |

**Planner action:** do not treat the langtalks gap as closed. It is an open item, not a non-finding.

---

## Runtime Environment (verified live)

| Property | Value | How verified |
|----------|-------|-------------|
| Node | `v22.23.1` | `process.version` |
| Bundled SQLite | `3.51.3` | `SELECT sqlite_version()` |
| FTS5 compiled in | **yes** | `SELECT sqlite_compileoption_used('ENABLE_FTS5')` returns `1` |
| `package.json` engines | `>=22.16.0` | Phase 236-04 floor, unchanged. **No new floor needed**: FTS5 is a compile option of the bundled SQLite, not a `node:sqlite` API addition |
| bm25 available | yes | `SELECT bm25(t)` executes |
| External-content FTS5 over a **VIEW** | **yes, works** | probe below |
| `INSERT INTO fts(fts) VALUES('rebuild')` | yes | probe below |

`[VERIFIED: live execution]` All of the above executed this session.

**Version floor conclusion:** this phase introduces **no new Node version floor**. The already-established
`>=22.16.0` (Phase 236-04, the `timeout` constructor option) remains the binding constraint and is
strictly higher than anything FTS5 needs.

---

## Package Legitimacy Audit

**This phase installs ZERO external packages.** The stack constraint is satisfiable in full: FTS5 ships
inside the bundled SQLite, and both the retrieval and fusion primitives already exist in-repo.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | - | No new dependency. Constraint honored |

**slopcheck:** not run, because there is nothing to check. No package is recommended by this research.

**Existing dependencies relevant to the exclusion list** (see Finding F-10):

| Package | Version in `package.json` | Relevance |
|---------|--------------------------|-----------|
| `sqlite-vec` | `^0.1.9` | **Already a dependency.** A LOCAL vector index already ships |
| `@huggingface/transformers` | `^4.2.0` | **Already a dependency.** A LOCAL embedding/rerank runtime already ships |
| `flexsearch` | `^0.7.43` | Already a dependency (wiki search, unrelated) |

---

## The Five Mandated Questions

### Q1. Does `sensor-types.cjs` still match the description, and where does `content` slot in?

**Re-read fresh at HEAD. The description holds, with one correction and one critical caveat.**

`TRIGGER_TIERS` is at `lib/core/sensors/sensor-types.cjs:73-77`:

```js
const TRIGGER_TIERS = Object.freeze([
  'signal',
  'context',
  'keyword',
]);
```

`classifyTriggerTier` is at `:174-180`. The precedence is exactly as described: signal, then context,
then keyword-as-fallback, then `null`.

**Correction to the ROADMAP text:** the ROADMAP calls these "three tiers" with `signal` and `context`
ranked above `keyword`. The doctrine comment at `:168-170` is more specific and is load-bearing for
this phase:

> "NOTE: 'signal' and 'context' are BOTH context-tier (both rank above keyword). A caller that only
> needs the binary context-vs-fallback decision can compare `classifyTriggerTier(...) === 'keyword'`
> (fallback) against anything else."

So the real doctrine is a **binary** with a 3-value vocabulary: `{signal, context}` = context-tier,
`{keyword}` = fallback. Any consumer written against the documented binary idiom
(`tier === 'keyword'`) will classify a new `'content'` tier as **context-tier by default**, because it
is "anything else". That is an accidental, silent promotion above keyword.

**Where `content` slots in - the doctrine DOES settle it, but only partially.**

Canon Part 11 R3 as quoted at `:61-72` says a trigger keys on navigator PROBLEM-STATE read locally,
and that "keyword/lexicon match is a FALLBACK tier, not the basis." A `content` tier is lexical
relevance to stored material. It is **not** problem-state, so R3 forbids ranking it as context-tier.
It is **strictly stronger evidence than a bare keyword hit**, because a keyword hit is a hand-picked
word from a sensor's private list while a content hit is corpus-relative evidence weighted by bm25
against the room's actual material.

**RECOMMENDATION (HIGH confidence, doctrine-derived not invented):** insert `content` **between
`context` and `keyword`**:

```js
const TRIGGER_TIERS = Object.freeze([
  'signal',
  'context',
  'content',   // Phase 244: lexical relevance to LOCAL stored material (bm25)
  'keyword',
]);
```

This preserves R3's "problem-state above lexicon" ordering (content is below context) while making
content a better fallback than keyword (content above keyword).

**MANDATORY companion change the planner must not miss.** `isContextTier(tier)` at `:187-189` is:

```js
function isContextTier(tier) {
  return tier === 'signal' || tier === 'context';
}
```

This is an explicit allowlist and will correctly return `false` for `'content'`. **Good.** But the
documented `=== 'keyword'` binary idiom quoted above is an implicit denylist and will silently
mis-promote `'content'`. The planner must (a) grep for `=== 'keyword'` and `!== 'keyword'` across the
repo, and (b) add a companion predicate (`isFallbackTier(tier)` returning true for `content` and
`keyword`) so the binary idiom has a correct, non-negated form to migrate to. A test that pins
`isContextTier('content') === false` is a cheap mutation-proof leg.

---

### Q2. What does the FTS5 table get built FROM, and how does it coexist with Phase 236?

**FINDING F-1: it already exists. Do not create a new one.**

`lib/core/eureka/tri-modal-index.cjs:304`:

```js
"CREATE VIRTUAL TABLE IF NOT EXISTS eureka_fts USING fts5(node_id UNINDEXED, text, tokenize='porter')"
```

`lib/core/eureka/tri-modal-index.cjs:418-431` is the query:

```js
function lexicalSearch(db, query, k) {
  if (!ensureFtsAvailable().ok) return [];
  const limit = Number.isFinite(k) && k > 0 ? k : 10;
  const matchExpr = toFtsMatch(query);
  if (!matchExpr) return [];
  try {
    const rows = db.prepare(
      'SELECT node_id, bm25(eureka_fts) AS rank FROM eureka_fts WHERE eureka_fts MATCH ? ORDER BY rank LIMIT ?'
    ).all(matchExpr, limit);
    return rows.map(function (r) { return { node_id: r.node_id, rank: r.rank }; });
  } catch (_e) { return []; }
}
```

Contract: `[{ node_id, rank }]`, `rank` = raw bm25 (negative), **array order is already
best-first** because `ORDER BY rank ASC` exploits the negative convention. This matters for RRF, which
consumes array POSITION and is therefore immune to the sign gotcha (see Q4).

**What it is built from** (`indexNodes`, `:330-345`): `SELECT id, type, properties FROM nodes`, then
`nodeText(row, {roomDir})` at `:138`, which extracts
`props.name || props.text || props.title || props.governing_thought || props.hypothesis`, **and for
`Artifact`/`memory_artifact` nodes carrying a `props.path`, reads the real markdown BODY off disk**
(frontmatter stripped, capped at `BODY_CAP`).

That last clause resolves a problem this research initially believed was fatal. Measured on the live
`rethinking-mindrianos` room.db (8.4 MB):

| Node type | Rows | Searchable chars in room.db |
|-----------|-----:|----------------------------:|
| `claim` | 1229 | 267,597 |
| `Artifact` | 28 | 1,143 (**titles only**) |
| `memory_event` | 2967 | 0 |
| `memory_artifact` | 158 | 0 |
| `governing_thought` | 75 | 0 |
| `WhitespaceZone` | 143 | 0 |
| `Section` | 3 | 0 |

room.db is deliberately hash-and-enum by Canon Part 8/9 design; artifact BODIES live on disk. The
`opts.roomDir` path-body fallback is what makes the corpus substantive. **The planner must thread
`roomDir`**; without it the corpus collapses to claim text plus 28 titles.

**Phase 236 coexistence - this is the real hazard, and it is NOT the one the prompt anticipated.**

The prompt worried the FTS table would become "a fourth thing Phase 236's fix does not know to
protect", i.e. data LOSS. It is the inverse. Proven by live probe:

```
--- shadow tables created by FTS5 ---
  content_fts, content_fts_config, content_fts_content,
  content_fts_data, content_fts_docsize, content_fts_idx
--- after the Phase 236 scoped wipe (DELETE FROM nodes WHERE type IN ('Artifact','Section')) ---
  nodes after wipe:    1
  fts rows after wipe: 2   <-- STALE
  stale hit still matches: [ {node_id: 'a'}, {node_id: 'c'} ]
```

`[VERIFIED: live execution]`

**The hazard is data RESURRECTION, not data loss.** `clearIndexerOwnedRows`
(`lazygraph-ops.cjs:126-152`) deletes `Artifact`/`Section` nodes; the FTS index keeps their rows and
keeps matching them. A content-tier trigger would then fire on content that no longer exists,
pointing at a dead `node_id`. This is a **silent correctness bug**, exactly the false-positive class
this repo already tracks in `feedback_false_success_silent_skip_gates_academy_testers`.

**Good news:** the FTS index is 100% derived and holds no original data, so it is safe to destroy and
rebuild at will. It should **NOT** be added to `INDEXER_OWNED_NODE_TYPES`/`INDEXER_OWNED_EDGE_TYPES`
(those constants are typed vocabularies for the `nodes`/`edges` tables; widening them reintroduces
Phase 236's bug, and the header comment at `lazygraph-ops.cjs:60-69` says so explicitly).

**RECOMMENDED FIX (two viable shapes, planner picks):**

- **Option A (minimal, recommended):** add an FTS reconciliation step inside `rebuildGraph`'s existing
  `BEGIN/COMMIT` wrap, right after `clearIndexerOwnedRows`, that deletes `eureka_fts` rows whose
  `node_id` no longer exists in `nodes`. One statement, no schema change, rides the transaction that
  already exists, cannot lose data:
  ```sql
  DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)
  ```
  Must be guarded by a `tableExists(db,'eureka_fts')` probe (the table is absent in most rooms, see
  Pitfall 2) and by `ensureFtsAvailable()`.
- **Option B (structurally cleaner, larger blast radius):** convert `eureka_fts` to an
  **external-content** table over a VIEW of searchable nodes and call
  `INSERT INTO eureka_fts(eureka_fts) VALUES('rebuild')`. Proven working:
  ```
  VIEW as content= WORKS. rows: 2
  after wipe, BEFORE rebuild (stale?): [rowid 1, rowid 2]
  after rebuild (should be empty):     [rowid 2]      <-- correct
  ```
  `[VERIFIED: live execution]` **Rejected as the primary recommendation** because it changes a shipped
  Phase 211/219 surface with its own test suite (`tests/test-219-fts5-degrade.cjs`), loses the
  artifact-path-body text (a view cannot read the filesystem), and 'rebuild' is O(corpus) on a hot
  path. Option A is strictly smaller and preserves the body fallback.

**Substrate-guard note.** `scripts/check-substrate.cjs` bans raw `INSERT/UPDATE/DELETE` on
`nodes|edges|memory_event` outside an allowlist. `eureka_fts` is **not** in that banned table set, and
`lib/core/lazygraph-ops.cjs` is allowlisted at `check-substrate.cjs:70` anyway. Option A therefore
does not trip the guard and does not require widening any exemption. `[VERIFIED: read the allowlist]`

---

### Q3. Exact current state of `f-selector-ranker.cjs` around line 733

**Re-read fresh at HEAD. The line number is exactly right. The ROADMAP's interpretation of it is not.**

Confirmed verbatim:

| Symbol | Line | Content |
|--------|-----:|---------|
| `MAX_K` | `:87` | `const MAX_K = 3;` |
| `_applySens10Flip` | `:521-561` | layered pass; partitions by detent, `return ordered.slice(0, k)` |
| `_applyRoleLevelBias` | `:596-615` | layered pass; `list.map(it => Object.assign({}, it, {...}))`, no-op when `lean === null` |
| `rankForSelector` | `:622` | main entry |
| candidate loop | `:682-730` | `for (const cmd of commands)` |
| `scored.push({...})` | `:717-729` | the row shape |
| **the sort** | **`:733`** | `scored.sort((a, b) => b.score - a.score);` |
| the slice | `:757` | `: scored.slice(0, k);` |
| the composition | `:755-759` | `const finalList = (sens10 && sens10.fired === true) ? _applySens10Flip(scored, sens10, k) : scored.slice(0, k); return _applyRoleLevelBias(finalList, role_level);` |

The layered-adjustment-pass pattern the ROADMAP wants a third instance of is real and clean: each pass
takes a list, returns a new list, is a byte-identical no-op when its signal is absent, and never
mutates the base rows (`_applySens10Flip:540` maps onto a copy; `_applyRoleLevelBias:605` maps onto a
copy). **This is a good pattern to extend and the ROADMAP is right to name it.**

#### RESEARCH BLOCKER B-1: line 733 does not rank trigger-tier candidates

`scored` is built at `:678-730` from `_loadRegistry()` -> `reg.commands`, i.e.
`data/command-registry.json`. Each row is:

```js
{ command, jtbd_label, jtbd_summary, teaching, framework,
  score, why, source, investment_level, category, graph_relationship }
```

There is **no `trigger_tier` field, no `reach_id`, no sensor provenance, and no tier family** on these
rows. Verified by reading the full push at `:717-729`.

Sensor candidate reaches never reach this function. The two paths are disjoint:

```
TRIGGER PATH:   normalizeTurn (stamps trigger_tier)
                  -> dispatchSensors  (insight-sensors.cjs:738)
                  -> 17 sensors -> makeReach structs
                  -> decide()         (navigation-engine.cjs:817)
                  -> buildReachList   (hmi/dial-reach-orchestrator.cjs)
                     [scores via roomState.reachScores, applies the frozen 0.70/0.15 gate]

COMMAND PATH:   rankForSelector       (f-selector-ranker.cjs:622)
                  -> command-registry.json rows
                  -> D4 score -> sort :733 -> slice :757
                  -> _applySens10Flip / _applyRoleLevelBias
```

`grep -rn "trigger_tier"` across `lib/`, `scripts/`, `tests/` returns **13 hits total**: the producer
(`insight-sensors.cjs:355,443`), two sensors stamping it into evidence
(`sensor-diffusion-adoption.cjs:204-222`, `sensor-show-share.cjs:184-207`), and test assertions. **Zero
consumers in either ranker.** `[VERIFIED: repo-wide grep]`

**What is missing to plan:** a navigator/planner decision on the target surface. Two defensible
options, both consistent with the phase Goal:

- **Option 1 - fuse in the REACH path (`dial-reach-orchestrator.cjs::buildReachList`).** This is where
  trigger families genuinely coexist, so RRF has something real to fuse. But `MAX_K=3` and the
  0.70/0.15 detent live here as Canon Part 3 FROZEN scalars, and the ROADMAP's SC2 explicitly names
  `f-selector-ranker.cjs` and line 733. Choosing this means SC2's file reference is wrong.
- **Option 2 - carry tier provenance INTO `rankForSelector`.** Thread the fired reaches (or a
  tier-tagged candidate list) onto `rankForSelector`'s args, give `scored` rows a `tier_family` field,
  and fuse there. This keeps SC2's stated file and line honest, but is a larger change: it makes a
  function documented as pure/sync/registry-only (`:618-621`: "No Brain calls. No db writes.") depend
  on sensor output.

**Recommendation: Option 2, with a narrow seam.** Do not make `rankForSelector` call sensors. Instead
add an OPTIONAL `o.tierCandidates` arg (absent -> byte-identical no-op, matching the `sens10` and
`role_level` precedent at `:646` and `:749`), tag each `scored` row with `tier_family: 'command'` by
default, and have the RRF pass fuse the registry list against the caller-supplied tier lists. This
honors SC2's file and line, follows the established optional-signal idiom exactly, and keeps
`rankForSelector` pure. **This is a planner decision, not a research conclusion.** It must be
confirmed before planning proceeds.

---

### Q4. The concrete RRF formula for THIS system

**FINDING F-2: `rrfFuse` already exists and is correct. Do not write a second one.**

`lib/core/eureka/hybrid-retrieve.cjs:90-118`:

```js
function rrfFuse(rankedLists, k) {
  const kk = (Number.isFinite(k) && k > 0) ? k : resolveRrfK();
  const lists = Array.isArray(rankedLists) ? rankedLists : [];
  const acc = new Map();
  for (let li = 0; li < lists.length; li += 1) {
    const entry = lists[li];
    const arr = Array.isArray(entry) ? entry : ((entry && entry.items) || []);
    const sourceName = (entry && !Array.isArray(entry) && entry.source)
      ? entry.source : (DEFAULT_SOURCE_NAMES[li] || ('list' + li));
    for (let idx = 0; idx < arr.length; idx += 1) {
      const item = arr[idx] || {};
      const id = (item.node_id != null) ? item.node_id : item.id;
      if (id == null) continue;
      const rank = idx + 1;                    // 1-BASED
      const contribution = 1 / (kk + rank);    // RRF
      let cur = acc.get(id);
      if (!cur) { cur = { node_id: id, rrf_score: 0, sources: [] }; acc.set(id, cur); }
      cur.rrf_score += contribution;
      if (cur.sources.indexOf(sourceName) === -1) cur.sources.push(sourceName);
    }
  }
  return Array.from(acc.values()).sort((a, b) => b.rrf_score - a.rrf_score);
}
```

It accepts **either** a bare array **or** a tagged `{ source, items }` list, and records which sources
contributed. The tagged form is exactly what tier-family fusion needs.

**The sign gotcha is real, and this implementation is already immune to it.**

`[CITED: sqlite.org/fts5.html]` The FTS5 spec states:

> "the FTS5 implementation of BM25 multiplies the result by -1 before returning it, ensuring that
> better matches are assigned numerically lower scores."

So bm25 is negative and **more negative = better**, the opposite of the `0..1` decay score where
higher = better. Confirmed live: `bm25 = -0.000002` for the best match, `-0.0000018` for the second.

**Why RRF dissolves this:** `rrfFuse` reads `idx`, the ARRAY POSITION, and never touches
`item.rank`/`item.score` at all. As long as each input list is **pre-sorted best-first**, the raw score
scale and sign are irrelevant. `lexicalSearch` already returns best-first (`ORDER BY rank ASC` over
negative bm25). `scored` at `:733` is already sorted best-first (`b.score - a.score` over `0..1`).
**Both input lists are already correctly ordered. No normalization, no sign flip, no min-max scaling
is needed anywhere.** This is precisely why RRF is the right tool and the ROADMAP is correct to specify
rank-position fusion.

**The concrete call for this phase:**

```js
const { rrfFuse } = require('../core/eureka/hybrid-retrieve.cjs');

// scored is already sorted best-first at :733.
// contentRanked is lexicalSearch output, already best-first.
const fused = rrfFuse([
  { source: 'command_d4',  items: scored.map(r => ({ id: r.command })) },
  { source: 'content_fts', items: contentRanked.map(r => ({ id: r.command })) },
], TRIG_RRF_K);
// fused: [{ node_id: <command>, rrf_score, sources: ['command_d4','content_fts'] }]
// Re-project back onto the full scored rows by command id, preserving fused order.
```

**On `k`.** `[CITED: Cormack, Clarke & Buttcher, SIGIR 2009]` The original paper recommends `k=60`;
it is the industry default in OpenSearch, Elasticsearch, Azure AI Search, MongoDB Atlas, and Weaviate.
**But this repo already made a researched, documented decision to depart from it.**
`hybrid-retrieve.cjs:8-13`:

> "The 2026-07-04 WebSearch validation prescribed k in 20-30 for small corpora, NOT the textbook k=60:
> small corpora want LESS top-rank dampening. Default 25, env-tunable via `EUREKA_RRF_K`."

`RRF_K` resolves at `:68-77`, env-tunable, clamps invalid values back to 25.

**RECOMMENDATION:** reuse `k=25`, and reuse the env-var idiom. Given `MAX_K=3`, the dial's list is
tiny (3-6 items), so 25 is the better-grounded choice for this corpus size. Do **not** hardcode 60.
Note the tradeoff honestly: with `k=25` the rank-1-vs-rank-2 RRF gap is ~3.8%, which is small relative
to the frozen 0.15 margin threshold, so RRF ordering alone will rarely flip the 0.70/0.15 detent. **The
diversity term (TRIG-03) is what will actually change outcomes.** The planner should size expectations
accordingly and consider a dedicated `TRIG_RRF_K` rather than overloading `EUREKA_RRF_K`, since the two
consumers have different corpus sizes.

---

### Q5. Should any sensor be retired or merged?

**No. This is purely additive. Confirmed by survey.**

The registry is at `insight-sensors.cjs:690-720` and holds **17 sensors** (the ROADMAP's "8+" is an
undercount): `sensorFirstMaterial`, `sensorArtifactFiled`, `sensorLaggingComponent`,
`sensorMethodologyDecision`, `sensorGateApproach`, `sensorExternalFact`, `sensorJtbdReweight`,
`sensorMemoryCortex`, `sensorRecency`, `sensorDiffusionAdoption`, `sensorShowShare`,
`sensorCircularity`, `sensorExpertSkill`, `sensorRoomPick`, `sensorEureka`,
`sensorOpportunityHarvest`, `sensorUrlIngest`.

Survey of every sensor file for keyword-matching and db-reading behavior:

| Sensor | Keyword-ish constructs | db reads | Overlap risk |
|--------|----------------------:|---------:|--------------|
| `sensor-diffusion-adoption` | 8 | 0 | Fixed lexicon over turn text. **No corpus retrieval.** None |
| `sensor-room-pick` | 7 | 0 | Fixed lexicon. None |
| `sensor-show-share` | 7 | 0 | Fixed lexicon. None |
| `sensor-eureka` | 3 | 0 | Reads a side-channel JSON file written by a prior scan. **See note** |
| `sensor-expert-skill` | 2 | 1 | Counts CONFIRMED SyntheticExpert nodes. None |
| `sensor-gate-approach` | 2 | 0 | None |
| `sensor-temporal-blindness` | 0 | 1 | Not registered in `SENSOR_REGISTRY`. None |
| all others | 0-1 | 0 | None |

**Every existing keyword sensor matches turn text against its OWN hardcoded vocabulary. Not one of
them queries a corpus.** The content tier is a genuinely new capability, not a duplicate. Additive
confirmed.

**One overlap worth stating honestly, and it is a reuse opportunity, not a conflict.**
`sensorEureka` (SENS-13) rides the `deep_research` reach and consumes
`<roomDir>/.mindrian/last-eureka.json`, written by `lib/core/eureka/eureka-reach-runner.cjs`. That
runner is downstream of the same tri-modal index this phase wants to query. So a *related* signal
already flows sensor-ward from the eureka subsystem. `sensorEureka` fires on a **bridge/analogy
discovery** (a cross-domain surprise); the content sensor would fire on **direct lexical relevance**.
Different jobs, same substrate. The planner should reuse `sensor-eureka.cjs`'s side-channel freshness
discipline (`:43-47`, a 30-minute window plus a future-mtime skew guard) rather than reinventing it.

**Reach id: the content sensor must NOT mint a 7th.** `REACH_IDS` is frozen at exactly 6
(`sensor-types.cjs:43-50`), enforced by a drift contract. Follow the `sensor-expert-skill.cjs:57-60`
precedent: ride `context_block` and fail closed at module load if it drifts off the bank.

**Sensor id:** `SENS-16` appears free (`SENS-15` = `sensorUrlIngest`, Phase 220). The planner must
re-verify against the live registry, per the `sensor-eureka.cjs:16` precedent of stating the check.

---

## Standard Stack

### Core (all already in-repo, zero installs)

| Module | Path | Purpose | Why standard |
|--------|------|---------|--------------|
| FTS5 + bm25 | `node:sqlite` bundled SQLite 3.51.3 | Lexical retrieval | Ships in the runtime; `ENABLE_FTS5=1` verified |
| `tri-modal-index` | `lib/core/eureka/tri-modal-index.cjs` | `eureka_fts` DDL `:304`, `lexicalSearch` `:418`, `toFtsMatch` sanitizer, `ensureFtsAvailable` `:222`, `nodeText` `:138` | Shipped Phase 211-02, hardened 219-02, has a test suite |
| `hybrid-retrieve` | `lib/core/eureka/hybrid-retrieve.cjs` | `rrfFuse` `:90`, `RRF_K` `:77` | Shipped Phase 211-02; correct 1-based rank fusion |
| `lexical-overlap` | `lib/core/eureka/lexical-overlap.cjs` | `lexicalOverlap(a,b)` `:75` Jaccard, `tokenize` `:55`, frozen stopwords `:38` | **The `sim()` primitive MMR needs.** Versioned as `jaccard-v1` |
| `sensor-types` | `lib/core/sensors/sensor-types.cjs` | `TRIGGER_TIERS` `:73`, `makeReach` `:211`, `classifyTriggerTier` `:174` | The tier vocabulary and reach factory |
| `f-selector-ranker` | `lib/workflow/f-selector-ranker.cjs` | The layered-pass host `:521`/`:596`, sort `:733` | The TRIG-02/03 target |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Reusing `eureka_fts` | A new `trigger_fts` table | Rejected: Canon Part 7 violation, second corpus to keep in sync, doubles the staleness surface |
| Own-content FTS5 | External-content over a view | Rejected as primary (Q2 Option B): loses the artifact-body-from-disk text, changes a shipped surface, O(corpus) rebuild |
| `rrfFuse` reuse | A new fusion fn in the ranker | Rejected: Part 7 violation; the shipped one is correct and tested |
| `k=25` | `k=60` (textbook) | `k=25` is this repo's own researched small-corpus decision; `MAX_K=3` makes the dial list tiny |
| Jaccard `sim()` for MMR | Embedding cosine via `sqlite-vec` | Rejected: per-turn model load blows the 1200ms NAV budget; Jaccard is pure, sync, zero-dep, already versioned |

---

## Architecture Patterns

### System Architecture Diagram

```
                    user turn text
                          |
                          v
              +-----------------------+
              | normalizeTurn         |  insight-sensors.cjs:367
              | - text alias          |
              | - signals merge       |
              | - trigger_tier stamp  |  :443  (DECORATIVE today, F-3)
              +-----------------------+
                          |
                          v
     +--------------------------------------------+
     | navigation-engine.cjs decide() :817        |
     |   ctx-assembly block :854-917              |
     |     [MED-01 cortex producer]               |
     |     [SENS-11 expert producer :894]         |
     |  >> NEW: content producer <<               |----> room.db
     |     lexicalSearch(db, turn.text, k)        |      eureka_fts
     |     tri-modal-index.cjs:418                |      (bm25, best-first)
     +--------------------------------------------+
                          |
                          | sensorCtx.contentHits = [{node_id, rank}]
                          v
     +--------------------------------------------+
     | dispatchSensors :738 (pure, Phase 144 fence)|
     |   17 sensors, canonical order :690-720      |
     |   >> NEW: sensorContentRelevance (SENS-16) <<|
     |      rides context_block, mints makeReach   |
     +--------------------------------------------+
                          |
              candidate reaches (frozen 6 ids)
                          |
          +---------------+----------------+
          v                                v
  buildReachList                    rankForSelector :622
  dial-reach-orchestrator            command-registry.json rows
  [frozen 0.70/0.15 gate]                    |
          |                                  v
          |                          scored.sort :733  <-- BLOCKER B-1:
          |                                  |          no tier field here
          |                                  v
          |                    >> NEW: RRF fusion pass <<
          |                       rrfFuse(taggedLists, 25)
          |                       hybrid-retrieve.cjs:90
          |                                  |
          |                                  v
          |                    >> NEW: MMR diversity pass <<
          |                       sim = lexicalOverlap :75
          |                                  |
          |                                  v
          |                       _applySens10Flip :521
          |                       _applyRoleLevelBias :596
          |                                  |
          +----------------+-----------------+
                           v
                    Shape F render (MAX_K=3)
```

### Pattern 1: The 3-layer sensor split (MANDATORY for the content sensor)

**What:** a sensor that needs a db read splits into three files/roles so the registered sensor stays
pure. **Source:** `lib/core/sensors/sensor-expert-skill.cjs:11-33`, verbatim:

> 1. `sensorExpertSkill(turn, tuple, ctx) -> reach|null` -- the PURE registered sensor. ... a sync fn
>    that reads ONLY LOCAL ctx enum/scalars, makes NO db read and NO Brain call ...
> 2. `detectExpertSkillCandidates(db, opts)` -- the ctx-assembly PRODUCER helper. **THIS is where the
>    db read lives.** It runs at ctx-assembly time (inside the navigation-engine sensorCtx block,
>    mirroring the MED-01 cortex producer at navigation-engine.cjs:847-865) ...
> 3. `resolveExpertSkillDecision(db, nodeId, decision, opts)` -- the gate action.

The producer is wired at `navigation-engine.cjs:894` inside a `try/catch` that soft-fails to no signal.
**The content sensor must follow this exactly.** `lexicalSearch` is a db read and must not live inside
the pure sensor.

### Pattern 2: The layered adjustment pass (the TRIG-03 shape)

**What:** a function that takes a list, returns a new list, is a byte-identical no-op when its signal
is absent, and never mutates base rows.

```js
// Source: lib/workflow/f-selector-ranker.cjs:596-615
function _applyRoleLevelBias(list, role_level) {
  const lean = resolveElevationLean(role_level);
  if (lean === null) return list;                 // <-- the no-op guard
  ...
  return list.map(function (it) {
    return Object.assign({}, it, { ... });        // <-- copy, never mutate
  });
}
```

The MMR pass must have both properties: a no-op guard (absent tier candidates -> return the input
untouched) and copy-on-write. This is what makes the existing 205-03/205-04 suites stay green, per the
comment at `:578-580`.

### Pattern 3: Optional-signal threading into `rankForSelector`

```js
// Source: lib/workflow/f-selector-ranker.cjs:643-646
// Phase 205-03: the optional SENS-10 circularity signal. When fired, ...
// Absent or not-fired => the flip never runs (byte-identical no-op).
const sens10 = (o.sens10 && typeof o.sens10 === 'object') ? o.sens10 : null;
```

The recommended `o.tierCandidates` seam (Q3 Option 2) must copy this idiom exactly.

### Pattern 4: The MMR formula (net-new, TRIG-03)

`[CITED: Carbonell & Goldstein, SIGIR 1998]` The canonical form is:

```
MMR = argmax [ lambda * Rel(d, q) - (1 - lambda) * max Sim(d, d_selected) ]
```

where **lambda = 1 means pure relevance, lambda = 0 means pure diversity**.

**GOTCHA - the ROADMAP inverts lambda.** ROADMAP SC3 states the formula as:

> `(1-lambda)*relevance - lambda*max_similarity_to_selected`

This is algebraically equivalent under `lambda' = 1 - lambda`, but the **semantics of the knob are
flipped**. A planner who writes `lambda = 0.7` intending "mostly relevance" would get "mostly
diversity" under the ROADMAP's form. **Recommendation:** implement the canonical Carbonell form, name
the constant explicitly (e.g. `MMR_LAMBDA_RELEVANCE = 0.7`), and put a comment naming the ROADMAP's
inverted statement so the next reader is not confused. Flag this to the navigator at discuss time; it
is a one-word fix to SC3.

**Greedy selection over the fused list, `sim` from the shipped Jaccard:**

```js
// sim primitive: lib/core/eureka/lexical-overlap.cjs:75  lexicalOverlap(a, b) -> 0..1
// relevance: the RRF score, already 0..1-ish and comparable across families
const selected = [];
const pool = fused.slice();
while (selected.length < k && pool.length) {
  let bestIdx = 0, bestScore = -Infinity;
  for (let i = 0; i < pool.length; i += 1) {
    const rel = pool[i].rrf_score_normalized;
    const maxSim = selected.length
      ? Math.max(...selected.map(s => lexicalOverlap(textOf(pool[i]), textOf(s))))
      : 0;
    const mmr = MMR_LAMBDA_RELEVANCE * rel - (1 - MMR_LAMBDA_RELEVANCE) * maxSim;
    if (mmr > bestScore) { bestScore = mmr; bestIdx = i; }
  }
  selected.push(pool.splice(bestIdx, 1)[0]);
}
```

**Note on `textOf`:** with `MAX_K=3` and `DIAL_REACH_K=6`, this is at most 6x6 Jaccard comparisons per
turn. Negligible. The `textOf` projection should be a LOCAL, non-prose handle (command slug +
`jtbd_label` + `framework`), not user content, to stay Part-8 clean.

### Anti-Patterns to Avoid

- **Adding `'content'` to `TRIGGER_TIERS` and calling TRIG-01 done.** The array is decorative (F-3).
  Zero runtime behavior changes. A mutation test that removes only the string would not turn red on
  any behavioral assertion.
- **Creating a second FTS5 table.** `eureka_fts` exists. Part 7.
- **Writing a second `rrfFuse`.** It exists at `hybrid-retrieve.cjs:90`. Part 7.
- **Putting `lexicalSearch` inside the pure sensor.** Breaks the Phase 143/144 sensor purity contract
  and the `sensor-expert-skill.cjs` precedent.
- **Passing raw turn text to `MATCH`.** Throws (Pitfall 1, proven). Use `toFtsMatch`.
- **Min-max normalizing bm25 before fusion.** Unnecessary and harmful; RRF uses array position.
- **Widening `INDEXER_OWNED_NODE_TYPES` to cover FTS.** Reintroduces Phase 236's data-loss bug at a
  narrower scope. The header comment at `lazygraph-ops.cjs:60-69` explicitly forbids it.
- **Minting a 7th `reach_id`.** Frozen at 6 with a drift contract.

---

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|-------------|-------------|-----|
| Lexical retrieval over room content | A new FTS5 table + query | `tri-modal-index.lexicalSearch` `:418` | Shipped, probe-guarded, degrades gracefully, tested |
| Turn text -> FTS MATCH expression | A tokenizer/quoter | `toFtsMatch` (`tri-modal-index.cjs`, ~`:400-408`) | Raw text **throws** (proven). Handles stopwords, quoting, empty-result |
| Rank fusion | An RRF loop | `hybrid-retrieve.rrfFuse` `:90` | Correct 1-based ranks, source tracking, tagged-list support |
| Text similarity for MMR | A cosine/embedding call | `lexical-overlap.lexicalOverlap` `:75` | Pure, sync, zero-dep, frozen stopwords, versioned `jaccard-v1` |
| FTS5 availability detection | A try/catch around DDL | `ensureFtsAvailable()` `:222` | Memoized single probe; `MINDRIAN_FORCE_FTS_ABSENT` test seam |
| Scoped destructive wipe | A new DELETE | `clearIndexerOwnedRows` `:126` | Phase 236 fixed a real data-loss bug here |
| Side-channel freshness | A new mtime check | `sensor-eureka.cjs:43-47` pattern | 30-min window + future-mtime skew guard already reasoned through |

**Key insight:** this phase's dominant risk is not that the primitives are hard. It is that **they
already exist and a planner unaware of them will rebuild them**, producing two FTS corpora, two RRF
implementations, and two staleness surfaces. The value this research adds is mostly subtraction.

---

## Runtime State Inventory

Not a rename/refactor phase, but it DOES introduce derived runtime state, so the equivalent audit:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `eureka_fts` + 5 FTS5 shadow tables (`_config`, `_content`, `_data`, `_docsize`, `_idx`) per room.db | Reconcile against `nodes` after `rebuildGraph` (Q2 Option A) |
| Live service config | **None.** Zero network, zero remote surface | None |
| OS-registered state | **None.** No scheduled task, no daemon, no pm2 process | None |
| Secrets/env vars | `EUREKA_RRF_K` (existing), `MINDRIAN_FORCE_FTS_ABSENT` (existing test seam). A new `TRIG_RRF_K` / `TRIG_MMR_LAMBDA` may be added | Document in `docs/ENV-TUNING.md`; that doc currently has no ranker/dial section |
| Build artifacts | **None.** No compile step, CJS ships as source | None |
| **Index freshness** | `eureka_fts` is absent in live rooms and only built by 3 report scripts | **See Pitfall 2. This is the phase's biggest sleeper risk** |

---

## Common Pitfalls

### Pitfall 1: Raw turn text passed to `MATCH` throws a SQL error

**What goes wrong:** the sensor crashes (or soft-fails to null, hiding the bug) on any turn containing
an apostrophe, question mark, or parenthesis, i.e. most natural language.

**Proven live:**
```
input:  what's the pricing? (early-stage)
result: PUNCTUATION THROWS: fts5: syntax error near "'"
```
Sanitized (lowercase, split on non-alphanumeric, drop <=2 chars and stopwords, quote each, join `OR`):
```
"what" OR "the" OR "pricing" OR "early" OR "stage"  ->  [{rowid: 1, s: -0.000003}]   OK
```
`[VERIFIED: live execution]`

**Why it happens:** FTS5's MATCH argument is a query-expression grammar, not a literal string.
`[CITED: sqlite.org/fts5.html]` Barewords are alphanumeric/underscore only; anything else needs
double-quoting.

**How to avoid:** always route through `toFtsMatch` (`tri-modal-index.cjs`, just above
`lexicalSearch`). It already implements exactly this and returns `''` for stopword-only input, which
`lexicalSearch:421` turns into `[]`.

**Warning signs:** a content sensor that "never fires" in manual testing but has no error in the trace.
Because `lexicalSearch` wraps in `try/catch { return []; }` (`:429`), a malformed query is
indistinguishable from a genuine zero-hit. **The plan should add a distinguishable counter** so a
silent-swallow does not masquerade as a legitimate no-match. This is the exact bug class in
`feedback_false_success_silent_skip_gates_academy_testers`.

---

### Pitfall 2: `eureka_fts` does not exist in real rooms (the sleeper risk)

**What goes wrong:** the content tier ships, passes every test against a purpose-built fixture, and
**fires zero times in production**, because the index it queries was never built.

**Evidence.** The live `rethinking-mindrianos` room.db (8.4 MB, heavily used, 2967 memory_events)
contains these tables:

```
assumptions, decisions_index, edges, facts, fragments, held_contradictions,
identity, nodes, ranker_weights, rs_discoveries (view), scaffold_log,
session_focus, sessions, sqlite_sequence, stakeholders, voice_log
```

**There is no `eureka_fts`.** `[VERIFIED: live sqlite_master query]`

**Why it happens:** `eureka_fts` is created lazily by `openIndex` (`:298-310`), which is only reached
via `indexNodes`. The complete set of production `indexNodes` callers is:

| Caller | Trigger |
|--------|---------|
| `scripts/entity-extract.cjs:924` | manual/pipeline entity extraction |
| `scripts/eureka-room-report.cjs:304` | manual eureka report |
| `scripts/eureka-portfolio-report.cjs` | manual portfolio report |

`[VERIFIED: repo-wide grep]` **None of these run on a normal turn.** There is no hook, no session-start
build, and no entry in the `room-db.cjs` migration chain (`:279-303`, which runs `initSchema`,
`initMemorySchema`, phase-109 x2, phase-160, phase-222, phase-224 - and nothing eureka).

**How to avoid:** the plan MUST include an index-lifecycle task. Three options, in increasing cost:

1. **Lazy build-on-first-miss** in the ctx-assembly producer: if `tableExists(db,'eureka_fts')` is
   false, skip this turn AND enqueue a background build. Cheapest; costs one cold turn.
2. **Session-start build** via the existing `scripts/session-start` seam. Predictable, but `indexNodes`
   is `async` and reads artifact bodies off disk, so it must not block the turn.
3. **Migration-chain creation** of the empty table in `room-db.cjs`, plus incremental upsert wherever
   nodes are written. Most correct, largest blast radius, touches the Phase 236 surface.

**Recommendation: Option 1 plus a doctor check.** Add an `eureka_fts` presence/freshness module to
`node scripts/doctor.cjs --acceptance` so an unbuilt index is visible rather than silent.

**Warning signs:** every acceptance test passes and the navigator reports "natural language still does
not trigger anything" - the exact symptom that opened this phase.

---

### Pitfall 3: An unfiltered corpus makes the content tier fire on EVERYTHING

**What goes wrong:** the inverse of today's failure. Instead of firing on nothing, it fires on every
turn, and the dial becomes noise.

**Measured live** against the real room, corpus = 1229 claims + 3174 `fragments` rows:

```
TURN: what is the weather in paris today       -> 3 hits, top bm25 -5.347
  hit: "lets update it thne to be relvent to today !"
```

An utterly irrelevant turn produced confident hits, because `OR` semantics plus a raw-conversation
corpus means every common word matches something.

**Same probe, `fragments` EXCLUDED (claims only, 1229 docs):**

```
RELEVANT turns:
  "the reverse salient in the graph derivation pipeline"     -> 5 hits, bm25 -12.96, coverage 40%
  "opportunity bank agentic reasoning environment"           -> 5 hits, bm25 -21.54, coverage 100%
IRRELEVANT turns:
  "what is the weather in paris today"                       -> 0 hits
  "my cat needs a vet appointment tomorrow"                  -> 0 hits
  "order pizza for dinner tonight"                           -> 0 hits
```

`[VERIFIED: live execution against `~/MindrianRooms/rethinking-mindrianos/.mindrian/room.db`]`

**The corpus choice does almost all the work.** A clean natural zero-hit floor appears with no
threshold tuning at all.

**Why it happens:** `fragments` is raw conversation transcript (2.87 MB, including Larry's own output
with emoji glyphs). It contains every common English word many times, so it matches any query.
Curated `claim` nodes and artifact bodies are semantically dense.

**How to avoid:** **do not add `fragments` to the index.** The shipped `indexNodes` reads
`SELECT id, type, properties FROM nodes` and never touches `fragments`, so **the correct behavior is
the default** - the risk is only that a plan "helpfully" widens the corpus. State the exclusion
explicitly in the plan as a non-goal.

**Residual caution:** one relevant-ish turn scored `-0.00` at 17% coverage, a weak spurious match. A
modest relevance floor is still worth having. Because bm25 is **not comparable across queries** (it
varies with query term count and corpus statistics), do **not** use a raw absolute bm25 threshold. Two
safer options: (a) require `>= N` matched query tokens present in the top hit (coverage), or (b)
normalize by dividing bm25 by the token count. Option (a) is more interpretable and is what the
measurements above suggest separates cleanly.

---

### Pitfall 4: FTS index staleness after `rebuildGraph` (ghost triggers)

Covered in full in Q2. Summary: `clearIndexerOwnedRows` deletes `Artifact`/`Section` nodes; the FTS
index retains their rows and keeps matching them, so the trigger points at a dead `node_id`. Proven
live. Fix = the reconciliation DELETE inside the existing transaction. **This is the one place this
phase genuinely intersects Phase 236**, and the intersection is safe: the FTS index holds no original
data, so it can be freely destroyed.

---

### Pitfall 5: Performance is a non-issue, do not over-engineer for it

Measured: indexing 4403 documents took **53 ms**; queries took **0-1 ms**. Against the 1200 ms NAV
budget (`navigation-engine.cjs:820`), a `lexicalSearch` call is free.

**But `indexNodes` is a different story:** it is `async`, reads artifact bodies off disk, and (when an
encoder is available) embeds every node. That must never run inline on a turn. Keep the read path
(`lexicalSearch`, sync, ~1 ms) and the write path (`indexNodes`, async, seconds) strictly separate.

---

### Pitfall 6: `SELECT COUNT(*)` on an external-content FTS table is misleading

If Q2 Option B is ever chosen: `COUNT(*)` reads through to the content table, not the index, so it
does not reflect index state. Observed live: after `'delete-all'`, `COUNT(*)` still returned 1. Use
`INSERT INTO fts(fts) VALUES('integrity-check')` or count via a MATCH instead. Non-issue for the
recommended Option A (own-content), where `COUNT(*)` is accurate.

---

## Code Examples

### The ctx-assembly producer (follows `navigation-engine.cjs:883-917` exactly)

```js
// Source pattern: lib/core/navigation-engine.cjs:883-917 (SENS-11 producer block)
// Placed inside decide()'s sensorCtx assembly, AFTER the existing producers.
{
  let contentHits = [];
  const roomDb = (ctx.roomDb && typeof ctx.roomDb.prepare === 'function') ? ctx.roomDb : null;
  const turnText = (typeof t.userText === 'string') ? t.userText : '';
  if (roomDb && turnText) {
    try {
      const tri = require('./eureka/tri-modal-index.cjs');
      // lexicalSearch is sync, ~1ms, soft-fails to [] on every error path
      // (absent FTS build, malformed query, missing table).
      contentHits = tri.lexicalSearch(roomDb, turnText, CONTENT_POOL_K);
    } catch (_e) {
      contentHits = []; // soft-fail: degrade to no content signal
    }
  }
  // Part 8: only a COUNT and a coverage scalar ride onto ctx for the pure sensor.
  // The node-id list stays LOCAL for the gate handler, never on the reach.
  sensorCtx.contentHitCount = contentHits.length;
  sensorCtx.contentTopRank  = contentHits.length ? contentHits[0].rank : 0;
  sensorCtx.contentCandidates = contentHits;   // LOCAL only, gate-handler use
}
```

### The pure sensor (follows `sensor-expert-skill.cjs`)

```js
// Source pattern: lib/core/sensors/sensor-expert-skill.cjs:1-60
const { makeReach, REACH_IDS } = require('./sensor-types.cjs');
const SENSOR_ID = 'SENS-16';           // re-verify free against SENSOR_REGISTRY
const REACH_ID  = 'context_block';     // FROZEN bank: mints no 7th reach
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-content-relevance: context_block drifted off REACH_IDS');
}

function sensorContentRelevance(turn, tuple, ctx) {
  const c = (ctx && typeof ctx === 'object') ? ctx : {};
  const n = (typeof c.contentHitCount === 'number') ? c.contentHitCount : 0;
  if (n < CONTENT_MIN_HITS) return null;         // the relevance floor
  return makeReach({
    reach_id: REACH_ID,
    posture: 'hold',                             // SENS-SHOW/SENS-13 precedent: offer, never auto-open
    dispatch: 'content-relevance-surface',
    companions: [],
    signal: 'content_relevance',
    // Canon Part 8: closed scalars/enums ONLY. No matched text, no node ids, no turn prose.
    evidence: { hit_count: n, trigger_tier: 'content' },
  });
}
```

### The RRF + MMR layered passes (the TRIG-02/TRIG-03 shape)

```js
// Source pattern: lib/workflow/f-selector-ranker.cjs:596-615 (_applyRoleLevelBias)
// Both passes: no-op guard first, copy-on-write, never mutate the base rows.

function _applyTierFusion(scored, tierCandidates, k) {
  if (!tierCandidates || !tierCandidates.length) return scored;   // byte-identical no-op
  const { rrfFuse } = require('../core/eureka/hybrid-retrieve.cjs');
  const lists = [{ source: 'command_d4', items: scored.map(r => ({ id: r.command })) }]
    .concat(tierCandidates);          // each already sorted best-first; sign/scale irrelevant
  const fused = rrfFuse(lists, TRIG_RRF_K);
  const byCmd = new Map(scored.map(r => [r.command, r]));
  const out = [];
  for (const f of fused) {
    const row = byCmd.get(f.node_id);
    if (row) out.push(Object.assign({}, row, {
      rrf_score: f.rrf_score, tier_sources: f.sources,
    }));
  }
  for (const r of scored) if (!fused.some(f => f.node_id === r.command)) out.push(r);
  return out;
}

function _applyMmrDiversity(list, k) {
  if (!list || list.length <= 1) return list;                     // no-op guard
  const { lexicalOverlap } = require('../core/eureka/lexical-overlap.cjs');
  // greedy MMR, canonical Carbonell orientation (lambda = relevance weight)
  // ... see Pattern 4 above
}
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| `--experimental-sqlite` flag | `node:sqlite` stable-ish, `timeout` option | Node 22.13 / 22.16 | Floor is `>=22.16.0` (Phase 236-04). FTS5 needs nothing more |
| Hand-rolled score normalization for hybrid search | RRF over rank positions | Cormack et al. 2009; now default in OpenSearch/Elastic/Azure/Atlas/Weaviate | Confirms the ROADMAP's rank-position instinct is right |
| Textbook `k=60` | Small-corpus `k` in 20-30 | This repo's own 2026-07-04 validation, `hybrid-retrieve.cjs:8-13` | Reuse `k=25` |
| KuzuDB local graph | SQLite room.db | Retired; Phase 242 MOAT-02 machine-checks the dead warning | Confirms the exclusion |

**Deprecated/outdated in this phase's neighborhood:**
- Nothing this phase touches is deprecated. `eureka_fts` (Phase 211-02) and `rrfFuse` are current.

---

## Finding F-10: the exclusion list's stated rationale is factually wrong (its conclusion is still right)

The ROADMAP excludes "any embedding model, vector index, or remote semantic-router service" on the
grounds that these "would introduce server infrastructure this repo does not run, and Canon Part 8
blocks sending raw user turn text to any remote service."

**Both premises are false as applied to a LOCAL vector index:**

- `sqlite-vec` is **already a pinned dependency**: `"sqlite-vec": "^0.1.9"` in `package.json`.
- `@huggingface/transformers` is **already a pinned dependency**: `"^4.2.0"`.
- `lib/core/eureka/vector-store.cjs` already creates `eureka_vec` tables and stores
  `embedding_model` / `embedding_dim` per room.
- `lib/core/eureka/hybrid-retrieve.cjs` already runs a local CPU-only cross-encoder rerank
  (`Xenova/ms-marco-TinyBERT-L-2-v2`, ~4 MB, no Torch, no Python).

None of this is server infrastructure and none of it is remote. It runs locally, offline. The
`vector-store.cjs:33-40` header explicitly reasons this through against Canon Part 9.

**The conclusion is nevertheless correct, for a different and better reason:** a per-turn embedding
call requires loading a transformer model, which is orders of magnitude beyond the 1200 ms NAV budget
at `navigation-engine.cjs:820`. And the measurements in Pitfall 3 show the **lexical leg alone already
separates relevant from irrelevant turns cleanly** (5 hits vs 0 hits). The vector leg is not needed.

**Planner action:** honor the exclusion (do not add a vector leg to the trigger path). But do **not**
repeat the stated rationale in plan text, because it is falsifiable against this repo's own
`package.json` and would be a doctrine-rot finding of exactly the MW-4 class Phase 242 just cleaned up.
Recommend the navigator restate the exclusion as "**latency budget**, not architecture." Raised as an
assumption, not a decision.

---

## RESEARCH BLOCKERS

Per the phase's explicit instruction to flag rather than quietly reach for an excluded technology.

### BLOCKER B-1: TRIG-02's target surface does not carry trigger-tier families

**Status:** BLOCKING for planning. Needs a navigator or planner decision.

**What is missing:** `f-selector-ranker.cjs:733` sorts `scored`, an array of **command-registry rows**
with no tier/reach/sensor provenance (`:717-729`). Sensor candidate reaches flow through
`dispatchSensors` -> `decide()` -> `buildReachList`, a disjoint path. "Fuse candidate scores across
trigger-tier families before the `MAX_K=3` cut at line 733" cannot be implemented as literally
specified, because no trigger families are present at that line.

**Not a blocker because the work is impossible** - it is entirely doable. It is a blocker because two
materially different plans satisfy the same sentence, and picking wrong means rewriting the phase:

- **Option 1:** move fusion to `buildReachList` (where families really coexist). Contradicts SC2's
  explicit file+line.
- **Option 2 (research recommendation):** thread an optional `o.tierCandidates` into
  `rankForSelector`, following the `sens10` optional-signal idiom at `:646`, tag rows with
  `tier_family`, fuse there. Honors SC2's file and line; slightly widens a function documented as
  registry-pure at `:618-621`.

**Recommended resolution:** Option 2. **Requires navigator confirmation** because it amends the
documented purity contract of `rankForSelector`.

### BLOCKER B-2: `eureka_fts` has no production build lifecycle

**Status:** BLOCKING for a phase that claims TRIG-01 works in production. Resolvable in-plan; named
here so it cannot be missed.

**What is missing:** the index does not exist in real rooms (verified against the live
`rethinking-mindrianos` room.db). Its only three callers are manual report scripts. Without a
lifecycle task, TRIG-01 ships green and fires zero times, reproducing the exact symptom that opened
this phase. See Pitfall 2 for three costed options.

### NOT BLOCKED (explicitly closed)

- **The stack constraint holds in full.** Zero new npm dependencies, zero network, zero embedding
  calls, zero KuzuDB/Memgraph/Neo4j. FTS5 verified live. No excluded technology is necessary and none
  is recommended.
- **No new Node version floor.** `>=22.16.0` stands.
- **Purely additive to the sensor bank.** No sensor retires or merges (Q5).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `content` belongs between `context` and `keyword` in `TRIGGER_TIERS` | Q1 | Doctrine-derived from R3, not stated verbatim anywhere. If the navigator wants content ABOVE context, the precedence and `isContextTier` change |
| A2 | `SENS-16` is the next free sensor id | Q5 | Collision with a parallel session's sensor. Re-verify at plan time |
| A3 | `k=25` (this repo's small-corpus value) beats `k=60` for the dial's 3-6 item list | Q4 | Suboptimal fusion ordering only; no correctness impact |
| A4 | Reusing `eureka_fts` is preferable to a dedicated trigger corpus | Q2 | If eureka's corpus definition later diverges from what triggers need, the two uses fight over one index |
| A5 | Coverage-based relevance floor beats an absolute bm25 threshold | Pitfall 3 | Measured on one room only (`rethinking-mindrianos`). A different room shape could behave differently |
| A6 | The exclusion list's real justification is latency, not architecture | F-10 | If the navigator's actual intent was a hard architectural ban on `sqlite-vec` anywhere, that is a much larger finding, since it already ships |
| A7 | Option A (reconcile DELETE) is safer than Option B (external-content rebuild) | Q2 | Option A leaves a window where the index is stale between rebuilds if the reconcile is missed at a third call site |
| A8 | A langtalks-graph-expert pass would not overturn the RRF/MMR design | Grounding | The mandated source was unreachable. Findings cross-verified against this repo's own shipped `rrfFuse`, which independently matches the literature |

---

## Open Questions

1. **Which surface does TRIG-02 target?** (BLOCKER B-1)
   - Known: line 733 is confirmed; the layered-pass pattern is real and extensible.
   - Unclear: whether to amend `rankForSelector`'s purity contract or move fusion to `buildReachList`.
   - Recommendation: Option 2 (optional `tierCandidates` arg). Confirm at `/gsd-discuss-phase`.

2. **What builds and refreshes `eureka_fts` on a normal turn?** (BLOCKER B-2)
   - Known: three manual script callers; absent from the migration chain; absent in live rooms.
   - Recommendation: lazy build-on-first-miss plus a `doctor --acceptance` freshness check.

3. **Which reach should the content sensor ride?**
   - Known: `REACH_IDS` frozen at 6; `context_block` is the LOCAL in-process surface and the
     `sensor-expert-skill` precedent.
   - Unclear: `context_block` vs `deep_research`. `sensorEureka` already rides `deep_research` from
     the same substrate, which argues for `context_block` to keep them distinguishable.
   - Recommendation: `context_block`, posture `hold`.

4. **Does the ROADMAP's inverted MMR lambda get corrected in SC3?**
   - Known: `(1-lambda)*rel - lambda*sim` is equivalent but semantically inverted vs Carbonell.
   - Recommendation: implement canonical, name the constant `MMR_LAMBDA_RELEVANCE`, and ask the
     navigator to amend SC3's one-line formula.

5. **Should the relevance floor be coverage-based or normalized-bm25?**
   - Known: raw absolute bm25 is not comparable across queries; corpus choice does most of the work.
   - Recommendation: token-coverage floor. Validate against a second room before locking.

6. **Does a langtalks-graph-expert consult change anything?** (unresolved, mandated source unreachable)
   - Recommendation: run it at discuss time on "content-tier trigger design" and "when lexical-only
     retrieval suffices vs hybrid." Treat as an open item, not a closed one.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (floor 22.16.0) | none needed |
| SQLite FTS5 | TRIG-01 | **yes** | SQLite 3.51.3, `ENABLE_FTS5=1` | `ensureFtsAvailable()` -> bi-modal degrade, already shipped |
| `bm25()` | TRIG-01 | yes | verified live | none needed |
| `tri-modal-index.cjs` | TRIG-01 | yes, in-repo | Phase 211-02 / 219-02 | none needed |
| `hybrid-retrieve.cjs::rrfFuse` | TRIG-02 | yes, in-repo | Phase 211-02 | none needed |
| `lexical-overlap.cjs` | TRIG-03 | yes, in-repo | `jaccard-v1` | none needed |
| A built `eureka_fts` index | TRIG-01 at runtime | **NO** (absent in live rooms) | - | **No fallback. BLOCKER B-2** |
| `sqlite-vec` | not required | present (`^0.1.9`) | - | intentionally unused |
| Network | not required | n/a | - | zero network by design |

**Missing with no fallback:** a built `eureka_fts` index in production rooms (BLOCKER B-2).
**Missing with fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:assert` + `node:test`-style hand-rolled harnesses in `tests/*.cjs`; bash aggregators |
| Config file | none; aggregator convention `tests/run-all-<phase>.sh` |
| Quick run | `node tests/test-244-<leg>.cjs` |
| Full suite | `bash tests/run-all-244.sh` |
| Reference precedents | `tests/test-219-fts5-degrade.cjs` (FTS5 forced-absent legs), `tests/run-all-240.sh` |

`tests/run-all-244.sh` does not exist yet (Wave 0).

### Phase Requirements -> Test Map

| Req | Behavior | Type | Command | Exists? |
|-----|----------|------|---------|---------|
| TRIG-01 | `'content'` present in `TRIGGER_TIERS` and `isContextTier('content') === false` | unit | `node tests/test-244-trigger-tier-vocab.cjs` | Wave 0 |
| TRIG-01 | Turn with no signal, no problem-state, and no sensor keyword hit but real lexical relevance produces a fired candidate | integration | `node tests/test-244-content-sensor-fires.cjs` | Wave 0 |
| TRIG-01 | Irrelevant turn produces ZERO content candidates (the Pitfall 3 anti-regression) | integration | same file | Wave 0 |
| TRIG-01 | Removing the FTS query path turns the fire test RED (mutation proof) | mutation | documented in the plan, executed live | Wave 0 |
| TRIG-01 | Raw punctuated turn text does not throw (Pitfall 1) | unit | `node tests/test-244-fts-query-sanitize.cjs` | Wave 0 |
| TRIG-01 | Absent `eureka_fts` degrades to zero candidates, never throws (`MINDRIAN_FORCE_FTS_ABSENT` seam) | unit | same file | Wave 0 |
| TRIG-01 | Ghost trigger: post-`rebuildGraph`, no candidate points at a deleted `node_id` (Pitfall 4) | integration | `node tests/test-244-fts-rebuild-reconcile.cjs` | Wave 0 |
| TRIG-02 | Fusion is rank-position based; reverting to flat `scored.sort` turns a same-family-domination test RED | integration + mutation | `node tests/test-244-rrf-fusion.cjs` | Wave 0 |
| TRIG-02 | Absent tier candidates -> output byte-identical to pre-244 (the no-op guard) | unit | same file | Wave 0 |
| TRIG-03 | Three near-duplicate same-family candidates cannot crowd out a cross-family hit | integration | `node tests/test-244-mmr-diversity.cjs` | Wave 0 |
| TRIG-03 | `MAX_K=3` and the 0.70/0.15 detent unchanged (frozen-scalar fence) | unit | same file | Wave 0 |
| all | Zero em-dashes across every file the phase writes | lint | `grep -lP '\x{2014}' <files>` returns nothing | Wave 0 |

### Sampling Rate

- **Per task commit:** the single affected `node tests/test-244-*.cjs`
- **Per wave merge:** `bash tests/run-all-244.sh`, plus `bash tests/run-all-219.sh` (this phase touches
  the FTS surface 219 owns) and the `f-selector-ranker` suites 205-03/205-04
- **Phase gate:** full suite green, plus `node scripts/build-connector-registry.cjs --check`,
  `node scripts/check-substrate.cjs --diff`, `node scripts/doctor.cjs --acceptance`

### Wave 0 Gaps

- [ ] `tests/run-all-244.sh` - the aggregator (does not exist)
- [ ] `tests/test-244-trigger-tier-vocab.cjs` - TRIG-01 vocabulary + `isContextTier` fence
- [ ] `tests/test-244-content-sensor-fires.cjs` - TRIG-01 fire + anti-fire
- [ ] `tests/test-244-fts-query-sanitize.cjs` - Pitfall 1 + forced-absent degrade
- [ ] `tests/test-244-fts-rebuild-reconcile.cjs` - Pitfall 4 ghost-trigger fence
- [ ] `tests/test-244-rrf-fusion.cjs` - TRIG-02 + no-op guard
- [ ] `tests/test-244-mmr-diversity.cjs` - TRIG-03 + frozen-scalar fence
- [ ] A room.db fixture builder with a real `eureka_fts` index (reuse `tests/test-219-fts5-degrade.cjs`'s
      fixture helper rather than authoring a second one)

---

## Security Domain

### Applicable ASVS Categories

| Category | Applies | Standard control |
|----------|---------|------------------|
| V2 Authentication | no | No auth surface; local CLI/plugin |
| V3 Session Management | no | Session ids are LOCAL correlation handles, not credentials |
| V4 Access Control | no | Single-user local process |
| **V5 Input Validation** | **yes** | **User turn text reaches a SQL MATCH expression.** Mitigated on two independent legs: (a) the query is always a **bound parameter** (`.all(matchExpr, limit)`), never interpolated, so classic SQL injection is structurally impossible; (b) `toFtsMatch` tokenizes to `[a-z0-9]+`, drops stopwords, and double-quotes each token, so FTS5 query-expression injection (`NEAR`, `*`, column filters, `OR` bombs) is also blocked. **The plan must not bypass `toFtsMatch`** |
| V6 Cryptography | no | No crypto introduced |
| V7 Error Handling / Logging | **yes, weakly** | `lexicalSearch:429`'s blanket `catch { return []; }` makes a malformed query indistinguishable from a genuine zero-hit. Recommend a distinguishable counter (Pitfall 1) |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| SQL injection via turn text | Tampering | Bound parameters (already) + `toFtsMatch` allowlist tokenizer (already) |
| FTS5 query-expression injection | Tampering | `toFtsMatch` quoting (already); **do not bypass** |
| ReDoS / query bomb via a very long turn | DoS | Token cap on `toFtsMatch` output; `LIMIT ?` on the query. Measured 0-1 ms, low risk. Recommend an explicit token cap anyway |
| **Canon Part 8 egress of turn text or matched content** | Information disclosure | Reach `evidence` must carry closed scalars/enums ONLY. `makeReach` (`sensor-types.cjs:232-241`) already drops non-primitives, but the plan must not put matched text or node ids on the reach. `contentCandidates` stays LOCAL on `sensorCtx` |
| Ghost trigger on deleted content | Integrity / false success | Pitfall 4 reconcile |
| Stale index presented as a valid no-match | Repudiation / false success | BLOCKER B-2 lifecycle + doctor check |

---

## Sources

### Primary (HIGH confidence)

- **Live execution on this repo's runtime** (Node v22.23.1, SQLite 3.51.3): FTS5 availability, `bm25()`
  sign convention, punctuation-throws, external-content-over-a-view, `'rebuild'` semantics, shadow-table
  enumeration, post-wipe staleness, corpus separation measurements, indexing/query latency.
- **The repo at `a282abe4`**, files read in full or in cited ranges:
  `lib/core/sensors/sensor-types.cjs` (all 267 lines),
  `lib/workflow/f-selector-ranker.cjs:1-120, 490-819`,
  `lib/core/insight-sensors.cjs:340-446, 640-820`,
  `lib/core/navigation-engine.cjs:790-919`,
  `lib/core/lazygraph-ops.cjs:1-240`,
  `lib/core/room-db.cjs:255-334`,
  `lib/core/eureka/tri-modal-index.cjs` (cited ranges),
  `lib/core/eureka/hybrid-retrieve.cjs:1-140, 245-256`,
  `lib/core/eureka/vector-store.cjs:1-50`,
  `lib/core/eureka/lexical-overlap.cjs:36-95`,
  `lib/core/sensors/sensor-expert-skill.cjs:1-60`,
  `lib/core/sensors/sensor-eureka.cjs:1-50`,
  `lib/core/migrations/phase-222-ranker-weights.cjs` (all),
  `scripts/check-substrate.cjs:1-90`,
  `package.json`, `CLAUDE.md`, `.claude/includes/*.md`,
  `.planning/ROADMAP.md:296-315`, `.planning/REQUIREMENTS.md:49-56`, `.planning/STATE.md`.
- **Live data probe:** `~/MindrianRooms/rethinking-mindrianos/.mindrian/room.db` (8.4 MB, read-only).
- `[CITED: sqlite.org/fts5.html]` - official FTS5 spec: bm25 sign convention, column weights,
  external-content/contentless options, `'rebuild'`, MATCH grammar, porter/unicode61 tokenizers, the
  `rank` column.

### Secondary (MEDIUM confidence)

- `[CITED: Cormack, Clarke & Buttcher, SIGIR 2009]` "Reciprocal Rank Fusion outperforms Condorcet and
  individual Rank Learning Methods" - the `1/(k+rank)` formula and `k=60`. Cross-verified against this
  repo's own `rrfFuse`, which independently implements the identical formula.
- `[CITED: Carbonell & Goldstein, SIGIR 1998]` "The Use of MMR, Diversity-Based Reranking..." - the
  canonical `lambda*Rel - (1-lambda)*maxSim` orientation.
- This repo's own documented 2026-07-04 small-corpus validation for `k in 20-30`
  (`hybrid-retrieve.cjs:8-13`).

### Not reached (declared gaps, NOT papered over)

- **Context7 MCP** - tools stripped from this agent; `ctx7` CLI absent. Compensated with the official
  SQLite spec plus live execution, which is strictly stronger for API-behavior claims.
- **langtalks-graph-expert MCP** - tools stripped. **This is a real, open gap.** A consult on
  content-tier trigger design and lexical-vs-hybrid sufficiency is still owed and should run at
  `/gsd-discuss-phase`.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Codebase findings (F-1..F-3, B-1, B-2) | **HIGH** | Every claim re-read at HEAD and, where load-bearing, executed live |
| FTS5 / bm25 API behavior | **HIGH** | Executed on the exact target runtime; cross-checked against the official spec |
| Corpus-quality measurements (Pitfall 3) | **MEDIUM-HIGH** | Real, reproducible, but measured on ONE room |
| Staleness hazard (Pitfall 4) | **HIGH** | Reproduced live |
| Index-lifecycle gap (B-2) | **HIGH** | Verified by exhaustive caller grep plus a live schema dump |
| Tier-precedence recommendation (Q1) | **MEDIUM** | Doctrine-derived from R3, not stated verbatim. Flagged A1 |
| RRF `k` choice | **MEDIUM** | This repo's own researched value; not re-derived for the dial's corpus size |
| MMR design (TRIG-03) | **MEDIUM** | Formula is settled literature; the `sim()` projection choice is a design call |
| langtalks-domain coverage | **LOW** | Mandated source unreachable. Declared, not hidden |

**Research date:** 2026-07-30
**Valid until:** 2026-08-29 (30 days). **Shorter caveat:** this repo has a concurrent session
committing to it, so re-verify all `file:line` anchors before planning. The SYMBOL names are stable;
the numbers may not be.
