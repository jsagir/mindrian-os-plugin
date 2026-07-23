---
kind: seed
status: navigator-chosen-direction
navigator_decision: "2026-07-21: 'this is the one direction I'll go with' -- confirmed after the SEED-066/071 correction (i.e. chosen WITH the correction applied: no Docmost/AFFiNE, BlockNote xl-* is GPL not MIT, MarkItDown sequenced behind SEED-034, MCP Apps treated as distinct from SEED-065's pure-MCP ceiling until verified otherwise). Not yet scoped into a phase or milestone -- still a chosen direction, not an active build."
severity: medium
created: 2026-07-20
canon_parts: [7, 8, 10, 11]
related: [SEED-006 (mindrian-wiki-sprint -- the visible room), SEED-034 (room.db never populated -- CRITICAL, still open, outranks everything here), SEED-065 (mcp ceiling -- adjacent, not identical, to MCP Apps), SEED-066 (collaborative-shell licence findings -- AUTHORITATIVE on Docmost/AFFiNE/BlockNote-xl-*/Hocuspocus licensing), SEED-067, SEED-068, SEED-069 (open-core / host-agnostic / subscription-passthrough -- the "local + hosted product" question), SEED-070 (live eureka run, stale bytes), SEED-071 (MarkItDown + LangExtract -- AUTHORITATIVE on MarkItDown sequencing), Phase 232 (BlockNote Wiki Convergence -- SHIPPED v1.15.3-beta.32, 2026-07-20, the same session this seed was planted in), SEED-072-guide (2026-07-21 BlockNote primary-source guide -- FOSDEM maintainer talk + Next.js integration tutorial, primary-source extension of Open Question #6), SEED-073 (2026-07-22, filesystem-canonical / Yjs+RxDB-are-disposable-projections -- answers this seed's Open Question #6 against real code, closes Open Question #3 on RxDB plugin licensing, and confirms the RxDB-sits-on-SQLite pitch in the 2026-07-20 handoff needs its Pro tier unless re-scoped as a query-populated cache)]
proving_case: "Navigator pasted external (GPT-5.4 / Deep Research) market research on collaborative editors (BlockSuite, BlockNote, Tiptap+Hocuspocus, Plate, Milkdown, Docmost, AppFlowy) and a local-first stack proposal (RxDB + SQLite + MCP Apps + ICM/Feyminto), asked it filed as UI/UX research for MindrianOS to assess itself. Filed, then found -- one turn later, only because the navigator asked 'is it seeded?' and that prompted a reuse-before-build check -- that SEED-066 and SEED-071 already cover the licensing and MarkItDown-sequencing ground more authoritatively than the fresh research does."
source: "Session 2026-07-20, same session Phase 232 (BlockNote Wiki Convergence) was built, merged, and released. Filed as a room research entry first (Canon Part 7 miss -- did not check .planning/seeds/ before filing); this seed exists to make sure a future assessment starts from the existing cluster, not from the fresh research alone."
---

# SEED-072: Collaborative-editor stack handoff -- defers to SEED-066 and SEED-071, does not duplicate them

## What's actually open

Nothing decided. This seed is a **pointer, not a new finding** -- its entire job is to stop a
future assessment session from re-deriving licensing or MarkItDown-sequencing conclusions that
SEED-066 and SEED-071 already settled two days earlier, and from missing SEED-034's blocking
priority.

**Trigger:** any session that touches collaborative multiuser editing, RxDB, MCP Apps embedding of
the wiki into Claude Desktop/Cowork, or MarkItDown/ingestion-agent work.

## The durable research

`~/MindrianRooms/rethinking-mindrianos/research/2026-07-20-collaborative-editor-and-local-first-stack-handoff/`
-- external market survey (Tiptap+Hocuspocus, Plate.js, Milkdown, BlockSuite mechanics, AppFlowy,
plus a proposed RxDB/SQLite/MCP-Apps/ICM-Feyminto layered architecture) with a correction block
added at the top after this seed's own reuse-before-build check. Read the correction block first;
it is more load-bearing than the body.

## Primary-source addition (2026-07-21)

A second research entry now sits beside the 2026-07-20 survey: two transcript sources filed as one
guide -- a FOSDEM-style conference talk by BlockNote's own maintainers (a 2025 look-back plus a 2026
roadmap) and a hands-on Next.js + BlockNote + UploadThing integration tutorial. Unlike the external
GPT-5.4 Deep Research summary the 2026-07-20 entry was built from, this is primary-source material
straight from the people who build BlockNote. It partially extends Open Question #6 of that entry and
confirms Yjs as BlockNote's native collaboration substrate -- the maintainers are already prototyping
suggestion/versioning mode with Yjs's own creator Kevin Jahns, the exact direction MindrianOS would
be betting on. Two implementation details land for the cluster's "station blocks" concept: BlockNote's
`uploadFile` config function is the hook point for wiring file/image storage into custom blocks, and
BlockNote must be dynamically imported client-side-only in Next.js (`next/dynamic` + `{ssr:false}`) or
it hydration-errors. This does NOT change or re-litigate SEED-066's licensing findings or SEED-071's
MarkItDown sequencing; see the guide at
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-21-blocknote-primary-source-guide/2026-07-21-blocknote-primary-source-guide.md`
for full detail.

## What a future assessment must NOT re-litigate (already settled)

1. **Docmost and AFFiNE are disqualified for a commercial closed-source product** (SEED-066:
   AGPL-3.0 §13 network clause / proprietary EE-licensed sync server respectively). Do not propose
   either as a "fast path product shell" again without a new, explicit argument for why SEED-066's
   finding no longer applies (e.g. a licence change upstream, re-verified against the actual
   LICENSE file, not a blog summary).
2. **BlockNote's `xl-*` export packages are GPL-3.0**, not MIT (SEED-066). Phase 232 already
   independently avoided them (substituted MIT `pdfmake`+`docx`) -- any future BlockNote work
   should cite SEED-066 for this, not rediscover it.
3. **MarkItDown adoption is sequenced behind the extraction-gate fix and SEED-034** (room.db never
   populated, CRITICAL, still open) -- per SEED-071's own explicit ordering. Do not scope an
   ingestion agent ahead of that sequencing.
4. **MCP Apps (the `ui://` UI extension) is a different capability from what SEED-065 tested and
   disqualified** (pure-MCP persona/proactivity, which needs unsolicited server-to-client pushes
   SEP-2260 forbids). MCP Apps' `postMessage` bridge is user/UI-initiated, not a server push. This
   seed does NOT claim MCP Apps is clear of SEED-065's ceiling -- it only notes the two are not the
   same question, and a future assessment must make that distinction explicitly, not assume either
   way.

## What's genuinely new in the fresh research (not already covered by 062-071)

- The specific RxDB-as-reactive-plumbing-layer-over-existing-SQLite architecture proposal, and its
  "what RxDB replaces vs. what stays with ICM/Feyminto" table.
- The observation that Phase 232 (shipped this same session) already answers "which editor" --
  BlockNote, pinned `0.51.4`, verified byte-safe markdown round-trip, working wikilink-pill
  load/save transform -- so the open question is narrower than the external research assumed: does
  layering Hocuspocus/Yjs collaboration on top of the ALREADY-SHIPPED editor conflict with or
  extend that save contract, not "which editor to pick."
- The comparison-matrix survey of Tiptap+Hocuspocus, Plate.js, and Milkdown specifically (SEED-066
  covered BlockSuite, BlockNote, AFFiNE, Docmost, OpenHands licensing but not this narrower editor
  comparison).

## Consequence

No action implied. This is a filing-hygiene correction, not a technical decision. When the
collaborative-workspace milestone (SEED-066's own trigger) actually gets picked up, start from
SEED-066 + SEED-071 + SEED-034's sequencing, treat the 2026-07-20 research entry as supplementary
survey material only, and resolve the MCP-Apps-vs-SEED-065 distinction explicitly before assuming
either way.
