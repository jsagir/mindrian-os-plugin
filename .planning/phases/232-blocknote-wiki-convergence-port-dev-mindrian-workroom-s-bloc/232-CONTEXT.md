# Phase 232: BlockNote Wiki Convergence - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

`/mos:wiki` gains a BlockNote-powered editing surface (ported from the `dev/mindrian-workroom`
prototype as a prebuilt client bundle on the existing Express+CJS server) and opens to a Room
Home dashboard instead of the graph view, while keeping today's wiki's cross-linking, search,
theming, and share-export capabilities intact. This context covers HOW to build what SPEC.md
already locked as WHAT/WHY.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `232-SPEC.md` for full requirements, boundaries, and
acceptance criteria.

Downstream agents MUST read `232-SPEC.md` before planning or implementing. Requirements are not
duplicated here.

**In scope (from SPEC.md):** A prebuilt BlockNote client bundle mounted by the existing
Express+CJS `/mos:wiki` server; direct, unguarded save-to-markdown from the BlockNote editor;
per-article PDF/DOCX export; Room Home as the new wiki landing page (governing thought, Larry's
Briefing, gaps, section progress) sourced from real room state; graph view retained as a
secondary tab; wikilinks-as-hyperlinks + backlinks/see-also panels wired into the new editable
view; full-text search; dark/light theme toggle persisted to `localStorage`; `/mos:wiki --export`
continuing to produce a static, read-only shareable bundle; CLI surface only.

**Out of scope (from SPEC.md):** Vendoring Next.js/React as a plugin runtime dependency, or
launching `dev/mindrian-workroom` itself from `/mos:wiki`; retiring or merging
`dev/mindrian-workroom`; save-conflict detection (mtime/hash checks); click-red-wikilink-to-
research; the Larry chat WebSocket panel; 9-tier freshness/TTL frontmatter; onboarding tour;
cohort/sub-room-as-cohort-member views; Desktop and Cowork surface implementations (flagged
under Constraints only).

</spec_lock>

<decisions>
## Implementation Decisions

Gathered via `superpowers:brainstorming` (delivery lane, Room Home landing page, save
semantics, v1 scope — all locked in SPEC.md) followed by `/gsd-discuss-phase 232` in advisor
mode (`vendor_philosophy: opinionated` -> `minimal_decisive` calibration tier, 1-2 options per
area; `learning_style: guided` non-technical-owner signal explicitly overridden and logged —
this entire discussion was conducted in full technical framing given the user's demonstrated
depth on CJS/bundler/BlockNote internals in the same session).

### Client bundle build tooling
- **D-01:** Use **esbuild**, run as a manual author-time build script (not a CI step) —
  matches this plugin's existing zero-CI-dependency authoring model.
