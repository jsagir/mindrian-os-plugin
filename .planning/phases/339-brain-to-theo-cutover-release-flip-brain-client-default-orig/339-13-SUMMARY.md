---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 13
subsystem: release
tags: [release, flip, theo, coverage-gate, npm, verify-release, doctor-acceptance]

requires:
  - phase: 339 (plans 01-12)
    provides: the flip itself, all paired values, the FLIP CHANGELOG entry, and a released verified v2.0.0-beta.17 as the safe base
provides:
  - v2.0.0-beta.19 released and verified on all four surfaces, WITH the flip inside the install cache (confirmed the actual cached brain-client.cjs now defaults to theo-mcp.onrender.com)
  - the coverage gate confirmed live, zero writes in either repo, ruling sentence quoted verbatim
  - Session T told the flip was cutting, same-minute reading taken and recorded
  - probe-brain-contract.cjs run against the live flip, all five legs matching the phase's own documented predictions
  - one real recovery: release.sh's ahead-of-origin guard correctly refused an auto-push mid-run; completed manually
affects: [339-14, Theo Phase 9 plan 09-12 Task 2/3]

tech-stack:
  added: []
  patterns:
    - "A blocking gate that reads a cross-repo authorization file must scope by HEADING (awk anchored on the exact heading text with an exit on the next heading), never by line number, and match every literal with grep -F never grep -E, because a coverage percentage like 88.4% contains a regex-significant character"
    - "Theo showed genuine, named, explicit rate-limiting (JSON-RPC -32005 'Rate limit exceeded') during and after the flip cut, intermittent (roughly 40-60% failure rate observed over ~20 minutes), self-identifying rather than a silent timeout -- distinguishable from a code defect because successful calls in the same window return correct, well-formed Theo payloads"

key-files:
  created:
    - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-13-SUMMARY.md
  modified:
    - .claude-plugin/plugin.json, package.json (2.0.0-beta.18 -> 2.0.0-beta.19 -> 2.0.0-beta.20, via release.sh Commits A and B)
    - CHANGELOG.md (Unreleased -> v2.0.0-beta.19 released heading, fresh Unreleased -> v2.0.0-beta.20 opened)
    - dist/BUNDLE-VERSION.json (release.sh)

key-decisions:
  - "Navigator confirmed the coverage gate, then Part A's clean-tree items, then Part B's Theo rate-limiting finding (skip the live-network activation gate for this run, DOCTOR_SKIP_ACTIVATION_GATE=1, since the underlying capability was independently proven working when not rate-limited), then Part C's actual release.sh invocation, then the mid-release push recovery -- five separate explicit confirmations, matching this phase's established discipline of stopping at every real decision point rather than one blanket go-ahead."
  - "When release.sh's Step 8 ahead-of-origin guard refused to push (16 commits ahead vs the 2 it expected, because Phase 275 closed out its own 8-plan phase and landed 14 commits on the shared tree during Part B), did NOT re-run release.sh. By that point Steps 9.5 (npm publish), 9.6b (website sync) and 9.7 (npx self-test) had already succeeded -- confirmed by direct evidence (npm dist-tags, live website poll, and the step's own success line in the captured log) -- so the substantive release was already real. Pushed manually (git push origin main --tags) and completed Steps 9.8/10/11 by hand, the same recovery pattern already established for the beta.17 cut's Step 5.5 false-alarm."
  - "The marketplace repo's own push was ALSO caught in the same guard's blast radius (release.sh's Step 9 pushes both repos together): its Commit was made locally but never reached origin, so the first marketplace-cache refresh attempt correctly reported the stale beta.17 version. Traced directly (checked the marketplace repo's own git log/status rather than assuming the cache tool was broken), pushed it, re-ran the refresh, and it corrected to beta.19."
  - "D-15's post-release verification (exercise brain_stats/brain_ask, confirm structured Theo answers, run probe-brain-contract.cjs) was performed against live, currently-rate-limited Theo traffic. Did not retry indefinitely to force a clean reading once the rate-limiting pattern was itself confirmed and named (explicit -32005 responses, not silent failures) -- reported the intermittent condition honestly to Session T as a soak-worth-watching finding, backed by prior successful reads (this session's own 3-of-5 rapid test, and Session T's own successful flip-cue reading) rather than manufacturing an artificially clean report by hammering a known-degraded origin."

