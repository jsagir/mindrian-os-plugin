#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 11 Task 1 (D-13 a, EPV366-18): the Part 8 guard's ONE navigator-consent allow.
 *
 *   G1  normalize_framework_name {raw} with no receipt keeps its current verdict
 *   G2  the same payload with a receipt (gate id format, term equal to raw) allows, class and
 *       reason navigator_released
 *   G3  a receipt term that differs from raw does not allow
 *   G4  the envelope {raw, intent, section, perspective} with a closed-vocabulary intent, a slug
 *       section, a perspective in the registry and a matching receipt allows
 *   G5  prose intent (spaces, over the short-label cap) or an off-enum perspective does not allow
 *   G6  any extra key beyond the four does not allow
 *   G7  a content-set hit inside raw blocks even with a receipt (the scan still runs first)
 *   G8  the receipt passed with any other tool name changes nothing
 *   G9  the existing Part 8 adversarial suites still pass
 *   G10 the arm sits after the content scan in classify (source order)
 *   G11 the arm does not depend on the free-form classification (a free-form tool name never allows)
 *
 * Hermetic: temp HOME, no network. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-guard-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-guard-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-guard-navigator-release');

const guard = require(path.join(REPO_ROOT, 'lib/core/part8-egress-guard.cjs'));
const TOOL = 'normalize_framework_name';
const GATE = 'gate-0123456789abcdef';
const TERM = 'Bottleneck Hunt';
function rel(term, id) { return { gate_id: id === undefined ? GATE : id, term: term }; }
function isReleased(v) { return v && v.verdict === 'allow' && v.class === 'navigator_released' && v.reason === 'navigator_released'; }

// G1
(function () {
  const v = guard.classify({ raw: TERM }, { toolName: TOOL });
  C.check('G1 no receipt: not navigator_released', !isReleased(v) && v.verdict !== 'block', JSON.stringify(v));
  const v2 = guard.classify({ raw: TERM }, { toolName: TOOL, release: { gate_id: 'not-a-gate', term: TERM } });
  C.check('G1b malformed gate id: not navigator_released', !isReleased(v2), JSON.stringify(v2));
  const v3 = guard.classify({ raw: TERM }, { toolName: TOOL, release: 'yes' });
  C.check('G1c a non-object receipt: not navigator_released', !isReleased(v3), JSON.stringify(v3));
})();

// G2
(function () {
  const v = guard.classify({ raw: TERM }, { toolName: TOOL, release: rel(TERM) });
  C.check('G2 receipt matching raw: allow navigator_released', isReleased(v), JSON.stringify(v));
  C.check('G2b the reason carries no term bytes', typeof v.reason === 'string' && v.reason.indexOf('Bottleneck') === -1);
})();

// G3
(function () {
  const v = guard.classify({ raw: TERM }, { toolName: TOOL, release: rel('Something Else') });
  C.check('G3 receipt term differs from raw: not allow', !isReleased(v), JSON.stringify(v));
  const v2 = guard.classify({ raw: TERM + ' ' }, { toolName: TOOL, release: rel(TERM) });
  C.check('G3b a trailing space is a different term', !isReleased(v2), JSON.stringify(v2));
})();

// G4
(function () {
  const env = { raw: TERM, intent: 'explore', section: 'problem-definition', perspective: 'eureka' };
  const v = guard.classify(env, { toolName: TOOL, release: rel(TERM) });
  C.check('G4 full envelope with a matching receipt: allow', isReleased(v), JSON.stringify(v));
  const partial = guard.classify({ raw: TERM, intent: 'find-bottleneck' }, { toolName: TOOL, release: rel(TERM) });
  C.check('G4b envelope with only intent: allow', isReleased(partial), JSON.stringify(partial));
})();

// G5
(function () {
  const rc = { toolName: TOOL, release: rel(TERM) };
  const prose = guard.classify({ raw: TERM, intent: 'I want to find the bottleneck in my venture' }, rc);
  C.check('G5 prose intent: not allow', !isReleased(prose), JSON.stringify(prose));
  const longIntent = guard.classify({ raw: TERM, intent: 'x'.repeat(130) }, rc);
  C.check('G5b over-cap intent: not allow', !isReleased(longIntent), JSON.stringify(longIntent));
  const offVocab = guard.classify({ raw: TERM, intent: 'not-a-jtbd-handle' }, rc);
  C.check('G5c a one-word intent outside the closed vocabulary: not allow', !isReleased(offVocab), JSON.stringify(offVocab));
  const badPersp = guard.classify({ raw: TERM, perspective: 'astrology' }, rc);
  C.check('G5d perspective off the enum: not allow', !isReleased(badPersp), JSON.stringify(badPersp));
  const badSection = guard.classify({ raw: TERM, section: 'Problem Definition' }, rc);
  C.check('G5e section that is not a slug: not allow', !isReleased(badSection), JSON.stringify(badSection));
})();

// G6
(function () {
  const rc = { toolName: TOOL, release: rel(TERM) };
  const extra = guard.classify({ raw: TERM, intent: 'explore', section: 'a', perspective: 'eureka', extra: 'x' }, rc);
  C.check('G6 a fifth key: not allow', !isReleased(extra), JSON.stringify(extra));
  const unknown = guard.classify({ raw: TERM, note: 'hello' }, rc);
  C.check('G6b an unknown key beside raw: not allow', !isReleased(unknown), JSON.stringify(unknown));
  const noRaw = guard.classify({ intent: 'explore' }, rc);
  C.check('G6c no raw: not allow', !isReleased(noRaw), JSON.stringify(noRaw));
})();

