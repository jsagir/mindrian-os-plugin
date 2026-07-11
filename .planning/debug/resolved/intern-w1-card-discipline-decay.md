---
status: resolved
kind: rca
trigger: "intern-w1-card-discipline-decay"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3]
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:50:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: REFUTED (see Eliminated). Root cause confirmed to be a DIFFERENT, pre-existing defect: `classifyCardFire()`'s `gate-is-simple-binary` exemption (added commit `560753ed`, 2026-07-05, already shipped in v1.15.3-beta.10 - the exact version the intern's session ran on - and untouched by CR-05) unconditionally exempts ANY gate with exactly 2 extracted option labels from the force-fire requirement. It was designed to stop over-firing on trivial yes/no closers ("Want those?") but its condition (`gateLabels.length === 2`) cannot distinguish that from a genuine two-way forced-choice fork - exactly the shape of all 3 of the intern's missed forks. Compounding structural gap: the backstop's shape gate (`ASCII_BOX_GLYPH_RE`) never matches free-flowing narrative prose with no numbered-list/bracket structure at all (which is how "flat prose" forks like these render), so `computeBackstopHit` is false before `GATE_FRAMING_RE` is ever reached for text shaped like the intern's 3 quoted phrasings.
test: DONE - see Evidence. Ran the 3 quoted phrasings verbatim through `ASCII_BOX_GLYPH_RE`/`GATE_FRAMING_RE`/`computeBackstopHit`; reconstructed numbered-list renderings (with/without framing cue) through the same; ran full `classifyCardFire()` on the reconstructed with-cue renderings; verified `gate-is-simple-binary` commit ancestry against the beta.10 release tag.
expecting: N/A - hypothesis testing complete, root cause confirmed via direct node execution against beta.13 HEAD.
next_action: RESOLVED. Human verification confirmed ("confirmed fixed") at the checkpoint. Archiving: this file moves to `.planning/debug/resolved/`, code changes commit, knowledge-base.md gets a summary block. This worktree (agent-a7884b14e9b45ed48) branched off main BEFORE CR-05/CR-06/CR-07 (the `backstop-benign-list-defeats-relevance-gate` and `card-fire-block-surface` reopen fixes) landed, so `scripts/check-card-fire.cjs` here does NOT carry `GATE_FRAMING_RE` / `computeBackstopHit` / the diagnostic log -- confirmed via `diff` against origin/main and `git merge-base --is-ancestor`. The gate-is-simple-binary fix in this worktree was scoped ONLY to the policy gap (the cardinality-only exemption); the structural shape-detection gap (gap 1, free-flowing prose never matching `ASCII_BOX_GLYPH_RE`) remains explicitly out of scope, unchanged, exactly as the file previously recorded.

## Reasoning Checkpoint (written before touching code)

