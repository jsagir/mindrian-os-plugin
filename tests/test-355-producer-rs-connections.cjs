#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 17 (HIPS-04, HIPS-05, D-08, D-16, D-18, D-27, D-29, D-30,
 * D-48, D-49, D-50). Stamp coverage, no-decimal and stored-prop proofs for
 * find-bottlenecks (rs-engine.cjs's write-boundary opts.stampFn, the agent's
 * renderBottleneckFinding render seam) and find-connections
 * (scripts/stamp-connections.cjs).
 *
 * Every check label in the "bottlenecks" section starts with the literal
 * "bottlenecks "; every check label in the "connections" section starts
 * with the literal "connections " (355-16 precedent), so a caller can grep
 * `^FAIL: bottlenecks ` or `^FAIL: connections ` independently.
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
const checker = hygiene.makeChecker('test-355-producer-rs-connections');
const { check } = checker;

const { openGraph, closeGraph } = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const rsEngine = require(path.join(REPO, 'lib', 'core', 'rs-engine.cjs'));
const reverseSalientAgent = require(path.join(REPO, 'lib', 'agents', 'reverse-salient-agent.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const floorDisclosure = require(path.join(REPO, 'lib', 'core', 'floor-disclosure.cjs'));
const { makeReplayCallTool, makeNullCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));
const stampConnections = require(path.join(REPO, 'scripts', 'stamp-connections.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
const rsPairsFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'rs-pairs.json'), 'utf8'));

function countStampBlocks(lines) {
  return lines.filter((l) => /^(✓|•|⚠) (strong|indirect|unverified)/.test(l)).length;
}

// ---------------------------------------------------------------------------
// bottlenecks section
// ---------------------------------------------------------------------------

function makeScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-17-' + label + '-'));
  const room = path.join(root, 'room');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
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

async function readRsEdges(roomDir) {
  const graph = await openGraph(roomDir);
  try {
    const rows = graph.conn.prepare("SELECT source, target, properties FROM edges WHERE type = 'REVERSE_SALIENT'").all();
    return rows.map((r) => ({ source: r.source, target: r.target, props: JSON.parse(r.properties) }));
  } finally {
    await closeGraph(graph.db);
  }
}

async function runWriteReverseSalientEdgesLeg() {
  const pairs = rsPairsFixture.pairs;

  // Build stamps for exactly the first two (resolvable, strong-tier) pairs
  // via a replay callTool; the remaining four are deliberately left
  // unstamped in the Map, to prove "exactly the stamped pairs and none on
  // the others".
  const callTool = makeReplayCallTool(stubFixture);
  const stampedIdx = [0, 2]; // 'Reverse Salient Analysis|Six Thinking Hats', 'Systems Thinking|Hierarchy Mapping'
  const stampsByPairKey = new Map();
  for (const i of stampedIdx) {
    const pair = pairs[i];
    const finding = {
      fromHandle: pair.source_title,
      toHandle: pair.target_title,
      fromVia: 'title',
      toVia: 'title',
      direction: pair.direction,
    };
    const stamp = await verificationStamp.stampFinding(finding, { callTool });
    const key = pair.source_artifact_id + '\u0000' + pair.target_artifact_id;
    stampsByPairKey.set(key, verificationStamp.toNodeProps(stamp));
  }

  // With { stampsByPairKey }: exactly the stamped pairs' edges carry stamp
  // props, re-parsing via fromNodeProps; the rest carry none.
  {
    const scratch = makeScratchRoom('write-stamped');
    try {
      const written = await rsEngine.writeReverseSalientEdges(scratch.room, pairs, { stampsByPairKey });
      check('bottlenecks writeReverseSalientEdges (stamped): writes all 6 edges', written === 6, 'got ' + written);
      const edges = await readRsEdges(scratch.room);
      let stampedCount = 0;
      let reparseFailures = 0;
      for (const edge of edges) {
        const key = edge.source + '\u0000' + edge.target;
        const shouldBeStamped = stampsByPairKey.has(key);
        const isStamped = Object.prototype.hasOwnProperty.call(edge.props, 'verification');
        if (isStamped !== shouldBeStamped) {
          check('bottlenecks writeReverseSalientEdges (stamped): ' + key + ' stamp presence matches stampsByPairKey', false, 'expected ' + shouldBeStamped + ' got ' + isStamped);
        }
        if (isStamped) {
          stampedCount += 1;
          try {
            verificationStamp.fromNodeProps(edge.props);
          } catch (_e) {
            reparseFailures += 1;
          }
        }
      }
      check('bottlenecks writeReverseSalientEdges (stamped): exactly 2 edges carry stamp props', stampedCount === 2, 'got ' + stampedCount);
      check('bottlenecks writeReverseSalientEdges (stamped): every stamped edge re-parses via fromNodeProps', reparseFailures === 0, reparseFailures + ' failures');
      // The pre-355 property set is still present, untouched, on every edge.
      const allCarryBaseline = edges.every((e) => 'lsa_score' in e.props && 'semantic_score' in e.props && 'signed_diff' in e.props && 'abs_diff' in e.props && 'direction' in e.props && 'innovation_type' in e.props && e.props.source === 'rs-engine');
      check('bottlenecks writeReverseSalientEdges (stamped): every edge still carries the pre-355 baseline properties', allCarryBaseline);
    } finally {
      scratch.cleanup();
    }
  }

  // Without the option: byte-identical to today's -- no edge carries a
  // verification property at all.
  {
    const scratch = makeScratchRoom('write-nostamp');
    try {
      const written = await rsEngine.writeReverseSalientEdges(scratch.room, pairs);
      check('bottlenecks writeReverseSalientEdges (no option): writes all 6 edges', written === 6, 'got ' + written);
      const edges = await readRsEdges(scratch.room);
      const anyStamped = edges.some((e) => Object.prototype.hasOwnProperty.call(e.props, 'verification'));
      check('bottlenecks writeReverseSalientEdges (no option): no edge carries a verification property', anyStamped === false);
    } finally {
      scratch.cleanup();
    }
  }

  // A third call with an empty Map (the shape opts.stampFn returns when
  // there is nothing to stamp) is equally a no-op.
  {
    const scratch = makeScratchRoom('write-emptymap');
    try {
      const written = await rsEngine.writeReverseSalientEdges(scratch.room, pairs, { stampsByPairKey: new Map() });
      const edges = await readRsEdges(scratch.room);
      const anyStamped = edges.some((e) => Object.prototype.hasOwnProperty.call(e.props, 'verification'));
      check('bottlenecks writeReverseSalientEdges (empty Map): writes all 6 edges and stamps none', written === 6 && anyStamped === false);
    } finally {
      scratch.cleanup();
    }
  }
}

