---
status: resolved
kind: rca
trigger: "backstop-benign-list-defeats-relevance-gate"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [11, 12]
created: 2026-07-05T23:15:37Z
updated: 2026-07-11T00:00:00Z
---

## Reasoning Checkpoint (pre-fix, 2026-07-11)
<!-- Structured reasoning gate before code changes -->

reasoning_checkpoint:
  hypothesis: "The BACKSTOP force-fires on benign numbered lists because ASCII_BOX_GLYPH_RE alternative 4 (bare 1./2. prose, Phase 209-07) counts as a gate on SHAPE alone, with no requirement that the text pose a choice."
  confirming_evidence:
    - "Live-executed classifyCardFire returned {intercept:true, reason:'ascii-box-backstop-no-card'} for a benign on-topic 3-item next-steps list (Evidence 2026-07-05)."
    - "The 2-item variant escaped only by accidental zero token-overlap, not by any gate-vs-not distinction (Evidence 2026-07-05)."
    - "ASCII_BOX_GLYPH_RE alternative 4 is a pure shape match; the file's own comment says it was broadened Phase 209-07 to catch numbered-prose gates."
  falsification_test: "If a benign numbered list with NO choice-framing cue still intercepts after adding GATE_FRAMING_RE gating on the alternative-4 path, the hypothesis (shape-only over-match) is wrong."
  fix_rationale: "Gate alternative-4 hits on a nearby choice-framing cue (GATE_FRAMING_RE). A benign Action Footer carries no such cue, so it stops force-firing; a genuine hand-rolled fork (which/pick/?) still carries one, so the Phase 209 floor survives. Alternatives 1-3 (bracket notation) stay unconditional."
  blind_spots: "Framing allow-list breadth: too narrow drops genuine forks (regression), too wide re-admits benign lists. Mitigated by keeping the existing Phase 210 relevance-gate legs green plus two new directional tests. Item 2a (reason-calming) rests on a live observation that Claude Code shows reason regardless of systemMessage; verified only that turnContextHash never reads reason so the retry key is unaffected."

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (live-verified, see Evidence, not just code reading). The BACKSTOP arm of `scripts/check-card-fire.cjs::classifyCardFire` misclassifies ordinary benign numbered lists (Action Footers, step-by-step explanations, "next you could" suggestions) as unfired Decision Gates. Two compounding gaps: (a) `ASCII_BOX_GLYPH_RE` alternative 4 (bare `1. / 2.` numbered-prose, added Phase 209-07) matches ANY 2+-item numbered list regardless of whether it poses a choice; (b) `gateTopicallyRelevant`'s BACKSTOP-arm comparison is `precedingUserText` vs the ENTIRE current-turn `outputText` (since `gate_subject_text` is only ever populated on the PRIMARY arm, per the 2026-07-05 fix / quick task 260705-x85) -- a near-tautology, since any reply sharing so much as one substantive word with the user's own message reads as "relevant," which is true of nearly all coherent, specific replies. The `gate-is-simple-binary` exemption (`length === 2`) only coincidentally saves some 2-item lists and never saves the 3-item lists the project's OWN ui-system Action-Footer rule mandates ("always suggest 2-3 next commands") or any longer list.
test: Live-executed via the real `classifyCardFire`/`deriveTurnSignals` seam (the same harness `tests/test-card-fire-relevance-gate.cjs` uses), not just code reading -- see Evidence.
expecting: A benign, on-topic, 3-item "next steps" reply with no `AskUserQuestion` tool_use should NOT intercept. It DOES.
next_action: DECIDED 2026-07-11 (navigator, via /goal): implement Change 1 (the framing co-requirement) and its tests now. Change 2 stays optional/TBD per its own text -- implement only if Change 1 alone does not close the two tests below. Also fold in the two cross-referenced, same-mechanism follow-ups below (both approved by the same /goal directive, same session):
  1. `.planning/debug/resolved/card-fire-block-surface.md` Finding 1 needs REOPENING, not just cross-referencing: live evidence this session (2026-07-11) shows the raw `reason` slug (`ascii-box-backstop-no-card`) still reaches the user as "Stop hook error: ascii-box-backstop-no-card" even though `buildEnforcementEnvelope`'s intercept branch DOES set `systemMessage` (confirmed present in the running v1.15.3-beta.12 install). The RCA's premise -- "Claude Code surfaces `reason` as `Stop hook error:` ONLY when no `systemMessage` override is present" -- is FALSE; Claude Code shows both regardless. That RCA's own Tests section says "Not yet written," which is how this slipped through unverified. Fix: change `reason` on the intercept branch (and the degrade branch, same exposure) to a calm, human-safe phrase; do NOT delete the slug entirely, relocate it to the new diagnostic log (item 2 below) so telemetry is preserved. Confirm via `turnContextHash()` that retry-key identity never reads `reason` (only `session_id` + `gate_signature`) before changing its content, and add a test for that non-effect.
  2. `.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`'s still-open "backstop-trigger mystery" (its Secondary/unexplained anomaly, NOT its headline stale-cache finding) reproduced AGAIN this session (2026-07-11, a third, unrelated transcript/session/date), evidence appended there directly. Since the trigger mechanism itself remains unconfirmed after two independent forensic passes, do not guess a fix for it here. Instead add the diagnostic log that RCA's `next_action` already calls for: a LOCAL-only (Part 8: local disk, never Brain/network) append-only JSONL at `~/.mindrian/card-fire-intercepts.log`, written whenever `classifyCardFire` returns `intercept:true` or `degrade:true`, capturing `{ timestamp, session_id, reason, gate_signature, ran_entries, matched_glyph_span (new small helper returning the actual ASCII_BOX_GLYPH_RE match, not just a boolean), output_text (truncated ~4000 chars) }`. TTL-prune or rotate like the existing retry side-file so it cannot grow unbounded. This turns the NEXT occurrence into a one-log-read diagnosis instead of the multi-hour forensic reconstruction both this session and the 2026-07-06 session had to do.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.11 (local / origin main). The machine's INSTALLED plugin cache is still 1.15.3-beta.10 (one behind) -- `claude plugin update` has not been run since beta.11 landed.
