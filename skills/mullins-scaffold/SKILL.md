---
name: mullins-scaffold
description: >
  Room scaffolding around the Mullins Seven Domains of Attractive Opportunities
  (Market, Industry, Sustainable Advantage, Mission/Aspirations, Ability to
  Execute on Critical Success Factors, Connectedness Up the Value Chain,
  Connectedness Down the Value Chain). Relevant when creating a new venture
  room, running an opportunity assessment, or structuring a Data Room around
  a market-attractiveness lens. Backed by skills/mullins-scaffold/scaffold.json
  (the section definitions and prompts).
---

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

## Relationship to other scaffolds

This is one of several room scaffolds; it is the market-attractiveness lens,
complementary to the PWS section structure (`skills/pws-methodology`). PWS organizes
a room around the venture-design pipeline; the Mullins scaffold organizes it around
the opportunity-attractiveness diagnostic. A room can carry both -- they answer
different questions.
