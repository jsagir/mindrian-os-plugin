---
phase: 118-30-second-mva-reward-before-investment
plan: "05"
slug: footer-routing
type: execute
wave: 4
depends_on: ["03", "04"]
files_modified:
  - lib/core/mva-option-router.cjs
  - lib/core/mva-option-router.test.cjs
  - commands/mva-option.md
  - skills/mva-pipeline/SKILL.md
  - lib/conversation/operator.cjs
  - lib/conversation/operator.test.cjs
autonomous: true
requirements: [MVA-118-21, MVA-118-22, MVA-118-23]
canon_parts: [Part 2, Part 3, Part 10]
beta_target: v1.13.0-beta.17
estimated_hours: 5-7
gap_closure: false

must_haves:
  truths:
    - "When the user types 1, 2, or 3 (or '/mos:mva-option 1' etc.) after the brief renders, the option-router fires the correct routing behavior"
    - "The option-router can auto-discover the current brief sha8 via resolveCurrentSha8() which reads ~/.mindrian/mva/state.json (written by Plan 118-03 orchestrator after mva_brief_rendered emission); /mos:mva-option therefore accepts an optional sha8 arg and falls back to auto-discovery when omitted"
    - "Option 1 transitions the conversation operator to JUST_TALK mode (Phase 99 substrate) and keeps the brief in scrollback"
    - "Option 2 surfaces the Phase 119 stub message (per binding decision B6 OPTION A) -- a clean explanatory hint that points to beta.18; does NOT attempt to invoke /mos:new-project"
    - "Option 3 invokes /mos:challenge-assumptions in METHODOLOGY mode, with the brief's sha8 passed as context"
    - "Each option click emits an mva_option_selected telemetry event with option_id + time_to_click_ms (measured from mva_brief_rendered event timestamp)"
    - "The router reads the side-file ~/.mindrian/mva/briefs/<sha8>.json (written by Plan 118-04) to access structured brief data when needed"
    - "Free-text (any input other than 1/2/3) is NOT handled by this router -- Larry routes free-text through normal conversation flow per the SKILL.md instructions"
  artifacts:
    - path: lib/core/mva-option-router.cjs
      provides: "routeOption(optionId, sha8, opts) -> Promise<{ action, message, next_state? }>. Pure dispatch logic; no I/O beyond telemetry and operator transition. ALSO exports resolveCurrentSha8() which reads ~/.mindrian/mva/state.json (the manifest atomically written by Plan 118-03 orchestrator after mva_brief_rendered emission) and returns the latest sha8 -- used when /mos:mva-option is invoked without an explicit sha argument."
      exports: ["routeOption", "resolveCurrentSha8", "OPTION_BEHAVIOR", "STUB_MESSAGE_119"]
    - path: lib/core/mva-option-router.test.cjs
      provides: "Tests for the 3 option paths + telemetry emission + operator transitions + invalid-option handling + resolveCurrentSha8 reading state.json (CRITICAL-3 part 2)"
      contains: "describe('mva-option-router'"
    - path: commands/mva-option.md
      provides: "/mos:mva-option [<sha8>] -- Larry-invokable wrapper around the router. The <sha8> argument is OPTIONAL: when omitted, the command invokes resolveCurrentSha8() to auto-discover the latest brief from ~/.mindrian/mva/state.json. Frontmatter declares interactive_first_reward: --none (scripting only) because this is a follow-up to an already-delivered reward, not a cold entry."
      contains: "## /mos:mva-option"
    - path: skills/mva-pipeline/SKILL.md
      provides: "EXTENDED from Plan 118-03 -- adds the option-handling instructions section"
      contains: "## Routing the 3-option footer"
    - path: lib/conversation/operator.cjs
      provides: "EXTENDED (small additive change) -- exposes a transitionViaMVAOption(roomDir, optionId) helper that mva-option-router calls; the OPERATORS array is unchanged"
      exports: ["transitionViaMVAOption"]
    - path: lib/conversation/operator.test.cjs
      provides: "Tests for the new transitionViaMVAOption helper"
      contains: "transitionViaMVAOption"
  key_links:
    - from: lib/core/mva-option-router.cjs
      to: lib/conversation/operator.cjs
      via: require + transitionViaMVAOption(roomDir, optionId)
      pattern: 'transitionViaMVAOption'
    - from: lib/core/mva-option-router.cjs
      to: lib/core/mva-telemetry.cjs
      via: require + emit('mva_option_selected', ...)
      pattern: 'mva_option_selected'
    - from: lib/core/mva-option-router.cjs
      to: ~/.mindrian/mva/briefs/<sha8>.json
      via: fs.readFileSync (side-file from Plan 118-04)
      pattern: 'briefs.*\.json'
    - from: lib/core/mva-option-router.cjs
      to: "~/.mindrian/mva/state.json"
      via: "resolveCurrentSha8() reads the manifest written by Plan 118-03 orchestrator's atomic tmp+rename after mva_brief_rendered emission -- CRITICAL-3 wire (part 2)"
      pattern: 'state\.json'
    - from: commands/mva-option.md
      to: lib/core/mva-option-router.cjs
      via: "Skill instructions tell Larry to invoke via Bash + scripts/mva-option-run.cjs OR direct Node call; sha8 arg optional, auto-resolved via resolveCurrentSha8()"
      pattern: 'mva-option-router'
    - from: skills/mva-pipeline/SKILL.md
      to: commands/mva-option.md
      via: "Skill body references the slash command for option routing"
      pattern: 'mva-option'
