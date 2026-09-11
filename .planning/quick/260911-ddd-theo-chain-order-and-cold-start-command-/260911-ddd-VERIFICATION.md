---
phase: quick-260911-ddd
verified: 2026-09-11T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Quick 260911-ddd: Theo Chain Order and Cold-Start Command Verification Report

**Task Goal:** Command-bearing-first tiebreak in `_composeTheoAsk` with `theo_rank` and `option_order`, session-start Brain pre-warm, and a raised Tier 3 bound in brain-router.
**Verified:** 2026-09-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Theo chain whose top-ranked framework carries no `/mos:` command surfaces a command-bearing framework as `next_gate.options[0]` and as `directive.guided.framework`. | VERIFIED | `lib/core/brain-client.cjs:1305-1310`: `directive.guided.framework = (sortedOptions[0] && sortedOptions[0].framework) \|\| null`; `next_gate.options = sortedOptions`. Live e2e (`node tests/test-339-theo-ask-e2e-live.cjs`) prints `directive.guided.framework: "Red Teaming"` against the real live IllDefined chain, and asserts `options[0].commands.length > 0` — both `ok`. Unit test `node tests/test-339-theo-ask-compose.cjs`: 12/12 pass, including the DDD-1 arm pinning `options[0]`→Red Teaming on the mixed no-command-top fixture. |
| 2 | Theo's own ranking stays readable on every option as `theo_rank`; never altered at the source. | VERIFIED | `lib/core/brain-client.cjs:1266-1274`: `theo_rank` computed from `s.step` (fallback: 1-based index) BEFORE the sort, so the reorder cannot leak into it. Live e2e: `options[0].theo_rank is a finite number` → ok. Compose test DDD-3 arm covers step-absent fallback. |
| 3 | A chain where every option carries a command, or no option does, comes back in Theo's original order. | VERIFIED | `lib/core/brain-client.cjs:1291-1300`: two-queue forward-pass partition; when one queue is empty, concatenation is the identity. Compose test DDD-2 arm (all-command / no-command chains) passes — part of the 12/12. |
| 4 | `grounding.option_order` names the applied ordering on every composed envelope, including the degraded catch path. | VERIFIED | `lib/core/brain-client.cjs:1327` (success path) and `:1345` (catch path) both set `option_order: 'command_bearing_first'`. Live e2e: `grounding.option_order === 'command_bearing_first'` → ok. Compose test DDD-4 arm covers the catch path explicitly. |
| 5 | The Brain MCP shim fires exactly one content-free `theo_health` probe at startup on CLI, Desktop and Cowork, and no tool handler ever awaits it. | VERIFIED | `bin/mindrian-brain-mcp-client.cjs:312-324`: `prewarm()` called (un-awaited, `.catch(() => {})`) after `await server.connect(transport)`, inside `main()`, not inside any tool handler. `.mcp.json` `alwaysLoad: true` makes this fire on all 3 surfaces (unchanged by this plan, cited in code comment). `tests/test-339-brain-prewarm-cold-start.cjs` Arm 5: source-shape scan confirms `prewarm(` call is not preceded by `await` on the same line — pass. |
| 6 | The pre-warm marker holds only `{at, ok, origin_host}`; no Brain response body is ever persisted (Canon Part 8). | VERIFIED | `lib/core/brain-prewarm.cjs:143-146`: marker object literal has exactly 3 keys. `tests/test-339-brain-prewarm-cold-start.cjs` Arm 1: plants a canary (`secret`, `build_stamp`, `sha`) in a fake probe response and asserts none of it reaches the marker file text — pass. Never writes stdout (only stderr under `MINDRIAN_DEBUG`) — confirmed by reading the file. |
| 7 | brain-router's Tier 3 bound is one named constant with an env override, read by both the router and the composition census, with no second literal anywhere. | VERIFIED | `lib/mcp/brain-route-bound.cjs` exports `BRAIN_ROUTE_TIMEOUT_MS = 6000` and `resolveBrainRouteTimeoutMs(env)`. `brain-router.cjs` requires it and calls the resolver at race-build time (grep confirms no bare `2000`/`6000` literal used as a bound value in brain-router.cjs — only prose/comments reference 6000). `brain-composition-census.cjs:111` reads `BRAIN_ROUTE_TIMEOUT_MS` for the brain-router entry's `bound_ms` (a separate, unrelated `bound_ms: 20000` at line 137 belongs to a different composition site — `sensors.cjs`'s `suggest_next`, out of this plan's scope, pre-existing). `test-254-composition-census.cjs` Arm 9 pins `bound_ms === BRAIN_ROUTE_TIMEOUT_MS` and greps for the dead `2000` literal — part of the 10/10 pass in `run-all-254.sh`. |
| 8 | `/mos:act` still resolves when Theo is genuinely down: the race rejects at the bound and Tier 2's already-computed local heuristic answers. | VERIFIED | `lib/mcp/brain-router.cjs`'s `localRec` is computed before the `Promise.race` (unchanged code path, confirmed by reading around line 458-472); this behavior predates this plan and this plan did not touch it. `tests/test-339-brain-prewarm-cold-start.cjs` Arm 2a/2b confirm reject/timeout both degrade gracefully without throwing on the prewarm side. No regression test needed on brain-router's own Tier-2 fallback since brain-router.cjs's fallback logic itself was not modified, only the bound source. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/brain-client.cjs` | command-bearing-first stable partition, theo_rank, grounding.option_order in `_composeTheoAsk`; contains `command_bearing_first` | VERIFIED | Confirmed present at lines 1291-1345, both paths. |
| `lib/core/brain-prewarm.cjs` | content-free theo_health pre-warm, injectable probe seam, `{at, ok, origin_host}` marker; exports `prewarm`, `markerPath`; min_lines 60 | VERIFIED | 164 lines. `node -e "require(...)"` confirms both exports are functions. |
| `lib/mcp/brain-route-bound.cjs` | single source of Tier 3 bound + env-override resolver; exports `BRAIN_ROUTE_TIMEOUT_MS`, `resolveBrainRouteTimeoutMs` | VERIFIED | 66 lines. Both exports confirmed present and correctly typed (number, function). |
| `tests/test-339-brain-prewarm-cold-start.cjs` | RED-first arms for marker, non-blocking contract, bound constant; min_lines 80 | VERIFIED | 199 lines. `node tests/test-339-brain-prewarm-cold-start.cjs` → 6/6 pass (Arms 1, 2a, 2b, 3, 4, 5). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/mindrian-brain-mcp-client.cjs` | `lib/core/brain-prewarm.cjs` | non-awaited `prewarm()` call inside `main()` after `server.connect` | WIRED | Confirmed at lines 312-324; `.catch(() => {})` voids the promise, no `await`. |
| `lib/core/brain-prewarm.cjs` | `lib/core/brain-client.cjs` | `callTool('theo_health', {})` default probe | WIRED | Confirmed at line ~121 of brain-prewarm.cjs, required lazily inside the default probe closure. |
| `lib/mcp/brain-router.cjs` | `lib/mcp/brain-route-bound.cjs` | `resolveBrainRouteTimeoutMs()` in the Tier 3 `Promise.race` | WIRED | Confirmed via grep; comments at :468-472 show the race reads the resolver at call time; no bare `2000` bound literal survives. |
| `lib/mcp/brain-composition-census.cjs` | `lib/mcp/brain-route-bound.cjs` | `bound_ms` reads `BRAIN_ROUTE_TIMEOUT_MS` | WIRED | Confirmed at line 111 (`const { BRAIN_ROUTE_TIMEOUT_MS } = require('./brain-route-bound.cjs')`) feeding the brain-router entry's `bound_ms`. |
| `scripts/session-start` | `lib/core/brain-prewarm.cjs` | detached CLI spawn, existing guarded idiom | WIRED | Confirmed at line 1933: `( node "${PLUGIN_ROOT}/lib/core/brain-prewarm.cjs" >/dev/null 2>&1 \|\| true ) &`, placed outside the `if [ -d "$ROOM_DIR" ]` guard. |

