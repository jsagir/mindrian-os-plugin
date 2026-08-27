---
name: act
description: Run Larry's best-pick methodology for your room state
help_jtbd: "Run the next move Larry recommends, without typing the /mos: command yourself."
argument-hint: '[--chain] [--swarm] [--dry-run]'
body_shape: E (Action Report) + F.1 (Next-Move gate)
hitl_stages:
  - stage: "best-pick"
    shapes: ["F.7"]
    mode: "gate"
  - stage: "ordered-chain"
    shapes: ["F.2", "F.9"]
    mode: "ordered"
  - stage: "parallel-swarm"
    shapes: ["F.8"]
    mode: "parallel"
hitl_why: "Act has three modes in one file: a ranked best-pick dial (F.7), an ordered chain (F.2 then F.9), and a parallel swarm (F.8), each a distinct decision surface."
# Phase 265-03 reward-before-investment declaration (pre-existing gap closed
# as a commit-gate blocker, docs/reward-before-investment-rule.md). Grounded
# in Step 4's thinking trace (this file, "## Step 4: ..."): bare `/mos:act`
# with zero flags shows the recommended framework, its reasoning, and its
# source BEFORE the F.1 Run/Modify/Cancel gate asks the navigator to invest
# a decision -- a structural preview of what would run, not the run itself.
interactive_first_reward: schema_preview
serves_jtbd: ["plan-execution"]
teaching: "When you have analyses on the table but no clear next step, /mos:act picks the best-fit methodology for your current room state and runs it. Saves you from analysis paralysis."
# --- Phase 122 workflow-layer frontmatter ---
kind: meta
frameworks: []
produces: null
inputs: []
autonomous_safe: false
ui_reference: skills/ui-system/SKILL.md
# Phase 265 ledger T-265-08 / navigator decision (Open Question 4, SETTLED
# "Add Task"). Task is pre-approved here because --swarm dispatches N
# subagents in one turn; allowed-tools is a pre-approval list, not a
# restriction list (frontmatter contract), so this removes the per-spawn
# permission prompt rather than granting a capability the command did not
# already have. Scoped to the invoking turn; clears on the next message.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - Task
  - mcp__mindrian-brain__brain_ask
  - mcp__mindrian-brain__brain_search
# --- Phase 172 CIRS connector ---
# /mos:act is the standing meta-orchestrator: a PINNED selection suggestion, NOT a 7th reach
# (Canon Part 11 R3/R4). It surfaces a governed SELECTION; reach_id 'context_block' is in the
# frozen 6 (Canon Appendix D entry 15); posture 'hold' is in the frozen 3.
# sensor_triggers is [] -- act is a standing standing suggestion, not sensor-driven (it is OFFERED
# by the spine, it does not fire off a single SENS detector).
# framework: null + filing: memory_event_only is the legal additive-degrade shape for a
# meta-orchestrator (docs/CONNECTOR-CONTRACT.md section 4; mirrors the ignite front-door connector).
# autonomous_safe stays false in act's own frontmatter above (the spine OFFERS act; the navigator
# CONFIRMS at the F.1 gate -- T-172-15 elevation-of-privilege mitigation).
# --swarm is a SUB-MODE of act (not a separate file): it is WIRED-BY-INHERITANCE under this one
# connector (the swarm dispatch is a parallel execution mode of the same governed selection; it
# mints no second selection brain). No separate connector or exclusion is warranted for --swarm.
# ONE connector block only (Canon Part 7 / MOAT rule). canon_parts live in 172-CONTEXT.md.
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: act
  framework: null
  posture: hold
  hierarchy_rank: 11
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
---

# /mos:act

You are Larry. This command autonomously selects and executes the best methodology framework for the user's current room state. You think before you act -- showing full transparency on why you chose what you chose.

**Modes:**
- `/mos:act` -- select and execute one framework
- `/mos:act --chain` -- select and execute 3-5 frameworks in sequence (checkpoints between steps)
- `/mos:act --swarm` -- dispatch N framework-runners in parallel across highest-gap sections (N is dynamic)
- `/mos:act --dry-run` -- show the execution plan without running anything
- `/mos:act --chain --dry-run` -- preview the full chain plan
- `/mos:act --swarm --dry-run` -- preview the swarm dispatch plan
- `/mos:act --budget <N>` -- set max token budget (e.g. `--budget 100000`); applies to any mode

## UI Format

- **Body Shape:** E -- Action Report (status block, reasoning, then action) for the thinking trace + execution; **Shape F.1** (`lib/hmi/shape-f1-renderer.cjs`, AskUserQuestion primitive) for every option/approval gate. act NEVER hand-rolls a selector (INV-20).
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

