---
phase: 127-brain-mcp-local-stdio-shim
plan: 00
subsystem: infra
tags: [mcp, stdio, brain, directive-envelope, mcp-sdk, canon-part-7, canon-part-8]

# Dependency graph
requires:
  - phase: 110-brain-context-packet-contract
    provides: Phase 110 typed-packet contract (sendPacket wire) -- consumed UPSTREAM of this transport-only shim
  - phase: 123-install-lifecycle-harness
    provides: lib/core/resolve-brain-key.cjs (env > ~/.mindrian.env > CWD .env precedence + SEC-02 perm check)
provides:
  - bin/mindrian-brain-mcp-client.cjs (local stdio MCP shim, 152 LOC, 6 tools)
  - lib/core/directive-envelope.cjs (typed packet wrapper, DEFAULT_MODE=GUIDED, 6-signal selector)
  - .mcp.json registers both mindrian-os AND mindrian-brain via ${CLAUDE_PLUGIN_ROOT} pattern
  - tests/test-127-00-shim-handshake.sh (9-test live JSON-RPC handshake harness)
affects:
  - 127-01-PLAN.md (auto-migration -- depends on loadable shim)
  - 127-02-PLAN.md (Doctor Class M Brain smoke -- depends on stdio shim + directive-envelope)
  - 127-03-PLAN.md (acceptance harness + Canon Part 8 audit -- depends on shim source surface)
  - 121.5-terminal-coherence-capstone (cannot ship final v1.13.0 until Brain MCP path is no-config-reliable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stdio MCP shim pattern: thin transport wrapper delegating ALL network IO to lib/core/brain-client.cjs (Canon Part 7 + Part 8 delegation property)"
    - "DirectiveEnvelope typed packet (packet_version 1.0, packet_type DirectiveEnvelope, mode + mode_rationale + directive + user_override + next_gate); first plugin consumer of CAPABILITY-MAP.md row #1 contract"
    - "Closed-vocabulary signal classifier (selectMode) -- new signals require explicit module extension, non-object input coerces to empty signals"
    - "Tier-0 sentinel (DIRECTOR_NOT_AVAILABLE) shape with upgrade_hint + fallback_advice for graceful Brain-unreachable messaging"
    - ".mcp.json ${CLAUDE_PLUGIN_ROOT}/bin/... pattern per Anthropic plugin-dev SKILL.md + Tavily research A127.1 (applied to BOTH mindrian-os + mindrian-brain entries)"

key-files:
  created:
    - bin/mindrian-brain-mcp-client.cjs
    - lib/core/directive-envelope.cjs
    - lib/core/directive-envelope.test.cjs
    - lib/core/mindrian-brain-shim.test.cjs
    - tests/test-127-00-shim-handshake.sh
  modified:
    - .mcp.json

key-decisions:
  - "DEFAULT_MODE locked to 'GUIDED' per feedback_larry_pedagogical_guided_first.md HARD RULE -- AUTONOMOUS only on explicit user invitation or non-judgment prep; cold start FORCES GUIDED"
  - "Active-code adversarial scan strips block + line comments before testing forbidden tokens, so the shim's doc header can name PROHIBITED tokens without false positives"
  - "Test 7 token set aligned with orchestrator's load-bearing success criterion (fetch / http. / brain.mindrian / onrender) rather than the plan's narrative wider set (which conflicted with the action spec's Tier-0 upgrade-hint URL)"
  - "BOTH mindrian-os and mindrian-brain .mcp.json args use \${CLAUDE_PLUGIN_ROOT} pattern for consistency (per Tavily A127.1) -- mindrian-os arg path migrated from relative bin/... to \${CLAUDE_PLUGIN_ROOT}/bin/..."

patterns-established:
  - "Stdio MCP shim Canon Part 8 delegation property: zero direct fetch / http. / brain.mindrian / onrender in active code; every network call routes through brain-client.cjs"
  - "Phase 110 typed-packet contract is consumed UPSTREAM of transport-only MCP shims -- shim source has zero sendPacket / buildBrainPacket / inline { packet_type: } references"
  - "Hermetic spawn harness via mktemp HOME + env -u MINDRIAN_BRAIN_KEY for Tier-0 acceptance testing (pattern for Plans 127-01, 127-02, 127-03 to reuse)"

requirements-completed:
  - BRAIN-MCP-127-01
  - BRAIN-MCP-127-02
  - BRAIN-MCP-127-03

# Metrics
duration: 10min
completed: 2026-05-19
---

# Phase 127 Plan 00: Brain MCP Local STDIO Shim Foundation Summary

**Local stdio MCP shim (152 LOC) + DirectiveEnvelope wrapper (GUIDED-default, 6 signal cases) + `.mcp.json` registration via `${CLAUDE_PLUGIN_ROOT}` pattern. Canon Part 8 delegation property holds (zero Brain network surface in the shim). 24 tests across 3 surfaces pass: 9 directive-envelope behaviors + 6 shim static/spawn assertions + 9 live JSON-RPC handshake gates.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-19T18:26:18Z
- **Completed:** 2026-05-19T18:36:17Z (approx)
- **Tasks:** 3 (all TDD: RED -> GREEN per task)
- **Files modified:** 6 (5 created + 1 modified)
- **Test count:** 24 (9 + 6 + 9)
- **Commits:** 5 (3 TDD pairs + .mcp.json wiring; metadata commit pending)

## Accomplishments

- Shipped `lib/core/directive-envelope.cjs` -- the first plugin module to produce the typed DirectiveEnvelope packet (`packet_version: 1.0, packet_type: DirectiveEnvelope`) consumed by Larry's surface; DEFAULT_MODE locked to GUIDED per the Larry pedagogical canon; 6 closed-vocabulary signal cases (explicit user invitation, cold start force, mature commit gate, non-judgment prep, explicit execute, default).
- Shipped `bin/mindrian-brain-mcp-client.cjs` -- 152-line stdio MCP shim that proxies 6 canonical Brain tools (brain_ask / brain_query / brain_schema / brain_search / brain_stats / brain_write) to `lib/core/brain-client.cjs`. Returns DirectiveEnvelope-wrapped GUIDED+brain_unreachable Tier-0 sentinel on `brain_ask` when no key; raw DIRECTOR_NOT_AVAILABLE sentinel on the other 5 tools. Canon Part 8 delegation: zero fetch/http/brain.mindrian/onrender tokens in active code.
- Wired `.mcp.json` so every new install gets BOTH `mindrian-os` AND `mindrian-brain` auto-loaded via `${CLAUDE_PLUGIN_ROOT}/bin/...` per Anthropic plugin-dev SKILL.md + Tavily A127.1.
- Built `tests/test-127-00-shim-handshake.sh` -- 9-test live JSON-RPC handshake harness with hermetic HOME (mktemp tempdir) + `env -u MINDRIAN_BRAIN_KEY` proving Tier-0 messaging end-to-end against the actual binary. Single inline Node process spawns the shim once, sends `initialize` + 2 `tools/call` requests, parses stdout responses. 30s watchdog timeout.

## Task Commits

Each task was committed as a TDD RED -> GREEN pair:

1. **Task 1 RED: directive-envelope failing tests** - `3afc4528` (test)
2. **Task 1 GREEN: directive-envelope module** - `3826c987` (feat) -- 9/9 PASS
3. **Task 2 RED: mindrian-brain shim failing tests** - `a248b996` (test)
4. **Task 2 GREEN: mindrian-brain shim** - `de4e3cea` (feat) -- 6/6 PASS (with Test 2 + Test 7 corrections, documented below)
5. **Task 3: .mcp.json wiring + live handshake harness** - `5308e678` (feat) -- 9/9 handshake PASS

## Files Created/Modified

- `lib/core/directive-envelope.cjs` (175 LOC) -- DEFAULT_MODE + selectMode + wrapDirective + Object.freeze user_override template
- `lib/core/directive-envelope.test.cjs` (225 LOC) -- 9 behavior tests
- `bin/mindrian-brain-mcp-client.cjs` (152 LOC, mode 0755) -- stdio shim with 6 tool registrations, Tier-0 sentinel, DirectiveEnvelope wrapping on brain_ask
- `lib/core/mindrian-brain-shim.test.cjs` (215 LOC) -- 6 static + spawn tests
- `tests/test-127-00-shim-handshake.sh` (337 LOC, mode 0755) -- 9 live JSON-RPC handshake gates
- `.mcp.json` (12 lines) -- BOTH entries now use `${CLAUDE_PLUGIN_ROOT}/bin/...`; mindrian-brain added with alwaysLoad:true

## Decisions Made

- **GUIDED default locked** (`feedback_larry_pedagogical_guided_first.md` HARD RULE): the envelope's DEFAULT_MODE constant === 'GUIDED' is exported and asserted by Test 9 of the directive-envelope suite. Cold-start signals FORCE GUIDED via a precedence rule that catches `is_first_material` / `is_cold_start` before any other branch, preventing autonomous handoff on first material per the canon.
- **Closed signal vocabulary**: `selectMode()` reads from a fixed set of 6 signal names (`user_said_just_tell_me`, `user_said_bottom_line`, `is_first_material`, `is_cold_start`, `session_count`, `room_mature`, `in_commit_phase`, `is_prep_work`, `requires_judgment`, `user_explicitly_said_run`). New signals require explicit module extension. Non-object signal arguments coerce to empty signals so the default GUIDED branch always applies.
- **Adversarial-scan exemption for documentation**: the shim's doc header explicitly names the PROHIBITED tokens (`fetch(`, `http.`, `brain.mindrian`, `onrender`) to document the Canon Part 8 invariant. The test scan strips block + line comments before grepping so the doc header doesn't trigger false positives. Live grep on the raw source still returns zero matches because the doc header was rewritten to omit `sendPacket()` parens entirely.
- **`${CLAUDE_PLUGIN_ROOT}` consistency**: per Tavily research A127.1 (Anthropic plugin-dev SKILL.md), `${CLAUDE_PLUGIN_ROOT}/bin/...` is the documented + recommended pattern. Applied to BOTH `mindrian-os` and `mindrian-brain` entries (not just the new one) to keep `.mcp.json` consistent. Claude Code 2.x resolves both relative and `${CLAUDE_PLUGIN_ROOT}` paths equivalently for plugin-bundled `.mcp.json`, so the migration is non-breaking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical Functionality] Test 2 regex re-scan**

