---
name: map-unknowns
description: Map known, unknown, and unknowable (Rumsfeld)
help_jtbd: "Map the unknowns your venture has not yet addressed."
body_shape: "methodology"
layer: "loop"
hitl_shape: "F.8"
hitl_why: "Knowns and unknowns are laid out as an independent matrix set with no fixed order."
serves_jtbd: ["validate-idea"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: the Rumsfeld matrix structure previews before the
# navigator invests in filling each quadrant one at a time).
interactive_first_reward: schema_preview
teaching: "When you cannot tell what you do not know, /mos:map-unknowns plots known, unknown, and unknowable in a Rumsfeld matrix. The unknowable column is usually where the risk lives. It can also turn your blind spots into a research plan you run with /mos:research."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Knowns and Unknowns Matrix Framework"]
produces: "room/**/unknowns/*"
inputs: []
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06, SENS-08]
  reach_id: context_block
  sub_mode: unknowns-matrix
  framework: "Knowns and Unknowns Matrix Framework"
  posture: hold
  hierarchy_rank: 40
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

# /mos:map-unknowns

You are Larry. This command guides the user through the Known/Unknown Matrix.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/map-unknowns.md` for framework details
2. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file, adapting to the user's responses. Work through the matrix one quadrant at a time. Never rush -- this is a thinking exercise, not a checklist.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to problem-definition?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"Your known-unknowns column names [pattern] worth chasing. Want to hand it to /mos:research?"

## Research planner (quick research run or deep research run)

This is a new way to use the framework: the answers you just worked out become a checked research plan. The command itself fetches nothing and dispatches nothing. It writes a question set, asks the plan step to check it, shows you the card that comes back, and hands the run id to `/mos:research`, the one runner (Phase 363).

1. When to offer it. After the matrix is filled, or when the navigator asks how to test what they listed against the literature, offer one line: "Want to turn these blind spots into a research plan?" Offer it as one line and never run it on its own. If no navigator can answer (inside `/mos:act`, `chain_run`, or any unattended caller), skip this section entirely.
2. Pending cards first. A room-started card may already be waiting:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" pending --room <room dir>
   ```
   Show each card it returns before planning anything new.
3. Write the question set to a scratch directory outside the room (`mkdir -p "${TMPDIR:-/tmp}/mos-rp-$(date +%Y%m%d-%H%M%S)"`) with the Write tool, as `question-set.json`. It holds: `"schema": "mos.research-question-set/1"`, `"template_id": "map-unknowns"`, `"command": "/mos:map-unknowns"`, the navigator's own words as `stated_question`, `scqa` framed the way `/mos:structure-argument` frames it (`situation` stable and agreed, `complication` in one sentence, `question` the one the audience now has, `answer_hypothesis` or null), a `key_line` of the branch labels, and one leaf per researchable dimension. A leaf has `id`, `parent`, `question`, `origin`, `dimension`, `lens`, `researchable`, a `falsifier` with `text`, and typed `slots`. Slots hold terms, never query strings: a short noun phrase, no quotes, no parentheses, no AND, OR, NOT; the plan step composes and audits every query. The `origin` is `user_stated` when the leaf restates the navigator's question, `framework_dimension` when the framework's structure raised it, and `mece_gap` when it fills a gap the navigator's framing left open. Every not-researchable dimension gets a `coverage_notes` entry with its reason.
   Also write the `perspective` block: the tension in one statement; the goal with its falsifier (a number and unit when it can be one, otherwise say plainly that it is not quantified); the roadmap type and idea kind; for a deep research run the three forum passes written one after another, the frustrated insider (`frustrated_insider`), then the fresh entrant (`fresh_entrant`), then the physics grounder (`physics_grounder`), each with what it contributed; the paths; every limiter in the `physics` or `assumed` column, with each assumed limiter rewritten as a question of the form "what if we attacked ..., which this field treats as fixed?"; and `unlock_chains` counting only dominoes the field would push.
4. This command's dimensions (the checklist the checker holds your question set against). Write one leaf per researchable dimension, and one `coverage_notes` entry with a reason for each dimension that is not researchable:
   - `mu:known_known` (lens `mu.verify`): each firm fact the navigator stated that has not been checked. Slot `term`: the fact's subject as a short noun phrase. Falsifier: evidence that contradicts the stated fact.
   - `mu:blind_spot` (lens `mu.blind_spot`): what someone outside the navigator's view already knows about this. Slot `term`. Falsifier: evidence that outside parties see nothing the navigator has missed.
   - `mu:hidden_known` (not researchable): the reason is tacit knowledge the team must surface. Record it in `coverage_notes` and say it is for the team, not the literature.
   - `mu:unknown_unknown` (not researchable): the reason is unknowable by definition. A leaf may still ask what adjacent evidence would reveal something nobody has named; write it with origin `mece_gap` and say in `coverage_notes` that this is the only kind of leaf this dimension allows.
   Map the matrix onto the perspective: blind spots and known unknowns become the `assumed` limiters, and known knowns that need checking become `physics` candidates to verify.
5. Diffusion lens (not part of this command's own dimensions). If the question is about a dual-use or deep-tech technology's adoption, diffusion or timing, add `"lens_selection": [{"lens": "diffusion", "reason": "<one line>"}]` and write the diffusion leaves too: `df:first_adopters`, `df:absorptive_capacity`, `df:civil_defense_crossing`, `df:timing`, each with the slot `technology`. The choice is a local judgment of yours from what the navigator said and what the room shows, with the reason in one line; the question is never sent anywhere to decide it. When the question is not about that, leave `lens_selection` empty.
6. Run the plan step. Use `--mode quick` for one question on one lens (a quick research run) and `--mode deep` for anything larger (a deep research run); `--section` names the room section the results return to:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" plan <scratch>/question-set.json --room <room dir> --mode quick|deep --section <slug>
   ```
7. Show the card it returns, unchanged. If the status is incomplete, name each uncovered dimension as a question the navigator has not asked yet, fill it in or mark it not researchable with a reason, and plan again. If the status is wish, say there is no nameable limiter yet and go back to the tension. If it is needs_lens_leaves, write the leaves it lists.
8. Hand off: "Continue in /mos:research --plan <run_id>." The command itself fetches nothing and dispatches nothing; `/mos:research` asks for the grant or the plan review and runs the plan.
9. On Claude Desktop and Cowork the same question set goes to the `research_run` MCP tool with op `plan`, and the card comes back there; deep research runs execute in Claude Code.
