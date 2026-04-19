---
gsd_state_version: 1.0
milestone: v1.10.9
milestone_name: -- Cross-Platform Parity
status: executing
stopped_at: Completed 87-10-v2-PLAN.md through Task 10v2-3 (human-verify checkpoint). Gates 1-3 closed at commit b30484d. Awaiting user approval to create git tag v1.10.12 + marketplace.json ref pin.
last_updated: "2026-04-19T22:55:26.665Z"
last_activity: 2026-04-19 -- Phase 88 execution started
progress:
  total_phases: 13
  completed_phases: 2
  total_plans: 36
  completed_plans: 28
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Convert uncertainty to manageable risk -- every framework interaction produces bankable opportunities, every session starts with persona-aware routing
**Current focus:** Phase 88 — feynman-minto-memory-layer

## Current Position

Phase: 88 (feynman-minto-memory-layer) — EXECUTING
Plan: 1 of 16
Status: Executing Phase 88
Last activity: 2026-04-19 -- Phase 88 execution started

Progress: [░░░░░░░░░░] 0%

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

### Pending Todos

- generate-hub.cjs standard features (sticky top bar, persona card, vis-network graph)
- Update generate-snapshot.cjs constellation (sidebar/detail panel from Tony prototype)
- LaTeX export command: /mos:latex
- Desktop Data Room MCP: KuzuDB Windows build blocked
- Grading calibration data: 0/100+ Example nodes

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-19T20:48:08.426Z
Stopped at: Completed 87-10-v2-PLAN.md through Task 10v2-3 (human-verify checkpoint). Gates 1-3 closed at commit b30484d. Awaiting user approval to create git tag v1.10.12 + marketplace.json ref pin.
Resume file: None
