# 369 Manual Verification Record (plan 369-30, Task 3)

Date of the navigator's verification: 2026-10-04.
Requirements: SHELL369-11 (click test), CANON369-07 (visual review), SHELL369-09 (Desktop and Cowork line), CANON369-03 (session indicator co-design), BAKE369-04 (Decision Gate).
Rule: these are the checks only a person can make. The automation (journey, CANON369 checks C1 to C11) passed first and does not stand in for them.

## The navigator's verdict, verbatim

> approved

Given on 2026-10-04 through the orchestrator's AskUserQuestion card (options: approved / approved with notes / issues found). No notes were added. No host build numbers (Claude Code, Claude Desktop, Cowork) were reported: not reported.

What the navigator was shown, and nothing beyond it is claimed here:

- The signed-in navigator-mode window: `node tests/e2e-369/journey.cjs --navigator`, shell at http://127.0.0.1:38625, gate `/gate/gate-b112867575b04fbe` on a throwaway fixture room (`room-x`). Expected and shown as the flow to press: "Decision recorded in the room." then the Settled state "Confirmed by you", without a reload; a document holding hostile markup rendered inert.
- The 31 screenshots under `tests/e2e-369/output/screenshots/` (every view and gate state at 1280 px and 390 px), with the two composition items plan 29 flagged: at 390 px the "Stay here" action wraps to two lines, and the Work screens collapse the 8+4 layout to one column.
- The two D-03 sentences for Cowork and Desktop (below).

## Click test

Result: approved (2026-10-04).
Surface: the shipped shell (`lib/ui-shell/dist`, started through `lib/ui-shell/launch.cjs`) in a navigator-mode browser window on the fixture room `room-x`. The real-room mtime check was not applicable: a fixture room was used, no real room was copied, and the navigator did not ask for a real-room copy.
Navigator's words: "approved". No further words recorded.
Automated companion (not a replacement): `tests/e2e-369/journey.cjs`, gate click to recorded 81 ms, restart catch-up 2857 ms, lost writes 0 (369-COUNTER-METRICS.md, "Gate latency and recovery (CM369-03)").
Note on how the gate was raised: see Gaps item 1. In navigator mode the gate was raised by the harness calling the shell's `askClaude` action with `MOS_PROPOSAL_SOURCE=adapter`; the browser itself has no control that raises a gate.

## Visual review against Canon v3

Result: approved (2026-10-04).
Screenshot set used: the 31 captures in `tests/e2e-369/output/screenshots/` from plan 29's `egress-and-canon.cjs` (15 screens at 1280 px and 390 px: rooms list, Work first visit, Work with changes, Evidence with a document open, Decisions, Deliverables with a document open, Graph, Status panel, room-switch dialog, gate ready, saving, recorded approve, recorded reject, stale_subject refusal, persistence failure).
Issues named by the navigator: none.
Composition items put to the navigator and accepted by the approval, no change requested: (a) at 390 px the "Stay here" action wraps to two lines; (b) the Work screens collapse 8+4 to one column. These stay as observations, not gaps.

## Desktop and Cowork line (D-03)

Result: approved (2026-10-04) on the two sentences as shown.
Ruling the Desktop result was judged against (369-LAUNCH-RULING.md): `Desktop delivery: room_list tool description`. No "D-03 amendment:" line exists, so the exact two sentences are required on both surfaces:

> "This runs on your machine from Claude Code. Open Claude Code on this computer and run /mos:dashboard shell to see your room in the browser."

- Cowork: approved on the two sentences. Host build number: not reported.
- Claude Desktop: approved on the two sentences (room_list tool description delivery). Host build number: not reported.
- On both surfaces nothing simulates running the workspace.

MCPV2-13's human Claude Desktop smoke remains owed by the Phase 267 follow-ons and is not this phase's gate.

## Session indicator co-design

Pointer: `369-SESSION-INDICATOR-DESIGN.md` (signed design note, D-04, CANON369-03). Navigator's answers dated 2026-10-03: "Q1 A, Q2 B, Q3 B, Q4 A". Built by plan 24 from that note. Not re-litigated in this verification.

## Bake-off Decision Gate

Pointer: `369-BAKEOFF-DECISION.md` (BAKE369-04, D-07). Navigator's ruling dated 2026-10-03: "workroom (Recommended)", with the default transplants; the RULE 8 ruling of 2026-10-03 (plan 19) is recorded in the same file. Not re-litigated in this verification.

## Gaps for /gsd-plan-phase --gaps

