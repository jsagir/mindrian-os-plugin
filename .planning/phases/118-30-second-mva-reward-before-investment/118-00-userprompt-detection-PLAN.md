---
phase: 118-30-second-mva-reward-before-investment
plan: "00"
slug: userprompt-detection
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/hooks.json
  - scripts/mva-detect.cjs
  - lib/core/mva-classifier.cjs
  - lib/core/mva-classifier.test.cjs
  - lib/core/mva-state.cjs
  - data/mva-heuristic-keywords.json
autonomous: true
requirements: [MVA-118-01, MVA-118-02, MVA-118-03]
canon_parts: [Part 1, Part 8, Part 10]
beta_target: v1.13.0-beta.17
estimated_hours: 6-8
gap_closure: false

must_haves:
  truths:
    - "When the user types any sentence into Claude Code, a UserPromptSubmit hook classifies it as venture vs not-venture within 1500ms"
    - "Classification result is cached by sha256(sentence) for the session so the same sentence is not re-classified"
    - "When classification = venture AND no MVA pipeline is currently running for this session, a state file is written that downstream agents read to fire the 6-agent dispatch"
    - "When detection is suppressed (Hebrew refusal, --no-interactive equivalent, already-running pipeline, cold-start operator override), the hook exits 0 with no state mutation"
    - "Zero user-content egress to Brain: detection runs locally via Anthropic API direct OR offline heuristic, never via Brain MCP"
  artifacts:
    - path: scripts/mva-detect.cjs
      provides: "UserPromptSubmit hook entry point; reads CLAUDE_USER_PROMPT env from hook payload, dispatches to classifier, writes state file, exits in <1500ms"
      contains: "require('../lib/core/mva-classifier.cjs')"
    - path: lib/core/mva-classifier.cjs
      provides: "Two-mode classifier: (a) Anthropic Haiku 4.5 with 1-sentence prompt + low temp; (b) heuristic regex fallback when no ANTHROPIC_API_KEY"
      exports: ["classify", "isVentureSentence", "loadHeuristic"]
    - path: lib/core/mva-state.cjs
      provides: "Session-scoped state I/O: writePending, readPending, markRunning, markComplete, isAlreadyRunning. State at ~/.mindrian/mva/<session-id>.json"
      exports: ["writePending", "readPending", "markRunning", "markComplete", "isAlreadyRunning", "stateDir"]
    - path: lib/core/mva-classifier.test.cjs
      provides: "Unit tests covering: heuristic positive (3 venture sentences), heuristic negative (3 coding/admin sentences), Hebrew refusal (1 sentence in U+0590-U+05FF), cache hit on repeated sha256, classifier short-circuits when prompt < 12 chars or > 600 chars"
      contains: "describe('mva-classifier'"
    - path: data/mva-heuristic-keywords.json
      provides: "English keyword bank for the regex fallback: venture verbs ('have an idea', 'thinking about', 'building', 'launching', 'startup', 'app', 'platform', 'idea for', 'considering'), negative anti-patterns ('debug', 'fix the test', 'run /mos:', 'git ', 'edit ')"
      contains: '"venture_keywords"'
    - path: hooks/hooks.json
      provides: "New UserPromptSubmit entry calling scripts/mva-detect.cjs with timeout 1500ms, ordered AFTER intent-classifier (Phase 99) and BEFORE auto-explore-drain (Phase 117) so classification result is available when downstream hooks fire"
      contains: "scripts/mva-detect.cjs"
  key_links:
    - from: hooks/hooks.json
      to: scripts/mva-detect.cjs
      via: UserPromptSubmit hook command entry
      pattern: '"command":.*mva-detect.cjs"'
    - from: scripts/mva-detect.cjs
      to: lib/core/mva-classifier.cjs
      via: require + classify(sentence)
      pattern: 'classifier\.classify'
    - from: scripts/mva-detect.cjs
      to: lib/core/mva-state.cjs
      via: require + writePending on venture-positive
      pattern: 'mvaState\.writePending'
    - from: lib/core/mva-classifier.cjs
      to: Anthropic Haiku 4.5 via fetch
      via: "POST https://api.anthropic.com/v1/messages with model claude-haiku-4-5; low temp; 1-token classify schema; bearer from ANTHROPIC_API_KEY env or ~/.mindrian.env"
      pattern: 'api\.anthropic\.com'
---

<objective>
Build the UserPromptSubmit detection layer that recognizes when a user has typed a "venture sentence" (the trigger that fires the 30-second MVA pipeline). This is the entry pin of the entire phase: every other plan reads the state file this plan writes.

