# Phase 210: Revert Persona-Enforcement Over-Reach - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 14 modified + 4 created = 18
**Analogs found:** 17 / 18 (item B footer prose has no code-gate analog by design - see No Analog Found)

This is a softening phase: almost every "analog" IS the target file itself, read in its current state, with the exact HARD-FAIL line quoted so the planner can point a task at it. Where a NEW behavior is added (advisory mode, relevance gate, two-directional tests), the closest existing in-repo pattern to copy is named with file:line.

House rules that bind every file below: CJS only, no em-dashes, never `Bash(cat << EOF)`, `node -c` syntax check per edited .cjs, no hardcoded surface counts (RETRO-07c).

## File Classification

| New/Modified File | Op | Role | Data Flow | Closest Analog / Pattern Source | Match Quality |
|-------------------|-----|------|-----------|--------------------------------|---------------|
| `lib/core/gate-relevance.cjs` | CREATE | utility (shared predicate) | transform (pure text-in, verdict-out) | `lib/core/stance-state.cjs` (module shape) + `scripts/check-card-fire.cjs:308-343` (`gateSignature` normalization) | exact (composite) |
| `tests/test-210-relevance-gate.cjs` | CREATE | test (two-directional) | batch | `tests/test-209-incident-replay.cjs` (harness) + `tests/test-reach-gate-stale-turn-input.cjs` (bidirectional shape) | exact |
| `tests/test-210-trailer-relevance.cjs` | CREATE | test | batch | `tests/test-209-incident-replay.cjs:49-62` (assertion a: envelope carries `[BINDING:`) | exact |
| `tests/run-all-210.sh` | CREATE | test aggregator | batch | `tests/run-all-209.sh` (verbatim `run()`/`run_if()` idiom) | exact |
| `scripts/check-card-fire.cjs` | MODIFY (item E-1) | Stop hook / gate | event-driven (transcript-in, block-verdict-out) | itself: `classifyCardFire` at 420-475, `readTranscriptTurn` at 700-774 | exact (self) |
| `lib/hmi/selector-dispatcher.cjs` | MODIFY (item E-2) | render service | transform | itself: `appendAskUserQuestionTrailer` at 551-580 | exact (self) |
| `scripts/stamp-firing-block.cjs` + `commands/*.md` (80 body-stamped) | MODIFY (item E-3) | build tool + command prose | batch (disk sweep) | itself: `STAMP_MARKER` at :46, `runStamp` at :191, `--check` at :244-264 | exact (self) |
| `scripts/check-shape-declaration.cjs` | MODIFY (item A) | build gate | batch (tree scan) | itself: `main()` `--check` branch at 770-790; advisory precedent: `scripts/doctor.cjs:3162-3177` WARN-not-fail idiom | exact (self) |
| `scripts/release.sh` | MODIFY (item A wiring) | build gate wiring | request-response (exit codes) | itself: Step 2 block, lines 308-318 | exact (self) |
| `scripts/doctor.cjs` | MODIFY (item A wiring) | acceptance gate | batch | itself: `coverage-gate` entry at 2766-2810; WARN-not-fail idiom at 3162-3177 (same file) | exact (self) |
| `lib/core/stance-state.cjs` | MODIFY (item B code) | core state module | CRUD (local JSON) | itself: `FORCED_VOICE_COLORS` at 52-55, `forcedVoiceColorForStance` at 134-138 | exact (self) |
| `skills/larry-personality/SKILL.md` | MODIFY (item B prose) | doctrine prose | n/a (model-read text) | itself: lines 134 (footer SHOULD-clause) and 136 (LOCKED mapping prose) | exact (self) |
| `lab/apo/apo-loop.cjs` | MODIFY (item C) | offline lab service | batch (propose-score-select) | itself: disqualifier at 206-235 | exact (self) |
| `lib/core/fusion-router.cjs` | MODIFY (item D) | conversational engine module | event-driven (session boundary) | itself: `sessionEndQuorum` at 476-517 | exact (self) |
| `scripts/check-shape-declaration.test.cjs` | EXTEND | test | batch | itself + `tests/test-canon-entry-36-shape-declaration-floor.cjs` (WATCH: may assert HARD-FAIL doctrine) | exact |
| `tests/test-stance-voice-glyph-override.cjs` | EXTEND | test (doctrine-presence grep) | batch | itself: assertion style at 29-36, 70-72 | exact |
| `tests/test-202-apo-loop.cjs` / `tests/test-202-voice-contract-gate.cjs` | EXTEND | test | batch | themselves | exact |
| `tests/test-205-fusion-router.cjs` | EXTEND | test | batch | itself: Tests 11-12 at 248-281 (the assertions this phase intentionally changes) | exact |

