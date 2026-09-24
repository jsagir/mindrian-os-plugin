#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 21 Task 2 (HIPS-10, AI-SPEC Section 5). Offline, zero
 * network, never Jev or Theo: the doctor acceptance blocker this file backs
 * proves that (a) lib/core/verification-stamp.cjs's degrade-on-Theo-down
 * path still degrades honestly (a Theo-unreachable self-test stamps three
 * real canon-name findings and demands every one comes back unverified /
 * unavailable with no path -- a fabricated path or a backend other than
 * unavailable is the exact lie this blocker exists to catch), and (b) the
 * 355 measurement records this phase shipped (scripts/measure-hsi-thinking-
 * mode.cjs, scripts/calibrate-citation-check.cjs) still replay offline
 * (exit 0 or 77; a missing script degrades to not_run exactly like a
 * missing record does), and (c) when data/hsi-thinking-mode-rules.json
 * exists, its jev_model and fixture_sha256 match the measurement record's --
 * a rule table generated against a different model or a different gold
 * fixture is provenance drift, not a passing gate.
 *
 * Module shape (Canon Part 7 reuse): a pure programmatic scan API
 * (checkCrossConnectionHonesty), never calls process.exit itself, mirroring
 * scripts/check-tool-honesty.cjs's own module-shape precedent. No CLI wrapper
 * is shipped here -- the one caller is the doctor acceptance point (in-
 * process require), and this file's own test drives the export directly.
 *
 * NEVER requires brain-client.cjs, NEVER calls fetch, NEVER reads a vendor
 * key (no TYPESAFE_API_KEY, no MINDRIAN_BRAIN_KEY anywhere in this file).
 * The self-test drives lib/core/verification-stamp.cjs with an explicit
 * deps.callTool that always resolves null (Theo unreachable) -- the ONE wire
 * door in verification-stamp.cjs is therefore never opened by this file.
 * spawnImpl is injectable (tests/helpers pattern) so every --check replay is
 * driven offline in tests; the default spawnImpl is node:child_process's
 * spawnSync running a purely LOCAL child (`node <script> --check`), never a
 * network call.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const verificationStamp = require(path.join(__dirname, '..', 'lib', 'core', 'verification-stamp.cjs'));

// The 355 dev-time measurement scripts whose --check replay this blocker
// proves. scripts/calibrate-citation-check.cjs is 355-26's own script and
// may not exist yet on this checkout -- a missing script degrades to
// not_run, exactly like a missing recorded run does (never a failure).
const REPLAY_SCRIPTS = ['measure-hsi-thinking-mode.cjs', 'calibrate-citation-check.cjs'];

function _defaultSpawnImpl(cmd, args, opts) {
  const { spawnSync } = require('node:child_process');
  return spawnSync(cmd, args, opts);
}

/*
 * _selfTest(): stamps three findings, each an exact canon Framework-name
 * pair, through the REAL lib/core/verification-stamp.cjs with a callTool
 * that always resolves null (the Theo-unreachable signal). Every one of the
 * three must degrade to verification 'unverified', backend 'unavailable',
 * no path -- anything else means the degrade-on-Theo-down path has stopped
 * degrading honestly.
 */
async function _selfTest() {
  const names = Array.from(verificationStamp.loadFrameworkNames());
  if (names.length < 6) {
    return { ok: false, reason: 'self-test: fewer than 6 canon Framework names available to build 3 findings' };
  }
  const findings = [
    { fromHandle: names[0], toHandle: names[1], direction: 'none' },
    { fromHandle: names[2], toHandle: names[3], direction: 'none' },
    { fromHandle: names[4], toHandle: names[5], direction: 'none' },
  ];
  const callTool = async () => null;
  const stamps = await verificationStamp.stampFindings(findings, { callTool });
  const bad = stamps.filter((s) => !!s.path || s.backend !== 'unavailable' || s.verification !== 'unverified');
  if (bad.length > 0) {
    return { ok: false, reason: 'self-test: ' + bad.length + ' of ' + stamps.length + ' findings did not degrade to unverified/unavailable with no path' };
  }
  return { ok: true, reason: null };
}

/*
 * _replayCheck(repoRoot, spawnImpl): runs `node <script> --check` for every
 * REPLAY_SCRIPTS entry that exists on disk under repoRoot/scripts/. exit 0
 * -> ok; exit 77 -> not_run (an honest "no recorded run on this machine
 * yet", never a failure); anything else -> fail. A missing script is
 * not_run without ever invoking spawnImpl.
 */
