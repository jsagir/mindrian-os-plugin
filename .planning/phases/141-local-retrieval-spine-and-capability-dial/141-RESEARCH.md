# Phase 141: Local Retrieval Spine + Capability Dial - Research

**Researched:** 2026-06-04 (legs/dial/BUG verified live) + 2026-06-05 REFRESH (DRSCH doctrine, LARRY-03 reach ids, LARRY-04 Hierarchical Navigator + Usher backbone, FILEVAL-02 filing helper, dial arbitration)
**Domain:** Local in-process context retrieval (SQLite graph + fragments) + Larry prompt-layer policy committal + reach/posture id contracts + typed-evidence filing-with-read-back substrate
**Confidence:** HIGH (all code claims verified at file:line this session; doctrine claims CITED to the three folded studies + Canon)
**Milestone:** v1.13.1 "Larry Reaches" (beta.7) - Decision Gate Option A
**House rule honored:** hyphens only, no em-dashes.

---

## Summary

Phase 141 closes the founding loop ("reduce the time between insight and validated decision") for the first time per turn. It delivers FIVE coherent things in one PR train: (1) `getRoomContext()`, the 100%-local three-leg fusion that lets Larry walk the graph mid-conversation; (2) the committed Capability Dial with `canon_parts` frontmatter + 5 stable machine-readable reach ids + a drift test (LARRY-01/02/03); (3) a NET-NEW Larry-skill doctrine section, the Hierarchical Navigator, grounding BOTH dials in ICM position + full graph state with 3 stable posture ids + a drift test, built on the Usher division-of-labor backbone (LARRY-04 / D-11/12/13); (4) the FILEVAL evidence-filing + read-back-validation substrate (FILEVAL-02), which - critically - EXTENDS the already-shipped `writeEvidenceClaim` chokepoint rather than building a node from scratch; (5) the DRSCH deep-research reach as committed DOCTRINE ONLY. Plus BUG-01, the one-token line-53 fix.

Every original fan-out finding still VALIDATES against live code this session: the three legs exist (`getRoomHomeView` raw Leg A, `getSessionHistory` verbatim-fragment Leg B, `getNeighborhood` recursive-CTE graph-rank Leg C); NO FTS5 table; `packet.cjs::projectText` still HASHES under default mode (the egress antipattern to NOT reuse); `getRoomContext` symbol absent; `userText:null` at intent-classifier.cjs:1081; `NAV_HARD_TIMEOUT_MS=1200`. The Capability Dial is still ` M` uncommitted (HEAD=0, no `git log -S` hit) and now carries ALL FIVE reach rows including the deep-research 5th row and Reach rule 6 in prose - only the machine tokens, the `canon_parts` line, the drift test, and CHANGELOG/version are net-new.

**Two refresh findings sharpen the original scope.** (A) Version drifted from beta.5 to **beta.6** since the prior research; LARRY-02 targets **beta.7**. (B) The single biggest planner-relevant discovery: the typed-evidence-filing substrate FILEVAL-02 was framed to "build" ALREADY SHIPS. `lib/core/navigation/evidence-claim.cjs::writeEvidenceClaim` (Phase 131-01) writes a typed `EvidenceClaim` node with the LOCKED forward-contract provenance schema `{source, url, retrieved_at, evidence_tier, topic, summary}`, review_status `proposed`, UPSERT idempotency; it is re-exported through `navigation.cjs:194`; and it has a LIVE producer (`lib/core/findings-wirer.cjs:150,283` - the source-lens research pipeline ACCEPT path, which also writes the INFORMS/CONTRADICTS cascade edge). FILEVAL-02's genuine net-new is therefore the **read-back validation wrapper** (the FILEVAL honesty rule, surfacing a failed filing instead of swallowing it) plus the **D-10 `artifact_path` fractal-provenance field reservation** - NOT a new evidence node. This is Part-7 reuse-before-build at its strongest.

**Primary recommendation:** Commit the dial FIRST (D-06, it is loseable). Build `getRoomContext()` in NET-NEW `lib/core/navigation/room-context.cjs` (re-exported via navigation.cjs) as `getRoomHomeView` (raw) + windowed `getSessionHistory` + `getNeighborhood`, seed the focus node from the last ~2 fragments, graph-rank-first, NEVER import packet.cjs projection. Add the 5 reach ids + 3 posture ids + their two drift tests. Write the LARRY-04 doctrine leading with the Usher division (tool owns steps 1-2, human owns 3-4; posture = bidirectional traversal), quoting Aronhime. Build FILEVAL-02 as a thin read-back wrapper over the existing `writeEvidenceClaim`, test-first against a fixture, reserving one `artifact_path` provenance field. Flip `userText:null` to the LOCAL seed lane only (D-03). Fix BUG-01.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (DRSCH doctrine-only):** Commit the deep-research dial row (already in working tree) + reach rule 6. Do NOT build the executable framework-led research path (plan builder, plan-gated fetch, hat-scoped web execution, real-fetch evidence filing) in 141. DRSCH-01..04 are satisfied at the DOCTRINE level; their EXECUTION defers.
- **D-02 (FILEVAL-02 in 141):** Build the typed-evidence-filing + read-back-validation path in 141 (overrides the defer default). The helper writes a research/decision conclusion to room.db as a typed evidence node with provenance AND asserts the write landed (read-back), surfacing a failed filing rather than swallowing it (FILEVAL honesty rule).
- **D-02a (fixture-first):** Because DRSCH is doctrine-only, 141 has no live DRSCH producer. The filing/validation helper MUST be built test-first against a fixture evidence node. First real producers are deferred DRSCH execution + Phase 143 FILEVAL-01. "Unused-consumer" is expected, not a smell.
- **D-03 (RETR-02 hot-path wiring):** 141 lands `getRoomContext()` AND flips the live per-turn seed - un-null `userText` at intent-classifier.cjs:1081 so retrieval seeds from the last ~2 turns.
- **D-03a (Part-8 fence):** The un-nulled `userText` flows to the LOCAL seed lane ONLY. It MUST NOT reach `buildBrainPacket`/brain-client. A test asserts the Brain still receives generic handles only (Part 8).
- **D-04a:** `getRoomContext()` lives in NET-NEW `lib/core/navigation/room-context.cjs`, re-exported through `navigation.cjs` (the Part 9 chokepoint). It becomes the first real consumer of `getSessionHistory` - add it to the chokepoint rather than calling memory-ops directly.
- **D-04b:** Leg C is graph-ranking-first. NO speculative FTS5. A local FTS5 virtual table is built ONLY if a benchmark on a populated room.db shows graph-ranking misses the 1200ms budget (RETR-04). FTS5 stays a documented contingency.
- **D-04c:** `canon_parts: [Part 2, Part 3, Part 8, Part 9]` on the committed SKILL.md. (Part 2 covers the EXTERNAL WEB affordance the deep-research reach articulates.)
- **D-04d:** BUG-01 = one-token `roomDbPath` fix at line 53 + a regression test that runs the script against a no-room-db dir and asserts exit 0.
- **D-05 (LARRY-03 reach ids):** The committed dial encodes EXACTLY 5 stable machine-readable reach ids: `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`. A drift test asserts the reach bank covers EXACTLY these 5.
- **D-06 (ordering):** Commit the dial FIRST, as execution step 1, before any branch/stash/worktree operation. The SKILL.md edit is ` M` (uncommitted, in no commit); a stash/checkout would lose it. HARD ordering constraint.
- **D-07 (present vs net-new):** PRESENT as prose (needs committing): all 5 reach rows incl. deep-research 5th row + reach rule 6. NET-NEW at execution: (1) `canon_parts` frontmatter line; (2) the 5 machine-readable reach ids; (3) the drift test asserting exactly 5; (4) CHANGELOG + version bump. EXPLICITLY NOT in 141: any executable invocation firing the deep-research reach.
- **D-08 (read side):** `getRoomContext()` is graph-native, reads room.db via the navigation.cjs Part 9 chokepoint, does NOT scan the nested fractal MD tree. Honors the Phase 109 zero-non-SQLite-read invariant. 141 creates no new room directories, so no new ROOM.md obligation (Decision 15).
- **D-09 (write side, graph-first, MD deferred):** The FILEVAL helper writes graph-first: a typed evidence node + provenance + read-back assertion to room.db IS the source of truth. The human-readable memory-MD projection stays in MEMDIAL / Phase 143. HARD CONSTRAINT: 141's evidence-node schema must not preclude that projection.
- **D-10 (fractal artifact contract):** 141 DEFINES the contract (not the producer) for how DRSCH conclusions become nested fractal artifacts per Decision 16: path template `<section>/<research-topic-slug>/<research-topic-slug>.md` + per-artifact ROOM.md identity (Decision 15). The 141 evidence-node schema carries a provenance field for this artifact path. Artifact WRITING rides with DRSCH execution (deferred).
- **D-11 (LARRY-04 read depth = FULL graph state):** The Hierarchical Navigator doctrine has Larry read, every beat: ICM-hierarchical position (which near-decomposable subsystem/level) + journey-stage (Part 2a) + the FULL graph-SQL state `getRoomContext()` surfaces (confirmed vs proposed, contradictions, evidence tiers per Part 5, thin spots, convergence). Maps to a POSTURE + an offered MOVE (one of the 10 Decision-Gate verbs / framework / reach + how).
- **D-12 (3 posture ids + drift test):** The doctrine encodes EXACTLY 3 stable posture ids `{push_forward, hold, pull_back}` + a drift test asserting exactly 3 (mirrors LARRY-03).
- **D-13 (DIAL ARBITRATION):** Neither dial is a captain. The USER is the captain and holds the only helm. The two dials = a SINGLE navigation instrument. Internal arbitration = reach precedes push (NOT one dial ruling the other). The Usher division SUPERSEDES "internal arbitration" as the primary articulation: tool owns Usher steps 1-2 (perceive + set the stage = the reach = Capability dial); human owns steps 3-4 (insight + critical revision). Posture = bidirectional traversal of the Usher cycle. Surfaces as a new Reach rule 7 (arbitration/precedence) naming the anti-pattern.

