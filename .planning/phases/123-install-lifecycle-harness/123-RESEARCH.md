# Phase 123: install-lifecycle-harness - Research

**Researched:** 2026-05-12
**Domain:** Install/release engineering — Claude Code plugin lifecycle, version-of-record consistency, `release.sh` semver algebra, doctor drift classes, Brain-key resolution
**Confidence:** HIGH (Claude Code plugin docs verified against live `~/.claude/plugins/` state on this box; `semver` API verified by running it; all referenced code files read in full)

---

<user_constraints>
## User Constraints (from 123-CONTEXT.md)

### Locked Decisions (D-01..D-37 — research must honor these, not re-litigate)

**Install-state record (`~/.mindrian/install-state.json`):**
- **D-01** Hard-consumer contract: a missing record is a known-bad, explicitly-surfaced state ("install-state not initialized — run `mindrian-os doctor --fix`"). Consumers (statusline, `~/.mindrian-last-version` reader, `bin/cli.js`, doctor) read the record; they do NOT fall back to running the resolver themselves.
- **D-02** Carve-out for `doctor`: it cannot hard-error on a missing record — "record absent" is a drift *finding* with a `--fix` that runs `session-start`'s record-write path.
- **D-03** `session-start` writes the record in its earliest steps, before any downstream reader; `~/.mindrian-last-version` write folds into the same step. **Single writer:** `scripts/session-start` owns the record AND `~/.mindrian-last-version`; no other SessionStart hook writes either.
- **D-04** Full snapshot: `active_version`, `active_root`, `topology` (`marketplace-cache | dev-clone | legacy | not-found`), `resolved_at`, `surfaces[]` (`{id, path, check_kind, expected, observed, ok}`), **plus** the version-of-record cross-check values seen at write time: `installed_plugins_version`, `statusline_renders_version`, `last_version_file_value`, `path_bin_version`.
- **D-05** doctor reads the snapshot AND does one live spot-check of `active_version` vs `installed_plugins.json`. Divergence → "record stale — re-run `session-start`" (NOT "install drift").

