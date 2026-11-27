---
phase: 401
title: "Efficiency A: hygiene and cheap context cuts (the rest, after F1)"
canon_parts: [7, 8, 11]
status: CONTEXT; narrow EGM design (Elephant done, Goldfish next), then a thin /gsd-plan-phase
date: 2026-11-27
method: GSD frame with a NARROW EGM design step (401-405-WORKFLOW.md; 401-405-PROGRAM.md island 1.2)
measured_tree: work/405-desktop at 08c1633aa (plugin 2.0.0-beta.94)
---

# Phase 401 CONTEXT

## Purpose

Remove dead and repeated text from the plugin, and set size limits that keep it small.
This file covers the REST of Phase 401. The frontmatter split fix F1 is a separate small plan on branch `work/401-f1-frontmatter` (OR-14).

## Scope (six sweeps)

- (a) The unscoped tool name `mcp__mindrian-brain__` (115 tracked files).
- (b) Removal of `mcp-server-brain/` and its references (R4).
- (c) Strip of the repeated `$schema` key from the MCP tool list (4,332 B).
- (d) Repeated blocks (the firing block; relation to its generator and to the skill mirrors).
- (e) A description cap and a size test (relation to tests/test-270-tool-schema-budget.cjs).
- (f) The 6 expired commands.

## Not in scope

- F1 (frontmatter split test and fix). It has its own plan.
- Runtime changes (alwaysLoad, hook consolidation, card-fire, session-start cap): Phase 402.
- Agent merges and `omitClaudeMd`: Phase 403.
- Recipe rewrites of methodology commands: Phase 404.
- Any edit of the three Part 8 matcher strings: Phase 405 slice 10 owns the next edit.
- Nav-block trims (named in the ROADMAP title of 401): see owner item O7 in 401-DESIGN.md.

## Owner rulings (LOCKED: a reviewer may say that the design fails one, never that one is wrong)

- R4 (400.1-CONTEXT.md:17): delete the legacy `mcp-server-brain/` folder and every reference to it.
- "Brain = Theo" (400.1-CONTEXT.md:18): theo-mcp.onrender.com is the Brain. mindrian-brain.onrender.com and pws-brain-mcp are retired.
- Owner ruling 2026-11-18, quick 261118-q35 (project CLAUDE.md stack table; lib/core/brain-response-sanitize.cjs:144-147): "retired means blocked, not ignored". The literal `pws-brain-mcp` stays in the Part 8 inspection matchers.
- OR-9 (405-CONTEXT.md): order is the 405 foundation, then the overlapping parts of 401 and 402, then 404, then the 405 end slice. Parts of 401 that do not touch 405 files may run at any time (ROADMAP.md:4449).
- OR-14: F1 runs right after the beta.95 cut, before the 405 build.
- OR-21: the Shape F family is the one interaction contract. A shape change is made once, in the contract.
- O-12 of Phase 400 (tests/test-389-retire-brief.cjs:144-146): the stubs mva-brief and mva-report stay on the run-step list and keep their labels while they exist.
- D8 of Phase 389 (tests/test-389-retire-brief.cjs:5-7): `/mos:mva-brief` stays one release as a stub; a later plan removes it and writes the deprecation entry.
- Standing: Canon Part 8 (no room content to the Brain), Part 11 (every invocable surface is born wired with a declared shape), Part 7 (reuse before build).
- Project rules: no em-dash; no real names; every code change goes through a GSD plan with tests; no test is weakened to get green.

## Inputs

- .planning/phases/400.1-efficiency-research-verify-the-2026-11-24-efficiency-finding/400.1-RESEARCH.md (K6, F1, K9, section "Inputs for 401").
- .planning/research/2026-11-24-plugin-efficiency/00-SYNTHESIS.md (Phase A table) and 02-mos-surface-audit.md (section 6).
- .planning/phases/405-claude-desktop-chat-and-code/405-CONTEXT.md (OR-1 to OR-22), 401-405-PROGRAM.md (island 1.2; C5, C6, C14, C15, C20, C21, C22; matrix 2a), 401-405-E2E-PLAN.md, 405-DESIGN.md (sections 3.6, 3.10, 7, 8, 10).

## Interfaces to other work

- F1 (same phase, separate plan): every 401 slice that edits commands/, skills/ or agents/ starts after F1 is on main. F1 gives the test tests/test-401-frontmatter-split.cjs.
- Phase 405: slice 10 edits the three matcher strings and data/theo-tool-classes.json. Slices 2, 5a and 10 edit commands/rooms.md, setup.md, doctor.md and their mirrors. Slices 3, 13 and 14 move tests/test-270-tool-schema-budget.cjs. Slice 9 edits scripts/release.sh and both step-hash fixtures. Slice 12 writes the Shape F contract v2.
- Phase 402: it removes the server-level `alwaysLoad` key and adds per-tool `_meta` marks. It moves the same test-270 constant.
- Phase 404: it rewrites methodology commands as recipes. A name sweep now must stay mechanical and small.

## Output of this design step

- 401-RESEARCH.md: facts with file:line and counts from disk.
- 401-DESIGN.md: goals, non-goals, 7 slices with acceptance criteria and gates, keep-lists, file table, order against the 405 foundation, risks, owner items.
