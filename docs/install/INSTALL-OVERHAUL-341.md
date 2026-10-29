# Install and update overhaul, Phase 341: close-out

**Shipped:** 2026-10-29 in the dev repo only. NOT LIVE for any user until a release carries it. Plans 341-01 to 341-05 (the packaging cut) went out earlier in v2.0.0-beta.31 (CHANGELOG, 2026-09-10). Plans 341-06 to 341-10 are on the branch `feat/eureka-adapter-rebased` and are in no release yet.

**Status: cold install proof WAIVED by the navigator, not observed on Windows or macOS.** The cold install of this artifact is proven on no platform of this version. See [COLD-INSTALL-PROOF-341](COLD-INSTALL-PROOF-341.md). Read the open items below before you trust this record.

This file is the tracked close-out. `.planning/` is gitignored, so the plan summaries do not reach another machine. This file does.

## What changed, in plain words

The plugin used to be delivered as a git checkout of the release tag with `node_modules` vendored into it. That checkout was 755 MB. It is why `claude plugin update` died in `git clone` on slow machines. Now the plugin is an npm tarball that holds only the runtime tree (about 29 MB unpacked). The platform's own loader fetches the tarball, copies it and runs `npm ci` from the shipped `npm-shrinkwrap.json`. The heavy embedding stack (the Eureka model runtime) is no longer in the tarball. `/mos:eureka enable` installs it on request. `/mos:update` is now four steps: Check, Confirm, Loader, Verify. The first session after an update checks itself and shows the result.

## The numbers

Every number carries its source file. The phase directory `.planning/phases/341-install-and-update-overhaul-npm-source-plugin-artifact-heavy/` is gitignored; the files named below live there.

| Measure | Before | After | Source |
|---------|--------|-------|--------|
| Release tag, full clone | 755 MB | n/a | `341-FINDINGS.md` line 16 (tag `v2.0.0-beta.29`) |
| Release tag, shallow checkout | 738 MB, 16,597 files | n/a | `341-FINDINGS.md` line 15 |
| `node_modules` inside the tag | 410.3 MB, 8,880 files | none shipped | `341-FINDINGS.md` line 30 |
| Embedding stack inside the dev box `node_modules` | 392.6 MB of 441 MB (local install, not the tag) | 0 in the tarball | `341-RESEARCH.md` line 68 |
| Tarball entry count | n/a | 1,829 to 1,831 (three runs) | `341-04-SUMMARY.md` |
| Tarball unpacked size | n/a | 29,101,156 to 29,114,166 bytes | `341-04-SUMMARY.md` |
| Tarball packed size | n/a | 8,936,433 to 8,942,158 bytes | `341-04-SUMMARY.md` |
| Later measure, same policy | n/a | 1,833 entries, 29,126,083 bytes | `341-05-SUMMARY.md` |
| Ceiling, entries | 20,000 | 20,000 (policy limit) | `341-RESEARCH.md` F-4 (`Ce = 20000`) |
| Ceiling, unpacked bytes | 268,435,456 (256 MiB) | 268,435,456 (policy limit) | `341-RESEARCH.md` F-4 (`Te = 268435456`) |

The platform documents the 20,000-entry and 256 MiB ceiling (`341-FINDINGS.md` lines 77 to 80). `341-RESEARCH.md` F-4 found that Claude Code 2.1.266 does not enforce it on the npm path. So the `release-payload-ceiling` policy is the only enforcement. It is a limit this repo sets for itself.

## Decision coverage

One row for each locked decision, plus the folded todo. "Pinned by" names the test or gate. A test in `tests/` runs with `bash tests/run-all-341.sh`.