**Deployment-surface manifest (`data/deployment-surfaces.json`):**
- **D-06** Single source of truth; `session-start` walks it to reconcile owned surfaces, `doctor` walks it to flag. New surface = one JSON entry, no code change. Mirrors `data/command-registry.json` (Phase 122).
- **D-07** Manifest entry schema (Claude's discretion on exact field names, but cover): `id`; `path` (literal `$HOME` token, expanded via `os.homedir()` — never an absolute path); `owner` (`session-start | claude-code`); `topology_scope` (`all | dev-clone`); `check_kind` (`marker | exact-value | observed-only`); `expected` (marker substring, or exact canonical value; `null` for `observed-only`); `reconcile` (`on-version-change | never`); `remediation` string.
- **D-08** Owned (stamped) by `session-start`: the `statusline-mos` dispatch shim (`~/.claude/statusline-mos`, marker `MINDRIAN-STATUSLINE-DISPATCH`), the `settings.json` `statusLine.command` line (`exact-value == bash "$HOME/.claude/statusline-mos"`), `~/.mindrian/install-state.json` (self — excluded from its own check), `~/.mindrian-last-version` (`exact-value == active_version`), and the dev-clone pre-commit hook (`topology_scope: dev-clone` only — ROOM.md/MINTO.md guard; reuses `scripts/install-pre-commit.sh` Phase-108 logic; on a user box doctor skips it). Observed-only: the plugin-bin `$PATH` entry (`.../mos/<active>/bin`) — Claude Code owns it; never written; wrong value is a "restart Claude Code / reinstall the plugin" finding.
- **D-09** Check kind = marker vs exact-value. Script/hook surfaces carrying a fixed sentinel that resolve at runtime → `marker`. The two surfaces that ARE a single canonical value → `exact-value`. NO surface gets a frozen content SHA (rejected).
- **D-10** Reconcile timing: `session-start` reconciles owned surfaces ONLY on version change (`active_version != ~/.mindrian-last-version`; an absent file counts as a change). `doctor --fix` and `doctor --acceptance` do a full unconditional manifest walk + reconcile.

**doctor drift classes + `--fix`:**
- **D-11** Bug 7's fix lives in the existing legacy-clone check: "no legacy clone dir on a marketplace-only box" is *expected*, not a finding. Topology ∈ `{marketplace-cache, dev-clone, legacy, not-found}` — each is *valid*; only `not-found`, or a declared-vs-actual mismatch, is drift.
- **D-12** Two new drift classes (added to A–G roster; `--all` activates them):
  - **Class H — install-state + topology + version-of-record consistency.** Record present + internally consistent (snapshot vs live spot-check, per D-05); topology classification (per D-11); version-of-record equality across `installed_plugins.json` ↔ record `active_version` ↔ statusline-renders ↔ SessionStart-banner ↔ `~/.mindrian-last-version` ↔ plugin-bin `$PATH` entry.
  - **Class I — deployment-surface manifest reconciliation.** Every owned surface in `data/deployment-surfaces.json` has its marker/value OK.
  - Each class: name, check, `--fix` (where applicable), per-class test fixture.
- **D-13** `--fix` recovers everything it safely can — including legacy-clone migration and `installed_plugins.json` repair — under hard preconditions: `legacy` vs `dev-clone` distinguished (`dev-clone` = git clone with an `origin` remote → GitHub; **untouchable**); legacy migration = backup-then-verify-then-remove (tar legacy to `~/.mindrian/backups/`, confirm marketplace-cache install resolves + healthy, *then* remove; never delete the active root; refuse if uncommitted/unpushed); `installed_plugins.json` repair = conservative + backed up (only when demonstrably stale; prefer "repoint at newest valid marketplace-cache dir"; note Claude Code needs a restart). Every `--fix` op: backup-before-mutate, idempotent, never touches the active root. Auto-recovers without preconditions: missing install-state record, drifted owned-surface markers/values, `~/.mindrian-last-version` mismatch. Still flag-only even with aggressive `--fix`: `topology == not-found` → "reinstall"; plugin-bin `$PATH` entry pointing at a vanished dir → "restart Claude Code"; `statusline-renders-wrong-version` → "likely an `active-plugin-root.cjs` bug, file it."

**`mindrian-os doctor --acceptance` (release gate as a command):**
- **D-14** The 5-point contract: (1) install-state record present + snapshot matches a live spot-check; (2) every owned deployment surface reconciled; (3) version-of-record consistent across `plugin.json` / `package.json` / CHANGELOG top entry / git tag exists / marketplace `source.ref` / published npm version (`npm view @mindrian_os/install@<ver> version`); (4) `npx @mindrian_os/install` round-trip actually installs (Claude's discretion: into a `mktemp -d` throwaway dir, assert `mos/<version>/` tree + `bin/cli.js` resolves, then remove the temp dir — never touch the live install); (5) `doctor --all` exits 0.
- **D-15** `--acceptance` wraps the existing harnesses — CALLS `scripts/verify-release` (and reconciles with `scripts/release-beta-smoke.sh` + `tests/test-release-npm-gate.sh`) as checks rather than duplicating them.
- **D-16** Two sub-modes: `--acceptance --pre-tag` runs the half true before the release happens — (1), (2), the repo-file half of (3), (5) — `release.sh` runs it BEFORE it tags. Full `--acceptance` runs everything (incl. git tag exists + marketplace `source.ref` + npm published + `npx` round-trip) — `release.sh` runs it AFTER the push. Both are hard aborts; no `--allow` override.
- **D-17** Orchestration is shell-agnostic (node — `bin/cli.js` / `scripts/doctor.cjs`). May shell out to `git` (cross-platform), not bash-isms. Bash helpers (`verify-release`, `release.sh`) only invoked on the maintainer's box during a release.

**`release.sh` owns ALL version bumps + dirty-repo guard + Step 9.5 rename:**
- **D-18** Pre-release bump algebra via npm `semver` (added as a `devDependency` — stays out of `package.json` `files` allowlist; published tarball keeps zero runtime deps). `release.sh` checks `node_modules/semver` exists (or runs `npm install`) before using it. `--prerelease` → `semver.inc(v,'prerelease','beta')` (`1.13.0-beta.11` → `1.13.0-beta.12`); `patch`/`minor`/`major` → `semver.inc(v,'patch'|'minor'|'major')` (finalizes). [**RESEARCH CORRECTION**: see Finding 3 — `semver.inc('1.13.0-beta.11','patch')` returns `1.13.0`, NOT `1.13.1`; `'minor'` also returns `1.13.0`. The "finalize a beta series as the stable" call is `'patch'` (or strip the prerelease tag).] A `--start-prerelease <core> <channel>` form opens a fresh series. Replaces the `IFS='.' read -r MAJOR MINOR PATCH` on `scripts/release.sh:40`.
- **D-19** One-commit next-bump. **[RESEARCH VERDICT — FLIP TO TWO-COMMIT FORM. See Finding 1. Claude Code reads the installed version from `plugin.json` `version` FIRST (official Version Management spec). The one-commit form would self-report `vN+1` from a `vN` tag/ref — broken. The planner MUST adopt the two-commit form: commit A finalizes+tags `vN` with `plugin.json == vN`; commit B bumps to `vN+1`; `main` HEAD on B; `marketplace.json.source.ref = vN` checks out commit A.]**
- **D-20** Dirty-repo / ahead-of-origin guard. Before pushing: snapshot `git log origin/main..HEAD --oneline`, print it. If the only commit ahead is the release commit `release.sh` just made (**two: A + B, under the two-commit form**) → push. Else abort: "N unpushed commits that aren't this release; push/stash them or pass `--allow-ahead`." No author heuristics. Block on dirty *tracked* files except the ones `release.sh` itself bumped; untracked files OK.
- **D-21** Fix Step 9.5's stale package name — `@mindrian_os/cli` → `@mindrian_os/install`. Update the publish, the dist-tag logic, the `npm pack --dry-run` payload-allowlist gate, and the recovery instructions.

**Cleanup absorbed:**
- **D-22** Cache pruning on update: keep the active version + N most recent (Claude's discretion: N=2, so 3 dirs total) — never delete the active one; skip pruning entirely if `installed_plugins.json` can't be read. Runs in `session-start` (on version change) AND `doctor --fix` (unconditional). Touches only `mos/<version>/` dirs that are neither active nor in the keep-set.
- **D-23** `@mindrian_os/cli` → `@mindrian_os/install` doc/test sweep: `docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh` — and any other `@mindrian_os/cli` reference. [See Finding 9 for the full grep checklist — there are also `@mindrian/os` (the older-still name) references in CHANGELOG + autopsies + testers docs.]

**Brain key resolution (Plan-7, D-31..D-36):**
- **D-31** `lib/core/resolve-brain-key.cjs` — THE single Brain-key resolver, mirroring `lib/core/active-plugin-root.cjs`. Order: `MINDRIAN_BRAIN_KEY` env → `~/.mindrian.env` (`MINDRIAN_BRAIN_KEY=` line) → CWD `.env` → not-found. Returns `{key, source, available, reason}`. Exposes the SEC-02 permission check (POSIX-only; no-op on Windows): a key file with a group/world bit (`mode & 0o077 !== 0`) → `available: false` with an explicit `reason` string — never a silent `null` + bare stderr. [**RESEARCH NOTE**: `brain-client.cjs::getApiKey()` currently checks env → **CWD .env → ~/.mindrian.env** (the reverse of D-31's order). The resolver should adopt D-31's order; `getApiKey()` delegating to it will silently change `getApiKey`'s order too — a deliberate, harmless change since `~/.mindrian.env` is "global backup" and CWD `.env` is project-specific; D-31's order ("global backup before a project's potentially-stale .env") is arguably the more robust one. Flag it in the plan so it's not a surprise.]
- **D-32** Rewire all three consumers to call `resolve-brain-key.cjs`: (a) `lib/core/brain-client.cjs::getApiKey()` delegates to it (and its stale docstring ~L117 fixed — it says "checks env then CWD .env" but also reads `~/.mindrian.env` at L136–151); (b) `scripts/session-start`'s Brain-key check resolves the key the same way instead of testing only the shell env var; (c) `skills/brain-connector/SKILL.md` gains a new detection branch — "**step 0:** if `lib/core/resolve-brain-key.cjs` resolves a key (`available: true`), the Brain is active via the **HTTP path** — call into `brain-client.cjs`'s `query()/search()/schema()/ask()`, NOT an MCP tool" — and its "Tool Names" table gains a CLI row.
- **D-33** Replace `session-start`'s MCP-centric WARN with a positive status line: `Brain: HTTP client active (mindrian-brain.onrender.com)` when the key resolves; `Brain: not configured (Tier 0)` when it doesn't. A real WARN only when the key resolves AND neither an MCP server nor `brain-client.cjs` can reach the Brain. The SEC-02 "permissions too open" rejection routes through this same status channel, not bare stderr.
- **D-34** SEC-02 `chmod 600 ~/.mindrian.env` on write — `install.sh` and `/mos:setup brain` (`commands/setup.md`) must `chmod 600` the key file when they write it (POSIX only; no-op on Windows). [**RESEARCH NOTE**: neither does today — see Finding 10.]
- **D-35** Doc/auth fixes: `docs/install/BRAIN-SETUP.md` and `.env.brain.template` state explicitly the server is `Authorization: Bearer <key>` only (NOT `x-api-key` — a raw `x-api-key` request gets a 401 whose body points at `https://mindrian-os.com/brain-access`); the no-key fallback surfaces that `brain-access` URL; the CHANGELOG prose about the client "calling `brain.mindrian.ai`" is softened ("currently `*.onrender.com`, moving to `brain.mindrian.ai`"; or add the `MINDRIAN_BRAIN_URL` override note); the `getApiKey()` docstring fix from D-32(a).
- **D-37** Plan-7 (absorbed): `resolve-brain-key.cjs` + the 3 consumer rewirings + WARN→status-line swap + SEC-02 `chmod 600` + auth/docstring doc fixes. **Sequencing:** depends on Plan-2 (both modify `scripts/session-start` — the planner may merge Plan-7's `session-start` edits into Plan-2's wave or sequence them after); lands before Plan-6 so `v1.13.0-beta.13` carries the Brain detection fix. Part-8: the resolver + status line are purely LOCAL, zero network.

**Plan ordering (D-24..D-29, D-37):** Plan-1 (`release.sh`) FIRST → Plan-2 (record + manifest) → Plan-3 (doctor classes H+I + Bug-7 + aggressive `--fix` + fixtures) → Plan-4 (`--acceptance` + `release.sh` wiring) → Plan-5 (cache prune + `@mindrian_os/cli` sweep) → Plan-7 (Brain key, before Plan-6) → Plan-6 (cut beta.13 + Windows `--acceptance` validation).

**REQ-IDs (D-30):** Register as `HARNESS-123-01..NN` in `.planning/REQUIREMENTS.md`, assigned by the planner. Expected: ~4 Plan-1, ~2 Plan-2, ~3 Plan-3, ~1 Plan-4, ~2 Plan-5, ~2–3 Plan-7, ~1 Plan-6. Final count + mapping is the planner's call. (Candidate decomposition in `<phase_requirements>` below.)

### Claude's Discretion (research recommends, planner decides)
- Exact field names in `data/deployment-surfaces.json` (cover the D-07 set).
- `npx` round-trip mechanics inside `--acceptance` (D-14 suggests `mktemp -d`; researcher's recommendation in Finding 4).
- Cache-pruning retention count N (D-22 suggests 2 — recommend keeping 2).
- Whether class H and class I get their own CLI flags or share one (Finding 5: recommend one new flag `--install-state` that activates both new classes, mirroring how `--statusline-visibility` already activates two checks).
- Internal structure of `--acceptance` (one big function vs a checklist runner — recommend a checklist runner of `{id, label, run, severity}` records, Finding 5).

### Deferred Ideas (OUT OF SCOPE — ignore)
- Phase 92 Drift Detection Engine (canon-drift detector) — separate, unscaffolded; Phase 123 is install-state drift, not canon drift.
- Desktop/Cowork install-state parity beyond the basic `active_version`/`active_root` record — its own phase.
- GitHub-side enforcement of the brain-boundary-scan / Canon-Custodian review — repository-layer config.
- Auto-migrating a `dev-clone` (vs the obsolete `legacy` clone) — `--fix` never touches a dev clone.
- `--analyze`/`--batch`/`--text` parity for `mindrian-os doctor --acceptance` output — UI polish.
- **Brain canonical-interaction-model decision (field-report items #2-partial + #6)** — choosing the bundled `mcp-server-brain/` MCP path vs the wired `brain-client.cjs` HTTP path as *the* supported v1.13 path, and the full doc alignment that follows. Plan-7 makes the HTTP path *detectable + documented as present*; it does not pick a winner or retire the MCP path. The pick is a product-direction call; future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements (candidate decomposition — planner finalizes)

REQ-IDs to be assigned as `HARNESS-123-NN` per D-30. Candidate mapping (16 reqs across 7 plans):

| Candidate ID | Description | Plan | Research Support |
|---|---|---|---|
| HARNESS-123-01 | `scripts/release.sh` replaces the `IFS='.' read -r MAJOR MINOR PATCH` parse with `semver.inc()`; supports `--prerelease` (`beta.N`→`beta.N+1`), `patch`/`minor`/`major` (finalize: `beta.N`→`X.Y.0`), `--start-prerelease <core> <channel>` (open a fresh series). `semver` added to `package.json` `devDependencies`, NOT `dependencies`, NOT `files`. `release.sh` ensures `node_modules/semver` exists before use. | Plan-1 | Finding 3 (semver API + the `patch`/`minor` correction); `semver@7.7.4` already in `node_modules` transitively; `node_modules/semver/package.json` confirms zero deps |
| HARNESS-123-02 | `release.sh` adopts the **two-commit next-bump form**: commit A finalizes CHANGELOG `[vN] - date`, sets `plugin.json`/`package.json` == `vN`, tags `vN`; commit B bumps `plugin.json`/`package.json` to `vN+1` and resets CHANGELOG `[Unreleased] -- vN+1 (in progress)`; `main` HEAD on B; `marketplace.json` `version` AND `source.ref` pinned to `vN`. (Flips CONTEXT D-19's one-commit form per Finding 1.) | Plan-1 | Finding 1 (official Version Management spec: `plugin.json` `version` wins) |
| HARNESS-123-03 | `release.sh` dirty-repo / ahead-of-origin guard: snapshot + print `git log origin/main..HEAD --oneline`; push only if the delta is exactly the release commit(s) [A and B]; else abort with the count + `--allow-ahead` escape; block on dirty *tracked* files except the bumped files (`plugin.json`, `package.json`, `CHANGELOG.md`, marketplace `marketplace.json`); untracked OK. | Plan-1 | D-20; `scripts/preflight-release-drift.cjs` already does a read-only version of this (warn-only) — `release.sh`'s guard is the hard gate |
| HARNESS-123-04 | `release.sh` Step 9.5 renamed: publish `@mindrian_os/install` (not `@mindrian_os/cli`); dist-tag `@next` for `-beta./-alpha./-rc./-next.` suffixes, `@latest` for clean `X.Y.Z`; `npm pack --dry-run` payload-allowlist gate updated; recovery instructions updated. `tests/test-release-npm-gate.sh` updated to match (still passes its 6 structural gates). | Plan-1 | Finding 9; current `release.sh` lines 12, 172–221; `tests/test-release-npm-gate.sh` is a structural assertion on Step 9.5 |
| HARNESS-123-05 | `~/.mindrian/install-state.json` written by `scripts/session-start` as the single writer, in its earliest steps (after the workspace guard / node preflight, before the stable-prefix render and before `~/.mindrian-last-version` is consumed). Full snapshot per D-04: `active_version`, `active_root`, `topology`, `resolved_at`, `surfaces[]`, `installed_plugins_version`, `statusline_renders_version`, `last_version_file_value`, `path_bin_version`. The `~/.mindrian-last-version` write folds into the same step. `active_version`/`active_root`/`topology` come from `lib/core/active-plugin-root.cjs` (extend it to also classify topology — see Finding 2). Zero network. | Plan-2 | Finding 2 + Finding 6; `scripts/session-start:101` reads `~/.mindrian-last-version`, `:419` is the only write today (cold-start branch only — see Finding 6 for the gap) |
| HARNESS-123-06 | `data/deployment-surfaces.json` (the manifest per D-06–D-09) — static hand-maintained JSON; the 6 surfaces from D-08 with the D-07 fields; `$HOME` token expanded via `os.homedir()`; `topology_scope: dev-clone` for the pre-commit hook. `session-start` walks it to reconcile owned surfaces on version change (D-10); `doctor` walks it (class I). No generator/`--check` (justified in Finding 7 — unlike `command-registry.json`, it isn't derived from anything; a `--check` against what?). | Plan-2 | Finding 7; `data/command-registry.json` is the *layout* precedent (generated-data-file convention), not the generator pattern |
| HARNESS-123-07 | `scripts/doctor.cjs` new class for install-state + topology + version-of-record consistency (CONTEXT calls it "class H" — **but the codebase already has a class H** ("install-incomplete"); the planner must renumber: recommend **class I** for install-state, **class J** for the manifest, or rename existing class H. See Finding 5). Uses `active-plugin-root.cjs` (NOT the hardcoded `~/.claude/plugins/mindrian-os/` `INSTALL_DIR` constant — that's the `MODULE_NOT_FOUND` crash). Checks: record present + internally consistent (snapshot vs live spot-check per D-05); topology classification (per D-11 — `marketplace-cache | dev-clone | legacy | not-found`, each VALID, **Bug 7** = "no legacy clone on a marketplace box" is not drift); the 6-way version-of-record equality. | Plan-3 | Finding 2, Finding 5; `scripts/doctor.cjs:40` `INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os')` is the legacy path |
| HARNESS-123-08 | `scripts/doctor.cjs` new class for deployment-surface manifest reconciliation (class J or renamed) — every owned surface in `data/deployment-surfaces.json` has its marker/value OK; `dev-clone`-scoped surfaces skipped on a user box. | Plan-3 | Finding 5, Finding 7 |
| HARNESS-123-09 | Aggressive `doctor --fix` per D-13 under the hard guardrails: legacy-clone migration (backup→verify→remove, refuse on uncommitted/unpushed, never delete the active root, `dev-clone` untouchable); conservative `installed_plugins.json` repair (only when demonstrably stale; repoint at newest valid marketplace-cache dir; backup first; note restart needed); auto-recover missing record / drifted markers / `~/.mindrian-last-version` mismatch / cache-prune (D-22, unconditional under `--fix`); flag-only for `not-found` / vanished `$PATH` bin / wrong-statusline-version. Reuses the class-A backup-then-replace pattern (`performRecoveryAtomic` / `safeRename`). | Plan-3 | Finding 5; existing `performRecoveryAtomic` (doctor.cjs:237), `safeRename` (:325) |
| HARNESS-123-10 | Per-class test fixtures (D-12): hermetic `MINDRIAN_PLUGIN_HOME` + `HOME`/`USERPROFILE` override scratch dirs with synthesized broken `install-state.json` / missing surface / wrong-version `~/.mindrian-last-version` / a fake `legacy` clone dir / a 4-component `1.12.5.1` version; assert `doctor` flags + `doctor --fix` recovers. Registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` and `tests/run-all.sh`. | Plan-3 | Finding 8; pattern in `tests/test-doctor-class-g.cjs` (`makeTmpHome`, `runDoctor`), `tests/test-doctor-atomic-swap.cjs` (`MINDRIAN_PLUGIN_HOME`) |
| HARNESS-123-11 | `mindrian-os doctor --acceptance` (5-point per D-14) + `--acceptance --pre-tag` (the repo-file-only half per D-16). Node orchestration in `bin/cli.js` → `scripts/doctor.cjs`; may shell out to `git`/`npm`/`npx`; CALLS `scripts/verify-release` (D-15); does NOT re-run it twice (`release.sh` already calls it in Step 2 + Step 6.5). The `npx` round-trip per Finding 4 (mktemp HOME-override sandbox OR the `npm view`+`npx --help` light variant). Both `--pre-tag` and full are hard aborts. | Plan-4 | Finding 4, Finding 5; `scripts/verify-release` (14 sections), `scripts/release-beta-smoke.sh` (pre-tag clone-and-assert), `tests/test-release-npm-gate.sh` (structural) |
| HARNESS-123-12 | `release.sh` runs `mindrian-os doctor --acceptance --pre-tag` BEFORE it tags (between the CHANGELOG/version bump and the `git tag`) and full `mindrian-os doctor --acceptance` AFTER the push — both hard aborts, no override. (Composes with the existing `verify-release` calls in Step 2 + Step 6.5 — `--acceptance` calls `verify-release` once more; the planner may de-dup so `verify-release` runs exactly twice total, or accept the third run.) | Plan-4 | D-16; current `release.sh` Step 2 + Step 6.5 already invoke `verify-release` |
| HARNESS-123-13 | Cache pruning on update (D-22): keep active + N=2 most recent `mos/<version>/` dirs under `~/.claude/plugins/cache/<mp>/mos/`; never delete the active dir; skip entirely if `installed_plugins.json` unreadable. Runs in `scripts/session-start` (on version change) AND `doctor --fix` (unconditional). Local-only, zero network. | Plan-5 | D-22; live state confirms 3 orphan-able dirs (`1.12.0`, `1.12.5`, `1.12.5.1` — active is `1.12.5.1`) |
| HARNESS-123-14 | `@mindrian_os/cli` → `@mindrian_os/install` doc/test sweep across the full grep checklist (Finding 9): `docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh` (named in the spec) + `docs/INSTALL-LIFECYCLE-HARNESS.md` (the spec itself), and the `@mindrian/os` (older name) references in CHANGELOG / `docs/autopsies/2026-05-09-gary-laben-install-failure.md` / `docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md` / testers docs — to the extent they're forward-facing (historical CHANGELOG entries stay as the historical record per the existing `[1.13.0-beta.9]` note). Also `commands/setup.md` line 145's stale `mindrianos-jsagirs-projects.vercel.app/brain-access` URL → `mindrian-os.com/brain-access`. | Plan-5 | Finding 9 |
| HARNESS-123-15 | `lib/core/resolve-brain-key.cjs` — the single Brain-key resolver per D-31, mirroring `active-plugin-root.cjs` (same `{value/key, source, available, reason}` shape, ordered fallback, no silent unknown, CLI form for shell-out, zero network). + the 3 consumer rewirings per D-32 (`brain-client.cjs::getApiKey()` delegates + docstring fix; `session-start`'s Brain check; `brain-connector/SKILL.md` step-0 branch + CLI Tool-Names row). + the WARN→status-line swap per D-33. | Plan-7 | Finding 10; `lib/core/brain-client.cjs` `getApiKey()` L121–152, `checkFilePermissions()` L88–115, `Authorization: Bearer` L195/L255; `scripts/session-start` Brain block ~L1290–1313; `skills/brain-connector/SKILL.md` Detection section |
| HARNESS-123-16 | SEC-02 `chmod 600 ~/.mindrian.env` on write (D-34) in `install.sh` and `commands/setup.md` (`/mos:setup brain`) — POSIX only, no-op on Windows. + the auth/doc fixes per D-35: `docs/install/BRAIN-SETUP.md` + `.env.brain.template` state Bearer-only (NOT `x-api-key`); the no-key fallback surfaces `https://mindrian-os.com/brain-access`; the CHANGELOG `brain.mindrian.ai` prose softened / `MINDRIAN_BRAIN_URL` override noted. | Plan-7 | Finding 10; `install.sh` has NO `~/.mindrian.env` write today (Brain key is a printed hint per `bin/cli.js`); `commands/setup.md` L158–168 writes it without `chmod 600` |
| HARNESS-123-17 (optional) | Cut `v1.13.0-beta.13` via the fixed `release.sh` (carrying Plans 1–5 + 7) once Plans 1–5+7 land; validate with `mindrian-os doctor --acceptance` on a real Windows box before promotion to a clean `1.13.0`. (Operational, not code — the planner may fold into Plan-6 as a non-task milestone or omit.) | Plan-6 | D-29 |
</phase_requirements>

## Project Constraints (from CLAUDE.md / .claude/includes/release-process.md)

- **WORKSPACE GUARD (hard rule):** all work in `/home/jsagi/MindrianOS-Plugin/`, never `~/.claude/plugins/*` (the install cache). `scripts/session-start` and `scripts/release.sh` must refuse to operate in the plugin cache. Incident: `docs/autopsies/2026-04-13-wrong-workspace-incident.md`.
- **Version Consistency Rule (5-way, MANDATORY):** a release is only a release when `CHANGELOG.md` (top entry) == `.claude-plugin/plugin.json` `version` == `package.json` `version` == `git tag v<version>` (on the release commit) == `~/mindrian-marketplace/.claude-plugin/marketplace.json` `plugins[0].version` AND that entry's `source` has a `ref` field pinned to the tag. **Plus npm publish in lockstep** (the 6th sync surface — `feedback_release_lockstep_npm`): `npm publish` `@mindrian_os/install` with `@next` (for `-beta./-alpha./-rc./-next.` suffixes) or `@latest` (clean `X.Y.Z`). *(Note: the memory entry mentions `packages/npm-installer/package.json` as a 7th sync surface — that path does NOT exist in this repo; the npm package IS the repo, `bin/cli.js`. So it's 5 git/JSON surfaces + 1 npm publish = the real 6.)*
- **"Release infrastructure ALWAYS ships as a beta first"**, validated by an external operator (Lawrence). Phase 123 operationalizes this: "Lawrence ran `mindrian-os doctor --acceptance`, all green" replaces "Lawrence eyeballed the statusline."
- **"Never bump versions by hand — run `scripts/release.sh`."** Currently violated *because* `release.sh` can't handle pre-releases — D-18 closes that gap.
- **Marketplace `source` MUST be pinned to a `ref` (tag).** Without it, every install/auto-update rolls the dice.
- **Tri-polar (CLI / Desktop / Cowork):** the deployment surfaces (statusline shim, `settings.json` statusLine, pre-commit hook, `~/.mindrian-*`) are CLI-only artifacts; Desktop/Cowork are MCP-only and deploy none of them. The install-state record + `doctor` are still meaningful on all three (Desktop/Cowork installs still have an `active_version`/`active_root`), but the manifest's owned-surface set is empty there. Class checks must carry a Desktop/Cowork skip carve-out (mirror the existing class G `CLAUDE_DESKTOP=1 → skip` pattern, or `lib/statusline/surface-detect.cjs`).
- **Canon Part 8 (LOCAL-only, zero network):** the install-state record write + manifest reconcile + cache prune + the Brain status line are purely LOCAL. The ONE network touch in the phase is `--acceptance`'s `npm view @mindrian_os/install@<ver>` + `npx @mindrian_os/install` round-trip — and that runs only during a release, never in a user session. Any new code in `scripts/session-start` / `lib/core/resolve-brain-key.cjs` / the doctor classes must keep `grep -E "fetch|http|curl|brain.mindrian|tavily"` at 0 (the Phase 95.2 preflight discipline).
- **Canon Part 6 (dog-fooding) + Part 5 (evidence-graded gate):** this phase declares `canon_parts: [5, 6]`. When it ships, add it to `docs/CANON-PHASE-MAP.md` Part 6 (a "dog-fooding the install lifecycle" row) + Part 7 (reuse justification — almost everything here extends shipped code: `active-plugin-root.cjs`, `doctor.cjs`, `verify-release`, `install-pre-commit.sh`, `command-registry.json` convention; net-new files are `data/deployment-surfaces.json`, `~/.mindrian/install-state.json`, `lib/core/resolve-brain-key.cjs`, and the per-class fixtures).
- **No em-dashes** in any output (memory `feedback_no_emdashes` — already enforced in `release.sh` by `tests/test-release-npm-gate.sh` Gate 6); no emoji in `/mos:` output.

---

## Summary

Phase 123 ships an install-state contract. The disease: every consumer of "what version is active, where, is the install consistent" (doctor, statusline, the SessionStart hook, `bin/cli.js`, the plugin-bin `$PATH` entry, the `~/.mindrian-last-version` file) re-derives that state with its own ad-hoc heuristic — and on a 2026-05-12 Windows live test of `v1.13.0-beta.12` each heuristic was wrong in a different way. The cure (mirroring Canon Part 9's memory constitution): **one record** (`~/.mindrian/install-state.json`, written by `session-start`, read by everyone) + **one manifest** (`data/deployment-surfaces.json`, walked by `session-start` to reconcile and by `doctor` to flag) + **one command** (`doctor` enforces the contract every session via two new drift classes, and `doctor --acceptance` enforces it at every release) + **`release.sh`** as the only thing that touches a version (taught pre-release algebra via `semver`, a dirty-repo guard, and the `@mindrian_os/cli` → `@mindrian_os/install` rename). Plus the cleanup the disease dragged in (cache pruning on update, the package-name doc/test sweep) and an absorbed sibling — a Brain-key resolver (`lib/core/resolve-brain-key.cjs`) that fixes the *same disease shape* applied to the Brain key: detection reads from a narrower place than the code that writes it, so a working HTTP-path Brain is invisible and the model silently drops to Tier 0.

The single most important research finding: **the D-19 "one-commit next-bump" form is broken and must flip to a two-commit form.** Claude Code's official Version Management spec resolves a plugin's installed version from `.claude-plugin/plugin.json` `version` **first** (then the marketplace entry's `version`, then the git commit SHA). Confirmed on this box: `claude plugin list` reports `mos@mindrian-marketplace Version: 1.12.5.1`, exactly the `version` field in the install's `plugin.json`, while the marketplace.json says `1.13.0-beta.12`. So if `release.sh` made one commit tagged `vN` whose `plugin.json` already says `vN+1`, then `marketplace.json.source.ref = vN` checks out that commit, its `plugin.json` says `vN+1`, and Claude Code reports the install as `vN+1` — the exact "repo says beta.11, registry already has beta.11" failure mode the form was meant to kill, just relocated. The two-commit form fixes it: commit A finalizes CHANGELOG `[vN]` + sets `plugin.json`/`package.json` == `vN` + tags `vN`; commit B bumps to `vN+1` + resets `[Unreleased] -- vN+1`; `main` HEAD on B; `marketplace.json.source.ref = vN` → checks out commit A → reports `vN`. ✓

**Primary recommendation:** Build Plan-1 first with the two-commit `release.sh` form (HARNESS-123-02) and the corrected `semver` finalize semantics (`patch` not `minor` to go `beta.N`→`X.Y.0`). Extend `active-plugin-root.cjs` to also classify topology (it already has the 4 cases as resolution branches — surface them) so the record write, the doctor classes, and `--acceptance` all share one source. Renumber the new doctor classes (the codebase already has a class H) — recommend `class I` (install-state) + `class J` (manifest) under one new flag `--install-state`. Keep all new session-start/doctor code LOCAL-only; the only network touch is `--acceptance`'s release-time `npm view` + `npx` round-trip, and even that should run inside a `mktemp` `HOME`-override sandbox so it can never clobber the operator's live install.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `semver` | `^7.7.4` (latest `7.8.0` — Finding 3) | Pre-release bump algebra in `scripts/release.sh` via a `node -e` one-liner | The npm CLI's own version library. Pure JS, **zero runtime deps** (verified: `node_modules/semver/package.json` `dependencies: {}`). Already present transitively in `node_modules/semver` (v7.7.4). Add it to `package.json` `devDependencies` only — NOT `dependencies`, NOT the `files` allowlist — so the published `@mindrian_os/install` tarball keeps zero runtime deps. |
| Node.js built-ins (`fs`, `path`, `os`, `child_process`) | bundled (Node ≥ 22.5.0 per `package.json` `engines`) | Everything else: the record JSON write, the manifest walk, the doctor classes, `resolve-brain-key.cjs`, the cache prune | The GSD/plugin pattern — pure CJS, node built-ins only, no CLI framework. `bin/cli.js`, `lib/core/active-plugin-root.cjs`, `scripts/doctor.cjs` all follow it. |
| `claude` CLI | whatever the operator has | `release.sh` already calls `claude plugin validate` / `claude plugin marketplace update`; `--acceptance` / `bin/cli.js install` drive `claude plugin install` / `claude plugin update` | Already a dependency of the release pipeline (`release.sh`, `verify-release`, `bin/cli.js`). Cross-platform. |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `git` | system | `release.sh` push guard (`git log origin/main..HEAD`); `--acceptance` "git tag exists" check; doctor's `dev-clone` detection (`git -C <root> remote -v`) | Already a release-pipeline dependency. `bin/cli.js`'s `update` path already shells out to `git`. Cross-platform. |
| `npm` / `npx` | system | `release.sh` Step 9.5 publish; `--acceptance` `npm view @mindrian_os/install@<ver> version` + `npx @mindrian_os/install` round-trip | Release-time only, never in a user session. Already a release dependency (the existing Step 9.5). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| `semver` npm package | Hand-rolled bash/awk version parse (the current `IFS='.' read`) | The current parse is *exactly the bug* — it mangles `1.13.0-beta.11` to `PATCH=0-beta`. Hand-rolling pre-release semver in bash is a maintenance trap. `semver` is the npm CLI's own library; zero deps; trivial to vendor as a devDep. |
| `semver` as a `dependency` | `semver` as a `devDependency` | `release.sh` is dev tooling, never shipped (not in the `files` allowlist). A `dependency` would add it to every user's `npm install` of `@mindrian_os/install` for nothing. **D-18 mandates `devDependencies`.** |
| A new `lib/core/install-state.cjs` resolver | Extending `lib/core/active-plugin-root.cjs` | D-04/D-08/Part-7 are explicit: `active-plugin-root.cjs` is THE resolver; the record is "what the resolver returned, snapshotted." Add a `topology` field to its return shape; do NOT add a second resolver. (The 4 topology values are already its 4 resolution branches — `installed_plugins.json` → `marketplace-cache`, the `cache/<mp>/mos/<v>/` scan → `marketplace-cache`, the legacy clone → `legacy`, and you need a `dev-clone` check via `git remote -v` + `install.sh` presence, plus `not-found`.) |
| A generator + `--check` for `data/deployment-surfaces.json` (mirroring `command-registry.json`) | A static hand-maintained JSON file | `command-registry.json` is *generated from* `commands/*.md` frontmatter — there's a source of truth to drift against. `deployment-surfaces.json` isn't derived from anything; it's the source. A `--check` would have nothing to check it against. It's small (6 entries) and changes rarely. Static is correct. (Reuse the `data/` *layout* convention — a checked-in JSON both `session-start` and `doctor` read — not the generator machinery.) |
| `mktemp` HOME-override sandbox for the `--acceptance` `npx` round-trip | A `--dry-run` flag on `bin/cli.js` | A real round-trip into a sandbox proves more (it actually runs `npx @mindrian_os/install`, materializes `mos/<version>/`, checks `bin/cli.js` resolves) and is `bin/cli.js`-change-free. See Finding 4 for the recommended shape. |

**Installation:**
```bash
# In /home/jsagi/MindrianOS-Plugin (the dev workspace):
npm install --save-dev semver
# (or hand-add "semver": "^7.7.4" to package.json devDependencies and `npm install`)
```

**Version verification (run before locking the stack table):**
```bash
npm view semver version          # confirmed 7.8.0 (2026-05-12); 7.7.4 already in node_modules
node -e "console.log(require('semver/package.json').dependencies)"   # {} — zero runtime deps
```

---

## Architecture Patterns

### The contract, one line (from the spec)
> Nothing improvises the install state. **One record** is the truth; **one manifest** says what should be on disk; **one command (`doctor`)** enforces the contract on every session and every release; **`release.sh`** is the only thing that touches a version.

### Pattern 1: One resolver, snapshotted (the dispatcher principle generalized)
**What:** `lib/core/active-plugin-root.cjs` is the single source of truth for "where/what version is the active install." `session-start` calls it once, writes the answer to `~/.mindrian/install-state.json`. Every other consumer *reads the record* — not the resolver. The deployed file carries zero logic; it resolves at runtime. `scripts/statusline-mos-dispatch` (already shipped) is the worked example: `~/.claude/statusline-mos` is a 50-line shim with a `MINDRIAN-STATUSLINE-DISPATCH` marker that finds an installed plugin version and `exec`s that version's `scripts/statusline-mos`. The manifest's `marker` check kind exists to support exactly this: a plugin-side wrapper fix changes the deployed shim's bytes, and the `marker` check tolerates it (no manifest-hash bump needed in the same commit).
**When to use:** Every owned deployment surface. Never freeze a content SHA (D-09 rejected it — every wrapper fix would force a manifest hash bump or doctor false-positives on the fix that's rolling out).

### Pattern 2: Two-commit next-bump in `release.sh` (the D-19 fix)
**What:** A release produces TWO commits.
- **Commit A** (the *release commit*): CHANGELOG `## [vN] - <date>` finalized; `.claude-plugin/plugin.json` `version` == `vN`; `package.json` `version` == `vN`; `~/mindrian-marketplace/.claude-plugin/marketplace.json` `plugins[0].version` == `vN` AND `source.ref` == `vN`. `git tag vN` points at commit A.
- **Commit B** (the *next-bump commit*): `plugin.json`/`package.json` bumped to `vN+1` (the next pre-release, via `semver.inc(vN, 'prerelease', 'beta')` if `vN` is itself a beta, or via `--start-prerelease` if `vN` was a clean `X.Y.Z`); CHANGELOG `[Unreleased] -- vN+1 (in progress)` heading reset. `main` HEAD lands on commit B.
**Why:** Claude Code reads the installed version from `plugin.json` `version` first (Finding 1). `marketplace.json.source.ref = vN` checks out commit A; commit A's `plugin.json` says `vN`; Claude Code reports `vN`. ✓ Meanwhile `main` HEAD says `vN+1`, so "what's in the repo" and "what's published" never match — "repo says beta.11, registry already has beta.11" is structurally impossible. (The one-commit form would put `vN+1` on the commit that `ref: vN` checks out — broken.)
**Marketplace push:** `release.sh` pushes the marketplace repo at commit A's state (the `marketplace.json` only ever points at `vN`). The marketplace repo doesn't carry a "next" — only the plugin repo does.

### Pattern 3: Doctor class registration (existing, A–H today; add I + J)
**What:** `scripts/doctor.cjs` `main()` calls per-class check functions, lands their results in `report.checks[<name>]`, and `computeSummary(report)` walks `report.checks` for the healthy/drift/warning totals. Class flags (`--cascade-rooms`, `--verify-surface`, `--room-md`, `--ui-compliance`, `--statusline-visibility`) activate classes; `--all` activates everything. When any class flag is active, exit is *always 0* (graceful-degradation invariant — Canon Part 8 — unless an explicit `--fix` failed). `--fix` dispatch is gated per-class on `status === 'warn'` (sometimes `&& recoverable === true`). The `--json` output is `JSON.stringify(report, null, 2)`. Exit codes (no class flags): 0 healthy, 1 drift read-only, 2 drift recovered, 3 internal error, 4 recovery rolled back.
**NAMING COLLISION:** the codebase already has **class G** ("statusline visibility") and **class H** ("install-incomplete: missing statusLine block / halted `.install-receipt.json`", `scripts/doctor.cjs` ~L1119–1296, `checkInstallIncomplete()`, `performClassHFix()`). CONTEXT D-12 says "class H — install-state + topology + version-of-record" and "class I — deployment-surface manifest" — those labels are taken. **The planner must renumber:** recommend the new ones be **class I** (install-state + topology + version-of-record) and **class J** (deployment-surface manifest), and update CONTEXT D-12's labels in the PLAN. (Alternative: rename the existing class H to fold into the new install-state class — but that's a bigger refactor and the existing class H has shipped tests `test-doctor-class-h.cjs` / `test-doctor-class-h-fix.cjs`; renumber the new ones instead.)
**`INSTALL_DIR` bug:** `scripts/doctor.cjs:40` still has `const INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os')` — the *legacy clone path*. Class A (`checkInstallVersion`) reads `INSTALL_DIR/.claude-plugin/plugin.json` — on a marketplace-only box that dir doesn't exist (`status: 'missing'`), and `bin/cli.js` already resolves doctor via `active-plugin-root.cjs` so doctor *runs*, but class A's notion of "the install" is wrong. The new install-state class MUST use `resolveActivePluginRoot()`, and Bug 7 (D-11) means class A's "no `~/.claude/plugins/mindrian-os/` dir" must become "topology == marketplace-cache, which is VALID" rather than a `missing` finding. (The planner may also widen class A itself to resolve via the resolver, or leave class A as the legacy-topology check and let the new class own the truth.)

### Pattern 4: `--acceptance` as a checklist runner that *wraps* the existing harnesses
**What:** `mindrian-os doctor --acceptance` is a node-side checklist runner — an array of `{id, label, severity, run}` records — that CALLS the existing bash harnesses as sub-checks rather than re-implementing them:
- `scripts/verify-release` — the 14-section pre-release verification (`release.sh` already calls it in Step 2 and Step 6.5). `--acceptance` shells out to it once and folds its exit code into the checklist. (De-dup recommendation: have `release.sh` skip its own Step-2/Step-6.5 `verify-release` calls when it's going to run `--acceptance --pre-tag` anyway, OR accept the redundancy — it's idempotent and ~5s.)
- `scripts/release-beta-smoke.sh` — the pre-tag clone-and-assert harness (clones HEAD into a temp dir, asserts the cloned `plugin.json`/`package.json` versions match, runs the cloned preflight, checks the RS commands exist). **It's hard-coded to `EXPECTED_VERSION="1.11.0-beta.1"`** (Phase 89.6 artifact) — it's stale and version-pinned. `--acceptance --pre-tag` *supersedes* it: do the same clone-and-assert against the current `plugin.json` version, parameterized. The planner should *retire* `release-beta-smoke.sh` (or rewrite its body to call `--acceptance --pre-tag`).
- `tests/test-release-npm-gate.sh` — a 6-gate structural assertion that `release.sh` Step 9.5 has the `npm publish`, the ordering, the dist-tag logic, the `MOS_TEST_DRY_RUN` hatch, the recovery message, no em-dashes. Keep it as a unit test (it tests the *shape* of `release.sh`, which Plan-1 changes — update its `@mindrian_os/cli` → `@mindrian_os/install` expectations and re-confirm it passes). `--acceptance` doesn't need to call it; the Feynman runner / `tests/run-all.sh` should.
- `tests/manual/95.6-windows-cold-install-acceptance.md` — the manual Windows cold-install checklist. `--acceptance` *operationalizes* most of it (record consistent / surfaces reconciled / version-of-record / `npx` round-trip / `doctor --all` exit 0); update its `@mindrian_os/cli` references and add a "run `mindrian-os doctor --acceptance` and paste the output" step at the top.
**Two sub-modes** per D-16: `--pre-tag` = checks (1), (2), the repo-file half of (3) (`plugin.json`/`package.json`/CHANGELOG-top-entry consistency), (5) — runs in `release.sh` before `git tag`. Full = everything incl. git-tag-exists, marketplace `source.ref` == `vN`, `npm view @mindrian_os/install@<ver> version` == `vN`, the `npx` round-trip — runs in `release.sh` after the push. **Both hard aborts. No `--allow` override** (release infra is the one gate you cannot skip).

### Recommended file/dir layout (net-new + extended)
```
data/deployment-surfaces.json          # NEW — the manifest (static, hand-maintained)
lib/core/resolve-brain-key.cjs         # NEW — the Brain-key resolver (mirrors active-plugin-root.cjs)
lib/core/active-plugin-root.cjs        # EXTEND — add `topology` to the return shape; add dev-clone detection
scripts/release.sh                     # EXTEND — semver bump algebra, two-commit form, dirty-repo guard, Step 9.5 rename, --acceptance hooks
scripts/session-start                   # EXTEND — write install-state.json + ~/.mindrian-last-version (single writer, early); reconcile owned surfaces on version change; cache-prune on version change; Brain status line (replaces the MCP WARN)
scripts/doctor.cjs                      # EXTEND — class I (install-state + topology + version-of-record) + class J (manifest reconciliation) + aggressive --fix + --acceptance / --pre-tag flags + Bug-7 fix in the legacy-clone check + use active-plugin-root.cjs (not the hardcoded INSTALL_DIR)
bin/cli.js                              # EXTEND — pass --acceptance / --pre-tag through to doctor (it already routes `doctor`)
package.json                            # EXTEND — add `semver` to devDependencies
~/.mindrian/install-state.json          # NEW (runtime, user machine) — the record (written by session-start)
tests/test-doctor-class-i.cjs          # NEW — install-state/topology/version-of-record fixtures
tests/test-doctor-class-j.cjs          # NEW — manifest reconciliation fixtures
tests/test-doctor-class-i-fix.cjs      # NEW — legacy-migration / installed_plugins.json-repair fixtures
tests/test-release-semver-bump.sh      # NEW — release.sh bump-algebra + dirty-repo-guard + two-commit-form structural assertions
tests/test-resolve-brain-key.cjs       # NEW — the resolver's ordered fallback + SEC-02 reason path
brain-connector/SKILL.md, docs/install/BRAIN-SETUP.md, .env.brain.template, commands/setup.md, install.sh, docs/install/PACKAGING-PATHS.md, tests/manual/95.6-windows-cold-install-acceptance.md, tests/test-release-npm-gate.sh, CHANGELOG.md  # EDIT — Plan-5/Plan-7 sweeps
```

### Anti-Patterns to Avoid
- **A second install-state resolver.** `active-plugin-root.cjs` is THE one. The record is its output, snapshotted.
- **Freezing a content SHA on any deployment surface.** Every plugin-side wrapper fix would force a same-commit manifest-hash bump or false-positive doctor. Use `marker` (presence-of-sentinel) for runtime-resolving shims, `exact-value` (presence-of-exact-string) for the two surfaces that ARE a canonical value.
- **The one-commit next-bump form for `release.sh`.** Broken — Claude Code reads `plugin.json` `version` from the ref it checks out (Finding 1).
- **Re-running `verify-release` three times.** It's already in `release.sh` Step 2 + Step 6.5; `--acceptance` calls it once more. De-dup or accept the idempotent redundancy.
- **Naming the new doctor classes "H" and "I".** Class H is taken ("install-incomplete"). Use I + J.
- **Network in any session-path code.** The record write / manifest reconcile / cache prune / Brain status line are LOCAL-only (the Phase 95.2 `grep -E "fetch|http|curl|brain.mindrian|tavily"` returning 0 discipline). The Brain status line *checks for* a key; it does NOT call the Brain (that's `brain-client.cjs`'s job, unchanged).
- **`--fix` touching a dev-clone.** `dev-clone` = a git clone with an `origin` remote pointing at GitHub (e.g. `~/MindrianOS-Plugin`). `--fix` never migrates/removes/rewrites it. Migration applies to `legacy` (the obsolete `~/.claude/plugins/mindrian-os/` install-cache clone) only. **Heads up:** the live `~/.claude/plugins/mindrian-os/` legacy clone on this box has its `origin` remote pointing at `mindrian-agno-backend.git` (NOT `mindrian-os-plugin.git`) — so a naive "has an `origin` remote → dev-clone" test would mis-classify it. The dev-clone test must check that `origin` points at the *mindrian-os-plugin* repo specifically (or, more robustly, that `MINDRIAN_OS_ROOT` is set OR the path is the user's home-level `MindrianOS-Plugin` dir) — and `legacy` is specifically `~/.claude/plugins/mindrian-os/`.
- **`semver.inc(v, 'minor')` to finalize a beta.** It returns `1.13.0` on `1.13.0-beta.N`, same as `'patch'` — NOT `1.14.0`. Use `'patch'` for the "promote this beta series to stable" call (or just strip the `-...` suffix). `'minor'`/`'major'` only do something different when the *next* release should jump a minor/major over what the beta was targeting (rare; `--start-prerelease` covers opening a fresh series).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Parse/bump semver versions in `release.sh` | bash `IFS='.' read` / awk regex | `semver` npm package via `node -e` one-liner | The current `IFS='.' read` IS the bug — `1.13.0-beta.11` → `PATCH=0-beta`. Pre-release ordering, `inc` semantics, and channel transitions are a maintenance trap in bash. `semver` is the npm CLI's own library, zero deps. |
| "Where is the active plugin install / what version" | a new heuristic in the doctor class / a new `lib/` module | `lib/core/active-plugin-root.cjs` (extend it with `topology`) | This phase exists *because* N consumers each hand-rolled this. Adding an N+1th is the disease. |
| "Is the install consistent" (version-of-record) | a fresh consistency check in each consumer | the `~/.mindrian/install-state.json` record (snapshot of the resolver) + the doctor install-state class that reads it | One record, read by everyone — that's the contract. |
| Atomic file replace / backup-then-mutate in `--fix` | a new copy/rename routine | the class-A `performRecoveryAtomic` + `safeRename` pattern in `scripts/doctor.cjs` (cp → verify → two-step rename; EXDEV fallback via cpSync+rmSync) | Already battle-tested for the install-dir recovery (Phase 95.2). Reuse for legacy-migration and `installed_plugins.json` repair. |
| Dev-clone pre-commit-hook install | a new hook installer | `scripts/install-pre-commit.sh` (Phase 108) — `session-start` already calls it in the hooks block | The ROOM.md/MINTO.md guard installer is shipped; the manifest's `dev-clone`-scoped pre-commit surface reuses it idempotently. |
| Pre-release verification (validation, visuals, onboarding, marketplace sync, git state, CHANGELOG) | re-implementing 14 checks inside `--acceptance` | call `scripts/verify-release` from `--acceptance` (D-15) | It's shipped and `release.sh` already calls it; `--acceptance` *wraps*, doesn't duplicate. |
| Hermetic doctor test envelope | a new test harness | the `makeTmpHome` / `runDoctor` / `MINDRIAN_PLUGIN_HOME` pattern in `tests/test-doctor-class-g.cjs` + `tests/test-doctor-atomic-swap.cjs` | `scripts/doctor.cjs` already honors `MINDRIAN_PLUGIN_HOME` (line 40) and `HOME`/`USERPROFILE` for scratch dirs. |
| Brain-key resolution | a 4th place that reads the key its own way | `lib/core/resolve-brain-key.cjs` (mirrors `active-plugin-root.cjs`), and the 3 consumers delegate to it | The Brain key is the *same disease* one level over: `getApiKey()` reads env → CWD .env → `~/.mindrian.env`; `session-start`'s WARN reads only the shell env; `brain-connector/SKILL.md` has no HTTP-path branch at all. One resolver, three delegations. |

**Key insight:** Almost nothing in Phase 123 is net-new logic — it's *consolidation*. The pieces that already exist (`active-plugin-root.cjs`, the dispatcher shim, `doctor.cjs` class machinery, `performRecoveryAtomic`/`safeRename`, `verify-release`, `install-pre-commit.sh`, the `data/` JSON-file convention, `brain-client.cjs`'s correct HTTP path) all get pointed at one record / one manifest / one resolver. The only genuinely new files are `data/deployment-surfaces.json`, `~/.mindrian/install-state.json`, `lib/core/resolve-brain-key.cjs`, and the per-class test fixtures — and `release.sh`'s new bump algebra (which is mostly *deleting* the broken `IFS='.' read` and calling `semver.inc`).

---

## Runtime State Inventory

> This is a refactor/consolidation phase touching install-state machinery. The "runtime state" here is the install/update state, not user data.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `~/.mindrian/install-state.json` (NEW — the record this phase creates; written by `session-start`). `~/.mindrian-last-version` (EXISTS — currently `1.13.0-beta.11` on the Linux dev box, stale; `"unknown"` on the Windows box per the field report). `~/.claude/plugins/installed_plugins.json` (Claude Code's registry — on this box: `mos@mindrian-marketplace` → `version: "1.12.5.1"`, `installPath: ".../cache/mindrian-marketplace/mos/1.12.5.1"`, `scope: user`, `gitCommitSha: 23d3b5a...` — STALE; the marketplace.json says `1.13.0-beta.12`). `~/.claude/plugins/known_marketplaces.json` (records `mindrian-marketplace` → `jsagir/mindrian-marketplace`, last-updated timestamp). `~/.claude/plugins/marketplaces/mindrian-marketplace/.claude-plugin/marketplace.json` (the *cached catalog* — `plugins[0].version: "1.13.0-beta.12"`, `source.ref: "v1.13.0-beta.12"`). | **Code edit:** `session-start` becomes the single writer of `install-state.json` + `~/.mindrian-last-version`. **Data migration:** none needed — a fresh `session-start` rewrites both; the doctor `--fix` for "record absent / stale" re-runs that path. The stale `installed_plugins.json` on this dev box (`1.12.5.1` vs marketplace `1.13.0-beta.12`) is *exactly the kind of drift* class I should flag — it's not migrated, it's diagnosed (and a user-side `claude plugin update` is the fix; `--fix` can repoint `installed_plugins.json` at the newest valid marketplace-cache dir under the D-13 preconditions, then note "restart Claude Code"). |
| Live service config | The marketplace repo `~/mindrian-marketplace/.claude-plugin/marketplace.json` (`plugins[0].version` + `source.ref`) — `release.sh` is the only thing that should touch it; the two-commit form pins both to `vN`. Not in the plugin git repo — it's a separate repo (`jsagir/mindrian-marketplace`). The npm registry entry `@mindrian_os/install@<ver>` — `release.sh` Step 9.5 publishes it; `--acceptance` verifies it via `npm view`. The deprecated npm packages `@mindrian/os` (scope never existed) and `@mindrian_os/cli@1.13.0-beta.10` — historical, leave deprecated. | **API/manual:** `release.sh` (the two-commit form + Step 9.5 rename) handles the marketplace + npm; the planner's Plan-6 cuts `v1.13.0-beta.13` through it. No manual data migration. |
| OS-registered state | `~/.claude/settings.json` `statusLine.command` == `bash "/home/jsagi/.claude/statusline-mos"` (the deployed dispatcher shim) — an owned surface in the manifest. `~/.claude/statusline-mos` (the shim itself, marker `MINDRIAN-STATUSLINE-DISPATCH`) — owned surface. The plugin-bin `$PATH` entry — on this box `PATH` contains `/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.12.5.1/bin` (Claude Code adds `<installPath>/bin` to the Bash tool's PATH while the plugin is enabled — confirmed in the official docs and live `echo $PATH`). The dev-clone pre-commit hook (`<repo>/.git/hooks/pre-commit`, the ROOM.md/MINTO.md guard) — owned surface, `topology_scope: dev-clone` only. | **Re-stamp (idempotent):** `session-start` reconciles the shim + the `statusLine.command` line on version change (D-10). The `$PATH` bin entry is *observed-only* — never written; a wrong value is a "restart Claude Code" finding (Claude Code owns it). The pre-commit hook is re-stamped on a dev clone via `install-pre-commit.sh` (already wired). No new OS registration. |
| Secrets/env vars | `MINDRIAN_BRAIN_KEY` — IS in the shell env on this box (`544fd7d0-...`, 36 chars) AND in `~/.mindrian.env`. (CONTEXT's field report says the env var is *not* set on a "standard install" — true for a fresh user; on this dev box it's set, but the resolver's order handles both.) `~/.mindrian.env` exists; current mode unverified but D-34 wants `chmod 600` on every write going forward (and `getApiKey()` already rejects it if `mode & 0o077 !== 0` — currently with a bare stderr; Plan-7 routes that rejection through the session-start status line instead). `MINDRIAN_BRAIN_URL` (override, defaults to `https://mindrian-brain.onrender.com`) — code-read-only, no rename. `MINDRIAN_OS_ROOT` (resolver override — set by `scripts/statusline-mos` for `context-monitor`; tests/dev clones set it). | **Code rename only / none:** no secret *key* changes — only the *code that reads* `MINDRIAN_BRAIN_KEY` consolidates into `resolve-brain-key.cjs`. **Code edit:** `install.sh` + `commands/setup.md` add `chmod 600` on write (D-34). No data migration. |
| Build artifacts / installed packages | `~/.claude/plugins/cache/mindrian-marketplace/mos/{1.12.0,1.12.5,1.12.5.1}/` — three version dirs; `1.12.5.1` is active per `installed_plugins.json`; `1.12.0` + `1.12.5` are orphan-able (the cache-prune target — keep active + 2 most recent = all 3 stay here since there are only 3, but on a box with 4+ dirs the prune kicks in). `~/.claude/plugins/mindrian-os/` (the *legacy clone* — `version: 1.12.5`, `origin` → `mindrian-agno-backend.git`) + three `~/.claude/plugins/mindrian-os.stale-*/` backup dirs (from prior Phase 95.2 atomic-recovery runs) — the legacy-migration `--fix` target (backup → verify marketplace-cache healthy → remove). `node_modules/semver` (7.7.4, transitively present) — `release.sh` checks it exists; `package.json` should declare it as a devDep so `npm install` keeps it. The published `@mindrian_os/install` tarball (`files` allowlist — must NOT gain `semver` as a runtime dep, NOT gain `node_modules/` or `scripts/release.sh`, per the existing `npm pack --dry-run` payload gate). | **Reinstall / prune:** the cache-prune (D-22) handles orphan version dirs; the legacy-migration `--fix` handles `~/.claude/plugins/mindrian-os/` + its `.stale-*` backups (under the D-13 preconditions — refuse if the legacy dir has uncommitted/unpushed changes; this box's legacy clone has commits on `mindrian-agno-backend` HEAD so `--fix` would refuse it — correct behavior, since it's not a `mindrian-os-plugin` clone). `package.json` devDep add + `npm install`. |

**The canonical question — after every file in the repo is updated, what runtime systems still have the old install string cached, stored, or registered?** Answer: `installed_plugins.json` (Claude Code's registry — only `claude plugin update` or a `--fix` repoint refreshes it; Claude Code needs a restart to re-read it after a `--fix`), `~/.mindrian-last-version` (refreshed by the next `session-start`), the marketplace cache dirs (pruned by the cache-prune), and the npm registry (refreshed by `release.sh` Step 9.5). None of this is a *file rename* problem — it's an *install-state-consistency* problem, which is precisely what class I diagnoses and `--fix` recovers under guardrails. The Brain key is a *code rename only* (the key itself never changes).

---

## Common Pitfalls

### Pitfall 1: The one-commit `release.sh` form ships `vN+1` from a `vN` ref
**What goes wrong:** `release.sh` makes one commit, tags it `vN`, and that commit's `plugin.json` already says `vN+1`. `marketplace.json.source.ref = vN` checks out that commit; Claude Code reads `plugin.json` `version` == `vN+1`; the install self-reports as `vN+1` even though it was "released as `vN`".
**Why it happens:** Claude Code's Version Management resolves the installed version from `plugin.json` `version` FIRST (then the marketplace entry's `version`, then the commit SHA). The one-commit form was designed assuming Claude Code reads the version from `marketplace.json` — it doesn't.
**How to avoid:** The two-commit form (Pattern 2). Commit A: `plugin.json == vN`, tag `vN`. Commit B: bump to `vN+1`. `ref: vN` checks out A → reports `vN`. ✓
**Warning signs:** `mindrian-os doctor --acceptance` point (3) — version-of-record consistency across `plugin.json` / marketplace `source.ref` / published npm — would FAIL with the one-commit form (the checked-out `plugin.json` would say `vN+1`, the ref would say `vN`). The acceptance gate catches this.

### Pitfall 2: `semver.inc(v, 'minor')` doesn't promote a beta to the next minor
**What goes wrong:** A plan writes `release.sh patch|minor|major` expecting `1.13.0-beta.11 minor` → `1.14.0`. It returns `1.13.0` (same as `patch`). A "promote the beta series to stable" call written as `minor` silently produces the wrong version.
**Why it happens:** `semver.inc` treats a pre-release as "already targeting `MAJOR.MINOR.PATCH`"; `inc(v, 'patch')` and `inc(v, 'minor')` on `1.13.0-beta.N` both drop the suffix and return `1.13.0`; only `inc(v, 'major')` differs (`2.0.0`).
**How to avoid:** For "promote this beta to stable", use `inc(v, 'patch')` (or just `v.split('-')[0]`). For "the next stable should jump a minor over what the beta targeted", that's a `--start-prerelease` decision (open a fresh series) — not a `release.sh minor` on the current beta.
**Warning signs:** A test asserting `release.sh minor` on a `-beta.N` version yields `X.(Y+1).0` will fail. Write the test against actual `semver.inc` behavior, and document the finalize semantics in `release.sh`'s usage block.

### Pitfall 3: Naming the new doctor classes "H" and "I" — collision
**What goes wrong:** The codebase already has `class G` (statusline visibility) and `class H` (install-incomplete: missing statusLine block / halted `.install-receipt.json`), with shipped tests `test-doctor-class-h.cjs` / `test-doctor-class-h-fix.cjs`. A plan that adds a *new* "class H" creates ambiguity in code comments, tests, and CHANGELOG prose.
**Why it happens:** CONTEXT D-12 was written against the spec, which didn't account for the codebase's existing class roster.
**How to avoid:** Renumber the new classes to **I** (install-state + topology + version-of-record) and **J** (deployment-surface manifest). Update the PLAN's references to D-12's labels. Activate both under one new flag (`--install-state`, mirroring how `--statusline-visibility` activates two checks).
**Warning signs:** `grep -n "class H" scripts/doctor.cjs` already returns multiple hits referring to "install-incomplete" — that's the existing one.

### Pitfall 4: The dev-clone vs legacy-clone test mis-classifies the live box's legacy clone
**What goes wrong:** A `--fix` legacy-migration that detects "dev-clone" as "has an `origin` git remote" would see `~/.claude/plugins/mindrian-os/` (which has `origin` → `mindrian-agno-backend.git`) and refuse to migrate it as a "dev clone" — when it's actually a stale legacy install-cache clone of a *different* repo entirely.
**Why it happens:** The legacy `~/.claude/plugins/mindrian-os/` clone on this box happens to have a misconfigured `origin` pointing at `mindrian-agno-backend.git`, not `mindrian-os-plugin.git`.
**How to avoid:** `dev-clone` detection should be: `MINDRIAN_OS_ROOT` is set AND points here, OR the path is `~/MindrianOS-Plugin` (the canonical dev workspace) with `origin` → `jsagir/mindrian-os-plugin`. `legacy` is specifically `~/.claude/plugins/mindrian-os/` (the obsolete install-cache layout). `--fix` migrates `legacy` only, and refuses if the legacy dir has uncommitted/unpushed changes (this box's legacy clone has commits on the `mindrian-agno-backend` branch → `--fix` refuses it, which is the *correct* conservative behavior).
**Warning signs:** A test fixture with a fake legacy dir whose `origin` points anywhere should still classify as `legacy` and (if it has uncommitted changes) be refused by `--fix`.

### Pitfall 5: Network creeps into a session-path code path
**What goes wrong:** The Brain status line, or the manifest reconcile, or a "is the latest version available" check sneaks a `fetch`/`curl`/Brain call into `scripts/session-start` or `lib/core/resolve-brain-key.cjs`. Now SessionStart has a network dependency and a latency tail and a Canon Part 8 boundary question.
**Why it happens:** The Brain status line "Brain: HTTP client active" *sounds* like it pings the Brain. It doesn't — it only checks for a key (`resolve-brain-key.cjs` returns `available: true`). The actual Brain call is `brain-client.cjs`'s job and unchanged.
**How to avoid:** `grep -E "fetch|http|curl|brain.mindrian|tavily"` must return 0 in any new code in `scripts/session-start`, `lib/core/resolve-brain-key.cjs`, the doctor install-state/manifest classes, and the cache-prune. The ONE network touch in the phase is `--acceptance`'s release-time `npm view` + `npx` round-trip — and it runs only on the maintainer's box during a release, never in a user session.
**Warning signs:** A test (or the Feynman runner) should assert the grep returns 0 — mirror the Phase 95.2 `preflight-doctor.cjs` precedent (`grep -E "fetch|http|curl|brain.mindrian|tavily" scripts/preflight-doctor.cjs` → 0).

### Pitfall 6: The 4-component `1.12.5.1` version breaks `semver` and `parseVersion`
**What goes wrong:** `installed_plugins.json` on this box has `version: "1.12.5.1"` — a 4-component string that is NOT valid semver. `semver.valid('1.12.5.1')` → `null`; `semver.inc('1.12.5.1', 'patch')` → `null`. `doctor.cjs`'s own `parseVersion()` regex (`^(\d+)\.(\d+)\.(\d+)(?:-...)?$`) also rejects it. A class-I version-of-record comparison that calls `semver.compare` on it throws.
**Why it happens:** A past hand-rolled release produced `1.12.5.1` (a "hotfix-of-a-hotfix" suffix style). `release.sh` going forward only produces valid semver, but legacy installs carry the 4-component string.
**How to avoid:** The version-of-record comparison must tolerate non-semver: use `semver.coerce('1.12.5.1')` (→ `1.12.5`) for ordering, OR compare raw strings for *equality* (the version-of-record check is mostly "are these all the same string?", not "is A < B"). `release.sh`'s bump algebra should refuse to operate on a non-semver current version (with a clear "this version is not valid semver — fix `plugin.json` first" message), since `release.sh` is the going-forward path and `plugin.json` is currently a clean `1.13.0-beta.12`.
**Warning signs:** A test fixture with `installed_plugins.json` version `1.12.5.1` should make class I report "stale install (1.12.5.1 != marketplace 1.13.0-beta.12)" without throwing.

### Pitfall 7: `~/.mindrian-last-version` is only written on the cold-start branch today
**What goes wrong:** `scripts/session-start:419` (`echo "$PLUGIN_VERSION" > "$LAST_VERSION_FILE"`) is *inside the `else` branch of `if [ -d "$ROOM_DIR" ]`* — i.e. it only fires on a cold start with no active room. A session that *does* have an active room never updates `~/.mindrian-last-version`, so it goes stale (which is exactly the `1.13.0-beta.11` staleness observed on the Linux dev box, which always has an active room).
**Why it happens:** D-02 (the original version-marker decision) put the write in the banner-rendering branch, which only runs on cold start.
**How to avoid:** The install-state record write (D-03: "earliest steps, single writer, before any reader") fixes this by design — it runs unconditionally, near the top of `session-start`, before the `if [ -d "$ROOM_DIR" ]` fork, and folds the `~/.mindrian-last-version` write into the same step. The old `:419` write should be *removed* (it becomes redundant and wrong-branch). Confirm no other code reads `~/.mindrian-last-version` *before* the new early write (the LAST_VERSION variable is read at `:101` for the banner — the banner render must move after the new write, OR keep `:101`'s read of the *previous* value for the "version changed" banner and let the new write happen after the banner; the planner sequences this).
**Warning signs:** After Plan-2, a session *with* an active room must update `~/.mindrian-last-version` (a test: set it to a wrong value, run `session-start` with an active room, assert it's now `$PLUGIN_VERSION`).

---

## Code Examples

### Resolving the active plugin root + topology (extending the shipped resolver)
```javascript
// lib/core/active-plugin-root.cjs — current return shape (verified):
//   { root: <path|null>, source: 'MINDRIAN_OS_ROOT'|'installed_plugins.json'|'marketplace-cache'|'legacy-clone'|'not-found' }
// EXTEND to add `topology` and a dev-clone branch. Sketch:
function resolveActivePluginRoot() {
  const envRoot = process.env.MINDRIAN_OS_ROOT;
  if (envRoot) return { root: envRoot, source: 'MINDRIAN_OS_ROOT', topology: classifyTopology(envRoot) };
  const home = os.homedir();
  let r;
  if ((r = fromInstalledPlugins(home))) return { root: r, source: 'installed_plugins.json', topology: classifyTopology(r) };
  if ((r = fromMarketplaceCache(home))) return { root: r, source: 'marketplace-cache', topology: 'marketplace-cache' };
  if ((r = fromLegacyClone(home))) return { root: r, source: 'legacy-clone', topology: 'legacy' };
  return { root: null, source: 'not-found', topology: 'not-found' };
}
function classifyTopology(root) {
  // marketplace-cache: path is under ~/.claude/plugins/cache/<mp>/mos/<v>/
  // dev-clone:        has a .git AND an install.sh AND `git remote get-url origin` resolves to a mindrian-os-plugin repo
  //                   (OR MINDRIAN_OS_ROOT is set and points here)
  // legacy:           path === ~/.claude/plugins/mindrian-os/
  // not-found:        root is null
  // ... (planner implements; see Pitfall 4 for the dev-clone-vs-legacy distinction)
}
```

### Reading `installed_plugins.json` (the version-of-record source)
```javascript
// Verified live shape (Claude Code 2.x, ~/.claude/plugins/installed_plugins.json):
//   { "version": 2,
//     "plugins": {
//       "mos@mindrian-marketplace": [
//         { "scope": "user",
//           "installPath": "/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.12.5.1",
//           "version": "1.12.5.1",
//           "installedAt": "...", "lastUpdated": "...",
//           "gitCommitSha": "23d3b5a2d0fe9a4f4dfc6c60a3a0007791d8b637" }
//       ], ... } }
// The active install's version = entry.version; active root = entry.installPath; plugin-bin = entry.installPath + '/bin' (Claude Code adds it to the Bash tool PATH).
// active-plugin-root.cjs's fromInstalledPlugins() already reads it (defensive on key/array/path-field variants).
```

### The `semver` bump one-liner shape for `release.sh` (verified semantics)
```bash
# After: ensure node_modules/semver exists (or `npm install`).
# Verified outputs (semver 7.7.4, ran 2026-05-12):
#   --prerelease  : semver.inc('1.13.0-beta.11','prerelease','beta')  -> '1.13.0-beta.12'
#   finalize      : semver.inc('1.13.0-beta.11','patch')              -> '1.13.0'   (NOT 1.13.1; 'minor' also -> '1.13.0')
#   bump major    : semver.inc('1.13.0-beta.11','major')              -> '2.0.0'
#   start a fresh prerelease series from a clean version:
#                   semver.inc('1.13.0','preminor','beta')           -> '1.14.0-beta.0'   (note: beta.0, not beta.1 — call inc twice for beta.1)
#                   semver.inc('1.13.0','prepatch','beta')           -> '1.13.1-beta.0'
NEW_VERSION="$(node -e "
  const semver = require('$PLUGIN_DIR/node_modules/semver');
  const cur = require('$PLUGIN_DIR/.claude-plugin/plugin.json').version;
  if (!semver.valid(cur)) { console.error('plugin.json version is not valid semver: ' + cur); process.exit(1); }
  const mode = process.argv[1]; // 'prerelease' | 'patch' | 'minor' | 'major' | 'start-prerelease'
  let out;
  if (mode === 'prerelease')        out = semver.inc(cur, 'prerelease', 'beta');
  else if (mode === 'patch')        out = semver.inc(cur, 'patch');
  else if (mode === 'minor')        out = semver.inc(cur, 'minor');
  else if (mode === 'major')        out = semver.inc(cur, 'major');
  else if (mode === 'start-prerelease') { out = semver.inc(cur, 'preminor', 'beta'); out = semver.inc(out, 'prerelease', 'beta'); } // -> X.(Y+1).0-beta.1
  else { console.error('unknown bump mode: ' + mode); process.exit(1); }
  process.stdout.write(out);
" "$BUMP")"
```

### The Brain-key resolver shape (mirroring `active-plugin-root.cjs`)
```javascript
// lib/core/resolve-brain-key.cjs — NEW. Mirrors active-plugin-root.cjs's discipline:
//   ordered fallback chain, no silent unknown, a CLI form for shell-out, zero network.
// Resolution order (D-31): MINDRIAN_BRAIN_KEY env -> ~/.mindrian.env (MINDRIAN_BRAIN_KEY= line) -> CWD .env -> not-found.
//   (NOTE: brain-client.cjs::getApiKey() currently does env -> CWD .env -> ~/.mindrian.env — the reverse;
//    delegating to this resolver silently adopts D-31's order. Deliberate; flag it in the plan.)
// Returns: { key: <string|null>, source: 'env'|'~/.mindrian.env'|'cwd-.env'|'not-found', available: <bool>, reason: <string|null> }
//   available:false with a reason when a key FILE exists but (mode & 0o077) !== 0 (POSIX only):
//     reason = "permissions too open: ~/.mindrian.env is mode 0644, must be 0600 (chmod 600 ~/.mindrian.env)"
//   never a silent null + bare stderr (the current checkFilePermissions behavior — Plan-7 routes the reason
//   through scripts/session-start's status line per D-33).
// brain-client.cjs::getApiKey() becomes: const { key } = require('./resolve-brain-key.cjs').resolve(); return key;
// Auth is unchanged: brain-client.cjs sends `Authorization: Bearer <key>` (L195 + L255) — Bearer, NOT x-api-key (D-35).
```

### The deployment-surfaces manifest (sketch of the 6 surfaces, D-08)
```json
{
  "$schema-note": "GENERATED? no — hand-maintained. New surface = one entry, no code change. session-start reconciles owned surfaces on version change; doctor (class J) flags. $HOME token expanded via os.homedir(). topology_scope 'dev-clone' surfaces skipped on a user box.",
  "surfaces": [
    {
      "id": "statusline-dispatch-shim",
      "path": "$HOME/.claude/statusline-mos",
      "owner": "session-start",
      "topology_scope": "all",
      "check_kind": "marker",
      "expected": "MINDRIAN-STATUSLINE-DISPATCH",
      "reconcile": "on-version-change",
      "remediation": "session-start re-stamps the dispatcher shim; if it stays stale, an antivirus may be quarantining it — re-run a session or `mindrian-os doctor --fix`."
    },
    {
      "id": "settings-statusline-command",
      "path": "$HOME/.claude/settings.json",
      "owner": "session-start",
      "topology_scope": "all",
      "check_kind": "exact-value",
      "expected": "bash \"$HOME/.claude/statusline-mos\"",
      "reconcile": "on-version-change",
      "remediation": "session-start rewrites statusLine.command; if a managed-settings layer overrides it, that's expected."
    },
    {
      "id": "mindrian-last-version",
      "path": "$HOME/.mindrian-last-version",
      "owner": "session-start",
      "topology_scope": "all",
      "check_kind": "exact-value",
      "expected": "<active_version>",
      "reconcile": "on-version-change",
      "remediation": "session-start rewrites it to match installed_plugins.json on every session."
    },
    {
      "id": "install-state-record",
      "path": "$HOME/.mindrian/install-state.json",
      "owner": "session-start",
      "topology_scope": "all",
      "check_kind": "observed-only",
      "expected": null,
      "reconcile": "never",
      "remediation": "self — excluded from its own check. Absent -> 'run mindrian-os doctor --fix' (class I)."
    },
    {
      "id": "plugin-bin-path-entry",
      "path": "<active_root>/bin",
      "owner": "claude-code",
      "topology_scope": "all",
      "check_kind": "observed-only",
      "expected": null,
      "reconcile": "never",
      "remediation": "Claude Code owns PATH; a wrong/vanished entry -> 'restart Claude Code' (never stamped)."
    },
    {
      "id": "dev-clone-pre-commit-hook",
      "path": "<dev_clone_root>/.git/hooks/pre-commit",
      "owner": "session-start",
      "topology_scope": "dev-clone",
      "check_kind": "marker",
      "expected": "<the ROOM.md/MINTO.md guard sentinel from scripts/install-pre-commit.sh>",
      "reconcile": "on-version-change",
      "remediation": "session-start idempotently installs/updates it via scripts/install-pre-commit.sh; skipped entirely on a user (non-dev-clone) box."
    }
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| N consumers each re-derive install state with an ad-hoc heuristic (doctor hardcodes `~/.claude/plugins/mindrian-os/`, statusline does `ls cache | sort -V` with a pure-semver regex, `bin/cli.js` had a hardcoded legacy path, the SessionStart hook has its own version resolver) | `lib/core/active-plugin-root.cjs` — the ONE resolver; `bin/cli.js` + `scripts/statusline-mos` delegate to it (shipped v1.13.0-beta.12). Phase 123 finishes the job: the record (`~/.mindrian/install-state.json`) is the resolver's output snapshotted; everyone reads the record. | beta.12 (resolver) + Phase 123 (record + manifest + doctor classes) | The `MODULE_NOT_FOUND` doctor crash, the stale `1.12.0` statusline, the byte-stale deployed shim, the `~/.mindrian-last-version: unknown` — all one bug. The contract retires the family. |
| `~/.claude/statusline-mos` is a logic-bearing wrapper, re-copied from `session-start`'s `PLUGIN_ROOT` (which lags the just-updated version) | `~/.claude/statusline-mos` is a dumb dispatcher shim (`MINDRIAN-STATUSLINE-DISPATCH` marker, `scripts/statusline-mos-dispatch`) that resolves the active version at runtime and `exec`s that version's `scripts/statusline-mos`. A wrapper fix in vN+1 reaches users next session with no re-stamp. (shipped beta.12) | beta.12 | The "deployed file carries zero logic" principle — generalized by the manifest's `marker` check kind. |
| `release.sh` only handles clean `X.Y.Z` (`IFS='.' read -r MAJOR MINOR PATCH` mangles `1.13.0-beta.11` to `PATCH=0-beta`) → pre-releases hand-rolled (beta.10/11/12/13) → "never bump by hand" violated → the 1.9.9-vs-1.9.4 drift mechanism | `release.sh` uses `semver.inc()` (devDep), supports `--prerelease`/`patch`/`minor`/`major`/`--start-prerelease`, the two-commit next-bump form, a dirty-repo/ahead-of-origin guard, and the `@mindrian_os/cli` → `@mindrian_os/install` Step 9.5 rename. | Phase 123 Plan-1 | Future betas cut via `release.sh`. The version treadmill stops. |
| Claude Code reads the plugin's installed version from... (ambiguous before this research) | **Confirmed: `.claude-plugin/plugin.json` `version` FIRST, then `marketplace.json` `plugins[].version`, then the git commit SHA, then `unknown`** (official Version Management spec; live `claude plugin list` reports the install's `plugin.json` version). | (always — now documented) | Forces the two-commit `release.sh` form (the one-commit form would self-report `vN+1` from a `vN` ref). |
| Brain-key detection: `session-start` checks only the shell env var; `brain-connector/SKILL.md` has no HTTP-path branch; `getApiKey()` reads a 4th, narrower-than-the-writer location order — so a working `~/.mindrian.env` Brain key is invisible and the model silently drops to Tier 0 | `lib/core/resolve-brain-key.cjs` — the ONE Brain-key resolver (mirrors `active-plugin-root.cjs`); the 3 consumers delegate to it; a positive status line replaces the MCP-centric WARN; SEC-02 `chmod 600` on write; Bearer-not-x-api-key made explicit in the docs. | Phase 123 Plan-7 | The HTTP-path Brain becomes *detectable and documented as present* (the canonical MCP-vs-HTTP pick stays deferred — D-36). |
| `~/.claude/plugins/cache/<mp>/mos/<v>/` accumulates a dir per version forever, nothing prunes | Cache prune keyed off `installed_plugins.json`: keep active + N=2 most recent; never delete the active one; skip if `installed_plugins.json` unreadable. Runs in `session-start` (on version change) + `doctor --fix` (unconditional). | Phase 123 Plan-5 | Confirmed live: `mos/{1.12.0,1.12.5,1.12.5.1}/` — 3 dirs, active is `1.12.5.1`. |

**Deprecated/outdated:**
- `scripts/release-beta-smoke.sh` — hard-coded to `EXPECTED_VERSION="1.11.0-beta.1"` (a Phase 89.6 artifact). Stale and version-pinned. `--acceptance --pre-tag` supersedes it; the planner should retire it (or rewrite its body to call `--acceptance --pre-tag`).
- `scripts/release.sh` Step 9.5's `@mindrian_os/cli` package name — the package is `@mindrian_os/install` now (D-21).
- `commands/setup.md` line 145's `mindrianos-jsagirs-projects.vercel.app/brain-access` — should be `mindrian-os.com/brain-access` (and the no-key fallback message in `brain-client.cjs`/`session-start` should surface that URL per D-35).
- The npm packages `@mindrian/os` (scope never existed — `{"error":"Scope not found"}`) and `@mindrian_os/cli@1.13.0-beta.10` (a token-validation publish) — both deprecated; leave deprecated, don't republish.
- `.env.brain.template` is entirely MCP/Supabase/Neo4j/Pinecone-centric (no mention of the HTTP-path `MINDRIAN_BRAIN_KEY` → `Authorization: Bearer` → `mindrian-brain.onrender.com` path). Plan-7 makes the HTTP path *present in the docs* (D-35); the *canonical pick* (full alignment, declaring one "the" path) stays deferred (D-36).

---

## Open Questions

1. **De-dup `verify-release` runs in `release.sh`?**
   - What we know: `release.sh` calls `scripts/verify-release` in Step 2 (pre-release) and Step 6.5 (post-bump). `--acceptance` (D-15) also calls `verify-release`. After Plan-4 wires `--acceptance --pre-tag` (before tag) and full `--acceptance` (after push), `verify-release` could run up to 4 times in one release.
   - What's unclear: whether to refactor `release.sh` so `verify-release` runs exactly twice (drop Step 2/Step 6.5 in favor of the `--acceptance --pre-tag` call) or accept the redundancy.
   - Recommendation: accept the redundancy for Plan-4 (it's idempotent, ~5s each, and de-duping risks regressing the existing Step 2/6.5 gates); leave a `# TODO: de-dup verify-release runs once --acceptance is proven` comment. The planner can scope a follow-up.

2. **Does `--acceptance` point (3) need to handle a *pinned* user (someone on `--version X` ≠ marketplace `plugins[].version`)?**
   - What we know: `bin/cli.js install` and `release.sh`-doc both pass `--version 1.13.0-beta.9`-style flags through to `claude plugin install`; release-process.md documents `claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1` as the beta opt-in. So a user *can* be on a version that differs from the marketplace catalog's current `plugins[].version`.
   - What's unclear: `--acceptance` runs on the *maintainer's* box at *release time*, so the maintainer's install should be the just-cut `vN` (and `--acceptance` can `claude plugin update` first, or assert the resolved `active_version` == `vN`). The pinned-user scenario is a *class I* concern (version-of-record consistency on a user box), not a `--acceptance` concern.
   - Recommendation: `--acceptance` point (3) compares the *release artifacts* (`plugin.json`/`package.json`/CHANGELOG-top/git-tag/marketplace-`source.ref`/`npm view`) against each other — six things that must all equal `vN`. The *installed* version on the maintainer's box is point (1)/(5)'s concern (record consistent + `doctor --all` exit 0); `--acceptance --pre-tag` runs *before* the install would be updated, so it asserts the *repo artifacts*, not the installed version. Class I (on any box) is where "the installed version vs the marketplace's `plugins[].version`" gets diagnosed, and a pinned user is a *valid* state there (not drift) — flag it as "pinned to vX (marketplace has vY)" informationally, not as a finding.

3. **Where exactly does the install-state-record write land in `session-start`'s ordering vs the banner render?**
   - What we know: `~/.mindrian-last-version` is read at `:101` (into `LAST_VERSION`, used at `:401` for the "version changed" banner) and written at `:419` (cold-start branch only — Pitfall 7). The new write must be "earliest steps, before any reader" (D-03).
   - What's unclear: the banner render at `:401` reads the *previous* `LAST_VERSION` to decide "show transition banner". If the new write happens *before* `:101`'s read, the banner never shows a transition.
   - Recommendation: keep `:101`'s read of the *previous* value (the LAST_VERSION variable); insert the new install-state-record + `~/.mindrian-last-version` write *after* the banner render (the banner is still early — it's before the room-context fork — and "before any reader" really means "before the *statusline* / *bin/cli.js* / *downstream consumers* read the record", which they do much later or in a different process). Or: move the banner-transition decision to compare `LAST_VERSION` (captured at `:101`) and write immediately after — either works. The planner sequences it; the constraint is "no consumer reads the *record* before it's written" (the record doesn't exist yet pre-Phase-123, so the only thing to coordinate is the `~/.mindrian-last-version` read at `:101` vs the new write — keep the read first).

4. **`semver` devDep — does `release.sh` `npm install` or check-and-instruct on a missing `node_modules/semver`?**
   - What we know: D-18 says "checks `node_modules/semver` exists (or runs `npm install`)". `semver@7.7.4` is already present transitively, so on a normal dev box it's there.
   - What's unclear: a fresh clone with no `npm install` yet — should `release.sh` run `npm install` (slow, mutates `node_modules`) or print "run `npm install` first, then re-run `release.sh`"?
   - Recommendation: check-and-instruct (`if [ ! -d "$PLUGIN_DIR/node_modules/semver" ]; then echo "Run 'npm install' first (release.sh needs the semver devDep)."; exit 1; fi`). `release.sh` is a release script — it should not mutate the working tree's `node_modules` as a side effect. Adding `semver` to `package.json` `devDependencies` means a normal `npm install` brings it in; the release operator runs `npm install` as a normal step.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Everything | ✓ | ≥ 22.5.0 per `package.json` `engines` (this box runs a compliant version — `session-start`'s node preflight would have tripped otherwise) | — (hard requirement; `session-start` already has a friendly node-version preflight) |
| `semver` (npm) | `scripts/release.sh` bump algebra | ✓ | `7.7.4` (transitively in `node_modules/semver`); latest `7.8.0`; **add to `package.json` `devDependencies`** | — (add as devDep; `release.sh` check-and-instruct if missing) |
| `git` | `release.sh` push guard; `--acceptance` git-tag check; doctor dev-clone detection | ✓ | system git | — (already a release-pipeline dependency) |
| `claude` CLI | `release.sh` (`claude plugin validate` / `marketplace update`); `--acceptance` / `bin/cli.js install` (`claude plugin install`/`update`) | ✓ | live `claude plugin list` works (this box) | `bin/cli.js` already prints "install Claude Code via `npm install -g @anthropic-ai/claude-code`" when missing |
| `npm` / `npx` | `release.sh` Step 9.5 publish; `--acceptance` `npm view` + `npx @mindrian_os/install` round-trip | ✓ | `npm view semver version` → `7.8.0` works (this box, despite the sandbox) | release-time only; if npm is unreachable at release time, `release.sh` Step 9.5 already halts loudly with a recovery message |
| `python3` | `scripts/verify-release` (version-sync checks) | ✓ (assumed — `verify-release` already uses it; on Windows it's the Microsoft Store stub, which is why `session-start` uses `platform.cjs.readPluginJsonVersion` instead — `--acceptance` should NOT depend on `python3`, do the version reads in node) | system | `--acceptance` does its version-of-record reads in node (`require(...).version`), not via `verify-release`'s python3 — so the python3 dependency stays confined to the legacy `verify-release` script |
| `tar` | `--fix` legacy-clone migration backup | ✓ (POSIX) | system | on Windows the legacy-clone migration is a no-op (the `~/.claude/plugins/mindrian-os/` layout is a POSIX-era artifact; Windows installs were always marketplace-cache) |

**Missing dependencies with no fallback:** none. (Everything required is available on this box; the only *add* is `semver` to `package.json` `devDependencies`, which is a one-line edit + `npm install`.)

**Missing dependencies with fallback:** none blocking. (The `python3` note is a "don't introduce a new dependency on it" — `--acceptance` reads versions in node.)

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — this section applies. This phase warrants it: doctor classes I/J, the `--acceptance` gate, `release.sh` bump algebra + the two-commit form + dirty-repo guard, the cache prune, and the Brain-key resolver all need test coverage.

### Test Framework
| Property | Value |
|---|---|
| Framework | Node built-in `assert` + child-process spawn-and-assert (the plugin's pattern — no jest/vitest). CJS test files (`tests/test-*.cjs`), bash structural-assertion scripts (`tests/test-*.sh`). Registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` (the canonical runner) and aggregated by `tests/run-all.sh` / scoped runners (`tests/run-all-122.sh`-style). |
| Config file | none — `lib/memory/run-feynman-tests.cjs` IS the runner registry (`TEST_FILES[]` array, line 33+). New test files get added there. |
| Quick run command | `node tests/test-doctor-class-i.cjs` (single file) — exits 0 on all pass, 1 on any fail; prints per-test PASS/FAIL. |
| Full suite command | `node lib/memory/run-feynman-tests.cjs` (all registered Feynman + doctor + workflow tests) — and `bash tests/test-release-npm-gate.sh` / `bash tests/test-release-semver-bump.sh` (the release.sh structural assertions). |

### Phase Requirements → Test Map
| Req (candidate) | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| HARNESS-123-01 | `release.sh` bump algebra: `--prerelease` → `beta.N+1`; `patch` → `X.Y.0` (NOT `X.Y.1`); `--start-prerelease` → `X.(Y+1).0-beta.1`; refuses on non-semver `plugin.json` version | unit (structural + a dry-run) | `bash tests/test-release-semver-bump.sh` | ❌ Wave 0 (new) |
| HARNESS-123-02 | `release.sh` two-commit form: commit A has `plugin.json == vN` + tag `vN`; commit B has `plugin.json == vN+1`; `main` HEAD on B; marketplace `source.ref == vN` | unit (structural assertion on `release.sh` + a `MOS_TEST_DRY_RUN` walk in a temp git repo) | `bash tests/test-release-semver-bump.sh` (same file) | ❌ Wave 0 |
| HARNESS-123-03 | `release.sh` dirty-repo / ahead-of-origin guard: aborts when >1 (beyond A+B) commit ahead, or when a non-bumped tracked file is dirty; `--allow-ahead` overrides | unit (structural + temp-repo walk) | `bash tests/test-release-semver-bump.sh` | ❌ Wave 0 |
| HARNESS-123-04 | `release.sh` Step 9.5 names `@mindrian_os/install`, dist-tag `@next`/`@latest`, payload-allowlist gate, recovery message, no em-dashes | unit (structural) | `bash tests/test-release-npm-gate.sh` (UPDATE the existing `@mindrian_os/cli` expectations to `@mindrian_os/install`) | ✓ exists (update) |
| HARNESS-123-05 | `session-start` writes `~/.mindrian/install-state.json` (full snapshot per D-04) + `~/.mindrian-last-version` (matching `installed_plugins.json`) unconditionally, early, single-writer; a session WITH an active room updates `~/.mindrian-last-version` (Pitfall 7) | integration (spawn `session-start` with a scratch `HOME` + active room fixture, assert both files) | `node tests/test-session-start-install-state.cjs` | ❌ Wave 0 |
| HARNESS-123-06 | `data/deployment-surfaces.json` parses; has the 6 D-08 surfaces with the D-07 fields; `$HOME` token present (not absolute paths); `topology_scope: dev-clone` on the pre-commit surface | unit (schema assertion) | `node tests/test-deployment-surfaces-manifest.cjs` (could also be a sub-test in the class-J test) | ❌ Wave 0 |
| HARNESS-123-07 | doctor class I: record present + consistent → ok; record absent → drift finding (not crash) + `--fix` re-runs the record-write path; topology classification (marketplace-cache / dev-clone / legacy / not-found, each VALID except not-found) — **Bug 7** = "no legacy clone on a marketplace box" is not drift; 6-way version-of-record equality (tolerant of a 4-component `1.12.5.1` — no throw); uses `active-plugin-root.cjs`, not the hardcoded `INSTALL_DIR` | integration (hermetic scratch `MINDRIAN_PLUGIN_HOME` + `HOME` with synthesized states; spawn `doctor --install-state --json`) | `node tests/test-doctor-class-i.cjs` | ❌ Wave 0 |
| HARNESS-123-08 | doctor class J: every owned surface in the manifest OK → ok; a drifted marker / wrong exact-value → drift; `dev-clone`-scoped surfaces skipped on a user box; Desktop/Cowork carve-out (skip) | integration (hermetic scratch) | `node tests/test-doctor-class-j.cjs` | ❌ Wave 0 |
| HARNESS-123-09 | `doctor --fix` (aggressive): missing record → recovered; drifted marker → rewritten; `~/.mindrian-last-version` mismatch → rewritten; legacy-clone migration (fake legacy dir → backed up to `~/.mindrian/backups/`, then removed; refuse if uncommitted/unpushed; `dev-clone` untouchable; never delete the active root); `installed_plugins.json` repair (stale → repointed at newest valid marketplace-cache dir; backed up); cache-prune (>3 dirs → pruned to active + 2, active never deleted, skip if `installed_plugins.json` unreadable); flag-only for `not-found` / vanished `$PATH` bin / wrong-statusline-version | integration (hermetic scratch — mirror `tests/test-doctor-atomic-swap.cjs`'s scenario style) | `node tests/test-doctor-class-i-fix.cjs` (+ a `tests/test-doctor-cache-prune.cjs` if the prune wants its own file) | ❌ Wave 0 |
| HARNESS-123-11 | `mindrian-os doctor --acceptance` 5-point + `--acceptance --pre-tag` (repo-file half only); both hard-abort on any failure; calls `verify-release`; `npx` round-trip is sandboxed (mktemp HOME-override) — never touches the live install | integration (run `--acceptance --pre-tag` against the repo; assert exit 0 on a clean state, exit non-zero with a synthesized version mismatch) | `node tests/test-doctor-acceptance.cjs` (+ a bash wrapper for the `release.sh` wiring) | ❌ Wave 0 |
| HARNESS-123-13 | cache-prune: keep active + 2 most recent; never delete active; skip if `installed_plugins.json` unreadable (covered by HARNESS-123-09's test or its own) | unit/integration | `node tests/test-doctor-cache-prune.cjs` (or folded into `test-doctor-class-i-fix.cjs`) | ❌ Wave 0 |
| HARNESS-123-15 | `lib/core/resolve-brain-key.cjs`: env wins; then `~/.mindrian.env`; then CWD `.env`; then `{key:null, source:'not-found', available:false}`; a key file with `mode & 0o077 !== 0` → `available:false` with an explicit `reason` (POSIX); `brain-client.cjs::getApiKey()` delegates (returns the resolved key); the resolver makes zero network calls | unit (scratch `HOME` + scratch `.env` files with controlled modes) | `node tests/test-resolve-brain-key.cjs` | ❌ Wave 0 |
| HARNESS-123-16 | `install.sh` / `commands/setup.md` `chmod 600 ~/.mindrian.env` on write (POSIX); `BRAIN-SETUP.md` + `.env.brain.template` say Bearer-not-x-api-key; the no-key fallback surfaces `https://mindrian-os.com/brain-access` | unit (grep/structural assertions on the files) — most of D-16's testable surface is "the docs say X" | `node tests/test-brain-setup-docs.cjs` (or fold the grep asserts into `test-resolve-brain-key.cjs`) | ❌ Wave 0 |
| (Canon Part 8) | `grep -E "fetch|http|curl|brain.mindrian|tavily"` returns 0 in: any new `scripts/session-start` lines, `lib/core/resolve-brain-key.cjs`, the doctor class-I/J/cache-prune code | unit (grep sweep — mirror Phase 95.2's `preflight-doctor.cjs` precedent) | folded into `test-doctor-class-i.cjs` / `test-resolve-brain-key.cjs` (a `assert(spawnSync('grep', [...]).status !== 0)` sweep) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-doctor-class-i.cjs` (or whichever new file the task touched) + `bash tests/test-release-npm-gate.sh` if `release.sh` changed.
- **Per wave merge:** `node lib/memory/run-feynman-tests.cjs` (full registered suite) + `bash tests/test-release-semver-bump.sh` + `bash tests/test-release-npm-gate.sh`.
- **Phase gate:** full suite green + `mindrian-os doctor --all` exits 0 on the dev box + `mindrian-os doctor --acceptance --pre-tag` exits 0, then `/gsd:verify-work`. The *real* phase gate per D-29: Lawrence runs `mindrian-os doctor --acceptance` on a real Windows box, all green, before `v1.13.0-beta.13` promotes to a clean `1.13.0`.

### Wave 0 Gaps
- [ ] `tests/test-doctor-class-i.cjs` — install-state + topology + version-of-record fixtures (HARNESS-123-07); also carries the Canon Part 8 grep sweep for the class-I code.
- [ ] `tests/test-doctor-class-j.cjs` — deployment-surface manifest reconciliation fixtures (HARNESS-123-08); can carry the `data/deployment-surfaces.json` schema assertion (HARNESS-123-06).
- [ ] `tests/test-doctor-class-i-fix.cjs` — aggressive `--fix` fixtures: legacy-migration, `installed_plugins.json` repair, missing-record recovery, marker rewrite, `~/.mindrian-last-version` rewrite (HARNESS-123-09). Mirror `tests/test-doctor-atomic-swap.cjs`'s scenario-builder style.
- [ ] `tests/test-doctor-cache-prune.cjs` — cache-prune (HARNESS-123-13) — OR fold into `test-doctor-class-i-fix.cjs`.
- [ ] `tests/test-doctor-acceptance.cjs` — `--acceptance` / `--pre-tag` (HARNESS-123-11) — clean state → exit 0; synthesized version mismatch → exit non-zero; assert the `npx` round-trip is sandboxed.
- [ ] `tests/test-session-start-install-state.cjs` — `session-start` writes the record + `~/.mindrian-last-version` early/unconditionally/single-writer; active-room session updates `~/.mindrian-last-version` (Pitfall 7) (HARNESS-123-05).
- [ ] `tests/test-deployment-surfaces-manifest.cjs` — `data/deployment-surfaces.json` schema (HARNESS-123-06) — OR fold into `test-doctor-class-j.cjs`.
- [ ] `tests/test-release-semver-bump.sh` — `release.sh` bump algebra + two-commit form + dirty-repo guard (HARNESS-123-01/02/03). Structural assertions on `release.sh` + a `MOS_TEST_DRY_RUN` walk in a temp git repo (mirror `tests/test-release-npm-gate.sh`'s structural style + `scripts/release-beta-smoke.sh`'s temp-clone style).
- [ ] `tests/test-resolve-brain-key.cjs` — the resolver's ordered fallback + SEC-02 `reason` path + zero-network grep sweep (HARNESS-123-15); can carry the `test-brain-setup-docs` grep asserts (HARNESS-123-16).
- [ ] `tests/test-release-npm-gate.sh` — UPDATE existing: change `@mindrian_os/cli` expectations to `@mindrian_os/install`; re-confirm the 6 structural gates pass against Plan-1's rewritten `release.sh`.
- [ ] Register all new `tests/test-*.cjs` in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` and in `tests/run-all.sh` (and a `tests/run-all-123.sh` scoped runner if the phase wants one, mirroring `tests/run-all-122.sh`).
- [ ] Add `semver` to `package.json` `devDependencies` (one-line edit) + `npm install`.
- [ ] (Retire or rewrite) `scripts/release-beta-smoke.sh` — superseded by `--acceptance --pre-tag`; its hard-coded `EXPECTED_VERSION="1.11.0-beta.1"` makes it dead weight.

---

## Sources

### Primary (HIGH confidence)
- **Claude Code official plugin docs** (verified 2026-05-12):
  - `https://code.claude.com/docs/en/plugins` — plugin manifest, `version` field semantics ("If set, users only receive updates when you bump this field. If omitted ... the commit SHA is used").
  - `https://code.claude.com/docs/en/plugins-reference` § "Version management" — **the version is resolved from the first of: (1) `plugin.json` `version`, (2) marketplace entry `version`, (3) git commit SHA, (4) `unknown`** — and "If also set in the marketplace entry, `plugin.json` wins." Plus `bin/` → "Executables added to the Bash tool's `PATH` while the plugin is enabled."
  - `https://code.claude.com/docs/en/plugin-marketplaces` § "Version resolution and release channels", § "Plugin sources" — `source.ref` = git branch/tag (gets checked out); `source.sha` = exact commit; marketplace-source vs plugin-source distinction; "Avoid setting `version` in both `plugin.json` and the marketplace entry. The `plugin.json` value always wins silently."
  - `https://code.claude.com/docs/en/discover-plugins` — `claude plugin install`/`update`/`disable`/`enable`/`uninstall`; "Plugins are copied to a cache, so paths referencing files outside the plugin directory won't work"; `~/.claude/plugins/cache` is the cache root; "Clear the cache with `rm -rf ~/.claude/plugins/cache`".
- **Live `~/.claude/plugins/` state on this box** (read directly): `installed_plugins.json` (`mos@mindrian-marketplace` → `version: "1.12.5.1"`, `installPath: ".../cache/mindrian-marketplace/mos/1.12.5.1"`, `gitCommitSha: 23d3b5a...`); `known_marketplaces.json`; `marketplaces/mindrian-marketplace/.claude-plugin/marketplace.json` (`plugins[0].version: "1.13.0-beta.12"`, `source.ref: "v1.13.0-beta.12"`); `cache/mindrian-marketplace/mos/{1.12.0,1.12.5,1.12.5.1}/`; `mindrian-os/.claude-plugin/plugin.json` (`version: "1.12.5"`) + `git -C ~/.claude/plugins/mindrian-os remote -v` (`origin` → `mindrian-agno-backend.git`); `~/.mindrian-last-version` (`1.13.0-beta.11`); `claude plugin list` output (reports `mos` Version: `1.12.5.1`, and `context7`/`frontend-design` Version: `128d47efbf15` (commit SHAs — those plugins have no `version` field)); `echo $PATH` (contains `.../cache/mindrian-marketplace/mos/1.12.5.1/bin`).
- **`semver` API, verified by running it** (semver 7.7.4 in `node_modules/semver`): `inc('1.13.0-beta.11','prerelease','beta')` → `1.13.0-beta.12`; `inc('1.13.0-beta.11','patch')` → `1.13.0`; `inc('1.13.0-beta.11','minor')` → `1.13.0`; `inc('1.13.0-beta.11','major')` → `2.0.0`; `inc('1.13.0','preminor','beta')` → `1.14.0-beta.0`; `inc('1.13.0','prepatch','beta')` → `1.13.1-beta.0`; `valid('1.12.5.1')` → `null`; `coerce('1.12.5.1')` → `1.12.5`; `node_modules/semver/package.json` `dependencies: {}`. `npm view semver version` → `7.8.0` (latest).
- **Codebase, read in full:** `lib/core/active-plugin-root.cjs`, `scripts/release.sh`, `bin/cli.js`, `scripts/verify-release`, `scripts/release-beta-smoke.sh`, `tests/test-release-npm-gate.sh`, `scripts/doctor.cjs` (structure + class A/G/H + `main()` + `computeSummary` + constants), `scripts/session-start` (workspace guard, node preflight, version detection, `~/.mindrian-last-version` read/write, Step A/B statusline migration, Brain check block), `lib/core/brain-client.cjs` (`getApiKey()`, `checkFilePermissions()`, `Authorization: Bearer`), `skills/brain-connector/SKILL.md`, `commands/setup.md` (Brain flow), `hooks/hooks.json` (SessionStart hooks roster), `data/command-registry.json` + `scripts/build-command-registry.cjs` (the `data/` convention + `--check` pattern), `scripts/preflight-doctor.cjs` + `scripts/preflight-release-drift.cjs` (the SessionStart preflight precedents), `scripts/statusline-mos` + `scripts/statusline-mos-dispatch` (the dispatcher), `.env.brain.template`, `docs/install/PACKAGING-PATHS.md`, `docs/INSTALL-LIFECYCLE-HARNESS.md` (the spec), `123-CONTEXT.md` (the 37 decisions), `.planning/config.json`, `.planning/ROADMAP.md` (Phase 123 entry), `.planning/REQUIREMENTS.md` (DOCTOR-95.1/95.2 + WORKFLOW-122 patterns).

### Secondary (MEDIUM confidence)
- `CHANGELOG.md` (the v1.13.0-beta.12 entry — the `@mindrian_os/cli` → `@mindrian_os/install` rename history, the npm-installer overhaul, the version trail).
- `docs/autopsies/2026-05-09-gary-laben-install-failure.md` (the install-cache failure family — context for why `release.sh` Step 9.5 + the npm path matter).
- `.claude/includes/release-process.md` (the 5-way version-consistency rule, "release infra ships as a beta first", marketplace-source-must-be-pinned).
- Memory `feedback_release_lockstep_npm` (the 6-way npm-lockstep rule — note: the "`packages/npm-installer/package.json`" sync surface it names does NOT exist in this repo; the npm package IS the repo).

### Tertiary (LOW confidence)
- None. (No web search beyond the official Claude Code docs was needed; everything else was local file reads + running `semver` + reading the live `~/.claude/plugins/` state.)

---

## Metadata

**Confidence breakdown:**
- D-19 verdict (two-commit form): **HIGH** — official Version Management spec ("the version is resolved from the first of: (1) `plugin.json` `version`...") + live `claude plugin list` confirming the install reports its `plugin.json` version + live `installed_plugins.json` vs marketplace.json divergence. Unambiguous.
- `installed_plugins.json` + cache layout + plugin-bin PATH: **HIGH** — read directly from the live box; matches the official docs.
- `semver` integration: **HIGH** — ran the actual API; confirmed zero deps; corrected CONTEXT D-18's `patch`/`minor` claim.
- `--acceptance` `npx` round-trip mechanics: **MEDIUM-HIGH** — the mktemp HOME-override sandbox approach is sound; the exact `npx` invocation (`npx @mindrian_os/install --version <ver>` into a sandboxed HOME, then assert `mos/<version>/` materializes) wasn't *executed* (would touch the network + the operator's npm cache), but the mechanism is well-understood and `bin/cli.js`'s install path is read in full.
- doctor class structure + `--acceptance` wrapping: **HIGH** — `scripts/doctor.cjs` read in full (structure, class roster, `main()`, `computeSummary`, exit codes); the naming-collision finding (existing class G + H) is from `grep -n "class [A-Z]" scripts/doctor.cjs`.
- `session-start` integration points: **HIGH** — read in full; the Pitfall-7 finding (`~/.mindrian-last-version` written only on the cold-start branch) is from reading `:419`'s enclosing `else` block.
- `data/deployment-surfaces.json` schema + static-vs-generated: **HIGH** — `command-registry.json` + `build-command-registry.cjs` read in full; the "static, not generated" justification is sound (nothing to drift against).
- Test fixtures: **HIGH** — `tests/test-doctor-class-g.cjs` + `tests/test-doctor-atomic-swap.cjs` patterns read; `MINDRIAN_PLUGIN_HOME` override confirmed in `doctor.cjs:40`; `run-feynman-tests.cjs` `TEST_FILES[]` registration confirmed.
- `@mindrian_os/cli` sweep surface: **HIGH** — `grep -rn "@mindrian_os/cli"` + `grep -rln "@mindrian/os"` run across the repo; the full file list is in Finding 9 / HARNESS-123-14.
- Plan-7 Brain-key field report: **HIGH** — `brain-client.cjs` `getApiKey()`/`checkFilePermissions()` read line-by-line (the resolution order is env → CWD .env → ~/.mindrian.env, the *reverse* of D-31's order — flagged); `skills/brain-connector/SKILL.md` Detection section confirmed to have no HTTP-path branch; `scripts/session-start`'s Brain WARN block read in full (~L1290–1313, slightly different line numbers than CONTEXT's "~L1259–1284" — the block is the `if [ -n "${MINDRIAN_BRAIN_KEY:-}" ]` one near the bottom); `commands/setup.md` confirmed to NOT `chmod 600`; `install.sh` confirmed to have NO `~/.mindrian.env` write at all (the Brain key is a printed hint per `bin/cli.js`); `.env.brain.template` confirmed entirely MCP/Supabase/Neo4j/Pinecone-centric. Live: `MINDRIAN_BRAIN_KEY` IS in the shell env on this box (`544fd7d0-...`) AND in `~/.mindrian.env` — CONTEXT says it's not in the env on a "standard install"; on a fresh user box that's true, on this dev box it's set, and the resolver's order handles both.

**Research date:** 2026-05-12
**Valid until:** ~2026-06-11 (30 days — stable domain; the only fast-moving surface is the Claude Code plugin spec, which is documented and unlikely to change the `plugin.json`-version-wins precedence).
