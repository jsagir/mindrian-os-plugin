#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 21 Task 1 (HIPS-04, HIPS-08, HIPS-09, SPEC AC8, AI-SPEC D9,
 * D-44/Pitfall 15). The phase-wide Part 8 egress sweep over everything 355
 * added: the wire shape, the second wall (the REAL part8-egress-guard's
 * classify() actually refuses), and the Jev-runtime ban list (355's own
 * BANNED_355, never editing tests/test-353-tripwires.cjs or
 * tests/test-356-tripwires.cjs -- those own their own ban lists).
 *
 * Legs (a)-(f), mirroring the plan's own must_haves truth:
 *   (a) no egress token (fetch(, a URL scheme, node:http(s), curl/wget) on a
 *       non-comment line of the stamp module, the formatter, the direction
 *       module, floor-disclosure.cjs, and stamp-connections.cjs -- a MISSING
 *       target FAILS the leg, it is never silently skipped.
 *   (b) every callTool captured while stamping all five recorded producer
 *       fixtures (whitespace zone, whitespace novelty, HSI, find-bottlenecks,
 *       eureka, find-connections) is ('find_connections', {from, to}) with
 *       exactly two own keys, both values members of the local canon
 *       Framework-name snapshot (loadFrameworkNames()).
 *   (c) a planted room sentence (carrying a real email address, a genuine
 *       Canon FORBIDDEN_PATTERNS hit) is classified 'block' by the REAL
 *       part8-egress-guard classify(), a guarded callTool wrapper turns that
 *       into { error: 'egress_blocked' }, and the resulting stamp is
 *       unverified / unavailable / egress_refused; separately, 50 real
 *       snapshot names each pair with a fixed canon name as allow /
 *       known_tool_shape.
 *   (d) BANNED_355 (this phase's own dev-time-Jev ban list) appears on no
 *       non-comment line under lib/ or hooks/; a scratch negative control
 *       under lib/core/ proves the sweep actually catches a violation, then
 *       deletes itself in finally.
 *   (e) hooks/hooks.json references no 355 dev-script name.
 *   (f) installNetGuard().attempts() === 0 -- zero real fetch anywhere in
 *       this whole test run.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-part8-egress');
const { check } = checker;

const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const part8EgressGuard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const whitespaceCommand = require(path.join(REPO, 'scripts', 'whitespace-command.cjs'));
const hsiToGraph = require(path.join(REPO, 'scripts', 'hsi-to-graph.cjs'));
const eurekaRunner = require(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'));
const stampConnections = require(path.join(REPO, 'scripts', 'stamp-connections.cjs'));
const { makeReplayCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Leg (a): no egress token in the five 355 target files. A missing target
// FAILS the leg (never a silent skip -- this differs deliberately from
// tests/run-all-355.sh's own run_if-guarded Part 8 leg, which is safe to
// SKIP a not-yet-landed artifact; every one of these five is long landed).
// ---------------------------------------------------------------------------
const PART8_RE = /fetch\(|https?:\/\/|require\(['"]node:https?|\b(curl|wget)\b/;
const PART8_TARGETS = [
  'lib/core/verification-stamp.cjs',
  'lib/core/verification-stamp-format.cjs',
  'lib/core/direction-convention.cjs',
  'lib/core/floor-disclosure.cjs',
  'scripts/stamp-connections.cjs',
];

function legA() {
  console.log('--- leg A: no egress token in the five 355 target files ---');
  for (const rel of PART8_TARGETS) {
    const abs = path.join(REPO, rel);
    if (!fs.existsSync(abs)) {
      check('A ' + rel + ': present (a missing target FAILS this leg)', false, 'MISSING');
      continue;
    }
    const lines = hygiene.nonCommentLines(abs);
    const hit = lines.some((l) => PART8_RE.test(l));
    check('A ' + rel + ': carries no egress token on a non-comment line', !hit);
  }
}

// ---------------------------------------------------------------------------
// Leg (b): every captured callTool call, across all five recorded producer
// fixtures, is ('find_connections', {from, to}) with exactly two own keys,
// both values a member of the local canon Framework-name snapshot.
// ---------------------------------------------------------------------------
function _makeSyntheticRoom() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-21-egress-'));
  const room = path.join(root, 'room');
  fs.mkdirSync(path.join(room, 'synthetic-355'), { recursive: true });
  fs.writeFileSync(path.join(room, 'synthetic-355', 'hsi-a.md'), '---\nframework: Reverse Salient Analysis\n---\n\n# HSI A\n\nBody text.');
  fs.writeFileSync(path.join(room, 'synthetic-355', 'hsi-b.md'), '---\nframework: Six Thinking Hats\n---\n\n# HSI B\n\nBody text.');
  return {
    root,
    room,
    cleanup() {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (_e) {
        // best-effort
      }
    },
  };
}

async function legB() {
  console.log('--- leg B: every captured call is find_connections/{from,to}/snapshot names ---');
  const names = verificationStamp.loadFrameworkNames();
  const allCalls = [];

  // whitespace: zone (map/analyze).
  {
    const gaps = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-gaps.json'), 'utf8')).gaps;
    const findings = gaps.map((g) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(g, 'zone')));
    const callTool = makeReplayCallTool(stubFixture);
    await verificationStamp.stampFindings(findings, { callTool });
    allCalls.push(...callTool.calls);
  }

  // whitespace: novelty (score).
  {
    const rows = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-novelty.json'), 'utf8')).rows;
    const findings = rows.map((r) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(r, 'novelty')));
    const callTool = makeReplayCallTool(stubFixture);
    await verificationStamp.stampFindings(findings, { callTool });
    allCalls.push(...callTool.calls);
  }

  // HSI (a synthetic scratch room, two canon-framework artifacts).
  {
    const scratch = _makeSyntheticRoom();
    try {
      const pair = { left_id: 'synthetic-355/hsi-a', right_id: 'synthetic-355/hsi-b' };
      const endpoints = hsiToGraph.hsiEndpoints(pair, scratch.room);
      const callTool = makeReplayCallTool(stubFixture);
      await verificationStamp.stampFindings([Object.assign({ direction: directionConvention.NONE }, endpoints)], { callTool });
      allCalls.push(...callTool.calls);
    } finally {
      scratch.cleanup();
    }
  }

  // find-bottlenecks (the rs-pairs.json fixture, the same finding shape
  // runRsEngine's own stampFn builds: fromHandle/toHandle from the recorded
  // source_title/target_title, direction from the pair's own rs.direction).
  {
    const pairs = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'rs-pairs.json'), 'utf8')).pairs;
    const findings = pairs.map((p) => ({
      fromHandle: names.has(p.source_title) ? p.source_title : null,
      toHandle: names.has(p.target_title) ? p.target_title : null,
      fromVia: names.has(p.source_title) ? 'title' : null,
      toVia: names.has(p.target_title) ? 'title' : null,
      direction: p.direction,
    }));
    const callTool = makeReplayCallTool(stubFixture);
    await verificationStamp.stampFindings(findings, { callTool });
    allCalls.push(...callTool.calls);
  }

  // eureka (the embedded ranked pairs, via the module's own stampRankedPairs).
  {
    const ranked = JSON.parse(JSON.stringify(
      JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'eureka-report.json'), 'utf8')).embedded.ranked
    ));
    const callTool = makeReplayCallTool(stubFixture);
    await eurekaRunner.stampRankedPairs(ranked, {}, { callTool });
    allCalls.push(...callTool.calls);
  }

  // find-connections (scripts/stamp-connections.cjs, a handful of recorded
  // pairs pulled straight from the theo-stub-responses.json key set).
  {
    const responseKeys = Object.keys(stubFixture.responses).slice(0, 6);
    const pairsJson = responseKeys.map((k) => {
      const [from, to] = k.split('\u0000');
      return { from, to };
    });
    const tmpFile = path.join(os.tmpdir(), 'mos-355-21-stamp-connections-pairs-' + process.pid + '.json');
    fs.writeFileSync(tmpFile, JSON.stringify(pairsJson));
    try {
      const callTool = makeReplayCallTool(stubFixture);
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = () => true;
      try {
        await stampConnections.main(['--pairs-json', tmpFile], { callTool });
      } finally {
        process.stdout.write = origWrite;
      }
      allCalls.push(...callTool.calls);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_e) { /* best-effort */ }
    }
  }

  check('B: at least one call was captured across all five producers', allCalls.length > 0, 'got ' + allCalls.length);

  let shapeOk = true;
  let namesOk = true;
  for (const c of allCalls) {
    if (c.tool !== 'find_connections') shapeOk = false;
    const keys = Object.keys(c.args).sort();
    if (keys.length !== 2 || keys[0] !== 'from' || keys[1] !== 'to') shapeOk = false;
    if (!names.has(c.args.from) || !names.has(c.args.to)) namesOk = false;
  }
  check('B: every captured call is tool "find_connections" with exactly the keys {from, to}', shapeOk);
  check('B: every captured call\'s from/to values are canon snapshot Framework names', namesOk);
}

