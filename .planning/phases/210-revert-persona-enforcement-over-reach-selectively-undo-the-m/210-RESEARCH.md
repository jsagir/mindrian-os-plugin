# Phase 210: Revert Persona-Enforcement Over-Reach - Research

**Researched:** 2026-07-02
**Domain:** Claude Code plugin hook/gate softening (CJS scripts, Stop-hook, pre-commit/release gates, command-body prose, canon doctrine)
**Confidence:** HIGH for items A/B/E (mechanisms located and read in full), MEDIUM for item C (mechanism located but its runtime blast radius is narrower than the phase framing implies), MEDIUM-LOW for item D (no single mechanical "decision tree" artifact matches the CONTEXT.md description one-to-one; two plausible candidates found, flagged as an open question)

## Summary

This is a surgical-softening phase, not a new-feature phase: every file this phase touches already exists and was written by Phases 190/192/202/205/209. The job is to find the exact HARD-FAIL / no-override line in each file and turn it into a relevance-gated or advisory check, while leaving the underlying capability (glyph vocabulary, elevation taxonomy, AskUserQuestion primitive, render-coverage lint) untouched.

Five concrete mechanisms were located and read in full:

- **(A) Phase 190** - `scripts/check-shape-declaration.cjs`, wired into `scripts/release.sh` (Step 2) and `scripts/doctor.cjs --acceptance` (the `shape-declaration` gate id). It HARD-FAILs when an invocable surface (command/agent/pipeline/qualifying skill) has neither a `hitl_shape`/`hitl_stages` declaration nor a `connector.excluded` exemption. Important correction to the phase framing: this script is **not** wired into the actual git `pre-commit` hook (that hook only enforces `ROOM.md`/`MINTO.md`) - it only gates `release.sh` and `doctor --acceptance`. Also important: this same script was extended by **Phase 209-03 (B2+B3)** with three NEW predicates (`wired-body`, `tool-grant`, `declared-matches-body`) that check the declaration is actually *wired* in the command body - this is a Phase 209 addition living inside the Phase 190 file, and it is the piece that actually matches the "declared implies rendered" language in the CONTEXT.md item-A description. See Open Question 1.
- **(B) Phase 192** - two separate mechanisms, not one: (1) `lib/core/stance-state.cjs::forcedVoiceColorForStance` is a genuinely LOCKED, code-level, no-override mapping (`redteam` -> forced RED, `tell-act` -> forced BLUE) consumed by `lib/statusline/cockpit-renderer.cjs`; (2) the "mandatory footer" is **prose**, not code - `skills/larry-personality/SKILL.md` line 134 already says "Offered every turn, never forced" but qualifies it with "SHOULD name the... affordance... when it is not already the most recent line," which in practice reads as near-universal. There is no separate enforcement script for the footer; softening it is a doc-prose edit, verified by `tests/test-stance-voice-glyph-override.cjs` (a doctrine-presence text-grep suite, not a runtime behavior test).
- **(C) Phase 202** - `lab/apo/apo-loop.cjs` + `lab/apo/voice-contract-gate.cjs`. The "disqualifier" is real and does exactly what CONTEXT.md describes (candidates whose declared `output` fails `checkVoiceContract` are filtered out of `selectBest` before selection - reward can never buy a violation). **But this only runs inside the offline, lab-only Automatic Prompt Optimization tool** (`lab/apo/`, gitignored `runs/` dir, "recommend-then-ratify," never auto-writes `commands/act.md`). It has zero code path into live runtime Larry conversation. See Open Question 2 for what this means for phase scope/priority.
- **(D) Phase 205** - no single artifact matches "a decision tree Larry must mechanically follow" cleanly. Two candidates, both read in full: `lib/core/persona-taxonomy.cjs::ROLE_LEVEL_ELEVATION_LEAN` is explicitly documented in its own comments as "a bias, NOT a quota... gate on the signal, never on a count" - i.e. it is already soft. `lib/core/fusion-router.cjs::sessionEndQuorum` is a real mechanical force: when 2+ Frame nodes are open and no horizontal move fired yet this session, it unconditionally forces exactly one offered hypothesis (`test-205-fusion-router.cjs` asserts `q.forced === true, q.count === 1`). This is the best-evidenced candidate for "restore to a lens, not a required procedure." See Open Question 3.
- **(E) Phase 209** - the big one, three parts: (1) `scripts/check-card-fire.cjs` (the Stop hook, `classifyCardFire`) - force-blocks a turn when a gate-reaching signal fired and no AskUserQuestion tool-call is detected in the current turn window, bounded only by `MAX_FORCE_RETRIES=3` / `MAX_SESSION_INTERCEPTS=12` (retry caps, not relevance checks); (2) `lib/hmi/selector-dispatcher.cjs::appendAskUserQuestionTrailer` - mints the `[BINDING: call the AskUserQuestion tool...]` imperative unconditionally into every Shape-F rendered envelope's footer, with zero relevance/staleness check; (3) the 95-command "mos:firing-block v1" stamp applied by `scripts/stamp-firing-block.cjs` (80 of those got a body stamp; the rest got `allowed-tools` grants or were already pre-wired). All three need a relevance/confidence gate, not a bare removal (removal alone re-creates the exact bug Phase 209 fixed - a genuine unanswered fork that silently renders as flat text).

