---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 09
subsystem: mcp
tags: [b2, mcp, question-read, question-set, desktop, cowork, rome, tdd, cirs]

# Dependency graph
requires:
  - phase: 358-07 (B2 wave 1)
    provides: lib/core/frame-provenance.cjs (setGoverningQuestion / readGoverningQuestion / readQuestionHistory / renderQuestionLines / renderHistoryLines / QUESTION_ASK / QUESTION_CARD_OPTIONS / MAX_QUESTION_CHARS / MAX_ACCOUNT_CHARS / QUESTION_TURN_EXAMPLES), the one write door
  - phase: 358-08 (B2 wave 2)
    provides: the routing spec (resolveQuestionTurn, QUESTION_TURN_PATTERNS) both this plan's descriptions and the /mos:room routing text quote verbatim
provides:
  - "lib/mcp/tools/question.cjs: question_read (unconditional read) and question_set (write-gated exactly like claim_verify, refusal-as-ask with the F.1 Decision Gate card), both born wired with declared connectors"
  - "lib/mcp/tools/claim-verify.cjs now exports hostBlock, so question.cjs shares the one host detection path"
  - "tests/test-358-b2-surfaces.cjs, tests/helpers/b2-358-child.cjs, tests/test-358-b2-persistence.cjs: the B2 MCP proof, stub legs + a real stdio wire leg + six-process/five-session persistence"
