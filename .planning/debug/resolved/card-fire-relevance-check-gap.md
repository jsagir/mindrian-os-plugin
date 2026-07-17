---
status: resolved
kind: rca
trigger: "card-fire-relevance-check-gap"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: n/a
canon_parts: [11, 12]
created: 2026-07-17T00:00:00Z
updated: 2026-07-17T23:59:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** dev workspace `/home/jsagi/dev/MindrianOS-Plugin` @ dev HEAD, 2026-07-17. `scripts/check-card-fire.cjs` grep-verified directly this session: the PRIMARY detection path (`reached-registry-gate-no-card`) keys off `data/render-coverage-registry.json` gate-reaching entries actually invoked this turn; the BACKSTOP path (`ascii-box-backstop-no-card`) is a separate, broader output-text heuristic that fires "even for an OFF-registry surface" per the script's own doc comment (line ~44). These are two independent detection paths in the same script, not one.
- **WIRE claims probe against:** n/a, local Stop hook only, no Brain calls.
- **Date of audit:** 2026-07-17.
- **Re-verification rule:** this session's own live turns are the 3rd confirmed instance of the backstop over-firing (instances 1: 2026-07-05, 2: 2026-07-11, both already logged); this filing formalizes that as a `/gsd-debug` session so it can move past "capture only" toward an actual fix decision, which every prior filing has explicitly deferred.

## Current Focus

RESOLVED 2026-07-17. Root cause confirmed on BOTH mechanisms and the navigator-approved
fix applied ("widen scope: fix both"). BACKSTOP: `ascii-box-backstop-no-card` fired on a
pure syntactic shape match (`computeBackstopHit`), whose live-firing branch treated any
`1. ... 2. ...` numbered-prose list as a degraded gate when a common framing token (`?`,
which/pick/choose/select, or "N options/paths") sat near it -- 6 of 7 real fires were
ordinary enumerated prose (~86% false-positive net). PRIMARY: `reached-registry-gate-no-card`
force-fired whenever `ran_entries` held a registry gate-reaching surface, but the
side-channel's NO_SESSION_KEY union + 10-min TTL bleeds ONE real selector-dispatcher
gate-mint into `ran_entries` for every turn for ~10 minutes across all sessions, so
`ran_entries` alone is not proof a gate was reached this turn (10 consecutive false fires
in the live log).

fix_applied:
  FIX A (retire numbered-prose backstop): computeBackstopHit now returns
    ASCII_BOX_UNCONDITIONAL_RE.test(text) only (arms 1-3). ASCII_BOX_NUMBERED_PROSE_RE,
    GATE_FRAMING_RE, GATE_FRAMING_WINDOW retired; GATE_FRAMING_RE removed from exports.
    ASCII_BOX_GLYPH_RE kept BYTE-IDENTICAL (retry-key signature + Phase-209 matrix tests).
  FIX B (primary-path gate-existence guard): a PRIMARY intercept (primaryHit && !backstopHit)
    now requires a non-empty reach-recorded gate_subject_text AND topical relevance against
    THAT subject (never the outputText fallback). No subject -> primary-gate-existence-
    unconfirmed, no intercept. The outputText fallback is kept ONLY for the backstop path.

verified: 17-record live-log replay -> 0/17 re-fire; synthetic (a) bracket box still
intercepts, (b) genuine primary gate still force-fires, (c) empty-subject primary ->
unconfirmed; card-fire test suite green; zero new failures in run-all-209/210/230.

cfec3113 TRADE-OFF (flagged): the one genuine numbered-prose fork in the log (cfec3113,
"Two honest paths -- pick one: build vs file") will NO LONGER force-fire at the hook. This
is the deliberate cost of retire-entirely: the shape backstop could not separate the 1 real
fork from the 6 false positives. Catching a genuine numbered-prose fork is now the MODEL's
Phase-210 / SEED-021 judgment (its system prompt already mandates firing AskUserQuestion for
a real fork); a bracket-box `[1]...[2]` rendering of the same fork still force-fires. If the
hook-level catch is later wanted back, the fallback is the negation-guarded tighten-framing
variant, NOT re-adding the retired arm.

next_action: none -- resolved, awaiting navigator commit (fix left uncommitted per the
"leave committing to the navigator" instruction).

