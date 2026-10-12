'use strict';
// Quick 261012-kfn preload. Lets the UNMODIFIED spike-010 harness run without
// writing into the spike folder: any fs.writeFileSync to a path that ends in
// 010-leviathan-search-vs-room-search/results.json is redirected to
// 261012-kfn-spike010-rerun.json in this quick task folder.
//
// Usage (from the repo root):
//   node -r ./.planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-redirect-results.cjs \
//     .planning/spikes/010-leviathan-search-vs-room-search/run.cjs
//
// No em-dashes.

const fs = require('node:fs');
const path = require('node:path');

const TARGET_SUFFIX = path.join('010-leviathan-search-vs-room-search', 'results.json');
const REDIRECT = path.join(__dirname, '261012-kfn-spike010-rerun.json');
const realWrite = fs.writeFileSync;

fs.writeFileSync = function redirectedWrite(file, data, options) {
  if (typeof file === 'string' && path.resolve(file).endsWith(TARGET_SUFFIX)) {
    return realWrite.call(fs, REDIRECT, data, options);
  }
  return realWrite.call(fs, file, data, options);
};
