---
phase: 87-security-hardening-cascade-refactor
plan: 05
subsystem: security
tags: [mcp, zod, path-traversal, input-validation, cascade-03, cascade-05]

# Dependency graph
requires:
  - phase: 87-00
    provides: cascade-e2e fixture baseline (unchanged by this plan, must stay green)
  - phase: 87-03
    provides: _runCascadeSteps shared helper (cascade dedup baseline under which MCP validation lands)
provides:
  - SECTION_RE Zod regex /^[a-z0-9-]+$/ shared across 5 router tools
  - sectionOptional / sectionRequired Zod schemas (single source of truth)
  - safeResolveSection(roomDir, section) path-traversal guard at fs boundary
  - opportunitySchema explicit Zod validation of file-opportunity JSON payload
  - module.exports._test block exposing primitives for unit tests
  - mcp-input-validation.test.cjs (35 assertions, registered in feynman runner)
affects: [87-06 indexArtifact transaction, 87-09 BYO chat endpoints (reuses validation patterns), future MCP tools that accept section parameter]

# Tech tracking
tech-stack:
  added: []  # Zero new runtime dependencies. Zod was already in tree for MCP SDK.
  patterns:
    - Shared schema constant pattern (define once near top, reuse at every tool site)
    - Defense-in-depth traversal guard (Zod regex at edge + path.resolve check at I/O boundary)
    - _test export block for unit tests without expanding public surface
    - passthrough() on payload schemas to preserve downstream-consumed fields

key-files:
  created:
    - lib/memory/mcp-input-validation.test.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "Shared sectionOptional/sectionRequired schema constants replace 5 duplicated inline z.string().optional() sites; single definition eliminates drift"
  - "safeResolveSection() is defense-in-depth: complements Zod regex at the MCP edge with a second check at the fs I/O boundary, so any future code path that bypasses the Zod layer is still protected"
  - "opportunitySchema uses passthrough() so opportunity-ops.cjs can continue reading dynamic fields (source_url, opportunity_id, relevance_reasoning, etc.) without re-listing every field here; only the human-facing title and bounded numeric/string fields are strictly validated"
  - "Test export block via module.exports._test keeps the three primitives accessible to unit tests without polluting registerRouterTools' public API"
  - "Scope discipline: 4 other optional string params at 755, 785, 836, 873 (note, context, room, format in meeting/intelligence/export/orchestration) are NOT section parameters and are out of scope per plan"

patterns-established:
  - "Zod schema-as-constant: define sectionOptional once, reuse via section: sectionOptional at every tool site. Applies to any parameter shape that appears across multiple MCP tools."
  - "safeResolve{Param}(base, input) helper: every handler that composes a filesystem path from user input calls a named guard that uses path.resolve + startsWith. Becomes the template for any future user-input-derived path."
  - "Defense-in-depth: Zod regex at the protocol edge + I/O-boundary guard. Two independent checks at two different layers. Either one blocks the attack; both must pass for access."

requirements-completed: [CASCADE-03, CASCADE-05]

# Metrics
duration: 8min
completed: 2026-04-19
---

# Phase 87 Plan 05: MCP Input Validation Tightening Summary

**Zod regex /^[a-z0-9-]+$/ on 5 section sites + safeResolveSection path-traversal guard + explicit opportunitySchema JSON validation close CASCADE-03 and CASCADE-05.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-19T18:30:01Z
- **Completed:** 2026-04-19T18:37:58Z
- **Tasks:** 2 (both with TDD: RED + GREEN)
- **Files modified:** 3 (1 source, 1 test runner, 1 new test file)

## Accomplishments

- Eliminated all 5 loose `section: z.string().optional()` schemas in tool-router.cjs and replaced them with a single shared `sectionOptional` Zod schema that enforces `/^[a-z0-9-]+$/`.
- Added `safeResolveSection(roomDir, section)` defense-in-depth guard at the fs I/O boundary. Rejects `../../etc`, `../../..`, absolute-path injections (`/etc/passwd`) with a clear "section path traversal rejected" error.
- Added explicit `opportunitySchema` Zod validation to the file-opportunity tool handler. Payloads missing title, with empty title, with non-string title, with over-length title, or non-object payloads are now rejected at the edge before reaching opportunity-ops.
- Exposed the three primitives via `module.exports._test` for unit testing without expanding the public `registerRouterTools` surface.
- New test file `lib/memory/mcp-input-validation.test.cjs` with 35 assertions across 4 primitive groups. Registered in the feynman runner, now 23/23 green (was 22/22).

