---
status: gathering
kind: qa-sweep
trigger: "intern-qa-week1-behavior-findings"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3, 12]
created: 2026-07-11T00:00:00Z
updated: 2026-07-15T00:00:00Z
---

## Purpose
<!-- OVERWRITE on each update - reflects NOW -->

Cross-session behavioral and UX patterns from the weekly JHU intern QA program (v1.15.3-beta.10/12), distinct from the individually-reproducible defects filed in the sibling file `intern-qa-week1-bug-sweep.md`. That file lists WHAT broke; this file is about the PATTERN across independent sessions and what it says about the QA method itself, Larry's persona/tone discipline, and which behaviors are working and must be protected, not just which are broken. As of 2026-07-15 this covers 5 independently-QA'd sessions across 3 of the 4 assigned interns (Intern-1 one session, Intern-4 one session, Intern-3 three sessions) - see Evidence for the running tally. Intern-2 has not yet reported.

The QA design under test: each intern answers Part A (their own human-side observations, from memory, before talking to Larry about it) then separately pastes Larry's own unfiltered Part B self-QA verbatim. The two are sent back unmerged specifically so mismatches between "what the human noticed" and "what the system says about itself" are visible. This file's core finding is that the design is working exactly as intended.

next_action: Intern-3 (researcher gate) reported back 2026-07-15, three sessions, confirming Finding 1 and Finding 2 a 3rd time (of the 4 assigned interns) - both are promoted to `intern-qa-week1-bug-sweep.md` as Rows I-M per this file's own prior instruction, since a 3rd independent session reproduced the same shape. Intern-2 (venture gate) remains outstanding; hold this file's final status (resolved vs. still-gathering) until that report lands too.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.10 (assigned), one session bumped mid-week to beta.12 (confirmed intentional bug-fix bump)
- Reported by: 2 of 4 JHU interns (pseudonymized Intern-1, Intern-4), relayed via Jonathan Sagir
- Date first observed: 2026-07-07 (Intern-4 session date, per her Part B document date)
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (the reproducible-defect sibling; read together)

## Findings

### Finding 1: Card discipline decays within a session, and the stop-hook safety net is unreliable, not just imperfect

Session 1 (Intern-1, student/consulting track): 2 of 3 missed AskUserQuestion cards were caught and re-fired by the stop hook; 1 (the mode-selection gate) was missed entirely and the hook did not catch it either.

Session 4 (Intern-4, researcher/CV-career track): 3 of 3 missed forks after a correct turn-1 card were NOT caught by hook or self-correction - a worse hit rate than session 1, despite a strong first impression.

Neither intern's human-side Part A report flagged card/menu problems at all - both independently said menus felt fine or even praised the early clickable-menu experience. The gap between "the human perceives it as fine" and "Larry's own QA finds a majority-miss pattern in the same session" is precisely the signal the Part A/B split was designed to surface, and it surfaced it independently in both sessions received so far.

### Finding 2: Larry states unverified system/tool state as fact, and it survives multiple turns before something external forces a check

Intern-1: `room_state` falsely reports "No room initialized" against a room with real content; Larry worked around it silently rather than treating the false report itself as a signal worth surfacing.

Intern-4: `rooms-new` silently failed (no directory, no registry) but Larry reported the room as "live" for 5 turns before a file-path check - forced by an unrelated filing task, not by suspicion - caught it. Separately, Larry claimed "your room moved forward" after filing evidence, without having recomputed STATE.md to check.

Common shape across both: an orchestration or tool call returns a success-shaped (or silently-wrong-shaped) result, and Larry forwards that claim to the user as fact without independently verifying it against the actual filesystem/state - until some unrelated later action forces the check. This is a pattern, not a coincidence of two unrelated bugs: both are "trust the tool's apparent success, don't verify" failures.

### Finding 3: Unprompted positive signal worth protecting as a baseline (not a bug, a regression risk)

Both interns independently volunteered specific praise, unprompted:
- Intern-4: contrasted current source-cited research output against prior sessions where "information from multiple websites" was "merged... into a single narrative without clearly distinguishing the sources" - explicitly named the newer clear-attribution behavior as a trust improvement.
- Intern-1: praised that Larry "consistently asked follow up questions about my background, experiences, and career goals," which "tailored" advice rather than giving generic output.

Neither of these should regress as a side effect of fixing Findings 1-2. Flag for whoever picks up the sibling bug-sweep file: verify research-sourcing and adaptive-questioning behavior stays intact after any fix that touches the research reach (Row G in the sibling file) or the persona/response layer.

### Finding 4: Persona and tone held up; the only drift was response length on deliverable-heavy turns

Both sessions: Larry's own QA and the human side agree tone stayed warm/consistent, no framework-dumping, no compliment-fishing. The one self-flagged (not human-flagged) miss in both sessions: 1-2 turns ran past the persona's 3-8 sentence default length, justified by the deliverable but not earned by a prior exchange per the persona's own stated rule. Low severity, consistent across both sessions - worth a light-touch check, not a priority fix.

