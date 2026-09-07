---
id: SEED-091
status: dormant
planted: 2026-09-07
planted_during: rethinking-mindrianos Data Room session -- "what would a real MindrianOS UI need" (login, tenant DB, embeddings, local graph)
trigger_when: "when auth + a tenant datastore for mindrian-workroom becomes an active engineering priority (a milestone, a `/gsd-new-project`-equivalent kickoff for that repo, or the navigator says 'let's build the real UI now'); also worth a look whenever SEED-006's collaborative-editing siblings (SEED-066/072/073) get revisited, since they're the layer immediately after this one"
scope: medium
---

# SEED-091: Resume `dev/mindrian-workroom` -- it's the real UI, already built, just missing auth and a tenant DB

## Why This Matters

Not a new idea -- a rediscovery, checked live rather than assumed. The navigator asked what a
real MindrianOS UI (login, tenant DB, embeddings, local graph work) would need. The honest answer
turned out to already exist, mostly built, sitting untouched.

**The precedent that already settled this, in the navigator's own recorded words.** `research/
2026-07-19-blocknote-wiki-convergence` (rethinking-mindrianos Data Room) -- filed the SAME day
`dev/mindrian-workroom` was ratified -- records a real `superpowers:brainstorming` session (four
approved gates) that deliberately split the BlockNote work by surface: `/mos:wiki` stayed
Express/CJS (ported via Phase 232, closed 2026-07-20), while `dev/mindrian-workroom` was
explicitly, on the record, kept alive: *"not retired -- it keeps proving out the hosted/Cowork
multi-user surface separately."* And at Phase 232's own close: *"`dev/mindrian-workroom` remains
untouched and unretired throughout -- it stayed the UX/interaction reference and is still the
standing prototype for the eventual Cowork/hosted surface."* This was never a stalled contradiction
between "build MCP Apps" (the April `MCP-APPS-STRATEGIC-RESEARCH.md` recommendation) and building
a standalone app -- it was a coordinated, intentional split, decided the same day, that a
surface-level read of the docs alone missed.

**Confirmed alive and real, 2026-09-07 (not assumed from docs).** `npm run dev` in
`dev/mindrian-workroom`: Next.js 16.2.10 + React 19.2.4 + BlockNote (core/mantine/react +
xl-docx-exporter + xl-pdf-exporter), ready in 429ms, serving real content. Navigated it live via
Playwright: the room-grid dashboard renders all 32 real rooms (55 incl. sub-rooms) with real
stages and sub-room counts; `/room/rethinking-mindrianos` renders THIS room's actual live
STATE.md -- 13 entries, the exact "explore your market to move to Discovery stage" suggestion,
even an artifact filed earlier in this same session showing up in its sidebar. It reads and
writes real room `.md` files via API routes, not a mock. Already deployed to Vercel once (real
project ID on disk, `.vercel/project.json`). Last touched 2026-07-18 -- parked, not abandoned.

**What's actually missing, confirmed by inspection, not guessed.** `.env.local` has exactly one
key (`VERCEL_OIDC_TOKEN`) -- no Supabase, no auth provider, nothing. `README.md` is still the
unedited `create-next-app` default. The app reads the local filesystem directly
(`~/MindrianRooms/*`) -- there is no tenant concept at all, because there's exactly one implicit
user: whoever is running it locally. Everything else -- the editor, the export pipeline, the
Room Home dashboard, the De Stijl visual language -- already works.

**A mockup of the target end-state exists**, published as a Claude Artifact 2026-09-07 ("Workroom,
Signed In"), traced from live screenshots of the running app -- not invented. Three screens: a new
sign-in screen, the existing room-grid dashboard plus a new org/user bar, and the existing room
detail view completely unchanged (proof the auth layer doesn't need to touch the parts that
already work).

**Vendor research already done, not left to re-litigate.** Lovable (AI app builder) was evaluated
live and rejected as a build vehicle: its stack is React + Vite (not Next.js), and its GitHub
model has no existing-repo import -- confirmed via its own migration docs ("no one-click Next.js
export... migrate manually"). Pointing it at this repo means abandoning the already-built,
already-verified work. If an AI-assisted flow is wanted for the isolated auth/Supabase slice, `v0`
(Vercel's own builder) is the one that actually fits this stack -- Next.js-native, explicitly
imports existing repos, PR-to-main. Supabase (Auth + Postgres with row-level security) is the
concrete target for the two missing pieces themselves.

**A capability reference already lives in the repo.** `dev/mindrian-workroom/docs/
CLAUDE-CAPABILITIES.md` (linked from `AGENTS.md`) maps which skills (`supabase:supabase`,
`supabase:supabase-postgres-best-practices`, `vercel:nextjs`, `security-review`,
`fullstack-dev-skills:api-designer`, `fullstack-dev-skills:database-optimizer`), subagents, and
MCP servers are actually load-bearing for this specific build -- including the honest gap that
`mcp__plugin_vercel_vercel` and `mcp__plugin_supabase_supabase` currently expose only
`authenticate`, not their full action surface, until that handshake runs.

## The one real open decision (deliberately not resolved here)

Does a tenant's room graph stay a SQLite file materialized to object storage (Supabase becomes
index/control-plane only -- keeps the "delete the `.db`, rebuild from files" invariant this
repo's own ICM doctrine already relies on, and matches SEED-073's independent ruling that
CRDT/RxDB layers must stay disposable projections over a canonical filesystem), or does the room
graph itself move into shared multi-tenant Postgres (simpler ops, simpler cross-tenant queries,
but breaks that invariant)? Not decided -- correctly left open, same discipline as SEED-082 and
SEED-090.

## When to Surface

**Trigger:** when auth + tenant DB for `dev/mindrian-workroom` becomes an active engineering
priority, or when SEED-006's collaborative-editing siblings (SEED-066/072/073 -- real-time
multi-user editing, a layer strictly AFTER login+tenant-DB, not before it) get revisited.

## Scope Estimate

**Medium.** Not a rebuild -- the app, the editor, the export pipeline, and the visual identity
are already done and verified. The real work is: (1) Supabase Auth wiring, (2) a tenant/room
control-plane schema with correct RLS, (3) refactoring the app's data-access layer off "read the
local filesystem" onto "read this tenant's room" -- a real but bounded surface, not a new product.

## Addendum (2026-09-07) -- OpenCode checked as a possible foundation, rejected on the same axes as AgentOS; one idea kept

Navigator asked directly: "can we use OpenCode to build a Mindrian?" Checked live via Tavily, not
assumed -- OpenCode (MIT, sst/anomaly, 150k+ stars) is a Go-TUI + Bun/JS-server client-server AI
coding agent, model-agnostic across 75+ providers.

**Verdict: reject as a foundation/runtime, on the identical four axes that killed AgentOS as a
foundation** (`research/2026-07-05-rebuild-vs-surgery/03-ignite-persona-ui-agentos.md`) --
arguably a sharper collision this time, since OpenCode is a direct category competitor to Claude
Code itself, not an adjacent orchestration framework:
1. **Delivery model** -- adopting it means Mindrian stops being a Claude Code plugin and becomes a
   fork of a competing agent CLI. Bigger collision than AgentOS's (a different category), because
   this one replaces the actual host Mindrian lives in today.
2. **Runtime** -- two full agent loops competing for the same job, not a small workflow layer vs.
   an orchestration add-on.
3. **Stack** -- Go + Bun/JS vs. this repo's hard CJS-only / no-build-step / markdown+bash rule.
4. **Moat** -- OpenCode is a coding-agent (LSP diagnostics, git-snapshot undo, file edits); has zero
   relationship to Theo/the teaching graph. Building on it advances nothing this repo actually
   protects.

**What's worth keeping, same "steal the idea, not the dependency" move as the AgentOS verdict:**
OpenCode's client-server split -- one server, N clients (TUI/web/desktop/IDE) attached
concurrently without clobbering each other's state -- is a real, production-proven answer to the
exact gap SEED-039 names and Phase 198 needs. Cross-linked there, not duplicated here.

## Breadcrumbs

- `dev/mindrian-workroom` -- the real repo (Next.js 16 / React 19 / BlockNote, deployed to Vercel
  once, `.vercel/project.json` present)
- `dev/mindrian-workroom/docs/CLAUDE-CAPABILITIES.md` -- the skills/tools reference for this
  specific build, linked from `AGENTS.md`
- `research/2026-07-19-blocknote-wiki-convergence/2026-07-19-blocknote-wiki-convergence.md`
  (rethinking-mindrianos) -- the precedent that already ratified keeping this repo alive
- `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` -- the April recommendation this split
  reconciles with, not contradicts
- `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md` -- superseded/closed via
  Phase 232 (the CLI-native half of the same split)
- `.planning/seeds/SEED-066-...affine-and-docmost-disqualified.md`,
  `SEED-072-collaborative-editor-stack-handoff-defers-to-066-and-071.md`,
  `SEED-073-filesystem-canonical-crdt-and-rxdb-are-disposable-projections.md` -- the
  real-time-collaboration layer that comes after this seed, not instead of it
- Mockup artifact: "Workroom, Signed In" -- three-screen mockup (sign-in, org-aware dashboard,
  unchanged room detail), published 2026-09-07, traced from live screenshots of the running app
- Per this room's Dev-Research Compositing rule, also filed as a research entry in
  `rethinking-mindrianos/research/`

## Notes

Planted at the navigator's explicit request ("save this as seed") rather than left as
conversation. The underlying decision isn't new -- 2026-07-19 already made it. This seed exists
so the NEXT session doesn't have to re-discover that fact from scratch, the way this one had to.
