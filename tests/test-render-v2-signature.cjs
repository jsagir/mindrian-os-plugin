#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-01 -- render-v2 signature contract test.
 *
 * IIFE harness with 5 assertions per Plan 102-01 §Task 3:
 *
 *   1. extended:           render-v2 accepts the destructured 8-arg
 *                          envelope and returns { rendered, contract }.
 *   2. v1_shim:            lib/render/render.cjs.render(zones, mode, op, tier)
 *                          returns a string and matches the legacy
 *                          4-arg positional signature.
 *   3. defensive_defaults: missing args (zones only, even none) renders
 *                          without throwing.
 *   4. just_talk_suppress: operator='JUST_TALK' returns
 *                          { rendered: '', contract: { suppressed: true,
 *                          reason: 'just-talk' } }.
 *   5. methodology_no_zone4: operator='METHODOLOGY' with no
 *                            body.endingSignal strips Zone 4 footer
 *                            from the composed output.
 *
 * Exit 0 on full pass; exit 1 on any failure.
 *
 * Pure CJS, node built-ins only, zero new runtime deps (Phase 87 invariant).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const V2_PATH = path.join(REPO_ROOT, 'lib', 'render', 'render-v2.cjs');
const V1_PATH = path.join(REPO_ROOT, 'lib', 'render', 'render.cjs');

const v2 = require(V2_PATH);
const v1 = require(V1_PATH);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// 1. extended: render-v2 accepts all 8 args; returns {rendered, contract}.
// ---------------------------------------------------------------------------
(function test1_extended() {
  const label = 'extended: render-v2 accepts 8-arg envelope -> {rendered, contract}';
  try {
    const out = v2.render({
      zones: { header: '-- hdr --', body: 'body-text', signals: ['s1', 's2'], footer: 'foot' },
      mode: 'A',
      operator: 'BUILD_ROOM',
      tier: 1,
      jtbd: 'find-bottleneck',
      tokenBudget: { used: 100, total: 1000 },
      roomDir: '/tmp/test-room',
      provenance: { graphQuery: 'q', confidence: 0.9, frameworks: ['rs-fetch'] },
    });
    assert.equal(typeof out, 'object', 'returns an object');
    assert.equal(typeof out.rendered, 'string', 'rendered is a string');
    assert.ok(out.contract && typeof out.contract === 'object', 'contract is an object');
    assert.ok(out.rendered.indexOf('-- hdr --') !== -1, 'header in output');
    assert.ok(out.rendered.indexOf('body-text') !== -1, 'body in output');
    assert.ok(out.rendered.indexOf('▷ s1') !== -1, 'signals prefixed with ▷');
    assert.ok(out.rendered.indexOf('foot') !== -1, 'footer in output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 2. v1_shim: legacy 4-arg signature returns string.
// ---------------------------------------------------------------------------
(function test2_v1Shim() {
  const label = 'v1_shim: render(zones, mode, op, tier) returns string';
  try {
    const out = v1.render(
      { header: '-- hdr --', body: 'b', footer: 'f' },
      'A',
      'BUILD_ROOM',
      1
    );
    assert.equal(typeof out, 'string', 'v1 shim returns a string');
    assert.ok(out.indexOf('-- hdr --') !== -1, 'header in v1 output');
    assert.ok(out.indexOf('b') !== -1, 'body in v1 output');
    assert.ok(out.indexOf('f') !== -1, 'footer in v1 output');

    // v1 callers passing legacy positional args must not see the
    // v2 envelope leak through (no `.contract`, no `.rendered` keys).
    assert.ok(out.indexOf('contract') === -1, 'v1 shim does not leak contract');
    assert.ok(out.indexOf('[object') === -1, 'v1 shim does not [object Object]-stringify');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 3. defensive_defaults: missing args render without throwing.
// ---------------------------------------------------------------------------
(function test3_defensiveDefaults() {
  const label = 'defensive_defaults: missing args do not throw';
  try {
    // Empty envelope.
    const out1 = v2.render({});
    assert.equal(typeof out1.rendered, 'string', 'empty envelope -> string');

    // Zones only.
    const out2 = v2.render({ zones: { header: 'h-only' } });
    assert.ok(out2.rendered.indexOf('h-only') !== -1, 'zones-only renders header');

    // Truly nothing (undefined args).
    const out3 = v2.render();
    assert.equal(typeof out3.rendered, 'string', 'no args -> string');
    assert.equal(out3.rendered, '', 'no args -> empty string');

    // v1 shim with nothing in zones.
    const out4 = v1.render({}, 'A', null, 1);
    assert.equal(typeof out4, 'string', 'v1 shim no-zones -> string');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 4. just_talk_suppress: operator='JUST_TALK' suppresses output.
// ---------------------------------------------------------------------------
(function test4_justTalkSuppress() {
  const label = 'just_talk_suppress: JUST_TALK -> {rendered:"", contract:{suppressed,reason}}';
  try {
    const out = v2.render({
      zones: { header: 'h', body: 'b', footer: 'f' },
      operator: 'JUST_TALK',
      tier: 1,
    });
    assert.equal(out.rendered, '', 'JUST_TALK rendered === ""');
    assert.ok(out.contract && typeof out.contract === 'object', 'contract present');
    assert.equal(out.contract.suppressed, true, 'contract.suppressed === true');
    assert.equal(out.contract.reason, 'just-talk', 'contract.reason === "just-talk"');

    // v1 shim should also suppress when JUST_TALK flows through.
    const v1out = v1.render({ header: 'h', body: 'b' }, 'A', 'JUST_TALK', 1);
    assert.equal(v1out, '', 'v1 shim returns "" for JUST_TALK');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 5. methodology_no_zone4: operator='METHODOLOGY' + no body.endingSignal
//    strips Zone 4 footer from the composed output.
// ---------------------------------------------------------------------------
(function test5_methodologyNoZone4() {
  const label = 'methodology_no_zone4: METHODOLOGY mid-session strips footer';
  try {
    // Body is an object WITHOUT endingSignal -> footer stripped.
    const out1 = v2.render({
      zones: {
        header: 'methodology-header',
        body: { text: 'mid-session-body' },
        footer: 'should-be-stripped',
      },
      operator: 'METHODOLOGY',
      tier: 1,
    });
    assert.ok(
      out1.rendered.indexOf('methodology-header') !== -1,
      'header still present'
    );
    assert.ok(
      out1.rendered.indexOf('mid-session-body') !== -1,
      'body still present'
    );
    assert.ok(
      out1.rendered.indexOf('should-be-stripped') === -1,
      'footer stripped from METHODOLOGY mid-session'
    );

    // Body WITH endingSignal -> footer survives (gate ends).
    const out2 = v2.render({
      zones: {
        header: 'h',
        body: { text: 'b', endingSignal: true },
        footer: 'should-survive',
      },
      operator: 'METHODOLOGY',
      tier: 1,
    });
    assert.ok(
      out2.rendered.indexOf('should-survive') !== -1,
      'footer survives when body.endingSignal === true'
    );

    // Caller's zones object is NOT mutated by the renderer.
    const callerZones = {
      header: 'h',
      body: 'b',
      footer: 'caller-footer',
    };
    v2.render({ zones: callerZones, operator: 'METHODOLOGY', tier: 1 });
    assert.equal(
      callerZones.footer,
      'caller-footer',
      'renderer must not mutate caller zones'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Summary + exit code.
// ---------------------------------------------------------------------------
process.stdout.write('\n');
process.stdout.write(
  'Phase 102-01 render-v2 signature: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
