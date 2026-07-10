---
phase: 212-eureka-substrate-grounding-guard
plan: 03
subsystem: eureka
tags: [eureka, critic, mcp, part8, cirs, d5, boundary-scan, thin-wrapper]

# Dependency graph
requires:
  - phase: 212-02
    provides: "lib/core/eureka-critic.cjs criticRule (the pure payload-only ruling this plan wraps unmodified) + loadCriticTags closed domain-tag enum + surprise_type enum"
  - phase: 198-04
    provides: "the born-wired MCP-tool connector-discovery gate (MCP_TOOL_CONNECTORS/tools projection) this tool proves no-drift against"
provides:
  - "eureka_critic MCP tool: a thin wrapper on lib/mcp/tool-router.cjs (the existing governed surface), scalars+closed-enums in, {verdict, confidence(coarse), reasoning_tag} out"
  - "Closed D1 zod schema: 6 scalar/enum fields + rubric_pattern (regex-bound) + schema_version; no bare z.string (D1/D3b, sycophancy channel stays closed)"
  - "Wrapper-side dedupe (sha256 canonical-JSON, EUREKA_CRITIC_DEDUPE_TTL_MS) + per-process rolling-minute rate-limit (EUREKA_CRITIC_RATE_LIMIT) (D3b item 4)"
  - "tests/test-212-part8-boundary.cjs: the D7(c) Part 8 boundary scan + D7(d) D5 per-call-resolution check (6 checks, reuses the connector-part8 idiom)"
affects: [212-04 gold-cards, 212-05 calibration, 213 eureka-reach, SEED-014 brain-lift]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin MCP wrapper over a portable pure core: the wrapper is disposable, criticRule stays lift-ready (D4); deleting the wrapper needs zero change to lib/core/eureka-critic.cjs"
    - "Closed scalar/enum wire schema: z.enum built once from loadCriticTags().domain_tags; the only string field is regex-bound (rubric_pattern), so no free-text channel can grow"
    - "Zero registration-time roomDir closure (D5): the handler is a pure function of the payload, references neither roomDir nor pluginRoot nor larryContext, so the stale-room bug cannot recur on a new surface"
    - "Born-wired no-drift declaration: hitl_shape:none as a registration-site comment (not an MCP_TOOL_CONNECTORS entry, since the dial is none), so the connector registry stays byte-stable and both Part 11 gates stay green"
    - "Boundary-by-scan not review: D7 legs c+d are automated source-region + behavior assertions that fail the build on schema growth, MCP coupling, roomDir coupling, or a raw-float return"
    - "Call-time env tunables (RS_SEMANTIC_FLOOR precedent): the dedupe TTL and rate limit are read inside the handler so an operator retunes without a code change"

key-files:
  created:
    - "tests/test-212-part8-boundary.cjs"
  modified:
    - "lib/mcp/tool-router.cjs"

key-decisions:
  - "eureka_critic is registered directly via server.tool and deliberately NOT added to ALL_TOOL_COMMANDS: it has no CLI command twin (its CLI surface is plan 05, its programmatic consumer is Phase 213), and the 65-pin in test-205-surface-fence.cjs guards CLI<->MCP command parity for the 64 routed CLI commands, not this tool. Documented at the registration site; the 65-pin was verified untouched."
  - "eureka_critic mints NO MCP_TOOL_CONNECTORS descriptor: its Part 11 governance dial is hitl_shape:none (a pure ruling with no Decision-Gate fork of its own), so a connector descriptor would be an empty-dial entry. Omitting it keeps data/connector-registry.json + data/mcp-tool-connectors.json byte-stable, so build-connector-registry --check and check-shape-declaration --check stay green with no regeneration - the plan's no-drift proof. The human gate on eureka verdicts lives downstream in Phase 213's eureka-reach wiring (where CONTEXT scopes it)."
  - "The per-API-key rate-limit (D3b item 4) is honestly deferred to the SEED-014 Brain-repo lift: the plugin-local tool has no per-key identity, so this phase ships a per-process rolling-minute token count as the local equivalent and documents the deferral rather than faking per-key granularity."
  - "The dedupe cache and rate-limit window are module-level (not per-registration) so they persist across calls for the life of the process; neither references a room closure (D5-safe)."

patterns-established:
  - "Pattern 5: an MCP tool whose governance dial is 'none' proves born-wired compliance by a declaration COMMENT + a no-drift gate run, not by a connector descriptor - registration on the one governed path IS the wiring (Canon Part 11)."
  - "Pattern 6: comment-aware source-region scans (strip // and block-comment lines before asserting) so a D5/portability check asserts against CODE, never prose that names the very token it forbids (the D7c grep -v hygiene rule)."

requirements-completed: [212-D1, 212-D3B, 212-D4, 212-D5, 212-D7]

