---
phase: 118-30-second-mva-reward-before-investment
plan: "01"
slug: dispatch-architecture
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/mva-dispatcher.cjs
  - lib/core/mva-dispatcher.test.cjs
  - lib/core/mva-budget.cjs
  - lib/core/mva-budget.test.cjs
  - lib/core/mva-agent-contract.cjs
  - lib/core/mva-agent-contract.test.cjs
autonomous: true
requirements: [MVA-118-04, MVA-118-05, MVA-118-06]
canon_parts: [Part 2, Part 8]
beta_target: v1.13.0-beta.17
estimated_hours: 6-8
gap_closure: false

must_haves:
  truths:
    - "The dispatcher can fan out 6 agents in parallel and return whatever subset returned within a 45-second global wall-clock budget"
    - "Each agent gets at most 35 seconds OR the remaining global budget, whichever is less"
    - "Agent failures (exception, timeout, empty result) are caught and reported per-agent without aborting other agents"
    - "All 6 agents share a common AgentResult contract: { agent_id, status: ok|empty|error|timeout, duration_ms, payload?, error? }"
    - "The dispatcher is pure -- it does not perform I/O beyond invoking the agent functions passed in; the agent functions themselves own their I/O"
    - "Zero user-content egress: the dispatcher passes only the sentence_sha256 (NOT the raw sentence) to agents; the raw sentence is NEVER exposed via env var, side-channel, or any other mechanism (Canon Part 8 hard invariant)"
  artifacts:
    - path: lib/core/mva-agent-contract.cjs
      provides: "AgentResult shape + Agent function signature + a runAgent wrapper that adds per-agent timeout via AbortController and converts any throw into { status: error }"
      exports: ["runAgent", "AGENT_RESULT_SHAPE", "validateAgentResult"]
    - path: lib/core/mva-budget.cjs
      provides: "Global budget tracker. Constructor takes globalBudgetMs (default 45000). Exposes remainingMs(), perAgentMs(perAgentCapMs=35000) which returns min(perAgentCapMs, remainingMs()), and isExpired()."
      exports: ["createBudget", "GLOBAL_BUDGET_MS", "PER_AGENT_CAP_MS"]
    - path: lib/core/mva-dispatcher.cjs
      provides: "dispatch(agents, sentence_sha256, opts) -> AsyncIterable<AgentResult>. Async iterable so plan 118-03 can stream results as they arrive."
      exports: ["dispatch", "dispatchToArray"]
    - path: lib/core/mva-agent-contract.test.cjs
      provides: "Tests covering: agent returns ok, agent throws -> error, agent exceeds timeout -> timeout, agent returns null -> empty"
      contains: "describe('mva-agent-contract'"
    - path: lib/core/mva-budget.test.cjs
      provides: "Tests covering: budget starts at 45s, remaining decreases over time, perAgentMs respects cap AND respects remaining, isExpired returns true after 45s"
      contains: "describe('mva-budget'"
    - path: lib/core/mva-dispatcher.test.cjs
      provides: "Tests covering: 6 mock agents fan out in parallel, slow agents time out independently, fast agents stream before slow agents finish, all-fail returns 6 error results, global expiry truncates remaining"
      contains: "describe('mva-dispatcher'"
  key_links:
    - from: lib/core/mva-dispatcher.cjs
      to: lib/core/mva-budget.cjs
      via: require + createBudget(45000)
      pattern: 'createBudget'
    - from: lib/core/mva-dispatcher.cjs
      to: lib/core/mva-agent-contract.cjs
      via: require + runAgent(agentFn, budget, signal)
      pattern: 'runAgent'
---

<objective>
Build the parallel dispatch architecture that lets Plan 118-02's 6 specific agents fan out in parallel under a hard 45-second global wall-clock budget with per-agent 35-second caps (per binding decisions B1 + B2).

This plan ships ONLY the architecture (dispatcher + budget + contract). It does NOT ship any of the 6 specific agents -- those are 118-02. By splitting, Plan 118-02 implementers can write each agent against a stable contract without needing to redesign the timing/abort plumbing.

