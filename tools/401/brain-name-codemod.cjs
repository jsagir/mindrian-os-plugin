#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a), dev only (tools/ does not ship).
// Rule A1 of slice 3a (owner ruling O8): in commands/*.md, between the fences,
// delete each entry of `allowed-tools` or `pending_tool_grants` that matches
// pattern PB. It adds nothing. It changes no line below the closing fence.
// It writes no skill mirror; scripts/build-skill-mirrors.cjs regenerates them.
//
//   --check   exit 1 and a list when an entry matches
//   --write   delete the matching entries
//   --root <dir>  optional; the default is the repository of this script

const fs = require('node:fs');
const path = require('node:path');

const split = require('../../scripts/check-frontmatter-split.cjs');
const grants = require('../../scripts/check-tool-grants.cjs');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');
const KEYS = ['allowed-tools', 'pending_tool_grants'];

function keyRe(key) {
  return new RegExp('^' + key.replace(/-/g, '\\-') + '\\s*:');
}

// Pure: (text) => { text, changed, deleted }.
function transform(text) {
  const b = split.frontmatterBounds(text);
  if (!b) return { text, changed: false, deleted: [] };
  const lines = b.lines.slice();
  const deleted = [];
  const drop = new Set();
  for (const key of KEYS) {
    let idx = -1;
    for (let i = 1; i < b.fmEnd; i++) if (keyRe(key).test(lines[i])) { idx = i; break; }
    if (idx === -1) continue;
    const p = grants.parseListAt(lines, idx, b.fmEnd, key);
    if (p.form === 'block') {
      p.entries.forEach((e, n) => {
        if (grants.entryMatchesPB(e)) { drop.add(p.entryLines[n]); deleted.push(e); }
      });
    } else {
      const keep = p.entries.filter((e) => !grants.entryMatchesPB(e));
      const gone = p.entries.filter((e) => grants.entryMatchesPB(e));
      if (gone.length) {
        const prefix = lines[idx].match(keyRe(key))[0];
        const sep = lines[idx].indexOf(',') !== -1 ? ', ' : ' ';
        lines[idx] = p.form === 'flow' ? prefix + ' [' + keep.join(', ') + ']' : prefix + ' ' + keep.join(sep);
        for (const g of gone) deleted.push(g);
      }
    }
  }
  if (!deleted.length) return { text, changed: false, deleted };
  const out = lines.filter((_, i) => !drop.has(i));
  return { text: out.join('\n'), changed: true, deleted };
}

function commandFiles(root) {
  return split.listSurfaceFiles(root).filter((f) => f.cls === 'commands');
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
    process.stderr.write('usage: node tools/401/brain-name-codemod.cjs (--check | --write) [--root <dir>]\n');
    process.exit(2);
  }
  let files = 0;
  let entries = 0;
  for (const f of commandFiles(root)) {
    const p = path.join(root, f.rel);
    const r = transform(fs.readFileSync(p, 'utf8'));
    if (!r.changed) continue;
    files += 1;
    entries += r.deleted.length;
    for (const e of r.deleted) process.stdout.write((mode === '--check' ? 'MATCH ' : 'DELETED ') + f.rel + ': ' + e + '\n');
    if (mode === '--write') fs.writeFileSync(p, r.text);
  }
  process.stdout.write('brain-name-codemod: ' + entries + ' ' + (mode === '--check' ? 'matching' : 'deleted') + ' entries in ' + files + ' commands\n');
  process.exit(mode === '--check' && entries ? 1 : 0);
}

module.exports = { transform };

if (require.main === module) main(process.argv.slice(2));
