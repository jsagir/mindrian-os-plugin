#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261019-gct -- behavior pin for the framework_step step_id arm of
 * lib/core/part8-egress-guard.cjs.
 *
 * WHY THIS FILE EXISTS: Theo Phase 42/45 widened PROCESS_STEP_ID_PATTERN with
 * phase42:: ids, export13- ids (16 lowercase hex) and a 160-character cap on
 * the whole id. The plugin copy (PROCESS_STEP_ID_RE) drifted. The framework_step
 * arm then refused real Theo step ids and allowed a 161-character id that Theo
 * refuses. tests/test-361-theo-parity.cjs Leg 3b pins the BYTES of the copy;
 * this file pins the BEHAVIOR through guard.classify, so a green byte pin cannot
 * hide a wrong arm.
 *
 * LEGS:
 *   A0-A5 -- allowed: no step_id, a classic id, a phase42 framework id, a
 *            phase42 command id, an export13 id, a 160-character classic id.
 *            Each must return verdict allow, class known_tool_shape.
 *   R1-R5 -- refused: a synthetic person name, free text, export13 with 15 hex,
 *            a 161-character classic id, and four edge shapes. Each must not
 *            be allow, must not carry class known_tool_shape, and
 *            _proveKnownToolShape must return null.
 *   P     -- read-only: when the Theo vocabulary.ts is readable, Theo's own
 *            regex agrees with every row of the case table. When it is not
 *            readable, Leg P is SKIPPED and the other legs still decide.
 *   N     -- no network call happened (fetch is replaced before the guard loads).
 *
 * Exit 0 -> PASSED. Exit 1 -> FAILED (every failing check is listed).
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('fs');
const path = require('path');

// --- Test hygiene: no network egress from this test -------------------------
let networkAttempted = false;
globalThis.fetch = function _blockedFetch() {
  networkAttempted = true;
  process.stderr.write('NETWORK_ATTEMPT_GCT\n');
  throw new Error('NETWORK_ATTEMPT_GCT: fetch is blocked in tests/test-gct-process-step-id-parity.cjs');
};

const GUARD = path.join(__dirname, '..', 'lib', 'core', 'part8-egress-guard.cjs');
const guard = require(GUARD);

const TOOL = 'mcp__plugin_mos_mindrian-brain__framework_step';
const FRAMEWORK = 'Dominant Design';

let checks = 0;
let failures = 0;
function ok(label, cond, detail) {
  checks++;
  if (cond) {
    console.log('PASS ' + label);
  } else {
    failures++;
    console.log('FAIL ' + label + (detail ? ' :: ' + detail : ''));
  }
}

// 160 and 161 character classic ids: 64 x, '::', 64 y, '-', N z, '::s01'.
function classicId(zCount) {
  return 'x'.repeat(64) + '::' + 'y'.repeat(64) + '-' + 'z'.repeat(zCount) + '::s01';
}
const ID_160 = classicId(24);
const ID_161 = classicId(25);
ok('setup: A5 id length is 160', ID_160.length === 160, 'length ' + ID_160.length);
ok('setup: R4 id length is 161', ID_161.length === 161, 'length ' + ID_161.length);

