# Phase 232: BlockNote Wiki Convergence — Specification

**Created:** 2026-07-19
**Ambiguity score:** 0.14 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

`/mos:wiki` gains a BlockNote-powered editing surface (ported from the `dev/mindrian-workroom`
prototype as a prebuilt client bundle on the existing Express+CJS server) and opens to a Room
Home dashboard instead of the graph view, while keeping today's wiki's cross-linking, search,
theming, and share-export capabilities intact.

## Background

Two artifacts collided this session and this phase reconciles them:

1. **Today's `/mos:wiki`** (`commands/wiki.md`, `lib/wiki/*.cjs`) is a read-only Express +
   markdown-it server. It was deliberately scoped read-only in
   `.planning/research/WIKI-PLATFORMS.md` (2026-03-26): "the moment we add editing, we've
   become Wiki.js and lost." That research picked Express + markdown-it + Cytoscape.js
   specifically because Next.js-weight frameworks (Docusaurus, Nextra) lost the evaluation on
   the CJS-only / no-build-step / lightweight (R7, CRITICAL weight) requirement. SEED-006
   ("Mindrian Wiki Sprint — The Visible Room", planted 2026-05-07,
   `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md`) scoped a finish-the-
   read-only-wiki sprint against a Phase 104/126 slot that has since gone stale — Phase 126
   shipped as the unrelated `install-lifecycle-harness-gaps`, while ~230 other phases shipped
   past this dormant seed.

2. **`dev/mindrian-workroom`** ("the blocknote test", untracked — `git status --porcelain`
   shows `?? dev/mindrian-workroom/`) is a Next.js 16 + React 19 + BlockNote app the user built
   and now wants ported into a revised `/mos:wiki`. It already implements a section-nav sidebar,
   sub-room navigation, a "Room Home" dashboard (governing thought, Larry's Briefing, gaps,
   section progress), a BlockNote article editor with direct save-to-markdown, and PDF/DOCX
   export.

This phase was scoped through a full `superpowers:brainstorming` session (not this workflow's
own interview loop — `--auto` derives directly from that session's four locked
`AskUserQuestion` decisions, logged in the Interview Log below) that reconciles both: keep the
existing wiki's Express+CJS lightweight delivery constraint intact, while porting in workroom's
editing UX as an additive client bundle, and reversing the old "graph is the homepage" mandate
in favor of workroom's Room Home.

## Requirements

1. **Client bundle delivery, zero framework vendoring**: `/mos:wiki` ships a prebuilt
   BlockNote+React client-side bundle served by the existing Express server; the plugin's own
   runtime dependency tree gains no Next.js/React/BlockNote entries.
   - Current: `lib/wiki/wiki-server.cjs` serves read-only HTML rendered via `markdown-it`; no
     client-side editor exists in the plugin.
   - Target: A prebuilt bundle (built once at author time, checked into the repo like existing
     static assets — same shape as the Cytoscape.js CDN pattern already used by the dashboard)
     is loaded by the article view and mounts a BlockNote editor in the browser.
   - Acceptance: The plugin's `package.json` `dependencies` (production) contains no `next`,
     `react`, or `@blocknote/*` entries; opening any article in `/mos:wiki` renders an editable
     BlockNote surface.

2. **Article editing with direct save-to-disk**: Every wiki article is editable in place and
   saves back to its source `.md` file.
   - Current: `/mos:wiki` is read-only — "edit files in your IDE, wiki auto-refreshes via file
     watcher" (`commands/wiki.md`).
   - Target: Editing an article's content and triggering Save rewrites that article's `.md`
     file with the edited markdown. No confirmation dialog, no conflict/mtime check (locked
     decision: the silent-overwrite risk on a concurrent external edit is explicitly accepted,
     not solved, in this phase).
   - Acceptance: Editing an article's body and clicking Save changes the corresponding `.md`
     file's on-disk content to match; no mtime/hash check blocks or warns on the save.

3. **Per-article PDF/DOCX export**: Any open article can be exported as PDF or Word.
   - Current: No per-article export exists in `/mos:wiki`; only whole-room static-HTML export
     (`--export`) exists today.
   - Target: The article view offers "Export PDF" and "Export Word" actions producing a
     downloadable file matching the article's current (possibly unsaved) editor content.
   - Acceptance: "Export PDF" produces a valid `.pdf` containing the article's rendered text;
     "Export Word" produces a valid `.docx`.

4. **Room Home as the wiki landing page**: Opening `/mos:wiki` lands on a Room Home dashboard,
   not the graph.
   - Current: No such dashboard exists in the plugin's wiki. The historical Phase 19 mandate
     ("graph view is the wiki homepage," reaffirmed in SEED-006) was never actually shipped
     either.
   - Target: The wiki's root route renders governing thought, venture-stage badge, total entry
     count, a Larry's Briefing panel (critical misses / reframe / next steps, generated on
     demand), suggested-next-action, a gaps list, and per-section progress bars — sourced from
     the room's real `STATE.md` / `compute-state` data, not the graph.
   - Acceptance: Loading `/mos:wiki`'s root URL renders the Room Home dashboard (a DOM element
     unique to it, e.g. a governing-thought heading or section-progress list) rather than a
     Cytoscape graph canvas.