## Step 2c: Intent Calibration (INV-21) -- BEFORE any selection or execution

Before act SELECTS or EXECUTES anything, run a short INTERNAL intent-calibration step. This is act's "confirm what the navigator actually wants" gate: a lightweight internal discuss (the discuss-phase pattern, reused) that pins down, in this room state, what the navigator wants act to do, the scope, the constraints, and the definition of done -- BEFORE routing through F.1 -> decide() -> runChain. Calibration runs first; it is the elevation-of-privilege brake (T-172-15): act never auto-acts on an uncalibrated assumption.

Calibration reads **LOCAL state ONLY** -- the active JTBD, `room/STATE.md`, and `room/MINTO.md` (the governing thought + tensions). It makes **zero Brain egress** (Canon Part 8): no Brain query carries the navigator's intent, scope, or venture content. The calibration is a local reflection over already-read room state, not a Brain round-trip.

Calibration steps:

1. From STATE.md (stage, problem type, weakest sections) and MINTO.md (governing thought, open tensions), draft a one-line read of what act believes the navigator wants next and why.
2. Surface that read at the Shape F.1 host (the same AskUserQuestion primitive used for the option gate): Confirm this intent / Adjust scope or constraints / Set a different definition of done. The navigator confirms or corrects the intent BEFORE act selects a framework.
3. Journal the calibrated intent as a `memory_event` through `lib/core/navigation.cjs` (Canon Part 9: SQL is the local mind; the run is auditable). The journaled packet carries ONLY enum/scalar intent handles (the confirmed scope enum, the definition-of-done enum, a timestamp), NEVER the venture content (Part 9 typed packet / Part 8 boundary).

The post-gate handoff is then: **calibrate -> approve -> auto-run the `autonomous_safe` prefix -> halt at the first material step** (Canon Part 3 Decision Gate; the runChain gate authority). MAX_K=3, DIAL_REACH_K=6, and the F.1 keyboard contract stay FROZEN throughout -- calibration renders against them, it never edits them.

## Step 3: Select Framework (Brain + Local Fallback)

### Try Brain First

If Brain MCP is available, ask for framework recommendations using natural language:

1. Call `mcp__mindrian-brain__brain_ask` with a question such as:
   - "recommend a framework for a [problem-type] venture that has already applied [current frameworks]"
   - "what frameworks chain from [seed framework] for a [problem-type] problem?"
2. Read `next_gate.options[].framework` from the response for the ranked chain.
   `directive.guided.framework` carries the matched anchor framework.
3. Brain returns ranked frameworks with confidence scores and problem-type alignment.

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

For `--swarm` mode, resolve once and apply the same model to all dispatches.

## Step 4c: Cost Estimation (AGENT-02)

Before dispatching any agents, calculate and display the cost estimate using `dispatch-optimizer.cjs`:

```javascript
const { estimateTokenCost, formatCostEstimate, selectModel, planDispatch } = require('${CLAUDE_PLUGIN_ROOT}/lib/core/dispatch-optimizer.cjs');
```

**For single mode:** Estimate 1 agent at the resolved model.
**For chain mode:** Estimate N agents (one per chain step) at the resolved model.
**For swarm mode:** Use `planDispatch(roomPath, { remainingContext, maxBudget })` for full plan.

Display the cost estimate in the thinking trace:

```
[COST] Estimated token usage
       {formatCostEstimate result, e.g. "This will use ~150K tokens (3 agents x Opus)"}
       Budget: {remainingContext}K remaining
       {if downgraded: "Model downgraded: opus -> sonnet (budget constraint)"}
```

If the `--budget` flag is set, pass it as `maxBudget` to the optimizer. The optimizer will constrain swarm sizing and model selection to fit within the user's budget.

## Step 5: Handle Mode

### Standard Mode (`/mos:act`)

After displaying the thinking trace, render the option gate on the canonical **Shape F.1 host** -- NEVER a hand-rolled selector. act's next-move presentation goes through the AskUserQuestion Shape F.1 primitive (`lib/hmi/shape-f1-renderer.cjs`, dispatched via `lib/hmi/selector-dispatcher.cjs`), honoring the FROZEN F.1 keyboard contract (UP/DOWN option navigation + SIDE toggle, Canon Part 3 / INV-20). The selected verb becomes a typed edge (Part 4); no bespoke dialog.

1. Surface the F.1 Next-Move gate with the selected framework as the recommended row: Run **{framework-name}** / Pick another framework / Cancel (Free-Text is appended last by the host). The 0.70/0.15 RECOMMENDED gate, MAX_K=3, and DIAL_REACH_K=6 are FROZEN -- act renders against them, it never edits them.
2. If the navigator selects Run, dispatch to `agents/framework-runner.md` with:
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

