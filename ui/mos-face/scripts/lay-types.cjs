// Lays the Claude Code plugin declaration files beside the mod, when the engine has not.
//
// The engine writes .claude-plugin/types/ when a session loads a mod from a folder the
// person owns (claude --plugin-dir). A fresh checkout has no such folder, and the folder is
// gitignored. This script is the fallback: it copies the declaration files from a copy that
// is already on this machine. Idempotent, never overwrites, no network.
//
// Source order:
//   1. ui/mos-face/.claude-plugin/types/claude-code/index.d.ts already present: nothing to do.
//   2. The newest ~/.claude/dev-mods/*/*/.claude-plugin/types folder (whole folder is copied).
//   3. The plugin-authoring skill copy under /tmp/claude-*/bundled-skills.
//
// It prints the first line of the declaration file (it names the Claude Code version that
// wrote it) and the output of claude --version.
// Exit 0 = laid or present, 77 = no source exists (ENV GAP). CJS, Node built-ins only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MOD = path.resolve(__dirname, '..');
const TYPES = path.join(MOD, '.claude-plugin', 'types');
const DEST = path.join(TYPES, 'claude-code', 'index.d.ts');
const FIX =
  'load the mod once in an interactive session with: claude --plugin-dir ui/mos-face';

function safeDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch (_e) {
    return [];
  }
}

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch (_e) {
    return null;
  }
}

// Source 2: folders written by the engine for a mod loaded from a dev folder.
function devModFolders() {
  const base = path.join(os.homedir(), '.claude', 'dev-mods');
  const found = [];
  for (const a of safeDirs(base)) {
    for (const b of safeDirs(path.join(base, a.name))) {
      const dir = path.join(base, a.name, b.name, '.claude-plugin', 'types');
      const m = mtime(path.join(dir, 'claude-code', 'index.d.ts'));
      if (m !== null) found.push({ dir, mtime: m });
    }
  }
  return found.sort((x, y) => y.mtime - x.mtime);
}

// Source 3: the single declaration file of the plugin-authoring skill.
function skillFiles() {
  const tmp = process.env.TMPDIR || '/tmp';
  const found = [];
  for (const root of safeDirs(tmp).filter((e) => e.name.startsWith('claude-'))) {
    const skills = path.join(tmp, root.name, 'bundled-skills');
    for (const v of safeDirs(skills)) {
      for (const h of safeDirs(path.join(skills, v.name))) {
        const file = path.join(skills, v.name, h.name, 'plugin-authoring', 'types', 'claude-code.d.ts');
        const m = mtime(file);
        if (m !== null) found.push({ file, mtime: m });
      }
    }
  }
  return found.sort((x, y) => y.mtime - x.mtime);
}

function firstLine(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n')[0];
  } catch (_e) {
    return '(unreadable)';
  }
}

function claudeVersion() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 20000 });
  if (r.error || r.status !== 0) return '(claude --version unavailable)';
  return String(r.stdout || '').trim();
}

function report(origin) {
  process.stdout.write('lay-types: ' + origin + '\n');
  process.stdout.write('lay-types: declaration file says: ' + firstLine(DEST) + '\n');
  process.stdout.write('lay-types: installed engine: ' + claudeVersion() + '\n');
}

function lay() {
  if (fs.existsSync(DEST)) return { status: 0, origin: 'already present at ' + DEST };

  const dev = devModFolders()[0];
  if (dev) {
    fs.mkdirSync(path.dirname(TYPES), { recursive: true });
    fs.cpSync(dev.dir, TYPES, { recursive: true, errorOnExist: false, force: false });
    return { status: 0, origin: 'laid from ' + dev.dir };
  }

  const skill = skillFiles()[0];
  if (skill) {
    fs.mkdirSync(path.dirname(DEST), { recursive: true });
    fs.copyFileSync(skill.file, DEST);
    return { status: 0, origin: 'laid from ' + skill.file };
  }

  return { status: 77, origin: 'no declaration file found. One fix: ' + FIX };
}

if (require.main === module) {
  const r = lay();
  if (r.status === 0) report(r.origin);
  else process.stdout.write('lay-types: ' + r.origin + '\n');
  process.exit(r.status);
}

module.exports = { lay };
