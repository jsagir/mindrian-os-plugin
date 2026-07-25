---
kind: rca
slug: card-fire-over-enforcement
status: resolved
trigger: "check-card-fire.cjs (the Stop hook) repeatedly force-blocks turns demanding an AskUserQuestion card fire even when the model correctly judged the reach-card gate stale/irrelevant. User: 'this keeps happening i want to understand root cause', pasting a live Stop-hook-block transcript. Fourth+ live occurrence of the failure class already tracked in .planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md (3 prior instances: 2026-07-05, 2026-07-11, 2026-07-17)."
created: 2026-07-20
updated: 2026-07-20
canon_parts: [8, 11, 12]
related_todo: .planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md
---

# RCA: check-card-fire.cjs force-fires stale/irrelevant Decision Gate cards

## Symptoms

1. **Expected behavior:** when the model (Larry) reasons in its own turn that a
   registry reach-card gate is stale / carries zero connection to the current
   conversation, and says so in prose, the Stop hook should not force it to fire
   the card anyway.
2. **Actual behavior:** the Stop hook blocks the turn (`decision: 'block'`,
   `continue: false`) with the calm-phrase reason "rendering your choices as a
   selectable card" and an `additionalContext` re-prompt demanding an
   `AskUserQuestion` call, even on turns where the model already explicitly
   judged the gate stale and moved on.
3. **Error message (verbatim, this occurrence):**
   ```
   Ran 7 stop hooks
   Stop hook prevented continuation
   Stop hook error: rendering your choices as a selectable card
   Stop hook feedback: This turn REACHED a Decision Gate but did NOT fire the
   interactive card. You MUST fire the AskUserQuestion card NOW with the gate
   options as arrow-key-navigable choices. Do NOT render a flat ASCII box or
   "type 1, 2, or 3" text. Re-emit this turn with the AskUserQuestion tool call.
   ```
4. **Timeline:** failure class first logged 2026-07-05 (BACKSTOP + PRIMARY paths
   both implicated across the 3 prior instances). Local diagnostic log
   (`~/.mindrian/card-fire-intercepts.log`, 24h TTL window) shows the PRIMARY-path
   variant (`reached-registry-gate-no-card`) is now the DOMINANT live failure:
   39 intercept records across 4 sessions in the last 24h (2026-07-19T11:06Z to
   2026-07-20T07:36Z), 30 of them this exact reason, 8 hit the 3-retry bounded
   escape and gave up without ever getting a satisfying resolution.
5. **Reproduction:** run any short/terse turn (e.g. `/mos:doctor`) in a session
   where a registry gate-reaching surface (`scripts/intent-classifier.cjs`) minted
   a reach card within the last ~10 minutes, in ANY session -- the stale reach
   ("rethinking-mindrianos" / `claim:derive:47b3985f` in the live case) gets
   force-refired even though the current turn has nothing to do with it.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED. H1 and H2 both CONFIRMED and fixed; H3 ruled out as the
  mechanism (verified empirically). See Resolution below. The 2026-07-17
  `card-fire-relevance-check-gap` gate-existence guard did not hold because a
  stale bled side-channel record carries a non-empty `subject`, so it passed the
  "gate existed this turn" check on the wrong signal (subject-presence, not
  recency). This session closes it structurally with a turn-scoped freshness
  window (fix A) + a staleness-aware low-signal relevance default (fix B).
next_action: none - resolved, verified end-to-end, todo closed. Left uncommitted
  for the navigator to commit.

