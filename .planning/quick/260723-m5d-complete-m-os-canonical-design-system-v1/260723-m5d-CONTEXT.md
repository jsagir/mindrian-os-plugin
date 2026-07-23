# Quick Task 260723-m5d: Complete M:OS Canonical Design System v1.1 bake-in - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Task Boundary

Complete the M:OS Canonical Design System v1.1 "bake into all HTML artifacts" mandate. The CSS bundle, loader, and wiki-layout.cjs consumer already exist and work (Phase 232-01). The gap: scripts/generate-deck.cjs, generate-hub.cjs, generate-lobby.cjs, generate-snapshot.cjs, plus dashboard/index.html and dashboard/export-template.html, never got the wiring the original commit (a9e1ee88) claimed to have shipped. That commit's full fix survives on unmerged branch `feat/mos-design-system-v1.1` (confirmed NOT an ancestor of main) -- port those diffs rather than re-author from scratch where the branch already solved the problem correctly.

</domain>

<decisions>
## Implementation Decisions

### Theme scope (dashboard templates)
- Static cream default (`data-theme="light"`) for dashboard/index.html and dashboard/export-template.html. NOT a full light/dark toggle. Matches the 4 generators' scope, lower risk, no new toggle-persistence logic.

### Migration scope (legacy variable handling)
- Token injection + alias layer ONLY. Inject M:OS canonical tokens, alias legacy `--mondrian-*`/`--ds-*` variable names onto the canonical values (same technique wiki-layout.cjs already proved works). Do NOT rename every legacy variable throughout both templates -- that "full class migration" is explicitly out of scope for this task.

### Claude's Discretion
- Exact insertion point/line for `mosStyleTag()` calls in each of the 4 generator scripts, informed by the research agent's read of each file's current HTML-emission structure.
- Whether to cherry-pick/port the unmerged branch's diffs verbatim per-file or adapt them, given research found the branch already solved this correctly for at least some of these files.

</decisions>

<specifics>
## Specific Ideas

- Research (260723-m5d-RESEARCH.md) resolved all 5 open investigation questions with HIGH confidence:
  1. `scripts/generate-standalone` EXISTS (bash script) and reads dashboard/index.html directly as its template -- no new file needed, fixing dashboard/index.html closes this gap.
  2. "The two legacy templates" = dashboard/index.html (`--ds-*` tokens, dark-first) and dashboard/export-template.html (`--mondrian-*` tokens) -- confirmed by the original commit's own diffstat.
  3. The 4 generators need an identical ~2-line template-literal fix (`data-theme="light"` + `${mosStyleTag()}` after `<head>`). The 2 dashboard files CANNOT `require()` the loader (scripts/serve-dashboard is a bare static file server) -- they need literal CSS text via the same var-aliasing technique wiki-layout.cjs proves works.
  4. dashboard/export-template.html has ZERO real M:OS tokens today (the "2 references" the orchestrator's original grep found were false-positive `/mos:command` substring matches, not design-system tokens). Treat as "add from scratch," not "complete a partial injection."
  5. No committed Playwright script exists in this repo for visual verification; reuse the ad hoc `npx playwright` CLI walkthrough pattern (per user's `feedback_playwright_cli.md` hard rule: use Playwright CLI via Bash, not the MCP plugin) rather than inventing a new test-file convention.

</specifics>

<canonical_refs>
## Canonical References

- Full research: `.planning/quick/260723-m5d-complete-m-os-canonical-design-system-v1/260723-m5d-RESEARCH.md`
- The unmerged branch carrying the original full fix: `feat/mos-design-system-v1.1` @ commit `a9e1ee88` -- `git show a9e1ee88 -- <path>` per remaining file to port.
- Working reference pattern: `lib/wiki/wiki-layout.cjs` (the one real consumer) + its Phase 232-01 plan/summary at `.planning/phases/232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc/232-01-PLAN.md` and `232-01-SUMMARY.md`.
- Design system contract: `skills/ui-system/design-system/SPEC.md`, `M-OS-DESIGN-SYSTEM.md`.
- Existing rules/*.md format to match for the new `skills/ui-system/rules/design-system.md`: `dual-palette.md`, `glyph-disambiguation.md`, `shape-f-zero-and-six.md`.

</canonical_refs>
