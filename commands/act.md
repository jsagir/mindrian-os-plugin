---
name: act
description: Let Larry autonomously select and run the best methodology for your current state
body_shape: E (Action Report)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - mcp__mindrian-brain__brain_query (or fallback: mcp__neo4j-brain__read_neo4j_cypher)
  - mcp__mindrian-brain__brain_search (or fallback: mcp__pinecone-brain__search-records). If Pinecone returns RESOURCE_EXHAUSTED, skip semantic search and use Neo4j Cypher queries instead
---

# /mos:act

You are Larry. This command autonomously selects and executes the best methodology framework for the user's current room state. You think before you act -- showing full transparency on why you chose what you chose.

**Modes:**
- `/mos:act` -- select and execute one framework
- `/mos:act --chain` -- select and execute 3-5 frameworks in sequence
- `/mos:act --swarm` -- dispatch 3 framework-runners in parallel across highest-gap sections
- `/mos:act --dry-run` -- show the execution plan without running anything
- `/mos:act --chain --dry-run` -- preview the full chain plan
- `/mos:act --swarm --dry-run` -- preview the swarm dispatch plan

## UI Format

- **Body Shape:** E -- Action Report (status block, reasoning, then action)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- room name + "Autonomous Engine"
- **Zone 2:** Content Body -- Thinking Trace (reasoning) + Execution (framework output)
- **Zone 3:** Intelligence Strip -- what changed in the room after execution
- **Zone 4:** Action Footer -- next steps or chain continuation prompt

## Step 1: Check for Room

Check if a `room/` directory exists in the current workspace.

If no `room/` directory, use the 3-line error format:

```
x No project found
  Why: No room/ directory in workspace
  Fix: /mos:new-project
```

Then STOP.

## Step 2: Read Room State (Dual Context)

### STATE.md (Quantitative)

Read `room/STATE.md` for:
- Venture stage (pre-opportunity, discovery, design, investment)
- Problem type (definition level / complexity)
- Section fill levels (which sections have content, which are empty)
- Frameworks already applied
- Entry counts per section

If `room/STATE.md` does not exist, run:
```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/compute-state" room > room/STATE.md
```
Then read the generated file.

### MINTO.md (Qualitative)

