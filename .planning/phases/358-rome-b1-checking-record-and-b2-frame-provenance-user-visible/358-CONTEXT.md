# Phase 358: Rome - B1 checking record and B2 frame provenance, user-visible - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning (B1 slice only in this planning pass)
**Source:** PRD Express Path (navigator decisions this session + the acceptance tests published to the paper author at https://mindrian-explainer-gate.vercel.app/nato.html)

<domain>
## Phase Boundary

The NATO Defense College session (Rome, 13 October 2026) will show officers the tool hands-on. The paper author's slides A1 and A2 claim capabilities that are not built. This phase makes them true in the NORMAL user flow, or they stay off the slides.

HARD go/no-go on 6 October 2026. Each move is judged on its own acceptance test. A failed move stays off the deck and the pre-written fallback wording is used.

THIS PLANNING PASS covers B1 only (slide A2: "stores what each claim was checked against - on the claim, visible months later, countable across a whole body of work"). B2 (slide A1: "which direction" and "can I turn around") is a second plan set in this same phase, planned after B1 lands.

</domain>

<decisions>
## Implementation Decisions

### B1 acceptance tests (LOCKED - these are the go/no-go tests, worded to match the slide)
1. An officer can record, on a claim, what it was checked against, the rung, the method and the result, in the normal flow and without a developer. Normal flow = on the Claude Code CLI (a /mos: command or Larry-driven turn) AND via MCP tools on Claude Desktop / Cowork (officers drive hands-on).
2. Close everything. In a new session, reopen the claim: the record is there and readable.
3. The room shows counts for checked, disputed, inconclusive and unchecked claims across all its work. Unchecked is always shown.
4. A checked claim is still only proposed until a person confirms it. Recording a check never promotes, never demotes, never changes review_status.

### Rung
- Add a `rung` field to the verification record. Its allowed values live in ONE exported constant (single source of truth), provisional, marked `TODO(358): replace with the paper author's verification hierarchy from The Orientation Problem`. Swapping the list must be a one-constant edit plus a test update.
- Provisional ordering must be an ordered list (rung 1 lowest) so "rung three or above" is expressible.
- Existing records without a rung stay valid (reported as rung unknown), additive only, no migration.

### Counts are never a score
- The portrait reports counts by state and result, plus the number of claims with no record. It never computes a percentage-as-quality, grade, or single number. Unchecked is always rendered, even when zero.

### Separation from approval
- Verification and review_status are independent. The claim view must show both side by side, labeled so "checked" is never read as "confirmed".

### Canon constraints
- Part 8: rung, method, result, against_kind are local enums; free-form notes are artifacts referenced by note_handle. Nothing in B1 crosses to Theo / the Brain.
- Part 9: all writes go through the existing chokepoints (lib/core/node-insert.cjs via verification.cjs); reads through lib/core/navigation.cjs.
- Part 11: any new command / MCP tool is born wired (connector registry, shape declaration) per CIRS.
- Tri-Polar: CLI + Desktop + Cowork.

### Collision rules (LOCKED)
- Peer sessions execute Phases 354-357 in the same working tree. Commit only owned files with `git commit --only`; `git add -f` for .planning paths.
- Never touch: docs/reviews/*, evals/plurai/*, scripts/eval-icm-writers.cjs, scripts/jev-devtime-client.cjs, tests/test-353-*, .planning/phases/356-*, data/jev-policies/, .planning/STATE.md.
- lib/mcp/tools/gate.cjs is Phase 354 territory: if B1 needs it, coordinate with the 354 session (jsagi-25) first; prefer not touching it.
- No em-dashes in any written text.

### Navigator rulings after research (2026-09-23, LOCKED)
- Desktop writes: YES. Add the Claude Desktop MCP client name `claude-ai` to the tier0 write-enabled host list (same pattern as commit 5f0a55993). Writes still land as proposed through the chokepoint. Cowork is added only after a live probe confirms its client name; until then the demo-machine env fallback MINDRIAN_MCP_FIRST=desktop,cowork is documented, not relied on.
- Disputed sticks: if ANY record on a claim has result contradicts, the claim's verification status is disputed until a person resolves it; every record stays visible; a later supports never hides an earlier contradicts.
- Who checked: add optional `checked_by_id` resolved via the existing resolveByUser; local only, never crosses to Theo.
- Bug to fix (proven by research, blocks AT2): writeClaimNode rebuilds claim properties and wipes the `verification` key on re-file (typed-claim.cjs:139-177, node-insert.cjs:246-247). Carry it forward and add it to PROTECTED_CLAIM_KEYS; add a regression test covering graph-derivation style re-saves.
- Red tests left by substrate commit 42191a6ae (test-234 description floor, test-270 schema budget, test-276 honesty sweep) must be green at phase end.
- The 6 October go/no-go checklist includes a release cut and a live install check on the real demo machines (a main commit is not live until released and picked up).

### Claude's Discretion
- Exact CLI surface (extend an existing /mos: command such as the room/query view, or a small new command) chosen by reuse-before-build (Canon Part 7): search commands/*.md first.
- Exact MCP surface: extend claim_verify and add or extend a read tool for the claim view and the room portrait; prefer extending existing tools over new ones.
- Rendering format of counts, as long as the four states plus "no record" are always visible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### B1 design and substrate
- `docs/2026-09-23-B1-B2-IMPLEMENTATION-RESEARCH.md` - B1 data contract, build order, "no slide may claim until wired"
- `lib/core/navigation/verification.cjs` - recordClaimVerification + readVerificationPortrait (writer/reader, no consumer yet)
- `lib/mcp/tools/claim-verify.cjs` - registered MCP tool that writes a record
- `lib/core/navigation.cjs` - read chokepoint (portrait re-export at ~line 488)
- `lib/core/node-insert.cjs` - write chokepoint
- `lib/core/navigation/typed-claim.cjs` - claim writer (review_status: proposed)

### Canon
- `docs/MINDRIAN-CANON.md` Parts 7, 8, 9, 11, 12
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - shape declaration for new surfaces

### External (the claim being made true)
- https://mindrian-explainer-gate.vercel.app/nato.html - acceptance tests and fallback wording as shown to the paper author
- https://what-ai-cannot-know.vercel.app/ - Part V practice 3 ("what did you check it against", rung three or above)

</canonical_refs>

<specifics>
## Specific Ideas

- Demo shape in Rome: officers file a claim, a facilitator plants a contradicting field note, officers record "checked against: field note, exercise 02 / rung N / compare / contradicts", reopen later, see the room counts.
- The claim view should read like: status `proposed` (only a person can confirm) / checked against / rung / method / result / by / when.

</specifics>

<deferred>
## Deferred Ideas

- B2 frame provenance (origin chosen/tasking/prompt/inherited shown; history viewable; pre-answer pause asking what the old question got wrong; refines vs relocates) - second plan set in this phase after B1 lands.
- Final rung list from the paper author (swap the provisional constant).
- Any UI in the Visible Room wiki beyond what the acceptance tests need.

</deferred>

---

*Phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible*
*Context gathered: 2026-09-23 via PRD Express Path*