## Pattern Assignments

### Item E-1: `scripts/check-card-fire.cjs` (Stop hook, event-driven)

**The exact line being softened** - `classifyCardFire`, lines 440-470. Today it falls straight from "gate signal present + no card" to `intercept: true` with zero relevance check (only the two retry ceilings intervene):

```javascript
// scripts/check-card-fire.cjs:440-470 (current state, verified 2026-07-03)
if (!primaryHit && !backstopHit) {
  return { intercept: false, reason: 'no-gate-signal', degrade: false };
}
// ... sessionCount >= MAX_SESSION_INTERCEPTS -> degrade (line 448)
// ... retryCount >= MAX_FORCE_RETRIES -> degrade (line 459)
const reason = primaryHit
  ? 'reached-registry-gate-no-card'
  : 'ascii-box-backstop-no-card';
return { intercept: true, reason: reason, degrade: false };   // <- INSERT relevance gate BEFORE this
```

**Insertion point:** the new relevance check goes between line 465 (retry-ceiling degrade) and line 467 (the final `intercept: true`), returning `{ intercept: false, reason: 'gate-already-answered' | 'gate-irrelevant-to-turn', degrade: false }`. NEVER delete the `intercept: true` path (Pitfall 3: `tests/test-209-incident-replay.cjs` must stay green).

**The missing input the relevance gate needs** - `readTranscriptTurn` (lines 700-774) already walks every transcript record but DISCARDS the preceding user text; role:user records only reset the assistant window:

```javascript
// scripts/check-card-fire.cjs:743-749 (current state)
if (role === 'user') {
  // A user record resets the CURRENT-TURN window (T-209-29): ...
  // This is the ONLY use of the user record -- it bounds the window, it is
  // NEVER part of the retry key (CR-03 above).
  currentTurnAssistantContents = [];
  continue;
}
```

**Pattern to copy:** capture the last role:user record's text into a new return field (e.g. `preceding_user_text`) alongside the existing `{ output_text, askuserquestion_fired, gate_signature }` return at lines 769-773. CRITICAL preserve constraint stated in the file itself: user text bounds the window and may feed the RELEVANCE verdict, but must NEVER be folded into `gateSignature`/`turnContextHash` (the CR-03 livelock invariant, lines 358-368 comment block).

**Signature-normalization pattern to reuse (do not reimplement)** - `gateSignature`, lines 308-343, already extracts and normalizes the option-label token set the relevance predicate compares against:

```javascript
// scripts/check-card-fire.cjs:329-338 (the label extraction to reuse)
const OPTION_LABEL_RE = /^\s*(?:\[\s*[1-9]\s*\]|[1-9][).])\s+(.+?)\s*$/;
for (const line of lines) {
  const mm = line.match(OPTION_LABEL_RE);
  if (!mm) continue;
  const norm = mm[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!norm || seen.has(norm)) continue;
  seen.add(norm);
  labelSet.push(norm);
}
```

The predicate ("did the preceding user turn already answer this / is the gate about the current conversation") should compare the normalized preceding-user-text tokens against this SAME label-token normalization - export the label extraction (or a raw-label variant of it) rather than writing a second regex.

**Defensive-envelope pattern (unchanged, but relevant to tests):** `buildEnforcementEnvelope` (487-504) maps `degrade` -> `{continue:true, suppressOutput:true}` and `intercept` -> `decision:'block'`. A relevance-pass verdict rides the existing `intercept:false` path; no envelope change needed.

### CREATE: `lib/core/gate-relevance.cjs` (utility, transform)

**Module-shape analog:** `lib/core/stance-state.cjs` (146 lines) - the house pattern for a small pure core module: `'use strict'`, node built-ins only, doc-header naming Canon Part 8 (LOCAL-only, never throws), frozen constants, pure exported functions, flat `module.exports` map:

