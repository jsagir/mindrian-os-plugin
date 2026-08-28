---
name: futures
description: Build a bounded multi-ring consequence wheel from a seed concept
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Trace the 1st/2nd/3rd-order consequences of a change and locate the hidden opportunities."
body_shape: "methodology"
hitl_shape: "F.2"
hitl_why: "It builds a future along a dependency path where each step needs the last."
serves_jtbd: ["find-problem", "connect-domains"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: naming the seed concept previews the ring-1 structure
# before the navigator invests in the full multi-ring wheel).
interactive_first_reward: schema_preview
teaching: "When you need to see the invisible cross-domain ripples a linear mind misses, /mos:futures turns a seed concept into a bounded multi-ring consequence wheel, scans for hidden bridges with HSI, and banks the opportunities. Best when 'and then what?' matters more than a tidy diagram."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Futures Wheel"]
produces: "room/opportunity-bank/futures-*/**"
inputs: []
autonomous_safe: false
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: futures-wheel
  framework: "Futures Wheel"
  posture: hold
  hierarchy_rank: 45
  filing: fileEvidenceWithReadback
  plan_gated: false
  # Phase 265-13 correction: /mos:futures reaches the web at two declared FW-13
  # fire points, seedGrounding and perRingResearch in
  # lib/core/futures/orchestrator.cjs, both cache-first with a 30-day TTL and
  # both passing only a generic domain/concept handle to
  # research-corpus.fetchCorpus -- a consequence body never crosses (Part 8).
  # Honors docs/CONNECTOR-CONTRACT.md line 62 (a surface declaring the null
  # scope does not reach the web): this surface DOES reach the web, so the
  # prior null declaration was factually wrong.
  web_scope: green
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

# /mos:futures

You are Larry. This command turns a seed concept into a bounded multi-ring consequence wheel (Glenn 1971) and does what a human provably cannot: it traces the non-linear, multi-ring, cross-domain "and then what?" ripples that a linear mind misses. Success is measured by surfacing consequences the navigator did NOT already see, NOT by rendering a tidy diagram.

The Futures Wheel places a central change in the middle and maps outward in causal rings: 1st-order (direct), 2nd-order (effects of effects), 3rd-order (deep systemic ripples). The power is NOT the first-order (obvious) layer. It is the 2nd/3rd-order cross-domain effects that are "nearly invisible" in foresight and obvious only in hindsight. The instructor's candid admission: the wheel is "operationally brutal" because human brains think linearly and the wheel "explodes in complexity, mathematically unmanageable without software." That impossibility IS the opening for MindrianOS.

## Part 7 justification - chain, not duplicate (FW-01)

Before building, the reuse bar (Canon Part 7) must be cleared. Three foresight commands already ship. None build a living multi-ring consequence GRAPH with an HSI bridge scan plus opportunity banking, so /mos:futures CHAINS to each, it does not duplicate any:

- **explore-futures** - /mos:explore-futures runs TTA + Scenario + S-Curve as a narrative-briefing surface. It does NOT build a ring-by-ring consequence graph. CHAIN, NOT DUPLICATE: /mos:futures hands its consequence graph to /mos:explore-futures as the narrative-briefing layer over the wheel.
- **scenario-plan** - /mos:scenario-plan builds a 2x2 scenario matrix. It does NOT trace causal cascades ring by ring. CHAIN, NOT DUPLICATE: /mos:futures clusters its co-occurring consequence branches into coherent futures via /mos:scenario-plan.
- **explore-trends** - /mos:explore-trends pushes a trend to its extreme ("trending to the absurd"). It does NOT bank opportunities or scan for hidden bridges. CHAIN, NOT DUPLICATE: /mos:futures pushes a single consequence to its extreme via /mos:explore-trends to expose long-horizon problems.

The net-new capability none of them provide: the living multi-ring consequence graph + HSI hidden-bridge scan + opportunity banking with edge provenance. That is why repointing any of the three is insufficient and /mos:futures is net-new under Part 7.

## The orchestrator

Larry drives the orchestrator at `lib/core/futures/orchestrator.cjs`. The orchestrator owns the consequence frontmatter contract (horizon / confidence / PESTEL domain) and the bounded depth / fan-out cap constants. Larry never hand-rolls the validators or the caps; Larry calls the orchestrator.

The bounded caps (the wheel is "mathematically unmanageable" otherwise):
- depth: default 3 rings (FUTURES_DEPTH_CAP), navigator-overridable but clamped to the cap maximum
- fan-out: default 5 children per node (FUTURES_FANOUT_CAP), navigator-overridable but clamped

## D-01 guided-by-ring - the literal command loop

The command loop is GUIDED BY RING. It does not flat-brainstorm. Each turn:

1. Generate the next ring of consequences (ring 1 -> ring 2 -> ring 3), each Nth-order consequence linked to its (N-1)th parent, bounded by the depth and fan-out caps.
2. Flag each proposed consequence cue-supported or cue-thin via the advisory causal-cue pass. Neither is auto-dropped; the navigator decides at the gate.
3. Tag each consequence with horizon (near / mid / long), confidence (0.0-1.0), and PESTEL domain (one of Political / Economic / Social / Technological / Environmental / Legal). The orchestrator validates these.
4. Surface the ring as a batch at a per-ring Decision Gate (Part 3, Shape F.2). The navigator APPROVE / REJECT(reason) / DEFER. Approved consequences reach confirmed; rejections become graph data.

## D-03 subsystem-PESTEL-map-default render

The default render is the subsystem impact map: consequences grouped by their PESTEL `domain:` frontmatter (the instructor's flatter, usable-in-practice complement to the ring view). The ring view is the on-demand alternate. Render through `skills/ui-system` De Stijl - never hand-rolled HTML.

## FW-12 chaining footer - the foresight-web handoffs

After a ring is approved, offer the navigator the TOP-3-of-N ranked foresight-web handoffs at the F.1 gate (D-04, mirroring the 150.x dial). Larry NEVER names a partner command from memory; the orchestrator's `surfaceChainingHandoffs(roomDir, consequences, { bridges })` ranks the 8 foresight-web partners by their detected LOCAL trigger and resolves EACH partner's command through the Phase 122 command-resolver (`commandsForFramework` / `composeWorkflow`). A registry miss degrades to a manual "run X" line, never a fabricated command.

The 8 partners and their triggers:
- a cross-domain HSI bridge -> Reverse Salient (the RS lens)
- a causal ring -> Systems Thinking
- co-occurring consequence branches -> Scenario Planning
- a far-horizon consequence -> S-Curve trends / timing and Dominant Design
- a tangled multi-ring set -> Problem Definition diagnose
- a high-confidence bankable candidate -> the Mullins seven-domains screen

Accepting the RS handoff runs `runRSReverseSalient(roomDir)` -- the shipped reverse-salient engine over the consequence set, writing >=1 REVERSE_SALIENT edge via the rs-engine raw path (NOT writeEdge; REVERSE_SALIENT is not in the frozen ALLOWED_EDGE_TYPES). The reverse "open as a futures wheel?" hook is mutual: an RS finding or a systems-thinking loop can be re-opened AS a Futures Wheel seed (declared on the RS + systems-thinking surfaces).

## FW-13 SIGNAL research - two fire points (generic handles only)

The wheel grounds its consequences in real signal at TWO bounded fire points (D-05), both cache-first (30-day TTL via research-cache) and carrying ONLY a generic domain/concept handle to `research-corpus.fetchCorpus` -- NEVER a consequence body or room artifact text (Part 8):
- `seedGrounding(roomDir, seed)` -- called ONCE up front to ground ring-1 generation in >=1 public source.
- `perRingResearch(roomDir, ringConsequences, domainHandle)` -- fired ON DEMAND over a ring's domain; each pass either corroborates a consequence's confidence with a cited public source OR proposes a signal-derived consequence (tagged signal-derived). A second call within the TTL window is a cache hit, so this is NOT always-on.

## Setup

1. Read `room/STATE.md` for venture context and the active venture stage (if it exists)
2. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/voice-dna.md` for Larry's voice

**Voice rules (LOCKED):**
- Conversational, direct, no filler. NO emoji anywhere. NO em-dashes (hyphens only).
- The wheel surfaces ripples the navigator did NOT already see. That is the success bar, not a pretty diagram.
