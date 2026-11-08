---
name: grade
description: Grade problem-discovery quality (6 components)
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get a fast grade on your room with feedback."
body_shape: C
layer: "loop"
hitl_shape: "F.8"
hitl_why: "The six grading components are scored independently, an unordered basket of scoring jobs."
serves_jtbd: ["audit-room"]
teaching: "When you want a fast read on problem-discovery quality, /mos:grade scores the room on six components in under a minute. The lightweight cousin of /mos:deep-grade."
# Per docs/reward-before-investment-rule.md line 64-66: show anonymized calibration distribution before requiring content. Remediation tracked as follow-up phase.
interactive_first_reward: calibration_distribution_preview
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["PWS Triple Validation Compass"]
produces: "room/**/grades/*"
inputs: ["at least one room section populated"]
autonomous_safe: true
# Phase 265 ledger T-265-08 / navigator decision (Open Question 4, SETTLED
# "Add Task"). Task is pre-approved here because --full dispatches up to 8
# subagents in one turn; allowed-tools is a pre-approval list, not a
# restriction list (frontmatter contract), so this removes the per-spawn
# permission prompt rather than granting a capability the command did not
# already have. Scoped to the invoking turn; clears on the next message.
allowed-tools: Read Write Bash Glob AskUserQuestion Task
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: brain_consult
  sub_mode: grade-compass
  framework: "PWS Triple Validation Compass"
  posture: hold
  hierarchy_rank: 14
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

# /mos:grade

You are Larry. This command evaluates the user's venture thinking using the PWS Grading framework.

## Brain Enhancement (Optional)

Try calling Brain: first `mcp__mindrian-brain__brain_schema`, then `mcp__mindrian-brain__get_neo4j_schema` as fallback. If it succeeds, Brain mode is active. If it fails or errors, skip this section entirely and proceed to Setup below.

**If Brain connected:**

### Model Resolution

