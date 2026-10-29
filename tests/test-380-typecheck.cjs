// Gate wrapper for the ui/mos-face type-check (Phase 380, plan 02, MOD380-04).
// Exit 0 = type-check passed, 77 = ENV GAP (no compiler or no declaration file), 1 = failed.
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'ui', 'mos-face', 'scripts', 'typecheck.cjs');

const r = spawnSync(process.execPath, [ENTRY], { encoding: 'utf8', timeout: 300000, cwd: ROOT });
const out = String(r.stdout || '') + String(r.stderr || '');

if (r.status === 0) {
  process.stdout.write('PASS: ui/mos-face type-check is clean\n');
  process.exit(0);
}
if (r.status === 77) {
  process.stdout.write('SKIPPED (ENV GAP): ' + out.trim().split('\n').slice(-2).join(' | ') + '\n');
  process.exit(77);
}
process.stdout.write('FAIL: ui/mos-face type-check exited ' + r.status + (r.error ? ' (' + r.error.message + ')' : '') + '\n');
process.stdout.write(out.split('\n').slice(0, 40).join('\n') + '\n');
process.exit(1);
