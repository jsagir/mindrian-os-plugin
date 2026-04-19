---
phase: 87
name: security-hardening-cascade-refactor
release_version: 1.10.11 (Stream A + 87-08) + 1.10.12 (Stream B + 87-09)
parent_release: 1.10.10
created: 2026-04-16
updated: 2026-04-19 (audit-driven revision R1-R7 folded, split decision locked)
driver: External code review (2026-04-16) validated 1 P0 + 8 P1 findings. Larry audit (2026-04-18) surfaced 7 additional risks (R1-R7) now addressed below.
authority_docs:
  - .planning/phases/87-security-hardening-cascade-refactor/87-CONTEXT.md (this doc)
  - .planning/phases/85-windows-hotfix-v1.10.9/85-CONTEXT.md (predecessor)
  - .planning/research/ui-ux-pathways/phase-86-localhost-spec.md (folded into 87-08)
  - .planning/research/ui-ux-pathways/lazygraph-chat-architecture.md (87-09 reference)
  - .planning/research/ui-ux-pathways/alternatives-considered.md (dependency-free rationale)
  - .planning/research/ui-ux-pathways/architecture-vision.md (bidirectional surface)
  - .planning/research/ui-ux-pathways/token-economics.md (zero-token rendering)
  - .planning/research/ui-ux-pathways/byo-api-and-surfaces.md (API surface)
invariants:
  - Every Data Room folder MUST have ROOM.md (identity) + MINTO.md (reasoning state)
  - Zero new runtime dependencies (Node builtins + existing deps only)
  - CJS only, no ESM, no TypeScript, no build step
  - Graceful degradation preserved (every fix fails safe, never crashes)
  - BSL 1.1 license applies to all new code
  - Feynman tests must stay green throughout (currently 17/17)
---

# Phase 87: Security Hardening + Cascade Refactor + Localhost Dashboard

## Milestone Split (LOCKED 2026-04-19)

Phase 87 ships across TWO releases, not one. Audit determined that bundling 10 plans into v1.10.11 carries unnecessary risk: a slip in any cascade-refactor plan would delay the investor-safe security fixes.

**v1.10.11 (Stream A + 87-08 dashboard):** investor-safe, demo-ready
- All security fixes (Cypher sanitization, API key perms, HSI timeout, write-lock atomic)
- Localhost dashboard (/mos:dashboard live)
- Five-gate release
- Target: 4-5 days

**v1.10.12 (Stream B + 87-09 BYO chat + 87-10-v2 release):** maintainability + intelligence
- Cascade refactor, async I/O, MCP validation, transactions, Brain cache, LRU eviction
- BYO API chat panel with Bearer token auth
- Five-gate release
- Target: 5-7 days (depends on 87-03 complexity)

Total execution: 9-12 days across two releases (revised from original "5-6 days" which was Phase 85 extrapolation and does not account for cascade refactor depth).

## Goal

**Stream A (v1.10.11, security + dashboard):**
Fix the confirmed Cypher injection vulnerability in brain-client.cjs, add API key file permission checks, bump HSI timeout, and harden write-lock with atomic file creation. Ship the localhost live dashboard (/mos:dashboard live) that renders the Data Room as a De Stijl knowledge graph at localhost:3131, reading directly from room.db and filesystem, with SSE live-reload. Zero tokens for rendering.

**Stream B (v1.10.12, architecture + chat):**
Refactor the intelligence cascade to eliminate ~250 lines of duplication (behind a mandatory e2e test fixture written first), split sync/async paths into two entry points (not env-branched), add transaction safety, implement Brain session caching, add LRU eviction, tighten MCP input validation, and ship the BYO API chat panel with Bearer token authentication (not raw API key per request).

## Audit Decisions Folded (R1-R7)

| Risk | Decision | Implementation |
|---|---|---|
| R1 Phase 88 numbering collision | Rename reverse-salient to Phase 89, Skill Offer Engine takes Phase 88 | **DONE 2026-04-19** -- directory renamed, internal 88-> 89 refs updated |
| R2 BYO chat security | **Bearer token exchange** (not raw API key per request) | New plan 87-09a below |
| R3 Cascade refactor risk | **E2E integration test fixture written FIRST** | New plan 87-00 (pre-flight), blocks 87-03 |
| R4 Async guard footgun | **Two entry points** (room-ops-sync.cjs + room-ops-async.cjs), no env branching | 87-04 spec revised below |
| R5 Triangulation math | **Tracked as Phase 88 concern**, not this phase | Phase 88 CONTEXT.md must address disagreement gate |
| R6 Stakeholders table populated | **Verify before shipping 87-09**, stub query if empty | New micro-plan 87-09b |
| R7 ROOM.md + MINTO.md pre-commit | **Installable git hook via scripts/setup-hooks.sh** | New plan 87-01a |

