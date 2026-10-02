---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 16
subsystem: tool-honesty-close-out
tags: [mcp-tool-honesty, phase-close, tri-polar, desktop-verification, requirements-registration]

requires:
  - phase: 276-12
    provides: "claim_write MCP tool (the write the Desktop check exercises)"
  - phase: 276-14
    provides: "meeting gate wiring"
  - phase: 276-15
    provides: "gate roll-up and reconciled validation contract"
provides:
  - ".planning/REQUIREMENTS.md: TOOLHON-01..14 registered with measured evidence (commit 4d600af91)"
  - ".planning/ROADMAP.md: finding count reconciled; 'Carried forward (named owners)' block naming 14 deferred items (commits 4d600af91, d5ca9cfa5)"
  - "CHANGELOG.md Unreleased entry for the phase (4d600af91)"
  - "meeting-file-meeting-false-success RCA resolved and moved to resolved/ (d5ca9cfa5)"
  - "Dev-research compositing trail landed in both homes: ~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-same-disease-consolidation/ and ~/MindrianOS/research/2026-09-03-same-disease-consolidation/"
  - "Task 3 Tri-Polar Desktop verification evidence (this file)"
affects: ["desktop-session-binding-fallback (new RCA, routing defect found by Task 3)", "test-birth-registry-leak (new RCA, root cause of Task 3's fallback target)"]

key-decisions:
  - "Task 3 outcome recorded as HONESTY VERIFIED / ROUTING FAILED: the tool's response matched room.db exactly, so the phase's subject (no false success) holds on Desktop; the write did not land in the bound room, which is a separate defect handed to its own RCA rather than reopening this phase."

duration: "Tasks 1-2 on 2026-09-04; Task 3 on 2026-10-02"
completed: 2026-10-02
---

# Phase 276 Plan 16: Phase close-out Summary

**Phase 276 closes: TOOLHON-01..14 registered, every deferral has a named owner, the meeting RCA is resolved, and the one surface no test could reach (Claude Desktop) was checked by the navigator against room.db: the tool told the truth about where it wrote.**

## Tasks

| Task | Status | Commit |
|------|--------|--------|
| 1. Register TOOLHON-01..14, reconcile ROADMAP count, CHANGELOG entry | done 2026-09-04 | 4d600af91 |
| 2. Register named follow-ups, resolve meeting RCA, composite trail | done 2026-09-04 | d5ca9cfa5 (trail staged; since landed in both homes, verified 2026-10-02) |
| 3. Tri-Polar Desktop verification (checkpoint:human-verify) | done 2026-10-02 | this SUMMARY |

## Task 3 evidence (navigator, 2026-10-02)

**Surface:** Claude Desktop (Windows 11), MindrianOS MCP server from the dev tree
(`/home/jsagi/dev/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs`, v2.0.0-beta.56)
launched via `wsl.exe -d Ubuntu` through the 267-04 stdio tee. Cowork not exercised.

**Room:** `ador-ip-test` (existing room, used as scratch).

**room.db before** (read from a terminal, outside the session):

```
mtime/size: 2026-07-13 10:20:19.804488159 +0300 3715072
```

**Navigator actions:** "list my rooms", bind `ador-ip-test`, "pick my next
methodology", then filed: "In today's test sync, the team agreed the probe room is
throwaway and nothing in it is real."

**Bind response (quoted from Desktop):** "The bind failed because the connection
didn't provide a session ID. I'll try again with an explicit one. This session is
now bound to ador-ip-test ... I bound it under the explicit ID
claude-ai-chat-2026-10-02."

**Tool response for the claim (quoted from Desktop):** "The claim was written, but
not into ador-ip-test. The tool put it here: Room: /tmp/birth-idem-2RRSMu/idem-room
Node: claim:nosession:8e71dd1e (type: fact, status: proposed) ... ador-ip-test has
nothing new in it. The claim is still only proposed, not confirmed."

**room.db after, ador-ip-test** (direct read):

```
mtime/size: 2026-07-13 10:20:19.804488159 +0300 3715072
```

Unchanged: nothing landed in the bound room.

**Direct read of the fallback room's db**
(`/tmp/birth-idem-2RRSMu/idem-room/.mindrian/room.db`, node:sqlite readOnly):

```
[ { id: 'claim:nosession:8e71dd1e', type: 'claim', review_status: 'proposed', created_at: 1790904288046 } ]
```

## The five questions

1. **Surface:** Claude Desktop.
2. **Did the room db mtime move?** The bound room's (`ador-ip-test`) did not. The
   write went to the fallback room's db.
3. **Does the claim node exist with the filed knowledge_type?** Yes, as
   `claim:nosession:8e71dd1e` (fact), in the fallback room, not the bound room.
4. **confirmed or proposed?** `proposed`. No gate was approved on Desktop.
5. **Does what the tool TOLD match what the database SHOWS?** **Yes.** The tool
   named the exact room path, node id, type and status, and the direct read
   confirms all four. It also stated, correctly, that ador-ip-test got nothing.

**Verdict:** HONESTY VERIFIED on Desktop. This phase's disease (claiming success
it did not deliver) did NOT recur: the tool reported a real write, in the real
place it happened. ROUTING FAILED: the write ignored the bind. Per the plan's
step 8 that is not a tool-vs-db disagreement, so it does not block this phase's
close; it is a new defect, routed:

- `.planning/debug/desktop-session-binding-fallback.md`: on Desktop stdio
  `room_bind` fails with `no_session_id`; an explicit-sessionId bind is ignored by
  `claim_write` and state reads, which fall back to the global registry `active`.
- `.planning/debug/test-birth-registry-leak.md`: why the fallback target was a
  /tmp fixture. `tests/test-section-nodes-birth-and-migration.cjs` births rooms
  without sandboxing the registry and set the real registry's `active` to
  `idem-room` at 2026-10-02T01:21:38Z. Registry repaired by the navigator the
  same day (backup `registry.json.bak-idem`).

## Deviations

- Task 3 ran 28 days after Tasks 1-2. The gap was a missing SUMMARY, not missing
  work: the two Task 1-2 commits were on main, and the safe-resume gate caught that
  before any re-execution.
- The compositing trail was staged in d5ca9cfa5 because a write-scope guard blocked
  it. It was found already landed in both homes on 2026-10-02, so no new action was
  needed.

## Next

Phase 276 complete. The routing defect is owned by `desktop-session-binding-fallback`.
The test leak is being fixed under `test-birth-registry-leak`.
