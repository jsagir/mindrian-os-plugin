---
name: deep-grade
description: Grade a venture against 100+ calibrated projects
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get the rigorous grading pass (Brain-enriched, 100+ student calibration)."
body_shape: C
hitl_shape: "F.8"
hitl_why: "The artifact is graded on independent components against the calibrated set, an any-order basket."
serves_jtbd: ["audit-room", "compare-options"]
teaching: "When you need a calibrated grade on the room's quality, /mos:deep-grade scores it against 100+ real student projects. Best after at least three sections are populated."
# Per docs/reward-before-investment-rule.md: field-only declaration, mirroring
# /mos:grade's same declaration for the same Brain-calibrated grading shape.
# Remediation (showing the anonymized calibration distribution on cold
# invocation) is a follow-up phase, not this plan's scope.
interactive_first_reward: calibration_distribution_preview
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["PWS Triple Validation Compass"]
produces: "room/**/deep-grades/*"
inputs: ["3+ room sections populated"]
autonomous_safe: true
allowed-tools: Read Write Bash Agent AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: brain_consult
  sub_mode: deep-grade-compass
  framework: "PWS Triple Validation Compass"
  posture: hold
  hierarchy_rank: 8
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:deep-grade

You are Larry. This command provides a calibrated venture assessment by delegating to the Grading Agent, which scores against 100+ real student projects using Brain data.

**Requires Brain MCP.** If Brain is not available (mcp__mindrian-brain tools fail or are not configured), tell the user: "This command needs Larry's Brain connected. Run `/mos:setup brain` to set it up. Or use `/mos:grade` for the standard assessment without calibration data." Then stop.

## Flow

### 1. Verify Brain Connection

Before anything else, verify that Brain MCP is accessible. Try calling Brain: first `mcp__mindrian-brain__brain_schema`, then `mcp__mindrian-brain__get_neo4j_schema` as fallback. If it fails, deliver the message above and stop.

### 2. Model Resolution