## Code Review Validation Summary (unchanged from prior revision)

External code review 2026-04-16 produced 3 P0 findings, 8 P1 findings, 12 minor findings. Our validation:

| Review finding | Our validation | Action |
|---|---|---|
| P0 SQL injection (lazygraph-ops) | **WRONG** -- parameterized queries | None |
| P0 Cypher injection (brain-client) | **CONFIRMED** -- 5 interpolation sites | Fix in 87-01 |
| P0 Write lock race | **OVERSTATED** -- self-heals | Fix in 87-06 |
| P1 Cascade duplication | **CONFIRMED** -- ~250 lines | Fix in 87-03 (AFTER 87-00 e2e fixture) |
| P1 execSync blocking MCP | **CONFIRMED** | Fix in 87-04 (two entry points) |
| P1 MCP input validation | **CONFIRMED** | Fix in 87-05 |
| P1 Brain session per request | **CONFIRMED** | Fix in 87-07 |
| P1 API key file permissions | **CONFIRMED** | Fix in 87-01 |
| P1 HSI 5s timeout | **CONFIRMED** | Fix in 87-01 |
| P1 indexArtifact no transaction | **CONFIRMED** | Fix in 87-06 |
| P1 Unbounded Map caches | **CONFIRMED** | Fix in 87-07 |
| rebuildGraph skips nested | **WRONG** -- intentional | None |
| No TypeScript | **Values disagreement** | None |
| Node 22.5 excludes LTS 20.x | **Deliberate** | None |

## Architectural Invariant: ROOM.md + MINTO.md (R7 addressed)

From CLAUDE.md decision #15 and Phase 81 Feynman-MINTO. Every Data Room folder MUST hold:
- `ROOM.md` -- ICM Layer 0 identity
- `MINTO.md` -- Feynman-MINTO reasoning state

**Enforcement (NEW in this phase):** Plan 87-01a ships `scripts/setup-hooks.sh` which installs a git pre-commit hook into `.git/hooks/pre-commit`. The hook refuses commits that introduce folders missing either file. Session-start guard verifies hook is installed and re-installs if missing (defeats accidental --no-verify drift).

```bash
find ~/MindrianRooms/$ACTIVE_ROOM -type d -not -path "*/.*" | while read dir; do
  [ ! -f "$dir/ROOM.md" ] && echo "MISSING ROOM.md: $dir"
  [ ! -f "$dir/MINTO.md" ] && echo "MISSING MINTO.md: $dir"
done
```

Zero missing = commit allowed. Any missing = STOP, generate first.

## Plans (revised wave structure)

### Wave 0 (pre-flight, blocks cascade refactor)

**87-00: Cascade e2e integration test fixture (R3 mitigation -- NEW)**
- Create `test/fixtures/cascade-e2e/` with a seeded room
- Fixture files: sample artifacts in problem-definition, market-analysis, solution-design
- Test: file an artifact, run full cascade, verify INFORMS, CONTRADICTS, CONVERGES, INVALIDATES edges appear in room.db with expected source/target/confidence
- Test: file a contradicting artifact, verify CONTRADICTS edge is created
- Test: file three convergent artifacts, verify CONVERGES edge fires above confidence threshold
- Runs via existing feynman test runner
- **This test is the acceptance gate for 87-03. If cascade refactor breaks it, refactor is rolled back.**
- Depends on: nothing. Wave 0.

### Wave 1 parallel (v1.10.11 release targets)

**87-01: Cypher sanitization + API key permissions + HSI timeout (P0 + P1 + P1)**
- sanitizeCypherInput(str) in brain-client.cjs, whitelist `[a-zA-Z0-9 ._-]`
- Apply to 5 Cypher interpolation sites
- checkFilePermissions() rejecting .env with group/world-read bits set
- HSI timeout 5000ms -> 30000ms in intelligence-cascade.cjs
- Tests: injection strips, permission rejects 0644, timeout is 30000
- Depends on: nothing. Wave 1.

**87-01a: ROOM.md + MINTO.md git hook installer (R7 mitigation -- NEW)**
- scripts/setup-hooks.sh -- installs .git/hooks/pre-commit with find-loop guard
- Session-start guard verifies installation and re-installs if absent
- CHANGELOG entry documents: the hook is NOT bypassed by --no-verify because session-start reinstalls it
- Tests: commit with missing ROOM.md fails, commit with both files passes, bypassing hook restores it on next session
- Depends on: nothing. Wave 1.