```yaml
reasoning_checkpoint:
  hypothesis: "classifyCardFire()'s gate-is-simple-binary exemption (scripts/check-card-fire.cjs, this worktree's copy) uses a bare gateLabels.length === 2 cardinality check, which exempts ANY 2-option gate from force-fire -- including a genuine two-way forced-choice fork -- because it cannot distinguish that from a trivial yes/no confirmation closer."
  confirming_evidence:
    - "Debug file Evidence entry (2026-07-11T00:12:00Z): the full classifyCardFire() predicate run against reconstructed numbered-list renderings of the intern's 3 missed forks (all genuine two-option strategic choices, e.g. 'run research vs build the plan') produces {intercept:false, reason:gate-is-simple-binary} for all 3; extractOptionLabels returns exactly 2 labels each."
    - "Direct code read, scripts/check-card-fire.cjs:512-514 (this worktree): `if (gateLabels.length === 2) return {intercept:false, reason:'gate-is-simple-binary', degrade:false}` -- no semantic check on label CONTENT, purely a count."
    - "tests/test-card-fire-relevance-gate.cjs Leg 4 (already shipped in this worktree) asserts BINARY_DRAFT_GATE ('Which draft should I open next? 1. revenue projection draft 2. onboarding rewrite draft' -- a genuine non-yes/no fork) IS exempted today. This existing green test is itself proof the current implementation swallows genuine forks; its fixture is structurally the same shape as the intern's bug."
  falsification_test: "Feed a 2-option gate whose labels are NOT yes/no-shaped through classifyCardFire() after the fix -- if it still returns gate-is-simple-binary, the fix is wrong. Feed a genuine yes/no-shaped 2-option gate (e.g. 'Publish this release? 1. Yes 2. No') through after the fix -- if it now force-fires, the fix over-corrected and broke the navigator-approved exemption."
  fix_rationale: "Replace the bare gateLabels.length === 2 check with a semantic isYesNoShapedGate(gateLabels) predicate extracted (not duplicated) from gateAlreadyAnswered's existing hasYes/hasNo prefix check in lib/core/gate-relevance.cjs. This targets the root cause (the exemption's condition was never semantic) rather than a symptom, and reuses existing logic per Part 7 (Reuse Before Build) instead of inventing a new detector."
  blind_spots: "(1) Gap 1 from this file (backstop shape detection never matches free-flowing narrative-prose forks with no list/bracket markers) is NOT addressed -- explicitly out of scope, a separate future navigator decision. (2) The yes/no prefix heuristic could misclassify an edge case like 'Yesterday's plan' vs 'Nowhere to go' (labels starting with yes/no but not meaning yes/no) -- this is the SAME heuristic gateAlreadyAnswered already ships with, so no NEW risk is introduced, but it is not a perfect semantic parser. (3) Not verified against the live Claude Code harness end-to-end (the card-fire-block-surface reopen lesson) -- verification here is the deterministic predicate + reconstructed transcript fixtures, consistent with how every other check-card-fire.cjs test in this repo is verified."
```

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10 (session under test); note the CR-05 framing-cue fix cited in the hypothesis landed in the beta.13 Unreleased CHANGELOG entry, AFTER this session ran - re-verify against beta.13 HEAD, not just beta.10, per the RCA-TEMPLATE Source-of-Truth Preamble.
- Target version: v1.15.3-beta.13
- Reported by: Intern-4 (pseudonym), JHU intern QA program, via Larry's own "CV Project - Session QA (Self-Assessment)" document
- Date first observed: 2026-07-07 (session date)
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row C), `.planning/debug/intern-w1-mode-gate-skip.md` (sibling - same failure class, session-start instead of mid-session), `.planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md` (check for cross-reference - name suggests it may already touch card-firing reliability)

## Source-of-Truth Preamble

- CODE claims read against: origin/main HEAD at time of this file's investigation pickup (re-verify at pickup time, not filing time)
- WIRE claims probe against: not applicable (no live Brain/server call involved in card-firing logic)
- Date of audit: 2026-07-11 (filing date; investigation not yet run)
- Re-verification rule: the session under investigation ran on beta.10; the CR-05 framing-cue fix cited in the hypothesis is a beta.13 Unreleased change per CHANGELOG.md. Any claim below about "current" behavior MUST be checked against beta.13 HEAD, not inferred from the beta.10 session transcript, since the hook's regex has already changed once between these versions.

## Problem Statement

In a single session, card discipline degraded from 1 correctly-fired AskUserQuestion card (turn 1) to 3 consecutive genuine two-option forks rendered as flat prose (turns 2, 3, 5), none caught by the stop-hook backstop or self-corrected - a worse hit rate than a sibling session where 2 of 3 similar misses WERE caught.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: every genuine two-option fork on a card-capable CLI surface fires an AskUserQuestion card; if missed, the stop-hook backstop catches and forces a re-fire.
actual: "I fired exactly ONE real AskUserQuestion card (turn 1)... After that, three more choose-one forks were posed as flat prose instead of cards" - turn 2 ("which pull is stronger - get hired soon vs build toward"), turn 3 ("run research vs build the plan"), turn 5 ("build the plan now vs file evidence first"). None caught by the hook in this session, contrast a sibling session where the hook DID catch 2 of 3 similar misses.
errors: none - silent degradation, no error, no hook intercept message.
reproduction:
  1. Run a multi-turn session where turn 1 has a clean two-option fork (fires correctly) and turns 2+ also have genuine "X vs Y" forced-choice framings that do NOT use the literal words "which/would you like/pick/choose/select/type 1".
  2. Observe whether the stop-hook intercepts and forces a card re-fire, or lets the flat-prose fork through.
started: session observed 2026-07-07 on beta.10; the CR-05 regex change (a plausible root cause per hypothesis) landed later, in beta.13 Unreleased - so this may already be partially or fully addressed and needs re-verification, not blind re-fixing.

## Scope and Impact

