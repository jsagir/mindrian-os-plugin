---
created: 2026-04-14
status: active
owner: jsagi
purpose: Short-horizon queued work that is ready to execute but not yet started. Items here are pre-scoped, pre-researched, and waiting on user go. When an item ships, move it to CHANGELOG and delete from this file. When an item is killed, move it to `.planning/TODO-ARCHIVE.md` with a one-line reason.
---

# TODO Queue

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