# Metrics
duration: 22min
completed: 2026-07-10
---

# Phase 212 Plan 03: Eureka Grounding Guard MCP Tool + Part 8/D5 Boundary Scan Summary

**The Grounding Guard ruling reaches Desktop/Cowork as `eureka_critic`, a thin MCP tool on the existing governed tool-router surface that wraps the pure `criticRule` unchanged (SEED-014 lift-ready): a closed scalar/enum D1 wire with no free-text channel, wrapper-side dedupe + per-process rate-limit, zero registration-time roomDir closure, a `hitl_shape:none` no-drift born-wired declaration, and a 6-check automated Part 8 boundary scan (D7 legs c+d) that fails the build on any schema growth, MCP coupling, room coupling, or raw-float return.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-10T06:48:00Z
- **Completed:** 2026-07-10T07:10:00Z
- **Tasks:** 2 (both type=auto)
- **Files:** 1 created, 1 modified

## Accomplishments

- Registered `eureka_critic` on `lib/mcp/tool-router.cjs` as a thin wrapper over `criticRule` (D4): the wrapper is disposable, the critic logic in `lib/core/eureka-critic.cjs` was not touched, so the SEED-014 lift is a move with zero interface rewrite.
- Hardened the wire to the closed D1 shape (D1/D3b): `differential_score`/`semantic_similarity` in [-1,1], `lsa_similarity` in [0,1], `surprise_type` + source/target domain tags as `z.enum` (the domain enum loaded once from `loadCriticTags().domain_tags`), `rubric_pattern` a regex-bound `^[01x]{6}$` string, `schema_version` an int. No bare `z.string()` exists on the schema, so the D2-item-5 sycophancy channel stays closed by construction.
- Added dedupe + rate-limit on the wrapper (D3b item 4): a module-level sha256 dedupe Map over the canonical-JSON payload (`EUREKA_CRITIC_DEDUPE_TTL_MS`, default 60000) returns a cached ruling without recompute; a per-process rolling-minute token count (`EUREKA_CRITIC_RATE_LIMIT`, default 30) returns an isError response naming the limit when exceeded. Both env tunables are read at call time.
- Held D5: the handler references neither roomDir nor pluginRoot nor larryContext - a pure function of the payload - so the 2026-07-05 addendum's stale-room bug cannot recur on this new surface.
- Declared Part 11 born-wired shape at the registration site (`hitl_shape:none` rationale, the not-in-ALL_TOOL_COMMANDS rationale, the SEED-014 lift note, the per-key rate-limit deferral note) and proved no drift: the tool mints no `MCP_TOOL_CONNECTORS` descriptor, so the born-wired registry gates stay byte-stable and green.
- Shipped `tests/test-212-part8-boundary.cjs` (D7 legs c+d): 6 named checks reusing the `test-connector-part8-boundary.cjs` idiom, covering D1 closed-schema/no-bare-string, D3b quantize+auditQueryObject-reuse (mutation-sensitive), D4 portability, D5 handler-region scan, D3b-item-3 coarse string confidence, and D3b-item-4 dedupe/rate-limit presence. Zero network, zero model load.

## Task Commits

Each task committed atomically:

1. **Task 1: register eureka_critic thin MCP tool (D1/D3b4/D4/D5)** - `7c7bcc90` (feat)
2. **Task 2: Part 8 boundary scan + D5 per-call-resolution check (D7 c+d)** - `8b63e9b5` (test)

_Task 2's commit also folds a one-line comment reword in `lib/mcp/tool-router.cjs` (the step-3 handler comment, so it no longer spells the literal `roomDir`/`pluginRoot` tokens) - a wording change so the D5 scan is unambiguous to a naive grep too, not a code-behavior change._

## Files Created/Modified

- `lib/mcp/tool-router.cjs` (modified) - added the `eureka_critic` server.tool registration (closed D1 zod schema, dedupe + rate-limit handler, hitl_shape:none declaration block), a module-top `require('../core/eureka-critic.cjs')`, and the module-level dedupe cache + rate-limit window.
- `tests/test-212-part8-boundary.cjs` (created, 278 lines) - the 6-check Part 8 boundary scan (D7 legs c+d).

## Decisions Made

