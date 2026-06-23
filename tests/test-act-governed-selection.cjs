'use strict';
/*
 * Phase 172-08 (CIRS R4 / INV-18 / INV-20) -- /mos:act governed-selection test.
 *
 * Asserts the one-governed-selection-brain reconciliation is registry-reflected
 * and source-fenced:
 *   Test 1: /mos:act appears in data/connector-registry.json with
 *           connects_to_spine:true (it is WIRED to the spine).
 *   Test 2: scripts/act-command.cjs source contains NO ungoverned decideFn
 *           (no `() => null` / `function () { return null; }` second selection
 *           brain).
 *   Test 3: act's decideFn references the REAL navigation-engine decide() import.
 *   Test 4: /mos:pipeline is wired-or-excluded in the coverage ledger (NOT a gap).
 *   Test 5 (INV-20 mechanized): commands/act.md references the Shape F.1 host
 *           (shape-f1-renderer.cjs OR the AskUserQuestion F.1 primitive) AND no
 *           longer carries the bespoke "yes / pick another / cancel" prose. This
 *           is a committed source-grep on act.md -- Shape F.1 is a prompt-layer
 *           AskUserQuestion primitive (Phase 88.2 invariant), so the F.1 gate
 *           lives in act.md, NOT in act-command.cjs (we do NOT assert the
 *           executor calls the renderer).
 *
 * Zero subprocess to a live Brain: pure source-grep + JSON assertions.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

console.log('test-act-governed-selection');

// ---------------------------------------------------------------------------
// Test 1: /mos:act is WIRED in the connector registry (connects_to_spine:true).
// ---------------------------------------------------------------------------
const connectorRegistry = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'data', 'connector-registry.json'), 'utf8')
);
const actConnector = (connectorRegistry.connectors || []).find(
  (c) => c && c.surface === '/mos:act'
);
ok('Test 1: /mos:act is in connector-registry.json', !!actConnector);
ok('Test 1: /mos:act connects_to_spine is true', actConnector && actConnector.connects_to_spine === true);
ok('Test 1: /mos:act reach_id is a frozen reach (context_block)',
  actConnector && actConnector.reach_id === 'context_block');

// ---------------------------------------------------------------------------
// Test 2: no ungoverned decideFn second selection brain in act-command.cjs.
// ---------------------------------------------------------------------------
const actCmdSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'act-command.cjs'), 'utf8');
// Strip line comments so doc-prose that NAMES the removed pattern (explaining it is
// gone) never trips the fence -- we assert on real CODE only, not the comments that
// document the removal.
const actCmdCode = actCmdSrc
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*\*.*$/, '').replace(/\/\/.*$/, ''))
  .join('\n');
ok('Test 2: act-command.cjs code has no `function () { return null; }` decideFn',
  actCmdCode.indexOf('function () { return null; }') === -1);
ok('Test 2: act-command.cjs code has no `() => null` decideFn assignment',
  actCmdCode.replace(/[ \t]+/g, '').indexOf('decideFn:()=>null') === -1
    && actCmdCode.replace(/[ \t]+/g, '').indexOf('=>null') === -1);

// ---------------------------------------------------------------------------
// Test 3: act feeds the REAL navigation-engine decide().
// ---------------------------------------------------------------------------
ok('Test 3: act-command.cjs requires navigation-engine.cjs',
  actCmdSrc.indexOf('navigation-engine.cjs') !== -1);
ok('Test 3: act-command.cjs references decide as the selection authority',
  /\bdecide\b/.test(actCmdSrc) && actCmdSrc.indexOf('decideFn') !== -1);
ok('Test 3: act-command.cjs loads the real decide via mod.decide',
  actCmdSrc.indexOf('mod.decide') !== -1 || actCmdSrc.indexOf('.decide') !== -1);

// ---------------------------------------------------------------------------
// Test 4: /mos:pipeline is wired-or-excluded in the coverage ledger (not gap).
// ---------------------------------------------------------------------------
const coverageLedger = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'data', 'connector-coverage-ledger.json'), 'utf8')
);
const pipelineRow = (coverageLedger.surfaces || []).find(
  (s) => s && s.surface === '/mos:pipeline'
);
ok('Test 4: /mos:pipeline is in the coverage ledger', !!pipelineRow);
ok('Test 4: /mos:pipeline is wired-or-excluded (NOT a gap)',
  pipelineRow && (pipelineRow.state === 'wired' || pipelineRow.state === 'excluded'));
// And /mos:act itself is wired in the same ledger.
const actRow = (coverageLedger.surfaces || []).find((s) => s && s.surface === '/mos:act');
ok('Test 4: /mos:act is state:wired in the coverage ledger',
  actRow && actRow.state === 'wired');

// ---------------------------------------------------------------------------
// Test 5 (INV-20): commands/act.md renders its gate on the Shape F.1 host and
// dropped the bespoke yes/pick another/cancel prose.
// ---------------------------------------------------------------------------
const actMd = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'act.md'), 'utf8');
ok('Test 5: act.md references the Shape F.1 host (shape-f1-renderer or AskUserQuestion F.1)',
  actMd.indexOf('shape-f1-renderer') !== -1
    || (actMd.indexOf('F.1') !== -1 && actMd.indexOf('AskUserQuestion') !== -1));
ok('Test 5: act.md no longer carries the bespoke "yes / pick another / cancel" prose',
  actMd.indexOf('yes / pick another / cancel') === -1);
ok('Test 5: act.md describes the intent-calibration step (INV-21)',
  /calibrat/i.test(actMd));

console.log('\nPASS (' + pass + '/' + pass + ')');