**87-02: Write lock atomic creation (P0 overstated but fix anyway)**
- fs.openSync(lockPath, 'wx') atomic; catch EEXIST, check staleness, retry
- 10-line change in write-lock.cjs
- Tests: concurrent acquireLock calls, only one succeeds
- Depends on: nothing. Wave 1.

**87-08: Localhost live dashboard /mos:dashboard live**
- scripts/serve-dashboard (~150 lines Node HTTP)
- Reads active room from .rooms/registry.json
- Calls generate-presentation.cjs ONCE for initial HTML
- http.createServer on port 3131 (configurable --port, 3131-3140 fallback)
- Watches room/ with fs.watch recursive
- Reads room.db directly via node:sqlite for typed edges
- SSE events on file changes
- Opens browser via platform.cjs (open/xdg-open/start)
- Wikilinks clickable; graph nodes clickable
- **Bind 127.0.0.1 ONLY, never 0.0.0.0** (risk mitigation from CONTEXT.md R2)
- Zero tokens for rendering
- De Stijl from templates/shared.css (exists)
- Tests: server starts, SSE fires on file touch, graph JSON matches room.db edges
- Depends on: nothing. Wave 1.

### Wave 2 parallel (v1.10.12 release targets)

**87-03: Cascade deduplication (P1 MAJOR, gated by 87-00)**
- Extract _runCascadeSteps(artifacts, options) shared between runCascade + queueCascade
- ~250 lines of duplication eliminated
- **ACCEPTANCE GATE: 87-00 e2e fixture tests MUST stay green after refactor**
- Tests: feynman suite + 87-00 cascade-e2e fixture
- Depends on: 87-00 (fixture) + 87-01 (HSI timeout in cascade). Wave 2.

**87-05: MCP input validation tightening (P1 MAJOR)**
- Zod .regex(/^[a-z0-9-]+$/) on section parameters in tool-router.cjs
- path.resolve(roomDir, section).startsWith(roomDir) traversal check
- Parsed-JSON structure validation for opportunity tool
- Tests: path traversal rejected, valid sections pass
- Depends on: nothing. Wave 2.

**87-06: indexArtifact transaction (P1)**
- BEGIN/COMMIT wrap on indexArtifact() INSERT body
- Merge with 87-02 write-lock atomic if same flow
- Tests: partial-failure rollback simulation
- Depends on: 87-02. Wave 2.

### Wave 3 parallel

**87-04: Sync/async split -- TWO ENTRY POINTS (R4 mitigation, REVISED)**
- **REVISED DESIGN: No env branching. No runtime guard. Two distinct files.**
- `lib/core/room-ops-sync.cjs` -- execSync calls, used by CLI hooks
- `lib/core/room-ops-async.cjs` -- execFile (async) calls, used by MCP tool-router
- Shared logic extracted to `lib/core/room-ops-shared.cjs` (pure functions, no I/O)
- Callers import the entry point that matches their contract
- Same pattern applied to state-ops and meeting-ops where needed
- Tests: MCP tools return promises; CLI hooks return synchronously
- Depends on: 87-03 (cascade call sites change). Wave 3.

**87-07: Brain session caching + LRU cache eviction (P1)**
- sessionCache Map with 5-minute TTL in brain-client.cjs callTool()
- Hand-rolled LRU (20 lines, doubly-linked list + Map) max 100 entries for lastHsiByRoom, batchQueues, analyzeRoomCache
- Tests: session reuse, LRU eviction at capacity
- Depends on: 87-03. Wave 3.

### Wave 4

**87-09: BYO API chat panel with Bearer token auth (R2 mitigation, REVISED)**
- **REVISED DESIGN: Bearer token exchange, not raw API key per request**
- `/api/auth/session` endpoint: browser POSTs {api_key} once, server returns {token, expires_in}
- `/api/room/chat` endpoint: accepts `Authorization: Bearer <token>` header, NOT api_key in body
- Server holds api_key in memory keyed by token, 30-minute TTL, cleared on server stop
- Origin header check: reject anything except `null`, `file://`, or `http://localhost:3131`
- CORS: strict allow-list to localhost origins only
- Zero-log policy enforced (keys never written to disk, never logged, no request body logging)
- Chat panel builds surgical context from room.db (57x pattern from lazygraph-chat-architecture.md):
  1. SQL query for relevant edges
  2. Read referenced artifacts (2-3K tokens)
  3. Read intelligence signals (0.5K tokens)
  4. Larry personality + room context + graph data
  5. Anthropic API call using held api_key
