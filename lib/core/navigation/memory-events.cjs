'use strict';
// Phase 109-03 memory event log primitives. Internal to lib/core/navigation/.
// Re-exported by lib/core/navigation.cjs (Plan 109-04) as findRecentChanges (closed surface).
// logEvent is internal (not in the closed 13-function surface); other navigation/* helpers
// call it directly. Plan 109-02 setFocus writes focus_changed events inline (predates this
// plan); Plan 109-08 storeBrainSuggestions uses logEvent for brain_suggestion_received.

const crypto = require('node:crypto');

const EVENT_TYPES = Object.freeze(new Set([
  'node_created',
  'status_promoted',
  'status_rejected',
  'status_stale',
  'status_superseded',
  'focus_changed',
  'brain_query_sent',
  'brain_suggestion_received',
  'edge_added',
  'edge_removed',
  'opportunity_added',
  'opportunity_reacted',
  'opportunity_reflected',
  'opportunity_answered',
  'state_alias_migration',
  // Phase 88.2-00 Wave 0 extension (D-AMEND-02 telemetry mirror, R1-safe, INTERNAL Set)
  'selector_presentation',
  'selector_response',
  'selector_rejection_captured',
  'f6_round_completed',
  // Phase 89-07 Wave 0 extension (graph-native HARD RULE; ReverseSalientAgent dual-surface
  // telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md rule 3).
  'reverse_salient_detected',
  'reverse_salient_acted_on',
  // Phase 116-00 Wave 0 extension (graph-native HARD RULE; unresolved-tension-hook
  // dual-surface telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md
  // rule 3, mirroring the 89-07 ReverseSalientAgent pattern).
  'tension_detected',
  'tension_surfaced',
  'tension_resolved',
  'tension_decayed',
  'tension_skipped',
  // Phase 117-00 Wave 0 extension (graph-native HARD RULE; auto-explore-domains
  // dual-surface telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md
  // rule 3, mirroring the 116-00 + 89-07-00 ReverseSalientAgent extension pattern).
  // Per RESEARCH §4.7 + §8.6: 4 auto_explore lifecycle events + 1 Brain-canon-drift event:
  //   fired (fingerprint detection -> spawn) -> finding_surfaced (drain -> F.1)
  //   -> user_response (Explore/Skip/Later/Free-text) OR skipped (suppression).
  //   brain_canon_drift_observed (FourLenses Brain vs FiveLenses Canon; emitted once per
  //   session by 117-05 emitBrainCanonDrift via this EVENT_TYPES string).
  // Size-invariant note: additive set; downstream phases extend (see the Phase 88.2-00,
  // 89-07-00, 116-00, 117-00, 110-02 blocks). Tests assert a FLOOR + named membership,
  // not an exact count -- so a future phase adding an event type cannot regress baseline.
  'auto_explore_fired',
  'auto_explore_finding_surfaced',
  'auto_explore_user_response',
  'auto_explore_skipped',
  'auto_explore_sanitizer_hit',
  'brain_canon_drift_observed',
  // Phase 110-02 extension (Brain Context Packet Contract; D-07 + D-10 telemetry mirror):
  //   brain_packet_rejected   -> an outbound packet failed in-schema validation in
  //                              brain-client.sendPacket (reject hard -- thrown error).
  //   brain_response_rejected -> a Brain response failed out-schema validation -> degraded
  //                              soft, NOT ingested, no partial-ingest.
  //   brain_legacy_path_used  -> the forward-looking deprecation guard fired (no current
  //                              call site shipped in 110-02; see brain-client.cjs).
  // Additive extension only; mirrors the Phase 116-00 5-tension-strings idiom and the
  // 117-00 6-auto_explore-strings idiom. logEvent already rejects event_type values
  // outside EVENT_TYPES -- so these are accepted only because they are now IN the Set.
  'brain_packet_rejected',
  'brain_response_rejected',
  'brain_legacy_path_used',
  // Phase 124-02 extension (FEYNMAN.md Temporal Awareness; D-10 telemetry mirror):
  //   feynman_timeline_refreshed      -> the runner successfully rendered + wrote the
  //                                      sentinel-bounded ## Timeline (auto) section for one
  //                                      FEYNMAN.md (per section, per refresh).
  //   feynman_timeline_refresh_failed -> the runner caught an exception during render or write;
  //                                      watermark NOT updated; FEYNMAN.md NOT corrupted (atomic
  //                                      .tmp write means the original is preserved on failure).
  // Additive extension only; mirrors the Phase 110-02 3-string idiom verbatim. logEvent already
  // rejects event_type values outside EVENT_TYPES -- so these are accepted only because they
  // are now IN the Set. Set size grows by 2 (was 35 before Phase 124; now 37 baseline; coexists
  // with the Phase 125-01 framework_invoked extension which adds +1 in parallel).
  'feynman_timeline_refreshed',
  'feynman_timeline_refresh_failed',
  // Phase 150-07 extension (MEM-08; FEYNMAN read-back + seed-writer body-freshness signal).
  //   feynman_body_seeded        -> the seed-writer wrote a FEYNMAN human body for a fresh
  //                                 section through the shipped folder-memory write idiom
  //                                 (discover.md:170 promise). Payload carries the section slug,
  //                                 a body_freshness scalar / stale-flag, and created_by=system.
  //                                 SYSTEM-BOOKKEEPING node per the Part 9 v1.5 audit-node carve-out
  //                                 (records what the system DID, not a venture truth-claim) so
  //                                 created_by=system review_status=confirmed is canon-legal.
  //   feynman_body_stale_flagged -> the projected body-freshness check found the FEYNMAN human
  //                                 body older than the freshness threshold; the cortex can read
  //                                 the flag. Closes the FEYNMAN write-only sink: the timeline +
  //                                 body freshness are now navigable graph signals, not a dead end.
  // Canon Part 8: payloads carry the section slug + a freshness scalar / stale-flag only; the
  //   FEYNMAN prose body NEVER lands in a memory_event and never crosses to Brain. Additive
  //   extension only; mirrors the Phase 124-02 2-string idiom verbatim. logEvent already rejects
  //   event_type values outside EVENT_TYPES -- so these are accepted only because they are now IN
  //   the Set.
  'feynman_body_seeded',
  'feynman_body_stale_flagged',
  // Phase 125-01 extension (counter source for D3 continuous investment gradient).
  // Each /mos:* methodology command run logs one framework_invoked event with payload
  // {framework, command, timestamp}. computeInvestmentLevel(roomState) projects
  // COUNT(memory_event WHERE event_type='framework_invoked') -> investment_level.
  // The actual emission site is a follow-on instrumentation pass (lib/render/render-v2.cjs
  // or per-command hook); Plan 01 only ships the event_type allowlist entry so
  // computeInvestmentLevel can call findRecentChanges with this filter and get 0 (cold)
  // back from a fresh room. The instrumentation is non-blocking for Plan 01 acceptance
  // since computeInvestmentLevel reads from roomState.framework_invocations (which a
  // separate caller will populate by calling findRecentChanges + counting); when no
  // such count is available, the helper returns level: 0 -- the cold-start path.
  'framework_invoked',
  // Phase 125-06 extension (D7: F-selector reject/defer become typed graph signal).
  // Emitted by lib/workflow/selector-decisions.cjs::recordSelectorDecision.
  // Payload: {decision: 'defer'|'reject', command, framework, reason, edge_semantic,
  //   expires_at|null, score_at_decision, investment_level_at_decision}. The corresponding
  //   DEFERRED/REJECTED cascade edge is written via navigation.writeEdge (Plan 00).
  //   Canon Part 4: every choice is graph data. The F-selector's adaptive-questioning
  //   surface relies on this signal to apply decay-weight in subsequent rankings.
  'f_selector_decision',
  // Phase 125-07 extension (D8: none-fit affordance + ranker-miss capture).
  // Emitted by lib/workflow/selector-decisions.cjs::recordSelectorMiss.
  // Payload: {top_k_offered: [{command, score}, ...], user_intent: <verbatim user text>,
  //   investment_level_at_decision}. NO cascade edge written (miss is temporal-only).
  //   Canon Part 8: user_intent stays LOCAL; never sent to Brain.
  'f_selector_miss',
  // Phase 121.5-00 extension (SessionStart Coordinator: D-16 isolation + D-14 budget telemetry).
  // Emitted by lib/sessionstart/contributor-isolator.cjs::runContributor on contributor failure
  // and by scripts/sessionstart-coordinator.cjs::runAll on every coordinator pass.
  //   sessionstart_contributor_failed -> a single contributor threw / validation-failed; coordinator
  //                                      dropped it and continued. Payload: {contributor_id: <ladder id>,
  //                                      error_class: <constructor name; enum-only>}. No stack, no
  //                                      user content -- Canon Part 8 boundary preserved by the
  //                                      isolator (stack lives in the LOCAL JSONL telemetry only).
  //   sessionstart_coordinator_run    -> one envelope emitted; payload carries scalar counts
  //                                      (fragments_total, fragments_compressed, fragments_dropped,
  //                                      bytes_emitted). Scalars + enums only.
  // Additive extension only; mirrors the Phase 110-02 / 116-00 / 117-00 / 124-02 / 125-01 / 125-06
  // / 125-07 idiom verbatim. logEvent already rejects event_type values outside EVENT_TYPES.
  'sessionstart_contributor_failed',
  'sessionstart_coordinator_run',
  // Phase 119-00 Wave 1 extension (Room-as-Receipt Invariant; D-01 + D-04 + D-06 telemetry mirror).
  // Per CONTEXT.md Implementation Decisions D-01 + D-04 + D-06: the auto-create entrypoint
  // (room_auto_created) fires synchronously inside scripts/auto-explore-fingerprint.cjs BEFORE
  // the detached auto-explore-fire spawn so the spawned auto-explore output lands in a real
  // room.db. The naming-decided + discarded events land in Plan 119-01.
  //
  // Additive extension; mirrors the Phase 124-02 2-string idiom and the Phase 117-00 6-string
  // idiom. logEvent already rejects event_type values outside EVENT_TYPES -- so these are
  // accepted only because they are now IN the Set. Set size grows by 3 (was 38 before Phase
  // 119; now 41 baseline; coexists additively with any concurrent phase extension).
  //
  // Canon Part 9: SQL is the local mind; every choice is graph data. These three events are
  // the canonical Part 10 sub-claim 3 ("rooms are receipts, not entry points") telemetry mirror.
  'room_auto_created',
  'room_naming_decided',
  'room_discarded',
  // Phase 119-01 Wave 2 extension (Room-as-Receipt Invariant; D-06 discard-cascade safety net).
  // Per CONTEXT.md Architectural Decision item 4 (Claude's Discretion): the discard cascade
  // is a SQLite transaction wrapping fs.rmSync + registry purge + memory_event emission.
  // When the transaction fails partway (fs.rmSync raises EBUSY / EACCES, OR the registry
  // purge fails non-atomically), the memory_event below lands so /mos:doctor can find
  // orphaned rooms on next session-start.
  //
  // Additive extension only; mirrors the Plan 119-00 idiom verbatim. logEvent already
  // rejects event_type values outside EVENT_TYPES -- so this is accepted only because
  // it is now IN the Set. Set size grows by 1 (was 41 after Plan 119-00; now 42 baseline).
  //
  // Canon Part 9: SQL is the local mind; even partial failures become graph data so the
  // recovery hook (/mos:doctor --orphaned-room-cleanup, deferred to v1.13.0 housekeeping)
  // can scan + remediate.
  'room_discard_partial_failure',
  // Phase 120-00 Wave 1 extension (Breakthrough Scan / Category G; D-01..D-06 detector tier
  // + D-09 file-as-decision bridge + D-10 mandatory dismiss + D-19 canary auto-throttle).
  //
  // Six strings; mirrors the Phase 119-00 3-string + 117-00 6-string + 124-02 2-string
  // additive idiom. logEvent already rejects event_type values outside EVENT_TYPES -- so
  // these are accepted only because they are now IN the Set. Set size grows by 6 (was 42
  // baseline after Phase 119-01; now 48 baseline).
  //
  // Canon Part 10 sub-claim 5: variable reward fires automatically; the math IS the surface.
  //   These six events are the canonical telemetry mirror for the breakthrough lifecycle:
  //   soft-fire (buffer-only) -> hard-fire (surfaced) -> user response (confirm/dismiss/file)
  //   -> canary auto-throttle (D-19 30%-over-100-fire-window static threshold).
  //
  // Canon Part 4: every choice is graph data. The breakthrough_filed_as_decision event is
  //   the bridge to Phase 88 decision-log machinery -- promotes a breakthrough to a
  //   first-class decision with audit trail.
  //
  // Canon Part 8: payloads carry scalar enums + framework names + sha256 hashes only;
  //   theme strings are sanitized at write time per the Phase 90-06 sanitizeDetailScalar
  //   precedent. Raw artifact content never lands in a memory_event.
  'breakthrough_detected_soft',
  'breakthrough_surfaced',
  'breakthrough_confirmed',
  'breakthrough_dismissed',
  'breakthrough_filed_as_decision',
  'breakthrough_throttled',
  // Phase 120-02 Wave 2 additive extension (D-20 third structural enforcement
  //   point: surfaceBreakthrough refuses provenance-less Breakthrough nodes at
  //   surface time and emits this event for /mos:doctor traceability). Mirrors
  //   the Phase 120-00 6-string additive idiom verbatim. logEvent already
  //   rejects event_type values outside EVENT_TYPES -- so this is accepted only
  //   because it is now IN the Set. Set size grows additively by 1.
  //
  // Canon Part 4: every choice is graph data -- the refusal itself is a typed
  //   signal that an upstream caller attempted to bypass the D-20 invariant.
  // Canon Part 8: pure LOCAL telemetry; no Brain coupling; payload carries
  //   breakthrough_id + reason scalars only.
  'breakthrough_surface_blocked',
  // Phase 120-03 Wave 2 additive extension (D-18 SOFT_BAND review queue telemetry
  //   mirror). Mirrors the Phase 120-02 1-string + Phase 120-00 6-string + 117-00
  //   6-string + 124-02 2-string additive idiom verbatim. logEvent already rejects
  //   event_type values outside EVENT_TYPES -- so this is accepted only because it
  //   is now IN the Set. Set size grows additively by 1.
  //
  // Canon Part 4: every choice is graph data; the SOFT_BAND review queue is the
  //   typed graph signal for D-18 mid-confidence candidates that the system queues
  //   for manual sample-20% weekly review (becomes retraining data per CONTEXT.md).
  // Canon Part 8: payload carries scalar enums (kind), numeric confidence, and the
  //   queue_id handle; no raw artifact content lands in this event.
  // Canon Part 9: ALL writes via navigation.cjs::logMemoryEvent chokepoint.
  'breakthrough_in_review_queue',
  // 260517-dcw dogfood-bridge extension (Canon Part 6 Product-as-Venture; D-04
  //   dog-fooding mandate telemetry mirror). Six strings; mirrors the Phase 120-00
  //   6-string + 117-00 6-string + 124-02 2-string + 110-02 3-string additive idiom.
  //   logEvent already rejects event_type values outside EVENT_TYPES -- so these are
  //   accepted only because they are now IN the Set. Set size grows by 6 (was 48
  //   baseline after Phase 120-00; now 54 baseline).
  //
  // Canon Part 9 binding: SQL is the local mind; the plugin's own development
  //   activity becomes graph data in the plugin's own venture room. Every Edit/
  //   Write/MultiEdit on the plugin repo that matches the dog-food filter is a
  //   file_changed event in ~/MindrianRooms/mindrian/room.db.
  //
  // Canon Part 8 binding: payloads carry the absolute path string (LOCAL data,
  //   already on the local box; never sent to Brain), the tool name (enum scalar:
  //   Edit / Write / MultiEdit), and the ISO timestamp. Zero user-content egress.
  //
  // Active emit site: scripts/dogfood-emit.cjs (file_changed only in this plan).
  // Stub event types (no callers yet; reserved for future triggers per task_scope):
  //   commit_landed       -> a git post-commit hook (future)
  //   phase_completed     -> /gsd:phase-complete (future)
  //   release_shipped     -> scripts/release.sh post-publish (future)
  //   tester_signal       -> tester reply ingestion (future)
  //   decision_captured   -> /mos:decide F.1 selector (future)
  'file_changed',
  'commit_landed',
  'phase_completed',
  'release_shipped',
  'tester_signal',
  'decision_captured',
  // Phase 129-01 extension (Spine Repair; the 5 net-new canonical spine event
  // types that route the 6 silent spine scripts through navigation.cjs). The
  // count is EXACTLY 5 net-new types -- the v1.13.1 alignment-audit risk-3
  // event-cap-5 lock (per 129-CONTEXT Pre-resolved decisions). Consolidations
  // that keep the cap at 5:
  //   spine_read            -> merges the old status_rendered + memory_inspected
  //                            (both are read-surface renders, disambiguated by a
  //                            payload.surface enum 'status'|'memory').
  //   jtbd_transitioned     -> merges set/override/clear (payload.kind enum
  //                            'set'|'override'|'clear').
  //   operator_transitioned -> stands alone (conversation operator mode change).
  //   workflow_stage        -> merges act dispatch/completion AND pipeline stage
  //                            entered/completed (payload.surface enum 'act'|'pipeline',
  //                            payload.phase enum 'entered'|'completed').
  //   suggestion_surfaced   -> stands alone (suggest-next surfaced commands + scores).
  //
  // Additive extension only; mirrors the Phase 120-00 / 119-00 / 124-02 idiom.
  // logEvent already rejects event_type values outside EVENT_TYPES -- so these
  // are accepted only because they are now IN the Set. Tests assert a FLOOR +
  // named membership + a delta of exactly 5, never a brittle absolute size.
  //
  // Canon Part 4: the spine's transitions ARE choices -> graph data.
  // Canon Part 9: SQL is the local mind; every spine transition is journaled here.
  'spine_read',
  'jtbd_transitioned',
  'operator_transitioned',
  'workflow_stage',
  'suggestion_surfaced',
  // Phase 130-02 extension (Lens-Engine Skeleton; the 5 net-new lens lifecycle
  // event types the rotate() engine emits as its mandatory memory_event trail
  // per Canon Part 9). EXACTLY 5 net-new types; tests assert a FLOOR + named
  // membership + a delta of exactly 5, NEVER a brittle absolute size -- so a
  // future phase adding a 6th type cannot regress this baseline. Mirrors the
  // Phase 129-01 5-string spine block additive idiom verbatim.
  //   lens_rotation_started    -> one per rotate() call (emitted at start).
  //   lens_finding_written     -> one per lens that produced a finding (the
  //                               typed lens_finding node written via
  //                               navigation.writeLensFinding).
  //   lens_synthesis_completed -> one per synthesize step (emitted at end).
  //   lens_finding_accepted    -> the onAccept path (an INFORMS cascade edge
  //                               from the lens finding to a target node).
  //   lens_finding_rejected    -> the onReject path (a REJECTED_BECAUSE edge;
  //                               rejection-as-data per Canon Part 4).
  //
  // logEvent already rejects event_type values outside EVENT_TYPES -- so these
  // are accepted only because they are now IN the Set.
  //
  // Canon Part 4: every choice is graph data -- accept/reject ARE choices.
  // Canon Part 9: SQL is the local mind; every lens rotation is journaled here.
  // Canon Part 8: payloads carry scalar enums + node-id handles only; raw
  //   per-lens prose never lands in a memory_event (the lens_finding node holds
  //   the summary; the event carries only the node id + a reason enum).
  'lens_rotation_started',
  'lens_finding_written',
  'lens_synthesis_completed',
  'lens_finding_accepted',
  'lens_finding_rejected',
  // Phase 131-01 extension (Research as Graph-Aware Workflow; the 3 net-new
  // research wiring-decision event types the Stage 7 wirer emits as its mandatory
  // memory_event trail per Canon Part 9 -- EVERY wiring decision journals an
  // event). EXACTLY 3 net-new types; tests assert a NAMED-membership DELTA of
  // exactly 3 over the pre-131 baseline, NEVER a brittle absolute size -- so a
  // future phase adding a 4th type cannot regress this baseline. Mirrors the
  // Phase 130-02 5-string lens block additive idiom verbatim.
  //   research_filed    -> the ACCEPT path: an EvidenceClaim node was written +
  //                        an INFORMS (+ optional CONTRADICTS / SUPERSEDES) cascade
  //                        edge landed (provenance: url + retrieved_at + tier).
  //   research_rejected -> the REJECT path: a REJECTED_BECAUSE edge was written
  //                        with a reason scalar (rejection-as-data; teaches the
  //                        next run's dedup per Canon Part 4).
  //   research_deferred -> the DEFER path: queued to a milestone audit.
  //
  // logEvent already rejects event_type values outside EVENT_TYPES -- so these are
  // accepted only because they are now IN the Set.
  //
  // Canon Part 9: SQL is the local mind; every wiring decision is journaled here.
  // Canon Part 8: payloads carry scalar enums + node-id handles + provenance
  //   scalars (url / retrieved_at / tier) only; the raw finding prose lives on the
  //   EvidenceClaim node, NEVER in the event. The payload never crosses to Brain.
  'research_filed',
  'research_rejected',
  'research_deferred',
  // Phase 143.1-03 extension (Dial-TUI Capability Selector; DIALTUI-06 +
  // DIALTUI-07 -- the 2 net-new dial-commit event types closeReach() emits as
  // its memory_event trail per Canon Part 9). Mirrors the Phase 131-01 3-string
  // research block additive idiom verbatim. logEvent already rejects event_type
  // values outside EVENT_TYPES -- so these are accepted only because they are
  // now IN the Set. Tests assert a FLOOR + named membership, never a brittle
  // absolute size -- so a future phase adding a type cannot regress baseline.
  //   f_selector_pivot          -> DIALTUI-06. Emitted by closeReach on a
  //                                rotate-to-pivot commit, mirroring the PIVOTED
  //                                edge. Carries the investment-scaled
  //                                pivot_penalty scalar the ranker's decay/
  //                                penalty reader consumes (so one early pivot
  //                                does not permanently bury a reach) +
  //                                investment_level_at_pivot.
  //   f_selector_sync_confirmed -> DIALTUI-07. The POSITIVE resting-detent
  //                                in-sync signal: emitted by closeReach on a
  //                                sync commit (no rotate). The resting detent
  //                                IS the in-sync signal.
  //
  // Canon Part 9: SQL is the local mind; every dial commit is journaled here.
  // Canon Part 8: payloads carry scalar enums + framework names + the
  //   pivot_penalty / investment_level scalars only; raw user content never
  //   lands in a memory_event and never crosses to Brain.
  'f_selector_pivot',
  'f_selector_sync_confirmed',
  // Phase 143.1-05 extension (Dial-TUI Capability Selector; MEMDIAL-02 runner
  // half -- the 2 net-new dial-memory refresh event types the dial-memory-runner
  // emits on every refresh attempt per Canon Part 9). Mirrors the Phase 124
  // feynman_timeline_refreshed / feynman_timeline_refresh_failed additive idiom
  // verbatim (the dial-memory runner is a THIN SHIM over the Phase 124 timeline
  // runner, Part 7). logEvent already rejects event_type values outside
  // EVENT_TYPES -- so these are accepted only because they are now IN the Set.
  // Tests assert a FLOOR + named membership, never a brittle absolute size.
  //   dial_memory_refreshed       -> the runner successfully rendered + wrote the
  //                                  sentinel-bounded dial-memory section to the
  //                                  target MD (the human body byte-preserved).
  //   dial_memory_refresh_failed  -> the runner caught an error; the original MD
  //                                  survives (atomic write means no partial-write
  //                                  corruption). The reason scalar is truncated.
  //
  // Canon Part 9: SQL is the local mind; every dial-memory refresh decision is
  //   journaled here so the regenerate-vs-skip is legible.
  // Canon Part 8: payloads carry the section slug + a truncated reason scalar
  //   only; raw user content never lands in a memory_event and never crosses to
  //   Brain.
  'dial_memory_refreshed',
  'dial_memory_refresh_failed',
  // Phase 155-02 extension (room-birth.cjs birthRoom; SEED-022 birth transaction
  // keystone). Two event types for the Q1 7-step birth sequence. Additive
  // extension only; mirrors the Phase 143.1-05 2-string additive idiom verbatim.
  // logEvent already rejects event_type values outside EVENT_TYPES -- so these are
  // accepted only because they are now IN the Set.
  //
  //   room_created        -> emitted ONCE at the end of the STEP 2 SQLite
  //                          transaction when the room first exists in room.db.
  //                          The canonical signal that birth succeeded: everything
  //                          in Phase 155 composes on this event. Payload carries
  //                          {slug, blueprint_family, sessionId} -- enum/scalar
  //                          ONLY per Canon Part 8 (no venture prose, no names).
  //                          System-bookkeeping node per the Part 9 v1.5 audit-node
  //                          carve-out (records what the system DID; never a
  //                          truth-claim about the venture) so created_by=system
  //                          review_status=confirmed is canon-legal.
  //
  //   birth_gate_answered -> emitted PER gate answer drained from the scratchpad
  //                          during STEP 2 (B1/B2/U0 gate decisions). Emitted
  //                          BEFORE the registry flip so the audit trail is in
  //                          room.db before the room becomes reachable to other
  //                          callers. Payload carries {gate_id, canonical_verb,
  //                          option_key} -- enum/scalar ONLY (the free_text reason
  //                          rides the edge, not the event). System-bookkeeping
  //                          node per the Part 9 v1.5 carve-out (records WHAT the
  //                          navigator decided, not a truth-claim the venture makes).
  //
  // Consumer: lib/core/navigation/room-birth.cjs birthRoom (Plan 02).
  // Canon Part 8: payloads carry slug + enum/scalar + session handle only; venture
  //   prose and gate free_text never land in a memory_event and never cross to Brain.
  'room_created',
  'birth_gate_answered',
  // Phase 195-03 extension (FCM-06 rejection-is-data). A born-wired sub-room
  // birth whose pre-mkdir human-approval gate is REJECTED logs this event into
  // the PARENT room.db so the rejection is graph data (Part 4) even though no
  // child folder was created. Additive extension only; the floor-not-size
  // contract (tests assert FLOOR + named membership, never an exact .size) keeps
  // the addition safe. Payload carries slug + parent handle + reason scalar only
  // (Part 8: gate free_text is truncated; no venture prose crosses to Brain).
  'subroom_birth_rejected',
  // Phase 158-02 extension (Bounded rejection-penalty; the presentation counter
  // that the M-floor + W-window + parole all count per reach_id). ONE net-new
  // type. Additive extension only; mirrors the Phase 124-02 2-string idiom and
  // the Phase 143.1-05 2-string idiom verbatim. logEvent already rejects
  // event_type values outside EVENT_TYPES -- so this is accepted ONLY because it
  // is now IN the Set; the Set grows by exactly 1. The floor-not-size contract
  // (tests assert FLOOR + named membership, never an exact .size) makes the
  // addition safe.
  //   reach_presented -> fired once per OFFERED top-3 reach_id on the LIVE engine
  //                      arm (scripts/intent-classifier.cjs runNavigationEngine,
  //                      where roomDb is open), keyed by reach_id. The PURE dial
  //                      render path NEVER writes (db is already closed there).
  //                      It records that a specific reach was OFFERED -- nothing
  //                      else does (the render path is pure; selector_presentation
  //                      is command-anonymous). presentationsCount(reach_id) reads
  //                      this back via findRecentChanges filtered by
  //                      properties.reach_id (lib/workflow/reach-reject-reader.cjs).
  //
  // Canon Part 8: payload carries reach_id (a frozen-enum machine token) +
  //   source_path + created_by ONLY; never prose, never a reason string. The
  //   reach_presented write is a side-channel memory_event, never a ranker input
  //   -> byte-stable at zero (RJP-02 foundation).
  // Canon Part 9: written ONLY via navigation.logMemoryEvent; read ONLY via
  //   navigation.findRecentChanges. System-bookkeeping node per the Part 9 v1.5
  //   audit-node carve-out (records what the system DID -- a reach was offered --
  //   not a venture truth-claim) so created_by=system review_status=confirmed is
  //   canon-legal.
  'reach_presented',
  // Phase 160-06 extension (R12 temporal-blindness sentinel; the ONE net-new
  // event type the scheduled sentinel emits when it surfaces undated real-world
  // nodes). Additive extension only; mirrors the Phase 158-02 reach_presented
  // 1-string additive idiom verbatim. logEvent already rejects event_type values
  // outside EVENT_TYPES -- so this is accepted ONLY because it is now IN the Set;
  // the Set grows by exactly 1. The floor-not-size contract (tests assert FLOOR +
  // named membership, never an exact .size) makes the addition safe.
  //   temporal_blindness_surfaced -> emitted ONCE per sentinel run by
  //     lib/core/sensors/sensor-temporal-blindness.cjs when it surfaces >= 1
  //     real-world-event node (type meeting OR has_event_date===true) whose
  //     valid_at IS NULL. When zero surface, NO event is emitted (the sentinel is
  //     silent on a clean run). It is a SCHEDULED backstop on the Phase 145
  //     cadence (D-04), not a per-turn signal.
  //
  // Canon Part 8: payload carries a count scalar + source_path ONLY; never a
  //   node body, never user prose, never crosses to Brain. The undated node IDS
  //   ride the sensor RETURN value (for the surface layer to date), NOT the event
  //   payload -- the event records only THAT N were surfaced.
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping
  //   node per the Part 9 v1.5 audit-node carve-out (records what the system DID
  //   -- a blindness sweep surfaced N undated nodes -- not a venture truth-claim)
  //   so created_by=system review_status=confirmed is canon-legal.
  'temporal_blindness_surfaced',
  // Phase 162-02 extension (R11 / D-B; the ONE net-new event type the Section-node
  // backfill migration emits when it successfully writes >= 1 missing Section node
  // into an existing room.db). Additive extension only; mirrors the Phase 160-06
  // temporal_blindness_surfaced 1-string additive idiom verbatim. logEvent already
  // rejects event_type values outside EVENT_TYPES -- so this is accepted ONLY
  // because it is now IN the Set; the Set grows by exactly 1. The floor-not-size
  // contract (tests assert FLOOR + named membership, never an exact .size) makes
  // the addition safe.
  //   section_nodes_migration -> emitted ONCE per successful migrateSectionNodes
  //     pass (lib/core/migrations/phase-162-section-nodes.cjs) that backfilled
  //     real Section nodes. Serves as the idempotency sentinel: a second pass that
  //     finds the event (or any Section node) reports already_migrated and emits
  //     nothing.
  // Canon Part 8: payload carries a migrated_count scalar + source_path ONLY;
  //   never a node body, never user prose, never crosses to Brain.
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping
  //   node per the Part 9 v1.5 audit-node carve-out (records what the system DID
  //   -- backfilled N Section anchors -- not a venture truth-claim) so
  //   created_by=system review_status=confirmed is canon-legal.
  'section_nodes_migration',
  // Phase 177-05 extension (BCH-04 shadow-log; the ONE net-new event type the
  // calibration writer (lib/core/navigation/calibration-log.cjs) emits as a
  // SCALAR AUDIT MARKER on every logged calibration observation). Additive
  // extension only; mirrors the Phase 162-02 section_nodes_migration 1-string
  // additive idiom verbatim. logEvent already rejects event_type values outside
  // EVENT_TYPES -- so this is accepted ONLY because it is now IN the Set; the Set
  // grows by exactly 1. The floor-not-size contract (tests assert FLOOR + named
  // membership, never an exact .size) makes the addition safe.
  //   calibration_observation_logged -> emitted optionally per logged calibration
  //     observation. It is an AUDIT MARKER ONLY: the payload carries the turn
  //     handle + the cue_disposition enum + the confidence scalar, NEVER a row
  //     body. The ROW STORE is the dedicated calibration_observations table
  //     (memory-ops.cjs); this memory_event is just the audit trail so the write
  //     is legible in the memory log. Because the ROW STORE is the dedicated
  //     table (NOT this memory_event), buildBrainPacket -- which sweeps
  //     memory_event NODES via findRecentChanges -- never sees a calibration row
  //     body. The marker carries scalars only, so even the swept marker leaks no
  //     row body (BCH-04 + BCH-14).
  // Canon Part 8: payload carries turn handle + disposition enum + confidence
  //   scalar ONLY; never prose, never a row body, never crosses to Brain.
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping
  //   node per the Part 9 v1.5 audit-node carve-out (records what the system DID
  //   -- a calibration observation was logged -- not a venture truth-claim) so
  //   created_by=system review_status=confirmed is canon-legal.
  'calibration_observation_logged',
  // Phase 181-01 extension (SEC-01; EvidenceClaim NON_PROMOTABLE structural guard).
  // The ONE net-new event type promoteNodeStatus emits when its dedicated
  // NON_PROMOTABLE guard REJECTS a promotion of an external-byte EvidenceClaim node
  // (agent OR human attributed, to ANY non-proposed status) before any mutation.
  // Additive extension only; mirrors the Phase 162-02 section_nodes_migration
  // 1-string idiom verbatim. logEvent already rejects event_type values outside
  // EVENT_TYPES -- so this is accepted ONLY because it is now IN the Set; the Set
  // grows by exactly 1. The floor-not-size contract (tests assert FLOOR + named
  // membership, never an exact .size) makes the addition safe.
  //   evidence_claim_promotion_blocked -> emitted ONCE per blocked EvidenceClaim
  //     promotion attempt. Payload carries ONLY enum/scalar handles + the node id
  //     (target_node_id, attempted_from, attempted_to, attempted_by, created_by
  //     'system'); never prose, never crosses to Brain (Part 8).
  // Canon Part 9: written ONLY via logEvent. System-bookkeeping node per the Part 9
  //   v1.5 audit-node carve-out (records what the system DID -- a promotion was
  //   blocked -- not a venture truth-claim) so created_by=system is canon-legal.
  'evidence_claim_promotion_blocked',
  // Phase 183-01 extension (METER-01; the gate-exposure signal for the v1.19 welded
  // two-gauge metric). The ONE net-new event type emitted once per engine-arm gate
  // render at scripts/intent-classifier.cjs, beside the live reach_presented loop,
  // guarded by offered.length > 0 and deduped on the turn-start handle so a
  // re-entrant arm cannot double-count one gate. Additive extension only; mirrors the
  // Phase 181-01 evidence_claim_promotion_blocked 1-string idiom verbatim. logEvent
  // already rejects event_type values outside EVENT_TYPES -- so this is accepted ONLY
  // because it is now IN the Set; the Set grows by exactly 1 (86 -> 87). The
  // floor-not-size contract (tests assert FLOOR + named membership, never an exact
  // member count) makes the addition safe.
  //   gate_reached -> emitted ONCE per gate render. Payload carries ONLY enum/scalar
  //     handles (reach_count integer, routing_source 'engine', source_path
  //     'gate:reached', created_by 'system') + the dedupe_key turn handle; never
  //     prose, never a framework string, never crosses to Brain (Part 8). The count
  //     answers "does a navigator reach the decide() gate" with a REAL number,
  //     surface-agnostic (CLI / Desktop / Cowork), with zero dependence on any Brain
  //     request count.
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping node
  //   per the Part 9 v1.5 audit-node carve-out (records what the system DID -- a gate
  //   was rendered -- not a venture truth-claim) so created_by=system is canon-legal.
  'gate_reached',
  // Phase 196-04 extension (PB8-06; Part-8 runtime egress guardrail telemetry
  // mirror). The 3 net-new event types the part8-egress-ontology writer emits
  // as its scalar-only decision trail per Canon Part 9 -- one per classify()
  // verdict. Additive extension only; mirrors the Phase 110-02 3-string block
  // verbatim. logEvent already rejects event_type values outside EVENT_TYPES --
  // so these are accepted ONLY because they are now IN the Set. The floor-not-
  // size contract (tests assert FLOOR + named membership, never an exact .size)
  // makes the addition safe.
  //   brain_egress_blocked   -> classify() returned verdict 'block' (a CONTENT-SET
  //                             packet was intercepted by the PreToolUse hook and
  //                             refused with exit 2 before it left the machine).
  //   brain_egress_allowed   -> classify() returned verdict 'allow' (a proven
  //                             MOVE-SET packet cleared the gate).
  //   brain_egress_ambiguous -> classify() returned verdict 'ambiguous' (neither
  //                             proven MOVE-SET nor a content hit; gated or, when
  //                             Brain-less, LOCAL-logged and allowed per D-08a).
  // Canon Part 8: payloads carry the category slug + verdict enum + a count scalar
  //   (and an optional matched_pattern regex-source scalar) ONLY; the offending
  //   payload bytes NEVER land in a memory_event and never cross to Brain (D-09).
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping
  //   node per the Part 9 v1.5 audit-node carve-out (records what the system DID
  //   -- an egress decision -- not a venture truth-claim) so created_by=system
  //   review_status=confirmed is canon-legal.
  'brain_egress_blocked',
  'brain_egress_allowed',
  'brain_egress_ambiguous',
  // Phase 199-06 extension (AS-07; AgentShield SessionStart drift-scan telemetry
  // mirror). The 2 net-new event types the SessionStart drift hook
  // (scripts/agentshield-sessionstart-scan.cjs) emits as its scalar-only decision
  // trail per Canon Part 9 -- one per scan outcome. Additive extension only;
  // mirrors the Phase 196-04 3-string brain_egress_* block verbatim. logEvent
  // already rejects event_type values outside EVENT_TYPES -- so these are accepted
  // ONLY because they are now IN the Set. The floor-not-size contract (tests
  // assert FLOOR + named membership, never an exact .size) makes the addition safe.
  //   agentshield_scan_clean   -> a SessionStart scan found zero flagged surfaces
  //                               (totalFlagged === 0); no gate rendered.
  //   agentshield_scan_flagged -> a SessionStart scan found >= 1 NEW flagged
  //                               finding since the last locally-cached scan; a
  //                               Shape F.1 drift gate was surfaced for the
  //                               highest-severity new finding.
  // Canon Part 8: payloads carry the surface slug + ruleId enum + a count scalar
  //   ONLY; the scanned target bytes NEVER land in a memory_event and never cross
  //   to Brain (LOCAL scan, no egress).
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping
  //   node per the Part 9 v1.5 audit-node carve-out (records what the system DID
  //   -- a drift scan outcome -- not a venture truth-claim) so created_by=system
  //   review_status=confirmed is canon-legal.
  'agentshield_scan_clean',
  'agentshield_scan_flagged',

  // Phase 198-04 (SPEC-2, Task 3) -- the mindrian-core `memory_event` MCP tool's
  // generic append-only observation bucket. logEvent already rejects
  // event_type values outside EVENT_TYPES -- an external MCP client (Desktop /
  // Cowork / a non-Anthropic host, per the phase's parity goal) has no access
  // to the closed set of internal-semantics event types above (breakthrough_*,
  // f_selector_*, lens_*, ...), so a single generic bucket is the honest
  // additive extension: it is accepted ONLY because it is now IN the Set,
  // exactly like every prior additive block in this file. Same additive idiom
  // as agentshield_scan_clean / agentshield_scan_flagged.
  // Canon Part 8: the payload is caller-supplied structured JSON via the MCP
  //   tool schema -- generic label + fields, never raw Brain-bound bytes; the
  //   tool never forwards this event to the Brain (Part 9: LOCAL room.db only).
  // Canon Part 9: written ONLY via navigation.logMemoryEvent (lib/mcp/tools/
  //   graph.cjs's memoryEvent() wraps this and this alone -- no second writer).
  'mcp_client_event_logged',
  // Phase 222 Req 7: disclosed degrade signal for a failed/corrupt ranker_weights
  //   read (SEED-059 discipline). Emitted by Plan 02's readHedgeWeights when the
  //   navigation.readHedgeWeightState accessor THROWS (missing/unreadable table)
  //   or returns a corrupt scalar; the ranker falls back to the D4-alone flat
  //   0.5 floor and logs this ONE-SHOT audit event so the degrade is never
  //   silent. Cold start (table exists, zero rows) does NOT emit this (Pitfall 5).
  //   Weight-state PERSISTENCE itself lives in the ranker_weights TABLE (D-02),
  //   not in memory_event rows; this is only the degrade SIGNAL. Additive
  //   extension only; mirrors the Phase 198-04 mcp_client_event_logged 1-string
  //   idiom. logEvent already rejects event_type values outside EVENT_TYPES, so
  //   this is accepted ONLY because it is now IN the Set.
  // Canon Part 8: payload carries enum tokens (fault_kind, source) only; never
  //   prose, never a row body, never crosses to Brain.
  'reach_weight_state_unavailable',
  // Phase 224-02 D-04: the derivation-skipped disclosure marker (SEED-059
  //   fallback-disclosure convention). Emitted by the score-based derive DRAIN
  //   (scripts/gsd-graph-derive-drain.cjs) and, per Plan 03, the backfill swap
  //   (lib/core/graph-backfill.cjs) when the semantic encoder is UNAVAILABLE: the
  //   derivation pass skips EVERY pair (a similarity-only score cannot honestly
  //   distinguish edge types, so there is NO lexical-only fallback) and marks the
  //   skip at the point of occurrence -- additive, non-blocking, checkable. It is
  //   NEVER a silent no-op and NEVER a blocked write (Phase 210 caution: advisory).
  //   Additive extension only; mirrors the Phase 222 reach_weight_state_unavailable
  //   1-string idiom. logEvent already rejects event_type values outside
  //   EVENT_TYPES, so this is accepted ONLY because it is now IN the Set. The
  //   floor-not-size contract (tests assert FLOOR + named membership, never an
  //   exact .size) makes the addition safe.
  // Canon Part 8: payload carries SCALAR fields only -- reason enum, trigger
  //   basename, pairs_skipped count, dedupe_key handle; NEVER artifact body text,
  //   never crosses to Brain.
  // Canon Part 9: written ONLY via navigation.logMemoryEvent. System-bookkeeping
  //   node per the Part 9 v1.5 audit-node carve-out (records what the system DID
  //   -- a derivation pass was skipped -- not a venture truth-claim) so
  //   created_by=system review_status=confirmed is canon-legal.
  'derivation_skipped',
]));

