---
phase: 371
status: approved
reviewed_at: 2026-10-19
review_method: inline gsd-ui-checker rubric
canon_parts: [3, 7, 8, 9, 11, 12]
---

# Phase 371 - UI-SPEC verification

The primary agent performed the UI research and then a separate review pass
using the six gsd-ui-checker dimensions. No independent subagent review was run.
Inputs: 371-UI-SPEC.md, 371-CONTEXT.md, current startup tools and rendering code,
and the current external Design Canon v5. No phase RESEARCH.md exists yet;
the existing HTML/CSS/MCP stack is identified from the source itself.

| Dimension | Verdict | Evidence |
|---|---|---|
| 1 Copywriting | PASS | Specific CTAs; separate empty, missing-history, failure and uncertain-outcome copy; solution paths; no destructive action in scope |
| 2 Visuals | PASS | Explicit focal order, structural room picture and legend, open human gate, semantic planes, no icon-only control; narrow and wide compositions defined |
| 3 Color | PASS | Explicit 60/30/10 target; ink action budget; role colors restricted to evidence/assumption/contradiction; selection and errors never borrow those roles |
| 4 Typography | PASS | Exactly four sizes (14/16/24/32), two weights (400/700), body and heading line heights, v5 families and local delivery/fallback |
| 5 Spacing | PASS | Only 4/8/16/24/32/48/64 for layout; stroke widths distinguished from spacing; no unexplained exceptions |
| 6 Registry Safety | PASS | Manual native HTML/CSS system declared; no shadcn or third-party component registry; no new script origin |

**Status: APPROVED - 6/6 dimensions pass.** No blocking findings or outstanding
non-blocking flags in the contract. Its defaults are marked separately from
user decisions and the external brand rulings.

This approves a design contract, not implementation or live host acceptance.
The current room UI still requires the visual and recovery changes listed under
Implementation Delta. Planning must retain the real gate/session tests, add
accessibility and narrow-panel checks, verify font/CSP delivery, and leave the
live ChatGPT host check explicit until actually performed.

The phase remains unplanned. No new execution surface, room schema, autonomous
Theo workflow or guarantee of a persistent host side panel is introduced.