### Probe / Test Execution (Re-run Independently, Not Trusted from SUMMARY)

| Command | Result | Status |
|---------|--------|--------|
| `node tests/test-339-theo-ask-compose.cjs` | 12/12 pass | PASS |
| `node tests/test-339-brain-prewarm-cold-start.cjs` | 6/6 pass | PASS |
| `node tests/test-339-theo-ask-e2e-live.cjs` | PASS (not SKIP) — `directive.guided.framework: "Red Teaming"`, all 3 new checks `ok`, `options[0].commands.length > 0`, `options[0].theo_rank` finite, `option_order === 'command_bearing_first'` | PASS |
| `bash tests/run-all-254.sh` | PASS=10 FAIL=0 SKIP=0 | PASS |
| `node scripts/doctor.cjs --acceptance` | 20/20 points passed (clean tree) | PASS |
| `bash tests/run-all-339.sh` | PASS=13 FAIL=2 SKIP=0 — both failures independently confirmed pre-existing (see below) | PASS (with pre-existing reds accounted) |
| `bash tests/run-all-252.sh` | PASS=2 FAIL=0 SKIP=0 | PASS |

**run-all-339.sh's two failures, independently confirmed pre-existing:**

1. `test-339-update-path-single-source.cjs` (Arm 5, `scripts/collect-cold-install-evidence.cjs:365`) — appears verbatim in `baseline-reds.txt` captured at HEAD `5ce0dd3a`. Confirmed by reading `baseline-reds.txt` directly (not trusting the SUMMARY's claim): identical failure text present.
2. `dist bundle staleness (build-dist-bundles.cjs --check-stale)` — NOT one of the four legs in `baseline-reds.txt` by name, so I independently reproduced it: created a throwaway git worktree at `5ce0dd3a` (`git worktree add --detach /tmp/ddd-verify-baseline 5ce0dd3a`, no `git stash` used per D-05), symlinked `node_modules` in (read-only, no repo mutation), and ran `node scripts/build-dist-bundles.cjs --check-stale` there. Output: `dist bundle STALE: bundle was generated from 2.0.0-beta.32, the live plugin is 2.0.0-beta.34` — byte-identical to the failure at HEAD. Worktree removed after (`git worktree remove --force`). This confirms the SUMMARY's claim rather than merely repeating it.

### Tier 3 Bound Single-Source Check

`grep -n "2000\|6000" lib/mcp/brain-router.cjs` → only comment/prose occurrences (lines 9, 18, 297, 433, 469, 472), none is a bound value literal; the actual bound comes from `resolveBrainRouteTimeoutMs()` read at call time.
`grep -n "2000\|6000" lib/mcp/brain-composition-census.cjs` → one hit, `bound_ms: 20000` at line 137, which belongs to a DIFFERENT composition site (`lib/mcp/tools/sensors.cjs`'s `suggest_next` → `chainOfferForReach`), not the brain-router Tier 3 entry. The brain-router entry (line ~111) correctly reads `BRAIN_ROUTE_TIMEOUT_MS` from the leaf. This is not a violation — it's an unrelated, pre-existing timeout for a different call path outside this plan's scope.
`MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS` override confirmed functional: `resolveBrainRouteTimeoutMs({MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS:'9000'})` → 9000; malformed values fall back to 6000 (Arm 4 of the cold-start test suite, and independently spot-checked via `node -e`).

### D-04 Forbidden-File Check

`git diff 5ce0dd3a..HEAD -- hooks/hooks.json lib/core/part8-egress-guard.cjs lib/core/directive-envelope.cjs lib/core/doctor/class-m-brain-smoke.cjs` → empty (0 lines). No alias table files appear anywhere in the full `git diff 5ce0dd3a..HEAD --stat` (13 files changed, all named and expected).

### Em-Dash Scan (Added Lines Only, All 3 Commits)

`git show <commit> | grep '^+' | grep -v '^+++' | grep -P '\x{2014}'` for `82fe040d`, `be7b6c79`, `e832136f` → zero matches in all three.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| DDD-01 | Command-bearing-first chain order fix | SATISFIED | `_composeTheoAsk` partition, theo_rank, live e2e proof. |
| DDD-02 | Cold-start pre-warm + raised Tier 3 bound | SATISFIED | `brain-prewarm.cjs`, `brain-route-bound.cjs`, shim + session-start wiring. |
| DDD-03 | RED-first cold-start test coverage + full verification run | SATISFIED | `test-339-brain-prewarm-cold-start.cjs` 6/6, full suite run reproduced. |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in any of the 13 touched files (spot-checked via targeted grep during review of each file's content above; no matches surfaced in any file read in full).

### Human Verification Required

None. All truths are verifiable via code inspection and automated test execution; the live e2e test reached the real Brain and passed, removing the need for a human-run manual check.

### Gaps Summary

No gaps. All 8 must-have truths verified against actual code (not SUMMARY claims), all 4 required artifacts exist and meet size/export contracts, all 5 key links are wired, all required test commands were independently re-run (not trusted from the SUMMARY) and passed, the Tier 3 bound is genuinely single-sourced (the one extra `bound_ms: 20000` literal found belongs to an unrelated composition site, confirmed by reading the surrounding array entry), the two run-all-339 failures were independently confirmed pre-existing (one by reading baseline-reds.txt directly, one by reproducing in a throwaway worktree at the baseline commit), the four D-04 forbidden files are diff-empty, and no em-dashes were introduced in any of the three commits' added lines.

---

*Verified: 2026-09-11*
*Verifier: Claude (gsd-verifier)*