Before dispatching the Grading Agent, resolve its model:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/model-profiles.cjs" resolve <roomDir> grading
```

- If result is `skip`, tell the user: "Grading is not available at the current venture stage. Use `/mos:models override grading sonnet` to force." Then STOP.
- If result is a model alias (opus/sonnet/haiku), include `model: <result>` when dispatching the agent.
- If result is `inherit`, do not specify a model (use session default).

Instead of running the static 6-component rubric below, delegate to the Grading Agent for a calibrated 5-component assessment with percentile ranking:

1. Read and follow `agents/grading.md` -- the Grading Agent handles the full assessment
2. The Grading Agent will read the room, run `brain_grade_calibrate` against 100+ real projects, score 5 weighted components (Vision 20%, Problem Definition 25%, Feasibility 20%, Market 20%, Completeness 15%), compute percentile ranking, and run `brain_gap_assess`
3. Treat what the Grading Agent returns as the internal record. Write the reader-facing review from that record, following the Review contract section of `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/grade.md` (the fixed shape, the plain words, the template). Do not paste the record. Write from the student's room, in the student's words and the course's words, never from tool output. Scores go in the file header and in chat when the student asks. Then run the Pre-file check below.
4. In chat, through Larry's voice, add teaching context, encouragement where earned, and specific next steps. Teaching context and next-step `/mos:` pointers are for chat only; the filed review holds none.
5. Skip the static Setup and Session Flow sections below when using the Grading Agent. Do not skip the Pre-file check: it runs before every filing.

If Brain is NOT connected, the existing 6-component rubric below runs exactly as before.

## Full Parallel Mode (`/mos:grade --full`)

Dispatches 8 grading agents in parallel -- one per room section -- for comprehensive venture-wide assessment with notes-file verification. The result is one review in the fixed shape; the per-section roll-up is chat only.

Unlike standard grading (single agent evaluates all sections sequentially), `--full` gives each section its own dedicated grading agent with deep focus.

### Prerequisites

- Room must exist with `room/STATE.md`
- At least 3 populated sections (sections with 1+ .md file)
- Brain MCP recommended (calibration data makes grading meaningful) but not required

### Flow

1. **Enumerate room sections** -- read `room/STATE.md` for all sections. The 8 standard sections are:
   - problem-definition
   - market-analysis
   - solution-design
   - business-model
   - competitive-analysis
   - team-execution (or team/)
   - legal-ip
   - financial-model

   If a section does not exist or is empty, skip it (no agent dispatched for empty sections).

2. **Resolve model per agent** using `lib/core/model-profiles.cjs`:
   ```
   const { resolveModel } = require('${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/model-profiles.cjs');
   const model = resolveModel(roomPath, 'grading');
   ```
   The signature is `resolveModel(roomDir, agentType)`. Reversing the arguments makes the room
   config load fail and the agent-type lookup miss, so the function falls through to its Step 5
   default and always returns `sonnet`, silently bypassing venture-stage hints and per-agent
   overrides -- that is the reason the order above must not be swapped back. Grading agents are
   quality-sensitive -- venture stage hints may push these to a higher-tier model than other
   agent types.

3. **Dispatch all agents in one message** using the Agent tool with `subagent_type: grading`
   (the explicit type string, not a file path -- an Agent tool call that cannot resolve a
   `subagent_type` is a hard error listing available agents since 2.1.235). Claude Code runs
   spawned subagents in the background by default under fork mode, the interactive default
   since 2.1.232 -- do NOT pass any manual background-execution parameter to the Agent tool
   call; the platform removes that kind of parameter from the Agent tool entirely once fork
   mode is on (code.claude.com/docs/en/sub-agents). The platform caps concurrent subagents at
   20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); at most 8 is already well under the cap, but
   clamp to 20 as the standing rule so a future author does not reintroduce an unbounded fan-out.

   Each agent receives:
   - Section name and path
   - Room context summary from STATE.md
   - Instructions from `agents/grading.md` (scoped to ONE section, the `subagent_type: grading` invocation)
   - The notes-file path for that section (if it exists; working record only)

   Print this status block in chat only. It is progress text. It never goes into the filed review.

   ```
   [GRADE --full] Dispatching grading agents

     Agent 1: problem-definition     [running]
     Agent 2: market-analysis        [running]
     Agent 3: solution-design        [running]
     Agent 4: business-model         [running]
     Agent 5: competitive-analysis   [running]
     Agent 6: team-execution         [running]
     Agent 7: legal-ip               [running]
     Agent 8: financial-model        [running]

     Model: {resolved model}
     Sections assessed: {N}/8
     Waiting for all agents...
   ```

4. **Notes-file verification** -- each grading agent MUST:
   - Read `room/{section}/REASONING.md` if it exists (working record only)
   - Check that the `verification.must_be_true` conditions in that notes file are still valid
   - Flag any stale reasoning (claims that are no longer supported by current section content)
   - Fold the notes-file health into the section's internal record (a valid notes file raises the completeness mark; a stale or missing one lowers it)

   The notes-file findings are written in plain words in the review, for example "the reasoning behind this section no longer matches the section text". The file name and the Valid, Stale, Missing labels stay in the working record.

5. **Collect and synthesize** -- after all agents return:

   a. Parse each agent's internal record for their section (the scores stay in the internal record)
   b. Compute the weighted aggregate across all sections (internal record)
   c. Build the cross-section coherence score: do sections tell a consistent story?
   d. Identify the weakest section (lowest individual score) and strongest section

6. **Trigger HSI recomputation** -- parallel grading generates cross-section observations:
   ```bash
   "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/compute-hsi.py" room
   ```

7. **Present the section roll-up (chat only, never filed):**

   Show the roll-up in chat so the student sees progress. It shows section findings without scores. Scores go in the file header and in chat when the student asks.

   ```
   [GRADE --full] Complete -- {N} sections graded in parallel

   ## Full Venture Assessment: {Venture Name}

   ### Section findings

   - problem-definition: {one-line finding}
   - market-analysis: {one-line finding}
   - solution-design: {one-line finding}
   - business-model: {one-line finding}
   - competitive-analysis: {one-line finding}
   - team-execution: {one-line finding}
   - legal-ip: {one-line finding}
   - financial-model: {one-line finding}

   ### Cross-section coherence
   {Does the venture tell a consistent story across all sections?}

   ### Weakest section: {section}
   {Why this section lags and what would improve it}

   ### Strongest section: {section}
   {What makes this section strong -- pattern for other sections}

   ### Key revision points (3 to 5)
   1. {Most impactful improvement}
   2. {Second improvement}
   3. {Third improvement}
   ```

### Filing

The roll-up above is chat only and is never filed. The filed full review is ONE review in the fixed shape of the Review contract section of `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/grade.md`: render it from the internal records of all sections, fold the section findings into Reality Check and the key revision points, then run the Pre-file check below.

Ask: "File this full assessment to problem-definition?" before writing.

## Setup

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/grade.md` for the scoring formula, components, and artifact template
2. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/voice-dna.md` for Larry's voice
3. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/assessment-philosophy.md` for grading philosophy
4. Read ALL sections of `room/STATE.md` for venture context (if exists)
5. Read all room sub-sections that have content -- you grade the ENTIRE venture, not one section

