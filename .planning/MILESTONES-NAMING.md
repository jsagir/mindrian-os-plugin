---
created: 2026-04-18
driver: Session Six Hats audit on pipeline (phases 87-110). Blue Hat finding — "the pipeline is correct but under-named. It needs release-arc identities or it becomes a todo list instead of a product strategy."
scope: Release arc naming convention for MindrianOS-Plugin versions v1.10.11 through v3.0
method: Each version band gets a named arc, a thesis, a phase cluster, and an external checkpoint
---

# MindrianOS-Plugin Milestone Naming

Version numbers are markers. **Names are commitments.** This document assigns identity to each release arc in the pipeline so every phase has a story it belongs to, not just a version it ships under.

## Why name releases

Three reasons discovered in the Six Hats pipeline audit:

1. **Names create commitment that numbers don't.** "v1.11.0" is a changelog. "Foundation Lock" is a promise — and promises focus execution.
2. **External stakeholders hear names, not numbers.** When Ruvos asks "what's next," "Researcher Wedge in beta now, Wicked Surface in Q3" lands. "v1.11.0-researcher.beta.1 followed by v2.0" does not.
3. **Consolidation phases need identity or they feel like hygiene.** Dead-weight cleanup is boring unless it's part of "The Focused Release." Naming reframes boring work as strategic.

## The naming rule

A good arc name satisfies four tests:

- **Specific** — names the thesis, not a feeling. "Brain Shield" beats "Security Release."
- **Ownable** — a user or investor can say it back to you in a meeting.
- **Inevitable in retrospect** — after the release ships, the name should feel like the only thing it could have been called.
- **Declines gracefully** — if the arc slips, the name still holds. "Foundation Lock" still means something at v1.10.18 even if it should have been v1.10.15.

Banana-ripener names (reject these):
- "v1.11 Release" — not a name.
- "Super Release" — not specific.
- "Mindrian Everywhere" — wrong arc for current scope.
- "The Big One" — performative, not strategic.

---

## The Release Arcs

### Arc 1 — Brain Shield (v1.10.11)

**Thesis:** "The moat cannot fail silently. The foundation is audited and armored."

**Phases:** 87 (Security + Cascade dedup + Localhost Dashboard), 89 (Brain Connectivity Self-Test)

**Why the name:** Adam's silent Brain-not-set failure in the 2026-04-18 transcript is the pivot moment. This release makes that failure mode impossible. Brain unreachability fails loudly at SessionStart. The Cypher injection that external review found gets patched. The nervous system gets its first real refactor.

**What users see:** Session-start banner confirms Brain status. Security posture audited. `/mos:dashboard live` opens a localhost De Stijl dashboard.

**External checkpoint:** Ruvos meeting (Monday 4/20) — demo the self-test trip. Merck follow-up — show the posture.

**Ships:** Target end of April 2026.

---

### Arc 2 — Foundation Lock (v1.10.12 – v1.10.18, brain-normalization milestone)

**Thesis:** "Every graph follows a contract. Every edge has a type. Every Framework has a hirer."

**Phases:**
- Plugin-side: 90 (Brain Client Hardening), 91 (Brain Schema Version Pinning), 92 (Brain Metadata Caching), 93 (Room Graph Edge Schema Lock), 94 (Room Orphan Detection), 95 (Artifact Wikilink Coverage Audit), 96 (Cross-Room Edge Storage), 111 (Cascade Decomposition)
- Brain-side (parallel track, separate repo): Synonym collapse, Lean Canvas rebuild, missing framework backfill, HAS_AGENT wiring, ANALOGICAL_BRIDGE seeding, APOC edge contract

**Why the name:** This is the arc where both graphs acquire integrity contracts. After this ships, orphan nodes cannot enter the Brain, orphan artifacts cannot enter the Room, and every BRIDGE code path is either valid or refuses to run. The foundation is locked.

**What users see:** Almost nothing. This is the most under-visible arc and the most strategically important. Value shows up in fewer silent failures, better framework routing, cleaner exports.

**Risk:** 8+ phases of cleanup without user-visible release notes. Mitigation: ship in visible patches, tell the story in each CHANGELOG ("Brain Client is now defensive against schema drift — here's why that matters to you").

**External checkpoint:** None scheduled. Signal is quality not velocity.