// G7
(function () {
  const secretish = 'jane.doe@example.com';
  const v = guard.classify({ raw: secretish }, { toolName: TOOL, release: rel(secretish) });
  C.check('G7 content hit in raw blocks even with a receipt', v.verdict === 'block' && v.class === 'content_set', JSON.stringify(v));
  const v2 = guard.classify({ raw: TERM, intent: 'explore', section: 'a', perspective: 'eureka', x: secretish }, { toolName: TOOL, release: rel(TERM) });
  C.check('G7b content hit in any other value blocks', v2.verdict === 'block', JSON.stringify(v2));
})();

// G8
(function () {
  ['find_connections', 'framework_step', 'brain_ask', 'brain_search', 'recommend_chain', 'case_story', ''].forEach(function (tool) {
    const noRel = guard.classify({ raw: TERM }, { toolName: tool });
    const withRel = guard.classify({ raw: TERM }, { toolName: tool, release: rel(TERM) });
    C.check('G8 tool "' + tool + '": the receipt changes nothing', JSON.stringify(noRel) === JSON.stringify(withRel), JSON.stringify(withRel));
  });
  const env = guard.classify({ from: TERM, to: 'Systems Thinking' }, { toolName: 'find_connections', release: rel(TERM) });
  C.check('G8b find_connections keeps its own verdict class', env.class !== 'navigator_released', JSON.stringify(env));
})();

// G10 (source order) and docblock
(function () {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/part8-egress-guard.cjs'), 'utf8');
  const lines = src.split('\n');
  const classifyStart = lines.findIndex(function (l) { return /^function classify\(/.test(l); });
  let scanLine = -1;
  let armLine = -1;
  for (let i = classifyStart; i < lines.length; i += 1) {
    if (scanLine === -1 && lines[i].indexOf('scanForContent(payload)') !== -1) scanLine = i;
    if (armLine === -1 && lines[i].indexOf('_proveNavigatorRelease(') !== -1) armLine = i;
    if (/^}/.test(lines[i])) break;
  }
  C.check('G10 the arm is called inside classify', armLine !== -1, 'arm ' + armLine);
  C.check('G10b the arm call is after the content scan', scanLine !== -1 && armLine > scanLine, 'scan ' + scanLine + ' arm ' + armLine);
  C.check('G10c navigator_released appears at least twice in the guard', (src.match(/navigator_released/g) || []).length >= 2);
  C.check('G10d the helper is exported', typeof guard._proveNavigatorRelease === 'function');
  C.check('G10e the helper carries a docblock that names the ordering and the single widened path',
    /_proveNavigatorRelease[\s\S]{0,40}/.test(src) && /only widened path/i.test(src));
})();

// G11: the arm must not lean on the free-form branch (SEED-019: that branch false-blocks generic words)
(function () {
  const v = guard.classify({ raw: TERM }, { toolName: 'mcp__theo__brain_ask', release: rel(TERM) });
  C.check('G11 a free-form tool name never reaches the arm', !isReleased(v), JSON.stringify(v));
  const direct = guard._proveNavigatorRelease ? guard._proveNavigatorRelease({ raw: TERM }, { toolName: TOOL, release: rel(TERM) }) : null;
  C.check('G11b the arm proves by shape and receipt alone (no free-form scan)', direct !== null && typeof direct === 'object' && direct.class === 'navigator_released', JSON.stringify(direct));
  const wrapped = guard.classify({ raw: TERM }, { toolName: 'mcp__mindrian-brain__normalize_framework_name', release: rel(TERM) });
  C.check('G11c a namespaced tool name that contains normalize_framework_name allows with a receipt', isReleased(wrapped), JSON.stringify(wrapped));
})();

// G9: the existing adversarial suites (the ones that were green before this plan)
(function () {
  const SUITES = [
    'tests/test-220-part8-egress.cjs',
    'tests/test-223-part8-egress.cjs',
    'tests/test-345-part8.cjs',
    'tests/test-346-part8-enum-only.cjs',
    'tests/test-355-part8-egress.cjs',
    'tests/test-3551-part8-egress.cjs',
    'tests/test-363-part8-sweep.cjs',
    'tests/test-213-part8-boundary.cjs',
    'tests/test-part8-poison-transcript.cjs',
    'tests/test-361-theo-parity.cjs',
    'tests/part8-egress-guard-hook.test.cjs',
    'tests/test-254-normalize-roundtrip-probe.cjs',
  ];
  SUITES.forEach(function (rel1) {
    const abs = path.join(REPO_ROOT, rel1);
    if (!fs.existsSync(abs)) { C.check('G9 ' + rel1 + ' exists', false, 'missing'); return; }
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-guard-suite-'));
    const r = spawnSync(process.execPath, [abs], {
      cwd: REPO_ROOT,
      env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: home }),
      encoding: 'utf8',
      timeout: 180000,
    });
    C.check('G9 ' + rel1 + ' exits 0', r.status === 0, 'exit ' + r.status);
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  });
})();

const attempts = (net && typeof net.attempts === 'function') ? net.attempts() : ((net && Array.isArray(net.attempts)) ? net.attempts.length : 0);
C.check('zero network attempts', attempts === 0, String(attempts));
net.restore();
process.exit(C.summary());
