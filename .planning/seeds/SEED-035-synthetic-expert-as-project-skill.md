---
seed: SEED-035
slug: synthetic-expert-as-project-skill
title: SyntheticExpert -> per-project Claude Code skill (Larry-reach-suggested, /mos:skill front door)
status: ready  # PULLED FORWARD 2026-07-14 (navigator-directed): all 5 stated dependency phases (164, 167, 143, 148, 169) independently verified COMPLETE against ROADMAP.md during a full-corpus curation pass. Trigger has fired -- zero implementation work has started. Was "captured"; this is the cheapest real win in the current seed corpus, queue at next milestone/phase scoping.
created: 2026-06-19
captured_during: Phase 164 execution (after W1 / E1 SyntheticExpert amendment ratified)
disposition: fast-follow after Phase 164 (rides 164 SyntheticExpert node + 167 generator + the Larry-Reaches sensor spine)
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
related: [SEED-001 (proactive sub-room suggestions with wired creation), SEED-022 (icm-fractal-memory-contract), SEED-030 (rs-pipeline-spine-and-expert-graph-reconciliation), SEED-032 (harness-as-code)]
depends_on_shipped: [164 (SyntheticExpert node type, canon v1.13 entry 24), 167 (/mos:new-surface generator), 143/144/148 (Larry Reaches dial + sensors), 169 (fractal nesting / room-root resolver)]
---

# SEED-035: SyntheticExpert -> per-project skill (navigator-saved, Larry-reach-suggested)

## The arc (navigator vision, 2026-06-19)

`room/team/personas/*.md`
  -> (Phase 164 E1) a confirmed **SyntheticExpert** truth-claim NODE (queryable, re-invokable as a hat)
  -> (THIS SEED) a **per-project Claude Code skill** (`.claude/skills/<expert>/SKILL.md`) the navigator
     chooses to save, **usable across every part of the room** (not just inside a BONO run).

Same pattern as the rest of the system: a confirmed graph node MATERIALIZES into a usable artifact,
navigator-gated, room-local. The graph node is the source of truth; the skill is its projection.
164 makes a SyntheticExpert re-invokable only as a hat INSIDE a future BONO run; this seed makes it a
first-class skill invokable ANYWHERE in the room, by any command.

## The three sub-claims

1. **The front door: `/mos:skill` (skill-creation-as-a-skill).** A navigator-facing surface that writes a
   `.claude/skills/<name>/SKILL.md` from room context. GENERALIZES Phase 167's `/mos:new-surface`
   generator (which already emits connector-wired command/agent/skill surfaces with a `--check` proof)
   into a first-class "make this a skill" capability. The expert-as-skill case is the FIRST caller of
   `/mos:skill`, not a bespoke path. Part 7: rides the 167 generator, does not fork it.

2. **The trigger: Larry Reaches suggests it proactively.** Not only a manual navigator action. A SENSOR
   detects a reusable signal (an expert / pattern / methodology-chain that keeps getting re-invoked, or a
   high-value confirmed SyntheticExpert) and Larry REACHES: surfaces "Save Dr. X as a project skill?" at
   the Decision Gate (Part 3 / Shape F). The navigator APPROVES (Part 9 role 5 human-confirm); `/mos:skill`
   materializes it; the decision becomes a typed edge (Part 4).
   **CAUTION (frozen reach bank):** the reach bank is frozen at 6 (Phase 148, the 5->6 amendment). This
   suggestion should almost certainly ride as a SENSOR firing an EXISTING reach / an `offer_next_step`,
   NOT a minted 7th reach. Minting a 7th reach is a navigator-gated frozen-set amendment (mirroring entries
   18/21/22/23/24) and must NOT be assumed -- the implementing phase decides sensor-into-existing-reach
   (cheap, likely right) vs a constitutional reach amendment (expensive, needs explicit ratification).

