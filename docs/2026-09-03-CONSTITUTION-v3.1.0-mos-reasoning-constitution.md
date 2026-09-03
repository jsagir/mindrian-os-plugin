---
name: mos:reasoning-constitution
version: 3.1.1
status: RATIFIED (navigator sign-off 2026-09-03)
supersedes: 3.1.0
---

# MindrianOS Reasoning Constitution v3.1.1

This is not a rewrite of v3.0.0 -- it is v3.0.0 with every claim the assessment found wrong actually corrected, and every ruling the navigator made actually recorded. Read this file's Part 0 first; it tells you what changed and why. Everything in v3.0.0 not named below stands unchanged: the Levels table, the epistemic-type enum, support states, contradiction types, provenance/trace doctrine, identity/time doctrine, frameworks-as-lenses, retrieval-over-Theo doctrine, decision logic, information-needs doctrine, MECE doctrine, the private inspect-and-revise checklist, and the reject-generic-AI-reasoning-reflexes list all carry forward from v3.0.0 verbatim -- go there for those sections rather than have them retyped here with transcription risk.

Evidence standard held throughout: file and line, or `unresolved` naming what would settle it. No claim in this document was left asserted where a citation was obtainable.

---

## Part 0: What changed, and its status right now

**v3.1.1, 2026-09-03: R18 reversed.** After the flagged concern in 2.3 below was confirmed against `skills/conversation-mode/SKILL.md:84-85`, the epistemic-level cap is reattached to `lib/conversation/operator.cjs` (the 5-state conversation operator), not the 3-lane conversation-mode system. Everything else in v3.1.0 is unchanged.

| Item | v3.0.0 said | v3.1.0 says | Status |
|---|---|---|---|
| GraphWriteEvent | Every ICM write emits it, stated as fact | No ICM write emits it today; design filed for the minimal fix | DESIGN FILED, not yet implemented |
| Tripwire location | "chain_run and the brain-client write path" | Real chokepoint is `edges.cjs::writeEdge` (edges) + no single chokepoint exists for nodes yet | R17 scoped, sequencing set |
| Edge vocabulary | 5 edges "added by ruling" | Only SOURCED_FROM is actually new; 4 already live. Deprecation target corrected RELATES_TO -> RELATED_TO | IMPLEMENTED 2026-09-03 (quick 260903-gct): SOFT deprecation -- RELATED_TO stays allowlisted, warns once per process, returns deprecated:true |
| epistemic_type validation | Implied ready to add | Needs a node-write consolidation pass first (12 files / 16 sites, ~2 developer-days) | SCOPED (R17), sequencing set, not yet implemented |
| Operator level cap | Stated as the design | Reattached to the 5-state conversation operator (`lib/conversation/operator.cjs`), not the 3-lane conversation-mode system (R18 reversed 2026-09-03) | RULED (R18-revised), **declared mapping shipped** (`epistemicCapForOperator`/`isWithinCap`), **enforcement path explicitly still open** |
| Gate exclusivity | "only a Shape F gate emits decision" | True now -- the one confirmed exception (`/mos:operator set`) is fixed | **SHIPPED** (R19): commits `e29a7480`, `a114a4ad`, `17a60439` |
| Brain/Theo consolidation | Silent on capability parity | Conditioned on the two-engine contract (design below) | RULED (R20), **DESIGN FINAL** (navigator, 2026-09-03) -- `compute_graph_metric` lives in the Brain repo and gets consumed by Theo, neither is MindrianOS-Plugin's code to write; this repo's role ends at the filed design and the shipped `brain_query` fix |
| brain_query silent-empty bug | Not mentioned | Fixed | **SHIPPED**: commits `f264c843`, `8aca8af7` |
| Write-back path (T2) | Implied it exists | Confirmed it doesn't; minimal design filed | DESIGN FILED (`docs/2026-09-03-DESIGN-t2-write-back-minimal.md`), not yet implemented |
| Completion bar / first candidate | Named a transcript and framework | Both confirmed not to exist anywhere | `unresolved`, navigator will supply a real candidate (R21) |
| Provenance ledger discipline | Dropped from v2.2.0 | Reinstated permanently | RULED (R15), governs this document going forward |

Three items are **shipped code**, verified and committed on `main`. Everything else is a ruled decision with a filed design, awaiting its own implementation pass -- not silently assumed done.

---

## Part 1: The Ten Laws

Unchanged, frozen, carried forward from v2.2.0/v3.0.0 verbatim. Not reproduced here to avoid transcription drift on frozen text -- see v3.0.0 Part 1 or the original handoff document.

---

## Part 2: Corrected sections

### 2.1 "Integrate with the room" -- GraphWriteEvent and tripwires

Replace v3.0.0's claim:

> Every ICM write emits a `GraphWriteEvent` carrying `schema_version`, `correlation_id`, `pipeline_run_id`, `commit_sha`, and the writing component's id. Tripwires run application-side in `chain_run` and the brain-client write path.

With:

> No ICM write emits a `GraphWriteEvent` today. `gate_answer`'s approve branch (`lib/mcp/tools/gate.cjs:216-231`) and `artifact_file` (`lib/mcp/tools/views.cjs:125-168`) both log a bare bookkeeping `memory_event` row -- no typed claim node, no provenance edge, none of `schema_version`/`correlation_id`/`pipeline_run_id`/`commit_sha` exist as real properties anywhere. A minimal write-back design is filed at `docs/2026-09-03-DESIGN-t2-write-back-minimal.md`; implementing it is what would make this sentence true.
>
> Tripwires run application-side, but the real chokepoint for edges is `lib/core/navigation/edges.cjs::writeEdge` (line 892), which already validates against `ALLOWED_EDGE_TYPES` and fails closed. There is no equivalent single chokepoint for nodes: 12 files / 16 sites write directly, bypassing the one centralized `node-insert.cjs::insertNode`. R17 (below) scopes closing that gap.

### 2.2 "Relationships" -- edge vocabulary

Replace v3.0.0's claim:

> Added by ruling: `SUPPORTS`..., `CONTRADICTS`..., `REFINES`, `SOURCED_FROM`, `DERIVED_FROM`. ... Deprecated on write: `RELATES_TO`.

With:

> `SUPPORTS`, `CONTRADICTS`, `REFINES`, and `DERIVED_FROM` are already live in `ALLOWED_EDGE_TYPES` (`lib/core/navigation/edges.cjs`, from line 32) -- nothing to add. Only `SOURCED_FROM` is genuinely new (R16). The edge actually live in production and needing deprecation is `RELATED_TO` (14 files) -- not `RELATES_TO`, a different string that was never allowlisted and already fails closed.
>
> Separately confirmed: the "Adopted, live in Brain" list is not cleanly disjoint from the local vocabulary as previously stated. 4 of its 17 names (`VALIDATES`, `FEEDS_INTO`, `ENABLES`, `PART_OF`) are also live locally. 12 are confirmed Brain-only against a dated census file. `BLOCKS` is `unresolved` -- settled only by a fresh live Brain schema query, not available this pass.

### 2.3 "Choose the reasoning shape" -- operator cap and gate exclusivity

Replace v3.0.0's claim:

> Name the operator's cap: JUST_TALK and EXPLORE_CAPTURE stop at Information; BUILD_ROOM at Knowledge; METHODOLOGY at Understanding; DECISION_GATE alone may emit Wisdom, and only a Shape F gate emits `decision`.

With:

> **Ruling R18-revised (navigator, 2026-09-03):** the epistemic-level cap attaches to the 5-state conversation operator (`JUST_TALK`/`EXPLORE_CAPTURE`/`BUILD_ROOM`/`METHODOLOGY`/`DECISION_GATE`, `lib/conversation/operator.cjs:62`), reversing the first R18 (which had attached it to the 3-lane conversation-mode system). The mapping table, carried forward unchanged from v3.0.0: JUST_TALK and EXPLORE_CAPTURE cap at Information; BUILD_ROOM at Knowledge; METHODOLOGY at Understanding; DECISION_GATE is a render-lock state, off the depth ladder entirely. v3.0.0's clause "DECISION_GATE alone may emit Wisdom" is SUPERSEDED: under this mapping, no operator state reaches Wisdom.
>
> **The flagged concern is now RESOLVED, not unresolved.** What settled it: `skills/conversation-mode/SKILL.md:84-85` -- "One re-surface per turn-cluster. Do not nag the picker every turn." and "Never auto-switch lanes. A lane change is always a navigator pick at the Decision Gate, never a unilateral Larry decision." This confirms the lane is gate-limited and navigator-driven, not a per-turn state, exactly as the flagged concern predicted: a cap meant to bound what Larry may produce *that turn* cannot live on a state that changes at most once per turn-cluster, on a rare navigator re-pick. `operator.cjs`'s `transition()` function (9 transition rules, changes state within a session) can carry a per-turn cap; the 3-lane system structurally cannot. This document's own instruction to "read one more file first" is what produced this reversal -- the flag did its job.
>
> **Implementation status: DECLARED, NOT ENFORCED.** The mapping is implemented as `epistemicCapForOperator` and `isWithinCap` in `lib/conversation/operator.cjs` (quick task 260903-hod). Nothing calls either function in a production path yet. The natural consumer is the T2 write-back path (`docs/2026-09-03-DESIGN-t2-write-back-minimal.md`), which is a filed design and not implemented, so there is nothing to enforce against today.
>
> **Gate exclusivity is now true.** `act`/`act-chain`/`act-swarm` were already clean (return markdown, no gate contact). `/mos:operator set` was the one confirmed exception -- **shipped** (R19, commits `e29a7480`, `a114a4ad`, `17a60439`): it now mints, consumes, validates, and ratifies through the real gate ledger inside one process call (necessary because the ledger is an in-process `Map` and this CLI script exits after every invocation -- a naive render-then-answer-later flow across two separate processes was structurally impossible; the fix runs the full cycle in one call instead, since the human's choice already happened out of band). `/mos:operator reset` has the identical disease and is a named, deliberate follow-up -- not silently migrated, not silently ignored.

### 2.4 Completion bar and falsifier

Replace v3.0.0's named first candidate (J. Edwards Innovation Critique / TCCC transcript) -- confirmed by exhaustive filesystem and graph search to not exist anywhere -- with:

> `unresolved`. Per ruling R21 (navigator, 2026-09-03): the first certification candidate will be filed in a room as ICM Data nodes with source spans *before* it is named as the candidate, not named first and searched for after. The navigator will supply it. Until then, this bar reads `unresolved`, which is itself a valid completion state under this document's own L10.

---

## Part 3: R20 -- the two-engine contract (one-page design, per navigator request)

**Not an implementation. A design, cited to what's actually confirmed.**

### The split, already ratified on both sides

- **Theo (canon + provenance engine).** Owns Framework/Chapter/Technique content and `SOURCED_FROM` provenance. Runs **deterministic graph traversal and aggregation** natively: `COUNT{}` aggregation, DFS/BFS walks over typed edges, a greedy walk following an edge property (e.g. a `FEEDS_INTO` confidence value). This is not new permission -- `discover_structure` (`src/mcp/content/discover-structure.ts:431-527`) and `orchestration_readiness` (`orchestration-readiness.ts:253-255`) already do exactly this, live, today.
- **Memgraph (analytics computation service).** Owns MAGE-class algorithms: true pagerank, betweenness centrality, community detection -- anything needing a licensed graph-algorithms library Aura does not have. `find_connections`, `find_bottlenecks`, `rank_influence`, `find_whitespace`, `structural_neighbours` (`~/dev/ProblemsWorthSolving-Brain/src/brain-tools.mjs:189-304`) stay here, exposed as a bounded computation service behind one contract -- not a second general-purpose graph either Theo or Larry queries ad hoc.

**This split is no longer this document's own invention -- Theo's own `CLAUDE.md` ratified it independently on 2026-09-03**, citing this session's consult note and cross-reference as two of its three sources, and drawing the exact same line: the boundary is platform capability (Aura lacks GDS/MAGE), not a judgment prohibition, and it was ambiguous before that ratification because one sentence in `recommend-chain.ts` was doing the work of two different rules.

### The contract shape (revised against the real code, 2026-09-03)

The projection is **fixed**, not per-request: `brain-tools.mjs:162-165` projects every edge whose both endpoints match a methodology label predicate as `g` -- there is no `scope`/`node_ids` selector today, and the earlier draft's assumption of one was wrong. All three MAGE calls are additionally gated by `requireMage()` (throws when `BACKEND !== 'memgraph'`, `brain-tools.mjs:170-180`) -- no Aura/Neo4j fallback exists, confirming Theo cannot run these itself under any configuration, not just as a design choice.

```
compute_graph_metric(
  metric: 'pagerank' | 'betweenness_centrality' | 'community_detection',
  params?: { limit?: int, min_size?: int /* community only */, label_filter?: string /* pagerank only, post-hoc */ }
) -> {
    metric,
    backend_required: 'memgraph',
    results?: [{ label, name, score }],                  // pagerank | betweenness_centrality
    communities?: [{ community_id, members, sample }],    // community_detection: aggregated, not per-node
    error?: 'backend_unavailable' | 'tier_denied' | 'rate_limited'
  }
```

Corrected from the earlier draft: results never carry a `node_id` (Brain returns `{label, name, score}` only -- Part 8, generic handles). `shortest_path`/`find_connections` is **dropped from this contract entirely** -- it isn't MAGE-gated, needs no projection, and Theo already runs BFS/DFS natively (`discover_structure`, `orchestration_readiness`); routing it through Memgraph would add a network hop for something already in-process.

### The three questions, answered

**(a) Direct calls, not a broker.** Mirror the existing `lib/core/brain-client.cjs` pattern -- one thin typed client the caller owns, reusing its bounded retry, session caching, and sentinel-error passthrough. A broker adds a hop and a service to operate for what's already a stateless, bounded RPC.

**(b) Auth/rate-limiting already exists, reuse it unchanged.** Bearer token on every call (`brain-client.cjs:442,661`), server-side 120 req/60s per key with `Retry-After` honored client-side, 401/403 zero-retry by design. No second boundary needed.

**(c) Two decoupled calls, not one combined -- and the premise needed correcting first.** `recommendChain` does **not** call live pagerank today: it reads a *stored*, offline-computed `f.graphrag_pagerank` property (`arm1-orchestrator.mjs:376-383`, populated by a separate GraphRAG pipeline) and walks `FEEDS_INTO` in plain Cypher, greedy, bounded to 6 steps, ordered by `r.confidence DESC, b.graphrag_pagerank DESC` (`:395-418`) -- no live MAGE dependency in the hot path at all. The rebuild that preserves this working decoupling: Memgraph periodically batch-materializes pagerank via `compute_graph_metric` and writes it back onto Theo's `graphrag_pagerank` property; Theo's `recommendChain` keeps doing exactly what it does today, reading the stored score and walking `FEEDS_INTO` itself. Re-coupling it into one per-request call would force Memgraph to understand `FEEDS_INTO` confidence semantics that are canon/provenance concepts Theo owns by this very design's own split.

---

## Part 4: Rulings register (complete, R1-R21)

R1-R14 unchanged from v3.0.0. R15-R21 below, each with real status, not aspirational:

| # | Ruling | Status |
|---|---|---|
| R15 | The LIVE/REF/AUTH provenance ledger is a permanent structural element of this document, not a one-time drafting artifact. A version bump that drops a tag without a citation is itself a Law 3 violation. | **ADOPTED**, governs this document |
| R16 | Add `SOURCED_FROM` only (4 of the originally-listed 5 edges already live). Deprecate `RELATED_TO`, not `RELATES_TO`. | IMPLEMENTED 2026-09-03 (quick 260903-gct): SOFT deprecation -- `RELATED_TO` stays allowlisted, warns once per process (`MOS_DEP_EDGE_RELATED_TO`), returns `deprecated:true` |
| R17 | `epistemic_type` required on every written node, sequenced: node-write consolidation first (12 files / 16 sites, ~2 developer-days estimated, `memory-events.cjs` and `rs-sqlite-mirror.cjs` excluded with named reasons), then validation at the single chokepoint. | SCOPED, sequencing set, not yet implemented |
| R18 | Operator-level cap attaches to the 5-state operator (`lib/conversation/operator.cjs`), not the 3-lane conversation-mode system (reversed 2026-09-03; the flagged concern in 2.3 confirmed the 3-lane system cannot carry a per-turn cap). `DECISION_GATE` stays a render-lock state. | RULED (revised), **declared mapping shipped** (`epistemicCapForOperator`/`isWithinCap`), enforcement path still open |
| R19 | `/mos:operator set` migrated onto `gate-render.cjs`/`gate-ledger.cjs`. | **SHIPPED** -- `e29a7480`, `a114a4ad`, `17a60439` |
| R20 | "Theo is the Brain" framing on hold pending the two-engine contract. Theo owns canon/provenance + deterministic graph computation; MAGE-class analytics stay on Memgraph as a computation service. `brain_query`'s empty-return bug fixed first. | RULED, `brain_query` fix **SHIPPED** (`f264c843`, `8aca8af7`), contract design **FINAL** (Part 3 above, navigator sign-off 2026-09-03), cross-repo ratified on Theo's side (Theo's own `CLAUDE.md` independently adopted the same analytics-boundary split). Implementation is explicitly out of MindrianOS-Plugin's scope -- `compute_graph_metric` belongs to the Brain repo (Jonathan's own IP) and Theo's own consumption of it; this repo's contribution ends here. |
| R21 | The completion bar's first candidate is filed as real ICM Data nodes with source spans before being named, supplied by the navigator. | RULED, bar reads `unresolved` until supplied |

---

## Part 5: Closed research items (Section 5 of the original handoff)

- **Certified/active status:** `nodes.review_status`'s `validated` value is the closest local analog and already carries the right semantic -- only a real human can promote a truth-claim to `validated` (`transitions.cjs:21,42` explicitly bar `larry/brain/system/assistant`). No room-level equivalent exists; a future certification log would need to invent that, but could reuse the node-level machinery.
- **Provenance granularity:** confirmed coarse, per-section, not per-span. No caller anywhere writes a character offset or quote boundary; `source_section` holds Data-Room section slugs at best. `insertNode` doesn't even accept a `source_section` override today.
- **Brain edge list vs. local `ALLOWED_EDGE_TYPES`:** not cleanly disjoint, corrected in 2.2 above.

---

*Ratified by the navigator, 2026-09-03. Three items shipped and verified on `main` (`f264c843`/`8aca8af7`, `e29a7480`/`a114a4ad`/`17a60439`); the rest are ruled decisions with filed designs, sequenced for their own implementation passes -- named explicitly as such rather than presented as already done, per this document's own law against silent promotion.*