- **D-02:** Isolate build tooling in `lib/wiki/editor-src/` with its own `package.json` (React,
  BlockNote, esbuild live here, never in the plugin's root `package.json`), with vendored
  compiled output in `lib/wiki/editor-dist/`.
- **D-03:** Serve the compiled bundle via `express.static`, mirroring the existing
  `/room-assets` static-mount pattern already in `lib/wiki/wiki-server.cjs`.
- **D-04:** Vite (library mode) is the only fallback, and only if HMR-driven widget iteration
  turns out to be needed during implementation — not a default.

### Room Home data wiring
- **D-05 (deterministic stats):** Reuse `lib/core/state-ops.cjs`, plus a small newly-ported
  STATE.md parser adapted from `dev/mindrian-workroom/src/lib/rooms.ts::getRoomState`, for
  governing thought, venture stage, entry counts, section progress, and gaps.
- **D-06 (Larry's Briefing model call):** Reuse the existing raw-`fetch` Anthropic pattern
  already in this repo (`resolveAnthropicKey()` -> `POST https://api.anthropic.com/v1/messages`,
  the same mechanism `lib/core/mva-classifier.cjs` uses), keyed on `ANTHROPIC_API_KEY`.
  **Explicitly rejected:** porting `dev/mindrian-workroom/src/lib/briefing.ts`'s Vercel AI SDK
  (`ai` package, `generateText` + `Output.object`) + AI Gateway approach — it would add a new
  production dependency and require a new credential (`AI_GATEWAY_API_KEY`) this plugin doesn't
  otherwise ask users to configure, when a zero-dep in-repo pattern already does the job (Canon
  Part 7, reuse before build).
- Do not defer Larry's Briefing to v2 — it is part of the locked Room Home requirement (SPEC
  Req 4) and both sub-questions resolved to existing in-repo reuse paths, so there is no
  remaining blocker to build it in this phase.

### Wikilink rendering inside BlockNote
- **D-07:** Ground truth, verified by direct inspection of the installed
  `@blocknote/core@0.51.4` source (not memory): `[[wikilink]]` syntax survives a full
  `tryParseMarkdownToBlocks` -> `blocksToMarkdownLossy` round-trip **byte-identical as plain
  text** — BlockNote 0.51.x does not use remark/mdast and has no `[`/`]` escaping in its
  export path. This removes corruption risk from either implementation option.
- **D-08:** Implement a **custom inline content spec** (`createReactInlineContentSpec`) that
  renders `[[wikilink]]` as a clickable pill directly inside the BlockNote editing surface —
  this is what SPEC Req 6 literally requires ("renders as a clickable link ... within the
  BlockNote-based article view"), not a plain-text-in-editor / clickable-only-in-a-separate-
  read-view fallback.
- **D-09:** Because BlockNote has no native custom-inline<->markdown bridge, this needs two
  hand-written transforms in the ported client bundle: a **load-time** transform (walk the
  parsed block tree, convert `[[foo]]` text runs into `wikilink` inline nodes) and a
  **save-time** transform (re-emit `wikilink` inline nodes as literal `[[foo]]` text before
  `blocksToMarkdownLossy`). The save-time transform is low-risk because plain `[[foo]]` text is
  proven (D-07) to export verbatim if the transform is ever skipped or fails open.
- **D-10:** Backlinks and "See also" panels are BlockNote-independent — they are server-side
  SQLite queries via the already-shipped `getBacklinks`/`getSeeAlso` in
  `lib/wiki/graph-links.cjs`. No new work needed there beyond wiring the existing functions'
  output into the new article view's layout.

### Desktop/Cowork follow-up scoping
- **D-11:** Explicitly left unflagged for this phase. The user selected this gray area OUT of
  discussion (of 4 offered, 3 were selected) — read as "don't solve it now, don't flag a
  follow-up phase yet either." SPEC.md's Constraints section already notes the Tri-Polar gap
  exists (the MCP `room-wiki` App View at `lib/mcp/app-html/wiki.html`) without committing to
  when it gets addressed. Revisit only if it comes up again.

### Claude's Discretion
- Exact naming/shape of the load-time and save-time wikilink transform functions (D-09) is
  left to the planner/executor — the decision here is that they must exist and where they live
  (the ported client bundle in `lib/wiki/editor-src/`), not their internal API.
- Exact shape of the small ported STATE.md parser (D-05) — adapt from `rooms.ts::getRoomState`
  as closely as makes sense once the planner reads both source files; not specified further
  here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec
- `.planning/phases/232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc/232-SPEC.md` — 9 locked requirements, boundaries, acceptance criteria (read first)

### Source prototype (port from)
- `dev/mindrian-workroom/src/components/workroom.tsx` — section sidebar + article list + sub-room nav shell
- `dev/mindrian-workroom/src/components/room-home.tsx` — Room Home dashboard layout (governing thought, briefing panel, gaps, section progress)
- `dev/mindrian-workroom/src/components/article-editor.tsx` — BlockNote editor + save + PDF/DOCX export wiring, current `tryParseMarkdownToBlocks`/`blocksToMarkdownLossy` usage
- `dev/mindrian-workroom/src/lib/blocknote-theme.ts` — De Stijl theming for the BlockNote surface
- `dev/mindrian-workroom/src/lib/briefing.ts` — Larry's Briefing prompt/schema design (reuse the prompt/Zod-schema shape; do NOT reuse its Vercel AI SDK transport, per D-06)
- `dev/mindrian-workroom/src/lib/rooms.ts` (`getRoomState`) — source to adapt the ported STATE.md parser from (D-05)

### Existing wiki (keep, extend)
- `commands/wiki.md` — current `/mos:wiki` command definition
- `lib/wiki/wiki-server.cjs` — Express server, existing `/room-assets` static-mount pattern to mirror (D-03)
- `lib/wiki/page-renderer.cjs` — existing read-only markdown-it + `@ig3/markdown-it-wikilinks` renderer
- `lib/wiki/graph-links.cjs` — `getBacklinks`/`getSeeAlso` (D-10, reuse as-is)
- `lib/wiki/wiki-search.cjs`, `lib/wiki/wiki-watcher.cjs`, `lib/wiki/wiki-layout.cjs`, `lib/wiki/wiki-chat.cjs` (stub, out of scope this phase)

### Reuse-before-build sources
- `lib/core/mva-classifier.cjs` (`resolveAnthropicKey`, raw fetch to `https://api.anthropic.com/v1/messages`) — the pattern D-06 reuses for Larry's Briefing
- `lib/core/state-ops.cjs` — the pattern D-05 reuses for deterministic Room Home stats

### Prior wiki planning (historical, informs but does not override this phase)
- `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md` — expanded into this phase; note frontmatter on this file may show its original pre-expansion state (a repo cascade/linter reverted the in-session annotation attempt) — Phase 232 in ROADMAP.md and this CONTEXT.md are the live authority, not this seed file's frontmatter
- `.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md` — SEED-006's companion memo, same read-only-era scope this phase overturns on the editing question
- `.planning/phases/19-wiki-dashboard/WIKIPEDIA-DESIGN-SPEC.md` — locked Wikipedia-zone IA (infobox, backlinks, see-also, red-links)
- `.planning/research/WIKI-PLATFORMS.md` — 2026-03-26 research this phase's delivery-lane decision (SPEC D-01/02/03) is scoped to respect, not overturn, on the server-side lightweight/CJS-only requirement

### Project-level constraints
- `CLAUDE.md` — "CJS only, no TypeScript" / "No server infrastructure" conventions; Tri-Polar Design Rule (CLI/Desktop/Cowork, informs D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/wiki/graph-links.cjs` — `getBacklinks`/`getSeeAlso` reused as-is (D-10), zero new work
- `lib/core/mva-classifier.cjs`'s `resolveAnthropicKey()` + raw-fetch pattern — reused for Larry's Briefing (D-06)
- `lib/core/state-ops.cjs` — reused for Room Home's deterministic stats (D-05)
- `lib/wiki/wiki-server.cjs`'s existing `/room-assets` `express.static` mount — the pattern the new editor bundle's static serving mirrors (D-03)
- `lib/wiki/page-renderer.cjs` + `@ig3/markdown-it-wikilinks` — stays the read-only rendering path (e.g. for `--export`); untouched by the BlockNote work

### Established Patterns
- CJS-only, no-build-step server philosophy (CLAUDE.md) — held intact for the Express server itself; the new client bundle is the one place this phase deliberately adds a build step, walled off in `lib/wiki/editor-src/` with its own `package.json` so it never touches the plugin's own dependency tree (D-02)
- Reuse-before-build (Canon Part 7) — both Room Home sub-questions and the wikilink round-trip question were resolved by verifying and extending existing in-repo mechanisms rather than adopting new ones

### Integration Points
- New `lib/wiki/editor-dist/` compiled bundle mounted into the existing `wiki-server.cjs` Express app
- New wikilink inline-content transforms sit at the BlockNote editor's load/save boundary inside the client bundle, but the file on disk stays literal `[[foo]]` markdown either way (D-07, D-09) — no changes needed to how other tools (Claude Code, the graph indexer, the read-only export path) read wiki articles

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the decisions above — the research agents' concrete
recommendations (exact files, exact function names) are themselves the specifics; see
Canonical References and Decisions.

</specifics>

<deferred>
## Deferred Ideas

- Desktop/Cowork follow-up phase for the MCP `room-wiki` App View (D-11) — explicitly deferred,
  not scheduled
- Click-red-wikilink-to-research, Larry chat WebSocket panel, 9-tier freshness/TTL frontmatter,
  onboarding tour — already deferred to v2 in SPEC.md, restated here for continuity
- Save-conflict detection (mtime/hash checks) — explicitly rejected complexity per SPEC.md,
  not revisited during this discussion

### Reviewed Todos (not folded)
None — no `todo.match-phase` matches were reviewed for Phase 232.

</deferred>

---

*Phase: 232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc*
*Context gathered: 2026-07-19*