patterns-established:
  - "A release-train guard refusing an automated push mid-flight (ahead-of-origin count mismatch from concurrent-tree churn) is a SUCCESSFUL safety outcome, not a failure to route around blindly: verify what already landed (publish, website, tag) before deciding whether the refused push itself is safe to complete, and treat a shared-tree phase's own legitimate closed-out commits as fine to ride along, exactly as Phase 276's did in the PREP cut."

requirements-completed: [FLIP-09, FLIP-10, FLIP-11]

duration: ~2h (coverage gate, Session T coordination, the full Part A/B gate sequence including a Theo rate-limiting investigation, the cut itself, and manual recovery of the push-refused tail plus post-release verification)
completed: 2026-09-04
---

# Phase 339 Plan 13: The FLIP CUT (v2.0.0-beta.19) Summary

**v2.0.0-beta.19 is released and verified on all four surfaces, and -- confirmed directly in the actual installed plugin cache, not just the dev tree -- `lib/core/brain-client.cjs` now defaults to `https://theo-mcp.onrender.com`. Every installed MindrianOS user's Brain traffic moves to Theo once they run the two-command update. This is the phase's central goal, delivered.**

## Performance

- **Duration:** ~2h across the coverage gate, Session T coordination, the full pre-flight gate sequence (including one real Theo-side rate-limiting investigation), the cut, and manual recovery of a mid-release push refusal
- **Completed:** 2026-09-04
- **Tasks:** 3/3
- **Files modified:** 4 (release.sh-managed version files only; no hand edits)

## Accomplishments

### Task 1: The blocking coverage gate

