---
status: resolved
kind: rca
trigger: "room-bind-gate-fires-on-notification-only-turns"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: local-only
canon_parts: [8, 11, 12]
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T00:00:00Z
related_todo: ""
related_debug_sessions:
  - .planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md (the sibling that first diagnosed the mechanism, 2026-07-06, but stayed on a different headline finding)
  - .planning/debug/resolved/card-fire-over-enforcement.md (the sibling over-enforcement class this RCA refines)
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `41bb23d1` (dev workspace `/home/jsagi/dev/MindrianOS-Plugin/`)
- **WIRE claims probe against:** n/a (no Brain / network wire touched; LOCAL-only fix)
- **Date of audit:** 2026-07-23
- **Re-verification rule:** n/a for this filing; the fix landed and was verified in the same session, source and tests both read against the same HEAD.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED and FIXED. `precedingUserText` resolves to `''` for two very different
reasons that the pre-fix code conflated: (1) a genuinely terse HUMAN turn ("ok", "go on"), and
(2) a preceding transcript record that is a SYNTHETIC tool_result / task-notification envelope
with NO human-authored text at all (a background subagent finishing, an automated task
notification). `gateTopicallyRelevant`'s conservative low-signal branch forced (assumed
relevant) on BOTH, which is correct for (1) and never correct for (2) -- there is no human
turn for a Decision Gate to be relevant or irrelevant to.
test: added a NEW transcript-classification signal (`preceding_user_text_source`) and two
regression tests exercising the real F.8 room-binding gate end to end (a synthetic tool_result
preceding turn vs a genuinely terse human preceding turn against the identical gate).
expecting: the synthetic case no longer force-fires; the terse-human case still does (floor
unweakened).
next_action: none -- resolved, verified, filed.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.45
- Reported by: navigator (Jonathan), live session, three consecutive occurrences
- Date first observed: 2026-07-06 (mechanism diagnosed as a fact, not yet treated as the
  defect to fix, in `live-session-running-stale-plugin-cache-fixes-inert.md`); confirmed
  recurring 2026-07-11 and 2026-07-22 (same sibling file); reproduced live 3x in one session
  2026-07-23 (this filing)
- Related debug sessions: `.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`
  (prior diagnosis, different headline finding), `.planning/debug/resolved/card-fire-over-enforcement.md`
  (the sibling over-enforcement class this refines -- that fix distinguished a FRESH gate from
  a STALE one; this fix distinguishes WHY the preceding user text is empty)

## Problem Statement

The F.8 "bind session to room" Decision Gate (and any PRIMARY-path registry gate) force-fires
on turns whose ONLY content was an automated background-task-completion notification, with
zero real user text and zero actual relation to the gate, blocking continuation with a Stop
hook error even though there was nothing for the navigator to decide that turn.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: a turn whose preceding "user" transcript record is a synthetic tool_result / task-
  notification envelope (no human ever typed anything) must NOT force-fire a Decision Gate --
  there is no human turn for the gate to be relevant to.
actual: the Stop hook (`scripts/check-card-fire.cjs`) blocked continuation on 3 consecutive
  such turns in one live session, each naming the SAME F.8 room-binding gate, even though each
  blocked turn's only preceding content was a background subagent completion notice.
errors (verbatim, this occurrence, x3):
  ```
  Stop hook prevented continuation
  Stop hook error: rendering your choices as a selectable card
  Stop hook feedback: This turn REACHED a Decision Gate but did NOT fire the interactive
  card. You MUST fire the AskUserQuestion card NOW with the gate options as arrow-key-
  navigable choices. Do NOT render a flat ASCII box or "type 1, 2, or 3" text. Re-emit
  this turn with the AskUserQuestion tool call.
  ```
reproduction:
  1. Mint an F.8 room-binding gate this session (`scripts/intent-classifier.cjs`'s
     `emitBindingGate`, side-channel `recordReachedGate` with `shape: 'F.8'`).
  2. Let a background task (subagent, Task-tool run) complete mid-session; Claude Code
     surfaces the completion as a `role: user` transcript record with no natural-language
     text field (a `tool_result`-shaped envelope, or an internal task-notification block).
  3. The Stop hook reads `transcript_path`, extracts `preceding_user_text` from that record
     (`extractAssistantText` correctly finds no `.text` field -> `''`), and
     `gateTopicallyRelevant`'s low-signal branch defaults to "assume relevant" (force),
     independent of whether the gate is fresh or stale (`card-fire-over-enforcement`'s own
     fix only distinguishes staleness, not this).
  4. Observe: `decision: 'block'` + the room-binding-gate re-prompt, on a turn with nothing
     for the navigator to decide.
