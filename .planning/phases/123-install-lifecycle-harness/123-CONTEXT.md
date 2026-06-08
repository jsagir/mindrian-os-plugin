# Phase 123: install-lifecycle-harness - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning
**Source:** Interactive discuss-phase
**canon_parts:** [5, 6]

<domain>
## Phase Boundary

One authoritative install-state contract so no actor improvises "what version is active, where is it installed, is the install consistent." The 2026-05-12 Windows live test of `v1.13.0-beta.12` surfaced a *family* of install/update bugs that were all one bug wearing different coats: every consumer (doctor, statusline, the SessionStart hook, `bin/cli.js`, the plugin-bin `$PATH` entry) re-derives the install state with its own ad-hoc heuristic, and each heuristic is wrong in a different way. Phase 123 ships the contract: **one record** is the truth; **one manifest** says what should be on disk; **one command (`doctor`)** enforces the contract on every session and every release; **`release.sh`** is the only thing that touches a version.

Five pieces (per `docs/INSTALL-LIFECYCLE-HARNESS.md`):

1. One install-state record — `~/.mindrian/install-state.json`, written by `session-start`, read by everyone.
2. A deployment-surface manifest — `data/deployment-surfaces.json`, walked by `session-start` (reconcile) and `doctor` (flag).
3. `doctor` drift-class enumeration + `--fix`s + test fixtures — incl. **Bug 7** (marketplace-cache-only = healthy topology, not drift).
4. `mindrian-os doctor --acceptance` — the release gate as a command; `release.sh` runs it.
5. `release.sh` owns ALL version bumps incl. pre-releases (`beta.N → beta.N+1`), refuses on a dirty repo, pushes only the release commit, fixes Step 9.5's stale `@mindrian_os/cli` name.

Plus the cleanup the disease dragged in: cache pruning on update; the `@mindrian_os/cli` → `@mindrian_os/install` doc/test sweep (`docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh`).

Plus an **absorbed sibling (Plan-7)** — a Brain-key resolver. A 2026-05-12 Windows field report surfaced that the Brain key (in `~/.mindrian.env`) is *valid and live* (`mindrian-brain.onrender.com` answers, `Authorization: Bearer <key>`, `brain-client.cjs` already correct) but **invisible to detection**: `session-start`'s WARN checks only the shell env var, the `brain-connector` skill has no detection branch for the HTTP client at all, so a model on a standard install silently drops to Tier 0 with a working Brain right there. That is the *same disease* — N consumers, N ad-hoc heuristics, no single resolver — applied to the Brain key. Phase 123 absorbs the resolver-shaped fix (`lib/core/resolve-brain-key.cjs`, mirroring `active-plugin-root.cjs`) + the 3 consumer rewirings + the SEC-02 `chmod 600` + the auth/docstring doc fixes. It does NOT decide MCP-path-vs-HTTP-path canonicalness (field-report items #2/#6) — that's a product-direction call, deferred. See §8 of decisions.

**Already laid (do not re-do):** `lib/core/active-plugin-root.cjs` (the one resolver — `MINDRIAN_OS_ROOT` → `installed_plugins.json` → newest pre-release-tolerant marketplace-cache dir → legacy → not-found; `bin/cli.js` + `scripts/statusline-mos` delegate to it); `scripts/statusline-mos-dispatch` + `scripts/session-start` Step A migration (the dumb dispatcher shim — marker `MINDRIAN-STATUSLINE-DISPATCH`); `scripts/statusline-mos` pre-release-tolerant regex fallback. All shipped/committed in/for `v1.13.0-beta.12`/beta.13.

**Out of scope (deferred):** see `<deferred>`.

</domain>

<decisions>
## Implementation Decisions

### 1. Install-state record (`~/.mindrian/install-state.json`)

- **D-01:** **Hard-consumer contract.** Every consumer (statusline, `~/.mindrian-last-version` reader, `bin/cli.js`, doctor) treats a missing record as a *known-bad, explicitly-surfaced* state — never a silent guess, never a crash. The surfaced message is actionable: "install-state not initialized — run `mindrian-os doctor --fix`". Consumers do NOT fall back to running the resolver themselves on a missing record (the resolver `active-plugin-root.cjs` is what `session-start` uses to *write* the record; consumers read the record).
- **D-02:** **Carve-out for `doctor`.** `doctor` cannot hard-error on a missing record — diagnosing a broken install *is* its job. For `doctor`, "record absent" is a drift *finding* (in class I, see D-12) with a `--fix` that runs `session-start`'s record-write path.
- **D-03:** **`session-start` writes the record in its earliest steps** — right after the workspace guard / resolver, before anything downstream (statusline render, `~/.mindrian-last-version` consumers) reads it. The `~/.mindrian-last-version` write folds into this same step so there is no window where one is fresh and the other is stale. **Single writer:** `scripts/session-start` owns the record AND `~/.mindrian-last-version`; no other SessionStart hook writes either (if any does today, consolidate into `session-start`).
- **D-04:** **The record is a full snapshot.** Fields: `active_version`, `active_root`, `topology` (`marketplace-cache | dev-clone | legacy | not-found`), `resolved_at`, `surfaces[]` (`{ id, path, check_kind, expected, observed, ok }`), **plus** the version-of-record cross-check values seen at write time: `installed_plugins_version`, `statusline_renders_version`, `last_version_file_value`, `path_bin_version`.
- **D-05:** **doctor reads the snapshot AND does one live spot-check** of `active_version` vs `installed_plugins.json`. If they diverge → report "record stale — re-run `session-start`" (NOT "install drift"). Cheap insurance against a mid-session `claude plugin update`.

