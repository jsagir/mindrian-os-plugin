---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 14
subsystem: mcp-tools
tags: [mcp, dikw, gate-render, gate-answer, claim-write, meeting, tri-polar, tool-honesty]

# Dependency graph
requires:
  - phase: 276-08
    provides: "the meeting tool's honest description, noWriteBanner()/NO_WRITE_MARKER leading all three branches, the shipped kwl fixture this plan's wiring had to keep green"
  - phase: 276-12
    provides: "the claim_write MCP primitive, KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE mapping, and OQ-276-2's ratified write-then-gate order this plan composes from directly"
provides:
  - "lib/mcp/tool-router.cjs: the meeting tool's file-meeting branch, when called with knowledge_type + claim_text, writes a typed DIKW claim through writeClaimNode and renders a gate_render confirmation card (opt-in; every call omitting either param is byte-identical to the pre-existing reference-only response)"
  - "tests/test-276-meeting-gate-wiring.cjs: RED-then-GREEN proof (7 assertion groups, 14 assertions) that the gate is reached, confirmation happens only through gate_answer (proven against room.db), the ledger is single-use, no second gate mechanism exists, the description is honest about both halves, the shipped kwl fixture stays intact, and no brain_ call exists in the meeting branches"
  - "references/meeting/filing-protocol.md: the three-gap enumeration rewritten with an explicit status per gap (STILL OPEN / CLOSED by 276-14 / CLOSED by 276-12), and a narrowing sentence added to the Canon Part 8 risk paragraph"