**Primary recommendation:** Build ONE shared relevance/staleness predicate (a small new module, e.g. `lib/core/gate-relevance.cjs`) that both `check-card-fire.cjs`'s backstop and `fusion-router.cjs`'s `sessionEndQuorum` (and optionally the footer/glyph prose in item B) can consult, rather than hand-rolling four separate ad hoc relevance checks. The already-fixed `reach-gate-stale-turn-input` bug (commit `42835adb`) proves the codebase's existing pattern for "is this content about the CURRENT turn" (threading `STDIN_MESSAGE` into the seed) and is directly reusable groundwork, not a coincidence - reuse its "current turn is available in module scope at hook-2 time" finding rather than re-deriving it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Card-fire force/backstop (item E) | Claude Code CLI (Stop hook) | - | `scripts/check-card-fire.cjs` runs as a Stop-event hook process; pure LOCAL, no Brain/network |
| AskUserQuestion trailer minting (item E) | Claude Code CLI (render pipeline) | - | `lib/hmi/selector-dispatcher.cjs` runs in-process during Shape-F rendering, before the hook layer sees output |
| Command-body firing-block stamp (item E) | Claude Code CLI (command prompt text) | - | Static markdown injected into `commands/*.md`; read by the model at invocation, not a runtime gate |
| Shape declaration + wired-body gate (item A) | Build/CI (release.sh, doctor --acceptance) | - | Runs at release-cut and acceptance-audit time, never at conversation runtime |
| Locked voice-glyph override (item B) | Claude Code CLI (statusline) | Claude Desktop (prose only) | `cockpit-renderer.cjs` is CLI-only; the SKILL.md prose governs Desktop/Cowork conversational behavior |
| Stance-toggle footer offer (item B) | Claude Code CLI / Desktop / Cowork (all three - it is prose in a loaded skill) | - | `skills/larry-personality/SKILL.md` loads on every surface; this is a persona-prose concern, not a hook |
| Voice-contract disqualifier (item C) | Build/CI / offline lab tool | - | `lab/apo/` never runs during live chat; it is a human-run offline optimization utility |
| Elevation session-end quorum (item D) | Claude Code CLI / Desktop / Cowork (conversational engine) | - | `fusion-router.cjs` is called from the navigation/decision engine during a live turn |
| Elevation-lean bias (item D, NOT in scope to touch) | Claude Code CLI / Desktop / Cowork | - | Already soft; no tier reassignment needed |

## Standard Stack

