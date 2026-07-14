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
updated: 2026-07-14T12:00:00Z
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

## Addendum (2026-07-14, later same session): the stated root cause is incomplete, re-verified against origin/main HEAD

Per this file's own re-verification rule (Source-of-Truth Preamble), the two structural findings
were checked against `origin/main` HEAD (`fb995e83`, v1.15.3-beta.19) rather than assumed unchanged
from the beta.18 install. One finding holds; one does not, in a way that changes the diagnosis.

- **Confirmed unchanged:** `scripts/post-write`'s freshness triple still never calls
  `navigation.cjs`. SEED-034's general thesis (normal conversational writes never auto-populate the
  graph) stands.

- **NOT confirmed, and materially wrong for this specific incident:** the RCA's Evidence section
  never checked `scripts/eureka-command.cjs`. It should have. `git merge-base --is-ancestor
  f8336745 3c54028f` confirms commit `f8336745` ("T-218-VD-5 freshness-gated entity-extraction
  pre-step", 2026-07-13 12:19:47) IS an ancestor of the beta.18 release commit `3c54028f`
  (2026-07-13 13:52:04) -- i.e. it shipped IN the exact beta.18 build David's session ran against,
  not after it. `eureka-command.cjs:271` calls `await maybeExtractFirst(roomDir, opts)`
  unconditionally before the ranking step at line 289, and `maybeExtractFirst` (lines 177-187) runs
  entity extraction whenever `needsExtraction()` is true -- which it always is on a room's first-ever
  `/mos:eureka run` (no prior status.json). So automatic graph population for Eureka specifically was
  NOT "never wired" for David's session; it should have run.

- **The real gap this surfaces:** `maybeExtractFirst`'s catch block (`scripts/eureka-command.cjs:184`)
  is a bare `catch (_e) { /* best-effort */ }` -- total silence, no stderr write, nothing surfaced
  into the eureka report, even though the extraction it calls (`entity-extract.cjs`'s own `cmdRun`,
  lines 700-710) DOES write a detailed `state: 'failed'` status.json with the real error message when
  it throws. That diagnostic trail exists but is never read or surfaced by the caller. This is
  functionally the same failure shape as the three confirmed instances filed today in
  `2026-07-14-academy-tester-qa-silent-skip-false-success` (this room): a real error occurs, a status
  artifact records it faithfully, and the calling layer reports success (or silence) anyway. Worth
  counting as a fourth instance of that pattern rather than treating this Eureka incident as
  unrelated to it.

- **What this changes about SEED-034 / SEED-058:** neither seed is wrong to file. SEED-034's general
  thesis (post-write never wires the graph) is still true and still matters for every OTHER graph
  consumer (whitespace_scan, contradiction_check, graph_query) that has no Eureka-side pre-step to
  fall back on. SEED-058's reasoning-mode fallback is still a real, independently-justified gap
  (cold-machine / thin-room). But Required Code Changes / Test 1 in this file currently reads as if
  automatic graph population for Eureka does not exist yet -- it does, as of beta.18, and Test 1's
  acceptance criterion ("room.db has >= N content nodes... without any manual backfill step") should
  already be passing today. If it is not, on a real room, the actionable next step is narrower and
  cheaper than building SEED-034's full harness: stop swallowing `maybeExtractFirst`'s catch silently
  (surface the error into the eureka status.json / report at minimum), then re-run a cold/thin-room
  scenario to see whether extraction is actually throwing, and why -- before assuming the fix requires
  the full post-write harness.

- **Not yet verified, still open:** whether David's session's entity-extraction pre-step actually
  threw (in which case the swallow above is the proximate cause) or ran and genuinely found zero
  extractable candidates in his room's prose (unlikely for 30 filed entries, but not ruled out) or
  wrote successfully but was read incorrectly downstream. `david-innovation-studio` does not exist on
  this machine (Desktop/Cowork surface, confirmed by search -- same pattern as the corepower-isolation
  precedent in `feedback_eureka_engine_internal_reframe_priority.md`), so this cannot be re-run
  locally. The fastest way to close this: check whether
  `<room>/.mindrian/entity-extract/status.json` exists in David's actual room and read its `state`
  field, next time that surface is reachable.

## Addendum 2 (2026-07-14, quick-task 260714-jjm): silent-failure mechanism confirmed PLAUSIBLE, fix LIVE

This quick task existed to answer two questions Addendum 1 left open. Both are now answered; the
David-room ground truth stays open by design (his room is unreachable from this machine).

**Question 1: is a silent extraction failure a plausible mechanism for the David-session
"0 nodes / 0 typed edges / false success" shape? YES -- confirmed by a reproduction test (RED run).**

A new leg (leg 5, throw path) in `tests/test-218-eureka-auto-extract.cjs` stubs the extraction
pre-step (`ENTITY_EXTRACT.main`) to throw, on a fresh never-extracted fixture room, then runs
`eureka run --offline` and reads the eureka status.json. Against PRE-FIX HEAD the run produced this
verbatim, captured from the RED failure output:

```
exit code 0
eureka status.json: {"state":"done","started_at":"2026-07-14T11:19:37.054Z",
  "finished_at":"2026-07-14T11:19:37.078Z","pid":771694,
  "out":".../.mindrian/eureka/portfolio-report.md",
  "json":".../.mindrian/eureka/portfolio-report.json"}
```

That is exit 0, state `done`, and ZERO trace of the failure anywhere on the eureka surface -- exactly
the David-session false-success shape. The likelier production path (leg 6, the internally-caught
exit-1 path where entity-extract writes its own `state: 'failed'` status.json and returns 1 without
throwing) reproduced the identical silence pre-fix. So a silent extraction pre-step failure DOES
produce the observed shape.

**Claim boundary (explicit):** this proves PLAUSIBILITY of the mechanism, not that David's room
actually hit it. The "Not yet verified, still open" item from Addendum 1 STANDS: `david-innovation-studio`
is unreachable from this machine (Desktop/Cowork surface). The closing check is unchanged -- read that
room's `.mindrian/entity-extract/status.json` state field (and now also the eureka status.json
`extraction_error` field, which a re-run would populate) when that surface is next reachable.

