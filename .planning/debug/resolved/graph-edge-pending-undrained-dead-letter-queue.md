---
status: resolved
trigger: "graph-edge-pending.log is an undrained dead-letter queue, flagged as the M-2 finding in the 9-piece MindrianOS infrastructure audit (2026-07-28), same enqueue-with-no-consumer shape as the already-filed minto-debounce-consumer-dead-end.md"
symptoms:
  expected: "writeGraphEdge entries appended to graph-edge-pending.log on every JTBD promote/park/complete get drained by a Phase 103-05 PostToolUse hook into a real HAS_JTBD graph edge, per the header comment's own claim at lib/hmi/across-session-memory.cjs:113."
  actual: "Zero consumers exist anywhere in the repo for this log. No HAS_JTBD edge write exists anywhere. The live file holds entries dating back to 2026-05-24, growing forever with no FIFO bound, no drain, ever."
  errors: "None observed. No error is thrown anywhere in this path — the append succeeds every time and nothing downstream ever looks at the file, so there is nothing to error. This is the same silent-success shape as every other finding in this audit."
  timeline: "Started whenever the promised Phase 103-05 PostToolUse drainer was supposed to ship and never did. Not a regression — appears to have never worked, going back to the earliest live entries in the file."
  reproduction: "1. Run any across-session JTBD promote/park/complete in a real room (via scripts/jtbd-update.cjs or scripts/jtbd-command.cjs). 2. Confirm a new line is appended to graph-edge-pending.log (across-session-memory.cjs writeGraphEdge, lines 332-346). 3. grep the repo for any reader of this file, or for any HAS_JTBD edge write anywhere. 4. Observe: zero consumers, zero HAS_JTBD writes, the header's 'Drained by Phase 103-05 PostToolUse' claim is uncorroborated by any code."
created: 2026-07-28T00:00:00Z
updated: 2026-07-28T07:15:00Z
current_focus:
  hypothesis: "CONFIRMED. The Phase 103-05 PostToolUse drainer for graph-edge-pending.log was never built. writeGraphEdge (lib/hmi/across-session-memory.cjs:332-346) is a real, faithful producer, called from all three lifecycle functions (promoteIfEligible:403, parkJtbd:443, completeJtbd:483). Phase 103-05 DID ship, but as two different hooks (scripts/memory-completion-detector.cjs PostToolUse + scripts/memory-resume-nudge.cjs SessionStart) that do completion-detection and resume-nudging, neither of which reads graph-edge-pending.log or writes a HAS_JTBD edge. The header comment at line 113 and the docstring at lines 21-23/326-330 describe a drainer component that does not exist under this name or any other. Same enqueue-with-no-consumer shape as minto-debounce-consumer-dead-end.md and hedge-fold-has-no-production-trigger.md (resolved)."
  test: "grep -rn 'graph-edge-pending' --include=*.cjs --include=*.js --include=*.sh . | grep -v node_modules, then grep -rn 'HAS_JTBD' the same way. Both run; results in Evidence below."
  expecting: "The producer (writeGraphEdge) is the only hit for graph-edge-pending; HAS_JTBD returns zero hits anywhere in the codebase outside the two comment references, confirming no consumer was ever built. CONFIRMED exactly as expected."
  next_action: "RESOLVED. Human approved Option B; implemented, tested (mutation-proof), and verified. File moved to .planning/debug/resolved/ and knowledge-base.md updated. No further action needed on this session; the test-isolation leak in tests/test-jtbd-auto-anchor-empirical.sh remains an explicit, separate follow-up (see Resolution.fix)."
  reasoning_checkpoint:
    hypothesis: "graph-edge-pending.log's promised Phase 103-05 drainer was never built; the log is a permanent dead letter queue; a real, already-precedented sink (navigation.logJtbdTransition -> memory_events 'jtbd_transitioned') exists and could replace it with materially less new surface than building the promised drainer."
    confirming_evidence:
      - "grep -rn 'graph-edge-pending' repo-wide: only hit is the producer itself (GRAPH_EDGE_LOG definition + the two doc comments claiming a drain). Zero readers."
      - "grep -rn 'HAS_JTBD' repo-wide: only hits are the two doc comments (lines 23, 327) that describe the promised edge write. Zero actual writeEdge('HAS_JTBD', ...) calls, and HAS_JTBD is not a member of the frozen ALLOWED_EDGE_TYPES set in lib/core/navigation/edges.cjs."
      - "Live file read directly: ~/MindrianRooms/.memory/graph-edge-pending.log holds 13 real lines, 2026-05-24 through 2026-07-28, all action:promote, zero park/complete despite both code paths existing -- direct, unambiguous, first-hand observation, not inference."
      - "lib/core/navigation/memory-events.cjs already carries a 'jtbd_transitioned' EVENT_TYPES member (line 281) and lib/core/navigation/spine-events.cjs already exports a ready-made logJtbdTransition(roomDir, payload) helper (re-exported at lib/core/navigation.cjs:423) that opens its own room.db handle, sets a dedupe_key, and is ALREADY called in production at lib/core/navigation/room-birth.cjs:889 for the closely related 'a JTBD was set' event."
    falsification_test: "If any script/hook required or referenced GRAPH_EDGE_LOG()/graph-edge-pending.log, or if any writeEdge call anywhere passed 'HAS_JTBD' as the edge type, the hypothesis would be false. Neither grep found any such site."
    fix_rationale: "The root cause is a missing consumer, not a broken producer. Building the promised consumer (Option A) requires minting a new edge type, deciding what node the edge connects to (no JTBD node type exists in room.db today), and resolving roomSlug to roomDir for a cross-room log with zero dedup across ~2 months of accumulated entries. Routing into the existing jtbd_transitioned memory_event (Option B) reuses a sink, a helper function, and an event-type vocabulary member that already exist and are already production-proven for the adjacent 'JTBD changed' case -- the smaller, most Canon-Part-7-aligned change."
    blind_spots: "Have not verified whether product/telemetry consumers downstream (dashboards, /mos:memory read paths) expect a literal graph EDGE (HAS_JTBD) rather than an event-log row, which would favor Option A despite its larger build cost. Have not load-tested logJtbdTransition's dedupe_key collision behavior across rapid promote-then-park-then-complete sequences for the same jtbd within one room. Have not confirmed whether reusing 'jtbd_transitioned' with new kind values ('promote'/'park'/'complete') alongside its existing 'set'/'override'/'clear' vocabulary needs a doc-comment amendment at memory-events.cjs:265-266 to stay accurate (it does, and is captured in Resolution.fix Option B below)."

