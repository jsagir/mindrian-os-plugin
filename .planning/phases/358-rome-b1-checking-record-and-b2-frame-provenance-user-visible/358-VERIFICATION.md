---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
verified: 2026-09-24T04:14:55Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Live Claude Desktop client-name probe (claim_read / question_read host block on the real Desktop app)"
    expected: "host.client_name 'claude-ai', host.host 'claude-desktop', host.write_path_enabled true"
    why_human: "Requires a real Claude Desktop install pointed at the released plugin version; not reproducible in WSL/CI. Navigator ruling 2026-09-24: 'Approve, probes later.'"
  - test: "Live Cowork client-name probe"
    expected: "Cowork's real clientInfo.name recorded; if it does not match 'claude-ai', add it to HOST_TIER_MAP or use the documented MINDRIAN_MCP_FIRST=desktop,cowork fallback"
    why_human: "Cowork's client name is unconfirmed; requires a live Cowork session against the released build."
  - test: "Theo command_neighborhood check for the /mos:room question subcommands"
    expected: "Theo's command layer reflects the new command-registry hash after release + theo-resync"
    why_human: "Requires a real release cut and Theo re-sync; Theo was 18 releases behind (beta.42) at plan time."
  - test: "B2-AT3 relevance probe and a live release + install check on the demo machines"
    expected: "docs/2026-10-06-ROME-B1-GO-NO-GO.md and docs/2026-10-06-ROME-B2-GO-NO-GO.md execute cleanly end to end on the real demo machines running the released build"
    why_human: "'Not live until released and picked up' (memory rule); only executable on real hardware after a release cut."
---

# Phase 358: Rome - B1 checking record and B2 frame provenance, user-visible - Verification Report