## Task Commits

Each task was committed atomically per TDD sequence:

1. **Task 5-1 RED: failing test for validation primitives** - `5401317` (test)
2. **Task 5-1 GREEN: MCP input validation + Zod regex + traversal guard + opportunity schema** - `ab20d38` (feat)
3. **Task 5-2: register mcp-input-validation in feynman runner** - `0516462` (test)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `lib/mcp/tool-router.cjs` - Added SECTION_RE constant, sectionOptional/sectionRequired shared Zod schemas, safeResolveSection() helper, opportunitySchema with passthrough, file-opportunity handler now validates payload via schema.parse before reaching opportunity-ops, visualize-chain reasonDir composition routed through safeResolveSection, module.exports._test block at end of file.
- `lib/memory/mcp-input-validation.test.cjs` - NEW. 35 assertions: SECTION_RE shape tests (valid + invalid including Unicode U+0000), sectionOptional Zod schema round-trip, safeResolveSection traversal + valid + null/undefined, opportunitySchema accept + reject.
- `lib/memory/run-feynman-tests.cjs` - Appended mcp-input-validation.test.cjs to TEST_FILES so the 35 validation assertions run in the standard suite.

## Section Sites Patched (5 of 5)

Verified by `grep -n "section: sectionOptional" lib/mcp/tool-router.cjs` - exactly 5 sites:

| Original line | Tool | Parameter context |
|---|---|---|
| 255 | `room_state` | Section name for section-specific operations |
| 304 | `room_content` | Section name or JSON data for operations |
| 445 | `room_graph` | Section name, file path, SQL query, or JSON params |
| 660 | `methodology` | Section to focus on |
| 705 | `analysis` | Section to focus on |

The 4 other optional string parameters at lines 755 (context), 785 (context), 836 (context/format), 873 (context/room) are NOT `section` parameters and are explicitly out of scope per plan frontmatter.

## Path-Composition Sites Rewritten

- **visualize-chain reasonDir composition** (was line 614, now line ~685): previously `rpath.join(rpath.resolve(roomDir), section, '.reasoning')`. Now goes through `safeResolveSection(roomDir, section)` first, then joins `.reasoning`. Any traversal in `section` throws before fs.existsSync/readdirSync is called.

## Opportunity Schema Fields Enforced

- `title: string(1..500)` -- REQUIRED, primary human-facing field used by opportunity-ops slug generation
- `program: string(0..500)?` -- funder program name, fallback for slug
- `funder: string(0..500)?` -- funding organization
- `source: string(0..200)?` -- data origin (grants.gov, manual, etc.)
- `source_url: string(0..2000)?` -- optional full URL (2000 chars = browser URL max)
- `opportunity_id: string(0..200)?` -- upstream system ID
- `domain: string(0..200)?` -- venture domain
- `deadline: string(0..50)?` -- ISO date or free-text deadline
- `amount / amount_floor / amount_ceiling: number(>=0)?` -- dollar amounts non-negative
- `relevance_score / confidence: number(0..1)?` -- bounded probability fields
- `relevance_reasoning: string(0..5000)?` -- human rationale
- `.passthrough()` on the schema preserves any additional fields opportunity-ops.cjs may read dynamically without breaking callers that include extra context.

## Acceptance Criteria

Plan verification:

| Criterion | Target | Actual | Status |
|---|---|---|---|
| `grep -c "section: z.string().optional()"` | 0 | 0 | PASS |
| `grep -c "sectionOptional\|safeResolveSection\|opportunitySchema"` | >= 7 | 16 | PASS |
| `node lib/memory/mcp-input-validation.test.cjs` exit | 0 | 0 (35/35) | PASS |
| `node lib/memory/run-feynman-tests.cjs` exit | 0 | 0 (23/23) | PASS |
| MCP handlers reject invalid sections | yes | yes (via sectionOptional regex) | PASS |
| MCP handlers reject path traversal | yes | yes (via safeResolveSection) | PASS |

Task 5-1 acceptance criteria:

