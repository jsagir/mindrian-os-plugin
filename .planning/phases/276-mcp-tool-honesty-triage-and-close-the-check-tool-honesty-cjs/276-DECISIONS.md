---
phase: 276
status: draft
ruled: PENDING
plans_gated: [276-12, 276-14]
---

<!--
DRAFT PREP ARTIFACT (276-05, Task 1/2 prep). This file is NOT ratified. Both
OQ-276-1 and OQ-276-2 are BLOCKING navigator decisions, presented below with
their options laid out and the ruling slot left empty. When the navigator
selects, a continuation agent fills the ANSWER sections with the verbatim
ruling and flips status to `ratified` (Task 3 of 276-05-PLAN.md).
-->

## OQ-276-1 ANSWER

**Question:** A meeting claim written from the MCP surface has to carry a
`knowledge_type` (6 values, `lib/core/navigation/typed-claim.cjs:53`
`KNOWLEDGE_TYPES`) AND pass through `node-insert.cjs`'s `epistemic_type` gate
(10 values, `lib/core/node-insert.cjs:113` `ALLOWED_EPISTEMIC_TYPES`) AND be
comparable against the current operator's DIKW cap (5 rungs,
`lib/conversation/operator.cjs:133` `EPISTEMIC_LEVELS`). Which mapping is
authoritative, and where does it live?

**Grounded fact found during read_first that bears directly on this ruling:**
`typed-claim.cjs:162-169`'s `writeClaimNode` already calls `insertNode` with a
HARDCODED `epistemic_type: 'extracted_fact'` for every claim regardless of its
`knowledge_type`. All 6 `KNOWLEDGE_TYPES` members currently collapse onto ONE
`epistemic_type` value. There is no per-member mapping today; the "mapping"
that exists is a constant, not a table.

**STATUS: AWAITING NAVIGATOR RULING.**

### Options presented (verbatim from 276-05-PLAN.md Task 1)

**Option a: Mapping table in node-insert.cjs, epistemic_type stays canonical**
- Pros: One fail-closed gate stays the single authority. `knowledge_type`
  becomes a per-writer input that maps INTO an existing `epistemic_type`, so
  no enum grows and no existing write path changes. The mapping is readable
  at the chokepoint Canon Part 9 already names.
- Cons: Puts a claim-domain concern inside the generic node-write gate, which
  its own comment (`node-insert.cjs:110-112`) currently says it does not want
  ("the per-writer mapping lives in each call site's insertNode(...) call,
  not here").

**Option b: Mapping table in typed-claim.cjs, at the claim writer**
- Pros: Honors `node-insert.cjs`'s own stated design ("mapping lives at the
  call site"). Keeps the claim vocabulary and its epistemic projection
  together in the module that already owns `KNOWLEDGE_TYPES`
  (`typed-claim.cjs:53`) and the protected-key discipline
  (`typed-claim.cjs:65-68`). Smallest blast radius.
- Cons: A second claim writer added later could map differently, so the
  mapping is a convention enforced by review rather than by a gate. Needs a
  test to pin it.

**Option c: A new shared vocabulary module that all three import**
- Pros: One home, importable by the operator cap
  (`operator.cjs:138` `OPERATOR_EPISTEMIC_CAP`), the node gate
  (`node-insert.cjs:113`) and the claim writer (`typed-claim.cjs:53`), so a
  future comparison of a node's epistemic_type against the operator cap
  becomes a function call rather than a rediscovery.
- Cons: Largest change. Touches three modules including two chokepoints, in a
  phase whose thesis is propagation of existing fixes rather than new
  construction. Risks the same sprawl Phase 273 D-02 avoided.

**Option d: Rule the mapping now, build only what 276-12 needs**
- Pros: Records the authoritative mapping as a DECISION in this file and
  implements only the direction plan 276-12 actually consumes
  (knowledge_type to epistemic_type), leaving the operator-cap comparison as
  a named follow-up with an owner. Unblocks the build without spending this
  phase's capacity on the full bridge.
- Cons: Leaves the cap-comparison half unbuilt, so the CLAUDE.md trap narrows
  rather than closes. Must be stated as such, not presented as a full close.

**Planner's lean (stated per Task 1's action instruction, not a ruling):**
Option b, on the strength of `node-insert.cjs`'s own comment already pointing
mapping ownership at the call site, combined with Option d's scope discipline
(rule the knowledge_type-to-epistemic_type direction now; name the
operator-cap comparison as an explicit follow-up rather than silently
building or silently dropping it). A hybrid "b+d" reading is plausible but is
NOT assumed here; the navigator selects a-d as written, or states a different
combination explicitly.

