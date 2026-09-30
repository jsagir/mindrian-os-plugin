# Phase 365: Verification rung earned not asserted - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make a claim's verification standing something the architecture EARNS, never something the filer
asserts, and stop unattended steps from doing what nobody would sanction. Delivers, in order:

1. A failing baseline on record FIRST: the three acceptance tests (byte, one-week, floor) and the
   five property falsification tests from 365-INPUT.md, run against today's code.
2. B2: the approval floor at the human gate.
3. B3: the room "never do this" list read before every unattended step.
4. The rung portrait surfaces and B5 (rung named in words on every rendered claim surface).
5. BLOCKED, not planned into executable plans until ratified: the edge-derived rung (B1
   derivation), the person node (B1a) and B4. These wait for the paper author to ratify the
   verification ladder; plan them as a gated later wave or a follow-on, never against the
   provisional ladder.

Not in scope: a confidence score, auto-promotion on any signal, a model grading a rung (all
forbidden by the spec), and the frame-provenance mechanic (shipped in Phase 358).
</domain>

<decisions>
## Implementation Decisions

### Approval floor (B2)
- **D-01:** The floor is ON by default in every room (existing and new). Rationale: an off-by-default floor leaves the byte and one-week tests failing in every existing room.
- **D-02:** The floor is stored in the room-root ROOM.md frontmatter as a rung ID, never a number (e.g. `verification_floor: secondary_document`), because the provisional 1-5 constant (verification.cjs `TODO(358)`) will be renumbered to the 0-5 draft. Add `verification_floor` to the ROOM.md optional keys in lib/core/frontmatter-schemas.cjs; read it with a small head-read modelled on ambient-framing.cjs `readPwsStageHead`.
- **D-03:** Until the edge-derived rung ships, the default floor predicate is: the claim has at least one outbound edge to a node carrying both `url` and `retrieved_at`.
- **D-04:** A below-floor approve lands at `needs_evidence` (existing enum; `proposed -> needs_evidence` is already a legal transition in lib/core/navigation/transitions.cjs). NO "confirm anyway" option on the card. The only routes out: add evidence and approve again, or lower the floor in ROOM.md (a visible file-level act).
- **D-05:** The gate card states WHY before the click, in plain words, e.g. "Checked against: nothing outside the conversation yet. This room asks for at least a source document, so approving files it as needs evidence." The approve option is relabelled for below-floor subjects ("Approve, mark as needs evidence"). The line is composed in the gate_render tool handler (which can open the room db) and carried in the card data, so all three renderers (elicitation, AskUserQuestion, headless text) show it on CLI, Desktop and Cowork. gate-render.cjs stays a pure normalizer.
- **D-06:** The floor check lives in lib/mcp/tools/gate.cjs `_promoteCardSubject` (or a new sibling helper in confirm-node.cjs), NOT inside `confirmNode`, which selector-decisions.cjs, lens-engine.cjs, qualify-opportunity.cjs and room-birth.cjs also call and which must stay unchanged.
- **D-07:** Every approve records the floor and the rung in force at that moment (a memory_event through navigation.cjs), so a later hand edit that lowers the floor leaves a trace.
- **D-08 (planner decides, flag it):** A held claim can currently only move `needs_evidence -> validated`; there is no `needs_evidence -> confirmed`. Either accept "re-approve with evidence = validated" or make an additive TRANSITIONS extension. Additive only, closed enums still fail shut.

### "Never do this" list (B3)
- **D-09:** A structured list at `.mindrian/never-do.json` (schema `mos.room-constraints/1`). Each entry: a closed-enum `kind` in {command, section, path, provider, term}; a literal `value`; a plain-sentence `why` that is SHOWN on the card and NEVER matched; `approved_via {surface, decision_node_id}`.
- **D-10:** Writer: Larry proposes, and an entry lands only when the navigator approves a gate card. Copy the grants.writeGrant rule (refuse to write without an approval trail).
- **D-11:** Matching is exact string or whole-segment path-prefix comparison against fields steps already declare (chain-step-dispatcher `produces` / `target_section`, `step.command`, ambient `plan.return_target.section`, `PROVIDER` / `leaf.corpus`, grant `approved_terms`). No model judges a match.
- **D-12:** On a match: HALT with a Shape F gate card through gate-ledger (Canon Part 3), and append a line to `.mindrian/constraint-trips.jsonl`. The check is add-only and can only force a halt, never clear one. In chain-executor.cjs `makeGateFn` it sits right after `isIrreversibleStep` (which must stay first). In ambient.cjs it runs before `grants.recordRun`, i.e. before any network request, with a new `halted_constraint` outcome added to AMBIENT_OUTCOMES.
- **D-13:** Fail shut: a malformed file halts every unattended step; a missing file is an empty list.
- **D-14:** Growth: every unattended halt, and every Reject on a material-step card, offers "Reject and never do this", pre-filling a proposed entry from the step's declared fields (still lands only on approval).
- **D-15:** Presented as a FLOOR, never as solved: every user-facing surface that mentions the list says it catches only what has been named.

