# JTBD x Problem Type x Framework Map

Date: 2026-10-06. Status: working map, not a ruling. Author: Larry, from the navigator's request.

## Sources and limits

- **Local:** `commands/*.md` frontmatter (`serves_jtbd`, `frameworks`), `lib/hmi/jtbd-taxonomy.json` (13 jobs), `lib/core/problem-type-router.cjs` (UDP, IDP, WDP, Wicked skill lists).
- **Theo-context:** `problem_lenses` and `framework_route` (max_steps 6), one call per problem type on 2026-10-06. Only the four generic type names were sent (Canon Part 8). Theo-context is an experiment; `theo-mcp` stays the default origin (ruling 2026-10-05).
- **Limit 1:** the taxonomy has no `problem_type` field and no "When I... I want..." statement. The statement column below is the taxonomy one-liner. The problem-type column is an inference.
- **Limit 2:** Theo's route is ranked by edge rank, then stored pagerank, then live degree, then name. It reports what the graph connects most, not a teaching sequence. Each route reported partial coverage (1 of 4 types matched).
- **Scope:** `commands/` has 114 files. 50 declare `frameworks` and `serves_jtbd`; this map covers those 50.

## 1. Local version: the 13 jobs

| JTBD | Statement | Problem type (inference) | Framework commands |
|---|---|---|---|
| `explore` | No specific job, general thinking | UnDefined | `discover` `beautiful-question` `explore-domains` `explore-futures` `explore-trends` `trending-to-absurd` `research` `build-knowledge` `leadership` `mos-reason` `structure-argument` `think-hats` `bono` |
| `find-problem` | Find the root problem, not the symptom | UnDefined, then IllDefined | `analyze-needs` `user-needs` `beautiful-question` `root-cause` `causal` `explore-domains` `futures` `whitespace` |
| `connect-domains` | What does this look like in another field? | UnDefined, then IllDefined | `find-analogies` `find-connections` `rs-experts` `futures` `whitespace` |
| `understand-market` | Market size, structure, dynamics | IllDefined | `analyze-timing` `diffusion` `dominant-designs` `macro-trends` `mullins` `explore-trends` `trending-to-absurd` `research` `explore-domains` |
| `find-bottleneck` | Find the lagging component blocking progress | IllDefined, Wicked when systemic | `analyze-systems` `systems-thinking` `find-bottlenecks` `rs-fetch` `rs-explain` `rs-thesis` `rs-experts` `scientific-roadmap` `causal` |
| `surface-contradiction` | Resolve internal contradictions in the room | Wicked | `challenge-assumptions` `rs-fetch` |
| `validate-idea` | Test whether a claim holds up | WellDefined | `validate` `challenge-assumptions` `map-unknowns` `structure-argument` `lean-canvas` `value-proposition` `scientific-roadmap` `score-innovation` |
| `decide-pursue` | Is this worth pursuing? | WellDefined once framed | `diagnose` `build-thesis` `bono` |
| `compare-options` | Choose between A, B, C | WellDefined | `compare-ventures` `deep-grade` `scenario-plan` `explore-futures` `score-innovation` `think-hats` |
| `prepare-pitch` | Prepare for an investor or partner meeting | WellDefined | `build-thesis` `lean-canvas` `value-proposition` `hat-briefing` `persona` |
| `plan-execution` | Plan the next 90 days | WellDefined | `scenario-plan` |
| `audit-room` | Audit room health, gaps, drift | WellDefined | `jtbd` `grade` `deep-grade` `diagnostics` |
| `file-meeting` | Capture meeting intelligence | none | no framework command |

## 2. Theo-context version: frameworks per problem type

| Problem type | Theo's ranked frameworks |
|---|---|
| UnDefined | Trending to the Absurd, Scenario Planning, Systems Thinking, Red Teaming, Structured Trend Extrapolation Process, Futures Wheel |
| IllDefined | Four Lenses of Innovation, Cross-Disciplinary Thinking, Jobs to Be Done, Process Mapping, Beautiful Question Framework, S-Curve Analysis |
| WellDefined | MECE, The Pyramid Principle, Root Cause Analysis, 80/20 Rule, Scientific Roadmapping, Issue Trees |
| Wicked | Cynefin Framework, Systems Thinking, Causal Loop Diagrams, Stock and Flow Diagrams, 12 Leverage Points, Systems Mapping Framework |

## 3. Consolidation (Larry)

The local router and Theo almost never agree. They answer different questions. Local asks what to run next. Theo asks what lens fits this type of problem.

| Type | Local router (`problem-type-router.cjs`) | Theo's lens | Overlap | Local command for Theo's pick | No local command |
|---|---|---|---|---|---|
| UnDefined | explore-domains, beautiful-question, whitespace, find-analogies, find-connections | Futures and stress test | none | `trending-to-absurd` `scenario-plan` `systems-thinking` `challenge-assumptions` `futures` | Structured Trend Extrapolation |
| IllDefined | beautiful-question, structure-argument, mullins, lean-canvas, map-unknowns | Analogy and need | `beautiful-question` only | `find-analogies` `analyze-needs` `analyze-timing` | Process Mapping. Cross-Disciplinary Thinking has only a closest match, `find-connections`. |
| WellDefined | grade, deep-grade, score-innovation, build-thesis, challenge-assumptions | Decompose and structure | none | `structure-argument` `mos-reason` `root-cause` `scientific-roadmap` | 80/20 Rule, Issue Trees |
| Wicked | challenge-assumptions, find-bottlenecks, scenario-plan, explore-futures | Systems modeling | none | `systems-thinking` `analyze-systems` | Cynefin, Causal Loop Diagrams, Stock and Flow, 12 Leverage Points, Systems Mapping |

Findings:

1. **WellDefined has no structuring step before grading.** The local list grades and defends. Theo's list decomposes first (MECE, Issue Trees). The local list grades something that was never cut into parts.
2. **Wicked is the biggest hole.** Theo's answer is systems modeling. Locally only `systems-thinking` and `analyze-systems` cover it. Five Theo frameworks have no command. Theo-context also reports Wicked as 1 reachable chapter against 5 for IllDefined.
3. **Nine Theo picks have no local command:** Structured Trend Extrapolation, Process Mapping, 80/20 Rule, Issue Trees, Cynefin, Causal Loop Diagrams, Stock and Flow, 12 Leverage Points, Systems Mapping. One more (Cross-Disciplinary Thinking) has only a closest match.

Proposed order of use, a hypothesis to test and not a ruling:

1. Theo's lens first, to frame the problem.
2. The local command next, to produce the artifact.
3. The local grade or challenge command last, to test it.

## Open items

- Run the nine gaps through the Canon Part 7 reuse-before-build check before any new command is proposed.
- Add a `problem_type` field to `lib/hmi/jtbd-taxonomy.json` only after the navigator rules on the inference in section 1.
- Re-run the Theo routes when `theo-mcp` can answer the same four calls, so the second opinion is not single-origin.