affects: [276-15, 276-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Meeting-tool opt-in write+gate composition: an existing reference-only branch (file-meeting) gains a conditional write+gate path gated on two new optional schema params (knowledge_type, claim_text) rather than a new command or a new tool; every call omitting either param is byte-identical to the pre-existing response, so the shipped honesty fixture (test-kwl-meeting-mcp-honesty.cjs) needed zero assertion changes."
    - "Reuse gate-render.cjs/gate-ledger.cjs directly from a legacy router (tool-router.cjs), not through the disjoint-file lib/mcp/tools/*.cjs seam: the meeting branch requires gate-render.cjs's renderGate and gate-ledger.cjs's mintGate directly (the same two primitives gate.cjs's own gate_render handler composes), never lib/mcp/tools/gate.cjs itself (left untouched) and never a second in-memory ledger. Node's own require cache is what joins the mint (this file) to the consume (gate.cjs's gate_answer handler) -- no cross-module wiring of this plan's own."
    - "checkTree() reachability short-circuit: a branch that calls a real write primitive (navigation.writeClaimNode) resolves to WRITES before any description-claim classification runs (scripts/check-tool-honesty.cjs's classifyBranch order: hasBanner -> globalCancel -> reachability===WRITES -> claim tiers), so a genuinely-writing conditional branch inside an otherwise-reference-only tool reads OK regardless of exact wording, as long as the description also keeps the tool's existing global no-write disclaimer sentence for its still-reference-only siblings (pipeline, speakers)."

key-files:
  created:
    - tests/test-276-meeting-gate-wiring.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - references/meeting/filing-protocol.md

key-decisions:
  - "Opt-in via two new optional schema params on the EXISTING file-meeting command, not a new command and not a new tool: 276-DECISIONS.md OQ-276-2 names claim_write (276-12) as the ONE write tool and gate_render/gate_answer (shipped) as the ONE gate mechanism; this plan's job was wiring meeting's OWN file-meeting branch to compose those two, not minting a third surface. Adding knowledge_type/claim_text as optional params keeps MEETING_COMMANDS at its existing 3 members, keeps every pre-existing caller and all 37 kwl assertions byte-identical, and keeps checkTree()'s tool/branch counts unchanged (37/131)."
  - "Reused gate-render.cjs's renderGate and gate-ledger.cjs's mintGate directly, never lib/mcp/tools/gate.cjs (left byte-identical, confirmed by git diff scope): the plan's own instruction was to compose from the SAME primitives gate_render/gate_answer already use, not to route through gate.cjs's own tool-call surface (which would require simulating an MCP round-trip from inside tool-router.cjs) or to reach into gate.cjs's test-only _internal export. Ratification (the confirmed promotion) stays exclusively inside the shipped gate_answer handler, called separately by the caller afterward -- this branch mints the card and the ledger entry, and stops there."
  - "The noWriteBanner()/NO_WRITE_MARKER decision, per branch, stated explicitly (also required by the plan's own acceptance criteria, quoted here verbatim): file-meeting's reference-only fallthrough (no knowledge_type/claim_text) keeps **filed: false** unchanged, since it genuinely writes nothing. file-meeting's NEW write+gate branch (knowledge_type + claim_text both present) does NOT carry **filed: false** -- it would contradict a genuine write -- and instead constructs its response FROM writeResult's own return value (Pattern 3, the rooms-open verified-result construction), leading with the real node_id and gate_id. pipeline and speakers are completely unchanged and keep **filed: false** as before."

requirements-completed: [TOOLHON-07]

# Metrics
duration: 5min
completed: 2026-09-03
---

# Phase 276 Plan 14: Wire the Meeting Filing Path Through the Governed F.8 Gate Summary

**The `meeting` tool's `file-meeting` command now reaches real DIKW claim confirmation from Desktop/Cowork: opt-in `knowledge_type`+`claim_text` params write a typed claim through `writeClaimNode` and render a `gate_render` confirmation card, with promotion to `confirmed` happening only through the shipped `gate_answer` approve branch -- never a second write path, never a second gate mechanism.**

## Performance

- **Duration:** 5 min (commit-to-commit: 23:31:53 -> 23:36:02 local time, 2026-09-03; research/context-loading time not counted)
- **Started:** 2026-09-03T20:31:53Z
- **Completed:** 2026-09-03T20:36:02Z
- **Tasks:** 3 (RED test, GREEN wiring, filing-protocol.md gap-enumeration update)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1 (RED).** `tests/test-276-meeting-gate-wiring.cjs` created, authored before the wiring existed. Seven assertion groups (A gate reached, B confirmation proven against room.db, C single-use ledger REGRESSION PIN, D no second gate mechanism, E description honest about both halves, F shipped kwl fixture intact, G Canon Part 8 no-brain-call), 14 assertions. Observed RED: exit 1, groups A/B/C/E failing (the wiring did not exist yet), D partially failing (no gate-surface reference yet), F and G already passing (the pre-existing honesty fix and the no-Brain-call guard both held before this plan touched anything).
- **Task 2 (GREEN).** `lib/mcp/tool-router.cjs`'s `meeting` tool: two new OPTIONAL schema params (`knowledge_type`, `claim_text`); the `file-meeting` branch, when both are supplied, writes the claim through `navigation.writeClaimNode` (the same primitive `claim_write` uses, landing at `review_status: 'proposed'`), then renders a confirmation card by composing `gate-render.cjs`'s `renderGate` and `gate-ledger.cjs`'s `mintGate` directly -- the same two primitives `gate.cjs`'s own `gate_render` handler composes, never `lib/mcp/tools/gate.cjs` itself (untouched). Description rewritten to name the new confirmation path AND keep the existing "five-perspective subagent fan-out is unavailable, use /mos:file-meeting" disclosure. `tests/test-276-meeting-gate-wiring.cjs` now exits 0, all 7 groups/14 assertions pass. `tests/test-kwl-meeting-mcp-honesty.cjs` still exits 0, 37/37, **zero assertions changed** (the opt-in design means every existing caller and every kwl scenario call is byte-identical to before).
- **Task 3 (docs).** `references/meeting/filing-protocol.md`'s three-gap enumeration (lines 44-63 pre-edit) rewritten with an explicit status per gap: Gap 1 (five-perspective fan-out) STILL OPEN, structurally unreachable from MCP; Gap 2 (F.8 filing gate) CLOSED by 276-14, naming `gate_render`/`gate_answer` and stating `confirmed` is reachable only through the approve branch; Gap 3 (direct claim write) CLOSED by 276-12, naming the single node-write chokepoint by file (`lib/core/node-insert.cjs`). Canon Part 8 risk paragraph gained one narrowing sentence (kept the original warning verbatim, added a sentence naming what 276-14 actually narrows and what it does not). `.planning/debug/meeting-file-meeting-false-success.md` left at `.planning/debug/` (NOT moved to `resolved/`), per its own Current Focus reserving that disposition for plan 276-16.

## Task Commits

Each task was committed atomically:

1. **Task 1: the RED test for the meeting gate wiring** - `4e18dc7a` (test) -- 335 lines, observed failing (exit 1, groups A/B/C/E failing as expected, F/G already passing) against a tree with no gate wiring in the meeting branch.
2. **Task 2: wire the meeting filing path through the governed gate** - `421dcea8` (feat) -- `lib/mcp/tool-router.cjs` modified (95 insertions, 2 deletions); all 7 groups / 14 assertions pass (exit 0); kwl fixture 37/37 unchanged.
3. **Task 3: update the filing-protocol reference so the gap enumeration matches the code** - `dfa6f5c2` (docs) -- `references/meeting/filing-protocol.md` modified (51 insertions, 24 deletions).

_No plan-metadata commit yet -- see Final Commit below._

## Files Created/Modified

- `tests/test-276-meeting-gate-wiring.cjs` - RED-then-GREEN test combining the two sibling harness styles already in the repo: `registerRouterTools` (for `meeting`, the `test-kwl-meeting-mcp-honesty.cjs` style) plus `registerCoreTools` (for `gate_answer`, the `test-276-claim-write-primitive.cjs` style) against the same stub server capture map, so a real `gate_id` minted by `meeting`'s handler is consumed by the real `gate_answer` handler through the shared `lib/mcp/gate-ledger.cjs` singleton (Node's own require cache joins them). Independently reads `room.db` via `node:sqlite` for confirmation proof; never trusts response text.
- `lib/mcp/tool-router.cjs` - the `meeting` tool's schema gains `knowledge_type`/`claim_text` (both optional); the `file-meeting` branch gains an opt-in write+gate path (~75 new lines) ahead of the pre-existing reference-only logic (untouched, still reached whenever either new param is omitted); description rewritten to state both the new capability and the still-unreachable subagent fan-out.
- `references/meeting/filing-protocol.md` - the three-gap enumeration (lines ~39-83 post-edit) and the Canon Part 8 risk paragraph (lines ~198-216 post-edit) rewritten to match the code as it stands after 276-12 and 276-14.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: (1) opt-in via two new optional params on the existing `file-meeting` command, not a new command or tool, keeping `MEETING_COMMANDS` at 3 members and every pre-existing caller byte-identical; (2) reused `gate-render.cjs`/`gate-ledger.cjs` directly rather than `lib/mcp/tools/gate.cjs`'s tool-call surface or its test-only `_internal` export, keeping `gate.cjs` completely untouched; (3) the `noWriteBanner()`/`NO_WRITE_MARKER` decision is per-branch as required by the plan's own acceptance criteria (quoted in full above): the reference-only fallthrough keeps `**filed: false**` unchanged, the new write+gate branch does NOT carry it and instead constructs its response from the write's own result.