```javascript
// lib/core/stance-state.cjs:35-45 + 140-146 (module skeleton to copy)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
// ... pure functions, every one try/caught or input-guarded, never throws ...
module.exports = {
  STANCES,
  readStance,
  writeStance,
  nextStance,
  forcedVoiceColorForStance,
};
```

**Content pattern:** the two relevance legs RESEARCH names - (a) `gateAlreadyAnsweredByUser(precedingUserText, gateLabels)` comparing normalized user tokens against the gate option-label set (reuse `check-card-fire.cjs` label normalization above); (b) a subject-overlap check for the stale-artifact case. Consumed by `classifyCardFire` (required) and optionally `sessionEndQuorum` + `appendAskUserQuestionTrailer`. Pure string work, deterministic, no clock/random/network (match the `classifyCardFire` header contract at lines 395-419).

### Item E-2: `lib/hmi/selector-dispatcher.cjs` (render service, transform)

**Current unconditional minting** - `appendAskUserQuestionTrailer`, lines 551-580:

```javascript
// lib/hmi/selector-dispatcher.cjs:565-567 (current state)
const binding = '[BINDING: call the AskUserQuestion tool in THIS response with the '
  + verbs.length + ' options above; do not reproduce this block as text (SEED-021)]';
rendered.askuserquestion_binding = binding;
```

**Softening pattern:** the marker line (`askuserquestion_marker`, line 557-560) is byte-frozen per its own comment ("do NOT alter shape") - leave it. Only the BINDING imperative (surface 2 + its footer copy at 569-578) becomes conditional/softened. Call sites to check: line 1050 (`appendAskUserQuestionTrailer(result.rendered, result.shape)`) and both export sites (1115, 1131). Note: this function runs in-process at render time BEFORE any user answer can exist for THIS gate, so "already answered" is mostly the Stop-hook's job; the trailer softening is about wording/bindingness (e.g. imperative -> conditional-on-genuine-fork phrasing), which the planner decides per CONTEXT item E.

### Item E-3: `commands/*.md` stamp sweep via `scripts/stamp-firing-block.cjs` (build tool, batch)

**Never hand-edit the 80 files.** The stamp script is the single mutation surface:

```javascript
// scripts/stamp-firing-block.cjs:46 (the machine-detectable marker)
const STAMP_MARKER = '<!-- mos:firing-block v1 -->';
// :66 -- INJECT_BLOCK = '\n\n' + STAMP_MARKER + '\n' + CANONICAL_FIRING_BLOCK + '\n' + STAMP_END;
// :191 runStamp(opts) -> { files, pendingCount, changedCount }  (enumerates commands/*.md from disk)
// :244-264 --check dry-run: exit 1 while pendingCount > 0, exit 0 when clean
```

**Pattern:** soften the `CANONICAL_FIRING_BLOCK` text in ONE place (this script), bump the marker version if the block bytes change (e.g. `mos:firing-block v2`) so `--check`/re-stamp can find-and-replace the old block deterministically, then run the script to sweep all stamped commands. `STAMP_MARKER` is ALSO imported by `check-shape-declaration.cjs:45` (the `wired-body` predicate) - a marker version bump must keep that import green (shared constant, T-209-10). Verify with `node scripts/stamp-firing-block.cjs --check` + `node tests/test-209-stamp-firing-block.cjs`. Live count 80 body-stamped (not 95); enumerate from disk, never hardcode (RETRO-07c).

### Item A: `scripts/check-shape-declaration.cjs` (build gate, batch) + wiring in `release.sh` / `doctor.cjs`

**Scope per resolved Open Question 1 (CONTEXT addendum):** all FOUR checks go advisory - the 190 base declaration-exists check (predicate 5, lines 182-195) AND the three 209-03 predicates: `wired-body` (248-260), `tool-grant` (263-271), `declared-matches-body` (276-284). The hard-fail exit lives in `main()`:

```javascript
// scripts/check-shape-declaration.cjs:770-782 (the exit-1 branch to soften)
if (argv.includes('--check')) {
  const report = checkTree();
  if (!report.ok) {
    console.error('SHAPE DECLARATION VIOLATION:');
    for (const v of report.violations) console.error('  - ' + v);
    console.error('Recovery: run node scripts/backfill-hitl-shape.cjs, ...');
    process.exit(1);          // <- becomes advisory: print WARN block, exit 0
    return;
  }
```