3. **The artifact: room-scoped, every level of the fractal nest, Part-8 local.** The skill lives at the
   navigator-chosen room root and is reachable DOWN the fractal nest (Phase 169) -- a room-scoped expert
   skill is available to sub-rooms too. It is a LOCAL room artifact (per-project), NEVER egressed.
   Cross-ROOM expert/skill sharing stays the deferred Part-8-gated amendment 164 already flagged.

## Why fast-follow, not a 164 fold-in

Captured DURING 164 execution (after W1). Folding a new requirement into a running build is the
scope-change anti-pattern. This rides ON TOP of 164's confirmed SyntheticExpert node + 167's generator +
the Larry-Reaches sensor spine -- all of which want to be SHIPPED before this materialization rides on
them. Land 164 green first, then a focused phase.

## Acceptance sketch (for the implementing phase)
- `/mos:skill <name>` writes a conformant `.claude/skills/<name>/SKILL.md` from room context, room-scoped,
  with a `--check` proof (mirror build-connector-registry.cjs / 167 /mos:new-surface).
- A confirmed SyntheticExpert node can be materialized to a skill through `/mos:skill` (the first caller).
- Larry proactively suggests the materialization via a sensor -> Decision Gate (NO new reach minted unless
  navigator-ratified); the navigator APPROVE/REJECT-with-reason/DEFER becomes a typed edge.
- The materialized skill is reachable from sub-rooms (Phase 169 nesting); Part 8 boundary scan clean (LOCAL
  only, zero Brain egress); NO em-dashes.

## Open questions for the implementing phase
- Sensor design: which existing reach does the "make a skill" suggestion ride, and what is the reusable
  signal (re-invocation count? confirmed-expert tier? a methodology-chain frequency)?
- Skill scoping: room-root vs sub-room placement, and how the fractal-nest reachability is expressed.
- `/mos:skill` vs `/mos:new-surface`: is `/mos:skill` a thin navigator-facing wrapper over the 167
  generator, or a distinct surface? (Lean wrapper, Part 7.)

## Source set: which of the ~90 /mos commands can PRODUCE a SyntheticExpert (first-pass, 2026-06-19)

**Classification rule (the filter the Larry-reach sensor uses):** a command produces a SyntheticExpert
candidate IFF its output is a PERSPECTIVE-BEARING ROLE (a hat, a stakeholder, an SME lens, an evaluator).
A command whose output is a CLAIM or ANALYSIS (lean-canvas, mullins, scenario-plan, structure-argument,
validate) produces graph nodes but NOT experts. Role -> expert candidate; claim -> not.

| Tier | Surfaces | Why |
|------|----------|-----|
| Primary (the role IS the output) | /mos:persona, /mos:think-hats, /mos:hat-briefing, room_content generate-personas / invoke-persona / analyze-perspectives | instantiate hats/personas directly -> direct SyntheticExpert candidates |
| Strong (produce SME roles) | /mos:discover (client/stakeholder personas), /mos:leadership (the role shapes a team needs), /mos:challenge-assumptions (a Black-hat / Red-Team expert) | output is a named perspective-bearing role |
| Agent-form experts (already synthetic experts) | the agents themselves: mos:investor, mos:persona-analyst, mos:grading, mos:research, mos:reverse-salient-agent | these ARE experts in agent form -- the cleanest promotion source |
| NOT producers | lean-canvas, mullins, scenario-plan, structure-argument, validate, value-proposition, build-thesis, ... | output is a claim/analysis, not a role |

Net: the role-instantiating cluster (~8-10 commands) plus the 5 expert-shaped agents are the producer set.
Any of them can file a SyntheticExpert node (164) which /mos:skill (this seed) materializes into a project
skill. This source set + the role-vs-claim rule is what the proactive Larry-reach sensor (sub-claim 2)
keys on to decide WHEN to suggest "save this as an expert / skill."

**Verification deferred:** this is a first-pass classification from the command surface, NOT a per-command
file read. A follow-on fan-out (agent-per-cluster) should CONFIRM each producer + draft the SyntheticExpert
schema each emits (the hat / domain / sub-domain / archetype fields) before the implementing phase wires
them. Run it after Phase 164 lands (it depends on the SyntheticExpert node existing).