**Ships:** Target ~8-10 weeks after Brain Shield. Mid-summer 2026.

---

### Arc 3 — Researcher Wedge (v1.11.0-researcher.beta.1)

**Thesis:** "Gating opportunities at scale is a different product. Here's the beta."

**Phases:** 94 (Brain-side ANALOGICAL_BRIDGE minimal seeding), 107 (Researcher-Gating Wedge CLI), 105 (Shareable Case-Study Generator), 108 (polish)

**Why the name:** Merck Ventures said they want to triage 1,000 deals/year. Hopkins Tech Transfer wants to evaluate patents. Tony Debora is scheduling Monday meetings. This is a different product running on the same engine. Name it. Ship it. Don't wait for the full moat to be complete.

**What users see:** `/mos:gate <opportunity>` — a one-page "Look further / Pass / Gray zone" verdict with evidence trail. `/mos:case-study <room>` — a Vercel-ready De Stijl deck.

**Degraded acceptable:** If Brain-side analogical bridges are sparse, the gate runs without cross-domain hops. Ship the UI, announce the degradation in the CHANGELOG, invite signal.

**External checkpoint:** Merck follow-up meeting with working beta. Tony Debora demo. Hopkins TTO trial.

**Ships:** Target ~4-6 weeks after Brain Shield. Parallel to Foundation Lock. Can ship early.

---

### Arc 4 — The Closed Loop (v1.13.0)  [RENAMED 2026-05-05]

**Thesis:** "Turn MindrianOS from the back half of a hook into a closed habit loop. First-15-minute imprint. Larry leads. SQL graph remembers. Brain reasons as a constant. Conversation IS the front door. Commands are internals."

**Phases:** 88.2 (UIUX selector block FINISH), 89-07 (ReverseSalientAgent FINISH), 114 (Larry-Default Activation), 115 (Owned Emotion + Dual-Path First Touch), 116 (Unresolved Tension Hook), 117 (Auto-Explore-Domains on First Material), 118 (30-Second MVA + Reward-Before-Investment), 119 (Room-as-Receipt invariant), 120 (Breakthrough Scan / Category G), 121 (Trajectory Telemetry)

**Why the rename (was: "Every Hirer"):** A 4-hour 2026-05-05 deep-dive session combining /mos:think-hats and /mos:beautiful-question recovered a dormant 2026-04-12 Hooked Model audit (27/70 score, "back half of a hook" diagnosis) and synthesized a sharper thesis than the original Every Hirer framing. The new framing absorbs Every Hirer's spirit (per-hirer rendering, JTBD-aware surface) into a deeper structural claim: the product surface should be CONVERSATION FIRST, with rooms emerging as receipts and commands as internals. The Hooked Model math (Trigger near-zero, Loop Closure 3/10 -- the load-bearing gap) is the calibration. The previous Arc 4 phases (100, 101, 102, 103, 105, 106) are absorbed/deferred per the v1.13.0 reconciliation table.

**What users see:**
- Turn 1 = Larry asking for materials OR a surgical question with structured direction
- Auto-explore-domains on first upload -> immediate variable reward
- Tension Hook surfaces contradictions across sessions in Larry's voice
- 30-Second MVA delivers a populated room before the user finishes asking
- Rooms generate as side effects; "create a project" is no longer an explicit step
- Hooked audit re-score target: 27/70 -> 58/70

**Beta progression:**
- v1.13.0-beta.1 SHIPPED 2026-05-05 (Phase 108 + 109 substrate, plugin commit afcea5f, marketplace a37b073)
- v1.13.0-beta.2 "Larry leads" -- Phases 88.2 finish, 89-07 finish, 114, 115, SEED-003 A1+A4
- v1.13.0-beta.3 "Loop closes + reward fires" -- **Phase 110** (PROMOTED FROM v1.14.0 per Path C 2026-05-05), Phases 116, 117, SEED-003 A3
- v1.13.0 final "Full closed loop" -- Phases 118, 119, 120, SEED-003 A2

**beta.1.5 housekeeping interlude (Path C 2026-05-05):**
- AUDIT + RETIRE Phase 111 (Cascade Decomposition; superseded by Phase 87+90+109)
- Phase 112 (GraphRAG retrieval + Room Budding) explicitly DEFERRED to v1.14.0
- Phase 113 (WASM Everywhere spike) confirmed DEFERRED to 2027 (Arc 6) per "do not pull forward"