const CASES = [
  { label: 'A0 no step_id', absent: true, want: 'allow' },
  { label: 'A1 classic id', step_id: 'dominantdesign::phase::s01', want: 'allow' },
  { label: 'A2 phase42 framework id', step_id: 'phase42::framework::12-leverage-points::rank-intervention-sites', want: 'allow' },
  { label: 'A3 phase42 command id', step_id: 'phase42::command::mos-act::calibrate-what-you-want', want: 'allow' },
  { label: 'A4 export13 id (16 hex)', step_id: 'export13-1203ff397699a1c5', want: 'allow' },
  { label: 'A5 160-char classic id', step_id: ID_160, want: 'allow' },
  { label: 'R1 person name', step_id: 'Marrowby Pell', want: 'refuse' },
  { label: 'R2 free text', step_id: 'how should we price the pilot for our first customer', want: 'refuse' },
  { label: 'R3 export13 with 15 hex', step_id: 'export13-1203ff397699a1c', want: 'refuse' },
  { label: 'R4 161-char classic id', step_id: ID_161, want: 'refuse' },
  { label: 'R5a export13 with 17 hex', step_id: 'export13-1203ff397699a1c5f', want: 'refuse' },
  { label: 'R5b export13 upper case hex', step_id: 'export13-1203FF397699A1C5', want: 'refuse' },
  { label: 'R5c phase42 unknown kind', step_id: 'phase42::venture::foo::bar', want: 'refuse' },
  { label: 'R5d phase42 empty hyphen part', step_id: 'phase42::framework::adaptive--leadership::decide', want: 'refuse' },
];

function payloadOf(c) {
  return c.absent ? { framework: FRAMEWORK } : { framework: FRAMEWORK, step_id: c.step_id };
}

for (const c of CASES) {
  const payload = payloadOf(c);
  const r = guard.classify(payload, { toolName: TOOL });
  const proof = guard._proveKnownToolShape(payload, TOOL);
  const scan = guard.scanForContent(payload);
  const detail = JSON.stringify(r);
  ok(c.label + ': content scan has no hit (the arm decides, not the scan)', scan && scan.hit === false, JSON.stringify(scan));
  if (c.want === 'allow') {
    ok(c.label + ': verdict allow', r && r.verdict === 'allow', detail);
    ok(c.label + ': class known_tool_shape', r && r.class === 'known_tool_shape', detail);
    ok(
      c.label + ': reason framework_step canonical framework handle',
      r && r.reason === 'framework_step canonical framework handle',
      detail
    );
  } else {
    ok(c.label + ': verdict is not allow', r && r.verdict !== 'allow', detail);
    ok(c.label + ': class is not known_tool_shape', r && r.class !== 'known_tool_shape', detail);
    ok(c.label + ': _proveKnownToolShape returns null', proof === null, JSON.stringify(proof));
  }
}

// --- Leg P: Theo's own regex agrees with the case table (read-only) ---------
function extractPatternLiteral(text, marker) {
  const at = text.indexOf(marker);
  if (at === -1) return null;
  const eq = text.indexOf('=', at);
  if (eq === -1) return null;
  const semi = text.indexOf(';', eq);
  if (semi === -1) return null;
  return text.slice(eq + 1, semi).trim();
}

(function legP() {
  try {
    const theoRoot = process.env.MINDRIAN_THEO_CHECKOUT || '/home/jsagi/Theo';
    const text = fs.readFileSync(path.join(theoRoot, 'src', 'mcp', 'content', 'vocabulary.ts'), 'utf8');
    const literal = extractPatternLiteral(text, 'export const PROCESS_STEP_ID_PATTERN');
    if (!literal) throw new Error('literal not found');
    const first = literal.indexOf('/');
    const last = literal.lastIndexOf('/');
    if (first !== 0 || last <= first) throw new Error('literal is not a regex literal');
    const theoRe = new RegExp(literal.slice(first + 1, last), literal.slice(last + 1));
    for (const c of CASES) {
      if (c.absent) continue;
      ok(
        'Leg P ' + c.label + ': Theo regex agrees with the table',
        theoRe.test(c.step_id) === (c.want === 'allow'),
        'theo=' + theoRe.test(c.step_id) + ' want=' + c.want
      );
    }
  } catch (e) {
    console.log('Leg P: SKIPPED (Theo checkout not readable)');
  }
})();

// --- Leg N: no network ------------------------------------------------------
ok('N no network call happened', networkAttempted === false);

console.log('PASSED=' + (checks - failures) + ' FAILED=' + failures + ' (checks=' + checks + ')');
process.exit(failures > 0 ? 1 : 0);
