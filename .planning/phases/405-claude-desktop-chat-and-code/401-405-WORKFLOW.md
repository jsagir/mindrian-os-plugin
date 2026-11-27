---
kind: workflow
scope: Phases 401 to 405
date: 2026-11-27
owner_rulings: "405-CONTEXT.md OR-2, OR-9 (order), PA-1 (367 first); project CLAUDE.md 'GSD with EGM' (2026-11-25)"
---

# Workflow for Phases 401 to 405

## The method, per phase

1. **CONTEXT**: owner need and rulings, locked.
2. **EGM design**: one deep-context agent writes RESEARCH and DESIGN from the code; fresh reviewers check it; every Blocker and Major gets one outcome (fixed, cut, contested, owner). Done when a review round is clean. This replaces GSD research and discuss.
3. **Thin `/gsd-plan-phase`**: the planner reads the reviewed design and writes one plan per slice (tasks, files, check commands, commit points, owner checkpoints); the plan checker reviews. No new design decisions.
4. **`/gsd-execute-phase`**, then verify and owner sign-off.

A phase that changes one surface and does not touch Part 8, 9 or 11 may skip step 2 (401 and 403 are candidates; decide at their CONTEXT).

## Who gets what

| User | Gets | From |
|---|---|---|
| Terminal (Claude Code CLI) | never blocked; lighter and faster; cleaner commands | 401, 402, 404 |
| Desktop Code tab | recognised as full Claude Code (hooks, room, cards) | 405 slice 1 |
| Desktop chat | one-click install, safe room tools, receipts, click-proof yes, Theo cards; then /mos commands | 405 foundation; 404 + 405 end slice |
| Web, phone, cloud threads | honest "no room here" plus Theo cards | 405 slices 2 and 10 |

## Order (OR-9)

| Step | Work | Gate before it starts |
|---|---|---|
| 0 | beta.95 cut (jsagi-42); main frozen | "CUT DONE" |
| 1 | 405 EGM design to a clean round | now |
| 2 | 405 slice 0: plan and run the spikes (owner on Desktop, about 20 min) | step 1 |
| 3 | 367 plans 11 and 12 reach origin/main (jsagi-42); plans 13 and 14 follow | next beta |
| 4 | 405 foundation: re-plan build slices from spike verdicts, then build (surface truth, refusal, receipts, click-proof gate, .mcpb, Theo cards, release) | steps 2 and 3 |
| 5 | 401 and 402, the parts that overlap 405 first (alwaysLoad and deferral, shared includes, description cap) | step 4 foundation merged |
| 6 | 404 recipes, with Desktop chat as a named target | step 5 |
| 7 | 405 end slice: /mos commands work in chat | step 6 |
| any time | 403 (isolated lens agents): no chat dependency | its own CONTEXT |

## Rules

- No build on 405 before 367-11 and 367-12 are on origin/main (PA-1).
- A spike verdict that would drop or change the .mcpb goes back to the owner (OR-6).
- A commit on main is not live until released; the website hand-off (405-WEBSITE-HANDOFF.md) goes out after the cut that ships 405.
- Record agent runs, tokens and findings per phase in its SUMMARY (EGM cost check).
