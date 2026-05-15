---
phase: 118-30-second-mva-reward-before-investment
plan: "02"
slug: six-agents
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - lib/agents/mva/brain-similar-ventures.cjs
  - lib/agents/mva/brain-cross-domain.cjs
  - lib/agents/mva/brain-classic-traps.cjs
  - lib/agents/mva/tavily-funding-scan.cjs
  - lib/agents/mva/six-hats-red-black.cjs
  - lib/agents/mva/dashboard-graph-neighborhood.cjs
  - lib/agents/mva/index.cjs
  - lib/agents/mva/test-all-six-agents.cjs
  - data/mva-agent-prompts.json
autonomous: true
requirements: [MVA-118-07, MVA-118-08, MVA-118-09, MVA-118-10, MVA-118-11, MVA-118-12]
canon_parts: [Part 2, Part 4, Part 5, Part 8]
beta_target: v1.13.0-beta.17
estimated_hours: 10-14
gap_closure: false

must_haves:
  truths:
    - "Six agents exist as separate files in lib/agents/mva/, each conforming to the Agent contract from Plan 118-01"
    - "Each Brain agent (3 of them) sends ONLY framework names, problem types, and phase identifiers to the Brain MCP -- never the raw sentence, never any user content"
    - "The Tavily agent queries public funding sources using a sanitized, generic query derived from the sentence's keywords (not the raw sentence)"
    - "The Six-hats agent invokes the existing persona-analyst pattern locally and surfaces ONLY red-hat and black-hat outputs (per binding decision B1 item 5)"
    - "The Dashboard agent reads room.db via lib/core/navigation.cjs (the Phase 109 chokepoint -- Canon Part 9 invariant) and returns a graph-neighborhood snapshot"
    - "All six agents return AgentResult-compliant payloads within their per-agent timeout"
    - "Each agent's payload is renderable by Plan 118-03's progressive output module (each payload has a 1-3 line human-readable summary + structured data for the deck)"
  artifacts:
    - path: lib/agents/mva/brain-similar-ventures.cjs
      provides: "Agent 1 (B1 item 1): calls brain_search for ventures matching the sentence's domain handles; returns top-3 with name + status + brief"
      exports: ["run"]
    - path: lib/agents/mva/brain-cross-domain.cjs
      provides: "Agent 2 (B1 item 2): calls brain_search in cross-domain mode for analogous frameworks; returns top-1 analogy"
      exports: ["run"]
    - path: lib/agents/mva/brain-classic-traps.cjs
      provides: "Agent 3 (B1 item 3): calls brain_query for FailureMode framework chains; returns top-1 classic-trap finding"
      exports: ["run"]
    - path: lib/agents/mva/tavily-funding-scan.cjs
      provides: "Agent 4 (B1 item 4): calls Tavily public-funding search; returns top-1 funding match (track + amount + deadline)"
      exports: ["run"]
    - path: lib/agents/mva/six-hats-red-black.cjs
      provides: "Agent 5 (B1 item 5): generates Red Hat (intuitive flag) + Black Hat (risk flag) outputs locally; never queries Brain"
      exports: ["run"]
    - path: lib/agents/mva/dashboard-graph-neighborhood.cjs
      provides: "Agent 6 (B1 item 6): reads room.db via navigation.cjs; returns 1-2 hop neighborhood snapshot of existing decision nodes"
      exports: ["run"]
    - path: lib/agents/mva/index.cjs
      provides: "Aggregates all 6 agents into the array shape that lib/core/mva-dispatcher.cjs:dispatch() consumes: [{id, fn}, ...]"
      exports: ["ALL_AGENTS"]
    - path: lib/agents/mva/test-all-six-agents.cjs
      provides: "Smoke test runner: imports ALL_AGENTS, runs dispatcher with mocked Brain/Tavily/SQL adapters, asserts 6 results return within budget, each conforms to AgentResult shape"
      contains: "describe('six agents'"
    - path: data/mva-agent-prompts.json
      provides: "Centralized prompt templates for the 3 Brain agents -- ONLY contains framework names, phase identifiers, and Cypher templates with $-bound parameters; NEVER contains user-content placeholders"
      contains: '"brain_similar_ventures":'
  key_links:
    - from: lib/agents/mva/index.cjs
      to: lib/core/mva-dispatcher.cjs
      via: "ALL_AGENTS array shape matches dispatch() agents param"
      pattern: 'ALL_AGENTS'
    - from: lib/agents/mva/brain-similar-ventures.cjs
      to: lib/core/brain-client.cjs
      via: require + callTool('brain_search', { query: <framework-name>, ... })
      pattern: 'brainClient\.search|callTool'
    - from: lib/agents/mva/dashboard-graph-neighborhood.cjs
      to: lib/core/navigation.cjs
      via: "Phase 109 single chokepoint for SQL reads; mandatory per Canon Part 9"
      pattern: "require.*navigation\\.cjs"
    - from: lib/agents/mva/tavily-funding-scan.cjs
      to: Tavily API
      via: "mcp__tavily-mcp__tavily-search via the tool-invocation protocol; OR direct fetch to api.tavily.com/search if TAVILY_API_KEY env is set"
      pattern: "tavily"
