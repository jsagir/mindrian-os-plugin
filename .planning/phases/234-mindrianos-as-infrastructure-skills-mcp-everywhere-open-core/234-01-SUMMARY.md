---
phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
plan: 01
subsystem: testing
tags: [agent-skills-spec, gray-matter, mcp, json-rpc, gate-script, part-8, zed-catalog-budget]

# Dependency graph
requires:
  - phase: 233-graph-derive-drain-residual
    provides: "tests/run-all-233.sh harness shape (glob discovery, run/run_may_skip/strip_comments, Part 8 tripwire with negative self-test)"
  - phase: 190-born-declared-shape
    provides: "scripts/check-shape-declaration.cjs gate-script header and CLI exit-contract shape"
  - phase: 127-brain-mcp-shim
    provides: "tests/test-127-00-shim-handshake.sh JSON-RPC-over-stdio handshake pattern"
provides:
  - "scripts/check-skill-spec.cjs: the ONE in-repo Agent Skills spec validator (--check, --catalog-budget, --plugin-root-census)"
  - "tests/run-all-234.sh: the phase 234 gate harness, glob-discovers tests/test-234-*"
  - "Measured phase baseline: 9 required-field breaches, 105 allowed-tools deviations, 12,860 catalog bytes (25% of Zed budget), 51 ${CLAUDE_PLUGIN_ROOT} references"
  - "D-03 locked: the MCP initialize result never carries an instructions key"
  - "D-10 locked: no methodology skill or command gates on a paid check"