---

<wave_summary>
**Wave 4 placement (WARN-1):** This plan was promoted from Wave 3 to Wave 4 because skills/mva-pipeline/SKILL.md is EXTENDED here (Task 3 appends the "## Routing the 3-option footer" section) and is also CREATED/extended by Plan 118-03 in Wave 2. Running Plan 118-05 in Wave 3 alongside Plan 118-04 (also Wave 3) would race on SKILL.md if either also touched the file. Pinning to Wave 4 makes the SKILL.md edits sequential after both Plan 118-03 (Wave 2; creates SKILL.md) AND Plan 118-04 (Wave 3; does NOT touch SKILL.md but its orchestrator write of state.json is the CRITICAL-3 wire this plan depends on). The depends_on list `["03", "04"]` therefore reflects two ordering constraints: (1) SKILL.md must already exist with the Plan 118-03 base content, (2) the state.json manifest must already be wired in Plan 118-03's orchestrator (Plan 118-04 doesn't actually own state.json; depends_on includes 04 only for safe Wave 4 sequencing since Plan 118-04 also runs in Wave 3 and the executor reads its outputs to verify the deck side-file shape). Net effect: Wave 4 sequential after Waves 2-3 parallel.
</wave_summary>

<objective>
Wire the 3-option footer routing per binding decision B4 (verbatim footer text) and B6 (Phase 119 sequencing OPTION A -- option-2 ships as a stub that points to beta.18).

Per binding decision B6 (OPTION A locked):
- Option 1: stay in JUST_TALK; brief stays in scrollback; no room creation
- Option 2: surface a clean stub message: "Building a room around this is the next layer; shipping in beta.18 (Phase 119). For now, press option 1 to keep this brief visible, or option 3 to go deeper." NO attempt to invoke /mos:new-project (that wiring lands in Phase 119).
- Option 3: invoke /mos:challenge-assumptions in METHODOLOGY mode against the brief's data

Per CRITICAL-3 part 2 (resolved here): when the user types '1', '2', or '3' (or /mos:mva-option without an explicit sha argument) immediately after a brief renders, the router auto-discovers the latest sha8 via resolveCurrentSha8(), which reads ~/.mindrian/mva/state.json (the manifest atomically written by Plan 118-03 orchestrator after mva_brief_rendered emission). This closes the wire so the user does NOT have to manually paste a sha8 -- the most recent brief is always the target.

Per Canon Part 3 (Tri-Context Decision Gate): the 3-option footer IS a Decision Gate -- it offers a closed-vocabulary choice (1/2/3 maps to verbs from Canon Part 3 vocabulary):
- Option 1 = verb 7 "Synthesize" (collapse back to JUST_TALK; the brief is the synthesis)
- Option 2 = verb 8 "Bank Opportunity" (queue room-creation as a future investment; deferred to Phase 119)
- Option 3 = verb 5 "Devil's Advocate" (invoke /mos:challenge-assumptions)

Per OQ5 lean (settled): option 1 = operator switch to JUST_TALK with brief in scrollback. Option 3 = operator switch to METHODOLOGY + invoke /mos:challenge-assumptions.

Purpose: close the conversion-fix loop. The reward (deck) is delivered; this plan handles the moment of investment-choice (or non-investment-choice). Per Canon Part 10 sub-claim 3, the user self-selects commitment level.

Output: 1 router module + 1 router test + 1 slash command + 1 SKILL.md extension + 1 operator-helper extension + 1 operator-helper test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-03-progressive-streaming-PLAN.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-04-feynman-deck-vercel-PLAN.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/the-30-second-mva.md
@lib/conversation/operator.cjs
@docs/MINDRIAN-CANON.md

<interfaces>
<!-- Contract dependencies -->

From Plan 118-04 (the side-file written when deck deploys):
```typescript
// ~/.mindrian/mva/briefs/<sha8>.json
{
  sha256: string,
  sha8: string,
  timestamp: string,
  results: AgentResult[]  // the 6 agent results
}
```

From Plan 118-03 (the state.json manifest atomically written after mva_brief_rendered emission -- CRITICAL-3 wire):
```typescript
// ~/.mindrian/mva/state.json (atomic tmp+rename write; skipped on Hebrew refusal)
{
  current_sha8: string,      // first 8 chars of sentence_sha256 -- the brief identifier
  current_sha256: string,    // full sentence_sha256
  rendered_at_ms: number,    // Date.now() captured immediately after mva_brief_rendered
  vercel_url: string | null  // populated by Plan 118-04's orchestrator extension after deploy
}
```

