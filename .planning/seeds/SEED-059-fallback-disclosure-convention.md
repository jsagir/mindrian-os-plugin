---
kind: seed
status: open
severity: high
created: 2026-07-14
canon_parts: [3, 8, 9, 11, 12]
related: [SEED-021 (F.7-max keyboard dial + atomic render coupling -- the closest existing infrastructure, covers gate-rendering only), SEED-034 (graph-derivation-harness -- shares one of the four failure sites, resolver-fragmentation), SEED-039 (per-session room binding -- shares the resolver-fragmentation site), SEED-058 (eureka-reasoning-mode-fallback -- a SPECIFIC instance of Site 4, dependency-fallback-disclosure, scoped to eureka only)]
proving_case: "three independent intern QA sessions this week (Intern-1 2026-07-11, Intern-4 2026-07-07, David 2026-07-14), consolidated in .planning/debug/intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14.md (commit a71e3f7f). Independently re-confirmed by a same-day full-seed-corpus curation pass, which reached the identical conclusion before seeing this seed exists: 'the false-success/silent-skip pattern has no seed at all.'"
source: "consolidated debug RCA (this session) + navigator-directed filing ('File SEED-059' selected at an AskUserQuestion gate, 2026-07-14)"
---

# SEED-059: Fallback-disclosure convention (the gate-firing / false-success gap has no seed)

## Why This Matters

This session's own RCA (`.planning/debug/intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14.md`) synthesized three independent, professionally-QA'd intern sessions that each show Larry silently taking a degraded/fallback path and presenting the result as primary, correct behavior, with the gap visible ONLY in the session's own Part-B self-report, never in the human's Part-A read:

- **Site 1 (gate rendering):** decision gates render as flat prose instead of firing `AskUserQuestion`, inconsistently caught by `check-card-fire.cjs` (sometimes 2/2, sometimes 0/3, no identified pattern for why).
- **Site 2 (tool-state reporting):** `room_state`/`rooms-new` reporting false state (a real room reads as "not initialized"; a nonexistent room gets asserted as "your active Data Room").
- **Site 3 (export/reconstruction honesty):** session-export tooling reconstructing content from memory rather than parsing a real transcript, with the mechanism undisclosed at the time it mattered.
- **Site 4 (dependency-fallback disclosure):** a primary dependency (the canonical room resolver, a research reach, Python) silently fails and a fallback runs (hardcoded paths, manual WebSearch, Node instead of Python) with no disclosure that the fallback occurred.

No single code fix addresses all four -- they touch four different subsystems. What IS shared: nothing audits "did a fallback happen, and did the response say so" except the Part-A/Part-B QA split itself, which depends on Larry choosing to self-report honestly under a standing prompt, precisely the property in question. A same-day, independently-run full-seed-corpus curation pass reached the identical conclusion before this seed existed: "the false-success/silent-skip pattern has no seed at all... flagging the gap is itself the deliverable."

## Why this is NOT the 1.15 over-enforcement watch (explicit disambiguation)

The navigator's own memory carries `feedback_1_15_enforcement_regression_watch.md`: hard-fail compliance checks (Phases 178/182/192/202/205/209) OVER-firing, replacing judgment calls, making Larry feel "less like Larry." This seed is the OPPOSITE direction: gates and status reports UNDER-firing, or actively lying about outcome. Both are real, both are tracked, and they must not be conflated -- a fix aimed at one direction (e.g., relaxing a gate to feel less rigid) could make the other direction worse (a gate that fires less often is a gate that's easier to silently skip).

## Why this is NOT SEED-021 or SEED-058 (explicit disambiguation)

- **SEED-021** (F.7-max keyboard dial + atomic render coupling) already establishes the "never emit the picture without the card" discipline -- the closest existing infrastructure to Site 1. This seed does not duplicate SEED-021; it generalizes past Site 1 into Sites 2-4, which SEED-021 was never scoped to cover, and names the inconsistent catch-rate finding (SEED-021's own atomic-coupling fix does not yet explain why `check-card-fire.cjs` catches 2/3 gates in one session and 0/3 in another).
- **SEED-058** (eureka-reasoning-mode-fallback) is a SPECIFIC, scoped instance of Site 4 -- what Eureka should do when its embedding index or graph substrate is unavailable. This seed is the general pattern SEED-058 is one instance of; SEED-058 stays scoped to Eureka and ships (or doesn't) on its own merits regardless of what this seed's trigger decides.

## What This Seed Proposes (NOT a phase yet -- scoping input only)

1. **A fallback-disclosure convention**, structural not just written-down: any code path that degrades from a canonical mechanism to a fallback (resolver failures, dependency substitutions, reconstruction-vs-parsing choices) emits a checkable, machine-readable signal (a memory event, a structured response-text marker, or a footer field) rather than degrading silently. The convention needs a home; candidates, not yet decided: extend SEED-021's atomic-coupling scope, a new lightweight lint pattern mirroring `check-card-fire.cjs`'s own shape, or a documentation-only convention enforced by code review until real signal exists on whether it's worth automating.
2. **An audit of `check-card-fire.cjs`'s own inconsistent catch rate** (Site 1 specifically) -- why does it catch some gate-skips and not others within the same session? This is diagnosable today, unlike Sites 2-4, and would be the cheapest, highest-confidence first move if this seed's trigger fires.
3. **Nothing prescribed for Sites 2-4 beyond naming them.** Each needs its own investigation (likely its own narrower RCA/seed) once resourced; this seed's job is to make sure the PATTERN doesn't get lost across four separately-filed, seemingly-unrelated bug reports the way it nearly did before this week's three sessions were read side by side.

## What Could Make This Seed Die

- If a fourth independent QA session shows Sites 1-4 were each already fixed by unrelated work (SEED-021's fix, a resolver hardening pass, an export-tooling rewrite, a dependency-fallback audit) and the cross-cutting "nothing audits disclosure" absence turns out not to matter once each site is individually closed -- i.e., the pattern was real but didn't need a general solution, four specific ones sufficed.
- If the navigator judges the manual Part-A/Part-B QA split is sufficient detection forever, and no automated backstop is worth building -- a legitimate outcome, not a failure of this seed.

## Trigger

No corpus-size or phase-dependency gate (unlike SEED-002/SEED-009's learning-loops pattern). Surface at the next `/gsd:new-milestone` scoping pass, or immediately if a fourth independent QA session (intern or otherwise) reproduces any of the four sites again -- a fourth instance would upgrade this from "worth tracking" to "worth building."

## Provenance

Filed 2026-07-14, navigator-directed ("File SEED-059" selected at an AskUserQuestion gate), consolidating the same-session RCA (`.planning/debug/intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14.md`, commit `a71e3f7f`) and independently corroborated by a same-day full-seed-corpus curation pass that reached the identical "no seed exists for this" conclusion before this file was written.
