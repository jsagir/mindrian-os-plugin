---
id: SEED-006
status: expanded-into-phase-232
expanded_into: Phase 232 (BlockNote Wiki Convergence)
expansion_correction: |
  2026-07-19: this seed's Phase 104/126 number reservation (see
  phase_number_correction below) went stale a second time -- Phase 126 was
  claimed by the unrelated, already-shipped install-lifecycle-harness-gaps
  phase while ~230 other phases shipped past this dormant seed. Registered
  live as Phase 232 via /gsd-phase after a superpowers:brainstorming session
  with Jonathan that also overturned this seed's original READ-ONLY scope
  (see .planning/research/WIKI-PLATFORMS.md's "never add an editor" verdict):
  the source prototype is dev/mindrian-workroom ("the blocknote test"), a
  BlockNote-powered editing surface Jonathan wants ported in. Locked
  decisions folding INTO this seed's scope, not replacing it: (1) delivery
  lane is "split by surface" -- /mos:wiki stays Express+CJS zero-build, adds
  a prebuilt BlockNote client bundle (no Next.js vendored into the plugin;
  mindrian-workroom keeps existing separately as the Cowork/hosted-surface
  prototype); (2) Room Home (governing thought, Larry's Briefing, gaps,
  section progress) becomes the wiki landing page, REPLACING graph-as-
  homepage -- this deliberately overturns the Phase 19 mandate this seed
  itself reaffirmed below; (3) always-editable, direct save-to-disk, no
  conflict/mtime-check machinery for v1 (risk accepted, not solved); (4) v1
  keeps workroom's existing feature set as-is and ports in wikilinks +
  backlinks/see-also + search + graph-as-tab + theme toggle + static export
  from today's /mos:wiki; the rest of this seed's finish-items (red-link-
  to-research, chat panel, freshness tiers, onboarding tour) stay deferred
  to v2, unchanged from this seed's original scoping. Phase 232 is the
  live authority going forward; this file is preserved as the historical
  reasoning trail per Dev-Research Compositing convention.
status_pre_expansion: scheduled-v1.14.0
planted: 2026-05-07
planted_during: post-LLM-Wiki competitive review session
target_milestone: v1.14.0
arc_name: The Visible Room
ordering_constraint: depends-on-Path-C-ship (Phase 110 + Phase 114 both merged to main)
trigger_when: |
  Surface during /gsd:new-milestone or /gsd:plan-phase if ANY of:
  - Phase 110 (brain-context-packet-contract) AND Phase 114 (larry-default-activation) BOTH merged to main
  - User runs /gsd:new-milestone v1.14.0 (or /gsd:new-milestone with v1.14.x flag)
  - User explicitly says "expand the wiki sprint memo into Phase 126 CONTEXT"
  - A new tester reports wiki UX issue (recurrence of Lawrence's 2026-03-31 P1 blocker class)
  - Lawrence Aronhime asks about wiki state or sub-room navigation
  - Any phase in beta touches scripts/serve-wiki, lib/wiki/*, scripts/serve-dashboard*, dashboard/*, lib/vault/wikilink-builder.cjs
phase_number_correction: |
  Originally drafted as "Phase 104 revival" against the empty
  104-per-command-ui-wrapping placeholder directory. On 2026-05-07 evening,
  audit revealed Phase 104 is allocated to per-command-jtbd-declarations
  (3/4 plans shipped in v1.13.0; 104-00 Wave 0 pending). The empty
  placeholder was removed. Wiki sprint reassigned to Phase 126 (next
  available; 122 = Researcher Wedge, 123 = SnapshotHub, 124 = JTBD
  Inference, 125 = Selector JTBD-aware are claimed). Phase 104 finishing
  is FUSED into v1.14.0 as foundational completion (104-00 Wave 0 is the
  first plan to land in v1.14.0-beta.1).
scope: large
bundle: visible-room-wiki
estimated_effort: ~8 working days at Phase 82 cadence
canon_parts: [Part 1, Part 3, Part 6]
related_phases: [110, 114]
related_seeds: [SEED-015]
ecc_cross_learning: |
  SEED-015 (selective install profile system, planted 2026-05-24 from ECC v1.9.0
  learning) ENABLES this seed's clean shipping path. The wiki surface ships as
  `--with wiki` opt-in rather than forced-on-every-install. Non-wiki users
  don't pay the surface cost; wiki users opt in explicitly. Materially lowers
  the "feature buffet" critique Aryeh raised in his 2026-05-20 session. The
  wiki sprint should NOT ship until selective install lands OR until the
  wiki is feature-gated some other way.
dependents:
  - Phase 117 (Auto-Explore-Domains on First Material) -- v1.13.0-beta.3 ships first; its findings surface in The Visible Room wiki when v1.14.0 lands
  - Phase 118 (30-Second MVA + Reward-Before-Investment) -- v1.13.0 final ships first; the MVA-generated room IS the artifact the wiki renders
  - Phase 121 (Trajectory Telemetry) -- emits events that may include wiki interaction signals; coordinate at scoping
fused_into_v1_14_0:
  - Phase 123 (SnapshotHub MVP) -- fused 2026-05-07 evening because wiki and SnapshotHub share renderer DNA (same markdown source, same page-renderer.cjs, same graph-links.cjs, same markdown-it-wikilinks plugin, same De Stijl tokens). dashboard/export-template.html (2462 lines, shipped) already proves one pipeline serves both audiences. SnapshotHub IS the wiki going public.
methodology_spine: |
  Brain-validated 2026-05-07 via Neo4j Aura (Mode A, confidence >= 0.7):
  Design Thinking -> JTBD (prereq) -> User Journey Mapping (PRIMARY METHOD,
  TYPICAL_AT VentureStage 'Opportunity Identified', REVEALS 'Making the
  Invisible Visible') -> Process Mapping for Innovation -> Reverse Salient
  Analysis (already shipped Phase 89). The 4 HAS_PROCESS_STEP nodes Brain
  returned for User Journey Mapping (Cast a Wide Net / Track Multiple
  Dimensions / Find Hidden Problems / Follow Workarounds) map 1:1 onto the
  4 user-facing wiki sprint deliverables.
release_gate_lawrence_preview: HARD (per Canon Part 6 Dog-Fooding Mandate)
---

# SEED-006: Mindrian Wiki Sprint — "The Visible Room"

## Why This Matters

The wiki we promised in Phase 19 (March 2026) and 03.1 has shipped substrate
(`lib/wiki/` 7 modules, `scripts/serve-wiki`, `dashboard/index.html`,
`@ig3/markdown-it-wikilinks`, `lib/wiki/graph-links.cjs::getBacklinks +
getSeeAlso`, vault-side wikilink injector with 6 link types) but never landed
the user-facing finish:

- **Lawrence's P1 blocker** open since 2026-03-31 (`scripts/serve-wiki`
  hardcodes `ROOM_DIR=./room` — broken on every multi-room setup). Note: the
  `scripts/resolve-room` 4-strategy resolver SHIPPED between 2026-03-31 and
  2026-05-07 and is in production use across 13+ scripts; the gap is INTEGRATION
  into `serve-wiki` / `serve-dashboard` / `serve-presentation`, not implementation.
- **Phase 19 mandates not shipped:** "Graph view is the HOME PAGE of the wiki"
  (line 42); "Wiki gets BUILT IMMEDIATELY when a project room is created (MANDATORY)"
  (line 23); both live in `.planning/phases/19-wiki-dashboard/19-CONTEXT.md`.
- **WIKIPEDIA-DESIGN-SPEC zones not shipped:** infobox sidebar, "what links here"
  backlinks panel, "see also" from INFORMS/ENABLES edges, red-link gap indicators
  (`.planning/phases/19-wiki-dashboard/WIKIPEDIA-DESIGN-SPEC.md`).
- **LLM-Wiki shipped a polished consumer reference** (github.com/Oshayr/LLM-Wiki,
  38 stars, 2026-04-26). User reaction 2026-05-06: "I tried such a wiki with
  /mos:wiki and wikilinks but this one looks better." LLM-Wiki proves the bar;
  Mindrian's gap is assembly + polish + correctness, not new architecture.

## Why "The Visible Room"

The arc name comes from Brain's `User Journey Mapping REVEALS "Making the
Invisible Visible"` edge — the Neo4j methodology graph itself returned this
phrase as the framework's terminal concept. Naming the arc after Brain's
own returned edge satisfies Canon Part 6 (Dog-Fooding Mandate): we use
the methodology layer to name the work that ships the methodology surface.

Four-test compliance per `.planning/MILESTONES-NAMING.md`:
- **Specific:** visibility, not abstract polish.
- **Ownable:** Lawrence can say it back ("the visible room sprint").
- **Inevitable in retrospect:** the wiki was always going to ship visibility.
- **Declines gracefully:** still meaningful at v1.14.5 if it slips.

## What We TAKE from LLM-Wiki (5 patterns, JTBD-filtered)

1. Click-red-wikilink-to-research (highest leverage)
2. WebSocket chat sidebar with tool-calls (Larry-in-the-wiki via Phase 32-02)
3. Content gap dashboard (visualize what `room-proactive` already detects)
4. 9-tier freshness/TTL frontmatter
5. Multi-layout Cytoscape with clustering + neighborhood highlighting

## What We DO NOT Take (6 patterns, off-JTBD)

4 themes, canvas/whiteboard, FSRS spaced repetition, daily notes/journal,
frontmatter SQL query language, per-agent Sonnet/Haiku frontmatter (last
belongs in a separate cost-of-goods sweep).

## What We FINISH from Phase 19 (5 long-promised items)

Wikipedia-zone information architecture + section-to-section [[wikilink]]
hyperlink wiring (audit + cross-room resolution + RED-LINK rendering for
unresolved); graph-as-homepage; auto-create-on-new-project; talk-page =
REASONING.md per section; light/dark theme toggle persisted to localStorage.

## Hard Release Gate: Lawrence Preview

Per Canon Part 6 (Dog-Fooding Mandate): v1.14.0 final does NOT ship without
Lawrence Aronhime previewing the wiki on a multi-room install (multiple rooms
under `~/MindrianRooms/`, including at least one nested-path room like
`mindrian/mindrianOS`) and confirming:

1. `/mos:wiki` resolves to the active room without manual `ROOM_DIR=` override
2. Section-to-section `[[wikilinks]]` are clickable hyperlinks
3. Cross-room `[[../room/section]]` wikilinks resolve correctly
4. Unresolved wikilinks render as RED LINK + click triggers research
5. Graph is the homepage (not the section index)
6. Wiki was auto-created when the room was created

Without all 6 confirmations, v1.14.0 ships only beta — not final.

## Scope Estimate

**Medium-Large** — ~8 working days at Phase 82 cadence (5 sub-plans under revived Phase 104).

Sub-plan breakdown (proposed; lock at /gsd:plan-phase time):

| Plan | Deliverable | Effort |
|------|-------------|--------|
| 104-01 | Wire EXISTING `scripts/resolve-room` into serve-wiki, serve-dashboard, serve-presentation + ANSI strip + diagnostic empty-state | 0.5 day |
| 104-02 | Graph as homepage + auto-create on `/mos:new-project` (Phase 19 mandates) | 1 day |
| 104-03 | Wikipedia zones + section-to-section [[wikilink]] hyperlink wiring + cross-room link resolution + RED-LINK rendering | 2 days |
| 104-04 | Click-red-wikilink-to-research + Phase 32-02 chat tool-call wiring (`window.__mosChatPanel.onToolCall`) | 2 days |
| 104-05 | 9-tier freshness frontmatter + content gap dashboard + multi-layout Cytoscape | 2 days |

## When to Surface

**Trigger:** see frontmatter `trigger_when` block.

This seed should be presented during `/gsd:new-milestone v1.14.0` or
`/gsd:plan-phase` when:
- Path C ships (Phase 110 + 114 both merged to main)
- A phase touches scripts/serve-wiki, lib/wiki/*, dashboard/*, lib/vault/wikilink-builder.cjs
- A new tester reports wiki UX issues
- Lawrence asks about wiki state

## Companion Artifacts

- Memo: `.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md` (231+ lines)
- Schematic: `~/MindrianRooms/mindrian/mindrianOS/research/2026-05-06-intelligence-layer-schematic/`
- Competitive analysis: `~/MindrianRooms/mindrian/mindrianOS/competitive-analysis/2026-05-06-llm-wiki-and-command-surface/`
- Positioning: `~/MindrianRooms/mindrian/mindrianOS/competitive-analysis/2026-05-06-graph-rag-positioning/`
- Action item: `~/MindrianRooms/mindrian/mindrianOS/team-execution/2026-05-07-v1.14-the-visible-room-sprint-action-item.md`
- Validation findings: 13/13 claims validated against current code (1 critical correction integrated; resolve-room exists)

## Branding (non-negotiable)

Per Phase 21 D-11 / D-12 / D-13: De Stijl 5-color palette, 12-glyph vocabulary,
no emoji, Bebas Neue (display) + system-ui (body). The wiki looks unmistakably
Mindrian; theme proliferation is rejected.

## Origin Context

User reaction to LLM-Wiki on 2026-05-06 ("I tried such a wiki with /mos:wiki
and wikilinks but this one looks better") triggered competitive review +
Brain methodology query + validation pass + 4-layer protection lock
(this seed + MILESTONES-NAMING arc claim + PROJECT.md backlog + room
team-execution action item). All four layers planted 2026-05-07 to ensure
the sprint surfaces at the right time and ships against the right gate.