### Rung portrait and rendered surfaces (B5)
- **D-16:** The full portrait is PULLED, never pushed: shown on request only (`/mos:status --checks` and the existing claim_verify portrait mode), as counts in words, each row naming what would move it (e.g. "reached a located primary source: 41 / checked only by asking a model: 207 / not checked yet: 92"). No percentages, badges, colors or scores (Canon Part 12; the spec forbids scores).
- **D-17:** Exactly two unsolicited signals, as Zone 3 Intelligence Strip entries: (1) a claim a decision rests on sits at "asked a model", shown with the check that would close it; (2) the weekly distribution stayed flat for N weeks while checks kept being recorded ("checks in the last N weeks moved no claim past asking a model"). The stall signal is suppressed until at least 2 weekly snapshots exist.
- **D-18:** A local, append-only weekly snapshot record of the distribution feeds the stall signal (room-local, Canon Part 9; never leaves the machine, Part 8).
- **D-19:** B5: every per-claim render (wiki, dashboard, exports, gate card) names the rung in words from ONE shared label map in lib/core/navigation/verification.cjs (renderPortraitLines is already "the ONE place these render strings are written"). Keep its closing line "A count is not a verdict. Only a person confirms a claim." Final wording is frozen only after ladder ratification; build the map with provisional labels behind that block.

### Claude's Discretion
- The stall threshold N (default suggestion: 4 weeks), recorded as a disclosed floor in data/floor-ledger.json per the repo's floor-ledger rule.
- Exact card copy, within D-05 and the no-em-dash rule.

### Carried forward (not re-asked)
- Frame provenance (origin chosen/tasking/prompt/inherited; refines vs relocates) shipped in Phase 358; this phase does not touch it except to note the open check below.
- The single write chokepoint, proposed-by-default truth claims, the narrow bookkeeping carve-out and fail-shut closed enums are guardrails: do not "improve" them.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase input (the spec, sanitized)
- `.planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-INPUT.md` - the paper author's build spec and the property review, summarized with real names replaced by roles; the draft 0-5 ladder, structural predicates, build items, guardrails, do-not-build list, acceptance tests, falsification tests, and the 2026-10-01 code audit.

### Code the decisions bind to
- `lib/core/navigation/verification.cjs` - B1 checking records, VERIFICATION_RUNGS (provisional, TODO(358)), portrait readers and renderPortraitLines.
- `lib/mcp/tools/claim-verify.cjs` - the current self-declared rung input.
- `lib/mcp/tools/gate.cjs` - `_promoteCardSubject` and the gate_render handler.
- `lib/mcp/gate-render.cjs`, `lib/mcp/gate-ledger.cjs` - card normalization and the single gate ledger.
- `lib/core/navigation/confirm-node.cjs` - confirmNode (must stay unchanged for its other callers).
- `lib/core/navigation/transitions.cjs` - TRANSITIONS (proposed -> needs_evidence exists; no needs_evidence -> confirmed).
- `lib/core/navigation/insights.cjs` - findUnsupportedClaims (already includes needs_evidence); findContradictions (reads existing CONTRADICTS edges only).
- `lib/core/frontmatter-schemas.cjs` - ROOM.md optional keys.
- `lib/core/ambient-framing.cjs` - readPwsStageHead head-read pattern.
- `lib/core/chain-executor.cjs` - makeGateFn, isIrreversibleStep, `_ledgerForcesIrreversible` (the add-only halt pattern).
- `lib/core/irreversibility-ledger.cjs` - add-only force-halt precedent (Phase 356).
- `lib/core/research-planner/ambient.cjs`, `lib/core/ambient-run.cjs`, `lib/core/research-planner/grants.cjs`, `lib/core/research-planner/quick.cjs` - the Phase 363 ambient runner, the approval-trail write rule, PROVIDER.
- `lib/core/chain-step-dispatcher.cjs` - declared `produces` / `target_section`.