function _replayCheck(repoRoot, spawnImpl) {
  const detail = {};
  let ok = true;
  let failReason = null;
  for (const scriptName of REPLAY_SCRIPTS) {
    const abs = path.join(repoRoot, 'scripts', scriptName);
    if (!fs.existsSync(abs)) {
      detail[scriptName] = { status: 'not_run', reason: scriptName + ' is absent on this checkout' };
      continue;
    }
    let r;
    try {
      r = spawnImpl(process.execPath, [abs, '--check'], { cwd: repoRoot, encoding: 'utf8' });
    } catch (e) {
      detail[scriptName] = { status: 'fail', reason: 'spawn threw: ' + e.message };
      ok = false;
      failReason = failReason || (scriptName + ' --check threw: ' + e.message);
      continue;
    }
    const code = r && typeof r.status === 'number' ? r.status : -1;
    if (code === 0) {
      detail[scriptName] = { status: 'ok', exit_code: 0 };
    } else if (code === 77) {
      detail[scriptName] = { status: 'not_run', exit_code: 77, reason: 'no recorded run on this machine yet' };
    } else {
      detail[scriptName] = { status: 'fail', exit_code: code };
      ok = false;
      failReason = failReason || (scriptName + ' --check exited ' + code);
    }
  }
  return { ok, reason: failReason, detail };
}

/*
 * _ruleTableProvenance(repoRoot): when data/hsi-thinking-mode-rules.json
 * exists, its jev_model and fixture_sha256 must equal
 * tests/fixtures/355-hsi-measurement-record.json's own fields (the rule
 * table's provenance). A missing rule table degrades to not_run -- 355-28
 * (the adoption/distillation branch) is itself conditional (355-15's
 * not_adopted ruling skips it), so the rule table legitimately does not
 * exist on most checkouts.
 */
function _ruleTableProvenance(repoRoot) {
  const rulesPath = path.join(repoRoot, 'data', 'hsi-thinking-mode-rules.json');
  if (!fs.existsSync(rulesPath)) {
    return { ok: true, reason: null, detail: { status: 'not_run', reason: 'data/hsi-thinking-mode-rules.json is absent on this checkout' } };
  }
  const recordPath = path.join(repoRoot, 'tests', 'fixtures', '355-hsi-measurement-record.json');
  let rules;
  let record;
  try {
    rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'rule-table provenance: data/hsi-thinking-mode-rules.json failed to parse: ' + e.message, detail: { status: 'fail' } };
  }
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'rule-table provenance: tests/fixtures/355-hsi-measurement-record.json failed to parse: ' + e.message, detail: { status: 'fail' } };
  }
  if (rules.jev_model !== record.jev_model || rules.fixture_sha256 !== record.fixture_sha256) {
    return {
      ok: false,
      reason: 'rule-table provenance mismatch: jev_model/fixture_sha256 in data/hsi-thinking-mode-rules.json do not match tests/fixtures/355-hsi-measurement-record.json',
      detail: {
        status: 'fail',
        rules_jev_model: rules.jev_model,
        record_jev_model: record.jev_model,
        rules_fixture_sha256: rules.fixture_sha256,
        record_fixture_sha256: record.fixture_sha256,
      },
    };
  }
  return { ok: true, reason: null, detail: { status: 'ok', jev_model: rules.jev_model } };
}

/*
 * checkCrossConnectionHonesty({ repoRoot, spawnImpl }) -> Promise<{ ok,
 * finding, detail }>. repoRoot defaults to this repo's own root; spawnImpl
 * defaults to a real (but purely local) child_process.spawnSync. Never
 * reports a number it does not have: every degrade path names an honest
 * not_run reason instead of guessing.
 */
async function checkCrossConnectionHonesty(opts) {
  const o = opts || {};
  const repoRoot = o.repoRoot || path.resolve(__dirname, '..');
  const spawnImpl = typeof o.spawnImpl === 'function' ? o.spawnImpl : _defaultSpawnImpl;

  const selfTest = await _selfTest();
  if (!selfTest.ok) {
    return { ok: false, finding: 'cross-connection-honesty: ' + selfTest.reason, detail: { self_test: selfTest } };
  }

  const replay = _replayCheck(repoRoot, spawnImpl);
  if (!replay.ok) {
    return {
      ok: false,
      finding: 'cross-connection-honesty: ' + replay.reason,
      detail: { self_test: { ok: true }, replays: replay.detail },
    };
  }

  const provenance = _ruleTableProvenance(repoRoot);
  if (!provenance.ok) {
    return {
      ok: false,
      finding: 'cross-connection-honesty: ' + provenance.reason,
      detail: { self_test: { ok: true }, replays: replay.detail, rule_table: provenance.detail },
    };
  }

  return {
    ok: true,
    finding: null,
    detail: { self_test: { ok: true }, replays: replay.detail, rule_table: provenance.detail },
  };
}

module.exports = { checkCrossConnectionHonesty };