Per binding decision B7: any-1-agent failure must NOT abort the others. All-fail must NOT throw; it must return 6 error results so the caller (118-03 progressive streaming) can render the sharp-question fallback.

Purpose: the parallel-with-budgets primitive is the load-bearing piece of the entire phase. Get this right; everything downstream is a wiring job.

Output: 3 lib files + 3 test files. No hook changes (the dispatcher is invoked by the agent that 118-03 wires; it has no UserPromptSubmit surface of its own).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/the-30-second-mva.md
@lib/agents/auto-explore-agent.cjs
@lib/agents/tension-hook-agent.cjs

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

The AgentResult shape that Plan 118-02 will implement against:
```typescript
type AgentResult = {
  agent_id: 'brain_similar' | 'brain_cross_domain' | 'brain_classic_traps'
          | 'tavily_funding' | 'six_hats_red_black' | 'dashboard_graph';
  status: 'ok' | 'empty' | 'error' | 'timeout';
  duration_ms: number;
  payload?: any;       // agent-specific shape; opaque to dispatcher
  error?: string;      // sanitized message; NEVER stack trace, NEVER user content
};
```

The Agent function signature that Plan 118-02 will implement:
```typescript
type Agent = (context: AgentContext, signal: AbortSignal) => Promise<AgentResultPayload>;
type AgentContext = {
  sentence_sha256: string;        // dispatcher-provided -- ONLY identifier passed to agents
  remaining_budget_ms: number;    // dispatcher-provided
  // raw_sentence is NEVER exposed to agents (Canon Part 8 hard invariant).
  // Agents that need linguistic features must derive them from neighborhood-graph queries
  // against room.db (sentence-sha8 only), NOT from the raw sentence string.
  // process.env.MVA_SENTENCE is NEVER set. There is no escape hatch.
};
type AgentResultPayload = { status: 'ok'|'empty', payload: any } | null;
// If agent returns null OR throws OR exceeds timeout, dispatcher wraps with status=empty|error|timeout.
```

The dispatch function signature:
```typescript
async function* dispatch(
  agents: Array<{ id: string, fn: Agent }>,  // 6 agents from Plan 118-02
  sentence_sha256: string,
  opts?: { globalBudgetMs?: number, perAgentCapMs?: number }
): AsyncIterable<AgentResult>;
```

Reference precedent (mirror the pattern, not the literal code):
- lib/agents/auto-explore-agent.cjs:42-69 (the strict CJS + node-builtins-only + zero-stdout pattern)
- lib/agents/tension-hook-agent.cjs (sibling structure; mirror its error-handling envelope)
</interfaces>

<reference_only>
- Source spec lines 38-79 (the t=0/t=1/t=2/t=5-25 timeline; THIS IS INDICATIVE not literal -- the dispatcher fires all 6 in parallel at t=0 and yields each one as it returns)
- Source spec lines 107-113 (failure modes; the dispatcher returns the per-agent error so 118-03 can render the sharp question on all-fail)
- Source spec line 123 ("Agents return structured JSON within 35s budget each" -- this is the PER_AGENT_CAP_MS = 35000)
- Source spec line 113 ("Hard budget: 45 seconds maximum" -- this is GLOBAL_BUDGET_MS = 45000)
- Binding decisions B1, B2, B7 (from CONTEXT.md)
</reference_only>
</context>

<open_questions>
OQ that this plan touches: none net-new. This plan resolves the technical shape of B2 (45s global + 35s per agent) and B7 (graceful degrade). The leans in B2/B7 are accepted as binding.