### 2. Deployment-surface manifest (`data/deployment-surfaces.json`)

- **D-06:** **`data/deployment-surfaces.json` is the single source of truth.** `session-start` walks it to reconcile owned surfaces; `doctor` walks it to flag. New surface = one JSON entry, no code change. Mirrors the `data/command-registry.json` pattern from Phase 122.
- **D-07:** **Manifest entry schema (Claude's discretion on exact field names, but cover):** `id`; `path` (stored with a literal `$HOME` token, expanded at read time via `os.homedir()` — never an absolute path, for cross-platform safety); `owner` (`session-start` | `claude-code`); `topology_scope` (`all` | `dev-clone`); `check_kind` (`marker` | `exact-value` | `observed-only`); `expected` (the marker substring, or the exact canonical value; `null` for `observed-only`); `reconcile` (`on-version-change` | `never`); `remediation` (string shown when it can't be auto-fixed).
- **D-08:** **Owned (stamped) vs observed-only.** Owned by `session-start`: the `statusline-mos` dispatch shim (`~/.claude/statusline-mos`, marker `MINDRIAN-STATUSLINE-DISPATCH`), the `settings.json` `statusLine.command` line (`exact-value` == `bash "$HOME/.claude/statusline-mos"`), `~/.mindrian/install-state.json` (self — excluded from its own check), `~/.mindrian-last-version` (`exact-value` == `active_version`), and the dev-clone pre-commit hook (`topology_scope: dev-clone` only — the ROOM.md/MINTO.md guard; `session-start` in a dev clone idempotently installs/updates it, reusing the `scripts/install-pre-commit.sh` Phase-108 logic; on a user box it is not a surface and doctor skips it). Observed-only: the plugin-bin `$PATH` entry (`.../mos/<active>/bin`) — Claude Code's plugin loader owns it; doctor records it for the consistency cross-check but it is never written; a wrong value is a "restart Claude Code / reinstall the plugin" finding.
- **D-09:** **Check kind = marker vs exact-value.** Script/hook surfaces that carry a fixed sentinel but resolve at runtime (the dispatch shim, the pre-commit guard) are `marker` (presence-of-sentinel) — a plugin-side wrapper fix changes their bytes and the marker tolerates it. The two surfaces that ARE a single canonical value (`~/.mindrian-last-version`, the `settings.json` `statusLine.command` line) are `exact-value` — the "expected" string IS that value, so the check is presence-of-exact-string, not a content hash. No surface gets a frozen content SHA (rejected — every wrapper fix would force a manifest hash bump in the same commit or doctor false-positives on the fix that's rolling out).
- **D-10:** **Reconcile timing.** `session-start` reconciles owned surfaces **only on version change** (`active_version != ~/.mindrian-last-version`; an absent `~/.mindrian-last-version` counts as a change, so a fresh install gets stamped on first session). `doctor --fix` and `doctor --acceptance` do a **full, unconditional** manifest walk + reconcile — so mid-version corruption (a hand-edited `settings.json`, an antivirus quarantine of the shim) has an explicit recovery path.

### 3. doctor drift classes + `--fix` scope

- **D-11:** **Bug 7's fix lives in the existing legacy-clone check.** "No legacy clone dir on a marketplace-only box" is *expected*, not a finding. Topology is one of `{ marketplace-cache, dev-clone, legacy, not-found }` — each is a *valid* topology; only `not-found`, or a mismatch between the declared and the actual topology, is drift.
- **D-12:** **Two new drift classes** (added to the existing A–H roster; `--all` activates them too):
  - **Class I — install-state + topology + version-of-record consistency.** (NOT H — an existing class H is taken by `checkInstallIncomplete` at L1119-1296 of `scripts/doctor.cjs`.) Checks: record present + internally consistent (snapshot matches a live spot-check, per D-05); topology classification (per D-11); the version-of-record equality across `installed_plugins.json` ↔ record `active_version` ↔ statusline-renders ↔ SessionStart-banner ↔ `~/.mindrian-last-version` ↔ plugin-bin `$PATH` entry.
  - **Class J — deployment-surface manifest reconciliation.** Every owned surface in `data/deployment-surfaces.json` has its marker/value OK.
  - Each class has a name, a check, a `--fix` (where applicable, per D-13), and a per-class test fixture.
- **D-13:** **`--fix` recovers everything it safely can — including legacy-clone migration and `installed_plugins.json` repair — under hard preconditions:**
  - **`legacy` vs `dev-clone` must be distinguished; `dev-clone` is untouchable.** `legacy` = the obsolete `~/.claude/plugins/mindrian-os/` install-cache clone. `dev-clone` = a git clone with an `origin` remote pointing at GitHub (e.g. `~/MindrianOS-Plugin` itself). `--fix` NEVER migrates, removes, or rewrites a `dev-clone`. Migration applies to `legacy` only.
  - **Legacy migration is backup-then-verify-then-remove:** tar the legacy dir to `~/.mindrian/backups/`, confirm the marketplace-cache install resolves and is healthy, *then* remove the legacy dir. Never delete the active root. Refuse if the legacy dir has uncommitted changes or unpushed commits.
  - **`installed_plugins.json` repair is conservative + backed up:** only when demonstrably stale (points at a version dir that no longer exists, or is missing the `mos` entry while a valid marketplace-cache dir is present); prefer "repoint the entry at the newest valid marketplace-cache dir" over a wholesale rewrite; back up first; note that Claude Code needs a restart to re-read it.
  - **Generally:** every `--fix` op is backup-before-mutate (the existing class-A backup-then-replace pattern), idempotent, and never touches the active root.
  - **Auto-recovers without preconditions:** missing install-state record (runs `session-start`'s record-write path); drifted owned-surface markers/values (rewrites the surface); `~/.mindrian-last-version` mismatch (rewrites to match `installed_plugins.json`).
  - **Still flag-only even with aggressive `--fix`** (nothing safe to do): `topology == not-found` → "reinstall the plugin"; plugin-bin `$PATH` entry pointing at a vanished dir → "restart Claude Code"; `statusline-renders-wrong-version` → re-stamping the symptom would mask a resolver bug, so flag it + "likely an `active-plugin-root.cjs` bug, file it."

### 4. `mindrian-os doctor --acceptance` (the release gate as a command)

- **D-14:** **The 5-point contract `--acceptance` asserts:** (1) install-state record present + snapshot matches a live spot-check; (2) every owned deployment surface reconciled; (3) version-of-record consistent across `plugin.json` / `package.json` / CHANGELOG top entry / git tag exists / marketplace `source.ref` / published npm version (`npm view @mindrian_os/install@<ver> version`); (4) `npx @mindrian_os/install` round-trip actually installs (Claude's discretion: install into a `mktemp -d` throwaway dir, assert the resulting `mos/<version>/` tree + `bin/cli.js` resolves, then remove the temp dir — never touch the live install); (5) `doctor --all` exits 0.
- **D-15:** **`--acceptance` wraps the existing harnesses** — it CALLS `scripts/verify-release` (and reconciles with `scripts/release-beta-smoke.sh` and `tests/test-release-npm-gate.sh`) as checks rather than duplicating them. The doc/test sweep in piece 5 keeps these in sync with the `@mindrian_os/install` rename.
- **D-16:** **Two sub-modes:** `mindrian-os doctor --acceptance --pre-tag` runs the half that's true before the release happens — (1), (2), the repo-file half of (3) (`plugin.json`/`package.json`/CHANGELOG consistency), (5) — and `release.sh` runs it BEFORE it tags. Full `mindrian-os doctor --acceptance` runs everything (incl. git tag exists + marketplace `source.ref` + npm published + `npx` round-trip) and `release.sh` runs it AFTER the push. **Both are hard aborts** — release infra is the one gate you cannot skip; no `--allow` override.
- **D-17:** **The orchestration is shell-agnostic (lives in `bin/cli.js` / `scripts/doctor.cjs`, node).** The disease surfaced *because of* Windows path/shell assumptions; `--acceptance` (the thing the external operator, currently Lawrence, runs on a real box) is `mindrian-os doctor --acceptance` via node — it may shell out to `git` (cross-platform) but not to bash-isms. Bash helpers (`scripts/verify-release`, `scripts/release.sh`) are only invoked on the maintainer's box during a release, not as part of a user-facing `--acceptance` run. **"Release infra ships as a beta validated by Lawrence" now means "Lawrence ran `mindrian-os doctor --acceptance`, all green."**

### 5. `release.sh` owns ALL version bumps + dirty-repo guard + Step 9.5 rename

- **D-18:** **Pre-release bump algebra via the npm `semver` package** (added as a **`devDependency`** — `release.sh` is dev tooling, never shipped; it stays out of the `package.json` `files` allowlist so the published `@mindrian_os/install` tarball keeps zero runtime deps). `release.sh` checks `node_modules/semver` exists (or runs `npm install`) before using it. Semantics via `semver.inc()` from a node one-liner: `--prerelease` → `semver.inc(v, 'prerelease', 'beta')` (`1.13.0-beta.11` → `1.13.0-beta.12`); `patch`/`minor`/`major` → `semver.inc(v, 'patch'|'minor'|'major')` (finalizes: `1.13.0-beta.11` → `1.13.1` / `1.14.0` / `2.0.0`); a `--start-prerelease <core> <channel>` form opens a fresh series (`1.13.0` → `1.14.0-beta.1`). This replaces the `IFS='.' read -r MAJOR MINOR PATCH` on `scripts/release.sh:40` that mangles pre-release versions (`PATCH=0-beta`) and is why beta.10/11/12/13 were hand-rolled.
- **D-19:** **One-commit next-bump.** The release commit finalizes `CHANGELOG [vN] - date`, the `vN` tag points at that commit, AND that commit already carries `plugin.json`/`package.json` == `vN+1` (next pre-release) + the CHANGELOG `[Unreleased] -- vN+1 (in progress)` heading reset. `plugin.json` is always "the next version to ship"; after `release.sh` runs, HEAD says `vN+1` and the registry has `vN` — they never match, so "repo says beta.11, registry already has beta.11" is structurally impossible.
  - **OPEN — researcher must resolve before the planner locks D-19:** the `vN` git tag will point at a commit whose `plugin.json` says `vN+1`, while `marketplace.json` `version` + `source.ref` say `vN`. Verify whether Claude Code's plugin loader reads the *installed* version from `plugin.json` (in which case installing `ref: vN` would self-report `vN+1` — a real problem — and the **two-commit form** is required: commit A finalizes+tags `vN` with `plugin.json == vN`, commit B bumps to `vN+1`, `main` HEAD on B) or from `marketplace.json` (one-commit form is fine). If `plugin.json`, the planner flips D-19 to the two-commit form.

    **Resolved 2026-05-12 by 123-RESEARCH.md § finding 1 (verified against Claude Code's Version Management spec — plugin.json wins over marketplace entry). The TWO-COMMIT form is locked. Implementing requirement: HARNESS-123-02 (Plan 123-01).**
- **D-20:** **Dirty-repo / ahead-of-origin guard.** Before pushing: snapshot `git log origin/main..HEAD --oneline`, print it. If the only commit ahead is the release commit `release.sh` just made → push. If `>1` → abort: "N unpushed commits that aren't this release; push/stash them or pass `--allow-ahead`." No author heuristics (a human and an agent on the same box share `git config user.*`). Block on dirty *tracked* files except the ones `release.sh` itself bumped (`plugin.json`, `package.json`, `CHANGELOG.md`, the marketplace's `marketplace.json`); untracked files are OK. This kills the Phase-109-docs-hitchhike (a Phase 109 docs commit rode into the beta.12 push).
- **D-21:** **Fix Step 9.5's stale package name** — `scripts/release.sh` Step 9.5 still names `@mindrian_os/cli`; the package is `@mindrian_os/install` now. Update the publish, the dist-tag logic (`-beta./alpha./rc./next.` → `@next`; clean `X.Y.Z` → `@latest`), the `npm pack --dry-run` payload-allowlist gate, and the recovery instructions.

### 6. Cleanup absorbed by this phase

- **D-22:** **Cache pruning on update.** `~/.claude/plugins/cache/<marketplace>/mos/<version>/` accumulates a dir per version (confirmed live on the Windows box: `1.12.0/` + `1.13.0-beta.9/` orphaned alongside `1.13.0-beta.12/`). Prune keyed off `installed_plugins.json`: keep the active version + the N most recent (Claude's discretion: N = 2, so 3 dirs total) — **never delete the active one**; skip pruning entirely if `installed_plugins.json` can't be read (don't guess). Runs in `session-start` (on version change) AND `doctor --fix` (unconditional). Touches only `mos/<version>/` dirs under that cache path that are neither the active dir nor in the keep-set.
- **D-23:** **`@mindrian_os/cli` → `@mindrian_os/install` doc/test sweep:** `docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh` — and any other `@mindrian_os/cli` reference (the old package is deprecated; `@mindrian_os/cli@1.13.0-beta.10` too).

### 7. Brain key resolution (absorbed into Phase 123 as Plan-7)

Surfaced by a 2026-05-12 Windows field report (7 items). Same disease shape as the rest of this phase: the component that *reads* the Brain key reads from a narrower location than the component that *writes* it; there is no single resolver. The fix mirrors `lib/core/active-plugin-root.cjs` one level over. Evidence base: a live probe confirmed `MINDRIAN_BRAIN_KEY` (36 chars, in `~/.mindrian.env`) is **valid and accepted** — `mindrian-brain.onrender.com` answers HTTP 200, MCP handshake OK (`serverInfo {name:"mindrian-brain", version:"1.0.0"}`), auth is `Authorization: Bearer <key>`, and `lib/core/brain-client.cjs` already sends exactly that (L195/L255). So the HTTP path works end-to-end; only *detection* and *canonical-path documentation* are broken.

- **D-31:** **`lib/core/resolve-brain-key.cjs` — THE single Brain-key resolver**, mirroring `lib/core/active-plugin-root.cjs`. Resolution order: `MINDRIAN_BRAIN_KEY` env var → `~/.mindrian.env` (the `MINDRIAN_BRAIN_KEY=` line) → CWD `.env` → not-found. Returns `{ key, source, available, reason }`. Also exposes the **SEC-02 permission check** (POSIX-only; a no-op on Windows): a key file with a group/world bit (`mode & 0o077 !== 0`) yields `available: false` **with an explicit `reason` string** ("permissions too open: `~/.mindrian.env` is mode 0644, must be 0600") — never a silent `null` + bare stderr.
- **D-32:** **Rewire all three consumers to call `resolve-brain-key.cjs`:** (a) `lib/core/brain-client.cjs::getApiKey()` delegates to it (and its stale docstring ~L117 is fixed — it currently says "checks env then CWD .env" but actually also reads `~/.mindrian.env` at L136–145); (b) `scripts/session-start`'s Brain-key check (~L1259–1284) resolves the key the same way instead of testing only the shell env var; (c) `skills/brain-connector/SKILL.md` gains a new detection branch — "**step 0:** if `lib/core/resolve-brain-key.cjs` resolves a key (`available: true`), the Brain is active via the **HTTP path** — call into `brain-client.cjs`'s `query()/search()/schema()/ask()`, NOT an MCP tool" — and its "Tool Names" table gains a CLI row for the HTTP-client surface.
- **D-33:** **Replace `session-start`'s MCP-centric WARN with a positive status line.** Today: "WARN: MINDRIAN_BRAIN_KEY is set but no 'mindrian-brain' MCP server resolved" — which never fires on a standard install (key's in `~/.mindrian.env`, env var empty, block skipped) AND would cry wolf on every HTTP-path install (the HTTP client makes "no mindrian-brain MCP" a non-error). New: `Brain: HTTP client active (mindrian-brain.onrender.com)` when the key resolves; `Brain: not configured (Tier 0)` when it doesn't. A real WARN only fires when the key resolves AND neither an MCP server nor `brain-client.cjs` can reach the Brain (genuine misconfiguration), and the SEC-02 "permissions too open" rejection (D-31) routes through this same status channel, not bare stderr.
- **D-34:** **SEC-02 `chmod 600 ~/.mindrian.env` on write** — `install.sh` and `/mos:setup brain` (`commands/setup.md`) must `chmod 600` the key file when they write it (POSIX only; no-op on Windows). Research item: confirm whether `commands/setup.md` already does this.
- **D-35:** **Doc/auth fixes:** `docs/install/BRAIN-SETUP.md` and `.env.brain.template` state explicitly that the server is `Authorization: Bearer <key>` only (NOT `x-api-key` — a raw `x-api-key` request gets a 401 whose body points at `https://mindrian-os.com/brain-access`); the no-key fallback message surfaces that `brain-access` request-access URL; the CHANGELOG prose about the client "calling `brain.mindrian.ai`" is softened/annotated ("currently `*.onrender.com`, moving to `brain.mindrian.ai`"; or add the `MINDRIAN_BRAIN_URL` override note); the `getApiKey()` docstring fix from D-32(a).
- **D-36:** **OUT OF SCOPE — explicitly deferred** (field-report items #2-partial + #6): picking a *canonical* interaction model (the bundled `mcp-server-brain/` MCP path vs the wired `brain-client.cjs` HTTP path) and the full doc alignment across `.env.brain.template` / `BRAIN-SETUP.md` / `brain-connector/SKILL.md` / `commands/setup.md` declaring one "the" path. That's a product-direction decision, not a resolver. Plan-7 makes the HTTP path *detectable and documented as present*; it does not declare it the supported path or retire the MCP path. → see `<deferred>`.

### 8. Plan ordering (carried forward from the spec + the absorbed Plan-7; the planner may refine within)

- **D-24:** **Plan-1: `release.sh` pre-release support + dirty-repo guard + Step 9.5 rename + `semver` devDep** — FIRST, so `v1.13.0-beta.13` onward cuts via `release.sh`, not by hand. (Hard prerequisite for shipping anything — including the still-pending Phase 109 release commit, which is "the remaining step" per the Phase 109 ledger note in ROADMAP.md.)
- **D-25:** **Plan-2: install-state record + `data/deployment-surfaces.json` manifest** — `session-start` writes the record early + reconciles owned surfaces on version change.
- **D-26:** **Plan-3: doctor classes I + J + Bug-7 fix in the legacy-clone check + aggressive `--fix` with the D-13 guardrails + per-class test fixtures.**
- **D-27:** **Plan-4: `mindrian-os doctor --acceptance` (5-point, two sub-modes) + wire both into `release.sh` as hard gates.**
- **D-28:** **Plan-5: cache pruning + the `@mindrian_os/cli` → `@mindrian_os/install` doc/test sweep.**
- **D-37:** **Plan-7: Brain key resolution (absorbed)** — `lib/core/resolve-brain-key.cjs` + the 3 consumer rewirings + the WARN→status-line swap + the SEC-02 `chmod 600` + the auth/docstring doc fixes (D-31..D-35). **Sequencing:** depends on Plan-2 (both modify `scripts/session-start` — the planner may merge Plan-7's `session-start` edits into Plan-2's wave or sequence them after); lands **before** Plan-6 so `v1.13.0-beta.13` carries the Brain detection fix. Part-8: the resolver + the status line are purely LOCAL, zero network (it only *checks for* a key; the actual Brain call is `brain-client.cjs`'s job and unchanged).
- **D-29:** **Plan-6: cut `v1.13.0-beta.13` via the fixed `release.sh` (carrying Plans 1–5 + 7); validate with `mindrian-os doctor --acceptance` on a real Windows box before promotion to a clean `1.13.0`.**

### REQ-IDs

- **D-30:** Requirements register as `HARNESS-123-01..NN` in `.planning/REQUIREMENTS.md` (assigned by the gsd-planner at `/gsd:plan-phase 123`; the ROADMAP Phase 123 entry's `Requirements:` line — currently "TBD" — is updated to match once the plans land). Expect roughly: 4 for Plan-1 (`release.sh` pre-release algebra / one-commit next-bump / dirty-repo guard / Step-9.5 rename), 2 for Plan-2 (install-state record / deployment-surface manifest), 3 for Plan-3 (class I / class J + Bug 7 / aggressive `--fix` + fixtures), 1 for Plan-4 (`--acceptance` + `release.sh` wiring), 2 for Plan-5 (cache prune / `@mindrian_os/cli` sweep), 2–3 for Plan-7 (`resolve-brain-key.cjs` / the 3 rewirings + WARN swap / SEC-02 `chmod 600` + doc fixes), 1 for Plan-6 (beta.13 cut + Windows `--acceptance` validation). Final count + mapping is the planner's call.

### Claude's Discretion

- Exact field names in `data/deployment-surfaces.json` (cover the D-07 set).
- `npx` round-trip mechanics inside `--acceptance` (D-14 suggests `mktemp -d`; planner/researcher may choose a cleaner sandbox).
- Cache-pruning retention count N (D-22 suggests 2).
- Whether class I and class J get their own CLI flags (mirroring `--cascade-rooms`, `--ui-compliance`, etc.) or share one — follow the existing `doctor.cjs` flag pattern.
- Internal structure of `--acceptance` (one big function vs a checklist runner) and exactly which of `scripts/verify-release` / `scripts/release-beta-smoke.sh` / `tests/test-release-npm-gate.sh` it wraps vs supersedes.

</decisions>

<specifics>
## Specific Ideas

- **The contract, one line (from the spec):** "Nothing improvises the install state. One record is the truth; one manifest says what should be on disk; one command (`doctor`) enforces the contract on every session and every release; `release.sh` is the only thing that touches a version."
- **The dispatcher principle, generalized:** the deployed file carries *zero logic* — it resolves at runtime — so a wrapper fix in vN+1 reaches the deployment surface on the next session with no re-stamp. `scripts/statusline-mos-dispatch` (already shipped) is the worked example; the manifest's `marker` check kind exists to support this pattern.
- **Same shape as Canon Part 9:** a closed set of allowed mutations + a single enforcement chokepoint + human/CI confirmation as the only path to "trusted" — applied one level down, to the install state instead of room memory. Canon Part 6 (dog-fooding) biting back: the plugin's own install lifecycle must honor the plugin's own canon; Canon Part 5's evidence-graded gate at the release boundary.
- **Live confirmation (Windows session, 2026-05-12):** `~/.mindrian-last-version` reads `"unknown"` on the Windows box and `1.13.0-beta.11` (stale) on the Linux dev box — two different failure modes of the same disease. Two orphaned cache dirs (`1.12.0/`, `1.13.0-beta.9/`) confirmed under `.../mos/`. The Windows cold-install acceptance gate is still waived; promotion to clean `1.13.0` waits on a Windows tester run of `--acceptance`.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase spec (read this first)
- `docs/INSTALL-LIFECYCLE-HARNESS.md` — the disease table, the one-line contract, the five pieces (with per-piece status), what this absorbs (the loose-thread queue), what's already laid (do not re-do), and the proposed plan order. THIS IS THE PRIMARY SPEC.

### Canon (this phase declares canon_parts: [5, 6])
- `docs/MINDRIAN-CANON.md` §Part 5 (Evidence Is Graded By Context — the evidence-graded gate at the release boundary), §Part 6 (Product-as-Venture / dog-fooding mandate — the plugin must honor its own canon), §Part 9 (Memory Locality and Interpretation — the *shape* this phase mirrors: closed mutation set + single chokepoint + human/CI confirmation).
- `docs/CANON-PHASE-MAP.md` §Part 6 — Phase 123 must be added here when it ships (Part 6 row, "dog-fooding the install lifecycle"); §Part 7 row for reuse justification.

### Release process (the rules release.sh must honor)
- `.claude/includes/release-process.md` — the Workspace Rule (canonical dev workspace is `~/MindrianOS-Plugin`; `release.sh` never commits from a plugin cache), the Version Consistency Rule (5 things in sync: CHANGELOG / plugin.json / package.json / git tag / marketplace `source.ref` pinned to the tag), "Marketplace Source Must Be Pinned", the two-command manual upgrade path, "Release infrastructure ALWAYS ships as a beta first."
- `CLAUDE.md` §"Release Process (MANDATORY)" + §"WORKSPACE GUARD" — the same rules at repo level; the 2026-04-13 wrong-workspace incident reference.
- `docs/install/PACKAGING-PATHS.md` — current packaging paths (needs the `@mindrian_os/cli` → `@mindrian_os/install` sweep, D-23).

### Code already shipped that this builds on (do not re-do)
- `lib/core/active-plugin-root.cjs` — the one plugin-root resolver. The record's `active_version`/`active_root`/`topology` come from here.
- `scripts/statusline-mos-dispatch` — the dumb dispatcher shim (marker `MINDRIAN-STATUSLINE-DISPATCH`); the worked example of the "deployed file carries zero logic" principle.
- `scripts/statusline-mos` — pre-release-tolerant regex fallback; resolves via the canonical module.
- `bin/cli.js` — `mindrian-os <install|doctor|update>`; delegates to `active-plugin-root.cjs`; `--acceptance` routes through the `doctor` subcommand.
- `scripts/session-start` — 1328 lines; already has the Step A dispatcher migration + a workspace guard + hooks block (where the dev-clone pre-commit hook gets installed). The record write + manifest reconcile land here.

### Code this phase modifies / extends
- `scripts/release.sh` — 262 lines; line 40 `IFS='.' read -r MAJOR MINOR PATCH` is the bug; Step 9.5 names the stale `@mindrian_os/cli`.
- `scripts/doctor.cjs` — 72651 bytes; drift classes A–G today, per-class `--fix`, flags `--fix`/`--json`/`--all`/`--cascade-rooms`/`--verify-surface`/`--room-md`/`--ui-compliance`/`--statusline-visibility`/`--simulate-write=`/`--scan-commands=`/`--scan-scripts=`. Add classes I + J + `--acceptance` (+ `--pre-tag`).
- `scripts/verify-release` (12832 bytes) — the broader pre-release verification `release.sh` already calls; `--acceptance` wraps it.
- `scripts/release-beta-smoke.sh` (6300 bytes) — the beta smoke harness; reconcile with `--acceptance`.
- `tests/test-release-npm-gate.sh`, `tests/manual/95.6-windows-cold-install-acceptance.md` — the npm-payload gate test + the Windows cold-install acceptance doc; sweep + reconcile.
- `lib/memory/run-feynman-tests.cjs` — the Feynman test runner the registry-drift tripwire hooks into; new test fixtures (per-doctor-class) may register here.
- `data/command-registry.json` (Phase 122) — the pattern `data/deployment-surfaces.json` mirrors.
- `scripts/install-pre-commit.sh` (Phase 108) — the dev-clone pre-commit-hook installer logic `session-start` reuses (D-08).

### Prior phase context (the install-cache failure family — Phase 123 is the next entry)
- `.planning/phases/95.1-mos-doctor-drift-detection-and-self-heal/95.1-CONTEXT.md` — the drift-class roster A–F; the `--fix` pattern; the UI-compliance discipline for `/mos:doctor` output.
- `.planning/phases/95.2-install-cache-atomic-recovery-sessionstart-preflight/95.2-CONTEXT.md` + `95.2-DOGFOOD-VERIFICATION.md` — extending `doctor.cjs` without forking; SessionStart preflight reusing the Phase-106-05 hook template; Part-8 "purely LOCAL, zero network" discipline for install-state checks.
- `.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-CONTEXT.md` + `95.6-FAMILY-AUDIT.md` + `95.6-PACKAGING-RESEARCH.md` — the Windows install failure family; the npm-installer overhaul; the reserved-marketplace-name compliance check (`release.sh` Step 5b).
- `.planning/phases/106-statusline-visibility-context-window-broadcast/106-CONTEXT.md` — the statusline surface this phase's class I cross-checks against.
- `.planning/phases/122-workflow-layer/122-CONTEXT.md` — the `data/*-registry.json` generated-data-file pattern.

### Brain key resolution (Plan-7 — absorbed 2026-05-12; the field report)
- `lib/core/brain-client.cjs` — the HTTP client every command/skill `require()`s. `getApiKey()` ~L117 (stale docstring) reads `MINDRIAN_BRAIN_KEY` env → `~/.mindrian.env` (L136–145) → CWD `.env`; `Authorization: Bearer <key>` at L195 + L255; `checkFilePermissions()` is the SEC-02 group/world-bit reject (no-op on Windows). The consumer that already does it right — `resolve-brain-key.cjs` factors this out.
- `skills/brain-connector/SKILL.md` — the detection-order skill. Today: (1) `MINDRIAN_BRAIN_KEY` env var, (2) `mcp__mindrian-brain__brain_schema` tool, (3) `mcp__neo4j-brain__get_neo4j_schema` legacy, (4) silent fallback — NO branch for the HTTP client. Needs step 0 (HTTP path via `resolve-brain-key.cjs` + `brain-client.cjs`) + a CLI row in the "Tool Names" table.
- `scripts/session-start` ~L1259–1284 — the narrow MCP-centric Brain-key WARN that never fires on a standard install and would cry wolf on every HTTP-path install. Replaced by the positive status line (D-33).
- `docs/install/BRAIN-SETUP.md`, `.env.brain.template`, `commands/setup.md`, `install.sh` — the doc/setup surfaces: make Bearer-only explicit (D-35), `chmod 600 ~/.mindrian.env` on write (D-34), surface the `https://mindrian-os.com/brain-access` request-access URL.
- `lib/core/active-plugin-root.cjs` — the resolver pattern `lib/core/resolve-brain-key.cjs` mirrors (`{value, source, available}` shape, ordered fallback chain, no silent unknown).
- Brain connectivity probe (2026-05-12): `MINDRIAN_BRAIN_KEY` (36 chars, `~/.mindrian.env`) valid + live — `mindrian-brain.onrender.com` HTTP 200, MCP handshake `serverInfo {name:"mindrian-brain", version:"1.0.0"}`, `Authorization: Bearer` auth; `brain-client.cjs` already correct. The HTTP path works end-to-end; only detection + canonical-path docs are broken. (Field-report items #2/#6 — pick a canonical MCP-vs-HTTP path + full doc alignment — stay deferred per D-36.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/active-plugin-root.cjs` — THE resolver; the record is just "what the resolver returned, snapshotted." Don't add a second resolver.
- `data/command-registry.json` + the `data/` dir convention (Phase 122) — `data/deployment-surfaces.json` follows the same pattern (a checked-in data file both `session-start` and `doctor` read).
- The class-A `--fix` "backup-then-replace" pattern in `scripts/doctor.cjs` — the template for every `--fix` op in classes I/J (backup-before-mutate, never delete the active root).
- `scripts/install-pre-commit.sh` (Phase 108) — the dev-clone pre-commit-hook install logic `session-start` already calls; the manifest's `dev-clone`-scoped pre-commit surface reuses it.
- `scripts/verify-release` — `release.sh` already calls it; `--acceptance` wraps rather than replaces.
- The Phase-106-05 SessionStart-hook template (`check-onboard-statusline.cjs` family) — the pattern the record-write step follows; but `scripts/session-start` (the shell script) is the *single writer* of the record + `~/.mindrian-last-version`, not the JS hooks.

### Established Patterns
- "Release infrastructure ALWAYS ships as a beta first, validated by an external operator" — `--acceptance` operationalizes this (was: "Lawrence eyeballed the statusline"; now: "Lawrence ran `mindrian-os doctor --acceptance`, all green").
- "Never bump versions by hand — run `scripts/release.sh`" — currently violated *because* `release.sh` can't handle pre-releases; D-18 closes the gap.
- Part 8: install-state checks are purely LOCAL, zero network surface (like the Phase 95.2 SessionStart preflight — `grep -E "fetch|http|curl|brain.mindrian|tavily"` returns 0). The ONE network touch in this phase is `--acceptance`'s `npm view @mindrian_os/install@<ver>` + `npx @mindrian_os/install` round-trip — and that runs only during a release, never in a user session.
- Tri-polar (CLI / Desktop / Cowork): the deployment surfaces (statusline shim, `settings.json` statusLine, pre-commit hook, `~/.mindrian-*`) are CLI-only artifacts; Desktop/Cowork are MCP-only and deploy none of them. The install-state record + `doctor` are still meaningful on all three (Desktop/Cowork installs still have an `active_version`/`active_root`), but the manifest's owned-surface set is empty there.

### Integration Points
- `scripts/session-start` early steps — record write + `~/.mindrian-last-version` write (single writer, before any reader) + manifest reconcile (on version change) + cache prune (on version change).
- `scripts/doctor.cjs` — classes I + J + `--acceptance`/`--pre-tag` flags + the Bug-7 conditional in the legacy-clone check.
- `scripts/release.sh` — `--prerelease`/`--start-prerelease`/`--allow-ahead` args; `semver` devDep; one-commit next-bump; dirty/ahead guard before push; `--acceptance --pre-tag` before tag, full `--acceptance` after push; Step 9.5 rename.
- `bin/cli.js` — `mindrian-os doctor --acceptance` routing (already routes `doctor`; just passes the flag through).
- `package.json` — add `semver` to `devDependencies`; do NOT add to the `files` allowlist.

</code_context>

<deferred>
## Deferred Ideas

- **Phase 92 Drift Detection Engine** (the canon-drift detector — flags a plugin phase that ships a feature violating the canon) — separate, still unscaffolded; Phase 123 is install-state drift, not canon drift.
- **Desktop/Cowork install-state parity** beyond the basic `active_version`/`active_root` record — the manifest's owned-surface reconciliation is CLI-only by nature; a richer Desktop/Cowork install-health surface would be its own phase.
- **GitHub-side enforcement of the brain-boundary-scan / Canon-Custodian review** (Part 8 PR gate) — repository-layer config, not this phase.
- **Auto-migrating a `dev-clone`** (vs the obsolete `legacy` clone) — explicitly out of scope; `--fix` never touches a dev clone (D-13).
- **`--analyze`/`--batch`/`--text` parity for `mindrian-os doctor --acceptance` output** — UI polish, not in scope.
- **Brain canonical-interaction-model decision (field-report items #2-partial + #6)** — choosing the bundled `mcp-server-brain/` MCP path vs the wired `brain-client.cjs` HTTP path as *the* supported v1.13 path, and the full doc alignment that follows (`.env.brain.template` is entirely MCP-centric today; `BRAIN-SETUP.md`, `brain-connector/SKILL.md`, `commands/setup.md` need to agree). Plan-7 (D-31..D-35) makes the HTTP path *detectable + documented as present* and stops the silent Tier-0 drop — it does not pick a winner or retire the MCP path. The pick is a product-direction call; future phase. (Also a candidate: a shared `resolveBrainKey()`/`resolve-*` family extracted alongside `active-plugin-root.cjs` + `resolve-brain-key.cjs` as a general "single resolver per piece of install state" library — note the pattern, don't generalize prematurely.)
- **Reviewed-but-not-folded todos:** none — `todo match-phase 123` returned 0 matches.

</deferred>

---

*Phase: 123-install-lifecycle-harness*
*Context gathered: 2026-05-12*
