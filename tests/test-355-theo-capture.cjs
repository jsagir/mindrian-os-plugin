#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 Plan 14 Task 1 -- tests/test-355-theo-capture.cjs (RED until
 * this same task's GREEN step lands scripts/capture-355-theo-responses.cjs).
 *
 * Proves capturePairs / sanitizeResponse / validateCapture /
 * resolveGuardedPath against the <behavior> list in 355-14-PLAN.md Task 1:
 * canon-name-only calling, consistent internal-id sanitization, the
 * null/error/text/success record shapes, the --check exit-code contract
 * (0 valid / 77 missing, never requiring brain-client.cjs), and the
 * tests/fixtures/ path-escape guard.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const replay = require('./helpers/theo-replay-355.cjs');

const { check, summary } = hygiene.makeChecker('355-14 Theo capture (capturePairs / sanitizeResponse / validateCapture)');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'capture-355-theo-responses.cjs');

let capture;
try {
  capture = require(SCRIPT_PATH);
} catch (e) {
  console.log('FAIL: scripts/capture-355-theo-responses.cjs exists and requires cleanly (' + e.message + ')');
  netGuard.restore();
  process.exitCode = 1;
  summary();
  process.exit(1);
}

const NAMES = new Set(['Reverse Salient Analysis', 'Theory of Constraints', 'Six Thinking Hats', 'Ill-Defined Problem', 'Zzqx Nonexistent Method (not canon)']);
// The last entry above is deliberately NOT a real canon member (its own
// literal text names it as such) -- used only to prove capturePairs never
// calls a non-member pair. Remove it from the canon set used elsewhere.
NAMES.delete('Zzqx Nonexistent Method (not canon)');

// ---------------------------------------------------------------------------
// Section A: capturePairs -- canon gate, dedup, refusal, latency.
// ---------------------------------------------------------------------------
async function sectionA() {
  console.log('--- Section A: capturePairs canon gate / dedup / refusal ---');

  const fixture = {
    responses: {
      'Reverse Salient Analysis\u0000Theory of Constraints': {
        from: 'Reverse Salient Analysis', to: 'Theory of Constraints', maxHops: 3, limit: 10,
        coverage: { matched: 2, total: 2, status: 'complete' },
        paths: [{
          path: ['Reverse Salient Analysis', 'brainrecord-export-13', 'Theory of Constraints'],
          pathLabels: ['Framework', 'BrainRecord', 'Framework'],
          edges: ['SOURCED_FROM', 'SOURCED_FROM'],
          hops: 2,
        }],
      },
    },
  };
  const callTool = replay.makeReplayCallTool(fixture);

  const pairs = [
    { from: 'Reverse Salient Analysis', to: 'Theory of Constraints' },
    { from: 'Reverse Salient Analysis', to: 'Theory of Constraints' }, // exact duplicate: no second call
    { from: 'Reverse Salient Analysis', to: 'Not A Canon Name At All' }, // refused, never called
  ];

  let now = 1000;
  const fakeNow = () => { now += 50; return now; };

  const result = await capture.capturePairs(pairs, { callTool, names: NAMES, now: fakeNow });

  check('exactly one callTool call for the distinct, canon-member pair (dedup + gate)', callTool.calls.length === 1, 'calls=' + callTool.calls.length);
  check('the one call carries exactly {from,to}', callTool.calls.length === 1
    && callTool.calls[0].tool === 'find_connections'
    && callTool.calls[0].args.from === 'Reverse Salient Analysis'
    && callTool.calls[0].args.to === 'Theory of Constraints');
  check('the non-canon pair is refused with reason not_canon_name', result.refused.length === 1 && result.refused[0].reason === 'not_canon_name', JSON.stringify(result.refused));
  check('result.calls counts only real calls', result.calls === 1);
  check('result.latency_ms has one entry, a positive number', result.latency_ms.length === 1 && result.latency_ms[0] > 0);
  check('result.served is true (one real success)', result.served === true);
  check('responses is keyed by "from\\u0000to"', Object.prototype.hasOwnProperty.call(result.responses, 'Reverse Salient Analysis\u0000Theory of Constraints'));

  const entry = result.responses['Reverse Salient Analysis\u0000Theory of Constraints'];
  check('the sanitized entry keeps edges/hops/pathLabels unchanged', entry.paths
    && entry.paths[0].edges.length === 2
    && entry.paths[0].hops === 2
    && entry.paths[0].pathLabels[1] === 'BrainRecord');
  check('the internal BrainRecord id is replaced, never raw', entry.paths[0].path[1] !== 'brainrecord-export-13' && /^brainrecord-captured-\d+$/.test(entry.paths[0].path[1]), entry.paths[0].path[1]);
  check('canon Framework endpoints are kept verbatim', entry.paths[0].path[0] === 'Reverse Salient Analysis' && entry.paths[0].path[2] === 'Theory of Constraints');
}

