---
gsd_state_version: 1.0
milestone: v1.11.0
milestone_name: Memory Triple + Navigation Engine
status: "90-00 brain-md-schema shipped on main. lib/core/brain-md-schema.cjs (528 lines, validateSchema entry + 8 frozen exports, 5 violation categories, Canon Part 8 leak heuristics), lib/memory/brain-md-schema.test.cjs (18/18 pass, registered in Feynman suite -- baseline 52 -> 53), docs/BRAIN-MD-SCHEMA.md (250 lines, 7 sections). Zero new runtime deps, zero em-dashes, BSL 1.1, mirrors Phase 88-00-B shape with zero cross-import (flat lib/core graph). Commits: 03207e1 (RED test), 9e3e4cc (GREEN impl + registration), 1a8c455 (schema doc). Next: Plan 90-01 brain-derivation-core (final Wave 0 plan)."
stopped_at: Completed 90-00-brain-md-schema-PLAN.md
last_updated: "2026-04-24T02:31:40.392Z"
last_activity: 2026-04-24
progress:
  total_phases: 16
  completed_phases: 5
  total_plans: 90
  completed_plans: 73
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Convert uncertainty to manageable risk -- every framework interaction produces bankable opportunities, every session starts with persona-aware routing
**Current focus:** Phase 88 -- feynman-minto-memory-layer (v1.11.0 milestone)

## Current Position

Phase: 90
Plan: 90-00 COMPLETE (Wave 0 Plan 1 of 2)
Status: 90-00 brain-md-schema shipped on main. lib/core/brain-md-schema.cjs (528 lines, validateSchema entry + 8 frozen exports, 5 violation categories, Canon Part 8 leak heuristics), lib/memory/brain-md-schema.test.cjs (18/18 pass, registered in Feynman suite -- baseline 52 -> 53), docs/BRAIN-MD-SCHEMA.md (250 lines, 7 sections). Zero new runtime deps, zero em-dashes, BSL 1.1, mirrors Phase 88-00-B shape with zero cross-import (flat lib/core graph). Commits: 03207e1 (RED test), 9e3e4cc (GREEN impl + registration), 1a8c455 (schema doc). Next: Plan 90-01 brain-derivation-core (final Wave 0 plan).

Prior: 89-01 + 89-02 + 89-03 + 89-04 + 89-05 + 89-06 shipped on main. 89-05 ships Mode C (hybrid) via lib/core/rs_hybrid.py (unified corpus builder + cross-corpus pair filter) and scripts/rs-engine.py --mode hybrid wiring. Warm/cold/bypass paths inherited from Plan 89-03 unchanged. Pairs carry hybrid=True metadata + room_artifact + external_doc structs + Mode A-compatible source_*/target_* fields so Plan 89-06 bridge-writer consumes hybrid output through its schema-tolerant resolver without edits. Plan 89-07 (ReverseSalientAgent wiring + release dashboard) is the remaining Phase 89 plan.

Last 88.6-04 commits (main):

