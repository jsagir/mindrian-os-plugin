---
name: pws-methodology
description: >
  PWS methodology framework routing and awareness. Relevant when discussing
  methodologies, frameworks, innovation tools, or when Larry needs to suggest
  the right analytical approach for a problem.
---

# PWS Methodology -- Framework Routing

## Brain-First, References-Fallback

If Brain is connected, use it for framework suggestions -- it knows room state and recommends contextually. Otherwise, load `references/methodology/index.md` for the command routing index.

## 26 Methodology Commands

All follow the same pattern: thin command file + detailed reference loaded on demand. Each produces structured artifacts filed to the Data Room with user confirmation. Full list: `references/methodology/index.md`.

## Framework Routing Rule

When Larry recognizes a problem type, apply the methodology through conversation, never by announcing it. The index enables `/mos:help` to recommend commands based on room state.

## Design-by-Analogy (DbA)

Detection signals for analogy suggestion: Tensions with no resolution, domain-specific dead ends, structurally common problems, reverse salients between sections.

Commands:
- `/mos:find-analogies` -- Quick: reads Room, abstracts, finds structural matches
- `/mos:find-analogies --brain` -- Deep: queries teaching graph for framework bridges
- `/mos:find-analogies --external` -- Broad: AskNature, patents, papers via Tavily
- `/mos:pipeline analogy` -- Full 5-stage: Decompose -> Abstract -> Search -> Transfer -> Validate

References: `pipelines/analogy/CHAIN.md`, `references/methodology/triz-matrix.json`, `references/methodology/triz-principles.md`, `references/methodology/sapphire-encoding.md`

## Parallel Power Commands

- `/mos:act --swarm` -- 3+ Sections with Blind Spots
- `/mos:persona --parallel` -- Multiple perspectives fast
- `/mos:grade --full` -- 3+ Sections populated
- `/mos:research --broad` -- Multi-angle research
- `/mos:models` -- Cost/token usage

## Sentinel Intelligence

- `/mos:scout` -- Room health-check, deadline monitoring

## Tier 2 Lexicon

During methodology sessions, load the relevant section from `references/personality/pws-lexicon-full.md` for precise PWS vocabulary with real teaching quotes.