**Cultural signal:** This arc is where MindrianOS announces "Larry IS the product." The conversation pattern (4-skill substrate: larry-personality + context-engine + room-passive + room-proactive) becomes the default surface, not the gated one. Rooms are receipts. Commands are internals. The architecture stays; the framing flips.

**External checkpoint:** Empathy audit per beta -- 3 fresh testers per intermediate beta, 5 for final (Dror 2.0 protocol). Hooked re-score gates: >= 38 (beta.2), >= 50 (beta.3), >= 55 (final).

**Ships:** Target ~17-24 days from beta.1 ship. v1.13.0 final estimate 2026-05-22.

**Canonical roadmap:** `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md`

**Provenance:** Synthesized in 4-hour 2026-05-05 conversation between Jonathan Sagir and Claude-as-Larry across two parallel sessions. Combined: /mos:think-hats deep-dive on discoverability gap + /mos:beautiful-question deep-dive on first-turn question + recovery of the 2026-04-12 Hooked Model 4-fix audit + capabilities radar pass on Claude Code 2.1.x adoption + foundation audit of phases 88-109. The "Every Hirer" thesis was deemed still command-centric; "The Closed Loop" reframes around conversation-first golden path.

**What of the previous "Every Hirer" plan persists:**
- Per-hirer rendering thinking is absorbed into Phase 115 (Owned Emotion variants per hirer)
- JTBD declarations (was Phase 104) are retained as a precursor for Phase 117 routing
- JTBD inference engine (was Phase 100) defers to v1.14.0 -- now built atop the closed loop, not as a substitute for it
- Selector library JTBD-aware (was Phase 101) defers to v1.14.0
- Zombie command retirement defers; v1.13.0 telemetry data (Phase 121) tells us what to retire

---

### Arc 4.5 — The Visible Room (v1.14.0)  [CLAIMED 2026-05-07; SnapshotHub fused 2026-05-07]

**Thesis:** "Make the invisible visible — inside and outside the room. Wiki for the navigator (internal); SnapshotHub for everyone else (external). One rendering pipeline, two surfaces, same DNA."

**Phases:** Phase 126 NEW (per-room-wiki-completeness, the wiki sprint, 5 sub-plans: 126-01 room resolution wiring; 126-02 graph-as-homepage + auto-create; 126-03 Wikipedia zones + section-to-section hyperlink wiring + cross-room link resolution + RED-LINK rendering; 126-04 click-red-wikilink-to-research + Phase 32-02 chat tool-call wiring; 126-05 9-tier freshness frontmatter + content gap dashboard + multi-layout Cytoscape). Plus Phase 104 FINISH (per-command-jtbd-declarations; 3/4 plans shipped in v1.13.0; 104-00 Wave 0 scaffold completes inside v1.14.0 — FUSED 2026-05-07). Plus deferred from Closed Loop: Phase 124 (JTBD Inference Engine, was 100), Phase 125 (Selector library JTBD-aware, was 101), Phase 112 (GraphRAG retrieval + Room Budding), Phase 123 (SnapshotHub MVP, fused 2026-05-07).

**Why the name:** Arc name comes from Brain's `User Journey Mapping REVEALS "Making the Invisible Visible"` edge — the methodology graph itself returned this phrase as User Journey Mapping's terminal concept (Neo4j Aura query 2026-05-07, Mode A confidence ≥ 0.7). Naming the arc after Brain's own returned edge satisfies Canon Part 6 (Dog-Fooding Mandate): we use the methodology layer to name the work that ships the methodology surface.

**Methodology spine (Brain-validated):** Design Thinking → JTBD (prereq) → User Journey Mapping (PRIMARY METHOD, TYPICAL_AT VentureStage "Opportunity Identified") → Process Mapping for Innovation → Reverse Salient Analysis (already shipped Phase 89). The four `HAS_PROCESS_STEP` nodes Brain returned for User Journey Mapping (Cast a Wide Net / Track Multiple Dimensions / Find Hidden Problems / Follow Workarounds) map 1:1 onto the four user-facing wiki sprint deliverables.

