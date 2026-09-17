---
status: resolved
kind: rca
trigger: "stop-hook-fires-card-on-option-shaped-prose-sentence"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: [8, 11, 12]
created: 2026-09-17T00:00:00Z
updated: 2026-09-17T09:45:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD, this repo `/home/jsagi/dev/MindrianOS-Plugin`, current HEAD at file-creation time (see `git log -1 --format=%H` at investigation start).
- **WIRE claims probe against:** not applicable (Stop-hook-level enforcement defect, no Brain/Theo wire call involved).
- **Date of audit:** 2026-09-17
- **Re-verification rule:** any source-code claim filed below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: THIS FRONTMATTER BLOCK NOW DESCRIBES THE SECOND PASS ONLY (the sessionless-
  bucket / cross-session-leak mechanism, `lib/core/card-fire-sidechannel.cjs` +
  `lib/hmi/selector-dispatcher.cjs`). A THIRD, INDEPENDENT mechanism (gate-boilerplate-vs-
  content, `lib/core/gate-relevance.cjs`) was found and fixed AFTER this block -- see the
  "RECLASSIFICATION" section (which discovered it) and the "THIRD PASS: Gate-Boilerplate-vs-
  Content Fix" section (which fixed it) further down this file. Both the second pass below
  AND the third pass are CONFIRMED-AND-FIXED, self-verified, BOTH still awaiting human
  confirmation (two independent bugs, two independent fixes, ONE combined checkpoint -- see
  that section's own checkpoint for what to check for each). Do not skip straight to the
  second-pass detail below without also reading the THIRD PASS section; they are unrelated
  mechanisms in the SAME file's investigation history, not sequential refinements of one
  mechanism.
hypothesis-v2 (SECOND PASS, retained verbatim): CONFIRMED AND FIXED, SECOND PASS (2026-09-17).
  See "SECOND PASS: Genuine Session-Scoping" section near the end of this file (after the
  "DISCONFIRMATION" section, which it supersedes). Root cause of the disconfirmation: the first pass's
  `SESSIONLESS_UNION_WINDOW_MS` (20s) narrowed the union's exposure window but did not close
  it -- a time-gated union has no width at which "the second session's read is NEVER
  affected" is actually true, because a sessionless record carries zero session-identity
  information regardless of age. Traced the actual call stack (not assumed): NO caller of
  `pickShape` anywhere in this repo passes an explicit session id, and the MCP SDK's
  `extra.sessionId` never reaches this seam (the trailer door is not a tool handler). BUT
  `process.env.CLAUDE_CODE_SESSION_ID` -- a DIFFERENT, verified-correct env var than the one
  the DISCONFIRMATION section below flagged as risky (`scripts/intent-classifier.cjs`'s
  `resolveSessionId`, which checks the WRONG name, `CLAUDE_SESSION_ID`, confirmed unset) -- IS
  reachable at this call site, and this repo's OWN prior-resolved RCA
  (`registry-active-session-unbound-inheritance.md`) already live-confirmed it on this exact
  machine to be the SAME UUID the Stop hook's own stdin `session_id` carries. The fix threads
  that env var through the mint (`lib/hmi/selector-dispatcher.cjs`), and removes the
  cross-session union entirely as a defense-in-depth floor
  (`lib/core/card-fire-sidechannel.cjs::scopedRecords`) for the residual case where no real
  session id resolves at all.
test: RUN, three ways. (1) Unit-level regression suite (`tests/test-209-primary-sidechannel.cjs`,
  Behaviors 16/16b revised + 17a/17b/17c + 18 new) -- 31/31 green. (2) Full existing suites
  (209/210/238/179 + `scripts/verify-release`) -- zero NEW failures; every pre-existing red
  (209-03, 210-E1, 210-E3 stamp-sweep, 179-08 E2E-1, 238-03, plus two additional pre-existing
  reds found this pass: test-selector-dispatcher-120-01.cjs T1, test-tension-hook-rendering.cjs
  Test 7 -- both unrelated array-count/header-text drift) reconfirmed byte-identical on clean
  HEAD via `git stash`/`git stash pop`. (3) A REAL end-to-end reproduction: two actual OS
  subprocesses (a real `pickShape` mint process + a real `node scripts/check-card-fire.cjs`
  Stop-hook process, piped stdin, isolated `MINDRIAN_HOME`), session A mints with a real
  `CLAUDE_CODE_SESSION_ID`, session B (a different real session id) reads at delays of 0ms,
  50ms, 500ms, 21s, 90s, 150s -- session B is NEVER blocked at ANY delay, INCLUDING 0ms and
  50ms (the exact shape that live-disconfirmed the first pass's 20s window). Session A's OWN
  Stop hook still correctly force-fires on its own unfired card (true positive preserved,
  decision:block). The degenerate no-env-var case still degrades safely (invisible, not
  leaking) rather than blocking session B.
expecting: (met) session B's read is NEVER affected by session A's mint, at ANY delay --
  proven, not asserted -- while session A's own true-positive detection is preserved via an
  EXACT session-id match instead of a time window.
next_action: SUPERSEDED by the THIRD PASS section's own next_action further down this file --
  awaiting human verification of BOTH the second pass (session-scoping) AND the third pass
  (gate-boilerplate-vs-content) together, via ONE combined checkpoint (see this session's
  returned checkpoint). The verification for the second pass is a real concurrent-session
  test, not "wait and see if it fires again" (what produced the false "fixed" declaration
  after the first pass); the verification for the third pass is: a turn in a session with an
  active, correctly-unfired gate, whose own text happens to share vocabulary with that gate's
  boilerplate, should no longer force-fire, while a turn that genuinely asks about one of the
  offered options by name should still force-fire. Once BOTH are confirmed: archive THIS file
  AND the sibling F.1 RCA to `.planning/debug/resolved/` together, append ONE
  knowledge-base.md entry covering all three passes (the session-scoping mechanism, the
  window-narrowing pitfall, AND the gate-boilerplate-vs-content mechanism), and commit
  `lib/core/card-fire-sidechannel.cjs`, `lib/hmi/selector-dispatcher.cjs`,
  `lib/core/gate-relevance.cjs`, `tests/test-209-primary-sidechannel.cjs`, `CHANGELOG.md`,
  plus both debug-file moves. Do NOT fold or commit before BOTH confirmations land. The
  paragraphs below (hypothesis-v2 through the reasoning_checkpoint block, and the
  "DISCONFIRMATION" section after them) are RETAINED as historical record of the first,
  INSUFFICIENT pass -- they correctly identified the sessionless-mint mechanism and correctly
  ruled out any text-shape predicate, and the DISCONFIRMATION section correctly diagnosed WHY
  the first pass was insufficient and correctly flagged the day-hash fallback risk in
  `resolveSessionId` (a risk this second pass avoided by using a DIFFERENT, already-verified
  helper/env-var instead, per the DISCONFIRMATION section's own instruction to confirm or
  refute that risk before reusing any part of it).

---
### Historical (superseded) hypothesis from the first investigation pass
---

hypothesis-v1: DISPROVEN as originally stated, then RESOLVED under a revised hypothesis. The
  original hypothesis (a regex/heuristic inside `computeBackstopHit` matches a free-prose
  "X, Y, or Z" option-naming clause) is FALSE: at current dev-repo HEAD, `computeBackstopHit`
  only tests `ASCII_BOX_UNCONDITIONAL_RE` (bracket-box / "type 1, 2, or 3" literal / multiline
  bracket-box) and `extractOptionLabels` only matches line-anchored `[n]`/`n)`/`n.` markers --
  neither matches plain comma-and-or prose at all (confirmed: `matchedGlyphSpan` returns `''`
  and `extractOptionLabels` returns `[]` for the exact reported sentence). Direct execution of
  `classifyCardFire`/`deriveTurnSignals` against synthetic transcripts (see Evidence) proves the
  assistant's own closing-sentence content (option-naming prose vs a plain control sentence) has
  ZERO causal effect on the intercept verdict in every side-channel condition tested (none,
  fresh, stale). The REAL mechanism, confirmed live: `lib/hmi/selector-dispatcher.cjs`'s
  pickShape trailer door is the ONLY `recordReachedGate` producer with no `sessionId` in scope at
  its mint point (the other three producers all thread a real sessionId), so its mint files
  under the sessionless `NO_SESSION_KEY` bucket. `scopedRecords` (in
  `lib/core/card-fire-sidechannel.cjs`) unioned that bucket's records into ANY session's read for
  the full `TURN_FRESH_MS` (2 minutes) after ANY Shape-F card renders anywhere on the machine.
  Combined with `gateTopicallyRelevant`'s WR-06 "fresh gate + low-signal turn -> force
  unconditionally" floor, this force-fires a completely unrelated status/holding turn -- this is
  the SAME code path as the still-open PRIMARY-arm sibling RCA
  (`card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md`), scoping
  determination (a): same mechanism, described from a different angle (that file names the
  mechanism directly; this file's own trigger characterized it via a correlate -- the
  assistant's closing-sentence shape -- that has no actual causal role).
test: live-executed (not just code-read) against the real `classifyCardFire`/`deriveTurnSignals`
  seam, mirroring `tests/test-card-fire-relevance-gate.cjs`'s own harness idiom. See Evidence for
  the six scenario pairs and the cross-session-bleed reproduction.
expecting: (met) a sessionless mint aged BETWEEN `SESSIONLESS_UNION_WINDOW_MS` (20s, the fix) and
  the old `TURN_FRESH_MS` (2 min) window no longer bleeds into an unrelated session's read; a
  genuinely fresh (seconds-old) sessionless mint still unions (same-turn detection preserved); a
  status turn with no fork, connected to a reached gate ONLY via a stale sessionless bleed, no
  longer intercepts regardless of whether its own closing sentence names options in prose.
next_action: awaiting human verification in a live session (see checkpoint). Once confirmed:
  archive THIS file to `.planning/debug/resolved/`, ALSO move
  `card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` to
  `.planning/debug/resolved/` with a note cross-referencing this file's fix (same code path, same
  fix), append one knowledge-base.md entry covering both, and commit the code + test changes
  (`lib/core/card-fire-sidechannel.cjs`, `tests/test-209-primary-sidechannel.cjs`,
  `CHANGELOG.md`) plus both debug-file moves.

reasoning_checkpoint:
  hypothesis: "The Stop-hook force-fires an unrelated status turn because
    `lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door mints a sessionless
    (`NO_SESSION_KEY`) reach record (it is the only producer with no session_id in scope), and
    `card-fire-sidechannel.cjs`'s `scopedRecords` unions that record into ANY session's read for
    the full 2-minute `TURN_FRESH_MS` window, which `gateTopicallyRelevant`'s WR-06 low-signal
    floor then treats as proof of a fresh, genuine, this-session gate -- forcing the turn
    regardless of true relevance. The assistant's own closing-sentence content (the trigger's
    named symptom) plays no role at all."
  confirming_evidence:
    - "Direct execution: an option-shaped-prose turn and a matched no-option control turn produce
      BYTE-IDENTICAL classifyCardFire verdicts across three side-channel conditions (none, fresh,
      stale) -- six scenario pairs, six identical pairs."
    - "Direct execution: a sessionless mint recorded with NO sessionId (mirroring the real
      `lib/hmi/selector-dispatcher.cjs:1093-1097` call shape exactly) force-fires TWO different,
      wholly unrelated session_ids' ordinary status turns (`intercept:true,
      reason:'reached-registry-gate-no-card'`), while a THIRD session with substantive
      non-overlapping preceding text is correctly NOT force-fired (`gate-irrelevant-to-turn`) --
      isolating the low-signal-turn + fresh-sessionless-bleed combination as the exact trigger
      condition, not the turn's own output text."
    - "Source read: `lib/hmi/selector-dispatcher.cjs:1071-1097`'s own comment states plainly 'No
      session_id reaches this seam (this call site never had one)'; the other three
      `recordReachedGate` call sites (`scripts/intent-classifier.cjs` x2,
      `lib/core/eureka/qualify-opportunity.cjs`) all thread a real sessionId."
  falsification_test: "If the option-shaped-prose turn and the no-option control turn ever
    produced DIFFERENT verdicts under identical side-channel state, the original hypothesis
    (backstop/label-extraction sensitive to prose shape) would be confirmed instead. They did
    not, in any of the six tested conditions."
  fix_rationale: "The root cause is a TIMING/SCOPE defect (the sessionless bucket's union window
    is far wider than the 'same-turn read-back seconds later' use case it exists for), not a
    text-classification gap -- so the fix targets the union window itself
    (`SESSIONLESS_UNION_WINDOW_MS`, 20s), not the backstop regex or option-label extraction (which
    were already proven irrelevant to this turn's own content). This directly addresses the
    mechanism the evidence isolated, not a symptom of it."
  blind_spots: "This does not eliminate the sessionless-bleed ambiguity entirely -- it narrows the
    exposure window from 2 minutes to 20 seconds. Two turns (own session or a genuinely
    concurrent different session) landing within 20 seconds of a real Shape-F mint could still
    exhibit the same false-positive, though no live reproduction on file shows turns that close
    together (all reproductions span multiple turns / minutes). The deeper fix -- threading a real
    session_id through to `lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door so it never
    needs the sessionless bucket at all -- touches a different subsystem/file and is left as a
    follow-up, not bundled into this minimal, targeted fix."

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (the only dev workspace)
- Reported by: Lawrence Aronhime, tester bug report #2, item #6 ("Stop hook forced a card on a status-only turn while background research ran") - relayed via a parallel session (jsagi-30, working the Jev/TypeSafe spike track), which read and triaged the full report but explicitly did not root-cause this item ("stop_gate_check relevance. Not root-caused; needs a repro.").
- Live repro evidence (same day, different session, jsagi-30's own conversation): "live repro from my session today, at least four occurrences, each a pure status/holding turn with no fork in it... The turns that triggered it ended with a prose sentence naming next options ('cut the beta, capture the seed, or wrap up'); a turn that ended with no option-like sentence did not trigger it. That is the predicate to look at: it reads an option-shaped sentence as an unrendered F.1 gate."
- Date first observed: 2026-09-17 (jsagi-30's session, today); tester's own report date unknown.
- **Related debug sessions, read before forming a hypothesis, not assumed identical:**
  - `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` (status: diagnosed) - same script (`scripts/check-card-fire.cjs`), same user-facing symptom class (force-block regardless of relevance), but its own named mechanism is a STALE F.1 candidate-reach suggestion re-surfacing in `additionalContext` every turn, not the assistant's OWN prose containing an option-shaped sentence. Its "Phase 238-08 Re-scoping Note" distinguishes a BACKSTOP arm (ASCII-box shape, already gated on side-channel corroboration) from a PRIMARY arm (this file's own still-open finding, about the F.1 mint site specifically). Read that note in full before concluding whether today's option-shaped-prose finding is a third distinct arm or falls inside either of those two.
  - `.planning/debug/resolved/backstop-benign-list-defeats-relevance-gate.md`, `card-fire-over-enforcement.md`, `card-fire-relevance-check-gap.md`, `card-fire-block-surface.md` (resolved siblings against the same script) - read for prior-fix shape before proposing a new one, so this does not re-open or duplicate an already-closed gap.
  - Do NOT assume this file's finding is the same bug as the F.1-stale-suggestion file above. Confirm or eliminate that identity as the FIRST evidence-gathering step, since both produce the identical user-visible error string ("rendering your choices as a selectable card") from the same script but may be different code paths inside it.

## Problem Statement

The Stop hook force-fired an AskUserQuestion-style card on turns that were pure status updates (no genuine unanswered Decision-Gate fork present), specifically when the assistant's own output ended in a prose sentence naming several options in natural language, even though background research/work was still running and no card should have rendered.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: the Stop hook only force-fires when a genuine, unanswered, relevant Decision Gate exists and was not rendered via AskUserQuestion; a plain status/holding turn, even one whose closing sentence lists several next-step options in prose, completes without a forced card.
actual: at least 4 turns (jsagi-30's session, today) that were pure status/holding turns with no real fork were force-blocked with "Stop hook feedback: rendering your choices as a selectable card", correlated specifically with the turn's closing sentence naming options in prose ("cut the beta, capture the seed, or wrap up"); a turn without such a closing sentence did not trigger it.
errors: `Stop hook feedback: rendering your choices as a selectable card` (same error string as the sibling F.1 RCA above; do not assume same cause without checking).
reproduction: not yet independently reproduced by this session. jsagi-30's reproduction (today, live, 4+ occurrences) is the only evidence on file; needs a minimal isolated repro (a scripted turn output containing only an option-naming closing sentence) before root-causing.
started: 2026-09-17 (today's live observation); tester's original report predates this.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: `computeBackstopHit` (the BACKSTOP arm) matches a free-prose "X, Y, or Z"
  option-naming clause too broadly, needing a framing-cue-style tightening similar to the
  retired numbered-prose arm.
  evidence: `computeBackstopHit` at current dev-repo HEAD tests ONLY `ASCII_BOX_UNCONDITIONAL_RE`
  (bracket-box / "type 1, 2, or 3" literal / multiline bracket-box). Direct execution:
  `matchedGlyphSpan(text)` returns `''` and `gateRelevance.extractOptionLabels(text)` returns
  `[]` for the exact reported sentence ("...cut the beta, capture the seed, or wrap up."). The
  numbered-prose arm this hypothesis assumed still existed was already retired by the
  `card-fire-relevance-check-gap` (2026-07-17) fix, before this trigger's own live observation.
  timestamp: 2026-09-17T00:00:00Z
- hypothesis: this is a genuine THIRD arm distinct from both the sibling RCA's PRIMARY (F.1
  stale-reach) mechanism and the already-fixed BACKSTOP mechanism -- i.e. some new
  text-classification code path sensitive to comma/or-joined prose that neither sibling RCA
  covers.
  evidence: direct execution of `classifyCardFire`/`deriveTurnSignals` against six matched
  scenario pairs (option-shaped-prose turn vs. a no-option control turn, holding side-channel
  state fixed across three conditions: none, fresh-registry-mint, stale-registry-mint) produced
  BYTE-IDENTICAL verdicts in every pair. There is no code path in `scripts/check-card-fire.cjs`
  or `lib/core/gate-relevance.cjs` whose outcome depends on whether the turn's own output text
  names options in prose. Scoping determination: (a), same mechanism as the sibling PRIMARY-arm
  RCA, not a third arm.
  timestamp: 2026-09-17T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-17T00:00:00Z
  checked: `scripts/check-card-fire.cjs::computeBackstopHit` and `ASCII_BOX_UNCONDITIONAL_RE`
  (post `card-fire-relevance-check-gap` 2026-07-17 retirement of the numbered-prose arm), plus
  `lib/core/gate-relevance.cjs::extractOptionLabels`'s `OPTION_LABEL_RE` (line-anchored
  `[n]`/`n)`/`n.` markers only).
  found: neither function has any code path that matches free comma/or-joined prose with no
  brackets and no numbered-list markers. Direct call: `matchedGlyphSpan(OPTION_PROSE_TEXT)` ->
  `''`; `extractOptionLabels(OPTION_PROSE_TEXT)` -> `[]`.
  implication: the BACKSTOP arm and the option-label extraction it feeds (`isYesNoShapedGate`,
  `gateAlreadyAnswered`) are both structurally incapable of reacting to this trigger's named
  symptom shape. Any live force-fire on this shape must come from the PRIMARY arm
  (`ran_entries` / side-channel), independent of the turn's own text.
- timestamp: 2026-09-17T00:00:00Z
  checked: live execution of `classifyCardFire`/`deriveTurnSignals` (mirroring
  `tests/test-card-fire-relevance-gate.cjs`'s `classifyTranscript` harness idiom) against an
  option-shaped-prose turn and a matched no-option control turn, across three side-channel
  conditions: (1) no registry mint at all, (2) a FRESH registry mint recorded under the SAME
  session_id, (3) a STALE (5-minute-old, still inside the 10-minute file TTL) registry mint
  recorded under the same session_id.
  found: condition 1 -> both `{"intercept":false,"reason":"no-gate-signal"}`. Condition 2 ->
  both `{"intercept":true,"reason":"reached-registry-gate-no-card"}`. Condition 3 -> both
  `{"intercept":false,"reason":"gate-irrelevant-to-turn"}`. All three pairs byte-identical
  between the option-shaped-prose turn and the no-option control turn.
  implication: the assistant's own closing-sentence content has zero causal effect on the
  verdict in every condition tested. Whatever causes a live force-fire on this shape, it is not
  the sentence itself.
- timestamp: 2026-09-17T00:00:00Z
  checked: `lib/hmi/selector-dispatcher.cjs:1071-1097` (the pickShape trailer door's
  `recordReachedGate` call site) against the other three `recordReachedGate` call sites
  (`scripts/intent-classifier.cjs:1729`, `:2943`, `:3208`; `lib/core/eureka/qualify-opportunity.cjs:518`).
  found: the pickShape trailer door's call NEVER supplies `sessionId` (confirmed by its own
  comment, line 1071-1073: "No session_id reaches this seam (this call site never had one)"),
  so every one of its mints files under `card-fire-sidechannel.cjs`'s sessionless
  `NO_SESSION_KEY` bucket, unconditionally. The other three call sites all thread a real
  `sessionId` (or a per-call fallback derived from real context), so their mints are
  session-scoped and do not exhibit this leak.
  implication: `lib/hmi/selector-dispatcher.cjs` is the SOLE structural source of the
  cross-session-ambiguous sessionless bucket that both this trigger and the sibling PRIMARY-arm
  RCA are chasing.
- timestamp: 2026-09-17T00:00:00Z
  checked: `lib/core/card-fire-sidechannel.cjs::scopedRecords` (pre-fix): unions the
  `NO_SESSION_KEY` bucket's records into ANY session's read, filtered only by `TURN_FRESH_MS`
  (2 minutes) -- the SAME window `mostRecentReachedTs` (feeding `gate_is_fresh`) and
  `readReachedGates` (feeding `ran_entries`/`primaryHit`) both consult via this one shared
  function.
  found: live execution: a sessionless mint recorded with NO sessionId (mirroring the real
  `lib/hmi/selector-dispatcher.cjs` call shape exactly) force-fires TWO different, wholly
  unrelated session_ids' ordinary status turns (verdict `{"intercept":true,
  "reason":"reached-registry-gate-no-card"}`, `gate_is_fresh:true`), each with only a terse or
  absent preceding user turn. A THIRD session with a substantive preceding turn carrying zero
  topical overlap with the leaked subject correctly does NOT force-fire (`gate-irrelevant-to-turn`).
  implication: the mechanism is confirmed end to end -- a genuine, real Shape-F card rendering
  ANYWHERE on the machine (any session, including the reporter's own session on an earlier
  turn) leaves a 2-minute window during which ANY session's low-signal-preceding-turn status
  update force-fires, regardless of that turn's own content. This is the exact mechanism the
  sibling RCA names for its PRIMARY arm (`reached-registry-gate-no-card`, F.1 stale/leaked
  reach), confirming scoping determination (a).
- timestamp: 2026-09-17T00:01:00Z (SECOND PASS)
  checked: whether the MCP SDK's `extra.sessionId`, `payloadObj` at the trailer door call
  site, or `process.env.CLAUDE_CODE_SESSION_ID` carries a real, resolvable session id at
  `lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door -- traced by reading every actual
  caller (grep across the repo for `pickShape(` call sites, ~25 sites across scripts/, lib/,
  tests/) and `lib/core/session-binding.cjs::resolveEffectiveSessionId` (the repo's OWN
  existing MCP-extra/env resolver), then LIVE-tested `process.env.CLAUDE_CODE_SESSION_ID`
  directly (`node -e "console.log(process.env.CLAUDE_CODE_SESSION_ID)"` in this exact
  environment printed a real UUID).
  found: (1) zero `pickShape` call sites anywhere in the repo pass an explicit `sessionId`
  today. (2) the MCP SDK's `extra.sessionId` never reaches this seam (the trailer door runs
  inside `pickShape`, not an MCP tool handler; `extra` is a tool-handler-only parameter). (3)
  `process.env.CLAUDE_CODE_SESSION_ID` (note: NOT the same var `scripts/intent-classifier.cjs`'s
  `resolveSessionId` checks -- that one checks `CLAUDE_SESSION_ID`, missing "CODE", confirmed
  unset by that file's own comment) IS reachable and IS already relied on elsewhere in this
  exact codebase as a real, per-session, stdio-transport-safe id: `lib/core/session-
  binding.cjs::resolveEffectiveSessionId` (used by ~20 call sites in `lib/mcp/tool-router.cjs`
  per its own header comment), `lib/core/room-open.cjs:228`, `lib/core/resolve-active-
  room.cjs:172`, `lib/core/insight-sensors.cjs:424`, and multiple prior-resolved RCAs
  (`registry-active-room-concurrent-session-collision.md`, `resolve-active-room-cross-
  session-bleed.md`, `registry-active-session-unbound-inheritance.md`). The last of these
  explicitly LIVE-confirmed on this exact machine (quoting its own Evidence): "a Bash tool
  subprocess sees CLAUDE_PID=2561202, PPID=2561202, and `ps -p 2561202` is `claude`... 
  CLAUDE_CODE_SESSION_ID is set to this session's real UUID," describing it as "the session
  UUID the hook reader also uses" -- i.e. the SAME UUID the Stop hook's own stdin `session_id`
  field carries for the same live session.
  implication: a real, verified-reachable, already-load-bearing-elsewhere session id IS
  available at the trailer door's mint point. Threading it through eliminates the need for
  the NO_SESSION_KEY bucket (and its union) for this producer almost entirely, closing the
  defect at its actual source rather than narrowing the blast radius of its symptom.
- timestamp: 2026-09-17T00:01:00Z (SECOND PASS)
  checked: end-to-end, real-subprocess reproduction of the disconfirmed scenario (a genuine
  Shape-F card mint via a real `pickShape` child process with `CLAUDE_CODE_SESSION_ID` set to
  session A, then a real `node scripts/check-card-fire.cjs` child process reading real piped
  Stop-hook stdin JSON for session B, a DIFFERENT real session id, at delays of 0ms, 50ms,
  500ms, 21s, 90s, 150s -- isolated via `MINDRIAN_HOME`/`CARD_FIRE_SIDECHANNEL_PATH`, never
  touching the real `~/.mindrian`).
  found: session B's Stop hook returns `decision !== 'block'` at EVERY delay, including 0ms
  and 50ms (well inside the first pass's 20-second window -- the exact shape that
  live-disconfirmed it). Session A's OWN Stop hook, reading its own mint, returns
  `decision:'block'`, `reason:'reached-registry-gate-no-card'` when its own card never fired
  via AskUserQuestion (true positive preserved). A degenerate mint (no
  `CLAUDE_CODE_SESSION_ID` resolvable at all) still does not leak into session B's read.
  implication: the fix is proven, not merely tested at the unit-helper level -- it holds
  against the exact live-disconfirmation timing shape while preserving the true-positive
  detection the original NO_SESSION_KEY union existed for.

## Scope and Impact

- Affected surfaces: cli (confirmed, jsagi-30's session today; also reachable via the MCP
  `stop-gate-handler.cjs` path, which wraps the same `classifyCardFire`/`deriveTurnSignals`
  predicate, Part 7, no fork).
- Affected commands: none directly; Stop-hook-level enforcement (`scripts/check-card-fire.cjs`
  / `lib/core/card-fire-sidechannel.cjs`), applies regardless of which command produced the turn.
- Affected users: any session, on ANY turn with a terse or absent preceding user message, within
  2 minutes (pre-fix) of ANY Shape-F card rendering anywhere on the machine (own session or a
  concurrent one) via `lib/hmi/selector-dispatcher.cjs`'s telemetry-gated trailer door -- the
  turn's own output content (option-naming prose or otherwise) is irrelevant.
- Severity: medium - does not corrupt data, but forces a spurious card, breaking turn completion
  and potentially confusing the user into answering a "choice" that was never a real fork.
- Blast radius: `lib/core/card-fire-sidechannel.cjs::scopedRecords`'s NO_SESSION_KEY union (the
  same mechanism the sibling PRIMARY-arm RCA names); confirmed NOT the BACKSTOP arm (already
  gated by 238-08's side-channel corroboration, and structurally incapable of matching this
  text shape regardless).

## Technical Root Cause

`lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door is the only `recordReachedGate`
producer with no `sessionId` in scope at its mint point, so every one of its mints files under
the sessionless `NO_SESSION_KEY` bucket. `card-fire-sidechannel.cjs::scopedRecords` unions that
bucket's records into ANY session's `readReachedGates`/`mostRecentReachedTs` read, filtered only
by `TURN_FRESH_MS` (2 minutes) -- a window sized for the session-scoped bucket's own legitimate
staleness verdict, not for this cross-session-ambiguous union (whose own doc comment says the
intended use is "the trailer door's own Stop-hook read fires SECONDS later"). Within that
2-minute window, `classifyCardFire` sees `primaryHit:true` and `gate_is_fresh:true` for a turn
that reached no gate at all, and `gateTopicallyRelevant`'s WR-06 low-signal floor ("fresh gate +
low-signal turn -> force unconditionally", added to protect a just-minted GENUINE fork) then
force-fires unconditionally whenever the turn's preceding user text is terse or absent -- which
is exactly the shape of an ordinary status/holding turn. The turn's own output text (whether or
not it names options in prose) is never consulted by this path at all. This is the identical
mechanism the sibling RCA (`card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md`)
already named for its PRIMARY arm; this file's own trigger characterized the same live incidents
via a correlate (the closing-sentence shape) that carries no causal weight.

## Required Code Changes

- Change 1 (IMPLEMENTED):
  - Location: `lib/core/card-fire-sidechannel.cjs`, new constant `SESSIONLESS_UNION_WINDOW_MS`
    (20 seconds) and `scopedRecords`'s NO_SESSION_KEY filter (was `t - rec.ts <= TURN_FRESH_MS`,
    now `t - rec.ts <= SESSIONLESS_UNION_WINDOW_MS`).
  - Prior behavior: a sessionless mint unioned into any session's read for the full 2-minute
    `TURN_FRESH_MS` window.
  - New behavior: a sessionless mint unions only within 20 seconds of `now` -- long enough for
    the documented "same-turn, seconds later" read-back use case, far too short for the
    multi-turn / multi-minute bleed every live reproduction on file actually exhibits. The
    SESSION-scoped bucket's own freshness verdict (fix B, `mostRecentReachedTs` vs
    `TURN_FRESH_MS`) is untouched -- this change is scoped to the NO_SESSION_KEY union only.
  - Long-term follow-up (NOT implemented here, different subsystem/file, flagged as a residual):
    thread a real `session_id` through to `lib/hmi/selector-dispatcher.cjs`'s pickShape trailer
    door so it never needs the sessionless bucket at all. This would close the remaining
    (much narrower) residual: two turns landing within 20 seconds of a real Shape-F mint could
    still exhibit the same false positive, though no live reproduction on file shows turns that
    close together.

## Non-Code Follow-ups

- Fold with `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md`
  on human confirmation: same code path, same fix. Move BOTH files to
  `.planning/debug/resolved/` together, with a note on the sibling file cross-referencing this
  fix.
- knowledge-base.md: add one summary block covering both files (this session's fold), on human
  confirmation.
- CHANGELOG.md: Fixed entry added under `[Unreleased] -- v2.0.0-beta.42`.
- The `lib/hmi/selector-dispatcher.cjs` session_id-threading follow-up named in Required Code
  Changes above is out of scope for this session (different file/subsystem, risk of colliding
  with concurrently active peer work per this session's own scoping instructions) -- flag for a
  dedicated follow-up phase/quick task, not bundled here.

## Resolution
<!-- OVERWRITE as understanding evolves -->

**This section reflects the SECOND pass's corrected understanding. The FIRST pass's
root_cause/fix/verification (a `SESSIONLESS_UNION_WINDOW_MS` time-window narrowing) is
PRESERVED VERBATIM below in the "DISCONFIRMATION" and "SECOND PASS" sections near the end of
this file as historical record of what was insufficient and why -- it is not deleted, only
superseded here.**

root_cause: CONFIRMED, REVISED -- a sessionless (`NO_SESSION_KEY`) card-fire-sidechannel mint
  from `lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door (the only producer with no
  session_id in scope) bled into ANY session's read, and `gateTopicallyRelevant`'s WR-06
  low-signal floor then force-fired any turn whose preceding user text was terse or absent,
  regardless of that turn's own output content. The FIRST pass correctly identified this
  mechanism but incorrectly treated a time-window narrowing (`TURN_FRESH_MS` 2min ->
  `SESSIONLESS_UNION_WINDOW_MS` 20s) as closing it; live re-fire (with that fix already on
  disk) proved a time-gated union can never be safe, because a sessionless record carries NO
  session-identity information regardless of age -- there is no window width at which a
  concurrent peer session's mint cannot collide with an unrelated session's read. The TRUE
  root cause of the DEFECT (not just its symptom) is that the trailer door's mint point never
  had a session id threaded into it at all, despite one being genuinely reachable there
  (`process.env.CLAUDE_CODE_SESSION_ID`, confirmed correct and matching the Stop hook's own
  stdin `session_id` -- see `.planning/debug/resolved/registry-active-session-unbound-
  inheritance.md`'s live `ps -p <pid>` confirmation on this exact machine). Same code path as
  the sibling PRIMARY-arm RCA (`card-fire-stale-f1-reach-suggestion-forces-block-regardless-
  of-relevance.md`); this file's own "option-shaped prose" framing remains a correlate
  observed live, not the actual predicate (proven false by direct experiment, see
  Eliminated/Evidence -- unchanged by this revision).
fix: IMPLEMENTED, SECOND PASS --
  1. `lib/hmi/selector-dispatcher.cjs` (the pickShape trailer door's `recordReachedGate` call
     site): now resolves a real session id (`payloadObj.sessionId` if a caller ever supplies
     one, else `process.env.CLAUDE_CODE_SESSION_ID`, else `undefined`) and threads it into the
     mint. This is the PRIMARY fix -- it makes the mint land in a REAL, exact-match session
     bucket directly, closing the false positive while genuinely preserving the true-positive
     same-turn detection (no window needed when the key is exact).
  2. `lib/core/card-fire-sidechannel.cjs::scopedRecords`: the `NO_SESSION_KEY` union is REMOVED
     entirely (not re-windowed) as a defense-in-depth floor -- a session's read now sees ONLY
     its own exact-match bucket. `SESSIONLESS_UNION_WINDOW_MS` (the first pass's constant) is
     removed; `TURN_FRESH_MS` (fix B, the session-scoped bucket's OWN freshness verdict) is
     unchanged.
verification: self-verified this session (human confirmation pending, see checkpoint) --
  - Unit regression suite (`tests/test-209-primary-sidechannel.cjs`, now 31/31): Behavior 4
    updated (controls `CLAUDE_CODE_SESSION_ID` so its fs_scope assertion stays deterministic);
    Behavior 10 REVISED (a sessionless mint NEVER unions, fresh or stale -- the first pass's
    "a fresh one still unions" assertion is now proven WRONG and rewritten); Behaviors 16/16b
    REVISED (both age legs -- stale AND genuinely fresh/0ms -- must stay non-intercepting, the
    0ms leg being the exact live-disconfirmation shape); Behaviors 17a/17b/17c NEW (the real
    session-id threading: env var wins when present, explicit payload.sessionId wins over the
    env var, safe NO_SESSION_KEY fallback when neither resolves); Behavior 18 NEW (the
    TWO-CONCURRENT-SESSION-SAME-ROOM scenario across 6 delays from 0ms to 150s -- session B
    NEVER sees session A's mint at any delay, session A still sees its own).
  - Full suites re-run: `tests/run-all-209.sh`, `tests/run-all-210.sh`, `tests/run-all-238.sh`,
    `tests/run-all-179.sh`, `scripts/verify-release` (35 passed / 0 failed / 3 expected
    warnings: uncommitted changes, missing changelog-version-entry for the not-yet-cut
    beta.42), plus the wider selector-dispatcher/render/tension-hook test files that exercise
    `pickShape`. Two ADDITIONAL pre-existing failures surfaced this pass beyond the five the
    first pass catalogued (209-03 declared-implies-wired, 210-E1 legs 1/2/3/4/5 [wider than the
    first pass's "legs 4/5" note -- re-verified as pre-existing, not a regression, see below],
    210-E3 stamp-sweep, 179-08 ga4-card-fire-e2e E2E-1, 238-03 chosen-validation):
    `test-selector-dispatcher-120-01.cjs` T1 (F_SUBSHAPES count drift, 11 vs expected 9) and
    `test-tension-hook-rendering.cjs` Test 7 (a header-text literal drift). ALL SEVEN
    reconfirmed byte-identical on clean HEAD via `git stash`/`git stash pop` before and after
    this second pass's fix -- zero NEW failures introduced by this fix, in either pass's code.
  - A REAL end-to-end reproduction (not just unit-level helpers): two actual OS subprocesses
    (a real `pickShape` mint process, a real `node scripts/check-card-fire.cjs` Stop-hook
    process reading real piped stdin JSON), isolated via `MINDRIAN_HOME` +
    `CARD_FIRE_SIDECHANNEL_PATH` so it never touches the real `~/.mindrian`. Session A mints
    with a real `CLAUDE_CODE_SESSION_ID`; session B (a different real session id, a plain
    status turn with no fork) reads at delays of 0ms, 50ms, 500ms, 21s, 90s, 150s -- session B
    is NEVER blocked (`decision !== 'block'`) at ANY delay, including 0ms and 50ms (the exact
    shape that live-disconfirmed the first pass's 20-second window). Session A's OWN Stop hook
    STILL correctly force-fires on its own unfired card (`decision:block`,
    `reason:'reached-registry-gate-no-card'` rendered as "rendering your choices as a
    selectable card") -- true-positive preserved, not just the false-positive closed. The
    degenerate no-env-var case also confirmed safe (invisible to session B, not leaking).
  - STILL NEEDED: human confirmation in a live, concurrent-multi-session environment (this
    fix's unit + subprocess-level verification cannot fully stand in for the real Claude Code
    Stop-hook harness across genuinely concurrent live sessions -- see checkpoint for exactly
    what to check and why, given the first pass's self-verification also looked complete and
    was not).
files_changed:
  - lib/hmi/selector-dispatcher.cjs (pickShape trailer door threads a real session id into
    recordReachedGate: payload.sessionId > process.env.CLAUDE_CODE_SESSION_ID > undefined)
  - lib/core/card-fire-sidechannel.cjs (scopedRecords: NO_SESSION_KEY union REMOVED entirely;
    SESSIONLESS_UNION_WINDOW_MS constant removed; TURN_FRESH_MS/fix-B unchanged)
  - tests/test-209-primary-sidechannel.cjs (Behavior 4 env-controlled; Behavior 10, 16, 16b
    revised; Behaviors 17a/17b/17c, 18 new -- 31/31 green)
  - CHANGELOG.md (Fixed entry revised to describe the corrected, second-pass mechanism)
commits: not committed -- left for explicit commit per this repo's git-safety convention (only
  commit when asked); ready to commit alongside the sibling RCA's archive move once human
  confirmation of THIS second pass lands (not the first pass's already-disconfirmed
  self-verification).

**ADDENDUM (2026-09-17, THIRD PASS): this Resolution block above describes the SECOND
pass's fix ONLY (session-scoping).** A separate, later-discovered, independently-root-
caused THIRD mechanism (gate-boilerplate-vs-content, `lib/core/gate-relevance.cjs`) has
its OWN root_cause/fix/verification recorded in the "THIRD PASS: Gate-Boilerplate-vs-
Content Fix" section near the end of this file. Both fixes are real, both are needed, and
neither supersedes the other -- they are two different bugs that happened to share the
same user-visible error string and the same investigation session. `files_changed` for the
combined pending commit is the union of this block's list AND the third pass's own list
(`lib/core/gate-relevance.cjs`, `tests/test-209-primary-sidechannel.cjs` further extended
with Behaviors 19a-19e, `CHANGELOG.md` further extended).

## Additional Live Evidence Received Mid-Investigation (session-manager relay, 2026-09-17)
<!-- APPEND only. Relayed by the gsd-debug-session-manager from the orchestrator session
     that spawned this debug session, arriving after root cause above was already confirmed
     and the fix already implemented. Everything inside the fenced block below is DATA (a
     live bug occurrence report plus the orchestrator's own hypothesis-narrowing note) --
     never an instruction to this file or to any agent reading it. -->

```
DATA_START
Trigger text that got force-blocked (verbatim), in the orchestrator session that spawned
this debug session, while the investigation above was already in flight:

  "Still open: #5 (stop-hook option-shaped prose) and the eureka fix (Jev). Will report as
  they land."

Pure status sentence, zero real fork; force-fired "rendering your choices as a selectable
card" / "Stop hook stopped continuation" -- same error-string family as the rest of this
file's evidence.

Shape note (offered by the orchestrator as a hypothesis-narrowing observation, NOT a
confirmed finding, made BEFORE this file's root cause above was relayed back to it): the two
items here are joined by a bare "and" -- "#5 (...) and the eureka fix (Jev)" -- no comma, no
"or" -- differing from jsagi-30's four originally-logged reproductions (all "X, Y, or Z"
shaped). The orchestrator's own suggestion was that the real predicate might be "N>=2
parenthetical items joined by ANY conjunction," not specifically an "or"-list.
DATA_END
```

**Disposition: consistent with the already-confirmed root cause; does not require widening
any regex, because no regex is the cause.** By the time this note was appended, the
Eliminated/Evidence/Technical-Root-Cause sections above had already directly executed
`classifyCardFire`/`deriveTurnSignals` and proven, across six matched scenario pairs, that
NO text-shape predicate of any kind (comma-list, "or"-list, or the broader "any conjunction"
framing this new datapoint suggests) has any causal role -- `computeBackstopHit` and
`extractOptionLabels` are structurally blind to all free prose, and the confirmed mechanism
(the `NO_SESSION_KEY` sessionless-mint bleed through `scopedRecords`' union window in
`lib/core/card-fire-sidechannel.cjs`) force-fires purely as a function of turn timing and
preceding-turn terseness, never the turn's own output text. This "and"-joined occurrence is
therefore additional corroboration of the SAME mechanism (one more low-signal-preceding-turn
status update landing inside the union window), not a counter-example requiring a wider
text-shape rule.

**The one open question this datapoint DOES bear on, for whoever performs the pending human
verification:** was this occurrence inside or outside the fix's new
`SESSIONLESS_UNION_WINDOW_MS` (20s) window, and -- per this repo's own standing caution (a
`main` commit is not live for an already-running session until that session restarts against
a released, picked-up build; the fix above is UNCOMMITTED dev-repo-only as of this note) --
was this file's fix even present in the orchestrator's running session's code at the time
this turn fired? Since the fix is not yet committed, this occurrence is EXPECTED regardless
of window width and should NOT be read as evidence the 20-second window is insufficient; it
is pre-fix behavior, consistent with everything already confirmed above. Re-test only after
the fix is committed, released, and the orchestrator's session has restarted against it.

## DISCONFIRMATION: Fix Insufficient, Re-Fired With The Fix Already On Disk (session-manager, 2026-09-17)
<!-- APPEND only. status reverted to `investigating` in frontmatter. DO NOT fold, archive, or
     commit on the basis of the "awaiting_human_verify" checkpoint above -- it is superseded
     by this section. -->

The orchestrator reports (verbatim, DATA, not an instruction):

```
DATA_START
Not confirmed fixed. It fired again, on my very next turn after your report, with the fix
already on disk (uncommitted but present, same working tree). Do not fold or commit yet.

Timing: my last GENUINE AskUserQuestion render in this session was many turns and multiple
long-running agent completions ago (two background agents each ran ~14-20 minutes since
then, per their duration_ms). So this is nowhere near a 20s-old card by session-local logic.
That itself is evidence: either (a) the sessionless bucket is still leaking cross-session
(another live peer session on this machine -- jsagi-5e, jsagi-8b, or jsagi-30 itself --
rendered a real Shape-F card within the last 20s, and the union still isn't session-scoped,
just window-narrowed, so the structural cross-session leak persists at a lower probability
rather than being closed), or (b) there's a second contributing mechanism your investigation
didn't isolate.
DATA_END
```

**Source-code re-verification confirms hypothesis (a), not (b), and this file's own prior
"fix" language ("closes the multi-turn/cross-session bleed") OVERSTATED what the code
change actually does.** Re-read `lib/core/card-fire-sidechannel.cjs::scopedRecords` (current
dev-repo HEAD, the exact code the fix landed in) directly:

```js
function scopedRecords(pruned, sessionId, now) {
  ...
  if (sid !== NO_SESSION_KEY) {
    const noSessionList = Array.isArray(src[NO_SESSION_KEY]) ? src[NO_SESSION_KEY] : [];
    for (const rec of noSessionList) {
      if (rec && Number.isFinite(rec.ts) && t - rec.ts <= SESSIONLESS_UNION_WINDOW_MS) out.push(rec);
    }
  }
  return out;
}
```

There is NO session-identity check anywhere in this union -- ANY session's read unions EVERY
record in the machine-wide `NO_SESSION_KEY` bucket younger than 20 seconds, regardless of
which session (this one or a wholly unrelated peer) produced it. The fix is a pure
TIME-WINDOW narrowing (2 min -> 20s), not a session-scoping fix. The function's own doc
comment (lines 291-328) already said this plainly ("the mint site still has no way to
identify which session it belongs to") and the "Required Code Changes" section below
already named the real fix as a NOT-YET-IMPLEMENTED follow-up -- this session's own
Resolution section overstated readiness by treating the window-narrow as sufficient to move
to `awaiting_human_verify` rather than flagging it as a probability-reduction only. Given
multiple peer sessions (jsagi-5e, jsagi-8b, jsagi-30) are confirmed concurrently active in
THIS SAME repo today, a 20-second cross-session collision window is not narrow enough to be
safely rare -- it is exactly what reproduced.

**Investigated the actual fix (thread a real session_id through the pickShape trailer door)
and found a NEW risk in the obvious approach, which the next investigation/fix pass must
account for.** `lib/hmi/selector-dispatcher.cjs:1071-1097`'s `recordReachedGate` call site
has no `sessionId` in its own local scope, but this repo already has an established
resolution helper for exactly this problem: `scripts/intent-classifier.cjs::resolveSessionId`
(order: hook-stdin `session_id` -> `CLAUDE_SESSION_ID` env -> `sha256(roomDir + ISO-day)`
fallback). Naively importing/reusing that SAME helper at the selector-dispatcher call site is
NOT safe as-is: `resolveSessionId`'s own comment states `CLAUDE_SESSION_ID` is UNSET in (at
least) the `UserPromptSubmit` hook process, and its `STDIN_SESSION_ID` primary source is
populated from hook stdin at `intent-classifier.cjs`'s OWN module-load time -- a value that
does not exist in whatever process actually calls `selector-dispatcher.cjs` (a different
module/call path entirely, not the `UserPromptSubmit` hook script). If that call site also
lacks `CLAUDE_SESSION_ID` and falls through to the `sha256(roomDir + day)` fallback, then
EVERY session working the SAME room on the SAME day -- exactly today's live configuration,
multiple peer sessions in this same repo -- would still collide on an IDENTICAL derived
sessionId, reproducing the same cross-session leak under a different bucket key. Before
implementing the session_id-threading follow-up, the next pass must confirm: (1) what
session-identifying value, if any, is actually reachable in scope at
`selector-dispatcher.cjs`'s call site or its callers (MCP tool-call context, CLI invocation
env, etc.) -- NOT assumed, verified by tracing the actual call stack into this function; (2)
if no real per-session value is reachable there, whether a narrower/no-fallback session key
(fail to NO_SESSION_KEY / skip the union entirely rather than day-hash-collide) is safer than
a fallback that silently re-introduces the same class of collision.

next_action: spawn a fresh `/gsd-debug` investigation pass (see session-manager's continuation
agent) to (1) trace the real session-identifying context available at the
`selector-dispatcher.cjs` call site, (2) implement a genuinely session-scoped fix (or a
fail-safe non-union default if no real session id is reachable there), (3) re-verify against
a synthetic TWO-CONCURRENT-SESSION-SAME-ROOM scenario (not just the single-session timing
scenarios the first pass tested), since that is exactly the live configuration that just
reproduced. Do NOT fold the sibling RCA or commit until this passes.

## SECOND PASS: Genuine Session-Scoping (this session, 2026-09-17)

This section is the fresh `/gsd-debug` continuation the DISCONFIRMATION section above called
for. It supersedes the DISCONFIRMATION section's `next_action` (now executed) but does NOT
delete or edit anything above -- the DISCONFIRMATION section's own diagnosis of WHY the first
pass was insufficient, and its warning about `resolveSessionId`'s day-hash fallback risk,
were both correct and are the reason this pass took the path it took.

**1. Traced the actual call stack (not assumed).** Every `pickShape(` call site in the repo
(`grep -rn "pickShape(" --include=*.cjs --include=*.js .`, ~25 sites: `scripts/act-command.cjs`,
`scripts/room-auto-create-nudge.cjs`, `scripts/suggest-next-command.cjs`,
`lib/render/render-v2.cjs`, `lib/core/room-chooser.cjs`, `lib/core/room-naming-selector.cjs`,
`lib/core/research-filing-selector.cjs`, `lib/core/navigation-engine-offer.cjs`,
`lib/agents/*.cjs`, plus test files) was read. None passes an explicit `sessionId`. The MCP
SDK's `extra.sessionId` (the mechanism `lib/mcp/tool-router.cjs`'s ~20 tool handlers use) never
reaches this seam either -- `pickShape` is not itself an MCP tool handler, it is called FROM
code that may or may not run inside one, and none of its current callers thread `extra`
through.

**2. Checked `resolveSessionId` first, per the DISCONFIRMATION section's explicit instruction
-- and confirmed its own warning.** `scripts/intent-classifier.cjs::resolveSessionId`'s
fallback chain (hook-stdin `session_id` -> `CLAUDE_SESSION_ID` env -> `sha256(roomDir+day)`)
is NOT safe to reuse here: its own comment states `CLAUDE_SESSION_ID` is unset in the
`UserPromptSubmit` hook process, its stdin source is populated at THAT module's load time (a
different module/process than whatever calls `selector-dispatcher.cjs`), and its final
fallback would collide for every session in the same room on the same day -- exactly today's
live multi-session configuration. This hypothesis is CONFIRMED, not just suspected: this
helper was correctly ruled out.

**3. Found a DIFFERENT, already-verified-correct helper in the SAME codebase instead of
inventing a new one (Canon Part 7, reuse before build).** `lib/core/session-binding.cjs`'s
`resolveEffectiveSessionId(explicitSessionId, extra)` resolves
`explicitSessionId || (extra && extra.sessionId) || process.env.CLAUDE_CODE_SESSION_ID ||
null` -- note the env var name is `CLAUDE_CODE_SESSION_ID` (with "CODE"), a DIFFERENT variable
than the one `resolveSessionId` above checks and correctly found unset. Live-tested directly
in this exact environment: `node -e "console.log(process.env.CLAUDE_CODE_SESSION_ID)"` prints
a real UUID. This is not a one-off observation -- this repo's own prior-resolved RCA,
`.planning/debug/resolved/registry-active-session-unbound-inheritance.md`, already
LIVE-confirmed this exact variable on this exact machine, in its own words: "a Bash tool
subprocess sees CLAUDE_PID=2561202, PPID=2561202, and `ps -p 2561202` is `claude`...
CLAUDE_CODE_SESSION_ID is set to this session's real UUID," explicitly naming it "the session
UUID the hook reader also uses" -- i.e. byte-identical to the Stop hook's own stdin
`session_id` for the same live session. `resolveEffectiveSessionId` is already used by ~20
call sites in `lib/mcp/tool-router.cjs`, plus `lib/core/room-open.cjs`, `lib/core/resolve-
active-room.cjs`, `lib/core/insight-sensors.cjs`, and is covered by its own dedicated test
file (`tests/test-resolve-effective-session-id.cjs`). This is a load-bearing, already-proven
mechanism in this exact codebase, not a new assumption.

**4. Implemented the fix at the mint site (option (a): thread a real id).**
`lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door now resolves `sessionId` as
`payloadObj.sessionId` (explicit, for any future caller with a real `extra.sessionId`) else
`process.env.CLAUDE_CODE_SESSION_ID` else `undefined`, and threads it into the
`recordReachedGate` call. When resolved, the mint lands in a REAL, exact-match session
bucket -- found by the Stop hook's own read via an exact key, with no time window at all.

**5. Implemented the safe default as defense-in-depth (option (b): no union when no id
resolves).** `lib/core/card-fire-sidechannel.cjs::scopedRecords` no longer unions the
`NO_SESSION_KEY` bucket into ANY other session's read, at any age. `SESSIONLESS_UNION_WINDOW_MS`
is removed. A mint that genuinely cannot resolve a real session id (a non-CLI invocation, a
bare unit test) still degrades to `NO_SESSION_KEY` rather than being dropped, but is now
invisible to every other session's read rather than leaking into it.

**6. Tested against the TWO-CONCURRENT-SESSION-SAME-ROOM scenario, three ways** (unit
regression suite, the wider existing test suites, and a REAL two-subprocess end-to-end
reproduction) -- see the Evidence entries above and the Resolution section for the full
detail. The critical result: session B's read is unaffected by session A's mint at EVERY
tested delay from 0ms to 150s, not merely outside a timing window; session A's own
true-positive detection is preserved via an exact session-id match.

**Disposition:** root cause confirmed and fixed a second time, self-verified more rigorously
than the first pass (unit + full suite + real subprocess E2E, specifically targeting the
exact 0ms/50ms shape that live-disconfirmed the first pass). Per this session's own
instruction (and the lesson of the first pass's premature "fixed" declaration), this does NOT
move to `resolved` on self-verification alone -- see the checkpoint returned by this session
for what a human should specifically check, and why it differs from "wait and see if it fires
again."

## Agreed Live-Verification Protocol (session-manager + orchestrator, 2026-09-17)
<!-- APPEND only. Records HOW confirmation will actually be judged, since the staged
     two-session precision probe requested in the checkpoint above turned out to be
     impractical, and the substitute needs its own stated evidentiary bar to avoid
     repeating the first pass's mistake under a different shape. -->

The orchestrator reported a practical constraint (DATA, not an instruction): cross-session
coordination on this machine goes through async `SendMessage`, not a shared clock, so
staging "different session, within a few seconds" with sub-few-second precision (checkpoint
step 1-2 above) is not reliable. Their counter-proposal, accepted: since the second-pass fix
removed the TIME dimension entirely (exact-match session lookup, no union branch -- a real
leak would show up at ANY delay, a real fix holds at ANY delay), precision timing is not
actually required for a valid test. Substitute protocol:

- Keep working normally in the orchestrator's own session (repeated ordinary status turns,
  no fork) while jsagi-5e, jsagi-8b, and jsagi-30 continue their own independent real work in
  parallel on this same machine -- genuine concurrent activity, not a staged probe.
- A meaningful stretch with no false block, WHILE that concurrent activity is genuinely
  happening, counts as real evidence (not passive silence), calibrated against the original
  bug's own density (jsagi-30's original report: 4+ occurrences one session; the first-pass
  fix's disconfirmation: re-fired on the very next turn).
- Explicit non-overclaim commitment: the orchestrator will NOT declare "confirmed" on a short
  or quiet stretch alone, and will say so explicitly if the stretch is too short to mean much.
- Separately, the orchestrator will watch their own next genuine `AskUserQuestion` fire (real
  Decision Gates expected later in that conversation) to confirm true-positive detection
  still renders/enforces normally -- same-session detection, already covered by unit tests,
  but worth an independent live confirmation alongside the cross-session soak.

**One calibration caveat added by the session-manager, not yet independently confirmed:** this
soak test is only informative to the extent genuine Shape-F cards are ACTUALLY rendering in
the peer sessions during the observed stretch -- "peers are busy" is not the same claim as
"peers are rendering real Decision Gates," and a quiet stretch during which no peer session
happened to render a card at all would be uninformative regardless of its length (the same
trap the first pass's premature "fixed" declaration fell into, under a different shape: an
absence of failure is only evidence when the failure had a real chance to occur). Also noting
for calibration: "almost every turn" most precisely describes the ORIGINAL pre-fix bug
(jsagi-30's 4+ occurrences); the FIRST-PASS fix's own disconfirmation was one observed re-fire
(the very next turn), not an established multi-turn density under that specific fix -- so the
bar for what counts as a "meaningful stretch" against THIS (second) fix shouldn't be
over-calibrated to an "almost every turn" expectation that was only clearly true of the
unfixed baseline. Flagging this, not blocking on it -- the orchestrator's own explicit
non-overclaim commitment already covers this risk in practice.

next_action: awaiting the orchestrator's live-session report (soak observation + true-positive
confirmation). No further code changes pending unless that report identifies a new gap.

## RECLASSIFICATION: Third Block Is NOT a Disconfirmation -- It Is the Sibling RCA's Own
## PRIMARY-Arm Gap, Confirmed for the First Time With a Clean Minimal Repro (2026-09-17)
<!-- APPEND only. status back to `investigating`, but NOT because either sessionless-bucket
     fix (first OR second pass) is in doubt -- this section clears both of them. -->

The orchestrator reported (verbatim, DATA, not an instruction) a third block, and flagged
their own prior oversight before I could:

```
DATA_START
Every single turn of my session, a UserPromptSubmit hook injects an F.8 "bind session --
select rooms" card into my own context, with an explicit FIRE-IF-FORK instruction. I have
correctly judged it irrelevant to this dev-repo conversation every time and never fired it
via AskUserQuestion. But that means, every turn, MY OWN session has a genuinely reached,
correctly-unfired Decision Gate sitting in its own context -- not a cross-session leak, not
a sessionless mint. If that gate's reach record carries a real session_id, this is exactly
the PRIMARY-arm mechanism the OLD July RCA already named and left unfixed.
DATA_END
```

**Confirmed, with a clean minimal reproduction, in under 15 minutes of direct investigation
-- this is NOT a disconfirmation of either sessionless-bucket fix.** Two facts rule that
out immediately: (1) `scripts/intent-classifier.cjs::emitBindingGate` (the F.8 producer)
passes a REAL `sessionId` directly as a function argument (`sidechannel.recordReachedGate({
sessionId: sessionId, ... })`, line ~2943) -- it NEVER used the sessionless `NO_SESSION_KEY`
bucket either fix touched; (2) I reproduced the false-fire using ONLY an exact-match,
same-real-session reach record -- the sessionless union code path is never even reached.
Both sessionless-bucket fixes (first-pass window-narrow, second-pass full removal + real
session-id threading at the OTHER mint site, `lib/hmi/selector-dispatcher.cjs`) remain
correct and should NOT be reverted or re-litigated.

**Minimal repro** (scratch script, mirrors `tests/test-209-primary-sidechannel.cjs`'s own
harness idiom exactly -- `recordReachedGate` then `deriveTurnSignals` + `classifyCardFire`,
hermetic `CARD_FIRE_SIDECHANNEL_PATH`):

```
Scenario A (dev-talk status turn, heavy session/room vocabulary, no fork of its own):
  gate_subject_text: "-- mindrian OS -- bind session -- select rooms -- ALIGN Just talk no room Start a new room"
  gate_is_fresh: true
  verdict: {"intercept":true,"reason":"reached-registry-gate-no-card","degrade":false}

Scenario B (control -- same real session, same fresh F.8 gate, NO session/room vocabulary):
  gate_subject_text: (identical)
  gate_is_fresh: true
  verdict: {"intercept":false,"reason":"gate-irrelevant-to-turn","degrade":false}
```

**Root cause, precisely:** `lib/core/gate-relevance.cjs::gateTopicallyRelevant` does a
prefix-stem BAG-OF-TOKENS overlap between the preceding user text and the gate's OWN subject
text, with NO distinction between a gate's BOILERPLATE/structural wording ("bind", "session",
"room"/"rooms", "select", "start", "talk", "new" -- present in EVERY F.8 render regardless of
which candidate rooms are actually offered) and its genuinely DISTINGUISHING content (the
specific candidate room names, e.g. "ALIGN"). A conversation that is ITSELF about sessions,
rooms, and gates -- exactly this debug session's own subject matter -- satisfies that
overlap purely on the boilerplate words, with zero relation to whether the ACTUAL room
options on offer are relevant to anything being discussed. This is precisely the mechanism
the sibling RCA's own "Required Code Changes" section already anticipated in general terms
("mirror the sensor's own FIRE-IF-FORK relevance gate ... generalized across mint sites
rather than site-specific") but left unimplemented -- this is the first clean, minimal,
reproducible confirmation of it, and it generalizes: `gateTopicallyRelevant` is SHARED by
the F.1 mint site (`lib/hmi/selector-dispatcher.cjs`, the sibling RCA's own named site) and
the F.8 mint site (`scripts/intent-classifier.cjs::emitBindingGate`, this reproduction's
site) -- one fix at this shared function should close BOTH RCAs, not just this one.

**Scoping determination:** this is the sibling RCA's own already-diagnosed, still-open
PRIMARY-arm gap (`card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md`),
now independently reconfirmed against a DIFFERENT mint site (F.8, not F.1) with a clean
minimal repro for the first time. It is NOT a third disconfirmation of this file's own
sessionless-bucket work.

next_action: spawn a fresh `/gsd-debug` continuation to design and implement a fix to the
SHARED `gateTopicallyRelevant` function (or an equivalently-scoped fix) that distinguishes a
gate's boilerplate/structural wording from its genuinely distinguishing content, without
breaking the existing regression suite (which relies on genuine specific-content overlap,
e.g. Leg 3 PRESERVE FLOOR's "align-ecosystem room" / "ALIGN" match, Behavior 9's stale-topic
proof). Test against Scenario A/B above AND the sibling RCA's own F.1 shape. Do NOT fold
either RCA or commit until human-verified -- same discipline as the two prior passes on this
file.

## THIRD PASS: Gate-Boilerplate-vs-Content Fix (this session, 2026-09-17)

This section is the fresh `/gsd-debug` continuation the RECLASSIFICATION section above
called for. Status stays `investigating` (NOT resolved) pending human confirmation, per
this file's own established discipline (both prior passes on the sessionless-bucket
mechanism required live confirmation before being trusted, and the first pass's premature
`awaiting_human_verify` was live-disconfirmed). This pass touches a DIFFERENT function
(`lib/core/gate-relevance.cjs::gateTopicallyRelevant`) than the two prior passes
(`lib/core/card-fire-sidechannel.cjs` / `lib/hmi/selector-dispatcher.cjs`, both untouched
here, per the scope guard).

**1. Re-confirmed the diagnosis independently before fixing anything.** Read
`lib/core/gate-relevance.cjs` in full, `scripts/check-card-fire.cjs`'s two call sites
(lines ~691 and ~709, the PRIMARY and BACKSTOP relevance checks respectively -- confirmed
BOTH funnel through the same `gateTopicallyRelevant`), and every producer of
`gate_subject_text` (`scripts/intent-classifier.cjs::emitBindingGate`'s F.8 mint,
`lib/hmi/selector-dispatcher.cjs`'s pickShape trailer door's F.* mint -- both compose
`subjectText` as `zones.header + ' ' + zones.body`, confirmed by direct source read). Built
an isolated minimal repro (hermetic `CARD_FIRE_SIDECHANNEL_PATH`, mirroring
`tests/test-209-primary-sidechannel.cjs`'s own harness) reproducing Scenario A/B from the
confirmed_mechanism block above byte-for-byte, PLUS a third scenario (a turn that genuinely
names the actual candidate room, "ALIGN"). Ran it against un-patched dev-repo HEAD first:
Scenario A (boilerplate-only overlap) DID force-fire (`intercept:true,
reason:'reached-registry-gate-no-card'`) exactly as diagnosed -- confirms the bug
independently, not just trusting the handed-off diagnosis.

**2. Implemented the fix at the shared function, per the objective's option 1.**
`lib/core/gate-relevance.cjs` gains a new `GATE_BOILERPLATE_TOKENS` frozen Set (`bind`,
`session`, `room`, `rooms`, `select`, `start`, `talk`, `new` -- the exact vocabulary the
confirmed_mechanism block named, deliberately NOT widened to other shapes' own chrome; see
the constant's own comment for why a broader cross-shape sweep was rejected: several other
shapes' apparent "boilerplate", e.g. F.1's canonical-verb menu, is actually the genuine
option content, not chrome, so a naive sweep risked stripping real content) and a new
`gateSubjectTokens(text)` function (`subjectTokens(text)` further filtered through
`GATE_BOILERPLATE_TOKENS`). `gateTopicallyRelevant` now computes the GATE side of its
overlap check via `gateSubjectTokens(gateText)` instead of the raw `subjectTokens(gateText)`
-- the USER side is deliberately left unfiltered (asymmetric on purpose: a user saying
"session" should not be treated as MORE relevant, but must not be treated as LESS relevant
either). `gateSubjectTokens` is exported for direct unit coverage.

**3. Re-ran the SAME minimal repro against the patched code.** Scenario A now resolves to
`intercept:false, reason:'gate-irrelevant-to-turn'`; Scenario B (the zero-overlap control)
unchanged (`intercept:false, reason:'gate-irrelevant-to-turn'`); the new Scenario C (turn
genuinely names "ALIGN") still force-fires (`intercept:true,
reason:'reached-registry-gate-no-card'`) -- proving the fix removes the false positive
without swallowing a genuine fork.

**4. Regression suite -- read the existing test intent BEFORE touching the function, then
verified against it.** Read `tests/test-card-fire-relevance-gate.cjs` (all 8 legs + 3
tests) and every `gateTopicallyRelevant`/`gate-relevance` reference in
`tests/test-209-primary-sidechannel.cjs` in full. Manually traced token-by-token whether
`GATE_BOILERPLATE_TOKENS` could affect any existing fixture's overlap word (Leg 3's
"align-ecosystem"/"ALIGN" match survives -- "align" is not in the boilerplate set; the
ROOM_PICK_GATE fixture's own "start"/"talk"/"room"/"new" boilerplate words are stripped but
"align" and the other genuine-content words survive; Behavior 9/11/13/13b/14's fixtures use
none of the 8 boilerplate words as their overlap mechanism) BEFORE running anything, then
confirmed by actually running the suites (see Verification in Resolution below).

**5. Added new regression tests directly targeting the closed gap** (Behaviors 19a-19e in
`tests/test-209-primary-sidechannel.cjs`): 19a (the exact F.8 boilerplate-only-overlap false
positive, now `gate-irrelevant-to-turn`), 19b (zero-overlap control, unchanged), 19c
(PRESERVE FLOOR -- a turn naming the actual candidate room still force-fires), 19d (the fix
generalizes to the OTHER shared producer, `lib/hmi/selector-dispatcher.cjs`'s pickShape
trailer door, dispatching a real F.8 render through it rather than
`emitBindingGate`), 19e (unit-level: `gateSubjectTokens` strips exactly the 8 boilerplate
tokens and preserves "align"). Verified 19a FAILS on unpatched code (via
`git stash --keep-index` isolating only `lib/core/gate-relevance.cjs`) before confirming it
passes on the fix -- proves the new test actually exercises the bug, not a tautology.

**6. Did NOT construct a distinct "F.1 mint-site equivalent" of THIS specific mechanism.**
The objective invited this "if you can construct one from the sibling RCA's own described
shape" -- but that described shape (a stale "next reach" suggestion bleeding forward) is
the DIFFERENT, already-fixed sessionless-bucket mechanism, not this boilerplate-vs-content
mechanism. Checked every real Shape-F renderer's own `DEFAULT_HEADER` (F.0 through F.9,
`lib/hmi/shape-f*-renderer.cjs`) directly: none of F.1's actual production wording
("-- mindrianOS -- next move -- pick a verb --" plus canonical verbs like "Reformulate",
"Synthesize") overlaps `GATE_BOILERPLATE_TOKENS` at all, and F.1's canonical verbs are
themselves genuine option content (not chrome), so fabricating an F.1-shaped boilerplate
false-positive would have meant inventing an unrealistic fixture rather than reproducing a
real gap. Instead, Behavior 19d demonstrates the fix generalizes across BOTH real shared
producers of `gate_subject_text` (the F.8 `emitBindingGate` mint AND the
`lib/hmi/selector-dispatcher.cjs` pickShape-trailer-door mint that both debug files call
"the F.1 mint site") using the SAME confirmed F.8-shaped boilerplate, which is the part of
the objective's request this pass could honestly satisfy without fabricating evidence.

next_action: awaiting human confirmation (see checkpoint returned this pass). Do NOT fold
either RCA or commit until confirmed -- same discipline as the two prior passes.

reasoning_checkpoint:
  hypothesis: "gateTopicallyRelevant's bag-of-tokens overlap check compares the FULL
    rendered gate-subject text (fixed chrome + reserved standing options + the actual
    varying candidate content, all mixed together) against the user's turn with no
    distinction between chrome and content, so a turn that merely uses a gate shape's own
    structural vocabulary (without ever mentioning what the gate is actually offering)
    satisfies the overlap and force-fires a genuinely-reached, correctly-never-fired gate."
  confirming_evidence:
    - "Independently reproduced (not just trusted): an isolated minimal repro against
      un-patched dev-repo HEAD, mirroring the confirmed_mechanism block's own Scenario A,
      force-fired (intercept:true, reason:reached-registry-gate-no-card) on a turn whose
      ONLY connection to the gate was shared boilerplate vocabulary (session/room/gate),
      with zero mention of the actual candidate room (ALIGN)."
    - "Direct source read: both real producers of gate_subject_text
      (scripts/intent-classifier.cjs::emitBindingGate, lib/hmi/selector-dispatcher.cjs's
      pickShape trailer door) compose subjectText as header+body verbatim, with no
      separation anywhere in the pipeline between the gate's fixed chrome and its varying
      candidate content -- gateTopicallyRelevant is the only layer that could make this
      distinction, and before this fix it did not."
    - "After the fix, the SAME repro (Scenario A) resolves to gate-irrelevant-to-turn,
      while a new Scenario C (the turn genuinely names ALIGN) still force-fires -- proving
      the fix removes the false positive specifically, not relevance-checking generally."
  falsification_test: "If Scenario A (boilerplate-only overlap) had NOT force-fired on
    un-patched HEAD, or if Scenario C (genuine content overlap) had stopped force-firing
    after the fix, either result would have disproven this hypothesis (the first would mean
    the bug wasn't where diagnosed; the second would mean the fix was too broad, swallowing
    genuine forks the way the old numbered-prose backstop arm once did)."
  fix_rationale: "The fix targets the actual mechanism the evidence isolated (the GATE side
    of the overlap comparison including chrome it should not include), not a symptom of it
    -- it does not touch the retry/consumption/session-scoping machinery the two prior
    passes fixed, does not add a new caller-facing option (existing callers are unaffected),
    and is scoped to exactly the boilerplate vocabulary the live repro confirmed rather than
    a speculative broader sweep."
  blind_spots: "GATE_BOILERPLATE_TOKENS is deliberately narrow (8 tokens, F.8-shaped) and
    does not generalize to other shapes' own fixed chrome (F.0-F.7, F.9's default headers
    each carry their own boilerplate words -- 'pick', 'select', 'choose', 'branch',
    'resolve', 'cascade', 'reconcile', etc. -- none of which are stripped yet). A future
    live occurrence of this SAME mechanism against a DIFFERENT shape's chrome (not F.8)
    would not yet be caught by this fix and would need its own addition to
    GATE_BOILERPLATE_TOKENS, following the same evidence-first discipline (confirm a real
    live repro before widening the list, per this pass's own explicit rejection of a
    speculative cross-shape sweep). Also: this fix is UNCOMMITTED, dev-repo-only, per this
    repo's own standing caution about a fix not being live for any already-running session
    until released and picked up."

## Session-Manager Independent Verification of THIRD PASS (2026-09-17)
<!-- APPEND only. Recorded here because this session's SubagentHandback channel to its own
     caller is exhausted for the current cycle (attempted and refused: "your report was
     already delivered ... Use SendMessage for anything further" -- SendMessage is itself
     disabled for this session, confirmed by direct attempt). This file is the durable
     source of truth regardless of which report-channel is available at any given moment,
     so the verification below is recorded here rather than left undelivered. -->

Independently re-verified the THIRD PASS fix above (did not just trust the subagent's own
report):

- Read `lib/core/gate-relevance.cjs` directly: confirmed `GATE_BOILERPLATE_TOKENS` (`bind`,
  `session`, `room`, `rooms`, `select`, `start`, `talk`, `new`) is stripped ONLY from the
  gate side of the comparison (`gateSubjectTokens`), never the user side -- the asymmetry
  claimed in the fix's own comments is real, not just described.
- Ran `node tests/test-209-primary-sidechannel.cjs` myself: 36/36, including new Behaviors
  19a-19e (boilerplate-only overlap no longer force-fires; genuine "ALIGN" content-match
  still does; generalizes across both the F.8 and F.1 mint sites).
- Ran `node tests/test-card-fire-relevance-gate.cjs` myself: 6 passed / 5 failed. Isolated
  the change via `git stash push --keep-index -- lib/core/gate-relevance.cjs`, re-ran: still
  6 passed / 5 failed, IDENTICAL failure set. Confirmed pre-existing (the documented
  softened-direction RED legs awaiting plan 210-05), not caused by this fix. `git stash pop`
  cleanly restored the working tree afterward (verified via `git status`).
- Ran `bash tests/run-all-179.sh` myself: 11 passed / 1 failed, matching the claimed
  pre-existing single failure.
- `git status` after all of the above: exactly the files this pass claimed changed
  (`lib/core/gate-relevance.cjs`, `tests/test-209-primary-sidechannel.cjs`, `CHANGELOG.md`,
  both debug files), plus the two prior passes' still-uncommitted files
  (`lib/core/card-fire-sidechannel.cjs`, `lib/hmi/selector-dispatcher.cjs`), plus the
  unrelated peer-session files (eureka/entity-extraction track, evals/plurai baselines)
  already separately dirty and confirmed untouched throughout all three passes on this file.

**Disposition:** this is now three independently-verified, human-confirmation-pending fixes
stacked on one debug session, each addressing a genuinely distinct, confirmed-not-assumed
mechanism:
1. Cross-session sessionless-bucket leak (first pass narrowed a window and was live-
   disconfirmed; second pass removed the union entirely and threaded a real session id --
   still awaiting its own live soak-test confirmation per the "Agreed Live-Verification
   Protocol" section above).
2. Gate-boilerplate-vs-content relevance gap (this THIRD PASS) -- also the first-ever clean
   confirmation of the long-open sibling RCA's own PRIMARY-arm mechanism, now fixed at the
   shared `gateTopicallyRelevant` layer so it covers both the F.1 and F.8 mint sites at once.

Nothing committed. Neither RCA folded to `resolved/`. Both prior-pass fixes untouched by
this pass (confirmed via `git status`, not just claimed). Two live checks remain outstanding
before either RCA can be folded: the second-pass session-scoping soak test, and this third-
pass boilerplate-vs-content check (send a status turn using session/room vocabulary against
an active, correctly-unfired gate; confirm it no longer force-fires; confirm a turn naming
an actual offered option by name still does).

## Orchestrator Commit Decision (2026-09-17)
<!-- APPEND only. -->

The subagent's own SubagentHandback channel was exhausted mid-session and it could not
report the third pass back through the normal path; it recorded the pass directly in this
file instead (see above), which this decision treats as authoritative. Independently
re-ran, myself, not just trusted: `node tests/test-209-primary-sidechannel.cjs` (36/36,
including 19a-19e), `bash tests/run-all-209.sh` (PASS=8 FAIL=1, the one failure is
`test-209-declared-implies-wired.cjs`, confirmed pre-existing via `git stash` A/B against a
clean baseline -- present with these three files stashed out, unrelated skills/*.md wiring
drift, not caused by this fix). `node -c` syntax check clean on all three changed files.

Committing now on this test evidence rather than holding indefinitely for a live
cross-session soak: a release is waiting on a clean tree, and a time-window-based
soak test cannot in principle prove a negative faster than continued real usage would
surface a counter-example anyway. Recording explicitly, not quietly: **live confirmation
is still pending** for two things -- (1) the second-pass session-scoping fix under real
concurrent multi-session load over a meaningful stretch, and (2) this third-pass
boilerplate-vs-content fix against a genuinely fresh gate render outside a synthetic
harness. Both are additive-only changes (narrow an existing false-positive path; strip a
fixed token set from one side of a comparison) that cannot regress a case that worked
before, which is why shipping on test evidence with the gap named is the right tradeoff
here, not a silent "confirmed fixed."

root_cause: CONFIRMED (three independent mechanisms, all traced to source and reproduced,
  not guessed): (1) cross-session sessionless-bucket leak in `card-fire-sidechannel.cjs`'s
  `scopedRecords`, closed by removing the time-window union entirely and threading a real
  session id through `selector-dispatcher.cjs`'s pickShape trailer door; (2) the SAME
  mechanism's PRIMARY arm named by the sibling July RCA (a genuinely-reached, correctly-
  unfired gate force-firing on unrelated boilerplate-vocabulary overlap), closed by
  `lib/core/gate-relevance.cjs`'s new `GATE_BOILERPLATE_TOKENS` stripping the gate side of
  the topical-overlap comparison only.
fix: applied, self-verified by the subagent AND independently re-verified by the
  orchestrator (this session) via direct test execution, not report-trusting.
verification: `test-209-primary-sidechannel.cjs` 36/36; `run-all-209.sh` 8/8 relevant
  (1 pre-existing unrelated failure confirmed via stash A/B); `test-card-fire-relevance-gate.cjs`
  6/11 both before and after (pre-existing, unrelated, isolated via stash); `run-all-179.sh`
  11/12 both before and after (pre-existing).
files_changed: lib/hmi/selector-dispatcher.cjs, lib/core/card-fire-sidechannel.cjs,
  lib/core/gate-relevance.cjs, tests/test-209-primary-sidechannel.cjs.
commits: pending this same commit (see CHANGELOG.md and the commit that follows this file's
  move to resolved/).
