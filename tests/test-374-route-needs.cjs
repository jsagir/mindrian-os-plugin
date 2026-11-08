#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 08, Task 1: the needs of the pair-screen capability (decision D-03).
 *
 * Arms (one line each, "ok - N<n> ..." or "FAIL - N<n> ..." at column 1):
 *   N1  needsForCall for eureka_capability_start and eureka_capability_run gives the extras mcp-server and
 *       the encoder extra, model yes, node no
 *   N2  with the probes replaced, routeGate refuses with engine_extra_missing when the encoder group is
 *       absent and passes when it is present
 *   N3  the id is not in PAIR_IDS (source check), and a response for a pair-screen job names a durable job
 *       store and no embedding cache (Pitfall 7)
 *
 * No engine is started. A fixture engine folder holds a pyproject.toml only. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const REQUIREMENTS = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-requirements.cjs');
const CONTRACT = path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs');
const ID = 'opportunity.run_pair_screen';

const SAVED = {};
const KEYS = ['HOME', 'USERPROFILE', 'MINDRIAN_EUREKA_ROOT', 'MINDRIAN_EUREKA_RS_ENCODER', 'UV_PROJECT_ENVIRONMENT'];
for (const k of KEYS) SAVED[k] = process.env[k];
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-08-needs-'));
const ENGINE = path.join(TMP, 'engine');
fs.mkdirSync(ENGINE);
fs.writeFileSync(path.join(ENGINE, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
fs.mkdirSync(path.join(ENGINE, '.venv'), { recursive: true });
fs.writeFileSync(path.join(ENGINE, '.venv', 'pyvenv.cfg'), 'home = /synthetic\n');
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_EUREKA_ROOT = ENGINE;
delete process.env.MINDRIAN_EUREKA_RS_ENCODER;
delete process.env.UV_PROJECT_ENVIRONMENT;

function cleanup() {
  try { require(CONTRACT).setProbeDeps(); } catch (_e) { /* best effort */ }
  for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

async function main() {
  const requirements = require(REQUIREMENTS);
  const contract = require(CONTRACT);

  await arm('N1', 'the pair screen needs mcp-server and the encoder extra, a model, no Node.js', async () => {
    for (const tool of ['eureka_capability_start', 'eureka_capability_run']) {
      const cell = requirements.needsForCall(tool, { capability_id: ID }, process.env);
      assert.deepEqual(cell.extras, ['mcp-server', 'modern-encoder'], tool + ' extras ' + JSON.stringify(cell.extras));
      assert.equal(cell.model, 'yes', tool + ' model');
      assert.equal(cell.node, 'no', tool + ' node');
    }
    const ref = requirements.needsForCall('eureka_capability_start', { capability_id: ID }, { MINDRIAN_EUREKA_RS_ENCODER: 'reference-bert' });
    assert.deepEqual(ref.extras, ['mcp-server', 'reference-encoder']);
  });

  await arm('N2', 'routeGate refuses with engine_extra_missing when the group is absent and passes when present', async () => {
    const absent = () => ({ venv_present: true, located: true, installed: { 'mcp-server': true, 'modern-encoder': false } });
    const present = () => ({ venv_present: true, located: true, installed: { 'mcp-server': true, 'modern-encoder': true } });
    contract.setProbeDeps({ extrasInstalled: absent });
    const refused = contract.routeGate('eureka_capability_start', { capability_id: ID }, process.env);
    assert.ok(refused, 'no refusal for the absent group');
    assert.equal(refused.reason, 'engine_extra_missing');
    assert.deepEqual(refused.needs, ['modern-encoder']);
    contract.setProbeDeps({ extrasInstalled: present });
    const passed = contract.routeGate('eureka_capability_start', { capability_id: ID }, process.env);
    assert.equal(passed, null, 'the gate refused with the group present: ' + JSON.stringify(passed));
    contract.setProbeDeps();
  });

  await arm('N3', 'the id is not in PAIR_IDS, and the response names a durable job store with no embedding cache', async () => {
    const src = fs.readFileSync(REQUIREMENTS, 'utf8');
    const pairLine = src.split('\n').find((l) => /^const PAIR_IDS = new Set\(/.test(l));
    assert.ok(pairLine, 'PAIR_IDS line not found');
    assert.ok(pairLine.indexOf(ID) === -1, 'PAIR_IDS holds the pair-screen id');
    assert.ok(/^const PAIR_SCREEN_IDS = new Set\(\[/m.test(src), 'PAIR_SCREEN_IDS is not defined');
    const r = contract.response({ ok: true, capability_id: ID, job_id: 'job-1', persistence: 'eureka_job_store_only' }, false);
    assert.equal(r.structuredContent.derived_cache_persistence, 'none');
    assert.equal(r.structuredContent.engine_state_persistence, 'durable_local_job_store');
  });

  cleanup();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { process.stdout.write('FAIL - N0 ' + String(e && e.message) + '\n'); cleanup(); process.exit(1); });