started: mechanism first identified 2026-07-06 (as a fact, not a filed defect); confirmed
  recurring 2026-07-11 and 2026-07-22; live-reproduced 3x 2026-07-23 (this filing, root cause
  finally acted on)

## Scope and Impact

- Affected surfaces: CLI only (Claude Code Stop hook). Desktop and Cowork do not run this
  Stop-hook-class interceptor; whether either surface has an equivalent synthetic-turn shape
  (a background-task-completion notice with no typed text) is UNCONFIRMED -- flagged as an
  open Tri-Polar question, not yet observed on either surface. If Desktop/Cowork ever grow an
  equivalent Stop-hook-class enforcement point, this same fix pattern applies there.
- Affected commands: any PRIMARY-path registry gate (F.1, F.7-dial, F.8, and any future
  card-emission surface) that reaches a Decision Gate in the same turn a background task
  notification lands.
- Affected users: all CLI installs running background subagents / Task-tool calls mid-session
  with an unfired PRIMARY gate pending.
- Version range: present since the Phase 210-05 relevance gate shipped (item 210-E-1); the
  side-channel PRIMARY-path wiring (Phase 209-06 H3) is the transport that made this the
  dominant live failure mode once side-channel gate mints became common.
- Severity: high (blocks live session continuation on a turn with no genuine decision to make).
- Blast radius: `scripts/check-card-fire.cjs` (PRIMARY-path relevance branch only; BACKSTOP
  untouched), `lib/core/gate-relevance.cjs` (consulted, not modified -- the fix intercepts
  BEFORE the conservative low-signal branch rather than changing it).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none for this filing -- the root cause was already confirmed by the cited prior evidence
before this session began; no competing hypotheses were investigated here.)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-06T01:50:00Z
  checked: (prior session, carried from `live-session-running-stale-plugin-cache-fixes-inert.md`)
    `output_text` / `preceding_user_text` of a blocked turn whose preceding role:user record
    was a Gmail `create_draft` tool_result.
  found: `preceding_user_text` = `''`; the preceding record was a bare `tool_result` envelope,
    which `extractAssistantText` correctly (if unhelpfully) resolves to `''` since it has no
    `.text` property.
  implication: the Phase 210-05 relevance gate's `gateTopicallyRelevant` call always takes its
    CONSERVATIVE "insufficient user text -> stays relevant" branch on any turn whose last
    user-role record was a tool_result rather than typed text, independent of PRIMARY/BACKSTOP.
    Diagnosed as a fact in that session; NOT yet treated as the defect to fix there (that
    RCA's own headline finding was the stale-plugin-cache/deployment-gap issue, a different
    topic).
- timestamp: 2026-07-11T05:55:00Z
  checked: a second, independent live blocked turn on a different session/version (beta.12),
    carried from the same sibling RCA.
  found: the same "reconstruction says no-intercept, live behavior says intercept" gap
    reproduced again; confirmed recurring across two dates and two plugin versions.
  implication: ruled out "one stale cache explains everything" as the sibling RCA's full
    explanation; strengthened the case that the preceding-user-text-empty mechanism is an
    independently recurring defect class, not a one-off.
- timestamp: 2026-07-22T12:09:09Z
  checked: a THIRD independent reproduction on beta.32, carried from the same sibling RCA.
  found: headline finding (deployment gap) re-confirmed on a third version pair; this
    session's own intercepts were "fully explained by the ALREADY-DIAGNOSED headline
    mechanism" per that entry.
  implication: 16 days and 3 plugin versions with the mechanism still undiagnosed-as-a-bug;
    motivated filing THIS dedicated RCA rather than continuing to treat it as a footnote of
    a differently-scoped session.
