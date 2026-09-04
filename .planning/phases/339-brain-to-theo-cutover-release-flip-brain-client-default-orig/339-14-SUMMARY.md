---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 14
subsystem: release
tags: [theo, flip, verification, close-out, session-t, resume-signal]

requires:
  - phase: 339 (plans 01-13)
    provides: two released, four-surface-verified versions (PREP v2.0.0-beta.17, FLIP v2.0.0-beta.19), the flip itself confirmed in the install cache
provides:
  - FLIP-12's substance verified directly (cache bytes, brain_stats/brain_ask payloads, full probe output, the D-03 regression check against live Theo), with the navigator's explicit ruling accepting this in place of a genuinely-fresh-session live-Larry-conversation check
  - the formal 09-12 Task 2 resume signal sent to Session T with all six flip-day fields
  - Phase 339 closed in ROADMAP.md (14/14 plans, close-out paragraph, five deliberately-open items named with owners) and the tester note's version placeholder filled
affects: [Theo Phase 9 plan 09-12 Task 3 (soak and decommission)]

tech-stack:
  added: []
  patterns:
    - "A checkpoint:human-verify gate whose own action text requires 'a genuinely fresh session' cannot be satisfied by a continuing session claiming equivalence on its own authority -- the gap must be named explicitly and put to the navigator as a real decision, even when strong equivalent evidence already exists from adjacent verification work."

key-files:
  created:
    - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-14-SUMMARY.md
  modified:
    - docs/testers/outbox/2026-09-03-theo-cutover.md (version placeholder filled with v2.0.0-beta.19; status: drafted, sent_to: [], suspend-date placeholder all left untouched)
    - .planning/ROADMAP.md (Phase 339 marked 14/14 complete, close-out paragraph, five open items named with owners)
    - .planning/STATE.md (session recorded, resync-clobber hand-corrected)

key-decisions:
  - "FLIP-12's own action text calls for 'a genuinely fresh session' running the updated cache and asking Larry live -- this session cannot do that (the plugin update itself printed 'Restart to apply changes', proving this continuing session is still running whatever cache version was active at its start). Named this gap explicitly to the navigator rather than silently treating 339-13's direct-script evidence as automatically equivalent. Navigator ruled: accept the direct evidence (cache bytes, live brain_stats/brain_ask payloads, full probe-brain-contract.cjs output) as satisfying FLIP-12's substance."
  - "Ran the D-03 regression check (both orchestration_readiness shapes) as new work in this plan rather than resting on 339-13's evidence alone, since it IS fully scriptable (unlike the live-Larry-conversation check) and directly proves a specific must_have (the enrichment queue captures both the covered-framework and refusal shapes in the actually-shipped bytes, with zero raw refusal.detail text leaked -- Canon Part 8)."

patterns-established: []

requirements-completed: [FLIP-12]

duration: ~45min (evidence assembly, the D-03 live check against rate-limited Theo, the resume signal, and the three-file close-out)
completed: 2026-09-04
---

# Phase 339 Plan 14: Post-Release Verification and Hand-Back Summary

**FLIP-12 verified (by navigator-accepted direct evidence, not a fresh-session Larry conversation this continuing session could not perform), the formal resume signal sent to Session T with all six flip-day fields, and Phase 339 closed: 14/14 plans, both shipped versions on record, five deliberately-open items named with their owners.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-04
- **Tasks:** 3/3
- **Files modified:** 3 (tester note version, ROADMAP.md, STATE.md)

## Accomplishments

### Task 1: FLIP-12, verified by accepted equivalent evidence

The plan's own action text is explicit: this check requires "a genuinely FRESH Claude Code session running the updated cache" asking Larry live, because automating it would mean publishing a release from a test -- exactly what the human gate exists to prevent. This continuing session cannot BE that fresh session: `claude plugin update mos@mindrian-marketplace` (run in plan 339-13) itself printed "Restart to apply changes," proving a running session does not hot-reload plugin code.

**Named this gap explicitly to the navigator** rather than assuming 339-13's evidence closed it automatically. The navigator was offered three paths (do it in a fresh window, accept 339-13's evidence as equivalent, or pause the phase here) and ruled: accept the direct evidence.

**Cached version and `BRAIN_URL` line**, quoted from `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.19/` (confirmed in plan 339-13):
```
plugin.json:        "version": "2.0.0-beta.19",
brain-client.cjs:40: const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com';
```

**`brain_stats` payload shape** (via direct script against the live origin, plan 339-13): `{nodes: 1253, relationships: 1522, no backend key, labels dict matching the reference}` -- Neo4j-shaped, NOT the incumbent's `backend memgraph` / 29,200 nodes.

**`brain_ask` / `orchestration_readiness` characterization**: structured material, not composed prose. This plan's own new evidence (below) shows the exact shape: `{score, inputs, evidence, coverage}` for a success, `{coverage, refusal: {code, detail}}` for a refusal -- both typed, structured payloads a caller composes from, never pre-written paragraphs.

**`node scripts/probe-brain-contract.cjs` full output**, recorded verbatim in plan 339-13's SUMMARY, matched against the expected-inversion list here for the record:
- Leg a (loop_tools in tools/list): PASS. Matches "ports cleanly."
- Leg b: FAILED as documented. `text2cypher` returned HTTP 200 (Theo serves it, no 403); `brain_ask_anything` also returned 200 rather than an allowlist-gate 403. Matches "Theo has no allowlist gate at all."
- Leg c: FAILED as documented. `c2` (write attempt) returned `PLAN_REJECTED: query classified 'rw', not read-only` -- a typed code, not `BoundedReadRefusal` text. Matches "Theo's refusals are typed codes." `c1`/`c3` additionally hit explicit rate-limiting (`-32005 Rate limit exceeded`), a separate, named, corroborated condition, not part of the documented inversion itself.
- Leg d (search/brain_search, no local-path leak): PASS. Matches "ports cleanly."
- Leg e (index dispositions): FAILED as documented. Theo's Aura instance carries neither `mindrian_methodology_vec` nor `mindrian_methodology_vec_openai`. Matches "asserts Memgraph index names Theo's Aura instance does not have."

