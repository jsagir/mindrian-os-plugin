---
name: root-cause
description: Trace root cause via 5-Whys, Fishbone, Fault Tree
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Trace the root cause of a symptom in your venture."
body_shape: "methodology"
layer: "loop"
hitl_shape: "F.9"
hitl_why: "The 5-Whys and fishbone drill down in a fixed order, an ordered walk toward the root."
serves_jtbd: ["find-problem"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the first Why reframes the navigator's own symptom as
# a sharper question before they invest in the full 5-Whys drill).
interactive_first_reward: reframe_question
teaching: "When the symptom keeps coming back, /mos:root-cause traces it via 5-Whys, Fishbone, and Fault Tree. Treats the cause, not the recurrence. Each why that rests on an assumption can become a research question with its own falsifier."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Root Cause Analysis"]
produces: "room/**/root-cause/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: root-cause-5why
  framework: "Root Cause Analysis"
  posture: hold
  hierarchy_rank: 42
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.2
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

# /mos:root-cause

You are Larry. This command guides the user through Root Cause Analysis.

## Setup

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/root-cause.md` for framework details
2. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The root cause you found connects to /mos:find-bottlenecks. Want to explore that next?"

## Research planner (quick research run or deep research run)

This is a new way to use the framework: the answers you just worked out become a checked research plan. The command itself fetches nothing and dispatches nothing. It writes a question set, asks the plan step to check it, shows you the card that comes back, and hands the run id to `/mos:research`, the one runner (Phase 363).

1. When to offer it. After the whys are laid out, or when the navigator asks how to test them against the literature, offer one line: "Want to turn the whys that rest on an assumption into a research plan?" Offer it as one line and never run it on its own. If no navigator can answer (inside `/mos:act`, `chain_run`, or any unattended caller), skip this section entirely.
2. Pending cards first. A room-started card may already be waiting:
   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/research-planner.cjs" pending --room <room dir>
   ```
   Show each card it returns before planning anything new.
3. Write the question set to a scratch directory outside the room (`mkdir -p "${TMPDIR:-/tmp}/mos-rp-$(date +%Y%m%d-%H%M%S)"`) with the Write tool, as `question-set.json`. It holds: `"schema": "mos.research-question-set/1"`, `"template_id": "root-cause"`, `"command": "/mos:root-cause"`, the navigator's own words as `stated_question`, `scqa` framed the way `/mos:structure-argument` frames it (`situation` stable and agreed, `complication` in one sentence, `question` the one the audience now has, `answer_hypothesis` or null), a `key_line` of the branch labels, and one leaf per researchable dimension. A leaf has `id`, `parent`, `question`, `origin`, `dimension`, `lens`, `researchable`, a `falsifier` with `text`, and typed `slots`. Slots hold terms, never query strings: a short noun phrase, no quotes, no parentheses, no AND, OR, NOT; the plan step composes and audits every query. The `origin` is `user_stated` when the leaf restates the navigator's question, `framework_dimension` when the framework's structure raised it, and `mece_gap` when it fills a gap the navigator's framing left open. Every not-researchable dimension gets a `coverage_notes` entry with its reason.
   Also write the `perspective` block: the tension in one statement; the goal with its falsifier (a number and unit when it can be one, otherwise say plainly that it is not quantified); the roadmap type and idea kind; for a deep research run the three forum passes written one after another, the frustrated insider (`frustrated_insider`), then the fresh entrant (`fresh_entrant`), then the physics grounder (`physics_grounder`), each with what it contributed; the paths; every limiter in the `physics` or `assumed` column, with each assumed limiter rewritten as a question of the form "what if we attacked ..., which this field treats as fixed?"; and `unlock_chains` counting only dominoes the field would push.
4. This command's dimensions (the checklist the checker holds your question set against):
   - `rc:why_link` (lens `rc.why_link`, always): one leaf per why that rests on an assumption rather than on evidence. Slots `cause` and `effect`, each a short noun phrase. Falsifier: the link breaks, or a confound explains it.
   - When there are several causes, set `"multi_cause": true` and cover the six Fishbone dimensions: `rc:6m_man`, `rc:6m_machine`, `rc:6m_method`, `rc:6m_material`, `rc:6m_measurement`, `rc:6m_nature` (lens `rc.6m`, same slots and falsifier). A factor with nothing to test gets a `coverage_notes` reason. With a single causal chain, leave `multi_cause` out; the six close on their own with the reason single causal chain.
   Map the whys onto the perspective: each why answered by an assumption becomes an `assumed` limiter to re-test; each why answered by evidence stays in the `physics` column until a leaf says otherwise.
5. Diffusion lens (not part of this command's own dimensions). If the question is about a dual-use or deep-tech technology's adoption, diffusion or timing, add `"lens_selection": [{"lens": "diffusion", "reason": "<one line>"}]` and write the diffusion leaves too: `df:first_adopters`, `df:absorptive_capacity`, `df:civil_defense_crossing`, `df:timing`, each with the slot `technology`. The choice is a local judgment of yours from what the navigator said and what the room shows, with the reason in one line; the question is never sent anywhere to decide it. When the question is not about that, leave `lens_selection` empty.
6. Run the plan step. Use `--mode quick` for one question on one lens (a quick research run) and `--mode deep` for anything larger (a deep research run); `--section` names the room section the results return to:
   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/research-planner.cjs" plan <scratch>/question-set.json --room <room dir> --mode quick|deep --section <slug>
   ```
7. Show the card it returns, unchanged. If the status is incomplete, name each uncovered dimension as a question the navigator has not asked yet, fill it in or mark it not researchable with a reason, and plan again. If the status is wish, say there is no nameable limiter yet and go back to the tension. If it is needs_lens_leaves, write the leaves it lists.
8. Hand off: "Continue in /mos:research --plan <run_id>." The command itself fetches nothing and dispatches nothing; `/mos:research` asks for the grant or the plan review and runs the plan.
9. On Claude Desktop and Cowork the same question set goes to the `research_run` MCP tool with op `plan`, and the card comes back there; deep research runs execute in Claude Code.
