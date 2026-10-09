'use strict';
// Runs the 2026 rs-discovery-engine.test.cjs (T1..T7) unmodified inside the stub tree.
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { spawnSync } = require('node:child_process');
const pkg = path.resolve(__dirname, '..', '..', '..', '..');
const which = process.argv[2] || 'new'; // 'new' or 'orig'
const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-disc-'));
const opts = which === 'orig'
  ? { engine: '_baseline/orig/rs/shared/scripts/rs-discovery-engine.cjs', test: '_baseline/orig/rs/shared/lib/memory/rs-discovery-engine.test.cjs' }
  : {};
require('./build_tree.cjs')(tree, pkg, opts);
const r = spawnSync(process.execPath, [path.join(tree, 'lib/memory/rs-discovery-engine.test.cjs')], { encoding: 'utf8' });
process.stdout.write('[' + which + '] exit ' + r.status + '\n' + r.stdout + (r.stderr ? 'STDERR: ' + r.stderr.split('\n').slice(0, 6).join('\n') + '\n' : ''));
fs.rmSync(tree, { recursive: true, force: true });
process.exitCode = r.status === 0 ? 0 : 1;