## Meta

- Repo: `/home/jsagi/dev/MindrianOS-Plugin`
- Plugin version: v1.15.3-beta.27 (dev HEAD)
- Reported by: this session, live, three times (the third against this exact turn sequence)
- Date first observed: 2026-07-05 (instance 1, `reached-registry-gate-no-card` path); 2026-07-11 (instance 2, `ascii-box-backstop-no-card` path, first occurrence); 2026-07-17 (instance 3, same backstop path)
- Related: `.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md` (the capture-only log of all 3 instances, "do not silently auto-fix -- a human should decide the approach" -- this debug session's job is to bring that decision to the navigator, not make it unilaterally); `.planning/debug/resolved/card-fire-block-surface.md` (RESOLVED -- a DIFFERENT pair of findings in the same script: the raw-slug message-leak, fixed via CR-06, and the binary-yes/no exemption, fixed via `gate-is-simple-binary` -- neither of those fixes touches the backstop's relevance gap, confirmed by this session's own 3rd live instance still firing after both landed); `.planning/debug/intern-qa-silent-degrade-pattern-three-independent-sessions-2026-07-14.md` (the OPPOSITE-direction sibling -- under-firing / silent-skip, not over-firing -- explicitly confirms `check-card-fire.cjs` "is neither complete for its own scope nor does it address the other three failure types at all," i.e. the two directions of this failure class are tracked separately and neither is resolved)

## Problem Statement

`scripts/check-card-fire.cjs`'s `ascii-box-backstop-no-card` path is meant to catch a Larry turn that silently DEGRADED a real Decision Gate into flat ASCII text instead of firing the interactive `AskUserQuestion` card (SEED-021). It instead appears to fire on any turn ending in ordinary prose following a REACH-class system-reminder, whether or not anything resembling a choice-box was ever rendered -- a false positive, not a caught degrade.

## Symptoms

expected: the backstop fires only when a turn's output text contains an actual rendered choice-picture (a `■ ... [1] [2] [3]`-shaped block, numbered options presented as a menu) with no accompanying `AskUserQuestion` tool call.
actual: fired on (1) 2026-07-11, a Brain-ingestion conversation ending in the plain closing question "Want me to check that instead?" -- no box rendered; (2) 2026-07-17 (this session), a turn ending "Now paste the rest -- steps 5 through 9... I'll hold the review until it's all in front of me" -- not even a question, a plain declarative request, no box rendered.
error message: `Stop hook blocking error from command: "node check-card-fire.cjs": rendering your choices as a selectable card` (the CR-06 calmed phrase, confirmed non-slug-leaking; the internal slug `ascii-box-backstop-no-card` is preserved only in the local diagnostic log per CR-07).
timeline: first logged 2026-07-05 (different path, `reached-registry-gate-no-card`); backstop path first logged 2026-07-11; this session adds a 3rd backstop instance, 2026-07-17. No fix attempted on the backstop path across 12 days despite 2 logged prior instances.
reproduction: not a scripted repro yet -- three independent live occurrences. Common shape across the two backstop instances: a REACH-class system-reminder appeared earlier in the turn, and the turn's own final output was ordinary multi-sentence prose (a question in one case, a plain request in the other) with no rendered box and no `AskUserQuestion` call.

## Eliminated

- hypothesis: this is the same bug as `reached-registry-gate-no-card` (instance 1, 2026-07-05).
  evidence: confirmed via direct code read this session -- `reached-registry-gate-no-card` keys off the render-coverage-registry (did a known gate-reaching surface run this turn); `ascii-box-backstop-no-card` is a separate function, explicitly documented as a broader catch-all that fires even for surfaces NOT on that registry. Two independent code paths, same script, same general failure class (fire without a real gate), different trigger logic. Rejected as "same bug"; retained as "same class, different mechanism, needs its own fix."
  timestamp: 2026-07-17T00:00:00Z
- hypothesis: the CR-06/CR-07 fix (message-leak calming, diagnostic log) already addresses this.
  evidence: CR-06/CR-07 only changed WHAT TEXT the user sees when the backstop fires (calm phrase instead of raw slug) and WHERE the slug is logged (local diagnostic file). Neither changes WHEN the backstop fires. This session's 3rd instance fired with the calmed CR-06 phrasing, confirming the leak fix landed but the over-firing itself is untouched.
  timestamp: 2026-07-17T00:00:00Z

## Evidence

- timestamp: 2026-07-17T23:22:00Z
  checked: computeBackstopHit + ASCII_BOX_NUMBERED_PROSE_RE + GATE_FRAMING_RE, and the 17-record diagnostic log (~/.mindrian/card-fire-intercepts.log).
  found: 7 `ascii-box-backstop-no-card` fires all had ran_entries:[] and every matched span was a `1. ... 2. ...` numbered-prose list of questions/caveats/steps, never a `[1] [2] [3]` box. Two smoking guns: gate_signature ede8c48a matched because "pick"/"choose" occurred INSIDE a Neo4j tool description ("silently pick the single best match -- do not ask the user to choose"); gate_signature 1f6aa762 matched because Larry wrote "Two real constraints here, NOT options to pick between" and the disclaimer's "pick" tripped the cue. Only cfec3113 was a defensible true positive. The other 10 records were the PRIMARY path (ran_entries:["lib/hmi/selector-dispatcher.cjs"], empty glyph span) firing on status/"building"/"boot the real one" prose across 4 session_ids over ~21 minutes -- the side-channel bleed.
  implication: the backstop cannot separate a genuine gate-rendered-as-text from an incidental numbered list; the primary path cannot tell "a gate ran this turn" from "a gate ran sometime in the last 10 minutes."

- timestamp: 2026-07-17T23:55:00Z
  checked: post-fix replay of all 17 captured firing records + 3 synthetic cases + the card-fire test suite + run-all-209/210/230 + doctor --acceptance.
  found: 0/17 records re-fire (records 1-10 -> primary-gate-existence-unconfirmed; records 11-16 backstop FPs incl. ede8c48a + 1f6aa762 -> no-gate-signal; record 17 cfec3113 -> no-gate-signal, the flagged trade-off). Synthetic (a) `[1] resume [2] new room` still intercepts via arms 1-3; (b) a registry-hit + relevant non-empty gate_subject_text + no card still force-fires reached-registry-gate-no-card; (c) a registry-hit with empty gate_subject_text -> primary-gate-existence-unconfirmed. Card-fire test suite green (relevance-gate 11/11, ga4 27/27, e2e-179 47/47, backstop-tuning 13/13, incident-replay 4/4, trailer 4/4, doctor-card-fire-health 6/6, primary-sidechannel Behaviors 5+9 green in isolation). Zero NEW failures introduced in run-all-209/210/230 (all remaining reds pre-exist at HEAD and are orthogonal: 209-05 reach-sensor edges, 209-06 recordReachedGate count-guard 3-vs-2, 210-D fusion-router, 210-E3 stamp sweep, 230-06b skillopt-eval, doctor coverage-gate skill-mirrors, verify-release-clean-tree = uncommitted-work artifact).
  implication: both mechanisms fixed with no card-fire regressions; ASCII_BOX_GLYPH_RE untouched (Phase-209 matrix tests + retry-key signature stable).

## Resolution

root_cause: |
  TWO independent mechanisms in scripts/check-card-fire.cjs, same over-firing failure class.
  (1) BACKSTOP (`ascii-box-backstop-no-card`): computeBackstopHit fired on a pure syntactic
  SHAPE match of the assistant output. Its live branch (ASCII_BOX_NUMBERED_PROSE_RE) treated
  any `1. ... 2. ...` numbered-prose list as a degraded gate whenever a GATE_FRAMING_RE token
  (`?`, which/choose/pick/select, "N options/paths/ways") appeared within 150 chars before it
  OR anywhere inside the option bodies. Those tokens are among the commonest words in prose, so
  clarifying-question pairs, informational step lists, and even a "NOT options to pick between"
  disclaimer all tripped it: 6 of 7 live fires were false positives (~86%).
  (2) PRIMARY (`reached-registry-gate-no-card`): force-fired whenever `ran_entries` contained a
  registry gate-reaching surface. But the card-fire side-channel's NO_SESSION_KEY union + 10-min
  TTL bleeds a single real selector-dispatcher gate-mint into `ran_entries` for EVERY turn for
  ~10 minutes across ALL sessions, so ran_entries alone is not proof a gate was reached this turn
  (10 consecutive false fires in the live log across 4 session_ids). The Phase-210 relevance gate
  did not help either path: on both, gate_subject_text fell back to outputText (the assistant's
  own reply), so gateTopicallyRelevant compared the user turn against the reply and almost always
  read "relevant" -- a structural no-op.
fix: |
  FIX A -- retire the numbered-prose backstop arm. computeBackstopHit now returns
  ASCII_BOX_UNCONDITIONAL_RE.test(text) only (arms 1-3: `[1]...[2]` bracket box, multiline
  bracket box, "type 1, 2, or 3"). ASCII_BOX_NUMBERED_PROSE_RE, GATE_FRAMING_RE, GATE_FRAMING_WINDOW
  removed; GATE_FRAMING_RE dropped from module.exports. ASCII_BOX_GLYPH_RE kept BYTE-IDENTICAL.
  FIX B -- primary-path gate-existence guard. In classifyCardFire, a PRIMARY intercept
  (primaryHit && !backstopHit) now requires a non-empty t.gate_subject_text (the reach's OWN
  recorded subject from the side-channel) AND gateTopicallyRelevant(precedingUserText,
  gate_subject_text) against THAT subject -- never the outputText fallback. No subject ->
  reason 'primary-gate-existence-unconfirmed', intercept:false. The outputText fallback is
  preserved ONLY for the backstop path. The Phase-209 guarantee (a genuine relevant primary
  gate with no card still force-fires) is intact.
verification: |
  17-record live-log replay: 0/17 re-fire (10 primary FPs -> primary-gate-existence-unconfirmed,
  6 backstop FPs incl. gate_signature 1f6aa762 + ede8c48a -> no-gate-signal, cfec3113 ->
  no-gate-signal = flagged trade-off). Synthetic tests (a) bracket box still intercepts,
  (b) genuine primary gate still force-fires, (c) empty-subject primary -> unconfirmed: all pass.
  Card-fire test suite green. run-all-209/210/230 + doctor --acceptance: zero NEW failures from
  this fix (all remaining reds pre-exist at HEAD and are orthogonal to card-fire, proven by
  stash-compare). doctor card-fire-health check: ok.
cfec3113_tradeoff: |
  RETIRE-ENTIRELY (per the explicit navigator decision, instruction 1) means the ONE genuine
  numbered-prose fork in the log (cfec3113, "Two honest paths -- pick one: build the plumbing
  now vs file it") NO LONGER force-fires at the Stop hook. The shape backstop could not separate
  that 1 real fork from the 6 false positives, so its genuine-fork catch is now the MODEL's own
  Phase-210 / SEED-021 responsibility (the system prompt already instructs Larry to fire
  AskUserQuestion for a genuine fork). A bracket-box `[1]...[2]` rendering of the same fork still
  force-fires via arms 1-3. FALLBACK if the navigator later wants cfec3113 preserved at the hook:
  the negation-guarded tighten-framing variant, NOT re-adding the retired arm.
files_changed:
  - scripts/check-card-fire.cjs (FIX A retire numbered-prose backstop + FIX B primary gate-existence guard)
  - tests/test-card-fire-relevance-gate.cjs (legs 1-5 -> bracket-box; legs 6-8 + Test 2 flipped to no-gate-signal)
  - tests/test-ga4-card-fire-interceptor.cjs (reachedNoCard + belowLimit primary fixtures given a confirmed gate_subject_text)
  - tests/test-209-primary-sidechannel.cjs (Behavior 5 recordReachedGate given a subjectText)
out_of_scope_flag: |
  test-209-primary-sidechannel.cjs line 120 asserts intent-classifier.cjs has exactly 2
  recordReachedGate call sites; it has 3 at HEAD (F.1 at ~1344 is undocumented vs the 2-site
  doctrine). This is a pre-existing 209 sidechannel-wiring drift, red at HEAD, NOT caused by or
  in scope of this card-fire fix, and NOT modified here (touching it risks masking a real wiring
  bug or colliding with active sibling work on intent-classifier.cjs). Flagged for a separate pass.