// ---------------------------------------------------------------------------
// Section B: internal-id consistency across two responses in one file.
// ---------------------------------------------------------------------------
async function sectionB() {
  console.log('--- Section B: internal-id replacement is consistent within one capture ---');

  const fixture = {
    responses: {
      'Reverse Salient Analysis\u0000Theory of Constraints': {
        coverage: { matched: 2, total: 2, status: 'complete' },
        paths: [{
          path: ['Reverse Salient Analysis', 'brainrecord-export-13', 'Theory of Constraints'],
          pathLabels: ['Framework', 'BrainRecord', 'Framework'],
          edges: ['SOURCED_FROM', 'SOURCED_FROM'],
          hops: 2,
        }],
      },
      'Six Thinking Hats\u0000Theory of Constraints': {
        coverage: { matched: 2, total: 2, status: 'complete' },
        paths: [{
          path: ['Six Thinking Hats', 'brainrecord-export-13', 'Theory of Constraints'],
          pathLabels: ['Framework', 'BrainRecord', 'Framework'],
          edges: ['SOURCED_FROM', 'SOURCED_FROM'],
          hops: 2,
        }],
      },
    },
  };
  const callTool = replay.makeReplayCallTool(fixture);
  const pairs = [
    { from: 'Reverse Salient Analysis', to: 'Theory of Constraints' },
    { from: 'Six Thinking Hats', to: 'Theory of Constraints' },
  ];
  const result = await capture.capturePairs(pairs, { callTool, names: NAMES });

  const idA = result.responses['Reverse Salient Analysis\u0000Theory of Constraints'].paths[0].path[1];
  const idB = result.responses['Six Thinking Hats\u0000Theory of Constraints'].paths[0].path[1];
  check('the same raw internal id maps to the same synthetic id across two responses in one file', idA === idB, idA + ' vs ' + idB);
}

// ---------------------------------------------------------------------------
// Section C: sanitizeResponse -- null / error / text / success, standalone.
// ---------------------------------------------------------------------------
function sectionC() {
  console.log('--- Section C: sanitizeResponse null / error / text / success ---');

  check('null -> { $null: true }', JSON.stringify(capture.sanitizeResponse(null)) === JSON.stringify({ $null: true }));
  check('undefined -> { $null: true }', JSON.stringify(capture.sanitizeResponse(undefined)) === JSON.stringify({ $null: true }));

  const errSentinel = { error: 'egress_blocked', tool: 'find_connections', egress_class: 'content_set' };
  const sanitizedErr = capture.sanitizeResponse(errSentinel);
  check('an error-sentinel object -> { $error: "<code>" } only, no tool/egress_class leak', sanitizedErr.$error === 'egress_blocked' && Object.keys(sanitizedErr).length === 1, JSON.stringify(sanitizedErr));

  const sanitizedText = capture.sanitizeResponse('some free-text Theo prose that must never be recorded');
  check('a bare string reply -> { $text: true }, never the body', sanitizedText.$text === true && !JSON.stringify(sanitizedText).includes('free-text'));

  const refusal = { coverage: { matched: 1, total: 2, status: 'partial' }, refusals: [{ endpoint: 'to', name: 'Zzqx Nonexistent Method', code: 'FRAMEWORK_NOT_FOUND', detail: 'no live :Framework carries the name' }] };
  const sanitizedRefusal = capture.sanitizeResponse(refusal);
  check('a refusal-in-success reply keeps coverage and refusals unchanged, no paths key', JSON.stringify(sanitizedRefusal.refusals) === JSON.stringify(refusal.refusals)
    && JSON.stringify(sanitizedRefusal.coverage) === JSON.stringify(refusal.coverage)
    && !Object.prototype.hasOwnProperty.call(sanitizedRefusal, 'paths'));
}