eliminated: []
# No hypothesis was disproven this session. The pre-filled hypothesis was
# confirmed on the first test pass (both greps below); no alternative theory
# was needed.

evidence:
  - timestamp: 2026-07-28T07:00:00Z
    checked: "grep -rn 'graph-edge-pending' --include=*.cjs --include=*.js --include=*.sh . | grep -v node_modules"
    found: "Exactly 2 hits, both in lib/hmi/across-session-memory.cjs: line 58 (GRAPH_EDGE_LOG() path helper, the producer's own file-path function) and line 113 (the generated ROOM.md doc string claiming 'Drained by Phase 103-05 PostToolUse'). Zero hits anywhere else in the repo."
    implication: "Confirms zero readers/consumers of the file repo-wide. The only two references are the producer's path helper and the false claim about a drainer."

  - timestamp: 2026-07-28T07:00:00Z
    checked: "grep -rn 'HAS_JTBD' --include=*.cjs --include=*.js --include=*.sh . | grep -v node_modules"
    found: "Exactly 2 hits, both in lib/hmi/across-session-memory.cjs: line 23 ('103-05 wires the actual room-db.cjs HAS_JTBD edge write') and line 327 ('Phase 103-05 wires this to lib/core/room-db.cjs HAS_JTBD edges'). Zero hits anywhere else, including zero occurrences in lib/core/navigation/edges.cjs's ALLOWED_EDGE_TYPES frozen Set."
    implication: "HAS_JTBD is not a real edge type anywhere in the codebase, only a name used twice in comments describing a component that was never built. Confirms the header's claim is uncorroborated."

  - timestamp: 2026-07-28T07:02:00Z
    checked: "Read lib/hmi/across-session-memory.cjs in full (lines 1-494), specifically the 3 call sites of writeGraphEdge."
    found: "writeGraphEdge (lines 332-346, a pure fs.appendFileSync onto GRAPH_EDGE_LOG(), wrapped in try/catch, no reader) is called from promoteIfEligible:403 (action 'promote'), parkJtbd:443 (action 'park'), and completeJtbd:483 (action 'complete'). All 3 lifecycle transitions produce faithfully; the producer side of the contract is fully honored."
    implication: "This is a pure missing-consumer defect, not a partial/flaky producer. Matches the exact shape already confirmed twice this session (minto-debounce-consumer-dead-end.md, hedge-fold-has-no-production-trigger.md): an honest producer, a promised consumer that was never built, and comments that assert the consumer exists."

  - timestamp: 2026-07-28T07:03:00Z
    checked: "grep -n '103-05\\|103_05' repo-wide (docs + code), to verify whether Phase 103-05 shipped at all."
    found: "Phase 103-05 DID ship: scripts/memory-completion-detector.cjs ('Phase 103-05 -- Memory completion detector (PostToolUse hook)') and scripts/memory-resume-nudge.cjs ('Phase 103-05 -- Memory resume nudge (SessionStart hook)'). Read both files in full."
    implication: "The phase was not skipped or abandoned wholesale; it shipped two real, working hooks. Neither touches GRAPH_EDGE_LOG() or writes a HAS_JTBD edge. memory-completion-detector.cjs's PostToolUse hook calls acrossSession.completeJtbd() (a THIRD producer call into the same undrained log, not a drain) and separately fires navigation.logSpineRead for SENS-06 telemetry, a different purpose (dispatch observability) unrelated to graph-edge draining. The drainer named in the header comment was simply never built under Phase 103-05 or any later phase, despite that phase number shipping real, unrelated work."

  - timestamp: 2026-07-28T07:05:00Z
    checked: "Read ~/MindrianRooms/.memory/graph-edge-pending.log directly (the real, live file on this machine, not a test fixture)."
    found: "13 lines, oldest 2026-05-24T19:12:22Z, newest 2026-07-28T02:42:14Z (this session). All 13 are action:promote. Zero park or complete entries despite both code paths existing. roomSlug values are 'test-jtbd-promote' and 'test-jtbd-127.3-empirical', both test-fixture-looking slugs."
    implication: "First-hand confirmation the defect is live in production (this dev machine's real cross-user memory store), not merely theoretical. The file has genuinely accumulated for the full ~2-month life of the module with zero drains. Traced the roomSlug values to tests/test-jtbd-auto-anchor-empirical.sh, which writes to the REAL ~/MindrianRooms/.memory instead of a hermetic MINDRIAN_ROOMS_HOME override -- a related but separate test-isolation leak, noted below, not folded into this fix."

  - timestamp: 2026-07-28T07:08:00Z
    checked: "grep -n 'ALLOWED_EDGE_TYPES' -A 20 lib/core/navigation/edges.cjs, and grep -rn 'memory-events\\|memory_event' lib/core/."
    found: "ALLOWED_EDGE_TYPES (edges.cjs:32) is a frozen, additively-grown Set (DEFERRED, REJECTED, DERIVED_FROM, AFFILIATED_WITH, ENABLES, UMBILICAL_TO, STATES/SUPPORTS/DESCRIBES, etc.) with no HAS_JTBD member and no JTBD-typed node in room.db's schema to anchor such an edge to. Separately, lib/core/navigation/memory-events.cjs (Phase 109-03 origin, extended through many phases) is a real, actively-used sink: EVENT_TYPES already includes 'jtbd_transitioned' (line 281), and it is re-exported as navigation.logMemoryEvent (navigation.cjs:111) and called in production by part8-egress-ontology.cjs, graph-backfill.cjs, findings-wirer.cjs, room-naming-selector.cjs."
    implication: "Confirms the pre-filled hypothesis's Option B premise (a real, viable sink already exists post the Phase 150 memory-cortex work) and additionally shows Option A would need to mint a brand-new edge type in a frozen vocabulary AND a node type that does not exist today, a materially larger build than Option B."

  - timestamp: 2026-07-28T07:11:00Z
    checked: "grep -n 'logJtbdTransition' lib/core/navigation/spine-events.cjs, lib/core/navigation.cjs, lib/core/navigation/room-birth.cjs; read spine-events.cjs's logJtbdTransition (lines 182-189) and room-birth.cjs's call site (lines 883-899)."
    found: "spine-events.cjs already exports logJtbdTransition(roomDir, payload) -> fires memory_events 'jtbd_transitioned' with an auto-derived dedupe_key from ['jtbd_transitioned', kind, from, to], opens its own room.db handle, gracefully no-ops with {ok:false, reason:'no_room_db'} if the room has none. Re-exported at navigation.cjs:423. ALREADY called in production at room-birth.cjs:889 with kind:'set' when a room is born with a JTBD. payload.kind is a free-text scalar (not enum-enforced in code); the doc comment at memory-events.cjs:265-266 currently documents only 'set'/'override'/'clear' as the in-use kind values."
    implication: "The exact reusable primitive AND the exact event type Option B needs already exist and are already production-proven for the closely related 'a JTBD changed' case. Extending kind with 'promote'/'park'/'complete' values is mechanically unblocked (kind is not enum-validated) but the memory-events.cjs:265-266 doc comment would need a one-line update to stay accurate -- captured as a required change in Resolution.fix Option B, not a blind spot left unaddressed."