### Claude's Discretion
- Window size N for Leg B and topK/maxDepth for Leg C (suggested: last 1 session + ~6 fragments, topK 10-20, maxDepth 2; tune via the RETR-04 benchmark).
- Whether `getRoomContext()` logs a `context_assembled` memory_event (and whether that needs an additive EVENT_TYPES bump). If logged, treat as a Part 9 audit-node carve-out (`created_by=system review_status=confirmed`).
- The exact typed evidence-node shape + provenance fields for the FILEVAL helper (must be Part 4 / Part 9 consistent; align with the cascade-edge schema). RESEARCH FINDING: reuse the shipped `writeEvidenceClaim` schema; add ONE `artifact_path` field.
- The fragment-to-focus-node seed resolver strategy (section_context match + cheap lexical pick; FTS5 fallback shares D-04b's benchmark gate).

### Deferred Ideas (OUT OF SCOPE for Phase 141)
- DRSCH executable plumbing (plan builder, Decision-Gate plan presentation, hat-scoped web fetch reusing /mos:research + Phase 131, filing real fetched conclusions, the nested-fractal-artifact PRODUCER per Decision 16). 141 ships the doctrine + the fixture-tested filing substrate + the locked artifact-path contract only.
- MEMDIAL MD projection (the MD side of Part 9). Phase 143 (MEMDIAL-01..03). 141 builds the graph side only and reserves the schema field.
- Desktop/Cowork dual-path fix (`buildContext` -> navigation.cjs). Policy stays CLI-honored for v1.13.1.
- A code dispatcher that reads the dial trigger column and auto-fires a reach. The dial stays prompt-layer doctrine.
- Local semantic/vector leg (Pinecone is remote + Part-8-fenced).
- Bi-temporal edges Stage-2 PK-change migration (SLICE-D).
- LARRY-04 executable enforcement (sensors that read ICM+graph; the nav engine that emits the posture). Defers to Phase 143 (SENS) + Phase 144 (NAV).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETR-01 | `getRoomContext()` fuses Leg A (`getRoomHomeView` RAW) + Leg B (`getSessionHistory` fragments, windowed) + Leg C (`getNeighborhood` graph-ranking), seeded by last ~2 turns | All three legs verified live: room-home.cjs:102-141, memory-ops.cjs:314-333, neighborhood.cjs:48-79. Fusion symbol absent (grep exit 1) - net-new. `packet.cjs` proves the fusion shape works. [VERIFIED: live code] |
| RETR-02 | `getRoomContext()` wired as retrieval seed; per-turn loop stops forwarding `userText:null` | Confirmed: intent-classifier.cjs:1081 `userText: null, // hot path does not forward prompt content` (verified 2026-06-05). [VERIFIED: live code] |
| RETR-03 | Raw prose stays local: does NOT reuse `packet.cjs` projectText/hashText egress path | Confirmed: packet.cjs:130-139 `projectText` returns `hashText(s)` under default `local_summary_only`. `safeShape` (room-home.cjs:29-43) is the raw-prose path. [VERIFIED: live code] |
| RETR-04 | Per-turn assembly under 1200ms NAV timeout (graph-ranking first; FTS5 only if needed, benchmarked) | Confirmed: `NAV_HARD_TIMEOUT_MS = 1200` (intent-classifier.cjs:635), Promise.race at :1196 (verified 2026-06-05). NO FTS5 today. [VERIFIED: live code] |
| LARRY-01 | "When to Reach -- The Capability Dial" committed to HEAD with `canon_parts` frontmatter + CHANGELOG | Confirmed uncommitted (HEAD=0, WT=1, ` M`, no `git log -S` hit, verified 2026-06-05). Frontmatter is only `name`+`description`. Precedent: skills/mva-pipeline/SKILL.md:7. [VERIFIED: live code] |
| LARRY-02 | Version bumped (next beta) with dial as tracked, release-noted change | Current: 1.13.1-beta.6 (plugin.json + package.json in sync, verified 2026-06-05). Target: beta.7. [VERIFIED: live code] |
| LARRY-03 | Dial encodes EXACTLY 5 stable reach ids {context_block, contradiction, cross_room, brain_consult, deep_research} + drift test asserts exactly 5 | The dial today carries prose rows only, NO machine tokens. Net-new: the ids + the drift test. Phase 143 DIALTUI keys off these. [VERIFIED: SKILL.md has prose, no tokens] |
| LARRY-04 | Hierarchical Navigator doctrine grounding both dials in ICM position + full graph state -> posture {push_forward, hold, pull_back} + offered MOVE; 3 posture ids + drift test; Usher backbone | NET-NEW prompt-layer section. Doctrine in 141; executable enforcement defers to 143/144. Grounded in Aronhime (Usher), CoALA, Horvitz, HIC+AITL. [CITED: the three folded studies + Canon] |
| BUG-01 | Fix `build-graph-from-sqlite.cjs:53` ReferenceError (`lazygraphPath` undefined) | Confirmed: :50 defines `roomDbPath`; :53 references undeclared `lazygraphPath` (verified 2026-06-05). One-token fix. [VERIFIED: live code] |
| DRSCH-01 | Capability dial gains a 5th reach: external-fact need / load-bearing claim near commit lacks evidence / navigator asks to research -> framework-led deep research plan, never bare web search | PRESENT in SKILL.md:41 as prose. DOCTRINE-ONLY in 141 (D-01). Grounded in DEEP-RESEARCH-PARADIGM. [VERIFIED: SKILL.md:41] |
| DRSCH-02 | Plan SHAPED by a thinking framework: Six Hats hat-scoped angles, Reverse Salients name the lagging component | PRESENT in SKILL.md:41 prose (White=data/Green=innovation/Black=failure/Yellow=success). DOCTRINE-ONLY. [VERIFIED: SKILL.md:41 + CITED: study sec 2-3] |
| DRSCH-03 | Plan built by jointly consulting LOCAL brain (room graph) AND REMOTE brain (teaching graph), generic handles only on remote (Part 8) | PRESENT in SKILL.md:41 + Reach rule 6. DOCTRINE-ONLY. [VERIFIED: SKILL.md:41,50 + CITED: study sec 3] |
| DRSCH-04 | Plan-gated execution: navigator approves framework+angles BEFORE any fetch; hat-scoped fetch per Part 2; reuse /mos:research + Phase 131; results file as typed graph evidence (Part 4) with provenance | PRESENT in SKILL.md:41 + Reach rule 6 (plan-gated). DOCTRINE-ONLY; EXECUTION defers (D-01). The "file as typed graph evidence" target is the FILEVAL-02 substrate. [VERIFIED + CITED] |
| FILEVAL-02 | Deep-research fetched conclusions file to local graph as typed evidence nodes with provenance, not only prose | REUSE: `writeEvidenceClaim` (evidence-claim.cjs, Phase 131-01) already does this. 141 net-new = a read-back-validation wrapper + an `artifact_path` provenance field (D-10). Built test-first vs a fixture (D-02a). [VERIFIED: evidence-claim.cjs + findings-wirer.cjs] |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `getRoomContext()` 3-leg fusion | API/Backend (`lib/core/navigation/*.cjs`) | Database (`room.db`) | Pure in-process Node read over room.db; called by CLI hook path; 100% local per Canon Part 8 |
| Leg A room-state summary | Database (navigation.cjs chokepoint) | - | `getRoomHomeView` pure composition over the Phase 109 chokepoint |
| Leg B recent-message recency | Database (`fragments` table via memory-ops) | - | `getSessionHistory` reads verbatim turn log locally |
| Leg C relevance ranking | Database (recursive CTE over `nodes`/`edges`) | - | `getNeighborhood` is graph-structural; no network, no Brain |
| Retrieval seed (last ~2 turns) | API/Backend (per-turn hook) | Database (fragments) | Seed source is the fragments leg; focus-node derivation is the new LOCAL-only wiring (D-03a) |
| FILEVAL evidence filing + read-back | Database (navigation.cjs `writeEvidenceClaim`) | API/Backend (read-back wrapper) | Typed-node write + INFORMS edge through the chokepoint; the read-back SELECT is the new honesty layer |
| Capability-dial policy (5 reaches) | Prompt layer (SKILL.md) | - | Doctrine for Larry-the-model; no code enforces it (CLI-honored only) |
| Hierarchical Navigator (LARRY-04 posture) | Prompt layer (SKILL.md) | - | Doctrine only in 141; sensors (143) + nav engine (144) make it executable |
| Reach/posture id contracts (5 + 3) | Prompt layer (machine tokens) + Test layer (drift tests) | - | Stable ids consumed by Phase 143 DIALTUI / SENS + Phase 144 NAV |
| BUG-01 graph-export guard | Backend script (`build-graph-from-sqlite.cjs`) | - | Standalone export script reached via `graph-ops.cjs` execSync |

---

## getRoomContext() Validation Verdict

**VERDICT: BUILDABLE. All three legs are live; the fusion is net-new; the antipattern is real and avoidable.** (Unchanged from prior research; re-verified 2026-06-05.)

### Leg-by-leg live-code confirmation

| Leg | Function | File:line | Returns | Local-safe? |
|-----|----------|-----------|---------|-------------|
| A (room/USER summary) | `getRoomHomeView(db, roomId, opts)` | `lib/core/navigation/room-home.cjs:102-141` | 9-field object {currentThesis, confirmedFacts, riskyAssumptions, evidence, contradictions, openQuestions, recentChanges, bankedOpportunities, nextMove} | YES - `safeShape` (room-home.cjs:29-43) truncates to 120 chars, returns RAW `summary\|\|claim\|\|title`, does NOT hash |
| B (recent raw messages) | `getSessionHistory(db, limit=10)` | `lib/core/memory-ops.cjs:314-333` | Sessions DESC each with nested `fragments[]` (role/content/timestamp/section_context) | YES - verbatim `fragments` table, never hashed |
| C (relevance ranking) | `getNeighborhood(db, focusNodeId, opts)` | `lib/core/navigation/neighborhood.cjs:48-79` | Top-K graph neighbors ranked by frozen score | YES - recursive CTE over local nodes/edges, structural-only, no network |

### The frozen score (Leg C ranking, neighborhood.cjs:14-46)
```
score = edge_type_weight * 0.4          (CONTRADICTS/INVALIDATES=1.0 ... default 0.3)
      + recency_decay(last_seen_at) * 0.2  (90-day hardcoded window)
      + COALESCE(confidence, 0.5) * 0.2
      + same_source_section_bonus * 0.2
```
Purely structural. No lexical or vector term. This is the local relevance substitute for the missing semantic leg. The CONTEXT-MANAGEMENT-FRONTIER study confirms this is a FEATURE: a frozen explainable score is exactly Letta/Zep's white-box-memory selling point ("this ranks 0.95 because it CONTRADICTS your focus and was touched 2 days ago") - the frontier is converging on explainability we already have.

### NO FTS5 (confirmed, re-verified 2026-06-05)
`grep -rniE 'using fts5|...|virtual table'` across lib/scripts/bin returned exit 1 (zero hits). There is NO local searchable index. (RETR-04: graph-ranking-first is the only zero-build latency path; FTS5 is net-new if benchmarks demand it.) FRONTIER VALIDATION: Mem0 dropped its graph in v3 because on LOCOMO the graph variant won 68.44 vs 66.88 while ~3x slower / ~2x tokens - graph memory must EARN its latency. RETR-04's benchmark-before-FTS5 discipline is the validated stance.

### packet.cjs is the egress antipattern to NOT reuse (confirmed)
`lib/core/navigation/packet.cjs:130-139` - `projectText(text, privacyMode)` returns `hashText(s)` under the default `local_summary_only` mode. `getRoomContext()` MUST NOT import: `projectText`, `shortText`, `hashText`, `safeNodeProjection`, `safeContradictionProjection`, `safeUnsupportedProjection`, `resolvePrivacyMode`, `PRIVACY_MODES`.

### Implementation-ready guidance

**Function signature (recommended):**
```javascript
// lib/core/navigation/room-context.cjs  (re-exported through navigation.cjs)
// Local in-process 3-leg fusion. 100% local. NEVER egresses. Canon Part 8 + Part 9.
async function getRoomContext(db, roomId, opts) {
  // opts: { seedFragments?: Array, topK?: number, fragmentWindow?: number, maxDepth?: number }
  // returns: { summary, recentMessages, relevantNodes, _meta }
}
module.exports = { getRoomContext };
```

**The 3-leg fusion:**
1. **Leg A** - call `getRoomHomeView(db, roomId, opts)` AS-IS. Reuse `safeShape`'s raw path. Do not re-derive.
2. **Leg B** - call `getSessionHistory(db, limit)` and WINDOW it: most recent session's last N fragments. Apply a trim budget (planner picks N + cap). Windowing/trim is net-new in the fusion.
3. **Leg C** - derive a focus node from the last ~2 fragments (the seed), then `getNeighborhood(db, focusNodeId, {topK, maxDepth})`.

**The seed source (last ~2 fragments) - the load-bearing new wiring:**
- Today retrieval re-seeds from VENTURE STATE only (`focus.cjs::computeAutoFocus`: active JTBD -> unconfirmed DECISION_GATE -> room root -> null). That is why "do you remember X" does not pull X.
- 141 introduces a conversation-derived seed: take last ~2 fragments from Leg B, resolve to a focus node (match fragment `section_context` to a `section:` node id, or cheap lexical match against `nodes.properties`), feed that id to `getNeighborhood`.

**The latency strategy (RETR-04):** Graph-ranking FIRST. Add a LOCAL FTS5 virtual table ONLY if benchmarked under a populated room.db to underperform. Must finish inside the 1200ms `NAV_HARD_TIMEOUT_MS` Promise.race envelope OR run off the hot path.

**Chokepoint note (Canon Part 9, D-04a):** `navigation.cjs` exports `getNeighborhood` (:52) and `getRoomHomeView` (:73) but NOT `getSessionHistory` (verified 2026-06-05 - it lives in memory-ops.cjs re-exported at :592). D-04a mandates adding `getSessionHistory` to the navigation.cjs chokepoint; `getRoomContext` is its first real consumer.

### RETR-03 / Canon Part 8 confirmation: 100% local, no egress
`getRoomContext()` feeds Larry's IN-PROCESS reasoning, never the wire. Reuses raw-prose paths, excludes the packet.cjs hashing/privacy machinery. **Confirmed 100% local. Zero Part-8 exposure.**

---

## THE LARRY UPGRADE -- "When to Reach: The Capability Dial" (LARRY-01 / LARRY-02 / LARRY-03)

> First-class requirement. Policy and substrate ship coherently in the SAME phase (Decision Gate Option A).

### Validation of the working-tree dial (re-verified 2026-06-05)

**(a) Present and UNCOMMITTED.** `git show HEAD:...SKILL.md | grep -c "Capability Dial"` = **0**; working tree = **1**; `git status --short` = ` M`; `git log -S "When to Reach"` = no commit. Risk: a stash/checkout drops it. Commit it FIRST (D-06).

**(b) The full dial prose is present** (verified at SKILL.md this session):
- Line 31 heading `## When to Reach -- The Capability Dial`.
- 5 reach ROWS (SKILL.md:37-41): Context Block / contradiction surface / cross-room reach / Brain consult / **framework-led deep research plan** (the 5th, DRSCH, fully present at :41 with the hat-scoped angle breakdown).
- Reach rules 1-6 (SKILL.md:45-50), INCLUDING rule 5 "Part 8 is the floor" and rule 6 "Deep research is plan-gated and may chain."

**(c) NOTHING in lib/scripts/hooks enforces it** - policy is prompt-layer only. The underlying capabilities are all live in navigation.cjs, but ZERO code wiring from the policy text to any executor. (Intentional for v1.13.1.)

**(d) Dual-path gap confirmed** - `buildContext` (chat-context-builder.cjs:33-35) requires only node builtins, never navigation.cjs. Policy is CLI-honored only. Closing it is DEFERRED.

### LARRY-03: the 5 stable machine-readable reach ids (NET-NEW, D-05)

The dial today carries PROSE ROWS ONLY - no machine tokens. Net-new in 141:

| Reach id (stable) | Dial row | Maps to live capability |
|-------------------|----------|--------------------------|
| `context_block` | SKILL.md:37 | `getRoomContext()` (this phase's substrate) |
| `contradiction` | SKILL.md:38 | `findContradictions` / `findSurfaceableTensions` |
| `cross_room` | SKILL.md:39 | `cross-room-aggregator.cjs` (Phase-83 fenced) |
| `brain_consult` | SKILL.md:40 | `buildBrainPacket` / brain-client.cjs |
| `deep_research` | SKILL.md:41 | DOCTRINE-ONLY in 141; executor deferred (D-01) |

**Encoding recommendation:** add the 5 ids as a machine-readable block in the SKILL.md (e.g. a fenced `reach_ids:` list or a per-row id token the drift test can grep). The drift test (`tests/test-dial-reach-ids.cjs`, Wave 0) asserts the reach bank covers EXACTLY these 5 (no more, no fewer) - mirroring the Phase 90 / 110-05 / 124 forbidden-substring + exact-set adversarial test idiom. Phase 143 DIALTUI-01/04/05 keys off these ids (keep them stable - DIALTUI-05 also asserts the label bank covers exactly the 5).

### LARRY-01: canon_parts frontmatter (NET-NEW, D-04c)

Current frontmatter (HEAD + WT, verified): only `name` + `description`. Add `canon_parts: [Part 2, Part 3, Part 8, Part 9]`. Precedent: `skills/mva-pipeline/SKILL.md:7`.

| Canon Part | Why the dial touches it |
|------------|--------------------------|
| Part 2 | The reaches ARE the team's TOOL ACCESS (LOCAL GRAPH / REMOTE BRAIN) + EXTERNAL WEB affordances. The deep-research row maps to EXTERNAL WEB hat-scoping (White=Tavily+arxiv...). |
| Part 3 | The contradiction row's "ONE line then Decision Gate APPROVE/REJECT/DEFER" is Part 3 verbatim. |
| Part 8 | Brain-consult "generic handles, never user bytes" + Reach rule 5 "Part 8 is the floor" are Part 8 verbatim. |
| Part 9 | The Context Block reach is the "Larry explains" face of SQL-as-local-mind; the block IS what `getRoomContext()` assembles. |

### LARRY-02: CHANGELOG + version bump

Current version: **1.13.1-beta.6** (plugin.json + package.json in sync, verified 2026-06-05 - note this is a DRIFT from the prior research's beta.5). Target: **beta.7**. Honor the 5-place lockstep (CHANGELOG, plugin.json, package.json, git tag, marketplace.json with `ref`). CHANGELOG `### Added` should name: the tracked Capability Dial (5-reach GUIDED-default trigger map + reach rules), `getRoomContext()` local retrieval spine, the Hierarchical Navigator doctrine, the FILEVAL evidence filing+read-back substrate, the 5 reach ids + 3 posture ids; `### Fixed` should name BUG-01.

---

## THE HIERARCHICAL NAVIGATOR -- LARRY-04 Doctrine (NET-NEW, D-11/12/13)

> A NET-NEW prompt-layer Larry-skill section. DOCTRINE ONLY in 141; the executable sensors (Phase 143 SENS) + nav engine (Phase 144 NAV) defer. This makes the Architecture Theorem ("Larry IS the hierarchical search navigator", CLAUDE.md) operational doctrine.

### How to WRITE this doctrine section (the load-bearing research output)

The doctrine is ONE mapping: **(where the navigator is in the hierarchy + what the graph knows) -> a pedagogical POSTURE + the offered MOVE.** It grounds BOTH existing dials (the Ask-Tell dial = how hard to push pedagogy; the Capability dial = what to reach for) in two readings every beat:
1. **ICM-hierarchical position** - which near-decomposable subsystem/level (Simon, CLAUDE.md), + journey-stage (Campbell, Canon Part 2a).
2. **FULL graph-SQL state** that `getRoomContext()` surfaces - confirmed vs proposed nodes, contradictions, evidence tiers (Part 5), thin spots, convergence.

### Lead with the Usher division (D-13, the PRIMARY articulation)

The doctrine text MUST lead with the Usher cumulative-synthesis model (Usher 1929; Aronhime's framing per ARONHIME-EVOLUTION study) because it makes two-captains impossible BY CONSTRUCTION - the tool and the human never own the same step:

> Usher's four steps: (1) Perceive the problem, (2) Set the stage, (3) Act of insight, (4) Critical revision. Per Aronhime, verbatim: **"Mindrian accelerates Steps 1 and 2 while keeping Steps 3 (insight) and 4 (validation) with the human. The insight belongs to you; the reach belongs to the tool."**

- **The Capability dial (the reach) operates in Usher steps 1-2** (perceive + set the stage): retrieve the Context Block, surface contradictions, set the evidentiary stage. The tool's lane.
- **The human owns Usher steps 3-4** (the act of insight + critical revision/validation). The captain's lane. Larry NEVER crosses into step 3 (never claims the insight) and never burdens the human with steps 1-2.
- **The posture is the BIDIRECTIONAL traversal of the Usher cycle:** validation holds (step 4 passes; insight earned its evidence = bidirectional Ackoff ascent) -> `push_forward`. Validation finds a gap / evidence thin (step 4 surfaces weakness) -> `pull_back` to steps 1-2 (the tool re-reaches, re-sets the stage). Nothing grounded yet (mid-step-2) -> `hold` (stay quiet).

### The 3 posture ids (NET-NEW, D-12) and their triggers

| Posture id (stable) | Fires when | Usher mapping | Aronhime grounding |
|---------------------|-----------|---------------|---------------------|
| `push_forward` | Accumulating confirmed evidence + a well-defined subsystem ready to climb a level or advance a stage (bidirectional Ackoff ascent: confidence has earned its evidence) | Step 4 validation holds | "reach matters more than raw intelligence" - the lever, now grounded |
| `hold` | Nothing grounded to say yet (mid step-2); the reach is pending/failed | Mid step-2, stay quiet | "Knowing when to stay quiet. A wrong suggestion is worse than no suggestion... restraint is the product working correctly." (verbatim) |
| `pull_back` | Unresolved contradictions, None-tier evidence near a commit (Part 5), or circular/stuck/regression signals (Decision 14 bidirectional; Appendix E trigger 4) | Step 4 surfaces a gap -> return to 1-2 | bidirectional Ackoff DESCENT: "has your confidence earned its evidence?" |

The drift test (`tests/test-navigator-posture-ids.cjs`, Wave 0) asserts EXACTLY 3 posture ids (mirrors the LARRY-03 exactly-5 test). Phase 143 SENS sensors + Phase 144 NAV engine key off them.

### The arbitration / two-captains resolution (Reach rule 7, NET-NEW)

Surface D-13 as a new **Reach rule 7 (arbitration/precedence)** that names the anti-pattern explicitly. The doctrine text should encode, grounded in the CONTEXT-MANAGEMENT-FRONTIER study:

- **The dials are NOT two controllers - they are two dimensions of ONE decision cycle (CoALA, arXiv 2309.02427).** One decision procedure loops: PLANNING (propose -> evaluate -> select among an action space, using memory) then EXECUTION (run the selected action). Capability dial = internal action-selection (which reach to run in planning); Ask-Tell dial = the external grounding action (the response, in execution). "Reach precedes push" IS the CoALA cycle. There is only one decision procedure, never two.
- **Helm model = HIC + AITL** (Red Hat taxonomy). The user is Human-in-Command (sole authority, the only helm); Larry is AI-in-the-loop assistance. The Decision Gate (Part 3) is the authority-transfer protocol (Burstein and McDermott 1996, central authority manager); typed decision edges + provenance are the author/change-authority tracking.
- **Reach trigger = expected value over inaction** (Horvitz mixed-initiative, CHI 1999): a reach fires only when its expected value to the navigator beats staying quiet. Sharpens Reach rule 1 (GUIDED) and matches Aronhime's restraint principle.
- **Name the anti-pattern: Reasoning-Action Disconnect** (the output contradicts the reasoning that preceded it) alongside "two captains, one ship". Mitigation = structural control of the reasoning-to-action seam = reach-precedes-push + honesty floor.
- **Transparency is mandatory** (Sarter and Woods; Parasuraman/Sheridan/Wickens): never change posture or filing silently; the decision_trace + Reading-the-Room trace + "let me search" are the documented countermeasure against mode-confusion / automation-surprise.

**The collapse:** the Capability dial evaluates first (does the turn need a reach?); the reach RESULT sets the posture (push_forward/hold/pull_back); the Ask-Tell dial sets intensity WITHIN that posture. ONE coherent instrument reading, advisory; the captain (user) steers. Reach pending/failed -> `hold` -> "let me search" (honesty floor). Contradiction -> `pull_back` -> Decision Gate, never a verdict. Confirmed evidence -> `push_forward`. No reach (JUST_TALK) -> instrument quiet. Explicit "just tell me / bottom line" -> the captain overrides the instrument; deliver immediately, honestly flagged grounded-vs-unverified.

### Aronhime quotes the doctrine text SHOULD use (CITED: ARONHIME-EVOLUTION study)

- "The insight belongs to you; the reach belongs to the tool." (the governance anchor)
- "Improving information retrieval produced four times more accuracy improvement than improving the reasoning model... reach matters more than raw intelligence." (the milestone justification)
- "Knowing when to stay quiet. A wrong suggestion is worse than no suggestion... restraint is the product working correctly." (the `hold` posture)
- "It suggests a next move. Not a menu of options. One move, grounded in what your workspace actually contains." (the offered MOVE; one reach per beat)
- The temporal search gradient (UDP -> IDP -> WDP as a directional gradient) maps to push_forward/pull_back across stages; the bidirectional Ackoff DIKW descent ("has your confidence earned its evidence?") is the pull_back diagnostic.

---

## THE DRSCH REACH -- Doctrine-Only Coverage (DRSCH-01..04, D-01)

> DRSCH ships as committed DOCTRINE ONLY in 141 (like the other four reaches stay prompt-layer). The dial text (SKILL.md:41 + reach rule 6) is committed and tracked. NO executable plan-builder / fetch plumbing this phase. The research here establishes what the committed DOCTRINE TEXT must SAY, grounded in DEEP-RESEARCH-PARADIGM-online.md so the doctrine is GSD-researched, not assumed.

### What the committed doctrine text already says (verified present, SKILL.md:41 + :50)

The 5th reach row + reach rule 6 articulate a framework-led, plan-gated, hat-scoped research reach that joins the local + remote brain to build ONE specific plan, gated at a Decision Gate before any fetch, executing via /mos:research (reuse). This is exactly the paradigm the study recommends - the doctrine is already correct; 141 commits it.

### Why the doctrine is correct (CITED: DEEP-RESEARCH-PARADIGM study)

The study's recommended paradigm is a LOCAL+REMOTE-brain-planned, framework-shaped, plan-gated, hat-scoped research reach reusing Tavily - a plan-and-execute spine (NOT ReAct) in five stages:
1. **PLAN (brain-planned, framework-shaped)** - Brain turns the question into a MECE issue tree, assigns each branch a Hat lens, marks the Reverse-Salient deep-budget leg. Local graph = venture context; remote Brain = framework chain. The differentiator no competitor ships (a curated named lens set, not generic decomposition).
2. **PLAN GATE (the dial)** - show the plan before spending tokens; MECE coverage + effort-scaling check. (This is Reach rule 6's "present the plan and get APPROVE before any fetch.")
3. **FAN-OUT (hat-scoped searchers over Tavily)** - one searcher per lens in parallel; subagents named by hat so the trace is auditable.
4. **VERIFY (stage gates, not one score)** - source-tier check, per-branch coverage, URL verification; replan only failing branches.
5. **SYNTHESIZE + FILE (provenance-first)** - findings labeled by lens, every claim a URL, filed with provenance + Brain connections. (This is where DRSCH execution will call the FILEVAL-02 substrate.)

The four BLACK-hat failure modes the doctrine guards against by construction: hallucinated/dead citations (URL health + citation step), scope drift / aggregate-score trap (independent axes + MECE at plan time), weak/monoculture sources (source-tier stratification), cost/recursion blowup (effort scaling, recursion limits, start-wide-then-narrow). The doctrine's "plan-gated, framework-shaped" framing IS the mitigation.

### What 141 does NOT build (D-01, deferred)

The executable plan builder, Decision-Gate plan presentation, hat-scoped web fetch (reusing /mos:research + the deep-research skill + Phase 131 research-as-graph-aware-workflow), filing real fetched conclusions, and the nested-fractal-artifact PRODUCER (Decision 16). 141 commits only the doctrine text + reach id + the contract the producer will fill (D-10).

---

## FILEVAL-02 -- Typed-Evidence Filing + Read-Back Validation (D-02/D-09/D-10)

> **MAJOR REUSE FINDING.** The typed-evidence-filing substrate is NOT net-new. It SHIPS. Build the read-back wrapper + the artifact-path reservation ON it (Part 7 reuse-before-build).

### What already exists (VERIFIED live this session)

`lib/core/navigation/evidence-claim.cjs` (Phase 131-01) ships `writeEvidenceClaim(db, params)`:
- Writes a typed `EvidenceClaim` node with the **LOCKED Phase-136 forward-contract provenance schema**: `{source, url, retrieved_at, evidence_tier, topic, summary}`.
- `review_status: 'proposed'` (a TRUTH-CLAIM node per Canon Part 9 role 5 - NEVER auto-confirmed; promotion is a human Decision Gate via `navigation.confirmNode`).
- `created_by: 'system'`, `confidence: NULL`, UPSERT idempotency keyed on `EvidenceClaim:<sessionId>:<urlHash>`.
- Validates `evidence_tier` against the closed Part-5 set `{Academic, Operational, Practitioner, None}` (`EVIDENCE_TIERS`).
- Re-exported through `navigation.cjs:194` (the Part 9 chokepoint). Returns `{ ok, node_id } | { ok:false, reason }`.
- HAS A LIVE PRODUCER: `lib/core/findings-wirer.cjs:150,283` (the source-lens research ACCEPT path) calls it then writes an `INFORMS` edge (findings-wirer.cjs:172) via `navigation.writeEdge`, with `CONTRADICTS` on kill-claim (:197). This is the exact node+cascade-edge pattern FILEVAL must align with.

The edge-write chokepoint is `lib/core/navigation/edges.cjs::writeEdge(db, params)` - `params {source_id, target_id, edge_type, properties}`, `edge_type` validated against the frozen `ALLOWED_EDGE_TYPES` Set (additive idiom; INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES + DEFERRED/REJECTED/DERIVED_FROM/FILED_AS_DECISION/FOLLOWS_FROM/OPERATOR_TRANSITION ...). Returns `{ ok, edge_id, type, source, target }`. The node-INSERT precedent for a BEGIN/COMMIT/ROLLBACK transactional filing + ONE memory_event is `lib/core/navigation/ingestion.cjs::storeBrainSuggestions`.

### What 141's FILEVAL-02 actually builds (NET-NEW, the genuine delta)

1. **A read-back validation wrapper** (the FILEVAL honesty rule, D-02). After `writeEvidenceClaim` returns `{ok, node_id}`, the wrapper performs a read-back SELECT (`SELECT id, type, review_status, source_path, properties FROM nodes WHERE id = ?`) and ASSERTS the row landed with the expected provenance. On mismatch/missing it returns a structured failure (`{ ok:false, reason:'filing_did_not_land', ... }`) so a failed filing is SURFACED, not swallowed. This is FILEVAL-03's honesty rule applied to the FILEVAL-02 filing. Recommended home: a thin `fileEvidenceWithReadback(db, params)` in `lib/core/navigation/` re-exported through navigation.cjs, wrapping `writeEvidenceClaim` + `writeEdge` (INFORMS) in one transaction then read-back.
2. **The `artifact_path` provenance field reservation (D-10).** Add ONE optional field to the params/props so the graph node can carry the future nested-fractal-artifact path (`<section>/<research-topic-slug>/<research-topic-slug>.md`, Decision 16) WITHOUT a migration when the DRSCH producer later writes the MD artifact. CONSTRAINT (D-09): the schema must not preclude the Phase-143 MEMDIAL render-from-graph projection. CAUTION: the existing 6 props are a LOCKED Phase-136 forward-contract (evidence-claim.cjs:36-40) consumed by Phase 136's detail-pane + getConfirmedFacts - adding `artifact_path` must be PURELY ADDITIVE (an extra optional prop), never a rename/drop of the four locked provenance fields.
3. **Fixture-first tests (D-02a).** 141 has no live DRSCH producer, so test the wrapper against a FIXTURE evidence node (`tests/fixtures/`): assert (a) the node lands with full provenance; (b) the read-back catches a simulated failed write; (c) the INFORMS edge lands; (d) the `artifact_path` field round-trips; (e) review_status is `proposed` (never auto-confirmed - Part 9 role 5). Treat "unused-consumer" as expected.

### Existing event-type reuse (no EVENT_TYPES bump needed for FILEVAL)
`EVENT_TYPES` (memory-events.cjs:317-319) ALREADY contains `research_filed`, `research_rejected`, `research_deferred`. If the FILEVAL wrapper logs a memory_event, reuse `research_filed` - no additive bump required. (`logEvent` rejects any event_type outside the Set and returns `{ ok, eventId }`.)

---

## BUG-01 Verdict

**VERDICT: CONFIRMED. One-token fix.** (Re-verified 2026-06-05.)

`scripts/build-graph-from-sqlite.cjs`: line 50 `const roomDbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');` (correct). Line 53 `if (!fs.existsSync(lazygraphPath)) {` - `lazygraphPath` is NEVER declared. The exit-0 try/catch opens AFTER the throwing guard, so the ReferenceError is UNCAUGHT and crashes non-zero, defeating the never-fail / graceful exit-0 contract.

**The fix:**
```javascript
// scripts/build-graph-from-sqlite.cjs:53
if (!fs.existsSync(roomDbPath)) {   // was: lazygraphPath (undeclared -> ReferenceError)
  process.exit(0);
}
```

**Reach / who invokes it:** `lib/core/graph-ops.cjs:138` resolves the script path and shells out; `lib/graph/canvas-graph.js:4` documents `graph.json` is built from it. Because the ReferenceError throws unconditionally at :53, this path is effectively dead in prod (always crashes when reached) - which is why the bug survived. Regression test (D-04d): run the script against a no-room-db dir, assert exit 0.

---

## Standard Stack

No new external packages. Pure in-repo CJS + SQLite (`node:sqlite` `DatabaseSync`) + a Markdown/frontmatter edit. The stack rule holds: filesystem + SQLite room.db, CJS modules, no new dependencies.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `node:sqlite` (`DatabaseSync`) | Node >=18 built-in | room.db reads for the 3 legs + FILEVAL writes | Already the room.db driver across navigation.cjs / memory-ops.cjs / packet.cjs / evidence-claim.cjs [VERIFIED: live code] |
| CJS modules (`lib/core/navigation/*.cjs`) | n/a | Where room-context.cjs + the FILEVAL wrapper live | Mirrors the Phase 109 chokepoint pattern [VERIFIED: navigation.cjs] |

**Installation:** none. No `npm install`.

## Package Legitimacy Audit

N/A - this phase introduces ZERO external packages. All code is in-repo CJS over Node built-ins (`node:sqlite`, `crypto`, `path`, `fs`). No registry surface, no slopcheck needed.

---

## Architecture Patterns

### System Architecture Diagram

```
  UserPromptSubmit (per turn)
        |
        v
  intent-classifier.cjs  --- TODAY: turn.userText = null (loop OPEN, RETR-02 target, :1081)
        |                         re-seeds from venture state only (focus.cjs)
        |
        v  [141 wiring D-03: seed from last ~2 fragments, LOCAL lane ONLY]
  getRoomContext(db, roomId, {seedFragments})         <--- NET-NEW (RETR-01)
        |
        +--> Leg A: getRoomHomeView(db, roomId)        [room-home.cjs, RAW prose, reuse]
        +--> Leg B: getSessionHistory(db, limit)       [memory-ops.cjs, verbatim fragments]
        |            -> window/trim to last N fragments (NET-NEW step)
        +--> Leg C: focusNode = resolve(last ~2 fragments)   (NET-NEW seed)
        |            -> getNeighborhood(db, focusNode, {topK, maxDepth})  [neighborhood.cjs]
        |
        v
  { summary, recentMessages, relevantNodes }  --- 100% LOCAL (RETR-03, Part 8)
        |
        v
  Larry in-process reasoning  (NEVER the wire; NOT packet.cjs/hashText)
        |
        +--> obeys "When to Reach" Capability Dial (5 reach ids)   <--- LARRY-01/03 (prompt-layer)
        |        context_block reach == this getRoomContext() output
        |
        +--> grounded by Hierarchical Navigator doctrine            <--- LARRY-04 (prompt-layer)
        |        reads ICM position + FULL graph state -> posture {push_forward/hold/pull_back}
        |        Usher: tool owns steps 1-2; human owns 3-4; posture = bidirectional traversal
        |        ONE decision cycle (CoALA); HIC+AITL; reach precedes push (Reach rule 7)
        |
        v
  [on a research/decision conclusion]
  fileEvidenceWithReadback(db, params)   <--- NET-NEW wrapper (FILEVAL-02, D-02)
        +--> writeEvidenceClaim(db, ...)  [evidence-claim.cjs, SHIPPED, review_status=proposed]
        +--> writeEdge(db, INFORMS)        [edges.cjs, SHIPPED]
        +--> read-back SELECT + assert     [NET-NEW honesty layer; surface a failed filing]
        +--> reserve artifact_path field   [NET-NEW, D-10 fractal contract]

  [DOCTRINE ONLY] deep_research reach: framework-led, plan-gated, hat-scoped (DRSCH, D-01)
  [DEFERRED] buildContext (MCP tool-router + dashboard) still bypasses navigation.cjs
             -> dial policy CLI-honored only for v1.13.1
```

### Recommended Project Structure
```
lib/core/navigation/
├── room-context.cjs        # NET-NEW: getRoomContext 3-leg fusion (RETR-01)
├── room-home.cjs           # EXISTING Leg A (reuse getRoomHomeView as-is)
├── neighborhood.cjs        # EXISTING Leg C (reuse getNeighborhood)
├── evidence-claim.cjs      # EXISTING (Phase 131): writeEvidenceClaim - FILEVAL reuses it
├── edges.cjs               # EXISTING: writeEdge + ALLOWED_EDGE_TYPES
├── (file-evidence-readback.cjs)  # NET-NEW: read-back wrapper (FILEVAL-02) OR fold into room-context sibling
└── packet.cjs              # DO NOT REUSE its projectText/hashText (egress only)
lib/core/
└── memory-ops.cjs          # EXISTING Leg B (getSessionHistory + fragments)
lib/core/navigation.cjs     # chokepoint: re-export getRoomContext + getSessionHistory + the FILEVAL wrapper
scripts/build-graph-from-sqlite.cjs   # BUG-01 one-token fix at :53
skills/larry-personality/SKILL.md     # LARRY-01 commit + canon_parts + 5 reach ids + LARRY-04 Navigator section + 3 posture ids + Reach rule 7
```

### Pattern 1: Fusion = packet.cjs shape WITHOUT hashing, PLUS a fragments leg
Copy the composition SHAPE of `packet.cjs::buildBrainPacket`, never the projection functions. Reuse `getRoomHomeView::safeShape` raw path.

### Pattern 2: Filing = reuse the shipped writeEvidenceClaim + writeEdge, ADD read-back
Mirror `findings-wirer.cjs` (node then INFORMS edge); mirror `ingestion.cjs` (BEGIN/COMMIT/ROLLBACK transaction); ADD the read-back SELECT + assertion that no shipped path has. NEVER open room.db directly - always the caller-owned handle + navigation.cjs chokepoint.

### Pattern 3: Drift tests = exact-set adversarial assertion
Mirror Phase 90 5-tripwire / Phase 110-05 seed / Phase 124 canon-invariant: a test that greps the SKILL.md for the id tokens and asserts the set is EXACTLY {5 reaches} and EXACTLY {3 postures} - no more, no fewer.

### Anti-Patterns to Avoid
- **Reusing packet.cjs projection (projectText/shortText/hashText):** silently SHA256-hashes the prose Larry needs. RETR-03 violation.
- **Building a NEW evidence node for FILEVAL:** `writeEvidenceClaim` already exists - building a parallel node is a Part-7 violation + a dual-schema smell.
- **Renaming/dropping the 4 locked provenance fields:** they are a LOCKED Phase-136 forward-contract. `artifact_path` must be PURELY ADDITIVE.
- **Forwarding raw userText to the Brain:** RETR-02 unblocks the LOCAL seed only; the Brain stays on generic handles (Part 8, D-03a).
- **Speculative FTS5:** do not add the virtual table unless benchmarked (RETR-04, D-04b).
- **Auto-firing reaches / postures from code:** dial + Navigator are prompt-layer doctrine for 141; no dispatcher, no sensor, no nav engine here (defers to 143/144).
- **Modeling the two dials as two captains:** they are two dimensions of ONE CoALA decision cycle; the user is the only helm (D-13).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room-state summary | A new SQL summary query | `getRoomHomeView` (room-home.cjs:102) | 9-field raw-prose composition, zero new SQL |
| Recent-message recency | A new fragments reader | `getSessionHistory` (memory-ops.cjs:314) | Nested verbatim fragments; just window it |
| Relevance ranking | A new scoring function | `getNeighborhood` (neighborhood.cjs:48) | Frozen weighted recursive-CTE score already tuned |
| Local prose-truncation | A new truncator | `safeShape` raw path (room-home.cjs:29) | Truncates without hashing |
| Typed evidence node + provenance | A new node writer | `writeEvidenceClaim` (evidence-claim.cjs) | LOCKED Phase-136 schema, UPSERT, Part-5 tier validation, Part-9 proposed, live producer |
| Typed cascade edge | A new edge insert | `writeEdge` (edges.cjs) | Allowlist-gated, UPSERT, returns structured result |
| Transactional filing + memory_event | A new transaction | `ingestion.cjs::storeBrainSuggestions` pattern | BEGIN/COMMIT/ROLLBACK + one event already proven |
| Research filing event type | A new EVENT_TYPES entry | `research_filed` (memory-events.cjs:317) | Already in the frozen Set |
| Graceful exit-0 in build-graph | A rewrite | One-token `roomDbPath` fix | The script is correct except the typo |

**Key insight:** every leg AND the entire filing substrate already exist as live, tested functions. 141 is ~90% wiring (Canon Part 7). Net-new code = the fusion module + the fragment-seed resolver + the Leg B windowing + the FILEVAL read-back wrapper + the artifact_path field + two drift tests + the doctrine prose. The original research said "build the FILEVAL helper"; the refresh corrects that to "wrap the shipped writeEvidenceClaim."

---

## Runtime State Inventory

> 141 is greenfield code + a prompt-layer doctrine commit + a one-token bugfix. There is NO rename/migration. But the FILEVAL read-back touches stored data, so the inventory is worth one explicit pass.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The frozen-since-May-31 local room.db graph. FILEVAL-02 writes a new `EvidenceClaim` node + INFORMS edge (proposed). No existing data is mutated. | None beyond the additive write; the read-back asserts the new row landed. |
| Live service config | None - 141 is 100% local, zero external service config. | None. |
| OS-registered state | None - no scheduler/pm2/launchd touch. | None. |
| Secrets/env vars | None - no secret or env-var name changes. NAV_HARD_TIMEOUT_MS is read, not renamed. | None. |
| Build artifacts | The `graph.json` Cytoscape export produced by build-graph-from-sqlite.cjs is currently never produced (BUG-01 dead path). After the fix it will produce again. | None required; the BUG-01 regression test covers the no-room-db exit-0 path. |

---

## Common Pitfalls

### Pitfall 1: Reusing the egress projection in the local fusion
**What goes wrong:** import `projectText`/`shortText` from packet.cjs; Larry's context arrives as SHA256 hashes.
**How to avoid:** explicitly exclude all packet.cjs projection/privacy exports; reuse `safeShape`.
**Warning signs:** any sha256/hash in the `getRoomContext` output; any `require` of packet.cjs in room-context.cjs.

### Pitfall 2: Blowing the 1200ms budget
**What goes wrong:** unbounded fragments dump or speculative FTS5 pushes assembly past `NAV_HARD_TIMEOUT_MS`.
**How to avoid:** window Leg B; graph-rank first; benchmark before FTS5.
**Warning signs:** Promise.race timeouts in the navigation trace; large `recentMessages` arrays.

### Pitfall 3: Losing the uncommitted SKILL.md section
**What goes wrong:** a stash/checkout during planning drops the working-tree-only Capability Dial edit (still ` M`, in no commit, verified 2026-06-05).
**How to avoid:** commit it FIRST (D-06) before any branch/stash operation.
**Warning signs:** `git status` still shows ` M skills/larry-personality/SKILL.md` mid-phase.

### Pitfall 4: Building a parallel FILEVAL node instead of reusing writeEvidenceClaim
**What goes wrong:** a new EvidenceClaim-like node creates a dual schema; Phase 136's getConfirmedFacts + Phase 143 MEMDIAL render diverge.
**How to avoid:** wrap the shipped `writeEvidenceClaim`; add `artifact_path` purely additively.
**Warning signs:** a second INSERT INTO nodes with type other than 'EvidenceClaim' for research conclusions; any rename of the 4 locked provenance fields.

### Pitfall 5: Modeling the two dials as two captains
**What goes wrong:** the doctrine reads as two controllers fighting for the wheel, producing oscillation.
**How to avoid:** lead with the Usher division (tool owns 1-2, human owns 3-4) + CoALA one-cycle framing + HIC+AITL. The user is the only helm.
**Warning signs:** doctrine text that lets a dial "win" or "override" another dial; any posture change described as silent.

### Pitfall 6: Letting RETR-02's un-nulled userText reach the Brain
**What goes wrong:** the conversation seed leaks to buildBrainPacket -> Part 8 breach.
**How to avoid:** fence the seed to the LOCAL lane (D-03a); assert the Brain still gets generic handles only.
**Warning signs:** userText threading toward brain-client.cjs / buildBrainPacket in the per-turn path.

---

## Code Examples

### Leg A reuse (raw, no hash) - room-home.cjs:29-43 (VERIFIED live)
```javascript
function safeShape(row) {
  let summary = '';
  try {
    const props = JSON.parse(row.properties || '{}');
    summary = props.summary || props.claim || props.title || '';
  } catch (_) { /* ignore */ }
  return {
    id: row.id, type: row.type,
    summary: summary.length > 120 ? summary.slice(0, 117) + '...' : summary, // RAW, not hashed
    reviewStatus: row.review_status, confidence: row.confidence, lastSeenAt: row.last_seen_at,
  };
}
```

### The antipattern - packet.cjs:130-139 (VERIFIED live, DO NOT reuse)
```javascript
function projectText(text, privacyMode) {
  const s = (typeof text === 'string') ? text : '';
  if (privacyMode === 'allow_excerpts') { /* truncated excerpt */ }
  return hashText(s);   // <-- SHA256. Wrong for local context assembly.
}
```

### RETR-02 target - intent-classifier.cjs:1081 (VERIFIED live)
```javascript
const turn = {
  userText: null, // hot path does not forward prompt content   <-- RETR-02 flips this to the LOCAL seed lane
  sectionPath: sectionPath,
  sessionId: sessionId,
};
```

### FILEVAL reuse target - evidence-claim.cjs (VERIFIED live, SHIPPED - wrap, do not rebuild)
```javascript
// writeEvidenceClaim(db, { topic, source, url, retrieved_at, evidence_tier, summary, sessionId })
//   -> { ok, node_id }   type 'EvidenceClaim', review_status 'proposed', UPSERT idempotent
//   props = { source, url, retrieved_at, evidence_tier, topic, summary }  (LOCKED Phase-136 contract)
// FILEVAL-02 net-new: wrap this + writeEdge(INFORMS) + a read-back SELECT, ADD optional artifact_path.
```

### FILEVAL producer precedent - findings-wirer.cjs:150-177 (VERIFIED live)
```javascript
claim = navigation.writeEvidenceClaim(db, { topic, source: finding.source, url: finding.url,
  retrieved_at: finding.retrieved_at, evidence_tier: finding.evidence_tier, summary: finding.summary, sessionId });
// then:
const informs = navigation.writeEdge(db, { source_id: claim.node_id, target_id: primaryTargetId,
  edge_type: 'INFORMS', properties: edgeProps('finding_informs_target', finding.evidence_tier) });
```

### BUG-01 fix - build-graph-from-sqlite.cjs:50-55 (VERIFIED live)
```javascript
const roomDbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db'); // :50
if (!fs.existsSync(roomDbPath)) {  // :53 was lazygraphPath (undeclared -> ReferenceError)
  process.exit(0);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SessionStart full-room dump (budget-trimmed) | Per-turn `getRoomContext` relevance fusion | Phase 141 | "Here is what is relevant to your question" not "the whole room trimmed to fit" |
| Retrieval seeded by venture state only | Retrieval seeded by last ~2 conversation turns | Phase 141 (RETR-02) | Closes the open conversation-to-retrieval loop |
| Capability dial in working-tree limbo | Tracked SKILL.md section, canon-declared, versioned, 5 machine-readable reach ids | Phase 141 (LARRY-01/02/03) | Durable policy + a stable contract for Phase 143 DIALTUI |
| Dials as ungrounded chat-reactive controls | Dials grounded in ICM position + full graph state via the Hierarchical Navigator + Usher backbone | Phase 141 (LARRY-04, doctrine) | Larry navigates the nested Simon system; two-captains dissolved by construction |
| Research conclusions filed as prose only | Typed EvidenceClaim node + provenance + read-back validation | Phase 131 (node) + Phase 141 (read-back + artifact_path) | The write side of the loop becomes verifiable; FILEVAL honesty rule |
| Deep research = bare web search | Framework-led, plan-gated, hat-scoped plan (doctrine) | Phase 141 (DRSCH doctrine) | Plan-and-execute over Tavily; the moat differentiator (executor deferred) |

**Frontier alignment (CITED: CONTEXT-MANAGEMENT-FRONTIER):** room.db sits on the Zep/Graphiti SOTA line (bi-temporal graph memory; EpisodicNode=fragments, EntityNode=typed nodes, EntityEdge=typed edges, community summaries=Leg A). The 3-leg fusion is multi-strategy retrieval (Hindsight pattern) minus the Part-8-forbidden vector leg. Selective retrieval (66.9% @ 1.44s, 90% fewer tokens) over in-context (72.9% @ 17.1s) is the correct call for a 1200ms hot path.

**Deprecated/outdated:**
- `notImplementedYet()` stub factory (navigation.cjs:40-44): DEAD CODE - defined but unused; every export points at a real function. Harmless.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `canon_parts: [Part 2, Part 3, Part 8, Part 9]` is the right set | Larry upgrade | LOW - all four defensible from canon text; LOCKED by D-04c. |
| A2 | Graph-ranking alone meets 1200ms on a populated room.db (no FTS5) | RETR-04 | MEDIUM - needs a benchmark on a real populated room.db; FTS5 is the documented in-scope fallback (D-04b). |
| A3 | The fragment-to-focus-node seed resolver works without embeddings (section_context match + cheap lexical pick) | getRoomContext guidance | MEDIUM - if structural matching is too coarse, a local FTS5 lexical match is the fallback (shares A2's gate). |
| A4 | beta.7 is the version target for LARRY-02 | Larry version | LOW - current is beta.6 (verified); planner confirms per release ceremony. |
| A5 | Adding `artifact_path` as an optional prop is purely additive and does not break the Phase-136 forward-contract consumers | FILEVAL-02 | LOW-MEDIUM - the 4 locked fields are untouched; verify Phase 136 getConfirmedFacts + detail-pane ignore unknown props (they read named fields). Confirm before ship. |
| A6 | Reusing `research_filed` event type for the FILEVAL wrapper needs no EVENT_TYPES bump | FILEVAL-02 | LOW - the string is already in the frozen Set (memory-events.cjs:317). |
| A7 | The doctrine prose (DRSCH 5th reach + reach rule 6) in the working tree is correct as-is and only needs committing | DRSCH | LOW - verified present at SKILL.md:41,50 and matches the DEEP-RESEARCH-PARADIGM study's recommended paradigm. |

**Note:** No `[ASSUMED]` package claims (no external packages). All file:line claims are `[VERIFIED: live code]` this session; all doctrine claims are `[CITED]` to the three folded studies + Canon.

---

## Open Questions

1. **Where does `getRoomContext()` write its telemetry / memory_event, if any?**
   - Known: navigation.cjs is the chokepoint; focus.cjs writes `focus_changed` (carve-out blessed).
   - Unclear: whether a conversation-seeded retrieval logs a `context_assembled` event and whether that needs an additive EVENT_TYPES bump.
   - Recommendation: planner decides (Claude's discretion); if logged, a Part-9 system-bookkeeping audit node (`created_by=system review_status=confirmed`).

2. **Exact window size N (Leg B) and topK/maxDepth (Leg C).**
   - Known: `getSessionHistory` default limit 10 sessions; `getNeighborhood` defaults topK=20, maxDepth=2.
   - Recommendation: start last 1 session + ~6 fragments, topK 10-20, maxDepth 2; tune via the RETR-04 benchmark.

3. **How are the 5 reach ids + 3 posture ids physically encoded in SKILL.md so the drift tests can grep them deterministically?**
   - Known: the dial is prose today; the tests need stable tokens.
   - Recommendation: a fenced machine block (e.g. `reach_ids: [context_block, contradiction, cross_room, brain_consult, deep_research]` and `posture_ids: [push_forward, hold, pull_back]`) the drift tests parse - keeps the human prose readable and the contract machine-checkable. Planner picks the exact encoding; keep ids stable for Phase 143.

4. **Does the FILEVAL read-back wrapper own its own transaction, or compose into a caller transaction?**
   - Known: findings-wirer batches node + edge on one handle; ingestion.cjs uses BEGIN/COMMIT/ROLLBACK.
   - Recommendation: the wrapper takes a caller-owned handle (like writeEvidenceClaim/writeEdge), wraps node + INFORMS + read-back in one transaction, returns a structured ok/fail. Test both the success and the simulated-failure read-back path.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=18 (node:sqlite) | all 3 legs + fusion + FILEVAL | (project baseline) | - | - |
| Populated room.db | RETR-04 benchmark + FILEVAL fixture | depends on test fixture | - | Build a fixture room.db with fragments + nodes + edges + an EvidenceClaim |

No external services. Pinecone/Brain/Tavily are NOT used by this phase (Part 8; DRSCH executor deferred). Code/data-only changes.

---

## Validation Architecture

> nyquist_validation enabled (config workflow.nyquist_validation = true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node CJS test scripts (`tests/test-*.cjs`) + per-phase bash runner (`tests/run-all-<phase>.sh`) |
| Config file | none - bash runner aggregates CJS suites (pattern: tests/run-all-126.sh, run-all-131.sh) |
| Quick run command | `node tests/test-<suite>.cjs` |
| Full suite command | `bash tests/run-all-141.sh` (NET-NEW - create in Wave 0, mirror run-all-126.sh) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETR-01 | 3-leg fusion returns {summary, recentMessages, relevantNodes} from a fixture room.db | unit | `node tests/test-get-room-context.cjs` | Wave 0 |
| RETR-02 | per-turn path forwards conversation seed (not null) into LOCAL retrieval only | unit | `node tests/test-retrieval-seed.cjs` | Wave 0 |
| RETR-03 | `getRoomContext` output contains RAW prose, ZERO sha256/hash; no packet.cjs require | unit (adversarial) | `node tests/test-room-context-part8-invariant.cjs` | Wave 0 |
| RETR-04 | per-turn assembly under 1200ms on a populated fixture room.db | perf/bench | `node tests/test-room-context-latency.cjs` | Wave 0 |
| LARRY-01 | section in HEAD; canon_parts frontmatter present; CHANGELOG entry present | smoke | `node tests/test-capability-dial-committed.cjs` | Wave 0 |
| LARRY-03 | dial encodes EXACTLY the 5 reach ids (no more, no fewer) | drift (adversarial) | `node tests/test-dial-reach-ids.cjs` | Wave 0 |
| LARRY-04 | Navigator doctrine section present; encodes EXACTLY 3 posture ids; Usher division + Reach rule 7 present | drift/smoke | `node tests/test-navigator-posture-ids.cjs` | Wave 0 |
| DRSCH-01..04 | the deep_research reach row + reach rule 6 present and committed (doctrine-only) | smoke | folded into `test-capability-dial-committed.cjs` (assert 5th row + rule 6 + reach id `deep_research`) | Wave 0 |
| FILEVAL-02 | filing lands a typed EvidenceClaim (proposed) + INFORMS edge + artifact_path; read-back catches a failed write; never auto-confirmed | unit (fixture, test-first) | `node tests/test-fileval-readback.cjs` | Wave 0 |
| BUG-01 | build-graph exits 0 against a no-room-db dir (guard reaches graceful path) | regression | `node tests/test-build-graph-guard.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single suite for that task (e.g. `node tests/test-get-room-context.cjs`)
- **Per wave merge:** `bash tests/run-all-141.sh`
- **Phase gate:** full run-all-141 green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-141.sh` - scoped runner (mirror tests/run-all-126.sh header + CJS_SUITES list)
- [ ] `tests/test-get-room-context.cjs` - RETR-01 fusion shape + raw-prose assertion
- [ ] `tests/test-retrieval-seed.cjs` - RETR-02 seed wiring (LOCAL lane only)
- [ ] `tests/test-room-context-part8-invariant.cjs` - RETR-03 adversarial forbidden-substring sweep (mirror Phase 90 / 124)
- [ ] `tests/test-room-context-latency.cjs` - RETR-04 1200ms budget on a populated fixture
- [ ] `tests/test-capability-dial-committed.cjs` - LARRY-01 HEAD + frontmatter + CHANGELOG + DRSCH 5th row + reach rule 6
- [ ] `tests/test-dial-reach-ids.cjs` - LARRY-03 exactly-5 reach-id drift test (adversarial)
- [ ] `tests/test-navigator-posture-ids.cjs` - LARRY-04 exactly-3 posture-id drift test + Navigator section + Reach rule 7 presence
- [ ] `tests/test-fileval-readback.cjs` - FILEVAL-02 fixture test: node lands proposed + INFORMS edge + artifact_path round-trip + read-back catches a simulated failed write + never auto-confirmed (Part 9 role 5)
- [ ] `tests/test-build-graph-guard.cjs` - BUG-01 exit-0 regression
- [ ] A populated fixture room.db (fragments + nodes + edges + a seed EvidenceClaim) under tests/fixtures/

---

## Security Domain

> security_enforcement absent in config = enabled. The dominant concern is Canon Part 8 (graph boundary), the system's own constitution.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local in-process reads; no auth surface |
| V3 Session Management | no | room.db is local |
| V4 Access Control | yes | Phase-83 room scope isolation (cross-room reach fenced) - adjacent, the cross_room reach must read the target room's own graph only |
| V5 Input Validation | partial | the fragment-derived seed + FILEVAL params must use prepared statements (all existing legs + writeEvidenceClaim/writeEdge do); evidence_tier validated against the closed Part-5 set |
| V6 Cryptography | no (do NOT hand-roll) | `hashText` exists for egress only; the local fusion + FILEVAL must NOT hash content |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Canon Part 8 breach: local prose reaches the Brain | Information Disclosure | `getRoomContext` in-process only; never feeds buildBrainPacket; adversarial forbidden-substring test (RETR-03) |
| userText egress after RETR-02 un-nulls it | Information Disclosure | Fence to the LOCAL seed lane (D-03a); assert Brain stays on generic handles |
| SQL injection via fragment-derived seed or FILEVAL params | Tampering | `db.prepare(...)` bound params (the pattern all legs + writeEvidenceClaim/writeEdge follow) |
| Cross-room blend in Leg C | Information Disclosure | `getNeighborhood` reads the active room only; the cross_room reach is acknowledged-switch-gated (Phase 83) |
| Silent FILEVAL filing failure (a write that did not land) | Repudiation | The read-back assertion SURFACES the failure (FILEVAL honesty rule, D-02); a failed filing is reported, never swallowed |
| Agent auto-confirms a truth-claim | Elevation of Privilege | EvidenceClaim lands `proposed`; promotion needs a human byUser via confirmNode (Part 9 role 5) - the FILEVAL wrapper never confirms |

---

## Sources

### Primary (HIGH confidence - live code this session, re-verified 2026-06-05)
- `scripts/build-graph-from-sqlite.cjs:50,53` - BUG-01 (roomDbPath vs lazygraphPath)
- `lib/core/navigation/room-home.cjs:29-43,102-141` - Leg A getRoomHomeView + safeShape raw path
- `lib/core/memory-ops.cjs:314-333,592` - Leg B getSessionHistory + chokepoint re-export
- `lib/core/navigation/neighborhood.cjs:14-79` - Leg C getNeighborhood + frozen score
- `lib/core/navigation/packet.cjs:130-159` - projectText/shortText HASH under default mode (antipattern)
- `lib/core/navigation.cjs:48,52,73,194` - chokepoint exports (getActiveFocus, getNeighborhood, getRoomHomeView, writeEvidenceClaim); getSessionHistory NOT yet exported here
- `lib/core/navigation/evidence-claim.cjs` (whole file) - SHIPPED writeEvidenceClaim + LOCKED Phase-136 provenance schema + EVIDENCE_TIERS + Part-9 proposed
- `lib/core/navigation/edges.cjs:32-227` - ALLOWED_EDGE_TYPES frozen Set + writeEdge signature/return
- `lib/core/navigation/ingestion.cjs:1-82` - storeBrainSuggestions transactional node+edge+event precedent
- `lib/core/findings-wirer.cjs:150-199,283` - LIVE producer calling writeEvidenceClaim + INFORMS/CONTRADICTS edges
- `lib/core/navigation/memory-events.cjs:317-319` - research_filed/_rejected/_deferred already in EVENT_TYPES
- `scripts/intent-classifier.cjs:635,1081,1196` - userText:null + NAV_HARD_TIMEOUT_MS=1200 + Promise.race
- `lib/core/chat-context-builder.cjs:33-35` - buildContext requires only node builtins (dual-path gap)
- git: HEAD=0 / WT=1 Capability Dial; ` M` status; no `git log -S` hit (uncommitted)
- `skills/larry-personality/SKILL.md:31,37-41,45-50` - the 5 reach rows (incl. DRSCH 5th) + Reach rules 1-6; frontmatter is only name+description
- `skills/mva-pipeline/SKILL.md:7` - canon_parts frontmatter precedent
- `.claude-plugin/plugin.json` + `package.json` - version 1.13.1-beta.6 (drift from prior research beta.5)
- `docs/MINDRIAN-CANON.md` (v1.5) Parts 2/2a/3/4/5/8/9; `docs/CANON-PHASE-MAP.md`
- `.claude/includes/decisions.md` (Decision 15 ROOM.md-per-folder; Decision 16 nested fractal filing)

### Secondary (HIGH-MEDIUM - folded room studies, cross-referenced to Canon + live code)
- `~/MindrianRooms/.../DEEP-RESEARCH-PARADIGM-online.md` - the framework-led deep-research paradigm (plan-and-execute, framework-shaped planner, hat-scoped Tavily, 4 BLACK failure modes); grounds DRSCH-01..04 doctrine
- `~/MindrianRooms/.../CONTEXT-MANAGEMENT-FRONTIER-online.md` - CoALA one-decision-cycle, HIC+AITL, Horvitz expected-value, Reasoning-Action Disconnect, Sarter/Woods transparency, Zep/Graphiti SOTA; grounds LARRY-04 / D-13
- `~/MindrianRooms/.../ARONHIME-EVOLUTION-EXPLANATION-scraped.md` - Aronhime's authoritative design language (Usher 4-step, "insight belongs to you / reach belongs to the tool", "reach matters more than raw intelligence", "restraint is the product working correctly", temporal search gradient, bidirectional Ackoff); the LARRY-04 doctrine quotes this
- `.planning/REQUIREMENTS.md` (LARRYREACH lines 704-834) - the authoritative requirement text + the Phase-143 DIALTUI/MEMDIAL forward-coupling

### Cited literature (via the folded studies)
- CoALA (Sumers/Yao/Narasimhan/Griffiths, arXiv 2309.02427); Horvitz Mixed-Initiative (CHI 1999); Burstein and McDermott 1996; Red Hat HITL/HOTL/AITL/HIC taxonomy; Sarter and Woods 1995/1997; Zep/Graphiti (arXiv 2501.13956); Usher cumulative-synthesis (1929); Anthropic multi-agent research; Stanford STORM (NAACL 2024); Reference Hallucinations in Deep Research Agents (arXiv 2604.03173)

---

## Metadata

**Confidence breakdown:**
- getRoomContext legs: HIGH - every leg verified at file:line; fusion symbol confirmed absent
- BUG-01: HIGH - one-token typo verified, grep shows only two hits
- Larry dial commit + reach ids: HIGH - git state + grep + canon cross-check all confirmed; ids are a design choice locked by D-05
- LARRY-04 doctrine: HIGH (the WHAT-to-write is fully grounded in three studies + Canon); the doctrine is prose so its correctness is editorial, not testable beyond the posture-id drift test
- FILEVAL-02 substrate: HIGH - the reuse target (writeEvidenceClaim) + live producer (findings-wirer) verified; the net-new delta (read-back + artifact_path) is well-scoped
- DRSCH doctrine: HIGH - the 5th reach row + reach rule 6 verified present and match the study's recommended paradigm
- Latency strategy (A2): MEDIUM - needs a populated-room.db benchmark to lock FTS5-or-not

**Research date:** 2026-06-04 (base) + 2026-06-05 (refresh superset)
**Valid until:** 2026-07-05 (stable local codebase; re-verify if navigation.cjs / memory-ops.cjs / evidence-claim.cjs / SKILL.md change, or if the version bumps past beta.7)

## RESEARCH COMPLETE

**Phase:** 141 - Local Retrieval Spine + Capability Dial
**Confidence:** HIGH

### Key Findings
- Preserved every verified file:line claim from the base research; re-verified the load-bearing ones (BUG-01 :53, userText:null :1081, NAV timeout :635/:1196, SKILL.md ` M` uncommitted, NO FTS5, packet.cjs hashing). Version DRIFTED beta.5 -> beta.6; LARRY-02 target is beta.7.
- **Biggest planner correction:** FILEVAL-02's typed-evidence substrate ALREADY SHIPS (`writeEvidenceClaim` in evidence-claim.cjs, Phase 131, with a LOCKED provenance schema, re-exported via navigation.cjs:194, with a live producer findings-wirer.cjs). 141's genuine net-new is a read-back-validation WRAPPER + an additive `artifact_path` field (D-10) + fixture tests - NOT a new node. `research_filed` is already in EVENT_TYPES (no bump).
- DRSCH-01..04 are fully addressed at DOCTRINE level: the 5th reach row + reach rule 6 are present in the working tree, verified correct against the DEEP-RESEARCH-PARADIGM study (plan-and-execute, framework-shaped, plan-gated, hat-scoped). 141 commits the doctrine; executor defers (D-01).
- LARRY-04 doctrine is fully researched: lead with the Usher division (tool owns steps 1-2, human owns 3-4; posture = bidirectional traversal), grounded in Aronhime's verbatim language, CoALA one-decision-cycle, HIC+AITL, Horvitz, and the named anti-pattern (Reasoning-Action Disconnect). 3 posture ids {push_forward, hold, pull_back} + a drift test (mirrors LARRY-03's exactly-5 reach ids).
- The two id contracts (5 reaches + 3 postures) + their exact-set adversarial drift tests follow the shipped Phase 90/110-05/124 forbidden-substring test idiom; Phase 143 DIALTUI/SENS + Phase 144 NAV key off them.

### File Created
`.planning/phases/141-local-retrieval-spine-and-capability-dial/141-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | zero external packages; all in-repo CJS verified |
| getRoomContext legs | HIGH | every leg verified at file:line; fusion absent |
| Larry dial + reach/posture ids | HIGH | git state + canon cross-check; ids locked by D-05/D-12 |
| LARRY-04 doctrine | HIGH | fully grounded in three studies + Canon |
| FILEVAL-02 substrate | HIGH | reuse target + live producer verified; delta well-scoped |
| DRSCH doctrine | HIGH | dial prose verified vs the paradigm study |
| Latency (A2) | MEDIUM | needs populated-room.db benchmark to lock FTS5-or-not |

### Open Questions (carried)
1. getRoomContext telemetry event (planner discretion; Part-9 carve-out if logged).
2. Window N + topK/maxDepth (tune via RETR-04 benchmark).
3. Physical encoding of the 5 reach + 3 posture ids so drift tests grep deterministically.
4. FILEVAL wrapper transaction ownership (recommend caller-owned handle, one transaction).

### Ready for Planning
Research complete. The planner can create PLAN.md files for: dial-commit-first (D-06), getRoomContext fusion, RETR-02 LOCAL seed flip, the 5+3 id contracts + drift tests, the LARRY-04 Navigator doctrine, the FILEVAL read-back wrapper over the shipped writeEvidenceClaim, and BUG-01.
