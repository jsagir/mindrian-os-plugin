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
  path.join(REPO_ROOT, 'tests', 'test-generate-section-intelligence.cjs'),
  path.join(REPO_ROOT, 'tests', 'test-doctor-ui-self-compliant.cjs'),
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
  // Phase 99-03: renderer contract stub. 8 IIFE scenarios covering the
  // 5-operator round-trip, JUST_TALK default when operator omitted
  // (undefined), JUST_TALK default when operator null, throw on invalid
  // operator (message names bad value AND each of the 5 canonical
  // operators), envelope shape stable (exactly 6 keys: zones / mode /
  // operator / tier / rendered / _stub), mode passthrough (cli / desktop /
  // cowork + arbitrary unchanged), tier passthrough (tier-0 / mode-a /
  // mode-b + arbitrary unchanged), and OPERATORS export frozen + equals
  // 5 canonical names. Phase 102 (lib/render/render-v2.cjs) replaces the
  // stub internals without changing the import surface; these tests
  // continue to pass as a contract regression fence.
  path.join(REPO_ROOT, 'lib', 'render', 'render-v2.test.cjs'),
  // Phase 99-05: /mos:operator command. Tests show/history/set/reset
  // subcommands, --json paths, Tier 0 fallback, UI Ruling System self-
  // compliance (12-glyph + 5-color + 4-zone + Shape E + Shape F.1 + Shape
  // F.4), Canon Part 8 audit (zero Brain queries), frame budget (50
  // invocations < 500ms mean), and commands/operator.md frontmatter scan.
  // Depends on Phase 99-01 lib/conversation/operator.cjs at runtime;
  // integration tests skip-as-fail until 99-01 lands in the merged tree.
  path.join(REPO_ROOT, 'tests', 'test-operator-command.cjs'),
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