- Affected surfaces: cli (confirmed)
- Affected commands: `scripts/check-card-fire.cjs` stop-hook backstop; any Decision Gate fork phrased as implicit "X vs Y" rather than an explicit question
- Affected users: all installs, any multi-turn session with implicit-framing forks
- Version range: confirmed on beta.10; re-verify on beta.13 (CR-05 landed since)
- Severity: high - directly violates the Canon Part 3 Tri-Context Decision Gate contract (material choices must render through Shape F, not flat prose)
- Blast radius: potentially the SAME root cause as `intern-w1-mode-gate-skip.md` if the backstop has a broader coverage gap, not two separate bugs

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the beta.13 CR-05 `GATE_FRAMING_RE` co-requirement under-matches the intern's 3 quoted fork phrasings and is the operative cause of the miss.
  evidence: Direct node execution against `scripts/check-card-fire.cjs` at beta.13 HEAD (`node -e` requiring the module and calling `ASCII_BOX_GLYPH_RE.test()` / `computeBackstopHit()` on the 3 phrasings verbatim: "which pull is stronger - get hired soon vs build toward", "run research vs build the plan", "build the plan now vs file evidence first") shows ZERO of the three match `ASCII_BOX_GLYPH_RE` at all (not just alternative 4). `computeBackstopHit` returns false for all 3 BEFORE `GATE_FRAMING_RE` is ever evaluated, because none of the four shape alternatives (bracket box, "type 1,2,or3" literal, multiline bracket, line-anchored `1./2.` numbered-prose) match free-flowing "X vs Y" narrative prose with no list/bracket markers. CR-05 is unreachable for this input shape - the framing-cue-under-match theory as literally stated cannot be the mechanism, since the shape gate (which CR-05 does not touch) rejects the text first. Separately confirmed: even a hypothetical numbered-list-with-framing-cue reconstruction of these exact 3 forks (which DOES pass both `ASCII_BOX_GLYPH_RE` and `GATE_FRAMING_RE`) is still NOT intercepted by the full `classifyCardFire()` pipeline - see Evidence entry below - because a separate, pre-existing rule short-circuits it first. CR-05 tuning could not have prevented this miss even in principle.
  timestamp: 2026-07-11T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's Part B self-QA document (verbatim) and CHANGELOG.md v1.15.3-beta.13 Unreleased Fixed entries
  found: intern's 3 quoted missed forks (above); CHANGELOG CR-05 entry: "a bare numbered-prose list counts as a backstop hit ONLY when a choice-framing cue (?, or one of which / would you like / pick / choose / select / type 1) sits inside the matched span or the ~150 chars before it."
  implication: none of the intern's 3 quoted fork phrasings obviously contain those exact cue words - "which pull is stronger" DOES contain "which", so may already match; "run research vs build the plan" and "build the plan now vs file evidence first" do NOT obviously contain any cue word, supporting the under-match hypothesis for at least 2 of 3. SUPERSEDED by direct testing below - the framing-cue question turned out to be moot for a different reason.

- timestamp: 2026-07-11T00:05:00Z
  checked: ran `node -e` against `scripts/check-card-fire.cjs` at beta.13 HEAD (repo confirmed at `.claude-plugin/plugin.json`/`package.json` version `1.15.3-beta.13`), testing `ASCII_BOX_GLYPH_RE.test()`, `GATE_FRAMING_RE.test()`, and `computeBackstopHit()` against the 3 quoted phrasings verbatim (no modification).
  found: "which pull is stronger - get hired soon vs build toward" -> ASCII_BOX_GLYPH_RE=false, GATE_FRAMING_RE=true (contains "which"), computeBackstopHit=false. "run research vs build the plan" -> ASCII_BOX_GLYPH_RE=false, GATE_FRAMING_RE=false, computeBackstopHit=false. "build the plan now vs file evidence first" -> ASCII_BOX_GLYPH_RE=false, GATE_FRAMING_RE=false, computeBackstopHit=false.
  implication: ALL THREE fail the shape gate (ASCII_BOX_GLYPH_RE) regardless of GATE_FRAMING_RE - none contain bracket notation, the "type 1,2,or3" literal, or a line-anchored `1./2.` numbered list. computeBackstopHit short-circuits to false via the shape check alone; the framing co-requirement is never reached. This directly refutes the file's original hypothesis as literally stated.