---

<objective>
Implement the 6 specific agents named in binding decision B1 (NOT the abstract list from 118-CONTEXT.md). Each agent is a CJS module exporting a `run(context, signal)` function that conforms to the Agent contract from Plan 118-01.

The agents fan out in parallel via the Plan 118-01 dispatcher (under 45s global budget, 35s per-agent cap). The dispatcher does not know which agent is which; this plan just makes 6 of them and wires them into an array.

Critical Canon Part 8 constraint: the 3 Brain agents MUST send only generic handles (framework names from existing Brain framework taxonomy, phase identifiers, problem-type enums, sha256 hashes). NEVER send the raw sentence. NEVER send any user-content strings. The literal sentence stays in the process (in env var MVA_SENTENCE if absolutely needed; agents that don't need it MUST NOT read it).

Purpose: deliver 6 distinct first-touch intelligence surfaces to the user within 30 seconds of the first sentence. Each one is something the user could not get from ChatGPT in the same time budget.

Output: 6 agent files + 1 index + 1 test runner + 1 prompts data file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-01-dispatch-architecture-PLAN.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/the-30-second-mva.md
@docs/MINDRIAN-CANON.md
@lib/core/brain-client.cjs
@lib/core/navigation.cjs
@lib/agents/auto-explore-agent.cjs

<interfaces>
<!-- Key types and contracts from Plan 118-01 -- the contract this plan implements against -->

```typescript
type Agent = (context: AgentContext, signal: AbortSignal) => Promise<AgentResultPayload>;
type AgentContext = {
  sentence_sha256: string;
  remaining_budget_ms: number;
};
type AgentResultPayload =
  | { status: 'ok', payload: { summary_line: string, deck_data: any } }
  | { status: 'empty', payload: { reason: string } }
  | null;
```

Each agent's run() must:
1. Observe the AbortSignal via signal.aborted checks at any await boundary
2. Return within remaining_budget_ms
3. Return ONLY the payload shape above (status: 'ok' | 'empty' | null)
4. Throw if there's a genuine programming error (dispatcher converts to status: 'error')

From lib/core/brain-client.cjs (the existing Brain MCP wrapper -- the 3 Brain agents call into this; line 256+ from the codebase grep earlier):
```typescript
async function callTool(toolName: 'brain_query'|'brain_search'|'brain_schema', args: object): Promise<any>;
async function query(cypher: string, params: object): Promise<{records: any[]}>;
async function search(queryText: string, options?: object): Promise<any>;
async function isAvailable(): Promise<boolean>;  // returns false if Brain unreachable -> agent should return status:'empty'
```

From lib/core/navigation.cjs (the Phase 109 chokepoint; MUST be the only path the Dashboard agent uses to read room.db):
- The 13-function navigation API (see lib/core/navigation/ subdir)
- Key function: getNeighborhood(focusNodeId, opts) -> { nodes: [], edges: [] }

From lib/agents/auto-explore-agent.cjs lines 27-41 (the Canon Part 8 hard rules pattern -- mirror verbatim):
```
//   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
//   2. NEVER require any Brain-MCP client module DIRECTLY for raw queries;
//      use lib/core/brain-client.cjs which enforces the wire-schema sanitization
//      AND only with framework-name/phase-id/enum args, never user content.
//   3. NEVER write to stdout / stderr (telemetry side-channel rule).
```

From CONTEXT.md OQ8 lean (per-agent telemetry):
- Each agent should emit `mva_agent_returned` event to ~/.mindrian/telemetry/v1.13/mva.jsonl with: agent_id, duration_ms, status (ok|empty|error|timeout). This is wired via the dispatcher in Plan 118-03; agents themselves do NOT write telemetry.
</interfaces>

<reference_only>
- Source spec lines 47-65 (the t=5 / t=8 / t=12 / t=15 / t=20 / t=24 timeline -- INDICATIVE order of agent output, used by 118-03 for streaming)
- Source spec line 67 ("One question you haven't asked yourself" -- this is the Six-hats Red+Black flag voicing, not a separate agent)
- Canon Part 2 (team-around-navigator -- the 6 agents are a Team, each with a specific hat-like specialization)
- Canon Part 5 (evidence tiers -- agent outputs carry tier markers: Brain=Practitioner, Tavily=Operational/public, six-hats=None/intuition, Dashboard=Operational/internal-graph)
- Canon Part 8 (the boundary -- this is the most enforcement-heavy plan in the phase)
- lib/agents/auto-explore-agent.cjs (the precedent agent file; mirror its structure + comment style + Part 8 self-policing header)
- ~/.claude/projects/-home-jsagi/memory/feedback_reverse_salient_agent_graph_native.md
</reference_only>
</context>

<open_questions>
This plan touches OQ4 (where does Brain agent send queries) and OQ8 (telemetry shape per agent). Both have settled leans:
- OQ4: Brain agents send framework-name/phase-id/enum payloads via lib/core/brain-client.cjs, which is Part 8-compliant.
- OQ8: Telemetry is emitted by the dispatcher (Plan 118-03), not by individual agents. Agents are pure functions.

New open question raised by this plan (carry-forward to 118-03):
**OQ9. Tavily fallback when TAVILY_API_KEY is missing.**
If the user has no Tavily key, agent 4 should return `{ status: 'empty', payload: { reason: 'tavily_unavailable' } }` -- NOT fail. The brief still renders 5 of 6 surfaces; the missing Tavily cell shows a placeholder ("Live funding scan: not configured -- add TAVILY_API_KEY to ~/.mindrian.env to enable").
- LEAN: silent-empty with placeholder in deck rendering. Capture in 118-03 plan.

**OQ10. Brain availability detection for the 3 Brain agents.**
All 3 Brain agents share the same Brain unreachable failure mode. Should we factor out a helper that checks brain-client.isAvailable() once and short-circuits all 3 if false? Or let each one fail independently? LEAN: each one calls isAvailable() at the top of run() so they're independent; if Brain is down, all 3 return status:'empty' quickly (under 100ms each), the budget is preserved for the other 3 agents.
</open_questions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The 3 Brain agents (similar-ventures, cross-domain, classic-traps)</name>
  <files>lib/agents/mva/brain-similar-ventures.cjs, lib/agents/mva/brain-cross-domain.cjs, lib/agents/mva/brain-classic-traps.cjs, data/mva-agent-prompts.json</files>
  <behavior>
    Tests (in lib/agents/mva/test-all-six-agents.cjs -- shared with Tasks 2-3):
    - Test 1: brain-similar-ventures.run({ sentence_sha256: 'abc', remaining_budget_ms: 30000 }, signal) when Brain mock returns 3 results -> returns { status: 'ok', payload: { summary_line: 'Found 3 ventures in this space: ...', deck_data: { ventures: [...] } } }.
    - Test 2: brain-cross-domain.run(...) when Brain mock returns 1 analogy -> returns ok with summary_line starting "Cross-domain analogy:".
    - Test 3: brain-classic-traps.run(...) when Brain mock returns 1 trap -> returns ok with summary_line starting "Classic trap:".
    - Test 4: All 3 agents: when brain-client.isAvailable() returns false, each returns { status: 'empty', payload: { reason: 'brain_unavailable' } } in < 100ms (verify wall-clock).
    - Test 5: All 3 agents: signal.aborted check is observed -- if signal aborts mid-call, agent returns null/empty quickly.
    - Test 6: Canon Part 8 invariant: spy on brain-client.callTool; assert that NONE of the 3 agents passes context.sentence_sha256 as a query string OR as a free-text parameter to Brain. The only allowed value-types in Brain query args are: hardcoded framework names from data/mva-agent-prompts.json, problem-type enums, phase identifiers.

    Run as part of `node --test lib/agents/mva/test-all-six-agents.cjs`.
  </behavior>
  <action>
    Step 1: Create data/mva-agent-prompts.json with the 3 Brain query templates. Each template carries ONLY generic handles. Example structure:
    ```json
    {
      "brain_similar_ventures": {
        "tool": "brain_search",
        "query": "ventures comparable to early-stage consumer SaaS",
        "filters": { "node_type": "Venture", "stage_label_one_of": ["pre-seed", "seed", "series-a"] },
        "limit": 3
      },
      "brain_cross_domain": {
        "tool": "brain_search",
        "query": "cross-domain analogy frameworks",
        "filters": { "node_type": "Framework", "cross_domain": true },
        "limit": 1
      },
      "brain_classic_traps": {
        "tool": "brain_query",
        "cypher": "MATCH (f:FailureMode)-[:OBSERVED_IN]->(v:Venture) WHERE v.stage IN $stages RETURN f.name, f.signature LIMIT 1",
        "params": { "stages": ["pre-seed", "seed"] }
      }
    }
    ```
    Note: the queries are deliberately GENERIC. They are not tailored to the user's specific sentence. The "intelligence" comes from Brain returning patterns relevant to early-stage venture exploration -- which is the user's likely context once detection has classified the prompt as venture-positive. This is Part 8-compliant: the Brain receives no specifics about THIS user's venture.

    Step 2: Implement lib/agents/mva/brain-similar-ventures.cjs.
    - Copy the Part 8 self-policing header comment from lib/agents/auto-explore-agent.cjs lines 27-41 verbatim, adapted for this agent (replace AUTOEXPLORE-117-17 reference with MVA-118-08).
    - require lib/core/brain-client.cjs (the sanitized wrapper).
    - require data/mva-agent-prompts.json.
    - exports.run = async (context, signal) => {
        if (!(await brainClient.isAvailable())) return { status: 'empty', payload: { reason: 'brain_unavailable' } };
        if (signal.aborted) return null;
        const prompts = require('../../../data/mva-agent-prompts.json').brain_similar_ventures;
        const result = await brainClient.search(prompts.query, { filters: prompts.filters, limit: prompts.limit });
        if (signal.aborted) return null;
        const ventures = (result.results || []).slice(0, 3);
        if (ventures.length === 0) return { status: 'empty', payload: { reason: 'no_matches' } };
        const summary = `Found ${ventures.length} ventures in this space: ${ventures.map(v => v.name + ' (' + (v.status || 'active') + ')').join(', ')}`;
        return { status: 'ok', payload: { summary_line: summary, deck_data: { ventures } } };
      };

    Step 3: Implement lib/agents/mva/brain-cross-domain.cjs analogously, with summary_line `Cross-domain analogy: ${analogy.name} -- ${analogy.signature || 'pattern transfer applicable'}`.

    Step 4: Implement lib/agents/mva/brain-classic-traps.cjs analogously, calling brainClient.query with the Cypher template; summary_line `Classic trap: ${trap.name} -- ${trap.signature}`.

    Step 5: Write tests 1-6 in test-all-six-agents.cjs. Mock brain-client by monkey-patching the require cache (precedent: lib/memory/run-feynman-tests.cjs).

    Step 6 (CANON PART 8 GREP REGRESSION): Add a static grep test inside test-all-six-agents.cjs:
    ```javascript
    test('canon part 8: no raw sentence in brain agents', () => {
      const sources = ['brain-similar-ventures.cjs', 'brain-cross-domain.cjs', 'brain-classic-traps.cjs'];
      for (const src of sources) {
        const code = fs.readFileSync(path.join(__dirname, src), 'utf8');
        // forbidden: ever using context.sentence or process.env.MVA_SENTENCE in a Brain call
        assert.equal(code.match(/MVA_SENTENCE/), null, `${src} must not read MVA_SENTENCE`);
        // forbidden: passing context.sentence_sha256 as a query string (the hash is a handle, not a query body)
        assert.equal(code.match(/search\(.*sentence_sha256/), null);
        assert.equal(code.match(/query\(.*sentence_sha256/), null);
      }
    });
    ```
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/agents/mva/test-all-six-agents.cjs 2>&1 | grep -E "passing|failing|brain-(similar|cross|classic)"</automated>
  </verify>
  <done>
    - Tests 1-6 pass.
    - Static grep test passes (no MVA_SENTENCE read; no sentence_sha256 in query body).
    - All 3 Brain agents have the Part 8 self-policing header comment.
    - All 3 Brain agents short-circuit to status:'empty' in <100ms when isAvailable() returns false.
    - Zero stdout writes in any of the 3 files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tavily funding-scan agent + Six-hats red/black agent</name>
  <files>lib/agents/mva/tavily-funding-scan.cjs, lib/agents/mva/six-hats-red-black.cjs</files>
  <behavior>
    Tests (added to lib/agents/mva/test-all-six-agents.cjs):
    - Test 7: tavily-funding-scan.run when TAVILY_API_KEY is unset -> { status: 'empty', payload: { reason: 'tavily_unavailable' } } in <50ms.
    - Test 8: tavily-funding-scan.run when key is set and Tavily mock returns 1 result -> { status: 'ok', payload: { summary_line: 'Live funding match: ...', deck_data: { funding: [...] } } }.
    - Test 9: tavily-funding-scan respects signal.aborted -- mid-fetch abort returns null.
    - Test 10: tavily-funding-scan query string is GENERIC: it queries for "early-stage venture grants and pre-seed funding" + a deadline window. It NEVER passes the raw sentence to Tavily (verify by intercepting fetch).
    - Test 11: six-hats-red-black.run always returns { status: 'ok', payload: { summary_line: 'One question you haven\'t asked yourself: ...', deck_data: { red_flag: ..., black_flag: ... } } }. It is deterministic per sentence_sha256 (same hash -> same output) using a small in-process registry of generic flag questions.
    - Test 12: six-hats-red-black NEVER makes any network call (verify fetch spy is uncalled).

    Run as part of `node --test lib/agents/mva/test-all-six-agents.cjs`.
  </behavior>
  <action>
    Step 1: Implement lib/agents/mva/tavily-funding-scan.cjs.
    - Mirror auto-explore-agent.cjs header (Part 8 rules; MVA-118-10 invariant).
    - exports.run = async (context, signal) => {
        const key = resolveTavilyKey(); // helper similar to resolve-brain-key.cjs
        if (!key) return { status: 'empty', payload: { reason: 'tavily_unavailable' } };
        if (signal.aborted) return null;
        // GENERIC query, NOT the raw sentence. Targets public funding intelligence.
        const query = "early-stage venture grants pre-seed funding tracks open deadline";
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ query, max_results: 3, search_depth: 'basic', topic: 'news' }),
          signal
        });
        if (signal.aborted) return null;
        const data = await response.json();
        const top = (data.results || [])[0];
        if (!top) return { status: 'empty', payload: { reason: 'no_funding_matches' } };
        const summary = `Live funding match: ${top.title || 'opportunity'} -- ${(top.snippet || '').slice(0, 80)}`;
        return { status: 'ok', payload: { summary_line: summary, deck_data: { funding: data.results.slice(0,3) } } };
      };
    - The resolveTavilyKey helper reads process.env.TAVILY_API_KEY, falls back to parsing ~/.mindrian.env for TAVILY_API_KEY=. Mirror lib/core/resolve-brain-key.cjs precedence.
    - The query string is HARDCODED. Per Canon Part 8, the only signal allowed from the user's sentence to a public-internet endpoint is the sentence_sha256 (a handle), which Tavily doesn't accept anyway.

    Step 2: Implement lib/agents/mva/six-hats-red-black.cjs.
    - This agent is fully LOCAL -- zero network calls.
    - It uses a small registry of generic "questions the user hasn't asked themselves" patterned on Berger 2014's Beautiful Questions framework + de Bono Red/Black hats.
    - Registry of 12 questions in the file itself; deterministic selection via `parseInt(sentence_sha256.slice(0,8), 16) % 12` (so the same sentence always gets the same question pair, but different sentences get variety).
    - Sample registry entries:
      - "How does the person who currently manages this manually agree to adopt your product?"
      - "What does success look like in 90 days, and what evidence proves you got there?"
      - "If your strongest competitor copied your idea tomorrow, what's left that they can't replicate?"
      - "What single assumption would, if wrong, kill the entire thesis?"
      - "Who would be furious if this worked? Why?"
      - (continue to 12)
    - exports.run returns { status: 'ok', payload: { summary_line: 'One question you haven't asked yourself: ' + selected_question, deck_data: { red_flag: selected_red, black_flag: selected_black } } }.

    Step 3: Write tests 7-12 in test-all-six-agents.cjs. Mock fetch via global.fetch monkey-patch for Tavily tests.

    Step 4 (CANON PART 8 INVARIANT for Tavily): Add a static grep test:
    ```javascript
    test('canon part 8: tavily query is generic', () => {
      const code = fs.readFileSync(__dirname + '/tavily-funding-scan.cjs', 'utf8');
      assert.equal(code.match(/MVA_SENTENCE/), null);
      assert.equal(code.match(/context\.sentence_sha256.*body/), null);  // hash never goes in fetch body
      assert.match(code, /const query = "/);  // query is a hardcoded string literal
    });
    ```
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/agents/mva/test-all-six-agents.cjs 2>&1 | grep -E "passing|failing|tavily|six-hats"</automated>
  </verify>
  <done>
    - Tests 7-12 pass.
    - Static grep test for Tavily passes (no user content in query).
    - Six-hats agent makes zero network calls (verified by fetch spy).
    - Tavily fallback to status:'empty' is fast (<50ms) and correct (Test 7).
    - The 12-question registry is in source and is deterministic via sha256 modulo (Test 11).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Dashboard graph-neighborhood agent + index aggregator</name>
  <files>lib/agents/mva/dashboard-graph-neighborhood.cjs, lib/agents/mva/index.cjs</files>
  <behavior>
    Tests (added to test-all-six-agents.cjs):
    - Test 13: dashboard-graph-neighborhood.run when navigation.cjs returns a 5-node neighborhood -> { status: 'ok', payload: { summary_line: 'Your room already has 5 related decision nodes ...', deck_data: { nodes: [...], edges: [...] } } }.
    - Test 14: When there is NO active room (no room.db detectable) -> { status: 'empty', payload: { reason: 'no_active_room' } }.
    - Test 15: Dashboard agent uses lib/core/navigation.cjs EXCLUSIVELY for SQL reads (Canon Part 9 D-06 invariant). Static grep test: no require('./room-db'), no require('room-db.cjs'), no direct sqlite3 require.
    - Test 16: lib/agents/mva/index.cjs exports ALL_AGENTS as an array of 6 entries, each { id, fn }, with id values matching the 6 ids from Plan 118-01 binding decision B1.
    - Test 17 (END-TO-END DRY RUN): require lib/agents/mva/index.cjs; require lib/core/mva-dispatcher.cjs; dispatch ALL_AGENTS with all underlying clients mocked; assert that exactly 6 AgentResult objects come back, all conform to the AgentResult shape, and total wall-clock < 1500ms (because everything is mocked).

    Run as part of `node --test lib/agents/mva/test-all-six-agents.cjs`.
  </behavior>
  <action>
    Step 1: Implement lib/agents/mva/dashboard-graph-neighborhood.cjs.
    - Mirror auto-explore-agent.cjs Part 8 + Part 9 header (MVA-118-12 invariant).
    - require lib/core/navigation.cjs (the Phase 109 single chokepoint).
    - exports.run = async (context, signal) => {
        const nav = require('../../core/navigation.cjs');
        const activeRoom = await nav.detectActiveRoom();  // returns { roomDir, hasRoomDb } | null
        if (!activeRoom || !activeRoom.hasRoomDb) return { status: 'empty', payload: { reason: 'no_active_room' } };
        if (signal.aborted) return null;
        // Use the navigation chokepoint to read a small generic neighborhood.
        // Per Canon Part 9: NEVER require room-db directly; ALWAYS go via navigation.cjs.
        const neighborhood = await nav.getRecentDecisionNeighborhood(activeRoom.roomDir, { hops: 1, limit: 5 });
        if (signal.aborted) return null;
        if (!neighborhood.nodes || neighborhood.nodes.length === 0) {
          return { status: 'empty', payload: { reason: 'empty_room' } };
        }
        const count = neighborhood.nodes.length;
        const summary = `Your room already has ${count} related decision node${count === 1 ? '' : 's'}. Quick preview:`;
        return { status: 'ok', payload: { summary_line: summary, deck_data: neighborhood } };
      };
    - If `nav.getRecentDecisionNeighborhood` does not yet exist as a named export, this plan's executor MUST verify it via `grep -n "getRecentDecisionNeighborhood\\|getNeighborhood" lib/core/navigation.cjs`. If not present, add a thin wrapper in lib/core/navigation.cjs (one of the 13 functions) that selects MATCH (n:Decision)<-[:RECENT]-(...) or equivalent SQL fallback. Do NOT bypass navigation.cjs.

    Step 2: Implement lib/agents/mva/index.cjs.
    ```javascript
    'use strict';
    // Agent IDs (shortened from filenames for AgentResult display + telemetry):
    //   brain_similar      <- brain-similar-ventures.cjs
    //   brain_cross_domain <- brain-cross-domain-analogies.cjs
    //   brain_classic_traps <- brain-classic-traps.cjs
    //   tavily_funding     <- tavily-funding-scan.cjs
    //   six_hats_red_black <- six-hats-red-black.cjs
    //   dashboard_graph    <- dashboard-graph-nodes.cjs
    // NOTE on filename drift: the canonical filenames in this plan's files_modified
    // (e.g. brain-cross-domain.cjs, dashboard-graph-neighborhood.cjs) are the
    // implementation-time source files. The JSDoc above documents the agent-id ->
    // source-file mapping using the BINDING-DECISION B1 short forms so Plan 118-03's
    // renderer prefixes ([brain] / [analogy] / [traps] / [funding] / [worth chewing on]
    // / [your room]) deterministically resolve from agent_id alone. If an executor
    // renames a source file, update both this comment block AND the require() path
    // immediately below in the same commit (NIT-2 invariant from plan-checker iter 2).
    const ALL_AGENTS = Object.freeze([
      { id: 'brain_similar',       fn: require('./brain-similar-ventures.cjs').run },
      { id: 'brain_cross_domain',  fn: require('./brain-cross-domain.cjs').run },
      { id: 'brain_classic_traps', fn: require('./brain-classic-traps.cjs').run },
      { id: 'tavily_funding',      fn: require('./tavily-funding-scan.cjs').run },
      { id: 'six_hats_red_black',  fn: require('./six-hats-red-black.cjs').run },
      { id: 'dashboard_graph',     fn: require('./dashboard-graph-neighborhood.cjs').run },
    ]);
    module.exports = { ALL_AGENTS };
    ```

    Step 3: Write tests 13-17. Test 15 is a static grep test:
    ```javascript
    test('canon part 9: dashboard agent uses navigation.cjs only', () => {
      const code = fs.readFileSync(__dirname + '/dashboard-graph-neighborhood.cjs', 'utf8');
      assert.equal(code.match(/require\(.*room-db/), null, 'must not require room-db directly');
      assert.equal(code.match(/require\(['"]better-sqlite3/), null, 'must not require sqlite3 directly');
      assert.match(code, /require\(.*navigation\.cjs/);
    });
    ```
    Test 17 (end-to-end mock dispatch) is the BIG one: it proves the 6 agents wire correctly through Plan 118-01's dispatcher.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/agents/mva/test-all-six-agents.cjs</automated>
  </verify>
  <done>
    - All 17 tests in test-all-six-agents.cjs pass (6 from Task 1, 6 from Task 2, 5 from this task).
    - Dashboard agent only reads SQL via navigation.cjs (Canon Part 9; grep verified).
    - lib/agents/mva/index.cjs exports ALL_AGENTS with all 6 ids per binding decision B1.
    - End-to-end mock dispatch (Test 17) confirms the 6 agents wire to Plan 118-01's dispatcher.
    - Phase 121 telemetry events ARE NOT emitted by these agents (the dispatcher emits in Plan 118-03).
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. All 17 tests pass: `node --test lib/agents/mva/test-all-six-agents.cjs`
2. Canon Part 8 sweep on all 6 agent files:
   - `grep -E "MVA_SENTENCE|process\.env\.CLAUDE_USER_PROMPT" lib/agents/mva/*.cjs` returns 0 matches (no raw-sentence reads)
   - `grep -E "sentence_sha256" lib/agents/mva/brain-*.cjs lib/agents/mva/tavily-*.cjs` shows it appears ONLY in function signatures, never as a value in a Brain query or Tavily fetch body
3. Canon Part 9 sweep on dashboard agent:
   - `grep -E "require.*room-db|require.*sqlite" lib/agents/mva/dashboard-graph-neighborhood.cjs` returns 0 matches
   - `grep -E "require.*navigation\.cjs" lib/agents/mva/dashboard-graph-neighborhood.cjs` returns 1+ match
4. The 6 agent ids match binding decision B1 exactly (grep verify):
   - `node -e "const {ALL_AGENTS} = require('./lib/agents/mva/index.cjs'); console.log(ALL_AGENTS.map(a=>a.id))"` outputs `[ 'brain_similar', 'brain_cross_domain', 'brain_classic_traps', 'tavily_funding', 'six_hats_red_black', 'dashboard_graph' ]`
5. No stdout writes in any agent file (grep `console.log\|process.stdout` returns 0).
</verification>

<success_criteria>
- All 17 automated tests pass.
- All 6 agents conform to the Agent contract from Plan 118-01 (validateAgentResult returns true for each result).
- Canon Part 8: zero user-content paths to Brain or Tavily (verified by static grep AND test spies).
- Canon Part 9: dashboard agent uses navigation.cjs exclusively (verified by static grep).
- Six-hats agent is fully local, zero network (verified).
- Tavily agent gracefully degrades when key is missing (verified, <50ms).
- Brain agents gracefully degrade when Brain is unreachable (verified, <100ms each).
- The 6-agent index.cjs is the array shape that Plan 118-03 will dispatch.
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-02-SUMMARY.md` capturing:
- The 6 agent files + their summary_line patterns (so Plan 118-03 knows what to render)
- The Canon Part 8 self-audit results (zero forbidden matches)
- The Canon Part 9 self-audit results (dashboard uses navigation.cjs only)
- Test coverage: 17 tests across 3 tasks
- Open carry-forward to 118-03: Tavily-unavailable rendering placeholder; six-hats deterministic-per-hash behavior; per-agent telemetry emission location
- The data/mva-agent-prompts.json schema (Brain query templates with generic handles only)
</output>
</output>
