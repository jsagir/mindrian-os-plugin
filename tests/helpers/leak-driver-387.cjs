#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 10: the driver of the owner-run live leak test.
 *
 * One graph call to the Eureka engine with a synthetic snapshot that carries a planted marker. It uses the
 * plugin's real call path (callEurekaWorkflow), so the real uv arguments (--no-sync --offline --locked
 * --no-python-downloads) and the real child environment are used.
 *
 * Arguments: --root ENGINE_ROOT --out RESULT_FILE --marker MARKER
 * Exit: 0 when the call returned ok, 1 otherwise (including a refusal such as engine_checkout_unavailable).
 *
 * It reads no room, opens no network connection itself and writes only RESULT_FILE (mode 0600).
 * The engine root comes from --root; the live test passes it from its own environment. Synthetic data only.
 */

const fs = require('node:fs');
const path = require('node:path');

function arg(name) {
  const at = process.argv.indexOf(name);
  return at !== -1 && at + 1 < process.argv.length ? process.argv[at + 1] : null;
}

async function main() {
  const root = arg('--root');
  const out = arg('--out');
  const marker = arg('--marker');
  if (!root || !out || !marker) {
    process.stderr.write('usage: leak-driver-387.cjs --root ENGINE_ROOT --out RESULT_FILE --marker MARKER\n');
    process.exit(2);
  }
  const { buildMarkerSnapshot } = require('./leak-test-387.cjs');
  const { callEurekaWorkflow } = require(path.join(__dirname, '..', '..', 'lib', 'mcp', 'tools', 'eureka-graph-analyze.cjs'));
  const env = Object.assign({}, process.env);
  env.MINDRIAN_EUREKA_ROOT = root;
  const snapshot = buildMarkerSnapshot(marker);
  let result;
  try {
    result = await callEurekaWorkflow('graph.explore_local_relationships', { snapshot }, env);
  } catch (error) {
    result = { ok: false, reason: 'driver_exception', message: String(error && error.message || error) };
  }
  fs.writeFileSync(out, JSON.stringify(result === undefined ? null : result, null, 2), { mode: 0o600 });
  process.exit(result && result.ok === true ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exit(1);
});
