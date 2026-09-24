---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 03
subsystem: infra
tags: [card-fire, classifier, stop-hook, mcp, declared-fork, dedup]

# Dependency graph
requires:
  - phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros (plan 01)
    provides: "lib/core/fork-declaration.cjs (parseForkDeclaration, MIN_LABELS), the pre-359 anchor + standing inertness gate, gate-relevance.cjs's normalizeOptionLabel export"
provides:
  - "scripts/check-card-fire.cjs: a declared-fork arm in classifyCardFire (owns the turn unconditionally once forkDeclared, wins over a stale/irrelevant PRIMARY hit, reuses both ceilings verbatim, exempts a yes/no PRACTICAL pair per N-3), declaredIdentity(turn), a decl retry-key suffix in turnContextHash (non-declared keys byte-identical to pre-359), and deriveTurnSignals threading the declaration source (direct output_text, else Stop stdin last_assistant_message, else the current-window transcript text -- never a stale prior-turn declaration)"
  - "lib/mcp/stop-gate-handler.cjs: buildStopGateCard renders the declared labels (moonshot last) when a turn is declared; the gate-dedup subject falls back to declaredIdentity(turn) so two distinct declared forks in one session both fire instead of colliding on an empty gate_signature"
  - "tests/test-359-declared-arm.cjs (20 legs, A1-A12, plus --tripwires A13) and tests/test-359-mcp-declared.cjs (7 legs, M1-M7)"
