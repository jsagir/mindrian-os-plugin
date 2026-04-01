---
name: pws-methodology
description: >
  PWS methodology framework routing and awareness. Relevant when discussing
  methodologies, frameworks, innovation tools, or when Larry needs to suggest
  the right analytical approach for a problem.
---

# PWS Methodology -- Framework Routing

## Brain-First, References-Fallback

Check for Brain MCP tools first. If `mcp__brain__suggest_methodology` exists, use Brain for framework suggestions -- it knows your room state and recommends contextually. If Brain is not connected, load `references/methodology/index.md` for the full command routing index.

## 26 Methodology Commands Available

All methodology commands follow the same pattern: thin command file + detailed reference file loaded on demand. Each command produces structured artifacts filed to the Data Room with user confirmation.

Full list with descriptions and venture stage routing: `references/methodology/index.md`.

## Framework Routing Rule

When Larry recognizes a problem type, he knows which methodology fits -- but he applies it through conversation, never by announcing it. The methodology index enables `/mos:help` to recommend relevant commands based on room state.

## Design-by-Analogy (DbA) -- Cross-Domain Discovery

When Larry detects a user is STUCK on a problem -- especially when they say things like "nobody has solved this", "this is unique to our domain", "I can't find examples" -- Larry should suggest the analogy engine:

**Detection signals for analogy suggestion:**
- Tensions (CONTRADICTS edges) between Sections with no resolution
- User expresses frustration with domain-specific dead ends
- Problem feels "novel" but is structurally common across domains
- Reverse salient detected between 2+ Sections

**Commands:**
- `/mos:find-analogies` -- Quick scan: reads Room, abstracts the problem, finds structural matches
- `/mos:find-analogies --brain` -- Deep: queries the 21K-node teaching graph for framework-level bridges
- `/mos:find-analogies --external` -- Broad: searches AskNature, patents, academic papers via Tavily
- `/mos:pipeline analogy` -- Full 5-stage pipeline: Decompose -> Abstract -> Search -> Transfer -> Validate

**Pipeline stages:** `pipelines/analogy/CHAIN.md`
**References:** `references/methodology/triz-matrix.json` (39 parameters), `references/methodology/triz-principles.md` (40 principles), `references/methodology/sapphire-encoding.md` (7-layer encoding)

**When to suggest (JTBD framing):**
"When you're stuck on a problem that feels unique to your domain, you want to discover that 3 other industries already solved it. `/mos:find-analogies` finds structural matches -- same problem shape, different domain. Takes 5 minutes."

## Parallel Power Commands

Larry should know these flags exist and suggest them when appropriate:
- `/mos:act --swarm` -- When 3+ Sections have Blind Spots
- `/mos:persona --parallel` -- When user needs multiple perspectives fast
- `/mos:grade --full` -- When 3+ Sections populated and user wants assessment
- `/mos:research --broad` -- When user needs multi-angle research
- `/mos:models` -- When user mentions cost or token usage

## Sentinel Intelligence

- `/mos:scout` -- When Room hasn't been health-checked recently or deadlines approach

## Tier 2 Lexicon — Load During Methodology Sessions

When running any methodology command, load the relevant section from `references/personality/pws-lexicon-full.md`. This gives Larry the exact PWS vocabulary with real teaching quotes for that framework.

- Running JTBD analysis? Load the "Jobs To Be Done" lexicon section.
- Running Bono Six Hats? Load the "Six Thinking Hats" section.
- Running TTA? Load the "Trending to the Absurd" section.
- Grading? Load "Part IV: Grading & Assessment."

The Tier 2 lexicon ensures Larry uses precise PWS terminology — not generic innovation buzzwords. Every term has Larry's actual voice from real classroom teaching.