No new external dependencies. This phase edits existing CJS modules only (`scripts/*.cjs`, `lib/**/*.cjs`, `commands/*.md`, `skills/*/SKILL.md`, `docs/MINDRIAN-CANON.md` if item D's canon language needs a companion softening note - **flag, do not silently amend canon**; canon amendments in this codebase require a navigator-gated blocking checkpoint per every prior canon-wave phase reviewed [192, 205, 195, 190]).

**Version verification:** N/A - no package installs in this phase.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages; it edits existing in-repo CJS/markdown only.

## Architecture Patterns

### System Architecture Diagram

```
                     USER TURN (prompt text)
                             |
                             v
              +--------------------------+
              | UserPromptSubmit hooks   |   <- intent-classifier.cjs (hook #2)
              | (routing seed built here)|      deriveConversationSeed() now
              +--------------------------+      threads STDIN_MESSAGE (fixed
                             |                   2026-07-02, commit 42835adb)
                             v
              +--------------------------+
              | decide() / dispatchSensors|  <- navigation-engine.cjs
              | -> may reach a Decision   |
              |    Gate (F.0-F.9)         |
              +--------------------------+
                             |
              reached a gate?|
                    yes      v
              +--------------------------+
              | selector-dispatcher.cjs   |  <- ITEM E, part 2
              | appendAskUserQuestionTrailer|   mints BINDING imperative
              | (renders Shape-F envelope) |   UNCONDITIONALLY today
              +--------------------------+
                             |
                             v
              +--------------------------+
              | Model emits response       |  <- commands/*.md 95-stamp
              | (should fire AskUserQuestion| <- ITEM E, part 3
              |  tool per firing-block stamp)|
              +--------------------------+
                             |
                             v
              +--------------------------+
              | Stop hook:                |  <- ITEM E, part 1
              | check-card-fire.cjs        |     classifyCardFire()
              | classifyCardFire()          |     force-blocks if reached-gate
              | -> intercept / degrade /    |     + no fired card, NO relevance
              |    no-op                    |     check today (THIS PHASE
              +--------------------------+     ADDS ONE)
                             |
              elsewhere, same turn:
                             v
              +--------------------------+
              | fusion-router.cjs          |  <- ITEM D
              | sessionEndQuorum()          |     forces exactly 1 hypothesis
              | (2+ open frames -> force)   |     when frames >= 2, regardless
              +--------------------------+     of conversational relevance

              +--------------------------+
              | lab/apo/apo-loop.cjs       |  <- ITEM C (OFFLINE, human-run
              | voice-contract-gate.cjs    |     tool, no live-turn path)
              +--------------------------+

              +--------------------------+
              | check-shape-declaration.cjs|  <- ITEM A (release.sh Step 2,
              | (declaration-exists gate    |     doctor --acceptance ONLY;
              |  + Phase 209 wired-body add) |    NOT git pre-commit)
              +--------------------------+
```

### Recommended Project Structure

No new directories. Likely new file:
```
lib/
├── core/
│   ├── gate-relevance.cjs      # NEW (recommended): shared relevance/staleness
│   │                           #   predicate consumed by check-card-fire.cjs's
│   │                           #   backstop and (optionally) fusion-router.cjs
```

### Pattern 1: Reuse the existing "thread the current turn" fix instead of re-deriving it

**What:** Commit `42835adb` (`.planning/debug/resolved/reach-gate-stale-turn-input.md`) already solved "is this gate-content actually about what the user just said" for the F.1 reach-payload staleness bug, by threading `STDIN_MESSAGE` into `deriveConversationSeed()` in `scripts/intent-classifier.cjs`, since intent-classifier runs as UserPromptSubmit hook #2 (before operator-update/jtbd-update persist the turn), the current message is available in module scope but was not being used.

**When to use:** Item E's relevance gate needs the SAME signal (does the gate-content relate to what the user just typed / did the user already answer this) but at the STOP-hook layer (`check-card-fire.cjs`), which is a DIFFERENT hook event and reads a transcript, not stdin. The mechanism cannot be copy-pasted verbatim, but the reusable insight is: **the current turn's text is cheaply available (transcript tail already parsed by `readTranscriptTurn`) - the missing piece is a predicate that compares the LAST assistant message's gate-content against the immediately-preceding user turn's text**, not a re-plumbing of data flow.

**Example (illustrative, not exact code to lift verbatim):**
```javascript
// Source: pattern derived from scripts/intent-classifier.cjs deriveConversationSeed
// (commit 42835adb) + scripts/check-card-fire.cjs readTranscriptTurn (already
// walks the same transcript and already resets a window on role:user records)
function gateAlreadyAnsweredByUser(precedingUserText, gateSignature) {
  // Compare normalized precedingUserText against the gate's option-label set
  // (gateSignature already carries a normalized label-token set per
  // check-card-fire.cjs::gateSignature -- REUSE this, do not reimplement).
}
```

### Pattern 2: `run_if`-guarded phase aggregator (mandatory house pattern)

**What:** Every phase in this window (188, 190, 192, 196, 200, 201, 202, 205, 209) ships `tests/run-all-<phase>.sh` using an identical `run_if` (SKIP-on-file-absence) / `run()` (PASS/FAIL counter) idiom.

**When to use:** `tests/run-all-210.sh` MUST mirror this exactly (CONTEXT.md explicitly requires it, "mirroring `run-all-209.sh`/`run-all-205.sh` pattern").

**Example:**
```bash
# Source: tests/run-all-209.sh / tests/run-all-202.sh (verbatim idiom)
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}
```

### Pattern 3: Enumerate the stamped-command set from disk, never hardcode a count (RETRO-07c)

**What:** `.planning/phases/144.1-connector-retrofit-sweep/` establishes the house rule that a "sweep across N artifacts" phase must derive the live surface set from disk at verification time, never assert a frozen literal count.

**When to use:** Item E's stamp-removal/softening work. `scripts/stamp-firing-block.cjs --check` ALREADY implements exactly this (`STAMP_MARKER = '<!-- mos:firing-block v1 -->'`, scans `commands/*.md` at run time, reports `pendingCount`). Live count as of this research: **80 commands currently carry the body `STAMP_MARKER`** (`grep -rl "mos:firing-block" commands/*.md | wc -l` = 80), not 95 - the commit message for `b21eafa0` describes 95 FILES TOUCHED (80 body-stamped + 93 given `allowed-tools` grants + 17 pre-wired-and-skipped, overlapping sets), not 95 identically-stamped files. **Do not hardcode "95" or "80" in any new test - call `stamp-firing-block.cjs`'s own enumeration function.**

**Example:**
```bash
# Verified live 2026-07-02:
grep -rl "mos:firing-block" commands/*.md | wc -l   # -> 80 (body-stamped)
node scripts/stamp-firing-block.cjs --check          # -> reports live pendingCount from disk
```

### Anti-Patterns to Avoid

- **Bare removal of the Stop-hook backstop (item E):** would re-create the EXACT symptom Phase 209 was built to fix (a reached gate silently rendering as flat ASCII-box text, no card, no re-prompt). CONTEXT.md's own constraint explicitly calls this out. Every softened gate needs a two-directional test: genuine-unanswered-fork still fires; irrelevant/already-answered no longer force-blocks.
- **Touching `check-render-coverage.cjs` (Phase 178, R15) or `scripts/build-connector-registry.cjs` (CIRS R2):** these are named in CONTEXT.md's preserve boundary only indirectly (they are NOT Phase 190/192/202/205/209), but they share a release-gate call site with `check-shape-declaration.cjs` in `scripts/release.sh` (lines ~294 and ~314 are adjacent). A careless edit to the shared release.sh block could accidentally soften the wrong gate. Read the full Step-2 block before editing, not just the `check-shape-declaration.cjs` line.
- **Conflating the two layers inside `check-shape-declaration.cjs` (item A vs item E):** Phase 190 added the base declaration-exists check; Phase 209-03 (B2+B3) LATER added `wired-body`/`tool-grant`/`declared-matches-body` predicates to the SAME FILE, scoped to the `command` surface class. Relaxing "Phase 190's gate" without deciding what happens to the Phase-209 predicates living in the same function will either under-soften (leave the 209 addition as a silent hard-fail) or over-soften (accidentally relax code that CONTEXT.md scoped under item E, not item A). See Open Question 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this gate content about what the user just said" | A new keyword-match heuristic from scratch | Reuse `gateSignature()`'s already-normalized option-label token set (`check-card-fire.cjs`) + the `42835adb` "thread current turn" pattern | The codebase already solved turn-relevance detection twice (reach-gate-stale-turn-input fix, and gateSignature's normalization); a third bespoke implementation risks a third subtly-different bug |
| Enumerating the stamped-command set | A hardcoded array of 95 command paths in a new test | `scripts/stamp-firing-block.cjs`'s own scan (already exists, already run_if-testable) | RETRO-07c: the count already drifted between the commit message (95 touched) and the live grep (80 body-stamped) within the same session - any hardcoded count is stale on day one |
| Phase-gate aggregation | A new bash pattern for `tests/run-all-210.sh` | Copy the `run()`/`run_if()` idiom verbatim from `run-all-209.sh` | Every phase in this window uses the identical idiom; a novel pattern breaks the house convention doctor/verify tooling may implicitly assume |

**Key insight:** Every one of the five items in this phase is a MODIFICATION of an existing, recently-shipped, well-tested mechanism - not a new build. The dominant risk is not "building the wrong thing" but "softening the wrong layer" (see the check-shape-declaration.cjs A/E conflation above) or "softening too far" (bare removal re-creating the original bug). Both risks are mitigated by reusing existing signatures/predicates rather than writing new detection logic.

## Common Pitfalls

### Pitfall 1: Treating "Phase 190's gate" as a single self-contained mechanism
**What goes wrong:** A plan that edits only the code Phase 190 originally wrote (the base declaration-exists check) leaves Phase 209's `wired-body`/`tool-grant`/`declared-matches-body` predicates - added to the SAME file three phases later - as an undocumented residual HARD-FAIL.
**Why it happens:** `git blame`/`git log -p` on `check-shape-declaration.cjs` shows layered authorship across phases; reading only the Phase 190 PLAN/SUMMARY files (not the file's current state) misses the Phase 209-03 addition.
**How to avoid:** Read `scripts/check-shape-declaration.cjs`'s CURRENT state and cross-reference every HARD-FAIL branch against which phase most recently touched it (`git log --follow -p -- scripts/check-shape-declaration.cjs | grep -B5 "^commit"`), not just the phase's own PLAN docs.
**Warning signs:** A plan task says "relax Phase 190's check-shape-declaration.cjs to advisory" without naming which specific predicates inside the file are in scope.

### Pitfall 2: Assuming Phase 202's disqualifier affects live Larry behavior
**What goes wrong:** Spending planning effort treating item C with the same urgency as items A/B/D/E, when it has zero code path into live conversation (confirmed: `lab/apo/` is a human-run offline tool, gitignored `runs/` output, "recommend-then-ratify," never auto-writes the target prompt file).
**Why it happens:** The phase framing groups all five items under one "less like Larry" symptom, but Phase 202's disqualifier only vetoes candidate PROMPT VARIANTS during an offline optimization run a human triggers manually - it cannot have contributed to any of the 5+ live-session misfires logged in `feedback_1_15_enforcement_regression_watch.md`.
**How to avoid:** Confirm this finding with the user before spending a full plan-wave on it; it may be lower priority than A/B/D/E, or may be addressed as a smaller/faster task.
**Warning signs:** A plan spends the same task-count budget on item C as on item E despite item C having no runtime blast radius.

### Pitfall 3: Bare-removing the Stop-hook backstop instead of gating it
**What goes wrong:** Deleting or disabling `check-card-fire.cjs`'s `classifyCardFire` intercept entirely re-creates Phase 209's original bug (a genuine unanswered fork silently rendering as flat ASCII-box text with no interactive card, no re-prompt).
**Why it happens:** "Remove the veto power" (item C's language) and "relax to advisory" (items A/B) can be over-generalized to item E, where CONTEXT.md is explicit that the backstop itself must survive - only the "no relevance check" property is in scope.
**How to avoid:** Any change to `check-card-fire.cjs` MUST preserve a passing `tests/test-209-incident-replay.cjs` (the adversarial verification of the ORIGINAL incident this hook fixes) alongside new tests proving the two NEW behaviors (already-answered turn passes; irrelevant-subject turn passes).
**Warning signs:** A plan task's acceptance criteria only checks "the false-positive case no longer blocks" without also asserting "the true-positive case (genuine unanswered fork) still blocks."

### Pitfall 4: Missing that the "mandatory footer" (item B) has no code-level gate
**What goes wrong:** Searching for a HARD-FAIL script/hook enforcing the stance-toggle footer (mirroring items A/E's pattern) and finding none, then concluding item B is already soft / needs no work.
**Why it happens:** `skills/larry-personality/SKILL.md` line 134 already contains "never forced" language; a shallow read might conclude nothing needs to change.
**How to avoid:** Recognize the over-reach is in the SHOULD-clause's practical universality ("when it is not already the most recent line" fires on almost every turn), not in a missing "never forced" disclaimer. The fix is prose-level: tighten the SHOULD-condition to genuine relevance (e.g., the navigator is mid-decision about conversational mode, not every turn).
**Warning signs:** A plan task for item B only touches `lib/core/stance-state.cjs` (the genuinely-locked glyph mapping) and skips `skills/larry-personality/SKILL.md` (the footer-frequency prose) entirely, or vice versa - both need attention, they are different mechanisms.

### Pitfall 5: Assuming Phase 205's "decision tree" is the elevation-lean bias code
**What goes wrong:** Spending effort softening `lib/core/persona-taxonomy.cjs::ROLE_LEVEL_ELEVATION_LEAN`, which its own in-code comments already describe as "a bias, NOT a quota... gate on the signal, never on a count" - i.e., nothing to soften.
**Why it happens:** Both this file and `fusion-router.cjs` mention "elevation"; only the latter (`sessionEndQuorum`) actually forces a mechanical outcome.
**How to avoid:** Confirm the target with the user or via discuss-phase before committing tasks; `sessionEndQuorum`'s force-exactly-one-hypothesis behavior (evidenced by `test-205-fusion-router.cjs` asserting `q.forced === true`) is the best-evidenced candidate, but CONTEXT.md does not name it explicitly.
**Warning signs:** A plan task references "the elevation decision tree" without citing a specific function/file and a specific HARD-FAIL/force behavior with a test that proves it.

## Code Examples

### The item-E force-fire predicate (current, HARD, no relevance check)
```javascript
// Source: scripts/check-card-fire.cjs:420-475 (classifyCardFire), read in full this session
// Today: if a reached gate fired no card, this predicate ALWAYS intercepts
// (bounded only by retry/session counters -- never by relevance/staleness).
if (!primaryHit && !backstopHit) {
  return { intercept: false, reason: 'no-gate-signal', degrade: false };
}
// ... falls through to intercept:true with reason 'ascii-box-backstop-no-card'
// or 'reached-registry-gate-no-card' -- NO check of whether the preceding
// user turn already answered this, and NO check of subject-matter relevance.
```

### The item-E trailer-minting site (current, unconditional)
```javascript
// Source: lib/hmi/selector-dispatcher.cjs:551-580 (appendAskUserQuestionTrailer)
// Every Shape-F rendered envelope gets this appended to zones.footer,
// unconditionally, on every call site (pickShape door + renderRoomChooserCard):
const binding = '[BINDING: call the AskUserQuestion tool in THIS response with the '
  + verbs.length + ' options above; do not reproduce this block as text (SEED-021)]';
```

### The item-D force-exactly-one-hypothesis mechanism (current, HARD)
```javascript
// Source: lib/core/fusion-router.cjs (sessionEndQuorum, D-Q1), verified against
// tests/test-205-fusion-router.cjs:251-278
// q.forced === true, q.count === 1  <-- this fires whenever 2+ Frame nodes are
// open AND no horizontal move fired yet this session -- regardless of whether
// a cross-frame connection is actually relevant to the current ask.
```

### The item-A locked mapping that is NOT in scope (already soft, do not touch)
```javascript
// Source: lib/core/persona-taxonomy.cjs:207-215 (own comments, verbatim)
// "This is a bias, NOT a quota... gate on the signal, never on a count."
// resolveElevationLean() returns a {primary, secondary} LEAN, never forces
// a specific elevation direction. Nothing to soften here.
```

### The reusable turn-relevance pattern (already shipped, reuse for item E)
```javascript
// Source: scripts/intent-classifier.cjs deriveConversationSeed (fixed 2026-07-02,
// commit 42835adb, RCA at .planning/debug/resolved/reach-gate-stale-turn-input.md)
// Threads STDIN_MESSAGE as the freshest seed fragment so decide()/dispatchSensors
// react to the CURRENT turn instead of stale persisted history. Different hook
// event than check-card-fire.cjs (UserPromptSubmit vs Stop) but the SAME
// underlying insight applies: the current turn's text is cheaply available and
// was simply not being consulted.
```

## State of the Art

| Old Approach (pre-v1.15) | Current Approach (v1.15.0-beta.13..v1.15.2) | When Changed | Impact |
|--------------------------|----------------------------------------------|---------------|--------|
| Render-coverage was advisory (a lint signal) | HARD-FAIL at pre-commit/release.sh/doctor (Phase 178 R15) | 2026-06-24 | First domino; everything downstream in this phase's scope builds on this precedent |
| Voice glyph was natural detection only | Locked forced-color override for 2 of 4 stances (Phase 192) | 2026-07-02 | Item B |
| APO reward was quality+telemetry only | Voice-contract HARD disqualifier added on top (Phase 202) | 2026-07-01/02 | Item C (offline-only) |
| Elevation was "Larry's judgment, guided by taxonomy" | `sessionEndQuorum` forces exactly one hypothesis when 2+ frames open (Phase 205) | 2026-07-02 | Item D (best-evidenced candidate) |
| A card trailer was "a scalar string for introspection" (no imperative) | Self-decoding `[BINDING: ...]` imperative + Stop-hook backstop + 95-command body stamp (Phase 209, in 3 waves: quick-fix w1, then 209-01..07) | 2026-07-02 | Item E |

**Deprecated/outdated:** None of the underlying capabilities are deprecated by this phase - only the enforcement STRICTNESS of five specific mechanisms is targeted. The render-coverage lint (Phase 178), the CIRS born-wired gate (R1/R2), and the voice-color palette (5-color De Stijl mark) all stay exactly as they are.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lib/core/fusion-router.cjs::sessionEndQuorum` is THE mechanism CONTEXT.md item D refers to as "a decision tree Larry must mechanically follow" | Summary, Item D; Pitfall 5 | If wrong, the plan softens a mechanism the navigator did not actually mean, and the real over-reach (possibly the Part 12 canon "surface obligation" prose, or a Plurai eval gate not yet located) stays untouched |
| A2 | Phase 202's disqualifier has zero runtime impact on live Larry conversation (confirmed via full read of `lab/apo/apo-loop.cjs` + its `run-all-202.sh` framing as an offline lab tool) | Summary, Item C; Pitfall 2 | Low risk - this is a direct code read, not an inference, but flagged in case a future phase wires `lab/apo/` output into a live path not yet built |
| A3 | The 95-command figure in CONTEXT.md is the b21eafa0 commit's FILES-TOUCHED count (80 body-stamped + overlapping allowed-tools grants + pre-wired skips), not a single homogeneous "95 identically stamped" set | Pattern 3 | Low risk - directly verified via `git show --name-only` (95) vs live `grep -rl` (80); a plan that asserts "verify all 95 stamped commands" without qualifying which 95 (touched vs body-stamped) could write a flaky/wrong test |

**If this table is empty:** N/A - see above.

## Open Questions

1. **Does relaxing "Phase 190's gate" (item A) also relax the Phase 209-03 `wired-body`/`tool-grant`/`declared-matches-body` predicates living inside the SAME `check-shape-declaration.cjs` file?**
   - What we know: Phase 190 shipped the base declaration-exists check; Phase 209-03 (B2+B3) added three stricter predicates to the same file, scoped to the `command` surface class, and CONTEXT.md's item-A prose ("fails if a declared hitl_shape/body_shape isn't actually rendered") textually matches the Phase 209 addition more than the Phase 190 original.
   - What's unclear: whether the navigator's "relax Phase 190's build gate to advisory" intends to touch only the original declaration-exists check (leaving the 209 wired-body checks as a hard-fail, since 209 is separately in scope under item E anyway) or whether both layers should move together.
   - Recommendation: the planner should treat this as two separate, explicitly-scoped tasks: Task-A1 relaxes ONLY the base declaration-exists predicate (Phase 190's original scope); Task-A2 (or fold into item E's plan wave) explicitly decides the fate of the 209-03 wired-body/tool-grant/declared-matches-body predicates. Do not silently bundle them.

2. **Should item C (Phase 202's APO disqualifier) get a full plan-wave given it has no live-runtime blast radius?**
   - What we know: `lab/apo/apo-loop.cjs` is a human-triggered, offline, "recommend-then-ratify" tool; it never writes `commands/act.md` automatically and has no code path from any live conversation.
   - What's unclear: whether the navigator still wants this softened purely for internal consistency/precedent (so a future human running the APO loop doesn't get a candidate silently vetoed with no visibility), or whether this should be deprioritized/descoped relative to A/B/D/E.
   - Recommendation: keep it in scope (CONTEXT.md explicitly names it) but size the task small (the fix is mechanical: change `disqualified` filtering in `apo-loop.cjs` to instead fold `voice.violations.length` as a negative score term rather than a hard filter) and do not gate release on it the way A/B/D/E deserve to be gated.

3. **What IS the "decision tree" in item D if not `fusion-router.cjs::sessionEndQuorum`?**
   - What we know: `persona-taxonomy.cjs`'s elevation-lean bias is explicitly documented as soft (not a candidate); `fusion-router.cjs::sessionEndQuorum` is the only found mechanism that forces a specific mechanical outcome (exactly one hypothesis) rather than biasing a judgment call.
   - What's unclear: whether the navigator instead means the Canon Part 12 "surface obligation" prose (`docs/MINDRIAN-CANON.md` line 651: "A row that does not tell the navigator what they get... fails this Part") which is enforced only as prose/doctrine, not as a code gate found in this research pass.
   - Recommendation: confirm with the navigator before planning item D's tasks; if `sessionEndQuorum` is confirmed, the fix is straightforward (gate the force on a relevance/confidence signal rather than a bare frame-count threshold); if it is the canon prose instead, this becomes a canon-amendment-adjacent change requiring the same navigator-gated blocking-checkpoint pattern every other canon touch in this codebase uses (see Phase 190/192/195/205's canon waves, all navigator-approved before any canon byte was written).

## Environment Availability

Skipped - this phase is code/config/prose edits only in an already-fully-provisioned dev workspace (`/home/jsagi/dev/MindrianOS-Plugin`), no new external tool/service dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `assert` + custom `run()`/`run_if()` bash aggregator idiom (no jest/mocha/vitest anywhere in this codebase) |
| Config file | none - each `tests/test-*.cjs` is a standalone Node script; `tests/run-all-<phase>.sh` is the phase gate |
| Quick run command | `node tests/test-209-incident-replay.cjs` (or the specific new test file for the item being changed) |
| Full suite command | `bash tests/run-all-210.sh` (to be created); `node scripts/doctor.cjs --acceptance` before declaring done (CONTEXT.md constraint) |

### Phase Requirements -> Test Map

No `REQUIREMENTS.md`/registered requirement IDs exist for this phase (confirmed: no `.planning/REQUIREMENTS.md` file in this repo at all; phase-210's scope is derived entirely from `210-CONTEXT.md`'s five lettered items). Mapping the five CONTEXT.md items to the reverse-regression test obligation CONTEXT.md itself mandates ("every softened gate needs a regression test proving BOTH directions"):

| Item | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| A | `check-shape-declaration.cjs` base check downgrades HARD-FAIL to WARN (unless load-bearing for 194/196/200 - not found to be) | unit | `node scripts/check-shape-declaration.test.cjs` (existing, extend) | Exists, extend |
| A (209-03 layer) | wired-body/tool-grant/declared-matches-body predicates - fate TBD per Open Question 1 | unit | `node tests/test-209-declared-implies-wired.cjs` (existing, may need a new sibling if softened) | Exists |
| B | Locked glyph mapping stays default-but-overridable; footer conditional on relevance | doctrine-presence (text-grep) + unit | `node tests/test-stance-voice-glyph-override.cjs` (existing, extend) | Exists, extend |
| C | APO disqualifier -> score term, not veto | unit | `node tests/test-202-voice-contract-gate.cjs` / `node tests/test-202-apo-loop.cjs` (existing, extend) | Exists, extend |
| D | `sessionEndQuorum` (or canon prose, pending Open Q3) gated on relevance | unit | `node tests/test-205-fusion-router.cjs` (existing, extend) | Exists, extend |
| E-1 | `check-card-fire.cjs` backstop: pass on already-answered/irrelevant, still block on genuine unanswered fork | unit (two-directional per CONTEXT.md constraint) | `node tests/test-209-incident-replay.cjs` + new `tests/test-210-relevance-gate.cjs` | Existing test to preserve; new test needed - Wave 0 gap |
| E-2 | `appendAskUserQuestionTrailer`: binding imperative conditional on relevance | unit | new `tests/test-210-trailer-relevance.cjs` | Wave 0 gap |
| E-3 | 95/80-command stamp: enumerate live from disk, no hardcoded count | unit | `node scripts/stamp-firing-block.cjs --check` (existing) | Exists |
| ALL | Phase gate aggregator | integration | `bash tests/run-all-210.sh` | Wave 0 gap - create, mirroring `run-all-209.sh` |

### Sampling Rate
- **Per task commit:** the specific `node tests/test-<item>*.cjs` for the item being touched, plus `node -c` syntax check on every edited `.cjs` file (house convention, seen in every phase's SUMMARY.md "Gates" section)
- **Per wave merge:** `bash tests/run-all-210.sh` (once created) plus re-running `run-all-190.sh`, `run-all-192.sh`, `run-all-202.sh`, `run-all-205.sh`, `run-all-209.sh` (the five phases being softened - their OWN aggregators must stay green except for the specific assertions this phase intentionally changes)
- **Phase gate:** `node scripts/doctor.cjs --acceptance` full green before `/gsd-verify-work` (explicit CONTEXT.md constraint)

### Wave 0 Gaps
- [ ] `tests/test-210-relevance-gate.cjs` - the new two-directional test for item E's Stop-hook softening (already-answered/irrelevant passes; genuine unanswered fork still blocks)
- [ ] `tests/test-210-trailer-relevance.cjs` - covers item E-2 (trailer conditional on relevance)
- [ ] `tests/run-all-210.sh` - the phase aggregator, mirroring `run-all-209.sh`/`run-all-205.sh` (explicit CONTEXT.md requirement)
- [ ] Framework install: none - Node built-ins only, already present

## Security Domain

Not applicable in the ASVS sense - this phase touches zero authentication, session-management, access-control, input-validation-from-untrusted-network-input, or cryptography surfaces. All five items are LOCAL-only, in-process conversational-UX gates (Canon Part 8 already holds: every file read in this research - `check-card-fire.cjs`, `selector-dispatcher.cjs`, `stance-state.cjs`, `apo-loop.cjs`, `fusion-router.cjs`, `check-shape-declaration.cjs` - makes zero network calls and zero Brain-MCP calls). The one relevant "threat" already named and mitigated in existing code: `check-card-fire.cjs`'s own bounded-escape (`MAX_FORCE_RETRIES`/`MAX_SESSION_INTERCEPTS`) exists specifically to prevent a DoS-style navigator-trap (T-179-01) - this phase's relevance gate is a REFINEMENT of when the intercept fires, not a removal of that existing DoS protection, and must not weaken it.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A - no auth surface touched |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | no | The gate-relevance predicate reads only LOCAL transcript text already trusted by the existing Stop-hook contract; no new external input surface |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Navigator-trap DoS (a card-incapable surface loops the Stop-hook intercept forever) | Denial of Service | Already mitigated by `MAX_FORCE_RETRIES`/`MAX_SESSION_INTERCEPTS` bounded escape in `check-card-fire.cjs` - preserve, do not remove, when adding the relevance gate |
| Over-eager relevance gate silently swallowing a genuine unanswered fork (the reverse-regression CONTEXT.md explicitly warns against) | Tampering (of the gate's own guarantee) | Two-directional regression test per softened gate (CONTEXT.md constraint); reuse `tests/test-209-incident-replay.cjs` as the "genuine fork still fires" floor |

## Sources

### Primary (HIGH confidence - direct file reads this session)
- `scripts/check-card-fire.cjs` (999 lines, read in full)
- `lib/hmi/selector-dispatcher.cjs` (lines 500-650, `appendAskUserQuestionTrailer` read in full)
- `lib/core/stance-state.cjs` (147 lines, read in full)
- `lab/apo/apo-loop.cjs` (273 lines, read in full)
- `lab/apo/voice-contract-gate.cjs` (138 lines, read in full)
- `lib/core/persona-taxonomy.cjs` (relevant sections read)
- `lib/core/fusion-router.cjs` (grep + `205-07-SUMMARY.md` cross-read)
- `scripts/check-shape-declaration.cjs` (main/--check logic read)
- `scripts/stamp-firing-block.cjs` (STAMP_MARKER/--check logic read)
- `scripts/release.sh` (Step 2 gate-wiring block, lines ~285-325, read)
- `scripts/doctor.cjs` (acceptance gate wiring, lines ~2770-2800, read)
- `.planning/debug/resolved/reach-gate-stale-turn-input.md` (full RCA read)
- `docs/MINDRIAN-CANON.md` (Part 12 elevation section, lines 635-651, and Appendix D entries 34/35, read)
- `skills/larry-personality/SKILL.md` (stance/elevation sections, read)
- `agents/larry-extended.md` (elevation section, read)
- Commit `b21eafa0` (95-file stamp commit, `git show --stat`/`--name-only`, read)
- Commit `42835adb` (reach-gate-stale-turn-input fix, `git show --stat`, read)
- `~/.claude/projects/-home-jsagi/memory/feedback_1_15_enforcement_regression_watch.md` (full session memory, read)
- `.planning/phases/210-.../210-CONTEXT.md` (full, read)
- `.planning/STATE.md` (relevant entries via grep, read)
- `.planning/ROADMAP.md` (Phase 210 entry, read)
- `.planning/phases/202-agent-lightning-apo-lab/`, `192-shape-f-hitl-selector-completion/`, `205-larry-loop-elevation.../`, `209-shape-f-native-fire/` SUMMARY.md files (read for provenance/decisions)
- `tests/run-all-190.sh`, `tests/run-all-202.sh`, `tests/run-all-205.sh`, `tests/run-all-209.sh` (all read in full)
- `.planning/phases/144.1-connector-retrofit-sweep/144.1-01-SUMMARY.md` (RETRO-05/sweep pattern precedent, read)

### Secondary (MEDIUM confidence)
- `docs/CANON-PHASE-MAP.md` grep results confirming Phase 190/205 canon rows and their "mints no reach, frozen scalars untouched" framing (not fully read line-by-line, spot-checked)

### Tertiary (LOW confidence)
- None - every claim in this research traces to a direct file/commit read or an explicit grep result this session; no unverified WebSearch claims were used (this is an entirely in-repo research task, no external library/framework involved)

## Metadata

**Confidence breakdown:**
- Standard stack: N/A - no external stack, in-repo only
- Architecture (items A, B, E): HIGH - every mechanism read in full, wiring confirmed via grep against release.sh/doctor.cjs
- Architecture (item C): HIGH mechanism / MEDIUM scope-priority - code is unambiguous, but its relevance to the "less like Larry" symptom is genuinely questionable (flagged as Open Question 2)
- Architecture (item D): MEDIUM-LOW - best candidate found and verified (`sessionEndQuorum`), but CONTEXT.md does not name it explicitly and a second candidate (canon prose) was not ruled out (Open Question 3)
- Pitfalls: HIGH - each pitfall traces to a specific verified code/doc finding, not speculation

**Research date:** 2026-07-02
**Valid until:** This is an in-repo, fast-moving codebase (all five target phases shipped THE SAME DAY as this research). Treat findings as valid only through the start of phase-210 execution; re-grep `check-shape-declaration.cjs` and `check-card-fire.cjs` for any same-day drift before the planner locks task file:line references.
