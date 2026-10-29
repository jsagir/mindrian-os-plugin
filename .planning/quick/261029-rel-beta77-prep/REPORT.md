# Release prep report: next cut is 2.0.0-beta.77

Branch: release/beta.77-prep (renamed from release/beta.76-prep). Not pushed, not tagged, no version bump.
The cut number is 2.0.0-beta.77: real cuts are odd (tags v2.0.0-beta.75, 73, 69, 67 ...); even numbers are dev placeholders bumped after a cut. The dev label on main ("v2.0.0-beta.76 in progress") stays; `scripts/release.sh 2.0.0-beta.77` sets the cut number at release time.

## Decisions on record (2026-10-29)
- The Eureka adapter (25 tools) is NOT new: it shipped in v2.0.0-beta.75 (squash commit 6bc8cfc55 is on origin/main; main's recorded tool baseline is already 75). The first ruling "hold it out" rested on a wrong premise and is void.
- Navigator ruling, verbatim: "Keep all 75 + restore the hardening (Recommended)".

## Commits on top of origin/main (72b9dd17b)
- ff0b03812 merge of origin/main (16 conflicts resolved: STATE.md kept ours; 380-BOOK-REVIEW.md and generated data took main's, then regenerated with their builders)
- 7d84e92d0 Phase 373 hardening restored in 10 files; main changed none of them after the squash (git log 6bc8cfc55..origin/main empty), so no main-only change was lost
- 359d17357 test-270 measurement comment only (AFTER constant unchanged)
- fdb592cff, 23c227fba quick 261029-pnl: the Phase 380 panel's post_update signal now reads the session-verify state (local.ok false) instead of the retired touch file; source, tests and README
- 77328072c panel dist rebuilt with scripts/build-mos-face.cjs after `npm ci --ignore-scripts` in ui/mos-face (2 packages); freshness check passes (source hash 7a717565d239494c); only lines.js, status.js and manifest.json changed
- 0dd4576b0 CHANGELOG: four bullets under [Unreleased] (install overhaul with the cold install unobserved, the missed-fork rule with the measured numbers, N-7, the hardening and its experimental/local-only/rights-unresolved status)

## Tool surface
75 tools on origin/main, on the merge, and on the final HEAD. Bytes 83522 on main, 83541 here (+19, +0.02 percent, inside the 10 percent tolerance). The origin of the 19 bytes is not traced.

## Release gate (the gate the cut runs): `bash tests/run-all-366.sh`
Run by the main session on a temp HOME: PASSED=74 FAILED=1 SKIPPED=1 KNOWN=1.
- The 1 FAILED leg is "380 installed layout (install and load)": ENV GAP, no Claude login file in the temp HOME. It says "fix the machine and run again". Not run on a real HOME. UNVERIFIED there.
- The 1 SKIPPED leg is "366 spike substrate prepare" (ENV GAP). The 380 typecheck and 380 build legs also print ENV GAP skips (typecheck needs a one-time interactive load of the mod).

Follow-up (main session, real login, hermetic temp folder): `node tests/test-380-installed-layout.cjs` exit 0, 29 passed, 0 failed. The packed payload installs and loads in the real engine (`/mos-text` prints the panel text from the shipped dist), claude plugin validate exits 0. L7 (does a non-terminal surface draw the panel) is UNVERIFIED. The full `run-all-366.sh` was NOT re-run with a login; only this leg was.

## Other aggregators (executor, temp HOME)
Green: run-all-314 (43 pass, 3 known), run-all-359 (27), run-all-364 (61 pass, 1 skip, 3 known), 357 (16), 238 (14), 251 (6), test-270 (5), the 9 Phase 373 and Eureka suites.

## Red table
| Red | Class |
|---|---|
| 341 run-all-310.sh leg 3; 341 step-block tripwire (37 found vs 36 expected) | KNOWN, also red on origin/main |
| 341 version-of-record-source-version | KNOWN, green in this run |
| 314 connector part8 boundary, 267 zod4 contract, shape-declaration strict; 364 framework/section command ledger, connector part8 | KNOWN (signature matched), ledgers also red on main |
| 310 leg 9, doctor pre-flight verify-release-clean-tree | ENVIRONMENT: caused by a modified tracked .pyc; RESTORED by the main session, tree is clean |
| doctor --acceptance full: install-state, deployment-surfaces, version-of-record-published, session-start-active-version, activation-reached-the-wire | ENVIRONMENT: same 5 fail on a clean main clone with a temp HOME |
| test-267 (cirs-gates, clients, dual-era, http-flag-off, registration-api, zod4-contract), test-257-strict-input-shapes, test-234-free-core-network-scan | PRE-EXISTING ON MAIN: identical fail sets on a clone of origin/main. The 267 snapshots list 50 tools; beta.75 added 25 without updating them. Not referenced by release.sh or verify-release as run-all legs (verify-release only mentions test-267.3 in a comment). |
| 341 update-collapsed, arm 2 "retired touch-file literal appears nowhere in the live tree" | WAS NEW, NOW FIXED: panel source changed (quick 261029-pnl) and dist rebuilt (77328072c). Re-run: update-collapsed PASS=8 FAIL=0; test-380-build 111 passed, 0 failed; test-380-status-parity 49/0; budget 11/0; copy 37/0; rename 8/0; wall 7/0. |

## OPEN
a. No human-read real-room receipt exists for the final HEAD. The human runs `node scripts/real-room-run.cjs --read-by "<name>"`. Not run by any agent.
b. Cold install on Windows and macOS was NOT observed (waived by the navigator 2026-10-28). A release is the first time real users hit it.
c. The 3 known red legs of run-all-341 need a repin quick (release.sh step-block hashes after commits 1307192bb and e5c2d0827).
d. The rights status of the five graph services is unresolved and they are already public in beta.75. The hardening labels them experimental and local-only; the CHANGELOG says so.
e. CLOSED: the panel regression is fixed and rebuilt (see commits above).
f. The 267 and 257 snapshot suites and test-234 are red on main and in beta.75; regenerate the snapshots for 75 tools and review the test-234 allow-list (the field name brain_framework_id matches its blunt pattern).
g. The measurement of the missed-fork rule was taken before N-7; N-7 is not in the measured tree.
h. PARTLY CLOSED: the 380 installed-layout leg passed standalone with a real login (29/0). Still run the full release gate once on a real, logged-in machine before the cut.
i. Untracked .planning/debug/379-1-1-10-large-room-drain-clock-breach.md predates this job and is not part of it.
