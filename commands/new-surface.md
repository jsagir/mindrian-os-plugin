---
name: new-surface
description: Generate a new command, agent, or skill surface with its connector wiring
help_jtbd: "Scaffold a new /mos surface (command/agent/skill) with its 11-key connector frontmatter, then regenerate the registry and manifest."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It proposes one new surface for a single approve-or-reject decision."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 2): first delivery at commands/new-surface.md:111, the emitted surface path and registry confirmation, a correctly-wired skeleton the navigator still has to hand-fill.
interactive_first_reward: schema_preview
argument-hint: "[kind] [name]"
serves_jtbd: ["explore"]
teaching: "When you are adding a new command, agent, or skill to the harness, /mos:new-surface emits the surface .md with the correct 11-key connector frontmatter so its wiring is declared, never hand-written, then regenerates the connector-registry (its real home) and the harness-manifest wiring digest. Harness-as-code for surfaces."
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
# new-surface declares no frameworks: block; the connector carries framework: null
# and filing: none with NO decision surface that fires a command, so the WFL-01
# firesCommand gate does not fire (mirrors commands/new-project.md). surface: F.1
# is the Shape F.1 Next-Move sub-shape, matching the discover.md precedent for a
# Larry-led generate flow.
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-01]
  reach_id: context_block
  sub_mode: new-surface
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

# /mos:new-surface

You are Larry. This command is the harness-as-code onboarding front door for SURFACES. A navigator who is adding a new command, agent, or skill to the harness should never hand-write its wiring; /mos:new-surface generates the surface .md with the correct 11-key connector frontmatter and lands it in the registry and manifest deterministically.

## What this is (and is not)

`/mos:new-surface` reuses the `/mos:new-project` SCAFFOLD-BACKEND pattern: deterministic file emission plus the 11-key connector frontmatter contract (`docs/CONNECTOR-CONTRACT.md`). It is PATTERN reuse, not literal extension. `/mos:new-project` scaffolds a ROOM (folders, sections, ROOM.md per folder); `/mos:new-surface` scaffolds a SURFACE (a single command / agent / skill .md), a different artifact. It does NOT touch `/mos:ignite` (the conversational birth-gate front door for rooms); ignite is out of scope.

A new tool identity rides `sub_mode` (a render label), NEVER a new `reach_id`. The reach_id must be one of the frozen 6 (`context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`, `hats`) and the posture one of the frozen 3 (`push_forward`, `hold`, `pull_back`). The generator refuses an off-frozen value.

Bulk backfill of the existing commands is OUT of scope. This command makes per-surface wiring cheap; backfill is its own follow-on.

## Step 1: Collect the surface spec

Have a short conversation to collect the new surface's connector spec:

- **kind:** command | agent | skill
- **name:** a lowercase slug (e.g. `find-tensions`)
- **reach_id:** one of the frozen 6
- **sub_mode:** the intelligence-tool identity as a render label (free text)
- **framework:** the EXACT Brain `:Framework` name if the surface fires a methodology command, else `null`
- **posture:** one of the frozen 3
- **hierarchy_rank:** the Intelligence Hierarchy position (an integer)
- **sensor_triggers:** the SENS ids that surface this reach (or `[]`)
- **filing:** `fileEvidenceWithReadback` | `memory_event_only` | `none`
- **plan_gated:** `true` ONLY for a `deep_research` escalation, else `false`
- **web_scope:** `null` or one of the hat colors
- **surface:** the Shape-F sub-shape (e.g. `F.1`)

Push back on vague answers. If the user proposes a new reach, redirect: a new tool identity rides `sub_mode`, never a new reach_id.

## Step 2: Delegate the deterministic emission

Delegate the file emission to the scaffold backend (`scripts/build-new-surface.cjs`), the new-project delegation pattern. Write the spec to a temp JSON file, then run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-new-surface.cjs" --spec /tmp/new-surface-spec.json
```

The backend:
1. Validates the spec against the frozen banks (refusing an off-frozen reach_id or posture).
2. Writes the surface .md to `commands/<name>.md`, `agents/<name>.md`, or `skills/<name>/SKILL.md` carrying the 11-key connector frontmatter in contract order.
3. SHELLS OUT (fresh node processes) to regenerate `data/connector-registry.json` (the surface's REAL home, where the new surface is now registered) THEN `data/harness-manifest.json` (whose wiring digest and source_count now reflect the larger registry).

The surface lands in `connector-registry.json` (its real home) and only TRANSITIVELY in the manifest wiring digest. There is NO per-surface manifest row (D-166-03): the manifest stays a 3-map digest.

## Step 3: Run the --check

Prove the surface is well-formed, registered, and the manifest is clean:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-new-surface.cjs" --check --kind <kind> --name <name>
```

This asserts: the 11 connector keys are present, the reach_id is in the frozen 6, the posture is in the frozen 3, the surface is REGISTERED in `connector-registry.json`, and the harness-manifest `--check` is clean. A finding (MISSING_KEY / OFF_FROZEN / NOT_REGISTERED / MANIFEST_STALE) exits non-zero with a recovery line.

## Step 4: Report

Tell the navigator:

- The emitted path.
- That the surface is registered in `connector-registry.json` (its real home).
- That the manifest wiring digest now reflects it (no per-surface manifest row).
- The next move: edit the emitted .md body to add the surface's actual behavior. The wiring is done; only the body is now hand-written.
