---
phase: 179
plan: 11
subsystem: card-fire-interceptor
tags: [gap-closure, fix-wave, bounded-escape, livelock, session-ceiling, flapping-labels, part-8]
requires:
  - 179-10 (the gate-content anchor that introduced the CR-04 flap this wave bounds)
  - scripts/check-card-fire.cjs (the GA-4 R-1 cure interceptor)
provides:
  - a SESSION-WIDE intercept ceiling (content-INDEPENDENT, un-flappable) -- the TERMINAL convergence floor for the bounded-escape class
  - CR-04 fix (a box whose OPTION LABELS flap each retry now DEGRADES at the session ceiling instead of livelocking forever)
  - the per-gate counter retained for per-gate UX granularity; degrade if EITHER ceiling reached
  - the FLAPPING-LABELS + realistic-paraphrase e2e fixtures that close the byte-constant-labels blind spot
affects:
  - scripts/check-card-fire.cjs
  - tests/test-ga4-card-fire-e2e-179.cjs
tech-stack:
  added: []
  patterns: [session-wide-ceiling, content-independent-floor, dual-counter-either-degrades]
key-files:
  created: []
  modified:
    - scripts/check-card-fire.cjs
    - tests/test-ga4-card-fire-e2e-179.cjs
decisions:
  - "Add a SECOND, session-wide counter keyed on session_id ALONE (content-independent, un-flappable) with hard ceiling MAX_SESSION_INTERCEPTS=12"
  - "Bump BOTH per-gate AND session counters on every intercept; DEGRADE if EITHER reaches its ceiling"
  - "MAX_SESSION_INTERCEPTS = 4 x MAX_FORCE_RETRIES (12), well above 2 x, so the WR-07 two-distinct-gates per-gate degrade fires before the session ceiling"
  - "Reset semantics: a degrade OR a no-intercept Stop turn clears the session counter (the navigator got unstuck); a CONTINUOUS run of intercepts is bounded by MAX_SESSION_INTERCEPTS"
  - "Persist the session counter in the SAME ~/.mindrian/card-fire-retries.json at __session__:<id>, { count, ts } shaped, TTL-pruned identically (WR-02)"
  - "DELETE the false :218-220 comment that claimed the empty-only session-alone floor bounds the flap; correct it to name the session ceiling as the actual floor"
metrics:
  duration: ~40m
  completed: 2026-06-25
---

# Phase 179 Plan 11: GA-4 Session-Wide Intercept Ceiling (CR-04 BLOCKER -- the TERMINAL bounded-escape fix) Summary

**A content-INDEPENDENT session-wide intercept ceiling (`MAX_SESSION_INTERCEPTS=12`, keyed on `session_id` alone) that bounds a flapping per-gate key the per-gate counter can never catch -- the terminal cure for the bounded-escape livelock class (BL-01 -> CR-02 -> CR-03 -> CR-04).**

## What changed

GAP-CLOSURE fix-wave 179-11 cures the iteration-4 re-review **CR-04 BLOCKER** -- the FOURTH consecutive recurrence of the "no infinite loop guarantee dead on a reachable path" class. The 179-10 gate-content anchor cured CR-03/WR-07 but its per-gate key is derived from the GATE-IDENTIFYING content (the matched glyph span + the normalized option-label SET), which is **MODEL-CONTROLLED**. When the model re-emits the SAME stuck Decision Gate with DIFFERENT option labels each retry -- the single most natural LLM behavior under the interceptor's own "re-emit this turn" re-prompt -- the per-gate `gate_signature` FLAPS to a fresh non-empty key every retry, no single per-gate key ever reaches `MAX_FORCE_RETRIES`, and the bounded escape livelocks forever. The empty-only degenerate floor (`if (!glyphSpan && labelSet.length === 0) return ''`) fires ONLY on an EMPTY signature and provably NEVER catches a flapping NON-empty one; the 179-10 comment (`:218-220`) and SUMMARY claimed it "bounds" the flap -- that claim was false (the mitigation was documented but never wired).

**Root truth (the load-bearing insight):** ANY key derived from model-emitted content can be flapped; the ONLY identity that cannot be flapped is the SESSION itself.