Both were found by the automated journey (plan 30 Task 1), not by the navigator. The navigator's approval did not address them; they are recorded as facts for the gap planner. Owning plan: 369-30 found them; the fix belongs to the shell plans that own the gate hop (plan 25 to 28 area) or to a gap-closure plan.

1. The shipped shell has no browser control that raises a gate. The `askClaude` action exists, but nothing in `ui/shell/client` calls it. A default `launch.cjs start` runs with `MOS_PROPOSAL_SOURCE=fixed`, so the action answers `no_proposal`. The ADAPTER-RULING's hop "the shell raises the gate on the browser session" is therefore not built. The journey and the navigator mode set `MOS_PROPOSAL_SOURCE=adapter` and call the action directly. Consequence: a person using the shipped shell as launched cannot start the Approve flow from the browser alone.

   Closed 2026-10-04 by plans 369-40, 369-42, 369-43, 369-44 and 369-46: Evidence now carries the Ask Larry control (plans 43 and 44), the shell lists and answers a gate raised in Claude Code (plans 42 and 44), and the launcher arms the sign-in through the control channel (plan 40). Proven by the journey at 369-46, step 4 (decide through Ask Larry, no act('askClaude') call remains) and step 5 (a gate raised from the CLI path, answered in the browser). Measured over ten consecutive non-void runs (369-COUNTER-METRICS.md, "Gap closure counts"): gate_click_to_recorded_ms median 66.5 (53 to 115), raised_to_listed_ms median 809 (681 to 825), lost_writes 0, answered_elsewhere_replays 1 in every run. Navigator's verdict on both flows: approved (see "Gap closure verification" below).

2. After a shell restart, the browser shows "This decision is no longer open... Nothing was saved. Ask Larry in Claude Code to raise it again." for an old gate id, rather than "This decision was already recorded." The shell keeps gate records in memory, so a page-side `approveDecision` on the old id is refused `human_only` and writes nothing. The room itself replays correctly: `gate_answer` on the old id returns `ok: true, replayed: true` and still exactly one node. No decision is lost or duplicated; the wording the person sees is the gap.

   Closed 2026-10-04 by plans 369-42, 369-44 and 369-46: after both servers restart, the old gate id reads "This decision was already recorded." in the browser. Proven by the journey at 369-46, step 7 (restart and recover): the old gate id asserts that sentence, offers nothing to answer, the browser re-answer is refused with nothing written, and the room replays it with replayed true and one node. Measured over ten consecutive non-void runs: this assertion held in all ten, restart_catch_up_ms median 2805 (2793 to 2815), lost_writes 0.

## Gap closure verification (2026-10-04)

Plan 369-46, Task 2 (checkpoint:human-verify) and Task 3. The two old gaps above are the subject; the navigator judged the two new flows and the CR-01 behaviour of `/mos:dashboard shell`.

### The navigator's verdict, verbatim

> approved

Given on 2026-10-04 through the orchestrator's AskUserQuestion card (options: approved / approved with notes / issues found). No notes were added. Issues named: none.

### What the navigator was shown, and nothing beyond it is claimed here

1. The navigator-mode window: `node tests/e2e-369/journey.cjs --navigator`, shell at http://127.0.0.1:44577, throwaway fixture room `room-x` in a temporary home, the gate raised from the CLI path at `/gate/gate-64425c9e0a0bcf55`, claim `claim:journey-prop-navigator-cli:cd3150d`.
2. Flow 1, Decisions: one row under "Waiting for you" reading "Raised by Larry outside this browser.", the provenance line, the recommendation (Approve) checked, then "Decision recorded in the room."
3. Flow 2, Evidence: "Ask Larry about this", "Copy the line", "Check for Larry's proposal", the no-proposal copy, the arrival announcement after about 15 seconds, then the gate opening with the recommendation checked.
4. The window closed, then `/mos:dashboard shell` in the navigator's own Claude Code, with no link and no code in the conversation and the browser opening signed in.

Host build numbers: Claude Code build: not reported.

### Automated companion (not a replacement)

`tests/e2e-369/journey.cjs`, eight steps, ten consecutive non-void runs, 2026-10-04: gate_click_to_recorded_ms median 66.5, raised_to_listed_ms median 809, restart_catch_up_ms median 2805, lost_writes 0 in every run, answered_elsewhere_replays 1 in every run (369-COUNTER-METRICS.md, "Gap closure counts (2026-10-04, plans 369-33 to 369-46)").