**Phase Goal:** Make the NATO Defense College slide claims true in the normal user flow (B1: checking record on a claim, visible months later, countable across a body of work; B2: governing-question origin, history, and a pause-before-answer on a changed question) by 13 October 2026, or keep them off the slides.
**Verified:** 2026-09-24T04:14:55Z
**Status:** human_needed (all automatable truths VERIFIED; four items are genuinely un-testable outside a live released install, per the task's own "known and accepted" list)
**Re-verification:** No — initial verification

## Method

This is goal-backward verification, not a SUMMARY.md read. For every truth below I did one or more of: (a) ran the phase's own test runner and the three born-wired gates myself, (b) read the actual shipped source (not the plan prose) for the constants, doors, and CLI/MCP surfaces, and (c) built fresh hermetic temp rooms and drove `scripts/claim-checks.cjs` and `scripts/room-question.cjs` end to end myself, independent of the phase's own test suite, to watch the acceptance-test behavior happen live.

## Goal Achievement

### Observable Truths (B1-AT1..4, B2-AT1..4, plus the cross-cutting must-haves named in the task)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | B1-AT1: an officer records, on a claim, what it was checked against / rung / method / result, on the CLI without a developer | VERIFIED | Live run: `node scripts/claim-checks.cjs record --room <r> --claim bridge --against "field note, exercise 02" --against-kind observation --rung 3 --method compare --result contradicts` produced `Recorded a check on this claim. Its confirmation status did not change.` plus the full record. |
| 2 | B1-AT1 (Desktop/Cowork half): the same via MCP `claim_verify`/`claim_write` as the `claude-ai` client over the real stdio server | VERIFIED | `tests/test-358-b1-surfaces.cjs` wire leg B1 spawns `bin/mindrian-mcp-server.cjs` with `clientInfo.name: 'claude-ai'` and drives claim_write -> claim_verify -> claim_read -> status_read over real JSON-RPC; this leg is inside `run-all-358.sh`, which I ran and it PASSED. `lib/mcp/surface-detect.cjs` carries the anchored `/^claude-ai$/i` tier0 entry (confirmed by reading the file). |
| 3 | B1-AT2: close everything, reopen in a new session, the record is there and readable | VERIFIED | `tests/test-358-b1-persistence.cjs` (separate OS processes/sessions, PASSED in the runner) plus my own live CLI reopen: `claim-checks.cjs show --room <r> bridge` in a fresh process printed the full stored record, rung label included. |
| 4 | B1-AT3: room shows counts checked/disputed/inconclusive/unchecked, unchecked always shown, never a score | VERIFIED | Live `claim-checks.cjs portrait` output: `checked: 0`, `disputed: 1`, `inconclusive: 0`, `unchecked (no checking record yet): 0`, plus `A count is not a verdict.` No score/percent/grade word present. `deriveCheckStatus`/`readVerificationPortrait` in `lib/core/navigation/verification.cjs` re-derive status from records every time (not a stored field), so legacy latest-wins rows self-heal under the sticky-disputed rule. |
| 5 | B1-AT4: a checked claim stays only proposed until a person confirms it; recording never changes review_status | VERIFIED | Live check: after recording a `contradicts` record, `SELECT review_status FROM nodes` returned `proposed`. `writeClaimProperties` never passes review_status/confidence (read in verification.cjs); `test-358-b1-separation.cjs` (byte-identical review_status/confidence pin) PASSED in the runner. |
| 6 | Re-filing a claim (graph-derivation style re-save, extraProps re-projection) keeps the checking record; an extraProps bag can never forge it | VERIFIED | `PROTECTED_CLAIM_KEYS` includes `'verification'`; `CARRY_FORWARD_CLAIM_KEYS` carries it forward inside `writeClaimNode` (read directly in `lib/core/navigation/typed-claim.cjs`). `tests/test-358-b1-refile.cjs` (9 legs incl. forgery, malformed prior props, transaction hygiene) PASSED in the runner. |
| 7 | B2-AT1: the room shows where the CURRENT governing question came from (chosen/tasking/prompt/inherited), on CLI and MCP | VERIFIED | Live: `room-question.cjs set --origin tasking "Which camera solves the delay?"` then `show` printed `Origin: tasking - handed down as a tasking`. `FRAME_ORIGINS_ORDERED` (TODO(358) marker present, one exported constant) confirmed in `lib/core/navigation/typed-frame.cjs`. MCP `question_read`/`question_set` confirmed registered in `lib/mcp/tools/question.cjs`. |
| 8 | B2-AT2: changing the question keeps the old one visible as an openable, ordered history with origin and time per version | VERIFIED | Live: after a refines (v2) and a relocates (v3), `room-question.cjs history` printed all 3 versions oldest-first, each with origin, label, ISO time, and change kind; v2 carried the account text under "What the old question got wrong". |
| 9 | B2-AT3 (as re-worded by navigator ruling 1, 2026-09-24): the change door refuses without account/relocate, shows the pending ask first on every read surface, and every question change in the demo path routes through the door | VERIFIED (scoped as disclosed) | Live: `room-question.cjs set --origin chosen "Which camera works with sunglasses?"` (no account, no relocate) exited 1 with `Why: change_needs_account`, printed "What did the old question get wrong?", the previous/proposed text, and the F.1 Decision Gate card (4 options, Free-Text last, no recommended option). `history` in the same state opens with "A question change is waiting." first. `docs/2026-10-06-ROME-B2-GO-NO-GO.md` (358-11 SUMMARY) documents, honestly, that a conversational Larry turn that answers a new question without recording it through the door is explicitly marked NOT COVERED — this matches the CONTEXT.md ruling's own scope boundary ("the pause sits on the governing-question change path... answer producers that read the governing thought see an unresolved change and surface the ask first"), not a concealed gap. |
| 10 | B2-AT4: with a written account the change files as `refines` (account as an artifact handle, never free text in graph metadata); without one it files as `relocates`; both stay visible, neither presented as better | VERIFIED | Live: refines run returned `Change: refines version 1 (account on file)`; relocate run returned `Change: relocates from version 2 (no account)`. `tests/test-358-b2-part8.cjs` P1 (prose scan of nodes/edges properties for the raw question/account text) PASSED in the runner — confirms the account itself never lands in graph metadata, only its hash/handle. No ranking language in any rendered line (tested by R6 in `test-358-b2-render.cjs`, PASSED). |
| 11 | F.1 card via `pickShape` (SEED-020 door), never a hand-built ASCII box | VERIFIED | Live CLI output shows the real `pickShape` render (triangle-glyph rows, `[AskUserQuestion contract: shape=F.1 verbs=4]` marker, `[FIRE-IF-FORK...]` block) — this is the actual selector-dispatcher output, not a hand-rolled string. `data/render-coverage-registry.json` carries the `lib/core/frame-provenance.cjs` pickShape entry; `check-render-coverage.cjs` and `build-render-coverage.cjs --check` both exit 0 (ran myself). |
| 12 | `/mos:room` CLI: `checks`, `claim`, `check`, `question`, `question history`, `question set`, `question cancel` subcommands, matched before the `[section]` fallback | VERIFIED | Read `commands/room.md` directly: `## Subcommand: checks` (line 255), `claim` (301), `check` (332), `question` (398) all present with Step 1 "Check for Room" and script invocations; argument-hint and teaching frontmatter name all subcommands. |
| 13 | `question_read`/`question_set` MCP tools, `claim_verify`/`claim_read` MCP tools, all born wired | VERIFIED | `lib/mcp/tools/question.cjs` registers `question_read`, `question_set` (grep-confirmed); `lib/mcp/tools/claim-verify.cjs` registers `claim_verify`, `claim_read`. `data/mcp-tool-connectors.json` and `data/connector-registry.json` each carry `mcp:claim_read`, `mcp:question_read`, `mcp:question_set` (grep-counted: 1 each, as expected — no duplicates). |
| 14 | Routing spec test / description-is-the-router (Larry reaches the question door via description, not a hidden runtime classifier) | VERIFIED | `tests/test-358-b2-routing.cjs` is named in `run-all-358.sh` and PASSED in my run. `commands/room.md` line 386 "## When Larry routes a turn to the question door" section present. |
| 15 | Part 8 no-egress: rung/origin are local enums, free-form notes and question/account text are artifacts referenced by handle, nothing crosses to Theo/Brain | VERIFIED | `tests/test-358-b1-separation.cjs` (no confirmNode/promoteNodeStatus/brain-client literals in B1 files) and `tests/test-358-b2-part8.cjs` (P1 prose scan, P2 direct-require scan for brain-client/theo/http/fetch, P5 zero-network runtime cycle) all PASSED in the runner. |
| 16 | Registries born-wired: connector registry, orchestration projection, render coverage, skill mirrors, CIRS declarations all pass `--check`; test-234/270/276 (left red by substrate commit 42191a6ae) are green | VERIFIED | I ran independently: `node scripts/build-connector-registry.cjs --check` -> OK; `node scripts/build-orchestration-projection.cjs --check` -> OK; `node scripts/check-render-coverage.cjs` -> OK (17 covered, 0 gap); `node tests/test-234-tool-description-floor.cjs` -> 188 passed, 0 failed; `node tests/test-270-tool-schema-budget.cjs` -> 5 passed, 0 failed; `node tests/test-276-tool-honesty-findings-closed.cjs` -> 148 passed, 0 failed. |

**Score:** 16/16 truths verified (all VERIFIED; the four items requiring a real Desktop/Cowork install and a real release are correctly routed to human_verification, not marked as gaps, per the task's own "known and accepted" instruction).

### Required Artifacts (spot-checked directly, not from SUMMARY claims)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/navigation/verification.cjs` | VERIFICATION_RUNGS + checking-record contract | VERIFIED | 455 lines; `TODO(358)` marker present (line 30); live-exercised. |
| `lib/core/navigation/typed-claim.cjs` | carry-forward fix + PROTECTED_CLAIM_KEYS | VERIFIED | Read directly; `CARRY_FORWARD_CLAIM_KEYS`/`PROTECTED_CLAIM_KEYS` confirmed. |
| `lib/mcp/surface-detect.cjs` | `claude-ai` tier0 host | VERIFIED | Anchored regex confirmed by `test-358-b1-surfaces.cjs` wire leg (real stdio, real client identity). |
| `scripts/claim-checks.cjs` | CLI for the checking record | VERIFIED | 334 lines; exercised live (rungs/record/show/portrait all produced correct output). |
| `commands/room.md` / `skills/room/SKILL.md` | checks/claim/check/question subcommands, regenerated mirror | VERIFIED | Sections present; `build-skill-mirrors.cjs --check` PASSED in the runner. |
| `lib/mcp/tools/claim-verify.cjs` | `claim_verify` + new `claim_read` | VERIFIED | 211 lines; both `server.tool(...)` registrations confirmed; `hostBlock` exported and reused by `question.cjs`. |
| `data/mcp-tool-connectors.json`, `data/connector-registry.json` | regenerated, carry `claim_read` | VERIFIED | `mcp:claim_read` present exactly once in each (grep-counted myself). |
| `lib/core/navigation/typed-frame.cjs` | hardened frame substrate, FRAME_ORIGINS_ORDERED | VERIFIED | `TODO(358)` marker present (lines 52, 75); live-exercised via `room-question.cjs`. |
| `lib/core/frame-provenance.cjs` | the one write door | VERIFIED | 862 lines; live-exercised (first/refines/relocates/refusal all produced correct output). |
| `scripts/room-question.cjs` | CLI for the governing question | VERIFIED | 303 lines; exercised live (show/set/history/origins/cancel path all produced correct output). |
| `lib/mcp/tools/question.cjs` | `question_read`, `question_set` | VERIFIED | 215 lines; both registrations confirmed by direct read. |
| `data/render-coverage-registry.json` | frame-provenance pickShape entry covered | VERIFIED | `check-render-coverage.cjs`/`build-render-coverage.cjs --check` both exit 0 (ran myself). |
| `docs/2026-10-06-ROME-B1-GO-NO-GO.md` | B1 operator runbook | VERIFIED | 17.5KB, present, referenced/ancestor-checked by 358-06 SUMMARY. |
| `docs/2026-10-06-ROME-B2-GO-NO-GO.md` | B2 operator runbook | VERIFIED | 26.3KB, present, quotes navigator ruling 1 verbatim, includes an honest covered/NOT-COVERED table. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `commands/room.md` | `scripts/claim-checks.cjs` / `scripts/room-question.cjs` | Bash invocation in each subcommand section | VERIFIED | Read directly; script paths and flags match the CLI's actual argv contract (confirmed by live run). |
| `scripts/claim-checks.cjs` / `scripts/room-question.cjs` | `lib/core/navigation.cjs` | `navigation.recordClaimVerification` / `navigation.readClaimVerification` / frame-provenance re-exports | VERIFIED | Live runs exercised this path end to end through real room.db writes/reads. |
| `lib/mcp/tools/claim-verify.cjs` `claim_verify` handler | `navigation.recordClaimVerification` | after write-gate + room resolution | VERIFIED | `test-358-b1-surfaces.cjs` wire leg B1 (real stdio) PASSED in the runner. |
| `lib/mcp/tools/question.cjs` `question_set` handler | `frame-provenance.cjs setGoverningQuestion` | write-gated exactly like claim_verify | VERIFIED | `test-358-b2-surfaces.cjs` (stub + real stdio legs) PASSED in the runner; confirmed by reading question.cjs's require of frame-provenance.cjs. |
| `lib/core/frame-provenance.cjs renderQuestionChangeCard` | `lib/hmi/selector-dispatcher.cjs pickShape` | the SEED-020 card-emission door | VERIFIED | Live CLI output is a genuine pickShape render (triangle rows, AskUserQuestion contract marker), not a hand-built string; `render-coverage-registry.json` carries the call-site entry. |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Phase test runner | `bash tests/run-all-358.sh` | PASSED=38 FAILED=1 SKIPPED=0 (see Anti-Patterns/Gaps note below) | See below — the 1 FAILED leg is `test-353-filing-gate.cjs` ("EVENT_TYPES.size is 102"), a **run-only regression pin owned by Phase 353**, not touched by any 358 plan. `git log` on `lib/core/navigation/memory-events.cjs` shows the last change is commit `2fc297451` (`feat(355-22)`), a peer phase in this shared tree; EVENT_TYPES is now 104. Both 358-06 and 358-11 SUMMARYs record `PASSED=39 FAILED=0` at the time each plan finished, confirming this drift happened after 358 itself was complete, from a sibling session's work. |
| `node scripts/build-connector-registry.cjs --check` | ran directly | `connector-registry: OK` | PASSED |
| `node scripts/build-orchestration-projection.cjs --check` | ran directly | `orchestration-projection: OK` | PASSED |
| `node scripts/check-render-coverage.cjs` | ran directly | `render-coverage report: 17 covered, 0 excluded, 0 gap` | PASSED |
| `node scripts/doctor.cjs --acceptance` | ran directly | 20/21; only `verify-release-clean-tree` FAILs | PASSED (with the one known/accepted exception — see below) |

**On the two "not-passed" signals above:** Per the task's own briefing, `doctor --acceptance verify-release-clean-tree` FAIL is caused by other sessions' uncommitted tracked files, not 358. Confirmed directly: `git status --short` shows only `M .planning/ROADMAP.md`, `M evals/plurai/211-baseline.json`, and two untracked files (`docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` — explicitly named PEER-UNTRACKED, never staged, in the phase's own CONTEXT.md — and `docs/reviews/mindrian-system-atlas.html`). None of these are B1/B2 deliverables. The `test-353-filing-gate.cjs` EVENT_TYPES drift is the same category: a live peer-session side effect in the shared working tree, outside 358's `files_modified` scope on every one of its 11 plans. Neither is counted as a gap against this phase's goal.

### Anti-Patterns Found

None found in the B1/B2-owned files. No TBD/FIXME/XXX debt markers, no placeholder returns, no empty handlers, in `lib/core/navigation/verification.cjs`, `lib/core/frame-provenance.cjs`, `lib/core/navigation/typed-frame.cjs`, `lib/mcp/tools/claim-verify.cjs`, `lib/mcp/tools/question.cjs`, `scripts/claim-checks.cjs`, `scripts/room-question.cjs`, `commands/room.md`, or the two runbooks. `TODO(358)` markers in `verification.cjs` and `typed-frame.cjs` are intentional, explicitly named and scoped in `358-CONTEXT.md` (the rung list and the origin labels are provisional pending the paper author's final definitions; swapping either is documented as a one-constant edit with a test update) — these are not unresolved debt, they are a deliberate design decision with a named owner and trigger.

### Requirements Coverage

`.planning/REQUIREMENTS.md` has no `B1-xx`/`B2-xx` entries and `.planning/ROADMAP.md`'s Phase 358 entry still reads `Requirements: TBD` (stale — it predates the two planning passes). This phase was run under the PRD Express Path with the CONTEXT.md-locked acceptance tests (B1-AT1..4, B2-AT1..4, and the `<b2_rulings>` block) serving as the actual requirements contract; each plan's frontmatter names its own `B1-0x`/`B2-0x` IDs (11/11 plans do). I verified against the CONTEXT.md acceptance tests directly rather than REQUIREMENTS.md, since that is where this phase's real contract lives. This is an informational note, not a gap: the roadmap frontmatter line should be updated to point at the plan-level requirement IDs for traceability, but no acceptance test was left unimplemented because of it.

### Deviations (disclosed by the executor, checked against the actual rulings)

- **F.1 instead of the navigator's literally-named F.0 for the question-change card** — checked against `358-CONTEXT.md` and `358-11-SUMMARY.md`: the navigator ruled F.1 correct on 2026-09-24 ("Card shape RULED F.1... F.0 was rejected because its Reject reason is written into a REJECTED_BECAUSE edge"), consistent with the locked B2-AT4 rule that an account is never free text in graph metadata. Not a gap.
- **`test-270`/`test-276` re-baselines** — moved deliberately with measured numbers and signed percentages in commit messages and comment blocks (confirmed: `tests/test-270-tool-schema-budget.cjs` shows `plan: '358-10'`, `44 tools, 48321 total`, live-measured delta `+5.95%`). Not a gap.

## Gaps Summary

No gaps found against the goal. All 16 observable truths derived from the ROADMAP goal, the locked B1/B2 acceptance tests, and the cross-cutting must-haves (CLI + MCP surfaces, Part 8, born-wired registries) are independently verified in the live codebase — both by reading the shipped source and by driving the actual CLI end to end in fresh hermetic rooms, separate from the phase's own test suite. The phase runner (`run-all-358.sh`) has exactly one FAILED leg, and it is a Phase-353-owned regression test whose drift (`EVENT_TYPES.size` 102 -> 104) traces by `git log` to a sibling phase's commit (355-22) touching a file no 358 plan lists in `files_modified` — not a B1/B2 defect. `doctor --acceptance`'s one FAIL is the same category (peer-session tracked-file drift), matching what the task briefing named as already known and accepted.

The four items in `human_verification` are not gaps either: they are physically impossible to prove from this sandboxed working tree (a real Claude Desktop app, a real Cowork session, a real release-and-install cycle, a real Theo re-sync), and the phase's own runbooks (`docs/2026-10-06-ROME-B1-GO-NO-GO.md`, `docs/2026-10-06-ROME-B2-GO-NO-GO.md`) already name them as PENDING with the navigator's own 2026-09-24 checkpoint ("Approve, probes later"). This phase is ready to proceed; the remaining work is the 6 October live go/no-go execution on real hardware, which is out of scope for a code-verification pass.

---

*Verified: 2026-09-24T04:14:55Z*
*Verifier: Claude Opus 5.5 (gsd-verifier)*