// Static source-order proof (the plan's own fallback when driving
// runModeInternal's embeddings seam directly would require a live/heavy
// encoder): the `await options.stampFn` call textually precedes the
// `writeReverseSalientEdges` call inside runModeInternal.
function runStampFnOrderLeg() {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'rs-engine.cjs'), 'utf8');
  const stampFnIdx = src.indexOf('await options.stampFn');
  const writeIdx = src.indexOf('writeReverseSalientEdges(resolvedRoomDir');
  check('bottlenecks rs-engine.cjs: opts.stampFn is awaited before writeReverseSalientEdges is called', stampFnIdx !== -1 && writeIdx !== -1 && stampFnIdx < writeIdx, 'stampFnIdx=' + stampFnIdx + ' writeIdx=' + writeIdx);

  const requiresStampModule = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').indexOf('verification-stamp') !== -1;
  check('bottlenecks rs-engine.cjs: never requires the stamp module (D-08)', requiresStampModule === false);
}

async function runRenderSeamLeg() {
  const pair = rsPairsFixture.pairs[0]; // Reverse Salient Analysis / Six Thinking Hats, strong 1-hop
  const finding = reverseSalientAgent.composeFinding({
    pair,
    focusContext: null,
    brainContext: { brain: null, graceful_degradation: null },
  });
  check('bottlenecks composeFinding: body_text carries no bracketed differential/similarity number', !/\[signed_diff=|\[abs_diff=/.test(finding.body_text));

  // Theo up (replay): strong stamp.
  {
    const callTool = makeReplayCallTool(stubFixture);
    const rsFinding = {
      fromHandle: pair.source_title,
      toHandle: pair.target_title,
      fromVia: 'title',
      toVia: 'title',
      direction: pair.direction,
    };
    const stamp = await verificationStamp.stampFinding(rsFinding, { callTool });
    const lines = reverseSalientAgent.renderBottleneckFinding(finding, stamp);
    check('bottlenecks renderBottleneckFinding (replay): prints exactly 1 stamp block', countStampBlocks(lines) === 1, 'got ' + countStampBlocks(lines));
    check('bottlenecks renderBottleneckFinding (replay): body_text is present verbatim', lines.indexOf(finding.body_text) !== -1);
    check('bottlenecks renderBottleneckFinding (replay): disclosureLine(\'find-bottlenecks\') is the last line', lines[lines.length - 1] === floorDisclosure.disclosureLine('find-bottlenecks'));
    const scalarResult = verificationStampFormat.assertNoScalar(lines);
    check('bottlenecks renderBottleneckFinding (replay): no decimal or percent token anywhere in the render', scalarResult.withheld === 0, scalarResult.withheld + ' withheld');
    check('bottlenecks renderBottleneckFinding (replay): stamp reports strong/theo', stamp.verification === 'strong' && stamp.backend === 'theo');
  }

  // Theo down (null): honest unverified stamp, still one block, still no
  // decimal, the unverified advice line present.
  {
    const callTool = makeNullCallTool();
    const rsFinding = {
      fromHandle: pair.source_title,
      toHandle: pair.target_title,
      fromVia: 'title',
      toVia: 'title',
      direction: pair.direction,
    };
    const stamp = await verificationStamp.stampFinding(rsFinding, { callTool });
    const lines = reverseSalientAgent.renderBottleneckFinding(finding, stamp);
    check('bottlenecks renderBottleneckFinding (null): prints exactly 1 stamp block', countStampBlocks(lines) === 1, 'got ' + countStampBlocks(lines));
    check('bottlenecks renderBottleneckFinding (null): stamp reports unverified/backend_unavailable', stamp.verification === 'unverified' && stamp.backend === 'unavailable' && stamp.reason === 'backend_unavailable');
    check('bottlenecks renderBottleneckFinding (null): the unverified advice line is present', lines.some((l) => l.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1));
    const scalarResult = verificationStampFormat.assertNoScalar(lines);
    check('bottlenecks renderBottleneckFinding (null): no decimal or percent token anywhere in the render', scalarResult.withheld === 0, scalarResult.withheld + ' withheld');
  }

  // renderBottleneckFinding also accepts a stamp already attached to the
  // finding object (finding.stamp), matching how detectAndSurface wires it
  // before surfaceFinding calls it with no explicit second argument.
  {
    const callTool = makeReplayCallTool(stubFixture);
    const rsFinding = {
      fromHandle: pair.source_title,
      toHandle: pair.target_title,
      fromVia: 'title',
      toVia: 'title',
      direction: pair.direction,
    };
    const stamp = await verificationStamp.stampFinding(rsFinding, { callTool });
    const findingWithStamp = Object.assign({}, finding, {
      stamp,
      stamp_lines: verificationStampFormat.formatStampLines(stamp, 'cli'),
      disclosure: floorDisclosure.disclosureLine('find-bottlenecks'),
    });
    const lines = reverseSalientAgent.renderBottleneckFinding(findingWithStamp);
    check('bottlenecks renderBottleneckFinding (finding.stamp attached, no explicit arg): still prints exactly 1 stamp block', countStampBlocks(lines) === 1, 'got ' + countStampBlocks(lines));
  }
}

async function runBottlenecksSection() {
  await runWriteReverseSalientEdgesLeg();
  runStampFnOrderLeg();
  await runRenderSeamLeg();
}

// ---------------------------------------------------------------------------
// connections section (scripts/stamp-connections.cjs, D-18, D-50)
// ---------------------------------------------------------------------------

async function captureStdoutAsync(fn) {
  const rawLines = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { rawLines.push(String(chunk)); return true; };
  try {
    const result = await fn();
    return { result, rawLines };
  } finally {
    process.stdout.write = original;
  }
}

async function runConnectionsSection() {
  // exports
  check('connections exports: main and parsePairs are both functions', typeof stampConnections.main === 'function' && typeof stampConnections.parsePairs === 'function');

  // parsePairs
  {
    const pairs = stampConnections.parsePairs(['--pair', 'Design Thinking|Jobs to Be Done (JTBD)', '--pair', 'Cynefin Framework|Hedgehog Concept']);
    check('connections parsePairs: reads two repeated --pair flags', pairs.length === 2 && pairs[0].from === 'Design Thinking' && pairs[0].to === 'Jobs to Be Done (JTBD)');
  }
  {
    const tmpFile = path.join(os.tmpdir(), 'mos-355-17-pairs-' + process.pid + '.json');
    fs.writeFileSync(tmpFile, JSON.stringify([{ from: 'Systems Thinking', to: 'Hierarchy Mapping' }]));
    try {
      const pairs = stampConnections.parsePairs(['--pairs-json', tmpFile]);
      check('connections parsePairs: reads --pairs-json', pairs.length === 1 && pairs[0].from === 'Systems Thinking' && pairs[0].to === 'Hierarchy Mapping');
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  }

  const argsBase = [
    '--pair', 'Design Thinking|Jobs to Be Done (JTBD)',
    '--pair', 'Cynefin Framework|Hedgehog Concept',
    '--pair', 'design thinking|Jobs to Be Done (JTBD)', // exact-name refusal: a case variant never resolves
  ];

  // Theo up (replay).
  {
    const callTool = makeReplayCallTool(stubFixture);
    const { result: code, rawLines } = await captureStdoutAsync(() => stampConnections.main(argsBase, { callTool }));
    check('connections main (replay): exit code 0', code === 0, 'got ' + code);
    const lines = rawLines.join('').split('\n').filter((l) => l.length > 0);
    check('connections main (replay): every pair printed with a stamp block (3 pairs == 3 blocks)', countStampBlocks(lines) === 3, 'got ' + countStampBlocks(lines));
    check('connections main (replay): the two resolvable pairs printed under their original names', lines.some((l) => l === 'Design Thinking and Jobs to Be Done (JTBD)') && lines.some((l) => l === 'Cynefin Framework and Hedgehog Concept'));
    check('connections main (replay): the case-variant pair still prints under its ORIGINAL typed name', lines.some((l) => l === 'design thinking and Jobs to Be Done (JTBD)'));
    check('connections main (replay): disclosureLine(\'find-connections\') is the last line', lines[lines.length - 1] === floorDisclosure.disclosureLine('find-connections'));
    const scalarResult = verificationStampFormat.assertNoScalar(lines);
    check('connections main (replay): no decimal or percent token anywhere in the render', scalarResult.withheld === 0, scalarResult.withheld + ' withheld');
    // Theo attempted exactly for the 2 resolvable pairs, never for the
    // case-variant (handle_unresolved, zero calls).
    check('connections main (replay): Theo attempted exactly for the 2 resolvable pairs', callTool.calls.length === 2, 'got ' + callTool.calls.length);
  }

  // Theo down (null).
  {
    const callTool = makeNullCallTool();
    const { result: code, rawLines } = await captureStdoutAsync(() => stampConnections.main(argsBase, { callTool }));
    check('connections main (null): exit code 0', code === 0, 'got ' + code);
    const lines = rawLines.join('').split('\n').filter((l) => l.length > 0);
    check('connections main (null): every pair printed with a stamp block', countStampBlocks(lines) === 3, 'got ' + countStampBlocks(lines));
    const scalarResult = verificationStampFormat.assertNoScalar(lines);
    check('connections main (null): no decimal or percent token anywhere in the render', scalarResult.withheld === 0, scalarResult.withheld + ' withheld');
    check('connections main (null): the advice line is present for the resolvable-but-unreachable pairs', lines.some((l) => l.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1));
  }

  // --json: output re-parses through Stamp.
  {
    const callTool = makeReplayCallTool(stubFixture);
    const { result: code, rawLines } = await captureStdoutAsync(() => stampConnections.main(argsBase.concat(['--json']), { callTool }));
    check('connections main (--json): exit code 0', code === 0, 'got ' + code);
    const parsed = JSON.parse(rawLines.join(''));
    check('connections main (--json): prints an array with one entry per pair', Array.isArray(parsed) && parsed.length === 3, 'got ' + (Array.isArray(parsed) ? parsed.length : typeof parsed));
    let reparseFailures = 0;
    for (const entry of parsed) {
      const safe = verificationStamp.Stamp.safeParse(entry);
      if (!safe.success) reparseFailures += 1;
    }
    check('connections main (--json): every printed stamp object re-parses through Stamp', reparseFailures === 0, reparseFailures + ' failures');
  }

  // Every stamped finding carries direction 'none' (D-49).
  {
    const callTool = makeReplayCallTool(stubFixture);
    const { rawLines } = await captureStdoutAsync(() => stampConnections.main(argsBase.concat(['--json']), { callTool }));
    const parsed = JSON.parse(rawLines.join(''));
    check('connections main (--json): every stamp carries direction "none" (D-49)', parsed.every((s) => s.direction === 'none'));
  }

  // No pairs given -> non-zero exit, no crash.
  {
    const { result: code } = await captureStdoutAsync(() => stampConnections.main([], {}));
    check('connections main (no pairs): non-zero exit code, no throw', code !== 0);
  }

  // --help prints usage and exits 0.
  {
    const { result: code, rawLines } = await captureStdoutAsync(() => stampConnections.main(['--help'], {}));
    check('connections main (--help): exit code 0', code === 0);
    check('connections main (--help): prints usage text', rawLines.join('').indexOf('Usage:') !== -1);
  }

  // Not an MCP tool: zero direct network / tool-registration surface.
  {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'stamp-connections.cjs'), 'utf8');
    const nonComment = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    check('connections stamp-connections.cjs: no fetch/https/registerTool/server.tool( anywhere in non-comment source', !/fetch\(|https?:\/\/|registerTool|server\.tool\(/.test(nonComment));
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    await runBottlenecksSection();
    await runConnectionsSection();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