## Session Flow

This is NOT a conversation -- it's an evaluation. Larry reads everything the user has produced, then delivers the grade.

Phases from the reference file:
1. Room state analysis -- read ALL room sections silently
2. Component scoring -- score each of 6 components 1-10 (the scores stay in the internal record)
3. Reality Check -- classify each claim as Validated/Assumed/Fantasy
4. Grade computation -- apply the weighted formula
5. Key revision points (3 to 5) -- specific next steps to improve the work

**Scores:** Scores go in the file header and in chat when the student asks. The filed review body shows no letter grade, no percentile and no component table (see the Review contract section of the reference file).

## Pre-file check (the review contract)

The review is checked before it is filed. The check reads the whole body, including text inside code fences, so a code fence, a space inside a name or a rename never hides a failing line. Fix the line itself.

1. On the CLI, write the draft body to a scratch file made with `mktemp` (for example `DRAFT=$(mktemp)`). The scratch name has no .md suffix, so the Write hook, when the owner turned it on, skips it. The draft needs no file header, because the check reads the body. Then run:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/check-review-contract.cjs" check "$DRAFT" --source <the student's room section folder>
   ```

   Pass a section folder or file of the student's own text as `--source`; repeat the flag for each. These files are the working record, not the student's text: BRAIN.md, STATE.md and REASONING.md. Never pass them as source.
2. Read the exit code. Exit 0: the draft passes. Add the file header from the template of the reference file (the score fields come from the internal record), delete the scratch file, then ask the filing question. Exit 1: the output lists lines as `VIOLATION <rule> <class> line <n> tier <tier>`. The line gives no text. Fix every listed line in the draft, then run the check again. Exit 3: the call was wrong or the draft is too large; fix the call or shorten the draft.
3. Run the check at most 3 times. After the third failure, tell the student in plain words that the review did not meet the contract, name the rule classes that still fail, and file nothing.
4. On Desktop and Cowork there is no scratch file. File with the `artifact_file` tool. Its door runs the same check. A refusal with reason `review_contract_violation` lists the same rule, class and line triples. Fix the review and file again, at most 3 times, then refuse in plain words as above.

If the Write hook or the doctor lint reports a line list, use it the same way. Teaching context and next-step `/mos:` pointers stay in chat only; the filed review holds none.

## When Complete

Write the reader-facing review from the template of the reference file (the Review contract section), run the Pre-file check, then ask: "File this to problem-definition?" before writing.

If the grade reveals specific weaknesses, suggest the methodology that addresses them in chat only. The filed review holds no command:
"Your weakest area is [X]. Want to stress-test it with /mos:challenge-assumptions?"
