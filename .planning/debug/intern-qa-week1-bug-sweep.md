---
status: gathering
kind: qa-sweep
trigger: "intern-qa-week1-bug-sweep"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3]
created: 2026-07-11T00:00:00Z
updated: 2026-07-15T00:00:00Z
---

## Purpose
<!-- OVERWRITE on each update - reflects NOW -->

Concrete, reproducible-shaped defects surfaced by the weekly JHU intern QA program (v1.15.3-beta.10/12). Each intern runs a live session with Larry, then pastes Larry's OWN unfiltered self-QA prompt back verbatim (Part B of the two-part QA design; see sibling file `intern-qa-week1-behavior-findings.md` for the human-side Part A synthesis and cross-session pattern analysis). This file is the bug-shaped subset: each row below traces to a specific tool call, hook, or code path Larry names in his own self-report.

This is `kind: qa-sweep`, not a single-bug session - 8 distinct candidate defects across 2 intern sessions plus 1 first-hand repro. `status: gathering` because none of these have had code-level root-cause investigation yet - this file is the intake, not the diagnosis. A later `/gsd:debug intern-qa-week1-bug-sweep` pickup should read each row, open the named file/function, and either confirm + classify (WORKING / already-tracked BUG N / ENV GAP / NEW FAILURE) or fold duplicates together.

next_action: run `/gsd:debug intern-qa-week1-bug-sweep` to begin code-level investigation, starting with Bug H (self-reproduced, fastest to confirm) and Bug D/Bug B (state-integrity, highest severity - Larry told two different users false things about system state).

## Source Evidence

Not a live test protocol - this is retrospective evidence extraction from two intern QA emails already received this week. Real names withheld per house rule (see `~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`, tracked separately - a room artifact, not this repo).

- **Intern-1** (student gate, consulting-track exercise): pasted Larry's unfiltered Part B self-QA verbatim, unedited, per the assignment's required format.
- **Intern-4** (researcher gate, CV/career-fit exercise): pasted Larry's unfiltered Part B self-QA verbatim (a document titled "CV Project - Session QA (Self-Assessment)"), unedited.
- Bug H below is NOT from an intern - it is a first-hand repro hit by the filing agent this same session while switching MindrianRooms active-room context.

Both interns' plugin version: v1.15.3-beta.10 as assigned; Intern-1's thread shows a same-week bump to beta.12 mid-week (confirmed as an intentional bug-fix bump, not a regression, per the sent-mail reply in that thread).

## Results (Component Health Matrix)

