---
name: diffusion
description: Forecast whether a dual-use technology will diffuse and who adopts first
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Judge whether your technology will spread, who moves first, and how long the first-mover window stays open."
body_shape: "methodology"
hitl_shape: "F.9"
hitl_why: "Adoption is traced through its ordered diffusion stages, a fixed-order walk."
serves_jtbd: ["understand-market"]
# Phase 265-22 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: naming the innovation package previews the 2x2
# typology structure (step 6) before the navigator invests in the full
# per-actor capacity profiling at step 4). Same value + same comment shape
# Phase 265-13 wired onto its four consumers.
interactive_first_reward: schema_preview
teaching: "When you are working on a dual-use or deep-tech innovation and need to know if it will actually spread - and to whom first - /mos:diffusion runs the Adoption-Capacity Engine over it. Best before you commit to a market or a timing window."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Adoption-Capacity Theory"]
produces: "room/**/timing/*"
inputs: []
# Phase 265-22: lets the navigation engine OFFER /mos:research at an F.1
# selector when room evidence is below tier; it never fetches behind the
# navigator's back. on: [market-analysis] matches analyze-timing.md (same
# produces path, room/**/timing/*). tier: Operational because ACE's step-5
# quantitative vector mapping consumes measured public facts (budget/GDP,
# organizational age, R&D spend), not a peer-reviewed citation, and not a
# single scalar recall guess -- the same tier macro-trends.md and
# analyze-timing.md already declare for comparable externally-sourced
# quantitative reads.
requires_evidence:
  tier: Operational
  on: [market-analysis]
  dispatch: /mos:research
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
  # web_scope stays null on PURPOSE (Phase 265-22): /mos:diffusion never
  # reaches the web itself. /mos:intel-pipeline, which declares web_scope:
  # green, does the reaching on its behalf via the roster-keyed fan (see
  # "Sourcing the capacity table" below). This is a GENUINE difference from
  # /mos:futures (whose own orchestrator calls the corpus-fetch chokepoint
  # directly, which is why futures flipped to green) -- do not "fix" this to
  # green assuming it is the same defect; it is not.
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

### Sourcing the capacity table

The actor roster does not exist until this step, after step 3's FI/OC coding, so a pre-chained
research pass would have had no targets to aim at - this is why the offer lives here, not earlier.

Once the roster is named, offer to hand it and the three ACE capacity axes (FI capacity, OC
capacity, conceptual capacity) to `/mos:intel-pipeline` as `roster` and `rosterAxes`
(`lib/core/intel-pipeline.cjs`), which fans one attributed lookup per actor-axis cell instead of
running on unaided recall. What the navigator sees first is the EXISTING F.1 fan-approve gate,
rendering the cost before a byte is fetched, in the shape "N actors x 3 axes = C lookups,
approve?" - this is not a new gate, and there is exactly ONE confirmation in this path. What comes
back is a born-proposed `EvidenceClaim` per cell with an `INFORMS` edge to its capacity row,
ratified at the existing F.5 synthesize gate; per-actor attribution is the point, because an
unattributed pile of findings is what a plain `/mos:research` run already gives, and step 5's
vector mapping cannot consume it.

If the navigator declines, ACE proceeds on their own recall, and the capacity table should be
marked as recall-sourced rather than presented as evidenced - a quantitative mapping fed by soft
numbers is the worst failure mode in this command, and this command says so plainly.

Only the generic actor handle (an organization name, a public handle) crosses toward the public
web; the room-local FI/OC scores, the forecast, and the venture context do not (Canon Part 8 -
see the boundary note below).

5. **Compute fit and predict the path** - map requirement vectors to capacity vectors; assign one of the five response paths (adopt / offset / ally / delay / abstain); derive adoption probability and a time band.
6. **Derive the system-level forecast** - diffusion speed, adopter concentration, first-mover-advantage duration, instability risk.

Place the innovation in the 2x2 typology: incumbent advantage (high FI / low OC), first-mover lock-in (high FI / high OC), rapid diffusion (low FI / low OC), or agile-actor empowerment (low FI / high OC - where dual-use, drone swarms, and agentic AI tend to land).

## Boundary (Canon Part 8)

The Brain supplies the generic theory only. The specific actors, scores, and forecast for THIS venture are room-local - file them in the room, never to the Brain.

## Output

File the forecast under `room/**/timing/`. End at a Decision Gate offering the natural next steps (Scenario Planning, Mullins 7-Domains, or the Triple Validation Compass per the ACE FEEDS_INTO chain).
