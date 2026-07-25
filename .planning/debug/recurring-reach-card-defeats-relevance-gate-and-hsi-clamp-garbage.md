---
status: investigating
kind: rca
trigger: "recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [11, 12]
created: 2026-07-05T20:14:32Z
updated: 2026-07-05T20:36:10Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Finding 2 is now CONFIRMED and FIXED (was hypothesis; neither candidate A nor B as originally framed -- see Evidence entry 2026-07-06). The real mechanism: for a PRIMARY (registry side-channel) detection, `scripts/check-card-fire.cjs::classifyCardFire` called `gateRelevance.gateTopicallyRelevant(precedingUserText, outputText)` where `outputText` was NOT the gate's own text (candidate A's framing) but the MODEL'S OWN CURRENT-TURN REPLY -- which naturally echoes the user's topic back (a coherent assistant answers on-topic), so the token-overlap check read "relevant" almost every time regardless of what the stale reach was actually about. This exactly explains the 2026-07-05T20:36:10Z evidence ("find analgies need to get its embbeding research" turn): the assistant's reply to THAT message would itself contain "find"/"analogies"/"embedding"/"research", guaranteeing overlap against precedingUserText, independent of the fired reach's real (unrelated) subject. Fixed today via quick task 260705-x85 (commit `62b09ee8`): the PRIMARY path now threads the reach's own real recorded subject text (`gate_subject_text`, sourced from `lib/core/card-fire-sidechannel.cjs`'s new `subjectText` field, populated at the 3 producer call sites from their own already-in-scope rendered header/body/text) into `gateTopicallyRelevant` instead of `outputText`; the BACKSTOP path (ASCII-box glyph detection, where `outputText` legitimately IS the gate-shaped text) is untouched. Finding 1 (the HSI score-clamp bug in `lib/agents/auto-explore-agent.cjs`) remains OPEN and is unrelated to this fix -- not addressed here, tracked separately below.
test: Finding 2 -- independently re-verified (plan-checker before execution, verifier after, neither trusting the executor's self-report alone): `tests/test-209-primary-sidechannel.cjs` 12/12 (including a new Behavior 9 that replays this exact incident shape and asserts both the fix and the old comparison's failure mode as a documented contrast), `tests/test-card-fire-relevance-gate.cjs` 4/4, `tests/run-all-179.sh` 12/12, `tests/run-all-209.sh` 9/9, `tests/run-all-210.sh` 14/14. Finding 1 -- untested by this session's work, status unchanged from original investigation.
expecting: Finding 2 -- confirmed exactly as described above. Finding 1 -- unchanged, still pending.
next_action: Finding 1 (auto-explore-agent.cjs HSI score clamp) still needs Change 1 from Technical Root Cause below implemented + Test 1 written; not scheduled in this session. This RCA stays `status: investigating` (not `resolved`) until Finding 1 also closes -- do not move to `.planning/debug/resolved/` yet.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.10
- Reported by: Larry (session working in room rethinking-mindrianos), navigator asked "report to mindrianos dev"
- Date first observed: 2026-07-05
- Related debug sessions: .planning/debug/resolved/card-fire-block-surface.md (a DIFFERENT pair of check-card-fire.cjs defects, both already fixed: leaked reason-as-error, and over-firing on 2-option binaries. This report's Finding 2 is not covered by that fix -- the recurring reach card observed here presents 3 options, not 2, so the gate-is-simple-binary exemption does not apply.)

## Problem Statement

In one live session, an auto-explore finding rendered as "<unspecified>: 318.581 (score 1.000)" instead of a readable section-pair differential, and a generic per-turn "Run Methodology" reach-selector card kept reappearing unfired across multiple turns until scripts/check-card-fire.cjs hard-blocked continuation (reached-registry-gate-no-card), even on turns where the user's literal input (a slash command) shared no obvious subject matter with the card's topic.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: (1) auto-explore findings render as "<source_section> * <target_section>: <score in 0.000-1.000>" with the RECOMMENDED gate only firing on genuine high-confidence matches. (2) the engine-fired reach-selector card either gets judged irrelevant and skipped on a turn where the user issued an unrelated explicit command, or fires but only once, not as a recurring unresolved block across many turns.
actual: (1) finding_id 6121c1c971e126e1ac5281f2c84284dc rendered "Top differential: <unspecified>: 318.581 (score 1.000)" -- a raw unnormalized magnitude next to a clamped-to-1.0 confidence label, with both source_section and target_section empty. (2) the identical "Choose next reach: Borrow / Pull up / Hat-spin ... governing_thought:_root" card appeared in the UserPromptSubmit hook context across at least 2 consecutive turns (one turn running /mos:status, one running /mos:brain-derive) without being judged stale, then a Stop hook fired: "Stop hook error: reached-registry-gate-no-card" / "This turn REACHED a Decision Gate but did NOT fire the interactive card."
errors: `reached-registry-gate-no-card` (Stop hook block reason, scripts/check-card-fire.cjs)
reproduction:
  1. Open a room where source/target section identity resolution fails for the auto-explore differential pipeline (observed in rethinking-mindrianos, a non-canonical-section-name dev room -- see next RCA on KNOWN_SECTIONS whitelist for a plausible shared cause).
  2. Let the per-turn navigation engine fire a generic context_block/push_forward reach (fire_skill: "Run Methodology") on a turn where the user's actual input is a short/explicit slash command with no free-text subject overlap with the reach's topic.
  3. Do not fire the AskUserQuestion card for that reach (judgment call: it reads as generic/recurring noise unrelated to the explicit command just run).
  4. Observe: the Stop hook still blocks with reached-registry-gate-no-card on the next turn.
started: first observed this session, 2026-07-05. Not yet checked against earlier plugin versions.

## Scope and Impact

- Affected surfaces: cli (session observed on Claude Code CLI; Desktop/Cowork not yet checked)
- Affected commands: any command run while the navigation engine has an active context_block/push_forward reach queued (observed with /mos:status, /mos:brain-derive); auto-explore finding rendering is independent of which command is running
- Affected users: rooms with thin/ambiguous section identity (new rooms, dev-audit rooms with non-canonical section names) most likely to trip the empty source_section/target_section path
- Version range: 1.15.3-beta.10 (not yet bisected further back)
- Severity: high (raised 2026-07-05T20:36:10Z; confirmed recurring 4+ times in one session, each time interrupting substantive engineering work with no topical connection to the fired gate; user explicitly flagged for registration)
- Blast radius: any sensor-produced finding that goes through populateHSIAnalysis shares Finding 1. Any engine-fired reach card that recurs turn-over-turn under routing_source: engine shares the Finding 2 hypothesis.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: This is the same defect as .planning/debug/resolved/card-fire-block-surface.md (leaked-reason-as-fake-error or 2-option-binary over-fire).
  evidence: The observed card in this session had 3 real options (Borrow / Pull up / Hat-spin) plus Free-Text, not 2 -- the shipped gate-is-simple-binary exemption (gateLabels.length === 2) would not have exempted it even if reached. The systemMessage fix from that RCA also does not touch gateTopicallyRelevant. Different code path, different symptom.
  timestamp: 2026-07-05T20:14:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-05T20:14:32Z
  checked: lib/agents/auto-explore-agent.cjs:473-499 (populateHSIAnalysis)
  found: `const score = Number(finding.score) || 0;` is used RAW in the display string (`top_differential`) via `score.toFixed(3)`, while a SEPARATE clamp `Math.max(0, Math.min(1, score))` produces `top_differential_score` used only for the >=0.7 RECOMMENDED gate. When `score` is a raw unnormalized magnitude (observed: 318.581), the display shows the ugly raw number while the gate silently reads a maxed 1.0 confidence.
  implication: Any upstream branch that emits an unnormalized `score` (see next Evidence row) will always both look confusing AND always satisfy the RECOMMENDED gate, regardless of actual match quality.

- timestamp: 2026-07-05T20:14:32Z
  checked: lib/agents/auto-explore-agent.cjs:312-448 (composeAutoExploreFinding, all 3 candidate branches)
  found: the pairwise branch at line 359-361 sets `score: Math.abs(Number(pair.signed_diff) || 0)` with `source_section`/`target_section` read from `pair.source_section`/`pair.target_section`. `signed_diff` is not visibly bounded to [-1,1] anywhere in this file. This is one plausible origin of a 318.581-magnitude score; not yet confirmed which of the 3 branches produced finding_id 6121c1c971e126e1ac5281f2c84284dc specifically (no per-finding provenance log read yet).
  implication: the fix belongs partly upstream (normalize signed_diff or whatever produces `score` before it reaches populateHSIAnalysis) and partly in populateHSIAnalysis itself (never display an unclamped score, never let an out-of-range score satisfy the confidence gate).

- timestamp: 2026-07-05T20:14:32Z
  checked: lib/core/gate-relevance.cjs:65-216 (gateTopicallyRelevant, MIN_USER_SUBJECT_TOKENS, subjectTokens)
  found: gateTopicallyRelevant defaults to relevant=true (force-fire) whenever the preceding user text yields fewer than 2 subject tokens after dropping words under 4 chars and stopwords (MIN_USER_SUBJECT_TOKENS = 2). A bare slash command like "/mos:status" tokenizes to a single subject token ("status"; "mos" is dropped at 3 chars), so it ALWAYS falls into the conservative-default-true branch regardless of the gate's actual topic.
  implication: for any turn where the user's literal input is a short slash command (the majority of real usage), the Phase 210 relevance softening cannot ever conclude "irrelevant" via this branch -- it structurally defaults to intercept before the token-overlap comparison even runs.

- timestamp: 2026-07-05T20:14:32Z
  checked: scripts/check-card-fire.cjs:475-482 (precedingUserText usage) and the Stop-stdin contract comment at the top of the file
  found: check-card-fire.cjs reads `t.preceding_user_text` from a value already extracted elsewhere (parsed from transcript_path per the file's own header comment) rather than computing it in this excerpt. Did not yet trace the exact extraction function to confirm whether hook-injected system-reminder / UserPromptSubmit additionalContext text (which in this harness appears inside the same human-role turn as the actual typed command, and which itself contains the gate's own topic tokens e.g. "governing_thought") is stripped before being passed to gateTopicallyRelevant.
  implication: if unstripped, the gate's own injected description text would be compared against itself (present in "the user's turn"), guaranteeing token overlap and defeating the relevance predicate for ANY engine-fired reach card, independent of the MIN_USER_SUBJECT_TOKENS branch above. This is the single most valuable trace to run next -- see Current Focus.

- timestamp: 2026-07-05T20:36:10Z
  checked: 4 live occurrences of the identical "Choose next reach... governing_thought:_root, Borrow/Pull up/Hat-spin" card force-firing reached-registry-gate-no-card in one session, each cross-referenced against the actual literal preceding user turn.
  found: on at least one occurrence, the preceding user turn's literal text was "find analgies need to get its embbeding research for it" (sic) -- tokenizing (>=4 chars, non-stopword) to {find, analgies, embbeding, research}, which meets MIN_USER_SUBJECT_TOKENS=2 and shares ZERO plausible prefix-stem overlap with the gate's subject tokens {governing, thought, root, rethinking, mindrianos, borrow, learned, pull, decided, personas, spin}. Per gate-relevance.cjs's own documented algorithm this turn should have returned gateTopicallyRelevant=false. It did not act as such -- the Stop hook force-fired anyway. This rules out the MIN_USER_SUBJECT_TOKENS-floor branch as the (sole) explanation for THIS occurrence.
  implication: strengthens candidate B (check-card-fire.cjs may not invoke gate-relevance.cjs's predicates at all for routing_source:"engine" / reach_id:"context_block" reaches, treating every engine-fired reach as unconditionally must-fire) as at least as likely as candidate A (text leakage). Both remain open; next_action updated to check the call site's gating logic for this reach class specifically before assuming text-leakage is the mechanism.

- timestamp: 2026-07-23 (live session, dev repo, no room bound)
  checked: NOT root-caused this session -- observation only, logged for a future investigation, not attributed to Finding 2's fix scope.
  found: the F.8 room-binding Decision Gate ("-- mindrianOS -- bind session -- select rooms --", `renderRoomChooserCard`-shaped, a different card family from this RCA's "Choose next reach... governing_thought:_root" methodology-selector card) force-fired via `check-card-fire.cjs`'s Stop-hook block at least 4 times across roughly 30 minutes of a single session doing ONLY dev-repo work in MindrianOS-Plugin (a TDS-article research task, then three /gsd-debug sessions, then a /gsd-quick commit) -- no room was ever bound, no room artifact was ever the subject of any turn. Each occurrence showed a DIFFERENT 4-room slice of the full room list with inconsistent checkmarks (e.g. one fire showed "untitled-2026-06-01-1702" pre-checked, the next showed "haim-battlefield-intake" pre-checked, with no session action that plausibly explains the change), consistent with "page 1 of 12" pagination state that is not stable across fires. On the first occurrence the AskUserQuestion card was fired and answered explicitly ("Dev repo only, no room"); the identical gate re-fired anyway on 3 later turns despite that answer, each time as a hard Stop-hook block (not an advisory), forcing the card to be re-fired 3 more times to unblock. On one recurrence, the "Stop hook feedback" context handed back to the model was NOT gate content but a verbatim echo of the model's OWN prior assistant-turn prose (a paragraph explaining unrelated debug findings) -- i.e. whatever produces the Stop-hook feedback text in this path can source content from the wrong side of the transcript entirely, not just misjudge relevance.
  implication: this is a live, reproducible instance of "recurring card defeats relevance/dedup gate" in the SAME bug family this RCA documents (Finding 2), but on a DIFFERENT card producer (F.8 room-binding / renderRoomChooserCard, not the generic methodology reach-selector `selector-dispatcher.cjs`/`intent-classifier.cjs` PRIMARY paths Finding 2's fix at commit 62b09ee8 actually touched). Two candidate explanations, both unconfirmed: (a) the room-binding gate uses its own dedup/relevance path that Finding 2's fix never reached (most likely, given the fix was scoped to specific PRIMARY producer call sites), or (b) a genuinely new defect in how `check-card-fire.cjs` sources "already answered" state for this gate class, since a fire recurred AFTER an explicit AskUserQuestion answer was given -- the answered-gate suppression (`gateAlreadyAnswered` per Finding 2's own fix notes) did not hold across turns for this gate. The echoed-prior-assistant-text occurrence needs its own trace of whatever assembles the Stop-hook feedback payload for this gate. Not investigated further this session (out of scope for the two fixes being committed) -- recommend a dedicated `/gsd-debug` session, likely Finding 3 on this file or a fresh RCA cross-linked here, before assuming Finding 2's fix generalizes to this card family.

- timestamp: 2026-07-25 (live session, room rethinking-mindrianos bound, mid GSD-quick-task cleanup)
  checked: NOT root-caused this session -- observation only, logged per navigator request ("log it"), not attributed to Finding 2's fix scope. A THIRD card producer/shape, distinct from both the methodology reach-selector (Finding 2's fixed scope) and the F.8 room-binding gate (2026-07-23 entry above).
  found: `scripts/check-card-fire.cjs`'s Stop hook hard-blocked continuation with the literal block reason `"rendering your choices as a selectable card"` on a turn whose entire user input was a plain reflective question ("what did we learn then about mindrianos ?") -- not a slash command, not a Decision Gate fork, no options of any kind attached to the block reason. The text `"rendering your choices as a selectable card"` does not read as gate content (no room list, no reach list, no options) -- it reads like a FRAGMENT of instruction/prompt language (e.g. from this repo's own "Decision Gates -- fire the card" guidance) leaking into the Stop-hook feedback payload, a third variant of the "wrong side of the transcript" mechanism the 2026-07-23 entry above already flagged once (there: a full echoed assistant paragraph; here: what looks like an echoed instruction fragment, not transcript content at all).
  implication: strengthens candidate (b) from the 2026-07-23 entry -- whatever assembles the Stop-hook feedback payload for at least one gate class can source content that is neither the real gate's options NOR genuine prior transcript text, meaning the defect is broader than "stale gate re-fires unanswered" and touches payload ASSEMBLY itself. Still Finding 3 (unconfirmed, not root-caused): needs a trace of `check-card-fire.cjs`'s block-reason construction path to identify where a non-gate, non-transcript string can enter the feedback slot. Not investigated further this session -- logged only, per navigator's explicit "yes, log it" answer to an AskUserQuestion card raised for exactly this decision.

## Technical Root Cause

Finding 1 (CONFIRMED):
- Site: lib/agents/auto-explore-agent.cjs:473-499, function `populateHSIAnalysis`
- Cause: the raw `score` is interpolated into the user-facing `top_differential` string without the same [0,1] clamp applied to `top_differential_score`, and the clamp itself silently maps any out-of-range magnitude to exactly 1.0 instead of rejecting/flagging out-of-range input.
- Why it surfaces now: triggered whenever an upstream branch supplies a `score` outside [0,1] (e.g. an unnormalized `signed_diff`) together with empty `source_section`/`target_section`.

Finding 2 (HYPOTHESIS, not yet confirmed):
- Site: lib/core/gate-relevance.cjs:194-216 (`gateTopicallyRelevant`) called from scripts/check-card-fire.cjs:482
- Cause (leading hypothesis): either (a) MIN_USER_SUBJECT_TOKENS=2 forces relevant=true on any bare-slash-command turn before token overlap is even checked, or (b) hook-injected gate-describing text is present inside the same human turn the predicate reads as "the user's text," guaranteeing overlap with the gate it is being compared against.
- Why it surfaces now: only visible on a room/session where a context_block/push_forward reach fires repeatedly across turns whose literal user input is short slash commands -- exactly this session's pattern.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (Finding 1, confirmed):
  - Location: lib/agents/auto-explore-agent.cjs:473-499, function `populateHSIAnalysis`
  - Current behavior: displays raw unclamped `score` in `top_differential`; clamps a separate copy to compute `top_differential_score`, so out-of-range input silently becomes a maxed 1.0 confidence.
  - Required behavior: clamp (or reject) `score` to [0,1] ONCE, before either the display string or the gate computation use it; if the raw score is out of range, treat it as a data-quality signal (e.g. cap the recommendation at 0.69 so it never satisfies the >=0.7 RECOMMENDED gate, or suppress the finding entirely) rather than rounding it up to full confidence.
  - Short-term patch: clamp `score` itself at the top of the function (`const score = Math.max(0, Math.min(1, Number(finding.score) || 0));`) so both derived fields use the same bounded value.
  - Long-term fix: fix the upstream producer (composeAutoExploreFinding's pairwise branch, line 359) to normalize `signed_diff` into [0,1] (or [-1,1] then abs then re-scale) before it is ever assigned to `score`, and add a guard that drops/logs a finding whose `source_section`/`target_section` are both empty rather than rendering "<unspecified>".

- Change 2 (Finding 2, needs confirmation first):
  - Location: lib/core/gate-relevance.cjs:194-216 (`gateTopicallyRelevant`), and scripts/check-card-fire.cjs's transcript-parsing extraction of `preceding_user_text`
  - Current behavior: unconfirmed whether hook-injected text is included in the compared "user text"; MIN_USER_SUBJECT_TOKENS=2 confirmed to force relevant=true on any turn whose free-text yields fewer than 2 subject tokens (nearly all bare slash-command turns).
  - Required behavior: TBD pending the trace in Current Focus/next_action. If hook-injected text is leaking into precedingUserText, strip system-reminder / additionalContext blocks before computing subjectTokens. If the MIN_USER_SUBJECT_TOKENS floor is the actual cause, decide deliberately (navigator decision needed, same pattern as the card-fire-block-surface RCA's Finding 2) whether a recurring low-specificity engine-fired reach should be exempted from the force-fire path on repeat-unanswered turns, distinct from the stale-artifact-relevance check.
  - Short-term patch: none proposed yet -- do not patch a hypothesis.
  - Long-term fix: TBD after confirmation.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests for lib/agents/auto-explore-agent.cjs (new or existing test-auto-explore*.cjs)
  - Given: a `finding` with `score: 318.581`, `source_section: ''`, `target_section: ''`
  - When: `populateHSIAnalysis(finding)` runs
  - Then: `top_differential_score` is <= 1.0 by construction (already true) AND does not equal exactly 1.0 for an out-of-range input distinguishable from a genuine 1.0 match, AND/OR the finding is flagged low-quality rather than RECOMMENDED
  - Runner registration: add to the existing auto-explore test suite / relevant run-all-*.sh
- Test 2:
  - Type: integration
  - Location: tests/test-card-fire-relevance-gate.cjs (existing file, extend)
  - Given: a transcript where the last human turn is exactly the text of a slash command with no other free text, and a queued engine-fired reach card on an unrelated topic
  - When: check-card-fire.cjs's Stop hook logic runs
  - Then: assert what `gateTopicallyRelevant` actually returns today (documents current behavior; turn into a regression test for whichever fix is chosen once Change 2 is confirmed)
  - Runner registration: tests/run-all-209.sh or the relevant card-fire suite

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry once Change 1 lands; Change 2 follow-up after confirmation.
- knowledge-base.md: add a summary block on resolve, cross-referencing card-fire-block-surface.md as a sibling (same file, different defects).
- Canon: none identified beyond Part 11/12 (Decision Gate firing correctness) already declared above.
- Docs / monitoring: none identified yet.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Finding 1 (auto-explore-agent.cjs HSI score clamp) confirmed, fix PENDING (not implemented, no session scheduled yet). Finding 2 (recurring reach card defeats relevance gate) CONFIRMED and FIXED: `classifyCardFire`'s PRIMARY-path relevance check compared `precedingUserText` against the model's own current-turn reply (`outputText`) instead of the fired reach's real subject text, so a coherent on-topic reply always looked "relevant" regardless of the actual (unrelated) reach topic.
fix: Finding 2 only -- `lib/core/card-fire-sidechannel.cjs` gained an optional bounded `subjectText` field on `recordReachedGate` + a `readReachedGateSubjects` reader; the 3 PRIMARY producer call sites (`lib/hmi/selector-dispatcher.cjs`, `scripts/intent-classifier.cjs` x2) now pass their own already-in-scope rendered gate content through as `subjectText`; `scripts/check-card-fire.cjs` threads it as `gate_subject_text` and prefers it over `outputText` for `gateTopicallyRelevant` only (BACKSTOP path, `gateAlreadyAnswered`, the binary exemption, `turnContextHash`, and `gateSignature` all untouched). Finding 1 fix not implemented.
verification: Finding 2 -- `tests/test-209-primary-sidechannel.cjs` 12/12, `tests/test-card-fire-relevance-gate.cjs` 4/4, `tests/run-all-179.sh` 12/12, `tests/run-all-209.sh` 9/9, `tests/run-all-210.sh` 14/14, all independently re-run by a separate plan-checker + verifier agent (not just the executor's self-report). Finding 1 -- not verified, not implemented.
files_changed:
  - lib/core/card-fire-sidechannel.cjs (Finding 2 fix -- additive subjectText schema + readReachedGateSubjects)
  - lib/hmi/selector-dispatcher.cjs (Finding 2 fix -- subjectText wired at the pickShape trailer door)
  - scripts/intent-classifier.cjs (Finding 2 fix -- subjectText wired at the engine-arm + emitBindingGate F.8 seams)
  - scripts/check-card-fire.cjs (Finding 2 fix -- gate_subject_text threaded, classifyCardFire prefers it for gateTopicallyRelevant)
  - tests/test-209-primary-sidechannel.cjs (Finding 2 fix -- new Behavior 8 + 9)
commits: 3fd9b81b, 3ff24877, 62b09ee8 (Finding 2 only, quick task 260705-x85). Finding 1 has no commits yet.

Status stays `investigating` (not `resolved`, not moved to `.planning/debug/resolved/`) until Finding 1 also closes.