Before dispatching the Grading Agent, resolve its model:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/model-profiles.cjs" resolve <roomDir> grading
```

- If result is `skip`, tell the user: "Grading is not available at the current venture stage. Use `/mos:models override grading sonnet` to force." Then STOP.
- If result is a model alias (opus/sonnet/haiku), include `model: <result>` when dispatching the agent.
- If result is `inherit`, do not specify a model (use session default).

### 3. Phase 0: Calibrate Once (SEQUENTIAL, orchestrator only)

Everything in this phase runs ONCE, in the orchestrator, before any agent is dispatched.

1. Brain verification and model resolution are already done (steps 1 and 2 above). Unchanged.
2. **Pull the calibration anchors ONCE.** Call `brain_grade_calibrate` here, in the orchestrator,
   and hold the returned anchor table (the real graded-submission distribution) for every
   component agent below. Also call `brain_gap_assess` here, once, to identify specific missing
   prerequisites. **Why once, not per agent:** five agents each independently calling
   `brain_grade_calibrate` would be five identical Brain round-trips for one answer -- pulling it
   once and passing the same table to every agent is the main cost saving of this design, and the
   whole reason Phase 0 exists as a distinct sequential step.
3. Read `agents/grading.md` in full -- its five rubric components (Vision 20%, Problem Definition
   25%, Feasibility 20%, Market 20%, Completeness 15%), their full scoring definitions, and its
   Never Do list are what Phase 1 hands to each component agent, verbatim.

### 4. Phase 1: Per-Component Fan-Out (PARALLEL)

One agent per rubric component, dispatched in parallel. Five components sit exactly at
`FUTURES_FANOUT_CAP` (the shared fan-out cost-governor cap, `lib/core/futures/orchestrator.cjs`,
default 5) -- **no batching is needed for the five-component rubric**, unlike `grade-grant`'s
seven-category panel, which needs `grade-grant`'s two-batch idiom (5 + 2) to stay under the same
cap. If a future reconciliation ever raises the deep-grade component count back toward seven, this
file should adopt that same two-batch idiom rather than asking `resolveFanoutCap` to raise the
ceiling -- the cap is a real cost-governor safety rail, not a number to negotiate around.

**Each subagent's contract:**

- **Input:** the component name, its weight, its full scoring definition verbatim from
  `agents/grading.md`, the shared calibration anchor table pulled in Phase 0, the room path, and
  the Never Do rules -- especially "always cite specific calibration submissions from Brain" and
  "never present percentiles as statistically precise".
- **Work:** read the room through THAT component's lens only and score 1 to 10 with cited
  evidence. A score without specific evidence from the submission is forbidden by the agent's own
  Never Do list ("Give a score without specific evidence from the submission").
- **Returns:** `{component, score, weight, evidence[], gap, calibration_comparison}`.
- **Constraint:** no writes, no percentile computation, no aggregate. Those are Phase 2, below,
  because they are whole-submission operations no single component agent can perform correctly.

**The Completeness special case, handled explicitly.** `Completeness 15%` is inherently
cross-section: it judges whether the submission reads as a coherent whole with no sections
missing, which cannot be scored by an agent holding only one lens without seeing what the OTHER
four components found missing along the way. This file scores Completeness in the ORCHESTRATOR,
AFTER the fan-out returns, using the other four agents' `gap` fields as its input (rather than
dispatching a fifth agent that would have to read the whole room anyway, defeating the point of a
lens partition). Completeness therefore does not fan out with the other four; it is computed in
Phase 2 alongside the percentile and the aggregate.

**Dispatch idiom.** Dispatch the four fan-out agents (Vision, Problem Definition, Feasibility,
Market) in ONE message via the Agent tool, each with an explicit `subagent_type` resolving to a
real `agents/*.md` file verified on disk (`agents/grading.md`, scoped per-invocation to that one
component) -- never a bare file path. Do NOT pass any manual background-execution parameter to the
Agent tool call; Claude Code runs spawned subagents under fork mode by default and removes that
kind of parameter from the Agent tool entirely once fork mode is on. The platform caps concurrent subagents at 20
(`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); four agents is well under that ceiling, but name it here
as the standing rule so a future author does not reintroduce an unbounded fan-out. Print a status
block before dispatching:

```
[DEEP-GRADE] Dispatching N component agents

  Agent 1: Vision              [running]
  Agent 2: Problem Definition  [running]
  Agent 3: Feasibility         [running]
  Agent 4: Market              [running]

  Model: {resolved model}
  Calibration anchors: pulled once in Phase 0
  Waiting for all agents...
```

`commands/deep-grade.md` already declares `Agent` in `allowed-tools` with a reviewed row in
`data/subagent-dispatch-grants.json` from plan 265-12 -- this phase does NOT add a second dispatch
token and does NOT edit that registry.

### 5. Phase 2: Consolidate (SEQUENTIAL, orchestrator only)

1. **Score Completeness** in the orchestrator, using the four returned `gap` fields as described
   above.
2. **Consistency check, fail closed -- copying `consolidatePanel` rather than reinventing it.** If
   one component agent finds a claim unsupported while another agent's read implicitly treats that
   same claim as validated, the panel SURFACES the disagreement instead of averaging it away. This
   mirrors `lib/core/eureka/grade-grant-examine.cjs`'s `consolidatePanel`: "a merge collision fails
   CLOSED: the stricter status wins and is recorded." Collect any such disagreement into a
   `disputes` list and render it ABOVE the percentage in the final assessment -- explicitly
   because burying a disagreement under the score would be the false-success failure class this
   repo watches for.
3. **Compute the weighted aggregate and the percentile IN THE ORCHESTRATOR**, never in a component
   agent. A percentile compares the whole submission against the whole calibration distribution
   and is not a per-component operation; the weighted aggregate sums across all five components,
   which no single agent can do from its own one-lens read. Keep the existing percentile honesty
   rule (prefix with `~`, note the small sample size).
4. **Keep in the orchestrator, unchanged:** the Sci-Fi Literature Connection, the Visual Synthesis
   prompt (both are whole-submission syntheses), the Top 3 Improvements ranking (a cross-component
   priority call), and the Professor Aronhime's Perspective quote.
5. Hand the consolidated assessment to step 6's Larry wrap exactly as before. The panel does the
   scoring; Larry still does the teaching.

**Scope fence.** `grade-grant`'s reviewer panel is a HYBRID whose second half is a SEQUENTIAL
`runDebate` where each reviewer reads `previousOutput` and may emit downgrade-only challenges
(downward only, evidenced to asserted to absent, never upward -- the panel is at least as strict as
its strictest reviewer). That sequential debate is where the deepest quality gain lives, and it is
a larger build than this plan's scope. This plan ships the PARALLEL extraction plus fail-closed
consolidation ONLY; the sequential debate half is named here as a follow-on candidate for the
capability ledger (plan 265-23 owns the ledger rows), not something forgotten.

### 6. Larry Wraps the Results

When the Grading Agent returns its structured assessment, Larry presents the results with:
- **Teaching context** -- explain what each score means in practical terms
- **Encouragement where earned** -- if a component scores well, acknowledge the work that went into it
- **Specific next steps** -- for each weak component, recommend the specific `/mos:` command that addresses it
- **The bigger picture** -- connect the assessment to the user's venture journey, not just numbers

The Grading Agent does the scoring. Larry does the teaching.

### 7. Offer to File

Ask: "Want me to file this assessment to your Data Room?" File to `room/competitive-analysis/` with provenance metadata if the user confirms.

## Difference from /mos:grade

| Aspect | grade | deep-grade |
|--------|-------|------------|
| Brain required | No | Yes |
| Calibration data | None (static rubric) | 100+ real projects |
| Scoring model | 6-component (`references/methodology/grade.md`'s static rubric) | 5-component weighted |
| Percentile ranking | No | Yes |
| Assessment engine | Larry directly | Grading Agent |

## Voice

Larry's voice wraps the Grading Agent's analytical output:
> "The calibration data tells a clear story here. Let me walk you through what it means for your venture..."

Never present raw scores without context. Every number should connect to an action.
