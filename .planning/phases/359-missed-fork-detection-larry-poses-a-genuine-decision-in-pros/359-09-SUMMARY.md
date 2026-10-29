R8_SHA: 656cd8a3410d7f396c25b612a98b49eff846b1f2

# Phase 359 Plan 09: R8 fork declaration prose on four Larry surfaces Summary

**Larry now ends a prose fork on one line, `Your call: A | B | What if C`, on the larry-extended Decision Gates span, SKILL item 5, the session-start card-fire doctrine and the MCP runtime instructions, net +333 B, in one revertible commit.**

PLAN_BASE: `8b9690def2220485c42be4d6df1fb74911876d75`. Branch: `feat/eureka-adapter-rebased`. Every claim is PROVEN (command run in this plan) unless marked UNVERIFIED or ASSUMED.

## Commit

- Task 1: no commit. `tests/test-359-prose-budget.cjs` was written RED (B1 to B3 and B5 passed; the failures were B4 and my own two test bugs, fixed before commit) and carried into the Task 2 commit (D-16).
- Task 2 (R8, single commit): `656cd8a3410d7f396c25b612a98b49eff846b1f2`. Six paths exactly: `agents/larry-extended.md`, `skills/larry-personality/SKILL.md`, `scripts/session-start`, `lib/mcp/runtime-instructions.cjs`, `data/harness-manifest.json`, `tests/test-359-prose-budget.cjs`.
- The first commit sha was `e4ed3c7cd`. Its message said net +359 B (a mid-edit figure). I amended the message only (no content change, index was clean, not pushed) to net +333 B. The sha above is the final one.
- PROVEN: `git show 656cd8a | git apply -R --check` exits 0 (reverse patch applies cleanly).
- PROVEN: no forbidden file touched (`git diff --name-only 8b9690def 656cd8a` against the never-edit list prints nothing; `lib/core`, `scripts/check-card-fire.cjs`, `lib/mcp/stop-gate-handler.cjs` unchanged).

## Bytes per surface

| Surface | Before | After | Delta |
|---------|--------|-------|-------|
| LARRY (`## Decision Gates` span) | 955 | 1172 | +217 |
| SKILL (item 5 line) | 232 | 340 | +108 |
| DOCTRINE (raw, pin under 900) | 874 | 877 | +3 |
| MCP (served, budget 2000, host cap 2048) | 1995 | 2000 | +5 |
| **Net** | | | **+333** (cap 400) |

Notes:
- The LARRY before value is 955 B at PLAN_BASE with the plan's own awk command. 359-01 item (f) recorded 624 B for the same command. The two numbers differ, so the 359-01 figure is stale or came from a different span. The binding cap is the 400 B net total, which holds either way.
- The MCP before value is 1995 B, not the 1984 B of research time. The MCP result sits exactly at the 2000 B budget with 0 B of headroom. The next edit to that file must trim before it adds.

## Exact text per surface

**LARRY** (new paragraph, last in the `## Decision Gates` span, no other section touched):
`If a fork still ends in prose, hand the call over on the last line: Your call: A | B | What if C. Give 2 or 3 practical options, then one relevant, radical What-if moonshot (lateral; trending to the absurd is fair).`

**SKILL** (appended to the single item-5 line):
` A fork left in prose ends on one line: Your call: A | B | What if C, the last a relevant, radical moonshot.`

**DOCTRINE** (`NAV_CARD_FIRE_DOCTRINE`, one source line):
- Removed: ` That marker is the per-turn gate flag; only the imperative below moved here.` (77 B)
- Added, as its own paragraph after the [FIRE-IF-FORK] paragraph: `\n\nProse fork? Last line: Your call: A | B | What if C (radical moonshot last).`
- All five pinned tokens kept. Raw size 877 B, under the 900 B pin.

**MCP** (LOOP line; see the deviation below):
- Added: `Genuine forks use gate_render and its built-in UI if supported, else native elicitation, else text ending on: Your call: A | B | What if C (radical); no ASCII imitation.` This replaces `Genuine forks use gate_render and its built-in UI when supported, native elicitation otherwise, text only as fallback; no ASCII imitation.`
- Trimmed: `show saved understanding before next moves.` to `show saved understanding first.`
- Trimmed: `Pull suggest_next after work; propose one next move.` to `After work pull suggest_next; propose one move.`
- Trimmed: `Honor gate_answer and its real receipt.` to `Honor the gate_answer receipt.`
- Added a 3-line header comment (not served) that records the new 2000 B state.
- The persona line, the glyph line, the THEO line and the BOUNDARIES line are not changed. The word `radical` fits, so there is no MCP `radical` exception.