5. **Graph view demoted to a tab, not removed**: The existing Cytoscape graph stays available,
   one click away from Room Home.
   - Current: No graph is currently wired into `/mos:wiki`'s read-only pages; Cytoscape graph
     rendering exists elsewhere (`dashboard/`, `/mos:visualize` on port 8420).
   - Target: A "Graph" tab/nav item inside `/mos:wiki` opens the same Cytoscape-based knowledge
     graph view, without leaving the wiki's own server/port.
   - Acceptance: Clicking the Graph tab from Room Home renders the interactive Cytoscape graph
     of the current room inside `/mos:wiki`.

6. **Wikilinks + backlinks/see-also carried into the editable view**: `[[wikilink]]` syntax
   renders as clickable cross-references with reverse-edge panels.
   - Current: `lib/wiki/graph-links.cjs` already implements `getBacklinks`/`getSeeAlso`;
     `lib/wiki/page-renderer.cjs` already uses `@ig3/markdown-it-wikilinks` for read-only
     rendering. Neither is wired into a BlockNote surface today.
   - Target: Within the BlockNote-based article view, saved markdown containing
     `[[wikilink]]` syntax renders as a clickable link that navigates to the target article,
     and each article shows "Backlinks" and "See also" panels populated by the existing
     `getBacklinks`/`getSeeAlso` functions.
   - Acceptance: An article containing `[[other-article]]` shows a clickable link that
     navigates to `other-article`; an article that other content links to lists those
     referrers under Backlinks.

7. **Full-text search across the room**: A search box queries all article titles/bodies.
   - Current: `lib/wiki/wiki-search.cjs` exists but is not wired into a Room-Home-first,
     BlockNote-editable layout.
   - Target: A search control in the wiki UI returns a results list linking to matching
     articles, reachable from any view (Room Home, article, graph).
   - Acceptance: Searching a term known to exist in exactly one article returns that article
     as a result and no others sharing that unique term.

8. **Dark/light theme toggle, persisted**: A control switches the wiki's rendering between
   light and dark De Stijl variants.
   - Current: Promised as a Phase 19-01 mandate, never shipped, per SEED-006's audit; neither
     today's wiki nor `dev/mindrian-workroom` currently ships a toggle.
   - Target: A toggle switches the theme immediately and persists the choice (e.g.
     `localStorage`) across reloads.
   - Acceptance: Toggling the control changes the visible theme without a reload; reloading
     the page preserves the last-selected theme.

9. **Static-HTML share-export preserved**: `/mos:wiki --export` keeps working against the new
   implementation.
   - Current: `/mos:wiki --export` generates a static HTML bundle in `export/wiki/` today.
   - Target: `/mos:wiki --export` still produces a shareable static HTML bundle covering Room
     Home + articles + wikilinks; the exported bundle itself stays read-only/static (it is for
     sharing with people who should not be editing the source room).
   - Acceptance: Running `/mos:wiki --export` after this phase produces `export/wiki/`
     containing valid static HTML that renders without a live server and without exposing the
     save/edit affordance.

## Boundaries

**In scope:**
- A prebuilt BlockNote client bundle mounted by the existing Express+CJS `/mos:wiki` server
- Direct, unguarded save-to-markdown from the BlockNote editor
- Per-article PDF/DOCX export
- Room Home as the new wiki landing page (governing thought, Larry's Briefing, gaps, section
  progress), sourced from real room state
- Graph view retained as a secondary tab
- Wikilinks-as-hyperlinks + backlinks/see-also panels, wired into the new editable view
- Full-text search
- Dark/light theme toggle persisted to `localStorage`
- `/mos:wiki --export` continuing to produce a static, read-only shareable bundle
- CLI surface only (this is `/mos:wiki`, run via Claude Code)

**Out of scope:**
- Vendoring Next.js/React as a plugin runtime dependency, or launching `dev/mindrian-workroom`
  itself from `/mos:wiki` — rejected in the brainstorming session on lightweight/CJS-only
  grounds
- Retiring or merging `dev/mindrian-workroom` — it continues separately as the Cowork/hosted-
  surface prototype
- Save-conflict detection (mtime/hash checks, "reload latest" prompts) — the silent-overwrite
  risk on concurrent edits is explicitly accepted, not solved, this phase
