#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 09 Task 1 -- the opt-in live smoke (SRM364-07, NV-2). layer: harness
 *
 * Opt-in only: without MOS_364_LIVE=1 this prints
 * `SKIPPED (opt-in, MOS_364_LIVE unset)` and exits 77. It never reports a pass
 * without having really run.
 *
 * With MOS_364_LIVE=1 it keeps the REAL HOME (the Brain token lives in
 * ~/.mindrian.env), points MINDRIAN_ROOMS_HOME at a mkdtemp dir, touches no
 * room, and makes the two real read-only Theo calls the command makes
 * (framework_step for the one SR handle, recommend_chain for the WellDefined
 * enum) through the real guarded client. It passes when:
 *   - the step read is either the exact honest refusal ("Theo has not authored
 *     this step yet") or exactly seven runnable steps with non-empty labels, and
 *   - the coverage read is covered or uncovered, and
 *   - the real Part 8 guard classifies the handle as known_tool_shape.
 * An unreachable Brain, a keyless session or a refused call is an ENV GAP: the
 * typed reason is printed and the exit is 77 (never a pass). Any other shape is
 * a real defect: exit 1.
 * Prints one `LIVE_METRICS {...}` JSON line (latency in ms, step count, statuses).
 *
 * The navigator approves the live run at close-out (364-11); no other plan runs it.
 * Exit 0 pass, 1 fail, 77 skipped or ENV GAP. Hyphens only, no emoji.
 */

if (process.env.MOS_364_LIVE !== '1') {
  console.log('SKIPPED (opt-in, MOS_364_LIVE unset)');
  process.exit(77);
}

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The real HOME stays (the Brain token). Rooms go to a scratch dir; no room is opened.
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-live-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const C = hygiene.makeChecker('364-09 live Theo smoke');

const steps = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'sr-steps.cjs'));
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));

const ENV_GAP_REASONS = ['call_threw', 'brain_unavailable', 'egress_blocked', 'refused', 'theo_refusal', 'no_rows', 'unavailable'];

function ms(startNs) { return Number(process.hrtime.bigint() - startNs) / 1e6; }

async function main() {
  const t0 = process.hrtime.bigint();
  const stepRead = await steps.readSrSteps({});
  const stepMs = ms(t0);
  const t1 = process.hrtime.bigint();
  const coverage = await steps.readCoverage({});
  const covMs = ms(t1);

  const metrics = {
    step_latency_ms: Math.round(stepMs),
    coverage_latency_ms: Math.round(covMs),
    step_ok: stepRead.ok === true,
    step_reason: stepRead.ok === true ? null : stepRead.reason,
    step_count: stepRead.ok === true ? stepRead.steps.length : 0,
    framework_status: stepRead.ok === true ? stepRead.framework_status : null,
    coverage_status: coverage.status,
    coverage_reason: coverage.reason || null,
  };
  console.log('LIVE_METRICS ' + JSON.stringify(metrics));

  const cls = guard.classify({ framework: steps.HANDLE }, { toolName: 'framework_step' });
  C.check('L1 the real guard classifies the SR handle as known_tool_shape', cls && cls.class === 'known_tool_shape', JSON.stringify(cls));
  const clsChain = guard.classify({ problem_type: steps.COVERAGE_PROBLEM_TYPE, max_steps: 6 }, { toolName: 'recommend_chain' });
  C.check('L1 the real guard classifies the WellDefined read as known_tool_shape', clsChain && clsChain.class === 'known_tool_shape', JSON.stringify(clsChain));

  const gap = (stepRead.ok !== true && ENV_GAP_REASONS.indexOf(stepRead.reason) !== -1) || coverage.status === 'unavailable';
  if (gap) {
    console.log('ENV GAP: the live Theo read was not served (step reason ' + String(metrics.step_reason) + ', coverage ' + String(coverage.status) + '); not a pass');
    process.exit(77);
  }

  const refused = stepRead.ok !== true && stepRead.reason === 'step_unauthored' && stepRead.message === steps.REFUSAL_TEXT;
  const seven = stepRead.ok === true && Array.isArray(stepRead.steps) && stepRead.steps.length === 7
    && stepRead.steps.every(function (s) { return typeof s.label === 'string' && s.label.trim().length > 0 && typeof s.runIt === 'string' && s.runIt.trim().length > 0; });
  C.check('L1 the live step read is the exact honest refusal or seven runnable authored steps', refused || seven, JSON.stringify(metrics));
  C.check('L1 the coverage read is covered or uncovered', coverage.status === 'covered' || coverage.status === 'uncovered', String(coverage.status));
  process.exit(C.summary());
}

main().catch(function (e) {
  console.log('FAIL: unexpected error ' + (e && e.stack || e));
  process.exit(1);
});