### Chain Mode (`/mos:act --chain`) -- the autonomy gate

**Before anything else in `--chain` mode, plan + autonomy-gate the chain through the resolver:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/act-command.cjs" --chain --room ./room
```

The helper picks the framework chain for the room state via `lib/brain/chain-recommender.cjs` `recommendFrameworkChain` (a FEEDS_INTO traversal -- framework names + problem-type enums only; Canon Part 8: never a command string, never user content), composes it into `/mos:` commands via `lib/workflow/command-resolver.cjs` `composeWorkflow` (the SOLE framework -> command path, reading only the generated `data/command-registry.json`), calls `validateChainAutonomy(workflow)` FIRST, then DELEGATES the walk to the shared runtime `lib/core/chain-executor.cjs` `runChain`. act does NOT own its own loop: `runChain` is the ONE shared gated loop (the same spine the pipeline and ignite ride), and act is the thinnest caller -- it composes the chain then supplies callbacks only (`postureFn` = `lib/core/recipe-maps.cjs` `postureForCommand`, the ONE posture authority; the chain-autonomy `gateFn`; an `onStep` that records the would-run step; an `onHalt` that renders the "needs you here" gate; `provenanceFn: null` because act is not the pipeline). The walk stops at the FIRST step whose command is not `autonomous_safe: true` (or whose framework has no `/mos:` command at all), where it renders a "needs you here" gate (a Shape F.0 / E action report: "[GATE] Chain reached step N: /mos:x for <framework>. This step is not autonomous_safe -- it needs your eyes. [continue] [stop]"). Posture comes from `recipe-maps` (the ONE authority -- act names no posture from memory) and the chain trace is the single `runChain` trace. You then:
- run the `autonomous_safe` prefix steps unattended (dispatch `agents/framework-runner.md` per step, with the checkpoint pause between steps as below),
- at the gate step, do NOT run it autonomously -- surface the gate to the user and wait. `[continue]` = the user runs that step themselves (or approves running it), then resume the chain from the next step. `[stop]` = halt; what ran above is filed.

You NEVER name a `/mos:` command in `--chain` mode from memory and you NEVER decide a step is safe to run unattended from memory -- the command came back from the resolver and the autonomy decision came back from `validateChainAutonomy` / `data/command-registry.json`'s `autonomous_safe` field. `--chain --from-framework <x>` / `--chain --problem-type <x>` seed the chain explicitly.

Then, for the steps the helper greenlit:

1. Select 3-5 frameworks using the chain selection logic (the helper already did this via the recommender; this list is the same chain):
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

3. Surface the chain-approval gate on the Shape F.1 host (the same AskUserQuestion primitive, INV-20): Run this chain / Modify the chain / Cancel. Never a hand-rolled yes/modify/cancel prompt.

4. If the navigator selects Run, execute sequentially **with checkpoints between steps** (AGENT-03):
   - Run framework 1 via `agents/framework-runner.md`
   - After each step completes, use `chainCheckpoint()` from `dispatch-optimizer.cjs` to generate the pause prompt:
     ```javascript
     const { chainCheckpoint } = require('${CLAUDE_PLUGIN_ROOT}/lib/core/dispatch-optimizer.cjs');
     const cp = chainCheckpoint(currentStep, totalSteps, completedFramework, nextFramework, { artifactsAdded, section });
     ```
   - Display the checkpoint and WAIT for the user's response:
     ```
     [CHAIN] Step {N}/{total} complete: {framework-name}
             Filed: {artifacts count} artifacts to room/{section}/
             Forwarding: {chain_forward.focus}

     Continue to step {N+1}? ({next-framework-name})
     (yes / skip / stop)
     ```
   - **yes** -- proceed to next framework, passing previous output as chain input
   - **skip** -- skip the next framework, move to the one after it (or finish if last)
   - **stop** -- halt the chain, file what's been produced, show partial summary
   - This checkpoint replaces the old auto-run behavior. Users control pacing.

5. After all frameworks complete (or user stops), show summary:
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

Swarm mode dispatches **N** framework-runner agents **simultaneously**, each targeting a different high-gap room section. N is **dynamically calculated** -- not hardcoded to 3. This is the parallel counterpart to `--chain` (which runs sequentially).

### Swarm Selection (AGENT-01: Dynamic Sizing)

Use `dispatch-optimizer.cjs` to calculate the optimal swarm size:

```javascript
const { planDispatch } = require('${CLAUDE_PLUGIN_ROOT}/lib/core/dispatch-optimizer.cjs');
const plan = planDispatch(roomPath, {
  remainingContext: contextBudget,  // current session remaining tokens
  maxBudget: userBudget || undefined,  // from --budget flag if set
});
// plan.agents = optimal count
// plan.sections = which sections to target
// plan.model = which model to use (may be downgraded)
// plan.cost.display = human-readable cost string
```

The optimizer applies the formula: **N = min(weak_sections, context_budget / agent_cost)**

1. **Identify weak sections** via `findWeakSections(roomPath)`:
   - Sections with fewer than 5 entries, sorted ascending
   - If zero weak sections, swarm is not useful -- suggest single `/mos:act` instead

2. **Scale to budget** via `scaleSwarm()`:
   - If `--budget` flag set, that caps the total token spend
   - If remaining context is tight, fewer agents dispatched
   - If remaining context < 60% of window, model downgrades automatically (AGENT-04)

3. **Select one framework per section** using the same scoring logic as Step 3 (Brain or local fallback), but each framework targets a DIFFERENT section. No two agents work the same section.

4. **Model resolution** uses `selectModel()` from dispatch-optimizer:
   - Starts with model-profiles.cjs resolution for framework-runner
   - Downgrades opus -> sonnet -> haiku if budget requires it (AGENT-04)
   - All agents in a swarm use the same model tier

### Swarm Thinking Trace

Display the swarm plan before dispatching, including cost estimate (AGENT-02):

```
[THINK] Swarm Selection ({N} parallel agents)

  Room: {room name}
  Stage: {venture stage}

  Agent 1: {framework-1} -> room/{section-1}/
           Model: {resolved model}
           Gap: {entry count} entries (weakest)
  Agent 2: {framework-2} -> room/{section-2}/
           Model: {resolved model}
           Gap: {entry count} entries
  [... up to N agents ...]

  Source: {Brain graph | Local routing table}
  Sizing: {plan.reasoning.swarm}
  {if downgraded: "Model: downgraded from {original} to {actual} (budget constraint)"}