Per binding decision OQ3 (lean: Haiku 4.5 with heuristic fallback) and B7 (any-1-agent failure is graceful degrade -- the detection layer must NEVER block the user's prompt from reaching Claude). The hook is best-effort, exits 0 on any error, and is subject to a 1500ms hook budget (per the existing UserPromptSubmit hook timeouts in hooks.json).

Purpose: every downstream plan in this phase depends on knowing "is this prompt a venture trigger?" Without a deterministic, sub-1500ms classifier and a session-scoped state file, plan 118-01's dispatch never knows whether to fire.

Output:
- scripts/mva-detect.cjs (the hook)
- lib/core/mva-classifier.cjs (the brain)
- lib/core/mva-state.cjs (the contract for the rest of the phase)
- ~/.mindrian/mva/<session-id>.json (the per-session state file -- the wire between plans)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/the-30-second-mva.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/reward-before-investment-rule.md
@hooks/hooks.json
@lib/core/brain-client.cjs
@lib/core/resolve-brain-key.cjs

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor should use these directly -- no codebase exploration needed. -->

From lib/core/resolve-brain-key.cjs (the env-var resolution pattern; mirror this for ANTHROPIC_API_KEY):
```javascript
// Precedence: process.env -> ~/.mindrian.env -> .env in CWD -> null
function resolveBrainKey() { ... }
// Pattern to mirror for ANTHROPIC_API_KEY:
function resolveAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // read ~/.mindrian.env, parse KEY=value lines, return ANTHROPIC_API_KEY value
}
```

From scripts/auto-explore-drain.cjs (the precedent UserPromptSubmit drain hook -- mirror its exit-0-on-any-error pattern; mirror its stderr-only logging; never print to stdout):
```javascript
// Hook entry pattern:
// 1. Try { read env, do work } catch { stderr.write + exit 0 }
// 2. Never throw; never exit !=0; hook timeout is 1500ms
// 3. State file writes are atomic (write tmpfile + rename)
```

From hooks/hooks.json UserPromptSubmit section (current shape):
```json
"UserPromptSubmit": [
  { "hooks": [{ "command": "...intent-classifier", "timeout": 2000 }] },
  { "hooks": [{ "command": "...brain-derivation-drain.cjs", "timeout": 2000 }] },
  { "hooks": [{ "command": "...operator-update.cjs", "timeout": 3000 }] },
  { "hooks": [{ "command": "...jtbd-update.cjs userprompt", "timeout": 3000 }] },
  { "hooks": [{ "command": "...auto-explore-drain.cjs", "timeout": 3000 }] }
]
// Phase 118 inserts mva-detect.cjs AFTER intent-classifier (so operator state is fresh)
// and BEFORE auto-explore-drain (so downstream sees the MVA state file).
// New entry timeout: 1500ms.
```

From lib/core/rs-egress-telemetry.cjs (the Part 8 sanitized-telemetry pattern; mirror its sha256 + scalar-only output schema):
```javascript
// Emit pattern: { event, timestamp, sha256_of_input, scalars_only: { ... } }
// NEVER emit raw sentence text; ALWAYS sha256-hash it
```
</interfaces>

<reference_only>
- docs/MINDRIAN-CANON.md Part 8 (Brain boundary: zero user-content egress)
- docs/MINDRIAN-CANON.md Part 10 (conversation as product; first-touch is sacred)
- ~/.claude/projects/-home-jsagi/memory/feedback_larry_pedagogical_guided_first.md
- scripts/auto-explore-drain.cjs (precedent hook structure)
- scripts/preflight-tension-surface.cjs (precedent hook with state-file output)
- ~/.claude/projects/-home-jsagi/memory/feedback_v1131_execution_plan_is_contract.md
</reference_only>
</context>

<open_questions>
These came from CONTEXT.md gray areas OQ1, OQ3, OQ7. Status:

**OQ3 (this plan): Detection model for "is this a venture sentence?"**
- LEAN: Haiku 4.5 with strict 1-sentence-classify prompt + heuristic fallback when no API key.
- Open: confirm Haiku 4.5 model ID (latest is `claude-haiku-4-5`) is current as of 2026-05-15.
- Open: cost ceiling -- 1 classification per UserPromptSubmit means ~50-200/day per active user. At ~$0.001/classification = $0.05-$0.20/day. Acceptable? Yes per source spec ("fast Claude mini model").
- Open: should we cache more aggressively (across sessions, hash by normalized sentence)? Lean: in-session only for v1.13.0; cross-session is v1.14.0 follow-up.

**OQ1 (bilingual scope): Hebrew + English vs English-only?**
- **LOCKED (LD1 in 118-CONTEXT.md): English-only for v1.13.0.** Hebrew + bilingual support deferred to v1.14.0. Hebrew detection STILL fires for graceful refusal (OQ7 lean is now part of LD1).

**OQ7 (Hebrew refusal): What happens when user types Hebrew if OQ1=English-only?**
- LEAN (folded into LD1): Detect Hebrew (any character in U+0590-U+05FF range), emit a graceful refusal in Hebrew + English in the brief. DO NOT silently run pipeline.
- Implementation: classifier returns `{ venture: false, reason: 'hebrew_unsupported_v1.13.0' }`. mva-detect.cjs writes a separate hint file the next agent (118-03 progressive output) reads to render the refusal once.
- Refusal text: "MindrianOS does not yet support Hebrew in v1.13.0. Please try in English. (MindrianOS לא תומך בעברית ב-v1.13.0; אנא נסה באנגלית.)"
</open_questions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Classifier core + state contract + heuristic data</name>
  <files>lib/core/mva-classifier.cjs, lib/core/mva-classifier.test.cjs, lib/core/mva-state.cjs, data/mva-heuristic-keywords.json</files>
  <behavior>
    Tests (write first, then implement):
    - Test 1: heuristic positive cases. Given 3 sentences ["I have an idea for a couples finance app", "thinking about building a SaaS for dentists", "considering launching a platform for nonprofits"], heuristic classifier returns { venture: true, source: 'heuristic', confidence: 'high' } for all 3.
    - Test 2: heuristic negative cases. Given 3 sentences ["fix the failing test in foo.test.js", "/mos:status", "git push origin main"], heuristic returns { venture: false, source: 'heuristic', reason: 'matches_negative_pattern' }.
    - Test 3: Hebrew detection. Given "יש לי רעיון לאפליקציה" (has Hebrew chars in U+0590-U+05FF), classifier returns { venture: false, source: 'language_detect', reason: 'hebrew_unsupported_v1.13.0' } BEFORE any Haiku call. (per LD1 in 118-CONTEXT.md)
    - Test 4: short-circuit on length. Given "" or "hi" (< 12 chars) OR a 700-char paragraph (> 600 chars), classifier returns { venture: false, reason: 'length_out_of_range' } WITHOUT any API call.
    - Test 5: cache hit. Calling classify("I have an idea for a couples finance app") twice in the same process returns the same result from cache (the second call MUST NOT hit the API; verify via mock counter). Cache key = sha256(normalized_sentence).
    - Test 6: state I/O round trip. writePending({ sha, sentence_sha256, classification }) then readPending() returns the same object. markRunning() then isAlreadyRunning() returns true. markComplete() then isAlreadyRunning() returns false. State file at ~/.mindrian/mva/<session-id>.json (session-id from CLAUDE_SESSION_ID env or 'default'). State file is atomic (tmpfile + rename).
    - Test 7: heuristic-only mode when ANTHROPIC_API_KEY is unset. classify() returns heuristic result with source: 'heuristic_fallback', confidence: 'medium'. NO fetch call attempted (verify via fetch mock counter = 0).

    Run: `node --test lib/core/mva-classifier.test.cjs` MUST pass all 7 tests.
  </behavior>
  <action>
    Step 1 (RED): Write all 7 tests in lib/core/mva-classifier.test.cjs using Node's built-in test runner. Use the mock pattern from lib/core/dual-path-detector.test.cjs as the model.

    Step 2 (DATA): Create data/mva-heuristic-keywords.json with three keyed arrays:
    - "venture_keywords" (high-positive signals): ["have an idea for", "thinking about building", "thinking about a", "considering launching", "considering building", "startup idea", "app for", "platform for", "product for", "service for", "what if i built", "i want to build", "venture", "i'm exploring", "exploring an idea", "working on an idea"]
    - "venture_negative_patterns" (kill signals -- if ANY match, override to non-venture): ["^/mos:", "^/gsd:", "^git ", "^npm ", "fix the", "debug this", "the failing test", "edit the", "/clear", "/compact"]
    - "language_pattern_hebrew": "[֐-׿]" (single-char Hebrew range; per LD1 in 118-CONTEXT.md)

    Step 3 (GREEN): Implement lib/core/mva-classifier.cjs exposing classify(sentence, opts), isVentureSentence (boolean alias), and loadHeuristic. Internal flow:
    1. If sentence.length < 12 OR > 600 -> short-circuit return { venture: false, reason: 'length_out_of_range' }
    2. Run language detect using the Hebrew regex from heuristic data -- if any match, return { venture: false, reason: 'hebrew_unsupported_v1.13.0' }
    3. Check in-memory Map cache keyed by sha256(normalized_sentence). If hit, return cached.
    4. Run heuristic: lowercase the sentence; if ANY venture_negative_pattern matches, return false. If ANY venture_keywords matches, return heuristic-positive.
    5. If ANTHROPIC_API_KEY is resolvable (mirror lib/core/resolve-brain-key.cjs precedence: env -> ~/.mindrian.env -> CWD/.env), call Haiku 4.5 with this exact system prompt:
       "You are a 1-sentence classifier. Output ONLY 'venture' or 'not-venture'. A 'venture' sentence describes a business idea, product, startup, app, platform, or commercial undertaking the user is considering or building. A 'not-venture' sentence is about code, admin tasks, debugging, or any non-business topic. Output one word only."
       Model: 'claude-haiku-4-5'. Max tokens: 4. Temperature: 0. Timeout: 1200ms (leaving 300ms hook overhead).
    6. If API call fails OR times out, fall back to heuristic result.
    7. Cache the result before return.

    Step 4: Implement lib/core/mva-state.cjs. State dir: path.join(os.homedir(), '.mindrian', 'mva'). State file: <session-id>.json where session-id = process.env.CLAUDE_SESSION_ID || 'default'. Atomic writes via fs.writeFileSync to tmpfile + fs.renameSync. Functions: writePending(payload), readPending() -> payload | null, markRunning(), markComplete(), isAlreadyRunning() -> boolean.

    Step 5: Run tests. All 7 must pass.

    Implementation references: OQ3 lean + LD1 (in 118-CONTEXT.md). Reuse lib/core/resolve-brain-key.cjs file-permission check pattern. NO Brain MCP calls anywhere in this file (Canon Part 8). NO stdout writes (Phase 110 telemetry side-channel rule).
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-classifier.test.cjs</automated>
  </verify>
  <done>
    - All 7 tests pass.
    - lib/core/mva-classifier.cjs has zero `require('./brain-client')` and zero `mcp__brain_` references (verify: grep returns 0).
    - lib/core/mva-state.cjs writes atomically (tmpfile + rename pattern verifiable in source).
    - data/mva-heuristic-keywords.json is valid JSON (verify: `node -e "JSON.parse(require('fs').readFileSync('data/mva-heuristic-keywords.json'))"` exits 0).
    - No console.log / no process.stdout.write in any of the new files (verify: grep returns 0).
  </done>
</task>

<task type="auto">
  <name>Task 2: UserPromptSubmit hook wiring (scripts/mva-detect.cjs + hooks.json registration)</name>
  <files>scripts/mva-detect.cjs, hooks/hooks.json</files>
  <action>
    Step 1: Create scripts/mva-detect.cjs. Mirror the exit-0-on-error pattern from scripts/auto-explore-drain.cjs verbatim. The hook receives the user's prompt via stdin (per Claude Code hook spec, UserPromptSubmit passes a JSON payload to stdin containing `prompt`). Read stdin synchronously with a 200ms timeout (since hook total budget is 1500ms and we need headroom for the classifier).

    Hook flow:
    1. Read stdin payload; parse JSON; extract `prompt` field. If parse fails or prompt is missing, exit 0 silently.
    2. require('../lib/core/mva-state.cjs') and check isAlreadyRunning(). If already running, exit 0 (a previous turn's pipeline is still going; do not re-fire).
    3. require('../lib/core/mva-classifier.cjs') and call classify(prompt). Wrap in try/catch; on any throw, log to stderr and exit 0.
    4. If classification.venture === true, call mvaState.writePending({ sentence_sha256: sha256(prompt), classified_at: Date.now(), classifier_source: classification.source, classifier_confidence: classification.confidence }). NEVER write the raw prompt to disk.
    5. If classification.reason === 'hebrew_unsupported_v1.13.0', call mvaState.writePending with { hebrew_refusal: true }. (Plan 118-03 will read this and render the refusal.)
    6. Emit one telemetry event to ~/.mindrian/telemetry/v1.13/mva.jsonl (the OQ8-lean path). Event shape (per Phase 110 sanitization pattern from lib/core/rs-egress-telemetry.cjs): { event: 'mva_classified', timestamp: ISO8601, sha256_of_sentence: sha, venture: bool, source: classification.source, classified_in_ms: elapsed }. NEVER emit raw sentence text.
    7. Exit 0.

    Step 2: Register the hook in hooks/hooks.json. Insert a new entry in the "UserPromptSubmit" array, positioned AFTER the intent-classifier entry (line 285-293 of current file) and BEFORE the brain-derivation-drain entry. Use this exact shape:
    ```json
    {
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/mva-detect.cjs\"",
          "timeout": 1500
        }
      ]
    }
    ```

    Step 3: Add an end-to-end smoke test at lib/core/mva-detect.smoke.test.cjs that:
    - Spawns `node scripts/mva-detect.cjs` as a child process with mock stdin containing `{"prompt":"I have an idea for a couples finance app"}`
    - Asserts exit code = 0
    - Asserts ~/.mindrian/mva/<session-id>.json exists with venture: true (use a temp HOME via env override)
    - Asserts the entire process completes in < 1500ms

    Implementation references: scripts/auto-explore-drain.cjs (precedent stdin-reading hook). hooks/hooks.json (Phase 117 entry as model). Per OQ8 lean: emit telemetry from day 1 to ~/.mindrian/telemetry/v1.13/mva.jsonl; if Phase 121 hasn't shipped its writer yet, Phase 118 owns this path under the precedent of Plan 88.1-16 query-efficiency-telemetry.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-detect.smoke.test.cjs && python3 -c "import json; d=json.load(open('hooks/hooks.json')); ups=d['hooks']['UserPromptSubmit']; cmds=[h['command'] for entry in ups for h in entry['hooks']]; assert any('mva-detect.cjs' in c for c in cmds), 'mva-detect.cjs not registered'; print('hook registered OK')"</automated>
  </verify>
  <done>
    - The smoke test passes (hook spawns, exits 0, writes state file, completes in <1500ms).
    - mva-detect.cjs appears in hooks/hooks.json UserPromptSubmit array, positioned between intent-classifier and brain-derivation-drain.
    - Telemetry file ~/.mindrian/telemetry/v1.13/mva.jsonl contains one event after the smoke test runs.
    - Hook timeout is exactly 1500ms (verify by grep on the registered entry).
    - mva-detect.cjs has zero stdout writes (verify: grep 'process.stdout' returns 0; stderr-only for errors).
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. Reset state: `rm -rf ~/.mindrian/mva ~/.mindrian/telemetry/v1.13/mva.jsonl`
2. Run smoke test with venture sentence: `echo '{"prompt":"I have an idea for a couples finance app"}' | node scripts/mva-detect.cjs; echo "exit=$?"`
   - exit must be 0
   - ~/.mindrian/mva/default.json must exist with venture-positive contents
   - mva.jsonl must contain one mva_classified event
3. Run with non-venture sentence: `echo '{"prompt":"fix the failing test in foo.test.js"}' | node scripts/mva-detect.cjs; echo "exit=$?"`
   - exit must be 0
   - state file should NOT have venture: true (heuristic kills it via negative pattern)
4. Run with Hebrew: `echo '{"prompt":"יש לי רעיון לאפליקציה"}' | node scripts/mva-detect.cjs; echo "exit=$?"`
   - exit must be 0
   - state file must contain hebrew_refusal: true
5. Canon Part 8 sweep: `grep -rE "brain_query|brain_search|mcp__brain_|require.*brain-client" scripts/mva-detect.cjs lib/core/mva-classifier.cjs lib/core/mva-state.cjs` must return 0 matches.
6. Hook budget: re-run step 2 with `time` prefix; wall clock must be < 1500ms.
</verification>

<success_criteria>
- All automated tests in <verify> blocks pass.
- The hook is wired in hooks/hooks.json AND the smoke test confirms it fires on stdin payload.
- Zero user-content egress: grep shows no brain-client require, no Brain MCP tool name, no raw prompt written to telemetry or state.
- The state-file contract is the wire downstream plans depend on: 118-01 reads ~/.mindrian/mva/<session-id>.json to know whether to dispatch.
- Operator state from Phase 99 is undisturbed (the new hook does NOT call lib/conversation/operator.cjs).
- Phase 121 telemetry events emit to the expected path (per OQ8 lean).
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-00-SUMMARY.md` capturing:
- Files created (mva-detect.cjs, mva-classifier.cjs, mva-state.cjs, mva-heuristic-keywords.json, two test files)
- Hook entry registered in hooks/hooks.json (position + timeout)
- State file contract (path, schema, atomicity guarantee) -- this is what 118-01 reads
- Telemetry events emitted (event_id, schema, path)
- LD1 + LD2 references (English-only locked; Hebrew detection branch retained per LD1)
- Any deviations from plan
- Canon Part 8 self-audit results (zero forbidden matches)
</output>
</content>
</invoke>