- **Not in ALL_TOOL_COMMANDS, registered directly via server.tool.** eureka_critic has no CLI command twin; the 65-pin (`test-205-surface-fence.cjs`) guards CLI<->MCP parity for the 64 routed CLI commands, not this tool. Adding it to the parity array would have tripped the pin for no reason. Documented at the registration site; the pin was verified untouched (20/20).
- **No MCP_TOOL_CONNECTORS descriptor.** The tool's Part 11 dial is `hitl_shape:none` (a pure ruling, no Decision-Gate fork), so a connector descriptor would carry an empty dial. Omitting it keeps `data/connector-registry.json` and `data/mcp-tool-connectors.json` byte-stable, so the two Part 11 gates stay green with no file regeneration - exactly the no-drift proof the plan asked for. Registration on the one governed path IS the wiring.
- **Per-key rate-limit deferred, per-process shipped.** Honest local equivalent; the per-key upgrade lands with the key surface under SEED-014, documented in the registration comment.
- **Comment-aware boundary scans.** CHECK 3 (portability) and CHECK 4 (D5) strip comment lines before asserting, so they test CODE, never prose - the D7c grep -v hygiene rule. The handler's own step-3 comment was additionally reworded to avoid the literal tokens as belt-and-suspenders.

## Deviations from Plan

None - plan executed exactly as written. One in-task wording correction (the step-3 handler comment reworded to avoid the literal `roomDir`/`pluginRoot` tokens) so the D5 handler-region scan is unambiguous under a naive grep; this is the same block-comment-not-grep-aware correction plans 01 and 02 recorded, a comment change inside Task 2, not a deviation-rule invocation.

## Issues Encountered

- The D5 handler-region scan would, under a non-comment-aware grep, false-positive on the handler's own explanatory comment that names `roomDir`/`pluginRoot` to state they are absent. Resolved two ways: CHECK 4 strips comment lines before scanning (asserting against code), and the comment was reworded to "room-directory / plugin-root closure". Both the comment-aware scan and a naive grep now read clean.

## CHECK 2 Mutation-Sensitivity Verification (plan acceptance)

Verified once on a scratchpad copy (never the working tree, per the acceptance): copying `lib/core/eureka-critic.cjs` into the session scratchpad and stripping the `quantize()` wrapper off `differential_score` inside `assembleCriticPayload` makes CHECK 2's `differential_score:\s*quantize\(` assertion fail - proving the check is mutation-sensitive and would catch a real regression that let a full-precision float onto the wire (T-212-10 linkability mitigation). The working tree was untouched; the scratchpad copy was discarded.

## Threat Model Coverage (from PLAN.md threat_model)

- **T-212-09 (schema drift / smuggled text field):** mitigated - CHECK 1 fails the build if the schema grows a bare `z.string()` or a non-D1 field.
- **T-212-10 (full-precision floats / stable IDs on the wire):** mitigated - CHECK 2 asserts quantize at the assembly site (mutation-sensitive); no ID field exists in the schema.
- **T-212-11 (membership inference via confidence):** mitigated - CHECK 5 asserts a coarse string confidence band, never a raw float.
- **T-212-12 (DoS / shadow-model probing):** mitigated - CHECK 6 asserts the dedupe map + rate-limit tunables are present in the handler.
- **T-212-13 (stale roomDir closure on the new tool):** mitigated - CHECK 4 greps the handler region clean of roomDir/pluginRoot/loadRoomState (the D5 mandate).
- **T-212-SC (npm/pip/cargo installs):** accepted - zero new packages this phase; no install task ran.

## User Setup Required

None - no external service configuration. Zero new packages (Part 7 reuse only; the 212-RESEARCH Package Legitimacy Audit stands).

## Next Phase Readiness

- The Grounding Guard is reachable on Desktop/Cowork via MCP (`eureka_critic`). The CLI surface arrives with plan 05's runner; the programmatic consumer is Phase 213's eureka-reach wiring.
- The wrapper is provably thin: `lib/core/eureka-critic.cjs` was not touched, so the SEED-014 lift is a move, not a rewrite.
- The Part 8 boundary is enforced by automated scan (`tests/test-212-part8-boundary.cjs`), not review discipline.
- 212-04 adds the gold-card fixture suite + JHU Opportunity Statement fixtures + optional Plurai leg + the `run-all-212.sh` aggregator (which should compose this boundary scan alongside the stage/rubric/negative-corpus suites).

## Self-Check: PASSED

- Created file exists: `tests/test-212-part8-boundary.cjs` FOUND on disk.
- Modified file present: `lib/mcp/tool-router.cjs` carries the `eureka_critic` registration (grep count 8).
- Both task commits exist in git history: `7c7bcc90` (feat), `8b63e9b5` (test).
- `node tests/test-212-part8-boundary.cjs` 6/6 exit 0; `node tests/test-205-surface-fence.cjs` 20/20 exit 0 (65-pin intact); `node tests/test-212-critic-rubric.cjs` 10/10; `node tests/test-212-critic-stage-a.cjs` 7/7; `node tests/test-212-negative-corpus.cjs` 3/3; `node scripts/build-connector-registry.cjs --check` exit 0; `node scripts/check-shape-declaration.cjs --check` exit 0 (255 declared, 5 skill-exempt).

---
*Phase: 212-eureka-substrate-grounding-guard*
*Completed: 2026-07-10*