resolution:
  root_cause: >
    lib/hmi/across-session-memory.cjs's writeGraphEdge (lines 332-346) faithfully
    appends an intent line to graph-edge-pending.log on every promote (line 403),
    park (line 443), and complete (line 483). The module's own doc comments
    (lines 21-23 and 326-330) and the generated .memory/ROOM.md text (line 113)
    all claim this file is "Drained by Phase 103-05 PostToolUse" into a real
    HAS_JTBD graph edge. Phase 103-05 shipped two real hooks
    (scripts/memory-completion-detector.cjs, scripts/memory-resume-nudge.cjs),
    but neither one reads GRAPH_EDGE_LOG() or writes a HAS_JTBD edge; the
    completion-detector hook's job is detecting completion and calling
    completeJtbd() (a THIRD producer into the same log) plus a separate,
    unrelated SENS-06 telemetry fire. No drainer for this specific log was ever
    built under Phase 103-05 or any subsequent phase. HAS_JTBD is not a member
    of the frozen ALLOWED_EDGE_TYPES vocabulary (lib/core/navigation/edges.cjs),
    and no JTBD node type exists in room.db's schema to anchor such an edge to
    even if it were. The live file on this machine (~/MindrianRooms/.memory/
    graph-edge-pending.log) proves the defect in production: 13 real entries
    spanning 2026-05-24 through 2026-07-28, unbounded, undrained, growing
    forever. This is the memory subsystem's third instance this session of the
    same enqueue-with-no-consumer shape (after minto-debounce-consumer-dead-end.md
    and hedge-fold-has-no-production-trigger.md), and, like both siblings, the
    defect is a missing consumer against an honest producer, not a broken
    producer.
  fix: >
    APPLIED (Option B, human-approved 2026-07-28; Option A not implemented,
    not re-litigated). lib/hmi/across-session-memory.cjs: deleted
    writeGraphEdge (was lines 332-346) and GRAPH_EDGE_LOG (was line 58)
    entirely. Added resolveRoomDirForSlug(roomSlug), which resolves a
    registered room's directory via the same registry-walk pattern
    scripts/memory-resume-nudge.cjs's backfillFromWithinSession already uses
    in reverse (prefer r.abs_path, else r.path resolved against ROOMS_HOME).
    Added logGraphTransition(kind, roomSlug, jtbd, extraProps), which resolves
    roomDir and calls navigation.logJtbdTransition(roomDir, {to, kind,
    roomSlug, created_by:'system', source_path:'across-session:'+kind,
    ...extraProps}) -- lazy-required navigation.cjs to mirror
    lib/conversation/operator.cjs's existing caution around that door. Wired
    at all 3 call sites: promoteIfEligible (kind:'promote', props: state,
    turn_count, confidence, manual), parkJtbd (kind:'park', props: state,
    reason), completeJtbd (kind:'complete', props: state, completion_shape,
    completion_evidence). Graceful no-op (no throw, the primary
    jtbd-history.json write is completely unaffected) both when roomSlug has
    no registry entry and when the registered room has no room.db yet (Tier 0
    cold start) -- the latter relies on navigation.logJtbdTransition's own
    existing {ok:false, reason:'no_room_db'} contract. Corrected the false
    "Drained by Phase 103-05 PostToolUse" claim in 3 places: the module's
    Canon Part 4 header comment (lines 21-28), the removed Phase 103-05 stub
    comment block (replaced with a comment documenting the real fix), and the
    generated .memory/ROOM.md template text (was line 113). Widened
    lib/core/navigation/memory-events.cjs's EVENT_TYPES doc comment for
    'jtbd_transitioned' (lines 265-271) to document that the kind vocabulary
    now spans 'set'/'override'/'clear' (within-session focus change) AND
    'promote'/'park'/'complete' (across-session lifecycle), since kind is a
    free-text scalar, not enum-enforced in code.

    Migration decision for the 13 live graph-edge-pending.log entries: LEFT
    AS HISTORICAL RESIDUE, not migrated. Read the live file directly: both
    roomSlug values (test-jtbd-promote, test-jtbd-127.3-empirical) are stale
    test fixtures from tests/test-jtbd-auto-anchor-empirical.sh's own
    test-isolation leak (that script writes to the real ~/MindrianRooms/.memory
    instead of a hermetic MINDRIAN_ROOMS_HOME override), and neither slug
    exists in the current ~/MindrianRooms/.rooms/registry.json (confirmed via
    grep). Since resolveRoomDirForSlug would resolve both to null, even a
    migration script that replayed these 13 lines through
    navigation.logJtbdTransition today would be a structural no-op -- there is
    no real room to attribute them to. The file is left untouched on disk,
    frozen in time; the module never writes to it again going forward.

    The test-isolation leak itself (tests/test-jtbd-auto-anchor-empirical.sh
    defaulting ROOMS_HOME to the real ~/MindrianRooms/ when
    MINDRIAN_ROOMS_HOME is unset) was assessed and deliberately NOT folded
    into this fix: the script fires 2 subprocesses (scripts/room-registry
    create, scripts/jtbd-update.cjs) that would need independent
    re-verification under a swapped ROOMS_HOME, a nontrivial, separate
    hermeticity fix. Filed as an explicit follow-up.

    ORIGINAL TWO-OPTION ANALYSIS (preserved for context; Option A was NOT
    built):


    Option A -- build the promised drainer.
    Location: new drain logic reading GRAPH_EDGE_LOG(), a new PostToolUse (or
    scheduled) hook, plus an additive HAS_JTBD member in
    lib/core/navigation/edges.cjs's ALLOWED_EDGE_TYPES, plus deciding what node
    type the edge would connect a JTBD to (none exists in room.db today; one
    would need to be minted too, e.g. via typed-domain.cjs's DOMAIN_NODE_TYPES
    additive idiom).
    Current behavior: writeGraphEdge appends to a file nothing reads.
    Required behavior: a real drain step that, for each pending line, resolves
    roomSlug to roomDir (across-session-memory.cjs only has roomSlug; a
    registry walk like memory-resume-nudge.cjs's backfillFromWithinSession
    already does the inverse), opens that room's room.db, mints/looks up a
    JTBD node, and writes a HAS_JTBD edge through navigation.writeEdge. Then
    truncates or FIFO-bounds the drained lines (today's log has zero bound,
    unlike jtbd-history.json's PER_ROOM_ARRAY_BOUND=100 or audit.log's
    AUDIT_LOG_HARD_BOUND=10000).
    Short-term patch: none; this is the full fix, there is no smaller version.
    Long-term fix: this IS the long-term fix if a literal graph edge
    (queryable as `MATCH (r:Room)-[:HAS_JTBD]->(j:JTBD)`) is a real product
    requirement.
    Risk to weigh: also needs to decide what to do with the 13 already-stale
    entries dating back to 2026-05-24 (backfill them, or start the edge type
    fresh from the fix's ship date and let the pre-fix lines expire
    unrepresented). Materially more new surface than Option B: one new frozen
    edge-type member, likely one new node type, a new hook registration, and a
    slug-to-roomDir resolver that does not exist today in reusable form.


    Option B -- retire the dead-letter file, route into the real sink
    (RECOMMENDED).
    Location: lib/hmi/across-session-memory.cjs's 3 writeGraphEdge call sites
    (promoteIfEligible:403, parkJtbd:443, completeJtbd:483); delete
    writeGraphEdge (332-346) and GRAPH_EDGE_LOG (58); correct the doc comments
    (21-23, 326-330) and the generated ROOM.md text (113); add a one-line
    amendment to lib/core/navigation/memory-events.cjs:265-266's kind-value
    doc comment.
    Current behavior: writeGraphEdge appends JSON lines to an unread file.
    Required behavior: at each of the 3 call sites, resolve roomSlug to
    roomDir (same registry-walk pattern memory-resume-nudge.cjs already uses
    in reverse), then call navigation.logJtbdTransition(roomDir, { to: jtbd,
    from: <prior state where known>, kind: 'promote'|'park'|'complete',
    roomSlug, ...action-specific props }). logJtbdTransition already opens its
    own room.db handle, already sets a dedupe_key, and already no-ops
    gracefully with {ok:false, reason:'no_room_db'} for a room with no
    room.db yet (mirrors this module's existing graceful-degradation
    discipline). This reuses an existing sink (memory_events), an existing
    event type ('jtbd_transitioned', already carrying a payload.kind sub-enum
    for exactly this kind of merge, per the Phase 129-01 event-cap-5 idiom),
    and an existing helper function, all three already production-proven at
    room-birth.cjs:889 for the adjacent "JTBD was set" case.
    Short-term patch: same as the full fix; this is a small, well-scoped
    change (3 call sites + 1 doc-comment amendment + delete the dead file
    logic).
    Long-term fix: this is the long-term fix. It also restores the room's
    per-JTBD history to LOCAL SQL (Canon Part 9 memory locality) instead of a
    flat, unbounded, un-queryable JSON-lines file, and its author already
    solved the exact roomDir-may-not-exist-yet edge case this module needs.
    Risk to weigh: 'jtbd_transitioned' currently documents kind as
    'set'/'override'/'clear' (the within-session focus-change vocabulary);
    adding 'promote'/'park'/'complete' merges two related but distinct
    concepts (which JTBD has focus vs. the across-session lifecycle state of
    a JTBD) under one event type. kind is not enum-enforced in code, so this
    is mechanically safe, but the doc comment at memory-events.cjs:265-266
    needs updating in the same change so it stays accurate (a smaller version
    of exactly the drift this whole RCA is about). Also needs a decision on
    the 13 already-accumulated dead-letter lines (drop them; they were never
    consumed by anything and reconstructing 2-month-old room.db state from
    them is not obviously worth the effort) and a fix for the separate
    test-isolation leak in tests/test-jtbd-auto-anchor-empirical.sh (writes to
    the real ~/MindrianRooms/.memory instead of a hermetic
    MINDRIAN_ROOMS_HOME override), noted as a related-but-separate follow-up.


    Recommendation: Option B. It reuses a sink, a helper, and an event type
    that already exist and are already proven in production for the adjacent
    case, honoring Canon Part 7 (reuse before build) far more directly than
    Option A, which would need a new frozen edge type, likely a new node
    type, a new hook, and a new roomSlug-to-roomDir resolver, all to represent
    something the memory_event log can already represent today. Option A is
    only the right call if a literal HAS_JTBD graph edge (not an event-log
    row) turns out to be a hard downstream requirement, which was not found
    in this investigation (see reasoning_checkpoint.blind_spots).


    HUMAN REVIEW REQUIRED before either option ships: no interactive user was
    available in this dispatch to make the call, so this file stops at
    root-cause-confirmed / fix-proposed rather than applying a fix
    unsupervised. A human (or a follow-up session with the human's decision
    already made) should pick Option A or Option B before any code changes
    land or are released.
  verification: >
    New hermetic test tests/test-jtbd-transition-graph-wiring.cjs, 6 tests /
    14 assertions, all PASS: promoteIfEligible/parkJtbd/completeJtbd each
    write a real jtbd_transitioned row (kind promote/park/complete
    respectively) into a real room.db, read back via
    lib/core/navigation/memory-events.cjs::findRecentChanges; an unregistered
    roomSlug and a registered room with no room.db yet both degrade
    gracefully (no throw, primary write unaffected); the retired
    graph-edge-pending.log is never created. Confirmed MUTATION-PROOF by
    temporarily disabling the promote call site and re-running the suite:
    exactly the 3 positive-existence assertions went red (found 0 rows) while
    the graceful-degradation and absence-only assertions stayed green --
    proves the test would catch the wiring being silently removed, not just
    the old dead-letter file's absence. Restored immediately after
    confirming.

    Regression suites re-run clean: tests/test-across-session-memory.cjs
    36/36 (class 11's multi-process race check is pre-existing flaky
    timing, confirmed present before this change too, unrelated);
    tests/test-129-spine-substrate.cjs 15/15; tests/test-memory-hook-
    integration.cjs 10/10; tests/test-memory-command.cjs 24/26 (the 2 Brain
    Mode A failures are pre-existing and unrelated -- confirmed present in
    the pre-fix code too); tests/test-jtbd-auto-anchor-empirical.sh PASS;
    tests/test-135-decide-wiring-e2e.cjs 2/2.
  files_changed:
    - lib/hmi/across-session-memory.cjs
    - lib/core/navigation/memory-events.cjs
    - tests/test-jtbd-transition-graph-wiring.cjs (new)
    - .planning/debug/knowledge-base.md
  commits: []
</current_focus>