### Finding 5: Glyph discipline (Part 12 voice signature) drops specifically on tool-heavy turns, with a self-identified mechanical trigger (new, from Intern-3)

New pattern, not present in the Intern-1/Intern-4 evidence above (neither reported a glyph problem). Intern-3's Part B across three sessions: the mandatory single-glyph-at-turn-start rule broke on any turn that front-loaded several Bash/Read/Write tool calls before writing prose - the glyph either appeared very late, was buried after a different opening block (`[DECOMPOSE]`), or was skipped entirely. Held perfectly on the one session with no such front-loading. Self-named the mechanism directly: "when I front-load a lot of tool calls before writing prose, the glyph discipline is the first thing that drops." This is a mechanical, repeatable trigger condition, not a random miss - a stronger claim than a one-off persona drift.

### Finding 6: Reach/dial machinery can go completely unengaged for a full session, not just fail when called

Distinct from the David-session finding already filed in `interns-round-eureka-david-session-2026-07-14.md` (where `resolve-room` returned `EXIT:1` for the whole session - a failing call). Intern-3's third session made zero calls to any reach machinery at all (no `room_state`, `room_graph`, Brain consult, or dial) and ran entirely on direct Bash/Write/WebSearch instead - self-flagged as "a real gap, not a stylistic choice" against the system prompt's own claim that this machinery is shipped and should be driven, not treated as optional. A second, milder instance in Intern-3's second session: only one reach fired all session (and it was stale/ignored), everything else ran `fire_skill: null` / `routing_source: legacy`.

## Recommendation

The Part A / Part B split QA design is working exactly as designed and should continue unchanged through the remaining 1 intern (Intern-2) before any methodology change. In 3 of 3 interns reported so far (5 sessions total, since Intern-3 sent three), it surfaced state-integrity, card-discipline, and now persona/voice-signature and reach-engagement defects that were invisible to the human-side report alone - Intern-3's own cover note is a clean instance of this: entirely procedural/positive, surfacing none of Findings 1-6 itself. Findings 1 and 2 are now confirmed by a 3rd independent session (promoted to `intern-qa-week1-bug-sweep.md` Rows I-M) and should be treated as confirmed platform-wide patterns, not just high-priority candidates. Findings 5 and 6 are new as of this update and have only one intern's evidence behind them (three sessions, but one person) - treat as a strong candidate pattern, not yet confirmed at the same bar as Findings 1-2, until Intern-2's report either reproduces or doesn't.

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-1 Part A (human-side) vs Part B (Larry self-QA), same session
  found: Part A never mentions any card/menu problem; Part B admits 1 gate skipped uncaught + 2 caught-by-hook.
  implication: confirms the human-invisible / system-visible mismatch pattern, instance 1.

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4 Part A vs Part B, same session
  found: Part A says menus "felt very useful" and statusline "started appearing correctly"; Part B admits 3 of 4 forks rendered as flat prose uncaught, and the statusline was showing the wrong room name the whole time, unverified.
  implication: confirms the human-invisible / system-visible mismatch pattern, instance 2 - and shows it can coexist with a human belief that a problem was "fixed" when it was not.

- timestamp: 2026-07-15T00:00:00Z
  checked: Intern-3 (researcher gate) Part B, three separate sessions, cross-referenced against his cover-note summary
  found: Session 1 - two large public-page commits with zero gates attempted. Session 2 - "I fire the card reliably when a command's own skill file explicitly instructs it... but not on my own organic closings," 2 of 3 organic-close misses uncaught by the hook. Session 3 - one organic-close miss, plus zero reach-machinery calls all session. All three sessions: glyph-discipline drops tied specifically to tool-heavy turns; statusline accuracy structurally unverifiable from Larry's own side in every session. Cover note itself: purely procedural, surfaces none of this.
  implication: confirms the human-invisible / system-visible mismatch pattern a 3rd time (instance 3, but the 3rd distinct intern, with 3 sessions' worth of evidence in one report - the richest single submission so far). Confirms Findings 1 and 2 at the sample size this file said to wait for. Adds Findings 5 and 6, both genuinely new failure shapes not seen in the first two sessions.

## Non-Code Follow-ups

- No code change follows directly from this file - see `.planning/debug/intern-qa-week1-bug-sweep.md` for the actionable rows (now including Rows I-M, added from this update).
- When Intern-2 reports back, append their Evidence here before drawing this file's final platform-wide conclusion and deciding its resolved-vs-gathering status.
- Findings 1-2 confirmed a 3rd time as of this update; the stop-hook's card-miss detection structural-fix question (raised in the original version of this note) is now worth prioritizing rather than deferring - three independent sessions show an inconsistent catch rate, not just individual missed-gate bugs.