- timestamp: 2026-07-11T00:08:00Z
  checked: constructed plausible numbered-list RENDERINGS of the same 3 forks (the shape ASCII_BOX_GLYPH_RE alternative 4 is designed to catch) in two variants - (a) with an explicit framing-cue lead line ("Which pull is stronger?\n1. ...\n2. ..."), (b) without any framing cue ("Two options here:\n1. ...\n2. ...") - and ran both through `ASCII_BOX_GLYPH_RE` and `computeBackstopHit()`.
  found: variant (a) with-cue: all 3 match ASCII_BOX_GLYPH_RE=true AND computeBackstopHit=true (CR-05 correctly lets these through as a hit). variant (b) without-cue: all 3 match ASCII_BOX_GLYPH_RE=true but computeBackstopHit=false (CR-05 correctly withholds the hit per its documented design).
  implication: CR-05 is working exactly as designed for the SHAPE it targets (numbered-prose lists) - it is neither over- nor under-matching relative to its own spec. This proves CR-05 itself is not defective; if the intern's forks HAD rendered as numbered lists without a cue, that would be a legitimate under-match, but that is not established (see next entry, which shows it would not have mattered anyway).

- timestamp: 2026-07-11T00:12:00Z
  checked: ran the full `classifyCardFire()` predicate (not just the backstop regex) against the variant-(a) with-cue numbered-list reconstructions of all 3 forks, plus `gateRelevance.extractOptionLabels()` on each.
  found: all 3 reconstructions produce verdict `{"intercept":false,"reason":"gate-is-simple-binary","degrade":false}`. `extractOptionLabels` returns exactly 2 labels for each (e.g. `['gethiredsoon','buildtowardthelongtermplan']`). The `gate-is-simple-binary` rule at check-card-fire.cjs:609-611 fires whenever `gateLabels.length === 2`, unconditionally, before the final intercept branch.
  implication: even a rendering of these exact 3 forks that DOES pass both the shape gate and CR-05's framing co-requirement is STILL not intercepted, because a separate, earlier-in-the-file, pre-existing rule (`gate-is-simple-binary`) exempts any exactly-2-option gate outright. CR-05 tuning is moot for these forks regardless of shape/framing, because this downstream rule short-circuits first.

- timestamp: 2026-07-11T00:15:00Z
  checked: `git log --oneline -S"gate-is-simple-binary" -- scripts/check-card-fire.cjs` and `git merge-base --is-ancestor` against the v1.15.3-beta.10 release tag commit.
  found: commit `560753ed` ("fix(quick-260705-m9g-02): exempt simple 2-option binaries via gate-is-simple-binary") is a confirmed ancestor of `1c6bfd5d` ("release: v1.15.3-beta.10") - the EXACT version the intern's session ran on 2026-07-07. Cross-referenced `.planning/debug/resolved/card-fire-block-surface.md` Finding 2: this exemption was a navigator decision (2026-07-05) explicitly scoped to "simple binary (2-option) yes/no closers" (e.g. "Want those?"), implemented via the structural proxy `gateLabels.length === 2` because "the labels are already extracted at this point in the function" (reuse, not a new semantic check).
  implication: this exemption was ALREADY ACTIVE during the observed beta.10 session (not something that changed between beta.10 and beta.13) and remains byte-identical at beta.13 HEAD - CR-05 never touched this code path. Its condition is a pure CARDINALITY check (exactly 2 labels), not a semantic distinction between "trivial yes/no confirmation" and "genuine two-way forced-choice fork" - it cannot tell "Want those? Yes/No" apart from "which pull is stronger: get hired soon vs build toward". All 3 of the intern's missed forks are genuine two-option strategic choices (per the Problem Statement's own framing: "genuine two-option forks"), so this exemption swallows exactly the class of fork Canon Part 3 / the session's expected behavior says must fire a card.

## Technical Root Cause

The debug file's original hypothesis (beta.13's CR-05 `GATE_FRAMING_RE` co-requirement under-matching these 3 phrasings) is REFUTED by direct testing against beta.13 HEAD. CR-05 is not implicated in this incident at all - it is neither the cause nor a partial fix.

