---
status: diagnosed
kind: rca
trigger: "card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: [7, 8]
created: 2026-07-28T06:57:42Z
updated: 2026-07-28T06:57:42Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: a distinct gap from the already-resolved `card-fire-answered-gate-refires-within-ttl-window.md` (F.8 mint site). This session's blocks are NOT about F.8 -- the F.8 room-binding gate was fired via a real `AskUserQuestion` and answered cleanly, with no refire on the following turn (the beta.37 fix for that specific gap held). The repeated forced blocks are instead tied to an F.1 "next reach" navigation-engine suggestion (`memory_artifact:research/2026-07-06-eureka-213-215-prior-art-validation:ROOM`) that appears verbatim in the `UserPromptSubmit` hook's `additionalContext` on nearly every turn, unrelated to this conversation's actual subject (MindrianOS-Plugin dev-repo debugging). The turn's own embedded `[FIRE-IF-FORK: ... if the gate is unrelated to the current conversation, do NOT fire it]` instruction was followed correctly (never fired, per the tool's own stated exception) -- and the Stop hook force-blocked anyway, repeatedly, across multiple consecutive turns with materially different content (a long status summary, a two-sentence holding message, a genuinely-fired-and-answered different card in the SAME turn).
test: confirmed the beta.50 (running, cached) plugin already contains the `gateAlreadyAnswered`/lifecycle fix (`grep -c` on `scripts/check-card-fire.cjs` returns 3 matches, identical to dev-repo HEAD) -- ruling out "dev-repo-fix-not-yet-released" as the explanation for the F.1 case. The F.8 fix is genuinely live and held for its own gate. This is a different mint site/code path the F.8 fix does not cover.
expecting: `classifyCardFire` (or whichever function scores the F.1 mint) should either (a) apply the same relevance/staleness check the sensor's own `[FIRE-IF-FORK]` trailer already states in words, or (b) not treat repeated appearance of a candidate-reach suggestion in `additionalContext` as evidence a "gate was reached" at all, since a navigation-engine suggestion surfacing passively every turn is not the same event as the assistant actually reaching and needing to render a Decision Gate.
next_action: not fixed this session (out of scope for a live user-facing conversation to patch this navigation-engine-adjacent Stop-hook mid-thread) -- filed for a follow-up `/gsd-debug` session. Cross-reference with the sixth/seventh/eighth/ninth logged instances for pattern continuity; this is at minimum the tenth distinct reproduction against this script.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.50 (marketplace cache, actively running this session)
- Reported by: Larry (this session's own live experience), navigator present but did not directly report -- self-observed while doing unrelated dev-repo audit-verification work
- Date first observed: 2026-07-28 (this session)
- Related debug sessions:
  - `.planning/debug/resolved/card-fire-answered-gate-refires-within-ttl-window.md` -- the F.8 sibling gap, confirmed fixed and NOT the cause here (different mint site).
  - `.planning/debug/resolved/card-fire-over-enforcement.md`, `card-fire-relevance-check-gap.md`, `card-fire-block-surface.md`, `backstop-benign-list-defeats-relevance-gate.md` -- four+ prior distinct defects against this same script; this file continues that pattern, not a regression of any single one of them.
  - The audit artifact referenced elsewhere this session (MindrianOS Infrastructure Audit, finding G-4): "the card-discipline backstop already over-fires, live, not hypothetically ... an 86 percent false-positive rate on one arm, already logged across ten false fires in four sessions, including twice in this very conversation." This file's reproductions push that count higher, in a fifth session, on a different (F.1, not F.8) mint site than the audit's own count may have been tracking.

## Problem Statement

The Stop hook force-blocked at least four consecutive turns in this session with the reason "rendering your choices as a selectable card," each time pointing at a stale, repeating F.1 navigation-engine reach suggestion that was correctly judged irrelevant to the conversation and correctly not fired, per the suggestion's own embedded relevance-gating instructions.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: a Decision Gate that is genuinely unanswered AND relevant to the current conversation gets fired via `AskUserQuestion`; a stale or irrelevant one, correctly judged as such and left unfired per the sensor's own stated exception, does not force-block the turn.
actual: turns of substantially different shape (a long multi-section status report, a two-sentence holding message, a turn that DID fire and get a clean answer for a genuinely relevant DIFFERENT gate) were all force-blocked with the identical "rendering your choices as a selectable card" reason, while the only "choices"-shaped content present each time was the stale, repeatedly-irrelevant F.1 `eureka-213-215-prior-art-validation` suggestion.
errors: `Stop hook feedback: rendering your choices as a selectable card` / `Stop hook stopped continuation: Stop hook prevented continuation` / `Stop hook blocking error from command: node "${CLAUDE_PLUGIN_ROOT}/scripts/check-card-fire.cjs"`.
reproduction:
  1. Have a long-running session where a navigation-engine sensor (`context_block/hold`, mode A, no real pattern match) keeps re-surfacing the same F.1 candidate-reach suggestion in the `UserPromptSubmit` hook's `additionalContext` every turn, unrelated to the conversation's actual topic.
  2. Correctly decline to fire it (per its own embedded `[FIRE-IF-FORK: ... if unrelated, do NOT fire]` instruction) across several turns of varying content and length.
  3. Observe the Stop hook force-block regardless, repeatedly.
started: observed 2026-07-28, this session, plugin v1.15.3-beta.50.

## Scope and Impact

- Affected surfaces: cli (confirmed, this session).
- Affected commands: none directly -- this is a Stop-hook-level enforcement gap, not a specific `/mos:*` command.
- Affected users: any long session where the navigation-engine's Mode-A sensor keeps re-nominating a stale candidate reach with no genuine relevance to the ongoing conversation.
- Severity: medium -- does not corrupt data or misreport state, but repeatedly and incorrectly blocks legitimate turn completion, forcing the assistant to either fabricate relevance for an irrelevant card or repeat itself trying to satisfy an unsatisfiable check.
- Blast radius: `scripts/check-card-fire.cjs`'s F.1 mint-site handling specifically; the F.8 mint site is confirmed already fixed and not implicated.

## Technical Root Cause

Not fully isolated this session (out of scope for a live mid-conversation patch) but narrowed: the F.8 fix added an answered/lifecycle marker so a resolved gate stops re-asserting "unanswered" on later turns. The F.1 candidate-reach mint site appears to lack the equivalent protection, AND/OR its relevance determination is not actually being applied at the Stop-hook layer the way the sensor's own `[FIRE-IF-FORK]` prose implies it should be -- i.e., the prose instruction telling the assistant when NOT to fire may not be mirrored by an equivalent skip condition inside `check-card-fire.cjs` itself, so the hook keeps treating the suggestion's mere presence in context as a reached-but-unfired gate regardless of the assistant's (correct) relevance judgment.

- Site: `scripts/check-card-fire.cjs` (exact function/line not isolated this session -- likely `classifyCardFire` or its F.1-specific branch, by analogy to the F.8 fix's `classifyCardFire` location).
- Cause: unconfirmed precisely; candidate explanations above.
- Why it surfaces now: this session ran unusually long with heavy background-agent activity, which appears to have kept the Mode-A sensor pinned on the same stale suggestion turn after turn (compare finding R-4 from the same-day infrastructure audit: cross-session/cross-turn reach-signal staleness under concurrent load) -- a longer, busier session is exactly the condition that maximizes exposure to this gap.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (not yet scoped in detail -- needs a dedicated `/gsd-debug` session):
  - Location: `scripts/check-card-fire.cjs`, the F.1 candidate-reach mint/relevance path.
  - Current behavior: appears to force-block regardless of the assistant's relevance judgment on a repeatedly-stale suggestion.
  - Required behavior: mirror the sensor's own `[FIRE-IF-FORK: ... if unrelated, do NOT fire]` relevance gate inside the Stop-hook's own classification, or apply the same answered/lifecycle protection the F.8 fix added, generalized across mint sites rather than site-specific.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- Cross-reference with audit finding G-4 (already has its own filed RCA per the audit artifact) when that RCA is next touched -- this file's reproductions are additional live evidence for the same underlying over-enforcement class.
- knowledge-base.md: add a summary block once this resolves.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: narrowed but not fully isolated (see Technical Root Cause) -- F.1 mint site lacks the F.8 gate's answered/lifecycle protection and/or does not mirror its own sensor's stated relevance-skip condition at the Stop-hook enforcement layer.
fix: NOT APPLIED this session -- filed for a dedicated follow-up debug session rather than patched mid-conversation.
verification: confirmed the F.8 fix is genuinely live in the running beta.50 cache (ruling out a release-lag explanation) and confirmed this is a different mint site via direct observation across 4+ reproductions this session.
files_changed: none.
commits: this filing only.