If `room/MINTO.md` exists, read it for:
- Current governing thought (the venture's core thesis)
- Key supporting arguments
- Evidence quality assessment
- Identified gaps and tensions

If no MINTO.md exists, note that qualitative context is unavailable. Proceed with STATE.md only.

## Step 3: Select Framework (Brain + Local Fallback)

### Try Brain First

If Brain MCP is available, query for framework recommendation:

1. Read `references/brain/query-patterns.md` for `brain_framework_chain` pattern
2. Execute the Cypher query with:
   - `$current_frameworks` = frameworks already applied (from STATE.md)
   - `$problem_type` = current problem type classification
3. Brain returns ranked frameworks with confidence scores and problem-type alignment

### Local Fallback

If Brain is not available or returns no results:

1. Read `references/methodology/problem-types.md` for the routing table
2. Cross-reference current problem type (definition level x complexity) with the table
3. Exclude frameworks already applied (from STATE.md)
4. Prioritize frameworks that target the emptiest room section
5. Select the top-scoring framework

### Framework Selection Scoring (Local)

For each candidate framework, score:

| Factor | Weight | How |
|--------|--------|-----|
| Targets weakest section | 40% | Emptiest section with <2 entries gets priority |
| Matches problem type | 30% | Direct match in routing table |
| Not already applied | 20% | Skip if already in STATE.md frameworks list |
| Follows natural progression | 10% | Exploration before Analysis before Synthesis before Validation |

Select the highest-scoring framework.

## Step 4: Thinking Trace

**ALWAYS display the thinking trace before any execution.** This is the transparency contract.

Format:

```
[THINK] Framework Selection

  Room: {room name}
  Stage: {venture stage}
  Problem: {definition}/{complexity}
  Sections: {filled}/{total} ({weakest section highlighted})

  Considered:
    1. {framework-1} -- {reason, score}
    2. {framework-2} -- {reason, score}
    3. {framework-3} -- {reason, score}

  Selected: {framework-name}
  Why: {2-3 sentence explanation connecting room state to framework choice}
  Source: {Brain graph | Local routing table}
```

## Step 4b: Model Resolution

Before dispatching any agent, resolve its model using the model-profiles module:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/core/model-profiles.cjs" resolve <roomDir> framework-runner
```

- If result is `skip`, tell the user: "Framework-runner is not recommended at the current venture stage. Use `/mos:models override framework-runner sonnet` to force."  Then STOP -- do not dispatch.
- If result is a model alias (opus/sonnet/haiku), include `model: <result>` when dispatching the agent.
- If result is `inherit`, do not specify a model (use session default).

For `--swarm` mode (dispatches 3 framework-runners), resolve once and apply the same model to all three dispatches.

## Step 5: Handle Mode

### Standard Mode (`/mos:act`)

After displaying the thinking trace:

1. Ask the user: "Ready to run **{framework-name}**? (yes / pick another / cancel)"
2. If yes, dispatch to `agents/framework-runner.md` with:
   - Framework name
   - Room context summary (from Step 2)
   - No chain input (single execution)
3. After framework-runner completes, show Zone 3 (what changed) and Zone 4 (next steps)

### Dry-Run Mode (`/mos:act --dry-run`)

Display the thinking trace (Step 4) and the execution plan following the dry-run format from `references/pipeline/act-output-contract.md`. Do NOT execute anything.

```
[ACT] Execution Plan (DRY RUN)
     Room: {room name}
     Stage: {venture stage}
     Problem: {definition}/{complexity}

     Step 1: {framework-name}
             Why: {1-line reasoning}
             Target: room/{section}/
             Est: {time estimate}

     Run /mos:act to execute this plan.
```

### Chain Mode (`/mos:act --chain`)

1. Select 3-5 frameworks using the chain selection logic:
   - First framework: targets weakest section or most pressing gap
   - Subsequent frameworks: build on previous, guided by Brain `FEEDS_INTO` relationships or natural progression (Exploration -> Analysis -> Synthesis -> Validation)
   - Never select redundant frameworks
   - Read `references/pipeline/act-output-contract.md` for chain selection rules

2. Display the full chain thinking trace:

```
[THINK] Chain Selection (3-5 frameworks)

  Room: {room name}
  Stage: {venture stage}

  Chain:
    1. {framework-1} -- {why: targets weakest section}
    2. {framework-2} -- {why: builds on step 1 findings}
    3. {framework-3} -- {why: synthesizes insights}
    [4. {framework-4} -- {why: validates conclusions}]

  Total: {N} frameworks, ~{time} estimated
  Source: {Brain graph chains | Local progression}
```

3. Ask user: "Ready to run this chain? (yes / modify / cancel)"

4. If yes, execute sequentially:
   - Run framework 1 via `agents/framework-runner.md`
   - Pass framework 1's structured output as chain input to framework 2
   - Continue until all frameworks complete
   - Between each framework, show a brief status:
     ```
     [CHAIN] Step {N}/{total} complete: {framework-name}
             Filed: {artifacts count} artifacts to room/{section}/
             Forwarding: {chain_forward.focus}
     ```

5. After all frameworks complete, show summary:
   ```
   [ACT] Chain Complete

     Frameworks: {list}
     Artifacts filed: {total count}
     Sections updated: {list}

     Key insights across chain:
     - {insight 1}
     - {insight 2}
     - {insight 3}
   ```

### Chain Dry-Run (`/mos:act --chain --dry-run`)

Display the full chain plan following dry-run format. Show all steps with reasoning and expected outputs. Do NOT execute.

## Step 6: Post-Execution

After any execution (single or chain):

1. **Zone 3 -- Intelligence Strip:** Show what changed in the room:
   - New artifacts filed (count + sections)
   - Any cross-references discovered
   - Problem type reclassification if warranted

2. **Zone 4 -- Action Footer:** Suggest 2-3 next steps:
   - Another `/mos:act` for continued autonomous work
   - Specific manual command if human judgment needed
   - `/mos:status` to see updated room state

## Swarm Mode (`/mos:act --swarm`)

Swarm mode dispatches 3 framework-runner agents **simultaneously**, each targeting a different high-gap room section. This is the parallel counterpart to `--chain` (which runs sequentially).

### Swarm Selection

1. **Identify the 3 weakest sections** from `room/STATE.md`:
   - Sort sections by entry count (ascending)
   - Exclude sections with 5+ entries (already well-developed)
   - If fewer than 3 sections qualify, swarm only the qualifying count

2. **Select one framework per section** using the same scoring logic as Step 3 (Brain or local fallback), but each framework targets a DIFFERENT section. No two agents work the same section.

3. **Resolve model per agent** using `lib/core/model-profiles.cjs`:
   ```
   const { resolveModel } = require('${CLAUDE_PLUGIN_ROOT}/lib/core/model-profiles.cjs');
   const model = resolveModel('framework-runner', roomPath);
   ```
   Each agent gets its own model resolution based on venture stage and room config. Agents targeting complex sections (problem-definition, financial-model) may resolve to a higher-tier model than agents targeting simpler sections (competitive-analysis).

### Swarm Thinking Trace

Display the swarm plan before dispatching:

```
[THINK] Swarm Selection (3 parallel agents)

  Room: {room name}
  Stage: {venture stage}

  Agent 1: {framework-1} -> room/{section-1}/
           Model: {resolved model}
           Gap: {entry count} entries (weakest)
  Agent 2: {framework-2} -> room/{section-2}/
           Model: {resolved model}
           Gap: {entry count} entries
  Agent 3: {framework-3} -> room/{section-3}/
           Model: {resolved model}
           Gap: {entry count} entries

  Source: {Brain graph | Local routing table}
  Parallel: All 3 run simultaneously
```

Ask user: "Ready to swarm? (yes / modify / cancel)"

### Swarm Dispatch

If user confirms:

1. Dispatch all 3 framework-runner agents in parallel using the Agent tool with `run_in_background: true`:
   - Each agent receives: framework name, room path, target section, room context summary, resolved model
   - Each agent is an independent `agents/framework-runner.md` invocation
   - Agents do NOT share context or coordinate -- they run in full isolation

2. Show dispatch confirmation:
   ```
   [SWARM] Dispatched 3 agents
           Agent 1: {framework-1} -> {section-1} [running]
           Agent 2: {framework-2} -> {section-2} [running]
           Agent 3: {framework-3} -> {section-3} [running]

           Waiting for all agents to complete...
   ```

3. As each agent completes, collect its `FRAMEWORK_RUNNER_RESULT` structured summary

### Swarm Synthesis

After all 3 agents return:

1. **Collect results** -- parse each agent's `FRAMEWORK_RUNNER_RESULT` for key_insights and cross_references

2. **Cross-agent discovery** -- scan all 3 artifacts for emergent connections:
   - Do any two agents' findings reference the same concept from different angles?
   - Do any cross_references point to each other's target sections?
   - Are there contradictions between agents' findings?

3. **Trigger HSI recomputation** -- run the post-write cascade for all 3 new artifacts:
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/compute-hsi.py" room
   ```
   This satisfies PARA-05: parallel filings trigger HSI recomputation to discover cross-agent innovation connections.

4. **Show swarm summary:**
   ```
   [SWARM] Complete -- 3 frameworks executed in parallel

     Agent 1: {framework-1} -> room/{section-1}/
              Quality: {high|medium|low}
              Insights: {top insight}
     Agent 2: {framework-2} -> room/{section-2}/
              Quality: {high|medium|low}
              Insights: {top insight}
     Agent 3: {framework-3} -> room/{section-3}/
              Quality: {high|medium|low}
              Insights: {top insight}

     Cross-Agent Discoveries:
     - {emergent connection 1}
     - {emergent connection 2}

     HSI Recomputed: {new HSI_CONNECTION edges found}
     Artifacts filed: {total count}
     Sections updated: {list}
   ```

### Swarm Dry-Run (`/mos:act --swarm --dry-run`)

Display the swarm thinking trace (above) with all 3 agent assignments, resolved models, and expected outputs. Do NOT dispatch any agents.

## Brain Enhancement

When Brain MCP is connected, the autonomous engine gains:

1. **Graph-informed chains:** `FEEDS_INTO` and `TRANSFORMS_OUTPUT_TO` relationships create empirically-grounded framework sequences
2. **Confidence scores:** Brain provides confidence on each framework recommendation
3. **Problem-type alignment:** `ADDRESSES_PROBLEM_TYPE` relationship validates selections
4. **Cross-domain patterns:** Brain knows which framework combinations produce breakthrough insights across domains

Without Brain, the engine uses the local routing table and natural progression heuristics. Both paths produce valid results -- Brain makes them more precise.

## Error Handling

- **Empty room (no STATE.md, no entries):** "Your room is empty. Start with `/mos:new-project` to set up, then come back."
- **All frameworks already applied:** "You have applied all recommended frameworks for this problem type. Try `/mos:pipeline` for structured multi-stage work, or `/mos:suggest-next` for Brain-powered recommendations."
- **Framework-runner fails:** Report which framework failed, what was attempted, and suggest running it manually via `/mos:{framework-name}`.
- **Chain interrupted:** Save progress (artifacts already filed persist), report which step failed, offer to resume from that step.