**Advisory-output pattern to mirror** - the codebase's canonical WARN-not-fail idiom, `scripts/doctor.cjs:3172-3177` (agentshield acceptance entry):

```javascript
// scripts/doctor.cjs:3172-3177 (the WARN-not-fail idiom, verbatim)
} else if (result.totalAmbiguous > 0) {
  // WARN-not-fail: ambiguous surfaces surface via the finding string
  // but the blocker stays green (only flagged findings fail the gate).
  finding = 'WARN: ' + result.totalAmbiguous +
    ' ambiguous finding(s) across surfaces (no flagged; blocker not tripped)';
}
```

Recommended shape: keep `checkTree()` and every predicate intact (the lint signal survives), print `WARN:`-prefixed violations, exit 0 in advisory mode. Whether advisory is the new default or behind a flag (`--advisory` default-on / `--strict` opt-in) is the planner's call; either way BOTH wiring sites must agree:

**Wiring site 1 - `scripts/release.sh:308-318` (Step 2).** Current block is a HARD ABORT; the softening edits ONLY this block. DANGER (Anti-pattern from RESEARCH): the adjacent `check-render-coverage.cjs` gate at line 294 and `build-corpus-stats.cjs` at 303 share the same Step-2 region and MUST NOT be touched (Phase 178 / preserve list):

```bash
# scripts/release.sh:314-318 (current state -- the ONLY lines item A may change here)
if ! node "$PLUGIN_DIR/scripts/check-shape-declaration.cjs" --check; then
  echo -e "${RED}ABORT: shape-declaration gate failed -- ...${NC}"
  echo "  Recovery: node scripts/backfill-hitl-shape.cjs, ..."
  exit 1
fi
```

**Wiring site 2 - `scripts/doctor.cjs:2766-2810` (`coverage-gate` acceptance entry, severity 'blocker').** The gates array at 2775-2790 runs four scripts and fails the blocker on any non-zero exit. If the script itself exits 0 in advisory mode, this entry auto-softens with NO doctor edit (the ok test is `r.status === 0` at line 2801) - the cheapest correct path. If instead a `--strict` flag is kept for doctor, the entry needs the explicit WARN-not-fail treatment (3162-3177 idiom above). Note the comment at 2783-2788 ("HARD-FAIL, never WARN (R9)") must be rewritten either way, and `label` at 2767 mentions shape-declaration.

