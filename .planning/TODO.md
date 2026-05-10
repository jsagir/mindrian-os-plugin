---
created: 2026-04-14
status: active
owner: jsagi
purpose: Short-horizon queued work that is ready to execute but not yet started. Items here are pre-scoped, pre-researched, and waiting on user go. When an item ships, move it to CHANGELOG and delete from this file. When an item is killed, move it to `.planning/TODO-ARCHIVE.md` with a one-line reason.
---

# TODO Queue

## IMMEDIATE NEXT (after v1.11.2 ships)

### [IMMEDIATE-NEXT] Phase 95 - Bash hook envelope + cascade side-channel

**Filed:** 2026-04-29 (this session)
**Spec:** `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-CONTEXT.md`
**Trigger:** v1.11.2 release gate closes (Phase 94-10).

Three problems in one phase:
1. Bash `scripts/post-write` emits a non-conforming PostToolUse envelope (5 unknown root keys: cascade_status, classification, git_commit, graph_index, proactive_intelligence). Same class-of-bug as the `.cjs` hooks fixed in v1.11.2, just hidden today because it carries a recognized `systemMessage` alongside.
2. **Latent feature regression** - the room-proactive intelligence loop (Phase 88.1-03) has been silently broken since it shipped. `skills/room-proactive/SKILL.md` reads `cascade_status.proactive_intelligence.newFindings` from `additionalContext`; the bash hook has always written it at JSON root. The skill has been receiving nothing. Mid-session intelligence injection has never functioned in production.
3. All other bash hooks dispatched through `hooks/run-hook.cmd` (session-start, pre-compact, on-stop, write-scope-check, intent-classifier, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete) are unaudited. Each lifecycle event has its own envelope schema. v1.11.2 left them alone.

Fix shape: move cascade payload to `<roomDir>/.mindrian/last-cascade.json` (LOCAL, atomic write); bash post-write emits only allowed envelope keys; SKILL.md updated to read from side-channel; regression test extends Phase 94 fence to cover all bash hooks per-event.

Start with: `/gsd:plan-phase 95` once v1.11.2 ships. Expect 4-6 plans. If audit surfaces 2+ extra envelope bugs, split into 95.1 + 95.2.

Origin: `.planning/debug/post-write-hook-envelope-invalid-input.md` Follow-Ups, deferred from v1.11.2 to keep release scope tight per A1-only checkpoint.

---

## NEXT UP

### [NEXT] v1.10.8 - Smart-notebook-as-cofounder milestone

Promoted to [NEXT] on 2026-04-14 after v1.10.7 (cross-session scope + write interception + intent classifier + honesty layer, Phase 83) shipped same-day. Slot shifted v1.10.6 -> v1.10.7 -> v1.10.8 (sixth shift in the v1.10.x patch line). v1.10.8 will additionally promote the SQLite memory layer at lib/core/memory-ops.cjs to load-bearing and deliver real persistent cross-session memory (Tier 3) on top of the original scope. See the QUEUED section below for full research context (978 + 821 lines of pass 1 + pass 2 research) AND the "Style-guide + UI/UX constraints" + "UI/UX acceptance bar" + "Freshness flag" blocks added to that detail entry on 2026-05-10. Waiting on user to say "write the memo" to generate the plan-phase-ready CONTEXT document at `.planning/phases/_backlog/v1.10.8-smart-notebook.md`. The memo MUST carry the style-guide + UI/UX blocks below verbatim into the Phase CONTEXT before plan-phase approval.

---

## QUEUED (behind NEXT)

### Beta-tester announcement email

Currently sitting as two Gmail drafts. Both go to the same 10-person BCC list of Brain API key holders including Dror Barak (dror@align-gp.com).

- **Draft 1 (OLD, delete manually):** `MindrianOS v1.9.6 → v1.10.4: eight releases, explained in plain English` - editorial product-release tone. Draft ID `r-411751932222959846`. Delete in Gmail drafts pane.
- **Draft 2 (CURRENT, Feynman voice):** `Larry remembers now. And seven other things that changed in MindrianOS.` - plain-English Feynman-style walkthrough of every release v1.9.6 through v1.10.4, with v1.10.1-never-shipped explained honestly, v1.10.2 highlighted as the architectural release with Jonathan's reframe quote verbatim. Draft ID `r-8269278748347017631`. URL: https://mail.google.com/mail/u/0/#drafts?compose=19d895971cb50c50

