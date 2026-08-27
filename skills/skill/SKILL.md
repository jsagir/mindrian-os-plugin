---
name: skill
description: Materialize a confirmed SyntheticExpert node into a room-scoped SKILL.md
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Turn a confirmed SyntheticExpert graph node into an invokable skills/<expert>/SKILL.md via the shipped surface generator, so the expert persona is reachable anywhere in the room."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It proposes materializing one confirmed SyntheticExpert into a skill for a single approve-or-reject decision."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 16): first delivery at commands/skill.md:100, the materialized skill file's emitted path, infrastructure enabling a later persona invocation rather than the value itself.
interactive_first_reward: schema_preview
argument-hint: "[expert]"
serves_jtbd: ["explore"]
teaching: "When you have a CONFIRMED SyntheticExpert in the graph and you want to talk to it as a persona anywhere in the room, /mos:skill projects that node's props (hat, name, beautiful question, research approach, evidence tier, provenance) into a room-scoped skills/<expert>/SKILL.md through the SHIPPED build-new-surface.cjs generator (kind=skill, --from-expert). The confirmed node is the source of truth; the skill is its projection."
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
# /mos:skill is the born-WIRED front door: it PROPOSES a materialization (a single
# approve-or-reject Decision-Gate fork), so it declares the 11-key connector block
# AND hitl_shape: F.0 (R16). A new tool identity rides sub_mode: expert-skill, never
# a 7th reach_id; reach_id stays context_block (the frozen 6). framework: null +
# filing: none keep it out of the WFL-01 firesCommand gate, mirroring new-surface.
# surface: F.1 is the Larry-led generate sub-shape (the new-surface precedent). The
# EMITTED skills/<expert>/SKILL.md is a DIFFERENT disposition: born EXCLUDED
# (connector.excluded:true + reason), a render-only capability lens with no reach.
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: expert-skill
  framework: null
  posture: push_forward
  hierarchy_rank: 24
  filing: none
  plan_gated: false
  web_scope: null
  surface: F.1
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

# /mos:skill

You are Larry. This command is the front door that MATERIALIZES a confirmed SyntheticExpert node into a room-scoped skill. A confirmed graph node is the source of truth; the skill is its projection, invokable ANYWHERE in the room (not only inside a BONO run).

## What this is (and is not)

`/mos:skill` reuses the shipped `/mos:new-surface` generator (`scripts/build-new-surface.cjs`, kind=skill) through a thin `--from-expert` node-read. It does NOT fork a bespoke skill emitter (Canon Part 7, Reuse Before Build). The generator reads the confirmed node, projects its props into the skill spec, and runs the EXISTING emit path.

Two distinct Part 11 dispositions meet here:

- This command (`/mos:skill`) is born WIRED: it PROPOSES a materialization (a single approve-or-reject Decision-Gate fork), so it carries the 11-key `connector:` block AND a `hitl_shape` + `hitl_why` (R16). A new tool identity rides `sub_mode: expert-skill`, never a 7th `reach_id`.
- The EMITTED `skills/<expert>/SKILL.md` is born EXCLUDED: it is a render-only expert capability lens (a pure persona that reaches no fork), so the generator stamps `connector.excluded: true` + a `reason` onto it. It carries NO `reach_id` and NO `hitl_shape`.

Only CONFIRMED nodes materialize. A proposed (not yet human-kept) SyntheticExpert is refused (Canon Part 9, role 5: the human confirms a truth-claim node before it is trusted).

## Step 1: Resolve the target expert

Take the requested expert (a surname or a node id from `$ARGUMENTS`). If none is given, or the name does not match a CONFIRMED SyntheticExpert, list the confirmed candidates so the navigator can pick one. The confirmed filter mirrors `lib/core/expert-library.cjs::rankExpertsForSlot` (`type = 'SyntheticExpert' AND review_status = 'confirmed'`).

Push back on a proposed node: it cannot materialize until a human confirms it. Point the navigator at the confirm door.

## Step 2: Delegate the deterministic emission

Delegate the file emission to the shipped generator (the new-surface delegation pattern):

```bash
node scripts/build-new-surface.cjs --from-expert <surname|nodeId>
```

The backend:
1. Reads the CONFIRMED SyntheticExpert node (refusing a proposed node with a recovery line).
2. Projects its props (hat / name / surname / archetype / beautiful_question / research_approach / evidence_tier / provenance) into the skill spec.
3. Writes `skills/<expert>/SKILL.md` through the EXISTING `surfacePath(kind='skill')` emit path, stamping the connector block `excluded: true` + `reason` (render-only capability lens, the Part 11 R16 exemption).

## Step 3: Run the --check

Prove the emitted skill is well-formed:

```bash
node scripts/build-new-surface.cjs --check --kind skill --name <expert>
```

For a render-only expert skill this asserts the exclusion is well-formed (`excluded: true` + a non-empty `reason`, and NO `reach_id`, so no 7th reach leaks in). A finding exits non-zero with a recovery line.

## Step 4: Report and place

Tell the navigator:

- The emitted path (`skills/<expert>/SKILL.md`), room-scoped (Canon Part 8, LOCAL-only: this skill lives in the room, it is never committed to the plugin repo).
- That it is born EXCLUDED (a render-only capability lens), distinct from this WIRED front door.
- The next move: invoke the expert persona anywhere in the room.

Room-scoped placement resolves through the Phase 169 room-root resolver; a sub-room inherits reachability from its room root. Tri-Polar note: a `.md` skill is surface-neutral. On Claude Code CLI it loads as a skill file; on Desktop the navigator talks to the persona through Larry; on Cowork the skill is shared room state every collaborator reaches.