Two independent, pre-existing gaps in `scripts/check-card-fire.cjs` explain the miss, both present at beta.10 (the session's version) and unchanged at beta.13 HEAD:

1. **Structural (sufficient on its own):** the backstop's shape detection (`ASCII_BOX_GLYPH_RE` / its `ASCII_BOX_UNCONDITIONAL_RE` + `ASCII_BOX_NUMBERED_PROSE_RE` split) only recognizes ASCII-box-shaped anti-patterns - bracket notation `[1]...[2]`, the literal "type 1, 2, or 3", a multiline bracket box, or a line-anchored `1. / 2.` numbered-prose list. A genuine two-option fork narrated as flowing prose with NO list/bracket markers - exactly the shape of the intern's 3 quoted forks - produces zero matches on any of the four alternatives, so `computeBackstopHit()` returns false before `GATE_FRAMING_RE` is ever evaluated. This was true before CR-05 and remains true after; CR-05 only tunes what counts as a hit ONCE the numbered-prose SHAPE already matched, it does not extend detection to unstructured narrative prose.

2. **Policy (independently sufficient, the more decisive finding):** `classifyCardFire()`'s `gate-is-simple-binary` exemption (commit `560753ed`, shipped in v1.15.3-beta.10 - the exact version this session ran on - untouched by CR-05) unconditionally treats ANY gate with exactly 2 extracted option labels as a "simple binary" exempt from the force-fire requirement. This was a deliberate navigator decision on 2026-07-05 (`.planning/debug/resolved/card-fire-block-surface.md` Finding 2) intended to stop the backstop over-firing on trivial yes/no confirmation closers ("Want those?"). Its implementation is a pure structural proxy (`gateLabels.length === 2`), which cannot distinguish a yes/no confirmation from a genuine two-way forced-choice strategic fork. Verified directly: reconstructing all 3 of the intern's forks as fully shape-matched, cue-framed numbered lists and running them through `classifyCardFire()` at beta.13 HEAD, all 3 short-circuit to `gate-is-simple-binary` and are NOT intercepted, because all 3 are genuine two-option choices. This holds independent of gap 1 - even a "properly shaped" rendering would still be exempted.

Both gaps compound and are individually sufficient: the intern's forks (rendered as flat prose) never reach the shape gate at all (gap 1); and even in a hypothetical shape-matched rendering, the binary exemption (gap 2, pre-existing since beta.10, not a CR-05 artifact) would still block interception. This is a fourth distinct defect in this same enforcement mechanism (siblings: leaked-slug and the binary-exemption's own introduction in `card-fire-block-surface.md`; the numbered-list-shape false-positive fixed by CR-05 in `backstop-benign-list-defeats-relevance-gate.md`; the PRIMARY-arm relevance tautology in `recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md`). None of those three prior fixes address or overlap with gap 2's over-broad scope (cardinality-only binary detection swallowing genuine 2-option forks) or gap 1 (no detection surface for pure narrative-prose forks).

Blind spot / not fully verified: whether the PRIMARY detection path (render-coverage-registry side-channel, `ran_entries`) would have caught any of these 3 turns independent of the BACKSTOP text-scan is not established here - that depends on whether the surface(s) that rendered these forks are registered as `card-emission` entries in `data/render-coverage-registry.json` and wired to `card-fire-sidechannel.cjs`, which is outside this diagnose-only session's scope (no live transcript/session_id available to replay). If PRIMARY was live and wired for the surface in question, gap 2 (`gate-is-simple-binary`) would still have exempted it regardless (the exemption applies after either PRIMARY or BACKSTOP produces a hit), so this blind spot does not change the root-cause conclusion, only whether gap 1 was also a contributing factor for these specific turns.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

1. `lib/core/gate-relevance.cjs`: extract a new exported `isYesNoShapedGate(gateLabels)` predicate from `gateAlreadyAnswered`'s existing inline yes/no prefix check (exactly 2 labels, one starts with `yes`, the other with `no`); refactor `gateAlreadyAnswered`'s branch (c) to call it instead of duplicating the logic.
2. `scripts/check-card-fire.cjs`: change the `gate-is-simple-binary` condition in `classifyCardFire()` from the bare `gateLabels.length === 2` to `gateRelevance.isYesNoShapedGate(gateLabels)`, so only yes/no-shaped 2-option closers are exempted; a genuine 2-option fork now falls through to the final intercept and force-fires.

DONE. Both changes applied.

## Tests to Add or Update

DONE, all in `tests/test-card-fire-relevance-gate.cjs` (the existing file covering this exemption, per Reuse Before Build):
- Leg 4 (`BINARY_DRAFT_GATE`, pre-existing fixture): assertion flipped from "exempt" to "force-fires" -- this fixture is a genuine non-yes/no 2-option fork and was itself proof of the bug before the fix.
- Leg 5 (new, `RELEASE_GATE_UNANSWERED`): a genuine yes/no-shaped 2-option closer, relevant but unanswered, still passes as `gate-is-simple-binary` -- proves the exemption was narrowed, not removed.
- Legs 6-8 (new): the 3 intern-quoted fork phrasings verbatim, reconstructed as numbered-prose gate renderings (this worktree has no `GATE_FRAMING_RE` co-requirement -- that is CR-05, out of scope here per Current Focus), each asserted to now force-fire instead of being classified `gate-is-simple-binary`.

