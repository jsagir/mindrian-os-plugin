---
phase: quick-261002-5v9
verified: 2026-10-02T02:09:28Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
commits_under_test: [b2565693c, 37d7b0c32, a290afda3, 6a386bb3b, c266d7cf0, 4f3727056]
---

# Quick 261002-5v9: Release-cut listener Verification Report

**Goal:** a plugin release cut automatically drives (a) the Theo command-registry release sync (Step 0.55, before the stamp gates) and (b) a read-only mindrian-website version-fact check (Step 9.6c), failing open with a visible report and no silent skips.
**Verified:** 2026-10-02T02:09:28Z (HEAD c99301b4f; all six commits under test are ancestors of HEAD; no commit after 4f3727056 touches any owned file; no uncommitted diff on any owned file)
**Status:** passed
**Re-verification:** No (initial)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `theo --dry-run` prints the exact contract call (THEO_PYTHON, release_sync.py, --plugin-root, --version = repo-version.cjs, --ref = 40-hex HEAD, --json) and spawns nothing | VERIFIED | Live run: `call: /home/jsagi/Theo/.theo-graph/.venv/bin/python3 /home/jsagi/Theo/.theo-graph/release_sync.py --plugin-root /home/jsagi/dev/MindrianOS-Plugin --version 2.0.0-beta.56 --ref fb8563bf68d928e6bbace98f4c3fa81bea191fdf --json`, exit 3; `node lib/core/repo-version.cjs` = 2.0.0-beta.56 and `git rev-parse HEAD` = fb8563bf6... at that moment. Code: `runTheoLeg` returns before `deps.spawnSync` when `opts.dryRun` (release-cut-listener.cjs:381-383). Unit "--dry-run with Theo present -> ... spawns nothing" and wiring sentinel check (stub python never touched) both pass. Theo `git status --porcelain` identical before/after. |
| 2 | Every Theo exit code maps per docs/RELEASE-SYNC-CONTRACT.md; unknown, unparseable/inconsistent JSON and timeout all STOP; proven offline with a fake spawn | VERIFIED | THEO_EXIT_MAP keys 0,1,2,3,5,10,20,21,22,23,30,31,40 match the 14 rows of /home/jsagi/Theo/docs/RELEASE-SYNC-CONTRACT.md lines 58-71 (read by me). 0 -> RAN-OK/CONTINUE, 21 -> RAN-DRIFT/CONTINUE with manual-commit follow-up, 20/22 -> STOP-WITH-ACTION with apply/verify pushed verbatim as their own action lines (printed outside the box, unwrapped, renderReport:674-677), rest STOP. mapTheoResult enforces contract field, exit_code equality, status-belongs-to-code; unknown code, missing/unparseable JSON, ETIMEDOUT or signal -> STOP. Unit suite asserts each (lines 142-245, 320) plus a lockstep check against the live contract doc (14 rows): 41/41 pass. Static check of Theo release_sync.py: CONTRACT = "theo-release-sync/1", `--json` writes one `json.dumps` line to stdout (line 885), progress goes to stderr (line 171), field names contract/exit_code/apply_command/verify_command/followon_command/windows/ends_when all present. |
| 3 | Missing Theo checkout / venv python / release_sync.py -> loud `SKIPPED: <reason>` naming the path, listener exit 3; release.sh continues and Step 0.6 stamp gate still runs | VERIFIED | Code checks THEO_DIR, python, script in order (listener:371-379). Live: `THEO_DIR=/nonexistent/theo-xyz bash scripts/release.sh patch --dry-run` -> rc 0, box shows `SKIPPED: THEO_DIR not found at /nonexistent/theo-xyz; Theo was NOT asked ...`, then the `[DRY RUN] theo-stamp-gate: MISMATCH ...` line follows (Step 0.6 ran). Unit: three SKIPPED paths, spawn never called, exit 3. |
| 4 | Website leg read-only; OK/DRIFT/MISSING per version surface, DRIFT per literal `N commands`, every banned hit with file:line; fixture bytes identical | VERIFIED | Live `website --version 2.0.0-beta.55 --json --report-dir <scratch>`: exactly one stdout line, contract mos-release-cut-listener/1, exit 4, RAN-DRIFT; rows: FALLBACK_VERSION OK, commands-canon version DRIFT (2.0.0-beta.51 vs 2.0.0-beta.55, line 2), count OK (113), 6 GONE, 2 REVIEW, 1 UNMIRRORED (src/lib/facts.ts:46), BANNED vanity-graph-count the-wrong-bottleneck/page.tsx:798, 2 ALLOWED JHU Press citations. Website `git status --porcelain` and a sha256 over every src file (excluding .next, node_modules) identical before and after. Only write calls in the listener are the report mkdir/write in main (lines 807-809). Unit sha256 fixture proof passes. |
| 5 | release.sh runs Theo leg at Step 0.55 (after 0.5, before 0.6), stops a real cut on 10/11; website leg at Step 9.6c (after 9.6b, before 9.7), never aborts; `--no-cut-listener` audited at both; `--dry-run` lists both, runs no Theo, writes no file | VERIFIED | Diff a290afda3: Step 0.55 block inserted immediately before `# --- Step 0.6`, `exit 1` only in the 10/11 arm and only when DRY_RUN != 1; Step 9.6c inserted immediately before `# --- Step 9.7`, no `exit`, all arms YELLOW/GREEN. Both legs print a YELLOW audited line under NO_CUT_LISTENER=1. Live `release.sh patch --dry-run`: rc 0, Step 0.55 and Step 9.6c listed, plugin/website/Theo porcelain identical, `~/.mindrian/release-cut-listener` not created. `--no-cut-listener --dry-run`: rc 0, audited line at Step 0.55, SKIPPED listing line, opt-out line under Step 9.6c, no release_sync.py call. Wiring suite 16/16. |
| 6 | Every non-dry-run invocation writes one JSON report under $HOME/.mindrian/release-cut-listener/ (override MINDRIAN_CUT_LISTENER_REPORT_DIR) and prints its path; box names each leg's outcome | VERIFIED | Live smoke wrote exactly one file `20261002T020518Z-website-2.0.0-beta.55.json` to the scratch report dir and printed `report: <path>` (stderr under --json, stdout otherwise). Default dir and env override resolved in main:802; unit tests cover default, override, write and write-failure WARN. Box line per leg: `<leg>  <outcome>  <decision>  v<version>` + reason. |
| 7 | No network call, no room/user content (Canon Part 8): reads plugin + website repo files, spawns only local Theo CLI with path, version, sha | VERIFIED | Only requires: node:fs, node:os, node:path, node:child_process, lib/core/repo-version.cjs. No http/https/fetch/net. spawnSync targets: git rev-parse / git describe (local) and THEO_PYTHON with argv [script, --plugin-root, root, --version, v, --ref, sha, --json], no shell, stderr inherited (never captured). No room path read. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| scripts/release-cut-listener.cjs | min 300 lines, exports main, mapTheoResult, runTheoLeg, runWebsiteLeg, renderReport, makeDeps, THEO_EXIT_MAP, LISTENER_EXIT | VERIFIED | 850 lines; all 8 exports present with the expected types (6 functions, 2 objects) plus SURFACES; LISTENER_EXIT = {0,1,2,3,4,10,11} |
| tests/test-release-cut-listener.cjs | min 200 lines | VERIFIED | 688 lines; 41/41 pass |
| tests/test-release-cut-listener-wiring.cjs | min 80 lines | VERIFIED | 222 lines; 16/16 pass standalone and inside run-all-349 |
| scripts/release.sh | contains "Step 0.55" | VERIFIED | Step 0.55 block, Step 9.6c block, flag, USAGE_BLOCK, preamble check, dry-run listing; `bash -n` clean |
| docs/RELEASE-CEREMONY-RULING-SYSTEM.md | contains "release-cut-listener", one unnumbered RULE 5 paragraph | VERIFIED | Bold-lead paragraph after place 9; test-349-docs-lockstep 13/13 (still nine numbered places) |
| PROPOSED-STEP-5.6-RETIREMENT.md | contains "theo-resync" | VERIFIED | Measured fact, one recommendation, touch list, ROADMAP 366.1 note; proposal only |
| .claude/includes/release-process.md | Release-cut listener section | VERIFIED | Three hyphen bullets after "Telling Theo"; still five numbered items |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| scripts/release.sh | release-cut-listener.cjs | Step 0.55 `node "$PLUGIN_DIR/scripts/release-cut-listener.cjs" theo "${CUT_LISTENER_ARGS[@]}"` with repo-version.cjs + `git rev-parse HEAD` | WIRED (exercised by live dry-run) |
| scripts/release.sh | release-cut-listener.cjs | Step 9.6c `... website --plugin-root "$PLUGIN_DIR" --version "$NEW_VERSION"`, no exit | WIRED (static; runs only after publish in a real cut) |
| release-cut-listener.cjs | $THEO_DIR/.theo-graph/release_sync.py | deps.spawnSync(python, [script, ...flags, --json]), no shell | WIRED (argv asserted by unit; path printed by live dry-run) |
| release-cut-listener.cjs | data/command-registry.json | commands.length vs canon count and literal N commands | WIRED (live: 113 = 113) |
| tests/run-all-349.sh | test-release-cut-listener*.cjs | two run_if legs + PHASE_349_SURFACES em-dash list | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suite | `node tests/test-release-cut-listener.cjs` | 41 checks passed, rc 0 | PASS |
| Wiring suite | `node tests/test-release-cut-listener-wiring.cjs` | 16 checks passed, rc 0 | PASS |
| Phase 349 aggregator | `HOME=$(mktemp -d) bash tests/run-all-349.sh` | Run 1: PASS=15 FAIL=1 (wiring leg failed only on its porcelain-equality check because peer Phase 366 created `tests/test-366-cli-perspective.cjs` mid-run; that file was then committed by the peer as 369dcd51f). Run 2: PASS=16 FAIL=0, both listener legs PASSED | PASS |
| Phase 310 aggregator | `HOME=$(mktemp -d) bash tests/run-all-310.sh` | PASS=10 FAIL=2; legs 2, 3 (34 blocks), 4 (>= 61) PASSED; leg 7 = 3 FAIL cases (1, 3, 4) each with `driver.sh: line 98/106/99: DRY_RUN: unbound variable`, Total 8 Passed 5 Failed 3 (identical to the pre-existing trio recorded in SUMMARY); leg 9 = `unexpected changed path(s): tests/test-267-mcpv2-sdk-era.cjs` only (peer Phase 267 working-tree edit, not an owned file) | PASS (known pre-existing/peer only) |
| Release dry-run | `bash scripts/release.sh patch --dry-run` | rc 0; Step 0.55 + Step 9.6c listed; `git status --porcelain` identical before/after; website + Theo porcelain identical | PASS |
| Usage errors | `listener bogus`, `theo --version v2.0.0`, `all --version 2.0.0` | rc 2, 2, 2 | PASS |
| Regression suites | test-349-docs-lockstep 13/13, test-353-release-wiring 8/8, test-366-suite-gate 10/10, test-343-theo-stamp-gate 7/7, test-349-release-wiring 17/17, test-release-bump-tag-and-publish-gates 15/15; build-connector-registry --check rc 0; check-kuzu-reintroduction clean | all green | PASS |
| Em-dash byte grep | `grep -l` for U+2014 / U+2013 bytes over all 10 owned files + SUMMARY; added lines across 79a55f7a3..4f3727056 | no file matched; 0 added lines | PASS |