affects: [359-04, 359-05, 359-06, 359-07, 359-08, 359-09, 359-10, 359-11, 359-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declared arm placement: forkDeclared is checked right after backstopHit, unconditionally short-circuits before the PRIMARY existence/relevance checks and the BACKSTOP corroboration check, so a declaration wins over every 'was there really a gate here' check on the same turn (D-07) while both bounded-escape ceilings stay the single source of truth (copied verbatim, never re-declared)."
    - "Declaration source is a SEPARATE precedence chain from the existing output_text/BACKSTOP chain: direct output_text, else the live Stop stdin's own last_assistant_message, else the current-window transcript text (turn.assistant_contents, reset at every role:user record). A stale declaration sitting only before the last user record, or a lagging transcript whose last record is a stale card while last_assistant_message is plain prose, both parse as not-declared (Pitfall 1)."
    - "Guarded-call wrapping for any cross-module optional export consumed by lib/mcp/stop-gate-handler.cjs (mirrors the file's own pre-existing _safeCtxHash/_safeCount pattern): _safeDeclaredIdentity degrades to '' rather than throwing when check-card-fire.cjs does not export declaredIdentity, which matters for GATE357-08's mutation leg (it reverts check-card-fire.cjs to pre-357 bytes while this file stays at HEAD)."

key-files:
  created:
    - tests/test-359-declared-arm.cjs
    - tests/test-359-mcp-declared.cjs
  modified:
    - scripts/check-card-fire.cjs
    - lib/mcp/stop-gate-handler.cjs

key-decisions:
  - "PLAN_BASE = 072e83be8bc7f066c15dc35f2277c74e0a51aa07 (HEAD at plan start; git status --short on both target files showed no unowned diff before editing). Task 1 commit 46463ddc2 (feat, scripts/check-card-fire.cjs + tests/test-359-declared-arm.cjs). Task 2 commit b75fdc64e (feat, lib/mcp/stop-gate-handler.cjs + tests/test-359-mcp-declared.cjs). Follow-up fix commit fe9816e6e (Rule 1 deviation, see below)."
  - "N-3 yes/no exemption reads t.declared_labels.slice(0, -1) (the practical labels only, moonshot excluded) mapped through gateRelevance.normalizeOptionLabel before gateRelevance.isYesNoShapedGate -- exactly the RESEARCH/plan-specified interpretation, not the Example 2 draft's all-labels form (which would never exempt anything, since every declaration's final label starts with 'What if')."
  - "readTranscriptTurn's new decl_source_text is deliberately NOT output_text: it walks turn.assistant_contents (already windowed to the current turn, reset at every role:user record) from the end for the last non-empty extracted text, one line via .map(extractAssistantText).filter(Boolean).pop() -- output_text itself (lastAssistantText) is never reset at a user boundary and can be a previous turn's text, which is exactly the Pitfall 1 hole this avoids."
  - "deriveTurnSignals reuses the existing txn parse when already computed (directText null); it only parses the transcript a second time in the narrow, currently-dead case where the legacy last_assistant_text field resolved directText but neither output_text nor last_assistant_message resolved a declaration source -- kept for correctness rather than sharing txn unconditionally, since sharing it unconditionally would have changed askFired/gate_signature derivation for that same dead-field case (a real, if inert, behavior change this plan's D-06 step 5 byte-identity guarantee forbids)."

requirements-completed: [FORK359-04, FORK359-05, FORK359-07]

# Metrics
duration: ~70min active
completed: 2026-09-24
---

# Phase 359 Plan 03: Declared arm, declaredIdentity, retry-key suffix, MCP card and dedup changes Summary

**classifyCardFire now owns a deterministic declared-fork arm fed by deriveTurnSignals' this-turn-only declaration source, with a decl-suffixed retry key and an MCP stop_gate_check that renders the declared labels and dedups per distinct declared fork; every undeclared turn keeps its exact pre-359 verdict, reason and retry key.**

## Performance

- **Duration:** ~70 min active
- **PLAN_BASE:** `072e83be8bc7f066c15dc35f2277c74e0a51aa07`
- **Tasks:** 2/2 complete (plus 1 follow-up fix commit, see Deviations)
- **Files modified:** 4 (2 created: `tests/test-359-declared-arm.cjs`, `tests/test-359-mcp-declared.cjs`; 2 modified: `scripts/check-card-fire.cjs`, `lib/mcp/stop-gate-handler.cjs`)

## Accomplishments

- `classifyCardFire`'s no-gate-signal condition widened to `!primaryHit && !backstopHit && !forkDeclared`; a `forkDeclared` turn is then owned unconditionally by a new block that checks the session ceiling, the retry ceiling (both reused verbatim, never re-declared), the N-3 yes/no exemption over the practical labels only, and otherwise intercepts `declared-fork-no-card` -- skipping every relevance/existence/dedup-of-meaning check that would otherwise run first, per D-07.
- `deriveTurnSignals` threads a declaration source that is provably scoped to THIS turn's final text (direct `output_text`, else Stop stdin `last_assistant_message`, else the current-window transcript text via a new `decl_source_text` field on `readTranscriptTurn`), and ignores any direct `fork_declared`/`declared_labels` field on the envelope.
- `turnContextHash` appends a `declaredIdentity(turn)` suffix only when a turn is declared; the hashed input string is byte-identical to pre-359 for every non-declared turn (proven against the archived pre-359 classifier, not just the pre-357 anchor).
- `lib/mcp/stop-gate-handler.cjs`'s `buildStopGateCard` renders the declared labels (moonshot last) when declared, and the gate-dedup subject falls back to `declaredIdentity(turn)` so two distinct declared forks in one MCP session both fire.
- 27 new test legs (20 in `test-359-declared-arm.cjs` covering A1-A12, 4 more under `--tripwires` for A13; 7 in `test-359-mcp-declared.cjs` covering M1-M7), all green, plus a follow-up guard fix that keeps GATE357-08's mutation leg (`run-all-357.sh`) at 16/0.

## Task Commits

1. **Task 1: Declared arm, declaration source threading, retry-key suffix, and the R4 legs plus R5 tripwires** - `46463ddc2` (feat)
2. **Task 2: MCP stop_gate_check renders the declared labels and dedups per declared fork** - `b75fdc64e` (feat)
3. **Follow-up: guard the MCP dedup subject's declaredIdentity call against version skew** - `fe9816e6e` (fix, Rule 1 deviation)

**Plan metadata:** this commit (docs: complete plan) -- per the objective, `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `scripts/check-card-fire.cjs` - `forkDeclaration` require; `declaredIdentity(turn)`; `turnContextHash`'s decl suffix; `readTranscriptTurn`'s `decl_source_text`; `deriveTurnSignals`' declaration-source precedence chain and `fork_declared`/`declared_labels` output fields; `classifyCardFire`'s declared arm; `declaredIdentity` exported
- `lib/mcp/stop-gate-handler.cjs` - `buildStopGateCard` reads declared labels when present; `_safeDeclaredIdentity` guarded wrapper; the gate-dedup `gateContext.subject` fallback
- `tests/test-359-declared-arm.cjs` - new; 20 legs (A1-A12) plus 4 `--tripwires` legs (A13)
- `tests/test-359-mcp-declared.cjs` - new; 7 legs (M1-M7)

## Decisions Made

See `key-decisions` in the frontmatter.

## Interpretation to confirm (for the plan-06 navigator checkpoint)

The N-3 yes/no exemption reads `t.declared_labels.slice(0, -1)` (the PRACTICAL labels only, the final What-if moonshot excluded) mapped through `gateRelevance.normalizeOptionLabel`, then tested with `gateRelevance.isYesNoShapedGate`. This is the interpretation SPEC R4 and the plan's own action text call for (every declaration always carries a moonshot, and `isYesNoShapedGate` requires exactly 2 labels, so including the moonshot would make the exemption unreachable). Fixtured and tested at A3 (`tests/test-359-declared-arm.cjs`): a 2-practical yes/no declaration plus a moonshot exempts (`gate-is-simple-binary`); the same yes/no pair plus one more practical label (3 practical + moonshot) does not (`declared-fork-no-card`). Flagging per the plan's own instruction for explicit navigator confirmation at plan-06, alongside the `359-DOGFOOD-FORK-LABELS.md` review sheet from plan 02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guarded the MCP dedup subject's `declaredIdentity` call against version skew**
- **Found during:** post-Task-2 verification (`bash tests/run-all-357.sh`, GATE357-08's own mutation leg)
- **Issue:** `lib/mcp/stop-gate-handler.cjs`'s gate-dedup subject called `checkCardFire.declaredIdentity(turn)` unguarded. GATE357-08's mutation leg M1 reverts `scripts/check-card-fire.cjs` (and `lib/hmi/turn-text.cjs`) to their pre-357 bytes while `lib/mcp/stop-gate-handler.cjs` stays at HEAD -- on that tree `checkCardFire.declaredIdentity` does not exist, so the call threw a `TypeError` inside `handleStopEvent`'s dedup step, the outer catch turned every material verdict into `handler-error`, and the replay reported 16 CLI/MCP parity mismatches (`run-all-357.sh` dropped to `PASS=15 FAIL=1`).
- **Fix:** added `_safeDeclaredIdentity(turn)`, the same guarded-call pattern the file already uses for `_safeCtxHash` (checks `typeof checkCardFire.declaredIdentity === 'function'`, degrades to `''` on any throw), and used it at the dedup-subject call site instead of the bare call.
- **Files modified:** `lib/mcp/stop-gate-handler.cjs`
- **Verification:** `bash tests/run-all-357.sh` back to `PASS=16 FAIL=0 SKIP=0`; `bash tests/run-all-360.sh` `PASS=8 FAIL=0 SKIP=0`; `node tests/test-359-mcp-declared.cjs` 7/7; `node tests/test-198-stop-gate-retry-ceiling.test.cjs` 15 assertions; `node tests/test-357-replay.cjs` 12/12; `node tests/test-359-inertness.cjs` 4/4.
- **Committed in:** `fe9816e6e` (separate commit, not folded into Task 2, since it was found after Task 2's own commit and verify block had already passed with the narrower Task-2-only regression set)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary for correctness under GATE357-08's own mutation-testing discipline; no scope creep. The Task 2 acceptance criterion "`git diff $PLAN_BASE -- lib/mcp/stop-gate-handler.cjs` is at most 12 non-comment lines" is 14 including this fix (was 6 before it) -- a small, justified overage from a real bug fix, not from added scope.

## Issues Encountered

None beyond the deviation above. The `git diff` line-budget acceptance criteria on `scripts/check-card-fire.cjs` (at most 45) required two rounds of compaction (merging blank separator lines, collapsing single-statement `if` bodies onto one line, replacing a 5-line manual loop with a one-line `.map().filter().pop()`) to land at 38 from an initial 53 -- all behavior-preserving (re-verified 20/20 and 4/4 green after each round).

## Stub Tracking

No stubs. Every new function (`declaredIdentity`, the `decl_source_text` computation, the declaration-source precedence chain, the declared arm, `buildStopGateCard`'s declared-labels branch, `_safeDeclaredIdentity`) is real, load-bearing logic exercised by the 27 new test legs plus the full pre-existing regression suite.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-359-09** (stale declaration re-read): Pattern 1's precedence chain plus A10's five legs (direct wins, `last_assistant_message` fallback, current-window fallback, before-last-user-record gives false, stale-transcript-vs-plain-`last_assistant_message` gives false).
- **T-359-10** (DoS via a declaration on every turn): A4/A5 prove the declared arm hits the existing session/retry ceilings with the PRIMARY arm's own reason strings.
- **T-359-11** (a caller asserting `fork_declared` without text): A11 (deriveTurnSignals ignores the direct field) and M6 (the zod schema carries neither field).
- **T-359-12** (declared labels leaving the machine): no new `require` of any network module; labels stay in-process, in the local intercept log, and in the local retry-store key only.
- **T-359-13** (a free-text fork heuristic sneaking into the classifier): A13 tripwires -- regex literals frozen, 0 `.test`/`.match`/`.exec`/`new RegExp` in `classifyCardFire`/`deriveTurnSignals`, `outputText` count in `classifyCardFire` unchanged at 4, exactly one `parseForkDeclaration(` call site.
- **T-359-14** (a verdict change on historic outputs): A7/A8 compare against the archived pre-359 classifier (not just pre-357); `test-359-inertness.cjs` run clean before Task 1, after Task 1, after Task 2, and after the follow-up fix.
- **T-359-15** (MCP dedup suppressing later declared forks): M2/M3 legs, root-caused via Finding 5's own mechanism (an empty `gate_signature` on pure-prose declared text) and fixed via the `declaredIdentity` dedup-subject fallback.

## Verification Results

- `node tests/test-359-declared-arm.cjs` - 20/20 passed, exit 0
- `node tests/test-359-declared-arm.cjs --tripwires` - 4/4 passed, exit 0
- `node tests/test-359-mcp-declared.cjs` - 7/7 passed, exit 0
- `node tests/test-198-stop-gate-retry-ceiling.test.cjs` - PASS (15 assertions)
- `node tests/test-209-primary-sidechannel.cjs` - PASS (36 assertions)
- `node tests/test-238-card-fire-corpus.cjs` - PASS (32 assertions)
- `node tests/test-357-replay.cjs` - PASS 12/12
- `node tests/test-359-inertness.cjs` - 4/4 passed, exit 0 (run before Task 1, after Task 1, after Task 2, and after the follow-up fix)
- `node tests/test-card-fire-relevance-gate.cjs` - 6 passed, 5 failed both before and after this plan (the pre-existing R-J reds, not worsened)
- `bash tests/run-all-357.sh` - `PASS=16 FAIL=0 SKIP=0`, exit 0 (after the follow-up fix; was transiently `PASS=15 FAIL=1` between Task 2's commit and the fix)
- `bash tests/run-all-360.sh` - `PASS=8 FAIL=0 SKIP=0`, exit 0
- Frozen tripwire constants (measured against the pre-359 archive, `git show $PRE359:scripts/check-card-fire.cjs`): `classifyCardFire`'s `outputText` count = 4, 0 `.test`/`.match`/`.exec`/`new RegExp` uses in `classifyCardFire` or `deriveTurnSignals`, `MAX_FORCE_RETRIES = 3;` and `MAX_SESSION_INTERCEPTS = 12;` each declared exactly once -- all reproduced identically on HEAD post-edit (A13)
- `grep -v '^\s*//' scripts/check-card-fire.cjs | grep -c "declared-fork-no-card"` - 1
- `grep -c "ANCHOR fork359-declared-arm" scripts/check-card-fire.cjs` - 1
- `grep -v '^\s*//' scripts/check-card-fire.cjs | grep -c "parseForkDeclaration("` - 1
- `git diff $PLAN_BASE -- scripts/check-card-fire.cjs` non-comment line count - 38 (budget: at most 45)
- `buildEnforcementEnvelope` function source sha256 - identical between `$PLAN_BASE` and HEAD (byte-unchanged)
- `node tests/test-card-fire-relevance-gate.cjs` fail count - 5 both before and after (not worsened)
- `grep -v '^\s*//' lib/mcp/stop-gate-handler.cjs | grep -c "declaredIdentity"` - 1 (the `_safeDeclaredIdentity` wrapper's own name uses capital-D `DeclaredIdentity`, which does not match the lowercase-`d` grep)
- `grep -v '^\s*//' lib/mcp/stop-gate-handler.cjs | grep -c "declared_labels"` - at least 1 (2)
- `grep -v '^\s*//' lib/mcp/stop-gate-handler.cjs | grep -c "MAX_FORCE_RETRIES *=\|MAX_SESSION_INTERCEPTS *="` - 0
- `git diff $PLAN_BASE -- lib/mcp/stop-gate-handler.cjs` non-comment line count - 14 (budget was 12 pre-fix; 14 including the justified follow-up fix, see Deviations)
- `git diff --name-only $PLAN_BASE..HEAD -- lib/mcp/tools lib/mcp/gate-render.cjs lib/mcp/gate-dedup.cjs` - empty
- Em-dash guard (`scripts/check-card-fire.cjs`, `tests/test-359-declared-arm.cjs`, `lib/mcp/stop-gate-handler.cjs`, `tests/test-359-mcp-declared.cjs`) - 0/0/0/0
- `! grep -rn "api.typesafe.ai" lib/ hooks/` - clean
- `git diff --name-only $PLAN_BASE..HEAD | grep -E '(lib/mcp/brain-router|lib/core/write-lock|lib/core/part8-egress-guard|scripts/doctor|lib/core/graph-ops|scripts/eval-icm-writers|tests/test-353-grader-agreement|tests/test-353-ledger-shape|lib/core/navigation)\.cjs$|docs/OPEN-HANDOFFS\.md$'` - empty
- Post-commit deletion check (`git diff --diff-filter=D --name-only HEAD~1 HEAD`) - empty for all three commits
- `git status --short` after all three commits - only the 4 pre-existing deliberately-uncommitted files (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `docs/reviews/mindrian-system-explainer.html`) plus 2 pre-existing untracked docs files, none touched by this plan

## User Setup Required

None - no external service configuration, no secrets, no network egress (zero-network proof re-exercised via A13's structural scan plus the pre-359/pre-357 archive machinery's own hermetic env pattern; every leg redirects `MINDRIAN_HOME`/`MINDRIAN_ROOMS_HOME`/`MINDRIAN_ROOMS_ROOT`/`CARD_FIRE_SIDECHANNEL_PATH` into a fresh mkdtemp before the first relevant require).

## Next Phase Readiness

- Plan 04 (moonshot scorer, `fork359_moonshot` profile) is unblocked: `declared_labels`' final element is always the moonshot (N-3 grammar, `lib/core/fork-declaration.cjs`), and this plan's `declaredIdentity`/`fork_declared` fields are now live on every turn `deriveTurnSignals` produces, whether CLI or MCP.
- Plan 06's navigator checkpoint has an additional item ready: the "Interpretation to confirm" note above (the N-3 yes/no exemption over practical-labels-only), alongside plan 02's `359-DOGFOOD-FORK-LABELS.md`.
- Plan 07 (replay `--fork359` metrics) can now drive real declared-variant turns through both the CLI (`classifyCardFire`) and MCP (`handleStopEvent`) surfaces and expect `declared-fork-no-card` / `gate-is-simple-binary` verdicts and a rendered card matching the declared labels.
- Per this plan's own scope contract (peers share this tree), no `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` write was made; `requirements-completed: [FORK359-04, FORK359-05, FORK359-07]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Plan: 03*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: tests/test-359-declared-arm.cjs
- FOUND: tests/test-359-mcp-declared.cjs
- FOUND: scripts/check-card-fire.cjs (modified, declared arm + declaredIdentity + decl retry key present)
- FOUND: lib/mcp/stop-gate-handler.cjs (modified, declared labels + declaredIdentity dedup fallback present)
- FOUND: commit 46463ddc2 (Task 1)
- FOUND: commit b75fdc64e (Task 2)
- FOUND: commit fe9816e6e (follow-up fix)
- No missing items.
