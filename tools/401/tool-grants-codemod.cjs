#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a), dev only (tools/ does not ship).
// Option A of 401-F1-PERMISSION-AUDIT.md: in each command file that
// data/tool-grants.json names under `pending`, the key name of the one
// top-level `allowed-tools:` line between the fences becomes
// `pending_tool_grants`. The host has no field with that name, so the list
// grants nothing. No other byte changes. A file that the fixture does not name
// under `pending` is never changed. A file that already holds the new key is
// not changed. It writes no skill mirror; scripts/build-skill-mirrors.cjs
// carries the key.
//
//   --check   exit 1 and a list when a file would change
//   --write   rename the key
//   --root <dir>  optional; the default is the repository of this script

const fs = require('node:fs');
const path = require('node:path');

const split = require('../../scripts/check-frontmatter-split.cjs');
const grants = require('../../scripts/check-tool-grants.cjs');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');
const OLD_RE = /^allowed-tools(\s*:)/;
const NEW_RE = /^pending_tool_grants\s*:/;

// Pure: (text, { inPending }) => { text, changed }.
function transform(text, opts) {
  if (!opts || !opts.inPending) return { text, changed: false };
  const b = split.frontmatterBounds(text);
  if (!b) return { text, changed: false };
  let idx = -1;
  for (let i = 1; i < b.fmEnd; i++) {
    if (NEW_RE.test(b.lines[i])) return { text, changed: false };
    if (idx === -1 && OLD_RE.test(b.lines[i])) idx = i;
  }
  if (idx === -1) return { text, changed: false };
  const lines = b.lines.slice();
  lines[idx] = lines[idx].replace(OLD_RE, grants.PENDING_KEY + '$1');
  return { text: lines.join('\n'), changed: true };
}

function main(argv) {
  let root = DEFAULT_ROOT;
  let mode = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') root = path.resolve(argv[++i]);
    else if (a === '--check' || a === '--write') mode = a;
    else mode = 'bad';
  }
  if (mode !== '--check' && mode !== '--write') {
    process.stderr.write('usage: node tools/401/tool-grants-codemod.cjs (--check | --write) [--root <dir>]\n');
    process.exit(2);
  }
  const fixture = grants.readFixture(root);
  if (!fixture) { process.stdout.write('tool-grants-codemod: fixture missing\n'); process.exit(1); }
  let changed = 0;
  for (const f of split.listSurfaceFiles(root).filter((x) => x.cls === 'commands')) {
    const p = path.join(root, f.rel);
    const r = transform(fs.readFileSync(p, 'utf8'), { inPending: Object.prototype.hasOwnProperty.call(fixture.pending || {}, f.rel) });
    if (!r.changed) continue;
    changed += 1;
    process.stdout.write((mode === '--check' ? 'WOULD-CHANGE ' : 'CHANGED ') + f.rel + '\n');
    if (mode === '--write') fs.writeFileSync(p, r.text);
  }
  process.stdout.write('tool-grants-codemod: ' + changed + ' ' + (mode === '--check' ? 'files would change' : 'changed files') + '\n');
  process.exit(mode === '--check' && changed ? 1 : 0);
}

module.exports = { transform };

if (require.main === module) main(process.argv.slice(2));