affects: [358-10 (registries/skill regenerate, tool-schema/honesty re-baseline), 358-11 (go/no-go runbook, B2-06/B2-08/B2-03 MCP halves)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared host detection: claim-verify.cjs's hostBlock(server, ctx) is now exported and reused by question.cjs, so there is exactly one server.server.getClientVersion() read path across every MCP tool that needs it"
    - "Description-built-from-constants: ORIGIN_PHRASE, ORIGIN_DESCRIPTION, CHANGE_EXAMPLES and ASK_EXAMPLES are all computed at module load from navigation.FRAME_ORIGINS_ORDERED and frameProvenance.QUESTION_TURN_EXAMPLES, never a literal list, so the MCP tool descriptions and the /mos:room routing text (358-08) can never drift apart"
    - "Card field selection at the surface: question_set's change_needs_account response picks {shape, header, options, askuserquestion_marker, askuserquestion_binding} off the door's card, routing rendered_text separately into rendered.card, rather than returning the door's card object verbatim"

key-files:
  created:
    - lib/mcp/tools/question.cjs
    - tests/test-358-b2-surfaces.cjs
    - tests/helpers/b2-358-child.cjs
    - tests/test-358-b2-persistence.cjs
  modified:
    - lib/mcp/tools/claim-verify.cjs
    - lib/core/frame-provenance.cjs
    - tests/test-358-b2-part8.cjs

key-decisions:
  - "P7-ALLOW(tasking) named allowlist instead of the TASKING_WORD='task'+'ing' concatenation 358-08 shipped: the concatenation existed only to dodge test-358-b2-part8.cjs P7's per-line literal scan, which is gaming a test, not satisfying its intent. Fixed as a Rule-1 deviation ahead of Task 1 (see below), authorized explicitly by this session's extra_fix instruction even though neither file is in this plan's own files_modified list."
  - "card: in question_set's change_needs_account response is a hand-picked subset of the door's card object (shape/header/options/askuserquestion_marker/askuserquestion_binding), with rendered_text routed separately into rendered.card -- matches the plan's own action text exactly and keeps the two response shapes (the raw card vs. its rendered text) distinct."

requirements-completed: [B2-06, B2-08, B2-03]

# Metrics
duration: ~2h (includes two shared-tree git-collision recoveries, documented below)
completed: 2026-09-23
---

# Phase 358 Plan 09: Governing Question MCP Surfaces (question_read, question_set) Summary

**lib/mcp/tools/question.cjs: question_read (unconditional) and question_set (write-gated like claim_verify, refusal-as-ask with the F.1 card) over lib/core/frame-provenance.cjs, proven over the real stdio server as Claude Desktop (claude-ai) and across six separate processes and five sessions for close-everything persistence.**

## Performance

- **Duration:** ~2h (includes investigating and recovering from two shared-tree git incidents, see Issues Encountered)
- **Completed:** 2026-09-23 (last task commit before hand-off to 358-10)
- **Tasks:** 3 (RED surfaces, RED persistence, GREEN question.cjs + claim-verify.cjs)
- **Files modified:** 8 (4 created: question.cjs, test-358-b2-surfaces.cjs, b2-358-child.cjs, test-358-b2-persistence.cjs; 4 modified: claim-verify.cjs, frame-provenance.cjs, test-358-b2-part8.cjs, and a follow-up fix to test-358-b2-surfaces.cjs itself)

## Accomplishments

- Officers on Claude Desktop (clientInfo.name claude-ai) and Cowork now record the room's governing question with its origin through `question_set` and read it back with its origin, time and every earlier version through `question_read`, proven over the REAL stdio server (`bin/mindrian-mcp-server.cjs`), not just a stub -- B2-06.
- `question_set` refuses a changed question without an account or `relocate:true`: nothing is recorded, the waiting change is kept, the response carries `ask: "What did the old question get wrong?"`, `previous`/`proposed`, the F.1 Decision Gate card (frozen marker `[AskUserQuestion contract: shape=F.1 verbs=4]`), and a `next` instruction that says "Never write the account yourself" -- B2-03.
- `question_read` shows the waiting change FIRST (`rendered.question` first line `"A question change is waiting."`) on ANY host, including an unrecognized one where writes are refused -- proven for both `claude-ai` and `some-other-client`.
- With an account the change lands as `refines` (echoed `account_text`, one `REFINES` edge); with `relocate:true` it lands as `relocates` (one `FOLLOWS_FROM` edge); both stay in history, neither ranked.
- Close-everything persistence (B2-08) proven with SIX separate OS processes across FIVE sessions (`tests/helpers/b2-358-child.cjs`): set, a refused change, the waiting ask read in a new process/session, refines, relocates, then a sixth process in a new session reads all three versions with origins/times/change-kinds/account intact. The parent process (after every child exited) re-opens room.db directly via `navigation.readGoverningQuestionVersions` and reads the artifact files straight off disk under `<room>/.mindrian/frames` -- never trusting a child's own success claim. `scripts/room-question.cjs history --json` (a separate process again) shows the identical three versions -- Tri-Polar CLI parity.
- `question_read` / `question_set` descriptions are built entirely from `navigation.FRAME_ORIGINS_ORDERED` and `frameProvenance.QUESTION_TURN_EXAMPLES` (never a literal list), name all four origins, quote every routing example, say "not for an ordinary question" (question_set) and end with "This tool writes nothing." (question_read); both clear the 120-char floor, the 2048-byte host cap, and scan OK in `scripts/check-tool-honesty.cjs`.
- An unknown host's `question_set` is refused `write_path_disabled` with the same host block and `MINDRIAN_MCP_FIRST` hint `claim_verify` already uses (shared via the newly-exported `hostBlock`).
- Zero question/account prose in any node or edge property after a full set/refuse/refines/relocates/read cycle (A11, live scan).
- `bash tests/run-all-358.sh` (immediately after this plan's own GREEN commit, before 358-10 ran): `PASSED=35 FAILED=4 SKIPPED=0`, exit 1 -- every B2 leg PASSED; the 4 failures were exactly the plan-documented, expected-red legs (connector registry --check, tool schema budget, connector coverage, tool honesty findings closed), all four owned by 358-10 and closed by it (see 358-10-SUMMARY.md).

## Task Commits

Each task was committed atomically (TDD: RED then GREEN), plus one deviation fix ahead of Task 1 and one recovery fix after Task 3:

0. **Deviation (Rule 1, ahead of Task 1): honest P7 allowlist instead of gaming the origin-id static scan** - `90cd3ff75` (fix)
1. **Task 1: RED - MCP surfaces test (stub server legs plus the real stdio wire as claude-ai)** - `ee8eb594b` (test)
2. **Task 2: RED - close-everything persistence across processes and sessions, with CLI parity** - `9a6f66ddc` (test)
3. **Task 3: GREEN - lib/mcp/tools/question.cjs and the hostBlock export** - `0adc07fed` (feat)
4. **Recovery fix: unwrap the zod optional origin field in the A2 test check** - `37257432a` (fix) -- see Issues Encountered

_TDD Gate Compliance: RED commits (`ee8eb594b`, `9a6f66ddc`) precede the GREEN commit (`0adc07fed`) in git history. No REFACTOR commit was needed._

## Files Created/Modified

- `lib/mcp/tools/question.cjs` - `question_read` and `question_set` MCP tools, both connectors, descriptions built from `navigation.FRAME_ORIGINS_ORDERED` and `frameProvenance.QUESTION_TURN_EXAMPLES`
- `lib/mcp/tools/claim-verify.cjs` - one-line export change (`hostBlock` added), one comment line
- `lib/core/frame-provenance.cjs` - Rule-1 deviation: `TASKING_WORD` concatenation replaced with a plain regex literal plus a named `P7-ALLOW(tasking)` marker comment
- `tests/test-358-b2-part8.cjs` - P7's scan now honors the named allowlist (one line only, "tasking" alone, never "inherited")
- `tests/test-358-b2-surfaces.cjs` - A1-A13 stub-server legs + a B1 real-stdio wire leg (108 checks)
- `tests/helpers/b2-358-child.cjs` - the one-tool-call child process fixture for the close-everything persistence test
- `tests/test-358-b2-persistence.cjs` - P1-P8 legs: six processes, five sessions, direct room.db + artifact-file verification, CLI parity (33 checks)

## Decisions Made

See `key-decisions` in the frontmatter. In short: the P7-ALLOW named allowlist (deviation, see below) and the exact card-field-selection shape in `question_set`'s refusal response, both matching the plan's own action text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] P7-ALLOW named allowlist instead of the TASKING_WORD concatenation gaming the scan**
- **Found during:** Before Task 1, per this session's explicit `extra_fix` instruction (flagged from 358-08's own work, not discovered fresh here)
- **Issue:** 358-08 added `const TASKING_WORD = 'task' + 'ing'` in `lib/core/frame-provenance.cjs` solely to dodge `tests/test-358-b2-part8.cjs` P7's per-line literal scan for the origin-id substrings "tasking"/"inherited". The routing word "tasking" ("the tasking changed", military-orders usage) is natural-language routing vocabulary, not an origin-id literal -- but defeating a test's detection mechanism by construction, rather than addressing what it is actually checking for, is gaming the test.
- **Fix:** `lib/core/frame-provenance.cjs` now uses the plain regex literal `tasking` again. `tests/test-358-b2-part8.cjs` P7 gained an explicit, named allowlist: a `P7-ALLOW(tasking)` marker comment immediately above the one line permitted to contain the word, and ONLY the word "tasking" on that one line -- "inherited" is never allowlisted anywhere, and every other line in the file is still scanned exactly as before. A real hardcoded origin id anywhere else in the file (including a hypothetical hardcoded "inherited") still fails P7.
- **Files modified:** `lib/core/frame-provenance.cjs`, `tests/test-358-b2-part8.cjs` (neither is in this plan's own `files_modified` list; both edits authorized explicitly by this session's `extra_fix` instruction, since 358-09's own `files_modified` did not include either file)
- **Verification:** `node tests/test-358-b2-part8.cjs` exits 0 (P7 passes under its new name); `node tests/test-358-b2-routing.cjs` still resolves the "tasking changed" corpus item correctly (41 passed, 0 failed); `node tests/test-358-b1-*.cjs`, `test-234-tool-description-floor.cjs` all still green.
- **Committed in:** `90cd3ff75` (fix, standalone commit ahead of Task 1)

**2. [Rule 1 - Bug] Zod-optional field introspection: `.unwrap()` needed before `.options`**
- **Found during:** Task 3 GREEN verification (first run of `tests/test-358-b2-surfaces.cjs` after writing `question.cjs`)
- **Issue:** `setReg.schema.origin` is `z.enum(ORIGIN_IDS).optional()`, so it is a `ZodOptional` wrapper at runtime; `.options` is `undefined` on the wrapper itself. The enum's own `.options` (the ordered array the A2 leg needed) is only reachable via `.unwrap()`.
- **Fix:** The A2 origin-enum check now calls `originField.unwrap().options` when `.unwrap` is a function, falling back to `.options` directly otherwise.
- **Files modified:** `tests/test-358-b2-surfaces.cjs`
- **Verification:** `node tests/test-358-b2-surfaces.cjs` exits 0 (108 passed, 0 failed).
- **Committed in:** `37257432a` (fix) -- see Issues Encountered for why this needed a SECOND commit after the fix was first (correctly) applied but lost to a shared-tree git incident before being folded into any commit.

---

**Total deviations:** 2 auto-fixed (2 bugs: one plan-internal test-vs-substrate literal collision inherited from 358-08, one zod API introspection detail)
**Impact on plan:** Zero behavior change to the shipped tools from what the plan specified. No scope creep.

## Issues Encountered

**Two shared-tree git incidents, both recovered without touching any peer's work:**

1. **Accidental `data/*.json` regeneration during verification (self-caused, self-recovered immediately).** While trying to inspect `build-connector-registry.cjs --check`'s verbose output, ran `node scripts/build-connector-registry.cjs --help` -- `--help` is not a recognized flag, so the script silently ran its DEFAULT regenerate behavior instead, writing `data/connector-registry.json`, `data/connector-coverage-ledger.json` and `data/mcp-tool-connectors.json` to the working tree. This violated the plan's explicit "Do NOT regenerate data/*.json here" instruction (358-10 owns that). Caught immediately via `git status --short -- data/`; reverted with `git checkout -- <the three files>` (targeted, not a blanket reset) before anything was staged or committed. No commit was ever polluted.

2. **Peer session's `git reset` on shared main silently dropped this plan's own committed work (not caused by this execution, recovered via cherry-pick).** After Task 3's commit (`0adc07fed`) landed and this session moved on into 358-10 Task 1, a re-check during 358-10 Task 2 found that commit `201355ada` (the intended first attempt at 358-10's test-270/276 re-baseline commit) was MISSING from `git log` even though it had committed cleanly moments earlier. `git reflog` showed `HEAD@{0}: reset: moving to 6c8bee90b` -- a peer session ran `git reset` on the shared, non-worktree-isolated `main` branch, which collaterally dropped `201355ada` (this session's commit) and `b845ebdca` (a peer's own amended commit) off the branch tip. Separately, and independently, an UNCOMMITTED working-tree edit made during Task 3 (the `tests/test-358-b2-surfaces.cjs` A2 `.unwrap()` fix, see deviation 2 above) was also lost -- consistent with the peer's reset having been `--hard`, which discards uncommitted working-tree changes as well as commits. Recovery, in order: (a) confirmed `201355ada` was this session's own commit (not a peer's unowned diff) via `git log -1`; (b) confirmed it was genuinely unreachable via `git merge-base --is-ancestor`; (c) recovered it with `git cherry-pick 201355ada` (additive, non-destructive -- creates a new commit on top of the current tip, never rewrites or force-touches any ref); this produced `7dbac7f92`. A stale `.git/CHERRY_PICK_HEAD` sequencer file was left behind after that cherry-pick completed (its content had already landed; `git diff` against the target confirmed byte-identical trees) -- removed only that one metadata file, not a `git reset`/`--abort`, since the operation was already complete. Re-applied the lost `.unwrap()` test fix and committed it standalone as `37257432a`. Throughout, `git commit --only -- <this session's own files>` was used exclusively, and a peer's own concurrently-staged files (`scripts/refresh-framework-names.cjs`, `tests/test-355-framework-names.cjs`, staged but not committed by them) were left untouched in the index at every step, confirmed via `git diff --cached --name-only` before and after each of this session's commits.
- **Root cause note (per the debugging directive):** this is the exact class of incident the operator's own memory tracks as "Two-session tree collision" (WATCH, 5 prior observations, 1 with damage) -- multiple GSD sessions sharing one working tree with no worktree isolation (`isolation` not `worktree` for this phase), where one session's git plumbing operation (here, apparently a `git reset --hard` used by a peer to walk back their own mistaken `commit --amend`) has no scoping boundary and can silently discard ANY session's recent work, not just the acting session's own. This plan's execution never ran a destructive git command itself; recovery used only read-only inspection (`reflog`, `merge-base --is-ancestor`, `diff`) plus one additive `cherry-pick`.

## User Setup Required

None - no external service configuration required. Zero Brain/network calls anywhere in this plan (B1's own P5 zero-network cycle check, reused unmodified, still passes; B2's own P5 leg in `tests/test-358-b2-part8.cjs` also passes).

## Next Phase Readiness

- 358-10 can (and, in this same execution, did) regenerate `data/mcp-tool-connectors.json`, `data/connector-registry.json` and `data/connector-coverage-ledger.json` immediately after this plan's Task 3 commit landed -- the drift window (`build-connector-registry.cjs --check` reporting STALE for exactly those three files, plus `test-270`/`test-276` red) was closed within the same session, minimizing the time any peer session staging `commands/*.md`, `skills/*/SKILL.md` or `agents/*.md` would have hit the pre-commit hook's connector-registry guard.
- `lib/mcp/tools/question.cjs`'s `connectors` export (`question_read` hitl_shape `none`, `question_set` hitl_shape `F.1`, both `layer: 'harness'`) is the born-wired source of truth 358-10's regenerate read from; verified byte-for-byte against the regenerated `data/mcp-tool-connectors.json` and `data/connector-registry.json` entries in 358-10-SUMMARY.md.
- No blockers for 358-11 (the go/no-go runbook). The MCP halves of B2-AT1..AT4 and B2-06/B2-08/B2-03 are proven; the CLI halves were proven by 358-08.

## Self-Check: PASSED

- FOUND: `lib/mcp/tools/question.cjs`
- FOUND: `lib/mcp/tools/claim-verify.cjs` (modified, exports `hostBlock`)
- FOUND: `lib/core/frame-provenance.cjs` (modified, P7-ALLOW allowlist)
- FOUND: `tests/test-358-b2-part8.cjs` (modified, named allowlist)
- FOUND: `tests/test-358-b2-surfaces.cjs`
- FOUND: `tests/helpers/b2-358-child.cjs`
- FOUND: `tests/test-358-b2-persistence.cjs`
- FOUND commit `90cd3ff75` (fix, P7 allowlist deviation)
- FOUND commit `ee8eb594b` (test, Task 1 RED)
- FOUND commit `9a6f66ddc` (test, Task 2 RED)
- FOUND commit `0adc07fed` (feat, Task 3 GREEN)
- FOUND commit `37257432a` (fix, recovery)
- `node tests/test-358-b2-surfaces.cjs` exits 0 (108 passed, 0 failed)
- `node tests/test-358-b2-persistence.cjs` exits 0 (33 passed, 0 failed)
- `node tests/test-358-b1-surfaces.cjs`, `test-358-b1-persistence.cjs`, `test-234-tool-description-floor.cjs`, `test-358-b2-part8.cjs` all exit 0
- `node scripts/check-tool-honesty.cjs --report` shows `[OK]` for both `question_read` and `question_set`

---
*Phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible*
*Completed: 2026-09-23*
