# 365-05 D-20 audit: the needs_evidence -> confirmed transition

Written before any byte of lib/core/navigation/transitions.cjs moves. Base: 65a4c6d49. Audience: the navigator, who rules at the blocking checkpoint.

Plain version first. A claim held below the room's floor (D-04) sits at needs_evidence. Today the only exit from needs_evidence is validated, and validated means "evidence attached" under the Phase 108 contract. So a claim whose floor is later lowered, or whose evidence is later added and approved again, has no honest place to land. D-20 adds one door: needs_evidence -> confirmed, human only. This audit checks whether a written rule forbids that door, who else could walk through it, and what pins the closed set.

## 1. Does a doc rule require a canon entry for a new transition?

Answer: NO canon rule requires an Appendix D entry. Two non-canon doc rules touch the set and need a matching edit or note, not a canon amendment.

Commands run: `grep -rn "TRANSITIONS\|8-transition\|closed taxonomy\|needs_evidence" docs/ CLAUDE.md .claude/includes/` (research and autopsy folders excluded from the reading, nothing relevant there).

What governs, quoted:

- docs/MINDRIAN-CANON.md:350 (Part 9, Truth states (canonical)): "Every node in `room.db` carries a `review_status` from a closed set: `proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated`. Brain may *propose* a status; only user confirmation or system rules can *promote* a status." Canon names the eight STATUSES. It does not enumerate transitions anywhere in Part 9, and no canon Part names the transition set as frozen. needs_evidence and confirmed are both already in the closed status set, so this change adds no status.
- docs/MINDRIAN-CANON.md:836 (Appendix D entry 24) amended the truth-claim TYPE set (SyntheticExpert) and records that the transition table was left unchanged. Appendix D entry 41 (line 870) narrowed one transition target (`superseded`) to human only and says "This entry RATIFIES already-shipped code". Neither entry says a new transition needs an entry. The pattern so far: entries are for changes to a Part 9 frozen SET of types or to who may reach a status. The new transition changes neither: `confirmed` is already human-only for truth-claim nodes through the setsConfirmed guard, and the new key lands on `confirmed`.
- .planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md:24: "These are the allowed transitions. Any transition not in this table is a violation." Rows 26-34 list nine rows (the eight members plus validated -> stale) and do not list needs_evidence -> confirmed. The Forbidden list at lines 38-42 does NOT name it (it names rejected -> anything, stale -> confirmed, needs_evidence -> invalidated, any -> proposed). So the move is not forbidden, it is unlisted, and the contract's own rule makes an unlisted pair a violation until the table gains the row. This plan adds the row (task 3). This is the contract doc the plan already edits, not a canon amendment.
- docs/SUPERSESSION-CONTRACT.md:107-113 (Ruling 3) and line 213 (D-05): "`TRANSITIONS` ... is a canon-named closed literal with eight members ... keep the set byte-unchanged". The ruling is scoped to Phase 348's question (should `proposed -> superseded` be minted: no, route through `proposed->rejected`) and its stated purpose is "so a future phase does not re-litigate it blind". It does not forbid an unrelated future addition. But its wording "eight members" and line 26 ("closed `TRANSITIONS` set (`transitions.cjs:60-69`)") will read as stale after this change. Flag: a one-line dated note is advisable in a later docs touch (not required for correctness, not in this plan's files). docs/2026-09-16-PHASE-348-SUPERSESSION-CLOSE-OUT.md:91 and :123 repeat the Phase 348 scope.
- lib/core/navigation/transitions.cjs:9-10 header comment says "documented 8-transition closed taxonomy". Plan 05 updates it to nine with the reason.
- CLAUDE.md and .claude/includes/: no hit that names transitions as frozen. CLAUDE.md Part 9 line: "only a human confirms a truth-claim node" is honored by the new key (see section 2).