- Reported by: Jonathan (live symptom pasted verbatim from a terminal: "Stop hook error: ascii-box-backstop-no-card" / "Stop hook feedback: This turn REACHED a Decision Gate but did NOT..." -- his own paste is truncated at "did NOT", source session not located)
- Date first observed: recurring across 15+ distinct sessions per transcript grep on this machine (`grep -rl "ascii-box-backstop-no-card" ~/.claude/projects/-home-jsagi/*.jsonl`); the mechanism has existed since Phase 209-07 introduced glyph alternative 4
- Related debug sessions:
  - `.planning/debug/resolved/card-fire-block-surface.md` (2026-07-05, RESOLVED) -- fixed 2 DIFFERENT defects in the same file/function: leaked reason-as-fake-error (now supplemented with a `systemMessage`; this explains the "Stop hook feedback:" line in the user's paste) and over-firing on exactly-2-option binaries (`gate-is-simple-binary`, `=== 2`). Neither fix touches this report's mechanism.
  - `.planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md` (2026-07-05, status: investigating, but only on an unrelated open Finding 1) -- its Finding 2 (CONFIRMED + FIXED, commits `3fd9b81b`/`3ff24877`/`62b09ee8`) fixed the exact same "tautological relevance check" defect for the PRIMARY arm only, by threading `gate_subject_text`. Its own fix description explicitly states the BACKSTOP arm "is untouched" -- this report is that untouched sibling, made concrete with a live repro.
  - Room repo (`/home/jsagi/`, the consulting-room workspace) `.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md` -- the user's own prior capture of the PRIMARY-arm symptom, already superseded by the fix above. This RCA is the BACKSTOP-arm counterpart that todo did not cover, and that error id (`reached-registry-gate-no-card`) is NOT this report's error id (`ascii-box-backstop-no-card`) -- confirmed a different code path, not a duplicate.

## Problem Statement

The Stop-hook backstop in `scripts/check-card-fire.cjs` hard-blocks turn continuation on ANY ordinary numbered list of 3+ items (e.g. a mandatory Action-Footer "next 2-3 commands" suggestion, or a plain step-by-step explanation) that shares any incidental vocabulary with the user's preceding message, misclassifying it as an unfired Decision Gate.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A benign, non-gate numbered list (Action Footer, step list, "here's what you could try") with no `AskUserQuestion` tool_use does not block the turn.
actual: `classifyCardFire` returns `{intercept: true, reason: 'ascii-box-backstop-no-card'}` for such text, hard-blocking with a Stop-hook `decision:'block'` envelope; user-visible as "Stop hook error: ascii-box-backstop-no-card" plus "Stop hook feedback: This turn REACHED a Decision Gate but did NOT fire the card..." (paraphrased -- the user's own paste is truncated at "did NOT").
errors: `ascii-box-backstop-no-card` (Stop-hook block reason, `scripts/check-card-fire.cjs:518`)
reproduction:
  1. Live-verified via node, requiring `scripts/check-card-fire.cjs` directly (scratch script, not committed to the repo).
  2. Build a synthetic Stop transcript: user turn = "Can you help me fix the auth bug in the login flow?"; assistant turn = a bug-fix explanation ending in a plain 3-item numbered "Next you could:" list; no `AskUserQuestion` tool_use anywhere.
  3. Run `checkCardFire.deriveTurnSignals(env)` then `checkCardFire.classifyCardFire(turn, registry)` (the exact seam `tests/test-card-fire-relevance-gate.cjs` uses).
  4. Observe: `{"intercept":true,"reason":"ascii-box-backstop-no-card","degrade":false}`.
started: mechanism introduced Phase 209-07 (glyph alternative 4, "numbered-prose gate"); the tautological-relevance half predates that (`gateTopicallyRelevant` has always been fed `outputText` on the BACKSTOP arm; only the PRIMARY arm got a real subject-text fix, on 2026-07-05).

## Scope and Impact

- Affected surfaces: cli (transcript-based reproduction; Desktop/Cowork not yet checked, but the mechanism is transcript-driven and surface-agnostic by construction)
- Affected commands: none specifically -- ANY assistant turn that ends a reply with a 3-or-more-item numbered list, including the platform's OWN mandatory ui-system Action Footer ("always suggest 2-3 next commands") when rendered as `1. / 2. / 3.` prose rather than the sanctioned glyph vocabulary
- Affected users: all installs from Phase 209-07 through present (1.15.3-beta.11 local / beta.10 installed)
- Version range: Phase 209-07 - present
- Severity: high -- confirmed firing across 15+ distinct sessions on this machine alone; each firing forces an irrelevant `AskUserQuestion` card or silently degrades after `MAX_FORCE_RETRIES`/`MAX_SESSION_INTERCEPTS`, both of which erode the Part 12 "invisible when the insight lands" pedagogy goal and match the user's own standing watch note (`feedback_1_15_enforcement_regression_watch.md`: "hard-fail compliance checks may have replaced judgment calls")
- Blast radius: only `classifyCardFire`'s BACKSTOP arm (`primaryHit` false, `backstopHit` true); the PRIMARY arm (registry-keyed) is unaffected by this report -- it has its own, already-fixed, sibling defect

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: This is the same defect as `card-fire-block-surface.md` (leaked slug / 2-option binary over-fire).
  evidence: That fix's `systemMessage` addition explains the "Stop hook feedback:" line but does not touch `classifyCardFire`'s control flow for 3+-item lists. That fix's `gate-is-simple-binary` exemption is `=== 2` and structurally cannot save a 3-item list. Live-verified: a 2-item version of the benign list (Scenario 2 below) DID pass, but NOT via `gate-is-simple-binary` -- it passed via `gate-irrelevant-to-turn`, by accident of word choice, not by the binary exemption. Different mechanism, only coincidentally overlapping on item count.
  timestamp: 2026-07-05T23:15:37Z
- hypothesis: This is the recurring-reach-card RCA's still-open item.
  evidence: That RCA's only open item is Finding 1 (an HSI score-clamp bug in `lib/agents/auto-explore-agent.cjs`), unrelated code. Its Finding 2 (the relevance-gate tautology) is CLOSED, and closed specifically by excluding the BACKSTOP arm from the fix (confirmed by reading both the code comment at `check-card-fire.cjs:475-486` and that RCA's own Resolution section).
  timestamp: 2026-07-05T23:15:37Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-05T23:15:37Z
  checked: `scripts/check-card-fire.cjs:217-238` (`ASCII_BOX_GLYPH_RE`) and `:493-497` (`gateSubjectText` fallback)
  found: alternative 4 of the glyph regex matches any `(?:^|\n)1[.)]\s+\S...\n2[.)]\s+\S` span with no requirement that the text pose a choice. `gateSubjectText` falls back to the full `outputText` whenever `t.gate_subject_text` is unset, which is ALWAYS true on the BACKSTOP arm (no PRIMARY producer runs there, per the file's own Phase 210-05 comment at line 486).
  implication: shape-matching alone cannot distinguish a genuine fork from a benign enumeration of the same size, and the relevance check compares against the wrong scope (the whole reply, not "the gate") on this arm.
- timestamp: 2026-07-05T23:15:37Z
  checked: live execution of `classifyCardFire`/`deriveTurnSignals` against a synthetic benign 3-item "next steps" reply, on-topic with the preceding user turn (shares the token "auth")
  found: `{"intercept":true,"reason":"ascii-box-backstop-no-card","degrade":false}`
  implication: CONFIRMS the false positive live, not just by code reading.
- timestamp: 2026-07-05T23:15:37Z
  checked: the same benign-list shape trimmed to exactly 2 items, worded so it happens to share ZERO tokens with the user's preceding turn
  found: `{"intercept":false,"reason":"gate-irrelevant-to-turn","degrade":false}` -- passes, but NOT via the `gate-is-simple-binary` exemption; via accidental zero token-overlap instead.
  implication: whether a benign list escapes the backstop is governed by incidental vocabulary overlap between the ENTIRE reply and the user's message, not by anything related to whether the list is actually a decision gate. A more detailed/specific benign reply (the norm) is LESS likely to escape than a terse generic one -- backwards from what a safety mechanism should reward.

## Technical Root Cause

- Site: `scripts/check-card-fire.cjs:217-238` (`ASCII_BOX_GLYPH_RE`), `:493-497` (`gateSubjectText` fallback), `:497` (`gateTopicallyRelevant` call site); `lib/core/gate-relevance.cjs:194-216` (`gateTopicallyRelevant` itself)
- Cause: two compounding gaps, neither yet fixed. (1) Glyph alternative 4 detects list SHAPE only, with no requirement that the text pose a choice. (2) On the BACKSTOP arm, `gateTopicallyRelevant` is handed the entire current-turn `outputText` (never a real "gate subject") as both the thing-to-check-relevance-of and the source of `gateTokens`, so it compares the model's own reply against itself relative to the user's turn -- structurally near-guaranteed to overlap for any coherent, specific reply.
- Why it surfaces now: alternative 4 shipped in Phase 209-07 specifically to broaden detection beyond bracket notation. Broadening the SHAPE match without adding a semantic co-requirement turned every ordinary 3-item (or accidentally vocabulary-overlapping N-item) list into a candidate false positive. It compounds with the platform's OWN mandatory Action-Footer convention (2-3 suggested next commands), which is the same shape as a genuine Shape-F gate (`MAX_K=3`) by design -- so the false-positive and true-positive cases are structurally identical in size and cannot be told apart by counting.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `scripts/check-card-fire.cjs:217-238` (`ASCII_BOX_GLYPH_RE` construction and its use at `:434`)
  - Current behavior: alternative 4 (bare numbered-prose) counts as a backstop hit on shape alone.
  - Required behavior: alternative 4 only counts as a backstop hit when the matched span (or a short window before it, e.g. 150 chars) also carries a choice-framing cue: a `?`, or one of a small allow-list (`which`, `would you like`, `pick one`, `choose`, `select one`, `type 1`). Alternatives 1-3 (bracket notation, the literal "type 1, 2, or 3" phrase, multiline bracket box) are already shape-specific enough and stay unconditional.
  - Short-term patch: add a `GATE_FRAMING_RE` and require it to match near an alternative-4-only hit before setting `backstopHit`.
  - Long-term fix: consider whether alternatives 1/3 (bracket notation) deserve the same framing co-requirement, since the platform's own sanctioned glyph vocabulary could in principle also render a benign bracketed list. Not yet observed in practice, so not proposed as an immediate change.
- Change 2:
  - Location: `scripts/check-card-fire.cjs:494-497`; `lib/core/gate-relevance.cjs` (no change to the function itself, only to what is passed as `gateText`)
  - Current behavior: the BACKSTOP arm always compares `precedingUserText` against the entire `outputText`.
  - Required behavior: TBD -- needs a human decision. There is no "real" `gate_subject_text` on the BACKSTOP arm the way there is on PRIMARY (nothing produced the text but the model itself, this turn). One option: narrow `gateText` to a window around the matched glyph span instead of the whole message, so the comparison is at least local to the candidate gate, not the whole reply.
  - Short-term patch: none proposed -- Change 1 (the framing co-requirement) is the higher-leverage fix and may make Change 2 unnecessary in practice.
  - Long-term fix: TBD, pending Change 1's effectiveness once shipped.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-card-fire-relevance-gate.cjs` (extend)
  - Given: an on-topic assistant reply ending in a plain 3-item numbered "next steps" list, no `AskUserQuestion` tool_use
  - When: `check-card-fire.cjs`'s Stop hook logic runs
  - Then: `intercept` is `false` (not a genuine gate)
  - Runner registration: `tests/run-all-210.sh` (or the relevant card-fire suite)
- Test 2:
  - Type: integration
  - Location: `tests/test-card-fire-relevance-gate.cjs` (extend)
  - Given: a genuine hand-rolled decision gate (bracket-free, `1. / 2. / 3.` prose, WITH a "which/would you like/pick" framing cue), no `AskUserQuestion` tool_use
  - When: `check-card-fire.cjs`'s Stop hook logic runs
  - Then: `intercept` is `true` (the Phase 209 floor must survive Change 1)
  - Runner registration: same suite

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry once a fix lands.
- knowledge-base.md: on resolve, add a summary block cross-referencing `card-fire-block-surface.md` and `recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md` as siblings (this is the third distinct defect found in the same enforcement mechanism).
- Release lockstep: this machine's installed cache (beta.10) is already one behind local/origin (beta.11, which carries the PRIMARY-arm sibling fix) -- `claude plugin update` is pending regardless of this RCA.
- Canon: Part 11/12 already declared above; no new canon concept introduced.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED. The BACKSTOP force-fired on benign numbered lists because `ASCII_BOX_GLYPH_RE` alternative 4 (bare `1. / 2.` numbered-prose, Phase 209-07) counted as an unfired Decision Gate on SHAPE alone, with no requirement that the text pose a choice; compounded by the BACKSTOP-arm's tautological relevance check (user turn vs the model's own reply).
fix: IMPLEMENTED (navigator-approved 2026-07-11, one /goal directive), all in `scripts/check-card-fire.cjs`:
  - CR-05 (Change 1): new `GATE_FRAMING_RE` + `computeBackstopHit()`. Alternative 4 counts as a backstop hit ONLY when a choice-framing cue (`?`, or one of `which / would you like / pick / choose / select / type 1`) sits inside the matched span or within `GATE_FRAMING_WINDOW` (~150) chars before it. Alternatives 1-3 stay unconditional. `ASCII_BOX_GLYPH_RE` itself is byte-identical (retry-key signature + Phase 209 regex tests untouched). Change 2 was NOT needed -- Change 1 alone closed both directional tests, so it stays unimplemented per its own text.
  - CR-06 (item 2a, card-fire-block-surface Finding 1 real fix): `buildEnforcementEnvelope` `reason` is now a calm human-safe phrase on BOTH the intercept and degrade branches, never the slug (Claude Code renders `reason` verbatim regardless of `systemMessage`). Confirmed `turnContextHash` never reads `reason` before changing it (asserted by Test 3).
  - CR-07 (item 2b): new LOCAL append-only JSONL `~/.mindrian/card-fire-intercepts.log`, written on intercept OR degrade, preserving the ORIGINAL slug + `session_id`, `gate_signature`, `ran_entries`, `matchedGlyphSpan` (new helper), truncated `output_text` (~4000). TTL-pruned by the same `RETRY_TTL_MS` as the retry side-file. Canon Part 8: LOCAL disk only.
verification: `tests/test-card-fire-relevance-gate.cjs` 7/7 (4 existing legs + 3 new). `tests/test-ga4-card-fire-interceptor.cjs` 27/27 (reason assertion updated to CR-06). `bash tests/run-all-209.sh` 9/9. `bash tests/run-all-210.sh` and `run-all-179.sh`: all card-fire legs green (each has ONE pre-existing unrelated failure -- stamp-sweep on eureka.md/find-analogies.md, and b1-reconcile -- both fail on clean main too, confirmed by stash). `scripts/verify-release` 26 passed / 0 failed. End-to-end smoke: framed gate intercepts with a calm envelope reason and the log preserves the slug; a benign list is a silent no-op with no log written.
files_changed: scripts/check-card-fire.cjs, tests/test-card-fire-relevance-gate.cjs, tests/test-ga4-card-fire-interceptor.cjs, CHANGELOG.md, ~/MindrianOS/research/2026-07-11-card-fire-backstop-hardening/README.md (rethinking-mindrianos mirror PENDING a user room switch -- see below).
commits: ready for commit (not committed)