## Test results (HOME, USERPROFILE and MINDRIAN_ROOMS_HOME set to a temp directory)

| Command | Result |
|---------|--------|
| `node tests/test-359-prose-budget.cjs` | 18 passed, 0 failed (RED with only B4 failing before the prose) |
| `node tests/test-251-skeleton-split.cjs` | exit 0 |
| `node lib/mcp/no-instructions.test.cjs` | 18 passed, 0 failed |
| `node tests/test-gate-native-fire-w1.cjs` | PASS 12 assertions |
| `node tests/test-larry-voice-mark-182.cjs` | 106 passed, 0 failed |
| `node tests/test-205-voice-mark-hybrid.cjs` | PASS |
| `node tests/test-larry-handoff-seam.cjs` | exit 0 |
| `node tests/test-356-larry-contract.cjs` | PASS 11 checks |
| `bash tests/run-all-251.sh` | PASS=6 FAIL=0 |
| `node scripts/build-harness-manifest.cjs` then `--check` | `harness-manifest: OK` (also OK at PLAN_BASE) |
| `bash tests/run-all-359.sh` | PASS=26 FAIL=0 SKIP=0 (the prose-budget leg PASSED) |
| `node tests/test-359-inertness.cjs` | 4/4 |

## test-298 and other reds

- `tests/test-298-contract-parity.cjs` RAN (no peer diff on Larry surfaces or harness policies at run time). Result: 19 passed, 1 failed. The one failure is its closing assertion `git status --porcelain is empty`. That assertion fails on any dirty tree: my uncommitted R8 edits before the commit, and a peer's `lib/mcp/tools/eureka-graph-discovery-signals.cjs` diff after it. All tamper legs on the agent, skill and wire surfaces passed. A rerun on a clean tree is UNVERIFIED.
- `node scripts/check-first-touch-drift.cjs`: exit 1, one hit at `README.md:202` (license token wording). README.md is not in this plan. Pre-existing, not caused here. Not fixed.
- `node tests/test-267-mcpv2-dual-era.cjs` (extra check, not in the plan): PASS=3 FAIL=2. The failure is the tool snapshot, which now lists `eureka_*` and `rs_*` tools from the eureka branch. It is not caused by the prose. Not fixed.

## Deviations from Plan

**1. [Rule 3 - Blocking] The MCP instructions have no numbered items 1 to 6**
- **Found during:** Task 2, step 4.
- **Issue:** The plan names "item 3 (DECISION GATES)" and items 1, 2, 4, 5, 6. The served string has 5 lines: persona, glyph, LOOP, THEO, BOUNDARIES. The genuine-fork sentence lives in the LOOP line. The plan's example trims (`after answering, `, ` or at checkpoints`) do not exist.
- **Fix:** I put the rule in the LOOP line's genuine-fork sentence and trimmed only inside the LOOP line. The persona, glyph, THEO and BOUNDARIES lines are byte-identical (sha256 pinned in the new test).
- **Files modified:** `lib/mcp/runtime-instructions.cjs`. **Commit:** 656cd8a.

**2. [Rule 1 - Bug] Two bugs in my first draft of the test, fixed before the commit**
- `MARK_GLYPHS` is keyed by glyph, so `Object.values` returned color names. I switched to `Object.keys`. The test file also held literal dash characters from its own escape strings. I replaced them with `String.fromCharCode`. Both were fixed while the test was still uncommitted.

**3. Wrong hermetic HOME in my early runs**
- My first `export T=... HOME=$T` set HOME to an empty string. The first `run-all-359.sh` run failed one forward-harness leg because of it. I reran everything with HOME set correctly. The results in this file come from the correct runs.

## Known Stubs

None.

## Threat Flags

None. Prose only; no new endpoint, auth path or schema.

## Handoff to plan 10 and 11

- Read `R8_SHA` from line 1 of this file. Revert exactly that commit for the R9 falsification branch.
- The test `tests/test-359-prose-budget.cjs` reverts with the prose, so after a revert `tests/run-all-359.sh` skips the prose-budget leg, because the leg uses `run_if` (ASSUMED from the script logic, not run).
- MCP instructions are at the 2000 B limit. Any later edit must net to 0 B or less.

## Self-Check: PASSED

- FOUND: `tests/test-359-prose-budget.cjs`, the four prose files and `data/harness-manifest.json` in commit 656cd8a.
- FOUND: commit 656cd8a3410d7f396c25b612a98b49eff846b1f2 (`git log` lists it on `feat/eureka-adapter-rebased`).
- PROVEN: 0 em-dashes in the five files (`grep -c` of the em-dash byte reports 0 each).
