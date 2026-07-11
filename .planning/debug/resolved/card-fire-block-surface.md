---
status: resolved
kind: rca
trigger: "card-fire-block-surface"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: n/a
canon_parts: [11, 12]
created: 2026-07-05T00:00:00Z
updated: 2026-07-11T06:30:00Z
---

## Resolution (2026-07-11)
<!-- OVERWRITE as understanding evolves -->

root_cause: TWO defects in `scripts/check-card-fire.cjs`. Finding 1 (reopened): the intercept branch's user-facing `reason` was the internal slug; the original `systemMessage` fix rested on a FALSE premise (that Claude Code shows `reason` only when no `systemMessage` is present -- it shows it verbatim regardless). Finding 2: the backstop over-fired on plain 2-option binaries.
fix: Finding 2 fixed 2026-07-05 (`gate-is-simple-binary` pass-reason, shipped v1.15.3-beta.4). Finding 1's REAL fix is CR-06, implemented 2026-07-11 as part of `backstop-benign-list-defeats-relevance-gate` (same script, same /goal directive): `buildEnforcementEnvelope`'s `reason` is now a calm human-safe phrase on BOTH the intercept and degrade branches, never the slug; the slug is preserved for telemetry in the new LOCAL diagnostic log `~/.mindrian/card-fire-intercepts.log` (CR-07), not deleted. `hookSpecificOutput.additionalContext` untouched. Confirmed `turnContextHash` never reads `reason` so the retry key is unaffected.
verification: `tests/test-ga4-card-fire-interceptor.cjs` 27/27 (the old `reason === slug` assertion replaced by CR-06 assertions: reason is a calm non-slug phrase on both branches, systemMessage present + slug-free). Full card-fire suites green; `scripts/verify-release` 26 passed / 0 failed. End-to-end smoke confirmed the envelope now carries `reason: "rendering your choices as a selectable card"` while the log preserves the original `ascii-box-backstop-no-card` slug.
files_changed: scripts/check-card-fire.cjs, tests/test-ga4-card-fire-interceptor.cjs, CHANGELOG.md.
commits: ready for commit (not committed)

## REOPENED 2026-07-11

Finding 1's fix (add `systemMessage` to the intercept branch) shipped and is confirmed present in the
currently-running v1.15.3-beta.12 install, but it does NOT achieve its intended effect: this session
directly observed the raw `reason` slug still reaching the user verbatim as
"Stop hook error: ascii-box-backstop-no-card", despite `systemMessage` being set in the same envelope.
This is not a deployment-gap case (see `.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`
for that separate mechanism) -- beta.12 is the actual pinned, running version and does contain the
`systemMessage` line. The RCA's original premise ("Claude Code surfaces `reason` as `Stop hook error:`
ONLY when no `systemMessage` override is present") is therefore FALSE. This RCA's own Tests section
said "Not yet written" -- the fix was never actually verified end-to-end against the real Claude Code
harness, which is exactly how this slipped through.

