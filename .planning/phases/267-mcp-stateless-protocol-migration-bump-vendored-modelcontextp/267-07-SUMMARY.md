---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 07
subsystem: mcp
tags: [mcp, sdk-v2, registerTool, gate, chain, claim, elicitation, rca, registration-rewrite]

# Dependency graph
requires:
  - phase: 267-06
    provides: "tests/test-267-mcpv2-registration-api.cjs (--file per-commit gate), the registration-rewrite rule (server.tool -> server.registerTool with a z.object-wrapped shape and a mechanically-derived title), the fake-server registerTool-capture-sibling fixture pattern"
  - phase: 267-02
    provides: ".planning/debug/gate-elicitation-premise-stale-comment.md (RCA 3, filed, unresolved)"
  - phase: 267-04
    provides: "267-TRIPOLAR-PROBES.md (live CLI wire-tee facts at 2.1.280/2.1.281; Desktop/Cowork recorded PENDING)"
provides:
  - "tests/test-267-mcpv2-gate-premise.cjs: source-arm + behavior-arm pin for gate.cjs's elicitation-capability comment, RED-then-GREEN"
  - "gate.cjs (gate_render, gate_answer), chain.cjs (chain_resolve, chain_run), claim-verify.cjs (claim_verify, claim_read), claim.cjs (claim_write) all on server.registerTool -- 19 of 51 phase-wide sites migrated"
  - "RCA 3 resolved: .planning/debug/resolved/gate-elicitation-premise-stale-comment.md, knowledge-base.md block"
  - "8 pre-existing fake-server test fixtures taught the registerTool capture sibling (Rule-1 fix, same pattern as 267-06)"
  - "three pre-existing, confirmed-unrelated findings logged to deferred-items.md (not fixed): test-237-approve-executes.cjs's stale mutation-test needle; check-tool-honesty.cjs's scanAll() not recognizing server.registerTool( call sites (phase-wide, predates this plan); test-353-filing-gate.cjs's EVENT_TYPES.size drift"