| Decision | One-line statement | Delivered by | Pinned by |
|----------|--------------------|--------------|-----------|
| D-01 | Marketplace `source` is npm with an exact version, never a range or dist-tag | 341-05 | `test-341-marketplace-npm-source.cjs`, `test-341-version-of-record-source-version.cjs` |
| D-02 | The tarball is the runtime tree only (`files` allowlist with negations) | 341-04 | `test-341-payload-ceiling.cjs`, `test-341-payload-shrinkwrap-present.cjs` |
| D-03 | `@huggingface/transformers` and its stack leave `dependencies` | 341-04 | `test-341-no-heavy-dep.cjs` |
| D-04 | Dependencies come from `npm-shrinkwrap.json` and the loader's `npm ci` | 341-04, 341-05 | `test-341-shrinkwrap-no-dev.cjs`, `test-341-shrinkwrap-platform-coverage.cjs`, `test-341-release-shrinkwrap-gate.cjs` |
| D-05 | `archive` source is the documented fallback, not built | 341-07 (documented in `PACKAGING-PATHS.md`) | none. Unbuilt by design. See Known gaps. |
| D-06 | Tag plus Commit A and B stay; Step 6.7 vendoring and the Commit-B untrack block go; `source.version` is record 5 | 341-05 | `test-341-release-shrinkwrap-gate.cjs`, `test-341-version-of-record-source-version.cjs`, the step-block tripwire in `run-all-341.sh` (RED today, see Open items) |
| D-07 | `/mos:update` collapses to Check, Confirm, Loader, Verify; the SHA leg and touch-file go | 341-08 | `test-341-update-collapsed.cjs` |
| D-07a | The first session after an update verifies itself, shows one signal, probes Theo detached | 341-08 | `test-341-session-verify-state.cjs`, `test-341-session-start-tier.cjs`, `test-341-session-start-verify-hook.cjs`, `test-341-verify-insight-delivery.cjs`, `data/harness-policies/session-start-verification.json` |
| D-07b | One Eureka opt-in card, once | 341-08 | `test-341-eureka-optin-once.cjs`, `test-341-eureka-optin-card.cjs`, `data/harness-policies/eureka-optin-once.json` |
| D-08 | Two harness policies: `release-payload-ceiling` (blocking) and `registry-drift` (logged) | 341-04, 341-05 | `test-341-payload-ceiling.cjs`, `test-341-registry-drift.cjs` |
| D-09 | `/mos:eureka enable` and `doctor --fix eureka` install the model stack to `~/.mindrian/eureka-deps/` | 341-02 | `test-341-eureka-deps-resolver.cjs`, `test-341-eureka-enable-argv.cjs` |
| D-10 | Capability never depends on the model; a missing model is an honest state | 341-03 | `test-341-slim-install-honest-degrade.cjs` |
| D-11 | Doctor class S splits L1; the `model_installed` layer is advisory; the `isModelCached` await bug is fixed | 341-03 | `test-341-class-s-layer-split.cjs` |
| D-12 | Eureka has no Brain or Theo reach; one no-drift test pins it | 341-03 | `test-341-eureka-no-brain-reach.cjs` |
| D-13 | Migration order: cut, prove cold install, retire second location, collapse update, retire doctor classes | Step 1: 341-04, 341-05. Step 2: 341-06 (WAIVED). Step 3: 341-07. Step 4: 341-08. Step 5: 341-09, 341-10 | `test-341-cold-install-evidence.cjs` (pins the waiver wording), `test-341-legacy-install-teardown.cjs`, `test-341-install-sh-retired.cjs`, `test-341-retired-classes-a-h.cjs`, `test-341-retired-topology-halves.cjs` |
| Folded todo | Registry-drift gate: a command in the last release must not vanish silently | 341-04 | `registry-drift` policy and `test-341-registry-drift.cjs` |

D-13 step 5 is only partly done. Classes A and H are retired. The legacy-topology halves of classes I and J are NOT retired; plan 341-10 audited them and found them still reachable. `test-341-retired-topology-halves.cjs` pins that finding. See "What was retired" and Open items.

## What was retired

| Item | Reason | Plan |
|------|--------|------|
| `release.sh` Step 6.7 vendoring and `MOS_SKIP_VENDOR` | Dependencies ship as `npm-shrinkwrap.json`, not as a vendored `node_modules` | 341-05 |
| The Commit-B `git rm --cached node_modules` block | Nothing is vendored, so nothing needs an untrack | 341-05 |
| The old shell installer script (deleted from the repo root) | One install location. The marketplace loader is the only guaranteed path. | 341-07 |
| The second install location `~/.claude/plugins/mindrian-os` as an install target | Nothing creates or repairs it any more. Existing copies on user machines remain until the migrator removes them. | 341-07 |
| `/mos:update` Steps 6 and 7 (stale-path migrator, atomic activator) | The loader owns the swap | 341-08 |
| `~/.mindrian/post-update-restart-pending` and its preflight banner | Replaced by the version-change verification | 341-08 |
| `doctor --post-update` and `scripts/post-update-activation.cjs` | The activator is gone | 341-08 |
| `SHA_DIFFERS_INVERSION_HOTFIX` and the `api.github.com` tag-ref call | Published npm versions are immutable | 341-08 |
| Doctor class H (install-incomplete) | Its only input, `.install-receipt.json`, had one writer: the old shell installer | 341-09 |
| Doctor class A (legacy install versus marketplace cache drift, with swap recovery) | The recovery was the only code that created the legacy directory, and it is gone | 341-09 |

