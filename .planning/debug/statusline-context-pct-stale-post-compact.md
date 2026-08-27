---
status: awaiting_human_verify
kind: rca
trigger: "statusline-context-pct-stale-post-compact"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: []
created: 2026-07-28T00:00:00Z
updated: 2026-07-28T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "NEITHER (A) nor (B). The root cause is a SCALE MISMATCH between the two
    branches of resolveCtxPct. The primary branch returns the host's raw
    `used_percentage`; the fallback branch returns `remaining_percentage` re-derived
    through the AUTO_COMPACT_BUFFER (16.5) reservation, which is a DIFFERENT quantity
    (percent-of-the-way-to-auto-compact, not percent-of-window-used). Because the host
    emits used + remaining === 100 exactly, the fallback is not a substitute for the
    primary -- it inflates the same underlying state by up to +16.5 points. The fallback
    is reached in exactly one common situation: the turn right after /compact, when
    current_usage (and therefore used_percentage) is null. So the gauge JUMPS UP on the
    post-compact turn, which reads to the navigator as a stale/frozen high number."
  confirming_evidence:
    - "787 of 787 real live bridge files in ~/.mindrian/bridge/, written verbatim from the
       host's stdin JSON across 11 model ids spanning Apr-Jul 2026, have
       used_percentage + remaining_percentage === 100 exactly. Zero exceptions. Direct
       observation of the host's actual output, not inference."
    - "Computed divergence: true used 78 renders as EXACTLY 93 through the fallback -- the
       precise number the navigator reported seeing. used 50 -> 60, 70 -> 84, 83.5 -> 100."
    - "Full-repo grep: resolveCtxPct has only 3 non-test call sites. The CLI render path
       (dispatch shim -> statusline-mos -> exec node context-monitor) re-parses the current
       turn's stdin on every render with zero memoization, so (B) is ruled out for CLI."
    - "tests/test-context-monitor-d02-broadcast.cjs:129-133 is a fossil comment recording
       that a host-reported 60% used displayed as 72% -- the buffer math WAS the whole
       gauge pre-quick-task. The quick task changed the PRIMARY branch to raw used% and
       left the fallback on the old scale, which is what introduced the inconsistency."
  falsification_test: "If the host's remaining_percentage already encoded the auto-compact
    reservation (i.e. remaining were 'headroom before compaction' rather than raw window
    remaining), then used + remaining would NOT sum to 100 -- it would sum to ~83.5, and
    the buffer re-derivation would be correct. 787/787 files summing to exactly 100
    falsifies that and confirms the buffer transform is a double-count."
  fix_rationale: "Because remaining === 100 - used exactly, the fallback can compute the
    SAME quantity the primary branch reports with no modeling layer at all: pct =
    100 - remaining_percentage. This makes the fallback a true substitute, removes the
    post-compact jump, and requires NO compact-detection heuristic and NO invented stdin
    field -- it is grounded entirely in a field the host demonstrably sends. It also
    re-aligns the downstream consumers already calibrated for used%: cockpit-renderer's
    memoryChip (left = 100 - used), isCliff (>=80), and the 50/65/80 color bands."
  blind_spots: "I could not capture a raw stdin JSON at the exact post-compact instant, so
    whether remaining_percentage ALSO briefly lags (the original hypothesis A) is untested.
    It does not change this fix: a lagging remaining would render a stale-but-correctly-
    scaled number, whereas today it renders a wrong-scaled number every time the fallback
    fires, compact or not. If a lag is later proven, the honest remedy is a lower-confidence
    render state, not a heuristic -- deliberately NOT built here since no compact-boundary
    signal is known to exist in the payload."