affects: [267-08, 267-09, 267-10, 267-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registration rewrite rule (267-06..267-07, unchanged): server.tool(NAME, DESC, SHAPE, CB) -> server.registerTool(NAME, { title: TITLE, description: DESC, inputSchema: z.object(SHAPE) }, CB). DESC and SHAPE move verbatim; TITLE is mechanically derived (split NAME on _/-, capitalize each word, join with spaces); CB and its parameter names are untouched; SHAPE properties re-indented one level deeper under inputSchema: z.object({."
    - "A comment-only bug fix (RCA 3) proves itself comment-only via a mechanical diff gate: git diff <fix>~1 <fix> -- <file> | grep '^[-+]' | grep -v comment-syntax-lines | wc -l == 0, not just an eyeballed review."
    - "Every fake-server test fixture that drives a lib/mcp/tools/*.cjs module's real register() (directly, or via registerCoreTools()'s cascade through EVERY tools/*.cjs module) needs a registerTool(name, config, handler) capture sibling the moment ANY tool it touches migrates -- not just the tool the fixture is nominally 'about'. A fixture whose own target tool is unmigrated can still crash on an UNRELATED tool's registerTool call if registerCoreTools() is in its call chain (test-358-b1-surfaces.cjs, test-358-b1-refile.cjs, test-276-claim-write-primitive.cjs, test-276-meeting-gate-wiring.cjs all reached gate.cjs/chain.cjs/claim-verify.cjs/claim.cjs this way, not through their own nominal tool)."
    - "A fixture that reconstructs z.object(reg.schema) or reads reg.schema.<field>.safeParse directly needs schema: (cfg.inputSchema && cfg.inputSchema.shape) || cfg.inputSchema || {} in its registerTool capture (unwrap the ZodObject's own .shape getter back to the raw ZodRawShape the v1 form always captured) -- a fixture that never inspects .schema per-key just needs schema: cfg.inputSchema (no unwrap required)."
  key-decisions-inline: "see key-decisions below"

key-files:
  created:
    - tests/test-267-mcpv2-gate-premise.cjs
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/chain.cjs
    - lib/mcp/tools/claim-verify.cjs
    - lib/mcp/tools/claim.cjs
    - tests/test-c55-one-resume-owner.cjs
    - tests/test-238-one-ledger.cjs
    - tests/test-238-chosen-validation.cjs
    - tests/test-345-gate-ratify.cjs
    - tests/test-h27-gate-card-node-fields.cjs
    - tests/test-i2x-t2-node-write-back.cjs
    - tests/test-276-meeting-gate-wiring.cjs
    - tests/test-358-b1-surfaces.cjs
    - tests/test-276-claim-write-primitive.cjs
    - tests/test-358-b1-refile.cjs
    - .planning/debug/gate-elicitation-premise-stale-comment.md (moved to resolved/)
    - .planning/debug/knowledge-base.md
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Task 1's premise test reaches detectClientCapabilities through gate.cjs's own pre-existing _internal export (never a new export added for the test), matching the plan's explicit instruction and the test-238-mint-ratifier-seam.cjs precedent for reaching gate.cjs internals."
  - "The corrected comment states Desktop/Cowork as UNPROBED as of the fix date, not as matching Claude Code's now-verified behavior -- 267-TRIPOLAR-PROBES.md's Desktop/Cowork sections are still PENDING (Task 3 of 267-04), so claiming they also declare elicitation would be a second, new fabrication the RCA's own Required Code Changes explicitly warns against."
  - "Every fixture broken by this plan's own registrar migrations was proactively swept (grep for every test requiring the migrated file, or requiring registerCoreTools()) rather than waiting for a failure to surface -- this caught 8 fixtures across all four files (2 more than 267-06's precedent count for its 2 files), including three (test-358-b1-surfaces.cjs, test-358-b1-refile.cjs, test-276-claim-write-primitive.cjs) whose OWN nominal target tool was unrelated to this plan but reached a migrated tool through registerCoreTools()'s cascade."
  - "check-tool-honesty.cjs's scanAll() gap (its findServerToolCalls regex only matches server.tool(, never server.registerTool() is a phase-wide scanner limitation, not a claim.cjs/claim-verify.cjs defect -- confirmed pre-existing by reproducing the SAME failure shape in test-276-tool-honesty-switch-branches.cjs against room_content, a tool-router.cjs tool 267-06 (a full commit earlier) already migrated. Fixing the scanner's 3-argument extraction logic is real, nontrivial work (a positional-string regex vs. an object-literal parse) explicitly deferred to whichever later plan finishes the 51-site migration, not folded into a registration-rewrite plan as a drive-by patch."
  - "test-237-approve-executes.cjs Leg 7's mutation-test needle (DISPATCHER_CALL_NEEDLE) and test-353-filing-gate.cjs's EVENT_TYPES.size=102 assertion were both confirmed pre-existing and unrelated to registerTool by literally swapping the migrated file back to its committed pre-migration form and re-running -- byte-identical failure either way in both cases, not merely asserted from reading the diff."

requirements-completed: [MCPV2-07, MCPV2-08, MCPV2-02, MCPV2-15]

# Metrics
duration: ~50min
completed: 2026-09-24
---

# Phase 267 Plan 07: Gate Elicitation Premise (RCA 3) + Gate/Chain/Claim Registrars Summary

**gate.cjs's stale "Claude Code does not declare elicitation" comment (RCA 3) fixed test-first against a live 2.1.280+ wire-tee fact, then gate.cjs, chain.cjs, claim-verify.cjs and claim.cjs's 7 tool registrations moved from the removed-in-v2 `server.tool()` form to `server.registerTool()`, bringing the phase to 19 of 51 sites migrated, with 8 pre-existing fake-server test fixtures fixed along the way and three confirmed-unrelated pre-existing findings logged rather than fixed.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-24T11:25:00Z (PLAN_BASE `6072f8db9b5b1815964751de4ac172f9e1961984`)
- **Completed:** 2026-09-24T12:14:36Z
- **Tasks:** 2
- **Files modified:** 19 (1 created, 18 modified)

## Accomplishments

- **RCA 3 fixed test-first.** `tests/test-267-mcpv2-gate-premise.cjs` proved genuinely RED against the real, unmigrated comment text (source arm: still contained the literal phrase "do not declare it", no "2.1.280" mention; behavior arm: `detectClientCapabilities`'s own ladder-detection logic, already correct, pinned green from the start) before being committed. `lib/mcp/tools/gate.cjs`'s two comment blocks (file-header `:4-11`, `detectClientCapabilities`'s own JSDoc) were then rewritten, comment-only, to state: capability comes from the MCP initialize handshake; Claude Code declares `elicitation: {}` as of build 2.1.280 (live wire tee, 2026-09-23; re-confirmed at 2.1.281, 2026-09-24, `267-TRIPOLAR-PROBES.md`), so rung (a) is the live CLI gate path per navigator ruling ("let elicitation take over on CLI"); Desktop and Cowork are stated UNPROBED as of 2026-09-24 rather than lumped into the retracted claim; a 2026-07-28-pinned connection still falls to rung (b)/(c). Proven comment-only by a mechanical diff gate (zero non-comment `+`/`-` lines), not just reviewed by eye.
- **19 of 51 phase-wide registration sites now on `server.registerTool`.** `gate.cjs` (`gate_render`, `gate_answer`), `chain.cjs` (`chain_resolve`, `chain_run`), `claim-verify.cjs` (`claim_verify`, `claim_read`), `claim.cjs` (`claim_write`) -- one commit per file, descriptions and shapes moved verbatim (zod4-contract's byte-identical-description proof holds), titles mechanically derived (`gate_render` -> "Gate Render", `chain_run` -> "Chain Run", etc.), callback bodies and parameter names untouched, `gate-render.cjs`/`gate-ledger.cjs` never touched (confirmed zero-diff).
- **8 pre-existing fake-server fixtures fixed (Rule 1, matching the 267-06 precedent).** `test-c55-one-resume-owner.cjs`, `test-238-one-ledger.cjs`, `test-238-chosen-validation.cjs`, `test-345-gate-ratify.cjs`, `test-h27-gate-card-node-fields.cjs`, `test-i2x-t2-node-write-back.cjs` (all crashed on gate.cjs's migration), plus `test-276-meeting-gate-wiring.cjs`, `test-358-b1-surfaces.cjs`, `test-358-b1-refile.cjs`, `test-276-claim-write-primitive.cjs` (crashed via `registerCoreTools()`'s cascade through claim-verify.cjs/claim.cjs even though those files were not each fixture's own nominal target) each gained a `registerTool(name, config, handler)` capture sibling; fixtures whose downstream code reconstructs `z.object(reg.schema)` or reads `reg.schema.<field>.safeParse` directly (`test-h27-gate-card-node-fields.cjs`, `test-276-claim-write-primitive.cjs`) additionally unwrap `inputSchema.shape` back to the raw `ZodRawShape` the v1 form always captured.
- **Three pre-existing, confirmed-unrelated findings logged, not fixed** (per the plan's own scope-boundary instruction): `test-237-approve-executes.cjs` Leg 7's mutation-test needle is stale against a Phase 347 dispatcher-call change (`runId: runId` added since the needle was last updated) -- reproduced byte-identical against chain.cjs's pre-migration form. `scripts/check-tool-honesty.cjs`'s `scanAll()` does not recognize `server.registerTool(` call sites at all (its regex is `/server\.tool\s*\(/g`) -- a PHASE-WIDE gap already silently live since 267-06's first migrations (confirmed via `test-276-tool-honesty-switch-branches.cjs` already failing on `room_content`, a `tool-router.cjs` tool migrated a full commit before this plan started), not something claim.cjs/claim-verify.cjs's own migration introduced. `test-353-filing-gate.cjs`'s hardcoded `EVENT_TYPES.size === 102` assertion has drifted (live value 104, nothing to do with registration form).

## Task Commits

Each task was committed atomically (Task 1 in test-then-fix order per CTX-TESTFIRST; Task 2 one commit per registrar file plus interleaved Rule-1 fixture-fix commits, per the plan's explicit "one commit per file, CIRS gate after each" instruction):

1. **Task 1a: Premise test (RED against unmigrated comment)** - `2f14c7eb8` (test)
2. **Task 1b: Comment-only fix (RCA 3 source fix)** - `aafa47ce7` (fix)
3. **Task 2a: Rewrite gate.cjs (2 sites)** - `b9eaa80d9` (feat)
4. **Task 2b: [Rule 1] Fix 6 gate.cjs fake-server fixtures** - `6d487f0bb` (fix)
5. **Task 2c: Rewrite chain.cjs (2 sites)** - `51476cf73` (feat)
6. **Task 2d: Rewrite claim-verify.cjs (2 sites), fix 2 more fixtures** - `167a3c195` (feat)
7. **Task 2e: Rewrite claim.cjs (1 site), fix 1 more fixture** - `6742852bb` (feat)
8. **Task 2f: Resolve RCA 3 (move to resolved/, knowledge-base block)** - `538ecfb27` (docs)

_This SUMMARY.md, STATE.md's additive note, and ROADMAP.md's 267-07 line land in this session's own metadata commit._

## Files Created/Modified
- `tests/test-267-mcpv2-gate-premise.cjs` - the RCA 3 premise pin (new)
- `lib/mcp/tools/gate.cjs` - comment fix, then `gate_render`/`gate_answer` on `registerTool`
- `lib/mcp/tools/chain.cjs` - `chain_resolve`/`chain_run` on `registerTool`
- `lib/mcp/tools/claim-verify.cjs` - `claim_verify`/`claim_read` on `registerTool`
- `lib/mcp/tools/claim.cjs` - `claim_write` on `registerTool`
- `tests/test-c55-one-resume-owner.cjs`, `tests/test-238-one-ledger.cjs`, `tests/test-238-chosen-validation.cjs`, `tests/test-345-gate-ratify.cjs`, `tests/test-h27-gate-card-node-fields.cjs`, `tests/test-i2x-t2-node-write-back.cjs`, `tests/test-276-meeting-gate-wiring.cjs`, `tests/test-358-b1-surfaces.cjs`, `tests/test-358-b1-refile.cjs`, `tests/test-276-claim-write-primitive.cjs` - each fake `McpServer` taught the `registerTool` capture form
- `.planning/debug/gate-elicitation-premise-stale-comment.md` -> `.planning/debug/resolved/gate-elicitation-premise-stale-comment.md` (moved, Resolution filled)
- `.planning/debug/knowledge-base.md` - new block prepended
- `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md` - four new entries (the 267-06-caused-but-unnoticed check-tool-honesty gap, plus the three findings named above)
- `.planning/ROADMAP.md` - 267-07's own line checked `[x]` with a summary, `Plans:` counter 5/18 -> 6/18 (full diff checked before committing, no drift elsewhere)
- `.planning/STATE.md` - additive `Previously (267-07, ...)` note only; Phase/Plan/Status (Phase 355's own Current Position) untouched (diff confirmed zero deletions)

## Decisions Made
See `key-decisions` in the frontmatter above (the `_internal` export reuse for the premise test, Desktop/Cowork stated unprobed rather than assumed, the proactive fixture sweep across all `registerCoreTools()`-cascading tests, the check-tool-honesty scanner gap deferred as phase-wide and pre-existing, and the swap-back verification method used to confirm both remaining deferred findings are genuinely unrelated to this plan's changes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 8 pre-existing test fixtures' fake McpServer objects broke on this plan's own registrar rewrites**
- **Found during:** Task 2, running the plan's own required per-commit gate list plus a proactive sweep (grep for every test requiring each migrated file, or requiring `registerCoreTools()`, per the 267-06 precedent's own documented pattern)
- **Issue:** Each fixture builds its own minimal fake `McpServer` to invoke a `lib/mcp/tools/*.cjs` module's real `register()` directly (either its own file's, or reached transitively through `registerCoreTools()`'s cascade through every `tools/*.cjs` module). Every one only implemented the removed-in-v2 `tool(name, desc, shape, handler)` capture method, so this plan's `registerTool(name, config, handler)` calls either crashed outright (`TypeError: server.registerTool is not a function`) or silently registered nothing.
- **Fix:** Added a `registerTool(name, config, handler)` method to each fixture's fake server, capturing the handler under the same map/key the v1 `tool()` form used; two fixtures (`test-h27-gate-card-node-fields.cjs`, `test-276-claim-write-primitive.cjs`) additionally unwrap `config.inputSchema.shape` since their own assertions read the captured schema per-key.
- **Files modified:** `tests/test-c55-one-resume-owner.cjs`, `tests/test-238-one-ledger.cjs`, `tests/test-238-chosen-validation.cjs`, `tests/test-345-gate-ratify.cjs`, `tests/test-h27-gate-card-node-fields.cjs`, `tests/test-i2x-t2-node-write-back.cjs`, `tests/test-276-meeting-gate-wiring.cjs`, `tests/test-358-b1-surfaces.cjs`, `tests/test-358-b1-refile.cjs`, `tests/test-276-claim-write-primitive.cjs`
- **Verification:** All 10 files re-run individually, 9 fully green (e.g. `test-c55-one-resume-owner.cjs` 17/17, `test-358-b1-refile.cjs` 11/11, `test-276-meeting-gate-wiring.cjs` 14/14); `test-276-claim-write-primitive.cjs` reaches 43/44, its one remaining red being the separately-logged, confirmed-pre-existing check-tool-honesty scanner gap (see below), not a fixture defect.
- **Committed in:** `6d487f0bb` (the 6 gate.cjs-triggered fixtures), and bundled into `167a3c195`/`6742852bb` (the claim-verify.cjs/claim.cjs-triggered fixtures, alongside their own registrar commits).

---

**Total deviations:** 1 auto-fixed class (Rule 1 -- 8 real regressions across test fixtures, directly and only caused by this plan's own four registrar rewrites; no production/security logic touched, matching the identical shape and scope discipline 267-06 established for the same class of fixture).
**Impact on plan:** Required to keep this plan's own explicitly-named gate files (`test-276-claim-write-primitive.cjs`, `test-276-meeting-gate-wiring.cjs`) reachable and to avoid leaving a silent breakage behind for 267-08 onward. No scope creep: every fixed fixture's breakage traces to this plan's own registrar diffs, and the fix is the same mechanical, symmetric capture-method addition 267-06 already established as the pattern.

## Issues Encountered

- **check-tool-honesty.cjs's `scanAll()` does not recognize `server.registerTool(` sites at all** -- discovered while chasing `test-358-b1-surfaces.cjs`'s A11 leg and `test-276-claim-write-primitive.cjs`'s own honesty-scan assertion. Root-caused to `findServerToolCalls`'s regex (`/server\.tool\s*\(/g`, line 559) never matching the v2 form; a migrated tool's row simply vanishes from the scan rather than reporting a false verdict. Confirmed PRE-EXISTING and NOT unique to this plan: `test-276-tool-honesty-switch-branches.cjs` already fails identically on `room_content` (migrated by 267-06, a full commit before this plan started) -- the disease was already live and unnoticed, this plan's own claim-verify.cjs/claim.cjs migrations just tripped two more of its symptom sites. Not fixed here (the extraction logic needs real rework -- a positional-4th-argument assumption downstream in `extractHandlerBody` also assumes the v1 shape -- deliberately deferred to whichever later Phase 267 plan finishes the 51-site migration, so the scanner fix lands once against the final call shape). Logged in full to `deferred-items.md`.
- **`tests/run-all-267.sh`'s aggregate went from PASS=23 FAIL=1 SKIP=9 (267-06's documented snapshot) to PASS=23 FAIL=2 SKIP=8.** The SKIP-to-PASS shift is this plan's own new gate-premise test landing (no longer skipped, now passing). The new FAIL is `test-276-claim-write-primitive.cjs`, entirely attributable to the check-tool-honesty scanner gap above (43/44, the one red assertion being the anti-vacuity `rows.length > 0` check against a scan that now finds zero rows for claim.cjs). Documented plainly here rather than glossed over: this is a real, aggregate-visible delta from the prior plan's snapshot, root-caused to a confirmed pre-existing, phase-wide tooling gap rather than a functional defect in this plan's own registration rewrites.
- **`test-237-approve-executes.cjs` Leg 7's `DISPATCHER_CALL_NEEDLE` string no longer matches `chain.cjs`'s live dispatcher-call text** (Phase 347's own `runId: runId` addition postdates this harness's needle). Confirmed pre-existing by swapping `chain.cjs` back to its committed pre-migration form and re-running -- identical failure either way. Logged to `deferred-items.md`, not fixed (belongs to whoever rebaselines the needle, Phase 347's own owner).
- **`test-353-filing-gate.cjs`'s `EVENT_TYPES.size === 102` assertion is stale** (live value 104). Confirmed unrelated to registration form (a plain `Set.size` check, nothing to do with `server.tool` vs `server.registerTool`) and unrelated to this session (claim.cjs, the only file this test requires from this plan's scope, had not yet been touched when the drift was first observed). Logged to `deferred-items.md`, not fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 19 of 51 phase-wide registration-rewrite sites now migrated (12 from 267-06 + 7 from this plan). RCA 3 fully closed. The registration-rewrite rule and the fixture-sweep discipline are proven across a second, larger batch of files (4 files, 7 sites, 8 fixtures vs. 267-06's 2 files, 12 sites, 10 fixtures) with zero surprises in the rule itself.
- **267-08 (the remaining ten `tools/*.cjs` registrars) should budget time for the SAME proactive fixture sweep** -- this plan's own experience shows the fixtures needing a fix are not limited to tests that name the migrating file directly; any test using `registerCoreTools()` is in scope, since that helper cascades through every `tools/*.cjs` module on one shared fake server.
- **267-08/267-09 will likely trip check-tool-honesty.cjs's scanAll() gap again** for whichever of their tools already have a "scans OK on the honesty checker" style assertion in their own tests -- this is now a known, named, deferred issue (not a surprise), and the fix should land once, in whichever plan is scoped to finish the full 51-site migration or is explicitly assigned the scanner update, not repeatedly patched per-plan.
- No blockers for 267-08. Zero changes to any of the 51-19=32 still-unmigrated sites, `gate-render.cjs`, `gate-ledger.cjs`, `lib/core/brain-client.cjs`, `mcp-server-brain/`, or `/home/jsagi/Theo` (all verified zero-diff against PLAN_BASE).

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Completed: 2026-09-24*

## Self-Check: PASSED

All created/modified files verified present on disk (`tests/test-267-mcpv2-gate-premise.cjs`,
`lib/mcp/tools/gate.cjs`, `lib/mcp/tools/chain.cjs`, `lib/mcp/tools/claim-verify.cjs`,
`lib/mcp/tools/claim.cjs`, `.planning/debug/resolved/gate-elicitation-premise-stale-comment.md`,
this SUMMARY.md, and the rest of the modified-files list above). All eight task commits
(`2f14c7eb8`, `aafa47ce7`, `b9eaa80d9`, `6d487f0bb`, `51476cf73`, `167a3c195`, `6742852bb`,
`538ecfb27`) verified present in `git log --oneline`. No missing items.