// ---------------------------------------------------------------------------
// Section D: replay fidelity -- the file's own responses, fed back through
// makeReplayCallTool, drive lib/core/verification-stamp.cjs to the SAME
// Stamp tier/backend the raw (pre-sanitization) response produced.
// ---------------------------------------------------------------------------
async function sectionD() {
  console.log('--- Section D: captured responses replay to the same stamp ---');
  const verificationStamp = require('../lib/core/verification-stamp.cjs');

  const rawSuccess = {
    coverage: { matched: 2, total: 2, status: 'complete' },
    paths: [{
      path: ['Reverse Salient Analysis', 'brainrecord-export-13', 'Six Thinking Hats'],
      pathLabels: ['Framework', 'BrainRecord', 'Framework'],
      edges: ['SOURCED_FROM', 'FEEDS_INTO'],
      hops: 2,
    }],
  };
  const rawCallTool = async () => rawSuccess;
  const rawStamp = await verificationStamp.stampFindingDetailed(
    { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'none' },
    { callTool: rawCallTool, names: NAMES, registry: new Map() }
  );

  const sanitized = capture.sanitizeResponse(rawSuccess);
  const capturedFile = { responses: { 'Reverse Salient Analysis\u0000Six Thinking Hats': sanitized } };
  const replayedCallTool = replay.makeReplayCallTool(capturedFile);
  const replayedStamp = await verificationStamp.stampFindingDetailed(
    { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'none' },
    { callTool: replayedCallTool, names: NAMES, registry: new Map() }
  );

  check('a success response replays to the identical verification/backend', rawStamp.stamp.verification === replayedStamp.stamp.verification && rawStamp.stamp.backend === replayedStamp.stamp.backend, rawStamp.stamp.verification + '/' + rawStamp.stamp.backend + ' vs ' + replayedStamp.stamp.verification + '/' + replayedStamp.stamp.backend);
  check('a success response replays to the identical hop count', rawStamp.stamp.path.edges.length === replayedStamp.stamp.path.edges.length);
  check('the replayed path never carries the raw internal id', !JSON.stringify(replayedStamp.stamp.path).includes('brainrecord-export-13'));

  // The $null sentinel is theo-replay-355.cjs's own native vocabulary: a
  // captured outage replays to the exact same unavailable/backend_unavailable
  // stamp a live outage produces.
  const nullSanitized = capture.sanitizeResponse(null);
  const nullFile = { responses: { 'Reverse Salient Analysis\u0000Theory of Constraints': nullSanitized } };
  const nullReplay = replay.makeReplayCallTool(nullFile);
  const nullStamp = await verificationStamp.stampFindingDetailed(
    { fromHandle: 'Reverse Salient Analysis', toHandle: 'Theory of Constraints', direction: 'none' },
    { callTool: nullReplay, names: NAMES, registry: new Map() }
  );
  check('a captured outage ($null) replays to unverified/unavailable/backend_unavailable', nullStamp.stamp.verification === 'unverified' && nullStamp.stamp.backend === 'unavailable' && nullStamp.stamp.reason === 'backend_unavailable', JSON.stringify(nullStamp.stamp));
}

