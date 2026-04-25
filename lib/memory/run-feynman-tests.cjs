#!/usr/bin/env node
'use strict';

/**
 * Phase 81-01 test runner for the Feynman-MINTO foundation work.
 *
 * Discovers and runs test files that belong to the Feynman-MINTO pipeline:
 *   - lib/memory/feynman-prompts.test.cjs
 *   - lib/memory/narrative-schema.test.cjs
 *   - scripts/vault-section-minto-generator.test.cjs
 *
 * Runs each in a child process so a module-level assertion failure in one
 * file does not short-circuit the rest of the suite. Exits 0 on all pass,
 * 1 on any failure. Mirrors the lib/import/run-all-tests.cjs pattern.
 *
 * Usage:
 *   MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Defense-in-depth against browser-hijack during suite runs. Any test that
// ends up calling platform.openBrowser() will honor this and skip the real
// spawn while still exercising the localhost URL guard. Individual tests
// (e.g. dashboard-server.test.cjs) also set this locally; setting it at
// runner scope protects future tests that forget.
process.env.MINDRIAN_OPEN_BROWSER_DISABLE = '1';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const TEST_FILES = [
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'narrative-schema.test.cjs'),
  path.join(REPO_ROOT, 'scripts', 'vault-section-minto-generator.test.cjs'),
  // Phase 81-02 additions:
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts-drift.test.cjs'),
  path.join(
    REPO_ROOT,
    'scripts',
    'vault-section-minto-generator.integration.test.cjs'
  ),
  // Phase 81-04:
  path.join(REPO_ROOT, 'scripts', 'vault-regenerate-all.test.cjs'),
  // Phase 82-04: wiki artifact injection fixture-based tests.
  path.join(REPO_ROOT, 'scripts', 'generate-presentation.test.cjs'),
  // Phase 83-04: cross-session scope injection Tier 1 tests.
  path.join(REPO_ROOT, 'scripts', '83-scope-injection.test.cjs'),
  // Phase 83-05: hook dispatch scaffold smoke tests.
  path.join(REPO_ROOT, 'test', '83-hook-dispatch.test.cjs'),
  // Phase 83-06: filesystem write interception (Tier 1.5) tests.
  path.join(REPO_ROOT, 'test', '83-write-scope-check.test.cjs'),
  // Phase 83-07: mid-session intent classifier (Tier 2) tests.
  path.join(REPO_ROOT, 'test', '83-intent-classifier.test.cjs'),
  // Phase 83-08: honesty layer markdown test.
  path.join(REPO_ROOT, 'test', '83-honesty-layer.test.cjs'),
  // Phase 84-08: smart notebook co-pilot fixture-based test suite (15 live + 3 skip-gated).
  path.join(REPO_ROOT, 'test', '84-smart-notebook-copilot.test.cjs'),
  // Phase 85-04 (WIN-FIX-F-02): run-hook.cmd exit-code propagation regression fence.
  path.join(REPO_ROOT, 'tests', 'test-run-hook-cmd.cjs'),
  // Phase 85-08 (WIN-FIX-I): brain-client param schema regression (Finding I, v1.10.9).
  path.join(REPO_ROOT, 'tests', 'test-brain-client-params.cjs'),
  // Phase 85-09 (Finding J / LASZLO-001): self-update Windows failure family regression fence.
  path.join(REPO_ROOT, 'tests', 'test-self-update-platform.cjs'),
  // Phase 85-06 (WIN-FIX-H-02/H-03): cross-platform banner rendering regression fence.
  path.join(REPO_ROOT, 'tests', 'test-session-start-banner.cjs'),
  // Phase 87-00: cascade e2e acceptance gate fixture (exits 77 when env
  // degraded; the runner below treats 77 as SKIPPED, not FAILED).
  path.join(REPO_ROOT, 'test', 'fixtures', 'cascade-e2e', 'cascade-e2e.test.cjs'),
  // Phase 87-02: atomic write-lock concurrency fence (20 forked workers,
  // exactly 1 winner) -- proves fs.openSync('wx') TOCTOU fix.
  path.join(REPO_ROOT, 'lib', 'memory', 'write-lock-atomic.test.cjs'),
  // Phase 87-01: security trifecta (SEC-01 Cypher sanitization + SEC-02
  // API key file permissions + SEC-03 HSI timeout 5000 -> 30000).
  path.join(REPO_ROOT, 'lib', 'memory', 'security-trifecta.test.cjs'),
  // Phase 87-01a: ROOM.md + MINTO.md pre-commit hook (SEC-04). Worktree-safe
  // installer + .room-root sentinel scoping + symlink-safe walker + Windows
  // .cmd companion + session-start self-heal.
  path.join(REPO_ROOT, 'lib', 'memory', 'room-minto-hook.test.cjs'),
  // Phase 87-08: live dashboard Node server (scripts/serve-dashboard-live).
  // Covers openBrowser localhost guard, Stream-A chat-hide, MOS_BIND_ALL
  // refusal, and /api/room/* endpoint integration.
  path.join(REPO_ROOT, 'lib', 'memory', 'dashboard-server.test.cjs'),
  // Phase 87-05: MCP input validation (CASCADE-03 + CASCADE-05). Proves
  // SECTION_RE regex, safeResolveSection traversal guard, and
  // opportunitySchema JSON-structure validation.
  path.join(REPO_ROOT, 'lib', 'memory', 'mcp-input-validation.test.cjs'),
  // Phase 87-06: indexArtifact transaction wrap (CASCADE-04). Proves
  // BEGIN/COMMIT semantics via REAL mid-transaction rollback injection +
  // distinct testLockReleaseAfterCommit (enqueueWrite finally).
  path.join(REPO_ROOT, 'lib', 'memory', 'index-artifact-transaction.test.cjs'),
  // Phase 87-04: sync/async entry-point split (CASCADE-06). Proves three
  // new files exist, key-set parity between sync and async, every async
  // export is an AsyncFunction, legacy shim emits MOS_DEP_ROOM_OPS_LEGACY,
  // expanded-scope caller audit (scripts/ lib/ bin/ commands/ pipelines/
  // agents/ skills/) finds zero bare room-ops imports.
  path.join(REPO_ROOT, 'lib', 'memory', 'sync-async-entry-points.test.cjs'),
  // Phase 87-07: Brain session cache (5-min TTL + pending-promise pattern
  // for R-87-07-RACE concurrent-init guard, sha256 key hashing) + bounded
  // LRU for 3 intelligence-cascade caches (CASCADE-06). Includes load-time
  // smoke test that catches missing-method errors after the Map->LRU swap.
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-cache-lru.test.cjs'),
  // Phase 87-09: BYO API chat Bearer + CSRF double-submit + Origin-bound
  // tokens + Host DNS-rebinding guard + security headers + safeLogError
  // zero-log (R-87-09-CSRF gaps 1-6). Spawns serve-dashboard-live on
  // :3192 and exercises every guard via HTTP.
  path.join(REPO_ROOT, 'lib', 'memory', 'bearer-token.test.cjs'),
  // Phase 87-09: chat context builder -- 5 intent patterns (contradicts,
  // converges, stakeholders, gaps, briefing) stay under the 5K token
  // budget; empty stakeholders early-returns gracefully (R6 / Phase 84-05).
  path.join(REPO_ROOT, 'lib', 'memory', 'chat-context.test.cjs'),
  // Phase 88-00-B: Feynman-MINTO invariants validator (lib/core/
  // feynman-minto-invariants.cjs). 21 fixture tests across 5 violation
  // categories (existence, schema, freshness, coherence, atomicity).
  // Single source of truth consumed by every Phase 88 downstream plan.
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-minto-invariants.test.cjs'),
  // Phase 88-00: frontmatter schema v88 extension (last_generated_at,
  // last_artifact_write_seen_at, reasoning_health_score, flagged_weaknesses,
  // decision_log). Tests generator populates them, preserves decision_log
  // across regen, and narrative-schema validator accepts both old and new
  // structural payload shapes plus validateDecisionLogEntry helper.
  path.join(REPO_ROOT, 'lib', 'memory', 'minto-schema-v88.test.cjs'),
  // Phase 88-00 Task 2: idempotent migration script that backfills the five
  // v88 fields on existing Phase 81 MINTO files. Walks room tree, atomic
  // openSync wx + rename writes, --dry-run, already-v88 skip.
  path.join(REPO_ROOT, 'lib', 'memory', 'minto-migration-v88.test.cjs'),
  // Phase 88-01: folder-memory.cjs unified read contract (readTriple +
  // readDecisionLog + computeHealthScore) with sync + async entry points
  // mirroring Phase 87-04. 15 fixture tests: fresh triple, partial-missing,
  // invariant-violation stale, missing-timestamps stale, artifacts-newer
  // stale, parse-failed stale, references extracted, identity-text strip,
  // empty-dir graceful, decision-log 20-entry read, decision-log 21-entry
  // permissive read, health-score perfect 1.0, health-score zero, async
  // parity, key-set parity + AsyncFunction assertion.
  path.join(REPO_ROOT, 'lib', 'memory', 'folder-memory.test.cjs'),
  // Phase 88-02: minto-debouncer queue (10s coalesce window + atomic
  // tmp+rename writes + write-lock composition). 12 tests: enqueue,
  // coalesce (earliest-wins), distinct sections, window-expired append,
  // drain olderThanMs, atomic write safety, 5-fork concurrent same-section,
  // 5-fork concurrent distinct sections, peek idempotent, malformed JSON
  // self-heal with stderr warning, CLI subcommand, drain wall-clock timeout.
  path.join(REPO_ROOT, 'lib', 'memory', 'minto-debouncer.test.cjs'),
  // Phase 88-03: ROOM.md references recompiler (deterministic, atomic,
  // delimiter-preserving + mtime conflict detection). 10 tests: no
  // markers + artifacts append, existing block replaced byte-identically
  // outside markers, cross-section wikilinks deduped under Section links,
  // prose wikilinks NOT stripped into auto-block, system files filtered,
  // mtime conflict skip, 3-fork concurrent same-section, 20-artifact
  // sub-200ms budget, empty-section placeholder, no-ROOM.md exit 2.
  path.join(REPO_ROOT, 'lib', 'memory', 'recompile-room-references.test.cjs'),
  // Phase 88-04-B: atomic write contract for vault-section-minto-generator
  // (openSync 'wx' + fsync + invariants validate + acquireLock + rename).
  // 7 tests: happy path JSON envelope, 5-fork concurrent race, mid-write
  // crash preservation, invariant ERROR rejection with preservation,
  // WARNING passthrough, reader safety under interleaved writes,
  // fsync-before-rename ordering trace.
  path.join(REPO_ROOT, 'lib', 'memory', 'vault-section-minto-generator-atomic.test.cjs'),
  // Phase 88-04 Task 1: stamp-artifact-write helper. Stamps
  // last_artifact_write_seen_at into the section's MINTO.md frontmatter,
  // falls back to .mindrian/pending-stamps/<section>.json when MINTO is
  // absent or malformed. 6 tests: happy-path stamp + key preservation,
  // pending-stamps fallback, byte-identical body preservation, concurrent
  // stamp race with single final timestamp, malformed frontmatter -> pending
  // fallback, soft-fail on missing section dir.
  path.join(REPO_ROOT, 'lib', 'memory', 'stamp-artifact-write.test.cjs'),
  // Phase 88-04 Task 3: post-write triple-fire wiring. 9 tests covering
  // section .md write -> queue+recompile+stamp, non-room write no-op,
  // system files skip enqueue, .txt files skip, foreground wall-clock
  // bound, soft-fail exit 0, backgrounded spawn visible in source, and
  // Edit + MultiEdit tool-name matchers.
  path.join(REPO_ROOT, 'lib', 'memory', 'post-write-triple.test.cjs'),
  // Phase 88-05: UserPromptSubmit drain block in scripts/intent-classifier.
  // 7 tests: all-old drains + pending-tier1 file, all-new no-op, mixed
  // partition, empty queue no-op, 20-entry wall-clock bound, pending file
  // append across drains, session-crash recovery on next hook.
  path.join(REPO_ROOT, 'lib', 'memory', 'debouncer-drain-at-prompt.test.cjs'),
  // Phase 88-06: on-stop close-out triple snapshot. 8 tests covering
  // 3-section snapshot shape, readTriple-parity entry shape, queue drain
  // + stale surfacing, sentinel last_generated_at -> stale list, rapid
  // single-section exit under 3000ms hook budget, Phase 84 STATE.md write
  // preserved, atomic writes (no .tmp. leakage), and soft-fail on degraded
  // fixture with no MINTO files.
  path.join(REPO_ROOT, 'lib', 'memory', 'on-stop-snapshot.test.cjs'),
  // Phase 88-07 Task 1: TRIPLE_CONTEXT formatter pure unit tests. 12 tests
  // covering per-section block shape, empty/overflow decision_log rendering,
  // null governing_thought placeholder, references overflow, budget cap with
  // weakest-first elision (null score sorts first), token estimator,
  // stale annotation, pending-tier1 footer, zero sections, env-override
  // for SESSION_START_BUDGET_TOKENS, and SUMMARY baseline-measurement fence.
  path.join(REPO_ROOT, 'lib', 'memory', 'triple-context-formatter.test.cjs'),
  // Phase 88-07 Task 2: session-start TRIPLE_CONTEXT injection. 9 tests
  // covering snapshot-present render, snapshot-missing readTriple fallback,
  // no-active-room no-op, pending-tier1 footer, minto-stale footer,
  // wall-clock budget, Phase 83 ordering (TRIPLE_CONTEXT after ACTIVE ROOM
  // CONTEXT), soft-fail on degraded input, and env-override propagation to
  // the subshell node invocation.
  path.join(REPO_ROOT, 'lib', 'memory', 'session-start-triple-injection.test.cjs'),
  // Phase 88-08: pre-compact triple snapshot. 8 tests covering 3-section
  // snapshot shape, kind:"pre-compact" marker (distinguishes from 88-06
  // session-snapshot.json), 25-section truncation to MAX_SECTIONS=20 with
  // truncated:true + truncated_count:5, weakest-first ordering (highest
  // reasoning_health_score elided first), atomic tmp+rename (no .tmp.
  // leftovers), empty-room no-op (sections:{}), soft-fail on no-MINTO
  // fixture, and 20-section wall-clock under 1800ms inside 2000ms hook
  // budget.
  path.join(REPO_ROOT, 'lib', 'memory', 'pre-compact-snapshot.test.cjs'),
  // Phase 88-09: post-compact TRIPLE_CONTEXT re-injection. 9 tests
  // covering snapshot-present render, snapshot-missing fallback to live
  // readTriple (+ stderr "snapshot missing" log), malformed snapshot
  // fallback, empty-snapshot no-block emission, minto-stale.json +
  // pending-tier1-regen.json footers, 20-section wall-clock < 2500ms,
  // soft-fail on degraded input (exit 0), and content byte-identity vs
  // session-start emission given the same fixture inputs (same formatter
  // contract).
  path.join(REPO_ROOT, 'lib', 'memory', 'post-compact-reinjection.test.cjs'),
  // Phase 88-10: decision-capture module. 12 fixture tests covering
  // first write, append preservation, 20-entry cap + JSONL archive,
  // archive partitioned by archived-entry YYYY-MM (not today), invalid
  // entry rejection with MINTO unchanged, readDecisionLog on no-MINTO
  // and no-field shapes, 3-fork concurrent race, post-write invariants
  // validation, preserve-on-regen composition with 88-00 schema
  // contract, and special-char section names.
  path.join(REPO_ROOT, 'lib', 'memory', 'decision-capture.test.cjs'),
  // Phase 88-11: record-decision dual-write. 8 fixture tests proving
  // bin/mindrian-tools.cjs record-decision fires BOTH primary
  // (proactive-intelligence .proactive-intelligence.json write; pre-88,
  // unchanged) AND additive decision_log write (decision-capture.cjs;
  // 88-10). Covers derivable section happy path, missing source-artifact
  // skip, MINTO missing mismatch logging to decision-dual-write-errors.jsonl,
  // both-succeed clean exit, per-call idempotency append, error log
  // structural format, absolute-path source-artifact inside room, and
  // outside-room artifact skip with stderr warning. Primary write is
  // authoritative; dual-write never blocks or regresses primary behavior.
  path.join(REPO_ROOT, 'lib', 'memory', 'record-decision-dual-write.test.cjs'),
  // Phase 88-13: Feynman-MINTO guardian (scripts/feynman-minto-guardian.cjs)
  // with validator registry + four seed validators (minto-invariants,
  // snapshot-integrity, queue-health, stale-lifecycle). 16 tests: 10 core
  // modes (session-start, on-stop, pre-commit, clean-tmp) + 3 registry
  // (load + fail-open + id-collision) + 3 lifecycle validators
  // (snapshot-integrity partial/empty/healthy, queue-health 500/1000
  // ceilings, stale-lifecycle ghost pruning atomically from stale.json).
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-minto-guardian.test.cjs'),
  // Phase 88.1-07: frontmatter schema validator (lib/core/frontmatter-
  // schemas.cjs pure function + scripts/frontmatter-schema-validator.cjs
  // PostToolUse hook). 10 fixture tests covering valid artifact, missing
  // single required field, all required missing -> critical, malformed
  // YAML (null) -> critical, ROOM.md missing name, STATE.md missing
  // artifact_count, MINTO.md delegation to feynman-minto-invariants,
  // unknown field -> warning, purity (no fs + BSL header + no dashes),
  // empty {} frontmatter -> critical. Advisory not blocking (R2).
  path.join(REPO_ROOT, 'lib', 'memory', 'frontmatter-schema-validator.test.cjs'),
  // Phase 88.1-08: async artifact auto-commit throttle (lib/core/auto-
  // commit-throttle.cjs pure module). 10 fixture tests covering empty
  // ledger, recent entry throttle, stale entry no-throttle, per-path
  // scope, updateLedger immutability, pruneOldEntries drop/keep
  // semantics, THROTTLE_WINDOW_MS = 5000, purity (no fs), and 1000-
  // entry prune performance < 5ms.
  path.join(REPO_ROOT, 'lib', 'memory', 'async-artifact-auto-commit.test.cjs'),
  // Phase 88.1-16: query-efficiency telemetry pure module
  // (lib/core/token-estimator.cjs). 12 fixture tests covering estimateTokens
  // (chars/4 ceil + graceful null/non-string), estimateRoomTokens (valid
  // room, session cache, invalid-room null, non-.md skip), clearCache,
  // ratio sanity, validateEventShape (8-field contract), classifyRatio
  // (10x threshold), aggregateEvents (median/mean/top5 per-command).
  // Defends the Canon Part 6 57x-efficiency claim by making it measurable.
  path.join(REPO_ROOT, 'lib', 'memory', 'query-efficiency-telemetry.test.cjs'),
  // Phase 88.1-04: statusline MINTO segment cache + format helpers
  // (lib/core/statusline-cache.cjs). 10 fixture tests covering getCached
  // on absent cache, setCached+getCached fresh hit, TTL expiry, graceful
  // fallback on permission-denied, distinct-key isolation, atomic write
  // (no partial observer), cache location contract, truncateGoverningThought
  // short / long variants, and classifyHealth Canon Part 2 thresholds.
  // Backs the 300ms render budget (CONTEXT R1) by keeping the warm path
  // a single JSON parse.
  path.join(REPO_ROOT, 'lib', 'memory', 'statusline-minto-segment.test.cjs'),
  // Phase 88.1-05: /mos:status Shape E renderer (scripts/mos-status.cjs).
  // 12 fixture tests covering healthy 3-section render, stale suffix,
  // empty (no MINTO yet) placeholder, 80-char truncation, 10-section
  // summary counts (filled/stale/median), --stale-only filter, <section>
  // full-detail argument, missing-room graceful exit, Canon Part 8 no-
  // network surface, Shape E zones (header/rows/summary/actions), and
  // warm-cache vs cold-cache paths sharing the Plan 88.1-04 5s TTL cache.
  path.join(REPO_ROOT, 'lib', 'memory', 'mos-status-renderer.test.cjs'),
  // Phase 88.1-06: SessionStart MINTO banner formatter (lib/memory/
  // sessionstart-banner-formatter.cjs). 10 fixture tests covering top-3
  // by-mtime selection on a 5-section room, 2-section no-padding render,
  // 0-section brand-only render, no-active-room silent empty, stale
  // (stale: reason) suffix, empty governing_thought (no MINTO yet)
  // placeholder, 60-char truncation with Unicode ellipsis, tight 200-
  // token budget drops to 2 rows, very tight 50-token budget drops all
  // rows, and dynamic version read from .claude-plugin/plugin.json
  // (no hardcoded semver) so banner brand never drifts on release.
  path.join(REPO_ROOT, 'lib', 'memory', 'sessionstart-minto-banner.test.cjs'),
  // Phase 90-00: BRAIN.md schema validator (lib/core/brain-md-schema.cjs).
  // 18 fixture tests across 5 violation categories (existence, schema,
  // staleness, attribution, canon_boundary). Mirrors Phase 88-00-B
  // invariants pattern: hand-written narrow-dialect YAML parser, frozen
  // SEVERITY + CATEGORIES + STALENESS + STALE_REASON + REQUIRED_
  // FRONTMATTER_FIELDS + OPTIONAL_SECTION_HEADINGS enums, parse-error
  // fast return. Canon Part 8 boundary baked in at schema layer via
  // conservative regex set (email / currency / quoted-person / meeting
  // / SSN) with action_hint "canon_part8_review". Load-bearing contract
  // for Plans 90-01 (derivation writer), 90-04 (readQuadruple), 90-05
  // (registry-discoverable invariants), 90-09 (Phase 91 Navigation
  // Engine interface spec).
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-md-schema.test.cjs'),
  // Phase 90-01: Brain derivation core (lib/core/brain-derivation.cjs +
  // lib/core/brain-derivation-prompts.cjs). 18 fixture tests across
  // happy path, offline/timeout/rate-limit failure modes, schema gate
  // rejection, concurrent writes, triple absent, null governing_thought
  // sha256 sentinel, only_sections/dry_run options, schema()
  // call-count invariant, atomic write tmpfile naming pattern, crash
  // cleanup, deriveSection never-throws contract, three-surface CJS
  // purity, and the LOAD-BEARING Canon Part 8 payload audits (Tests
  // 13 + 14) that capture every outbound Brain cypher + pinecone
  // search and assert every payload against the frozen allow-list
  // regex set AND that dangerous user content ("Lawrence / 5M /
  // revenue") NEVER leaks into any Brain call.
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-derivation.test.cjs'),
  // Phase 90-02: Brain derivation queue (lib/core/brain-derivation-queue.cjs).
  // 15 fixture tests covering enqueue (idempotent dedupe, replace on hash
  // change, cross-section isolation, .mindrian dir autocreate), readQueue
  // (missing file + malformed JSON self-heal), writeQueueAtomic (tmpfile +
  // rename), concurrent write race (no corruption), SOFT_CAP=500 warning,
  // HARD_CAP=1000 rejection, Canon Part 8 invariant audit (queue carries
  // ONLY section + hash pairs + reason + timestamp; never governing_thought
  // text), and drain (stale-queue-race guard via current-triple-hash
  // comparison, brain-offline re-enqueue, maxEntries partition).
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-derivation-queue.test.cjs'),
  // Phase 90-03 Task 1: BRAIN.md staleness computation (lib/core/brain-md-
  // staleness.cjs). 13 fixture tests covering the 4 staleness signals
  // (hash mismatch, age_exceeded, brain_graph_version_mismatch,
  // brain_offline), precedence rules (hash-mismatch > age > version),
  // recommended_action demotion when Brain offline (enqueue_regen ->
  // enqueue_when_brain_online), BRAIN_STALE_AGE_DAYS env override with
  // fallback on garbage, malformed-frontmatter -> parse_failed stale
  // reason, and the LOAD-BEARING Canon Part 8 audit (Test 13) that runs
  // 10 sections through computeBrainStaleness and asserts ZERO
  // brain-client.query/search/smartSearch calls; isAvailable + schema
  // are the ONLY allowed Brain touches during the scan.
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-md-staleness.test.cjs'),
  // Phase 90-03 Task 2: scripts/session-start Phase 90-03 integration
  // tests. 5 fixture tests spawning real bash session-start with BRAIN.md
  // fixtures: mixed fresh/stale/absent annotation render, Brain-offline
  // stale annotation with empty queue (no enqueue when we cannot drain),
  // Brain-online stale -> enqueue lands + wall-clock < 5000ms,
  // BRAIN_STALENESS_SKIP=1 feature flag suppression, and backward-compat
  // for rooms with zero BRAIN.md (no "Brain derivation" noise lines).
  path.join(REPO_ROOT, 'lib', 'memory', 'session-start-brain-staleness.test.cjs'),
  // Phase 90-04: readQuadruple extends Phase 88-01 readTriple additively
  // with a brain field parsed from BRAIN.md (lib/core/folder-memory.cjs +
  // lib/core/folder-memory-async.cjs + lib/core/folder-memory-shared.cjs
  // additive surface). 17 fixture tests: 5 parser-isolation cases for
  // parseBrainMd (valid full struct, absent->null literal, malformed->
  // emptyBrain parse_failed:true, 3-of-9 sections populated + 6 absent,
  // unknown heading ignored for future-compat) + 12 integration cases
  // (sync readQuadruple happy-path + brain absent + malformed + nonexistent
  // path no-throw, async AsyncFunction constructor parity, sync/async deep
  // equality, key-set parity with readTriple back-compat preserved,
  // isQuadrupleFresh 5 cases covering brain null/fresh/stale plus
  // brain_offline exemption and derivation-stale). Backward-compat
  // critical: readTriple signature/return unchanged. OPTIONAL_SECTION_
  // HEADINGS parity with brain-md-schema also asserted.
  path.join(REPO_ROOT, 'lib', 'memory', 'folder-memory-quadruple.test.cjs'),
  // Phase 90-05: BRAIN.md invariants validator (lib/memory/validators/
  // brain-md-invariants.cjs). Phase 88-13 registry-compatible drop-in:
  // {id, severity_map, validate, scope:'section'} + auto-discovered by
  // guardian's validator loader. Wraps Plan 90-00 validateSchema as the
  // schema check and adds three runtime checks: (A) staleness vs live
  // triple (governing_thought_hash mismatch -> staleness/warning with
  // action_hint 'enqueue_regen'), (B) brain_graph_version drift vs
  // .mindrian/brain-schema-cache.json (-> staleness/warning), (C)
  // cross-file Canon Part 8 body-text scan with 5-violation cap
  // (canon_boundary/warning + action_hint 'canon_part8_review'). 15
  // fixture tests + 1 shape test cover absence-is-valid, schema
  // wrapping, attribution, staleness, drift, 4 canon leak patterns,
  // cap, aggregation, parse-failure short-circuit, non-BRAIN.md not
  // scanned, and Phase 88-13 guardian auto-discovery integration (real
  // guardian on-stop spawn, invariant-report.json assertion). Zero
  // guardian.cjs changes; zero new runtime deps; BSL 1.1.
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-md-invariants-validator.test.cjs'),
  // Phase 90-07: /mos:brain-derive command dispatcher (scripts/brain-derive-
  // command.cjs). 12 fixture tests covering the 4 invocation modes (single
  // section, --all, --cross-room, --dry-run) plus graceful degradation
  // paths (Brain offline from start, rate-limit mid-batch, invalid section,
  // no active room, schema-gate rejection on one section) plus streaming
  // progress on --all runs > 3 sections and the Shape E Action Report
  // rendering contract (header/counts/per-section/NEXT). Mocks brain-
  // client + brain-derivation via require.cache overrides (same pattern
  // as Plan 90-01 and 90-02). Canon Part 8: dispatcher is a thin wrapper
  // over deriveSection; all Canon boundaries enforced inside deriveSection
  // + cross-room-aggregator; dispatcher adds zero net new Brain surface.
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-derive-command.test.cjs'),
  // Phase 90-06: cross-room aggregator (lib/core/cross-room-aggregator.cjs).
  // 18 fixture tests covering Phase 83 registry discovery, GUARDRAIL.md
  // sealed-room skip (byte-for-byte reuse of Phase 83 contract), per-room
  // brain_cross_room:false opt-out, out-of-scope absolute-path rejection
  // (ALLOWED_ROOT under ~/MindrianRooms/), unreadable/timeout/self-
  // exclusion skip reasons, three contradiction types (hash_divergence,
  // framework_contradiction, problem_type_mismatch), max_rooms cap,
  // registry-less and malformed-registry graceful fallback, 10-room
  // wall-clock < 500ms, and the LOAD-BEARING Canon Part 8 payload audits
  // (Tests 16-18): adversarial fixture with dangerous content ('Lawrence
  // said $5M', emails, SSN, phone, 'meeting with') across 3 rooms; assert
  // JSON.stringify(result) contains ZERO forbidden substrings, every
  // detail_scalar field is primitive with strings <=40 chars and matching
  // no forbidden regex, and brain-derivation.cjs cross_room_scan
  // integration populates 'Flagged Contradictions (cross-room)' with
  // slug-based entries only. Fourth Canon Part 8 tripwire (schema doc +
  // prompt-builder allow-list + invariants body scan + this plan's
  // sanitizeDetailScalar + JSON.stringify output audit).
  path.join(REPO_ROOT, 'lib', 'memory', 'cross-room-aggregator.test.cjs'),
  // Phase 90-08: graceful degradation end-to-end suite (third-line
  // defense for Phase 90). 14 failure scenarios + 2 cross-cutting audits,
  // four invariants per scenario: A no crash, B no partial/orphaned
  // BRAIN.md, C user-visible status (reason or stderr), D retry path
  // correct. Scenarios span Brain-offline permanent + intermittent,
  // API quota exhaustion, mid-derivation timeout, schema drift mid-
  // session, malformed Brain response, network partition, filesystem
  // EACCES, ENOSPC on atomic rename, concurrent deriveSection race,
  // Canon Part 8 regression under ordinary + timeout operation
  // (dangerous fixture: Lawrence + 5M + revenue + emails + SSN + phone),
  // cross-room aggregator under corrupt peer room, and concurrent
  // session-start staleness scans (Plan 90-02 idempotency). Audit A1
  // scans every BRAIN.md written during the suite against the frozen
  // forbidden regex set (email / currency / quoted-person / meeting /
  // SSN / phone); any match hard-fails the suite. Audit A2 sweeps
  // every tmp root for BRAIN.md.tmp.*.brain orphans; any found hard-
  // fails. Proves Canon Part 8 holds AS A FAILURE-MODE GUARANTEE.
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-derivation-graceful-degradation.test.cjs'),
  // Phase 89.1a-03: Brain methodology substrate loader fixture suite.
  // 14 scenarios: 6 adversarial (Canon Part 8 boundary), 3 happy-path
  // (Mode A1/A2/A3), 3 cache/persistence (TTL + validator), 2 graceful
  // degradation (Mode B1/B3). A1 cross-scenario cache sweep + A2 orphan
  // tmpfile sweep at suite end. Inherits Phase 90-08 mock-via-require.cache
  // + runScenario pattern byte-for-byte.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-brain-substrate.cjs'),
  // Phase 89.1-01: brain-client shape adapter + validator Check E
  // embedding-or-score relaxation. 14 fixture scenarios:
  //   T1-9 (Task 1): pullFromBrain.adaptBrainSearchResponse translates
  //     live MCP {result:{hits:[]}} into legacy {matches:[]} with
  //     score-bearing entries (Pinecone searchRecords returns no values).
  //     Tests cover live shape, empty hits, legacy back-compat, malformed
  //     shape, sparse hit, loadSubstrate Mode A3 + cache landing,
  //     Canon Part 8 audit chokepoint preservation, Pitfall 1 quota
  //     fallback rejection, and graceful degradation on null response.
  //   T10-14 (Task 2): validator Check E embedding-or-score relaxation.
  //     Score-only valid, score-out-of-range critical, neither critical,
  //     legacy 1024-dim back-compat, canon_boundary on forbidden regex
  //     in score-only entry metadata.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-brain-substrate-shape.cjs'),
];

// Exit code convention for child tests:
//   0  -> PASS
//   77 -> SKIPPED (POSIX test-infra-broken; e.g. missing python3, missing
//         scripts/classify-insight). Must NOT count as failure.
//   other (including 1) -> FAIL.
let failed = 0;
let skipped = 0;
for (const t of TEST_FILES) {
  const rel = path.relative(REPO_ROOT, t);
  if (!fs.existsSync(t)) {
    process.stderr.write('MISS ' + rel + ' (file does not exist)\n');
    failed += 1;
    continue;
  }
  const res = spawnSync(process.execPath, [t], { stdio: 'inherit' });
  if (res.status === 0) {
    process.stdout.write('PASS ' + rel + '\n');
  } else if (res.status === 77) {
    process.stdout.write('SKIP ' + rel + ' (exit 77, env degraded)\n');
    skipped += 1;
  } else {
    process.stderr.write('FAIL ' + rel + ' (exit ' + res.status + ')\n');
    failed += 1;
  }
}

const total = TEST_FILES.length;
const passed = total - failed - skipped;
process.stdout.write(
  '\nFeynman test runner: ' +
    passed + '/' + total + ' passed, ' +
    skipped + ' skipped, ' +
    failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
