---
phase: 367
round: 5 (cap)
target: 367-DESIGN.md r6 -> r7
reviewers:
  zoom_out: completed (0 Blocker, 2 Major, 4 Nit)
  design_critic: completed (0 Blocker, 6 Major, 3 Nit)
  codebase_details: completed (0 Blocker, 5 Major, 6 Nit)
  implementation_readiness: completed (2 Blocker, 3 Major, 6 Nit)
clean_round: false
converged: false (cap of 5 rounds reached)
trend: R1 8 Blockers (root design) -> R2 6 -> R3 6 -> R4 6 -> R5 2 (both build pins, no design blocker)
---

# Goldfish review, round 5: resolution (all FIXED in r7)

Blockers
- IR-B1 qef hook census test: added to slice b with a P367 block and a TABLE row.
- IR-B2, DC-4, CD-N3 spawn holds the hook pipes: `( node ... || true ) </dev/null >/dev/null 2>&1 &` in both scripts; AC8 measures stdout EOF.

Majors
- ZO-M1, DC-6 held/ folder: CUT; a refused card stays and counts cards_failed; lock and transaction errors are room outcomes.
- ZO-M2, DC-2 born room key (shared by copied rooms): back to sha256(realpath(room)); AC4 copied-room leg.
- DC-1, ZO-N2 card room: binding first (source session.primary), then cwd room; ancestor rule; AC4 legs for cwd outside a room and a sub-room cwd.
- DC-3 async handlers: Promise.resolve().then(handler).finally(spawn); AC2 last-call leg; AC8 async rejection.
- DC-5 detached child survival: spike S1 blocks slice c; worker_threads declared fallback.
- CD-M1 gate skip: readGateAnswerAnchor (approve, reject, defer, mirrors); reject leg.
- CD-M2 legacy check: read-only open first; the write door would migrate; null write handle -> room_db_busy.
- CD-M3 on-stop budget: re-based by its own rule to the measured count.
- CD-M4 session source: used only when source is session.primary.
- CD-M5, IR-N wrapper side effects: classifyMcpWriteRoom factored out, no readiness, mint or log; AC8 asserts 0 gates.
- IR-M1 wrong room and folder litter: ctx passed, no spawn on source cwd; no lock, mkdir or status file without room.db; --room needs .room-root or registry.
- IR-M2 gate reader: new findRaisedGatesByCard over all gate_raised rows; 10-minute wait before recording a gate-matched card (DC-N3).
- IR-M3 census method: wireSnapshot per surface, union.
Nits fixed: error-code mapping, room_db_busy source, S0 gate header and session id checks, q_index rule, caps of 200, pid_start_match, empty --session, AC2 session registration, gate-raised path, stale dirty-token reference, G2 wording.