**The fix (session-wide intercept ceiling -- the content-independent convergence floor):**

1. **KEEP** the existing per-gate counter (`gate_signature` key) and `MAX_FORCE_RETRIES=3` -- good UX: each genuinely-distinct gate gets forced up to N times.
2. **ADD** a second, session-wide counter keyed on `session_id` ALONE (content-INDEPENDENT, un-flappable) with its own hard ceiling `MAX_SESSION_INTERCEPTS=12` (4 x the per-gate cap, well above 2 x, so normal multi-gate sessions are unaffected but a flapping livelock is bounded). Stored at `__session__:<id>` in the SAME `~/.mindrian/card-fire-retries.json`, `{ count, ts }` shaped, TTL-pruned identically (WR-02).
3. On each intercept, **bump BOTH** counters (per-gate AND session). The predicate `classifyCardFire` **DEGRADES** if **EITHER** `per_gate_count >= MAX_FORCE_RETRIES` **OR** `session_count >= MAX_SESSION_INTERCEPTS`. The session ceiling is checked first and reported distinctly (`session-intercept-ceiling-reached-after-12-intercepts`).
4. **Reset semantics:** a degrade OR a no-intercept Stop turn (card fired / no gate signal) clears the session counter -- the navigator got unstuck, so the session is "unstuck". The load-bearing guarantee: a CONTINUOUS run of intercepts in ONE session cannot exceed `MAX_SESSION_INTERCEPTS` REGARDLESS of how the gate content / per-gate key flaps.
5. **DELETE/CORRECT** the false `:218-220` comment: it now states the empty-only floor does NOT catch a flapping non-empty signature and names the SESSION ceiling as the actual convergence floor. The file header bounded-escape paragraph gains a CR-04 section documenting the session ceiling.

## Performance

- **Duration:** ~40 min
- **Tasks:** 1 (single atomic fix: code + tests + corrected doctrine)
- **Files modified:** 2

## Accomplishments

- Session-wide intercept ceiling added (`MAX_SESSION_INTERCEPTS=12`, keyed on `session_id` alone via `__session__:<id>`); degrade if EITHER per-gate OR session ceiling reached.
- The FLAPPING-LABELS adversarial e2e: distinct per-gate keys every retry (genuinely different `opt-<run>-aaa/bbb/ccc` labels), session counter climbs to the ceiling, DEGRADES at ceiling+1; the degrade resets the session counter. Fails pre-fix (livelocks forever), passes post-fix (degrades at the session ceiling).
- The realistic-paraphrase e2e: the SAME three semantic options re-worded the way an LLM naturally paraphrases ("Solution-first" -> "Start from the solution" -> "Solution first" -> ...); the cycle is BOUNDED -- it degrades no later than the session ceiling (pre-fix it livelocked forever), every run before the degrade was a block.
- The WR-07-coexist e2e: a STABLE-label gate still converges via the PER-GATE counter (blocks MAX, then per-gate degrade) -- the session ceiling does not steal its budget. The existing WR-07 two-distinct-gates assertions stay green.
- The false `:218-220` comment corrected; the session counter is TTL-pruned + Part 8 clean.

## Task Commits

1. **Task 1: session-wide intercept ceiling (CR-04 cure) + FLAPPING-LABELS / realistic-paraphrase / WR-07-coexist e2e + corrected doctrine** - `d4676a42` (fix)

**Plan metadata:** `docs(179-11): complete session-wide intercept ceiling fix-wave` (the docs commit that carries this SUMMARY + STATE.md + ROADMAP.md; its hash is the commit recording this file)

## Files Created/Modified