Carry-forward note for downstream plans:
- 118-03 (progressive streaming) will consume the AsyncIterable<AgentResult> directly.
- 118-04 (deck generation) will consume the final array of AgentResults via dispatchToArray.
- 118-02 will implement each of the 6 agents to the Agent contract above.
</open_questions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Agent contract + per-agent runner with AbortController</name>
  <files>lib/core/mva-agent-contract.cjs, lib/core/mva-agent-contract.test.cjs</files>
  <behavior>
    Tests (RED first):
    - Test 1: Agent returns { status: 'ok', payload: {x:1} }. runAgent wraps as { agent_id: 'test', status: 'ok', duration_ms: <num>, payload: {x:1} }.
    - Test 2: Agent throws new Error('boom'). runAgent returns { agent_id: 'test', status: 'error', duration_ms: <num>, error: 'boom' }. Error message is the throw's `.message` ONLY -- no stack trace, no other properties.
    - Test 3: Agent returns null. runAgent returns { agent_id: 'test', status: 'empty', duration_ms: <num> }.
    - Test 4: Agent exceeds timeout (uses await new Promise(r => setTimeout(r, 500)) but timeout is 100). runAgent invokes signal.abort() and returns { agent_id: 'test', status: 'timeout', duration_ms: ~100 }.
    - Test 5: Agent reads context.remaining_budget_ms and observes the AbortSignal. Sanity: agent receives both args; signal.aborted is false at start; signal.aborted becomes true when timeout fires.
    - Test 6: validateAgentResult rejects results missing agent_id or status, accepts well-formed results.

    Run: `node --test lib/core/mva-agent-contract.test.cjs` passes all 6.
  </behavior>
  <action>
    Step 1 (RED): Write all 6 tests using Node's built-in test runner. Mock agents are inline functions.

    Step 2 (GREEN): Implement lib/core/mva-agent-contract.cjs.

    Required exports:
    - AGENT_RESULT_SHAPE: a frozen object documenting the AgentResult shape (used by validateAgentResult).
    - validateAgentResult(result): returns boolean; checks agent_id is string, status is one of the 4 enum values, duration_ms is number >= 0.
    - runAgent(agentDef, context, opts): async function that:
      1. Records t0 = Date.now()
      2. Creates an AbortController
      3. Sets up a setTimeout that calls controller.abort() after opts.timeoutMs (default 35000)
      4. Calls agentDef.fn({ ...context, remaining_budget_ms: opts.timeoutMs }, controller.signal)
      5. Wraps in try/catch:
         - On resolve with { status: 'ok'|'empty', payload }: clear timer, return { agent_id: agentDef.id, status, duration_ms: Date.now()-t0, payload }
         - On resolve with null: clear timer, return { agent_id, status: 'empty', duration_ms }
         - On throw: if signal.aborted is true, return { agent_id, status: 'timeout', duration_ms: Date.now()-t0 }. Otherwise return { agent_id, status: 'error', duration_ms, error: String(err && err.message || err).slice(0, 200) }.

    Key invariants:
    - NEVER serialize stack traces (Part 8 -- stack traces can contain user content).
    - Error messages are capped at 200 chars and sliced to prevent any user-content blow-through.
    - The timer is cleared in BOTH the success path and the catch path (no leaked handles).
    - The AgentContext object passed to the agent function contains ONLY `sentence_sha256` and `remaining_budget_ms` keys. NEVER set `process.env.MVA_SENTENCE` anywhere. NEVER pass a `sentence`, `prompt`, or `raw_text` key. The raw sentence is unreachable from agents by construction.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-agent-contract.test.cjs</automated>
  </verify>
  <done>
    - All 6 tests pass.
    - lib/core/mva-agent-contract.cjs has no require statements except node builtins.
    - No `err.stack` or `err.toString()` anywhere (verify: grep returns 0).
    - No `process.env.MVA_SENTENCE` reads OR writes anywhere (verify: grep returns 0).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Budget tracker</name>
  <files>lib/core/mva-budget.cjs, lib/core/mva-budget.test.cjs</files>
  <behavior>
    Tests (RED first):
    - Test 1: createBudget(45000); remainingMs() is approximately 45000 immediately. After awaiting 100ms, remainingMs() is approximately 44900 (allow +/- 50ms slop).
    - Test 2: createBudget() with no args defaults to GLOBAL_BUDGET_MS (45000).
    - Test 3: perAgentMs(35000) returns 35000 when remaining is 45000.
    - Test 4: After consuming 20 seconds (use sinon-style fake timer OR just await; in test set globalBudgetMs to 200, then await 150ms, then perAgentMs(180) should return ~50, not 180 -- because perAgentMs caps at min(perAgentCap, remainingMs)).
    - Test 5: isExpired() is false initially; after awaiting beyond globalBudgetMs, isExpired() is true.
    - Test 6: GLOBAL_BUDGET_MS exported constant === 45000; PER_AGENT_CAP_MS exported constant === 35000.

    Run: `node --test lib/core/mva-budget.test.cjs` passes all 6.
  </behavior>
  <action>
    Step 1 (RED): Write all 6 tests. Use real setTimeout/await; do not import a timer-mocking library (zero new dependencies).

    Step 2 (GREEN): Implement lib/core/mva-budget.cjs.
    ```javascript
    const GLOBAL_BUDGET_MS = 45000;
    const PER_AGENT_CAP_MS = 35000;
    function createBudget(globalBudgetMs = GLOBAL_BUDGET_MS) {
      const startedAt = Date.now();
      return {
        startedAt,
        globalBudgetMs,
        remainingMs() { return Math.max(0, globalBudgetMs - (Date.now() - startedAt)); },
        perAgentMs(perAgentCapMs = PER_AGENT_CAP_MS) {
          return Math.max(0, Math.min(perAgentCapMs, this.remainingMs()));
        },
        isExpired() { return this.remainingMs() === 0; },
        elapsedMs() { return Date.now() - startedAt; }
      };
    }
    module.exports = { createBudget, GLOBAL_BUDGET_MS, PER_AGENT_CAP_MS };
    ```
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-budget.test.cjs</automated>
  </verify>
  <done>
    - All 6 tests pass.
    - GLOBAL_BUDGET_MS and PER_AGENT_CAP_MS are exported and have the documented values.
    - No dependencies on any other lib/core file (this is a leaf module).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: The dispatcher (AsyncIterable + parallel fan-out)</name>
  <files>lib/core/mva-dispatcher.cjs, lib/core/mva-dispatcher.test.cjs</files>
  <behavior>
    Tests (RED first):
    - Test 1: 6 fast agents (each resolves immediately with { status: 'ok', payload: {agent: id} }). Iterating dispatch yields 6 AgentResults; all have status: 'ok'; total wall-clock < 200ms.
    - Test 2: 6 slow agents (each awaits 100ms; per-agent cap 50ms). All 6 yielded results have status: 'timeout'. Wall-clock < 200ms.
    - Test 3: Mix -- 3 fast (resolve in 10ms) + 3 slow (sleep 1000ms; per-agent cap 100ms). Streaming order: 3 ok results yield first (within 50ms), then 3 timeout results yield (within 150ms). Verify iterator order via timestamps.
    - Test 4: Global budget short. globalBudgetMs=100; 6 agents each sleep 1000ms. All 6 results yield within ~120ms; remaining agents are aborted at 100ms; statuses are 'timeout'.
    - Test 5: dispatchToArray collects to a Promise<Array>. Equivalent to `for await (const r of dispatch(...))` + push.
    - Test 6: sentence_sha256 is passed to agent context. Agent inspects context.sentence_sha256; result includes that hash. Dispatcher does NOT pass raw sentence to context (verify: agent receives context object with sentence_sha256 but no `sentence` or `prompt` key, AND process.env.MVA_SENTENCE is undefined throughout dispatch).

    Run: `node --test lib/core/mva-dispatcher.test.cjs` passes all 6.
  </behavior>
  <action>
    Step 1 (RED): Write all 6 tests. Agents are inline mock functions.

    Step 2 (GREEN): Implement lib/core/mva-dispatcher.cjs.

    Required exports:
    - `async function* dispatch(agents, sentence_sha256, opts={})`: the streaming variant. Implementation:
      1. const budget = createBudget(opts.globalBudgetMs);
      2. For each agent, kick off `runAgent(agent, { sentence_sha256, remaining_budget_ms: budget.remainingMs() }, { timeoutMs: budget.perAgentMs(opts.perAgentCapMs) })` and collect promise.
      3. Use a "promise pool" pattern: maintain a Map<promise, agentId>. Each promise is wrapped so that on settle, it emits via an internal queue. Use a small queue + a "resolver" to yield each settled result as it arrives. Reference algorithm: https://2ality.com/2017/12/for-await-of-non-iterables.html#example_iterating-over-asynchronously-settled-promises (Axel Rauschmayer's "settle-then-yield" pattern).
      4. Yield each result as it settles.
      5. If global budget expires while agents are still pending, the per-agent runAgent calls observe the signal abort (each runAgent's timeoutMs is bounded by remaining; remaining=0 means timeoutMs=0 and they immediately abort). Yield their timeout results.
    - `async function dispatchToArray(agents, sentence_sha256, opts={})`: convenience wrapper. const results = []; for await (const r of dispatch(...)) results.push(r); return results.

    Key invariants:
    - NO logging to stdout (Phase 110 telemetry rule).
    - NO write to ~/.mindrian/* from inside the dispatcher (state writes happen in 118-03 / 118-04).
    - The dispatcher accepts any agent that conforms to the Agent contract; it has no knowledge of which agents are which (Plan 118-02 will supply them).
    - The dispatcher MUST NEVER read or write process.env.MVA_SENTENCE. The raw sentence is not in scope at this layer (Canon Part 8 hard invariant; see Plan 118-00's classifier for where the raw sentence lives and dies).
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-dispatcher.test.cjs</automated>
  </verify>
  <done>
    - All 6 tests pass.
    - dispatch is an AsyncGenerator (typeof dispatch(...).next === 'function').
    - Slow agents in mixed scenarios DO NOT block fast agent results (Test 3 verifies streaming order).
    - Zero stdout writes (grep verifies).
    - Zero Brain MCP references (grep verifies).
    - Zero process.env.MVA_SENTENCE reads or writes (grep verifies).
    - No raw sentence ever appears in any agent context (Test 6 verifies).
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. All 3 test files pass: `node --test lib/core/mva-agent-contract.test.cjs lib/core/mva-budget.test.cjs lib/core/mva-dispatcher.test.cjs`
2. Canon Part 8 sweep on the 3 new lib files: `grep -rE "brain_query|mcp__brain_|require.*brain-client|MVA_SENTENCE" lib/core/mva-agent-contract.cjs lib/core/mva-budget.cjs lib/core/mva-dispatcher.cjs` returns 0.
3. No stdout writes: `grep -E "process.stdout|console.log" lib/core/mva-agent-contract.cjs lib/core/mva-budget.cjs lib/core/mva-dispatcher.cjs` returns 0.
4. Dispatcher contract documented in code (JSDoc comments on dispatch, dispatchToArray, runAgent, createBudget).
</verification>

<success_criteria>
- All automated tests pass.
- The 3 modules form a stable contract that Plan 118-02 implements against.
- Streaming-as-settled behavior is verified by Test 3 (mixed fast/slow scenario).
- Per-agent timeout AND global timeout both fire correctly (Tests 2 and 4).
- Zero user-content paths: sentence_sha256 is the only sentence-related field in the agent context (Test 6). No MVA_SENTENCE escape hatch anywhere in this layer (Canon Part 8 invariant).
- The dispatcher is dependency-free except for the two sibling lib/core modules (mva-budget + mva-agent-contract).
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-01-SUMMARY.md` capturing:
- The Agent contract (signature, AgentResult shape) -- this is what Plan 118-02 implements against, repeat here verbatim
- The dispatcher signature (dispatch + dispatchToArray)
- Budget defaults (45000 global, 35000 per-agent) and the rationale
- Test coverage stats (6+6+6 = 18 tests, all passing)
- Streaming order proof from Test 3
- Canon Part 8 self-audit results (zero MVA_SENTENCE references; sentence_sha256 is the only sentence-derived value in AgentContext)
</output>
</content>
</invoke>