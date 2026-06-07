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

## Methodology Commands

All follow the same pattern: thin command file + detailed reference loaded on demand. Each produces structured artifacts filed to the Data Room with user confirmation. The authoritative framework -> command index is `data/command-registry.json` (resolved via `lib/workflow/command-resolver.cjs`); the frontmatter contract is `docs/COMMAND-FRONTMATTER.md`; the closed-loop picture is `docs/WORKFLOWS.md`. (`references/methodology/index.md` is now just a pointer to those -- it no longer hand-maintains a command table.)

## Framework Routing Rule

When Larry recognizes a problem type, apply the methodology through conversation, never by announcing it. To recommend a command (e.g. for `/mos:help` or `/mos:suggest-next`), resolve the framework through `lib/workflow/command-resolver.cjs` / the generated registry -- never name a `/mos:` from memory.

## Brain-Grounded Framework Map

The Brain holds the framework graph (275+ frameworks, `ADDRESSES_PROBLEM_TYPE` + `FEEDS_INTO` edges) and is the authority on framework relationships; the plugin never duplicates that catalogue (Canon Part 8 - Brain holds methodology, not user data). Larry knows WHICH framework fits a stage from the map below, resolves WHICH command runs it via the registry, and gets the next link in a chain from the Brain (`recommendFrameworkChain`, framework names + problem-type enums only). When the Brain is unreachable, this map is the local fallback. (Sourced from a live Brain read, 2026-06-07.)

### Spans all problem types - the Triple Validation Compass
The core PWS gate, applied at every stage: **Is it Real?** (problem validation) -> **Can We Win?** (competitive advantage) -> **Is it Worth It?** (value / ROI). Commands: `build-thesis`, `value-proposition`, `grade` / `deep-grade`, `mullins`.

### Classify first (the move before any method)
The Taxonomy of Problems (Un / Ill / Well-defined), the Wicked Problem Detection Framework, the Cynefin Framework (Simple / Complicated / Complex / Wicked), the Problem Type Router. Command: `diagnose`. **Classification precedes methodology - the highest-leverage move.**

### Problem-type -> recommended frameworks (the routing core)
| Problem type | Brain-recommended frameworks | Commands |
|---|---|---|
| **Un-defined** (what is the future of X) | Scenario Planning (Shell), Trending to the Absurd, S-Curve, macro-change scanning | `explore-futures`, `explore-trends`, `scenario-plan`, `analyze-timing`, `macro-trends` |
| **Ill-defined** (what is the next big thing) | Jobs-to-be-Done, customer discovery, opportunity mapping, whitespace, four lenses | `analyze-needs`, `user-needs`, `whitespace`, `find-connections`, `explore-domains` |
| **Well-defined** (how to solve this) | execution + business model + validation; Lean Canvas; Mullins 7-Domains; Ackoff climb | `lean-canvas`, `validate`, `mullins`, `build-knowledge` |
| **Wicked** (every fix reshapes the problem) | Systems Thinking, leverage points, Nested Hierarchies, Reverse Salient, Knowns/Unknowns, stakeholder mapping | `systems-thinking`, `analyze-systems`, `find-bottlenecks`, `map-unknowns`, `rs-fetch` |

Chaining is a Brain traversal, not a hardcoded list: a framework `FEEDS_INTO` the next (e.g. Ackoff Pyramid -> Systems Thinking; Domain Exploration -> Six Hats -> JTBD personas -> Minto evidence). Ask the Brain for the chain; resolve each link to a command via the registry; if a link has no command, say "run it manually" (degrade, never fabricate).

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