**Decision pending:** send as-is now, OR hold until v1.10.5 ships and add a v1.10.5 section crediting Lawrence so beta testers get one consolidated announcement. User's earlier lean was (a) = hold and consolidate. Confirm on ship.

### Smart-notebook-as-cofounder milestone (now v1.10.8)

Research complete across two passes:
- `.planning/research/smart-notebook-cofounder.md` (978 lines, pass 1 - taxonomy, coverage matrix, default scaffold, synthesis layer)
- `.planning/research/smart-notebook-cofounder-appendix.md` (821 lines, pass 2 - v1.10.5 scope cut [now v1.10.6], framework x section matrix, Brain coverage from live Neo4j queries, PWS curriculum cross-reference, MINTO+Feynman+memory wiring)

**Path 1 cut locked:** ships 3 new Tier 0 sections only - `stakeholder-analysis/`, `decisions/`, `assumptions/`. `KNOWN_SECTIONS` expands from 11 to 14. No collection layer, no trigger framework, no synthesis voice (stub only). 2 phases, ~2 weeks. SQLite schema reservations for `scaffold_log`, `voice_log`, `decisions`, `held_contradictions`, `assumptions`. Mullins 7-domain framework confirmed in Brain and is the scaffold authority.

**Mullins 7-domain finding:** Lawrence + Jonathan's "PWS Value Proposition Model" is both a Framework node and a Book node in the Brain. DataRoomSection label already has 13 entries in Neo4j - a superset of the current 11 KNOWN_SECTIONS. Brain already anticipated scaffold expansion before the plugin caught up.

**Top 3 Brain enrichment gaps (for a later Brain wave, not v1.10.6):** stakeholder-analysis-as-method, trust graphs, pricing + unit economics + TAM/SAM/SOM + runway + fundraising playbooks. PWS curriculum and Brain have the same gaps - a consistency signal that the missing areas are genuinely missing from Mindrian's teaching corpus.

**Waiting on user:** synthesis memo at `.planning/phases/_backlog/v1.10.6-smart-notebook.md` distilling both research files into a plan-phase-ready CONTEXT document (~150 lines, handoff-ready for `/gsd:new-milestone v1.10.6` or `/gsd:add-phase`). When user says "write the memo," generate it from both research files. (Note: filename drift — the `[NEXT]` pointer above says `v1.10.8-smart-notebook.md`; reconcile to one path when the memo is written.)

**Style-guide + UI/UX constraints (added 2026-05-10 per user directive — must survive into the Phase CONTEXT):** the 3 new Tier-0 sections (`stakeholder-analysis/`, `decisions/`, `assumptions/`) plus the synthesis-voice stub are UI-touching surface, so they ship under the full UI ruling system (`skills/ui-system/SKILL.md`) — no bespoke layout for the new sections on any surface:
- **Shape A (Mondrian Board)** — the new sections render on `/mos:status` and `/mos:diagnose` with the same 10-char progress bar + entry count + MINTO-health glyph (`checkmark` / `bullet` / `--`) as the existing 11. `KNOWN_SECTIONS` expanding 11 → 14 means the board renderer's column-padding and bottom summary line MUST be re-tested at 14 rows (don't assume the layout still fits <80 cols).
- **Shape C (Room Card)** — `/mos:room stakeholder-analysis | decisions | assumptions` renders governing thought (quoted) + entries list + graph edges + MINTO assessment, and must degrade cleanly on an empty section (governing-thought placeholder, zero-entry empty state, no crash).
- **Shape B (Semantic Tree)** — the new sections appear in `/mos:room` (no args), `/mos:tree`, `/mos:wiki` with the standard state glyphs (`down-triangle` / `right-triangle-filled` / `right-triangle-empty`, `branch` / `last-branch`).
- **Synthesis voice = Larry's voice** (`larry-personality`), not a new output format. Synthesis output is conversational (no shape) per the ui-system "Methodology commands use no shape" rule. If synthesis ever surfaces a fork (e.g. "file this contradiction or hold it?"), that fork renders through **Shape F** (tri-context Decision Gate, canon Part 3) — never a bespoke prompt or modal.
- **De Stijl visual contract on the browser surface** — wherever the 3 sections render in the dashboard/wiki: De Stijl 5-color palette sourced from the canonical `palette.json` once Phase 121.5 ships (DO NOT hardcode hex; until 121.5, use the interim values pinned in the v1.14.0 entry below); 12-glyph vocabulary rendered as Unicode/SVG, never emoji; Bebas Neue (display) + system-ui (body); De Stijl symbols on section headers consistent with statusline + dashboard.
- **Tri-polar check (CLAUDE.md mandate)** — CLI (Shape A/B/C renders correctly at 14 sections), Desktop (Larry describes the 3 new sections conversationally; the `KNOWN_SECTIONS` expansion is invisible-but-correct), Cowork (shared `00_Context/` reflects the 14-section structure).