### Probe Execution

Not applicable: no `scripts/*/tests/probe-*.sh` declared by the plan or summary.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| QUICK-261002-5v9 | 261002-5v9-PLAN.md | SATISFIED | Truths 1-7 above |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (owned files) | - | TBD / FIXME / XXX / TODO / placeholder | none found | - |
| scripts/release.sh | dry-run listing, Step 0.55 line | Says "previewed above (prints the release_sync.py call ...)" even when Theo is absent and the preview was a SKIPPED line | Info | Cosmetic wording; the SKIPPED reason is printed directly above |
| scripts/release.sh | dry-run listing, --no-cut-listener opt-out line | `echo "...${YELLOW}..."` without `-e` prints the literal `\033[...]` escape | Info | Same pre-existing house pattern as the `--no-website` line above it; not introduced as a new style |
| tests/test-release-cut-listener-wiring.cjs | porcelain-equality assertion | Whole-tree `git status --porcelain` byte compare is sensitive to peer sessions writing in the shared tree | Info | Produced one peer-induced false failure in this verification; passes on a quiet tree. Consider scoping to owned paths in a later quick |

### Human Verification Required

None blocking. The live Theo propose path (Step 0.55 calling release_sync.py for real, possibly stopping at code 20 with the apply line) is deliberately never run here because it writes payloads into Theo; its first real exercise is the next `--prerelease` cut, as the SUMMARY records. The JSON shape the listener depends on was confirmed statically against release_sync.py.

### Open navigator items carried from SUMMARY (not gaps)

- Step 5.6 retirement proposal filed, nothing removed.
- Version-label nuance: Theo leg stamps repo-version.cjs (beta.56) while the next --prerelease tags beta.57; consistent with both lagging gates and the contract.
- ROADMAP Phase 366.1 overlap: close as delivered or rescope (ROADMAP.md not edited, confirmed: no owned commit touches it).
- Real website drift found (commands-canon version beta.51, banned "29,055 nodes" at the-wrong-bottleneck/page.tsx:798).

### Gaps Summary

No gaps. Every must-have truth, artifact (existence, line floor, exports, contains) and key link verified against the codebase with my own runs. The two red run-all-310 legs are confirmed as the known pre-existing leg-7 DRY_RUN unbound-variable trio and a peer-only leg-9 path; the one transient run-all-349 failure was caused by a peer file appearing mid-run and cleared on re-run.

---

_Verified: 2026-10-02T02:09:28Z_
_Verifier: Claude (gsd-verifier)_