| Criterion | Target | Actual |
|---|---|---|
| `grep -c "section: z.string().optional()"` | 0 | 0 |
| `grep -c "sectionOptional"` | >= 5 | 7 |
| `grep -c "SECTION_RE"` | >= 1 | 7 |
| `grep -c "safeResolveSection"` | >= 2 | 5 |
| `grep -c "startsWith"` | >= 1 | 3 |
| `grep -c "opportunitySchema"` | >= 2 | 4 |
| `node -e "require('./lib/mcp/tool-router.cjs')"` | exit 0 | exit 0 |

Task 5-2 acceptance criteria:

| Criterion | Target | Actual |
|---|---|---|
| `node lib/memory/mcp-input-validation.test.cjs` exit 0 | pass | pass |
| `node lib/memory/run-feynman-tests.cjs` exit 0 | pass | pass (23/23) |
| `grep -c "traversal rejected" lib/memory/mcp-input-validation.test.cjs` | >= 1 | 4 |
| `grep -c "SECTION_RE|safeResolveSection|opportunitySchema" lib/memory/mcp-input-validation.test.cjs` | >= 3 | 74 |
| `grep -c "module.exports._test" lib/mcp/tool-router.cjs` | >= 1 | 2 |

## Decisions Made

- **Defense-in-depth at two layers.** Zod regex blocks malformed input at the MCP protocol edge. safeResolveSection blocks path escapes at the fs I/O boundary. Either layer alone would catch the common attack; both layers together mean a bypass of one does not leak through the other. This is the discipline CASCADE-03 required.
- **Shared schema constants over inline duplicates.** The 5 previously-inline `z.string().optional()` calls became a single `sectionOptional`. Any future section tightening (longer minimum length, extended charset, etc.) is now a one-line change at the top of the file, not 5 synchronized edits.
- **opportunitySchema.passthrough() over strict whitelist.** opportunity-ops.cjs reads many fields dynamically; a strict schema would break every caller who supplies extra context. Passthrough enforces the critical invariants (title required, amounts non-negative, scores bounded) while leaving room for extension.
- **Scope discipline on other optional string params.** The plan explicitly scopes to the 5 `section` sites. Tightening the 4 other params (note, context, room, format) would be valuable but they're NOT section parameters (different semantics, different charsets, different attack surface). Deferred by design.

## Deviations from Plan

None - plan executed exactly as written. TDD cycle completed without auto-fixes or blocking issues.

## Issues Encountered

None. Module loaded cleanly on first try after the Edit. 35 test assertions all passed on first GREEN run.

## User Setup Required

None - no external service configuration required. Internal code hardening only.

## Next Phase Readiness

- 87-06 indexArtifact transaction can proceed without coupling to this plan (both live in Wave 2).
- 87-09 BYO chat will reuse the `opportunitySchema.passthrough()` + safe-resolve pattern for its Bearer token validation and chat context endpoints.
- v1.10.12 Wave 2 security stream: 2 of 3 plans done (87-03 cascade dedup + 87-05 MCP validation). Next: 87-06 transaction safety.

## CHANGELOG Line for v1.10.12

```markdown
### Security
- MCP tool-router now validates every `section` parameter against Zod regex `/^[a-z0-9-]+$/` and routes section-derived paths through a path-traversal guard. File-opportunity payloads validated by explicit Zod schema instead of accepted raw. (CASCADE-03, CASCADE-05)
```

## Self-Check

File existence verified:
- lib/mcp/tool-router.cjs: FOUND
- lib/memory/mcp-input-validation.test.cjs: FOUND
- lib/memory/run-feynman-tests.cjs: FOUND

Commit hashes verified on main:
- 5401317 (RED test): FOUND
- ab20d38 (GREEN implementation): FOUND
- 0516462 (runner registration): FOUND

Test runs verified:
- mcp-input-validation.test.cjs: 35 passed, 0 failed, exit 0
- run-feynman-tests.cjs: 23/23 passed, 0 skipped, 0 failed, exit 0

## Self-Check: PASSED

---
*Phase: 87-security-hardening-cascade-refactor*
*Plan: 05 (Wave 2 of v1.10.12)*
*Completed: 2026-04-19*
*Requirements closed: CASCADE-03, CASCADE-05*