## Source Audit (no write path outside the chokepoints)

Verified by direct inspection of the diff (`git show 421dcea8`):

- The ONLY write call in the new code is `meetingNavigation.writeClaimNode(db, {...})`, the exact same function `lib/mcp/tools/claim.cjs`'s `claim_write` handler calls, which itself routes through `lib/core/node-insert.cjs`'s `insertNode` (the single node-write chokepoint).
- No `INSERT`, no `.run(`/`.exec(` literal, no `require('node:sqlite')`, no `room-db.cjs` construction anywhere in the new code.
- `lib/mcp/tools/gate.cjs` is BYTE-IDENTICAL before and after this plan (`git diff lib/mcp/tools/gate.cjs` is empty across all three commits) -- confirmed untouched, per the plan's explicit instruction.
- `grep -cE "function .*(confirm|ratify)" lib/mcp/tool-router.cjs` is **0**, unchanged from before this task (baseline measured before Task 2: also 0). No second confirm/ratify function was defined.
- Promotion to `confirmed` happens exclusively inside the pre-existing, unmodified `gate_answer` approve branch (`lib/mcp/tools/gate.cjs:242-314`), which writes a typed decision node with `SOURCED_FROM` provenance to the claim's `node_id` and promotes THAT decision node via `navigation.confirmNode` -- this plan's own new code never calls `confirmNode` and never asserts confirmation itself.

## Confirmation Proven Against room.db (Group B, recorded verbatim)

From `tests/test-276-meeting-gate-wiring.cjs`'s own GREEN run:

- **Before `gate_answer`:** `confirmed count before=0` (no node anywhere in the temp room's `room.db` has `review_status = 'confirmed'`).
- **After `gate_answer` approve:** `confirmed count after>=1` (a decision node, `SOURCED_FROM` the written claim, is now `review_status = 'confirmed'`), read independently via `node:sqlite`, never trusting the tool's own response text.
- **Second answer to the same `gate_id`:** refused with `{ ok: false, reason: 'unknown_or_expired_gate' }` (the T-198-10 single-use ledger REGRESSION PIN holds).

## Checker (`checkTree()`) Totals, Before/After This Plan (verbatim)

| | Before 276-14 (post-276-12/276-08/276-11) | After 276-14 |
|---|---|---|
| Tools / branches | 37 / 131 | 37 / 131 |
| HIGH_RISK | 0 | 0 |
| MEDIUM | 12 | 12 |
| LOW | 0 | 0 |
| UNKNOWN | 0 | 0 |
| `meeting` non-OK rows | 0 | 0 |

No row moved. The `meeting` tool's `file-meeting` branch reads OK via the reachability-first short-circuit (`classifyBranch`: a branch that reaches a real write primitive resolves `WRITES` and returns OK before any description-claim classification even runs) as well as via the tool's own retained global no-write disclaimer sentence (the `pipeline`/`speakers` siblings' safety net, unaffected by this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Markdown line-wrap defeated the plan's own `grep -c "constitutional breach"` acceptance check**
- **Found during:** Task 3 verification
- **Issue:** The pre-existing (untouched-by-this-plan) Canon Part 8 paragraph wrapped the phrase "constitutional breach" across two markdown source lines ("...a constitutional\n  breach;..."), so a literal `grep -c "constitutional breach"` returned 0 even though the phrase reads correctly when rendered. This was a PRE-EXISTING wrap (confirmed via `git show HEAD~1:references/meeting/filing-protocol.md`), not something this plan introduced, but it defeated this plan's own required verification step.
- **Fix:** Rejoined the phrase onto one source line ("...a constitutional breach;..."), no wording or meaning change, purely a line-wrap fix.
- **Files modified:** `references/meeting/filing-protocol.md`
- **Verification:** `grep -c "constitutional breach" references/meeting/filing-protocol.md` now returns 1.
- **Committed in:** `dfa6f5c2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, a pre-existing markdown line-wrap defeating this plan's own verification step)
**Impact on plan:** No scope creep -- the fix is a single line-wrap correction inside the exact paragraph this task was already editing, with zero content change.

## Issues Encountered

- The `check-tool-honesty.cjs`-style dry-run pattern (`extractClaims(description, vocabulary)` against a throwaway `node -e` call, per 276-08's own documented pattern) was used to validate the new meeting description's wording BEFORE editing the file, catching that the description's own "writes nothing itself unless..." phrasing trips the checker's `NEGATION_PATTERNS` global-cancel path exactly as the pre-existing description already did -- confirmed harmless (and in fact the safety net for the still-reference-only `pipeline`/`speakers` siblings) rather than a defect to work around.
- STATE.md's well-documented resync-clobber bug (`percent` reverting to a stale 21) struck again when running the additive `state record-metric`/`state add-decision` commands. Hand-corrected back to 90 with a dated NOTE matching the file's own established convention (see `.planning/STATE.md`, the "NOTE (276-14 execute-plan..." block); `stopped_at`/`last_activity`/"Current Position" were verified unchanged via a pre-command snapshot diff, per the 276-08/276-11 precedent (Phase 339's concurrent session legitimately owns "Current Position").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Desktop and Cowork can now reach the F.8 filing gate for a meeting-derived claim through the `meeting` tool alone (`file-meeting` with `knowledge_type`/`claim_text`), closing gap 2 of the three named in `references/meeting/filing-protocol.md:44-63`. Gap 3 (direct claim write) was already closed by 276-12. Gap 1 (the five-perspective subagent fan-out) remains STILL OPEN and structurally unreachable from MCP -- declared, not silently implied closed, in both the tool description (assertion group E) and the reference doc.
- `.planning/debug/meeting-file-meeting-false-success.md` was deliberately left in place (not moved to `resolved/`), per its own Current Focus section, for plan 276-16 to dispose of with the whole phase in view.
- `frozen_sweep.tools`/`frozen_sweep.branches` re-freeze (36->37, 130->131) remains owned by plan 276-15, unchanged by this plan (this plan added zero new tools and zero new branches -- `MEETING_COMMANDS` stayed at 3 members).
- No blockers.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Plan: 14*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: `tests/test-276-meeting-gate-wiring.cjs`
- FOUND: `lib/mcp/tool-router.cjs` (knowledge_type/claim_text params and the write+gate branch present)
- FOUND: `references/meeting/filing-protocol.md` (STILL OPEN / CLOSED by 276-14 / CLOSED by 276-12 status lines present)
- FOUND commit `4e18dc7a` (test, RED)
- FOUND commit `421dcea8` (feat, GREEN)
- FOUND commit `dfa6f5c2` (docs, filing-protocol.md update)