**UI/UX acceptance bar (gate before plan-phase approval):**
1. `/mos:status` at 14 sections — no column overflow, summary line still fits <80 cols. Screenshot in the Phase CONTEXT.
2. `/mos:room stakeholder-analysis` (and `decisions`, `assumptions`) renders a valid Shape C Room Card on a brand-new empty section — placeholder governing thought, empty-state, no crash.
3. Dashboard + `/mos:wiki` re-render with 14 section nodes — De Stijl palette intact, zero emoji introduced, graph layout still legible.
4. Synthesis-voice stub output passes the ui-system no-emoji + 12-glyph scan AND reads as Larry (voice-dna check in `references/personality/voice-dna.md`), not as a report.

**Freshness flag (2026-05-10):** the "promote `lib/core/memory-ops.cjs` to load-bearing / deliver Tier 3 cross-session memory" half of this milestone predates v1.10.18 — Phase 88 shipped the Feynman-MINTO memory triple, Phase 90 shipped the BRAIN.md per-folder quadruple + session-start staleness scan, and the local graph migrated to SQLite at `room/.room-graph/`. Re-scope the memory half against what actually shipped before writing the memo. The section-scaffold half (Mullins 7-domain authority, 3 new Tier-0 sections, `KNOWN_SECTIONS` 11→14) is still accurate.

### [v1.14.0 QUEUED — PROMOTE TO NEXT UP WHEN v1.13.0 SHIPS] Mindrian Wiki + SnapshotHub Sprint - "The Visible Room" arc (Wiki + SnapshotHub fused; one renderer, two surfaces)

**PROMOTION TRIGGER (mandatory):** the moment `git tag v1.13.0` lands on origin (i.e. v1.13.0 final ships, not a beta), MOVE this entry from QUEUED to NEXT UP and remove this trigger line. v1.14.0 is the immediate successor; no other milestone should claim NEXT UP between v1.13.0 final ship and v1.14.0 kickoff. Per `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md` Post-Ship Handoff Checklist step 7.

**Filed:** 2026-05-06 (memo); methodology spine added 2026-05-07 (Brain-validated); SnapshotHub fused into v1.14.0 2026-05-07 evening (shared renderer DNA argument)
**Memo:** `.planning/phases/_backlog/v1.14-mindrian-wiki-sprint.md` (231 lines)
**Trigger to expand into Phase 104 CONTEXT:** Path C ships (Phase 110 + Phase 114 merged) AND user says "expand the wiki sprint memo into Phase 104 CONTEXT."
**Parent phase to revive:** Phase 104 (currently scaffolded but empty; rename: per-command-ui-wrapping → per-room-wiki-completeness).

**Why now (vs v1.13.x patch):** Path C is mid-flight with Phase 110 + 114 ahead. Mixing wiki UX work into a release cycle that is shipping wire-schema enforcement and Larry-default-activation creates scope leakage and ships nothing cleanly. v1.14.0 final is the correct slot.

**Methodology spine (Brain-validated 2026-05-07 via Neo4j Aura, Mode A confidence ≥ 0.7):**
- Design Thinking → JTBD (prereq) → **User Journey Mapping** (primary method, TYPICAL_AT "Opportunity Identified") → Process Mapping → Reverse Salient Analysis (already shipped Phase 89).
- The four `HAS_PROCESS_STEP` nodes Brain returned for User Journey Mapping (Cast a Wide Net / Track Multiple Dimensions / Find Hidden Problems / Follow Workarounds) map 1:1 onto the four user-facing deliverables.
- Brain edge `User Journey Mapping REVEALS "Making the Invisible Visible"` matched RECOMMENDED-marker threshold for the gap-visualization scope.
- This is methodology continuation, not detour: the chain terminates at Phase 89 work already shipped.

