// Lays the Claude Code plugin declaration file beside the mod, when the engine has not.
//
// The engine rewrites .claude-plugin/types/ on every load of a mod from a folder the person
// owns (claude --plugin-dir). This script is only the fallback for a machine where the mod
// has not been loaded yet: it copies the declaration file the plugin-authoring skill writes
// to /tmp/claude-*/bundled-skills. Idempotent, never overwrites an existing file.
// Exit 0 = laid or already there, 77 = nothing to copy from (ENV GAP). CJS, Node built-ins only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MOD = path.resolve(__dirname, '..');
const DEST = path.join(MOD, '.claude-plugin', 'types', 'claude-code', 'index.d.ts');
const TMP = process.env.TMPDIR || '/tmp';

function candidates() {
  const found = [];
  let roots = [];
  try {
    roots = fs.readdirSync(TMP, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith('claude-'));
  } catch (_e) {
    return found;
  }
  for (const root of roots) {
    const skills = path.join(TMP, root.name, 'bundled-skills');
    let versions = [];
    try { versions = fs.readdirSync(skills); } catch (_e) { continue; }
    for (const v of versions) {
      let hashes = [];
      try { hashes = fs.readdirSync(path.join(skills, v)); } catch (_e) { continue; }
      for (const h of hashes) {
        const file = path.join(skills, v, h, 'plugin-authoring', 'types', 'claude-code.d.ts');
        try { found.push({ file, mtime: fs.statSync(file).mtimeMs }); } catch (_e) { /* absent */ }
      }
    }
  }
  return found.sort((a, b) => b.mtime - a.mtime);
}

function lay() {
  if (fs.existsSync(DEST)) return { status: 0, note: 'already laid' };
  const best = candidates()[0];
  if (!best) {
    return {
      status: 77,
      note: 'no declaration file found: load the plugin-authoring skill or load the mod once with claude --plugin-dir',
    };
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.copyFileSync(best.file, DEST);
  return { status: 0, note: 'laid from ' + best.file };
}

if (require.main === module) {
  const r = lay();
  process.stdout.write('lay-types: ' + r.note + '\n');
  process.exit(r.status);
}

module.exports = { lay };