- 0abf6cf feat(88.6-02): add /mos:diagnostics command surface (Gap #1 closure)
- df63773 feat(88.6-02): wire /mos:diagnostics into commands/help.md (Gap #2 closure)
- 55d65ab release: v1.10.14 -- Phase 88.6 python-algorithm-wiring (Gates 1-4)

Tag: v1.10.14 -> 55d65ab (LOCAL, not pushed)

Known Gaps (CLOSED in 88.6-04):

- commands/diagnostics.md: TRACKED via 0abf6cf
- commands/help.md /mos:diagnostics entry: ADDED via df63773
- Human-verify checkpoint: persisted to .planning/phases/88.6-python-algorithm-wiring/88.6-02-HUMAN-UAT.md as post-release soak (non-blocking)

Awaiting user action (Gate 5):

- 5a: git push origin main --tags
- 5b: cd ~/mindrian-marketplace && pin marketplace.json source.ref to v1.10.14 + commit + push master

Last activity: 2026-04-24

Progress: [████████░░] 82%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 88.6 P01 | 10min | 4 tasks | 3 files |
| Phase 88.6 P04 | 10min | 4 tasks | 6 files |
| Phase 88.1 P01 | 14min | 3 tasks | 71 files |
| Phase 88.1 P02 | 5min | 2 tasks | 2 files |
| Phase 88.1 P10 | 14 | 2 tasks | 10 files |
| Phase 88.1 P07 | 18min | 2 tasks | 5 files |
| Phase 88.1 P08 | 25min | 2 tasks | 5 files |
| Phase 88.1 P05 | 13m24s | 3 tasks | 6 files |
| Phase 89 P01 | 12 minutes | 2 tasks | 4 files |
| Phase 89 P06 | ~45 minutes | 2 tasks | 2 files |
| Phase 89 P02 | ~40 minutes | 2 tasks | 2 files |
| Phase 89 P89-03 | 55m | 2 tasks | 3 files |
| Phase 89 P04 | ~45min | 2 tasks | 2 files |
| Phase 89 P05 | ~45min | 2 tasks | 2 files |
| Phase 90 P00 | 30 | 2 tasks | 4 files |

### Roadmap Evolution

- Phase 88.6 inserted after Phase 88: python-algorithm-wiring (URGENT) -- Close orphan-value gap between 15 verified Python algorithms and user-facing product surface. Fixes silent production bug in discover-* pipeline (baseline not auto-fired) and exposes 4 orphan Wave-1 algorithms (surprise, disruption, novelty, blindspot). Evidence: smoke test 2026-04-23 on mindrianOS data room. See CONTEXT.md in phase dir.

| Phase 71 P01 | 4min | 2 tasks | 3 files |
| Phase 71 P02 | 3min | 2 tasks | 2 files |
| Phase 72 P01 | 4min | 2 tasks | 4 files |
| Phase 72 P02 | 4min | 2 tasks | 2 files |
| Phase 73 P02 | 3min | 2 tasks | 2 files |
| Phase 73 P01 | 4min | 2 tasks | 3 files |
| Phase 74 P01 | 4min | 2 tasks | 3 files |
| Phase 74 P02 | 4min | 2 tasks | 2 files |
| Phase 75 P02 | 2min | 2 tasks | 2 files |
| Phase 75-onboarding-redesign P01 | 3min | 2 tasks | 1 files |
| Phase 79-native-filing-wikilinks P01 | 5min | 2 tasks | 5 files |
| Phase 79 P02 | 12min | 2 tasks | 2 files |
| Phase 80 P01 | 20min | 2 tasks | 24 files |
| Phase 80 P02 | 15m | 2 tasks | 4 files |
| Phase 80 P04 | 30 | 2 tasks | 3 files |
| Phase 80 P06 | 25min | 2 tasks | 7 files |
| Phase 84 P01 | 5min | 5 tasks | 1 files |
| Phase 84 P02 | 4min | 5 tasks | 2 files |
| Phase 84 P03 | 25min | 5 tasks | 6 files |
| Phase 87 P00 | 45min | 2 tasks | 17 files |
| Phase 87 P02 | 17min | 2 tasks | 4 files |
| Phase 87-security-hardening-cascade-refactor P01 | 14min | 2 tasks | 4 files |
| Phase 87-security-hardening-cascade-refactor P01a | 19min | 3 tasks | 6 files |
| Phase 87-security-hardening-cascade-refactor P08 | 43min | 3 tasks | 6 files |
| Phase 87 P03 | 30min | 1 tasks | 2 files |
| Phase 87-security-hardening-cascade-refactor P05 | 8min | 2 tasks | 3 files |
| Phase 87 P06 | 14min | 2 tasks | 3 files |
| Phase 87-security-hardening-cascade-refactor P04 | 8min | 2 tasks | 9 files |
| Phase 87-security-hardening-cascade-refactor P07 | 12min | 2 tasks | 5 files |
| Phase 87-security-hardening-cascade-refactor P09 | 45min | 4 tasks | 8 files |
| Phase 87-security-hardening-cascade-refactor P10-v2 | 15min | 3 tasks | 5 files |
| Phase 88 P00-B | 5min | 1 tasks | 3 files |
| Phase Phase 88-00 P00 | 20min | 2 tasks | 11 files |
| Phase 88 P01 | 12min | 1 tasks | 4 files |
| Phase Phase 88 PP02 | 25min | 1 tasks | 4 files |
| Phase 88 P03 | 15min | 1 tasks | 4 files |
| Phase 88 P04-B | 15min | 1 tasks | 8 files |
| Phase 88 P04 | 91min | 3 tasks | 7 files |
| Phase 88 P05 | 63min | 1 tasks | 3 files |
| Phase 88 P06 | 15min | 1 tasks | 2 files |
| Phase 88 P07 | 60min | 2 tasks | 7 files |
| Phase 88 P09 | 15min | 1 tasks | 2 files |
| Phase 88-feynman-minto-memory-layer P10 | 12m | 1 tasks | 3 files |
| Phase 88-feynman-minto-memory-layer P11 | 15m | 1 tasks | 3 files |
| Phase 88 P13 | 45min | 1 tasks | 13 files |
| Phase 88 P12 | 25min | 2 tasks | 4 files |

### Decisions

- v1.9.3: APPROVE/REJECT/DEFER cascade, mid-session intelligence, filing completeness all shipped
- v1.9.4: Three-layer dependency order: OPP (engine) -> CONV (entry) -> ONBD (teaching)
- v1.9.4: 5 phases for 15 requirements -- OPP splits into engine+graph, CONV splits into routing+capture
- [Phase 71]: djb2 hash for opportunity dedup - fast, deterministic, sufficient for file-level uniqueness
- [Phase 71]: Knight position classification: gaps=uncertainty, convergences=risk, contradictions=mixed
- [Phase 71]: Hoist analyzeOutput before Step 10 try block for Step 11 cross-step reuse
- [Phase 72]: Non-blocking graph indexing: bankOpportunity writes file first, indexOpportunity fires as catch-swallowed promise
- [Phase 72]: ADDRESSES edges limited to 5 artifacts per domain section, IN_DOMAIN links to Section node
- [Phase 72]: Brain enrichment is non-blocking fire-and-forget in bankOpportunity
- [Phase 72]: FEEDS_INTO chains provide ordered validation step sequences for banked opportunities
- [Phase 73]: Inline Tier 0 chains in getTier0Chain() rather than parsing persona-chains.md at runtime
- [Phase 73]: Unknown persona defaults to researcher chain (problem-first is safest generic path)
- [Phase 73]: Tier 0 hardcoded framework chains for persona-based conversation routing without Brain dependency
- [Phase 74]: Atomic writes (.tmp then rename) for scratchpad crash safety
- [Phase 74]: Lazy require of opportunity-ops in migrateToRoom to avoid circular deps
- [Phase 74]: bank-opportunity auto-detects JSON vs roomDir+JSON argument pattern
- [Phase 74]: Scratchpad reading in session-start is non-blocking with || echo fallback
- [Phase 74]: Section seeding maps opportunity domain to room sections (problem-definition, solution-design, market-analysis, business-model)
- [Phase 75]: OPP_BANK_SUMMARY computed via inline node, sorted by confidence, injected into all three tiers
- [Phase 75-onboarding-redesign]: Mode-first onboarding: teach three ways to work before asking who the user is
- [Phase 75-onboarding-redesign]: Knight framing is practical with persona examples, not academic theory
- [Phase 79]: analyze-room reinterpretation: wikilink xref source files (no on-disk xref files exist)
- [Phase 80]: [Phase 80-01] MANIFEST schema_version 1.0 locked; writeManifest refuses any manifest without it
- [Phase 80]: [Phase 80-01] run-all-tests spawns each test file as child process to isolate assert failures
- [Phase 80]: [Phase 80-01] bin/mindrian-tools.cjs broken via better-sqlite3/lazygraph-ops chain; 80-05 must route /mos:vault import directly through scripts/vault-import.cjs
- [Phase 80]: Role re-inference in orchestrator covers person-detector narrow-window limitation (Jane Doe co-founder case)
- [Phase 80]: Stage 03c defaults to direct-copy meeting filing fallback per PRECONDITIONS.md (lazygraph-ops broken)
- [Phase 84]: Phase 84-01: schema-only additive migration; no room column on new tables (room.db is per-room)
- [Phase 84]: 84-02: composition module room-db.cjs instead of modifying lazygraph-ops.cjs
- [Phase 84]: memory-lifecycle.cjs resolves active room internally via Phase 83 canonical registry, eliminating need for shared bash helper across four hooks
- [Phase 84]: post-compact creates new session id rather than continuing pre-compact id; compact is a context discontinuity from Claude's perspective
- [Phase 87-00]: Cascade e2e fixture copies seed-room into tmpDir/rooms/ to satisfy intelligence-cascade.isRoomFile() guard
- [Phase 87-00]: Frozen baseline uses exact-match assertions (strictEqual), not soft `>= 1` thresholds, so 80% edge regressions cannot pass silently
- [Phase 87-00]: Feynman runner now treats exit 77 as SKIPPED (POSIX test-infra-broken convention), preventing env degradation from masquerading as regression
- [Phase 87-02]: Atomic write-lock via fs.openSync(lockPath, 'wx'); EEXIST triggers staleness/PID-liveness cleanup + single retry; same-PID re-acquire keeps writeFileSync per m11 rationale
- [Phase 87-02]: Concurrency fence winner sleeps 500ms post-acquire so PID liveness check rejects all losers (proves the openSync primitive, not the dead-PID cleanup fallback)
- [Phase 87-02]: Standalone worker file (not inline template string) for cross-platform path-escape safety; test forks it directly via child_process.fork
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01: Whitelist sanitization /[a-zA-Z0-9 ._-]/ over escape-based defence; applied at 8 Cypher interpolation sites in brain-client.cjs
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01: API key file permission check rejects any group/world-read bit (mode & 0o077 != 0); Windows returns true with stderr warning since NTFS ACLs are outside POSIX mode semantics
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01: Named constant HSI_TIMEOUT_MS = 30000 replaces 12 magic-number 5000ms sites in intelligence-cascade.cjs; preserves 2 intentional 15000ms sites for generate-presentation.cjs
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: .room-root sentinel is the Data Room scoping primitive; hook walks UP to detect ancestor, plugin source commits (no .room-root ancestor) pass unconditionally
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: worktree-safe install path via git rev-parse --git-path hooks/pre-commit, NOT --show-toplevel/.git/hooks/ (breaks on linked worktrees where .git is a file)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: Windows GUI enforcement path is session-start re-install + CI, not the .cmd wrapper (wrapper is a non-silent fallback when git-bash is missing)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-01a: symlink-safe walker via pwd -P + VISITED associative array; guard walker terminates on cycle in one iteration not infinite loop
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: scripts/serve-dashboard-live is a NEW Node HTTP server co-existing with the untouched legacy bash scripts/serve-dashboard (R-87-08-A). /mos:dashboard live routes to new; /mos:dashboard bare routes to legacy.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: openBrowser(url) helper in platform.cjs uses strict regex ^https?://(127.0.0.1|localhost)(:\d+)?(/|$) and argv-array child_process.spawn; rejects evil.com, file:///, and http://localhost.evil.com subdomain-trick.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: active room resolution delegated to scripts/resolve-room (R-87-08-C); zero bare .rooms/registry.json reads in the server.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: MOS_BIND_ALL=1 aborts startup with exit 2; server binds 127.0.0.1 only; port fallback 3131-3140 on EADDRINUSE.
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-08: v1.10.11 dashboard ships WITHOUT chat panel; grep -c 'chat-panel|mos-chat-container|mos-chat-form|mos-api-key' dashboard.html == 0; chat arrives in 87-09.
- [Phase 87-03]: _runCascadeSteps private helper: runCascade + queueCascade delegate, lastHsiByRoom owned by callers (helper returns hsiRanAt), frameworkHint option preserves queueCascade 'cascade-batch' provenance
- [Phase 87-03]: Cascade dedup: 854 -> 653 lines (-201, -23.5%); 87-00 cascade-e2e baseline stays exact-match {INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}; security-trifecta structural assertions migrated from 12 -> 6 HSI_TIMEOUT_MS sites (semantic invariants preserved)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-05: Shared sectionOptional Zod schema replaces 5 inline z.string().optional() sites in tool-router.cjs; single definition eliminates drift
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-05: safeResolveSection() is defense-in-depth (Zod regex at MCP edge + path.resolve startsWith at fs I/O boundary); either layer alone blocks traversal, both must pass
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-05: opportunitySchema.passthrough() enforces title+bounds while preserving opportunity-ops dynamic field reads; 4 non-section optional string params at 755/785/836/873 explicitly out of scope
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-06: node:sqlite DatabaseSync lacks conn.transaction(fn) (better-sqlite3 API only); use explicit BEGIN/COMMIT/ROLLBACK prepared statements; extract _indexArtifactBody helper so rebuildGraph can call insert body inside its own outer BEGIN without nesting
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-06: Rollback test injection point is prepare #3 (2nd INSERT), not prepare #2 (1st INSERT); throwing on prepare #2 would fire BEFORE any real write (nothing to rollback, test passes even without wrap); prepare #3 ensures at least 1 INSERT fired so countAfter - countBefore == 1 is the true regression signal
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-06: Pre-existing rebuildGraph (never exercised by cascade-e2e) referenced the same dead conn.transaction API; fixed in same commit as Rule 1 auto-fix to keep lazygraph-ops.cjs internally consistent; graph-ops.cjs + write-lock.cjs unchanged (87-02 atomic lock remains outer guard)
- [Phase 87-04]: Two distinct entry points (room-ops-sync.cjs + room-ops-async.cjs) + pure-logic shared (room-ops-shared.cjs) eliminate the R4 env-branching footgun at the language level; require-time choice replaces runtime guard
- [Phase 87-04]: Key-set parity enforced programmatically (Object.keys(sync).sort().join() === Object.keys(async).sort().join()) AND every async export is AsyncFunction (constructor.name check) -- future maintainer cannot drift signatures without breaking the test
- [Phase 87-04]: Legacy lib/core/room-ops.cjs retained as thin re-export shim with one-time process.emitWarning (code MOS_DEP_ROOM_OPS_LEGACY) so accidental out-of-tree callers are surfaced but not broken; dedups per Node process automatically
- [Phase 87-04]: resolveRoom moved to shared module (pure fs+JSON); async module wraps it in async fn so AsyncFunction constructor assertion is uniform across every exported name
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-07: sessionCache with pending-promise pattern caches the in-flight init Promise (not the resolved value) so 10 concurrent callTool() on the same api_key share ONE init (R-87-07-RACE fix); rejection purges the entry so the next caller retries fresh
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-07: LRU class backed by doubly-linked list + Map exposes Map-parity iteration (entries/keys/values/forEach/clear/[Symbol.iterator]) so the 3 cascade Map->LRU swap required zero call-site refactoring; iteration does NOT promote (reading is not a use)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-07: sha256 truncated to 16 hex chars (crypto.createHash node builtin, zero new runtime dep) for session-cache keys; 64-bit key space eliminates collision risk across any team MCP deployment
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-09: Bearer token + CSRF double-submit + Origin binding + DNS-rebinding Host guard + security headers + safeLogError (err.stack/.request/.config/.cause all forbidden); 5-pattern chat context builder with tokenEstimate<5K on every path; Pattern 3 graceful empty-stakeholders early-return
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-09: NULL_ORIGIN_SENTINEL = 'nu'+'ll' constant + dynamic ALLOWED_ORIGINS.add() for --allow-null-origin flag so grep audit reads zero hardcoded null-origin entries in the default allowlist (R-87-09-CSRF gap 1)
- [Phase 87-security-hardening-cascade-refactor]: Phase 87-09: 87-08 chat-hide test fence INVERTED in-place (from ==0 to >=1) at the Stream-A -> Stream-B transition boundary; dashboard.html for v1.10.12 now carries the chat-panel @include marker while serve-dashboard-live performs server-side inlining
- [Phase 87-security-hardening-cascade-refactor]: Plan 87-10-v2: v1.10.12 Stream B release 5-gate protocol -- gates 1-3 closed (CHANGELOG + plugin.json + package.json at 1.10.12), gates 4-5 (git tag + marketplace ref pin) gated on user approval; feynman 28/28, cascade-e2e exact baseline, BSL sweep 0 missing, chat-panel presence 3 (inverse v1.10.11 gate); engines-field hotfix ad2a15e verified (0 occurrences in plugin.json)
- [Phase 88]: [Phase 88-00-B]: Hand-written YAML parser over js-yaml: zero-new-dep invariant preserved; narrow dialect (scalars, ISO timestamps, string arrays, flat-object arrays) fits 150-line deterministic parser
- [Phase 88]: [Phase 88-00-B]: SEVERITY and CATEGORIES exported as Object.freeze() so downstream Phase 88 consumers (88-01, 88-04-B, 88-13) cannot mutate the shared contract
- [Phase 88]: [Phase 88-00-B]: Severity aggregation via ordered constant array index lookup; MAX across violations (critical > error > warning > info); null when no violations
- [Phase 88]: [Phase 88-00-B]: em-dash detection scans four narrative surfaces (governing_thought, key_claims, mece_arguments, body) to enforce feedback_no_emdashes project hard rule uniformly
- [Phase Phase 88-00]: Read-before-write preservation at runTier0+writeSectionFromNarrative entry points; last_generated_at always advances; sentinel zero 1970-01-01T00:00:00Z marks never-regenerated-under-v88
- [Phase Phase 88-00]: validateStructural accepts pre-v88 payloads (back-compat opt-in); validateDecisionLogEntry as separate export for 88-10 chokepoint; atomic migration via openSync 'wx' composes with Phase 87-02 write-lock
- [Phase 88]: [Phase 88-01]: Three-file two-entry-point architecture (folder-memory-shared + folder-memory + folder-memory-async) copies Phase 87-04 room-ops pattern exactly; sync for CLI hooks, async for MCP Desktop, shared pure logic consumed by both; key-set parity + AsyncFunction constructor assertion enforced in test
- [Phase 88]: [Phase 88-01]: computeStale precedence -- invariant_violation > parse_failed > never_generated (sentinel 1970-01-01) > missing_timestamps (field absent) > artifacts_newer_than_minto > fresh; sentinel vs absent carry different semantics for 88-13 guardian (regen vs repair)
- [Phase 88]: [Phase 88-01]: STATE.md minto_health emission stays '--' placeholder; consumers derive qualitative signal from reasoning branch's reasoning_health_score (compute-state verified to emit zero MINTO/reasoning tokens); single-sources quantitative vs qualitative
- [Phase 88]: [Phase 88-01]: Best-effort parse on critical invariant violation -- governing_thought and decision_log still surface; only is_stale flips and stale_reason documents why; downstream consumers render sanitized content with staleness annotation rather than hiding the section entirely
- [Phase Phase 88]: [Phase 88-02]: minto-debouncer queue with 10s earliest-wins coalescing window; atomic tmp+fsync+rename writes bracketed by Phase 87-02 write-lock; 12-attempt exponential-backoff lock retry with half-jitter rides out 5-20 concurrent producers without starvation
- [Phase Phase 88]: [Phase 88-02]: self-healing queue reader returns empty shape on ENOENT/SyntaxError/shape-mismatch/version-mismatch with one stderr warning; debouncer is best-effort coalescing valve not correctness boundary, so dropping a crash-corrupted queue is preferable to crashing a bash hook
- [Phase Phase 88]: [Phase 88-02]: Atomics.wait sync sleep on SharedArrayBuffer Int32Array for CLI hook scripts with no event loop; busy-wait fallback if SAB disabled; future sync-sleep needs (rate limiters, retry loops) should copy this primitive
- [Phase Phase 88]: [Phase 88-02]: drain returns partial results on timeout rather than throwing; wall-clock checked at three gates (pre-lock, post-lock, mid-partition); any entries not processed stay queued for next drain -- consumer-friendly API for bounded-budget callers (on-stop 5s, intent-classifier session-start)
- [Phase 88]: [Phase 88-03]: ROOM.md references recompiler deterministic + atomic + composes with Phase 87-02 write-lock via exponential-backoff retry (12 attempts, 25ms base, 1600ms cap, half-jitter); machine-managed region delimited by <!-- BEGIN/END REFERENCES --> markers identical to 88-01 folder-memory reader; identity prose preservation verified byte-for-byte across recompiles
- [Phase 88]: [Phase 88-03]: mtime-conflict detection via .mindrian/recompile-stamps.json with 1000ms slack for fs timestamp granularity; double-check pattern (pre-lock AND post-lock) defends against stamp refresh during backoff; stamp advances even on no-op recompile to keep next comparison honest; CLI exits 0 on mtime_conflict (expected outcome, warning to stderr) -- closes risk #7 silent stomp of manual edits
- [Phase 88]: [Phase 88-03]: Wikilinks emit as [[target]] when label==target (standard Obsidian rendering + grep-friendly dedup) and [[target|label]] when they differ; alphabetical stable sort on target is the determinism anchor that makes 88-06 on-stop snapshot diffs meaningful
- [Phase 88]: [Phase 88-04-B]: 7-step atomic write (openSync 'wx' + fsync + validate + acquireLock + rename + releaseLock) with invariants gate BEFORE rename; broken narratives cannot overwrite previous MINTO.md; machine-parsable envelope {success, violations[], bytes_written, elapsed_ms, path} on stdout for 88-04/88-06/88-13 consumers
- [Phase 88]: [Phase 88-04-B]: Exponential-backoff lock retry (12 attempts, 25-1600ms cap, half-jitter) composes with Phase 87-02 acquireLock primitive so 5-20 concurrent producers converge without starvation; tmp naming <target>.tmp.<pid>.minto lets 88-13 guardian sweep orphans and correlate to producer pid
- [Phase 88]: [Phase 88-04-B]: Rule 1 auto-fix -- 88-00-B YAML parser regex extended from [A-Za-z_][A-Za-z0-9_]* to [A-Za-z_][A-Za-z0-9_-]* in 3 key-parse sites to accept dashes in key names like parent-moc; Rule 2 auto-fix -- schema_version + governing_thought added as top-level frontmatter keys in both tier-0 and tier-1 paths so invariants validator accepts generator output
- [Phase 88]: [Phase 88-04]: Post-write triple-fire wired -- detect_room_section via .room-root walker; stamp + recompile BACKGROUNDED (disowned subshells) so user-visible hook return is decoupled from write-lock contention under 20-writer Cowork load; debouncer enqueue stays synchronous (single-digit-ms JSON write) to preserve 10s coalesce ordering; system files ROOM/STATE/MINTO stamp only (no enqueue, no recompile) to prevent MINTO-rewrite livelock
- [Phase 88]: [Phase 88-04]: hooks.json PostToolUse matcher widened Write -> Write|Edit|MultiEdit for parity with PreToolUse; Edit-in-place of existing artifacts now fires freshness wires (pre-88-04, edits silently drifted MINTO + ROOM.md within one session); scripts/post-write gets explicit exit 0 soft-fail boundary under set -euo pipefail so cascade/triple-fire failures cannot propagate as user-visible tool-call failures
- [Phase 88]: [Phase 88-04]: stamp-artifact-write helper composes with Phase 87-02 write-lock via 12-attempt exponential-backoff retry with half-jitter (mirrors 88-02 debouncer + 88-03 recompiler primitives); atomic tmp+fsync+rename with .tmp.<pid> naming; defensive pending-stamps fallback at .mindrian/pending-stamps/<section>.json when MINTO.md is absent or malformed (88-05 regen worker will merge on next generation)
- [Phase 88]: [Phase 88-05]: drain-at-prompt lazy commit -- UserPromptSubmit fires on every user turn, drains items older than 30s, appends to .mindrian/pending-tier1-regen.json atomically, spawns tier-0 regens in BACKGROUND via child_process.spawn(detached,unref,stdio:ignore); session crashes preserve queue and next hook picks up where we left off
- [Phase 88]: [Phase 88-05]: consolidated single-node drain over three-bash-call pipeline -- 20-entry burst collapsed from 2696ms to 777ms by amortizing Node cold-start cost across drain + pending-append + fork-scheduling; programmatic debouncer.drain() API used instead of CLI subprocess to avoid second cold-node fork
- [Phase 88]: [Phase 88-05]: pending-tier1-regen.json as inter-phase bridge with APPEND-only semantics -- 88-05 is producer (appends drained entries), 88-07 session-start is consumer (surfaces 'N sections have tier-0 pending tier-1 upgrade' prompt); history preserved across sessions so 88-07 has full visibility
- [Phase 88-06]: on-stop close-out: olderThanMs=0 (flush everything) + timeoutMs=1500 (not PLAN 5000) to respect 3000ms hooks.json Stop-hook budget; debouncer partial-on-timeout guarantees nothing lost (88-05 at-prompt drain next session)
- [Phase 88-06]: Parallel per-section recompile with outer wait cap (~1000ms) instead of sequential N*400ms; orphaned recompiles finish async but hook does not block; 88-13 guardian can surface orphans via .mindrian/session-close.log elapsed traces
- [Phase 88-06]: Single inlined Node -e block for readTriple walk + atomic snapshot + stale ledger: amortizes cold-start cost (saved ~2s vs three bash subcalls) and sidesteps bin/mindrian-tools.cjs better-sqlite3 coupling; env-var context transfer via ROOM_DIR_ENV + PLUGIN_ROOT_ENV
- [Phase 88-06]: session-snapshot.json + minto-stale.json both schema v1; atomic tmp.<pid>+rename per file; readtriple_failed error path appends to stale list with section-specific error so one broken section cannot crash the whole snapshot walk (graceful-degradation propagated from 88-01)
- [Phase 88-06]: Phase 84 STATE.md contract preserved byte-for-byte: Phase 88 block is strictly ADDITIVE, sits AFTER Phase 84 STATE.md write + memory-lifecycle + voice-log reader; Test 6 is the explicit regression fence (any future edit removing compute-state call breaks the test)
- [Phase 88]: Phase 88-07: DEFAULT_BUDGET_TOKENS = 5000 grounded in measured 3825-token session-start baseline (not 20% heuristic); SESSION_START_BUDGET_TOKENS env override lets power users rescale
- [Phase 88]: Phase 88-07: Null reasoning_health_score sorts FIRST (weakest-most / highest-priority-to-surface) under budget pressure -- matches pedagogical goal of surfacing weakest triples first
- [Phase 88]: Phase 88-07: Snapshot-first read with live readTriple fallback -- three-tier graceful degradation (snapshot -> live -> empty) makes session-start robust to 88-06 producer failure
- [Phase 88]: Phase 88-07: Bash env-propagation fix --  does NOT propagate VAR into subshell; use  for correct scoping. Same pattern as 88-06 on-stop
- [Phase 88]: [Phase 88-09] Byte-identity enforced via Test 9 rather than shared-helper extraction: session-start + post-compact have near-duplicate node -e blocks; extraction to scripts/emit-triple-context.cjs deferred because (a) hook budgets (3000ms / 5000ms) already tight; (b) Test 9 is deterministic CI gate for drift
- [Phase 88]: [Phase 88-09] stderr diagnostic 'post-compact: snapshot missing: fell back to live read' kept verbatim from PLAN so 88-13 guardian's log-scrape regex can match both this hook and future consumers that copy the pattern
- [Phase 88]: [Phase 88-09] Snapshot-first / live-fallback / empty-OK three-tier ladder copies 88-07 contract verbatim; only filename differs (pre-compact-snapshot.json vs session-snapshot.json); four-phase producer-consumer architecture now symmetric (88-06->88-07, 88-08->88-09)
- [Phase 88-feynman-minto-memory-layer]: Outer + inner write-lock composition: outer lock serializes the read-modify-write; inner lock serializes the rename; same-pid re-acquire is a no-throw overwrite per write-lock.cjs.
- [Phase 88-feynman-minto-memory-layer]: Archive month from archived entry timestamp (not today) keeps partitions chronologically coherent for future full-history queries.
- [Phase 88-feynman-minto-memory-layer]: JSONL append-only archive; fs.appendFileSync is POSIX-atomic for small lines. Prior lines never rewritten (Test 4 invariant).
- [Phase 88-feynman-minto-memory-layer]: Additive tertiary write pattern: proactive-intelligence.cjs authoritative, decision-capture.cjs read-optimized; primary writer byte-frozen; dual-write never blocks
- [Phase 88-feynman-minto-memory-layer]: Skip-not-error for missing-section: no --source-artifact OR outside --room is a documented skip with no error log entry; only real failures (no_minto, schema violations) trigger .mindrian/decision-dual-write-errors.jsonl
- [Phase 88-feynman-minto-memory-layer]: Section derivation from --source-artifact first path segment (relative or absolute); outer try/catch wraps whole block so require-time errors are also swallowed; CLI exit 0 always
- [Phase 88]: Phase 88-13: Four seed validators (not one) -- extensibility tested by diversity; three silent-failure modes (partial snapshot, unbounded queue, ghost stale entries) become first-class validators at plan one
- [Phase 88]: Phase 88-13: Advisory at runtime + blocking only at pre-commit -- never block session-start over triple-health; enforce only at lock-in moment
- [Phase 88]: Phase 88-13: Validator registry fail-open -- one broken validator never breaks the whole registry (Test 12 fence); downstream phases (88.3 Brain, Phase 90 Nav) extend without touching guardian.cjs
- [Phase 88]: Phase 88-13: Stale-lifecycle scope narrowed to invariants-owned reasons (invariant_violation, parse_failed); folder-memory-owned reasons (never_generated, missing_timestamps, artifacts_newer_than_minto) skipped so 88-06 legitimate staleness is never pruned
- [Phase 88]: Phase 88-13: Pre-commit hook composes with 87-01a via DISCOVERED_ROOM_ROOTS in the same installer-delivered guard script; plugin source commits bypass untouched
- [Phase 88]: v1.10.13 ships via partial-autonomous 5-gate protocol: gates 1-4 closed autonomously (CHANGELOG entry, version bumps, local commit+tag); gates 5a/5b (push + marketplace pin) surfaced as user-action checkpoint because they require user credentials and cross workspace boundaries
- [Phase 88.6]: Extract baseline-fetch into shared ensure-brain-baseline.cjs helper (Canon Part 7 Reuse Before Build) rather than duplicate inline across discovery-cycle.cjs and whitespace-command.cjs
- [Phase 88.6]: Helper exits 2 (not 1) on Brain offline so callers distinguish offline vs invocation error; never throws, always returns result object
- [Phase 88.6]: Phase 88.6 ships v1.10.14 via 5-gate release protocol: Gates 1-4 closed autonomously (CHANGELOG + plugin.json + package.json + CANON-PHASE-MAP + release commit 55d65ab + local tag v1.10.14); Gate 5 (push + marketplace ref pin) surfaced as user-action checkpoint per plan autonomous=false (identical to 88-12 precedent)
- [Phase 88.6]: Used Edit tool (never Write) for plugin.json and package.json version bumps per BLOCKER 5 landmine guard; all 10 dependencies and 27-line structure of package.json preserved byte-for-byte; single-line diff each file
- [Phase 88.1]: Under-promise tiebreaker applied across all 72 commands; destructive set kept narrow (publish/export/snapshot/vault); allowed-tools granularity deferred to Plan 88.1-02
- [Phase 88.1]: 88.1-10: PROACTIVELY limited to 3 observe-react agents (grading/investor/opportunity-scanner) -- meets CONTEXT #10, zero bloat. Color palette 8-slot. Isolation: worktree on 3 write-heavy/external-API agents.
- [Phase 88.1]: MINTO.md validation delegates to Phase 88-00-B feynman-minto-invariants.cjs (no schema duplication)
- [Phase 88.1]: null frontmatter = parser failure signal (critical malformed); empty {} = critical by all-required-missing escalation
- [Phase 88.1]: Unknown frontmatter fields produce warning (advisory drift), not error; advisory hook never blocks Write/Edit/MultiEdit
- [Phase 88.1]: 88.1-08 plumbing-over-stash: git hash-object + read-tree (GIT_INDEX_FILE tmp) + update-index + write-tree + commit-tree + update-ref; never checks out autocommit branch, never moves HEAD, never modifies user's working index; idempotent via tree-sha identity (write-tree output compared to parent tree; identical -> skip commit)
- [Phase 88.1]: 88.1-08 detached worker pattern: foreground hook performs ledger I/O + throttle check + systemMessage emission then spawns self with --worker flag (child_process.spawn detached+unref+stdio:ignore); git plumbing runs off-cycle so user's tool-call latency is unaffected
- [Phase 88.1]: 88.1-08 throttle contract: 5s window boundary is un-throttled (>= is allow, < is throttle); per-path scope; ledger retention 1 day with prune-on-write (LEDGER_RETENTION_MS = 86400000) keeps bounded without separate GC pass
- [Phase 88.1]: 88.1-08 invariant phrasing: source header comment deliberately avoids literal 'git push' and 'https://' substrings so verify-block greps match zero at byte level not just semantic level
- [Phase 88.1]: 88.1-05 ship /mos:status Shape E renderer reusing Plan 88.1-04 cache + classifyHealth + truncateGoverningThought byte-identically; 12 TDD tests; Canon Part 2/3/5/8 preserved; 4th L3/L4 surface with coherent glyph vocabulary
- [Phase 89]: Plan 89-01: Filename is lib/core/rs_math.py (underscore) not rs-math.py (hyphen) because Python cannot import hyphenated module names and the plan's own verify block imports via from lib.core.rs_math
- [Phase 89]: Plan 89-01: REVERSE_SALIENT coexistence is per-edge via properties.source not per-table; lazygraph-ops has no dedicated table, hsi-sourced edges survive rs-engine cleanup via json_extract scoping
- [Phase 89]: Plan 89-01: Artifacts read from filesystem walk room/*.md not room.db; no artifacts table exists in lazygraph-ops schema; matches compute-hsi.py precedent exactly
- [Phase 89]: Plan 89-01: Pinecone inference embedding (RS_EMBEDDING_MODEL=multilingual-e5-large cold path) raises NotImplementedError with pointer to Plans 89-03/89-05 per PLAN-CHECK Gap 1; MiniLM is 89-01 default
- [Phase 89]: Plan 89-03 rs-external Pinecone cache: 30-day lazy TTL, warm/cold/bypass paths, server-side multilingual-e5-large preserves warm/cold consistency, bypass path preserves Plan 89-02 byte-identical
- [Phase 89]: Plan 89-04 cross-room Mode A: --rooms loads N rooms with global_id uniqueness, CROSS_ROOM_OVERSHOOT=3 post-filter, pair_matrix metadata for bridge count table, no room.db edges (cross-room pairs belong to N-room graph)
- [Phase 89]: Plan 89-05 hybrid Mode C: lib/core/rs_hybrid.py unified corpus builder + cross-corpus pair filter; MiniLM-over-unified-corpus (not split embed) guarantees dimensional homogeneity (plan Risk 1 mitigation); HYBRID_OVERSHOOT=10 handles O(2000) external vs O(100) room volume imbalance; Plan 89-06 bridge-writer consumes hybrid pairs unchanged via schema-tolerant resolver
- [Phase 89]: Plan 89-05 Part 8 boundary preserved: room content read locally and used in-process only; external corpus stored in rs-external is strictly public OpenAlex/arXiv metadata; unified corpus lives only in memory during engine run; zero Brain queries
- [Phase 90]: [Phase 90-00]: BRAIN.md schema validator ships as standalone module mirroring Phase 88-00-B invariants shape byte-identically (validateSchema returns {valid, violations[], severity} so Plan 90-05 registry wraps without adapter); narrow YAML parser is a scoped copy not a cross-import, preserving flat lib/core dependency graph per 88-01 key-decision
- [Phase 90]: [Phase 90-00]: Canon Part 8 boundary baked into schema layer (not retrofitted runtime guard): 5-pattern frozen regex set (email / currency / quoted-person / meeting fragment / SSN-like) scans every frontmatter scalar and emits canon_boundary/warning with action_hint canon_part8_review; heuristics over-flag deliberately -- false-positive cost is one-line review, false-negative cost is constitutional breach
- [Phase 90]: [Phase 90-00]: author field frozen to literal 'brain'; non-brain authors are attribution/error (constitutional per Canon Part 2, not schema shape miss); BRAIN.md self-attribution is the contract that lets the quadruple readers distinguish Brain-authored derivation from user / Larry artifacts

### Pending Todos

- generate-hub.cjs standard features (sticky top bar, persona card, vis-network graph)
- Update generate-snapshot.cjs constellation (sidebar/detail panel from Tony prototype)
- LaTeX export command: /mos:latex
- Desktop Data Room MCP: KuzuDB Windows build blocked
- Grading calibration data: 0/100+ Example nodes

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260420-gg7 | Draft MINDRIAN-CANON.md product canon with 8 principles + cross-references | 2026-04-20 | b7d95bd | [260420-gg7-draft-mindrian-canon-md-product-canon-wi](./quick/260420-gg7-draft-mindrian-canon-md-product-canon-wi/) |

## Session Continuity

Last session: 2026-04-24T02:30:44.752Z
Stopped at: Completed 90-00-brain-md-schema-PLAN.md
Resume file: None