hypothesis (historical, at spawn): two independent, stacked defects in
  `scripts/check-card-fire.cjs`'s supporting modules, both already partially
  acknowledged in the code's own comments but never fixed:
  (H1) `lib/core/card-fire-sidechannel.cjs`'s `ran_entries` side-channel has NO
  session key and a ~10-minute TTL, so one real gate mint anywhere leaks into
  EVERY turn's `ran_entries`, in EVERY session, for the next 10 minutes (flagged
  verbatim in `scripts/check-card-fire.cjs` around the "card-fire-relevance-check-gap
  (2026-07-17)" comment near line 557). This makes `primaryHit` true on turns that
  minted no gate at all.
  (H2) `lib/core/gate-relevance.cjs::gateTopicallyRelevant`'s conservative floor:
  when the preceding user text yields fewer than `MIN_USER_SUBJECT_TOKENS` (2)
  subject tokens (>= `MIN_SUBJECT_TOKEN_LEN` 4 chars, non-stopword) -- true for
  most short slash-command triggers -- the function returns `true` (relevant),
  i.e. defaults to FORCE-FIRE rather than "insufficient signal, don't override
  the model's own judgment". This is the exact inverse of what's needed: short
  commands are the LEAST likely turns to relate to a stale multi-turn-old gate,
  and they're the turns this heuristic is blind on.
  Net effect: the model's own correct in-turn reasoning ("that reach card is
  stale, leaving it alone") is never consulted by the hook -- only a fixed
  `gate_subject_text` string compared against the terse trigger -- so the
  mechanical check overrides a correct model judgment.
next_action: verify H1 and H2 against the actual side-channel read/write code
  and the relevance-gate test suite (`tests/test-ga4-card-fire-e2e-179.cjs` and
  any `gate-relevance` specific tests), THEN implement both fixes:
  (A) session-scope the side-channel TTL union in `card-fire-sidechannel.cjs` so
  a mint in session X cannot leak into session Y's `ran_entries`, and tighten the
  window relative to the CURRENT turn rather than "any mint anywhere in the last
  10 minutes".
  (B) change `gateTopicallyRelevant`'s low-signal branch so it stops defaulting
  to force-fire on short text -- WITHOUT breaking the existing WR-06 guarantee
  (`tests/test-ga4-card-fire-e2e-179.cjs`, "option 2 please" case) that a terse
  turn immediately following an UNANSWERED, freshly-minted gate still force-fires.
  The distinction to encode: "short text, gate is fresh/this-turn" (stay
  conservative, force) vs "short text, gate is stale/prior-session/TTL-bled"
  (do not force). Run the full check-card-fire + gate-relevance test coverage
  before declaring done; update the linked todo file to reflect resolution.

## Initial evidence (seeded by orchestrator before debugger spawn)

- `scripts/check-card-fire.cjs` full read (1-951 of 1311 lines; PRIMARY/BACKSTOP
  detection, `classifyCardFire`, `buildEnforcementEnvelope` fully reviewed).
  `buildEnforcementEnvelope`'s intercept branch (reason: 'rendering your choices
  as a selectable card', systemMessage: 'Re-rendering your choices as a
  selectable card...', additionalContext matching this occurrence's paste
  verbatim) is confirmed the exact source of the pasted error text -- this IS
  the check-card-fire.cjs Stop-hook intercept, not a different hook.
- `lib/core/gate-relevance.cjs` full read (258 lines). `gateTopicallyRelevant`
  (line 229-251), `MIN_USER_SUBJECT_TOKENS = 2` (line 82), `MIN_SUBJECT_TOKEN_LEN
  = 4` (line 74) confirmed as described in H2 above.
- `~/.mindrian/card-fire-intercepts.log` (CR-07 diagnostic log, local, TTL-pruned
  24h) read directly. Two back-to-back live records (session `df394dc0-...`,
  2026-07-20T07:19Z and 07:22Z) show the model's OWN output text explicitly
  saying `"That reach card above is stale carryover from a prior session
  (claim:derive:47b3985f) -- nothing this turn connects to it, so I'm leaving it
  alone."` immediately followed by the hook forcing another intercept
  (`reached-registry-gate-no-card`) on the SAME stale reach in the SAME
  session shortly after -- direct evidence the relevance gate is not catching
  a case the model itself already correctly resolved in prose.
- Reason histogram across the full 24h log window: `reached-registry-gate-no-card`
  x30, `bounded-escape-released-after-3-retries` x8 (zero `ascii-box-backstop-no-card`
  in the current window -- the BACKSTOP-path variant documented in the linked
  todo's instances 2 and 3 is NOT what's currently dominant; PRIMARY-path
  (H1+H2 above) is).
