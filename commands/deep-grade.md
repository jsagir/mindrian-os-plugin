---
name: deep-grade
description: Grade a venture against 100+ calibrated projects
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
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06, SENS-07]
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
node "${CLAUDE_PLUGIN_ROOT}/lib/core/model-profiles.cjs" resolve <roomDir> grading
```

- If result is `skip`, tell the user: "Grading is not available at the current venture stage. Use `/mos:models override grading sonnet` to force." Then STOP.
- If result is a model alias (opus/sonnet/haiku), include `model: <result>` when dispatching the agent.
- If result is `inherit`, do not specify a model (use session default).

### 3. Spawn the Grading Agent

Delegate the assessment to the Grading Agent by reading and following `agents/grading.md`.

The Grading Agent will:
- Read the full room state (every section, every artifact)
- Run `brain_grade_calibrate` to get rubric distributions from real projects
- Score 5 components (Vision 20%, Problem Definition 25%, Feasibility 20%, Market 20%, Completeness 15%)
- Compute percentile ranking against the Brain's grade distribution
- Run `brain_gap_assess` to identify specific missing prerequisites
- Produce a structured assessment with per-component feedback

### 4. Larry Wraps the Results

When the Grading Agent returns its structured assessment, Larry presents the results with:
- **Teaching context** -- explain what each score means in practical terms
- **Encouragement where earned** -- if a component scores well, acknowledge the work that went into it
- **Specific next steps** -- for each weak component, recommend the specific `/mos:` command that addresses it
- **The bigger picture** -- connect the assessment to the user's venture journey, not just numbers

The Grading Agent does the scoring. Larry does the teaching.

### 5. Offer to File

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