NOT retired, on purpose (341-10): the `legacy` topology value of class I, the legacy-clone-beside-cache migration candidate, the F11 legacy-config-pin drift finding, and the legacy-directory fall-through of `checkInstallVersion`. Each is still reachable on a real machine. The reasons:

- `lib/core/active-plugin-root.cjs` still resolves `~/.claude/plugins/mindrian-os` and classifies it `legacy`. A machine that ran the old shell installer has that directory. Shown on a temp HOME by test arm 11: the doctor engine reports topology `legacy`.
- The migration-candidate finding is the only way the doctor reaches `scripts/migrate-legacy-install-location.cjs`. Remove it and the migrator has no caller.
- `~/.claude/plugins/config.json` belongs to the platform's old plugin system, not to the retired installer. the shell installer, at the commit before its deletion, never mentions it. So the plan's condition for removing F11 does not hold.
- On a legacy-only machine the fall-through is the only way the doctor engine learns the running version.

## What is new

| Item | Plan |
|------|------|
| `npm-shrinkwrap.json` (zero dev entries, all five sqlite-vec platform packages) | 341-04 |
| The `files` allowlist (24 entries at the packaging cut per CHANGELOG beta.31; 25 today in `package.json`, five of them `!` negations) | 341-04 |
| Harness policies `release-payload-ceiling` (blocking) and `registry-drift` (logged), with `scripts/check-release-payload-ceiling.cjs` and `scripts/check-registry-drift.cjs` | 341-04 |
| `scripts/release-lib/shrinkwrap-gate.sh` (`mos_generate_shrinkwrap`) | 341-05 |
| `/mos:eureka enable`, `doctor --fix eureka`, `~/.mindrian/eureka-deps/`, `lib/core/eureka-deps-resolver.cjs` | 341-02 |
| Class S layer `model_installed` (advisory) | 341-03 |
| `scripts/migrate-legacy-install-location.cjs` (dry run by default; scan, verified backup, path-guarded remove) | 341-07 |
| `scripts/collect-cold-install-evidence.cjs` | 341-06 |
| `lib/core/session-verify-state.cjs`, `scripts/session-verify-probe.cjs`, doctor `--acceptance --session-start` tier and `--only=<ids>` | 341-08 |
| `tests/run-all-341.sh` and the `tests/test-341-*.cjs` set | 341-01 to 341-10 |

## Operator handoff for the next release

- The marketplace `source` flip is a DATA migration. It happens only when `scripts/release.sh` runs. Nothing in this repo changes the live catalog. The overhaul is not live until a release carries it.
- Before the first release after a Claude Code minor bump, re-verify the loader constants against the installed binary: the 60,000 ms dependency-install timeout, the lockfile table order, and the entry and byte ceilings. Source: `341-RESEARCH.md`, "Valid until" note.
- `npm-shrinkwrap.json` is regenerated by `release.sh` on every release. Never edit it by hand.
- `tests/run-all-341.sh` is not green. Three legs are RED (listed below). Repin them in a separate quick before a release cut, or the release gate will see them.
- A stale checkout that assumes the release tag carries `node_modules` is wrong. The delivery channel is the npm tarball.

## Open items (follow-ons, not hidden)