- timestamp: 2026-07-23T00:00:00Z
  checked: today's live session -- 3 consecutive Stop-hook blocks, each on a turn whose ONLY
    content was a background-task-completion notification (zero real user text), each naming
    the F.8 room-binding gate.
  found: byte-identical mechanism to the 2026-07-06 finding: each blocked turn's preceding
    "user" transcript record carried no human-authored text field; `gateTopicallyRelevant`'s
    conservative branch forced the gate on all 3.
  implication: this is the live reproduction that finally motivates fixing the mechanism
    (not just documenting it) -- confirmed via direct code read of
    `scripts/check-card-fire.cjs:583-602` (the PRIMARY-path relevance call) and
    `lib/core/gate-relevance.cjs::gateTopicallyRelevant`'s low-signal branch (lines ~230-252),
    both matching the sibling RCA's description exactly.
- timestamp: 2026-07-23T00:10:00Z
  checked: `data/render-coverage-registry.json` for `scripts/intent-classifier.cjs`'s
    registry entry, to confirm the F.8 surface is a genuine PRIMARY gate-reaching entry
    (`render_coverage: 'card-emission'`).
  found: confirmed present (line 109), `kind: renderDial`, shape `F.7-dial` note; the F.8
    binding gate itself is emitted by the SAME file's `emitBindingGate` (line ~2314), which
    calls `sidechannel.recordReachedGate({ surface: 'scripts/intent-classifier.cjs', shape:
    'F.8', subjectText: ... })` (line ~2398).
  implication: the reproduction fixture built for the regression test (below) is faithful to
    the REAL F.8 producer's shape, not a synthetic stand-in.
- timestamp: 2026-07-23T00:20:00Z
  checked: existing card-fire test suites, run individually before any code change
    (`test-ga4-card-fire-e2e-179.cjs`, `test-ga4-card-fire-interceptor.cjs`,
    `test-card-fire-relevance-gate.cjs`, `test-209-card-fire-gate.cjs`,
    `test-209-primary-sidechannel.cjs`, `test-209-incident-replay.cjs`,
    `test-209-backstop-tuning.cjs`, `test-doctor-card-fire-health.cjs`).
  found: all green pre-fix (108 assertions across 8 files); none of them exercised a
    tool_result-shaped preceding turn against a PRIMARY-path gate, confirming the gap in
    coverage this RCA's new tests close.
  implication: the fix could be added without any pre-existing test needing to change.

## Technical Root Cause

`precedingUserText` (`scripts/check-card-fire.cjs`'s `deriveTurnSignals`, sourced from
`readTranscriptTurn`) resolves to `''` whenever the last `role:user` transcript record has no
`.text` property anywhere in its content -- true both for a genuinely short/terse human turn
that `extractAssistantText` still parses (never true there; a typed turn always has SOME text)
and, more importantly, for a SYNTHETIC record (a `tool_result` envelope from a background tool
call, or an automated task-notification block) that carries no human-authored text field at
all. Pre-fix, the code had no way to distinguish these two `''` causes.

- Site: `scripts/check-card-fire.cjs:586-602` (PRIMARY-path relevance branch inside
  `classifyCardFire`), consuming `lib/core/gate-relevance.cjs::gateTopicallyRelevant`
  (its low-signal branch, `userTokens.size < MIN_USER_SUBJECT_TOKENS`).
- Cause: `gateTopicallyRelevant`'s conservative low-signal branch returns "relevant" (force)
  whenever the preceding user text yields fewer than `MIN_USER_SUBJECT_TOKENS` (2) subject
  tokens, REGARDLESS of whether a human was ever present that turn. A synthetic tool_result /
  task-notification record always yields zero tokens (empty string), so it always took the
  force branch, exactly like a genuine "ok" -- the conflation was structural, not a rare edge
  case.
- Why it surfaces now: the PRIMARY-path side-channel wiring (Phase 209-06 H3) made
  registry-gate-reach detection independent of the turn's own output text, so a background
  task notification landing in the SAME turn window as a pending, unfired F.8/F.1/F.7-dial
  gate mint is now common (background subagents / Task-tool calls are routine mid-session),
  making this the dominant live occurrence of the force-fire class once side-channel gates
  became the normal PRIMARY path.

## Required Code Changes