- Tests: raw api_key in /api/room/chat body rejected with 401; Bearer token flow succeeds; Origin header check rejects cross-origin; key never appears in server logs
- Depends on: 87-08 (needs the localhost server). Wave 4.

**87-09a: BYO chat Bearer token plumbing (R2 detail -- NEW)**
- Folded into 87-09 above. Listed separately to make the security work visible in the wave plan.
- Token generation: crypto.randomBytes(32).toString('hex')
- Token storage: Map<token, {api_key, expires_at}> in serve-dashboard memory
- Token cleanup: interval timer evicts expired tokens every 60s

**87-09b: Stakeholders table population verification (R6 mitigation -- NEW)**
- Before 87-09 ships, run: `SELECT COUNT(*) FROM stakeholders` against a representative room
- If count > 0: chat Pattern 3 (stakeholder attribution) ships as designed
- If count == 0: Pattern 3 returns early with "no stakeholder data yet" response instead of empty array; feature flagged off until Phase 84 work populates the table
- Documentation note in 87-09 CHANGELOG: "stakeholder attribution requires Phase 84 stakeholder extraction pipeline, verify populated before using"
- Tests: empty stakeholders returns graceful "no data" response, populated table returns edges
- Depends on: nothing. Runs during 87-09 development.

### Wave 5

**87-10: v1.10.11 release gate (Stream A + 87-08)**
- Create commands/dashboard.md for /mos:dashboard live | stop | open
- Cross-platform via platform.cjs
- Port conflict detection 3131-3140
- 5-gate release: CHANGELOG [1.10.11], plugin.json 1.10.11, package.json 1.10.11, git tag v1.10.11, marketplace.json ref pin
- CHANGELOG aggregates Stream A fixes + dashboard feature + ROOM/MINTO hook installer
- Tests: feynman suite green
- Depends on: 87-01, 87-01a, 87-02, 87-08. Wave 5.

**87-10-v2: v1.10.12 release gate (Stream B + 87-09)**
- CHANGELOG [1.10.12] aggregates cascade refactor, async split, MCP validation, transactions, Brain cache, LRU, BYO chat
- plugin.json 1.10.12, package.json 1.10.12, git tag v1.10.12, marketplace.json ref pin
- Tests: feynman + 87-00 cascade e2e + 87-09 bearer token flow
- Depends on: all Wave 2-4 plans. Wave 5 of v1.10.12.

## Wave Execution Plan

```
v1.10.11 RELEASE:
  Wave 0: 87-00 (cascade e2e fixture -- MUST ship before 87-03 can execute)
  Wave 1 (parallel): 87-01, 87-01a, 87-02, 87-08
  Wave 5a: 87-10 (v1.10.11 release gate)

v1.10.12 RELEASE:
  Wave 2 (parallel): 87-03 (gated by 87-00), 87-05, 87-06
  Wave 3 (parallel): 87-04 (two entry points), 87-07
  Wave 4: 87-09 + 87-09a + 87-09b
  Wave 5b: 87-10-v2 (v1.10.12 release gate)
```

Estimated total: 9-12 days across two releases (revised from original 5-6 days).

## Dependencies

- Depends on v1.10.10 shipped (DONE, commit a6ddd94, tag v1.10.10, marketplace pinned)
- Depends on Node 22.5+ floor (DONE since v1.10.9)
- Depends on room.db populated by intelligence cascade (DONE, Phase 84-05)
- Depends on templates/presentation/ existing (DONE, v1.0)
- Depends on lib/core/platform.cjs (DONE, Phase 85-01)
- No external tool dependencies

## Risks (updated post-audit)

1. **Cascade refactor (87-03) is gated by 87-00 e2e fixture.** If the fixture is incomplete or wrong, the refactor has no acceptance test. Mitigation: 87-00 must be a real integration test with seeded room, not a mock. PLAN-CHECK agent verifies fixture quality before 87-03 executes.

