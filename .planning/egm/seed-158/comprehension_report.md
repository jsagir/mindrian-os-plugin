# EGM Stage 6: Comprehension Test - SEED-158

Target: `.planning/seeds/SEED-158-icm-routes-the-hooks.md`, FeatureRange lines 1-38, DetailedRange N/A. Reviewer: egm-comprehension (fresh context, read the document alone). Date: 2026-11-26.

## What this proposes

Today one static file, `hooks/hooks.json`, sets the checks that run on every user prompt. It has 53 entries and starts six separate processes per prompt. The same checks run no matter which room, part of a room or job the session is in. The seed proposes one UserPromptSubmit hook in their place. If a planned spike shows that an `mcp_tool` hook's result reaches the model's context, the hook calls the MindrianOS MCP server, which is already running. If not, it uses a dispatcher from "plan 13".

The single hook works in three steps:
1. It finds the room the session is bound to and the active "nest".
2. It reads a small routing declaration for that nest, either in ROOM.md frontmatter or in BRIEF.md.
3. It runs only the check ids that the nest declares for its job.

A nest with no declaration gets today's six checks. Adding a check then means adding one line to a nest file and registering one check id, not adding a new process.

The stated reason is that the live QA run on 2026-11-26 found four defects. In each one, a component kept its own copy of state instead of using the room's state. Routing the hooks through the nest would make the room the one source of what runs.

## How the existing system works, per this document

Most of MindrianOS already routes through the room's "ICM layers": a local graph indexes the folders, "FeyMinto" writes one BRIEF.md per nest, and the "goal job" and "section-job canon" key on sections. Hooks are the exception: hard-coded globally, each re-reading the room in its own cold process, killed at a 3-second timeout under load. Other components keep global or mismatched state: a statusline file shared by all sessions; a navigation block built for the registry's active room instead of the session's room; two "job" concepts that are never compared.

Plan: the document has no implementation plan, consistent with its dormant status. It names a trigger (Phase 402 hook-consolidation planning, after the spike result), guardrails and three open questions, but no steps, sequence, files or acceptance criteria.

## Findings

| # | Sev | Scope | Finding |
|---|---|---|---|
| C1 | Major | "ICM", "ICM layers" (title, l.3, 12, 15) | Never spelled out or defined; the quoted Key Decision 2 is a pointer, not a definition. A reader cannot tell which layer a routing declaration belongs to. |
| C2 | Major | "room", "nest", "bound room", "active nest" (l.17) | Core nouns undefined. How the active nest is found per prompt is unstated; if it needs state outside the nest, it reintroduces the "own copy of state" problem. |
| C3 | Major | "its job", "goal job", "section-job canon", "two notions of job", "JTBD" | "Job" undefined; the seed names two conflicting notions and does not say which drives routing, so the reader cannot tell if it resolves or carries the defect. |
| C4 | Major | l.21-25 | Only the six-cold-processes defect follows from the hook design. How nest routing fixes the global cue file, the wrong-room NAV block and the two-job mismatch is not explained; "statusline cue", "NAVIGATION DECISION block", "the registry" undefined. |
| C5 | Major | "today's six checks" (l.14, 32) | The six checks are never named; "53 entries" vs "six processes per prompt" not reconciled; scope (UserPromptSubmit only or all 53) unclear. |
| C6 | Major | "plan 13 dispatcher", QA ids, "the spike" (l.7, 9, 17, 36) | Fallback is only a reference; no description of the dispatcher; no link to where the spike result is recorded. |
| C7 | Major | FeyMinto, BRIEF.md, ROOM.md (l.6, 15, 17, 37) | FeyMinto undefined; without knowing what regenerates BRIEF.md and when, open question 2 cannot be assessed. |
| C8 | Nit | check-id registry (l.17, 30) | Where the table lives, what an id points to, and how checks run without separate processes are unstated. |
| C9 | Major | canon_parts, "Part 8", "Part 11" (l.8, 30-31) | Parts cited with no summary; Parts 7 and 9 listed but unused in the body. |
| C10 | Major | "Tri-polar", Desktop, Cowork, suggest_next (l.33) | Undefined; the suggest_next use is a second, unexplained use of the declaration. |
| C11 | Nit | "icm-architect", "walk test" (l.9, 29, 37) | Made the decider for open question 2 but never described. |
| C12 | Nit | "QA-F6", "2.3M-char context pull" (l.28) | Lesson is clear inline; no link to the source finding. |
| C13 | Nit | "navigator", Phase 400.4, Phase 402 (l.6-9) | Who the navigator is and what the phases cover are unstated; minor for a seed. |

Reviewer summary: the shape is followable (one hook reading a per-folder declaration of which checks to run). Not followable: what a nest is and how it is found (C2, C3); why the proposal fixes three of the four cited defects (C4); what the default set and fallback are (C5, C6).

## Elephant note: paraphrase vs author intent
The paraphrase matches the seed as written. C4 independently confirms Stage 5 finding Z1: the evidence supports a room-key and job-scope fix (already in 400.4 F11/F12), not per-nest routing.
