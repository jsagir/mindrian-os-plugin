# EGM Stage 8: Intermediate Zoom Out - SEED-158

Target: `.planning/seeds/SEED-158-icm-routes-the-hooks.md` (unchanged since Stage 5). Reviewer: egm-zoom-out (fresh context) with the Stage 5, 6, 7 reports and the spike result `400.4-SPIKE-mcp-tool-hook.md`. Date: 2026-11-26.

## Verdict: RE-SCOPE
Retire per-nest routing (the seed's title and core). Keep only the transport slice, which the spike now supports.

## Surviving statement
Keep the single-dispatcher contract (fixed, ordered check list; parity with the six separate hooks). Split it into two adapters over one transport-independent run(input) core:
- Invariant tier, a command hook: admin-command-gate (must block) and first-install-router (must run before any room or server exists).
- Routable tier, one mcp_tool UserPromptSubmit hook into the already-running MindrianOS MCP server: brain-derivation-drain, auto-explore-drain, jtbd-update, intent-classifier. Removes the cold start per prompt and the cross-process room.db lock wait.
Every mcp_tool result uses the JSON hookSpecificOutput.additionalContext shape, pinned by a test. The routable tier has a stated fallback for a cold, busy or down server. Selection stays fixed and global; nests declare nothing; no new room-file format, no new selector. If a check later needs context, it guards itself in its own code over existing facts (bound room, ratified goal job, section-job canon).

## Findings
| # | Sev | Scope | Finding | Direction |
|---|---|---|---|---|
| S1 | Blocker (routing scope) | title, l.14-17, l.25 | YAGNI: no UserPromptSubmit check varies by nest; after 400.4 plans 12-14 and QA-F12 every cited defect is fixed without routing. | Retire routing. |
| S2 | Blocker (if any routing kept) | l.17, 29-32, 38 | A user-editable or shared room file deciding which checks run can switch off the admin gate (and, extended, the Part 8 egress and credential guards). "Add-only advisory" leaves the declaration nothing to decide. | Retire, do not mitigate. |
| S3 | Major (new, spike) | l.17, l.30 | The hook tool is registered on the MCP server, so the model can also see and call it: it is an invocable surface. Under Part 11 it must be born WIRED or EXCLUDED with a reason and counts against the tool budget. | Declare EXCLUDED with a reason in the connector registry; decide whether a direct model call is harmless; no second server just to hide it. |
| S4 | Major (new, spike) | l.17, l.28 | Cold connect measured about 3.2 s with the full installed setup, over the 2,500 ms dispatcher deadline, and a timeout is silent. The first prompt can drop the whole routable tier, including intent-classifier (the NAV block). | State first-prompt behavior: typed skip note, or run the routable checks in the command dispatcher until the server answers. No prewarm machinery until a test shows the loss matters. |
| S5 | Major | l.17 | node:sqlite is synchronous: a hook call queues behind a long in-flight tool call. | Reuse plan 13's per-check deadline and skipped_deadline inside the server handler; no queue or worker. |
| S6 | Major | whole seed vs 400.4 plan 13 | The slice is a transport change for a dispatcher whose contract is already locked; a separate seed means two documents own one decision. | Fold into the plan 13 revision (or a phase that supersedes it) and close the seed as superseded with a pointer. |
| S7 | Major | l.33 | suggest_next driver conflicts with QA-F12 decisions 2 and 6. | Drop. |
| S8 | Nit | Stage 5 I1, I4 | applies_when predicates and a precompiled per-session record are speculative (invalidation, staleness, doctor points) for checks that always run. | Revisit only when a concrete check needs it. |
| S9 | Nit | l.15, l.7 | Wrong count (6 UserPromptSubmit, 41 command entries) and scratchpad trigger; spike now filed. | Cite the spike file in the closing note. |

Risk: retiring the seed without moving S3-S5 into the executing plan would lose the only record of the Part 11 and first-prompt issues.

## Elephant reconciliation with the navigator's promotion (2026-11-26)
The navigator promoted SEED-158 to Phase 400.5 (critical path, before the next cut) while Stage 8 ran. Stage 8 supports a phase for the transport slice only, not per-nest routing, and drops the catalyst's predicate table and precompiled record. The Phase 400.5 roadmap entry (criteria 3 and 4) currently carries those two items; they need the navigator's call before planning.