// ---------------------------------------------------------------------------
// Leg (c): the second wall -- the REAL classify() actually refuses a planted
// room sentence, and 50 real snapshot names each pair with a fixed canon
// name as allow/known_tool_shape (the positive control proving the negative
// control is not vacuous).
// ---------------------------------------------------------------------------
function _makeGuardedCallTool(inner) {
  const calls = [];
  async function guardedCallTool(tool, args) {
    calls.push({ tool, args });
    const verdict = part8EgressGuard.classify(args, { toolName: tool });
    if (verdict.verdict !== 'allow') {
      return { error: 'egress_blocked' };
    }
    return inner(tool, args);
  }
  guardedCallTool.calls = calls;
  return guardedCallTool;
}

async function legC() {
  console.log('--- leg C: the real classify() refuses a planted room sentence ---');
  const names = verificationStamp.loadFrameworkNames();
  const FIXED_CANON_NAME = 'Six Thinking Hats';
  check('C: the fixed canon name used for the positive control is itself a real snapshot name', names.has(FIXED_CANON_NAME));

  // A planted "room sentence" -- a real Canon FORBIDDEN_PATTERNS hit (an
  // email address), the kind of content Part 8 must never let cross the wire.
  const planted = 'Reach out to jordan.example@mindrian-test.dev about the bottleneck.';
  const directVerdict = part8EgressGuard.classify({ from: planted, to: FIXED_CANON_NAME }, { toolName: 'find_connections' });
  check('C: the REAL classify() blocks the planted room sentence', directVerdict.verdict === 'block', JSON.stringify(directVerdict));

  const inner = makeReplayCallTool(stubFixture);
  const guarded = _makeGuardedCallTool(inner);
  const finding = { fromHandle: planted, toHandle: FIXED_CANON_NAME, direction: directionConvention.NONE };
  const stamp = await verificationStamp.stampFinding(finding, { callTool: guarded });
  check('C: stampFinding degrades to unverified/unavailable/egress_refused when classify() blocks', stamp.verification === 'unverified' && stamp.backend === 'unavailable' && stamp.reason === 'egress_refused', JSON.stringify(stamp));
  check('C: the guarded callTool was actually invoked once (the second wall was reached, not short-circuited earlier)', guarded.calls.length === 1, 'got ' + guarded.calls.length);
  check('C: the underlying (unguarded) replay callTool was never invoked (egress_blocked short-circuits before Theo)', inner.calls.length === 0, 'got ' + inner.calls.length);

  // Positive control: 50 real snapshot names, each paired with the SAME
  // fixed canon name, all classify allow/known_tool_shape -- proving the
  // negative control above is not vacuous (the recognizer genuinely
  // discriminates, it does not just always block).
  const allNames = Array.from(names);
  const sample = allNames.slice(0, 50);
  check('C: at least 50 real snapshot names exist for the positive-control sample', sample.length === 50, 'got ' + sample.length);
  let allowCount = 0;
  for (const n of sample) {
    const v = part8EgressGuard.classify({ from: n, to: FIXED_CANON_NAME }, { toolName: 'find_connections' });
    if (v.verdict === 'allow' && v.class === 'known_tool_shape') allowCount += 1;
  }
  check('C: all 50 sampled snapshot names classify allow/known_tool_shape paired with a fixed canon name', allowCount === sample.length, 'got ' + allowCount + ' of ' + sample.length);
}