All 8 legs in the file pass; `bash tests/run-all-209.sh` (9/9) and `bash tests/run-all-210.sh` (14/14) both green; `tests/test-ga4-card-fire-interceptor.cjs` (26/26), `tests/test-ga4-card-fire-e2e-179.cjs` (47/47), `tests/test-209-card-fire-gate.cjs` (7/7), and `tests/test-209-primary-sidechannel.cjs` (12/12) all still pass unmodified (no regression to the leaked-slug fix, the PRIMARY-arm relevance fix, or any Phase 209/210 floor already present in this worktree).

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: DONE - Fixed entry added under the v1.15.3-beta.13 Unreleased section.
- knowledge-base.md: PENDING - append on resolve, after human verification confirms the fix (per protocol, archive_session step, not before).
- Cross-check `intern-w1-mode-gate-skip.md` before closing: DONE - re-read; its root cause (session-start mode-selection gate has zero detectable signal at either PRIMARY or BACKSTOP layer, `build-render-coverage.cjs` never scans `skills/*/SKILL.md`, `check-shape-declaration.cjs`'s `excludedOk` guard) is a STRUCTURALLY DIFFERENT defect in different files (`scripts/build-render-coverage.cjs`, `scripts/check-shape-declaration.cjs`, `skills/conversation-mode/SKILL.md`), not shared with this fix. No overlap, no double-fix risk. Left untouched, as instructed (no file overlap with the sibling worktree's `intern-w1-mode-gate-skip.md` fix either).
- Gap 1 (the structural shape-detection gap: free-flowing narrative prose never matches `ASCII_BOX_GLYPH_RE`) remains OUT OF SCOPE, unchanged, exactly as before -- this fix addresses gap 2 (the policy gap) only, per the explicit fix-direction instructions.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: `classifyCardFire()`'s `gate-is-simple-binary` exemption (`scripts/check-card-fire.cjs`, commit `560753ed`, shipped in beta.10, untouched by CR-05) unconditionally exempted ANY gate with exactly 2 extracted option labels from the force-fire requirement, using a bare `gateLabels.length === 2` cardinality check that could not distinguish a trivial yes/no confirmation closer ("Want those?") from a genuine two-way forced-choice strategic fork ("run research vs build the plan"). All 3 of the intern's missed forks carried exactly 2 labels and were swallowed regardless of content. (Gap 1, the structural shape-detection gap, remains a separate, out-of-scope, unfixed issue -- see Technical Root Cause above.)
fix: Extracted the existing semantic yes/no-shape check already used by `gateAlreadyAnswered` (one label starts with "yes", the other with "no") into a new exported `isYesNoShapedGate(gateLabels)` in `lib/core/gate-relevance.cjs`; `gateAlreadyAnswered` now calls it instead of inlining the check. `scripts/check-card-fire.cjs`'s `gate-is-simple-binary` branch now calls `gateRelevance.isYesNoShapedGate(gateLabels)` instead of `gateLabels.length === 2`. A genuine 2-option fork whose labels are not yes/no-shaped now falls through to the final intercept and force-fires, exactly like a 3+-way fork; a real yes/no closer stays exempt (narrowed, not removed).
verification: Self-verified. `node tests/test-card-fire-relevance-gate.cjs` 8/8 (2 new legs, 1 corrected leg, 3 new intern-regression legs). `bash tests/run-all-209.sh` 9/9 PASS. `bash tests/run-all-210.sh` 14/14 PASS. `node tests/test-ga4-card-fire-interceptor.cjs` 26/26. `node tests/test-ga4-card-fire-e2e-179.cjs` 47/47. `node tests/test-209-card-fire-gate.cjs` 7/7. `node tests/test-209-primary-sidechannel.cjs` 12/12. `node -c` syntax check clean on all 3 touched files. No em-dashes. Awaiting human verification of the real end-to-end harness behavior before archiving (per protocol; the card-fire-block-surface reopen lesson in the knowledge base is that a fix unverified against the live Claude Code harness can rest on a false premise).
files_changed:
  - lib/core/gate-relevance.cjs
  - scripts/check-card-fire.cjs
  - tests/test-card-fire-relevance-gate.cjs
  - CHANGELOG.md
  - .planning/debug/intern-w1-card-discipline-decay.md
commits: []
