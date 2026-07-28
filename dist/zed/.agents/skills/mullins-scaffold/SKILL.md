---
name: mullins-scaffold
description: >
  Room scaffolding around the Mullins Seven Domains of Attractive Opportunities
  (Market, Industry, Sustainable Advantage, Mission/Aspirations, Ability to
  Execute on Critical Success Factors, Connectedness Up the Value Chain,
  Connectedness Down the Value Chain). Use ONLY when the navigator explicitly
  asks to scaffold a room around the Mullins Seven Domains, names Mullins or
  the Seven Domains directly, or ignite's own front door has resolved toward
  a market-attractiveness structure. Do NOT use for a general "let's assess
  this opportunity" remark with no Mullins-specific ask -- that stays in
  conversation (or routes through /mos:ignite's front door). Backed by
  skills/mullins-scaffold/scaffold.json (the section definitions and prompts).
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: brain_consult
  sub_mode: mullins-scaffold
  posture: hold
  hierarchy_rank: 13
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
hitl_shape: "F.1"
hitl_why: "Each of the seven domain folders is offered at an F.1 Decision Gate before creation, never auto-imposed on the room."
---

<!-- mos:firing-block v2 -->
At this skill's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this skill's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# Mullins Scaffold -- Seven Domains of Attractive Opportunities

## What this scaffold is

This scaffold structures a venture room around John Mullins's Seven Domains of
Attractive Opportunities, the diagnostic at the heart of "The New Business Road
Test." The seven domains split into two axes -- market and industry attractiveness
(macro and micro) on one side, and the team plus its connectedness up and down
the value chain on the other. Each domain asks a focused question: how large is
the market today and in five years, how attractive is the industry on Porter's
five forces, what beachhead segment will the venture win first, what mission and
risk appetite the founding team carries, which critical success factors must go
right, and which value-chain relationships unlock the venture. Used as a Data Room
skeleton at the early or opportunity stage, the seven domains give the navigator a
near-decomposable structure: each domain is a subsystem with strong internal
cohesion and weak coupling to the others, so a finding in "Industry Dynamics" can
be filed without disturbing "Team Mission." Generated from Mullins Seven Domains
(Phase 84-04, v1.10.8).

## The data file

The canonical section list lives in `skills/mullins-scaffold/scaffold.json`. That
file carries `version`, `generated_from`, and a `sections[]` array. Each section
has `id`, `domain`, `title`, `prompt`, and `required`. Room-scaffolding code (and
`/mos:scaffold`-style flows) reads this JSON to build the folder skeleton -- one
folder per section, each with its ROOM.md identity file and the section prompt as
the opening question. The JSON is the source of truth; this SKILL.md is the human
and agent-facing index that points at it. When the domain list changes, edit the
JSON; this index describes the shape, not the contents.

## When Larry should reach for this

- A navigator is creating a new venture room and has no structure yet.
- An opportunity-bank deep-dive needs to assess a banked opportunity against the
  same seven axes a venture would be tested on.
- A market-attractiveness review is requested (Porter five forces, market sizing,
  beachhead segment selection) and the room lacks a place to file it.
- Two ventures need to be compared on the same axes -- the seven domains give a
  shared coordinate system.
- A team-readiness check is needed (mission, aspirations, propensity for risk,
  critical success factors).

## Brain-driven cross-framework folders (additive)

Beyond the seven fixed Mullins domains, the scaffold proposes a small set of
complementary folders drawn from the frameworks Mullins FEEDS_INTO. These live in
`scaffold.json` under `brain_folders[]` and today number three: Value Proposition
(the precise value the offering delivers to the beachhead segment), Disruptive vs
Sustaining Posture (whether the venture sustains an incumbent trajectory or
disrupts from a new-market or low-end foothold), and Systems Map (the feedback
loops, stocks, and leverage points that govern the venture as a nested system).
Each folder carries its source framework name, a domain label, an opening prompt,
the literal `feeds_into_source` origin "Mullins Seven Domains", and `offered: true`.

These folders are OFFERED at a Decision Gate, never auto-imposed. The navigator
approves which frameworks' folders to add (per Canon Part 3, GUIDED default); the
`offered: true` flag tells consumers to route the proposal through that gate rather
than materializing the folder silently. The Brain supplies only the framework names
and domain labels for the proposal -- generic methodology handles, never user
artifacts, meetings, decisions, or content (Canon Part 8). The Part-8-clean query
that asks the Brain for these neighbors carries only the framework handle "Mullins
Seven Domains" plus a problem-type enum; see `buildBrainFolderQuery` in
`lib/core/mullins-scaffold.cjs`.

## Ackoff bidirectional traversal

The scaffold also renders the Ackoff DIKW traversal that structures how the seven
domains fill and validate. It lives in `scaffold.json` under `ackoff_traversal`,
with `ascent[]`, `descent[]`, a `brain_chain` (Systems Thinking, MAP THE HIERARCHY),
and a `validation_center` ("Validation"). The ASCENT fills the domains toward
Validation-at-center: Data in the domain folders rises through Information and
Knowledge to Wisdom (a validated decision) at the center. The DESCENT is the New
Business Road Test validation loop: Validation decomposes back down to re-test each
domain's connections, structure, and underlying data and assumptions.

This is additive doctrine, not a new one. The ascent/descent labels reuse the
"bidirectional Ackoff ascent" already carried in `skills/larry-personality`: the
ascent earns evidence up the levels (push_forward when Validation holds), and the
descent re-tests assumptions (pull_back when a gap surfaces). The traversal here
does not contradict that doctrine -- it renders it as scaffold structure.

## Relationship to other scaffolds

This is one of several room scaffolds; it is the market-attractiveness lens,
complementary to the PWS section structure (`skills/pws-methodology`). PWS organizes
a room around the venture-design pipeline; the Mullins scaffold organizes it around
the opportunity-attractiveness diagnostic. A room can carry both -- they answer
different questions.