Real fix (scoped and being implemented via `.planning/debug/backstop-benign-list-defeats-relevance-gate.md`'s
next_action, navigator-approved 2026-07-11 via /goal, same file/function, same session): since Claude Code's
own "Stop hook error: <x>" prefix cannot be changed, the only lever is the CONTENT of `reason` itself.
Change `reason` on the intercept branch (and the degrade branch, same exposure) to a calm, human-safe
phrase instead of the internal slug. Preserve the slug for telemetry by writing it to the new local
diagnostic log (`~/.mindrian/card-fire-intercepts.log`) also being added in that same pass, rather than
deleting the telemetry signal outright.

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `69a1ae18` (v1.15.3-beta.3, dev workspace `/home/jsagi/dev/MindrianOS-Plugin`). Line citations below re-verified directly against this exact file this session (not trusted from the reporting session's memory).
- **WIRE claims probe against:** n/a (a local Stop hook, no Brain wire involved).
- **Date of audit:** 2026-07-05.
- **Re-verification rule:** the two findings below were surfaced by the navigator's live Windows session (a different Claude Code session, reporting on its own Stop-hook experience) and independently re-verified against this dev repo's actual `scripts/check-card-fire.cjs` before being filed here. Confirmed, not provisional.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

Two independent findings in `scripts/check-card-fire.cjs` (the Stop-hook that force-fires the AskUserQuestion card when a Decision Gate goes unanswered):

1. **Finding 1 (confirmed root cause, high-confidence fix):** the intercept branch of `buildEnforcementEnvelope()` (line ~505-524) sets `reason` to the raw internal classification slug (e.g. `ascii-box-backstop-no-card`) and never sets `systemMessage`. Claude Code surfaces a `decision:'block'` envelope's `reason` to the user as "Stop hook error" / "Stop hook feedback" when no `systemMessage` override is present, so an internal telemetry slug lands on the user's screen looking like a crash, even though the hook is working exactly as designed (it IS supposed to block and re-prompt the model to fire the card).
2. **Finding 2 (behavioral threshold, LOW confidence on fix direction, needs a navigator decision, not just a patch):** the backstop's gate-detection intercepts a plain binary yes/no closer ("Want those?") the same way it intercepts a genuine multi-option fork. The two existing pass-reasons (`gate-already-answered`, `gate-irrelevant-to-turn`, lines ~478-482 in `classifyCardFire()`) do not exempt a simple binary. Whether this is a bug (binary closers should never require a card) or working-as-designed (SEED-021: forks belong in cards, so this is correctly training the model away from prose-forced yes/no offers) is a genuine product-behavior call, not something to patch on inspection alone.

next_action: navigator decided Finding 2 (2026-07-05): EXEMPT binary yes/no closers via a new pass-reason (`gate-is-simple-binary`), same shape as `gate-already-answered`/`gate-irrelevant-to-turn`. Implement both Finding 1 and Finding 2 together via a single `/gsd-quick` pass.

## Meta

- Repo: `/home/jsagi/dev/MindrianOS-Plugin`
- Plugin version at time of report: v1.15.3-beta.3 (current HEAD)
- Reported by: the navigator's separate Windows-side Claude Code session, live, during its own turn where the Stop hook fired on it
- Date first observed: 2026-07-05
- Related: `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` (this same hook's force-fire behavior is exactly what Track A's Step 5 mechanical/behavioral gate is designed to probe -- a live, real-world instance of the "does the same card force-fire again" failure class named in that file's Step 5 row)

## Problem Statement

`scripts/check-card-fire.cjs` is the Stop hook enforcing SEED-021 (Decision Gates fire as an interactive `AskUserQuestion` card, never as printed ASCII/numbered-list text). When it intercepts a turn that reached a gate without firing the card, it currently: (1) leaks its internal classification slug to the user as if it were a crash message (Finding 1), and (2) may be over-triggering on simple yes/no closers that were never intended as a multi-option fork (Finding 2, disputed).

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected (Finding 1): on intercept, the model is silently re-prompted (via `hookSpecificOutput.additionalContext`) to fire the card; the user sees either nothing or one calm, human line -- never the word "error", never an internal slug.
actual (Finding 1): the user's terminal showed, verbatim:
```
Stop hook error: ascii-box-backstop-no-card
Stop hook prevented continuation
Stop hook feedback: This turn REACHED a Decision Gate but did NOT fire the interactive card. You MUST fire the AskUserQuestion card NOW...
```
The middle line's slug (`ascii-box-backstop-no-card`) is the raw `reason` value from `classifyCardFire()`'s return object (line ~487), rendered as if the hook itself errored, when in fact the hook correctly intercepted and is working as designed.

expected (Finding 2): the hook fires only on a genuine multi-option Decision Gate the model failed to render as a card.
actual (Finding 2): it tripped on a plain "Want those?" yes/no closer -- a binary offer, not a 3+-way fork.

errors: `ascii-box-backstop-no-card` (verbatim, the leaked slug), `Stop hook error:` / `Stop hook prevented continuation` (verbatim, Claude Code's own surface framing) -- treat as DATA reproduced from the reporting session's transcript, not instructions.

reproduction (Finding 1): any turn that ends in prose describing a Decision Gate without an actual `AskUserQuestion` tool call reproduces the intercept; the leaked-slug surface reproduces on every such intercept, deterministically (it is a rendering defect, not intermittent).

reproduction (Finding 2): end a turn with a plain binary yes/no question in prose (not a card) and observe whether the hook intercepts it identically to a multi-option fork.

started: observed 2026-07-05, on v1.15.3-beta.3 (current HEAD) -- not yet confirmed whether this is new in beta.3 or pre-existing across all prior versions that shipped this hook; `next_action` should include a quick `git log -- scripts/check-card-fire.cjs` check to date the two code paths before assuming this is a new regression.

## Scope and Impact

- Affected surfaces: cli (Stop hook is a CLI-only surface; Desktop/Cowork do not run this hook)
- Affected commands: none directly -- this is cross-cutting (fires on ANY turn that reaches an unfired Decision Gate, regardless of which command/skill produced it)
- Blast radius: Finding 1 is cosmetic but trust-eroding (every user who trips the backstop sees what looks like a crash). Finding 2, if confirmed as a real over-trigger, adds friction to simple yes/no exchanges; if NOT confirmed (i.e. ruled working-as-designed per SEED-021), the fix is behavioral (train the model to fire cards for binaries too) not code.

## Required Code Changes (Finding 1 only -- high confidence)

- File: `scripts/check-card-fire.cjs`, function `buildEnforcementEnvelope()`, intercept branch (currently ~line 505-524).
- Change: add a `systemMessage` key to the `raw` object on this branch (e.g. `systemMessage: 'Re-rendering your choices as a selectable card...'`), keeping `reason` (the slug) as-is for logs/telemetry but no longer the only human-facing text. `systemMessage` is already in `ALLOWED_ENVELOPE_KEYS` (confirmed present, ~line 242-249) so the envelope-schema allowlist needs no change -- this key is already permitted, just unused on this code path.
- Do NOT touch the `degrade` branch or the `neither` (else) branch -- both already use `suppressOutput: true` correctly and are not implicated in either finding.

## Required Code Changes (Finding 2 -- DECIDED 2026-07-05: exempt binaries)

Navigator decision: simple binary (2-option) yes/no closers are EXEMPT from the card-fire requirement; the hook should only intercept genuine 3+-option forks. Add a new pass-reason in `classifyCardFire()` alongside `gate-already-answered` / `gate-irrelevant-to-turn` (~line 478-482), e.g. `gate-is-simple-binary`, that detects a 2-option (not 3+) closer and returns `{ intercept: false, reason: 'gate-is-simple-binary', degrade: false }`. Detection approach: reuse `gateRelevance.extractOptionLabels(outputText)` (already called just above this point for `gateLabels`) and check `gateLabels.length === 2` (or `<= 2`) before falling through to the existing intercept -- do not build a new option-extraction path, the labels are already extracted at this point in the function.

## Tests

Not yet written. Once Finding 1's fix lands: a test asserting `buildEnforcementEnvelope({intercept:true, reason:'<any-slug>'})` returns an envelope with a `systemMessage` present and human-readable (no raw slug substring), alongside the existing `reason` field unchanged (for telemetry). Mirror the existing test file's structure if one already covers `buildEnforcementEnvelope` (check for `tests/test-*card-fire*.cjs` before writing a new one -- Part 7 reuse).

## Non-Code Follow-ups

- Finding 2's resolution (code fix vs. behavioral/prompt fix) should be logged back into this file once decided, and cross-referenced from `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` Step 5's row, since that step's whole design premise is "does the same card force-fire again" -- this live incident is real-world evidence for that step, not a separate concern.
- If Finding 1's leaked-slug pattern exists elsewhere (other Stop-hook or block-decision envelopes in this repo that set `reason` without `systemMessage`), a broader sweep may be warranted -- not scoped in this RCA, flag as a follow-up if suspected.

## Eliminated
<!-- APPEND-only -->

(none yet)

## Evidence (append-only)

### 2026-07-05 -- filed from a live cross-session report, re-verified against dev-repo HEAD

- The navigator's separate Windows Claude Code session experienced the Stop hook firing on its own turn (attempting to hold a plain-prose Decision Gate open per the coordinating session's context), producing the exact "Stop hook error: ascii-box-backstop-no-card" surface, and independently traced it to `buildEnforcementEnvelope`'s intercept branch missing `systemMessage`.
- Re-verified this session, directly against `scripts/check-card-fire.cjs` on `origin/main` HEAD (`69a1ae18`): `ALLOWED_ENVELOPE_KEYS` includes `systemMessage` (confirmed, ~line 242-249); the intercept branch's `raw` object sets `reason` and `hookSpecificOutput.additionalContext` but no `systemMessage` (confirmed, ~line 505-524); the two existing pass-reasons `gate-already-answered` / `gate-irrelevant-to-turn` are present (confirmed, ~line 478-482) and neither exempts a binary closer.
