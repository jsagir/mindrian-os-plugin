// Author-time esbuild build for the M:OS wiki BlockNote client bundle (Phase 232 D-01).
//
// What this does, plainly: it takes the React + BlockNote source in src/, mashes it
// into one self-contained browser file, and drops that file plus its CSS next to it in
// ../editor-dist/. That compiled output is committed like any other static asset (the
// same shape as the Cytoscape CDN pattern). We rebuild it by hand with `npm run build`;
// there is NO build step at server runtime. React/BlockNote/esbuild live only in this
// walled directory and never touch the plugin's root package.json (D-02).
//
// CJS on purpose (repo convention: lib/ is CJS-only). Exits nonzero on any build failure
// so a broken bundle can never be silently committed.

const esbuild = require('esbuild');
const path = require('path');

const OUTFILE = path.join(__dirname, '..', 'editor-dist', 'wiki-editor.js');

esbuild
  .build({
    entryPoints: [path.join(__dirname, 'src', 'index.jsx')],
    bundle: true,
    format: 'iife',
    minify: true,
    jsx: 'automatic',
    loader: { '.jsx': 'jsx' },
    // BlockNote's CSS is published behind the "style" export condition (its
    // @blocknote/mantine style.css re-imports @blocknote/react/style.css that way).
    // esbuild does not enable that condition by default, so we opt in explicitly;
    // without it the CSS import chain fails to resolve.
    conditions: ['style'],
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: OUTFILE,
    logLevel: 'info',
  })
  .then(() => {
    // esbuild emits the imported CSS automatically as ../editor-dist/wiki-editor.css.
    console.log('[build] wrote', OUTFILE, '(+ wiki-editor.css)');
  })
  .catch((err) => {
    console.error('[build] FAILED:', err && err.message ? err.message : err);
    process.exit(1);
  });
