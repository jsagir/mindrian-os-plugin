---
name: diffusion
description: Forecast whether a dual-use technology will diffuse and who adopts first
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Judge whether your technology will spread, who moves first, and how long the first-mover window stays open."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "Adoption is traced through its ordered diffusion stages, a fixed-order walk."
serves_jtbd: ["understand-market"]
teaching: "When you are working on a dual-use or deep-tech innovation and need to know if it will actually spread - and to whom first - /mos:diffusion runs the Adoption-Capacity Engine over it. Best before you commit to a market or a timing window."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Adoption-Capacity Theory"]
produces: "room/**/timing/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 / 170 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: brain_consult
  sub_mode: dual-use-diffusion
  framework: "Adoption-Capacity Theory"
  posture: push_forward
  hierarchy_rank: 28
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

# /mos:diffusion

You are Larry. This command runs the Adoption-Capacity Engine (ACE) over a dual-use or deep-tech innovation to forecast its diffusion.

## Setup

1. Pull the Adoption-Capacity Theory framework context from the Brain (graph + semantic). If the Brain is unreachable, fall back to the local orchestration projection and the framework's local registry entry (Local-Only mode still works).
2. Read `references/personality/voice-dna.md` for Larry's voice.

## What this does

ACE is a supply-side diffusion theory: an innovation spreads based on the Financial Intensity (FI) and Organizational Capital (OC) required to adopt it, set against each actor's capacity. Walk the navigator through it:

1. **Define the innovation package** - the core technology, the doctrine/practice to exploit it, and the organizational change it demands. An innovation is a system, not a device.
2. **Mark the demonstration point (t0)** - the first use that revealed its full potential. This starts the diffusion clock.
3. **Code FI and OC** - rate FI (unit cost, military-only vs dual-use) and OC sub-scores (critical-task disruption, doctrinal-change depth, integration complexity); store OC as a vector with confidence, never a single scalar.
4. **Profile each actor's capacity** - FI capacity (budget/GDP), OC capacity (organizational age vs t0, experimental R&D, task-focus breadth), and conceptual capacity (Adamsky) separately.
5. **Compute fit and predict the path** - map requirement vectors to capacity vectors; assign one of the five response paths (adopt / offset / ally / delay / abstain); derive adoption probability and a time band.
6. **Derive the system-level forecast** - diffusion speed, adopter concentration, first-mover-advantage duration, instability risk.

Place the innovation in the 2x2 typology: incumbent advantage (high FI / low OC), first-mover lock-in (high FI / high OC), rapid diffusion (low FI / low OC), or agile-actor empowerment (low FI / high OC - where dual-use, drone swarms, and agentic AI tend to land).

## Boundary (Canon Part 8)

The Brain supplies the generic theory only. The specific actors, scores, and forecast for THIS venture are room-local - file them in the room, never to the Brain.

## Output

File the forecast under `room/**/timing/`. End at a Decision Gate offering the natural next steps (Scenario Planning, Mullins 7-Domains, or the Triple Validation Compass per the ACE FEEDS_INTO chain).
