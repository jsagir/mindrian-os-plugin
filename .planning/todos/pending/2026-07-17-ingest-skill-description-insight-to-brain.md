---
created: 2026-07-17T00:00:00.000Z
title: Ingest the skill-description trigger-design insight into Brain
area: brain-ingestion
files:
  - docs/research/2026-07-17-skill-description-trigger-design.md
---

## Problem

Phase 230 (MindrianOS Skill Fleet Optimization) surfaced a generic, transferable
insight about writing agent-skill descriptions for reliable progressive-disclosure
triggering (four principles: WHAT+WHEN, near-miss differentiation, roster-wide
testing, held-out validation). The navigator explicitly asked for it to be filed in
the Brain teaching graph so future Larry sessions across all users benefit from it,
not just this repo.

Attempted live this session via `brain_write`/`brain_query` -- blocked. This
session's Brain MCP connection returned "Raw Cypher query access requires admin
key... Contact Jonathan for elevated access" on a read query; write access needs the
same tier. `brain_ask` was also tried and is the wrong tool for this (it routes
meta-questions like this one to the nearest PWS venture-methodology framework
instead of answering them -- it is a Socratic teaching dispatcher, not a graph-edit
interface).

The full insight content, plus a table proving all four principles are already
verbatim, load-bearing in the shipped Phase 230 rubric files (not just aspirational
prose), is staged and ready to ingest at
`docs/research/2026-07-17-skill-description-trigger-design.md`.

## Solution

From a session/key with Brain admin write access:
1. Read the staged content at the path above.
2. Decide the right node shape (candidates from the live schema: `Technique`,
   `CorePrinciple`, or `Heuristic` -- the schema already carries `principles`,
   `when_to_use`, `common_pitfalls`, `related_frameworks`, `industry_agnostic`
   property keys that fit this content well).
3. Relate it to the existing skill-creator / progressive-disclosure `prior_art`
   (T3) content already in the graph (surfaced via `brain_search` this session) --
   this insight extends that material with the two pieces it does not cover
   (roster-wide competitive testing, held-out-validation-gated revision).
4. Write via `brain_write`, verify with a follow-up `brain_search`/`brain_query`
   that the new node is retrievable, then move this todo to `.planning/todos/done/`
   (or `resolved/`, matching this repo's convention) with the resulting node id/name
   recorded.

Do not silently skip -- if the admin-key session never materializes, this stays
open and visible rather than the insight quietly never landing.
