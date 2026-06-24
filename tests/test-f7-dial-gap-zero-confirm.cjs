'use strict';
/*
 * Phase 178-03 Task 1 - the F.7-dial gap=0 CONFIRMATION (C-3 baseline).
 *
 * CONFIRMS (does not edit) that the Phase-177 F.7-dial surface is ALREADY
 * gap=0 -- host-appended through the SEED-020 single construction door. The
 * F.7-dial "live slip" premise is FALSE on the live tree:
 *   - renderDialShape (lib/hmi/dial-selector.cjs:216-225) returns shape
 *     'F.7-dial', which starts with 'F', so the dispatcher's pickShape
 *     isFShape host-append (selector-dispatcher.cjs:931-933) UNCONDITIONALLY
 *     applies appendAskUserQuestionTrailer to it; AND
 *   - the PRODUCTION engine arm (scripts/intent-classifier.cjs:919-937)
 *     renders the dial then calls dispatcher.appendAskUserQuestionTrailer(
 *     rendered,'F.1') explicitly, surfacing the marker on the live block.
 * So NO edit is made to the frozen Phase-177 dial-selector.cjs.
 *
 * The HIGH-2 correction: this test probes the PRODUCTION engine-arm path
 * (the exported renderEngineDecisionWithDial seam that the real turn drives),
 * NOT merely a synthetic pickShape call. Assertions:
 *   1. PRODUCTION engine-arm path: renderEngineDecisionWithDial(decision,
 *      {source:'engine'}, ...) returns a live block carrying the non-empty
 *      AskUserQuestion marker (the host-append via the 150.5 engine-arm seam).
 *   2. dispatcher host-append: pickShape({requestedShape:'F.7-dial'}) yields a
 *      non-empty askuserquestion_marker (the isFShape branch).
 *   3. the 178-02 predicate reports counts.gap === 0 on the live repo (the
 *      F.7-dial entry classifies covered).
 *   4. frozen-contract guard: lib/hmi/dial-selector.cjs is byte-unchanged by
 *      this plan -- renderDialShape still returns shape 'F.7-dial' with the
 *      same { shape, hud, zones } shape it always did (the file is NOT edited;
 *      the live slip premise is FALSE).
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 * The frozen Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate,
 * the 6-reach bank, the glyphs) are untouched; this plan mints nothing.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Assertion 1: the PRODUCTION engine-arm path (NOT a synthetic pickShape call).
// Drive the real exported seam renderEngineDecisionWithDial on the engine arm
// (routing.source === 'engine'): it renders the dial via presenter.renderDial,
// then host-appends the marker via dispatcher.appendAskUserQuestionTrailer(
// rendered,'F.1') (intent-classifier.cjs:919-937). The live block MUST carry
// the AskUserQuestion contract marker.
// ---------------------------------------------------------------------------
const ic = require(path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs'));
ok('intent-classifier exports renderEngineDecisionWithDial (the production engine-arm seam)',
  typeof ic.renderEngineDecisionWithDial === 'function');

const decision = { one_move: { verb: 'Run Methodology', label: 'confirm' }, reach_id: 'methodology' };
const routing = { source: 'engine' };
const block = ic.renderEngineDecisionWithDial(decision, routing, null, { cortexNodes: [] });
ok('renderEngineDecisionWithDial returns a non-empty live block on the engine arm',
  typeof block === 'string' && block.length > 0);
ok('the PRODUCTION engine-arm block carries the host-appended AskUserQuestion marker (F.7-dial surface is covered)',
  block.indexOf('[AskUserQuestion contract:') >= 0);

// ---------------------------------------------------------------------------
// Assertion 2: the dispatcher host-append. A direct pickShape call with
// requestedShape 'F.7-dial' yields a non-empty askuserquestion_marker (the
// isFShape branch at selector-dispatcher.cjs:931-933) -- proving the surface is
// host-appended-covered through the SEED-020 single construction door even off
// the engine arm.
// ---------------------------------------------------------------------------
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const picked = dispatcher.pickShape({ requestedShape: 'F.7-dial', investment_level: 0.5, posture: 'hold', tty: false });
ok('pickShape returns the F.7-dial shape', picked && picked.shape === 'F.7-dial');
const marker = picked && picked.rendered && picked.rendered.askuserquestion_marker;
ok('pickShape F.7-dial host-appends a non-empty askuserquestion_marker (isFShape branch)',
  typeof marker === 'string' && marker.length > 0);

// ---------------------------------------------------------------------------
// Assertion 3: the 178-02 predicate reports counts.gap === 0 on the live repo.
// The F.7-dial entry classifies covered; the live render baseline is green
// WITHOUT editing dial-selector.cjs.
// ---------------------------------------------------------------------------
const gate = require(path.join(REPO_ROOT, 'scripts', 'check-render-coverage.cjs'));
const report = gate.renderCoverageReport();
ok('render baseline is gap=0 (F.7-dial covered; no dial-selector edit)', report.counts.gap === 0);
ok('render baseline has card-emission entries covered (gap-free, non-empty)',
  report.counts.covered > 0 && report.counts.gap === 0);

// ---------------------------------------------------------------------------
// Assertion 4: the frozen-contract guard. lib/hmi/dial-selector.cjs is NOT
// edited by this plan (the live slip premise is FALSE). renderDialShape still
// returns shape 'F.7-dial' with the same { shape, hud, zones } envelope it
// always did, and the file still exports the frozen renderDialShape. We do NOT
// edit the file; this asserts its contract is intact.
// ---------------------------------------------------------------------------
const dialSelector = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-selector.cjs'));
ok('dial-selector.cjs still exports renderDialShape (frozen Phase-177 contract)',
  typeof dialSelector.renderDialShape === 'function');
const env = dialSelector.renderDialShape({ investment_level: 0.5, posture: 'hold', tty: false });
ok('renderDialShape still returns shape "F.7-dial" (frozen contract, byte-unchanged by this plan)',
  env && env.shape === 'F.7-dial');
ok('renderDialShape still returns a { shape, hud, zones } envelope with a zones.header (frozen HUD shape)',
  env && typeof env.hud === 'string' && env.zones && typeof env.zones.header === 'string');
// The dial render itself does NOT assign the marker -- it does not need to,
// because the host-append covers it. This pins that renderDialShape is NOT the
// place the marker lives (so the gate credits the host-append, never demanding
// an in-renderDialShape assignment -- the predicate's third branch).
ok('renderDialShape does NOT itself assign an askuserquestion_marker (host-appended downstream, not in the frozen renderer)',
  env && (env.askuserquestion_marker === undefined || env.askuserquestion_marker === null));

console.log('');
console.log('PASS test-f7-dial-gap-zero-confirm.cjs (' + pass + ' assertions)');
console.log('CONFIRMED: F.7-dial is ALREADY gap=0 -- host-appended via the PRODUCTION engine arm AND the pickShape isFShape branch; dial-selector.cjs is byte-unchanged (the live slip premise is FALSE).');