// ---------------------------------------------------------------------------
// Section E: validateCapture -- the positive case and every failure mode.
// ---------------------------------------------------------------------------
function sectionE() {
  console.log('--- Section E: validateCapture ---');

  const goodFile = {
    captured_at: new Date().toISOString(),
    theo_host: 'devhost',
    snapshot_sha256: 'a'.repeat(64),
    served: true,
    calls: 1,
    latency_ms: [1200],
    responses: {
      'Reverse Salient Analysis\u0000Theory of Constraints': {
        coverage: { matched: 2, total: 2, status: 'complete' },
        paths: [{
          path: ['Reverse Salient Analysis', 'brainrecord-captured-1', 'Theory of Constraints'],
          pathLabels: ['Framework', 'BrainRecord', 'Framework'],
          edges: ['SOURCED_FROM', 'SOURCED_FROM'],
          hops: 2,
        }],
      },
    },
  };
  const okResult = capture.validateCapture(goodFile);
  check('a well-formed capture file validates ok', okResult.ok === true, JSON.stringify(okResult.errors));

  const badKeyFile = JSON.parse(JSON.stringify(goodFile));
  badKeyFile.responses['Reverse Salient Analysis\u0000Not A Real Name'] = badKeyFile.responses['Reverse Salient Analysis\u0000Theory of Constraints'];
  check('a key whose two names are not snapshot members fails', capture.validateCapture(badKeyFile).ok === false);

  const leakedIdFile = JSON.parse(JSON.stringify(goodFile));
  leakedIdFile.responses['Reverse Salient Analysis\u0000Theory of Constraints'].paths[0].path[1] = 'brainrecord-export-99';
  check('a raw internal id anywhere in the file fails', capture.validateCapture(leakedIdFile).ok === false);

  const noCapturedAt = JSON.parse(JSON.stringify(goodFile));
  delete noCapturedAt.captured_at;
  check('a missing captured_at fails', capture.validateCapture(noCapturedAt).ok === false);

  const noSnapshot = JSON.parse(JSON.stringify(goodFile));
  delete noSnapshot.snapshot_sha256;
  check('a missing snapshot_sha256 fails', capture.validateCapture(noSnapshot).ok === false);

  const hopMismatch = JSON.parse(JSON.stringify(goodFile));
  hopMismatch.responses['Reverse Salient Analysis\u0000Theory of Constraints'].paths[0].hops = 3;
  check('a path whose hops disagrees with edges.length fails', capture.validateCapture(hopMismatch).ok === false);
}

// ---------------------------------------------------------------------------
// Section F: resolveGuardedPath -- containment under tests/fixtures/.
// ---------------------------------------------------------------------------
function sectionF() {
  console.log('--- Section F: resolveGuardedPath path-escape guard ---');

  const inside = capture.resolveGuardedPath(path.join('tests', 'fixtures', '355-theo-find-connections-responses.json'), { exitOnEscape: false });
  check('a path inside tests/fixtures/ is accepted', inside.within === true, JSON.stringify(inside));

  const outside = capture.resolveGuardedPath(path.join('..', '..', 'etc', 'passwd'), { exitOnEscape: false });
  check('a path outside tests/fixtures/ is refused', outside.within === false);

  const symlinkEscape = capture.resolveGuardedPath('/etc/hosts', { exitOnEscape: false });
  check('an absolute path outside the repo is refused', symlinkEscape.within === false);
}

