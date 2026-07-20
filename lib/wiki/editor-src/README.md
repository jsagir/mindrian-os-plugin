# M:OS Wiki Editor (the one build-step island)

## The job this does

The wiki server is CJS with no build step. It just serves files. But the article editor
is BlockNote, which is React, which needs bundling. So we wall the whole build off in this
one directory and vendor the compiled result out. This is the ONLY place in the plugin
that has a build step (Phase 232 decision D-02).

Think of it like the Cytoscape graph: the browser gets one prebuilt file, committed to the
repo, served as a static asset. Nobody runs a bundler when the wiki starts. We run the
bundler here, by hand, when we change the editor, and we commit the output.

## How to rebuild

```bash
cd lib/wiki/editor-src
npm install        # only needed once, or after a dependency change
npm run build      # writes ../editor-dist/wiki-editor.js + wiki-editor.css
```

Then commit the two files in `lib/wiki/editor-dist/`. They are checked in like any other
static asset (D-01). `node_modules/` here is git-ignored by the repo-root `node_modules/`
rule and must never be committed; `package-lock.json` IS committed as the supply-chain pin.

## The hard rule: never leak into the root package.json

`react`, `react-dom`, `@blocknote/*`, `esbuild`, `pdfmake`, and `docx` belong ONLY to this
directory's `package.json`. They must never be added to the plugin's root `package.json`
(SPEC Req 1). The plugin ships CJS, no-build-step, and its dependency tree stays clean.
If you ever find one of these packages in the root `package.json`, that is a regression.

The three `@blocknote/*` versions are pinned EXACT (no caret) to `0.51.4`. Decision D-07's
byte-identical markdown round-trip guarantee was verified against 0.51.4 source; a silent
minor bump would void that verification. Do not loosen these pins without re-verifying.

## Fallback (only if HMR ever becomes necessary)

Vite library mode is the documented fallback, and only if hot-module-reload-driven widget
iteration becomes necessary (D-04). For now, manual esbuild is deliberately the simplest
thing that works. Do not reach for Vite unless HMR is a proven need.
