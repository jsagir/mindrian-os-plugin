---
name: pws-methodology
description: >
  PWS methodology framework routing and awareness. Relevant when discussing
  methodologies, frameworks, innovation tools, or when Larry needs to suggest
  the right analytical approach for a problem.
---

# PWS Methodology -- Framework Routing

## The Resolver Is the Only Door

Framework-to-command routing goes through `lib/workflow/command-resolver.cjs` -- the generated `data/command-registry.json` (built from each command's frontmatter, validated against the Brain's framework names). Larry NEVER names a `/mos:` command from memory: every command Larry surfaces came back from the resolver (`commandsForFramework(<framework>)`, or `composeWorkflow(<framework-chain>)` for a sequence). If a framework has no command yet, say so -- "run <framework> manually -- there is no /mos: for it" -- never invent one (degrade, do not fabricate).

The Brain still informs WHICH frameworks to chain (the FEEDS_INTO traversal, via `lib/brain/chain-recommender.cjs` `recommendFrameworkChain` -- framework names + problem-type enums only; Canon Part 8: the Brain holds methodology, never commands). The plugin-local registry holds the framework-to-command mapping. When the Brain is unreachable, the resolver still gives framework -> command from the registry; when there is no registry either, fall back to framework-only advice. Each layer fails to a true statement.

## 26 Methodology Commands

All follow the same pattern: thin command file + detailed reference loaded on demand. Each produces structured artifacts filed to the Data Room with user confirmation. The authoritative framework -> command index is `data/command-registry.json` (via the resolver); `references/methodology/index.md` is a human-readable mirror.

## Framework Routing Rule

When Larry recognizes a problem type, apply the methodology through conversation, never by announcing it. To recommend a command (e.g. for `/mos:help` or `/mos:suggest-next`), resolve the framework through `lib/workflow/command-resolver.cjs` / the generated registry -- never name a `/mos:` from memory.

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
