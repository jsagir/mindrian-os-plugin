#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 13, Task 2 (E16, E17, threat T-374-59): the Eureka job tool descriptions say what the earlier plans
 * built. The model reads these sentences to decide what to call, so each behaviour sentence is pinned here.
 *
 * Gate lines read at the start of plan 374-13: ACT OD-2 ADD-FORGET-TOOL, OD-3 TOPK-200, OD-4 USER-DIR,
 * OD-5A F6, OD-5B SCREEN, OD-6 ENGINE-BUSY-GUARD, OD-7 PAGE-ARG. Every arm applies.
 *
 * Arms (one line each at column 1: "ok - D<n> ...", "FAIL - D<n> ..." or "skip - D<n> <reason>"):
 *   D1  start: a catalogued background job; the pair screen first call only plans and returns a card; the run
 *       starts only after the person answers; the record is kept 30 days; the run needs a local meaning model
 *   D2  status, result, cancel: a finished job reads again after a host restart; a job running at the restart may
 *       read as failed; the run does not resume; cancel is unavailable for a recovered job; the old no-resume and
 *       unknown-job sentences are gone; result names the page argument, the 256 KiB rule, the 30 minute page
 *       cache, job_result_page_expired and page_out_of_range
 *   D3  start and run: while a job runs other Eureka calls answer engine_busy; one host process only
 *   D4  run: the sync tool refuses the pair screen and points to eureka_capability_start
 *   D5  scout: the top_k range is 1 to 200, equal to the cap in the schema
 *   D6  forget: confirm true, a finished run only, only after the person asks, cannot be undone, cancel first
 *   D7  no en dash or em dash in a description; 76 tools; net growth of the tools/list bytes at most 3,000
 *
 * The sentences are read from the tools as registered (a recording fake server). CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));
const scout = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-graph-opportunity-scout.cjs'));
const pairScreen = require(path.join(REPO, 'lib', 'mcp', 'eureka-pair-screen.cjs'));

// The BEFORE of plan 374-13 (HEAD 1acb2f39, measured 2026-11-08): 75 tools, 83855 total bytes.
const BEFORE_TOTAL = 83855;
const GROWTH_MAX = 3000;

const tools = new Map();
const server = { registerTool(name, config) { tools.set(name, config); } };
run.register(server);
jobs.register(server, { surface: 'cli' });
scout.register(server, { surface: 'cli' });
function desc(name) {
  const cfg = tools.get(name);
  assert.ok(cfg, name + ' is not registered');
  return String(cfg.description);
}
function has(text, needle, label) { assert.ok(text.indexOf(needle) !== -1, (label || 'text') + ' lacks: ' + needle); }
function lacks(text, needle, label) { assert.ok(text.indexOf(needle) === -1, (label || 'text') + ' still holds: ' + needle); }

let failed = 0;
async function chk(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    if (err && err.skip) { process.stdout.write('skip - ' + id + ' ' + err.skip + '\n'); return; }
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

async function main() {
  await chk('D1', 'start: pair screen plans first, the run needs a yes, 30 days, local meaning model', async () => {
    const d = desc('eureka_capability_start');
    has(d, 'opportunity.run_pair_screen', 'start');
    has(d, 'awaiting_approval', 'start');
    has(d, 'only after the person', 'start');
    has(d, '30 days', 'start');
    has(d, 'local meaning model', 'start');
    lacks(d, 'Jobs cannot resume after the MindrianOS MCP process restarts', 'start');
  });

  await chk('D2', 'status, result, cancel: restart recovery and its limit, paging', async () => {
    const status = desc('eureka_capability_job_status');
    const result = desc('eureka_capability_job_result');
    const cancel = desc('eureka_capability_job_cancel');
    for (const [name, text] of [['status', status], ['result', result], ['cancel', cancel]]) {
      lacks(text, 'Jobs cannot resume after', name);
      lacks(text, 'is unknown to this host session', name);
      has(text, 'does not resume', name);
    }
    has(status, 'after a host restart', 'status');
    has(status, 'server_restarted', 'status');
    has(result, 'after a host restart', 'result');
    has(result, 'server_restarted', 'result');
    has(cancel, 'cancel_unavailable_after_restart', 'cancel');
    has(result, 'page', 'result');
    has(result, '256 KiB', 'result');
    has(result, '30 minutes', 'result');
    has(result, 'job_result_page_expired', 'result');
    has(result, 'page_out_of_range', 'result');
    assert.ok(Object.keys(tools.get('eureka_capability_job_result').inputSchema.shape).includes('page'), 'the result schema has no page');
  });

  await chk('D3', 'start and run: other Eureka calls answer engine_busy while a job runs', async () => {
    for (const name of ['eureka_capability_start', 'eureka_capability_run']) {
      const d = desc(name);
      has(d, 'engine_busy', name);
      has(d, 'one MindrianOS host process', name);
    }
  });

  await chk('D4', 'run: the sync tool refuses the pair screen', async () => {
    const d = desc('eureka_capability_run');
    has(d, 'opportunity.run_pair_screen', 'run');
    has(d, 'capability_requires_approval', 'run');
    has(d, 'eureka_capability_start', 'run');
  });

  await chk('D5', 'scout: the top_k range is 1 to 200 and equals the schema cap', async () => {
    const d = desc('eureka_graph_opportunity_scout');
    has(d, 'top_k', 'scout');
    has(d, '1 to 200', 'scout');
    assert.equal(pairScreen.TOP_K_MAX, 200);
    const field = tools.get('eureka_graph_opportunity_scout').inputSchema.shape.top_k;
    assert.equal(field.safeParse(200).success, true);
    assert.equal(field.safeParse(201).success, false);
  });

  await chk('D6', 'forget: confirm true, a finished run only, only after the person asks, no undo, cancel first', async () => {
    const d = desc('eureka_capability_job_forget');
    has(d, 'confirm true', 'forget');
    has(d, 'finished', 'forget');
    has(d, 'only after the person asks', 'forget');
    has(d, 'cannot be undone', 'forget');
    has(d, 'cancel it first', 'forget');
    has(d, 'server_restarted', 'forget');
  });

  await chk('D7', 'no en or em dash; 76 tools; net growth of tools/list bytes at most 3,000', async () => {
    for (const [name, cfg] of tools) {
      assert.ok(!new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(cfg.description), name + ' holds an en or em dash');
      assert.ok(!/[^\x20-\x7e]/.test(cfg.description), name + ' holds a non-ASCII character');
    }
    const out = cp.spawnSync(process.execPath, [path.join(REPO, 'tests', 'test-270-tool-schema-budget.cjs')], { encoding: 'utf8', timeout: 90000 });
    const line = String(out.stdout).split('\n').find((l) => l.indexOf('budget:') === 0) || '';
    const m = /^budget: (\d+) tools, (\d+) desc bytes, (\d+) schema bytes, (\d+) total/.exec(line);
    assert.ok(m, 'no budget line: ' + line);
    assert.equal(Number(m[1]), 76, 'tool count ' + m[1]);
    const growth = Number(m[4]) - BEFORE_TOTAL;
    assert.ok(growth <= GROWTH_MAX, 'net growth ' + growth + ' bytes is above ' + GROWTH_MAX);
  });

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { process.stdout.write('FAIL - D0 ' + String((e && e.stack) || e) + '\n'); process.exit(1); });