1. **Cold install, Windows and macOS: never observed.** The navigator waived the proof. Linux has one non-cold datum (an update over beta.27 to beta.31). No `first_install_seconds` exists on any platform. 341-RESEARCH assumption A1 (does the first loader `npm install` have a timeout) has no timing.
2. **Legacy-clone migrator gap.** The old shell installer cloned `github.com/jsagir/mindrian-os-plugin` into `~/.claude/plugins/mindrian-os`. The migrator's dev-clone safety belt (`isLegacyDevClone`) refuses any clone whose origin matches `mindrian-os-plugin`. So the migrator refuses the very directory it was written for. Read from the code; not run on a real clone. Also, the old shell installer made symlinks in `~/.claude/commands/mos`, `~/.claude/skills` and `~/.claude/agents` that point into the legacy directory. The migrator scans `settings.json` only. After a removal those symlinks dangle. Nothing scans for them. UNVERIFIED on a real install. A navigator decision is needed on the belt.
3. **Brain shim stdin-EOF defect.** `bin/mindrian-brain-mcp-client.cjs` answers `tools/list` but does not exit on stdin EOF. The doctor point `mcp-surface-tool-count` therefore waits out a 15 s spawn timeout (15.4 s measured, three runs). That is more than the 12 s hook budget, so the point was moved out of the inline session-start tier to the detached probe (`doctor --acceptance --only=activation-reached-the-wire,mcp-surface-tool-count`). To bring it back inline, fix the shim, then add `session-start` to that point's `applies_to`.
4. **Nothing displays the probe result.** The detached probe records `surface` and `surface_reason` in the marker file. The statusline glyph reads `local.ok` only. A failed MCP surface check on a user machine is silent for now.
5. **Three red legs in `tests/run-all-341.sh`.** (a) `341: run-all-310.sh` (inside it, leg 3 step-block hashes and leg 9 tree cleanliness). (b) `341: version-of-record-source-version`. (c) `341: step-block tripwire`: the `release.sh` step-block hashes moved after commits 1307192bb and e5c2d0827. They are known and were red before plans 341-09 and 341-10. They were not hidden, skipped, renamed or repinned. The repin is a separate quick.
6. **Deferred items from plan 341-09** (`deferred-items.md` in the phase directory):
   - `tests/test-353-doctor-section-ruling.cjs` pins 28 doctor modules; the registry holds 29.
   - `tests/test-369.26-registry-sync.cjs`, 2 arms RED; fix is `node ui/mindrian-workspace-mod/scripts/sync-assets.cjs`.
   - `tests/test-92-rename-no-long-leaves.cjs` RED, unowned.
   - `tests/test-233-graph-derive-heal-retrofit.cjs` scenario 8 RED in the real tree (release-drift source not stubbed).
   - `tests/test-doctor-acceptance-preflight-checks.cjs` Test 6 RED on a dirty tree; UNVERIFIED on a clean tree.
   - `scripts/backfill-layer.cjs --check` reports 4 surfaces; `tests/test-release-npm-gate.sh` exits 1.
   - `dist/*/skills/doctor/SKILL.md` still list classes A and H; `node scripts/build-dist-bundles.cjs` regenerates them at the release cut.
7. **Legacy-topology halves of classes I and J stay.** See "What was retired". Retire them only after the producers are gone: the resolver's legacy path for the `legacy` value, and the platform's own `config.json` for F11. Change `test-341-retired-topology-halves.cjs` in the same commit.

## Known gaps and accepted risks

- No `sqlite-vec-windows-arm64` package exists upstream. A Windows-on-ARM machine degrades to the cjs fallback in `lib/core/eureka/vector-store.cjs`. Class S shows it. Source: `341-RESEARCH.md`, platform table.
- The `archive` source (D-05) is documented in `PACKAGING-PATHS.md` and not built. It needs a hosting surface and a build step that do not exist.
- 341-RESEARCH assumption A8 is open: the `CLAUDE_CODE_PLUGIN_SEED_DIR` pre-bake path may seed the plugin before the dependency install, which would give a pre-baked fleet a plugin with no dependencies. It belongs to whoever owns that path.
- Tri-Polar posture: whether Claude Desktop and Cowork resolve the plugin through the same loader as the CLI (assumption A6) was not tested. Treat Desktop and Cowork resolution of the single install location as an open risk, not a fact. See the "Tri-Polar posture" section of [COLD-INSTALL-PROOF-341](COLD-INSTALL-PROOF-341.md).

## Cross-links

- Evidence and waiver record: [COLD-INSTALL-PROOF-341](COLD-INSTALL-PROOF-341.md)
- User-facing packaging record: [PACKAGING-PATHS](PACKAGING-PATHS.md)
- Release ceremony: `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 8