**Scope shape (5 sub-plans under revived Phase 104, ~8 working days):**
1. **104-01** — `scripts/resolve-room` shared module + ANSI strip + diagnostic empty-state messages. Fixes Lawrence's P1 blocker open since 2026-03-31. Without this, the sprint does NOT ship. ~1 day.
2. **104-02** — Graph as wiki homepage + auto-create wiki on `/mos:new-project`. Both mandated in Phase 19 CONTEXT but never shipped. ~1 day. Maps to UJM "Cast a Wide Net".
3. **104-03** — Wikipedia zones (infobox sidebar from frontmatter, "what links here" backlinks, "see also" from INFORMS/ENABLES, red-link gap indicators). Substrate exists in `lib/wiki/graph-links.cjs` (`getBacklinks`, `getSeeAlso`). ~2 days. Maps to UJM "Track Multiple Dimensions" + "Find Hidden Problems".
4. **104-04** — Click-red-wikilink-to-research + Phase 32-02 chat tool-call wiring. Wiring point exists (`window.__mosChatPanel.onToolCall`, `window.__mosGraph`). ~2 days. Maps to UJM "Follow Workarounds".
5. **104-05** — 9-tier freshness frontmatter + content gap dashboard + multi-layout Cytoscape with clustering. ~2 days. Maps to UJM "Find Hidden Problems" + "Track Multiple Dimensions".

**What we TAKE from LLM-Wiki (5 patterns, JTBD-filtered):**
1. Click-red-wikilink-to-research (highest leverage)
2. WebSocket chat sidebar with tool-calls (Larry-in-the-wiki)
3. Content gap dashboard (visualize what room-proactive detects)
4. 9-tier freshness/TTL frontmatter
5. Multi-layout Cytoscape with clustering

**What we DO NOT take (6 patterns, off-JTBD):** 4 themes, canvas/whiteboard, FSRS spaced repetition, daily notes/journal, frontmatter SQL query language, per-agent Sonnet/Haiku frontmatter (last belongs in a separate cost-of-goods sweep).

**What we FINISH from past Mindrian plans (5 long-promised items from Phase 19 March 2026):** Wikipedia-zone information architecture, graph-as-homepage, auto-create-on-new-project, talk-page = REASONING.md per section, light/dark theme toggle persisted to localStorage.

**Branding rules (non-negotiable, per Phase 21 Decisions D-11/D-12/D-13):** De Stijl 5-color palette only; 12-glyph vocabulary; no emoji; Bebas Neue (display) + system-ui (body); De Stijl symbols on section headers consistent with statusline + dashboard.
- **Palette source of truth (updated 2026-05-10):** Phase 121.5 mints a canonical `palette.json`. This sprint MUST read its hex values from that file, not redeclare them. Until 121.5 ships, the interim values are: cream `#F5F0E8`, Mondrian red `#A63D2F`, blue `#1E3A6E`, yellow `#C8A43C`, green `#2D6B4A`. If 121.5 changes any value, the wiki/dashboard/SnapshotHub pick it up for free — no second source.

