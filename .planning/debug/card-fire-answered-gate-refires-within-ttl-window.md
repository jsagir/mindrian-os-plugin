---
status: investigating
kind: rca
trigger: "card-fire-answered-gate-refires-within-ttl-window"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: []
created: 2026-07-22T21:05:00Z
updated: 2026-07-22T21:05:00Z
---

## Current Focus

hypothesis: `lib/core/card-fire-sidechannel.cjs::recordReachedGate` records a gate mint keyed only by session_id + timestamp, with no "consumed" / "answered" flag. Once an F.8 (or any registry) gate is fired via AskUserQuestion AND answered in turn N, the side-channel record for that gate stays inside `TURN_FRESH_MS` (2 min) on turn N+1, N+2, etc. `mostRecentReachedTs` therefore still reports it FRESH, `gate_is_fresh` stays true, `classifyCardFire`'s PRIMARY-path relevance check runs with `gateStale:false`, and an unrelated low-signal turn gets force-intercepted for a gate that was already resolved.
test: reproduce with a minimal harness call to `classifyCardFire` passing `ran_entries` containing the F.8 registry entry, `gate_subject_text` set to the real F.8 subject line, `session_count`/`retry_count` at 0, and `preceding_user_text` set to ordinary unrelated turn text (not an answer to the gate) -- confirm it returns `intercept:true` even though the transcript shows the gate was already fired-and-answered one turn earlier.
expecting: a confirmed hypothesis shows `classifyCardFire` has no branch that checks "was this specific gate_subject_text/entry already answered by a PRIOR AskUserQuestion tool call in this session", only the TURN_FRESH_MS time-based staleness check from the 2026-07-20 `card-fire-over-enforcement` fix -- which correctly separates "stale bleed" from "fresh mint" but does not separate "fresh mint, still pending" from "fresh mint, already answered".
next_action: read `recordReachedGate` / `readReachedGates` in full (already partially read, see Evidence) and confirm there is no answered/consumed flag anywhere in the stored record shape, then read `gateAlreadyAnswered` in `lib/core/gate-relevance.cjs` to confirm it only compares the LAST assistant message's own extracted gate labels against the immediately preceding user text (not a cross-turn "this session already answered gate X" check) -- that gap is the second half of the root cause.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.37 (HEAD 61dc5467)
- Reported by: Jonathan Sagir (live session), filed by Claude per navigator's "log it now, keep going" choice
- Date first observed: 2026-07-22
- Related debug sessions: `.planning/debug/resolved/card-fire-over-enforcement.md` (the 2026-07-20 TURN_FRESH_MS staleness fix -- this is a NEW gap in the SAME mechanism, not a regression of that fix), `.planning/debug/resolved/card-fire-relevance-check-gap.md`, `.planning/debug/resolved/card-fire-block-surface.md`, `.planning/debug/resolved/backstop-benign-list-defeats-relevance-gate.md`, `.planning/debug/knowledge-base.md` (four prior distinct defects logged against this same script -- this is the fifth/ninth instance depending on count basis; see Pattern lesson below)

## Problem Statement

The Stop-hook `scripts/check-card-fire.cjs` force-blocked a turn that contained no unanswered Decision Gate: the F.8 room-binding card had already been fired via a real `AskUserQuestion` tool call and answered by the navigator in the immediately preceding turn, but the very next (unrelated, status-update) turn was still force-intercepted as if that same gate were pending and unanswered.

## Symptoms