**What users see:**
- `/mos:wiki` resolves to the active room without manual `ROOM_DIR=` override (Lawrence's P1 blocker open since 2026-03-31 finally closed)
- Graph is the homepage of the wiki (not the section index)
- Wiki auto-created when room is created (no separate setup step)
- Section-to-section `[[wikilinks]]` are clickable hyperlinks
- Cross-room `[[../room/section]]` wikilinks resolve correctly
- Unresolved wikilinks render as RED LINK + click triggers research-on-miss (LLM-Wiki pattern adopted, JTBD-filtered)
- WebSocket chat sidebar with tool-call wiring (Larry-in-the-wiki via Phase 32-02)
- Content gap dashboard visualizes what `room-proactive` already detects
- 9-tier freshness frontmatter shows "is this still true?" per artifact
- All of it in De Stijl, 12-glyph, no-emoji, Bebas Neue + system-ui (Phase 21 brand discipline)

**External checkpoint:** **Lawrence Aronhime tester preview is a HARD release gate per Canon Part 6 (Dog-Fooding Mandate).** Without his sign-off on a multi-room install confirming all 6 user-facing behaviors above, v1.14.0 ships only beta — not final. He is the canonical user-finder for wiki UX bugs (he found the original P1 blocker on 2026-03-31).

**Cultural signal:** This arc finishes the Wikipedia-style wiki promised in Phase 19 + 03.1 (March 2026), takes the 5 LLM-Wiki patterns that serve wicked-navigator JTBDs, discards the 6 patterns that don't, and makes the room visible as a navigable artifact instead of a text-search target. Brand discipline + JTBD orientation is the moat, not feature parity with consumer-grade note-taking plugins.

**Ships:** Target ~8 working days from sprint kickoff at Phase 82 cadence. v1.14.0 final estimate: ~2-3 weeks after Path C closes (Phase 110 + 114 merged to main), depending on Lawrence preview turnaround.

**Canonical artifacts:**
- Seed: `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md`
- Memo: `.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md`
- Companion (in mindrianOS room): research/, competitive-analysis/, team-execution/

**Provenance:** User reaction to LLM-Wiki repo (github.com/Oshayr/LLM-Wiki) on 2026-05-06 — "I tried such a wiki with /mos:wiki and wikilinks but this one looks better" — triggered competitive review + Brain methodology query + 13/13 validation pass + 4-layer protection lock planted 2026-05-07.

---

### Arc 5 — Wicked Surface (v2.0)

**Thesis:** "The three meta-jobs nobody else ships. Rejection becomes data. Sessions have history. Answers are triangulated."

**Phases:** 99 (Rejection-as-Data Capture), 100 (Session-Diff View), 101 (Model-Triangulation Mode), 97 (Framework Metadata Injection), 98 (Analogical Bridge Write-Through)

**Why the name:** Rittel & Webber's ten characteristics of wicked problems (1973) describe ventures. Until this arc, MindrianOS ships frameworks that address wicked problems. This arc ships the three META-JOBS that only make sense for a wicked-problem system: capture reformulation, track belief change over time, triangulate across explanations. No competitor has these. They are the moat beyond the moat.

**What users see:** When they correct Larry, the correction persists. When they return after three weeks, they see what changed. When they ask Larry something hard, they can triangulate across models.

**Cultural signal:** This is MindrianOS declaring itself as wicked-problem management software, not a framework catalog. The theoretical foundation from CLAUDE.md becomes user-visible.

**External checkpoint:** Academic usage — Lawrence cohort uses it through a full semester. Publication opportunity (CLAUDE.md's theoretical foundation is a genuine academic contribution).

**Ships:** Target late 2026 / early 2027.

---

### Arc 6 — Everywhere (v3.0)

**Thesis:** "MindrianOS without Claude Code. Hosted, multi-user, browser-first."

**Phases:** 109 (Multi-User Collaboration Real), 110 (UI Independent of Claude)

**Why the name:** Lawrence's "students won't abandon ChatGPT" constraint. The hosted browser surface that doesn't require a Claude Code install. The real multi-user layer (not OneDrive workaround). This is where MindrianOS stops being a plugin and becomes a platform.

**What users see:** `mindrian.ai/app` — a hosted surface. No install required. BYO API key. Same Mondrian dashboard, same Brain, same Room, but accessible anywhere.

**Cultural signal:** This is the "students and VCs alike" moment. Distribution expands beyond the CLI-comfortable cohort.

**External checkpoint:** Merck production usage. Hopkins classroom trial. First paid institutional contract.

**Ships:** Target 2027. Explicitly deferred from earlier arcs. Do not pull forward.

---

## Summary Table

| Version | Arc Name | Thesis (one line) | Phase Cluster | Checkpoint |
|---------|----------|-------------------|---------------|------------|
| v1.10.11 | **Brain Shield** | Moat cannot fail silently | 87, 89 | Ruvos, Merck demo |
| v1.10.12–.18 | **Foundation Lock** | Every graph follows a contract | 90-96, 111 | Quality over velocity |
| v1.11.0-researcher.beta | **Researcher Wedge** | Gating opportunities is a different product | 94, 107, 108 | Merck, Tony Debora, Hopkins TTO |
| v1.13.0 | **The Closed Loop** | Back half of a hook -> closed habit loop, first-15-min imprint | 88.2, 89-07, 114-121 | Empathy audit per beta, Hooked re-score 27 -> 58 |
| v1.12.0 | **Every Hirer** *(absorbed/deferred -- see Arc 4 rename note)* | Surface knows its user | (100, 101 deferred to v1.14.0; 102, 104, 105 absorbed into Closed Loop) | (rolled into Closed Loop) |
| v1.14.0 | **The Visible Room** | Make the invisible visible -- inside and outside the room. One renderer, two surfaces (Wiki + SnapshotHub), same DNA | 126 NEW wiki sprint (5 sub-plans) + 104 FINISH (104-00 Wave 0; 104-01/02/03 shipped v1.13.0) + 124 (JTBD Inference, was 100) + 125 (Selector JTBD-aware, was 101) + 112 (GraphRAG + Room Budding) + **123 (SnapshotHub MVP, fused 2026-05-07)** + SEED-001/003-A5/004/006 | Lawrence Aronhime tester preview HARD release gate (Canon Part 6) |
| v2.0 | **Wicked Surface** | Three meta-jobs nobody else ships | 97-101 | Semester cohort trial, publication |
| v3.0 | **Everywhere** | MindrianOS without Claude Code | 109-110 | First paid institutional contract |

## Naming Protocol

### When to name a new arc

Not every phase needs an arc. Name an arc when:
1. Three or more phases share a thesis
2. The arc spans two or more version numbers
3. There is an external checkpoint (user, investor, cohort) scheduled

Under those conditions — name it or the work becomes formless.

### How to announce an arc

Each arc announcement is three lines max:

```
Arc [N]: [Name]
Thesis: [one sentence]
Ships: [version band] [target date]
```

Published in `CHANGELOG.md` at arc kickoff, not arc end. Announcing at start creates accountability.

### What to do when an arc slips

Slippage is expected. Renaming is not. Do not rename an arc to hide slippage. "Foundation Lock delivered in 10 weeks instead of 8" is a fact. "The Super Focused Release delivered on time" is a lie.

If scope changes, spawn a new arc. Do not redefine an existing one.

## Cross-Arc Rules

1. **Arcs 1 and 3 can run in parallel.** Brain Shield is security/foundation; Researcher Wedge is product. Different code paths, different release trains. Do not wait for Arc 1 to finish before starting Arc 3.
2. **Arcs 2 and 4 must NOT run in parallel with Arc 5.** Foundation Lock and Every Hirer are prerequisite to Wicked Surface. Sequential.
3. **Arc 6 is deferred by charter.** Product pressure will try to pull it forward. Resist until Arcs 1-5 ship. Add to roadmap as "v3.0 — Everywhere (deferred)" with explicit date marker.

## Related artifacts

- `.planning/ROADMAP.md` — phase-level detail
- `.planning/REVIEWS/2026-04-18-six-hats.md` — the audit that drove this naming
- `.planning/phases/111-cascade-decomposition/111-CONTEXT.md` — the new phase surfaced in the same audit
- `docs/BACKEND-MAP.md` — the graph-owner classification underpinning Arc 2 (Foundation Lock)
- `CHANGELOG.md` — where each arc gets formally announced at kickoff
