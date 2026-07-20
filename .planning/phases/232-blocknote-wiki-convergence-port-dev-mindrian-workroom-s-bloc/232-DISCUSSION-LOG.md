# Phase 232: BlockNote Wiki Convergence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc
**Areas discussed:** Client bundle build tooling, Wikilink rendering inside BlockNote, Room Home data wiring
**Areas offered but not selected:** Desktop/Cowork follow-up scoping

---

## Gray area selection

Presented 4 phase-specific gray areas (SPEC.md's deferred "how"), multiSelect. User selected 3
of 4, leaving "Desktop/Cowork follow-up scoping" unselected — read as "leave unflagged for now,"
per that option's own description, not as an oversight.

## Client bundle build tooling

Advisor-mode research (opus, minimal_decisive tier) grounded against this repo's existing static-asset
delivery pattern and whether a bundler is already a dependency anywhere in the repo.

| Option | Description | Selected |
|--------|-------------|----------|
| esbuild, manual author-time build, isolated `lib/wiki/editor-src/` + vendored `lib/wiki/editor-dist/`, served via `express.static` mirroring the existing `/room-assets` pattern | Grounded recommendation from the research agent | ✓ |
| Vite (library mode) | Only warranted if HMR-driven widget iteration is wanted — noted as a fallback, not offered as a live alternative in the confirmation gate | |

**User's choice:** Lock esbuild now (fired as its own confirmation gate after the first research
agent returned, ahead of the other two, per a Stop-hook prompt requiring a card that turn —
folded back into the normal advisor-mode flow once the other two agents landed).
**Notes:** None.

---

## Wikilink rendering inside BlockNote

Advisor-mode research (opus, minimal_decisive tier), grounded by direct inspection of the
installed `@blocknote/core@0.51.4` source (import parser + export serializer), not memory.
Confirmed `[[wikilink]]` syntax round-trips byte-identical as plain text either way, which
de-risks both options equally — the real fork is editor-surface UX, not data safety.

| Option | Description | Selected |
|--------|-------------|----------|
| Custom inline content spec (`createReactInlineContentSpec`) renders `[[foo]]` as a clickable pill inside the BlockNote editor; needs a load-time text->node transform and a save-time node->literal-text transform | Literally satisfies SPEC Req 6 ("clickable ... within the BlockNote-based article view") | ✓ |
| Plain bracketed text in the editor, clickable only in a separate read-only render (reusing the existing `page-renderer.cjs` path unchanged) | Zero BlockNote schema work, but only satisfies Req 6 if the article view ends up having a separate preview/read mode | |

**User's choice:** Custom inline content spec (Recommended option).
**Notes:** Backlinks/"See also" panels are BlockNote-independent either way — server-side SQLite
queries via the already-shipped `getBacklinks`/`getSeeAlso`.

---

## Room Home data wiring

Advisor-mode research (opus, minimal_decisive tier) on two sub-questions: deterministic stats
sourcing, and the Larry's Briefing AI-call sourcing. The agent returned direct single
recommendations for both (not real forks) after checking this repo's existing local model-call
patterns and the actual Vercel AI SDK usage in `dev/mindrian-workroom`.

| Sub-area | Recommendation | Selected |
|----------|-----------------|----------|
| Deterministic stats (governing thought, stage, entries, sections, gaps) | Reuse `lib/core/state-ops.cjs` + a small ported STATE.md parser adapted from `rooms.ts::getRoomState` | ✓ (presented as locked, not gated — direct recommendation, no live alternative) |
| Larry's Briefing model call | Reuse the existing raw-`fetch` Anthropic pattern (`resolveAnthropicKey()` -> `api.anthropic.com/v1/messages`, same as `mva-classifier.cjs`); explicitly reject porting the Vercel AI Gateway (`ai` package) approach `dev/mindrian-workroom/src/lib/briefing.ts` uses | ✓ (presented as locked, not gated) |

**User's choice:** N/A — presented as direct recommendations per advisor-mode rule (single
option -> direct recommendation, not a table-choice gate). No objection raised.
**Notes:** The `/vercel:ai-sdk` skill was invoked mid-session by the user; used to independently
verify `dev/mindrian-workroom/src/lib/briefing.ts`'s actual current API usage
(`generateText` + `Output.object`, Zod schema, `anthropic/claude-sonnet-5` via AI Gateway) before
the research agent's own finding landed — both arrived at the same conclusion independently.

---

## Claude's Discretion

- Exact naming/shape of the load-time and save-time wikilink transform functions
- Exact shape of the ported STATE.md parser (adapt from `rooms.ts::getRoomState`)

## Deferred Ideas

- Desktop/Cowork follow-up phase for the MCP `room-wiki` App View — not selected for discussion,
  left unflagged
- Click-red-wikilink-to-research, Larry chat panel, freshness/TTL frontmatter, onboarding tour —
  already deferred to v2 in SPEC.md
- Save-conflict detection (mtime/hash checks) — already rejected in SPEC.md