affects: [234-03, 234-04, 234-05, 234-06, 234-07, 234-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-repo spec validator over an off-stack/unaffiliated npm package (Package Legitimacy)"
    - "Hard-fail exit contract for external-spec gates, distinct from the Phase 210 advisory HITL-shape gate"
    - "Grep gates prove themselves against planted tokens before being trusted over the real tree"

key-files:
  created:
    - scripts/check-skill-spec.cjs
    - tests/run-all-234.sh
    - lib/mcp/no-instructions.test.cjs
    - tests/test-234-adoption-engine-gate.cjs
  modified: []

key-decisions:
  - "check-skill-spec.cjs --check hard-fails on any violation, no --strict flag. It is a genuine external-spec validator, not the HITL-shape gate that Phase 210 downgraded to advisory for its own in-flight-backfill reason."
  - "checkAll() reports required-field breaches SEPARATELY from the experimental allowed-tools array form, because they are two different repair jobs closed by two different later plans."
  - "lib/mcp/no-instructions.test.cjs is wired into run-all-234.sh as an EXPLICIT run leg rather than renamed into the tests/test-234-* glob, preserving 234-VALIDATION.md's own naming."
  - "npm skills-ref removal produced no committable diff: it was never in git history, only uncommitted working-tree state from a prior session's npm install."
  - "The D-10 gate asserts its allowlisted files still exist on disk, so a rename cannot silently widen the gate."

patterns-established:
  - "Spec-gate exit triple: 0 clean, 1 violation, 2 usage error, with the deviation from an in-repo advisory sibling stated in the file header."
  - "Ground-truth MCP assertion: drive a real JSON-RPC initialize over stdio and read the wire, so a runtime-assembled value cannot slip past a source grep, and a wedged server FAILS instead of passing vacuously."
  - "Allowlist hygiene as a test: every allowlist entry carries a written reason AND is asserted to still exist."

requirements-completed: [D-01, D-02, D-03, D-08, D-10]

# Metrics
duration: 22min
completed: 2026-07-28
---

# Phase 234 Plan 01: Wave-0 Verification Infrastructure Summary

**The phase now has its measuring instruments: an in-repo Agent Skills spec validator built on gray-matter instead of an unaffiliated npm package, a self-proving gate harness, and two invariants (no MCP `instructions` leak, no paid gate on methodology) that were true only by accident until now.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 of 2
- **Files created:** 4
- **Files modified:** 0 (see Deviations for why the skills-ref removal committed nothing)

## Accomplishments

- **`scripts/check-skill-spec.cjs`** validates all 125 shipped skills against agentskills.io/specification and measures the two portability budgets the phase depends on. It is byte-identical to 234-RESEARCH.md's own measurement snippet, so the numbers later plans report against are the same numbers research produced.
- **`tests/run-all-234.sh`** runs end to end at **PASS=5 FAIL=1 SKIP=0**, with the single FAIL being the intentional spec-baseline leg. Every later plan gets coverage for free by dropping a `tests/test-234-*.cjs` file in.
- **D-03 is locked.** The MCP spec allows a server to return an `instructions` string on `InitializeResult`, which every host prepends to its system prompt before the user types anything. That is the single highest-leverage place for methodology to leak to ~45 foreign hosts. MindrianOS was compliant, but only accidentally: nothing asserted it, and it was one constructor argument away from not being true.
- **D-10 is locked.** No methodology skill or command reaches for `resolve-brain-key` or `brainPlan` outside three allowlisted setup/connector surfaces. The skills and commands are the adoption engine; the Brain is the paid layer, and this test is what keeps that line from drifting.
- **The npm `skills-ref` supply-chain hazard is gone** from the working tree and can no longer be installed by accident, with the reason recorded in the validator's own header so the next person reading the spec's `skills-ref validate` instruction does not reach for it again.

## Task Commits

1. **Task 1: check-skill-spec.cjs validator + remove npm skills-ref** - `0f14203a` (feat)
2. **Task 2: run-all-234.sh harness + no-instructions test + D-10 adoption-engine gate** - `55bfb239` (test)

## Files Created/Modified

- `scripts/check-skill-spec.cjs` (312 lines) - Exports `validateSkill`, `checkAll`, `catalogBudget`, `pluginRootCensus`, plus `listSkillFiles`/`NAME_RE`/`ZED_CATALOG_BUDGET_BYTES`/`PLUGIN_ROOT_TOKEN`. CLI: `--check` (exit 1 on any violation), `--catalog-budget` (exit 1 over 50KB), `--plugin-root-census` (always exit 0), no/unknown flag (usage, exit 2).
- `tests/run-all-234.sh` (219 lines) - Glob-discovers `tests/test-234-*.cjs|.sh`, adds the explicit `no-instructions.test.cjs` leg, runs both spec-gate flags, then the Part 8 self-test and sweep.
- `lib/mcp/no-instructions.test.cjs` (176 lines) - Spawns the real MCP server under a hermetic HOME with `MINDRIAN_BRAIN_KEY` unset, drives `initialize` over stdio, asserts `instructions` is absent. 4 checks, all green.
- `tests/test-234-adoption-engine-gate.cjs` (236 lines) - Self-test against planted tokens, then the real sweep across 237 methodology surfaces with a 3-entry written-reason allowlist. 12 checks, all green.

## The Measured Baseline

This is the starting point 234-03 through 234-08 close out. Every number was produced by running the committed code, not estimated.

| Measure | Value | Owner |
|---------|-------|-------|
| Skills with a required-field breach | **9** (7 missing `name`, `MOSDeckEngine` charset, `value-proposition` name != dirname) | 234-03 / 234-04 |
| Skills using the experimental `allowed-tools` array form | **105** (of 112 that declare the field; 7 already use the string form) | 234-04 |
| Zed catalog budget (name+description) | **12,860 bytes / 51,200 = 25%**, 3.9x headroom | held by the `--catalog-budget` leg |
| Skill bodies still carrying `${CLAUDE_PLUGIN_ROOT}` | **51** of 125 | 234-06 |
| Live MCP `instructions` on initialize | **absent** (now asserted) | locked |
| Methodology surfaces gated on a paid check | **0** of 237, 3 allowlisted | locked |

Two honest corrections to 234-RESEARCH.md, both verified by re-running research's own snippet:

1. **Catalog bytes are 12,860, not 12,966.** Research's exact snippet reproduces 12,860 on the current tree, so this is catalog drift since 2026-07-28's measurement, not a difference in method. Still 25% of budget; the conclusion is unchanged.
2. **`allowed-tools` deviations are 105, not 112.** 112 is the count of skills that *declare* the field; 7 of those already use the compliant space-separated string form. The repair job is 105 files, not 112.

## Decisions Made

1. **Hard-fail, no `--strict`.** `check-shape-declaration.cjs` was deliberately downgraded to advisory in Phase 210 because a shape-declaration backfill was mid-flight. That reason does not transfer. A skill that fails the Agent Skills spec silently vanishes from a strict foreign host's catalog, so the gate blocks.
2. **Report the two violation classes separately.** `name` is a REQUIRED field; `allowed-tools` is marked Experimental in the spec. Blending them into one number would hide which of the two later plans actually moved.
3. **`gray-matter`, never a regex.** Several skills use folded scalars (`description: >`). A naive regex undercounts the catalog by 33% on the exact number the Zed budget gate depends on. The hand-rolled `parseFrontmatter` exported by `check-shape-declaration.cjs` carries that same known limitation, so it is deliberately not reused.
4. **Explicit leg over rename for `no-instructions.test.cjs`.** 234-VALIDATION.md names the path; renaming it into the glob would have created a doc-vs-code mismatch on day one. The header states the file is glob-invisible by design so nobody later assumes discovery.
5. **Ground truth over grep for D-03.** A source grep would miss an `instructions` value assembled at runtime or defaulted by a future SDK version. The test reads the wire, and treats a wedged server as a FAIL rather than a vacuous pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm `skills-ref` was never committed, so its removal produced no diff to commit**

- **Found during:** Task 1
- **Issue:** The plan expected `package.json` and `package-lock.json` commits removing `"skills-ref": "^0.1.5"`. Root cause of the mismatch: `git show HEAD:package.json | grep -c skills-ref` returns **0**. The package was added by an uncommitted `npm install skills-ref` in a prior session and had been sitting in working-tree state only. It never entered git history.
- **Fix:** Ran `npm uninstall skills-ref` as the plan directs. This restored `package.json` to *exactly* its HEAD state (zero diff) and removed the package from `node_modules` (which is gitignored). `package-lock.json`'s only remaining delta versus HEAD is an unrelated `1.15.3-beta.11 -> 1.15.3-beta.51` version sync belonging to a different concurrent session, which was correctly left unstaged.
- **Verification:** `grep -c '"skills-ref"' package.json` -> 0; `node -e "require('./package-lock.json')"` parses; `ls node_modules | grep -c '^skills-ref$'` -> 0; `git diff package.json` -> empty.
- **Committed in:** n/a (no diff existed to commit). The removal is real and verified; the outcome is simply that the repo's committed dependency set never contained the hazard.

**2. [Rule 2 - Missing critical functionality] Added the required-field vs experimental violation split**

- **Found during:** Task 1
- **Issue:** A single blended `failing` count (111) made the plan's own stated baseline of "9 hard failures, 112 allowed-tools deviations" unmeasurable from the gate's output. Later plans could not tell which class they had moved.
- **Fix:** `checkAll()` now returns `hardFailing` and `allowedToolsDeviations` alongside `failing`, and the `--check` header line prints all three.
- **Files modified:** `scripts/check-skill-spec.cjs`
- **Verification:** Output reads `111 of 125 skill(s) fail the spec (9 with a required-field breach, 105 with the experimental allowed-tools array form)`, and 9 matches RESEARCH's hard-failure count exactly.
- **Committed in:** `0f14203a` (part of the task commit)

**3. [Rule 2 - Missing critical functionality] Added a negative self-test to the D-10 gate**

- **Found during:** Task 2
- **Issue:** The plan specified the D-10 grep and its allowlist but no proof that the grep bites. A grep gate that quietly stopped matching is indistinguishable from a clean codebase, which is the exact false-success shape this phase exists to close, and it is the discipline `run-all-234.sh` applies to its own Part 8 tripwire.
- **Fix:** The test now scans a synthetic tree with each token planted (a `resolve-brain-key` command, a `brainPlan` skill, an ordinary prose-only skill, an excused surface) and asserts the scanner catches, ignores, and honors the allowlist correctly, before it is trusted over the real tree. Also added allowlist-hygiene checks: each entry must still exist on disk and carry a written reason, so a rename cannot silently widen the gate.
- **Files modified:** `tests/test-234-adoption-engine-gate.cjs`
- **Verification:** 12 checks pass, including all 4 self-test cases.
- **Committed in:** `55bfb239` (part of the task commit)

**4. [Rule 3 - Blocking] Part 8 sweep flagged the validator's own spec-citation URL**

- **Found during:** Task 2
- **Issue:** `PART8_RE` matched `'https://agentskills.io/specification'` on line 175 of `check-skill-spec.cjs`. It is a citation printed to stderr in the recovery message a human reads when a skill fails, not a call; that file holds no HTTP client and makes zero network reach.
- **Fix:** Added it to `PART8_ALLOW` as an EXACT-LINE allowance with the reason written into the harness header, per the run-all-217/233 written-reason idiom. Any *other* egress token in that same file still fails the gate. The pattern itself was not weakened.
- **Files modified:** `tests/run-all-234.sh`
- **Verification:** Part 8 self-test's `must_not_catch "the written-reason allow-list line"` passes; the sweep passes across all 6 targets.
- **Committed in:** `55bfb239` (part of the task commit)

**5. [Rule 1 - Correction] The plan's `resolve-brain-key.cjs` allowance turned out to be unnecessary**

- **Found during:** Task 2
- **Issue:** The plan anticipated `lib/core/resolve-brain-key.cjs` tripping the case-sensitive lowercase `brain` token and instructed adding an exact-line allowance "if the sweep flags them."
- **Fix:** Measured before acting rather than pre-emptively widening the allowlist: the file produces **zero** hits on executable lines, because its identifiers are `resolveBrainKey` and `MINDRIAN_BRAIN_KEY` (both with an uppercase B), and the only lowercase `brain` occurrences are on comment lines that `strip_comments` removes. No allowance added. The measurement is recorded in the harness header so a future reader does not re-derive it, and the `brain identifier` self-test case is kept so the gate still proves it bites on that shape.
- **Files modified:** `tests/run-all-234.sh` (header note only)
- **Verification:** `strip_comments lib/core/resolve-brain-key.cjs | grep -nE "$PART8_RE"` returns nothing; Part 8 sweep PASSES.
- **Committed in:** `55bfb239`

---

**Total deviations:** 5 auto-fixed (2x Rule 3 blocking, 2x Rule 2 missing critical functionality, 1x Rule 1 correction)
**Impact on plan:** No scope creep. Deviations 2, 3 and 5 make the gates measurable and self-proving, which is the plan's own stated purpose. Deviation 1 is a discovery about repo history, not a change of intent, and the plan's acceptance criteria for it are all met. Deviation 4 is the documented allowance mechanism the plan itself specifies.

## Issues Encountered

**Concurrent session activity in the working tree.** Partway through Task 2, `git status` showed new modifications to `lib/core/resolve-active-room.cjs`, `scripts/intent-classifier.cjs`, `scripts/room-registry`, plus an untracked `tests/test-222-readonly-rank.cjs`, and a commit `e81119f0 test(quick-260728-7kc-01)` landed between this plan's two commits. These belong to a different concurrent session working the registry-active-session-unbound-inheritance RCA. Verified out of scope and left untouched; only the 4 files this plan created were ever staged. `git diff --diff-filter=D HEAD~2 HEAD` confirms zero deletions across both task commits.

## Acceptance Criteria

All criteria from both tasks verified by running the committed code:

**Task 1**
- [x] `--check` runs to completion and exits 1 (expected phase-in-progress baseline)
- [x] Output enumerates all 7 missing-`name` skills (auto-explore, brain-derive, dial-memory-refresh, dogfood-flush, explain-decision, feynman-timeline-refresh, mva-report) plus `MOSDeckEngine` (charset) and `value-proposition` (name != dirname) by name
- [x] `--catalog-budget` exits 0, prints 12,860 bytes (inside the 12,000-14,000 band)
- [x] `--plugin-root-census` exits 0, reports 51 (inside the 45-55 band)
- [x] `grep -c '"skills-ref"' package.json` returns 0
- [x] `node -e "require('./package-lock.json')"` parses without error
- [x] `<verify><automated>` block passes

**Task 2**
- [x] `bash tests/run-all-234.sh` completes; SUMMARY prints `PASS=5 FAIL=1 SKIP=0` with the Part 8 self-test, Part 8 sweep, and no-instructions legs among the passes
- [x] `node lib/mcp/no-instructions.test.cjs` exits 0 standalone (4 checks)
- [x] `node tests/test-234-adoption-engine-gate.cjs` exits 0 standalone (12 checks)
- [x] `grep -n "no-instructions.test.cjs" tests/run-all-234.sh` matches at line 121 (the explicit leg)
- [x] `<verify><automated>` block passes

## Known Stubs

None. Every function is fully implemented and exercised by a passing check.

## Threat Flags

None. `T-234-01` (the `skills-ref` identity hazard) is mitigated, and no new security-relevant surface was introduced: the validator makes local fs reads only, and the two tests spawn local processes under scratch HOMEs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 1 is complete and every downstream plan is unblocked:

- **234-03 / 234-04** have their target list and their green light: fix the 9 required-field breaches and the 105 `allowed-tools` array forms, then `check-skill-spec --check` turns green and `run-all-234.sh` reaches FAIL=0. Note the two files the plan flags as decision tasks rather than mechanical ones: `skills/value-proposition/SKILL.md` carries a 6-line comment recording its name-vs-directory mismatch as INTENTIONAL, with two live consumers keyed off the two different ids, and `MOSDeckEngine` needs a grep-and-update of every reference before any rename.
- **234-05** can extend `PART8_TARGETS` in `run-all-234.sh` against a swept, already-clean baseline instead of re-deriving the pattern.
- **234-06** can flip `pluginRootCensus()` from informational to asserted once the 51 skills migrate onto `MINDRIAN_OS_ROOT` / `resolveActivePluginRoot()`.
- **All plans** add coverage by dropping a `tests/test-234-*.cjs` file in; no harness edit needed.

**Standing concern, carried from 234-RESEARCH.md's own limitation note:** no foreign host is installed on this machine. Every portability claim so far, including this plan's, is derived from the spec and from static analysis plus local MCP runs. The phase still needs its `checkpoint:human-verify` where a human installs one non-Claude-Code host and confirms the catalog loads and the MCP server connects. Nothing in Plan 01 substitutes for that.

## Self-Check: PASSED

All 4 created files exist on disk. Both task commits (`0f14203a`, `55bfb239`) exist in git history. No em-dashes in any created file (house rule). No file deletions across either task commit.

---
*Phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core*
*Completed: 2026-07-28*