2. **Async split (87-04) eliminates env-guard footgun but requires caller audit.** Every callsite in lib/mcp/* must import room-ops-async. Every callsite in hooks/* must import room-ops-sync. Grep-audit is part of 87-04 verification.

3. **Dashboard server (87-08) binds 127.0.0.1 only.** Explicit refusal to bind 0.0.0.0 with a loud warning. Test asserts server startup fails if MOS_BIND_ALL env is set (prevents accidental exposure).

4. **BYO chat (87-09) Bearer token has a 30-minute TTL.** If a user leaves the browser open overnight, token expires and first chat request after reload fails. UX mitigation: browser-side silently re-posts api_key to /api/auth/session on 401 to get a new token. Api_key lives in browser sessionStorage only (cleared on tab close), not localStorage.

5. **ROOM.md + MINTO.md hook (87-01a) can still be bypassed by --no-verify on a single commit, but session-start reinstalls.** This is the best available without enforcing server-side checks at push time. Document limitation in 87-01a CHANGELOG.

6. **Stakeholders table may be empty on existing rooms.** 87-09b handles this with graceful degradation, but chat Pattern 3 is feature-flagged-off for rooms without populated stakeholder data. Users asking "who said what" get "stakeholder extraction hasn't run on this room yet" instead of fabricated attributions.

## Success Criteria

**v1.10.11:**
1. `grep -rn "\${.*}" lib/core/brain-client.cjs` returns zero hits in Cypher-building functions
2. `node lib/memory/run-feynman-tests.cjs` exits 0
3. `/mos:dashboard live` opens browser at localhost:3131 within 2 seconds
4. Filing an artifact updates the browser within 1 second via SSE
5. git pre-commit hook refuses commits missing ROOM.md or MINTO.md
6. 5-gate release: CHANGELOG 1.10.11, plugin.json 1.10.11, package.json 1.10.11, git tag v1.10.11, marketplace pin

**v1.10.12:**
7. 87-00 cascade e2e fixture green before AND after 87-03 refactor
8. lib/core/room-ops-sync.cjs and lib/core/room-ops-async.cjs both exist, no env branching in production code
9. BYO chat /api/room/chat rejects raw api_key in body (401), accepts Bearer token
10. BYO api_key never appears in server logs (grep server logs for api_key prefix returns zero)
11. Chat context injection under 5K tokens for typical query (57x ratio holds)
12. Feynman + cascade-e2e + bearer-token tests all green
13. 5-gate release: CHANGELOG 1.10.12, plugin.json 1.10.12, package.json 1.10.12, git tag v1.10.12, marketplace pin

## Out of Scope (v1.12+ or other phases)

- Chrome extension (Phase 90+ or later)
- Discord/Zulip integration (Phase 90 candidate)
- Goose extension (Phase 91 candidate)
- Quarto export (separate phase)
- Operational buttons Tier v2/v3 (Phase 92+ once RemoteTrigger stabilizes)
- TypeScript migration (values disagreement, not a bug)
- Node 20 LTS fallback (deliberate from Phase 85)
- Mobile PWA
- Multi-room portfolio view

## Canonical References (MANDATORY -- downstream agents MUST read)

### Security + review provenance
- `.planning/phases/87-security-hardening-cascade-refactor/87-CONTEXT.md` (this doc)
- `.planning/phases/85-windows-hotfix-v1.10.9/85-CONTEXT.md` (predecessor)
- External code review (2026-04-16) -- summary table folded into this CONTEXT

### Dashboard + chat architecture
- `.planning/research/ui-ux-pathways/phase-86-localhost-spec.md` -- localhost server spec folded into 87-08
- `.planning/research/ui-ux-pathways/lazygraph-chat-architecture.md` -- 57x SQL-targeted context pattern for 87-09
- `.planning/research/ui-ux-pathways/architecture-vision.md` -- full bidirectional control surface rationale
- `.planning/research/ui-ux-pathways/byo-api-and-surfaces.md` -- API surface design
- `.planning/research/ui-ux-pathways/token-economics.md` -- zero-token rendering math
- `.planning/research/ui-ux-pathways/alternatives-considered.md` -- why Node HTTP, not Electron/Quarto/Tauri

### ICM / architectural invariants
- `CLAUDE.md` decision #15 -- every directory gets ROOM.md
- `docs/MWP-SPECIFICATION.md` -- 7-layer protocol
- `docs/MOAT-MANDATE.md` -- what deepens moat vs adds surface area

### Related future work (for scope boundary clarity)
- `.planning/research/ui-ux-pathways/phase-87-operational-buttons.md` -- v2/v3 buttons OUT of this phase
- `.planning/research/ui-ux-pathways/skill-offer-engine.md` -- Phase 88 (after v1.10.12), R5 triangulation concern tracked there
- `.planning/research/ui-ux-pathways/goose-extension-path.md` -- Phase 91 candidate
- `.planning/phases/89-reverse-salient-engine/PLAN.md` -- Phase 89 (renamed from 88 on 2026-04-19)

---

*Phase: 87-security-hardening-cascade-refactor*
*Context gathered: 2026-04-16*
*Audit revision: 2026-04-19 (R1-R7 folded, split locked)*
*Ready for: /gsd:plan-phase 87*
