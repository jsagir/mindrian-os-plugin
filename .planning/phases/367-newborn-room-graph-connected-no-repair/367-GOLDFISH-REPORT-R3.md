---
phase: 367
round: 3
target: 367-DESIGN.md r4 -> r5
reviewers:
  zoom_out: completed (0 Blocker, 5 Major, 6 Nit)
  design_critic: completed (2 Blocker, 11 Major, 9 Nit)
  codebase_details: completed (3 Blocker, 14 Major, 9 Nit)
  implementation_readiness: completed (1 Blocker, 9 Major, 8 Nit)
clean_round: false
---

# Goldfish review, round 3: resolution (all FIXED in r5 unless marked)

Blockers
- CD-B1, IR-M4 repeat line: existing-id SELECT skip; confirmNode ok:false throws inside withRoomTx.
- CD-B2, DC-B2, IR-M3 (R2 DC-M4 re-opened): room from resolveRoomRoot(cwd), never the registry; AC7 has an active registry pointing at B.
- CD-B3, IR-M4 writeReasoningNode call shape: gate.cjs:816-822 precedent with epistemicType, sourcePath, origin.
- DC-B1 no question text in the line: question and chosen (500-char cut) in the line, under the mac; AC4 asserts the text.
- IR-B1 missing test pins: EVENT_TYPES pins avoided (no new event type, ZO-M1); on-stop budget 680 -> 682; test-359 sha re-bases; test-3696 D2; census deltas PostToolUse 9 -> 10, +1, total 42.

Majors
- ZO-M1 card_answered event: CUT (confirmNode writes the audit event).
- ZO-M2, CD-M9, IR-M5 shared queue: CUT; inline claim, room key in the file name, no cap.
- ZO-M3, CD-M1 enumerators: one walker in section-registry.cjs; scaffold and sub-room files excluded; backfill uses it; rebuildGraph scope unchanged and the difference is tested.
- ZO-M4, DC-M3 lock: job-lock.cjs per room path, plus lowerWorkerPriority and armBackstop moved to bg-worker.cjs.
- ZO-M5, IR-M9 AC12: the runner joins the large room leg as a third child.
- DC-M1 cross-room replay: room_key = sha256(realpath(room)) in the line and the mac; foreign key rejected; canonical JSON.
- DC-M2 dirty file: counter token, re-check after release, teardown bump; claim restated.
- DC-M4 statusline CPU: governed tool set; never status_read; AC8 leg.
- DC-M5, CD-M6, CD-M7, IR-M2 wrapper: installCatchupWrapper export; finally + setImmediate; child error handler; forwards args; config untouched (wire snapshots); resolver and source rule; module-level map.
- DC-M6, IR-M1 runtime-instructions: removed from the pointer list (no rule there, 2000-byte budget).
- DC-M7 failure semantics: lines kept on every failure; no cap; legacy kept; confirm only from absent; key created wx.
- DC-M8 poison file: SAVEPOINT per file; quarantine after 2 failures.
- DC-M9, CD-N7 Stop placement: one line after the Part 8 drain (:48), both branches.
- DC-M10, CD-M11, IR-M8 resume: CUT (non-goal); SessionStart spawn after :132.
- DC-M11, CD-B2 Windows: Node resolvers only.
- CD-M2, IR-M7 doctor contract: read-only door kept; walker in section-registry; no allowlist entry; integers only.
- CD-M3 strings: enum integers; no "stale".
- CD-M5 sync batch: indexArtifactsBatch synchronous; open once per run; closeGraph.
- CD-M8 room id: room key defined.
- CD-M10 gate cards twice: skip a card matching a recorded gate card (match field pinned in the plan; UNVERIFIED).
- CD-M12 isolation contract: isolate-larry-voice.cjs and test-3696-isolation in slice b.
- CD-M13 session-start site: after :132.
- CD-M14 lock throws: write_lock_held vs lock_io_error; handle passed to releaseLock.
- IR-M6 state contract: cursor, cache schema, started_at, reasons, precedence, budget per run.
Nits fixed: census override, prior art operator-update.cjs:164-176, substrate regex form, paths, reasons enum, 32-bit hash, resolveByUser equality, canon phase map, key race, seams for AC8 and AC11, AC10 measurement, AC1 birth function.
