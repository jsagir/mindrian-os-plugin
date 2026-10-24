---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 09-fix
subsystem: state-owner-build-rewrite
tags: [mos-face, state-owner, build-time-rewrite, D-05, owner-ruling-2026-10-24]
completed: 2026-10-24
---

# Plan 380-09 follow-up: build-time owner rewrite - Summary

Owner decision (card, 2026-10-24): "Build-time rewrite only". The source keeps the plugin name mos-face. The release build rewrites the state owner to mos in the dist.

## Root cause

Commit bfc7cd798 renamed the owner to mos in the source. A source plugin named mos, loaded with `claude --plugin-dir ui/mos-face`, replaces the installed mos plugin (docs plugins/loading, "Name conflicts"). The /mos:* commands and the shim tool vanish in a dev run.

## Commits (release tree /home/jsagi/dev/MindrianOS-Plugin-release, main, not pushed)

| Step | Commit | Subject |
|------|--------|---------|
| RED | e18cb24bf | test(380-09): RED the source keeps owner mos-face and only the dist says mos |
| Fix | 01ed3f929 | fix(380-09): the source keeps the owner mos-face, the build rewrites it to mos in the dist |

## RED output (before the fix)

```
FAIL R1 source package name is mos-face :: name=mos
FAIL R2 source atoms are owned by mos-face :: {"mos":37}
FAIL R3 source PluginState key is mos-face :: ["mos"]
FAIL R7 the build rewrites the owner and checks for a leftover
test-380-rename: 4 passed, 4 failed
```

## What changed

- Test: tests/test-380-rename.cjs (R1 to R8), leg added to tests/run-all-380.sh.
- Source back to mos-face: plugin.json name, 37 atoms in hooks/register.tsx, PluginState key in types/index.d.ts, 5 fixture files. The comment above the atoms now explains the build rewrite.
- scripts/build-mos-face.cjs: `rewriteOwner` on the compiled .js modules and the types file, exact patterns (`plugin: 'mos-face'` and the four-space PluginState key line). Folder name, file names and prose (/mos-face command text) stay. The build throws on a leftover; `verifyOutput` reports one, so `--check` also catches it.
- Dist rebuilt: register.js (owner mos, comment text only otherwise), types (owner mos), manifest.

## Deviations (root cause written down)

1. tests/test-380-build.cjs B8 stays named mos (task step 2 asked to revert it). B8 loads the DIST, whose owner is now mos, and the engine allows only the owner plugin to write. A plugin named mos-face would fail. The throwaway plugin never touches the installed plugin, so no name conflict.
2. tests/test-380-build.cjs types leg was "dist types is a byte copy of the package declarations". It is now "equal to the source declarations after rewriteOwnerText". The build exports `rewriteOwnerText` for this.

## Verification

- `node scripts/build-mos-face.cjs --check`: fresh (source hash a239e62a351c8ec8, 21 dist files).
- `bash tests/run-all-380.sh`: PASSED=19 FAILED=0 SKIPPED=0 KNOWN=0.
- `claude plugin test` in ui/mos-face: 182 pass, 0 fail.
- `node ui/mos-face/scripts/typecheck.cjs`: exit 0.
- `node tests/test-380-installed-layout.cjs`: 29 passed, 0 failed (reaches "mos: /m:os state, read never" in the real engine).
- tests/test-380-build.cjs: 115 passed, 0 failed.
- Scratch run (scratch HOME and CLAUDE_CONFIG_DIR, login file by symlink, copy of the installed mos beta.73 and its marketplace): without the flag 126 `mos:` commands, plugins list holds mos; with `--plugin-dir ui/mos-face` 126 `mos:` commands, plugins list holds mos-face AND mos, shim tool mcp__plugin_mos_mindrian-brain__* present. The dev run no longer replaces the installed plugin.

## Not done

No push, no STATE.md or ROADMAP.md edit. The 380-09-SUMMARY.md text still says the owner was renamed to mos in source; this file supersedes that point.
