// Spike 006, stage 02 build: bundle src/app.js (RxDB, ESM) into output/app.js for the browser.
'use strict';
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const here = __dirname;
fs.mkdirSync(path.join(here, 'output'), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(here, 'src/app.js')],
  outfile: path.join(here, 'output/app.js'),
  bundle: true, format: 'iife', target: 'es2022', minify: true, sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
fs.copyFileSync(path.join(here, 'src/index.html'), path.join(here, 'output/index.html'));
const kb = Math.round(fs.statSync(path.join(here, 'output/app.js')).size / 1024);
console.log('built output/app.js ' + kb + ' KB');