- `.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`
  reviewed in full: 3 prior live instances logged (2026-07-05 PRIMARY-path,
  2026-07-11 and 2026-07-17 BACKSTOP-path), explicit "do not silently auto-fix --
  a human should decide the approach" instruction. The user (Jonathan) reviewed
  this session's findings and explicitly chose "fix both root causes now" via an
  AskUserQuestion gate this session -- the todo's human-decision condition is
  satisfied; proceed with a real fix, not another log-only entry.

## Leading hypotheses (for the debugger to test, do not assume)

- **H1 (side-channel session/TTL bleed):** confirm by reading
  `lib/core/card-fire-sidechannel.cjs`'s `recordReachedGate` / `readReachedGates`
  implementation directly -- does the union key carry a session_id at all, and
  if so, why isn't `readReachedGates(session_id)` filtering on it already (the
  header comment in check-card-fire.cjs implies it's CALLED with session_id but
  the leak persists -- check whether the underlying store itself is unscoped).
- **H2 (relevance-floor default):** confirm by reading
  `tests/test-ga4-card-fire-e2e-179.cjs`'s WR-06 case and any other tests
  asserting on `gateTopicallyRelevant` / `MIN_USER_SUBJECT_TOKENS` to understand
  exactly which short-text behavior must be preserved before changing the
  default.
- **H3 (alternative, to rule out):** the side-channel's `gate_subject_text` for
  the stale reach might itself be wrong/stale-but-still-topically-broad (e.g. it
  mentions "mindrianOS" generically, and a `/mos:doctor`-class command also
  mentions "mindrianOS"/"doctor"-adjacent words), producing a genuine token
  overlap rather than hitting the < 2-token floor. If so H2's fix target shifts
  from "the floor default" to "the overlap check needs recency/scope weighting,
  not just raw token intersection" -- verify which mechanism actually fired
  using the log's `gate_subject_text` field (not observed in the log excerpt
  read so far; may require re-reading with that field surfaced) before
  committing to the H2 fix direction.

## Evidence (debugger, 2026-07-20)

- timestamp: 2026-07-20 -- **H1 CONFIRMED** by reading
  `lib/core/card-fire-sidechannel.cjs` directly. `readReachedGates` /
  `readReachedGateSubjects` prune only by the 10-minute `TTL_MS` and UNION the
  `NO_SESSION_KEY` bucket into every session read. Two live bleed vectors: (1)
  cross-session via the `NO_SESSION_KEY` union (the `selector-dispatcher`
  trailer door records with no session_id); (2) cross-turn within a session via
  the 10-min session-bucket TTL. The live store
  (`~/.mindrian/card-fire-reached.json`) held a REAL-session
  `scripts/intent-classifier.cjs` reach with subject "rethinking-mindrianos -
  REACH - decision gate ...", re-surfacing on unrelated later turns.
- timestamp: 2026-07-20 -- **H2 CONFIRMED, dominant driver.** Ran
  `gateTopicallyRelevant` against the REAL stored stale subject with the actual
  reproduction triggers. `/mos:doctor`, `status`, `building`, `doctor`,
  `continue`, `go on` all yield `< 2` subject tokens and hit the floor default
  -> `true` (force-fire). This is the exact over-enforcement the user hit.
- timestamp: 2026-07-20 -- **H3 RULED OUT as the mechanism.** The intercept log
  schema (`ts, session_id, reason, gate_signature, ran_entries,
  matched_glyph_span, output_text`) does NOT persist `gate_subject_text` or
  `preceding_user_text`, so H3 was settled by reconstruction against the real
  subject. Only a minority of 2-token terse turns (e.g. `whats next`) produce a
  genuine overlap, and it is a SPURIOUS match on the gate's UI boilerplate
  ("Choose next reach"), not its topic. The dominant failure is the H2 floor,
  not a token overlap -> fix (B) stays the floor-default fix. Fix (A) closes the
  H3-minority cases anyway (the stale subject never reaches the relevance check
  once outside the turn window).