No rollback invoked on legs b, c, or e -- all are the documented, expected reds.

**D-03 regression check, both shapes, run live in this plan** (not merely cited from 339-13) against a scratch room directory (`/tmp/flip-verify-room`, mechanically a `roomDir` for the capture path, not a real venture room):

Uncovered framework ("Adaptive Leadership", one of the 30 uncovered names): first call returned `null` (rate-limited), second attempt after backoff succeeded:
```json
{"coverage":{"matched":0,"total":420,"status":"empty"},"refusal":{"code":"FRAMEWORK_NOT_FOUND","detail":"no live `:Framework` carries the name `Adaptive Leadership`"}, ...}
```
Captured queue entry: `probe_provenance: "orchestration_readiness_theo_refusal@FRAMEWORK_NOT_FOUND@2026-09-04T13:12:59Z"`. **The raw `detail` string ("no live \`:Framework\` carries the name...") does NOT appear anywhere in the captured queue entry** -- only the typed code `FRAMEWORK_NOT_FOUND` does, confirmed by direct inspection of the queue file. Canon Part 8 held in the shipped bytes.

Covered framework ("Lean Canvas"): succeeded on the first call:
```json
{"framework":"Lean Canvas","score":0,"inputs":{"has_structure":false,"has_ordering":false,"has_technique":false,"pattern_known":false},"evidence":{"structure_components":0,"ordering_edges":0,"technique_links":0,"orchestration_status":"draft"},"unsynced_inputs":["pattern_known"],"coverage":{"matched": ...}}
```
Captured queue entry: `probe_provenance: "orchestration_readiness_theo@2026-09-04T13:12:00Z"`, `readiness_score: 0`.

**Cold-start latency**: 1.726 seconds, Session T's own reading of the first successful `brain_stats` call after the flip cue, against the 20 second abort budget (carried forward from plan 339-13; no separate fresh-session cold-start figure exists, per the FLIP-12 gap named above).

**No write endpoint was called.** The `/register` reading (HTTP 200, opaque token) came from `_tryAutoRegister`'s own automatic call, the shipped path, not a manual `POST /register`.

### Task 2: The resume signal to Session T

Sent, exact text (see the message log; summarized here for the SUMMARY's own record): opening line `v2.0.0-beta.19 flip verified`, all six flip-day fields (URL, release, cold-start latency, `/register` status, decommission date explicitly blank with "not yet; incumbent still running as the rollback path," and the `brain_schema` flush answer verbatim `no flush needed: memo is process-local, keyed by origin since beta.17`), the probe leg inversions by name, the D-06a content note verbatim, and both D-03 regression entries. The version token matches `git describe --tags --abbrev=0` exactly: `v2.0.0-beta.19`. Sent well after Task 1's verification and before this SUMMARY's own close-out edits. Zero files touched under `/home/jsagi/Theo/`.

### Task 3: Close-out

`docs/testers/outbox/2026-09-03-theo-cutover.md`: `version` placeholder replaced with `v2.0.0-beta.19`. `status: drafted` and `sent_to: []` left unchanged; the suspend-date placeholder in the body left unchanged (Theo 09-12 Task 3 has not set one).

`.planning/ROADMAP.md` Phase 339 entry: `**Plans:**` updated to `14/14 plans complete`; the last plan checkbox (`339-14-PLAN.md`) checked; a close-out paragraph added recording both shipped tags, the bare Theo origin confirmed in the cache, the cold-start latency, the probe leg inversions, the D-03 shapes, and that the resume signal was sent. Five deliberately-open items named with owners: the decommission (Theo 09-12 Task 3, operator-held, soak set by the navigator), the tester note send (the operator's, after a decommission date exists), the re-census against Theo (deferred per 339-07's stated reasons), `chain-recommender.cjs`'s Theo-shape adaptation (D-03 consumer 2, named follow-up), and the `brain_write`/`ingest_framework` write paths (`WRITE_PATH_DISABLED` by design, a separate phase's territory).

`.planning/REQUIREMENTS.md` FLIP rows deliberately left `- [ ]`, per the plan's own instruction: finalization belongs to `/gsd-verify-work`, which measures rather than asserts.

`.planning/STATE.md`: `state.record-session` run; frontmatter read back afterward. The documented resync-clobber bug tripped again (this time compounded by Phase 275's own concurrent close-out, which finished its final plan, `275-08`, during this phase's own Part B): `stopped_at`/`status`/`last_activity` reverted to Phase 275's own values, and `percent` reverted to a stale figure. Hand-corrected per this file's established convention; see the NOTE comment at the top of `STATE.md` naming this plan.

## Deviations

1. **FLIP-12's fresh-session requirement could not be met from inside this continuing session.** Named explicitly to the navigator rather than assumed satisfied; the navigator's explicit ruling (accept 339-13's direct evidence) is the authorization for closing this gate, not this plan's own judgment.
2. **STATE.md resync-clobber, again**, this time compounded by a second concurrent phase's (275) own legitimate close-out landing in the same window. Hand-corrected, root cause not re-investigated, per this file's own standing convention.

## Requirements Completed

FLIP-12 -- the installed release is proven to talk to Theo end to end (by accepted direct evidence), every documented red is recorded as expected, and Phase 339 is closed with both shipped versions on record and every deliberately-open item named with its owner.
