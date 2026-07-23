# M:OS Canonical Design System v1.1 — Completion — Research

**Researched:** 2026-07-23
**Domain:** HTML generator wiring (CJS template literals) + 2 static HTML templates + skill mandate docs
**Confidence:** HIGH (all 5 focus questions resolved by direct grep/git evidence, not inference)

## Summary

This is a completion task with a bigger gap than the task brief assumed. Git history shows the
real story: commit `a9e1ee88` ("feat(ui-system): bake M:OS canonical design system into all HTML
artifacts") did the FULL job — CSS bundle, loader, 4 generator rewires, 2 dashboard template
token injections, `rules/design-system.md` mandate doc, and `SKILL.md` "section 0" — but it lives
**only on the orphaned remote branch `feat/mos-design-system-v1.1`** (confirmed: `git merge-base
--is-ancestor a9e1ee88 HEAD` → NO). Commit `e9db0d1c` (Phase 232-01) later cherry-picked **only 5
files** from that branch onto main (the CSS bundle, the loader, and 3 docs) with the commit
message explicitly stating "File-level landing only; branch generator rewires untouched." So the
4 generators, the 2 dashboard templates, `rules/design-system.md`, and the `SKILL.md` section 0
were never actually landed — they exist as a fully-written reference implementation sitting on an
unmerged branch, not as unstarted work. The fastest and lowest-risk path is to port the exact
diffs from `a9e1ee88` (verified below) rather than re-invent them.

**Correction to task brief:** `dashboard/export-template.html` has **zero** M:OS token references
today (not 2/partial). Both dashboard templates carry their own bespoke, non-canonical dark-first
token sets (`--ds-*` in index.html, `--mondrian-*` in export-template.html) with hex values that
do not match the canonical palette at all (e.g. `--mondrian-red:#C23B22` vs canonical
`--red:#E11D22`). The "2 references" reading of the grep in the task brief was almost certainly a
stray match on unrelated `/mos:` command-name substrings in export-template.html (confirmed:
lines like `'/mos:root-cause'`), not design-system tokens.

**Primary recommendation:** Port `a9e1ee88`'s 4-generator diff verbatim (it is the exact pattern
`wiki-layout.cjs` also uses, just written independently); for the 2 dashboard templates, follow
the SAME token-alias approach `wiki-layout.cjs` uses (`--bg: var(--paper)` etc.) rather than the
literal hardcoded hex duplication `a9e1ee88` used, since the canonical bundle now already exists
as a requirable loader and dashboard files can have the full bundle inlined as static text (see
Pitfall 1). No new file is needed for "generate-standalone" (Q1). Re-create
`rules/design-system.md` and `SKILL.md` section 0 verbatim from `a9e1ee88` (both are pure content
that was simply dropped, not superseded).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSS bundle authoring/tokens | Static asset (skills/ui-system/design-system/) | — | Single source of truth, already complete |
| Runtime CSS injection for Node-generated HTML | Build-time Node script (scripts/generate-*.cjs) | — | `mosStyleTag()` called at generation time, output is static HTML |
| Runtime CSS injection for statically-served HTML | Static file content (dashboard/*.html) | — | Served by `scripts/serve-dashboard` (plain `python3 -m http.server`, confirmed no templating layer) — CSS must be literal text in the file, `require()` is not available at serve time |
| Mandate/documentation | Skill doc (skills/ui-system/SKILL.md + rules/design-system.md) | — | Governs future generators; consumed by humans/agents, not runtime |

## User Constraints

No CONTEXT.md exists for this quick task (`.planning/quick/.../CONTEXT.md` not found). No locked
decisions to honor beyond the task brief itself and repo-wide CLAUDE.md conventions (CJS only, no
em-dashes, Feynman-simplified writing).

## Phase Requirements

Not applicable — this is a quick-task, not a phased GSD plan with REQUIREMENTS.md IDs.

## Answers to the 5 Focus Questions

### Q1 — Does `generate-standalone` need a new file?

**No new file needed.** `scripts/generate-standalone` **exists today** (a bash script, not
`.cjs` — `file` confirms "Bourne-Again shell script"). Read in full: it does NOT independently
build HTML. It literally does `TEMPLATE="${DASHBOARD_DIR}/index.html"`, reads
`dashboard/index.html` as its template, and pipes it through a Python `re.sub`/string-replace step
that only swaps the `loadGraph()` JS function body (fetch → inline JSON) and a handful of
`<title>`/header-text strings. It changes ZERO CSS. Therefore: **fixing `dashboard/index.html`
directly automatically fixes every standalone export**, because `generate-standalone` inherits
100% of `dashboard/index.html`'s `<head>`/`<style>` byte-for-byte. This is also explicitly
confirmed by the M-OS-DESIGN-SYSTEM.md v1.1 doc itself (§12): *"Every HTML generator
(generate-deck/hub/lobby/snapshot, generate-standalone, dashboard + export templates) inlines the
bundle"* — `generate-standalone` is listed separately from "dashboard...templates" in that
sentence precisely because it is a wrapper, not an independent template. No `checkpoint` or new
file task should be added for it; a single verification step ("regenerate a standalone export
after fixing dashboard/index.html, confirm the CSS carries through") suffices.

### Q2 — What are "the two legacy templates"?

**`dashboard/index.html` and `dashboard/export-template.html`.** Confirmed two ways:
1. `git show --stat a9e1ee88` — the commit's own diffstat touched exactly these 2 HTML files (5
   lines each) alongside the 4 `.cjs` generators; no other HTML file appears in that diffstat.
2. A full repo-wide `find . -iname "*.html"` (excluding a stray `.claude/worktrees/` parallel
   checkout and `node_modules`) turns up other HTML files (`templates/*.html`,
   `lib/mcp/app-html/*.html`, `data/mva-deck-template.html`) but none of them are referenced
   anywhere in the M:OS design-system docs, the `a9e1ee88` diff, or `SKILL.md` §0/§12 as in scope.
   Those other templates are out of scope for this quick task — not "legacy" in the sense the
   commit meant, just untouched-and-unmentioned.

Confirmed current bespoke (non-canonical) token sets on these two files:
- `dashboard/index.html` — `--ds-bg:#0D0D0D`, `--ds-surface:#1A1A1A`, `--ds-cream:#F5F0E8`,
  `--ds-red:#A63D2F`, `--ds-blue:#1E3A6E`, `--ds-yellow:#C8A43C`, `--ds-green:#2D6B4A`, etc.
  (dark-first, ~14 custom props).
- `dashboard/export-template.html` — `--mondrian-red:#C23B22`, `--mondrian-blue:#1B3B6F`,
  `--mondrian-yellow:#E8B931`, `--mondrian-black:#1A1A1A`, `--mondrian-white:#F7F3ED`, etc.
  (8 custom props, different hex values from BOTH the canon and from index.html's own `--ds-*`
  set — three incompatible palettes exist in this repo today: canon, `--ds-*`, `--mondrian-*`).

The "full class migration" the original commit deferred means: these files' *component classes*
(`.op`, `.pill`, `.vd`, card grids, etc.) still reference the OLD var names (`--ds-red`,
`--mondrian-blue`) throughout their ~1900/~2460 lines of CSS, not just the `:root` block. A
minimal completion (this quick task's likely scope) is: inject the canonical `:root` tokens +
alias the legacy var names onto them (exactly the pattern `wiki-layout.cjs` uses — see Q3) so
existing component CSS keeps working, without touching every individual class. A "full class
migration" (renaming every `.op{background:var(--mondrian-white)}` to use `--panel` directly) is
the deferred, larger follow-up — NOT what "complete the mandate" requires for this task per the
task brief's own definition of done (tokens present, non-colliding).

### Q3 — Exact wiring pattern (from wiki-layout.cjs + the a9e1ee88 precedent)

**For the 4 Node-generated HTML scripts (`generate-deck.cjs`, `generate-hub.cjs`,
`generate-lobby.cjs`, `generate-snapshot.cjs`):** all four build their HTML via a **template
literal returned by a function**, not string concatenation. All four have the identical shape:
```js
const html = `<!DOCTYPE html>
<html lang="en">
<head>
...
```
The verified, already-written fix (from `a9e1ee88`, still valid, just never merged) is a 2-line
change per file, identical pattern in all 4:
```diff
-<html lang="en">
+<html lang="en" data-theme="light">
 <head>
+${require("../lib/ui/design-system.cjs").mosStyleTag()}
```
Insertion point: immediately after the literal `<head>` line, before any `<meta>` tags. Exact
line numbers (current file state, unchanged since a9e1ee88 was cut): `generate-deck.cjs` line
~118 (`const html = ...`) / head at ~120; `generate-hub.cjs` `function generateHtml(room)` ~2223,
head at ~2263; `generate-lobby.cjs` `function generateLobby` ~617, head at ~640;
`generate-snapshot.cjs` `function pageHead(title, model, extraCdns)` ~468, head at ~472. Prefer
the `wiki-layout.cjs` idiom of a single top-of-file `const { mosStyleTag } = require('../ui/design-system.cjs');`
plus `${mosStyleTag()}` at the call site (cleaner than a repeated inline `require(...)`), but both
work — `wiki-layout.cjs`'s own top-level require call already proves the relative path
`../ui/design-system.cjs` resolves correctly from a sibling `lib/*` directory; from `scripts/*.cjs`
the correct relative path is one level shallower: `../lib/ui/design-system.cjs` (verified in the
actual a9e1ee88 diff for all 4 generators — this is the exact string already used and correct).

**For the 2 static dashboard templates (`dashboard/index.html`, `dashboard/export-template.html`):**
these are served by `scripts/serve-dashboard`, a bare `python3 -m http.server`-style script with
**zero templating** — confirmed by reading `serve-dashboard` in full (its only job is to run
`build-graph-from-sqlite.cjs`, run `generate-standalone`, then `find_port` + launch a static
server). `require()` is not available at serve time for these files — the CSS must be **literal
text baked into the file**, exactly as `a9e1ee88`'s diff already did:
```diff
   <style>
+    /* === M:OS CANONICAL DESIGN SYSTEM v1.1 (baked tokens) ===
+       Full asset: skills/ui-system/design-system/mos-design-system.css
+       Ruling: skills/ui-system/rules/design-system.md === */
+    :root{--paper:#F4F2EC;--panel:#FBFAF7;--ink:#0C0C0D;--muted:#5B5B5B;--hair:#111;--edge:#111;--rule:rgba(17,17,17,.14);--red:#E11D22;--blue:#1E52E0;--yellow:#FFC400;--green:#12A06A;--shadow:18px 18px 0 var(--yellow);--grot:"Helvetica Neue",Inter,system-ui,Arial,sans-serif}
+    :root[data-theme="dark"]{--paper:#0B0B0D;--panel:#141417;--ink:#F3F2EE;--muted:#9a9a9e;--hair:#F3F2EE;--edge:rgba(243,242,238,.34);--blue:#6D9BFF;--rule:rgba(243,242,238,.16)}
     :root {
       --ds-bg: #0D0D0D;
```
That literal injection is the minimum viable fix (a9e1ee88's own scope: "tokens injected,
non-colliding var names" — note the new tokens use different names, `--paper`/`--ink`/etc, so they
do NOT collide with `--ds-*`/`--mondrian-*`, they sit alongside them). **Stronger option (matches
wiki-layout.cjs's actual approach, recommended):** additionally alias the legacy names onto the
canonical ones, e.g. for `dashboard/index.html`:
```css
:root { --ds-bg: var(--paper); --ds-surface: var(--panel); --ds-red: var(--red); --ds-blue: var(--blue); --ds-yellow: var(--yellow); --ds-green: var(--green); }
```
This makes every existing `.op{background:var(--ds-surface)}`-style rule automatically pick up
canonical values with zero per-class edits — this is the exact "alias legacy structural var names
onto canonical tokens" technique `wiki-layout.cjs`'s own header comment documents (see its
`CSS_STYLES` block, `:root { --bg: var(--paper); --surface: var(--panel); ... }`). Do the same for
`export-template.html`'s `--mondrian-*` set. **Theme toggle:** `wiki-layout.cjs` persists theme
via `localStorage.getItem('mos-wiki-theme')` on an IIFE at body-script time and a `toggleTheme()`
function toggling `document.documentElement.setAttribute('data-theme', ...)`. Neither dashboard
template currently has a theme toggle button; adding the canonical tokens does not require adding
a toggle (both can default `data-theme="light"` statically like the 4 generators do) — a toggle is
optional scope, not required for "tokens injected."

### Q4 — export-template.html's "2 existing M:OS references"

**Correction: there are zero.** Re-grepped case-insensitively for `mos`, canonical hex values
(`F4F2EC`, `E11D22`, `1E52E0`, `FFC400`, `12A06A`) in both dashboard files. Every "mos" hit in
`export-template.html` is a substring of a `/mos:command-name` string inside a
`SECTION_ACTIONS` JS object (JTBD command suggestions), e.g. `'/mos:root-cause'`,
`'mos-update-dismissed'` (a `localStorage` key name) — none are design-system tokens or the
`data-mos="v1.1"` marker `mosStyleTag()` emits. `dashboard/index.html` has the same pattern (4
`mos` hits, all `/mos:`-command or meta-tag related). **Conclusion: this is a "complete" task for
both dashboard templates, not a "fix and complete" task** — there is nothing partial or broken to
correct; the injection has simply never happened on `main` (it exists only on the orphaned
`a9e1ee88` branch commit, as established above).

### Q5 — Playwright precedent in this repo

**No committed Playwright script or test file exists** (`grep -rli playwright` across
`tests/*.md,*.cjs,*.json`, `scripts/*` returns nothing but one unrelated research doc mention).
However, Playwright IS globally installed (`npx playwright --version` → `1.61.1`,
`~/.npm-global/bin/playwright`), and the Phase 232-06 SUMMARY documents the actual precedent
pattern: an **ad hoc `npx playwright` CLI-driven headless-Chromium walkthrough**, run directly by
the agent via Bash (not the Playwright MCP plugin — per the user's own hard rule in
`feedback_playwright_cli.md`: *"Use Playwright CLI via Bash, not the MCP plugin, for browser
automation"*), taking numbered PNG screenshots to `/tmp/wiki-shots/NN-description.png` against a
locally-running dev server (`ROOM_DIR=tests/fixtures/wiki-room-232` + `scripts/serve-wiki`), used
as the stronger substitute for a manual human click-through checkpoint. **The plan for this task
should point the executor at the SAME ad hoc pattern** — `npx playwright` via Bash, screenshot
each regenerated HTML artifact (deck/hub/lobby/snapshot/dashboard/export-template/standalone) at
both `data-theme="light"` and `data-theme="dark"` (where a toggle exists) — rather than writing a
new checked-in Playwright test file, since no such file convention exists yet in this repo. If a
canonical Playwright fixture pattern is wanted going forward, `tests/fixtures/test-room-visual`
already exists as a directory name (not inspected in depth — out of this quick task's scope) and
could be a hook for a future committed test, but that is not required to close this mandate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS bundle content | A new/rewritten canonical CSS file | `skills/ui-system/design-system/mos-design-system.css` (already complete, 240 lines, landed in e9db0d1c) | Single source of truth already exists and is proven working in `wiki-layout.cjs` |
| Node-side injection helper | A new loader function | `lib/ui/design-system.cjs` `mosStyleTag()` (already complete, 20 lines, defensive/never-throws) | Already exists, already the one true API, already proven in production (`wiki-layout.cjs`) |
| Mandate doc content | A freshly-authored `rules/design-system.md` | Port the 48-line body verbatim from `git show a9e1ee88:skills/ui-system/rules/design-system.md` | Already written, reviewed (implicitly, by having shipped once), matches the `rules/*.md` frontmatter pattern of its siblings |
| SKILL.md section 0 content | A freshly-authored mandate paragraph | Port verbatim from `git show a9e1ee88 -- skills/ui-system/SKILL.md` (the exact diff hunk, 11 lines) | Same rationale — already written and scoped correctly |

**Key insight:** almost nothing in this task needs new authorship. The overwhelming majority of
the "gap" is re-applying a diff that already exists verbatim on an orphaned branch commit
(`a9e1ee88`, `origin/feat/mos-design-system-v1.1`). The planner should treat this as a
**cherry-pick-and-adapt** task, not a from-scratch build: `git show a9e1ee88 -- <path>` for each
of the 6 remaining files (4 generators + 2 mandate docs) gives an exact, already-correct diff to
re-apply (docs verbatim; generators verbatim since they're unchanged since being cut; dashboard
templates verbatim-plus-recommended-alias-upgrade per Q3).

## Common Pitfalls

### Pitfall 1: Assuming dashboard templates can `require()` the loader
**What goes wrong:** copy-pasting the generator pattern (`${require("../lib/ui/design-system.cjs").mosStyleTag()}`)
directly into a static `.html` file leaves literal, non-executing template-literal-looking text in
the shipped page.
**Why it happens:** the 4 generators and the 2 dashboard templates look similar (both are
"<head>...<style>...") but only the generators run through Node at build time; the dashboard
files are served as-is by a bare static file server (`scripts/serve-dashboard`, confirmed no
Express/templating).
**How to avoid:** for the 2 dashboard files, inline the literal CSS text (or better, the aliasing
pattern from Q3) directly into the `<style>` block; never leave a `require(...)` call in a `.html`
file that will be served statically.
**Warning signs:** opening the exported HTML in a browser and seeing the literal string
`${require(...)}"` rendered as page text, or a `ReferenceError` in devtools console.

### Pitfall 2: Treating `generate-standalone` as needing its own generator logic
**What goes wrong:** writing a brand-new `scripts/generate-standalone.cjs` that duplicates
`dashboard/index.html`'s HTML structure, creating a 3rd copy of the CSS to keep in sync.
**Why it happens:** the naming convention (`generate-deck.cjs`, `generate-hub.cjs`, ...) makes it
look like `generate-standalone` should be a peer `.cjs` file.
**How to avoid:** confirmed by reading the actual `scripts/generate-standalone` (bash, exists,
verbatim reads `dashboard/index.html` as its template) — fixing `dashboard/index.html` is
sufficient; do not create a parallel file.
**Warning signs:** if a plan step says "create scripts/generate-standalone.cjs", that step is
based on a wrong premise and should be redirected to "fix dashboard/index.html; verify
generate-standalone inherits it."

### Pitfall 3: Re-authoring rules/design-system.md or SKILL.md §0 from scratch
**What goes wrong:** wasted effort + risk of drifting from the wording other docs (M-OS-DESIGN-SYSTEM.md
§12, SPEC.md) already cross-reference verbatim (e.g. M-OS-DESIGN-SYSTEM.md §12 literally says
"Mandate: `skills/ui-system/SKILL.md` section 0 + `skills/ui-system/rules/design-system.md`" —
if the new authoring doesn't match that expectation, cross-doc consistency breaks).
**How to avoid:** `git show a9e1ee88:skills/ui-system/rules/design-system.md` and
`git show a9e1ee88 -- skills/ui-system/SKILL.md` give the exact original text; re-apply verbatim.

## Code Examples

### The proven, working consumer pattern (lib/wiki/wiki-layout.cjs, lines 14 + 88)
```js
const { mosStyleTag } = require('../ui/design-system.cjs');
// ... later, inside the template literal, right after the CDN <script> tags, before the
// structural <style> block:
  ${mosStyleTag()}
  <style>
${CSS_STYLES}
  </style>
```
And the alias technique (same file, `CSS_STYLES` constant, near the top):
```css
:root {
  --bg: var(--paper);
  --surface: var(--panel);
  --elevated: var(--panel);
  --text: var(--ink);
  --text-muted: var(--muted);
  --border: var(--rule);
  --link: var(--blue);
  --link-hover: var(--blue);
  --code-bg: var(--panel);
}
```
This is the exact pattern to replicate for the 2 dashboard templates' `--ds-*` / `--mondrian-*`
names.

### The loader itself (lib/ui/design-system.cjs, verbatim, unchanged, already correct)
```js
function mosStyleTag() {
  const css = readDesignSystemCss();
  return css ? '<style data-mos="v1.1">\n' + css + '\n</style>' : '';
}
```
Note it already emits `data-mos="v1.1"` as a marker attribute — useful as a grep-able acceptance
check ("does every generated artifact contain `data-mos=`?") for a phase-close verification step.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding the alias-layer upgrade (Q3, dashboard templates) rather than a literal-only token injection is the better path | Q3 / Don't Hand-Roll | Low — either approach satisfies "tokens injected, non-colliding names" from the mandate's own wording; the alias approach is a judgment call (extrapolated from wiki-layout.cjs's OWN documented pattern), not independently verified against a written requirement for the dashboard files specifically |
| A2 | No committed Playwright test convention should be introduced for this task; ad hoc CLI walkthrough suffices | Q5 | Low — this mirrors the one existing precedent (Phase 232-06) exactly; if the user wants a permanent regression test this would need revisiting, but nothing in the task brief asks for one |

**All package-related claims:** N/A — this task installs no new packages (Playwright is already
globally installed per the user's existing tooling; no npm/pip packages are added by any part of
this work). The Package Legitimacy Audit and Environment Availability sections are therefore
omitted as inapplicable.

## Open Questions

1. **Should the dashboard theme toggle be added, or is static `data-theme="light"` sufficient?**
   - What we know: the 4 generators (per a9e1ee88) only set `data-theme="light"` statically, no
     toggle. `wiki-layout.cjs` has a full toggle + localStorage persistence.
   - What's unclear: whether "complete the mandate" for dashboard/export-template.html implies
     parity with the wiki's toggle, or just static light-mode tokens like the 4 generators.
   - Recommendation: default to static `data-theme="light"` (matching the 4 generators' scope,
     the lower-risk/smaller diff), treat a toggle as an explicit stretch item if the user wants
     dark-mode parity with the wiki.

2. **Full class migration scope boundary.**
   - What we know: the original commit explicitly deferred "full class migration of the two
     legacy templates to M:OS components" as a follow-up needing "a browser visual pass."
   - What's unclear: whether this quick task should ALSO do that follow-up, or stop at
     token-injection (which is what the task brief's own gap list describes as the scope: "M:OS
     tokens injected, non-colliding var names").
   - Recommendation: scope this task to token injection + alias layer only (matches task brief's
     stated definition of the gap); track full class migration as a separate future item if
     visual QA surfaces problems the alias layer doesn't fully resolve.

## Sources

### Primary (HIGH confidence — direct repo inspection)
- `git show a9e1ee88` (full diff, all 13 files) — the complete original implementation, unmerged
- `git log --all --oneline -- <path>` per file — confirmed landed vs. orphaned status
- `git merge-base --is-ancestor a9e1ee88 HEAD` — confirmed NOT an ancestor of main
- `lib/ui/design-system.cjs`, `lib/wiki/wiki-layout.cjs` — read in full, current working state
- `dashboard/index.html`, `dashboard/export-template.html` — read head sections + grepped in full
- `scripts/generate-standalone`, `scripts/serve-dashboard` — read in full
- `skills/ui-system/design-system/M-OS-DESIGN-SYSTEM.md`, `SPEC.md` — read in full
- `.planning/phases/232-.../232-06-SUMMARY.md` — Playwright verification precedent

### Secondary (MEDIUM confidence)
- `skills/ui-system/rules/dual-palette.md` — cross-referenced for rules/*.md frontmatter pattern
- User global memory `feedback_playwright_cli.md` (referenced by 232-06 SUMMARY, not re-read
  directly in this session, but its stated rule is quoted verbatim in the SUMMARY)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries/packages involved, pure repo-internal wiring
- Architecture: HIGH — confirmed by reading serve-dashboard + generate-standalone in full,
  not inferred
- Pitfalls: HIGH — Pitfall 1 and 2 are both directly falsifiable claims verified against actual
  file contents, not speculation

**Research date:** 2026-07-23
**Valid until:** Effectively unbounded for the git-history findings (immutable); ~30 days for
"current state of dashboard/*.html has zero tokens" (will go stale the moment this task ships)