**Question 2: is the fix live? YES.**

- Fix (GREEN): commit `2a80ad29` -- `maybeExtractFirst` now returns a failure-detail string on both
  failure paths (throw AND caught exit-1, reading entity-extract's own status.json error), writes one
  stderr line, and `cmdRun` threads it into every eureka status.json payload as an additive
  `extraction_error` field. Ranking, fallback, and exit codes are unchanged (degrade-never-throw
  intact). A clean run writes NO `extraction_error` key (leg 7 control).
- Reproduction test (RED): commit `4f0cab3c` -- legs 5/6/7.
- Aggregator wiring: commit `98e3fff9` -- the auto-extract test (previously in NO aggregator) is now a
  leg in `tests/run-all-218.sh` (T-218-VD-5), so this can never silently regress.

A future incident of this shape now shows `extraction_error` in `ROOM/.mindrian/eureka/status.json`
plus a one-line stderr note on the foreground path.

**Status stays `investigating`:** only the mechanism question and the fix are closed. David's actual
room state (did his pre-step throw, run-and-find-nothing, or write-then-misread) is still unconfirmed,
so this file does NOT move to `resolved/`.

## Resolution
<!-- mechanism confirmed plausible + fix live (Addendum 2); David-room ground truth still open, so NOT resolved -->

root_cause: PARTIALLY corrected (2026-07-14, see Addendum 1) then MECHANISM-CONFIRMED-PLAUSIBLE
(2026-07-14, see Addendum 2). The general SEED-034 thesis holds; the specific "never wired" framing
for Eureka's own graph population is outdated as of T-218-VD-5. The proximate-cause hypothesis (a
silent error-swallow in `eureka-command.cjs` `maybeExtractFirst`) is now PROVEN to reproduce the
David-session false-success shape (RED test), but NOT yet confirmed against David's actual room state.
fix: LIVE (quick-task 260714-jjm) -- the pre-step's throw AND caught exit-1 failures now surface as an
`extraction_error` field in the eureka status.json plus one stderr line, with ranking/fallback/exit
codes unchanged. This is the narrower, cheaper fix chosen instead of committing to SEED-034's full
harness or SEED-058's reasoning-mode fallback before the incident's actual need is known. SEED-034's
general post-write thesis and SEED-058's cold-machine justification remain independently valid.
verification: RED-then-GREEN reproduction test (8/8 legs) wired into tests/run-all-218.sh (FAIL=0);
the eureka dispatcher e2e leg tests/test-216-eureka-command.cjs stays green (44 assertions, unregressed).
files_changed: [scripts/eureka-command.cjs, tests/test-218-eureka-auto-extract.cjs, tests/run-all-218.sh, .planning/debug/interns-round-eureka-david-session-2026-07-14.md]
commits: [4f0cab3c (test RED), 2a80ad29 (fix GREEN), 98e3fff9 (aggregator wiring)]
