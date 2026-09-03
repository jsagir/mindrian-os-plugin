---
phase: 276
status: ratified
ruled: 2026-09-03
plans_gated: [276-12, 276-14]
---

## OQ-276-1 ANSWER

**Question:** A meeting claim written from the MCP surface has to carry a
`knowledge_type` (6 values, `lib/core/navigation/typed-claim.cjs:53`
`KNOWLEDGE_TYPES`) AND pass through `node-insert.cjs`'s `epistemic_type` gate
(10 values, `lib/core/node-insert.cjs:113` `ALLOWED_EPISTEMIC_TYPES`) AND be
comparable against the current operator's DIKW cap (5 rungs,
`lib/conversation/operator.cjs:133` `EPISTEMIC_LEVELS`). Which mapping is
authoritative, and where does it live?

**Selected: b + d** - map at the claim writer, cap-comparison deferred.

**Navigator's ruling, verbatim:**

> "b + d: map at the claim writer, cap-comparison deferred". Meaning: the
> knowledge_type -> epistemic_type mapping table lives in
> `lib/core/navigation/typed-claim.cjs` next to `KNOWLEDGE_TYPES`, honoring
> `node-insert.cjs:110-112`'s own comment that per-writer mapping belongs at
> the call site; pinned by a test; the operator-cap comparison against the
> DIKW rungs (`operator.cjs:133` EPISTEMIC_LEVELS) is named as an explicit
> follow-up of this phase (registered in 276-16's close-out), not silently
> built or dropped.

**Grounded fact this ruling supersedes:** `typed-claim.cjs:162-169`'s
`writeClaimNode` currently calls `insertNode` with a HARDCODED
`epistemic_type: 'extracted_fact'` for every claim regardless of its
`knowledge_type`. All 6 `KNOWLEDGE_TYPES` members collapse onto ONE
`epistemic_type` value today; the "mapping" that exists pre-ruling is a
constant, not a table. This is the behavior plan 276-12 replaces.

**Placement, RATIFIED:** the mapping table lives in
`lib/core/navigation/typed-claim.cjs`, alongside the `KNOWLEDGE_TYPES` Set it
projects from, not inside `lib/core/node-insert.cjs`'s generic fail-closed
gate. `ALLOWED_EPISTEMIC_TYPES` stays the single canonical target enum; the
table only projects into it. A test pins the table so a second claim writer
added later cannot silently diverge.

**Scope, RATIFIED:** only the `knowledge_type` -> `epistemic_type` direction
is built in this phase. The operator-cap comparison
(`epistemic_type` vs. `operator.cjs:133` `EPISTEMIC_LEVELS` /
`operator.cjs:138` `OPERATOR_EPISTEMIC_CAP`) is a NAMED follow-up, owned by
plan 276-16's close-out, not silently built and not silently dropped.

**Mapping table -- STATUS: PROPOSED, not navigator-ratified.** The navigator
did not dictate the row-by-row content; only the placement (typed-claim.cjs)
and the scope (this direction only, cap-comparison deferred) are ratified
above. The table below is the executor-proposed content, derived from the
real 6 `KNOWLEDGE_TYPES` members (`typed-claim.cjs:53`) and the real 10
`ALLOWED_EPISTEMIC_TYPES` members (`node-insert.cjs:113`). It is pinned by
276-12's test and confirmable at 276-16's human verification -- not to be
presented as navigator-ratified.

| `knowledge_type` (`typed-claim.cjs:53`) | `epistemic_type` (`node-insert.cjs:113`) | Reason (one line) |
|---|---|---|
| `fact` | `extracted_fact` | A stated fact pulled directly from a transcript segment; matches the pre-ruling hardcoded default, so this row is a no-op for the most common case. |
| `causal` | `derived_fact` | A causal claim is reasoned from stated facts (cause implies effect), not itself directly extracted, matching `derived_fact`'s "reasoned from other facts" character. |
| `heuristic` | `interpretation` | A heuristic is a general rule someone is applying to the situation, an interpretive generalization rather than a literal observation or extraction. |
| `anomaly_cue` | `observation` | An anomaly cue names something noticed as unusual; that noticing is itself an observation, the most literal `epistemic_type` available. |
| `mental_model` | `model_derived_assertion` | A mental-model claim is explicitly a model-derived construct; the epistemic-type name and the knowledge-type name share the same root concept. |
| `assumption` | `assumption` | Both vocabularies use the identical token; this is the one direct 1:1 name match across the two enums, no projection needed. |

This table is written at `lib/core/navigation/typed-claim.cjs` by plan
276-12, replacing the hardcoded `epistemic_type: 'extracted_fact'` constant
at `typed-claim.cjs:169` cited above.

## OQ-276-2 ANSWER

**Question:** What exactly does the MCP surface expose so Desktop and Cowork
can reach a real DIKW claim write, and where does the human confirmation sit
relative to that write?

**Selected: a** - one tool, write-then-gate: `claim_write` files at
`proposed`, `gate_answer` promotes.

**Navigator's ruling, verbatim:**

> "a: one tool, write at proposed, gate_answer promotes". Meaning: ONE MCP
> tool, working name `claim_write`, home `lib/mcp/tools/claim.cjs` (minted by
> 276-12); files the claim node at `review_status: proposed` through
> `typed-claim.cjs`'s `writeClaimNode` -> `lib/core/node-insert.cjs` ONLY (no
> second write path); the shipped `gate_answer` approve branch
> (`gate.cjs:168-235`, `navigation.confirmNode`) promotes it;
> `writePathRefusal` (`graph.cjs:100-108`) applies; Canon Part 9 is honored at
> `confirmed`, and "proposed before confirmed" is the same standing pattern
> `artifact_file` and every other `insertNode` caller already accept.