hypothesis: `lib/statusline/ctx-window.cjs::resolveCtxPct` has a documented, self-acknowledged
edge case in its own comments (lines 17-19): "current_usage can be null right after /compact...
we guard that (isFiniteNum) and FALL THROUGH to the remaining-based estimate rather than
rendering a wrong 0." The fallback (`estimateFromRemaining`, reading `remaining_percentage`)
assumes that field is itself freshly correct at the moment of the fallback -- but if the host
(Claude Code CLI) has not yet refreshed `remaining_percentage` either at that exact moment
(immediately post-compact), the estimate can render a STALE pre-compact-shaped percentage
(e.g. still showing something like 93% used) instead of the actual near-empty post-compact
window. Separately: confirm whether any CALLER of `resolveCtxPct` (scripts/statusline-mos-
dispatch, scripts/sessionstart-coordinator.cjs, scripts/context-monitor, lib/mcp/tools/
status.cjs) caches the resolved pct across turns rather than re-deriving it fresh from the
CURRENT turn's stdin JSON every single render -- a caching bug would produce the same visible
symptom (a stuck/stale percentage) with a completely different root cause and fix.
test: reproduce a `/compact` in a live CLI session, capture the raw stdin JSON handed to the
statusline script on the immediately-following render (log `data.context_window` verbatim),
and check: (a) is `used_percentage` actually null at that point (confirming the documented
gotcha fires), (b) what does `remaining_percentage` read at that same moment -- is it
post-compact-fresh or still reflecting pre-compact state, (c) trace resolveCtxPct's actual
call site per render to rule out a caching layer holding a stale value independent of what
the host sends.
expecting: one of two shapes -- either (A) `remaining_percentage` genuinely lags
`used_percentage`'s null-reset by one render cycle on the host side, meaning the estimate
fallback needs its own guard (e.g. treat an obviously-too-high remaining-derived estimate
immediately following a detected /compact event as suspect and prefer a lower-confidence
"recalculating" state over a wrong number), or (B) some caller is not re-invoking
resolveCtxPct fresh per turn and is holding a pre-compact pct value in memory/a written
statusline segment file that does not get invalidated on compact.
next_action: DONE pending human verification. Root cause found (scale mismatch, neither (A)
nor (B)), fix applied across 3 files, 18/18 suites green, symptom reproduced pre-fix (93%)
and confirmed gone post-fix (78%). Awaiting navigator confirmation in a live session that
the gauge now tracks the actual turn across a /compact. Do NOT archive until confirmed.

--- investigation trail below ---

CORRECTION to the filed call-site list -- a full-repo grep for `resolveCtxPct`
returns only THREE real call sites: scripts/context-monitor:580, lib/mcp/tools/status.cjs:107,
and tests/test-statusline-context-aware.cjs. scripts/statusline-mos-dispatch:88-89 and
scripts/sessionstart-coordinator.cjs:203-204 do NOT call resolveCtxPct -- they read a
PRE-RESOLVED `seg.context_pct` back from the MCP daemon's status_read. Next: read
lib/mcp/tools/status.cjs in full, find every bridge-file reader, and grep for captured
context_window fixtures, before consulting langtalks-graph-expert on the stdin contract.

## Evidence

- timestamp: 2026-07-28 (investigation resume)
  checked: full-repo grep for `resolveCtxPct`
  found: only THREE non-test call sites exist -- scripts/context-monitor:580,
    lib/mcp/tools/status.cjs:107, tests/test-statusline-context-aware.cjs. The filed
    call-site list was wrong: scripts/statusline-mos-dispatch:88-89 and
    scripts/sessionstart-coordinator.cjs:203-204 read a PRE-RESOLVED `seg.context_pct`
    off the MCP daemon's status_read response, they never call the resolver.
  implication: hypothesis (B) "a caller caches the resolved pct across turns" is FALSE
    for the CLI render path. The CLI path is settings.json -> ~/.claude/statusline-mos
    (dispatch shim) -> scripts/statusline-mos -> `exec node scripts/context-monitor`,
    which parses the CURRENT turn's stdin JSON on every single render. No memoization,
    no cross-turn cache, no module-level state. Fresh per render, confirmed by read.

