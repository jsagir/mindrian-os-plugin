#!/usr/bin/env node
// Phase 199-01 -- agentshield adapters: the 5 gatherers + runAgentShieldScan()
// orchestrator contract + the Part-6 dog-food live self-scan (AS-03 / AS-04).
//
// WAVE 0 CONTRACT: authored before the orchestrator lands (Nyquist). It requires
// lib/core/security/agentshield-run.cjs inside a try/catch; while the module is
// absent it prints a SKIP line and exits 0. The moment 199-04 lands the gatherers
// + orchestrator, every assertion below becomes binding.
//
// gatherer contract: each of the 5 static-config gatherers is exported and returns
//   an array of { surface, id, target } entries (surface = the scanSurface surface
//   type, id = a stable slug for the gathered item, target = what scanSurface reads).
// orchestrator contract: runAgentShieldScan(opts) returns
//   { scannedAt, surfaces: { <surface>: { verdict, findingCount } },
//     totalFlagged, totalAmbiguous, findings: [ ... ] }.
//
// AS-04 dog-food (Part 6): a LIVE self-scan of THIS MindrianOS-Plugin repo (real
// files, no fixtures) returns ZERO 'flagged' verdicts across every surface -- the
// shipped codebase's own hooks / skills / CLAUDE.md / package.json are already
// clean before any CVE-DB rule can retroactively indict them.
//
// Zero-dep: plain node assert. CJS only. No em-dashes.

'use strict';

const assert = require('assert');

let run;
try {
  run = require('./agentshield-run.cjs');
} catch (_e) {
  console.log('SKIP: agentshield-run.cjs not present (Wave 0) -- inert until 199-04 lands the gatherers + orchestrator');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// AS-03: the 5 static-config gatherers. Each is exported, each returns an array,
// and every entry (when present) carries the { surface, id, target } shape.
// ---------------------------------------------------------------------------
const GATHERERS = [
  'gatherMcpToolDescriptions',
  'gatherHookCommands',
  'gatherSkillFiles',
  'gatherClaudeMdPermissions',
  'gatherSupplyChainTargets',
];

(function as03_gatherers() {
  GATHERERS.forEach(function (name) {
    const fn = run[name];
    assert.strictEqual(typeof fn, 'function', 'AS-03: agentshield-run must export ' + name + '()');
    const entries = fn();
    assert.ok(Array.isArray(entries), 'AS-03: ' + name + '() must return an array');
    entries.forEach(function (e, idx) {
      assert.ok(e && typeof e === 'object', 'AS-03: ' + name + ' entry ' + idx + ' is an object');
      assert.ok(typeof e.surface === 'string' && e.surface.length > 0,
        'AS-03: ' + name + ' entry ' + idx + ' carries a surface slug');
      assert.ok(typeof e.id === 'string' && e.id.length > 0,
        'AS-03: ' + name + ' entry ' + idx + ' carries a stable id slug');
      assert.ok('target' in e, 'AS-03: ' + name + ' entry ' + idx + ' carries a target');
    });
  });
})();

// ---------------------------------------------------------------------------
// AS-03: runAgentShieldScan(opts) orchestrator return shape.
// ---------------------------------------------------------------------------
(function as03_orchestrator() {
  assert.strictEqual(typeof run.runAgentShieldScan, 'function',
    'AS-03: agentshield-run must export runAgentShieldScan()');
  const report = run.runAgentShieldScan();
  assert.ok(report && typeof report === 'object', 'AS-03: runAgentShieldScan returns a report object');
  assert.ok('scannedAt' in report, 'AS-03: report carries scannedAt');
  assert.ok(report.surfaces && typeof report.surfaces === 'object', 'AS-03: report carries a surfaces map');
  assert.strictEqual(typeof report.totalFlagged, 'number', 'AS-03: report carries a numeric totalFlagged');
  assert.strictEqual(typeof report.totalAmbiguous, 'number', 'AS-03: report carries a numeric totalAmbiguous');
  assert.ok(Array.isArray(report.findings), 'AS-03: report carries a findings array');
  Object.keys(report.surfaces).forEach(function (s) {
    const entry = report.surfaces[s];
    assert.ok(entry && typeof entry === 'object', 'AS-03: surfaces.' + s + ' is an object');
    assert.ok(['clean', 'flagged', 'ambiguous'].indexOf(entry.verdict) !== -1,
      'AS-03: surfaces.' + s + '.verdict is a valid verdict');
    assert.strictEqual(typeof entry.findingCount, 'number', 'AS-03: surfaces.' + s + '.findingCount is numeric');
  });
})();

// ---------------------------------------------------------------------------
// AS-04 (Part 6 dog-food): a LIVE self-scan of this repo returns ZERO flagged
// verdicts across every surface. The shipped plugin honors its own security
// canon before any rule can retroactively indict it. A flagged self-scan is a
// CONTRADICTS edge against the plugin and MUST fail this gate.
// ---------------------------------------------------------------------------
(function as04_dogfood() {
  const report = run.runAgentShieldScan();
  assert.strictEqual(report.totalFlagged, 0,
    'AS-04: live self-scan of MindrianOS-Plugin must report ZERO flagged findings (Part 6 dog-food)');
  Object.keys(report.surfaces).forEach(function (s) {
    assert.notStrictEqual(report.surfaces[s].verdict, 'flagged',
      'AS-04: surface ' + s + ' must not be flagged in the shipped repo self-scan');
  });
})();

console.log('PASS: agentshield adapters -- 5 gatherers + orchestrator + dog-food self-scan (AS-03/04) green');
process.exit(0);