### Doctrine
- `docs/MINDRIAN-CANON.md` Parts 3, 8, 9, 11, 12.
- `docs/STATUSLINE-CONTRACT.md` INV-SL-2..5 (no warning without its fix; the line is not a destination).
- `docs/reward-before-investment-rule.md` ("a status report is not a reward").
- `skills/ui-system/SKILL.md` (Zone 3 Intelligence Strip: HIGH/MEDIUM only, max 3, omitted when empty).
- `commands/status.md` ("frame gaps as opportunities").
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` (any new invocable surface declares its HITL shape).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verification.cjs` portrait reader + render helpers: the single home for the rung-word label map (D-19).
- `grants.writeGrant` approval-trail rule: template for never-do.json writes (D-10).
- Irreversibility ledger + `_ledgerForcesIrreversible`: template for an add-only, force-halt-only check (D-12).
- `readPwsStageHead`: 2KB ROOM.md head-read pattern for the floor reader (D-02).
- `findUnsupportedClaims` / research-preflight `evidence_gaps`: surface held (needs_evidence) claims with no extra work.

### Established Patterns
- `.mindrian/*.json` = machine ledgers with approval trails; ROOM.md frontmatter = human-visible standing rules.
- Gate cards carry their text in card data so all three renderers agree (Tri-Polar).
- Closed enums fail shut; additive extension only.

### Integration Points
- gate.cjs `_promoteCardSubject` (floor check), gate_render handler (why-line).
- chain-executor.cjs `makeGateFn` after `isIrreversibleStep` (never-do check).
- ambient.cjs before `grants.recordRun` (never-do check, new outcome).
- scripts/mos-status.cjs `--checks` flag; room-proactive signal source (two signals); wiki/dashboard/export renderers (B5).
</code_context>

<specifics>
## Specific Ideas

- "A rung says what was done. A score says how sure someone felt." Every surface names what was DONE.
- The paper author's indicator: a rung distribution that does not improve across months means checks stopped closing anything. That is the stall signal (D-17), used as a trigger, never as a score.
- "Most confirmed claims at rung 1-2 is the fix working, not failing." Copy must never frame low rungs as failure.
- Acceptance order is fixed: record the failing baseline BEFORE any code changes.
- Test 5 (contradiction without shared wording) targets the CONTRADICTS-edge writers, not findContradictions; the plan must name which writer(s) it drives.
</specifics>

<deferred>
## Deferred Ideas

- Edge-derived rung (B1 derivation), person node (B1a), B4 split of the unsupported scan: BLOCKED on the paper author ratifying the ladder. Also blocked: migrating existing Phase 358 records from the provisional 1-5 constant to the ratified ladder.
- Open check from Phase 358 (not in this phase's build): does the frame-provenance "what did the old question get wrong" ask fire BEFORE the new answer is shown? Verify and, if not, raise as its own quick task or phase.
- The paper author's discipline-control experiment (Mindrian vs a disciplined person with a chat window and notebook): needs the derived rung; a research activity, not a build item.
</deferred>

---

*Phase: 365-verification-rung-earned-not-asserted*
*Context gathered: 2026-10-01*

## Addendum: planning-time rulings (2026-10-01, after 365-RESEARCH.md)

- **D-20 (resolves D-08):** Add ONE additive transition `needs_evidence -> confirmed` (human-only, through the existing confirm path). A claim released by lowering the room floor lands `confirmed`, not `validated` (validated means evidence attached under the Phase 108 truth-state contract). No Canon Appendix D entry assumed; flag in the plan if a doc rule requires one.
- **D-21:** The floor applies to CLAIMS only. Opportunity subjects keep today's behavior.
- **D-22:** Before the derived rung exists, floors above source-document are honored structurally: a primary-source floor requires the source node to carry a `locator` (page, section, DOI, clause); a person floor always holds (no person node yet). Never guessed, never silently downgraded.
- **D-23:** Weekly portrait snapshots are stored as one memory_event per ISO week in room.db through navigation.cjs (Canon Part 9), not a jsonl file. Stall threshold N = 4 weeks, recorded as a disclosed row in data/floor-ledger.json.
- **D-24 (from research, adopted):** One shared "standing" reader in verification.cjs (has a source edge / only asked a model / nothing) feeds the floor, the why-line, the portrait, both signals and B5; the edge-derived rung later replaces only that function. The why-line is built by ONE shared helper used by both card builders (gate_render handler and the meeting tool at lib/mcp/tool-router.cjs), carried in a new normalized card field `notice`.
- **D-25 (from research, adopted):** Ladder-blocked work (derived rung, person node, B4, record migration) moves to follow-on Phase 365.1, fenced by data/verification-ladder.json (`ratified: false`) plus a fence test.