- timestamp: 2026-07-28
  checked: 787 real (non-test) live bridge files in ~/.mindrian/bridge/*.json, written
    by scripts/context-monitor:550-556 verbatim from the host's own stdin JSON across
    11 distinct model ids (opus-4-6/4-7/4-8, sonnet-5, 3-5-sonnet, fable-5, 1m variants)
  found: `ctx_pct + ctx_remaining === 100` EXACTLY in 787 of 787 files. Zero exceptions.
    ctx_pct is written from `data.context_window.used_percentage` and ctx_remaining from
    `data.context_window.remaining_percentage`.
  implication: DECISIVE. The host's `used_percentage` and `remaining_percentage` are exact
    arithmetic complements -- they carry the SAME information, not two independent
    measurements. `remaining_percentage` is raw window-remaining; it does NOT already
    encode the auto-compact reservation.

- timestamp: 2026-07-28
  checked: computed native-branch vs estimate-branch output for the same host state,
    using remaining = 100 - used (now proven)
  found: the two branches of resolveCtxPct do NOT agree. estimateFromRemaining re-derives
    "used" through the AUTO_COMPACT_BUFFER (16.5) reservation, inflating the number by up
    to +16.5 points: used 50 -> 60, used 70 -> 84, used 78 -> 93, used 83.5 -> 100.
  implication: true used_percentage of 78 renders as EXACTLY 93 through the fallback --
    the precise number the navigator reported. The primary branch and the fallback branch
    answer DIFFERENT QUESTIONS on the same input.

- timestamp: 2026-07-28
  checked: scripts/context-monitor:552-553 bridge-file write
  found: `ctx_pct: usedPct || 0` and `ctx_remaining: remaining || 100`. Post-/compact
    usedPct is null, so `|| 0` writes a FALSE ctx_pct of 0 (unknown coerced to a hard
    zero). This is the identical null-coercion anti-pattern that
    lib/statusline/two-row-renderer.cjs:86 documents as already-fixed there
    ("The legacy code used `s.ctx_pct || 0` which silently coerced null to 0").
  implication: second, independent defect on the bridge surface.

- timestamp: 2026-07-28
  checked: scripts/statusline-fallback-echo.cjs:161-165 (the Desktop/Cowork surface echo)
  found: reads `bridge.ctx_pct` off disk and renders it verbatim as "context: N%" with NO
    freshness check -- even though the bridge record carries a `timestamp` field written
    for exactly that purpose. The bridge file is only ever rewritten by a CLI statusline
    render, so on Desktop/Cowork (no statusline primitive) it echoes whatever the last CLI
    session in that workspace left behind, arbitrarily old.
  implication: hypothesis (B)'s real shape DOES exist -- but on the Desktop/Cowork surface,
    not the CLI one where the symptom was reported. Tri-Polar gap, tracked separately below.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51 (HEAD at time of filing)
- Reported by: Jonathan Sagir (live session, 2026-07-28), observed a statusline reading
  "📊 █████████░ 93%" that did not look right/dynamic to the actual turn, specifically flagged
  around compact behavior ("compact is not in 93% not 100%... need to reevaluate the whole
  status bar to be correct and properly dynamic to actual turn").
- Filed by: Claude, navigator-directed, same session as the card-fire-answered-gate-refires-
  within-ttl-window and mcp-first-path-retry-ceiling-hardcoded-zero fixes.
- Related: none yet found -- this is the first RCA filed against ctx-window.cjs specifically;
  worth a REUSE-CHECK grep across `.planning/debug/` for any prior statusline pct complaint
  before assuming this is novel.

## Problem Statement

The statusline's context-percentage gauge may render a stale/incorrect percentage in the turn
immediately following a `/compact`, rather than reflecting the actual (much lower) post-compact
context usage.

## Scope and Impact

- Affected surfaces: CLI statusline specifically (the native `context_window` stdin JSON path
  is CLI-only per the module's own doc comment; Desktop/Cowork may not even render this gauge --
  confirm during investigation rather than assuming parity).
- Severity: medium -- cosmetic/trust-eroding (a wrong number in a UI element the navigator
  watches to judge session health), not a data-correctness or Part 8 boundary issue (the module
  itself is documented pure/local/zero-network).
- ROOT-CAUSED 2026-07-28. Neither (A) nor (B): a THIRD cause, a scale mismatch between the
  primary and fallback branches of resolveCtxPct. See Resolution.

## Resolution

root_cause: |
  resolveCtxPct's two branches answered DIFFERENT QUESTIONS while presenting as
  primary-and-fallback for the same number.

  - Primary branch: returns the host's raw `used_percentage` = percent of the
    context window consumed.
  - Fallback branch: ran `remaining_percentage` through the AUTO_COMPACT_BUFFER
    (16.5) reservation = percent of the way to the auto-compact trigger.

  Because the host emits `used_percentage + remaining_percentage === 100` exactly
  (787/787 real captured payloads, 11 model ids, Apr-Jul 2026), remaining is raw
  window-remaining and does NOT already encode the reservation. The buffer
  transform therefore DOUBLE-COUNTED it, inflating the gauge by up to +16.5 points
  (true 50 -> 60, 70 -> 84, 78 -> 93, 83.5 -> 100).

  The fallback is reached in exactly one common situation: the turn right after
  /compact, when current_usage is null and so used_percentage is null. So the gauge
  JUMPED UP across the compact boundary (78% -> 93% on the same underlying state),
  which the navigator correctly read as a stale number that ignored the compact.

  The buffer rescale WAS the whole gauge pre-quick-task-20260702. That quick task
  changed the primary branch to raw used% and left the fallback on the old scale,
  which is what introduced the inconsistency. A fossil comment in
  tests/test-context-monitor-d02-broadcast.cjs:129-133 still documented the old
  60-displays-as-72 behavior.

  Two sibling defects in the same family (a gauge showing a number it cannot
  justify for the current turn) were found and fixed alongside:
  2. scripts/context-monitor wrote `ctx_pct: usedPct || 0` to the bridge file,
     coercing the post-/compact NULL into a hard, false 0 (and `remaining || 100`
     turning a genuine 0 into 100). Same null-to-0 coercion two-row-renderer.cjs:86
     documents as already fixed there. Verified: the pre-fix bridge wrote
     {"ctx_pct":0,"ctx_remaining":22} -- internally contradictory, since 0+22 != 100.
  3. scripts/statusline-fallback-echo.cjs (the Desktop/Cowork surface) read
     bridge.ctx_pct off disk and rendered it with NO freshness check, despite the
     record carrying a `timestamp` field written for exactly that purpose. The
     bridge is only ever rewritten by a CLI statusline render, so Desktop/Cowork
     echoed whatever the last CLI session in that workspace left behind. This is
     hypothesis (B)'s real shape -- but on Desktop/Cowork, not the CLI surface
     where the symptom was reported.

fix: |
  1. lib/statusline/ctx-window.cjs -- estimateFromRemaining now returns
     clampPct(100 - remaining), the exact complement, putting both branches on ONE
     scale. AUTO_COMPACT_BUFFER retained as documentation of the real host
     threshold but no longer applied to any rendered percentage. No compact-
     detection heuristic and no invented stdin field: the fix rests only on a field
     the host demonstrably sends.
  2. scripts/context-monitor -- the inline graceful-degradation fallback dropped the
     buffer rescale to match the resolver branch-for-branch; the bridge write moved
     BELOW the resolve and now persists the resolved ctxPct (one source of truth
     for both surfaces), preserving null as null instead of coercing to 0.
  3. scripts/statusline-fallback-echo.cjs -- added isFreshBridge() gating on the
     already-written timestamp (BRIDGE_FRESH_SECONDS = 15 min); past the bound the
     existing honest '-' placeholder renders instead of another session's number.

verification: |
  Reproduce-then-fix, end to end through the real render path
  (printf stdin JSON | node scripts/context-monitor):
    PRE-FIX  post-/compact (used null, remaining 22) -> "93%"  <- exact symptom
    PRE-FIX  normal turn   (used 78,   remaining 22) -> "78%"
    POST-FIX post-/compact (used null, remaining 22) -> "78%"
    POST-FIX normal turn   (used 78,   remaining 22) -> "78%"
  No jump across the compact boundary. Bridge file post-fix:
  {"ctx_pct":78,"ctx_remaining":22} (sums to 100); pre-fix it wrote ctx_pct 0.

  Suites: 18/18 statusline + compact suites PASS, including 4 new regression tests
  in test-statusline-context-aware.cjs (the scale rule asserted across 14 states,
  plus an explicit "93 must not come back" fence) and 3 new in
  test-fallback-echo-compose.cjs (stale bridge, undateable bridge, fresh bridge).
  Gates: connector-registry OK, orchestration-projection OK, render-coverage 0 gap.
  Zero em-dashes across all changed files.

  Pre-existing failures confirmed unrelated by stash-and-rerun at baseline:
  test-statusline-cockpit-187.cjs (3 next-move failures, identical at baseline),
  test-statusline-glyph-isolation.cjs (a generated .mindrian cache file),
  nav-dial.test.cjs 15/17 (asserts empty stderr; Node emits an SQLite
  ExperimentalWarning). None touched by this change.

files_changed:
  - lib/statusline/ctx-window.cjs
  - scripts/context-monitor
  - scripts/statusline-fallback-echo.cjs
  - tests/test-statusline-context-aware.cjs
  - tests/test-fallback-echo-compose.cjs
  - tests/test-context-monitor-d02-broadcast.cjs

## Gate Checks

- Canon Part 8 (Brain boundary): CLEAN. ctx-window.cjs stays pure/local; the bridge write
  and the echo read are local fs only. Zero network, zero Brain, no user data egress.
- Tri-Polar three-surface: CONFIRMED, not assumed. The module doc's claim that the native
  `context_window` stdin path is CLI-ONLY is correct -- Desktop and Cowork have no statusline
  primitive, which is exactly why scripts/statusline-fallback-echo.cjs exists and reads the
  bridge file instead. All three surfaces addressed: CLI gets the scale fix, Desktop/Cowork
  get the freshness gate.
- Reuse before build: no new module. The fix removes a modeling layer rather than adding one.
- No em-dashes: verified 0 across all six changed files.
- Cross-platform: no new path/shell assumptions; arithmetic and an existing timestamp read.

## Follow-Ups (NOT fixed here, separate defects)

- MCP-first path renders no context segment at all. scripts/statusline-mos-dispatch:82
  calls `queryDaemon('status_read', {})` with EMPTY params and never reads the statusline
  stdin, while lib/mcp/tools/status.cjs:107 resolves the pct from an OPTIONAL
  caller-supplied `context_window`. So under MINDRIAN_MCP_FIRST=cli|all, `context_pct` is
  structurally always null and the ctx segment can never render. Flag is OFF by default, so
  this is latent, not the reported bug. Needs its own decision: thread stdin through the
  thin shim, or accept spend/cap-only on that path.
- Whether `remaining_percentage` ALSO briefly lags at the post-compact instant (the original
  hypothesis A) remains untested -- no raw stdin capture at that exact moment was possible.
  It does not affect this fix. If ever proven, the honest remedy is a lower-confidence render
  state, NOT a heuristic, since no compact-boundary signal is known to exist in the payload.