- `scripts/check-card-fire.cjs` - Added `MAX_SESSION_INTERCEPTS` + `SESSION_KEY_PREFIX` constants; added `sessionKey` / `readSessionCount` / `bumpSessionCount` / `clearSessionCount` helpers (session counter in the same side-file at `__session__:<id>`, `{ count, ts }`, TTL-pruned); `classifyCardFire` now degrades if EITHER ceiling is reached (session ceiling checked first, reported distinctly); `main` reads the session count, bumps BOTH counters on intercept, clears BOTH on degrade/no-intercept; the false `:218-220` gate-signature comment corrected to name the session ceiling as the actual flap floor; the header bounded-escape paragraph gains a CR-04 section; exports extended.
- `tests/test-ga4-card-fire-e2e-179.cjs` - Added the CR-04 FLAPPING-LABELS adversarial e2e (5 assertions: blocks 1..ceiling on distinct keys, side-file holds MANY distinct per-gate keys, session counter reaches the ceiling, degrades at ceiling+1, degrade resets the session counter), the realistic-paraphrase e2e (2 assertions: bounded/degrades + every-run-blocked-before-degrade), the WR-07-coexist e2e (2 assertions: ceiling above 2x per-gate, stable gate still per-gate-degrades), and the `MAX_SESSION_INTERCEPTS` export assertion. The CR-02 / CR-03 / WR-07 per-gate-key-count assertions now strip the new `__session__:` entry so they stay exact. e2e 37 -> 47 assertions.

## Live proof (the CR-04 cure -- distinct per-gate keys + session counter climbing to the ceiling + degrade)

**Pre-fix (LIVELOCK reproduced against the post-179-10 `HEAD` code):** flapping option labels, same `session_id`, growing transcript, isolated `MINDRIAN_HOME`. Side-file: `179-11-CR04-prefix-livelock-proof.txt`.

```
MAX_FORCE_RETRIES = 3
run 1 -> BLOCK | distinct keys: 1
run 2 -> BLOCK | distinct keys: 2
run 3 -> BLOCK | distinct keys: 3
run 4 -> BLOCK | distinct keys: 4
run 5 -> BLOCK | distinct keys: 5
run 6 -> BLOCK | distinct keys: 6
run 7 -> BLOCK | distinct keys: 7   <- N DISTINCT count:1 keys, blocks FOREVER, never degrades
```

**Post-fix (CONVERGES at the session ceiling):** same flapping-labels driver. Side-file: `179-11-CR04-postfix-session-ceiling-proof.txt`.

```
MAX_FORCE_RETRIES=3  MAX_SESSION_INTERCEPTS=12
run  1 -> BLOCK         | session_count=1  per-gate-keys=1
run  2 -> BLOCK         | session_count=2  per-gate-keys=2
...
run 12 -> BLOCK         | session_count=12 per-gate-keys=12
run 13 -> DEGRADE/allow | session_count=0  per-gate-keys=12   <- session ceiling DEGRADES; resets the session counter
run 14 -> BLOCK         | session_count=1  per-gate-keys=13   <- a fresh run starts clean
```

Every per-gate key is distinct (`per-gate-keys` climbs 1..12 in lockstep with the runs -- the flap is real), yet the content-INDEPENDENT `session_count` climbs to 12 regardless and DEGRADES at run 13. The degrade resets `session_count` to 0.

**Pre-fix-fails / post-fix-passes (the e2e itself):** the new FLAPPING-LABELS assertions, run against the pre-fix `HEAD` script, threw immediately (`AssertionError: (CR-04) MAX_SESSION_INTERCEPTS is exported as a positive number above MAX_FORCE_RETRIES` -- the pre-fix script has no such export, and the livelock assertions cannot pass) -- `node` exit `1`. Against the fixed script -- `node` exit `0`, `PASS 47 assertions`.

## Full gate results

- **e2e** `tests/test-ga4-card-fire-e2e-179.cjs`: **47/47** (was 37; +10 CR-04 assertions).
- **unit** `tests/test-ga4-card-fire-interceptor.cjs`: **22/22** (backward-compat: direct-field envelopes unchanged; the session ceiling only fires on the live `main` path).
- **`tests/run-all-179.sh`**: **12 passed / 0 failed / 0 skipped** (FULLY GREEN -- all seven waves).
- **`tests/run-all-178.sh`**: **10 passed / 0 failed / 0 skipped**.
- **`tests/run-all-172.sh`**: **20 passed / 0 failed** (the CIRS four-class floor; prior closed-set intact).
- Frozen `lib/core/navigation/edges.cjs` / `lib/core/navigation/transitions.cjs` / `lib/core/room-birth.cjs` byte-unchanged (`git diff --stat HEAD` empty). Mints no reach / posture / edge / node. `reach-ids-drift` (frozen 6) + `posture-ids-drift` (frozen 3) fences green.
- **Part 8:** zero network / Brain / fetch / http / tls symbols in the changed script (only negating-doctrine comments). The session_id is an OPAQUE conversation identifier (not user content / not artifact text); the key is `__session__:<opaque-id>` and the value is a scalar count + timestamp -- no raw text egress, LOCAL `~/.mindrian` side-file only.
- **Em-dash:** zero U+2014 / U+2013 across both changed files (precise unicode scan: 0/0 each).