**Documentation shadows to keep honest (flag for planner, doctrine-adjacent):** project `CLAUDE.md` Part 11 bullet ("enforced HARD-FAIL by scripts/check-shape-declaration.cjs"), `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`, and `tests/test-canon-entry-36-shape-declaration-floor.cjs` (a canon-floor doctrine test that may grep for the HARD-FAIL language - run it after the edit; if it asserts hard-fail wording, that is a navigator-gated canon-adjacent change per RESEARCH's canon-checkpoint rule).

**Test to extend:** `scripts/check-shape-declaration.test.cjs` (exists; fixture-driven via `check()`/`checkAll()` - the pure predicates stay intact so most of it should pass unchanged; add advisory-exit-code assertions).

### Item B: `lib/core/stance-state.cjs` + `skills/larry-personality/SKILL.md` (two mechanisms, both needed - Pitfall 4)

**Mechanism 1 (code): the LOCKED glyph mapping** - `lib/core/stance-state.cjs:52-55` and 134-138:

```javascript
// lib/core/stance-state.cjs:52-55 (current LOCKED mapping)
const FORCED_VOICE_COLORS = Object.freeze({
  redteam: 'red',
  'tell-act': 'blue',
});
// :134-138
function forcedVoiceColorForStance(stance) {
  return Object.prototype.hasOwnProperty.call(FORCED_VOICE_COLORS, stance)
    ? FORCED_VOICE_COLORS[stance] : null;
}
```

**Consumer (read-only, degrade-safe already):** `lib/statusline/cockpit-signals.cjs:249-265` (`readStanceState`) - it try/catch-degrades to `{stance:null, forced_voice_color:null}` and `lib/statusline/cockpit-renderer.cjs:336` treats a non-null forced color as an OVERRIDE of natural detection. Softening pattern per CONTEXT ("glyph stays the default/recommended choice, not a hard contract violation"): the cleanest seam is renaming semantics from FORCED to DEFAULT/RECOMMENDED at the consumer (renderer prefers the stance color but natural detection may win when the turn's shape genuinely doesn't fit), OR keeping the function but letting the renderer treat it as a preference. Both consumers degrade safely on null, so no new failure mode. Existing tests to keep green: `tests/test-stance-state.cjs` (pure function), `tests/test-192-statusline-stance-chip.cjs` (chip rendering).

**Mechanism 2 (prose): the near-universal footer SHOULD-clause** - `skills/larry-personality/SKILL.md:134` (current, the over-reach is the practical universality of "when it is not already the most recent line"):

```markdown
**Offered every turn, never forced.** Larry's Action Footer / closing line SHOULD name the
one-keystroke stance-flip affordance `/mos:stance` when it is not already the most recent line,
but it NEVER forces the flip.
```

And line 136 carries the "The two forced mappings are LOCKED" language that must move to default/recommended wording in lockstep with mechanism 1. **Prose-edit pattern:** tighten the SHOULD-condition to genuine relevance (navigator is mid-decision about conversational mode), matching how line 125 already scopes the toggle ("changes nothing until the navigator sets it").

**Test analog (doctrine-presence grep suite)** - `tests/test-stance-voice-glyph-override.cjs`; its assertions at lines 70-72 grep for the exact clauses being changed and WILL need updating in the same task:

```javascript
// tests/test-stance-voice-glyph-override.cjs:70-72 (assertions the prose edit must re-point)
check(/offered[^\n]*never forced|never forced|offered, never forced/i.test(sectionText), '...offered-never-forced rule');
check(/every[- ]turn|each turn|Action Footer|footer/i.test(sectionText), '...every-turn footer-offer requirement');
check(/\/mos:stance/.test(sectionText), '...names the /mos:stance affordance');
```

Its `check(cond, msg)` counter idiom (lines 29-36) is the house pattern for any new doctrine-presence assertions.

### Item C: `lab/apo/apo-loop.cjs` (offline lab tool, batch - small task per resolved Open Question 2)

**Current veto** - lines 206-235:

```javascript
// lab/apo/apo-loop.cjs:210-214 (the disqualifier), :232/:235 (the veto filters)
const output = c && c.output != null ? String(c.output) : null;
const voice = output != null
  ? checkVoiceContract(output, ctx.voiceOpts || {})
  : { pass: true, violations: [] };
const disqualified = voice.pass !== true;
// ...
runningBest = selectBest(candidates.filter((c) => !c.disqualified));  // :232
const best = selectBest(candidates.filter((c) => !c.disqualified));   // :235
```

**Softening pattern (RESEARCH-recommended, mechanical):** drop the `.filter()` veto; fold `voice.violations.length` as a negative term into the score instead. The selection function already gives a natural seam - `selectBest` (141-151) is quality-lexicographic (`quality` first, `score` tiebreak), so the planner chooses whether violations dent `quality` (keeps primacy structural) or `score` (signal-only). Keep `voiceViolations` + a renamed flag in the span record (245-253) so the human running the loop still SEES the signal. `checkVoiceContract` itself (`lab/apo/voice-contract-gate.cjs:88-128`, returns `{ pass, violations[] }`) is untouched - it stays the detector; only its veto power in the loop goes. Tests to extend: `tests/test-202-apo-loop.cjs`, `tests/test-202-voice-contract-gate.cjs`.

### Item D: `lib/core/fusion-router.cjs::sessionEndQuorum` (conversational engine - per resolved Open Question 3)

**Current force** - lines 476-517; the force fires on a bare frame-count threshold with zero relevance input:

```javascript
// lib/core/fusion-router.cjs:481-489 (the trigger) and :510-516 (the force)
if (frames.length < 2 || alreadyFired) {
  return { forced: false, reason: ..., frames_live: frames.length, ... };
}
// ...
return {
  forced: true,
  count: 1, // EXACTLY one offered hypothesis (D-Q1).
  hypothesis,
  ...
};
```

**Softening pattern:** relax force-pick to suggestion/default (navigator-confirmed target). Preserve what is already soft and must stay: `hypothesis.offered:true, committed:false, hedged:true` (T-205-07-E, lines 499-509 - never auto-committed, no edge written). The change is the `forced:true` semantics: gate it on a relevance/confidence signal (optionally via the shared `gate-relevance.cjs`) or downgrade the field itself (e.g. `forced:false, suggested:true`), planner's pick. **Do NOT touch** `lib/core/persona-taxonomy.cjs::resolveElevationLean` - already soft by its own comments ("a bias, NOT a quota"), explicitly out of scope (Pitfall 5).

**Assertions this phase intentionally changes** - `tests/test-205-fusion-router.cjs:248-281`:

```javascript
// tests/test-205-fusion-router.cjs:259-263 (Test 11 -- the assertions to re-point)
assert.equal(q.forced, true, 'quorum forces a hypothesis');
assert.equal(q.count, 1, 'EXACTLY one offered hypothesis (D-Q1)');
assert.equal(q.hypothesis.offered, true, ...);
assert.equal(q.hypothesis.committed, false, 'NEVER auto-committed as a decision (T-205-07-E)');
// Test 12 (:267-281): horizontalFiredThisSession:true -> forced:false -- KEEP as-is
```

Test 11's `forced === true` line changes; the `committed === false` and Test 12 zero-force assertions are preserve-floor.

### CREATE: `tests/test-210-relevance-gate.cjs` (two-directional test, item E-1)

**Analog 1 - the bidirectional shape** (`tests/test-reach-gate-stale-turn-input.cjs`, the already-fixed sibling bug): three-legged structure that this phase's constraint mandates - (1) the fix is present, (2) reactivity/differentiation, (3) the OLD behavior is preserved where it should be:

```javascript
// tests/test-reach-gate-stale-turn-input.cjs:59-85 (the three-directional skeleton to copy)
// (1) the current turn is present AND is the freshest (tail) line.
const igniteSeed = runChild('ignite');
assert.ok(igniteSeed.includes('ignite'), '(1) ... (the fix)');
// (2) two different current turns, identical history -> different seeds (reactivity).
const showSeed = runChild('please show me the deck');
assert.notEqual(igniteSeed, showSeed, '(2) ...');
// (3) empty current turn degrades to the byte-identical pre-fix history-only seed.
const emptySeed = runChild(null);
assert.equal(emptySeed, PRIOR, '(3) ... (no regression)');
```

Mapped to item E: (1) already-answered gate -> `intercept:false`; (2) irrelevant stale gate -> `intercept:false`; (3) genuine unanswered relevant fork -> `intercept:true` STILL (the Phase 209 guarantee, the reverse-regression floor).

**Analog 2 - the transcript-fixture harness** (`tests/test-209-incident-replay.cjs:69-118`): how to synthesize a Stop-hook turn end-to-end - write a JSONL transcript to a tmp dir, isolate side-channels, call the exported `deriveTurnSignals` + `loadRegistry` + `classifyCardFire`:

```javascript
// tests/test-209-incident-replay.cjs:81-116 (the harness idiom to copy verbatim)
fs.writeFileSync(transcriptPath, [
  JSON.stringify({ type: 'user', message: { role: 'user', content: 'Can we resume work on the align-ecosystem room?' } }),
  JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [
    { type: 'text', text: cardText },
    { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
  ] } }),
].join('\n') + '\n', 'utf8');
const env = { hook_event_name: 'Stop', session_id: '...', transcript_path: transcriptPath };
const origHome = process.env.MINDRIAN_HOME;
process.env.MINDRIAN_HOME = retryHome;
try {
  const turn = checkCardFire.deriveTurnSignals(env);
  const verdict = checkCardFire.classifyCardFire(turn, checkCardFire.loadRegistry());
  assert.equal(verdict.intercept, false, ...);
} finally { /* restore env, rm tmp */ }
```

Two mandatory hermetic-isolation idioms from the same file: `MINDRIAN_HOME` re-point for the retry side-file (101-116) and `CARD_FIRE_SIDECHANNEL_PATH` tmp isolation for the whole file (36-37, the T-209-25 idiom - documented cross-session leak otherwise). The already-answered fixture: a user record whose content plainly answers the gate labels ("yes" to the immediately preceding question - the live incident shape from CONTEXT grounding point 3), followed by an assistant record with gate-shaped text and NO tool_use.

### CREATE: `tests/test-210-trailer-relevance.cjs` (item E-2)

Copy the incident-replay assertion (a) pattern (`tests/test-209-incident-replay.cjs:49-62`): call `insightSensors.dispatchSensors` (or `appendAskUserQuestionTrailer` directly via its export at `lib/hmi/selector-dispatcher.cjs:1115`) and assert on the envelope string. Two directions: a genuine fork envelope still carries the (softened) trailer; the frozen `[AskUserQuestion contract:` marker stays byte-identical in ALL cases (line 557's "do NOT alter shape" contract).

### CREATE: `tests/run-all-210.sh` (aggregator - explicit CONTEXT requirement)

Copy `tests/run-all-209.sh` verbatim idiom (`set -uo pipefail`, ROOT cd, PASS/FAIL/SKIP counters, `run()`/`run_if()` at lines 25-41, final `[ "$FAIL" -eq 0 ]`). Pre-declare ALL legs up front (the 209 convention: "all nine legs are pre-declared here ... so no later-wave plan ever edits this runner"). Legs: test-210-relevance-gate, test-210-trailer-relevance, plus the extended per-item suites (check-shape-declaration.test.cjs, test-stance-voice-glyph-override, test-202-apo-loop, test-202-voice-contract-gate, test-205-fusion-router, test-209-incident-replay as the preserve-floor leg, test-209-stamp-firing-block, stamp --check).

## Shared Patterns

### Advisory / WARN-not-fail (apply to items A, and any gate downgrade)
**Source:** `scripts/doctor.cjs:3172-3177` (excerpt above) - print `WARN:`-prefixed finding, keep exit/ok green. Sibling precedent for hooks: the codebase-wide "hook is advisory, always exit 0" contract (`scripts/frontmatter-schema-validator.cjs`, `scripts/query-efficiency-telemetry.cjs`, `scripts/intent-classifier.cjs:153` "never hard-blocks the turn - the 83-07 never-block contract").

### Never-throws / degrade-to-null core module (apply to gate-relevance.cjs)
**Source:** `lib/core/stance-state.cjs:75-87` (try/catch -> null) and `scripts/check-card-fire.cjs:471-474` (predicate catch -> safe no-op verdict). Every new predicate must be pure, deterministic, and unable to throw out of the hook path.

### Two-directional regression test (apply to EVERY softened gate - CONTEXT constraint)
**Source:** `tests/test-reach-gate-stale-turn-input.cjs` (three-legged skeleton, excerpt above). Each item's task acceptance must assert BOTH: false-positive no longer blocks AND true-positive still blocks/fires. The preserve-floor for item E is `tests/test-209-incident-replay.cjs` passing unmodified.

### Enumerate-from-disk, never hardcode counts (apply to item E-3 and all sweep verification)
**Source:** `scripts/stamp-firing-block.cjs:191-237` (`runStamp` scans `commands/*.md` live) and `check-shape-declaration.cjs:625-659` (`collectSurfaces`). RETRO-07c: 95-vs-80 already drifted within one session.

### CR-03 retry-key invariant (constraint on item E-1, not a pattern to copy)
**Source:** `scripts/check-card-fire.cjs:358-368, 743-749.` The preceding user text may feed the RELEVANCE verdict but must never enter `gateSignature`/`turnContextHash`. And the `MAX_FORCE_RETRIES`/`MAX_SESSION_INTERCEPTS` bounded escape (169, 189) is DoS protection (T-179-01) - preserve untouched.

## No Analog Found

| Concern | Role | Reason | Fallback |
|---------|------|--------|----------|
| "Conditional-on-relevance footer offer" prose wording (item B mechanism 2) | doctrine prose | No existing SKILL.md clause conditions an every-turn behavior on conversational relevance; this is the first | Write fresh prose per RESEARCH Pitfall 4 guidance (tighten the SHOULD-condition to "navigator is mid-decision about conversational mode"); verify via the extended doctrine-presence grep suite |

Everything else in this phase has an exact in-repo pattern (mostly the target file's own current state).

## Metadata

**Analog search scope:** `scripts/`, `lib/core/`, `lib/hmi/`, `lib/statusline/`, `lab/apo/`, `tests/`, `skills/larry-personality/`, `commands/` (stamp grep only)
**Files read this pass:** 15 (targeted, non-overlapping ranges; line numbers verified live 2026-07-03)
**Pattern extraction date:** 2026-07-03
**Drift warning honored:** RESEARCH.md's "valid until phase start" caveat - every file:line above was re-verified against HEAD this session, not copied from RESEARCH.