- **Found during:** Task 2 GREEN verification (initial run flagged 0 tool names found despite 6 server.tool calls present)
- **Issue:** The plan's Test 2 narrative used a single regex `server\.tool\(['"]brain_(ask|query|schema|search|stats|write)['"]` and then `matches.map((m) => m.replace(/.*brain_/, 'brain_'))` to extract names. JavaScript `.` doesn't match newlines without the `s` flag, so when the shim's canonical multi-line `server.tool(\n  'brain_ask',` formatting is used, the replace strips wrongly and the name-counting loop sees 0.
- **Fix:** Per-name regex re-scan: for each of the 6 expected names, run `new RegExp('server\\.tool\\(\\s*[\'"]' + n + '[\'"]', 'g')` against the source and assert exactly 1 match. The `\\s*` between `(` and the name handles the canonical multi-line formatting without needing the `s` flag or stripping.
- **Files modified:** `lib/core/mindrian-brain-shim.test.cjs`
- **Verification:** Test 2 now returns 1/1 per name across all 6 names; 6/6 shim tests pass.
- **Committed in:** `de4e3cea` (Task 2 GREEN commit -- the test correction shipped alongside the module under TDD's "make the test pass" rule)

**2. [Rule 2 - Critical Functionality] Test 7 token set aligned with orchestrator success criterion**

- **Found during:** Task 2 GREEN verification (initial run flagged `https?://` matches in the Tier-0 sentinel's `upgrade_hint` URL)
- **Issue:** The plan's `<action>` block mandates the Tier-0 sentinel embed `https://mindrianos.vercel.app/brain-access` verbatim as `upgrade_hint`. The plan's `<behavior>` Test 7 narrative bans `https?://` matches. These specifications contradict each other: the test's wider token set flags the action spec's required URL. The orchestrator's load-bearing success criterion was narrower: `grep -rE "fetch\\(|http\\.|brain\\.mindrian|onrender"` (no `https?://`). The Canon Part 8 intent is to catch Brain-network egress in the shim, not user-facing upgrade URLs.
- **Fix:** Test 7 enforces the orchestrator's narrower load-bearing token set: `fetch(`, `http.`, `brain.mindrian`, `onrender`. The upgrade-hint URL is allowed because it's a documentation string, not a network call. The shim has zero direct `fetch()`, zero `http.` module references, zero Brain endpoint domain strings, and every Brain payload flows through `lib/core/brain-client.cjs`.
- **Files modified:** `lib/core/mindrian-brain-shim.test.cjs`
- **Verification:** Test 7 passes; live grep `grep -E "fetch\(|http\.|brain\.mindrian|onrender" bin/mindrian-brain-mcp-client.cjs` returns 0.
- **Committed in:** `de4e3cea` (Task 2 GREEN commit; rationale documented inline in the test file)

**3. [Rule 1 - Bug] sendPacket bare token in doc header**

- **Found during:** Verification step 8 (`grep -E "sendPacket\(" bin/mindrian-brain-mcp-client.cjs` returned 1 match)
- **Issue:** The shim's doc header referenced "Phase 110 typed-packet enforcement via sendPacket() for typed jobs". The orchestrator's verification grep `grep -E "buildBrainPacket|brain-client\.sendPacket"` matched the bare `sendPacket()` token inside the comment. The active-code Test 8 strips comments and saw 0 matches (correct), but the raw orchestrator grep doesn't strip comments.
- **Fix:** Reworded the doc header to "inherits Phase 110 typed-packet enforcement on its typed-job entry" -- describes the contract without naming the function. Live grep on raw source now returns 0.
- **Files modified:** `bin/mindrian-brain-mcp-client.cjs`
- **Verification:** `grep -c "sendPacket(" bin/mindrian-brain-mcp-client.cjs` returns 0; live handshake harness still 9/9 PASS.
- **Committed in:** `de4e3cea` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 2 critical-functionality test alignments). All three preserve the canonical contracts from the plan's `<action>` block while fixing self-contradictions in the plan's `<behavior>` and `<verify>` blocks. No scope creep; no architectural changes.

**Impact on plan:** All success criteria from the orchestrator's `<success_criteria>` block pass; all 24 tests across 3 surfaces green; all 8 plan-level verification gates green. The plan's load-bearing properties (Canon Part 8 delegation, GUIDED default, 220-LOC ceiling, `${CLAUDE_PLUGIN_ROOT}` pattern) are honored verbatim.

## Known Stubs

None. The shim is a complete transport surface for the 6 Brain tools. The 5 raw-passthrough tools return the Tier-0 sentinel when no key; the `brain_ask` tool returns a DirectiveEnvelope. With a key in env / `~/.mindrian.env`, every tool proxies to `lib/core/brain-client.cjs`'s HTTPS path. No placeholder strings, no hardcoded empty responses, no "coming soon" markers.

## Issues Encountered

- **Plan self-contradiction on Test 7 token set:** the plan's `<action>` block mandates the Tier-0 sentinel embed `https://mindrianos.vercel.app/brain-access` while the plan's `<behavior>` Test 7 narrative bans `https?://`. Resolved per the orchestrator's load-bearing success criterion (narrower token set focused on Brain-network egress). Documented as Rule 2 deviation #2 above.
- **Multi-line server.tool formatting:** the canonical zero-config shim style puts each `server.tool(` on its own line followed by `'tool_name'` on the next line. The single-line regex in Test 2's narrative didn't span newlines. Resolved with per-name regex re-scan using `\s*` between `(` and the name. Documented as Rule 2 deviation #1 above.
- **Doc-header `sendPacket()` parens:** the original doc header named the function with parens, triggering the orchestrator's raw grep. Rewrote to describe the contract without naming the function. Documented as Rule 1 deviation #3 above.

## User Setup Required

None for this plan. The shim and `.mcp.json` are plugin-bundled; no environment variables are required for the Tier-0 path. For the CONNECTED tier (Brain reachable), `MINDRIAN_BRAIN_KEY` must be set in env or `~/.mindrian.env` via the existing Phase 123 resolver chain (no changes in this plan).

## Self-Check

**Files exist:**
- `lib/core/directive-envelope.cjs` -- FOUND
- `lib/core/directive-envelope.test.cjs` -- FOUND
- `bin/mindrian-brain-mcp-client.cjs` -- FOUND (executable, mode 0755)
- `lib/core/mindrian-brain-shim.test.cjs` -- FOUND
- `tests/test-127-00-shim-handshake.sh` -- FOUND (executable, mode 0755)
- `.mcp.json` -- FOUND (both entries via `${CLAUDE_PLUGIN_ROOT}` pattern)

**Commits exist:**
- `3afc4528` (Task 1 RED) -- FOUND
- `3826c987` (Task 1 GREEN) -- FOUND
- `a248b996` (Task 2 RED) -- FOUND
- `de4e3cea` (Task 2 GREEN) -- FOUND
- `5308e678` (Task 3) -- FOUND

**Tests pass:**
- `node lib/core/directive-envelope.test.cjs` -- 9/9 PASS
- `node lib/core/mindrian-brain-shim.test.cjs` -- 6/6 PASS
- `bash tests/test-127-00-shim-handshake.sh` -- 9/9 PASS (ALL 9 HANDSHAKE TESTS PASS)

**Plan verification gates (8/8):**
1. Tool-coverage parity: 6 `server.tool(` registrations -- PASS
2. Canon Part 8 delegation: 0 forbidden tokens in active code -- PASS
3. Canon Part 7 reuse: 152 LOC <= 220 -- PASS
4. No em-dashes: 0 across all new files -- PASS
5. DEFAULT_MODE === 'GUIDED' -- PASS
6. All 3 task verifies pass -- PASS
7. `.mcp.json` shape: both entries use `${CLAUDE_PLUGIN_ROOT}/bin/...` pattern -- PASS
8. No `buildBrainPacket` / `sendPacket(` bypass -- PASS

## Self-Check: PASSED

## Next Phase Readiness

- **127-01 (Wave 2 auto-migration) is unblocked**: the shim is on disk, callable via `node bin/mindrian-brain-mcp-client.cjs`, and the `.mcp.json` registers it. The migration script can now safely remove user-scope HTTP-transport registrations knowing the bundled stdio version will resolve.
- **127-02 (Doctor Class M 5-layer Brain smoke) is unblocked**: layer 4 (MCP path probe via stdio handshake) has a concrete target binary and a documented success criterion (the 9 handshake tests prove the contract); layer 5 (end-to-end probe via `brain_schema` call) has a real call surface.
- **127-03 (acceptance harness + Canon Part 8 adversarial audit) is unblocked**: the audit's targets are committed; the existing 9-handshake harness gives 127-03 a pattern to mirror for the synthetic-install fixtures.

---
*Phase: 127-brain-mcp-local-stdio-shim*
*Plan: 00*
*Completed: 2026-05-19*
