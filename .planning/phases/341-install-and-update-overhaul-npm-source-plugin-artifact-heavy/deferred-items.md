# Phase 341 deferred items (logged by plan 341-09)

Out-of-scope findings. None of these was caused by plan 341-09. Each was seen RED before the plan's change or depends on the uncommitted state of the shared tree.

| Item | Evidence | Suggested owner |
|------|----------|-----------------|
| `tests/test-353-doctor-section-ruling.cjs` pins 28 doctor modules | The registry had 30 before plan 341-09 and has 29 after. RED either way. | A quick task: change the pin to read the count or update it. |
| `tests/test-369.26-registry-sync.cjs` 2 arms RED | `ui/mindrian-workspace-mod/assets/command-registry.json` and `framework-names.json` differ from `data/`. Same 2 arms RED on a `git archive` of the commit before this plan. | Run `node ui/mindrian-workspace-mod/scripts/sync-assets.cjs` in a quick task. |
| `tests/test-92-rename-no-long-leaves.cjs` RED | RED on the same archive. | Unowned. |
| `tests/test-233-graph-derive-heal-retrofit.cjs` scenario 8 RED in the real tree | `preflight-release-drift` returns a message because local plugin.json is behind origin. Passes on a git-less archive. | Make the test stub the release-drift source. |
| `tests/test-doctor-acceptance-preflight-checks.cjs` Test 6 RED in the real tree | The live acceptance run fails `verify-release-clean-tree` while other executors have uncommitted files. | Re-run on a clean tree. |
| `scripts/backfill-layer.cjs --check` reports 4 surfaces | `agents/larry-extended.md`, `commands/file-meeting.md`, `commands/setup.md`, `skills/file-meeting/SKILL.md`. The count was 4 before and after. | Unowned. |
| `tests/test-release-npm-gate.sh` exits 1 | Exits 1 on the archive and on the real tree. | Unowned. |
| `dist/*/skills/doctor/SKILL.md` still list class H and class A | Generated snapshots; `node scripts/build-dist-bundles.cjs` regenerates them at release. | Release cut. |
| `data/deployment-surfaces.json` and `checkInstallVersion` legacy-directory fall-through | Plan 341-10 owns the legacy-topology halves of classes I and J and the engine's `checkInstallVersion` fall-through. | Plan 341-10. |