**UI ruling system on the browser surface (added 2026-05-10 per user directive — closes the CLI-only gap in `skills/ui-system/SKILL.md`):** `ui-system` governs *terminal* output; the wiki, dashboard, and SnapshotHub export are *browser* surfaces and need the equivalent contract spelled out:
- **Same vocabulary, different render target.** The 12 ui-system glyphs render as Unicode or inline SVG in HTML — never emoji, never a fourth icon set. The 5-color De Stijl palette is the only palette; no Tailwind defaults, no accent colors smuggled in via a component library.
- **Header / body / footer parity.** A wiki page's masthead carries the same Zone 1 identity content as the CLI header (room name first as the multi-room canary, section name, venture stage). The page footer carries Zone 4 "next move" affordances as De Stijl-styled links to real `/mos:` actions — not generic nav chrome.
- **Decision Gates inside the wiki = Shape F semantics.** Any interactive fork rendered in the browser (click-red-wikilink-to-research, "research this gap or defer", chat-sidebar action buttons) follows the tri-context Decision Gate (canon Part 3): LOCAL / BRAIN / SIGNAL contexts visible, one of the 10 canonical verbs chosen, RECOMMENDED marker only at Brain confidence ≥ 0.7 (Mode A) and never in Mode B, Free-Text always available. HTML rendering of F-shapes, not bespoke modals. (This is a *semantics* obligation; it does not pull the Phase 88.2 F-shape rollout into scope — see Out of scope.)
- **Chat sidebar = Larry's voice.** The WebSocket chat sidebar ("Larry-in-the-wiki") speaks via `larry-personality`. Same voice, same Ask-Tell dial, same no-emoji rule. It is not a separate assistant persona with its own tone.
- **Light/dark toggle stays inside the palette.** Dark mode is a re-mapping of the 5 De Stijl colors (cream ↔ near-black ground, etc.), not a license for a sixth or seventh color. Persisted to localStorage per the Phase 19 long-promised list.
- **SnapshotHub export honors all of the above.** A standalone HTML export carries the De Stijl contract, the 12-glyph vocabulary, the no-emoji rule, and the header/footer parity offline — it must not degrade to generic styling once disconnected from the room.
- **Tri-polar check (CLAUDE.md mandate):** the wiki is primarily a CLI/Desktop browser surface; on Cowork the same renderer must read shared `00_Context/` state and stay legible under concurrent access. SnapshotHub is the artifact users hand to people who have no install at all — it must be self-contained and on-brand.

**UI/UX acceptance bar (gate before each 104-0X plan ships):**
1. `resolve-room` empty-state messages (104-01) read in Larry's voice and use ui-system glyphs — not raw stack traces, not emoji.
2. Graph-as-homepage (104-02) renders the De Stijl palette from `palette.json` (or the interim values) with zero non-palette colors; auto-created wiki on `/mos:new-project` passes the same scan.
3. Wikipedia zones (104-03) — infobox, "what links here", "see also", red-link gap indicators — all render inside the 5-color palette + 12-glyph vocabulary; red-link is the De Stijl Mondrian red, not browser-default link-red.
4. Click-red-wikilink-to-research + chat tool-call wiring (104-04) renders its choice surface as an HTML Shape F (tri-context strip + canonical verbs + Free-Text), verified against the Part 3 contract.
5. Freshness frontmatter + content-gap dashboard + multi-layout Cytoscape (104-05) — gap dashboard uses the `empty-square` gap glyph and `warning` glyph consistently with room-proactive's Zone 3 strip; no emoji; Cytoscape node/edge colors come from `palette.json`.
6. SnapshotHub export of any room passes 1–5 offline (open the HTML with no network, confirm De Stijl + glyphs + no emoji intact).

**Out of scope (do not let it slip in):** Phase 88.2 F-shape *rollout* (the interactive-primitive work itself — this sprint only obligates F-shape *semantics* for any browser fork it ships, it does not implement the rollout); per-agent model frontmatter (separate cost-of-goods sweep); spaced repetition / canvas / journal / theme proliferation (a sixth color or a fourth icon set is a hard NO); frontmatter SQL query language (defer to v1.15+).

**Open questions for the planning session (when memo expands to CONTEXT):**
1. Confirm Phase 104 revival vs. fresh phase number (recommend revive 104).
2. Confirm v1.14.0 final slot vs. v1.13.x patch (recommend v1.14.0 final).
3. Tester preview for Lawrence before general release (recommend yes; canonical user-finder for wiki UX).
4. Does `skills/ui-system/SKILL.md` get a new section ("Section N: Browser-Surface Rendering") that codifies the contract spelled out under "UI ruling system on the browser surface" above, or does it stay a v1.14.0-local convention? Recommend: extend the skill — the wiki, dashboard, and SnapshotHub are permanent surfaces, not a one-sprint concern, and a convention that lives only in a TODO entry will drift. If extended, coordinate with Phase 121.5 (which already touches `SKILL.md` v2 reconciliation + `output-styles/destijl.md`) so the two edits don't collide.
5. Sequencing vs. Phase 121.5: 121.5 mints `palette.json` and is the LAST phase before the v1.13.0 final gate. v1.14.0 depends on `palette.json` existing. Confirm 121.5 ships its palette artifact in a form v1.14.0 can `require()` / fetch, and that v1.14.0 does not start until it does.

