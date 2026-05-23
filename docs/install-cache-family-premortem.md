# Install-Cache Family Pre-Mortem

> Date: 2026-05-14 (originated); appended 2026-05-23 (Phase 127.2 Plan 04 -- case #7).
> Status: Active. Linked from `docs/CANON-PHASE-MAP.md` Part 6.

Canonical family record for the install-cache failure surface. Seven cases
shipped to date, each adding one defense at its surface. Section 1: history.
Section 2: pattern. Section 3: 5 predicted next failure modes. Section 4:
revisit cadence.

---

## Section 1. Family history (7 cases)

| # | Case                                  | Year-month | Phase           | The single defense added                                                                                                                                                                                                                                                                                              |
|---|---------------------------------------|------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Wrong-workspace incident              | 2026-04    | Phase 93 antecedent | Workspace guard in session-start + CLAUDE.md hard rule. Commits made in `~/.claude/plugins/mindrian-os/` (a read-only install cache, NOT a dev workspace) silently diverged from origin. Defense: `scripts/session-start` refuses to execute from the plugin cache directory; CLAUDE.md states the rule at the top.                            |
| 2 | Install-cache drift                   | 2026-04    | Phase 93        | `/mos:doctor` drift detection. Cached marketplace state advanced while the install-state.json record stayed stale; the user saw "version mismatch" with no actionable next step. Defense: doctor compares the cached marketplace.json against install-state.json and surfaces the diff with a `--fix` recovery path. |
| 3 | Install-dir missing                   | 2026-05    | Phase 95.2      | Atomic-swap recovery + session-start preflight. After a corrupt update, the install directory was simply absent; users had no path forward. Defense: doctor `--fix` performs an atomic re-stage (clone-to-temp + rename), and SessionStart runs preflight to detect the absence before any consumer trips on it.    |
| 4 | Windows MAX_PATH + skill-loop         | 2026-05    | Phase 95.6      | Windows MAX_PATH guard + npm-installer reserved-name compliance. Long paths under `\\?\` failed on Windows; some npm packages collided with reserved Windows filenames (CON, PRN, etc.). Defense: a MAX_PATH guard pre-validates the install tree; the installer rejects payloads containing reserved-name entries. |
| 5 | Phase 123 release-cut hot-patches     | 2026-05    | Phase 123 ship  | 5 release-flight checks. The Phase 123 cut surfaced 5 manual hot-patches the operator had to apply mid-cut (session-start active_version, verify-release clean-tree, frontmatter YAML, release.sh --dry-run, working-tree housekeeping). Defense: each became a doctor `--acceptance` check (Phase 126 Plan 05).      |
| 6 | Windows dogfood + install-minisite stale | 2026-05 | Phase 126       | Seven defenses ship in one phase. Renderer contract test (Plan 01); prerelease semver-pick fix (Plan 02); acceptance gate self-coverage (Plan 03); release-pipeline hardening -- Step 5.5 tag-push + Step 9.6 install-minisite HARD + Step 9.7 npx self-test (Plan 04); release-flight in acceptance (Plan 05); cache prune extension for stale-backup dirs (Plan 06); install-state.json schema v2 migration (Plan 07). |
| 7 | /mos:update silent activation gap + bash-heredoc POSIX leak | 2026-05 | Phase 127.2 Plan 04 (THIS plan) | Two distinct bugs shipped as one beta. **Sub-case 7a (Instance #4, P2):** `scripts/room-registry` Python `python3 -c` blocks embedded bash-resolved `$REGISTRY_FILE` as a string literal; Windows + Git Bash `$HOME` carries POSIX form (`/c/Users/PC`) which Windows Python `open()` cannot resolve; `/mos:rooms list` broke on every Windows install. Defense: inlined `normwin()` Python shim platform-gated on `sys.platform == 'win32'` at the top of every `python3 -c` block in `scripts/room-registry` (8 sites) + sibling sweep into `scripts/reapply-modifications` (4 sites). **Sub-case 7b (Instance #7, P1, the META-FIX):** `/mos:update` and `claude plugin update mos@mindrian-marketplace` land new bytes in `~/.claude/plugins/cache/mindrian-marketplace/mos/<NEW_VERSION>/` but DO NOT atomically swap the live install at `~/.claude/plugins/mindrian-os/`. Every MCP probe + statusline + hook output silently serves the OLD version. Users think they're on beta.N+1; every Brain interaction reads beta.N. Defense: three-part fix -- (a) new `scripts/post-update-activation.cjs` detects cache-staging dir + delegates atomic swap to existing `doctor --fix` (Phase 95.2 reuse, Canon Part 7) + writes touch-file `~/.mindrian/post-update-restart-pending`; (b) new SessionStart hook `scripts/sessionstart-post-update-preflight.cjs` reads touch-file + probes wire-version via doctor brain-smoke + refuses Larry-load on drift via red banner; (c) `commands/update.md` Step 7 calls `doctor --fix --post-update` automatically + `scripts/doctor.cjs --acceptance` gains Class N gate `activation-reached-the-wire` (blocker severity, applies_to:['full']). Class N gate ensures `release.sh` Step 9.8 catches any phantom-version release BEFORE it propagates to tester caches. |

## Section 2. Pattern across cases

**Shape.** Each new case shares a surface with a prior case but defeats the
single guard added there. Phase 95.2 added atomic-swap recovery (case #3);
Phase 126 found the recovery worked but recovered to the wrong version
(case #6 semver-pick bug, Plan 02). Phase 123 added the release pipeline
(case #5); Phase 126 found the pipeline had gaps (case #6 acceptance
self-coverage in Plan 03 + pipeline self-test in Plan 04). Phase 127.2
Plan 04 (case #7) found that even with full pipeline + acceptance gates,
the bytes the pipeline ships might not actually activate on user machines
(Instance #7 silent activation gap); the Class N `activation-reached-the-wire`
gate closes that loop. The defense AT the surface always works; the failure
mode shifts to the next adjacent surface.

**Sub-pattern (introduced by case #7a, Instance #4):** Bash scripts that
embed `python3 -c` or `python3 << EOF` heredocs and interpolate a
`$BASH_VAR` carrying a filesystem path into `open(...)` are universally
broken on Windows + Git Bash. The `$HOME`-derived path carries POSIX form
(`/c/Users/...`) that Windows Python's `open()` cannot resolve. This is a
new generic pattern beyond install-cache proper, but it lives in the same
cross-platform fragility family: a feature that worked on the developer's
Linux box silently fails on the user's Windows box, undetected by Linux+macOS
CI matrix.

**Implication.** One defense per case is the steady-state. Chaos
engineering / property-based testing was considered and rejected per D4
(wrong shape for beta-cadence discipline). The cadence is acceptable IF
each defense is comprehensive AT its surface AND the family record names
the next adjacent surface BEFORE the next case hits. That is this doc.

## Section 3. Predicted next failure modes

Each prediction: failure mode, severity, missing defense, future phase. In
order of expected occurrence.

**A. Install-minisite drift across non-dev maintainer machines.** Severity:
high. Plan 04 HARD-enforced the bump on the dev box; a co-maintainer with
a stale MINISITE_DIR checkout (forgot to `git pull origin main`) hits sed
on a divergent tree and the push fails or rewrites history. Missing
defense: minisite checkout MUST be re-fetched + clean-tree-verified BEFORE
the sed/commit. Future phase: extend Step 9.6 with `git fetch origin &&
git reset --hard origin/main` as the first action after the origin-check.

**B. Schema v3 evolution -- v2 install-state.json drifts again.** Severity:
medium. Plan 07 shipped v2. The next field addition (renderer_contract_version
cross-check from Plan 01, last_acceptance_run from Plan 03) will require v3.
Missing defense: the downgrade-rejection path currently defers to
`/mos:doctor --fix` with no explicit operator-escalation language. Future
phase: explicit downgrade-rejection with operator escalation message;
optionally bidirectional migration framework with field-deletion fences.

**C. Env-var-driven config drift.** Severity: medium. Plan 04 + Plan 06
added 6+ env vars (MOS_CACHE_PRUNE_AGE_DAYS, MINDRIAN_MINISITE_URL,
MINDRIAN_MINISITE_POLL_TIMEOUT_S, MINDRIAN_MINISITE_POLL_INTERVAL_S,
RELEASE_TAG_PUSH_RETRIES, RELEASE_TAG_PUSH_BACKOFF_S). A maintainer who
silently sets RELEASE_TAG_PUSH_RETRIES=1 defeats the retry policy. Missing
defense: doctor `--acceptance` should snapshot the env vars at release
time + persist into install-state.json + warn on session start if values
differ from canonical defaults. Future phase: "env-vars-of-record" class
K (extending Phase 123's class A-J roster).

**D. Live-poll false-positive from CDN edge caching.** Severity: low. Plan 04
polls Vercel until NEW_VERSION appears in body. If Vercel's CDN serves the
OLD version from one edge while another edge has rolled forward, the
poll could either time out (slow CDN sync) or return false-success (one
edge new, canonical old). Missing defense: poll multiple geographic
edges OR add a cache-buster query param. Future phase: extend live-poll
with `?_cb=<timestamp>` + assertion across at least two pings. Acceptable
for now because the recovery is "re-run with --no-minisite then sync
manually."

**E. The canonical replacement -- build-time fetch retires the entire surface.**
Severity: defense (not a bug). The memory rule
`feedback_install_minisite_lockstep.md` names it: replace hardcoded strings
with `NEXT_PUBLIC_MINDRIAN_VERSION` env var OR build-time
`npm view @mindrian_os/install version` fetch. This is the FUNDAMENTAL
fix that retires the entire Plan 04 Step 9.6 surface along with the
7-place lockstep (shrinks back to 6). Future phase (v1.14.0+): deploy
env-var-driven minisite + retire Step 9.6. Predicted to land within
2 milestones.

**F. Cowork cross-tenant activation drift.** Severity: medium (latent until
Cowork ships at scale). The Class N `activation-reached-the-wire` gate
added in case #7 assumes ONE active install per host. In Cowork mode, a
single tenant running `/mos:update` could in-place-update the install while
other tenants on the same host continue to serve the OLD version until they
explicitly restart. The acceptance gate as currently structured cannot
detect cross-tenant drift. Missing defense: tenant-scoped Class N variant
that asserts wire-version-equality across ALL reachable tenant sessions on
the same install host. Future phase: Cowork v1 hardening track.

**G. Bash-heredoc POSIX leaks in non-`scripts/room-registry` sites.**
Severity: medium. Case #7a sweep found that `scripts/verify-release` (4
sites), `scripts/learn-from-usage`, `scripts/track-analytics` carry the
same bash-var-leak-into-Python-open() pattern but were OUT-OF-SCOPE for
Plan 127.2-04's explicit sweep targets (`scripts/hsi-*`, `scripts/build-*`,
`scripts/release.sh`). Logged to deferred-items.md for the next patch beta.
Missing defense: a CI-side grep gate that fails the build when any bash
script in `scripts/` matches `python3.*open\('\$[A-Z_]+` without a preceding
`normwin()` shim. Future phase: extend `scripts/doctor.cjs --acceptance`
with a static-analysis class that runs this grep across the tree.

## Section 4. Revisit cadence

Revisit at every install-cache failure surface OR every v1.X.0 milestone
audit, whichever comes first. The Section 1 table is the canonical record;
appending a row IS the revisit. When case #7 ships: append row (Section 1),
update pattern if shape changed (Section 2), promote matching prediction
or add a new one (Section 3), confirm cadence (Section 4).

---

_Phase: 126-install-lifecycle-harness-gaps (Plan 04, Wave 3, Task 3)._
_Canon: docs/MINDRIAN-CANON.md Part 6 (dog-fooding) + Part 7 (reuse)._