Read `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md` READ ONLY, scoped by heading (`awk` anchored on the exact heading text, exit on the next `##`/`###`), never by line number. Confirmed the scoping itself: the extraction did NOT contain `Flip instructions for the plugin release` (the next section's heading), proving the `awk` boundary held.

All eleven items confirmed live: `Brain@56bf75a` and `83a1ce2` pins present; canon `1,253` / `1,522` / `420`; Brain `29,200` / `24,375` / `258`; `Covered: 228 of 258, 88.4%`; `Uncovered: 30 of 258`; no `HOLD` token. Every literal matched with `grep -F`, never `grep -E`.

**The ruling sentence, quoted verbatim from the run-time read**: "Coverage does NOT block Task 2, the flip." Two informing facts carried into the navigator's confirmation: the 30 uncovered names bind Theo's decommission task, not this flip; the named-Frameworks ratio is retired as a coverage measure by the ruling's own clause 4.

`tests/test-339-gate-zero-write.sh`: PASS. Porcelain sha256, BOTH repos, byte-identical before and after:
- Plugin repo: `0004d5b8187af324eb427c3a98d5be49fdbdd5d8d5505d0d590bc76438943e22` (before and after)
- Theo repo: `192b6a958bb60cad487e76bd2d767efaacf94f49910b0058c778dfcefe907cbd` (before and after)

No `git fetch` in Theo, no scratch file, no `sed` against any Theo file.

### Task 2: Orchestrator action -- Session T notified, same-minute reading taken

Sent Session T the exact cue: "cutting the flip now."

**Session T's reply, quoted verbatim**, taken starting at the cue, all against `https://theo-mcp.onrender.com`:
- `GET /health`: 11:07:58.375Z, HTTP 200, 0.304s, `{"status":"ok"}`
- `tools/list`: 11:07:58.679Z, HTTP 200, 0.296s, 30 tools (matches the 339-11 pre-flip reference)
- `brain_stats` (first graph-touching call): first two attempts HTTP 429, backed off 3s each, third attempt at 11:08:27.915Z succeeded -- HTTP 200, 1.726s (matches the pre-flip reference's 1.762s cold number almost exactly). Payload: nodes 1253, relationships 1522, no `backend` key, labels dict matching the reference exactly -- a genuine Theo answer.
- `theo_health`: 429'd on every attempt as of T's reply (the one gap in the reading).

Worst successful latency: 1.726s against the 20s budget. **An anomaly worth flagging, not silently smoothed over**: something was issuing enough concurrent traffic to `theo-mcp.onrender.com` right at the cut window to trip repeated 429s. Independently confirmed with a direct `/health` check from this session moments later: HTTP 200, 0.29s, clean -- the immediate storm cleared, though (see Part B below) intermittent rate-limiting continued for the rest of the cut window.

Reply received well BEFORE Task 3's `release.sh` invocation. Zero writes by this task in either repo.

### Task 3: The flip cut

**Part A (clean-tree confirmation), all five items confirmed**: Phase 276 still paused at 276-15 (unchanged, no mid-plan work); tracked `git status --porcelain` empty; 9 commits ahead of origin, all Phase 275's own legitimate concurrent work (confirmed by inspecting the commit list, not assumed); npm/website/claude all present; `## [Unreleased]` heading present.

**Part B (push and gates)**: Pushed. `tests/run-all-339.sh` PASS=12, `run-all-250/252/276.sh` all green, the six named individual test files all green, the seven registry/coverage/anchoring checks all green (zero plugin-path-anchoring violations this time -- the 339-11 fix held). `verify-release`: **36 passed, 0 failed, 2 warnings** (both expected: 39 pre-existing render-quality nits, the CHANGELOG-version-label warning). **Gate 19 (Brain tool liveness) passed** -- confirms this phase changed zero tool names, only descriptions.

**A real, investigated finding: Theo rate-limiting.** `doctor --acceptance` FAILED `activation-reached-the-wire` (its L3 HTTPS schema probe returned null). Traced directly rather than assumed: five rapid manual calls to the exact same code path (`brain-client.cjs`'s `schema()`) gave 3 successes (1.7-4.8s, genuine schema payloads with the correct labels/relationship_types/property_keys shape) and 2 fast failures (~330ms, consistent with an immediate rate-limit rejection rather than a timeout). This corroborates Session T's own 429 finding from the Task 2 reading. Navigator ruled: skip the live-network activation gate for this run (`DOCTOR_SKIP_ACTIVATION_GATE=1`), since the underlying capability was independently proven working and `verify-release`'s own hermetic gate 19 already covers tool-registration liveness. `doctor --acceptance --light-npx` with the skip: **18/18**. `release.sh --prerelease --dry-run`: confirmed `2.0.0-beta.18 -> 2.0.0-beta.19`.

**Part C, the cut.** Navigator approved. `bash scripts/release.sh --prerelease` ran. Steps 9.5 (npm publish), 9.6b (website sync) and 9.7 (npx self-test, untimed) all succeeded, confirmed directly in the captured log and independently: `@mindrian_os/cli@2.0.0-beta.19` published, dist-tags `latest`/`next` both promoted, `mindrian-os.com` live-polled serving `2.0.0-beta.19`.

**Step 8's ahead-of-origin guard then correctly refused to push**: "16 commits ahead of origin/main but only 2 are this release." Phase 275 had closed out its entire 8-plan phase (its own final commit, `docs(275-08): complete migration-phase-assertion-suite-and-phase-close plan`) and landed 14 commits on the shared tree during Part B, on top of this cut's own 2 release commits (Commit A `release: v2.0.0-beta.19`, Commit B `chore: bump to v2.0.0-beta.20`). The script exited under `set -e` at this guard, BEFORE Step 9's push, Step 5.5's tag verification, Step 9.8, Step 10, or Step 11 ran.

**Recovery, navigator-approved**: verified the substantive release had already landed (npm dist-tags, live website) before deciding to push. Pushed manually: `git push origin main --tags` (16 commits, including Phase 275's own legitimate closed-out work -- reviewed as a commit list, not blindly trusted). Tag confirmed at origin via `git ls-remote --tags origin`. Completed the remaining steps by hand:
- **Step 9.8**: `doctor --acceptance --light-npx` with `DOCTOR_SKIP_ACTIVATION_GATE=1` (the same confirmed rate-limiting): **18/18**.
- **Step 10**: `claude plugin marketplace update mindrian-marketplace` -- first attempt showed the marketplace CACHE still at beta.17. Traced directly (not assumed broken): the marketplace repo's own `release: sync to v2.0.0-beta.19` commit existed locally but had never reached origin, caught in the SAME Step-8 guard's blast radius (release.sh's Step 9 pushes both repos together). Pushed `~/mindrian-marketplace` (`git push origin master`), re-ran the update, cache corrected to `2.0.0-beta.19`.
- **Step 11**: remote HEAD (`2ea5ccac...`) matches local HEAD exactly. `claude plugin validate .` passed with one pre-existing, unrelated warning (root `CLAUDE.md` not auto-loaded as plugin context).

**Shipped tag, read back from git**: `v2.0.0-beta.19` (commit `39a096aa`). `.claude-plugin/plugin.json` after Commit B: `2.0.0-beta.20`. No version bumped by hand anywhere.

### Post-release verification (D-15), against the actual install cache

Ran the real two-command update path (`claude plugin marketplace update mindrian-marketplace`, `claude plugin update mos@mindrian-marketplace`): cache moved `2.0.0-beta.17 -> 2.0.0-beta.19`. **Confirmed directly in the cached tree** at `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.19/`:

- `lib/core/brain-client.cjs:24`: `const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com';` -- **the flip is live in the actual installed cache.**
- `lib/core/doctor/class-m-brain-smoke.cjs`: `CANON_BRAIN_URL = 'https://theo-mcp.onrender.com'`, `THEO_NODE_FLOOR` present (4 occurrences).
- `plugin.json` version: `2.0.0-beta.19`.

**`scripts/probe-brain-contract.cjs`** run against the live flip. Every leg matched this phase's own documented predictions exactly:
- Leg a (`loop_tools` present in `tools/list`): PASS.
- Leg d (`search`/`brain_search`, no local-path leak): PASS.
- Leg b: FAILED as documented -- `text2cypher` returned HTTP 200 (Theo serves it; the expected 403 never arrives), `brain_ask_anything` also returned 200 rather than the incumbent's allowlist-gate 403.
- Leg c: `c2` (write attempt) returned exactly the documented typed code: `PLAN_REJECTED: query classified 'rw', not read-only`. `c1` and `c3` hit explicit rate-limiting: `{"error":{"code":-32005,"message":"Rate limit exceeded"}}` -- the same condition from Task 2's reading, still present.
- Leg e (index dispositions): FAILED as documented -- Theo's Aura instance does not carry the incumbent's Memgraph index names (`mindrian_methodology_vec`, `mindrian_methodology_vec_openai` both absent, as expected).

Direct `bc.stats()` / `bc.ask()` calls: intermittent nulls (fast-fail, ~250-370ms) consistent with continued rate-limiting during this verification window, interleaved with the successful reads already documented above (this session's own earlier 3-of-5 rapid `schema()` test, and Session T's own successful `brain_stats` read at the flip-cue). **Reported honestly to Session T as a soak-worth-watching finding** rather than manufacturing an artificially clean report by repeatedly hammering a known-degraded origin -- roughly 40-60% of direct calls in the ~20-minute post-cut window returned the named rate-limit error, the rest returned correct, well-formed Theo payloads.

`/register` probed directly from this installed client's perspective: HTTP 200 in 0.37s, opaque token, matching Session T's own prior finding that Theo never validates it.

**Full flip-record section 4 fields, reported to Session T**: final URL `https://theo-mcp.onrender.com`; shipped version `v2.0.0-beta.19`; cold-start latency `1.726s` (Session T's own reading); `/register` route `200, opaque token, unchecked`; decommission date blank (Session T's); `brain_schema` flush `not needed, by design (D-13)`.

## Deviations

1. **Theo-side intermittent rate-limiting**, investigated and corroborated across three independent observations (Session T's flip-cue reading, this session's direct manual retries, and `probe-brain-contract.cjs`'s own captured 429 evidence) rather than assumed or ignored. Not a code defect: every successful call in the same window returned correct, well-formed Theo payloads. Reported to Session T as a soak-window watch item.
2. **release.sh's ahead-of-origin guard correctly refused an automated push** when Phase 275 closed out its own phase mid-flight, landing 14 unrelated commits on the shared tree during Part B. The substantive release (npm publish, website sync, npx self-test) had already succeeded by that point. Recovered manually: pushed both repos (plugin + marketplace, the marketplace push having been caught in the same guard's blast radius), then completed Steps 9.8/10/11 by hand -- the same recovery pattern already established for the beta.17 cut.

Neither finding is a phase 339 defect; both are environment conditions this plan's execution surfaced and worked through, each with the navigator's explicit sign-off at the point of decision.

## Requirements Completed

FLIP-09, FLIP-10, FLIP-11 -- the flip is gated on a live human-confirmed coverage ruling with zero writes to either repo, Session T took its same-minute reading before the cut, and the release is verified in the actual installed cache, not just the dev tree.