This plan's resolveCurrentSha8() reads this file and returns `current_sha8` -- so /mos:mva-option (or any other consumer) can auto-discover the most recent brief without the user manually pasting a sha.

From lib/conversation/operator.cjs (existing; Phase 99 substrate):
```typescript
const OPERATORS = ['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY', 'DECISION_GATE'];
function getCurrent(roomDir): { state: OperatorName, ... };
function transition(roomDir, opts): { ok: boolean, new_state: OperatorName };
// Transition rules (from earlier grep):
// - JUST_TALK -> EXPLORE_CAPTURE on user_message
// - ANY -> METHODOLOGY on mos_command
// - ANY -> BUILD_ROOM (on manual_set; via the routing in operator.cjs)
// - ANY -> JUST_TALK on user_message OR manual_reset
```

The 3-option footer text (binding decision B4, em-dash-free):
```
What now?
  [1] Just tell me what's new         (stay in "tell me" mode)
  [2] Build a room around this        (invest)
  [3] Challenge me -- Devil's Advocate (go deeper cognitively)
```

The Phase 119 stub message (OPTION A locked; verbatim):
```
Building a room around this is the next layer; shipping in beta.18 (Phase 119).
For now, press option 1 to keep this brief visible, or option 3 to go deeper.
```

From Plan 118-03 telemetry schema:
```typescript
event: 'mva_option_selected';
fields: { sentence_sha256, option_id: 1|2|3, time_to_click_ms };
```