Net: the plan's assumption A1 holds. No Appendix D entry is required by any rule found. Cautions for the navigator: (a) the Phase 108 TRUTH-STATES row is needed and is in scope; (b) the Phase 348 contract's "eight members" wording becomes historical and should get a dated note later; (c) the Canon's role-5 prose says "Promotion ... from `proposed` to `confirmed`" in the narrow sense, so a reader could argue human confirmation of a held claim deserves a canon sentence. That is a judgment call, not a requirement found in a rule, and the audit does not treat it as one.

## 2. Who else can now confirm a held node?

Mechanism: confirmNode reads the node's current review_status and calls promoteNodeStatus(db, id, <current>, 'confirmed'). Today a needs_evidence node gives the pair needs_evidence->confirmed, which is not in TRANSITIONS, so every caller gets `{ok:false, reason:'invalid_transition'}`. After the change that pair is legal, so every caller that can reach such a node by id now SUCCEEDS when its byUser is not an agent identity. The human-attribution guard fires for truth-claim types (claim, CausalClaim, assumption, decision, opportunity, SyntheticExpert) and refuses larry / brain / system / assistant; other node types are unguarded, exactly as they already are for proposed -> confirmed. EvidenceClaim is refused by NON_PROMOTABLE before the transition matters.

Who can sit at needs_evidence today: no live code path in lib/, scripts/, bin/ or hooks/ writes it. grep for 'needs_evidence' shows readers only (room-home.cjs getRiskyAssumptions, insights.cjs, focus.cjs, research-preflight.cjs, research-context-extractor.cjs, artifact-brain-packet.cjs), the CHECK constraint (phase-109 migration), node-insert.cjs's accepted enum (opts.review_status override, no caller passes needs_evidence), and verification-floor.cjs (365-04, read-only). The two live promoteNodeStatus callers outside confirmNode are memory-governance-closer.cjs:196 (proposed -> confirmed) and temporal/supersession.cjs:102 (to superseded). So a held node exists only (a) in legacy or fleet rooms migrated to the Phase 108 enum, or (b) once 365-08 starts holding below-floor approvals through holdForEvidence. The widened reach is therefore dormant until 365-08 or until an old room already has such nodes.

Every confirmNode call site, by whether it can target a held node and what changes:

| Caller | Can it name a node by id that could be held? | Today | After the change |
|---|---|---|---|
| lib/mcp/tools/gate.cjs `_promoteCardSubject` (line 111) | Yes: the card subject. But the helper returns `subject_not_proposed` first when review_status is not proposed (gate.cjs ~line 108). | skipped, never reaches confirmNode | unchanged until 365-08 edits that guard on purpose (the floor release leg) |
| lib/mcp/tools/gate.cjs gate_answer reasoning-node mint (line 437) | No: confirms a node it just minted at proposed | n/a | unchanged |
| lib/workflow/selector-decisions.cjs approve branch (line 166) | Yes: any `o.nodeId` the caller supplies, no status filter | invalid_transition surfaced verbatim | SUCCEEDS for a human byUser. THIS BYPASSES THE FLOOR: confirmNode has no floor check (D-06), so a held claim can be confirmed through this selector path with no floor test |
| lib/core/futures/orchestrator.cjs APPROVE (line 757) | Yes: ids in the decision list, no status filter | fails, recorded as a failure | succeeds for a human byUser; same floor bypass |
| lib/core/sensors/sensor-expert-skill.cjs APPROVE (line 246) | Yes: nodeId (a SyntheticExpert at proposed in practice) | fails | succeeds if the node were held; SyntheticExpert is truth-claim, so human-guarded |
| lib/core/lens-engine.cjs applyAccept (line 264) | Yes: its own lens_finding node, minted proposed; not a verification-floor subject | n/a | unchanged in practice |
| lib/core/eureka/qualify-opportunity.cjs (line 204) | Yes: opportunity anchor, minted at qualification; a re-qualify of a held anchor would now confirm | state_mismatch / invalid_transition handling treats only currentStatus confirmed as done | would now succeed on a held opportunity |
| lib/core/strategy/goal-gate.cjs (line 168) | Yes: the card subject anchor, minted proposed in 345-06 | fails (recorded, never thrown) | would succeed if held |
| lib/core/navigation/room-birth.cjs (line 1082) | No: the venture node minted at birth | n/a | unchanged |