**Tool to mint, RATIFIED:** `claim_write`, home `lib/mcp/tools/claim.cjs`,
minted by plan 276-12. No `claim_confirm` or second tool. Option c (two
tools) is not selected.

**Routing, RATIFIED:** the write routes through
`typed-claim.cjs`'s `writeClaimNode` -> `lib/core/node-insert.cjs` and no
other path. `writePathRefusal` (`lib/mcp/tools/graph.cjs:100-108`) applies at
call time exactly as it does for `graph_write` and `memory_event`. Promotion
from `proposed` to `confirmed` runs only through the shipped `gate_answer`
approve branch (`gate.cjs:168-235`), which calls `navigation.confirmNode`.

**What the tool description must NOT claim:** per the honesty-fix pattern
already proven on `meeting` (`3a35f4f6`), `claim_write`'s description must
not claim the written claim is confirmed or final -- it is `proposed` until a
human approves through `gate_answer`. It must not claim the five-perspective
subagent fan-out or the F.8 filing gate are reachable from this tool; per
`filing-protocol.md:44-54` both are CLI-only and structurally unreachable
from MCP.

## Dispositions of record (not re-decided by any later plan)

| D | Disposition | Where it is handled |
|---|---|---|
| D-276-1 | The meeting Tri-Polar gap stays in this phase; wave 1 (this plan) rules the vocabulary and surface-shape questions, later waves build. Splitting the meeting work into its own phase was considered and REJECTED, because splitting is exactly how Phase 273's C4 and C5 got orphaned. | This plan (276-05), plus 276-12 and 276-14. |
| D-276-2 | Closed means a written disposition per finding, verified by re-running the checker. No new suppression path. MEDIUM and UNKNOWN stay never-suppressible (`check-tool-honesty.cjs:1162` gates `ALLOWED_UNVERIFIED` on HIGH_RISK only). A proven false positive is a detector fix, never an allowlist entry. | 276-04, 276-06, 276-15. |
| D-276-3 | `gate_render` gets a description correction stating it mints an in-memory gate id and persists nothing, NOT a `STRONG_VERBS` change (an in-memory ledger mint is not persistence). Because `gate_render` is one of Theo's 5 absorbed tools, this correction carries a Theo-side mirror task. | 276-11, 276-13. |
| D-276-4 | C4 is OPTION-ONLY at the Group A room.db write openers (`lib/core/lazygraph-ops.cjs:434` and siblings) and the Group B other-database openers. Group C and Group D are EXCLUDED with `room-db.cjs:251`'s own sentence (WAL readers never block writers) as the stated reason. Routing `lazygraph-ops` through `openRoomDb` is a NAMED follow-up, not built in this phase (the researcher's A9 opener recommendation was overruled: `openRoomDb` is async, returns a different `{db, conn}` shape against 38 call sites, and runs a 7-step migration chain on every open, the same ~40-file regression shape Phase 273 D-01a already rejected). | 276-09, 276-16. |
| D-276-5 | C5 is the return-shape variant with `room_db_busy` and `room_db_broken` reasons, checking `err.name` before `instanceof` (`room-db.cjs:158-166`), since `spine-events.cjs`'s `_emit` cannot re-throw. `getCurrentJTBD` and `getCurrentOperator` are mandatory read_first (RESEARCH A11, the F-selector path). M8's smallest piece is correcting the `room-db.cjs:150-153` comment, because `timeout: 5000` already IS the retry. | 276-10. |
| D-276-6 | Of the 24 findings, only `gate_render` lands on a Theo-absorbed tool. `gate_answer` and `chain_run` have already diverged from Theo's own constants (Theo `83a1ce2`). TOOLHON-12's parity test is skip-when-absent and non-blocking; a direct run of the current checker against Theo scans zero tools. Theo-side work is a coordinated SEED recommendation (a TS-AST port of the methodology), never executed from this repo. | 276-04, 276-13. |

## Assumptions resolved or still open

- **A2** (MEDIUM and UNKNOWN suppression): answered by D-276-2. No suppression
  path exists or is added for those tiers.
- **A3** (the in-memory gate-ledger mint): answered by D-276-3. It is a mint,
  not persistence; the fix is a description correction.
- **A4** (Tri-Polar scoping): answered by D-276-1, against the researcher's
  own recommendation to hand the meeting-filing gap to its own phase. Stated
  plainly: the navigator overruled the researcher's "own phase" recommendation
  in `276-RESEARCH.md`'s "Tri-Polar Meeting Gap" section and kept it in 276.
- **A9** (opener versus option, C4's fix shape): answered by D-276-4, against
  the researcher's own recommendation to route through `openRoomDb`. Stated
  plainly: the navigator's second research pass (`e38e056a`) overruled A9 on
  the ~40-file regression-risk grounds named in D-276-4 above.
- **A12** (the M8 disposition): answered by D-276-5. M8 is IN, as a
  comment-only correction, not a new retry implementation.
- **A11** (the F-selector's unread getters) and **A6**: not resolved by this
  plan. Both are resolved by measurement in plans 276-02 and 276-03
  respectively (already executed, Wave 0), not by navigator ruling here.
