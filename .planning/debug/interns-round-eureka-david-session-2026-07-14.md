---
status: investigating
kind: qa-sweep
trigger: "interns-round-eureka-david-session-2026-07-14"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: [8, 9, 11, 12]
created: 2026-07-14T00:00:00Z
updated: 2026-07-14T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.3-beta.18/` (the intern's session ran against a beta.18-era install; dev-repo HEAD at time of this filing is `fb995e83`, v1.15.3-beta.19 next pre-release)
- **WIRE claims probe against:** n/a (Tier 0, BRAIN.md absent, no Brain calls this session)
- **Date of audit:** 2026-07-14
- **Re-verification rule:** the two structural findings below (post-write graph-write gap, Eureka hard-gate on room.db) were re-verified directly against beta.18 source in this same session; needs re-check against `origin/main` HEAD before any fix lands, since beta.19 is already ahead of beta.18.

## Current Focus

hypothesis: The intern-QA split-report design (Part A human / Part B system) is working exactly as intended -- it surfaced two structural bugs the human side had zero visibility into. The bugs are real, source-confirmed, and connect directly to an already-open seed (SEED-034).
test: Grepped `scripts/post-write` and `scripts/eureka-portfolio-report.cjs` directly; confirmed the freshness triple never calls `navigation.cjs`, and Eureka hard-gates on `idx.embedded === true` with no fallback path.
expecting: Both findings should be actionable as seed amendments / a new seed, not filed as one-off bugs.
next_action: This qa-sweep documents the incident; SEED-034 gets a second proving case appended; SEED-058 (new) proposes the reasoning-mode fallback SEED-034 does not cover.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.18 (intern's session), dev HEAD 1.15.3-beta.19 at filing time
- Reported by: intern QA program (David's session, "David's Innovation & Design Studio" room export, forwarded by Jonathan)
- Date first observed: 2026-07-14
- Related debug sessions: none found under this slug pattern; related seed: SEED-034 (Graph Derivation Harness)

## Problem Statement

An intern's exploratory session (build room -> file 30 entries -> run `/mos:eureka`) surfaced a Part A / Part B QA mismatch: the human reported "felt real, nothing fabricated" while Larry's own Part B self-report named a missed Decision Gate, an entire-session room-resolver failure, and an Eureka scan that scored 0 pairs for a structural reason unrelated to the "not enough entries" message it displayed.

## Symptoms

expected: `/mos:eureka` on a 30-entry room should either score real pairs or say precisely why it can't (encoder vs. substrate vs. floor).
actual: Eureka returned `pairs_scored: 0`, `statements: []`, `encoder_unavailable: true`, and rendered as "not enough entries for a tail read" -- a message that is true of the *symptom* but wrong about the *cause* at 30 entries.
errors: JSON fields verbatim from the session's own Part B report: `honest_nouns: "room-native substrate: 0 nodes, 0 typed edges read from room.db"`; dashboard build-graph reported "8 nodes, 0 edges" (section-directory nodes only, no content nodes).
reproduction:
  1. `/mos:new-project` -> B2 blueprint approve -> room created (`david-innovation-studio`)
  2. File ~30 markdown entries into room sections via normal conversation-driven filing (no explicit `memory_event` calls)
  3. `/mos:eureka` -> `/mos:eureka html`
  4. Observe: 0 nodes / 0 typed edges in room.db despite 30 `.md` files on disk; `encoder_unavailable: true` because the embedding model was never cached either
started: not a regression -- appears to be the room's write path never having wired graph writes at all (see Technical Root Cause). Same underlying gap SEED-034 (created 2026-06-18) already diagnosed as "broken pipe #4."

## Scope and Impact

- Affected surfaces: cli (this session); desktop/cowork share the same `scripts/post-write` and `eureka-portfolio-report.cjs`, so likely affected too, unverified this session.
- Affected commands: `/mos:eureka`, `/mos:eureka html`, and by extension anything reading `room.db` typed edges (reach sensors, `graph_query`, `whitespace_scan`, `contradiction_check`).
- Affected users: any room whose content was filed through normal conversational writes without an explicit backfill/derivation pass -- i.e. every room, by default, since the write path never populates the graph.
- Version range: confirmed present in beta.18; not yet re-checked against beta.19 / origin main HEAD.
- Severity: high. This is the second independent incident (b2-journey 2026-06-18, now this Eureka session 2026-07-14) confirming the graph substrate is structurally never populated by normal use.
- Blast radius: SEED-034's "four broken pipes" -- this session directly re-confirms broken pipe #1 (`resolve-room` returned `EXIT:1` the entire session, hardcoded paths used instead) and broken pipe #4 (typed-edge / node derivation never runs automatically on write).

## Eliminated

- hypothesis: The intern simply didn't file enough content.
  evidence: 30 markdown files existed on disk (confirmed by the intern's own file count and the assignment's 30-entry gate); the graph had 0 content nodes regardless. Volume was not the constraint.
  timestamp: 2026-07-14T00:00:00Z

## Evidence

- timestamp: 2026-07-14T00:00:00Z
  checked: `scripts/post-write` (beta.18), the PostToolUse handler for Write/Edit/MultiEdit
  found: the documented "freshness triple" on a room-section write is (1) enqueue MINTO regen via `minto-debouncer.cjs`, (2) recompile ROOM.md references (backgrounded), (3) stamp `last_artifact_write_seen_at`. No step calls `lib/core/navigation.cjs` (`setFocus` / `memory_event`).
  implication: every markdown write inside a room keeps the human-readable prose fresh but never reaches the graph. This is the direct mechanism behind "0 nodes, 0 typed edges" at 30 files.

- timestamp: 2026-07-14T00:00:00Z
  checked: `scripts/eureka-command.cjs` -> `scripts/eureka-portfolio-report.cjs`
  found: `eureka-portfolio-report.cjs` opens `room.db` directly via `openRoomDb(roomDir, { allowExtension: true })` (line ~643) and hard-gates on `idx.embedded === true` for the tri-modal index (line ~19 comment: "HARD GATE on idx.embedded === true"). No code path reads raw room content directly when the graph is empty or the encoder is unavailable.
  implication: Eureka has exactly one substrate (room.db + a cached embedding model) and exactly one failure mode (honest zero-result). There is no degrade path.

- timestamp: 2026-07-14T00:00:00Z
  checked: intern's own Part B self-report (pasted session export)
  found: `resolve-room` returned `EXIT:1` for the entire session; `room-registry` and `update-icm-index` both exited 49 and were silently swallowed; the room was never formally registered. Also: the closing Eureka render skipped a required F.8 Decision Gate (rendered as prose instead of firing `AskUserQuestion`) -- a SEED-021-class violation; the session-export HTML was reconstructed from memory rather than parsed from a real transcript (content accurate, mechanism undisclosed at the time); a Python-missing dashboard failure was silently worked around via Node.
  implication: this single session independently reproduces SEED-034's broken-pipe #1 (two room resolvers disagreeing / resolver never actually resolving) from a completely different room and workflow than the original 2026-06-18 b2-journey incident. Corroborating, not coincidental.

## Technical Root Cause

- Site 1: `scripts/post-write` (freshness-triple block), beta.18 -- no call to `lib/core/navigation.cjs` anywhere in the write-triggered path.
  Cause: the write hook was built to keep MINTO/ROOM.md prose fresh; graph population was left to a separate, never-automatically-triggered derivation pass (per SEED-034 broken pipe #4).
  Why it surfaces now: any room that relies on normal conversational filing (the default, undocumented-as-insufficient path) silently accumulates zero graph substrate, so any graph-dependent reach (Eureka, `whitespace_scan`, `contradiction_check`, sensor dispatch) degrades to Tier 0 forever, even in a dense, mature room.
- Site 2: `scripts/eureka-portfolio-report.cjs`, `openRoomDb` + `idx.embedded === true` gate.
  Cause: Eureka's scoring pipeline has one substrate (room.db typed edges) and one method (cached local embedding model), with no secondary path.
  Why it surfaces now: a cold machine (embedding model never fetched) intersecting with an unpopulated graph (Site 1) produces a silent double-failure that both report as "not enough entries," which is true of the symptom but names the wrong cause.

## Required Code Changes

- Change 1 (extends SEED-034, does not duplicate it):
  - Location: `scripts/post-write` freshness-triple block
  - Current behavior: MINTO regen + ROOM.md recompile + timestamp stamp only.
  - Required behavior: add a fourth step that calls the `navigation.cjs` chokepoint to upsert a node + typed edge for the written artifact, so the graph is a mechanical twin of the filesystem, not a manually-triggered afterthought.
  - Short-term patch: none recommended -- this needs the derivation pass SEED-034 already scopes, not a quick patch.
  - Long-term fix: implement SEED-034's "harness" (its own Required Capability section), scoped so the fourth freshness-triple step is the per-write half of that harness.
- Change 2 (new scope, proposed as SEED-058, not covered by SEED-034):
  - Location: `scripts/eureka-portfolio-report.cjs`, the `idx.embedded === true` hard gate
  - Current behavior: `encoder_unavailable` or an empty graph both terminate in `pairs_scored: 0`.
  - Required behavior: when the embedding index or the graph substrate is unavailable/thin, degrade to an LLM-reasoning pass over the room's raw content (no embedding model required) and produce a real, clearly-labeled lower-confidence ranked-pairs result instead of a hard zero.
  - Short-term patch: n/a, this is the proposal itself; see SEED-058.
  - Long-term fix: SEED-058's required-capability list.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: proposed `tests/run-all-<phase>.sh` fixture once a phase claims this seed pair
  - Given: a room with N markdown files filed via normal Write/Edit calls, no explicit `memory_event` calls
  - When: `/mos:eureka` runs immediately after filing
  - Then: `room.db` has >= N content nodes (not just section-directory nodes) without any manual backfill step
- Test 2:
  - Type: integration
  - Given: a room with a populated graph but `idx.embedded !== true` (embedding model absent, simulated)
  - When: `/mos:eureka` runs
  - Then: the result is a labeled reasoning-mode ranked-pairs output, not `pairs_scored: 0`

## Non-Code Follow-ups

- SEED-034: append this session as a second, independent proving case (Evidence above); do not open a duplicate seed for the resolver/derivation gap.
- SEED-058 (new): file for the reasoning-mode fallback, cross-referenced to SEED-034.
- Interns tracker (`~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`): David's Eureka-round report already logged there with the Intern-N slot unconfirmed; the structural findings here are the same ones summarized in that table row.
- knowledge-base.md: add on resolve, not yet -- status is `investigating`, no fix has shipped.

## Resolution
<!-- not yet resolved -->

root_cause: pending confirmation against `origin/main` HEAD (this filing reads against beta.18 install cache per the Source-of-Truth Preamble)
fix: pending -- see SEED-034 amendment and SEED-058
verification: pending
files_changed: []
commits: none yet