// Phase 129-01 -- 60-second idempotency window for spine no-op emissions.
// Per 129-CONTEXT idempotency decision: dedupe repeated no-op emissions
// (10x /mos:status with no state change) with a 60s TTL keyed on a caller-
// supplied payload.dedupe_key. When NO dedupe_key is present, dedup is OFF and
// every existing caller keeps writing every event (back-compat byte-unchanged).
const DEDUPE_TTL_MS = 60000;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function logEvent(db, eventType, payload, opts) {
  if (!EVENT_TYPES.has(eventType)) {
    return { ok: false, reason: 'invalid_event_type' };
  }
  if (!isPlainObject(payload)) {
    return { ok: false, reason: 'invalid_payload' };
  }
  // Clock seam (opts.now) so tests can advance time deterministically. Mirrors
  // the test-seam idiom used elsewhere; defaults to Date.now in production.
  const options = opts && typeof opts === 'object' ? opts : {};
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  const nowMs = nowFn();

  // Phase 129-01 60s idempotency: when the caller supplies a payload.dedupe_key,
  // look for a same-eventType memory_event with a matching dedupe_key written
  // within DEDUPE_TTL_MS. If one is found, return ok:true deduped:true with the
  // EXISTING eventId and skip the INSERT. Absent a dedupe_key, never dedupe.
  if (typeof payload.dedupe_key === 'string' && payload.dedupe_key.length > 0) {
    try {
      const row = db.prepare(
        "SELECT n.id AS id, n.created_at AS created_at " +
        "FROM nodes n " +
        "WHERE n.type = 'memory_event' " +
        "AND json_extract(n.properties, '$.event_type') = ? " +
        "AND json_extract(n.properties, '$.dedupe_key') = ? " +
        "AND n.created_at > ? " +
        "ORDER BY n.created_at DESC LIMIT 1"
      ).get(eventType, payload.dedupe_key, nowMs - DEDUPE_TTL_MS);
      if (row && row.id) {
        return { ok: true, deduped: true, eventId: row.id };
      }
    } catch (_err) {
      // Tolerant: a query failure must never block the write path. Fall through
      // to the normal INSERT so dedup degrades to no-dedup, never to data loss.
    }
  }
  const eventId = 'memory_event:' + eventType + ':' + nowMs + ':' + crypto.randomBytes(4).toString('hex');
  // Merge event_type as top-level key (overrides any caller-supplied event_type to prevent drift).
  const merged = Object.assign({}, payload, { event_type: eventType });
  const propsJson = JSON.stringify(merged);
  const sourcePath = typeof payload.source_path === 'string' ? payload.source_path : 'system:default';
  const createdBy = typeof payload.created_by === 'string' ? payload.created_by : 'system';
  try {
    db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
      "VALUES (?, 'memory_event', ?, ?, ?, NULL, 'confirmed', ?, ?)"
    ).run(eventId, propsJson, sourcePath, createdBy, nowMs, nowMs);
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  return { ok: true, eventId };
}

function findRecentChanges(db, sinceEpochMs, opts) {
  const options = opts || {};
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100;
  const eventTypeFilter = typeof options.eventType === 'string' && EVENT_TYPES.has(options.eventType) ? options.eventType : null;

  let sql =
    "SELECT n.id, json_extract(n.properties, '$.event_type') AS event_type, " +
    "json_extract(n.properties, '$.target_node_id') AS target_node_id, " +
    "n.created_at, n.source_path, n.properties " +
    "FROM nodes n " +
    "WHERE n.type = 'memory_event' AND n.created_at > ? ";
  const params = [sinceEpochMs];
  if (eventTypeFilter) {
    sql += "AND json_extract(n.properties, '$.event_type') = ? ";
    params.push(eventTypeFilter);
  }
  sql += "ORDER BY n.created_at DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    targetNodeId: r.target_node_id,
    createdAt: r.created_at,
    sourcePath: r.source_path,
    properties: JSON.parse(r.properties),
  }));
}

module.exports = { EVENT_TYPES, logEvent, findRecentChanges };
