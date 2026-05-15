---
phase: 118-30-second-mva-reward-before-investment
plan: "03"
slug: progressive-streaming
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - lib/core/mva-progressive-renderer.cjs
  - lib/core/mva-progressive-renderer.test.cjs
  - lib/core/mva-orchestrator.cjs
  - lib/core/mva-orchestrator.test.cjs
  - lib/core/mva-telemetry.cjs
  - lib/core/mva-telemetry.test.cjs
  - commands/mva-brief.md
  - scripts/mva-run.cjs
  - skills/mva-pipeline/SKILL.md
autonomous: true
requirements: [MVA-118-13, MVA-118-14, MVA-118-15, MVA-118-16]
canon_parts: [Part 2, Part 8, Part 10]
beta_target: v1.13.0-beta.17
estimated_hours: 6-9
gap_closure: false

must_haves:
  truths:
    - "When the dispatcher yields a successful AgentResult, the user sees a Larry-voiced 1-2 line summary appended to the terminal within ~200ms of the agent returning"
    - "If 0 agents succeed within 45s, the user sees the sharp-question fallback: 'I didn't find precedents for this in 30 seconds. That's either a gap in my data or a signal that you're in a genuinely unexplored space. Which do you think it is?'"
    - "If the detection layer (Plan 118-00) wrote hebrew_refusal:true, the user sees the bilingual refusal once and the pipeline does NOT fire"
    - "Each agent's return triggers a Phase 121 telemetry event to ~/.mindrian/telemetry/v1.13/mva.jsonl (sha-only, scalar-only -- Canon Part 8)"
    - "The orchestrator drains pending state from Plan 118-00 and marks it running, then marks complete when done (uses the state contract from 118-00)"
    - "After mva_brief_rendered is emitted, the orchestrator atomically writes ~/.mindrian/mva/state.json containing { current_sha8, current_sha256, rendered_at_ms, vercel_url } so Plan 118-05's option-router can auto-discover the latest brief sha8 (CRITICAL-3 wire)"
    - "All output is in Larry's pedagogical GUIDED voice (per feedback_larry_pedagogical_guided_first.md; never AUTONOMOUS reveal-of-pre-baked-answer)"
  artifacts:
    - path: lib/core/mva-progressive-renderer.cjs
      provides: "Pure-function renderer: takes an AgentResult, returns a Larry-voiced text block. No I/O. Plan 118-04 reuses for deck rendering."
      exports: ["renderAgentResult", "renderSharpQuestionFallback", "renderHebrewRefusal", "renderHeader", "renderProgressIndicator", "renderFooter"]
    - path: lib/core/mva-orchestrator.cjs
      provides: "The top-level controller. Wires mva-dispatcher (Plan 118-01) + ALL_AGENTS (Plan 118-02) + renderer (this plan) + telemetry. Exposes runPipeline(sentence_sha256, sentence_for_local_agents_only_via_env, opts) -> Promise<{ results, rendered, footer_data }>. Atomically writes ~/.mindrian/mva/state.json after mva_brief_rendered for Plan 118-05 consumption."
      exports: ["runPipeline", "OUTCOME_SHAPE"]
    - path: lib/core/mva-telemetry.cjs
      provides: "JSONL writer for Phase 121 events. Atomic append to ~/.mindrian/telemetry/v1.13/mva.jsonl. Schema-enforced -- rejects events with raw user content. Per-event allowed-fields schema is exported for grep-based source-of-truth lookup."
      exports: ["emit", "EVENT_TYPES", "ALLOWED_FIELDS", "validateEventPayload"]
    - path: commands/mva-brief.md
      provides: "The /mos:mva-brief slash command -- Larry-invoked when the orchestrator detects a pending MVA from 118-00. Larry uses this as the routing surface; the orchestrator itself does NOT call slash commands."
      contains: "## /mos:mva-brief"
    - path: scripts/mva-run.cjs
      provides: "CLI entry point: `node scripts/mva-run.cjs --sha <sha256>` reads the pending state from Plan 118-00, runs the orchestrator, prints the progressive output to stdout for Claude Code to relay to the user. Larry invokes this via Bash."
      contains: "runPipeline"
    - path: skills/mva-pipeline/SKILL.md
      provides: "Skill that activates when Larry sees a venture-positive UserPromptSubmit detection. Skill body instructs Larry to: (1) check ~/.mindrian/mva/<session>.json for pending state, (2) if pending, invoke scripts/mva-run.cjs via Bash, (3) relay output to user in Larry's voice, (4) surface the 3-option footer."
      contains: "auto-activate"
    - path: lib/core/mva-progressive-renderer.test.cjs
      provides: "Tests for each renderer function with golden output fixtures, including a renderFooter em-dash-free assertion"
      contains: "renderAgentResult"
    - path: lib/core/mva-orchestrator.test.cjs
      provides: "End-to-end orchestrator test with all 6 agents mocked; verifies streaming order, telemetry events emitted, state-file transitions, and that ~/.mindrian/mva/state.json is written atomically after mva_brief_rendered"
      contains: "runPipeline"
    - path: lib/core/mva-telemetry.test.cjs
      provides: "Tests for atomic append, schema validation, sha-only enforcement (rejects payloads containing raw text), per-event ALLOWED_FIELDS surface"
      contains: "validateEventPayload"
  key_links:
    - from: lib/core/mva-orchestrator.cjs
      to: lib/core/mva-dispatcher.cjs
      via: require + dispatch(ALL_AGENTS, sentence_sha256)
      pattern: 'dispatch\('
    - from: lib/core/mva-orchestrator.cjs
      to: lib/agents/mva/index.cjs
      via: require + ALL_AGENTS
      pattern: 'ALL_AGENTS'
    - from: lib/core/mva-orchestrator.cjs
      to: lib/core/mva-progressive-renderer.cjs
      via: require + renderAgentResult(result)
      pattern: 'renderAgentResult'
    - from: lib/core/mva-orchestrator.cjs
      to: lib/core/mva-state.cjs
      via: require + markRunning / markComplete
      pattern: 'mvaState\.mark'
    - from: lib/core/mva-orchestrator.cjs
      to: lib/core/mva-telemetry.cjs
      via: require + emit('mva_*', ...)
      pattern: 'telemetry\.emit'
    - from: lib/core/mva-orchestrator.cjs
      to: "~/.mindrian/mva/state.json"
      via: "atomic tmp-then-rename write after mva_brief_rendered; consumed by Plan 118-05 mva-option-router::resolveCurrentSha8()"
      pattern: 'state\.json'
    - from: scripts/mva-run.cjs
      to: lib/core/mva-orchestrator.cjs
      via: require + runPipeline
      pattern: 'runPipeline'
    - from: skills/mva-pipeline/SKILL.md
      to: scripts/mva-run.cjs
      via: "Skill instructions tell Larry to invoke via Bash"
      pattern: 'mva-run\.cjs'
