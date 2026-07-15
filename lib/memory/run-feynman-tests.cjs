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
  // v1.11.2: PostToolUse hook envelope shape regression fence
  // (tests/test-hook-envelope-shape.cjs). 5 scenarios covering both .cjs
  // PostToolUse hooks patched in v1.11.2 (frontmatter-schema-validator +
  // async-artifact-auto-commit) plus a fence over the v1.10.19 reference
  // fix (query-efficiency-telemetry). For each hook: silent path emits
  // zero stdout bytes; message path either silent or emits a Claude Code
  // 2.x compliant envelope (top-level keys subset of {continue, stopReason,
  // suppressOutput, systemMessage, decision, reason, hookSpecificOutput};
  // additionalContext NOT at root; if hookSpecificOutput present,
  // hookEventName === 'PostToolUse'). Soft-fail invariant preserved (always
  // exit 0). Bash post-write hook deferred to follow-up patch.
  path.join(REPO_ROOT, 'tests', 'test-hook-envelope-shape.cjs'),
  // Phase 95-02: bash post-write envelope shape + cascade side-channel
  // (<roomDir>/.mindrian/last-cascade.json) atomic write fence. Mirrors the
  // PostToolUse envelope contract from tests/test-hook-envelope-shape.cjs
  // applied to the bash post-write hook (which v1.11.2 deferred). Stdout
  // emits hookSpecificOutput.additionalContext one-liner only; cascade
  // payload moves to LOCAL side-channel JSON per Canon Part 8.
  path.join(REPO_ROOT, 'tests', 'test-cascade-side-channel.cjs'),
  // Phase 95-03: room-proactive SKILL.md side-channel-reader contract +
  // synthetic dry-run. Text-level fence catching accidental rollback to
  // the OLD additionalContext-only detection contract that was load-
  // bearing-broken since Phase 88.1-03 shipped. Negative-string list
  // covers ALL 5 OLD framings (not just the line-80-92 literal); current
  // lines 102-113 of pre-95-03 SKILL.md were ALSO carrying the OLD
  // framing and are part of the rewrite scope, not the preserved range.
  // Asserts the cool-UI render directive is present (cascade-finding
  // render must NOT fall back to raw prose) and that the prose APPROVE/
  // REJECT/DEFER flow at SKILL.md (current) lines 114-160 is preserved
  // (F.0 selector deferred to Phase 88.2 / 97 per
  // room/decisions/decision-phase-95-sequencing.md).
  path.join(REPO_ROOT, 'tests', 'test-room-proactive-side-channel.cjs'),
  // Phase 95.1-02: 7 RED test skeletons for the 6 new drift classes (B/C/
  // D/E/F) plus the section-intelligence generator and the doctor self-
  // compliance retrofit. Validation-architecture-first wave per 95.1-
  // VALIDATION.md: tests land BEFORE production code (Wave 1) so each
  // implementation lands as a RED -> GREEN transition, never as blind
  // shipping. Existing bash post-write hook + Plan 95.1-01 fixture +
  // Plan 95.1-03 generator make tests 3 + 6 GREEN today; tests 1, 2, 4,
  // 5, 7 stay RED until Wave 1 plans 95.1-04..95.1-08 land.
  // Per Pitfall 2 from 95.1-RESEARCH.md: every spawnSync sets
  // MINDRIAN_ROOMS_HOME to a scratch dir so no test can leak into the
  // user's real active room.
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-b.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-c.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-cascade-surface-e2e.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-e.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-f.cjs'),
  // Phase 95.2-00: hermetic regression for atomic-swap install-cache recovery
  // (DOCTOR-95.2-01..05, -08). 9 scenarios exercise all 4 MOS_TEST_FORCE_FAIL
  // injection points (copy/verify/rename-old/commit) plus the missing-install
  // class A eligibility renderer auto-fire (s7 spawns doctor in human-render
  // mode and asserts [F.1 Next Move] + /mos:doctor --fix appear in stdout).
  // Hermetic via MINDRIAN_PLUGIN_HOME env override.
  path.join(REPO_ROOT, 'tests', 'test-doctor-atomic-swap.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-generate-section-intelligence.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-ui-self-compliant.cjs'),
  // Phase 217 Plan-02 Wave-0 gates:
  //   the contract-parity test -> D-03 HARD-BLOCKING declaration completeness
  //     gate over every data/doctor-modules.json entry (exit 1 on any gap;
  //     proves its own bite via an in-memory negative case).
  //   the card-fire-health test -> D-05 hermetic fixture tests for the
  //     card-fire instrument-health module (absent/valid/malformed/stale log).
  //   the doc-parity test (Plan-07) -> D-04 regression guard: doctor.md flags vs
  //     parseArgs flags + the --fix class set vs data/doctor-modules.json
  //     fix_supported (hard-fail on doc drift; proves its own bite).
  path.join(REPO_ROOT, 'tests', 'test-doctor-module-contract-parity.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-card-fire-health.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-doc-parity.cjs'),
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
  // Phase 89.1-02: Domain analyzer fixture suite. 11 scenarios
  // (1 happy + 4 edge + 4 adversarial + 2 determinism) + suite-end
  // A1 sweep over every analyzer output against FORBIDDEN_PATTERNS +
  // DANGEROUS_SUBSTRINGS. Asserts ExternalEgressViolation fires on
  // adversarial substrate metadata. Inherits 89.1a-03 mock-via-
  // require.cache pattern byte-for-byte.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-domain-analyzer.cjs'),
  // Phase 89.1-03: Query matrix fixture suite. 11 scenarios
  // (1 happy + 4 edge + 4 adversarial + 2 determinism) + suite-end
  // A1 sweep over every generated query string. Determinism fence:
  // 5 invocations of identical input produce identical JSON.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-query-matrix.cjs'),
  // Phase 89.2-01: Shared egress primitives fixture suite. 8 scenarios
  // + A1 forbidden-pattern sweep + A2 orphan tmpfile sweep. Covers the
  // ExternalEgressViolation extracted class, FORBIDDEN_PATTERNS byte-for-byte
  // re-export with require-time drift guard, auditQueryString +
  // auditQueryObject chokepoint helpers, atomic telemetry ledger with
  // sha256-hashed query_text (literal NEVER persists), per-source budget
  // math over rolling 24h window, and graceful fs-error degradation.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-egress-primitives.cjs'),
  // Phase 89.2-02: Academic fetcher fixture suite. 20 scenarios total
  // (12 fetcher + 6 validator + A1 forbidden-pattern sweep + A2
  // FORBIDDEN_PATTERNS parity gate). Covers OpenAlex + arXiv + PubMed
  // + Scopus + IEEE + Nature dispatch, dedup determinism, API-key
  // graceful degradation, 429 rate-limit graceful, timeout graceful,
  // malformed response graceful, per-source budget exhausted, 4
  // adversarial Canon Part 8 scenarios proving ZERO captured URLs +
  // ZERO telemetry on adversarial input, chokepoint exclusivity static
  // grep (exactly 1 fetch( call site).
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-fetcher-academic.cjs'),
  // Phase 89.2-03: Patents fetcher fixture suite. 17 scenarios total
  // (11 fetcher + 6 validator + A1 sweep + A2 parity). Covers Google
  // Patents + USPTO dispatch with pre-flight Canon Part 8 audit
  // (Pattern 6 -- walks every query through chokepoint BEFORE source
  // loop runs so adversarial inputs at any position produce ZERO
  // captured URLs). PATENTS_SOURCES validator gate (Pattern 7) scopes
  // Checks B/C/E/F to google_patents + uspto entries on the shared
  // global ledger.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-fetcher-patents.cjs'),
  // Phase 89.2-04: Industry fetcher fixture suite. 17 scenarios total
  // (11 fetcher + 6 validator + A1 sweep + A2 parity). Covers Tavily
  // orchestration with TWO-LAYER auditQueryString chokepoint (Layer 1
  // on user query, Layer 2 on each refined sub-query AFTER template
  // substitution). 4 adversarial scenarios including 2 second-layer
  // template-override attacks proving defense-in-depth. POST + body
  // capture for body-payload audit. INDUSTRY_SOURCES = {tavily}
  // validator gate.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-fetcher-industry.cjs'),
  // Phase 89.2-05: Experts post-processor fixture suite. 12 scenarios
  // + A1 sweep. Post-processor (NO new egress surface); extracts
  // deduped author records from academic fetcher papers[] output with
  // composite-key dedup (name|orcid), standard h-index, and 3-layer
  // public-email gate (PUBLIC_EMAIL_SOURCES allow-list = openalex only
  // per kickoff section 15 Q4 + strict regex + FORBIDDEN_PATTERNS scan).
  // 4 adversarial scenarios verify auditQueryObject defense-in-depth
  // pre-return scrub.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-fetcher-experts.cjs'),
  // Phase 89.2-06 Task 1: Pinecone bridge standalone fixture suite. 4
  // scenarios + A1 sweep. Covers strict 1024-dim Pinecone-direct vector
  // retrieval via thin JSON-over-stdio CJS shim around existing
  // rs_cache.py::fetch_all_from_namespace (resolves deferred-from-89.1
  // strict-1024-dim item without touching Brain MCP). Mocks spawnSync
  // via require.cache override. Cosine similarity identity (1.0) +
  // anti-parallel (-1.0) + orthogonal (0.0) corner cases.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-pinecone-bridge.cjs'),
  // Phase 89.2-06 Task 2: Preprocessor fixture suite. 10 scenarios +
  // A1 sweep. Phase 2 deterministic 5-field-per-document preprocessor
  // (document_id + technical_terms[] + concepts[] + methods[] +
  // relevance_score + boundary_flag). Covers source-aware text
  // extraction (papers/patents abstract; industry signals signal),
  // determinism (5 invocations byte-identical), boundary-flag
  // heuristic, and 3 adversarial Canon Part 8 scenarios.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-preprocessor.cjs'),
  // Phase 89.2-06 Task 3: Differential scorer fixture suite. 10
  // scenarios + A1 sweep. Phase 3 dual-floor filter
  // (passes IFF diff > 0.3 AND lsa > 0.2 AND bert > 0.2; strict
  // comparisons). LSA via embedded sklearn TfidfVectorizer + TruncatedSVD
  // (DELIBERATE Canon Part 7 carve-out, documented in 3 locations);
  // BERT via Pinecone-direct bridge. Two-mock pattern (spawnSync +
  // rs-pinecone-bridge require.cache override) covers 4-cell graceful
  // degradation matrix. 2 adversarial scenarios verify bridges are
  // NEVER called when Layer 1 audit fires.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-differential-scorer.cjs'),
  // Phase 89.2-07 Task 1: Innovation classifier fixture suite. 8
  // scenarios + A1 sweep. Phase 3 deterministic 3-enum classifier
  // (structural_transfer / semantic_implementation / hybrid) on
  // {diff, lsa, bert, passes} pair output. Strict > thresholds
  // (lsa=0.3, bert=0.3); boundary at exact threshold falls to default
  // fallback. Classification independent of passes. 2 adversarial
  // Canon Part 8 scenarios.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-innovation-classifier.cjs'),
  // Phase 89.2-07 Task 2: Breakthrough scorer fixture suite. 10
  // scenarios + A1 sweep. Phase 3 5-dimension 0-10 rubric
  // (feasibility + market + magnitude + advantage + impact). Frozen
  // DIMENSIONS array enforces deterministic dominant_dimension
  // tie-break. Each dimension is a pure step function (no continuous
  // interpolation). 2 adversarial Canon Part 8 scenarios.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-breakthrough-scorer.cjs'),
  // Phase 89.2-07 Task 3: Thesis generator fixture suite. 9 scenarios
  // + A1 sweep. Phase 4 pure-template-fill (string concat, NOT
  // template-literal interpolation) producing
  // 'By applying X to Y, achieve Z because mechanism bridge_concept.'
  // NO runtime LLM. Z-fallback ('novel insight') and bridge_concept
  // fallback ('domain analogy') as frozen constants. 2 adversarial
  // Canon Part 8 scenarios verify pre-input throw OR pre-return scrub.
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-thesis-generator.cjs'),
  // Phase 89.3-01: rs-neo4j-writer (Aura Cypher writer; idempotent MERGE; rollback Cypher; Canon Part 8 defense)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-neo4j-writer.cjs'),
  // Phase 89.3-02: rs-sqlite-mirror (Tier 0 SQLite writer; INSERT OR REPLACE; rollback SQL; Canon Part 8 defense)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-sqlite-mirror.cjs'),
  // Phase 89.3-03: rs-mind-map (5-branch Cytoscape; Tier 0/1 read paths; Canon Part 8 audit on HTML)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-mind-map.cjs'),
  // Phase 89.3-04: rs-expert-mapper (Cypher MATCH+MERGE; Tier 0 graceful degradation; Canon Part 8 2-seam defense)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-expert-mapper.cjs'),
  // Phase 89.3-05: bridge-writer-enhanced (regression-tested; thesis + breakthrough_score frontmatter; Canon Part 8 audit on rendered output)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-bridge-writer-enhanced.cjs'),
  // Phase 89.4-01: rs-canon-violations (Canon Part 3 closed-vocabulary enforcement; CanonVerbViolation + CANONICAL_VERBS + validateVerb)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-canon-violations.cjs'),
  // Phase 89.4-02: rs-chain-feeder-core (lookupUpstream + emitChainMetadata; Brain FEEDS_INTO topology via existing chokepoint; Canon Part 8 audit at both entry points)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-chain-feeder-core.cjs'),
  // Phase 89.4-03: rs-chain-feeder-skill-spawn (5-rule deterministic table per kickoff section 6.4; first-match-wins; recommendSkillSpawn body wired in place)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-chain-feeder-skill-spawn.cjs'),
  // Phase 89.5-01: rs-commercial-assessor (deterministic 3-field commercial layer; frozen tables + Canon Part 8 input audit; NO runtime LLM)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-commercial-assessor.cjs'),
  // Phase 89.5-02: rs-nl-to-query (HARDEST Canon Part 8 surface in v1.11.0; buildBrainQueryFromNL chokepoint + 3-seam audit + 6+ adversarial fixtures)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-nl-to-query.cjs'),
  // Phase 89.5-03: rs-query-to-text (Larry-voiced NL explanation; frozen VOICE_TEMPLATES + deterministic FNV-1a kind detection + 2-seam audit)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-query-to-text.cjs'),
  // Phase 89.5-04: rs-discovery-engine (top-level orchestrator; chains 17 phase modules; Tier 0/Mode B graceful; Canon Part 8 input audit at gate)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-discovery-engine.cjs'),
  // Phase 89.5-05: rs-explain-command (end-to-end CLI smoke; bidirectional NL-Graph; 4 e2e scenarios + BSL header check + A1 sweep)
  path.join(REPO_ROOT, 'lib', 'memory', 'test-rs-explain-command.cjs'),
  // Phase 91-00: navigation-engine core (L5 Decision layer; decide(turn, ctx) composes 5 signals; tier-mode + RECOMMENDED gate + Section 4 staleness + Section 8 trace; 33 fixtures across shared helpers + decide() orchestration)
  path.join(REPO_ROOT, 'lib', 'memory', 'navigation-engine-core.test.cjs'),
  // Phase 91-01: USER.md persona durability (lib/core/persona-taxonomy.cjs
  // frozen tables + Larry-to-Brain D-03 translation; lib/core/user-md-ops.cjs
  // readUserMd / writeUserMdAtomic / detectPersonaUpdate / emptyUser; 22
  // fixtures covering taxonomy invariants, atomic write under load,
  // graceful malformed-fallback, update threshold + consecutive-turn rule,
  // user_override bypass, cross-session persistence subprocess, and Canon
  // Part 8 grep guard).
  path.join(REPO_ROOT, 'lib', 'memory', 'user-md-persona.test.cjs'),
  // Phase 91-02: UserPromptSubmit hook integration (scripts/intent-
  // classifier.cjs Phase 91 navigation engine block). 12 fixture tests:
  // happy path NAVIGATION DECISION emission, full injection shape with 6
  // labeled fields + Why line on null values, 1200ms hard timeout
  // fallback under MOS_NAV_TEST_SLEEP=5000ms, engine throw fallback
  // (classifier byte-stable), atomic decision_trace persistence under 10
  // rapid runs, 50-entry rotation (drop oldest 10 -> 41 on disk), session
  // ID scoping (CLAUDE_SESSION_ID + sha256 fallback), Phase 83 mismatch
  // warning preserved when engine returns Tier 0, per-turn quadruple
  // cache observable via MOS_NAV_TEST_COUNTER, USER.md persona ->
  // intent_persona.archetype mapping with absent-USER.md graceful path,
  // Canon Part 8 source-scan (zero brain-client.query/search/smartSearch
  // + zero fetch + zero shell-out curl), and cold/warm wall-clock budget
  // with elapsed_ms field on every persisted trace entry.
  path.join(REPO_ROOT, 'lib', 'memory', 'userpromptsubmit-integration.test.cjs'),
  // Phase 91-03: skill-activation-router (lib/core/skill-activation-
  // router.cjs). Composes navigation-engine.decide() output with legacy
  // file-state + env activation. Engine precedence when fire_skill is
  // set; legacy fallback when engine silent; mixed when only
  // suppress_skills is populated. Canon Part 3 closed 10-verb
  // vocabulary enforced (validateVerb + canonicalizeVerb); unknown
  // verbs rejected with canon_part_3_unknown_verb_rejected trace note.
  // Contradictory fire-vs-suppress resolved deterministically (fire
  // wins; suppress entry for the fired skill is dropped). 15 router
  // unit tests + 2 integration tests against scripts/intent-classifier.cjs
  // end-to-end.
  path.join(REPO_ROOT, 'lib', 'memory', 'skill-activation-router.test.cjs'),
  // Phase 91-04: offer-presenter (lib/core/offer-presenter.cjs). Converts
  // navigation-engine.decide() offer_next_step into a one-line grounded
  // suggestion ("Offer: Because <reason>, try <command>.") with optional
  // RECOMMENDED marker per Canon Part 3 Section 6 (Mode A + confidence
  // >= 0.7 + verb match -- evaluated by the engine, respected here).
  // Noise gates: max 1 offer per turn (one_offer_per_turn), suppress
  // after 2 consecutive ignores (consecutive_ignores_threshold), grounding
  // rule rejects empty/short/generic reasons (ungrounded_reason /
  // generic_reason). Outcomes persist atomically to .mindrian/offer-
  // history.json (Canon Part 4: every choice is graph data; LOCAL-only
  // per Canon Part 8). 15 presenter unit tests + 2 integration tests
  // through scripts/intent-classifier.cjs (engine offer rendered;
  // ignore-loop reclassifies prior 'shown' to 'ignored' on next turn).
  path.join(REPO_ROOT, 'lib', 'memory', 'offer-presenter.test.cjs'),
  // Phase 91-05: /mos:explain-decision command (commands/explain-decision.md
  // + scripts/explain-decision-command.cjs). User-facing audit surface for
  // the Navigation Engine. Reads .mindrian/decision-traces/<session>.json
  // (written by Plan 91-02) and renders human-readable trace output --
  // header + body covering all 8 Section 8 brain_md_* fields plus all 5
  // structural trace fields plus chosen_rationale. Default renders last
  // 1 trace; --last N renders the N most recent (clamped to available);
  // --session SESSIONID overrides default resolution. Default resolution
  // chain: CLAUDE_SESSION_ID env -> .mindrian/current-session.json
  // pointer -> most-recent trace file by mtime. Graceful fallbacks:
  // absent file -> "No decisions recorded" advisory; malformed file ->
  // "could not be parsed" advisory; both exit 0 so the command never
  // throws on a fresh room. De Stijl glyph classifier maps tier_mode +
  // weight_applied to check/warn/low. Canon Part 8 LOCAL-only: zero
  // network surface (Test 11 source-scan parity with Plans 91-02 + 91-04).
  path.join(REPO_ROOT, 'lib', 'memory', 'explain-decision-command.test.cjs'),
  // Phase 94-09: /mos:explain-decision Action Footer (scripts/explain-
  // decision-command.cjs renderTrace + empty-path emitter). Per QA
  // handoff Section 3 FIX-8: pre-94-09 the rendered output ended with
  // `---` separator and no Next: footer, violating the skills/ui-system/
  // SKILL.md 4-zone Action Footer rule (Section 1 Zone 4 "NEVER omitted").
  // 4 fixture tests: T1 last 5 lines contain literal 'Next:'; T2 footer
  // contains at least 2 /mos: command refs (status / act / suggest-next
  // per QA handoff verbatim suggestion); T3 non-regression -- the 9
  // existing renderTrace markers (Tier Mode / BRAIN.md signal / Five-
  // Signal Triangulation / Chosen rationale + closing `---` separator)
  // are preserved before the footer; T4 graceful empty path -- the
  // footer renders even when traces array is empty, so the user always
  // gets a navigable next step. Canon Part 7 (Reuse Before Build):
  // extends existing renderTrace + empty-path emitter with a tail
  // append; no new module. Canon Part 3 (Tri-Context Decision Gate):
  // footer offers verbs from the canonical 10-verb vocabulary
  // (status -> Synthesize, act -> Run Methodology, suggest-next ->
  // Free-Text / Spawn Sub-Agent); no new verbs introduced.
  path.join(REPO_ROOT, 'lib', 'memory', 'explain-decision-footer.test.cjs'),
  // Phase 91-07: problem-type-router (lib/core/problem-type-router.cjs).
  // Parses BRAIN.md problemtype_classification + wicked_indicators bodies
  // and returns 4-type routing recommendations (UDP / IDP / WDP /
  // unknown) per locked decision D-08. Wicked escalation per Canon
  // Appendix E rule R4 (wicked_score >= 8 -> soft-systems family).
  // 24 fixture tests: parser (1-5), 4-type routing tables + verb
  // traceability (6-10, 16-18), wicked detection + override (11-15),
  // decide() integration (19-21), brain-client.isAvailable() upgrade
  // from hard-coded false (Plan 91-02) to real scalar lookup (22-24).
  // Canon Part 8 Section 9.3: only isAvailable allowed; query/search/
  // smartSearch FORBIDDEN.
  path.join(REPO_ROOT, 'lib', 'memory', 'problem-type-router.test.cjs'),
  // Phase 91-08: framework-chain-composer (lib/core/framework-chain-
  // composer.cjs). Parses BRAIN.md framework_chain_predictions section
  // body (FEEDS_INTO edges authored by Phase 90-01 deriveSection),
  // detects when the user just completed framework A (via reasoning
  // governing_thought primary; mtime fallback), and proposes framework
  // B as engine.offer_next_step with command = /mos:<slug>. Confidence
  // gate: < 0.5 -> null (noise floor); >= 0.7 -> recommended_eligible
  // flag set so offer-presenter can render RECOMMENDED marker per Plan
  // 91-04 + Canon Part 3 Section 6. User override (turn 2 invokes
  // different /mos: command) recorded as REJECTED chain suggestion in
  // decision_trace + offer-history outcome=ignored (Canon Part 4: every
  // choice is graph data). Canon Part 8: composer reads only LOCAL
  // BRAIN.md body via readQuadruple.brain.sections; never queries Brain
  // at engine time. 18 fixture tests: 15 pure-module (parser + completion
  // detection + proposal + grounding + RECOMMENDED eligibility + tie-
  // breaking) + 3 decide() integration (chain offer rendered, recommended
  // eligibility surfaced, user override recorded).
  path.join(REPO_ROOT, 'lib', 'memory', 'framework-chain-composer.test.cjs'),
  // Phase 91-06: Larry dial (lib/core/nav-dial.cjs pure resolver +
  // formatter; scripts/context-monitor integration). Statusline navigation
  // indicator that renders three positions (Investigate | Blend | Insight)
  // with the active position highlighted per Navigation Engine decision.
  // 17 fixture tests: 12 pure-module (resolveDialPosition mapping across
  // tier_0 / mode_b / mode_a weight bands, insight rationale detection,
  // null + malformed graceful default, formatDialSegment Larry: prefix +
  // 3-label render + < 60-char visible byte-budget, classifyHealth
  // byte-identity with Plan 88.1-04 thresholds, sub-2ms warm-path perf)
  // + 5 integration / canon audit (context-monitor renders dial when
  // trace exists, context-monitor pre-91 byte-stable when no trace,
  // spawned context-monitor wall-clock under cold-path budget, BSL 1.1
  // header in nav-dial.cjs, Canon Part 8 source scan -- zero brain-client
  // / fetch / curl / https references in dial source).
  path.join(REPO_ROOT, 'lib', 'memory', 'nav-dial.test.cjs'),
  // Phase 91-09: navigation-invariants validator (lib/memory/validators/
  // navigation-invariants.cjs). Drop-in registry-compatible validator for
  // the Phase 88-13 Feynman-MINTO guardian. Converts five silent Phase 91
  // failure modes into first-class health signals at session-start /
  // on-stop / pre-commit:
  //   INV-1 trace_missing_field        any of 8 Section 8 brain_md_*
  //                                    fields absent from a persisted
  //                                    decision_trace -> error.
  //   INV-2 recommended_in_wrong_mode  RECOMMENDED rendered in mode_b
  //                                    or tier_0 (Canon Part 3 Section 6
  //                                    requires mode_a) -> error.
  //   INV-3 weight_clamp_breach        brain_md_weight_applied outside
  //                                    [0.0, 1.0] -> error.
  //   INV-4 trace_file_malformed       decision-traces/*.json that fails
  //                                    JSON.parse -> error; sibling files
  //                                    continue to be scanned.
  //   INV-5 unknown_verb_passed        fire_skill not in CANONICAL_VERBS
  //                                    (Canon Part 3 frozen 10-verb
  //                                    vocabulary) -> warning. Graceful
  //                                    when shared module unavailable.
  // 16 tests: validator shape contract, severity_map coverage, INV-1..
  // INV-5 positive + negative paths, session_file_absent info, registry
  // integration via guardian on-stop + GUARDIAN_VALIDATORS_DIR, fail-open
  // inheritance from Phase 88-13 (malformed sibling does NOT prevent
  // navigation-invariants), Canon Part 8 source scan (zero network
  // surface; brain-client / fetch / smartSearch all forbidden), BSL 1.1
  // header. scope='room' per Phase 88-13 scope-mode dispatch (navigation
  // is cross-section). Zero guardian.cjs edits required (extensibility
  // promise of the Phase 88-13 registry contract is honored).
  path.join(REPO_ROOT, 'lib', 'memory', 'navigation-invariants.test.cjs'),
  // Phase 94-01: statusline active-room read contract. lib/core/folder-
  // memory.cjs getCurrentRoom() reads STATE.md frontmatter current_room
  // field; scripts/context-monitor consumes it as the canonical source so
  // /mos:rooms switches propagate to the bottom-of-screen indicator on
  // the next prompt cycle (Lawrence reproducer fence). 8 fixture tests:
  // missing STATE.md null path, STATE.md without frontmatter null path,
  // frontmatter without current_room null path, happy-path triple shape,
  // malformed YAML graceful null path, no-caching switch reproducer,
  // quote / whitespace stripping across 5 variants, end-to-end context-
  // monitor stdout substring contains the switched-room slug. Canon
  // Part 7 (reuse readQuadruple's frontmatter parser; no new YAML lib).
  // Canon Part 4 (statusline is read-only derived view; STATE.md
  // frontmatter remains canonical write surface).
  path.join(REPO_ROOT, 'lib', 'memory', 'statusline-active-room.test.cjs'),
  // Phase 94-02: rs-discovery-engine thesis-merge handoff fence. Producer
  // scripts/rs-discovery-engine.cjs Phase 4 Synthesis loop folds theses[i]
  // into breakthroughs[i] before writerPayload selection (success branch),
  // and the empty-fallback envelope carries thesis: 'no_thesis' sentinel
  // (deviation from plan locked-decision object stub; consumer
  // validateRequiredFields requires non-empty string per rs-sqlite-mirror
  // line 121-130). 3 fixture tests: success-path merge, empty-path stub,
  // E2E tier 0 sqlite row write. Canon Part 7 (compose existing
  // thesisGenerator output without touching consumer schema authority).
  // Canon Part 4 (RSDiscovery write surface unblocked).
  path.join(REPO_ROOT, 'lib', 'memory', 'rs-discovery-engine.test.cjs'),
  // Phase 94-03: canonical Brain MCP server-name resolution fence. v1.11.0
  // QA found Brain unreachable from /mos:* commands because plugin command
  // frontmatter declared 3 inconsistent server-name prefixes (mcp__neo4j-
  // brain__, mcp__mindrian-brain__, mcp__pinecone-brain__) while .mcp.json
  // declared only `mindrian-os`. Plan 94-03 selects QA Option A: standardize
  // on `mindrian-brain` across all 10 affected commands + document the
  // user-side .mcp.json snippet in docs/install/BRAIN-SETUP.md. 5 fixture
  // tests: T1 every brain reference in allowed-tools uses canonical
  // prefix, T2 zero mcp__neo4j-brain__ references remain, T3 zero
  // mcp__pinecone-brain__ references remain, T4 BRAIN-SETUP.md exists
  // with mindrian-brain + mcpServers substrings, T5 frontmatter-schema-
  // validator runnable smoke. Canon Part 7 (cheapest sweep; no alias
  // system, no auto-detect). Canon Part 8 (Brain query chokepoint
  // unchanged; only the resolved server name standardizes).
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-server-resolution.test.cjs'),
  // Phase 94-04: mcp-server-brain dependency + drift fence. v1.11.0 P0
  // ship-blocker: bundled mcp-server-brain/ cannot start because npm
  // install never runs in that subdirectory and required env vars
  // (SUPABASE_URL, MINDRIAN_BRAIN_KEY, etc.) are silently absent. Plan
  // 94-04 ships three layers of safety: T1 install.sh post-install hook
  // (cd mcp-server-brain && npm install) wrapped in package.json
  // existence guard for Tier 0 graceful skip; T2 .env.brain.template
  // lists all 7 required env vars (SUPABASE_URL / SUPABASE_KEY /
  // MINDRIAN_BRAIN_KEY / NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD /
  // PINECONE_API_KEY) one per line with comments; T3 scripts/session-
  // start emits a yellow WARN line when MINDRIAN_BRAIN_KEY is set but
  // canonical 'mindrian-brain' is absent from .mcp.json (this repo) OR
  // the user's personal .mcp.json (loud yellow signal beats silent
  // tier_0 fallback); T4 docs/install/BRAIN-SETUP.md gains a
  // 'Bundled mcp-server-brain (optional/legacy)' section noting that
  // v1.11.2 deprecates the bundled server in favor of users pointing
  // 'mindrian-brain' at their own Neo4j MCP (Plan 94-03 Option A).
  // Canon Part 7 (extends existing chokepoints install.sh + session-
  // start; no new orchestration). Canon Part 8 (drift check is LOCAL-
  // only: env var existence + .mcp.json file inspection; zero network
  // surface added).
  path.join(REPO_ROOT, 'lib', 'memory', 'mcp-server-brain-deps.test.cjs'),
  // Phase 94-05: mcp-stack fallback chain fixture suite. v1.11.0 P0
  // architectural ship-blocker: per the user-approved plan amendment
  // (commit 66a1a34), rs-fetcher-industry is the TRUE Tavily-only gap
  // (one source, TAVILY_API_KEY required). T1 industry happy paid path
  // (opts.tavily injection seam returns paid envelope); T2 native
  // fallback (no key, opts.webSearch returns native envelope); T3
  // cache fallback (no key, no webSearch, opts.cacheReader returns
  // cache envelope); T4 all-tiers-down empty results, never throws;
  // T5 envelope shape uniformity across academic + patents + experts
  // with backward-compat domain keys (papers / patents / experts)
  // preserved alongside results; T6 lib/core/section-8-trace-schema.cjs
  // exports web_research_tier per Phase 91 forward-additive invariant;
  // T7 commands/research.md body removes the "Requires Brain MCP"
  // hard-stop and "Then stop." directive that blocks fresh installs.
  // Canon Part 4 (tier transitions become graph data via web_research_
  // tier edge); Part 7 (extends Phase 89.2 fetchers with envelope
  // wrap; reuses Anthropic native WebSearch + WebFetch instead of
  // building a new client); Part 8 (WebSearch + WebFetch are public-
  // domain SIGNAL queries; existing brain-client chokepoint untouched;
  // no new Brain endpoints).
  path.join(REPO_ROOT, 'lib', 'memory', 'mcp-stack-fallback.test.cjs'),
  // Phase 94-06: room classifier strict-mode fence. Lawrence Aronhime's
  // 2026-04-28 38-min live test with 2 rooms loaded
  // (core-power-isolation + curriculum-redesign-fall-2026) had four
  // utterances resolve to the WRONG room because the classifier ran a
  // similarity heuristic only and core-power-isolation had high token
  // overlap with everything. Plan 94-06 inserts a strict-mode override
  // at the top of the room-resolution path: numeric ('8', 'switch to 2')
  // -> registry position; explicit slug ('curriculum-redesign-fall-2026',
  // '/mos:rooms <slug>') -> exact slug match; quoted exact name
  // ('"Beta"', '"Curriculum Redesign Fall 2026"') -> name OR slug exact.
  // Each match emits a Section-8 trace edge `routing_source: 'strict_mode'`
  // per Canon Part 4. 6 fixture tests: T1 numeric, T2 explicit slug,
  // T3 quoted name, T4 routing_source assertion + STRICT_MODE_ROUTING_
  // SOURCE constant export, T5 fallthrough regression fence (no strict-
  // mode pattern -> null, similarity heuristic unchanged), T6 Lawrence
  // reproducer (3 strict + 1 known-deferred to v1.11.3 for natural-
  // language 'the curriculum room'). Canon Part 3 (10-verb vocabulary
  // preserved; strict-mode is a routing override, not a new verb).
  // Canon Part 4 (override emits graph edge). Canon Part 7 (extends
  // existing scripts/intent-classifier.cjs without introducing a new
  // classifier file).
  path.join(REPO_ROOT, 'lib', 'memory', 'room-classifier-strict-mode.test.cjs'),
  // Phase 94.1-01: /mos:heal command orchestrator fence. The /mos:heal
  // command wraps the 10-step room wiring heal recipe dog-fooded on the
  // mindrianOS room on 2026-04-29 (recipe at ~/MindrianRooms/mindrianOS/
  // methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md). This
  // fixture is the v1.11.1 GA closing artifact: any user upgrading from
  // v1.10.x to v1.11.x can self-heal their room without manual
  // intervention. 6 fixture tests: T1 dry-run on degraded fixture
  // (10-step plan, zero mutation), T2 full heal post-conformance
  // (8 canonical sections + every section ROOM.md + STATE.md +
  // .mindrian/room.db nodes COUNT > 0 + root STATE.md regenerated +
  // backup populated), T3 heal-log envelope shape (one entry per step;
  // 10 keys per entry; summary present), T4 backup created (timestamp
  // YYYYMMDD-HHMMSS pattern + pre-heal STATE.md verbatim), T5
  // mega-section graceful degradation (FEYNMINTO-01 budget rejection
  // logged not thrown; tier-0 fallback + continue), T6 idempotence
  // (heal twice; second run zero error_* statuses). Canon Part 7
  // (Reuse Before Build): wraps existing scripts/migrate-lazygraph.cjs
  // + scripts/vault-section-state-generator.cjs + scripts/vault-section-
  // minto-generator.cjs + scripts/compute-state without net-new
  // methodology. Canon Part 4 (Every Choice Is Graph Data): heal-log.json
  // captures the full cascade. Canon Part 8 (Graph Boundary): heal is
  // LOCAL-only; brain-derivation-queue is read but NEVER drained inside
  // heal (drain deferred to v1.12 candidate plan).
  path.join(REPO_ROOT, 'lib', 'memory', 'heal-command.test.cjs'),
  // Phase 99-01: conversation operator state machine (lib/conversation/
  // operator.cjs). Foundational deliverable for Phase 99 conversation
  // operator state machine + downstream consumers (Phase 100 JTBD
  // classifier, Phase 102 renderer, Phase 95.1 polling, Sprites
  // Workspace v2.0). 12 scenarios covering the validation architecture
  // dimensions from 99-RESEARCH.md: cold-start default (D-04), resume
  // from disk (D-05/D-06), schema_version-first ordering (D-06), valid
  // transitions (D-08), invalid-transition rejection without partial
  // write (D-09), DECISION_GATE -> previous (D-08), history bounded at
  // 50 with drop-oldest (D-26), atomic write rollback when rename
  // throws (D-07), frame budget getCurrent < 2ms / transition < 10ms
  // (D-23/D-24), Canon Part 8 grep audit on operator.cjs source
  // (D-22), OPERATOR_TRANSITION edge graceful skip when graph absent,
  // and OPERATOR_TRANSITION edge written when graph exists with
  // properties.trigger + timestamp + methodology (Canon Part 4 + D-21).
  // Self-contained: copies fixtures from test/fixtures/conversation-
  // operator/ to os.tmpdir() so committed fixtures are never mutated.
  // Zero new runtime dependencies (Phase 87 invariant).
  path.join(REPO_ROOT, 'tests', 'test-operator-state.cjs'),
  // Phase 102-01: renderer contract regression fence. 12 IIFE
  // assertions covering the 5-operator round-trip via the v2
  // destructured API (JUST_TALK is the explicit suppress case via
  // operator gate; the other 4 compose normally), undefined / null
  // operator do not crash, unknown operator strings are tolerated
  // (Phase 102 deliberately drops the 99-03 throw so upstream callers
  // can route arbitrary strings without try/catch wrappers), envelope
  // shape stable (exactly 2 keys: rendered + contract; no _stub leak),
  // mode passthrough (A / B / tier-0 + arbitrary unchanged), tier
  // passthrough (0 / 1 / 2 / 3 + arbitrary unchanged), and OPERATORS
  // export frozen + equals 5 canonical names. Replaces the Phase 99-03
  // stub fence at the same registration slot; Plan 102-01 evolves the
  // renderer signature from positional 4-arg to a destructured single-
  // arg API per CONTEXT D-10 and RESEARCH §2.
  path.join(REPO_ROOT, 'lib', 'render', 'render-v2.test.cjs'),
  // Phase 99-05: /mos:operator command. Tests show/history/set/reset
  // subcommands, --json paths, Tier 0 fallback, UI Ruling System self-
  // compliance (12-glyph + 5-color + 4-zone + Shape E + Shape F.1 + Shape
  // F.4), Canon Part 8 audit (zero Brain queries), frame budget (50
  // invocations < 500ms mean), and commands/operator.md frontmatter scan.
  // Depends on Phase 99-01 lib/conversation/operator.cjs at runtime;
  // integration tests skip-as-fail until 99-01 lands in the merged tree.
  path.join(REPO_ROOT, 'tests', 'test-operator-command.cjs'),
  // Phase 99-02: heuristic NL classifier for the conversation operator state
  // machine. Five gates: T1 corpus accuracy >= 80% on the 50-message hand-
  // labeled fixture under test/fixtures/conversation-operator/classifier-
  // corpus.json (D-25); T2 frame budget mean < 8ms on a 200-char benchmark
  // (D-23 corollary, 5ms target with CI headroom); T3 tier-0 fallback when
  // classifier-rules.json is missing (Decision #8 -- spawn fresh node child
  // because module cache hides reload); T4 validate-cross-check between
  // classifier candidate_op + suggested_trigger and operator.cjs validate()
  // (every classifier output is operationally consistent with the state
  // machine); T5 boundary conditions (empty input, /mos:operator and
  // /mos:status target_op:null markers, /mos:room beats general /mos:
  // METHODOLOGY due to JSON-array ordering, AskUserQuestion -> DECISION_GATE
  // 1.0, EXPLORE_CAPTURE + "let's file this" -> BUILD_ROOM per D-08, null
  // input -> tier-0). Canon Part 8 (LOCAL only): zero Brain queries, zero
  // external requires, pure local string matching. Canon Part 7 (Reuse
  // Before Build): externalized lexicon JSON tunable without code edits.
  path.join(REPO_ROOT, 'tests', 'test-operator-classifier.cjs'),
  // Phase 99-04: operator-aware hooks integration. 12 scenarios covering
  // SessionStart resume hint when state.current === 'BUILD_ROOM' AND
  // state.context.active_section is set (D-18); UserPromptSubmit
  // classifier-driven transitions per D-11/D-12 (heuristic threshold 0.6);
  // PostToolUse AskUserQuestion -> DECISION_GATE with decision_gate_pending
  // set (D-20); active-room guard mirroring Phase 95 cascade-side-channel
  // pattern (D-22 + Decision #15); sealed-room invariant (Phase 84-07 /
  // Decision #15); envelope schema strict per Phase 95 BASH-95-01
  // (top-level allowlist; additionalContext only inside hookSpecificOutput);
  // frame budget < 250ms mean per spawnSync invocation (50ms script + spawn
  // cost); hook never blocks on malformed stdin / missing hook_event_name /
  // missing registry / throwing classifier (defensive catch-all). Canon
  // Part 8: zero Brain queries. Self-contained: each test creates its own
  // tmp dir and tears it down via fs.rmSync in finally. Zero new runtime
  // dependencies (Phase 87 invariant).
  path.join(REPO_ROOT, 'tests', 'test-operator-hooks.cjs'),
  // Phase 100-03: per-room JTBD state I/O at .mindrian/jtbd-state.json.
  // 9 assertion classes covering round-trip identity, atomic tmp+rename
  // (no orphans across many writes), history bounded at 50 with FIFO
  // drop-oldest, 24h staleness rule (entered_at + expires_at branches),
  // manual override expires_at = entered_at + 24h, manual block on auto
  // write (auto_blocked_by_manual history row, current unchanged), per-
  // room isolation (two tmpdirs, zero cross-leakage on jtbd + history +
  // path), graceful errors (missing dir + corrupt JSON + bad opts return
  // null/no-op without throw), and Canon Part 8 source audit (zero
  // forbidden tokens in lib/hmi/jtbd-state.cjs). Self-contained: every
  // test makes a fresh tmp room and tears it down in finally. Zero new
  // runtime dependencies (Phase 87 invariant).
  path.join(REPO_ROOT, 'tests', 'test-jtbd-state-io.cjs'),
  // Phase 100-01: JTBD taxonomy schema validation. 13 canonical entries
  // (12 first-class + explore fallback), each with detector + verb table
  // per RESEARCH §2.
  path.join(REPO_ROOT, 'tests', 'test-jtbd-taxonomy.cjs'),
  // Phase 100-02: heuristic JTBD classifier (no LLM). Three weighted strata
  // (token cues 0.5, operator affinity 0.3, recency 0.2). Confidence
  // threshold 0.6 mirrors Phase 99 classifier. Frame budget < 5ms.
  path.join(REPO_ROOT, 'tests', 'test-jtbd-classifier.cjs'),
  // Phase 100-04 (wave 2 stub): /mos:jtbd command. Filled when 100-04 ships.
  path.join(REPO_ROOT, 'tests', 'test-jtbd-command.cjs'),
  // Phase 103-04: /mos:memory command (HMI-103-03). 12 assertion classes
  // covering 6 subcommands (overview / query / cross-room / resume / park /
  // complete) + opt-out gate + Cowork warning + 95.1 UI compliance + Zone 1
  // header pattern. Hermetic via MINDRIAN_ROOMS_HOME tmp root + Brain stub
  // injected via cross-room-memory __setBrainClient seam. Tests Mode A/B
  // tier-awareness + Phase 101 graceful fallback (Shape G -> Shape E note,
  // Shape F.6 -> F.1 fallback).
  path.join(REPO_ROOT, 'tests', 'test-memory-command.cjs'),
  // Phase 100-04 (wave 2 stub): UI Ruling System self-compliance. Filled when 100-04 ships.
  path.join(REPO_ROOT, 'tests', 'test-jtbd-ui-self-compliant.cjs'),
  // Phase 100-05 (wave 2 stub): hook integration. Filled when 100-05 ships.
  path.join(REPO_ROOT, 'tests', 'test-jtbd-hook-integration.cjs'),
  // Phase 101-01: Shape F.6 (JTBD-aware Next Move) renderer. JTBD signal
  // selects which verbs render; F.1's keyboard layer is reused. 7-assertion
  // IIFE harness covers happy path, fallthrough (jtbd null/unknown/<3 verbs),
  // taxonomy missing graceful, and 12-glyph audit.
  path.join(REPO_ROOT, 'tests', 'test-shape-f6.cjs'),
  // Phase 101-02: Shape G (Comparison Matrix) renderer. Render-only in v1;
  // interactive table picking deferred to v1.15.x. 7-assertion suite covers
  // valid_matrix, degenerate_fallthrough, cell_clamping, criterion_clamping,
  // glyph_audit, zone4_present, zone1_dimensions.
  path.join(REPO_ROOT, 'tests', 'test-shape-g.cjs'),
  // Phase 101-03: Shape H (Timeline / Roadmap) renderer. Horizontal time
  // axis + ■ milestone markers + label rows. ASCII-art only, 12-glyph
  // compliance, Canon Part 3 Rule 2 error envelope on empty/reversed dates.
  path.join(REPO_ROOT, 'tests', 'test-shape-h.cjs'),
  // Phase 101-04: selector-dispatcher single integration point. Discriminates
  // F.6 returns ({ zones, contract } | { fallthrough } | { error }) and routes
  // fallthroughs to F.1 fallback. 9 assertions cover happy paths, fallthroughs,
  // pass-through shapes, malformed payload no-throw, and Free-Text defense.
  path.join(REPO_ROOT, 'tests', 'test-selector-dispatcher.cjs'),
  // Phase 101-05: Mode A/B/Tier 0 graceful degradation across F.6 + G + H.
  // Mode A renders RECOMMENDED markers (Brain reachable, confidence >= 0.7);
  // Mode B suppresses markers + renders "Brain unreachable" warning; Tier 0
  // renders hardcoded minimal option set.
  path.join(REPO_ROOT, 'tests', 'test-shape-f6-mode-b.cjs'),
  // Phase 88.2 Wave-0: 6 selector-block stubs (5 sub-shapes F.1-F.5 +
  // telemetry). Filled by 88.2-01..03 plans which replace stubs with real
  // bodies WITHOUT changing registered paths below.
  path.join(REPO_ROOT, 'tests', 'test-shape-f1.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-shape-f2.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-shape-f3.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-shape-f4.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-shape-f5.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-selector-telemetry.cjs'),
  // Phase 88.2-04: operator-aware dispatcher integration. F.1..F.5 sub-shape
  // dispatch + JUST_TALK refuse (render_v2_compaction_violation) + telemetry
  // emission opt-in (Canon Part 8 fs_scope guard) + AskUserQuestion structural-
  // marker trailer. 19 assertions; sits beside Phase 101-04's 9-test contract.
  path.join(REPO_ROOT, 'tests', 'test-selector-dispatcher-88-2-04.cjs'),
  // Phase 88.2-00 Wave-0: telemetry dual-surface stub. Plan 88.2-03 populates with
  // real assertions (JSONL primary + memory_event mirror via 4 new EVENT_TYPES).
  path.join(REPO_ROOT, 'tests', 'test-selector-telemetry-dual-surface.cjs'),
  // Phase 88.2-05: F.0 Mini Decision Gate renderer + REJECTED_BECAUSE edge contract.
  // 16 node:test assertions covering 3-verb closed-vocab, persona-AGNOSTIC,
  // border_style:'single', parent_decision_id pass-through, and graceful-fail
  // edge helper writing eventType 'selector_rejection_captured' via Phase 109.
  path.join(REPO_ROOT, 'tests', 'test-shape-f0.cjs'),
  // Phase 88.2-05: dispatcher F.0 integration. F_SUBSHAPES extended with 'F.0';
  // dispatch case routes to renderShapeF0; JUST_TALK refuse inheritance verified;
  // closed-vocab carve-out preserved; AskUserQuestion trailer attached.
  path.join(REPO_ROOT, 'tests', 'test-selector-dispatcher-88-2-05.cjs'),
  // Phase 88.2-06: decoy-tier dispatcher (Tier 0/1/2 + 5 perturbation axes
  // round-robin + topic-coverage backstop + decoy_opt_out preference) plus
  // F.6 Plan Review Round renderer at the collision-safe path
  // lib/hmi/shape-f6-plan-review-renderer.cjs (R1 invariant -- Phase 101-01
  // shape-f6-renderer.cjs sha256 byte-equal pre/post). Dispatcher F_SUBSHAPES
  // extended with 'F.6'; explicit requestedShape:'F.6' routes to the new
  // plan-review renderer; umbrella 'F' branch unchanged.
  path.join(REPO_ROOT, 'tests', 'test-decoy-tier.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-shape-f6-plan-review.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-selector-dispatcher-88-2-06.cjs'),
  // Phase 104 Wave-0: 3 per-command JTBD declaration stubs. Filled by
  // plans 104-02 (declarations + coverage) + 104-03 (backward-compat fence).
  path.join(REPO_ROOT, 'tests', 'test-command-jtbd-declarations.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-command-jtbd-coverage.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-command-jtbd-backward-compat.cjs'),
  // Phase 102-00 Wave-0: 5 render-v2 contract stubs. Plan 102-01 swaps in
  // the assertion bodies WITHOUT changing the registered paths below.
  // Mapping to RENDER-102-* requirement IDs:
  //   test-render-v2-signature.cjs     -> RENDER-102-01 import surface
  //   test-render-v2-compaction.cjs    -> RENDER-102-02 operator-aware compaction
  //   test-render-v2-jtbd-zone4.cjs    -> RENDER-102-03 JTBD-aware Zone 4
  //   test-render-v2-provenance.cjs    -> RENDER-102-04 _provenance envelope
  //   test-render-v2-color-overlay.cjs -> RENDER-102-05 5-color overlay
  // Phase 99-03 import surface (lib/render/render-v2.test.cjs above) remains
  // the byte-stability fence per RENDER-102-06.
  path.join(REPO_ROOT, 'tests', 'test-render-v2-signature.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-render-v2-compaction.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-render-v2-jtbd-zone4.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-render-v2-provenance.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-render-v2-color-overlay.cjs'),
  // Phase 121.5-04 Sub-plan E: render-v2 disposition CI gate. Asserts the
  // audit verdict HOLDS, the allowlist matches the canonical agent-surface
  // set, ROOM.md uses "current" linguistic discipline, and the Phase 102
  // VALIDATION/VERIFICATION pair has closed (out of draft + record exists).
  // Pairs with the operator-facing audit at scripts/disposition-render-v2.cjs.
  path.join(REPO_ROOT, 'lib', 'memory', 'render-v2-disposition.test.cjs'),
  // Phase 103 - Memory Continuity Layer (within-session + across-session + cross-room)
  path.join(REPO_ROOT, 'tests', 'test-across-session-memory.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-cross-room-memory.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-cross-room-memory-schema-leak.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-memory-command.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-memory-hook-integration.cjs'),
  // Phase 105 - HMI Compliance Polling
  path.join(REPO_ROOT, 'tests', 'test-hmi-poll-primitive.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-hmi-status-command.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-hmi-poll-hook.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-hmi-compliance-e2e.cjs'),
  // Phase 106-00: Wave 0 statusline visibility test stubs (10 stubs).
  // Each stub exits 0 with the canonical Wave 0 message; downstream plans
  // (106-01..106-05) replace stubs with real tests as their owning plan
  // lands. Registry membership ensures the full suite always sees Phase 106
  // tests from Wave 0 onward.
  path.join(REPO_ROOT, 'tests', 'test-stale-settings-migration.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-context-monitor-d02-broadcast.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-statusline-glyph-isolation.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-g.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-g-fix.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-statusline-banner-suppression.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-fallback-echo-compose.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-fallback-echo-30day.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-onboarding-gate.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-surface-detect.cjs'),
  // Phase 108-00: Wave 0 graph-memory-schema-reconciliation test stubs (7 stubs).
  // Each stub exits 0 with the canonical Wave 0 message; downstream plans
  // (108-01..108-06) replace stubs with real tests as their owning plan
  // lands. test-part-9-invariant.cjs is a CROSS-PHASE dependency - remains
  // a stub through all of Phase 108; lights up only after Phase 109 ships
  // the nodes.review_status column. Registry membership ensures the full
  // suite always sees Phase 108 tests from Wave 0 onward. Mapping:
  //   test-reconciliation-table-completeness.cjs -> 108-01 (D-01 nodes + edges)
  //   test-provenance-contract-schema.cjs        -> 108-02 (D-02 contract)
  //   test-truth-state-taxonomy.cjs              -> 108-03 (D-03 8 states)
  //   test-aliases-yaml-schema.cjs               -> 108-04 (D-04 YAML)
  //   test-precommit-hook-aliases.cjs            -> 108-05 (D-05 hook)
  //   test-canon-crossref-completeness.cjs       -> 108-06 (D-06 cross-refs)
  //   test-part-9-invariant.cjs                  -> 108-09 (Phase 109 dep)
  path.join(REPO_ROOT, 'tests', 'test-reconciliation-table-completeness.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-provenance-contract-schema.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-truth-state-taxonomy.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-aliases-yaml-schema.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-precommit-hook-aliases.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-canon-crossref-completeness.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-part-9-invariant.cjs'),
  // Phase 109-01 regression: the nodes-provenance migration drops + recreates
  // every view/trigger that references `nodes` around the table rebuild. Seeds
  // a room.db with an rs_discoveries-style view (+ a second view + a trigger),
  // runs the migration, asserts no throw + views/trigger still work + idempotent
  // re-run. Guards against the phase-109-migration-view-drop-collision bug
  // (migration used to crash openRoomDb for any room.db carrying the Phase-89
  // rs_discoveries view: "error in view rs_discoveries: no such table: main.nodes").
  path.join(REPO_ROOT, 'tests', 'test-navigation-migration-views.cjs'),
  // Phase 109 SQL Context-Memory Navigation Spine: the 15 test suites that the
  // Plan 109-00 Task 4 registration originally specified but that a later refactor
  // dropped from this array before main HEAD (the originals ran via direct
  // `node tests/test-*.cjs` and `bash tests/run-all.sh` throughout the phase).
  // Re-registered by Plan 109-12 (bookkeeping reconciliation). Mapping:
  //   test-navigation-acceptance.cjs                          -> 109-10 (NAV-109-09 load-bearing acceptance gate; zero non-SQLite reads)
  //   test-navigation-focus.cjs                               -> 109-02 (NAV-109-01 session_focus + auto-focus cascade)
  //   test-navigation-neighborhood.cjs                        -> 109-04 (NAV-109-02 recursive-CTE ranking correctness)
  //   test-navigation-perf-10k.cjs                            -> 109-04 (NAV-109-02 perf: cold p95 <200ms / warm <50ms)
  //   test-navigation-memory-events.cjs                       -> 109-03 (NAV-109-03 closed-15 event enum + findRecentChanges)
  //   test-navigation-insights.cjs                            -> 109-05 (NAV-109-04 7 insight primitives + templated explanations)
  //   test-navigation-chokepoint-hook.cjs                     -> 109-06 (NAV-109-05 no direct room-db.cjs imports outside allow-list)
  //   test-navigation-packet-builder.cjs                      -> 109-07 (NAV-109-06 buildBrainPacket shape per D-06)
  //   test-navigation-packet-part8-leak.cjs                   -> 109-07 (NAV-109-06 Part 8 JSON.stringify leak tripwires)
  //   test-brain-ingestion-part-9-invariant.cjs               -> 109-08 (NAV-109-07 storeBrainSuggestions proposed-only + invariant SQL = 0)
  //   test-room-home-vs-brain-derivation-regression.cjs       -> 109-09 (NAV-109-08 getRoomHomeView + Phase 90 deriveSection regression fence)
  //   test-canon-part-9-ratification.cjs                      -> 109-11 (NAV-109-09 Canon Part 9 structural assertions)
  //   test-navigation-migration-idempotent.cjs                -> 109-01 (migration twice = no-op; 12-column nodes schema)
  //   test-navigation-migration-backfill.cjs                  -> 109-01 (properties JSON backfill + status_aliases mapping)
  //   test-navigation-migration-coexistence.cjs               -> 109-01 (navigation API + assumptions.validity coexist mid-migration)
  path.join(REPO_ROOT, 'tests', 'test-navigation-acceptance.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-focus.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-neighborhood.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-perf-10k.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-memory-events.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-insights.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-chokepoint-hook.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-packet-builder.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-packet-part8-leak.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-brain-ingestion-part-9-invariant.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-room-home-vs-brain-derivation-regression.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-canon-part-9-ratification.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-migration-idempotent.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-migration-backfill.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-navigation-migration-coexistence.cjs'),
  // Phase 89-07 Wave 0 (graph-native HARD RULE; ReverseSalientAgent dual-surface).
  path.join(REPO_ROOT, 'tests', 'test-reverse-salient-agent.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-reverse-salient-cascade-emit.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-reverse-salient-f0-integration.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-reverse-salient-persona.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-reverse-salient-telemetry.cjs'),
  // Phase 116-00 Wave 0 (graph-native HARD RULE; unresolved-tension-hook dual-surface
  // telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md rule 3).
  // 5 stubs RED in Wave 0; flip GREEN as 116-01 (detection), 116-02 (F.1 surface),
  // 116-03 (decay state machine), 116-04 (telemetry + release) modules land.
  path.join(REPO_ROOT, 'tests', 'test-tension-hook-detection.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-tension-hook-f1-integration.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-tension-hook-decay.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-tension-hook-telemetry.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-tension-hook-rendering.cjs'),
  // Phase 117-00 Wave 0 (graph-native HARD RULE; auto-explore-domains dual-surface
  // telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md rule 3).
  // 12 stubs RED in Wave 0; flip GREEN as 117-01 (detection), 117-02 (compose),
  // 117-03 (F.1 surface + HSI schema + BQ template), 117-04 (sanitizer + LOCAL-only routing),
  // 117-05 (telemetry + brain-canon-drift + release) modules land.
  // Section 5 Validation Architecture (6 stubs):
  path.join(REPO_ROOT, 'tests', 'test-auto-explore-event-types.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-auto-explore-fingerprint.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-explored-materials-store.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-auto-explore-fire.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-auto-explore-compose.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-auto-explore-f1-integration.cjs'),
  // Section 8 Brain Substrate enrichment (6 net-new stubs from Brain Cypher 2026-05-06):
  path.join(REPO_ROOT, 'tests', 'test-auto-explore-canonical-order.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-cross-domain-formula.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-finding-hsi-schema.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-f1-bq-template.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-detection-routing-local-only.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-brain-canon-drift-event.cjs'),
  // Phase 122-01 Wave 0 (workflow layer -- framework <-> command registry).
  // Stubs RED-of-design until their owning plan lands: command-resolver fills
  // in 122-03; command-registry fills in 122-02. Both stay at this registered
  // path; the downstream plan swaps the implementation in without moving it.
  path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'command-registry.test.cjs'),
  // Phase 157-04: the orchestration-projection generator + --check 3-mode
  // taxonomy (STALE / UN-WIRED / UN-RANKED). Mirrors the connector/command
  // -registry test registration so the Feynman runner exercises the projection
  // --check (BOG-11) on every run.
  path.join(REPO_ROOT, 'lib', 'memory', 'orchestration-projection.test.cjs'),
  // Phase 157-05: the adversarial Part 8 boundary scan over the projection +
  // generator + analogue seed + unwired-allowlist (BOG-09 / BOG-10). Proves
  // zero user-content fields by construction (field allowlist + tier sweep +
  // planted-secret forbidden-value tripwire + zero-live-Brain grep gate).
  path.join(REPO_ROOT, 'tests', 'test-orchestration-projection-part8-boundary.cjs'),
  // Phase 122-03: the chain recommender (recommendFrameworkChain via FEEDS_INTO).
  path.join(REPO_ROOT, 'lib', 'memory', 'chain-recommender.test.cjs'),
  // Phase 122-04: the navigation-hook surgical edit (framework-chain-composer
  // routed through the resolver) + the suggest-next integration test.
  path.join(REPO_ROOT, 'lib', 'memory', 'navigation-hook-resolver.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'suggest-next-workflow.test.cjs'),
  // Phase 122-05: the workflow-layer end-to-end test (frontmatter -> registry
  // --check -> resolver.composeWorkflow(acceptance example) -> the degrade case
  // -> validateChainAutonomy stop-point) + the Canon Part 8 zero-Brain-mutation
  // grep sweep.
  path.join(REPO_ROOT, 'lib', 'memory', 'workflow-layer-e2e.test.cjs'),
  // Phase 110-00: Brain Context Packet Contract Wave 0 substrate (4 stubs filled by Plans 110-01 / 110-04 / 110-05).
  //   test-brain-packet-schema-check.cjs              -> 110-01 (PACKET-110-01 + -02: the --check schema tripwire)
  //   test-brain-packet-validation-per-job.cjs        -> 110-05 (PACKET-110-03 + -04 + -07 + -08: 12-job in/out + privacy + dual-path)
  //   test-brain-packet-part8-invariant-per-job.cjs   -> 110-05 (PACKET-110-06 round-trip + D-11(d) adversarial sweep)
  //   test-brain-packet-precommit-hook.cjs            -> 110-04 (PACKET-110-05 D-08 layer-2 hook)
  path.join(REPO_ROOT, 'tests', 'test-brain-packet-schema-check.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-brain-packet-validation-per-job.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-brain-packet-part8-invariant-per-job.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-brain-packet-precommit-hook.cjs'),
  // Phase 123 (install-lifecycle-harness) block.
  //   Plan 123-01: release.sh semver bump algebra + two-commit form + dirty-repo guard + Step 9.5 rename.
  //     Tests A-E (semver assertions) GREEN immediately; Tests F/G (release.sh
  //     structural) RED until Plan 123-01 Task 2 rewrites release.sh -- intended RED->GREEN.
  //   Plan 123-02: install-state record + data/deployment-surfaces.json manifest +
  //     active-plugin-root.cjs topology classification. Tests 1+4+6 (topology /
  //     Canon Part 8 / early-write ordering) GREEN after Task 1; Tests 2+3
  //     (record write hermetic / idempotent re-run) GREEN after Task 2;
  //     Test 5 (manifest schema) GREEN after Task 3.
  //   Plan 123-03: doctor classes I (install-state + topology + 6-way version-
  //     of-record consistency) + J (deployment-surface manifest reconciliation)
  //     + aggressive --fix (legacy migration backup-verify-remove; never
  //     touches a dev-clone) + Bug-7 fix (marketplace-cache topology is
  //     HEALTHY, not drift). Tests RED until Task 2 lands class I + class J
  //     in scripts/doctor.cjs -- intended RED->GREEN.
  //   Plan 123-04: doctor --acceptance (release-gate-as-a-command) -- 5-point
  //     pre-tag checklist + 7-point full checklist + --light-npx opt-in; wired
  //     into release.sh as hard aborts (Step 6.6 pre-tag, Step 9.6 post-publish);
  //     scripts/release-beta-smoke.sh retired. Tests RED until Task 2 lands
  //     --acceptance in scripts/doctor.cjs AND Task 3 wires release.sh + deletes
  //     release-beta-smoke.sh -- intended RED->GREEN.
  //   Plan 123-05: cache-prune helper (HARNESS-123-13) + doc/test sweep
  //     (HARNESS-123-14). 6 hermetic scenarios for pruneMarketplaceCache
  //     (active + N most-recent kept; corrupt installed_plugins.json -> skip;
  //     dryRun -> no mutation; belt+suspenders active-dir protection; Canon
  //     Part 8 grep clean). Tests GREEN after Task 1 lands
  //     lib/core/cache-prune.cjs.
  //   Plan 123-07: resolve-brain-key.cjs (HARNESS-123-15) + brain-client.cjs
  //     getApiKey() delegation (HARNESS-123-16). 9 hermetic scenarios cover
  //     order (env -> ~/.mindrian.env -> CWD .env -> not-found), SEC-02
  //     POSIX 0o077 reject, Canon Part 8 zero-network grep, the brain-client
  //     delegation spy, brain-client preconditions, and the FLAG-3
  //     env-aware-home structural assertion. rbk.1-6 + rbk.9 GREEN after
  //     Task 1; rbk.7 + rbk.8 GREEN after Task 2 (brain-client rewire).
  path.join(REPO_ROOT, 'tests', 'test-release-bump-algebra.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-install-state-record.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-i.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-j.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-acceptance.cjs'),
  // Debug session doctor-class-a-drift-topology-blind-false-positive (2026-05-31):
  //   class A install-missing drift branch made topology-aware so the SessionStart
  //   preflight banner no longer false-fires on marketplace-cache installs; the
  //   legacy/dev recovery path is preserved + cross-gate (--json vs --install-state)
  //   consistency is asserted. 3 hermetic scenarios.
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-a-topology-drift.cjs'),
  // Debug session intern-w1-statusline-room-mismatch (2026-07-11): class H
  //   (install-incomplete-module.cjs check()/fix()) never received the same
  //   topology-awareness fix class A/I got above -- it false-positived
  //   'install incomplete' on every healthy marketplace-cache-only install
  //   and its --fix wrote a broken user-level statusLine override at the
  //   hardcoded legacy INSTALL_DIR. Also covers the Class G Step 3 widening
  //   (tests the EFFECTIVE resolved statusline command, not always the
  //   plugin's own file) needed so the self-heal's re-check can catch its
  //   own self-inflicted breakage. 4 hermetic scenarios, exercised via the
  //   real CLI end-to-end (post-Phase-217 registry dispatch).
  path.join(REPO_ROOT, 'tests', 'test-doctor-class-h-topology-blind.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-cache-prune.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-resolve-brain-key.cjs'),
  // Phase 124-00: FEYNMAN.md Temporal Awareness Wave 0 substrate (4 stubs filled by Plans 124-01 / 124-02 / 124-04).
  //   test-feynman-timeline-renderer.cjs              -> 124-01 (TEMPORAL-124-02 + -04 + -05 + -07: renderer unit + D-05 template + thresholds + section scoping)
  //   test-feynman-timeline-empty-state.cjs           -> 124-01 (TEMPORAL-124-04: empty-state placeholder)
  //   test-feynman-timeline-runner.cjs                -> 124-02 (TEMPORAL-124-01 + -03 + -08 + -09: sentinel-bounded merge + body byte-identical + watermark + idempotent + memory_event + EVENT_TYPES +2)
  //   test-feynman-timeline-canon-part-9-invariant.cjs -> 124-04 (TEMPORAL-124-10: forbidden-substring sweep + fs-instrument allow-list)
  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-renderer.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-empty-state.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-runner.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-feynman-timeline-canon-part-9-invariant.cjs'),
  // Phase 121.5 terminal-coherence-capstone (multi-plan; SessionStart Coordinator is Plan 00).
  //   sessionstart-coordinator.test.cjs        -> Plan 121.5-00 (D-13..D-16 coordinator + 9 injector refactor)
  // Aggregator: tests/run-all-121.5.sh. Additional 121.5-* test suites are
  // already registered above this block (palette-consistency / statusline-two-row /
  // terminal-capability / help-renderer / help-coverage); the SessionStart
  // Coordinator suite lands here per the Plan 121.5-00 Task 3 contract.
  path.join(REPO_ROOT, 'lib', 'memory', 'sessionstart-coordinator.test.cjs'),
  // Phase 125 F-Selector Ranker (8 plans: Plan 00 writeEdge through Plan 07 miss).
  //   navigation-write-edge.test.cjs          -> Plan 125-00 (writeEdge primitive)
  //   navigation-projections.test.cjs         -> Plan 125-01 (projection helpers)
  //   brain-cypher-chain-slice.test.cjs       -> Plan 125-02 (Brain Cypher slice)
  //   packet-chain-hint.test.cjs              -> Plan 125-03 (packet builder ext)
  //   packet-schema-validation.test.cjs       -> Plan 125-04 (schema superset)
  //   f-selector-ranker.test.cjs              -> Plan 125-05 + 125-07 D8 label tests (34 tests)
  //   selector-decisions.test.cjs             -> Plan 125-06 (D7 decisions + decay; 17 tests)
  //   selector-miss.test.cjs                  -> Plan 125-07 (D8 miss capture; 10 tests)
  // Aggregator: tests/run-all-125.sh.
  path.join(REPO_ROOT, 'lib', 'memory', 'navigation-write-edge.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'navigation-projections.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-cypher-chain-slice.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'packet-chain-hint.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'packet-schema-validation.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'f-selector-ranker.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'selector-decisions.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'selector-miss.test.cjs'),
  // Phase 104.1 (per-command-teaching-content) block. RED-by-design until
  // Plan 02 lands the 86 teaching strings; the jtbd-derivation suite is
  // GREEN immediately after Plan 01 Task 1.
  //   per-command-teaching.test.cjs        -> 104.1-01 Task 2 (RED today; GREEN after Plan 02)
  //   per-command-jtbd-derivation.test.cjs -> 104.1-01 Task 3 (GREEN immediately)
  // Aggregator: tests/run-all-104.1.sh. Documented at
  //   .planning/phases/104.1-per-command-teaching-content/104.1-01-PLAN.md.
  path.join(REPO_ROOT, 'lib', 'memory', 'per-command-teaching.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'per-command-jtbd-derivation.test.cjs'),
  // ---------- Phase 118 ----------
  // 30-Second MVA + Reward-Before-Investment Rule. Plans 00-06 ship the
  // pipeline; Plan 06 ships the rule + linter + Dror 2.0 harness.
  // Aggregator: tests/run-all-118.sh.
  //   Plan 118-00 (UserPromptSubmit detection):
  path.join(REPO_ROOT, 'lib', 'core', 'mva-classifier.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-detect.smoke.test.cjs'),
  //   Plan 118-01 (dispatch architecture):
  path.join(REPO_ROOT, 'lib', 'core', 'mva-agent-contract.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-budget.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-dispatcher.test.cjs'),
  //   Plan 118-02 (six MVA agents -- aggregate runner for all 6):
  path.join(REPO_ROOT, 'lib', 'agents', 'mva', 'test-all-six-agents.cjs'),
  //   Plan 118-03 (progressive streaming + orchestrator + telemetry):
  path.join(REPO_ROOT, 'lib', 'core', 'mva-progressive-renderer.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-telemetry.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-orchestrator.test.cjs'),
  //   Plan 118-04 (Feynman deck + Vercel deploy):
  path.join(REPO_ROOT, 'lib', 'core', 'resolve-vercel-key.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-vercel-deploy.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-deck-builder.test.cjs'),
  //   Plan 118-05 (footer routing + operator helper):
  path.join(REPO_ROOT, 'lib', 'conversation', 'operator.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.test.cjs'),
  //   Plan 118-06 (rule-linter + Dror 2.0 acceptance harness):
  path.join(REPO_ROOT, 'lib', 'core', 'mva-rule-linter.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-mva-dror-harness.cjs'),
  // Phase 119-00 Wave 1 (Room-as-Receipt Invariant; D-01 + D-04 + D-06 telemetry mirror).
  //   test-room-auto-create-event-types.cjs -> 119-00 Task 1 (EVENT_TYPES floor + 3 new strings)
  //   venture-shape-nudge.test.cjs          -> 119-00 Task 1 (D-02 nudge detector + D-01 invariant)
  //   room-auto-create.test.cjs             -> 119-00 Task 2 (slug + scaffold + registry + memory_event)
  //   test-room-auto-create-fingerprint-integration.cjs -> 119-00 Task 3 (sibling hook + nudge shim)
  // Mirrors the Phase 117-00 + Phase 124-02 additive-tail-append registration precedent.
  path.join(REPO_ROOT, 'tests', 'test-room-auto-create-event-types.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'venture-shape-nudge.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'room-auto-create.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-room-auto-create-fingerprint-integration.cjs'),
  // Phase 119-02 Wave 1 extension (Room-as-Receipt Invariant; D-05 skeleton scaffold +
  //   Larry thinness-acknowledgment voice line + Canon decision 15 ICM Layer 0 everywhere).
  //   larry-thinness-acknowledgment.test.cjs        -> 119-02 Task 1 (THINNESS_VOICE_LINE verbatim + detector)
  //   room-skeleton-scaffold.test.cjs               -> 119-02 Task 2 (scaffold unit tests; reentrancy + Part 8/9 invariants)
  //   test-room-skeleton-scaffold-integration.cjs   -> 119-02 Task 2 (end-to-end placeholder-room scaffold scenarios)
  //   test-119-02-auto-explore-fire-wiring.cjs      -> 119-02 Task 3 (REVISION 2026-05-16: scaffoldRoomSkeleton call
  //                                                                   site wired into scripts/auto-explore-fire.cjs;
  //                                                                   closes Blocker 1+4 phantom wiring)
  // Aggregator: tests/test-119-02-scaffold.sh (the 6-gate shell harness).
  path.join(REPO_ROOT, 'lib', 'core', 'larry-thinness-acknowledgment.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'room-skeleton-scaffold.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-room-skeleton-scaffold-integration.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-119-02-auto-explore-fire-wiring.cjs'),
  // Phase 119-01 Wave 2 extension (Room-as-Receipt Invariant; D-03 + D-06 retroactive-naming
  //   F.1 selector + discard cascade + LLM-name-suggester + tri-surface adaptation):
  //   llm-name-suggester.test.cjs                -> 119-01 Task 1 (HAIKU_MODEL_ID + FALLBACK +
  //                                                  suggest happy/sad + Canon Part 8 grep tripwire +
  //                                                  EVENT_TYPES floor with +1 room_discard_partial_failure)
  //   room-name-validator.test.cjs               -> 119-01 Task 2 (four rejection classes +
  //                                                  Windows-reserved defense-in-depth)
  //   room-discard-cascade.test.cjs              -> 119-01 Task 2 (transactional discard +
  //                                                  partial-failure recovery via rooms-meta.db)
  //   room-naming-selector.test.cjs              -> 119-01 Task 3 (orchestrator + F1_OPTION_LABELS
  //                                                  + DECISION_PATHS + tri-surface envelope)
  //   test-room-naming-selector-integration.cjs  -> 119-01 Task 4 (mva-orchestrator hook + e2e shim spawn)
  // Aggregator: tests/test-119-01-scaffold.sh (the 7-gate shell harness).
  path.join(REPO_ROOT, 'lib', 'core', 'llm-name-suggester.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'room-name-validator.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'room-discard-cascade.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'room-naming-selector.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-room-naming-selector-integration.cjs'),
  // Phase 120-00 Wave 1: 4 breakthrough pattern detectors + Breakthrough graph schema.
  //   test-breakthrough-event-types.cjs   -> 120-00 Task 1 (EVENT_TYPES floor + 6 new strings;
  //                                          round-trip via navigation.logMemoryEvent)
  //   test-breakthrough-edge-types.cjs    -> 120-00 Task 1 (ALLOWED_EDGE_TYPES floor + DERIVED_FROM;
  //                                          round-trip via navigation.writeEdge)
  //   lib/core/breakthrough/detectors.test.cjs -> 120-00 Task 2 (DETECTOR_THRESHOLDS verbatim + 4
  //                                          detectors + classifyFireTier + Canon Part 8 invariant)
  //   lib/core/breakthrough/schema.test.cjs    -> 120-00 Task 3 (writeBreakthrough + validateProvenance;
  //                                          D-20 HARD FLOOR atomic-transaction invariant)
  // Aggregator: tests/test-120-00-scaffold.sh (the 9-gate shell harness).
  path.join(REPO_ROOT, 'tests', 'test-breakthrough-event-types.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-breakthrough-edge-types.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'detectors.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'schema.test.cjs'),
  // Phase 120-01 Wave 2: F.7 Breakthrough Surface selector + 5-component scoring formula.
  //   shape-f7-breakthrough-renderer.test.cjs -> 120-01 Task 1 (closed-vocab 5 verbs verbatim
  //                                              + D-10 mandatory-dismiss invariant +
  //                                              D-20 HARD FLOOR provenance refusal)
  //   scoring.test.cjs                        -> 120-01 Task 3 (SCORING_WEIGHTS verbatim
  //                                              + RECENCY_HALF_LIFE_DAYS verbatim + the
  //                                              5-component formula + Laplace prior +
  //                                              D-19 dismissal-rate canary + Canon Part 8
  //                                              source-grep + em-dash HARD RULE)
  //   selector-dispatcher additive F.7 branch is verified by tests/test-120-01-scaffold.sh
  //                                              Gates 1 + 2 (already on disk; no separate
  //                                              dispatcher unit-test file landed in Plan 120-01).
  // Aggregator: tests/test-120-01-scaffold.sh (the 8-gate shell harness).
  path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f7-breakthrough-renderer.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'scoring.test.cjs'),
  // Phase 120-02 Wave 2: session-start scanner + resurfacing + canary +
  //   verb-dispatch consumer. Wires Plan 120-00 detectors + Plan 120-01 F.7 +
  //   D-13..D-15 resurfacing rules + D-19 canary + 5-verb dispatch.
  //   resurfacing.test.cjs     -> 120-02 Task 1 (D-13..D-15 predicates;
  //                                SEVEN_DAY_COOLDOWN_MS verbatim; D-13 BOTH-
  //                                condition lock; Canon Part 8 source-grep)
  //   canary.test.cjs          -> 120-02 Task 1 (D-19 constants verbatim;
  //                                computeDismissalRate + isThrottled +
  //                                emitThrottleEvent; D19_MIN_SAMPLE floor;
  //                                per-kind isolation)
  //   verb-dispatch.test.cjs   -> 120-02 Task 2 (5-verb to 3-event lock;
  //                                Confirm/Dismiss/File-as-decision emitters;
  //                                D-09 FILED_AS_DECISION edge bridge;
  //                                D-13 artifact_ids_at_dismiss baseline)
  //   scanner.test.cjs         -> 120-02 Task 3 (scanForBreakthroughs +
  //                                surfaceBreakthrough; D-16 silence; D-13..
  //                                D-15 resurfacing filter; D-19 throttle
  //                                filter; D-20 writeBreakthrough contract;
  //                                D-20 third structural enforcement point)
  //   check-pending-breakthrough.test.cjs -> 120-02 Task 3 session-start hook
  //                                (no-active-room / D-16 silence / happy-path
  //                                F.7 surfaced / corrupt-room degrade / hooks
  //                                .json wiring)
  //   tests/test-breakthrough-d20-end-to-end.cjs -> 120-02 Task 3 LOAD-BEARING
  //                                D-20 invariant: every breakthrough_surfaced
  //                                pairs with >= 1 DERIVED_FROM edge; batch
  //                                invariant returns zero orphan-provenance
  //                                Breakthroughs; surface refusal emits
  //                                breakthrough_surface_blocked telemetry.
  // Aggregator: tests/test-120-02-scaffold.sh (the 8-gate shell harness).
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'resurfacing.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'canary.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'verb-dispatch.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'scanner.test.cjs'),
  path.join(REPO_ROOT, 'scripts', 'check-pending-breakthrough.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-breakthrough-d20-end-to-end.cjs'),
  // Phase 120-03 Wave 2: D-17 voice scaffold + D-18 4-tier ethics fence + SOFT_BAND
  //   review queue + Larry skill update. The conversational + ethical-enforcement
  //   layer that converts the math-detected breakthrough into honest, evidence-backed
  //   Larry voice. Aggregator: tests/test-120-03-scaffold.sh (the 9-gate harness).
  //   voice-scaffold.test.cjs                       -> 120-03 Task 1 (composeBreakthrough
  //                                                    VoiceLine + auditVoiceLine + the
  //                                                    4 D-17 rule predicates + frozen
  //                                                    constants verbatim)
  //   ethics-fence.test.cjs                         -> 120-03 Task 2 (classifyEthicsBand
  //                                                    + 4 frozen threshold constants +
  //                                                    queueForReview happy path +
  //                                                    memory_event mirror)
  //   review-queue.test.cjs                         -> 120-03 Task 2 (openReviewQueue +
  //                                                    .rooms/breakthrough-review-queue.db
  //                                                    schema + insertReviewCandidate +
  //                                                    listPendingReviews + graceful EACCES
  //                                                    fallback)
  //   scanner-d17-d18.test.cjs                      -> 120-03 Task 3 (scanner integration
  //                                                    of voice-scaffold + ethics-fence;
  //                                                    F.7 renderer voice_line slot; D-17
  //                                                    violator -> structural default)
  //   tests/test-breakthrough-d17-voice-audit.cjs   -> 120-03 Task 1 (D-17 audit catalog
  //                                                    end-to-end: 8-candidate matrix +
  //                                                    per-rule violator/valid pairs)
  //   tests/test-breakthrough-d18-ethics-fence.cjs  -> 120-03 Task 2 (D-18 4-band end-to-end:
  //                                                    SOFT_BAND queue + memory_event; no
  //                                                    breakthrough_surfaced from SOFT_BAND)
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'voice-scaffold.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'ethics-fence.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'review-queue.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'scanner-d17-d18.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-breakthrough-d17-voice-audit.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-breakthrough-d18-ethics-fence.cjs'),
  // Phase 121-00 (Wave 1, Foundation): unified trajectory-telemetry writer
  // chokepoint + frozen v1 schema + Canon Part 8 emit-time validator. The
  // architectural ancestor is lib/core/mva-telemetry.cjs (Phase 118); this
  // module consolidates the 4 piecemeal writers (mva, query-efficiency,
  // selector, navigation-bypass) into ONE emit() entry point with
  // ISO-week rotation (events-YYYY-WNN.jsonl) and a per-row schema_version
  // (Number 1). schema.test.cjs (2 cases) asserts EVENT_TYPES frozen at 15
  // + ALLOWED_FIELDS shape. validator.test.cjs (7 cases) asserts the
  // Canon Part 8 constitutional gate: unknown_event + unknown_field + 7
  // adversarial forbidden-pattern rejections (Cypher / email / phone /
  // brain host URL / absolute path / raw hex / free-text prose). The
  // sha256-in-dedicated-field sanity case confirms hash-class fields are
  // NOT false-flagged. writer.test.cjs (10 cases) asserts the chokepoint
  // contract end-to-end: export surface, telemetryDir under HOME,
  // isoWeekFilename zero-padding, telemetryFile composition, emit() JSONL
  // shape (schema_version=1 Number + ISO-8601 timestamp + session_id +
  // payload), throws on unknown event, throws on Part 8 forbidden pattern,
  // recursive mkdir + silent fs-error swallow, two emits 5ms apart in
  // same ISO-week file, all lines JSON.parseable with no BOM.
  path.join(REPO_ROOT, 'lib', 'core', 'telemetry', 'schema.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'telemetry', 'validator.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'telemetry', 'writer.test.cjs'),
  // Phase 121-01 Task 1 (Wave 1, atomic cutover): the one-time idempotent
  // migration script that merges the 4 piecemeal telemetry sources
  // (mva.jsonl, selector.jsonl, navigation-bypass.jsonl,
  // query-efficiency.jsonl) into the unified events-YYYY-WNN.jsonl stream
  // produced by writer.cjs. 8 fixture tests cover: empty source dir
  // no-op, legacy-shape normalization to command_invocation, mva
  // timestamp-order + schema_version=1 (Number), source rename to
  // *.pre-v121.bak, sha256-fingerprint idempotence on re-run, mixed-week
  // ISO split (W19/W20), Canon Part 8 forbidden-pattern quarantine
  // without abort, stdout summary JSON shape. Hermetic per-test
  // tmpdir + HOME swap; mirrors writer.test.cjs scaffolding.
  path.join(REPO_ROOT, 'scripts', 'migrate-telemetry-v1.test.cjs'),
  // Phase 121-02 Task 1..4 (Wave 2, capture-point wire-ins): 4 integration
  // test files each verify that a high-signal capture point routes its
  // emit through lib/core/telemetry/writer.cjs into the unified
  // events-YYYY-WNN.jsonl stream. D-04 selector_pick (88.2/125 ranker) +
  // D-05 tension_engagement (Phase 116) + D-06 auto_explore_decision
  // (Phase 117) + D-07 breakthrough_dismissed (Phase 120 + ethics_tier +
  // voice_audit_pass). 4 tests per file (16 total); each asserts the
  // event lands with correct ALLOWED_FIELDS shape, non-blocking semantics
  // (telemetry validation failure does NOT crash the shipping behavior),
  // and that user-initiated state transitions are captured while
  // system-driven transitions (decay, throttle, skip) are excluded.
  path.join(REPO_ROOT, 'tests', 'test-121-02-selector-pick-capture.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-121-02-tension-engagement-capture.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-121-02-auto-explore-capture.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-121-02-breakthrough-dismissed-capture.cjs'),
  // Phase 121-03 Task 1..4 (Wave 2, secondary D-09 capture points): 3 integration
  // tests + 1 drowning-protection fixture. D-09 ships three lower-signal but
  // broader-sweep emit surfaces: empathy audit observation CLI harness +
  // Phase 119 room-as-receipt helper module + PostToolUse /mos:* broad sweep
  // (100% sampling, type-discriminator-isolated bucket). The drowning-protection
  // fixture proves the type discriminator works: 100 command_invocation events
  // + 10 selector_pick events to a tmpdir, type-filter isolates them so SEED-002
  // consumers can drop the bucket without losing the high-signal stream.
  path.join(REPO_ROOT, 'tests', 'test-121-03-empathy-observation.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-121-03-room-receipt-emit.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-121-03-command-invocation-hook.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-121-03-drowning-protection.cjs'),
  // Phase 127.1 brain-graphrag-collapse-pinecone-neo4j-hnsw (Wave 0 harness scaffold + Wave 1/2/3 outputs)
  //   Surface 1 -> Plan 127.1-01 produces embedding-manifest.fixture.json (12,401 byte-identical SHA256 pairs).
  //   Surface 2 -> Plan 127.1-02 produces index-config.fixture.json (SHOW INDEXES dim=1024 cosine ONLINE).
  //   query-embedder -> Plan 127.1-03 produces mcp-server-brain/lib/query-embedder.cjs (server-side e5-large query embedding; hermetic, mocked transport).
  //   Surface 3 -> Plan 127.1-04 produces overlap-baseline + overlap-neo4j fixtures (BLOCKING gate >= 0.80).
  // Aggregator: tests/run-all-127.sh. RED-by-design until consumer plans land the fixtures.
  path.join(REPO_ROOT, 'tests', '127.1-embedding-integrity.test.cjs'),
  path.join(REPO_ROOT, 'tests', '127.1-index-config.test.cjs'),
  path.join(REPO_ROOT, 'tests', '127.1-query-embedder.test.cjs'),
  path.join(REPO_ROOT, 'tests', '127.1-graphrag-overlap.test.cjs'),
  // Phase 127.3 jtbd-auto-anchor-fix (Plan 00 chokepoint extraction):
  //   tests/test-resolve-active-room-canonical.cjs -- 12 hermetic scenarios
  //   on lib/core/resolve-active-room.cjs (rar.1..rar.12; both legacy +
  //   current registry shapes, env override, sealed/archived rejection,
  //   Canon Part 8 + Part 9 source-grep tripwires).
  // The shell-based 127.3 tests (test-jtbd-auto-anchor-empirical.sh +
  // test-127.3-sibling-sweep.sh) are NOT registered here -- this runner
  // is CJS-only (spawnSync('node', [file])); they run via
  // tests/run-all-127.3.sh instead, per 127.3-PATTERNS.md.
  path.join(REPO_ROOT, 'tests', 'test-resolve-active-room-canonical.cjs'),
  // Phase 129 spine-repair-memory-event (the backward arc: every spine surface
  // journals a memory_event via navigation.cjs; SQL is the local mind). 5 suites
  // mapped to their plans (mirrors the Phase 124 / Phase 125 additive-tail block):
  //   test-129-spine-substrate.cjs        -> 129-01 Wave 1 substrate: 5 net-new
  //     canonical event types (spine_read / jtbd_transitioned /
  //     operator_transitioned / workflow_stage / suggestion_surfaced) + FOLLOWS_FROM
  //     as the 8th cascade edge + 60s idempotency in logEvent + spine-events.cjs
  //     roomDir-taking helper API.
  //   test-129-read-surface-events.cjs    -> 129-02 Wave 2 read surfaces:
  //     mos-status / memory / suggest-next emit spine_read + suggestion_surfaced.
  //   test-129-state-transition-events.cjs-> 129-03 Wave 2 state transitions:
  //     jtbd / operator transitions emit jtbd_transitioned + operator_transitioned
  //     (+ OPERATOR_TRANSITION edge through the chokepoint).
  //   test-129-workflow-stage-events.cjs  -> 129-04 Wave 2 workflow surfaces:
  //     act / pipeline emit workflow_stage entered + completed (FOLLOWS_FROM chain).
  //   test-129-spine-acceptance.cjs       -> 129-05 Wave 3 release gate: the
  //     instrumented proactive-loop acceptance test (zero non-SQLite reads outside
  //     the two cache files + exact memory_event count + dedupe + the next status
  //     render reads the just-emitted events + FOLLOWS_FROM linkage). Mirrors the
  //     Phase 109 tests/test-navigation-acceptance.cjs fs-instrument precedent.
  // Aggregator: tests/run-all-129.sh.
  path.join(REPO_ROOT, 'tests', 'test-129-spine-substrate.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-129-read-surface-events.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-129-state-transition-events.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-129-workflow-stage-events.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-129-spine-acceptance.cjs'),
  // Phase 129.5 truth-machine-activation (the human-confirms-truth lever made
  // live: confirmNode is the single APPROVE-to-promote door; an agent-attributed
  // confirm is REJECTED; audit nodes are exempt per the Canon Part 9 v1.5
  // carve-out). 2 suites mapped to their plans:
  //   test-129.5-confirm-node.cjs   -> 129.5-02 confirmNode chokepoint +
  //     human-attribution guard (AGENT_IDENTITIES REJECT on confirm/validate of
  //     truth-claim nodes) + resolveByUser USER.md navigator-identity resolver.
  //   test-129.5-truth-machine.cjs  -> 129.5-03 release gate: the instrumented
  //     acceptance test. A USER.md-attributed APPROVE through the selector
  //     dispatcher promotes proposed->confirmed via navigation.confirmNode AND
  //     confirmedFacts returns it; an agent-attributed confirm is REJECTED and
  //     the node stays proposed; a status_promoted memory_event is emitted on
  //     promotion; audit nodes (created_by=system) are exempt. Mirrors the
  //     Phase 109/129 fs-instrument precedent (USER.md is the single allow-listed
  //     non-room.db read).
  // Aggregator: tests/run-all-129.5.sh.
  path.join(REPO_ROOT, 'tests', 'test-129.5-confirm-node.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-129.5-truth-machine.cjs'),
  // Phase 130 lens-engine-skeleton (the single architectural rotate() engine +
  // the cognitive-family migration onto room.db; the lens family is the moat
  // surface for v1.14.0 domain/source/framework/trend migrations). 4 suites
  // mapped to their plans:
  //   test-130-lens-substrate.cjs      -> 130-01 INFORMS + REJECTED_BECAUSE edge
  //     enum + lens-nodes.cjs HatState / lens_finding node chokepoint.
  //   test-130-lens-engine.cjs         -> 130-02 rotate() engine + 5-family
  //     registry + serial/parallel/single modes + the 3 pure synthesizers + the
  //     5 lens memory_event types.
  //   test-130-cognitive-migration.cjs -> 130-03 hat-persistence room.db rewrite
  //     + one-shot backfill + the 4 thin lens-engine command clients +
  //     persona-ops loop delegation + tension-map dedup.
  //   test-130-lens-engine-e2e.cjs     -> 130-04 release gate: 8 instrumented
  //     E2E tests (6 cognitive-family serial/parallel/single/consume + round-trip
  //     + backfill, 2 engine-contract rejection-as-data + persona-aware framing),
  //     all through navigation.cjs with the Phase 109/129 fs-instrument zero-leak
  //     gate (USER.md the single allow-listed non-SQLite read).
  // Aggregator: tests/run-all-130.sh.
  path.join(REPO_ROOT, 'tests', 'test-130-lens-substrate.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-130-lens-engine.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-130-cognitive-migration.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-130-lens-engine-e2e.cjs'),
  // Phase 130.5 shared-corpus-cache-cjs-fetcher-substrate (the ONE external-corpus
  // module + shared TTL cache that 131 consumes, 134 reuses, and
  // rs-discovery-engine migrates onto; built once). The substrate unit suites live
  // at the module sites (lib/core/research-corpus.test.cjs +
  // lib/core/research-cache.test.cjs); the migration regression registers here:
  //   test-130.5-corpus-migration.cjs -> 130.5-03 rs-discovery-engine repointed off
  //     the private fetcherAcademic path onto fetchCorpus + the shared
  //     research-cache. Byte-identical fixture regression (full downstream bundle
  //     old-vs-new) + cache-hit-on-repeat (count_run2 < count_run1) + Canon Part 8
  //     preserved (planted forbidden flat_query rejects pre-egress, zero fetch).
  // Aggregator: tests/run-all-130.5.sh.
  path.join(REPO_ROOT, 'tests', 'test-130.5-corpus-migration.cjs'),
  // Phase 135 offer-resolver-and-reliable-next-move-closer (the offer loop:
  // the resolver emits one calibrated offer or null via an abstention triple,
  // the presenter grounds it, and the F.1 closer fires it through
  // AskUserQuestion to a typed decision edge). SC coverage: SC1/SC3/SC6
  // (resolver + abstention) + SC2/SC9 (zero non-SQLite leak, Part 8 boundary)
  // + SC1/SC4/SC6 (end-to-end production wiring guard) + SC5/SC6/SC7/SC8
  // (closer wiring + wikilink-on-accept + backoff persistence + cross-surface).
  // 4 suites mapped to their plans:
  //   navigation-engine-offer.test.cjs -> 135-02 resolver body + abstention
  //     triple (rank-first, SC2 graph + SC4 MD-aware, grounded [[wikilink]] reason).
  //   offer-closer.test.cjs            -> 135-03 F.1 closer wiring + decision-edge
  //     persistence + reject->shouldExclude backoff loop closure (SC6/SC7).
  //   test-135-resolver-no-leak.cjs    -> 135-01 fs-instrument zero-leak on the
  //     resolver decide() path (USER.md the single allow-listed non-SQLite read).
  //   test-135-decide-wiring-e2e.cjs   -> 135-01 dark-loop regression guard: the
  //     REAL decide() path on a DECISION_GATE turn emits offer_next_step non-null
  //     with a real [[section]] reason (never an undefined-valued wikilink) +
  //     defined scope, plus a JUST_TALK null negative control.
  // Aggregator: tests/run-all-135.sh.
  path.join(REPO_ROOT, 'lib', 'memory', 'navigation-engine-offer.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'offer-closer.test.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-135-resolver-no-leak.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-135-decide-wiring-e2e.cjs'),
  // Phase 130.7 correlation-id-contract-dual-graph-ci-gates (Wave 1: the
  // name-based, embedding-INDEPENDENT correlation_id hashing chokepoint + the
  // one-time idempotent Brain backfill + the LOCAL correlation_labels index
  // Plan 02's no-fork canonical pick consumes). 2 suites mapped to their tasks:
  //   correlation.test.cjs             -> 130.7-01 Task 1: determinism +
  //     embedding-independence (arity-2 + ignored 3rd arg, the key_invariant) +
  //     label-sensitivity + trim normalization + 28-name collision fixture +
  //     golden version pin.
  //   correlation-label-index.test.cjs -> 130.7-01 Task 2: serialize/parse
  //     round-trip incl. a cross-label-duplicate name with per-label degree;
  //     empty/malformed body returns {} without throwing; stable section key.
  //   chain-recommender-canonical.test.cjs -> 130.7-02 Task 1: recommendCanonical
  //     Targets one canonical tuple per query, no cross-label fork.
  //   local-chain-recommender.test.cjs / spine-events-correlation.test.cjs ->
  //     130.7-02 Tasks 2/3: aggregate-by-correlation_id + memory_event refs.
  //   dual-graph-health.test.cjs -> 130.7-03 Task 1 + Task 3: the report-only/
  //     baseline fail-closed CI gate (records a baseline, fails on regression not
  //     pre-existing debt, fails-closed on inconclusive, M3 recommender no-fork,
  //     post-132 flip stubbed) PLUS the Part 8 phase-wide forbidden-pattern sweep
  //     over all 8 130.7 code paths.
  //   brain-derive-curation.test.cjs -> 130.7-03 Task 2: the three /mos:brain-derive
  //     curation surfaces (--review-anchors / --orphan-census / --cross-label-dups).
  // Aggregator: tests/run-all-130.7.sh.
  path.join(REPO_ROOT, 'lib', 'memory', 'correlation.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'correlation-label-index.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'chain-recommender-canonical.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'local-chain-recommender.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'spine-events-correlation.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'dual-graph-health.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'brain-derive-curation.test.cjs'),
  // Phase 131 research-as-graph-aware-workflow (the source-lens family PILOT:
  // /mos:research becomes the canonical 7-stage workflow step other methodologies
  // dispatch, with typed EvidenceClaim nodes + INFORMS / CONTRADICTS / SUPERSEDES /
  // REJECTED_BECAUSE cascade edges; the template for the v1.14.0 fan-out to the 13
  // remaining research surfaces). 6 suites mapped to their plans:
  //   test-131-substrate.cjs          -> 131-01 CONTRADICTS + SUPERSEDES edge enum
  //     (additive) + research_filed / research_rejected / research_deferred events +
  //     evidence-claim.cjs writeEvidenceClaim (LOCKED Phase 136 schema) +
  //     research-preflight.cjs getResearchPreflight batched 8-input read +
  //     navigation.cjs re-exports.
  //   test-131-context-extractor.cjs  -> 131-02 Stage 1+2+3 extractContext (ONE
  //     batched pre-flight read + Body Shape A summary + context-derived lens_set).
  //   test-131-source-lens-driver.cjs -> 131-03 Stage 3-4 runSourceLens (the source
  //     family activated on the 130 lens-engine + weighted-by-context mode + the
  //     130.5 corpus consume; dedup + tier/relevance rank; zero Python).
  //   test-131-findings-wirer.cjs     -> 131-04 Stage 6 F.1 filing selector (mirrors
  //     selector-dispatcher) + Stage 7 wireAccept/wireReject/wireDefer (local-node-id
  //     for local targets; REAL correlation_id for teaching-graph targets).
  //   test-131-isomorphism.cjs        -> 131-05 check-research-isomorphism CI guard
  //     (typed-node + typed-edge contract + zero-Python directive gate).
  //   test-131-e2e.cjs                -> 131-06 release gate: 5 instrumented E2E
  //     tests (standalone / build-thesis chain-back / user-needs different-lens +
  //     REAL correlation_id / rejection-as-data / dedup+cache), all driving the FULL
  //     pipeline through navigation.cjs with the Phase 109/129/130 fs-instrument
  //     zero-leak gate (USER.md + the 130.5 research-cache the allow-listed reads).
  // Aggregator: tests/run-all-131.sh.
  path.join(REPO_ROOT, 'tests', 'test-131-substrate.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-131-context-extractor.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-131-source-lens-driver.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-131-findings-wirer.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-131-isomorphism.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-131-e2e.cjs'),
  // Phase 132 dual-graph-correlation-hypergraph-reformat (Wave 1: the shared
  // curation-batch runner + the hypergraph event-node SCHEMA substrate + the
  // write-time 130.7-contract guard, all MACHINERY built + tested on FIXTURES;
  // ZERO live Brain writes in this plan). 2 suites mapped to their tasks:
  //   curation-batch.test.cjs          -> 132-01 Task 1: the reusable
  //     curation-batch runner -- makeBatch stamps created_by on every forward
  //     write, REJECTS any batch with empty rollbackCyphers (the reversibility
  //     contract), assertRollbackPath ties each rollback to its forward
  //     created_by selector, scanBatchForUserContent proves the Canon Part 8
  //     no-user-content shape, and execute() runs a write-time pre-flight probe
  //     (assertCorrelationContractPresent) that refuses to mutate unless the
  //     Phase 130.7 correlation_id contract is present in the live graph --
  //     asserted via an injected fake runner (no live Brain). dry-run stays
  //     creds-free + ungated. Transport REUSED from the admin-brain-write
  //     neo4j-driver pattern (zero new deps).
  //   hypergraph-event-schema.test.cjs -> 132-01 Task 2: the frozen 5-event-type
  //     contract (Authorship/Illustration/Contradiction/Motivation/Evolution)
  //     with each type's connected roles + the additive reify Cypher builder
  //     (zero DELETE/REMOVE/DETACH/DROP per Part 7) + EVENT_INSTANCE_MIN floor.
  // Aggregator: tests/run-all-132.sh.
  path.join(REPO_ROOT, 'lib', 'memory', 'curation-batch.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'hypergraph-event-schema.test.cjs'),
  // Plan 132-03 (re-baselined): the dedup-collapse + held-name-rename machinery
  //   curation-132-03-dedup-held-rename.test.cjs -> 132-03: the GENERIC pass
  //     machinery the orchestrator runs later snapshot-first against the TINY
  //     live worklist (1 dedup pair 6831/22816 + 14 held name>80 nodes).
  //     pickCanonical (most-edged + 130.7 LABEL_PRIORITY tiebreak); dedup yields
  //     keeper correlation_id via computeCorrelationId (reused, no re-hash) +
  //     migrate-incoming-edges + :Archived/REPLACED_BY (reversible-delete only,
  //     Part 7) + snapshotRequired (node-merge is not created_by-reversible);
  //     held rename recomputes correlation_id + 3-property curated-v1 backfill +
  //     clears the held marker (fully created_by-reversible). Both route through
  //     the 132-01 makeBatch runner; ZERO live writes; fixtures only.
  path.join(REPO_ROOT, 'lib', 'memory', 'curation-132-03-dedup-held-rename.test.cjs'),
  // Plan 132-05 (re-baselined to the RELEASE GATE): the pseudonymize BUILDER
  // (6 internal-team :Person nodes matched by the mindrian_internal:true FLAG,
  // never a real-name literal; Aronhime public persona excluded; name_pre_pseudonym
  // stored before overwrite for the created_by=batch-5 reversible rollback; Part 8
  // scanBatchForUserContent clean) PLUS the Phase 132 RELEASE GATE assertion that
  // scripts/verify-phase-132.cjs INVOKES (never reimplements) the Phase 130.7
  // dual-graph health gate + runs the brain-boundary-scan over the phase-132 batch
  // builders, fail-closed (blocked-on-130.7) when the gate is absent. The live
  // pseudonymize WRITE is DEFERRED to v1.14.0 (deferred-items.md); ZERO live writes.
  path.join(REPO_ROOT, 'lib', 'memory', 'curation-132-05-pseudonymize.test.cjs'),
  // Quick task 260602-rgx: /mos:help selector-menu lane contract regression. Locks
  // the 4 invariants of the Shape F drill-down selector over data/help-groups.json:
  // (1) every group declares a lane in {start, methodology, explore, view}; (2) the 4
  // lanes cover every non-admin command EXACTLY once (full coverage + no dup, with the
  // non-admin set derived from commands/*.md visibility frontmatter minus
  // deprecated_aliases, mirroring scripts/check-help-coverage.cjs); (3) no
  // visibility:admin command (admin, dogfood-flush) and no deprecated_aliases key
  // appears in any group; (4) scripts/help-renderer.cjs text view exits 0 and prints a
  // /mos:<cmd> line for every non-admin command. Canon Part 7 (mirrors the existing
  // coverage check rather than inventing a second visibility convention) + Part 8
  // (filesystem only, zero network surface).
  path.join(REPO_ROOT, 'tests', 'test-help-selector-lanes.cjs'),
  // Quick task 260602-dsc: /mos:help De Stijl CARD view structure test
  // (scripts/help-renderer.cjs renderHelpCards). Locks the card-view contract:
  // (1) color mode carries a DS 24-bit truecolor escape AND prints a /mos:<cmd>
  // + its help_jtbd one-liner for every non-admin command + all 4 lane labels;
  // (2) ascii mode (useColor=false) carries ZERO ANSI escapes yet prints the
  // same per-command /mos:<cmd> + jtbd + 4 lane labels; (3) neither mode prints a
  // visibility:admin command (admin, dogfood-flush) or a deprecated_aliases key.
  // Non-admin set mirrors scripts/check-help-coverage.cjs (Canon Part 7 -- one
  // visibility convention); filesystem only, zero network (Canon Part 8).
  path.join(REPO_ROOT, 'tests', 'test-help-cards-render.cjs'),
  // Quick task 20260702-help-coverage-gate: the born-listed /mos:help coverage
  // gate contract. Locks: (1) the gate is green on the live backfilled manifest;
  // (2-6) over an isolated fixture tree, the SAME check() catches a missing
  // user-facing command, a ghost (grouped name with no file), a deprecated:true
  // command NOT born-listed in deprecated_aliases, and a deprecated command that
  // leaked into a group; (7) scripts/install-pre-commit.sh wires the gate (the
  // 121.5-07 gate had shipped un-wired, which let a 13-command drift go RED
  // silently). Part 7 (one gate over fixtures, not a fork) + Part 8 (LOCAL only).
  path.join(REPO_ROOT, 'tests', 'test-help-coverage-gate.cjs'),
  // Phase 224 (graph-derivation harness): normal prose writes now derive
  // proposed CONVERGES/INFORMS edges through the navigation chokepoint,
  // disclosed-not-guessed when the encoder is missing. The eight per-plan proof
  // legs the tests/run-all-224.sh aggregator also gates (224-VALIDATION test-
  // infrastructure contract: new tests register here alongside the aggregator):
  //   migration       -> D-05 edges.review_status column + writeEdge enum upsert
  //   classifier      -> D-01 CONVERGES/INFORMS-only score-to-edge-type layer
  //   encoder-skip    -> D-04 disclose-not-guess (derivation_skipped marker)
  //   per-write-derive-> Req 1 cascade Step 2b enqueue + detached spawn
  //   cost-bound      -> Req 6 O(n) new-vs-existing pair count
  //   backfill-idempotent -> Req 2 score-based deriver swap + Ralph re-run invariant
  //   resolver-fallback   -> Req 3 canonical resolveWriteRoom fallback
  //   proposed-only   -> Req 4 no auto-confirm (edge column + claim node)
  path.join(REPO_ROOT, 'tests', 'test-224-migration.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-classifier.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-encoder-skip.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-per-write-derive.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-cost-bound.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-backfill-idempotent.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-resolver-fallback.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-224-proposed-only.cjs'),
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