- timestamp: 2026-07-20 -- **Why the 2026-07-17 guard failed:** the
  `gate-existence` guard required a non-empty `gate_subject_text` as "proof a
  gate existed this turn," but the side-channel stores `subject` in the same
  record as `entry`, so a stale bled record carries BOTH -> passes the guard on
  subject-presence rather than gate-recency. The guard checked the wrong signal.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: A stale Decision-Gate reach recorded in the local card-fire
  side-channel bleeds into later turns (same session, via the 10-minute file
  TTL) and into other sessions (via the un-scoped `NO_SESSION_KEY` union),
  populating `ran_entries` + a non-empty `gate_subject_text` on turns that reached
  no gate. On a terse turn (fewer than 2 subject tokens, e.g. `/mos:doctor`),
  `gateTopicallyRelevant`'s low-signal branch defaulted to `true` (force-fire),
  so the Stop hook force-blocked the turn to demand a card for a gate the model
  had already, correctly, judged stale. The 2026-07-17 gate-existence guard did
  not catch it because the bled record carries a non-empty subject.
fix: |
  (A) lib/core/card-fire-sidechannel.cjs: added TURN_FRESH_MS (2 min), a
      turn-scoped freshness window. `scopedRecords` scopes the NO_SESSION_KEY
      union to that window (a sessionless mint can no longer leak across
      sessions); added `mostRecentReachedTs()` exposing gate recency. The 10-min
      file TTL still bounds the file.
  (B) lib/core/gate-relevance.cjs: gateTopicallyRelevant gained an optional third
      arg; its low-signal (< MIN_USER_SUBJECT_TOKENS) branch returns false when
      the caller marks the gate stale (opts.gateStale), instead of blindly
      forcing. The distinction encoded is STALENESS, not token count. Absent opts
      -> byte-identical to before (WR-06 floor preserved).
  (B-wire) scripts/check-card-fire.cjs: deriveTurnSignals computes gate_is_fresh
      (fresh = side-channel mint within TURN_FRESH_MS; direct-field / BACKSTOP
      gates are always fresh) and classifyCardFire threads { gateStale:
      !gate_is_fresh } into the PRIMARY-path relevance call (BACKSTOP path passes
      gateStale:false since its gate is this turn's own output).
verification: |
  End-to-end Stop-hook replay of the live incident shape:
    - STALE bled intent-classifier reach + terse /mos:doctor -> {"continue":true}
      (NOT blocked; over-enforcement fixed).
    - FRESH this-turn reach + terse /mos:doctor -> {"decision":"block"} (still
      force-fires; conservative floor preserved).
  Suites: test-209-primary-sidechannel 14/14 (new Behaviors 10/11 lock fix A + B),
  test-card-fire-relevance-gate 11/11, test-ga4-card-fire-e2e-179 47/47 (all
  WR-06 legs), test-ga4-card-fire-interceptor 27/27, test-doctor-card-fire-health
  6/6, test-210-trailer-relevance 4/4, run-all-179 12/12. Pre-existing failures
  outside this subsystem (209-05 room-pick, 210-D fusion-router, 210-E3 stamp
  sweep) fail identically on clean HEAD - not this fix.
files_changed:
  - lib/core/card-fire-sidechannel.cjs (TURN_FRESH_MS + scopedRecords freshness-scoped union + mostRecentReachedTs)
  - lib/core/gate-relevance.cjs (gateTopicallyRelevant staleness-aware low-signal default)
  - scripts/check-card-fire.cjs (gate_is_fresh derivation + gateStale threading)
  - tests/test-209-primary-sidechannel.cjs (Behaviors 10/11; refreshed a Phase-225-drifted source-proof count)
commits: uncommitted (left for the navigator to commit)
canon: Part 8 clean (LOCAL fs + string/number only, zero Brain/network); Tri-Polar unaffected (hook logic shared across CLI/Desktop/Cowork); no em-dashes.
