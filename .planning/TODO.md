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

Promoted to [NEXT] on 2026-04-14 after v1.10.7 (cross-session scope + write interception + intent classifier + honesty layer, Phase 83) shipped same-day. Slot shifted v1.10.6 -> v1.10.7 -> v1.10.8 (sixth shift in the v1.10.x patch line). v1.10.8 will additionally promote the SQLite memory layer at lib/core/memory-ops.cjs to load-bearing and deliver real persistent cross-session memory (Tier 3) on top of the original scope. See the QUEUED section below for full research context (978 + 821 lines of pass 1 + pass 2 research). Waiting on user to say "write the memo" to generate the plan-phase-ready CONTEXT document at `.planning/phases/_backlog/v1.10.8-smart-notebook.md`.

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

**Waiting on user:** synthesis memo at `.planning/phases/_backlog/v1.10.6-smart-notebook.md` distilling both research files into a plan-phase-ready CONTEXT document (~150 lines, handoff-ready for `/gsd:new-milestone v1.10.6` or `/gsd:add-phase`). When user says "write the memo," generate it from both research files.

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

**Branding rules (non-negotiable, per Phase 21 Decisions D-11/D-12/D-13):** De Stijl 5-color palette only (cream `#F5F0E8`, Mondrian red `#A63D2F`, blue `#1E3A6E`, yellow `#C8A43C`, green `#2D6B4A`); 12-glyph vocabulary; no emoji; Bebas Neue (display) + system-ui (body); De Stijl symbols on section headers consistent with statusline + dashboard.

**Out of scope (do not let it slip in):** Phase 88.2 F-shape rollout (orthogonal interactive-primitive work); per-agent model frontmatter (separate cost-of-goods sweep); spaced repetition / canvas / journal / theme proliferation; frontmatter SQL query language (defer to v1.15+).

**Open questions for the planning session (when memo expands to CONTEXT):**
1. Confirm Phase 104 revival vs. fresh phase number (recommend revive 104).
2. Confirm v1.14.0 final slot vs. v1.13.x patch (recommend v1.14.0 final).
3. Tester preview for Lawrence before general release (recommend yes; canonical user-finder for wiki UX).

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