The honest consequence to rule on: the floor lives in the gate (D-06 keeps it out of confirmNode), so three non-gate human-approval paths (selector-decisions, futures orchestrator, qualify-opportunity and goal-gate if they meet a held node) can release a held claim without a floor check once this lands. Today the missing transition accidentally protects them. They all require a non-agent byUser, so Part 9 role 5 is intact; what moves is D-04's "no confirm anyway" promise for those side doors. This is not a reason to hold: those callers act on nodes the human explicitly approves, and a held node reached by them did go through a human APPROVE. It is a reason to record a follow-up (route those approve paths through the same floor notice, or accept the bypass in writing). Nothing in this plan changes those files.

## 3. What pins TRANSITIONS

Pin style across the repo: named membership, never a size assertion (the additive-floor idiom from edges.cjs).

- tests/test-348-agent-supersede-refused.cjs assertion 9 (lines ~211-225): asserts all eight named keys are in TRANSITIONS and EVENT_FOR_TRANSITION. Named membership only; a ninth member passes.
- tests/test-348-agent-supersede-refused.cjs assertion 8 (lines ~192-203): the three `UPDATE nodes SET ...` statements in transitions.cjs matched by regex and compared to three literal strings, byte for byte. The new transition must not add or edit an UPDATE statement (it will not: the new key routes through the existing setsConfirmed branch).
- tests/test-348-proposed-not-supersedable.cjs lines ~60-100: EXPECTED_MEMBERS (the same eight, membership), EXPECTED_ABSENT (`proposed->superseded`, `needs_evidence->superseded`, `rejected->superseded`, `stale->superseded`, `validated->superseded`; the new key is not among them), and a two-directional correspondence check that EVENT_FOR_TRANSITION has an entry for every member and none for a non-member. So the new member needs its EVENT_FOR_TRANSITION entry in the same edit, which the plan specifies.
- tests/test-348-supersession-e2e.cjs and tests/test-365-ladder-fence.cjs (line 144, loads the module) read TRANSITIONS; neither asserts size.
- tests/run-all-164.sh lines 113-120: a grep that TRUTH_CLAIM_TYPES members are still present in transitions.cjs. Unaffected.
- tests/test-365-baseline.cjs: pins confirmNode's body digest from the phase base (tests/fixtures/365-pre-phase.json confirm_node_body_sha256). holdForEvidence is a sibling function, so confirmNode's body stays byte-identical.

No test pins a size, so a ninth member breaks nothing by itself; the correspondence check forces the EVENT_FOR_TRANSITION entry.

## 4. Recommendation

Recommendation: PROCEED with the additive edit (the D-20 ruling).

Reasons: section 1 found no rule requiring a canon entry (Canon Part 9 enumerates statuses only; Appendix D entries 24 and 41 amended a type set and a human-only target, neither a precedent that new transitions need an entry); the one contract that does require an edit, TRUTH-STATES.md "any transition not in this table is a violation", is in this plan's files; the human guard already covers `confirmed` as a target so only a person can take the door; every pin is by named membership and the three UPDATE statements stay untouched.

Two things recorded for the navigator, neither blocking: (1) the side-door reach in section 2 (non-gate approvals can release a held claim without a floor check), proposed as a follow-up rather than fixed here because D-06 keeps confirmNode unchanged; (2) docs/SUPERSESSION-CONTRACT.md Ruling 3's "eight members" wording becomes historical and deserves a dated note in a later docs touch.

Choose canon-entry-first only if the navigator reads Canon role 5 ("from `proposed` to `confirmed`") as needing a sentence for held claims. Choose hold only if the side-door reach is unacceptable; note hold leaves 365-08's release legs unable to pass.
