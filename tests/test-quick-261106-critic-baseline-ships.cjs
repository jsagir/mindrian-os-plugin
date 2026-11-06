#!/usr/bin/env node
'use strict';

/*
 * Quick 261106-eureka-critic-baseline-ships.
 *
 * The MCP tool eureka_critic needs no engine, but lib/core/eureka-critic.cjs reads
 * evals/eureka/212-critic-baseline.json at call time. package.json "files" had no entry
 * for that file, so every installed copy failed with ENOENT (found by plan 387-01).
 *
 * This test pins three facts:
 *   arm 1  the baseline file exists in the repo and parses as JSON
 *   arm 2  the pack payload (npm pack --dry-run --json) holds evals/eureka/212-critic-baseline.json
 *   arm 3  the pack payload holds no other file under evals/
 *
 * Offline: one local npm spawn (npm pack --dry-run --json --ignore-scripts), no network,
 * no publish. Hyphens only.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const BASELINE = 'evals/eureka/212-critic-baseline.json';

let passed = 0;
let failed = 0;
function ok(label) { passed += 1; process.stdout.write('PASS: ' + label + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL: ' + label + (detail ? '\n    ' + detail : '') + '\n'); }

// Arm 1: the file exists and parses.
try {
  JSON.parse(fs.readFileSync(path.join(REPO, BASELINE), 'utf8'));
  ok('arm 1: ' + BASELINE + ' exists in the repo and parses as JSON');
} catch (e) {
  bad('arm 1: ' + BASELINE + ' exists in the repo and parses as JSON', String(e.message));
}

// Pack payload, offline.
const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: REPO,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  timeout: 240000,
  env: Object.assign({}, process.env, { npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false' }),
});
let packed = null;
if (r.status === 0) {
  try { packed = JSON.parse(r.stdout)[0].files.map((f) => f.path); } catch (_e) { packed = null; }
}
if (!packed) {
  bad('npm pack --dry-run --json ran and printed a file list', 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
} else {
  if (packed.includes(BASELINE)) ok('arm 2: the pack payload holds ' + BASELINE);
  else bad('arm 2: the pack payload holds ' + BASELINE, 'file is not in the payload (' + packed.length + ' entries)');

  const otherEvals = packed.filter((p) => p.startsWith('evals/') && p !== BASELINE);
  if (otherEvals.length === 0) ok('arm 3: the pack payload holds no other file under evals/');
  else bad('arm 3: the pack payload holds no other file under evals/', otherEvals.slice(0, 5).join(', '));
}

process.stdout.write('\nRESULT: PASS=' + passed + ' FAIL=' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