// ---------------------------------------------------------------------------
// Leg (d): BANNED_355 (this phase's own dev-time-Jev ban list) appears on no
// non-comment line under lib/ or hooks/. Scratch negative control proves the
// sweep actually catches a violation.
// ---------------------------------------------------------------------------
const BANNED_355 = [
  'TYPESAFE_API_KEY',
  'api.typesafe.ai',
  'jev-devtime-client',
  'jev-question-ceilings',
  'jev-response-schema',
  'label-355-gold',
  'measure-hsi-thinking-mode',
  'calibrate-citation-check',
  'judge-355-usefulness',
  'capture-355-theo-responses',
  'refresh-framework-names',
  'measure-355-hit-rate',
];

function _sweepBanned355(dirs) {
  const hits = [];
  for (const dir of dirs) {
    const files = hygiene.listFilesRecursive(path.join(REPO, dir));
    for (const f of files) {
      const lines = hygiene.nonCommentLines(f);
      for (const line of lines) {
        for (const token of BANNED_355) {
          if (line.indexOf(token) !== -1) {
            hits.push({ file: f, token });
          }
        }
      }
    }
  }
  return hits;
}

function legD() {
  console.log('--- leg D: BANNED_355 appears on no non-comment lib/ or hooks/ line ---');
  const hits = _sweepBanned355(['lib', 'hooks']);
  check('D: zero BANNED_355 hits under lib/ or hooks/', hits.length === 0, JSON.stringify(hits));

  // Negative control: plant a real violation, prove the sweep catches it,
  // then delete it in finally (never left behind, pass or fail).
  const scratchPath = path.join(REPO, 'lib', 'core', '__scratch_355_egress.cjs');
  try {
    fs.writeFileSync(scratchPath, "'use strict';\nconst jev = require('../../scripts/jev-question-ceilings.cjs');\nmodule.exports = { jev };\n");
    const plantedHits = _sweepBanned355(['lib', 'hooks']);
    const caught = plantedHits.some((h) => h.file === scratchPath && h.token === 'jev-question-ceilings');
    check('D: the scratch negative control is actually caught by the sweep (not vacuous)', caught, JSON.stringify(plantedHits));
  } finally {
    try { fs.unlinkSync(scratchPath); } catch (_e) { /* best-effort */ }
  }
  check('D: the scratch file is deleted after the negative control', !fs.existsSync(scratchPath));
}

// ---------------------------------------------------------------------------
// Leg (e): hooks/hooks.json references no 355 dev-script name.
// ---------------------------------------------------------------------------
function legE() {
  console.log('--- leg E: hooks/hooks.json references no 355 script ---');
  const hooksPath = path.join(REPO, 'hooks', 'hooks.json');
  check('E: hooks/hooks.json exists', fs.existsSync(hooksPath));
  const raw = fs.readFileSync(hooksPath, 'utf8');
  let anyHit = false;
  for (const token of BANNED_355) {
    if (raw.indexOf(token) !== -1) anyHit = true;
  }
  check('E: hooks/hooks.json references none of the BANNED_355 dev-script names', !anyHit);
  const genericHit = /scripts\/[^"]*355[^"]*\.cjs/.test(raw);
  check('E: hooks/hooks.json references no scripts/*355*.cjs path at all', !genericHit);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    legA();
    await legB();
    await legC();
    legD();
    legE();
  } finally {
    // Leg (f): zero fetch attempts across this whole run.
    check('F: installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