`time_to_click_ms` is computed from the mva_brief_rendered event timestamp (logged in mva.jsonl by Plan 118-03's orchestrator). The router reads the last mva_brief_rendered event for this session and computes the delta.
</interfaces>

<reference_only>
- Source spec lines 94-103 (the 3-option footer; verbatim from binding decision B4)
- Canon Part 3 (the 10-verb vocabulary; options map to verbs 7, 8, 5)
- Canon Part 10 sub-claim 3 (user self-selects commitment level)
- feedback_larry_pedagogical_guided_first.md (option-3 = Devil's Advocate = GUIDED challenge, not autonomous critique)
- feedback_no_emdashes.md (`--` not `—` in all rendered text)
- lib/conversation/operator.cjs (Phase 99 substrate; we extend it minimally)
</reference_only>
</context>

<open_questions>
**OQ5 (resolved by this plan):** Option-1 = JUST_TALK + brief in scrollback. Option-3 = METHODOLOGY + /mos:challenge-assumptions.

**OQ6 (carry-forward to Plan 118-06):** Dror 2.0 acceptance test runner. This plan emits mva_option_selected event with time_to_click_ms -- Plan 118-06's Dror 2.0 harness reads these events to validate "subject types one sentence and clicks an option within 60 seconds of brief rendering."

**OQ16 (NEW, this plan): What if the user clicks an option BEFORE the brief finishes rendering?**
- Scenario: 6 agents are still streaming; user types '1' mid-stream.
- LEAN: the option-router checks if mva_brief_rendered event has been emitted yet for this session. If not, it returns a friendly "Brief is still rendering -- options will activate when it completes" message. The user-typed '1' is acknowledged but not routed.
- Alternative: cancel the in-flight pipeline and immediately route the option. Riskier (partial state). Lean against.

**OQ17 (NEW, this plan): How does the user actually "click" the option from the terminal?**
- The 3-option footer is text in scrollback. The user can:
  (a) Type '1', '2', or '3' as a plain message -- Larry recognizes it via the SKILL.md skill instruction and invokes /mos:mva-option <N>
  (b) Type '/mos:mva-option 1' directly
- LEAN: both paths work. The SKILL.md instructs Larry: "if the user's next message after a brief renders is exactly '1', '2', or '3' (or starts with one of those), treat it as an option selection and invoke /mos:mva-option <N>". For any other free-text, Larry handles normally.

**OQ18 (NEW, this plan): For option-2 stub, do we still emit the mva_option_selected telemetry event?**
- YES. We need the telemetry to measure conversion rate even when the path is stubbed (proves users WERE interested in option-2 -- valuable for Phase 119 prioritization).
</open_questions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Operator transition helper</name>
  <files>lib/conversation/operator.cjs, lib/conversation/operator.test.cjs</files>
  <behavior>
    Tests (RED first):
    - Test 1: transitionViaMVAOption(roomDir, 1) -> calls existing transition() with trigger 'manual_reset' (which is one of the JUST_TALK transition triggers per the existing rules). Operator state becomes JUST_TALK. Returns { ok: true, new_state: 'JUST_TALK', from: <prev_state> }.
    - Test 2: transitionViaMVAOption(roomDir, 2) -> does NOT transition the operator (option-2 is a stub; no state change yet). Returns { ok: true, new_state: <unchanged>, no_transition: true, reason: 'option_2_stub' }.
    - Test 3: transitionViaMVAOption(roomDir, 3) -> transitions to METHODOLOGY via trigger 'mos_command'. Operator state becomes METHODOLOGY. Returns { ok: true, new_state: 'METHODOLOGY', from: <prev_state> }.
    - Test 4: transitionViaMVAOption(roomDir, 99) (invalid option) -> returns { ok: false, error: 'invalid_option', valid_options: [1, 2, 3] }. Operator state unchanged.
    - Test 5: All existing operator tests in operator.test.cjs still pass (no regression). Verify the 9 existing transition rules still work.

    Run: `node --test lib/conversation/operator.test.cjs` passes all existing + 4 new tests.
  </behavior>
  <action>
    Step 1 (RED): Add tests 1-4 to lib/conversation/operator.test.cjs. Use a temp room dir (os.tmpdir()) so we don't pollute real rooms.

    Step 2 (GREEN): Add transitionViaMVAOption to lib/conversation/operator.cjs as a thin wrapper around existing transition() function.

    ```javascript
    function transitionViaMVAOption(roomDir, optionId) {
      if (![1, 2, 3].includes(optionId)) {
        return { ok: false, error: 'invalid_option', valid_options: [1, 2, 3] };
      }
      const before = getCurrent(roomDir);
      if (optionId === 1) {
        const result = transition(roomDir, { trigger: 'manual_reset', target: 'JUST_TALK' });
        return { ok: result.ok, new_state: result.new_state, from: before.state };
      }
      if (optionId === 2) {
        // Stub: no transition. Phase 119 will wire BUILD_ROOM here.
        return { ok: true, new_state: before.state, no_transition: true, reason: 'option_2_stub' };
      }
      if (optionId === 3) {
        const result = transition(roomDir, { trigger: 'mos_command', target: 'METHODOLOGY' });
        return { ok: result.ok, new_state: result.new_state, from: before.state };
      }
    }
    module.exports = { ...existing_exports, transitionViaMVAOption };
    ```

    Step 3: Run all operator.test.cjs tests; verify no regression.

    Note: this is a SMALL additive change. Do NOT modify the OPERATORS array. Do NOT modify the 9 existing transition rules. Just add the helper.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/conversation/operator.test.cjs</automated>
  </verify>
  <done>
    - 4 new tests pass.
    - All pre-existing operator tests pass (no regression).
    - transitionViaMVAOption is exported as a top-level function from operator.cjs.
    - OPERATORS array unchanged (verify via test that asserts OPERATORS.length === 5 and contents match).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Option router module + resolveCurrentSha8</name>
  <files>lib/core/mva-option-router.cjs, lib/core/mva-option-router.test.cjs</files>
  <behavior>
    Tests (RED first):
    - Test 1: routeOption(1, 'ab3c1234') -> reads ~/.mindrian/mva/briefs/ab3c1234.json (side-file from Plan 118-04); calls transitionViaMVAOption(roomDir, 1); emits mva_option_selected telemetry with option_id=1; returns { action: 'stay_in_just_talk', message: '<Larry-voiced acknowledgment>', next_state: 'JUST_TALK' }.
    - Test 2: routeOption(2, sha8) -> emits mva_option_selected with option_id=2; returns { action: 'phase_119_stub', message: STUB_MESSAGE_119, next_state: <unchanged> }. STUB_MESSAGE_119 contains "shipping in beta.18 (Phase 119)" verbatim.
    - Test 3: routeOption(3, sha8) -> emits mva_option_selected with option_id=3; transitions to METHODOLOGY; returns { action: 'invoke_challenge_assumptions', message: '<Larry-voiced bridge>', next_state: 'METHODOLOGY', invoke_command: '/mos:challenge-assumptions --from-brief ab3c1234' }.
    - Test 4: routeOption with no side-file (sha8 doesn't exist) -> returns { ok: false, error: 'brief_not_found', message: '...the brief data has expired or was not deployed...' }. Telemetry NOT emitted.
    - Test 5: routeOption when last mva_brief_rendered event in mva.jsonl is missing -> per OQ16 lean, returns { ok: false, error: 'brief_still_rendering', message: 'Brief is still rendering -- options will activate when it completes' }.
    - Test 6: time_to_click_ms is computed from the most recent mva_brief_rendered event timestamp for this sha256 in mva.jsonl. Verify by writing a fake mva.jsonl with mva_brief_rendered at t=1000000, then calling routeOption(1, sha8) and asserting the emitted event has time_to_click_ms approximately equal to (now - 1000000).
    - Test 7: All 3 option messages are em-dash-free.
    - Test 8: routeOption(99, sha8) -> returns { ok: false, error: 'invalid_option' }. No telemetry. No state transition.
    - Test 9: OPTION_BEHAVIOR is a frozen object documenting each option's contract.
    - Test 10 (CRITICAL-3 part 2 -- resolveCurrentSha8 acceptance): Write a fake ~/.mindrian/mva/state.json with { current_sha8: 'ab3c1234', current_sha256: '<full hash>', rendered_at_ms: <now>, vercel_url: 'https://mos-brief-ab3c1234-xyz.vercel.app' }. Call resolveCurrentSha8() and assert it returns 'ab3c1234'. Then invoke a router-end-to-end flow by simulating "/mos:mva-option 2" with NO explicit sha argument -- the command's wrapper logic should call resolveCurrentSha8() to discover the sha, then routeOption(2, 'ab3c1234') fires correctly. Assert that the mva_option_selected telemetry event carries the resolved sha256 (matching the state.json value).
    - Test 11 (CRITICAL-3 part 2 -- resolveCurrentSha8 fallback): When ~/.mindrian/mva/state.json does NOT exist (e.g., fresh install, or Hebrew refusal path which doesn't write state.json), resolveCurrentSha8() returns null. The /mos:mva-option wrapper then surfaces a "no recent brief found -- fire a new sentence to create one" message. routeOption is NOT called (avoid wasted error path on a null sha8).
    - Test 12 (CRITICAL-3 part 2 -- resolveCurrentSha8 staleness handling): When state.json exists BUT rendered_at_ms is more than 30 minutes old (configurable threshold), resolveCurrentSha8() still returns the sha8 (the file is the latest known state; staleness is the router's concern, not the resolver's). Downstream, routeOption can still fail with brief_not_found if the side-file has been cleaned up. This separation keeps resolveCurrentSha8 purely concerned with state-file reading; expiration semantics belong to routeOption.

    Run: `node --test lib/core/mva-option-router.test.cjs` passes all 12.
  </behavior>
  <action>
    Step 1 (RED): Write tests 1-12. Setup: write a fake side-file at ~/.mindrian/mva/briefs/<sha8>.json (or override HOME for test isolation). Write a fake mva.jsonl with one mva_brief_rendered event. Write a fake ~/.mindrian/mva/state.json for tests 10-12.

    Step 2 (GREEN): Implement lib/core/mva-option-router.cjs.

    ```javascript
    'use strict';
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const { transitionViaMVAOption } = require('../conversation/operator.cjs');
    const telemetry = require('./mva-telemetry.cjs');

    const STUB_MESSAGE_119 = "Building a room around this is the next layer; shipping in beta.18 (Phase 119).\nFor now, press option 1 to keep this brief visible, or option 3 to go deeper.";

    const OPTION_BEHAVIOR = Object.freeze({
      1: { action: 'stay_in_just_talk', next_operator: 'JUST_TALK', narrative: 'Keeping the brief in scrollback. Ask me anything about what you just saw.' },
      2: { action: 'phase_119_stub', next_operator: null, narrative: STUB_MESSAGE_119 },
      3: { action: 'invoke_challenge_assumptions', next_operator: 'METHODOLOGY', narrative: 'Going deeper. I will pull the brief into a Devil\'s Advocate pass.' }
    });

    /**
     * CRITICAL-3 part 2 wire: read the state.json manifest atomically written by
     * Plan 118-03's orchestrator after mva_brief_rendered. Returns the latest sha8,
     * or null if the manifest doesn't exist (fresh install / Hebrew refusal path).
     *
     * This is what makes /mos:mva-option <N> (without an explicit sha8 argument)
     * work: the wrapper calls resolveCurrentSha8() to auto-discover the most recent
     * brief, then routeOption(N, sha8) fires with the resolved value.
     */
    function resolveCurrentSha8() {
      try {
        const statePath = path.join(os.homedir(), '.mindrian', 'mva', 'state.json');
        if (!fs.existsSync(statePath)) return null;
        const manifest = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        return manifest && typeof manifest.current_sha8 === 'string' ? manifest.current_sha8 : null;
      } catch {
        return null;
      }
    }

    function _readSideFile(sha8) {
      try {
        const p = path.join(os.homedir(), '.mindrian', 'mva', 'briefs', sha8 + '.json');
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch { return null; }
    }

    function _readLastBriefRenderedEvent(sha256) {
      try {
        const p = path.join(os.homedir(), '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const evt = JSON.parse(lines[i]);
          if (evt.event === 'mva_brief_rendered' && evt.sentence_sha256 === sha256) return evt;
        }
        return null;
      } catch { return null; }
    }

    async function routeOption(optionId, sha8, opts={}) {
      if (![1, 2, 3].includes(optionId)) {
        return { ok: false, error: 'invalid_option', valid_options: [1, 2, 3] };
      }
      const brief = _readSideFile(sha8);
      if (!brief) {
        return { ok: false, error: 'brief_not_found', message: 'The brief data has expired or was not deployed. Type your sentence again to re-fire the pipeline.' };
      }
      const lastRendered = _readLastBriefRenderedEvent(brief.sha256);
      if (!lastRendered) {
        return { ok: false, error: 'brief_still_rendering', message: 'Brief is still rendering -- options will activate when it completes.' };
      }
      const renderedAt = new Date(lastRendered.timestamp).getTime();
      const now = Date.now();
      const time_to_click_ms = Math.max(0, now - renderedAt);

      const roomDir = opts.roomDir || process.cwd();
      const transitionResult = transitionViaMVAOption(roomDir, optionId);
      const behavior = OPTION_BEHAVIOR[optionId];

      telemetry.emit('mva_option_selected', {
        sentence_sha256: brief.sha256,
        option_id: optionId,
        time_to_click_ms,
      });

      const baseReturn = {
        ok: true,
        action: behavior.action,
        message: behavior.narrative,
        next_state: transitionResult.new_state || null,
        time_to_click_ms
      };
      if (optionId === 3) {
        baseReturn.invoke_command = `/mos:challenge-assumptions --from-brief ${sha8}`;
      }
      return baseReturn;
    }

    module.exports = { routeOption, resolveCurrentSha8, OPTION_BEHAVIOR, STUB_MESSAGE_119 };
    ```

    Step 3: Run tests 1-12. Mock side-file, mva.jsonl, AND state.json by writing into a temp HOME dir.

    Step 4: Em-dash sweep on the file source:
    ```bash
    grep "—" lib/core/mva-option-router.cjs
    # Should return 0 matches
    ```
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-option-router.test.cjs</automated>
  </verify>
  <done>
    - All 12 tests pass (9 original + 3 resolveCurrentSha8 for CRITICAL-3 part 2).
    - resolveCurrentSha8() is exported from mva-option-router.cjs and reads ~/.mindrian/mva/state.json.
    - STUB_MESSAGE_119 is em-dash-free and contains "Phase 119" + "beta.18".
    - mva_option_selected telemetry fires for valid options with correct option_id + time_to_click_ms.
    - Invalid options return error WITHOUT emitting telemetry (Test 8).
    - Missing side-file is handled gracefully (Test 4).
    - Brief-still-rendering case is detected and handled (Test 5).
    - Missing state.json returns null cleanly from resolveCurrentSha8 (Test 11).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Slash command + SKILL.md extension</name>
  <files>commands/mva-option.md, skills/mva-pipeline/SKILL.md</files>
  <behavior>
    Tests (added to lib/core/mva-option-router.test.cjs):
    - Test 13: commands/mva-option.md exists with frontmatter declaring:
      - name: mva-option
      - description: ...
      - argument-hint: [<sha8>] (the sha8 argument is OPTIONAL; bracketed in the hint per CLI convention)
      - allowed-tools: Bash
      - interactive_first_reward: --none (scripting only)  <- the linter contract from Plan 118-06
    - Test 14: commands/mva-option.md body contains instructions for the model to invoke routeOption via Bash/Node AND documents that omitting the sha8 argument triggers resolveCurrentSha8() auto-discovery from ~/.mindrian/mva/state.json.
    - Test 15: skills/mva-pipeline/SKILL.md (extended from Plan 118-03) now contains a "## Routing the 3-option footer" section that:
      - Lists the 3 options' verbatim text
      - Documents the recognition rule (next message exactly '1', '2', or '3' is an option selection)
      - Specifies the invocation path (/mos:mva-option <N> -- with optional sha8; auto-resolved otherwise)
      - Includes the "brief still rendering" handling note
    - Test 16: Em-dash sweep: both files contain zero `—` characters.
    - Test 17 (CRITICAL-3 part 2 acceptance integration): simulate a full end-to-end flow: (a) write state.json + side-file + mva.jsonl as if Plan 118-03 + 118-04 had just run; (b) call /mos:mva-option 2 with no sha argument via the wrapper code in commands/mva-option.md (specifically, the Bash invocation pattern documented there); (c) assert the router resolves the correct sha8 from state.json AND emits mva_option_selected telemetry with the resolved sha256. This proves the wire is end-to-end functional.

    Run: `node --test lib/core/mva-option-router.test.cjs` passes all 17.
  </behavior>
  <action>
    Step 1: Create commands/mva-option.md.

    ```markdown
    ---
    name: mva-option
    description: Route the user's 3-option footer selection after a 30-second MVA brief
    argument-hint: <1|2|3> [<sha8>]
    allowed-tools: Bash
    interactive_first_reward: --none (scripting only)
    ---

    # /mos:mva-option <N> [<sha8>]

    Route the user's selection from the 3-option footer that appears after a 30-second MVA brief.

    ## Why this exists
    The 3-option footer renders after every MVA brief. The user types 1, 2, or 3 (or types `/mos:mva-option N` directly). This command dispatches the routing.

    ## Arguments
    - `<N>` (required): 1, 2, or 3 -- the user's selection
    - `[<sha8>]` (optional): the 8-char prefix identifying the target brief. When OMITTED, the command auto-discovers the most recent brief by calling `resolveCurrentSha8()` which reads `~/.mindrian/mva/state.json` (the manifest atomically written by Plan 118-03's orchestrator after mva_brief_rendered fires).

    ## How to invoke
    With explicit sha8:
      `node -e "const r=require('./lib/core/mva-option-router.cjs'); r.routeOption(N, '<sha8>').then(out => console.log(JSON.stringify(out,null,2)))"`

    Without sha8 (auto-resolve):
      `node -e "const r=require('./lib/core/mva-option-router.cjs'); const sha=r.resolveCurrentSha8(); if(!sha){console.log(JSON.stringify({ok:false,error:'no_current_brief',message:'No recent brief found. Type your venture sentence to fire the pipeline.'}));process.exit(0);} r.routeOption(N, sha).then(out => console.log(JSON.stringify(out,null,2)))"`

    ## What happens per option
    - Option 1 -> operator transitions to JUST_TALK; the brief stays in scrollback; user can ask follow-up questions
    - Option 2 -> Phase 119 stub message; operator unchanged; explains beta.18 is the room-creation cut
    - Option 3 -> operator transitions to METHODOLOGY; invoke /mos:challenge-assumptions --from-brief <sha8>

    ## Telemetry
    Each invocation emits mva_option_selected to ~/.mindrian/telemetry/v1.13/mva.jsonl with option_id + time_to_click_ms.
    ```

    Step 2: Extend skills/mva-pipeline/SKILL.md by appending a new section. Open the file (it was created in Plan 118-03), append:

    ```markdown

    ## Routing the 3-option footer (after the brief renders)

    Once /mos:mva-brief (or the orchestrator) has rendered the brief to the user, the user's next message is most likely an option selection. Recognition rule:

    - User types exactly '1', '2', or '3' -> invoke /mos:mva-option <N> (no sha8 argument needed; auto-resolved)
    - User types '/mos:mva-option N' explicitly -> invoke /mos:mva-option <N> (sha8 still optional)
    - User types anything else -> handle as a normal conversation turn (do NOT route through mva-option)

    The sha8 argument is OPTIONAL because the router auto-discovers the most recent brief via resolveCurrentSha8() -> ~/.mindrian/mva/state.json (the manifest written by Plan 118-03's orchestrator after mva_brief_rendered).

    ### Per-option behavior

    Option 1 -- "Just tell me what's new" (stay in tell-me mode):
    - Acknowledgment: "Keeping the brief visible. Ask me anything about what you just saw."
    - Operator: transitions to JUST_TALK
    - Brief stays in scrollback; follow-up questions about any of the 6 cells are welcome

    Option 2 -- "Build a room around this" (invest, deferred):
    - Show the stub message verbatim from STUB_MESSAGE_119: "Building a room around this is the next layer; shipping in beta.18 (Phase 119). For now, press option 1 to keep this brief visible, or option 3 to go deeper."
    - Operator: no transition (option 2 is stubbed for v1.13.0)
    - In v1.13.0-beta.18 (Phase 119), this routes to /mos:new-project --from-brief <sha8>

    Option 3 -- "Challenge me -- Devil's Advocate" (go deeper):
    - Bridge text: "Going deeper. Pulling the brief into a Devil's Advocate pass."
    - Operator: transitions to METHODOLOGY
    - Invoke: /mos:challenge-assumptions --from-brief <sha8>

    ### Edge cases
    - If the brief data has expired (side-file missing): tell the user the brief expired and offer to re-run.
    - If the brief is still rendering: hold the option, tell the user "Brief is still rendering -- options will activate when it completes".
    - If no state.json exists (fresh install, or Hebrew refusal path): tell the user "No recent brief found. Type your venture sentence to fire the pipeline."
    - Invalid option (4, 99, etc.): treat as free-text and route normally.

    ### Do NOT
    - Do NOT autonomously pick an option for the user.
    - Do NOT pre-summarize "what option 2 would do" -- the stub message says it.
    - Do NOT add em-dashes to any rendered option text -- use `--` only.
    ```

    Step 3: Write tests 13-17 as static-file inspections + an end-to-end simulation for Test 17.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-option-router.test.cjs && grep -q "interactive_first_reward" commands/mva-option.md && grep -q "Routing the 3-option footer" skills/mva-pipeline/SKILL.md && grep -q "resolveCurrentSha8" commands/mva-option.md && [ "$(grep -c "—" commands/mva-option.md skills/mva-pipeline/SKILL.md)" = "0" ]</automated>
  </verify>
  <done>
    - All 17 tests pass (12 router + 5 file-inspection / E2E integration).
    - commands/mva-option.md exists with the required frontmatter (including `interactive_first_reward: --none (scripting only)` -- the scripting override per reward-before-investment-rule.md; argument-hint includes optional [<sha8>]).
    - commands/mva-option.md documents the resolveCurrentSha8() auto-discovery path for the sha8-omitted case.
    - skills/mva-pipeline/SKILL.md has the "## Routing the 3-option footer" section appended.
    - Em-dash sweep: zero `—` in both files.
    - The 3 option behaviors are documented verbatim in both the command and the skill.
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. All test files pass:
   `node --test lib/conversation/operator.test.cjs lib/core/mva-option-router.test.cjs`
2. End-to-end option-1 flow: write a fake side-file + a fake mva.jsonl mva_brief_rendered event + fake state.json; call `node -e "const r=require('./lib/core/mva-option-router.cjs'); r.routeOption(1, r.resolveCurrentSha8()).then(r => console.log(r.action))"` -> outputs `stay_in_just_talk`. Telemetry file has one new mva_option_selected event with option_id=1.
3. End-to-end option-2 flow: same setup, optionId=2 -> outputs `phase_119_stub`. Message contains "Phase 119" and "beta.18".
4. End-to-end option-3 flow: optionId=3 -> outputs `invoke_challenge_assumptions` + invoke_command field with `/mos:challenge-assumptions --from-brief ab3c1234`.
5. Em-dash sweep:
   `grep -E "—" lib/core/mva-option-router.cjs commands/mva-option.md skills/mva-pipeline/SKILL.md` returns 0 matches.
6. The OPERATORS array remains unchanged:
   `node -e "console.log(require('./lib/conversation/operator.cjs').OPERATORS)"` outputs the 5 original states.
7. Canon Part 3 invariant: the 3 option labels in OPTION_BEHAVIOR map to Canon Part 3 verbs:
   - Option 1 -> action 'stay_in_just_talk' (verb 7 Synthesize)
   - Option 2 -> action 'phase_119_stub' (verb 8 Bank Opportunity, deferred)
   - Option 3 -> action 'invoke_challenge_assumptions' (verb 5 Devil's Advocate)
   This mapping is documented in OPTION_BEHAVIOR JSDoc comments.
8. CRITICAL-3 part 2 wire check: `node -e "console.log(require('./lib/core/mva-option-router.cjs').resolveCurrentSha8())"` after a successful runPipeline outputs the correct sha8 (read from ~/.mindrian/mva/state.json).
</verification>

<success_criteria>
- All automated tests pass (17 total).
- resolveCurrentSha8() is exported from mva-option-router.cjs and reads ~/.mindrian/mva/state.json (CRITICAL-3 part 2 wire closed).
- /mos:mva-option accepts an OPTIONAL sha8 argument; when omitted, the wrapper auto-resolves via resolveCurrentSha8().
- Option-2 stub message ships verbatim per binding decision B6 OPTION A.
- Operator state transitions correctly per option (1 -> JUST_TALK, 2 -> no change, 3 -> METHODOLOGY).
- mva_option_selected telemetry fires on every valid option click with time_to_click_ms measured from mva_brief_rendered.
- Edge cases (brief not found, brief still rendering, state.json absent, invalid option) all handled with friendly messages.
- Zero new statusline segments (per Phase 121.5 co-design memory rule).
- The OPERATORS array and existing 9 transition rules are unmodified (no Phase 99 regression).
- Em-dash-free across all rendered text and source files.
- Wave 4 placement (WARN-1) honored: depends_on `["03", "04"]`; SKILL.md edits are sequential after Plan 118-03's creation of the file.
- Phase 119 hook is clean: when Phase 119 ships in beta.18, it just needs to replace the option-2 stub action with an invoke_command pointing at /mos:new-project --from-brief <sha8>; no other Plan 118 code changes.
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-05-SUMMARY.md` capturing:
- The 3-option routing table (option_id -> action -> operator transition -> invoke_command)
- The resolveCurrentSha8() contract (reads ~/.mindrian/mva/state.json; returns null on miss) and its role in CRITICAL-3 part 2 wire
- STUB_MESSAGE_119 verbatim text (the Phase 119 sequencing handoff)
- The Canon Part 3 verb mapping (options 1/2/3 -> verbs 7/8/5)
- mva_option_selected telemetry event schema (sentence_sha256, option_id, time_to_click_ms)
- Edge-case handling (brief_not_found, brief_still_rendering, no_current_brief, invalid_option)
- OQ resolutions: OQ5 (option-1=JUST_TALK, option-3=METHODOLOGY), OQ16 (brief-still-rendering held-state), OQ17 (recognize plain '1/2/3' OR explicit slash command), OQ18 (always emit telemetry, including for option-2 stub)
- Tests: 4 operator + 12 router + 5 file-inspection / E2E = 21 tests passing
- Wave 4 placement rationale (WARN-1): SKILL.md serial-edit dependency on Plan 118-03's creation
- Canon Part 3 compliance audit (the footer IS a Decision Gate; the 3 options ARE closed-vocabulary verb selections)
- Canon Part 10 sub-claim 3 implementation note (user self-selects commitment level via 3-option dispatch)
- Carry-forward to 118-06: the mva_option_selected event is the second half of the Dror 2.0 acceptance test (subject types one sentence + clicks an option within 60 seconds; this plan emits the click; Plan 118-06's harness measures the full chain)
- Hook for Phase 119: replace the option-2 stub by updating OPTION_BEHAVIOR[2] to invoke /mos:new-project --from-brief <sha8>; no other refactor needed
</output>
</output>