expected: once a Decision Gate is fired via `AskUserQuestion` and the navigator answers it, no subsequent turn should be force-blocked for that same already-resolved gate.
actual: the turn immediately after firing and answering the F.8 room-binding gate (two questions: "Which room(s) should this session write to?" and "Remember this binding?", both answered) was blocked by the Stop hook with reason `rendering your choices as a selectable card` and `additionalContext` demanding a re-fired `AskUserQuestion` card, even though the assistant's actual output that turn was plain status prose with zero option-shaped content and zero ASCII-box glyphs.
errors: `Stop hook error: rendering your choices as a selectable card` / `Stop hook feedback: This turn REACHED a Decision Gate but did NOT fire the interactive card.`
reproduction:
  1. Trigger an F.8 binding gate (session unbound, room-selection prompt fires via `scripts/intent-classifier.cjs`'s `emitBindingGate`).
  2. Fire `AskUserQuestion` for it in that same turn and answer it (real navigator response, e.g. "Dev-repo only, no room" + "Yes, keep it bound").
  3. In the VERY NEXT turn, produce ordinary prose with no card, no gate, no ASCII box (e.g. a plain status update on unrelated background work).
  4. Observe: Stop hook still fires `decision:'block'` on step 3's turn.
started: observed 2026-07-22, plugin version 1.15.3-beta.37. Not yet bisected to a specific commit; the TURN_FRESH_MS mechanism it exposes a gap in was introduced 2026-07-20 (`card-fire-over-enforcement` fix), so this gap has existed at least since that commit landed and was not caught by that fix's own test suite (which tested stale-vs-fresh timing, not answered-vs-unanswered state).

## Scope and Impact

- Affected surfaces: cli (confirmed live); desktop/cowork not yet checked, but the Stop-hook mechanism is surface-generic so likely shared exposure.
- Affected commands: any turn following an F.8 binding-gate answer (and, by the same mechanism, likely any registry-tracked PRIMARY gate answered via `AskUserQuestion` -- not yet confirmed beyond F.8).
- Affected users: all installs that hit a room-binding ambiguity or any other registry-tracked Decision Gate, then continue working within the `TURN_FRESH_MS` (2 min) window after answering it.
- Version range: at least 1.15.3-beta.36 through 1.15.3-beta.37 (both observed carrying the same `TURN_FRESH_MS` logic per source read).
- Severity: medium -- annoying and erodes trust in the card-fire mechanism (this is the session's own explicit complaint: "this is a persistent issue always happening"), but self-bounded by the existing `MAX_FORCE_RETRIES`/`MAX_SESSION_INTERCEPTS` escape (never a true livelock) and does not corrupt data or silently skip a REAL gate.
- Blast radius: `lib/core/card-fire-sidechannel.cjs` (the shared record store all three gate-minting chokepoints write to), `scripts/check-card-fire.cjs::classifyCardFire` (the consumer). The independent MCP-side tool `stop_gate_check` (server-side gate-dedup, described as consulting "gate-dedup (fire-once, only-when-relevant)") is a SEPARATE implementation from this local script and, on the same live turn, returned `{fire:false, reason:"no-gate-signal"}` -- i.e. it correctly recognized no gate was pending while the local script force-blocked. That divergence is itself evidence the two enforcement paths have drifted and is worth its own follow-up (see Non-Code Follow-ups).

## Eliminated

- hypothesis: the F.8 gate side-channel record is simply mis-scoped to bleed across SESSIONS (the original 2026-07-20 `NO_SESSION_KEY` cross-session bug).
  evidence: this reproduction is within a SINGLE session, same session_id throughout, no cross-session bleed involved -- the 2026-07-20 fix's cross-session scoping is not implicated here.
  timestamp: 2026-07-22T21:00:00Z
- hypothesis: `emitBindingGate` (the F.8 producer) fails to call `recordReachedGate` at all, so it is missing the freshness metadata entirely and defaults to some unsafe floor.
  evidence: `grep -n "recordReachedGate" scripts/intent-classifier.cjs` shows `emitBindingGate` DOES call `sidechannel.recordReachedGate({..., shape: 'F.8', ...})` (around line 2398), same as the other two documented chokepoints (`lib/hmi/selector-dispatcher.cjs`'s `pickShape` trailer door). The F.8 path is wired into the SAME freshness mechanism as the other two, not a separate unwired path.
  timestamp: 2026-07-22T21:03:00Z

## Evidence

- timestamp: 2026-07-22T20:58:00Z
  checked: live turn sequence in this session -- F.8 binding gate rendered, fired via a real `AskUserQuestion` call with 2 questions, both answered by the navigator, then the NEXT turn (plain status prose, launching a background executor agent, zero option-shaped text) was Stop-hook blocked.
  found: the block fired on a turn containing no gate-shaped output whatsoever.
  implication: `computeBackstopHit` (the BACKSTOP arm) cannot be the trigger (no ASCII-box glyphs in the output); this must be the PRIMARY arm (`primaryHit` via `ran_entries`).
- timestamp: 2026-07-22T20:59:00Z
  checked: called `mcp__plugin_mos_mindrian-os__stop_gate_check` directly with the blocked turn's actual `output_text` and `preceding_user_text`.
  found: returned `{"fire":false,"reason":"no-gate-signal", ...}`.
  implication: a SEPARATE, server-side implementation of the same "should a card force-fire" question disagreed with the local Stop hook on the identical turn -- strong evidence the local script's gate-identity/consumption tracking is stale or incomplete relative to whatever the MCP tool's gate-dedup logic does (worth reconciling, see Non-Code Follow-ups).
  timestamp: 2026-07-22T20:59:00Z
- timestamp: 2026-07-22T21:02:00Z
  checked: `lib/core/card-fire-sidechannel.cjs` source (TURN_FRESH_MS block, `recordReachedGate`, `readReachedGates`, `mostRecentReachedTs`) plus its own doctrine comment naming all three F.8/selector-dispatcher mint sites.
  found: the freshness window (`TURN_FRESH_MS = 2 * 60 * 1000`, 2 minutes) governs ONLY whether a stored record counts as "this turn" vs "stale bleed" by TIME elapsed since mint. Nothing in the read path takes an "answered" input; `recordReachedGate`'s stored shape (per the module's own comments) carries identity + subject + timestamp, not a consumed/resolved flag.
  implication: a gate that was minted, fired, AND answered 30-90 seconds ago is indistinguishable, to this module, from a gate that was minted 30-90 seconds ago and is still sitting unanswered. Both read as "fresh" for the full 2-minute window.
  timestamp: 2026-07-22T21:02:00Z

## Technical Root Cause

Not yet fully confirmed (status: investigating, not resolved) -- the next_action above (reading `gateAlreadyAnswered` in full against this specific turn's actual `preceding_user_text`) still needs to run to close the loop. Best current explanation:

- Site: `lib/core/card-fire-sidechannel.cjs` (the record shape / freshness read path) + `scripts/check-card-fire.cjs::classifyCardFire` (the PRIMARY-path relevance branch, roughly lines 574-590 per the version read this session)
- Cause: the side-channel's freshness signal (`gate_is_fresh`) encodes ONLY elapsed time since mint, not whether the gate was already fired-and-answered via a real `AskUserQuestion` call in an earlier turn of the SAME session. `classifyCardFire`'s `gate-already-answered` pass-reason only compares the CURRENT turn's own extracted `gateLabels` (from THIS turn's `outputText`) against the immediately preceding user text -- on a turn with no card in its own output, `gateLabels` is empty, so that check cannot exempt "this was answered one turn ago" either. Neither the time-based freshness fix (2026-07-20) nor the already-answered check (2026-07-05) covers "answered in a prior turn, still time-fresh".
- Why it surfaces now: the 2026-07-20 fix correctly closed the cross-session/stale-bleed gap by adding a 2-minute freshness floor, which is a NECESSARY but not SUFFICIENT signal -- it narrowed the false-positive window from "up to 10 minutes, any session" down to "up to 2 minutes, same session, even if already answered". The gap only shows up in the specific sequence of fire-card -> answer -> continue-working-fast, which a slower navigator or a longer per-turn latency would not trigger (explaining why it was not caught by the 2026-07-20 fix's own regression suite, which tested STALE vs FRESH timing, not ANSWERED vs UNANSWERED state within the fresh window).

## Required Code Changes

Not yet specified in imperative form -- deferred per navigator's explicit 2026-07-22 choice ("Log it now, keep going" over "Fix the TTL-bleed now"). Candidate direction for the next session that picks this up: extend the side-channel's stored record (or a sibling store) with a `consumedAt` / `answeredTurn` marker written whenever `check-card-fire.cjs` (or the assistant's own `AskUserQuestion` tool-use record) confirms a fired card received a real answer, and have `readReachedGates` / `mostRecentReachedTs` exclude or flag records already marked consumed -- so `gate_is_fresh` distinguishes "fresh AND still pending" from "fresh but already resolved". Needs design: where does the "was it answered" signal actually get observed from (the transcript already carries the tool_result for the `AskUserQuestion` call -- the same read this script already does for `askuserquestion_fired` on the CURRENT turn could be extended to scan back a bounded number of turns for a matching gate identity).

## Tests to Add or Update

Not yet written -- deferred with the fix (see Required Code Changes). When picked up: a fixture reproducing this exact sequence (mint F.8 gate -> fire+answer via AskUserQuestion -> next turn plain prose) asserting `classifyCardFire` returns `intercept:false` should be added to `tests/test-card-fire-relevance-gate.cjs` or `tests/test-209-primary-sidechannel.cjs` (the existing suites for this mechanism), alongside a non-regression fixture confirming a genuinely STILL-PENDING fresh gate (never answered) keeps force-firing.

## Non-Code Follow-ups

- CHANGELOG.md: not yet -- no code fix landed this session.
- Reconcile the two independent implementations: `scripts/check-card-fire.cjs` (this local Stop-hook script) and whatever backs the MCP tool `stop_gate_check` (described as "gate-dedup, fire-once, only-when-relevant") disagreed on the identical live turn. Worth a dedicated follow-up to determine whether `stop_gate_check`'s dedup logic already solves the "answered gate" case correctly and the fix here should port that same approach, rather than re-deriving it independently.
- Pattern lesson (continuing the existing knowledge-base entry's own note): this is at least the fifth distinct defect logged against `scripts/check-card-fire.cjs`'s enforcement mechanism (`card-fire-block-surface`, `backstop-benign-list-defeats-relevance-gate`, `intern-w1-card-discipline-decay`, `card-fire-relevance-check-gap` / `card-fire-over-enforcement`, and now this one), each closing one narrow gap while a structurally adjacent one stayed open. The 2026-07-20 fix's own knowledge-base entry already flagged this risk ("a future pass should consider whether the whole classifyCardFire pass-reason chain needs a unifying review rather than continued one-off patches") -- that recommendation still stands and this instance is further evidence for it.