---

<objective>
Wire Plan 118-01 (dispatcher) + Plan 118-02 (6 agents) into a single orchestrated pipeline that streams Larry-voiced output as each agent returns. This plan is the "loud" plan -- where the user actually sees intelligence appear in their terminal.

Per binding decision B3: progressive streaming is agent-returns-trigger-output, NOT fixed time slots. The source spec's t=5/t=8/t=12/t=15/t=20/t=24 timeline is INDICATIVE -- each agent appends to the terminal as it returns, in whatever order they happen to come back.

Per binding decision B7: all-fail produces the sharp-question fallback verbatim from source spec line 111.

Per feedback_larry_pedagogical_guided_first.md: this is GUIDED voice, not AUTONOMOUS reveal-of-pre-baked-answer. Larry doesn't say "Here is what I found". Larry says "Here's what I noticed -- worth dwelling on?". The renderer enforces this through the prompt templates.

Per OQ8 (resolved): telemetry emits from the orchestrator (not from agents). Events: mva_pipeline_started, mva_agent_returned, mva_brief_rendered. The Vercel deploy + option-clicked events ship in 118-04 and 118-05.

Per CRITICAL-3 (resolved here): after emitting mva_brief_rendered, the orchestrator atomically writes a small JSON manifest at ~/.mindrian/mva/state.json. Plan 118-05's option-router reads it via resolveCurrentSha8() to auto-discover the latest brief sha8 when the user types '1', '2', or '3' without an explicit sha argument.

Purpose: this plan makes the 30-second MVA real. Without this, Plans 118-01 and 118-02 are just architecture. This is the user-facing surface.

Output: 3 lib modules + 3 test files + 1 command + 1 script + 1 skill = the runtime path from "user typed sentence" to "user sees 6 intelligence surfaces appear".
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-00-userprompt-detection-PLAN.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-01-dispatch-architecture-PLAN.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-02-six-agents-PLAN.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/the-30-second-mva.md
@docs/MINDRIAN-CANON.md
@lib/core/rs-egress-telemetry.cjs
@scripts/preflight-tension-surface.cjs

<interfaces>
<!-- Contracts depended-on -->

From Plan 118-00 (mva-state.cjs):
```typescript
type PendingState = {
  sentence_sha256: string;
  classified_at: number;
  classifier_source: 'heuristic' | 'heuristic_fallback' | 'haiku-4-5';
  classifier_confidence: 'high' | 'medium';
  hebrew_refusal?: boolean;
};
function readPending(): PendingState | null;
function markRunning(): void;
function markComplete(outcome: any): void;
```

From Plan 118-01 (mva-dispatcher.cjs):
```typescript
async function* dispatch(agents, sentence_sha256, opts): AsyncIterable<AgentResult>;
type AgentResult = { agent_id: string, status: 'ok'|'empty'|'error'|'timeout', duration_ms: number, payload?: any, error?: string };
```

From Plan 118-02 (lib/agents/mva/index.cjs):
```javascript
const { ALL_AGENTS } = require('../../agents/mva/index.cjs');
// ALL_AGENTS = [{ id, fn }, ... ] x 6
```

Phase 121 telemetry schema -- ALLOWED_FIELDS source-of-truth per event type:
```typescript
type TelemetryEvent = {
  event: 'mva_pipeline_started' | 'mva_agent_returned' | 'mva_brief_rendered'
       | 'mva_option_selected' | 'mva_brief_deployed' | 'mva_pipeline_failed';
  timestamp: string;  // ISO8601
  session_id: string; // from CLAUDE_SESSION_ID env or 'default'
  sentence_sha256: string;
};

// ALLOWED_FIELDS schema (exported from mva-telemetry.cjs; source-of-truth for tests):
const ALLOWED_FIELDS = Object.freeze({
  mva_pipeline_started: ['sentence_sha256'],
  mva_agent_returned:   ['sentence_sha256', 'agent_id', 'duration_ms', 'status', 'error_short'],
  mva_brief_rendered:   ['sentence_sha256', 'total_duration_ms', 'agent_count_ok', 'agent_count_failed'],
  mva_option_selected:  ['sentence_sha256', 'option_id', 'time_to_click_ms'],
  mva_brief_deployed:   ['sentence_sha256', 'vercel_subdomain_hash', 'deploy_duration_ms', 'status', 'error_short'],
  mva_pipeline_failed:  ['sentence_sha256', 'total_duration_ms', 'error_short']
});
// NOTE: mva_brief_rendered uses 'total_duration_ms' (NOT 'duration_ms'); Plan 118-06's harness asserts this field name.
```