| Row | Component / Surface | Found | Class |
|-----|---------------------|-------|-------|
| A | Decision-gate card firing - mode-selection gate (`Just Talk / Explore+Capture / Build a Room`) | Skipped entirely at session start on a session-start hook instruction; the usual stop-hook catch that fired for 2 OTHER missed gates in the SAME session did not fire for this one | NEW FAILURE |
| B | `room_state` tool / status command | Returned "No room initialized" against a room directory that has real content on disk | NEW FAILURE |
| C | Decision-gate card firing - mid/late-session forks | 3 of 4 genuine two-option forks in one session rendered as flat prose instead of an AskUserQuestion card (turns 2, 3, 5); zero were caught by a stop hook or self-corrected (contrast Row A's session, where 2 of 3 misses WERE caught) | NEW FAILURE |
| D | `rooms-new` orchestration call | Called with name `cv-project`; created NO directory, NO registry entry (confirmed: "No registry exists on this machine"), returned the pre-existing legacy `room/` instead, but Larry reported "Room's live - cv-project is your active Data Room" as fact for 5 turns before a file-path check caught it | NEW FAILURE |
| E | Statusline / active-room-name reporting | Startup hook reported active room name as `"room"`; Larry told the user `"cv-project is your active Data Room"` in the same session - a direct contradiction between what the hook surfaced and what Larry claimed, never reconciled during the session | NEW FAILURE |
| E2 | Statusline visibility (separate from E) | Human-side report: statusline "was not being displayed consistently" early in the session, then "started appearing correctly" after the user asked Claude Code to fix it mid-session - a distinct visibility glitch from the wrong-room-name content bug in Row E | NEW FAILURE |
| F | `compute-state` / STATE.md freshness | A file was filed into `room/market-analysis/research-pm-role-outlook.md`; `compute-state` (or equivalent STATE.md recompute) was never re-run afterward; Larry then claimed "your room moved forward" while STATE.md did not reflect the new file | NEW FAILURE |
| G | `intelligence:research` / `deep_research` MCP reach | Fired once; instead of executing web fetches, it returned its own command/tool spec back as the result. Larry fell back to a manual WebSearch to recover. Named explicitly by Larry as "the tool itself needs a bug report" | NEW FAILURE |
| H | `skills/rooms/SKILL.md` script path (self-reproduced, not intern-reported) | `SKILL.md` documents every subcommand as `bash scripts/room-registry <cmd>` (also `resolve-room`, `compute-state`, `update-icm-index`, `git-ops`), implying `scripts/` is local to the skill directory. Repro: `cd <plugin>/skills/rooms && bash scripts/room-registry list` -> `bash: scripts/room-registry: No such file or directory`, exit 127. The script only exists at the plugin ROOT: `<plugin-root>/scripts/room-registry` (confirmed via `find <plugin-root> -iname "room-registry*"`, single match). Every documented invocation in that SKILL.md silently depends on cwd already being the plugin root, which is not guaranteed when the skill runs as a subroutine from elsewhere | NEW FAILURE |

Severity note: Rows B, D, E, and F are grouped as the highest-severity cluster - each is Larry stating a false claim about system/room state as fact, to a real user, and having it survive multiple turns undetected. Row H is the only row with a clean, deterministic repro command and exit code; recommend investigating it first to validate the file/fix loop before tackling the harder state-integrity rows.

**Rows I-M added 2026-07-15 from Intern-3's (researcher gate) Part B self-QA, three separate sessions - the outstanding report this file's original Non-Code Follow-ups section flagged as still pending. Intern-2 (venture gate) remains outstanding.**

| Row | Component / Surface | Found | Class |
|-----|---------------------|-------|-------|
| I | Decision-gate card firing - large content commitments | Two Vercel-build turns (a full site rebuild, a 48-team bracket page with an invented 4-tier subjective classification) shipped with ZERO gates attempted at all - not a flat-text miss, no checkpoint was even attempted before real editorial judgment got baked into a public page | NEW FAILURE |
| J | Voice Signature / glyph discipline (Part 12) | The mandatory single-glyph turn-opener dropped repeatedly, but only on tool-heavy turns: two find-analogies replies opened with a `[DECOMPOSE]` block before the glyph, one turn's glyph appeared very late, a full-site-update turn only glyphed at the very end, and a card-firing turn opened straight into the tool call with no glyph at all. Held perfectly on a third session with no tool-heavy front-loading. Self-named mechanical trigger: "when I front-load a lot of Bash/Read/Write calls before writing prose, the glyph discipline is the first thing that drops" | NEW FAILURE |
| K | Reach/dial machinery engagement | One full session (3rd of 3 reported) made ZERO calls to any reach machinery - no `room_state`, `room_graph`, Brain consult, or dial - direct Bash/Write/WebSearch used instead throughout; self-flagged as "a real gap, not a stylistic choice" given the system prompt's own claim the machinery is shipped and should be driven, not future work | NEW FAILURE |
| L | Silent tool-fallback disclosure | A Vercel MCP deploy-tool failure was worked around via `npx vercel@latest` without clearly flagging that the primary/native path had failed - same shape as Row G (this file) and the David-session Python-to-Node swap, a third independent instance of undisclosed dependency-fallback | NEW FAILURE (same shape as Row G) |
| M | Session-state assumption without verification | A repeat F.8 room-bind AskUserQuestion card was answered "already bound this session, no need to re-ask" from Larry's own remembered context, not from checking any actual bind-state artifact - if the underlying session state had genuinely reset, this would have been a wrong answer proceeding on unverified memory, same "trust without verify" shape as Rows B/D/F but the untrusted source is Larry's own memory, not a tool's return value | NEW FAILURE |

Also self-flagged by Intern-3, not yet rows (methodology/quality concerns, not tool-state bugs): a StatsBomb hub-concentration formula was re-derived from prose in `VARIABLES.md` and used in a cross-team comparison without ever validating it reproduces the one pre-existing number (Belgium's) it should match, risking an undisclosed apples-to-oranges result; self-applied "VERDICT"/"CLOSED" labels stronger than an n=2 result earns; a `mos:framework-runner` Agent dispatch failure (worktree error) was disclosed but glossed in one line rather than flagged as a possible system-wide break. Two of three sessions independently reported card-discipline misses on Larry's own *organic* "what's next" turn-closings specifically (not command-internal gates) - Intern-3's own characterization is the sharpest yet: "I fire the card reliably when a command's own skill file explicitly instructs it... but I don't fire it reliably on my own organic closings - exactly the failure mode the hook exists to catch, and it only caught one of three." This sharpens Rows A/C rather than adding a new row.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none yet - no investigation has started)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-1's pasted Part B self-QA (verbatim email content, not summarized)
  found: "Mode selection gate ... I skipped it entirely ... One [gate] I missed entirely and the hook didn't catch it either." Also: "room_state status returned 'No room initialized' even though the room directory has files."
  implication: Rows A and B confirmed as Larry-self-reported, not intern speculation.

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's pasted "CV Project - Session QA (Self-Assessment)" (verbatim email content)
  found: "I fired exactly ONE real AskUserQuestion card (turn 1) ... three more choose-one forks were posed as flat prose"; "`rooms-new` with name 'cv-project' did NOT create a cv-project directory ... No registry exists"; "the startup hook reported the active room name as 'room', yet I told the user 'cv-project is your active Data Room'"; "I wrote market-analysis/research-pm-role-outlook.md into room/ but never re-ran compute-state"; "the deep_research reach ... returned its own command spec instead of executing web fetches."
  implication: Rows C, D, E, F, G confirmed as Larry-self-reported in a single session, all traceable to named tool/hook behaviors.

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's Part A (human-side) answers, independently
  found: "Earlier, it was not being displayed consistently on the screen, but after asking Mindrain (or Claude) to fix the issue, it started appearing correctly."
  implication: confirms Row E2 as a real, human-observed glitch distinct from Row E (which the human did NOT notice, since the line was visible and looked plausible even while wrong).

- timestamp: 2026-07-11T00:00:00Z
  checked: `cd ~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.12/skills/rooms && bash scripts/room-registry list`
  found: "bash: scripts/room-registry: No such file or directory", exit 127. `find <plugin-root> -iname "room-registry*"` returns exactly one hit, at `<plugin-root>/scripts/room-registry`.
  implication: Row H confirmed first-hand, deterministic, plugin-version-current (beta.12) at time of filing.

- timestamp: 2026-07-15T00:00:00Z
  checked: Intern-3's (researcher gate) pasted Part B self-QA, three separate sessions this week, forwarded via email and transcribed into `~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`'s Intern-3 row same day.
  found: Session 1 - "the full-site-update turn and the 48-team bracket page had zero gates of any kind... a bigger [miss] - no gate was even attempted." Session 2 - "I fire the card reliably when a command's own skill file explicitly instructs it... but I don't fire it reliably on my own organic 'what's next' closings." Session 3 - "Zero calls to the actual reach machinery... I did the work as direct Bash/Write/WebSearch instead of routing through the declared spine... that's a real gap, not a stylistic choice." Also, all three sessions: "I can't actually answer this one honestly in the affirmative - I have no visibility into a rendered statusline artifact in this session."
  implication: New rows I/J/K/L/M added above. Confirms Rows A/C's card-discipline-decay pattern a 3rd time (of 4 assigned interns), sharpens its boundary (organic closings vs. command-instructed gates), and adds two failure shapes not previously seen in this file: total non-engagement with the reach/dial machinery for a full session (Row K, distinct from David's *failing* resolver call - this is *zero* calls), and the glyph-discipline-drops-on-tool-heavy-turns pattern (Row J, a Part 12 voice-signature violation with a self-identified mechanical trigger, not seen in any prior intern report).

## Technical Root Cause

PENDING - status is `gathering`, not `investigating`. No code has been opened yet for any row. This section is intentionally left for the `/gsd:debug` pickup session; do not fabricate a root cause here.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

PENDING - populate during investigation, per row, once each is confirmed against the actual code path.

## Tests to Add or Update

PENDING - populate during investigation. Candidate coverage once root causes land:
- Row H: a smoke test that runs every `bash scripts/...` line documented in `skills/rooms/SKILL.md` from a cwd other than the plugin root, asserting exit 0.
- Rows D/F: an integration test that asserts `rooms-new` either creates a real, verifiable directory + registry entry, or returns a failure Larry cannot mistake for success - and that any room-mutating write triggers a STATE.md recompute before the turn ends.
- Row B: a test that a room directory with content never reports `room_state: "No room initialized"`.
- Rows A/C: a test harness that counts AskUserQuestion card fires vs. flat-prose forks across a multi-turn scripted session, asserting the ratio does not degrade after turn 1.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add Fixed entries once each row's fix ships.
- knowledge-base.md: add a summary block per resolved row (or one block if multiple rows share a root cause).
- Cross-reference: Intern-3's (researcher gate) report landed 2026-07-15 - folded above as Rows I-M plus an Evidence entry. Intern-2 (venture gate) remains outstanding as of this update.
- Sibling file: `.planning/debug/intern-qa-week1-behavior-findings.md` carries the cross-session behavioral pattern analysis (card-discipline decay, state-claim-without-verification pattern) that motivates prioritizing Rows A/C and B/D/F as a linked cluster rather than 8 unrelated one-offs.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: PENDING
fix: PENDING
verification: PENDING
files_changed: []
commits: []