**If the ruling implies a mapping,** it must be recorded here as a table, one
row per `KNOWLEDGE_TYPES` member (fact, causal, heuristic, anomaly_cue,
mental_model, assumption), each with an `epistemic_type` target drawn from
`ALLOWED_EPISTEMIC_TYPES`, and the file:line where the mapping will live.

## OQ-276-2 ANSWER

**Question:** What exactly does the MCP surface expose so Desktop and Cowork
can reach a real DIKW claim write, and where does the human confirmation sit
relative to that write?

**Constraints already locked (D-276-1, not reopened by this question):** a
`writeClaimNode` MCP primitive routed through `node-insert.cjs`, `gate_render`
and `gate_answer` wiring, small single-job tool calls, no duplicated Claimify
extraction logic. Canon Part 9 forbids a second write path:
`lib/core/node-insert.cjs` is the single node-write chokepoint. What remains
open is surface granularity and gate order.

**STATUS: AWAITING NAVIGATOR RULING.**

### Options presented (verbatim from 276-05-PLAN.md Task 2)

**Option a: One tool, write-then-gate: claim_write files at proposed,
gate_answer promotes**
- Pros: Smallest surface. Reuses the shipped `gate_answer` approve branch
  (`gate.cjs:168-235`), which already promotes via `navigation.confirmNode`
  and writes SOURCED_FROM provenance. A claim exists in the graph
  immediately, visible even if the human never answers.
- Cons: A proposed claim exists before any human saw it. Canon Part 9 says
  only a human confirms a truth-claim node, which this honors at the
  `confirmed` level but not at the `exists` level.

**Option b: One tool, gate-then-write: claim_write renders a gate first and
writes only on approve**
- Pros: Nothing enters the graph without a human. Strictest reading of Canon
  Part 9 and of `filing-protocol.md:174-176`'s "Nothing files without the
  navigator confirming."
- Cons: Couples the write tool to the renderer ladder, so a headless or
  non-interactive surface either blocks or silently degrades. The gate ledger
  is in-memory and single-use (`gate.cjs:45-63`), so a restart between render
  and answer loses the pending claim with nothing on disk.

**Option c: Two tools: claim_write (proposed only) plus an explicit
claim_confirm that routes through gate_answer**
- Pros: Two small single-job tools, matching D-276-1's "small single-job tool
  calls". Each is independently testable and independently honest in its
  description.
- Cons: Adds two tool registrations rather than one, and a second HITL
  declaration surface under Canon Part 11. Grows the description budget
  `test-270` (`tests/test-270-tool-schema-budget.cjs`) measures.

**Planner's lean (stated per Task 2's action instruction, not a ruling):**
Option a. It reuses the shipped `gate_answer` approve branch byte-for-byte
(the same promotion path `artifact_file` already rides per Canon Part 9,
matching the existing `writeClaimNode` precedent of landing at `proposed` on
insert, `typed-claim.cjs:158`), needs no new gate-ledger persistence work,
and keeps the tool count at one. The "proposed exists before a human saw it"
cons is the same shape `artifact_file` and every other `insertNode` caller
already accepts (review_status='proposed' is the standing pattern, not a new
risk this tool introduces).

**Routing statement required regardless of option:** the write routes through
`lib/core/node-insert.cjs` (via `typed-claim.cjs`'s `writeClaimNode`, which
already calls `insertNode`), never a second write path, and
`writePathRefusal` (`graph.cjs:100-108`) applies at call time exactly as it
does for `graph_write` and `memory_event`.

**Tool name(s) to mint:** to be stated by the navigator's ruling. `claim_write`
is the working name used throughout `276-RESEARCH.md` and this plan's
frontmatter (`artifacts_this_phase_produces` names `lib/mcp/tools/claim.cjs`
as the home, minted by 276-12); if Option c is selected, `claim_confirm` is
the working name for the second tool, pending navigator confirmation.

**What the tool description must NOT claim:** to be stated by the navigator's
ruling, but per the honesty-fix pattern already proven on `meeting`
(`3a35f4f6`), the description must not claim a write is confirmed/final when
it is only proposed, and must not claim the five-perspective subagent fan-out
or the F.8 filing gate are reachable from this tool (per
`filing-protocol.md:44-54`, both are CLI-only and structurally unreachable
from MCP).

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