Plan 118-05 expects this JSON manifest at ~/.mindrian/mva/state.json (written by this plan's orchestrator):
```typescript
type CurrentBriefState = {
  current_sha8: string;      // first 8 chars of sentence_sha256 -- the brief identifier
  current_sha256: string;    // full sentence_sha256
  rendered_at_ms: number;    // Date.now() captured immediately after mva_brief_rendered emission
  vercel_url: string | null; // present only after Plan 118-04 wires deploy; null in this plan's pre-04 state
};
// Atomic write: fs.writeFileSync(tmpfile) + fs.renameSync(tmpfile, ~/.mindrian/mva/state.json)
// Consumed by Plan 118-05 mva-option-router::resolveCurrentSha8()
```

The Larry GUIDED voice pattern (from feedback_larry_pedagogical_guided_first.md):
- DO: "Here's what shows up in the graph: ..." / "Worth a look: ..." / "One thing to chew on: ..."
- DON'T: "I've analyzed your venture and found: ..." (autonomous-feeling)
- DON'T: "The answer is: ..." (delivery-channel-feeling)

The 3-option footer (verbatim from source spec lines 99-103, binding decision B4):
```
What now?
  [1] Just tell me what's new         (stay in "tell me" mode)
  [2] Build a room around this        (invest)
  [3] Challenge me -- Devil's Advocate (go deeper cognitively)
```
Note: source spec used em-dash; per feedback_no_emdashes.md, the rendered output MUST use double-hyphen `--` not em-dash `—`. The plan's literal text above uses `--` for this reason. The renderFooter function in mva-progressive-renderer.cjs MUST hardcode this text with `--` (NOT load it from the source spec at runtime; the source spec contains em-dashes and is not a runtime input).

From scripts/preflight-tension-surface.cjs (precedent for skill-readable state file + Larry-invokable command pattern):
```javascript
// State file location: ~/.mindrian/tension/<session>.json
// Skill checks state at session-start; relays via Larry if pending
```
</interfaces>

<reference_only>
- Source spec lines 38-77 (the full timeline + the t=24s "One question you haven't asked yourself" -- this is the Six-hats agent's summary_line)
- Source spec lines 107-113 (failure modes; sharp-question fallback verbatim text)
- feedback_larry_pedagogical_guided_first.md (GUIDED voice; NEVER autonomous)
- feedback_no_emdashes.md (`--` not `—` everywhere)
- feedback_121_5_statusline_co_design.md (DO NOT add new statusline segments; the brief renders inline to scrollback, NOT to statusline)
- skills/auto-explore/SKILL.md or similar skill precedent (use existing skill structure)
</reference_only>
</context>

<open_questions>
**OQ8 (resolved -- this plan implements it):** Telemetry events emit to ~/.mindrian/telemetry/v1.13/mva.jsonl from this plan. Event types declared in EVENT_TYPES constant. Schema validation rejects raw user content. Per-event allowed fields exported as ALLOWED_FIELDS for grep-based source-of-truth lookup.

**OQ9 (from 118-02 carry-forward, resolved by this plan):** Tavily-unavailable cell renders as a placeholder line. Six-hats deterministic-per-hash is preserved (renderer just renders the agent's output).

**OQ11 (NEW, this plan): Output goes to stdout or directly to Claude Code's user-facing channel?**
- The orchestrator runs inside `scripts/mva-run.cjs`, which is invoked by Larry via Bash.
- Bash output goes to Claude Code's tool-output channel, which Larry sees and relays.
- LEAN: scripts/mva-run.cjs writes to stdout; Larry reads the stdout in a Bash tool call and re-voices it (so Larry remains the pedagogical narrator).
- Alternative: scripts/mva-run.cjs writes the output to a file; Larry reads the file. Lean against this (extra I/O hop; Bash tool output is the cleanest channel).
- Confirm with Jonathan: stdout-via-Bash is the right surface, OR should we use a different mechanism (e.g., write to a markdown file Claude Code opens)?

**OQ12 (NEW, this plan): Does Larry render to user in GUIDED-default mode per feedback_larry_pedagogical_guided_first.md?**
- The DirectiveEnvelope concept is v1.13.1 (Phase 127). For v1.13.0 Phase 118, Larry's voicing is in the skill instructions + the rendered output strings.
- LEAN: the renderer emits the surfaces in Larry's voice already (e.g., "Here's what I noticed -- worth a look?"). The skill says: "Read the stdout from mva-run.cjs and relay verbatim to the user; do NOT add commentary; do NOT autonomously interpret findings; close with the 3-option footer". This makes Larry the GUIDED narrator without invoking the v1.13.1 DirectiveEnvelope yet.
</open_questions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure renderer + telemetry writer</name>
  <files>lib/core/mva-progressive-renderer.cjs, lib/core/mva-progressive-renderer.test.cjs, lib/core/mva-telemetry.cjs, lib/core/mva-telemetry.test.cjs</files>
  <behavior>
    Renderer tests (RED first):
    - Test 1: renderAgentResult({ agent_id: 'brain_similar', status: 'ok', payload: { summary_line: 'Found 3 ventures...' } }) returns a string starting with "  [brain]" or similar prefix, containing the summary_line, ending with newline. NO em-dashes (assert.equal(result.match(/—/), null)).
    - Test 2: renderAgentResult with status 'timeout' returns "  [agent_id] (still working ...)" placeholder.
    - Test 3: renderAgentResult with status 'error' returns "  [agent_id] (skipped: brief reason)" placeholder, NEVER includes the raw error string verbatim (sanitize: drop anything past first 60 chars).
    - Test 4: renderAgentResult with status 'empty' and reason 'tavily_unavailable' returns "  [tavily] Live funding scan: not configured (add TAVILY_API_KEY to ~/.mindrian.env)".
    - Test 5: renderSharpQuestionFallback() returns the verbatim sharp-question from source spec line 111, with `--` not `—`. assert.equal(renderSharpQuestionFallback().match(/—/), null).
    - Test 6: renderHebrewRefusal() returns bilingual refusal: English first, Hebrew second; both on separate lines; OQ7 lean text. assert.equal(renderHebrewRefusal().match(/—/), null).
    - Test 7: renderHeader(sentence_sha256_first_8_chars) returns a 2-line opener: "Scanning for precedents..." + a progress indicator placeholder. GUIDED voice (per feedback_larry_pedagogical_guided_first.md).
    - Test 8: renderProgressIndicator(elapsed_ms, budget_ms) returns "  [progress: 12s / 45s, 3 of 6 returned]"; passes a smoke check on edge cases (0/45, 45/45).
    - Test 8b (CRITICAL-6): renderFooter() returns the 3-option footer block verbatim from binding decision B4. The text is HARDCODED in mva-progressive-renderer.cjs (NOT loaded from source spec at runtime; source spec contains em-dashes and is not a runtime input). assert.equal(renderFooter().match(/—/), null, 'footer must have no em-dashes'). Also assert renderFooter() contains the literal substring "Challenge me -- Devil's Advocate" (with `--`, not `—`).
    - Test 9: All renderer functions are PURE -- no fs, no process, no console (verify via grep that the source contains zero fs/process/console references).

    Telemetry tests:
    - Test 10: emit('mva_pipeline_started', { sentence_sha256: 'abc' }) appends one line to ~/.mindrian/telemetry/v1.13/mva.jsonl. Line is valid JSON.
    - Test 11: validateEventPayload rejects payloads where any string field is > 64 chars (which would suggest raw content). Exception: error_short (capped at 60 chars, explicitly allowed).
    - Test 12: validateEventPayload rejects payloads containing fields not in the schema (e.g., {sentence: '...'}). The sentence_sha256 field is the ONLY sentence-related identifier allowed.
    - Test 13: EVENT_TYPES is a frozen object exposing the 6 event names from CONTEXT.md OQ8 lean. ALLOWED_FIELDS is also exported and frozen, with one entry per event type listing the scalar field names that are valid for that event. Notably ALLOWED_FIELDS.mva_brief_rendered MUST include 'total_duration_ms' (NOT 'duration_ms') -- Plan 118-06's Dror harness Test 1 asserts on this field name.
    - Test 14: emit() is atomic -- concurrent emits from 6 simulated agents produce 6 well-formed JSON lines (no torn writes; mirror lib/core/rs-egress-telemetry.cjs append pattern with fs.appendFileSync).

    Run: `node --test lib/core/mva-progressive-renderer.test.cjs lib/core/mva-telemetry.test.cjs` passes all 15.
  </behavior>
  <action>
    Step 1 (RED -- renderer): Write tests 1-9 (including Test 8b for renderFooter) in lib/core/mva-progressive-renderer.test.cjs.

    Step 2 (RED -- telemetry): Write tests 10-14 in lib/core/mva-telemetry.test.cjs.

    Step 3 (GREEN -- renderer): Implement lib/core/mva-progressive-renderer.cjs.

    Required exports + key logic:
    - renderHeader(sha8): returns 2-line block. GUIDED voice. Example: "Scanning for precedents... (sentence ${sha8})\n[progress: 0s / 45s, 0 of 6 returned]\n"
    - renderProgressIndicator(elapsedMs, budgetMs, returnedCount): single-line progress; called between agent returns
    - renderAgentResult(result): dispatch on result.status; for each agent_id, format a 1-3 line block:
      - brain_similar: "  [brain] " + summary_line
      - brain_cross_domain: "  [analogy] " + summary_line
      - brain_classic_traps: "  [traps] " + summary_line
      - tavily_funding: "  [funding] " + summary_line  (or empty-state placeholder)
      - six_hats_red_black: "  [worth chewing on] " + summary_line
      - dashboard_graph: "  [your room] " + summary_line
      - On status 'timeout': "  [{label}] (still in progress at 45s)"
      - On status 'error': "  [{label}] (skipped)"
      - On status 'empty' with reason: contextualized placeholder per OQ9 lean
    - renderSharpQuestionFallback(): literal text from source spec line 111: "I didn't find precedents for this in 30 seconds. That's either a gap in my data or a signal that you're in a genuinely unexplored space. Which do you think it is?"
    - renderHebrewRefusal(): "MindrianOS does not yet support Hebrew in v1.13.0. Please try in English.\nMindrianOS לא תומך בעברית ב-v1.13.0; אנא נסה באנגלית."
    - renderFooter() (CRITICAL-6): returns the 3-option footer block VERBATIM, HARDCODED with `--` (not `—`):
      ```
      const FOOTER_TEXT = [
        '',
        'What now?',
        '  [1] Just tell me what\'s new         (stay in "tell me" mode)',
        '  [2] Build a room around this        (invest)',
        '  [3] Challenge me -- Devil\'s Advocate (go deeper cognitively)',
        ''
      ].join('\n');
      function renderFooter() { return FOOTER_TEXT; }
      ```
      The string is a module-level constant. It MUST NOT be read from the source spec markdown at runtime (the source spec contains em-dashes and would re-introduce them). Test 8b asserts both the em-dash-free invariant and the literal `--` substring presence.
    - Per feedback_no_emdashes.md: all output uses `--` and `-` only. Add a self-test in the file's footer: `function _assertNoEmdashes(s) { return !/—/.test(s); }` and the exported function set is verified via the unit tests.

    Step 4 (GREEN -- telemetry): Implement lib/core/mva-telemetry.cjs.

    Required:
    - EVENT_TYPES = Object.freeze(['mva_pipeline_started','mva_agent_returned','mva_brief_rendered','mva_option_selected','mva_brief_deployed','mva_pipeline_failed'])
    - ALLOWED_FIELDS = Object.freeze({
        mva_pipeline_started: ['sentence_sha256'],
        mva_agent_returned:   ['sentence_sha256', 'agent_id', 'duration_ms', 'status', 'error_short'],
        mva_brief_rendered:   ['sentence_sha256', 'total_duration_ms', 'agent_count_ok', 'agent_count_failed'],
        mva_option_selected:  ['sentence_sha256', 'option_id', 'time_to_click_ms'],
        mva_brief_deployed:   ['sentence_sha256', 'vercel_subdomain_hash', 'deploy_duration_ms', 'status', 'error_short'],
        mva_pipeline_failed:  ['sentence_sha256', 'total_duration_ms', 'error_short']
      })
      // ALLOWED_FIELDS is exported as the source-of-truth for per-event scalar field names.
      // Plan 118-06's Dror harness greps ALLOWED_FIELDS.mva_brief_rendered to validate it asserts on the correct field name (total_duration_ms, not duration_ms).
    - validateEventPayload(event, payload): checks event is in EVENT_TYPES; checks all keys are in ALLOWED_FIELDS[event]; checks all string values are <= 64 chars (except sentence_sha256 which is exactly 64; session_id <= 64; error_short <= 60)
    - emit(event, payload): validates; on invalid throws ValidationError; on valid does fs.appendFileSync(jsonl_path, JSON.stringify({event, timestamp: new Date().toISOString(), session_id: process.env.CLAUDE_SESSION_ID || 'default', ...payload}) + '\n')
    - Path: path.join(os.homedir(), '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl'). mkdir -p with fs.mkdirSync({recursive:true}) on first write.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-progressive-renderer.test.cjs lib/core/mva-telemetry.test.cjs</automated>
  </verify>
  <done>
    - All 15 tests pass (renderer 9 incl. Test 8b for renderFooter + telemetry 5 + ALLOWED_FIELDS surface check).
    - mva-progressive-renderer.cjs has zero fs/process/console references (grep verified).
    - mva-progressive-renderer.cjs exports renderFooter and the footer text is em-dash-free AND hardcoded as a module-level constant.
    - mva-telemetry.cjs exports ALLOWED_FIELDS with mva_brief_rendered carrying 'total_duration_ms' (not 'duration_ms').
    - mva-telemetry.cjs uses fs.appendFileSync (atomic per kernel guarantees on append + single-line writes).
    - validateEventPayload rejects payloads with fields outside the schema (Test 12).
    - All rendered output is em-dash-free (grep `—` on every test output captures verified).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Orchestrator + CLI entry script + state.json manifest write</name>
  <files>lib/core/mva-orchestrator.cjs, lib/core/mva-orchestrator.test.cjs, scripts/mva-run.cjs</files>
  <behavior>
    Orchestrator tests (RED first):
    - Test 1: runPipeline with all 6 agents mocked to return ok in sequence (10ms, 20ms, 30ms, 40ms, 50ms, 60ms). Verify:
      - State transitions: markRunning called at start, markComplete called at end (mock mva-state)
      - Telemetry: mva_pipeline_started emitted once at start; mva_agent_returned emitted 6 times (one per agent); mva_brief_rendered emitted once at end with total_duration_ms field (NOT duration_ms)
      - Output: an array of 6 rendered strings comes back in order of return (not order of dispatch)
      - Total wall-clock < 200ms
    - Test 2: runPipeline with all 6 agents returning status 'error'. Verify: telemetry emits 6 mva_agent_returned events with status='error'; final rendered output contains the sharp-question fallback verbatim; mva_pipeline_failed event emitted; markComplete called with outcome { all_failed: true }.
    - Test 3: runPipeline with 3 ok + 3 timeout. Verify: rendered output has 3 result lines + 3 timeout placeholders + the 3-option footer at end.
    - Test 4: runPipeline when pending state has hebrew_refusal:true. Verify: NO agents invoked (dispatcher not called); output is just the Hebrew refusal block; markComplete called with outcome { hebrew_refusal: true }; state.json manifest is NOT written for Hebrew refusal path (resolveCurrentSha8() should return null).
    - Test 5: Canon Part 8: orchestrator never reads ~/.mindrian/mva/<session>.json's hypothetical "sentence" field (mva-state contract from 118-00 doesn't expose it; verify orchestrator code does not destructure any field other than sentence_sha256, classifier_source, hebrew_refusal).
    - Test 6: Footer rendering: the output always ends with the 3-option footer block UNLESS hebrew_refusal:true. Footer text is exactly:
      ```
      What now?
        [1] Just tell me what's new         (stay in "tell me" mode)
        [2] Build a room around this        (invest)
        [3] Challenge me -- Devil's Advocate (go deeper cognitively)
      ```
    - Test 6b (CRITICAL-3 wire): runPipeline with at least one ok agent triggers an atomic write to ~/.mindrian/mva/state.json AFTER mva_brief_rendered emission. The file contains { current_sha8, current_sha256, rendered_at_ms, vercel_url } -- where vercel_url is null at this plan's stage (Plan 118-04 wires the real URL). Atomic write: tmpfile + rename. Verify by reading the file after runPipeline returns, parsing JSON, asserting current_sha8 === sentence_sha256.slice(0,8) and rendered_at_ms is within 100ms of Date.now().

    Run: `node --test lib/core/mva-orchestrator.test.cjs` passes all 7.

    Script smoke test (in same file):
    - Test 7: Spawn `node scripts/mva-run.cjs --sha <fake_sha>` with mocked agent modules; assert stdout contains the rendered output; exit code 0.
  </behavior>
  <action>
    Step 1 (RED): Write all 8 tests (1-6 + 6b + 7) in lib/core/mva-orchestrator.test.cjs.

    Step 2 (GREEN -- orchestrator): Implement lib/core/mva-orchestrator.cjs.

    Required exports + flow:
    ```javascript
    async function runPipeline(opts={}) {
      const fs = require('node:fs');
      const path = require('node:path');
      const os = require('node:os');
      const mvaState = require('./mva-state.cjs');
      const renderer = require('./mva-progressive-renderer.cjs');
      const telemetry = require('./mva-telemetry.cjs');
      const { dispatch } = require('./mva-dispatcher.cjs');
      const { ALL_AGENTS } = require('../agents/mva/index.cjs');

      const pending = mvaState.readPending();
      if (!pending) return { results: [], rendered: '', footer_data: null };

      // Hebrew short-circuit (per LD1 in 118-CONTEXT.md)
      if (pending.hebrew_refusal) {
        const out = renderer.renderHebrewRefusal();
        mvaState.markComplete({ hebrew_refusal: true });
        // Do NOT write state.json manifest on Hebrew path (no brief was rendered)
        return { results: [], rendered: out, footer_data: null };
      }

      mvaState.markRunning();
      telemetry.emit('mva_pipeline_started', { sentence_sha256: pending.sentence_sha256 });

      const t0 = Date.now();
      const blocks = [renderer.renderHeader(pending.sentence_sha256.slice(0,8))];
      const results = [];
      let okCount = 0, failedCount = 0;

      for await (const result of dispatch(ALL_AGENTS, pending.sentence_sha256)) {
        results.push(result);
        blocks.push(renderer.renderAgentResult(result));
        if (result.status === 'ok') okCount++; else failedCount++;
        telemetry.emit('mva_agent_returned', {
          sentence_sha256: pending.sentence_sha256,
          agent_id: result.agent_id,
          duration_ms: result.duration_ms,
          status: result.status,
          error_short: result.error ? String(result.error).slice(0, 60) : undefined
        });
      }

      const totalDuration = Date.now() - t0;

      if (okCount === 0) {
        blocks.push(renderer.renderSharpQuestionFallback());
        telemetry.emit('mva_pipeline_failed', { sentence_sha256: pending.sentence_sha256, total_duration_ms: totalDuration });
      } else {
        blocks.push(renderer.renderFooter()); // 3-option footer (renderFooter from renderer module, em-dash-free hardcoded text)
      }

      telemetry.emit('mva_brief_rendered', {
        sentence_sha256: pending.sentence_sha256,
        total_duration_ms: totalDuration,         // CRITICAL: field name is total_duration_ms, NOT duration_ms (per ALLOWED_FIELDS)
        agent_count_ok: okCount,
        agent_count_failed: failedCount
      });

      // CRITICAL-3 wire: atomically write state.json so Plan 118-05 can auto-discover this sha8
      // (Only on the rendered path, NOT on Hebrew refusal short-circuit which returned earlier.)
      try {
        const mvaDir = path.join(os.homedir(), '.mindrian', 'mva');
        fs.mkdirSync(mvaDir, { recursive: true });
        const manifest = {
          current_sha8: pending.sentence_sha256.slice(0, 8),
          current_sha256: pending.sentence_sha256,
          rendered_at_ms: Date.now(),
          vercel_url: null   // Plan 118-04 overwrites this manifest with the real URL after deploy
        };
        const finalPath = path.join(mvaDir, 'state.json');
        const tmpPath = finalPath + '.tmp.' + process.pid;
        fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
        fs.renameSync(tmpPath, finalPath);
      } catch (e) {
        // Manifest write is best-effort; orchestrator does NOT fail if disk is full or permission denied.
        // Plan 118-05's option-router will detect missing state.json and emit a friendly "brief expired" message.
      }

      mvaState.markComplete({ ok: okCount, failed: failedCount, all_failed: okCount === 0 });

      return { results, rendered: blocks.join('\n'), footer_data: { ok: okCount, failed: failedCount, sha256: pending.sentence_sha256 } };
    }
    module.exports = { runPipeline, OUTCOME_SHAPE: {...} };
    ```

    Note: renderer.renderFooter() is the 3-option footer renderer added to mva-progressive-renderer.cjs in Task 1 (Test 8b verifies its em-dash-free hardcoded behavior).

    Step 3: Implement scripts/mva-run.cjs as a thin CLI wrapper.
    ```javascript
    #!/usr/bin/env node
    'use strict';
    const { runPipeline } = require('../lib/core/mva-orchestrator.cjs');
    (async () => {
      try {
        const outcome = await runPipeline({});
        process.stdout.write(outcome.rendered);
        // Per OQ11 lean: stdout is the channel; Larry's Bash tool call captures this
        process.exit(0);
      } catch (e) {
        process.stderr.write('[mva-run] ' + (e.message || e) + '\n');
        process.exit(1); // CLI returns 1 on hard failure (vs hook which always 0)
      }
    })();
    ```

    Note on stdout vs stderr: scripts/mva-run.cjs is invoked by Larry via Bash, NOT by a Claude Code hook. Therefore stdout writes are allowed (and required -- Larry needs to read them). This is different from the Plan 118-00 hook which must NOT write stdout.

    Step 4: Run all 8 tests. Mock mva-state, mva-dispatcher, ALL_AGENTS by manipulating the require cache (precedent: lib/memory/run-feynman-tests.cjs).
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-orchestrator.test.cjs</automated>
  </verify>
  <done>
    - All 8 tests pass (including Test 6b: state.json manifest atomically written after mva_brief_rendered).
    - The orchestrator emits exactly 3 telemetry events on a successful run: mva_pipeline_started, 6x mva_agent_returned, mva_brief_rendered (8 total).
    - On all-fail, mva_pipeline_failed is also emitted (9 total).
    - mva_brief_rendered carries `total_duration_ms` (NOT `duration_ms`) -- field name matches ALLOWED_FIELDS source-of-truth (WARN-2 invariant).
    - State transitions are correct: markRunning at start, markComplete at end (every code path).
    - ~/.mindrian/mva/state.json is atomically written (tmp + rename) on the rendered path; NOT written on Hebrew short-circuit (CRITICAL-3 wire).
    - scripts/mva-run.cjs spawns and writes to stdout in the smoke test.
    - The 3-option footer text is verbatim and em-dash-free (re-verified at orchestrator level, not just renderer level).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Skill + slash command + Larry voicing surface</name>
  <files>commands/mva-brief.md, skills/mva-pipeline/SKILL.md, lib/core/mva-orchestrator.test.cjs</files>
  <behavior>
    Tests (extended in mva-orchestrator.test.cjs):
    - Test 8: skills/mva-pipeline/SKILL.md exists with frontmatter:
      - `name: mva-pipeline`
      - `description: ...`
      - `interactive_first_reward: instant_brief` (this is the linter contract from Plan 118-06)
      - Auto-activation hint that mentions the state-file path
    - Test 9: commands/mva-brief.md exists with:
      - YAML frontmatter (name, description, argument-hint, allowed-tools, disable-model-invocation if applicable)
      - Body that instructs the model to invoke `node scripts/mva-run.cjs` via Bash and relay output
    - Test 10: Both files reference scripts/mva-run.cjs as the entry point (grep verified).
    - Test 11: SKILL.md has an explicit "do NOT" section per feedback_larry_pedagogical_guided_first.md: do NOT add commentary, do NOT autonomously interpret findings, do NOT skip the 3-option footer.

    Run: `node --test lib/core/mva-orchestrator.test.cjs` passes all 12 (8 from Task 2 + 4 from this task).
  </behavior>
  <action>
    Step 1: Create commands/mva-brief.md. Content sketch:
    ```markdown
    ---
    name: mva-brief
    description: Run the 30-second MVA pipeline for the user's current venture sentence
    argument-hint: (no args required -- reads pending state from UserPromptSubmit detection)
    allowed-tools: Bash
    interactive_first_reward: instant_brief
    ---

    # /mos:mva-brief

    Run the 30-second MVA pipeline against the pending venture sentence detected by the UserPromptSubmit hook.

    ## What this does
    1. Reads pending state from `~/.mindrian/mva/<session-id>.json` (written by Plan 118-00 detection)
    2. Fires 6 parallel agents (Brain x3 + Tavily + Six-hats + Dashboard) under a 45-second budget
    3. Streams agent results as they return, each in Larry's GUIDED voice
    4. Closes with the 3-option footer

    ## Instructions for the model
    Invoke `node scripts/mva-run.cjs` via Bash with no arguments. Relay the stdout to the user VERBATIM. Do NOT:
    - Add commentary or interpretation
    - Re-summarize the agent findings
    - Skip the 3-option footer
    - Autonomously pick option 1, 2, or 3 for the user

    The 3-option footer is the user's decision point. Wait for the user to type 1, 2, or 3 (or their own free-text), then route per the option behavior:
    - 1: stay in JUST_TALK mode; keep brief in scrollback
    - 2: invoke /mos:new-project (stub for v1.13.0; Phase 119 wires fully in beta.18)
    - 3: invoke /mos:challenge-assumptions against the brief
    ```

    Step 2: Create skills/mva-pipeline/SKILL.md. Content sketch:
    ```markdown
    ---
    name: mva-pipeline
    description: Auto-activates when a UserPromptSubmit detection has classified the user's prompt as a venture sentence
    auto-activate: state-file
    state-file: ~/.mindrian/mva/<session-id>.json
    state-condition: pending && !running
    interactive_first_reward: instant_brief
    ---

    # The 30-second MVA skill

    ## When this activates
    When Plan 118-00's UserPromptSubmit detection writes a pending state with venture:true (or hebrew_refusal:true), this skill fires on the NEXT model turn.

    ## What to do
    1. Run `/mos:mva-brief` (or invoke `node scripts/mva-run.cjs` via Bash directly).
    2. Relay the stdout to the user verbatim, in your normal Larry voice (no extra framing).
    3. Wait for the user's option selection (1, 2, 3, or free-text).
    4. Route per the footer behavior:
       - 1 -> stay in JUST_TALK; the brief stays visible; user can ask follow-ups about any cell
       - 2 -> invoke /mos:new-project (Phase 119 wrapper; in v1.13.0 this surfaces a stub message)
       - 3 -> invoke /mos:challenge-assumptions against the brief

    ## What NOT to do (per feedback_larry_pedagogical_guided_first.md)
    - Do NOT add commentary or "I noticed..." preamble before the rendered output
    - Do NOT interpret findings autonomously ("This means you should..."); the rendered output is GUIDED -- it asks the user to think
    - Do NOT skip the 3-option footer; even if all agents failed, the sharp-question fallback substitutes the footer
    - Do NOT pre-pick an option; the user picks

    ## Canon parts implemented
    - Part 2 (team-around-navigator -- 6 agents as a parallel team)
    - Part 8 (boundary -- agents send only generic handles to Brain/Tavily)
    - Part 10 sub-claim 3 (room as receipt -- the brief is the reward; option 2 is the invest)
    ```

    Step 3: Run all 12 tests. Tests 8-11 are static-file inspections (read SKILL.md and commands/mva-brief.md, assert content).
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-orchestrator.test.cjs && grep -l "scripts/mva-run.cjs" commands/mva-brief.md skills/mva-pipeline/SKILL.md</automated>
  </verify>
  <done>
    - All 12 tests pass.
    - commands/mva-brief.md and skills/mva-pipeline/SKILL.md both exist and reference scripts/mva-run.cjs.
    - SKILL.md has explicit GUIDED-voice DO-NOT section.
    - Frontmatter on both files declares `interactive_first_reward: instant_brief` (linter contract for Plan 118-06).
    - Em-dash check: no `—` characters in either file.
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. All test files pass:
   `node --test lib/core/mva-progressive-renderer.test.cjs lib/core/mva-telemetry.test.cjs lib/core/mva-orchestrator.test.cjs`
2. End-to-end script smoke (with mocked agents via env override OR real Brain unavailable so all-empty path runs):
   `node scripts/mva-run.cjs` (with no pending state) exits 0 and prints nothing
3. Em-dash sweep across all this plan's outputs:
   `grep -E "—" lib/core/mva-*.cjs commands/mva-brief.md skills/mva-pipeline/SKILL.md` returns 0 matches
4. Telemetry schema sweep:
   `node -e "const t=require('./lib/core/mva-telemetry.cjs'); console.log(t.EVENT_TYPES); console.log(t.ALLOWED_FIELDS.mva_brief_rendered)"` outputs the 6 event names AND confirms mva_brief_rendered includes 'total_duration_ms'
5. Canon Part 8 sweep on orchestrator and renderer:
   `grep -E "brain_query|mcp__brain_|user_prompt|raw_sentence|MVA_SENTENCE" lib/core/mva-orchestrator.cjs lib/core/mva-progressive-renderer.cjs lib/core/mva-telemetry.cjs` returns 0 matches
6. The 3-option footer is em-dash-free in source AND in rendered output (already verified in Tests 1, 5, 6, 8b)
7. CRITICAL-3 wire smoke test: after a successful runPipeline, `cat ~/.mindrian/mva/state.json | jq -r '.current_sha8'` outputs the expected sha8.
</verification>

<success_criteria>
- All automated tests pass across 3 test files.
- The runtime path is complete: UserPromptSubmit hook (118-00) -> pending state -> Larry sees skill activation -> invokes /mos:mva-brief or scripts/mva-run.cjs via Bash -> orchestrator runs dispatcher (118-01) -> 6 agents (118-02) -> rendered output streams to stdout -> Larry relays to user.
- Telemetry events fire correctly (8 events on success, 9 on all-fail; events are sha-only + scalar-only; mva_brief_rendered uses total_duration_ms field).
- ALLOWED_FIELDS is exported from mva-telemetry.cjs as the source-of-truth for per-event scalar fields (Plan 118-06 grep test verifies).
- ~/.mindrian/mva/state.json manifest is atomically written after mva_brief_rendered on the rendered path; NOT written on Hebrew short-circuit (CRITICAL-3 wire for Plan 118-05's resolveCurrentSha8 auto-discovery).
- Hebrew refusal short-circuits the pipeline cleanly (no agents invoked, no manifest written).
- All output is em-dash-free (verified by grep AND by test assertions; renderFooter is hardcoded with `--` not `—`).
- The 3-option footer renders verbatim per binding decision B4.
- Larry's voicing is GUIDED, not AUTONOMOUS (per feedback_larry_pedagogical_guided_first.md; enforced via SKILL.md instructions + renderer prefixes).
- Zero new statusline segments (per feedback_121_5_statusline_co_design.md).
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-03-SUMMARY.md` capturing:
- The runtime path from UserPromptSubmit to user-visible output (end-to-end diagram)
- All 6 Phase 121 telemetry events with their full payload schemas (per ALLOWED_FIELDS export)
- The state.json manifest schema { current_sha8, current_sha256, rendered_at_ms, vercel_url } and write semantics (atomic tmp+rename; skipped on Hebrew refusal)
- The 3-option footer (verbatim) and its em-dash-free rendering -- renderFooter is module-level hardcoded constant
- Renderer's 6 per-agent prefix labels ([brain], [analogy], [traps], [funding], [worth chewing on], [your room])
- The Hebrew refusal block (verbatim, both languages)
- The sharp-question fallback (verbatim from source spec)
- OQ resolutions for OQ8, OQ9, OQ11, OQ12
- Canon Part 8 + Part 10 + feedback_larry_pedagogical_guided_first compliance audit
- Test counts: 8 (orchestrator) + 9 (renderer incl. 8b) + 5 (telemetry incl. ALLOWED_FIELDS) + 4 (skill/command) = 26 total tests passing
- Carry-forward to 118-04: the deck rendering will reuse renderer.renderAgentResult for the deck slide content (via a markdown-rather-than-terminal mode flag); the state.json manifest will be overwritten with the real Vercel URL after deploy
- Carry-forward to 118-05: the 3-option footer routing -- option 2 stub message text + option 3 challenge-assumptions invocation; resolveCurrentSha8() reads ~/.mindrian/mva/state.json
- Carry-forward to 118-06: the linter contract `interactive_first_reward: <type>` is declared in SKILL.md + commands/mva-brief.md frontmatter; 118-06 builds the CI check that scans every command frontmatter for this field; the harness uses ALLOWED_FIELDS.mva_brief_rendered to grep total_duration_ms as source-of-truth
</output>
</content>
</invoke>