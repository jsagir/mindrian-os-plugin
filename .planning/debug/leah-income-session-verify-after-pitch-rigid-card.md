---
status: gathering
kind: qa-sweep
trigger: "leah-income-session-verify-after-pitch-rigid-card"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3]
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:00:00Z
---

## Purpose
<!-- OVERWRITE on each update - reflects NOW -->

Two CANDIDATE defects surfaced by a real-user session (Leah Aronhime, personal use, income-search problem), reported by relaying Larry's own self-critique of the session (not a fresh technical Part A/B self-QA like the intern program used). This file exists to hold the candidates without fabricating a root cause, because we are missing the minimum data the RCA-TEMPLATE requires before investigation can start: plugin version, whether her install/room is healthy, and whether a Brain key was connected during the session.

status: gathering, not investigating, because none of the below is confirmed against known code yet. Do not open a real /gsd:debug investigation on either candidate until the blocking data below is collected - it may turn out both symptoms are fully explained by an unhealed room + no Brain key on an old build, not a code defect at all.

next_action: BLOCKED on Leah's reply. Sent her (2026-07-11) a workflow email asking her to run /mos:doctor --acceptance and /mos:doctor --brain-smoke and paste the raw output back, plus to re-run a similar test using a technical self-QA prompt (mirroring the intern QA Part A/B split) so we get a grounded report instead of a narrative recap. Once her version, room-health, and brain_mode are known, revisit this file and either promote each candidate to its own proper RCA (kind: rca, status: investigating) or close as "explained by unhealed install."

## Candidate 1: Larry pitched unverified platform recommendations, verified only after pitching

Relayed via Leah's own quoted self-critique (Larry speaking about itself, first person): "I kept reaching for a specific platform and verifying it after I'd already pitched it, instead of checking first, so you got four rounds of 'here's the answer' followed by 'actually, no' (Minnect, Intro.co, JustAnswer, the Listeners app)."

Open questions before this can be investigated as code:
- Was a Brain key connected during this session? Without one, Larry has no calibrated research reach to check a platform against before naming it - this could be a pure knowledge-grounding gap (env/config), not a code defect.
- Was the `deep_research`/`intelligence:research` reach available and working? A sibling investigation this same week (intern-w1-research-reach-broken, now resolved on a worktree branch, not yet merged to main) found this exact reach was deterministically unwired to any real fetch pipeline on at least one recent build - if Leah's build predates that area of the code, or postdates it but the fix isn't in her build yet, "verify after pitching instead of before" could be the direct, already-diagnosed symptom of that same root cause, not a new bug.

## Candidate 2: A rigid four-option Decision Gate card was forced onto a genuinely ambiguous, multi-constraint problem

Relayed via Leah's own quoted self-critique: "Then, once I finally named it, I forced it into a rigid four-option card instead of just talking it through with you."

Open questions before this can be investigated as code:
- What gate mechanism fired here - a methodology framework's own multi-option card, or the general Decision Gate machinery? Different code paths, different fix surface.
- Is this a genuine defect (the gate-firing logic should recognize when a problem's constraint set doesn't cleanly map to N discrete options and degrade to conversation instead), or intended behavior working as designed on a problem shape it was never meant to handle? Cannot tell without seeing which specific card/skill fired.

## Separate, non-code observation (not a bug, a usage pattern)

Leah's own account: "Two more constraints surfaced as we went" (no personal network, nothing tied to her Stevenson job) rather than being stated up front. A moving constraint set during a session is a plausible contributor to the platform-guessing-and-correcting pattern independent of any code defect - flagged to her directly in the follow-up (state constraints up front; push back explicitly when a forced card does not fit rather than picking the closest option).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: UNKNOWN - not yet collected from Leah
- Reported by: Leah Aronhime (real-user session, personal problem, not a formal tester wave), relayed via Lawrence Aronhime and Jonathan Sagir
- Date first observed: 2026-07-09 (email date)
- Related debug sessions: intern-w1-research-reach-broken.md (resolved, worktree branch worktree-agent-ac02988d32f3e523b, not yet merged to main) - possible shared root cause for Candidate 1, re-check once Leah's version is known