- Click-red-wikilink-to-research — deferred to v2 per the locked v1 scope cut
- The Larry chat WebSocket panel (`wiki-chat.cjs` stays a stub) — deferred to v2
- 9-tier freshness/TTL frontmatter — deferred to v2
- First-time onboarding tour — deferred to v2
- Cohort/sub-room-as-cohort-member views specific to the IRIS teaching use case (present in
  `dev/mindrian-workroom` but not part of `/mos:wiki`'s general-purpose room model)
- Desktop and Cowork surface implementations of any of the above — flagged under Constraints,
  not solved here (Tri-Polar Design Rule, CLAUDE.md)

## Constraints

- No new production `dependencies` in the plugin's `package.json` from Next.js, React, or
  `@blocknote/*` — client bundle must be prebuilt and vendored as a static asset, matching the
  existing Cytoscape.js delivery pattern, per `.planning/research/WIKI-PLATFORMS.md`'s R7
  (CRITICAL) lightweight requirement and CLAUDE.md's "CJS only, no TypeScript" / "no server
  infrastructure" conventions.
- This spec covers the CLI surface (`/mos:wiki` in Claude Code) only. Per the Tri-Polar Design
  Rule (CLAUDE.md), Desktop and Cowork implications exist (the MCP `room-wiki` App View,
  `lib/mcp/app-html/wiki.html`) but are explicitly out of scope here — discuss-phase should
  flag whether they need a follow-up phase, not attempt to solve them in this one.
- No conflict-detection/mtime-check machinery — explicitly rejected complexity for this phase
  (locked decision 4).
- Branding stays De Stijl 5-color palette, no emoji, per CLAUDE.md and the historical wiki
  sprint branding rules (`.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md`).

## Acceptance Criteria

- [ ] `/mos:wiki` opens directly to Room Home (governing thought, Larry's Briefing, gaps,
      section progress), not the graph
- [ ] A "Graph" tab reachable from Room Home renders the Cytoscape knowledge graph
- [ ] Any article opens in an editable BlockNote surface backed by a prebuilt client bundle;
      the plugin's production `dependencies` contain no `next`/`react`/`@blocknote/*` entries
- [ ] Editing and saving an article writes the new content to its source `.md` file, with no
      conflict/mtime check blocking the save
- [ ] "Export PDF" and "Export Word" on an article each produce a valid downloadable file
- [ ] `[[wikilink]]` syntax in an article renders as a clickable link to the target article
- [ ] An article shows a "Backlinks" panel listing articles that link to it and a "See also"
      panel from `getSeeAlso`
- [ ] A search control returns the correct article(s) for a known unique search term
- [ ] A dark/light theme toggle changes the visible theme immediately and persists across a
      page reload
- [ ] `/mos:wiki --export` produces a static, read-only HTML bundle in `export/wiki/` with no
      save/edit affordance present

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                          |
|---------------------|-------|------|--------|------------------------------------------------|
| Goal Clarity        | 0.90  | 0.75 | ✓      | Single measurable outcome, four locked forks    |
| Boundary Clarity    | 0.92  | 0.70 | ✓      | Explicit in/out lists with reasoning            |
| Constraint Clarity  | 0.78  | 0.65 | ✓      | Delivery-lane + save-semantics constraints locked; exact bundler tooling left to discuss-phase (a "how", not a "what") |
| Acceptance Criteria | 0.85  | 0.70 | ✓      | 10 pass/fail criteria, all verifiable without subjective judgment |
| **Ambiguity**       | 0.14  | ≤0.20| ✓      | `--auto`: derived from a completed brainstorming session, no live interview run |

## Interview Log

The "interview" was a full `superpowers:brainstorming` session with Jonathan, conducted before
this workflow ran, using four `AskUserQuestion` decision gates. Logged here in place of a live
Socratic round, per `--auto`.

| Round | Perspective (mapped) | Question summary | Decision locked |
|-------|-----------------------|-------------------|------------------|
| 1 | Researcher / Boundary Keeper | Where should the BlockNote experience actually live — vendor Next.js into the plugin, keep `dev/mindrian-workroom` fully separate, or split by surface? | Split by surface: Express+CJS `/mos:wiki` gains a prebuilt BlockNote client bundle; `dev/mindrian-workroom` stays the separate Cowork/hosted prototype |
| 2 | Boundary Keeper | Graph-as-homepage (Phase 19 mandate) vs. workroom's Room Home as the landing page? | Room Home first; graph becomes a secondary tab, deliberately overturning the Phase 19 mandate |
| 3 | Failure Analyst | Always-editable direct save risks silently clobbering a concurrent Claude Code/IDE edit — add conflict detection, accept the risk, or make editing opt-in/read-only-by-default? | Always-editable, direct save, risk explicitly accepted — no conflict-detection machinery built |
| 4 | Simplifier | Given the gap between workroom's feature set and today's wiki's feature set, what's the v1 cut? | Keep workroom's features as-is; port in wikilinks/backlinks/search/graph-tab/theme-toggle/static-export from today's wiki; defer red-link-research, chat panel, freshness tiers, onboarding tour to v2 |

---

*Phase: 232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc*
*Spec created: 2026-07-19*
*Next step: /gsd-discuss-phase 232 — implementation decisions (bundler tooling choice, exact BlockNote-to-markdown-AST mapping for wikilinks, Room Home data-source wiring, Desktop/Cowork follow-up scoping)*
