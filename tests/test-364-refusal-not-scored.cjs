#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 03 Task 1 -- NR-1: a Theo `not_scored` refusal maps to the
 * `not_ready` kind, never `unreachable`, and the six-kind vocabulary is
 * unchanged. layer: harness
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME set before any repo
 * module loads; the network guard is installed first.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-refusal-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-refusal-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-refusal-not-scored');

const r = require(path.join(REPO_ROOT, 'lib/core/refusal-messaging.cjs'));

C.check('R1 not_scored maps to not_ready',
  typeof r.kindForTheoRefusal === 'function' && r.kindForTheoRefusal('not_scored') === 'not_ready');

const inputs = ['not_scored', 'nope', '', null, undefined, 7, {}, 'unreachable', 'constructor', '__proto__'];
C.check('R2 no input ever maps to unreachable',
  typeof r.kindForTheoRefusal === 'function' && inputs.every((x) => r.kindForTheoRefusal(x) !== 'unreachable'));

C.check('R3 unknown, empty, null, number and object inputs return null',
  typeof r.kindForTheoRefusal === 'function'
  && ['nope', '', null, 7, {}, 'constructor', '__proto__'].every((x) => r.kindForTheoRefusal(x) === null));

let sixOk = false;
try {
  require('node:assert').deepStrictEqual(r.REFUSAL_KINDS,
    ['unreachable', 'tier_denied', 'not_ready', 'rate_limited', 'egress_blocked']);
  sixOk = true;
} catch (_e) { sixOk = false; }
// Quick 261005-l8g removed the keyless kind: five members remain, unchanged otherwise.
C.check('R4 REFUSAL_KINDS is still the same five', sixOk);

const map = r.THEO_REFUSAL_TO_KIND;
C.check('R5 THEO_REFUSAL_TO_KIND is frozen with exactly one key, not_scored',
  !!map && Object.isFrozen(map) && Object.keys(map).length === 1 && Object.keys(map)[0] === 'not_scored');

const child = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests/test-250-refusal-shapes.cjs')], {
  env: Object.assign({}, process.env), encoding: 'utf8',
});
C.check('R6 test-250-refusal-shapes still exits 0', child.status === 0, 'status ' + child.status);

C.check('R7 zero network attempts', net.attempts() === 0);
process.exit(C.summary());