## Decisions Made

- **Session-wide counter keyed on `session_id` ALONE.** The only identity the model cannot flap. A continuous run of intercepts increments the same session counter regardless of how the per-gate key moves.
- **`MAX_SESSION_INTERCEPTS = 12` (4 x `MAX_FORCE_RETRIES`).** Well above 2 x so the legitimate WR-07 two-distinct-gates case degrades per-gate (each gate consumes only `MAX_FORCE_RETRIES` session intercepts; two gates = 6 < 12) long before the session ceiling fires; only a flapping single-gate livelock -- which the per-gate counter cannot catch -- is bounded by this ceiling.
- **Degrade if EITHER ceiling reached; session ceiling checked first and reported distinctly.** Keeps per-gate granularity for the common stable case; the session ceiling is the un-flappable floor behind it.
- **Reset on degrade OR no-intercept Stop turn.** A degrade or a card-fired/no-gate turn ends an intercept run, so the session counter resets. The load-bearing invariant is that an UNBROKEN run cannot exceed the ceiling, not that the counter never resets.
- **Same side-file, `__session__:` sub-entry, TTL-pruned (WR-02).** No new file; the `__session__:` prefix cannot collide with a 16-hex per-gate ctxHash; the side-file still cannot grow without bound.

## Deviations from Plan

None - plan executed exactly as written. (The CR-02 / CR-03 / WR-07 per-gate-key-count assertions were updated to strip the new `__session__:` session-counter entry from their key counts -- a mechanical consequence of adding the session entry to the same side-file, not a behavior change; the per-gate convergence those assertions test is unchanged.)

## Issues Encountered

The first draft of the realistic-paraphrase assertion expected exactly `MAX_SESSION_INTERCEPTS` blocks before degrade. Under normalization, "Solution-first" and "Solution first" collide to one per-gate key, so over 12 paraphrase runs one per-gate key reaches `MAX_FORCE_RETRIES` and a PER-GATE degrade fires at run 12 (one short of the session ceiling) -- still BOUNDED, still no livelock, just bounded by the per-gate floor that turn instead of the session floor. The assertion was relaxed to the actual guarantee: the run is BOUNDED (degrades no later than the session ceiling, via whichever floor fires first), and every run before the degrade was a block. The adversarial FLAPPING-LABELS test (genuinely distinct, non-colliding labels) remains the strict "degrade exactly at the session ceiling" proof.

## Known Stubs

None.

## Next Phase Readiness

Phase 179 is done (7 plans + 4 fix-waves). The terminal bounded-escape convergence floor (the session-wide intercept ceiling) is in place: any per-gate identity built from model-emitted content can be flapped, but a continuous run of intercepts in one session is now hard-bounded by `MAX_SESSION_INTERCEPTS` regardless of the flap. Ready for the navigator-gated phase CLOSE + the v1.14.0-beta train merge/release.

## Self-Check: PASSED

- FOUND: scripts/check-card-fire.cjs
- FOUND: tests/test-ga4-card-fire-e2e-179.cjs
- FOUND: .planning/phases/179-ignite-b1-starting-point-fix/179-11-SUMMARY.md
- FOUND: 179-11-CR04-prefix-livelock-proof.txt
- FOUND: 179-11-CR04-postfix-session-ceiling-proof.txt
- FOUND commit: d4676a42 (fix(179-11): session-wide intercept ceiling)

---
*Phase: 179-ignite-b1-starting-point-fix*
*Completed: 2026-06-25*