[COST] {plan.cost.display}
       Budget: {remainingContext}K remaining{if --budget: ", capped at {budget}K"}
```

Surface the swarm-approval gate on the Shape F.1 host (the AskUserQuestion primitive, INV-20): Swarm now / Modify the plan / Cancel. Never a hand-rolled prompt.

### Swarm Dispatch

If user confirms:

1. Dispatch all N agents in one message using the Agent tool with `subagent_type: framework-runner`
   (the explicit type string, not a file path -- an Agent tool call that cannot resolve a
   `subagent_type` is a hard error listing available agents since 2.1.235). Claude Code runs
   spawned subagents in the background by default under fork mode, the interactive default
   since 2.1.232 -- do NOT pass any manual background-execution parameter to the Agent tool
   call; the platform removes that kind of parameter from the Agent tool entirely once fork
   mode is on (code.claude.com/docs/en/sub-agents). The platform caps concurrent subagents at
   20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); clamp N to 20 even though `plan.agents` already
   sizes on context budget rather than agent count, since a large room could in principle exceed
   the cap:
   - N comes from `plan.agents` (dispatch-optimizer result), NOT hardcoded, clamped to the 20-cap above
   - Each agent receives: framework name, room path, target section, room context summary, resolved model
   - Each agent is an independent `subagent_type: framework-runner` invocation (see `agents/framework-runner.md` for its instructions)
   - Agents do NOT share context or coordinate -- they run in full isolation

2. Show dispatch confirmation:
   ```
   [SWARM] Dispatched {N} agents
           Agent 1: {framework-1} -> {section-1} [running]
           Agent 2: {framework-2} -> {section-2} [running]
           [... up to N ...]

           Waiting for all agents to complete...
   ```

3. As each agent completes, collect its `FRAMEWORK_RUNNER_RESULT` structured summary

### Swarm Synthesis

After all N agents return:

1. **Collect results** -- parse each agent's `FRAMEWORK_RUNNER_RESULT` for key_insights and cross_references

2. **Cross-agent discovery** -- scan all N artifacts for emergent connections:
   - Do any two agents' findings reference the same concept from different angles?
   - Do any cross_references point to each other's target sections?
   - Are there contradictions between agents' findings?

3. **Trigger HSI recomputation** -- run the post-write cascade for all N new artifacts:
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/compute-hsi.py" room
   ```
   This satisfies PARA-05: parallel filings trigger HSI recomputation to discover cross-agent innovation connections.

4. **Show swarm summary:**
   ```
   [SWARM] Complete -- {N} frameworks executed in parallel

     Agent 1: {framework-1} -> room/{section-1}/
              Quality: {high|medium|low}
              Insights: {top insight}
     [... for each agent ...]

     Cross-Agent Discoveries:
     - {emergent connection 1}
     - {emergent connection 2}

     Token Usage: {actual tokens used} (estimated {plan.cost.display})
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