**Origin context:** triggered by user reaction to LLM-Wiki repo (github.com/Oshayr/LLM-Wiki) on 2026-05-06: "I tried such a wiki with /mos:wiki and wikilinks but this one looks better." Companion artifacts in `~/MindrianRooms/mindrian/mindrianOS/competitive-analysis/2026-05-06-llm-wiki-and-command-surface/` and `~/MindrianRooms/mindrian/mindrianOS/research/2026-05-06-intelligence-layer-schematic/`.

---

## DECISIONS RESOLVED THIS SESSION (archive when cleaning up)

- v1.10.7 Cross-session scope injection + write interception + intent classifier + honesty layer, Phase 83 (session-start scope injection reading ~/MindrianRooms/.rooms/registry.json, sealed room walker, PreToolUse write-scope-check hook, UserPromptSubmit intent classifier, honesty layer in larry-personality forbidding "working memory" phrase). Jonathan Sagir witnessed 8 leak vectors from the sealed rashut-hadshanut-ai room on 2026-04-14. SHIPPED 2026-04-14. Smart-notebook milestone shifted v1.10.6 -> v1.10.8 (sixth slot shift). v1.10.8 will additionally promote lib/core/memory-ops.cjs to load-bearing (Tier 3).
- v1.10.5 Wiki Artifact Injection Fix, Phase 82 (collectSections populates sec.artifacts, per-artifact 20 KB cap, per-room 2 MB cap, collectSectionMinto summary upgrade leveraging v1.10.2 Feynman-MINTO, 9 fixture tests, SKIP_FILES aligned with SYSTEM_FILES). Lawrence Aronhime bug report 2026-04-13 23:23. SHIPPED 2026-04-14. Smart-notebook milestone shifted v1.10.5 -> v1.10.6 (fourth slot shift).
- v1.10.3 statusline upgrade (LARRY marker + section breadcrumb + exploration label + active phase) - SHIPPED 2026-04-14
- v1.10.4 statusline redesign (room name + MindrianOS brand + version + Brain status + thematic emojis + ui-system carve-out) - SHIPPED 2026-04-14
- v1.10.2 Feynman-MINTO Hybrid (slash-command orchestrator, no API key, per-section MINTO compression) - SHIPPED 2026-04-14
- v1.10.0 Obsidian vault import + workspace guard + release pipeline mandate - SHIPPED 2026-04-13
- v3.0 MCP Sampling migration captured as first-class scope item in PROJECT.md v3.0 Backlog
- Notion template gap close parked in PROJECT.md (6 items, priority trio: per-section STATEMENT, Latest Deck slot, Funding Options section)
- ui-system skill no-emoji rule gains carve-out: statusline surface only, every other surface still forbids emojis
- Dev workspace vs plugin cache path separation confirmed (marketplace cache is the canonical install, legacy `~/.claude/plugins/mindrian-os/` is inert)

---

## NOTES FOR THE NEXT CLAUDE SESSION

- Working directory is `/home/jsagi/MindrianOS-Plugin/`. Never work from `~/.claude/plugins/*`. The workspace guard in `scripts/session-start` enforces this but the habit has to be in the session too.
- `.planning/` is gitignored but tracked files in it commit normally via `git commit <path>` or `git add -Af`. Do not use `git add -A` broadly.
- v1.11.0 slot is RESERVED for release pipeline hardening (see `docs/NEXT-RELEASE-v1.11.0-beta.1.md`). Do not ship feature work as v1.11.0.
- The user prefers aggressive same-day patch releases (pattern set by v1.10.3 and v1.10.4). When in doubt, ship small and fast rather than bundle.
- Every commit in this session was signed by `Claude Opus 4.6 (1M context)`. Maintain the pattern unless the user asks otherwise.
- The user is the author of the no-emoji rule in `skills/ui-system/SKILL.md`. Exception is statusline only. Do not add emojis to any other surface without explicit instruction.
- Lawrence Aronhime is the oldest admin API key holder (2026-03-26). Treat his bug reports as canaries.