- Change 1:
  - Location: `scripts/check-card-fire.cjs`, function `readTranscriptTurn` (~line 973-1071)
  - Current behavior: captured only `lastPrecedingUserText` (the flattened text) from the
    last `role:user` transcript record, with no signal for WHY it might be empty.
  - Required behavior: also capture `lastPrecedingUserTextSource` via a new
    `classifyPrecedingUserContentSource(content)` helper, returning `'typed' | 'tool_result' |
    'none'`. `'typed'` on any real human text (a non-empty bare string or a block with a
    non-empty `.text`); `'tool_result'` when every content block is a `tool_result` /
    non-text synthetic envelope with zero human text anywhere; `'none'` on an unexplained
    absence (null/undefined/empty array/empty string), which stays on the pre-fix
    conservative floor.
  - Short-term patch: n/a, this IS the fix.
  - Long-term fix: same. `classifyPrecedingUserContentSource` is exported for direct unit
    testing (`scripts/check-card-fire.cjs`'s `module.exports`).
- Change 2:
  - Location: `scripts/check-card-fire.cjs`, function `deriveTurnSignals` (~line 1248-1310)
  - Current behavior: threaded `preceding_user_text` through (direct-field envelope takes
    precedence over the parsed transcript), with no source signal.
  - Required behavior: thread `preceding_user_text_source` through the SAME precedence rule
    (direct-field envelope > parsed transcript > `'none'` default), so backward-compat unit
    tests that supply `preceding_user_text` directly (no source field) default to `'none'`
    and are unaffected by the new bypass (which only fires on a CONFIRMED `'tool_result'`).
- Change 3:
  - Location: `scripts/check-card-fire.cjs`, function `classifyCardFire`, PRIMARY-path
    relevance branch (~line 586-616)
  - Current behavior: on a PRIMARY hit with a confirmed gate subject, always fell through to
    `gateRelevance.gateTopicallyRelevant(precedingUserText, primarySubject, { gateStale: ... })`,
    which force-fires on empty/low-signal text regardless of cause.
  - Required behavior: if `t.preceding_user_text_source === 'tool_result'`, return
    `{ intercept: false, reason: 'preceding-turn-synthetic-no-user-engagement', degrade: false }`
    BEFORE calling `gateTopicallyRelevant` -- there was no human turn to be relevant or
    irrelevant to. Any other source value (`'typed'` or `'none'`) falls through to the
    EXISTING `gateTopicallyRelevant` call unchanged, preserving the WR-06/CR-06 conservative
    force-floor for genuinely terse human turns and for unexplained-absence cases.
  - Scope decision (recorded, not a gap): this bypass is PRIMARY-path only, matching the
    confirmed live mechanism (the F.8 side-channel gate). The BACKSTOP path already forces
    unconditionally on a terse turn (`gateStale: false`, by design, per its own WR-06 comment)
    and was deliberately left untouched -- extending the same distinction to BACKSTOP is a
    plausible future refinement, not required by this confirmed defect.

## Tests to Add or Update

- Test 1:
  - Type: unit + end-to-end (real `transcript_path` -> `readTranscriptTurn` ->
    `deriveTurnSignals` -> `classifyCardFire`, the production path, not the direct-field
    shortcut)
  - Location: `tests/test-209-primary-sidechannel.cjs` (Behavior 12)
  - Given: an F.8 room-binding gate minted via the real `recordReachedGate` side-channel
    producer shape (surface `scripts/intent-classifier.cjs`, shape `F.8`), and a transcript
    whose preceding `role:user` record is a bare `tool_result` block (modeled on the
    confirmed 2026-07-06 evidence shape) with no fired AskUserQuestion card.
  - When: `classifyCardFire` runs against the derived turn.
  - Then: `intercept: false`, `reason: 'preceding-turn-synthetic-no-user-engagement'`;
    `preceding_user_text === ''`; `preceding_user_text_source === 'tool_result'`.
  - Runner registration: already covered by `tests/run-all-209.sh`'s existing
    `209-06 PRIMARY side-channel (H3)` leg (no new registration needed).
- Test 2 (the companion floor-preservation proof):
  - Type: unit + end-to-end (same harness as Test 1)
  - Location: `tests/test-209-primary-sidechannel.cjs` (Behavior 13)
  - Given: the SAME F.8 gate, but the preceding `role:user` record is a genuinely typed
    short human turn (`"ok"`).
  - When: `classifyCardFire` runs against the derived turn.
  - Then: `intercept: true`, `reason: 'reached-registry-gate-no-card'` (unchanged from
    pre-fix); `preceding_user_text_source === 'typed'`.
  - Runner registration: same file/leg as Test 1.
- Test 3 (unit-level, no transcript needed):
  - Type: unit
  - Location: `tests/test-209-primary-sidechannel.cjs` (Behavior 14)
  - Given: `classifyPrecedingUserContentSource` called directly against a bare string, `''`,
    `null`, `undefined`, `[]`, an all-tool_result array, a real-text array, and a MIXED
    tool_result + real-text array.
  - When: each case is classified.
  - Then: `'typed' | 'none' | 'tool_result'` exactly as specified above; the mixed case
    resolves to `'typed'` (real human text always wins over a co-present tool_result block).

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry added under `[Unreleased]`.
- Release lockstep: recommend this ships in a near-term beta given it is actively degrading
  live sessions (per the dispatch's own gate). No version bump performed by this filing --
  `scripts/release.sh` owns the 5-gate lockstep when a release is cut.
- Canon: no `docs/CANON-PHASE-MAP.md` update required -- this is a bugfix inside an existing
  Phase 209/210 mechanism, not a new Canon-touching capability.
- knowledge-base.md: summary block appended (this filing).
- Tri-Polar follow-up (open, not blocking): confirm whether Desktop/Cowork have an equivalent
  synthetic-turn shape (a background-task-completion notice with no typed text) that could
  trip an analogous mechanism if either surface ever grows a Stop-hook-class enforcement
  point. Not yet observed on either surface; flagged for future audit, not fixed here.

## Resolution

root_cause: `precedingUserText` resolving to `''` conflated two causes -- a genuinely terse
  HUMAN turn and a SYNTHETIC tool_result/task-notification transcript record with no human
  text at all. `gateTopicallyRelevant`'s conservative low-signal branch forced (assumed
  relevant) on both, which is only correct for the first.
fix: added `preceding_user_text_source` ('typed' | 'tool_result' | 'none'), classified by a
  new `classifyPrecedingUserContentSource` helper in `readTranscriptTurn`, threaded through
  `deriveTurnSignals` with the same direct-field-precedence rule as `preceding_user_text`
  itself. `classifyCardFire`'s PRIMARY-path relevance branch now returns
  `{ intercept: false, reason: 'preceding-turn-synthetic-no-user-engagement', degrade: false }`
  immediately when the source is confirmed `'tool_result'`, bypassing
  `gateTopicallyRelevant` entirely for that case. The BACKSTOP path and the existing
  WR-06/CR-06 conservative force-floor for genuinely terse human turns are byte-unchanged.
verification: all pre-existing card-fire suites re-run individually post-fix, all green
  (108 assertions across 8 files: `test-ga4-card-fire-e2e-179.cjs` 48/48,
  `test-ga4-card-fire-interceptor.cjs` 27/27, `test-card-fire-relevance-gate.cjs` 11/11,
  `test-209-card-fire-gate.cjs` 7/7, `test-209-incident-replay.cjs` 4/4,
  `test-209-backstop-tuning.cjs` 13/13, `test-doctor-card-fire-health.cjs` 6/6,
  `test-209-primary-sidechannel.cjs` 17/17 post-fix -- 14/14 pre-existing + 3 new Behaviors
  12/13/14). RED/GREEN proof performed: the 3 new Behaviors fail pre-fix (confirmed via
  `git stash` on `scripts/check-card-fire.cjs` alone, keeping the new test file) with
  `AssertionError: the synthetic source classification must be confirmed tool_result,
  actual: undefined`, and pass post-fix. Canon Part 8 clean: the touched surface is LOCAL
  string/fs work only, zero network/Brain symbols (confirmed by the existing PART-8 grep
  assertion in `test-ga4-card-fire-interceptor.cjs`, unaffected by this change).
files_changed:
  - scripts/check-card-fire.cjs (new `classifyPrecedingUserContentSource` helper; threaded
    `preceding_user_text_source` through `readTranscriptTurn` and `deriveTurnSignals`; new
    PRIMARY-path bypass branch in `classifyCardFire`; exported the new helper)
  - tests/test-209-primary-sidechannel.cjs (3 new Behaviors: 12, 13, 14)
  - CHANGELOG.md (Fixed entry under [Unreleased])
  - .planning/debug/knowledge-base.md (summary block)
commits: (pending -- filed in the same session as the fix; commit hash to be added when
  committed)
