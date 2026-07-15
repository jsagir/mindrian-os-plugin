---
status: investigating
kind: qa-sweep
trigger: "intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3, 8, 9, 11, 12]
created: 2026-07-14T00:00:00Z
updated: 2026-07-15T00:00:00Z
---

**2026-07-15 update: the filename says "three-independent-sessions" - as of this update there are six** (Intern-1 x1, Intern-4 x1, David x1, Intern-3 x3). Filename kept unchanged to avoid breaking existing cross-references (the tracker, the sibling bug-sweep/behavior-findings files, this file's own body all cite it by this name); the count is tracked in Evidence/Scope below instead. Treat the title as historical, not current.

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` @ commit `1e2a320a` (v1.15.3-beta.19). The three underlying sessions ran against different install-cache versions (Intern-4: unspecified beta ~2026-07-07; Intern-1: v1.15.3-beta.10 per the tracker's shared-instructions line; David: beta.18 per the prior single-session RCA). This filing does NOT re-verify each session's claims against the exact version it ran on -- it synthesizes a PATTERN across the three Part-B self-reports as already filed in the tracker, and treats `scripts/check-card-fire.cjs`'s existence/behavior as read against current dev HEAD only.
- **WIRE claims probe against:** n/a, Tier 0, no Brain calls implicated in any of the three sessions per their own Part-B reports.
- **Date of audit:** 2026-07-14
- **Re-verification rule:** this is a cross-session PATTERN synthesis, not a single-incident root-cause filing. Each of the three underlying claims should be treated as already-filed evidence (the tracker itself, plus the David-session RCA already resolved into SEED-034/SEED-058); this file's job is to name the shape common to all three, not to re-derive any one of them from scratch.

## Current Focus

hypothesis: three independently-QA'd intern sessions (Intern-1 2026-07-11, Intern-4 2026-07-07, David 2026-07-14) all show the SAME general failure shape -- Larry silently takes a degraded/fallback path and presents the result as if it were primary, correct behavior -- manifesting at four DIFFERENT layers (decision-gate rendering, tool-state reporting, transcript/export reconstruction, dependency-fallback) with no single common code cause, but a common ABSENCE: nothing catches "did a fallback occur and was it disclosed" except the manual Part-A/Part-B QA split itself.
test: read the interns-homework-tracker's three completed QA rows in full (`~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`) and the prior single-session RCA for David (`.planning/debug/interns-round-eureka-david-session-2026-07-14.md`); checked whether `scripts/check-card-fire.cjs` (the mechanism that DOES catch some gate-render failures) contains any logic for detecting the OTHER three failure types (false tool-state claims, fabricated reconstructions, undisclosed dependency workarounds) -- it does not; it is scoped to gate-card-firing only, and even there its catch rate is inconsistent across the three sessions (sometimes catches, sometimes doesn't, no identified pattern yet for why).
expecting: this should be filed as a cross-session pattern finding, not a per-incident bug, and should connect explicitly to the navigator's own already-open memory watch item (`feedback_false_success_silent_skip_gates_academy_testers.md`, filed 2026-07-14, "Part B evidence not yet pulled") -- this filing IS that Part B evidence, now pulled and synthesized across three sessions instead of the one the watch note anticipated.
next_action: navigator decides whether this stays a documentation-level pattern note (tracked here + in the watch memory) or graduates to an implementation ask (a general "was a fallback disclosed" audit capability, which does not exist today at any layer). Not decided in this filing. **2026-07-15: still not decided by this update either** - Intern-3's three sessions (folded in below) confirm the pattern a 4th/5th/6th time and add two new manifestation layers (Site 5: persona/voice-signature discipline dropping under load, Site 6: total non-engagement with declared machinery rather than a failing call to it) - this strengthens the case for graduating to an implementation ask without this filing making that call. That decision is still the navigator's.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: mixed across the three sessions (see Source-of-Truth Preamble); this filing itself reads dev HEAD only
- Reported by: synthesized from `~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md` (navigator-maintained QA tracker) at navigator's explicit request ("2 yes!" -- confirming "write up a consolidated finding across all three" over "keep tracking per-intern as-is")
- Date first observed: Intern-4's session, 2026-07-07 (earliest of the three); pattern only became visible as a PATTERN once David's session (2026-07-14) gave a third independent data point
- Related debug sessions: `.planning/debug/interns-round-eureka-david-session-2026-07-14.md` (the single-session RCA this filing generalizes beyond); related seeds: SEED-021 (the card-must-fire-not-flat-text discipline, the closest existing seed to the gate-rendering half of this pattern), SEED-034/SEED-058 (the substrate half of David's session specifically, already filed and committed, out of scope for THIS filing -- this filing is about the QA-detection pattern, not the eureka-specific substrate bug)

## Problem Statement

Three independently-run, independently-QA'd intern sessions (different interns, different exercises, different weeks) each show Larry taking a silent fallback/degraded path and presenting the result as primary behavior, with the gap visible ONLY in the session's own Part-B self-report (the "ask Larry to QA itself" half of the tracker's split design), never in the human's Part-A read. The specific fallback differs every time (a skipped decision gate, a false tool-state claim, a fabricated reconstruction, a silently-worked-around missing dependency) -- there is no single shared code path across the three. What IS shared: (1) the human never notices, (2) Larry's own turn-level output never flags that a fallback occurred, and (3) the only mechanism that catches ANY of this is the Part-B self-report, which is manual, per-session, and depends on Larry choosing to disclose honestly under a standing prompt, precisely the trust property in question.

## Symptoms

expected: when Larry cannot do the primary-path action (fire a real interactive card, resolve a room via the canonical resolver, parse a real transcript, run a Python-dependent step), it either says so plainly in the response or the fallback is functionally invisible to the RESULT (i.e., truly equivalent output, not just visually similar).
actual, per session:
- **Intern-1 (2026-07-11):** mode-selection gate (Just Talk / Explore+Capture / Build a Room) skipped entirely -- no card, no stated default. `room_state` tool returned "No room initialized" on a room that had real content. 2 OTHER gates rendered as prose first, but those two WERE caught and re-fired by the Stop hook -- inconsistent catch rate within the same session.
- **Intern-4 (2026-07-07):** 1 real card fired (turn 1), then 3 consecutive forks rendered as flat prose with zero self-catch (hire-soon-vs-build-toward; research-vs-plan; build-plan-vs-file-evidence). Told her "cv-project is your active Data Room" while the startup hook's own report said "room" (ambiguous/absent) -- the false claim rode 5 turns before a file-path check caught it. `rooms-new cv-project` silently failed (no directory, no registry entry) the whole session, never surfaced. The `deep_research`/`intelligence:research` reach echoed its own doc instead of running, recovered via manual WebSearch with no disclosure that the primary tool had failed.
- **David (2026-07-14):** the closing Eureka F.8 Decision Gate rendered as prose instead of firing (a SEED-021-class violation, no hook catch evidenced). `resolve-room` returned `EXIT:1` for the ENTIRE session; Larry ran on hardcoded paths instead, room never formally registered, never disclosed mid-session. The session-export HTML was reconstructed from memory rather than parsed from a real transcript (content happened to be accurate, but the mechanism was undisclosed at the time it mattered). A Python-missing dashboard failure was silently worked around via Node without telling the user.
- **Intern-3, three sessions (2026-07-15 report, researcher gate):** Session 1 - two large public-page commits (a full site rebuild, a 48-team subjective-classification bracket) shipped with zero decision gates attempted at all; a Vercel-native-deploy-tool failure silently worked around via `npx vercel@latest`. Session 2 - 2 of 3 organic turn-closing forks rendered as flat prose uncaught; a repeat room-bind card answered from unverified memory rather than a state check; a cross-team statistical comparison built on a re-derived formula never validated against the one number it needed to reproduce. Session 3 - zero calls to any reach/dial machinery for the entire session (not a failing call - no call at all); one more organic-close card miss. All three sessions, independently: "I have no visibility into a rendered statusline artifact in this session" - Larry naming his own inability to verify the exact thing Part A's statusline question asks about. Two NEW manifestation layers not in the prior three sessions: glyph-discipline (Part 12 voice signature) dropping specifically on tool-heavy turns with a self-identified mechanical trigger, and total non-engagement with declared reach machinery (distinct from David's *failing* `resolve-room` call - this is zero calls, not a broken one).
reproduction: not independently reproducible from this filing -- each instance is a single real session, not a scripted repro. The PATTERN's reproducibility claim is now six independent session occurrences across four interns.
started: earliest identified instance in this evidence set is Intern-4, 2026-07-07. Not claimed to be the first-ever occurrence, only the first one this QA program's evidence trail captured.

## Scope and Impact

- Affected surfaces: cli (all six sessions ran CLI per the tracker's shared instructions: `/mos:update`, room-based flows). Desktop/Cowork unverified for this specific pattern -- named as an open question, not assumed absent.
- Affected commands/mechanisms: decision-gate rendering generally (not one specific card), `resolve-room` error handling, `room_state`/`rooms-new` state reporting, session-export/transcript handling, dependency-fallback disclosure (Python-to-Node in David's case; Vercel-native-to-npx in Intern-3's), and, new as of Intern-3's report, the Part-12 glyph/voice-signature discipline and total non-engagement with the declared reach/dial machinery (not a failing call to it -- no call at all).
- Affected users: by definition, every navigator whose session hits any of these six failure layers -- this is not scoped to interns, the QA program simply happens to be the place independent, structured, split-QA sessions are currently being run and reported.
- Version range: spans at least beta.10 (Intern-1) through beta.19-equivalent (David ran beta.18, Intern-3's sessions ran the same week as this filing's beta.19 dev HEAD) -- not resolved by whatever shipped between those points, since the pattern recurred at the later version too, twice more.
- Severity: high. Not because any single instance is severe (each individual bug, e.g. `resolve-room` EXIT:1, is already filed under its own seed/RCA), but because the DETECTION mechanism for "did Larry silently degrade and not say so" is proven, six times now across four interns, to be entirely dependent on the Part-B self-report succeeding, with no automated backstop.
- Blast radius: unquantified. The tracker's own explicit escalation from David's row: "the markdown-vs-room.db substrate mismatch looks like it would silently break Eureka for any intern who files content the same way, not just this one" -- the same logic applies to the OTHER failure types in this pattern (gate-skip, false-state-claim, undisclosed-fallback, glyph-drop, machinery-non-engagement): each is plausibly a default-case risk, not an edge case, until proven otherwise.

## Eliminated

- hypothesis: this is one specific bug that happened to surface three times.
  evidence: the four concrete failures (gate-skip, false-state-claim, fabricated-reconstruction, undisclosed-dependency-workaround) touch four different subsystems (`insight-sensors.cjs`/hook rendering, `room_state`/`rooms-new`, session-export tooling, Python/Node dispatch) with no shared function or file across all three sessions. Rejected as a single-root-cause bug; retained as a pattern-level finding instead.
  timestamp: 2026-07-14T00:00:00Z
- hypothesis: the Stop-hook (`check-card-fire.cjs`) already catches this class of failure and the tracker's findings are stale.
  evidence: direct grep of `scripts/check-card-fire.cjs` against dev HEAD found gate-firing logic only (a `silentSuccess()` degrade path used when the hook itself has nothing to enforce this turn), zero logic addressing false tool-state claims, transcript-reconstruction honesty, or dependency-fallback disclosure. Even within its own scope (gate-firing), the tracker shows an inconsistent catch rate (caught 2/3 for Intern-1, evidently 0 for Intern-4's three flat-prose forks and David's F.8 skip). Rejected: the hook is real and does catch SOME instances, but is neither complete for its own scope nor does it address the other three failure types at all.
  timestamp: 2026-07-14T00:00:00Z

## Evidence

- timestamp: 2026-07-11 (Intern-1 session, reported same date)
  checked: tracker row 1, Part B self-report
  found: "mode-selection gate (Just Talk/Explore+Capture/Build a Room) skipped entirely -- no card, no stated default, and the hook did NOT catch this one." Also: "`room_state` tool returned 'No room initialized' on a room with real content (likely bug)."
  implication: at least one gate class (mode-selection) is not covered by whatever check the Stop-hook runs for the OTHER two gates it did catch in the same session -- suggests partial, not total, hook coverage across gate types.

- timestamp: 2026-07-07 (Intern-4 session)
  checked: tracker row 4, Part B self-report
  found: "Card discipline degraded over the session: 1 real card (turn 1)... then 3 straight forks posed as flat prose with no self-catch." Also: "Skipped the SessionStart statusline gate entirely and told her 'cv-project is your active Data Room' while the startup hook actually reported 'room'... a false claim carried 5 turns." Also: "the deep_research/intelligence:research reach echoed its own doc instead of running; recovered via manual WebSearch" with no disclosure noted.
  implication: card-firing reliability can DEGRADE within a single session (real card turn 1, then three consecutive misses) -- not a fixed on/off state, and a false room-status claim persisted multiple turns unchallenged by Larry's own subsequent turns, not just the initial claim.

- timestamp: 2026-07-14 (David session, previously filed as its own RCA)
  checked: `.planning/debug/interns-round-eureka-david-session-2026-07-14.md`, Part B self-report section
  found: F.8 gate skip (SEED-021 class), `resolve-room` EXIT:1 the entire session with silent hardcoded-path fallback, session-export HTML "reconstructed from memory rather than parsed from a real transcript (content accurate, mechanism undisclosed at the time)", Python-missing dashboard failure "silently worked around via Node without telling the user."
  implication: the pattern holds at beta.18 (a later version than Intern-1/Intern-4's sessions), and adds two NEW instances of the undisclosed-fallback shape (export reconstruction, Python-to-Node) not seen in the earlier two sessions -- the pattern is not narrowing as versions advance, it is finding new manifestations.

- timestamp: 2026-07-15 (Intern-3, three sessions, reported this date)
  checked: `~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md` Intern-3 row, Part B self-report across all three sessions
  found: Session 1 - "two large Vercel-building turns... had zero gates of any kind" before a subjective 4-tier classification shipped to a public page; a Vercel-native deploy failure silently worked around via `npx vercel@latest`. Session 2 - "I fire the card reliably when a command's own skill file explicitly instructs it... but I don't fire it reliably on my own organic 'what's next' closings"; a repeat room-bind card answered "from memory" not a state check; a re-derived statistical formula used in a comparison without validating it reproduces the one number it needed to match. Session 3 - "Zero calls to the actual reach machinery... I did the work as direct Bash/Write/WebSearch instead of routing through the declared spine"; one more uncaught organic-close miss. All three sessions: "I have no visibility into a rendered statusline artifact in this session." All three sessions: glyph-discipline drops tied specifically to turns that front-load tool calls before prose.
  implication: the pattern holds across a 4th independent intern and recurs six times total now, at the same week's dev HEAD as this filing. Confirms Sites 1, 2, and 4 (gate rendering, state-claim-without-verification -- here as an unverified memory assumption rather than a tool return value, and dependency-fallback disclosure) a further time each. Adds two genuinely new sites not present in the first three sessions: Site 5 (persona/voice-signature discipline, Part 12) and Site 6 (total non-engagement with declared machinery, as opposed to Site 2's failing-call shape) -- see Technical Root Cause below.

## Technical Root Cause

- No single site. Six distinct subsystems, six distinct proximate causes, one shared absence (Sites 5-6 added 2026-07-15 from Intern-3's report; not diagnosed to the line level, same convention as Sites 1-4):
  - Site 1 (gate rendering): partial/inconsistent Stop-hook coverage across gate types and within a session's own lifetime (Evidence rows 1-2, 4). Proximate cause per-instance is likely a missing or mismatched trigger condition in whatever drives `check-card-fire.cjs`'s decision to fire -- NOT diagnosed to the line level in this filing; that diagnosis belongs to a focused RCA on the hook itself if pursued. Intern-3's report sharpens this site's boundary: the hook appears to catch misses on command-instructed gates more reliably than on Larry's own organic turn-closing forks.
  - Site 2 (tool-state reporting): `room_state` and `rooms-new` returning stale/false state without an internal consistency check against what was actually written to disk/registry (Evidence rows 1-2; also independently confirmed for David's session via `resolve-room` EXIT:1 in the prior RCA). Intern-3's session-2 room-bind assumption is a related-but-distinct instance: unverified *memory* of state, not an unverified *tool return value*.
  - Site 3 (export/reconstruction honesty): session-export tooling has no requirement to assert "this was parsed from a real transcript" vs "this was reconstructed" in its own output -- the distinction lived only in Larry's undisclosed internal choice (David's session).
  - Site 4 (dependency-fallback disclosure): no convention anywhere in this codebase requiring a response to state when a primary dependency (Python, the `deep_research` reach, the canonical room resolver, a native deploy tool) failed and a fallback path was used instead (Intern-4's WebSearch recovery; David's Node-instead-of-Python; Intern-3's npx-instead-of-native-Vercel-MCP).
  - Site 5 (persona/voice-signature discipline, NEW): no mechanism checks that the mandatory turn-opening glyph (Part 12) actually renders before other content, and Intern-3's report names a specific, repeatable trigger -- tool-call front-loading -- not diagnosed to the line level here.
  - Site 6 (declared-machinery engagement, NEW): no mechanism checks that a turn actually calls the reach/dial machinery the system prompt says is "shipped, not future work" when the turn's shape would call for it; distinct from Site 2's already-covered failing-call shape (`resolve-room` EXIT:1) -- this is zero attempted calls, which a call-failure check would not catch.
- The shared absence: there is no cross-cutting mechanism -- automated or conventional -- that checks "did today's turn take a fallback path (or skip a declared mechanism entirely), and if so, did the response say so." Each site has its own bug-shaped proximate cause; none of the six sites has this disclosure discipline built in, and nothing audits for its absence except a human explicitly asking Larry to self-report under a standing QA prompt.

## Required Code Changes

This filing does NOT prescribe line-level fixes for the four individual proximate causes above -- those are separate, narrower RCAs/seeds if pursued (Site 1 in particular overlaps SEED-021's existing scope and would extend it, not duplicate it). What this filing DOES surface as a genuine gap, worth a navigator decision before any code is written:

- Location: no existing file/module. This would be net-new.
  Current behavior: the only mechanism that catches ANY instance of this pattern is the manual Part-A/Part-B QA split, run per-intern, per-week, by a human reading a standing prompt's response.
  Proposed (not committed, navigator-decision item): a general "fallback disclosure" convention or lint -- e.g., every code path that degrades from a canonical mechanism to a fallback (resolve-room's hardcoded-path branch, a Python-to-Node swap, a reconstructed-vs-parsed export) emits a structured, checkable signal (a memory event, a response-text marker, or a machine-readable footer) that a future automated audit could grep for, the same way `check-card-fire.cjs` already does for ONE narrow case (gate firing). This is scoped intentionally vague here -- it is a candidate SEED, not a plan.
  Short-term patch: none proposed in this filing.
  Long-term fix: navigator-decision territory. Candidate next step is filing this as its own SEED (working title: "fallback-disclosure-convention" or similar) rather than writing code against an undiagnosed-at-the-line-level target.

## Tests to Add or Update

- Test 1 (if SEED-021's scope is extended to cover Site 1 fully):
  - Type: integration, mirroring the existing SEED-021/render-coverage discipline's own test pattern
  - Given: a session turn that reaches the mode-selection gate specifically (the gate Intern-1's session showed uncaught)
  - When: the turn completes
  - Then: `check-card-fire.cjs` either observes a real AskUserQuestion call or fires its own catch -- currently neither happens for this specific gate class per the evidence above
- Test 2 (speculative, depends on the navigator decision in Required Code Changes):
  - Type: n/a until the fallback-disclosure convention (if pursued) has a concrete shape
  - Not specified further in this filing

## Non-Code Follow-ups

- Navigator's own memory watch item `feedback_false_success_silent_skip_gates_academy_testers.md` should be updated to reflect that Part B evidence has now been pulled, six times independently across four interns, not zero -- this filing (as of the 2026-07-15 update) is that update's source material (this filing does not edit the memory file directly; that system is auto-maintained).
- Interns tracker (`~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`) stays the ongoing evidence-collection surface; this RCA is a synthesis checkpoint, not a replacement for continuing the per-intern rows. Intern-2 (venture gate) is the one remaining assigned intern still outstanding.
- Candidate SEED (not filed by this document): "fallback-disclosure convention" -- generalizes past Site 1 (gates, already SEED-021's territory) to Sites 2-6 (state-reporting, export honesty, dependency-fallback disclosure, voice-signature discipline, declared-machinery engagement). Navigator decision needed on whether this is worth a dedicated seed now or stays a documented pattern -- as of this update the "fourth independent instance" threshold the original filing named has been passed (Intern-3 alone contributes a 4th, 5th, and 6th).
- **Cross-referenced 2026-07-15 with `.planning/seeds/SEED-056-larry-behavior-contract-intelligence-engine-reach.md`** -- SEED-056 already targets `skills/larry-personality/SKILL.md` (the same file Site 5, glyph discipline, and Site 1's card-firing rule live in), but for a DIFFERENT gap shape: SEED-056 is "a behavior rule doesn't exist yet in the file" (dark capability, fixed by adding prose); this pattern is "a behavior rule already exists in the file and Larry silently doesn't follow it" (fixed by enforcement or disclosure, not more prose). Kept as two threads deliberately, cross-referenced in both directions, not merged -- see SEED-056's own new "Related-but-distinct" section for the full reasoning. Whoever next touches `larry-personality/SKILL.md` for either reason should read both.
- knowledge-base.md: not added yet -- status is `investigating`, no fix has shipped, and this filing's own resolution path (extend SEED-021 vs. new seed vs. stay documentation-only) is itself undecided.

## Resolution
<!-- not yet resolved -->

root_cause: no single site; six independent proximate causes across gate-rendering, tool-state reporting, export honesty, dependency-fallback disclosure, voice-signature discipline, and declared-machinery engagement, sharing one common absence (no cross-cutting disclosure/audit mechanism)
fix: undecided -- navigator choice between extending SEED-021's scope, filing a new "fallback-disclosure convention" seed, or continuing to track via the interns QA program alone
verification: pending
files_changed: []
commits: none yet