// ---------------------------------------------------------------------------
// Section G: --check CLI -- exit codes and static "never loads brain-client".
// ---------------------------------------------------------------------------
function sectionG() {
  console.log('--- Section G: --check CLI exit codes ---');

  // The guard refuses any --file outside tests/fixtures/ before existence
  // is even checked, so drive the SKIP leg through a path inside
  // tests/fixtures/ that genuinely does not exist yet.
  const missingInsideFixtures = path.join(capture.FIXTURES_ROOT, '355-14-capture-does-not-exist-yet.json');
  if (fs.existsSync(missingInsideFixtures)) fs.rmSync(missingInsideFixtures);
  const skipInside = _run(['--check', '--file', missingInsideFixtures]);
  check('--check on a missing file exits 77 (SKIP)', skipInside.status === 77, 'status=' + skipInside.status + ' stdout=' + skipInside.stdout);

  const validPath = path.join(capture.FIXTURES_ROOT, '355-14-capture-valid-tmp.json');
  const goodFile = {
    captured_at: new Date().toISOString(),
    theo_host: 'devhost',
    snapshot_sha256: capture.loadSnapshotSha256(),
    served: true,
    calls: 1,
    latency_ms: [1000],
    responses: {
      'Reverse Salient Analysis\u0000Theory of Constraints': {
        coverage: { matched: 2, total: 2, status: 'complete' },
        paths: [{
          path: ['Reverse Salient Analysis', 'brainrecord-captured-1', 'Theory of Constraints'],
          pathLabels: ['Framework', 'BrainRecord', 'Framework'],
          edges: ['SOURCED_FROM', 'SOURCED_FROM'],
          hops: 2,
        }],
      },
    },
  };
  fs.writeFileSync(validPath, JSON.stringify(goodFile, null, 2), 'utf8');
  try {
    const okRun = _run(['--check', '--file', validPath]);
    check('--check on a valid file exits 0', okRun.status === 0, 'status=' + okRun.status + ' stdout=' + okRun.stdout);

    const badFile = JSON.parse(JSON.stringify(goodFile));
    delete badFile.snapshot_sha256;
    fs.writeFileSync(validPath, JSON.stringify(badFile, null, 2), 'utf8');
    const failRun = _run(['--check', '--file', validPath]);
    check('--check on an invalid file exits non-zero, not 0 or 77', failRun.status !== 0 && failRun.status !== 77, 'status=' + failRun.status);
  } finally {
    if (fs.existsSync(validPath)) fs.rmSync(validPath);
  }

  // Static proof that --check never requires brain-client.cjs: the only
  // non-comment occurrence of 'brain-client.cjs' in the whole script sits
  // inside runLiveCli, never inside runCheckCli.
  const lines = hygiene.nonCommentLines(SCRIPT_PATH);
  const src = lines.join('\n');
  const checkFnMatch = src.match(/function runCheckCli\([\s\S]*?\n}/);
  const liveFnMatch = src.match(/async function runLiveCli\([\s\S]*?\n}/);
  check('runCheckCli is present and never mentions brain-client.cjs', Boolean(checkFnMatch) && !checkFnMatch[0].includes('brain-client.cjs'));
  check('the brain-client.cjs require lives inside runLiveCli', Boolean(liveFnMatch) && liveFnMatch[0].includes('brain-client.cjs'));
}

function _run(args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout };
  } catch (e) {
    return { status: typeof e.status === 'number' ? e.status : 1, stdout: (e.stdout || '') + (e.stderr || '') };
  }
}

// ---------------------------------------------------------------------------
async function main() {
  await sectionA();
  await sectionB();
  sectionC();
  await sectionD();
  sectionE();
  sectionF();
  sectionG();

  check('TYPESAFE_API_KEY absent for the rest of this process (scrubVendorKey ran first)', !Object.prototype.hasOwnProperty.call(process.env, 'TYPESAFE_API_KEY'));
  check('no fetch() attempted anywhere in this test (installNetGuard)', netGuard.attempts() === 0);

  netGuard.restore();
  const code = summary();
  if (wasKeyPresent) console.log('(TYPESAFE_API_KEY was present in the shell env and has been scrubbed for this process only)');
  process.exit(code);
}

main().catch((e) => {
  console.error('test-355-theo-capture: uncaught: ' + ((e && e.stack) || e));
  netGuard.restore();
  process.exit(1);
});
